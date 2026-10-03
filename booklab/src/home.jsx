import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import logo from './assets/as.png';
import front from './assets/front.jpg';
import milker from './assets/milker.jpg';
import minister from './assets/minister.jpg';

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

/* ================================================================== */
/* 1. PHOTOS, SLIDESHOW AND SCROLL REVEAL                              */
/* ================================================================== */

const PHOTOS = [
  { src: front, alt: 'The school computer lab' },
  { src: milker, alt: 'Inside the lab' },
  { src: minister, alt: 'Lab staff' },
];
const C = { ink: '#0b0f1a', or: '#f97316', gr: '#16a34a', grid: '#e5e7eb', mute: '#94a3b8' };

// Shows a photo, or a plain gradient if the picture cannot load.
const Photo = ({ src, alt, className = '', style }) => {
  const [bad, setBad] = useState(false);
  if (bad) return <div role="img" aria-label={alt} style={style} className={`bg-gradient-to-br from-[#0b0f1a] to-[#16a34a] ${className}`} />;
  return <img src={src} alt={alt} style={style} onError={() => setBad(true)} className={`object-cover ${className}`} />;
};

const ORIGINS = ['20% 30%', '80% 70%', '50% 15%', '15% 80%'];

// Photos cross-fade while the visible one slowly zooms in (Ken Burns). Click a bar to jump to a photo.
function Slideshow({ images = PHOTOS, interval = 5500, start = 0, bars = false, className = '' }) {
  const [i, setI] = useState(start % images.length);
  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % images.length), interval);
    return () => clearTimeout(t);
  }, [i, images.length, interval]);
  return (
    <div className={`relative overflow-hidden bg-[#0b0f1a] ${className}`}>
      {images.map((im, k) => {
        const on = k === i;
        return (
          <Photo
            key={im.alt + k}
            src={im.src}
            alt={im.alt}
            className="absolute inset-0 h-full w-full"
            style={{
              opacity: on ? 1 : 0,
              transform: on ? 'scale(1.16) translate(-1.5%, -1%)' : 'scale(1)',
              transformOrigin: ORIGINS[k % ORIGINS.length],
              transition: `opacity 1.4s ease, transform ${on ? interval + 1800 : 1400}ms ease-out`,
            }}
          />
        );
      })}
      {bars && (
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          {images.map((im, k) => (
            <button key={k} type="button" aria-label={`Show photo ${k + 1}`} onClick={() => setI(k)}
              className="h-1 overflow-hidden rounded-[2px] bg-white/40" style={{ width: k === i ? 40 : 18, transition: 'width .4s ease' }}>
              {k === i && <span key={i} className="block h-full bg-[#f97316]" style={{ animation: `fill ${interval}ms linear forwards` }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Fades and slides a block in once, when it first scrolls into view.
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={{ opacity: on ? 1 : 0, transform: on ? 'none' : 'translateY(26px)', transition: `opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

const AnimStyles = () => (
  <style>{`
    @keyframes fill { from { width: 0 } to { width: 100% } }
    @keyframes floaty { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `}</style>
);

/* ================================================================== */
/* 2. SCHOOL RULES                                                     */
/* A class is a grade + a combination + an optional section letter.    */
/* ================================================================== */

const COMBOS_S4_S5 = ['MSI', 'MSII', 'ART', 'HUMANITIES'];
const COMBOS_S6 = ['MPC', 'PCB', 'HGL', 'MEG'];
const ALL_COMBOS = [...COMBOS_S4_S5, ...COMBOS_S6];
const DEFAULT_GRADES = ['S4', 'S5', 'S6'];
const DEFAULT_GRADE_COMBOS = { S4: COMBOS_S4_S5, S5: COMBOS_S4_S5, S6: COMBOS_S6 };
const SECTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const gradesOf = (opts) => (opts.grades?.length ? opts.grades : DEFAULT_GRADES);
const combosFor = (opts, grade) => opts.gradeCombos?.[grade] ?? DEFAULT_GRADE_COMBOS[grade] ?? [];
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
const today = () => new Date().toISOString().slice(0, 10);
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
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
};
ICONS['My labs'] = ICONS.Labs;
ICONS.Bookings = ICONS.Labs;

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

const Empty = ({ children }) => <p className="py-6 text-center text-xs text-black/50">{children}</p>;

const Logo = ({ light }) => (
  <div className={`inline-flex items-center gap-3 text-base font-extrabold tracking-tight ${light ? 'text-white' : 'text-[#111827]'}`}>
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[6px] bg-white">
      <img src={logo} alt="LabBook logo" className="h-7 w-7 object-contain" />
    </span>
    <span className="leading-none">Lab<span className="text-[#16a34a]">Book</span></span>
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
    return <img src={srcs[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)} className={`shrink-0 rounded-[6px] bg-black/10 object-cover ${className}`} />;
  }
  return <span className={`grid shrink-0 place-items-center rounded-[6px] bg-[#0b0f1a] font-bold text-white ${className}`}>{initials(name)}</span>;
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

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
/* 4. LANDING PAGE                                                     */
/* ================================================================== */

const NAV = [['services', 'Services'], ['lab', 'The lab'], ['how', 'How it works'], ['team', 'Team'], ['faq', 'FAQ']];
const HERO_POINTS = ['Live seat counts', 'Fair approvals', 'Attendance reports'];
const STATS = [['Live', 'seat counts'], ['3 roles', 'students, staff, admins'], ['Google', 'secure sign in'], ['Full', 'attendance history']];

const SERVICES = [
  { title: 'Online lab booking', text: 'Reserve a seat from any device and see what is open before you apply.', theme: 'dark', span: 'md:col-span-2' },
  { title: 'Live seat counts', text: 'Seats update instantly, so nobody is turned away at the door.', theme: 'light' },
  { title: 'Class bookings', text: 'Teachers book a whole class or chosen students in one step.', theme: 'light' },
  { title: 'Attendance tracking', text: 'Mark attendance and spot repeated absences early.', theme: 'green' },
  { title: 'Full lab history', text: 'Search any day and lab to see who came and who was absent.', theme: 'light' },
];
const CARD_THEMES = {
  dark: { box: 'bg-[#0b0f1a] text-white', text: 'text-white/75' },
  green: { box: 'bg-[#16a34a] text-white', text: 'text-white/80' },
  light: { box: 'bg-white', text: 'text-black/60' },
};

const STEPS = [
  ['Get your account', 'Your school admin adds your Google email, so only you can sign in as you.'],
  ['Find an open lab', 'Browse published lab times and check the seats left in real time.'],
  ['Apply and attend', 'Choose a reason, get approved and show up. Attendance is recorded.'],
];
const TEAM = [
  ['Jean Habimana', 'Head of ICT', 'Sets lab schedules and approves requests.'],
  ['Alice Uwase', 'Computer Science Teacher', 'Books classes and guides practical sessions.'],
  ['Eric Niyonzima', 'Psychosocial Worker', 'Supports students and books lab time for them.'],
];
const FAQ = [
  ['How do I get an account?', 'You do not sign up yourself. The school adds every student and teacher using their Google email.'],
  ['How do I log in?', 'Press Continue with Google and choose the Google account the school has on record for you. There is no password to share.'],
  ['Who can book a lab?', 'Students apply for themselves. Teachers and psychosocial workers can book for a class or chosen students.'],
  ['What if a lab is full?', 'Apply is disabled when no seats remain, and admins can move students between labs.'],
  ['Can I book the same lab twice?', 'No. Each student can hold only one booking per lab time, and bookings that overlap are blocked.'],
  ['Can booking access be removed?', 'Yes. Admins can blacklist a student who misuses lab time.'],
];

const WRAP = 'max-w-6xl mx-auto px-6';

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

function Hero({ onLogin }) {
  return (
    <section className={`${WRAP} pt-12 pb-24 grid lg:grid-cols-2 gap-16 items-center`}>
      <div>
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-[6px] border border-black/10 px-3 py-1.5 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-[2px] bg-[#16a34a]" />Now taking lab bookings
          </span>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="mt-6 text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
            Book your lab seat in <span className="text-[#f97316]">seconds.</span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-6 text-sm text-black/60 max-w-md leading-relaxed">
            A modern way to run your school's computer labs. Publish schedules, take bookings,
            approve fairly and track attendance, all in one place.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Btn className="!px-7 !py-3" onClick={onLogin}>Continue with Google</Btn>
            <span className="text-xs text-black/50">Accounts are created by your school admin.</span>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-xs font-medium text-black/70">
            {HERO_POINTS.map((p) => <li key={p}><span className="text-[#16a34a] font-bold mr-2">✓</span>{p}</li>)}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={250}>
        <div className="relative pb-4">
          <div className="overflow-hidden rounded-[6px] border border-black/10 shadow-lg">
            <Slideshow bars className="h-[420px] w-full" />
          </div>
          <div className="absolute left-3 bottom-0 flex items-center gap-3 rounded-[6px] border border-black/5 bg-white px-4 py-3 text-xs font-semibold shadow-md" style={{ animation: 'floaty 5s ease-in-out infinite' }}>
            <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-[#16a34a] text-white">✓</span>
            <span>Booking approved<br /><span className="font-normal text-black/50">Lab 1 · 14:00</span></span>
          </div>
          <div className="absolute right-3 top-4 flex items-center gap-3 rounded-[6px] border border-black/5 bg-white px-4 py-3 text-xs font-semibold shadow-md" style={{ animation: 'floaty 6s ease-in-out 1s infinite' }}>
            <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-[#f97316] text-white">4</span>
            <span>seats left<br /><span className="font-normal text-black/50">updating live</span></span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="bg-[#0b0f1a] text-white">
      <div className={`${WRAP} py-10 grid grid-cols-2 md:grid-cols-4 gap-8`}>
        {STATS.map(([a, b], i) => (
          <Reveal key={a} delay={i * 90}>
            <div className="text-xl font-bold text-[#f97316]">{a}</div>
            <div className="text-xs text-white/60 mt-1">{b}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className={`${WRAP} py-24`}>
      <Reveal><Heading title="Everything a school lab needs, without the paperwork." className="max-w-xl" /></Reveal>
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {SERVICES.map(({ title, text, theme, span = '' }, i) => {
          const t = CARD_THEMES[theme];
          return (
            <Reveal key={title} delay={i * 80} className={span}>
              <div className={`h-full min-h-[160px] flex flex-col justify-end rounded-[6px] border border-black/10 p-6 ${t.box}`}>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className={`mt-2 text-xs leading-relaxed ${t.text}`}>{text}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function InsideLab() {
  const second = [PHOTOS[2], PHOTOS[0], PHOTOS[1]];
  return (
    <section id="lab" className={`${WRAP} pb-24 grid lg:grid-cols-2 gap-16 items-center`}>
      <Reveal>
        <div className="relative pb-12 pr-12">
          <Slideshow images={[PHOTOS[1], PHOTOS[0], PHOTOS[2]]} interval={6000} className="h-[400px] w-full rounded-[6px] border border-black/10" />
          <Slideshow images={second} interval={4200} start={1} className="absolute bottom-0 right-0 h-44 w-52 rounded-[6px] border-4 border-white shadow-lg" />
        </div>
      </Reveal>
      <Reveal delay={150}>
        <h2 className="text-2xl font-bold tracking-tight">Less queueing. More learning.</h2>
        <p className="mt-4 text-sm text-black/60 leading-relaxed">
          Every seat is accounted for. Students arrive knowing they have a computer, teachers
          know who is attending, and admins see how each lab is used.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {ALL_COMBOS.map((c) => <span key={c} className="rounded-[6px] border border-black/15 px-3 py-1.5 text-xs font-medium">{c}</span>)}
        </div>
        <p className="mt-3 text-xs text-black/50">Senior 4 and 5: {COMBOS_S4_S5.join(', ')}. Senior 6: {COMBOS_S6.join(', ')}.</p>
      </Reveal>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-black/[0.03]">
      <div className={`${WRAP} py-24`}>
        <Reveal><Heading title="Three steps from account to seat." /></Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} delay={i * 100}>
              <div className="h-full rounded-[6px] border border-black/5 bg-white p-6">
                <div className="text-3xl font-bold text-[#16a34a]">{i + 1}</div>
                <h3 className="mt-4 text-sm font-semibold">{t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-black/60">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team() {
  return (
    <section id="team" className={`${WRAP} py-24`}>
      <Reveal><Heading title="The people behind the labs." /></Reveal>
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {TEAM.map(([name, role, text], i) => (
          <Reveal key={name} delay={i * 100}>
            <div className="h-full rounded-[6px] border border-black/10 p-6">
              <Avatar name={name} className="h-14 w-14 text-sm" />
              <h3 className="mt-4 text-sm font-semibold">{name}</h3>
              <div className="mt-1 text-xs font-medium text-[#f97316]">{role}</div>
              <p className="mt-3 text-xs leading-relaxed text-black/60">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="max-w-2xl mx-auto px-6 pb-24">
      <h2 className="text-2xl font-bold tracking-tight mb-6">Questions</h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="border-b border-black/10 py-4">
          <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
          <p className="mt-3 text-xs leading-relaxed text-black/60">{a}</p>
        </details>
      ))}
    </section>
  );
}

function CallToAction({ onLogin }) {
  return (
    <section className="px-6 pb-20">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[6px] text-white">
          <Slideshow images={[PHOTOS[2], PHOTOS[0], PHOTOS[1]]} interval={6500} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-[#0b0f1a]/80" />
          <div className="relative flex flex-wrap items-center justify-between gap-8 px-8 py-16 md:px-14">
            <h2 className="max-w-md text-2xl font-bold tracking-tight">Ready to book your next lab session?</h2>
            <Btn c="or" className="!px-7 !py-3" onClick={onLogin}>Continue with Google</Btn>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Landing({ onLogin }) {
  return (
    <div className="bg-white text-[#0b0f1a] antialiased text-sm">
      <AnimStyles />
      <Header onLogin={onLogin} />
      <Hero onLogin={onLogin} />
      <StatsBar />
      <Services />
      <InsideLab />
      <HowItWorks />
      <Team />
      <Faq />
      <CallToAction onLogin={onLogin} />
      <footer className={`${WRAP} py-10 flex flex-wrap justify-between items-center gap-4 text-xs text-black/50 border-t border-black/10`}>
        <Logo />
        <span>© 2026 Computer Lab Management System</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 5. LOGIN: Google only (the admin creates every account)             */
/* ================================================================== */

const EMPTY_OPTS = { grades: [], gradeCombos: {}, classes: [], combos: [], clubs: [], staffRoles: [], families: [], reasons: [] };

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

function Auth({ onDone, onBack }) {
  const [err, setErr] = useState('');
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen grid lg:grid-cols-[2fr_3fr] bg-white text-[13px] text-[#0b0f1a]">
      <AnimStyles />
      <aside className="relative hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <Slideshow interval={5000} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-[#0b0f1a]/50 to-[#0b0f1a]/10" />
        <div className="relative h-full flex flex-col justify-between p-10 text-white">
          <Logo light />
          <div className="max-w-sm space-y-3">
            <h2 className="text-2xl font-bold leading-tight tracking-tight">Your seat is waiting.</h2>
            <p className="text-xs text-white/75 leading-relaxed">Book a computer and see seats left in real time.</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto px-6 py-8">
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
  const [q, setQ] = useState('');
  const [view, setView] = useState('open');
  const [ast, setAst] = useState('all');

  const loadApps = () => api('/api/apps').then(setApps).catch((e) => setMsg(e.message));
  useEffect(() => { api('/api/sessions').then(setSessions).catch((e) => setMsg(e.message)); loadApps(); }, []);
  useLive({ seats: setSessions, 'applications:update': loadApps });

  const apply = async (id) => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: id, reason });
      setMsg(r.created ? '' : 'You already have a booking at this lab time.');
    } catch (e) { setMsg(e.message); }
  };
  const mine = (id) => apps.find((a) => a.sid === id && a.status !== 'rejected');
  const n = (k) => apps.filter((a) => a.status === k).length;

  const labs = sessions.filter((s) => match(q, s.lab, s.date, s.from) && (view === 'all' || s.left > 0));
  const myApps = apps.filter((a) => (ast === 'all' || a.status === ast) && match(q, a.lab, a.date, a.reason));

  return (
    <div>
      {msg && <Alert>{msg}</Alert>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Tile v={apps.length} t="Applications" />
        <Tile v={n('approved')} t="Approved" tone="gr" />
        <Tile v={n('pending')} t="Waiting" tone="or" />
        <Tile v={apps.filter((a) => a.att === 'present').length} t="Times attended" tone="gr" />
      </div>

      <Card t="Open labs" sub="Seat counts update live while you look.">
        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <Field l="Search lab or date"><SearchBox value={q} onChange={setQ} placeholder="Lab 1, 2026-10-05..." /></Field>
          <Field l="Reason for booking"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Pills value={view} onChange={setView} items={[['open', 'With seats'], ['all', 'All labs']]} />
        </div>
        {labs.length === 0 && <Empty>{sessions.length ? 'No lab matches your search.' : 'No labs are open yet. Check back after the admin posts a schedule.'}</Empty>}
        {labs.map((s) => {
          const pct = s.seats ? ((s.seats - s.left) / s.seats) * 100 : 100;
          return (
            <div key={s.id} className="flex justify-between items-center border-t border-black/10 py-4 gap-4">
              <div className="min-w-0 flex-1">
                <b>{s.lab}</b>
                <span className="text-black/60"> · {s.date} · {s.from}–{s.to}</span>
                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-[3px] bg-black/10">
                  <div className={`h-full ${s.left > 0 ? 'bg-[#16a34a]' : 'bg-[#f97316]'}`} style={{ width: pct + '%' }} />
                </div>
                <div className={`mt-1.5 text-xs ${s.left > 0 ? 'text-[#15803d] font-medium' : 'text-[#c2410c] font-bold'}`}>
                  {s.left > 0 ? `${s.left} of ${s.seats} seats left` : 'Full'}
                </div>
              </div>
              {mine(s.id)
                ? <Badge s={mine(s.id).status} />
                : <Btn disabled={s.left < 1} onClick={() => apply(s.id)}>Apply</Btn>}
            </div>
          );
        })}
      </Card>

      <Card t="My applications" action={<Pills value={ast} onChange={setAst} items={[['all', 'All', apps.length], ['pending', 'Waiting', n('pending')], ['approved', 'Approved', n('approved')], ['rejected', 'Rejected', n('rejected')]]} />}>
        {myApps.length === 0 && <Empty>{apps.length ? 'No application matches.' : 'You have not applied yet. Pick an open lab above.'}</Empty>}
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
        <Field l="Section (optional)" hint="Letter A to Z. Leave empty if the class is a single stream.">
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

  const classNames = [...new Set(users.filter((u) => u.role === 'student' && u.className).map((u) => u.className))].sort();
  const shown = users.filter((u) => (rf === 'all' || u.role === rf) && (cf === 'all' || u.className === cf) && match(q, u.name, u.email, u.className));
  const count = (r) => users.filter((u) => u.role === r).length;

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

      <Card t="All accounts" sub={`${count('student')} students · ${count('teacher')} teachers · ${count('psychosocial')} psychosocial workers`}>
        <div className="grid md:grid-cols-[1fr_180px_180px] gap-3 mb-4">
          <SearchBox value={q} onChange={setQ} />
          <Sel o={[{ v: 'all', t: 'All roles' }, ...ROLE_CHOICES.map((r) => ({ v: r, t: ROLE_LABEL[r] }))]} value={rf} onChange={(e) => setRf(e.target.value)} />
          <Sel o={[{ v: 'all', t: 'All classes' }, ...classNames]} value={cf} onChange={(e) => setCf(e.target.value)} />
        </div>
        <p className="mb-2 text-xs text-black/50">{shown.length} shown</p>
        {shown.length === 0 && <Empty>No accounts match.</Empty>}
        {shown.map((u) => (
          <Row key={u.id}>
            <Person p={u} className="h-10 w-10 text-xs" />
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold">
                {u.role === 'student' ? (u.className || 'No class') : ROLE_LABEL[u.role]}
              </span>
              <Btn c="w" onClick={() => openEdit(u)}>Edit</Btn>
              <Btn c="or" onClick={() => window.confirm(`Delete the account of ${u.name}?`) && act(() => api(`/api/users/${u.id}`, 'DELETE'))}>Delete</Btn>
            </span>
          </Row>
        ))}
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

function AttendanceTab({ apps, labs, absent, act }) {
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
  const markMany = (list, att) => act(() => api('/api/apps/bulk-attendance', 'PATCH', { ids: list.map((a) => a.id), att }));
  const c = attCounts(shown);
  const absRows = Object.entries(absent).filter(([n, r]) => match(aq, n, r.email, r.cls)).sort((a, b) => b[1].absent - a[1].absent);

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
                    <td className="py-2.5"><Person p={{ name: n, ...r }} className="h-8 w-8 text-[10px]" /></td>
                    <td>{r.cls}</td>
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

function HistoryTab({ labs }) {
  const [f, setF] = useState({ from: today(), to: today(), labId: '', cls: '', status: 'approved', att: 'all', q: '' });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const range = (from, to) => setF((p) => ({ ...p, from, to }));

  // Day range and lab are asked from the server; everything else filters instantly on screen.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api(`/api/history?${new URLSearchParams({ from: f.from, to: f.to, labId: f.labId })}`)
        .then((r) => { setRows(r); setErr(''); })
        .catch((e) => setErr(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [f.from, f.to, f.labId]);

  const classes = [...new Set(rows.map((a) => a.cls).filter(Boolean))].sort();
  const shown = rows.filter((a) =>
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
      {err && <Alert>{err}</Alert>}
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

      {loading && rows.length === 0 ? <Empty>Loading history…</Empty> : (
        <Groups rows={shown} desc empty="Nothing matches. Try another day, lab or status."
          meta={(g) => { const k = attCounts(g.rows); return `${g.rows.length} students · ${k.present} attended · ${k.absent} absent · ${k.none} not marked`; }}
          classActions={(list) => { const k = attCounts(list); return <span className="text-[11px] text-black/60"><b className="text-[#15803d]">{k.present}</b> attended · <b className="text-red-600">{k.absent}</b> absent · {k.none} not marked</span>; }}
          row={(a) => (<><Person p={a} /><span className="flex items-center gap-2"><span className="text-black/60">{a.reason}</span><Badge s={a.status} /><AttBadge att={a.att} /></span></>)} />
      )}
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
                <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-[#0b0f1a] text-xs font-bold text-white">{g}</span>
                <div>
                  <div className="text-xs font-semibold">Grade {g}</div>
                  <div className="text-[11px] text-black/50">
                    {full[g].length ? `${full[g].length} combination${full[g].length === 1 ? '' : 's'}` : 'No combinations'}
                  </div>
                </div>
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
  const bulk = (ids, status) => act(async () => {
    const r = await api('/api/apps/bulk-status', 'PATCH', { ids, status });
    if (r.full) throw new Error(`${r.changed} updated. ${r.full} could not be approved because the lab is full.`);
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
      {tab === 'Attendance' && <AttendanceTab apps={apps} labs={labs} absent={absent} act={act} />}
      {tab === 'History' && <HistoryTab labs={labs} />}
      {tab === 'Settings' && <SettingsTab opts={opts} saveList={saveList} saveSetup={saveSetup} rename={rename} />}
    </div>
  );
}

/* ================================================================== */
/* 9. PROFILE (every role)                                             */
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
/* 10. DASHBOARD SHELL: sidebar + page                                 */
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

function Dashboard({ user, opts, onLogout }) {
  const items = user.role === 'admin'
    ? [...ADMIN_TABS, 'Profile']
    : [user.role === 'student' ? 'My labs' : 'Bookings', 'Profile'];
  const [page, setPage] = useState(items[0]);
  const Main = user.role === 'admin' ? Admin : user.role === 'student' ? Student : Teacher;

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
              <div className="text-[11px] text-white/50">{ROLE_LABEL[user.role] || user.role}</div>
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
          {page === 'Profile' ? <Profile /> : <Main user={user} opts={opts} tab={page} />}
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 11. ROOT: landing -> Google login -> dashboard                      */
/* ================================================================== */

export default function Home() {
  const [view, setView] = useState('home'); // 'home' | 'login' | 'app'
  const [user, setUser] = useState(null);
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [booting, setBooting] = useState(!!getToken());

  const loadOpts = () =>
    api('/api/options').then((o) => setOpts({ ...EMPTY_OPTS, ...o })).catch(() => {});

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
  if (view === 'app' && user) return <Dashboard user={user} opts={opts} onLogout={logout} />;
  if (view === 'login') return <Auth onDone={handleAuth} onBack={() => setView('home')} />;
  return <Landing onLogin={() => setView('login')} />;
}