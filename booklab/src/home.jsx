import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import lab3 from './assets/lab3.jpeg';
import lab33 from './assets/lab33.jpeg';
import lab11 from './assets/lab11.jpeg';
import lab22 from './assets/lab22.jpeg';
import lab4 from './assets/lab4.jpeg';
import c7 from './assets/c7.jpeg';
import c8 from './assets/c8.jpeg';
import c3 from './assets/c3.jpeg';

const icon = (d) => function Icon({ className = '', ...props }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d={d} /></svg>; };
const CalendarDays = icon('M8 2v4m8-4v4M3 10h18M5 4h14v18H3V6a2 2 0 0 1 2-2zm2 10h3m4 0h3m-10 4h3');
const CalendarCheck2 = icon('M8 2v4m8-4v4M3 10h18M5 4h14v18H3V6a2 2 0 0 1 2-2zm4 10 2 2 4-4');
const UserRound = icon('M20 21a8 8 0 0 0-16 0m8-10a5 5 0 1 0 0-10 5 5 0 0 0 0 10z');
const LayoutDashboard = icon('M3 3h8v8H3zm10 0h8v5h-8zm0 7h8v11h-8zm-10 3h8v8H3z');
const FlaskConical = icon('M9 3h6m-5 0v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3m-8 12h12');
const CalendarClock = icon('M8 2v4m8-4v4M3 10h13M5 4h14v9M3 6v14h11m4-5v4l3 2');
const UsersRound = icon('M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6-7a4 4 0 0 1 0 8m2 3a4 4 0 0 1 3 4v2');
const MessageCircle = icon('M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z');
const Settings2 = icon('M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4');
const PackageSearch = icon('M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10');
const Sun = icon('M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z');
const Moon = icon('M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z');
const Send = icon('m22 2-7 20-4-9-9-4 20-7zM22 2 11 13'); const Users = UsersRound;
const ChevronLeft = icon('m15 18-6-6 6-6'); const ChevronRight = icon('m9 18 6-6-6-6');
const X = icon('M18 6 6 18M6 6l12 12'); const Trash2 = icon('M3 6h18m-2 0-1 14H6L5 6m4 0V4h6v2');
const Printer = icon('M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-12-4h12v8H6z');
const Plus = icon('M12 5v14m-7-7h14'); const LogOut = icon('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9');
const Sunrise = icon('M12 2v7m-4-3 4 3 4-3M3 18h18M5 14a7 7 0 0 1 14 0m-17 8h20'); const Sunset = icon('M12 22v-7m-4 3 4-3 4 3M3 6h18M5 10a7 7 0 0 1 14 0m-17-8h20');
const Eye = icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'); const Radio = icon('M4 8h16a2 2 0 0 1 2 2v10H2V10a2 2 0 0 1 2-2zm4 4h.01');
const ArrowLeft = icon('m12 19-7-7 7-7m-7 7h14'); const CheckCheck = icon('m2 12 4 4L16 6m-4 6 4 4 6-10');
// Navigation and Champions League icons
const Menu = icon('M4 6h16M4 12h16M4 18h16');
const Trophy = icon('M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3');
// Chat and call icons
const PHONE = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z';
const VIDEO = 'm16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z';
const MIC = 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3';
const Phone = icon(PHONE); const PhoneOff = icon(PHONE + 'M2 2l20 20');
const Video = icon(VIDEO); const VideoOff = icon(VIDEO + 'M2 2l20 20');
const Mic = icon(MIC); const MicOff = icon(MIC + 'M2 2l20 20');
const Paperclip = icon('m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5');
const Smile = icon('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01');
const Reply = icon('M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4');
const Forward = icon('m15 17 5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12');
const MoreV = icon('M12 5h.01M12 12h.01M12 19h.01');
const Pencil = icon('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z');
const Copy = icon('M9 9h11v11H9zM5 15H4V4h11v1');
const Download = icon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3');
const Monitor = icon('M3 4h18v12H3zM8 20h8M12 16v4');
const FileIcon = icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6');
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
const ADMIN_TABS = ['Overview', 'History', 'Labs', 'Schedule', 'People', 'Chat', 'Champions League', 'Settings'];
const gradesOf = (o) => (o.grades?.length ? o.grades : DEFAULT_GRADES);
const combosFor = (o, g) => o.gradeCombos?.[g] ?? [];
const catsOf = (o) => (o?.trendCategories?.length ? o.trendCategories : DEFAULT_CATS);
const unsplash = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
// Pictures used when a lab has no image of its own, and on the landing and login pages.
const LAB_PICS = ['photo-1498050108023-c5249f4df085', 'photo-1517694712202-14dd9538aa97', 'photo-1519389950473-47ba0277781c', 'photo-1522202176988-66273c2fd55f', 'photo-1531482615713-2afd69097998', 'photo-1497366754035-f200968a6e72'];
const defaultLabPic = (i, w = 900) => unsplash(LAB_PICS[Math.abs(+i || 0) % LAB_PICS.length], w);
const LAB_IMAGES_BY_NAME = {
  lab1: lab11, lab2: lab22, lab3, lab33, lab11, lab22, lab4, c7, c8, c3,
};
const LOGIN_SLIDES = [
  { id: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPLrWxuPLWJQ6v6oUcHeQXk4Tjw6vnVZepDRUAfnRzWSErgiLehCu3Ww3z&s=10', t: 'Your next idea starts here.', s: 'Book a computer lab place before you arrive.' },
];

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
const BOOKABLE_WEEKDAYS = new Set([5, 0, 6]); // Fri, Sat, Sun
const isBookableDay = (s) => {
  if (!s) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return !Number.isNaN(dt.getTime()) && BOOKABLE_WEEKDAYS.has(dt.getDay());
};
const shiftBookableDay = (s, dir = 1) => {
  const base = new Date(`${s || today()}T12:00:00`);
  let d = new Date(base);
  let tries = 0;
  while (tries < 14) {
    d.setDate(d.getDate() + dir);
    tries += 1;
    if (BOOKABLE_WEEKDAYS.has(d.getDay())) return ymd(d);
  }
  return today();
};
const pickBookableDay = (s) => (isBookableDay(s) ? s : shiftBookableDay(s, 1));
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
// Picture of a lab: an uploaded one (path that starts with /api/) or a link.
const labSrc = (u) => { const s = String(u || ''); return s.startsWith('/') ? BASE + s : directImg(s); };
// Chat files are opened with the sign-in token in the link, because <img> and <video> cannot send a header.
const chatFileUrl = (id, dl) => `${BASE}/api/chat/files/${id}?t=${encodeURIComponent(getToken())}${dl ? '&dl=1' : ''}`;
const readB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
const fileSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const mmss = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
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
// Lunch periods are kept in the settings. Defaults are used until the settings are loaded.
const periodsOf = (o = {}) => ({
  before: { from: o.beforeFrom || '08:00', to: o.beforeTo || '12:30' },
  after: { from: o.afterFrom || '13:30', to: o.afterTo || '15:00' },
});

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
  <button type="button" className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[6px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${BTN[c]} ${className}`} {...p} />
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
        <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5 hover:text-black"><X className="h-4 w-4" aria-hidden="true" /></button>
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
const DayBar = ({ day, onChange }) => {
  const safeDay = isBookableDay(day) ? day : pickBookableDay(day || today());
  const jump = (delta) => onChange(shiftBookableDay(safeDay, delta));
  const choose = (value) => onChange(isBookableDay(value) ? value : pickBookableDay(value));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn c="w" onClick={() => jump(-1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous day</Btn>
      <Inp type="date" aria-label="Choose a day" value={safeDay} onChange={(e) => e.target.value && choose(e.target.value)} className="!w-40" />
      <Btn c="w" onClick={() => jump(1)}>Next day<ChevronRight className="h-4 w-4" aria-hidden="true" /></Btn>
      {safeDay !== today() && <Btn onClick={() => onChange(pickBookableDay(today()))}>Today</Btn>}
    </div>
  );
};
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
// An image that falls back to something else when it cannot load (broken link, blocked host).
const Photo = ({ src, alt = '', className = '', fallback = null }) => {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (!src || bad) return fallback;
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={className} />;
};
// The picture of a lab: its own image (uploaded or a link), or a nice default one.
const LabImg = ({ lab, index = 0, className = '', w = 900 }) => {
  const def = defaultLabPic(lab?.id ?? index, w);
  const nameKey = String(lab?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const namedImage = LAB_IMAGES_BY_NAME[nameKey];
  const src = lab?.image ? labSrc(lab.image) : namedImage || def;
  return <Photo src={src || def} alt={lab?.name || 'Computer lab'} className={className}
    fallback={<img src={def} alt={lab?.name || 'Computer lab'} className={className} />} />;
};
const ThemeBtn = ({ dark, onToggle, className = '' }) => (
  <button type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggle}
    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/15 bg-white text-[#111827] hover:bg-black/5 ${className}`}>
    {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
  </button>
);
// Previous / Next controls for long lists.
const Pager = ({ page, pages, onChange, label }) => (pages > 1 ? (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3">
    <span className="text-xs text-black/55">{label}</span>
    <div className="flex items-center gap-2">
      <Btn c="w" disabled={page <= 0} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</Btn>
      <span className="text-xs font-semibold">{page + 1} / {pages}</span>
      <Btn c="w" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></Btn>
    </div>
  </div>
) : null);
// "Select all" bar used above lists that can be deleted in bulk.
const SelectBar = ({ total, selected, onAll, onNone, children }) => (
  <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[6px] bg-black/[0.03] px-3 py-2">
    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
      <input type="checkbox" className="h-4 w-4 accent-[#16a34a]" checked={total > 0 && selected === total}
        ref={(el) => { if (el) el.indeterminate = selected > 0 && selected < total; }}
        onChange={(e) => (e.target.checked ? onAll() : onNone())} />
      Select all ({total})
    </label>
    {selected > 0 && <span className="text-xs text-black/55">{selected} selected</span>}
    <span className="ml-auto flex flex-wrap items-center gap-2">{children}</span>
  </div>
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
          <label key={s.id ?? s.name} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-black/[0.02]">
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
            <button type="button" aria-label={`Remove ${x}`} onClick={() => onRemove(x)} className="grid h-4 w-4 place-items-center text-[#ff4500]"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
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
    <span className="whitespace-nowrap text-base sm:text-lg" aria-label="Asyv_lms">
      {LOGO_LETTERS.map(([ch, tone], i) => (
        <span key={i} aria-hidden="true" className="lb-bounce"
          style={{ animationDelay: `${i * 0.12}s`, color: tone === 'or' ? '#ff4500' : tone === 'green' ? (light ? '#ffffff' : 'var(--ok, #16a34a)') : (light ? '#ffffff' : 'var(--ink, #111827)') }}>
          {ch}
        </span>
      ))}
    </span>
  </div>
);

// Light and dark mode. Everything is wrapped in .lms-dark when dark mode is on.
// Dark mode is TRUE BLACK (#000) with orangered (#ff4500) as the only accent. Green is not used in dark mode.
const GLOBAL_CSS = `
@property --p { syntax: '<number>'; inherits: false; initial-value: 0; }
@keyframes lbIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes lbBounce{0%,55%,100%{transform:translateY(0)}25%{transform:translateY(-7px)}40%{transform:translateY(0)}47%{transform:translateY(-2px)}}
@keyframes lbPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes lbDot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-3px);opacity:1}}
@keyframes lbFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-10px) rotate(1deg)}}
@keyframes lbGlow{0%,100%{box-shadow:0 12px 30px rgba(22,163,74,.12)}50%{box-shadow:0 18px 45px rgba(22,163,74,.3)}}
@keyframes lbZoom{from{transform:scale(1)}to{transform:scale(1.12)}}
@keyframes lbRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lbPing{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.4);opacity:0}}
.lb-float{animation:lbFloat 5s ease-in-out infinite}.lb-glow{animation:lbGlow 4s ease-in-out infinite}
.lb-in{animation:lbIn .6s ease both}
.lb-zoom{animation:lbZoom 9s ease-out both}
.lb-rise{animation:lbRise .45s ease both}
.lb-ping{animation:lbPing 1.6s ease-out infinite}
.lb-bounce{display:inline-block;animation:lbBounce 2.2s ease-in-out infinite}
.lb-pulse{animation:lbPulse 1.6s ease-in-out infinite}
.lb-dot{display:inline-block;width:6px;height:6px;border-radius:9999px;background:#9ca3af;animation:lbDot 1.2s infinite}
/* Border fills up as places are taken. --p is 0 to 100. */
.lb-ring{padding:3px;border-radius:8px;background:conic-gradient(var(--c,#16a34a) calc(var(--p) * 1%),#e5e7eb 0);transition:--p 1.2s ease}
@media (prefers-reduced-motion:reduce){.lb-bounce,.lb-pulse,.lb-in,.lb-dot,.lb-float,.lb-glow,.lb-zoom,.lb-rise,.lb-ping{animation:none!important}.lb-ring{transition:none}}

/* Dark mode: true black, orangered accent, no green */
.lms-dark{--ink:#ffffff;--ok:#ff4500;--full:#ffffff;--card:rgba(0,0,0,.88);background:#000;color:#f5f5f5;color-scheme:dark}
.lms-dark .bg-white{background-color:#0a0a0a!important}
.lms-dark [class~="bg-[#f7f8f7]"],.lms-dark [class~="bg-[#f0f2f5]"]{background-color:#000!important}
.lms-dark [class~="bg-[#e8f5ec]"]{background-color:#1a0b05!important}
.lms-dark [class*="from-[#e8f5ec]"]{background-image:none!important;background-color:#140a06!important}
.lms-dark [class*="bg-white/"]{background-color:rgba(0,0,0,.92)!important}
.lms-dark [class~="text-[#111827]"]{color:#f5f5f5!important}
.lms-dark [class*="text-black/"]{color:#b8b8b8!important}
.lms-dark [class*="border-black/"]{border-color:#2e2e2e!important}
.lms-dark [class*="divide-black/"]>*+*{border-color:#2e2e2e!important}
.lms-dark input,.lms-dark select,.lms-dark textarea{background-color:#000!important;color:#f5f5f5!important;border-color:#4a4a4a!important;accent-color:#ff4500}
.lms-dark input::placeholder,.lms-dark textarea::placeholder{color:#8a8a8a!important}
.lms-dark [class*="hover:bg-black/"]:hover{background-color:#1f1f1f!important}
.lms-dark [class*="bg-black/["],.lms-dark [class~="bg-black/5"]{background-color:#181818!important}
.lms-dark [class~="bg-black/10"]{background-color:#2a2a2a!important}
.lms-dark [class~="bg-[#111827]"]{background-color:#2a2a2a!important}
.lms-dark .lb-ring{background:conic-gradient(var(--c,#ff4500) calc(var(--p) * 1%),#2a2a2a 0)}
/* green becomes orangered */
.lms-dark [class*="bg-[#16a34a]"]{background-color:#ff4500!important}
.lms-dark [class*="bg-[#16a34a]/"]{background-color:rgba(255,69,0,.2)!important}
.lms-dark [class*="from-[#16a34a]"]{background-image:linear-gradient(135deg,#ff4500,#7a2200)!important}
.lms-dark [class*="bg-[#4ade80]"]{background-color:#ff4500!important}
.lms-dark [class*="text-[#16a34a]"],.lms-dark [class*="text-[#15803d]"]{color:#ff7a45!important}
.lms-dark [class*="border-[#16a34a]"]{border-color:#ff4500!important}
.lms-dark [class*="border-[#16a34a]/20"]{border-color:rgba(255,69,0,.28)!important}
.lms-dark [class*="bg-[#16b5a2]"]{background-color:#ff4500!important}
.lms-dark [class*="border-t-[#ff4500]"]{border-top-color:#ff4500!important}
.lms-dark [class*="focus:border-[#16a34a]"]:focus{border-color:#ff4500!important}
/* other colours that must stay readable on black */
.lms-dark [class~="text-[#c2310a]"]{color:#ff7a45!important}
.lms-dark [class~="text-[#b45309]"]{color:#ffb020!important}
.lms-dark [class~="text-[#1d4ed8]"],.lms-dark [class~="text-[#2563eb]"]{color:#7db3ff!important}
.lms-dark [class~="text-[#dc2626]"]{color:#ff6b6b!important}
.lms-dark .rounded-full[class~="border-white"]{border-color:#000!important}
`;

// Champions League advert and advanced navbar styles. Plain CSS so they look the same in light and dark mode.
const LANDING_CSS = `
@keyframes landingDrift{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes landingWave{0%,100%{transform:translateX(-3%) rotate(-1deg);border-radius:44% 56% 0 0/22% 30% 0 0}50%{transform:translateX(3%) rotate(1deg);border-radius:55% 45% 0 0/30% 20% 0 0}}
@keyframes landingOrbit{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes landingOrbitCounter{from{transform:rotate(360deg)}to{transform:rotate(0)}}
@keyframes landingBob{0%,100%{translate:0 0}50%{translate:0 -8px}}
.landing-shell{--landing-bg:#f3fbf9;--landing-surface:#fff;--landing-ink:#151d1c;--landing-muted:#63716f;--landing-line:rgba(21,45,43,.1);background:var(--landing-bg);color:var(--landing-ink)}
.landing-nav{background:rgba(243,251,249,.93);border-color:var(--landing-line)}
.landing-menu{border:1px solid rgba(21,45,43,.08);background:rgba(255,255,255,.86);box-shadow:0 7px 25px rgba(27,75,68,.06)}
.landing-hero{position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(ellipse at 72% 60%,rgba(22,163,74,.32),transparent 42%),linear-gradient(145deg,#071d17 0%,#0b3828 54%,#10251d 100%)}
.landing-hero:before,.landing-hero:after{content:"";position:absolute;z-index:0;width:420px;height:420px;top:16%;border:1px solid rgba(255,255,255,.08);border-radius:50%;box-shadow:0 0 0 55px rgba(255,255,255,.025),0 0 0 110px rgba(255,255,255,.018);pointer-events:none}
.landing-hero:before{left:-300px}.landing-hero:after{right:-300px}
.landing-ocean{position:absolute;z-index:0;inset:auto -12% -50px;height:42%;overflow:hidden;pointer-events:none}
.landing-wave{position:absolute;left:-4%;bottom:-56%;width:108%;height:145%;border-radius:45% 55% 0 0/26% 32% 0 0;animation:landingWave 10s ease-in-out infinite}
.landing-wave-one{background:rgba(22,163,74,.33)}
.landing-wave-two{bottom:-68%;background:rgba(255,69,0,.2);animation-duration:13s;animation-direction:alternate-reverse}
.landing-wave-three{bottom:-78%;background:rgba(255,255,255,.1);animation-duration:16s;animation-delay:-4s}
.landing-app-orbit{position:relative;width:132px;height:92px;margin-inline:auto}
.landing-app-orbit-ring{position:absolute;inset:10px 19px;border:1px solid rgba(255,255,255,.22);border-radius:50%;animation:landingOrbit 24s linear infinite}
.landing-app-center{position:absolute;left:50%;top:50%;display:grid;width:58px;height:58px;place-items:center;overflow:hidden;border:2px solid rgba(255,255,255,.75);border-radius:50%;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.22);transform:translate(-50%,-50%);animation:landingBob 4s ease-in-out infinite}
.landing-app-center img{width:100%;height:100%;object-fit:cover}
.landing-app-orb{position:absolute;display:grid;width:31px;height:31px;place-items:center;border:1px solid rgba(255,255,255,.65);border-radius:50%;background:#fff;color:#15803d;box-shadow:0 5px 18px rgba(0,0,0,.2);animation:landingBob 3.2s ease-in-out infinite}
.landing-app-orb svg{width:15px;height:15px}
.landing-app-orb-one{left:4px;top:18px}
.landing-app-orb-two{right:1px;top:12px;color:#ff4500;animation-delay:-1s}
.landing-app-orb-three{right:12px;bottom:0;color:#15803d;animation-delay:-2s}
.landing-app-orb-four{left:11px;bottom:1px;color:#ff4500;animation-delay:-.5s}
.landing-hero-title{color:#fff;letter-spacing:-.055em}
.landing-hero-copy{color:rgba(255,255,255,.76)}
.landing-primary{background:linear-gradient(105deg,#16a34a,#ff4500);box-shadow:0 8px 22px rgba(22,163,74,.23);transition:transform .2s,box-shadow .2s}
.landing-primary:hover{background:linear-gradient(105deg,#15803d,#e63e00);transform:translateY(-2px);box-shadow:0 12px 26px rgba(22,163,74,.3)}
.landing-trust{border-top:1px solid var(--landing-line);border-bottom:1px solid var(--landing-line);background:rgba(255,255,255,.55)}
.landing-trust-card{background:var(--landing-surface);border:1px solid var(--landing-line);box-shadow:0 8px 26px rgba(23,35,27,.035)}
.landing-icon{background:#e5f8f4;color:#12a998}
.landing-dashboard-stage{position:relative;z-index:2;margin:-10px auto 0;padding:0 20px 46px;max-width:1180px}
.landing-dashboard{overflow:hidden;border:1px solid rgba(26,78,72,.1);border-radius:20px;background:#fff;box-shadow:0 28px 80px rgba(22,80,70,.15)}
.landing-dashboard-top{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #edf1f0;padding:14px 20px}
.landing-dashboard-body{padding:20px}
.landing-dashboard-card{border:1px solid #edf1f0;background:#fff}
.landing-dashboard-muted{color:#7a8885}
.landing-dashboard-icon{background:#e5f8f4;color:#109f8e}
.landing-photo{box-shadow:0 12px 30px rgba(18,44,42,.08)}
.landing-metrics{box-shadow:0 12px 34px rgba(18,44,42,.055)}
.landing-metric-card{border:1px solid #edf1f0;background:#fff}
.learning-spotlight{overflow:hidden;background:linear-gradient(115deg,#10141b,#172235 60%,#123c3c);color:#fff}
.learning-chip{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#e5f9f5}
.landing-section{scroll-margin-top:92px}
.landing-section-heading{color:var(--landing-ink)}
.landing-section-copy{color:var(--landing-muted)}
.landing-footer{border-color:var(--landing-line);color:var(--landing-muted)}
.landing-footer-inner{border-top:1px solid var(--landing-line)}
.lms-dark .landing-shell{--landing-bg:#050505;--landing-surface:#0c0c0c;--landing-ink:#f5f5f5;--landing-muted:#aaa;background:var(--landing-bg);color:var(--landing-ink)}
.lms-dark .landing-nav{background:rgba(5,5,5,.92);border-color:#292929}
.lms-dark .landing-menu{border-color:#292929;background:#101010;box-shadow:none}
.lms-dark .landing-hero{background:radial-gradient(ellipse at 75% 75%,rgba(255,69,0,.18),transparent 40%),linear-gradient(135deg,#050505 0%,#111 100%)}
.lms-dark .landing-hero:before,.lms-dark .landing-hero:after{border-color:rgba(255,69,0,.18);box-shadow:0 0 0 55px rgba(255,69,0,.035),0 0 0 110px rgba(255,69,0,.025)}
.lms-dark .landing-kicker{border-color:rgba(255,69,0,.28);background:#111;color:#ff8a5b}
.lms-dark .landing-hero-title,.lms-dark .landing-section-heading{color:#f5f5f5}
.lms-dark .landing-hero-copy,.lms-dark .landing-section-copy{color:#aaa}
.lms-dark .landing-dashboard{border-color:#292929;background:#0c0c0c}
.lms-dark .landing-dashboard-top{border-color:#292929}
.lms-dark .landing-dashboard-brand{color:#f5f5f5}
.lms-dark .landing-dashboard-card{border-color:#292929;background:#101010}
.lms-dark .landing-dashboard-muted{color:#aaa}
.lms-dark .landing-dashboard-icon{background:rgba(255,69,0,.12);color:#ff8054}
.lms-dark .landing-metrics,.lms-dark .landing-metric-card{border-color:#292929;background:#101010;box-shadow:none}
.lms-dark .learning-spotlight{background:linear-gradient(115deg,#080808,#141414 60%,#21120d)}
.lms-dark .learning-chip{border-color:#333;background:#151515;color:#f0f0f0}
.lms-dark .landing-trust{border-color:#292929;background:#080808}
.lms-dark .landing-trust-card{background:#0c0c0c;border-color:#292929;box-shadow:none}
.lms-dark .landing-icon{background:rgba(255,69,0,.12);color:#ff8054}
.lms-dark .landing-footer,.lms-dark .landing-footer-inner{border-color:#292929;color:#aaa}
@media(max-width:767px){.landing-dashboard-stage{margin-top:-2px;padding:0 12px 32px}.landing-dashboard{border-radius:15px}.landing-dashboard-body{padding:12px}.landing-dashboard-top{padding:12px}}
@media(prefers-reduced-motion:reduce){.landing-primary{transition:none}.landing-primary:hover{transform:none}.landing-wave,.landing-app-orbit-ring,.landing-app-center,.landing-app-orb{animation:none!important}}
@keyframes uclLeft{0%{opacity:0;transform:translateX(-160px) rotate(-16deg) scale(.6)}55%{opacity:1;transform:translateX(14px) rotate(3deg) scale(1.08)}78%{transform:translateX(-5px) rotate(-1deg) scale(.98)}100%{opacity:1;transform:none}}
@keyframes uclRight{0%{opacity:0;transform:translateX(160px) rotate(16deg) scale(.6)}55%{opacity:1;transform:translateX(-14px) rotate(-3deg) scale(1.08)}78%{transform:translateX(5px) rotate(1deg) scale(.98)}100%{opacity:1;transform:none}}
@keyframes uclPop{0%{opacity:0;transform:scale(.1) rotate(-90deg)}65%{opacity:1;transform:scale(1.25) rotate(8deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes uclDrop{0%{opacity:0;transform:translateY(-120px) scale(.6)}60%{opacity:1;transform:translateY(8px) scale(1.05)}80%{transform:translateY(-4px)}100%{opacity:1;transform:none}}
@keyframes uclUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes uclRoll{0%{transform:translateX(-44px)}50%{transform:translateX(44px)}100%{transform:translateX(-44px)}}
@keyframes uclHop{0%,100%{transform:translateY(0)}25%{transform:translateY(-20px)}50%{transform:translateY(0)}75%{transform:translateY(-12px)}}
@keyframes uclSpin{to{transform:rotate(360deg)}}
@keyframes uclBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes uclTwinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1.2)}}
@keyframes uclBeam{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}
@keyframes uclMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes uclRise{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-260px);opacity:0}}
@keyframes uclShadow{0%,100%{transform:scaleX(1);opacity:.35}25%{transform:scaleX(.6);opacity:.15}50%{transform:scaleX(1);opacity:.35}75%{transform:scaleX(.75);opacity:.2}}
@keyframes uclRing{0%{transform:scale(.6);opacity:.8}100%{transform:scale(2.2);opacity:0}}
.ucl-card{background:radial-gradient(120% 90% at 50% 0%,#1d3f8f 0%,#0b1b3a 55%,#050b1c 100%);color:#fff}
.ucl-left{animation:uclLeft 1.1s cubic-bezier(.2,.9,.3,1) .1s both}
.ucl-right{animation:uclRight 1.1s cubic-bezier(.2,.9,.3,1) .1s both}
.ucl-pop{animation:uclPop .8s cubic-bezier(.2,.9,.3,1) 1s both}
.ucl-drop{animation:uclDrop .9s cubic-bezier(.2,.9,.3,1) .6s both}
.ucl-up{animation:uclUp .6s ease both}
.ucl-roll{animation:uclRoll 4.4s ease-in-out 1.6s infinite both}
.ucl-hop{animation:uclHop 1.1s ease-in-out 1.6s infinite}
.ucl-spin{animation:uclSpin 2.2s linear infinite}
.ucl-bob{animation:uclBob 3.4s ease-in-out 1.4s infinite}
.ucl-twinkle{animation:uclTwinkle 2.8s ease-in-out infinite}
.ucl-beam{transform-origin:50% 0;animation:uclBeam 7s ease-in-out infinite}
.ucl-marquee{display:flex;width:max-content;animation:uclMarquee 22s linear infinite}
.ucl-rise{animation:uclRise 6s ease-in infinite}
.ucl-shadow{animation:uclShadow 1.1s ease-in-out 1.6s infinite}
.ucl-ring{animation:uclRing 2s ease-out infinite}
.ucl-glass{background:rgba(255,255,255,.12)}
.ucl-glass:hover{background:rgba(255,255,255,.22)}
.ucl-white{background:#fff;color:#0b1b3a}
.ucl-gold{background:#f5c542;color:#0b1b3a}
.ucl-static,.ucl-static *{animation:none!important;transition:none!important}
.nav-link{position:relative}
.nav-link::after{content:'';position:absolute;left:12px;right:12px;bottom:4px;height:2px;border-radius:2px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .3s ease}
.nav-link:hover::after{transform:scaleX(1)}
.nav-link[aria-current="true"]::after{transform:scaleX(0)}
@media (prefers-reduced-motion:reduce){.ucl-left,.ucl-right,.ucl-pop,.ucl-drop,.ucl-up,.ucl-roll,.ucl-hop,.ucl-spin,.ucl-bob,.ucl-twinkle,.ucl-beam,.ucl-marquee,.ucl-rise,.ucl-shadow,.ucl-ring{animation:none!important}}
@keyframes bookOpen{0%{transform:rotateY(0)}100%{transform:rotateY(-172deg)}}
@keyframes pageFlip{0%{transform:rotateY(0)}100%{transform:rotateY(-168deg)}}
@keyframes bookIn{from{opacity:0;transform:rotateX(18deg) rotateZ(-4deg) scale(.7)}to{opacity:1;transform:rotateX(18deg) rotateZ(-4deg) scale(1)}}
@keyframes introOut{0%{opacity:1;transform:none}100%{opacity:0;transform:perspective(1200px) rotateY(-40deg) scale(.85) translateX(-12%)}}
@keyframes lfFly{0%{transform:translateY(0) scale(.8);opacity:0}20%{opacity:1}100%{transform:translateY(-220px) scale(1.1);opacity:0}}
@keyframes announcementEnter{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}
@keyframes announcementProgress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes countdownPop{0%{opacity:0;transform:scale(.35) rotate(-12deg)}55%{opacity:1;transform:scale(1.12) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes teamLeft{0%{opacity:0;transform:translateX(-220px) scale(.65) rotate(-8deg)}70%{opacity:1;transform:translateX(12px) scale(1.05) rotate(2deg)}100%{opacity:1;transform:none}}
@keyframes teamRight{0%{opacity:0;transform:translateX(220px) scale(.65) rotate(8deg)}70%{opacity:1;transform:translateX(-12px) scale(1.05) rotate(-2deg)}100%{opacity:1;transform:none}}
@keyframes playerIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.15)}65%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes lostZoom{0%{opacity:0;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
.countdown-pop{animation:countdownPop .55s cubic-bezier(.2,.9,.3,1) both}
.team-enter-left{animation:teamLeft 1.1s cubic-bezier(.2,.9,.3,1) both}
.team-enter-right{animation:teamRight 1.1s cubic-bezier(.2,.9,.3,1) both}
.lineup-field{background:radial-gradient(circle at 50% 50%,rgba(74,222,128,.25),transparent 28%),linear-gradient(135deg,#176a37,#0d4d29);box-shadow:inset 0 0 100px rgba(0,0,0,.35),0 30px 80px rgba(0,0,0,.5)}
.lineup-player{animation:playerIn .7s cubic-bezier(.2,.9,.3,1) both}
.lost-fullscreen{animation:lostZoom .7s ease both}
.announcement-enter{animation:announcementEnter .45s ease both}
.announcement-progress{transform-origin:left;animation:announcementProgress linear forwards}
.book-scene{perspective:1200px}
.book{position:relative;width:150px;height:200px;transform-style:preserve-3d;transform:rotateX(18deg) rotateZ(-4deg);animation:bookIn .5s ease both;filter:drop-shadow(0 20px 30px rgba(0,0,0,.6))}
.book-cover{position:absolute;inset:0;z-index:40;display:grid;place-items:center;transform-origin:left center;background:linear-gradient(135deg,#16a34a,#0b6b30);border-radius:4px 10px 10px 4px;border-left:8px solid #0a4d22;animation:bookOpen .6s ease .25s forwards}
.book-title{font-size:26px;font-weight:900;letter-spacing:.05em;color:#fff}
.book-page{position:absolute;inset:5px 5px 5px 0;z-index:calc(30 - var(--i));transform-origin:left center;background:linear-gradient(90deg,#e5e7eb,#fff 20%);border-radius:2px 8px 8px 2px;animation:pageFlip .3s ease forwards;animation-delay:calc(.7s + var(--i) * .12s)}
.intro-out{animation:introOut .8s cubic-bezier(.6,0,.4,1) forwards;transform-origin:left center;pointer-events:none}
.lf-fly{animation:lfFly 3.2s ease-in infinite}
@media (prefers-reduced-motion:reduce){.announcement-progress,.book,.book-cover,.book-page,.intro-out,.lf-fly{animation:none!important}}
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
  const full = !closed && s.left < 1;
  const pct = s.seats ? Math.round(((s.seats - s.left) / s.seats) * 100) : 0;
  const color = s.left < 1 ? 'var(--full, #ff4500)' : 'var(--ok, #16a34a)';
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(pct), 80); return () => clearTimeout(t); }, [pct]);
  const intent = { sessionId: s.id, date: day, lab: s.labName, from: s.from, to: s.to };
  const inner = (
    <div title={full ? 'This lab is full' : s.exclusive ? 'Only invited users can apply' : undefined} className={`flex items-center justify-between gap-3 rounded-[6px] p-3 ${closed ? 'bg-white opacity-75' : full ? 'bg-[#8b5e3c] text-white' : s.exclusive ? 'bg-[#ff4500] text-white' : 'bg-white'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className={`text-sm ${closed ? 'line-through decoration-[#dc2626]/60' : ''}`}>{s.from}–{s.to}</b>
          {s.for && <Badge s="draft">{s.exclusive ? `✕ Invited only · ${s.for}` : `Reserved for ${s.for}`}</Badge>}
        </div>
        <div className={`mt-1 text-xs ${closed || s.exclusive ? 'font-bold text-white' : s.left < 1 ? 'font-bold text-white' : 'font-medium text-[#15803d]'}`}>
          {closed ? 'This lab time is over' : s.left < 1 ? 'Full' : `${s.left} of ${s.seats} places free`}
        </div>
      </div>
      <Btn c={closed ? 'w' : full ? 'ink' : 'ink'} disabled={closed || s.exclusive || full} title={full ? 'This lab is full' : undefined} onClick={() => onLogin(intent)}>
        {closed ? 'Closed' : s.exclusive ? 'Invited only' : s.left < 1 ? 'Full' : 'Apply'}
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
  return <div className="lb-ring" title={full ? 'This lab is full' : undefined} style={{ '--c': color, '--p': p }}>{inner}</div>;
}

function LabCard({ lab, index, day, past, onLogin }) {
  const status = labStatus(lab.sessions.map((s) => ({ ...s, state: past ? 'over' : s.state })));
  const text = { open: 'Places open', full: 'Full', over: 'Closed', none: 'No lab time', draft: 'Not open' }[status];
  return (
    <article className={`flex flex-col overflow-hidden rounded-[8px] border bg-white ${status === 'over' ? 'border-[#dc2626]/50' : 'border-black/10'}`}>
      <div className={`relative h-36 overflow-hidden ${status === 'full' ? 'bg-[#dc2626]' : 'bg-[#e8f5ec]'}`}>
        <LabImg lab={lab} index={index} className="lb-float h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-[11px] font-semibold shadow ${status === 'full' ? 'bg-[#dc2626] text-white' : 'bg-white/95 text-[#15803d]'}`}>{text}</span>
      </div>
      <div className={`flex items-center justify-between gap-3 border-b p-4 ${status === 'full' ? 'border-white/30 bg-[#dc2626] text-white' : 'border-black/10'}`}>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{lab.name}</h3>
          <p className={`text-xs ${status === 'full' ? 'text-white' : 'text-black/55'}`}>{lab.pcs} computers</p>
        </div>
        <Badge s={status}>{text}</Badge>
      </div>
      <div className={`flex flex-1 flex-col gap-4 p-4 ${status === 'full' ? 'bg-[#dc2626] text-white' : ''}`}>
        {lab.sessions.length === 0 && <p className="py-4 text-center text-xs text-black/50">No lab time on this day.</p>}
        {lab.sessions.map((s) => <SessionPick key={s.id} s={{ ...s, labName: lab.name }} day={day} past={past} onLogin={onLogin} />)}
      </div>
    </article>
  );
}

function LabBoard({ onLogin }) {
  const [day, setDay] = useState(() => pickBookableDay(today()));
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
        {!loading && data?.labs.map((l, i) => <LabCard key={l.id} lab={l} index={i} day={day} past={day < today()} onLogin={onLogin} />)}
      </div>
    </div>
  );
}

// Animated live status of the labs, shown in the labs section of the landing page.
function LiveLabs() {
  const { data, err, loading } = useOverview(today());
  const labs = data?.labs || [];
  const allLabStats = labs.map((lab) => {
    const sessions = lab.sessions || [];
    const seats = sessions.reduce((sum, session) => sum + (session.seats || 0), 0);
    const free = sessions.reduce((sum, session) => sum + Math.max(0, session.left || 0), 0);
    return { id: lab.id, name: lab.name, seats, free, used: Math.max(0, seats - free) };
  });
  const rows = allLabStats.slice(0, 3);
  const totals = allLabStats.reduce((acc, lab) => ({
    seats: acc.seats + lab.seats,
    free: acc.free + lab.free,
    used: acc.used + lab.used,
  }), { seats: 0, free: 0, used: 0 });
  const usePercent = totals.seats ? Math.round((totals.used / totals.seats) * 100) : 0;
  const display = (value) => loading ? '—' : value.toLocaleString();

  return (
    <div className="landing-overview grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <div className="landing-photo relative min-h-[280px] overflow-hidden rounded-2xl sm:min-h-[350px]">
        <img src={lab33} alt="Computers ready for students in a school lab" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071d1c]/85 via-[#071d1c]/10 to-[#071d1c]/5" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-[#176f66] shadow-sm"><span className="lb-pulse h-1.5 w-1.5 rounded-full bg-[#16b5a2]" />COMPUTER LABS</span>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/75">A better place to focus</p>
          <h3 className="mt-2 max-w-md text-2xl font-semibold leading-tight sm:text-3xl">Find your seat. Start something great.</h3>
          <p className="mt-2 max-w-md text-xs leading-5 text-white/80">Real computer labs, simple bookings, and more time for learning.</p>
        </div>
      </div>
      <div className="landing-metrics rounded-2xl border border-black/5 bg-[#fbfefd] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="landing-dashboard-muted text-[10px] font-semibold uppercase tracking-[.14em]">Today’s overview</p><h3 className="mt-1 text-base font-semibold">Availability at a glance</h3></div>
          <span className="landing-dashboard-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl"><LayoutDashboard className="h-4 w-4" aria-hidden="true" /></span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="landing-metric-card rounded-xl p-3"><span className="landing-dashboard-muted text-[10px]">Computer labs</span><b className="mt-1 block text-2xl">{display(labs.length)}</b><span className="text-[10px] text-[#119e8f]">Available to browse</span></div>
          <div className="landing-metric-card rounded-xl p-3"><span className="landing-dashboard-muted text-[10px]">Free places</span><b className="mt-1 block text-2xl">{display(totals.free)}</b><span className="text-[10px] text-[#119e8f]">Across today’s sessions</span></div>
        </div>
        <div className="landing-metric-card mt-2 rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-2"><b className="text-[11px]">Seat availability</b><span className="text-[10px] font-semibold text-[#119e8f]">{loading || !totals.seats ? '—' : `${100 - usePercent}% available`}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8f1ef]"><div className="h-full rounded-full bg-[#16b5a2] transition-[width]" style={{ width: `${loading ? 0 : 100 - usePercent}%` }} /></div>
          <div className="landing-dashboard-muted mt-2 flex justify-between text-[10px]"><span>{display(totals.used)} booked</span><span>{display(totals.seats)} total seats</span></div>
        </div>
        <div className="mt-3 space-y-2">
          {rows.length ? rows.map((lab) => {
            const fill = lab.seats ? Math.round((lab.used / lab.seats) * 100) : 0;
            return <div key={lab.id} className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
              <span className="landing-dashboard-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg"><FlaskConical className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-[10px]"><b className="truncate">{lab.name}</b><span className="landing-dashboard-muted shrink-0">{lab.free} / {lab.seats} free</span></span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#e8f1ef]"><span className="block h-full rounded-full bg-[#16b5a2]" style={{ width: `${fill}%` }} /></span></span>
            </div>;
          }) : <p className="landing-dashboard-muted rounded-xl border border-dashed border-black/10 px-3 py-3 text-[10px]">{err ? 'Live availability is temporarily unavailable.' : loading ? 'Loading live lab availability…' : 'No lab sessions are available today.'}</p>}
        </div>
        <a href="#labs" onClick={(e) => { e.preventDefault(); document.getElementById('labs')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#16b5a2] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#109f8e]">Browse lab times <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
      </div>
    </div>
  );
}

function TrendDetail({ item, onClose }) {
  const digits = (item.phone || '').replace(/[^\d]/g, '');
  const subject = encodeURIComponent(`Lost item: ${item.title}`);
  const photos = item.media.map(itemPhoto).filter(Boolean);
  const [pi, setPi] = useState(0);
  return (
    <Modal title={item.title} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge s="open">{item.category}</Badge>
        <span className="text-black/55">Posted {ago(item.postedAt)}</span>
        {item.foundAt && <span className="text-black/55">· Found at {item.foundAt}</span>}
      </div>
      {photos[pi] && (
        <Photo src={photos[pi]} alt={item.title} className="mt-4 max-h-[400px] w-full rounded-[6px] bg-black/5 object-contain"
          fallback={<div className="mt-4 grid h-48 place-items-center rounded-[6px] bg-black/5 text-xs text-black/50">The photo could not be loaded.</div>} />
      )}
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <button key={p + i} type="button" onClick={() => setPi(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-[6px] border-2 ${i === pi ? 'border-[#16a34a]' : 'border-transparent'}`}>
              <Photo src={p} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
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

const NoPhoto = ({ label }) => (
  <div className="flex flex-col items-center gap-2"><PackageSearch className="h-10 w-10 text-[#16a34a]/70" aria-hidden="true" /><span>{label}</span></div>
);

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
    <section id="trends" className="scroll-mt-20 border-t border-black/10 bg-[#f7f8f7]">
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
            {shown.map((t) => {
              const ph = t.media?.map(itemPhoto).find(Boolean);
              return (
                <button key={t.id} type="button" onClick={() => setOpen(t)} className="flex flex-col overflow-hidden rounded-[8px] border border-black/10 bg-white text-left hover:shadow-lg">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f5ec] via-[#f4f6f8] to-[#fff0e9] text-xs text-black/40">
                    <Photo src={ph} alt={t.title} className="h-full w-full object-cover" fallback={<NoPhoto label={t.category} />} />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold">{t.title}</h3>
                    <p className="mt-2 text-[11px] text-black/50">{t.foundAt ? `Found at ${t.foundAt}` : `Posted ${ago(t.postedAt)}`}</p>
                    <p className="mt-2 text-xs font-semibold text-[#ff4500]">View and contact</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {open && <TrendDetail item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* ================================================================== */
/* ASYV CHAMPIONS LEAGUE: advert card in the hero of the landing page */
/* Change the match here and the whole card updates.                   */
/* ================================================================== */

const DEFAULT_CHAMPIONS = {
  published: false,
  active: false,
  match: {
    league: 'Asyv Champions League',
    stage: 'Group stage',
    category: 'Boys',
    status: 'Upcoming',
    time: 'Time to be announced',
    venue: 'To be announced',
    score: [null, null],
    home: { name: 'Lance Reddick', short: 'LR', bg: '#f4c3b8', fg: '#7a2a18', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQH5TowRXqB1yLLxo8me3UIXDbZNR6-RplYfyXZoL5Gwg&s', imageAlt: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu9P2_25Ke6vLYxgy74kFtU9oUba5B2sOGQTq3VgnOTA&s=10' },
    away: { name: 'Pelé (Edson Arantes Do Nascimento)', short: 'PE', bg: '#dcd7f7', fg: '#2a1f5c', image: 'https://images.squarespace-cdn.com/content/v1/54a30021e4b0f0382f389d58/1420455580740-XHV72ZAM1HJKC3C3KU9F/jpeg.jpg?format=750w', imageAlt: '' },
  },
  lineup: [
    { name: 'Herve', no: 1, x: 50, y: 88, role: 'Goalkeeper' },
    { name: 'Bonna', no: 5, x: 29, y: 69, role: 'Defence' },
    { name: 'Cedric', no: 2, x: 43, y: 69, role: 'Defence' },
    { name: 'Kagame', no: 3, x: 57, y: 69, role: 'Defence' },
    { name: 'Mugisha', no: 7, x: 71, y: 69, role: 'Defence' },
    { name: 'Blaise', no: 11, x: 22, y: 45, role: 'Midfield' },
    { name: 'Benjamin', no: 8, x: 39, y: 45, role: 'Midfield' },
    { name: 'Erneste', no: 10, x: 61, y: 45, role: 'Midfield' },
    { name: 'Reponse', no: 6, x: 78, y: 45, role: 'Midfield' },
    { name: 'Didas', no: 9, x: 50, y: 19, role: 'Forward' },
  ],
};

const STARS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 78}%`, d: `${(i % 7) * 0.4}s`, s: 2 + (i % 3),
}));
const SPARKS = Array.from({ length: 9 }, (_, i) => ({ left: `${8 + i * 10.5}%`, d: `${(i % 5) * 1.1}s`, s: 3 + (i % 3) }));

const UclBall = ({ size = 52 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.45))' }}>
    <circle cx="50" cy="50" r="47" fill="#fff" stroke="#0b1b3a" strokeWidth="3" />
    <polygon points="50,30 69,44 62,66 38,66 31,44" fill="#0b1b3a" />
    <path d="M50 30V4M69 44l26-8M62 66l16 22M38 66L22 88M31 44L5 36" stroke="#0b1b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M50 4l16 8M95 36l-6 22M78 88l-22 8M22 88l-12-22M5 36l22-18" stroke="#0b1b3a" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".6" />
  </svg>
);

const COUNTDOWN_MAX = 10000;
const CHAMPIONS_SECS = 12;
const LINEUP_SECS = 12;
const LOST_ITEM_SECS = 8;

function TeamLogo({ team, className = '' }) {
  const [logoIndex, setLogoIndex] = useState(0);
  const sources = [team.image, team.imageAlt].filter(Boolean);
  const source = sources[logoIndex];
  useEffect(() => setLogoIndex(0), [team.image, team.imageAlt]);
  if (!source) {
    return <span className={`grid place-items-center rounded-[28px] bg-white/10 text-5xl font-black ${className}`}>{team.short}</span>;
  }
  return (
    <img
      src={source}
      alt={team.name}
      referrerPolicy="no-referrer"
      className={`rounded-[28px] object-contain ${className}`}
      onError={() => setLogoIndex((i) => i + 1)}
    />
  );
}

function CountdownOpening({ value }) {
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-black text-white">
      <div className="relative text-center">
        <img src={logo} alt="ASYV" className="mx-auto h-24 w-24 rounded-2xl border-4 border-[#f5c542] bg-white object-contain p-2 shadow-[0_0_60px_rgba(245,197,66,.35)] sm:h-32 sm:w-32" />
        <div key={value} className="countdown-pop mt-8 font-black tabular-nums leading-none text-[#f5c542]" style={{ fontSize: 'clamp(5rem, 18vw, 12rem)', textShadow: '0 0 50px rgba(245,197,66,.32)' }}>
          {value}
        </div>
        <div className="mx-auto mt-8 h-3 w-[min(82vw,700px)] overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-gradient-to-r from-[#ff4500] via-[#f5c542] to-white transition-[width] duration-75" style={{ width: `${(value / COUNTDOWN_MAX) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function ChampionsMatchPresentation({ match }) {
  return (
    <div className="relative grid h-[100dvh] min-h-[520px] place-items-center overflow-hidden bg-[#07112e] px-4 py-3">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#ff4500]/25 blur-[100px]" />
        <div className="absolute -right-24 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#f5c542]/20 blur-[100px]" />
        {STARS.map((star, i) => <span key={i} className="ucl-twinkle absolute rounded-full bg-white" style={{ left: star.left, top: star.top, width: star.s * 2, height: star.s * 2, animationDelay: star.d }} />)}
      </div>

      <div className="relative grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
        <div className="team-enter-left flex min-w-0 flex-col items-center text-center">
          <TeamLogo team={match.home} className="h-[22vh] w-[22vh] max-h-56 max-w-56 min-h-32 min-w-32 border-4 border-[#f5c542]/80 bg-white p-2 shadow-[0_20px_70px_rgba(255,69,0,.45)]" />
          <h2 className="mt-5 max-w-md text-xl font-black uppercase leading-tight text-white sm:text-4xl lg:text-5xl">{match.home.name}</h2>
        </div>

        <div className="flex flex-col items-center">
          <img src={logo} alt="ASYV" className="h-16 w-16 rounded-2xl border-4 border-[#f5c542] bg-white object-contain p-1 shadow-[0_12px_45px_rgba(245,197,66,.45)] sm:h-24 sm:w-24" />
          <span className="mt-3 rounded-full border-2 border-white bg-[#ff4500] px-3 py-2 text-lg font-black text-white sm:px-5 sm:text-2xl">VS</span>
          <span className="mt-4 text-center text-[10px] font-black uppercase tracking-[.24em] text-[#f5c542] sm:text-sm">{match.stage}<br />{match.status}</span>
        </div>

        <div className="team-enter-right flex min-w-0 flex-col items-center text-center">
          <TeamLogo team={match.away} className="h-[22vh] w-[22vh] max-h-56 max-w-56 min-h-32 min-w-32 border-4 border-[#f5c542]/80 bg-white p-2 shadow-[0_20px_70px_rgba(245,197,66,.35)]" />
          <h2 className="mt-5 max-w-md text-xl font-black uppercase leading-tight text-white sm:text-4xl lg:text-5xl">{match.away.name}</h2>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
        <p className="text-xs font-black uppercase tracking-[.28em] text-[#f5c542] sm:text-base">{match.home.name} vs {match.away.name}</p>
      </div>
    </div>
  );
}

function ChampionsLineupPresentation({ match, lineup }) {
  const [visiblePlayers, setVisiblePlayers] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisiblePlayers((count) => Math.min(lineup.length, count + 1));
    }, 900);
    return () => clearInterval(timer);
  }, [lineup.length]);

  return (
    <div className="relative h-[100dvh] min-h-[520px] overflow-hidden bg-[#176a37] px-3 py-2 sm:px-6">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-2 py-2 sm:px-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#f5c542]">Starting eleven</p>
          <h2 className="text-lg font-black uppercase text-white sm:text-3xl">{match.home.name}</h2>
        </div>
        <span className="rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs font-bold text-white">Group stage · Sunday</span>
      </div>

      <div className="lineup-field absolute bottom-0 left-1/2 top-16 w-[min(98vw,1500px)] -translate-x-1/2 overflow-hidden rounded-t-[44px] border-x-4 border-t-4 border-white/60">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/30" />
        <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
        <div className="absolute left-1/2 top-0 h-28 w-56 -translate-x-1/2 border-x-2 border-b-2 border-white/35" />
        <div className="absolute bottom-0 left-1/2 h-28 w-56 -translate-x-1/2 border-x-2 border-t-2 border-white/35" />

        {lineup.slice(0, visiblePlayers).map((player, index) => (
          <div key={`${player.no}-${index}`} className="lineup-player absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: `${player.x}%`, top: `${player.y}%`, animationDelay: '0s' }}>
            <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#f5c542] bg-[#ff4500] text-lg font-black text-white shadow-[0_8px_25px_rgba(0,0,0,.6)] sm:h-16 sm:w-16 sm:text-2xl">{player.no}</span>
            <span className="mt-1 rounded-full bg-[#090604]/90 px-2 py-1 text-[10px] font-black uppercase text-white shadow-lg sm:px-3 sm:text-sm">{player.name}</span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase text-white/75 sm:text-[10px]">{player.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StartupAnnouncements({ onClose, onStopRepeat }) {
  const [phase, setPhase] = useState('countdown');
  const [countdownValue, setCountdownValue] = useState(0);
  const [lostIndex, setLostIndex] = useState(0);
  const [lostLeft, setLostLeft] = useState(LOST_ITEM_SECS);
  const [foundItems, setFoundItems] = useState(null);
  const [foundError, setFoundError] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const loadFoundItems = useCallback(() => api('/api/trends')
    .then((items) => { setFoundItems(items); setFoundError(''); })
    .catch((error) => { setFoundItems([]); setFoundError(error.message); }), []);
  useLive({ 'trends:update': loadFoundItems });

  useEffect(() => { loadFoundItems(); }, [loadFoundItems]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    setCountdownValue(0);
    const started = performance.now();
    const duration = 5000;
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - started;
      const value = Math.min(COUNTDOWN_MAX, Math.floor((elapsed / duration) * COUNTDOWN_MAX));
      setCountdownValue(value);
      if (value >= COUNTDOWN_MAX) {
        window.clearInterval(timer);
        setPhase('lost');
        setLostIndex(0);
        setLostLeft(LOST_ITEM_SECS);
      }
    }, 10);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'lost') return undefined;
    const timer = setTimeout(() => {
      if (lostLeft > 1) setLostLeft((value) => value - 1);
      else if (lostIndex < Math.max(0, (foundItems || []).length - 1)) { setLostIndex((value) => value + 1); setLostLeft(LOST_ITEM_SECS); }
      else setPhase('exit');
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, lostIndex, lostLeft, foundItems]);

  useEffect(() => {
    if (phase !== 'exit') return undefined;
    const timer = setTimeout(() => closeRef.current?.(), 800);
    return () => clearTimeout(timer);
  }, [phase]);

  const postedItems = foundItems || [];
  const currentItem = postedItems[lostIndex];

  return (
    <>
      {phase === 'countdown' ? <CountdownOpening value={countdownValue} /> : (
    <div className={`fixed inset-0 z-[200] overflow-hidden bg-black text-white ${phase === 'exit' ? 'intro-out' : ''}`} role="dialog" aria-modal="true" aria-label="Lost and found announcement">
        <div key={lostIndex} className="lost-fullscreen relative h-[100dvh] overflow-hidden bg-black">
          {currentItem ? (
            <>
              {currentItem.media?.map(itemPhoto).find(Boolean) ? (
                <Photo
                  src={currentItem.media.map(itemPhoto).find(Boolean)}
                  alt={currentItem.title}
                  className="absolute inset-0 h-full w-full object-contain"
                  fallback={<div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#f5c542_0%,#ff4500_25%,#090604_72%)]"><PackageSearch className="h-48 w-48 text-white" aria-hidden="true" /></div>}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#f5c542_0%,#ff4500_25%,#090604_72%)]"><PackageSearch className="h-48 w-48 text-white" aria-hidden="true" /></div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
            </>
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,#16a34a_0%,#08120b_45%,#090604_78%)] text-center">
              <div>
                <PackageSearch className="mx-auto h-32 w-32 text-[#9bf6c5]" aria-hidden="true" />
                <h1 className="mt-6 text-4xl font-black uppercase text-white sm:text-7xl">Nothing posted yet</h1>
                <p className="mt-4 text-lg font-bold text-white/80">Lost &amp; Found</p>
              </div>
            </div>
          )}
        </div>

      <div className="absolute bottom-0 left-0 right-0 z-40 h-1 bg-white/20">
        <span className="announcement-progress block h-full bg-gradient-to-r from-[#f5c542] via-[#ff4500] to-[#16a34a]" style={{ animationDuration: `${LOST_ITEM_SECS}s` }} />
      </div>
    </div>
      )}
    </>
  );
}

function Crest({ team, side }) {
  return (
    <div className="flex w-[34%] flex-col items-center text-center">
      <div className={side === 'left' ? 'ucl-left' : 'ucl-right'}>
        <div className="ucl-bob relative">
          <span className="absolute inset-0 rounded-[22px] blur-xl" style={{ background: 'rgba(255,255,255,.3)' }} aria-hidden="true" />
          <div className="relative grid h-[84px] w-[84px] place-items-center rounded-[22px] border border-white/40 text-3xl font-extrabold shadow-[6px_8px_0_rgba(0,0,0,.35)] sm:h-24 sm:w-24"
            style={{ background: team.bg, color: team.fg }}>
            {team.short}
          </div>
        </div>
      </div>
      <p className="ucl-up mt-3 text-[12px] font-semibold leading-tight sm:text-[13px]" style={{ animationDelay: '.9s' }}>{team.name}</p>
    </div>
  );
}

function ChampionsAnimation({ match, lineup, onClose }) {
  const [step, setStep] = useState('match');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (step === 'match') setStep('lineup');
      else onClose();
    }, step === 'match' ? CHAMPIONS_SECS * 1000 : LINEUP_SECS * 1000);
    return () => window.clearTimeout(timer);
  }, [step, onClose]);
  return (
    <div className="fixed inset-0 z-[200] bg-[#07112e] text-white" role="dialog" aria-modal="true" aria-label="Champions League animation">
      {step === 'match' ? <ChampionsMatchPresentation match={match} /> : <ChampionsLineupPresentation match={match} lineup={lineup} />}
      <button type="button" onClick={onClose} className="absolute right-4 top-4 z-20 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white hover:bg-black/70">Close animation</button>
    </div>
  );
}

function ChampionsAd({ champions }) {
  const { match: m, lineup, active = false } = champions;
  const [run, setRun] = useState(0);
  const [details, setDetails] = useState(false);
  const [playing, setPlaying] = useState(false);
  const closeAnimation = useCallback(() => setPlaying(false), []);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setRun((n) => n + 1), 16000);
    return () => clearInterval(t);
  }, [active]);
  const played = m.score[0] != null && m.score[1] != null;
  const ticker = `${m.league.toUpperCase()}  ★  ${m.category.toUpperCase()}  ·  ${m.stage.toUpperCase()}  ★  ${m.time.toUpperCase()}  ★  ${m.home.name.toUpperCase()} VS ${m.away.name.toUpperCase()}  ★  `;

  return (
    <>
      <div id="champions" className={`ucl-card relative scroll-mt-24 overflow-hidden rounded-2xl shadow-xl ${active ? 'lb-glow' : 'ucl-static'}`} aria-label={`${m.league}: ${m.home.name} against ${m.away.name}`}>
        {/* Stadium atmosphere */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {STARS.map((s, i) => <span key={i} className="ucl-twinkle absolute rounded-full" style={{ background: '#fff', left: s.left, top: s.top, width: s.s, height: s.s, animationDelay: s.d }} />)}
          <span className="ucl-beam absolute -top-4 left-[12%] h-[120%] w-24 blur-md" style={{ background: 'linear-gradient(to bottom,rgba(255,255,255,.25),transparent)' }} />
          <span className="ucl-beam absolute -top-4 right-[12%] h-[120%] w-24 blur-md" style={{ background: 'linear-gradient(to bottom,rgba(255,255,255,.25),transparent)', animationDelay: '-3.5s' }} />
          <svg className="absolute inset-x-0 bottom-0 h-40 w-full opacity-25" viewBox="0 0 400 160" preserveAspectRatio="none">
            <g fill="none" stroke="#fff" strokeWidth="1.5"><circle cx="200" cy="170" r="70" /><path d="M0 120h400M200 100v60" /><rect x="130" y="125" width="140" height="40" /></g>
          </svg>
          {SPARKS.map((s, i) => <span key={i} className="ucl-rise absolute bottom-0 rounded-full" style={{ background: '#f5c542', left: s.left, width: s.s, height: s.s, animationDelay: s.d }} />)}
        </div>

        <div key={run} className="relative flex min-h-[440px] flex-col justify-between p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <span className="ucl-pop inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide"
              style={{ animationDelay: '.1s', color: '#f5c542', borderColor: 'rgba(245,197,66,.5)', background: 'rgba(245,197,66,.15)' }}>
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />{m.league.toUpperCase()}
            </span>
            <span className="ucl-pop ucl-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ animationDelay: '.25s' }}>
              <UclBall size={14} />{m.stage}
            </span>
          </div>

          <div className="mt-3 text-center">
            <span className="ucl-pop ucl-white relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ animationDelay: '.4s' }}>
              <span className="relative flex h-2 w-2"><span className="ucl-ring absolute inset-0 rounded-full" style={{ background: '#ff4500' }} /><span className="relative h-2 w-2 rounded-full" style={{ background: '#ff4500' }} /></span>
              {m.status.toUpperCase()}
            </span>
          </div>

          {/* The two teams with the ball in between */}
          <div className="flex items-start justify-between gap-2 py-4">
            <Crest team={m.home} side="left" />

            <div className="relative flex w-[32%] flex-col items-center pt-1">
              <div className="ucl-drop relative flex h-[78px] w-full items-end justify-center">
                <div className="ucl-roll absolute bottom-3">
                  <div className="ucl-hop"><div className="ucl-spin"><UclBall size={46} /></div></div>
                </div>
                <span className="ucl-shadow absolute bottom-0 h-2 w-12 rounded-full blur-[2px]" style={{ background: 'rgba(0,0,0,.6)' }} />
              </div>
              <div className="ucl-pop mt-1 flex items-center gap-2 text-3xl font-black" style={{ animationDelay: '1.2s' }}>
                <span className="inline-block min-w-[30px] text-center">{played ? m.score[0] : <i className="mx-auto block h-[5px] w-7 rounded" style={{ background: '#fff' }} />}</span>
                <span className="text-lg" style={{ color: 'rgba(255,255,255,.5)' }}>:</span>
                <span className="inline-block min-w-[30px] text-center">{played ? m.score[1] : <i className="mx-auto block h-[5px] w-7 rounded" style={{ background: '#fff' }} />}</span>
              </div>
              <span className="ucl-pop mt-2 inline-block bg-gradient-to-b from-[#f5c542] to-[#ff8a00] bg-clip-text text-xl font-black italic tracking-widest text-transparent" style={{ animationDelay: '1.35s' }}>VS</span>
            </div>

            <Crest team={m.away} side="right" />
          </div>

          <p className="ucl-up text-center text-xs" style={{ animationDelay: '1.5s', color: 'rgba(255,255,255,.75)' }}>{m.category} <span className="mx-1 opacity-50">·</span> {m.stage}</p>

          {/* Ticker */}
          <div className="mt-3 overflow-hidden rounded-full py-1.5 text-[10px] font-bold tracking-[.2em]" style={{ background: 'rgba(0,0,0,.3)', color: 'rgba(255,255,255,.7)' }} aria-hidden="true">
            <div className="ucl-marquee"><span className="whitespace-pre pr-2">{ticker}{ticker}</span><span className="whitespace-pre pr-2">{ticker}{ticker}</span></div>
          </div>

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs" style={{ borderColor: 'rgba(255,255,255,.15)' }}>
            <span style={{ color: 'rgba(255,255,255,.75)' }}>{m.time}</span>
            <span className="flex items-center gap-2">
              {active && <button type="button" onClick={() => setRun((n) => n + 1)} className="ucl-glass rounded-full px-3 py-1.5 font-semibold">Replay</button>}
              {active && <button type="button" onClick={() => setPlaying(true)} className="ucl-glass rounded-full px-3 py-1.5 font-semibold">Watch animation</button>}
              <button type="button" onClick={() => setDetails(true)} className="ucl-gold inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-bold hover:brightness-110">
                Match details<span aria-hidden="true">↗</span>
              </button>
            </span>
          </div>
        </div>
      </div>

      {details && (
        <Modal title={`${m.league} · Match details`} onClose={() => setDetails(false)}>
          <div className="flex items-center justify-between gap-3">
            {[m.home, m.away].map((t) => (
              <div key={t.short} className="flex flex-1 flex-col items-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-[16px] text-xl font-extrabold" style={{ background: t.bg, color: t.fg }}>{t.short}</div>
                <b className="mt-2 text-xs">{t.name}</b>
              </div>
            ))}
          </div>
          <dl className="mt-5 divide-y divide-black/10 text-xs">
            {[['Competition', m.league], ['Category', m.category], ['Stage', m.stage], ['Status', m.status], ['Time', m.time], ['Venue', m.venue]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-black/50">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-5"><Btn onClick={() => setDetails(false)}>Close</Btn></div>
        </Modal>
      )}
      {active && playing && <ChampionsAnimation match={m} lineup={lineup} onClose={closeAnimation} />}
    </>
  );
}

function ChampionsManager({ champions, onSaved }) {
  const [config, setConfig] = useState(champions || DEFAULT_CHAMPIONS);
  const { busy, act, note } = useAct();
  const setMatch = (key, value) => setConfig((cur) => ({ ...cur, match: { ...cur.match, [key]: value } }));
  const setTeam = (side, key, value) => setConfig((cur) => ({
    ...cur,
    match: { ...cur.match, [side]: { ...cur.match[side], [key]: value } },
  }));
  const setPlayer = (index, key, value) => setConfig((cur) => ({
    ...cur,
    lineup: cur.lineup.map((player, i) => i === index ? { ...player, [key]: value } : player),
  }));
  const save = () => act('champions', async () => {
    const saved = await api('/api/champions', 'PUT', config);
    setConfig(saved);
    onSaved(saved);
    return saved;
  }, config.published ? (config.active ? 'Animation started and published to the front page.' : 'Match card published with animation stopped.') : 'Animation saved as a draft.');

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Champions League animation" sub="Edit the match and lineup, preview the animation, then publish it to the front page when it is ready.">
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-[8px] border border-black/10 p-4 text-xs font-semibold">
            <input type="checkbox" checked={config.published} onChange={(e) => setConfig((cur) => ({ ...cur, published: e.target.checked }))} className="h-4 w-4 accent-[#16a34a]" />
            Show match card on the front page
          </label>
          <label className="flex items-center gap-3 rounded-[8px] border border-black/10 p-4 text-xs font-semibold">
            <input type="checkbox" checked={config.active} onChange={(e) => setConfig((cur) => ({ ...cur, active: e.target.checked }))} disabled={!config.published} className="h-4 w-4 accent-[#16a34a] disabled:opacity-40" />
            Run animation on the front page
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field l="Competition"><Inp value={config.match.league} maxLength={80} onChange={(e) => setMatch('league', e.target.value)} /></Field>
          <Field l="Stage"><Inp value={config.match.stage} maxLength={50} onChange={(e) => setMatch('stage', e.target.value)} /></Field>
          <Field l="Category"><Inp value={config.match.category} maxLength={40} onChange={(e) => setMatch('category', e.target.value)} /></Field>
          <Field l="Status"><Inp value={config.match.status} maxLength={40} onChange={(e) => setMatch('status', e.target.value)} /></Field>
          <Field l="Time"><Inp value={config.match.time} maxLength={80} onChange={(e) => setMatch('time', e.target.value)} /></Field>
          <Field l="Venue"><Inp value={config.match.venue} maxLength={100} onChange={(e) => setMatch('venue', e.target.value)} /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {['home', 'away'].map((side) => {
            const team = config.match[side];
            return (
              <section key={side} className="space-y-3 rounded-[8px] border border-black/10 p-4">
                <h4 className="text-xs font-bold">{side === 'home' ? 'Home team' : 'Away team'}</h4>
                <Field l="Team name"><Inp value={team.name} maxLength={80} onChange={(e) => setTeam(side, 'name', e.target.value)} /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field l="Short name"><Inp value={team.short} maxLength={5} onChange={(e) => setTeam(side, 'short', e.target.value)} /></Field>
                  <Field l="Background"><Inp type="color" value={team.bg} onChange={(e) => setTeam(side, 'bg', e.target.value)} /></Field>
                  <Field l="Text color"><Inp type="color" value={team.fg} onChange={(e) => setTeam(side, 'fg', e.target.value)} /></Field>
                </div>
                <Field l="Logo image URL"><Inp type="url" value={team.image} maxLength={2048} onChange={(e) => setTeam(side, 'image', e.target.value)} placeholder="https://…" /></Field>
                {side === 'home' && <Field l="Fallback logo image URL"><Inp type="url" value={team.imageAlt} maxLength={2048} onChange={(e) => setTeam(side, 'imageAlt', e.target.value)} placeholder="Optional" /></Field>}
              </section>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field l="Home score"><Inp type="number" min="0" max="99" value={config.match.score[0] ?? ''} onChange={(e) => setMatch('score', [e.target.value === '' ? null : Number(e.target.value), config.match.score[1]])} /></Field>
          <Field l="Away score"><Inp type="number" min="0" max="99" value={config.match.score[1] ?? ''} onChange={(e) => setMatch('score', [config.match.score[0], e.target.value === '' ? null : Number(e.target.value)])} /></Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ActBtn busy={busy === 'champions'} doing="Saving…" label="Save animation" onClick={save} />
          <span className="text-xs text-black/50">{config.published ? (config.active ? 'Animation running on the front page' : 'Published as a static match card — animation stopped') : 'Draft — not visible to the public'}</span>
        </div>
      </Card>

      <Card t="Starting lineup" sub="Add up to eleven players. Field positions use percentages from 0 to 100.">
        <div className="space-y-3">
          {config.lineup.map((player, index) => (
            <div key={`${index}-${player.no}`} className="grid gap-3 rounded-[8px] border border-black/10 p-3 sm:grid-cols-[1.4fr_.6fr_1fr_.7fr_.7fr_auto]">
              <Field l="Player"><Inp value={player.name} maxLength={80} onChange={(e) => setPlayer(index, 'name', e.target.value)} /></Field>
              <Field l="Number"><Inp type="number" min="0" max="99" value={player.no} onChange={(e) => setPlayer(index, 'no', Number(e.target.value))} /></Field>
              <Field l="Position"><Inp value={player.role} maxLength={40} onChange={(e) => setPlayer(index, 'role', e.target.value)} /></Field>
              <Field l="Field X"><Inp type="number" min="0" max="100" value={player.x} onChange={(e) => setPlayer(index, 'x', Number(e.target.value))} /></Field>
              <Field l="Field Y"><Inp type="number" min="0" max="100" value={player.y} onChange={(e) => setPlayer(index, 'y', Number(e.target.value))} /></Field>
              <button type="button" onClick={() => setConfig((cur) => ({ ...cur, lineup: cur.lineup.filter((_, i) => i !== index) }))} aria-label={`Remove ${player.name}`} className="self-end rounded-[6px] border border-black/15 px-3 py-2 text-xs hover:bg-black/5">Remove</button>
            </div>
          ))}
        </div>
        <Btn className="mt-4" c="w" disabled={config.lineup.length >= 11} onClick={() => setConfig((cur) => ({
          ...cur,
          lineup: [...cur.lineup, { name: '', no: cur.lineup.length + 1, x: 50, y: 50, role: '' }],
        }))}>Add player</Btn>
      </Card>

      <Card t="Preview" sub="This preview uses your current edits. Save the animation to make those edits public.">
        <ChampionsAd champions={config} />
      </Card>
    </div>
  );
}

/* ================================================================== */
/* ADVANCED NAVBAR: shrinks on scroll, progress line, active section,  */
/* smooth scroll and mobile menu                                        */
/* ================================================================== */

const NAV_LINKS = [
  ['top', 'Home', Sun],
  ['labs', 'Labs', FlaskConical],
  ['live-dashboard', 'Live dashboard', LayoutDashboard],
  ['trends', 'Lost and found', PackageSearch],
];

function LandingNav({ onLogin, dark, onToggleDark }) {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 8);
      setProgress(max > 0 ? Math.min(100, (y / max) * 100) : 0);
      let cur = '';
      NAV_LINKS.forEach(([id]) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 140) cur = id; });
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const go = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const top = (e) => { e.preventDefault(); setOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <header className={`landing-nav sticky top-0 z-30 border-b backdrop-blur-md transition-all duration-300 ${scrolled ? 'shadow-md' : ''}`}>
      <div className={`mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 transition-all duration-300 sm:gap-4 sm:px-6 ${scrolled ? 'h-14' : 'h-[76px]'}`}>
        <a className="min-w-max" href="#top" onClick={top} aria-label="Back to top"><Logo /></a>

        <nav className="landing-menu hidden justify-self-center items-center gap-0.5 rounded-full p-1 text-[11px] font-medium md:flex" aria-label="Sections">
          {NAV_LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={go(id)} aria-current={active === id ? 'true' : undefined}
              className={`nav-link inline-flex items-center gap-1.5 rounded-full px-3 py-2 transition-colors ${active === id ? 'bg-[#b8f1e8] text-[#087f72]' : 'text-black/70 hover:bg-black/5'}`}>
              {label}
            </a>
          ))}
        </nav>

        <div className="flex justify-self-end items-center gap-2">
          <ThemeBtn dark={dark} onToggle={onToggleDark} />
          <Btn className="hidden !rounded-full !border-transparent !bg-[#16b5a2] !px-4 !text-white sm:inline-flex" onClick={() => onLogin()}>Log in</Btn>
          <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/15 bg-white text-[#111827] hover:bg-black/5 md:hidden">
            {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`grid overflow-hidden transition-all duration-300 md:hidden ${open ? 'grid-rows-[1fr] border-t border-black/10' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <nav className="space-y-1 p-4" aria-label="Sections mobile">
            {NAV_LINKS.map(([id, label, Icon]) => (
              <a key={id} href={`#${id}`} onClick={go(id)}
                className={`flex items-center gap-3 rounded-[8px] px-3 py-3 text-sm font-semibold ${active === id ? 'bg-[#16b5a2] text-white' : 'text-black/75 hover:bg-black/5'}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />{label}
              </a>
            ))}
            <Btn className="mt-2 w-full !py-3" onClick={() => { setOpen(false); onLogin(); }}>Log in with Google</Btn>
          </nav>
        </div>
      </div>

      {/* Reading progress */}
      <span className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-[#16b5a2] via-[#6edfd0] to-[#16b5a2] transition-[width] duration-150" style={{ width: `${progress}%` }} aria-hidden="true" />
    </header>
  );
}

function Landing({ onLogin, dark, onToggleDark, champions }) {
  return (
    <div id="top" className="landing-shell min-h-screen text-sm antialiased">
      <LandingNav onLogin={onLogin} dark={dark} onToggleDark={onToggleDark} />
      <main>
        <section className="landing-hero">
          <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-12 text-center sm:px-7 sm:pb-16 sm:pt-16 md:pb-20 md:pt-20">
            <div className="landing-ocean" aria-hidden="true">
              <span className="landing-wave landing-wave-one" />
              <span className="landing-wave landing-wave-two" />
              <span className="landing-wave landing-wave-three" />
            </div>
            <div className="lb-in relative z-10 mx-auto max-w-4xl">
              <div className="landing-app-orbit mb-5" role="img" aria-label="Asyv LabBook app icon surrounded by lab, schedule, and student tools">
                <span className="landing-app-orbit-ring" />
                <span className="landing-app-center"><img src={logo} alt="" /></span>
                <span className="landing-app-orb landing-app-orb-one"><FlaskConical aria-hidden="true" /></span>
                <span className="landing-app-orb landing-app-orb-two"><CalendarDays aria-hidden="true" /></span>
                <span className="landing-app-orb landing-app-orb-three"><UsersRound aria-hidden="true" /></span>
                <span className="landing-app-orb landing-app-orb-four"><PackageSearch aria-hidden="true" /></span>
              </div>
              <h1 className="landing-hero-title mx-auto mt-6 max-w-4xl text-[2.45rem] font-semibold leading-[1.08] sm:text-5xl md:text-6xl lg:text-[4.25rem]">
                One place for your <span className="text-[#4ade80]">lab bookings</span> and <span className="text-[#ff8060]">more.</span>
              </h1>
              <p className="landing-hero-copy mx-auto mt-5 max-w-2xl text-sm leading-7 sm:text-base">
                Check live computer lab availability, book a time before you arrive, and stay connected to your campus community—all in one simple place.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <a href="#labs" onClick={(e) => { e.preventDefault(); document.getElementById('labs')?.scrollIntoView({ behavior: 'smooth' }); }} className="landing-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-semibold text-white">
                  Get started — browse labs <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Btn c="w" className="!rounded-full !px-5 !py-3" onClick={() => onLogin()}>Log in with Google</Btn>
              </div>
            </div>
          </div>
        </section>
        {champions?.published && (
          <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-7 sm:pt-14" aria-label="Champions League">
            <ChampionsAd champions={champions} />
          </section>
        )}
        <section id="live-dashboard" className="landing-dashboard-stage scroll-mt-24" aria-label="Live lab dashboard preview">
          <div className="landing-dashboard">
            <div className="landing-dashboard-top">
              <div className="flex items-center gap-3">
                <span className="flex gap-1.5" aria-hidden="true"><i className="h-2.5 w-2.5 rounded-full bg-[#ff8175]" /><i className="h-2.5 w-2.5 rounded-full bg-[#f7c95c]" /><i className="h-2.5 w-2.5 rounded-full bg-[#59c99b]" /></span>
                <span className="hidden h-5 w-px bg-black/10 sm:block" />
                <span className="landing-dashboard-brand text-[10px] font-bold tracking-[.13em] sm:text-[11px]">ASYV <span className="text-[#16b5a2]">/</span> LAB OVERVIEW</span>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f8f4] px-3 py-1.5 text-[10px] font-semibold text-[#108f80]"><span className="lb-pulse h-1.5 w-1.5 rounded-full bg-[#16b5a2]" />Live dashboard</span>
            </div>
            <div className="landing-dashboard-body">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-base font-semibold tracking-tight sm:text-lg">Your lab, at a glance</h2><p className="landing-dashboard-muted mt-1 text-[11px]">Live availability and schedules, all in one view.</p></div>
                <a href="#labs" onClick={(e) => { e.preventDefault(); document.getElementById('labs')?.scrollIntoView({ behavior: 'smooth' }); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#119e8f]">View all labs <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
              </div>
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <div className="landing-dashboard-card flex items-center gap-3 rounded-xl p-3"><span className="landing-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span><span><b className="block text-[11px]">Lab schedules</b><span className="landing-dashboard-muted text-[10px]">Plan your next visit</span></span></div>
                <div className="landing-dashboard-card flex items-center gap-3 rounded-xl p-3"><span className="landing-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg"><Radio className="h-4 w-4" aria-hidden="true" /></span><span><b className="block text-[11px]">Live places</b><span className="landing-dashboard-muted text-[10px]">Availability updates live</span></span></div>
                <div className="landing-dashboard-card flex items-center gap-3 rounded-xl p-3"><span className="landing-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg"><PackageSearch className="h-4 w-4" aria-hidden="true" /></span><span><b className="block text-[11px]">Campus community</b><span className="landing-dashboard-muted text-[10px]">Lost and found board</span></span></div>
              </div>
              <LiveLabs />
            </div>
          </div>
        </section>
        <section className="landing-trust px-5 py-7 sm:px-7 sm:py-9">
          <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3 sm:gap-4">
            <article className="landing-trust-card flex items-start gap-3 rounded-xl p-4 sm:p-5">
              <span className="landing-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="text-xs font-bold">Choose a time that works</h2><p className="mt-1 text-[11px] leading-5 text-black/55">Browse lab schedules and available places before you arrive.</p></div>
            </article>
            <article className="landing-trust-card flex items-start gap-3 rounded-xl p-4 sm:p-5">
              <span className="landing-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Radio className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="text-xs font-bold">See live availability</h2><p className="mt-1 text-[11px] leading-5 text-black/55">Places update as applications come in, so you can plan with confidence.</p></div>
            </article>
            <article className="landing-trust-card flex items-start gap-3 rounded-xl p-4 sm:p-5">
              <span className="landing-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><PackageSearch className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="text-xs font-bold">Reconnect with lost items</h2><p className="mt-1 text-[11px] leading-5 text-black/55">Explore the community lost-and-found board, all in one place.</p></div>
            </article>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-7 sm:py-14" aria-label="Learning spotlight">
          <div className="learning-spotlight grid overflow-hidden rounded-[22px] shadow-[0_24px_70px_rgba(14,32,49,.16)] md:grid-cols-[1.05fr_.95fr]">
            <div className="relative min-h-[230px] md:min-h-[320px]">
              <img src={lab22} alt="Students sharing ideas and learning together" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10141b]/65 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#10141b]/35" />
              <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-[#223b39]">LEARNING SPOTLIGHT</span>
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7de2d1]">Make your next session count</span>
              <h2 className="mt-3 max-w-md text-2xl font-semibold leading-tight sm:text-3xl">A space for every skill you’re building.</h2>
              <p className="mt-3 max-w-lg text-xs leading-6 text-white/70">From coding practice to creative projects and research, the computer lab gives you room to explore, learn, and make progress.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['Coding & digital skills', 'Creative projects', 'Research & study'].map((topic) => <span key={topic} className="learning-chip rounded-full px-3 py-1.5 text-[10px] font-medium">{topic}</span>)}
              </div>
              <a href="#labs" onClick={(e) => { e.preventDefault(); document.getElementById('labs')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[11px] font-semibold text-[#1c3938] transition hover:bg-[#dff8f3]">Find your learning space <ChevronRight className="h-4 w-4" aria-hidden="true" /></a>
            </div>
          </div>
        </section>
        <section id="labs" className="landing-section mx-auto max-w-6xl px-5 py-14 sm:px-7 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#119e8f]">Find your place</span>
              <h2 className="landing-section-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Labs and free places</h2>
              <p className="landing-section-copy mt-2 max-w-xl text-xs leading-6">The border of each lab time fills as places are taken. A red border with the word Closed means the lab time is over and nobody can apply.</p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-[10px] font-semibold text-black/55 sm:inline-flex"><span className="h-2 w-2 rounded-full bg-[#16b5a2]" />Updated live</span>
          </div>
          <LabBoard onLogin={onLogin} />
        </section>
        <div className="landing-section"><TrendsBoard /></div>
      </main>
      <footer className="landing-footer text-xs">
        <div className="landing-footer-inner mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-7 sm:py-9">
          <Logo />
          <span>© 2026 Computer Lab Management System</span>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* 4. SIGN IN (Google only): moving pictures on one side, form on the other */
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

// Pictures that fade into each other, slowly zooming. Used on the sign-in page.
function Slideshow({ className = '' }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % LOGIN_SLIDES.length), 4500); return () => clearInterval(t); }, []);
  return (
    <div className={`relative overflow-hidden bg-[#e8f5ec] ${className}`}>
      {LOGIN_SLIDES.map((s, k) => (
        <div key={s.id} className="absolute inset-0 transition-opacity duration-[1400ms]" style={{ opacity: k === i ? 1 : 0 }} aria-hidden={k !== i}>
          <img src={s.id} alt="" className={`h-full w-full object-cover ${k === i ? 'lb-zoom' : ''}`} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#000000]/85 via-[#000000]/10 to-[#000000]/20" />
      <div className="absolute bottom-6 left-6 right-6 text-white">
        <div key={i} className="lb-rise">
          <p className="text-xl font-bold md:text-2xl">{LOGIN_SLIDES[i].t}</p>
          <p className="mt-1.5 text-xs text-white/80 md:text-sm">{LOGIN_SLIDES[i].s}</p>
        </div>
        <div className="mt-4 flex gap-1.5">
          {LOGIN_SLIDES.map((s, k) => <span key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />)}
        </div>
      </div>
    </div>
  );
}

function Auth({ onDone, onBack, intent, dark, onToggleDark }) {
  const [err, setErr] = useState('');
  const [signing, setSigning] = useState(false);
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const finish = async (t) => {
    setSigning(true);
    try { await onDone(t); } catch (e) { setSigning(false); setErr(e.message); }
  };
  return (
    <div className="fixed inset-0 grid place-items-center overflow-y-auto bg-[#f7f8f7] p-4 text-[13px] text-[#111827] sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl md:grid-cols-2">
        <Slideshow className="h-44 md:h-auto md:min-h-[600px]" />
        <div className="w-full p-7 md:py-12 md:px-10">
          <div className="mb-8 flex items-center justify-between">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563eb] hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to home</button>
            <ThemeBtn dark={dark} onToggle={onToggleDark} />
          </div>
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
  const [labPhoto, setLabPhoto] = useState(null);
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState(() => pickBookableDay(intent?.date || today()));
  const [sessions, setSessions] = useState([]);
  const [apps, setApps] = useState([]);
  const [labsList, setLabsList] = useState([]);
  const [reason, setReason] = useState(opts.reasons?.[0] || '');
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [src, setSrc] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [sid, setSid] = useState('');
  const [resultNotice, setResultNotice] = useState(null);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const { busy, run } = useBusy();
  const sent = useRef(false);

  const loadSessions = () => {
    api('/api/labs').then(setLabsList).catch(() => {});
    return api('/api/sessions').then(setSessions).catch((e) => setResultNotice({ lab: 'Lab times', count: 0, message: e.message, ok: false }));
  };
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
    api(url).then(setStudents).catch((e) => setResultNotice({ lab: 'Students', count: 0, message: e.message, ok: false }));
  }, [src]);

  // Sends bookings for one lab time. Used by Apply buttons and by teachers' bulk booking.
  const sendBooking = async (id, names = null) => {
    setResultNotice(null);
    try {
      const body = names ? { sessionId: id, reason, students: names } : { sessionId: id, reason };
      const r = await api('/api/apply', 'POST', body);
      const parts = [`${r.created} booking${r.created === 1 ? '' : 's'} sent`];
      if (r.approved) parts.push(`${r.approved} approved at once`);
      if (r.queued) parts.push(`${r.queued} in the waiting list`);
      if (r.skipped?.length) parts.push(`already booked: ${r.skipped.join(', ')}`);
      if (r.tooMany?.length) parts.push(`too many days in a row: ${r.tooMany.join(', ')}`);
      if (r.appliedByTeacher?.length) {
        parts.push(`A teacher has already applied for ${r.appliedByTeacher.join(', ')} for an overlapping lab time`);
      }
      if (r.created === 0 && !r.skipped?.length && !r.tooMany?.length) parts.push('No bookings were created');
      const partial = !!(r.skipped?.length || r.tooMany?.length);
      const session = sessions.find((s) => s.id === id);
      setResultNotice({
        lab: session?.lab || intent?.lab || 'Booking',
        labId: session?.labId,
        count: r.approved,
        message: parts.join(' · ') + '.',
        ok: r.created > 0 && !partial,
        partial,
      });
      setPicked([]);
      await loadApps();
      return true;
    } catch (e) {
      setResultNotice({ lab: 'Booking', count: 0, message: e.message, ok: false });
      return false;
    }
  };
  const apply = (id) => {
    if (isStudent && apps.some((a) => a.date === sessions.find((s) => s.id === id)?.date && a.name === user.name && a.status !== 'rejected')) return;
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setBookingConfirmation({ sessionId: id, lab: session.lab, date: session.date, from: session.from, to: session.to });
  };
  const bookStudents = () => {
    const session = sessions.find((s) => s.id === +sid);
    if (!session || !picked.length) return;
    setBookingConfirmation({
      sessionId: session.id,
      lab: session.lab,
      date: session.date,
      from: session.from,
      to: session.to,
      students: picked,
    });
  };

  // Ask the signed-in student to confirm a lab time chosen on the home page.
  useEffect(() => {
    if (!ready || !intent || sent.current || !isStudent) return;
    sent.current = true;
    setBookingConfirmation({
      sessionId: intent.sessionId,
      lab: intent.lab,
      date: intent.date,
      from: intent.from,
      to: intent.to,
      fromIntent: true,
    });
  }, [ready]);

  const checkIn = (id) => run('ci' + id, async () => {
    try {
      const r = await api(`/api/apps/${id}/checkin`, 'POST');
      setResultNotice({ lab: 'Check-in', count: 1, message: r.late ? 'You are checked in. You were marked late.' : 'You are checked in. Thank you!', ok: true });
      await loadApps();
    } catch (e) { setResultNotice({ lab: 'Check-in', count: 0, message: e.message, ok: false }); }
  });

  if (!ready) return <Loader full label="Loading" />;

  const todayStr = today();
  const dayLabs = sessions.filter((s) => s.date === day);
  const mine = (id) => apps.find((a) => a.sid === id && a.status !== 'rejected');
  const myApps = apps.filter((a) => a.name === user.name || a.bookedBy === user.name).sort((a, b) => `${b.date} ${b.from}`.localeCompare(`${a.date} ${a.from}`));
  const hasAppliedToday = isStudent && myApps.some((a) => a.date === day && a.status !== 'rejected');
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const imgOf = (labId) => labsList.find((x) => x.id === labId)?.image || '';
  const count = (k) => myApps.filter((a) => a.status === k).length;
  const srcOpts = [
    { value: '', label: 'Choose a class or group…' },
    ...classes.map((c) => ({ value: `c:${c}`, label: c })),
    ...groups.map((g) => ({ value: `g:${g.id}`, label: `Group: ${g.name}` })),
  ];
  const reasonOpts = (opts.reasons || []).map((r) => ({ value: r, label: r }));

  return (
    <div className="space-y-6">
      {resultNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="booking-result-title">
          <div className={`w-full max-w-md rounded-2xl border px-6 py-7 text-center text-slate-900 shadow-2xl ${resultNotice.ok ? 'border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-green-100' : 'border-red-200 bg-gradient-to-br from-white via-red-50 to-rose-100'}`}>
            <div className="mb-4 flex items-center justify-center gap-3">
              <img src={logo} alt="System logo" className="h-10 w-10 rounded-lg object-contain" />
              {resultNotice.labId && <img src={imgOf(resultNotice.labId)} alt={`${resultNotice.lab} lab`} className="h-10 w-14 rounded-lg object-cover" />}
            </div>
            <div className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-2xl font-bold text-white shadow-md ${resultNotice.ok ? 'bg-emerald-600' : 'bg-red-600'}`} aria-hidden="true">{resultNotice.ok ? '✓' : '!'}</div>
            <p className={`text-xs font-bold uppercase tracking-[0.18em] ${resultNotice.ok ? 'text-emerald-700' : 'text-red-700'}`}>{resultNotice.lab}</p>
            <h2 id="booking-result-title" className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-900">
              {!resultNotice.ok ? 'Could not complete booking' : resultNotice.partial ? 'Booking partly completed' : resultNotice.count ? 'Congratulations!' : 'Booking update'}
            </h2>
            <p className="mx-auto mt-3 whitespace-pre-line text-base leading-relaxed text-slate-700">{resultNotice.message || <>Welcome to <strong className="text-emerald-800">{resultNotice.lab}</strong>! Your booking has been approved.</>}</p>
            <button type="button" autoFocus onClick={() => setResultNotice(null)} className={`mt-5 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${resultNotice.ok ? 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-500' : 'bg-red-700 hover:bg-red-800 focus:ring-red-500'}`}>Continue</button>
          </div>
        </div>
      )}
      {bookingConfirmation && <Modal title="Confirm your lab booking" onClose={() => {
        setBookingConfirmation(null);
        if (bookingConfirmation.fromIntent) onIntentDone?.();
      }}>
        <p className="text-sm leading-relaxed">
          {bookingConfirmation.students?.length
            ? `Book ${bookingConfirmation.students.length} student${bookingConfirmation.students.length === 1 ? '' : 's'} in `
            : 'Apply for '}
          <b>{bookingConfirmation.lab}</b> on <b>{niceDay(bookingConfirmation.date)}</b>, {bookingConfirmation.from}–{bookingConfirmation.to}?
          {bookingConfirmation.students?.length > 0 && <span className="mt-2 block text-black/60">{bookingConfirmation.students.join(', ')}</span>}
          <span className="mt-2 block">Reason: <b>{reason}</b>.</span>
        </p>
        <div className="mt-5 flex gap-2">
          <Btn onClick={() => {
            const confirmation = bookingConfirmation;
            setBookingConfirmation(null);
            run('a' + confirmation.sessionId, () => sendBooking(confirmation.sessionId, confirmation.students))
              .finally(() => { if (confirmation.fromIntent) onIntentDone?.(); });
          }}>Confirm and apply</Btn>
          <Btn c="w" onClick={() => {
            const fromIntent = bookingConfirmation.fromIntent;
            setBookingConfirmation(null);
            if (fromIntent) onIntentDone?.();
          }}>Cancel</Btn>
        </div>
      </Modal>}
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
        {hasAppliedToday ? <Alert ok>You have already applied for a lab on this day. Your booking is shown below.</Alert> : null}
        {!hasAppliedToday && dayLabs.length === 0 && <Empty>No lab time on this day. Try another day.</Empty>}
        {!hasAppliedToday && dayLabs.map((s) => {
          const m = mine(s.id);
          const alreadyBookedToday = isStudent && myApps.some((a) => a.date === s.date && a.status !== 'rejected');
          const pct = s.seats ? ((s.seats - s.left) / s.seats) * 100 : 100;
          const past = s.date < todayStr || s.state === 'over';
          return (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 py-4">
              <button type="button" aria-label={`View ${s.lab} photo`} onClick={() => setLabPhoto({ name: s.lab, id: s.labId ?? s.id, image: imgOf(s.labId) })}
                className="h-20 w-full overflow-hidden rounded-[8px] border border-black/10 sm:w-36">
                <LabImg lab={{ name: s.lab, id: s.labId ?? s.id, image: imgOf(s.labId) }} index={s.id} className="h-full w-full object-cover transition-transform hover:scale-105" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{s.lab}</b>
                  <span className="text-black/60">{s.from}–{s.to}</span>
                  {forLabel(s) && <Badge s="draft">{audText(s)}</Badge>}
                  {past && <Badge s="over">Closed</Badge>}
                </div>
                <div className="mt-3 h-5 w-full max-w-md overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label={`${s.seats - s.left} of ${s.seats} places taken`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                  <div className={`flex h-full items-center justify-end rounded-full px-2 text-[10px] font-bold text-white transition-[width] duration-700 ${past ? 'bg-[#dc2626]' : s.left > 0 ? 'bg-[#16a34a]' : 'bg-[#ff4500]'}`} style={{ width: `${Math.max(pct, 8)}%` }}>{Math.round(pct)}%</div>
                </div>
                <div className={`mt-1.5 text-xs ${past ? 'font-bold text-[#dc2626]' : s.left > 0 ? 'font-medium text-[#15803d]' : 'font-bold text-[#c2310a]'}`}>
                  {past ? 'This lab time is over' : s.left > 0 ? `${s.left} of ${s.seats} places left` : 'Full'}
                </div>
              </div>
              {m ? <Badge s={statusKey(m, s)}>{STATUS_LABEL[statusKey(m, s)]}</Badge> : (
                <ActBtn c="ink" busy={busy === 'a' + s.id} doing="Sending…" label={past ? 'Closed' : s.left < 1 ? 'Full' : 'Apply'}
                  disabled={past || s.exclusive || alreadyBookedToday || s.left < 1} onClick={() => apply(s.id)} />
              )}
            </div>
          );
        })}
      </Card>

      {labPhoto && <Modal title={`${labPhoto.name} · lab photo`} onClose={() => setLabPhoto(null)} wide>
        <LabImg lab={labPhoto} index={labPhoto.id} w={1400} className="max-h-[70vh] w-full rounded-[8px] object-contain" />
        <p className="mt-3 text-xs text-black/55">Review the lab photo before applying.</p>
      </Modal>}

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
/* 6. ADMIN: Overview, History, Labs, Schedule, People, Chat, Settings */
/* ================================================================== */

const ACT_FILTERS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['date', 'Pick a day']];

function OverviewPeopleSearch() {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [resultsFor, setResultsFor] = useState('');
  const [person, setPerson] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const term = query.trim();

  useEffect(() => {
    let cancelled = false;
    if (term.length < 2) return undefined;
    const timer = window.setTimeout(() => {
      api(`/api/people/lookup?q=${encodeURIComponent(term)}`)
        .then((result) => {
          if (!cancelled) {
            setPeople(result.people);
            setResultsFor(term);
            setError('');
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setPeople([]);
            setResultsFor(term);
            setError(e.message);
          }
        });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [term]);
  const searching = term.length >= 2 && resultsFor !== term;
  const changeQuery = (value) => {
    setQuery(value);
    setPerson(null);
    setBookings([]);
    setError('');
    setDetailError('');
  };

  const openPerson = async (id) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const result = await api(`/api/people/lookup?id=${id}`);
      setPerson(result.person);
      setBookings(result.bookings);
    } catch (e) {
      setDetailError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  const currentBooking = bookings.find((booking) => booking.date === today()
    && booking.status === 'approved' && booking.from <= time && booking.to > time);
  const recentBooking = bookings.find((booking) => booking.status === 'approved'
    && (booking.date < today() || (booking.date === today() && booking.to <= time)));
  const upcomingBooking = bookings.find((booking) => booking.status === 'approved'
    && (booking.date > today() || (booking.date === today() && booking.from > time)));
  const locationBooking = currentBooking || recentBooking || upcomingBooking;

  return (
    <Card t="Find a person" sub="Search an account to see their profile and current or recent scheduled lab bookings.">
      <SearchBox value={query} onChange={changeQuery} placeholder="Search by name, email, phone or class" />
      <p className="mt-2 text-[11px] text-black/50">Admin-only. Lab bookings show scheduled locations, not live physical location.</p>
      {term.length > 0 && term.length < 2 && <p className="mt-3 text-xs text-black/50">Enter at least 2 characters to search.</p>}
      {searching && <Loader label="Searching accounts" />}
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      {term.length >= 2 && !searching && !error && !person && resultsFor === term && people.length === 0 && <Empty>No accounts match this search.</Empty>}
      {!person && resultsFor === term && people.length > 0 && (
        <div className="mt-3 divide-y divide-black/10 rounded-[6px] border border-black/10">
          {people.map((p) => (
            <button key={p.id} type="button" onClick={() => openPerson(p.id)}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-black/[0.03]">
              <Avatar name={p.name} picture={p.picture} gid={p.gid} className="h-10 w-10 text-xs" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-xs">{p.name}</b>
                <span className="block truncate text-[11px] text-black/55">{p.email} · {p.className || ROLE_LABEL[p.role]}</span>
              </span>
              <span className="text-xs text-[#15803d]">View details</span>
            </button>
          ))}
        </div>
      )}
      {detailLoading && <Loader label="Loading account details" />}
      {detailError && <div className="mt-3"><Alert>{detailError}</Alert></div>}
      {person && (
        <div className="mt-4 space-y-4 rounded-[6px] border border-black/10 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <Avatar name={person.name} picture={person.picture} gid={person.gid} className="h-14 w-14 text-sm" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold">{person.name}</h4>
              <p className="mt-1 break-all text-xs text-black/60">{person.email}</p>
              <p className="mt-1 text-xs text-black/60">{ROLE_LABEL[person.role]}{person.className ? ` · ${person.className}` : ''}</p>
            </div>
            <button type="button" onClick={() => { setPerson(null); setBookings([]); }} className="rounded-[6px] border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5">Back to results</button>
          </div>
          <dl className="grid gap-3 border-t border-black/10 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-black/50">Phone</dt><dd className="mt-1 font-medium">{person.phone || 'Not provided'}</dd></div>
            <div><dt className="text-black/50">Grade</dt><dd className="mt-1 font-medium">{person.grade || '—'}</dd></div>
            <div><dt className="text-black/50">Combination</dt><dd className="mt-1 font-medium">{person.combo || '—'}</dd></div>
            <div><dt className="text-black/50">Section</dt><dd className="mt-1 font-medium">{person.section || '—'}</dd></div>
          </dl>
          <div className="border-t border-black/10 pt-3">
            <h4 className="text-xs font-semibold">{currentBooking ? 'Scheduled location now' : recentBooking ? 'Most recent scheduled location' : 'Next scheduled location'}</h4>
            {locationBooking ? (
              <p className="mt-1 text-xs">
                <b>{locationBooking.lab}</b> · {niceDay(locationBooking.date)} · {locationBooking.from}–{locationBooking.to}
                <span className="block mt-1 text-black/55">
                  {currentBooking ? 'Approved booking in progress' : recentBooking ? 'Most recent approved booking' : 'Next approved booking'}
                  {locationBooking.att === 'present' ? ` · Checked in${locationBooking.checkedInAt ? ` at ${locationBooking.checkedInAt}` : ''}` : ' · No check-in recorded'}
                </span>
              </p>
            ) : <p className="mt-1 text-xs text-black/55">No approved lab booking is recorded.</p>}
          </div>
          <div className="border-t border-black/10 pt-3">
            <h4 className="mb-2 text-xs font-semibold">Recent lab bookings</h4>
            {bookings.length === 0 ? <p className="text-xs text-black/55">No booking history found.</p> : (
              <div className="divide-y divide-black/10">
                {bookings.map((booking) => (
                  <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span><b>{booking.lab}</b><span className="ml-2 text-black/55">{niceDay(booking.date)} · {booking.from}–{booking.to}</span></span>
                    <span className="flex gap-1.5">
                      <Badge s={booking.status}>{STATUS_LABEL[booking.status] || booking.status}</Badge>
                      {booking.att && <Badge s={booking.late ? 'late' : booking.att}>{attLabel(booking)}</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// Live presence: which admin is on which page, and recent activity (filtered by day and by admin).
function OverviewPage({ me }) {
  const [stats, setStats] = useState(null);
  const [todayBoard, setTodayBoard] = useState(null);
  const [presence, setPresence] = useState([]);
  const [acts, setActs] = useState([]);
  const [chart, setChart] = useState([]);
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState('today');
  const [pickDate, setPickDate] = useState(today());
  const [actor, setActor] = useState('');
  const [many, setMany] = useState(15);
  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (mode === 'today') p.set('date', today());
    else if (mode === 'yesterday') p.set('date', dayOffset(-1));
    else if (mode === 'date') p.set('date', pickDate);
    else p.set('days', mode);
    if (actor) p.set('actor', actor);
    api('/api/stats/overview').then(setStats).catch(() => {});
    api(`/api/board?date=${today()}`).then(setTodayBoard).catch(() => {});
    api(`/api/activity?${p}`).then(setActs).catch(() => {});
    api(`/api/activity/chart?days=${days}`).then(setChart).catch(() => {});
  }, [days, mode, pickDate, actor]);
  useEffect(load, [load]);
  useEffect(() => setMany(15), [mode, pickDate, actor]);
  useLive({ 'activity:update': load, presence: (p) => setPresence(p) });

  const t = stats?.totals || {};
  const att = stats?.attendance || {};
  const todaySessions = (todayBoard?.labs || []).flatMap((lab) => lab.sessions.map((session) => ({ ...session, labName: lab.name })))
    .filter((session) => session.date === today()
      && session.state !== 'over'
      && session.to > new Date().toTimeString().slice(0, 5)
      && liveOf(session).some((booking) => booking.status === 'approved'));
  const todayApplied = todaySessions.reduce((n, session) => n + liveOf(session).filter((booking) => booking.status === 'approved').length, 0);
  const dayList = Array.from({ length: days }, (_, i) => shiftDay(today(), i - days + 1));
  const actors = [...new Set([...presence.map((p) => p.name), ...chart.map((c) => c.actor), ...acts.map((a) => a.actor)])].sort();
  const maxDay = Math.max(1, ...chart.map((c) => c.n));
  const total = (name) => chart.filter((c) => c.actor === name).reduce((n, c) => n + c.n, 0);
  const visible = acts.slice(0, many);
  const groups = [];
  visible.forEach((a) => {
    const h = dayHead(a.at);
    const g = groups[groups.length - 1];
    if (g && g.h === h) g.items.push(a); else groups.push({ h, items: [a] });
  });
  const periodText = mode === 'today' ? 'today' : mode === 'yesterday' ? 'yesterday' : mode === 'date' ? niceDay(pickDate) : `the last ${mode} days`;

  return (
    <div className="space-y-6">
      <CallPanel />
      <OverviewPeopleSearch />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat v={t.approved ?? 0} t="Approved bookings" tone="gr" />
        <Stat v={t.pending ?? 0} t="Waiting or in queue" tone="or" />
        <Stat v={att.rate == null ? '-' : `${att.rate}%`} t="Attendance rate" tone="gr" />
        <Stat v={att.late ?? 0} t="Late arrivals" tone="am" />
      </div>

      <Card t="Today's bookings" sub="Approved bookings for today's lab times only, excluding sessions that have already passed.">
        <div className="mb-3"><Stat v={todayApplied} t="Approved bookings" tone="gr" /></div>
        {todaySessions.length === 0 && <Empty>No upcoming approved bookings for today.</Empty>}
        <div className="divide-y divide-black/10">
          {todaySessions.map((session) => {
            const people = liveOf(session).filter((booking) => booking.status === 'approved');
            return (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><b>{session.labName}</b><span className="text-black/55"> · {session.from}–{session.to}</span></span>
                <span className="text-xs font-semibold">{plural(people.length, 'booking')}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card t="Who is online" sub="Admins currently signed in and the page they are on.">
          {presence.length === 0 && <Empty>No admin is online.</Empty>}
          {presence.map((p) => (
            <div key={p.email || p.name} className="flex items-center justify-between gap-3 border-t border-black/10 py-3 first:border-t-0">
              <span className="flex items-center gap-3">
                <Avatar name={p.name} picture={p.picture} className="h-8 w-8 text-[10px]" />
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

      <Card t="Recent activity" sub={`Changes made by admins ${periodText}, newest first.`}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Pills value={mode} onChange={setMode} items={ACT_FILTERS} />
          {mode === 'date' && <Inp type="date" aria-label="Choose a day" className="!w-40" value={pickDate} max={today()} onChange={(e) => e.target.value && setPickDate(e.target.value)} />}
          <Sel className="!w-48" value={actor} onChange={setActor} options={[{ value: '', label: 'All admins' }, ...actors.map((a) => ({ value: a, label: a }))]} aria-label="Admin" />
          <span className="ml-auto text-xs text-black/55">{plural(acts.length, 'action')}</span>
        </div>
        {acts.length === 0 && <Empty>No activity for this choice.</Empty>}
        {groups.map((g) => (
          <div key={g.h} className="mb-3">
            <div className="mb-1 rounded-[4px] bg-black/[0.04] px-3 py-1.5 text-[11px] font-bold text-black/60">{g.h}</div>
            <div className="divide-y divide-black/10">
              {g.items.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-1 py-2.5 text-xs">
                  <span><b>{a.actor}</b> <span className="text-black/70">{a.action}</span>{a.detail && <span className="text-black/55"> · {a.detail}</span>}</span>
                  <span className="text-black/45">{clock(a.at)} · {ago(a.at)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {acts.length > many && <div className="pt-2 text-center"><Btn c="w" onClick={() => setMany((n) => n + 15)}>Show more ({acts.length - many} left)</Btn></div>}
      </Card>
    </div>
  );
}

function HistoryPage() {
  const [labs, setLabs] = useState([]);
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(() => shiftDay(today(), -30));
  const [to, setTo] = useState(today());
  const [lab, setLab] = useState('0');
  const [attendance, setAttendance] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ from, to, lab });
      const [labList, history] = await Promise.all([api('/api/labs'), api(`/api/history?${params}`)]);
      setLabs(labList);
      setRows(history.rows);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, lab]);
  useEffect(() => { load(); }, [load]);
  const visible = rows.filter((r) => !attendance || (attendance === 'unmarked' ? !r.att : r.att === attendance));
  return (
    <div className="space-y-6">
      <Card t="Lab attendance history" sub="Review who booked and attended each lab session, including their scheduled time and recorded check-in.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field l="From"><Inp type="date" value={from} max={today()} onChange={(e) => { setLoading(true); setFrom(e.target.value); }} /></Field>
          <Field l="To"><Inp type="date" value={to} max={today()} onChange={(e) => { setLoading(true); setTo(e.target.value); }} /></Field>
          <Field l="Lab">
            <Sel value={lab} onChange={(value) => { setLoading(true); setLab(value); }} options={[{ value: '0', label: 'All labs' }, ...labs.map((l) => ({ value: String(l.id), label: l.name }))]} />
          </Field>
          <Field l="Attendance">
            <Sel value={attendance} onChange={setAttendance} options={[
              { value: '', label: 'All records' }, { value: 'present', label: 'Present' },
              { value: 'absent', label: 'Absent' }, { value: 'unmarked', label: 'Not marked' },
            ]} />
          </Field>
          <Btn c="w" onClick={() => { setLoading(true); load(); }} disabled={loading}>Refresh</Btn>
          <span className="ml-auto text-xs text-black/55">{plural(visible.length, 'record')}</span>
        </div>
        {err && <div className="mb-4"><Alert>{err}</Alert></div>}
        {loading && <Loader label="Loading attendance history" />}
        {!loading && !err && visible.length === 0 && <Empty>No attendance records match these filters.</Empty>}
        {!loading && visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead><tr className="border-b border-black/10 text-black/55">
                <th className="px-3 py-2 font-semibold">Student</th><th className="px-3 py-2 font-semibold">Lab</th>
                <th className="px-3 py-2 font-semibold">Date and session</th><th className="px-3 py-2 font-semibold">Attendance</th>
                <th className="px-3 py-2 font-semibold">Check-in time</th><th className="px-3 py-2 font-semibold">Booking</th>
              </tr></thead>
              <tbody className="divide-y divide-black/10">
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-3"><b>{r.name}</b><span className="block text-[11px] text-black/50">{r.cls || 'No class'}</span></td>
                    <td className="px-3 py-3">{r.lab}</td>
                    <td className="px-3 py-3">{niceDay(r.date)}<span className="block text-[11px] text-black/50">{r.from}–{r.to}</span></td>
                    <td className="px-3 py-3"><Badge s={attKey(r) || 'none'}>{attLabel(r)}</Badge></td>
                    <td className="px-3 py-3">{r.checkedInAt || 'Not recorded'}</td>
                    <td className="px-3 py-3">{STATUS_LABEL[r.status] || r.status}<span className="block text-[11px] text-black/50">{r.bookedBy || '—'}</span></td>
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

// All students of a lab time, one page at a time, with their profile pictures.
function StudentsModal({ lab, s, onClose }) {
  const PER = 6;
  const list = liveOf(s);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const slice = list.slice(page * PER, page * PER + PER);
  return (
    <Modal title={`${lab.name} · ${s.from}–${s.to}`} onClose={onClose} wide>
      <p className="mb-4 text-xs text-black/55">{plural(list.length, 'student')} · {s.seats - s.left} of {s.seats} places taken · {audText(s)}</p>
      {list.length === 0 && <Empty>Nobody has applied yet.</Empty>}
      <div className="grid gap-3 sm:grid-cols-2">
        {slice.map((a, i) => (
          <div key={a.id} className="flex items-center gap-4 rounded-[8px] border border-black/10 p-3">
            <Avatar name={a.name} picture={a.picture} gid={a.gid} className="h-16 w-16 text-lg" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-black/40">#{page * PER + i + 1}</div>
              <b className="block truncate text-sm">{a.name}</b>
              <span className="block truncate text-xs text-black/55">{a.cls || 'No class'}{a.reason ? ` · ${a.reason}` : ''}</span>
              <span className="block truncate text-xs text-black/45">{a.email || 'No email'}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge s={statusKey(a, s)}>{STATUS_LABEL[statusKey(a, s)]}</Badge>
                {attKey(a) && <Badge s={attKey(a)}>{attLabel(a)}</Badge>}
              </span>
            </div>
          </div>
        ))}
      </div>
      <Pager page={page} pages={pages} onChange={setPage} label={`Showing ${page * PER + 1}–${Math.min(list.length, page * PER + PER)} of ${list.length}`} />
    </Modal>
  );
}

// Labs page: only PUBLISHED lab times. For each lab: its picture, status, how many applied and the students.
// Click "View all students" to go through everyone, "Open lab" to mark attendance, or "Print" for the list.
function LabsPage({ onOpenLab }) {
  const [day, setDay] = useState(() => pickBookableDay(today()));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [viewer, setViewer] = useState(null);
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
            <Btn c="w" disabled={!withTime.length} onClick={() => printLabs(withTime, day)}><Printer className="h-4 w-4" aria-hidden="true" />Print all labs</Btn>
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
        {labs.map((l, li) => {
          const status = labStatus(l.sessions);
          return (
            <article key={l.id} className={`flex flex-col overflow-hidden rounded-[8px] border bg-white ${status === 'over' ? 'border-[#dc2626]/40' : 'border-black/10'}`}>
              <div className="relative h-56 overflow-hidden bg-[#e8f5ec]">
                <LabImg lab={l} index={li} w={700} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-2.5 left-4 right-4 flex items-end justify-between gap-3 text-white">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold">{l.name}</h3>
                    <p className="text-xs text-white/80">{l.pcs} computers · {plural(l.sessions.length, 'lab time')}</p>
                  </div>
                  <Badge s={status}>{LAB_STATUS_TEXT[status]}</Badge>
                </div>
              </div>
              <div className="flex-1 space-y-4 p-4">
                {l.sessions.length === 0 && <p className="py-4 text-center text-xs text-black/50">No lab time on this day.</p>}
                {l.sessions.map((s) => {
                  const list = liveOf(s);
                  const shown = list.slice(0, 6);
                  const capacityPct = s.seats > 0 ? Math.min(100, Math.max(0, ((s.seats - s.left) / s.seats) * 100)) : 0;
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
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label={`${s.seats - s.left} of ${s.seats} places taken`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(capacityPct)}>
                        <div className={`h-full rounded-full transition-[width] duration-500 ${capacityPct >= 100 ? 'bg-[#ff4500]' : 'bg-[#16a34a]'}`} style={{ width: `${capacityPct}%` }} />
                      </div>
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
                      {list.length > 0 && (
                        <Btn c="w" className="mt-3 w-full" onClick={() => setViewer({ lab: l, s })}><Eye className="h-4 w-4" aria-hidden="true" />View all students ({list.length})</Btn>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 border-t border-black/10 p-3">
                <Btn onClick={() => onOpenLab(l.id, day, l.name)}>Open lab</Btn>
                <Btn c="w" disabled={!l.sessions.length} onClick={() => printLabs([l], day)}><Printer className="h-4 w-4" aria-hidden="true" />Print this lab</Btn>
              </div>
            </article>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-4 text-[11px] text-black/55">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Approved student</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#2563eb]" />In the waiting list</span>
      </p>
      {viewer && <StudentsModal lab={viewer.lab} s={data.labs.find((x) => x.id === viewer.lab.id)?.sessions.find((x) => x.id === viewer.s.id) || viewer.s} onClose={() => setViewer(null)} />}
    </div>
  );
}

// One lab on one day: its lab times, the students of each (a page at a time), attendance, selection and printing.
function LabDetail({ labId, day, onBack }) {
  const PER = 8;
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [pages, setPages] = useState({});
  const [sel, setSel] = useState([]);
  const load = useCallback(() => api(`/api/board?date=${day}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)), [day]);
  useEffect(() => { load(); }, [load]);
  useLive({ 'applications:update': load, seats: load });
  const { busy, act, sure, note } = useAct(load);

  if (!data) return err ? <Alert>{err}</Alert> : <Loader full label="Loading lab" />;
  const labIndex = data.labs.findIndex((l) => l.id === labId);
  const lab = data.labs[labIndex];
  if (!lab) return <Card><Empty>This lab was not found.</Empty></Card>;
  const started = (s) => s.date < today() || (s.date === today() && s.from <= new Date().toTimeString().slice(0, 5));
  const setAtt = (a, v) => act('att' + a.id, () => api(`/api/apps/${a.id}/attendance`, 'PATCH', { att: attKey(a) === v ? null : v }));
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[10px] bg-[#e8f5ec]">
        <LabImg lab={lab} index={labIndex} w={1200} className="h-56 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-wrap items-center justify-between gap-3 p-5 text-white">
          <div>
            <h2 className="text-xl font-bold">{lab.name}</h2>
            <p className="text-xs text-white/80">{niceDay(day)} · {lab.pcs} computers</p>
          </div>
          <div className="flex gap-2">
            <Btn c="w" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" />All labs</Btn>
            <Btn c="w" disabled={!lab.sessions.length} onClick={() => printLabs([lab], day)}><Printer className="h-4 w-4" aria-hidden="true" />Print this lab</Btn>
          </div>
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
        const pageCount = Math.max(1, Math.ceil(list.length / PER));
        const page = Math.min(pages[s.id] || 0, pageCount - 1);
        const slice = list.slice(page * PER, page * PER + PER);
        const ids = list.map((a) => a.id);
        const chosen = ids.filter((id) => sel.includes(id));
        return (
          <Card key={s.id} t={`${s.from}–${s.to}`}
            sub={`${audText(s)} · ${s.seats - s.left} of ${s.seats} places taken`}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <Badge s={s.state}>{STATE_LABEL[s.state]}</Badge>
                <Btn c="w" disabled={!list.length} onClick={() => printSession(lab, s)}><Printer className="h-4 w-4" aria-hidden="true" />Print list</Btn>
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
            {list.length > 0 && (
              <SelectBar total={list.length} selected={chosen.length}
                onAll={() => setSel((x) => [...new Set([...x, ...ids])])} onNone={() => setSel((x) => x.filter((id) => !ids.includes(id)))}>
                {chosen.length > 0 && (
                  <>
                    <ActBtn busy={busy === 'bap' + s.id} doing="Approving…" label={`Approve ${chosen.length}`}
                      onClick={() => act('bap' + s.id, () => api('/api/apps/bulk', 'POST', { ids: chosen, action: 'approve' }),
                        (r) => `${r.done} approved${r.skipped ? `, ${r.skipped} skipped because the lab time is full` : ''}.`)} />
                    <Btn c="or" onClick={() => sure({ message: `Remove ${chosen.length} student(s) from this lab time?`, ok: 'Remove', danger: true }, 'bx' + s.id,
                      async () => { await api('/api/apps/bulk', 'POST', { ids: chosen, action: 'delete' }); setSel((x) => x.filter((id) => !chosen.includes(id))); }, `${chosen.length} removed.`)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />Remove {chosen.length}
                    </Btn>
                  </>
                )}
              </SelectBar>
            )}
            <div className="divide-y divide-black/10">
              {slice.map((a, i) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <input type="checkbox" aria-label={`Select ${a.name}`} className="h-4 w-4 accent-[#16a34a]" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} />
                    <span className="w-5 text-right text-xs text-black/40">{page * PER + i + 1}</span>
                    <Person p={a} sub={`${a.cls || 'No class'}${a.reason ? ` · ${a.reason}` : ''}`} className="h-12 w-12 text-sm" />
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
            <Pager page={page} pages={pageCount} onChange={(n) => setPages((p) => ({ ...p, [s.id]: n }))}
              label={`Students ${page * PER + 1}–${Math.min(list.length, page * PER + PER)} of ${list.length}`} />
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

// Choose one lab, two or three labs, or all of them.
function LabPicker({ labs, value, onChange }) {
  const all = labs.length > 0 && value.length === labs.length;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={all} onClick={() => onChange(all ? [] : labs.map((l) => String(l.id)))}
          className={`rounded-[6px] border px-3 py-2 text-xs font-bold ${all ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-black/15 bg-white hover:bg-black/5'}`}>All labs</button>
        {labs.map((l) => {
          const on = value.includes(String(l.id));
          return (
            <button key={l.id} type="button" aria-pressed={on} onClick={() => toggle(String(l.id))}
              className={`flex items-center gap-2 rounded-[6px] border py-1.5 pl-1.5 pr-3 text-xs font-semibold ${on ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#15803d]' : 'border-black/15 bg-white hover:bg-black/5'}`}>
              <span className="h-7 w-9 overflow-hidden rounded-[4px] bg-black/10"><LabImg lab={l} index={l.id} w={120} className="h-full w-full object-cover" /></span>
              {l.name}<span className="font-normal text-black/50">· {l.pcs}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-black/50">{value.length === 0 ? 'Choose at least one lab.' : value.length === labs.length ? `All ${labs.length} labs get the same schedule.` : `${plural(value.length, 'lab')} chosen.`}</p>
    </div>
  );
}

const PERIOD_CHOICES = [['before', 'Morning · before lunch', Sunrise], ['after', 'After lunch', Sunset], ['both', 'Morning + after lunch', Sun], ['custom', 'Custom time', CalendarClock]];

// Schedule: prepare lab times (for lunch periods, one or many labs, a class, a group or chosen students) and manage the ones that exist.
function SchedulePage() {
  const [day, setDay] = useState(() => pickBookableDay(today()));
  const [labs, setLabs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [opts, setOpts] = useState({});
  const [f, setF] = useState({ date: pickBookableDay(today()), period: 'both', from: '14:00', to: '16:00', labIds: [], places: '', auto: 'true' });
  const [aud, setAud] = useState({ ...BLANK_AUD });
  const [edit, setEdit] = useState(null);
  const [selS, setSelS] = useState([]);
  const loadAll = useCallback(() => Promise.all([
    api('/api/labs'), api('/api/sessions'), api('/api/users'), api('/api/groups'), api('/api/options'),
  ]).then(([l, s, u, g, o]) => { setLabs(l); setSessions(s); setUsers(u); setGroups(g); setOpts(o); }).catch(() => {}), []);
  useEffect(() => { loadAll(); }, []);
  useLive({ seats: loadAll, 'applications:update': loadAll });
  const { busy, act, sure, note } = useAct(loadAll);

  const students = users.filter((u) => u.role === 'student');
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const P = periodsOf(opts);
  const scheduleWeekday = f.date ? new Date(`${f.date}T12:00:00`).getDay() : -1;
  const scheduleDayName = scheduleWeekday === 5 ? 'Friday' : scheduleWeekday === 6 ? 'Saturday' : '';
  const schedulePeriodDescription = f.period === 'before'
    ? `Morning (before lunch): ${P.before.from}–${P.before.to}${scheduleWeekday === 6 ? ' · after farm' : ''}`
    : f.period === 'after'
      ? `After lunch: ${P.after.from}–${P.after.to}`
      : f.period === 'both'
        ? `Morning (before lunch): ${P.before.from}–${P.before.to}${scheduleWeekday === 6 ? ' · after farm' : ''}; after lunch: ${P.after.from}–${P.after.to}`
        : `Custom time: ${f.from}–${f.to}`;
  const slots = f.period === 'before' ? [P.before] : f.period === 'after' ? [P.after] : f.period === 'both' ? [P.before, P.after] : [{ from: f.from, to: f.to }];
  const timeOk = !!f.date && slots.every((s) => s.from && s.to && s.from < s.to);
  const labsOk = f.labIds.length > 0;
  const audMulti = !!aud.kind && f.labIds.length > 1;
  const canCreate = timeOk && labsOk && audOk(aud) && !audMulti;

  const create = (published) => act(published ? 'pub' : 'draft', async () => {
    const r = await api('/api/sessions', 'POST', {
      date: f.date, slots, published, audience: aud, autoApprove: f.auto === 'true',
      labIds: f.labIds.map(Number), places: f.places === '' ? undefined : +f.places,
    });
    setAud({ ...BLANK_AUD });
    setDay(f.date);
    return r;
  }, (r) => `${published ? 'Published' : 'Saved as a draft'}: ${plural(r.created, 'lab time')}.${r.assigned ? ` ${plural(r.assigned, 'student')} booked automatically.` : ''}${r.notFound?.length ? ` Not found: ${r.notFound.join(', ')}.` : ''}`);

  const dayList = sessions.filter((s) => s.date === day).sort(byTime);
  const dayIds = dayList.map((s) => s.id);
  const chosen = dayIds.filter((id) => selS.includes(id));
  const toggleS = (id) => setSelS((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const periodHint = f.period === 'custom' ? '' : slots.map((s) => `${s.from}–${s.to}`).join(' and ');

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Prepare a lab time" sub="Choose the labs and the time. You can give it to a class, a group or chosen students now, so they are already booked when you publish.">
        <div className="space-y-5">
          <Field l="Labs"><LabPicker labs={labs} value={f.labIds} onChange={(labIds) => setF({ ...f, labIds })} /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field l="Day"><Inp type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field l="Places open" hint="Empty = every computer."><Inp type="number" min="1" value={f.places} onChange={(e) => setF({ ...f, places: e.target.value })} /></Field>
            <Field l="How students are approved">
              <Sel value={f.auto} onChange={(v) => setF({ ...f, auto: v })} options={[
                { value: 'true', label: 'Approve at once (waiting list when full)' }, { value: 'false', label: 'Admin approves each student' },
              ]} />
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium">Time of the day</span>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {PERIOD_CHOICES.map(([v, label, Icon]) => (
                <button key={v} type="button" aria-pressed={f.period === v} onClick={() => setF({ ...f, period: v })}
                  className={`flex items-center gap-2 rounded-[8px] border px-3 py-2.5 text-left text-xs font-semibold ${f.period === v ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#15803d]' : 'border-black/15 bg-white hover:bg-black/5'}`}>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{label}
                    {v !== 'custom' && <span className="block font-normal text-black/50">{v === 'both' ? `${P.before.from}–${P.before.to} + ${P.after.from}–${P.after.to}` : `${P[v].from}–${P[v].to}`}</span>}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-black/60">{scheduleDayName && `${scheduleDayName}: `}{schedulePeriodDescription}. Lunch times can be changed in Settings.</p>
          </div>
          {f.period === 'custom' && (
            <div className="grid gap-4 md:grid-cols-3">
              <Field l="From"><Inp type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
              <Field l="To"><Inp type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            </div>
          )}
        </div>
        <div className="mt-6 rounded-[8px] border border-black/10 bg-black/[0.02] p-4">
          <AudiencePicker value={aud} onChange={setAud} classes={classes} groups={groups} students={students} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ActBtn c="w" busy={busy === 'draft'} doing="Saving…" label="Save as draft" disabled={!canCreate} onClick={() => create(false)} />
          <ActBtn busy={busy === 'pub'} doing="Publishing…" label="Publish now" disabled={!canCreate} onClick={() => create(true)} />
          {!labsOk && <span className="text-xs text-black/55">Choose a lab to continue.</span>}
          {labsOk && !timeOk && <span className="text-xs text-[#c2310a]">The start time must be before the end time.</span>}
          {audMulti && <span className="text-xs text-[#c2310a]">Choose only one lab when you give the lab time to a class, a group or chosen students.</span>}
        </div>
      </Card>

      <Card t="Lab times on this day" sub="Drafts are only visible to admins. Select several to publish, hide or delete them together."
        action={<DayBar day={day} onChange={(d) => { setDay(d); setSelS([]); }} />}>
        {dayList.length === 0 && <Empty>No lab time on this day.</Empty>}
        {dayList.length > 0 && (
          <SelectBar total={dayList.length} selected={chosen.length} onAll={() => setSelS(dayIds)} onNone={() => setSelS([])}>
            {chosen.length > 0 && (
              <>
                <ActBtn busy={busy === 'bpub'} doing="Publishing…" label={`Publish ${chosen.length}`}
                  onClick={() => act('bpub', () => api('/api/sessions/publish-all', 'POST', { ids: chosen }), (r) => `${plural(r.published, 'lab time')} published.`)} />
                <ActBtn c="w" busy={busy === 'bhide'} doing="Hiding…" label={`Hide ${chosen.length}`}
                  onClick={() => act('bhide', () => api('/api/sessions/hide-many', 'POST', { ids: chosen }), (r) => `${plural(r.hidden, 'lab time')} hidden.`)} />
                <Btn c="or" onClick={() => sure({ message: `Remove ${chosen.length} lab time(s)? Their bookings are removed too.`, ok: 'Remove', danger: true }, 'bdel',
                  async () => { await api('/api/sessions/bulk-delete', 'POST', { ids: chosen }); setSelS([]); }, `${chosen.length} lab time(s) removed.`)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />Delete {chosen.length}
                </Btn>
              </>
            )}
          </SelectBar>
        )}
        <div className="divide-y divide-black/10">
          {dayList.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <label className="flex min-w-0 cursor-pointer items-start gap-3">
                <input type="checkbox" aria-label={`Select ${s.lab} ${s.from}`} className="mt-1 h-4 w-4 accent-[#16a34a]" checked={selS.includes(s.id)} onChange={() => toggleS(s.id)} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge s={s.state}>{STATE_LABEL[s.state]}</Badge>
                    <b>{s.lab} · {s.from}–{s.to}</b>
                  </span>
                  <span className="mt-1 block text-xs text-black/55">{s.seats - s.left} of {s.seats} taken · {audText(s)} · {s.autoApprove !== false ? 'Approved at once' : 'Admin approves'}</span>
                </span>
              </label>
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
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Btn c="w" onClick={() => setEdit({ ...edit, from: P.before.from, to: P.before.to })}><Sunrise className="h-4 w-4" aria-hidden="true" />Before lunch</Btn>
              <Btn c="w" onClick={() => setEdit({ ...edit, from: P.after.from, to: P.after.to })}><Sunset className="h-4 w-4" aria-hidden="true" />After lunch</Btn>
            </div>
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
  const [limit, setLimit] = useState(100);
  const [target, setTarget] = useState({ grade: '', combo: '', section: '' });
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nw, setNw] = useState({ name: '', email: '', role: 'student', phone: '', grade: '', combo: '', section: '' });
  const [newGroup, setNewGroup] = useState({ name: '', members: [] });
  const [openGroup, setOpenGroup] = useState(null);
  const load = useCallback(() => Promise.all([api('/api/users'), api('/api/groups'), api('/api/options')])
    .then(([u, g, o]) => { setUsers(u); setGroups(g); setOpts({ ...EMPTY_OPTS, ...o }); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setLimit(100), [q, role]);
  useLive({ 'me:update': load, 'applications:update': load, seats: load });
  const { busy, act, sure, note } = useAct(load);

  const students = users.filter((u) => u.role === 'student');
  const shown = users.filter((u) => (!role || u.role === role) && match(q, u.name, u.email || '', u.className || '', ROLE_LABEL[u.role]));
  const shownIds = shown.map((u) => u.id);
  const shownSel = shownIds.filter((id) => sel.includes(id));
  const selStudents = sel.filter((id) => users.find((u) => u.id === id)?.role === 'student');
  const count = (r) => users.filter((u) => u.role === r).length;
  const targetLabel = [target.grade, target.combo, target.section].filter(Boolean).join(' ');
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills value={role} onChange={setRole} items={[['', 'Everyone', users.length], ...ROLE_CHOICES.map((r) => [r, ROLE_LABEL[r] + 's', count(r)])]} />
        <Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" />Add person</Btn>
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
        {shown.length > 0 && (
          <SelectBar total={shown.length} selected={shownSel.length}
            onAll={() => setSel((x) => [...new Set([...x, ...shownIds])])} onNone={() => setSel((x) => x.filter((id) => !shownIds.includes(id)))} />
        )}
        <div className="divide-y divide-black/10">
          {shown.slice(0, limit).map((u) => (
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
        {shown.length > limit && (
          <div className="pt-4 text-center">
            <p className="mb-2 text-xs text-black/50">Showing {limit} of {shown.length}. Search to narrow the list.</p>
            <Btn c="w" onClick={() => setLimit((n) => n + 100)}>Show 100 more</Btn>
          </div>
        )}
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
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff4500]/10 py-1 pl-1 pr-1.5 text-xs font-medium text-[#c2310a]">
                <Avatar name={m.name} picture={m.picture} gid={m.gid} className="h-5 w-5 text-[8px]" />
                {m.name}<span className="text-black/50">· {m.className}</span>
                <button type="button" aria-label={`Remove ${m.name}`} onClick={() => act('rm' + m.id, () => api(`/api/groups/${g.id}/members/${m.id}`, 'DELETE'), 'Removed from group.')}
                  className="px-1 text-[#ff4500]"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
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

/* ---------- Admin chat: like Messenger. A group chat for all admins and private chats. Shows real profile pictures. ---------- */

// Group picture: the profile pictures of the admins, side by side.
const GroupIcon = ({ people = [], className = 'h-11 w-11' }) => {
  const list = people.slice(0, 2);
  if (list.length < 2) {
    return <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#16a34a] to-[#2563eb] text-white ${className}`} aria-hidden="true"><Users className="h-1/2 w-1/2" /></span>;
  }
  return (
    <span className={`relative shrink-0 ${className}`} aria-hidden="true">
      <Avatar name={list[0].name} picture={list[0].picture} className="absolute left-0 top-0 h-[68%] w-[68%] text-[8px] ring-2 ring-white" />
      <Avatar name={list[1].name} picture={list[1].picture} className="absolute bottom-0 right-0 h-[68%] w-[68%] text-[8px] ring-2 ring-white" />
    </span>
  );
};
const Presence = ({ on, children }) => (
  <span className="relative shrink-0">
    {children}
    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${on ? 'bg-[#16a34a]' : 'bg-black/25'}`} />
  </span>
);

// Display supported media inline, with a download link for other file types.
function Attachment({ m }) {
  const url = chatFileUrl(m.fileId);
  const downloadUrl = chatFileUrl(m.fileId, true);
  const mime = m.fileMime || '';
  if (mime.startsWith('image/')) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.fileName || 'Photo'} className="mb-1 max-h-64 max-w-full rounded-[12px] object-cover" /></a>;
  if (mime.startsWith('video/')) return <video src={url} controls preload="metadata" className="mb-1 max-h-64 max-w-full rounded-[12px] bg-black" />;
  if (mime.startsWith('audio/')) return <audio src={url} controls preload="metadata" className="mb-1 h-10 w-60 max-w-full" />;
  return (
    <span className="mb-1 flex items-center gap-3 rounded-[12px] bg-black/5 p-2.5">
      <FileIcon className="h-7 w-7 shrink-0" />
      <span className="min-w-0 text-left"><b className="block max-w-[170px] truncate text-xs">{m.fileName || 'File'}</b><span className="text-[10px] opacity-75">{fileSize(m.fileSize || 0)}</span></span>
      <span className="flex flex-col gap-0.5 text-[11px] font-semibold underline">
        {mime === 'application/pdf' && <a href={url} target="_blank" rel="noreferrer">Open</a>}
        <a href={downloadUrl}>Download</a>
      </span>
    </span>
  );
}

function ChatPage({ me, onUnread }) {
  const [sum, setSum] = useState({ people: [], unread: {}, last: {}, myPicture: '' });
  const [active, setActive] = useState('all');
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [online, setOnline] = useState(null);
  const [typing, setTyping] = useState(null);
  const [showList, setShowList] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const { start, call } = useCall();
  const { busy, run } = useBusy();
  const box = useRef(null);
  const fileInput = useRef(null);
  const lastType = useRef(0);
  const typingTimer = useRef(null);
  const soundRef = useRef(null);
  const recorderRef = useRef(null);
  const playChatSound = () => {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      const ctx = soundRef.current || (soundRef.current = new Audio());
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.12);
    } catch { /* Audio may not be available in this browser. */ }
  };
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
      const key = m.room?.startsWith('group:') ? m.room : (m.to === 'all' ? 'all' : (m.fromEmail === me.email ? m.to : m.fromEmail));
      if (key === activeRef.current) {
        if (m.fromEmail !== me.email) playChatSound();
        setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur));
        if (m.fromEmail !== me.email) { setTyping(null); markRead(key); } else loadSum();
      } else loadSum();
    },
    'chat:typing': (t) => {
      const key = t.to === 'all' || t.to?.startsWith('group:') ? t.to : t.from;
      if (key !== activeRef.current || t.from === me.email) return;
      playChatSound();
      setTyping(t.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(null), 3000);
    },
    'chat:invitation': loadSum,
    'chat:invitation-updated': loadSum,
    presence: (list) => setOnline(new Set(list.map((p) => p.email))),
  });
  const uploadChatFile = async (file) => {
    if (!file) return;
    setErr('');
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('The file is too big (25 MB maximum).');
      const data = await readB64(file);
      const message = await api('/api/chat/messages', 'POST', {
        with: active,
        file: { name: file.name, mime: file.type || 'application/octet-stream', data },
      });
      setMsgs((cur) => cur && !cur.some((x) => x.id === message.id) ? [...cur, message] : cur);
      loadSum();
    } catch (e) { setErr(e.message || 'File upload failed.'); }
  };

  const toggleVoiceRecording = async () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Voice recording is not supported in this browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const file = new File(chunks, `voice-message-${Date.now()}.webm`, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        if (file.size) uploadChatFile(file);
      };
      recorder.start();
    } catch (e) { setErr(e.message || 'Could not start voice recording.'); }
  };

  const myPic = sum.myPicture || me.picture || '';
  const people = sum.people.map((p) => ({ ...p, on: online ? online.has(p.email) : p.online }));
  const groups = sum.groups || [];
  const invitations = sum.invitations || [];
  const activeGroup = groups.find((g) => g.id === active);
  const isAdmin = ['admin', 'administrator'].includes(String(me.role || me.type || '').toLowerCase());
  const everyone = [{ name: me.name, picture: myPic }, ...people];
  const lastAt = (k) => sum.last[k]?.at || '';
  const sorted = [...people].sort((a, b) => (sum.unread[b.email] || 0) - (sum.unread[a.email] || 0)
    || lastAt(b.email).localeCompare(lastAt(a.email)) || (+b.on - +a.on) || a.name.localeCompare(b.name));
  const list = sorted.filter((p) => match(q, p.name, p.email));
  const showGroup = match(q, 'all admins group');
  const onlineCount = people.filter((p) => p.on).length + 1;
  const other = people.find((p) => p.email === active);
  const preview = (k) => { const l = sum.last[k]; return l ? `${l.fromMe ? 'You: ' : (k === 'all' ? `${l.fromName.split(' ')[0]}: ` : '')}${l.body}` : 'No messages yet'; };

  const open = (k) => { setActive(k); setShowList(false); };
  const createGroup = async (event) => {
    event.preventDefault();
    const name = groupName.trim();
    if (!name || !groupMembers.length || creating) return;
    setCreating(true);
    setErr('');
    try {
      const group = await api('/api/chat/groups', 'POST', { name, members: groupMembers });
      setCreatingGroup(false); setGroupName(''); setGroupMembers([]); setMemberPickerOpen(false);
      await loadSum();
      open(group.id);
    } catch (e) { setErr(e.message || 'Could not create group.'); }
    finally { setCreating(false); }
  };
  const respondToInvitation = async (invitation, action) => {
    try {
      await api(`/api/chat/groups/${invitation.groupId}/respond`, 'POST', { action });
      await loadSum();
      if (action === 'accept') open(invitation.id);
      setErr('');
    } catch (e) { setErr(e.message || 'Could not update invitation.'); }
  };
  const send = (body) => run('send', async () => {
    const b = String(body ?? text).trim();
    if (!b) return;
    try {
      const m = await api('/api/chat/messages', 'POST', { with: active, body: b });
      setText('');
      setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur));
      loadSum();
    } catch (e) { setErr(e.message); }
  });
  const saveEdit = async () => {
    const body = text.trim();
    if (!editing || !body) return;
    try {
      const updated = await api(`/api/chat/messages/${encodeURIComponent(editing.id)}`, 'PATCH', { body });
      setMsgs((cur) => cur?.map((m) => m.id === editing.id ? { ...m, ...updated, body } : m));
      setEditing(null); setText('');
    } catch (e) { setErr(e.message); }
  };
  const deleteMessage = async (message) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api(`/api/chat/messages/${encodeURIComponent(message.id)}`, 'DELETE');
      setMsgs((cur) => cur?.map((m) => m.id === message.id ? { ...m, deleted: true } : m));
    } catch (e) { setErr(e.message); }
  };
  const onType = (v) => {
    setText(v);
    if (v.length > text.length) playChatSound();
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
          <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-bold">Chats</h2>
            {isAdmin && <button type="button" onClick={() => { setCreatingGroup(true); setMemberPickerOpen(false); }} className="rounded-full bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white">Create group</button>}
          </div>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search admins" aria-label="Search admins"
            className="w-full rounded-full bg-[#f0f2f5] px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#16a34a]/40" />
        </div>
        <div className="flex-1 overflow-y-auto pb-2">
          {invitations.length > 0 && (
            <div className="border-b border-black/10 px-3 py-3">
              <p className="mb-2 text-[11px] font-bold text-black/55">Group invitations</p>
              {invitations.map((invitation) => (
                <div key={invitation.groupId} className="mb-2 rounded-lg border border-[#16a34a]/25 bg-[#16a34a]/5 p-3 last:mb-0">
                  <b className="block truncate text-xs">{invitation.name}</b>
                  <span className="text-[11px] text-black/55">Invited by {invitation.createdBy}</span>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => respondToInvitation(invitation, 'accept')} className="rounded-md bg-[#16a34a] px-3 py-1.5 text-[11px] font-semibold text-white">Accept</button>
                    <button type="button" onClick={() => respondToInvitation(invitation, 'decline')} className="rounded-md border border-black/15 px-3 py-1.5 text-[11px] font-semibold">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {groups.filter((g) => match(q, g.name)).map((g) => <Row key={g.id || g.key} k={g.id || g.key} name={g.name} unread={sum.unread[g.id || g.key] || 0} time={sum.last[g.id || g.key]?.at} sub={preview(g.id || g.key)} avatar={<GroupIcon people={g.members || []} />} />)}
          {showGroup && (
            <Row k="all" name="All admins" unread={sum.unread.all || 0} time={sum.last.all?.at}
              sub={preview('all')} avatar={<GroupIcon people={everyone} />} />
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

      {creatingGroup && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation">
        <form onSubmit={createGroup} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h3 className="mb-4 text-lg font-bold">Create admin group</h3>
          {err && <div className="mb-3"><Alert>{err}</Alert></div>}
          <label className="mb-3 block text-sm font-medium">Group name<input autoFocus required value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" /></label>
          <div className="mb-4">
            <span className="block text-sm font-medium">Invite admins</span>
            <button type="button" aria-expanded={memberPickerOpen} aria-controls="group-member-picker" onClick={() => setMemberPickerOpen((open) => !open)}
              className="mt-1 flex w-full items-center justify-between rounded-lg border border-black/15 px-3 py-2 text-left text-sm">
              <span>{groupMembers.length ? `${groupMembers.length} admin${groupMembers.length === 1 ? '' : 's'} selected` : 'Choose admins to invite'}</span>
              <span aria-hidden="true">{memberPickerOpen ? '▴' : '▾'}</span>
            </button>
            {memberPickerOpen && (
              <div id="group-member-picker" role="group" aria-label="Select admins to invite" className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-black/15 bg-white p-1">
                {people.map((p) => (
                  <label key={p.email} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs hover:bg-black/[0.04]">
                    <input type="checkbox" checked={groupMembers.includes(p.email)} onChange={() => setGroupMembers((members) => members.includes(p.email) ? members.filter((email) => email !== p.email) : [...members, p.email])} />
                    <span className="min-w-0"><b className="block truncate">{p.name}</b><span className="block truncate text-black/50">{p.email}</span></span>
                  </label>
                ))}
                {people.length === 0 && <p className="px-2 py-3 text-xs text-black/50">No other admins are available to invite.</p>}
              </div>
            )}
            <span className="mt-1 block text-xs font-normal text-black/50">Invited admins must accept before they can see or use the group. You will be a member as soon as it is created.</span>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => { setCreatingGroup(false); setGroupName(''); setGroupMembers([]); setMemberPickerOpen(false); setErr(''); }} className="rounded-lg px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={creating || !groupName.trim() || !groupMembers.length} className="rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{creating ? 'Creating…' : 'Create'}</button></div>
        </form>
      </div>}

      {/* Right: the conversation */}
      <section className={`${showList ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}>
        <header className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
          <button type="button" aria-label="Back to chats" onClick={() => setShowList(true)} className="grid h-8 w-8 place-items-center rounded-full text-[#16a34a] hover:bg-black/5 md:hidden"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
          {active === 'all' || activeGroup
            ? <GroupIcon people={activeGroup?.members || everyone} className="h-10 w-10" />
            : <Presence on={!!other?.on}><Avatar name={other?.name || active} picture={other?.picture} className="h-10 w-10 text-xs" /></Presence>}
          <div className="min-w-0">
            <b className="block truncate text-sm">{active === 'all' ? 'All admins' : activeGroup?.name || other?.name || active}</b>
            <span className="block truncate text-[11px] text-black/50">
              {activeGroup ? `${activeGroup.members.length} members`
                : active === 'all' ? `${people.length + 1} admins · ${onlineCount} online`
                : other?.on ? 'Active now' : other?.lastSeen ? `Active ${ago(other.lastSeen)}` : 'Offline'}
            </span>
          </div>
          {active !== 'all' && !activeGroup && <span className="ml-auto flex gap-1">
            <button type="button" aria-label="Audio call" title="Audio call" disabled={!!call || !other}
              onClick={() => start({ email: other.email, name: other.name, picture: other.picture }, 'audio')}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40"><Phone className="h-4 w-4" /></button>
            <button type="button" aria-label="Video call" title="Video call" disabled={!!call || !other}
              onClick={() => start({ email: other.email, name: other.name, picture: other.picture }, 'video')}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40"><Video className="h-4 w-4" /></button>
          </span>}
        </header>

        <div ref={box} className="flex-1 overflow-y-auto bg-[#f0f2f5] px-3 py-4 sm:px-5">
          {err && <div className="mb-3"><Alert>{err}</Alert></div>}
          {msgs === null && <Loader full label="Loading messages" />}
          {msgs && msgs.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div>
                {active === 'all' || activeGroup ? <GroupIcon people={activeGroup?.members || everyone} className="mx-auto h-16 w-16" /> : <Avatar name={other?.name || active} picture={other?.picture} className="mx-auto h-16 w-16 text-lg" />}
                <p className="mt-3 text-sm font-semibold">{active === 'all' ? 'All admins' : activeGroup?.name || other?.name}</p>
                <p className="mt-1 text-xs text-black/50">No messages yet. Say hello.</p>
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
                    <span className="w-8 shrink-0">
                      {last && <Avatar name={m.fromName} picture={sender?.picture} className="h-8 w-8 text-[9px]" />}
                    </span>
                  )}
                  <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && first && (active === 'all' || activeGroup) && <span className="mb-0.5 ml-3 text-[11px] font-medium text-black/50">{m.fromName}</span>}
                    <div title={`${dayHead(m.at)} ${clock(m.at)}`}
                      className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[13px] leading-snug ${corner} ${mine ? 'bg-[#16a34a] text-white' : 'bg-white text-[#111827] shadow-sm'}`}>
                      {m.deleted ? 'Message deleted' : <>
                        {m.replyTo && m.replyBody && <div className={`mb-1 border-l-2 px-2 text-[11px] opacity-75 ${mine ? 'border-white' : 'border-[#16a34a]'}`}>
                          <b>{m.replyName || 'Reply'}</b><div className="truncate">{m.replyBody}</div>
                        </div>}
                        {m.fileId && <Attachment m={m} />}
                        {m.fileId && m.body ? <><br />{m.body}</> : !m.fileId && m.body}
                        {m.forwarded && <span className="ml-1 text-[10px] opacity-70">Forwarded</span>}
                        {m.editedAt && <span className="ml-1 text-[10px] opacity-70">(edited)</span>}
                      </>}
                    </div>
                    {mine && !m.deleted && <div className="mt-1 flex gap-2 text-[10px]">
                      {m.body && !m.fileId && <button type="button" aria-label="Edit message" title="Edit message" className="rounded p-1 hover:bg-black/10" onClick={() => { setEditing(m); setText(m.body); }}><Pencil className="h-3.5 w-3.5" /></button>}
                      <button type="button" aria-label="Delete message" title="Delete message" className="rounded p-1 hover:bg-black/10" onClick={() => deleteMessage(m)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>}
                    {last && <span className="mx-2 mt-0.5 text-[10px] text-black/40">{clock(m.at)}</span>}
                  </div>
                  {mine && (
                    <span className="w-8 shrink-0">
                      {last && <Avatar name={me.name} picture={myPic} className="h-8 w-8 text-[9px]" />}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="mt-2 flex items-end gap-2">
              <span className="w-8 shrink-0" />
              <div className="flex items-center gap-1 rounded-[18px] bg-white px-3.5 py-3 shadow-sm" aria-label={`${typing} is typing`}>
                <span className="lb-dot" /><span className="lb-dot" style={{ animationDelay: '.15s' }} /><span className="lb-dot" style={{ animationDelay: '.3s' }} />
              </div>
              <span className="pb-1 text-[11px] text-black/45">{typing.split(' ')[0]} is typing</span>
            </div>
          )}
        </div>

        <footer className="relative border-t border-black/10 bg-white p-3">
          {editing && <div className="mb-2 flex items-center justify-between text-xs text-black/60"><span>Editing message</span><button type="button" onClick={() => { setEditing(null); setText(''); }} className="underline">Cancel</button></div>}
          <div className="flex items-end gap-2">
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { [...(e.target.files || [])].forEach(uploadChatFile); e.target.value = ''; }} />
            <button type="button" aria-label="Attach file" title="Attach file" onClick={() => fileInput.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5"><Paperclip className="h-4 w-4" /></button>
            <button type="button" aria-label="Record voice message" title="Record voice message" onClick={toggleVoiceRecording} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5"><Mic className="h-4 w-4" /></button>
            <textarea rows={1} value={text} onChange={(e) => onType(e.target.value)} placeholder="Write a message"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-[20px] bg-[#f0f2f5] px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/40" />
            <button type="button" aria-label={editing ? 'Save edit' : 'Send'} disabled={busy === 'send' || !text.trim()} onClick={() => editing ? saveEdit() : send()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#16a34a] text-white hover:opacity-90 disabled:opacity-40"><Send className="h-4 w-4" aria-hidden="true" /></button>
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
  const [newLab, setNewLab] = useState({ name: '', pcs: 10, image: '' });
  const [rules, setRules] = useState(null);
  const load = useCallback(() => Promise.all([api('/api/options'), api('/api/labs')]).then(([o, l]) => {
    setOpts({ ...EMPTY_OPTS, ...o });
    setLabs(l);
    setRules((cur) => cur ?? { maxConsecutive: String(o.maxConsecutive ?? 1), graceMinutes: String(o.graceMinutes ?? 15), autoRelease: String(o.autoRelease !== false), ...Object.fromEntries(Object.entries({ beforeFrom: '08:00', beforeTo: '12:30', afterFrom: '13:30', afterTo: '17:00' }).map(([k, d]) => [k, o[k] || d])), ...Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].flatMap((day) => Object.entries({ beforeFrom: '08:00', beforeTo: '12:30', afterFrom: '13:30', afterTo: '17:00' }).map(([part, d]) => { const key = `${day.toLowerCase()}${part[0].toUpperCase()}${part.slice(1)}`; return [key, o[key] || o[part] || d]; }))) });
  }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const { busy, act, sure, note } = useAct(load);

  const grades = gradesOf(opts);
  const full = Object.fromEntries(grades.map((g) => [g, combosFor(opts, g)]));
  const clean = (s) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  const putOpts = (body) => api('/api/options', 'PUT', body).then((o) => setOpts({ ...EMPTY_OPTS, ...o }));
  const saveOpts = (body, done) => act('opts', () => putOpts(body), done);
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayKey = (day, part) => `${day.toLowerCase()}${part[0].toUpperCase()}${part.slice(1)}`;
  const lunchOk = rules && weekdays.every((day) => rules[dayKey(day, 'beforeFrom')] < rules[dayKey(day, 'beforeTo')] && rules[dayKey(day, 'afterFrom')] < rules[dayKey(day, 'afterTo')] && rules[dayKey(day, 'beforeTo')] <= rules[dayKey(day, 'afterFrom')]);

  return (
    <div className="space-y-6">
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Lunch times" sub="Lab times can be prepared before lunch, after lunch, or both. Set the hours of each period here.">
        {rules && (
          <>
            <div className="space-y-4">
              {weekdays.map((day) => (
                <div key={day} className="rounded-[8px] border border-black/10 p-4">
                  <h4 className="mb-3 text-xs font-bold">{day}</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><h5 className="mb-2 flex items-center gap-2 text-xs font-medium"><Sunrise className="h-4 w-4 text-[#f59e0b]" aria-hidden="true" />Before lunch</h5><div className="grid grid-cols-2 gap-3">
                      <Field l="From"><Inp type="time" value={rules[dayKey(day, 'beforeFrom')]} onChange={(e) => setRules({ ...rules, [dayKey(day, 'beforeFrom')]: e.target.value })} /></Field>
                      <Field l="To"><Inp type="time" value={rules[dayKey(day, 'beforeTo')]} onChange={(e) => setRules({ ...rules, [dayKey(day, 'beforeTo')]: e.target.value })} /></Field>
                    </div></div>
                    <div><h5 className="mb-2 flex items-center gap-2 text-xs font-medium"><Sunset className="h-4 w-4 text-[#ff4500]" aria-hidden="true" />After lunch</h5><div className="grid grid-cols-2 gap-3">
                      <Field l="From"><Inp type="time" value={rules[dayKey(day, 'afterFrom')]} onChange={(e) => setRules({ ...rules, [dayKey(day, 'afterFrom')]: e.target.value })} /></Field>
                      <Field l="To"><Inp type="time" value={rules[dayKey(day, 'afterTo')]} onChange={(e) => setRules({ ...rules, [dayKey(day, 'afterTo')]: e.target.value })} /></Field>
                    </div></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ActBtn busy={busy === 'opts'} doing="Saving…" label="Save lunch times" disabled={!lunchOk}
                onClick={() => saveOpts(Object.fromEntries(weekdays.flatMap((day) => ['beforeFrom', 'beforeTo', 'afterFrom', 'afterTo'].map((part) => [dayKey(day, part), rules[dayKey(day, part)]]))), 'Lunch times saved.')} />
              {!lunchOk && <span className="text-xs text-[#c2310a]">For each day, periods must start before they end, and lunch must come between them.</span>}
            </div>
          </>
        )}
      </Card>

      <Card t="Booking rules" sub="These keep the labs fair and free places of students who do not come.">
        {rules && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Field l="Most days in a row one student can book" hint="0 = no limit. A student with a booking today can book tomorrow once today's lab time starts.">
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

      <Card t="Labs" sub="Name, number of computers and picture of each room. Without a picture link a nice default picture is shown.">
        <div className="mb-5 grid gap-3 md:grid-cols-[14rem_7rem_1fr_auto]">
          <Inp placeholder="Lab name" value={newLab.name} onChange={(e) => setNewLab({ ...newLab, name: e.target.value })} />
          <Inp type="number" min="1" value={newLab.pcs} onChange={(e) => setNewLab({ ...newLab, pcs: e.target.value })} />
          <Inp placeholder="Picture link (optional)" value={newLab.image} onChange={(e) => setNewLab({ ...newLab, image: e.target.value })} />
          <ActBtn busy={busy === 'lab'} doing="Adding…" label="Add lab" disabled={!newLab.name.trim()}
            onClick={async () => { if (await act('lab', () => api('/api/labs', 'POST', newLab), 'Lab added.')) setNewLab({ name: '', pcs: 10, image: '' }); }} />
        </div>
        <div className="divide-y divide-black/10">
          {labs.map((l, i) => <LabRow key={l.id} l={l} index={i} busy={busy} act={act} sure={sure} />)}
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

function LabRow({ l, index, busy, act, sure }) {
  const [name, setName] = useState(l.name);
  const [pcs, setPcs] = useState(l.pcs);
  const [image, setImage] = useState(l.image || '');
  const changed = name.trim() !== l.name || +pcs !== l.pcs || image.trim() !== (l.image || '');
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span className="h-14 w-20 shrink-0 overflow-hidden rounded-[6px] bg-black/10">
        <LabImg lab={{ ...l, image: image.trim() }} index={index} w={240} className="h-full w-full object-cover" />
      </span>
      <Inp className="!w-48 font-bold" value={name} onChange={(e) => setName(e.target.value)} aria-label="Lab name" />
      <Inp type="number" min="1" className="!w-20" value={pcs} onChange={(e) => setPcs(e.target.value)} aria-label="Computers" />
      <Inp className="min-w-[180px] flex-1" placeholder="Picture link (empty = default picture)" value={image} onChange={(e) => setImage(e.target.value)} aria-label="Picture link" />
      <span className="flex flex-wrap items-center gap-2">
        <ActBtn busy={busy === 'lab' + l.id} doing="Saving…" label="Save" disabled={!changed || !name.trim() || !(+pcs >= 1)}
          onClick={() => act('lab' + l.id, () => api(`/api/labs/${l.id}`, 'PUT', { name: name.trim(), pcs: +pcs, image: image.trim() }), 'Saved.')} />
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
  const [sel, setSel] = useState([]);
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
      const data = await readB64(file);
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
  // Only posts that are already off the board can be deleted.
  const deletable = shown.filter((t) => t.status !== 'active').map((t) => t.id);
  const chosen = deletable.filter((id) => sel.includes(id));
  if (items === null) return err ? <Alert>{err}</Alert> : <Loader full label="Loading" />;

  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      {note && <Alert ok={note.ok}>{note.text}</Alert>}
      <Card t="Post a found item" sub="A post can be removed 7 days after it was posted, and reposted later."
        action={!formOpen && <Btn onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />New post</Btn>}>
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
              {files.some((x) => x.mime.startsWith('image/')) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {files.map((x, i) => x.mime.startsWith('image/') && (
                    <span key={x.name + i} className="relative h-16 w-16 overflow-hidden rounded-[6px] border border-black/10">
                      <img src={`data:${x.mime};base64,${x.data}`} alt={x.name} className="h-full w-full object-cover" />
                      <button type="button" aria-label={`Remove ${x.name}`} onClick={() => setFiles((p) => p.filter((_, k) => k !== i))}
                        className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><X className="h-3 w-3" aria-hidden="true" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 md:col-span-2">
              <ActBtn busy={busy === 'submit'} doing="Posting…" label="Post item" disabled={!f.title.trim() || busy === 'pick'} onClick={submit} />
              <Btn c="w" onClick={() => setFormOpen(false)}>Cancel</Btn>
            </div>
          </div>
        ) : <p className="text-xs text-black/55">Add a photo, a category and a way to contact you.</p>}
      </Card>

      <Card t="Posts" action={<Pills value={view} onChange={(v) => { setView(v); setSel([]); }} items={[['active', 'On the board', n('active')], ['returned', 'Returned', n('returned')], ['removed', 'Removed', n('removed')], ['all', 'All', list.length]]} />}>
        {shown.length === 0 && <Empty>No posts here.</Empty>}
        {deletable.length > 0 && (
          <SelectBar total={deletable.length} selected={chosen.length} onAll={() => setSel(deletable)} onNone={() => setSel([])}>
            {chosen.length > 0 && (
              <Btn c="or" onClick={() => sure({ message: `Delete ${chosen.length} post(s) for good?`, ok: 'Delete', danger: true }, 'bdel',
                async () => { await api('/api/trends/bulk-delete', 'POST', { ids: chosen }); setSel([]); }, `${chosen.length} post(s) deleted.`)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />Delete {chosen.length}
              </Btn>
            )}
          </SelectBar>
        )}
        <div className="divide-y divide-black/10">
          {shown.map((t) => {
            const ph = t.media?.map(itemPhoto).find(Boolean);
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {t.status !== 'active'
                    ? <input type="checkbox" aria-label={`Select ${t.title}`} className="h-4 w-4 accent-[#16a34a]" checked={sel.includes(t.id)} onChange={() => setSel((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))} />
                    : <span className="w-4" />}
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-black/5">
                    <Photo src={ph} alt={t.title} className="h-full w-full object-cover" fallback={<PackageSearch className="h-6 w-6 text-black/30" aria-hidden="true" />} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{t.title}</b><Badge s={t.status} /><span className="rounded-[4px] bg-black/5 px-2 py-0.5 text-[11px] font-semibold">{t.category}</span>
                    </div>
                    <p className="mt-1 text-xs text-black/55">
                      Posted {ago(t.postedAt)}
                      {t.status === 'active' && (t.daysLeft ? ` · can be removed in ${t.daysLeft} day(s)` : ' · ready to remove or repost')}
                    </p>
                  </div>
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
            );
          })}
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

const NAV_ICON = { 'My labs': CalendarDays, Bookings: CalendarCheck2, 'Lost & Found': PackageSearch, 'Champions League': Trophy, Profile: UserRound, Overview: LayoutDashboard, History: CalendarClock, Labs: FlaskConical, Schedule: CalendarClock, People: UsersRound, Chat: MessageCircle, Settings: Settings2 };

const NavBadge = ({ n }) => (n > 0 ? <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-[#ff4500] px-1.5 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span> : null);
/* ================================================================== */
/* CALLS: one call at a time between admins (audio or video)           */
/* ================================================================== */

const CallCtx = createContext(null);
const useCall = () => useContext(CallCtx);
const RTC = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const emitCall = (ev, data) => liveSocket().emit(ev, data);

function CallProvider({ me, children }) {
  const [online, setOnline] = useState([]);
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [local, setLocal] = useState(null);
  const [remote, setRemote] = useState(null);
  const [notice, setNotice] = useState('');
  const callRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const iceQueue = useRef([]);
  const timer = useRef(null);
  const noticeTimer = useRef(null);
  const ringPlayer = useRef(null);

  const stopRing = () => {
    ringPlayer.current?.remove();
    ringPlayer.current = null;
  };
  const startRing = () => {
    stopRing();
    // Use the requested YouTube clip as the only ringtone for incoming and outgoing calls.
    const player = document.createElement('iframe');
    player.src = 'https://www.youtube-nocookie.com/embed/oui7g5frCL0?autoplay=1&playsinline=1&controls=0&loop=1&playlist=oui7g5frCL0';
    player.title = 'Call ringtone';
    player.allow = 'autoplay; encrypted-media';
    player.setAttribute('aria-hidden', 'true');
    Object.assign(player.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(player);
    ringPlayer.current = player;
  };

  const say = (t) => {
    setNotice(t);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  };
  const begin = (c) => { callRef.current = c; setCall(c); };
  const stopTimer = () => clearTimeout(timer.current);

  const reset = () => {
    stopTimer();
    stopRing();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    iceQueue.current = [];
    callRef.current = null;
    setLocal(null); setRemote(null); setCall(null); setIncoming(null);
  };

  // notify = true tells the other admin that the call is over.
  const hangUp = (text = '', notify = true) => {
    const c = callRef.current;
    if (c && notify) emitCall('call:end', { to: c.peer.email, callId: c.id });
    reset();
    if (text) say(text);
  };

  const getMedia = async (mode) => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
    streamRef.current = s;
    setLocal(s);
    return s;
  };

  const makePc = (to, callId) => {
    const pc = new RTCPeerConnection(RTC);
    pc.onicecandidate = (e) => {
      if (e.candidate) emitCall('call:signal', { to, callId, type: 'candidate', candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      // Use the provided stream when available, otherwise construct one from
      // the received track so audio-only calls still produce a playable stream.
      const received = e.streams?.[0] || new MediaStream([e.track]);
      setRemote((current) => current || received);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') hangUp('The connection failed.');
    };
    pcRef.current = pc;
    return pc;
  };

  const addIce = async (c) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (pc.remoteDescription) await pc.addIceCandidate(c).catch(() => {});
    else iceQueue.current.push(c);
  };
  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceQueue.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
  };

  // Caller: ring one chosen admin only.
  const start = (peer, mode) => {
    if (callRef.current || incoming) return say('You are already in a call.');
    const id = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    begin({ id, peer, mode, role: 'caller', status: 'calling' });
    emitCall('call:invite', { to: peer.email, callId: id, kind: mode });
    startRing();
    timer.current = setTimeout(() => hangUp(`${peer.name} did not answer.`), 30000);
  };

  // Receiver: accept the call. Media is ready before the caller is told.
  const accept = async () => {
    const inc = incoming;
    if (!inc) return;
    stopTimer();
    stopRing();
    setIncoming(null);
    try {
      const s = await getMedia(inc.kind);
      const pc = makePc(inc.from, inc.callId);
      s.getTracks().forEach((t) => pc.addTrack(t, s));
      begin({
        id: inc.callId, peer: { email: inc.from, name: inc.name, picture: inc.picture },
        mode: inc.kind, role: 'callee', status: 'connecting',
      });
      emitCall('call:accept', { to: inc.from, callId: inc.callId, kind: inc.kind });
    } catch (e) {
      emitCall('call:reject', { to: inc.from, callId: inc.callId });
      reset();
      say(e.message || 'Could not use the microphone or camera.');
    }
  };

  const decline = () => {
    if (!incoming) return;
    stopTimer();
    stopRing();
    emitCall('call:reject', { to: incoming.from, callId: incoming.callId });
    setIncoming(null);
  };

  useLive({
    presence: (list) => setOnline(list.filter((p) => p.email !== me.email)),

    'call:invite': (p) => {
      if (callRef.current) return emitCall('call:reject', { to: p.from, callId: p.callId });
      setIncoming(p);
      startRing();
      stopTimer();
      timer.current = setTimeout(() => {
        stopRing();
        emitCall('call:reject', { to: p.from, callId: p.callId });
        setIncoming(null);
      }, 30000);
    },

    'call:unavailable': (p) => {
      if (callRef.current?.id === p.callId) hangUp(`${callRef.current.peer.name} is not online.`, false);
    },

    'call:reject': (p) => {
      if (callRef.current?.id === p.callId) hangUp(`${callRef.current.peer.name} declined the call.`, false);
    },

    'call:end': (p) => {
      stopRing();
      setIncoming((cur) => (cur?.callId === p.callId ? null : cur));
      if (callRef.current?.id === p.callId) hangUp('The call ended.', false);
    },

    // The caller gets "accepted" and sends the offer.
    'call:accept': async (p) => {
      const c = callRef.current;
      if (!c || c.id !== p.callId || c.role !== 'caller') return;
      try {
        stopRing();
        stopTimer();
        const s = await getMedia(c.mode);
        const pc = makePc(c.peer.email, c.id);
        s.getTracks().forEach((t) => pc.addTrack(t, s));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitCall('call:signal', { to: c.peer.email, callId: c.id, type: 'offer', offer, mode: c.mode });
        begin({ ...c, status: 'connecting' });
      } catch (e) {
        hangUp(e.message || 'Could not start the call.');
      }
    },

    'call:signal': async (s) => {
      const c = callRef.current;
      if (!c || c.id !== s.callId) return;
      try {
        if (s.type === 'offer' && c.role === 'callee') {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(s.offer);
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitCall('call:signal', { to: c.peer.email, callId: c.id, type: 'answer', answer });
          begin({ ...c, status: 'connected' });
        } else if (s.type === 'answer' && c.role === 'caller') {
          const pc = pcRef.current;
          if (!pc) return;
          stopTimer();
          await pc.setRemoteDescription(s.answer);
          await flushIce();
          begin({ ...c, status: 'connected' });
        } else if (s.type === 'candidate') {
          await addIce(s.candidate);
        }
      } catch (e) {
        hangUp(e.message || 'The call could not connect.');
      }
    },
  });

  const start_ = start; // keeps the name clear in the context value below
  return (
    <CallCtx.Provider value={{ online, call, start: start_, endCall: () => hangUp('') }}>
      {children}

      {notice && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-[6px] bg-[#111827] px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          {notice}
        </div>
      )}

      {incoming && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-label="Incoming call">
          <div className="w-full max-w-sm rounded-[10px] bg-white p-6 text-center shadow-2xl">
            <Avatar name={incoming.name} picture={incoming.picture} className="mx-auto h-20 w-20 text-xl" />
            <p className="mt-4 text-xs text-black/55">Incoming {incoming.kind} call</p>
            <h3 className="mt-1 text-lg font-bold">{incoming.name}</h3>
            <div className="mt-6 flex justify-center gap-3">
              <Btn c="or" onClick={decline}><PhoneOff className="h-4 w-4" aria-hidden="true" />Decline</Btn>
              <Btn onClick={accept}><Phone className="h-4 w-4" aria-hidden="true" />Accept</Btn>
            </div>
          </div>
        </div>
      )}

      {call && <CallScreen call={call} local={local} remote={remote} onEnd={() => hangUp('')} />}
    </CallCtx.Provider>
  );
}

function CallScreen({ call, local, remote, onEnd }) {
  const remoteRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localRef = useRef(null);
  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remote;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remote;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remote]);
  useEffect(() => { if (localRef.current) localRef.current.srcObject = local; }, [local]);
  const status = call.status === 'calling' ? 'Ringing…' : call.status === 'connecting' ? 'Connecting…' : 'Connected';
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="relative flex-1">
        {/* Audio is played by the audio element for both call types; mute this
          video element to prevent duplicate sound during video calls. */}
        <video ref={remoteRef} autoPlay playsInline muted className={`h-full w-full object-contain ${call.mode === 'audio' ? 'hidden' : ''}`} />
        <audio ref={remoteAudioRef} autoPlay playsInline />
        {!remote && (
          <div className="absolute inset-0 grid place-items-center">
            <Avatar name={call.peer.name} picture={call.peer.picture} className="h-28 w-28 text-3xl" />
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold">
          {call.peer.name} · {status}
        </div>
        {call.mode === 'video' && local && (
          <video ref={localRef} autoPlay playsInline muted className="absolute bottom-4 right-4 h-36 w-24 rounded-lg object-cover sm:h-48 sm:w-32" />
        )}
      </div>
      <div className="flex justify-center p-5">
        <button type="button" onClick={onEnd} className="inline-flex items-center gap-2 rounded-full bg-[#dc2626] px-6 py-3 text-sm font-bold text-white">
          <PhoneOff className="h-5 w-5" aria-hidden="true" />End call
        </button>
      </div>
    </div>
  );
}

// Lists the online admins. Pressing a button rings only that admin.
function CallPanel() {
  const { online, start, call } = useCall();
  return (
    <Card t="Admins online" sub="Choose an admin to call. Only that admin will ring.">
      {online.length === 0 && <Empty>No other admin is online.</Empty>}
      {online.map((p) => (
        <div key={p.email} className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 py-3 first:border-t-0">
          <Person p={p} sub={p.page ? `On ${p.page}` : 'Online'} />
          <span className="flex gap-2">
            <Btn disabled={!!call} onClick={() => start(p, 'audio')}><Phone className="h-4 w-4" aria-hidden="true" />Audio</Btn>
            <Btn c="bl" disabled={!!call} onClick={() => start(p, 'video')}><Video className="h-4 w-4" aria-hidden="true" />Video</Btn>
          </span>
        </div>
      ))}
    </Card>
  );
}

function Dashboard({ user, opts, intent, onIntentDone, onLogout, onRefreshMe, onChampionsSaved, dark, onToggleDark }) {
  const isAdmin = user.role === 'admin';
  const items = isAdmin
    ? [...ADMIN_TABS, 'Lost & Found', 'Profile']
    : [user.role === 'student' ? 'My labs' : 'Bookings', ...(user.comm ? ['Lost & Found', 'Champions League'] : []), 'Profile'];
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
  else if (page === 'Champions League' && (isAdmin || user.comm)) body = <ChampionsManager champions={opts.champions} onSaved={onChampionsSaved} />;
  else if (isAdmin) {
    if (page === 'Overview') body = <OverviewPage me={user} />;
    else if (page === 'History') body = <HistoryPage />;
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
          {items.map((x) => {
            const Icon = NAV_ICON[x] || UserRound;
            return (
              <button key={x} type="button" onClick={() => go(x)} aria-current={page === x ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-xs font-semibold ${page === x ? 'bg-[#16a34a] text-white' : 'text-black/70 hover:bg-black/5'}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />{x}<NavBadge n={badgeOf(x)} />
              </button>
            );
          })}
        </nav>
        <div className="mt-4 rounded-[8px] bg-black/[0.04] p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} picture={user.picture} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{user.name}</div>
              <div className="text-[11px] text-black/55">{user.comm && user.role !== 'admin' ? 'Minister of Communication' : ROLE_LABEL[user.role] || user.role}</div>
            </div>
          </div>
          <button type="button" onClick={onToggleDark} className="mt-3 flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left text-xs font-semibold hover:bg-black/5">
            {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}{dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" onClick={onLogout} className="mt-1 flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left text-xs font-semibold text-[#ff4500] hover:bg-[#ff4500]/10">
            <LogOut className="h-4 w-4" aria-hidden="true" />Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-black/10 bg-white lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo />
            <div className="flex items-center gap-2">
              <ThemeBtn dark={dark} onToggle={onToggleDark} />
              <Btn c="w" onClick={onLogout}><LogOut className="h-4 w-4" aria-hidden="true" />Log out</Btn>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Main">
            {items.map((x) => {
              const Icon = NAV_ICON[x] || UserRound;
              return (
                <button key={x} type="button" onClick={() => go(x)}
                  className={`flex shrink-0 items-center gap-2 rounded-[6px] px-3 py-2 text-xs font-semibold ${page === x ? 'bg-[#16a34a] text-white' : 'text-black/70 hover:bg-black/5'}`}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />{x}{badgeOf(x) > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[#ff4500] px-1 text-[9px] font-bold text-white">{badgeOf(x)}</span>}
                </button>
              );
            })}
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
  const [showStartupAnnouncements, setShowStartupAnnouncements] = useState(false);
  const [user, setUser] = useState(null);
  const [opts, setOpts] = useState(EMPTY_OPTS);
  const [booting, setBooting] = useState(!!getToken());
  const [intent, setIntent] = useState(null);
  // Light and dark mode for the whole site (landing, sign in and dashboard). Remembered on this device.
  const [dark, setDark] = useState(() => localStorage.getItem('lms_dark') === 'true');
  useEffect(() => {
    localStorage.setItem('lms_dark', String(dark));
    document.body.style.background = dark ? '#000000' : '';
  }, [dark]);

  const toggleDark = () => setDark((v) => !v);

  const loadOpts = () => api('/api/options').then((o) => setOpts({ ...EMPTY_OPTS, ...o })).catch(() => {});
  useLive({ 'champions:update': loadOpts });
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
    setShowStartupAnnouncements(false);
    setView('app');
  };
  const logout = () => { setToken(''); dropSocket(); setUser(null); setIntent(null); setShowStartupAnnouncements(false); setView('home'); };
  const goLogin = (i) => { setIntent(i && i.sessionId ? i : null); setView('login'); };

  let page;
  if (booting) page = <Loader full label="Loading" />;
  else if (view === 'app' && user) page = (
    <CallProvider me={user}>
      <Dashboard user={user} opts={opts} intent={intent} onIntentDone={() => setIntent(null)} onLogout={logout} onRefreshMe={refreshMe} onChampionsSaved={(champions) => setOpts((current) => ({ ...current, champions }))} dark={dark} onToggleDark={toggleDark} />
    </CallProvider>
  );
  else if (view === 'login') page = <Auth onDone={handleAuth} onBack={() => setView('home')} intent={intent} dark={dark} onToggleDark={toggleDark} />;
  else page = (
    <>
      <Landing onLogin={goLogin} dark={dark} onToggleDark={toggleDark} champions={opts.champions} />
      {view === 'home' && showStartupAnnouncements && (
        <StartupAnnouncements
          onClose={() => setShowStartupAnnouncements(false)}
          onStopRepeat={() => setShowStartupAnnouncements(false)}
        />
      )}
    </>
  );

  return (
    <div className={dark ? 'lms-dark min-h-screen' : 'min-h-screen'}>
      <style>{GLOBAL_CSS + LANDING_CSS}</style>
      <ConfirmProvider>{page}</ConfirmProvider>
    </div>
  );
}