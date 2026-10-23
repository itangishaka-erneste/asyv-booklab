import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import logo from './assets/as.png';

/* ================================================================== */
/* 0. API, LIVE UPDATES, SETTINGS                                      */
/* ================================================================== */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const LAB_IMG = import.meta.env.VITE_LAB_IMAGE || '/lab.jpg';

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

function useLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const socket = io(BASE, { auth: { token: getToken() } });
    Object.keys(ref.current).forEach((ev) => socket.on(ev, (...a) => ref.current[ev]?.(...a)));
    return () => socket.disconnect();
  }, []);
}

function usePublicLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const socket = io(BASE);
    Object.keys(ref.current).forEach((ev) => socket.on(ev, (...a) => ref.current[ev]?.(...a)));
    return () => socket.disconnect();
  }, []);
}

const DEFAULT_GRADES = ['S4', 'S5', 'S6'];
const DEFAULT_CATS = ['Clothes', 'Shoes', 'Keys', 'Bags', 'Phones and electronics', 'Books and stationery', 'Documents and IDs', 'Water bottles and lunch boxes', 'Jewelry and watches', 'Other'];
const SECTIONS = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
const EMPTY_OPTS = { grades: [], gradeCombos: {}, reasons: [], trendCategories: [] };
const gradesOf = (o) => (o.grades?.length ? o.grades : DEFAULT_GRADES);
const combosFor = (o, g) => o.gradeCombos?.[g] ?? [];
const catsOf = (o) => (o?.trendCategories?.length ? o.trendCategories : DEFAULT_CATS);
const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', psychosocial: 'Psychosocial worker', student: 'Student' };
const ROLE_CHOICES = ['student', 'teacher', 'psychosocial'];

/* ================================================================== */
/* 1. HELPERS                                                          */
/* ================================================================== */

const match = (q, ...fields) => {
  const hay = fields.join(' ').toLowerCase();
  return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};
const nameKey = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => dayOffset(0);
const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const niceDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
const shortDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const weekStart = (s) => { const [y, m, d] = s.split('-').map(Number); return shiftDay(s, -((new Date(y, m - 1, d).getDay() + 6) % 7)); };
const weekText = (ws) => `${shortDay(ws)} – ${shortDay(shiftDay(ws, 6))}`;
const inWeek = (date, ws) => !ws || (date >= ws && date <= shiftDay(ws, 6));
const dayOf = (s) => String(s.date).slice(0, 10);
const forLabel = (s) => s.forGroupName || s.forClass || (s.forPeople ? `${s.forPeople} chosen student${s.forPeople === 1 ? '' : 's'}` : '');
const audText = (s) => (forLabel(s) ? `${s.exclusive ? 'Only ' : 'Reserved: '}${forLabel(s)}` : 'Everyone');
const initials = (name) => String(name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const gravatar = (gid) => (gid ? `https://www.gravatar.com/avatar/${gid}?s=96&d=404` : '');
const ago = (iso) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const niceSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ytId = (u) => (String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/) || [])[1] || '';
const isVideoFile = (u) => /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u) || String(u).includes('/api/trends/files/');
const mediaSrc = (m) => (m.src?.startsWith('/') ? BASE + m.src : m.src);
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
const photosOf = (item) => item.media.map(photoOf).filter(Boolean);
const IMG_LINK = /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i;
const MAX_UPLOAD = 12 * 1024 * 1024;
const MAX_ATTACH = 6;

// Opens a simple printable page with a table.
function printTable(title, sub, head, rows) {
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>
    body{font:12px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}
    p{color:#555;margin:0 0 14px}table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #888;padding:6px 8px;text-align:left}th{background:#eee}</style></head><body>
    <h1>${esc(title)} · Asyv_lms</h1><p>${esc(sub)}</p>
    <table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

const readFile = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(new Error(`Could not read ${file.name}.`));
  r.readAsDataURL(file);
});

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

/* ================================================================== */
/* 2. ICONS AND UI KIT                                                 */
/* ================================================================== */

const ICON_PATHS = {
  Overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  People: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  Schedule: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  Bookings: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></>,
  Settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  Labs: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  Profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  Tag: <><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><path d="M7 7h.01" /></>,
  Search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  Logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
};
const Icon = ({ n, className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {ICON_PATHS[n]}
  </svg>
);

const BTN = {
  ink: 'bg-[#16a34a] text-white',
  or: 'bg-[#ff4500] text-white',
  bl: 'bg-[#2563eb] text-white',
  dk: 'bg-[#111827] text-white',
  w: 'bg-white text-[#111827] border border-black/20 hover:bg-black/5',
};
const Btn = ({ c = 'ink', className = '', ...p }) => (
  <button type="button" className={`px-4 py-2 text-xs font-semibold rounded-[6px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${BTN[c]} ${className}`} {...p} />
);

// Button that shows a spinner while its action runs. Clicks are ignored while busy.
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
const Field = ({ l, hint, children }) => (
  <label className="block text-xs font-medium">
    <span className="mb-1.5 block">{l}</span>
    {children}
    {hint && <span className="mt-1.5 block font-normal text-black/50">{hint}</span>}
  </label>
);
const Lbl = ({ l, children }) => (
  <div className="text-xs font-medium">
    <span className="mb-1.5 block">{l}</span>
    {children}
  </div>
);

// Styled dropdown. options = [{ value, label }]
function Dropdown({ value, onChange, options, placeholder = 'Choose…', disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-[6px] border border-black/20 bg-white px-3 py-2 text-left text-xs hover:border-[#ff4500]/60 focus:border-[#ff4500] focus:outline-none disabled:opacity-50">
        <span className={cur ? '' : 'text-black/45'}>{cur ? cur.label : placeholder}</span>
        <span className={`text-[#ff4500] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-[8px] border border-[#ff4500]/30 bg-white py-1 shadow-xl">
          {options.map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={o.value === value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#ff4500]/10 ${o.value === value ? 'font-bold text-[#ff4500]' : ''}`}>
                {o.label}{o.value === value && <span>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Card = ({ t, sub, action, children }) => (
  <section className="rounded-[8px] border border-black/10 bg-white p-5">
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
  present: 'bg-[#16a34a] text-white', absent: 'bg-[#ff4500]/10 text-[#c2310a]', active: 'bg-[#16a34a] text-white',
  returned: 'bg-[#2563eb]/10 text-[#1d4ed8]', removed: 'bg-black/10 text-black/55', available: 'bg-[#16a34a]/10 text-[#15803d]',
  limited: 'bg-[#ff4500]/10 text-[#c2310a]', requested: 'bg-[#ff4500]/10 text-[#c2310a]', full: 'bg-[#ff4500] text-white',
  draft: 'bg-[#2563eb]/10 text-[#1d4ed8]', published: 'bg-[#16a34a]/10 text-[#15803d]', none: 'bg-black/5 text-black/60',
};
const Badge = ({ s, children }) => (
  <span className={`inline-block rounded-[4px] px-2 py-0.5 text-[11px] font-semibold capitalize ${BADGE[s] || 'bg-black/5 text-black/60'}`}>{children || s}</span>
);
const AttBadge = ({ att }) => <Badge s={att || 'none'}>{att ? (att === 'present' ? 'Present' : 'Absent') : 'Not marked'}</Badge>;

const Empty = ({ children }) => <p className="py-6 text-center text-sm text-black/50">{children}</p>;

// Small spinning circle with "Asyv" inside. full = fills the area.
const Loader = ({ label = 'Loading', full = false, small = false }) => {
  const el = (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
      <div className={`relative grid place-items-center rounded-full ${small ? 'h-8 w-8' : 'h-14 w-14'}`}>
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#16a34a]/20 border-t-[#ff4500]" />
        <span className={`font-extrabold tracking-tight text-[#16a34a] ${small ? 'text-[8px]' : 'text-[11px]'}`}>Asyv</span>
      </div>
      {!small && <span className="text-xs text-black/55">{label}…</span>}
    </div>
  );
  return full ? <div className="grid min-h-[50vh] place-items-center">{el}</div> : el;
};

// One action at a time. A second click while busy does nothing (no duplicates).
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

// Styled "Are you sure?" dialog. Usage: if (await ask({ message, ok, danger })) ...
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
              <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full text-lg font-bold ${st.danger ? 'bg-[#ff4500]/10 text-[#ff4500]' : 'bg-[#16a34a]/10 text-[#16a34a]'}`}>{st.danger ? '!' : '?'}</div>
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

const Stat = ({ v, t, tone }) => {
  const color = { gr: 'text-[#16a34a]', or: 'text-[#ff4500]' }[tone] || 'text-[#111827]';
  return (
    <div className="rounded-[8px] border border-black/10 bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{v}</div>
      <div className="mt-1 text-xs font-medium text-black/60">{t}</div>
    </div>
  );
};

const Row = ({ children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 py-3.5 first:border-t-0">{children}</div>
);

const Modal = ({ title, onClose, wide, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`my-auto max-h-[92vh] w-full overflow-y-auto rounded-[8px] bg-white p-6 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`} onClick={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="text-xl leading-none text-black/50 hover:text-black">×</button>
      </div>
      {children}
    </div>
  </div>
);

const SearchBox = ({ value, onChange, placeholder = 'Search' }) => (
  <div className="relative">
    <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-black/40"><Icon n="Search" /></span>
    <Inp type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="!pl-9" />
  </div>
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

function DayBar({ day, onChange }) {
  const t = today();
  const base = day || t;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn c="w" onClick={() => onChange(shiftDay(base, -1))}>← Day before</Btn>
      <Inp type="date" aria-label="Choose a day" value={day} onChange={(e) => e.target.value && onChange(e.target.value)} className="!w-40" />
      <Btn c="w" onClick={() => onChange(shiftDay(base, 1))}>Day after →</Btn>
      {day !== t && <Btn onClick={() => onChange(t)}>Today</Btn>}
      {day !== '' && <Btn c="w" onClick={() => onChange('')}>All days</Btn>}
    </div>
  );
}

function WeekBar({ week, onChange }) {
  const cur = weekStart(today());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn c="w" disabled={!week} onClick={() => onChange(shiftDay(week, -7))}>← Previous week</Btn>
      <span className="min-w-[11rem] text-center text-xs font-semibold">
        {week ? weekText(week) : 'All weeks'}
        {week === cur && <span className="ml-2"><Badge s="active">This week</Badge></span>}
      </span>
      <Btn c="w" disabled={!week} onClick={() => onChange(shiftDay(week, 7))}>Next week →</Btn>
      {week !== cur && <Btn onClick={() => onChange(cur)}>This week</Btn>}
      {week && <Btn c="w" onClick={() => onChange('')}>All weeks</Btn>}
    </div>
  );
}

const initialsEl = (name) => initials(name);
function Avatar({ name, picture, gid, className = 'h-10 w-10 text-xs' }) {
  const srcs = [directImg(picture), gravatar(gid)].filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [picture, gid]);
  if (i < srcs.length) {
    return <img src={srcs[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)} className={`shrink-0 rounded-full bg-black/10 object-cover ${className}`} />;
  }
  return <span className={`grid shrink-0 place-items-center rounded-full bg-[#16a34a] font-bold text-white ${className}`}>{initialsEl(name)}</span>;
}

const Person = ({ p, sub, className = 'h-9 w-9 text-xs' }) => (
  <span className="flex min-w-0 items-center gap-3">
    <Avatar name={p.name} picture={p.picture} gid={p.gid} className={className} />
    <span className="min-w-0">
      <b className="block truncate">{p.name}</b>
      <span className="block truncate text-black/55">{sub ?? (p.email || 'No email')}</span>
    </span>
  </span>
);

// Pick several students by name or email, or a whole class. Pasting a list works too.
function PeoplePicker({ students, value, onChange }) {
  const [text, setText] = useState('');
  const find = (t) => students.find((s) => (t.includes('@') ? (s.email || '').toLowerCase() === t.toLowerCase() : nameKey(s.name) === nameKey(t)));
  const add = (list) => {
    const clean = list.map((x) => x.trim()).filter(Boolean);
    if (!clean.length) return;
    const have = new Set(value.map((v) => find(v)?.id ?? `t:${v.toLowerCase()}`));
    const next = [...value];
    clean.forEach((v) => {
      const key = find(v)?.id ?? `t:${v.toLowerCase()}`;
      if (!have.has(key)) { have.add(key); next.push(v); }
    });
    onChange(next);
  };
  const commit = () => { add(text.split(/[\n,;]+/)); setText(''); };
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const chosen = new Set(value.map((v) => find(v)?.id).filter(Boolean));
  const sugg = text.trim() ? students.filter((s) => !chosen.has(s.id) && match(text, s.name, s.email, s.className)).slice(0, 6) : [];
  const unknown = value.filter((v) => !find(v));

  return (
    <div>
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-[6px] border border-black/20 bg-white p-2 focus-within:border-[#16a34a]">
        {value.map((v) => {
          const s = find(v);
          return (
            <span key={v} title={s ? s.email : 'No student found'}
              className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-xs font-medium ${s ? 'bg-[#16a34a]/10 text-[#15803d]' : 'border border-dashed border-[#ff4500] text-[#c2310a]'}`}>
              {s ? <Avatar name={s.name} picture={s.picture} gid={s.gid} className="h-5 w-5 text-[9px]" /> : <span className="pl-1.5">?</span>}
              {s ? s.name : v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="leading-none text-[#ff4500]">×</button>
            </span>
          );
        })}
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
          onKeyDown={(e) => {
            if (['Enter', ',', ';'].includes(e.key)) { e.preventDefault(); commit(); }
            else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (/[\n,;]/.test(t)) { e.preventDefault(); add(t.split(/[\n,;]+/)); }
          }}
          placeholder={value.length ? 'Add more…' : 'Type or paste names or emails'}
          className="min-w-[160px] flex-1 bg-transparent px-1.5 py-1 text-xs outline-none" />
      </div>
      {sugg.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-[6px] border border-black/10 bg-white shadow-md">
          {sugg.map((s) => (
            <li key={s.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { add([s.email || s.name]); setText(''); }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-[#16a34a]/5">
                <Person p={s} className="h-7 w-7 text-[10px]" />
                <span className="text-black/50">{s.className}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="w-56">
          <Dropdown placeholder="Add a whole class…" value="" onChange={(c) => add(students.filter((s) => s.className === c).map((s) => s.email || s.name))}
            options={classes.map((c) => ({ value: c, label: c }))} />
        </div>
        <span className="text-xs text-black/55">{value.length - unknown.length} student{value.length - unknown.length === 1 ? '' : 's'}</span>
        {unknown.length > 0 && (
          <button type="button" onClick={() => onChange(value.filter((v) => find(v)))} className="text-xs font-semibold text-[#c2310a] hover:underline">
            Remove {unknown.length} not found
          </button>
        )}
      </div>
    </div>
  );
}

// Grade + combination + section chooser. Value is one class at a time.
const classChoices = (opts) => gradesOf(opts).flatMap((g) => {
  const cs = combosFor(opts, g);
  return cs.length ? cs.map((c) => ({ value: `${g}|${c}`, label: `${g} ${c}` })) : [{ value: `${g}|`, label: g }];
});
const ClassPick = ({ opts, grade, combo, section = '', onChange }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <Lbl l="Class">
      <Dropdown placeholder="Choose a class…" options={classChoices(opts)} value={grade ? `${grade}|${combo || ''}` : ''}
        onChange={(v) => { const [g, c] = v.split('|'); onChange({ grade: g, combo: c || '', section }); }} />
    </Lbl>
    <Lbl l="Section (optional)">
      <Dropdown options={[{ value: '', label: 'No section' }, ...SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }))]} value={section}
        onChange={(v) => onChange({ grade, combo: combo || '', section: v })} />
    </Lbl>
  </div>
);

// Simple list of removable items with an add box.
function ChipList({ items, placeholder, onAdd, onRemove, busy = false }) {
  const [v, setV] = useState('');
  const add = async () => {
    const x = v.trim();
    if (!x || items.includes(x)) return;
    if (await onAdd(x)) setV('');
  };
  return (
    <div>
      <div className="mb-3 flex min-h-[28px] flex-wrap gap-2">
        {items.length === 0 && <span className="py-1 text-xs text-black/50">Nothing yet.</span>}
        {items.map((x) => (
          <span key={x} className="inline-flex items-center gap-2 rounded-[6px] border border-black/15 bg-white py-1.5 pl-3 pr-2 text-xs font-medium">
            {x}
            <button type="button" aria-label={`Remove ${x}`} onClick={() => onRemove(x)}
              className="grid h-4 w-4 place-items-center rounded-[3px] text-[#ff4500] hover:bg-[#ff4500]/10">×</button>
          </span>
        ))}
      </div>
      <div className="flex max-w-md gap-2">
        <Inp placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <ActBtn busy={busy} doing="Adding…" label="Add" className="shrink-0" disabled={!v.trim()} onClick={add} />
      </div>
    </div>
  );
}

const LOGO_LETTERS = [
  ['A', 'dark'], ['s', 'dark'], ['y', 'dark'], ['v', 'dark'], ['_', 'or'], ['l', 'green'], ['m', 'green'], ['s', 'green'],
];
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

/* ================================================================== */
/* 3. GLOBAL CSS                                                       */
/* ================================================================== */

const GLOBAL_CSS = `
@keyframes lbIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes lbKen{from{transform:scale(1) translate(0,0)}to{transform:scale(1.14) translate(-2%,-2%)}}
@keyframes lbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes lbPulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes lbScan{from{top:-5rem}to{top:100%}}
@keyframes lbShift{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,10px)}}
@keyframes lbGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes lbBounce{0%,55%,100%{transform:translateY(0)}25%{transform:translateY(-7px)}40%{transform:translateY(0)}47%{transform:translateY(-2px)}}
.lb-in{animation:lbIn .7s ease both}
.lb-in2{animation:lbIn .7s .15s ease both}
.lb-in3{animation:lbIn .7s .3s ease both}
.lb-ken{animation:lbKen 14s ease-in-out infinite alternate}
.lb-float{animation:lbFloat 5s ease-in-out infinite}
.lb-float2{animation:lbFloat 6s 1.2s ease-in-out infinite}
.lb-pulse{animation:lbPulse 1.6s ease-in-out infinite}
.lb-scan{animation:lbScan 4.5s linear infinite}
.lb-shift{animation:lbShift 7s ease-in-out infinite}
.lb-grow{transform-origin:bottom;animation:lbGrow .8s cubic-bezier(.2,.8,.2,1) both}
.lb-bounce{display:inline-block;animation:lbBounce 2.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.lb-in,.lb-in2,.lb-in3,.lb-ken,.lb-float,.lb-float2,.lb-pulse,.lb-scan,.lb-shift,.lb-grow,.lb-bounce{animation:none!important}}
`;

const LabImage = ({ className = '', ken }) => {
  const [bad, setBad] = useState(false);
  if (bad) return <div className={`grid place-items-center bg-[#f0fdf4] text-[#16a34a] ${className}`}><Icon n="Labs" className="h-10 w-10" /></div>;
  return <img src={LAB_IMG} alt="Computer lab" onError={() => setBad(true)} className={`object-cover ${ken ? 'lb-ken' : ''} ${className}`} />;
};

/* ================================================================== */
/* 4. LANDING PAGE                                                     */
/* ================================================================== */

const WRAP = 'max-w-6xl mx-auto px-6';
const STATUS_TEXT = { available: 'Places available', limited: 'Almost full', requested: 'All requested', full: 'Full', none: 'No lab time' };

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

function Header({ onLogin }) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className={`${WRAP} flex h-16 items-center justify-between`}>
        <Logo />
        <nav className="hidden gap-2 text-xs font-medium md:flex">
          <a href="#labs" className="rounded-[6px] px-3 py-2 text-black/70 hover:bg-black/5">Labs</a>
          <a href="#trends" className="rounded-[6px] px-3 py-2 text-black/70 hover:bg-black/5">Lost and found</a>
        </nav>
        <Btn onClick={() => onLogin()}>Log in</Btn>
      </div>
    </header>
  );
}

function Hero({ onLogin }) {
  const { data } = useOverview(today());
  const tot = data?.totals || {};
  const labs = data?.labs || [];
  return (
    <section className="relative overflow-hidden bg-white text-[#111827]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 92% 8%, rgba(22,163,74,0.10), transparent 40%), radial-gradient(circle at 4% 96%, rgba(255,69,0,0.07), transparent 40%)' }} />
      <div className={`${WRAP} relative`}>
        <div className="grid min-h-[calc(100svh-4rem)] items-center gap-12 py-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="lb-in inline-flex items-center gap-2 rounded-[6px] border border-[#16a34a]/30 bg-[#16a34a]/10 px-3 py-1.5 text-[11px] font-semibold text-[#15803d]">
              <span className="lb-pulse inline-block h-2 w-2 rounded-full bg-[#16a34a]" />Live places, updated automatically
            </span>
            <h1 className="lb-in2 mt-5 max-w-xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">Book a computer in the lab before you walk in.</h1>
            <p className="lb-in3 mt-5 max-w-md text-sm leading-relaxed text-black/65">See the places left in each lab for any day, then press Apply on the lab time you want. Sign in with Google and your booking is sent.</p>
            <div className="lb-in3 mt-7 flex flex-wrap items-center gap-3">
              <a href="#labs" className="inline-flex items-center rounded-[6px] bg-[#16a34a] px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90">See the labs</a>
              <Btn c="w" onClick={() => onLogin()}>Log in with Google</Btn>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl lb-in2">
            <div aria-hidden="true" className="lb-shift absolute -bottom-4 -right-4 h-full w-full rounded-[8px] bg-[#16a34a]/15" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] border border-black/10 shadow-xl">
              <LabImage ken className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <span aria-hidden="true" className="lb-scan absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
              <span className="absolute left-4 top-4 flex items-center gap-2 rounded-[6px] bg-white px-3 py-1.5 text-[11px] font-semibold">
                <span className="lb-pulse inline-block h-2 w-2 rounded-full bg-[#ff4500]" />Today
              </span>
              <div className="lb-float absolute bottom-4 left-4 rounded-[6px] bg-white px-4 py-3 shadow-lg">
                <div className="text-2xl font-extrabold leading-none text-[#16a34a]">{tot.free ?? '-'}</div>
                <div className="mt-1 text-[11px] font-medium text-black/60">places free today</div>
              </div>
              <div className="lb-float2 absolute bottom-4 right-4 rounded-[6px] bg-white px-4 py-3 shadow-lg">
                <div className="text-2xl font-extrabold leading-none text-[#ff4500]">{tot.waiting ?? '-'}</div>
                <div className="mt-1 text-[11px] font-medium text-black/60">waiting for approval</div>
              </div>
            </div>
            {labs.length > 0 && (
              <div className="mt-6 flex items-end gap-2" aria-label="Free places by lab today">
                {labs.slice(0, 6).map((l, k) => {
                  const p = l.seats ? Math.max(Math.round((l.free / l.seats) * 100), 6) : 6;
                  return (
                    <div key={l.id} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${l.name}: ${l.free} free`}>
                      <div className="flex h-14 w-full items-end overflow-hidden rounded-[3px] bg-black/5">
                        <div className="lb-grow w-full bg-[#16a34a]" style={{ height: p + '%', animationDelay: `${k * 0.1}s` }} />
                      </div>
                      <span className="w-full truncate text-center text-[10px] text-black/55">{l.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const PcGrid = ({ s }) => (
  <div className="mt-3">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
      {Array.from({ length: s.seats }, (_, i) => {
        const taken = i < s.taken;
        const waiting = !taken && i < s.taken + s.waiting;
        const look = taken ? 'border-[#111827] bg-[#111827] text-white'
          : waiting ? 'lb-pulse border-[#ff4500] bg-[#ff4500]/10 text-[#c2310a]'
            : 'border-[#16a34a]/50 bg-[#16a34a]/10 text-[#15803d]';
        return (
          <div key={i} title={`Place ${i + 1}: ${taken ? 'taken' : waiting ? 'waiting' : 'free'}`}
            className={`rounded-[4px] border px-1 py-1.5 text-center text-[10px] font-semibold ${look}`}>{i + 1}</div>
        );
      })}
    </div>
    {s.over > 0 && <p className="mt-2 text-[11px] font-bold text-[#c2310a]">{s.over} more student{s.over === 1 ? ' is' : 's are'} in the queue.</p>}
  </div>
);

const Legend3 = () => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-black/60">
    <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#16a34a]" />Free</span>
    <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#ff4500]" />Waiting for approval</span>
    <span className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#111827]" />Taken</span>
  </div>
);

function LabCard({ lab, day, past, onLogin }) {
  const [open, setOpen] = useState(null);
  return (
    <article className="group flex flex-col overflow-hidden rounded-[8px] border border-black/10 bg-white transition-shadow hover:shadow-lg">
      <div className="relative h-36 overflow-hidden">
        <LabImage className="h-full w-full transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{lab.name}</h3>
            <p className="text-[11px] text-white/85">{lab.pcs} computers</p>
          </div>
          <span className="rounded-[4px] bg-white"><Badge s={lab.status}>{STATUS_TEXT[lab.status]}</Badge></span>
        </div>
      </div>
      <div className="flex-1 p-5">
        {lab.sessions.length === 0 ? (
          <p className="rounded-[6px] bg-black/[0.03] px-3 py-6 text-center text-xs text-black/55">No lab time on this day.</p>
        ) : (
          <>
            <p className="text-xs font-medium text-black/60"><b className="text-[#16a34a]">{lab.free}</b> places free in {lab.sessions.length} lab time{lab.sessions.length === 1 ? '' : 's'}</p>
            {lab.sessions.map((s) => {
              const tp = s.seats ? (s.taken / s.seats) * 100 : 100;
              const wp = s.seats ? (s.waiting / s.seats) * 100 : 0;
              const requestedFull = s.left > 0 && s.open < 1;
              const text = s.left < 1 ? `Full, ${s.seats} of ${s.seats} taken`
                : requestedFull ? `All requested · ${s.waiting} waiting${s.over ? ` · ${s.over} in the queue` : ''}`
                  : `${s.open} of ${s.seats} free${s.waiting ? ` · ${s.waiting} waiting` : ''}`;
              const intent = { sessionId: s.id, date: day, lab: lab.name, from: s.from, to: s.to };
              return (
                <div key={s.id} className="mt-3 border-t border-black/10 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm">{s.from}–{s.to}</b>
                        {s.for && <span className="rounded-[4px] bg-[#ff4500]/10 px-2 py-0.5 text-[11px] font-semibold text-[#c2310a]">{s.exclusive ? 'Only ' : 'Reserved: '}{s.for}</span>}
                      </div>
                      <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-[3px] bg-[#16a34a]/25">
                        <div className="h-full bg-[#111827] transition-all duration-700" style={{ width: tp + '%' }} />
                        <div className="h-full bg-[#ff4500] transition-all duration-700" style={{ width: wp + '%' }} />
                      </div>
                      <div className={`mt-1 text-xs ${s.left < 1 || requestedFull ? 'font-bold text-[#c2310a]' : 'font-medium text-[#15803d]'}`}>{text}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                      <Btn c={s.exclusive ? 'w' : 'ink'} disabled={past || s.left < 1} onClick={() => onLogin(intent)}>
                        {past ? 'Past' : s.left < 1 ? 'Full' : s.exclusive ? 'Invited only' : requestedFull ? 'Join queue' : 'Apply'}
                      </Btn>
                      <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}
                        className="text-[11px] font-semibold text-[#2563eb] hover:underline">
                        {open === s.id ? 'Hide places' : 'Show places'}
                      </button>
                    </div>
                  </div>
                  {open === s.id && <PcGrid s={s} />}
                </div>
              );
            })}
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

  return (
    <div>
      <div className="rounded-[8px] border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h3 className="text-xl font-bold">{niceDay(day)}{day === today() && <span className="ml-2 align-middle"><Badge s="active">Today</Badge></span>}</h3>
          <Legend3 />
        </div>
        <div className="mt-4"><DayBar day={day} onChange={setDay} /></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
        <Dropdown value={labId} onChange={setLabId} options={[{ value: '', label: 'All labs' }, ...(data?.labs || []).map((l) => ({ value: String(l.id), label: l.name }))]} />
        <Pills value={view} onChange={setView} items={[['all', 'All labs'], ['free', 'Only with free places']]} />
      </div>
      {err && <div className="mt-4"><Alert>{err}</Alert></div>}
      <div className="mt-6">
        {loading && !err && <Loader full label="Loading the labs" />}
        {!loading && data.labs.length === 0 && <Empty>No labs have been added yet.</Empty>}
        {!loading && data.labs.length > 0 && labs.length === 0 && <Empty>No lab matches these filters.</Empty>}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {!loading && labs.map((l) => <LabCard key={l.id} lab={l} day={day} past={day < today()} onLogin={onLogin} />)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Lost & Found (public board) ---------- */

const Cover = ({ item, className = '' }) => {
  const yt = item.media.map((m) => (m.kind === 'video' ? ytId(m.src) : '')).find(Boolean);
  const src = photosOf(item)[0] || (yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : '');
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return <div role="img" aria-label={item.title} className={`grid place-items-center bg-black/[0.05] text-black/30 ${className}`}><Icon n="Tag" className="h-8 w-8" /></div>;
  }
  return <img src={src} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`object-cover ${className}`} />;
};

const LinkBtn = ({ c = 'w', className = '', ...p }) => {
  const look = { ink: 'bg-[#16a34a] text-white', bl: 'bg-[#2563eb] text-white', or: 'bg-[#ff4500] text-white', w: 'bg-white text-[#111827] border border-black/20' }[c];
  return <a target="_blank" rel="noreferrer" className={`inline-block rounded-[6px] px-4 py-2 text-xs font-semibold hover:opacity-90 ${look} ${className}`} {...p} />;
};

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
        <span className="rounded-[4px] bg-[#16a34a]/10 px-2 py-1 font-semibold text-[#15803d]">{item.category}</span>
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
                  className={`h-14 w-16 shrink-0 overflow-hidden rounded-[6px] border-2 ${i === k ? 'border-[#16a34a]' : 'border-transparent'}`}>
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
      <div className="mt-6 rounded-[8px] border border-[#16a34a]/40 bg-[#16a34a]/5 p-4">
        <h4 className="text-xs font-bold text-[#15803d]">Is this yours?</h4>
        <p className="mt-1 text-xs leading-relaxed text-black/65">Contact the Minister of Communication, describe something only the owner knows, and come to collect it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.phone && <LinkBtn c="ink" href={`tel:${item.phone}`}>Call {item.phone}</LinkBtn>}
          {digits && <LinkBtn c="bl" href={`https://wa.me/${digits}?text=${subject}`}>WhatsApp</LinkBtn>}
          {item.email && <LinkBtn c="or" href={`mailto:${item.email}?subject=${subject}`}>Email</LinkBtn>}
          {!item.phone && !item.email && <span className="text-xs text-black/60">Ask {item.postedBy || 'the Minister of Communication'} at school.</span>}
        </div>
      </div>
    </Modal>
  );
}

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
    <section id="trends" className="scroll-mt-16 border-t border-black/10 bg-[#f7f8f7]">
      <div className={`${WRAP} py-16`}>
        <h2 className="max-w-xl text-2xl font-bold tracking-tight md:text-3xl">Lost something? Look here first.</h2>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-black/60">Items found at school are posted here. Tap yours and contact the Minister of Communication.</p>
        {list.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_320px] md:items-center">
            <Pills value={cat} onChange={setCat} items={[['all', 'All', list.length], ...names.map((c) => [c, c, list.filter((t) => t.category === c).length])]} />
            <SearchBox value={q} onChange={setQ} placeholder="Search keys, bag, jacket…" />
          </div>
        )}
        <div className="mt-8">
          {items === null && <Loader full label="Loading the board" />}
          {items !== null && list.length === 0 && (
            <div className="rounded-[8px] border border-dashed border-black/20 bg-white px-6 py-14 text-center">
              <p className="text-sm font-semibold">Nothing is waiting for an owner right now.</p>
            </div>
          )}
          {list.length > 0 && shown.length === 0 && <Empty>No item matches your search.</Empty>}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpen(t)}
                className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-black/10 bg-white text-left transition-shadow hover:shadow-lg">
                <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
                  <Cover item={t} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 rounded-[4px] bg-white px-2 py-1 text-[11px] font-semibold text-[#15803d]">{t.category}</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-sm font-semibold">{t.title}</h3>
                  {t.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-black/60">{t.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-4 text-[11px] text-black/50">
                    <span>{t.foundAt ? `Found at ${t.foundAt}` : `Posted ${ago(t.postedAt)}`}</span>
                    <span className="font-semibold text-[#ff4500]">View and contact</span>
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

function Landing({ onLogin, categories }) {
  return (
    <div className="bg-white text-[#111827] antialiased text-sm">
      <Header onLogin={onLogin} />
      <Hero onLogin={onLogin} />
      <section id="labs" className={`${WRAP} scroll-mt-16 py-16`}>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Labs and free places</h2>
        <p className="mb-8 mt-2 max-w-xl text-xs leading-relaxed text-black/60">Places update on their own when someone applies. Press Apply on a lab time and sign in to book it.</p>
        <LabBoard onLogin={onLogin} />
      </section>
      <TrendsSection categories={categories} />
      <footer className="border-t border-black/10 bg-white text-xs text-black/55">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-4 py-8`}>
          <Logo />
          <span>© 2026 Computer Lab Management System</span>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 5. SIGN IN (Google only)                                            */
/* ================================================================== */

function GoogleBtn({ onResult, onError }) {
  const ref = useRef(null);
  const live = useRef({});
  live.current = { onResult, onError };
  const [ready, setReady] = useState(false);
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
      setReady(true);
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
  return (
    <div className="flex min-h-[44px] justify-center">
      {!ready && <Loader small />}
      <div ref={ref} />
    </div>
  );
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
    <div className="fixed inset-0 grid overflow-hidden bg-white text-[13px] text-[#111827] lg:grid-cols-[2fr_3fr]">
      <aside className="relative hidden h-full overflow-hidden bg-[#111827] lg:block">
        <LabImage ken className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/80" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Logo light />
          <div className="max-w-sm space-y-3">
            <span className="block h-1 w-12 rounded-full bg-[#ff4500]" />
            <h2 className="text-2xl font-bold leading-tight tracking-tight">Your place is waiting.</h2>
            <p className="text-xs leading-relaxed text-white/85">Book a computer and see the places left in real time.</p>
          </div>
        </div>
      </aside>
      <main className="flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="mx-auto my-auto w-full max-w-md px-6 py-8">
          <div className="mb-8 flex items-center justify-between">
            <button type="button" onClick={onBack} className="text-xs font-medium text-[#2563eb] hover:underline">← Back to home</button>
            <span className="lg:hidden"><Logo /></span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mb-6 mt-1.5 leading-relaxed text-black/60">Sign in with the Google account your school has on record for you.</p>
          {intent && (
            <Alert ok>You chose <b>{intent.lab}</b> on <b>{intent.date}</b> at <b>{intent.from}–{intent.to}</b>. Sign in and we send your booking for it.</Alert>
          )}
          {err && <div className="mt-4"><Alert>{err}</Alert></div>}
          {hasGoogle
            ? <GoogleBtn onResult={finish} onError={setErr} />
            : <Alert>Google sign-in is not set up yet. Add VITE_GOOGLE_CLIENT_ID to the frontend .env file.</Alert>}
          <p className="mt-8 text-center text-xs text-black/50">Account not recognised? Ask your school admin to add your email.</p>
        </div>
      </main>
      {signing && <div className="fixed inset-0 z-50 grid place-items-center bg-white/85"><Loader label="Signing you in" /></div>}
    </div>
  );
}

/* ================================================================== */
/* 6. BOOKING PAGES (students, teachers, psychosocial workers)         */
/* ================================================================== */

// Shows the class and groups the admin added this person to.
function MyClasses() {
  const [m, setM] = useState(null);
  useEffect(() => { api('/api/me/memberships').then(setM).catch(() => setM({ cls: '', groups: [] })); }, []);
  if (!m) return <Loader small />;
  if (!m.cls && !m.groups.length) return null;
  return (
    <Card t="My class and groups" sub="These were added by your school admin.">
      <div className="flex flex-wrap gap-2">
        {m.cls && <span className="rounded-[6px] bg-[#ff4500]/10 px-3 py-1.5 text-xs font-bold text-[#c2310a]">Class: {m.cls}</span>}
        {m.groups.map((g) => (
          <span key={g.id} className="rounded-[6px] border border-[#ff4500]/40 px-3 py-1.5 text-xs font-semibold text-[#c2310a]">Group: {g.name}</span>
        ))}
      </div>
    </Card>
  );
}

function Booker({ user, opts, intent, onIntentDone }) {
  const isStudent = user.role === 'student';
  const psy = user.role === 'psychosocial';
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [reason, setReason] = useState(opts.reasons?.[0] || '');
  const [day, setDay] = useState(intent?.date || today());
  const [q, setQ] = useState('');
  const [view, setView] = useState('open');
  const [focus, setFocus] = useState(intent?.sessionId || 0);
  const [msg, setMsg] = useState(null);
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [src, setSrc] = useState(psy ? 'c:' : '');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [sq, setSq] = useState('');
  const [sid, setSid] = useState('');
  const { busy, run } = useBusy();
  const ask = useConfirm();
  const sent = useRef(false);

  const loadSessions = () => api('/api/sessions').then(setSessions).catch((e) => setMsg({ ok: false, text: e.message }));
  const loadApps = () => api('/api/apps').then(setApps).catch(() => {});
  useLive({ seats: loadSessions, 'applications:update': loadApps });

  useEffect(() => {
    const jobs = [loadSessions(), loadApps()];
    if (!isStudent) jobs.push(api('/api/classes').then(setClasses).catch(() => {}), api('/api/groups').then(setGroups).catch(() => {}));
    Promise.all(jobs).finally(() => setReady(true));
  }, []);

  // Teachers and psychosocial workers: load the students of the chosen class or group.
  useEffect(() => {
    if (isStudent) return;
    setPicked([]);
    setSq('');
    const k = src.slice(0, 1), v = src.slice(2);
    if (!src || (k === 'c' && !v && !psy)) { setStudents([]); return; }
    const url = k === 'g' ? `/api/students?group=${v}` : `/api/students?class=${encodeURIComponent(v)}`;
    api(url).then(setStudents).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [src]);

  const apply = (id) => run('a' + id, async () => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: id, reason });
      setMsg(r.created
        ? { ok: true, text: 'Sent. Wait for the admin to approve your booking.' }
        : { ok: false, text: 'You already have a booking at this lab time, or one that overlaps it.' });
      await loadApps();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  });

  // A lab time chosen on the home page is booked once, right after sign-in.
  useEffect(() => {
    if (!ready || !intent || sent.current || !isStudent) return;
    sent.current = true;
    apply(intent.sessionId).finally(() => onIntentDone?.());
  }, [ready]);

  const book = () => run('book', async () => {
    try {
      const r = await api('/api/apply', 'POST', { sessionId: +sid, reason, students: picked });
      const skipped = r.skipped?.length ? ` Already booked: ${r.skipped.join(', ')}.` : '';
      setMsg({ ok: r.created > 0, text: `${r.created} booking${r.created === 1 ? '' : 's'} sent for approval.${skipped}` });
      setPicked([]);
      await loadApps();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  });

  if (!ready) return <Loader full label="Loading" />;

  const labs = sessions.filter((s) => (focus
    ? s.id === focus
    : (!day || dayOf(s) === day) && match(q, s.lab) && (view === 'all' || s.left > 0)));
  const mine = (id) => apps.find((a) => a.sid === id && a.status !== 'rejected');
  const myBookings = apps.filter((a) => a.name === user.name || a.bookedBy === user.name);
  const approved = myBookings.filter((a) => a.status === 'approved').sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`));
  const n = (k) => myBookings.filter((a) => a.status === k).length;
  const srcOpts = [
    ...(psy ? [{ value: 'c:', label: 'All students' }] : []),
    { value: '', label: 'Choose a class or group…' },
    ...classes.map((c) => ({ value: `c:${c}`, label: c })),
    ...groups.map((g) => ({ value: `g:${g.id}`, label: `Group: ${g.name}` })),
  ].filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);
  const reasonOpts = (opts.reasons || []).map((r) => ({ value: r, label: r }));
  const shownStudents = students.filter((s) => match(sq, s.name, s.email, s.className));
  const allShown = shownStudents.length > 0 && shownStudents.every((s) => picked.includes(s.name));
  const togglePick = (name) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const chosenSession = sessions.find((s) => s.id === +sid);

  return (
    <div className="space-y-6">
      {msg && <Alert ok={msg.ok}>{msg.text}</Alert>}
      <MyClasses />

      <div className="grid grid-cols-3 gap-4">
        {isStudent ? (
          <><Stat v={n('approved')} t="Approved" tone="gr" /><Stat v={n('pending')} t="Waiting" tone="or" /><Stat v={myBookings.filter((a) => a.att === 'present').length} t="Times attended" /></>
        ) : (
          <><Stat v={myBookings.length} t="Bookings sent" /><Stat v={n('approved')} t="Approved" tone="gr" /><Stat v={n('pending')} t="Waiting" tone="or" /></>
        )}
      </div>

      {isStudent ? (
        <Card t="Book a lab" sub={focus ? 'The lab time you chose' : niceDay(day || today())}
          action={focus ? <Btn c="w" onClick={() => setFocus(0)}>Show all lab times</Btn> : null}>
          {!focus && (
            <>
              <div className="mb-4"><DayBar day={day} onChange={setDay} /></div>
              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px_200px]">
                <SearchBox value={q} onChange={setQ} placeholder="Search by lab name" />
                <Dropdown value={reason} onChange={setReason} options={reasonOpts} placeholder="Reason" />
                <Pills value={view} onChange={setView} items={[['open', 'With places'], ['all', 'All']]} />
              </div>
            </>
          )}
          {labs.length === 0 && <Empty>{focus ? 'That lab time is not open for you.' : 'No lab time on this day. Try another day.'}</Empty>}
          {labs.map((s) => {
            const pct = s.seats ? ((s.seats - s.left) / s.seats) * 100 : 100;
            const m = mine(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between gap-4 border-t border-black/10 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{s.lab}</b>
                    <span className="text-black/60">{!day || focus ? `${shortDay(s.date)} · ` : ''}{s.from}–{s.to}</span>
                    {forLabel(s) && <span className="rounded-[4px] bg-[#ff4500]/10 px-2 py-0.5 text-[11px] font-semibold text-[#c2310a]">{audText(s)}</span>}
                  </div>
                  <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-[3px] bg-black/10">
                    <div className={`h-full ${s.left > 0 ? 'bg-[#16a34a]' : 'bg-[#ff4500]'}`} style={{ width: pct + '%' }} />
                  </div>
                  <div className={`mt-1.5 text-xs ${s.left > 0 ? 'font-medium text-[#15803d]' : 'font-bold text-[#c2310a]'}`}>
                    {s.left > 0 ? `${s.left} of ${s.seats} places left` : 'Full'}
                  </div>
                </div>
                {m ? <Badge s={m.status} /> : (
                  <ActBtn busy={busy === 'a' + s.id} doing="Sending…" label="Apply" disabled={s.left < 1} onClick={() => apply(s.id)} />
                )}
              </div>
            );
          })}
        </Card>
      ) : (
        <Card t="Book students" sub="Choose a class or group, then the students and the lab time.">
          <div className="grid gap-4 md:grid-cols-3">
            <Lbl l="Class or group"><Dropdown value={src} onChange={setSrc} options={srcOpts} /></Lbl>
            <Lbl l="Lab time">
              <Dropdown placeholder="Choose a lab time…" value={sid ? String(sid) : ''} onChange={setSid}
                options={sessions.filter((s) => !focus || s.id === focus).map((s) => ({ value: String(s.id), label: `${s.lab} · ${shortDay(s.date)} ${s.from}${forLabel(s) ? ` · ${audText(s)}` : ''}` }))} />
            </Lbl>
            <Lbl l="Reason"><Dropdown value={reason} onChange={setReason} options={reasonOpts} placeholder="Reason" /></Lbl>
          </div>
          {chosenSession && (
            <p className={`mt-4 text-xs font-medium ${chosenSession.left ? 'text-[#15803d]' : 'text-[#c2310a]'}`}>
              {chosenSession.left} of {chosenSession.seats} places left
            </p>
          )}
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <SearchBox value={sq} onChange={setSq} placeholder="Search students by name or email" />
            {shownStudents.length > 0 && (
              <Btn c="w" onClick={() => setPicked(allShown
                ? picked.filter((n) => !shownStudents.some((s) => s.name === n))
                : [...new Set([...picked, ...shownStudents.map((s) => s.name)])])}>
                {allShown ? 'Clear shown' : 'Select shown'}
              </Btn>
            )}
          </div>
          <p className="mt-3 text-xs text-black/50">{shownStudents.length} student{shownStudents.length === 1 ? '' : 's'} · {picked.length} selected</p>
          <div className="mt-2 divide-y divide-black/10">
            {students.length === 0 && <Empty>Choose a class or group to see its students.</Empty>}
            {students.length > 0 && shownStudents.length === 0 && <Empty>No student matches your search.</Empty>}
            {shownStudents.map((s) => (
              <label key={s.name} className="flex cursor-pointer items-center gap-3 py-2.5">
                <input type="checkbox" className="h-4 w-4 accent-[#16a34a]" checked={picked.includes(s.name)} onChange={() => togglePick(s.name)} />
                <Person p={s} className="h-8 w-8 text-[10px]" />
                <span className="ml-auto text-xs text-black/60">{s.className}</span>
              </label>
            ))}
          </div>
          <div className="mt-5">
            <ActBtn busy={busy === 'book'} doing="Sending…" label={`Book ${picked.length || ''} student${picked.length === 1 ? '' : 's'}`}
              disabled={!picked.length || !sid}
              onClick={async () => {
                if (await ask({ title: 'Send these bookings?', message: `Send ${picked.length} booking${picked.length === 1 ? '' : 's'} for approval?`, ok: 'Yes, send' })) book();
              }} />
          </div>
        </Card>
      )}

      <Card t={isStudent ? 'My applications' : 'Bookings I sent'}
        action={<Btn c="w" disabled={!approved.length} onClick={() => printTable('My lab schedule', user.name,
          ['Date', 'Time', 'Lab', 'Reason'], approved.map((a) => [a.date, `${a.from}–${a.to}`, a.lab, a.reason || '']))}>Print approved</Btn>}>
        {myBookings.length === 0 && <Empty>No booking yet.</Empty>}
        {myBookings.map((a) => (
          <Row key={a.id}>
            <span className="min-w-0"><b>{a.lab}</b> <span className="text-black/60">· {shortDay(a.date)} {a.from} · {a.reason}</span>{!isStudent && <span className="block text-xs text-black/55">{a.name}</span>}</span>
            <span className="flex items-center gap-2">{a.att && <AttBadge att={a.att} />}<Badge s={a.status} /></span>
          </Row>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 7. ADMIN: five simple tabs                                          */
/* ================================================================== */

const ADMIN_TABS = ['Overview', 'People', 'Schedule', 'Bookings', 'Settings'];
const AUD_KINDS = [
  { value: '', label: 'Everyone' },
  { value: 'class', label: 'A class' },
  { value: 'group', label: 'A group' },
  { value: 'people', label: 'Chosen people' },
];
const BLANK_AUD = { kind: '', value: '', people: [], exclusive: true };
const audFrom = (s) => {
  const ex = !!s.exclusive;
  if (s.forClass) return { kind: 'class', value: s.forClass, people: [], exclusive: ex };
  if (s.forGroup) return { kind: 'group', value: String(s.forGroup), people: [], exclusive: ex };
  if (s.forPeople) return { kind: 'people', value: '', people: s.people || [], exclusive: ex };
  return { ...BLANK_AUD };
};
const audOk = (a) => !a.kind || (a.kind === 'people' ? a.people.length > 0 : !!a.value);

function Admin({ tab }) {
  const [labs, setLabs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [black, setBlack] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [note, setNote] = useState(null);
  const { busy, run } = useBusy();
  const ask = useConfirm();

  const load = () => Promise.all([
    api('/api/labs'), api('/api/sessions'), api('/api/apps'), api('/api/blacklist'),
    api('/api/stats/overview'), api('/api/users'), api('/api/groups'), api('/api/options'),
  ])
    .then(([l, s, a, b, st, us, gr, o]) => {
      setLabs(l); setSessions(s); setApps(a); setBlack(b); setStats(st); setUsers(us); setGroups(gr);
      setOpts({ ...EMPTY_OPTS, ...o });
      setErr('');
    })
    .catch((e) => setErr(e.message))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useLive({ seats: load, 'applications:update': load });

  // Every change goes through here: one at a time, shows the result, then reloads.
  const act = (key, fn, done = '') => run(key, async () => {
    setNote(null);
    try {
      const r = await fn();
      if (done) setNote({ ok: true, text: typeof done === 'function' ? done(r) : done });
      await load();
      return true;
    } catch (e) {
      setNote({ ok: false, text: e.message });
      return false;
    }
  });
  // Styled confirm first, then the action.
  const sure = async (o, key, fn, done) => ((await ask(o)) ? act(key, fn, done) : false);

  if (loading) return <Loader full label="Loading" />;

  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      {tab === 'Overview' && <Overview stats={stats} labs={labs} sessions={sessions} />}
      {tab === 'People' && <People users={users} groups={groups} opts={opts} busy={busy} act={act} sure={sure} />}
      {tab === 'Schedule' && <Schedule labs={labs} sessions={sessions} users={users} groups={groups} busy={busy} act={act} sure={sure} />}
      {tab === 'Bookings' && <Bookings apps={apps} sessions={sessions} black={black} busy={busy} act={act} sure={sure} />}
      {tab === 'Settings' && <Settings labs={labs} opts={opts} setOpts={setOpts} busy={busy} act={act} sure={sure} />}
    </div>
  );
}

function Overview({ stats, labs, sessions }) {
  const t = stats?.totals || {};
  const rate = stats?.attendance?.rate;
  const todays = sessions.filter((s) => s.date === today() && s.published);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat v={t.approved ?? 0} t="Approved bookings" tone="gr" />
        <Stat v={t.pending ?? 0} t="Waiting for approval" tone="or" />
        <Stat v={rate == null ? '-' : `${rate}%`} t="Attendance rate" tone="gr" />
        <Stat v={labs.length} t="Labs" />
      </div>
      <Card t="Today" sub={niceDay(today())}>
        {todays.length === 0 && <Empty>No published lab time today.</Empty>}
        {todays.map((s) => (
          <Row key={s.id}>
            <span><b>{s.lab}</b> <span className="text-black/55">· {s.from}–{s.to}</span></span>
            <span className="text-xs font-semibold text-[#15803d]">{s.left} of {s.seats} places left</span>
          </Row>
        ))}
      </Card>
    </div>
  );
}

function People({ users, groups, opts, busy, act, sure }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [cls, setCls] = useState('');
  const [sel, setSel] = useState([]);
  const [target, setTarget] = useState({ grade: '', combo: '', section: '' });
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nw, setNw] = useState({ name: '', email: '', role: 'student', grade: '', combo: '', section: '' });
  const students = users.filter((u) => u.role === 'student');
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const shown = users.filter((u) => (!role || u.role === role) && (!cls || u.className === cls) && match(q, u.name, u.email, u.className));
  const shownStudents = shown.filter((u) => u.role === 'student');
  const allShown = shownStudents.length > 0 && shownStudents.every((s) => sel.includes(s.id));
  const toggle = (id) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const targetLabel = [target.grade, target.combo, target.section].filter(Boolean).join(' ');
  const n = sel.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search by name or email" />
        <Dropdown value={role} onChange={setRole} options={[{ value: '', label: 'Everyone' }, ...ROLE_CHOICES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
        <Dropdown value={cls} onChange={setCls} options={[{ value: '', label: 'All classes' }, ...classes.map((c) => ({ value: c, label: c }))]} />
        <Btn onClick={() => setAdding(true)}>+ Add person</Btn>
      </div>

      {n > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-end gap-3 rounded-[8px] border border-[#ff4500]/40 bg-white p-4 shadow-lg">
          <span className="mr-auto self-center text-xs font-bold text-[#c2310a]">{n} selected</span>
          <div className="w-full sm:w-[420px]"><ClassPick opts={opts} grade={target.grade} combo={target.combo} section={target.section} onChange={setTarget} /></div>
          <Btn c="w" onClick={() => setSel([])}>Clear</Btn>
          <ActBtn c="or" busy={busy === 'move'} doing="Moving…" label={`Move ${n} to this class`} disabled={!target.grade}
            onClick={async () => {
              if (await sure({ title: 'Move students?', message: `Move ${n} student${n === 1 ? '' : 's'} to ${targetLabel}?`, ok: 'Yes, move them' }, 'move',
                () => api('/api/students/class', 'PATCH', { ids: sel, ...target }), `${n} students moved to ${targetLabel}.`)) setSel([]);
            }} />
        </div>
      )}

      <Card t={`People (${shown.length})`}
        action={shownStudents.length > 0 && <Btn c="w" onClick={() => setSel(allShown ? [] : shownStudents.map((s) => s.id))}>{allShown ? 'Unselect shown' : 'Select students shown'}</Btn>}>
        {shown.length === 0 && <Empty>No one matches. Change the search or filters.</Empty>}
        {shown.slice(0, 60).map((u) => (
          <Row key={u.id}>
            <span className="flex min-w-0 items-center gap-3">
              {u.role === 'student' && <input type="checkbox" aria-label={`Select ${u.name}`} className="h-4 w-4 accent-[#ff4500]" checked={sel.includes(u.id)} onChange={() => toggle(u.id)} />}
              <Person p={u} />
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold">{u.role === 'student' ? (u.className || 'No class') : ROLE_LABEL[u.role]}</span>
              <Btn c="w" onClick={() => setEdit({ ...u, section: u.section || '', combo: u.combo || '' })}>Edit</Btn>
              <Btn c="or" onClick={() => sure({ message: `Delete the account of ${u.name}? This cannot be undone.`, ok: 'Delete', danger: true }, 'del' + u.id,
                () => api(`/api/users/${u.id}`, 'DELETE'), `${u.name} was deleted.`)}>Delete</Btn>
            </span>
          </Row>
        ))}
        {shown.length > 60 && <p className="pt-3 text-center text-xs text-black/50">Showing 60 of {shown.length}. Search to narrow the list.</p>}
      </Card>

      <Card t="Groups" sub="A group can mix students from any class. Lab times can be given to a whole group.">
        <NewGroup students={students} busy={busy} act={act} />
        {groups.map((g) => <GroupRow key={g.id} g={g} students={students} busy={busy} act={act} sure={sure} />)}
        {groups.length === 0 && <Empty>No groups yet.</Empty>}
      </Card>

      {adding && (
        <Modal title="Add a person" onClose={() => setAdding(false)}>
          <div className="space-y-4">
            <Lbl l="Role"><Dropdown value={nw.role} onChange={(v) => setNw({ ...nw, role: v })} options={ROLE_CHOICES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></Lbl>
            <Field l="Full name"><Inp value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} placeholder="Aline Mukamana" /></Field>
            <Field l="Google email"><Inp type="email" value={nw.email} onChange={(e) => setNw({ ...nw, email: e.target.value })} placeholder="aline@gmail.com" /></Field>
            {nw.role === 'student' && <ClassPick opts={opts} grade={nw.grade} combo={nw.combo} section={nw.section} onChange={(c) => setNw({ ...nw, ...c })} />}
            <div className="flex gap-2 pt-2">
              <ActBtn busy={busy === 'add'} doing="Adding…" label="Add account" disabled={!nw.name.trim() || !nw.email.trim() || (nw.role === 'student' && !nw.grade)}
                onClick={async () => {
                  if (await act('add', () => api('/api/users', 'POST', { name: nw.name, email: nw.email, role: nw.role,
                    ...(nw.role === 'student' && { grade: nw.grade, combo: nw.combo, section: nw.section }) }),
                  `${nw.name} can now sign in with Google.`)) { setAdding(false); setNw({ name: '', email: '', role: 'student', grade: '', combo: '', section: '' }); }
                }} />
              <Btn c="w" onClick={() => setAdding(false)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}

      {edit && (
        <Modal title={`Edit ${edit.name}`} onClose={() => setEdit(null)}>
          <div className="space-y-4">
            <Field l="Full name"><Inp value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field l="Google email"><Inp type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            {edit.role === 'student' && <ClassPick opts={opts} grade={edit.grade} combo={edit.combo} section={edit.section} onChange={(c) => setEdit({ ...edit, ...c })} />}
            <div className="flex gap-2 pt-2">
              <ActBtn busy={busy === 'edit'} doing="Saving…" label="Save changes"
                onClick={async () => {
                  if (await act('edit', () => api(`/api/users/${edit.id}`, 'PUT', { name: edit.name, email: edit.email,
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

function NewGroup({ students, busy, act }) {
  const [name, setName] = useState('');
  const [mem, setMem] = useState([]);
  return (
    <div className="mb-5 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
      <Inp value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, for example Isomo circle" />
      <div className="mt-3"><PeoplePicker students={students} value={mem} onChange={setMem} /></div>
      <ActBtn className="mt-3" busy={busy === 'group'} doing="Creating…" label="Create group" disabled={!name.trim()}
        onClick={async () => {
          if (await act('group', () => api('/api/groups', 'POST', { name, members: mem }),
            (r) => `Group created. ${r.added} student${r.added === 1 ? '' : 's'} added.`)) { setName(''); setMem([]); }
        }} />
    </div>
  );
}

function GroupRow({ g, students, busy, act, sure }) {
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState([]);
  const members = g.members || [];
  return (
    <div className="border-t border-black/10 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-left">
          <b className="text-sm">{g.name}</b> <span className="text-xs text-black/55">· {members.length} student{members.length === 1 ? '' : 's'}</span>
        </button>
        <span className="flex gap-2">
          <Btn c="w" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Manage'}</Btn>
          <Btn c="or" onClick={() => sure({ message: `Delete the group ${g.name}? The students keep their accounts.`, ok: 'Delete group', danger: true },
            'gdel' + g.id, () => api(`/api/groups/${g.id}`, 'DELETE'), 'Group deleted.')}>Delete</Btn>
        </span>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {members.length === 0 && <span className="text-xs text-black/50">No students yet.</span>}
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff4500]/10 py-1 pl-2 pr-1.5 text-xs font-medium text-[#c2310a]">
                {m.name}<span className="text-black/50">· {m.className}</span>
                <button type="button" aria-label={`Remove ${m.name}`} onClick={() => act('rm' + m.id, () => api(`/api/groups/${g.id}/members/${m.id}`, 'DELETE'))}
                  className="px-1 text-sm leading-none text-[#ff4500]">×</button>
              </span>
            ))}
          </div>
          <PeoplePicker students={students.filter((s) => !members.some((m) => m.id === s.id))} value={add} onChange={setAdd} />
          <ActBtn busy={busy === 'gadd' + g.id} doing="Adding…" label="Add to group" disabled={!add.length}
            onClick={async () => {
              if (await act('gadd' + g.id, () => api(`/api/groups/${g.id}/members`, 'POST', { members: add }),
                (r) => `${r.added} added.${r.notFound?.length ? ` Not found: ${r.notFound.join(', ')}` : ''}`)) setAdd([]);
            }} />
        </div>
      )}
    </div>
  );
}

function Schedule({ labs, sessions, users, groups, busy, act, sure }) {
  const students = users.filter((u) => u.role === 'student');
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const [f, setF] = useState({ date: today(), from: '14:00', to: '16:00', labId: '', places: '' });
  const [aud, setAud] = useState({ ...BLANK_AUD });
  const [week, setWeek] = useState(weekStart(today()));
  const [view, setView] = useState('all');
  const [who, setWho] = useState(null);
  const needOne = !!aud.kind && !f.labId;
  const list = sessions
    .filter((s) => inWeek(s.date, week) && (view === 'all' || (view === 'draft' ? !s.published : s.published)))
    .sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`));

  const create = (published) => act(published ? 'pub' : 'draft', async () => {
    const r = await api('/api/sessions', 'POST', {
      date: f.date, from: f.from, to: f.to, published, audience: aud,
      labIds: f.labId ? [+f.labId] : undefined, places: f.places === '' ? undefined : +f.places,
    });
    setAud({ ...BLANK_AUD });
    setWeek(weekStart(f.date));
    return r;
  }, (r) => `${r.created} lab time${r.created === 1 ? '' : 's'} saved as ${published ? 'published' : 'a draft'}.${r.assigned ? ` ${r.assigned} student${r.assigned === 1 ? '' : 's'} booked automatically.` : ''}`);

  return (
    <div className="space-y-6">
      <Card t="New lab time" sub="Save as a draft (only you see it) or publish it now.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field l="Day"><Inp type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field l="From"><Inp type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field l="To"><Inp type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Lbl l="Lab">
            <Dropdown value={f.labId} onChange={(v) => setF({ ...f, labId: v })}
              options={[{ value: '', label: 'All labs' }, ...labs.map((l) => ({ value: String(l.id), label: l.name }))]} />
          </Lbl>
          <Field l="Places open" hint="Leave empty for every computer."><Inp type="number" min="1" value={f.places} onChange={(e) => setF({ ...f, places: e.target.value })} /></Field>
        </div>
        <div className="mt-6 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
          <AudienceEditor value={aud} onChange={setAud} classes={classes} groups={groups} students={students} />
          {needOne && <p className="mt-3 text-xs font-semibold text-[#c2310a]">Choose one lab above to assign a class, a group or people.</p>}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ActBtn c="w" busy={busy === 'draft'} doing="Saving…" label="Save as draft" disabled={!audOk(aud) || needOne} onClick={() => create(false)} />
          <ActBtn busy={busy === 'pub'} doing="Publishing…" label="Publish now" disabled={!audOk(aud) || needOne} onClick={() => create(true)} />
        </div>
      </Card>

      <Card t="Lab times" action={(
        <div className="w-44">
          <Dropdown value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'draft', label: 'Drafts only' }, { value: 'live', label: 'Published only' }]} />
        </div>
      )}>
        <div className="mb-5"><WeekBar week={week} onChange={setWeek} /></div>
        {list.length === 0 && <Empty>No lab time this week.</Empty>}
        {list.map((s) => (
          <Row key={s.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge s={s.published ? 'published' : 'draft'} />
                <b>{s.lab} · {shortDay(s.date)} · {s.from}–{s.to}</b>
              </div>
              <p className="mt-1 text-xs text-black/55">
                {s.left} of {s.seats} places left · {forLabel(s) ? <span className="font-semibold text-[#c2310a]">{audText(s)}</span> : 'Open to everyone'}
              </p>
            </div>
            <span className="flex flex-wrap gap-2">
              <Btn c="w" onClick={() => setWho({ s, aud: audFrom(s) })}>Who can book</Btn>
              <ActBtn c={s.published ? 'w' : 'ink'} busy={busy === 'p' + s.id} doing="…" label={s.published ? 'Hide' : 'Publish'}
                onClick={() => act('p' + s.id, () => api(`/api/sessions/${s.id}/publish`, 'PATCH', { published: !s.published }),
                  s.published ? 'Hidden from students.' : 'Published. Students can see it now.')} />
              <Btn c="or" onClick={() => sure({ message: 'Remove this lab time? Its bookings will be removed too.', ok: 'Remove', danger: true },
                'x' + s.id, () => api(`/api/sessions/${s.id}`, 'DELETE'), 'Lab time removed.')}>Remove</Btn>
            </span>
          </Row>
        ))}
      </Card>

      {who && (
        <Modal title={`Who can book ${who.s.lab} · ${shortDay(who.s.date)} ${who.s.from}`} onClose={() => setWho(null)} wide>
          <AudienceEditor value={who.aud} onChange={(a) => setWho({ ...who, aud: a })} classes={classes} groups={groups} students={students} />
          <p className="mt-4 text-xs text-black/55">Saving books the chosen students automatically.</p>
          <div className="mt-5 flex gap-2">
            <ActBtn busy={busy === 'who'} doing="Saving…" label="Save" disabled={!audOk(who.aud)}
              onClick={async () => {
                if (await act('who', async () => { await api(`/api/sessions/${who.s.id}`, 'PUT', { audience: who.aud }); setWho(null); }, 'Saved. Bookings were updated.')) return;
              }} />
            <Btn c="w" onClick={() => setWho(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AudienceEditor({ value, onChange, classes, groups, students }) {
  const set = (p) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <Lbl l="Who is this lab time for?">
        <Dropdown options={AUD_KINDS} value={value.kind} onChange={(kind) => set({ kind, value: '', people: [] })} />
      </Lbl>
      {value.kind === 'class' && (
        <Lbl l="Class"><Dropdown placeholder="Choose a class…" value={value.value} onChange={(v) => set({ value: v })}
          options={classes.map((c) => ({ value: c, label: c }))} /></Lbl>
      )}
      {value.kind === 'group' && (
        <Lbl l="Group"><Dropdown placeholder="Choose a group…" value={value.value} onChange={(v) => set({ value: v })}
          options={groups.map((g) => ({ value: String(g.id), label: `${g.name} (${g.members?.length ?? g.count ?? 0})` }))} /></Lbl>
      )}
      {value.kind === 'people' && (
        <Lbl l="Students"><PeoplePicker students={students} value={value.people} onChange={(people) => set({ people })} /></Lbl>
      )}
      {value.kind && (
        <Lbl l="The other places">
          <Dropdown value={String(value.exclusive)} onChange={(v) => set({ exclusive: v === 'true' })}
            options={[{ value: 'true', label: 'Only they can join' }, { value: 'false', label: 'They get places, the rest stay open' }]} />
        </Lbl>
      )}
    </div>
  );
}

function Bookings({ apps, sessions, black, busy, act, sure }) {
  const [week, setWeek] = useState(weekStart(today()));
  const [status, setStatus] = useState('pending');
  const [sid, setSid] = useState('');
  const [q, setQ] = useState('');
  const lessons = sessions.filter((s) => s.published && inWeek(s.date, week));
  const base = apps.filter((a) => inWeek(a.date, week) && (!sid || String(a.sid) === sid) && match(q, a.name, a.email, a.cls, a.reason));
  const shown = base.filter((a) => status === 'all' || a.status === status);
  const count = (k) => base.filter((a) => k === 'all' || a.status === k).length;
  const waiting = shown.filter((a) => a.status === 'pending');
  const approvedShown = base.filter((a) => a.status === 'approved');

  const approveAll = () => sure({ title: 'Approve all shown?', message: `Approve ${waiting.length} waiting student${waiting.length === 1 ? '' : 's'}? Only free places are filled.`, ok: 'Yes, approve' },
    'bulk', async () => {
      let failed = 0;
      for (const a of waiting) { try { await api(`/api/apps/${a.id}/status`, 'PATCH', { status: 'approved' }); } catch { failed++; } }
      if (failed) throw new Error(`${waiting.length - failed} approved. ${failed} could not be approved because the lab time is full.`);
    }, `${waiting.length} student${waiting.length === 1 ? '' : 's'} approved.`);

  return (
    <div className="space-y-6">
      <Card t="Bookings" sub="Approve students, then mark who came to the lab.">
        <div className="mb-4"><WeekBar week={week} onChange={(w) => { setWeek(w); setSid(''); }} /></div>
        <div className="grid gap-3 md:grid-cols-3">
          <SearchBox value={q} onChange={setQ} placeholder="Search a student" />
          <Dropdown value={sid} onChange={setSid} options={[{ value: '', label: 'All lab times' }, ...lessons.map((s) => ({ value: String(s.id), label: `${s.lab} · ${shortDay(s.date)} ${s.from}` }))]} />
          <Dropdown value={status} onChange={setStatus} options={[
            { value: 'pending', label: `Waiting (${count('pending')})` },
            { value: 'approved', label: `Approved (${count('approved')})` },
            { value: 'rejected', label: `Rejected (${count('rejected')})` },
            { value: 'all', label: `All (${count('all')})` },
          ]} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {waiting.length > 0 && <ActBtn busy={busy === 'bulk'} doing="Approving…" label={`Approve all shown (${waiting.length})`} onClick={approveAll} />}
          <Btn c="w" disabled={!approvedShown.length} onClick={() => printTable('Approved students', `${approvedShown.length} students`,
            ['Student', 'Class', 'Lab', 'Date', 'Time'], approvedShown.map((a) => [a.name, a.cls || '', a.lab, a.date, `${a.from}–${a.to}`]))}>Print approved</Btn>
        </div>
      </Card>

      <Card>
        {shown.length === 0 && <Empty>No booking matches these filters.</Empty>}
        {shown.map((a) => (
          <Row key={a.id}>
            <Person p={a} sub={`${a.lab} · ${shortDay(a.date)} ${a.from} · ${a.reason}`} />
            <span className="flex flex-wrap items-center gap-2">
              <Badge s={a.status} />
              {a.status === 'approved' && (
                <>
                  <Btn c={a.att === 'present' ? 'ink' : 'w'} onClick={() => act('att' + a.id, () => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att: a.att === 'present' ? null : 'present' }))}>Present</Btn>
                  <Btn c={a.att === 'absent' ? 'or' : 'w'} onClick={() => act('att' + a.id, () => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att: a.att === 'absent' ? null : 'absent' }))}>Absent</Btn>
                </>
              )}
              {a.status !== 'approved' && (
                <ActBtn busy={busy === 'a' + a.id} doing="…" label="Approve" onClick={() => act('a' + a.id, () => api(`/api/apps/${a.id}/status`, 'PATCH', { status: 'approved' }), 'Approved.')} />
              )}
              {a.status === 'pending' && (
                <Btn c="w" onClick={() => sure({ message: `Reject ${a.name}'s booking?`, ok: 'Reject', danger: true }, 'r' + a.id,
                  () => api(`/api/apps/${a.id}/status`, 'PATCH', { status: 'rejected' }), 'Booking rejected.')}>Reject</Btn>
              )}
              <Btn c="dk" onClick={() => sure({ message: `Block ${a.name}? Their waiting bookings are rejected and they cannot book until unblocked.`, ok: 'Block', danger: true }, 'b' + a.id,
                () => api('/api/blacklist', 'POST', { name: a.name }), `${a.name} is blocked.`)}>Block</Btn>
            </span>
          </Row>
        ))}
      </Card>

      {black.length > 0 && (
        <Card t="Blocked students">
          <div className="flex flex-wrap gap-2">
            {black.map((n) => (
              <span key={n} className="inline-flex items-center gap-2 rounded-[6px] border border-[#111827] px-3 py-1.5 text-xs font-medium">
                {n}
                <button type="button" aria-label={`Unblock ${n}`} className="text-[#ff4500]" onClick={() => act('u' + n, () => api(`/api/blacklist/${encodeURIComponent(n)}`, 'DELETE'), `${n} is unblocked.`)}>×</button>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Settings({ labs, opts, setOpts, busy, act, sure }) {
  const grades = gradesOf(opts);
  const full = Object.fromEntries(grades.map((g) => [g, combosFor(opts, g)]));
  const [newGrade, setNewGrade] = useState('');
  const [newLab, setNewLab] = useState({ name: '', pcs: 10 });
  const clean = (s) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  const putOpts = (body) => api('/api/options', 'PUT', body).then((o) => setOpts({ ...EMPTY_OPTS, ...o }));
  const saveOpts = (body, done) => act('opts', () => putOpts(body), done);

  return (
    <div className="space-y-6">
      <Card t="Labs" sub="How many computers each room has.">
        <div className="mb-5 flex flex-wrap gap-3">
          <Inp className="!w-56" placeholder="Lab name" value={newLab.name} onChange={(e) => setNewLab({ ...newLab, name: e.target.value })} />
          <Inp type="number" min="1" className="!w-28" value={newLab.pcs} onChange={(e) => setNewLab({ ...newLab, pcs: e.target.value })} />
          <ActBtn busy={busy === 'lab'} doing="Adding…" label="Add lab" disabled={!newLab.name.trim()}
            onClick={async () => { if (await act('lab', () => api('/api/labs', 'POST', newLab), 'Lab added.')) setNewLab({ name: '', pcs: 10 }); }} />
        </div>
        {labs.map((l) => <LabRow key={l.id} l={l} busy={busy} act={act} sure={sure} />)}
        {labs.length === 0 && <Empty>No labs yet.</Empty>}
      </Card>

      <Card t="Classes" sub="A class is a grade plus a combination, for example S4 INGABE.">
        <div className="mb-5 flex max-w-md gap-2">
          <Inp placeholder="New grade, for example S3" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} />
          <ActBtn busy={busy === 'opts'} doing="Adding…" label="Add grade" className="shrink-0"
            disabled={!clean(newGrade) || grades.includes(clean(newGrade))}
            onClick={async () => { const g = clean(newGrade); if (await saveOpts({ grades: [...grades, g], gradeCombos: { ...full, [g]: [] } }, `${g} added.`)) setNewGrade(''); }} />
        </div>
        {grades.map((g) => (
          <div key={g} className="border-t border-black/10 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-[6px] bg-[#16a34a] px-3 py-1.5 text-xs font-bold text-white">{g}</span>
              <Btn c="or" onClick={() => {
                const rest = { ...full };
                delete rest[g];
                sure({ message: `Remove grade ${g}? Students in ${g} keep their class.`, ok: 'Remove', danger: true }, 'opts',
                  () => putOpts({ grades: grades.filter((x) => x !== g), gradeCombos: rest }), 'Grade removed.');
              }}>Remove grade</Btn>
            </div>
            <div className="mt-3">
              <ChipList items={full[g]} placeholder={`Add a combination to ${g}`} busy={busy === 'opts'}
                onAdd={(c) => saveOpts({ grades, gradeCombos: { ...full, [g]: [...full[g], clean(c)] } }, 'Combination added.')}
                onRemove={(c) => sure({ message: `Remove ${c} from ${g}?`, ok: 'Remove', danger: true }, 'opts',
                  () => putOpts({ grades, gradeCombos: { ...full, [g]: full[g].filter((x) => x !== c) } }), 'Removed.')} />
            </div>
          </div>
        ))}
      </Card>

      <Card t="Booking reasons" sub="Students pick one of these when they book.">
        <ChipList items={opts.reasons || []} placeholder="Add a reason" busy={busy === 'opts'}
          onAdd={(x) => saveOpts({ reasons: [...(opts.reasons || []), x] }, 'Reason added.')}
          onRemove={(x) => sure({ message: `Remove "${x}"?`, ok: 'Remove', danger: true }, 'opts',
            () => putOpts({ reasons: (opts.reasons || []).filter((r) => r !== x) }), 'Removed.')} />
      </Card>
    </div>
  );
}

function LabRow({ l, busy, act, sure }) {
  const [pcs, setPcs] = useState(l.pcs);
  return (
    <Row>
      <b>{l.name}</b>
      <span className="flex flex-wrap items-center gap-2">
        <Inp type="number" min="1" className="!w-24" value={pcs} onChange={(e) => setPcs(e.target.value)} />
        <span className="text-xs text-black/55">computers</span>
        <ActBtn busy={busy === 'lab' + l.id} doing="Saving…" label="Save" disabled={+pcs === l.pcs || !(+pcs >= 1)}
          onClick={() => act('lab' + l.id, () => api(`/api/labs/${l.id}`, 'PUT', { pcs: +pcs }), 'Saved.')} />
        <Btn c="or" onClick={() => sure({ message: `Delete ${l.name}? Its lab times and bookings will be removed.`, ok: 'Delete lab', danger: true },
          'ld' + l.id, () => api(`/api/labs/${l.id}`, 'DELETE'), 'Lab deleted.')}>Delete</Btn>
      </span>
    </Row>
  );
}

/* ================================================================== */
/* 8. LOST & FOUND MANAGER (Minister of Communication)                 */
/* ================================================================== */

function TrendForm({ initial, cats, user, onSubmit, onCancel }) {
  const editing = !!initial;
  const [f, setF] = useState({
    title: initial?.title || '', category: initial?.category || cats[0] || 'Other', foundAt: initial?.foundAt || '',
    description: initial?.description || '', phone: initial?.phone || '', email: initial ? initial.email : user.email || '',
  });
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [li, setLi] = useState('');
  const [err, setErr] = useState('');
  const { busy, run } = useBusy();
  const up = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const catOpts = [...new Set([...cats, f.category])].map((c) => ({ value: c, label: c }));

  const pick = (e) => run('pick', async () => {
    const list = [...e.target.files];
    e.target.value = '';
    if (!list.length) return;
    if (files.length + list.length > MAX_ATTACH) { setErr(`You can add up to ${MAX_ATTACH} files.`); return; }
    setErr('');
    try {
      for (const file of list) {
        if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is bigger than 12 MB. For long videos, paste a link instead.`);
        const prepared = await prepFile(file);
        setFiles((p) => (p.length >= MAX_ATTACH ? p : [...p, prepared]));
      }
    } catch (x) { setErr(x.message); }
  });
  const addLink = () => {
    const v = li.trim();
    if (!v) return;
    if (!/^https?:\/\/\S+$/i.test(v)) { setErr('A link must start with http:// or https://'); return; }
    setErr('');
    setLinks((p) => (p.includes(v) ? p : [...p, v]));
    setLi('');
  };
  const submit = () => run('submit', async () => {
    setErr('');
    try {
      await onSubmit({ ...f, files: files.map(({ name, mime, data }) => ({ name, mime, data })), links: li.trim() ? [...links, li.trim()] : links });
    } catch (x) { setErr(x.message); }
  });

  return (
    <div>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field l="What was found?"><Inp value={f.title} onChange={up('title')} maxLength={140} placeholder="Black jacket with a red zip" /></Field>
        <Lbl l="Category"><Dropdown value={f.category} onChange={(v) => setF({ ...f, category: v })} options={catOpts} /></Lbl>
        <Field l="Where was it found?" hint="Optional."><Inp value={f.foundAt} onChange={up('foundAt')} placeholder="Near Lab 1, dining hall…" /></Field>
        <Field l="Phone or WhatsApp" hint="Optional."><Inp value={f.phone} onChange={up('phone')} placeholder="+250 7xx xxx xxx" /></Field>
        <Field l="Contact email" hint="Optional."><Inp type="email" value={f.email} onChange={up('email')} placeholder="you@gmail.com" /></Field>
        <div className="md:col-span-2">
          <Field l="Details" hint="Colour, brand, size. Keep one detail back so the real owner can prove it.">
            <textarea rows={4} value={f.description} onChange={up('description')} maxLength={4000} className={FIELD} />
          </Field>
        </div>
      </div>

      {!editing && (
        <div className="mt-6 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
          <h4 className="text-xs font-bold">Photos, videos and files</h4>
          <p className="mt-1 text-xs text-black/55">Up to {MAX_ATTACH} files of 12 MB. For long videos paste a link.</p>
          <label className={`mt-3 inline-block cursor-pointer rounded-[6px] border border-black/20 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/5 ${busy === 'pick' ? 'opacity-50' : ''}`}>
            {busy === 'pick' ? 'Preparing…' : 'Choose files'}
            <input type="file" multiple className="sr-only" onChange={pick} disabled={busy === 'pick'}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
          </label>
          {files.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {files.map((x, i) => (
                <li key={x.name + i} className="flex items-center gap-3 rounded-[6px] border border-black/10 bg-white p-2 text-xs">
                  {x.mime.startsWith('image/')
                    ? <img src={`data:${x.mime};base64,${x.data}`} alt="" className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />
                    : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] bg-black/5 text-[10px] font-bold uppercase text-black/60">{x.mime.startsWith('video/') ? 'Video' : 'File'}</span>}
                  <span className="min-w-0 flex-1"><b className="block truncate">{x.name}</b><span className="text-black/50">{niceSize(x.size)}</span></span>
                  <button type="button" aria-label={`Remove ${x.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="px-1 text-lg leading-none text-[#ff4500]">×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <Inp value={li} onChange={(e) => setLi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} placeholder="Paste a photo or video link" />
            <Btn c="w" className="shrink-0" onClick={addLink}>Add link</Btn>
          </div>
          {links.length > 0 && (
            <ul className="mt-3 space-y-2">
              {links.map((l) => (
                <li key={l} className="flex items-center gap-3 rounded-[6px] border border-black/10 bg-white px-3 py-2 text-xs">
                  {(IMG_LINK.test(directImg(l)) || directImg(l) !== l) && <img src={directImg(l)} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />}
                  <span className="min-w-0 flex-1 truncate">{l}</span>
                  <button type="button" aria-label="Remove link" onClick={() => setLinks((p) => p.filter((x) => x !== l))} className="text-lg leading-none text-[#ff4500]">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <ActBtn busy={busy === 'submit'} doing={editing ? 'Saving…' : 'Posting…'} label={editing ? 'Save changes' : 'Post item'} disabled={!f.title.trim() || busy === 'pick'} onClick={submit} />
        <Btn c="w" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

function TrendsManager({ user, opts }) {
  const [cats, setCats] = useState(catsOf(opts));
  const [items, setItems] = useState(null);
  const [note, setNote] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);
  const [view, setView] = useState('active');
  const [cf, setCf] = useState('');
  const [q, setQ] = useState('');
  const { busy, run } = useBusy();
  const ask = useConfirm();

  const load = () => api('/api/trends/manage').then(setItems).catch((e) => setNote({ ok: false, text: e.message }));
  useEffect(() => { load(); api('/api/options').then((o) => setCats(catsOf(o))).catch(() => {}); }, []);
  useLive({ 'trends:update': load });

  // Runs one change, shows the result, then reloads the list.
  const act = (key, fn, done = '') => run(key, async () => {
    setNote(null);
    try { await fn(); setNote({ ok: true, text: done }); }
    catch (e) { setNote({ ok: false, text: e.message }); }
    await load();
  });
  const sure = async (o, key, fn, done) => ((await ask(o)) ? act(key, fn, done) : undefined);

  const list = items || [];
  const n = (s) => list.filter((t) => t.status === s).length;
  const shown = list.filter((t) => (view === 'all' || t.status === view) && (!cf || t.category === cf) && match(q, t.title, t.category, t.description, t.foundAt));
  const usedCats = [...new Set(list.map((t) => t.category))].sort();

  if (items === null) return <Loader full label="Loading" />;

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat v={n('active')} t="On the board" tone="gr" />
        <Stat v={list.filter((t) => t.status === 'active' && t.daysLeft === 0).length} t="Ready to remove" tone="or" />
        <Stat v={n('returned')} t="Returned to owners" />
        <Stat v={n('removed')} t="Removed" />
      </div>

      <Card t="Post a found item" sub="A post can be removed 7 days after it was posted, and reposted later."
        action={!formOpen && <Btn onClick={() => setFormOpen(true)}>+ New post</Btn>}>
        {formOpen
          ? <TrendForm cats={cats} user={user} onSubmit={async (body) => { await api('/api/trends', 'POST', body); setFormOpen(false); setNote({ ok: true, text: 'Posted. Everyone can see it on the home page.' }); await load(); }} onCancel={() => setFormOpen(false)} />
          : <p className="text-xs text-black/55">Add a photo, a category and a way to contact you.</p>}
      </Card>

      <Card t="All posts" action={<Pills value={view} onChange={setView} items={[['active', 'On the board', n('active')], ['returned', 'Returned', n('returned')], ['removed', 'Removed', n('removed')], ['all', 'All', list.length]]} />}>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <SearchBox value={q} onChange={setQ} placeholder="Search by title, category or place" />
          <Dropdown value={cf} onChange={setCf} options={[{ value: '', label: 'All categories' }, ...usedCats.map((c) => ({ value: c, label: c }))]} />
        </div>
        {shown.length === 0 && <Empty>{list.length ? 'No post matches.' : 'Nothing posted yet.'}</Empty>}
        {shown.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-4 border-t border-black/10 py-4">
            <button type="button" aria-label={`Open ${t.title}`} onClick={() => setDetail(t)} className="h-16 w-20 shrink-0 overflow-hidden rounded-[6px] bg-black/5">
              <Cover item={t} className="h-full w-full" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <b className="truncate">{t.title}</b>
                <Badge s={t.status} />
                <span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-black/70">{t.category}</span>
              </div>
              <p className="mt-1 text-xs text-black/55">Posted {ago(t.postedAt)}{t.reposts ? ` · reposted ${t.reposts} time${t.reposts === 1 ? '' : 's'}` : ''}</p>
              {t.status === 'active' && (
                <p className={`mt-1 text-xs font-medium ${t.daysLeft ? 'text-[#c2310a]' : 'text-[#15803d]'}`}>
                  {t.daysLeft ? `Can be removed in ${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'}` : 'Ready to remove or repost'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn c="w" onClick={() => setDetail(t)}>View</Btn>
              <Btn c="w" onClick={() => setEdit(t)}>Edit</Btn>
              {t.status === 'active' ? (
                <>
                  <Btn c="bl" onClick={() => sure({ message: 'Mark this item as returned to its owner?', ok: 'Yes, returned' }, 'ret' + t.id,
                    () => api(`/api/trends/${t.id}/returned`, 'PATCH'), 'Marked as returned.')}>Returned</Btn>
                  <Btn c="or" disabled={t.daysLeft > 0 || busy === 'rm' + t.id} title={t.daysLeft > 0 ? `Available in ${t.daysLeft} day(s)` : ''}
                    onClick={() => sure({ message: 'Take this post off the board? You can repost it later.', ok: 'Remove', danger: true }, 'rm' + t.id,
                      () => api(`/api/trends/${t.id}/remove`, 'PATCH'), 'Removed from the board.')}>Remove</Btn>
                </>
              ) : (
                <>
                  <Btn disabled={busy === 'rp' + t.id} onClick={() => act('rp' + t.id, () => api(`/api/trends/${t.id}/repost`, 'PATCH'), 'Reposted. It is back on the home page.')}>Repost</Btn>
                  <Btn c="or" onClick={() => sure({ message: 'Delete this post and its files for good?', ok: 'Delete', danger: true }, 'del' + t.id,
                    () => api(`/api/trends/${t.id}`, 'DELETE'), 'Deleted.')}>Delete</Btn>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Card t="Categories" sub="Pick one for every post. Visitors filter the board by them.">
        <ChipList items={cats} placeholder="Add a category" busy={busy === 'cat'}
          onAdd={async (x) => {
            let ok = false;
            await run('cat', async () => {
              try { const r = await api('/api/trends/categories', 'PUT', { list: [...cats, x] }); setCats(r.list); setNote({ ok: true, text: 'Category added.' }); ok = true; }
              catch (e) { setNote({ ok: false, text: e.message }); }
            });
            return ok;
          }}
          onRemove={(x) => sure({ message: `Remove the category "${x}"? Posts keep their category.`, ok: 'Remove', danger: true }, 'cat',
            async () => { const r = await api('/api/trends/categories', 'PUT', { list: cats.filter((c) => c !== x) }); setCats(r.list); }, 'Category removed.')} />
      </Card>

      {detail && <TrendDetail item={detail} onClose={() => setDetail(null)} />}
      {edit && (
        <Modal title="Edit post" onClose={() => setEdit(null)} wide>
          <TrendForm initial={edit} cats={cats} user={user}
            onSubmit={async (body) => { await api(`/api/trends/${edit.id}`, 'PUT', body); setEdit(null); setNote({ ok: true, text: 'Changes saved.' }); await load(); }}
            onCancel={() => setEdit(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ================================================================== */
/* 9. PROFILE (editable)                                               */
/* ================================================================== */

function ProfileForm({ p, onSaved }) {
  const [pic, setPic] = useState(p.picture || '');
  const [phone, setPhone] = useState(p.phone || '');
  const [note, setNote] = useState(null);
  const { busy, run } = useBusy();
  const save = () => run('save', async () => {
    setNote(null);
    try {
      await api('/api/me/profile', 'PUT', { picture: pic.trim(), phone: phone.trim() });
      setNote({ ok: true, text: 'Your profile is saved.' });
      onSaved();
    } catch (e) { setNote({ ok: false, text: e.message }); }
  });
  return (
    <Card t="Edit my profile" sub="Change your photo and phone number. Your name and email are set by the school.">
      {note && <div className="mb-4"><Alert ok={note.ok}>{note.text}</Alert></div>}
      <div className="grid gap-6 md:grid-cols-[120px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={p.name} picture={pic} className="h-24 w-24 text-2xl" />
          <span className="text-[11px] text-black/50">Preview</span>
        </div>
        <div className="space-y-4">
          <Field l="Photo link" hint="Paste a link to a photo. Google Drive and Dropbox share links work too.">
            <Inp value={pic} onChange={(e) => setPic(e.target.value)} placeholder="https://…" />
          </Field>
          <Field l="Phone or WhatsApp" hint="People who find your lost items use this to reach you.">
            <Inp value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 7xx xxx xxx" />
          </Field>
          <ActBtn busy={busy === 'save'} doing="Saving…" label="Save profile" onClick={save} />
        </div>
      </div>
    </Card>
  );
}

function Profile() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/api/profile').then(setP).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <Alert>{err}</Alert>;
  if (!p) return <Loader full label="Loading your profile" />;

  const details = [
    ['Email', p.email || 'Not set'],
    ['Role', ROLE_LABEL[p.role] || p.role],
    ...(p.comm && p.role !== 'admin' ? [['Extra role', 'Minister of Communication']] : []),
    ...(p.role === 'student' ? [['Class', p.cls || 'Not set'], ['Combination', p.combo || 'None']] : []),
    ...(p.phone ? [['Phone', p.phone]] : []),
  ];
  const s = p.stats;
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <div className="flex flex-col items-center text-center">
          <Avatar name={p.name} picture={p.picture} gid="" className="h-20 w-20 text-xl" />
          <h2 className="mt-4 text-base font-bold">{p.name}</h2>
          <span className="mt-2 rounded-[4px] bg-[#ff4500]/10 px-3 py-1 text-[11px] font-semibold text-[#c2310a]">{ROLE_LABEL[p.role] || p.role}</span>
        </div>
        <dl className="mt-6 divide-y divide-black/10 text-xs">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3">
              <dt className="text-black/50">{k}</dt>
              <dd className="break-all text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="space-y-6">
        <ProfileForm p={p} onSaved={load} />
        {s && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat v={s.total} t={p.role === 'student' ? 'Applications' : 'Bookings made'} />
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
/* 10. DASHBOARD SHELL                                                 */
/* ================================================================== */

const NAV_ICON = { 'My labs': 'Labs', Bookings: 'Bookings', 'Lost & Found': 'Tag', Profile: 'Profile', Overview: 'Overview', People: 'People', Schedule: 'Schedule', Settings: 'Settings' };

function NavItem({ name, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-3 whitespace-nowrap rounded-[6px] px-3 py-2.5 text-xs font-semibold ${active ? 'bg-[#16a34a] text-white' : 'text-black/70 hover:bg-black/5'}`}>
      <Icon n={NAV_ICON[name]} />{name}
    </button>
  );
}

function Dashboard({ user, opts, intent, onIntentDone, onLogout, onRefreshMe }) {
  const items = user.role === 'admin'
    ? [...ADMIN_TABS, 'Profile']
    : [user.role === 'student' ? 'My labs' : 'Bookings', ...(user.comm ? ['Lost & Found'] : []), 'Profile'];
  const [picked, setPage] = useState(items[0]);
  const page = items.includes(picked) ? picked : items[0];
  useLive({ 'me:update': onRefreshMe });

  let body;
  if (page === 'Profile') body = <Profile />;
  else if (page === 'Lost & Found') body = <TrendsManager user={user} opts={opts} />;
  else if (user.role === 'admin') body = <Admin tab={page} />;
  else body = <Booker user={user} opts={opts} intent={intent} onIntentDone={onIntentDone} />;

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[13px] text-[#111827] lg:flex">
      <aside className="hidden flex-col border-r border-black/10 bg-white p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0">
        <Logo />
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {items.map((x) => <NavItem key={x} name={x} active={page === x} onClick={() => setPage(x)} />)}
        </nav>
        <div className="mt-4 rounded-[8px] bg-black/[0.04] p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} picture={user.picture} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{user.name}</div>
              <div className="text-[11px] text-black/55">{user.comm && user.role !== 'admin' ? 'Minister of Communication' : ROLE_LABEL[user.role] || user.role}</div>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="mt-3 flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-xs font-semibold text-[#ff4500] hover:bg-[#ff4500]/10">
            <Icon n="Logout" />Log out
          </button>
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
              <div key={x} className="shrink-0"><NavItem name={x} active={page === x} onClick={() => setPage(x)} /></div>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <Avatar name={user.name} picture={user.picture} className="h-10 w-10 text-xs" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">{page}</h1>
              <p className="mt-0.5 text-xs text-black/50">{user.name}{user.email ? ` · ${user.email}` : ''}</p>
            </div>
          </div>
          {body}
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 11. ROOT: home -> sign in -> dashboard                              */
/* ================================================================== */

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
    await loadOpts();
    setUser(await api('/api/me'));
    setView('app');
  };
  const logout = () => { setToken(''); setUser(null); setIntent(null); setView('home'); };
  const goLogin = (i) => { setIntent(i && i.sessionId ? i : null); setView('login'); };

  let page;
  if (booting) page = <Loader full label="Loading" />;
  else if (view === 'app' && user) page = <Dashboard user={user} opts={opts} intent={intent} onIntentDone={() => setIntent(null)} onLogout={logout} onRefreshMe={refreshMe} />;
  else if (view === 'login') page = <Auth onDone={handleAuth} onBack={() => setView('home')} intent={intent} />;
  else page = <Landing onLogin={goLogin} categories={catsOf(opts)} />;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <ConfirmProvider>{page}</ConfirmProvider>
    </>
  );
}