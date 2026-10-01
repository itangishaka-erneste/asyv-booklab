// server.js: Express API + Socket.io live updates. Data lives in PostgreSQL (db.js connects, database.sql creates the tables).
require('dotenv').config();
const express = require('express'), cors = require('cors'), http = require('http');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { query, one, tx } = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-me';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const LISTS = ['grades', 'classes', 'combos', 'clubs', 'staffRoles', 'families', 'reasons'];
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
const listApps = (where = '', params = []) => query('SELECT * FROM application_details' + (where ? ' WHERE ' + where : '') + ' ORDER BY at, id', params);
const seatsLeft = async (q, sid) => (await q('SELECT "left" FROM session_seats WHERE id = $1', [sid]))[0]?.left ?? 0;
const getApp = async (q, id) => (await q('SELECT * FROM applications WHERE id = $1', [id]))[0] || fail(404, 'Application not found.');
const getOptions = async () => Object.fromEntries((await query('SELECT key, value FROM options')).map(r => [r.key, r.value]));
const CLASS_SQL = "COALESCE(profile->>'grade', '') || COALESCE(profile->>'cls', '')";

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

// ---------- Accounts ----------
app.post('/api/register', wrap(async (req, res) => {
  const { username, email, password, role, ...profile } = req.body;
  if (!username?.trim() || !email?.includes('@') || !password || password.length < 6 || !['student', 'teacher', 'psychosocial'].includes(role))
    fail(400, 'Please fill in every field. Your password needs at least 6 characters.');
  if (await one('SELECT 1 FROM users WHERE lower(username) = lower($1) OR email = $2', [username.trim(), email.trim().toLowerCase()]))
    fail(409, 'An account with this name or email already exists.');
  const u = await one('INSERT INTO users(username, email, hash, role, profile) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [username.trim(), email.trim().toLowerCase(), await bcrypt.hash(password, 10), role, profile]);
  res.json({ token: sign({ id: u.id, role, name: username.trim() }) });
}));
app.post('/api/login', wrap(async (req, res) => {
  const login = (req.body.login || '').trim().toLowerCase();
  const u = await one('SELECT * FROM users WHERE lower(username) = $1 OR email = $1', [login]);
  if (!u || !(await bcrypt.compare(req.body.password || '', u.hash))) fail(401, 'Wrong username, email or password.');
  res.json({ token: sign({ id: u.id, role: u.role, name: u.username }) });
}));
app.post('/api/admin/google', wrap(async (req, res) => { // body: { credential } = Google ID token
  let p;
  try { p = (await gClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })).getPayload(); }
  catch { fail(401, 'Google sign-in failed. Please try again.'); }
  if (!p.email_verified || !ADMINS.includes(p.email.toLowerCase())) fail(403, 'This Google account is not an admin.');
  res.json({ token: sign({ id: 0, role: 'admin', name: p.name || p.email }) });
}));
app.get('/api/me', auth(), (req, res) => res.json(req.user));

// ---------- Options set by the admin (grades, classes, combinations, clubs, staff roles...) ----------
app.get('/api/options', wrap(async (_, res) => res.json(await getOptions())));
app.put('/api/options', auth('admin'), wrap(async (req, res) => {
  await tx(async q => {
    for (const [k, v] of Object.entries(req.body))
      if (LISTS.includes(k) && Array.isArray(v))
        await q('INSERT INTO options(key, value) VALUES($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify([...new Set(v.map(x => String(x).trim()).filter(Boolean))])]);
  });
  res.json(await getOptions());
}));

// Class lists for booking. Teachers must pick a class; psychosocial workers and admins can list everyone.
app.get('/api/students', auth('teacher', 'psychosocial', 'admin'), wrap(async (req, res) => {
  const cls = req.query.class || '';
  if (req.user.role === 'teacher' && !cls) fail(400, 'Choose a class first.');
  res.json(await query(`SELECT username AS name, ${CLASS_SQL} AS "className", profile->>'family' AS family, profile->>'combo' AS combo
    FROM users WHERE role = 'student' AND ($1 = '' OR ${CLASS_SQL} = $1) ORDER BY username`, [cls]));
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
app.post('/api/apply', auth('student', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const { sessionId, reason, students } = req.body;
  if (!(await one('SELECT 1 FROM sessions WHERE id = $1', [sessionId]))) fail(404, 'That lab time no longer exists.');
  const names = req.user.role === 'student' ? [req.user.name] : [...new Set(students || [])];
  if (!names.length) fail(400, 'Choose at least one student.');
  const banned = await query('SELECT name FROM blacklist WHERE name = ANY($1)', [names]);
  if (banned.length) fail(403, `Blacklisted students cannot apply: ${banned.map(b => b.name).join(', ')}`);
  const classes = Object.fromEntries((await query(`SELECT username, ${CLASS_SQL} AS cls FROM users WHERE role = 'student' AND username = ANY($1)`, [names])).map(r => [r.username, r.cls]));
  let created = 0;
  await tx(async q => {
    for (const n of names) // the unique index in database.sql skips students who already applied
      created += (await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT (session_id, student) WHERE status <> 'rejected' DO NOTHING RETURNING id",
        [sessionId, n, classes[n] || '', reason || 'Other', req.user.name])).length;
  });
  pushApps([...names, req.user.name]); res.json({ created });
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
  const name = (req.body.name || '').trim(); if (!name) fail(400, 'Enter a student name.');
  await tx(async q => {
    await q('INSERT INTO blacklist(name, reason) VALUES($1,$2) ON CONFLICT (name) DO UPDATE SET reason = EXCLUDED.reason', [name, req.body.reason || '']);
    await q("UPDATE applications SET status = 'rejected' WHERE student = $1 AND status = 'pending'", [name]);
  });
  pushApps([name]); res.json({ ok: true });
}));
app.delete('/api/blacklist/:name', auth('admin'), wrap(async (req, res) => { await query('DELETE FROM blacklist WHERE name = $1', [req.params.name]); res.sendStatus(204); }));

app.get('/api/stats/overview', auth('admin'), wrap(async (_, res) => {
  const [apps, sessions, labRows] = await Promise.all([listApps(), listSessions(), query('SELECT id, name, pcs FROM labs ORDER BY name')]);
  const by = k => apps.filter(a => a.status === k).length;
  const labs = labRows.map(l => {
    const ids = sessions.filter(s => s.labId === l.id).map(s => s.id), as = apps.filter(a => ids.includes(a.sid));
    const cap = l.pcs * ids.length, approved = as.filter(a => a.status === 'approved').length;
    return { lab: l.name, applied: as.length, approved, pending: as.filter(a => a.status === 'pending').length, rejected: as.filter(a => a.status === 'rejected').length, seatsOffered: cap, usagePct: cap ? Math.round(approved / cap * 100) : 0 };
  });
  const count = f => apps.reduce((m, a) => { const v = f(a); if (v) m[v] = (m[v] || 0) + 1; return m; }, {});
  const marked = apps.filter(a => a.att), present = marked.filter(a => a.att === 'present').length;
  res.json({ totals: { applications: apps.length, approved: by('approved'), pending: by('pending'), rejected: by('rejected') }, labs,
    mostRequested: [...labs].sort((a, b) => b.applied - a.applied)[0]?.lab || null, byReason: count(a => a.reason), byDay: count(a => a.date),
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
query('SELECT 1').then(() => server.listen(port, () => console.log('LMS API and Socket.io running on port ' + port)))
  .catch(e => { console.error('Cannot connect to PostgreSQL. Check DATABASE_URL in .env.\n', e.message); process.exit(1); });