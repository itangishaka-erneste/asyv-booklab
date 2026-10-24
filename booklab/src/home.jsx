import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { CalendarDays, CalendarCheck2, UserRound, LayoutDashboard, FlaskConical, CalendarClock, UsersRound, MessageCircle, Settings2, PackageSearch } from 'lucide-react';
import logo from './assets/as.png';

/* ================================================================== */
/* 0. CONFIG, API, LIVE SOCKET                                         */
/* ================================================================== */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const DEFAULT_GRADES = ['S4', 'S5', 'S6'];
const DEFAULT_CATS = ['Clothes', 'Shoes', 'Keys', 'Bags', 'Phones and electronics', 'Books and stationery', 'Documents and IDs', 'Water bottles and lunch boxes', 'Jewelry and watches', 'Other'];
const SECTIONS = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
const EMPTY_OPTS = { grades: [], gradeCombos: {}, reasons: [], trendCategories: [] };
const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', psychosocial: 'Psychosocial worker', student: 'Student' };
const ROLE_CHOICES = ['student', 'teacher', 'psychosocial'];
const ADMIN_TABS = ['Overview', 'Labs', 'Schedule', 'People', 'Chat', 'Settings'];
const gradesOf = (o) => (o.grades?.length ? o.grades : DEFAULT_GRADES);
const combosFor = (o, g) => o.gradeCombos?.[g] ?? [];
const catsOf = (o) => (o?.trendCategories?.length ? o.trendCategories : DEFAULT_CATS);

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

// One shared socket per login. It is dropped on sign in and sign out so the new token is used.
let sock = null;
const liveSocket = () => { if (!sock) sock = io(BASE, { auth: { token } }); return sock; };
const dropSocket = () => { sock?.disconnect(); sock = null; };

function useLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const s = liveSocket();
    const subs = Object.keys(ref.current).map((ev) => {
      const f = (...a) => ref.current[ev]?.(...a);
      s.on(ev, f);
      return [ev, f];
    });
    return () => subs.forEach(([ev, f]) => s.off(ev, f));
  }, []);
}

/* ================================================================== */
/* 1. HELPERS                                                          */
/* ================================================================== */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => dayOffset(0);
const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const niceDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
const shortDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const weekdayShort = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' }); };
const nameKey = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
const match = (q, ...fields) => {
  const hay = fields.join(' ').toLowerCase();
  return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};
const initials = (name) => String(name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const gravatar = (gid) => (gid ? `https://www.gravatar.com/avatar/${gid}?s=96&d=404` : '');
const cartoon = (name) => `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(nameKey(name) || 'user')}&backgroundColor=b6e3f4,c0aadd,d1d4f9,ffd5dc,ffdfbf`;
const ago = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const dayHead = (iso) => { const d = ymd(new Date(iso)); return d === today() ? 'Today' : d === dayOffset(-1) ? 'Yesterday' : niceDay(d); };
const listTime = (iso) => { const d = ymd(new Date(iso)); return d === today() ? clock(iso) : shortDay(d); };
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
// Photo of a lost item: an uploaded image is served by the API, a link is converted when possible.
const itemPhoto = (m) => {
  if (m.kind === 'image') return m.src?.startsWith('/') ? BASE + m.src : directImg(m.src);
  if (m.kind === 'link') { const d = directImg(m.src); return d !== m.src ? d : ''; }
  return '';
};
const byTime = (a, b) => `${a.date} ${a.from} ${a.lab}`.localeCompare(`${b.date} ${b.from} ${b.lab}`);
const forLabel = (s) => s.forGroupName || s.forClass || (s.forPeople ? `${s.forPeople} chosen student${s.forPeople === 1 ? '' : 's'}` : '');
const audText = (s) => (forLabel(s) ? `${s.exclusive ? 'Only ' : 'Reserved for '}${forLabel(s)}` : 'Everyone');
const attKey = (a) => (a.att === 'present' && a.late ? 'late' : a.att || '');
const attLabel = (a) => ({ present: 'Present', late: 'Late', absent: 'Absent' }[attKey(a)] || 'Not marked');
const STATUS_LABEL = { pending: 'Waiting', queue: 'In queue', released: 'Released', approved: 'Approved', rejected: 'Rejected' };
const statusKey = (a, s) => (a.released ? 'released' : a.status === 'pending' && s && s.left < 1 ? 'queue' : a.status);
const STATE_LABEL = { draft: 'Draft', over: 'Over', full: 'Full', open: 'Open' };
const LAB_STATUS_TEXT = { open: 'Open', full: 'Full', over: 'Over', draft: 'Draft', none: 'No lab time' };
const labStatus = (sessions) => {
  if (!sessions.length) return 'none';
  if (sessions.every((s) => s.state === 'draft')) return 'draft';
  if (sessions.every((s) => s.state === 'over' || s.state === 'draft')) return 'over';
  if (sessions.some((s) => s.state === 'open')) return 'open';
  return 'full';
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The people who really hold a place or wait for one (released and rejected are left out).
const liveOf = (s) => s.people.filter((a) => a.status !== 'rejected');

/* Printing: admin only. Students never see print buttons. */
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PRINT_CSS = `@page{size:A4 landscape;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:12px system-ui,sans-serif;color:#111;margin:0}h1{font-size:20px;margin:0 0 4px}.sub{color:#555;margin:0 0 12px}
h2{font-size:15px;margin:20px 0 4px}h3{font-size:13px;margin:12px 0 6px;padding:5px 8px;background:#e8efe9;border-left:4px solid #16a34a}
table{width:100%;border-collapse:collapse;margin-bottom:6px}td,th{border:1px solid #666;padding:6px 8px;text-align:left}th{background:#f3f4f6}
.sec{page-break-inside:avoid}.lab{page-break-before:auto}.foot{margin-top:14px;color:#777;font-size:10px}`;
function printDoc(title, sub, html) {
  const w = window.open('', '_blank');
  if (!w) { window.alert('Please allow pop-ups to print.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>
    <h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${html}<p class="foot">Asyv_lms · printed ${esc(new Date().toLocaleString())}</p></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
const tableHtml = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const ROSTER_HEAD = ['#', 'Name', 'Class', 'Status', 'Attendance', 'Signature'];
const rosterRows = (s, list) => list.map((a, i) => [i + 1, a.name, a.cls || '', STATUS_LABEL[statusKey(a, s)] || a.status, attKey(a) ? attLabel(a) : '', '']);
const sessionHead = (s, list) => `${s.from}–${s.to} · ${STATE_LABEL[s.state]} · ${plural(list.length, 'student')} applied · ${s.seats - s.left} of ${s.seats} places taken · ${audText(s)}`;
// One lab time on one page.
function printSession(lab, s) {
  const list = liveOf(s);
  printDoc(`${lab.name} · ${niceDay(s.date)}`, sessionHead(s, list), tableHtml(ROSTER_HEAD, rosterRows(s, list)));
}
// One lab (or every lab) with all its lab times of the day.
function printLabs(labs, day) {
  const html = labs.map((l) => `<div class="lab"><h2>${esc(l.name)} · ${l.pcs} computers</h2>${l.sessions.length
    ? l.sessions.map((s) => { const list = liveOf(s); return `<div class="sec"><h3>${esc(sessionHead(s, list))}</h3>${tableHtml(ROSTER_HEAD, rosterRows(s, list))}</div>`; }).join('')
    : '<p>No lab time on this day.</p>'}</div>`).join('');
  printDoc(labs.length === 1 ? `${labs[0].name} · ${niceDay(day)}` : `All labs · ${niceDay(day)}`, `Printed list of the students of each lab time`, html);
}

/* ================================================================== */
/* 2. UI KIT                                                           */
/* ================================================================== */

const BTN = {
  ink: 'bg-[#16a34a] text-white', or: 'bg-[#ff4500] text-white', bl: 'bg-[#2563eb] text-white',
  dk: 'bg-[#111827] text-white', am: 'bg-[#f59e0b] text-white', w: 'bg-white text-[#111827] border border-black/20 hover:bg-black/5',
};
const Btn = ({ c = 'ink', className = '', ...p }) => (
  <button type="button" className={`px-4 py-2 text-xs font-semibold rounded-[6px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${BTN[c]} ${className}`} {...p} />
);
const ActBtn = ({ busy, label, doing = 'Working…', c = 'ink', disabled, className = '', ...p }) => (
  <Btn c={c} className={className} disabled={busy || disabled} {...p}>
    <span className="inline-flex items-center gap-2">
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {busy ? doing : label}
    </span>
  </Btn>
);
const FIELD = 'w-full px-3 py-2 text-xs rounded-[6px] border border-black/20 bg-white focus:outline-none focus:border-[#16a34a] disabled:bg-black/5';
const Inp = ({ className = '', ...p }) => <input className={`${FIELD} ${className}`} {...p} />;
const Sel = ({ options, value, onChange, className = '', ...p }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} ${className}`} {...p}>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
const Field = ({ l, hint, children }) => (
  <label className="block text-xs font-medium">
    <span className="mb-1.5 block">{l}</span>
    {children}
    {hint && <span className="mt-1.5 block font-normal text-black/50">{hint}</span>}
  </label>
);
const Card = ({ t, sub, action, children, className = '' }) => (
  <section className={`rounded-[8px] border border-black/10 bg-white p-5 ${className}`}>
    {(t || action) && (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {t && <h3 className="text-sm font-semibold">{t}</h3>}
          {sub && <p className="mt-1 text-xs text-black/55">{sub}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);
const Alert = ({ ok, children }) => (
  <p role={ok ? 'status' : 'alert'}
    className={`rounded-[6px] border px-4 py-3 text-xs font-medium ${ok ? 'border-[#16a34a]/40 bg-[#16a34a]/5 text-[#15803d]' : 'border-[#ff4500]/40 bg-[#ff4500]/5 text-[#c2310a]'}`}>
    {children}
  </p>
);
const BADGE = {
  approved: 'bg-[#16a34a] text-white', pending: 'bg-[#ff4500]/10 text-[#c2310a]', rejected: 'bg-black/10 text-black/55',
  present: 'bg-[#16a34a] text-white', absent: 'bg-[#ff4500]/10 text-[#c2310a]', late: 'bg-[#f59e0b]/15 text-[#b45309]',
  returned: 'bg-[#2563eb]/10 text-[#1d4ed8]', removed: 'bg-black/10 text-black/55', open: 'bg-[#16a34a]/10 text-[#15803d]',
  full: 'bg-[#ff4500] text-white', over: 'bg-[#dc2626] text-white', draft: 'bg-[#2563eb]/10 text-[#1d4ed8]',
  published: 'bg-[#16a34a]/10 text-[#15803d]', none: 'bg-black/5 text-black/60', queue: 'bg-[#2563eb]/10 text-[#1d4ed8]',
  released: 'bg-black/10 text-black/55', active: 'bg-[#16a34a] text-white',
};
const Badge = ({ s, children }) => (
  <span className={`inline-block whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${BADGE[s] || 'bg-black/5 text-black/60'}`}>{children || s}</span>
);
const Empty = ({ children }) => <p className="py-6 text-center text-sm text-black/50">{children}</p>;
const Stat = ({ v, t, tone }) => {
  const color = { gr: 'text-[#16a34a]', or: 'text-[#ff4500]', am: 'text-[#b45309]', rd: 'text-[#dc2626]' }[tone] || 'text-[#111827]';
  return (
    <div className="rounded-[8px] border border-black/10 bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{v}</div>
      <div className="mt-1 text-xs font-medium text-black/60">{t}</div>
    </div>
  );
};
const Loader = ({ label = 'Loading', full = false }) => {
  const el = (
    <div role="status" className="flex flex-col items-center gap-2">
      <div className="relative grid h-14 w-14 place-items-center rounded-full">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#16a34a]/20 border-t-[#ff4500]" />
        <span className="text-[11px] font-extrabold text-[#16a34a]">Asyv</span>
      </div>
      <span className="text-xs text-black/55">{label}…</span>
    </div>
  );
  return full ? <div className="grid min-h-[50vh] place-items-center">{el}</div> : el;
};
const Modal = ({ title, onClose, wide, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title}
      className={`my-auto max-h-[92vh] w-full overflow-y-auto rounded-[8px] bg-white p-6 shadow-xl ${wide ? 'max-w-3xl' : 'max-w-md'}`}
      onClick={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="text-xl leading-none text-black/50 hover:text-black">×</button>
      </div>
      {children}
    </div>
  </div>
);
const SearchBox = ({ value, onChange, placeholder = 'Search' }) => (
  <Inp type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
);
const Pills = ({ value, onChange, items }) => (
  <div className="flex flex-wrap gap-2">
    {items.map(([v, t, n]) => (
      <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
        className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold ${value === v ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-black/15 bg-white text-black/70 hover:bg-black/5'}`}>
        {t}{n != null && <span className="ml-1.5 opacity-70">{n}</span>}
      </button>
    ))}
  </div>
);
const DayBar = ({ day, onChange }) => (
  <div className="flex flex-wrap items-center gap-2">
    <Btn c="w" onClick={() => onChange(shiftDay(day, -1))}>← Previous day</Btn>
    <Inp type="date" aria-label="Choose a day" value={day} onChange={(e) => e.target.value && onChange(e.target.value)} className="!w-40" />
    <Btn c="w" onClick={() => onChange(shiftDay(day, 1))}>Next day →</Btn>
    {day !== today() && <Btn onClick={() => onChange(today())}>Today</Btn>}
  </div>
);
const Avatar = ({ name, picture, gid, className = 'h-10 w-10 text-xs' }) => {
  const srcs = [directImg(picture), gravatar(gid), cartoon(name)].filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [picture, gid, name]);
  if (i < srcs.length) {
    return <img src={srcs[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)} className={`shrink-0 rounded-full bg-black/10 object-cover ${className}`} />;
  }
  return <span className={`grid shrink-0 place-items-center rounded-full bg-[#16a34a] font-bold text-white ${className}`}>{initials(name)}</span>;
};
const Person = ({ p, sub, className = 'h-9 w-9 text-xs' }) => (
  <span className="flex min-w-0 items-center gap-3">
    <Avatar name={p.name} picture={p.picture} gid={p.gid} className={className} />
    <span className="min-w-0">
      <b className="block truncate">{p.name}</b>
      <span className="block truncate text-xs text-black/55">{sub ?? (p.email || 'No email')}</span>
    </span>
  </span>
);

// Waits for one action at a time. A second click does nothing while busy.
function useBusy() {
  const [busy, setBusy] = useState('');
  const ref = useRef('');
  const run = useCallback(async (key, fn) => {
    if (ref.current) return undefined;
    ref.current = key;
    setBusy(key);
    try { return await fn(); }
    finally { ref.current = ''; setBusy(''); }
  }, []);
  return { busy, run };
}

const ConfirmCtx = createContext(null);
function ConfirmProvider({ children }) {
  const [st, setSt] = useState(null);
  const ask = useCallback((o) => new Promise((resolve) => setSt({ ...o, resolve })), []);
  const close = (v) => { st.resolve(v); setSt(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {st && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm overflow-hidden rounded-[10px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`border-l-4 p-6 ${st.danger ? 'border-[#ff4500]' : 'border-[#16a34a]'}`}>
              <h3 className="text-base font-bold">{st.title || 'Are you sure?'}</h3>
              <p className="mt-2 text-xs leading-relaxed text-black/65">{st.message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-black/10 bg-black/[0.02] px-6 py-4">
              <Btn c="w" onClick={() => close(false)}>Cancel</Btn>
              <Btn c={st.danger ? 'or' : 'ink'} onClick={() => close(true)}>{st.ok || 'Yes, continue'}</Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
const useConfirm = () => useContext(ConfirmCtx);

// Runs a change, shows the result, then reloads the page data.
function useAct(reload) {
  const { busy, run } = useBusy();
  const [note, setNote] = useState(null);
  const ask = useConfirm();
  const act = (key, fn, done = '') => run(key, async () => {
    setNote(null);
    try {
      const r = await fn();
      if (done) setNote({ ok: true, text: typeof done === 'function' ? done(r) : done });
      await reload?.();
      return true;
    } catch (e) {
      setNote({ ok: false, text: e.message });
      return false;
    }
  });
  const sure = async (o, key, fn, done) => ((await ask(o)) ? act(key, fn, done) : false);
  return { busy, act, sure, note, setNote };
}

// Pick students by checkbox, with search. Value is a list of student names.
function StudentPicker({ students, value, onChange }) {
  const [q, setQ] = useState('');
  const shown = students.filter((s) => match(q, s.name, s.className || '', s.email || '')).slice(0, 200);
  const has = (n) => value.includes(n);
  const toggle = (n) => onChange(has(n) ? value.filter((x) => x !== n) : [...value, n]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1"><SearchBox value={q} onChange={setQ} placeholder="Search students by name or class" /></div>
        <span className="text-xs text-black/55">{value.length} selected</span>
        <Btn c="w" onClick={() => onChange([...new Set([...value, ...shown.map((s) => s.name)])])}>Select shown</Btn>
        <Btn c="w" onClick={() => onChange([])}>Clear</Btn>
      </div>
      <div className="mt-3 max-h-56 divide-y divide-black/10 overflow-y-auto rounded-[6px] border border-black/10">
        {shown.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-black/[0.02]">
            <input type="checkbox" className="h-4 w-4 accent-[#16a34a]" checked={has(s.name)} onChange={() => toggle(s.name)} />
            <Person p={s} className="h-7 w-7 text-[10px]" />
            <span className="ml-auto text-xs text-black/55">{s.className || 'No class'}</span>
          </label>
        ))}
        {shown.length === 0 && <Empty>No student found.</Empty>}
      </div>
    </div>
  );
}

// Who a lab time is for: everyone, a class, a group, or chosen students. Used when creating and when editing.
const BLANK_AUD = { kind: '', value: '', people: [], exclusive: true };
const audFrom = (s) => {
  const ex = !!s.exclusive;
  if (s.forClass) return { kind: 'class', value: s.forClass, people: [], exclusive: ex };
  if (s.forGroup) return { kind: 'group', value: String(s.forGroup), people: [], exclusive: ex };
  if (s.forPeople) return { kind: 'people', value: '', people: s.people || [], exclusive: ex };
  return { ...BLANK_AUD };
};
const audOk = (a) => !a.kind || (a.kind === 'people' ? a.people.length > 0 : !!a.value);
function AudiencePicker({ value, onChange, classes, groups, students }) {
  const set = (p) => onChange({ ...value, ...p });
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field l="Who is this lab time for?">
          <Sel value={value.kind} onChange={(kind) => set({ kind, value: '', people: [] })} options={[
            { value: '', label: 'Everyone' }, { value: 'class', label: 'A class' }, { value: 'group', label: 'A group' }, { value: 'people', label: 'Chosen students' },
          ]} />
        </Field>
        {value.kind && (
          <Field l="Can other students join?">
            <Sel value={String(value.exclusive)} onChange={(v) => set({ exclusive: v === 'true' })} options={[
              { value: 'true', label: 'No, only they can join' }, { value: 'false', label: 'Yes, they get places and the rest stay open' },
            ]} />
          </Field>
        )}
      </div>
      {value.kind === 'class' && <div className="mt-4"><Field l="Class"><Sel value={value.value} onChange={(v) => set({ value: v })} options={[{ value: '', label: 'Choose a class…' }, ...classes.map((c) => ({ value: c, label: c }))]} /></Field></div>}
      {value.kind === 'group' && <div className="mt-4"><Field l="Group"><Sel value={value.value} onChange={(v) => set({ value: v })} options={[{ value: '', label: 'Choose a group…' }, ...groups.map((g) => ({ value: String(g.id), label: `${g.name} (${g.count ?? g.members?.length ?? 0})` }))]} /></Field></div>}
      {value.kind === 'people' && <div className="mt-4"><StudentPicker students={students} value={value.people} onChange={(people) => set({ people })} /></div>}
      {value.kind && <p className="mt-3 text-xs text-black/55">The chosen students are booked into this lab time by themselves. You do not need to approve them.</p>}
    </div>
  );
}

// Grade + combination + section. Value is one class at a time.
const ClassPick = ({ opts, grade, combo, section = '', onChange }) => {
  const choices = gradesOf(opts).flatMap((g) => {
    const cs = combosFor(opts, g);
    return cs.length ? cs.map((c) => ({ value: `${g}|${c}`, label: `${g} ${c}` })) : [{ value: `${g}|`, label: g }];
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field l="Class">
        <Sel value={grade ? `${grade}|${combo || ''}` : ''} onChange={(v) => { const [g, c] = v.split('|'); onChange({ grade: g, combo: c || '', section }); }}
          options={[{ value: '', label: 'Choose a class…' }, ...choices]} />
      </Field>
      <Field l="Section (optional)">
        <Sel value={section} onChange={(v) => onChange({ grade, combo: combo || '', section: v })}
          options={[{ value: '', label: 'No section' }, ...SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }))]} />
      </Field>
    </div>
  );
};

// Add / rename / remove text items (classes, reasons, categories).
function ChipList({ items, placeholder, onAdd, onRemove, onEdit }) {
  const [v, setV] = useState('');
  const [ed, setEd] = useState(null);
  const add = async () => {
    const x = v.trim();
    if (!x || items.includes(x)) return;
    if (await onAdd(x)) setV('');
  };
  const saveEdit = async () => {
    const n = ed.val.trim();
    if (n && n !== ed.old && !items.includes(n) && onEdit) await onEdit(ed.old, n);
    setEd(null);
  };
  return (
    <div>
      <div className="mb-3 flex min-h-[28px] flex-wrap gap-2">
        {items.length === 0 && <span className="py-1 text-xs text-black/50">Nothing yet.</span>}
        {items.map((x) => (ed?.old === x ? (
          <span key={x} className="inline-flex items-center gap-1.5">
            <Inp autoFocus className="!w-40" value={ed.val} onChange={(e) => setEd({ ...ed, val: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEd(null); }} />
            <Btn onClick={saveEdit}>Save</Btn>
            <Btn c="w" onClick={() => setEd(null)}>Cancel</Btn>
          </span>
        ) : (
          <span key={x} className="inline-flex items-center gap-2 rounded-[6px] border border-black/15 bg-white py-1.5 pl-3 pr-2 text-xs font-medium">
            {x}
            {onEdit && <button type="button" aria-label={`Rename ${x}`} onClick={() => setEd({ old: x, val: x })} className="text-[#2563eb] hover:underline">Edit</button>}
            <button type="button" aria-label={`Remove ${x}`} onClick={() => onRemove(x)} className="grid h-4 w-4 place-items-center text-[#ff4500]">×</button>
          </span>
        )))}
      </div>
      <div className="flex max-w-md gap-2">
        <Inp placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Btn className="shrink-0" disabled={!v.trim()} onClick={add}>Add</Btn>
      </div>
    </div>
  );
}

const LOGO_LETTERS = [['A', 'dark'], ['s', 'dark'], ['y', 'dark'], ['v', 'dark'], ['_', 'or'], ['l', 'green'], ['m', 'green'], ['s', 'green']];
const Logo = ({ light }) => (
  <div className="inline-flex items-center gap-3 text-base font-extrabold tracking-tight">
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[6px] border border-black/10 bg-white">
      <img src={logo} alt="Logo" className="h-9 w-9 object-contain" />
    </span>
    <span className="text-base sm:text-lg" aria-label="Asyv_lms">
      {LOGO_LETTERS.map(([ch, tone], i) => (
        <span key={i} aria-hidden="true" className="lb-bounce"
          style={{ animationDelay: `${i * 0.12}s`, color: tone === 'or' ? '#ff4500' : tone === 'green' ? (light ? '#ffffff' : '#16a34a') : (light ? '#ffffff' : '#111827') }}>
          {ch}
        </span>
      ))}
    </span>
  </div>
);

const GLOBAL_CSS = `
@property --p { syntax: '<number>'; inherits: false; initial-value: 0; }
@keyframes lbIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes lbBounce{0%,55%,100%{transform:translateY(0)}25%{transform:translateY(-7px)}40%{transform:translateY(0)}47%{transform:translateY(-2px)}}
@keyframes lbPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes lbDot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-3px);opacity:1}}
@keyframes lbFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-10px) rotate(1deg)}}
@keyframes lbGlow{0%,100%{box-shadow:0 12px 30px rgba(22,163,74,.12)}50%{box-shadow:0 18px 45px rgba(22,163,74,.3)}}
.lb-float{animation:lbFloat 5s ease-in-out infinite}.lb-glow{animation:lbGlow 4s ease-in-out infinite}
.lb-in{animation:lbIn .6s ease both}
.lb-bounce{display:inline-block;animation:lbBounce 2.2s ease-in-out infinite}
.lb-pulse{animation:lbPulse 1.6s ease-in-out infinite}
.lb-dot{display:inline-block;width:6px;height:6px;border-radius:9999px;background:#9ca3af;animation:lbDot 1.2s infinite}
/* Border fills up as places are taken. --p is 0 to 100. */
.lb-ring{padding:3px;border-radius:8px;background:conic-gradient(var(--c,#16a34a) calc(var(--p) * 1%),#e5e7eb 0);transition:--p 1.2s ease}
@media (prefers-reduced-motion:reduce){.lb-bounce,.lb-pulse,.lb-in,.lb-dot,.lb-float,.lb-glow{animation:none!important}.lb-ring{transition:none}}
`;

/* ================================================================== */
/* 3. PUBLIC LANDING: labs, free places, lost and found                */
/* ================================================================== */

function useOverview(day) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(`/api/overview?date=${day}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)), [day]);
  useEffect(() => { setData(null); load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useLive({ 'overview:update': load });
  return { data, err, loading: !data || data.date !== day };
}

// One lab time. Closed = thick red border with a red "Closed" strip. Otherwise the border fills as places get taken.
function SessionPick({ s, day, past, onLogin }) {
  const closed = past || s.state === 'over';
  const pct = s.seats ? Math.round(((s.seats - s.left) / s.seats) * 100) : 0;
  const color = s.left < 1 ? '#ff4500' : '#16a34a';
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(pct), 80); return () => clearTimeout(t); }, [pct]);
  const intent = { sessionId: s.id, date: day, lab: s.labName, from: s.from, to: s.to };
  const inner = (
    <div className={`flex items-center justify-between gap-3 rounded-[6px] bg-white p-3 ${closed ? 'opacity-75' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className={`text-sm ${closed ? 'line-through decoration-[#dc2626]/60' : ''}`}>{s.from}–{s.to}</b>
          {s.for && <Badge s="draft">{s.exclusive ? `Only ${s.for}` : `Reserved for ${s.for}`}</Badge>}
        </div>
        <div className={`mt-1 text-xs ${closed ? 'font-bold text-[#dc2626]' : s.left < 1 ? 'font-bold text-[#c2310a]' : 'font-medium text-[#15803d]'}`}>
          {closed ? 'This lab time is over' : s.left < 1 ? `Full · ${s.waiting} waiting` : `${s.left} of ${s.seats} places free`}
        </div>
      </div>
      <Btn c={closed ? 'w' : s.left < 1 ? 'or' : 'ink'} disabled={closed || s.exclusive} onClick={() => onLogin(intent)}>
        {closed ? 'Closed' : s.exclusive ? 'Invited only' : s.left < 1 ? 'Join queue' : 'Apply'}
      </Btn>
    </div>
  );
  if (closed) {
    return (
      <div className="overflow-hidden rounded-[8px] border-[5px] border-[#dc2626]">
        <div className="bg-[#dc2626] px-3 py-1 text-[11px] font-bold text-white">Closed · nobody can apply anymore</div>
        {inner}
      </div>
    );
  }
  return <div className="lb-ring" style={{ '--c': color, '--p': p }}>{inner}</div>;
}

function LabCard({ lab, day, past, onLogin }) {
  const status = labStatus(lab.sessions.map((s) => ({ ...s, state: past ? 'over' : s.state })));
  const text = { open: 'Places open', full: 'Full', over: 'Closed', none: 'No lab time', draft: 'Not open' }[status];
  return (
    <article className={`flex flex-col overflow-hidden rounded-[8px] border bg-white ${status === 'over' ? 'border-[#dc2626]/50' : 'border-black/10'}`}>
      <div className="relative h-32 overflow-hidden bg-[#e8f5ec]">
        <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80" alt="Computer lab" className="lb-float h-full w-full object-cover" />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#15803d] shadow">{text}</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-black/10 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{lab.name}</h3>
          <p className="text-xs text-black/55">{lab.pcs} computers</p>
        </div>
        <Badge s={status}>{text}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {lab.sessions.length === 0 && <p className="py-4 text-center text-xs text-black/50">No lab time on this day.</p>}
        {lab.sessions.map((s) => <SessionPick key={s.id} s={{ ...s, labName: lab.name }} day={day} past={past} onLogin={onLogin} />)}
      </div>
    </article>
  );
}

function LabBoard({ onLogin }) {
  const [day, setDay] = useState(today());
  const { data, err, loading } = useOverview(day);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-black/10 bg-white p-5">
        <h3 className="text-lg font-bold">{niceDay(day)}</h3>
        <DayBar day={day} onChange={setDay} />
      </div>
      {err && <div className="mt-4"><Alert>{err}</Alert></div>}
      {loading && !err && <div className="mt-8"><Loader full label="Loading the labs" /></div>}
      {!loading && data?.labs.length === 0 && <Empty>No labs have been added yet.</Empty>}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {!loading && data?.labs.map((l) => <LabCard key={l.id} lab={l} day={day} past={day < today()} onLogin={onLogin} />)}
      </div>
    </div>
  );
}

function TrendDetail({ item, onClose }) {
  const digits = (item.phone || '').replace(/[^\d]/g, '');
  const subject = encodeURIComponent(`Lost item: ${item.title}`);
  const photos = item.media.map(itemPhoto).filter(Boolean);
  return (
    <Modal title={item.title} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge s="open">{item.category}</Badge>
        <span className="text-black/55">Posted {ago(item.postedAt)}</span>
        {item.foundAt && <span className="text-black/55">· Found at {item.foundAt}</span>}
      </div>
      {photos[0] && <img src={photos[0]} alt={item.title} referrerPolicy="no-referrer" className="mt-4 max-h-[400px] w-full rounded-[6px] bg-black/5 object-contain" />}
      {item.description && <p className="mt-4 whitespace-pre-line text-xs leading-relaxed text-black/70">{item.description}</p>}
      <div className="mt-6 rounded-[8px] border border-[#16a34a]/40 bg-[#16a34a]/5 p-4">
        <h4 className="text-xs font-bold text-[#15803d]">Is this yours?</h4>
        <p className="mt-1 text-xs text-black/65">Contact the Minister of Communication, describe something only the owner knows, and come to collect it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.phone && <a href={`tel:${item.phone}`} className="rounded-[6px] bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white">Call {item.phone}</a>}
          {digits && <a target="_blank" rel="noreferrer" href={`https://wa.me/${digits}?text=${subject}`} className="rounded-[6px] bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white">WhatsApp</a>}
          {item.email && <a href={`mailto:${item.email}?subject=${subject}`} className="rounded-[6px] bg-[#ff4500] px-4 py-2 text-xs font-semibold text-white">Email</a>}
          {!item.phone && !item.email && <span className="text-xs text-black/60">Ask {item.postedBy || 'the Minister of Communication'} at school.</span>}
        </div>
      </div>
    </Modal>
  );
}

function TrendsBoard() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(null);
  const load = () => api('/api/trends').then(setItems).catch(() => setItems((c) => c || []));
  useEffect(() => { load(); }, []);
  useLive({ 'trends:update': load });
  const list = items || [];
  const cats = [...new Set(list.map((t) => t.category))].sort();
  const shown = list.filter((t) => (cat === 'all' || t.category === cat) && match(q, t.title, t.category, t.description, t.foundAt));
  return (
    <section id="trends" className="scroll-mt-16 border-t border-black/10 bg-[#f7f8f7]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Lost something? Look here first.</h2>
        <p className="mt-3 max-w-xl text-xs text-black/60">Items found at school are posted here. Tap yours and contact the Minister of Communication.</p>
        {list.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_300px] md:items-center">
            <Pills value={cat} onChange={setCat} items={[['all', 'All', list.length], ...cats.map((c) => [c, c, list.filter((t) => t.category === c).length])]} />
            <SearchBox value={q} onChange={setQ} placeholder="Search keys, bag, jacket…" />
          </div>
        )}
        <div className="mt-8">
          {items === null && <Loader full label="Loading the board" />}
          {items !== null && list.length === 0 && <Empty>Nothing is waiting for an owner right now.</Empty>}
          {list.length > 0 && shown.length === 0 && <Empty>No item matches your search.</Empty>}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpen(t)} className="flex flex-col overflow-hidden rounded-[8px] border border-black/10 bg-white text-left hover:shadow-lg">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f5ec] via-[#f4f6f8] to-[#fff0e9] text-xs text-black/40">
                  {t.media?.map(itemPhoto).find(Boolean)
                    ? <img src={t.media.map(itemPhoto).find(Boolean)} alt={t.title} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    : <div className="flex flex-col items-center gap-2"><PackageSearch className="h-10 w-10 text-[#16a34a]/70" aria-hidden="true" /><span>{t.category}</span></div>}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold">{t.title}</h3>
                  <p className="mt-2 text-[11px] text-black/50">{t.foundAt ? `Found at ${t.foundAt}` : `Posted ${ago(t.postedAt)}`}</p>
                  <p className="mt-2 text-xs font-semibold text-[#ff4500]">View and contact</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      {open && <TrendDetail item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Landing({ onLogin }) {
  return (
    <div className="bg-white text-[#111827] antialiased text-sm">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden gap-2 text-xs font-medium md:flex">
            <a href="#labs" className="rounded-[6px] px-3 py-2 text-black/70 hover:bg-black/5">Labs</a>
            <a href="#trends" className="rounded-[6px] px-3 py-2 text-black/70 hover:bg-black/5">Lost and found</a>
          </nav>
          <Btn onClick={() => onLogin()}>Log in</Btn>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-6 pt-14 pb-6 md:grid-cols-[1.05fr_.95fr]">
        <div>
        <span className="lb-in inline-block rounded-[6px] border border-[#16a34a]/30 bg-[#16a34a]/10 px-3 py-1.5 text-[11px] font-semibold text-[#15803d]">Live places, updated automatically</span>
        <h1 className="lb-in mt-5 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">Book a computer in the lab before you walk in.</h1>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-black/65">Pick a lab time and press Apply. Free places are approved at once. When a lab time is full you join the waiting list.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#labs" className="rounded-[6px] bg-[#16a34a] px-5 py-2.5 text-xs font-semibold text-white">See the labs</a>
          <Btn c="w" onClick={() => onLogin()}>Log in with Google</Btn>
        </div>
        </div>
        <div className="lb-glow relative overflow-hidden rounded-2xl bg-[#e8f5ec] shadow-lg">
          <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=85" alt="A bright computer lab for student study" className="h-64 w-full object-cover md:h-[340px]" />
          <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-4 py-3 shadow-md"><p className="text-xs font-bold text-[#15803d]">Make room for your next idea</p><p className="mt-1 text-[11px] text-black/60">Find and book an available lab session.</p></div>
        </div>
      </section>
      <section id="labs" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-12">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Labs and free places</h2>
        <p className="mb-8 mt-2 max-w-xl text-xs text-black/60">The border of each lab time fills as places are taken. A red border with the word Closed means the lab time is over and nobody can apply.</p>
        <LabBoard onLogin={onLogin} />
      </section>
      <TrendsBoard />
      <footer className="border-t border-black/10 text-xs text-black/55">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <Logo />
          <span>© 2026 Computer Lab Management System</span>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 4. SIGN IN (Google only)                                            */
/* ================================================================== */

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
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 300 });
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
  return <div className="flex min-h-[44px] justify-center"><div ref={ref} /></div>;
}

function Auth({ onDone, onBack, intent }) {
  const [err, setErr] = useState('');
  const [signing, setSigning] = useState(false);
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const finish = async (t) => {
    setSigning(true);
    try { await onDone(t); } catch (e) { setSigning(false); setErr(e.message); }
  };
  return (
    <div className="fixed inset-0 grid place-items-center overflow-y-auto bg-white p-6 text-[13px] text-[#111827]">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl md:grid-cols-2">
       <div className="relative hidden min-h-[560px] overflow-hidden bg-[#e8f5ec] md:block">
        <img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85" alt="Bright school computer lab" className="lb-float absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#052e16]/80 via-transparent to-[#052e16]/10" />
        <div className="absolute bottom-8 left-8 right-8 text-white"><p className="text-2xl font-bold">Your next idea starts here.</p><p className="mt-2 text-sm text-white/80">Book a computer lab place before you arrive.</p></div>
       </div>
       <div className="w-full max-w-md p-7 md:mx-auto md:py-12">
        <button type="button" onClick={onBack} className="mb-8 text-xs font-medium text-[#2563eb] hover:underline">← Back to home</button>
        <Logo />
        <h1 className="mt-8 text-xl font-bold tracking-tight">Welcome back</h1>
        <p className="mb-6 mt-1.5 text-black/60">Sign in with the Google account your school has on record for you.</p>
        {intent && <Alert ok>You chose <b>{intent.lab}</b> on <b>{intent.date}</b> at <b>{intent.from}–{intent.to}</b>. Sign in and we send your booking.</Alert>}
        {err && <div className="mt-4"><Alert>{err}</Alert></div>}
        <div className="mt-6">
          {hasGoogle ? <GoogleBtn onResult={finish} onError={setErr} /> : <Alert>Google sign-in is not set up yet. Add VITE_GOOGLE_CLIENT_ID to the frontend .env file.</Alert>}
        </div>
        <p className="mt-8 text-center text-xs text-black/50">Account not recognised? Ask your school admin to add your email.</p>
        </div>
            </div>
      {signing && <div className="fixed inset-0 z-50 grid place-items-center bg-white/85"><Loader label="Signing you in" /></div>}
    </div>
  );
}

/* ================================================================== */
/* 5. STUDENT and TEACHER pages: apply only. No printing.              */
/* ================================================================== */

function Booker({ user, opts, intent, onIntentDone }) {
  const isStudent = user.role === 'student';
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState(intent?.date || today());
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [reason, setReason] = useState(opts.reasons?.[0] || '');
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [src, setSrc] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [sid, setSid] = useState('');
  const [note, setNote] = useState(null);
  const { busy, run } = useBusy();
  const sent = useRef(false);

  const loadSessions = () => api('/api/sessions').then(setSessions).catch((e) => setNote({ ok: false, text: e.message }));
  const loadApps = () => api('/api/apps').then(setApps).catch(() => {});
  useLive({ seats: loadSessions, 'applications:update': loadApps });

  useEffect(() => {
    const jobs = [loadSessions(), loadApps()];
    if (!isStudent) jobs.push(api('/api/classes').then(setClasses).catch(() => {}), api('/api/groups').then(setGroups).catch(() => {}));
    Promise.all(jobs).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (isStudent) return;
    setPicked([]);
    if (!src) { setStudents([]); return; }
    const [k, v] = src.split(':');
    const url = k === 'g' ? `/api/students?group=${v}` : `/api/students?class=${encodeURIComponent(v)}`;
    api(url).then(setStudents).catch((e) => setNote({ ok: false, text: e.message }));
  }, [src]);

  // Sends bookings for one lab time. Used by Apply buttons and by teachers' bulk booking.
  const sendBooking = async (id, names = null) => {
    setNote(null);
    try {
      const body = names ? { sessionId: id, reason, students: names } : { sessionId: id, reason };
      const r = await api('/api/apply', 'POST', body);
      const parts = [`${r.created} booking${r.created === 1 ? '' : 's'} sent`];
      if (r.approved) parts.push(`${r.approved} approved at once`);
      if (r.queued) parts.push(`${r.queued} in the waiting list`);
      if (r.skipped?.length) parts.push(`already booked: ${r.skipped.join(', ')}`);
      if (r.tooMany?.length) parts.push(`too many days in a row: ${r.tooMany.join(', ')}`);
      setNote({ ok: r.created > 0, text: parts.join(' · ') + '.' });
      setPicked([]);
      await loadApps();
      return true;
    } catch (e) { setNote({ ok: false, text: e.message }); return false; }
  };
  const apply = (id) => run('a' + id, () => sendBooking(id));
  const bookStudents = () => run('bk', () => sendBooking(+sid, picked));

  // A lab time chosen on the home page is booked once, right after sign-in.
  useEffect(() => {
    if (!ready || !intent || sent.current || !isStudent) return;
    sent.current = true;
    run('a' + intent.sessionId, () => sendBooking(intent.sessionId)).finally(() => onIntentDone?.());
  }, [ready]);

  const checkIn = (id) => run('ci' + id, async () => {
    try {
      const r = await api(`/api/apps/${id}/checkin`, 'POST');
      setNote({ ok: true, text: r.late ? 'You are checked in. You were marked late.' : 'You are checked in. Thank you!' });
      await loadApps();
    } catch (e) { setNote({ ok: false, text: e.message }); }
  });

  if (!ready) return <Loader full label="Loading" />;

  const todayStr = today();
  const dayLabs = sessions.filter((s) => s.date === day);
  const mine = (id) => apps.find((a) => a.sid === id && a.status !== 'rejected');
  const myApps = apps.filter((a) => a.name === user.name || a.bookedBy === user.name).sort((a, b) => `${b.date} ${b.from}`.localeCompare(`${a.date} ${a.from}`));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const count = (k) => myApps.filter((a) => a.status === k).length;
  const srcOpts = [
    { value: '', label: 'Choose a class or group…' },
    ...classes.map((c) => ({ value: `c:${c}`, label: c })),
    ...groups.map((g) => ({ value: `g:${g.id}`, label: `Group: ${g.name}` })),
  ];
  const reasonOpts = (opts.reasons || []).map((r) => ({ value: r, label: r }));

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <div className="grid grid-cols-3 gap-4">
        <Stat v={count('approved')} t="Approved" tone="gr" />
        <Stat v={count('pending')} t="Waiting or in queue" tone="or" />
        <Stat v={myApps.filter((a) => a.att === 'present').length} t="Times attended" />
      </div>

      <Card t={isStudent ? 'Book a lab' : 'Lab times'} sub={`${niceDay(day)} · free places are approved at once. Full lab times have a waiting list.`}>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <DayBar day={day} onChange={setDay} />
          <Field l="Reason"><Sel value={reason} onChange={setReason} options={reasonOpts.length ? reasonOpts : [{ value: 'Other', label: 'Other' }]} /></Field>
        </div>
        {dayLabs.length === 0 && <Empty>No lab time on this day. Try another day.</Empty>}
        {dayLabs.map((s) => {
          const m = mine(s.id);
          const pct = s.seats ? ((s.seats - s.left) / s.seats) * 100 : 100;
          const past = s.date < todayStr || s.state === 'over';
          return (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{s.lab}</b>
                  <span className="text-black/60">{s.from}–{s.to}</span>
                  {forLabel(s) && <Badge s="draft">{audText(s)}</Badge>}
                  {past && <Badge s="over">Closed</Badge>}
                </div>
                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-[3px] bg-black/10">
                  <div className={`h-full ${past ? 'bg-[#dc2626]' : s.left > 0 ? 'bg-[#16a34a]' : 'bg-[#ff4500]'}`} style={{ width: pct + '%' }} />
                </div>
                <div className={`mt-1.5 text-xs ${past ? 'font-bold text-[#dc2626]' : s.left > 0 ? 'font-medium text-[#15803d]' : 'font-bold text-[#c2310a]'}`}>
                  {past ? 'This lab time is over' : s.left > 0 ? `${s.left} of ${s.seats} places left` : 'Full · you can join the waiting list'}
                </div>
              </div>
              {m ? <Badge s={statusKey(m, s)}>{STATUS_LABEL[statusKey(m, s)]}</Badge> : (
                <ActBtn c={s.left < 1 ? 'bl' : 'ink'} busy={busy === 'a' + s.id} doing="Sending…" label={past ? 'Closed' : s.left < 1 ? 'Join queue' : 'Apply'}
                  disabled={past || s.exclusive} onClick={() => apply(s.id)} />
              )}
            </div>
          );
        })}
      </Card>

      {!isStudent && (
        <Card t="Book students" sub="Choose a class or group, then the lab time and the students.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field l="Class or group"><Sel value={src} onChange={setSrc} options={srcOpts} /></Field>
            <Field l="Lab time"><Sel value={sid} onChange={setSid} options={[{ value: '', label: 'Choose a lab time…' }, ...sessions.filter((s) => s.date >= todayStr && s.state !== 'over').map((s) => ({ value: String(s.id), label: `${s.lab} · ${shortDay(s.date)} ${s.from}–${s.to}` }))]} /></Field>
          </div>
          <div className="mt-5">
            <StudentPicker students={students} value={picked} onChange={setPicked} />
          </div>
          <div className="mt-5">
            <ActBtn busy={busy === 'bk'} doing="Sending…" label={`Book ${picked.length} student${picked.length === 1 ? '' : 's'}`}
              disabled={!picked.length || !sid} onClick={bookStudents} />
          </div>
        </Card>
      )}

      <Card t={isStudent ? 'My bookings' : 'Bookings I sent'}>
        {myApps.length === 0 && <Empty>No booking yet.</Empty>}
        {myApps.map((a) => {
          const s = sessionById.get(a.sid);
          return (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 py-3.5 first:border-t-0">
              <span className="min-w-0">
                <b>{a.lab}</b> <span className="text-black/60">· {shortDay(a.date)} {a.from}–{a.to} · {a.reason}</span>
                {!isStudent && <span className="block text-xs text-black/55">{a.name}</span>}
                {a.released && <span className="block text-xs text-[#c2310a]">Your place was given to the waiting list because you did not arrive in time.</span>}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {isStudent && a.name === user.name && a.status === 'approved' && !a.att && a.date === todayStr && (
                  <ActBtn busy={busy === 'ci' + a.id} doing="…" label="I am here" onClick={() => checkIn(a.id)} />
                )}
                {a.status === 'approved' && a.att && <Badge s={attKey(a) || 'none'}>{attLabel(a)}</Badge>}
                <Badge s={statusKey(a, s)}>{STATUS_LABEL[statusKey(a, s)] || a.status}</Badge>
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 6. ADMIN: Overview, Labs, Schedule, People, Chat, Settings          */
/* ================================================================== */

// Live presence: which admin is on which page, and recent activity.
function OverviewPage({ me }) {
  const [stats, setStats] = useState(null);
  const [presence, setPresence] = useState([]);
  const [acts, setActs] = useState([]);
  const [chart, setChart] = useState([]);
  const [days, setDays] = useState(7);
  const load = useCallback(() => {
    api('/api/stats/overview').then(setStats).catch(() => {});
    api('/api/activity').then(setActs).catch(() => {});
    api(`/api/activity/chart?days=${days}`).then(setChart).catch(() => {});
  }, [days]);
  useEffect(load, [load]);
  useLive({ 'activity:update': load, presence: (p) => setPresence(p) });

  const t = stats?.totals || {};
  const att = stats?.attendance || {};
  const dayList = Array.from({ length: days }, (_, i) => shiftDay(today(), i - days + 1));
  const actors = [...new Set([...presence.map((p) => p.name), ...chart.map((c) => c.actor)])].sort();
  const maxDay = Math.max(1, ...chart.map((c) => c.n));
  const total = (name) => chart.filter((c) => c.actor === name).reduce((n, c) => n + c.n, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat v={t.approved ?? 0} t="Approved bookings" tone="gr" />
        <Stat v={t.pending ?? 0} t="Waiting or in queue" tone="or" />
        <Stat v={att.rate == null ? '-' : `${att.rate}%`} t="Attendance rate" tone="gr" />
        <Stat v={att.late ?? 0} t="Late arrivals" tone="am" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card t="Who is online" sub="Admins currently signed in and the page they are on.">
          {presence.length === 0 && <Empty>No admin is online.</Empty>}
          {presence.map((p) => (
            <div key={p.email || p.name} className="flex items-center justify-between gap-3 border-t border-black/10 py-3 first:border-t-0">
              <span className="flex items-center gap-2">
                <span className="lb-pulse inline-block h-2 w-2 rounded-full bg-[#16a34a]" />
                <b className="text-xs">{p.name}{p.name === me.name && ' (you)'}</b>
              </span>
              <Badge s="open">{p.page}</Badge>
            </div>
          ))}
        </Card>

        <Card t="Activity by admin" sub="What each admin did over the chosen days."
          action={<Pills value={String(days)} onChange={(v) => setDays(+v)} items={[['7', '7 days'], ['14', '14 days'], ['30', '30 days']]} />}>
          {actors.length === 0 && <Empty>No activity yet.</Empty>}
          {actors.map((name) => (
            <div key={name} className="border-t border-black/10 py-3 first:border-t-0">
              <div className="mb-2 flex items-center justify-between text-xs">
                <b>{name}</b>
                <span className="text-black/55">{total(name)} actions</span>
              </div>
              <div className="flex h-16 items-end gap-1.5">
                {dayList.map((d) => {
                  const n = chart.find((c) => c.actor === name && c.day === d)?.n || 0;
                  return (
                    <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${shortDay(d)}: ${n}`}>
                      <div className="w-full rounded-t-[3px] bg-[#16a34a]" style={{ height: `${Math.max((n / maxDay) * 100, n ? 6 : 2)}%`, opacity: n ? 1 : 0.15 }} />
                      <span className="text-[9px] text-black/45">{weekdayShort(d).slice(0, 2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      </div>

      <Card t="Recent activity" sub="Every change made by admins, newest first.">
        {acts.length === 0 && <Empty>Nothing yet.</Empty>}
        <div className="divide-y divide-black/10">
          {acts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <span><b>{a.actor}</b> <span className="text-black/70">{a.action}</span>{a.detail && <span className="text-black/55"> · {a.detail}</span>}</span>
              <span className="text-black/45">{ago(a.at)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Labs page: only PUBLISHED lab times. For each lab: its status, how many applied and the names of the students.
// No filters. Click "Open lab" to mark attendance, or "Print" for the list of the lab.
function LabsPage({ onOpenLab }) {
  const [day, setDay] = useState(today());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(`/api/board?date=${day}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)), [day]);
  useEffect(() => { setData(null); load(); }, [load]);
  useLive({ 'applications:update': load, seats: load });

  if (!data) return err ? <Alert>{err}</Alert> : <Loader full label="Loading labs" />;
  const labs = data.labs;
  const all = labs.flatMap((l) => l.sessions);
  const applied = all.reduce((n, s) => n + liveOf(s).length, 0);
  const withTime = labs.filter((l) => l.sessions.length);

  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">{niceDay(day)}</h3>
            <p className="text-xs text-black/55">Published lab times and the students in each. Drafts are in Schedule.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DayBar day={day} onChange={setDay} />
            <Btn c="w" disabled={!withTime.length} onClick={() => printLabs(withTime, day)}>Print all labs</Btn>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat v={all.length} t="Lab times" />
        <Stat v={applied} t="Students applied" tone="gr" />
        <Stat v={all.filter((s) => s.state === 'open').length} t="Open now" tone="gr" />
        <Stat v={all.filter((s) => s.state === 'over').length} t="Over" tone="rd" />
      </div>

      {labs.length === 0 && <Card><Empty>No labs have been added yet. Add one in Settings.</Empty></Card>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {labs.map((l) => {
          const status = labStatus(l.sessions);
          return (
            <article key={l.id} className={`flex flex-col rounded-[8px] border bg-white ${status === 'over' ? 'border-[#dc2626]/40' : 'border-black/10'}`}>
              <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
                <div>
                  <h3 className="text-base font-bold">{l.name}</h3>
                  <p className="text-xs text-black/55">{l.pcs} computers · {plural(l.sessions.length, 'lab time')}</p>
                </div>
                <Badge s={status}>{LAB_STATUS_TEXT[status]}</Badge>
              </div>
              <div className="flex-1 space-y-4 p-4">
                {l.sessions.length === 0 && <p className="py-4 text-center text-xs text-black/50">No lab time on this day.</p>}
                {l.sessions.map((s) => {
                  const list = liveOf(s);
                  const shown = list.slice(0, 6);
                  return (
                    <div key={s.id} className="rounded-[6px] bg-black/[0.03] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <b className="text-sm">{s.from}–{s.to}</b>
                        <Badge s={s.state}>{STATE_LABEL[s.state]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-black/60">
                        <b className="text-[#111827]">{list.length}</b> applied · {s.seats - s.left} of {s.seats} places taken
                        {forLabel(s) && <span className="text-[#c2310a]"> · {audText(s)}</span>}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {list.length === 0 && <span className="text-xs text-black/45">Nobody yet.</span>}
                        {shown.map((a) => (
                          <span key={a.id} title={STATUS_LABEL[statusKey(a, s)]}
                            className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-medium ${a.status === 'approved' ? 'bg-[#16a34a]/10 text-[#15803d]' : 'bg-[#2563eb]/10 text-[#1d4ed8]'}`}>
                            <Avatar name={a.name} picture={a.picture} gid={a.gid} className="h-5 w-5 text-[8px]" />{a.name}
                          </span>
                        ))}
                        {list.length > shown.length && <span className="py-1 text-[11px] font-semibold text-black/55">+{list.length - shown.length} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 border-t border-black/10 p-3">
                <Btn onClick={() => onOpenLab(l.id, day, l.name)}>Open lab</Btn>
                <Btn c="w" disabled={!l.sessions.length} onClick={() => printLabs([l], day)}>Print this lab</Btn>
              </div>
            </article>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-4 text-[11px] text-black/55">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Approved student</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#2563eb]" />In the waiting list</span>
      </p>
    </div>
  );
}

// One lab on one day: its lab times, the students of each, attendance and printing.
function LabDetail({ labId, day, onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(`/api/board?date=${day}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)), [day]);
  useEffect(() => { load(); }, [load]);
  useLive({ 'applications:update': load, seats: load });
  const { busy, act, sure, note } = useAct(load);

  if (!data) return err ? <Alert>{err}</Alert> : <Loader full label="Loading lab" />;
  const lab = data.labs.find((l) => l.id === labId);
  if (!lab) return <Card><Empty>This lab was not found.</Empty></Card>;
  const started = (s) => s.date < today() || (s.date === today() && s.from <= new Date().toTimeString().slice(0, 5));
  const setAtt = (a, v) => act('att' + a.id, () => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att: attKey(a) === v ? null : v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Btn c="w" onClick={onBack}>← All labs</Btn>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <h2 className="text-lg font-bold">{lab.name}</h2>
            <p className="text-xs text-black/55">{niceDay(day)}</p>
          </div>
          <Btn c="w" disabled={!lab.sessions.length} onClick={() => printLabs([lab], day)}>Print this lab</Btn>
        </div>
      </div>
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      {err && <Alert>{err}</Alert>}
      {lab.sessions.length === 0 && <Card><Empty>No published lab time for this lab on this day. Add one in Schedule.</Empty></Card>}

      {lab.sessions.map((s) => {
        const list = liveOf(s);
        const approved = list.filter((a) => a.status === 'approved');
        const waiting = list.filter((a) => a.status !== 'approved');
        const gone = s.people.filter((a) => a.status === 'rejected');
        const present = approved.filter((a) => a.att === 'present').length;
        return (
          <Card key={s.id} t={`${s.from}–${s.to}`}
            sub={`${audText(s)} · ${s.seats - s.left} of ${s.seats} places taken`}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <Badge s={s.state}>{STATE_LABEL[s.state]}</Badge>
                <Btn c="w" disabled={!list.length} onClick={() => printSession(lab, s)}>Print list</Btn>
                {waiting.length > 0 && started(s) && s.state !== 'over' && (
                  <ActBtn c="bl" busy={busy === 'rel' + s.id} doing="Releasing…" label="Release no-shows"
                    onClick={() => act('rel' + s.id, () => api(`/api/sessions/${s.id}/release-noshows`, 'POST'),
                      (r) => `${plural(r.released, 'place')} released, ${plural(r.promoted, 'student')} moved up from the queue.`)} />
                )}
              </div>
            )}>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat v={list.length} t="Applied" />
              <Stat v={approved.length} t="Approved" tone="gr" />
              <Stat v={waiting.length} t="Waiting" tone="or" />
              <Stat v={present} t="Present" tone="gr" />
            </div>
            {list.length === 0 && <Empty>Nobody has applied to this lab time yet.</Empty>}
            <div className="divide-y divide-black/10">
              {list.map((a, i) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-5 text-right text-xs text-black/40">{i + 1}</span>
                    <Person p={a} sub={`${a.cls || 'No class'}${a.reason ? ` · ${a.reason}` : ''}`} className="h-8 w-8 text-[10px]" />
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {a.status !== 'approved' && <Badge s={statusKey(a, s)}>{STATUS_LABEL[statusKey(a, s)]}</Badge>}
                    {a.status === 'approved' && (
                      <>
                        <Btn c={attKey(a) === 'present' ? 'ink' : 'w'} onClick={() => setAtt(a, 'present')}>Present</Btn>
                        <Btn c={attKey(a) === 'late' ? 'am' : 'w'} onClick={() => setAtt(a, 'late')}>Late</Btn>
                        <Btn c={attKey(a) === 'absent' ? 'or' : 'w'} onClick={() => setAtt(a, 'absent')}>Absent</Btn>
                        {!a.att && started(s) && (
                          <Btn c="w" onClick={() => sure({ message: `Give ${a.name}'s place to the waiting list?`, ok: 'Release', danger: true }, 'rl' + a.id,
                            () => api(`/api/apps/${a.id}/release`, 'PATCH'), 'Place released.')}>Release</Btn>
                        )}
                      </>
                    )}
                    {a.status === 'pending' && (
                      <ActBtn busy={busy === 'ap' + a.id} doing="…" label="Approve" onClick={() => act('ap' + a.id, () => api(`/api/apps/${a.id}/status`, 'PATCH', { status: 'approved' }), 'Approved.')} />
                    )}
                    <Btn c="w" onClick={() => sure({ message: `Remove ${a.name} from this lab time?`, ok: 'Remove', danger: true }, 'x' + a.id,
                      () => api('/api/apps/bulk', 'POST', { ids: [a.id], action: 'delete' }), `${a.name} was removed.`)}>Remove</Btn>
                  </span>
                </div>
              ))}
            </div>
            {waiting.some((a) => a.status === 'pending') && (
              <div className="mt-4 border-t border-black/10 pt-4">
                <ActBtn busy={busy === 'apw' + s.id} doing="Approving…" label={`Approve all waiting (${waiting.length})`}
                  onClick={() => act('apw' + s.id, () => api('/api/apps/bulk', 'POST', { ids: waiting.map((a) => a.id), action: 'approve' }),
                    (r) => `${r.done} approved${r.skipped ? `, ${r.skipped} skipped because the lab time is full` : ''}.`)} />
              </div>
            )}
            {gone.length > 0 && (
              <details className="mt-4 text-xs text-black/60">
                <summary className="cursor-pointer font-semibold">Released or rejected ({gone.length})</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {gone.map((a) => <span key={a.id} className="rounded-full bg-black/5 px-2 py-0.5">{a.name}{a.released ? ' · did not arrive' : ''}</span>)}
                </div>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Schedule: prepare lab times (with a class, a group or chosen students) and manage the ones that exist.
function SchedulePage() {
  const [day, setDay] = useState(today());
  const [labs, setLabs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [f, setF] = useState({ date: today(), from: '14:00', to: '16:00', labId: '', places: '', auto: 'true' });
  const [aud, setAud] = useState({ ...BLANK_AUD });
  const [edit, setEdit] = useState(null);
  const loadAll = useCallback(() => Promise.all([
    api('/api/labs'), api('/api/sessions'), api('/api/users'), api('/api/groups'),
  ]).then(([l, s, u, g]) => { setLabs(l); setSessions(s); setUsers(u); setGroups(g); }).catch(() => {}), []);
  useEffect(() => { loadAll(); }, []);
  useLive({ seats: loadAll, 'applications:update': loadAll });
  const { busy, act, sure, note } = useAct(loadAll);

  const students = users.filter((u) => u.role === 'student');
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const timeOk = f.date && f.from && f.to && f.from < f.to;

  const create = (published) => act(published ? 'pub' : 'draft', async () => {
    const r = await api('/api/sessions', 'POST', {
      date: f.date, from: f.from, to: f.to, published, audience: aud, autoApprove: f.auto === 'true',
      labIds: f.labId === 'all' ? labs.map((l) => +l.id) : [+f.labId], places: f.places === '' ? undefined : +f.places,
    });
    setAud({ ...BLANK_AUD });
    setDay(f.date);
    return r;
  }, (r) => `${published ? 'Published' : 'Saved as a draft'}.${r.assigned ? ` ${plural(r.assigned, 'student')} booked automatically.` : ''}${r.notFound?.length ? ` Not found: ${r.notFound.join(', ')}.` : ''}`);

  const dayList = sessions.filter((s) => s.date === day).sort(byTime);

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Prepare a lab time" sub="Choose the lab and the time. You can give it to a class, a group or chosen students now, so they are already booked when you publish.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field l="Day"><Inp type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field l="From"><Inp type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field l="To"><Inp type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field l="Lab">
            <Sel value={f.labId} onChange={(v) => setF({ ...f, labId: v })} options={[{ value: '', label: 'Choose a lab…' }, { value: 'all', label: 'All labs — same schedule for every lab' }, ...labs.map((l) => ({ value: String(l.id), label: `${l.name} (${l.pcs} computers)` }))]} />
            <p className="mt-1.5 text-[11px] text-black/50">Choose a single lab to prepare it individually, or select All labs to create this schedule for every lab.</p>
          </Field>
          <Field l="Places open" hint="Empty = every computer."><Inp type="number" min="1" value={f.places} onChange={(e) => setF({ ...f, places: e.target.value })} /></Field>
          <Field l="How students are approved">
            <Sel value={f.auto} onChange={(v) => setF({ ...f, auto: v })} options={[
              { value: 'true', label: 'Approve at once (waiting list when full)' }, { value: 'false', label: 'Admin approves each student' },
            ]} />
          </Field>
        </div>
        <div className="mt-6 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
          <AudiencePicker value={aud} onChange={setAud} classes={classes} groups={groups} students={students} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ActBtn c="w" busy={busy === 'draft'} doing="Saving…" label="Save as draft" disabled={!audOk(aud) || !f.labId || !timeOk} onClick={() => create(false)} />
          <ActBtn busy={busy === 'pub'} doing="Publishing…" label="Publish now" disabled={!audOk(aud) || !f.labId || !timeOk} onClick={() => create(true)} />
          {!f.labId && <span className="text-xs text-black/55">Choose a lab to continue.</span>}
          {f.labId && !timeOk && <span className="text-xs text-[#c2310a]">The start time must be before the end time.</span>}
        </div>
      </Card>

      <Card t="Lab times on this day" sub="Drafts are only visible to admins. Publish them when they are ready."
        action={<DayBar day={day} onChange={setDay} />}>
        {dayList.length === 0 && <Empty>No lab time on this day.</Empty>}
        <div className="divide-y divide-black/10">
          {dayList.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge s={s.state}>{STATE_LABEL[s.state]}</Badge>
                  <b>{s.lab} · {s.from}–{s.to}</b>
                </div>
                <p className="mt-1 text-xs text-black/55">{s.seats - s.left} of {s.seats} taken · {audText(s)} · {s.autoApprove !== false ? 'Approved at once' : 'Admin approves'}</p>
              </div>
              <span className="flex flex-wrap gap-2">
                <ActBtn c={s.published ? 'w' : 'ink'} busy={busy === 'p' + s.id} doing="…" label={s.published ? 'Hide' : 'Publish'}
                  onClick={() => act('p' + s.id, () => api(`/api/sessions/${s.id}/publish`, 'PATCH', { published: !s.published }), s.published ? 'Hidden from students.' : 'Published.')} />
                <Btn c="w" onClick={() => setEdit({ s, date: s.date, from: s.from, to: s.to, places: String(s.seats), auto: String(s.autoApprove !== false), aud: audFrom(s) })}>Edit</Btn>
                <Btn c="or" onClick={() => sure({ message: 'Remove this lab time? Its bookings are removed too.', ok: 'Remove', danger: true }, 'x' + s.id,
                  () => api(`/api/sessions/${s.id}`, 'DELETE'), 'Lab time removed.')}>Remove</Btn>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {edit && (
        <Modal title={`Edit ${edit.s.lab} · ${shortDay(edit.s.date)}`} onClose={() => setEdit(null)} wide>
          <div className="grid gap-4 md:grid-cols-2">
            <Field l="Day"><Inp type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <Field l="Places open"><Inp type="number" min="1" value={edit.places} onChange={(e) => setEdit({ ...edit, places: e.target.value })} /></Field>
            <Field l="From"><Inp type="time" value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} /></Field>
            <Field l="To"><Inp type="time" value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field l="How students are approved">
                <Sel value={edit.auto} onChange={(v) => setEdit({ ...edit, auto: v })} options={[
                  { value: 'true', label: 'Approve at once (waiting list when full)' }, { value: 'false', label: 'Admin approves each student' },
                ]} />
              </Field>
            </div>
          </div>
          <div className="mt-5 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
            <AudiencePicker value={edit.aud} onChange={(a) => setEdit({ ...edit, aud: a })} classes={classes} groups={groups} students={students} />
          </div>
          <div className="mt-5 flex gap-2">
            <ActBtn busy={busy === 'edit'} doing="Saving…" label="Save changes" disabled={!audOk(edit.aud) || edit.from >= edit.to} onClick={async () => {
              if (await act('edit', () => api(`/api/sessions/${edit.s.id}`, 'PUT', {
                date: edit.date, from: edit.from, to: edit.to, places: edit.places === '' ? '' : +edit.places,
                autoApprove: edit.auto === 'true', audience: edit.aud,
              }), 'Lab time saved.')) setEdit(null);
            }} />
            <Btn c="w" onClick={() => setEdit(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// People: accounts, groups, and moving students between classes.
function PeoplePage() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [sel, setSel] = useState([]);
  const [target, setTarget] = useState({ grade: '', combo: '', section: '' });
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nw, setNw] = useState({ name: '', email: '', role: 'student', phone: '', grade: '', combo: '', section: '' });
  const [newGroup, setNewGroup] = useState({ name: '', members: [] });
  const [openGroup, setOpenGroup] = useState(null);
  const load = useCallback(() => Promise.all([api('/api/users'), api('/api/groups'), api('/api/options')])
    .then(([u, g, o]) => { setUsers(u); setGroups(g); setOpts({ ...EMPTY_OPTS, ...o }); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useLive({ 'me:update': load, 'applications:update': load, seats: load });
  const { busy, act, sure, note } = useAct(load);

  const students = users.filter((u) => u.role === 'student');
  const shown = users.filter((u) => (!role || u.role === role) && match(q, u.name, u.email || '', u.className || '', ROLE_LABEL[u.role]));
  const selStudents = sel.filter((id) => users.find((u) => u.id === id)?.role === 'student');
  const count = (r) => users.filter((u) => u.role === r).length;
  const targetLabel = [target.grade, target.combo, target.section].filter(Boolean).join(' ');
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills value={role} onChange={setRole} items={[['', 'Everyone', users.length], ...ROLE_CHOICES.map((r) => [r, ROLE_LABEL[r] + 's', count(r)])]} />
        <Btn onClick={() => setAdding(true)}>+ Add person</Btn>
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Search by name, email or class" />

      {sel.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-end gap-3 rounded-[8px] border border-[#ff4500]/40 bg-white p-4 shadow-lg">
          <span className="mr-auto self-center text-xs font-bold text-[#c2310a]">{sel.length} selected</span>
          {selStudents.length > 0 && (
            <>
              <div className="w-full sm:w-[420px]"><ClassPick opts={opts} grade={target.grade} combo={target.combo} section={target.section} onChange={setTarget} /></div>
              <ActBtn c="bl" busy={busy === 'move'} doing="Moving…" label={`Move ${selStudents.length} to this class`} disabled={!target.grade}
                onClick={async () => {
                  if (await sure({ message: `Move ${selStudents.length} student(s) to ${targetLabel}?`, ok: 'Yes, move' }, 'move',
                    () => api('/api/students/class', 'PATCH', { ids: selStudents, ...target }), `Moved to ${targetLabel}.`)) setSel([]);
                }} />
            </>
          )}
          <Btn c="w" onClick={() => setSel([])}>Clear</Btn>
          <ActBtn c="or" busy={busy === 'bdel'} doing="Deleting…" label={`Delete ${sel.length}`}
            onClick={async () => {
              if (await sure({ message: `Delete ${sel.length} account(s) and their bookings? This cannot be undone.`, ok: 'Delete', danger: true }, 'bdel',
                () => api('/api/users/bulk-delete', 'POST', { ids: sel }), 'Accounts deleted.')) setSel([]);
            }} />
        </div>
      )}

      <Card t={`People (${shown.length})`}>
        {shown.length === 0 && <Empty>No one matches.</Empty>}
        <div className="divide-y divide-black/10">
          {shown.slice(0, 100).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <input type="checkbox" aria-label={`Select ${u.name}`} className="h-4 w-4 accent-[#ff4500]" checked={sel.includes(u.id)} onChange={() => toggle(u.id)} />
                <Person p={u} />
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge s="none">{u.role === 'student' ? (u.className || 'No class') : ROLE_LABEL[u.role]}</Badge>
                {u.comm && <Badge s="draft">Minister of Communication</Badge>}
                <Btn c={u.comm ? 'dk' : 'bl'} onClick={() => sure({ title: u.comm ? 'Remove the Minister?' : 'Appoint the Minister?', message: u.comm ? `${u.name} will no longer manage Lost and Found.` : `${u.name} will manage Lost and Found items.`, ok: u.comm ? 'Remove' : 'Appoint', danger: !!u.comm },
                  'comm' + u.id, () => api(`/api/users/${u.id}/communication`, 'PATCH', { on: !u.comm }), u.comm ? 'Minister removed.' : 'Minister appointed.')}>
                  {u.comm ? 'Remove Minister' : 'Make Minister'}
                </Btn>
                <Btn c="w" onClick={() => setEdit({ ...u, section: u.section || '', combo: u.combo || '', phone: u.phone || '', picture: u.picture || '', origPicture: u.picture || '' })}>Edit</Btn>
                <Btn c="or" onClick={() => sure({ message: `Delete ${u.name} and their bookings? This cannot be undone.`, ok: 'Delete', danger: true }, 'del' + u.id,
                  () => api(`/api/users/${u.id}`, 'DELETE'), `${u.name} was deleted.`)}>Delete</Btn>
              </span>
            </div>
          ))}
        </div>
        {shown.length > 100 && <p className="pt-3 text-center text-xs text-black/50">Showing 100 of {shown.length}. Search to narrow the list.</p>}
      </Card>

      <Card t="Groups" sub="A group can mix students from any class. In Schedule you can give a lab time to a whole group.">
        <div className="mb-5 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
          <Inp value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="New group name, for example Isomo circle" />
          <div className="mt-3"><StudentPicker students={students} value={newGroup.members} onChange={(m) => setNewGroup({ ...newGroup, members: m })} /></div>
          <ActBtn className="mt-3" busy={busy === 'group'} doing="Creating…" label="Create group" disabled={!newGroup.name.trim()}
            onClick={async () => {
              if (await act('group', () => api('/api/groups', 'POST', { name: newGroup.name, members: newGroup.members }),
                (r) => `Group created with ${r.added} student${r.added === 1 ? '' : 's'}.`)) setNewGroup({ name: '', members: [] });
            }} />
        </div>
        {groups.length === 0 && <Empty>No groups yet.</Empty>}
        <div className="divide-y divide-black/10">
          {groups.map((g) => (
            <GroupRow key={g.id} g={g} students={students} open={openGroup === g.id}
              onToggle={() => setOpenGroup(openGroup === g.id ? null : g.id)} act={act} sure={sure} busy={busy} />
          ))}
        </div>
      </Card>

      {adding && (
        <Modal title="Add a person" onClose={() => setAdding(false)}>
          <div className="space-y-4">
            <Field l="Role"><Sel value={nw.role} onChange={(v) => setNw({ ...nw, role: v })} options={ROLE_CHOICES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></Field>
            <Field l="Full name"><Inp value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} /></Field>
            <Field l="Google email"><Inp type="email" value={nw.email} onChange={(e) => setNw({ ...nw, email: e.target.value })} /></Field>
            <Field l="Phone or WhatsApp" hint="Optional."><Inp value={nw.phone} onChange={(e) => setNw({ ...nw, phone: e.target.value })} /></Field>
            {nw.role === 'student' && <ClassPick opts={opts} grade={nw.grade} combo={nw.combo} section={nw.section} onChange={(c) => setNw({ ...nw, ...c })} />}
            <div className="flex gap-2 pt-2">
              <ActBtn busy={busy === 'add'} doing="Adding…" label="Add account" disabled={!nw.name.trim() || !nw.email.trim() || (nw.role === 'student' && !nw.grade)}
                onClick={async () => {
                  if (await act('add', () => api('/api/users', 'POST', { name: nw.name, email: nw.email, role: nw.role, phone: nw.phone,
                    ...(nw.role === 'student' && { grade: nw.grade, combo: nw.combo, section: nw.section }) }), `${nw.name} can now sign in with Google.`)) {
                    setAdding(false); setNw({ name: '', email: '', role: 'student', phone: '', grade: '', combo: '', section: '' });
                  }
                }} />
              <Btn c="w" onClick={() => setAdding(false)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}

      {edit && (
        <Modal title={`Edit ${edit.name}`} onClose={() => setEdit(null)}>
          <div className="space-y-4">
            <Field l="Photo link" hint="Empty = default picture."><Inp value={edit.picture} onChange={(e) => setEdit({ ...edit, picture: e.target.value })} placeholder="https://…" /></Field>
            <Field l="Role"><Sel value={edit.role} onChange={(v) => setEdit({ ...edit, role: v })} options={ROLE_CHOICES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></Field>
            <Field l="Full name"><Inp value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field l="Google email"><Inp type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field l="Phone or WhatsApp"><Inp value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            {edit.role === 'student' && <ClassPick opts={opts} grade={edit.grade} combo={edit.combo} section={edit.section} onChange={(c) => setEdit({ ...edit, ...c })} />}
            <div className="flex gap-2 pt-2">
              <ActBtn busy={busy === 'edit'} doing="Saving…" label="Save changes" onClick={async () => {
                if (await act('edit', () => api(`/api/users/${edit.id}`, 'PUT', { name: edit.name, email: edit.email, role: edit.role, phone: edit.phone,
                  ...(edit.picture.trim() !== edit.origPicture && { picture: edit.picture.trim() }),
                  ...(edit.role === 'student' && { grade: edit.grade, combo: edit.combo, section: edit.section }) }), 'Saved.')) setEdit(null);
              }} />
              <Btn c="w" onClick={() => setEdit(null)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GroupRow({ g, students, open, onToggle, act, sure, busy }) {
  const [add, setAdd] = useState([]);
  const members = g.members || [];
  const nonMembers = students.filter((s) => !members.some((m) => m.id === s.id));
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onToggle} className="text-left">
          <b className="text-sm">{g.name}</b> <span className="text-xs text-black/55">· {g.count ?? members.length} student{(g.count ?? members.length) === 1 ? '' : 's'}</span>
        </button>
        <span className="flex gap-2">
          <Btn c="w" onClick={onToggle}>{open ? 'Close' : 'Manage'}</Btn>
          <Btn c="or" onClick={() => sure({ message: `Delete the group ${g.name}? Students keep their accounts.`, ok: 'Delete group', danger: true }, 'gdel' + g.id,
            () => api(`/api/groups/${g.id}`, 'DELETE'), 'Group deleted.')}>Delete</Btn>
        </span>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {members.length === 0 && <span className="text-xs text-black/50">No students yet.</span>}
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff4500]/10 py-1 pl-2 pr-1.5 text-xs font-medium text-[#c2310a]">
                {m.name}<span className="text-black/50">· {m.className}</span>
                <button type="button" aria-label={`Remove ${m.name}`} onClick={() => act('rm' + m.id, () => api(`/api/groups/${g.id}/members/${m.id}`, 'DELETE'), 'Removed from group.')}
                  className="px-1 text-sm leading-none text-[#ff4500]">×</button>
              </span>
            ))}
          </div>
          <StudentPicker students={nonMembers} value={add} onChange={setAdd} />
          <ActBtn busy={busy === 'gadd' + g.id} doing="Adding…" label={`Add ${add.length || ''} to group`} disabled={!add.length}
            onClick={async () => { if (await act('gadd' + g.id, () => api(`/api/groups/${g.id}/members`, 'POST', { members: add }), 'Students added.')) setAdd([]); }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Admin chat: like Messenger. A group chat for all admins and private chats. ---------- */

const EMOJIS = ['👍', '😊', '😂', '❤️', '🙏', '🎉', '👏', '😮'];
const GroupIcon = ({ className = 'h-11 w-11 text-lg' }) => (
  <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#16a34a] to-[#2563eb] text-white ${className}`} aria-hidden="true">👥</span>
);
const Presence = ({ on, children }) => (
  <span className="relative shrink-0">
    {children}
    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${on ? 'bg-[#16a34a]' : 'bg-black/25'}`} />
  </span>
);

function ChatPage({ me, onUnread }) {
  const [sum, setSum] = useState({ people: [], unread: {}, last: {} });
  const [active, setActive] = useState('all');
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [online, setOnline] = useState(null);
  const [typing, setTyping] = useState(null);
  const [showList, setShowList] = useState(true);
  const [emoji, setEmoji] = useState(false);
  const [err, setErr] = useState('');
  const { busy, run } = useBusy();
  const box = useRef(null);
  const lastType = useRef(0);
  const typingTimer = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const loadSum = useCallback(() => api('/api/chat/summary').then((s) => {
    setSum(s);
    onUnread?.(Object.values(s.unread).reduce((a, b) => a + b, 0));
  }).catch(() => {}), []);
  const markRead = (k) => api('/api/chat/read', 'POST', { with: k }).then(loadSum).catch(() => {});

  useEffect(() => { loadSum(); }, []);
  useEffect(() => {
    setMsgs(null); setTyping(null); setErr('');
    api(`/api/chat/messages?with=${encodeURIComponent(active)}`)
      .then((m) => { setMsgs(m); markRead(active); })
      .catch((e) => { setErr(e.message); setMsgs([]); });
  }, [active]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, typing, active]);

  useLive({
    'chat:message': (m) => {
      const key = m.to === 'all' ? 'all' : (m.fromEmail === me.email ? m.to : m.fromEmail);
      if (key === activeRef.current) {
        setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur));
        if (m.fromEmail !== me.email) { setTyping(null); markRead(key); } else loadSum();
      } else loadSum();
    },
    'chat:typing': (t) => {
      const key = t.to === 'all' ? 'all' : t.from;
      if (key !== activeRef.current || t.from === me.email) return;
      setTyping(t.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(null), 3000);
    },
    presence: (list) => setOnline(new Set(list.map((p) => p.email))),
  });

  const people = sum.people.map((p) => ({ ...p, on: online ? online.has(p.email) : p.online }));
  const lastAt = (k) => sum.last[k]?.at || '';
  const sorted = [...people].sort((a, b) => (sum.unread[b.email] || 0) - (sum.unread[a.email] || 0)
    || lastAt(b.email).localeCompare(lastAt(a.email)) || (+b.on - +a.on) || a.name.localeCompare(b.name));
  const list = sorted.filter((p) => match(q, p.name, p.email));
  const showGroup = match(q, 'all admins group');
  const onlineCount = people.filter((p) => p.on).length + 1;
  const other = people.find((p) => p.email === active);
  const preview = (k) => { const l = sum.last[k]; return l ? `${l.fromMe ? 'You: ' : (k === 'all' ? `${l.fromName.split(' ')[0]}: ` : '')}${l.body}` : 'No messages yet'; };

  const open = (k) => { setActive(k); setShowList(false); setEmoji(false); };
  const send = (body) => run('send', async () => {
    const b = String(body ?? text).trim();
    if (!b) return;
    try {
      const m = await api('/api/chat/messages', 'POST', { with: active, body: b });
      setText(''); setEmoji(false);
      setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur));
      loadSum();
    } catch (e) { setErr(e.message); }
  });
  const onType = (v) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastType.current > 2000) { lastType.current = now; liveSocket().emit('chat:typing', activeRef.current); }
  };
  const gap = (a, b) => a && b && a.fromEmail === b.fromEmail && dayHead(a.at) === dayHead(b.at) && new Date(b.at) - new Date(a.at) < 5 * 60000;
  const who = (email) => people.find((p) => p.email === email);

  const Row = ({ k, name, sub, unread, time, avatar, on }) => (
    <button type="button" onClick={() => open(k)} aria-current={active === k ? 'true' : undefined}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-black/[0.04] ${active === k ? 'bg-[#16a34a]/10' : ''}`}>
      {on === undefined ? avatar : <Presence on={on}>{avatar}</Presence>}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <b className={`truncate text-[13px] ${unread ? 'text-[#111827]' : 'font-semibold'}`}>{name}</b>
          {time && <span className={`shrink-0 text-[10px] ${unread ? 'font-bold text-[#16a34a]' : 'text-black/40'}`}>{listTime(time)}</span>}
        </span>
        <span className={`block truncate text-xs ${unread ? 'font-semibold text-[#111827]' : 'text-black/50'}`}>{sub}</span>
      </span>
      {unread > 0 && <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[#ff4500] px-1.5 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
  );

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[480px] overflow-hidden rounded-[10px] border border-black/10 bg-white">
      {/* Left: all chats */}
      <aside className={`${showList ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-r border-black/10 md:flex md:w-80`}>
        <div className="p-3">
          <h2 className="mb-2 text-base font-bold">Chats</h2>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search admins" aria-label="Search admins"
            className="w-full rounded-full bg-[#f0f2f5] px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#16a34a]/40" />
        </div>
        <div className="flex-1 overflow-y-auto pb-2">
          {showGroup && (
            <Row k="all" name="All admins" unread={sum.unread.all || 0} time={sum.last.all?.at}
              sub={preview('all')} avatar={<GroupIcon />} />
          )}
          {list.map((p) => (
            <Row key={p.email} k={p.email} name={p.name} unread={sum.unread[p.email] || 0} time={sum.last[p.email]?.at} on={p.on}
              sub={sum.last[p.email] ? preview(p.email) : (p.on ? 'Active now' : p.lastSeen ? `Active ${ago(p.lastSeen)}` : 'Has not signed in yet')}
              avatar={<Avatar name={p.name} picture={p.picture} className="h-11 w-11 text-sm" />} />
          ))}
          {list.length === 0 && !showGroup && <Empty>No admin found.</Empty>}
          {people.length === 0 && <p className="px-4 py-3 text-xs leading-relaxed text-black/50">Other admins appear here after they sign in once.</p>}
        </div>
      </aside>

      {/* Right: the conversation */}
      <section className={`${showList ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}>
        <header className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
          <button type="button" aria-label="Back to chats" onClick={() => setShowList(true)} className="grid h-8 w-8 place-items-center rounded-full text-lg text-[#16a34a] hover:bg-black/5 md:hidden">←</button>
          {active === 'all'
            ? <GroupIcon className="h-10 w-10 text-base" />
            : <Presence on={!!other?.on}><Avatar name={other?.name || active} picture={other?.picture} className="h-10 w-10 text-xs" /></Presence>}
          <div className="min-w-0">
            <b className="block truncate text-sm">{active === 'all' ? 'All admins' : other?.name || active}</b>
            <span className="block truncate text-[11px] text-black/50">
              {active === 'all' ? `${people.length + 1} admins · ${onlineCount} online`
                : other?.on ? 'Active now' : other?.lastSeen ? `Active ${ago(other.lastSeen)}` : 'Offline'}
            </span>
          </div>
        </header>

        <div ref={box} className="flex-1 overflow-y-auto bg-[#f0f2f5] px-3 py-4 sm:px-5">
          {err && <div className="mb-3"><Alert>{err}</Alert></div>}
          {msgs === null && <Loader full label="Loading messages" />}
          {msgs && msgs.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div>
                {active === 'all' ? <GroupIcon className="mx-auto h-16 w-16 text-3xl" /> : <Avatar name={other?.name || active} picture={other?.picture} className="mx-auto h-16 w-16 text-lg" />}
                <p className="mt-3 text-sm font-semibold">{active === 'all' ? 'All admins' : other?.name}</p>
                <p className="mt-1 text-xs text-black/50">No messages yet. Say hello 👋</p>
              </div>
            </div>
          )}
          {msgs && msgs.map((m, i) => {
            const mine = m.fromEmail === me.email;
            const prev = msgs[i - 1], next = msgs[i + 1];
            const first = !gap(prev, m), last = !gap(m, next);
            const sender = who(m.fromEmail);
            const corner = mine
              ? `${first ? '' : 'rounded-tr-[6px]'} ${last ? '' : 'rounded-br-[6px]'}`
              : `${first ? '' : 'rounded-tl-[6px]'} ${last ? '' : 'rounded-bl-[6px]'}`;
            return (
              <div key={m.id}>
                {(!prev || dayHead(prev.at) !== dayHead(m.at)) && (
                  <div className="my-3 text-center text-[11px] font-medium text-black/45">{dayHead(m.at)}</div>
                )}
                <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${first ? 'mt-2' : 'mt-0.5'}`}>
                  {!mine && (
                    <span className="w-7 shrink-0">
                      {last && <Avatar name={m.fromName} picture={sender?.picture} className="h-7 w-7 text-[9px]" />}
                    </span>
                  )}
                  <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && first && active === 'all' && <span className="mb-0.5 ml-3 text-[11px] font-medium text-black/50">{m.fromName}</span>}
                    <div title={`${dayHead(m.at)} ${clock(m.at)}`}
                      className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[13px] leading-snug ${corner} ${mine ? 'bg-[#16a34a] text-white' : 'bg-white text-[#111827] shadow-sm'}`}>
                      {m.body}
                    </div>
                    {last && <span className="mx-2 mt-0.5 text-[10px] text-black/40">{clock(m.at)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="mt-2 flex items-end gap-2">
              <span className="w-7 shrink-0" />
              <div className="flex items-center gap-1 rounded-[18px] bg-white px-3.5 py-3 shadow-sm" aria-label={`${typing} is typing`}>
                <span className="lb-dot" /><span className="lb-dot" style={{ animationDelay: '.15s' }} /><span className="lb-dot" style={{ animationDelay: '.3s' }} />
              </div>
              <span className="pb-1 text-[11px] text-black/45">{typing.split(' ')[0]} is typing</span>
            </div>
          )}
        </div>

        <footer className="relative border-t border-black/10 bg-white p-3">
          {emoji && (
            <div className="absolute bottom-full left-3 mb-2 flex gap-1 rounded-full border border-black/10 bg-white p-1.5 shadow-lg">
              {EMOJIS.map((e) => <button key={e} type="button" className="h-8 w-8 rounded-full text-lg hover:bg-black/5" onClick={() => { setText((t) => t + e); setEmoji(false); }}>{e}</button>)}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" aria-label="Emoji" onClick={() => setEmoji((v) => !v)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl hover:bg-black/5">☺</button>
            <textarea rows={1} value={text} onChange={(e) => onType(e.target.value)} placeholder="Write a message"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-[20px] bg-[#f0f2f5] px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/40" />
            {text.trim() ? (
              <button type="button" aria-label="Send" disabled={busy === 'send'} onClick={() => send()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#16a34a] text-white hover:opacity-90 disabled:opacity-40">➤</button>
            ) : (
              <button type="button" aria-label="Send a thumbs up" disabled={busy === 'send'} onClick={() => send('👍')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl hover:bg-black/5">👍</button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

function SettingsPage() {
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [labs, setLabs] = useState([]);
  const [newGrade, setNewGrade] = useState('');
  const [newLab, setNewLab] = useState({ name: '', pcs: 10 });
  const [rules, setRules] = useState(null);
  const load = useCallback(() => Promise.all([api('/api/options'), api('/api/labs')]).then(([o, l]) => {
    setOpts({ ...EMPTY_OPTS, ...o });
    setLabs(l);
    setRules((cur) => cur ?? { maxConsecutive: String(o.maxConsecutive ?? 1), graceMinutes: String(o.graceMinutes ?? 15), autoRelease: String(o.autoRelease !== false) });
  }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const { busy, act, sure, note } = useAct(load);

  const grades = gradesOf(opts);
  const full = Object.fromEntries(grades.map((g) => [g, combosFor(opts, g)]));
  const clean = (s) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  const putOpts = (body) => api('/api/options', 'PUT', body).then((o) => setOpts({ ...EMPTY_OPTS, ...o }));
  const saveOpts = (body, done) => act('opts', () => putOpts(body), done);

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Booking rules" sub="These keep the labs fair and free places of students who do not come.">
        {rules && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Field l="Most days in a row one student can book" hint="0 = no limit.">
                <Inp type="number" min="0" max="7" value={rules.maxConsecutive} onChange={(e) => setRules({ ...rules, maxConsecutive: e.target.value })} />
              </Field>
              <Field l="Grace time in minutes" hint="After the start, a student who arrives later than this is marked late.">
                <Inp type="number" min="0" max="120" value={rules.graceMinutes} onChange={(e) => setRules({ ...rules, graceMinutes: e.target.value })} />
              </Field>
              <Field l="Give places of no-shows to the queue">
                <Sel value={rules.autoRelease} onChange={(v) => setRules({ ...rules, autoRelease: v })} options={[{ value: 'true', label: 'Yes, automatically' }, { value: 'false', label: 'No, only with the button' }]} />
              </Field>
            </div>
            <ActBtn className="mt-5" busy={busy === 'opts'} doing="Saving…" label="Save booking rules" onClick={() => saveOpts({
              maxConsecutive: +rules.maxConsecutive || 0, graceMinutes: +rules.graceMinutes || 0, autoRelease: rules.autoRelease === 'true',
            }, 'Booking rules saved.')} />
          </>
        )}
      </Card>

      <Card t="Labs" sub="Name and number of computers of each room.">
        <div className="mb-5 flex flex-wrap gap-3">
          <Inp className="!w-56" placeholder="Lab name" value={newLab.name} onChange={(e) => setNewLab({ ...newLab, name: e.target.value })} />
          <Inp type="number" min="1" className="!w-28" value={newLab.pcs} onChange={(e) => setNewLab({ ...newLab, pcs: e.target.value })} />
          <ActBtn busy={busy === 'lab'} doing="Adding…" label="Add lab" disabled={!newLab.name.trim()}
            onClick={async () => { if (await act('lab', () => api('/api/labs', 'POST', newLab), 'Lab added.')) setNewLab({ name: '', pcs: 10 }); }} />
        </div>
        <div className="divide-y divide-black/10">
          {labs.map((l) => <LabRow key={l.id} l={l} busy={busy} act={act} sure={sure} />)}
        </div>
        {labs.length === 0 && <Empty>No labs yet.</Empty>}
      </Card>

      <Card t="Classes" sub="A class is a grade plus a combination, for example S4 INGABE.">
        <div className="mb-5 flex max-w-md gap-2">
          <Inp placeholder="New grade, for example S3" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} />
          <Btn className="shrink-0" disabled={!clean(newGrade) || grades.includes(clean(newGrade))}
            onClick={async () => { const g = clean(newGrade); if (await saveOpts({ grades: [...grades, g], gradeCombos: { ...full, [g]: [] } }, `${g} added.`)) setNewGrade(''); }}>Add grade</Btn>
        </div>
        {grades.map((g) => (
          <div key={g} className="border-t border-black/10 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-[6px] bg-[#16a34a] px-3 py-1.5 text-xs font-bold text-white">{g}</span>
              <Btn c="or" onClick={() => {
                const rest = { ...full }; delete rest[g];
                sure({ message: `Remove grade ${g}? Students in ${g} keep their class.`, ok: 'Remove', danger: true }, 'opts',
                  () => putOpts({ grades: grades.filter((x) => x !== g), gradeCombos: rest }), 'Grade removed.');
              }}>Remove grade</Btn>
            </div>
            <div className="mt-3">
              <ChipList items={full[g]} placeholder={`Add a combination to ${g}`}
                onAdd={(c) => saveOpts({ grades, gradeCombos: { ...full, [g]: [...full[g], clean(c)] } }, 'Combination added.')}
                onRemove={(c) => sure({ message: `Remove ${c} from ${g}?`, ok: 'Remove', danger: true }, 'opts',
                  () => putOpts({ grades, gradeCombos: { ...full, [g]: full[g].filter((x) => x !== c) } }), 'Removed.')} />
            </div>
          </div>
        ))}
      </Card>

      <Card t="Booking reasons" sub="Students pick one of these when they book.">
        <ChipList items={opts.reasons || []} placeholder="Add a reason"
          onAdd={(x) => saveOpts({ reasons: [...(opts.reasons || []), x] }, 'Reason added.')}
          onEdit={(old, nw) => saveOpts({ reasons: (opts.reasons || []).map((r) => (r === old ? nw : r)) }, 'Reason renamed.')}
          onRemove={(x) => sure({ message: `Remove "${x}"?`, ok: 'Remove', danger: true }, 'opts',
            () => putOpts({ reasons: (opts.reasons || []).filter((r) => r !== x) }), 'Removed.')} />
      </Card>
    </div>
  );
}

function LabRow({ l, busy, act, sure }) {
  const [name, setName] = useState(l.name);
  const [pcs, setPcs] = useState(l.pcs);
  const changed = name.trim() !== l.name || +pcs !== l.pcs;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <Inp className="!w-56 font-bold" value={name} onChange={(e) => setName(e.target.value)} aria-label="Lab name" />
      <span className="flex flex-wrap items-center gap-2">
        <Inp type="number" min="1" className="!w-24" value={pcs} onChange={(e) => setPcs(e.target.value)} />
        <span className="text-xs text-black/55">computers</span>
        <ActBtn busy={busy === 'lab' + l.id} doing="Saving…" label="Save" disabled={!changed || !name.trim() || !(+pcs >= 1)}
          onClick={() => act('lab' + l.id, () => api(`/api/labs/${l.id}`, 'PUT', { name: name.trim(), pcs: +pcs }), 'Saved.')} />
        <Btn c="or" onClick={() => sure({ message: `Delete ${l.name}? Its lab times and bookings are removed.`, ok: 'Delete lab', danger: true },
          'ld' + l.id, () => api(`/api/labs/${l.id}`, 'DELETE'), 'Lab deleted.')}>Delete</Btn>
      </span>
    </div>
  );
}

/* ================================================================== */
/* 7. LOST AND FOUND manager, PROFILE                                  */
/* ================================================================== */

function TrendsManager({ user, opts }) {
  const [cats, setCats] = useState(catsOf(opts));
  const [items, setItems] = useState(null);
  const [view, setView] = useState('active');
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState({ title: '', category: '', foundAt: '', description: '', phone: '', email: user.email || '' });
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState('');
  const { busy, run } = useBusy();
  const load = () => api('/api/trends/manage').then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); api('/api/options').then((o) => setCats(catsOf(o))).catch(() => {}); }, []);
  useLive({ 'trends:update': load });
  const { act, sure, note } = useAct(load);

  const pick = (e) => run('pick', async () => {
    const list = [...e.target.files];
    e.target.value = '';
    for (const file of list) {
      if (files.length >= 6) { setErr('You can add up to 6 files.'); break; }
      if (file.size > 12 * 1024 * 1024) { setErr(`${file.name} is bigger than 12 MB. Paste a link for long videos.`); continue; }
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      setFiles((p) => (p.length >= 6 ? p : [...p, { name: file.name, mime: file.type || 'application/octet-stream', data, size: file.size }]));
    }
  });
  const submit = () => run('submit', async () => {
    setErr('');
    try {
      await api('/api/trends', 'POST', { ...f, category: f.category || cats[0] || 'Other', files: files.map(({ name, mime, data }) => ({ name, mime, data })) });
      setF({ title: '', category: '', foundAt: '', description: '', phone: '', email: user.email || '' });
      setFiles([]); setFormOpen(false);
      await load();
    } catch (x) { setErr(x.message); }
  });

  const list = items || [];
  const shown = list.filter((t) => view === 'all' || t.status === view);
  const n = (s) => list.filter((t) => t.status === s).length;
  if (items === null) return err ? <Alert>{err}</Alert> : <Loader full label="Loading" />;

  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Post a found item" sub="A post can be removed 7 days after it was posted, and reposted later."
        action={!formOpen && <Btn onClick={() => setFormOpen(true)}>+ New post</Btn>}>
        {formOpen ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field l="What was found?"><Inp value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Black jacket with a red zip" /></Field>
            <Field l="Category"><Sel value={f.category || cats[0]} onChange={(v) => setF({ ...f, category: v })} options={cats.map((c) => ({ value: c, label: c }))} /></Field>
            <Field l="Where was it found?" hint="Optional."><Inp value={f.foundAt} onChange={(e) => setF({ ...f, foundAt: e.target.value })} /></Field>
            <Field l="Phone or WhatsApp" hint="Optional."><Inp value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field l="Contact email" hint="Optional."><Inp type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field l="Details" hint="Keep one detail back so the real owner can prove it."><textarea rows={3} className={FIELD} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <div className="rounded-[8px] border border-black/10 bg-black/[0.02] p-4 md:col-span-2">
              <label className={`inline-block cursor-pointer rounded-[6px] border border-black/20 bg-white px-4 py-2 text-xs font-semibold ${busy === 'pick' ? 'opacity-50' : ''}`}>
                {busy === 'pick' ? 'Preparing…' : 'Choose photos or files (up to 6)'}
                <input type="file" multiple className="sr-only" onChange={pick} disabled={busy === 'pick'} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
              </label>
              <p className="mt-2 text-xs text-black/55">{files.length} file{files.length === 1 ? '' : 's'} ready</p>
            </div>
            <div className="flex gap-3 md:col-span-2">
              <ActBtn busy={busy === 'submit'} doing="Posting…" label="Post item" disabled={!f.title.trim() || busy === 'pick'} onClick={submit} />
              <Btn c="w" onClick={() => setFormOpen(false)}>Cancel</Btn>
            </div>
          </div>
        ) : <p className="text-xs text-black/55">Add a photo, a category and a way to contact you.</p>}
      </Card>

      <Card t="Posts" action={<Pills value={view} onChange={setView} items={[['active', 'On the board', n('active')], ['returned', 'Returned', n('returned')], ['removed', 'Removed', n('removed')], ['all', 'All', list.length]]} />}>
        {shown.length === 0 && <Empty>No posts here.</Empty>}
        <div className="divide-y divide-black/10">
          {shown.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{t.title}</b><Badge s={t.status} /><span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold">{t.category}</span>
                </div>
                <p className="mt-1 text-xs text-black/55">
                  Posted {ago(t.postedAt)}
                  {t.status === 'active' && (t.daysLeft ? ` · can be removed in ${t.daysLeft} day(s)` : ' · ready to remove or repost')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status === 'active' ? (
                  <>
                    <Btn c="bl" onClick={() => sure({ message: 'Mark this item as returned to its owner?', ok: 'Yes, returned' }, 'ret' + t.id, () => api(`/api/trends/${t.id}/returned`, 'PATCH'), 'Marked as returned.')}>Returned</Btn>
                    <Btn c="or" disabled={t.daysLeft > 0} onClick={() => sure({ message: 'Take this post off the board? You can repost it later.', ok: 'Remove', danger: true }, 'rm' + t.id, () => api(`/api/trends/${t.id}/remove`, 'PATCH'), 'Removed from the board.')}>Remove</Btn>
                  </>
                ) : (
                  <>
                    <Btn onClick={() => act('rp' + t.id, () => api(`/api/trends/${t.id}/repost`, 'PATCH'), 'Reposted.')}>Repost</Btn>
                    <Btn c="or" onClick={() => sure({ message: 'Delete this post for good?', ok: 'Delete', danger: true }, 'del' + t.id, () => api(`/api/trends/${t.id}`, 'DELETE'), 'Deleted.')}>Delete</Btn>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card t="Categories" sub="Visitors filter the board by these.">
        <ChipList items={cats} placeholder="Add a category"
          onAdd={async (x) => { try { const r = await api('/api/trends/categories', 'PUT', { list: [...cats, x] }); setCats(r.list); return true; } catch (e) { setErr(e.message); return false; } }}
          onRemove={(x) => sure({ message: `Remove the category "${x}"? Posts keep their category.`, ok: 'Remove', danger: true }, 'cat',
            async () => { const r = await api('/api/trends/categories', 'PUT', { list: cats.filter((c) => c !== x) }); setCats(r.list); }, 'Category removed.')} />
      </Card>
    </div>
  );
}

// Everyone can change their own photo and phone number (students too).
function Profile({ onChanged }) {
  const [p, setP] = useState(null);
  const [pic, setPic] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState(null);
  const { busy, run } = useBusy();
  const load = () => api('/api/profile').then((d) => { setP(d); setPic(d.picture || ''); setPhone(d.phone || ''); }).catch((e) => setNote({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);
  if (!p) return note ? <Alert>{note.text}</Alert> : <Loader full label="Loading your profile" />;
  const save = () => run('save', async () => {
    setNote(null);
    try {
      await api('/api/me/profile', 'PUT', { picture: pic.trim(), phone: phone.trim() });
      setNote({ ok: true, text: 'Your profile is saved.' });
      onChanged?.();
      load();
    } catch (e) { setNote({ ok: false, text: e.message }); }
  });
  const s = p.stats;
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card>
        <div className="flex flex-col items-center text-center">
          <Avatar name={p.name} picture={pic} className="h-24 w-24 text-2xl" />
          <h2 className="mt-4 text-base font-bold">{p.name}</h2>
          <span className="mt-2 rounded-[4px] bg-[#ff4500]/10 px-3 py-1 text-[11px] font-semibold text-[#c2310a]">{ROLE_LABEL[p.role] || p.role}</span>
        </div>
        <dl className="mt-6 divide-y divide-black/10 text-xs">
          {[['Email', p.email || 'Not set'], ...(p.role === 'student' ? [['Class', p.cls || 'Not set']] : []), ...(p.comm ? [['Extra role', 'Minister of Communication']] : [])].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-black/50">{k}</dt><dd className="break-all text-right font-medium">{v}</dd></div>
          ))}
        </dl>
      </Card>
      <div className="space-y-6">
        <Card t="Edit my profile" sub="Change your photo and phone number. Your name and email are set by the school.">
          {note && <div className="mb-4"><Alert ok={note.ok}>{note.text}</Alert></div>}
          <div className="space-y-4">
            <Field l="Photo link" hint="Paste a link to a photo. Google Drive and Dropbox share links work too. Empty = default picture.">
              <Inp value={pic} onChange={(e) => setPic(e.target.value)} placeholder="https://…" />
            </Field>
            <Field l="Phone or WhatsApp" hint="People who find your lost items use this to reach you.">
              <Inp value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 7xx xxx xxx" />
            </Field>
            <ActBtn busy={busy === 'save'} doing="Saving…" label="Save profile" onClick={save} />
          </div>
        </Card>
        {s && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat v={s.total} t={p.role === 'student' ? 'Bookings' : 'Bookings made'} />
            <Stat v={s.approved} t="Approved" tone="gr" />
            <Stat v={s.pending} t="Waiting" tone="or" />
            <Stat v={s.present} t="Attended" tone="gr" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* 8. DASHBOARD SHELL and ROOT                                         */
/* ================================================================== */

const NAV_ICON = { 'My labs': CalendarDays, Bookings: CalendarCheck2, 'Lost & Found': PackageSearch, Profile: UserRound, Overview: LayoutDashboard, Labs: FlaskConical, Schedule: CalendarClock, People: UsersRound, Chat: MessageCircle, Settings: Settings2 };

const NavBadge = ({ n }) => (n > 0 ? <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-[#ff4500] px-1.5 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span> : null);

function Dashboard({ user, opts, intent, onIntentDone, onLogout, onRefreshMe }) {
  const isAdmin = user.role === 'admin';
  const items = isAdmin
    ? [...ADMIN_TABS, 'Lost & Found', 'Profile']
    : [user.role === 'student' ? 'My labs' : 'Bookings', ...(user.comm ? ['Lost & Found'] : []), 'Profile'];
  const [picked, setPage] = useState(items[0]);
  const page = items.includes(picked) ? picked : items[0];
  const [labView, setLabView] = useState(null);
  const [unread, setUnread] = useState(0);
  const refreshUnread = () => api('/api/chat/summary').then((s) => setUnread(Object.values(s.unread).reduce((a, b) => a + b, 0))).catch(() => {});
  useLive({
    'me:update': onRefreshMe,
    'chat:message': () => { if (isAdmin && page !== 'Chat') refreshUnread(); },
  });
  useEffect(() => { if (isAdmin) refreshUnread(); }, []);

  // Tell the server which page this admin is on, so other admins can see it live.
  useEffect(() => {
    if (!isAdmin) return;
    const label = labView ? `Labs · ${labView.name || 'lab'}` : page;
    liveSocket().emit('page', label);
  }, [page, labView, isAdmin]);

  let body;
  if (page === 'Profile') body = <Profile onChanged={onRefreshMe} />;
  else if (page === 'Lost & Found') body = <TrendsManager user={user} opts={opts} />;
  else if (isAdmin) {
    if (page === 'Overview') body = <OverviewPage me={user} />;
    else if (page === 'Labs') body = labView
      ? <LabDetail labId={labView.id} day={labView.day} onBack={() => setLabView(null)} />
      : <LabsPage onOpenLab={(id, day, name) => setLabView({ id, day, name })} />;
    else if (page === 'Schedule') body = <SchedulePage />;
    else if (page === 'People') body = <PeoplePage />;
    else if (page === 'Chat') body = <ChatPage me={user} onUnread={setUnread} />;
    else body = <SettingsPage />;
  } else body = <Booker user={user} opts={opts} intent={intent} onIntentDone={onIntentDone} />;

  const go = (x) => { setPage(x); setLabView(null); };
  const badgeOf = (x) => (x === 'Chat' ? unread : 0);

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[13px] text-[#111827] lg:flex">
      <aside className="hidden flex-col border-r border-black/10 bg-white p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0">
        <Logo />
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {items.map((x) => (
            <button key={x} type="button" onClick={() => go(x)} aria-current={page === x ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-xs font-semibold ${page === x ? 'bg-[#16a34a] text-white' : 'text-black/70 hover:bg-black/5'}`}>
              {(() => { const Icon = NAV_ICON[x] || UserRound; return <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />; })()}{x}<NavBadge n={badgeOf(x)} />
            </button>
          ))}
        </nav>
        <div className="mt-4 rounded-[8px] bg-black/[0.04] p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} picture={user.picture} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{user.name}</div>
              <div className="text-[11px] text-black/55">{user.comm && user.role !== 'admin' ? 'Minister of Communication' : ROLE_LABEL[user.role] || user.role}</div>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="mt-3 w-full rounded-[6px] px-2 py-2 text-left text-xs font-semibold text-[#ff4500] hover:bg-[#ff4500]/10">Log out</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-black/10 bg-white lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo />
            <Btn c="w" onClick={onLogout}>Log out</Btn>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Main">
            {items.map((x) => (
              <button key={x} type="button" onClick={() => go(x)}
                className={`flex shrink-0 items-center gap-2 rounded-[6px] px-3 py-2 text-xs font-semibold ${page === x ? 'bg-[#16a34a] text-white' : 'text-black/70 hover:bg-black/5'}`}>
                {(() => { const Icon = NAV_ICON[x] || UserRound; return <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />; })()}{x}{badgeOf(x) > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[#ff4500] px-1 text-[9px] font-bold text-white">{badgeOf(x)}</span>}
              </button>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight">{page}{labView && ' · Lab'}</h1>
            <p className="mt-0.5 text-xs text-black/50">{user.name}{user.email ? ` · ${user.email}` : ''}</p>
          </div>
          {body}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [booting, setBooting] = useState(!!getToken());
  const [intent, setIntent] = useState(null);

  const loadOpts = () => api('/api/options').then((o) => setOpts({ ...EMPTY_OPTS, ...o })).catch(() => {});
  const refreshMe = () => api('/api/me').then(setUser).catch(() => {});

  useEffect(() => {
    loadOpts();
    if (getToken()) {
      api('/api/me')
        .then((u) => { setUser(u); setView('app'); })
        .catch(() => setToken(''))
        .finally(() => setBooting(false));
    }
  }, []);

  const handleAuth = async (t) => {
    setToken(t);
    dropSocket();
    await loadOpts();
    setUser(await api('/api/me'));
    setView('app');
  };
  const logout = () => { setToken(''); dropSocket(); setUser(null); setIntent(null); setView('home'); };
  const goLogin = (i) => { setIntent(i && i.sessionId ? i : null); setView('login'); };

  let page;
  if (booting) page = <Loader full label="Loading" />;
  else if (view === 'app' && user) page = <Dashboard user={user} opts={opts} intent={intent} onIntentDone={() => setIntent(null)} onLogout={logout} onRefreshMe={refreshMe} />;
  else if (view === 'login') page = <Auth onDone={handleAuth} onBack={() => setView('home')} intent={intent} />;
  else page = <Landing onLogin={goLogin} />;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <ConfirmProvider>{page}</ConfirmProvider>
    </>
  );
}