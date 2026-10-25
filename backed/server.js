// server.js: Express API + Socket.io live updates. Data lives in PostgreSQL (db.js).
// Everyone signs in with Google. Admins get live presence, an activity log and a private admin chat.
//
// What is new in this version
//  - GET /api/roster: teachers, psychosocial workers and admins see every student of every lab time of a day in one call.
//  - Upload limit raised to 40 MB (24 MB of files becomes about 32 MB of base64), so lost-item photos are not rejected.
//  - Lunch periods, lab images, activity filters and bulk delete work as before.
require('dotenv').config();
const express = require('express'), cors = require('cors'), http = require('http');
const jwt = require('jsonwebtoken'), { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { query, one, tx } = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-me';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const TZ = process.env.LAB_TZ || 'Africa/Kigali';
const LISTS = ['grades', 'classes', 'combos', 'clubs', 'staffRoles', 'families', 'reasons'];
const ROLES = ['student', 'teacher', 'psychosocial'];
const ROLE_NAMES = { student: 'student', teacher: 'teacher', psychosocial: 'psychosocial worker' };
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const DEFAULT_GRADE_COMBOS = { S4: ['INGABE'], S5: ['INGABO'], S6: ['IJABO'] };
const DEFAULT_TREND_CATEGORIES = ['Clothes', 'Shoes', 'Keys', 'Bags', 'Phones and electronics', 'Books and stationery', 'Documents and IDs', 'Water bottles and lunch boxes', 'Jewelry and watches', 'Other'];
const DEFAULT_SETTINGS = {
  maxConsecutive: 1, graceMinutes: 15, autoRelease: true,
  beforeFrom: '08:00', beforeTo: '12:30', afterFrom: '13:30', afterTo: '17:00',
};
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+v) || 0));
const timeP = def => v => (/^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : def);
const SETTING_PARSERS = {
  maxConsecutive: v => clampInt(v, 0, 7),
  graceMinutes: v => clampInt(v, 0, 120),
  autoRelease: v => v === true || v === 'true',
  beforeFrom: timeP(DEFAULT_SETTINGS.beforeFrom), beforeTo: timeP(DEFAULT_SETTINGS.beforeTo),
  afterFrom: timeP(DEFAULT_SETTINGS.afterFrom), afterTo: timeP(DEFAULT_SETTINGS.afterTo),
};
const DEFAULTS = { grades: ['S4', 'S5', 'S6'], gradeCombos: DEFAULT_GRADE_COMBOS, trendCategories: DEFAULT_TREND_CATEGORIES, ...DEFAULT_SETTINGS };
const SECTION_RE = /^[A-Z0-9]{1,2}$/;
const combosFor = (opts, grade) => opts.gradeCombos?.[grade] ?? DEFAULT_GRADE_COMBOS[grade] ?? [];
const maxOf = o => (Number.isFinite(+o.maxConsecutive) && o.maxConsecutive !== null ? +o.maxConsecutive : DEFAULT_SETTINGS.maxConsecutive);
const graceOf = o => (Number.isFinite(+o.graceMinutes) && o.graceMinutes !== null ? +o.graceMinutes : DEFAULT_SETTINGS.graceMinutes);

const nameKey = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();
const cleanList = list => [...new Set(list.map(x => String(x).trim()).filter(Boolean))];
const validEmail = e => /^\S+@\S+\.\S+$/.test(e);
const toIds = v => (Array.isArray(v) ? v : []).map(Number).filter(Number.isInteger);

// Today and the time in the school's time zone, as 'YYYY-MM-DD' and 'HH:MM'.
const nowLocal = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const addDay = (s, n) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const HM = t => String(t || '').slice(0, 5);
const mins = t => { const [h, m] = HM(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const isOver = (s, now = nowLocal()) => s.date < now.date || (s.date === now.date && mins(s.to) <= mins(now.time));
const hasStarted = (s, now = nowLocal()) => s.date < now.date || (s.date === now.date && mins(s.from) <= mins(now.time));
const pad2 = n => String(n).padStart(2, '0');
const dayStr = d => (d instanceof Date ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : String(d ?? '').slice(0, 10));
// State of one lab time, shown on every screen: draft, over, full or open.
const stateOf = s => (!s.published ? 'draft' : isOver(s) ? 'over' : s.left < 1 ? 'full' : 'open');

const app = express(), server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT } });
app.use(cors({ origin: CLIENT }), express.json({ limit: '40mb' }));

const sign = p => jwt.sign(p, SECRET, { expiresIn: '7d' });
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Please sign in again.' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this.' });
  next();
};
// Minister of Communication: checked in the database on each request. The admin can always do it too.
const comm = [auth(), wrap(async (req, _res, next) => {
  if (req.user.role === 'admin') return next();
  const ok = req.user.id && await one("SELECT 1 AS ok FROM users WHERE id = $1 AND profile->>'comm' = 'true'", [req.user.id]);
  if (!ok) fail(403, 'Only the Minister of Communication can do this.');
  next();
})];

/* ---------- Activity log and live presence (admins) ---------- */

const logAct = async (user, action, detail = '') => {
  try {
    await query('INSERT INTO activity(actor, action, detail) VALUES($1,$2,$3)', [user?.name || 'System', action, String(detail).slice(0, 300)]);
    io.to('admins').emit('activity:update');
  } catch (e) { console.error('activity log:', e.message); }
};

// Remember every admin who signs in, so the admin chat can list them (even when they are offline).
const upsertAdmin = u => (u?.email
  ? query(`INSERT INTO admin_people(email, name, picture, last_seen) VALUES($1,$2,$3,now())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name,
        picture = CASE WHEN EXCLUDED.picture <> '' THEN EXCLUDED.picture ELSE admin_people.picture END, last_seen = now()`,
  [u.email, u.name || u.email, u.picture || '']).catch(e => console.error('admin_people:', e.message))
  : Promise.resolve());

// presence: socket id -> { name, email, page, since }. The client sends its page with the 'page' event.
const presence = new Map();
const presenceList = () => {
  const byEmail = new Map();
  presence.forEach(p => { const cur = byEmail.get(p.email); if (!cur || cur.since < p.since) byEmail.set(p.email, p); });
  return [...byEmail.values()];
};
const pushPresence = () => io.to('admins').emit('presence', presenceList());

/* ---------- Data helpers ---------- */

const CLASS_SQL = "COALESCE(NULLIF(profile->>'cls', ''), profile->>'grade', '')";
const ASSIGNED = 'Assigned by admin';
const forText = s => s.forGroupName || s.forClass || (s.forPeople ? `${s.forPeople} chosen student${s.forPeople === 1 ? '' : 's'}` : '');

const withPeople = async rows => {
  const m = new Map((await query("SELECT username, email, profile->>'picture' AS picture, md5(lower(email)) AS gid FROM users")).map(r => [r.username, r]));
  return rows.map(a => { const p = m.get(a.name); return { ...a, email: p?.email || '', picture: p?.picture || '', gid: p?.gid || '' }; });
};
const withExtras = async rows => {
  if (!rows.length) return rows;
  const ex = new Map((await query('SELECT id, late, note FROM applications WHERE id = ANY($1::int[])', [rows.map(r => r.id)])).map(r => [r.id, r]));
  return rows.map(a => { const x = ex.get(a.id); return { ...a, late: !!x?.late, note: x?.note || '', released: /^Released/.test(x?.note || '') }; });
};

const SESSION_ORDER = 'ORDER BY date, "from", lab';
// Admin: every lab time (drafts too, with the list of assigned people). Students: published lab times they may book. Others: published lab times.
const listSessions = async (all = false, user = null) => {
  let rows;
  if (all) rows = await query(`SELECT * FROM session_places ${SESSION_ORDER}`);
  else if (user?.role === 'student') {
    const me = await one(`SELECT id, ${CLASS_SQL} AS cls FROM users WHERE id = $1`, [user.id || 0]);
    rows = await query(`SELECT * FROM session_places sp WHERE published AND (
        NOT exclusive
        OR (sp."forClass" <> '' AND sp."forClass" = $2::text)
        OR (sp."forGroup" IS NOT NULL AND EXISTS (SELECT 1 FROM student_group_members gm WHERE gm.group_id = sp."forGroup" AND gm.user_id = $1::int))
        OR EXISTS (SELECT 1 FROM session_people p WHERE p.session_id = sp.id AND p.user_id = $1::int)
      ) ${SESSION_ORDER}`, [me?.id || 0, me?.cls || '']);
  } else rows = await query(`SELECT * FROM session_places WHERE published ${SESSION_ORDER}`);
  return rows.map(({ people, ...r }) => ({ ...r, state: stateOf(r), ...(all ? { people } : {}) }));
};
// Booking rows. date is always 'YYYY-MM-DD' and times 'HH:MM'.
const listApps = async (where = '', params = []) => {
  const rows = await withExtras(await withPeople(await query('SELECT * FROM application_details' + (where ? ' WHERE ' + where : '') + ' ORDER BY "at", id', params)));
  return rows.map(a => ({ ...a, date: dayStr(a.date), from: HM(a.from), to: HM(a.to) }));
};
const seatsLeft = async (q, sid) => (await q('SELECT "left" FROM session_places WHERE id = $1', [sid]))[0]?.left ?? 0;
const getApp = async (q, id) => (await q('SELECT * FROM applications WHERE id = $1', [id]))[0] || fail(404, 'Booking not found.');
const getOptions = async () => Object.fromEntries((await query('SELECT key, value FROM options')).map(r => [r.key, r.value]));
const saveOption = (q, k, value) => q('INSERT INTO options(key, value) VALUES($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify(value)]);

const seedOptions = async () => {
  const cur = await getOptions();
  for (const [k, v] of Object.entries(DEFAULTS)) {
    let missing;
    if (k === 'gradeCombos') missing = !cur[k] || Array.isArray(cur[k]);
    else if (k in SETTING_PARSERS) missing = cur[k] === undefined || cur[k] === null;
    else missing = !Array.isArray(cur[k]) || !cur[k].length;
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

/* ---------- Booking engine: waiting list, fair-use rule, late students ---------- */

const liveOn = (q, date) => q(`SELECT d.name, d.sid, d."from", d."to", d.status, sp."left" AS lft
  FROM application_details d JOIN session_places sp ON sp.id = d.sid
  WHERE d.status <> 'rejected' AND d.date = $1`, [date]);
const holds = (b, sid) => +b.sid === +sid || b.status === 'approved' || +b.lft > 0;
const overlaps = (b, s) => HM(b.from) < HM(s.to) && HM(s.from) < HM(b.to);

const dropQueueOverlap = async (q, name, sid) => {
  const s = (await q('SELECT date, "from", "to" FROM session_places WHERE id = $1', [sid]))[0];
  if (!s) return;
  await q(`DELETE FROM applications WHERE student = $1 AND status = 'pending' AND session_id <> $2
    AND session_id IN (SELECT id FROM session_places WHERE date = $3 AND "from" < $5 AND $4 < "to" AND "left" < 1)`, [name, sid, s.date, s.from, s.to]);
};

const tooManyInRow = async (q, name, date, sid, max) => {
  if (!(max >= 1)) return false;
  const rows = await q(`SELECT DISTINCT d.date::text AS day FROM application_details d JOIN session_places sp ON sp.id = d.sid
    WHERE lower(d.name) = lower($1) AND d.status IN ('approved', 'pending') AND NOT (d.status = 'pending' AND sp."left" < 1)
    AND d.sid <> $2::int AND d.date::text BETWEEN $3::text AND $4::text`, [name, sid, addDay(date, -max), addDay(date, max)]);
  const days = new Set(rows.map(r => String(r.day).slice(0, 10)));
  let run = 1;
  for (let i = 1; days.has(addDay(date, -i)); i++) run++;
  for (let i = 1; days.has(addDay(date, i)); i++) run++;
  return run > max;
};

const queueFor = async (q, s) => {
  const max = maxOf(await getOptions());
  const banned = new Set((await q('SELECT name FROM blacklist')).map(b => nameKey(b.name)));
  const live = await liveOn(q, s.date);
  const waiting = await q("SELECT id, student, booked_by FROM applications WHERE session_id = $1 AND status = 'pending' ORDER BY id", [s.id]);
  const out = [];
  for (const a of waiting) {
    const k = nameKey(a.student);
    if (banned.has(k)) continue;
    if (live.some(b => nameKey(b.name) === k && +b.sid !== +s.id && holds(b, s.id) && overlaps(b, s))) continue;
    if (a.booked_by !== ASSIGNED && await tooManyInRow(q, a.student, s.date, s.id, max)) continue;
    out.push(a);
  }
  return out;
};

// Free places go to the waiting list in order (instant-booking lab times only).
const promote = async (q, sid, touched = []) => {
  const s = (await q('SELECT id, date, "from", "to", "left", "autoApprove" FROM session_places WHERE id = $1', [sid]))[0];
  if (!s || !s.autoApprove || s.left < 1) return 0;
  let left = s.left, n = 0;
  for (const a of await queueFor(q, s)) {
    if (left < 1) break;
    await q("UPDATE applications SET status = 'approved', note = '' WHERE id = $1", [a.id]);
    await dropQueueOverlap(q, a.student, sid);
    left--; n++; touched.push(a.student, a.booked_by);
  }
  return n;
};

// The lab time is full, students are waiting, and some approved students did not arrive: release only what the queue needs.
const releaseNoShows = async (q, sid, touched = []) => {
  await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sid]);
  await promote(q, sid, touched);
  const s = (await q('SELECT id, date, "from", "to", "left" FROM session_places WHERE id = $1', [sid]))[0];
  if (!s) return { released: 0, promoted: 0 };
  const need = (await queueFor(q, s)).length - s.left;
  if (need < 1) return { released: 0, promoted: 0 };
  const cands = await q("SELECT id, student, booked_by FROM applications WHERE session_id = $1 AND status = 'approved' AND attendance IS NULL ORDER BY id DESC LIMIT $2", [sid, need]);
  if (!cands.length) return { released: 0, promoted: 0 };
  await q("UPDATE applications SET status = 'rejected', note = $2 WHERE id = ANY($1::int[])", [cands.map(c => c.id), 'Released: did not arrive in time']);
  cands.forEach(c => touched.push(c.student, c.booked_by));
  return { released: cands.length, promoted: await promote(q, sid, touched) };
};

/* ---------- Socket.io ---------- */

io.use((socket, next) => {
  const t = socket.handshake.auth?.token;
  if (!t) { socket.user = null; return next(); }
  try { socket.user = jwt.verify(t, SECRET); next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', socket => {
  if (!socket.user) { socket.join('public'); return; }
  socket.join('auth');
  if (socket.user.role === 'admin') {
    const me = socket.user;
    socket.join('admins');
    socket.join(`admin:${me.email}`);
    upsertAdmin(me);
    presence.set(socket.id, { name: me.name, email: me.email, picture: me.picture || '', page: 'Overview', since: Date.now() });
    pushPresence();
    socket.on('page', p => {
      const cur = presence.get(socket.id);
      if (!cur) return;
      cur.page = String(p || 'Overview').slice(0, 60);
      cur.since = Date.now();
      pushPresence();
    });
    // "is typing...": sent to the other admin, or to every other admin for the group chat.
    socket.on('chat:typing', to => {
      const payload = { from: me.email, name: me.name, to: to === 'all' ? 'all' : String(to || '').toLowerCase() };
      if (payload.to === 'all') socket.to('admins').emit('chat:typing', payload);
      else if (validEmail(payload.to)) io.to(`admin:${payload.to}`).emit('chat:typing', payload);
    });
    socket.on('disconnect', () => {
      presence.delete(socket.id);
      pushPresence();
      query('UPDATE admin_people SET last_seen = now() WHERE email = $1', [me.email]).catch(() => {});
    });
  } else socket.join(`user:${socket.user.name}`);
});
const pushSeats = () => { io.emit('overview:update'); io.to('auth').emit('seats'); };
const pushApps = (names = []) => {
  io.to('admins').emit('applications:update');
  [...new Set(names.filter(Boolean))].forEach(n => io.to(`user:${n}`).emit('applications:update'));
  pushSeats();
};

/* ---------- Sign in: Google only ---------- */

app.post('/api/google', wrap(async (req, res) => {
  let p;
  try { p = (await gClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })).getPayload(); }
  catch { fail(401, 'Google sign-in failed. Please try again.'); }
  if (!p.email_verified) fail(403, 'Your Google email is not verified.');
  const email = p.email.toLowerCase(), picture = p.picture || '';
  if (ADMINS.includes(email)) {
    const name = cleanName(p.name || email.split('@')[0]);
    await upsertAdmin({ email, name, picture });
    return res.json({ token: sign({ id: 0, role: 'admin', name, email, picture }) });
  }
  const u = await one('SELECT id, username, role FROM users WHERE lower(email) = $1', [email]);
  if (!u) fail(403, 'There is no account for this Google email. Ask your admin to add it.');
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
    stats = { total: rows.length, approved: n('approved'), pending: n('pending'), rejected: n('rejected'), present: rows.filter(a => a.att === 'present').length };
  }
  res.json({ ...info, stats });
}));

app.get('/api/me/memberships', auth('student', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const me = req.user.id ? await one(`SELECT ${CLASS_SQL} AS cls FROM users WHERE id = $1`, [req.user.id]) : null;
  const groups = req.user.id
    ? await query('SELECT g.id, g.name, g.description FROM student_groups g JOIN student_group_members m ON m.group_id = g.id WHERE m.user_id = $1 ORDER BY g.name', [req.user.id])
    : [];
  res.json({ cls: me?.cls || '', groups });
}));

/* ---------- Accounts (admin) ---------- */

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
  if (await nameTaken(name)) fail(409, 'Someone with this name already has an account. Add a middle name or number to tell them apart.');
  try {
    let row;
    try {
      row = await one('INSERT INTO users(username, email, role, profile) VALUES($1,$2,$3,$4) RETURNING id, username AS name, email, role', [name, email, role, profile]);
    } catch (e) {
      if (e.code !== '23502') throw e;
      row = await one("INSERT INTO users(username, email, hash, role, profile) VALUES($1,$2,'',$3,$4) RETURNING id, username AS name, email, role", [name, email, role, profile]);
    }
    await logAct(req.user, 'Added account', `${name} (${ROLE_NAMES[role]})`);
    res.json(row);
  } catch (e) { uniqueFail(e); }
}));

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
  await logAct(req.user, 'Edited account', newName || u.username);
  io.to(`user:${u.username}`).emit('me:update');
  if (newName) io.to(`user:${newName}`).emit('me:update');
  pushApps(newName ? [u.username, newName] : [u.username]);
  res.json({ ok: true });
}));

app.patch('/api/students/class', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one student.');
  const p = await studentProfile(req.body.grade, req.body.combo, req.body.section);
  await query("UPDATE users SET profile = profile || $2::jsonb WHERE role = 'student' AND id = ANY($1::int[])", [ids, JSON.stringify(p)]);
  await logAct(req.user, 'Moved students', `${ids.length} to ${p.cls}`);
  pushSeats();
  res.json({ updated: ids.length });
}));

app.patch('/api/users/:id/communication', auth('admin'), wrap(async (req, res) => {
  const u = await one('SELECT id, username FROM users WHERE id = $1', [req.params.id]) || fail(404, 'Account not found.');
  if (req.body.on) await query(`UPDATE users SET profile = profile || '{"comm":"true"}'::jsonb WHERE id = $1`, [u.id]);
  else await query("UPDATE users SET profile = profile - 'comm' WHERE id = $1", [u.id]);
  await logAct(req.user, req.body.on ? 'Made Minister of Communication' : 'Removed Minister', u.username);
  io.to(`user:${u.username}`).emit('me:update');
  res.json({ ok: true });
}));

// Deleting an account also removes its bookings. Places it held go to the waiting list.
const deleteUsers = async (user, ids) => {
  if (!ids.length) return 0;
  const { list, extra } = await tx(async q => {
    const list = (await q('SELECT username FROM users WHERE id = ANY($1::int[])', [ids])).map(r => r.username);
    const sids = (await q("SELECT DISTINCT session_id FROM applications WHERE student = ANY($1::text[]) AND status = 'approved'", [list])).map(r => r.session_id);
    await q('DELETE FROM applications WHERE student = ANY($1::text[])', [list]);
    await q('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
    const extra = [];
    for (const sid of sids) await promote(q, sid, extra);
    return { list, extra };
  });
  await logAct(user, 'Deleted accounts', `${list.length}`);
  pushApps([...list, ...extra]);
  return list.length;
};
app.post('/api/users/bulk-delete', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one account.');
  res.json({ deleted: await deleteUsers(req.user, ids) });
}));
app.delete('/api/users/:id', auth('admin'), wrap(async (req, res) => { await deleteUsers(req.user, toIds([req.params.id])); res.sendStatus(204); }));

/* ---------- Options ---------- */

app.get('/api/options', wrap(async (_, res) => res.json(await getOptions())));
app.put('/api/options', auth('admin'), wrap(async (req, res) => {
  const changed = [];
  await tx(async q => {
    for (const [k, v] of Object.entries(req.body)) {
      if (LISTS.includes(k) && Array.isArray(v)) { await saveOption(q, k, cleanList(v)); changed.push(k); }
      else if (k === 'gradeCombos' && v && typeof v === 'object' && !Array.isArray(v)) {
        await saveOption(q, k, Object.fromEntries(Object.entries(v).map(([g, list]) => [String(g).trim(), Array.isArray(list) ? cleanList(list) : []])));
        changed.push(k);
      }
      else if (k in SETTING_PARSERS) { await saveOption(q, k, SETTING_PARSERS[k](v)); changed.push(k); }
    }
  });
  if (changed.length) await logAct(req.user, 'Changed settings', changed.join(', '));
  pushSeats();
  res.json(await getOptions());
}));

app.get('/api/classes', auth('teacher', 'psychosocial', 'admin'), wrap(async (_, res) =>
  res.json((await query(`SELECT DISTINCT ${CLASS_SQL} AS cls FROM users WHERE role = 'student' AND ${CLASS_SQL} <> '' ORDER BY cls`)).map(r => r.cls))));

app.get('/api/students', auth('teacher', 'psychosocial', 'admin'), wrap(async (req, res) => {
  const cols = `username AS name, email, profile->>'picture' AS picture, md5(lower(email)) AS gid, ${CLASS_SQL} AS "className", profile->>'combo' AS combo`;
  const gid = Number(req.query.group) || 0;
  if (gid) return res.json(await query(`SELECT ${cols} FROM users WHERE role = 'student' AND id IN (SELECT user_id FROM student_group_members WHERE group_id = $1) ORDER BY username`, [gid]));
  const cls = req.query.class || '';
  if (req.user.role === 'teacher' && !cls) fail(400, 'Choose a class or a group first.');
  res.json(await query(`SELECT ${cols} FROM users WHERE role = 'student' AND ($1::text = '' OR ${CLASS_SQL} = $1::text) ORDER BY username`, [cls]));
}));

/* ---------- Student groups ---------- */

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
  await logAct(req.user, 'Created group', `${name} (${out.added} students)`);
  pushSeats();
  res.json({ ...out, notFound });
}));

app.put('/api/groups/:id', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  const name = await groupName(req.body.name ?? g.name, g.id);
  await query('UPDATE student_groups SET name = $1, description = $2 WHERE id = $3', [name, String(req.body.description ?? g.description ?? '').trim().slice(0, 300), g.id]);
  await logAct(req.user, 'Edited group', name);
  pushSeats();
  res.json({ ok: true });
}));

app.post('/api/groups/:id/members', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  const { ids, notFound } = await resolveStudents(splitTokens(req.body.members));
  const added = await tx(q => addMembers(q, g.id, ids));
  await logAct(req.user, 'Added to group', `${g.name}: ${added} students`);
  pushSeats();
  res.json({ added, notFound });
}));

app.delete('/api/groups/:id/members/:userId', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  await query('DELETE FROM student_group_members WHERE group_id = $1 AND user_id = $2', [g.id, +req.params.userId]);
  await logAct(req.user, 'Removed from group', g.name);
  pushSeats();
  res.sendStatus(204);
}));

app.delete('/api/groups/:id', auth('admin'), wrap(async (req, res) => {
  const g = await getGroup(req.params.id);
  await query('DELETE FROM student_groups WHERE id = $1', [g.id]);
  await logAct(req.user, 'Deleted group', g.name);
  pushSeats();
  res.sendStatus(204);
}));

/* ---------- Labs (with an image each) ---------- */

const labImage = v => {
  const u = directUrl(String(v || '').trim());
  if (u && !/^https?:\/\/\S+$/i.test(u)) fail(400, 'The lab image must be a link that starts with http:// or https://');
  return u.slice(0, 600);
};

app.get('/api/labs', auth(), wrap(async (_, res) => res.json(await query("SELECT id, name, pcs, COALESCE(image, '') AS image FROM labs ORDER BY name"))));
app.post('/api/labs', auth('admin'), wrap(async (req, res) => {
  const { name, pcs } = req.body;
  if (!name?.trim() || !(+pcs >= 1)) fail(400, 'Enter a lab name and at least one computer.');
  const image = labImage(req.body.image);
  try {
    const row = await one('INSERT INTO labs(name, pcs, image) VALUES($1,$2,$3) RETURNING id', [name.trim(), +pcs, image]);
    await logAct(req.user, 'Added lab', `${name.trim()} (${+pcs} computers)`);
    pushSeats();
    res.json(row);
  } catch (e) { fail(e.code === '23505' ? 409 : 500, e.code === '23505' ? 'A lab with this name already exists.' : e.message); }
}));
app.put('/api/labs/:id', auth('admin'), wrap(async (req, res) => {
  const { pcs } = req.body;
  const name = req.body.name == null ? null : String(req.body.name).trim();
  const image = req.body.image === undefined ? null : labImage(req.body.image);
  if (name !== null && !name) fail(400, 'The lab name cannot be empty.');
  if (pcs != null && !(+pcs >= 1)) fail(400, 'A lab needs at least one computer.');
  if (pcs != null && (await listSessions(true)).some(s => s.labId == req.params.id && s.seats - s.left > +pcs)) fail(409, 'More students are approved than this many computers.');
  try {
    await tx(async q => {
      await q('UPDATE labs SET name = COALESCE($1, name), pcs = COALESCE($2, pcs), image = COALESCE($4, image) WHERE id = $3', [name, pcs ?? null, req.params.id, image]);
      if (pcs != null) await q('UPDATE sessions SET places = LEAST(places, $1::int) WHERE lab_id = $2 AND places IS NOT NULL', [+pcs, req.params.id]);
    });
  } catch (e) { if (e.code === '23505') fail(409, 'A lab with this name already exists.'); throw e; }
  await logAct(req.user, 'Edited lab', name || `lab ${req.params.id}`);
  pushSeats(); res.json({ ok: true });
}));
app.delete('/api/labs/:id', auth('admin'), wrap(async (req, res) => {
  await query('DELETE FROM labs WHERE id = $1', [req.params.id]);
  await logAct(req.user, 'Deleted lab', `lab ${req.params.id}`);
  pushApps(); res.sendStatus(204);
}));

/* ---------- Who a lab time is for ---------- */

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

// Books the assigned students. Removes automatic bookings of people no longer assigned.
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
  const live = await liveOn(q, s.d);
  let left = await seatsLeft(q, sid);
  for (const m of members) {
    const k = nameKey(m.username);
    if (banned.has(k)) continue;
    const clash = live.some(b => nameKey(b.name) === k && holds(b, sid) && (+b.sid === +sid || overlaps(b, s)));
    if (clash) continue;
    const status = left > 0 ? 'approved' : 'pending';
    const made = await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by, status) VALUES($1,$2,$3,'Assigned',$4,$5) ON CONFLICT (session_id, student) WHERE status <> 'rejected' DO NOTHING RETURNING id",
      [sid, m.username, m.cls || '', ASSIGNED, status]);
    if (made.length && status === 'approved') { left--; await dropQueueOverlap(q, m.username, sid); }
  }
  return touched;
};

/* ---------- Lab times ---------- */

app.get('/api/sessions', auth(), wrap(async (req, res) => res.json(await listSessions(req.user.role === 'admin', req.user))));

// Create lab times. "slots" = [{from,to}, ...] (for example before lunch and after lunch). "labIds" = one lab, two or three labs, or all.
app.post('/api/sessions', auth('admin'), wrap(async (req, res) => {
  const { date = nowLocal().date, labIds } = req.body;
  const slots = (Array.isArray(req.body.slots) && req.body.slots.length ? req.body.slots : [{ from: req.body.from, to: req.body.to }])
    .map(s => ({ from: HM(s.from), to: HM(s.to) }));
  slots.forEach(s => { if (!s.from || !s.to || s.from >= s.to) fail(400, 'The start time must be before the end time.'); });
  const published = req.body.published === true;
  const autoApprove = req.body.autoApprove !== false;
  const wanted = req.body.places === undefined || req.body.places === null || req.body.places === '' ? null : Math.floor(+req.body.places);
  if (wanted !== null && !(wanted >= 1)) fail(400, 'Places open must be 1 or more.');
  const ids = toIds(labIds);
  const labs = (await query('SELECT id, name, pcs FROM labs')).filter(l => !ids.length || ids.includes(l.id));
  if (!labs.length) fail(400, 'Choose a lab first.');
  if (wanted !== null && labs.length === 1 && wanted > labs[0].pcs) fail(400, `This lab has only ${labs[0].pcs} computers.`);
  const aud = await parseAudience(req.body.audience);
  if (aud.kind && labs.length > 1) fail(400, 'Choose one lab when you assign a class, a group or people.');
  const touched = [];
  await tx(async q => {
    for (const l of labs) for (const sl of slots) {
      const row = (await q('INSERT INTO sessions(lab_id, date, starts_at, ends_at, places, published, for_class, for_group, exclusive, auto_approve) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [l.id, date, sl.from, sl.to, wanted === null ? null : Math.min(wanted, l.pcs), published, aud.forClass, aud.forGroup, aud.exclusive, autoApprove]))[0];
      await setPeople(q, row.id, aud.ids);
      if (aud.kind) touched.push(...await syncAssigned(q, row.id));
    }
  });
  const who = aud.kind ? (aud.kind === 'class' ? ` · for class ${aud.forClass}` : aud.kind === 'group' ? ' · for a group' : ` · for ${aud.ids.length} students`) : '';
  const labText = labs.length === 1 ? labs[0].name : `${labs.length} labs`;
  await logAct(req.user, published ? 'Published lab time' : 'Saved lab time draft', `${labText} · ${date} ${slots.map(s => `${s.from}–${s.to}`).join(' + ')}${who}`);
  pushApps(touched);
  res.json({ created: labs.length * slots.length, published, assigned: touched.length, notFound: aud.notFound });
}));

app.put('/api/sessions/:id', auth('admin'), wrap(async (req, res) => {
  const { date, from, to } = req.body;
  const s = await one('SELECT id, seats, "left", "labId", "from", "to", lab FROM session_places WHERE id = $1', [req.params.id]) || fail(404, 'That lab time does not exist.');
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
  const auto = typeof req.body.autoApprove === 'boolean' ? req.body.autoApprove : null;
  const aud = req.body.audience !== undefined ? await parseAudience(req.body.audience) : null;
  const touched = [];
  await tx(async q => {
    await q('UPDATE sessions SET date = COALESCE($1::date, date), starts_at = COALESCE($2::time, starts_at), ends_at = COALESCE($3::time, ends_at), places = CASE WHEN $6::boolean THEN NULL ELSE COALESCE($4::int, places) END, auto_approve = COALESCE($7::boolean, auto_approve) WHERE id = $5',
      [date ?? null, from ?? null, to ?? null, places, s.id, clearPlaces, auto]);
    if (aud) {
      await q('UPDATE sessions SET for_class = $1, for_group = $2, exclusive = $3 WHERE id = $4', [aud.forClass, aud.forGroup, aud.exclusive, s.id]);
      await setPeople(q, s.id, aud.ids);
      touched.push(...await syncAssigned(q, s.id));
    }
    await promote(q, s.id, touched);
  });
  await logAct(req.user, 'Edited lab time', `${s.lab} · ${s.from}–${s.to}`);
  pushApps(touched);
  res.json({ ok: true, assigned: touched.length, notFound: aud?.notFound || [] });
}));

app.patch('/api/sessions/:id/publish', auth('admin'), wrap(async (req, res) => {
  const r = await query('UPDATE sessions SET published = $1 WHERE id = $2 RETURNING id', [req.body.published === true, req.params.id]);
  if (!r.length) fail(404, 'That lab time does not exist.');
  await logAct(req.user, req.body.published ? 'Published lab time' : 'Hid lab time', `#${req.params.id}`);
  pushApps(); res.json({ ok: true });
}));
// Publish chosen drafts (ids) or every draft (no ids).
app.post('/api/sessions/publish-all', auth('admin'), wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
  const r = await query('UPDATE sessions SET published = true WHERE published = false AND ($1::int[] IS NULL OR id = ANY($1::int[])) RETURNING id', [ids]);
  await logAct(req.user, 'Published lab times', `${r.length}`);
  pushApps(); res.json({ published: r.length });
}));
// Hide chosen lab times (back to draft).
app.post('/api/sessions/hide-many', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one lab time.');
  const r = await query('UPDATE sessions SET published = false WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  await logAct(req.user, 'Hid lab times', `${r.length}`);
  pushApps(); res.json({ hidden: r.length });
}));
app.post('/api/sessions/bulk-delete', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one lab time.');
  const r = await query('DELETE FROM sessions WHERE id = ANY($1::int[]) RETURNING id', [ids]);
  await logAct(req.user, 'Removed lab times', `${r.length}`);
  pushApps(); res.json({ deleted: r.length });
}));
app.delete('/api/sessions/:id', auth('admin'), wrap(async (req, res) => {
  await query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
  await logAct(req.user, 'Removed lab time', `#${req.params.id}`);
  pushApps(); res.sendStatus(204);
}));

// The admin gives the places of students who did not arrive to the waiting list (only as many as needed).
app.post('/api/sessions/:id/release-noshows', auth('admin'), wrap(async (req, res) => {
  const sid = +req.params.id;
  const s = await one('SELECT date, "from", "to" FROM session_places WHERE id = $1', [sid]) || fail(404, 'That lab time does not exist.');
  if (!hasStarted(s)) fail(409, 'This lab time has not started yet.');
  const touched = [];
  const r = await tx(q => releaseNoShows(q, sid, touched));
  if (r.released) await logAct(req.user, 'Released no-shows', `${r.released} place(s)`);
  pushApps(touched);
  res.json(r);
}));

// A student who came without a booking: the admin seats them if a place is free.
app.post('/api/sessions/:id/walkin', auth('admin'), wrap(async (req, res) => {
  const sid = +req.params.id;
  const { ids, notFound } = await resolveStudents(splitTokens(req.body.students));
  if (!ids.length) fail(400, 'Choose at least one student from the list.');
  const studs = await query(`SELECT id, username, ${CLASS_SQL} AS cls FROM users WHERE id = ANY($1::int[]) ORDER BY username`, [ids]);
  let added = 0; const skipped = [], touched = [];
  await tx(async q => {
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sid]);
    const s = (await q('SELECT date, "from", "to" FROM session_places WHERE id = $1', [sid]))[0] || fail(404, 'That lab time does not exist.');
    const late = hasStarted(s);
    const banned = new Set((await q('SELECT name FROM blacklist')).map(b => nameKey(b.name)));
    let left = await seatsLeft(q, sid);
    for (const st of studs) {
      if (banned.has(nameKey(st.username))) { skipped.push(`${st.username} (blocked)`); continue; }
      const ex = (await q("SELECT id, status FROM applications WHERE session_id = $1 AND student = $2 AND status <> 'rejected'", [sid, st.username]))[0];
      if (ex?.status === 'approved') { skipped.push(`${st.username} (already booked)`); continue; }
      if (left < 1) { skipped.push(`${st.username} (no free place)`); continue; }
      if (ex) await q("UPDATE applications SET status = 'approved', note = '', attendance = 'present', late = $2 WHERE id = $1", [ex.id, late]);
      else await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by, status, attendance, late) VALUES($1,$2,$3,'Walk-in','Walk-in (admin)','approved','present',$4)", [sid, st.username, st.cls || '', late]);
      await dropQueueOverlap(q, st.username, sid);
      left--; added++; touched.push(st.username);
    }
  });
  if (added) await logAct(req.user, 'Seated walk-ins', `${added} student(s)`);
  pushApps(touched);
  res.json({ added, skipped, notFound });
}));

/* ---------- Public overview (no login, counts only, never names) ---------- */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
app.get('/api/overview', wrap(async (req, res) => {
  const date = ISO_DAY.test(String(req.query.date || '')) ? String(req.query.date) : nowLocal().date;
  const [labRows, sessions, pend] = await Promise.all([
    query("SELECT id, name, pcs, COALESCE(image, '') AS image FROM labs ORDER BY name"),
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
        return { id: s.id, from: HM(s.from), to: HM(s.to), seats: s.seats, left: s.left, taken, waiting, over: p - waiting, open: Math.max(s.left - waiting, 0), for: forText(s), exclusive: !!s.exclusive, auto: s.autoApprove !== false, state: s.state };
      })
      .sort((a, b) => a.from.localeCompare(b.from));
    const sum = k => list.reduce((n, s) => n + s[k], 0);
    const seats = sum('seats'), left = sum('left'), free = sum('open');
    const status = !list.length ? 'none' : left === 0 ? 'full' : free === 0 ? 'requested' : free / seats <= 0.3 ? 'limited' : 'available';
    return { id: l.id, name: l.name, pcs: l.pcs, image: l.image, status, seats, free, taken: sum('taken'), waiting: sum('waiting'), sessions: list };
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

/* ---------- Roster for staff: every published lab time of a day with all its students, in one call ---------- */

app.get('/api/roster', auth('teacher', 'psychosocial', 'admin'), wrap(async (req, res) => {
  const date = ISO_DAY.test(String(req.query.date || '')) ? String(req.query.date) : nowLocal().date;
  const [sessions, apps] = await Promise.all([
    listSessions(),
    listApps('date = $1 AND sid IN (SELECT id FROM session_places WHERE published)', [date]),
  ]);
  const by = new Map();
  apps.filter(a => a.status !== 'rejected').forEach(a => {
    if (!by.has(a.sid)) by.set(a.sid, []);
    by.get(a.sid).push({ id: a.id, name: a.name, cls: a.cls || '', picture: a.picture, gid: a.gid, status: a.status, att: a.att || null, late: !!a.late, reason: a.reason || '' });
  });
  res.json({
    date,
    sessions: sessions.filter(s => String(s.date).slice(0, 10) === date)
      .sort((a, b) => `${a.from} ${a.lab}`.localeCompare(`${b.from} ${b.lab}`))
      .map(s => ({ id: s.id, labId: s.labId, lab: s.lab, from: HM(s.from), to: HM(s.to), seats: s.seats, left: s.left, state: s.state, for: forText(s), exclusive: !!s.exclusive, people: by.get(s.id) || [] })),
  });
}));

/* ---------- Admin board: each lab, its PUBLISHED lab times and the students in them ---------- */

app.get('/api/board', auth('admin'), wrap(async (req, res) => {
  const date = ISO_DAY.test(String(req.query.date || '')) ? String(req.query.date) : nowLocal().date;
  const [labs, sessions, apps] = await Promise.all([
    query("SELECT id, name, pcs, COALESCE(image, '') AS image FROM labs ORDER BY name"),
    listSessions(true),
    listApps('date = $1', [date]),
  ]);
  const day = sessions.filter(s => s.date === date && s.published).sort((a, b) => `${a.from} ${a.lab}`.localeCompare(`${b.from} ${b.lab}`));
  const people = new Map();
  apps.forEach(a => { if (!people.has(a.sid)) people.set(a.sid, []); people.get(a.sid).push(a); });
  res.json({
    date,
    labs: labs.map(l => ({
      id: l.id, name: l.name, pcs: l.pcs, image: l.image,
      sessions: day.filter(s => s.labId == l.id).map(s => ({
        id: s.id, from: s.from, to: s.to, date: s.date, lab: s.lab, seats: s.seats, left: s.left, published: s.published,
        state: s.state, autoApprove: s.autoApprove !== false, forClass: s.forClass, forGroup: s.forGroup,
        forGroupName: s.forGroupName, forPeople: s.forPeople, exclusive: !!s.exclusive,
        people: people.get(s.id) || [],
      })),
    })),
  });
}));

/* ---------- Activity log (admins), filtered by day, number of days or admin ---------- */

app.get('/api/activity', auth('admin'), wrap(async (req, res) => {
  const where = [], p = [];
  if (ISO_DAY.test(String(req.query.date || ''))) {
    p.push(TZ, String(req.query.date));
    where.push(`(created_at AT TIME ZONE $1::text)::date = $2::date`);
  } else if (+req.query.days > 0) {
    p.push(Math.min(+req.query.days, 90));
    where.push(`created_at >= now() - ($${p.length}::int * interval '1 day')`);
  }
  if (req.query.actor) { p.push(String(req.query.actor)); where.push(`actor = $${p.length}`); }
  res.json(await query(`SELECT id, actor, action, detail, created_at AS at FROM activity ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`, p));
}));

app.get('/api/activity/chart', auth('admin'), wrap(async (req, res) => {
  const days = Math.min(Math.max(+req.query.days || 7, 1), 60);
  res.json(await query(`SELECT actor, to_char((created_at AT TIME ZONE $2::text)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
    FROM activity WHERE created_at >= (now() - ($1::int * interval '1 day'))
    GROUP BY actor, day ORDER BY day`, [days, TZ]));
}));

/* ---------- Admin chat ---------- */
// Rooms: 'all' = every admin. A private chat between two admins has the room 'dm:<email>|<email>' (emails sorted).
// The screen only knows the "other side": 'all' or the other admin's email.

const dmRoom = (a, b) => 'dm:' + [a, b].sort().join('|');
const chatWith = v => { const w = String(v || 'all').trim().toLowerCase(); return w === 'all' || validEmail(w) ? w : fail(400, 'Unknown chat.'); };
const roomOf = (me, w) => (w === 'all' ? 'all' : dmRoom(me, w));

// All admins: the ones in ADMIN_EMAILS plus everyone who ever signed in as admin.
const adminDirectory = async () => {
  const rows = await query(`SELECT p.email, p.name, COALESCE(NULLIF(a.picture, ''), p.picture) AS picture, p.last_seen AS "lastSeen"
    FROM admin_people p LEFT JOIN admin_profiles a ON a.email = p.email`);
  const map = new Map(rows.map(r => [r.email, r]));
  ADMINS.forEach(e => { if (!map.has(e)) map.set(e, { email: e, name: e.split('@')[0], picture: '', lastSeen: null }); });
  return [...map.values()];
};

// People, last message and unread count of every chat, in one call. "me" carries your own picture for the chat screen.
app.get('/api/chat/summary', auth('admin'), wrap(async (req, res) => {
  const me = req.user.email;
  const on = new Set(presenceList().map(p => p.email));
  const dir = await adminDirectory();
  const people = dir.filter(p => p.email !== me)
    .map(p => ({ ...p, online: on.has(p.email) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const unreadRows = await query(`SELECT CASE WHEN m.room = 'all' THEN 'all' ELSE m.from_email END AS key, COUNT(*)::int AS n
    FROM admin_chat m LEFT JOIN admin_chat_reads r ON r.email = $1 AND r.room = m.room
    WHERE m.id > COALESCE(r.last_id, 0) AND m.from_email <> $1 AND (m.room = 'all' OR m.to_email = $1)
    GROUP BY 1`, [me]);
  const lastRows = await query(`SELECT DISTINCT ON (room) room, to_email AS "to", from_email AS "fromEmail", from_name AS "fromName", body, created_at AS at
    FROM admin_chat WHERE room = 'all' OR from_email = $1 OR to_email = $1 ORDER BY room, id DESC`, [me]);
  const last = {};
  lastRows.forEach(m => { last[m.room === 'all' ? 'all' : (m.fromEmail === me ? m.to : m.fromEmail)] = { body: m.body, at: m.at, fromMe: m.fromEmail === me, fromName: m.fromName }; });
  const mine = dir.find(p => p.email === me);
  res.json({ me, myPicture: mine?.picture || req.user.picture || '', people, unread: Object.fromEntries(unreadRows.map(r => [r.key, r.n])), last });
}));

app.get('/api/chat/messages', auth('admin'), wrap(async (req, res) => {
  const me = req.user.email, w = chatWith(req.query.with), before = Math.max(+req.query.before || 0, 0);
  const rows = await query(`SELECT id, from_email AS "fromEmail", from_name AS "fromName", to_email AS "to", body, created_at AS at
    FROM admin_chat WHERE room = $1 AND ($2::int = 0 OR id < $2::int) ORDER BY id DESC LIMIT 80`, [roomOf(me, w), before]);
  res.json(rows.reverse());
}));

app.post('/api/chat/messages', auth('admin'), wrap(async (req, res) => {
  const me = req.user, w = chatWith(req.body.with);
  const body = String(req.body.body || '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
  if (!body) fail(400, 'Write a message first.');
  if (w === me.email) fail(400, 'You cannot write to yourself.');
  const room = roomOf(me.email, w);
  const row = await one(`INSERT INTO admin_chat(room, from_email, from_name, to_email, body) VALUES($1,$2,$3,$4,$5)
    RETURNING id, from_email AS "fromEmail", from_name AS "fromName", to_email AS "to", body, created_at AS at`, [room, me.email, me.name, w, body]);
  await query(`INSERT INTO admin_chat_reads(email, room, last_id) VALUES($1,$2,$3)
    ON CONFLICT (email, room) DO UPDATE SET last_id = GREATEST(admin_chat_reads.last_id, EXCLUDED.last_id)`, [me.email, room, row.id]);
  if (w === 'all') io.to('admins').emit('chat:message', row);
  else io.to(`admin:${w}`).to(`admin:${me.email}`).emit('chat:message', row);
  res.json(row);
}));

app.post('/api/chat/read', auth('admin'), wrap(async (req, res) => {
  const me = req.user.email, room = roomOf(me, chatWith(req.body.with));
  await query(`INSERT INTO admin_chat_reads(email, room, last_id)
    VALUES($1, $2, COALESCE((SELECT MAX(id) FROM admin_chat WHERE room = $2), 0))
    ON CONFLICT (email, room) DO UPDATE SET last_id = GREATEST(admin_chat_reads.last_id, EXCLUDED.last_id)`, [me, room]);
  res.json({ ok: true });
}));

/* ---------- Bookings ---------- */

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

  const max = maxOf(await getOptions());
  let created = 0, approved = 0; const skipped = [], tooMany = [], moved = [];
  await tx(async q => {
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [sessionId]);
    const s = (await q('SELECT date, "from", "to", published, "autoApprove" FROM session_places WHERE id = $1', [sessionId]))[0];
    if (!s || !s.published) fail(404, 'That lab time is not open for booking.');
    if (isOver(s)) fail(409, 'This lab time is already over.');
    const raw = (await q('SELECT id, exclusive, for_class, for_group FROM sessions WHERE id = $1', [sessionId]))[0];
    if (raw?.exclusive) {
      const allowed = new Set((await membersOf(q, raw)).map(m => nameKey(m.username)));
      const out = names.filter(n => !allowed.has(nameKey(n)));
      if (out.length) fail(403, req.user.role === 'student'
        ? 'This lab time is only for the people the admin chose.'
        : `This lab time is only for the people the admin chose. Not allowed: ${out.join(', ')}.`);
    }
    await promote(q, sessionId, moved);
    let left = await seatsLeft(q, sessionId);
    const live = await liveOn(q, s.date);
    for (const n of names) {
      const k = nameKey(n);
      const clash = live.some(b => nameKey(b.name) === k && holds(b, sessionId) && (+b.sid === sessionId || overlaps(b, s)));
      if (clash) { skipped.push(n); continue; }
      if (await tooManyInRow(q, n, s.date, sessionId, max)) { tooMany.push(n); continue; }
      const status = s.autoApprove && left > 0 ? 'approved' : 'pending';
      const made = await q("INSERT INTO applications(session_id, student, class_name, reason, booked_by, status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (session_id, student) WHERE status <> 'rejected' DO NOTHING RETURNING id",
        [sessionId, n, classes[n] || '', reason || 'Other', req.user.name, status]);
      if (!made.length) continue;
      created++;
      if (status === 'approved') { approved++; left--; await dropQueueOverlap(q, n, sessionId); }
    }
  });
  pushApps([...names, req.user.name, ...moved]);
  res.json({ created, approved, queued: created - approved, skipped, tooMany, maxConsecutive: max });
}));

app.get('/api/apps', auth(), wrap(async (req, res) => res.json(req.user.role === 'admin'
  ? await listApps()
  : await listApps('(name = $1 OR "bookedBy" = $1) AND sid IN (SELECT id FROM session_places WHERE published)', [req.user.name]))));

// "I am here": the student confirms their own arrival, 15 minutes before the start until the end.
app.post('/api/apps/:id/checkin', auth('student', 'teacher', 'psychosocial'), wrap(async (req, res) => {
  const a = await getApp(query, req.params.id);
  if (a.student !== req.user.name) fail(403, 'You can only check in yourself.');
  if (a.status !== 'approved') fail(409, /^Released/.test(a.note || '')
    ? 'Your place was given to the waiting list because you did not arrive in time. Apply again: if a place is free you get it at once.'
    : 'Only approved bookings can check in.');
  const s = (await query('SELECT date, "from", "to" FROM session_places WHERE id = $1', [a.session_id]))[0] || fail(404, 'That lab time does not exist.');
  const now = nowLocal(), grace = graceOf(await getOptions()), m = mins(now.time);
  if (s.date !== now.date) fail(409, 'You can check in on the day of your lab time.');
  if (m < mins(s.from) - 15) fail(409, `Check-in opens 15 minutes before the start (${s.from}).`);
  if (m >= mins(s.to)) fail(409, 'This lab time is over.');
  const late = m > mins(s.from) + grace;
  await query("UPDATE applications SET attendance = 'present', late = $2, checked_in_at = now() WHERE id = $1", [a.id, late]);
  pushApps([a.student]); res.json({ ok: true, late });
}));

app.patch('/api/apps/:id/status', auth('admin'), wrap(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) fail(400, 'Unknown status.');
  const extra = [];
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [a.session_id]);
    if (status === 'approved' && a.status !== 'approved' && await seatsLeft(q, a.session_id) < 1) fail(409, 'No places left in this lab time.');
    await q("UPDATE applications SET status = $1::text, note = CASE WHEN $1::text = 'rejected' THEN note ELSE '' END WHERE id = $2", [status, a.id]);
    if (status === 'approved') await dropQueueOverlap(q, a.student, a.session_id);
    else if (a.status === 'approved') await promote(q, a.session_id, extra);
    return a;
  });
  await logAct(req.user, status === 'approved' ? 'Approved booking' : status === 'rejected' ? 'Rejected booking' : 'Set booking to waiting', a.student);
  pushApps([a.student, a.booked_by, ...extra]); res.json({ ok: true });
}));

app.patch('/api/apps/:id/release', auth('admin'), wrap(async (req, res) => {
  const extra = [];
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [a.session_id]);
    if (a.status !== 'approved') fail(409, 'Only an approved booking can be released.');
    await q("UPDATE applications SET status = 'rejected', note = $2, attendance = NULL, late = false WHERE id = $1", [a.id, 'Released: did not arrive in time']);
    await promote(q, a.session_id, extra);
    return a;
  });
  await logAct(req.user, 'Released place', a.student);
  pushApps([a.student, a.booked_by, ...extra]); res.json({ ok: true });
}));

app.patch('/api/apps/:id/move', auth('admin'), wrap(async (req, res) => {
  const to = +req.body.sessionId;
  const extra = [];
  const a = await tx(async q => {
    const a = await getApp(q, req.params.id);
    await q('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [to]);
    if (a.status !== 'rejected') {
      const twice = await q("SELECT 1 FROM applications WHERE session_id = $1 AND lower(student) = lower($2) AND status <> 'rejected' AND id <> $3", [to, a.student, a.id]);
      if (twice.length) fail(409, 'This student already has a booking in that lab time.');
    }
    if (a.status === 'approved' && a.session_id !== to && await seatsLeft(q, to) < 1) fail(409, 'The other lab time is full.');
    await q('UPDATE applications SET session_id = $1 WHERE id = $2', [to, a.id]);
    if (a.status === 'approved' && a.session_id !== to) {
      await dropQueueOverlap(q, a.student, to);
      await promote(q, a.session_id, extra);
    }
    return a;
  });
  await logAct(req.user, 'Moved booking', a.student);
  pushApps([a.student, a.booked_by, ...extra]); res.json({ ok: true });
}));

// att: 'present', 'late' (counts as present), 'absent' or null (clear).
app.patch('/api/apps/:id/attendance', auth('admin'), wrap(async (req, res) => {
  const att = req.body.att ?? null;
  if (![null, 'present', 'absent', 'late'].includes(att)) fail(400, 'Use present, late or absent.');
  const a = await getApp(query, req.params.id);
  await query('UPDATE applications SET attendance = $1, late = $2 WHERE id = $3', [att === 'late' ? 'present' : att, att === 'late', a.id]);
  await logAct(req.user, 'Marked attendance', `${a.student}: ${att || 'cleared'}`);
  pushApps([a.student]); res.json({ ok: true });
}));

// Many bookings at once. Places that become free go to the waiting list.
app.post('/api/apps/bulk', auth('admin'), wrap(async (req, res) => {
  const ids = toIds(req.body.ids), action = req.body.action;
  if (!ids.length) fail(400, 'Choose at least one booking.');
  if (!['approve', 'reject', 'pending', 'present', 'late', 'absent', 'clear', 'delete'].includes(action)) fail(400, 'Unknown action.');
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
        await q("UPDATE applications SET status = 'approved', note = '' WHERE id = $1", [r.id]);
        await dropQueueOverlap(q, r.student, r.session_id);
        done++;
      }
    } else if (action === 'reject' || action === 'pending') {
      done = (await q('UPDATE applications SET status = $2 WHERE id = ANY($1::int[]) RETURNING id', [ids, action === 'reject' ? 'rejected' : 'pending'])).length;
    } else if (action === 'delete') {
      done = (await q('DELETE FROM applications WHERE id = ANY($1::int[]) RETURNING id', [ids])).length;
    } else {
      const att = action === 'clear' ? null : action === 'late' ? 'present' : action;
      done = (await q("UPDATE applications SET attendance = $2, late = $3 WHERE id = ANY($1::int[]) AND status = 'approved' RETURNING id", [ids, att, action === 'late'])).length;
    }
    if (['reject', 'pending', 'delete'].includes(action)) {
      for (const sid of new Set(rows.filter(r => r.status === 'approved').map(r => r.session_id))) await promote(q, sid, names);
    }
  });
  await logAct(req.user, `Bulk: ${action}`, `${done} booking(s)`);
  pushApps(names);
  res.json({ done, skipped });
}));

/* ---------- Blocked students and statistics ---------- */

app.get('/api/blacklist', auth('admin'), wrap(async (_, res) => res.json((await query('SELECT name FROM blacklist ORDER BY name')).map(r => r.name))));
app.post('/api/blacklist', auth('admin'), wrap(async (req, res) => {
  const name = cleanName(req.body.name); if (!name) fail(400, 'Enter a student name.');
  await tx(async q => {
    await q('INSERT INTO blacklist(name, reason) VALUES($1,$2) ON CONFLICT (name) DO UPDATE SET reason = EXCLUDED.reason', [name, req.body.reason || '']);
    await q("UPDATE applications SET status = 'rejected' WHERE student = $1 AND status = 'pending'", [name]);
  });
  await logAct(req.user, 'Blocked student', name);
  pushApps([name]); res.json({ ok: true });
}));
app.delete('/api/blacklist/:name', auth('admin'), wrap(async (req, res) => {
  await query('DELETE FROM blacklist WHERE name = $1', [req.params.name]);
  await logAct(req.user, 'Unblocked student', req.params.name);
  pushApps(); res.sendStatus(204);
}));

app.get('/api/stats/overview', auth('admin'), wrap(async (_, res) => {
  const [apps, labRows] = await Promise.all([listApps(), query('SELECT id, name, pcs FROM labs ORDER BY name')]);
  const by = k => apps.filter(a => a.status === k).length;
  const marked = apps.filter(a => a.att), present = marked.filter(a => a.att === 'present').length;
  res.json({
    totals: { applications: apps.length, approved: by('approved'), pending: by('pending'), rejected: by('rejected') },
    labs: labRows.length,
    attendance: { present, absent: marked.length - present, late: apps.filter(a => a.att === 'present' && a.late).length, rate: marked.length ? Math.round(present / marked.length * 100) : null },
  });
}));

/* ---------- Lost and Found ---------- */

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

// Stored photos and files. Open to every site so the landing page can show them (images were blocked before).
app.get('/api/trends/files/:id', wrap(async (req, res) => {
  const f = (Number.isInteger(+req.params.id) && await one('SELECT name, mime, data FROM trend_media WHERE id = $1 AND data IS NOT NULL', [+req.params.id])) || fail(404, 'File not found.');
  const size = f.data.length;
  res.set({
    'Content-Type': f.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*',
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
  await logAct(req.user, 'Posted lost item', t.title);
  io.emit('trends:update'); res.json({ id });
}));

app.put('/api/trends/categories', comm, wrap(async (req, res) => {
  const list = cleanList(Array.isArray(req.body.list) ? req.body.list : []).slice(0, 40);
  if (!list.length) fail(400, 'Keep at least one category.');
  await saveOption(query, 'trendCategories', list);
  io.emit('trends:update');
  res.json({ list });
}));

// Delete many posts that are already off the board (returned or removed).
app.post('/api/trends/bulk-delete', comm, wrap(async (req, res) => {
  const ids = toIds(req.body.ids);
  if (!ids.length) fail(400, 'Choose at least one post.');
  const r = await query("DELETE FROM trends WHERE id = ANY($1::int[]) AND status <> 'active' RETURNING id", [ids]);
  await logAct(req.user, 'Deleted lost items', `${r.length}`);
  io.emit('trends:update'); res.json({ deleted: r.length });
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
  await logAct(req.user, 'Marked item returned', cur.title);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.patch('/api/trends/:id/remove', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status !== 'active') fail(409, 'This post is already off the board.');
  const left = Math.ceil(HOLD_DAYS - (Date.now() - new Date(cur.posted_at).getTime()) / DAY);
  if (left > 0) fail(409, `A post can be removed ${HOLD_DAYS} days after it was posted. ${left} day${left === 1 ? '' : 's'} left.`);
  await query("UPDATE trends SET status = 'removed', removed_at = now() WHERE id = $1", [cur.id]);
  await logAct(req.user, 'Removed lost item', cur.title);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.patch('/api/trends/:id/repost', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status === 'active') fail(409, 'This post is already on the board.');
  await query("UPDATE trends SET status = 'active', posted_at = now(), removed_at = NULL, repost_count = repost_count + 1 WHERE id = $1", [cur.id]);
  await logAct(req.user, 'Reposted lost item', cur.title);
  io.emit('trends:update'); res.json({ ok: true });
}));

app.delete('/api/trends/:id', comm, wrap(async (req, res) => {
  const cur = await getTrend(req.params.id);
  if (cur.status === 'active') fail(409, 'Remove the post from the board first.');
  await query('DELETE FROM trends WHERE id = $1', [cur.id]);
  await logAct(req.user, 'Deleted lost item', cur.title);
  io.emit('trends:update'); res.sendStatus(204);
}));

app.use((err, _req, res, _next) => res.status(Number.isInteger(err.code) && err.code >= 400 && err.code < 600 ? err.code : (err.type === 'entity.too.large' ? 413 : 500)).json({
  error: err.type === 'entity.too.large' ? 'The files are too big. Use smaller photos or paste a link for videos.' : err.message || 'Something went wrong.',
}));

/* ---------- Database set-up (safe to run on every start) ---------- */

const ensureTables = async () => {
  await query(`CREATE TABLE IF NOT EXISTS admin_profiles (
    email text PRIMARY KEY, picture text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '')`);

  // Activity log: every admin change. Used for the live feed and the chart.
  await query(`CREATE TABLE IF NOT EXISTS activity (
    id serial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now())`);
  await query('CREATE INDEX IF NOT EXISTS activity_created_idx ON activity (created_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS activity_actor_idx ON activity (actor, created_at)');

  // Admin chat: who the admins are, their messages, and what each admin has already read.
  await query(`CREATE TABLE IF NOT EXISTS admin_people (
    email text PRIMARY KEY, name text NOT NULL DEFAULT '', picture text NOT NULL DEFAULT '', last_seen timestamptz NOT NULL DEFAULT now())`);
  await query(`CREATE TABLE IF NOT EXISTS admin_chat (
    id serial PRIMARY KEY, room text NOT NULL, from_email text NOT NULL, from_name text NOT NULL DEFAULT '',
    to_email text NOT NULL DEFAULT 'all', body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  await query('CREATE INDEX IF NOT EXISTS admin_chat_room_idx ON admin_chat (room, id DESC)');
  await query('CREATE INDEX IF NOT EXISTS admin_chat_to_idx ON admin_chat (to_email, id)');
  await query(`CREATE TABLE IF NOT EXISTS admin_chat_reads (
    email text NOT NULL, room text NOT NULL, last_id integer NOT NULL DEFAULT 0, PRIMARY KEY (email, room))`);

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

  await query("ALTER TABLE labs ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT ''");
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true');
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS places integer CHECK (places IS NULL OR places >= 1)');
  await query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS for_class text NOT NULL DEFAULT ''");
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS for_group integer REFERENCES student_groups(id) ON DELETE SET NULL');
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS exclusive boolean NOT NULL DEFAULT false');
  await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT true');
  await query("ALTER TABLE applications ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT ''");
  await query('ALTER TABLE applications ADD COLUMN IF NOT EXISTS late boolean NOT NULL DEFAULT false');
  await query('ALTER TABLE applications ADD COLUMN IF NOT EXISTS checked_in_at timestamptz');
  await query('CREATE INDEX IF NOT EXISTS applications_session_idx ON applications (session_id, status)');
  await query('CREATE INDEX IF NOT EXISTS applications_student_idx ON applications (student)');
  await query(`CREATE TABLE IF NOT EXISTS session_people (
    session_id integer NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id))`);
  await query('CREATE INDEX IF NOT EXISTS session_people_user_idx ON session_people (user_id)');
  // "autoApprove" is added at the END of the view (a view can only grow at the end).
  await query(`CREATE OR REPLACE VIEW session_places AS
    SELECT s.id, s.lab_id AS "labId", l.name AS lab,
      to_char(s.date, 'YYYY-MM-DD') AS date,
      to_char(s.starts_at, 'HH24:MI') AS "from", to_char(s.ends_at, 'HH24:MI') AS "to",
      LEAST(COALESCE(s.places, l.pcs), l.pcs) AS seats,
      GREATEST(LEAST(COALESCE(s.places, l.pcs), l.pcs) - COALESCE(a.n, 0), 0) AS "left",
      s.published,
      s.for_class AS "forClass", s.for_group AS "forGroup", g.name AS "forGroupName", s.exclusive AS exclusive,
      (SELECT COUNT(*)::int FROM session_people p WHERE p.session_id = s.id) AS "forPeople",
      (SELECT COALESCE(array_agg(u.username ORDER BY u.username), ARRAY[]::text[]) FROM session_people p JOIN users u ON u.id = p.user_id WHERE p.session_id = s.id) AS people,
      s.auto_approve AS "autoApprove"
    FROM sessions s
    JOIN labs l ON l.id = s.lab_id
    LEFT JOIN student_groups g ON g.id = s.for_group
    LEFT JOIN (SELECT session_id, COUNT(*)::int AS n FROM applications WHERE status = 'approved' GROUP BY session_id) a ON a.session_id = s.id`);
};

// Every minute: in a running instant-booking lab time, when students are waiting and the lab is full,
// places of approved students who have not arrived after the grace time go to the queue.
const autoRelease = async () => {
  const opts = await getOptions();
  if (opts.autoRelease === false) return;
  const grace = graceOf(opts), now = nowLocal(), m = mins(now.time);
  const rows = await query('SELECT id, "from", "to" FROM session_places WHERE published AND "autoApprove" AND date = $1', [now.date]);
  for (const s of rows) {
    if (m < mins(s.from) + grace || m >= mins(s.to)) continue;
    const touched = [];
    const r = await tx(q => releaseNoShows(q, s.id, touched));
    if (r.released || touched.length) pushApps(touched);
  }
};

const port = process.env.PORT || 4000;
query('SELECT 1').then(ensureTables).then(seedOptions).then(() => server.listen(port, () => {
  console.log('LMS API and Socket.io running on port ' + port);
  setInterval(() => autoRelease().catch(e => console.error('auto-release:', e.message)), 60000);
}))
  .catch(e => { console.error('Cannot start. Check the DB_* values in .env and that the database is set up.\n', e.message); process.exit(1); });