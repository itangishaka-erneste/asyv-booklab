import { useEffect, useRef, useState } from 'react';
import dashb from './assets/dashb.png';
import { io } from 'socket.io-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import logo from './assets/as.png';

/* ================================================================== */
/* 0. API + LIVE UPDATES                                               */
/* ================================================================== */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
let token = localStorage.getItem('lms_token') || '';
const getToken = () => token;
const setToken = (t) => {
  token = t || '';
  if (t) localStorage.setItem('lms_token', t);
  else localStorage.removeItem('lms_token');
};

async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// Connects to Socket.io with the JWT and calls the latest handler for each event.
function useLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const socket = io(BASE, { auth: { token: getToken() } });
    Object.keys(ref.current).forEach((ev) => socket.on(ev, (...a) => ref.current[ev]?.(...a)));
    return () => socket.disconnect();
  }, []);
}

// Same idea for visitors who are NOT logged in (the public home page). No token is sent, so the
// server only tells them "something changed" and they read the public numbers again.
function usePublicLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const socket = io(BASE);
    Object.keys(ref.current).forEach((ev) => socket.on(ev, (...a) => ref.current[ev]?.(...a)));
    return () => socket.disconnect();
  }, []);
}

const C = { ink: '#0b0f1a', or: '#f97316', gr: '#16a34a', grid: '#e5e7eb', mute: '#94a3b8' };

/* ================================================================== */
/* 2. SCHOOL RULES                                                     */
/* A class is a grade + a combination + an optional section letter.    */
/* ================================================================== */

const COMBOS_S4_S5 = ['MSI', 'MSII', 'ART', 'HUMANITIES'];
const COMBOS_S6 = ['MPC', 'PCB', 'HGL', 'MEG'];
const DEFAULT_GRADES = ['S4', 'S5', 'S6'];
const DEFAULT_GRADE_COMBOS = { S4: COMBOS_S4_S5, S5: COMBOS_S4_S5, S6: COMBOS_S6 };
const SECTIONS = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
// Categories for the Lost & Found board (the Minister of Communication can change them).
const DEFAULT_CATS = ['Clothes', 'Shoes', 'Keys', 'Bags', 'Phones and electronics', 'Books and stationery', 'Documents and IDs', 'Water bottles and lunch boxes', 'Jewelry and watches', 'Other'];

const gradesOf = (opts) => (opts.grades?.length ? opts.grades : DEFAULT_GRADES);
const combosFor = (opts, grade) => opts.gradeCombos?.[grade] ?? DEFAULT_GRADE_COMBOS[grade] ?? [];
const catsOf = (opts) => (opts?.trendCategories?.length ? opts.trendCategories : DEFAULT_CATS);
const classLabel = ({ grade, combo, section }) => [grade, combo, section].filter(Boolean).join(' ');
const firstClass = (opts) => {
  const grade = gradesOf(opts)[0] || '';
  return { grade, combo: combosFor(opts, grade)[0] || '', section: '' };
};

// True when every word typed in the search box appears in one of the fields.
const match = (q, ...fields) => {
  const hay = fields.join(' ').toLowerCase();
  return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

// Days are always the LOCAL day of the person (not UTC), so "today" is really today at school.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => dayOffset(0);
const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const niceDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dayOf = (s) => String(s.date).slice(0, 10);
const fmt = (s) => `${s.lab} · ${s.date} ${s.from}–${s.to}`;

/* ================================================================== */
/* 3. SMALL UI KIT (every corner is 6px or less)                       */
/* ================================================================== */

const ICONS = {
  Overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  Users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  Labs: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  Schedule: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  Applications: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></>,
  Attendance: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
  History: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  Settings: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
  Profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  Logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  Search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  Tag: <><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><path d="M7 7h.01" /></>,
};
ICONS['My labs'] = ICONS.Labs;
ICONS.Bookings = ICONS.Labs;
ICONS['Lost & Found'] = ICONS.Tag;

const Icon = ({ n, className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {ICONS[n]}
  </svg>
);

const Btn = ({ c = 'ink', className = '', ...p }) => {
  const look = {
    ink: 'bg-[#0b0f1a] text-white',
    or: 'bg-[#f97316] text-white',
    gr: 'bg-[#16a34a] text-white',
    w: 'bg-white text-[#0b0f1a] border border-black/20',
  }[c];
  return (
    <button
      type="button"
      className={`px-4 py-2 text-xs font-semibold rounded-[6px] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] disabled:opacity-40 disabled:cursor-not-allowed ${look} ${className}`}
      {...p}
    />
  );
};

const Inp = ({ className = '', ...p }) => (
  <input
    className={`w-full px-3 py-2 text-xs rounded-[6px] border border-black/25 bg-white focus:outline-none focus:border-[#0b0f1a] focus:ring-2 focus:ring-[#0b0f1a]/10 disabled:bg-black/5 ${className}`}
    {...p}
  />
);

const Txt = ({ className = '', ...p }) => (
  <textarea
    rows={4}
    className={`w-full px-3 py-2 text-xs rounded-[6px] border border-black/25 bg-white focus:outline-none focus:border-[#0b0f1a] focus:ring-2 focus:ring-[#0b0f1a]/10 ${className}`}
    {...p}
  />
);

const Sel = ({ o = [], className = '', ...p }) => (
  <select className={`w-full px-2.5 py-2 text-xs rounded-[6px] border border-black/25 bg-white focus:outline-none focus:border-[#0b0f1a] disabled:bg-black/5 disabled:text-black/40 ${className}`} {...p}>
    {o.map((x) => {
      const v = x.v ?? x;
      const t = x.t ?? x;
      return <option key={v} value={v}>{t}</option>;
    })}
  </select>
);

const Card = ({ t, sub, action, children }) => (
  <section className="rounded-[6px] border border-black/10 bg-white p-5 mb-6">
    {(t || action) && (
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold">{t}</h3>
          {sub && <p className="mt-1 text-xs text-black/50">{sub}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

const Alert = ({ ok, children }) => (
  <p
    role={ok ? 'status' : 'alert'}
    className={`rounded-[6px] border px-4 py-3 mb-5 text-xs font-medium ${
      ok ? 'border-[#16a34a]/40 bg-[#16a34a]/5 text-[#15803d]' : 'border-[#f97316]/50 bg-[#f97316]/5 text-[#c2410c]'
    }`}
  >
    {children}
  </p>
);

const BADGE = {
  approved: 'bg-[#16a34a]/10 text-[#15803d]',
  pending: 'bg-[#f97316]/10 text-[#c2410c]',
  rejected: 'bg-red-50 text-red-600',
  present: 'bg-[#16a34a]/10 text-[#15803d]',
  absent: 'bg-red-50 text-red-600',
  active: 'bg-[#16a34a]/10 text-[#15803d]',
  returned: 'bg-sky-50 text-sky-700',
  removed: 'bg-red-50 text-red-600',
  available: 'bg-[#16a34a]/10 text-[#15803d]',
  limited: 'bg-[#f97316]/10 text-[#c2410c]',
  requested: 'bg-[#f97316]/10 text-[#c2410c]',
  full: 'bg-red-50 text-red-600',
  none: 'bg-black/5 text-black/60',
};
const Badge = ({ s, children }) => (
  <span className={`inline-block rounded-[4px] px-2 py-0.5 text-[11px] font-semibold capitalize ${BADGE[s] || 'bg-black/5 text-black/60'}`}>{children || s}</span>
);
const AttBadge = ({ att }) => <Badge s={att || 'none'}>{att || 'Not marked'}</Badge>;

const Field = ({ l, hint, children }) => (
  <label className="block text-xs font-medium">
    <span className="block mb-1.5">{l}</span>
    {children}
    {hint && <span className="block mt-1.5 font-normal text-black/50">{hint}</span>}
  </label>
);

const Empty = ({ children }) => <p className="py-6 text-center text-sm text-black/50">{children}</p>;

const Logo = ({ light }) => (
  <div className={`inline-flex items-center gap-3 text-base font-extrabold tracking-tight ${light ? 'text-white' : 'text-[#111827]'}`}>
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[6px] bg-transparent">
      <img src={logo} alt="LabBook logo" className="h-10 w-10 object-contain" />
    </span>
    <span className="inline-flex items-center text-base font-extrabold leading-none text-[#16a34a] sm:text-lg" aria-label="Asyv_Lms">
      {'Asyv_lms'.split('').map((letter, index) => (
        <span key={`${letter}-${index}`} className="inline-block animate-bounce" style={{ animationDelay: `${index * 0.1}s` }}>
          {index > 0 ? <span className="text-[#f97316]">{letter}</span> : letter}
        </span>
      ))}
    </span>
  </div>
);

const initials = (name) => String(name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const gravatar = (gid) => (gid ? `https://www.gravatar.com/avatar/${gid}?s=96&d=404` : '');

// Photo order: the Google picture saved at login, then the Gravatar of the email, then the initials.
const Avatar = ({ name, picture, gid, className = 'h-10 w-10 text-xs' }) => {
  const srcs = [picture, gravatar(gid)].filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [picture, gid]);
  if (i < srcs.length) {
    return <img src={srcs[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)} className={`shrink-0 rounded-full bg-black/10 object-cover ${className}`} />;
  }
  return <span className={`grid shrink-0 place-items-center rounded-full bg-[#0b0f1a] font-bold text-white ${className}`}>{initials(name)}</span>;
};

// A student, teacher or booking person: photo, name and email.
const Person = ({ p, sub, className = 'h-9 w-9 text-xs' }) => (
  <span className="flex min-w-0 items-center gap-3">
    <Avatar name={p.name} picture={p.picture} gid={p.gid} className={className} />
    <span className="min-w-0">
      <b className="block truncate">{p.name}</b>
      <span className="block truncate text-black/55">{sub ?? (p.email || 'No email')}</span>
    </span>
  </span>
);

const Modal = ({ title, onClose, wide, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`my-auto max-h-[92vh] w-full overflow-y-auto rounded-[6px] bg-white p-6 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="text-xl leading-none text-black/50 hover:text-black">×</button>
      </div>
      {children}
    </div>
  </div>
);

/* ---------- filters used on every page ---------- */

const SearchBox = ({ value, onChange, placeholder = 'Search by name or email' }) => (
  <div className="relative">
    <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-black/40"><Icon n="Search" /></span>
    <Inp type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="!pl-9" />
  </div>
);

// items: [value, label, count?]
const Pills = ({ value, onChange, items }) => (
  <div className="flex flex-wrap gap-2">
    {items.map(([v, t, n]) => (
      <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
        className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold ${value === v ? 'border-[#0b0f1a] bg-[#0b0f1a] text-white' : 'border-black/20 bg-white text-black/70 hover:bg-black/5'}`}>
        {t}{n != null && <span className="ml-1.5 opacity-60">{n}</span>}
      </button>
    ))}
  </div>
);

// The day filter used on the home page and on the student page. Goes back or forward one day at a
// time, jumps to any date, and returns to today. With `all`, an "All days" choice is added (day = '').
function DayBar({ day, onChange, all = false }) {
  const t = today();
  const base = day || t;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn c="w" aria-label="Previous day" onClick={() => onChange(shiftDay(base, -1))}>← Day before</Btn>
      <Inp type="date" aria-label="Choose a day" value={day} onChange={(e) => e.target.value && onChange(e.target.value)} className="!w-40" />
      <Btn c="w" aria-label="Next day" onClick={() => onChange(shiftDay(base, 1))}>Day after →</Btn>
      {day !== t && <Btn c="or" onClick={() => onChange(t)}>Today</Btn>}
      {all && day !== '' && <Btn c="w" onClick={() => onChange('')}>All days</Btn>}
    </div>
  );
}

const Row = ({ children }) => (
  <div className="flex flex-wrap justify-between items-center border-t border-black/10 py-3.5 gap-3">{children}</div>
);

// Groups bookings by lab time, then by class, so students of the same class who applied
// for the same lab sit together. Used by Applications, Attendance, History and the teacher page.
function groupApps(rows, desc = false) {
  const sessions = new Map();
  rows.forEach((a) => {
    if (!sessions.has(a.sid)) sessions.set(a.sid, { sid: a.sid, lab: a.lab, date: a.date, from: a.from, to: a.to, rows: [], classes: new Map() });
    const g = sessions.get(a.sid);
    const c = a.cls || 'Staff booking';
    g.rows.push(a);
    if (!g.classes.has(c)) g.classes.set(c, []);
    g.classes.get(c).push(a);
  });
  const key = (g) => `${g.date} ${g.from} ${g.lab}`;
  return [...sessions.values()]
    .sort((x, y) => (desc ? key(y).localeCompare(key(x)) : key(x).localeCompare(key(y))))
    .map((g) => ({
      ...g,
      classes: [...g.classes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([c, list]) => [c, [...list].sort((a, b) => a.name.localeCompare(b.name))]),
    }));
}

function Groups({ rows, desc, empty, meta, classActions, row }) {
  const groups = groupApps(rows, desc);
  if (!groups.length) return <Card><Empty>{empty}</Empty></Card>;
  return groups.map((g) => (
    <section key={g.sid} className="mb-5 overflow-hidden rounded-[6px] border border-black/10 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#0b0f1a] px-4 py-3 text-white">
        <div className="text-xs"><b className="text-sm">{g.lab}</b><span className="ml-2 text-white/60">{g.date} · {g.from}–{g.to}</span></div>
        <div className="text-xs text-white/75">{meta ? meta(g) : `${g.rows.length} students`}</div>
      </header>
      {g.classes.map(([c, list]) => (
        <div key={c}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-black/[0.04] px-4 py-2">
            <b className="text-xs">{c} <span className="font-normal text-black/50">· {list.length} {list.length === 1 ? 'student' : 'students'}</span></b>
            {classActions?.(list, g, c)}
          </div>
          {list.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-4 py-3">{row(a, g)}</div>
          ))}
        </div>
      ))}
    </section>
  ));
}

const attCounts = (rows) => {
  const present = rows.filter((a) => a.att === 'present').length;
  const absent = rows.filter((a) => a.att === 'absent').length;
  return { present, absent, none: rows.length - present - absent };
};

/* ================================================================== */
/* 4. LANDING PAGE: a full-height hero with live charts and a          */
/* dashboard preview, then the labs, their computers and the seats    */
/* left for one day, visible before anybody signs in.                  */
/* ================================================================== */

const NAV = [['labs', 'Labs'], ['trends', 'Lost and found']];
const WRAP = 'max-w-6xl mx-auto px-6';
const STATUS_TEXT = { available: 'Available', limited: 'Almost full', requested: 'Fully requested', full: 'Full', none: 'No lab time' };

const Heading = ({ title, className = '' }) => (
  <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${className}`}>{title}</h2>
);

function Header({ onLogin }) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-black/5">
      <div className={`${WRAP} h-16 flex items-center justify-between`}>
        <Logo />
        <nav className="hidden md:flex gap-2 text-xs font-medium">
          {NAV.map(([h, t]) => <a key={h} href={`#${h}`} className="px-3 py-2 rounded-[6px] hover:bg-black/5">{t}</a>)}
        </nav>
        <Btn c="or" onClick={onLogin}>Log in</Btn>
      </div>
    </header>
  );
}

// Reads the public overview of one day. It refreshes when the server says something changed
// (a new application, an approval, a new schedule...) and every 30 seconds as a safety net.
function useOverview(day) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const reload = useRef(() => {});
  useEffect(() => {
    let alive = true;
    const run = () => api(`/api/overview?date=${day}`)
      .then((d) => { if (alive) { setData(d); setErr(''); } })
      .catch((e) => { if (alive) setErr(e.message); });
    reload.current = run;
    run();
    const t = setInterval(run, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [day]);
  usePublicLive({ 'overview:update': () => reload.current() });
  return { data, err };
}

// Small tile used in the summary row.
const Mini = ({ v, t, tone = 'ink' }) => {
  const color = { ink: 'text-[#0b0f1a]', gr: 'text-[#16a34a]', or: 'text-[#f97316]' }[tone];
  return (
    <div className="rounded-[6px] border border-black/10 bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{v}</div>
      <div className="mt-1 text-xs font-medium text-black/60">{t}</div>
    </div>
  );
};

/* ---------- hero: animations ---------- */

const HERO_CSS = `
@keyframes lbIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
@keyframes lbRing{from{stroke-dashoffset:var(--c)}to{stroke-dashoffset:var(--off)}}
@keyframes lbGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes lbSlide{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes lbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes lbPulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes lbSpin{to{transform:rotate(360deg)}}
@keyframes lbBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
.lb-in{animation:lbIn .6s ease both}
.lb-ring{animation:lbRing 1.2s cubic-bezier(.2,.8,.2,1) both}
.lb-grow{transform-origin:bottom;animation:lbGrow .8s cubic-bezier(.2,.8,.2,1) both}
.lb-slide{transform-origin:left;animation:lbSlide .9s cubic-bezier(.2,.8,.2,1) both}
.lb-float{animation:lbFloat 5s ease-in-out infinite}
.lb-pulse{animation:lbPulse 1.6s ease-in-out infinite}
.lb-spin{animation:lbSpin 40s linear infinite}
.lb-spin-rev{animation:lbSpin 60s linear infinite reverse}
.lb-bounce{animation:lbBounce 1.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.lb-in,.lb-ring,.lb-grow,.lb-slide,.lb-float,.lb-pulse,.lb-spin,.lb-spin-rev,.lb-bounce{animation:none!important}}
`;

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;
const SPOT_STATUS = {
  available: 'bg-[#16a34a]/20 text-[#4ade80]',
  limited: 'bg-[#2563eb]/20 text-[#93c5fd]',
  requested: 'bg-[#2563eb]/20 text-[#93c5fd]',
  full: 'bg-red-500/20 text-red-300',
  none: 'bg-white/10 text-white/60',
};

// One lab at a time, changing every few seconds: a ring (free, waiting for approval, taken) and
// one column for each lab time of the day. Hover to pause, click a dot or a row to jump to a lab.
function Spotlight({ labs, loading }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold || labs.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % labs.length), 4500);
    return () => clearInterval(t);
  }, [hold, labs.length]);

  const lab = labs.length ? labs[i % labs.length] : null;
  const seats = lab?.seats || 0;
  const reqPct = seats ? Math.min((lab.taken + lab.waiting) / seats, 1) : 0;
  const takenPct = seats ? Math.min(lab.taken / seats, 1) : 0;
  const arc = (p) => ({ '--c': RING_C, '--off': RING_C * (1 - p), strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - p) });

  return (
    <div className="relative mx-auto w-full max-w-md" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      {/* slowly rotating decoration behind the card */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-6">
        <svg viewBox="0 0 200 200" className="lb-spin h-full w-full opacity-80">
          <circle cx="100" cy="100" r="96" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="4 14" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 200 200" className="lb-spin-rev absolute inset-5 h-[calc(100%-2.5rem)] w-[calc(100%-2.5rem)] opacity-60">
          <circle cx="100" cy="100" r="96" fill="none" stroke="#ffffff" strokeWidth="1.1" strokeDasharray="12 18" strokeLinecap="round" />
        </svg>
      </div>

      <div className="lb-float relative rounded-[6px] border border-black/10 bg-black p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between rounded bg-green-700 px-2 py-1 text-[11px] font-normal text-white">
          <span className="flex items-center gap-2"><span className="lb-pulse inline-block h-2 w-2 rounded-full bg-[#16a34a]" />Live status · today</span>
          {labs.length > 0 && <span>{(i % labs.length) + 1} / {labs.length}</span>}
        </div>

        {!lab ? (
          <p className="py-16 text-center text-xs text-black/60">{loading ? 'Loading the labs…' : 'No labs have been added yet.'}</p>
        ) : (
          <div key={lab.id} className="lb-in">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-white">{lab.name}</h3>
                <p className="mt-0.5 text-xs text-white/70">{lab.pcs} computers</p>
              </div>
              <span className={`rounded-[4px] px-2 py-1 text-[11px] font-semibold ${SPOT_STATUS[lab.status]}`}>{STATUS_TEXT[lab.status]}</span>
            </div>

            <div className="mt-4 grid grid-cols-[132px_1fr] items-center gap-5">
              <div className="relative h-[132px] w-[132px]">
                <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
                  <circle cx="66" cy="66" r={RING_R} fill="none" stroke="#16a34a" strokeOpacity={seats ? 0.35 : 0.12} strokeWidth="12" />
                  <circle key={`w${lab.id}`} className="lb-ring" cx="66" cy="66" r={RING_R} fill="none" stroke="#3b82f6" strokeWidth="12" strokeLinecap="butt" style={arc(reqPct)} />
                  <circle key={`t${lab.id}`} className="lb-ring" cx="66" cy="66" r={RING_R} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="butt" style={{ ...arc(takenPct), animationDelay: '.25s' }} />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <div className="text-3xl font-extrabold leading-none text-white">{lab.free}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white">free seats</div>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-white">
                <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-white/80"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#16a34a]" />Free</span><b className="text-white">{lab.free}</b></li>
                <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-white/80"><i className="lb-pulse inline-block h-2.5 w-2.5 rounded-[2px] bg-[#3b82f6]" />Waiting for approval</span><b className="text-white">{lab.waiting}</b></li>
                <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-white/80"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-slate-400" />Taken</span><b className="text-white">{lab.taken}</b></li>
              </ul>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/70">Lab times today</p>
              {lab.sessions.length === 0 ? (
                <p className="rounded-[6px] bg-black/5 px-3 py-4 text-center text-xs text-white/70">No lab time today.</p>
              ) : (
                <div className="flex h-24 items-end gap-2">
                  {lab.sessions.slice(0, 6).map((s, k) => {
                    const t = s.seats ? (s.taken / s.seats) * 100 : 0;
                    const w = s.seats ? (s.waiting / s.seats) * 100 : 0;
                    return (
                      <div key={s.id} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${s.from}–${s.to}: ${s.open} free, ${s.waiting} waiting, ${s.taken} taken`}>
                        <div className="relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden rounded-[3px] bg-[#16a34a]/30">
                          <div className="lb-grow bg-[#3b82f6]" style={{ height: w + '%', animationDelay: `${0.15 * k}s` }} />
                          <div className="lb-grow bg-slate-200" style={{ height: t + '%', animationDelay: `${0.15 * k + 0.1}s` }} />
                        </div>
                        <span className="mt-1 block truncate text-[10px] text-white/70">{s.from}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {labs.length > 1 && (
          <>
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {labs.map((l, k) => (
                <button key={l.id} type="button" aria-label={`Show ${l.name}`} onClick={() => setI(k)}
                  className={`h-1.5 rounded-full transition-all ${k === i % labs.length ? 'w-6 bg-[#3b82f6]' : 'w-1.5 bg-white/30 hover:bg-white/60'}`} />
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
              {labs.slice(0, 5).map((l, k) => {
                const p = l.seats ? Math.min((l.taken + l.waiting) / l.seats, 1) * 100 : 0;
                return (
                  <button key={l.id} type="button" onClick={() => setI(k)} className={`flex w-full items-center gap-3 rounded-[4px] px-2 py-1 text-left text-[11px] ${k === i % labs.length ? 'bg-black/5' : 'hover:bg-black/5'}`}>
                    <span className="w-20 shrink-0 truncate font-semibold">{l.name}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#16a34a]/30">
                      <span className="lb-slide block h-full bg-[#3b82f6]" style={{ width: p + '%', animationDelay: `${0.1 * k}s` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-black/60">{Math.round(p)}%</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="mx-auto p-4 w-full max-w-5xl">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/45">Admin dashboard</p>
      <img src={dashb} alt="LabBook dashboard preview" className="mx-auto block h-auto w-4/5 p-4 rounded-t-[10px] border border-none shadow-[0_-20px_80px_rgba(59,130,246,0.18)]" />
    </div>
  );
}

function Hero({ onLogin }) {
  const { data } = useOverview(today());
  const labs = data?.labs || [];
  const tot = data?.totals || {};
  const chips = [[tot.free ?? '-', 'free seats today', 'text-white'], [tot.waiting ?? '-', 'waiting for approval', 'text-white'], [tot.labs ?? '-', 'labs', 'text-white']];

  return (
    <section className="relative overflow-hidden bg-white text-[#0b0f1a]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 85% 15%, rgba(59,130,246,0.16), transparent 45%), radial-gradient(circle at 10% 90%, rgba(22,163,74,0.12), transparent 45%)' }} />
      <div className={`${WRAP} relative`}>
        <div className="flex min-h-[calc(100svh-4rem)] flex-col justify-center py-6">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="lb-in">
              <span className="inline-flex items-center gap-2 rounded-[6px] border border-black/15 bg-[#0b0f1a] px-3 py-1.5 text-[11px] font-semibold text-white">
                <span className="lb-pulse inline-block h-2 w-2 rounded-full bg-[#16a34a]" />Seats update live, no refresh needed
              </span>
              <h1 className="mt-5 max-w-xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">Computer labs: see what is free, then book.</h1>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-black/65">
                Choose a day to see every lab, its computers and the seats left. Seats that students already asked for show as waiting, so you always see the real picture. When you find a time, log in and apply.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#labs" className="inline-flex items-center gap-2 rounded-[6px] bg-[#16a34a] px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" /></svg>See the labs</a>
                <Btn c="w" onClick={onLogin}><span className="inline-flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M21.35 12.2c0-.7-.06-1.37-.18-2.02H12v3.82h5.23a4.47 4.47 0 0 1-1.94 2.93v2.48h3.14c1.84-1.7 2.92-4.2 2.92-7.21ZM12 21c2.63 0 4.84-.87 6.45-2.36l-3.14-2.48c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.56A9.74 9.74 0 0 0 12 21ZM6.51 13.04a5.85 5.85 0 0 1 0-3.74V6.74H3.27a9.75 9.75 0 0 0 0 8.86l3.24-2.56ZM12 5.26c1.43 0 2.71.49 3.72 1.47l2.79-2.79C16.83 2.34 14.62 1.5 12 1.5a9.74 9.74 0 0 0-8.73 5.24l3.24 2.56C7.29 6.98 9.45 5.26 12 5.26Z" /></svg>Log in with Google</span></Btn>
              </div>
              <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
                {chips.map(([v, t, c]) => (
                  <div key={t} className="rounded-[6px] border border-black/15 bg-[#0b0f1a] p-3">
                    <div className={`text-2xl font-bold ${c}`}>{v}</div>
                    <div className="mt-0.5 text-[11px] leading-tight text-white/70">{t}</div>
                  </div>
                ))}
              </div>
            </div>
            <Spotlight labs={labs} loading={!data} />
          </div>
          <a href="#dashboard" className="lb-bounce mx-auto mt-10 inline-block text-[11px] font-semibold text-black/50 hover:text-black/80">Scroll to see the dashboard ↓</a>
        </div>

        <div id="dashboard" className="scroll-mt-16 pt-4">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

/* ---------- the available labs ---------- */

// Every computer of a lab time as a small square. Green is free, orange is waiting for the admin's
// approval (in the order people applied), grey is taken (approved).
const PcGrid = ({ s }) => (
  <div className="mt-3">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
      {Array.from({ length: s.seats }, (_, i) => {
        const taken = i < s.taken;
        const waiting = !taken && i < s.taken + s.waiting;
        const look = taken
          ? 'border-orangered/50 bg-orangered/10 text-orangered'
          : waiting
            ? 'lb-pulse border-orange-500/50 bg-orange-500/10 text-orange-700'
            : 'border-[#16a34a]/40 bg-[#16a34a]/10 text-[#15803d]';
        return (
          <div key={i} title={`PC ${i + 1}: ${taken ? 'taken' : waiting ? 'waiting for approval' : 'free'}`}
            className={`rounded-[4px] border px-1 py-1.5 text-center text-[10px] font-semibold ${look}`}>
            PC {i + 1}
          </div>
        );
      })}
    </div>
    <p className="mt-2 text-[11px] leading-relaxed text-black/50">
      Green is free, orange is waiting for approval, grey is taken.
      {s.over > 0 && <b className="text-[#c2410c]"> {s.over} more student{s.over === 1 ? ' is' : 's are'} in the queue.</b>}
    </p>
  </div>
);

const Legend3 = () => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-black/60">
    <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#16a34a]" />Free</span>
    <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-orange-500" />Waiting for approval</span>
    <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#0b0f1a]" />Taken</span>
  </div>
);

const TOP_BAR = { available: 'bg-[#16a34a]', limited: 'bg-[#3b82f6]', requested: 'bg-[#3b82f6]', full: 'bg-red-500', none: 'bg-black/15' };

function LabCard({ lab, past, onLogin }) {
  const [open, setOpen] = useState(null); // the lab time whose computers are shown
  return (
    <article className="flex flex-col overflow-hidden rounded-[6px] border border-black/10 bg-white transition-shadow hover:shadow-lg">
      <div className={`h-1.5 ${TOP_BAR[lab.status]}`} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] bg-[#0b0f1a] text-white"><Icon n="Labs" className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold">{lab.name}</h3>
              <p className="mt-0.5 text-xs text-black/55">{lab.pcs} computers in this lab</p>
            </div>
          </div>
          <Badge s={lab.status}>{STATUS_TEXT[lab.status]}</Badge>
        </div>

        {lab.sessions.length === 0 ? (
          <p className="mt-5 rounded-[6px] bg-black/[0.04] px-3 py-6 text-center text-xs text-black/55">No lab time on this day.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[6px] bg-[#16a34a]/10 py-2"><div className="text-lg font-bold text-[#15803d]">{lab.free}</div><div className="text-[10px] font-semibold text-[#15803d]/80">Free</div></div>
              <div className="rounded-[6px] bg-[#3b82f6]/10 py-2"><div className="text-lg font-bold text-[#1d4ed8]">{lab.waiting}</div><div className="text-[10px] font-semibold text-[#1d4ed8]/80">Waiting</div></div>
              <div className="rounded-[6px] bg-black/[0.06] py-2"><div className="text-lg font-bold text-[#0b0f1a]">{lab.taken}</div><div className="text-[10px] font-semibold text-black/55">Taken</div></div>
            </div>
            <p className="mt-4 text-xs font-medium text-black/60">{lab.sessions.length} lab time{lab.sessions.length === 1 ? '' : 's'} on this day</p>

            <div className="mt-1">
              {lab.sessions.map((s) => {
                const ended = past;
                const tp = s.seats ? (s.taken / s.seats) * 100 : 100;
                const wp = s.seats ? (s.waiting / s.seats) * 100 : 0;
                const requestedFull = s.left > 0 && s.open < 1;
                const text = s.left < 1
                  ? `Full, ${s.seats} of ${s.seats} taken`
                  : requestedFull
                    ? `All seats requested · ${s.waiting} waiting for approval${s.over ? ` · ${s.over} in the queue` : ''}`
                    : `${s.open} of ${s.seats} free${s.waiting ? ` · ${s.waiting} waiting` : ''}`;
                return (
                  <div key={s.id} className="border-t border-black/10 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <b className="text-sm">{s.from}–{s.to}</b>
                        <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-[3px] bg-[#16a34a]/25">
                          <div className="h-full bg-[#0b0f1a] transition-all duration-700" style={{ width: tp + '%' }} />
                          <div className="h-full bg-[#3b82f6] transition-all duration-700" style={{ width: wp + '%' }} />
                        </div>
                        <div className={`mt-1 text-xs ${s.left < 1 ? 'font-bold text-red-600' : requestedFull ? 'font-bold text-[#1d4ed8]' : 'font-medium text-[#15803d]'}`}>{text}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                        <Btn c={requestedFull ? 'ink' : 'ink'} disabled={ended || s.left < 1} onClick={onLogin}>{ended ? 'Past' : s.left < 1 ? 'Full' : requestedFull ? 'Join queue' : 'Apply'}</Btn>
                        <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}
                          className="text-[11px] font-semibold text-black/60 hover:text-black hover:underline">
                          {open === s.id ? 'Hide computers' : 'Show computers'}
                        </button>
                      </div>
                    </div>
                    {open === s.id && <PcGrid s={s} />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function LabBoard({ onLogin }) {
  const [day, setDay] = useState(today());
  const [labId, setLabId] = useState('');
  const [view, setView] = useState('all');
  const { data, err } = useOverview(day);

  const loading = !data || data.date !== day;
  const labs = (data?.labs || []).filter((l) => (!labId || String(l.id) === labId) && (view === 'all' || l.free > 0));
  const tot = data?.totals || {};
  // Days that have lab times, nearest to the chosen day first, so it is easy to jump there.
  const near = (data?.days || [])
    .filter((d) => d !== day)
    .sort((a, b) => Math.abs(new Date(a) - new Date(day)) - Math.abs(new Date(b) - new Date(day)))
    .slice(0, 6)
    .sort();

  return (
    <div>
      <div className="rounded-[6px] border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-black/55">Showing labs for</p>
            <h3 className="mt-1 text-xl font-bold">{niceDay(day)}{day === today() && <span className="ml-2 align-middle"><Badge s="active">Today</Badge></span>}</h3>
          </div>
          <Legend3 />
        </div>
        <div className="mt-4"><DayBar day={day} onChange={setDay} /></div>
        {near.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-black/50">Days with lab times:</span>
            {near.map((d) => (
              <button key={d} type="button" onClick={() => setDay(d)} className="rounded-[6px] border border-black/20 bg-white px-2.5 py-1 font-semibold hover:bg-black/5">{d.slice(5)}</button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Mini v={tot.labs ?? '-'} t="Labs" />
        <Mini v={tot.computers ?? '-'} t="Computers in total" />
        <Mini v={tot.times ?? '-'} t="Lab times this day" />
        <Mini v={tot.free ?? '-'} t="Free seats this day" tone="gr" />
        <Mini v={tot.waiting ?? '-'} t="Waiting for approval" tone="or" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
        <Sel o={[{ v: '', t: 'All labs' }, ...(data?.labs || []).map((l) => ({ v: String(l.id), t: l.name }))]} value={labId} onChange={(e) => setLabId(e.target.value)} aria-label="Choose a lab" />
        <Pills value={view} onChange={setView} items={[['all', 'All labs'], ['free', 'Only with free seats']]} />
      </div>

      {err && <div className="mt-4"><Alert>{err}</Alert></div>}
      <div className="mt-6">
        {loading && !err && <Empty>Loading the labs…</Empty>}
        {!loading && data.labs.length === 0 && <Empty>No labs have been added yet.</Empty>}
        {!loading && data.labs.length > 0 && labs.length === 0 && <Empty>No lab matches these filters.</Empty>}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {!loading && labs.map((l) => <LabCard key={l.id} lab={l} past={day < today()} onLogin={onLogin} />)}
        </div>
      </div>
    </div>
  );
}

function Landing({ onLogin, categories }) {
  return (
    <div className="bg-white text-[#0b0f1a] antialiased text-sm">
      <style>{HERO_CSS}</style>
      <Header onLogin={onLogin} />
      <Hero onLogin={onLogin} />

      <section id="labs" className={`${WRAP} scroll-mt-16 py-16`}>
        <Heading title="Available labs" className="mt-2" />
        <p className="mb-8 mt-2 max-w-xl text-xs leading-relaxed text-black/60">
          Seat counts update on their own, even when someone applies. Go back or forward to see other days.
        </p>
        <LabBoard onLogin={onLogin} />
      </section>

      <TrendsSection categories={categories} />

      <footer className={`${WRAP} flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-slate-900 py-10 text-xs text-white/60`}>
        <Logo />
        <span className="text-2xl font-bold tracking-wide text-white" aria-label="Resources">
          {[..."Resources"].map((letter, index) => (
            <span key={`${letter}-${index}`} className={`inline-block animate-bounce ${["text-blue-500", "text-red-500", "text-yellow-500", "text-green-500"][index % 4]}`} style={{ animationDelay: `${index * 0.08}s` }} aria-hidden="true">
              {letter}
            </span>
          ))}
        </span>
        <span>© 2026 Computer Lab Management System</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 5. LOGIN: Google only (the admin creates every account)             */
/* ================================================================== */

const EMPTY_OPTS = { grades: [], gradeCombos: {}, classes: [], combos: [], clubs: [], staffRoles: [], families: [], reasons: [], trendCategories: [] };

// Google's own button. It only logs in people the admin has already added.
function GoogleBtn({ onResult, onError }) {
  const ref = useRef(null);
  const live = useRef({});
  live.current = { onResult, onError };
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    const start = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (r) => {
          try {
            const data = await api('/api/google', 'POST', { credential: r.credential });
            await live.current.onResult(data.token);
          } catch (e) { live.current.onError(e.message); }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 300,
      });
    };
    if (window.google) { start(); return; }
    let tag = document.getElementById('gsi-script');
    if (!tag) {
      tag = document.createElement('script');
      tag.id = 'gsi-script';
      tag.src = 'https://accounts.google.com/gsi/client';
      tag.async = true;
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', start);
    return () => tag.removeEventListener('load', start);
  }, [clientId]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center min-h-[44px]" />;
}

// The login screen is locked to the window (fixed, no page scroll). Only the form column scrolls,
// and only when the form really does not fit (for example a very short phone in landscape).
function Auth({ onDone, onBack }) {
  const [err, setErr] = useState('');
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className="fixed inset-0 grid overflow-hidden bg-white text-[13px] text-[#0b0f1a] lg:grid-cols-[2fr_3fr]">
      <aside className="relative hidden h-full overflow-hidden bg-cover bg-center lg:block" style={{
        backgroundImage: `linear-gradient(180deg, rgba(11,15,26,0.55), rgba(11,15,26,0.75)), url("https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=1200&q=80")`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}>
        <div className="relative h-full flex flex-col justify-between p-10 text-white">
          <Logo light />
          <div className="max-w-sm space-y-4">
            <div className="overflow-hidden rounded-[12px] border border-white/15 bg-white/8 backdrop-blur-sm shadow-lg">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcST7TcvochSBGi8U3bk4uFExeX2gwYuAxQg_FY5T4VXDtXRljapt_lG2kcr&s=10"
                alt="School minister"
                className="h-44 w-full object-cover object-center"
              />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold leading-tight tracking-tight">Your seat is waiting.</h2>
              <p className="text-xs text-white/75 leading-relaxed">Book a computer and see seats left in real time.</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto my-auto w-full max-w-md px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <button type="button" onClick={onBack} className="text-xs font-medium text-black/60 hover:text-black">← Back to home</button>
            <span className="lg:hidden"><Logo /></span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 mb-6 text-black/60 leading-relaxed">
            Sign in with the Google account your school has on record for you. Nobody can log in with just an email, so nobody can book in your name.
          </p>
          {err && <Alert>{err}</Alert>}

          {hasGoogle
            ? <GoogleBtn onResult={onDone} onError={setErr} />
            : <Alert>Google sign-in is not set up yet. Add VITE_GOOGLE_CLIENT_ID to the frontend .env file.</Alert>}

          <p className="mt-8 text-xs text-center text-black/50">
            Google account not recognised? Ask your school admin to add the email you use.
          </p>
        </div>
      </main>
    </div>
  );
}

/* ================================================================== */
/* 6. STUDENT DASHBOARD                                                */
/* ================================================================== */

const Tile = ({ v, t, tone = 'ink' }) => {
  const color = { ink: 'text-[#0b0f1a]', gr: 'text-[#16a34a]', or: 'text-[#f97316]' }[tone];
  return (
    <div className="rounded-[6px] border border-black/10 bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{v}</div>
      <div className="mt-1 text-xs font-medium text-black/60">{t}</div>
    </div>
  );
};

function Student({ opts }) {
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [reason, setReason] = useState(opts.reasons[0] || '');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [q, setQ] = useState('');
  const [day, setDay] = useState(today());
  const [view, setView] = useState('open');
  const [ast, setAst] = useState('all');

  const loadApps = () => api('/api/apps').then(setApps).catch((e) => { setOk(false); setMsg(e.message); });
  useEffect(() => { api('/api/sessions').then(setSessions).catch((e) => { setOk(false); setMsg(e.message); }); loadApps(); }, []);
  useLive({ seats: setSessions, 'applications:update': loadApps });

  const apply = async (id) => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: id, reason });
      setOk(!!r.created);
      setMsg(r.created ? 'Sent. Wait for the admin to approve your booking.' : 'You already have a booking at this lab time.');
    } catch (e) { setOk(false); setMsg(e.message); }
  };
  const mine = (id) => apps.find((a) => a.sid === id && a.status !== 'rejected');
  const n = (k) => apps.filter((a) => a.status === k).length;

  const labs = sessions.filter((s) => (!day || dayOf(s) === day) && match(q, s.lab) && (view === 'all' || s.left > 0));
  const myApps = apps.filter((a) => ast === 'all' || a.status === ast);

  return (
    <div>
      {msg && <Alert ok={ok}>{msg}</Alert>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Tile v={apps.length} t="Applications" />
        <Tile v={n('approved')} t="Approved" tone="gr" />
        <Tile v={n('pending')} t="Waiting" tone="or" />
        <Tile v={apps.filter((a) => a.att === 'present').length} t="Times attended" tone="gr" />
      </div>

      <Card t="Book a lab" sub={day ? niceDay(day) : 'All days'}>
        <div className="mb-4"><DayBar day={day} onChange={setDay} all /></div>
        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <Field l="Lab"><SearchBox value={q} onChange={setQ} placeholder="Lab name" /></Field>
          <Field l="Reason for booking"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Pills value={view} onChange={setView} items={[['open', 'With seats'], ['all', 'All labs']]} />
        </div>
        {labs.length === 0 && <Empty>{sessions.length ? 'No lab time on this day. Try the day before or after.' : 'No labs are open yet. Check back after the admin posts a schedule.'}</Empty>}
        {labs.map((s) => {
          const pct = s.seats ? ((s.seats - s.left) / s.seats) * 100 : 100;
          const m = mine(s.id);
          return (
            <div key={s.id} className="flex justify-between items-center border-t border-black/10 py-4 gap-4">
              <div className="min-w-0 flex-1">
                <b>{s.lab}</b>
                <span className="text-black/60"> · {day ? '' : `${s.date} · `}{s.from}–{s.to}</span>
                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-[3px] bg-black/10">
                  <div className={`h-full ${s.left > 0 ? 'bg-[#16a34a]' : 'bg-[#f97316]'}`} style={{ width: pct + '%' }} />
                </div>
                <div className={`mt-1.5 text-xs ${s.left > 0 ? 'text-[#15803d] font-medium' : 'text-[#c2410c] font-bold'}`}>
                  {s.left > 0 ? `${s.left} of ${s.seats} seats left` : 'Full'}
                </div>
              </div>
              {m ? <Badge s={m.status} /> : <Btn disabled={s.left < 1} onClick={() => apply(s.id)}>Apply</Btn>}
            </div>
          );
        })}
      </Card>

      <Card t="My applications" action={<Pills value={ast} onChange={setAst} items={[['all', 'All', apps.length], ['pending', 'Waiting', n('pending')], ['approved', 'Approved', n('approved')], ['rejected', 'Rejected', n('rejected')]]} />}>
        {myApps.length === 0 && <Empty>{apps.length ? 'No application matches.' : 'You have not applied yet. Pick a lab above.'}</Empty>}
        {myApps.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 py-3">
            <span><b>{a.lab}</b> <span className="text-black/60">· {a.date} {a.from} · {a.reason}</span></span>
            <span className="flex items-center gap-2">{a.att && <AttBadge att={a.att} />}<Badge s={a.status} /></span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 7. TEACHER / PSYCHOSOCIAL DASHBOARD                                 */
/* ================================================================== */

function Teacher({ user, opts }) {
  const psy = user.role === 'psychosocial';

  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [sq, setSq] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sid, setSid] = useState('');
  const [reason, setReason] = useState(opts.reasons[0] || '');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [apps, setApps] = useState([]);
  const [bq, setBq] = useState('');
  const [bst, setBst] = useState('all');

  const classOpts = psy ? [{ v: '', t: 'All students' }, ...classes.map((c) => ({ v: c, t: c }))] : classes;
  const loadApps = () => api('/api/apps').then(setApps).catch((e) => { setOk(false); setMsg(e.message); });

  useEffect(() => {
    api('/api/classes')
      .then((list) => { setClasses(list); if (!psy) setCls((c) => c || list[0] || ''); })
      .catch((e) => { setOk(false); setMsg(e.message); });
    api('/api/sessions').then((s) => { setSessions(s); setSid((id) => id || s[0]?.id || ''); }).catch((e) => { setOk(false); setMsg(e.message); });
    loadApps();
  }, []);
  useEffect(() => {
    setPicked([]);
    setSq('');
    if (!psy && !cls) { setStudents([]); return; }
    api(`/api/students?class=${encodeURIComponent(cls)}`).then(setStudents).catch((e) => { setOk(false); setMsg(e.message); });
  }, [cls]);
  useLive({
    seats: (s) => { setSessions(s); setSid((id) => (s.some((x) => x.id === +id) ? id : s[0]?.id || '')); },
    'applications:update': loadApps,
  });

  const shown = students.filter((s) => match(sq, s.name, s.email, s.className));
  const toggle = (n) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const allPicked = shown.length > 0 && shown.every((s) => picked.includes(s.name));
  const current = sessions.find((s) => s.id === +sid);

  const book = async () => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: +sid, reason, students: picked });
      const skipped = r.skipped?.length ? ` Already booked at this time: ${r.skipped.join(', ')}.` : '';
      setOk(r.created > 0); setMsg(`${r.created} booking(s) sent for approval.${skipped}`); setPicked([]);
    } catch (e) { setOk(false); setMsg(e.message); }
  };
  const n = (k) => apps.filter((a) => a.status === k).length;
  const myApps = apps.filter((a) => (bst === 'all' || a.status === bst) && match(bq, a.name, a.email, a.cls, a.lab, a.date));

  return (
    <div>
      {msg && <Alert ok={ok}>{msg}</Alert>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Tile v={apps.length} t="Bookings sent" />
        <Tile v={n('approved')} t="Approved" tone="gr" />
        <Tile v={n('pending')} t="Waiting" tone="or" />
      </div>

      <Card t={psy ? 'Book lab time for students' : 'Book lab time for a class'}>
        <div className="grid md:grid-cols-3 gap-5">
          <Field l="Class"><Sel o={classOpts} value={cls} onChange={(e) => setCls(e.target.value)} /></Field>
          <Field l="Lab time">
            <Sel o={sessions.map((s) => ({ v: s.id, t: `${s.lab} · ${s.date} ${s.from}` }))} value={sid} onChange={(e) => setSid(e.target.value)} />
          </Field>
          <Field l="Reason"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>

        {current && (
          <p className={`mt-5 font-medium ${current.left ? 'text-[#15803d]' : 'text-[#c2410c]'}`}>
            {current.left} of {current.seats} seats left in this lab
          </p>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <SearchBox value={sq} onChange={setSq} placeholder="Search students by name or email" />
          <Btn c="w" onClick={() => setPicked(allPicked ? picked.filter((n) => !shown.some((s) => s.name === n)) : [...new Set([...picked, ...shown.map((s) => s.name)])])}>
            {allPicked ? 'Clear shown' : sq ? 'Select shown' : 'Select whole class'}
          </Btn>
        </div>
        <p className="mt-3 text-xs text-black/50">
          {shown.length} of {students.length} students{cls ? ` in ${cls}` : ''} · {picked.length} selected
        </p>

        <div className="mt-2 divide-y divide-black/10">
          {shown.length === 0 && <Empty>{students.length ? 'No student matches your search.' : 'No students found in this class yet.'}</Empty>}
          {shown.map((s) => (
            <label key={s.name} className="flex cursor-pointer items-center gap-3 py-2.5">
              <input type="checkbox" checked={picked.includes(s.name)} onChange={() => toggle(s.name)} />
              <Person p={s} className="h-8 w-8 text-[10px]" />
              {psy && <span className="ml-auto text-black/60">{s.className}</span>}
            </label>
          ))}
        </div>

        <Btn className="mt-5" disabled={!picked.length || !sid} onClick={book}>
          Book {picked.length || ''} student{picked.length === 1 ? '' : 's'}
        </Btn>
      </Card>

      <Card t="My bookings" sub="Grouped by lab time, then by class.">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <SearchBox value={bq} onChange={setBq} placeholder="Search by student, email, class or lab" />
          <Pills value={bst} onChange={setBst} items={[['all', 'All', apps.length], ['pending', 'Waiting', n('pending')], ['approved', 'Approved', n('approved')], ['rejected', 'Rejected', n('rejected')]]} />
        </div>
      </Card>
      <Groups rows={myApps} desc empty={apps.length ? 'No booking matches.' : 'No bookings yet.'}
        row={(a) => (<><Person p={a} /><span className="flex items-center gap-2"><span className="text-black/60">{a.reason}</span>{a.att && <AttBadge att={a.att} />}<Badge s={a.status} /></span></>)} />
    </div>
  );
}

/* ================================================================== */
/* 8. ADMIN DASHBOARD                                                  */
/* ================================================================== */

const ADMIN_TABS = ['Overview', 'Users', 'Labs', 'Schedule', 'Applications', 'Attendance', 'History', 'Settings'];
const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', psychosocial: 'Psychosocial worker', student: 'Student' };
const ROLE_CHOICES = ['student', 'teacher', 'psychosocial'];

/* ---------- charts ---------- */

const TICK = { fontSize: 11, fill: '#64748b' };
const TIP = { contentStyle: { borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }, cursor: { fill: 'rgba(0,0,0,0.04)' } };

const ChartCard = ({ t, sub, h = 'h-64', children }) => (
  <Card t={t} sub={sub}>
    <div className={h}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
  </Card>
);

const Stat = ({ v, t, tone }) => {
  const color = { gr: 'text-[#16a34a]', or: 'text-[#f97316]' }[tone] || 'text-[#0b0f1a]';
  return (
    <div className="rounded-[6px] border border-black/10 bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{v}</div>
      <div className="mt-1 text-xs font-medium text-black/60">{t}</div>
    </div>
  );
};

function Overview({ stats, opts }) {
  const t = stats.totals || {};
  const people = stats.people || {};
  const rate = stats.attendance.rate;
  const labData = stats.labs.map((l) => ({
    name: l.lab, Approved: l.approved, Waiting: l.pending, Rejected: l.rejected,
    Used: l.approved, Free: Math.max(l.seatsOffered - l.approved, 0),
  }));
  const dayData = Object.entries(stats.byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ day: d.slice(5), Applications: v }));
  const reasonData = opts.reasons.map((r) => ({ name: r, Bookings: stats.byReason[r] || 0 }));
  const classData = Object.entries(stats.byClass || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, v]) => ({ name, Applications: v }));
  const attData = [{ name: 'Present', value: stats.attendance.present, fill: C.gr }, { name: 'Absent', value: stats.attendance.absent, fill: C.or }];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Stat v={t.applications} t="Applications" />
        <Stat v={t.approved} t="Approved" tone="gr" />
        <Stat v={t.pending} t="Waiting" tone="or" />
        <Stat v={t.rejected} t="Rejected" />
        <Stat v={rate === null ? '-' : rate + '%'} t="Attendance rate" tone="gr" />
        <Stat v={(people.student || 0) + (people.teacher || 0) + (people.psychosocial || 0)} t="Accounts" />
      </div>

      {stats.mostRequested && t.applications > 0 && (
        <p className="mb-6 rounded-[6px] bg-[#0b0f1a] text-white px-5 py-4 text-xs">
          Most requested lab: <b className="text-[#f97316]">{stats.mostRequested}</b>
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-x-6">
        <ChartCard t="Seats used per lab" sub="Approved students against the seats offered.">
          <BarChart data={labData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...TIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Used" stackId="s" fill={C.gr} />
            <Bar dataKey="Free" stackId="s" fill="#dbe2ea" />
          </BarChart>
        </ChartCard>

        <ChartCard t="Applications per lab" sub="Split by what happened to each one.">
          <BarChart data={labData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...TIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Approved" stackId="a" fill={C.gr} />
            <Bar dataKey="Waiting" stackId="a" fill={C.or} />
            <Bar dataKey="Rejected" stackId="a" fill={C.ink} />
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard t="Applications by day" sub="How demand changes over time." h="h-60">
        <AreaChart data={dayData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="dayFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.or} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.or} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...TIP} />
          <Area type="monotone" dataKey="Applications" stroke={C.or} strokeWidth={2} fill="url(#dayFill)" />
        </AreaChart>
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-x-6">
        <ChartCard t="Why students book" h="h-72">
          <BarChart data={reasonData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TIP} />
            <Bar dataKey="Bookings" fill={C.gr} />
          </BarChart>
        </ChartCard>

        <ChartCard t="Busiest classes" sub="Top 10 by applications." h="h-72">
          <BarChart data={classData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={90} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TIP} />
            <Bar dataKey="Applications" fill={C.ink} />
          </BarChart>
        </ChartCard>
      </div>

      <Card t="Attendance" sub="Across every session you have marked.">
        {rate === null ? <Empty>Mark attendance to see this chart.</Empty> : (
          <div className="flex flex-wrap items-center gap-8">
            <div className="relative h-52 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                    {attData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                  </Pie>
                  <Tooltip {...TIP} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="text-2xl font-bold">{rate}%</div><div className="text-[11px] text-black/50">attended</div></div>
              </div>
            </div>
            <div className="space-y-2 text-xs font-medium">
              <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[2px] bg-[#16a34a]" />{stats.attendance.present} present</p>
              <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-[2px] bg-[#f97316]" />{stats.attendance.absent} absent</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- class picker: grade + combination + optional section ---------- */

function ClassPicker({ value, opts, onChange }) {
  const grades = gradesOf(opts);
  const combos = combosFor(opts, value.grade);
  const setGrade = (grade) => onChange({ grade, combo: combosFor(opts, grade)[0] || '', section: value.section });
  const label = classLabel(value);

  return (
    <div className="md:col-span-2">
      <div className="grid sm:grid-cols-3 gap-5">
        <Field l="Grade" hint="Add more grades in Settings.">
          <Sel o={grades} value={value.grade} onChange={(e) => setGrade(e.target.value)} />
        </Field>
        <Field l="Combination" hint={combos.length ? undefined : 'This grade has no combinations.'}>
          <Sel o={combos.length ? combos : [{ v: '', t: 'None' }]} value={value.combo} disabled={!combos.length}
            onChange={(e) => onChange({ ...value, combo: e.target.value })} />
        </Field>
        <Field l="Section (optional)" hint="A number (1, 2, 3...) or a letter A to Z. Leave empty if the class is a single stream.">
          <Sel o={[{ v: '', t: 'No section' }, ...SECTIONS]} value={value.section} onChange={(e) => onChange({ ...value, section: e.target.value })} />
        </Field>
      </div>
      {label && (
        <p className="mt-3 text-xs text-black/60">
          This student will be in <span className="rounded-[4px] bg-[#16a34a]/10 px-2 py-0.5 font-semibold text-[#15803d]">{label}</span>
        </p>
      )}
    </div>
  );
}

/* ---------- accounts: the admin creates every user ---------- */

function UsersTab({ users, opts, act }) {
  const blank = { name: '', email: '', role: 'student', ...firstClass(opts) };
  const [f, setF] = useState(blank);
  const [created, setCreated] = useState(null);
  const [q, setQ] = useState('');
  const [rf, setRf] = useState('all');
  const [cf, setCf] = useState('all');
  const [edit, setEdit] = useState(null);
  const [limit, setLimit] = useState(40);
  const up = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const create = () => act(async () => {
    await api('/api/users', 'POST', {
      name: f.name, email: f.email, role: f.role,
      ...(f.role === 'student' && { grade: f.grade, combo: f.combo, section: f.section }),
    });
    setCreated({ name: f.name, email: f.email });
    setF({ ...blank, role: f.role, grade: f.grade, combo: f.combo, section: f.section });
  });

  const save = () => act(async () => {
    await api(`/api/users/${edit.id}`, 'PUT', {
      name: edit.name, email: edit.email,
      ...(edit.role === 'student' && { grade: edit.grade, combo: edit.combo, section: edit.section }),
    });
    setEdit(null);
  });

  const openEdit = (u) => {
    const grades = gradesOf(opts);
    const grade = grades.includes(u.grade) ? u.grade : grades.find((g) => (u.className || '').startsWith(g)) || grades[0] || '';
    const combos = combosFor(opts, grade);
    setEdit({ id: u.id, name: u.name, role: u.role, email: u.email, grade, combo: combos.includes(u.combo) ? u.combo : combos[0] || '', section: u.section || '' });
  };

  const setMinister = (u, on) => act(() => api(`/api/users/${u.id}/communication`, 'PATCH', { on }));

  const classNames = [...new Set(users.filter((u) => u.role === 'student' && u.className).map((u) => u.className))].sort();
  const shown = users.filter((u) => (rf === 'all' || u.role === rf) && (cf === 'all' || u.className === cf) && match(q, u.name, u.email, u.className));
  const count = (r) => users.filter((u) => u.role === r).length;
  const ministers = users.filter((u) => u.comm);

  return (
    <div>
      <Card t="Add an account" sub="Use the Google email the person signs in with. Their Google photo appears after their first login.">
        <div className="mb-5">
          <span className="block mb-1.5 text-xs font-medium">Role</span>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {ROLE_CHOICES.map((r) => (
              <Btn key={r} c={f.role === r ? 'ink' : 'w'} onClick={() => setF((p) => ({ ...p, role: r }))}>{ROLE_LABEL[r]}</Btn>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <Field l="Full name" hint="Used on bookings, so it must be unique."><Inp value={f.name} onChange={up('name')} placeholder="Aline Mukamana" /></Field>
          <Field l="Google email"><Inp type="email" value={f.email} onChange={up('email')} placeholder="aline@gmail.com" /></Field>
          {f.role === 'student' && (
            <ClassPicker value={{ grade: f.grade, combo: f.combo, section: f.section }} opts={opts} onChange={(c) => setF((p) => ({ ...p, ...c }))} />
          )}
        </div>
        <Btn className="mt-6" disabled={!f.name.trim() || !f.email.trim() || (f.role === 'student' && !f.grade)} onClick={create}>
          Add account
        </Btn>
        {created && (
          <p className="mt-5 rounded-[6px] border border-[#16a34a]/40 bg-[#16a34a]/5 p-4 text-xs text-[#15803d]">
            <b>{created.name}</b> can now continue with Google using <b>{created.email}</b>.
          </p>
        )}
      </Card>

      <Card t="Minister of Communication" sub="Pick the person below with Make minister. They keep their normal role and can still book labs. They also get a Lost & Found page where they set up categories, post found items and remove or repost them. You only assign the person, they do the rest.">
        {ministers.length === 0
          ? <p className="text-xs text-black/60">Nobody is Minister of Communication yet. Find the account in the list below and press Make minister.</p>
          : ministers.map((u) => (
            <Row key={u.id}>
              <Person p={u} className="h-10 w-10 text-xs" />
              <Btn c="w" onClick={() => window.confirm(`Remove ${u.name} as Minister of Communication?`) && setMinister(u, false)}>Remove minister</Btn>
            </Row>
          ))}
      </Card>

      <Card t="All accounts" sub={`${count('student')} students · ${count('teacher')} teachers · ${count('psychosocial')} psychosocial workers`}>
        <div className="grid md:grid-cols-[1fr_180px_180px] gap-3 mb-4">
          <SearchBox value={q} onChange={setQ} />
          <Sel o={[{ v: 'all', t: 'All roles' }, ...ROLE_CHOICES.map((r) => ({ v: r, t: ROLE_LABEL[r] }))]} value={rf} onChange={(e) => setRf(e.target.value)} />
          <Sel o={[{ v: 'all', t: 'All classes' }, ...classNames]} value={cf} onChange={(e) => setCf(e.target.value)} />
        </div>
        <p className="mb-2 text-xs text-black/50">{shown.length} shown</p>
        {shown.length === 0 && <Empty>No accounts match.</Empty>}
        {shown.slice(0, limit).map((u) => (
          <Row key={u.id}>
            <Person p={u} className="h-10 w-10 text-xs" />
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold">
                {u.role === 'student' ? (u.className || 'No class') : ROLE_LABEL[u.role]}
              </span>
              {u.comm && <span className="rounded-[4px] bg-[#f97316]/10 px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]">Minister of Communication</span>}
              {!u.comm && <Btn c="w" onClick={() => window.confirm(`Make ${u.name} the Minister of Communication?`) && setMinister(u, true)}>Make minister</Btn>}
              <Btn c="w" onClick={() => openEdit(u)}>Edit</Btn>
              <Btn c="or" onClick={() => window.confirm(`Delete the account of ${u.name}?`) && act(() => api(`/api/users/${u.id}`, 'DELETE'))}>Delete</Btn>
            </span>
          </Row>
        ))}
        {shown.length > limit && (
          <div className="border-t border-black/10 pt-4 text-center">
            <Btn c="w" onClick={() => setLimit((n) => n + 40)}>Show 40 more ({shown.length - limit} left)</Btn>
          </div>
        )}
      </Card>

      {edit && (
        <Modal title={`Edit ${edit.name}`} onClose={() => setEdit(null)}>
          <div className="space-y-4">
            <Field l="Full name" hint="Past bookings are updated to the new name."><Inp value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field l="Google email"><Inp type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            {edit.role === 'student' && (
              <ClassPicker value={{ grade: edit.grade, combo: edit.combo, section: edit.section }} opts={opts} onChange={(c) => setEdit({ ...edit, ...c })} />
            )}
            <div className="flex gap-3 pt-2">
              <Btn onClick={save}>Save changes</Btn>
              <Btn c="w" onClick={() => setEdit(null)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- labs and schedule ---------- */

function LabsTab({ labs, act }) {
  const [lab, setLab] = useState({ name: '', pcs: 10 });
  return (
    <Card t="Labs and computers">
      <div className="flex gap-3 mb-5">
        <Inp placeholder="Lab name" value={lab.name} onChange={(e) => setLab({ ...lab, name: e.target.value })} />
        <Inp type="number" min="0" className="!w-24" value={lab.pcs} onChange={(e) => setLab({ ...lab, pcs: e.target.value })} />
        <Btn onClick={() => act(async () => { await api('/api/labs', 'POST', lab); setLab({ name: '', pcs: 10 }); })}>Add</Btn>
      </div>
      {labs.length === 0 && <Empty>No labs yet. Add your first lab above.</Empty>}
      {labs.map((l) => (
        <Row key={l.id}>
          <b>{l.name}</b>
          <span className="flex items-center gap-3">
            <Inp type="number" min="0" className="!w-20" defaultValue={l.pcs}
              onBlur={(e) => +e.target.value !== l.pcs && act(() => api(`/api/labs/${l.id}`, 'PUT', { pcs: +e.target.value }))} />
            computers
            <Btn c="or" onClick={() => window.confirm(`Delete ${l.name}?`) && act(() => api(`/api/labs/${l.id}`, 'DELETE'))}>Delete</Btn>
          </span>
        </Row>
      ))}
    </Card>
  );
}

function ScheduleTab({ labs, sessions, act }) {
  const [sch, setSch] = useState({ date: today(), from: '14:00', to: '16:00', labId: 'all' });
  const [q, setQ] = useState('');
  const shown = sessions.filter((s) => match(q, s.lab, s.date, s.from, s.to));
  return (
    <Card t="Prepare a schedule">
      <div className="grid md:grid-cols-4 gap-4">
        <Inp type="date" value={sch.date} onChange={(e) => setSch({ ...sch, date: e.target.value })} />
        <Inp type="time" value={sch.from} onChange={(e) => setSch({ ...sch, from: e.target.value })} />
        <Inp type="time" value={sch.to} onChange={(e) => setSch({ ...sch, to: e.target.value })} />
        <Sel o={[{ v: 'all', t: 'All labs' }, ...labs.map((l) => ({ v: l.id, t: l.name }))]} value={sch.labId} onChange={(e) => setSch({ ...sch, labId: e.target.value })} />
      </div>
      <Btn className="my-5" onClick={() => act(() => api('/api/sessions', 'POST', {
        date: sch.date, from: sch.from, to: sch.to,
        labIds: sch.labId === 'all' ? undefined : [+sch.labId],
      }))}>Publish schedule</Btn>

      <div className="mb-3 max-w-sm"><SearchBox value={q} onChange={setQ} placeholder="Search lab, date or time" /></div>
      {shown.length === 0 && <Empty>{sessions.length ? 'No lab time matches.' : 'Nothing published yet.'}</Empty>}
      {shown.map((s) => (
        <Row key={s.id}>
          <span>{fmt(s)} · <b>{s.left}/{s.seats} seats left</b></span>
          <span className="flex gap-3">
            <Inp type="time" className="!w-28" defaultValue={s.from}
              onBlur={(e) => e.target.value !== s.from && act(() => api(`/api/sessions/${s.id}`, 'PUT', { from: e.target.value }))} />
            <Inp type="time" className="!w-28" defaultValue={s.to}
              onBlur={(e) => e.target.value !== s.to && act(() => api(`/api/sessions/${s.id}`, 'PUT', { to: e.target.value }))} />
            <Btn c="or" onClick={() => act(() => api(`/api/sessions/${s.id}`, 'DELETE'))}>Remove</Btn>
          </span>
        </Row>
      ))}
    </Card>
  );
}

/* ---------- applications: approve by lab time and class ---------- */

function ApplicationsTab({ apps, sessions, black, act, bulk }) {
  const [f, setF] = useState({ q: '', status: 'pending', sid: '', cls: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const count = (s) => apps.filter((a) => s === 'all' || a.status === s).length;
  const classes = [...new Set(apps.map((a) => a.cls).filter(Boolean))].sort();
  const seats = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const shown = apps.filter((a) =>
    (f.status === 'all' || a.status === f.status) &&
    (!f.sid || String(a.sid) === f.sid) &&
    (!f.cls || a.cls === f.cls) &&
    match(f.q, a.name, a.email, a.cls, a.reason));
  const pendingShown = shown.filter((a) => a.status === 'pending').map((a) => a.id);

  return (
    <div>
      <Card t="Applications" sub="Students of the same class who applied for the same lab time are listed together."
        action={<Btn disabled={!pendingShown.length} onClick={() => bulk(pendingShown, 'approved')}>Approve all shown ({pendingShown.length})</Btn>}>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_160px]">
          <SearchBox value={f.q} onChange={(v) => set('q', v)} />
          <Sel o={[{ v: '', t: 'All lab times' }, ...sessions.map((s) => ({ v: String(s.id), t: fmt(s) }))]} value={f.sid} onChange={(e) => set('sid', e.target.value)} />
          <Sel o={[{ v: '', t: 'All classes' }, ...classes]} value={f.cls} onChange={(e) => set('cls', e.target.value)} />
        </div>
        <div className="mt-4">
          <Pills value={f.status} onChange={(v) => set('status', v)}
            items={[['pending', 'Waiting', count('pending')], ['approved', 'Approved', count('approved')], ['rejected', 'Rejected', count('rejected')], ['all', 'All', count('all')]]} />
        </div>
      </Card>

      <Groups rows={shown} empty="No applications match these filters."
        meta={(g) => { const s = seats[g.sid]; return `${g.rows.length} shown${s ? ` · ${s.left} of ${s.seats} seats left` : ''}`; }}
        classActions={(list) => {
          const p = list.filter((a) => a.status === 'pending').map((a) => a.id);
          return p.length ? (
            <span className="flex gap-2">
              <Btn onClick={() => bulk(p, 'approved')}>Approve class ({p.length})</Btn>
              <Btn c="or" onClick={() => bulk(p, 'rejected')}>Reject class</Btn>
            </span>
          ) : null;
        }}
        row={(a) => (
          <>
            <span className="flex min-w-0 items-center gap-3"><Person p={a} /><span className="text-black/60">{a.reason}</span><Badge s={a.status} /></span>
            <span className="flex flex-wrap items-center gap-2">
              {a.status !== 'approved' && <Btn onClick={() => bulk([a.id], 'approved')}>Approve</Btn>}
              {a.status !== 'rejected' && <Btn c="or" onClick={() => bulk([a.id], 'rejected')}>Reject</Btn>}
              <select aria-label={`Move ${a.name}`} className="rounded-[6px] border border-black/25 bg-white px-2.5 py-2 text-xs" value=""
                onChange={(e) => e.target.value && act(() => api(`/api/apps/${a.id}/move`, 'PATCH', { sessionId: +e.target.value }))}>
                <option value="">Move to…</option>
                {sessions.filter((s) => s.id !== a.sid).map((s) => <option key={s.id} value={s.id}>{fmt(s)} ({s.left} left)</option>)}
              </select>
              <Btn c="w" onClick={() => window.confirm(`Blacklist ${a.name}?`) && act(() => api('/api/blacklist', 'POST', { name: a.name }))}>Blacklist</Btn>
            </span>
          </>
        )} />

      <Card t="Blacklisted students">
        {black.length === 0 ? <p className="text-black/60">Nobody is blacklisted.</p> : black.map((n) => (
          <span key={n} className="mb-2 mr-3 inline-flex items-center gap-2 rounded-[6px] border border-[#f97316] px-3 py-1.5 font-medium text-[#c2410c]">
            {n}
            <button type="button" aria-label={'Unblock ' + n} onClick={() => act(() => api(`/api/blacklist/${encodeURIComponent(n)}`, 'DELETE'))}>×</button>
          </span>
        ))}
      </Card>
    </div>
  );
}

/* ---------- attendance: mark by lab time and class ---------- */

function AttendanceTab({ apps, labs, users, absent, act }) {
  const um = Object.fromEntries(users.map((u) => [u.name, u]));
  const [f, setF] = useState({ q: '', date: today(), labId: '', cls: '', att: 'all' });
  const [aq, setAq] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const approved = apps.filter((a) => a.status === 'approved');
  const classes = [...new Set(approved.map((a) => a.cls).filter(Boolean))].sort();
  const shown = approved.filter((a) =>
    (!f.date || a.date === f.date) &&
    (!f.labId || String(a.labId) === f.labId) &&
    (!f.cls || a.cls === f.cls) &&
    (f.att === 'all' || (f.att === 'none' ? !a.att : a.att === f.att)) &&
    match(f.q, a.name, a.email, a.cls));

  const mark = (a, att) => act(() => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att: a.att === att ? null : att }));
  const markMany = (list, att) => act(async () => {
    for (const a of list) await api(`/api/apps/${a.id}/attendance`, 'PATCH', { att });
  });
  const c = attCounts(shown);
  const absRows = Object.entries(absent).filter(([n, r]) => match(aq, n, um[n]?.email, um[n]?.className)).sort((a, b) => b[1].absent - a[1].absent);

  return (
    <div>
      <Card t="Mark attendance" sub="Pick a day and lab, then mark one student or a whole class.">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_180px_160px]">
          <SearchBox value={f.q} onChange={(v) => set('q', v)} />
          <Inp type="date" aria-label="Day" value={f.date} onChange={(e) => set('date', e.target.value)} />
          <Sel o={[{ v: '', t: 'All labs' }, ...labs.map((l) => ({ v: String(l.id), t: l.name }))]} value={f.labId} onChange={(e) => set('labId', e.target.value)} />
          <Sel o={[{ v: '', t: 'All classes' }, ...classes]} value={f.cls} onChange={(e) => set('cls', e.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Pills value={f.att} onChange={(v) => set('att', v)}
            items={[['all', 'All', shown.length], ['none', 'Not marked'], ['present', 'Present'], ['absent', 'Absent']]} />
          <div className="flex items-center gap-3 text-xs text-black/60">
            <span><b className="text-[#15803d]">{c.present}</b> present</span>
            <span><b className="text-red-600">{c.absent}</b> absent</span>
            <span><b>{c.none}</b> not marked</span>
            {f.date && <Btn c="w" onClick={() => set('date', '')}>All days</Btn>}
          </div>
        </div>
      </Card>

      <Groups rows={shown} empty="No approved students for these filters."
        classActions={(list) => (
          <span className="flex gap-2">
            <Btn c="gr" onClick={() => markMany(list, 'present')}>All present</Btn>
            <Btn c="w" onClick={() => markMany(list, 'absent')}>All absent</Btn>
          </span>
        )}
        row={(a) => (
          <>
            <Person p={a} />
            <span className="flex gap-2">
              <Btn c={a.att === 'present' ? 'gr' : 'w'} onClick={() => mark(a, 'present')}>Present</Btn>
              <Btn c={a.att === 'absent' ? 'or' : 'w'} onClick={() => mark(a, 'absent')}>Absent</Btn>
            </span>
          </>
        )} />

      <Card t="Absenteeism by student">
        <div className="mb-4 max-w-sm"><SearchBox value={aq} onChange={setAq} /></div>
        {absRows.length === 0 ? <Empty>{Object.keys(absent).length ? 'No student matches.' : 'No attendance recorded yet.'}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="text-black/50"><th className="pb-2 font-medium">Student</th><th className="font-medium">Class</th><th className="font-medium">Applied</th><th className="font-medium">Attended</th><th className="font-medium">Absent</th></tr></thead>
              <tbody>
                {absRows.map(([n, r]) => (
                  <tr key={n} className="border-t border-black/10">
                    <td className="py-2.5"><Person p={{ name: n, email: um[n]?.email, picture: um[n]?.picture, gid: um[n]?.gid }} className="h-8 w-8 text-[10px]" /></td>
                    <td>{um[n]?.className}</td>
                    <td>{r.applied}</td>
                    <td className="text-[#16a34a]">{r.attended}</td>
                    <td className={r.absent ? 'font-bold text-[#f97316]' : ''}>{r.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- history: day + lab, who came, who was absent ---------- */

function HistoryTab({ apps: rows, labs }) {
  const [f, setF] = useState({ from: today(), to: today(), labId: '', cls: '', status: 'approved', att: 'all', q: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const range = (from, to) => setF((p) => ({ ...p, from, to }));

  const classes = [...new Set(rows.map((a) => a.cls).filter(Boolean))].sort();
  const shown = rows.filter((a) =>
    (!f.from || a.date >= f.from) &&
    (!f.to || a.date <= f.to) &&
    (!f.labId || String(a.labId) === f.labId) &&
    (!f.cls || a.cls === f.cls) &&
    (f.status === 'all' || a.status === f.status) &&
    (f.att === 'all' || (f.att === 'none' ? !a.att : a.att === f.att)) &&
    match(f.q, a.name, a.email, a.cls, a.reason));
  const c = attCounts(shown);
  const marked = c.present + c.absent;

  const exportCsv = () => {
    const head = ['Date', 'Lab', 'From', 'To', 'Student', 'Email', 'Class', 'Status', 'Attendance'];
    const body = shown.map((a) => [a.date, a.lab, a.from, a.to, a.name, a.email, a.cls, a.status, a.att || 'not marked']);
    const text = [head, ...body].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url; link.download = `lab-history-${f.from || 'all'}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Card t="Lab history" sub="Choose the days and the lab to see who was booked, who came and who was absent."
        action={<Btn c="w" disabled={!shown.length} onClick={exportCsv}>Download CSV</Btn>}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Pills value={`${f.from}|${f.to}`} onChange={(v) => range(...v.split('|'))}
            items={[[`${today()}|${today()}`, 'Today'], [`${dayOffset(-1)}|${dayOffset(-1)}`, 'Yesterday'], [`${dayOffset(-6)}|${today()}`, 'Last 7 days'], [`${dayOffset(-29)}|${today()}`, 'Last 30 days'], ['|', 'All time']]} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field l="From day"><Inp type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></Field>
          <Field l="To day"><Inp type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></Field>
          <Field l="Lab"><Sel o={[{ v: '', t: 'All labs' }, ...labs.map((l) => ({ v: String(l.id), t: l.name }))]} value={f.labId} onChange={(e) => set('labId', e.target.value)} /></Field>
          <Field l="Class"><Sel o={[{ v: '', t: 'All classes' }, ...classes]} value={f.cls} onChange={(e) => set('cls', e.target.value)} /></Field>
        </div>
        <div className="mt-4"><SearchBox value={f.q} onChange={(v) => set('q', v)} placeholder="Search student name, email, class or reason" /></div>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Pills value={f.status} onChange={(v) => set('status', v)} items={[['approved', 'Approved'], ['pending', 'Waiting'], ['rejected', 'Rejected'], ['all', 'Any status']]} />
          <Pills value={f.att} onChange={(v) => set('att', v)} items={[['all', 'Any attendance'], ['present', 'Attended'], ['absent', 'Absent'], ['none', 'Not marked']]} />
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat v={shown.length} t="Students listed" />
        <Stat v={c.present} t="Attended" tone="gr" />
        <Stat v={c.absent} t="Absent" tone="or" />
        <Stat v={c.none} t="Not marked" />
        <Stat v={marked ? Math.round((c.present / marked) * 100) + '%' : '-'} t="Attendance rate" tone="gr" />
      </div>

      <Groups rows={shown} desc empty="Nothing matches. Try another day, lab or status."
        meta={(g) => { const k = attCounts(g.rows); return `${g.rows.length} students · ${k.present} attended · ${k.absent} absent · ${k.none} not marked`; }}
        classActions={(list) => { const k = attCounts(list); return <span className="text-[11px] text-black/60"><b className="text-[#15803d]">{k.present}</b> attended · <b className="text-red-600">{k.absent}</b> absent · {k.none} not marked</span>; }}
        row={(a) => (<><Person p={a} /><span className="flex items-center gap-2"><span className="text-black/60">{a.reason}</span><Badge s={a.status} /><AttBadge att={a.att} /></span></>)} />
    </div>
  );
}

/* ---------- settings: grades and the combinations of each grade ---------- */

const Chip = ({ children, onRemove, onEdit, label }) => (
  <span className="inline-flex items-center gap-2 rounded-[6px] border border-black/15 bg-white py-1.5 pl-3 pr-2 text-xs font-medium">
    {children}
    {onEdit && <button type="button" aria-label={`Rename ${label}`} onClick={onEdit} className="text-black/40 hover:text-black">✎</button>}
    <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}
      className="grid h-4 w-4 place-items-center rounded-[3px] text-[#f97316] hover:bg-[#f97316]/10">×</button>
  </span>
);

function ClassSetup({ opts, save, rename }) {
  const grades = gradesOf(opts);
  const [newGrade, setNewGrade] = useState('');
  const [newCombo, setNewCombo] = useState({});
  const full = Object.fromEntries(grades.map((g) => [g, combosFor(opts, g)]));
  const clean = (s) => s.trim().toUpperCase().replace(/\s+/g, ' ');

  const addGrade = () => {
    const g = clean(newGrade);
    if (g && !grades.includes(g)) save([...grades, g], { ...full, [g]: [] });
    setNewGrade('');
  };
  const removeGrade = (g) => {
    if (!window.confirm(`Remove ${g}? Students already in ${g} keep their class.`)) return;
    const { [g]: _gone, ...rest } = full;
    save(grades.filter((x) => x !== g), rest);
  };
  const renameGrade = (g) => {
    const to = window.prompt(`New name for grade ${g}`, g);
    if (to && clean(to) !== g) rename(null, g, to);
  };
  const addCombo = (g) => {
    const c = clean(newCombo[g] || '');
    if (c && !full[g].includes(c)) save(grades, { ...full, [g]: [...full[g], c] });
    setNewCombo({ ...newCombo, [g]: '' });
  };
  const renameCombo = (g, c) => {
    const to = window.prompt(`New name for ${c} in ${g}`, c);
    if (to && clean(to) !== c) rename(g, c, to);
  };
  const removeCombo = (g, c) => save(grades, { ...full, [g]: full[g].filter((x) => x !== c) });

  return (
    <Card t="Grades and combinations" sub="A class is a grade plus a combination, for example S6 IJABO. Renaming updates every student already in it.">
      <div className="mb-6 flex max-w-md gap-3">
        <Inp placeholder="New grade, for example S3" value={newGrade}
          onChange={(e) => setNewGrade(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGrade()} />
        <Btn className="shrink-0" onClick={addGrade}>Add grade</Btn>
      </div>
      {grades.length === 0 && <Empty>No grades yet. Add your first grade above.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {grades.map((g) => (
          <div key={g} className="rounded-[6px] border border-black/10 bg-[#f6f7f9] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex min-w-[2.75rem] items-center justify-center whitespace-nowrap rounded-[6px] bg-[#0b0f1a] px-3 py-2 text-sm font-bold leading-none text-white">{g}</span>
                <span className="text-[11px] text-black/50">
                  {full[g].length ? `${full[g].length} combination${full[g].length === 1 ? '' : 's'}` : 'No combinations'}
                </span>
              </div>
              <span className="flex gap-3 text-[11px] font-semibold">
                <button type="button" onClick={() => renameGrade(g)} className="hover:underline">Rename</button>
                <button type="button" onClick={() => removeGrade(g)} className="text-[#c2410c] hover:underline">Remove</button>
              </span>
            </div>
            <div className="mb-3 flex min-h-[32px] flex-wrap gap-2">
              {full[g].length === 0 && <span className="py-1.5 text-xs text-black/50">No combinations. Students get a grade and an optional section.</span>}
              {full[g].map((c) => <Chip key={c} label={`${c} from ${g}`} onEdit={() => renameCombo(g, c)} onRemove={() => removeCombo(g, c)}>{c}</Chip>)}
            </div>
            <div className="flex gap-2">
              <Inp placeholder={`Add a combination to ${g}`} value={newCombo[g] || ''}
                onChange={(e) => setNewCombo({ ...newCombo, [g]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addCombo(g)} />
              <Btn c="w" className="shrink-0" onClick={() => addCombo(g)}>Add</Btn>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ListEditor({ title, sub, items, onSave }) {
  const [v, setV] = useState('');
  const add = () => {
    const x = v.trim();
    if (x && !items.includes(x)) onSave([...items, x]);
    setV('');
  };
  const rename = (x) => {
    const to = window.prompt(`Rename "${x}"`, x);
    if (to && to.trim() && to.trim() !== x) onSave(items.map((y) => (y === x ? to.trim() : y)));
  };
  return (
    <Card t={title} sub={sub}>
      <div className="mb-5 flex min-h-[32px] flex-wrap gap-2">
        {items.length === 0 && <span className="py-1.5 text-xs text-black/50">Nothing here yet.</span>}
        {items.map((x) => <Chip key={x} label={x} onEdit={() => rename(x)} onRemove={() => onSave(items.filter((y) => y !== x))}>{x}</Chip>)}
      </div>
      <div className="flex max-w-md gap-3">
        <Inp placeholder={`Add to ${title.toLowerCase()}`} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Btn className="shrink-0" onClick={add}>Add</Btn>
      </div>
    </Card>
  );
}

const SETTINGS_TABS = ['Classes', 'Booking reasons', 'Clubs and staff'];
const OTHER_LISTS = { clubs: ['Clubs and activities', 'Shown on student profiles.'], staffRoles: ['Staff roles', 'Job titles for staff.'], families: ['Families', 'Groups students belong to.'] };

function SettingsTab({ opts, saveList, saveSetup, rename }) {
  const [t, setT] = useState(SETTINGS_TABS[0]);
  return (
    <div>
      <div className="mb-6"><Pills value={t} onChange={setT} items={SETTINGS_TABS.map((x) => [x, x])} /></div>
      {t === 'Classes' && <ClassSetup opts={opts} save={saveSetup} rename={rename} />}
      {t === 'Booking reasons' && (
        <ListEditor title="Booking reasons" sub="Students and staff pick one of these when they book." items={opts.reasons || []} onSave={(l) => saveList('reasons', l)} />
      )}
      {t === 'Clubs and staff' && Object.entries(OTHER_LISTS).map(([k, [title, sub]]) => (
        <ListEditor key={k} title={title} sub={sub} items={opts[k] || []} onSave={(l) => saveList(k, l)} />
      ))}
    </div>
  );
}

function Admin({ opts: initial, tab }) {
  const [err, setErr] = useState('');
  const [labs, setLabs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [black, setBlack] = useState([]);
  const [stats, setStats] = useState(null);
  const [absent, setAbsent] = useState({});
  const [users, setUsers] = useState([]);
  const [opts, setOpts] = useState({ ...EMPTY_OPTS, ...initial });

  const load = () =>
    Promise.all([
      api('/api/labs'), api('/api/sessions'), api('/api/apps'),
      api('/api/blacklist'), api('/api/stats/overview'), api('/api/stats/absenteeism'), api('/api/users'),
    ])
      .then(([l, s, a, b, st, ab, us]) => {
        setLabs(l); setSessions(s); setApps(a); setBlack(b); setStats(st); setAbsent(ab); setUsers(us);
      })
      .catch((e) => setErr(e.message));

  useEffect(() => { load(); }, []);
  useLive({ seats: load, 'applications:update': load });

  // Runs an action, shows its error if it fails, and always reloads so the screen stays true.
  const act = async (fn) => {
    try { await fn(); setErr(''); } catch (e) { setErr(e.message); }
    await load();
  };
  // Class and "all shown" actions call the existing one-student endpoint for each student, one after another.
  const bulk = (ids, status) => act(async () => {
    let failed = 0, last = '';
    for (const id of ids) {
      try { await api(`/api/apps/${id}/status`, 'PATCH', { status }); } catch (e) { failed++; last = e.message; }
    }
    if (failed) throw new Error(`${ids.length - failed} updated, ${failed} not changed. ${last}`);
  });
  const saveList = (k, list) =>
    act(async () => setOpts({ ...EMPTY_OPTS, ...(await api('/api/options', 'PUT', { [k]: list })) }));
  const saveSetup = (grades, gradeCombos) =>
    act(async () => setOpts({ ...EMPTY_OPTS, ...(await api('/api/options', 'PUT', { grades, gradeCombos })) }));
  const rename = (grade, from, to) =>
    act(async () => setOpts({ ...EMPTY_OPTS, ...(await api('/api/options/rename', 'POST', { grade, from, to })) }));

  return (
    <div>
      {err && <Alert>{err}</Alert>}
      {tab === 'Overview' && (stats ? <Overview stats={stats} opts={opts} /> : <Empty>Loading the numbers…</Empty>)}
      {tab === 'Users' && <UsersTab users={users} opts={opts} act={act} />}
      {tab === 'Labs' && <LabsTab labs={labs} act={act} />}
      {tab === 'Schedule' && <ScheduleTab labs={labs} sessions={sessions} act={act} />}
      {tab === 'Applications' && <ApplicationsTab apps={apps} sessions={sessions} black={black} act={act} bulk={bulk} />}
      {tab === 'Attendance' && <AttendanceTab apps={apps} labs={labs} users={users} absent={absent} act={act} />}
      {tab === 'History' && <HistoryTab apps={apps} labs={labs} />}
      {tab === 'Settings' && <SettingsTab opts={opts} saveList={saveList} saveSetup={saveSetup} rename={rename} />}
    </div>
  );
}

/* ================================================================== */
/* 9. LOST & FOUND ("TRENDS")                                          */
/* Public board on the home page + the posting page of the Minister    */
/* of Communication (and admins).                                      */
/* ================================================================== */

const MAX_UPLOAD = 12 * 1024 * 1024; // the server refuses bigger files, so we check here first
const MAX_ATTACH = 6;

// Uploaded files live on the API (/api/...), links keep their own address.
const mediaSrc = (m) => (m.src?.startsWith('/') ? BASE + m.src : m.src);
// Share links (Google Drive, Dropbox, Imgur page) become the direct picture, so the object shows as a real image.
const directImg = (u) => {
  const s = String(u || '');
  let m = s.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || s.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
  if (/^https?:\/\/(www\.)?dropbox\.com\//i.test(s)) {
    try { const x = new URL(s); x.searchParams.delete('dl'); x.searchParams.set('raw', '1'); return x.toString(); } catch { return s; }
  }
  m = s.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,8})\/?$/);
  return m ? `https://i.imgur.com/${m[1]}.jpg` : s;
};
const photoOf = (m) => (m.kind === 'image' ? directImg(mediaSrc(m)) : m.kind === 'link' && directImg(m.src) !== m.src ? directImg(m.src) : '');
const IMG_LINK = /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i;
const photosOf = (item) => item.media.map(photoOf).filter(Boolean);
const ago = (iso) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const niceSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ytId = (u) => (String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/) || [])[1] || '';
const isVideoFile = (u) => /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u) || String(u).includes('/api/trends/files/');

const readFile = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(new Error(`Could not read ${file.name}.`));
  r.readAsDataURL(file);
});

// Big photos are shrunk in the browser (max 1600 px) so the upload stays fast.
async function prepFile(file) {
  if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size > 600 * 1024) {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * k);
      cv.height = Math.round(bmp.height * k);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
      if (blob && blob.size < file.size) {
        return { name: file.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', data: await readFile(blob), size: blob.size };
      }
    } catch { /* use the original file */ }
  }
  return { name: file.name, mime: file.type || 'application/octet-stream', data: await readFile(file), size: file.size };
}

// The real photo of the object (uploaded, or from a pasted link). Video-only posts show the video thumbnail.
const Cover = ({ item, className = '' }) => {
  const yt = item.media.map((m) => (m.kind === 'video' ? ytId(m.src) : '')).find(Boolean);
  const src = photosOf(item)[0] || (yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : '');
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <div role="img" aria-label={item.title} className={`grid place-items-center bg-black/[0.06] text-black/30 ${className}`}>
        <Icon n="Tag" className="h-8 w-8" />
      </div>
    );
  }
  return <img src={src} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`object-cover ${className}`} />;
};

const LinkBtn = ({ c = 'w', className = '', ...p }) => {
  const look = { ink: 'bg-[#0b0f1a] text-white', gr: 'bg-[#16a34a] text-white', or: 'bg-[#f97316] text-white', w: 'bg-white text-[#0b0f1a] border border-black/20' }[c];
  return <a target="_blank" rel="noreferrer" className={`inline-block px-4 py-2 text-xs font-semibold rounded-[6px] hover:opacity-90 ${look} ${className}`} {...p} />;
};

// Everything about one post: photos, videos, files, and how to contact the poster.
function TrendDetail({ item, onClose }) {
  const [k, setK] = useState(0);
  const images = photosOf(item);
  const videos = item.media.filter((m) => m.kind === 'video');
  const others = item.media.filter((m) => (m.kind === 'file' || m.kind === 'link') && !photoOf(m));
  const digits = (item.phone || '').replace(/[^\d]/g, '');
  const subject = encodeURIComponent(`Lost item: ${item.title}`);

  return (
    <Modal title={item.title} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-[4px] bg-[#0b0f1a] px-2 py-1 font-semibold text-white">{item.category}</span>
        <span className="text-black/55">Posted {ago(item.postedAt)}</span>
        {item.foundAt && <span className="text-black/55">· Found at {item.foundAt}</span>}
      </div>

      {images.length > 0 && (
        <div className="mt-4">
          <div className="overflow-hidden rounded-[6px] bg-black/5">
            <img src={images[k] || images[0]} alt={item.title} referrerPolicy="no-referrer" className="max-h-[420px] w-full object-contain" />
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.map((im, i) => (
                <button key={im + i} type="button" aria-label={`Photo ${i + 1}`} onClick={() => setK(i)}
                  className={`h-14 w-16 shrink-0 overflow-hidden rounded-[6px] border-2 ${i === k ? 'border-[#f97316]' : 'border-transparent'}`}>
                  <img src={im} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {item.description && <p className="mt-4 whitespace-pre-line text-xs leading-relaxed text-black/70">{item.description}</p>}

      {videos.map((v) => {
        const id = ytId(v.src);
        if (id) return <iframe key={v.id} title={v.name || 'Video'} className="mt-4 aspect-video w-full rounded-[6px]" src={`https://www.youtube-nocookie.com/embed/${id}`} allowFullScreen />;
        if (isVideoFile(v.src)) return <video key={v.id} controls preload="metadata" className="mt-4 max-h-[420px] w-full rounded-[6px] bg-black" src={mediaSrc(v)} />;
        return <div key={v.id} className="mt-4"><LinkBtn href={v.src}>▶ Watch video</LinkBtn></div>;
      })}

      {others.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((o) => <LinkBtn key={o.id} href={mediaSrc(o)}>{o.kind === 'file' ? '📎' : '🔗'} {o.name || 'Open'}</LinkBtn>)}
        </div>
      )}

      <div className="mt-6 rounded-[6px] border border-[#16a34a]/40 bg-[#16a34a]/5 p-4">
        <h4 className="text-xs font-bold text-[#15803d]">Is this yours?</h4>
        <p className="mt-1 text-xs leading-relaxed text-black/65">
          Contact the Minister of Communication, describe the item (something only the owner would know) and come to collect it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.phone && <LinkBtn c="gr" href={`tel:${item.phone}`}>Call {item.phone}</LinkBtn>}
          {digits && <LinkBtn c="ink" href={`https://wa.me/${digits}?text=${subject}`}>WhatsApp</LinkBtn>}
          {item.email && <LinkBtn c="or" href={`mailto:${item.email}?subject=${subject}`}>Email</LinkBtn>}
          {!item.phone && !item.email && <span className="text-xs text-black/60">Ask {item.postedBy || 'the Minister of Communication'} at school.</span>}
        </div>
      </div>
    </Modal>
  );
}

// The public board on the home page.
function TrendsSection({ categories }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(null);

  const load = () => api('/api/trends').then(setItems).catch(() => setItems((cur) => cur || []));
  useEffect(() => { load(); }, []);
  usePublicLive({ 'trends:update': load });

  const list = items || [];
  const names = [...new Set([...(categories?.length ? categories : DEFAULT_CATS), ...list.map((t) => t.category)])].filter((c) => list.some((t) => t.category === c));
  const shown = list.filter((t) => (cat === 'all' || t.category === cat) && match(q, t.title, t.category, t.description, t.foundAt));
  const visible = more ? shown : shown.slice(0, 9);

  return (
    <section id="trends" className="scroll-mt-16 bg-black/[0.03]">
      <div className={`${WRAP} py-16`}>
        <div>
          <Heading title="Lost something? Look here first." className="max-w-xl" />
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-black/60">
            Everything found at school is posted here by the Minister of Communication. Tap your item and contact the minister to get it back.
          </p>
        </div>

        {list.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_320px] md:items-center">
            <Pills value={cat} onChange={setCat} items={[['all', 'All', list.length], ...names.map((c) => [c, c, list.filter((t) => t.category === c).length])]} />
            <SearchBox value={q} onChange={setQ} placeholder="Search keys, bag, jacket..." />
          </div>
        )}

        <div className="mt-8">
          {items === null && <Empty>Loading the board…</Empty>}
          {items !== null && list.length === 0 && (
            <div className="rounded-[6px] border border-dashed border-black/20 bg-white px-6 py-14 text-center">
              <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-[6px] bg-[#0b0f1a] text-white"><Icon n="Tag" /></div>
              <p className="text-sm font-semibold">Nothing is waiting for an owner right now.</p>
              <p className="mt-1 text-xs text-black/55">New finds will appear here as soon as the minister posts them.</p>
            </div>
          )}
          {list.length > 0 && shown.length === 0 && <Empty>No item matches your search.</Empty>}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpen(t)}
                className="group flex h-full flex-col overflow-hidden rounded-[6px] border border-black/10 bg-white text-left transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f97316]">
                <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
                  <Cover item={t} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 rounded-[4px] bg-[#0b0f1a]/85 px-2 py-1 text-[11px] font-semibold text-white">{t.category}</span>
                  {t.media.length > 1 && <span className="absolute right-3 top-3 rounded-[4px] bg-white/90 px-2 py-1 text-[11px] font-semibold">{t.media.length} items</span>}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-sm font-semibold">{t.title}</h3>
                  {t.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-black/60">{t.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-4 text-[11px] text-black/50">
                    <span>{t.foundAt ? `Found at ${t.foundAt}` : `Posted ${ago(t.postedAt)}`}</span>
                    <span className="font-semibold text-[#c2410c]">View and contact →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {shown.length > 9 && !more && <div className="mt-8 text-center"><Btn c="w" onClick={() => setMore(true)}>Show all {shown.length} items</Btn></div>}
        </div>
      </div>
      {open && <TrendDetail item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

// The post form: used to create a post (with attachments) and to correct the text of an existing one.
function TrendForm({ initial, cats, user, onSubmit, onCancel }) {
  const editing = !!initial;
  const [f, setF] = useState({
    title: initial?.title || '', category: initial?.category || cats[0] || 'Other', foundAt: initial?.foundAt || '',
    description: initial?.description || '', phone: initial?.phone || '', email: initial ? initial.email : user.email || '',
  });
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [li, setLi] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const up = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const catOpts = [...new Set([...cats, f.category])];

  const pick = async (e) => {
    const list = [...e.target.files];
    e.target.value = '';
    if (!list.length) return;
    if (files.length + list.length > MAX_ATTACH) { setErr(`You can add up to ${MAX_ATTACH} files.`); return; }
    setErr(''); setBusy(true);
    try {
      for (const file of list) {
        if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is bigger than 12 MB. For long videos, paste a link instead.`);
        const prepared = await prepFile(file);
        setFiles((p) => (p.length >= MAX_ATTACH ? p : [...p, prepared]));
      }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const addLink = () => {
    const v = li.trim();
    if (!v) return;
    if (!/^https?:\/\/\S+$/i.test(v)) { setErr('A link must start with http:// or https://'); return; }
    setErr(''); setLinks((p) => (p.includes(v) ? p : [...p, v])); setLi('');
  };
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      await onSubmit({ ...f, files: files.map(({ name, mime, data }) => ({ name, mime, data })), links: li.trim() ? [...links, li.trim()] : links });
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <div>
      {err && <Alert>{err}</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field l="What was found?" hint="Short and clear, for example Blue school sweater."><Inp value={f.title} onChange={up('title')} maxLength={140} placeholder="Black jacket with a red zip" /></Field>
        <Field l="Category"><Sel o={catOpts} value={f.category} onChange={up('category')} /></Field>
        <Field l="Where was it found?" hint="Optional."><Inp value={f.foundAt} onChange={up('foundAt')} placeholder="Near Lab 1, dining hall..." /></Field>
        <Field l="Phone or WhatsApp" hint="Optional. Owners can call or message this number."><Inp value={f.phone} onChange={up('phone')} placeholder="+250 7xx xxx xxx" /></Field>
        <Field l="Contact email" hint="Optional."><Inp type="email" value={f.email} onChange={up('email')} placeholder="you@gmail.com" /></Field>
        <div className="md:col-span-2">
          <Field l="Details" hint="Colour, brand, size, marks. Do not give away everything, so the real owner can prove it is theirs.">
            <Txt value={f.description} onChange={up('description')} maxLength={4000} />
          </Field>
        </div>
      </div>

      {!editing && (
        <div className="mt-6 rounded-[6px] border border-black/10 bg-[#f6f7f9] p-4">
          <h4 className="text-xs font-bold">Photos, videos and files</h4>
          <p className="mt-1 text-xs text-black/55">Up to {MAX_ATTACH} files of 12 MB (photos, short videos, PDF, Word). For long videos paste a link below.</p>
          <label className="mt-3 inline-block cursor-pointer rounded-[6px] border border-black/20 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5">
            Choose files
            <input type="file" multiple className="sr-only" onChange={pick} disabled={busy}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
          </label>
          {files.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {files.map((x, i) => (
                <li key={x.name + i} className="flex items-center gap-3 rounded-[6px] border border-black/10 bg-white p-2 text-xs">
                  {x.mime.startsWith('image/')
                    ? <img src={`data:${x.mime};base64,${x.data}`} alt="" className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />
                    : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] bg-black/5 text-[10px] font-bold uppercase">{x.mime.startsWith('video/') ? 'Video' : 'File'}</span>}
                  <span className="min-w-0 flex-1"><b className="block truncate">{x.name}</b><span className="text-black/50">{niceSize(x.size)}</span></span>
                  <button type="button" aria-label={`Remove ${x.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="px-1 text-lg leading-none text-[#f97316]">×</button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-2">
            <Inp value={li} onChange={(e) => setLi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} placeholder="Paste a photo link (it shows as the real picture) or a video link" />
            <Btn c="w" className="shrink-0" onClick={addLink}>Add link</Btn>
          </div>
          {links.length > 0 && (
            <ul className="mt-3 space-y-2">
              {links.map((l) => (
                <li key={l} className="flex items-center gap-3 rounded-[6px] border border-black/10 bg-white px-3 py-2 text-xs">
                  {(IMG_LINK.test(directImg(l)) || directImg(l) !== l) && <img src={directImg(l)} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />}
                  <span className="min-w-0 flex-1 truncate">{l}</span>
                  <button type="button" aria-label="Remove link" onClick={() => setLinks((p) => p.filter((x) => x !== l))} className="text-lg leading-none text-[#f97316]">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Btn disabled={busy || !f.title.trim()} onClick={submit}>{busy ? 'Please wait…' : editing ? 'Save changes' : 'Post to Trends'}</Btn>
        <Btn c="w" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

// The Minister of Communication's page (only the person the admin assigned sees it).
function TrendsManager({ user, opts }) {
  const [cats, setCats] = useState(catsOf(opts));
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);
  const [view, setView] = useState('active');
  const [cf, setCf] = useState('');
  const [q, setQ] = useState('');

  const load = () => api('/api/trends/manage').then(setItems).catch((e) => { setOk(false); setMsg(e.message); });
  useEffect(() => { load(); }, []);
  useLive({ 'trends:update': load });
  useEffect(() => { api('/api/options').then((o) => setCats(catsOf(o))).catch(() => {}); }, []);

  const act = async (fn, done = '') => {
    try { await fn(); setOk(true); setMsg(done); } catch (e) { setOk(false); setMsg(e.message); }
    await load();
  };
  const create = async (body) => {
    await api('/api/trends', 'POST', body);
    setFormOpen(false); setOk(true); setMsg('Posted. Everyone can now see it on the home page under Lost and found.'); load();
  };
  const update = async (body) => {
    await api(`/api/trends/${edit.id}`, 'PUT', body);
    setEdit(null); setOk(true); setMsg('Changes saved.'); load();
  };

  const list = items || [];
  const n = (s) => list.filter((t) => t.status === s).length;
  const shown = list.filter((t) => (view === 'all' || t.status === view) && (!cf || t.category === cf) && match(q, t.title, t.category, t.description, t.foundAt));
  const usedCats = [...new Set(list.map((t) => t.category))].sort();

  return (
    <div>
      {msg && <Alert ok={ok}>{msg}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile v={n('active')} t="On the board" tone="gr" />
        <Tile v={list.filter((t) => t.status === 'active' && t.daysLeft === 0).length} t="Ready to remove" tone="or" />
        <Tile v={n('returned')} t="Returned to owners" />
        <Tile v={n('removed')} t="Removed" />
      </div>

      <Card t="Post a found item" sub={`Everyone sees active posts on the home page. A post can be removed 7 days after it was posted, and reposted later to put it back on top.`}
        action={!formOpen && <Btn c="or" onClick={() => setFormOpen(true)}>+ New post</Btn>}>
        {formOpen
          ? <TrendForm cats={cats} user={user} onSubmit={create} onCancel={() => setFormOpen(false)} />
          : <p className="text-xs text-black/55">Add a photo, a short video, a file or a link, choose a category and give a way to contact you.</p>}
      </Card>

      <Card t="All posts" action={<Pills value={view} onChange={setView} items={[['active', 'On the board', n('active')], ['returned', 'Returned', n('returned')], ['removed', 'Removed', n('removed')], ['all', 'All', list.length]]} />}>
        <div className="mb-3 grid gap-3 md:grid-cols-[1fr_220px]">
          <SearchBox value={q} onChange={setQ} placeholder="Search by title, category or place" />
          <Sel o={[{ v: '', t: 'All categories' }, ...usedCats]} value={cf} onChange={(e) => setCf(e.target.value)} />
        </div>
        {items === null && <Empty>Loading…</Empty>}
        {items !== null && shown.length === 0 && <Empty>{list.length ? 'No post matches.' : 'You have not posted anything yet. Press New post.'}</Empty>}
        {shown.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-4 border-t border-black/10 py-4">
            <button type="button" aria-label={`Open ${t.title}`} onClick={() => setDetail(t)} className="h-16 w-20 shrink-0 overflow-hidden rounded-[6px] bg-black/5">
              <Cover item={t} className="h-full w-full" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <b className="truncate">{t.title}</b>
                <Badge s={t.status} />
                <span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold">{t.category}</span>
              </div>
              <p className="mt-1 text-xs text-black/55">
                Posted {ago(t.postedAt)}{t.reposts ? ` · reposted ${t.reposts} time${t.reposts === 1 ? '' : 's'}` : ''} · {t.media.length} attachment{t.media.length === 1 ? '' : 's'}
              </p>
              {t.status === 'active' && (
                <p className={`mt-1 text-xs font-medium ${t.daysLeft ? 'text-[#c2410c]' : 'text-[#15803d]'}`}>
                  {t.daysLeft ? `Can be removed in ${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'}` : 'Ready to remove or repost'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn c="w" onClick={() => setDetail(t)}>View</Btn>
              <Btn c="w" onClick={() => setEdit(t)}>Edit</Btn>
              {t.status === 'active' ? (
                <>
                  <Btn c="gr" onClick={() => window.confirm('Mark this item as returned to its owner?') && act(() => api(`/api/trends/${t.id}/returned`, 'PATCH'), 'Marked as returned.')}>Returned</Btn>
                  <Btn c="or" disabled={t.daysLeft > 0} title={t.daysLeft > 0 ? `Available in ${t.daysLeft} day(s)` : ''}
                    onClick={() => window.confirm('Take this post off the board?') && act(() => api(`/api/trends/${t.id}/remove`, 'PATCH'), 'Removed from the board. You can repost it any time.')}>Remove</Btn>
                </>
              ) : (
                <>
                  <Btn onClick={() => act(() => api(`/api/trends/${t.id}/repost`, 'PATCH'), 'Reposted. It is back on the home page.')}>Repost</Btn>
                  <Btn c="or" onClick={() => window.confirm('Delete this post and its files for good?') && act(() => api(`/api/trends/${t.id}`, 'DELETE'), 'Deleted.')}>Delete</Btn>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      <ListEditor title="Categories" sub="You set the categories. Pick one for every post, and visitors filter the board by them." items={cats}
        onSave={(l) => act(async () => { const r = await api('/api/trends/categories', 'PUT', { list: l }); setCats(r.list); }, 'Categories saved.')} />

      {detail && <TrendDetail item={detail} onClose={() => setDetail(null)} />}
      {edit && (
        <Modal title="Edit post" onClose={() => setEdit(null)} wide>
          <TrendForm initial={edit} cats={cats} user={user} onSubmit={update} onCancel={() => setEdit(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ================================================================== */
/* 10. PROFILE (every role)                                            */
/* ================================================================== */

function Profile() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api('/api/profile').then(setP).catch((e) => setErr(e.message)); }, []);

  if (err) return <Alert>{err}</Alert>;
  if (!p) return <Empty>Loading your profile…</Empty>;

  const details = [
    ['Email', p.email || 'Not set'],
    ['Role', ROLE_LABEL[p.role] || p.role],
    ...(p.comm && p.role !== 'admin' ? [['Extra role', 'Minister of Communication']] : []),
    ...(p.role === 'student'
      ? [['Class', p.cls || 'Not set'], ['Combination', p.combo || 'None'], ...(p.section ? [['Section', p.section]] : [])]
      : []),
  ];
  const s = p.stats;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-x-6">
      <Card>
        <div className="flex flex-col items-center text-center">
          <Avatar name={p.name} picture={p.picture} className="h-20 w-20 text-xl" />
          <h2 className="mt-4 text-base font-bold">{p.name}</h2>
          <span className="mt-2 rounded-[4px] bg-[#f97316]/10 px-3 py-1 text-[11px] font-semibold text-[#c2410c]">{ROLE_LABEL[p.role] || p.role}</span>
        </div>
        <dl className="mt-6 divide-y divide-black/10 text-xs">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3">
              <dt className="text-black/50">{k}</dt>
              <dd className="font-medium text-right break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div>
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Tile v={s.total} t={p.role === 'student' ? 'Applications' : 'Bookings made'} />
            <Tile v={s.approved} t="Approved" tone="gr" />
            <Tile v={s.pending} t="Waiting" tone="or" />
            <Tile v={s.present} t="Attended" tone="gr" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* 11. DASHBOARD SHELL: sidebar + page                                 */
/* ================================================================== */

function NavItem({ name, active, onClick, dark }) {
  const look = active
    ? 'bg-[#f97316] text-white'
    : dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 bg-white border border-black/10';
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-xs font-semibold whitespace-nowrap ${look}`}>
      <Icon n={name} />{name}
    </button>
  );
}

function Dashboard({ user, opts, onLogout, onRefreshMe }) {
  // Admins get every tab (including Lost & Found). Anyone the admin named Minister of Communication
  // keeps their normal page (booking labs) and gets a Lost & Found page on top of it.
  const items = user.role === 'admin'
    ? [...ADMIN_TABS, 'Profile']
    : [user.role === 'student' ? 'My labs' : 'Bookings', ...(user.comm ? ['Lost & Found'] : []), 'Profile'];
  const [picked, setPage] = useState(items[0]);
  const page = items.includes(picked) ? picked : items[0];
  const Main = user.role === 'admin' ? Admin : user.role === 'student' ? Student : Teacher;
  useLive({ 'me:update': onRefreshMe });

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#0b0f1a] text-[13px] lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen flex-col bg-[#0b0f1a] p-5">
        <Logo light />
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {items.map((x) => <NavItem key={x} name={x} dark active={page === x} onClick={() => setPage(x)} />)}
        </nav>
        <div className="mt-4 rounded-[6px] bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} picture={user.picture} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[11px] text-white/50">{user.comm && user.role !== 'admin' ? 'Minister of Communication' : ROLE_LABEL[user.role] || user.role}</div>
            </div>
          </div>
          <button type="button" onClick={onLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white">
            <Icon n="Logout" />Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden bg-white border-b border-black/10">
          <div className="px-4 h-14 flex items-center justify-between">
            <Logo />
            <Btn c="w" onClick={onLogout}>Log out</Btn>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Main">
            {items.map((x) => (
              <div key={x} className="shrink-0"><NavItem name={x} active={page === x} onClick={() => setPage(x)} /></div>
            ))}
          </nav>
        </header>

        <main className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
          <div className="mb-6 flex items-center gap-3">
            <Avatar name={user.name} picture={user.picture} className="h-10 w-10 text-xs" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">{page}</h1>
              <p className="mt-0.5 text-xs text-black/50">Signed in as {user.name}{user.email ? ` · ${user.email}` : ''}</p>
            </div>
          </div>
          {page === 'Profile' ? <Profile />
            : page === 'Lost & Found' ? <TrendsManager user={user} opts={opts} />
            : <Main user={user} opts={opts} tab={page} />}
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 12. ROOT: landing -> Google login -> dashboard                      */
/* ================================================================== */

export default function Home() {
  const [view, setView] = useState('home'); // 'home' | 'login' | 'app'
  const [user, setUser] = useState(null);
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [booting, setBooting] = useState(!!getToken());

  const loadOpts = () =>
    api('/api/options').then((o) => setOpts({ ...EMPTY_OPTS, ...o })).catch(() => {});
  // Re-reads who I am, so a newly named Minister of Communication sees the Lost & Found page without logging in again.
  const refreshMe = () => api('/api/me').then(setUser).catch(() => {});

  useEffect(() => {
    loadOpts();
    if (getToken()) // restore the session after a refresh
      api('/api/me')
        .then((u) => { setUser(u); setView('app'); })
        .catch(() => setToken(''))
        .finally(() => setBooting(false));
  }, []);

  // Google login hands over a JWT.
  const handleAuth = async (t) => {
    setToken(t);
    await loadOpts();
    setUser(await api('/api/me'));
    setView('app');
  };
  const logout = () => { setToken(''); setUser(null); setView('home'); };

  if (booting) return null;
  if (view === 'app' && user) return <Dashboard user={user} opts={opts} onLogout={logout} onRefreshMe={refreshMe} />;
  if (view === 'login') return <Auth onDone={handleAuth} onBack={() => setView('home')} />;
  return <Landing onLogin={() => setView('login')} categories={catsOf(opts)} />;
}