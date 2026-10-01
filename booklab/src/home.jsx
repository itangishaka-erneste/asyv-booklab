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
/* 1. PHOTOS (your own pictures from src/assets)                       */
/* ================================================================== */

const IMG = { hero: front, lab1: milker, lab2: minister, auth: front, cta: minister };
const C = { ink: '#0b0f1a', or: '#f97316', gr: '#16a34a', grid: '#e5e7eb', mute: '#94a3b8' };

// Shows a photo, or a soft gradient if the picture cannot load.
const Photo = ({ src, alt, className = '' }) => {
  const [bad, setBad] = useState(false);
  if (bad) {
    return <div role="img" aria-label={alt} className={`bg-gradient-to-br from-[#0b0f1a] to-[#16a34a] ${className}`} />;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setBad(true)} className={`object-cover ${className}`} />;
};

/* ================================================================== */
/* 2. SCHOOL RULES: a class is a grade + a combination ("S6 PCB")      */
/* ================================================================== */

const COMBOS_S4_S5 = ['MSI', 'MSII', 'ART', 'HUMANITIES'];
const COMBOS_S6 = ['MPC', 'PCB', 'HGL', 'MEG'];
const ALL_COMBOS = [...COMBOS_S4_S5, ...COMBOS_S6];
const DEFAULT_GRADES = ['S4', 'S5', 'S6'];

const levelOf = (grade) => (String(grade || '').match(/[456]/) || [])[0]; // "S4" -> "4"
const combosFor = (grade) => (levelOf(grade) === '6' ? COMBOS_S6 : levelOf(grade) ? COMBOS_S4_S5 : []);
const studentGrades = (opts) => {
  const g = opts.grades.filter(levelOf);
  return g.length ? g : DEFAULT_GRADES;
};
// Every real class: S4 MSI, S4 MSII ... S6 MEG. No A / B / C sections.
const classesFor = (opts) =>
  studentGrades(opts).flatMap((g) => combosFor(g).map((c) => ({ v: `${g}|${c}`, t: `${g} ${c}`, grade: g, combo: c })));
const parseClass = (v) => { const [grade, combo] = String(v || '').split('|'); return { grade, combo }; };

/* ================================================================== */
/* 3. SMALL UI KIT                                                     */
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
    className={`w-full px-3 py-2 text-xs rounded-[6px] border border-black/25 bg-white focus:outline-none focus:border-[#0b0f1a] focus:ring-2 focus:ring-[#0b0f1a]/10 ${className}`}
    {...p}
  />
);

const Sel = ({ o = [], className = '', ...p }) => (
  <select className={`w-full px-2.5 py-2 text-xs rounded-[6px] border border-black/25 bg-white focus:outline-none focus:border-[#0b0f1a] ${className}`} {...p}>
    {o.map((x) => {
      const v = x.v ?? x;
      const t = x.t ?? x;
      return <option key={v} value={v}>{t}</option>;
    })}
  </select>
);

const Card = ({ t, sub, action, children }) => (
  <section className="rounded-xl border border-black/10 bg-white p-6 mb-6">
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
    className={`rounded-lg border px-4 py-3 mb-5 text-xs font-medium ${
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
};
const Badge = ({ s }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${BADGE[s] || 'bg-black/5 text-black/60'}`}>{s}</span>
);

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
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white">
      <img src={logo} alt="LabBook logo" className="h-7 w-7 object-contain" />
    </span>
    <span className="leading-none">
      Lab<span className="text-[#16a34a]">Book</span>
    </span>
  </div>
);

const initials = (name) => String(name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const Avatar = ({ name, className = 'h-10 w-10 text-xs' }) => (
  <span className={`grid shrink-0 place-items-center rounded-full bg-[#0b0f1a] font-bold text-white ${className}`}>{initials(name)}</span>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="text-xl leading-none text-black/50 hover:text-black">×</button>
      </div>
      {children}
    </div>
  </div>
);

/* ================================================================== */
/* 4. LANDING PAGE                                                     */
/* ================================================================== */

const NAV = [['services', 'Services'], ['lab', 'The lab'], ['how', 'How it works'], ['team', 'Team'], ['faq', 'FAQ']];
const HERO_POINTS = ['Live seat counts', 'Fair approvals', 'Attendance reports'];
const STATS = [['Live', 'seat counts'], ['3 roles', 'students, staff, admins'], ['1 tap', 'to apply'], ['Full', 'attendance history']];

const SERVICES = [
  { title: 'Online lab booking', text: 'Reserve a seat from any device and see what is open before you apply.', theme: 'dark', span: 'md:col-span-2' },
  { title: 'Live seat counts', text: 'Seats update instantly, so nobody is turned away at the door.', theme: 'light' },
  { title: 'Class bookings', text: 'Teachers book a whole class or chosen students in one step.', theme: 'light' },
  { title: 'Attendance tracking', text: 'Mark attendance and spot repeated absences early.', theme: 'green' },
  { title: 'Full lab history', text: 'Look back at who used which lab on any day.', theme: 'light' },
];
const CARD_THEMES = {
  dark: { box: 'bg-[#0b0f1a] text-white', text: 'text-white/75' },
  green: { box: 'bg-[#16a34a] text-white', text: 'text-white/80' },
  light: { box: 'bg-white', text: 'text-black/60' },
};

const STEPS = [
  ['Get your account', 'Your school admin creates your account and gives you your email and password.'],
  ['Find an open lab', 'Browse published lab times and check the seats left in real time.'],
  ['Apply and attend', 'Choose a reason, get approved and show up. Attendance is recorded.'],
];
const TEAM = [
  ['Jean Habimana', 'Head of ICT', 'Sets lab schedules and approves requests.'],
  ['Alice Uwase', 'Computer Science Teacher', 'Books classes and guides practical sessions.'],
  ['Eric Niyonzima', 'Psychosocial Worker', 'Supports students and books lab time for them.'],
];
const FAQ = [
  ['How do I get an account?', 'You do not sign up yourself. The school admin creates your account and gives you your email and password.'],
  ['How do I log in?', 'Use the email and password the admin gave you. If the admin used your Google email, you can also continue with Google. You can change your password from your profile.'],
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
          {NAV.map(([h, t]) => (
            <a key={h} href={`#${h}`} className="px-3 py-2 rounded-[6px] hover:bg-black/5">{t}</a>
          ))}
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
        <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          Now taking lab bookings
        </span>
        <h1 className="mt-6 text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
          Book your lab seat in <span className="text-[#f97316]">seconds.</span>
        </h1>
        <p className="mt-6 text-sm text-black/60 max-w-md leading-relaxed">
          A modern way to run your school's computer labs. Publish schedules, take bookings,
          approve fairly and track attendance, all in one place.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Btn className="!px-7 !py-3" onClick={onLogin}>Log in to your account</Btn>
          <span className="text-xs text-black/50">Accounts are created by your school admin.</span>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-xs font-medium text-black/70">
          {HERO_POINTS.map((p) => (
            <li key={p}><span className="text-[#16a34a] font-bold mr-2">✓</span>{p}</li>
          ))}
        </ul>
      </div>

      <div className="relative pb-4">
        <div className="rounded-xl border border-black/10 overflow-hidden shadow-lg">
          <Photo src={IMG.hero} alt="The school computer lab" className="h-[420px] w-full" />
        </div>
        <div className="absolute left-3 bottom-0 bg-white rounded-lg shadow-md border border-black/5 px-4 py-3 text-xs font-semibold flex items-center gap-3">
          <span className="w-7 h-7 rounded-md bg-[#16a34a] text-white grid place-items-center">✓</span>
          <span>Booking approved<br /><span className="text-black/50 font-normal">Lab 1 · 14:00</span></span>
        </div>
        <div className="absolute right-3 top-4 bg-white rounded-lg shadow-md border border-black/5 px-4 py-3 text-xs font-semibold flex items-center gap-3">
          <span className="w-7 h-7 rounded-md bg-[#f97316] text-white grid place-items-center">4</span>
          <span>seats left<br /><span className="text-black/50 font-normal">updating live</span></span>
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="bg-[#0b0f1a] text-white">
      <div className={`${WRAP} py-10 grid grid-cols-2 md:grid-cols-4 gap-8`}>
        {STATS.map(([a, b]) => (
          <div key={a}>
            <div className="text-xl font-bold text-[#f97316]">{a}</div>
            <div className="text-xs text-white/60 mt-1">{b}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className={`${WRAP} py-24`}>
      <Heading title="Everything a school lab needs, without the paperwork." className="max-w-xl" />
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {SERVICES.map(({ title, text, theme, span = '' }) => {
          const t = CARD_THEMES[theme];
          return (
            <div key={title} className={`rounded-xl p-6 min-h-[160px] flex flex-col justify-end border border-black/10 ${t.box} ${span}`}>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className={`mt-2 text-xs leading-relaxed ${t.text}`}>{text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InsideLab() {
  return (
    <section id="lab" className={`${WRAP} pb-24 grid lg:grid-cols-2 gap-16 items-center`}>
      <div className="relative pb-12 pr-12">
        <Photo src={IMG.lab1} alt="Inside the lab" className="h-[400px] w-full rounded-xl border border-black/10" />
        <Photo src={IMG.lab2} alt="Lab staff" className="absolute bottom-0 right-0 h-44 w-52 rounded-xl border-4 border-white shadow-lg" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Less queueing. More learning.</h2>
        <p className="mt-4 text-sm text-black/60 leading-relaxed">
          Every seat is accounted for. Students arrive knowing they have a computer, teachers
          know who is attending, and admins see how each lab is used.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {ALL_COMBOS.map((c) => (
            <span key={c} className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium">{c}</span>
          ))}
        </div>
        <p className="mt-3 text-xs text-black/50">Senior 4 and 5: {COMBOS_S4_S5.join(', ')}. Senior 6: {COMBOS_S6.join(', ')}.</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-black/[0.03]">
      <div className={`${WRAP} py-24`}>
        <Heading title="Three steps from account to seat." />
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="rounded-xl bg-white p-6 border border-black/5">
              <div className="text-3xl font-bold text-[#16a34a]">{i + 1}</div>
              <h3 className="mt-4 text-sm font-semibold">{t}</h3>
              <p className="mt-2 text-xs leading-relaxed text-black/60">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team() {
  return (
    <section id="team" className={`${WRAP} py-24`}>
      <Heading title="The people behind the labs." />
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {TEAM.map(([name, role, text]) => (
          <div key={name} className="rounded-xl border border-black/10 p-6">
            <Avatar name={name} className="h-14 w-14 text-sm" />
            <h3 className="mt-4 text-sm font-semibold">{name}</h3>
            <div className="mt-1 text-xs font-medium text-[#f97316]">{role}</div>
            <p className="mt-3 text-xs leading-relaxed text-black/60">{text}</p>
          </div>
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
      <div className="relative max-w-6xl mx-auto rounded-xl overflow-hidden text-white">
        <Photo src={IMG.cta} alt="School lab" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-[#0b0f1a]/80" />
        <div className="relative px-8 py-16 md:px-14 flex flex-wrap gap-8 justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight max-w-md">Ready to book your next lab session?</h2>
          <Btn c="or" className="!px-7 !py-3" onClick={onLogin}>Log in</Btn>
        </div>
      </div>
    </section>
  );
}

function Landing({ onLogin }) {
  return (
    <div className="bg-white text-[#0b0f1a] antialiased text-sm">
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
/* 5. LOGIN (no sign up: the admin creates every account)              */
/* ================================================================== */

const EMPTY_OPTS = { grades: [], classes: [], combos: [], clubs: [], staffRoles: [], families: [], reasons: [] };

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { token: t } = await api('/api/login', 'POST', { email, password });
      await onDone(t);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[2fr_3fr] bg-white text-[13px] text-[#0b0f1a]">
      <aside className="relative hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <Photo src={IMG.auth} alt="The school computer lab" className="absolute inset-0 h-full w-full" />
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
          <p className="mt-1.5 mb-6 text-black/60 leading-relaxed">Log in with the email and password your school admin gave you.</p>
          {err && <Alert>{err}</Alert>}

          <form onSubmit={submit} className="space-y-4">
            <Field l="Email">
              <Inp type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.rw" />
            </Field>
            <Field l="Password">
              <div className="relative">
                <Inp type={show ? 'text' : 'password'} autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} className="!pr-14" />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-3 text-[11px] font-semibold text-black/50 hover:text-black">
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Btn type="submit" className="w-full !py-3" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Btn>
          </form>

          {hasGoogle && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-xs text-black/40">
                <span className="h-px flex-1 bg-black/10" />or<span className="h-px flex-1 bg-black/10" />
              </div>
              <GoogleBtn onResult={onDone} onError={setErr} />
            </div>
          )}

          <p className="mt-8 text-xs text-center text-black/50">
            No account yet? Ask your school admin to create one for you.
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
    <div className="rounded-xl border border-black/10 bg-white p-4">
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
        <div className="mb-5 max-w-xs">
          <Field l="Reason for booking"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        {sessions.length === 0 && <Empty>No labs are open yet. Check back after the admin posts a schedule.</Empty>}
        {sessions.map((s) => {
          const pct = s.seats ? ((s.seats - s.left) / s.seats) * 100 : 100;
          return (
            <div key={s.id} className="flex justify-between items-center border-t border-black/10 py-4 gap-4">
              <div className="min-w-0 flex-1">
                <b>{s.lab}</b>
                <span className="text-black/60"> · {s.date} · {s.from}–{s.to}</span>
                <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-black/10 overflow-hidden">
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

      <Card t="My applications">
        {apps.length === 0 && <Empty>You have not applied yet. Pick an open lab above.</Empty>}
        {apps.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 py-3">
            <span><b>{a.lab}</b> <span className="text-black/60">· {a.date} {a.from} · {a.reason}</span></span>
            <Badge s={a.status} />
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
  const classes = classesFor(opts).map((c) => c.t); // "S4 MSI", "S6 PCB" ...
  const classOpts = psy ? [{ v: '', t: 'All students' }, ...classes.map((c) => ({ v: c, t: c }))] : classes;

  const [cls, setCls] = useState(psy ? '' : classes[0] || '');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sid, setSid] = useState('');
  const [reason, setReason] = useState(opts.reasons[0] || '');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [apps, setApps] = useState([]);

  const loadApps = () => api('/api/apps').then(setApps).catch((e) => { setOk(false); setMsg(e.message); });

  useEffect(() => {
    api('/api/sessions').then((s) => { setSessions(s); setSid((id) => id || s[0]?.id || ''); }).catch((e) => { setOk(false); setMsg(e.message); });
    loadApps();
  }, []);
  useEffect(() => {
    setPicked([]);
    if (!psy && !cls) { setStudents([]); return; } // teachers must pick a class first
    api(`/api/students?class=${encodeURIComponent(cls)}`).then(setStudents).catch((e) => { setOk(false); setMsg(e.message); });
  }, [cls]);
  useLive({
    seats: (s) => { setSessions(s); setSid((id) => (s.some((x) => x.id === +id) ? id : s[0]?.id || '')); },
    'applications:update': loadApps,
  });

  const toggle = (n) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const allPicked = students.length > 0 && picked.length === students.length;
  const current = sessions.find((s) => s.id === +sid);

  const book = async () => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: +sid, reason, students: picked });
      const skipped = r.skipped?.length ? ` Already booked at this time: ${r.skipped.join(', ')}.` : '';
      setOk(r.created > 0); setMsg(`${r.created} booking(s) sent for approval.${skipped}`); setPicked([]);
    } catch (e) { setOk(false); setMsg(e.message); }
  };
  const n = (k) => apps.filter((a) => a.status === k).length;

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
            <Sel
              o={sessions.map((s) => ({ v: s.id, t: `${s.lab} · ${s.date} ${s.from}` }))}
              value={sid}
              onChange={(e) => setSid(e.target.value)}
            />
          </Field>
          <Field l="Reason"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>

        {current && (
          <p className={`mt-5 font-medium ${current.left ? 'text-[#15803d]' : 'text-[#c2410c]'}`}>
            {current.left} of {current.seats} seats left in this lab
          </p>
        )}

        <div className="mt-6 flex justify-between items-center gap-3">
          <b>{students.length} students{cls ? ` in ${cls}` : ''}</b>
          <Btn c="w" onClick={() => setPicked(allPicked ? [] : students.map((s) => s.name))}>
            {allPicked ? 'Clear all' : 'Select whole class'}
          </Btn>
        </div>

        <div className="mt-3 divide-y divide-black/10">
          {students.length === 0 && <Empty>No students found in this class yet.</Empty>}
          {students.map((s) => (
            <label key={s.name} className="flex items-center gap-3 py-2.5">
              <input type="checkbox" checked={picked.includes(s.name)} onChange={() => toggle(s.name)} />
              <Avatar name={s.name} className="h-7 w-7 text-[10px]" />
              <span className="font-medium">{s.name}</span>
              {psy && <span className="text-black/60">{s.className} · {s.combo}</span>}
            </label>
          ))}
        </div>

        <Btn className="mt-5" disabled={!picked.length || !sid} onClick={book}>
          Book {picked.length || ''} student{picked.length === 1 ? '' : 's'}
        </Btn>
      </Card>

      <Card t="My bookings">
        {apps.length === 0 && <Empty>No bookings yet.</Empty>}
        {apps.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 py-3">
            <span><b>{a.name}</b> <span className="text-black/60">· {a.lab} {a.date} {a.from}</span></span>
            <Badge s={a.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 8. ADMIN DASHBOARD                                                  */
/* ================================================================== */

const ADMIN_TABS = ['Overview', 'Users', 'Labs', 'Schedule', 'Applications', 'Attendance', 'History', 'Settings'];
const LISTS = {
  grades: 'Grades', combos: 'Subject combinations', clubs: 'Clubs and activities',
  staffRoles: 'Staff roles', families: 'Families', reasons: 'Booking reasons',
};
const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', psychosocial: 'Psychosocial worker', student: 'Student' };
const ROLE_CHOICES = ['student', 'teacher', 'psychosocial'];

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (s) => `${s.lab} · ${s.date} ${s.from}–${s.to}`;

const Row = ({ children }) => (
  <div className="flex flex-wrap justify-between items-center border-t border-black/10 py-3.5 gap-3">{children}</div>
);

/* ---------- charts ---------- */

const TICK = { fontSize: 11, fill: '#64748b' };
const TIP = { contentStyle: { borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }, cursor: { fill: 'rgba(0,0,0,0.04)' } };

const ChartCard = ({ t, sub, h = 'h-64', children }) => (
  <Card t={t} sub={sub}>
    <div className={h}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  </Card>
);

const Stat = ({ v, t, tone }) => {
  const color = { gr: 'text-[#16a34a]', or: 'text-[#f97316]' }[tone] || 'text-[#0b0f1a]';
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
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
        <p className="mb-6 rounded-xl bg-[#0b0f1a] text-white px-5 py-4 text-xs">
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
            <Bar dataKey="Used" stackId="s" fill={C.gr} radius={[0, 0, 4, 4]} />
            <Bar dataKey="Free" stackId="s" fill="#dbe2ea" radius={[4, 4, 0, 0]} />
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
            <Bar dataKey="Rejected" stackId="a" fill={C.ink} radius={[4, 4, 0, 0]} />
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
            <Bar dataKey="Bookings" fill={C.gr} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard t="Busiest classes" sub="Top 10 by applications." h="h-72">
          <BarChart data={classData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={80} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip {...TIP} />
            <Bar dataKey="Applications" fill={C.ink} radius={[0, 4, 4, 0]} />
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
              <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#16a34a]" />{stats.attendance.present} present</p>
              <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#f97316]" />{stats.attendance.absent} absent</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- accounts: the admin creates every user ---------- */

const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join('');
};

function UsersTab({ users, opts, act }) {
  const classes = classesFor(opts);
  const blank = { name: '', email: '', role: 'student', klass: classes[0]?.v || '', password: genPassword() };
  const [f, setF] = useState(blank);
  const [created, setCreated] = useState(null);
  const [q, setQ] = useState('');
  const [rf, setRf] = useState('all');
  const [edit, setEdit] = useState(null);
  const up = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const create = () => act(async () => {
    await api('/api/users', 'POST', {
      name: f.name, email: f.email, role: f.role, password: f.password,
      ...(f.role === 'student' && parseClass(f.klass)),
    });
    setCreated({ name: f.name, email: f.email, password: f.password });
    setF({ ...blank, role: f.role, klass: f.klass, password: genPassword() });
  });

  const save = () => act(async () => {
    await api(`/api/users/${edit.id}`, 'PUT', {
      email: edit.email,
      password: edit.password || undefined,
      ...(edit.role === 'student' && parseClass(edit.klass)),
    });
    setEdit(null);
  });

  const shown = users.filter((u) => (rf === 'all' || u.role === rf) && `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const count = (r) => users.filter((u) => u.role === r).length;
  const copy = () => navigator.clipboard?.writeText(`Email: ${created.email}\nPassword: ${created.password}`);

  return (
    <div>
      <Card t="Create an account" sub="People cannot sign up themselves. Give them the email and password you set here.">
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
          <Field l="Email"><Inp type="email" value={f.email} onChange={up('email')} placeholder="aline@school.rw" /></Field>
          {f.role === 'student' && (
            <Field l="Class" hint="Grade and combination, for example S6 PCB.">
              <Sel o={classes} value={f.klass} onChange={up('klass')} />
            </Field>
          )}
          <Field l="Password" hint="At least 6 characters.">
            <div className="flex gap-2">
              <Inp value={f.password} onChange={up('password')} />
              <Btn c="w" className="shrink-0" onClick={() => setF((p) => ({ ...p, password: genPassword() }))}>Generate</Btn>
            </div>
          </Field>
        </div>
        <Btn className="mt-6" disabled={!f.name.trim() || !f.email.trim() || f.password.length < 6} onClick={create}>Create account</Btn>

        {created && (
          <div className="mt-6 rounded-lg border border-[#16a34a]/40 bg-[#16a34a]/5 p-4 text-xs">
            <p className="font-semibold text-[#15803d]">Account created for {created.name}.</p>
            <p className="mt-2">Email: <b>{created.email}</b></p>
            <p>Password: <b>{created.password}</b></p>
            <p className="mt-2 text-black/60">Save this now. The password is not shown again.</p>
            <Btn c="w" className="mt-3" onClick={copy}>Copy login details</Btn>
          </div>
        )}
      </Card>

      <Card t="All accounts" sub={`${count('student')} students · ${count('teacher')} teachers · ${count('psychosocial')} psychosocial workers`}>
        <div className="grid md:grid-cols-[1fr_200px] gap-3 mb-4">
          <Inp placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <Sel o={[{ v: 'all', t: 'All roles' }, ...ROLE_CHOICES.map((r) => ({ v: r, t: ROLE_LABEL[r] }))]} value={rf} onChange={(e) => setRf(e.target.value)} />
        </div>
        {shown.length === 0 && <Empty>No accounts match.</Empty>}
        {shown.map((u) => (
          <Row key={u.id}>
            <span className="flex items-center gap-3 min-w-0">
              <Avatar name={u.name} />
              <span className="min-w-0">
                <b className="block truncate">{u.name}</b>
                <span className="block truncate text-black/60">{u.email}</span>
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-semibold">
                {u.role === 'student' ? (u.className || 'No class') : ROLE_LABEL[u.role]}
              </span>
              <Btn c="w" onClick={() => setEdit({
                id: u.id, name: u.name, role: u.role, email: u.email, password: '',
                klass: classes.find((c) => c.t === u.className)?.v || classes[0]?.v || '',
              })}>Edit</Btn>
              <Btn c="or" onClick={() => window.confirm(`Delete the account of ${u.name}?`) && act(() => api(`/api/users/${u.id}`, 'DELETE'))}>Delete</Btn>
            </span>
          </Row>
        ))}
      </Card>

      {edit && (
        <Modal title={`Edit ${edit.name}`} onClose={() => setEdit(null)}>
          <div className="space-y-4">
            <Field l="Email"><Inp type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            {edit.role === 'student' && (
              <Field l="Class"><Sel o={classes} value={edit.klass} onChange={(e) => setEdit({ ...edit, klass: e.target.value })} /></Field>
            )}
            <Field l="New password" hint="Leave empty to keep the current password.">
              <div className="flex gap-2">
                <Inp value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
                <Btn c="w" className="shrink-0" onClick={() => setEdit({ ...edit, password: genPassword() })}>Generate</Btn>
              </div>
            </Field>
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
  const [hist, setHist] = useState([]);
  const [lab, setLab] = useState({ name: '', pcs: 10 });
  const [sch, setSch] = useState({ date: today(), from: '14:00', to: '16:00', labId: 'all' });
  const [hf, setHf] = useState({ date: '', labId: '' });
  const [add, setAdd] = useState({});

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

  const act = async (fn) => {
    try { await fn(); setErr(''); await load(); } catch (e) { setErr(e.message); }
  };
  const saveList = (k, list) =>
    act(async () => setOpts({ ...EMPTY_OPTS, ...(await api('/api/options', 'PUT', { [k]: list })) }));
  const runHistory = () =>
    act(async () => setHist(await api(`/api/history?date=${hf.date}&labId=${hf.labId}`)));
  const setStatus = (a, status) => act(() => api(`/api/apps/${a.id}/status`, 'PATCH', { status }));
  const setAtt = (a, att) => act(() => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att }));
  const labChoices = (first) => [first, ...labs.map((l) => ({ v: l.id, t: l.name }))];
  const approved = apps.filter((a) => a.status === 'approved');

  return (
    <div>
      {err && <Alert>{err}</Alert>}

      {tab === 'Overview' && (stats ? <Overview stats={stats} opts={opts} /> : <Empty>Loading the numbers…</Empty>)}

      {tab === 'Users' && <UsersTab users={users} opts={opts} act={act} />}

      {tab === 'Labs' && (
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
      )}

      {tab === 'Settings' && (
        <div>
          <p className="mb-6 text-black/70">Students and staff choose from these lists when they book a lab. A class is always a grade plus a combination, such as S6 PCB.</p>
          {Object.entries(LISTS).map(([k, title]) => (
            <Card key={k} t={title}>
              <div className="flex flex-wrap gap-2 mb-5">
                {(opts[k] || []).map((x) => (
                  <span key={x} className="border border-black/20 rounded-full px-3 py-1.5 font-medium">
                    {x}{' '}
                    <button type="button" aria-label={'Remove ' + x} className="text-[#f97316]" onClick={() => saveList(k, opts[k].filter((y) => y !== x))}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <Inp placeholder={'Add to ' + title.toLowerCase()} value={add[k] || ''} onChange={(e) => setAdd({ ...add, [k]: e.target.value })} />
                <Btn onClick={() => {
                  const v = (add[k] || '').trim();
                  if (v) saveList(k, [...(opts[k] || []), v]);
                  setAdd({ ...add, [k]: '' });
                }}>Add</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'Schedule' && (
        <Card t="Prepare a schedule">
          <div className="grid md:grid-cols-4 gap-4">
            <Inp type="date" value={sch.date} onChange={(e) => setSch({ ...sch, date: e.target.value })} />
            <Inp type="time" value={sch.from} onChange={(e) => setSch({ ...sch, from: e.target.value })} />
            <Inp type="time" value={sch.to} onChange={(e) => setSch({ ...sch, to: e.target.value })} />
            <Sel o={labChoices({ v: 'all', t: 'All labs' })} value={sch.labId} onChange={(e) => setSch({ ...sch, labId: e.target.value })} />
          </div>
          <Btn className="my-5" onClick={() => act(() => api('/api/sessions', 'POST', {
            date: sch.date, from: sch.from, to: sch.to,
            labIds: sch.labId === 'all' ? undefined : [+sch.labId],
          }))}>Publish schedule</Btn>

          {sessions.length === 0 && <Empty>Nothing published yet.</Empty>}
          {sessions.map((s) => (
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
      )}

      {tab === 'Applications' && (
        <Card t="Applications" action={<Btn onClick={() => act(() => api('/api/apps/approve-all', 'POST'))}>Approve all pending</Btn>}>
          {apps.length === 0 && <Empty>No applications yet.</Empty>}
          {apps.map((a) => (
            <Row key={a.id}>
              <span className="leading-relaxed">
                <b>{a.name}</b> · {a.cls || 'staff booking'} · {a.reason}
                <br /><span className="text-black/60">{fmt(a)}</span> <Badge s={a.status} />
              </span>
              <span className="flex flex-wrap gap-2 items-center">
                <Btn onClick={() => setStatus(a, 'approved')}>Approve</Btn>
                <Btn c="or" onClick={() => setStatus(a, 'rejected')}>Reject</Btn>
                <select className="rounded-[6px] border border-black/25 px-2.5 py-2 text-xs" value=""
                  onChange={(e) => e.target.value && act(() => api(`/api/apps/${a.id}/move`, 'PATCH', { sessionId: +e.target.value }))}>
                  <option value="">Move to…</option>
                  {sessions.filter((s) => s.id !== a.sid).map((s) => (
                    <option key={s.id} value={s.id}>{fmt(s)} ({s.left} left)</option>
                  ))}
                </select>
                <Btn c="w" onClick={() => act(() => api('/api/blacklist', 'POST', { name: a.name }))}>Blacklist</Btn>
              </span>
            </Row>
          ))}

          <h4 className="font-semibold mt-8 mb-3">Blacklisted students</h4>
          {black.length === 0 ? <p className="text-black/60">Nobody is blacklisted.</p> : black.map((n) => (
            <span key={n} className="inline-flex items-center gap-2 border border-[#f97316] text-[#c2410c] rounded-full px-3 py-1.5 mr-3 mb-2 font-medium">
              {n}
              <button type="button" aria-label={'Unblock ' + n} onClick={() => act(() => api(`/api/blacklist/${encodeURIComponent(n)}`, 'DELETE'))}>×</button>
            </span>
          ))}
        </Card>
      )}

      {tab === 'Attendance' && (
        <div>
          <Card t="Mark attendance">
            {approved.length === 0 && <Empty>No approved students yet.</Empty>}
            {approved.map((a) => (
              <Row key={a.id}>
                <span><b>{a.name}</b> <span className="text-black/60">· {fmt(a)}</span></span>
                <span className="flex gap-2">
                  <Btn c={a.att === 'present' ? 'gr' : 'w'} onClick={() => setAtt(a, 'present')}>Present</Btn>
                  <Btn c={a.att === 'absent' ? 'or' : 'w'} onClick={() => setAtt(a, 'absent')}>Absent</Btn>
                </span>
              </Row>
            ))}
          </Card>

          <Card t="Absenteeism by student">
            {Object.keys(absent).length === 0 ? <Empty>No attendance recorded yet.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-black/50"><th className="pb-2 font-medium">Student</th><th className="font-medium">Applied</th><th className="font-medium">Attended</th><th className="font-medium">Absent</th></tr></thead>
                  <tbody>
                    {Object.entries(absent).sort((a, b) => b[1].absent - a[1].absent).map(([n, r]) => (
                      <tr key={n} className="border-t border-black/10">
                        <td className="py-2.5 font-medium">{n}</td>
                        <td>{r.applied}</td>
                        <td className="text-[#16a34a]">{r.attended}</td>
                        <td className={r.absent ? 'text-[#f97316] font-bold' : ''}>{r.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'History' && (
        <Card t="Lab history">
          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <Inp type="date" value={hf.date} onChange={(e) => setHf({ ...hf, date: e.target.value })} />
            <Sel o={labChoices({ v: '', t: 'All labs' })} value={hf.labId} onChange={(e) => setHf({ ...hf, labId: e.target.value })} />
            <Btn onClick={runHistory}>Show history</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="text-black/50"><th className="pb-2 font-medium">Date</th><th className="font-medium">Lab</th><th className="font-medium">Student</th><th className="font-medium">Class</th><th className="font-medium">Status</th><th className="font-medium">Attendance</th></tr></thead>
              <tbody>
                {hist.map((a) => (
                  <tr key={a.id} className="border-t border-black/10">
                    <td className="py-2.5">{a.date}</td><td>{a.lab} {a.from}</td><td>{a.name}</td>
                    <td>{a.cls}</td><td><Badge s={a.status} /></td><td>{a.att || 'not marked'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hist.length === 0 && <Empty>Pick a date and lab, then press Show history.</Empty>}
        </Card>
      )}
    </div>
  );
}

/* ================================================================== */
/* 9. PROFILE (every role)                                             */
/* ================================================================== */

function Profile() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState(null);

  useEffect(() => { api('/api/profile').then(setP).catch((e) => setErr(e.message)); }, []);

  const change = async () => {
    if (pw.next !== pw.again) return setMsg({ ok: false, t: 'The new passwords do not match.' });
    try {
      await api('/api/profile/password', 'PUT', { current: pw.current, next: pw.next });
      setMsg({ ok: true, t: 'Your password has been changed.' });
      setPw({ current: '', next: '', again: '' });
    } catch (e) { setMsg({ ok: false, t: e.message }); }
  };
  const set = (k) => (e) => setPw((x) => ({ ...x, [k]: e.target.value }));

  if (err) return <Alert>{err}</Alert>;
  if (!p) return <Empty>Loading your profile…</Empty>;

  const details = [
    ['Email', p.email || 'Not set'],
    ['Role', ROLE_LABEL[p.role] || p.role],
    ...(p.role === 'student' ? [['Class', p.cls || 'Not set'], ['Combination', p.combo || 'Not set']] : []),
  ];
  const s = p.stats;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-x-6">
      <div>
        <Card>
          <div className="flex flex-col items-center text-center">
            <Avatar name={p.name} className="h-20 w-20 text-xl" />
            <h2 className="mt-4 text-base font-bold">{p.name}</h2>
            <span className="mt-2 rounded-full bg-[#f97316]/10 px-3 py-1 text-[11px] font-semibold text-[#c2410c]">{ROLE_LABEL[p.role] || p.role}</span>
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
      </div>

      <div>
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Tile v={s.total} t={p.role === 'student' ? 'Applications' : 'Bookings made'} />
            <Tile v={s.approved} t="Approved" tone="gr" />
            <Tile v={s.pending} t="Waiting" tone="or" />
            <Tile v={s.present} t="Attended" tone="gr" />
          </div>
        )}

        <Card t="Change password" sub={p.canChangePassword ? 'Use at least 6 characters.' : 'This admin password is set in the server .env file (ADMIN_PASSWORD).'}>
          {p.canChangePassword && (
            <div className="max-w-sm space-y-4">
              {msg && <Alert ok={msg.ok}>{msg.t}</Alert>}
              <Field l="Current password"><Inp type="password" autoComplete="current-password" value={pw.current} onChange={set('current')} /></Field>
              <Field l="New password"><Inp type="password" autoComplete="new-password" value={pw.next} onChange={set('next')} /></Field>
              <Field l="Repeat new password"><Inp type="password" autoComplete="new-password" value={pw.again} onChange={set('again')} /></Field>
              <Btn disabled={!pw.current || pw.next.length < 6} onClick={change}>Save new password</Btn>
            </div>
          )}
        </Card>
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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold whitespace-nowrap ${look}`}>
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
        <div className="mt-4 rounded-xl bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} className="h-9 w-9 text-xs !bg-[#16a34a]" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[11px] text-white/50">{ROLE_LABEL[user.role] || user.role}</div>
            </div>
          </div>
          <button type="button" onClick={onLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white">
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
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight">{page}</h1>
            <p className="mt-1 text-xs text-black/50">Signed in as {user.name}</p>
          </div>
          {page === 'Profile' ? <Profile /> : <Main user={user} opts={opts} tab={page} />}
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 11. ROOT: landing -> login -> dashboard                             */
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

  // Email login and Google login both hand over a JWT.
  const handleAuth = async (t) => {
    setToken(t);
    await loadOpts();
    setUser(await api('/api/me')); // { id, role, name, email }
    setView('app');
  };
  const logout = () => { setToken(''); setUser(null); setView('home'); };

  if (booting) return null;
  if (view === 'app' && user) return <Dashboard user={user} opts={opts} onLogout={logout} />;
  if (view === 'login') return <Auth onDone={handleAuth} onBack={() => setView('home')} />;
  return <Landing onLogin={() => setView('login')} />;
}