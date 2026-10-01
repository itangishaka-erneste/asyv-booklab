// server.js: Express API + Socket.io live updates. Data lives in PostgreSQL (db.js connects, database.sql creates the tables).
// Accounts are created by the admin only. People log in with email + password (or Google, if their email was added by the admin).
require('dotenv').config();
const express = require('express'), cors = require('cors'), http = require('http'), crypto = require('crypto');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { query, one, tx } = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-me';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''; // lets the emails in ADMIN_EMAILS log in with a password
const LISTS = ['grades', 'classes', 'combos', 'clubs', 'staffRoles', 'families', 'reasons'];
const ROLES = ['student', 'teacher', 'psychosocial'];
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Subject combinations by level. Senior 4 and 5 share one set, Senior 6 has its own.
// A class is now just grade + combination (for example "S6 PCB"). There are no A / B / C sections.
const COMBOS_S4_S5 = ['MSI', 'MSII', 'ART', 'HUMANITIES'];
const COMBOS_S6 = ['MPC', 'PCB', 'HGL', 'MEG'];
const DEFAULTS = { grades: ['S4', 'S5', 'S6'], combos: [...COMBOS_S4_S5, ...COMBOS_S6] };
const levelOf = cls => (String(cls || '').match(/[456]/) || [])[0];           // "S6 PCB" -> "6"
const combosFor = cls => (levelOf(cls) === '6' ? COMBOS_S6 : levelOf(cls) ? COMBOS_S4_S5 : []);

// Two names are the same person when they have the same words, in any order, ignoring case and spaces.
const nameKey = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();
const validEmail = e => /^\S+@\S+\.\S+$/.test(e);
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const app = express(), server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT } });
app.use(cors({ origin: CLIENT }), express.json());

const sign = p => jwt.sign(p, SECRET, { expiresIn: '7d' });
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Please log in again.' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this.' });
  next();
};

// ---------- Data helpers (the SQL views session_seats and application_details live in database.sql) ----------
const listSessions = () => query('SELECT * FROM session_seats ORDER BY date, "from", lab');
const listApps = (where = '', params = []) => query('SELECT * FROM application_details' + (where ? ' WHERE ' + where : '') + ' ORDER BY "at", id', params);
const seatsLeft = async (q, sid) => (await q('SELECT "left" FROM session_seats WHERE id = $1', [sid]))[0]?.left ?? 0;
const getApp = async (q, id) => (await q('SELECT * FROM applications WHERE id = $1', [id]))[0] || fail(404, 'Application not found.');
const getOptions = async () => Object.fromEntries((await query('SELECT key, value FROM options')).map(r => [r.key, r.value]));
const saveOption = (q, k, list) => q('INSERT INTO options(key, value) VALUES($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify(list)]);
const CLASS_SQL = "COALESCE(profile->>'grade', '') || COALESCE(profile->>'cls', '')";

// Fills grades and combinations the first time, without touching anything the admin already set.
const seedOptions = async () => {
  const cur = await getOptions();
  for (const [k, v] of Object.entries(DEFAULTS)) if (!Array.isArray(cur[k]) || !cur[k].length) await saveOption(query, k, v);
};

// Checks a student's grade + combination and returns the profile to store, e.g. { cls: 'S6 PCB', combo: 'PCB' }.
const studentProfile = async (grade, combo) => {
  const grades = (await getOptions()).grades || DEFAULTS.grades;
  if (!grades.includes(grade) || !levelOf(grade)) fail(400, 'Choose a valid grade.');
  if (!combosFor(grade).includes(combo)) fail(400, `Choose a combination for ${grade}: ${combosFor(grade).join(', ')}.`);
  return { cls: `${grade} ${combo}`, combo };
};

// ---------- Socket.io ----------
// Every logged-in browser gets live seat counts. Admins join the "admins" room, everyone else a private room.
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
  [...new Set(names)].forEach(n => io.to(`user:${n}`).emit('applications:update'));
  pushSeats();
};

// ---------- Login (accounts are created by the admin, nobody signs up alone) ----------
app.post('/api/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
  if (!email || !password) fail(400, 'Enter your email and password.');
  if (ADMINS.includes(email) && ADMIN_PASSWORD && safeEqual(password, ADMIN_PASSWORD))
    return res.json({ token: sign({ id: 0, role: 'admin', name: cleanName(email.split('@')[0]), email }) });
  const u = await one('SELECT id, username, role, hash FROM users WHERE email = $1', [email]);
  if (!u || !(await bcrypt.compare(password, u.hash))) fail(401, 'Wrong email or password.');
  res.json({ token: sign({ id: u.id, role: u.role, name: u.username, email }) });
}));

// Google login only works for emails the admin already added. It never creates an account.
app.post('/api/google', wrap(async (req, res) => {
  let p;
  try { p = (await gClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })).getPayload(); }
  catch { fail(401, 'Google sign-in failed. Please try again.'); }
  if (!p.email_verified) fail(403, 'Your Google email is not verified.');
  const email = p.email.toLowerCase();
  if (ADMINS.includes(email)) return res.json({ token: sign({ id: 0, role: 'admin', name: cleanName(p.name || email.split('@')[0]), email }) });
  const u = await one('SELECT id, username, role FROM users WHERE email = $1', [email]);
  if (!u) fail(403, 'There is no account for this email. Ask your admin to create one.');
  res.json({ token: sign({ id: u.id, role: u.role, name: u.username, email }) });
}));
app.get('/api/me', auth(), (req, res) => res.json(req.user));

// ---------- Profile (any logged-in person) ----------
app.get('/api/profile', auth(), wrap(async (req, res) => {
  const me = req.user;
  let info = { name: me.name, email: me.email || '', role: me.role, cls: '', combo: '' };
  if (me.id) {
    const u = await one(`SELECT username, email, role, ${CLASS_SQL} AS cls, profile->>'combo' AS combo FROM users WHERE id = $1`, [me.id]) || fail(404, 'Account not found.');
    info = { name: u.username, email: u.email, role: u.role, cls: u.cls, combo: u.combo || '' };
  }
  let stats = null;
  if (me.role !== 'admin') {
    const rows = await listApps(me.role === 'student' ? 'name = $1' : '"bookedBy" = $1', [me.name]);
    const n = k => rows.filter(a => a.status === k).length;
    stats = { total: rows.length, approved: n('approved'), pending: n('pending'), rejected: n('rejected'),
      present: rows.filter(a => a.att === 'present').length, absent: rows.filter(a => a.att === 'absent').length };
  }
  res.json({ ...info, canChangePassword: !!me.id, stats });
}));
app.put('/api/profile/password', auth(), wrap(async (req, res) => {
  if (!req.user.id) fail(400, 'This admin password is set in the server .env file (ADMIN_PASSWORD).');
  const { current, next } = req.body;
  if (String(next || '').length < 6) fail(400, 'The new password needs at least 6 characters.');
  const u = await one('SELECT hash FROM users WHERE id = $1', [req.user.id]) || fail(404, 'Account not found.');
  if (!(await bcrypt.compare(String(current || ''), u.hash))) fail(400, 'Your current password is wrong.');
  await query('UPDATE users SET hash = $1 WHERE id = $2', [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ ok: true });
}));

// ---------- User accounts (admin only) ----------
app.get('/api/users', auth('admin'), wrap(async (_, res) =>
  res.json(await query(`SELECT id, username AS name, email, role, ${CLASS_SQL} AS "className", profile->>'combo' AS combo FROM users ORDER BY role, username`))));

app.post('/api/users', auth('admin'), wrap(async (req, res) => {
  const { role, grade, combo, password } = req.body;
  const name = cleanName(req.body.name), email = String(req.body.email || '').trim().toLowerCase();
  if (!name) fail(400, 'Enter the full name.');
  if (!validEmail(email)) fail(400, 'Enter a valid email address.');
  if (!ROLES.includes(role)) fail(400, 'Choose a role.');
  if (String(password || '').length < 6) fail(400, 'The password needs at least 6 characters.');
  const profile = role === 'student' ? await studentProfile(grade, combo) : {};
  // The name is the person's identity in bookings, so it must be unique.
  if ((await query('SELECT username FROM users')).some(r => nameKey(r.username) === nameKey(name)))
    fail(409, 'Someone with this name already has an account. Add a middle name or number to tell them apart.');
  try {
    res.json(await one('INSERT INTO users(username, email, hash, role, profile) VALUES($1,$2,$3,$4,$5) RETURNING id, username AS name, email, role',
      [name, email, await bcrypt.hash(password, 10), role, profile]));
  } catch (e) { fail(e.code === '23505' ? 409 : 500, e.code === '23505' ? 'This email or name already has an account.' : e.message); }
}));

app.put('/api/users/:id', auth('admin'), wrap(async (req, res) => { // email, class (students) and password can change. The name stays, because bookings use it.
  const u = await one('SELECT id, role FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Account not found.');
  const { grade, combo, password } = req.body, sets = [], p = [];
  const add = (col, val) => { p.push(val); sets.push(`${col} = $${p.length}`); };
  if (req.body.email) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!validEmail(email)) fail(400, 'Enter a valid email address.');
    add('email', email);
  }
  if (password) {
    if (String(password).length < 6) fail(400, 'The password needs at least 6 characters.');
    add('hash', await bcrypt.hash(password, 10));
  }
  if (u.role === 'student' && grade) add('profile', await studentProfile(grade, combo));
  if (!sets.length) return res.json({ ok: true });
  p.push(u.id);
  try { await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${p.length}`, p); }
  catch (e) { fail(e.code === '23505' ? 409 : 500, e.code === '23505' ? 'Another account already uses this email.' : e.message); }
  res.json({ ok: true });
}));

app.delete('/api/users/:id', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM users WHERE id = $1', [req.params.id]); res.sendStatus(204); }));

// ---------- Options set by the admin (grades, combinations, reasons...) ----------
app.get('/api/options', wrap(async (_, res) => res.json(await getOptions())));
app.put('/api/options', auth('admin'), wrap(async (req, res) => {
  await tx(async q => {
    for (const [k, v] of Object.entries(req.body))
      if (LISTS.includes(k) && Array.isArray(v))
        await saveOption(q, k, [...new Set(v.map(x => String(x).trim()).filter(Boolean))]);
  });
  res.json(await getOptions());
}));

// Class lists for booking. Teachers must pick a class; psychosocial workers and admins can list everyone.
app.get('/api/students', auth('teacher', 'psychosocial', 'admin'), wrap(async (req, res) => {
  const cls = req.query.class || '';
  if (req.user.role === 'teacher' && !cls) fail(400, 'Choose a class first.');
  res.json(await query(`SELECT username AS name, ${CLASS_SQL} AS "className", profile->>'family' AS family, profile->>'combo' AS combo
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
app.post('/api/sessions', auth('admin'), wrap(async (req, res) => { // labIds omitted = every lab. Date defaults to today.
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
  const byKey = new Map(); // the same person picked twice (or written in a different order) counts once
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
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sessionId]); // one booking at a time per lab time
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
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [a.session_id]); // stops two admins taking the last seat at once
    if (status === 'approved' && a.status !== 'approved' && await seatsLeft(q, a.session_id) < 1) fail(409, 'This lab is full. Move or swap a student first.');
    await q('UPDATE applications SET status = $1 WHERE id = $2', [status, a.id]);
    return a;
  });
  pushApps([a.student, a.booked_by]); res.json({ ok: true });
}));
app.post('/api/apps/approve-all', auth('admin'), wrap(async (_, res) => { // oldest first, stops when a lab is full
  const approved = await tx(async q => {
    await q('SELECT id FROM sessions FOR UPDATE');
    let n = 0;
    for (const a of await q("SELECT id, session_id FROM applications WHERE status = 'pending' ORDER BY created_at, id"))
      if (await seatsLeft(q, a.session_id) > 0) { await q("UPDATE applications SET status = 'approved' WHERE id = $1", [a.id]); n++; }
    return n;
  });
  const all = await listApps(); pushApps(all.flatMap(a => [a.name, a.bookedBy])); res.json({ approved });
}));
app.patch('/api/apps/:id/move', auth('admin'), wrap(async (req, res) => { // shift a student to another lab session
  const to = +req.body.sessionId;
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [to]);
    if (a.status !== 'rejected') { // never leave the same person twice in one lab time
      const twice = await q("SELECT 1 FROM applications WHERE session_id = $1 AND lower(student) = lower($2) AND status <> 'rejected' AND id <> $3", [to, a.student, a.id]);
      if (twice.length) fail(409, 'This student already has a booking in that lab time.');
    }
    if (a.status === 'approved' && a.session_id !== to && await seatsLeft(q, to) < 1) fail(409, 'The other lab is full. Swap two students instead.');
    await q('UPDATE applications SET session_id = $1 WHERE id = $2', [to, a.id]);
    return a;
  });
  pushApps([a.student, a.booked_by]); res.json({ ok: true });
}));
app.post('/api/apps/swap', auth('admin'), wrap(async (req, res) => { // swap two students between two labs when both are full
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
app.get('/api/history', auth('admin'), wrap(async (req, res) => { // ?date=YYYY-MM-DD&labId=1
  const w = [], p = [];
  if (req.query.date) { p.push(req.query.date); w.push(`date = $${p.length}`); }
  if (req.query.labId) { p.push(+req.query.labId); w.push(`"labId" = $${p.length}`); }
  res.json(await listApps(w.join(' AND '), p));
}));

app.use((err, _req, res, _next) => res.status(Number.isInteger(err.code) && err.code >= 400 && err.code < 600 ? err.code : 500).json({ error: err.message || 'Something went wrong.' }));
const port = process.env.PORT || 4000;
query('SELECT 1').then(seedOptions).then(() => server.listen(port, () => console.log('LMS API and Socket.io running on port ' + port)))
  .catch(e => { console.error('Cannot start. Check the DB_* values in .env and that database.sql was run.\n', e.message); process.exit(1); });