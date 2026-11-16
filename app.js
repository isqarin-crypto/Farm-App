'use strict';
/* Farm Manager — offline single-phone farm records. Data lives in this browser's localStorage. */

const KEY = 'farmapp.v1';
const app = document.getElementById('app');

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const fd = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const fdy = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fdl = s => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 1000) / 1000;
const fmt = n => { const x = r2(n); return Math.abs(x) >= 100 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100); };
const byDate = (a, b) => a.date.localeCompare(b.date);
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0);

const I = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  leaf: '<path d="M5 21c0-9 6-15 15-16-1 9-7 15-15 16z"/><path d="M5 21l8-8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  drop: '<path d="M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};
const ic = (n, s = 22, sw = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

const TYPES = { spray: 'Spray', fertigation: 'Fertigation', scouting: 'Scouting', irrigation: 'Irrigation', task: 'Task', other: 'Other' };

/* ---------- storage ---------- */
function blank() { return { v: 1, settings: { farmName: 'My farm', lastBackup: null, sample: false }, blocks: [], stock: [], records: [], power: [], txns: [], rates: [], issues: [], lists: defaultLists() }; }
let storageOK = true;
function load() {
  try { const s = localStorage.getItem(KEY); if (s) return Object.assign(blank(), JSON.parse(s)); }
  catch (e) { storageOK = false; }
  return null;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); storageOK = true; }
  catch (e) { storageOK = false; toast('Could not save on this device. Export a backup from Settings now.'); }
}
let db = load();
function normalize(d) {
  if (!d) return d;
  ['blocks', 'stock', 'records', 'power', 'txns', 'rates'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  d.txns.forEach(t => { if (!t.currency) t.currency = (d.settings.currency || '').toUpperCase() === 'SLSH' ? 'SLSH' : 'USD'; if (t.rate === undefined) t.rate = ''; if (!Array.isArray(t.payments)) t.payments = []; });
  d.blocks.forEach(b => { if (!Array.isArray(b.history)) b.history = []; });
  if (!Array.isArray(d.issues)) d.issues = [];
  d.issues.forEach(i => { if (!Array.isArray(i.photos)) i.photos = []; if (!Array.isArray(i.updates)) i.updates = []; i.updates.forEach(u => { if (!Array.isArray(u.photos)) u.photos = []; }); if (!i.status) i.status = 'active'; });
  normalizeLists(d);
  if (aiReady) ensureAI(d);
  return d;
}
if (db) { normalize(db); save(); }
if (!db) { db = normalize(sampleData()); save(); }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* optional */ }

/* ---------- templates ---------- */
function tomatoStages() {
  return [
    { name: 'Establishment', start: 0, end: 20, nutrition: 'Root development; light, frequent irrigation', watch: 'Damping-off, cutworm' },
    { name: 'Vegetative', start: 21, end: 45, nutrition: 'N-led balanced feed', watch: 'Whitefly, Tuta absoluta' },
    { name: 'Flowering & fruit set', start: 46, end: 70, nutrition: 'Raise K and Ca; steady moisture against blossom-end rot', watch: 'Tuta absoluta, Whitefly / TYLCV, Early blight' },
    { name: 'Fruit fill', start: 71, end: 95, nutrition: 'K-led feed; plan sprays around PHI before first pick', watch: 'Tuta absoluta, Late blight' },
    { name: 'Harvest', start: 96, end: 120, nutrition: 'Maintain K; log yield per pick', watch: 'Short-PHI products only' }
  ];
}
function genericStages(days) {
  days = Math.max(10, Math.round(num(days) || 100));
  const names = ['Establishment', 'Vegetative', 'Flowering / bulking', 'Maturation', 'Harvest'];
  const f = [0, .17, .38, .6, .8, 1];
  return names.map((n, i) => ({ name: n, start: i ? Math.round(f[i] * days) + 1 : 0, end: Math.round(f[i + 1] * days), nutrition: '', watch: '' }));
}

/* ---------- sample data (relative to today) ---------- */
function sampleData() {
  const t = today(), d = n => addDays(t, n);
  const s = blank();
  s.settings = { farmName: 'Sample farm', lastBackup: null, sample: true };
  const A = uid(), B = uid() + 'b', C = uid() + 'c', D = uid() + 'd';
  s.blocks = [
    { id: A, name: 'Block A', crop: 'Tomato', variety: '', areaHa: 0.5, irrigation: 'Drip', planted: d(-54), cycleDays: 120, status: 'active', notes: '', stages: tomatoStages() },
    { id: B, name: 'Block B', crop: 'Sweet pepper', variety: '', areaHa: 0.4, irrigation: 'Drip', planted: d(-32), cycleDays: 140, status: 'active', notes: '', stages: genericStages(140) },
    { id: C, name: 'Block C', crop: 'Onion', variety: '', areaHa: 0.7, irrigation: 'Drip', planted: d(-88), cycleDays: 130, status: 'active', notes: '', stages: genericStages(130) },
    { id: D, name: 'Block D', crop: '', variety: '', areaHa: 0.5, irrigation: 'Drip', planted: '', cycleDays: '', status: 'fallow', notes: 'Solarising', stages: [] }
  ];
  const st = (name, category, ai, group, unit, qty, reorderAt, expiry, phiDays) => ({ id: uid() + Math.random().toString(36).slice(2, 5), name, category, ai, group, unit, qty, reorderAt, expiry, phiDays, notes: '' });
  const can = st('Calcium nitrate', 'fertiliser', '15.5-0-0 + Ca', '', 'kg', 50, 75, '', '');
  const kno = st('Potassium nitrate', 'fertiliser', '13-0-46', '', 'kg', 100, 50, '', '');
  const map = st('MAP', 'fertiliser', '12-61-0', '', 'kg', 150, 50, '', '');
  const aba = st('Abamectin 1.8% EC', 'insecticide', 'abamectin 18 g/L', 'IRAC 6', 'L', 3, 1, d(140), '');
  const spi = st('Spinosad SC', 'insecticide', 'spinosad', 'IRAC 5', 'L', 0.5, 0.5, d(220), '');
  const chl = st('Chlorantraniliprole SC', 'insecticide', 'chlorantraniliprole', 'IRAC 28', 'L', 0.8, 0.3, d(360), '');
  const man = st('Mancozeb 80 WP', 'fungicide', 'mancozeb 800 g/kg', 'FRAC M03', 'kg', 5, 2, d(-300), '');
  s.stock = [can, kno, map, aba, spi, chl, man];
  const rec = (o) => Object.assign({ id: uid() + Math.random().toString(36).slice(2, 6), created: Date.now(), type: 'other', status: 'done', date: t, blockId: '', title: '', target: '', lines: [], waterLha: '', tankL: '', phiDays: '', ec: '', ph: '', severity: '', count: '', minutes: '', m3: '', notes: '', used: null }, o);
  s.records = [
    rec({ type: 'other', title: 'Transplanted', blockId: A, date: d(-54), notes: 'Seedlings from nursery; drip laid' }),
    rec({ type: 'spray', blockId: A, date: d(-17), target: 'Tuta absoluta', lines: [{ stockId: chl.id, amount: '', basis: 'ha' }], waterLha: 400 }),
    rec({ type: 'scouting', blockId: A, date: d(-7), target: 'Tuta absoluta', severity: 'moderate', notes: 'Mines rising on lower leaves' }),
    rec({ type: 'fertigation', blockId: A, date: d(-5), lines: [{ stockId: can.id, amount: '', basis: 'total' }, { stockId: kno.id, amount: '', basis: 'total' }], notes: 'Sample entry — amounts not set' }),
    rec({ type: 'spray', blockId: A, date: d(-4), target: 'Tuta absoluta', lines: [{ stockId: aba.id, amount: '', basis: 'ha' }], waterLha: 400, phiDays: 7, notes: 'Sample PHI value — always use the label' }),
    rec({ type: 'fertigation', status: 'planned', blockId: A, date: d(2), lines: [{ stockId: can.id, amount: '', basis: 'total' }, { stockId: kno.id, amount: '', basis: 'total' }] }),
    rec({ type: 'scouting', status: 'planned', blockId: B, date: t, target: 'Whitefly, Tuta absoluta', notes: 'Check sticky traps, 20 plants' }),
    rec({ type: 'irrigation', status: 'planned', blockId: C, date: t, minutes: 45 }),
    rec({ type: 'task', status: 'planned', date: t, title: 'Clean disc filters', notes: 'Pressure drop high on main line' })
  ];
  s.records.forEach(r => { if (r.status === 'done') r.used = []; });
  const isA = uid() + 'ia', isC = uid() + 'ic';
  s.issues = [
    { id: isA, created: Date.now(), blockId: A, date: d(-7), kind: 'Insect pest', name: 'Tuta absoluta', severity: 'moderate', spread: 15, where: 'Rows 1–6, lower leaves', symptoms: 'Sample entry: leaf mines on lower leaves, a few frass spots. Add your own photos with the Camera or Gallery buttons.', cause: '', conditions: 'Warm, dry week', status: 'monitoring', resolvedOn: '', outcome: '', photos: [], snap: { crop: 'Tomato', variety: '', day: 47, stage: 'Flowering & fruit set' },
      updates: [{ id: uid() + 'u1', created: Date.now(), date: d(-4), severity: 'moderate', spread: 12, status: 'monitoring', note: 'Sample entry: sprayed after scouting. Fewer new mines on the top leaves.', photos: [] }] },
    { id: isC, created: Date.now(), blockId: C, date: d(-45), kind: 'Disease', name: 'Downy mildew', severity: 'low', spread: 5, where: 'Low corner near the filter', symptoms: 'Sample entry: pale patches on older leaves after a humid spell.', cause: 'Humid nights', conditions: '', status: 'resolved', resolvedOn: d(-30), outcome: 'Dried out after the weather changed; no spread to other rows.', photos: [], snap: { crop: 'Onion', variety: '', day: 43, stage: 'Flowering / bulking' }, updates: [] }
  ];
  s.records.forEach(r => { if (r.blockId === A && ((r.type === 'scouting' && r.status === 'done') || (r.type === 'spray' && r.target === 'Tuta absoluta' && r.date === d(-4)))) r.issueId = isA; });
  const pv = [19.8, 22.1, 20.4, 23.0, 18.2, 21.7, 21.5], m3 = [16.9, 19.2, 17.5, 20.1, 15.3, 18.8, 18.4], tk = [64, 70, 66, 75, 58, 69, 72];
  const tx = (o) => Object.assign({ id: uid() + Math.random().toString(36).slice(2, 6), created: Date.now(), currency: 'USD', rate: '', kind: 'expense', category: 'Other expense', date: t, amount: 0, party: '', method: 'Cash', blockId: '', crop: '', qty: '', unit: 'kg', price: '', credit: false, due: '', payments: [], notes: '', stockId: '' }, o);
  s.txns = [
    tx({ kind: 'income', category: 'Crop sales', date: d(-40), blockId: D, crop: 'Onion', qty: 1200, unit: 'kg', price: 0.45, amount: 540, party: 'Market trader', method: 'Zaad' }),
    tx({ kind: 'income', category: 'Crop sales', date: d(-30), blockId: D, crop: 'Onion', qty: 600, unit: 'kg', price: 0.45, amount: 270, party: 'Restaurant client', credit: true, due: d(-10), payments: [{ id: 'p1', date: d(-20), amount: 100, method: 'Cash' }] }),
    tx({ category: 'Seeds & seedlings', date: d(-56), blockId: A, amount: 180, party: 'Nursery', method: 'Cash' }),
    tx({ category: 'Fertiliser', date: d(-12), amount: 140, party: 'Agro supplier', credit: true, due: d(-2), payments: [{ id: 'p2', date: d(-12), amount: 60, method: 'eDahab' }], notes: 'Calcium nitrate + potassium nitrate' }),
    tx({ category: 'Labour', date: d(-7), amount: 120, party: 'Casual workers', method: 'Cash', notes: 'Weeding and staking' }),
    tx({ category: 'Labour', date: d(-3), blockId: A, amount: 45, party: 'Casual workers', method: 'Cash', notes: 'Pruning Block A' }),
    tx({ category: 'Fuel & energy', date: d(-10), amount: 35, party: 'Fuel station', method: 'Zaad', notes: 'Backup generator' })
  ];
  s.power = pv.map((p, i) => ({ id: uid() + i, date: d(i - 6), pvKwh: p, m3: m3[i], tankPct: tk[i], notes: '' }));
  return s;
}

/* ---------- domain logic ---------- */
const blockById = id => db.blocks.find(b => b.id === id);
const stockById = id => db.stock.find(s => s.id === id);
const blockLabel = b => b ? b.name + (b.crop ? ' — ' + b.crop : '') : 'Whole farm';
const isActive = b => b.status !== 'fallow' && b.status !== 'harvested';
function cropDay(b) { return b.planted ? diff(b.planted, today()) : null; }
function planEnd(b) { return (b.stages && b.stages.length) ? Math.max(...b.stages.map(s => num(s.end))) : num(b.cycleDays); }
function currentStage(b) {
  const d = cropDay(b);
  if (d == null || !b.stages || !b.stages.length) return null;
  const s = b.stages.find(x => d >= num(x.start) && d <= num(x.end));
  if (s) return s;
  return d > planEnd(b) ? { name: 'Past plan end', past: true } : null;
}
/* multi-day work: r.date = first day, r.endDate = last day (optional), r.extLog = [{on, from, to, why}] */
const recEnd = r => (r.endDate && r.endDate > r.date ? r.endDate : r.date);
const recDays = r => diff(r.date, recEnd(r)) + 1;
function periodText(r) {
  if (recEnd(r) === r.date) return '';
  const n = (r.extLog || []).length;
  return `${fd(r.date)} – ${fd(recEnd(r))} · ${recDays(r)} days${n ? ` · extended ${n === 1 ? 'once' : n + ' times'}` : ''}`;
}
function phiEnd(b, excludeId) {
  let end = null;
  for (const r of db.records) {
    if (r.blockId === b.id && r.type === 'spray' && r.status === 'done' && r.id !== excludeId && num(r.phiDays) > 0 && r.date >= (b.cycleFrom || '0000-01-01')) {
      const e = addDays(recEnd(r), num(r.phiDays));
      if (!end || e > end) end = e;
    }
  }
  return end && end > today() ? end : null;
}
const recGroups = r => [...new Set((r.lines || []).map(l => (stockById(l.stockId)?.group || '').trim()).filter(Boolean))];
function lineQty(l, b) { const a = num(l.amount); return l.basis === 'ha' ? a * (b ? num(b.areaHa) : 0) : a; }
function stockFlags(s) {
  const f = [];
  if (num(s.reorderAt) > 0 && num(s.qty) <= num(s.reorderAt)) f.push('low');
  if (num(s.qty) < 0) f.push('negative');
  if (s.expiry) { const d = diff(today(), s.expiry); if (d < 0) f.push('expired'); else if (d <= 60) f.push('soon'); }
  return f;
}
const qtyStr = s => `${fmt(num(s.qty))} ${s.unit}`;
function deduct(r) {
  const b = blockById(r.blockId);
  r.used = (r.lines || []).filter(l => stockById(l.stockId) && num(l.amount) > 0).map(l => ({ stockId: l.stockId, qty: r2(lineQty(l, b)) }));
  for (const u of r.used) { const s = stockById(u.stockId); s.qty = r2(num(s.qty) - u.qty); }
}
function restore(r) {
  for (const u of r.used || []) { const s = stockById(u.stockId); if (s) s.qty = r2(num(s.qty) + u.qty); }
  r.used = null;
}
function setDone(r, done) {
  if (done && r.status !== 'done') { r.status = 'done'; r.doneOn = today(); if (r.endDate && today() >= r.date && today() < r.endDate) r.endDate = today() > r.date ? today() : ''; deduct(r); }
  else if (!done && r.status === 'done') { restore(r); r.status = 'planned'; }
}
function recTitle(r) {
  const prods = (r.lines || []).map(l => stockById(l.stockId)?.name).filter(Boolean).join(' + ');
  if (r.type === 'activity') return (r.activity || 'Activity') + (r.title ? ' · ' + r.title : '');
  if (r.type === 'task' || r.type === 'other') return r.title || TYPES[r.type];
  return TYPES[r.type] + (prods ? ' · ' + prods : '');
}
function recSub(r, showBlock = true) {
  const p = [];
  if (r.status === 'done' && periodText(r)) p.push(periodText(r));
  if (showBlock && r.blockId) p.push(blockLabel(blockById(r.blockId)));
  if (r.target) p.push(r.target);
  if (r.issueId && issueById(r.issueId)) p.push('Problem: ' + issueName(issueById(r.issueId)));
  if (r.type === 'irrigation') { if (num(r.minutes)) p.push(fmt(num(r.minutes)) + ' min'); if (num(r.m3)) p.push(fmt(num(r.m3)) + ' m³'); }
  if (r.type === 'scouting' && r.severity) p.push('Pressure: ' + r.severity);
  if (r.type === 'fertigation' && (r.ec || r.ph)) p.push([r.ec ? 'EC ' + r.ec : '', r.ph ? 'pH ' + r.ph : ''].filter(Boolean).join(' '));
  if (r.type === 'spray' && r.status === 'done' && num(r.phiDays) > 0) p.push('PHI to ' + fd(addDays(recEnd(r), num(r.phiDays))));
  if (r.notes) p.push(r.notes.length > 60 ? r.notes.slice(0, 60) + '…' : r.notes);
  return p.join(' · ');
}
function lastSprays(blockId, excludeId, beforeDate) {
  return db.records.filter(r => r.blockId === blockId && r.type === 'spray' && r.status === 'done' && r.id !== excludeId && (!beforeDate || r.date <= beforeDate))
    .sort(byDateDesc).slice(0, 2).map(r => ({ date: r.date, g: recGroups(r) }));
}

/* ---------- ui state ---------- */
const ui = { hfilter: 'open', hblock: '', bscope: 'current', bfilter: 'all', rfilter: 'all', cat: 'all', q: '', mperiod: 'month', rpperiod: 'year', dtab: 'recv', dq: '', rcur: (db.settings.repCur === 'SLSH' ? 'SLSH' : 'USD'), rateOpen: false };
let tdraft = null, tdraftKey = null;
let draft = null, draftKey = null, bdraft = null, bdraftKey = null, installEvt = null;
let toastT;
function toast(m) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = m; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2800);
}

/* in-app confirm dialog (browser confirm() is blocked in some hosts) */
function ask(msg, okLabel = 'OK') {
  return new Promise(res => {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Confirm');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(23,33,27,.45);display:flex;align-items:flex-end;justify-content:center;z-index:20;padding:16px';
    wrap.innerHTML = `<div style="background:#fff;border-radius:16px;padding:18px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:14px;margin-bottom:env(safe-area-inset-bottom)"><p style="margin:0;font-size:15px;line-height:1.45">${esc(msg)}</p><div class="g2"><button class="btn" data-r="0">Cancel</button><button class="btn pri" data-r="1">${esc(okLabel)}</button></div></div>`;
    const done = v => { wrap.remove(); document.removeEventListener('keydown', key); res(v); };
    const key = e => { if (e.key === 'Escape') done(false); };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); else if (e.target === wrap) done(false); });
    document.addEventListener('keydown', key);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-r="1"]').focus();
  });
}

function askExtend(r) {
  return new Promise(res => {
    const t = today(), end = recEnd(r), base = end > t ? end : t;
    const quick = [[1, base === t ? 'Tomorrow' : '+1 day'], [2, '+2 days'], [3, '+3 days'], [7, '+1 week']];
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Extend task');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(23,33,27,.45);display:flex;align-items:flex-end;justify-content:center;z-index:20;padding:16px';
    wrap.innerHTML = `<form style="background:#fff;border-radius:16px;padding:18px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:12px;margin-bottom:env(safe-area-inset-bottom)">
      <span style="font-size:16px;font-weight:700">Extend: ${esc(recTitle(r))}</span>
      <span class="s">Started ${fd(r.date)} · currently ends ${fd(end)}</span>
      <div class="chips">${end < t ? `<button type="button" class="chip" data-d="${t}">Until today</button>` : ''}${quick.map(([n, l]) => `<button type="button" class="chip" data-d="${addDays(base, n)}">${l}</button>`).join('')}</div>
      <div class="f"><label for="ext_date">New last day</label><input id="ext_date" type="date" min="${addDays(end, 1)}" value="${addDays(base, base === end ? 1 : 0)}"></div>
      <div class="f"><label for="ext_why">Reason (optional)</label><input id="ext_why" placeholder="e.g. Rain, short of labour, bigger job than planned" autocomplete="off"></div>
      <div class="g2"><button type="button" class="btn" data-r="0">Cancel</button><button type="submit" class="btn pri">Extend</button></div></form>`;
    const di = wrap.querySelector('#ext_date');
    const done = v => { wrap.remove(); res(v); };
    wrap.addEventListener('click', e => { const c = e.target.closest('[data-d]'); if (c) { di.value = c.dataset.d; wrap.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === c)); } else if (e.target.closest('[data-r="0"]') || e.target === wrap) done(null); });
    wrap.querySelector('form').addEventListener('submit', e => { e.preventDefault(); if (!di.value || di.value <= end) { toast('Choose a day after ' + fd(end) + '.'); return; } done({ to: di.value, why: wrap.querySelector('#ext_why').value.trim() }); });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); });
    document.body.appendChild(wrap);
  });
}

/* ---------- shared fragments ---------- */
const alertH = (kind, icon, t, s, href) => `<${href ? `a href="${href}"` : 'div'} class="alert ${kind}">${ic(icon, 20, 2)}<span class="main"><span class="t">${esc(t)}</span>${s ? `<span class="s">${esc(s)}</span>` : ''}</span></${href ? 'a' : 'div'}>`;
const back = (href, label) => `<a class="back" href="${href}">${ic('back', 18, 2)}${esc(label)}</a>`;
const grpChips = r => recGroups(r).map(g => `<span class="grp">${esc(g)}</span>`).join(' ');
function taskRow(r, showBlock = true) {
  const t = today(), end = recEnd(r), late = end < t, multi = end > r.date;
  const when = late ? `<b style="color:var(--warn)">Overdue · </b>${multi ? fd(r.date) + ' – ' + fd(end) : fd(r.date)}`
    : multi && r.date <= t ? `<b style="color:var(--acc)">In progress · day ${diff(r.date, t) + 1} of ${recDays(r)}</b> · ends ${fd(end)}`
    : multi ? `${fd(r.date)} – ${fd(end)} · ${recDays(r)} days` : fd(r.date);
  const ext = r.date <= t ? `<button type="button" class="btn sm" data-act="extend" data-id="${r.id}" aria-label="Extend: ${esc(recTitle(r))}" style="flex:none">Extend</button>` : '';
  return `<div class="item planned"><input type="checkbox" class="check" data-act="toggle" data-id="${r.id}" ${r.status === 'done' ? 'checked' : ''} aria-label="Mark done: ${esc(recTitle(r))}">
  <a class="main" href="#record/${r.id}"><span class="t">${esc(recTitle(r))}</span><span class="s">${when}${(r.extLog || []).length ? ` · extended ${r.extLog.length}×` : ''}${recSub(r, showBlock) ? ' · ' + esc(recSub(r, showBlock)) : ''}</span></a>${ext}</div>`;
}
function doneRow(r, showBlock = true) {
  return `<a class="item" href="#record/${r.id}"><span class="date">${fd(r.date)}</span><span class="main"><span class="t">${esc(recTitle(r))}</span>${r.type === 'spray' && recGroups(r).length ? `<span class="row" style="gap:6px">${grpChips(r)}</span>` : ''}<span class="s">${esc(recSub(r, showBlock))}</span></span></a>`;
}
const addButtons = (blockId) => `<div class="chips">${['spray', 'fertigation', 'scouting', 'irrigation', 'task'].map(t => `<a class="chip" href="#record/new?type=${t}${blockId ? '&block=' + blockId : ''}">${ic('plus', 14, 2.2)}${TYPES[t]}</a>`).join('')}${L('activities').map(a => `<a class="chip" href="#record/new?type=activity&act=${encodeURIComponent(encodeURIComponent(a))}${blockId ? '&block=' + blockId : ''}">${ic('plus', 14, 2.2)}${esc(a)}</a>`).join('')}</div>`;

/* ---------- views ---------- */
function vToday() {
  const t = today();
  const planned = db.records.filter(r => r.status === 'planned');
  const due = planned.filter(r => r.date <= t).sort(byDate);
  const week = planned.filter(r => r.date > t && r.date <= addDays(t, 7)).sort(byDate);
  const phis = db.blocks.map(b => ({ b, e: phiEnd(b) })).filter(x => x.e);
  const alerts = [];
  if (!storageOK) alerts.push(alertH('bad', 'warn', 'This device is not saving', 'Export a backup from Settings and open the app in Chrome, not a private tab.', '#settings'));
  if (db.settings.sample) alerts.push(alertH('info', 'info', 'You are looking at sample data', 'Clear it in Settings before entering your own records.', '#settings'));
  phis.forEach(x => alerts.push(alertH('', 'clock', `${blockLabel(x.b)} — PHI active`, `No harvest before ${fdl(x.e)}`, '#block/' + x.b.id)));
  (db.issues || []).filter(i => isOpenIssue(i) && ['high', 'severe'].includes(curState(i).severity)).forEach(i => alerts.push(alertH('bad', 'warn', `${issueName(i)} — ${curState(i).severity} on ${(blockById(i.blockId) || {}).name || 'a field'}`, `Open since ${fdy(i.date)}. Add a follow-up when you re-check.`, '#issue/' + i.id)));
  db.stock.forEach(s => {
    const f = stockFlags(s);
    if (f.includes('expired')) alerts.push(alertH('bad', 'warn', `${s.name} — expired`, `Expiry ${fdy(s.expiry)}. Do not use; dispose of it safely.`, '#stockedit/' + s.id));
    else if (f.includes('soon')) alerts.push(alertH('', 'clock', `${s.name} expires ${fdy(s.expiry)}`, `${qtyStr(s)} left`, '#stockedit/' + s.id));
    if (f.includes('negative')) alerts.push(alertH('bad', 'box', `${s.name} — stock below zero`, 'Usage recorded is more than stock on hand. Count it and correct.', '#stockedit/' + s.id));
    else if (f.includes('low')) alerts.push(alertH('', 'box', `Low stock — ${s.name}`, `${qtyStr(s)} left · reorder level ${fmt(num(s.reorderAt))} ${s.unit}`, '#stockedit/' + s.id));
  });
  const odR = (db.txns || []).filter(x => x.kind === 'income' && isOverdue(x)), odP = (db.txns || []).filter(x => x.kind === 'expense' && isOverdue(x));
  const owedTxt = l => { const m = {}; l.forEach(x => { m[x.currency || 'USD'] = (m[x.currency || 'USD'] || 0) + balanceOf(x); }); return Object.entries(m).map(([c, v]) => money(v, c)).join(' + '); };
  const lr = latestRate();
  if (db.txns.length && (!lr || diff(lr.date, t) > 7)) alerts.push(alertH('', 'coin', lr ? `Exchange rate is ${diff(lr.date, t)} days old` : 'Set the USD–SLSH exchange rate', lr ? `Last: 1 USD = ${fmtRate(lr.rate)} SLSH on ${fdy(lr.date)}. Update it on the Money screen.` : 'Needed for shilling sales and combined totals.', '#money'));
  if (odR.length) alerts.push(alertH('', 'coin', `Overdue from customers — ${owedTxt(odR)}`, [...new Set(odR.map(x => x.party || 'No name'))].join(', '), '#debts?tab=recv'));
  if (odP.length) alerts.push(alertH('', 'coin', `Overdue to suppliers — ${owedTxt(odP)}`, [...new Set(odP.map(x => x.party || 'No name'))].join(', '), '#debts?tab=pay'));
  if (!db.settings.lastBackup || diff(db.settings.lastBackup, t) > 14) alerts.push(alertH('', 'warn', 'Back up your records', db.settings.lastBackup ? `Last backup ${fdy(db.settings.lastBackup)}` : 'No backup yet. Export a file from Settings.', '#settings'));
  const lp = [...db.power].sort(byDateDesc)[0];
  return `
  <div class="between"><div class="col"><span class="eyebrow">${esc(fdl(t))}</span><h1>${esc(db.settings.farmName || 'Today')}</h1></div><a class="ib" href="#settings" aria-label="Settings">${ic('gear', 20)}</a></div>
  <div class="dark"><div class="g3">
    <div class="col"><span class="k">Active blocks</span><span class="v">${db.blocks.filter(isActive).length}</span></div>
    <div class="col"><span class="k">Due today</span><span class="v">${due.length}</span></div>
    <div class="col"><span class="k">PHI active</span><span class="v">${phis.length}</span></div>
  </div></div>
  ${alerts.length ? `<h2>Needs attention</h2>${alerts.join('')}` : ''}
  <div class="between"><h2>Today${due.some(r => r.date < t) ? ' & overdue' : ''}</h2><span class="s">${due.length} open</span></div>
  ${due.length ? `<div class="list">${due.map(r => taskRow(r)).join('')}</div>` : `<div class="empty">Nothing planned for today.</div>`}
  ${week.length ? `<div class="between"><h2>Next 7 days</h2></div><div class="list">${week.map(r => taskRow(r)).join('')}</div>` : ''}
  <h2>Add a record</h2>${addButtons('')}
  <a class="card" href="#ai" style="flex-direction:row;align-items:center;gap:14px"><span class="ib" style="background:var(--accbg);color:var(--acc);border:0">${ic('search', 22)}</span><span class="main"><span class="t">Ask AI</span><span class="s">Ask about your records (free, answered on the phone), identify a pest or disease from photos, or get advice</span></span>${ic('chev', 18, 2)}</a>
  ${lp ? `<a class="card" href="#power" style="flex-direction:row;align-items:center;gap:14px"><span class="ib" style="background:var(--waterbg);color:var(--water);border:0">${ic('drop', 22)}</span><span class="main"><span class="t">${lp.tankPct !== '' && lp.tankPct != null ? `Tank ${fmt(num(lp.tankPct))}% · ` : ''}${fmt(num(lp.m3))} m³ pumped</span><span class="s">Last log ${fd(lp.date)} · ${fmt(num(lp.pvKwh))} kWh PV</span></span>${ic('chev', 18, 2)}</a>` : ''}`;
}

function vFields() {
  const card = b => {
    const day = cropDay(b), st = currentStage(b), pe = phiEnd(b), end = planEnd(b);
    const next = db.records.filter(r => r.blockId === b.id && r.status === 'planned').sort(byDate)[0];
    const oi = (db.issues || []).filter(i => i.blockId === b.id && isOpenIssue(i)).length;
    const pct = day != null && end ? Math.max(0, Math.min(100, day / end * 100)) : 0;
    if (!isActive(b)) return `<a class="card dash" href="#block/${b.id}"><div class="between"><div class="col"><span class="s">${esc(b.name)} · ${fmt(num(b.areaHa))} ha</span><h2 style="font-size:17px">${b.status === 'fallow' ? 'Fallow' : 'Harvested' + (b.crop ? ' · ' + esc(b.crop) : '')}${b.notes ? ' · ' + esc(b.notes) : ''}</h2></div>${ic('chev', 18, 2)}</div></a>`;
    return `<a class="card" href="#block/${b.id}">
      <div class="between" style="align-items:flex-start"><div class="col"><span class="s">${esc(b.name)} · ${fmt(num(b.areaHa))} ha${b.irrigation ? ' · ' + esc(b.irrigation) : ''}</span><h2 style="font-size:17px">${esc(b.crop || 'No crop set')}</h2></div>
      ${pe ? `<span class="badge b-warn">PHI to ${fd(pe)}</span>` : next && next.date <= today() ? `<span class="badge b-ok">Due today</span>` : ''}</div>
      ${day != null ? `<div class="col" style="gap:6px"><div class="between s"><span>${esc(st ? st.name : 'No stage plan')}</span><span class="mono">Day ${day}${end ? ' / ' + end : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>` : ''}
      <div class="between" style="font-size:13px;border-top:1px solid var(--line2);padding-top:10px"><span>${next ? `Next: <strong>${esc(recTitle(next))}</strong> · ${fd(next.date)}` : '<span class="s">Nothing planned</span>'}</span>${oi ? `<span class="badge b-bad">${oi} problem${oi > 1 ? 's' : ''}</span>` : ''}</div></a>`;
  };
  const area = db.blocks.filter(isActive).reduce((a, b) => a + num(b.areaHa), 0);
  return `<div class="between"><h1>Fields</h1><a class="btn pri sm" href="#blockedit/new">${ic('plus', 16, 2.2)}New block</a></div>
  ${fieldsSeg('blocks', (db.issues || []).filter(isOpenIssue).length)}
  <div class="tiles"><div class="tile"><span class="k">Planted</span><span class="v">${fmt(area)} ha</span></div><div class="tile"><span class="k">Blocks</span><span class="v">${db.blocks.filter(isActive).length} / ${db.blocks.length}</span></div><div class="tile"><span class="k">Planned</span><span class="v">${db.records.filter(r => r.status === 'planned').length}</span></div></div>
  ${db.blocks.length ? db.blocks.map(card).join('') : `<div class="empty">No blocks yet.<a class="btn pri sm" href="#blockedit/new">Add your first block</a></div>`}`;
}

function blockHeader(b) {
  const day = cropDay(b);
  return `${back('#fields', 'Fields')}
  <div class="between" style="align-items:flex-end"><div class="col"><span class="eyebrow">${esc(b.name)} · ${fmt(num(b.areaHa))} ha${b.irrigation ? ' · ' + esc(b.irrigation) : ''}</span><h1>${esc(b.crop || (b.status === 'fallow' ? 'Fallow' : 'No crop set'))}</h1></div><a class="ib" href="#blockedit/${b.id}" aria-label="Edit block">${ic('edit', 20)}</a></div>
  <div class="tiles"><div class="tile"><span class="k">Planted</span><span class="v">${fd(b.planted)}</span></div><div class="tile"><span class="k">Crop day</span><span class="v">${day == null ? '—' : day}</span></div><div class="tile"><span class="k">Variety</span><span class="v">${esc(b.variety || '—')}</span></div></div>`;
}
function vBlock(id) {
  const b = blockById(id); if (!b) return vMissing();
  const pe = phiEnd(b);
  const hasHist = (b.history || []).length > 0;
  const scope = hasHist ? ui.bscope : 'all';
  const all = db.records.filter(r => r.blockId === b.id && (ui.bfilter === 'all' || r.type === ui.bfilter));
  const planned = all.filter(r => r.status === 'planned').sort(byDate);
  const done = all.filter(r => r.status === 'done' && (scope === 'all' || r.date >= curFrom(b))).sort(byDateDesc);
  const cf = b.crop ? rangeFinance(b.id, curFrom(b), '9999-12-31') : null;
  const chips = ['all', 'spray', 'fertigation', 'scouting', 'irrigation', 'activity', 'task'].map(k => `<button class="chip ${ui.bfilter === k ? 'on' : ''}" data-act="bfilter" data-v="${k}" aria-pressed="${ui.bfilter === k}">${k === 'all' ? 'All' : k === 'activity' ? 'Activities' : TYPES[k]}</button>`).join('');
  return `${blockHeader(b)}
  ${pe ? alertH('', 'clock', 'PHI active', `No harvest before ${fdl(pe)}`) : ''}
  ${cycleNeedsNew(b) ? `<a class="alert ok" href="#newcycle/${b.id}">${ic('leaf', 20, 2)}<span class="main"><span class="t">${b.status === 'harvested' ? 'Crop harvested' : 'Past the end of the season plan'}</span><span class="s">Finish this crop and start the next one in ${esc(b.name)}.</span></span></a>` : ''}
  ${cf && (cf.n || cf.inputs) ? `<div class="dark"><span class="k">This crop so far</span>${finSummary(cf, b)}</div>` : ''}
  ${healthCard(b, scope)}
  <div class="seg"><a class="on" href="#block/${b.id}" aria-current="page">History</a><a href="#season/${b.id}">Season plan</a></div>
  ${hasHist ? `<div class="seg" role="group" aria-label="Records shown"><button class="${scope === 'current' ? 'on' : ''}" data-act="bscope" data-v="current" aria-pressed="${scope === 'current'}">${esc(b.crop || 'Since last crop')}</button><button class="${scope === 'all' ? 'on' : ''}" data-act="bscope" data-v="all" aria-pressed="${scope === 'all'}">All crops</button></div>` : ''}
  <div class="chips">${chips}</div>
  <p class="sec">Planned</p>${planned.length ? `<div class="list">${planned.map(r => taskRow(r, false)).join('')}</div>` : `<div class="empty">Nothing planned.</div>`}
  <p class="sec">Completed</p>${done.length ? `<div class="list">${done.map(r => doneRow(r, false)).join('')}</div>` : `<div class="empty">No records yet.</div>`}
  <h2>Add to ${esc(b.name)}</h2>${addButtons(b.id)}
  <a class="btn block" href="#ai?block=${b.id}">${ic('search', 18, 2)}Ask AI about ${esc(b.crop || b.name)}</a>
  <a class="btn ${cycleNeedsNew(b) || !b.crop ? 'pri' : ''} block" href="#newcycle/${b.id}">${ic('leaf', 18, 2)}${b.crop ? 'Finish crop & start new' : 'Start a new crop'}</a>
  ${pastCropsHtml(b)}`;
}

function vSeason(id) {
  const b = blockById(id); if (!b) return vMissing();
  const day = cropDay(b);
  const stages = [...(b.stages || [])].sort((a, c) => num(a.start) - num(c.start));
  let body;
  if (!b.planted || !stages.length) {
    body = `<div class="empty">${!b.planted ? 'Set a planting date' : 'Add growth stages'} to see the season plan.<a class="btn pri sm" href="#blockedit/${b.id}">Edit block</a></div>`;
  } else {
    const total = planEnd(b) || 1;
    const segs = stages.map(s => {
      const w = (num(s.end) - num(s.start) + 1) / (total + 1) * 100;
      let fill = 0; if (day > num(s.end)) fill = 100; else if (day >= num(s.start)) fill = (day - num(s.start) + 1) / (num(s.end) - num(s.start) + 1) * 100;
      return `<i style="width:${w}%;background:linear-gradient(90deg,var(--acc) 0 ${fill}%,#E3E7DF ${fill}% 100%)"></i>`;
    }).join('');
    const marker = Math.max(0, Math.min(100, day / total * 100));
    const firstHarvest = stages.find(s => /harvest/i.test(s.name));
    const cards = stages.map((s, i) => {
      const from = addDays(b.planted, num(s.start)), to = addDays(b.planted, num(s.end));
      const state = day > num(s.end) ? 'done' : day >= num(s.start) ? 'now' : 'next';
      const watch = String(s.watch || '').split(',').map(x => x.trim()).filter(Boolean);
      const n = db.records.filter(r => r.blockId === b.id && r.status === 'planned' && r.date >= from && r.date <= to).length;
      const head = `<div class="between" style="align-items:flex-start"><div class="col"><span class="t" style="font-size:${state === 'now' ? 16 : 14}px">${i + 1} · ${esc(s.name)}</span><span class="mono s" style="font-size:11px">Day ${num(s.start)}–${num(s.end)} · ${fd(from)} – ${fd(to)}</span></div>${state === 'done' ? `<span class="badge b-ok">Done</span>` : state === 'now' ? `<span class="badge b-pri">Now</span>` : ''}</div>`;
      if (state === 'now') return `<div class="card now">${head}
        ${s.nutrition ? `<div class="col" style="gap:4px"><span class="k" style="font-weight:600">Nutrition</span><span style="font-size:13px">${esc(s.nutrition)}</span></div>` : ''}
        ${watch.length ? `<div class="col" style="gap:6px"><span class="k" style="font-weight:600">Protection watch</span><div class="chips">${watch.map(w => `<span class="badge b-mut" style="font-size:12px">${esc(w)}</span>`).join('')}</div></div>` : ''}
        <div class="between" style="border-top:1px solid var(--line2);padding-top:10px"><span class="s">${n} planned in this stage</span><a href="#block/${b.id}" style="font-size:13px;font-weight:600">View</a></div></div>`;
      return `<div class="card ${state === 'next' ? 'dash' : ''}" style="${state === 'done' ? 'opacity:.85' : ''}">${head}${state === 'next' && (s.nutrition || s.watch) ? `<span class="s">${esc([s.nutrition, s.watch].filter(Boolean).join(' · '))}</span>` : ''}</div>`;
    }).join('');
    body = `<div class="card"><div class="between"><span class="t">Day ${Math.max(0, day)} of ${total}</span><span class="s">${firstHarvest ? 'Harvest from ' + fd(addDays(b.planted, num(firstHarvest.start))) : 'Ends ' + fd(addDays(b.planted, total))}</span></div>
      <div class="progress" role="img" aria-label="Season progress, day ${day} of ${total}">${segs}<b style="left:${marker}%"></b></div>
      <div class="between mono s" style="font-size:11px"><span>${fd(b.planted)}</span><span>${fd(addDays(b.planted, total))}</span></div></div>${cards}
      <p class="hint">Stage plan is yours to adjust: dates and focus notes come from the block's stages, not from a crop database.</p>`;
  }
  return `${blockHeader(b)}<div class="seg"><a href="#block/${b.id}">History</a><a class="on" href="#season/${b.id}" aria-current="page">Season plan</a></div>${body}`;
}

/* ----- block edit ----- */
function initBDraft(id) {
  if (id === 'new') return { id: null, name: `Block ${String.fromCharCode(65 + db.blocks.length)}`, crop: '', variety: '', areaHa: '', irrigation: 'Drip', planted: today(), cycleDays: '', status: 'active', notes: '', stages: [] };
  const b = blockById(id); return b ? JSON.parse(JSON.stringify(b)) : null;
}
function vBlockEdit() {
  const d = bdraft; if (!d) return vMissing();
  const inp = (f, label, type = 'text', extra = '') => `<div class="f"><label for="b_${f}">${label}</label><input id="b_${f}" type="${type}" data-bf="${f}" value="${esc(d[f])}" ${extra}></div>`;
  const stages = d.stages.map((s, i) => `<div class="stagerow"><div class="between"><span class="lbl">Stage ${i + 1}</span><button type="button" class="btn sm danger" data-act="delstage" data-i="${i}">Remove</button></div>
    <div class="f"><label for="s_n${i}">Name</label><input id="s_n${i}" data-si="${i}" data-sf="name" value="${esc(s.name)}"></div>
    <div class="g2"><div class="f"><label for="s_s${i}">Start day</label><input id="s_s${i}" inputmode="numeric" data-si="${i}" data-sf="start" value="${esc(s.start)}"></div><div class="f"><label for="s_e${i}">End day</label><input id="s_e${i}" inputmode="numeric" data-si="${i}" data-sf="end" value="${esc(s.end)}"></div></div>
    <div class="f"><label for="s_u${i}">Nutrition focus</label><input id="s_u${i}" data-si="${i}" data-sf="nutrition" value="${esc(s.nutrition)}"></div>
    <div class="f"><label for="s_w${i}">Pests &amp; diseases to watch (comma separated)</label><input id="s_w${i}" data-si="${i}" data-sf="watch" value="${esc(s.watch)}"></div></div>`).join('');
  return `${back(d.id ? '#block/' + d.id : '#fields', d.id ? d.name : 'Fields')}<h1>${d.id ? 'Edit block' : 'New block'}</h1>
  <div class="form">
    <div class="g2">${inp('name', 'Block name')}${inp('areaHa', 'Area (ha)', 'text', 'inputmode="decimal"')}</div>
    <div class="g2"><div class="f"><label for="b_crop">Crop</label><select id="b_crop" data-bf="crop" data-list="crops">${opts('crops', d.crop, 'No crop')}</select></div>${inp('variety', 'Variety')}</div>
    ${d.id && (blockById(d.id) || {}).crop ? `<div class="alert info">${ic('info', 20, 2)}<span class="main"><span class="t">Planting a different crop?</span><span class="s">Changing the crop or date here rewrites the current crop. To keep the old crop's history and profit separate, use <a href="#newcycle/${d.id}" style="color:inherit;font-weight:700">Finish crop &amp; start new</a>.</span></span></div>` : ''}
    <div class="g2">${inp('planted', 'Planting / transplant date', 'date')}${inp('cycleDays', 'Crop cycle (days)', 'text', 'inputmode="numeric"')}</div>
    <div class="g2"><div class="f"><label for="b_irrigation">Irrigation</label><select id="b_irrigation" data-bf="irrigation" data-list="irrigation">${opts('irrigation', d.irrigation, 'Not set')}</select></div>
      <div class="f"><label for="b_status">Status</label><select id="b_status" data-bf="status">${[['active', 'Active'], ['fallow', 'Fallow'], ['harvested', 'Harvested']].map(([v, l]) => `<option value="${v}" ${d.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="f"><label for="b_notes">Notes</label><textarea id="b_notes" data-bf="notes">${esc(d.notes)}</textarea></div>
    <h2>Growth stages</h2>
    <p class="hint" style="margin:-8px 0 0">Days are counted from the planting date. Templates are starting points — adjust to your variety and season.</p>
    <div class="chips"><button type="button" class="chip" data-act="tpl" data-v="tomato">Tomato template</button><button type="button" class="chip" data-act="tpl" data-v="generic">5 stages from cycle length</button><button type="button" class="chip" data-act="addstage">${ic('plus', 14, 2.2)}Stage</button></div>
    ${stages || '<div class="empty">No stages yet.</div>'}
    <button class="btn pri block" data-act="saveblock">Save block</button>
    ${d.id ? `<button class="btn danger block" data-act="delblock">Delete block</button>` : ''}
  </div>`;
}

/* ----- record form ----- */
function initDraft(id, q) {
  if (id && id !== 'new') { const r = db.records.find(x => x.id === id); return r ? JSON.parse(JSON.stringify(r)) : null; }
  const type = TYPES[q.get('type')] || q.get('type') === 'activity' ? q.get('type') : 'spray';
  const d = { id: null, type, activity: type === 'activity' ? (q.get('act') || L('activities')[0] || 'Activity') : '', status: type === 'task' ? 'planned' : 'done', date: today(), blockId: q.get('block') || '', title: '', target: '', lines: [], waterLha: '', tankL: db.settings.tankL || '', phiDays: '', ec: '', ph: '', severity: '', count: '', minutes: '', m3: '', notes: '', endDate: '', extLog: [], issueId: q.get('issue') || '' };
  if (q.get('target')) d.target = q.get('target');
  ensureLines(d);
  return d;
}
function ensureLines(d) {
  if ((d.type === 'spray' || d.type === 'fertigation') && (!d.lines || !d.lines.length)) d.lines = [{ stockId: '', amount: '', basis: d.type === 'spray' ? 'ha' : 'total' }];
}
function prevUsed(stockId) {
  if (!draft.id) return 0;
  const old = db.records.find(r => r.id === draft.id);
  return (old && old.used || []).filter(u => u.stockId === stockId).reduce((a, u) => a + u.qty, 0);
}
function calcHtml() {
  const d = draft, b = blockById(d.blockId);
  if (d.type !== 'spray' && d.type !== 'fertigation') return '';
  const lines = d.lines.filter(l => stockById(l.stockId));
  const area = b ? num(b.areaHa) : 0;
  let head = '';
  let tanks = 0;
  if (d.type === 'spray') {
    const vol = num(d.waterLha) * area, tank = num(d.tankL);
    tanks = tank > 0 && vol > 0 ? vol / tank : 0;
    head = `<div class="g3"><div class="col"><span class="k">Area</span><span class="v">${b ? fmt(area) + ' ha' : '—'}</span></div><div class="col"><span class="k">Spray vol.</span><span class="v">${vol ? fmt(vol) + ' L' : '—'}</span></div><div class="col"><span class="k">Tanks</span><span class="v">${tanks ? fmt(tanks) : '—'}</span></div></div>`;
  } else {
    head = `<div class="g3"><div class="col"><span class="k">Area</span><span class="v">${b ? fmt(area) + ' ha' : '—'}</span></div></div>`;
  }
  const rows = lines.map(l => {
    const s = stockById(l.stockId), total = lineQty(l, b);
    const after = num(s.qty) + prevUsed(s.id) - total;
    const parts = [num(l.amount) ? `${fmt(total)} ${s.unit} total` : 'amount not set'];
    if (tanks && num(l.amount)) parts.push(`${fmt(total / tanks)} ${s.unit} per full tank`);
    if (num(l.amount) && d.status === 'done') parts.push(`<span class="${after < 0 ? 'neg' : ''}">stock after ${fmt(after)} ${s.unit}</span>`);
    return `<div class="col"><span class="t" style="color:#fff">${esc(s.name)}</span><span class="s">${parts.join(' · ')}</span></div>`;
  }).join('');
  if (!b && !lines.length) return '';
  return `<div class="dark">${head}${rows}${d.type === 'spray' && tanks && tanks % 1 > 0.01 ? `<span class="s">Last tank is partial: ${fmt((tanks % 1) * num(d.tankL))} L.</span>` : ''}</div>`;
}
function checksHtml() {
  const d = draft, out = [];
  const b = blockById(d.blockId);
  for (const l of d.lines || []) {
    const s = stockById(l.stockId); if (!s) continue;
    const f = stockFlags(s);
    if (f.includes('expired')) out.push(['bad', `${s.name} is past its expiry date (${fdy(s.expiry)}).`]);
  }
  if (d.type === 'spray' && b) {
    const hist = lastSprays(b.id, d.id, d.date);
    for (const l of d.lines || []) {
      const s = stockById(l.stockId); if (!s) continue;
      const g = (s.group || '').trim();
      if (!g) { out.push(['', `${s.name}: no IRAC/FRAC group recorded. Add it in Stock so rotation can be checked.`]); continue; }
      if (hist[0] && hist[0].g.includes(g)) out.push(['bad', `${s.name} (${g}) is the same group as the last spray on ${fd(hist[0].date)}. Rotate to a different mode of action.`]);
      else if (hist[1] && hist[1].g.includes(g)) out.push(['', `${s.name} (${g}) was used two sprays ago (${fd(hist[1].date)}). Check the label's limit on consecutive or seasonal applications.`]);
      else out.push(['ok', `${s.name} (${g}) differs from the last ${hist.length ? hist.length + ' spray' + (hist.length > 1 ? 's' : '') : 'sprays (none recorded)'}.`]);
    }
    if (d.lines.filter(l => stockById(l.stockId)).length > 1) out.push(['', 'Tank mix: confirm compatibility on both labels and do a jar test first.']);
    const pe = phiEnd(b, d.id);
    if (pe) out.push(['', `${b.name} is already under PHI until ${fd(pe)}.`]);
    if (!num(d.phiDays) && d.status === 'done') out.push(['', 'PHI not entered. Enter the label PHI so harvest dates are protected.']);
    if (hist.length) out.push(['info', 'Last sprays: ' + hist.map(h => `${fd(h.date)} ${h.g.join(', ') || 'no group'}`).join(' · ')]);
  }
  if (!out.length) return '';
  return `<div class="col" style="gap:8px"><span class="lbl">Checks</span>${out.map(([k, t]) => alertH(k, k === 'ok' ? 'check' : k === 'info' ? 'info' : 'warn', t, '')).join('')}</div>`;
}
function updateLive() {
  const c = document.getElementById('calc'), k = document.getElementById('checks');
  if (c) c.innerHTML = calcHtml();
  if (k) k.innerHTML = checksHtml();
}
function vRecord() {
  const d = draft; if (!d) return vMissing();
  const fld = (f, label, extra = '', type = 'text') => `<div class="f"><label for="r_${f}">${label}</label><input id="r_${f}" type="${type}" data-f="${f}" value="${esc(d[f])}" ${extra}></div>`;
  const types = Object.keys(TYPES).map(k => `<button type="button" class="chip ${d.type === k ? 'on' : ''}" data-act="dtype" data-v="${k}" aria-pressed="${d.type === k}">${TYPES[k]}</button>`).join('')
    + L('activities').map(a => `<button type="button" class="chip ${d.type === 'activity' && d.activity === a ? 'on' : ''}" data-act="dact" data-v="${esc(a)}" aria-pressed="${d.type === 'activity' && d.activity === a}">${esc(a)}</button>`).join('')
    + (d.type === 'activity' && d.activity && !L('activities').includes(d.activity) ? `<button type="button" class="chip on" aria-pressed="true">${esc(d.activity)}</button>` : '')
    + `<button type="button" class="chip" data-act="newact">${ic('plus', 14, 2.2)}Type</button>`;
  const optional = d.type === 'task' || d.type === 'other' || d.type === 'activity';
  const blockOpts = `<option value="">${optional ? 'Whole farm (no block)' : 'Choose block…'}</option>` + db.blocks.map(x => `<option value="${x.id}" ${x.id === d.blockId ? 'selected' : ''}>${esc(blockLabel(x))} · ${fmt(num(x.areaHa))} ha</option>`).join('');
  let specific = '';
  if (d.type === 'spray' || d.type === 'fertigation') {
    const pool = d.type === 'fertigation' ? fertPool() : sprayPool();
    const lines = d.lines.map((l, i) => {
      const s = stockById(l.stockId);
      const opts = `<option value="">Choose from stock…</option>` + pool.map(p => `<option value="${p.id}" ${p.id === l.stockId ? 'selected' : ''}>${esc(p.name)}${p.group ? ' · ' + esc(p.group) : ''} (${esc(qtyStr(p))})</option>`).join('');
      return `<div class="prod"><div class="between"><span class="lbl">Product ${i + 1}</span>${d.lines.length > 1 ? `<button type="button" class="btn sm danger" data-act="dline" data-i="${i}">Remove</button>` : ''}</div>
      <select data-line="${i}" data-lf="stockId" aria-label="Product ${i + 1}">${opts}</select>
      <div class="g2"><div class="f"><label for="amt${i}">Amount${s ? ' (' + esc(s.unit) + ')' : ''}</label><input id="amt${i}" inputmode="decimal" data-line="${i}" data-lf="amount" value="${esc(l.amount)}" placeholder="${d.type === 'spray' ? 'From label' : 'Amount'}"></div>
      <div class="f"><label for="bas${i}">Basis</label><select id="bas${i}" data-line="${i}" data-lf="basis"><option value="ha" ${l.basis === 'ha' ? 'selected' : ''}>per ha</option><option value="total" ${l.basis === 'total' ? 'selected' : ''}>total for block</option></select></div></div>
      ${s && s.ai ? `<span class="hint">${esc(s.ai)}${s.phiDays && d.type === 'spray' ? ` · label PHI on file: ${esc(s.phiDays)} days` : ''}</span>` : ''}</div>`;
    }).join('');
    specific = `${d.type === 'spray' ? fld('target', 'Target pest / disease') : ''}
      <div class="col" style="gap:10px">${lines}<button type="button" class="btn sm" data-act="aline">${ic('plus', 16, 2.2)}Add product</button></div>
      ${pool.length ? '' : `<div class="empty">No ${d.type === 'fertigation' ? 'fertilisers' : 'crop-protection products'} in stock yet.<a class="btn sm" href="#stockedit/new">Add stock item</a></div>`}
      ${d.type === 'spray' ? `<div class="g3">${fld('waterLha', 'Water L/ha', 'inputmode="decimal"')}${fld('tankL', 'Tank size L', 'inputmode="decimal"')}${fld('phiDays', 'PHI days', 'inputmode="numeric" placeholder="Label"')}</div>` : `<div class="g2">${fld('ec', 'EC (mS/cm)', 'inputmode="decimal"')}${fld('ph', 'pH', 'inputmode="decimal"')}</div>`}
      <div id="calc">${calcHtml()}</div><div id="checks">${checksHtml()}</div>`;
  } else if (d.type === 'scouting') {
    specific = `${fld('target', 'Pest / disease found')}
      ${d.blockId || d.target ? `<a class="btn sm" href="#ai?block=${d.blockId}&note=${encodeURIComponent(encodeURIComponent(d.target || ''))}" style="align-self:flex-start">${ic('search', 16, 2)}Ask AI about this</a>` : ''}
      <div class="g2"><div class="f"><label for="r_severity">Pressure</label><select id="r_severity" data-f="severity">${['', 'none', 'low', 'moderate', 'high'].map(v => `<option value="${v}" ${d.severity === v ? 'selected' : ''}>${v ? v[0].toUpperCase() + v.slice(1) : 'Choose…'}</option>`).join('')}</select></div>${fld('count', 'Count / threshold note')}</div>`;
  } else if (d.type === 'irrigation') {
    specific = `<div class="g2">${fld('minutes', 'Run time (min)', 'inputmode="decimal"')}${fld('m3', 'Volume (m³)', 'inputmode="decimal"')}</div>`;
  } else if (d.type === 'activity') {
    specific = fld('title', 'Description (optional)');
  } else {
    specific = fld('title', 'What needs doing');
  }
  return `<a class="back" href="#records" data-act="goback">${ic('back', 18, 2)}Back</a><h1>${d.id ? 'Edit record' : 'New record'}</h1>
  <div class="form">
    <div class="chips" role="group" aria-label="Record type">${types}</div>
    <div class="seg" role="group" aria-label="Status"><button type="button" class="${d.status === 'planned' ? 'on' : ''}" data-act="dstatus" data-v="planned" aria-pressed="${d.status === 'planned'}">Planned</button><button type="button" class="${d.status === 'done' ? 'on' : ''}" data-act="dstatus" data-v="done" aria-pressed="${d.status === 'done'}">Done</button></div>
    <div class="g2">${fld('date', 'Date (first day)', '', 'date')}${fld('endDate', 'Last day (if longer)', '', 'date')}</div>
    <div class="f"><label for="r_blockId">Block</label><select id="r_blockId" data-f="blockId">${blockOpts}</select></div>
    ${d.endDate && d.endDate > d.date || (d.extLog || []).length ? `<div class="card" style="gap:6px"><span class="t">Work period${d.endDate > d.date ? `: ${fd(d.date)} – ${fd(d.endDate)} · ${diff(d.date, d.endDate) + 1} days` : ''}</span>${(d.extLog || []).map(x => `<span class="s">Extended on ${fd(x.on)}: ${fd(x.from)} → ${fd(x.to)}${x.why ? ' — ' + esc(x.why) : ''}</span>`).join('')}${d.doneOn ? `<span class="s">Marked done on ${fd(d.doneOn)}</span>` : ''}</div>` : ''}
    ${(d.type === 'spray' || d.type === 'scouting') && d.blockId ? (() => { const bi = (db.issues || []).filter(i => i.blockId === d.blockId && (isOpenIssue(i) || i.id === d.issueId)); return bi.length ? `<div class="f"><label for="r_issueId">Related plant-health problem</label><select id="r_issueId" data-f="issueId"><option value="">None</option>${bi.map(i => `<option value="${i.id}" ${i.id === d.issueId ? 'selected' : ''}>${esc(issueName(i))} · ${fd(i.date)}</option>`).join('')}</select></div>` : (d.type === 'scouting' ? `<a class="btn sm" href="#issueedit/new?block=${d.blockId}" style="align-self:flex-start">${ic('plus', 16, 2.2)}Report as plant-health problem</a>` : ''); })() : ''}
    ${specific}
    <div class="f"><label for="r_notes">Notes</label><textarea id="r_notes" data-f="notes">${esc(d.notes)}</textarea></div>
    ${d.status === 'done' && (d.type === 'spray' || d.type === 'fertigation') ? `<p class="hint" style="margin:0">Saving as done deducts the amounts from stock.</p>` : ''}
    <button class="btn pri block" data-act="saverec">${d.status === 'done' ? 'Save as done' : 'Save as planned'}</button>
    ${d.id ? `<button class="btn danger block" data-act="delrec">Delete record</button>` : ''}
  </div>`;
}

function vRecords() {
  const all = db.records.filter(r => ui.rfilter === 'all' || r.type === ui.rfilter);
  const planned = all.filter(r => r.status === 'planned').sort(byDate);
  const done = all.filter(r => r.status === 'done').sort(byDateDesc);
  const chips = ['all', ...Object.keys(TYPES), 'activity'].map(k => `<button class="chip ${ui.rfilter === k ? 'on' : ''}" data-act="rfilter" data-v="${k}" aria-pressed="${ui.rfilter === k}">${k === 'all' ? 'All' : k === 'activity' ? 'Activities' : TYPES[k]}</button>`).join('');
  return `<h1>Records</h1>${addButtons('')}<div class="chips">${chips}</div>
  <p class="sec">Planned · ${planned.length}</p>${planned.length ? `<div class="list">${planned.map(r => taskRow(r)).join('')}</div>` : `<div class="empty">Nothing planned.</div>`}
  <p class="sec">Completed · ${done.length}</p>${done.length ? `<div class="list">${done.slice(0, 150).map(r => doneRow(r)).join('')}</div>${done.length > 150 ? `<p class="hint">Showing latest 150. Export a backup to see everything.</p>` : ''}` : `<div class="empty">No records yet.</div>`}`;
}

function stockListHtml() {
  const q = ui.q.trim().toLowerCase();
  const items = db.stock.filter(s => (ui.cat === 'all' || s.category === ui.cat) && (!q || [s.name, s.ai, s.group].join(' ').toLowerCase().includes(q)));
  if (!items.length) return `<div class="empty">${db.stock.length ? 'No matching items.' : 'No stock yet.'}<a class="btn pri sm" href="#stockedit/new">Add stock item</a></div>`;
  return stockCats().map(cat => {
    const c = cat.id;
    const list = items.filter(s => s.category === c).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<p class="sec">${esc(cat.name)}</p><div class="list">${list.map(s => {
      const f = stockFlags(s);
      const flag = f.includes('expired') ? `<span class="badge b-bad">Expired</span>` : f.includes('negative') ? `<span class="badge b-bad">Check count</span>` : f.includes('low') ? `<span class="badge b-warn">Reorder</span>` : f.includes('soon') ? `<span class="badge b-warn">Expires soon</span>` : '';
      return `<a class="item" href="#stockedit/${s.id}"><span class="main"><span class="t">${esc(s.name)}</span><span class="row" style="gap:6px">${s.group ? `<span class="grp">${esc(s.group)}</span>` : ''}<span class="s">${esc([s.ai, s.expiry ? 'exp. ' + fdy(s.expiry) : ''].filter(Boolean).join(' · '))}</span></span></span>
      <span class="col" style="align-items:flex-end;gap:3px"><span class="mono ${f.includes('low') || f.includes('negative') ? 'neg' : ''}" style="font-size:15px;font-weight:600">${esc(qtyStr(s))}</span>${flag}</span></a>`;
    }).join('')}</div>`;
  }).join('');
}
function vStock() {
  const chips = [{ id: 'all', name: 'All' }, ...stockCats()].map(k => `<button class="chip ${ui.cat === k.id ? 'on' : ''}" data-act="cat" data-v="${esc(k.id)}" aria-pressed="${ui.cat === k.id}">${esc(k.name)}</button>`).join('');
  return `<div class="between"><h1>Stock</h1><a class="ib pri" href="#stockedit/new" aria-label="Add stock item">${ic('plus', 18, 2.2)}</a></div>
  <div style="position:relative;display:flex;align-items:center"><span style="position:absolute;left:14px;color:var(--mut);display:flex">${ic('search', 18, 2)}</span><label for="stockq" class="sr">Search stock</label><input id="stockq" type="search" placeholder="Search product, active ingredient, group" value="${esc(ui.q)}" style="padding-left:42px"></div>
  <div class="chips">${chips}</div><div id="stocklist" class="col" style="gap:14px">${stockListHtml()}</div>`;
}
function vStockEdit(id) {
  const s = id === 'new' ? { id: null, name: '', category: (stockCats().find(c => c.use === 'spray') || stockCats()[0] || {}).id || '', ai: '', group: '', unit: L('stockUnits').includes('L') ? 'L' : L('stockUnits')[0], qty: '', reorderAt: '', expiry: '', phiDays: '', notes: '' } : stockById(id);
  if (!s) return vMissing();
  const inp = (f, label, extra = '', type = 'text') => `<div class="f"><label for="s_${f}">${label}</label><input id="s_${f}" type="${type}" value="${esc(s[f])}" ${extra}></div>`;
  const uses = s.id ? db.records.filter(r => (r.lines || []).some(l => l.stockId === s.id)).sort(byDateDesc).slice(0, 8) : [];
  return `${back('#stock', 'Stock')}<h1>${s.id ? esc(s.name) : 'New stock item'}</h1>
  <div class="form" id="stockform" data-id="${s.id || ''}">
    ${inp('name', 'Product name (as on label)')}
    <div class="g2"><div class="f"><label for="s_category">Category</label><select id="s_category" data-list="stockCats">${stockCatOpts(s.category)}</select></div>${inp('group', 'IRAC / FRAC / HRAC group', 'placeholder="e.g. IRAC 28"')}</div>
    ${inp('ai', 'Active ingredient & concentration / analysis')}
    <div class="g3">${inp('qty', 'Quantity', 'inputmode="decimal"')}<div class="f"><label for="s_unit">Unit</label><select id="s_unit" data-list="stockUnits">${opts('stockUnits', s.unit)}</select></div>${inp('reorderAt', 'Reorder at', 'inputmode="decimal"')}</div>
    <div class="g3">${inp('expiry', 'Expiry date', '', 'date')}${inp('phiDays', 'Label PHI (days)', 'inputmode="numeric"')}${inp('reiHours', 'Label REI (hours)', 'inputmode="numeric"')}</div>
    ${labelCard(s)}
    <div class="f"><label for="s_label">From the label: crops it is registered for, rate, maximum applications, mixing warnings</label><textarea id="s_label" placeholder="Copy from the product label. The AI is told to use only what is written here.">${esc(s.label)}</textarea></div>
    ${inp('costPerUnit', `Unit cost (USD per ${esc(s.unit)})`, 'inputmode="decimal"')}
    <div class="f"><label for="s_notes">Notes (supplier, batch, label rate…)</label><textarea id="s_notes">${esc(s.notes)}</textarea></div>
    <button class="btn pri block" data-act="savestock">Save item</button>
    ${s.id ? `<div class="card"><span class="t">Receive stock</span>
      <div class="g2"><div class="f"><label for="s_recv">Amount (${esc(s.unit)})</label><input id="s_recv" inputmode="decimal"></div><div class="f"><label for="s_rcost">Total cost (optional)</label><div class="row" style="flex-wrap:nowrap;gap:6px"><input id="s_rcost" inputmode="decimal"><select id="s_rcur" aria-label="Cost currency" style="width:96px;flex:none">${CURS.map(c => `<option ${(db.settings.buyCur || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div></div>
      <div class="g2"><div class="f"><label for="s_rsup">Supplier</label><input id="s_rsup" list="suplist" autocomplete="off"><datalist id="suplist">${[...new Set(db.txns.filter(t => t.kind === 'expense').map(t => t.party).filter(Boolean))].map(p => `<option value="${esc(p)}">`).join('')}</datalist></div><div class="f"><label for="s_rpay">Payment</label><select id="s_rpay">${L('methods').map(m => `<option>${esc(m)}</option>`).join('')}<option value="credit">On credit</option></select></div></div>
      <span class="hint">With a cost, an expense is added to Money and the unit cost is updated.</span>
      <button class="btn pri" data-act="recvstock">Add to stock</button></div>
      ${uses.length ? `<p class="sec">Recent use</p><div class="list">${uses.map(r => doneRow(r)).join('')}</div>` : ''}
      <button class="btn danger block" data-act="delstock">Delete item</button>` : ''}
  </div>`;
}

function vPower() {
  const logs = [...db.power].sort(byDate);
  const last = logs.slice(-14);
  const lp = logs[logs.length - 1];
  const maxPv = Math.max(1, ...last.map(p => num(p.pvKwh))), maxM = Math.max(1, ...last.map(p => num(p.m3)));
  const chart = (key, max, color, label) => last.length ? `<div class="card"><div class="between"><span class="t">${label}</span><span class="s">last ${last.length} logs</span></div>
    <div class="chart" role="img" aria-label="${label} for the last ${last.length} logged days">${last.map(p => `<i style="height:${num(p[key]) / max * 100}%;background:${color}" title="${fd(p.date)}: ${fmt(num(p[key]))}"></i>`).join('')}</div>
    <div class="between mono s" style="font-size:11px"><span>${fd(last[0].date)}</span><span>${fd(last[last.length - 1].date)}</span></div></div>` : '';
  const sum = k => last.reduce((a, p) => a + num(p[k]), 0);
  const today_ = db.power.find(p => p.date === today());
  return `<h1>Power &amp; water</h1>
  <p class="hint" style="margin:-8px 0 0">Manual daily log from your inverter and flow meter readings.</p>
  ${lp ? `<div class="tiles"><div class="tile"><span class="k">Tank</span><span class="v">${lp.tankPct !== '' && lp.tankPct != null ? fmt(num(lp.tankPct)) + '%' : '—'}</span></div><div class="tile"><span class="k">Pumped</span><span class="v">${fmt(num(lp.m3))} m³</span></div><div class="tile"><span class="k">PV</span><span class="v">${fmt(num(lp.pvKwh))} kWh</span></div></div>
  <p class="hint" style="margin:-6px 0 0">Latest log: ${fdy(lp.date)}${sum('m3') ? ` · ${last.length}-log average ${fmt(sum('pvKwh') / sum('m3'))} kWh PV per m³ pumped (PV includes other loads)` : ''}</p>` : ''}
  ${chart('pvKwh', maxPv, 'var(--sun)', 'PV yield (kWh)')}${chart('m3', maxM, 'var(--water)', 'Water pumped (m³)')}
  <div class="card"><span class="t">${today_ ? "Update today's log" : "Log today's readings"}</span>
    <div class="g2"><div class="f"><label for="p_date">Date</label><input id="p_date" type="date" value="${today()}"></div><div class="f"><label for="p_tank">Tank level %</label><input id="p_tank" inputmode="decimal" value="${today_ ? esc(today_.tankPct) : ''}"></div></div>
    <div class="g2"><div class="f"><label for="p_pv">PV energy (kWh)</label><input id="p_pv" inputmode="decimal" value="${today_ ? esc(today_.pvKwh) : ''}"></div><div class="f"><label for="p_m3">Water pumped (m³)</label><input id="p_m3" inputmode="decimal" value="${today_ ? esc(today_.m3) : ''}"></div></div>
    <div class="f"><label for="p_notes">Notes (faults, filter cleaning, battery…)</label><input id="p_notes" value="${today_ ? esc(today_.notes) : ''}"></div>
    <button class="btn pri" data-act="savepower">Save log</button></div>
  ${logs.length ? `<p class="sec">Log</p><div class="list">${[...logs].reverse().slice(0, 60).map(p => `<div class="item"><span class="date">${fd(p.date)}</span><span class="main"><span class="t mono" style="font-size:13px">${fmt(num(p.pvKwh))} kWh · ${fmt(num(p.m3))} m³${p.tankPct !== '' && p.tankPct != null ? ' · ' + fmt(num(p.tankPct)) + '%' : ''}</span>${p.notes ? `<span class="s">${esc(p.notes)}</span>` : ''}</span><button class="btn sm danger" data-act="delpower" data-id="${p.id}" aria-label="Delete log for ${fd(p.date)}">Delete</button></div>`).join('')}</div>` : ''}`;
}

function vSettings() {
  return `${back('#today', 'Today')}<h1>Settings</h1>
  <div class="card"><div class="f"><label for="set_name">Farm name</label><input id="set_name" value="${esc(db.settings.farmName)}"></div>
    <div class="f"><label for="set_loc">Farm location</label><input id="set_loc" value="${esc(db.settings.location || '')}" placeholder="Town, region, country"><span class="hint">Sent with questions to Claude so advice fits your conditions.</span></div>
    <div class="f"><label for="set_tank">Default sprayer tank size (L)</label><input id="set_tank" inputmode="decimal" value="${esc(db.settings.tankL || '')}"></div>
    <div class="g2"><div class="f"><label for="set_sale">New sales in</label><select id="set_sale">${CURS.map(c => `<option ${(db.settings.saleCur || 'SLSH') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class="f"><label for="set_buy">New expenses in</label><select id="set_buy">${CURS.map(c => `<option ${(db.settings.buyCur || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
    <div class="f"><label for="set_rep">Show totals in (default)</label><select id="set_rep">${CURS.map(c => `<option ${(db.settings.repCur || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <button class="btn pri" data-act="savesettings">Save</button></div>
  ${aiSettingsCard()}
  <a class="card" href="#lists" style="flex-direction:row;align-items:center"><span class="main"><span class="t">Lists &amp; categories</span><span class="s">Sales and expense categories, crops, units, payment methods, stock categories, irrigation types, activities</span></span>${ic('chev', 18, 2)}</a>
  <div class="card"><span class="t">Exchange rate history</span><span class="s">SLSH per 1 USD. Each transaction keeps the rate of its own date, so updating the rate never changes past figures.</span>
    ${rateCard(true)}
    ${(db.rates || []).length ? `<div class="list">${ratesSorted().reverse().slice(0, 30).map(r => `<div class="item"><span class="date">${fd(r.date)}</span><span class="main mono" style="font-size:14px;font-weight:600">${fmtRate(r.rate)}</span><button class="btn sm danger" data-act="delrate" data-id="${r.id}" aria-label="Delete rate of ${fd(r.date)}">Delete</button></div>`).join('')}</div>` : ''}</div>
  <div class="card"><span class="t">Backup</span><span class="s">Your records live only on this phone. Export a backup file regularly and keep a copy off the phone (email it to yourself or save to Drive). ${db.settings.lastBackup ? 'Last backup: ' + fdy(db.settings.lastBackup) + '.' : 'No backup yet.'}</span>
    <button class="btn pri" data-act="export">Export backup file (with photos)</button>
    <button class="btn" data-act="exportlite">Export without photos (smaller file)</button>
    <span class="s" id="photoinfo"></span>
    <label class="btn" for="importFile">Restore from backup file</label><input id="importFile" type="file" accept=".json,application/json" class="sr"></div>
  ${installEvt ? `<div class="card"><span class="t">Install</span><span class="s">Add Farm Manager to your home screen so it opens like an app and works offline.</span><button class="btn pri" data-act="install">Install app</button></div>` : ''}
  <div class="card"><span class="t">Data</span>
    <span class="s">${db.blocks.length} blocks · ${db.records.length} records · ${db.stock.length} stock items · ${db.txns.length} transactions · ${(db.rates || []).length} rates · ${db.power.length} power logs · ${(db.issues || []).length} plant-health problems</span>
    <span class="s" id="persist">Checking storage…</span>
    ${db.settings.sample ? `<button class="btn pri" data-act="clearall">Clear sample data and start fresh</button>` : `<button class="btn" data-act="loadsample">Load sample data</button>`}
    ${db.settings.sample ? '' : `<button class="btn danger" data-act="clearall">Erase all data on this phone</button>`}</div>
  <p class="hint">Farm Manager v1 · works offline · no account, nothing is sent anywhere.</p>`;
}
const vMissing = () => `${back('#today', 'Today')}<div class="empty">That item was not found. It may have been deleted.</div>`;

/* ---------- editable lists (categories, crops, units, methods…) ---------- */
const LIST_DEFS = {
  incomeCats: { title: 'Income / sales categories', hint: 'Turn on "Sale with quantity" for categories where you sell produce by quantity × price (it also counts towards block yield).', extra: 'sale' },
  expenseCats: { title: 'Expense categories', hint: 'Used for costs and reports.' },
  crops: { title: 'Crops', hint: 'Shown when you set a block’s crop and on sales.' },
  saleUnits: { title: 'Sale units', hint: 'Units you sell produce in.' },
  stockCats: { title: 'Stock categories', hint: '"Used in" decides which form lists the product: fertigation, spray, both, or neither. "Expense" is the cost category used when you receive stock with a price.', extra: 'stock' },
  stockUnits: { title: 'Stock units', hint: 'Units for stock quantities. Amounts in records use the item’s unit.' },
  methods: { title: 'Payment methods', hint: 'How money is paid or received.' },
  irrigation: { title: 'Irrigation types', hint: 'Shown on the block form.' },
  activities: { title: 'Extra activity types', hint: 'Added to Records next to Spray, Fertigation, Scouting and Irrigation. They record a block, date, description and notes.' },
  issueKinds: { title: 'Problem types', hint: 'Disease, pest, nutrient problem… Offered when you report a plant-health problem.' },
  issueNames: { title: 'Problem names (diseases, pests…)', hint: 'Names offered when you report a problem. Renaming updates the problems already recorded.' }
};
const STOCK_USES = { fertigation: 'Fertigation', spray: 'Spray', both: 'Both', none: 'Neither' };
function defaultLists() {
  return {
    incomeCats: [{ name: 'Crop sales', sale: true }, { name: 'Other income', sale: false }],
    expenseCats: ['Seeds & seedlings', 'Fertiliser', 'Crop protection', 'Labour', 'Fuel & energy', 'Irrigation & water', 'Equipment & repairs', 'Transport', 'Packaging & marketing', 'Land & rent', 'Other expense'],
    crops: ['Tomato', 'Sweet pepper', 'Hot pepper', 'Onion', 'Cabbage', 'Watermelon', 'Lettuce', 'Carrot'],
    saleUnits: ['kg', 'crate', 'box', 'sack', 'bunch', 'unit'],
    stockCats: [
      { id: 'fertiliser', name: 'Fertiliser', use: 'fertigation', expCat: 'Fertiliser' },
      { id: 'insecticide', name: 'Insecticide', use: 'spray', expCat: 'Crop protection' },
      { id: 'fungicide', name: 'Fungicide', use: 'spray', expCat: 'Crop protection' },
      { id: 'herbicide', name: 'Herbicide', use: 'spray', expCat: 'Crop protection' },
      { id: 'other', name: 'Other', use: 'none', expCat: 'Other expense' }
    ],
    stockUnits: ['kg', 'g', 'L', 'mL', 'bag', 'unit'],
    methods: ['Cash', 'Zaad', 'eDahab', 'Bank', 'Other'],
    irrigation: ['Drip', 'Sprinkler', 'Furrow', 'Hand watering'],
    activities: ['Harvest', 'Pruning', 'Weeding'],
    issueKinds: ['Disease', 'Insect pest', 'Mite', 'Nutrient problem', 'Weeds', 'Water or salt stress', 'Physical damage', 'Other'],
    issueNames: ['Early blight', 'Late blight', 'Powdery mildew', 'Downy mildew', 'Bacterial spot', 'Fusarium wilt', 'Leaf curl virus (TYLCV)', 'Tuta absoluta', 'Whitefly', 'Aphids', 'Thrips', 'Red spider mite', 'Root-knot nematode', 'Blossom-end rot', 'Salt burn']
  };
}
/* make sure lists exist and include every value already used in the data */
function normalizeLists(d) {
  const def = defaultLists();
  d.lists = d.lists || {};
  for (const k of Object.keys(def)) if (!Array.isArray(d.lists[k])) d.lists[k] = def[k];
  const L = d.lists;
  const addName = (k, v) => { v = String(v || '').trim(); if (v && !L[k].some(x => (typeof x === 'string' ? x : x.name) === v)) L[k].push(k === 'incomeCats' ? { name: v, sale: false } : v); };
  d.txns.forEach(t => { addName(t.kind === 'income' ? 'incomeCats' : 'expenseCats', t.category); addName('crops', t.crop); if (t.unit && num(t.qty)) addName('saleUnits', t.unit); if (!t.credit) addName('methods', t.method); (t.payments || []).forEach(p => addName('methods', p.method)); });
  d.blocks.forEach(b => { addName('crops', b.crop); addName('irrigation', b.irrigation); });
  d.stock.forEach(s => { addName('stockUnits', s.unit); if (s.category && !L.stockCats.some(c => c.id === s.category)) L.stockCats.push({ id: s.category, name: s.category, use: 'none', expCat: 'Other expense' }); });
  d.records.forEach(r => { if (r.type === 'activity') addName('activities', r.activity); });
  (d.issues || []).forEach(i => { addName('issueKinds', i.kind); addName('issueNames', i.name); });
  return d;
}
const L = k => (db.lists[k] || []).map(x => typeof x === 'string' ? x : x.name);
const stockCats = () => db.lists.stockCats || [];
const stockCat = id => stockCats().find(c => c.id === id);
const isSaleCat = name => !!(db.lists.incomeCats || []).find(c => c.name === name && c.sale);
const firstSaleCat = () => ((db.lists.incomeCats || []).find(c => c.sale) || {}).name || L('incomeCats')[0] || 'Crop sales';
const defaultExp = () => L('expenseCats').includes('Labour') ? 'Labour' : L('expenseCats')[0] || 'Other expense';
const firstNonSaleIncome = () => ((db.lists.incomeCats || []).find(c => !c.sale) || {}).name || L('incomeCats')[0] || 'Other income';
const sprayPool = () => db.stock.filter(s => { const u = (stockCat(s.category) || {}).use; return u === 'spray' || u === 'both'; });
const fertPool = () => db.stock.filter(s => { const u = (stockCat(s.category) || {}).use; return u === 'fertigation' || u === 'both'; });
/* <option>s for a list, keeping the current value even if it was removed, plus "+ Add new…" */
function opts(key, current, placeholder) {
  const names = L(key);
  const all = current && !names.includes(current) ? [...names, current] : names;
  return (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '') + all.map(n => `<option value="${esc(n)}" ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('') + `<option value="__new__">+ Add new…</option>`;
}
function stockCatOpts(current) {
  return stockCats().map(c => `<option value="${esc(c.id)}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + `<option value="__new__">+ Add new…</option>`;
}
function askText(title, placeholder = '') {
  return new Promise(res => {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', title);
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(23,33,27,.45);display:flex;align-items:flex-end;justify-content:center;z-index:20;padding:16px';
    wrap.innerHTML = `<form style="background:#fff;border-radius:16px;padding:18px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:12px;margin-bottom:env(safe-area-inset-bottom)"><label for="asktext" style="font-size:15px;font-weight:600">${esc(title)}</label><input id="asktext" placeholder="${esc(placeholder)}" autocomplete="off"><div class="g2"><button type="button" class="btn" data-r="0">Cancel</button><button type="submit" class="btn pri">Add</button></div></form>`;
    const input = wrap.querySelector('input');
    const done = v => { wrap.remove(); res(v); };
    wrap.querySelector('form').addEventListener('submit', e => { e.preventDefault(); done(input.value.trim() || null); });
    wrap.addEventListener('click', e => { if (e.target.closest('[data-r="0"]') || e.target === wrap) done(null); });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); });
    document.body.appendChild(wrap); input.focus();
  });
}
/* add a value from a dropdown's "+ Add new…" option */
async function addFromSelect(el) {
  const key = el.dataset.list;
  const prev = el.dataset.prev || '';
  const label = key === 'stockCats' ? 'New stock category' : 'Add to ' + LIST_DEFS[key].title.toLowerCase();
  const name = await askText(label);
  if (!name) { el.value = prev; return; }
  let value = name;
  if (key === 'stockCats') {
    const ex = stockCats().find(c => c.name.toLowerCase() === name.toLowerCase());
    if (ex) value = ex.id; else { value = 'c' + uid(); db.lists.stockCats.push({ id: value, name, use: 'spray', expCat: L('expenseCats').includes('Crop protection') ? 'Crop protection' : L('expenseCats')[0] }); toast('Added. Set what it is used in under Settings → Lists.'); }
  } else {
    const ex = L(key).find(n => n.toLowerCase() === name.toLowerCase());
    if (ex) value = ex; else db.lists[key].push(key === 'incomeCats' ? { name, sale: false } : name);
  }
  save();
  const o = document.createElement('option'); o.value = value; o.textContent = key === 'stockCats' ? (stockCat(value) || {}).name : value;
  const nw = el.querySelector('option[value="__new__"]'); if (![...el.options].some(x => x.value === value)) el.insertBefore(o, nw);
  el.value = value; el.dataset.prev = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ----- list manager screens ----- */
function vLists() {
  return `${back('#settings', 'Settings')}<h1>Lists &amp; categories</h1>
  <p class="hint" style="margin:-8px 0 0">These fill the dropdowns across the app. You can also add to a list straight from any dropdown with "+ Add new…".</p>
  <div class="list">${Object.entries(LIST_DEFS).map(([k, d]) => `<a class="item" href="#list/${k}"><span class="main"><span class="t">${esc(d.title)}</span><span class="s">${esc((k === 'stockCats' ? stockCats().map(c => c.name) : L(k)).slice(0, 6).join(', '))}${(db.lists[k] || []).length > 6 ? '…' : ''}</span></span><span class="badge b-mut">${(db.lists[k] || []).length}</span>${ic('chev', 18, 2)}</a>`).join('')}</div>
  <p class="hint">Blocks are created in Fields → New block.</p>`;
}
function initLDraft(key) {
  if (!LIST_DEFS[key]) return null;
  return (db.lists[key] || []).map(x => typeof x === 'string' ? { orig: x, name: x } : { ...x, orig: x.name });
}
function usageCount(key, name, id) {
  switch (key) {
    case 'incomeCats': return db.txns.filter(t => t.kind === 'income' && t.category === name).length;
    case 'expenseCats': return db.txns.filter(t => t.kind === 'expense' && t.category === name).length + stockCats().filter(c => c.expCat === name).length;
    case 'crops': return db.blocks.filter(b => b.crop === name).length + db.txns.filter(t => t.crop === name).length;
    case 'saleUnits': return db.txns.filter(t => t.unit === name && num(t.qty)).length;
    case 'stockCats': return db.stock.filter(s => s.category === id).length;
    case 'stockUnits': return db.stock.filter(s => s.unit === name).length;
    case 'methods': return db.txns.filter(t => t.method === name || (t.payments || []).some(p => p.method === name)).length;
    case 'irrigation': return db.blocks.filter(b => b.irrigation === name).length;
    case 'activities': return db.records.filter(r => r.type === 'activity' && r.activity === name).length;
    case 'issueKinds': return (db.issues || []).filter(i => i.kind === name).length;
    case 'issueNames': return (db.issues || []).filter(i => i.name === name).length;
  }
  return 0;
}
function vListEdit(key) {
  const def = LIST_DEFS[key]; if (!def || !ldraft) return vMissing();
  const rows = ldraft.map((it, i) => {
    const used = it.orig ? usageCount(key, it.orig, it.id) : 0;
    let extra = '';
    if (def.extra === 'sale') extra = `<label class="row" style="gap:8px;font-size:13px;min-height:44px"><input type="checkbox" class="check" data-li="${i}" data-lk="sale" ${it.sale ? 'checked' : ''}>Sale with quantity</label>`;
    if (def.extra === 'stock') extra = `<div class="g2"><div class="f"><label for="lu${i}">Used in</label><select id="lu${i}" data-li="${i}" data-lk="use">${Object.entries(STOCK_USES).map(([v, l]) => `<option value="${v}" ${it.use === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="f"><label for="le${i}">Expense</label><select id="le${i}" data-li="${i}" data-lk="expCat">${L('expenseCats').map(c => `<option ${it.expCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>`;
    return `<div class="stagerow"><div class="row" style="flex-wrap:nowrap;gap:6px"><label for="ln${i}" class="sr">Name ${i + 1}</label><input id="ln${i}" data-li="${i}" data-lk="name" value="${esc(it.name)}" style="flex:1">
      <button type="button" class="ib" data-act="lup" data-i="${i}" aria-label="Move ${esc(it.name)} up" ${i === 0 ? 'disabled style="opacity:.35"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
      <button type="button" class="ib" data-act="ldel" data-i="${i}" aria-label="Remove ${esc(it.name)}" style="color:var(--bad)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      ${extra}${used ? `<span class="hint">Used ${used}× · renaming updates those records</span>` : ''}</div>`;
  }).join('');
  return `${back('#lists', 'Lists')}<h1>${esc(def.title)}</h1><p class="hint" style="margin:-8px 0 0">${esc(def.hint)}</p>
  <div class="form">${rows || '<div class="empty">Empty list.</div>'}
    <div class="row" style="flex-wrap:nowrap;align-items:flex-end"><div class="f" style="flex:1"><label for="lnew">Add item</label><input id="lnew" placeholder="Name"></div><button type="button" class="btn" data-act="ladd">Add</button></div>
    <button class="btn pri block" data-act="lsave">Save list</button></div>`;
}
let ldraft = null, ldraftKey = null;
function applyRename(key, from, to) {
  if (!from || from === to) return;
  switch (key) {
    case 'incomeCats': db.txns.forEach(t => { if (t.kind === 'income' && t.category === from) t.category = to; }); break;
    case 'expenseCats': db.txns.forEach(t => { if (t.kind === 'expense' && t.category === from) t.category = to; }); stockCats().forEach(c => { if (c.expCat === from) c.expCat = to; }); break;
    case 'crops': db.blocks.forEach(b => { if (b.crop === from) b.crop = to; }); db.txns.forEach(t => { if (t.crop === from) t.crop = to; }); break;
    case 'saleUnits': db.txns.forEach(t => { if (t.unit === from) t.unit = to; }); break;
    case 'stockUnits': db.stock.forEach(s => { if (s.unit === from) s.unit = to; }); break;
    case 'methods': db.txns.forEach(t => { if (t.method === from) t.method = to; (t.payments || []).forEach(p => { if (p.method === from) p.method = to; }); }); break;
    case 'irrigation': db.blocks.forEach(b => { if (b.irrigation === from) b.irrigation = to; }); break;
    case 'activities': db.records.forEach(r => { if (r.type === 'activity' && r.activity === from) r.activity = to; }); break;
    case 'issueKinds': (db.issues || []).forEach(i => { if (i.kind === from) i.kind = to; }); break;
    case 'issueNames': (db.issues || []).forEach(i => { if (i.name === from) i.name = to; }); break;
  }
}

/* ---------- finance ---------- */
const CURS = ['USD', 'SLSH'];
const PERIODS = { month: 'This month', lastmonth: 'Last month', '90': '90 days', year: 'This year', all: 'All' };

/* exchange rates: db.rates = [{id, date, rate}] where rate = SLSH per 1 USD */
const ratesSorted = () => [...(db.rates || [])].sort((a, b) => a.date.localeCompare(b.date));
function latestRate() { const r = ratesSorted(); return r.length ? r[r.length - 1] : null; }
const curRate = () => { const r = latestRate(); return r ? num(r.rate) : 0; };
function rateOn(date) {
  const r = ratesSorted(); if (!r.length) return 0;
  let best = null; for (const x of r) if (x.date <= date) best = x;
  return num((best || r[0]).rate);
}
const tRate = t => num(t.rate) || rateOn(t.date);
/* convert an amount in currency `from` to `to`, using rate `rate` (SLSH per USD). Returns null if impossible. */
function conv(amt, from, to, rate) {
  amt = num(amt); if (from === to) return amt;
  if (!(rate > 0)) return null;
  return from === 'SLSH' ? amt / rate : amt * rate;
}
const toRep = (t, amt = t.amount) => conv(amt, t.currency || 'USD', ui.rcur, tRate(t));
const toRepNow = (t, amt) => conv(amt, t.currency || 'USD', ui.rcur, curRate());
function money(n, cur = ui.rcur) {
  if (n == null) return '—';
  const v = num(n);
  if (cur === 'SLSH') return (v < 0 ? '−' : '') + 'SLSH ' + Math.round(Math.abs(v)).toLocaleString('en-US');
  return (v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const fmtRate = r => num(r).toLocaleString('en-US', { maximumFractionDigits: 2 });

const paidOf = t => (t.payments || []).reduce((a, p) => a + num(p.amount), 0);
const roundC = (v, cur) => cur === 'SLSH' ? Math.round(v) : Math.round(v * 100) / 100;
const balanceOf = t => t.credit ? Math.max(0, roundC(num(t.amount) - paidOf(t), t.currency)) : 0;
const isOverdue = t => balanceOf(t) > 0 && t.due && t.due < today();
function periodRange(p) {
  const t = today(), d = new Date(t + 'T00:00:00'), y = d.getFullYear(), m = d.getMonth();
  if (p === 'month') return [iso(new Date(y, m, 1)), t];
  if (p === 'lastmonth') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  if (p === '90') return [addDays(t, -89), t];
  if (p === 'year') return [iso(new Date(y, 0, 1)), t];
  return ['0000-01-01', '9999-12-31'];
}
const txnsIn = p => { const [a, b] = periodRange(p); return db.txns.filter(t => t.date >= a && t.date <= b); };
function totals(list) {
  let inc = 0, exp = 0, skipped = 0;
  for (const t of list) { const v = toRep(t); if (v == null) { skipped++; continue; } if (t.kind === 'income') inc += v; else exp += v; }
  return { inc, exp, net: inc - exp, skipped };
}
function txnTitle(t) {
  if (isSaleCat(t.category) || (t.category === 'Crop sales' && num(t.qty))) { const b = blockById(t.blockId); return (t.category === 'Crop sales' ? 'Sale' : t.category) + (t.crop || (b && b.crop) ? ' · ' + (t.crop || b.crop) : '') + (num(t.qty) ? ` · ${fmt(num(t.qty))} ${t.unit}` : ''); }
  return t.category + (t.stockId && stockById(t.stockId) ? ' · ' + stockById(t.stockId).name : '');
}
function txnRow(t) {
  const bal = balanceOf(t), cur = t.currency || 'USD';
  const eq = cur !== ui.rcur ? toRep(t) : null;
  const sub = [t.party, t.blockId ? (blockById(t.blockId) || {}).name : '', !t.credit && t.method ? t.method : '', t.credit ? (bal > 0 ? `${t.kind === 'income' ? 'Owes' : 'You owe'} ${money(bal, cur)}${t.due ? ' · due ' + fd(t.due) : ''}` : 'Credit · settled') : ''].filter(Boolean).join(' · ');
  return `<a class="item" href="#txn/${t.id}"><span class="date">${fd(t.date)}</span><span class="main"><span class="t">${esc(txnTitle(t))}</span><span class="s ${isOverdue(t) ? 'neg' : ''}">${esc(sub)}</span></span>
  <span class="col" style="align-items:flex-end;gap:2px"><span class="mono" style="font-size:15px;font-weight:600;white-space:nowrap;color:${t.kind === 'income' ? 'var(--acc)' : 'var(--ink)'}">${t.kind === 'income' ? '+' : '−'}${esc(money(t.amount, cur))}</span>${eq != null ? `<span class="mono s" style="font-size:11px;white-space:nowrap">≈ ${esc(money(eq))}</span>` : ''}</span></a>`;
}
const periodChips = (key) => `<div class="chips">${Object.entries(PERIODS).map(([k, l]) => `<button class="chip ${ui[key] === k ? 'on' : ''}" data-act="period" data-k="${key}" data-v="${k}" aria-pressed="${ui[key] === k}">${l}</button>`).join('')}</div>`;
const curToggle = () => `<div class="seg" role="group" aria-label="Show amounts in" style="max-width:220px">${CURS.map(c => `<button class="${ui.rcur === c ? 'on' : ''}" data-act="rcur" data-v="${c}" aria-pressed="${ui.rcur === c}">${c}</button>`).join('')}</div>`;
function openDebts(kind) { return db.txns.filter(t => t.kind === kind && balanceOf(t) > 0); }
function inputsValue(blockId, a, b) {
  let v = 0, missing = 0;
  for (const r of db.records) {
    if (r.blockId !== blockId || r.status !== 'done' || r.date < a || r.date > b) continue;
    for (const u of r.used || []) {
      const s = stockById(u.stockId); if (!s) continue;
      if (!(num(s.costPerUnit) > 0)) { missing++; continue; }
      const c = conv(u.qty * num(s.costPerUnit), 'USD', ui.rcur, rateOn(r.date));
      if (c == null) missing++; else v += c;
    }
  }
  return { v, missing };
}
function blockFinance(b, p) {
  const [a, z] = periodRange(p);
  const list = db.txns.filter(t => t.blockId === b.id && t.date >= a && t.date <= z);
  const tt = totals(list), inp = inputsValue(b.id, a, z);
  const yields = {};
  list.filter(t => t.kind === 'income' && num(t.qty)).forEach(t => { yields[t.unit] = (yields[t.unit] || 0) + num(t.qty); });
  return { sales: tt.inc, costs: tt.exp, inputs: inp.v, missing: inp.missing + tt.skipped, margin: tt.inc - tt.exp - inp.v, yields };
}
function rateCard(open) {
  const lr = latestRate();
  const age = lr ? diff(lr.date, today()) : null;
  const form = `<div class="row" style="flex-wrap:nowrap;align-items:flex-end"><div class="f" style="flex:1"><label for="rate_new">1 USD = ? SLSH</label><input id="rate_new" inputmode="decimal" placeholder="${lr ? fmtRate(lr.rate) : 'Today’s rate'}"></div><button class="btn pri" data-act="saverate">Save rate</button></div>`;
  if (!lr) return `<div class="alert info" style="flex-direction:column;gap:10px"><span class="row" style="gap:10px">${ic('info', 20, 2)}<span class="main"><span class="t">Set the exchange rate</span><span class="s">Needed to record shilling transactions and to show totals in both currencies.</span></span></span>${form}</div>`;
  return `<div class="card" style="gap:8px"><div class="between"><span class="col"><span class="k">Exchange rate</span><span class="mono" style="font-size:16px;font-weight:600">1 USD = ${fmtRate(lr.rate)} SLSH</span><span class="s ${age > 7 ? 'neg' : ''}">Updated ${age === 0 ? 'today' : fdy(lr.date)}${age > 7 ? ' · getting old' : ''}</span></span>${open ? '' : `<button class="btn sm" data-act="raterow">Update</button>`}</div>${open ? form : ''}</div>`;
}

function vMoney() {
  const list = txnsIn(ui.mperiod).sort(byDateDesc);
  const tt = totals(list);
  const recv = openDebts('income'), pay = openDebts('expense');
  const sumNow = l => { let s = 0, miss = 0; l.forEach(t => { const v = toRepNow(t, balanceOf(t)); if (v == null) miss++; else s += v; }); return { s, miss }; };
  const R = sumNow(recv), P = sumNow(pay);
  const od = l => l.filter(isOverdue).length;
  const mixed = recv.concat(pay).some(t => (t.currency || 'USD') !== ui.rcur);
  return `<div class="between"><h1>Money</h1><a class="btn sm" href="#reports">Reports</a></div>
  ${rateCard(ui.rateOpen)}
  <div class="between"><span class="lbl">Show totals in</span>${curToggle()}</div>
  ${periodChips('mperiod')}
  <div class="dark"><div class="g3">
    <div class="col"><span class="k">Income</span><span class="v" style="font-size:15px">${money(tt.inc)}</span></div>
    <div class="col"><span class="k">Costs</span><span class="v" style="font-size:15px">${money(tt.exp)}</span></div>
    <div class="col"><span class="k">Net</span><span class="v" style="font-size:15px;color:${tt.net < 0 ? '#F4A79F' : '#9FD3A8'}">${money(tt.net)}</span></div>
  </div><span class="s">${PERIODS[ui.mperiod]} · each transaction converted at its own rate${tt.skipped ? ` · ${tt.skipped} skipped (no rate)` : ''}</span></div>
  <div class="g2">
    <a class="tile" href="#debts?tab=recv" style="text-decoration:none;color:inherit"><span class="k">Owed to you</span><span class="v" style="font-size:15px">${money(R.s)}</span><span class="s ${od(recv) ? 'neg' : ''}">${recv.length} open${od(recv) ? ' · ' + od(recv) + ' overdue' : ''}</span></a>
    <a class="tile" href="#debts?tab=pay" style="text-decoration:none;color:inherit"><span class="k">You owe</span><span class="v" style="font-size:15px">${money(P.s)}</span><span class="s ${od(pay) ? 'neg' : ''}">${pay.length} open${od(pay) ? ' · ' + od(pay) + ' overdue' : ''}</span></a>
  </div>
  ${mixed ? `<p class="hint" style="margin:-6px 0 0">Open balances in the other currency are converted at today's rate.${R.miss + P.miss ? ' Some could not be converted: set a rate.' : ''}</p>` : ''}
  <div class="chips"><a class="chip" href="#txn/new?kind=sale">${ic('plus', 14, 2.2)}Sale</a><a class="chip" href="#txn/new?kind=expense">${ic('plus', 14, 2.2)}Expense</a><a class="chip" href="#txn/new?kind=income">${ic('plus', 14, 2.2)}Other income</a></div>
  <div class="between"><h2>Transactions</h2><span class="s">${list.length}</span></div>
  ${list.length ? `<div class="list">${list.slice(0, 100).map(txnRow).join('')}</div>${list.length > 100 ? '<p class="hint">Showing latest 100. Use Reports → Export CSV for all.</p>' : ''}` : `<div class="empty">No transactions in this period.</div>`}`;
}

function initTDraft(id, q) {
  if (id && id !== 'new') { const t = db.txns.find(x => x.id === id); return t ? Object.assign({ currency: 'USD', rate: '' }, JSON.parse(JSON.stringify(t))) : null; }
  const k = q.get('kind');
  const cur = k === 'expense' ? (db.settings.buyCur || 'USD') : (db.settings.saleCur || 'SLSH');
  const r = rateOn(today());
  return { id: null, kind: k === 'expense' ? 'expense' : 'income', category: k === 'expense' ? defaultExp() : k === 'income' ? firstNonSaleIncome() : firstSaleCat(), date: today(), currency: cur, rate: r ? String(r) : '', rateManual: false, amount: '', party: '', method: 'Cash', blockId: q.get('block') || '', crop: '', qty: '', unit: 'kg', price: '', credit: false, due: '', payments: [], notes: '', stockId: '' };
}
function txnEquivText(d) {
  const other = d.currency === 'SLSH' ? 'USD' : 'SLSH';
  const v = conv(d.amount, d.currency, other, num(d.rate));
  return num(d.amount) ? (v == null ? 'Enter the rate to see the equivalent.' : `≈ ${money(v, other)} at ${fmtRate(d.rate)} SLSH/USD`) : '';
}
function vTxn() {
  const d = tdraft; if (!d) return vMissing();
  const sale = isSaleCat(d.category), cur = d.currency || 'USD';
  const cats = opts(d.kind === 'income' ? 'incomeCats' : 'expenseCats', d.category);
  const parties = [...new Set(db.txns.map(t => t.party).filter(Boolean))].sort();
  const fld = (f, label, extra = '', type = 'text') => `<div class="f"><label for="t_${f}">${label}</label><input id="t_${f}" type="${type}" data-tf="${f}" value="${esc(d[f])}" ${extra}></div>`;
  const blockOpts = `<option value="">${sale ? 'Choose block…' : 'Whole farm'}</option>` + db.blocks.map(b => `<option value="${b.id}" ${b.id === d.blockId ? 'selected' : ''}>${esc(blockLabel(b))}</option>`).join('');
  const paid = paidOf(d), bal = Math.max(0, num(d.amount) - paid);
  const pays = (d.payments || []).map((p, i) => `<div class="item"><span class="date">${fd(p.date)}</span><span class="main"><span class="t mono" style="font-size:13px">${money(p.amount, cur)}</span><span class="s">${esc(p.method || '')}</span></span><button class="btn sm danger" data-act="delpay" data-i="${i}" aria-label="Remove payment of ${money(p.amount, cur)}">Remove</button></div>`).join('');
  return `<a class="back" href="#money" data-act="tback">${ic('back', 18, 2)}Back</a><h1>${d.id ? 'Edit transaction' : sale ? 'New sale' : d.kind === 'income' ? 'New income' : 'New expense'}</h1>
  <div class="form">
    <div class="seg" role="group" aria-label="Type"><button type="button" class="${d.kind === 'income' ? 'on' : ''}" data-act="tkind" data-v="income" aria-pressed="${d.kind === 'income'}">Income</button><button type="button" class="${d.kind === 'expense' ? 'on' : ''}" data-act="tkind" data-v="expense" aria-pressed="${d.kind === 'expense'}">Expense</button></div>
    <div class="g2"><div class="f"><label for="t_category">Category</label><select id="t_category" data-tf="category" data-list="${d.kind === 'income' ? 'incomeCats' : 'expenseCats'}">${cats}</select></div>${fld('date', 'Date', '', 'date')}</div>
    <div class="f"><span class="lbl">Currency</span><div class="seg" role="group" aria-label="Currency">${CURS.map(c => `<button type="button" class="${cur === c ? 'on' : ''}" data-act="tcur" data-v="${c}" aria-pressed="${cur === c}">${c === 'SLSH' ? 'Shilling (SLSH)' : 'Dollar (USD)'}</button>`).join('')}</div></div>
    ${sale ? `<div class="g2"><div class="f"><label for="t_blockId">Block</label><select id="t_blockId" data-tf="blockId">${blockOpts}</select></div><div class="f"><label for="t_crop">Crop</label><select id="t_crop" data-tf="crop" data-list="crops">${opts('crops', d.crop, (blockById(d.blockId) || {}).crop ? 'Block crop (' + blockById(d.blockId).crop + ')' : 'Not set')}</select></div></div>
      <div class="g3">${fld('qty', 'Quantity', 'inputmode="decimal"')}<div class="f"><label for="t_unit">Unit</label><select id="t_unit" data-tf="unit" data-list="saleUnits">${opts('saleUnits', d.unit)}</select></div>${fld('price', `Price / unit (${cur})`, 'inputmode="decimal"')}</div>` : ''}
    ${fld('amount', `Amount (${cur})${sale ? ' — auto from qty × price' : ''}`, 'inputmode="decimal"')}
    <div class="g2" style="align-items:end">${fld('rate', 'Rate (SLSH per 1 USD)', 'inputmode="decimal"')}<span class="hint mono" id="t_eq" style="padding-bottom:14px">${esc(txnEquivText(d))}</span></div>
    ${!(num(d.rate) > 0) ? `<span class="hint neg" style="margin-top:-8px">No rate on file for this date. Set one on the Money screen or type it here.</span>` : `<span class="hint" style="margin-top:-8px">Filled from your rate history for this date; you can change it to the rate actually used.</span>`}
    <div class="f"><label for="t_party">${d.kind === 'income' ? 'Customer' : 'Supplier / paid to'}</label><input id="t_party" data-tf="party" value="${esc(d.party)}" list="partylist" autocomplete="off"><datalist id="partylist">${parties.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    ${!sale ? `<div class="f"><label for="t_blockId">Charge to block</label><select id="t_blockId" data-tf="blockId">${blockOpts}</select><span class="hint">Choose a block for direct costs (seedlings, harvest labour). Leave as whole farm for overheads.</span></div>` : ''}
    <div class="seg" role="group" aria-label="Payment"><button type="button" class="${!d.credit ? 'on' : ''}" data-act="tcredit" data-v="0" aria-pressed="${!d.credit}">Paid now</button><button type="button" class="${d.credit ? 'on' : ''}" data-act="tcredit" data-v="1" aria-pressed="${!!d.credit}">On credit</button></div>
    ${!d.credit ? `<div class="f"><label for="t_method">Paid by</label><select id="t_method" data-tf="method" data-list="methods">${opts('methods', d.method)}</select></div>` : `
      ${fld('due', 'Due date', '', 'date')}
      <div class="card"><div class="between"><span class="t">Payments (${cur})</span><span class="mono s" id="t_bal">Paid ${money(paid, cur)} · balance ${money(bal, cur)}</span></div>
        ${pays ? `<div class="list">${pays}</div>` : '<span class="s">No payments yet.</span>'}
        <div class="g3"><div class="f"><label for="pay_date">Date</label><input id="pay_date" type="date" value="${today()}"></div><div class="f"><label for="pay_amt">Amount</label><input id="pay_amt" inputmode="decimal" placeholder="${bal ? fmt(bal) : ''}"></div><div class="f"><label for="pay_method">By</label><select id="pay_method" data-list="methods">${opts('methods', L('methods')[0])}</select></div></div>
        <span class="hint">Record payments in ${cur}, the currency of this transaction.</span>
        <button type="button" class="btn sm" data-act="addpay">${ic('plus', 16, 2.2)}Add payment</button></div>`}
    <div class="f"><label for="t_notes">Notes</label><textarea id="t_notes" data-tf="notes">${esc(d.notes)}</textarea></div>
    <button class="btn pri block" data-act="savetxn">Save</button>
    ${d.id ? `<button class="btn danger block" data-act="deltxn">Delete transaction</button>` : ''}
  </div>`;
}

function debtsListHtml() {
  const kind = ui.dtab === 'pay' ? 'expense' : 'income';
  const q = ui.dq.trim().toLowerCase();
  const open = openDebts(kind).filter(t => !q || (t.party || '').toLowerCase().includes(q));
  if (!open.length) return `<div class="empty">${q ? 'No match for that name.' : kind === 'income' ? 'No customer owes you money.' : 'You owe nothing on credit.'}</div>`;
  const groups = {};
  open.forEach(t => { const k = t.party || 'No name'; (groups[k] = groups[k] || []).push(t); });
  const byCur = ts => { const m = {}; ts.forEach(t => { const c = t.currency || 'USD'; m[c] = (m[c] || 0) + balanceOf(t); }); return m; };
  const nowVal = ts => ts.reduce((s, t) => s + (toRepNow(t, balanceOf(t)) || 0), 0);
  return Object.entries(groups).sort((a, b) => nowVal(b[1]) - nowVal(a[1])).map(([name, ts]) => {
    const od = ts.some(isOverdue), m = byCur(ts);
    const owed = Object.entries(m).map(([c, v]) => money(v, c)).join(' + ');
    const mixedNote = Object.keys(m).some(c => c !== ui.rcur) ? `<span class="s">≈ ${money(nowVal(ts))} at today's rate</span>` : '';
    return `<div class="card"><div class="between" style="align-items:flex-start"><span class="t" style="font-size:16px">${esc(name)}</span><span class="col" style="align-items:flex-end"><span class="mono ${od ? 'neg' : ''}" style="font-weight:600">${owed}</span>${mixedNote}</span></div>
      <div class="list">${ts.sort(byDate).map(t => `<a class="item" href="#txn/${t.id}"><span class="date">${fd(t.date)}</span><span class="main"><span class="t">${esc(txnTitle(t))}</span><span class="s ${isOverdue(t) ? 'neg' : ''}">${t.due ? (isOverdue(t) ? 'Overdue since ' : 'Due ') + fd(t.due) : 'No due date'} · paid ${money(paidOf(t), t.currency)} of ${money(t.amount, t.currency)}</span></span><span class="mono" style="font-weight:600;white-space:nowrap">${money(balanceOf(t), t.currency)}</span></a>`).join('')}</div></div>`;
  }).join('');
}
function vDebts() {
  return `${back('#money', 'Money')}<h1>Credit &amp; debts</h1>
  <div class="seg"><button class="${ui.dtab === 'recv' ? 'on' : ''}" data-act="dtab" data-v="recv" aria-pressed="${ui.dtab === 'recv'}">Customers owe you</button><button class="${ui.dtab === 'pay' ? 'on' : ''}" data-act="dtab" data-v="pay" aria-pressed="${ui.dtab === 'pay'}">You owe</button></div>
  <div style="position:relative;display:flex;align-items:center"><span style="position:absolute;left:14px;color:var(--mut);display:flex">${ic('search', 18, 2)}</span><label for="debtq" class="sr">Search by name</label><input id="debtq" type="search" placeholder="Search by name" value="${esc(ui.dq)}" style="padding-left:42px"></div>
  <div id="debtlist" class="col" style="gap:12px">${debtsListHtml()}</div>
  <p class="hint">Balances stay in the currency of the sale or purchase. Open a transaction to record a payment.</p>`;
}

function vReports() {
  const list = txnsIn(ui.rpperiod), tt = totals(list);
  const byCat = kind => { const m = {}; list.filter(t => t.kind === kind).forEach(t => { const v = toRep(t); if (v != null) m[t.category] = (m[t.category] || 0) + v; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const bars = (rows, color) => { const max = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([c, v]) => `<div class="col" style="gap:4px"><div class="between s"><span style="color:var(--ink)">${esc(c)}</span><span class="mono">${money(v)}</span></div><div class="bar"><i style="width:${v / max * 100}%;background:${color}"></i></div></div>`).join('') : '<span class="s">None in this period.</span>'; };
  const t = today(), d0 = new Date(t + 'T00:00:00');
  const months = [];
  for (let i = 5; i >= 0; i--) { const s = new Date(d0.getFullYear(), d0.getMonth() - i, 1), e = new Date(d0.getFullYear(), d0.getMonth() - i + 1, 0); const l = db.txns.filter(x => x.date >= iso(s) && x.date <= iso(e)); months.push({ label: s.toLocaleDateString('en-GB', { month: 'short' }), ...totals(l) }); }
  const mmax = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)));
  const blocks = db.blocks.map(b => ({ b, f: blockFinance(b, ui.rpperiod) })).filter(x => x.f.sales || x.f.costs || x.f.inputs);
  const anyMissing = blocks.some(x => x.f.missing);
  const byCurTot = c => list.filter(x => (x.currency || 'USD') === c).reduce((a, x) => { a[x.kind] += num(x.amount); return a; }, { income: 0, expense: 0 });
  const U = byCurTot('USD'), S = byCurTot('SLSH');
  return `${back('#money', 'Money')}<h1>Reports</h1>
  <div class="between"><span class="lbl">Show in</span>${curToggle()}</div>${periodChips('rpperiod')}
  <div class="dark"><div class="g3"><div class="col"><span class="k">Income</span><span class="v" style="font-size:15px">${money(tt.inc)}</span></div><div class="col"><span class="k">Costs</span><span class="v" style="font-size:15px">${money(tt.exp)}</span></div><div class="col"><span class="k">Net</span><span class="v" style="font-size:15px;color:${tt.net < 0 ? '#F4A79F' : '#9FD3A8'}">${money(tt.net)}</span></div></div>
    <span class="s">Each transaction converted at the rate stored on it${tt.skipped ? ` · ${tt.skipped} skipped (no rate)` : ''}</span></div>
  <div class="card"><span class="t">As recorded, by currency</span>
    <div class="between s"><span>Shilling</span><span class="mono">in ${money(S.income, 'SLSH')} · out ${money(S.expense, 'SLSH')}</span></div>
    <div class="between s"><span>Dollar</span><span class="mono">in ${money(U.income, 'USD')} · out ${money(U.expense, 'USD')}</span></div></div>
  <div class="card"><div class="between"><span class="t">Last 6 months</span><span class="row s" style="gap:10px"><span class="row" style="gap:4px"><i style="width:10px;height:10px;background:var(--acc);border-radius:2px;display:inline-block"></i>Income</span><span class="row" style="gap:4px"><i style="width:10px;height:10px;background:var(--sun);border-radius:2px;display:inline-block"></i>Costs</span></span></div>
    <div role="img" aria-label="Monthly income and costs for the last six months in ${ui.rcur}" style="height:110px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;align-items:end">${months.map(m => `<div style="display:flex;gap:2px;align-items:end;height:100%"><i style="flex:1;height:${m.inc / mmax * 100}%;min-height:2px;background:var(--acc);border-radius:3px 3px 0 0;display:block" title="Income ${money(m.inc)}"></i><i style="flex:1;height:${m.exp / mmax * 100}%;min-height:2px;background:var(--sun);border-radius:3px 3px 0 0;display:block" title="Costs ${money(m.exp)}"></i></div>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px" class="mono s">${months.map(m => `<span style="text-align:center;font-size:11px">${m.label}</span>`).join('')}</div></div>
  <div class="card"><span class="t">Costs by category</span>${bars(byCat('expense'), 'var(--sun)')}</div>
  <div class="card"><span class="t">Income by category</span>${bars(byCat('income'), 'var(--acc)')}</div>
  <div class="card"><span class="t">Margin by block</span>
    ${blocks.length ? blocks.map(({ b, f }) => `<div class="col" style="gap:4px;border-top:1px solid var(--line2);padding-top:10px">
      <div class="between"><span class="t">${esc(blockLabel(b))}</span><span class="mono ${f.margin < 0 ? 'neg' : ''}" style="font-weight:700">${money(f.margin)}</span></div>
      <span class="s">Sales ${money(f.sales)} · direct costs ${money(f.costs)} · inputs used ${money(f.inputs)}${num(b.areaHa) ? ` · ${money(f.margin / num(b.areaHa))}/ha` : ''}</span>
      ${Object.keys(f.yields).length ? `<span class="s">Sold: ${Object.entries(f.yields).map(([u, q]) => `${fmt(q)} ${u}${u === 'kg' && num(b.areaHa) ? ` (${fmt(q / num(b.areaHa) / 1000)} t/ha)` : ''}`).join(', ')}</span>` : ''}</div>`).join('') : '<span class="s">No block-level sales or costs in this period.</span>'}
    <span class="hint">Margin = sales − costs charged to the block − stock used on the block (unit cost in USD, converted at the rate on the day it was used). Whole-farm overheads are not included.${anyMissing ? ' Some items have no unit cost or rate, so figures are understated.' : ''}</span></div>
  <button class="btn" data-act="csv">Export transactions (CSV)</button>`;
}
function exportCSV() {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['date', 'type', 'category', 'amount', 'currency', 'rate_slsh_per_usd', 'amount_usd', 'amount_slsh', 'party', 'block', 'crop', 'qty', 'unit', 'price', 'payment', 'credit', 'paid', 'balance', 'due', 'notes'];
  const rows = [...db.txns].sort(byDate).map(t => {
    const c = t.currency || 'USD', r = tRate(t);
    const usd = conv(t.amount, c, 'USD', r), sl = conv(t.amount, c, 'SLSH', r);
    return [t.date, t.kind, t.category, num(t.amount), c, r || '', usd == null ? '' : Math.round(usd * 100) / 100, sl == null ? '' : Math.round(sl), t.party, (blockById(t.blockId) || {}).name || '', t.crop || (blockById(t.blockId) || {}).crop || '', t.qty, t.unit, t.price, t.credit ? '' : t.method, t.credit ? 'yes' : 'no', t.credit ? paidOf(t) : num(t.amount), balanceOf(t), t.due, t.notes].map(q).join(',');
  });
  const blob = new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `farm-transactions-${today()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('CSV downloaded');
}
function saveRate(date, rate) {
  db.rates = db.rates || [];
  const ex = db.rates.find(r => r.date === date);
  if (ex) ex.rate = rate; else db.rates.push({ id: uid(), date, rate });
}

/* ---------- crop cycles (one block, many plantings over time) ---------- */
/* block.history = past cycles [{id, crop, variety, planted, ended, from, cycleDays, stages, notes}]
   block.cycleFrom = first day that belongs to the current crop (day after the last crop ended).
   Records and money on a block are assigned to a crop by date. */
const curFrom = b => b.cycleFrom || '0000-01-01';
function cycleRanges(b) {
  return (b.history || []).map(c => ({ ...c, a: c.from || '0000-01-01', z: c.ended }));
}
function rangeFinance(blockId, a, z) {
  const list = db.txns.filter(t => t.blockId === blockId && t.date >= a && t.date <= z);
  const tt = totals(list), inp = inputsValue(blockId, a, z);
  const yields = {};
  list.filter(t => t.kind === 'income' && num(t.qty)).forEach(t => { yields[t.unit] = (yields[t.unit] || 0) + num(t.qty); });
  return { sales: tt.inc, costs: tt.exp, inputs: inp.v, missing: inp.missing + tt.skipped, margin: tt.inc - tt.exp - inp.v, yields, n: list.length };
}
function finSummary(f, b) {
  const y = Object.entries(f.yields).map(([u, q]) => `${fmt(q)} ${u}${u === 'kg' && num(b.areaHa) ? ` (${fmt(q / num(b.areaHa) / 1000)} t/ha)` : ''}`).join(', ');
  return `<div class="g3"><div class="col"><span class="k">Sales</span><span class="v" style="font-size:14px">${money(f.sales)}</span></div><div class="col"><span class="k">Costs + inputs</span><span class="v" style="font-size:14px">${money(f.costs + f.inputs)}</span></div><div class="col"><span class="k">Margin</span><span class="v ${f.margin < 0 ? 'neg' : ''}" style="font-size:14px">${money(f.margin)}</span></div></div>
  ${y ? `<span class="s">Sold: ${y}</span>` : ''}${f.missing ? `<span class="hint">Some stock used has no unit cost, so inputs are understated.</span>` : ''}`;
}
function cycleNeedsNew(b) {
  if (b.status === 'harvested') return true;
  const d = cropDay(b), end = planEnd(b);
  return b.crop && d != null && end && d > end;
}
function pastCropsHtml(b) {
  const cs = cycleRanges(b).slice().reverse();
  if (!cs.length) return '';
  return `<p class="sec">Past crops in ${esc(b.name)}</p><div class="list">${cs.map(c => {
    const f = rangeFinance(b.id, c.a, c.z);
    const n = db.records.filter(r => r.blockId === b.id && r.date >= c.a && r.date <= c.z).length;
    return `<a class="item" href="#cycle/${b.id}/${c.id}"><span class="main"><span class="t">${esc(c.crop || 'Fallow')}${c.variety ? ' · ' + esc(c.variety) : ''}</span><span class="s">${c.planted ? fd(c.planted) + ' – ' : 'Until '}${fdy(c.ended)} · ${n} records</span></span><span class="col" style="align-items:flex-end"><span class="mono ${f.margin < 0 ? 'neg' : ''}" style="font-weight:600">${money(f.margin)}</span><span class="s">margin</span></span></a>`;
  }).join('')}</div>`;
}
function vCycle(blockId, cid) {
  const b = blockById(blockId); if (!b) return vMissing();
  const c = cycleRanges(b).find(x => x.id === cid); if (!c) return vMissing();
  const recs = db.records.filter(r => r.blockId === b.id && r.date >= c.a && r.date <= c.z).sort(byDateDesc);
  const txns = db.txns.filter(t => t.blockId === b.id && t.date >= c.a && t.date <= c.z).sort(byDateDesc);
  const f = rangeFinance(b.id, c.a, c.z);
  const len = c.planted ? diff(c.planted, c.ended) : null;
  return `${back('#block/' + b.id, b.name)}
  <div class="col"><span class="eyebrow">${esc(b.name)} · past crop</span><h1>${esc(c.crop || 'Fallow')}</h1></div>
  <div class="tiles"><div class="tile"><span class="k">Planted</span><span class="v">${fd(c.planted)}</span></div><div class="tile"><span class="k">Ended</span><span class="v">${fd(c.ended)}</span></div><div class="tile"><span class="k">Days</span><span class="v">${len == null ? '—' : len}</span></div></div>
  ${c.variety || c.notes ? `<p class="s" style="margin:0">${esc([c.variety ? 'Variety: ' + c.variety : '', c.notes].filter(Boolean).join(' · '))}</p>` : ''}
  <div class="dark">${finSummary(f, b)}</div>
  <p class="sec">Records</p>${recs.length ? `<div class="list">${recs.map(r => r.status === 'done' ? doneRow(r, false) : taskRow(r, false)).join('')}</div>` : '<div class="empty">No records in this period.</div>'}
  ${(() => { const is = (db.issues || []).filter(i => i.blockId === b.id && i.date >= c.a && i.date <= c.z).sort(byDateDesc); return is.length ? `<p class="sec">Plant health</p><div class="list">${is.map(i => issueRow(i, false)).join('')}</div>` : ''; })()}
  <p class="sec">Money</p>${txns.length ? `<div class="list">${txns.map(txnRow).join('')}</div>` : '<div class="empty">No transactions charged to this block in this period.</div>'}
  <p class="hint">Includes everything recorded on ${esc(b.name)} from ${c.from ? fd(c.from) : 'the start'} to ${fdy(c.ended)}.</p>`;
}
function initNC(b) {
  const sameStages = b.stages && b.stages.length;
  const y = addDays(today(), -1), ended = b.crop && b.planted && b.planted > y ? b.planted : y;
  return { ended, crop: '', variety: '', planted: addDays(ended, 1) > today() ? addDays(ended, 1) : today(), cycleDays: '', stagesMode: sameStages ? 'same' : 'generic', next: 'plant', notes: '' };
}
function vNewCycle(id) {
  const b = blockById(id); if (!b || !ncdraft) return vMissing();
  const d = ncdraft, hasCrop = !!b.crop;
  const f = rangeFinance(b.id, curFrom(b), d.ended || today());
  const fld = (k, label, extra = '', type = 'text') => `<div class="f"><label for="nc_${k}">${label}</label><input id="nc_${k}" type="${type}" data-nf="${k}" value="${esc(d[k])}" ${extra}></div>`;
  return `${back('#block/' + b.id, b.name)}<h1>${hasCrop ? 'Finish crop & start new' : 'Start a new crop'}</h1>
  <div class="form">
    ${hasCrop ? `<div class="card"><span class="t">1 · Close the current crop</span>
      <span class="s">${esc(b.crop)}${b.variety ? ' · ' + esc(b.variety) : ''} · planted ${fdy(b.planted)}</span>
      ${fld('ended', 'Last harvest / crop removed on', '', 'date')}
      <div class="dark" style="margin-top:4px">${finSummary(f, b)}</div>
      <span class="hint">This crop, its records and its money are kept under "Past crops" on the block page. Everything recorded on ${esc(b.name)} up to and including this date belongs to ${esc(b.crop)}; from the next day it belongs to the new crop.</span></div>` : `<p class="hint" style="margin:0">The block has no current crop, so any costs recorded while it was empty (land preparation, seedlings) will count towards the new crop.</p>`}
    <div class="card"><span class="t">${hasCrop ? '2 · ' : ''}What next?</span>
      <div class="seg" role="group" aria-label="Next"><button type="button" class="${d.next === 'plant' ? 'on' : ''}" data-act="ncnext" data-v="plant" aria-pressed="${d.next === 'plant'}">Plant a new crop</button><button type="button" class="${d.next === 'fallow' ? 'on' : ''}" data-act="ncnext" data-v="fallow" aria-pressed="${d.next === 'fallow'}">Leave fallow</button></div>
      ${d.next === 'plant' ? `
      <div class="g2"><div class="f"><label for="nc_crop">Crop</label><select id="nc_crop" data-nf="crop" data-list="crops">${opts('crops', d.crop, 'Choose crop…')}</select></div>${fld('variety', 'Variety')}</div>
      <div class="g2">${fld('planted', 'Planting / transplant date', '', 'date')}${fld('cycleDays', 'Crop cycle (days)', 'inputmode="numeric"')}</div>
      <div class="f"><label for="nc_stages">Growth stages</label><select id="nc_stages" data-nf="stagesMode">${[['same', 'Same as previous crop'], ['tomato', 'Tomato template'], ['generic', '5 stages from cycle length'], ['none', 'None for now']].filter(([v]) => v !== 'same' || (b.stages && b.stages.length)).map(([v, l]) => `<option value="${v}" ${d.stagesMode === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint">You can edit stages afterwards in Edit block.</span></div>` : `<span class="s">The block will show as fallow. Use "Start a new crop" on the block when you plant again.</span>`}
      ${fld('notes', 'Notes for the new period (optional)')}</div>
    <button class="btn pri block" data-act="ncsave">${d.next === 'plant' ? 'Start new crop' : hasCrop ? 'Close crop, leave fallow' : 'Save'}</button>
  </div>`;
}
let ncdraft = null, ncdraftKey = null;

/* ---------- AI assistant: answers from local records first, then any AI provider ---------- */
var aiReady = false;
const AI_KEY = 'farmapp.apikey';   /* old single Claude key — left in place so an older app version still works */
const AI_KEYS = 'farmapp.aikeys';  /* {providerId: key} — this phone only, never in backups */
const AI_KINDS = { diagnose: 'Identify a problem', nutrition: 'Nutrition advice', question: 'Other question' };
const PRICE_ASOF = 'Nov 2026';
/* Endpoints checked against each provider's documentation in Nov 2026. All are editable in Settings. */
const PRESETS = {
  anthropic: { name: 'Anthropic Claude', proto: 'anthropic', base: 'https://api.anthropic.com/v1', hint: 'sk-ant-…', docs: 'https://platform.claude.com/docs/en/about-claude/pricing', vision: true },
  openai: { name: 'OpenAI (GPT)', proto: 'openai', base: 'https://api.openai.com/v1', hint: 'sk-…', docs: 'https://platform.openai.com/docs/pricing', maxParam: 'max_completion_tokens' },
  gemini: { name: 'Google Gemini', proto: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', hint: 'AIza…', docs: 'https://ai.google.dev/gemini-api/docs/pricing', vision: true },
  deepseek: { name: 'DeepSeek', proto: 'openai', base: 'https://api.deepseek.com', hint: 'sk-…', docs: 'https://api-docs.deepseek.com/quick_start/pricing' },
  moonshot: { name: 'Moonshot AI (Kimi)', proto: 'openai', base: 'https://api.moonshot.ai/v1', hint: 'sk-…', docs: 'https://platform.kimi.ai/docs' },
  qwen: { name: 'Alibaba Qwen (Model Studio)', proto: 'openai', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', hint: 'sk-…', docs: 'https://www.alibabacloud.com/help/en/model-studio/' },
  groq: { name: 'Groq', proto: 'openai', base: 'https://api.groq.com/openai/v1', hint: 'gsk_…', docs: 'https://groq.com/pricing' },
  openrouter: { name: 'OpenRouter (many models, one key)', proto: 'openai', base: 'https://openrouter.ai/api/v1', hint: 'sk-or-…', docs: 'https://openrouter.ai/models' },
  together: { name: 'Together AI', proto: 'openai', base: 'https://api.together.ai/v1', hint: '', docs: 'https://www.together.ai/pricing' },
  custom: { name: 'Custom (OpenAI-compatible)', proto: 'openai', base: '', hint: '', docs: '' }
};
/* Starting values only — editable per model in Settings. USD per 1M tokens. */
const STARTER = {
  anthropic: [
    { id: 'claude-sonnet-5-5', in: 2, out: 10, cin: 0.1, ctx: 1000000, vision: true, reasoning: false, json: true, src: 'Starting prices as of ' + PRICE_ASOF + ' — check the pricing page' },
    { id: 'claude-haiku-5-5', in: 0.1, out: 0.5, cin: 0.01, ctx: 1000000, vision: true, reasoning: false, json: true, src: 'Starting prices as of ' + PRICE_ASOF + ' (prompts up to 100K tokens) — check the pricing page' },
    { id: 'claude-opus-5-5', in: 4, out: 20, cin: 0.2, ctx: 1000000, vision: true, reasoning: false, json: true, src: 'Starting prices as of ' + PRICE_ASOF + ' — check the pricing page' }
  ]
};
const TIERS = { routine: 'Everyday questions (lowest cost)', complex: 'Complex planning and diagnosis', vision: 'Photos (image analysis)' };

const aiKeys = () => { try { return JSON.parse(localStorage.getItem(AI_KEYS) || '{}') || {}; } catch (e) { return {}; } };
const keyOf = id => aiKeys()[id] || '';
function setKey(id, k) { const o = aiKeys(); if (k) o[id] = k; else delete o[id]; try { localStorage.setItem(AI_KEYS, JSON.stringify(o)); return true; } catch (e) { return false; } }
const blankModel = (id, P) => ({ id, in: '', out: '', cin: '', ctx: '', vision: !!(P && P.vision), reasoning: false, json: false, src: '' });
function newProvider(k) { const P = PRESETS[k] || PRESETS.custom; return { id: 'p' + uid(), preset: k, name: P.name, proto: P.proto, base: P.base, models: (STARTER[k] || []).map(m => ({ ...m })) }; }
/* create AI settings; carry the existing Claude key and model over */
function ensureAI(d) {
  const s = d.settings; let ch = false;
  if (!s.ai || !Array.isArray(s.ai.providers)) {
    s.ai = { v: 1, routing: 'manual', providers: [], routes: { routine: '', complex: '', vision: '' }, concise: true, cache: true, askPhotos: true, budget: '', warnPct: 80, hardStop: false, localCount: 0, agg: {} }; ch = true;
    let old = ''; try { old = localStorage.getItem(AI_KEY) || ''; } catch (e) { }
    if (old || s.aiMode === 'api') {
      const p = newProvider('anthropic'); s.ai.providers.push(p);
      if (old && !keyOf(p.id)) setKey(p.id, old);
      if (s.aiModel && !p.models.some(m => m.id === s.aiModel)) p.models.unshift(blankModel(s.aiModel, PRESETS.anthropic));
      const ref = p.id + '|' + (s.aiModel || p.models[0].id);
      s.ai.routes = { routine: ref, complex: ref, vision: ref };
    }
  }
  if (!s.ai.routes) { s.ai.routes = { routine: '', complex: '', vision: '' }; ch = true; }
  if (!s.ai.agg) { s.ai.agg = {}; ch = true; }
  if (!Array.isArray(d.aiUsage)) { d.aiUsage = []; ch = true; }
  return ch;
}
const AIS = () => db.settings.ai;
const provById = id => AIS().providers.find(p => p.id === id);
const hostOf = u => { try { return new URL(u).host; } catch (e) { return u || 'the provider'; } };
function resolveRef(ref) { if (!ref) return null; const k = String(ref).indexOf('|'); const p = provById(ref.slice(0, k)); const m = p && p.models.find(x => x.id === ref.slice(k + 1)); return m ? { p, m, ref } : null; }
const allModels = () => AIS().providers.flatMap(p => p.models.map(m => ({ p, m, ref: p.id + '|' + m.id })));
const usableModels = () => allModels().filter(x => keyOf(x.p.id));
const aiMode = () => db.settings.aiMode === 'api' && usableModels().length ? 'api' : 'share';
const usd = n => n == null ? 'price not set' : '$' + (Math.abs(n) < 0.1 ? n.toFixed(4) : n.toFixed(2));
const estTok = s => Math.ceil(String(s || '').length / 3.7);
function validBase(u) {
  let x; try { x = new URL(String(u).trim()); } catch (e) { return { err: 'That is not a valid web address.' }; }
  const local = x.hostname === 'localhost' || x.hostname === '127.0.0.1';
  if (x.protocol !== 'https:' && !(x.protocol === 'http:' && local)) return { err: 'The address must start with https:// so your key is encrypted on the way.' };
  if (x.username || x.password) return { err: 'Remove the user name or password from the address.' };
  if (x.search || x.hash) return { err: 'Remove everything after "?" or "#" from the address.' };
  return { url: x.origin + x.pathname.replace(/\/+$/, '') };
}

/* ----- provider adapters: each one knows its own request, reply and usage format ----- */
const ADAPTERS = {
  anthropic: {
    headers: k => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' }),
    chatUrl: p => p.base + '/messages',
    body: (p, m, sys, msgs, max) => ({
      model: m.id, max_tokens: max, system: sys,
      messages: msgs.map(x => ({ role: x.role, content: (x.images && x.images.length) || x.cache ? [...(x.images || []).map(i => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: i.b64 } })), Object.assign({ type: 'text', text: x.text }, x.cache ? { cache_control: { type: 'ephemeral' } } : {})] : x.text }))
    }),
    parse: d => {
      const u = d.usage || {}, cr = u.cache_read_input_tokens || 0, cw = u.cache_creation_input_tokens || 0;
      return { text: (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim(), usage: { in: (u.input_tokens || 0) + cr + cw, out: u.output_tokens || 0, cached: cr, cw } };
    },
    modelsUrl: p => p.base + '/models?limit=100',
    models: d => (d.data || []).map(x => ({ id: x.id, vision: true }))
  },
  openai: {
    headers: (k, p) => Object.assign({ authorization: 'Bearer ' + k, 'content-type': 'application/json' }, p.preset === 'openrouter' ? { 'x-title': 'Farm Manager' } : {}),
    chatUrl: p => p.base + '/chat/completions',
    body: (p, m, sys, msgs, max) => ({
      model: m.id, [p.maxParam || (PRESETS[p.preset] || {}).maxParam || 'max_tokens']: max,
      messages: [{ role: 'system', content: sys }, ...msgs.map(x => ({ role: x.role, content: x.images && x.images.length ? [{ type: 'text', text: x.text }, ...x.images.map(i => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + i.b64 } }))] : x.text }))]
    }),
    parse: d => {
      const u = d.usage || {}, c = (d.choices || [])[0] || {}, mc = (c.message || {}).content;
      const text = Array.isArray(mc) ? mc.map(x => x.text || '').join('\n') : (mc || '');
      const cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || u.prompt_cache_hit_tokens || 0;
      return { text: text.trim(), usage: { in: u.prompt_tokens || 0, out: u.completion_tokens || 0, cached, cw: 0, cost: typeof u.cost === 'number' ? u.cost : null } };
    },
    modelsUrl: p => p.base + '/models',
    models: d => (Array.isArray(d) ? d : d.data || []).map(x => {
      const pr = x.pricing || {}, mod = (x.architecture && x.architecture.input_modalities) || [], sp = x.supported_parameters || [];
      const perTok = pr.prompt != null, pin = perTok ? num(pr.prompt) * 1e6 : pr.input, pout = perTok ? num(pr.completion) * 1e6 : pr.output;
      return { id: x.id, ctx: x.context_length || x.context_window || '', in: pin != null && pin !== '' ? r2(num(pin)) : '', out: pout != null && pout !== '' ? r2(num(pout)) : '', cin: pr.input_cache_read != null ? r2(num(pr.input_cache_read) * 1e6) : '', vision: mod.includes('image'), reasoning: sp.includes('reasoning'), json: sp.includes('structured_outputs') || sp.includes('response_format'), priced: pin != null && pin !== '' };
    })
  },
  gemini: {
    headers: k => ({ 'x-goog-api-key': k, 'content-type': 'application/json' }),
    chatUrl: (p, m) => `${p.base}/models/${encodeURIComponent(m.id)}:generateContent`,
    body: (p, m, sys, msgs, max) => ({
      systemInstruction: { parts: [{ text: sys }] }, generationConfig: { maxOutputTokens: max },
      contents: msgs.map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.text }, ...(x.images || []).map(i => ({ inlineData: { mimeType: 'image/jpeg', data: i.b64 } }))] }))
    }),
    parse: d => {
      const u = d.usageMetadata || {}, c = (d.candidates || [])[0] || {};
      return { text: ((c.content || {}).parts || []).filter(x => x.text && !x.thought).map(x => x.text).join('\n').trim(), usage: { in: u.promptTokenCount || 0, out: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), cached: u.cachedContentTokenCount || 0, cw: 0 } };
    },
    modelsUrl: p => p.base + '/models?pageSize=200',
    models: d => (d.models || []).filter(x => (x.supportedGenerationMethods || []).includes('generateContent')).map(x => ({ id: String(x.name).replace(/^models\//, ''), ctx: x.inputTokenLimit || '', vision: true }))
  }
};
async function httpJSON(url, opt, host) {
  if (navigator.onLine === false) throw new Error('No internet connection. Your records still work offline; AI needs a connection.');
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 120000);
  let res;
  try { res = await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); }
  catch (e) { clearTimeout(tm); throw new Error(e.name === 'AbortError' ? 'The AI took too long to answer. Try again.' : `Could not reach ${host}. Check your internet connection. If the connection is fine, this provider may not accept requests sent straight from a phone app; OpenRouter does, and offers most of the same models.`); }
  clearTimeout(tm);
  let data = null; try { data = await res.json(); } catch (e) { }
  if (!res.ok) {
    const er = Array.isArray(data) ? data[0] && data[0].error : data && (data.error || data);
    const detail = (er && (er.message || (typeof er === 'string' ? er : ''))) || res.statusText || 'Unknown error';
    const s = res.status;
    const e = new Error(s === 401 || s === 403 ? `The API key was rejected by ${host}. Check it in Settings.` : s === 402 ? `${host} reports no credit left on the account.` : s === 404 ? `${host} did not find that model or address. Check the model name and endpoint in Settings.` : s === 429 ? `${host} is limiting requests or the account quota is used up. Wait a minute and try again.` : s >= 500 ? `${host} is busy right now. Try again shortly.` : `${host} returned an error (${s}): ${detail}`);
    e.status = s; e.detail = String(detail); throw e;
  }
  return data || {};
}
async function callAI(p, m, sys, msgs, max) {
  const key = keyOf(p.id); if (!key) throw new Error(`Add the API key for ${p.name} in Settings first.`);
  const ad = ADAPTERS[p.proto] || ADAPTERS.openai, host = hostOf(p.base);
  const lim = Math.round((max || 700) * (m.reasoning ? 3 : 1));
  const send = () => httpJSON(ad.chatUrl(p, m), { method: 'POST', headers: ad.headers(key, p), body: JSON.stringify(ad.body(p, m, sys, msgs, lim)) }, host);
  let data;
  try { data = await send(); }
  catch (e) {
    /* some OpenAI-style models want the other name for the length limit; a rejected request is not billed */
    if (p.proto !== 'anthropic' && p.proto !== 'gemini' && e.status === 400 && /max_(completion_)?tokens/.test(e.detail || '')) {
      p.maxParam = Object.keys(ad.body(p, m, sys, msgs, lim)).includes('max_tokens') ? 'max_completion_tokens' : 'max_tokens'; save();
      data = await send();
    } else throw e;
  }
  const r = ad.parse(data);
  if (!r.text) r.text = '(The model returned an empty answer. Try the Detailed length or another model.)';
  return r;
}
async function fetchModels(p) {
  const key = keyOf(p.id); if (!key) throw new Error('Save the API key first.');
  const ad = ADAPTERS[p.proto] || ADAPTERS.openai;
  const h = ad.headers(key, p); delete h['content-type'];
  const d = await httpJSON(ad.modelsUrl(p), { headers: h }, hostOf(p.base));
  return ad.models(d).filter(x => x.id).sort((a, b) => a.id.localeCompare(b.id));
}

/* ----- usage and cost ----- */
function costOf(p, m, u) {
  if (u.cost != null) return u.cost;
  if (m.in === '' || m.in == null || m.out === '' || m.out == null) return null;
  const pin = num(m.in), cin = m.cin === '' || m.cin == null ? pin : num(m.cin), cr = u.cached || 0, cw = u.cw || 0;
  return (Math.max(0, u.in - cr - cw) * pin + cr * cin + cw * pin * 1.25 + u.out * num(m.out)) / 1e6;
}
function logUsage(p, m, u, kind) {
  const cost = costOf(p, m, u);
  db.aiUsage.push({ id: uid(), ts: Date.now(), date: today(), pid: p.id, prov: p.name, model: m.id, in: u.in, out: u.out, cached: u.cached || 0, cw: u.cw || 0, cost, rep: u.cost != null, kind });
  if (db.aiUsage.length > 1200) {
    const A = AIS();
    db.aiUsage.splice(0, 400).forEach(e => { const k = e.date.slice(0, 7) + '|' + e.prov + '|' + e.model, g = A.agg[k] || (A.agg[k] = { n: 0, in: 0, out: 0, cached: 0, cost: 0, unp: 0 }); g.n++; g.in += e.in; g.out += e.out; g.cached += e.cached; if (e.cost == null) g.unp++; else g.cost += e.cost; });
  }
  save(); return cost;
}
function usageRows(pre) {
  const map = {};
  const add = (prov, model, n, i, o, c, cost, unp) => { const k = prov + '|' + model, g = map[k] || (map[k] = { prov, model, n: 0, in: 0, out: 0, cached: 0, cost: 0, unp: 0 }); g.n += n; g.in += i; g.out += o; g.cached += c; g.cost += cost; g.unp += unp; };
  db.aiUsage.filter(e => e.date.startsWith(pre)).forEach(e => add(e.prov, e.model, 1, e.in, e.out, e.cached, e.cost || 0, e.cost == null ? 1 : 0));
  Object.entries(AIS().agg || {}).forEach(([k, g]) => { const [ym, prov, model] = k.split('|'); if (ym.startsWith(pre) || pre.startsWith(ym) && pre.length === 7) add(prov, model, g.n, g.in, g.out, g.cached, g.cost, g.unp); });
  return Object.values(map).sort((a, b) => b.cost - a.cost || b.n - a.n);
}
const sumRows = rows => rows.reduce((t, g) => ({ n: t.n + g.n, in: t.in + g.in, out: t.out + g.out, cached: t.cached + g.cached, cost: t.cost + g.cost, unp: t.unp + g.unp }), { n: 0, in: 0, out: 0, cached: 0, cost: 0, unp: 0 });
const monthSpend = () => sumRows(usageRows(today().slice(0, 7)));
function budgetGate(est) {
  const A = AIS(), B = num(A.budget), sp = monthSpend().cost, left = B - sp;
  if (B > 0 && A.hardStop && sp >= B) return { block: `Monthly AI budget reached (${usd(sp)} of ${usd(B)}). Raise it under Settings → AI usage, or use the chat-app option.` };
  const why = [];
  if (est.tin > 25000) why.push(`about ${est.tin.toLocaleString('en-US')} input tokens`);
  if (est.cost != null && est.cost > 0.05) why.push(`an estimated ${usd(est.cost)}`);
  if (B > 0 && est.cost != null && est.cost > Math.max(0.01, left * 0.25)) why.push(left > 0 ? `a large share of the ${usd(left)} left in this month's budget` : 'more than is left in this month\'s budget');
  return why.length ? { warn: `This request is unusually large: ${why.join(', ')}. Send it?` } : {};
}
function budgetNotice() {
  const A = AIS(), B = num(A.budget); if (!(B > 0)) return;
  const sp = monthSpend().cost, ym = today().slice(0, 7), lim = B * num(A.warnPct || 80) / 100;
  if (sp >= B && A.warnedFull !== ym) { A.warnedFull = ym; A.warned = ym; save(); toast(`AI budget used up: ${usd(sp)} of ${usd(B)} this month (estimate).`); }
  else if (sp >= lim && A.warned !== ym) { A.warned = ym; save(); toast(`AI spend this month is about ${usd(sp)} of your ${usd(B)} budget.`); }
}

/* ----- photos for AI: shrink to 1568 px on the long edge (keeps lesion detail, limits tokens) ----- */
function loadPhoto(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 1568, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      c.toBlob(blob => res({ dataUrl, b64: dataUrl.split(',')[1], w: c.width, h: c.height, file: new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) }), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image.')); };
    img.src = url;
  });
}
function mdLite(s) {
  const lines = esc(s).split('\n'); let out = '', inList = false;
  const inline = x => x.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const ln of lines) {
    const m = ln.match(/^\s*([-*•]|\d+[.)])\s+(.*)/);
    if (m) { if (!inList) { out += '<ul style="margin:4px 0;padding-left:20px">'; inList = true; } out += `<li style="margin:3px 0">${inline(m[2])}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    const h = ln.match(/^#{1,4}\s+(.*)/);
    if (h) out += `<p style="margin:10px 0 4px;font-weight:700">${inline(h[1])}</p>`;
    else if (ln.trim()) out += `<p style="margin:4px 0">${inline(ln)}</p>`;
  }
  if (inList) out += '</ul>';
  return out;
}

/* ===== local answers: record searches and calculations, no AI ===== */
const QSTOP = new Set('the a an my on in at of to for and is are was were did do does i me we our have has had with this that it be been when what how much many last latest most recent block field batch crop please show list any all from since some there their them'.split(' '));
const qnorm = s => String(s || '').toLowerCase().replace(/iz/g, 'is').replace(/[^a-z0-9.%\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const qstem = w => w.length > 4 ? w.replace(/ies$/, 'y').replace(/(es|s)$/, '') : w;
const tokEq = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
function findBlocks(q) {
  const pad = ' ' + q + ' ', toks = q.split(' ').map(qstem);
  const byName = db.blocks.filter(b => b.name && pad.includes(' ' + qnorm(b.name) + ' '));
  if (byName.length) return { list: byName.filter(b => !byName.some(o => o !== b && o.name.length > b.name.length && qnorm(o.name).includes(qnorm(b.name)))), how: 'name' };
  const GEN = new Set(['sweet', 'green', 'white', 'early', 'late', 'black', 'yellow']);
  const hit = (crop, variety) => qnorm(crop + ' ' + (variety || '')).split(' ').map(qstem).filter(t => t.length >= 4 && !GEN.has(t)).some(t => toks.some(k => tokEq(k, t)));
  let cur = db.blocks.filter(b => b.crop && hit(b.crop, b.variety));
  if (cur.length > 1) { const ex = cur.filter(b => pad.includes(' ' + qnorm(b.crop) + ' ') || pad.includes(' ' + qnorm(b.crop) + 's ') || pad.includes(' ' + qnorm(b.crop) + 'es ')); if (ex.length) cur = ex; }
  if (cur.length) return { list: cur, how: 'crop' };
  const past = db.blocks.filter(b => (b.history || []).some(c => c.crop && hit(c.crop, c.variety)));
  return { list: past, how: past.length ? 'past' : '' };
}
function findStock(q) {
  const toks = q.split(' ').map(qstem).filter(t => t.length >= 3 && !QSTOP.has(t));
  const sc = db.stock.map(s => ({ s, n: qnorm(s.name + ' ' + (s.ai || '')).split(' ').map(qstem).filter(t => t.length >= 4 && !/^\d/.test(t)).filter(t => toks.some(k => tokEq(k, t))).length })).filter(x => x.n);
  const mx = Math.max(0, ...sc.map(x => x.n));
  return sc.filter(x => x.n === mx).map(x => x.s);
}
function qPeriod(q) {
  const t = today(), d = new Date(t + 'T00:00:00'), y = d.getFullYear(), m = d.getMonth(); let x;
  if (/\btoday\b/.test(q)) return [t, t, 'today'];
  if (/\byesterday\b/.test(q)) return [addDays(t, -1), addDays(t, -1), 'yesterday'];
  if ((x = q.match(/\b(?:last|past) (\d+) (day|week|month)s?\b/))) { const n = +x[1] * (x[2] === 'week' ? 7 : x[2] === 'month' ? 30 : 1); return [addDays(t, 1 - n), t, `the last ${x[1]} ${x[2]}${+x[1] > 1 ? 's' : ''}`]; }
  if (/\bthis week\b/.test(q)) return [addDays(t, -6), t, 'the last 7 days'];
  if (/\blast week\b/.test(q)) return [addDays(t, -13), addDays(t, -7), 'the 7 days before that'];
  if (/\bthis month\b/.test(q)) return [iso(new Date(y, m, 1)), t, 'this month'];
  if (/\blast month\b/.test(q)) return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0)), 'last month'];
  if (/\bthis year\b/.test(q)) return [iso(new Date(y, 0, 1)), t, 'this year'];
  if (/\blast year\b/.test(q)) return [`${y - 1}-01-01`, `${y - 1}-12-31`, 'last year'];
  return null;
}
function localAnswer(raw, selBlock) {
  const q = qnorm(raw); if (q.length < 6) return null;
  const has = re => re.test(q), qt = q.split(' ').map(qstem);
  const fb = findBlocks(q); let blocks = fb.list;
  if (!blocks.length && selBlock && blockById(selBlock)) blocks = [blockById(selBlock)];
  const period = qPeriod(q), bIds = new Set(blocks.map(b => b.id));
  const inB = r => !blocks.length || bIds.has(r.blockId);
  const scope = blocks.length ? blocks.map(b => b.name).join(', ') : 'all blocks';
  const P = s => `<p style="margin:6px 0">${s}</p>`;
  const recP = r => P(`<strong>${fdy(r.date)}</strong> · ${esc((blockById(r.blockId) || {}).name || 'Whole farm')}<br>${recDetail(r) || esc(recTitle(r))}`);
  const SRC = 'From the records saved on this phone. No AI was used.';
  const out = (title, body, src) => ({ title, html: body + `<p class="hint" style="margin:10px 0 0">${src || SRC}</p>` });
  const days = n => n + ' day' + (n === 1 ? '' : 's');

  if (has(/\b(phi|pre harvest|preharvest|safe to harvest|can i harvest|can i pick|when can i (harvest|pick))\b/)) {
    const bs = blocks.length ? blocks : db.blocks.filter(isActive);
    if (!bs.length) return null;
    return out('Harvest waiting period (PHI)', bs.map(b => { const e = phiEnd(b); return P(`<strong>${esc(blockLabel(b))}</strong>: ${e ? `no harvest before <strong>${fdl(e)}</strong> (${days(diff(today(), e))} to go)` : 'no PHI is running from the recorded sprays'}`); }).join(''), 'Calculated from the PHI days entered on your spray records. A spray saved without PHI days is not counted, so check the label.');
  }
  if (has(/\b(what should|should i|recommend\w*|advi[cs]e|why|how do i|how to|what is causing|causing|best|which product|identify|diagnos\w*|treat\w*|control|mix|compatible|what is this|what s wrong|plan)\b/)) return null;

  const mm = q.match(/\b(\d+(?:\.\d+)?) ?mm\b/);
  if (mm && blocks.length) return out('Irrigation volume', blocks.map(b => P(`<strong>${esc(b.name)}</strong> (${fmt(num(b.areaHa))} ha): ${mm[1]} mm = <strong>${fmt(num(mm[1]) * num(b.areaHa) * 10)} m³</strong> (${Math.round(num(mm[1]) * num(b.areaHa) * 10000).toLocaleString('en-US')} L)`)).join(''), 'Calculated on this phone: 1 mm over 1 ha = 10 m³. This is the depth over the whole block area; with drip, the wetted strip and system efficiency change what you need to pump.');

  if (has(/\b(spend|spent|expenses?|costs?|sales?|sold|revenue|income|earn(ed)?|profit|margin|owe[sd]?|debts?)\b/)) {
    if (has(/\b(owe[sd]?|debts?)\b/)) {
      const tot = l => { const m = {}; l.forEach(t => { const c = t.currency || 'USD'; m[c] = (m[c] || 0) + balanceOf(t); }); return Object.entries(m).map(([c, v]) => money(v, c)).join(' + ') || money(0, 'USD'); };
      const rc = openDebts('income'), py = openDebts('expense');
      return out('Money owed', P(`Customers owe you: <strong>${tot(rc)}</strong> (${rc.length} open${rc.filter(isOverdue).length ? ', ' + rc.filter(isOverdue).length + ' overdue' : ''})`) + P(`You owe suppliers: <strong>${tot(py)}</strong> (${py.length} open${py.filter(isOverdue).length ? ', ' + py.filter(isOverdue).length + ' overdue' : ''})`), 'Added up from the credit sales and purchases in Money. No AI was used.');
    }
    const [a, z, lab] = period || [...periodRange('month'), 'this month'];
    let list = db.txns.filter(t => t.date >= a && t.date <= z && (!fb.list.length || bIds.has(t.blockId)));
    const CG = new Set(['other', 'expense', 'income', 'sale', 'crop', 'cost']);
    const cats = [...L('expenseCats'), ...L('incomeCats')].filter(c => qnorm(c).split(' ').map(qstem).some(t => t.length >= 4 && !CG.has(t) && qt.some(k => tokEq(k, t))));
    if (cats.length) list = list.filter(t => cats.includes(t.category));
    const tt = totals(list), sold = {};
    list.filter(t => t.kind === 'income' && num(t.qty)).forEach(t => { sold[t.unit] = (sold[t.unit] || 0) + num(t.qty); });
    return out(`Money: ${lab}`, P(esc((fb.list.length ? scope : 'Whole farm') + (cats.length ? ' · ' + cats.join(', ') : ''))) + P(`Income <strong>${money(tt.inc)}</strong> · Costs <strong>${money(tt.exp)}</strong> · Net <strong>${money(tt.net)}</strong>`) + (Object.keys(sold).length ? P('Sold: ' + Object.entries(sold).map(([u, v]) => `${fmt(v)} ${esc(u)}`).join(', ')) : '') + P(`${list.length} transaction${list.length === 1 ? '' : 's'}, ${fdy(a)} to ${fdy(z)}`), `Added up from Money, each transaction at the exchange rate stored on it${tt.skipped ? ` (${tt.skipped} skipped: no rate)` : ''}. Stock used is not included. No AI was used.`);
  }

  const ACTK = [['spray', /\b(spray(ed|ing|s)?|pesticides?|fungicides?|insecticides?|herbicides?)\b/, 'spray'], ['fertigation', /\b(fertigat\w*|fertilis\w*|fed|feed(ing)?)\b/, 'fertigation'], ['irrigation', /\b(irrigat\w*|water(ed|ing)?)\b/, 'irrigation'], ['scouting', /\bscout\w*\b/, 'scouting'], ['harvest', /\b(harvest\w*|pick(ed|ing)?)\b/, 'harvest']];
  const act = ACTK.find(x => x[1].test(q));
  const wantLast = has(/\b(last|latest|most recent|previous|when did|when was)\b/), wantList = has(/\b(history|list|show|what have i|what did i|how many|which|all)\b/) || !!period;
  if (act && (wantLast || wantList)) {
    const k = act[0];
    let recs = db.records.filter(r => r.status === 'done' && inB(r) && (k === 'harvest' ? r.type === 'activity' && /harvest|pick/i.test(r.activity || '') : r.type === k));
    const none = P(`No ${k} is recorded as done on ${esc(scope)}${period ? ' in ' + period[2] : ''}.`);
    if (k === 'spray' || k === 'fertigation') {
      const st = findStock(q), ex = new Set(db.blocks.flatMap(b => qnorm(b.name + ' ' + (b.crop || '') + ' ' + (b.variety || '')).split(' ').map(qstem)));
      const mv = q.match(/\b(?:spray(?:ed|ing)?|appl(?:y|ied)|used?|fertigat\w*|fed)\b(.*)/);
      const term = mv ? mv[1].split(/\b(?:on|in|at|to|for|since|during|this|last|today|yesterday)\b/)[0].split(' ').filter(w => w.length >= 3 && !QSTOP.has(w) && !ex.has(qstem(w))).join(' ') : '';
      if (st.length || term) {
        const ids = new Set(st.map(s => s.id));
        const textOf = r => qnorm([(r.lines || []).map(l => { const s = stockById(l.stockId); return s ? s.name + ' ' + (s.ai || '') : ''; }).join(' '), r.target, r.notes, r.title].join(' '));
        const what = st.length ? st.map(s => s.name).join(' / ') : term.toUpperCase();
        const f = recs.filter(r => (r.lines || []).some(l => ids.has(l.stockId)) || (term && textOf(r).includes(term)));
        if (!f.length) return out(`No ${k} record found for ${what}`, P(`Nothing recorded as done on ${esc(scope)} mentions <strong>${esc(what)}</strong>.`) + (recs.length ? P(`Most recent ${k} records there:`) + [...recs].sort(byDateDesc).slice(0, 3).map(recP).join('') : none), SRC + ' Check the spelling against the product name in Stock.');
        recs = f;
      }
    }
    if (period) recs = recs.filter(r => r.date >= period[0] && r.date <= period[1]);
    recs.sort(byDateDesc);
    if (!recs.length) return out(`No ${k} records`, none);
    if (wantLast && !period && !has(/\b(history|list|all|how many)\b/)) {
      const per = blocks.length > 1 ? blocks.map(b => recs.find(r => r.blockId === b.id)).filter(Boolean) : [recs[0]];
      const ago = diff(recEnd(per[0]), today());
      return out(`Last ${k}: ${fdy(per[0].date)} (${ago === 0 ? 'today' : days(ago) + ' ago'})`, per.map(recP).join(''));
    }
    const extra = k === 'irrigation' ? P(`Total: <strong>${fmt(recs.reduce((t, r) => t + num(r.minutes), 0))} min</strong>, <strong>${fmt(recs.reduce((t, r) => t + num(r.m3), 0))} m³</strong> logged`) : '';
    return out(`${recs.length} ${k} record${recs.length === 1 ? '' : 's'}: ${scope}${period ? ', ' + period[2] : ''}`, extra + recs.slice(0, 12).map(recP).join('') + (recs.length > 12 ? P(`…and ${recs.length - 12} older ones. See Records.`) : ''));
  }

  if (has(/\b(how old|age|days after|dat|das|crop day|growth stage|what stage|when (did i|was|were) .*(plant|transplant|sow))/)) {
    const bs = (blocks.length ? blocks : db.blocks).filter(b => b.planted);
    if (!bs.length) return out('No planting date found', P(`${esc(scope)}: no planting date is saved. Add it in Fields → Edit block.`));
    return out('Crop age', bs.map(b => { const d = cropDay(b), st = currentStage(b), end = planEnd(b); return P(`<strong>${esc(blockLabel(b))}</strong>${b.variety ? ' (' + esc(b.variety) + ')' : ''}: planted ${fdy(b.planted)} → <strong>day ${d}</strong> (${Math.floor(d / 7)} weeks ${d % 7} days)${st ? ' · stage: ' + esc(st.name) : ''}${end ? ' · plan ends day ' + end : ''}`); }).join(''), 'Calculated from each block\'s planting date and today\'s date. A block holds one planting date: if one field has batches transplanted on different days, keep each batch as its own block so every age is exact. No AI was used.');
  }

  if (has(/\b(stock|inventory|how much|do i have|have i got|left|remaining|low|expir\w*|reorder)\b/)) {
    const st = findStock(q);
    const line = s => { const f = stockFlags(s); return P(`<strong>${esc(s.name)}</strong>: <strong>${esc(qtyStr(s))}</strong>${s.ai ? ' · ' + esc(s.ai) : ''}${s.group ? ' · ' + esc(s.group) : ''}${s.expiry ? ' · expires ' + fdy(s.expiry) : ''}${f.length ? ` · <span class="neg">${f.map(x => x === 'soon' ? 'expires soon' : x === 'low' ? 'low stock' : x).join(', ')}</span>` : ''}`); };
    const SS = 'From your Stock list, which changes when you receive stock or save a record as done. No AI was used.';
    if (st.length) return out('Stock on hand', st.map(line).join(''), SS);
    if (has(/\b(low|reorder|expir\w*)\b/)) { const fl = db.stock.filter(s => stockFlags(s).length); return out('Stock needing attention', fl.length ? fl.map(line).join('') : P('Nothing is low, expired or expiring within 60 days.'), SS); }
    if (has(/\b(stock|inventory)\b/)) return out(`Stock: ${db.stock.length} items`, db.stock.slice(0, 40).map(line).join('') || P('No stock items yet.'), SS);
  }

  if (has(/\b(due|to do|todo|tasks?|planned|scheduled?|reminders?|upcoming)\b/) && has(/\b(what|show|list|any|which|is|are)\b/)) {
    const z = period ? period[1] : addDays(today(), 7);
    const pl = db.records.filter(r => r.status === 'planned' && inB(r) && r.date <= z).sort(byDate);
    return out(`Planned work up to ${fdy(z)}`, pl.length ? pl.map(r => P(`<strong>${fdy(r.date)}</strong>${recEnd(r) < today() ? ' <span class="neg">overdue</span>' : ''} · ${esc(recTitle(r))}${r.blockId ? ' · ' + esc((blockById(r.blockId) || {}).name || '') : ''}`)).join('') : P('Nothing is planned.'));
  }
  if (has(/\b(problems?|diseases?|pests?|infections?)\b/) && has(/\b(recorded|logged|open|history|list|show)\b/)) {
    const is = (db.issues || []).filter(i => inB(i) && (!has(/\bopen\b/) || isOpenIssue(i))).sort(byDateDesc);
    return out(`${is.length} plant-health problem${is.length === 1 ? '' : 's'}: ${scope}`, is.slice(0, 15).map(i => { const cs = curState(i); return P(`<strong>${fdy(i.date)}</strong> · ${esc(issueName(i))} · ${esc((blockById(i.blockId) || {}).name || '')} · ${ISTAT[i.status] || 'Active'}${cs.severity ? ' · ' + cs.severity : ''}`); }).join('') || P('None recorded.'));
  }
  return null;
}

/* ===== context builder: only the records that bear on the question ===== */
function qTopics(text, kind, nPhotos) {
  const q = qnorm(text), T = new Set();
  if (kind === 'diagnose' || nPhotos) T.add('pest');
  if (kind === 'nutrition') T.add('nutri');
  if (/\b(spray|pest|disease|insect|mite|fung|blight|mildew|virus|worm|tuta|whitefl|aphid|thrip|rot|spot|wilt|resist|irac|frac|phi|rei|weed|herbicid)/.test(q)) T.add('pest');
  if (/\b(fertil|fertig|nutri|feed|deficien|nitrogen|potassium|calcium|phosph|yellow|pale)|\b(ec|ph)\b/.test(q)) T.add('nutri');
  if (/\b(irrigat|water|drip|moisture|salin|salt|pump)/.test(q)) T.add('water');
  if (/\b(harvest|yield|pick|sell|market|price)/.test(q)) T.add('harvest');
  return T;
}
function buildContext(a) {
  const t = today(), L1 = [], T = qTopics(a.symptoms, a.kind, a.photos.length);
  let b = blockById(a.blockId), found = '';
  if (!b) { const fb = findBlocks(qnorm(a.symptoms)); if (fb.list.length === 1) { b = fb.list[0]; found = ' (block picked from the wording of the question)'; } }
  const prodOf = r => (r.lines || []).map(l => { const s = stockById(l.stockId); return s ? `${s.name}${s.ai ? ' [' + s.ai + ']' : ''}${s.group ? ' ' + s.group : ''}${num(l.amount) ? ` ${fmt(num(l.amount))} ${s.unit}${l.basis === 'ha' ? '/ha' : ''}` : ''}` : ''; }).filter(Boolean).join(' + ');
  const short = s => String(s || '').replace(/\s+/g, ' ').slice(0, 140);
  L1.push(`Date: ${fdy(t)}. Farm: ${db.settings.farmName || 'farm'}${db.settings.location ? ', ' + db.settings.location : ''}.`);
  L1.push('== FARM RECORDS (entered by the farmer as work was done) ==');
  if (b) {
    const day = cropDay(b), st = currentStage(b), from = curFrom(b);
    const done = db.records.filter(r => r.blockId === b.id && r.status === 'done');
    L1.push(`Block: ${b.name}, ${fmt(num(b.areaHa))} ha${b.irrigation ? ', ' + b.irrigation + ' irrigation' : ''}${found}.`);
    L1.push(b.crop ? `Crop: ${b.crop}${b.variety ? ' (' + b.variety + ')' : ''}, planted ${fdy(b.planted)}${day != null ? `, crop day ${day}` : ''}${st ? `, stage: ${st.name}` : ''}.` : 'No crop recorded on this block.');
    if (T.has('pest')) {
      const sp = done.filter(r => r.type === 'spray' && r.date >= from).sort(byDateDesc);
      if (sp.length) {
        L1.push(`Sprays on this crop (${sp.length} in total, newest first):`);
        sp.slice(0, 15).forEach(r => L1.push(`- ${r.date} ${prodOf(r) || 'product not recorded'}${r.target ? ' | target: ' + r.target : ''}${num(r.phiDays) ? ' | PHI ' + r.phiDays + ' d' : ''}`));
        const g = {}; sp.forEach(r => recGroups(r).forEach(x => { (g[x] = g[x] || { n: 0, last: '' }).n++; if (r.date > g[x].last) g[x].last = r.date; }));
        if (Object.keys(g).length) L1.push('Mode-of-action groups used on this crop (all sprays, whatever their age): ' + Object.entries(g).map(([k, v]) => `${k} ×${v.n} (last ${v.last})`).join('; ') + '.');
      } else L1.push('No sprays recorded on this crop.');
      const prev = done.filter(r => r.type === 'spray' && r.date < from).sort(byDateDesc).slice(0, 2);
      if (prev.length) L1.push('Last sprays on this block before this crop: ' + prev.map(r => `${r.date} ${recGroups(r).join(', ') || 'no group recorded'}`).join('; ') + '.');
      const pe = phiEnd(b); L1.push(pe ? `Pre-harvest interval active until ${fdy(pe)}.` : 'No pre-harvest interval is running from the recorded sprays.');
      const sc = done.filter(r => r.type === 'scouting' && r.date >= from).sort(byDateDesc).slice(0, 4);
      if (sc.length) { L1.push('Recent scouting:'); sc.forEach(r => L1.push(`- ${r.date}${r.target ? ' ' + r.target : ''}${r.severity ? ', pressure ' + r.severity : ''}${r.notes ? ' — ' + short(r.notes) : ''}`)); }
      const bi = (db.issues || []).filter(i => i.blockId === b.id).sort(byDateDesc).slice(0, 5);
      if (bi.length) {
        L1.push('Plant-health problems logged on this block (newest first):');
        bi.forEach(i => { const cs = curState(i); L1.push(`- ${i.date} ${issueName(i)}${i.kind ? ' (' + i.kind + ')' : ''}, ${(ISTAT[i.status] || 'Active').toLowerCase()}${cs.severity ? ', severity ' + cs.severity : ''}${cs.spread !== '' && cs.spread != null ? ', about ' + cs.spread + '% of plants' : ''}${i.symptoms ? ' — ' + short(i.symptoms) : ''}`); });
      }
    }
    if (T.has('nutri')) {
      if (st && st.nutrition) L1.push(`Farmer's stage plan note: ${st.nutrition}.`);
      const fg = done.filter(r => r.type === 'fertigation' && r.date >= from).sort(byDateDesc).slice(0, 6);
      if (fg.length) { L1.push('Recent fertigation (newest first):'); fg.forEach(r => L1.push(`- ${r.date} ${prodOf(r) || 'products not recorded'}${r.ec ? ' | EC ' + r.ec : ''}${r.ph ? ' | pH ' + r.ph : ''}`)); } else L1.push('No fertigation recorded on this crop.');
    }
    if (T.has('water') || T.has('nutri')) {
      const ir = done.filter(r => r.type === 'irrigation' && r.date >= from).sort(byDateDesc).slice(0, 5);
      if (ir.length) L1.push('Recent irrigation: ' + ir.map(r => `${r.date}${num(r.minutes) ? ' ' + fmt(num(r.minutes)) + ' min' : ''}${num(r.m3) ? ' ' + fmt(num(r.m3)) + ' m³' : ''}`).join('; ') + '.');
      else if (T.has('water')) L1.push('No irrigation recorded on this crop.');
    }
    if (T.has('harvest')) {
      const y = {}; db.txns.filter(x => x.blockId === b.id && x.kind === 'income' && num(x.qty) && x.date >= from).forEach(x => { y[x.unit] = (y[x.unit] || 0) + num(x.qty); });
      if (Object.keys(y).length) L1.push('Sold from this crop so far: ' + Object.entries(y).map(([u, v]) => `${fmt(v)} ${u}`).join(', ') + '.');
    }
  } else if (db.blocks.length) {
    L1.push('No single block applies. Blocks: ' + db.blocks.map(x => `${x.name}${x.crop ? ' ' + x.crop + (cropDay(x) != null ? ' day ' + cropDay(x) : '') : ' fallow'}`).join('; ') + '.');
  }
  if (T.has('pest') || T.has('nutri')) {
    const on = db.stock.filter(s => num(s.qty) > 0), okS = on.filter(s => !stockFlags(s).includes('expired'));
    L1.push('== PRODUCT LABEL DATA (as the farmer copied it from the labels; a missing item is unknown, not zero) ==');
    if (T.has('pest')) {
      const prot = okS.filter(s => (stockCat(s.category) || {}).use !== 'fertigation');
      L1.push(prot.length ? 'Crop-protection stock on hand:\n' + prot.map(s => `- ${s.name}${s.ai ? ' [' + s.ai + ']' : ''}${s.group ? ' ' + s.group : ''}: ${qtyStr(s)}${s.phiDays ? ', label PHI ' + s.phiDays + ' d' : ''}${s.reiHours ? ', REI ' + s.reiHours + ' h' : ''}${s.label ? ', label notes: ' + String(s.label).replace(/\s+/g, ' ').slice(0, 600) : ''}${(s.labelPhotos || []).length ? ' (label photo on file)' : ''}`).join('\n') : 'No crop-protection products in stock.');
      const exp = on.filter(s => stockFlags(s).includes('expired') && (stockCat(s.category) || {}).use !== 'fertigation');
      if (exp.length) L1.push('Expired, do not recommend: ' + exp.map(s => s.name).join(', ') + '.');
    }
    if (T.has('nutri')) {
      const fert = okS.filter(s => ['fertigation', 'both'].includes((stockCat(s.category) || {}).use));
      L1.push(fert.length ? 'Fertilisers on hand:\n' + fert.map(s => `- ${s.name}${s.ai ? ' [' + s.ai + ']' : ''}: ${qtyStr(s)}`).join('\n') : 'No fertilisers in stock.');
    }
  }
  return L1.join('\n');
}
const farmContext = b => buildContext({ blockId: b ? b.id : '', symptoms: '', kind: 'diagnose', photos: [] });

const AI_SYSTEM = `You are an experienced field agronomist advising a commercial vegetable farm in a semi-arid, water-scarce area (the farm's location is in the records): tomato, sweet and hot pepper, muskmelon, other vegetables and fodder, mostly under drip irrigation and fertigation. Be technically rigorous and practical.
Rules:
- Say what each statement rests on, using these labels where it matters: "From your records", "From your label data", "From what you describe", "Assumption", "Recommendation". Use only the records supplied. If something you need is missing, say what is missing; do not guess it.
- Rank likely causes with a confidence (high / medium / low) and the signs that support each. Say plainly when a photo cannot settle the question and what to check or photograph next. Consider look-alikes: nutrient deficiency or toxicity, water stress, salinity, heat or sun scald, herbicide or spray injury, mechanical damage.
- Put prevention and cultural, non-chemical actions first.
- For chemical options, prefer products in the farmer's stock and name the active ingredient and IRAC/FRAC group. Do not repeat the mode-of-action group of the last spray on the block, and take the season's group counts into account. Say "use the label rate". Never invent rates, pre-harvest intervals, re-entry intervals or product names, and never say a product is registered for a crop unless the label data supplied says so: tell the farmer to confirm on the label. Point out pre-harvest interval and tank-mix concerns.
- Your advice is a proposal. Nothing is recorded as done until the farmer records it.`;
const sysPrompt = a => AI_SYSTEM + (a.len === 'long' ? '\nGive a complete, well-organised answer.' : '\nKeep the answer short: at most about 180 words, the conclusion first, no preamble.') + '\nEnd with one final line that starts with "MEMO:" (at most 40 words) stating your conclusion and any products you named. It is used as the memory of this conversation.';
function taskText(a) {
  const n = a.photos.length;
  const head = a.kind === 'diagnose'
    ? `Please identify the problem${n ? ` in the ${n} photo${n > 1 ? 's' : ''}` : ''} and advise. Cover: 1) likely causes ranked with confidence; 2) what to check in the field to confirm; 3) immediate cultural / non-chemical actions; 4) treatment options from my stock if justified (active ingredient, group, label rate, PHI); 5) when to re-check.`
    : a.kind === 'nutrition'
      ? `Please advise on nutrition / fertigation for this crop and stage using the fertilisers I have${n ? ', and assess the photo(s) for deficiency symptoms versus other causes' : ''}. If you give amounts, show your assumptions so I can check them against my soil and water tests.`
      : 'Question:';
  return `${head}\n\n== WHAT THE FARMER SEES / ASKS TODAY ==\n${a.symptoms.trim() || '(no description given)'}`;
}
const firstPrompt = a => `${taskText(a)}\n\n${buildContext(a)}`;
const sharePrompt = a => `${AI_SYSTEM}\n\n${firstPrompt(a)}`;
function splitMemo(t) {
  const i = t.search(/(^|\n)[\s*_]*MEMO[\s*_]*:/i);
  if (i < 0) return { text: t.trim(), memo: '' };
  return { text: t.slice(0, i).trim() || t.trim(), memo: t.slice(i).replace(/^[\s*_]*MEMO[\s*_]*:\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 400) };
}
/* what is actually sent: the first message stays byte-identical (so provider caches can hit); older turns are replaced by their memos */
function buildMsgs(a, useCache) {
  const first = a.msgs[0], ans = a.msgs.filter(m => m.role === 'assistant');
  if (!ans.length) return [{ role: 'user', text: first.text, images: a.photos, cache: useCache }];
  const withImg = a.photos.length && a.resend;
  const out = [{ role: 'user', text: first.text + (a.photos.length && !withImg ? `\n\n[The ${a.photos.length} photo(s) were analysed in your first answer and are not sent again.]` : ''), images: withImg ? a.photos : [], cache: useCache && withImg }];
  const rest = a.msgs.slice(1), lastA = ans[ans.length - 1], lastQ = rest[rest.length - 1];
  if (ans.length === 1) out.push({ role: 'assistant', text: lastA.text });
  else {
    const older = rest.slice(0, rest.lastIndexOf(lastA)).map(m => m.role === 'assistant' ? 'You answered: ' + (m.memo || m.text.replace(/\s+/g, ' ').slice(0, 280)) : 'Farmer asked: ' + m.text.replace(/\s+/g, ' ').slice(0, 200));
    out.push({ role: 'assistant', text: 'Summary of this conversation so far:\n' + older.join('\n') + '\n\nMy most recent answer in full:\n' + lastA.text });
  }
  if (lastQ && lastQ.role === 'user') out.push({ role: 'user', text: lastQ.text });
  return out;
}
const isComplex = a => a.kind !== 'question' || a.symptoms.length > 400 || /\b(plan|programme|program|schedule|strategy|rotation|compare|budget|season|diagnos)/i.test(a.symptoms);
function pickRoute(a) {
  const A = AIS(), ok = ref => { const r = resolveRef(ref); return r && keyOf(r.p.id) ? r : null; };
  if (a.model) { const r = ok(a.model); if (r) return Object.assign(r, { why: 'chosen for this question' }); }
  /* a conversation stays with the model that gave its first answer, so records never move to a second provider unasked */
  if (a.stick) { const r = ok(a.stick); if (r) return Object.assign(r, { why: 'same model as the first answer' }); }
  const first = !a.msgs.some(m => m.role === 'assistant');
  const tier = a.photos.length && (first || a.resend) ? 'vision' : isComplex(a) ? 'complex' : 'routine';
  let r = null, why = '';
  if (A.routing === 'auto') { r = ok(A.routes[tier]) || (tier === 'vision' ? usableModels().find(x => x.m.vision) : null); if (r) why = 'automatic: ' + TIERS[tier].toLowerCase(); }
  if (!r) { r = ok(A.routes.routine) || usableModels()[0] || null; why = 'your default model'; }
  return r ? Object.assign({}, r, { why, tier }) : null;
}
const cacheFor = (a, p) => !!(AIS().cache && p.proto === 'anthropic' && a.photos.length);
function estimate(a, rt) {
  const msgs = buildMsgs(a, false);
  let tin = estTok(sysPrompt(a));
  msgs.forEach(x => { tin += estTok(x.text) + (x.images || []).reduce((t, i) => t + (i.w ? Math.ceil(i.w * i.h / 750) : 1600), 0); });
  const tout = Math.round((a.len === 'long' ? 2000 : 700) * 0.6), m = rt.m;
  return { tin, tout, cost: m.in !== '' && m.in != null && m.out !== '' && m.out != null ? (tin * num(m.in) + tout * num(m.out)) / 1e6 : null };
}
function freshAI(q) {
  return { issueId: '', blockId: (q && q.get('block')) || '', kind: (q && q.get('kind')) || 'diagnose', symptoms: (q && q.get('note')) ? 'Scouting note: ' + q.get('note') : '', photos: [], msgs: [], answer: '', busy: false, followup: '', usage: null, error: '', model: '', len: AIS().concise === false ? 'long' : 'short', resend: false, local: null, skipLocal: false, cost: 0, unpriced: false, lastSig: '', lastAt: 0, photoOK: false, via: '' };
}
let ai = null, aiKey = null;
function tryLocal(a) {
  if (a.photos.length || a.skipLocal || !a.symptoms.trim()) return false;
  /* on the diagnosis and nutrition tabs, only clear record questions are answered locally, so a symptom description is never mistaken for one */
  if (a.kind !== 'question' && !/^(when|how (much|many|old)|do i have|have i|show|list|what (have|did) i|what is (due|in stock|planned)|which|is there|are there|can i (harvest|pick))\b/.test(qnorm(a.symptoms))) return false;
  const r = localAnswer(a.symptoms, a.blockId); if (!r) return false;
  a.local = r; AIS().localCount = (AIS().localCount || 0) + 1; save(); render(true); return true;
}
async function preflight(a) {
  const rt = pickRoute(a);
  if (!rt) { toast('Add an AI provider, its key and a model in Settings first.'); return false; }
  const { p, m } = rt, first = a.msgs.length === 1, sending = a.photos.length && (first || a.resend);
  if (sending && !m.vision && !await ask(`${m.id} is not marked as able to read photos. Send anyway?`, 'Send anyway')) return false;
  if (sending && AIS().askPhotos !== false && !a.photoOK) {
    if (!await ask(`Send ${a.photos.length} photo${a.photos.length > 1 ? 's' : ''} and the farm records listed under "See what will be sent" to ${p.name} (${hostOf(p.base)})?`, 'Send')) return false;
    a.photoOK = true;
  }
  const g = budgetGate(estimate(a, rt));
  if (g.block) { toast(g.block); return false; }
  if (g.warn && !await ask(g.warn, 'Send anyway')) return false;
  const sig = rt.ref + '|' + a.msgs[a.msgs.length - 1].text;
  if (sig === a.lastSig && Date.now() - a.lastAt < 60000 && !await ask('You sent this same question a moment ago. Send it again? It will be charged again.', 'Send again')) return false;
  a.sig = sig; return true;
}
async function runAI() {
  const a = ai; if (!a || a.busy) return;
  const rt = pickRoute(a);
  const undo = () => { if (a.msgs.length && a.msgs[a.msgs.length - 1].role === 'user') { const u = a.msgs.pop(); if (a.msgs.length) a.followup = u.text; } };
  if (!rt) { undo(); a.error = 'No AI model is ready. Add a provider, key and model in Settings.'; return render(); }
  a.busy = true; a.error = ''; render();
  const { p, m } = rt;
  try {
    const r = await callAI(p, m, sysPrompt(a), buildMsgs(a, cacheFor(a, p)), a.len === 'long' ? 2000 : 700);
    const sp = splitMemo(r.text);
    a.msgs.push({ role: 'assistant', text: sp.text, memo: sp.memo });
    const c = logUsage(p, m, r.usage, a.kind);
    a.usage = { in: (a.usage ? a.usage.in : 0) + r.usage.in, out: (a.usage ? a.usage.out : 0) + r.usage.out, cached: (a.usage ? a.usage.cached : 0) + (r.usage.cached || 0) };
    if (c == null) a.unpriced = true; else a.cost += c;
    a.stick = rt.ref; a.via = `${p.name} · ${m.id}`; a.lastSig = a.sig || ''; a.lastAt = Date.now();
    budgetNotice();
  } catch (e) {
    undo();
    a.error = e.message + (usableModels().length > 1 ? ' Nothing was sent to any other provider. To retry with a different model, pick it under "Model" and send again.' : '');
  }
  a.busy = false; if (route().parts[0] === 'ai') render();
}

/* ----- Ask AI screen ----- */
function modelPicker(a) {
  const rt = pickRoute(Object.assign({}, a, { model: '' }));
  const list = usableModels();
  return `<div class="f"><label for="ai_model">Model</label><select id="ai_model" data-af="model"><option value="">${AIS().routing === 'auto' ? 'Automatic' : 'Default'}${rt ? ` — ${esc(rt.m.id)} (${esc(rt.p.name)})` : ''}</option>${list.map(x => `<option value="${esc(x.ref)}" ${a.model === x.ref ? 'selected' : ''}>${esc(x.m.id)} — ${esc(x.p.name)}${x.m.vision ? ' · photos' : ''}${x.m.in !== '' && x.m.in != null ? ` · $${x.m.in}/$${x.m.out}` : ''}</option>`).join('')}</select></div>`;
}
const lenSeg = a => `<div class="seg" role="group" aria-label="Answer length"><button type="button" class="${a.len !== 'long' ? 'on' : ''}" data-act="ailen" data-v="short" aria-pressed="${a.len !== 'long'}">Short answer</button><button type="button" class="${a.len === 'long' ? 'on' : ''}" data-act="ailen" data-v="long" aria-pressed="${a.len === 'long'}">Detailed</button></div>`;
function vAI() {
  const a = ai; if (!a) return vMissing();
  const mode = aiMode();
  const blockOpts = `<option value="">No block (general)</option>` + db.blocks.map(b => `<option value="${b.id}" ${b.id === a.blockId ? 'selected' : ''}>${esc(blockLabel(b))}</option>`).join('');
  const x14 = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const photos = a.photos.map((p, i) => `<div style="position:relative;width:88px;height:88px;flex:none"><img src="${p.dataUrl}" alt="Photo ${i + 1}" style="width:88px;height:88px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"><button type="button" class="ib" data-act="aidelphoto" data-i="${i}" aria-label="Remove photo ${i + 1}" style="position:absolute;top:-8px;right:-8px;width:32px;height:32px;border-radius:50%;background:#fff">${x14}</button></div>`).join('');
  const convo = a.msgs.filter(m => m.role === 'assistant' || m.display).map(m => m.role === 'assistant'
    ? `<div class="card" style="gap:4px;font-size:14px;line-height:1.5">${mdLite(m.text)}</div>`
    : `<div style="align-self:flex-end;max-width:85%;background:var(--accbg);color:var(--acc2);border-radius:12px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(m.display)}</div>`).join('');
  const head = `${back('#today', 'Today')}<h1>Ask AI</h1>
  <p class="hint" style="margin:-8px 0 0">Questions about your own records are answered on this phone, free. ${mode === 'api' ? 'Others go to your AI provider.' : 'Others are sent to a chat app you choose.'} <a href="#settings">Change</a></p>`;
  if (a.local) return `${head}
    <div style="align-self:flex-end;max-width:85%;background:var(--accbg);color:var(--acc2);border-radius:12px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(a.symptoms.trim())}</div>
    <div class="card" style="gap:2px;font-size:14px;line-height:1.5"><span class="row" style="gap:8px"><span class="badge b-ok">From your records</span><span class="badge b-mut">No AI used · $0</span></span><span class="t" style="font-size:16px;margin-top:6px">${esc(a.local.title)}</span>${a.local.html}</div>
    <div class="g2"><button class="btn pri" data-act="ainew">New question</button><button class="btn" data-act="aiforce">Ask AI anyway</button></div>`;
  return `${head}
  ${a.msgs.length ? '' : `<div class="form">
    <div class="chips" role="group" aria-label="Type of question">${Object.entries(AI_KINDS).map(([k, l]) => `<button type="button" class="chip ${a.kind === k ? 'on' : ''}" data-act="aikind" data-v="${k}" aria-pressed="${a.kind === k}">${l}</button>`).join('')}</div>
    <div class="f"><label for="ai_block">Block</label><select id="ai_block" data-af="blockId">${blockOpts}</select><span class="hint">Only the records that bear on your question are attached.</span></div>
    <div class="f"><span class="lbl">Photos (up to 4)</span>
      <div class="row" style="gap:12px">${photos}${a.photos.length < 4 ? `<label for="ai_photo" class="btn" style="width:88px;height:88px;flex-direction:column;gap:4px;font-size:12px;padding:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Add photo</label>` : ''}</div>
      <input id="ai_photo" type="file" accept="image/*" multiple class="sr">
      <span class="hint">Take a close-up of the affected leaf (top and underside), plus one of the whole plant.</span></div>
    <div class="f"><label for="ai_sym">${a.kind === 'question' ? 'Your question' : 'What do you see?'}</label><textarea id="ai_sym" data-af="symptoms" placeholder="${a.kind === 'diagnose' ? 'e.g. Yellow patches on older leaves, brown spots with rings, spreading over 5 days, about 20% of plants' : a.kind === 'nutrition' ? 'e.g. Plan fertigation for the next 2 weeks; leaves look pale' : 'e.g. When did I last spray abamectin on the tomatoes?'}">${esc(a.symptoms)}</textarea></div>
    ${mode === 'api'
      ? `${modelPicker(a)}${lenSeg(a)}<button class="btn pri block" data-act="aisend" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Asking…' : 'Ask'}</button>`
      : `<button class="btn pri block" data-act="aishare">Send to a chat app</button>
         <div class="g2"><button class="btn" data-act="aicopy">Copy question</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a></div>
         <span class="hint">Works with Claude, ChatGPT, Gemini and other chat apps on this phone. If the photos arrive without the text, paste: the question is copied for you.</span>`}
    <details><summary class="s" style="cursor:pointer;min-height:44px;display:flex;align-items:center">See what will be sent (about ${estTok(firstPrompt(a)).toLocaleString('en-US')} tokens of text)</summary><pre style="white-space:pre-wrap;font-size:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;max-height:320px;overflow:auto">${esc(firstPrompt(a))}</pre></details>
  </div>`}
  ${convo ? `<div class="col" style="gap:10px">${a.photos.length ? `<div class="row" style="gap:8px">${a.photos.map((p, i) => `<img src="${p.dataUrl}" alt="Photo ${i + 1}" style="width:56px;height:56px;object-fit:cover;border-radius:8px">`).join('')}</div>` : ''}${convo}</div>` : ''}
  ${a.error ? alertH('bad', 'warn', a.error, '') : ''}
  ${a.busy && a.msgs.length ? `<div class="empty">Waiting for the answer…</div>` : ''}
  ${a.msgs.length && !a.busy ? `<div class="form">
    ${a.usage ? `<span class="hint">${esc(a.via)} · Tokens used: ${a.usage.in.toLocaleString('en-US')} in${a.usage.cached ? ` (${a.usage.cached.toLocaleString('en-US')} cached)` : ''} · ${a.usage.out.toLocaleString('en-US')} out · ${a.unpriced ? 'cost unknown (set the model\'s prices)' : 'about ' + usd(a.cost)}</span>` : ''}
    <div class="f"><label for="ai_follow">Follow-up question</label><textarea id="ai_follow" data-af="followup" placeholder="e.g. Which of my products is safest 3 days before harvest?">${esc(a.followup)}</textarea></div>
    ${mode === 'api' ? modelPicker(a) + lenSeg(a) : ''}
    ${a.photos.length ? `<label class="row" style="gap:10px;min-height:44px;font-size:14px"><input type="checkbox" class="check" data-ac="resend" ${a.resend ? 'checked' : ''}>Send the photos again with the follow-up</label>` : ''}
    <button class="btn pri" data-act="aifollow">Send follow-up</button>
    <div class="g2"><button class="btn" data-act="aisave">Save to scouting record</button><button class="btn" data-act="ainew">New question</button></div>
    <button class="btn block" data-act="${a.issueId ? 'aiissue' : 'ailog'}">${a.issueId ? 'Add this advice to the problem log' : 'Log as plant-health problem (with photos)'}</button>
    <p class="hint" style="margin:0">AI advice can be wrong, and nothing here is recorded as done. Confirm in the field, and always follow the product label for rates, PHI and safety.</p></div>` : ''}`;
}

/* ----- settings: card, providers, models, usage ----- */
function aiSettingsCard() {
  const api = db.settings.aiMode === 'api', A = AIS(), n = A.providers.length, ready = usableModels().length, rt = api ? pickRoute(freshAI(null)) : null, sp = monthSpend();
  return `<div class="card"><span class="t">AI assistant (photos &amp; advice)</span>
    <div class="seg" role="group" aria-label="How to reach the AI"><button class="${!api ? 'on' : ''}" data-act="aimode" data-v="share" aria-pressed="${!api}">Chat app</button><button class="${api ? 'on' : ''}" data-act="aimode" data-v="api" aria-pressed="${api}">Built-in (API keys)</button></div>
    ${!api ? `<span class="s">Your photos and question, with the relevant farm records, are handed to a chat app on this phone (Claude, ChatGPT, Gemini…). It uses that app's own plan, with no extra charge. The answer stays in that app.</span>` : `
    <span class="s">Answers appear inside Farm Manager. This uses provider APIs, which are <strong>paid per use and billed separately from any chat subscription</strong>.</span>
    <span class="s">${n ? `${n} provider${n > 1 ? 's' : ''} set up · ${ready ? 'default model: ' + esc(rt ? rt.m.id : '—') : '<span class="neg">no API key saved yet</span>'} · this month about ${usd(sp.cost)}` : '<span class="neg">No provider set up yet.</span>'}</span>
    <a class="btn pri" href="#aiset">Providers, models &amp; routing</a><a class="btn" href="#aiusage">Usage &amp; budget</a>`}
    <span class="hint">Questions about your own records (last spray, crop age, stock, money) are always answered on the phone with no AI: ${A.localCount || 0} so far.</span></div>`;
}
const refSelect = (tier, cur) => `<div class="f"><label for="rt_${tier}">${TIERS[tier]}</label><select id="rt_${tier}" data-ar="${tier}"><option value="">${tier === 'routine' ? 'Choose a model…' : 'Same as everyday'}</option>${allModels().map(x => `<option value="${esc(x.ref)}" ${cur === x.ref ? 'selected' : ''}>${esc(x.m.id)} — ${esc(x.p.name)}${keyOf(x.p.id) ? '' : ' (no key)'}${x.m.vision ? ' · photos' : ''}</option>`).join('')}</select></div>`;
function vAISet() {
  const A = AIS();
  const ck = (k, label, def) => `<label class="row" style="gap:10px;min-height:44px;font-size:14px"><input type="checkbox" class="check" data-as="${k}" ${(A[k] === undefined ? def : A[k]) ? 'checked' : ''}>${label}</label>`;
  return `${back('#settings', 'Settings')}<h1>AI providers</h1>
  <div class="list">${A.providers.map(p => `<a class="item" href="#aiprov/${p.id}"><span class="main"><span class="t">${esc(p.name)}</span><span class="s">${esc(hostOf(p.base))} · ${p.models.length} model${p.models.length === 1 ? '' : 's'}</span></span><span class="badge ${keyOf(p.id) ? 'b-ok' : 'b-warn'}">${keyOf(p.id) ? 'Key saved' : 'No key'}</span>${ic('chev', 18, 2)}</a>`).join('') || '<div class="item"><span class="s">No providers yet. Add one below.</span></div>'}</div>
  <div class="card"><div class="f"><label for="ai_newprov">Add a provider</label><select id="ai_newprov">${Object.entries(PRESETS).map(([k, P]) => `<option value="${k}">${esc(P.name)}</option>`).join('')}</select></div><button class="btn pri" data-act="aiaddprov">Add</button>
    <span class="hint">You can add several and switch between them. Any service with an OpenAI-style API works through "Custom".</span></div>
  <div class="card"><span class="t">Which model answers</span>
    <div class="seg" role="group" aria-label="Model choice"><button class="${A.routing !== 'auto' ? 'on' : ''}" data-act="airouting" data-v="manual" aria-pressed="${A.routing !== 'auto'}">Manual</button><button class="${A.routing === 'auto' ? 'on' : ''}" data-act="airouting" data-v="auto" aria-pressed="${A.routing === 'auto'}">Automatic</button></div>
    <span class="s">${A.routing === 'auto' ? 'The app picks one of the three models below by the kind of question. You can still override it on each question.' : 'Every question uses the everyday model unless you pick another on the Ask screen.'}</span>
    ${refSelect('routine', A.routes.routine)}${A.routing === 'auto' ? refSelect('complex', A.routes.complex) + refSelect('vision', A.routes.vision) : ''}
    <span class="hint">A question is never sent to more than one provider. If a provider fails, nothing else is tried until you choose.</span></div>
  <div class="card"><span class="t">Cost savers</span>
    ${ck('concise', 'Short answers by default (Detailed is one tap away)', true)}
    ${ck('cache', 'Prompt caching for photo conversations (Claude). Other providers cache on their own.', true)}
    ${ck('askPhotos', 'Ask me before photos are sent to a provider', true)}</div>
  <a class="btn" href="#aiusage">Usage &amp; budget</a>
  <p class="hint">API keys are stored only on this phone, separately from your farm data, and are never included in backups or sent anywhere except to their own provider. Anyone who can unlock this phone could use them, so set a spending limit on each provider's website as well. If several people will ever use this app, the safer design is a small server that holds the keys.</p>`;
}
const fetched = {};
function vAIProv(id) {
  const p = provById(id); if (!p) return vMissing();
  const P = PRESETS[p.preset] || PRESETS.custom, key = keyOf(p.id), fl = fetched[p.id];
  const num1 = (i, k, label, v) => `<div class="f"><label for="m${k}${i}">${label}</label><input id="m${k}${i}" inputmode="decimal" data-pm="${i}" data-k="${k}" value="${esc(v)}"></div>`;
  const cb = (i, k, label, v) => `<label class="row" style="gap:6px;font-size:13px;min-height:40px"><input type="checkbox" class="check" data-pm="${i}" data-k="${k}" ${v ? 'checked' : ''}>${label}</label>`;
  return `${back('#aiset', 'AI providers')}<h1>${esc(p.name)}</h1>
  <div class="card">
    <div class="f"><label for="pv_name">Name</label><input id="pv_name" data-pf="name" value="${esc(p.name)}"></div>
    <div class="f"><label for="pv_base">API address (endpoint)</label><input id="pv_base" data-pf="base" value="${esc(p.base)}" placeholder="https://…/v1" autocapitalize="off" autocomplete="off" spellcheck="false">
      <span class="hint">${P.base ? (p.base === P.base ? 'Standard address for this provider.' : `Changed from the standard address (${esc(P.base)}). Your key and farm data go to ${esc(hostOf(p.base))}.`) : 'The base address ending before /chat/completions.'} Protocol: ${p.proto === 'openai' ? 'OpenAI-compatible' : p.proto === 'gemini' ? 'Google Gemini' : 'Anthropic Messages'}.</span></div>
    <div class="f"><label for="pv_key">API key</label><input id="pv_key" type="password" autocomplete="off" placeholder="${key ? 'Saved: …' + esc(key.slice(-4)) : esc(P.hint || 'Paste the key')}"></div>
    <div class="g3"><button class="btn sm pri" data-act="aisavekey" data-id="${p.id}">Save key</button><button class="btn sm" data-act="aitest" data-id="${p.id}">Test</button><button class="btn sm danger" data-act="aidelkey" data-id="${p.id}">Remove key</button></div>
    ${P.docs ? `<a class="s" href="${esc(P.docs)}" target="_blank" rel="noopener" style="min-height:36px;display:flex;align-items:center">Models and current prices on the provider's site</a>` : ''}</div>
  <p class="sec">Models</p>
  ${p.models.map((m, i) => `<div class="stagerow">
    <div class="between"><span class="t mono" style="font-size:13px;word-break:break-all">${esc(m.id)}</span><button class="btn sm danger" data-act="aidelmodel" data-id="${p.id}" data-i="${i}" aria-label="Remove ${esc(m.id)}">Remove</button></div>
    <div class="g3">${num1(i, 'in', 'Input $/1M', m.in)}${num1(i, 'out', 'Output $/1M', m.out)}${num1(i, 'cin', 'Cached $/1M', m.cin)}</div>
    <div class="g2">${num1(i, 'ctx', 'Context (tokens)', m.ctx)}<button class="btn sm" data-act="aivtest" data-id="${p.id}" data-i="${i}" style="align-self:end;min-height:48px">Test with a photo</button></div>
    <div class="row" style="gap:14px">${cb(i, 'vision', 'Reads photos', m.vision)}${cb(i, 'reasoning', 'Reasoning model', m.reasoning)}${cb(i, 'json', 'Structured output', m.json)}</div>
    ${m.src ? `<span class="hint">${esc(m.src)}</span>` : (m.in === '' || m.in == null ? `<span class="hint">Enter the prices from the provider's site to see costs for this model.</span>` : '')}</div>`).join('') || '<div class="empty">No models yet. Fetch the list or type a model name.</div>'}
  <div class="card">
    <button class="btn" data-act="aifetch" data-id="${p.id}">Fetch the model list from ${esc(hostOf(p.base) || 'provider')}</button>
    ${fl ? `<div class="f"><label for="pv_pick">Add from the provider's list (${fl.length})</label><input id="pv_filter" placeholder="Filter, e.g. vision or flash" value="${esc(ui.mfilter || '')}"><select id="pv_pick">${fl.filter(x => !ui.mfilter || x.id.toLowerCase().includes(ui.mfilter.toLowerCase())).slice(0, 300).map(x => `<option value="${esc(x.id)}">${esc(x.id)}${x.priced ? ` · $${x.in}/$${x.out}` : ''}${x.vision && p.proto === 'openai' ? ' · photos' : ''}</option>`).join('')}</select></div><button class="btn pri" data-act="aipick" data-id="${p.id}">Add selected model</button>` : ''}
    <div class="row" style="flex-wrap:nowrap;align-items:flex-end"><div class="f" style="flex:1"><label for="pv_newmodel">Or type a model name</label><input id="pv_newmodel" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="exact model ID"></div><button class="btn" data-act="aiaddmodel" data-id="${p.id}">Add</button></div>
    <span class="hint">"Reasoning model" gives the model extra room to think before answering (costs more output tokens). Tick "Reads photos" only if the model accepts images, or use "Test with a photo".</span></div>
  <button class="btn danger block" data-act="aidelprov" data-id="${p.id}">Remove this provider</button>`;
}
function vAIUsage() {
  const A = AIS(), t = today(), ym = t.slice(0, 7), mo = usageRows(ym), M = sumRows(mo), D = sumRows(usageRows(t)), B = num(A.budget);
  const pct = B > 0 ? Math.min(100, M.cost / B * 100) : 0, rec = [...db.aiUsage].reverse().slice(0, 30);
  const tk = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  const rt = pickRoute(freshAI(null));
  return `${back('#settings', 'Settings')}<h1>AI usage</h1>
  <div class="tiles"><div class="tile"><span class="k">This month</span><span class="v">${usd(M.cost)}</span></div><div class="tile"><span class="k">Today</span><span class="v">${usd(D.cost)}</span></div><div class="tile"><span class="k">Requests</span><span class="v">${M.n}</span></div></div>
  <div class="card"><span class="s">Current default: <strong>${rt ? esc(rt.m.id) + ' · ' + esc(rt.p.name) : 'none set'}</strong></span>
    <div class="between s"><span>Tokens this month</span><span class="mono">${tk(M.in)} in · ${tk(M.out)} out · ${tk(M.cached)} cached</span></div>
    <div class="between s"><span>Answered from your records (free)</span><span class="mono">${A.localCount || 0}</span></div>
    ${M.unp ? `<span class="hint neg">${M.unp} request${M.unp > 1 ? 's' : ''} this month used a model with no prices entered, so the totals are too low.</span>` : ''}</div>
  <div class="card"><span class="t">Monthly budget</span>
    ${B > 0 ? `<div class="between s"><span>${usd(M.cost)} of ${usd(B)}</span><span class="${M.cost >= B ? 'neg' : ''}">${usd(Math.max(0, B - M.cost))} left</span></div><div class="bar"><i style="width:${pct}%;${pct >= num(A.warnPct || 80) ? 'background:var(--warn)' : ''}"></i></div>` : ''}
    <div class="g2"><div class="f"><label for="bg_budget">Budget (USD per month)</label><input id="bg_budget" inputmode="decimal" data-as="budget" value="${esc(A.budget)}" placeholder="e.g. 5"></div><div class="f"><label for="bg_warn">Warn me at (%)</label><input id="bg_warn" inputmode="numeric" data-as="warnPct" value="${esc(A.warnPct)}"></div></div>
    <label class="row" style="gap:10px;min-height:44px;font-size:14px"><input type="checkbox" class="check" data-as="hardStop" ${A.hardStop ? 'checked' : ''}>Stop sending when the budget is used up</label>
    <span class="hint">These are this app's own estimates: tokens reported by the provider × the prices you entered. The app cannot see your real balance, and this limit does not replace a spending limit on the provider's website.</span></div>
  <p class="sec">This month by model</p>
  ${mo.length ? `<div class="list">${mo.map(g => `<div class="item"><span class="main"><span class="t mono" style="font-size:13px;word-break:break-all">${esc(g.model)}</span><span class="s">${esc(g.prov)} · ${g.n} request${g.n > 1 ? 's' : ''} · ${tk(g.in)} in · ${tk(g.out)} out${g.cached ? ' · ' + tk(g.cached) + ' cached' : ''}</span></span><span class="mono" style="font-weight:600">${g.unp === g.n ? '—' : usd(g.cost)}</span></div>`).join('')}</div>` : '<div class="empty">No AI requests this month.</div>'}
  ${rec.length ? `<p class="sec">Recent requests</p><div class="list">${rec.map(e => `<div class="item"><span class="date">${fd(e.date)}</span><span class="main"><span class="t mono" style="font-size:12px;word-break:break-all">${esc(e.model)}</span><span class="s">${esc(e.prov)} · ${e.in.toLocaleString('en-US')} in${e.cached ? ' (' + e.cached.toLocaleString('en-US') + ' cached)' : ''} · ${e.out.toLocaleString('en-US')} out${e.kind === 'test' ? ' · test' : ''}</span></span><span class="mono s">${e.cost == null ? '—' : usd(e.cost)}${e.rep ? '*' : ''}</span></div>`).join('')}</div><p class="hint">* cost reported by the provider itself.</p><button class="btn danger" data-act="aiclearusage">Clear the usage log</button>` : ''}`;
}


/* ---------- plant health: photos (IndexedDB), problems, follow-ups, field report ---------- */
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const SEVS = ['low', 'moderate', 'high', 'severe'];
const ISTAT = { active: 'Active', monitoring: 'Monitoring', resolved: 'Resolved' };
const PH_BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const phCache = new Map();

/* Photos live in IndexedDB (not localStorage, which is too small). Record: {id, full, thumb, created} */
const PH = {
  dbp: null, mem: new Map(), volatile: false,
  open() {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise(res => {
      try {
        if (!window.indexedDB) throw new Error('no idb');
        const rq = indexedDB.open('farmapp.photos', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('p', { keyPath: 'id' });
        rq.onsuccess = () => res(rq.result);
        rq.onerror = rq.onblocked = () => { this.volatile = true; res(null); };
      } catch (e) { this.volatile = true; res(null); }
    });
    return this.dbp;
  },
  async run(mode, f, memFn) {
    const d = await this.open();
    if (!d) return memFn();
    return new Promise((res, rej) => {
      let r;
      try {
        const t = d.transaction('p', mode);
        r = f(t.objectStore('p'));
        t.oncomplete = () => res(r ? r.result : undefined);
        t.onerror = t.onabort = () => rej(t.error || new Error('db'));
      } catch (e) { rej(e); }
    });
  },
  put(rec) { phCache.set(rec.id, rec); return this.run('readwrite', s => s.put(rec), () => { this.mem.set(rec.id, rec); }).catch(e => { phCache.delete(rec.id); throw e; }); },
  get(id) {
    if (phCache.has(id)) return Promise.resolve(phCache.get(id));
    return this.run('readonly', s => s.get(id), () => this.mem.get(id)).then(r => { if (r) phCache.set(id, r); return r; }).catch(() => undefined);
  },
  del(id) { phCache.delete(id); return this.run('readwrite', s => s.delete(id), () => { this.mem.delete(id); }).catch(() => { }); },
  all() { return this.run('readonly', s => s.getAll(), () => [...this.mem.values()]).then(a => a || []).catch(() => []); },
  clear() { phCache.clear(); return this.run('readwrite', s => s.clear(), () => { this.mem.clear(); }).catch(() => { }); },
  async stats() { const a = await this.all(); return { n: a.length, bytes: a.reduce((t, p) => t + (p.full || '').length + (p.thumb || '').length, 0) }; }
};

function procPhoto(file, maxFull = 1280, qFull = 0.74) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const mk = (max, q) => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); };
      try { const full = mk(maxFull, qFull), thumb = mk(420, 0.7); URL.revokeObjectURL(url); res({ full, thumb }); }
      catch (e) { URL.revokeObjectURL(url); rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image.')); };
    img.src = url;
  });
}
/* store photos from a file input into `list` (ids). `fresh` collects ids added in this editing session. */
async function addPhotos(files, list, fresh, max) {
  let bad = 0, quota = false, full = false;
  for (const f of files) {
    if (list.length >= max) { full = true; break; }
    try { const p = await procPhoto(f); const id = 'ph' + uid(); await PH.put({ id, full: p.full, thumb: p.thumb, created: Date.now() }); list.push(id); fresh.push(id); }
    catch (e) { if (e && e.name === 'QuotaExceededError') quota = true; else bad++; }
  }
  if (quota) toast('This phone has no space left for photos. Export a backup and free some storage.');
  else if (bad) toast(bad === 1 ? 'One photo could not be read.' : bad + ' photos could not be read.');
  else if (full) toast(`Up to ${max} photos here.`);
  else if (PH.volatile) toast('This browser cannot keep photos permanently. Export a backup after adding.');
}
function phImg(id, size = 'thumb', alt = 'Photo') {
  const r = phCache.get(id), src = r ? (size === 'full' ? r.full : r.thumb) : '';
  return `<img src="${src || PH_BLANK}" data-pid="${esc(id)}" data-sz="${size}" ${src ? 'data-ok="1"' : ''} alt="${esc(alt)}">`;
}
function hydratePhotos() {
  const jobs = [...document.querySelectorAll('img[data-pid]:not([data-ok])')].map(img => PH.get(img.dataset.pid).then(r => {
    if (!img.isConnected) return;
    if (r) { img.src = img.dataset.sz === 'full' ? r.full : r.thumb; img.dataset.ok = '1'; }
    else { img.dataset.ok = '0'; img.alt = 'Photo not available (not in this backup)'; const h = img.closest('.ph'); if (h) h.classList.add('miss'); }
  }));
  return Promise.all(jobs);
}
const photoGrid = (ids, cap_) => ids && ids.length ? `<div class="pgrid">${ids.map(id => `<button type="button" class="ph" data-act="photo" data-pid="${esc(id)}" data-cap="${esc(cap_ || '')}" aria-label="Open photo">${phImg(id, 'thumb', cap_ || 'Photo')}</button>`).join('')}</div>` : '';
let lightbox = null;
function closeLightbox() { if (lightbox) { lightbox.remove(); lightbox = null; } }
async function openPhoto(id, caption) {
  const r = await PH.get(id); if (!r) return toast('That photo is not stored on this phone.');
  closeLightbox();
  const w = document.createElement('div'); lightbox = w;
  w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Photo');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,11,.94);z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;gap:10px';
  w.innerHTML = `<img src="${r.full}" alt="${esc(caption || 'Photo')}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px"><span style="color:#E8EEE6;font-size:13px;text-align:center">${esc(caption || '')}</span><button type="button" class="btn" style="min-width:140px">Close</button>`;
  const k = e => { if (e.key === 'Escape') { closeLightbox(); document.removeEventListener('keydown', k); } };
  w.addEventListener('click', () => { closeLightbox(); document.removeEventListener('keydown', k); });
  document.addEventListener('keydown', k); document.body.appendChild(w); w.querySelector('button').focus();
}
window.addEventListener('hashchange', closeLightbox);
/* delete stored photos that no problem refers to (abandoned drafts). Only photos older than a day. */
async function sweepPhotos() {
  try {
    if (db.settings.sample || !storageOK) return;
    const keep = new Set();
    db.stock.forEach(s => (s.labelPhotos || []).forEach(p => keep.add(p)));
    if (sdraft) sdraft.photos.forEach(p => keep.add(p));
    (db.issues || []).forEach(i => { (i.photos || []).forEach(p => keep.add(p)); (i.updates || []).forEach(u => (u.photos || []).forEach(p => keep.add(p))); });
    const all = await PH.all();
    for (const p of all) if (!keep.has(p.id) && Date.now() - (p.created || 0) > 864e5) await PH.del(p.id);
  } catch (e) { /* optional */ }
}

/* ----- problems ----- */
const issueById = id => (db.issues || []).find(i => i.id === id);
const issueName = i => i.name || 'Unidentified problem';
const isOpenIssue = i => i.status !== 'resolved';
const updSorted = i => [...(i.updates || [])].sort((a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0));
function curState(i) {
  const us = updSorted(i).reverse();
  const sv = us.find(u => u.severity), sp = us.find(u => u.spread !== '' && u.spread != null);
  return { severity: sv ? sv.severity : i.severity, spread: sp ? sp.spread : i.spread };
}
const issuePhotoIds = i => [...(i.photos || []), ...(i.updates || []).flatMap(u => u.photos || [])];
const sevBadge = s => s ? `<span class="badge ${s === 'low' ? 'b-mut' : s === 'moderate' ? 'b-warn' : 'b-bad'}">${esc(cap(s))}</span>` : '';
const statBadge = s => `<span class="badge ${s === 'resolved' ? 'b-ok' : s === 'monitoring' ? 'b-water' : 'b-bad'}">${ISTAT[s] || 'Active'}</span>`;
/* what crop / day / stage the block was in on `date` (kept on the problem so history stays right after replanting) */
function snapFor(b, date) {
  if (!b) return { crop: '', variety: '', day: null, stage: '' };
  const h = (b.history || []).find(c => date >= (c.from || '0000-01-01') && date <= c.ended);
  const src = h || b;
  const day = src.planted ? diff(src.planted, date) : null;
  const st = day != null && day >= 0 ? (src.stages || []).find(s => day >= num(s.start) && day <= num(s.end)) : null;
  return { crop: src.crop || '', variety: src.variety || '', day: day != null && day >= 0 ? day : null, stage: st ? st.name : '' };
}
const snapText = i => i.snap && i.snap.crop ? `${i.snap.crop}${i.snap.day != null ? ' · day ' + i.snap.day : ''}${i.snap.stage ? ' · ' + i.snap.stage : ''}` : '';
function issueTreatments(i) {
  const nm = (i.name || '').toLowerCase();
  return db.records.filter(r => r.blockId === i.blockId && r.date >= i.date && (r.issueId === i.id || (!r.issueId && nm && r.type === 'spray' && (r.target || '').toLowerCase().includes(nm)))).sort(byDate);
}
function issueRow(i, showBlock = true) {
  const b = blockById(i.blockId), cs = curState(i), p0 = (i.photos || [])[0];
  const n = issuePhotoIds(i).length, nu = (i.updates || []).length;
  const sub = [fdy(i.date), showBlock && b ? b.name : '', i.snap && i.snap.crop, i.kind].filter(Boolean).join(' · ');
  return `<a class="item" href="#issue/${i.id}">
    ${p0 ? `<span class="ph" style="width:52px;height:52px;flex:none">${phImg(p0, 'thumb', '')}</span>` : `<span class="ib" style="width:52px;height:52px;background:var(--warnbg);color:var(--warn);border-color:var(--warnline)">${ic('warn', 22)}</span>`}
    <span class="main"><span class="t">${esc(issueName(i))}</span><span class="s">${esc(sub)}</span>
      <span class="row" style="gap:6px">${sevBadge(cs.severity)}${statBadge(i.status)}${n ? `<span class="s">${n} photo${n > 1 ? 's' : ''}</span>` : ''}${nu ? `<span class="s">${n ? '· ' : ''}${nu} follow-up${nu > 1 ? 's' : ''}</span>` : ''}</span></span>${ic('chev', 18, 2)}</a>`;
}
const blockIssues = (b, all) => (db.issues || []).filter(i => i.blockId === b.id && (all || i.date >= curFrom(b))).sort(byDateDesc);
function healthCard(b, scope) {
  const bi = blockIssues(b, scope === 'all'), open = bi.filter(isOpenIssue);
  const shown = (open.length ? open : bi).slice(0, 3);
  return `<div class="col" style="gap:10px"><div class="between"><h2>Plant health${open.length ? ` <span class="badge b-bad">${open.length} open</span>` : ''}</h2><a class="btn sm" href="#issueedit/new?block=${b.id}">${ic('plus', 16, 2.2)}Report problem</a></div>
    ${shown.length ? `<div class="list">${shown.map(i => issueRow(i, false)).join('')}</div>${bi.length > shown.length ? `<a class="s" href="#health?block=${b.id}" style="min-height:36px;display:flex;align-items:center">See all ${bi.length} on ${esc(b.name)}</a>` : ''}` : `<div class="empty">No plant-health problems recorded${scope !== 'all' && (b.history || []).length ? ' for this crop' : ''}.</div>`}
    <a class="btn block" href="#report/${b.id}">${ic('list', 18, 2)}Field report — print or save as PDF</a></div>`;
}

function vHealth() {
  const all = db.issues || [];
  const f = ui.hfilter, bk = ui.hblock && blockById(ui.hblock) ? ui.hblock : '';
  const list = all.filter(i => (!bk || i.blockId === bk) && (f === 'all' || (f === 'open' ? i.status !== 'resolved' : i.status === f))).sort(byDateDesc);
  const open = all.filter(isOpenIssue).length;
  const nph = all.reduce((a, i) => a + issuePhotoIds(i).length, 0);
  const seen = {};
  all.forEach(i => { const k = (i.name || '').trim().toLowerCase(); if (!k) return; (seen[k] = seen[k] || { name: i.name, n: 0, last: '', blocks: new Set() }); const s = seen[k]; s.n++; if (i.date > s.last) s.last = i.date; s.blocks.add(i.blockId); });
  const rec = Object.values(seen).filter(s => s.n >= 2).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 5);
  const chips = [['open', 'Open'], ['active', 'Active'], ['monitoring', 'Monitoring'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="hfilter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('');
  return `<div class="between"><h1>Fields</h1><a class="btn pri sm" href="#issueedit/new${bk ? '?block=' + bk : ''}">${ic('plus', 16, 2.2)}Report problem</a></div>
  ${fieldsSeg('health', open)}
  <div class="tiles"><div class="tile"><span class="k">Open</span><span class="v">${open}</span></div><div class="tile"><span class="k">Resolved</span><span class="v">${all.length - open}</span></div><div class="tile"><span class="k">Photos</span><span class="v">${nph}</span></div></div>
  <div class="chips">${chips}</div>
  ${db.blocks.length > 1 ? `<div class="f"><label for="h_block">Field</label><select id="h_block" data-hf="hblock"><option value="">All fields</option>${db.blocks.map(b => `<option value="${b.id}" ${b.id === bk ? 'selected' : ''}>${esc(blockLabel(b))}</option>`).join('')}</select></div>` : ''}
  ${list.length ? `<div class="list">${list.map(i => issueRow(i)).join('')}</div>` : `<div class="empty">${all.length ? 'No problems match this filter.' : 'No plant-health problems recorded yet.<br>Report one when you see a disease, pest or deficiency, and add photos so you can compare later.'}<a class="btn pri sm" href="#issueedit/new${bk ? '?block=' + bk : ''}">Report a problem</a></div>`}
  ${rec.length ? `<p class="sec">Seen more than once</p><div class="list">${rec.map(s => `<div class="item"><span class="main"><span class="t">${esc(s.name)}</span><span class="s">Last seen ${fdy(s.last)} · ${s.blocks.size} field${s.blocks.size > 1 ? 's' : ''}</span></span><span class="badge b-warn">${s.n}×</span></div>`).join('')}</div>` : ''}`;
}
function fieldsSeg(on, open) {
  return `<div class="seg" role="group" aria-label="Fields view"><a class="${on === 'blocks' ? 'on' : ''}" href="#fields" ${on === 'blocks' ? 'aria-current="page"' : ''}>Blocks</a><a class="${on === 'health' ? 'on' : ''}" href="#health" ${on === 'health' ? 'aria-current="page"' : ''}>Plant health${open ? ' · ' + open : ''}</a></div>`;
}

function vIssue(id) {
  const i = issueById(id); if (!i) return vMissing();
  const b = blockById(i.blockId), cs = curState(i), ups = updSorted(i), tr = issueTreatments(i);
  const open = isOpenIssue(i);
  const stBtn = k => `<button class="${i.status === k ? 'on' : ''}" data-act="istatus" data-id="${i.id}" data-v="${k}" aria-pressed="${i.status === k}">${ISTAT[k]}</button>`;
  const det = [['Where in the block', i.where], ['Suspected cause', i.cause], ['Conditions / weather', i.conditions]].filter(x => x[1]);
  const tl = `<div class="tl">
    <div><span class="s"><strong>${fdy(i.date)}</strong> · Noticed${i.snap && i.snap.day != null ? ' · crop day ' + i.snap.day : ''}</span>
      <span class="row" style="gap:6px">${sevBadge(i.severity)}${i.spread !== '' && i.spread != null ? `<span class="badge b-mut">${fmt(num(i.spread))}% of plants</span>` : ''}</span>
      ${i.symptoms ? `<span style="font-size:14px;white-space:pre-wrap">${esc(i.symptoms)}</span>` : ''}
      ${photoGrid(i.photos, `${issueName(i)} — ${fdy(i.date)}`)}</div>
    ${ups.map(u => `<div><span class="between"><span class="s"><strong>${fdy(u.date)}</strong> · ${u.advice ? 'Advice' : 'Follow-up'}${diff(i.date, u.date) > 0 ? ' · day ' + diff(i.date, u.date) + ' of problem' : ''}</span><a class="s" href="#followup/${i.id}/${u.id}" style="min-height:36px;display:flex;align-items:center">Edit</a></span>
      <span class="row" style="gap:6px">${sevBadge(u.severity)}${u.spread !== '' && u.spread != null ? `<span class="badge b-mut">${fmt(num(u.spread))}% of plants</span>` : ''}${u.status && u.status !== 'active' ? statBadge(u.status) : ''}</span>
      ${u.note ? `<span style="font-size:14px;white-space:pre-wrap">${esc(u.note)}</span>` : ''}
      ${photoGrid(u.photos, `${issueName(i)} — ${fdy(u.date)}`)}</div>`).join('')}
    ${!open && i.resolvedOn ? `<div><span class="s"><strong>${fdy(i.resolvedOn)}</strong> · Resolved</span>${i.outcome ? `<span style="font-size:14px;white-space:pre-wrap">${esc(i.outcome)}</span>` : ''}</div>` : ''}</div>`;
  return `${back('#health', 'Plant health')}
  <div class="between" style="align-items:flex-end"><div class="col"><span class="eyebrow">${esc(i.kind || 'Problem')} · ${b ? esc(b.name) : 'Deleted block'}${snapText(i) ? ' · ' + esc(snapText(i)) : ''}</span><h1>${esc(issueName(i))}</h1></div><a class="ib" href="#issueedit/${i.id}" aria-label="Edit problem">${ic('edit', 20)}</a></div>
  <div class="seg" role="group" aria-label="Status">${Object.keys(ISTAT).map(stBtn).join('')}</div>
  <div class="tiles"><div class="tile"><span class="k">Noticed</span><span class="v">${fd(i.date)}</span></div><div class="tile"><span class="k">Severity now</span><span class="v">${cs.severity ? esc(cap(cs.severity)) : '—'}</span></div><div class="tile"><span class="k">Plants</span><span class="v">${cs.spread !== '' && cs.spread != null ? fmt(num(cs.spread)) + '%' : '—'}</span></div></div>
  ${open ? `<p class="s" style="margin:0">Open for ${diff(i.date, today())} day${diff(i.date, today()) === 1 ? '' : 's'}${b && phiEnd(b) ? ` · ${esc(b.name)} is under PHI until ${fd(phiEnd(b))}` : ''}</p>` : alertH('ok', 'check', `Resolved ${fdy(i.resolvedOn || i.date)}`, `${diff(i.date, i.resolvedOn || i.date)} days after it was first noticed`)}
  ${det.length ? `<div class="card" style="gap:8px">${det.map(([k, v]) => `<div class="col"><span class="k">${k}</span><span style="font-size:14px">${esc(v)}</span></div>`).join('')}</div>` : ''}
  <p class="sec">Timeline</p>${tl}
  <div class="g2"><a class="btn pri" href="#followup/${i.id}">${ic('plus', 16, 2.2)}Add follow-up</a><a class="btn" href="#record/new?type=spray&block=${i.blockId}&issue=${i.id}&target=${encodeURIComponent(encodeURIComponent(i.name || ''))}">${ic('drop', 16, 2)}Record spray</a></div>
  <p class="sec">Treatments &amp; related records</p>${tr.length ? `<div class="list">${tr.map(r => r.status === 'done' ? doneRow(r, false) : taskRow(r, false)).join('')}</div>` : `<div class="empty">No treatments recorded for this problem yet.</div>`}
  <button class="btn block" data-act="issueask" data-id="${i.id}">${ic('search', 18, 2)}Ask AI about this (photos included)</button>
  <a class="btn block" href="#report/${i.blockId}?issue=${i.id}">${ic('list', 18, 2)}Print this problem — PDF</a>`;
}

/* ----- problem form ----- */
let idraft = null, idraftKey = null;
function initIDraft(id, q) {
  if (id && id !== 'new') { const i = issueById(id); if (!i) return null; const d = JSON.parse(JSON.stringify(i)); d.newPhotos = []; d.removed = []; return d; }
  const only = db.blocks.length === 1 ? db.blocks[0].id : '';
  return { id: null, blockId: q.get('block') || only, date: today(), kind: L('issueKinds')[0] || 'Disease', name: '', severity: 'moderate', spread: '', where: '', symptoms: '', cause: '', conditions: '', status: 'active', resolvedOn: '', outcome: '', photos: [], updates: [], newPhotos: [], removed: [] };
}
function photoPicker(list, camId, galId, max) {
  const tiles = list.map((id, k) => `<div style="position:relative;width:88px;height:88px;flex:none"><span class="ph" style="width:88px;height:88px">${phImg(id, 'thumb', 'Photo ' + (k + 1))}</span><button type="button" class="ib" data-act="phdel" data-pid="${esc(id)}" aria-label="Remove photo ${k + 1}" style="position:absolute;top:-8px;right:-8px;width:32px;height:32px;border-radius:50%;background:#fff"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('');
  const cam = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const gal = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
  return `<div class="f"><span class="lbl">Photos (up to ${max})</span><div class="row" style="gap:12px">${tiles}
    ${list.length < max ? `<label for="${camId}" class="btn" style="width:88px;height:88px;flex-direction:column;gap:4px;font-size:12px;padding:0">${cam}Camera</label><label for="${galId}" class="btn" style="width:88px;height:88px;flex-direction:column;gap:4px;font-size:12px;padding:0">${gal}Gallery</label>` : ''}</div>
    <input id="${camId}" type="file" accept="image/*" capture="environment" class="sr"><input id="${galId}" type="file" accept="image/*" multiple class="sr">
    <span class="hint">Close-up of the affected leaf or fruit (top and underside), plus one of the whole plant and one showing how widely it is spread. Photos are shrunk and kept on this phone.</span></div>`;
}
function vIssueEdit() {
  const d = idraft; if (!d) return vMissing();
  const fld = (f, label, extra = '', type = 'text') => `<div class="f"><label for="i_${f}">${label}</label><input id="i_${f}" type="${type}" data-if="${f}" value="${esc(d[f])}" ${extra}></div>`;
  const seg = (arr, cur, act, label) => `<div class="seg" role="group" aria-label="${label}">${arr.map(k => `<button type="button" class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${k}" aria-pressed="${cur === k}">${esc(cap(ISTAT[k] || k))}</button>`).join('')}</div>`;
  return `<a class="back" href="#health" data-act="icancel">${ic('back', 18, 2)}Cancel</a><h1>${d.id ? 'Edit problem' : 'Report a problem'}</h1>
  <div class="form">
    <div class="f"><label for="i_blockId">Field / block</label><select id="i_blockId" data-if="blockId"><option value="">Choose block…</option>${db.blocks.map(b => `<option value="${b.id}" ${b.id === d.blockId ? 'selected' : ''}>${esc(blockLabel(b))}</option>`).join('')}</select></div>
    <div class="g2">${fld('date', 'Date noticed', '', 'date')}<div class="f"><label for="i_kind">Type</label><select id="i_kind" data-if="kind" data-list="issueKinds">${opts('issueKinds', d.kind)}</select></div></div>
    <div class="f"><label for="i_name">What is it?</label><select id="i_name" data-if="name" data-list="issueNames">${opts('issueNames', d.name, 'Not identified yet')}</select><span class="hint">Pick from your list or "+ Add new…". Leave it unidentified and use Ask AI from the problem page.</span></div>
    <div class="f"><span class="lbl">Severity</span>${seg(SEVS, d.severity, 'idsev', 'Severity')}</div>
    <div class="g2">${fld('spread', 'Plants affected (%)', 'inputmode="decimal" placeholder="e.g. 15"')}${fld('where', 'Where in the block', 'placeholder="e.g. rows 1–6, south end"')}</div>
    <div class="f"><label for="i_symptoms">What do you see?</label><textarea id="i_symptoms" data-if="symptoms" placeholder="Symptoms, which leaves or fruit, how fast it is spreading">${esc(d.symptoms)}</textarea></div>
    <div class="g2">${fld('cause', 'Suspected cause (optional)')}${fld('conditions', 'Weather / conditions', 'placeholder="e.g. hot, humid nights"')}</div>
    ${photoPicker(d.photos, 'iph_cam', 'iph_gal', 8)}
    <div class="f"><span class="lbl">Status</span>${seg(['active', 'monitoring', 'resolved'], d.status, 'idstat', 'Status')}</div>
    ${d.status === 'resolved' ? `<div class="g2">${fld('resolvedOn', 'Resolved on', '', 'date')}${fld('outcome', 'Outcome (what worked)')}</div>` : ''}
    <button class="btn pri block" data-act="isave">Save problem</button>
    ${d.id ? `<button class="btn danger block" data-act="idel">Delete problem</button>` : ''}
  </div>`;
}

/* ----- follow-up form ----- */
let udraft = null, udraftKey = null;
function initUDraft(iid, uid_) {
  const i = issueById(iid); if (!i) return null;
  if (uid_) { const u = (i.updates || []).find(x => x.id === uid_); if (!u) return null; const d = JSON.parse(JSON.stringify(u)); d.issueId = iid; d.newPhotos = []; d.removed = []; return d; }
  const cs = curState(i);
  return { id: null, issueId: iid, date: today(), severity: cs.severity || '', spread: cs.spread != null ? cs.spread : '', status: i.status === 'resolved' ? 'active' : i.status, note: '', photos: [], newPhotos: [], removed: [] };
}
function vFollowup() {
  const d = udraft, i = d && issueById(d.issueId); if (!d || !i) return vMissing();
  const seg = (arr, cur, act, label) => `<div class="seg" role="group" aria-label="${label}">${arr.map(k => `<button type="button" class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${k}" aria-pressed="${cur === k}">${esc(ISTAT[k] || cap(k))}</button>`).join('')}</div>`;
  return `<a class="back" href="#issue/${i.id}" data-act="ucancel">${ic('back', 18, 2)}Cancel</a><h1>${d.id ? 'Edit follow-up' : 'Add follow-up'}</h1>
  <p class="hint" style="margin:-8px 0 0">${esc(issueName(i))} · ${esc((blockById(i.blockId) || {}).name || '')} · first noticed ${fdy(i.date)}</p>
  <div class="form">
    <div class="f"><label for="u_date">Date</label><input id="u_date" type="date" data-uf="date" value="${esc(d.date)}"></div>
    <div class="f"><span class="lbl">Severity now</span>${seg(SEVS, d.severity, 'usev', 'Severity')}</div>
    <div class="f"><label for="u_spread">Plants affected now (%)</label><input id="u_spread" inputmode="decimal" data-uf="spread" value="${esc(d.spread)}"></div>
    <div class="f"><label for="u_note">What changed / what you did</label><textarea id="u_note" data-uf="note" placeholder="e.g. Spread to rows 7–10 after the wind; sprayed; lesions drying up">${esc(d.note)}</textarea></div>
    ${photoPicker(d.photos, 'uph_cam', 'uph_gal', 8)}
    <div class="f"><span class="lbl">Status</span>${seg(['active', 'monitoring', 'resolved'], d.status, 'ustat', 'Status')}</div>
    <button class="btn pri block" data-act="usave">Save follow-up</button>
    ${d.id ? `<button class="btn danger block" data-act="udel">Delete follow-up</button>` : ''}
  </div>`;
}

/* ----- field report (print / save as PDF) ----- */
const REPORT_CSS = `.report{background:#fff;color:#111;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.45;border:1px solid #E2E5DD;border-radius:12px;padding:16px}
.report h1{margin:0 0 2px;font-size:22px;letter-spacing:-.01em}
.report h2{margin:20px 0 8px;font-size:15px;color:#1F4A27;border-bottom:2px solid #2F6B3A;padding-bottom:3px;break-after:avoid}
.report h3{margin:0;font-size:14px}
.report p{margin:4px 0}
.report .sub{color:#555;font-size:12px}
.report table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}
.report th,.report td{border:1px solid #C9CFC3;padding:4px 6px;text-align:left;vertical-align:top}
.report th{background:#EEF3EC;font-weight:600}
.report tr{break-inside:avoid}
.report .kv{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 12px;margin:8px 0}
.report .kv span{display:block;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.05em}
.report .kv b{font-size:13px}
.report .issue{border:1px solid #C9CFC3;border-radius:8px;padding:10px 12px;margin:10px 0}
.report .tag{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;background:#EEF3EC;color:#1F4A27;margin:0 4px 2px 0}
.report .tag.bad{background:#FBE9E7;color:#8C2A1F}.report .tag.warn{background:#FDF1E4;color:#6E3606}
.report .pgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0}
.report .pgrid.sm{grid-template-columns:repeat(4,1fr)}
.report figure{margin:0;break-inside:avoid}
.report figure img{width:100%;height:auto;max-height:90mm;object-fit:contain;display:block;border:1px solid #C9CFC3;border-radius:4px;background:#f4f4f2}
.report figcaption{font-size:11px;color:#555;margin-top:2px}
.report .fu{border-left:3px solid #2F6B3A;padding:2px 0 2px 10px;margin:8px 0;break-inside:avoid}
.report .foot{margin-top:18px;font-size:11px;color:#666;border-top:1px solid #C9CFC3;padding-top:6px}
@media print{@page{size:A4;margin:14mm}html,body{background:#fff!important}nav.tabs,.noprint,.toast{display:none!important}main{max-width:none!important;padding:0!important;display:block!important}.report{border:0;border-radius:0;padding:0}.issue{break-inside:auto}}`;
/* photo and timeline styles live here too, so they work even if index.html on the site is an older copy */
(function () { const s = document.createElement('style'); s.id = 'healthcss'; s.textContent = `.ph{padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#EEF0EA;display:block;width:100%;aspect-ratio:1;cursor:pointer;position:relative;font:inherit;flex:none}
.ph img{width:100%;height:100%;max-width:100%;object-fit:cover;display:block}
.ph.miss{display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--mut);text-align:center}
.pgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.tl{border-left:2px solid var(--line);padding-left:14px;margin-left:6px;display:flex;flex-direction:column;gap:16px}
.tl>div{position:relative;display:flex;flex-direction:column;gap:6px}
.tl>div::before{content:"";position:absolute;left:-21px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--acc)}`; document.head.appendChild(s); })();
(function () { const s = document.createElement('style'); s.id = 'reportcss'; s.textContent = REPORT_CSS; document.head.appendChild(s); })();

let rdraft = null, rdraftKey = null;
function initRDraft(b, q) {
  const only = q.get('issue') || '';
  return { scope: 'all', from: '', to: '', summary: !only, health: true, records: !only, money: false, photos: 'large', onlyIssue: only };
}
function reportRange(b, r) {
  if (r.scope === 'current') return [curFrom(b), '9999-12-31'];
  if (r.scope === 'custom') return [r.from || '0000-01-01', r.to || '9999-12-31'];
  const c = cycleRanges(b).find(x => x.id === r.scope);
  return c ? [c.a, c.z] : ['0000-01-01', '9999-12-31'];
}
function reportScopeLabel(b, r) {
  const [a, z] = reportRange(b, r);
  if (r.scope === 'all') return 'Everything recorded for this field';
  if (r.scope === 'current') return `Current crop${b.crop ? ' (' + b.crop + ')' : ''}, from ${fdy(a)}`;
  if (r.scope === 'custom') return `${r.from ? fdy(r.from) : 'start'} to ${r.to ? fdy(r.to) : 'today'}`;
  const c = cycleRanges(b).find(x => x.id === r.scope);
  return c ? `${c.crop || 'Fallow'} crop, ${c.planted ? fdy(c.planted) : 'start'} to ${fdy(c.ended)}` : '';
}
function recDetail(r) {
  const parts = [];
  const prods = (r.lines || []).map(l => { const s = stockById(l.stockId); if (!s) return ''; const a = num(l.amount); return esc(s.name) + (a ? ` ${fmt(a)} ${esc(s.unit)}${l.basis === 'ha' ? '/ha' : ''}` : '') + (s.group ? ` <i>(${esc(s.group)})</i>` : ''); }).filter(Boolean).join(', ');
  if (r.type === 'activity') parts.push('<b>' + esc(r.activity || 'Activity') + '</b>' + (r.title ? ' — ' + esc(r.title) : ''));
  else if (r.type === 'task' || r.type === 'other') parts.push('<b>' + esc(r.title || TYPES[r.type]) + '</b>');
  if (prods) parts.push(prods);
  if (r.target) parts.push('Target: ' + esc(r.target));
  if (r.type === 'spray') { if (num(r.waterLha)) parts.push(fmt(num(r.waterLha)) + ' L water/ha'); if (num(r.phiDays) > 0) parts.push('PHI ' + r.phiDays + ' d' + (r.status === 'done' ? ' (to ' + fd(addDays(recEnd(r), num(r.phiDays))) + ')' : '')); }
  if (r.type === 'fertigation' && (r.ec || r.ph)) parts.push([r.ec ? 'EC ' + esc(r.ec) : '', r.ph ? 'pH ' + esc(r.ph) : ''].filter(Boolean).join(', '));
  if (r.type === 'irrigation') { if (num(r.minutes)) parts.push(fmt(num(r.minutes)) + ' min'); if (num(r.m3)) parts.push(fmt(num(r.m3)) + ' m³'); }
  if (r.type === 'scouting') { if (r.severity) parts.push('Pressure: ' + esc(r.severity)); if (r.count) parts.push(esc(r.count)); }
  const is = r.issueId && issueById(r.issueId); if (is) parts.push('Problem: ' + esc(issueName(is)));
  if (periodText(r)) parts.push(esc(periodText(r)));
  if (r.notes) parts.push('<span class="sub">' + esc(r.notes).replace(/\n/g, '<br>') + '</span>');
  return parts.join('<br>');
}
function reportPhotos(ids, caption, r) {
  if (r.photos === 'none' || !ids || !ids.length) return '';
  const small = r.photos === 'small';
  return `<div class="pgrid ${small ? 'sm' : ''}">${ids.map(id => `<figure>${phImg(id, small ? 'thumb' : 'full', caption)}<figcaption>${esc(caption)}</figcaption></figure>`).join('')}</div>`;
}
function reportHtml(b, r) {
  const [a, z] = reportRange(b, r);
  const inR = d => d >= a && d <= z;
  const issues = (db.issues || []).filter(i => i.blockId === b.id && inR(i.date) && (!r.onlyIssue || i.id === r.onlyIssue)).sort((x, y) => x.date.localeCompare(y.date));
  const recs = db.records.filter(x => x.blockId === b.id && inR(x.date)).sort((x, y) => x.date.localeCompare(y.date) || (x.created || 0) - (y.created || 0));
  let h = `<h1>${esc(b.name)} — ${r.onlyIssue ? 'problem report' : 'field report'}</h1>
  <div class="sub">${esc(db.settings.farmName || '')}${db.settings.location ? ' · ' + esc(db.settings.location) : ''}<br>${r.onlyIssue ? '' : 'Period: ' + esc(reportScopeLabel(b, r)) + '<br>'}Printed ${fdy(today())}</div>`;

  if (r.summary && !r.onlyIssue) {
    const day = cropDay(b), st = currentStage(b), pe = phiEnd(b);
    h += `<h2>Field summary</h2><div class="kv">
      <div><span>Area</span><b>${fmt(num(b.areaHa))} ha</b></div><div><span>Irrigation</span><b>${esc(b.irrigation || '—')}</b></div><div><span>Status</span><b>${b.status === 'fallow' ? 'Fallow' : b.status === 'harvested' ? 'Harvested' : 'Growing'}</b></div>
      <div><span>Current crop</span><b>${esc(b.crop || '—')}${b.variety ? ' · ' + esc(b.variety) : ''}</b></div><div><span>Planted</span><b>${b.planted ? fdy(b.planted) : '—'}</b></div><div><span>Crop day / stage</span><b>${day != null ? day : '—'}${st ? ' · ' + esc(st.name) : ''}</b></div></div>
      ${pe ? `<p>Pre-harvest interval active: no harvest before <b>${fdy(pe)}</b>.</p>` : ''}${b.notes ? `<p class="sub">${esc(b.notes)}</p>` : ''}`;
    const crops = [...cycleRanges(b).map(c => [c.crop || 'Fallow', c.variety, c.planted, c.ended]), ...(b.crop ? [[b.crop, b.variety, b.planted, '']] : [])];
    if (crops.length > 1 || (crops.length === 1 && crops[0][3])) h += `<table><tr><th>Crop</th><th>Variety</th><th>Planted</th><th>Ended</th><th>Days</th></tr>${crops.map(c => `<tr><td>${esc(c[0])}</td><td>${esc(c[1] || '')}</td><td>${c[2] ? fdy(c[2]) : ''}</td><td>${c[3] ? fdy(c[3]) : 'growing'}</td><td>${c[2] ? diff(c[2], c[3] || today()) : ''}</td></tr>`).join('')}</table>`;
    const cnt = t => recs.filter(x => x.type === t && x.status === 'done');
    const irr = cnt('irrigation'), sp = cnt('spray');
    h += `<p>In this period: <b>${sp.length}</b> spray${sp.length === 1 ? '' : 's'}, <b>${cnt('fertigation').length}</b> fertigation${cnt('fertigation').length === 1 ? '' : 's'}, <b>${irr.length}</b> irrigation${irr.length === 1 ? '' : 's'}${irr.length ? ` (${fmt(irr.reduce((t, x) => t + num(x.minutes), 0))} min, ${fmt(irr.reduce((t, x) => t + num(x.m3), 0))} m³ logged)` : ''}, <b>${cnt('scouting').length}</b> scouting visit${cnt('scouting').length === 1 ? '' : 's'}, <b>${issues.length}</b> plant-health problem${issues.length === 1 ? '' : 's'} (${issues.filter(isOpenIssue).length} still open).</p>`;
    if (sp.length) h += `<h3 style="margin-top:10px">Spray programme</h3><table><tr><th>Date</th><th>Products</th><th>Group</th><th>Target</th><th>PHI to</th></tr>${sp.map(x => `<tr><td>${fdy(x.date)}${periodText(x) ? '<br><span class="sub">' + esc(periodText(x)) + '</span>' : ''}</td><td>${(x.lines || []).map(l => { const s = stockById(l.stockId); return s ? esc(s.name) + (num(l.amount) ? ` ${fmt(num(l.amount))} ${esc(s.unit)}${l.basis === 'ha' ? '/ha' : ''}` : '') : ''; }).filter(Boolean).join(', ')}</td><td>${esc(recGroups(x).join(', '))}</td><td>${esc(x.target || '')}</td><td>${num(x.phiDays) > 0 ? fd(addDays(recEnd(x), num(x.phiDays))) : ''}</td></tr>`).join('')}</table>`;
  }

  if (r.health) {
    h += `<h2>Plant-health log</h2>`;
    if (!issues.length) h += `<p class="sub">No plant-health problems recorded in this period.</p>`;
    else {
      if (issues.length > 1) h += `<table><tr><th>Noticed</th><th>Problem</th><th>Type</th><th>Severity</th><th>Status</th><th>Resolved</th></tr>${issues.map(i => `<tr><td>${fdy(i.date)}</td><td>${esc(issueName(i))}</td><td>${esc(i.kind || '')}</td><td>${esc(cap(curState(i).severity || ''))}</td><td>${ISTAT[i.status] || 'Active'}</td><td>${i.resolvedOn ? fdy(i.resolvedOn) : ''}</td></tr>`).join('')}</table>`;
      issues.forEach(i => {
        const cs = curState(i), tr = issueTreatments(i), ups = updSorted(i);
        h += `<div class="issue"><h3>${esc(issueName(i))}</h3>
        <div class="sub">${esc(i.kind || 'Problem')} · noticed ${fdy(i.date)}${snapText(i) ? ' · ' + esc(snapText(i)) : ''}</div>
        <div style="margin:4px 0">${i.severity ? `<span class="tag ${i.severity === 'low' ? '' : i.severity === 'moderate' ? 'warn' : 'bad'}">Initial: ${esc(cap(i.severity))}</span>` : ''}${cs.severity && cs.severity !== i.severity ? `<span class="tag ${cs.severity === 'low' ? '' : cs.severity === 'moderate' ? 'warn' : 'bad'}">Latest: ${esc(cap(cs.severity))}</span>` : ''}${cs.spread !== '' && cs.spread != null ? `<span class="tag">${fmt(num(cs.spread))}% of plants</span>` : ''}<span class="tag ${i.status === 'resolved' ? '' : 'bad'}">${ISTAT[i.status] || 'Active'}${i.status === 'resolved' && i.resolvedOn ? ' ' + fdy(i.resolvedOn) : ''}</span></div>
        ${i.symptoms ? `<p><b>Observed:</b> ${esc(i.symptoms).replace(/\n/g, '<br>')}</p>` : ''}${i.where ? `<p><b>Where:</b> ${esc(i.where)}</p>` : ''}${i.cause ? `<p><b>Suspected cause:</b> ${esc(i.cause)}</p>` : ''}${i.conditions ? `<p><b>Conditions:</b> ${esc(i.conditions)}</p>` : ''}
        ${reportPhotos(i.photos, `${fdy(i.date)} — first noticed`, r)}
        ${ups.map(u => `<div class="fu"><b>${fdy(u.date)}</b> · ${u.advice ? 'Advice' : 'Follow-up'}${u.severity ? ' · ' + esc(cap(u.severity)) : ''}${u.spread !== '' && u.spread != null ? ' · ' + fmt(num(u.spread)) + '% of plants' : ''}${u.status === 'resolved' ? ' · resolved' : u.status === 'monitoring' ? ' · monitoring' : ''}${u.note ? '<br>' + esc(u.note).replace(/\n/g, '<br>') : ''}${reportPhotos(u.photos, `${fdy(u.date)} — follow-up`, r)}</div>`).join('')}
        ${tr.length ? `<p><b>Treatments &amp; related records:</b></p><table><tr><th>Date</th><th>Type</th><th>Details</th></tr>${tr.map(x => `<tr><td>${fdy(x.date)}</td><td>${esc(TYPES[x.type] || x.type)}${x.status === 'planned' ? ' (planned)' : ''}</td><td>${recDetail(x)}</td></tr>`).join('')}</table>` : ''}
        ${i.outcome ? `<p><b>Outcome:</b> ${esc(i.outcome)}</p>` : ''}</div>`;
      });
    }
  }

  if (r.records && !r.onlyIssue) {
    h += `<h2>Records</h2>`;
    h += recs.length ? `<table><tr><th style="width:68px">Date</th><th style="width:78px">Type</th><th>Details</th><th style="width:56px">Status</th></tr>${recs.map(x => `<tr><td>${fdy(x.date)}</td><td>${esc(x.type === 'activity' ? (x.activity || 'Activity') : TYPES[x.type] || x.type)}</td><td>${recDetail(x)}</td><td>${x.status === 'done' ? 'Done' : 'Planned'}</td></tr>`).join('')}</table>` : `<p class="sub">No records in this period.</p>`;
  }

  if (r.money && !r.onlyIssue) {
    const f = rangeFinance(b.id, a, z), tx = db.txns.filter(t => t.blockId === b.id && t.date >= a && t.date <= z).sort((x, y) => x.date.localeCompare(y.date));
    const y = Object.entries(f.yields).map(([u, q]) => `${fmt(q)} ${u}${u === 'kg' && num(b.areaHa) ? ` (${fmt(q / num(b.areaHa) / 1000)} t/ha)` : ''}`).join(', ');
    h += `<h2>Money (${ui.rcur})</h2><table><tr><th>Sales</th><th>Costs charged to field</th><th>Stock used</th><th>Margin</th></tr><tr><td>${esc(money(f.sales))}</td><td>${esc(money(f.costs))}</td><td>${esc(money(f.inputs))}</td><td><b>${esc(money(f.margin))}</b></td></tr></table>${y ? `<p>Sold: ${esc(y)}</p>` : ''}${f.missing ? '<p class="sub">Some stock used has no unit cost or some items have no exchange rate, so figures are understated.</p>' : ''}
    ${tx.length ? `<table><tr><th>Date</th><th>Item</th><th>Party</th><th>Amount</th></tr>${tx.map(t => `<tr><td>${fdy(t.date)}</td><td>${esc(txnTitle(t))}</td><td>${esc(t.party || '')}</td><td>${t.kind === 'income' ? '+' : '−'}${esc(money(t.amount, t.currency || 'USD'))}</td></tr>`).join('')}</table>` : ''}
    <p class="sub">Converted at the exchange rate stored on each transaction. Whole-farm overheads are not included.</p>`;
  }
  h += `<div class="foot">Prepared with Farm Manager from records kept on the farmer's phone. Rates, PHI and product details are as entered by the farmer — always follow the product label.</div>`;
  return h;
}
function vReport(id) {
  const b = blockById(id); if (!b || !rdraft) return vMissing();
  const r = rdraft, cyc = cycleRanges(b);
  const dt = (f, label) => `<div class="f"><label for="rp_${f}">${label}</label><input id="rp_${f}" type="date" data-rf="${f}" value="${esc(r[f])}"></div>`;
  const ck = (k, label) => `<label class="row" style="gap:10px;min-height:44px;font-size:14px"><input type="checkbox" class="check" data-rc="${k}" ${r[k] ? 'checked' : ''}>${label}</label>`;
  const scopes = [['all', 'Everything (whole history)'], ...(b.crop ? [['current', `Current crop — ${b.crop}`]] : []), ...cyc.slice().reverse().map(c => [c.id, `Past crop — ${c.crop || 'Fallow'} (${c.planted ? fd(c.planted) + ' – ' : ''}${fdy(c.ended)})`]), ['custom', 'Choose dates…']];
  return `<div class="noprint">${back(r.onlyIssue ? '#issue/' + r.onlyIssue : '#block/' + b.id, r.onlyIssue ? 'Problem' : b.name)}<h1>${r.onlyIssue ? 'Problem report' : 'Field report'}</h1>
  <div class="card">
    ${r.onlyIssue ? `<span class="s">One problem with its photos, follow-ups and treatments.</span>` : `<div class="f"><label for="rp_scope">Period</label><select id="rp_scope" data-rf="scope">${scopes.map(([v, l]) => `<option value="${esc(v)}" ${r.scope === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    ${r.scope === 'custom' ? `<div class="g2">${dt('from', 'From')}${dt('to', 'To')}</div>` : ''}
    <span class="lbl">Include</span>${ck('summary', 'Field summary &amp; spray programme')}${ck('health', 'Plant-health log (problems, follow-ups, treatments)')}${ck('records', 'All records (sprays, fertigation, irrigation, scouting…)')}${ck('money', 'Money (sales, costs, margin)')}`}
    ${r.onlyIssue ? '' : ''}<div class="f"><label for="rp_photos">Photos</label><select id="rp_photos" data-rf="photos"><option value="large" ${r.photos === 'large' ? 'selected' : ''}>Large (2 per row, best detail)</option><option value="small" ${r.photos === 'small' ? 'selected' : ''}>Small (4 per row, smaller file)</option><option value="none" ${r.photos === 'none' ? 'selected' : ''}>No photos</option></select></div>
    ${r.money ? curToggle() : ''}
    <button class="btn pri block" data-act="rprint">${ic('list', 18, 2)}Print / Save as PDF</button>
    <button class="btn block" data-act="rhtml">Download as web page (.html)</button>
    <span class="hint">In the print window choose <strong>Save as PDF</strong> as the printer, then Save. The web-page file opens in any browser and can be printed later or shared.</span>
  </div>
  <p class="sec">Preview</p></div>
  <div id="reportDoc" class="report">${reportHtml(b, r)}</div>`;
}
const waitImgs = async () => { await hydratePhotos(); await Promise.all([...document.querySelectorAll('#reportDoc img')].map(im => im.decode ? im.decode().catch(() => { }) : Promise.resolve())); };

/* ---------- router & render ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || 'today';
  const [path, qs] = h.split('?');
  return { parts: path.split('/'), q: new URLSearchParams(qs || '') };
}
function render(resetScroll) {
  const { parts, q } = route();
  const v = parts[0];
  if (v !== 'ai' && v !== 'settings') aiKey = null;
  if (v !== 'stockedit') sdraftKey = null;
  let html, tab = v;
  switch (v) {
    case 'today': html = vToday(); break;
    case 'fields': html = vFields(); break;
    case 'block': html = vBlock(parts[1]); tab = 'fields'; break;
    case 'season': html = vSeason(parts[1]); tab = 'fields'; break;
    case 'cycle': html = vCycle(parts[1], parts[2]); tab = 'fields'; break;
    case 'newcycle': {
      const b = blockById(parts[1]);
      if (ncdraftKey !== location.hash) { ncdraft = b ? initNC(b) : null; ncdraftKey = location.hash; }
      html = vNewCycle(parts[1]); tab = 'fields'; break;
    }
    case 'blockedit':
      if (bdraftKey !== location.hash) { bdraft = initBDraft(parts[1]); bdraftKey = location.hash; }
      html = vBlockEdit(); tab = 'fields'; break;
    case 'record':
      if (draftKey !== location.hash) { draft = initDraft(parts[1], q); draftKey = location.hash; }
      html = vRecord(); tab = 'records'; break;
    case 'records': html = vRecords(); break;
    case 'stock': html = vStock(); break;
    case 'stockedit': html = vStockEdit(parts[1]); tab = 'stock'; break;
    case 'power': html = vPower(); break;
    case 'money': html = vMoney(); break;
    case 'txn':
      if (tdraftKey !== location.hash) { tdraft = initTDraft(parts[1], q); tdraftKey = location.hash; }
      html = vTxn(); tab = 'money'; break;
    case 'debts': if (resetScroll && q.get('tab')) ui.dtab = q.get('tab') === 'pay' ? 'pay' : 'recv'; html = vDebts(); tab = 'money'; break;
    case 'reports': html = vReports(); tab = 'money'; break;
    case 'lists': html = vLists(); tab = 'today'; break;
    case 'ai':
      if (aiKey !== location.hash || !ai) { ai = freshAI(q); aiKey = location.hash; }
      html = vAI(); tab = 'today'; break;
    case 'list':
      if (ldraftKey !== location.hash) { ldraft = initLDraft(parts[1]); ldraftKey = location.hash; }
      html = vListEdit(parts[1]); tab = 'today'; break;
    case 'settings': html = vSettings(); tab = 'today'; break;
    case 'aiset': html = vAISet(); tab = 'today'; break;
    case 'aiprov': html = vAIProv(parts[1]); tab = 'today'; break;
    case 'aiusage': html = vAIUsage(); tab = 'today'; break;
    case 'health': if (resetScroll) ui.hblock = q.get('block') || ''; html = vHealth(); tab = 'fields'; break;
    case 'issue': html = vIssue(parts[1]); tab = 'fields'; break;
    case 'issueedit':
      if (idraftKey !== location.hash) { idraft = initIDraft(parts[1], q); idraftKey = location.hash; }
      html = vIssueEdit(); tab = 'fields'; break;
    case 'followup':
      if (udraftKey !== location.hash) { udraft = initUDraft(parts[1], parts[2]); udraftKey = location.hash; }
      html = vFollowup(); tab = 'fields'; break;
    case 'report':
      if (rdraftKey !== location.hash) { const rb = blockById(parts[1]); rdraft = rb ? initRDraft(rb, q) : null; rdraftKey = location.hash; }
      html = vReport(parts[1]); tab = 'fields'; break;
    default: html = vToday(); tab = 'today';
  }
  const t = [['today', 'Today', 'sun'], ['fields', 'Fields', 'leaf'], ['records', 'Records', 'list'], ['stock', 'Stock', 'box'], ['money', 'Money', 'coin'], ['power', 'Power', 'bolt']];
  app.innerHTML = `<main>${html}</main><nav class="tabs" aria-label="Main">${t.map(([k, l, i]) => `<a href="#${k}" class="${tab === k ? 'on' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${ic(i)}${l}</a>`).join('')}</nav>`;
  if (resetScroll) window.scrollTo(0, 0);
  hydratePhotos();
  if (v === 'settings') {
    const pi = document.getElementById('photoinfo');
    if (pi) PH.stats().then(x => { pi.textContent = x.n ? `${x.n} photo${x.n > 1 ? 's' : ''} stored on this phone (about ${Math.max(1, Math.round(x.bytes / 1048576))} MB).` : 'No photos stored yet.'; });
    const el = document.getElementById('persist');
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { el.textContent = p ? 'Storage is protected: the browser will not clear it on its own.' : 'Storage is not yet protected. Installing the app to the home screen usually fixes this. Keep backups.'; }).catch(() => { el.textContent = ''; });
    else el.textContent = '';
  }
}
window.addEventListener('hashchange', () => render(true));

/* ---------- actions ---------- */
const go = h => { location.hash = h; };
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const ACTS = {
  period: el => { ui[el.dataset.k] = el.dataset.v; render(); },
  dact: el => { draft.type = 'activity'; draft.activity = el.dataset.v; draft.lines = []; render(); },
  newact: async () => { const n = await askText('New activity type', 'e.g. Staking'); if (!n) return; if (!L('activities').some(a => a.toLowerCase() === n.toLowerCase())) { db.lists.activities.push(n); save(); } draft.type = 'activity'; draft.activity = L('activities').find(a => a.toLowerCase() === n.toLowerCase()); draft.lines = []; render(); },
  lup: el => { const i = +el.dataset.i; if (i > 0) { [ldraft[i - 1], ldraft[i]] = [ldraft[i], ldraft[i - 1]]; render(); } },
  ldel: async el => {
    const key = route().parts[1], it = ldraft[+el.dataset.i];
    const used = it.orig ? usageCount(key, it.orig, it.id) : 0;
    if (used && !await ask(`"${it.name}" is used ${used} time(s). Remove it from the list? Existing records keep it; it just won't be offered for new entries.`, 'Remove')) return;
    if (key === 'stockCats' && used) return toast('Move those stock items to another category first.');
    ldraft.splice(+el.dataset.i, 1); render();
  },
  ladd: () => {
    const key = route().parts[1], n = val('lnew');
    if (!n) return toast('Type a name first.');
    if (ldraft.some(x => x.name.trim().toLowerCase() === n.toLowerCase())) return toast('Already in the list.');
    if (key === 'incomeCats') ldraft.push({ name: n, sale: false, orig: '' });
    else if (key === 'stockCats') ldraft.push({ id: 'c' + uid(), name: n, use: 'spray', expCat: L('expenseCats').includes('Crop protection') ? 'Crop protection' : L('expenseCats')[0], orig: '' });
    else ldraft.push({ name: n, orig: '' });
    render(); const i = document.getElementById('lnew'); if (i) i.focus();
  },
  lsave: () => {
    const key = route().parts[1];
    const names = ldraft.map(x => String(x.name).trim());
    if (names.some(n => !n)) return toast('Every item needs a name.');
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return toast('Two items have the same name.');
    if (key === 'incomeCats' && !ldraft.some(x => x.sale)) toast('Note: no category is marked "Sale with quantity".');
    if (key !== 'stockCats') ldraft.forEach(x => applyRename(key, x.orig, String(x.name).trim()));
    db.lists[key] = ldraft.map(x => {
      const name = String(x.name).trim();
      if (key === 'incomeCats') return { name, sale: !!x.sale };
      if (key === 'stockCats') return { id: x.id, name, use: x.use || 'none', expCat: x.expCat || 'Other expense' };
      return name;
    });
    save(); ldraftKey = null; toast('List saved'); go('#lists');
  },
  rcur: el => { ui.rcur = el.dataset.v; render(); },
  raterow: () => { ui.rateOpen = true; render(); setTimeout(() => { const i = document.getElementById('rate_new'); if (i) i.focus(); }, 0); },
  saverate: () => {
    const r = num(val('rate_new'));
    if (!(r > 0)) return toast('Enter how many shillings 1 USD buys.');
    const lr = latestRate();
    if (lr && (r > num(lr.rate) * 1.5 || r < num(lr.rate) / 1.5)) toast('Saved — note this is far from the last rate. Check for a typo.');
    else toast('Rate saved');
    saveRate(today(), r); ui.rateOpen = false; save(); render();
  },
  delrate: async el => { if (!await ask('Delete this rate entry? Transactions keep the rate already stored on them.', 'Delete')) return; db.rates = db.rates.filter(r => r.id !== el.dataset.id); save(); render(); },
  tcur: el => { tdraft.currency = el.dataset.v; render(); },
  dtab: el => { ui.dtab = el.dataset.v; render(); },
  csv: () => { try { exportCSV(); } catch (e) { toast('Could not create the file on this device.'); } },
  tback: () => { tdraftKey = null; if (history.length > 1) history.back(); else go('#money'); },
  tkind: el => { tdraft.kind = el.dataset.v; tdraft.category = el.dataset.v === 'income' ? firstSaleCat() : defaultExp(); if (!tdraft.id) tdraft.currency = el.dataset.v === 'income' ? (db.settings.saleCur || 'SLSH') : (db.settings.buyCur || 'USD'); render(); },
  tcredit: el => { tdraft.credit = el.dataset.v === '1'; render(); },
  addpay: () => {
    const a = num(val('pay_amt'));
    if (!(a > 0)) return toast('Enter the payment amount.');
    if (a > num(tdraft.amount) - paidOf(tdraft) + 0.005) return toast('Payment is more than the balance.');
    tdraft.payments = tdraft.payments || [];
    tdraft.payments.push({ id: uid(), date: val('pay_date') || today(), amount: a, method: val('pay_method') });
    render();
  },
  delpay: el => { tdraft.payments.splice(+el.dataset.i, 1); render(); },
  savetxn: () => {
    const d = JSON.parse(JSON.stringify(tdraft));
    if (!d.date) return toast('Enter a date.');
    d.currency = d.currency === 'SLSH' ? 'SLSH' : 'USD';
    d.amount = roundC(num(d.amount), d.currency);
    if (!(d.amount > 0)) return toast('Enter the amount.');
    d.rate = num(d.rate) > 0 ? num(d.rate) : '';
    if (d.currency === 'SLSH' && !d.rate) return toast('Enter the exchange rate for this shilling transaction.');
    delete d.rateManual;
    if (!d.credit) { d.payments = []; d.due = ''; }
    else if (paidOf(d) > d.amount + 0.005) return toast('Payments add up to more than the amount.');
    if (!isSaleCat(d.category)) { d.qty = ''; d.price = ''; d.crop = ''; }
    if (d.id) { const i = db.txns.findIndex(t => t.id === d.id); db.txns[i] = d; } else { d.id = uid(); d.created = Date.now(); db.txns.push(d); }
    save(); tdraftKey = null; toast('Saved'); go('#money');
  },
  deltxn: async () => {
    if (!await ask('Delete this transaction? This cannot be undone.', 'Delete')) return;
    db.txns = db.txns.filter(t => t.id !== tdraft.id); save(); tdraftKey = null; toast('Transaction deleted'); go('#money');
  },
  goback: () => { draftKey = null; if (history.length > 1) history.back(); else go('#records'); },
  extend: async el => {
    const r = db.records.find(x => x.id === el.dataset.id); if (!r) return;
    const x = await askExtend(r); if (!x) return;
    r.extLog = r.extLog || []; r.extLog.push({ on: today(), from: recEnd(r), to: x.to, why: x.why });
    r.endDate = x.to; save(); toast(`Extended to ${fd(x.to)} · ${recDays(r)} days in total`); render();
  },
  bfilter: el => { ui.bfilter = el.dataset.v; render(); },
  bscope: el => { ui.bscope = el.dataset.v; render(); },
  ncnext: el => { ncdraft.next = el.dataset.v; render(); },
  ncsave: async () => {
    const b = blockById(route().parts[1]), d = ncdraft;
    if (!b || !d) return;
    const hasCrop = !!b.crop;
    if (hasCrop) {
      if (!d.ended) return toast('Enter when the crop ended.');
      if (b.planted && d.ended < b.planted) return toast('End date is before the planting date.');
      if (d.ended > today()) return toast('The end date cannot be in the future.');
    }
    if (d.next === 'plant') {
      if (!d.crop) return toast('Choose the new crop.');
      if (!d.planted) return toast('Enter the planting date.');
      if (hasCrop && d.planted <= d.ended) return toast('Plant the new crop after the old one ended (the next day at the earliest).');
    }
    const open = db.records.filter(r => r.blockId === b.id && r.status === 'planned');
    if (hasCrop && open.length && await ask(`${open.length} planned record(s) are still open on ${b.name} (e.g. ${recTitle(open[0])}). Delete them? Choose Cancel to keep them.`, 'Delete them')) {
      const ids = new Set(open.map(r => r.id)); db.records = db.records.filter(r => !ids.has(r.id));
    }
    const prevStages = b.stages || [];
    if (hasCrop) {
      b.history = b.history || [];
      b.history.push({ id: uid(), crop: b.crop, variety: b.variety, planted: b.planted, ended: d.ended, from: b.cycleFrom || '', cycleDays: b.cycleDays, stages: JSON.parse(JSON.stringify(prevStages)), notes: b.notes || '' });
      b.cycleFrom = addDays(d.ended, 1);
    }
    if (d.next === 'plant') {
      b.crop = d.crop; b.variety = d.variety; b.planted = d.planted; b.cycleDays = d.cycleDays === '' ? '' : num(d.cycleDays); b.status = 'active';
      b.stages = d.stagesMode === 'same' ? JSON.parse(JSON.stringify(prevStages)) : d.stagesMode === 'tomato' ? tomatoStages() : d.stagesMode === 'generic' ? genericStages(d.cycleDays || 100) : [];
      if (d.stagesMode === 'tomato' && !num(b.cycleDays)) b.cycleDays = 120;
    } else { b.crop = ''; b.variety = ''; b.planted = ''; b.cycleDays = ''; b.stages = []; b.status = 'fallow'; }
    b.notes = d.notes || '';
    ui.bscope = 'current';
    save(); ncdraftKey = null; toast(d.next === 'plant' ? `${b.name}: ${b.crop} started` : `${b.name} is now fallow`); go('#block/' + b.id);
  },
  rfilter: el => { ui.rfilter = el.dataset.v; render(); },
  cat: el => { ui.cat = el.dataset.v; render(); },
  dtype: el => { draft.type = el.dataset.v; draft.lines = []; ensureLines(draft); render(); },
  dstatus: el => { draft.status = el.dataset.v; render(); },
  aline: () => { draft.lines.push({ stockId: '', amount: '', basis: draft.type === 'spray' ? 'ha' : 'total' }); render(); },
  dline: el => { draft.lines.splice(+el.dataset.i, 1); render(); },
  saverec: async () => {
    const d = draft;
    if (!d.date) return toast('Enter a date.');
    if (d.endDate && d.endDate < d.date) return toast('The last day is before the first day.');
    if (d.endDate === d.date) d.endDate = '';
    if (d.status === 'done' && !d.doneOn) d.doneOn = today();
    if (!(d.type === 'task' || d.type === 'other' || d.type === 'activity') && !d.blockId) return toast('Choose a block.');
    if ((d.type === 'task' || d.type === 'other') && !d.title.trim()) return toast('Describe the task.');
    const rec = JSON.parse(JSON.stringify(d));
    rec.lines = (rec.lines || []).filter(l => l.stockId);
    if (rec.type === 'spray' || rec.type === 'fertigation') {
      const missing = rec.lines.filter(l => !num(l.amount)).length;
      if (!rec.lines.length && rec.status === 'done') return toast('Choose at least one product.');
      if (missing && rec.status === 'done' && !await ask(`${missing} product amount(s) are blank, so stock will not be deducted for them. Save anyway?`)) return;
    }
    if (rec.id) {
      const i = db.records.findIndex(r => r.id === rec.id);
      const old = db.records[i];
      if (old.status === 'done') restore(old);
      rec.used = null;
      if (rec.status === 'done') deduct(rec);
      db.records[i] = rec;
    } else {
      rec.id = uid(); rec.created = Date.now(); rec.used = null;
      if (rec.status === 'done') deduct(rec);
      db.records.push(rec);
    }
    if (rec.type === 'spray' && num(rec.tankL)) db.settings.tankL = rec.tankL;
    save(); draftKey = null; toast(rec.status === 'done' ? 'Saved as done' + (rec.used && rec.used.length ? ' · stock updated' : '') : 'Saved as planned');
    go(rec.blockId ? '#block/' + rec.blockId : '#records');
  },
  delrec: async () => {
    if (!await ask('Delete this record? Any stock it used will be added back.')) return;
    const i = db.records.findIndex(r => r.id === draft.id);
    if (i >= 0) { restore(db.records[i]); db.records.splice(i, 1); save(); }
    draftKey = null; toast('Record deleted'); history.back();
  },
  tpl: async el => {
    if (bdraft.stages.length && !await ask('Replace the current stages?')) return;
    bdraft.stages = el.dataset.v === 'tomato' ? tomatoStages() : genericStages(bdraft.cycleDays);
    if (el.dataset.v === 'tomato' && !num(bdraft.cycleDays)) bdraft.cycleDays = 120;
    render();
  },
  addstage: () => { const last = bdraft.stages[bdraft.stages.length - 1]; const s = last ? num(last.end) + 1 : 0; bdraft.stages.push({ name: '', start: s, end: s + 20, nutrition: '', watch: '' }); render(); },
  delstage: el => { bdraft.stages.splice(+el.dataset.i, 1); render(); },
  saveblock: () => {
    const d = bdraft;
    if (!d.name.trim()) return toast('Give the block a name.');
    if (!(num(d.areaHa) > 0)) return toast('Enter the block area in hectares.');
    const bad = d.stages.find(s => !String(s.name).trim() || num(s.end) < num(s.start));
    if (bad) return toast('Each stage needs a name and an end day after its start day.');
    const b = JSON.parse(JSON.stringify(d));
    b.areaHa = num(b.areaHa); b.cycleDays = b.cycleDays === '' ? '' : num(b.cycleDays);
    b.stages = b.stages.map(s => ({ ...s, start: num(s.start), end: num(s.end) })).sort((a, c) => a.start - c.start);
    if (b.id) { const i = db.blocks.findIndex(x => x.id === b.id); db.blocks[i] = b; } else { b.id = uid(); db.blocks.push(b); }
    save(); bdraftKey = null; toast('Block saved'); go('#block/' + b.id);
  },
  delblock: async () => {
    const n = db.records.filter(r => r.blockId === bdraft.id).length;
    const ni = (db.issues || []).filter(i => i.blockId === bdraft.id).length;
    if (!await ask(`Delete ${bdraft.name}${n || ni ? ` and its ${n} records${ni ? ` and ${ni} plant-health problem${ni > 1 ? 's' : ''} with photos` : ''}` : ''}? This cannot be undone.`)) return;
    db.records = db.records.filter(r => r.blockId !== bdraft.id);
    for (const i of (db.issues || []).filter(x => x.blockId === bdraft.id)) for (const pid of issuePhotoIds(i)) await PH.del(pid);
    db.issues = (db.issues || []).filter(i => i.blockId !== bdraft.id);
    db.blocks = db.blocks.filter(b => b.id !== bdraft.id);
    save(); bdraftKey = null; toast('Block deleted'); go('#fields');
  },
  savestock: () => {
    const form = document.getElementById('stockform'), id = form.dataset.id;
    const s = { name: val('s_name'), category: val('s_category'), group: val('s_group'), ai: val('s_ai'), qty: num(val('s_qty')), unit: val('s_unit'), reorderAt: val('s_reorderAt') === '' ? '' : num(val('s_reorderAt')), expiry: val('s_expiry'), phiDays: val('s_phiDays'), reiHours: val('s_reiHours'), label: val('s_label'), costPerUnit: val('s_costPerUnit') === '' ? '' : num(val('s_costPerUnit')), notes: val('s_notes') };
    if (!s.name) return toast('Enter the product name.');
    if (sdraft) { s.labelPhotos = sdraft.photos.slice(); sdraft.removed.forEach(x => PH.del(x)); }
    if (id) Object.assign(stockById(id), s); else db.stock.push({ id: uid(), ...s });
    sdraftKey = null; save(); toast('Stock item saved'); go('#stock');
  },
  recvstock: () => {
    const s = stockById(document.getElementById('stockform').dataset.id), a = num(val('s_recv'));
    if (!(a > 0)) return toast('Enter the amount received.');
    s.qty = r2(num(s.qty) + a);
    const cost = num(val('s_rcost')), rc = val('s_rcur') || 'USD', rr = rateOn(today());
    if (cost > 0 && rc === 'SLSH' && !(rr > 0)) { s.qty = r2(num(s.qty) - a); return toast('Set the exchange rate on the Money screen first.'); }
    if (cost > 0) {
      const pay = val('s_rpay');
      db.txns.push({ id: uid(), created: Date.now(), currency: rc, rate: rr || '', kind: 'expense', category: (stockCat(s.category) || {}).expCat || 'Other expense', date: today(), amount: rc === 'SLSH' ? Math.round(cost) : Math.round(cost * 100) / 100, party: val('s_rsup'), method: pay === 'credit' ? 'Cash' : pay, blockId: '', crop: '', qty: '', unit: 'kg', price: '', credit: pay === 'credit', due: '', payments: [], notes: `${fmt(a)} ${s.unit} ${s.name}`, stockId: s.id });
      s.costPerUnit = r2(conv(cost, rc, 'USD', rr) / a);
    }
    save(); toast(`Added ${fmt(a)} ${s.unit}` + (cost > 0 ? ' · expense recorded' : '')); render();
  },
  delstock: async () => {
    const id = document.getElementById('stockform').dataset.id;
    const used = db.records.some(r => (r.lines || []).some(l => l.stockId === id));
    if (!await ask(used ? 'This product appears in records. Delete it anyway? Those records will show no product name.' : 'Delete this stock item?')) return;
    ((stockById(id) || {}).labelPhotos || []).forEach(x => PH.del(x)); if (sdraft) sdraft.fresh.forEach(x => PH.del(x));
    db.stock = db.stock.filter(s => s.id !== id); sdraftKey = null; save(); toast('Item deleted'); go('#stock');
  },
  savepower: () => {
    const date = val('p_date'); if (!date) return toast('Enter a date.');
    const e = { date, pvKwh: val('p_pv'), m3: val('p_m3'), tankPct: val('p_tank'), notes: val('p_notes') };
    if (e.pvKwh === '' && e.m3 === '' && e.tankPct === '') return toast('Enter at least one reading.');
    const ex = db.power.find(p => p.date === date);
    if (ex) Object.assign(ex, e); else db.power.push({ id: uid(), ...e });
    save(); toast('Log saved'); render();
  },
  delpower: async el => { if (!await ask('Delete this log?')) return; db.power = db.power.filter(p => p.id !== el.dataset.id); save(); render(); },
  savesettings: () => { db.settings.farmName = val('set_name') || 'My farm'; db.settings.location = val('set_loc'); db.settings.tankL = val('set_tank'); db.settings.saleCur = val('set_sale'); db.settings.buyCur = val('set_buy'); db.settings.repCur = val('set_rep'); ui.rcur = db.settings.repCur; save(); toast('Settings saved'); render(); },
  export: () => doExport(true),
  exportlite: () => doExport(false),
  install: async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { } installEvt = null; render(); },
  loadsample: async () => { if (!await ask('Replace everything on this phone with sample data? Photos stored on this phone are removed too.')) return; await PH.clear(); const keepAI = { ai: db.settings.ai, aiMode: db.settings.aiMode }, keepU = db.aiUsage; db = sampleData(); Object.assign(db.settings, keepAI); db.aiUsage = keepU || []; normalize(db); save(); toast('Sample data loaded'); go('#today'); },
  clearall: async () => {
    if (!await ask(db.settings.sample ? 'Clear the sample data and start with an empty farm?' : 'Erase ALL records on this phone? Export a backup first if you need them.')) return;
    const name = db.settings.sample ? 'My farm' : db.settings.farmName;
    await PH.clear();
    const keepAI = { ai: db.settings.ai, aiMode: db.settings.aiMode }, keepU = db.aiUsage;
    db = blank(); db.settings.farmName = name; Object.assign(db.settings, keepAI); db.aiUsage = keepU || []; save(); toast('Data cleared'); go('#settings'); render();
  }
};
/* ---------- plant health actions ---------- */
const toFile = (b64, name) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return new File([u], name, { type: 'image/jpeg' }); };
async function doExport(withPhotos) {
  try {
    toast(withPhotos ? 'Preparing backup with photos…' : 'Preparing backup…');
    const photos = withPhotos ? await PH.all() : [];
    const out = Object.assign({}, db, { photos });
    const blob = new Blob([photos.length ? JSON.stringify(out) : JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `farm-backup-${today()}${withPhotos ? '' : '-no-photos'}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    db.settings.lastBackup = today(); save(); toast(photos.length ? `Backup downloaded with ${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'Backup file downloaded'); render();
  } catch (e) { toast('Could not create the file on this device.'); }
}
async function dropNew(d) { if (d) for (const id of d.newPhotos || []) await PH.del(id); }
Object.assign(ACTS, {
  photo: el => openPhoto(el.dataset.pid, el.dataset.cap),
  hfilter: el => { ui.hfilter = el.dataset.v; render(); },
  istatus: el => {
    const i = issueById(el.dataset.id); if (!i) return;
    i.status = el.dataset.v;
    if (i.status === 'resolved') i.resolvedOn = i.resolvedOn || today(); else i.resolvedOn = '';
    save(); render(); if (i.status === 'resolved') toast('Marked resolved today. Edit the problem to set the outcome.');
  },
  /* --- problem form --- */
  idsev: el => { idraft.severity = el.dataset.v; render(); },
  idstat: el => { idraft.status = el.dataset.v; if (idraft.status === 'resolved' && !idraft.resolvedOn) idraft.resolvedOn = today(); render(); },
  phdel: async el => {
    const d = route().parts[0] === 'followup' ? udraft : idraft; if (!d) return;
    const id = el.dataset.pid; d.photos = d.photos.filter(x => x !== id);
    if ((d.newPhotos || []).includes(id)) { d.newPhotos = d.newPhotos.filter(x => x !== id); await PH.del(id); } else (d.removed = d.removed || []).push(id);
    render();
  },
  icancel: async () => { await dropNew(idraft); idraftKey = null; if (history.length > 1) history.back(); else go('#health'); },
  isave: async () => {
    const d = idraft; if (!d) return;
    if (!d.blockId) return toast('Choose the field or block.');
    if (!d.date) return toast('Enter the date you noticed it.');
    if (d.status === 'resolved' && !d.resolvedOn) d.resolvedOn = today();
    if (d.status === 'resolved' && d.resolvedOn < d.date) return toast('The resolved date is before the date noticed.');
    const rec = JSON.parse(JSON.stringify(d)); delete rec.newPhotos; delete rec.removed;
    rec.spread = rec.spread === '' || rec.spread == null ? '' : Math.max(0, Math.min(100, num(rec.spread)));
    rec.snap = snapFor(blockById(rec.blockId), rec.date);
    if (rec.status !== 'resolved') rec.resolvedOn = '';
    ['issueKinds:kind', 'issueNames:name'].forEach(x => { const [k, f] = x.split(':'); const v = (rec[f] || '').trim(); rec[f] = v; if (v && !L(k).some(n => n.toLowerCase() === v.toLowerCase())) db.lists[k].push(v); });
    db.issues = db.issues || [];
    if (rec.id) { const i = db.issues.findIndex(x => x.id === rec.id); if (i < 0) return; rec.updates = db.issues[i].updates || []; rec.created = db.issues[i].created; db.issues[i] = rec; }
    else { rec.id = uid(); rec.created = Date.now(); db.issues.push(rec); }
    for (const id of d.removed || []) await PH.del(id);
    save(); idraftKey = null; toast('Problem saved'); go('#issue/' + rec.id);
  },
  idel: async () => {
    const d = idraft, i = d && issueById(d.id); if (!i) return;
    if (!await ask(`Delete "${issueName(i)}" with its ${issuePhotoIds(i).length} photo(s) and follow-ups? This cannot be undone.`, 'Delete')) return;
    for (const id of issuePhotoIds(i)) await PH.del(id);
    for (const id of d.newPhotos || []) await PH.del(id);
    db.records.forEach(r => { if (r.issueId === i.id) r.issueId = ''; });
    db.issues = db.issues.filter(x => x.id !== i.id); save(); idraftKey = null; toast('Problem deleted'); go('#health');
  },
  /* --- follow-up form --- */
  usev: el => { udraft.severity = udraft.severity === el.dataset.v ? '' : el.dataset.v; render(); },
  ustat: el => { udraft.status = el.dataset.v; render(); },
  ucancel: async () => { await dropNew(udraft); udraftKey = null; if (history.length > 1) history.back(); else go('#health'); },
  usave: async () => {
    const d = udraft, i = d && issueById(d.issueId); if (!i) return;
    if (!d.date) return toast('Enter a date.');
    if (!d.severity && !d.note.trim() && !d.photos.length && d.spread === '') return toast('Add a note, a photo or the severity.');
    const u = JSON.parse(JSON.stringify(d)); delete u.newPhotos; delete u.removed; delete u.issueId;
    u.spread = u.spread === '' || u.spread == null ? '' : Math.max(0, Math.min(100, num(u.spread)));
    i.updates = i.updates || [];
    if (u.id) { const k = i.updates.findIndex(x => x.id === u.id); if (k >= 0) { u.created = i.updates[k].created; i.updates[k] = u; } }
    else { u.id = uid(); u.created = Date.now(); i.updates.push(u); }
    if (updSorted(i).filter(x => !x.advice).pop() === i.updates.find(x => x.id === u.id) || updSorted(i).pop().id === u.id) {
      if (!u.advice) { i.status = u.status; if (u.status === 'resolved') i.resolvedOn = i.resolvedOn || u.date; else i.resolvedOn = ''; }
    }
    for (const id of d.removed || []) await PH.del(id);
    save(); udraftKey = null; toast('Follow-up saved'); go('#issue/' + i.id);
  },
  udel: async () => {
    const d = udraft, i = d && issueById(d.issueId); if (!i) return;
    if (!await ask('Delete this follow-up and its photos?', 'Delete')) return;
    const u = i.updates.find(x => x.id === d.id);
    for (const id of (u && u.photos) || []) await PH.del(id);
    for (const id of d.newPhotos || []) await PH.del(id);
    i.updates = i.updates.filter(x => x.id !== d.id); save(); udraftKey = null; toast('Follow-up deleted'); go('#issue/' + i.id);
  },
  /* --- report --- */
  rprint: async () => {
    const b = blockById(route().parts[1]); toast('Preparing the report…');
    await waitImgs();
    const old = document.title; document.title = `${b ? b.name : 'Field'} ${rdraft && rdraft.onlyIssue ? 'problem' : 'field'} report ${today()}`;
    const back_ = () => { document.title = old; window.removeEventListener('afterprint', back_); };
    window.addEventListener('afterprint', back_);
    try { window.print(); } catch (e) { back_(); toast('Printing is not available here. Use "Download as web page" instead.'); }
  },
  rhtml: async () => {
    const b = blockById(route().parts[1]); await waitImgs();
    const doc = document.getElementById('reportDoc'); if (!doc) return;
    const title = `${b ? b.name : 'Field'} report ${today()}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;background:#F5F6F2;padding:12px}${REPORT_CSS}</style></head><body>${doc.outerHTML}</body></html>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = `farm-report-${(b ? b.name : 'field').replace(/[^\w-]+/g, '-')}-${today()}.html`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); toast('Report file downloaded');
  },
  /* --- Ask AI <-> problem log --- */
  issueask: async el => {
    const i = issueById(el.dataset.id); if (!i) return;
    const a = freshAI(null); a.blockId = i.blockId; a.issueId = i.id; a.kind = 'diagnose';
    a.symptoms = [i.name ? 'Recorded as: ' + i.name + (i.kind ? ' (' + i.kind + ')' : '') : '', i.symptoms, i.where ? 'Where: ' + i.where : '', i.conditions ? 'Conditions: ' + i.conditions : '', i.cause ? 'I suspect: ' + i.cause : ''].filter(Boolean).join('\n');
    const ids = [...updSorted(i).reverse().flatMap(u => u.photos || []), ...(i.photos || [])].slice(0, 4);
    for (const id of ids) { const r = await PH.get(id); if (r) { const b64 = r.full.split(',')[1]; a.photos.push({ dataUrl: r.full, b64, file: toFile(b64, 'problem-photo.jpg') }); } }
    ai = a; aiKey = '#ai?issue=' + i.id; go('#ai?issue=' + i.id);
  },
  aiissue: () => {
    const i = issueById(ai.issueId); if (!i) return toast('That problem no longer exists.');
    const ans = ai.msgs.filter(m => m.role === 'assistant').map(m => m.text).join('\n\n---\n\n');
    i.updates = i.updates || []; i.updates.push({ id: uid(), created: Date.now(), date: today(), severity: '', spread: '', status: i.status, note: 'AI advice:\n' + ans, photos: [], advice: true });
    save(); toast('Advice added to the problem'); go('#issue/' + i.id);
  },
  ailog: async () => {
    const found = await askText('Name of the problem (e.g. Early blight)'); if (!found) return;
    const ans = ai.msgs.filter(m => m.role === 'assistant').map(m => m.text).join('\n\n---\n\n');
    const ids = [];
    for (const p of ai.photos) { try { const x = await procPhoto(p.file); const id = 'ph' + uid(); await PH.put({ id, full: x.full, thumb: x.thumb, created: Date.now() }); ids.push(id); } catch (e) { } }
    const d = initIDraft('new', new URLSearchParams()); d.blockId = ai.blockId || d.blockId; d.name = found; d.symptoms = ai.symptoms.trim(); d.photos = ids; d.newPhotos = ids.slice();
    d.updates = [{ id: uid(), created: Date.now(), date: today(), severity: '', spread: '', status: 'active', note: 'AI advice:\n' + ans, photos: [], advice: true }];
    idraft = d; idraftKey = '#issueedit/new?from=ai'; go('#issueedit/new?from=ai');
  }
});
/* ---------- stock label photos: keep the label, let the AI transcribe it once ---------- */
let sdraft = null, sdraftKey = null;
const LABEL_SYS = 'You transcribe agricultural product labels (pesticides, fertilisers, seeds). Report only what is printed and legible in the photos. Never fill a gap from memory or general knowledge. Use null for anything not shown or not legible. Reply with one JSON object and nothing else.';
const LABEL_PROMPT = 'Read this product label and return JSON with exactly these keys: "product_name", "active_ingredient" (with concentration or analysis, as printed), "moa_group" (IRAC / FRAC / HRAC group exactly as printed, else null), "formulation", "registered_crops" (text), "rates" (text, with units and crop where given), "phi" (text: pre-harvest interval per crop as printed), "phi_days" (a number only if the label gives one single PHI, else null), "rei_hours" (number, else null), "max_applications" (text), "mixing_and_warnings" (short text), "expiry_date" (YYYY-MM-DD only if a full date is printed, else null), "batch" , "not_legible" (text listing important parts you could not read).';
function labelStrip() {
  const d = sdraft, x14 = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const tiles = d.photos.map((id, k) => `<div style="position:relative;width:88px;height:88px;flex:none"><button type="button" class="ph" data-act="photo" data-pid="${esc(id)}" data-cap="Product label" aria-label="Open label photo ${k + 1}" style="width:88px;height:88px">${phImg(id, 'thumb', 'Label photo ' + (k + 1))}</button><button type="button" class="ib" data-act="labeldel" data-pid="${esc(id)}" aria-label="Remove label photo ${k + 1}" style="position:absolute;top:-8px;right:-8px;width:32px;height:32px;border-radius:50%;background:#fff">${x14}</button></div>`).join('');
  const add = d.photos.length < 3 ? `<label for="sl_cam" class="btn" style="width:88px;height:88px;flex-direction:column;gap:4px;font-size:12px;padding:0;flex:none">${ic('plus', 20, 2)}Camera</label><label for="sl_gal" class="btn" style="width:88px;height:88px;flex-direction:column;gap:4px;font-size:12px;padding:0;flex:none">${ic('plus', 20, 2)}Gallery</label>` : '';
  return `<div class="row" style="gap:12px">${tiles}${add}</div><input id="sl_cam" type="file" accept="image/*" capture="environment" class="sr"><input id="sl_gal" type="file" accept="image/*" multiple class="sr">
    ${d.photos.length ? `<button type="button" class="btn" data-act="labelread">${ic('search', 18, 2)}Read the label with AI and fill in this form</button>` : ''}
    <span class="hint">Photograph the label flat, in good light, close enough that the small print is sharp: the front, and the panel with crops, rates and PHI. Up to 3 photos, kept on this phone and in backups.</span>`;
}
function labelCard(s) {
  if (sdraftKey !== location.hash) { sdraft = { photos: [...(s.labelPhotos || [])], fresh: [], removed: [] }; sdraftKey = location.hash; }
  return `<div class="f"><span class="lbl">Label photos</span><div id="s_photos" class="col" style="gap:10px">${labelStrip()}</div><div id="s_readout"></div></div>`;
}
function redrawLabel() { const c = document.getElementById('s_photos'); if (c) { c.innerHTML = labelStrip(); hydratePhotos(); } }
async function addLabelPhotos(files) {
  let bad = 0;
  for (const f of files) {
    if (sdraft.photos.length >= 3) { toast('Up to 3 label photos.'); break; }
    try { const p = await procPhoto(f, 1800, 0.82); const id = 'ph' + uid(); await PH.put({ id, full: p.full, thumb: p.thumb, created: Date.now() }); sdraft.photos.push(id); sdraft.fresh.push(id); }
    catch (e) { if (e && e.name === 'QuotaExceededError') { toast('This phone has no space left for photos.'); break; } bad++; }
  }
  if (bad) toast('A photo could not be read.');
  redrawLabel();
}
function fillFromLabel(j) {
  const t = v => v == null ? '' : String(v).trim(), kept = [], filled = [];
  const put = (id, v, label) => { const el = document.getElementById(id); v = t(v); if (!el || !v) return; if (el.value.trim() && el.value.trim() !== v) { kept.push(label); return; } el.value = v; el.style.outline = '2px solid var(--warn)'; filled.push(label); };
  put('s_name', j.product_name, 'name'); put('s_ai', [t(j.active_ingredient), t(j.formulation)].filter(Boolean).join(' '), 'active ingredient'); put('s_group', j.moa_group, 'group');
  if (j.phi_days != null && !isNaN(+j.phi_days)) put('s_phiDays', +j.phi_days, 'PHI'); if (j.rei_hours != null && !isNaN(+j.rei_hours)) put('s_reiHours', +j.rei_hours, 'REI');
  if (/^\d{4}-\d{2}-\d{2}$/.test(t(j.expiry_date))) put('s_expiry', j.expiry_date, 'expiry');
  const notes = [['Registered crops', j.registered_crops], ['Rates', j.rates], ['PHI', j.phi], ['Maximum applications', j.max_applications], ['Mixing and warnings', j.mixing_and_warnings], ['Batch', j.batch], ['Could not be read', j.not_legible]].filter(x => t(x[1])).map(x => `${x[0]}: ${t(x[1])}`).join('\n');
  const lb = document.getElementById('s_label');
  if (lb && notes) { lb.value = (lb.value.trim() ? lb.value.trim() + '\n\n' : '') + `[Read from the label photo by AI on ${fdy(today())}]\n` + notes; lb.style.outline = '2px solid var(--warn)'; lb.style.minHeight = '220px'; filled.push('label notes'); }
  const out = document.getElementById('s_readout');
  if (out) out.innerHTML = alertH('', 'warn', filled.length ? 'Filled in from the label photo — check before saving' : 'Nothing new could be read from the photo', (filled.length ? `Outlined fields were read by AI: ${filled.join(', ')}. Compare each one with the label, correct any mistake, then tap Save item.` : 'Try a sharper, closer photo.') + (kept.length ? ` Your existing ${kept.join(', ')} ${kept.length > 1 ? 'were' : 'was'} left unchanged because the AI read something different.` : '') + (t(j.not_legible) ? ` Not legible: ${esc(t(j.not_legible))}` : ''));
}
Object.assign(ACTS, {
  labeldel: async el => {
    const id = el.dataset.pid; sdraft.photos = sdraft.photos.filter(x => x !== id);
    if (sdraft.fresh.includes(id)) { sdraft.fresh = sdraft.fresh.filter(x => x !== id); await PH.del(id); } else sdraft.removed.push(id);
    redrawLabel();
  },
  labelread: async el => {
    if (!sdraft || !sdraft.photos.length) return toast('Add a photo of the label first.');
    const imgs = [];
    for (const id of sdraft.photos) { const r = await PH.get(id); if (r) imgs.push({ b64: r.full.split(',')[1], w: 1800, h: 1350, dataUrl: r.full }); }
    if (!imgs.length) return toast('The label photo is not stored on this phone.');
    if (db.settings.aiMode !== 'api' || !usableModels().length) {
      const files = imgs.map((i, k) => toFile(i.b64, `label-${k + 1}.jpg`)), text = LABEL_SYS + '\n\n' + LABEL_PROMPT.replace('return JSON with exactly these keys', 'list these items') ;
      try { await navigator.clipboard.writeText(text); } catch (e) { }
      try { if (navigator.share && navigator.canShare && navigator.canShare({ files })) { await navigator.share({ text, files }); return toast('Pick your chat app, then type what it reads into this form. For automatic filling, set up Built-in AI in Settings.'); } } catch (e) { if (e.name === 'AbortError') return; }
      return toast('Automatic reading needs Built-in AI with a photo-capable model (Settings → AI assistant).');
    }
    const rt = pickRoute({ model: '', msgs: [], photos: imgs, kind: 'question', symptoms: '' });
    if (!rt) return toast('Add an AI provider and model in Settings first.');
    const { p, m } = rt;
    if (!m.vision && !await ask(`${m.id} is not marked as able to read photos. Send anyway?`, 'Send anyway')) return;
    const tin = 450 + imgs.length * 4300, cost = m.in !== '' && m.in != null && m.out !== '' && m.out != null ? (tin * num(m.in) + 500 * num(m.out)) / 1e6 : null;
    if (AIS().askPhotos !== false && !await ask(`Send ${imgs.length} label photo${imgs.length > 1 ? 's' : ''} to ${p.name} (${hostOf(p.base)}) using ${m.id}? Estimated cost: ${cost == null ? 'unknown (no prices set)' : usd(cost)}.`, 'Send')) return;
    const g = budgetGate({ tin, cost: null }); if (g.block) return toast(g.block);
    if (el.disabled) return; el.disabled = true; el.textContent = 'Reading the label…';
    try {
      const r = await callAI(p, m, LABEL_SYS, [{ role: 'user', text: LABEL_PROMPT, images: imgs }], 900);
      logUsage(p, m, r.usage, 'label'); budgetNotice();
      const a = r.text.indexOf('{'), z = r.text.lastIndexOf('}'); let j = null;
      try { j = JSON.parse(r.text.slice(a, z + 1)); } catch (e) { }
      if (!j) { const out = document.getElementById('s_readout'); if (out) out.innerHTML = `<div class="card" style="font-size:13px"><span class="t">The AI answered, but not in the expected form. Copy what you need by hand:</span>${mdLite(r.text)}</div>`; }
      else fillFromLabel(j);
    } catch (e) { toast(e.message); }
    const b2 = document.querySelector('[data-act=labelread]'); if (b2) { b2.disabled = false; b2.innerHTML = `${ic('search', 18, 2)}Read the label again`; }
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if ((el.id === 'sl_cam' || el.id === 'sl_gal') && sdraft && el.files && el.files.length) addLabelPhotos([...el.files]);
});

/* ---------- AI actions ---------- */
function tinyTestImage() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d00'; x.fillRect(16, 16, 32, 32);
  return { b64: c.toDataURL('image/jpeg', 0.9).split(',')[1], w: 64, h: 64 };
}
async function testModel(p, m, withPhoto) {
  const r = await callAI(p, m, 'You are a connection test.', [{ role: 'user', text: withPhoto ? 'What colour is the square? Answer with one word.' : 'Reply with the single word OK.', images: withPhoto ? [tinyTestImage()] : [] }], 16);
  logUsage(p, m, r.usage, 'test'); return r;
}
Object.assign(ACTS, {
  aimode: el => { db.settings.aiMode = el.dataset.v; save(); if (el.dataset.v === 'api' && !AIS().providers.length) return go('#aiset'); render(); },
  airouting: el => { AIS().routing = el.dataset.v; save(); render(); },
  aiaddprov: () => { const p = newProvider(val('ai_newprov')); const A = AIS(); A.providers.push(p); if (!A.routes.routine && p.models[0]) A.routes.routine = p.id + '|' + p.models[0].id; save(); go('#aiprov/' + p.id); },
  aidelprov: async el => {
    const p = provById(el.dataset.id); if (!p || !await ask(`Remove ${p.name} and its key from this phone? The usage log is kept.`, 'Remove')) return;
    const A = AIS(); A.providers = A.providers.filter(x => x.id !== p.id); setKey(p.id, '');
    Object.keys(A.routes).forEach(k => { if (String(A.routes[k]).startsWith(p.id + '|')) A.routes[k] = ''; });
    save(); toast('Provider removed'); go('#aiset');
  },
  aisavekey: el => {
    const p = provById(el.dataset.id), k = val('pv_key'); if (!p) return;
    if (!k) return toast('Paste the API key first.');
    const v = validBase(p.base); if (v.err) return toast(v.err);
    if (!setKey(p.id, k)) return toast('Could not save the key on this device.');
    toast('Key saved on this phone'); render();
  },
  aidelkey: async el => { const p = provById(el.dataset.id); if (!p || !await ask('Remove this API key from the phone?', 'Remove')) return; setKey(p.id, ''); toast('Key removed'); render(); },
  aitest: async el => {
    const p = provById(el.dataset.id); if (!p) return;
    if (!p.models.length) return toast('Add a model first: fetch the list or type a model name.');
    const rr = resolveRef(AIS().routes.routine), m = rr && rr.p === p ? rr.m : p.models[0];
    toast(`Testing ${m.id}…`);
    try { const r = await testModel(p, m, false); toast(`Connected ✓ ${m.id} answered (${r.usage.in} in, ${r.usage.out} out tokens)`); }
    catch (e) { toast(e.message); }
  },
  aivtest: async el => {
    const p = provById(el.dataset.id), m = p && p.models[+el.dataset.i]; if (!m) return;
    toast(`Sending a small test picture to ${m.id}…`);
    try { const r = await testModel(p, m, true); m.vision = true; save(); toast(`Photo accepted ✓ it answered "${r.text.slice(0, 40)}"`); render(); }
    catch (e) { if (e.status === 400 || e.status === 404 || e.status === 422) { m.vision = false; save(); render(); } toast((e.status === 400 || e.status === 422 ? 'This model did not accept the picture. ' : '') + e.message); }
  },
  aifetch: async el => {
    const p = provById(el.dataset.id); if (!p) return; toast('Fetching the model list…');
    try { fetched[p.id] = await fetchModels(p); ui.mfilter = ''; toast(`${fetched[p.id].length} models available`); render(); }
    catch (e) { toast(e.message); }
  },
  aipick: el => {
    const p = provById(el.dataset.id), id = val('pv_pick'), x = (fetched[p.id] || []).find(y => y.id === id); if (!x) return;
    if (p.models.some(m => m.id === id)) return toast('Already added.');
    const m = blankModel(id, PRESETS[p.preset]);
    if (x.ctx) m.ctx = x.ctx; if (x.priced) { m.in = x.in; m.out = x.out; m.cin = x.cin; m.src = 'Prices and limits read from the provider\'s list on ' + fdy(today()); }
    if (p.proto === 'openai' && 'vision' in x && x.priced) { m.vision = !!x.vision; m.reasoning = !!x.reasoning; m.json = !!x.json; }
    p.models.push(m); if (!AIS().routes.routine) AIS().routes.routine = p.id + '|' + id; save(); toast('Model added'); render();
  },
  aiaddmodel: el => {
    const p = provById(el.dataset.id), id = val('pv_newmodel'); if (!p) return;
    if (!id) return toast('Type the model name exactly as the provider writes it.');
    if (p.models.some(m => m.id === id)) return toast('Already added.');
    p.models.push(blankModel(id, PRESETS[p.preset])); if (!AIS().routes.routine) AIS().routes.routine = p.id + '|' + id; save(); render();
  },
  aidelmodel: el => {
    const p = provById(el.dataset.id), i = +el.dataset.i, m = p && p.models[i]; if (!m) return;
    const A = AIS(), ref = p.id + '|' + m.id; Object.keys(A.routes).forEach(k => { if (A.routes[k] === ref) A.routes[k] = ''; });
    p.models.splice(i, 1); save(); render();
  },
  aiclearusage: async () => { if (!await ask('Clear the AI usage log and this app\'s spending totals? This does not change what the providers have billed.', 'Clear')) return; db.aiUsage = []; AIS().agg = {}; AIS().warned = ''; AIS().warnedFull = ''; save(); render(); },
  ailen: el => { ai.len = el.dataset.v; render(); },
  aikind: el => { ai.kind = el.dataset.v; render(); },
  aidelphoto: el => { ai.photos.splice(+el.dataset.i, 1); render(); },
  aiforce: () => { ai.local = null; ai.skipLocal = true; if (aiMode() === 'api') ACTS.aisend(); else render(); },
  ainew: () => { const b = ai.blockId; ai = freshAI(null); ai.blockId = b; ai.kind = 'question'; render(true); },
  aisend: async () => {
    if (!ai || ai.busy) return;
    if (!ai.symptoms.trim() && !ai.photos.length) return toast('Add a photo or describe what you see.');
    if (tryLocal(ai)) return;
    ai.msgs = [{ role: 'user', text: firstPrompt(ai), display: (ai.symptoms.trim() || 'Please look at the photos.') + (ai.photos.length ? `\n📷 ${ai.photos.length} photo${ai.photos.length > 1 ? 's' : ''}` : '') }];
    ai.resend = cacheFor(ai, (pickRoute(ai) || { p: {} }).p);
    if (!await preflight(ai)) { ai.msgs = []; return render(); }
    runAI();
  },
  aifollow: async () => {
    if (!ai || ai.busy) return;
    const f = ai.followup.trim(); if (!f) return toast('Type your follow-up question.');
    ai.msgs.push({ role: 'user', text: f, display: f }); ai.followup = '';
    if (!await preflight(ai)) { ai.msgs.pop(); ai.followup = f; return render(); }
    runAI();
  },
  aishare: async () => {
    if (!ai.symptoms.trim() && !ai.photos.length) return toast('Add a photo or describe what you see.');
    if (tryLocal(ai)) return;
    const text = sharePrompt(ai);
    let copied = false; try { await navigator.clipboard.writeText(text); copied = true; } catch (e) { }
    const files = ai.photos.map(p => p.file);
    try {
      if (navigator.share && (!files.length || (navigator.canShare && navigator.canShare({ files })))) {
        await navigator.share(files.length ? { text, files } : { text });
        toast(copied ? 'Pick your chat app. The question is also copied: paste it if it does not appear.' : 'Pick your chat app in the list.');
      } else {
        window.open('https://claude.ai/new', '_blank', 'noopener');
        toast(copied ? 'Question copied. Paste it into the chat and attach your photos.' : 'Open your chat app and describe the problem.');
      }
    } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed. Use Copy question, then open your chat app.'); }
  },
  aicopy: async () => { try { await navigator.clipboard.writeText(sharePrompt(ai)); toast('Question copied. Paste it into your chat app.'); } catch (e) { toast('Could not copy on this device.'); } },
  aisave: async () => {
    const ans = ai.msgs.filter(m => m.role === 'assistant').map(m => m.text).join('\n\n---\n\n');
    const found = await askText('What was found? (short, e.g. Early blight)');
    if (!found) return;
    db.records.push({ id: uid(), created: Date.now(), type: 'scouting', status: 'done', date: today(), blockId: ai.blockId, title: '', target: found, lines: [], waterLha: '', tankL: '', phiDays: '', ec: '', ph: '', severity: '', count: '', minutes: '', m3: '', notes: (ai.symptoms.trim() ? 'Seen: ' + ai.symptoms.trim() + '\n\n' : '') + 'AI advice (not a record of work done):\n' + ans, used: null });
    save(); toast('Saved as a scouting record'); go(ai.blockId ? '#block/' + ai.blockId : '#records');
  }
});
document.addEventListener('input', e => {
  const el = e.target, d = el.dataset; if (!d) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  if (d.as !== undefined) { AIS()[d.as] = v; if (d.as === 'budget' || d.as === 'warnPct') { AIS().warned = ''; AIS().warnedFull = ''; } save(); if (el.type === 'checkbox') render(); }
  else if (d.ar !== undefined) { AIS().routes[d.ar] = v; save(); }
  else if (d.ac !== undefined && ai) { ai[d.ac] = v; }
  else if (d.pm !== undefined) { const p = provById(route().parts[1]), m = p && p.models[+d.pm]; if (m) { m[d.k] = el.type === 'checkbox' ? v : (v === '' ? '' : (d.k === 'ctx' ? Math.round(num(v)) : num(v))); if (d.k !== 'vision' && d.k !== 'reasoning' && d.k !== 'json' && d.k !== 'ctx') m.src = ''; save(); } }
  else if (d.pf === 'name') { const p = provById(route().parts[1]); if (p && v.trim()) { p.name = v.trim(); save(); } }
  else if (el.id === 'pv_filter') { ui.mfilter = v; const p = provById(route().parts[1]), s = document.getElementById('pv_pick'); if (p && s) s.innerHTML = (fetched[p.id] || []).filter(x => !v || x.id.toLowerCase().includes(v.toLowerCase())).slice(0, 300).map(x => `<option value="${esc(x.id)}">${esc(x.id)}${x.priced ? ` · $${x.in}/$${x.out}` : ''}</option>`).join(''); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset && el.dataset.pf === 'base') {
    const p = provById(route().parts[1]); if (!p) return;
    const r = validBase(el.value);
    if (r.err) { toast(r.err); el.value = p.base; return; }
    if (r.url !== p.base) { p.base = r.url; delete p.maxParam; save(); toast(`Saved. Requests for this provider now go to ${hostOf(r.url)}.`); render(); }
  }
});
aiReady = true;
if (ensureAI(db)) save();

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.dataset.act === 'toggle') return;
  e.preventDefault();
  const fn = ACTS[el.dataset.act]; if (fn) fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'toggle') {
    const r = db.records.find(x => x.id === el.dataset.id); if (!r) return;
    setDone(r, el.checked); save();
    toast(el.checked ? 'Done' + (r.used && r.used.length ? ' · stock updated' : '') : 'Moved back to planned');
    render();
  } else if (el.id === 'set_model') { db.settings.aiModel = el.value; save();
  } else if (el.dataset.rc !== undefined && rdraft) { rdraft[el.dataset.rc] = el.checked; render();
  } else if ((el.id === 'iph_cam' || el.id === 'iph_gal') && idraft && el.files && el.files.length) {
    addPhotos([...el.files], idraft.photos, idraft.newPhotos, 8).then(() => render());
  } else if ((el.id === 'uph_cam' || el.id === 'uph_gal') && udraft && el.files && el.files.length) {
    addPhotos([...el.files], udraft.photos, udraft.newPhotos, 8).then(() => render());
  } else if (el.id === 'ai_photo' && el.files && el.files.length && ai) {
    const fl = [...el.files].slice(0, 4 - ai.photos.length);
    Promise.all(fl.map(f => loadPhoto(f).catch(() => null))).then(ps => { const ok = ps.filter(Boolean); ai.photos.push(...ok); if (ok.length < fl.length) toast('One photo could not be read.'); render(); });
  } else if (el.id === 'importFile' && el.files && el.files[0]) {
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const o = JSON.parse(fr.result);
        if (!o || !Array.isArray(o.blocks) || !Array.isArray(o.records) || !Array.isArray(o.stock)) throw new Error('shape');
        if (!await ask(`Restore this backup (${o.blocks.length} blocks, ${o.records.length} records${(o.issues || []).length ? ', ' + o.issues.length + ' plant-health problems' : ''}${Array.isArray(o.photos) && o.photos.length ? ', ' + o.photos.length + ' photos' : ''})? It replaces what is on this phone now.`)) return;
        const photos = Array.isArray(o.photos) ? o.photos : []; delete o.photos;
        await PH.clear(); for (const p of photos) if (p && p.id) { try { await PH.put(p); } catch (e) { } }
        const curAI = db.settings.ai, curMode = db.settings.aiMode, curU = db.aiUsage;
        db = Object.assign(blank(), o); db.settings = Object.assign(blank().settings, o.settings || {});
        if (curAI && curAI.providers.length) { db.settings.ai = curAI; db.settings.aiMode = curMode; db.aiUsage = curU; }
        normalize(db); save(); toast('Backup restored' + (photos.length ? ` with ${photos.length} photo${photos.length > 1 ? 's' : ''}` : '')); go('#today'); render();
      } catch (err) { toast('That file is not a Farm Manager backup.'); }
    };
    fr.readAsText(el.files[0]);
  }
});
document.addEventListener('focusin', e => { const el = e.target; if (el.tagName === 'SELECT' && el.dataset.list) el.dataset.prev = el.value; });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.tagName === 'SELECT' && el.dataset.list && el.value === '__new__') { e.stopImmediatePropagation(); addFromSelect(el); return; }
  if (el.dataset.af !== undefined && ai) { ai[el.dataset.af] = el.value; return; }
  if (el.dataset['if'] !== undefined && idraft) { idraft[el.dataset['if']] = el.value; return; }
  if (el.dataset.uf !== undefined && udraft) { udraft[el.dataset.uf] = el.value; return; }
  if (el.dataset.hf !== undefined) { ui[el.dataset.hf] = el.value; render(); return; }
  if (el.dataset.rf !== undefined && rdraft) { rdraft[el.dataset.rf] = el.value; const id = el.id; render(); if (el.type === 'date') { const n = document.getElementById(id); if (n) n.focus(); } return; }
  if (el.dataset.lk !== undefined && ldraft) { ldraft[+el.dataset.li][el.dataset.lk] = el.type === 'checkbox' ? el.checked : el.value; return; }
  if (el.id === 'debtq') { ui.dq = el.value; document.getElementById('debtlist').innerHTML = debtsListHtml(); return; }
  if (el.dataset.tf !== undefined && tdraft) {
    const f = el.dataset.tf; tdraft[f] = el.value;
    if (f === 'category' || f === 'blockId') { render(); return; }
    if (f === 'rate') tdraft.rateManual = true;
    if (f === 'date' && !tdraft.rateManual && el.value) { const r = rateOn(el.value); if (r) { tdraft.rate = String(r); const ri = document.getElementById('t_rate'); if (ri) ri.value = tdraft.rate; } }
    if ((f === 'qty' || f === 'price') && isSaleCat(tdraft.category) && num(tdraft.qty) && num(tdraft.price)) {
      tdraft.amount = String(roundC(num(tdraft.qty) * num(tdraft.price), tdraft.currency));
      const am = document.getElementById('t_amount'); if (am) am.value = tdraft.amount;
    }
    const cur = tdraft.currency || 'USD';
    const bl = document.getElementById('t_bal'); if (bl) bl.textContent = `Paid ${money(paidOf(tdraft), cur)} · balance ${money(Math.max(0, num(tdraft.amount) - paidOf(tdraft)), cur)}`;
    const eq = document.getElementById('t_eq'); if (eq) eq.textContent = txnEquivText(tdraft);
    return;
  }
  if (el.id === 'stockq') { ui.q = el.value; document.getElementById('stocklist').innerHTML = stockListHtml(); return; }
  if (el.dataset.f !== undefined && draft) {
    draft[el.dataset.f] = el.value;
    if (el.dataset.f === 'blockId') { const li = draft.issueId && issueById(draft.issueId); if (li && li.blockId !== el.value) draft.issueId = ''; render(); return; }
    updateLive(); return;
  }
  if (el.dataset.lf !== undefined && draft) {
    const l = draft.lines[+el.dataset.line]; l[el.dataset.lf] = el.value;
    if (el.dataset.lf === 'stockId') {
      const s = stockById(el.value);
      if (s && draft.type === 'spray' && num(s.phiDays) > num(draft.phiDays)) draft.phiDays = s.phiDays;
      render(); return;
    }
    updateLive(); return;
  }
  if (el.dataset.nf !== undefined && ncdraft) { ncdraft[el.dataset.nf] = el.value; if (el.dataset.nf === 'ended') { render(); const i = document.getElementById('nc_ended'); if (i) i.focus(); } return; }
  if (el.dataset.bf !== undefined && bdraft) { bdraft[el.dataset.bf] = el.value; return; }
  if (el.dataset.sf !== undefined && bdraft) { bdraft.stages[+el.dataset.si][el.dataset.sf] = el.value; }
});

/* ---------- install & offline ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (route().parts[0] === 'settings') render(); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* preview hosts may block this */ }); });
}

render(true);
