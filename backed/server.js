// server.js: Express API + Socket.io live updates. Data lives in PostgreSQL (db.js).
// Accounts are created by seed.sql or by the admin. EVERYONE signs in with Google only.
require('dotenv').config();
const express = require('express'), cors = require('cors'), http = require('http');
const jwt = require('jsonwebtoken'), { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { query, one, tx } = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-me';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const LISTS = ['grades', 'classes', 'combos', 'clubs', 'staffRoles', 'families', 'reasons'];
const ROLES = ['student', 'teacher', 'psychosocial'];
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const DEFAULT_GRADE_COMBOS = { S4: ['INGABE'], S5: ['INGABO'], S6: ['IJABO'] };
const DEFAULT_TREND_CATEGORIES = ['Clothes', 'Shoes', 'Keys', 'Bags', 'Phones and electronics', 'Books and stationery', 'Documents and IDs', 'Water bottles and lunch boxes', 'Jewelry and watches', 'Other'];
const DEFAULTS = { grades: ['S4', 'S5', 'S6'], gradeCombos: DEFAULT_GRADE_COMBOS, trendCategories: DEFAULT_TREND_CATEGORIES };
const SECTION_RE = /^[A-Z0-9]{1,2}$/;
const combosFor = (opts, grade) => opts.gradeCombos?.[grade] ?? DEFAULT_GRADE_COMBOS[grade] ?? [];

const nameKey = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();
const cleanList = list => [...new Set(list.map(x => String(x).trim()).filter(Boolean))];
const cleanCode = s => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const validEmail = e => /^\S+@\S+\.\S+$/.test(e);
const toIds = v => (Array.isArray(v) ? v : []).map(Number).filter(Number.isInteger);

const app = express(), server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT } });
app.use(cors({ origin: CLIENT }), express.json({ limit: '30mb' }));

const sign = p => jwt.sign(p, SECRET, { expiresIn: '7d' });
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Please sign in again.' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this.' });
  next();
};
// Minister of Communication: checked in the database on every request. The admin can always do it too.
const comm = [auth(), wrap(async (req, _res, next) => {
  if (req.user.role === 'admin') return next();
  const ok = req.user.id && await one("SELECT 1 AS ok FROM users WHERE id = $1 AND profile->>'comm' = 'true'", [req.user.id]);
  if (!ok) fail(403, 'Only the Minister of Communication can do this.');
  next();
})];

// ---------- Data helpers ----------
// session_places is a view (see ensureTables). seats = places open, left = seats - approved, published = visible to others.
const CLASS_SQL = "COALESCE(NULLIF(profile->>'cls', ''), profile->>'grade', '')";
const HM = t => String(t || '').slice(0, 5);
const ASSIGNED = 'Assigned by admin';
const forText = s => s.forGroupName || s.forClass || (s.forPeople ? `${s.forPeople} chosen student${s.forPeople === 1 ? '' : 's'}` : '');

const withPeople = async rows => {
  const m = new Map((await query('SELECT username, email, profile->>\'picture\' AS picture, md5(lower(email)) AS gid FROM users')).map(r => [r.username, r]));
  return rows.map(a => { const p = m.get(a.name); return { ...a, email: p?.email || '', picture: p?.picture || '', gid: p?.gid || '' }; });
};

const SESSION_ORDER = 'ORDER BY date, "from", lab';
// Admin: every lab time (drafts too). Students: published lab times they may book. Others: published lab times.
const listSessions = async (all = false, user = null) => {
  if (all) return query(`SELECT * FROM session_places ${SESSION_ORDER}`);
  let rows;
  if (user?.role === 'student') {
    const me = await one(`SELECT id, ${CLASS_SQL} AS cls FROM users WHERE id = $1`, [user.id || 0]);
    rows = await query(`SELECT * FROM session_places sp WHERE published AND (
        NOT exclusive
        OR (sp."forClass" <> '' AND sp."forClass" = $2::text)
        OR (sp."forGroup" IS NOT NULL AND EXISTS (SELECT 1 FROM student_group_members gm WHERE gm.group_id = sp."forGroup" AND gm.user_id = $1::int))
        OR EXISTS (SELECT 1 FROM session_people p WHERE p.session_id = sp.id AND p.user_id = $1::int)
      ) ${SESSION_ORDER}`, [me?.id || 0, me?.cls || '']);
  } else rows = await query(`SELECT * FROM session_places WHERE published ${SESSION_ORDER}`);
  return rows.map(({ people, ...r }) => r);
};
const listApps = async (where = '', params = []) =>
  withPeople(await query('SELECT * FROM application_details' + (where ? ' WHERE ' + where : '') + ' ORDER BY "at", id', params));
const seatsLeft = async (q, sid) => (await q('SELECT "left" FROM session_places WHERE id = $1', [sid]))[0]?.left ?? 0;
const getApp = async (q, id) => (await q('SELECT * FROM applications WHERE id = $1', [id]))[0] || fail(404, 'Booking not found.');
const getOptions = async () => Object.fromEntries((await query('SELECT key, value FROM options')).map(r => [r.key, r.value]));
const saveOption = (q, k, value) => q('INSERT INTO options(key, value) VALUES($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify(value)]);

const seedOptions = async () => {
  const cur = await getOptions();
  for (const [k, v] of Object.entries(DEFAULTS)) {
    const missing = k === 'gradeCombos' ? !cur[k] || Array.isArray(cur[k]) : !Array.isArray(cur[k]) || !cur[k].length;
    if (missing) await saveOption(query, k, v);
  }
};

const studentProfile = async (grade, combo, section) => {
  const opts = await getOptions();
  const grades = opts.grades?.length ? opts.grades : DEFAULTS.grades;
  grade = String(grade || '').trim();
  if (!grades.includes(grade)) fail(400, 'Choose a valid class.');
  const combos = combosFor(opts, grade);
  combo = String(combo || '').trim();
  if (combos.length && !combos.includes(combo)) fail(400, `Choose a valid combination for ${grade}.`);
  if (!combos.length) combo = '';
  section = String(section || '').trim().toUpperCase();
  if (section && !SECTION_RE.test(section)) fail(400, 'The section must be a letter (A to Z) or a number (1 to 12), or empty.');
  return { grade, combo, section, cls: [grade, combo, section].filter(Boolean).join(' ') };
};

// ---------- Socket.io ----------
io.use((socket, next) => {
  const t = socket.handshake.auth?.token;
  if (!t) { socket.user = null; return next(); }
  try { socket.user = jwt.verify(t, SECRET); next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', socket => {
  if (!socket.user) { socket.join('public'); return; }
  socket.join('auth');
  socket.join(socket.user.role === 'admin' ? 'admins' : `user:${socket.user.name}`);
});
// 'seats' is only a signal. Each screen re-reads its own data, so people only see what they may see.
const pushSeats = () => { io.emit('overview:update'); io.to('auth').emit('seats'); };
const pushApps = (names = []) => {
  io.to('admins').emit('applications:update');
  [...new Set(names.filter(Boolean))].forEach(n => io.to(`user:${n}`).emit('applications:update'));
  pushSeats();
};

// ---------- Sign in: Google only ----------
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
  // A photo the person uploaded (link) is kept. Google's photo is used only when no custom photo is set.
  if (picture) await query("UPDATE users SET profile = profile || jsonb_build_object('picture', $1::text) WHERE id = $2 AND COALESCE(profile->>'pictureCustom', '') <> 'true'", [picture, u.id]);
  res.json({ token: sign({ id: u.id, role: u.role, name: u.username, email, picture }) });
}));

app.get('/api/me', auth(), wrap(async (req, res) => {
  let isComm = false, picture = req.user.picture || '';
  if (req.user.id) {
    const row = await one("SELECT profile->>'picture' AS picture, (profile->>'comm' = 'true') AS comm FROM users WHERE id = $1", [req.user.id]);
    isComm = !!row?.comm;
    picture = row?.picture || picture;
  } else if (req.user.role === 'admin') {
    const row = await one('SELECT picture FROM admin_profiles WHERE email = $1', [req.user.email]);
    picture = row?.picture || picture;
  }
  res.json({ ...req.user, picture, comm: isComm });
}));

// Own photo and phone. Everyone can change them, the admin too. Name and email come from the school (or Google for the admin).
app.put('/api/me/profile', auth(), wrap(async (req, res) => {
  const picture = directUrl(String(req.body.picture || '').trim());
  const phone = String(req.body.phone || '').trim().slice(0, 40);
  if (picture && !/^https?:\/\/\S+$/i.test(picture)) fail(400, 'The photo must be a link that starts with http:// or https://');
  if (req.user.role === 'admin') {
    await query('INSERT INTO admin_profiles(email, picture, phone) VALUES($1,$2,$3) ON CONFLICT (email) DO UPDATE SET picture = EXCLUDED.picture, phone = EXCLUDED.phone', [req.user.email, picture, phone]);
    io.to('admins').emit('me:update');
    return res.json({ ok: true });
  }
  if (picture) await query("UPDATE users SET profile = profile || jsonb_build_object('picture', $1::text, 'pictureCustom', 'true', 'phone', $2::text) WHERE id = $3", [picture, phone, req.user.id]);
  else await query("UPDATE users SET profile = (profile - 'pictureCustom' - 'picture') || jsonb_build_object('phone', $1::text) WHERE id = $2", [phone, req.user.id]);
  io.to(`user:${req.user.name}`).emit('me:update');
  res.json({ ok: true });
}));

app.get('/api/profile', auth(), wrap(async (req, res) => {
  const me = req.user;
  let info = { name: me.name, email: me.email || '', role: me.role, picture: me.picture || '', cls: '', combo: '', section: '', phone: '', comm: false };
  if (me.id) {
    const u = await one(`SELECT username, email, role, profile->>'picture' AS picture, ${CLASS_SQL} AS cls, profile->>'combo' AS combo, profile->>'section' AS section, profile->>'phone' AS phone, (profile->>'comm' = 'true') AS comm FROM users WHERE id = $1`, [me.id]) || fail(404, 'Account not found.');
    info = { name: u.username, email: u.email, role: u.role, picture: u.picture || me.picture || '', cls: u.cls, combo: u.combo || '', section: u.section || '', phone: u.phone || '', comm: !!u.comm };
  } else if (me.role === 'admin') {
    const a = await one('SELECT picture, phone FROM admin_profiles WHERE email = $1', [me.email]);
    info.picture = a?.picture || info.picture;
    info.phone = a?.phone || '';
  }
  let stats = null;
  if (me.role !== 'admin') {
    const rows = await listApps(me.role === 'student' ? 'name = $1' : '"bookedBy" = $1', [me.name]);
    const n = k => rows.filter(a => a.status === k).length;
    stats = { total: rows.length, approved: n('approved'), pending: n('pending'), rejected: n('rejected'), present: rows.filter(a => a.att === 'present').length, absent: rows.filter(a => a.att === 'absent').length };
  }
  res.json({ ...info, stats });
}));

// Student or teacher: the class and groups the admin added them to.
app.get('/api/me/memberships', auth('student', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const me = req.user.id ? await one(`SELECT ${CLASS_SQL} AS cls FROM users WHERE id = $1`, [req.user.id]) : null;
  const groups = req.user.id
    ? await query('SELECT g.id, g.name, g.description FROM student_groups g JOIN student_group_members m ON m.group_id = g.id WHERE m.user_id = $1 ORDER BY g.name', [req.user.id])
    : [];
  res.json({ cls: me?.cls || '', groups });
}));

// ---------- Accounts (admin) ----------
app.get('/api/users', auth('admin'), wrap(async (_, res) =>
  res.json(await query(`SELECT id, username AS name, email, role, profile->>'picture' AS picture, profile->>'phone' AS phone, md5(lower(email)) AS gid, ${CLASS_SQL} AS "className", profile->>'grade' AS grade, profile->>'combo' AS combo, profile->>'section' AS section, (profile->>'comm' = 'true') AS comm FROM users ORDER BY role, username`))));

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
  if (req.body.phone) profile.phone = String(req.body.phone).trim().slice(0, 40);
  if (req.body.comm === true && role !== 'student') profile.comm = 'true';
  if (await nameTaken(name)) fail(409, 'Someone with this name already has an account. Add a middle name or number to tell them apart.');
  try {
    try {
      res.json(await one('INSERT INTO users(username, email, role, profile) VALUES($1,$2,$3,$4) RETURNING id, username AS name, email, role', [name, email, role, profile]));
    } catch (e) {
      if (e.code !== '23502') throw e;
      res.json(await one("INSERT INTO users(username, email, hash, role, profile) VALUES($1,$2,'',$3,$4) RETURNING id, username AS name, email, role", [name, email, role, profile]));
    }
  } catch (e) { uniqueFail(e); }
}));

// Edit everything about one account: name, email, role, class, phone, photo.
app.put('/api/users/:id', auth('admin'), wrap(async (req, res) => {
  const u = await one('SELECT id, username, email, role FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Account not found.');
  const b = req.body, sets = [], p = [];
  const add = (col, val) => { p.push(val); sets.push(`${col} = $${p.length}`); };
  let expr = 'profile';
  const merge = obj => { p.push(JSON.stringify(obj)); expr = `(${expr} || $${p.length}::jsonb)`; };
  const drop = k => { expr = `(${expr} - '${k}')`; };

  const role = b.role || u.role;
  if (!ROLES.includes(role)) fail(400, 'Choose a role.');
  let newName = null, emailChanged = false;
  if (b.name != null && cleanName(b.name) !== u.username) {
    newName = cleanName(b.name);
    if (!newName) fail(400, 'The name cannot be empty.');
    if (await nameTaken(newName, u.id)) fail(409, 'Someone with this name already has an account.');
    add('username', newName);
  }
  if (b.email) {
    const email = String(b.email).trim().toLowerCase();
    if (!validEmail(email)) fail(400, 'Enter a valid Google email address.');
    if (email !== String(u.email || '').toLowerCase()) { add('email', email); emailChanged = true; }
  }
  if (role !== u.role) add('role', role);
  if (role === 'student') {
    if (b.grade || role !== u.role) merge(await studentProfile(b.grade, b.combo, b.section));
  } else if (u.role === 'student') {
    ['grade', 'combo', 'section', 'cls'].forEach(drop);
  }
  if (emailChanged && b.picture === undefined) { drop('picture'); drop('pictureCustom'); }
  if (b.picture !== undefined) {
    const pic = directUrl(String(b.picture || '').trim());
    if (pic && !/^https?:\/\/\S+$/i.test(pic)) fail(400, 'The photo must be a link that starts with http:// or https://');
    if (pic) merge({ picture: pic, pictureCustom: 'true' });
    else { drop('picture'); drop('pictureCustom'); }
  }
  if (b.phone !== undefined) merge({ phone: String(b.phone || '').trim().slice(0, 40) });
  if (role === 'student') drop('comm');
  if (expr !== 'profile') sets.push(`profile = ${expr}`);
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
  io.to(`user:${u.username}`).emit('me:update');
  if (newName) io.to(`user:${newName}`).emit('me:update');
  pushApps(newName ? [u.username, newName] : [u.username]);
  res.json({ ok: true });
}));

// Move many selected students to one class at once.
app.patch('/api/students/class', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one student.');
  const p = await studentProfile(req.body.grade, req.body.combo, req.body.section);
  await query("UPDATE users SET profile = profile || $2::jsonb WHERE role = 'student' AND id = ANY($1::int[])", [ids, JSON.stringify(p)]);
  pushSeats();
  res.json({ updated: ids.length });
}));

// Appoint or remove the Minister of Communication (any teacher, psychosocial worker or student).
app.patch('/api/users/:id/communication', auth('admin'), wrap(async (req, res) => {
  const u = await one('SELECT id, username FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Account not found.');
  if (req.body.on) await query(`UPDATE users SET profile = profile || '{"comm":"true"}'::jsonb WHERE id = $1`, [u.id]);
  else await query("UPDATE users SET profile = profile - 'comm' WHERE id = $1", [u.id]);
  io.to(`user:${u.username}`).emit('me:update');
  res.json({ ok: true });
}));

// Deleting an account also removes its own bookings so no ghost names stay in the lab lists.
const deleteUsers = async ids => {
  if (!ids.length) return 0;
  const names = await tx(async q => {
    const list = (await q('SELECT username FROM users WHERE id = ANY($1::int[])', [ids])).map(r => r.username);
    await q('DELETE FROM applications WHERE student = ANY($1::text[])', [list]);
    await q('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
    return list;
  });
  pushApps(names);
  return names.length;
};
app.post('/api/users/bulk-delete', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one account.');
  res.json({ deleted: await deleteUsers(ids) });
}));
app.delete('/api/users/:id', auth('admin'), wrap(async (req, res) => { await deleteUsers(toIds([req.params.id])); res.sendStatus(204); }));

// ---------- Options (reasons, grades, combinations) ----------
app.get('/api/options', wrap(async (_, res) => res.json(await getOptions())));
app.put('/api/options', auth('admin'), wrap(async (req, res) => {
  await tx(async q => {
    for (const [k, v] of Object.entries(req.body)) {
      if (LISTS.includes(k) && Array.isArray(v)) await saveOption(q, k, cleanList(v));
      else if (k === 'gradeCombos' && v && typeof v === 'object' && !Array.isArray(v))
        await saveOption(q, k, Object.fromEntries(Object.entries(v).map(([g, list]) => [String(g).trim(), Array.isArray(list) ? cleanList(list) : []])));
    }
  });
  pushSeats();
  res.json(await getOptions());
}));

app.get('/api/classes', auth('teacher', 'psychosocial', 'admin'), wrap(async (_, res) =>
  res.json((await query(`SELECT DISTINCT ${CLASS_SQL} AS cls FROM users WHERE role = 'student' AND ${CLASS_SQL} <> '' ORDER BY cls`)).map(r => r.cls))));

// Students of a class, of a group (?group=ID), or all students (?class= empty, psychosocial only).
app.get('/api/students', auth('teacher', 'psychosocial', 'admin'), wrap(async (req, res) => {
  const cols = `username AS name, email, profile->>'picture' AS picture, md5(lower(email)) AS gid, ${CLASS_SQL} AS "className", profile->>'combo' AS combo`;
  const gid = Number(req.query.group) || 0;
  if (gid) return res.json(await query(`SELECT ${cols} FROM users WHERE role = 'student' AND id IN (SELECT user_id FROM student_group_members WHERE group_id = $1) ORDER BY username`, [gid]));
  const cls = req.query.class || '';
  if (req.user.role === 'teacher' && !cls) fail(400, 'Choose a class or a group first.');
  res.json(await query(`SELECT ${cols} FROM users WHERE role = 'student' AND ($1::text = '' OR ${CLASS_SQL} = $1::text) ORDER BY username`, [cls]));
}));

// ---------- Student groups ----------
const splitTokens = v => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean))];
const resolveStudents = async tokens => {
  const studs = await query("SELECT id, username, lower(email) AS email FROM users WHERE role = 'student'");
  const byEmail = new Map(studs.map(s => [s.email, s])), byName = new Map(studs.map(s => [nameKey(s.username), s]));
  const ids = new Set(), notFound = [];
  tokens.forEach(t => { const s = t.includes('@') ? byEmail.get(t.toLowerCase()) : byName.get(nameKey(t)); s ? ids.add(s.id) : notFound.push(t); });
  return { ids: [...ids], notFound };
};
const addMembers = async (q, gid, ids) => {
  if (!ids.length) return 0;
  return (await q('INSERT INTO student_group_members(group_id, user_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING RETURNING user_id', [gid, ids])).length;
};
const getGroup = async id => (Number.isInteger(+id) && await one('SELECT id, name, description FROM student_groups WHERE id = $1', [+id])) || fail(404, 'Group not found.');
const groupName = async (name, exceptId = 0) => {
  name = cleanName(name).slice(0, 80);
  if (!name) fail(400, 'Enter a name for the group.');
  if ((await query('SELECT id, name FROM student_groups')).some(g => g.id !== exceptId && g.name.toLowerCase() === name.toLowerCase())) fail(409, 'A group with this name already exists.');
  return name;
};

app.get('/api/groups', auth('admin', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const groups = await query('SELECT id, name, description FROM student_groups ORDER BY name');
  const m = await query(`SELECT gm.group_id, id, username AS name, email, profile->>'picture' AS picture, md5(lower(email)) AS gid, ${CLASS_SQL} AS "className"
    FROM student_group_members gm JOIN users u ON u.id = gm.user_id ORDER BY username`);
  res.json(groups.map(g => {
    const members = m.filter(r => r.group_id === g.id).map(({ group_id, ...r }) => r);
    return req.user.role === 'admin' ? { ...g, count: members.length, members } : { ...g, count: members.length };
  }));
}));

app.post('/api/groups', auth('admin'), wrap(async (req, res) => {
  const name = await groupName(req.body.name);
  const { ids, notFound } = await resolveStudents(splitTokens(req.body.members));
  const out = await tx(async q => {
    const g = (await q('INSERT INTO student_groups(name, description) VALUES($1,$2) RETURNING id', [name, String(req.body.description || '').trim().slice(0, 300)]))[0];
    return { id: g.id, added: await addMembers(q, g.id, ids) };
  });
  pushSeats();
  res.json({ ...out, notFound });
}));

app.put('/api/groups/:id', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  const name = await groupName(req.body.name ?? g.name, g.id);
  await query('UPDATE student_groups SET name = $1, description = $2 WHERE id = $3', [name, String(req.body.description ?? g.description ?? '').trim().slice(0, 300), g.id]);
  pushSeats();
  res.json({ ok: true });
}));

app.post('/api/groups/:id/members', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  const { ids, notFound } = await resolveStudents(splitTokens(req.body.members));
  const added = await tx(q => addMembers(q, g.id, ids));
  pushSeats();
  res.json({ added, notFound });
}));

app.delete('/api/groups/:id/members/:userId', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  await query('DELETE FROM student_group_members WHERE group_id = $1 AND user_id = $2', [g.id, +req.params.userId]);
  pushSeats();
  res.sendStatus(204);
}));

app.delete('/api/groups/:id', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  await query('DELETE FROM student_groups WHERE id = $1', [g.id]);
  pushSeats();
  res.sendStatus(204);
}));

// ---------- Labs ----------
app.get('/api/labs', auth(), wrap(async (_, res) => res.json(await query('SELECT id, name, pcs FROM labs ORDER BY name'))));
app.post('/api/labs', auth('admin'), wrap(async (req, res) => {
  const { name, pcs } = req.body;
  if (!name?.trim() || !(+pcs >= 1)) fail(400, 'Enter a lab name and at least one computer.');
  try { res.json(await one('INSERT INTO labs(name, pcs) VALUES($1,$2) RETURNING id', [name.trim(), +pcs])); }
  catch (e) { fail(e.code === '23505' ? 409 : 500, e.code === '23505' ? 'A lab with this name already exists.' : e.message); }
}));
app.put('/api/labs/:id', auth('admin'), wrap(async (req, res) => {
  const { pcs } = req.body;
  const name = req.body.name == null ? null : String(req.body.name).trim();
  if (name !== null && !name) fail(400, 'The lab name cannot be empty.');
  if (pcs != null && !(+pcs >= 1)) fail(400, 'A lab needs at least one computer.');
  if (pcs != null && (await listSessions(true)).some(s => s.labId == req.params.id && s.seats - s.left > +pcs)) fail(409, 'More students are approved than this many computers.');
  try {
    await tx(async q => {
      await q('UPDATE labs SET name = COALESCE($1, name), pcs = COALESCE($2, pcs) WHERE id = $3', [name, pcs ?? null, req.params.id]);
      if (pcs != null) await q('UPDATE sessions SET places = LEAST(places, $1::int) WHERE lab_id = $2 AND places IS NOT NULL', [+pcs, req.params.id]);
    });
  } catch (e) { if (e.code === '23505') fail(409, 'A lab with this name already exists.'); throw e; }
  pushSeats(); res.json({ ok: true });
}));
app.delete('/api/labs/:id', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM labs WHERE id = $1', [req.params.id]); pushApps(); res.sendStatus(204); }));

// ---------- Who a lab time is for ----------
// audience = { kind: '' | 'class' | 'group' | 'people', value, people: [names or emails], exclusive }
const parseAudience = async (a = {}) => {
  const kind = ['class', 'group', 'people'].includes(a?.kind) ? a.kind : '';
  const none = { kind: '', forClass: '', forGroup: null, ids: [], notFound: [], exclusive: false };
  if (!kind) return none;
  const exclusive = a.exclusive !== false;
  if (kind === 'class') {
    const c = cleanName(a.value);
    if (!c || !(await one(`SELECT 1 AS ok FROM users WHERE role = 'student' AND ${CLASS_SQL} = $1 LIMIT 1`, [c]))) fail(400, 'No student is in that class.');
    return { ...none, kind, forClass: c, exclusive };
  }
  if (kind === 'group') {
    const g = await getGroup(a.value);
    return { ...none, kind, forGroup: g.id, exclusive };
  }
  const { ids, notFound } = await resolveStudents(splitTokens(a.people));
  if (!ids.length) fail(400, 'Choose at least one student from the list.');
  return { ...none, kind, ids, notFound, exclusive };
};
const setPeople = async (q, sid, ids) => {
  await q('DELETE FROM session_people WHERE session_id = $1', [sid]);
  if (ids.length) await q('INSERT INTO session_people(session_id, user_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [sid, ids]);
};
const membersOf = (q, s) => q(`SELECT u.id, u.username, ${CLASS_SQL} AS cls FROM users u WHERE u.role = 'student' AND (
    ($1::text <> '' AND ${CLASS_SQL} = $1::text)
    OR ($2::int IS NOT NULL AND u.id IN (SELECT user_id FROM student_group_members WHERE group_id = $2::int))
    OR u.id IN (SELECT user_id FROM session_people WHERE session_id = $3::int)
  ) ORDER BY u.username`, [s.for_class || '', s.for_group || null, s.id]);

// Books the assigned students: approved while places remain, then pending. Removes automatic bookings of people no longer assigned.
const syncAssigned = async (q, sid) => {
  await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sid]);
  const s = (await q(`SELECT id, to_char(date, 'YYYY-MM-DD') AS d, to_char(starts_at, 'HH24:MI') AS "from", to_char(ends_at, 'HH24:MI') AS "to", for_class, for_group FROM sessions WHERE id = $1`, [sid]))[0];
  if (!s) return [];
  const members = await membersOf(q, s);
  const touched = members.map(m => m.username);
  const stale = await q('DELETE FROM applications WHERE session_id = $1 AND booked_by = $2 AND NOT (student = ANY($3::text[])) RETURNING student', [sid, ASSIGNED, touched]);
  stale.forEach(r => touched.push(r.student));
  if (!members.length) return touched;
  const banned = new Set((await q('SELECT name FROM blacklist')).map(b => nameKey(b.name)));
  const live = await q("SELECT name, sid, \"from\", \"to\" FROM application_details WHERE status <> 'rejected' AND date = $1", [s.d]);
  let left = await seatsLeft(q, sid);
  for (const m of members) {
    const k = nameKey(m.username);
    if (banned.has(k)) continue;
    const clash = live.some(b => nameKey(b.name) === k && (+b.sid === +sid || (HM(b.from) < s.to && s.from < HM(b.to))));
    if (clash) continue;
    const status = left > 0 ? 'approved' : 'pending';
    const made = await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by, status) VALUES($1,$2,$3,'Assigned',$4,$5) ON CONFLICT (session_id, student) WHERE status <> 'rejected' DO NOTHING RETURNING id",
      [sid, m.username, m.cls || '', ASSIGNED, status]);
    if (made.length && status === 'approved') left--;
  }
  return touched;
};

// ---------- Lab times ----------
app.get('/api/sessions', auth(), wrap(async (req, res) => res.json(await listSessions(req.user.role === 'admin', req.user))));

app.post('/api/sessions', auth('admin'), wrap(async (req, res) => {
  const { date = new Date().toISOString().slice(0, 10), from, to, labIds } = req.body;
  const published = req.body.published === true;
  if (!from || !to || from >= to) fail(400, 'The start time must be before the end time.');
  const wanted = req.body.places === undefined || req.body.places === null || req.body.places === '' ? null : Math.floor(+req.body.places);
  if (wanted !== null && !(wanted >= 1)) fail(400, 'Places open must be 1 or more.');
  const labs = (await query('SELECT id, pcs FROM labs')).filter(l => !labIds?.length || labIds.includes(l.id));
  if (!labs.length) fail(400, 'Add a lab first.');
  if (wanted !== null && labs.length === 1 && wanted > labs[0].pcs) fail(400, `This lab has only ${labs[0].pcs} computers.`);
  const aud = await parseAudience(req.body.audience);
  if (aud.kind && labs.length > 1) fail(400, 'Choose one lab when you assign a class, a group or people.');
  const touched = [];
  await tx(async q => {
    for (const l of labs) {
      const row = (await q('INSERT INTO sessions(lab_id, date, starts_at, ends_at, places, published, for_class, for_group, exclusive) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [l.id, date, from, to, wanted === null ? null : Math.min(wanted, l.pcs), published, aud.forClass, aud.forGroup, aud.exclusive]))[0];
      await setPeople(q, row.id, aud.ids);
      if (aud.kind) touched.push(...await syncAssigned(q, row.id));
    }
  });
  pushApps(touched);
  res.json({ created: labs.length, published, assigned: touched.length, notFound: aud.notFound });
}));

// Edit a lab time: day, times, places open (empty = every computer) and who it is for.
app.put('/api/sessions/:id', auth('admin'), wrap(async (req, res) => {
  const { date, from, to } = req.body;
  const s = await one('SELECT id, seats, "left", "labId", "from", "to" FROM session_places WHERE id = $1', [req.params.id]) || fail(404, 'That lab time does not exist.');
  if ((from || s.from) >= (to || s.to)) fail(400, 'The start time must be before the end time.');
  let places = null, clearPlaces = false;
  if (req.body.places === '' || req.body.places === 'all') clearPlaces = true;
  else if (req.body.places != null) {
    places = Math.floor(+req.body.places);
    const pcs = (await one('SELECT pcs FROM labs WHERE id = $1', [s.labId])).pcs;
    if (!(places >= 1)) fail(400, 'Places open must be 1 or more.');
    if (places > pcs) fail(400, `This lab has only ${pcs} computers.`);
    if (s.seats - s.left > places) fail(409, `${s.seats - s.left} students are already approved. Move some first.`);
  }
  const aud = req.body.audience !== undefined ? await parseAudience(req.body.audience) : null;
  const touched = [];
  await tx(async q => {
    await q('UPDATE sessions SET date = COALESCE($1::date, date), starts_at = COALESCE($2::time, starts_at), ends_at = COALESCE($3::time, ends_at), places = CASE WHEN $6::boolean THEN NULL ELSE COALESCE($4::int, places) END WHERE id = $5',
      [date ?? null, from ?? null, to ?? null, places, s.id, clearPlaces]);
    if (aud) {
      await q('UPDATE sessions SET for_class = $1, for_group = $2, exclusive = $3 WHERE id = $4', [aud.forClass, aud.forGroup, aud.exclusive, s.id]);
      await setPeople(q, s.id, aud.ids);
      touched.push(...await syncAssigned(q, s.id));
    }
  });
  pushApps(touched);
  res.json({ ok: true, assigned: touched.length, notFound: aud?.notFound || [] });
}));

app.patch('/api/sessions/:id/publish', auth('admin'), wrap(async (req, res) => {
  const r = await query('UPDATE sessions SET published = $1 WHERE id = $2 RETURNING id', [req.body.published === true, req.params.id]);
  if (!r.length) fail(404, 'That lab time does not exist.');
  pushApps(); res.json({ ok: true });
}));
app.post('/api/sessions/publish-all', auth('admin'), wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
  const r = await query('UPDATE sessions SET published = true WHERE published = false AND ($1::int[] IS NULL OR id = ANY($1::int[])) RETURNING id', [ids]);
  pushApps(); res.json({ published: r.length });
}));
app.post('/api/sessions/bulk-delete', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one lab time.');
  const r = await query('DELETE FROM sessions WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  pushApps(); res.json({ deleted: r.length });
}));
app.delete('/api/sessions/:id', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM sessions WHERE id = $1', [req.params.id]); pushApps(); res.sendStatus(204); }));

// ---------- Public lab overview (no login, counts only, never names) ----------
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
app.get('/api/overview', wrap(async (req, res) => {
  const date = ISO_DAY.test(String(req.query.date || '')) ? String(req.query.date) : new Date().toISOString().slice(0, 10);
  const [labRows, sessions, pend] = await Promise.all([
    query('SELECT id, name, pcs FROM labs ORDER BY name'),
    listSessions(),
    query("SELECT sid, COUNT(*)::int AS n FROM application_details WHERE status = 'pending' GROUP BY sid"),
  ]);
  const pendBy = new Map(pend.map(r => [Number(r.sid), r.n]));
  const dayOf = s => String(s.date).slice(0, 10);
  const today = sessions.filter(s => dayOf(s) === date);
  const labs = labRows.map(l => {
    const list = today.filter(s => s.labId == l.id)
      .map(s => {
        const taken = Math.max(s.seats - s.left, 0), p = pendBy.get(Number(s.id)) || 0;
        const waiting = Math.min(p, Math.max(s.left, 0));
        return { id: s.id, from: HM(s.from), to: HM(s.to), seats: s.seats, left: s.left, taken, waiting, over: p - waiting, open: Math.max(s.left - waiting, 0), for: forText(s), exclusive: !!s.exclusive };
      })
      .sort((a, b) => a.from.localeCompare(b.from));
    const sum = k => list.reduce((n, s) => n + s[k], 0);
    const seats = sum('seats'), left = sum('left'), free = sum('open');
    const status = !list.length ? 'none' : left === 0 ? 'full' : free === 0 ? 'requested' : free / seats <= 0.3 ? 'limited' : 'available';
    return { id: l.id, name: l.name, pcs: l.pcs, status, seats, free, taken: sum('taken'), waiting: sum('waiting'), sessions: list };
  });
  res.json({
    date,
    days: [...new Set(sessions.map(dayOf))].sort(),
    totals: {
      labs: labs.length, computers: labs.reduce((n, l) => n + l.pcs, 0),
      times: today.length, free: labs.reduce((n, l) => n + l.free, 0), seats: labs.reduce((n, l) => n + l.seats, 0),
      waiting: labs.reduce((n, l) => n + l.waiting, 0),
    },
    labs,
  });
}));

// ---------- Bookings ----------
// One live booking per person per lab time, and no overlaps on the same day. Exclusive lab times are only for the assigned people.
app.post('/api/apply', auth('student', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const { reason, students } = req.body, sessionId = +req.body.sessionId;
  const asked = req.user.role === 'student' ? [req.user.name] : (Array.isArray(students) ? students : []);
  const byKey = new Map();
  asked.map(cleanName).filter(Boolean).forEach(n => byKey.has(nameKey(n)) || byKey.set(nameKey(n), n));
  const names = [...byKey.values()];
  if (!names.length) fail(400, 'Choose at least one student.');

  const banned = await query('SELECT name FROM blacklist');
  const blocked = banned.filter(b => byKey.has(nameKey(b.name)));
  if (blocked.length) fail(403, `Blocked students cannot book: ${blocked.map(b => b.name).join(', ')}`);

  const rows = await query(`SELECT username, ${CLASS_SQL} AS cls FROM users WHERE role = 'student' AND username = ANY($1)`, [names]);
  const classes = Object.fromEntries(rows.map(r => [r.username, r.cls]));
  const unknown = names.filter(n => !(n in classes));
  if (unknown.length) fail(400, `No student account found for: ${unknown.join(', ')}`);

  let created = 0; const skipped = [];
  await tx(async q => {
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sessionId]);
    const s = (await q('SELECT date, "from", "to", published FROM session_places WHERE id = $1', [sessionId]))[0];
    if (!s || !s.published) fail(404, 'That lab time is not open for booking.');
    const raw = (await q('SELECT id, exclusive, for_class, for_group FROM sessions WHERE id = $1', [sessionId]))[0];
    if (raw?.exclusive) {
      const allowed = new Set((await membersOf(q, raw)).map(m => nameKey(m.username)));
      const out = names.filter(n => !allowed.has(nameKey(n)));
      if (out.length) fail(403, req.user.role === 'student'
        ? 'This lab time is only for the people the admin chose.'
        : `This lab time is only for the people the admin chose. Not allowed: ${out.join(', ')}.`);
    }
    const live = await q("SELECT name, sid, \"from\", \"to\" FROM application_details WHERE status <> 'rejected' AND date = $1", [s.date]);
    for (const n of names) {
      const k = nameKey(n);
      const clash = live.some(b => nameKey(b.name) === k && (+b.sid === sessionId || (HM(b.from) < HM(s.to) && HM(s.from) < HM(b.to))));
      if (clash) { skipped.push(n); continue; }
      created += (await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT (session_id, student) WHERE status <> 'rejected' DO NOTHING RETURNING id",
        [sessionId, n, classes[n] || '', reason || 'Other', req.user.name])).length;
    }
  });
  pushApps([...names, req.user.name]);
  res.json({ created, skipped });
}));

// People who are not the admin never see bookings of lab times that are still drafts.
app.get('/api/apps', auth(), wrap(async (req, res) => res.json(req.user.role === 'admin'
  ? await listApps()
  : await listApps('(name = $1 OR "bookedBy" = $1) AND sid IN (SELECT id FROM session_places WHERE published)', [req.user.name]))));

app.patch('/api/apps/:id/status', auth('admin'), wrap(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) fail(400, 'Unknown status.');
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [a.session_id]);
    if (status === 'approved' && a.status !== 'approved' && await seatsLeft(q, a.session_id) < 1) fail(409, 'No places left in this lab time.');
    await q('UPDATE applications SET status = $1 WHERE id = $2', [status, a.id]);
    return a;
  });
  pushApps([a.student, a.booked_by]); res.json({ ok: true });
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
    if (a.status === 'approved' && a.session_id !== to && await seatsLeft(q, to) < 1) fail(409, 'The other lab time is full.');
    await q('UPDATE applications SET session_id = $1 WHERE id = $2', [to, a.id]);
    return a;
  });
  pushApps([a.student, a.booked_by]); res.json({ ok: true });
}));

app.patch('/api/apps/:id/attendance', auth('admin'), wrap(async (req, res) => {
  const att = req.body.att ?? null;
  if (![null, 'present', 'absent'].includes(att)) fail(400, 'Use present or absent.');
  const a = await getApp(query, req.params.id);
  await query('UPDATE applications SET attendance = $1 WHERE id = $2', [att, a.id]);
  pushApps([a.student]); res.json({ ok: true });
}));

// Many bookings at once: approve, reject, set back to waiting, mark present / absent / clear the mark, or remove.
// Used for "all", "selected" and one lab time's whole list.
app.post('/api/apps/bulk', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids), action = req.body.action;
  if (!ids.length) fail(400, 'Choose at least one booking.');
  if (!['approve', 'reject', 'pending', 'present', 'absent', 'clear', 'delete'].includes(action)) fail(400, 'Unknown action.');
  let done = 0, skipped = 0, names = [];
  await tx(async q => {
    const rows = await q('SELECT id, session_id, status, student, booked_by FROM applications WHERE id = ANY($1::int[]) ORDER BY session_id, id', [ids]);
    names = rows.flatMap(r => [r.student, r.booked_by]);
    if (action === 'approve') {
      const locked = new Set();
      for (const r of rows) {
        if (!locked.has(r.session_id)) { await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [r.session_id]); locked.add(r.session_id); }
        if (r.status === 'approved') continue;
        if (await seatsLeft(q, r.session_id) < 1) { skipped++; continue; }
        await q("UPDATE applications SET status = 'approved' WHERE id = $1", [r.id]);
        done++;
      }
    } else if (action === 'reject' || action === 'pending') {
      done = (await q('UPDATE applications SET status = $2 WHERE id = ANY($1::int[]) RETURNING id', [ids, action === 'reject' ? 'rejected' : 'pending'])).length;
    } else if (action === 'delete') {
      done = (await q('DELETE FROM applications WHERE id = ANY($1::int[]) RETURNING id', [ids])).length;
    } else {
      const att = action === 'clear' ? null : action;
      done = (await q("UPDATE applications SET attendance = $2 WHERE id = ANY($1::int[]) AND status = 'approved' RETURNING id", [ids, att])).length;
    }
  });
  pushApps(names);
  res.json({ done, skipped });
}));

// ---------- Blocked students and statistics ----------
app.get('/api/blacklist', auth('admin'), wrap(async (_, res) => res.json((await query('SELECT name FROM blacklist ORDER BY name')).map(r => r.name))));
app.post('/api/blacklist', auth('admin'), wrap(async (req, res) => {
  const name = cleanName(req.body.name); if (!name) fail(400, 'Enter a student name.');
  await tx(async q => {
    await q('INSERT INTO blacklist(name, reason) VALUES($1,$2) ON CONFLICT (name) DO UPDATE SET reason = EXCLUDED.reason', [name, req.body.reason || '']);
    await q("UPDATE applications SET status = 'rejected' WHERE student = $1 AND status = 'pending'", [name]);
  });
  pushApps([name]); res.json({ ok: true });
}));
app.delete('/api/blacklist/:name', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM blacklist WHERE name = $1', [req.params.name]); pushApps(); res.sendStatus(204); }));

app.get('/api/stats/overview', auth('admin'), wrap(async (_, res) => {
  const [apps, labRows] = await Promise.all([listApps(), query('SELECT id, name, pcs FROM labs ORDER BY name')]);
  const by = k => apps.filter(a => a.status === k).length;
  const marked = apps.filter(a => a.att), present = marked.filter(a => a.att === 'present').length;
  res.json({
    totals: { applications: apps.length, approved: by('approved'), pending: by('pending'), rejected: by('rejected') },
    labs: labRows.length,
    attendance: { present, absent: marked.length - present, rate: marked.length ? Math.round(present / marked.length * 100) : null },
  });
}));

// ---------- Lost & Found ----------
const DAY = 864e5, HOLD_DAYS = 7, MAX_FILES = 6, MAX_FILE = 12 * 1024 * 1024, MAX_TOTAL = 24 * 1024 * 1024;
const FILE_OK = /^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|ogg|quicktime)|text\/plain|application\/(pdf|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)))$/i;
const fileKind = mime => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file');
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i;
const VID_EXT = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;
function directUrl(u) {
  let m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
  if (/^https?:\/\/(www\.)?dropbox\.com\//i.test(u)) { try { const x = new URL(u); x.searchParams.delete('dl'); x.searchParams.set('raw', '1'); return x.toString(); } catch { return u; } }
  m = u.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,8})\/?$/);
  return m ? `https://i.imgur.com/${m[1]}.jpg` : u;
}
const PRIVATE_HOST = /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i;
const resolveLink = async raw => {
  const url = directUrl(raw);
  if (IMG_EXT.test(url) || /drive\.google\.com\/thumbnail|i\.imgur\.com/.test(url)) return { kind: 'image', url };
  if (VID_EXT.test(url) || /(youtu\.be|youtube\.com|vimeo\.com)/i.test(url)) return { kind: 'video', url };
  try {
    if (PRIVATE_HOST.test(new URL(url).hostname)) return { kind: 'link', url };
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: ctl.signal, redirect: 'follow' });
    clearTimeout(timer); r.body?.cancel?.();
    const type = r.headers.get('content-type') || '';
    if (/^image\//i.test(type)) return { kind: 'image', url };
    if (/^video\//i.test(type)) return { kind: 'video', url };
  } catch { /* not reachable: keep as a plain link */ }
  return { kind: 'link', url };
};

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

app.get('/api/trends', wrap(async (_, res) => res.json(await trendRows("status = 'active'"))));

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
    const start = r[1] ? +r[1] : Math.max(size - +r[2], 0), end = r[1] && r[2] ? Math.min(+r[2], size - 1) : size - 1;
    if (start > end || start >= size) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    return res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 }).end(f.data.subarray(start, end + 1));
  }
  res.set('Content-Length', size).end(f.data);
}));

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
  const resolved = await Promise.all(links.map(resolveLink));
  const id = await tx(async q => {
    const row = (await q('INSERT INTO trends(title, description, category, found_at, contact_phone, contact_email, posted_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [t.title, t.description, t.category, t.foundAt, t.phone, t.email, req.user.name]))[0];
    for (const f of files) await q('INSERT INTO trend_media(trend_id, kind, name, mime, data) VALUES($1,$2,$3,$4,$5)', [row.id, fileKind(f.mime), f.name, f.mime, f.buf]);
    for (const l of resolved) await q('INSERT INTO trend_media(trend_id, kind, url, name) VALUES($1,$2,$3,$4)', [row.id, l.kind, l.url, l.url.slice(0, 120)]);
    return row.id;
  });
  io.emit('trends:update'); res.json({ id });
}));

app.put('/api/trends/categories', comm, wrap(async (req, res) => {
  const list = cleanList(Array.isArray(req.body.list) ? req.body.list : []).slice(0, 40);
  if (!list.length) fail(400, 'Keep at least one category.');
  await saveOption(query, 'trendCategories', list);
  io.emit('trends:update');
  res.json({ list });
}));

app.put('/api/trends/:id', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id), t = trendFields(req.body);
  await query('UPDATE trends SET title = $1, description = $2, category = $3, found_at = $4, contact_phone = $5, contact_email = $6 WHERE id = $7',
    [t.title, t.description, t.category, t.foundAt, t.phone, t.email, cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.patch('/api/trends/:id/returned', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status !== 'active') fail(409, 'This post is not active.');
  await query("UPDATE trends SET status = 'returned', removed_at = now() WHERE id = $1", [cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.patch('/api/trends/:id/remove', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status !== 'active') fail(409, 'This post is already off the board.');
  const left = Math.ceil(HOLD_DAYS - (Date.now() - new Date(cur.posted_at).getTime()) / DAY);
  if (left > 0) fail(409, `A post can be removed ${HOLD_DAYS} days after it was posted. ${left} day${left === 1 ? '' : 's'} left.`);
  await query("UPDATE trends SET status = 'removed', removed_at = now() WHERE id = $1", [cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.patch('/api/trends/:id/repost', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status === 'active') fail(409, 'This post is already on the board.');
  await query("UPDATE trends SET status = 'active', posted_at = now(), removed_at = NULL, repost_count = repost_count + 1 WHERE id = $1", [cur.id]);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.delete('/api/trends/:id', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status === 'active') fail(409, 'Remove the post from the board first.');
  await query('DELETE FROM trends WHERE id = $1', [cur.id]);
  io.emit('trends:update'); res.sendStatus(204);
}));

app.use((err, _req, res, _next) => res.status(Number.isInteger(err.code) && err.code >= 400 && err.code < 600 ? err.code : (err.type === 'entity.too.large' ? 413 : 500)).json({
  error: err.type === 'entity.too.large' ? 'The files are too big. Use smaller photos or paste a link for videos.' : err.message || 'Something went wrong.',
}));

// ---------- Database set-up (safe to run on every start) ----------
const ensureTables = async () => {
  await query(`CREATE TABLE IF NOT EXISTS admin_profiles (
    email text PRIMARY KEY, picture text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '')`);

  await query(`CREATE TABLE IF NOT EXISTS trends (
    id serial PRIMARY KEY, title text NOT NULL, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT 'Other',
    found_at text NOT NULL DEFAULT '', contact_phone text NOT NULL DEFAULT '', contact_email text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','removed')), posted_by text NOT NULL DEFAULT '',
    posted_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz, repost_count integer NOT NULL DEFAULT 0)`);
  await query(`CREATE TABLE IF NOT EXISTS trend_media (
    id serial PRIMARY KEY, trend_id integer NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('image','video','file','link')), url text, name text NOT NULL DEFAULT '',
    mime text NOT NULL DEFAULT '', data bytea, created_at timestamptz NOT NULL DEFAULT now())`);
  await query('CREATE INDEX IF NOT EXISTS trends_status_posted_idx ON trends (status, posted_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS trend_media_trend_idx ON trend_media (trend_id)');

  await query(`CREATE TABLE IF NOT EXISTS student_groups (
    id serial PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`);
  await query('CREATE UNIQUE INDEX IF NOT EXISTS student_groups_name_idx ON student_groups (lower(name))');
  await query(`CREATE TABLE IF NOT EXISTS student_group_members (
    group_id integer NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id))`);
  await query('CREATE INDEX IF NOT EXISTS student_group_members_user_idx ON student_group_members (user_id)');

  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true');
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS places integer CHECK (places IS NULL OR places >= 1)');
  await query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS for_class text NOT NULL DEFAULT ''");
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS for_group integer REFERENCES student_groups(id) ON DELETE SET NULL');
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS exclusive boolean NOT NULL DEFAULT false');
  await query(`CREATE TABLE IF NOT EXISTS session_people (
    session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id))`);
  await query('CREATE INDEX IF NOT EXISTS session_people_user_idx ON session_people (user_id)');
  await query(`CREATE OR REPLACE VIEW session_places AS
    SELECT s.id, s.lab_id AS "labId", l.name AS lab,
      to_char(s.date, 'YYYY-MM-DD') AS date,
      to_char(s.starts_at, 'HH24:MI') AS "from", to_char(s.ends_at, 'HH24:MI') AS "to",
      LEAST(COALESCE(s.places, l.pcs), l.pcs) AS seats,
      GREATEST(LEAST(COALESCE(s.places, l.pcs), l.pcs) - COALESCE(a.n, 0), 0) AS "left",
      s.published,
      s.for_class AS "forClass", s.for_group AS "forGroup", g.name AS "forGroupName", s.exclusive AS exclusive,
      (SELECT COUNT(*)::int FROM session_people p WHERE p.session_id = s.id) AS "forPeople",
      (SELECT COALESCE(array_agg(u.username ORDER BY u.username), ARRAY[]::text[]) FROM session_people p JOIN users u ON u.id = p.user_id WHERE p.session_id = s.id) AS people
    FROM sessions s
    JOIN labs l ON l.id = s.lab_id
    LEFT JOIN student_groups g ON g.id = s.for_group
    LEFT JOIN (SELECT session_id, COUNT(*)::int AS n FROM applications WHERE status = 'approved' GROUP BY session_id) a ON a.session_id = s.id`);
};

const port = process.env.PORT || 4000;
query('SELECT 1').then(ensureTables).then(seedOptions).then(() => server.listen(port, () => console.log('LMS API and Socket.io running on port ' + port)))
  .catch(e => { console.error('Cannot start. Check the DB_* values in .env and that the database is set up.\n', e.message); process.exit(1); });