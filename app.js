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
function blank() { return { v: 1, settings: { farmName: 'My farm', lastBackup: null, sample: false }, blocks: [], stock: [], records: [], power: [], txns: [], rates: [], lists: defaultLists() }; }
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
  normalizeLists(d);
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
const ui = { bscope: 'current', bfilter: 'all', rfilter: 'all', cat: 'all', q: '', mperiod: 'month', rpperiod: 'year', dtab: 'recv', dq: '', rcur: (db.settings.repCur === 'SLSH' ? 'SLSH' : 'USD'), rateOpen: false };
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
  <a class="card" href="#ai" style="flex-direction:row;align-items:center;gap:14px"><span class="ib" style="background:var(--accbg);color:var(--acc);border:0">${ic('search', 22)}</span><span class="main"><span class="t">Ask Claude</span><span class="s">Identify a pest or disease from photos, or get advice — your crop, sprays and stock are included</span></span>${ic('chev', 18, 2)}</a>
  ${lp ? `<a class="card" href="#power" style="flex-direction:row;align-items:center;gap:14px"><span class="ib" style="background:var(--waterbg);color:var(--water);border:0">${ic('drop', 22)}</span><span class="main"><span class="t">${lp.tankPct !== '' && lp.tankPct != null ? `Tank ${fmt(num(lp.tankPct))}% · ` : ''}${fmt(num(lp.m3))} m³ pumped</span><span class="s">Last log ${fd(lp.date)} · ${fmt(num(lp.pvKwh))} kWh PV</span></span>${ic('chev', 18, 2)}</a>` : ''}`;
}

function vFields() {
  const card = b => {
    const day = cropDay(b), st = currentStage(b), pe = phiEnd(b), end = planEnd(b);
    const next = db.records.filter(r => r.blockId === b.id && r.status === 'planned').sort(byDate)[0];
    const pct = day != null && end ? Math.max(0, Math.min(100, day / end * 100)) : 0;
    if (!isActive(b)) return `<a class="card dash" href="#block/${b.id}"><div class="between"><div class="col"><span class="s">${esc(b.name)} · ${fmt(num(b.areaHa))} ha</span><h2 style="font-size:17px">${b.status === 'fallow' ? 'Fallow' : 'Harvested' + (b.crop ? ' · ' + esc(b.crop) : '')}${b.notes ? ' · ' + esc(b.notes) : ''}</h2></div>${ic('chev', 18, 2)}</div></a>`;
    return `<a class="card" href="#block/${b.id}">
      <div class="between" style="align-items:flex-start"><div class="col"><span class="s">${esc(b.name)} · ${fmt(num(b.areaHa))} ha${b.irrigation ? ' · ' + esc(b.irrigation) : ''}</span><h2 style="font-size:17px">${esc(b.crop || 'No crop set')}</h2></div>
      ${pe ? `<span class="badge b-warn">PHI to ${fd(pe)}</span>` : next && next.date <= today() ? `<span class="badge b-ok">Due today</span>` : ''}</div>
      ${day != null ? `<div class="col" style="gap:6px"><div class="between s"><span>${esc(st ? st.name : 'No stage plan')}</span><span class="mono">Day ${day}${end ? ' / ' + end : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>` : ''}
      <div style="font-size:13px;border-top:1px solid var(--line2);padding-top:10px">${next ? `Next: <strong>${esc(recTitle(next))}</strong> · ${fd(next.date)}` : '<span class="s">Nothing planned</span>'}</div></a>`;
  };
  const area = db.blocks.filter(isActive).reduce((a, b) => a + num(b.areaHa), 0);
  return `<div class="between"><h1>Fields</h1><a class="btn pri sm" href="#blockedit/new">${ic('plus', 16, 2.2)}New block</a></div>
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
  <div class="seg"><a class="on" href="#block/${b.id}" aria-current="page">History</a><a href="#season/${b.id}">Season plan</a></div>
  ${hasHist ? `<div class="seg" role="group" aria-label="Records shown"><button class="${scope === 'current' ? 'on' : ''}" data-act="bscope" data-v="current" aria-pressed="${scope === 'current'}">${esc(b.crop || 'Since last crop')}</button><button class="${scope === 'all' ? 'on' : ''}" data-act="bscope" data-v="all" aria-pressed="${scope === 'all'}">All crops</button></div>` : ''}
  <div class="chips">${chips}</div>
  <p class="sec">Planned</p>${planned.length ? `<div class="list">${planned.map(r => taskRow(r, false)).join('')}</div>` : `<div class="empty">Nothing planned.</div>`}
  <p class="sec">Completed</p>${done.length ? `<div class="list">${done.map(r => doneRow(r, false)).join('')}</div>` : `<div class="empty">No records yet.</div>`}
  <h2>Add to ${esc(b.name)}</h2>${addButtons(b.id)}
  <a class="btn block" href="#ai?block=${b.id}">${ic('search', 18, 2)}Ask Claude about ${esc(b.crop || b.name)}</a>
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
  const d = { id: null, type, activity: type === 'activity' ? (q.get('act') || L('activities')[0] || 'Activity') : '', status: type === 'task' ? 'planned' : 'done', date: today(), blockId: q.get('block') || '', title: '', target: '', lines: [], waterLha: '', tankL: db.settings.tankL || '', phiDays: '', ec: '', ph: '', severity: '', count: '', minutes: '', m3: '', notes: '', endDate: '', extLog: [] };
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
      ${d.blockId || d.target ? `<a class="btn sm" href="#ai?block=${d.blockId}&note=${encodeURIComponent(encodeURIComponent(d.target || ''))}" style="align-self:flex-start">${ic('search', 16, 2)}Ask Claude about this</a>` : ''}
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
    <div class="g2">${inp('expiry', 'Expiry date', '', 'date')}${inp('phiDays', 'Label PHI (days)', 'inputmode="numeric"')}</div>
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
  <div class="card"><span class="t">Ask Claude (photos &amp; advice)</span>
    <div class="seg" role="group" aria-label="How to reach Claude"><button class="${(db.settings.aiMode || 'share') === 'share' ? 'on' : ''}" data-act="aimode" data-v="share" aria-pressed="${(db.settings.aiMode || 'share') === 'share'}">Claude app</button><button class="${db.settings.aiMode === 'api' ? 'on' : ''}" data-act="aimode" data-v="api" aria-pressed="${db.settings.aiMode === 'api'}">Built-in (API key)</button></div>
    ${db.settings.aiMode !== 'api' ? `<span class="s">Your photos and question, with this farm's records, are sent to the Claude app on this phone. It uses your Claude plan — no extra charge. The answer stays in the Claude app.</span>` : `
    <span class="s">Answers appear inside Farm Manager and can be saved to records. This uses the Claude API, which is <strong>paid per use and billed separately from your Claude plan</strong> (Max, Ultra and Team plans include monthly API credits). Create a key at platform.claude.com.</span>
    <div class="f"><label for="set_key">API key</label><input id="set_key" type="password" autocomplete="off" placeholder="${getKey() ? 'Saved: …' + esc(getKey().slice(-4)) : 'sk-ant-…'}"></div>
    <div class="f"><label for="set_model">Model</label><select id="set_model">${AI_MODELS.map(([v, l]) => `<option value="${v}" ${(db.settings.aiModel || AI_MODELS[0][0]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="g3"><button class="btn sm pri" data-act="aisavekey">Save key</button><button class="btn sm" data-act="aitest">Test</button><button class="btn sm danger" data-act="aidelkey">Remove</button></div>
    <span class="hint">The key is stored only on this phone and is never included in backups. Never upload it to GitHub. Set a monthly spend limit in the Claude Console.</span>`}</div>
  <a class="card" href="#lists" style="flex-direction:row;align-items:center"><span class="main"><span class="t">Lists &amp; categories</span><span class="s">Sales and expense categories, crops, units, payment methods, stock categories, irrigation types, activities</span></span>${ic('chev', 18, 2)}</a>
  <div class="card"><span class="t">Exchange rate history</span><span class="s">SLSH per 1 USD. Each transaction keeps the rate of its own date, so updating the rate never changes past figures.</span>
    ${rateCard(true)}
    ${(db.rates || []).length ? `<div class="list">${ratesSorted().reverse().slice(0, 30).map(r => `<div class="item"><span class="date">${fd(r.date)}</span><span class="main mono" style="font-size:14px;font-weight:600">${fmtRate(r.rate)}</span><button class="btn sm danger" data-act="delrate" data-id="${r.id}" aria-label="Delete rate of ${fd(r.date)}">Delete</button></div>`).join('')}</div>` : ''}</div>
  <div class="card"><span class="t">Backup</span><span class="s">Your records live only on this phone. Export a backup file regularly and keep a copy off the phone (email it to yourself or save to Drive). ${db.settings.lastBackup ? 'Last backup: ' + fdy(db.settings.lastBackup) + '.' : 'No backup yet.'}</span>
    <button class="btn pri" data-act="export">Export backup file</button>
    <label class="btn" for="importFile">Restore from backup file</label><input id="importFile" type="file" accept=".json,application/json" class="sr"></div>
  ${installEvt ? `<div class="card"><span class="t">Install</span><span class="s">Add Farm Manager to your home screen so it opens like an app and works offline.</span><button class="btn pri" data-act="install">Install app</button></div>` : ''}
  <div class="card"><span class="t">Data</span>
    <span class="s">${db.blocks.length} blocks · ${db.records.length} records · ${db.stock.length} stock items · ${db.txns.length} transactions · ${(db.rates || []).length} rates · ${db.power.length} power logs</span>
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
  activities: { title: 'Extra activity types', hint: 'Added to Records next to Spray, Fertigation, Scouting and Irrigation. They record a block, date, description and notes.' }
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
    activities: ['Harvest', 'Pruning', 'Weeding']
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

/* ---------- Ask Claude: disease ID & advice ---------- */
const AI_KEY = 'farmapp.apikey';          /* stored on this phone only, never in backups */
const AI_MODELS = [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (balanced)'], ['claude-opus-5-5', 'Claude Opus 5.5 (most capable, costs more)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (fastest, cheapest)']];
const AI_KINDS = { diagnose: 'Identify a problem', nutrition: 'Nutrition advice', question: 'Other question' };
const getKey = () => { try { return localStorage.getItem(AI_KEY) || ''; } catch (e) { return ''; } };
const aiMode = () => db.settings.aiMode === 'api' && getKey() ? 'api' : 'share';
function freshAI(q) {
  return { blockId: (q && q.get('block')) || '', kind: (q && q.get('kind')) || 'diagnose', symptoms: (q && q.get('note')) ? 'Scouting note: ' + q.get('note') : '', photos: [], msgs: [], answer: '', busy: false, followup: '', usage: null, error: '' };
}
let ai = null, aiKey = null;

const AI_SYSTEM = `You are an experienced field agronomist advising a commercial vegetable farmer. Be technically rigorous, practical and concise.
Rules:
- Rank likely causes and give a confidence (high / medium / low) for each, with the visible signs that support it. Say plainly when a photo cannot settle the question and what to check or photograph next.
- Consider look-alikes: nutrient deficiency or toxicity, water stress, salinity, heat or sun scald, herbicide or spray injury, mechanical damage.
- Prefer prevention and integrated pest and disease management. Put cultural and non-chemical actions first.
- For chemical options, prefer products in the farmer's stock list and name the active ingredient and IRAC/FRAC group. Do not repeat the mode-of-action group used in the last spray on the block. Say "use the label rate" — never invent rates, pre-harvest intervals or product names. Point out pre-harvest interval and tank-mix concerns.
- Separate what is confirmed from what is likely. If information is missing, say what you need.`;

function farmContext(b) {
  const t = today(), L1 = [];
  L1.push(`Date: ${fdy(t)}. Farm: ${db.settings.farmName || 'farm'}${db.settings.location ? ', ' + db.settings.location : ''}.`);
  if (b) {
    const day = cropDay(b), st = currentStage(b);
    L1.push(`Block: ${b.name}, ${fmt(num(b.areaHa))} ha${b.irrigation ? ', ' + b.irrigation + ' irrigation' : ''}.`);
    L1.push(b.crop ? `Crop: ${b.crop}${b.variety ? ' (' + b.variety + ')' : ''}, planted ${fdy(b.planted)}${day != null ? `, crop day ${day}` : ''}${st ? `, stage: ${st.name}` : ''}.` : 'No crop recorded on this block.');
    const recs = db.records.filter(r => r.blockId === b.id && r.status === 'done' && r.date >= curFrom(b)).sort(byDateDesc).slice(0, 8);
    if (recs.length) {
      L1.push('Recent records on this block (newest first):');
      recs.forEach(r => {
        const prods = (r.lines || []).map(l => { const s = stockById(l.stockId); return s ? `${s.name}${s.ai ? ' [' + s.ai + ']' : ''}${s.group ? ' ' + s.group : ''}` : ''; }).filter(Boolean).join(' + ');
        L1.push(`- ${r.date} ${r.type === 'activity' ? r.activity : TYPES[r.type] || r.type}${prods ? ': ' + prods : ''}${r.target ? ' — target: ' + r.target : ''}${r.severity ? ', pressure ' + r.severity : ''}${num(r.phiDays) ? ', PHI ' + r.phiDays + ' d' : ''}${r.notes ? ' — ' + r.notes.replace(/\s+/g, ' ').slice(0, 140) : ''}`);
      });
    }
    const ls = lastSprays(b.id, null, t);
    if (ls.length) L1.push(`Last spray groups on this block: ${ls.map(x => `${x.date} ${x.g.join(', ') || 'no group recorded'}`).join('; ')}.`);
    const pe = phiEnd(b); if (pe) L1.push(`Pre-harvest interval active until ${fdy(pe)}.`);
  }
  const cp = db.stock.filter(s => num(s.qty) > 0 && !stockFlags(s).includes('expired'));
  const prot = cp.filter(s => (stockCat(s.category) || {}).use !== 'fertigation');
  const fert = cp.filter(s => (stockCat(s.category) || {}).use === 'fertigation' || (stockCat(s.category) || {}).use === 'both');
  L1.push(prot.length ? 'Crop-protection stock on hand:\n' + prot.map(s => `- ${s.name}${s.ai ? ' [' + s.ai + ']' : ''}${s.group ? ' ' + s.group : ''}: ${qtyStr(s)}${s.phiDays ? ', label PHI ' + s.phiDays + ' d' : ''}`).join('\n') : 'No crop-protection products in stock.');
  if (fert.length) L1.push('Fertilisers on hand:\n' + fert.map(s => `- ${s.name}${s.ai ? ' [' + s.ai + ']' : ''}: ${qtyStr(s)}`).join('\n'));
  return L1.join('\n');
}
function taskText(a) {
  const n = a.photos.length;
  const head = a.kind === 'diagnose'
    ? `Please identify the problem${n ? ` in the ${n} photo${n > 1 ? 's' : ''}` : ''} and advise. Answer with: 1) likely causes ranked with confidence; 2) what to check in the field to confirm; 3) immediate cultural / non-chemical actions; 4) treatment options from my stock if justified (active ingredient, group, label rate, PHI); 5) when to re-check.`
    : a.kind === 'nutrition'
      ? `Please advise on nutrition / fertigation for this crop and stage using the fertilisers I have${n ? ', and assess the photo(s) for deficiency symptoms versus other causes' : ''}. If you give amounts, show your assumptions so I can check them against my soil and water tests.`
      : 'Question:';
  return `${head}\n\nWhat I see / my question:\n${a.symptoms.trim() || '(no description given)'}`;
}
const firstPrompt = a => `${taskText(a)}\n\n--- Farm records ---\n${farmContext(blockById(a.blockId))}`;
const sharePrompt = a => `${AI_SYSTEM}\n\n${firstPrompt(a)}`;

/* resize a photo to max 1568 px (long edge) as JPEG */
function loadPhoto(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 1568, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      c.toBlob(blob => res({ dataUrl, b64: dataUrl.split(',')[1], file: new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) }), 'image/jpeg', 0.85);
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
function vAI() {
  const a = ai; if (!a) return vMissing();
  const mode = aiMode();
  const blockOpts = `<option value="">No block (general)</option>` + db.blocks.map(b => `<option value="${b.id}" ${b.id === a.blockId ? 'selected' : ''}>${esc(blockLabel(b))}</option>`).join('');
  const photos = a.photos.map((p, i) => `<div style="position:relative;width:88px;height:88px;flex:none"><img src="${p.dataUrl}" alt="Photo ${i + 1}" style="width:88px;height:88px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"><button type="button" class="ib" data-act="aidelphoto" data-i="${i}" aria-label="Remove photo ${i + 1}" style="position:absolute;top:-8px;right:-8px;width:32px;height:32px;border-radius:50%;background:#fff">${'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'}</button></div>`).join('');
  const convo = a.msgs.filter(m => m.role === 'assistant' || m.display).map(m => m.role === 'assistant'
    ? `<div class="card" style="gap:4px;font-size:14px;line-height:1.5">${mdLite(m.text)}</div>`
    : `<div style="align-self:flex-end;max-width:85%;background:var(--accbg);color:var(--acc2);border-radius:12px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(m.display)}</div>`).join('');
  return `${back('#today', 'Today')}<h1>Ask Claude</h1>
  <p class="hint" style="margin:-8px 0 0">${mode === 'api' ? 'Answers appear here (uses your API key).' : 'Sends your photos and question to the Claude app, with your farm records attached.'} <a href="#settings">Change</a></p>
  ${a.msgs.length ? '' : `<div class="form">
    <div class="chips" role="group" aria-label="Type of question">${Object.entries(AI_KINDS).map(([k, l]) => `<button type="button" class="chip ${a.kind === k ? 'on' : ''}" data-act="aikind" data-v="${k}" aria-pressed="${a.kind === k}">${l}</button>`).join('')}</div>
    <div class="f"><label for="ai_block">Block</label><select id="ai_block" data-af="blockId">${blockOpts}</select><span class="hint">The crop, stage, recent sprays and your stock are added automatically.</span></div>
    <div class="f"><span class="lbl">Photos (up to 4)</span>
      <div class="row" style="gap:12px">${photos}${a.photos.length < 4 ? `<label for="ai_photo" class="btn" style="width:88px;height:88px;flex-direction:column;gap:4px;font-size:12px;padding:0">${'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'}Add photo</label>` : ''}</div>
      <input id="ai_photo" type="file" accept="image/*" multiple class="sr">
      <span class="hint">Take a close-up of the affected leaf (top and underside), plus one of the whole plant.</span></div>
    <div class="f"><label for="ai_sym">${a.kind === 'question' ? 'Your question' : 'What do you see?'}</label><textarea id="ai_sym" data-af="symptoms" placeholder="${a.kind === 'diagnose' ? 'e.g. Yellow patches on older leaves, brown spots with rings, spreading over 5 days, about 20% of plants' : a.kind === 'nutrition' ? 'e.g. Plan fertigation for the next 2 weeks; leaves look pale' : 'Type your question'}">${esc(a.symptoms)}</textarea></div>
    ${mode === 'api'
      ? `<button class="btn pri block" data-act="aisend" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Asking Claude…' : 'Ask Claude'}</button>`
      : `<button class="btn pri block" data-act="aishare">Send to Claude app</button>
         <div class="g2"><button class="btn" data-act="aicopy">Copy question</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a></div>
         <span class="hint">If the photos arrive without the text, paste — the question is copied for you. After Claude answers, you can paste the advice into a scouting record.</span>`}
    <details><summary class="s" style="cursor:pointer;min-height:44px;display:flex;align-items:center">See what will be sent</summary><pre style="white-space:pre-wrap;font-size:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;max-height:320px;overflow:auto">${esc(firstPrompt(a))}</pre></details>
  </div>`}
  ${convo ? `<div class="col" style="gap:10px">${a.photos.length ? `<div class="row" style="gap:8px">${a.photos.map((p, i) => `<img src="${p.dataUrl}" alt="Photo ${i + 1}" style="width:56px;height:56px;object-fit:cover;border-radius:8px">`).join('')}</div>` : ''}${convo}</div>` : ''}
  ${a.error ? alertH('bad', 'warn', a.error, '') : ''}
  ${a.busy && a.msgs.length ? `<div class="empty">Claude is thinking…</div>` : ''}
  ${a.msgs.length && !a.busy ? `<div class="form">
    <div class="f"><label for="ai_follow">Follow-up question</label><textarea id="ai_follow" data-af="followup" placeholder="e.g. Which of my products is safest 3 days before harvest?">${esc(a.followup)}</textarea></div>
    <button class="btn pri" data-act="aifollow">Send follow-up</button>
    <div class="g2"><button class="btn" data-act="aisave">Save to scouting record</button><button class="btn" data-act="ainew">New question</button></div>
    ${a.usage ? `<span class="hint">Tokens used: ${a.usage.in} in · ${a.usage.out} out</span>` : ''}
    <p class="hint" style="margin:0">AI advice can be wrong. Confirm in the field, and always follow the product label for rates, PHI and safety.</p></div>` : ''}`;
}
async function callClaude(messages, maxTokens = 2000) {
  const key = getKey();
  if (!key) throw new Error('Add your API key in Settings first.');
  if (navigator.onLine === false) throw new Error('No internet connection.');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 120000);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: db.settings.aiModel || AI_MODELS[0][0], max_tokens: maxTokens, system: AI_SYSTEM, messages })
    });
  } catch (e) { clearTimeout(tm); throw new Error(e.name === 'AbortError' ? 'Claude took too long to answer. Try again.' : 'Could not reach Claude. Check your internet connection.'); }
  clearTimeout(tm);
  let data = null; try { data = await res.json(); } catch (e) { }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || res.statusText || 'Unknown error';
    if (res.status === 401) throw new Error('The API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Too many requests right now. Wait a minute and try again.');
    if (res.status === 529 || res.status === 503) throw new Error('Claude is busy right now. Try again shortly.');
    throw new Error(`Claude returned an error (${res.status}): ${msg}`);
  }
  const text = ((data && data.content) || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
  return { text: text || '(empty answer)', usage: data.usage ? { in: data.usage.input_tokens, out: data.usage.output_tokens } : null };
}
function apiMessages(a) {
  return a.msgs.map((m, i) => {
    if (m.role === 'user' && i === 0) return { role: 'user', content: [...a.photos.map(p => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.b64 } })), { type: 'text', text: m.text }] };
    return { role: m.role, content: m.text };
  });
}
async function runAI() {
  const a = ai; a.busy = true; a.error = ''; render();
  try {
    const r = await callClaude(apiMessages(a));
    a.msgs.push({ role: 'assistant', text: r.text });
    if (r.usage) a.usage = { in: (a.usage ? a.usage.in : 0) + r.usage.in, out: (a.usage ? a.usage.out : 0) + r.usage.out };
  } catch (e) {
    a.error = e.message;
    if (a.msgs.length && a.msgs[a.msgs.length - 1].role === 'user') { const u = a.msgs.pop(); if (a.msgs.length === 0) a.symptoms = a.symptoms || ''; else a.followup = u.text; }
  }
  a.busy = false; if (route().parts[0] === 'ai') render();
}

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
    default: html = vToday(); tab = 'today';
  }
  const t = [['today', 'Today', 'sun'], ['fields', 'Fields', 'leaf'], ['records', 'Records', 'list'], ['stock', 'Stock', 'box'], ['money', 'Money', 'coin'], ['power', 'Power', 'bolt']];
  app.innerHTML = `<main>${html}</main><nav class="tabs" aria-label="Main">${t.map(([k, l, i]) => `<a href="#${k}" class="${tab === k ? 'on' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${ic(i)}${l}</a>`).join('')}</nav>`;
  if (resetScroll) window.scrollTo(0, 0);
  if (v === 'settings') {
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
  aimode: el => { db.settings.aiMode = el.dataset.v; save(); render(); },
  aisavekey: () => {
    const k = val('set_key');
    if (!k) return toast('Paste your API key first.');
    if (!/^sk-ant-/.test(k)) toast('That does not look like a Claude API key (they start with sk-ant-). Saved anyway.');
    try { localStorage.setItem(AI_KEY, k); } catch (e) { return toast('Could not save the key on this device.'); }
    db.settings.aiModel = val('set_model') || AI_MODELS[0][0]; save(); toast('Key saved on this phone'); render();
  },
  aidelkey: async () => { if (!await ask('Remove the API key from this phone?', 'Remove')) return; try { localStorage.removeItem(AI_KEY); } catch (e) { } toast('Key removed'); render(); },
  aitest: async () => {
    db.settings.aiModel = val('set_model') || db.settings.aiModel || AI_MODELS[0][0]; save();
    toast('Testing…');
    try { await callClaude([{ role: 'user', content: 'Reply with the single word OK.' }], 10); toast('Connected to Claude ✓'); }
    catch (e) { toast(e.message); }
  },
  aikind: el => { ai.kind = el.dataset.v; render(); },
  aidelphoto: el => { ai.photos.splice(+el.dataset.i, 1); render(); },
  aisend: () => {
    if (!ai.symptoms.trim() && !ai.photos.length) return toast('Add a photo or describe what you see.');
    ai.msgs = [{ role: 'user', text: firstPrompt(ai), display: (ai.symptoms.trim() || 'Please look at the photos.') + (ai.photos.length ? `\n📷 ${ai.photos.length} photo${ai.photos.length > 1 ? 's' : ''}` : '') }];
    runAI();
  },
  aifollow: () => {
    const f = ai.followup.trim(); if (!f) return toast('Type your follow-up question.');
    ai.msgs.push({ role: 'user', text: f, display: f }); ai.followup = ''; runAI();
  },
  aishare: async () => {
    if (!ai.symptoms.trim() && !ai.photos.length) return toast('Add a photo or describe what you see.');
    const text = sharePrompt(ai);
    let copied = false; try { await navigator.clipboard.writeText(text); copied = true; } catch (e) { }
    const files = ai.photos.map(p => p.file);
    try {
      if (navigator.share && (!files.length || (navigator.canShare && navigator.canShare({ files })))) {
        await navigator.share(files.length ? { text, files } : { text });
        toast(copied ? 'Pick Claude. The question is also copied — paste it if it does not appear.' : 'Pick Claude in the list.');
      } else {
        window.open('https://claude.ai/new', '_blank', 'noopener');
        toast(copied ? 'Question copied. Paste it into Claude and attach your photos.' : 'Open Claude and describe the problem.');
      }
    } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed. Use Copy question, then Open Claude.'); }
  },
  aicopy: async () => { try { await navigator.clipboard.writeText(sharePrompt(ai)); toast('Question copied. Paste it into Claude.'); } catch (e) { toast('Could not copy on this device.'); } },
  aisave: async () => {
    const ans = ai.msgs.filter(m => m.role === 'assistant').map(m => m.text).join('\n\n---\n\n');
    const found = await askText('What was found? (short, e.g. Early blight)');
    if (!found) return;
    db.records.push({ id: uid(), created: Date.now(), type: 'scouting', status: 'done', date: today(), blockId: ai.blockId, title: '', target: found, lines: [], waterLha: '', tankL: '', phiDays: '', ec: '', ph: '', severity: '', count: '', minutes: '', m3: '', notes: (ai.symptoms.trim() ? 'Seen: ' + ai.symptoms.trim() + '\n\n' : '') + 'Claude advice:\n' + ans, used: null });
    save(); toast('Saved as a scouting record'); go(ai.blockId ? '#block/' + ai.blockId : '#records');
  },
  ainew: () => { const b = ai.blockId; ai = freshAI(null); ai.blockId = b; render(true); },
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
    if (!await ask(`Delete ${bdraft.name}${n ? ` and its ${n} records` : ''}? This cannot be undone.`)) return;
    db.records = db.records.filter(r => r.blockId !== bdraft.id);
    db.blocks = db.blocks.filter(b => b.id !== bdraft.id);
    save(); bdraftKey = null; toast('Block deleted'); go('#fields');
  },
  savestock: () => {
    const form = document.getElementById('stockform'), id = form.dataset.id;
    const s = { name: val('s_name'), category: val('s_category'), group: val('s_group'), ai: val('s_ai'), qty: num(val('s_qty')), unit: val('s_unit'), reorderAt: val('s_reorderAt') === '' ? '' : num(val('s_reorderAt')), expiry: val('s_expiry'), phiDays: val('s_phiDays'), costPerUnit: val('s_costPerUnit') === '' ? '' : num(val('s_costPerUnit')), notes: val('s_notes') };
    if (!s.name) return toast('Enter the product name.');
    if (id) Object.assign(stockById(id), s); else db.stock.push({ id: uid(), ...s });
    save(); toast('Stock item saved'); go('#stock');
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
    db.stock = db.stock.filter(s => s.id !== id); save(); toast('Item deleted'); go('#stock');
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
  export: () => {
    try {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `farm-backup-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      db.settings.lastBackup = today(); save(); toast('Backup file downloaded'); render();
    } catch (e) { toast('Could not create the file on this device.'); }
  },
  install: async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { } installEvt = null; render(); },
  loadsample: async () => { if (!await ask('Replace everything on this phone with sample data?')) return; db = normalize(sampleData()); save(); toast('Sample data loaded'); go('#today'); },
  clearall: async () => {
    if (!await ask(db.settings.sample ? 'Clear the sample data and start with an empty farm?' : 'Erase ALL records on this phone? Export a backup first if you need them.')) return;
    const name = db.settings.sample ? 'My farm' : db.settings.farmName;
    db = blank(); db.settings.farmName = name; save(); toast('Data cleared'); go('#settings'); render();
  }
};
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
  } else if (el.id === 'ai_photo' && el.files && el.files.length && ai) {
    const fl = [...el.files].slice(0, 4 - ai.photos.length);
    Promise.all(fl.map(f => loadPhoto(f).catch(() => null))).then(ps => { const ok = ps.filter(Boolean); ai.photos.push(...ok); if (ok.length < fl.length) toast('One photo could not be read.'); render(); });
  } else if (el.id === 'importFile' && el.files && el.files[0]) {
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const o = JSON.parse(fr.result);
        if (!o || !Array.isArray(o.blocks) || !Array.isArray(o.records) || !Array.isArray(o.stock)) throw new Error('shape');
        if (!await ask(`Restore this backup (${o.blocks.length} blocks, ${o.records.length} records)? It replaces what is on this phone now.`)) return;
        db = Object.assign(blank(), o); db.settings = Object.assign(blank().settings, o.settings || {}); normalize(db); save(); toast('Backup restored'); go('#today'); render();
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
    if (el.dataset.f === 'blockId') { render(); return; }
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
