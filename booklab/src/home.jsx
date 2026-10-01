import { useEffect, useState } from 'react';
import { api } from './api';
import { useLive } from './useLive';

/* ================================================================== */
/* 1. SMALL UI KIT (replaces ./ui)                                     */
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
      className={`px-3 py-1.5 text-xs font-semibold rounded-[6px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${look} ${className}`}
      {...p}
    />
  );
};

const Inp = ({ className = '', ...p }) => (
  <input
    className={`w-full px-2.5 py-1.5 text-xs rounded-[6px] border border-black/25 focus:outline-none focus:border-[#0b0f1a] ${className}`}
    {...p}
  />
);

const Sel = ({ o = [], className = '', ...p }) => (
  <select
    className={`w-full px-2 py-1.5 text-xs rounded-[6px] border border-black/25 bg-white ${className}`}
    {...p}
  >
    {o.map((x) => {
      const v = x.v ?? x;
      const t = x.t ?? x;
      return <option key={v} value={v}>{t}</option>;
    })}
  </select>
);

const Card = ({ t, children }) => (
  <section className="rounded-[6px] border border-black/10 bg-white p-4 mb-3">
    <h3 className="text-sm font-semibold mb-3">{t}</h3>
    {children}
  </section>
);

const Alert = ({ ok, children }) => (
  <p
    role={ok ? 'status' : 'alert'}
    className={`rounded-[6px] border px-3 py-2 mb-3 text-xs font-medium ${
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
    <span className="block mb-1">{l}</span>
    {children}
  </label>
);

const Logo = () => (
  <div className="flex items-center gap-2 font-bold text-sm">
    <span className="w-6 h-6 rounded-[6px] bg-[#f97316] text-white grid place-items-center text-xs">L</span>
    LabBook
  </div>
);

const Scene = ({ alt = 'Computer lab illustration' }) => (
  <svg viewBox="0 0 600 420" role="img" aria-label={alt} className="w-full h-auto block bg-black/[0.03]">
    <rect y="320" width="600" height="100" fill="#e5e7eb" />
    {[60, 230, 400].map((x) => (
      <g key={x}>
        <rect x={x} y="250" width="140" height="12" rx="4" fill="#111827" />
        <rect x={x + 20} y="160" width="100" height="70" rx="8" fill="#111827" />
        <rect x={x + 28} y="168" width="84" height="54" rx="4" fill="#38bdf8" />
        <rect x={x + 62} y="230" width="16" height="20" fill="#111827" />
        <circle cx={x + 70} cy="120" r="22" fill="#f59e0b" />
        <rect x={x + 45} y="145" width="50" height="10" rx="5" fill="#16a34a" />
      </g>
    ))}
  </svg>
);

/* ================================================================== */
/* 2. LANDING PAGE                                                     */
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
  ['Create your account', 'Pick your grade, class and subject combination from options your school sets.'],
  ['Find an open lab', 'Browse published lab times and check the seats left in real time.'],
  ['Apply and attend', 'Choose a reason, get approved and show up. Attendance is recorded.'],
];
const TEAM = [
  ['JH', 'Jean Habimana', 'Head of ICT', 'Sets lab schedules and approves requests.', 'bg-[#0b0f1a]'],
  ['AU', 'Alice Uwase', 'Computer Science Teacher', 'Books classes and guides practical sessions.', 'bg-[#16a34a]'],
  ['EN', 'Eric Niyonzima', 'Psychosocial Worker', 'Supports students and books lab time for them.', 'bg-[#f97316]'],
];
const FAQ = [
  ['Who can book a lab?', 'Students apply for themselves. Teachers and psychosocial workers can book for a class or chosen students.'],
  ['What if a lab is full?', 'Apply is disabled when no seats remain, and admins can move students between labs.'],
  ['Can booking access be removed?', 'Yes. Admins can blacklist a student who misuses lab time.'],
];

const WRAP = 'max-w-6xl mx-auto px-5';
const EYEBROW = 'inline-block text-[11px] font-semibold text-[#f97316] tracking-[0.16em] uppercase';

const Heading = ({ eyebrow, title, className = '' }) => (
  <>
    <span className={EYEBROW}>{eyebrow}</span>
    <h2 className={`mt-2 text-2xl md:text-3xl font-bold tracking-tight ${className}`}>{title}</h2>
  </>
);

function Header({ onLogin, onRegister }) {
  return (
    <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-black/5">
      <div className={`${WRAP} h-14 flex items-center justify-between`}>
        <Logo />
        <nav className="hidden md:flex gap-1 text-xs font-medium">
          {NAV.map(([h, t]) => (
            <a key={h} href={`#${h}`} className="px-3 py-1.5 rounded-[6px] hover:bg-black/5">{t}</a>
          ))}
        </nav>
        <div className="flex gap-2">
          <Btn c="w" onClick={onLogin}>Log in</Btn>
          <Btn c="or" onClick={onRegister}>Get started</Btn>
        </div>
      </div>
    </header>
  );
}

function Hero({ onLogin, onRegister }) {
  return (
    <section className={`${WRAP} pt-8 pb-16 grid lg:grid-cols-2 gap-10 items-center`}>
      <div>
        <span className="inline-flex items-center gap-2 rounded-[6px] border border-black/10 px-3 py-1 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-[6px] bg-[#16a34a]" />
          Now taking lab bookings
        </span>
        <h1 className="mt-4 text-3xl md:text-5xl font-bold leading-[1.08] tracking-tight">
          Book your lab seat in <span className="text-[#f97316]">seconds.</span>
        </h1>
        <p className="mt-4 text-sm text-black/60 max-w-md leading-relaxed">
          A modern way to run your school's computer labs. Publish schedules, take bookings,
          approve fairly and track attendance, all in one place.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Btn className="!px-5 !py-2.5" onClick={onRegister}>Create your account</Btn>
          <Btn c="w" className="!px-5 !py-2.5" onClick={onLogin}>Log in</Btn>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs font-medium text-black/70">
          {HERO_POINTS.map((p) => (
            <li key={p}><span className="text-[#16a34a] font-bold mr-1.5">✓</span>{p}</li>
          ))}
        </ul>
      </div>

      <div className="relative">
        <div className="rounded-[6px] border border-black/10 overflow-hidden shadow-lg">
          <Scene alt="Students working at computers in a lab" />
        </div>
        <div className="absolute left-2 -bottom-3 bg-white rounded-[6px] shadow-md border border-black/5 px-3 py-2 text-xs font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-[6px] bg-[#16a34a] text-white grid place-items-center">✓</span>
          <span>Booking approved<br /><span className="text-black/50 font-normal">Lab 1 · 14:00</span></span>
        </div>
        <div className="absolute right-2 top-3 bg-white rounded-[6px] shadow-md border border-black/5 px-3 py-2 text-xs font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-[6px] bg-[#f97316] text-white grid place-items-center">4</span>
          <span>seats left<br /><span className="text-black/50 font-normal">updating live</span></span>
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="bg-[#0b0f1a] text-white">
      <div className={`${WRAP} py-7 grid grid-cols-2 md:grid-cols-4 gap-6`}>
        {STATS.map(([a, b]) => (
          <div key={a}>
            <div className="text-xl font-bold text-[#f97316]">{a}</div>
            <div className="text-xs text-white/60 mt-0.5">{b}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className={`${WRAP} py-16`}>
      <Heading eyebrow="Services" title="Everything a school lab needs, without the paperwork." className="max-w-xl" />
      <div className="mt-8 grid md:grid-cols-3 gap-3">
        {SERVICES.map(({ title, text, theme, span = '' }, i) => {
          const t = CARD_THEMES[theme];
          return (
            <div key={title} className={`rounded-[6px] p-5 min-h-[140px] flex flex-col justify-between border border-black/10 ${t.box} ${span}`}>
              <span className={`text-xs font-semibold ${t.num}`}>0{i + 1}</span>
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className={`mt-1 text-xs ${t.text}`}>{text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InsideLab({ combos }) {
  return (
    <section id="lab" className={`${WRAP} pb-16 grid lg:grid-cols-2 gap-10 items-center`}>
      <div className="rounded-[6px] border border-black/10 overflow-hidden">
        <Scene alt="Students at their computers inside a school lab" />
      </div>
      <div>
        <span className={EYEBROW}>Inside the lab</span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Less queueing. More learning.</h2>
        <p className="mt-3 text-sm text-black/60 leading-relaxed">
          Every seat is accounted for. Students arrive knowing they have a computer, teachers
          know who is attending, and admins see how each lab is used.
        </p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {combos.map((c) => (
            <span key={c} className="rounded-[6px] border border-black/15 px-3 py-1 text-xs font-medium">{c}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-black/50">Subject combinations are set by your school admin.</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-black/[0.03]">
      <div className={`${WRAP} py-16`}>
        <Heading eyebrow="How it works" title="Three steps from sign-up to seat." />
        <div className="mt-8 grid md:grid-cols-3 gap-3">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="rounded-[6px] bg-white p-5 border border-black/5">
              <div className="text-3xl font-bold text-[#16a34a]">{i + 1}</div>
              <h3 className="mt-3 text-sm font-semibold">{t}</h3>
              <p className="mt-1 text-xs text-black/60">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team() {
  return (
    <section id="team" className={`${WRAP} py-16`}>
      <Heading eyebrow="Our team" title="The people behind the labs." />
      <div className="mt-8 grid md:grid-cols-3 gap-3">
        {TEAM.map(([ini, name, role, text, color]) => (
          <div key={name} className="rounded-[6px] border border-black/10 p-5">
            <div className={`w-10 h-10 rounded-[6px] text-white grid place-items-center text-xs font-semibold ${color}`}>{ini}</div>
            <h3 className="mt-3 text-sm font-semibold">{name}</h3>
            <div className="text-xs font-medium text-[#f97316]">{role}</div>
            <p className="mt-2 text-xs text-black/60">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="max-w-2xl mx-auto px-5 pb-16">
      <h2 className="text-2xl font-bold tracking-tight mb-4">Questions</h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="border-b border-black/10 py-3">
          <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
          <p className="mt-2 text-xs text-black/60">{a}</p>
        </details>
      ))}
    </section>
  );
}

function CallToAction({ onRegister }) {
  return (
    <section className="px-5 pb-12">
      <div className="max-w-6xl mx-auto rounded-[6px] bg-[#0b0f1a] text-white px-6 py-10 md:px-10 flex flex-wrap gap-5 justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight max-w-md">Ready to book your next lab session?</h2>
        <Btn c="or" className="!px-6 !py-2.5" onClick={onRegister}>Get started</Btn>
      </div>
    </section>
  );
}

function Landing({ opts, onLogin, onRegister }) {
  return (
    <div className="bg-white text-[#0b0f1a] antialiased text-sm">
      <Header onLogin={onLogin} onRegister={onRegister} />
      <Hero onLogin={onLogin} onRegister={onRegister} />
      <StatsBar />
      <Services />
      <InsideLab combos={opts.combos} />
      <HowItWorks />
      <Team />
      <Faq />
      <CallToAction onRegister={onRegister} />
      <footer className={`${WRAP} py-6 flex flex-wrap justify-between gap-3 text-xs text-black/50 border-t border-black/10`}>
        <Logo />
        <span>© 2026 Computer Lab Management System</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 3. LOGIN / REGISTER                                                 */
/* ================================================================== */

const ROLE_CHOICES = [
  { v: 'student', t: 'Student' },
  { v: 'teacher', t: 'Teacher' },
  { v: 'psychosocial', t: 'Psychosocial worker' },
];

function Auth({ opts, initialMode, onDone, onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    name: '', password: '', role: 'student',
    grade: opts.grades[0] || '', klass: opts.classes[0] || '', combo: opts.combos[0] || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isStudent = f.role === 'student';

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = mode === 'login'
        ? { name: f.name, password: f.password }
        : { name: f.name, password: f.password, role: f.role, ...(isStudent && { cls: f.grade + f.klass, combo: f.combo }) };
      const user = await api(mode === 'login' ? '/api/login' : '/api/register', 'POST', body);
      await onDone(user);
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <div className="min-h-screen bg-black/[0.03] grid place-items-center px-4 text-[13px] text-[#0b0f1a]">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="text-xs font-medium text-black/60 mb-3">← Back to home</button>
        <form onSubmit={submit} className="rounded-[6px] border border-black/10 bg-white p-5 space-y-3">
          <Logo />
          <h1 className="text-lg font-bold">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
          {err && <Alert>{err}</Alert>}

          <Field l="Full name"><Inp value={f.name} onChange={set('name')} required /></Field>
          <Field l="Password"><Inp type="password" value={f.password} onChange={set('password')} required /></Field>

          {mode === 'register' && (
            <>
              <Field l="I am a"><Sel o={ROLE_CHOICES} value={f.role} onChange={set('role')} /></Field>
              {isStudent && (
                <div className="grid grid-cols-2 gap-2">
                  <Field l="Grade"><Sel o={opts.grades} value={f.grade} onChange={set('grade')} /></Field>
                  <Field l="Class"><Sel o={opts.classes} value={f.klass} onChange={set('klass')} /></Field>
                  <div className="col-span-2">
                    <Field l="Subject combination"><Sel o={opts.combos} value={f.combo} onChange={set('combo')} /></Field>
                  </div>
                </div>
              )}
            </>
          )}

          <Btn className="w-full !py-2">{mode === 'login' ? 'Log in' : 'Create account'}</Btn>
          <p className="text-xs text-center text-black/60">
            {mode === 'login' ? 'New here? ' : 'Already registered? '}
            <button type="button" className="font-semibold text-[#f97316]" onClick={() => { setErr(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 4. STUDENT DASHBOARD                                                */
/* ================================================================== */

function Student({ opts }) {
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [reason, setReason] = useState(opts.reasons[0]);
  const [msg, setMsg] = useState('');

  const loadApps = () => api('/api/apps').then(setApps).catch((e) => setMsg(e.message));
  useEffect(() => { api('/api/sessions').then(setSessions); loadApps(); }, []);
  useLive({ seats: setSessions, 'applications:update': loadApps });

  const apply = async (id) => {
    try { await api('/api/apply', 'POST', { sessionId: id, reason }); setMsg(''); }
    catch (e) { setMsg(e.message); }
  };
  const mine = (id) => apps.find((a) => a.sid === id && a.status !== 'rejected');

  return (
    <div>
      {msg && <Alert>{msg}</Alert>}

      <Card t="Open labs">
        <div className="mb-3 max-w-xs">
          <Field l="Reason for booking"><Sel o={opts.reasons} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        {sessions.length === 0 && <p>No labs are open yet. Check back after the admin posts a schedule.</p>}
        {sessions.map((s) => (
          <div key={s.id} className="flex justify-between items-center border-b border-black/10 py-2.5 gap-3">
            <div>
              <b>{s.lab} · {s.date} {s.from}–{s.to}</b>
              <div className={s.left > 0 ? 'text-[#16a34a] font-medium' : 'text-[#f97316] font-bold'}>
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
          <p key={a.id} className="py-1">
            {a.lab} · {a.date} {a.from} · {a.reason} · <Badge s={a.status} />
          </p>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 5. TEACHER / PSYCHOSOCIAL DASHBOARD                                 */
/* ================================================================== */

function Teacher({ user, opts }) {
  const psy = user.role === 'psychosocial';
  const classes = opts.grades.flatMap((g) => opts.classes.map((c) => g + c));
  const classOpts = psy ? [{ v: '', t: 'All students' }, ...classes.map((c) => ({ v: c, t: c }))] : classes;

  const [cls, setCls] = useState(psy ? '' : classes[0] || '');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sid, setSid] = useState('');
  const [reason, setReason] = useState(opts.reasons[0]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [apps, setApps] = useState([]);

  const loadApps = () => api('/api/apps').then(setApps);

  useEffect(() => {
    api('/api/sessions').then((s) => { setSessions(s); setSid((id) => id || s[0]?.id || ''); });
    loadApps();
  }, []);
  useEffect(() => {
    setPicked([]);
    api(`/api/students?class=${cls}`).then(setStudents).catch((e) => { setOk(false); setMsg(e.message); });
  }, [cls]);
  useLive({ seats: setSessions, 'applications:update': loadApps });

  const toggle = (n) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const allPicked = students.length > 0 && picked.length === students.length;
  const current = sessions.find((s) => s.id === +sid);

  const book = async () => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: +sid, reason, students: picked });
      setOk(true); setMsg(`${r.created} booking(s) sent for approval.`); setPicked([]);
    } catch (e) { setOk(false); setMsg(e.message); }
  };

  return (
    <div>
      {msg && <Alert ok={ok}>{msg}</Alert>}

      <Card t={psy ? 'Book lab time for students' : 'Book lab time for a class'}>
        <div className="grid md:grid-cols-3 gap-3">
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
          <p className={`mt-3 font-medium ${current.left ? 'text-[#16a34a]' : 'text-[#f97316]'}`}>
            {current.left} of {current.seats} seats left in this lab
          </p>
        )}

        <div className="mt-3 flex justify-between items-center">
          <b>{students.length} students{cls ? ` in ${cls}` : ''}</b>
          <Btn c="w" onClick={() => setPicked(allPicked ? [] : students.map((s) => s.name))}>
            {allPicked ? 'Clear all' : 'Select whole class'}
          </Btn>
        </div>

        <div className="mt-2 divide-y divide-black/10">
          {students.length === 0 && <p className="py-2">No students found in this class yet.</p>}
          {students.map((s) => (
            <label key={s.name} className="flex items-center gap-2 py-1.5">
              <input type="checkbox" checked={picked.includes(s.name)} onChange={() => toggle(s.name)} />
              <span className="font-medium">{s.name}</span>
              {psy && <span className="text-black/60">{s.family} · {s.combo}</span>}
            </label>
          ))}
        </div>

        <Btn className="mt-3" disabled={!picked.length || !sid} onClick={book}>
          Book {picked.length || ''} student{picked.length === 1 ? '' : 's'}
        </Btn>
      </Card>

      <Card t="My bookings">
        {apps.length === 0 && <p>No bookings yet.</p>}
        {apps.map((a) => (
          <p key={a.id} className="py-1">
            {a.name} · {a.lab} {a.date} {a.from} · <Badge s={a.status} />
          </p>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 6. ADMIN DASHBOARD                                                  */
/* ================================================================== */

const TABS = ['Overview', 'Labs', 'Settings', 'Schedule', 'Applications', 'Attendance', 'History'];
const LISTS = {
  grades: 'Grades', classes: 'Classes', combos: 'Subject combinations', clubs: 'Clubs and activities',
  staffRoles: 'Staff roles', families: 'Families', reasons: 'Booking reasons',
};

const Bar = ({ label, value, max, c = 'bg-[#16a34a]', note }) => (
  <div className="flex items-center gap-2 mb-1.5">
    <span className="w-24 shrink-0 text-xs font-medium truncate">{label}</span>
    <div className="flex-1 h-4 rounded-[6px] border border-black/20 overflow-hidden">
      <div className={`${c} h-full`} style={{ width: (max ? Math.max((value / max) * 100, value ? 4 : 0) : 0) + '%' }} />
    </div>
    <b className="w-28 text-right text-xs">{note ?? value}</b>
  </div>
);

const Stat = ({ v, t, warn }) => (
  <div className={`rounded-[6px] border p-3 ${warn ? 'border-[#f97316] text-[#f97316]' : 'border-black/15'}`}>
    <div className="text-xl font-bold">{v}</div>
    <div className="text-xs font-medium">{t}</div>
  </div>
);

const Row = ({ children }) => (
  <div className="flex flex-wrap justify-between items-center border-b border-black/10 py-2 gap-2">{children}</div>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
        <Stat v={t.applications} t="Applications" />
        <Stat v={t.approved} t="Approved" />
        <Stat v={t.pending} t="Waiting" warn />
        <Stat v={t.rejected} t="Rejected" warn />
        <Stat v={rate === null ? '-' : rate + '%'} t="Attendance rate" />
      </div>

      {stats.mostRequested && t.applications > 0 && (
        <p className="mb-3 rounded-[6px] bg-[#16a34a] text-white p-2.5 font-semibold">Most requested lab: {stats.mostRequested}</p>
      )}

      <Card t="Seats used per lab">
        {stats.labs.map((l) => (
          <Bar key={l.lab} label={l.lab} value={l.usagePct} max={100}
            c={l.usagePct >= 90 ? 'bg-[#f97316]' : 'bg-[#16a34a]'}
            note={`${l.approved}/${l.seatsOffered} · ${l.usagePct}%`} />
        ))}
      </Card>

      <Card t="Applications per lab">
        <p className="mb-2">Green is approved, white is waiting, orange is rejected.</p>
        {stats.labs.map((l) => (
          <div key={l.lab} className="flex items-center gap-2 mb-1.5">
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

      <div className="grid md:grid-cols-2 gap-3">
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
              <p className="mt-2 font-semibold">
                <span className="text-[#16a34a]">{stats.attendance.present} present</span> ·{' '}
                <span className="text-[#f97316]">{stats.attendance.absent} absent</span>
              </p>
            </>
          )}
          <h4 className="font-semibold mt-3 mb-2">Applications by day</h4>
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
  const [opts, setOpts] = useState(initial);
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
  const saveList = (k, list) => act(async () => setOpts(await api('/api/options', 'PUT', { [k]: list })));
  const runHistory = () => act(async () => setHist(await api(`/api/history?date=${hf.date}&labId=${hf.labId}`)));
  const setStatus = (a, status) => act(() => api(`/api/apps/${a.id}/status`, 'PATCH', { status }));
  const setAtt = (a, att) => act(() => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att }));
  const labChoices = (first) => [first, ...labs.map((l) => ({ v: l.id, t: l.name }))];
  const approved = apps.filter((a) => a.status === 'approved');

  return (
    <div>
      <nav className="flex gap-1.5 flex-wrap mb-3">
        {TABS.map((x) => (
          <Btn key={x} c={tab === x ? 'or' : 'w'} onClick={() => setTab(x)}>{x}</Btn>
        ))}
      </nav>
      {err && <Alert>{err}</Alert>}

      {tab === 'Overview' && stats && <Overview stats={stats} opts={opts} />}

      {tab === 'Labs' && (
        <Card t="Labs and computers">
          <div className="flex gap-2 mb-3">
            <Inp placeholder="Lab name" value={lab.name} onChange={(e) => setLab({ ...lab, name: e.target.value })} />
            <Inp type="number" min="0" className="!w-24" value={lab.pcs} onChange={(e) => setLab({ ...lab, pcs: e.target.value })} />
            <Btn onClick={() => act(async () => { await api('/api/labs', 'POST', lab); setLab({ name: '', pcs: 10 }); })}>Add</Btn>
          </div>
          {labs.map((l) => (
            <Row key={l.id}>
              <b>{l.name}</b>
              <span className="flex items-center gap-2">
                <Inp type="number" min="0" className="!w-20" defaultValue={l.pcs}
                  onBlur={(e) => +e.target.value !== l.pcs && act(() => api(`/api/labs/${l.id}`, 'PUT', { pcs: +e.target.value }))} />
                computers
                <Btn c="or" onClick={() => confirm(`Delete ${l.name}?`) && act(() => api(`/api/labs/${l.id}`, 'DELETE'))}>Delete</Btn>
              </span>
            </Row>
          ))}
        </Card>
      )}

      {tab === 'Settings' && (
        <div>
          <p className="mb-3 text-black/70">Students and staff choose from these lists when they create an account or book a lab.</p>
          {Object.entries(LISTS).map(([k, title]) => (
            <Card key={k} t={title}>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {opts[k].map((x) => (
                  <span key={x} className="border border-black/20 rounded-[6px] px-2.5 py-1 font-medium">
                    {x}{' '}
                    <button aria-label={'Remove ' + x} className="text-[#f97316]" onClick={() => saveList(k, opts[k].filter((y) => y !== x))}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
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
          <div className="grid md:grid-cols-4 gap-2">
            <Inp type="date" value={sch.date} onChange={(e) => setSch({ ...sch, date: e.target.value })} />
            <Inp type="time" value={sch.from} onChange={(e) => setSch({ ...sch, from: e.target.value })} />
            <Inp type="time" value={sch.to} onChange={(e) => setSch({ ...sch, to: e.target.value })} />
            <Sel o={labChoices({ v: 'all', t: 'All labs' })} value={sch.labId} onChange={(e) => setSch({ ...sch, labId: e.target.value })} />
          </div>
          <Btn className="my-3" onClick={() => act(() => api('/api/sessions', 'POST', {
            date: sch.date, from: sch.from, to: sch.to,
            labIds: sch.labId === 'all' ? undefined : [+sch.labId],
          }))}>Publish schedule</Btn>

          {sessions.map((s) => (
            <Row key={s.id}>
              <span>{fmt(s)} · <b>{s.left}/{s.seats} seats left</b></span>
              <span className="flex gap-2">
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
          <Btn className="mb-3" onClick={() => act(() => api('/api/apps/approve-all', 'POST'))}>Approve all pending</Btn>
          {apps.length === 0 && <p>No applications yet.</p>}
          {apps.map((a) => (
            <Row key={a.id}>
              <span>
                <b>{a.name}</b> · {a.cls || 'staff booking'} · {a.reason}
                <br />{fmt(a)} · <Badge s={a.status} />
              </span>
              <span className="flex flex-wrap gap-1.5 items-center">
                <Btn onClick={() => setStatus(a, 'approved')}>Approve</Btn>
                <Btn c="or" onClick={() => setStatus(a, 'rejected')}>Reject</Btn>
                <select className="rounded-[6px] border border-black/25 px-2 py-1.5 text-xs" value=""
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

          <h4 className="font-semibold mt-4 mb-2">Blacklisted students</h4>
          {black.length === 0 ? <p>Nobody is blacklisted.</p> : black.map((n) => (
            <span key={n} className="inline-flex items-center gap-2 border border-[#f97316] text-[#f97316] rounded-[6px] px-2.5 py-1 mr-2 font-medium">
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
                <span className="flex gap-1.5">
                  <Btn c={a.att === 'present' ? 'gr' : 'w'} onClick={() => setAtt(a, 'present')}>Present</Btn>
                  <Btn c={a.att === 'absent' ? 'or' : 'w'} onClick={() => setAtt(a, 'absent')}>Absent</Btn>
                </span>
              </Row>
            ))}
          </Card>

          <Card t="Absenteeism by student">
            {Object.keys(absent).length === 0 ? <p>No attendance recorded yet.</p> : (
              <table className="w-full text-left text-xs">
                <thead><tr><th>Student</th><th>Applied</th><th>Attended</th><th>Absent</th></tr></thead>
                <tbody>
                  {Object.entries(absent).sort((a, b) => b[1].absent - a[1].absent).map(([n, r]) => (
                    <tr key={n} className="border-t border-black/10">
                      <td className="py-1.5 font-medium">{n}</td>
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
          <div className="grid md:grid-cols-3 gap-2 mb-3">
            <Inp type="date" value={hf.date} onChange={(e) => setHf({ ...hf, date: e.target.value })} />
            <Sel o={labChoices({ v: '', t: 'All labs' })} value={hf.labId} onChange={(e) => setHf({ ...hf, labId: e.target.value })} />
            <Btn onClick={runHistory}>Show history</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr><th>Date</th><th>Lab</th><th>Student</th><th>Class</th><th>Status</th><th>Attendance</th></tr></thead>
              <tbody>
                {hist.map((a) => (
                  <tr key={a.id} className="border-t border-black/10">
                    <td className="py-1.5">{a.date}</td><td>{a.lab} {a.from}</td><td>{a.name}</td>
                    <td>{a.cls}</td><td><Badge s={a.status} /></td><td>{a.att || 'not marked'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hist.length === 0 && <p className="mt-2">Pick a date and lab, then press Show history.</p>}
        </Card>
      )}
    </div>
  );
}

/* ================================================================== */
/* 7. DASHBOARD SHELL                                                  */
/* ================================================================== */

const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', psychosocial: 'Psychosocial worker', student: 'Student' };

function Dashboard({ user, opts, onLogout }) {
  const Page = user.role === 'admin' ? Admin : user.role === 'student' ? Student : Teacher;
  return (
    <div className="min-h-screen bg-black/[0.03] text-[#0b0f1a] text-[13px]">
      <header className="bg-white border-b border-black/10">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3 text-xs">
            <span><b>{user.name}</b> · {ROLE_LABEL[user.role] || user.role}</span>
            <Btn c="w" onClick={onLogout}>Log out</Btn>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-4">
        <Page user={user} opts={opts} />
      </main>
    </div>
  );
}

/* ================================================================== */
/* 8. ROOT: landing -> auth -> dashboard                               */
/* ================================================================== */

const EMPTY_OPTS = { grades: [], classes: [], combos: [], clubs: [], staffRoles: [], families: [], reasons: [] };

export default function Home() {
  const [view, setView] = useState('home'); // 'home' | 'login' | 'register' | 'app'
  const [user, setUser] = useState(null);
  const [opts, setOpts] = useState(EMPTY_OPTS);

  useEffect(() => { api('/api/options').then(setOpts).catch(() => {}); }, []);

  // Load school options after sign-in, then open the right dashboard.
  const handleAuth = async (u) => {
    try { setOpts(await api('/api/options')); } catch { /* keep current options */ }
    setUser(u);
    setView('app');
  };
  const logout = () => { setUser(null); setView('home'); };

  if (view === 'app' && user) return <Dashboard user={user} opts={opts} onLogout={logout} />;
  if (view === 'login' || view === 'register') {
    return <Auth key={view} opts={opts} initialMode={view} onDone={handleAuth} onBack={() => setView('home')} />;
  }
  return <Landing opts={opts} onLogin={() => setView('login')} onRegister={() => setView('register')} />;
}