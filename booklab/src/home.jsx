import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
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

// Shows a photo, or a soft gradient if the picture cannot load.
const Photo = ({ src, alt, className = '' }) => {
  const [bad, setBad] = useState(false);
  if (bad) {
    return <div role="img" aria-label={alt} className={`bg-gradient-to-br from-[#0b0f1a] to-[#16a34a] ${className}`} />;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setBad(true)} className={`object-cover ${className}`} />;
};

/* ================================================================== */
/* 2. SCHOOL RULES: grades and subject combinations                    */
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

/* ================================================================== */
/* 3. SMALL UI KIT                                                     */
/* ================================================================== */

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
      className={`px-4 py-2 text-xs font-semibold rounded-[6px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${look} ${className}`}
      {...p}
    />
  );
};

const Inp = ({ className = '', ...p }) => (
  <input
    className={`w-full px-3 py-2 text-xs rounded-[6px] border border-black/25 focus:outline-none focus:border-[#0b0f1a] ${className}`}
    {...p}
  />
);

const Sel = ({ o = [], className = '', ...p }) => (
  <select className={`w-full px-2.5 py-2 text-xs rounded-[6px] border border-black/25 bg-white ${className}`} {...p}>
    {o.map((x) => {
      const v = x.v ?? x;
      const t = x.t ?? x;
      return <option key={v} value={v}>{t}</option>;
    })}
  </select>
);

const Card = ({ t, children }) => (
  <section className="rounded-[6px] border border-black/10 bg-white p-6 mb-6">
    <h3 className="text-sm font-semibold mb-4">{t}</h3>
    {children}
  </section>
);

const Alert = ({ ok, children }) => (
  <p
    role={ok ? 'status' : 'alert'}
    className={`rounded-[6px] border px-4 py-3 mb-5 text-xs font-medium ${
      ok ? 'border-[#16a34a] text-[#16a34a]' : 'border-[#f97316] bg-[#f97316]/5 text-[#f97316]'
    }`}
  >
    {children}
  </p>
);

const Badge = ({ s }) => (
  <b className={`capitalize ${s === 'approved' ? 'text-[#16a34a]' : 'text-[#f97316]'}`}>{s}</b>
);

const Field = ({ l, children }) => (
  <label className="block text-xs font-medium">
    <span className="block mb-1.5">{l}</span>
    {children}
  </label>
);

const Logo = ({ light }) => (
  <div className={`group inline-flex items-center gap-3 text-base font-extrabold tracking-tight transition-opacity duration-200 hover:opacity-80 ${light ? 'text-white' : 'text-[#111827]'}`}>
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white transition-transform duration-200 group-hover:scale-105">
      <img src={logo} alt="LabBook logo" className="h-7 w-7 object-contain" />
    </span>
    <span className="leading-none">
      Lab<span className="text-[#16a34a]">Book</span>
    </span>
  </div>
);

const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

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
  dark: { box: 'bg-[#0b0f1a] text-white', num: 'text-white/60', text: 'text-white/75' },
  green: { box: 'bg-[#16a34a] text-white', num: 'text-white/60', text: 'text-white/75' },
  light: { box: 'bg-white', num: 'text-[#f97316]', text: 'text-black/60' },
};

const STEPS = [
  ['Create your account', 'Continue with Google so your name and email are verified, then pick your grade, class and combination.'],
  ['Find an open lab', 'Browse published lab times and check the seats left in real time.'],
  ['Apply and attend', 'Choose a reason, get approved and show up. Attendance is recorded.'],
];
const TEAM = [
  ['Jean Habimana', 'Head of ICT', 'Sets lab schedules and approves requests.'],
  ['Alice Uwase', 'Computer Science Teacher', 'Books classes and guides practical sessions.'],
  ['Eric Niyonzima', 'Psychosocial Worker', 'Supports students and books lab time for them.'],
];
const FAQ = [
  ['Who can book a lab?', 'Students apply for themselves. Teachers and psychosocial workers can book for a class or chosen students.'],
  ['What if a lab is full?', 'Apply is disabled when no seats remain, and admins can move students between labs.'],
  ['How do I sign in?', 'Create your account once with Google. After that, continue with the same Google account to log in.'],
  ['Can I book the same lab twice?', 'No. Each student can hold only one booking per lab time, and bookings that overlap are blocked.'],
  ['Can booking access be removed?', 'Yes. Admins can blacklist a student who misuses lab time.'],
];

const WRAP = 'max-w-6xl mx-auto px-6';
const EYEBROW = 'inline-block text-[11px] font-semibold text-[#f97316] tracking-[0.16em] uppercase';

const Heading = ({ eyebrow, title, className = '' }) => (
  <>
    <span className={EYEBROW}>{eyebrow}</span>
    <h2 className={`mt-3 text-2xl md:text-3xl font-bold tracking-tight ${className}`}>{title}</h2>
  </>
);

function Header({ onLogin, onRegister }) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-black/5">
      <div className={`${WRAP} h-16 flex items-center justify-between`}>
        <Logo />
        <nav className="hidden md:flex gap-2 text-xs font-medium">
          {NAV.map(([h, t]) => (
            <a key={h} href={`#${h}`} className="px-3 py-2 rounded-[6px] hover:bg-black/5">{t}</a>
          ))}
        </nav>
        <div className="flex gap-3">
          <Btn c="w" onClick={onLogin}>Log in</Btn>
          <Btn c="or" onClick={onRegister}>Get started</Btn>
        </div>
      </div>
    </header>
  );
}

function Hero({ onLogin, onRegister }) {
  return (
    <section className={`${WRAP} pt-12 pb-24 grid lg:grid-cols-2 gap-16 items-center`}>
      <div>
        <span className="inline-flex items-center gap-2 rounded-[6px] border border-black/10 px-3 py-1.5 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-[6px] bg-[#16a34a]" />
          Now taking lab bookings
        </span>
        <h1 className="mt-6 text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
          Book your lab seat in <span className="text-[#f97316]">seconds.</span>
        </h1>
        <p className="mt-6 text-sm text-black/60 max-w-md leading-relaxed">
          A modern way to run your school's computer labs. Publish schedules, take bookings,
          approve fairly and track attendance, all in one place.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Btn className="!px-6 !py-3" onClick={onRegister}>Create your account</Btn>
          <Btn c="w" className="!px-6 !py-3" onClick={onLogin}>Log in</Btn>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-xs font-medium text-black/70">
          {HERO_POINTS.map((p) => (
            <li key={p}><span className="text-[#16a34a] font-bold mr-2">✓</span>{p}</li>
          ))}
        </ul>
      </div>

      <div className="relative pb-4">
        <div className="rounded-[6px] border border-black/10 overflow-hidden shadow-lg">
          <Photo src={IMG.hero} alt="The school computer lab" className="h-[420px] w-full" />
        </div>
        <div className="absolute left-3 -bottom-0 bg-white rounded-[6px] shadow-md border border-black/5 px-4 py-3 text-xs font-semibold flex items-center gap-3">
          <span className="w-7 h-7 rounded-[6px] bg-[#16a34a] text-white grid place-items-center">✓</span>
          <span>Booking approved<br /><span className="text-black/50 font-normal">Lab 1 · 14:00</span></span>
        </div>
        <div className="absolute right-3 top-4 bg-white rounded-[6px] shadow-md border border-black/5 px-4 py-3 text-xs font-semibold flex items-center gap-3">
          <span className="w-7 h-7 rounded-[6px] bg-[#f97316] text-white grid place-items-center">4</span>
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
      <Heading eyebrow="Services" title="Everything a school lab needs, without the paperwork." className="max-w-xl" />
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {SERVICES.map(({ title, text, theme, span = '' }, i) => {
          const t = CARD_THEMES[theme];
          return (
            <div key={title} className={`rounded-[6px] p-6 min-h-[160px] flex flex-col justify-between gap-6 border border-black/10 ${t.box} ${span}`}>
              <span className={`text-xs font-semibold ${t.num}`}>0{i + 1}</span>
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className={`mt-2 text-xs leading-relaxed ${t.text}`}>{text}</p>
              </div>
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
        <Photo src={IMG.lab1} alt="Inside the lab" className="h-[400px] w-full rounded-[6px] border border-black/10" />
        <Photo src={IMG.lab2} alt="Lab staff" className="absolute bottom-0 right-0 h-44 w-52 rounded-[6px] border-4 border-white shadow-lg" />
      </div>
      <div>
        <span className={EYEBROW}>Inside the lab</span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Less queueing. More learning.</h2>
        <p className="mt-4 text-sm text-black/60 leading-relaxed">
          Every seat is accounted for. Students arrive knowing they have a computer, teachers
          know who is attending, and admins see how each lab is used.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {ALL_COMBOS.map((c) => (
            <span key={c} className="rounded-[6px] border border-black/15 px-3 py-1.5 text-xs font-medium">{c}</span>
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
        <Heading eyebrow="How it works" title="Three steps from sign-up to seat." />
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="rounded-[6px] bg-white p-6 border border-black/5">
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
      <Heading eyebrow="Our team" title="The people behind the labs." />
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {TEAM.map(([name, role, text]) => (
          <div key={name} className="rounded-[6px] border border-black/10 p-6">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#0b0f1a] text-sm font-bold text-white">{initials(name)}</span>
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

function CallToAction({ onRegister }) {
  return (
    <section className="px-6 pb-20">
      <div className="relative max-w-6xl mx-auto rounded-[6px] overflow-hidden text-white">
        <Photo src={IMG.cta} alt="School lab" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-[#0b0f1a]/80" />
        <div className="relative px-8 py-16 md:px-14 flex flex-wrap gap-8 justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight max-w-md">Ready to book your next lab session?</h2>
          <Btn c="or" className="!px-7 !py-3" onClick={onRegister}>Get started</Btn>
        </div>
      </div>
    </section>
  );
}

function Landing({ onLogin, onRegister }) {
  return (
    <div className="bg-white text-[#0b0f1a] antialiased text-sm">
      <Header onLogin={onLogin} onRegister={onRegister} />
      <Hero onLogin={onLogin} onRegister={onRegister} />
      <StatsBar />
      <Services />
      <InsideLab />
      <HowItWorks />
      <Team />
      <Faq />
      <CallToAction onRegister={onRegister} />
      <footer className={`${WRAP} py-10 flex flex-wrap justify-between items-center gap-4 text-xs text-black/50 border-t border-black/10`}>
        <Logo />
        <span>© 2026 Computer Lab Management System</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 5. LOGIN / REGISTER (Google verifies the email, then Google only)   */
/* ================================================================== */

const EMPTY_OPTS = { grades: [], classes: [], combos: [], clubs: [], staffRoles: [], families: [], reasons: [] };

const ROLE_CHOICES = [
  { v: 'student', t: 'Student' },
  { v: 'teacher', t: 'Teacher' },
  { v: 'psychosocial', t: 'Psychosocial' },
];

// Google's own "Continue with Google" button. It loads Google's script itself, so index.html needs no change.
// getExtra() returns extra details (role, class...) to send together with the Google login.
function GoogleBtn({ getExtra, onResult, onError }) {
  const ref = useRef(null);
  const live = useRef({});
  live.current = { getExtra, onResult, onError };
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    const start = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (r) => {
          try {
            const data = await api('/api/google', 'POST', { credential: r.credential, ...(live.current.getExtra?.() || {}) });
            await live.current.onResult(data, r.credential);
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

  if (!clientId) {
    return <Alert>Google sign-in is not set up yet. Add VITE_GOOGLE_CLIENT_ID to the frontend .env file and restart.</Alert>;
  }
  return <div ref={ref} className="flex justify-center min-h-[44px]" />;
}

// Role buttons + grade / class / combination for students. Shared by sign up and "finish your profile".
function RoleFields({ f, setF, opts }) {
  const grades = studentGrades(opts);
  const up = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const pickGrade = (e) => {
    const grade = e.target.value;
    setF((p) => ({ ...p, grade, combo: combosFor(grade)[0] || '' })); // combinations depend on the grade
  };
  return (
    <div className="space-y-4">
      <div>
        <span className="block mb-1.5 text-xs font-medium">I am a</span>
        <div className="grid grid-cols-3 gap-2">
          {ROLE_CHOICES.map((r) => (
            <Btn key={r.v} c={f.role === r.v ? 'ink' : 'w'} onClick={() => setF((p) => ({ ...p, role: r.v }))}>
              {r.t}
            </Btn>
          ))}
        </div>
      </div>
      {f.role === 'student' && (
        <div className="grid grid-cols-3 gap-3">
          <Field l="Grade"><Sel o={grades} value={f.grade} onChange={pickGrade} /></Field>
          <Field l="Class"><Sel o={opts.classes} value={f.klass} onChange={up('klass')} /></Field>
          <Field l="Combination"><Sel o={combosFor(f.grade)} value={f.combo} onChange={up('combo')} /></Field>
        </div>
      )}
    </div>
  );
}

function Auth({ opts, initialMode, onDone, onBack }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'profile'
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(null); // a Google user who still has to choose a role
  const g0 = studentGrades(opts)[0];
  const [f, setF] = useState({ role: 'student', grade: g0, klass: opts.classes[0] || '', combo: combosFor(g0)[0] || '' });

  // Options may arrive after this screen mounts, so fill the empty default when they do.
  useEffect(() => {
    setF((p) => ({ ...p, klass: p.klass || opts.classes[0] || '' }));
  }, [opts]);

  const extra = () => ({
    role: f.role,
    ...(f.role === 'student' && { cls: f.grade + f.klass, combo: f.combo }),
  });

  const goMode = (m) => { setErr(''); setMode(m); };

  // Result of a Google click: either a login token, or "new person, ask for the role first".
  const googleDone = async (data, credential) => {
    if (data.needsProfile) {
      setErr('');
      setPending({ credential, name: data.name, email: data.email });
      setMode('profile');
      return;
    }
    await onDone(data.token);
  };

  const finishGoogle = async () => {
    try {
      const { token: t } = await api('/api/google', 'POST', { credential: pending.credential, ...extra() });
      await onDone(t);
    } catch (e2) { setErr(e2.message); }
  };

  const titles = {
    login: ['Welcome back', 'Continue with the Google account you signed up with.'],
    register: ['Create your account', 'Tell us who you are, then verify your email with Google.'],
    profile: [`Welcome, ${pending?.name || ''}`, 'One last step. Tell us who you are to set up your account.'],
  }[mode];

  return (
    <div className="min-h-screen grid lg:grid-cols-[2fr_3fr] bg-white text-[13px] text-[#0b0f1a]">
      {/* Image side: fixed to the screen height so it never stretches the page */}
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

      {/* Form side */}
      <main className="flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="text-xs font-medium text-black/60">← Back to home</button>
            <span className="lg:hidden"><Logo /></span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">{titles[0]}</h1>
          <p className="mt-1.5 mb-6 text-black/60 leading-relaxed">{titles[1]}</p>
          {err && <Alert>{err}</Alert>}

          {mode === 'login' && (
            <div className="space-y-5">
              <GoogleBtn onResult={googleDone} onError={setErr} />
              <p className="text-xs text-center text-black/50">
                Students, teachers, psychosocial workers and admins all log in with Google.
              </p>
              <p className="text-xs text-center text-black/60">
                New here?{' '}
                <button type="button" className="font-semibold text-[#f97316]" onClick={() => goMode('register')}>Create an account</button>
              </p>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-5">
              <RoleFields f={f} setF={setF} opts={opts} />
              <GoogleBtn getExtra={extra} onResult={googleDone} onError={setErr} />
              <p className="text-xs text-center text-black/50">
                Google gives us your verified name and email. Admins do not sign up; they use Log in.
              </p>
              <p className="text-xs text-center text-black/60">
                Already registered?{' '}
                <button type="button" className="font-semibold text-[#f97316]" onClick={() => goMode('login')}>Log in</button>
              </p>
            </div>
          )}

          {mode === 'profile' && (
            <div className="space-y-5">
              <RoleFields f={f} setF={setF} opts={opts} />
              <Btn className="w-full !py-3" onClick={finishGoogle}>Finish and continue</Btn>
              <p className="text-xs text-center text-black/60">
                Signed in as {pending?.email}.{' '}
                <button type="button" className="font-semibold text-[#f97316]" onClick={() => goMode('login')}>Use a different account</button>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ================================================================== */
/* 6. STUDENT DASHBOARD                                                */
/* ================================================================== */

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

  return (
    <div>
      {msg && <Alert>{msg}</Alert>}

      <Card t="Open labs">
        <div className="mb-5 max-w-xs">
          <Field l="Reason for booking"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        {sessions.length === 0 && <p>No labs are open yet. Check back after the admin posts a schedule.</p>}
        {sessions.map((s) => (
          <div key={s.id} className="flex justify-between items-center border-b border-black/10 py-4 gap-4">
            <div>
              <b>{s.lab} · {s.date} {s.from}–{s.to}</b>
              <div className={`mt-1 ${s.left > 0 ? 'text-[#16a34a] font-medium' : 'text-[#f97316] font-bold'}`}>
                {s.left > 0 ? `${s.left} of ${s.seats} seats left` : 'Full'}
              </div>
            </div>
            {mine(s.id)
              ? <Badge s={mine(s.id).status} />
              : <Btn disabled={s.left < 1} onClick={() => apply(s.id)}>Apply</Btn>}
          </div>
        ))}
      </Card>

      <Card t="My applications">
        {apps.length === 0 && <p>You have not applied yet.</p>}
        {apps.map((a) => (
          <p key={a.id} className="py-2">
            {a.lab} · {a.date} {a.from} · {a.reason} · <Badge s={a.status} />
          </p>
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
  const classes = studentGrades(opts).flatMap((g) => opts.classes.map((c) => g + c));
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
  // keep the selected lab time valid when sessions change live
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

  return (
    <div>
      {msg && <Alert ok={ok}>{msg}</Alert>}

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
          <p className={`mt-5 font-medium ${current.left ? 'text-[#16a34a]' : 'text-[#f97316]'}`}>
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
          {students.length === 0 && <p className="py-3">No students found in this class yet.</p>}
          {students.map((s) => (
            <label key={s.name} className="flex items-center gap-3 py-2.5">
              <input type="checkbox" checked={picked.includes(s.name)} onChange={() => toggle(s.name)} />
              <span className="font-medium">{s.name}</span>
              {psy && <span className="text-black/60">{s.family} · {s.combo}</span>}
            </label>
          ))}
        </div>

        <Btn className="mt-5" disabled={!picked.length || !sid} onClick={book}>
          Book {picked.length || ''} student{picked.length === 1 ? '' : 's'}
        </Btn>
      </Card>

      <Card t="My bookings">
        {apps.length === 0 && <p>No bookings yet.</p>}
        {apps.map((a) => (
          <p key={a.id} className="py-2">
            {a.name} · {a.lab} {a.date} {a.from} · <Badge s={a.status} />
          </p>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 8. ADMIN DASHBOARD                                                  */
/* ================================================================== */

const TABS = ['Overview', 'Labs', 'Settings', 'Schedule', 'Applications', 'Attendance', 'History'];
const LISTS = {
  grades: 'Grades', classes: 'Classes', combos: 'Subject combinations', clubs: 'Clubs and activities',
  staffRoles: 'Staff roles', families: 'Families', reasons: 'Booking reasons',
};

const Bar = ({ label, value, max, c = 'bg-[#16a34a]', note }) => (
  <div className="flex items-center gap-3 mb-3">
    <span className="w-24 shrink-0 text-xs font-medium truncate">{label}</span>
    <div className="flex-1 h-4 rounded-[6px] border border-black/20 overflow-hidden">
      <div className={`${c} h-full`} style={{ width: (max ? Math.max((value / max) * 100, value ? 4 : 0) : 0) + '%' }} />
    </div>
    <b className="w-28 text-right text-xs">{note ?? value}</b>
  </div>
);

const Stat = ({ v, t, warn }) => (
  <div className={`rounded-[6px] border p-4 ${warn ? 'border-[#f97316] text-[#f97316]' : 'border-black/15'}`}>
    <div className="text-xl font-bold">{v}</div>
    <div className="mt-1 text-xs font-medium">{t}</div>
  </div>
);

const Row = ({ children }) => (
  <div className="flex flex-wrap justify-between items-center border-b border-black/10 py-3.5 gap-3">{children}</div>
);

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (s) => `${s.lab} · ${s.date} ${s.from}–${s.to}`;

function Overview({ stats, opts }) {
  const t = stats.totals || {};
  const maxApplied = Math.max(1, ...stats.labs.map((l) => l.applied));
  const maxReason = Math.max(1, ...Object.values(stats.byReason));
  const days = Object.entries(stats.byDay);
  const maxDay = Math.max(1, ...Object.values(stats.byDay));
  const rate = stats.attendance.rate;
  const pct = (n) => (n / maxApplied) * 100 + '%';

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat v={t.applications} t="Applications" />
        <Stat v={t.approved} t="Approved" />
        <Stat v={t.pending} t="Waiting" warn />
        <Stat v={t.rejected} t="Rejected" warn />
        <Stat v={rate === null ? '-' : rate + '%'} t="Attendance rate" />
      </div>

      {stats.mostRequested && t.applications > 0 && (
        <p className="mb-6 rounded-[6px] bg-[#16a34a] text-white px-4 py-3 font-semibold">Most requested lab: {stats.mostRequested}</p>
      )}

      <Card t="Seats used per lab">
        {stats.labs.map((l) => (
          <Bar key={l.lab} label={l.lab} value={l.usagePct} max={100}
            c={l.usagePct >= 90 ? 'bg-[#f97316]' : 'bg-[#16a34a]'}
            note={`${l.approved}/${l.seatsOffered} · ${l.usagePct}%`} />
        ))}
      </Card>

      <Card t="Applications per lab">
        <p className="mb-4">Green is approved, white is waiting, orange is rejected.</p>
        {stats.labs.map((l) => (
          <div key={l.lab} className="flex items-center gap-3 mb-3">
            <span className="w-24 text-xs font-medium truncate">{l.lab}</span>
            <div className="flex-1 h-4 rounded-[6px] border border-black/20 flex overflow-hidden">
              <div className="bg-[#16a34a]" style={{ width: pct(l.approved) }} />
              <div style={{ width: pct(l.pending) }} />
              <div className="bg-[#f97316]" style={{ width: pct(l.rejected) }} />
            </div>
            <b className="w-28 text-right text-xs">{l.applied} total</b>
          </div>
        ))}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card t="Why students book">
          {opts.reasons.map((r) => <Bar key={r} label={r} value={stats.byReason[r] || 0} max={maxReason} />)}
        </Card>

        <Card t="Attendance">
          {rate === null ? <p>Mark attendance to see this chart.</p> : (
            <>
              <div className="flex h-5 rounded-[6px] border border-black/20 overflow-hidden">
                <div className="bg-[#16a34a]" style={{ width: rate + '%' }} />
                <div className="bg-[#f97316] flex-1" />
              </div>
              <p className="mt-3 font-semibold">
                <span className="text-[#16a34a]">{stats.attendance.present} present</span> ·{' '}
                <span className="text-[#f97316]">{stats.attendance.absent} absent</span>
              </p>
            </>
          )}
          <h4 className="font-semibold mt-6 mb-3">Applications by day</h4>
          {days.map(([d, v]) => <Bar key={d} label={d.slice(5)} value={v} max={maxDay} />)}
        </Card>
      </div>
    </div>
  );
}

function Admin({ opts: initial }) {
  const [tab, setTab] = useState('Overview');
  const [err, setErr] = useState('');
  const [labs, setLabs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [black, setBlack] = useState([]);
  const [stats, setStats] = useState(null);
  const [absent, setAbsent] = useState({});
  const [opts, setOpts] = useState({ ...EMPTY_OPTS, ...initial });
  const [hist, setHist] = useState([]);
  const [lab, setLab] = useState({ name: '', pcs: 10 });
  const [sch, setSch] = useState({ date: today(), from: '14:00', to: '16:00', labId: 'all' });
  const [hf, setHf] = useState({ date: '', labId: '' });
  const [add, setAdd] = useState({});

  const load = () =>
    Promise.all([
      api('/api/labs'), api('/api/sessions'), api('/api/apps'),
      api('/api/blacklist'), api('/api/stats/overview'), api('/api/stats/absenteeism'),
    ])
      .then(([l, s, a, b, st, ab]) => {
        setLabs(l); setSessions(s); setApps(a); setBlack(b); setStats(st); setAbsent(ab);
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
      <nav className="flex gap-2 flex-wrap mb-6">
        {TABS.map((x) => (
          <Btn key={x} c={tab === x ? 'or' : 'w'} onClick={() => setTab(x)}>{x}</Btn>
        ))}
      </nav>
      {err && <Alert>{err}</Alert>}

      {tab === 'Overview' && stats && <Overview stats={stats} opts={opts} />}

      {tab === 'Labs' && (
        <Card t="Labs and computers">
          <div className="flex gap-3 mb-5">
            <Inp placeholder="Lab name" value={lab.name} onChange={(e) => setLab({ ...lab, name: e.target.value })} />
            <Inp type="number" min="0" className="!w-24" value={lab.pcs} onChange={(e) => setLab({ ...lab, pcs: e.target.value })} />
            <Btn onClick={() => act(async () => { await api('/api/labs', 'POST', lab); setLab({ name: '', pcs: 10 }); })}>Add</Btn>
          </div>
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
          <p className="mb-6 text-black/70">Students and staff choose from these lists when they create an account or book a lab.</p>
          {Object.entries(LISTS).map(([k, title]) => (
            <Card key={k} t={title}>
              <div className="flex flex-wrap gap-2 mb-5">
                {opts[k].map((x) => (
                  <span key={x} className="border border-black/20 rounded-[6px] px-3 py-1.5 font-medium">
                    {x}{' '}
                    <button aria-label={'Remove ' + x} className="text-[#f97316]" onClick={() => saveList(k, opts[k].filter((y) => y !== x))}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <Inp placeholder={'Add to ' + title.toLowerCase()} value={add[k] || ''} onChange={(e) => setAdd({ ...add, [k]: e.target.value })} />
                <Btn onClick={() => {
                  const v = (add[k] || '').trim();
                  if (v) saveList(k, [...opts[k], v]);
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
        <Card t="Applications">
          <Btn className="mb-5" onClick={() => act(() => api('/api/apps/approve-all', 'POST'))}>Approve all pending</Btn>
          {apps.length === 0 && <p>No applications yet.</p>}
          {apps.map((a) => (
            <Row key={a.id}>
              <span className="leading-relaxed">
                <b>{a.name}</b> · {a.cls || 'staff booking'} · {a.reason}
                <br />{fmt(a)} · <Badge s={a.status} />
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
          {black.length === 0 ? <p>Nobody is blacklisted.</p> : black.map((n) => (
            <span key={n} className="inline-flex items-center gap-2 border border-[#f97316] text-[#f97316] rounded-[6px] px-3 py-1.5 mr-3 mb-2 font-medium">
              {n}
              <button aria-label={'Unblock ' + n} onClick={() => act(() => api(`/api/blacklist/${encodeURIComponent(n)}`, 'DELETE'))}>×</button>
            </span>
          ))}
        </Card>
      )}

      {tab === 'Attendance' && (
        <div>
          <Card t="Mark attendance">
            {approved.length === 0 && <p>No approved students yet.</p>}
            {approved.map((a) => (
              <Row key={a.id}>
                <span><b>{a.name}</b> · {fmt(a)}</span>
                <span className="flex gap-2">
                  <Btn c={a.att === 'present' ? 'gr' : 'w'} onClick={() => setAtt(a, 'present')}>Present</Btn>
                  <Btn c={a.att === 'absent' ? 'or' : 'w'} onClick={() => setAtt(a, 'absent')}>Absent</Btn>
                </span>
              </Row>
            ))}
          </Card>

          <Card t="Absenteeism by student">
            {Object.keys(absent).length === 0 ? <p>No attendance recorded yet.</p> : (
              <table className="w-full text-left text-xs">
                <thead><tr><th className="pb-2">Student</th><th>Applied</th><th>Attended</th><th>Absent</th></tr></thead>
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
              <thead><tr><th className="pb-2">Date</th><th>Lab</th><th>Student</th><th>Class</th><th>Status</th><th>Attendance</th></tr></thead>
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
          {hist.length === 0 && <p className="mt-4">Pick a date and lab, then press Show history.</p>}
        </Card>
      )}
    </div>
  );
}

/* ================================================================== */
/* 9. DASHBOARD SHELL                                                  */
/* ================================================================== */

const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', psychosocial: 'Psychosocial worker', student: 'Student' };

function Dashboard({ user, opts, onLogout }) {
  const Page = user.role === 'admin' ? Admin : user.role === 'student' ? Student : Teacher;
  return (
    <div className="min-h-screen bg-black/[0.03] text-[#0b0f1a] text-[13px]">
      <header className="bg-white border-b border-black/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4 text-xs">
            <span><b>{user.name}</b> · {ROLE_LABEL[user.role] || user.role}</span>
            <Btn c="w" onClick={onLogout}>Log out</Btn>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <Page user={user} opts={opts} />
      </main>
    </div>
  );
}

/* ================================================================== */
/* 10. ROOT: landing -> auth -> dashboard                              */
/* ================================================================== */

export default function Home() {
  const [view, setView] = useState('home'); // 'home' | 'login' | 'register' | 'app'
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

  // Google login and sign up both hand over a JWT.
  const handleAuth = async (t) => {
    setToken(t);
    await loadOpts();
    setUser(await api('/api/me')); // { id, role, name }
    setView('app');
  };
  const logout = () => { setToken(''); setUser(null); setView('home'); };

  if (booting) return null;
  if (view === 'app' && user) return <Dashboard user={user} opts={opts} onLogout={logout} />;
  if (view === 'login' || view === 'register') {
    return <Auth key={view} opts={opts} initialMode={view} onDone={handleAuth} onBack={() => setView('home')} />;
  }
  return <Landing onLogin={() => setView('login')} onRegister={() => setView('register')} />;
}