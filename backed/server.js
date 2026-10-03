// server.js: Express API + Socket.io live updates. Data lives in PostgreSQL (db.js connects, Neon hosts it).
// Accounts are created by seed.sql or by the admin. EVERYONE logs in with Google only, so nobody can
// type someone else's email and pretend to be them. Admin emails (ADMIN_EMAILS) are admins after Google login.
// The admin can also name a "Minister of Communication" (any account). That person can post lost items
// (photos, videos, files or links) which everybody sees on the public home page under "Trends".
require('dotenv').config();
const express = require('express'), cors = require('cors'), http = require('http');
const jwt = require('jsonwebtoken'), { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { query, one, tx } = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-me';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const LISTS = ['grades', 'classes', 'combos', 'clubs', 'staffRoles', 'families', 'reasons', 'trendCategories'];
const ROLES = ['student', 'teacher', 'psychosocial'];
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// A class is a grade + a combination + an optional section letter, for example "S6 IJABO" or "S6 IJABO A".
const DEFAULT_GRADE_COMBOS = { S4: ['INGABE'], S5: ['INGABO'], S6: ['IJABO'] };
const DEFAULT_TREND_CATEGORIES = ['Clothes', 'Shoes', 'Keys', 'Bags', 'Phones and electronics', 'Books and stationery', 'Documents and IDs', 'Water bottles and lunch boxes', 'Jewelry and watches', 'Other'];
const DEFAULTS = { grades: ['S4', 'S5', 'S6'], gradeCombos: DEFAULT_GRADE_COMBOS, trendCategories: DEFAULT_TREND_CATEGORIES };
const SECTION_RE = /^[A-Z]$/;
const combosFor = (opts, grade) => opts.gradeCombos?.[grade] ?? DEFAULT_GRADE_COMBOS[grade] ?? [];

// Two names are the same person when they have the same words, in any order, ignoring case and accents.
const nameKey = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();
const cleanList = list => [...new Set(list.map(x => String(x).trim()).filter(Boolean))];
const cleanCode = s => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const validEmail = e => /^\S+@\S+\.\S+$/.test(e);

const app = express(), server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT } });
// The big JSON limit is for Lost & Found uploads (photos and files are sent as base64).
app.use(cors({ origin: CLIENT }), express.json({ limit: '30mb' }));

const sign = p => jwt.sign(p, SECRET, { expiresIn: '7d' });
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Please log in again.' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this.' });
  next();
};
// Minister of Communication (or an admin). The flag is checked in the database on every request,
// so removing the minister takes effect straight away without waiting for the token to expire.
const comm = [auth(), wrap(async (req, _res, next) => {
  if (req.user.role !== 'admin') {
    const ok = req.user.id && await one("SELECT 1 AS ok FROM users WHERE id = $1 AND profile->>'comm' = 'true'", [req.user.id]);
    if (!ok) fail(403, 'Only the Minister of Communication can do this.');
  }
  next();
})];

// ---------- Data helpers (views session_seats and application_details are defined in the database) ----------
// Every application row also carries the student's email, Google picture (kept in users.profile, so no new column) and a Gravatar id,
// so the screens can search by email and show a photo without changing the database views.
const withPeople = async rows => {
  const m = new Map((await query(`SELECT username, email, profile->>'picture' AS picture, md5(lower(email)) AS gid FROM users`)).map(r => [r.username, r]));
  return rows.map(a => { const p = m.get(a.name); return { ...a, email: p?.email || '', picture: p?.picture || '', gid: p?.gid || '' }; });
};
const listSessions = () => query('SELECT * FROM session_seats ORDER BY date, "from", lab');
const listApps = async (where = '', params = []) =>
  withPeople(await query('SELECT * FROM application_details' + (where ? ' WHERE ' + where : '') + ' ORDER BY "at", id', params));
const seatsLeft = async (q, sid) => (await q('SELECT "left" FROM session_seats WHERE id = $1', [sid]))[0]?.left ?? 0;
const getApp = async (q, id) => (await q('SELECT * FROM applications WHERE id = $1', [id]))[0] || fail(404, 'Application not found.');
const getOptions = async () => Object.fromEntries((await query('SELECT key, value FROM options')).map(r => [r.key, r.value]));
const saveOption = (q, k, value) => q('INSERT INTO options(key, value) VALUES($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify(value)]);
const CLASS_SQL = "COALESCE(NULLIF(profile->>'cls', ''), profile->>'grade', '')";

// Fills grades, combinations and Lost & Found categories the first time, without touching anything the admin already set.
const seedOptions = async () => {
  const cur = await getOptions();
  for (const [k, v] of Object.entries(DEFAULTS)) {
    const missing = k === 'gradeCombos' ? !cur[k] || Array.isArray(cur[k]) : !Array.isArray(cur[k]) || !cur[k].length;
    if (missing) await saveOption(query, k, v);
  }
};

// Checks a student's grade, combination and optional section. Returns the profile to store.
const studentProfile = async (grade, combo, section) => {
  const opts = await getOptions();
  const grades = opts.grades?.length ? opts.grades : DEFAULTS.grades;
  grade = String(grade || '').trim();
  if (!grades.includes(grade)) fail(400, 'Choose a valid grade.');
  const combos = combosFor(opts, grade);
  combo = String(combo || '').trim();
  if (combos.length && !combos.includes(combo)) fail(400, `Choose a combination for ${grade}: ${combos.join(', ')}.`);
  if (!combos.length) combo = '';
  section = String(section || '').trim().toUpperCase();
  if (section && !SECTION_RE.test(section)) fail(400, 'The section must be one letter from A to Z, or empty.');
  return { grade, combo, section, cls: [grade, combo, section].filter(Boolean).join(' ') };
};

// ---------- Socket.io ----------
io.use((socket, next) => {
  try { socket.user = jwt.verify(socket.handshake.auth.token, SECRET); next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', socket => {
  socket.join(socket.user.role === 'admin' ? 'admins' : `user:${socket.user.name}`);
  listSessions().then(s => socket.emit('seats', s)).catch(() => {});
});
const pushSeats = () => listSessions().then(s => io.emit('seats', s)).catch(() => {});
const pushApps = (names = []) => {
  io.to('admins').emit('applications:update');
  [...new Set(names.filter(Boolean))].forEach(n => io.to(`user:${n}`).emit('applications:update'));
  pushSeats();
};

// ---------- Login: Google only ----------
// Google proves the person owns the email. It never creates an account: the email must already be
// in the users table (added by the admin) or listed in ADMIN_EMAILS. The Google photo is saved for the screens.
app.post('/api/google', wrap(async (req, res) => {
  let p;
  try { p = (await gClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })).getPayload(); }
  catch { fail(401, 'Google sign-in failed. Please try again.'); }
  if (!p.email_verified) fail(403, 'Your Google email is not verified.');
  const email = p.email.toLowerCase(), picture = p.picture || '';
  if (ADMINS.includes(email))
    return res.json({ token: sign({ id: 0, role: 'admin', name: cleanName(p.name || email.split('@')[0]), email, picture }) });
  const u = await one('SELECT id, username, role FROM users WHERE lower(email) = $1', [email]);
  if (!u) fail(403, 'There is no account for this Google email. Ask your admin to add it.');
  if (picture) await query("UPDATE users SET profile = profile || jsonb_build_object('picture', $1::text) WHERE id = $2", [picture, u.id]);
  res.json({ token: sign({ id: u.id, role: u.role, name: u.username, email, picture }) });
}));
// Besides the token data, /api/me says whether this person is a Minister of Communication right now.
app.get('/api/me', auth(), wrap(async (req, res) => {
  let isComm = req.user.role === 'admin';
  if (!isComm && req.user.id) isComm = !!(await one("SELECT 1 AS ok FROM users WHERE id = $1 AND profile->>'comm' = 'true'", [req.user.id]));
  res.json({ ...req.user, comm: isComm });
}));

// ---------- Profile (any logged-in person) ----------
app.get('/api/profile', auth(), wrap(async (req, res) => {
  const me = req.user;
  let info = { name: me.name, email: me.email || '', role: me.role, picture: me.picture || '', cls: '', combo: '', section: '', comm: false };
  if (me.id) {
    const u = await one(`SELECT username, email, role, profile->>'picture' AS picture, ${CLASS_SQL} AS cls, profile->>'combo' AS combo, profile->>'section' AS section, (profile->>'comm' = 'true') AS comm FROM users WHERE id = $1`, [me.id]) || fail(404, 'Account not found.');
    info = { name: u.username, email: u.email, role: u.role, picture: u.picture || me.picture || '', cls: u.cls, combo: u.combo || '', section: u.section || '', comm: !!u.comm };
  }
  let stats = null;
  if (me.role !== 'admin') {
    const rows = await listApps(me.role === 'student' ? 'name = $1' : '"bookedBy" = $1', [me.name]);
    const n = k => rows.filter(a => a.status === k).length;
    stats = { total: rows.length, approved: n('approved'), pending: n('pending'), rejected: n('rejected'),
      present: rows.filter(a => a.att === 'present').length, absent: rows.filter(a => a.att === 'absent').length };
  }
  res.json({ ...info, stats });
}));

// ---------- User accounts (admin only) ----------
app.get('/api/users', auth('admin'), wrap(async (_, res) =>
  res.json(await query(`SELECT id, username AS name, email, role, profile->>'picture' AS picture, md5(lower(email)) AS gid, ${CLASS_SQL} AS "className", profile->>'grade' AS grade, profile->>'combo' AS combo, profile->>'section' AS section, (profile->>'comm' = 'true') AS comm FROM users ORDER BY role, username`))));

const nameTaken = async (name, exceptId = 0) =>
  (await query('SELECT id, username FROM users')).some(r => r.id !== exceptId && nameKey(r.username) === nameKey(name));
const uniqueFail = e => { if (e.code === '23505') fail(409, 'This email or name already has an account.'); throw e; };

app.post('/api/users', auth('admin'), wrap(async (req, res) => {
  const { role, grade, combo, section } = req.body;
  const name = cleanName(req.body.name), email = String(req.body.email || '').trim().toLowerCase();
  if (!name) fail(400, 'Enter the full name.');
  if (!validEmail(email)) fail(400, 'Enter a valid Google email address.');
  if (!ROLES.includes(role)) fail(400, 'Choose a role.');
  const profile = role === 'student' ? await studentProfile(grade, combo, section) : {};
  if (await nameTaken(name)) fail(409, 'Someone with this name already has an account. Add a middle name or number to tell them apart.');
  try {
    try {
      res.json(await one('INSERT INTO users(username, email, role, profile) VALUES($1,$2,$3,$4) RETURNING id, username AS name, email, role', [name, email, role, profile]));
    } catch (e) {
      if (e.code !== '23502') throw e; // not-null violation: the table still has the old "hash" column
      res.json(await one("INSERT INTO users(username, email, hash, role, profile) VALUES($1,$2,'',$3,$4) RETURNING id, username AS name, email, role", [name, email, role, profile]));
    }
  } catch (e) { uniqueFail(e); }
}));

// Name, email and class (students) can change. A new name is copied to bookings and the blacklist.
app.put('/api/users/:id', auth('admin'), wrap(async (req, res) => {
  const u = await one('SELECT id, username, role FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Account not found.');
  const { grade, combo, section } = req.body, sets = [], p = [];
  const add = (col, val) => { p.push(val); sets.push(`${col} = $${p.length}`); };
  let newName = null, emailChanged = false;
  if (req.body.name != null && cleanName(req.body.name) !== u.username) {
    newName = cleanName(req.body.name);
    if (!newName) fail(400, 'The name cannot be empty.');
    if (await nameTaken(newName, u.id)) fail(409, 'Someone with this name already has an account.');
    add('username', newName);
  }
  if (req.body.email) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!validEmail(email)) fail(400, 'Enter a valid Google email address.');
    add('email', email);
    emailChanged = true;
  }
  if (u.role === 'student' && grade) {
    p.push(JSON.stringify(await studentProfile(grade, combo, section)));
    sets.push(`profile = ${emailChanged ? "(profile - 'picture')" : 'profile'} || $${p.length}::jsonb`);
  } else if (emailChanged) sets.push("profile = profile - 'picture'");
  if (!sets.length) return res.json({ ok: true });
  p.push(u.id);
  try {
    await tx(async q => {
      await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $${p.length}`, p);
      if (newName) {
        await q('UPDATE applications SET student = $1 WHERE student = $2', [newName, u.username]);
        await q('UPDATE applications SET booked_by = $1 WHERE booked_by = $2', [newName, u.username]);
        await q('UPDATE blacklist SET name = $1 WHERE name = $2', [newName, u.username]);
        await q('UPDATE trends SET posted_by = $1 WHERE posted_by = $2', [newName, u.username]);
      }
    });
  } catch (e) { uniqueFail(e); }
  pushApps(newName ? [u.username, newName] : [u.username]);
  res.json({ ok: true });
}));

// The admin names (or un-names) a Minister of Communication. It is a flag on the account, so the
// person keeps their role and can still book labs. Their screen refreshes straight away.
app.patch('/api/users/:id/communication', auth('admin'), wrap(async (req, res) => {
  const u = await one('SELECT id, username FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Account not found.');
  if (req.body.on) await query(`UPDATE users SET profile = profile || '{"comm":"true"}'::jsonb WHERE id = $1`, [u.id]);
  else await query("UPDATE users SET profile = profile - 'comm' WHERE id = $1", [u.id]);
  io.to(`user:${u.username}`).emit('me:update');
  res.json({ ok: true });
}));

app.delete('/api/users/:id', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM users WHERE id = $1', [req.params.id]); res.sendStatus(204); }));

// ---------- Options set by the admin (grades, combinations of each grade, reasons...) ----------
app.get('/api/options', wrap(async (_, res) => res.json(await getOptions())));
app.put('/api/options', auth('admin'), wrap(async (req, res) => {
  await tx(async q => {
    for (const [k, v] of Object.entries(req.body)) {
      if (LISTS.includes(k) && Array.isArray(v)) await saveOption(q, k, cleanList(v));
      else if (k === 'gradeCombos' && v && typeof v === 'object' && !Array.isArray(v))
        await saveOption(q, k, Object.fromEntries(Object.entries(v).map(([g, list]) => [String(g).trim(), Array.isArray(list) ? cleanList(list) : []])));
    }
  });
  res.json(await getOptions());
}));

// Rename a grade ({ from, to }) or a combination of a grade ({ grade, from, to }).
// Students who already belong to it are updated too, so nobody loses their class.
app.post('/api/options/rename', auth('admin'), wrap(async (req, res) => {
  const f = cleanCode(req.body.from), t = cleanCode(req.body.to), g = cleanCode(req.body.grade);
  if (!f || !t) fail(400, 'Enter the new name.');
  await tx(async q => {
    const o = Object.fromEntries((await q('SELECT key, value FROM options')).map(r => [r.key, r.value]));
    const grades = [...(o.grades?.length ? o.grades : DEFAULTS.grades)];
    const gc = Object.fromEntries(grades.map(x => [x, [...(o.gradeCombos?.[x] ?? DEFAULT_GRADE_COMBOS[x] ?? [])]]));
    if (g) {
      if (!gc[g]?.includes(f)) fail(404, 'That combination does not exist.');
      if (gc[g].includes(t)) fail(409, `${g} already has a combination called ${t}.`);
      gc[g] = gc[g].map(c => (c === f ? t : c));
      await q(`UPDATE users SET profile = profile || jsonb_build_object('combo', $3::text, 'cls', concat_ws(' ', NULLIF(profile->>'grade',''), $3::text, NULLIF(profile->>'section','')))
               WHERE role = 'student' AND profile->>'grade' = $1 AND profile->>'combo' = $2`, [g, f, t]);
    } else {
      if (!grades.includes(f)) fail(404, 'That grade does not exist.');
      if (grades.includes(t)) fail(409, `The grade ${t} already exists.`);
      grades[grades.indexOf(f)] = t; gc[t] = gc[f]; delete gc[f];
      await q(`UPDATE users SET profile = profile || jsonb_build_object('grade', $2::text, 'cls', concat_ws(' ', $2::text, NULLIF(profile->>'combo',''), NULLIF(profile->>'section','')))
               WHERE role = 'student' AND profile->>'grade' = $1`, [f, t]);
    }
    await saveOption(q, 'grades', grades);
    await saveOption(q, 'gradeCombos', gc);
  });
  res.json(await getOptions());
}));

app.get('/api/classes', auth('teacher', 'psychosocial', 'admin'), wrap(async (_, res) =>
  res.json((await query(`SELECT DISTINCT ${CLASS_SQL} AS cls FROM users WHERE role = 'student' AND ${CLASS_SQL} <> '' ORDER BY cls`)).map(r => r.cls))));

// Students of a class (or all students for psychosocial workers). Search by name or email happens on the screen.
app.get('/api/students', auth('teacher', 'psychosocial', 'admin'), wrap(async (req, res) => {
  const cls = req.query.class || '';
  if (req.user.role === 'teacher' && !cls) fail(400, 'Choose a class first.');
  res.json(await query(`SELECT username AS name, email, profile->>'picture' AS picture, md5(lower(email)) AS gid, ${CLASS_SQL} AS "className", profile->>'family' AS family, profile->>'combo' AS combo
    FROM users WHERE role = 'student' AND ($1::text = '' OR ${CLASS_SQL} = $1::text) ORDER BY username`, [cls]));
}));

// ---------- Labs and schedule ----------
app.get('/api/labs', auth(), wrap(async (_, res) => res.json(await query('SELECT id, name, pcs FROM labs ORDER BY name'))));
app.post('/api/labs', auth('admin'), wrap(async (req, res) => {
  const { name, pcs } = req.body;
  if (!name?.trim() || !(+pcs >= 0)) fail(400, 'Enter a lab name and number of computers.');
  try { res.json(await one('INSERT INTO labs(name, pcs) VALUES($1,$2) RETURNING id', [name.trim(), +pcs])); }
  catch (e) { fail(e.code === '23505' ? 409 : 500, e.code === '23505' ? 'A lab with this name already exists.' : e.message); }
}));
app.put('/api/labs/:id', auth('admin'), wrap(async (req, res) => {
  const { name, pcs } = req.body;
  if (pcs != null && (await listSessions()).some(s => s.labId == req.params.id && s.seats - s.left > +pcs)) fail(409, 'More students are approved than this many computers.');
  await query('UPDATE labs SET name = COALESCE($1, name), pcs = COALESCE($2, pcs) WHERE id = $3', [name ?? null, pcs ?? null, req.params.id]);
  pushSeats(); res.json({ ok: true });
}));
app.delete('/api/labs/:id', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM labs WHERE id = $1', [req.params.id]); pushApps(); res.sendStatus(204); }));

app.get('/api/sessions', auth(), wrap(async (_, res) => res.json(await listSessions())));
app.post('/api/sessions', auth('admin'), wrap(async (req, res) => {
  const { date = new Date().toISOString().slice(0, 10), from, to, labIds } = req.body;
  if (!from || !to || from >= to) fail(400, 'Choose a start time that is before the end time.');
  const labs = (await query('SELECT id FROM labs')).filter(l => !labIds?.length || labIds.includes(l.id));
  if (!labs.length) fail(400, 'Add a lab first.');
  await tx(async q => { for (const l of labs) await q('INSERT INTO sessions(lab_id, date, starts_at, ends_at) VALUES($1,$2,$3,$4)', [l.id, date, from, to]); });
  pushSeats(); res.json({ created: labs.length });
}));
app.put('/api/sessions/:id', auth('admin'), wrap(async (req, res) => {
  const { date, from, to } = req.body;
  await query('UPDATE sessions SET date = COALESCE($1::date, date), starts_at = COALESCE($2::time, starts_at), ends_at = COALESCE($3::time, ends_at) WHERE id = $4', [date ?? null, from ?? null, to ?? null, req.params.id]);
  pushSeats(); res.json({ ok: true });
}));
app.delete('/api/sessions/:id', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM sessions WHERE id = $1', [req.params.id]); pushApps(); res.sendStatus(204); }));

// ---------- Applications ----------
// A person can never hold two live bookings for the same lab time, or for two lab times that overlap on the same day.
app.post('/api/apply', auth('student', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const { reason, students } = req.body, sessionId = +req.body.sessionId;
  const asked = req.user.role === 'student' ? [req.user.name] : (Array.isArray(students) ? students : []);
  const byKey = new Map();
  asked.map(cleanName).filter(Boolean).forEach(n => byKey.has(nameKey(n)) || byKey.set(nameKey(n), n));
  const names = [...byKey.values()];
  if (!names.length) fail(400, 'Choose at least one student.');

  const banned = await query('SELECT name FROM blacklist');
  const blocked = banned.filter(b => byKey.has(nameKey(b.name)));
  if (blocked.length) fail(403, `Blacklisted students cannot apply: ${blocked.map(b => b.name).join(', ')}`);

  const rows = await query(`SELECT username, ${CLASS_SQL} AS cls FROM users WHERE role = 'student' AND username = ANY($1)`, [names]);
  const classes = Object.fromEntries(rows.map(r => [r.username, r.cls]));
  const unknown = names.filter(n => !(n in classes));
  if (unknown.length) fail(400, `No student account found for: ${unknown.join(', ')}`);

  let created = 0; const skipped = [];
  await tx(async q => {
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sessionId]);
    const s = (await q('SELECT date, "from", "to" FROM session_seats WHERE id = $1', [sessionId]))[0] || fail(404, 'That lab time no longer exists.');
    const live = await q("SELECT name, sid, \"from\", \"to\" FROM application_details WHERE status <> 'rejected' AND date = $1", [s.date]);
    for (const n of names) {
      const k = nameKey(n);
      const clash = live.some(b => nameKey(b.name) === k && (+b.sid === sessionId || (b.from < s.to && s.from < b.to)));
      if (clash) { skipped.push(n); continue; }
      created += (await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT (session_id, student) WHERE status <> 'rejected' DO NOTHING RETURNING id",
        [sessionId, n, classes[n] || '', reason || 'Other', req.user.name])).length;
    }
  });
  pushApps([...names, req.user.name]); res.json({ created, skipped });
}));
app.get('/api/apps', auth(), wrap(async (req, res) => res.json(req.user.role === 'admin' ? await listApps() : await listApps('name = $1 OR "bookedBy" = $1', [req.user.name]))));

app.patch('/api/apps/:id/status', auth('admin'), wrap(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) fail(400, 'Unknown status.');
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [a.session_id]);
    if (status === 'approved' && a.status !== 'approved' && await seatsLeft(q, a.session_id) < 1) fail(409, 'This lab is full. Move or swap a student first.');
    await q('UPDATE applications SET status = $1 WHERE id = $2', [status, a.id]);
    return a;
  });
  pushApps([a.student, a.booked_by]); res.json({ ok: true });
}));

app.post('/api/apps/approve-all', auth('admin'), wrap(async (_, res) => {
  const approved = await tx(async q => {
    await q('SELECT id FROM sessions FOR UPDATE');
    let n = 0;
    for (const a of await q("SELECT id, session_id FROM applications WHERE status = 'pending' ORDER BY created_at, id"))
      if (await seatsLeft(q, a.session_id) > 0) { await q("UPDATE applications SET status = 'approved' WHERE id = $1", [a.id]); n++; }
    return n;
  });
  const all = await listApps(); pushApps(all.flatMap(a => [a.name, a.bookedBy])); res.json({ approved });
}));
app.patch('/api/apps/:id/move', auth('admin'), wrap(async (req, res) => {
  const to = +req.body.sessionId;
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [to]);
    if (a.status !== 'rejected') {
      const twice = await q("SELECT 1 FROM applications WHERE session_id = $1 AND lower(student) = lower($2) AND status <> 'rejected' AND id <> $3", [to, a.student, a.id]);
      if (twice.length) fail(409, 'This student already has a booking in that lab time.');
    }
    if (a.status === 'approved' && a.session_id !== to && await seatsLeft(q, to) < 1) fail(409, 'The other lab is full. Swap two students instead.');
    await q('UPDATE applications SET session_id = $1 WHERE id = $2', [to, a.id]);
    return a;
  });
  pushApps([a.student, a.booked_by]); res.json({ ok: true });
}));
app.post('/api/apps/swap', auth('admin'), wrap(async (req, res) => {
  const [a, b] = await tx(async q => {
    const a = await getApp(q, req.body.a), b = await getApp(q, req.body.b);
    await q('UPDATE applications SET session_id = $1 WHERE id = $2', [b.session_id, a.id]);
    await q('UPDATE applications SET session_id = $1 WHERE id = $2', [a.session_id, b.id]);
    return [a, b];
  });
  pushApps([a.student, b.student, a.booked_by, b.booked_by]); res.json({ ok: true });
}));
app.patch('/api/apps/:id/attendance', auth('admin'), wrap(async (req, res) => {
  const att = req.body.att ?? null;
  if (![null, 'present', 'absent'].includes(att)) fail(400, 'Use present or absent.');
  const a = await getApp(query, req.params.id);
  await query('UPDATE applications SET attendance = $1 WHERE id = $2', [att, a.id]);
  pushApps([a.student]); res.json({ ok: true });
}));

// ---------- Blacklist, statistics, history ----------
app.get('/api/blacklist', auth('admin'), wrap(async (_, res) => res.json((await query('SELECT name FROM blacklist ORDER BY name')).map(r => r.name))));
app.post('/api/blacklist', auth('admin'), wrap(async (req, res) => {
  const name = cleanName(req.body.name); if (!name) fail(400, 'Enter a student name.');
  await tx(async q => {
    await q('INSERT INTO blacklist(name, reason) VALUES($1,$2) ON CONFLICT (name) DO UPDATE SET reason = EXCLUDED.reason', [name, req.body.reason || '']);
    await q("UPDATE applications SET status = 'rejected' WHERE student = $1 AND status = 'pending'", [name]);
  });
  pushApps([name]); res.json({ ok: true });
}));
app.delete('/api/blacklist/:name', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM blacklist WHERE name = $1', [req.params.name]); res.sendStatus(204); }));

app.get('/api/stats/overview', auth('admin'), wrap(async (_, res) => {
  const [apps, sessions, labRows, people] = await Promise.all([listApps(), listSessions(), query('SELECT id, name, pcs FROM labs ORDER BY name'), query('SELECT role, COUNT(*)::int AS n FROM users GROUP BY role')]);
  const by = k => apps.filter(a => a.status === k).length;
  const labs = labRows.map(l => {
    const ids = sessions.filter(s => s.labId === l.id).map(s => s.id), as = apps.filter(a => ids.includes(a.sid));
    const cap = l.pcs * ids.length, approved = as.filter(a => a.status === 'approved').length;
    return { lab: l.name, applied: as.length, approved, pending: as.filter(a => a.status === 'pending').length, rejected: as.filter(a => a.status === 'rejected').length, seatsOffered: cap, usagePct: cap ? Math.round(approved / cap * 100) : 0 };
  });
  const count = f => apps.reduce((m, a) => { const v = f(a); if (v) m[v] = (m[v] || 0) + 1; return m; }, {});
  const marked = apps.filter(a => a.att), present = marked.filter(a => a.att === 'present').length;
  res.json({ totals: { applications: apps.length, approved: by('approved'), pending: by('pending'), rejected: by('rejected') }, labs,
    people: Object.fromEntries(people.map(r => [r.role, r.n])),
    mostRequested: [...labs].sort((a, b) => b.applied - a.applied)[0]?.lab || null, byReason: count(a => a.reason), byDay: count(a => a.date), byClass: count(a => a.cls),
    attendance: { present, absent: marked.length - present, rate: marked.length ? Math.round(present / marked.length * 100) : null } });
}));
app.get('/api/stats/absenteeism', auth('admin'), wrap(async (_, res) => {
  const out = {};
  (await listApps('att IS NOT NULL')).forEach(a => { const r = out[a.name] ||= { applied: 0, attended: 0, absent: 0 }; r.applied++; a.att === 'present' ? r.attended++ : r.absent++; });
  res.json(out);
}));
app.get('/api/history', auth('admin'), wrap(async (req, res) => {
  const w = [], p = [];
  if (req.query.date) { p.push(req.query.date); w.push(`date = $${p.length}`); }
  if (req.query.labId) { p.push(+req.query.labId); w.push(`"labId" = $${p.length}`); }
  res.json(await listApps(w.join(' AND '), p));
}));

// ---------- Lost & Found ("Trends") ----------
// The Minister of Communication (or an admin) posts found items with photos, videos, files or links.
// Everybody can see active posts on the home page and contact the poster. A post can be removed once it is
// HOLD_DAYS old (an admin can remove sooner), then reposted, which starts the timer again.
const DAY = 864e5, HOLD_DAYS = 7, MAX_FILES = 6, MAX_FILE = 12 * 1024 * 1024, MAX_TOTAL = 24 * 1024 * 1024;
// Only safe file types are accepted, because the files are served back to visitors.
const FILE_OK = /^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|ogg|quicktime)|text\/plain|application\/(pdf|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)))$/i;
const fileKind = mime => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file');
const linkKind = u => (/\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(u) ? 'image'
  : /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u) || /(youtu\.be|youtube\.com|vimeo\.com)/i.test(u) ? 'video' : 'link');

// Posts with their attachments. Uploaded files are served from /api/trends/files/:id, links keep their own address.
const trendRows = async (where = '', params = []) => {
  const t = await query(`SELECT id, title, description, category, found_at AS "foundAt", contact_phone AS phone, contact_email AS email, status,
    posted_by AS "postedBy", posted_at AS "postedAt", removed_at AS "removedAt", repost_count AS reposts
    FROM trends ${where ? 'WHERE ' + where : ''} ORDER BY posted_at DESC, id DESC`, params);
  if (!t.length) return [];
  const media = await query('SELECT id, trend_id, kind, url, name, mime, (data IS NOT NULL) AS stored FROM trend_media WHERE trend_id = ANY($1) ORDER BY id', [t.map(x => x.id)]);
  const now = Date.now();
  return t.map(x => ({
    ...x,
    daysLeft: Math.max(0, Math.ceil(HOLD_DAYS - (now - new Date(x.postedAt).getTime()) / DAY)),
    media: media.filter(m => m.trend_id === x.id).map(m => ({ id: m.id, kind: m.kind, name: m.name, mime: m.mime, src: m.stored ? `/api/trends/files/${m.id}` : m.url })),
  }));
};
const getTrend = async id => (Number.isInteger(+id) && await one('SELECT * FROM trends WHERE id = $1', [+id])) || fail(404, 'Post not found.');
const trendFields = b => {
  const title = cleanName(b.title);
  if (!title) fail(400, 'Enter a title for the item.');
  const email = String(b.email || '').trim().toLowerCase();
  if (email && !validEmail(email)) fail(400, 'Enter a valid contact email, or leave it empty.');
  return {
    title: title.slice(0, 140), category: cleanName(b.category).slice(0, 60) || 'Other',
    description: String(b.description || '').trim().slice(0, 4000), foundAt: cleanName(b.foundAt).slice(0, 160),
    phone: String(b.phone || '').trim().slice(0, 40), email,
  };
};

// Public: only active posts.
app.get('/api/trends', wrap(async (_, res) => res.json(await trendRows("status = 'active'"))));

// Public: an uploaded photo, video or document (supports Range so videos can be skipped through).
app.get('/api/trends/files/:id', wrap(async (req, res) => {
  const f = (Number.isInteger(+req.params.id) && await one('SELECT name, mime, data FROM trend_media WHERE id = $1 AND data IS NOT NULL', [+req.params.id])) || fail(404, 'File not found.');
  const size = f.data.length;
  res.set({
    'Content-Type': f.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cross-Origin-Resource-Policy': 'cross-origin',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
  });
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (r && (r[1] || r[2])) {
    let start = r[1] ? +r[1] : Math.max(size - +r[2], 0), end = r[1] && r[2] ? Math.min(+r[2], size - 1) : size - 1;
    if (start > end || start >= size) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    return res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 }).end(f.data.subarray(start, end + 1));
  }
  res.set('Content-Length', size).end(f.data);
}));

// Minister of Communication and admins: every post, with its status.
app.get('/api/trends/manage', comm, wrap(async (_, res) => res.json(await trendRows())));

app.post('/api/trends', comm, wrap(async (req, res) => {
  const b = req.body, t = trendFields(b);
  const links = (Array.isArray(b.links) ? b.links : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 10);
  links.forEach(l => { if (!/^https?:\/\/\S+$/i.test(l)) fail(400, `This link is not valid: ${l}`); });
  const files = (Array.isArray(b.files) ? b.files : []).slice(0, MAX_FILES).map(f => ({
    name: cleanName(f.name).slice(0, 120) || 'file', mime: String(f.mime || '').toLowerCase(), buf: Buffer.from(String(f.data || ''), 'base64'),
  })).filter(f => f.buf.length);
  files.forEach(f => {
    if (!FILE_OK.test(f.mime)) fail(400, `This file type is not allowed: ${f.name}. Use photos, videos, PDF or Office files.`);
    if (f.buf.length > MAX_FILE) fail(413, `${f.name} is too big (12 MB maximum). For long videos, paste a link instead.`);
  });
  if (files.reduce((s, f) => s + f.buf.length, 0) > MAX_TOTAL) fail(413, 'The files together are too big (24 MB maximum). Use links for videos.');
  const id = await tx(async q => {
    const row = (await q('INSERT INTO trends(title, description, category, found_at, contact_phone, contact_email, posted_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [t.title, t.description, t.category, t.foundAt, t.phone, t.email, req.user.name]))[0];
    for (const f of files) await q('INSERT INTO trend_media(trend_id, kind, name, mime, data) VALUES($1,$2,$3,$4,$5)', [row.id, fileKind(f.mime), f.name, f.mime, f.buf]);
    for (const l of links) await q('INSERT INTO trend_media(trend_id, kind, url, name) VALUES($1,$2,$3,$4)', [row.id, linkKind(l), l, l.slice(0, 120)]);
    return row.id;
  });
  io.emit('trends:update'); res.json({ id });
}));

// Text details can be corrected at any time (attachments stay as they are).
app.put('/api/trends/:id', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id), t = trendFields(req.body);
  await query('UPDATE trends SET title = $1, description = $2, category = $3, found_at = $4, contact_phone = $5, contact_email = $6 WHERE id = $7',
    [t.title, t.description, t.category, t.foundAt, t.phone, t.email, cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

// The owner came for it.
app.patch('/api/trends/:id/returned', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status !== 'active') fail(409, 'This post is not active.');
  await query("UPDATE trends SET status = 'returned', removed_at = now() WHERE id = $1", [cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

// Taken down after HOLD_DAYS without an owner (admins can do it any time).
app.patch('/api/trends/:id/remove', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status !== 'active') fail(409, 'This post is already off the board.');
  const left = Math.ceil(HOLD_DAYS - (Date.now() - new Date(cur.posted_at).getTime()) / DAY);
  if (req.user.role !== 'admin' && left > 0) fail(409, `A post can be removed ${HOLD_DAYS} days after it was posted. ${left} day${left === 1 ? '' : 's'} left.`);
  await query("UPDATE trends SET status = 'removed', removed_at = now() WHERE id = $1", [cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

// Back on the board with a fresh date, so it counts as new and the 7 days start again.
app.patch('/api/trends/:id/repost', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status === 'active') fail(409, 'This post is already on the board.');
  await query("UPDATE trends SET status = 'active', posted_at = now(), removed_at = NULL, repost_count = repost_count + 1 WHERE id = $1", [cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.delete('/api/trends/:id', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status === 'active' && req.user.role !== 'admin') fail(409, 'Remove the post from the board first.');
  await query('DELETE FROM trends WHERE id = $1', [cur.id]);
  io.emit('trends:update'); res.sendStatus(204);
}));

app.use((err, _req, res, _next) => res.status(Number.isInteger(err.code) && err.code >= 400 && err.code < 600 ? err.code : (err.type === 'entity.too.large' ? 413 : 500)).json({ error: err.type === 'entity.too.large' ? 'The files are too big. Use smaller photos or paste a link for videos.' : err.message || 'Something went wrong.' }));
const port = process.env.PORT || 4000;
query('SELECT 1').then(seedOptions).then(() => server.listen(port, () => console.log('LMS API and Socket.io running on port ' + port)))
  .catch(e => { console.error('Cannot start. Check the DB_* values in .env and that the database is set up.\n', e.message); process.exit(1); });