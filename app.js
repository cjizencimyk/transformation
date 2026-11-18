/* ============ ÉTAT ============ */
const KEY = 'transformation-v3';
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => dstr(new Date());
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fr = (n, d = 0) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

function defState() {
  const t = todayStr();
  return { start: t, weights: [{ d: t, w: 95 }], waist: [], log: { [t]: [{ n: 'Porridge protéiné à la banane', k: 430, p: 30, g: 58, l: 9, slot: 'pdj', id: 'r14' }] }, steps: { [t]: 3200 }, cig: {}, cigBase: 12, prog: {}, hist: [], favs: [], photos: {}, pp: [], plan: null, checked: {}, sound: true, height: 176, age: 25, goalW: 80, goalD: '2027-06-21', energy: 'mid' };
}
let S = defState(), hasLocal = false;
try { const r = localStorage.getItem(KEY); if (r) { S = Object.assign(defState(), JSON.parse(r)); hasLocal = true; } } catch (e) { }
const IDB = {
  open() { return this.p || (this.p = new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('no idb')); const r = indexedDB.open('transformation-v3', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(JSON.stringify(v)), k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
};
/* Reprise des données de l'ancienne version (base locale « transformation ») */
function readOld() {
  return new Promise(res => {
    if (!window.indexedDB) return res(null);
    let r; try { r = indexedDB.open('transformation'); } catch (e) { return res(null); }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { } };
    r.onerror = () => res(null); r.onblocked = () => res(null);
    r.onsuccess = () => {
      const db = r.result; if (!db.objectStoreNames.contains('docs')) { db.close(); return res(null); }
      const m = new Map(), c = db.transaction('docs').objectStore('docs').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { m.set(cur.key, cur.value); cur.continue(); return; } db.close();
        const prof = m.get('profile'); if (!prof) return res(null);
        const o = defState(); o.log = {}; o.steps = {}; o.start = prof.startDate || o.start; o.height = prof.height || 176;
        const W = (prof.body && prof.body.weight || []).filter(x => x && x.v > 30).map(x => ({ d: x.d, w: x.v })); if (W.length) o.weights = W;
        o.waist = (prof.body && prof.body.waist || []).filter(x => x && x.v > 30).map(x => ({ d: x.d, v: x.v }));
        m.forEach(v => {
          if (!v || typeof v !== 'object') return;
          if (v.kind === 'day') { o.log[v.date] = (v.items || []).map(it => ({ n: it.name, k: it.k, p: Math.round(it.p || 0), g: Math.round(it.c || 0), l: Math.round(it.f || 0), slot: it.meal || 'dej', id: '' })); if (v.steps) o.steps[v.date] = v.steps; }
          if (v.kind === 'workout') o.hist.push({ d: v.date, s: 'A', min: Math.max(1, Math.round(((v.endedAt || 0) - (v.startedAt || 0)) / 60000)), vol: Math.round(v.volume || 0), old: true });
          if (v.kind === 'photo' && v.thumb) { const f = m.get('pf_' + v.id); o.pp.push({ d: v.date, src: (f && f.data) || v.thumb }); }
        });
        o.hist.sort((a, b) => a.d < b.d ? -1 : 1); res(o);
      };
      c.onerror = () => { db.close(); res(null); };
    };
  });
}
async function boot() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  let migrated = false;
  try {
    const st = await IDB.get('state');
    if (st && (!hasLocal || (st.at || 0) >= (S.at || 0))) S = Object.assign(defState(), st);
    else if (hasLocal && st) { S.photos = st.photos || S.photos; S.pp = st.pp || S.pp; }
    else if (!hasLocal && !st) { const old = await readOld(); if (old) { S = old; migrated = true; save(); } }
  } catch (e) { }
  render();
  if (!migrated && S.weights.length > 2 && Date.now() - (S.lastBackup || 0) > 7 * 864e5) setTimeout(() => toast('Pense à télécharger ta sauvegarde (Réglages)'), 2500);
  if (migrated) setTimeout(() => toast('Tes données de l\'ancienne version ont été reprises'), 900);
  (window.requestIdleCallback || (f => setTimeout(f, 2500)))(() => loadProducts().catch(() => { }));
}
let saveWarned = false;
let idbT;
function save() { S.at = Date.now(); clearTimeout(idbT); idbT = setTimeout(() => IDB.set('state', S).catch(() => { }), 400); try { const o = Object.assign({}, S, { photos: {}, pp: [] }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { if (!saveWarned) { saveWarned = true; toast('Sauvegarde locale indisponible : pense à copier ta sauvegarde'); } } }
const U = { tab: 'home', food: 'wiz', wiz: { step: 0, a: {}, done: false, n: 24 }, filters: [], fav: false, q: '', deck: 0, chat: [], run: null, cat: 'all', area: 'Tunisian', eq: '', elist: null, pcat: 'all', psort: 'dens', pq: '', pn: 30, pporc: false };

/* ============ SONS ============ */
let AC;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume().catch(() => { }); return AC; }
function tone(f, t0, d, type = 'sine', v = .08) {
  if (!S.sound) return; const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .05);
}
const SND = {
  tap: () => tone(520, 0, .06, 'triangle', .05), pop: () => { tone(660, 0, .08, 'sine', .07); tone(990, .05, .1, 'sine', .05); },
  keep: () => { tone(523, 0, .1, 'triangle', .07); tone(784, .08, .18, 'triangle', .07); }, skip: () => tone(240, 0, .1, 'sine', .05),
  set: () => { tone(587, 0, .12, 'sine', .09); tone(880, .09, .22, 'sine', .09); }, tick: () => tone(880, 0, .07, 'square', .035),
  go: () => { tone(784, 0, .12, 'triangle', .09); tone(1175, .1, .28, 'triangle', .09); }, win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .35, 'triangle', .09))
};
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

/* ============ ICÔNES ============ */
const IC = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', dumb: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  bowl: '<path d="M3 12h18a9 9 0 0 1-18 0zM8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>', chart: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', heart: '<path d="M12 20.5s-8-4.8-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.1c0 5.6-8 10.4-8 10.4z"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5z"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  vol: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', mute: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4zM17 9.5l5 5M22 9.5l-5 5"/>',
  cam: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>', minus: '<path d="M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>', swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  cart: '<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"/>', chev: '<path d="M9 6l6 6-6 6"/>'
};
const ico = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

/* ============ CALCULS ============ */
const lastW = () => [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1).slice(-1)[0].w;
/* Ajustement hebdomadaire : vise environ 0,6 kg perdu par semaine (tendance sur 21 jours) */
function trendAdj() {
  const W = S.weights.filter(x => dayDiff(x.d, todayStr()) <= 21);
  if (W.length < 3 || dayDiff(S.start, todayStr()) < 14) return { adj: 0, rate: null };
  const t0 = W[0].d, xs = W.map(x => dayDiff(t0, x.d)), ys = W.map(x => x.w), n = W.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  const den = xs.reduce((s, v) => s + (v - mx) ** 2, 0); if (!den || Math.max(...xs) < 10) return { adj: 0, rate: null };
  const rate = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / den * 7;
  const adj = rate > -0.3 ? -100 : rate < -1 ? 100 : 0;
  return { adj: adj * Math.min(3, 1 + Math.floor(Math.max(0, (rate > -0.3 ? -0.3 - rate : rate < -1 ? -1 - rate : 0)) / 0.3)), rate };
}
function tgt() {
  const w = lastW(), bmr = 10 * w + 6.25 * S.height - 5 * S.age + 5, tdee = bmr * 1.4, ta = trendAdj();
  const k = Math.round((tdee - 500 + ta.adj) / 10) * 10, p = Math.round(w * 1.8 / 5) * 5, l = Math.round(w * .8 / 5) * 5, g = Math.max(80, Math.round((k - p * 4 - l * 9) / 20) * 5);
  return { k, p, g, l, tdee: Math.round(tdee), bmr: Math.round(bmr), adj: ta.adj, rate: ta.rate };
}
function totals(date = todayStr()) { return (S.log[date] || []).reduce((o, e) => ({ k: o.k + e.k, p: o.p + e.p, g: o.g + e.g, l: o.l + e.l }), { k: 0, p: 0, g: 0, l: 0 }); }
const SLOTS = [['pdj', 'Petit-déjeuner'], ['dej', 'Déjeuner'], ['col', 'Collation'], ['din', 'Dîner']];
function slotNow() { const h = new Date().getHours(); return h < 10 ? 'pdj' : h < 15 ? 'dej' : h < 18 ? 'col' : 'din'; }
function mealBudget() { const h = new Date().getHours(), left = h < 10 ? 3 : h < 15 ? 2.2 : h < 19 ? 1.6 : 1; return Math.max(250, (tgt().k - totals().k) / left); }
const weekNo = () => Math.floor(dayDiff(S.start, todayStr()) / 7) + 1;
const cycleWeek = () => ((weekNo() - 1) % 12) + 1;
const phaseOf = w => PHASES.find(p => w <= p.to);
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dstr(d); };
const doneToday = () => S.hist.some(h => h.d === todayStr());
function nextSid() { const done = new Set(S.hist.filter(h => h.d >= weekStart()).map(h => h.s)); return Object.keys(SESSIONS).find(k => !done.has(k)) || 'A'; }
function sessionToday() { const d = new Date().getDay(); return Object.keys(SESSIONS).find(k => SESSIONS[k].day === d) || null; }
const allItems = () => [...RECIPES.map(r => ({ ...r, kind: 'recipe' })), ...FAST.flatMap(c => c.items.map(i => ({ ...i, kind: 'fast', chain: c.chain })))];
function findItem(id) { if (String(id).startsWith('off:')) { const pr = BYCODE && BYCODE.get(id.slice(4)); return pr ? prodItem(pr) : null; } return allItems().find(i => i.id === id); }
function addLog(it, m = 1, slot = slotNow()) {
  const t = todayStr(); (S.log[t] = S.log[t] || []).push({ n: it.name || it.n, k: Math.round(it.k * m), p: Math.round(it.p * m), g: Math.round(it.g * m), l: Math.round(it.l * m), slot, id: it.id || '' });
  save(); SND.pop(); buzz(12); toast('Ajouté au journal · ' + Math.round(it.k * m) + ' kcal');
}

/* ============ PRODUITS (Open Food Facts) ============ */
const FOODS = window.FORGE_FOODS || [];
let PRODUCTS = null, BYCODE = null, prodP = null, PICARDP = null;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tidy = t => { const L = t.replace(/[^A-Za-zÀ-ÿ]/g, ''); if (L.length > 3 && L === L.toUpperCase()) { t = t.toLowerCase(); t = t.charAt(0).toUpperCase() + t.slice(1); } return t; };
const PORK = /porc|jambon|lardon|bacon|saucisse|chorizo|pepperoni|salami|saucisson|boudin|rillette|andouill|poitrine (fumee|salee|de porc)|charcuterie|cordon bleu|pancetta|coppa|mortadelle|knack|hot ?dog|carbonara|choucroute|cassoulet|tartiflette|croque|speck|chipolata|pate de campagne|pate en croute|lard|reine|lorraine|rosette|figatelli|cervelas/;
function loadProducts() {
  if (prodP) return prodP;
  prodP = loadScript('products.js').then(() => {
    PRODUCTS = []; BYCODE = new Map();
    (window.FORGE_OFF || '').split('\n').forEach(line => {
      const a = line.split('|'); if (a.length < 9) return;
      const pr = { code: a[0], name: tidy(a[1]), brand: tidy(a[2]), qty: a[3], k: +a[4], p: +a[5], c: +a[6], f: +a[7], sg: +a[8] };
      if (pr.brand && norm(pr.name).includes(norm(pr.brand))) pr.brand = '';
      pr.key = norm(pr.name + ' ' + pr.brand); PRODUCTS.push(pr); BYCODE.set(pr.code, pr);
    });
    window.FORGE_OFF = null; return PRODUCTS;
  }).catch(e => { prodP = null; PRODUCTS = null; throw e; });
  return prodP;
}
function typeOf(n) {
  n = norm(n);
  if (/saumon|cabillaud|colin|merlu|poisson|thon|crevette|jacques|sole|lieu|truite|dorade|bar |gambas/.test(n)) return 'fish';
  if (/pizza|tarte|flammekueche|quiche/.test(n)) return 'pizza'; if (/burger|sandwich|panini|wrap|kebab/.test(n)) return 'burger';
  if (/pate|spaghetti|lasagne|tagliatelle|gnocchi|ravioli|penne|macaroni|tortellini|nouille/.test(n)) return 'pasta';
  if (/glace|creme|dessert|mousse|tiramisu|fondant|sorbet|gateau|macaron|eclair|cookie|brownie|buche|biscuit|chocolat/.test(n)) return 'dessert';
  if (/poulet|nugget|tenders|escalope|dinde|volaille/.test(n)) return 'tenders'; if (/pomme de terre|puree|gratin|parmentier|frite|rosti/.test(n)) return 'pie';
  if (/riz|bowl|salade|wok|legume|poelee|quinoa|ble |boulgour|haricot|petits pois/.test(n)) return 'bowl'; return 'stew';
}
function productFood(pr) {
  let portion = '100 g', pg = 100, pack = 0; const m = /([\d.,]+)\s*(g|ml|cl|l|kg)\b/i.exec(pr.qty || '');
  if (m) { const v = parseFloat(m[1].replace(',', '.')), u = m[2].toLowerCase(); pack = u === 'kg' || u === 'l' ? v * 1000 : u === 'cl' ? v * 10 : v; }
  if (pr.sg > 0 && pr.sg < 1500) { portion = '1 portion'; pg = pr.sg; } else if (pack > 0 && pack <= 400) { portion = '1 paquet ou 1 pot'; pg = Math.round(pack); }
  return { portion, pg };
}
const prodCache = new Map();
function prodItem(pr) {
  if (prodCache.has(pr.code)) return prodCache.get(pr.code);
  const f = productFood(pr), m = f.pg / 100, picard = /picard/.test(pr.key), t = typeOf(pr.name);
  const it = { id: 'off:' + pr.code, kind: picard ? 'picard' : 'off', name: pr.brand && !picard ? pr.name + ' (' + pr.brand + ')' : pr.name, q: f.portion + ' · ' + f.pg + ' g', k: Math.round(pr.k * m), p: Math.round(pr.p * m), g: Math.round(pr.c * m), l: Math.round(pr.f * m), t, tone: '#27506B', porc: PORK.test(pr.key) };
  prodCache.set(pr.code, it); return it;
}
function picardList() { if (!PICARDP && PRODUCTS) PICARDP = PRODUCTS.filter(p => /picard/.test(p.key) && p.k > 0).map(prodItem).filter(it => it.k >= 30); return PICARDP || []; }
function findCode(code) { if (!BYCODE || !code) return null; const c = String(code).replace(/\D/g, ''); return BYCODE.get(c) || BYCODE.get('0' + c) || BYCODE.get(c.replace(/^0+/, '')) || null; }
async function decodeBarcode(file) {
  const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
  if ('BarcodeDetector' in window) { try { const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }), r = await det.detect(img); if (r && r[0]) return r[0].rawValue; } catch (e) { } }
  if (!window.ZXing) await loadScript('vendor/zxing.min.js');
  const ZX = window.ZXing, hints = new Map();
  hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E]); hints.set(ZX.DecodeHintType.TRY_HARDER, true);
  const reader = new ZX.MultiFormatReader(); reader.setHints(hints); const W0 = img.naturalWidth, H0 = img.naturalHeight;
  for (const sz of [1200, 800, 1700, 600]) for (const rot of [0, 90]) {
    const s = Math.min(1, sz / Math.max(W0, H0)), w = Math.round(W0 * s), h = Math.round(H0 * s), c = document.createElement('canvas'); c.width = rot ? h : w; c.height = rot ? w : h;
    const ctx = c.getContext('2d'); if (rot) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); } ctx.drawImage(img, 0, 0, w, h);
    try { const r = reader.decode(new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.HTMLCanvasElementLuminanceSource(c)))); if (r) return r.getText(); } catch (e) { }
  }
  return null;
}
const ANIMS = { pompes: 'pushup', dev: 'floorpress', elev: 'lateral', tri: 'triceps', dips: 'dips', planche: 'plank', trac: 'pullup', row: 'row1', rowe: 'bentrow', face: 'reardelt', curl: 'curl', squat: 'goblet', fente: 'lunge', sdt: 'rdl', hip: 'hipthrust', mollets: 'calf', rameur: 'rower' };
const animOf = id => (id === 'pompes' && exState(id).lvl < 2) ? 'pushinc' : (ANIMS[id] || 'pushup');
const animSvg = (id, still, cue) => window.TF_ANIM ? window.TF_ANIM.svg(animOf(id), '', still, cue) : '';
const animMount = r => { try { window.TF_ANIM && window.TF_ANIM.mount(r || document); } catch (e) { } };

/* ============ VISUELS ============ */
const seedOf = id => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 9973; return h + 1; };
const artCache = {};
const OFFIMG = (() => { try { return JSON.parse(localStorage.getItem('tf-offimg') || '{}'); } catch (e) { return {}; } })();
function plate(it, cls = '') {
  const ph = S.photos[it.id], P = PHOTOS[it.id], off = String(it.id).startsWith('off:') ? it.id.slice(4) : '';
  const key = it.id + (it.tone ? 'p' : '');
  let inner_ = artCache[key] || (artCache[key] = it.tone ? pack(inner(it.t, seedOf(it.id), it.c, it.c2), seedOf(it.id), it.tone) : art(it.t, seedOf(it.id), it.c, it.c2));
  if (ph) inner_ = `<img src="${ph}" alt="${esc(it.name)}">`;
  else if (P) inner_ += `<img class="rp" src="${P[0]}" alt="${esc(it.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`;
  else if (off && OFFIMG[off]) inner_ += `<img class="rp" src="${OFFIMG[off]}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
  const bg = it.bg ? `background:radial-gradient(circle at 30% 20%,${it.bg[1]},${it.bg[0]} 75%)` : `background:radial-gradient(circle at 30% 20%,${it.tone || it.col || '#2A3A32'},#0F1A14 80%)`;
  return `<div class="plate ${cls}" style="${bg}"${off && OFFIMG[off] === undefined ? ` data-off="${off}"` : ''}>${inner_}</div>`;
}
/* Photos des produits : récupérées à la demande auprès d'Open Food Facts puis gardées */
let offQ = 0, offT;
function hydrateOff() {
  clearTimeout(offT); offT = setTimeout(() => {
    document.querySelectorAll('.plate[data-off]').forEach(el => {
      const code = el.dataset.off; el.removeAttribute('data-off'); if (offQ > 5 || OFFIMG[code] !== undefined) return; offQ++;
      fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '?fields=image_front_small_url').then(r => r.json()).then(j => {
        const u = j && j.product && j.product.image_front_small_url || ''; OFFIMG[code] = u;
        try { localStorage.setItem('tf-offimg', JSON.stringify(OFFIMG)); } catch (e) { }
        if (u && el.isConnected) { const im = document.createElement('img'); im.className = 'rp'; im.src = u; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); el.appendChild(im); }
      }).catch(() => { }).finally(() => { offQ--; });
    });
  }, 150);
}
function ring(vals) {
  const C = [326.7, 251.3, 175.9], R = [52, 40, 28], col = ['var(--lime)', 'var(--peach)', 'var(--aqua)'];
  return `<svg class="ring" width="150" height="150" viewBox="0 0 120 120" role="img" aria-label="Anneaux du jour : calories ${Math.round(vals[0] * 100)} %, protéines ${Math.round(vals[1] * 100)} %, pas ${Math.round(vals[2] * 100)} %">${R.map((r, i) => `<circle class="tr" cx="60" cy="60" r="${r}"/><circle class="pg" cx="60" cy="60" r="${r}" style="--c:${C[i]};--o:${(C[i] * (1 - clamp(vals[i], 0, 1))).toFixed(1)};color:${col[i]};stroke:currentColor;animation-delay:${i * 120}ms"/>`).join('')}</svg>`;
}
function resizeImg(file, max = 520) {
  return new Promise((res, rej) => {
    const fr_ = new FileReader(); fr_.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)); }; im.onerror = rej; im.src = fr_.result; }; fr_.onerror = rej; fr_.readAsDataURL(file);
  });
}

/* ============ NAV + RENDU ============ */
const TABS = [['home', 'Aujourd\'hui', 'home'], ['sport', 'Sport', 'dumb'], ['food', 'Manger', 'bowl'], ['coach', 'Coach', 'spark'], ['track', 'Suivi', 'chart']];
function renderNav() {
  const i = TABS.findIndex(t => t[0] === U.tab);
  $('#nav').innerHTML = `<i class="ind" style="transform:translateX(${i * 100}%)"></i>` + TABS.map(t => `<button data-act="tab" data-v="${t[0]}" class="${U.tab === t[0] ? 'on' : ''}" aria-label="${t[1]}" ${U.tab === t[0] ? 'aria-current="page"' : ''}>${ico(t[2], 24)}<span>${t[1]}</span></button>`).join('');
}
const VIEWS = {};
function render(keepScroll) {
  const v = $('#view'), sc = $('#app').scrollTop;
  v.innerHTML = VIEWS[U.tab]();
  $('#app').scrollTop = keepScroll ? sc : 0;
  renderNav(); afterRender();
}
function go(tab) {
  if (tab === U.tab) { $('#app').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  U.tab = tab; SND.tap();
  if (document.startViewTransition) document.startViewTransition(() => render()); else render();
}
function afterRender() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, t0 = performance.now(), dur = 900, dec = +el.dataset.dec || 0;
    const step = now => { const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fr(to * e, dec); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
  });
  animMount($('#view')); hydrateOff(); if (U.tab === 'food' && U.food === 'recipes') bindDeck();
}

/* ============ VUE : AUJOURD'HUI ============ */
function bestNow(n = 2) {
  const budget = mealBudget(), need = Math.max(0, tgt().p - totals().p), slot = slotNow();
  return RECIPES.filter(r => slot === 'col' ? r.tags.includes('dessert') || r.k < 450 : !r.tags.includes('dessert')).map(r => ({ r, s: -Math.abs(r.k - budget) / 100 + r.p / Math.max(1, r.k) * 18 + (r.p <= need ? 1 : 0) })).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.r);
}
VIEWS.home = () => {
  const R = { T: tgt(), d: totals() }, steps = S.steps[todayStr()] || 0, left = Math.max(0, R.T.k - R.d.k), pl = Math.max(0, R.T.p - R.d.p);
  const h = new Date().getHours(), hello = h < 5 ? 'Nuit blanche ?' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const date0 = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), date = date0.charAt(0).toUpperCase() + date0.slice(1);
  const sid = sessionToday(), ph = phaseOf(cycleWeek());
  const cig = S.cig[todayStr()] || 0, cigT = Math.max(0, S.cigBase - (weekNo() - 1));
  const best = bestNow();
  let i = 0;
  return `
  <header class="top rise" style="--i:${i++}"><div><div class="small mute">${date}</div><h1 class="h1">${hello}</h1></div>
    <div class="row" style="gap:6px"><button class="ibtn glass" data-act="sound" aria-label="${S.sound ? 'Couper les sons' : 'Activer les sons'}">${ico(S.sound ? 'vol' : 'mute')}</button><button class="ibtn glass" data-act="settings" aria-label="Réglages">${ico('gear')}</button></div></header>

  <section class="card glass halo rise" style="--i:${i++};display:flex;gap:16px;align-items:center" aria-label="Résumé du jour">
    ${ring([R.d.k / R.T.k, R.d.p / R.T.p, steps / 8000])}
    <div class="col" style="gap:12px">
      <div><div class="small mute">Calories restantes</div><div class="num" style="font-size:30px;color:var(--lime);line-height:1"><span data-count="${left}">${fr(left)}</span> <span class="small mute" style="font-weight:500">/ ${fr(R.T.k)}</span></div></div>
      <div><div class="small mute">Protéines à aller chercher</div><div class="num" style="font-size:22px;color:var(--peach);line-height:1"><span data-count="${pl}">${pl}</span> g</div></div>
      <div class="row" style="gap:8px"><div><div class="small mute">Pas</div><div class="num" style="font-size:22px;color:var(--aqua);line-height:1">${fr(steps)}</div></div>
        <button class="chip" data-act="steps" data-v="1000" style="min-height:32px;padding:0 11px">+1 000</button></div>
    </div>
  </section>

  <section class="card glass rise" style="--i:${i++}">
    <div class="eyebrow">Ta meilleure décision maintenant</div>
    <h2 class="h2" style="margin:6px 0 12px">${slotNow() === 'col' ? 'Une collation qui tient' : 'Il te reste ' + fr(left) + ' kcal et ' + pl + ' g de protéines'}</h2>
    <div class="grid2">${best.map(r => `<div class="col" style="gap:8px"><button class="dish glass" data-act="open" data-v="${r.id}" style="padding:10px">${plate(r)}<div style="font-weight:700;line-height:1.2;font-size:15px">${esc(r.name)}</div><div class="macro"><span><b>${r.k}</b> kcal</span><span><b>${r.p}</b> g</span></div></button><button class="btn sm" data-act="log" data-v="${r.id}">${ico('plus', 16)} Ajouter</button></div>`).join('')}</div>
    <button class="btn block" style="margin-top:12px" data-act="wiz">${ico('spark', 18)} Qu'est-ce qu'on mange ?</button>
  </section>

  <section class="card glass rise" style="--i:${i++};background:linear-gradient(140deg,rgba(214,244,108,.22),rgba(98,227,207,.08))">
    ${sid ? `<div class="eyebrow">Séance du jour · semaine ${cycleWeek()} · ${ph.name}</div>
      <h2 class="h2" style="margin:6px 0 4px">${SESSIONS[sid].name}</h2><div class="mute small">${SESSIONS[sid].min} min · ${SESSIONS[sid].ex.length} exercices · ${ph.rpe}</div>
      <div class="row" style="margin-top:14px"><button class="btn grow" data-act="run" data-v="${sid}">${ico('play', 18)} Lancer la séance</button><button class="btn ghost" data-act="tab" data-v="sport">Détails</button></div>`
      : doneToday() ? `<div class="eyebrow">Séance terminée</div><h2 class="h2" style="margin:6px 0 4px">Bien joué</h2><div class="mute small">Mange bien, hydrate-toi, dors tôt. Le muscle se construit pendant la récupération.</div>
      <div class="row" style="margin-top:14px"><button class="btn ghost grow" data-act="tab" data-v="sport">Voir le programme</button></div>`
      : `<div class="eyebrow">Jour de récupération conseillé</div><h2 class="h2" style="margin:6px 0 4px">Marche et mobilité</h2><div class="mute small">Le programme prévoit du repos aujourd'hui. Mais tu peux t'entraîner : la prochaine séance est « ${SESSIONS[nextSid()].name} ».</div>
      <div class="row" style="margin-top:14px"><button class="btn grow" data-act="run" data-v="${nextSid()}">${ico('play', 18)} Faire la séance ${nextSid()}</button><button class="btn ghost" data-act="tab" data-v="sport">Programme</button></div>`}
  </section>

  <section class="col rise" style="--i:${i++}">
    <div class="row between"><h2 class="h2">Journal</h2><button class="btn sm" data-act="add" data-v="${slotNow()}">${ico('plus', 16)} Ajouter</button></div>
    ${SLOTS.map(([id, label]) => {
      const es = (S.log[todayStr()] || []).map((e, ix) => ({ ...e, ix })).filter(e => e.slot === id), k = es.reduce((a, e) => a + e.k, 0);
      return `<div class="card glass" style="padding:14px 16px"><div class="row between"><div style="font-weight:700">${label}</div><div class="row" style="gap:8px"><span class="small mute">${k ? k + ' kcal' : ''}</span><button class="ibtn" style="width:34px;height:34px" data-act="add" data-v="${id}" aria-label="Ajouter au ${label}">${ico('plus', 18)}</button></div></div>
      ${es.length ? es.map(e => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line);gap:10px"><div class="grow"><div style="font-size:15px">${esc(e.n)}</div><div class="small mute">${e.k} kcal · ${e.p} g prot.</div></div><button class="ibtn" style="width:36px;height:36px" data-act="del" data-v="${e.ix}" aria-label="Retirer ${esc(e.n)}">${ico('trash', 17)}</button></div>`).join('') : '<div class="small mute" style="margin-top:2px">Rien pour l\'instant</div>'}</div>`;
    }).join('')}
  </section>

  <section class="card glass rise row between" style="--i:${i++}"><div><div class="small mute">Cigarettes aujourd'hui</div><div class="num" style="font-size:28px">${cig} <span class="small mute" style="font-weight:500">/ ${cigT} visées cette semaine</span></div></div>
    <div class="row" style="gap:8px"><button class="ibtn glass" data-act="cig" data-v="-1" aria-label="Une de moins">${ico('minus')}</button><button class="ibtn glass" data-act="cig" data-v="1" aria-label="Une de plus">${ico('plus')}</button></div></section>`;
};

/* ============ VUE : SPORT ============ */
function setsFor(id, energy = S.energy) { const e = EX[id], ph = phaseOf(cycleWeek()); if (e.timed && e.sets === 1) return 1; return Math.max(2, e.sets + ph.setMod + (energy === 'low' ? -1 : 0)); }
function exState(id) {
  const e = EX[id], p = S.prog[id] || {};
  return { load: e.load ? (p.load ?? e.load[0]) : null, lvl: p.lvl ?? (e.lvl || 0), tsec: p.tsec ?? e.reps[0] };
}
function exLabel(id) { const e = EX[id], s = exState(id); return e.vars ? e.vars[Math.min(s.lvl, e.vars.length - 1)] : e.name; }
function exTarget(id) {
  const e = EX[id], s = exState(id), n = setsFor(id);
  if (e.timed) return e.reps[0] >= 300 ? `${Math.round(s.tsec / 60)} min` : `${n} × ${s.tsec} s`;
  return `${n} × ${e.reps[0]}-${e.reps[1]}` + (s.load ? ` · 2 × ${s.load} kg` : '');
}
VIEWS.sport = () => {
  const w = cycleWeek(), ph = phaseOf(w), sid = sessionToday(), cyc = Math.floor((weekNo() - 1) / 12) + 1;
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], map = {}; Object.entries(SESSIONS).forEach(([k, s]) => map[s.day] = k);
  const td = (new Date().getDay() + 6) % 7; let i = 0;
  return `
  <header class="top rise" style="--i:${i++}"><div><div class="small mute">Cycle ${cyc} · semaine ${w} sur 12</div><h1 class="h1">Sport</h1></div></header>
  <section class="card glass halo rise" style="--i:${i++}">
    <div class="row between"><div class="eyebrow">${ph.name}</div><span class="tag">${ph.rpe.split(' : ')[0]}</span></div>
    <div class="small mute" style="margin:4px 0 12px">${ph.rpe}</div>
    <div style="display:flex;gap:4px">${Array.from({ length: 12 }, (_, k) => `<i style="flex:1;height:8px;border-radius:4px;background:${k + 1 < w ? 'var(--lime)' : k + 1 === w ? 'var(--aqua)' : 'rgba(255,255,255,.14)'};${k + 1 === w ? 'box-shadow:0 0 12px var(--aqua)' : ''}"></i>`).join('')}</div>
    <div class="row between small mute" style="margin-top:6px"><span>Adaptation</span><span>Volume</span><span>Intensité</span><span>Décharge</span></div>
  </section>
  <section class="rise" style="--i:${i++};display:flex;gap:6px">${days.map((d, k) => { const sn = map[k + 1 > 6 ? 0 : k + 1] || (k === 6 ? null : null); const code = Object.keys(SESSIONS).find(s => (SESSIONS[s].day + 6) % 7 === k); return `<div class="glass" style="flex:1;border-radius:20px;padding:10px 0;text-align:center;${k === td ? 'background:linear-gradient(160deg,rgba(214,244,108,.5),rgba(214,244,108,.2));' : ''}"><div class="small ${k === td ? '' : 'mute'}" style="${k === td ? 'color:#0B140E;font-weight:700' : ''}">${d}</div><div class="num" style="font-size:20px;${k === td ? 'color:#0B140E' : ''}">${code || '·'}</div></div>`; }).join('')}</section>
  <section class="card glass rise col" style="--i:${i++}">
    <div class="small mute">Ton énergie aujourd'hui</div>
    <div class="row" style="gap:6px;padding:4px;border-radius:22px;background:rgba(255,255,255,.06)">${[['low', 'Faible'], ['mid', 'Normale'], ['high', 'Forte']].map(([k, l]) => `<button class="chip grow ${S.energy === k ? 'on' : ''}" style="justify-content:center;border:0" data-act="energy" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="small mute">${S.energy === 'low' ? 'Une série de moins par exercice. Tu gardes la régularité.' : S.energy === 'high' ? 'Séries complètes. Vise le haut de la fourchette de répétitions.' : 'Séries complètes. Arrête-toi à la fourchette prévue.'}</div>
  </section>
  ${Object.entries(SESSIONS).map(([k, s]) => `<section class="card glass rise col" style="--i:${i++}${k === sid ? ';background:linear-gradient(140deg,rgba(214,244,108,.2),rgba(255,255,255,.05))' : ''}">
    <div class="row between"><div><div class="eyebrow">Séance ${k}${k === sid ? ' · aujourd\'hui' : ''}</div><h2 class="h2" style="margin-top:4px">${s.name}</h2></div><span class="tag">${s.min} min</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[0, Math.floor(s.ex.length / 2), s.ex.length - 1].map(n => `<div><div class="stage cover">${animSvg(s.ex[n], true)}</div><div class="small mute" style="text-align:center;margin-top:4px;line-height:1.2">${esc(EX[s.ex[n]].mus.split(',')[0])}</div></div>`).join('')}</div>
    <div class="col" style="gap:0">${s.ex.map((id, n) => `<div class="row between" style="padding:9px 0;border-top:1px solid var(--line);gap:10px"><div class="row grow" style="gap:12px"><div class="thumb">${animSvg(id, true)}</div><div><div style="font-weight:600;line-height:1.2">${esc(exLabel(id))}</div><div class="small mute">${EX[id].mus}</div></div></div><div class="small" style="text-align:right;color:var(--lime);font-weight:700">${exTarget(id)}</div></div>`).join('')}</div>
    <button class="btn block" data-act="run" data-v="${k}">${ico('play', 18)} Lancer la séance ${k}</button></section>`).join('')}
  <section class="card glass rise col" style="--i:${i++}"><h2 class="h2">Comment tu progresses</h2>
    <div class="small mute" style="line-height:1.55">Double progression. Tu travailles dans une fourchette de répétitions. Quand toutes tes séries atteignent le haut de la fourchette, la charge monte de 1 kg. Quand les haltères sont au maximum (2 × 10 kg), tu passes à la variante plus difficile : pompes plus déclinées, tractions avec un élastique plus fin, squat plus lent. Les jours sans séance, marche 8 000 pas. La semaine 12 allège le volume pour que tu repartes plus fort.</div></section>
  <section class="card glass rise col" style="--i:${i++}"><h2 class="h2">Dernières séances</h2>${S.hist.length ? S.hist.slice(-5).reverse().map(h => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><div><div style="font-weight:600">${esc(h.old ? 'Séance (ancienne version)' : (SESSIONS[h.s] ? SESSIONS[h.s].name : 'Séance'))}</div><div class="small mute">${new Date(h.d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${h.min} min</div></div><div class="num" style="color:var(--lime)">${fr(h.vol)} kg</div></div>`).join('') : '<div class="small mute">Aucune séance enregistrée. La première apparaîtra ici avec le volume soulevé.</div>'}</section>`;
};
/* ============ VUE : MANGER ============ */
const SEGS = [['wiz', 'Que manger ?'], ['recipes', 'Recettes'], ['explore', 'Explorer'], ['picard', 'Picard'], ['fast', 'Fast-food'], ['plan', 'Semaine']];
const macroRow = it => `<div class="macro"><span><b>${it.k}</b> kcal</span><span><b>${it.p}</b> g prot.</span>${it.min ? `<span>${it.min} min</span>` : ''}</div>`;
function filteredRecipes() {
  const toks = norm(U.q || '').split(/\s+/).filter(Boolean);
  return RECIPES.filter(r => (!U.fav || S.favs.includes(r.id)) && (U.cat === 'all' || toks.length || (r.cat || 'plat') === U.cat) && U.filters.every(f => r.tags.includes(f)) && toks.every(t => norm(r.name + ' ' + (r.cat || 'plat') + ' ' + r.tags.join(' ') + ' ' + r.ing.map(x => x[0]).join(' ')).includes(t)));
}
function deckHTML() {
  const pool = RECIPES.filter(r => !r.tags.includes('dessert') || true), n = pool.length, r = pool[U.deck % n], nx = pool[(U.deck + 1) % n];
  return `<div class="deck" id="deck" aria-label="Découvrir des plats">
    <div class="dcard next glass"><div class="art">${plate(nx)}</div></div>
    <div class="dcard glass" id="topcard"><span class="stamp k">GARDER</span><span class="stamp s">PASSER</span>
      <div class="art">${plate(r)}</div>
      <div class="info"><div class="row between"><div class="eyebrow">Découvrir · ${U.deck % n + 1}/${n}</div>${S.favs.includes(r.id) ? '<span class="tag">Favori</span>' : ''}</div>
      <h2 class="h2" style="margin:4px 0 6px">${esc(r.name)}</h2>${macroRow(r)}</div></div></div>
    <div class="row" style="justify-content:center;gap:18px">
      <button class="ibtn glass" style="width:62px;height:62px;border-radius:31px;color:var(--peach)" data-act="deck" data-v="skip" aria-label="Passer ce plat">${ico('x', 26)}</button>
      <button class="btn ghost" data-act="open" data-v="${r.id}">Voir la recette</button>
      <button class="ibtn glass" style="width:62px;height:62px;border-radius:31px;color:var(--lime)" data-act="deck" data-v="keep" aria-label="Garder en favori">${ico('heart', 26)}</button></div>`;
}
let deckBusy = false;
function deckFly(dir) {
  if (deckBusy) return; deckBusy = true; const c = $('#topcard'); if (!c) { deckBusy = false; return; }
  const pool = RECIPES, r = pool[U.deck % pool.length];
  c.style.transition = 'transform .45s cubic-bezier(.4,0,.6,1),opacity .45s'; c.style.transform = `translateX(${dir * 520}px) rotate(${dir * 24}deg)`; c.style.opacity = '0';
  if (dir > 0) { if (!S.favs.includes(r.id)) S.favs.push(r.id); save(); SND.keep(); buzz(15); } else SND.skip();
  setTimeout(() => { U.deck++; deckBusy = false; if (U.tab === 'food' && U.food === 'recipes') render(true); }, 380);
}
function bindDeck() {
  const c = $('#topcard'); if (!c) return; let x0 = null, dx = 0;
  const kst = c.querySelector('.stamp.k'), sst = c.querySelector('.stamp.s');
  c.addEventListener('pointerdown', e => { x0 = e.clientX; c.style.transition = 'none'; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (x0 === null) return; dx = e.clientX - x0; c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; kst.style.opacity = clamp(dx / 90, 0, 1); sst.style.opacity = clamp(-dx / 90, 0, 1); });
  const end = () => { if (x0 === null) return; x0 = null; if (Math.abs(dx) > 100) { deckFly(dx > 0 ? 1 : -1); } else { c.style.transition = ''; c.style.transform = ''; kst.style.opacity = sst.style.opacity = 0; } dx = 0; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
}
const PCATS = [['all', 'Tous', null], ['fish', 'Poisson', /saumon|cabillaud|colin|merlu|poisson|thon|crevette|jacques|sole|lieu|truite|dorade|gambas/], ['meat', 'Viande et volaille', /poulet|boeuf|veau|dinde|canard|agneau|steak|escalope|nugget|burger|volaille|viande|hache/], ['pasta', 'Pâtes, riz et plats', /pate|riz|gratin|lasagne|ravioli|gnocchi|risotto|couscous|parmentier|wok|bowl|curry|chili|tajine|puree/], ['pizza', 'Pizzas et tartes', /pizza|tarte|quiche|flammekueche|bagel|sandwich|wrap/], ['veg', 'Légumes', /legume|haricot|epinard|brocoli|carotte|courgette|poele|petits pois|pois chiche|ratatouille|ble |quinoa/], ['dessert', 'Desserts et glaces', /glace|dessert|creme|mousse|sorbet|fondant|tiramisu|gateau|macaron|eclair|buche|cookie|brownie|fruit/]];
const PSORTS = [['dens', 'Plus de protéines pour peu de calories'], ['prot', 'Le plus de protéines'], ['kcal', 'Le moins de calories']];
function picardFiltered() {
  const cat = PCATS.find(c => c[0] === U.pcat), toks = norm(U.pq || '').split(/\s+/).filter(Boolean);
  let l = picardList().filter(it => (U.pporc || !it.porc) && (!cat[2] || cat[2].test(norm(it.name))) && toks.every(t => norm(it.name).includes(t)));
  const dens = it => it.p / Math.max(60, it.k);
  l = l.slice().sort(U.psort === 'prot' ? (a, b) => b.p - a.p : U.psort === 'kcal' ? (a, b) => a.k - b.k : (a, b) => dens(b) - dens(a));
  return l;
}
function picardRow(p) {
  const d = p.p / Math.max(1, p.k) * 100;
  return `<div class="card glass col" style="padding:14px;${p.porc ? 'opacity:.6' : ''}"><div class="row" style="gap:14px;align-items:flex-start"><button style="width:78px;flex:none" data-act="open" data-v="${p.id}" aria-label="Voir ${esc(p.name)}">${plate(p)}</button>
    <div class="grow"><div style="font-weight:700;line-height:1.2">${esc(p.name)}</div><div class="small mute" style="margin:2px 0 6px">${p.q}</div>${macroRow(p)}</div></div>
    <div class="bar"><i style="width:${clamp(d / 9 * 100, 4, 100)}%${p.porc ? ';background:var(--peach)' : ''}"></i></div>
    <div class="row between"><span class="small mute">${f1(d)} g de protéines pour 100 kcal</span>${p.porc ? '<span class="tag w">Porc possible</span>' : ''}<button class="btn sm" data-act="log" data-v="${p.id}">${ico('plus', 15)} Ajouter</button></div></div>`;
}
function plistHTML() {
  const l = picardFiltered(), n = U.pn || 30;
  return l.slice(0, n).map(picardRow).join('') + (l.length > n ? `<button class="btn ghost block" data-act="pmore">Afficher plus (${l.length - n} restants)</button>` : '') + (!l.length ? '<div class="mute card glass" style="text-align:center">Aucun produit ne correspond.</div>' : '');
}
function picardHTML() {
  if (!PRODUCTS) { loadProducts().then(() => { if (U.tab === 'food' && U.food === 'picard') render(true); }).catch(() => { }); return `<section class="card glass rise" style="text-align:center">${prodP ? 'Chargement des produits Picard…' : 'Base de produits indisponible hors ligne pour l\'instant.'}</section>`; }
  const n = picardFiltered().length;
  return `<section class="col rise"><div class="small mute" style="line-height:1.5">${fr(picardList().length)} produits Picard, issus d'Open Food Facts. Les valeurs sont par portion. Les produits qui contiennent peut-être du porc sont masqués : vérifie toujours la liste d'ingrédients sur l'emballage.</div>
    <label class="sr" for="pq">Chercher un produit Picard</label><input id="pq" class="field" type="search" placeholder="Chercher : saumon, burger, gratin…" value="${esc(U.pq || '')}" data-in="pq" autocomplete="off">
    <div class="scrollx">${PCATS.map(c => `<button class="chip ${U.pcat === c[0] ? 'on' : ''}" data-act="pcat" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
    <div class="scrollx">${PSORTS.map(c => `<button class="chip ${U.psort === c[0] ? 'on' : ''}" data-act="psort" data-v="${c[0]}">${c[1]}</button>`).join('')}<button class="chip ${U.pporc ? 'on' : ''}" data-act="pporc">Afficher le porc possible</button></div>
    <div class="small mute" id="pcount">${fr(n)} produit${n > 1 ? 's' : ''}</div><div id="plist" class="col">${plistHTML()}</div></section>`;
}

/* ============ EXPLORER : recettes de cuisiniers du monde (TheMealDB) ============ */
const AREAS = [['Tunisian', 'Tunisien'], ['Moroccan', 'Marocain'], ['Turkish', 'Turc'], ['Egyptian', 'Égyptien'], ['Japanese', 'Japonais'], ['Indian', 'Indien'], ['Italian', 'Italien'], ['French', 'Français'], ['Greek', 'Grec'], ['Mexican', 'Mexicain'], ['Chinese', 'Chinois'], ['Thai', 'Thaï']];
const MEAL = 'https://www.themealdb.com/api/json/v1/1/', MPORK = /pork|bacon|\bham\b|prosciutto|sausage|chorizo|pancetta|lard|salami|gammon|pepperoni|ribs|black pudding|guanciale/i;
const mealCache = {};
async function mj(u) { const r = await fetch(MEAL + u); if (!r.ok) throw new Error('http'); return r.json(); }
let eT;
async function exploreLoad() {
  U.eload = true; U.eerr = false;
  try { const j = U.eq ? await mj('search.php?s=' + encodeURIComponent(U.eq)) : await mj('filter.php?a=' + U.area); U.elist = (j.meals || []).filter(m => !MPORK.test(m.strMeal)); }
  catch (e) { U.eerr = true; U.elist = []; }
  U.eload = false; if (U.tab === 'food' && U.food === 'explore') { const g = $('#egrid'); if (g) g.innerHTML = exploreGrid(); else render(true); }
}
function exploreGrid() {
  if (U.eload) return '<div class="mute card glass" style="grid-column:1/-1;text-align:center">Chargement des recettes…</div>';
  if (U.eerr) return '<div class="mute card glass" style="grid-column:1/-1;text-align:center">Impossible de charger les recettes. Vérifie ta connexion.</div>';
  if (!U.elist || !U.elist.length) return '<div class="mute card glass" style="grid-column:1/-1;text-align:center">Aucune recette trouvée. Essaie un mot en anglais (chicken, lamb, rice…).</div>';
  return U.elist.map(m => `<button class="dish glass" data-act="meal" data-v="${m.idMeal}" style="align-items:stretch;text-align:left"><div class="plate" style="border-radius:26px;aspect-ratio:1.05;background:#1b2a22"><img class="rp" src="${m.strMealThumb}/preview" alt="${esc(m.strMeal)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></div><div style="font-weight:700;line-height:1.2;font-size:15px;min-height:36px">${esc(m.strMeal)}</div></button>`).join('');
}
function exploreHTML() {
  if (!U.elist && !U.eload) exploreLoad();
  return `<section class="col rise"><div class="small mute" style="line-height:1.5">De vraies recettes de cuisiniers du monde entier, avec photos. Les plats au porc sont masqués. Les textes sont en anglais : un bouton les traduit.</div>
    <label class="sr" for="eq">Chercher une recette</label><input id="eq" class="field" type="search" placeholder="Chercher : lamb, chicken, couscous…" value="${esc(U.eq)}" data-in="eq" autocomplete="off">
    <div class="scrollx">${AREAS.map(([k, l]) => `<button class="chip ${!U.eq && U.area === k ? 'on' : ''}" data-act="area" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="grid2" id="egrid">${exploreGrid()}</div></section>`;
}
function mealHTML(m) {
  const ing = []; for (let k = 1; k <= 20; k++) { const n = (m['strIngredient' + k] || '').trim(); if (n) ing.push([n, (m['strMeasure' + k] || '').trim()]); }
  const pork = ing.some(x => MPORK.test(x[0])) || MPORK.test(m.strInstructions || '');
  const steps = (m.strInstructions || '').split(/\r?\n+/).map(s => s.trim()).filter(s => s.length > 2);
  const link = (u, l) => u ? `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>` : '';
  return `<div class="row between"><div class="eyebrow">${esc(m.strArea || '')} · ${esc(m.strCategory || '')}</div><button class="ibtn glass" data-act="close" aria-label="Fermer">${ico('x')}</button></div>
  <div style="margin:8px auto 0;max-width:340px"><div class="plate" style="border-radius:28px;aspect-ratio:1.2"><img class="rp" src="${m.strMealThumb}" alt="${esc(m.strMeal)}" referrerpolicy="no-referrer"></div></div>
  <h2 class="h2" style="margin:12px 0 6px">${esc(m.strMeal)}</h2>
  ${pork ? '<div class="card glass small" style="color:var(--peach);margin:6px 0">Cette recette contient du porc ou un dérivé. Remplace-le (dinde fumée, bœuf) ou passe ton chemin.</div>' : ''}
  <div class="scrollx">${link(m.strSource, 'Recette d\'origine')}${link(m.strYoutube, 'Vidéo')}<a class="chip" href="https://translate.google.com/?sl=en&tl=fr&op=translate&text=${encodeURIComponent((ing.map(x => x[1] + ' ' + x[0]).join(', ') + '\n\n' + steps.join('\n')).slice(0, 4500))}" target="_blank" rel="noopener">Traduire en français</a></div>
  <h3 style="font-size:19px;margin:16px 0 4px">Ingrédients</h3>${ing.map(([n, q]) => `<div class="row between" style="padding:7px 0;border-top:1px solid var(--line)"><span>${esc(n)}</span><span class="mute">${esc(q)}</span></div>`).join('')}
  <h3 style="font-size:19px;margin:16px 0 4px">Préparation</h3>${steps.map((s, n) => `<p style="line-height:1.55;margin:8px 0"><b class="num" style="color:var(--lime)">${n + 1}.</b> ${esc(s.replace(/^(step\s*)?\d+[.):]?\s*/i, ''))}</p>`).join('')}
  <div class="small mute" style="margin-top:14px">Recette partagée par la communauté TheMealDB. Valeurs nutritionnelles non fournies.</div>`;
}


/* ============ QU'EST-CE QU'ON MANGE ? ============ */
const WQ = [
  { k: 'moment', q: 'Tu cherches quoi ?', o: [['plat', 'Un repas complet'], ['sandwich', 'Un sandwich'], ['pdj', 'Un petit-déj'], ['snack', 'Un truc à grignoter'], ['apéro', 'Un apéro'], ['entrée', 'Une entrée'], ['dessert', 'Un dessert']] },
  { k: 'faim', q: 'Tu as quelle faim ?', o: [['leger', 'Un petit creux'], ['normal', 'Une faim normale'], ['gros', 'Très faim']] },
  { k: 'temp', q: 'Chaud ou froid ?', o: [['chaud', 'Chaud'], ['froid', 'Froid']] },
  { k: 'main', q: 'Plutôt…', o: [['viande', 'Viande'], ['poisson', 'Poisson'], ['vege', 'Végé']] },
  { k: 'cuis', q: 'Quelle envie de cuisine ?', o: [['tunisien', 'Tunisien'], ['libanais', 'Libanais'], ['japonais', 'Japonais'], ['indien', 'Indien'], ['italien', 'Italien']] },
  { k: 'temps', q: 'Tu as combien de temps ?', o: [['15', '15 min max'], ['30', '30 min max'], ['45', '45 min max']] },
  { k: 'style', q: 'Ton humeur ?', o: [['proteine', 'Protéiné'], ['gourmand', 'Gourmand'], ['epice', 'Épicé'], ['fromage', 'Fromage'], ['leger', 'Léger']] }
];
function wizMatch(a) {
  return RECIPES.filter(r => (!a.moment || (r.cat || 'plat') === a.moment) && (!a.faim || (a.faim === 'leger' ? r.k <= 480 : a.faim === 'gros' ? r.k >= 650 : r.k >= 380 && r.k <= 820))
    && (!a.temp || r.tags.includes(a.temp)) && (!a.main || r.main === a.main) && (!a.cuis || r.tags.includes(a.cuis)) && (!a.temps || r.min <= +a.temps) && (!a.style || r.tags.includes(a.style)));
}
function wizSorted(a) {
  const m = wizMatch(a), big = !a.moment || a.moment === 'plat' || a.moment === 'sandwich', tgtK = mealBudget();
  return m.slice().sort((x, y) => big ? Math.abs(x.k - tgtK) - Math.abs(y.k - tgtK) : (y.p / y.k) - (x.p / x.k));
}
const wizLabel = (k, v) => { const q = WQ.find(x => x.k === k); const o = q && q.o.find(x => x[0] === v); return o ? o[1] : v; };
function wizHTML() {
  const w = U.wiz, n = wizMatch(w.a).length, ans = Object.entries(w.a).filter(([, v]) => v);
  const sum = ans.length ? `<div class="scrollx">${ans.map(([k, v]) => `<button class="chip on" data-act="wizrm" data-v="${k}" aria-label="Retirer ${esc(wizLabel(k, v))}">${esc(wizLabel(k, v))} ${ico('x', 14)}</button>`).join('')}</div>` : '';
  if (w.done) {
    const l = wizSorted(w.a);
    return `<section class="col rise"><div class="row between"><h2 class="h2">${l.length} idée${l.length > 1 ? 's' : ''} pour toi</h2><button class="btn ghost sm" data-act="wizreset">Recommencer</button></div>${sum}
      ${l.length ? `<button class="btn block" data-act="wizrand">${ico('spark', 18)} Surprends-moi</button>` : '<div class="card glass mute" style="text-align:center">Aucune recette ne coche tous ces critères. Retire-en un en touchant une puce ci-dessus.</div>'}
      <div class="col">${l.slice(0, w.n).map(r => `<button class="card glass row" data-act="open" data-v="${r.id}" style="gap:14px;padding:12px;text-align:left;align-items:center"><div style="width:92px;flex:none">${plate(r)}</div><div class="grow"><div style="font-weight:700;line-height:1.2">${esc(r.name)}</div><div style="margin-top:6px">${macroRow(r)}</div></div></button>`).join('')}
      ${l.length > w.n ? `<button class="btn ghost block" data-act="wizmore">Afficher plus (${l.length - w.n})</button>` : ''}</div></section>`;
  }
  const q = WQ[w.step];
  return `<section class="col rise"><div class="card glass halo col"><div class="row between"><div class="eyebrow">Question ${w.step + 1} sur ${WQ.length}</div><div class="small mute">${n} recette${n > 1 ? 's' : ''} possible${n > 1 ? 's' : ''}</div></div>
    <div style="display:flex;gap:4px">${WQ.map((_, i) => `<i style="flex:1;height:5px;border-radius:3px;background:${i < w.step ? 'var(--lime)' : i === w.step ? 'var(--aqua)' : 'rgba(255,255,255,.14)'}"></i>`).join('')}</div>
    <h2 class="h2" style="font-size:28px;margin:8px 0">${q.q}</h2>
    <div class="col" style="gap:8px">${q.o.map(([v, l]) => `<button class="btn ghost block" style="justify-content:flex-start;padding:0 20px" data-act="wizans" data-k="${q.k}" data-v="${v}">${esc(l)}</button>`).join('')}<button class="btn ghost block" style="opacity:.7" data-act="wizans" data-k="${q.k}" data-v="">Peu importe</button></div></div>
    ${sum}<div class="row" style="gap:8px">${w.step ? '<button class="btn ghost" data-act="wizback">Retour</button>' : ''}<button class="btn grow" data-act="wizshow">Voir les ${n} recettes</button></div></section>`;
}

VIEWS.food = () => {
  let i = 0, body = '';
  if (U.food === 'wiz') {
    body = wizHTML();
  } else if (U.food === 'recipes') {
    const rs = filteredRecipes();
    body = `<section class="col rise" style="--i:${i++}">${deckHTML()}</section>
    <section class="col rise" style="--i:${i++}"><div class="row between"><h2 class="h2">Toutes les recettes</h2><span class="small mute">${rs.length} plat${rs.length > 1 ? 's' : ''} · sans porc</span></div>
      <label class="sr" for="q">Rechercher une recette</label><input id="q" class="field" type="search" placeholder="Chercher : houmous, dessert, apéro, poulet…" value="${esc(U.q)}" data-in="q" autocomplete="off">
      <div class="scrollx">${CATS.map(([k, l]) => `<button class="chip ${U.cat === k ? 'on' : ''}" data-act="cat" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="scrollx"><button class="chip ${U.fav ? 'on' : ''}" data-act="favf">${ico('heart', 16)} Favoris</button>${TAGS.map(([k, l]) => `<button class="chip ${U.filters.includes(k) ? 'on' : ''}" data-act="filter" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="grid2" id="rgrid">${rs.map(r => `<button class="dish glass" data-act="open" data-v="${r.id}" style="align-items:stretch;text-align:left">${plate(r)}<div style="font-weight:700;line-height:1.2;font-size:15px;min-height:36px">${esc(r.name)}</div>${macroRow(r)}</button>`).join('') || '<div class="mute card glass" style="grid-column:1/-1;text-align:center">Aucune recette ne coche tous ces critères. Retire un filtre.</div>'}</div></section>`;
  } else if (U.food === 'explore') {
    body = exploreHTML();
  } else if (U.food === 'picard') {
    body = picardHTML();
  } else if (U.food === 'fast') {
    const wk = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - k); return dstr(d); }).flatMap(d => S.log[d] || []).filter(e => /^f\d+$/.test(e.id)).reduce((a, e) => a + e.k, 0);
    body = `<section class="col rise" style="--i:${i++}"><div class="card glass halo col"><div class="row between"><div style="font-weight:700">Budget plaisir de la semaine</div><div class="small mute">${fr(wk)} / 1 200 kcal</div></div><div class="bar"><i style="width:${clamp(wk / 12, 2, 100)}%"></i></div><div class="small mute">Un vrai burger se planifie. Il rentre dans la semaine sans toucher à l'objectif.</div></div>
      <div class="eyebrow" style="margin-top:6px">À Amiens</div>
      ${FAST.map(c => `<div class="card glass col"><div class="row between"><div class="row" style="gap:10px"><i style="width:14px;height:14px;border-radius:7px;background:${c.col}"></i><h2 class="h2">${c.chain}</h2></div></div><div class="small mute" style="margin-top:-6px">${c.where}</div>
      ${c.items.map(it => `<div class="row" style="gap:12px;padding-top:10px;border-top:1px solid var(--line)"><button style="width:64px;flex:none" data-act="open" data-v="${it.id}" aria-label="Voir ${esc(it.name)}">${plate({ ...it, tone: c.col })}</button><div class="grow"><span class="tag ${it.tier === 'worst' ? 'w' : ''}">${it.tier === 'best' ? 'Meilleur choix' : it.tier === 'mid' ? 'Correct' : 'À limiter'}</span><div style="font-weight:600;line-height:1.2;margin-top:4px">${esc(it.name)}</div><div class="small mute">${it.k} kcal · ${it.p} g prot.</div></div><button class="ibtn glass" data-act="log" data-v="${it.id}" aria-label="Ajouter ${esc(it.name)}">${ico('plus')}</button></div>`).join('')}</div>`).join('')}
      <div class="small mute">Estimations de démonstration. Les vraies valeurs viennent des fiches officielles de chaque enseigne.</div></section>`;
  } else {
    body = planHTML();
  }
  return `<header class="top rise"><div><div class="small mute">Calories visées : ${fr(tgt().k)} par jour</div><h1 class="h1">Manger</h1></div><button class="ibtn glass" data-act="add" data-v="${slotNow()}" aria-label="Ajouter au journal">${ico('plus')}</button></header>
  <div class="scrollx rise" style="--i:1">${SEGS.map(([k, l]) => `<button class="chip ${U.food === k ? 'on' : ''}" data-act="seg" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
};

/* ---------- Planning de la semaine ---------- */
const R_ = id => RECIPES.find(r => r.id === id);
function genPlan() {
  const T = tgt().k, mains = RECIPES.filter(r => !r.tags.includes('petitdej') && !r.tags.includes('dessert')), bf = ['r14', 'r8', 'r14', 'r8', 'r14', 'r8', 'r14'];
  let prev = [];
  const days = bf.map(b => {
    let l, d; do { l = mains[Math.random() * mains.length | 0]; } while (prev.includes(l.id)); do { d = mains[Math.random() * mains.length | 0]; } while (d.id === l.id || prev.includes(d.id)); prev = [l.id, d.id];
    const B = R_(b), Sn = R_('r15'), m = clamp(Math.round((T - B.k - Sn.k) / (l.k + d.k) * 4) / 4, .75, 1.5);
    return { b, l: l.id, d: d.id, s: 'r15', m };
  });
  S.plan = { days, gen: todayStr() }; S.checked = {}; save();
}
const dayK = d => R_(d.b).k + R_(d.s).k + (R_(d.l).k + R_(d.d).k) * d.m;
function planHTML() {
  if (!S.plan) return `<section class="card glass halo col rise" style="text-align:center;padding:30px 20px"><h2 class="h2">Ta semaine en un geste</h2><div class="mute">Je compose 7 jours de repas variés, avec les portions ajustées à ${fr(tgt().k)} kcal, puis la liste de courses.</div><button class="btn" data-act="plan">${ico('spark', 18)} Générer ma semaine</button></section>`;
  const names = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  return `<section class="col rise"><div class="row" style="gap:10px"><button class="btn grow" data-act="shop">${ico('cart', 18)} Liste de courses</button><button class="btn ghost" data-act="plan" aria-label="Régénérer la semaine">${ico('swap', 18)}</button></div>
  ${S.plan.days.map((d, k) => `<div class="card glass col" style="padding:14px 16px"><div class="row between"><div style="font-weight:700;font-size:17px">${names[k]}</div><span class="tag">${fr(dayK(d))} kcal · portions ×${d.m}</span></div>
    ${[['b', 'Petit-déj'], ['l', 'Déjeuner'], ['d', 'Dîner'], ['s', 'Collation']].map(([sl, lab]) => `<div class="row" style="gap:10px;padding-top:8px;border-top:1px solid var(--line)"><div style="width:62px;flex:none" class="small mute">${lab}</div><button class="grow" data-act="open" data-v="${d[sl]}" style="font-size:15px;line-height:1.25">${esc(R_(d[sl]).name)}</button>${sl === 'l' || sl === 'd' ? `<button class="ibtn" style="width:36px;height:36px" data-act="swap" data-v="${k},${sl}" aria-label="Changer ce repas">${ico('swap', 17)}</button>` : ''}</div>`).join('')}</div>`).join('')}</section>`;
}
function shopList() {
  const agg = {};
  S.plan.days.forEach(d => ['b', 'l', 'd', 's'].forEach(sl => { const m = (sl === 'l' || sl === 'd') ? d.m : 1; R_(d[sl]).ing.forEach(([n, q, u, a]) => { const key = n + '|' + u; (agg[key] = agg[key] || { n, u, a, q: 0 }).q += q * m; }); }));
  const by = {}; Object.entries(agg).forEach(([key, v]) => (by[v.a] = by[v.a] || []).push({ key, ...v }));
  return by;
}
function shopSheet() {
  const by = shopList(), n = Object.values(by).flat().length, done = Object.values(by).flat().filter(x => S.checked[x.key]).length;
  return `<div class="row between"><h2 class="h2">Liste de courses</h2><button class="ibtn glass" data-act="close" aria-label="Fermer">${ico('x')}</button></div><div class="small mute" style="margin:4px 0 12px">${done} sur ${n} articles cochés</div>
  ${Object.entries(by).sort().map(([a, xs]) => `<div class="eyebrow" style="margin:12px 0 4px">${a}</div>${xs.map(x => `<button class="row" style="width:100%;padding:9px 0;border-top:1px solid var(--line);gap:12px" data-act="chk" data-v="${esc(x.key)}"><span class="chk ${S.checked[x.key] ? 'on' : ''}">${S.checked[x.key] ? ico('check', 16) : ''}</span><span class="grow" style="${S.checked[x.key] ? 'opacity:.45;text-decoration:line-through' : ''}">${esc(x.n)}</span><span class="small mute">${+(x.q).toFixed(1)} ${x.u}</span></button>`).join('')}`).join('')}`;
}

/* ============ VUE : COACH ============ */
function coachAnswer(q) {
  const n = norm(q), T = tgt(), rem = T.k - totals().k;
  if (/sport|seance|entrain|muscu|exercice|pompe|gym|bouger/.test(n)) {
    const min = +(n.match(/(\d+)\s*(min|minute)/) || [])[1] || 30, sid = sessionToday() || 'D', cnt = clamp(Math.round(min / 9), 2, SESSIONS[sid].ex.length);
    return { text: `Version ${min} minutes de la séance ${sid} (${SESSIONS[sid].short.toLowerCase()}) : ${cnt} exercices, mêmes charges que d'habitude.`, run: { sid, max: cnt, min } };
  }
  const kc = +(n.match(/(\d{2,4})\s*(kcal|cal)/) || [])[1], B = kc || Math.max(250, rem);
  const kw = []; const add = (re, f) => { if (re.test(n)) kw.push(f); };
  add(/pate|spaghetti|penne|gnocchi/, it => (it.tags || []).includes('pates')); add(/burger/, it => /burger/i.test(it.name)); add(/pizza/, it => /pizza/i.test(it.name));
  add(/fromage|fromag|mozza|cheddar/, it => (it.tags || []).includes('fromage') || /fromage|cheese|mozza/i.test(it.name)); add(/tomate/, it => (it.tags || []).includes('tomate'));
  add(/cremeu|onctu/, it => (it.tags || []).includes('cremeux')); add(/epice|pimente|piquant|fort/, it => (it.tags || []).includes('epice')); add(/copieux|bourratif|faim|gros/, it => (it.tags || []).includes('copieux'));
  add(/poulet/, it => /poulet|tikka|tenders|chicken/i.test(it.name)); add(/boeuf|viande|steak/, it => /boeuf|bœuf|burger|chili|bolognaise|parmentier/i.test(it.name)); add(/poisson|saumon|cabillaud/, it => /saumon|cabillaud|merlu|colin/i.test(it.name));
  add(/dessert|sucre|gouter|grignot|skyr|petit creux/, it => (it.tags || []).includes('dessert') || it.k < 300);
  const flemme = /flemme|cuisin|paresse|vite|rien faire|fatigue/.test(n), eatingOut = /resto|fast|mcdo|kfc|burger king|quick|dehors/.test(n);
  const extra = PRODUCTS ? picardList().filter(it => !it.porc && it.k >= 250 && it.k <= 800 && it.p >= 15 && it.p / it.k * 100 >= 4.5 && ['fish', 'pasta', 'bowl', 'tenders', 'pie', 'stew', 'burger', 'pizza'].includes(it.t)) : [];
  let pool = allItems().concat(extra).filter(it => it.k <= B * 1.06 && (it.kind !== 'fast' || it.tier !== 'worst' || B > 1100));
  if (!kw.length && !flemme) pool = pool.filter(it => it.kind !== 'fast' || eatingOut);
  const scored = pool.map(it => ({ it, s: kw.filter(f => f(it)).length * 3 + (flemme ? (it.kind === 'picard' ? 3 : (it.min || 30) <= 15 ? 2 : 0) : 0) + (eatingOut && it.kind === 'fast' ? 3 : 0) + it.p / it.k * 12 - Math.abs(it.k - B * .85) / 140 }));
  const top = scored.sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.it);
  if (!top.length) return { text: `Avec ${fr(B)} kcal, le plus malin est un skyr avec des fruits : 260 kcal et 25 g de protéines.`, cards: [R_('r15')] };
  const lead = kc ? `Avec ${fr(kc)} kcal, voici ce qui rentre en priorisant les protéines :` : flemme ? 'Zéro prise de tête, voici le plus simple qui reste dans ton budget :' : kw.length ? 'Ça tombe bien, voici ce qui colle à ton envie et à ton reste du jour :' : `Il te reste ${fr(rem)} kcal et ${Math.max(0, T.p - totals().p)} g de protéines. Je te propose :`;
  const best = top[0], left = B - best.k;
  return { text: lead, cards: top, foot: left > 180 ? `Avec « ${best.name} », il te reste environ ${fr(left)} kcal pour un dessert ou une collation.` : 'Ce choix te fait terminer la journée dans ton objectif.' };
}
function cardRow(it) { return `<div class="row" style="gap:12px;padding:8px;border-radius:22px;background:rgba(255,255,255,.07)"><button style="width:64px;flex:none" data-act="open" data-v="${it.id}" aria-label="Voir ${esc(it.name)}">${plate(it)}</button><div class="grow"><div style="font-weight:700;line-height:1.2;font-size:15px">${esc(it.name)}</div><div class="small mute">${it.k} kcal · ${it.p} g prot.${it.min ? ' · ' + it.min + ' min' : ''}${it.chain ? ' · ' + it.chain : ''}</div></div><button class="ibtn glass" data-act="log" data-v="${it.id}" aria-label="Ajouter au journal">${ico('plus')}</button></div>`; }
VIEWS.coach = () => {
  const chips = ['J\'ai envie de pâtes ce soir', 'Il me reste 600 kcal', 'J\'ai la flemme de cuisiner', 'Je veux faire du sport pendant 30 minutes', 'Un truc épicé et copieux', 'Un dessert qui rentre dans mon budget'];
  return `<header class="top rise"><div><div class="small mute">Il connaît ton reste du jour et ton historique</div><h1 class="h1">Coach</h1></div></header>
  <section class="col rise" style="--i:1" id="chat"><div class="msg">Il te reste <b>${fr(Math.max(0, tgt().k - totals().k))} kcal</b> et <b>${Math.max(0, tgt().p - totals().p)} g de protéines</b>. Qu'est-ce qui te ferait plaisir ?</div>
    ${U.chat.map(m => m.me ? `<div class="msg me">${esc(m.t)}</div>` : `<div class="msg col" style="gap:10px;max-width:100%">${esc(m.t)}${(m.cards || []).map(cardRow).join('')}${m.foot ? `<div class="small mute">${esc(m.foot)}</div>` : ''}${m.run ? `<button class="btn" data-act="run" data-v="${m.run.sid}" data-max="${m.run.max}">${ico('play', 18)} Lancer en ${m.run.min} min</button>` : ''}</div>`).join('')}</section>
  <div class="scrollx rise" style="--i:2">${chips.map(c => `<button class="chip" data-act="ask" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <form data-form="coach" class="row rise" style="--i:3;gap:8px"><label class="sr" for="ask">Ta demande</label><input id="ask" class="field" placeholder="Dis ce dont tu as envie…" autocomplete="off"><button class="ibtn" style="width:52px;height:52px;border-radius:26px;background:var(--lime);color:#0B140E" aria-label="Envoyer">${ico('chev')}</button></form>`;
};
async function ask(q) { if (!q.trim()) return; U.chat.push({ me: true, t: q }); if (!PRODUCTS) { try { await loadProducts(); } catch (e) { } } const a = coachAnswer(q); U.chat.push({ t: a.text, cards: a.cards, foot: a.foot, run: a.run }); SND.pop(); render(true); $('#app').scrollTo({ top: 99999, behavior: 'smooth' }); }

/* ============ VUE : SUIVI ============ */
function weightChart() {
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1), w0 = ws[0], W = 320, H = 150, px = 34, py = 14, d1 = Math.max(dayDiff(w0.d, S.goalD), 30);
  const ymax = Math.max(...ws.map(x => x.w), w0.w) + 2, ymin = Math.min(S.goalW, ...ws.map(x => x.w)) - 2;
  const X = d => px + clamp(dayDiff(w0.d, d) / d1, 0, 1) * (W - px - 10), Y = w => py + (1 - (w - ymin) / (ymax - ymin)) * (H - py - 20);
  const pts = ws.map(x => `${f1(X(x.d))},${f1(Y(x.w))}`).join(' '), last = ws[ws.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Courbe de poids de ${fr(w0.w, 1)} kg à ${fr(last.w, 1)} kg, objectif ${S.goalW} kg"><defs><linearGradient id="wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D6F46C" stop-opacity=".35"/><stop offset="1" stop-color="#D6F46C" stop-opacity="0"/></linearGradient></defs>
    <line x1="${px}" y1="${f1(Y(S.goalW))}" x2="${W - 10}" y2="${f1(Y(S.goalW))}" stroke="rgba(255,255,255,.18)" stroke-dasharray="4 5"/>
    <line x1="${f1(X(w0.d))}" y1="${f1(Y(w0.w))}" x2="${f1(X(S.goalD))}" y2="${f1(Y(S.goalW))}" stroke="rgba(98,227,207,.7)" stroke-width="2" stroke-dasharray="6 6"/>
    ${ws.length > 1 ? `<polygon points="${pts} ${f1(X(last.d))},${H - 20} ${f1(X(w0.d))},${H - 20}" fill="url(#wf)"/>` : ''}<polyline points="${pts}" fill="none" stroke="#D6F46C" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${f1(X(last.d))}" cy="${f1(Y(last.w))}" r="6" fill="#D6F46C" stroke="#0B140E" stroke-width="2"/>
    <text x="${px - 6}" y="${f1(Y(w0.w)) + 4}" text-anchor="end" font-size="11" fill="#AAB8AF">${fr(w0.w)}</text><text x="${px - 6}" y="${f1(Y(S.goalW)) + 4}" text-anchor="end" font-size="11" fill="#AAB8AF">${S.goalW}</text>
    <text x="${px}" y="${H - 4}" font-size="11" fill="#AAB8AF">${new Date(w0.d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text><text x="${W - 10}" y="${H - 4}" text-anchor="end" font-size="11" fill="#AAB8AF">${new Date(S.goalD + 'T12:00').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</text></svg>`;
}
VIEWS.track = () => {
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1), w0 = ws[0], wl = ws[ws.length - 1], delta = wl.w - w0.w, wks = Math.max(1, dayDiff(w0.d, wl.d) / 7);
  const vol = S.hist.reduce((a, h) => a + h.vol, 0), left = wl.w - S.goalW; let i = 0;
  return `<header class="top rise"><div><div class="small mute">Départ le ${new Date(S.start + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div><h1 class="h1">Suivi</h1></div></header>
  <section class="card glass halo rise" style="--i:${i++}"><div class="row between" style="align-items:flex-end"><div><div class="small mute">Poids</div><div class="num" style="font-size:46px;line-height:1">${fr(wl.w, 1)} <span class="small mute" style="font-weight:500">kg</span></div></div>
    <div style="text-align:right"><div class="num" style="font-size:22px;color:${delta <= 0 ? 'var(--lime)' : 'var(--peach)'}">${delta > 0 ? '+' : ''}${fr(delta, 1)} kg</div><div class="small mute">${ws.length > 1 ? fr(delta / wks, 2) + ' kg par semaine' : 'Premier point'}</div></div></div>
    ${weightChart()}<div class="small mute">La ligne bleue est la trajectoire vers ${S.goalW} kg. Il reste ${fr(Math.max(0, left), 1)} kg à perdre.</div>
    <form data-form="weight" class="row" style="gap:8px;margin-top:12px"><label class="sr" for="wIn">Poids du jour en kilos</label><input id="wIn" class="field" inputmode="decimal" placeholder="Pèse-toi ce matin, ex. 94,6" autocomplete="off"><button class="btn">Noter</button></form></section>
  <section class="grid2 rise" style="--i:${i++}"><div class="card glass"><div class="small mute">Séances faites</div><div class="num" style="font-size:36px"><span data-count="${S.hist.length}">${S.hist.length}</span></div></div>
    <div class="card glass"><div class="small mute">Volume soulevé</div><div class="num" style="font-size:36px"><span data-count="${vol}">${fr(vol)}</span> <span class="small mute" style="font-weight:500">kg</span></div></div></section>
  <section class="card glass rise col" style="--i:${i++}"><h2 class="h2">Mensurations</h2><div class="small mute">Tour de taille, au niveau du nombril, à jeun, le dimanche.</div>
    ${S.waist.length ? `<div class="num" style="font-size:30px">${fr(S.waist[S.waist.length - 1].v, 1)} cm <span class="small" style="color:${S.waist.length > 1 && S.waist[S.waist.length - 1].v < S.waist[0].v ? 'var(--lime)' : 'var(--mute)'};font-weight:600">${S.waist.length > 1 ? (S.waist[S.waist.length - 1].v - S.waist[0].v > 0 ? '+' : '') + fr(S.waist[S.waist.length - 1].v - S.waist[0].v, 1) + ' depuis le début' : ''}</span></div>` : ''}
    <form data-form="waist" class="row" style="gap:8px"><label class="sr" for="cIn">Tour de taille en centimètres</label><input id="cIn" class="field" inputmode="decimal" placeholder="Ex. 102,5" autocomplete="off"><button class="btn ghost">Noter</button></form></section>
  <section class="card glass rise col" style="--i:${i++}"><div class="row between"><h2 class="h2">Photos de progression</h2><label class="btn sm">${ico('cam', 16)} Ajouter<input type="file" accept="image/*" data-file="pp"></label></div>
    <div class="grid2" style="grid-template-columns:repeat(3,1fr);gap:8px">${S.pp.length ? S.pp.slice(-6).map(p => `<figure style="margin:0"><img src="${p.src}" alt="Photo du ${p.d}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:20px"><figcaption class="small mute" style="margin-top:4px">${new Date(p.d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</figcaption></figure>`).join('') : `<div class="small mute" style="grid-column:1/-1">Une photo toutes les deux semaines, même lumière, même pose. Elles restent sur ton téléphone.</div>`}</div></section>`;
};

/* ============ FEUILLES ============ */
function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`; s.hidden = false; }
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; U.sh = null; }
function refreshSheet() { if (!U.sh) return; const sh = $('#sheet .sheet'), sc = sh.scrollTop; sh.innerHTML = '<div class="grab"></div>' + sheetHTML(); sh.scrollTop = sc; }
const fq = (q, m) => { const v = +(q * m).toFixed(1); return fr(v, v % 1 ? 1 : 0); };
function sheetHTML() {
  const { id, m, slot } = U.sh, it = findItem(id); if (!it) return '';
  const sc = x => Math.round(x * m);
  return `<div class="row between"><div class="eyebrow">${it.kind === 'fast' ? it.chain : it.kind === 'picard' ? 'Picard' : 'Recette'}</div><button class="ibtn glass" data-act="close" aria-label="Fermer">${ico('x')}</button></div>
  <div style="max-width:250px;margin:6px auto 0">${plate(it)}</div>
  ${PHOTOS[it.id] && !S.photos[it.id] ? `<div class="small mute" style="text-align:center;margin-top:6px;font-size:11px">Photo : ${esc(PHOTOS[it.id][1])} · ${esc(PHOTOS[it.id][2])} · <a href="${PHOTOS[it.id][3]}" target="_blank" rel="noopener" style="color:inherit">Wikimedia Commons</a></div>` : ''}
  <div class="row" style="justify-content:center;margin:8px 0"><label class="btn ghost sm">${ico('cam', 16)} Ma photo de ce plat<input type="file" accept="image/*" data-file="food:${it.id}"></label></div>
  <h2 class="h2" style="margin:4px 0 8px">${esc(it.name)}</h2>
  <div class="grid2" style="grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0">${[['kcal', sc(it.k), 'var(--lime)'], ['prot.', sc(it.p), 'var(--peach)'], ['gluc.', sc(it.g), 'var(--aqua)'], ['lip.', sc(it.l), 'var(--lilac)']].map(([l, v, c]) => `<div class="glass" style="border-radius:22px;padding:10px 6px;text-align:center"><div class="num" style="font-size:22px;color:${c}">${v}</div><div class="small mute">${l}</div></div>`).join('')}</div>
  <div class="row between" style="margin:8px 0"><div class="mute">Portion</div><div class="stepper"><button class="ibtn glass" data-act="mult" data-v="-.25" aria-label="Moins">${ico('minus')}</button><div class="v num" style="font-size:22px">× ${fr(m, 2)}</div><button class="ibtn glass" data-act="mult" data-v=".25" aria-label="Plus">${ico('plus')}</button></div></div>
  ${it.ing ? `<h3 style="font-size:19px;margin:16px 0 4px">Ingrédients</h3>${it.ing.map(([n, q, u]) => `<div class="row between" style="padding:7px 0;border-top:1px solid var(--line)"><span>${esc(n)}</span><span class="mute">${fq(q, m)} ${u}</span></div>`).join('')}<h3 style="font-size:19px;margin:16px 0 4px">Préparation · ${it.min} min</h3><ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">${it.steps.map(s => `<li style="line-height:1.45">${esc(s)}</li>`).join('')}</ol>` : `<div class="small mute">${it.q || ''}${it.porc ? ' · contient du porc' : ''}</div>`}
  ${it.kind === 'recipe' ? `<h3 style="font-size:19px;margin:16px 0 6px">D'autres versions en ligne</h3><div class="scrollx">${[['Marmiton', 'https://www.marmiton.org/recettes/recherche.aspx?aqt='], ['750g', 'https://www.750g.com/recherche.htm?search='], ['YouTube', 'https://www.youtube.com/results?search_query=recette+']].map(([l, u]) => `<a class="chip" href="${u}${encodeURIComponent(it.name)}" target="_blank" rel="noopener">${l}</a>`).join('')}</div>` : ''}
  <div class="scrollx" style="margin-top:16px">${SLOTS.map(([k, l]) => `<button class="chip ${slot === k ? 'on' : ''}" data-act="slotpick" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:10px;margin-top:12px"><button class="btn grow" data-act="logsheet">${ico('plus', 18)} Ajouter au journal</button><button class="ibtn glass" style="width:52px;height:52px;border-radius:26px;${S.favs.includes(id) ? 'color:var(--lime)' : ''}" data-act="fav" data-v="${id}" aria-label="${S.favs.includes(id) ? 'Retirer des favoris' : 'Mettre en favori'}">${ico('heart')}</button></div>`;
}
function openItem(id) { U.sh = { id, m: 1, slot: slotNow() }; openSheet(sheetHTML()); }
function addSheetHTML() {
  return `<div class="row between"><h2 class="h2">Ajouter au journal</h2><button class="ibtn glass" data-act="close" aria-label="Fermer">${ico('x')}</button></div>
  <div class="scrollx" style="margin-top:10px">${SLOTS.map(([k, l]) => `<button class="chip ${U.sh.slot === k ? 'on' : ''}" data-act="slotpick2" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:8px;margin-top:12px"><label class="btn grow">${ico('cam', 18)} Scanner un code-barres<input type="file" accept="image/*" capture="environment" data-file="scan"></label></div>
  <label class="sr" for="aq">Chercher un plat ou un aliment</label><input id="aq" class="field" style="margin:12px 0" type="search" placeholder="Poulet, riz, burger, skyr…" data-in="aq" autocomplete="off">
  <div id="ares" class="col" style="gap:8px">${addResults('')}</div>
  <h3 style="font-size:19px;margin:18px 0 8px">Ajout rapide</h3>
  <form data-form="code" class="row" style="gap:8px;margin-bottom:12px"><label class="sr" for="bc">Chiffres du code-barres</label><input id="bc" class="field" inputmode="numeric" placeholder="Ou tape les chiffres du code-barres" autocomplete="off"><button class="btn ghost">Chercher</button></form>
  <form data-form="quick" class="col" style="gap:8px"><div class="row" style="gap:8px"><label class="sr" for="qn">Nom</label><input id="qn" class="field" placeholder="Nom" style="flex:2"><label class="sr" for="qk">Calories</label><input id="qk" class="field" inputmode="numeric" placeholder="kcal" style="flex:1"><label class="sr" for="qp">Protéines</label><input id="qp" class="field" inputmode="numeric" placeholder="prot. g" style="flex:1"></div><button class="btn ghost">Ajouter</button></form>`;
}
function addResults(q) {
  const n = norm(q.trim()), toks = n.split(/\s+/).filter(Boolean);
  const items = allItems().filter(it => !n || norm(it.name).includes(n)).slice(0, n ? 8 : 6);
  const foods = n ? FOODS.filter(f => toks.every(t => norm(f[0]).includes(t))).slice(0, 8) : [];
  let prods = [], note = '';
  if (n.length >= 3) { if (PRODUCTS) prods = PRODUCTS.filter(p => toks.every(t => p.key.includes(t))).slice(0, 10).map(prodItem); else { note = '<div class="small mute">Chargement de la base de produits…</div>'; loadProducts().then(() => { const r = $('#ares'); if (r && U.sh && U.sh.add) r.innerHTML = addResults($('#aq').value); }).catch(() => { }); } }
  const row = it => `<div class="row" style="gap:10px;padding:6px;border-radius:20px;background:rgba(255,255,255,.06)"><button style="width:52px;flex:none" data-act="open" data-v="${it.id}" aria-label="Voir ${esc(it.name)}">${plate(it)}</button><div class="grow"><div style="font-weight:600;line-height:1.2;font-size:15px">${esc(it.name)}</div><div class="small mute">${it.k} kcal · ${it.p} g prot.${it.q ? ' · ' + it.q : ''}</div></div><button class="ibtn glass" data-act="logq" data-v="${it.id}" aria-label="Ajouter ${esc(it.name)}">${ico('plus')}</button></div>`;
  return items.map(row).join('') + foods.map(f => { const ix = FOODS.indexOf(f); return `<div class="row" style="gap:10px;padding:10px 12px;border-radius:20px;background:rgba(255,255,255,.06)"><div class="grow"><div style="font-weight:600;font-size:15px">${esc(f[0])}</div><div class="small mute">pour 100 g : ${f[1]} kcal · ${f[2]} g prot.</div></div>${f[6] && f[6] !== 100 ? `<button class="chip" data-act="logfood" data-v="${ix}" data-g="${f[6]}">${esc(f[5])}</button>` : ''}<button class="chip" data-act="logfood" data-v="${ix}" data-g="100">100 g</button></div>`; }).join('') + prods.map(row).join('') + note;
}
function settingsHTML() {
  const T = tgt();
  return `<div class="row between"><h2 class="h2">Réglages</h2><button class="ibtn glass" data-act="close" aria-label="Fermer">${ico('x')}</button></div>
  <div class="card glass col" style="margin:10px 0"><div class="eyebrow">Tes objectifs du jour</div>${T.rate !== null ? `<div class="small" style="line-height:1.5">Tendance : ${f1(T.rate)} kg par semaine. ${T.adj < 0 ? "Objectif baissé de " + (-T.adj) + " kcal pour relancer la perte." : T.adj > 0 ? "Objectif relevé de " + T.adj + " kcal : tu perds trop vite." : "Tu es dans la bonne zone."}</div>` : ""}<div class="small mute" style="line-height:1.5">Métabolisme de base ${fr(T.bmr)} kcal, dépense estimée ${fr(T.tdee)} kcal avec ton niveau d'activité. Objectif : déficit de 500 kcal, soit environ 0,5 kg perdu par semaine, avec ${T.p} g de protéines (1,8 g par kilo) pour garder le muscle.</div><div class="num" style="font-size:26px">${fr(T.k)} kcal · ${T.p} P · ${T.g} G · ${T.l} L</div></div>
  <div class="grid2" style="gap:10px">${[['height', 'Taille (cm)', S.height], ['age', 'Âge', S.age], ['goalW', 'Poids visé (kg)', S.goalW], ['cigBase', 'Cigarettes par jour au départ', S.cigBase]].map(([k, l, v]) => `<div><label class="small mute" for="s_${k}">${l}</label><input id="s_${k}" class="field" inputmode="numeric" value="${v}" data-set="${k}"></div>`).join('')}</div>
  <h3 style="font-size:19px;margin:18px 0 6px">Sauvegarde</h3><div class="small mute" style="margin-bottom:8px;line-height:1.5">Tes données sont gardées sur cet appareil. Télécharge un fichier de sauvegarde chaque semaine (photos comprises) et garde-le dans Fichiers ou iCloud. Dernière sauvegarde : ${S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('fr-FR') : 'jamais'}.</div>
  <div class="row" style="gap:8px"><button class="btn grow" data-act="dlbackup">${ico('copy', 16)} Télécharger</button><label class="btn ghost grow" style="justify-content:center">Restaurer un fichier<input type="file" accept=".json,application/json" data-file="restore" hidden></label></div>
  <button class="btn ghost block" style="margin-top:14px;color:var(--peach)" data-act="reset">Tout effacer et recommencer</button>`;
}
function shopOpen() { U.sh = { shop: true }; openSheet(shopSheet()); }

/* ============ SÉANCE (RUNNER) ============ */
let R = null, rt = null;
function startRun(sid, max, min) {
  const list = SESSIONS[sid].ex.slice(0, max || 99).map(id => ({ id, sets: setsFor(id) }));
  R = { sid, list, i: 0, s: 0, phase: 'warm', res: {}, t0: Date.now(), reps: 0, load: 0, quit: false, ups: [] };
  $('#runner').hidden = false; ac(); SND.go(); buzz(20); runRender();
}
function stopTimer() { clearInterval(rt); rt = null; }
const cur = () => R.list[R.i];
function prepWork() {
  const c = cur(), e = EX[c.id], st = exState(c.id), p = S.prog[c.id] || {};
  R.phase = e.timed ? 'ready' : 'work'; R.reps = e.timed ? st.tsec : clamp(p.last || e.reps[0], e.reps[0], e.reps[1]); R.load = st.load; runRender();
}
function runRender() {
  stopTimer(); const el = $('#runner'); if (!R) { el.hidden = true; return; }
  const c = R.list[R.i], e = c && EX[c.id], top = `<div class="row between"><button class="chip" data-act="runquit">${ico('x', 16)} ${R.quit ? 'Appuie encore pour quitter' : 'Quitter'}</button><div class="small mute">${SESSIONS[R.sid].name}</div></div>
  <div style="display:flex;gap:4px">${R.list.map((x, k) => `<i style="flex:1;height:6px;border-radius:3px;background:${k < R.i || R.phase === 'done' ? 'var(--lime)' : k === R.i ? 'var(--aqua)' : 'rgba(255,255,255,.14)'}"></i>`).join('')}</div>`;
  let body = '';
  if (R.phase === 'warm') body = `<div class="col" style="gap:14px;margin-top:10px"><div class="eyebrow">Échauffement · 5 minutes</div><h1 class="h1">Réveille le corps</h1>${WARMUP.map((w, n) => `<div class="card glass row" style="padding:14px 16px"><span class="num" style="font-size:26px;color:var(--lime);width:28px">${n + 1}</span><span>${w}</span></div>`).join('')}<div class="small mute">Objectif de la semaine : ${phaseOf(cycleWeek()).rpe}.</div></div><div style="flex:1"></div><button class="btn block" data-act="runnext">${ico('play', 18)} Je suis prêt</button>`;
  else if (R.phase === 'work' || R.phase === 'ready') {
    const st = exState(c.id), nxt = R.list[R.i + 1];
    body = `<div style="margin-top:6px"><div class="eyebrow">Exercice ${R.i + 1} sur ${R.list.length} · ${e.mus}</div><h1 class="h1" style="font-size:34px;margin-top:6px">${esc(exLabel(c.id))}</h1></div>
    <div class="row" style="gap:8px">${Array.from({ length: c.sets }, (_, k) => `<i class="dot ${k < R.s ? 'd' : k === R.s ? 'c' : ''}"></i>`).join('')}<span class="small mute" style="margin-left:6px">Série ${R.s + 1} sur ${c.sets}</span></div>
    <div class="stage">${animSvg(c.id, false, true)}</div><div class="card glass" style="font-size:15px;line-height:1.5">${e.cue}</div>
    ${e.timed ? `<div class="card glass halo" style="text-align:center"><div class="small mute">Durée visée</div><div class="num" style="font-size:64px;line-height:1.1">${e.reps[0] >= 300 ? Math.round(R.reps / 60) + ' min' : R.reps + ' s'}</div></div>`
        : `<div class="card glass col" style="gap:14px"><div class="row between"><div><div class="small mute">Répétitions</div><div class="small mute">Vise ${e.reps[0]} à ${e.reps[1]}</div></div><div class="stepper"><button class="ibtn glass" data-act="rstep" data-v="reps,-1" aria-label="Une de moins">${ico('minus')}</button><div class="v num" style="font-size:44px;line-height:1">${R.reps}</div><button class="ibtn glass" data-act="rstep" data-v="reps,1" aria-label="Une de plus">${ico('plus')}</button></div></div>
        ${R.load != null ? `<div class="hr"></div><div class="row between"><div><div class="small mute">Charge par haltère</div><div class="small mute">Maximum ${e.load[2]} kg</div></div><div class="stepper"><button class="ibtn glass" data-act="rstep" data-v="load,-${e.load[1]}" aria-label="Moins lourd">${ico('minus')}</button><div class="v num" style="font-size:44px;line-height:1">${R.load}<span class="small mute"> kg</span></div><button class="ibtn glass" data-act="rstep" data-v="load,${e.load[1]}" aria-label="Plus lourd">${ico('plus')}</button></div></div>` : ''}</div>`}
    <div style="flex:1"></div>${nxt ? `<div class="small mute" style="text-align:center">Ensuite : ${esc(exLabel(nxt.id))}</div>` : ''}
    <button class="btn block" style="min-height:62px;font-size:18px" data-act="${e.timed ? 'rtimer' : 'rvalid'}">${e.timed ? 'Démarrer le chrono' : ico('check', 22) + ' Valider la série'}</button>`;
  } else if (R.phase === 'timer') {
    body = `<div style="margin-top:6px"><div class="eyebrow">${e.mus}</div><h1 class="h1" style="font-size:34px;margin-top:6px">${esc(exLabel(c.id))}</h1></div><div style="display:grid;place-items:center;flex:1">${bigRing(R.end - Date.now(), R.reps * 1000, 'Tiens bon')}</div><button class="btn ghost block" data-act="rvalid">Terminer maintenant</button>`;
  } else if (R.phase === 'rest') {
    const nx = R.s < c.sets ? c : R.list[R.i + 1];
    body = `<div style="margin-top:6px"><div class="eyebrow">Récupération</div><h1 class="h1" style="font-size:34px;margin-top:6px">Respire</h1></div><div style="display:grid;place-items:center;flex:1">${bigRing(R.end - Date.now(), R.restTot * 1000, 'secondes')}</div>
    <div class="card glass"><div class="small mute">Ensuite</div><div style="font-weight:700;font-size:18px">${nx ? esc(exLabel(nx.id)) : ''}</div><div class="small mute">${nx ? (R.s < c.sets ? 'Série ' + (R.s + 1) + ' sur ' + c.sets : 'Nouvel exercice') : ''}</div></div>
    <div class="row" style="gap:10px"><button class="btn ghost grow" data-act="rplus">+ 15 s</button><button class="btn grow" data-act="rskip">Passer</button></div>`;
  } else if (R.phase === 'done') {
    const h = S.hist[S.hist.length - 1];
    body = `<canvas id="conf" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5"></canvas><div class="col" style="gap:14px;margin-top:10px;text-align:center"><div class="eyebrow">Séance terminée</div><h1 class="h1" style="font-size:46px">Bien joué.</h1>
      <div class="grid2"><div class="card glass"><div class="small mute">Durée</div><div class="num" style="font-size:34px">${h.min} min</div></div><div class="card glass"><div class="small mute">Volume</div><div class="num" style="font-size:34px">${fr(h.vol)} kg</div></div></div>
      <div class="card glass col" style="text-align:left"><div class="eyebrow">Progression pour la prochaine fois</div>${R.ups.length ? R.ups.map(u => `<div style="font-weight:600">${esc(u)}</div>`).join('') : '<div class="mute">Continue : vise le haut de la fourchette sur toutes les séries pour monter.</div>'}</div></div><div style="flex:1"></div><button class="btn block" data-act="rend">Retour</button>`;
  }
  el.innerHTML = `<div class="in">${top}${body}</div>`;
  if (R.phase === 'rest' || R.phase === 'timer') { const tot = R.phase === 'rest' ? R.restTot * 1000 : R.reps * 1000; let lastS = 99; rt = setInterval(() => { const ms = R.end - Date.now(), s = Math.ceil(ms / 1000); updRing(ms, tot); if (s <= 3 && s > 0 && s !== lastS) { SND.tick(); buzz(8); } lastS = s; if (ms <= 0) { stopTimer(); if (R.phase === 'rest') { SND.go(); buzz(40); R.phase = 'workstart'; afterRest(); } else { SND.set(); rvalid(); } } }, 200); }
  if (R.phase === 'work' || R.phase === 'ready') animMount(el);
  if (R.phase === 'done') { confetti(); }
}
function bigRing(ms, tot, lab) { const C = 2 * Math.PI * 100, s = Math.max(0, Math.ceil(ms / 1000)), shown = (EX[cur().id].reps[0] >= 300 && R.phase === 'timer') ? Math.floor(s / 60) + ':' + pad(s % 60) : s; return `<div style="position:relative;width:260px;height:260px"><svg class="ring" width="260" height="260" viewBox="0 0 220 220"><circle class="tr" cx="110" cy="110" r="100" style="stroke-width:14"/><circle id="rr" cx="110" cy="110" r="100" style="stroke:var(--lime);stroke-width:14;stroke-dasharray:${C};stroke-dashoffset:${C * (1 - clamp(ms / tot, 0, 1))};filter:drop-shadow(0 0 10px var(--lime))"/></svg><div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="num" id="rn" style="font-size:78px;line-height:1">${shown}</div><div class="small mute">${lab}</div></div></div></div>`; }
function updRing(ms, tot) { const rr = $('#rr'), rn = $('#rn'); if (!rr) return; const C = 2 * Math.PI * 100; rr.style.strokeDashoffset = C * (1 - clamp(ms / tot, 0, 1)); const s = Math.max(0, Math.ceil(ms / 1000)); rn.textContent = (EX[cur().id].reps[0] >= 300 && R.phase === 'timer') ? Math.floor(s / 60) + ':' + pad(s % 60) : s; }
function startRest(sec, then) { R.restTot = sec; R.end = Date.now() + sec * 1000; R.phase = 'rest'; R.then = then; runRender(); }
function afterRest() { if (R.s >= cur().sets) { R.i++; R.s = 0; } prepWork(); }
function rvalid() {
  const c = cur(), e = EX[c.id]; (R.res[c.id] = R.res[c.id] || []).push({ reps: R.reps, load: R.load || 0 }); SND.set(); buzz(25); R.s++;
  const lastSet = R.s >= c.sets, lastEx = R.i >= R.list.length - 1;
  if (lastSet && lastEx) return finishRun();
  startRest(lastSet ? 45 : e.rest || 60);
}
function finishRun() {
  stopTimer(); const ph = phaseOf(cycleWeek()), min = Math.max(1, Math.round((Date.now() - R.t0) / 60000));
  let vol = 0; R.ups = [];
  R.list.forEach(c => {
    const e = EX[c.id], r = R.res[c.id] || [], p = S.prog[c.id] = S.prog[c.id] || {}, st = exState(c.id);
    r.forEach(x => vol += x.reps * x.load * 2);
    if (!r.length) return;
    if (e.timed) { if (ph.name !== 'Décharge') { const t = Math.min(e.reps[1], st.tsec + (e.step || 5)); if (t > st.tsec) { p.tsec = t; R.ups.push(`${EX[c.id].name} : ${e.reps[0] >= 300 ? Math.round(t / 60) + ' min' : t + ' s'}`); } } return; }
    p.last = Math.round(r.reduce((a, x) => a + x.reps, 0) / r.length);
    if (ph.name !== 'Décharge' && r.length >= c.sets && r.every(x => x.reps >= e.reps[1])) {
      if (e.load && st.load < e.load[2]) { p.load = st.load + e.load[1]; R.ups.push(`${e.name} : ${st.load} → ${p.load} kg`); }
      else if (e.vars && st.lvl < e.vars.length - 1) { p.lvl = st.lvl + 1; p.last = null; R.ups.push(`${e.name} : ${e.vars[p.lvl]}`); }
    }
  });
  S.hist.push({ d: todayStr(), s: R.sid, min, vol: Math.round(vol) }); save(); R.phase = 'done'; SND.win(); buzz([40, 60, 80]); runRender();
}
function confetti() {
  const cv = $('#conf'); if (!cv) return; const x = cv.getContext('2d'); cv.width = innerWidth * 2; cv.height = innerHeight * 2; x.scale(2, 2);
  const cols = ['#D6F46C', '#62E3CF', '#FF9E78', '#A99DFF', '#FFFFFF'], P = Array.from({ length: 110 }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6, a: Math.random() * 6, c: cols[Math.random() * 5 | 0] })); let f = 0;
  (function t() { x.clearRect(0, 0, innerWidth, innerHeight); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .04; p.a += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.beginPath(); x.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.28); x.fill(); x.restore(); }); if (++f < 220 && $('#conf')) requestAnimationFrame(t); })();
}

/* ============ ÉVÉNEMENTS ============ */
const ACT = {
  tab: a => go(a.dataset.v), sound: () => { S.sound = !S.sound; save(); S.sound && SND.pop(); render(true); },
  settings: () => { U.sh = { set: true }; openSheet(settingsHTML()); },
  steps: a => { const t = todayStr(); S.steps[t] = (S.steps[t] || 0) + +a.dataset.v; save(); SND.tap(); render(true); },
  cig: a => { const t = todayStr(); S.cig[t] = Math.max(0, (S.cig[t] || 0) + +a.dataset.v); save(); SND.tap(); render(true); },
  open: a => { SND.tap(); openItem(a.dataset.v); }, close: () => { closeSheet(); SND.tap(); },
  log: a => { addLog(findItem(a.dataset.v)); render(true); },
  logcombo: a => { a.dataset.v.split(',').forEach(id => addLog(findItem(id))); render(true); },
  logsheet: () => { const { id, m, slot } = U.sh; addLog(findItem(id), m, slot); closeSheet(); render(true); },
  add: a => { U.sh = { add: true, slot: a.dataset.v }; openSheet(addSheetHTML()); },
  slotpick: a => { U.sh.slot = a.dataset.v; SND.tap(); refreshSheet(); },
  slotpick2: a => { U.sh.slot = a.dataset.v; SND.tap(); document.querySelectorAll('[data-act=slotpick2]').forEach(b => b.classList.toggle('on', b.dataset.v === U.sh.slot)); },
  logq: a => { addLog(findItem(a.dataset.v), 1, U.sh.slot); render(true); },
  logfood: a => { const f = FOODS[+a.dataset.v], g = +a.dataset.g / 100; addLog({ name: f[0] + ' · ' + a.dataset.g + ' g', k: f[1], p: f[2], g: f[3], l: f[4] }, g, U.sh.slot); render(true); },
  del: a => { (S.log[todayStr()] || []).splice(+a.dataset.v, 1); save(); SND.skip(); render(true); },
  mult: a => { U.sh.m = clamp(U.sh.m + +a.dataset.v, .25, 3); SND.tap(); refreshSheet(); },
  fav: a => { const id = a.dataset.v, k = S.favs.indexOf(id); k >= 0 ? S.favs.splice(k, 1) : S.favs.push(id); save(); SND.keep(); refreshSheet(); },
  seg: a => { U.food = a.dataset.v; SND.tap(); render(); },
  filter: a => { const v = a.dataset.v, k = U.filters.indexOf(v); k >= 0 ? U.filters.splice(k, 1) : U.filters.push(v); SND.tap(); render(true); },
  favf: () => { U.fav = !U.fav; SND.tap(); render(true); },
  wizans: a => { const w = U.wiz, k = a.dataset.k; if (a.dataset.v) w.a[k] = a.dataset.v; else delete w.a[k]; SND.tap(); w.step++; if (w.step >= WQ.length || wizMatch(w.a).length <= 8) { w.done = true; w.n = 24; } render(true); },
  wizback: () => { U.wiz.step = Math.max(0, U.wiz.step - 1); SND.tap(); render(true); },
  wizshow: () => { U.wiz.done = true; U.wiz.n = 24; SND.tap(); render(true); },
  wizmore: () => { U.wiz.n += 24; SND.tap(); render(true); },
  wizreset: () => { U.wiz = { step: 0, a: {}, done: false, n: 24 }; SND.tap(); render(true); },
  wizrm: a => { delete U.wiz.a[a.dataset.v]; SND.tap(); render(true); },
  wizrand: () => { const l = wizSorted(U.wiz.a); if (l.length) { SND.tap(); openItem(l[Math.floor(Math.random() * l.length)].id); } },
  wiz: () => { U.tab = 'food'; U.food = 'wiz'; U.wiz = { step: 0, a: {}, done: false, n: 24 }; SND.tap(); render(); },
  area: a => { U.area = a.dataset.v; U.eq = ''; U.elist = null; U.eload = false; SND.tap(); render(true); },
  meal: async a => { SND.tap(); const id = a.dataset.v; try { const m = mealCache[id] || (mealCache[id] = (await mj('lookup.php?i=' + id)).meals[0]); U.sh = { meal: true }; openSheet(mealHTML(m)); } catch (e) { toast('Recette indisponible hors ligne'); } },
  cat: a => { U.cat = a.dataset.v; SND.tap(); render(true); },
  pcat: a => { U.pcat = a.dataset.v; U.pn = 30; SND.tap(); render(true); }, psort: a => { U.psort = a.dataset.v; U.pn = 30; SND.tap(); render(true); }, pporc: () => { U.pporc = !U.pporc; U.pn = 30; SND.tap(); render(true); }, pmore: () => { U.pn = (U.pn || 30) + 30; SND.tap(); const l = $('#plist'); if (l) l.innerHTML = plistHTML(); },
  deck: a => deckFly(a.dataset.v === 'keep' ? 1 : -1),
  plan: () => { genPlan(); SND.pop(); toast('Semaine composée'); render(true); },
  swap: a => { const [k, sl] = a.dataset.v.split(','), d = S.plan.days[+k], pool = RECIPES.filter(r => !r.tags.includes('petitdej') && !r.tags.includes('dessert') && r.id !== d.l && r.id !== d.d); d[sl] = pool[Math.random() * pool.length | 0].id; save(); SND.pop(); render(true); },
  shop: () => { shopOpen(); }, chk: a => { S.checked[a.dataset.v] = !S.checked[a.dataset.v]; save(); SND.tap(); const sh = $('#sheet .sheet'), sc = sh.scrollTop; sh.innerHTML = '<div class="grab"></div>' + shopSheet(); sh.scrollTop = sc; },
  ask: a => ask(a.dataset.v),
  energy: a => { S.energy = a.dataset.v; save(); SND.tap(); render(true); },
  run: a => startRun(a.dataset.v, a.dataset.max ? +a.dataset.max : 0),
  runnext: () => { SND.go(); prepWork(); }, rvalid: () => rvalid(),
  rtimer: () => { R.end = Date.now() + R.reps * 1000; R.phase = 'timer'; SND.go(); runRender(); },
  rstep: a => { const [k, d] = a.dataset.v.split(','), e = EX[cur().id]; R[k] = k === 'reps' ? clamp(R.reps + +d, 1, 60) : clamp(R.load + +d, 1, 40); SND.tap(); runRender(); },
  rplus: () => { R.end += 15000; R.restTot += 15; SND.tap(); },
  rskip: () => { stopTimer(); SND.go(); afterRest(); },
  runquit: () => { if (R.quit) { stopTimer(); R = null; $('#runner').hidden = true; toast('Séance non enregistrée'); } else { R.quit = true; runRender(); setTimeout(() => { if (R) { R.quit = false; if (R.phase !== 'rest' && R.phase !== 'timer' && R.phase !== 'done') runRender(); } }, 2500); } },
  rend: () => { R = null; $('#runner').hidden = true; U.tab = 'track'; render(); },
  dlbackup: () => { S.lastBackup = Date.now(); save(); const blob = new Blob([JSON.stringify(S)], { type: 'application/json' }), u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = 'transformation-' + dstr(new Date()) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast('Sauvegarde téléchargée'); },
  reset: () => { if (!ACT._r) { ACT._r = 1; toast('Appuie encore pour tout effacer'); setTimeout(() => ACT._r = 0, 3000); return; } try { localStorage.removeItem(KEY); } catch (e) { } S = defState(); closeSheet(); render(); }
};
document.addEventListener('click', e => {
  const w = $('#sheet'); if (e.target === w) { closeSheet(); return; }
  const a = e.target.closest('[data-act]'); if (a && ACT[a.dataset.act]) { e.preventDefault(); ac(); ACT[a.dataset.act](a, e); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.in === 'q') { U.q = t.value; const g = $('#rgrid'); if (g) { const rs = filteredRecipes(); g.innerHTML = rs.map(r => `<button class="dish glass" data-act="open" data-v="${r.id}" style="align-items:stretch;text-align:left">${plate(r)}<div style="font-weight:700;line-height:1.2;font-size:15px;min-height:36px">${esc(r.name)}</div>${macroRow(r)}</button>`).join('') || '<div class="mute card glass" style="grid-column:1/-1;text-align:center">Aucune recette trouvée.</div>'; } }
  if (t.dataset.in === 'eq') { U.eq = t.value.trim(); clearTimeout(eT); eT = setTimeout(() => { U.elist = null; U.eload = true; const g = $('#egrid'); if (g) g.innerHTML = exploreGrid(); exploreLoad(); }, 450); }
  if (t.dataset.in === 'pq') { U.pq = t.value; U.pn = 30; const l = $('#plist'); if (l) { l.innerHTML = plistHTML(); $('#pcount').textContent = fr(picardFiltered().length) + ' produits'; } }
  if (t.dataset.in === 'aq') $('#ares').innerHTML = addResults(t.value);
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.set) { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) { S[t.dataset.set] = v; save(); toast('Réglage enregistré'); render(true); } }
  if (t.dataset.file === 'restore' && t.files[0]) {
    try { const o = JSON.parse(await t.files[0].text()); if (!o || !o.weights || !o.start) throw 0; S = Object.assign(defState(), o); save(); closeSheet(); render(); toast('Sauvegarde restaurée'); } catch (err) { toast('Fichier de sauvegarde invalide'); }
    return;
  }
  if (t.dataset.file === 'scan' && t.files[0]) {
    toast('Lecture du code-barres…');
    try { const [code] = await Promise.all([decodeBarcode(t.files[0]), loadProducts()]); if (!code) return toast('Code illisible : rapproche-toi, ou tape les chiffres'); const pr = findCode(code); if (!pr) return toast('Produit inconnu (' + code + '). Utilise l\'ajout rapide.'); closeSheet(); openItem('off:' + pr.code); } catch (err) { toast('Lecture impossible. Tape les chiffres du code-barres.'); }
    return;
  }
  if (t.dataset.file && t.files[0]) {
    try { const src = await resizeImg(t.files[0], t.dataset.file === 'pp' ? 640 : 520);
      if (t.dataset.file === 'pp') { S.pp.push({ d: todayStr(), src }); save(); SND.pop(); render(true); }
      else { const id = t.dataset.file.split(':')[1]; S.photos[id] = src; save(); SND.pop(); delete artCache[id]; render(true); refreshSheet(); toast('Photo enregistrée'); }
    } catch (err) { toast('Cette image n\'a pas pu être lue'); }
  }
});
document.addEventListener('submit', e => {
  const f = e.target.dataset.form; if (!f) return; e.preventDefault();
  const num = id => parseFloat(String($('#' + id).value).replace(',', '.'));
  if (f === 'coach') { const i = $('#ask'); const q = i.value; i.value = ''; ask(q); }
  if (f === 'weight') { const v = num('wIn'); if (!(v > 40 && v < 250)) return toast('Entre un poids en kilos, par exemple 94,6'); const t = todayStr(), ex = S.weights.find(w => w.d === t); ex ? ex.w = v : S.weights.push({ d: t, w: v }); save(); SND.set(); toast('Poids noté'); render(true); }
  if (f === 'waist') { const v = num('cIn'); if (!(v > 40 && v < 250)) return toast('Entre un tour de taille en centimètres'); S.waist.push({ d: todayStr(), v }); save(); SND.set(); render(true); }
  if (f === 'code') { loadProducts().then(() => { const pr = findCode($('#bc').value); if (!pr) return toast('Code inconnu dans la base'); closeSheet(); openItem('off:' + pr.code); }).catch(() => toast('Base de produits indisponible')); return; }
  if (f === 'quick') { const k = num('qk'), p = num('qp') || 0, n = $('#qn').value.trim() || 'Ajout rapide'; if (!(k > 0)) return toast('Indique au moins les calories'); addLog({ name: n, k, p, g: 0, l: 0 }, 1, U.sh.slot); render(true); closeSheet(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (R && R.phase !== 'done') return; closeSheet(); } });
boot();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
