(function () {
  'use strict';
  const D = window.FORGE_DATA, ANIM = window.TF_ANIM, FOODS = window.FORGE_FOODS, ICONS = window.TF_ICONS;
  const EX = D.EX, SES = D.SESSIONS;

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const dk = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseDk = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const DAYS_S = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const DAYS_3 = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtLong = (d) => cap(DAYS[d.getDay()]) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  const fmtShort = (d) => d.getDate() + ' ' + MONTHS_S[d.getMonth()];
  const num = (n, dec = 0) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: dec });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? Math.floor(s / 60) + ':' + pad(s % 60) : String(s); };
  const I = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
  const E = (name, cls = '') => `<img class="em ${cls}" src="em/${name}.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
  const BLOCKNAME = { 'É': 'Échauffement', F: 'Finisher' };
  const blockName = (l) => BLOCKNAME[l] || 'Bloc ' + l;
  // Record affiché sur deux niveaux : la perf en gros, le détail en petit
  function recHtml(id, s) {
    const e = EX[id];
    if (e.kind === 'time') return `${s.sec}<span class="unit">s</span>`;
    if (e.kind === 'level') return `${s.r}<span class="unit">rép.</span><small>${esc(e.levels[s.lv] || '')}</small>`;
    if (!s.w) return `${s.r}<span class="unit">rép.</span>`;
    return `${num(s.w, s.w % 1 ? 1 : 0)}<span class="unit">kg</span><small>× ${s.r} rép.</small>`;
  }
  function sesMuscles(sid) {
    const set = new Set();
    SES[sid].blocks.forEach(([l, ids]) => { if (l === 'É' || l === 'F') return; ids.forEach((id) => (EX[id].mus || []).forEach((m) => set.add(m))); });
    return [...set];
  }
  // Illustration adaptée au niveau (pompes inclinées tant que tu n'es pas au sol)
  function animOf(id, lv) {
    const e = EX[id]; if (!e) return 'pushup';
    if (id === 'pompes') { if (lv == null) { try { lv = planFor(id, weekNo()).lv; } catch (x) { lv = 0; } } return lv >= 1 ? 'pushup' : 'pushinc'; }
    return e.anim;
  }

  // ---------- Stockage : base de l'artefact (compte Claude) et copie locale ----------
  const LS = 'forge1.';
  const lsGet = (k) => { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { /* plein ou indisponible */ } };
  const lsDel = (k) => { try { localStorage.removeItem(LS + k); } catch (e) { /* rien */ } };
  // Base locale (IndexedDB) : même interface qu'une collection, pour tout garder sur l'appareil, photos comprises
  function idbCollection() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('no idb'));
      const rq = indexedDB.open('transformation', 1);
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs'); };
      rq.onerror = () => reject(rq.error);
      rq.onsuccess = () => {
        const db = rq.result;
        const tx = (mode, fn) => new Promise((res, rej) => { const t = db.transaction('docs', mode); const st = t.objectStore('docs'); let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
        resolve({
          doc: (id) => ({
            set: (data) => tx('readwrite', (st) => st.put(JSON.parse(JSON.stringify(data)), id)),
            get: () => tx('readonly', (st) => st.get(id)).then((v) => ({ exists: v != null, data: () => v })),
            delete: () => tx('readwrite', (st) => st.delete(id)),
          }),
          where: (field, op, val) => ({
            get: () => new Promise((res, rej) => {
              const docs = []; const t = db.transaction('docs', 'readonly'); const c = t.objectStore('docs').openCursor();
              c.onsuccess = () => { const cur = c.result; if (!cur) return; const v = cur.value; if (v && v[field] === val) docs.push({ id: cur.key, data: () => v }); cur.continue(); };
              t.oncomplete = () => res({ docs }); t.onerror = () => rej(t.error);
            }),
          }),
        });
      };
    });
  }
  const Store = {
    col: null, status: 'loading', chains: {},
    async init() {
      try {
        if (!window.claude || !window.claude.use) {
          this.col = await idbCollection(); this.status = 'device';
          try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* rien */ }
          return;
        }
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) { this.status = 'local'; return; }
        const id = await user.id();
        if (!id) { this.status = 'local'; return; }
        this.col = db.collection('data/users/' + id);
        this.status = 'sync';
      } catch (e) { try { this.col = await idbCollection(); this.status = 'device'; } catch (x) { this.col = null; this.status = 'local'; } }
    },
    write(id, data) {
      if (!this.col) return Promise.resolve();
      const run = () => this.col.doc(id).set(data).catch(async (e) => {
        if (e && e.code === 'unavailable') { await sleep(700 + Math.random() * 900); return this.col.doc(id).set(data).catch(() => {}); }
        if (e && e.code === 'quota_exceeded') toast('Stockage plein. Supprime quelques photos.');
        else if (e && e.code === 'invalid_argument') this.status = 'local';
      });
      this.chains[id] = (this.chains[id] || Promise.resolve()).then(run);
      return this.chains[id];
    },
    async get(id) { if (!this.col) return null; try { const s = await this.col.doc(id).get(); return s.exists ? s.data() : null; } catch (e) { return null; } },
    async del(id) { if (!this.col) return; try { await this.col.doc(id).delete(); } catch (e) { /* rien */ } },
    async list(kind) { if (!this.col) return null; try { const q = await this.col.where('kind', '==', kind).get(); return q.docs.map((d) => Object.assign({}, d.data(), { _id: d.id })); } catch (e) { return null; } },
  };

  // ---------- État ----------
  const S = { profile: null, workouts: [], days: {}, photos: [], current: null, tab: 'home', sub: null, progTab: 'force', statEx: null, period: '3m',
    nutDate: dk(new Date()), timer: null, finished: null, cmp: [], onbStep: 0, photoPose: 'face' };

  function initProg(id) {
    const e = EX[id], s = D.START[id];
    if (e.kind === 'level') return { lv: s, reps: e.min, max: e.max, stage: 0, fails: 0 };
    if (e.kind === 'time') return { sec: s };
    if (e.kind === 'cardio') return { min: e.minutes };
    if (e.kind === 'interval') return { rounds: e.rounds, work: e.work, rest: e.rest };
    return { w: s, reps: e.min, max: e.max, stage: 0, fails: 0 };
  }
  function defaultProfile() {
    const prog = {};
    for (const id in EX) prog[id] = initProg(id);
    return { kind: 'profile', v: 3, startDate: dk(new Date()), days: Object.assign({}, D.DEFAULT_DAYS), prog, body: { weight: [], waist: [] }, height: 177,
      targets: { kcal: 2200, p: 140, c: 230, f: 75 }, foods: [], recent: [], recentOff: {}, favMeals: [], fullBar: true, sound: true, time: '18:30',
      onboarded: false, createdAt: Date.now(), updatedAt: 0 };
  }
  function fixProfile(p) {
    const d = defaultProfile();
    p = Object.assign({}, d, p);
    p.prog = Object.assign({}, d.prog, p.prog || {});
    p.days = Object.assign({}, d.days, p.days || {});
    p.body = Object.assign({ weight: [], waist: [] }, p.body || {});
    p.targets = Object.assign({}, d.targets, p.targets || {});
    p.kind = 'profile';
    if ((p.v || 0) < 3) { p.prog = d.prog; p.fullBar = true; p.v = 3; if (p.onboarded) { p.recal = true; p.onboarded = false; } }
    return p;
  }
  let profT;
  function saveProfile() { S.profile.updatedAt = Date.now(); lsSet('profile', S.profile); clearTimeout(profT); profT = setTimeout(() => Store.write('profile', S.profile), 600); }
  function saveWorkouts(w) { lsSet('workouts', S.workouts); if (w) Store.write(w.id, w); }
  const dayT = {};
  function getDay(date) { if (!S.days[date]) S.days[date] = { kind: 'day', date, items: [], steps: 0, updatedAt: 0 }; return S.days[date]; }
  function saveDay(date) { const d = S.days[date]; d.updatedAt = Date.now(); lsSet('days', S.days); clearTimeout(dayT[date]); dayT[date] = setTimeout(() => Store.write('n_' + date, d), 600); }
  let curT;
  function saveCurrent() {
    if (S.current) { S.current.updatedAt = Date.now(); lsSet('current', S.current); } else lsDel('current');
    clearTimeout(curT);
    curT = setTimeout(() => { if (S.current) Store.write('current', S.current); else Store.del('current'); }, 900);
  }

  // ---------- Programme et progression ----------
  const STAGES = ['', 'Descente lente, 3 à 4 s', 'Pause de 2 s en bas', 'Série dégressive : 5 rép. de plus sans pause', 'Version sur un bras ou une jambe'];
  function weekNo(date) {
    const s = mondayOf(parseDk(S.profile.startDate)), m = mondayOf(date || new Date());
    return Math.max(1, Math.round((m - s) / (7 * 864e5)) + 1);
  }
  function setsFor(id, wk) {
    const e = EX[id];
    if (e.kind === 'cardio') return 1;
    if (e.kind === 'interval') return 1;
    let n = e.sets;
    if (wk % 8 === 0) n = Math.max(2, n - 1);
    else if (wk === 1 && n >= 4) n = 3;
    return n;
  }
  function weightOptions(id) {
    const e = EX[id];
    const max = e.kind === 'single' && S.profile.fullBar ? 18 : 10;
    const arr = e.bw ? [0] : [];
    for (let w = 2; w <= max; w += 2) arr.push(w);
    return arr;
  }
  function planFor(id, wk) {
    const e = EX[id], p = S.profile.prog[id], t = { n: setsFor(id, wk) };
    if (e.kind === 'time') t.sec = p.sec;
    else if (e.kind === 'cardio') t.min = p.min;
    else if (e.kind === 'interval') Object.assign(t, { rounds: wk === 1 ? Math.max(6, p.rounds - 2) : p.rounds, work: p.work, rest: p.rest });
    else if (e.kind === 'level') Object.assign(t, { lv: p.lv, reps: p.reps, max: p.max || e.max, stage: p.stage || 0, amrap: !!e.amrap });
    else Object.assign(t, { w: p.w, reps: p.reps, max: p.max || e.max, stage: p.stage || 0, amrap: !!e.amrap });
    return t;
  }
  const side = (id) => (EX[id].uni ? (EX[id].kind === 'time' ? ' par côté' : /jambe|squat|fente|terre/i.test(EX[id].name) ? ' par jambe' : ' par bras') : '');
  function loadText(id, v) {
    const e = EX[id];
    if (e.kind === 'level') return e.levels[v.lv];
    if (e.kind === 'time') return v.sec + ' s';
    if (e.kind === 'cardio') return v.min + ' min';
    if (e.kind === 'interval') return v.rounds + ' × ' + v.work + ' s / ' + v.rest + ' s';
    if (!v.w) return 'Poids du corps';
    return v.w + ' kg' + (e.kind === 'pair' ? ' par main' : '');
  }
  function planLine(id, t) {
    const e = EX[id];
    if (e.kind === 'time') return `${t.n} × ${t.sec} s${side(id)}`;
    if (e.kind === 'cardio') return `${t.min} min, rythme tranquille`;
    if (e.kind === 'interval') return `${t.rounds} rounds : ${t.work} s à fond, ${t.rest} s de récup`;
    return `${t.n} × ${t.reps} rép.${side(id)}, ${loadText(id, t).toLowerCase()}`;
  }
  function progress(id, plan, sets) {
    const e = EX[id], p = S.profile.prog[id];
    if (!sets.length || e.kind === 'cardio') return null;
    if (e.kind === 'interval') {
      const s0 = sets[0];
      if ((s0.rounds || 0) >= plan.rounds && plan.rounds >= p.rounds) {
        if (p.rounds < 12) { p.rounds += 1; return { big: true, txt: `${e.name} : ${p.rounds} rounds la prochaine fois` }; }
        if (p.work < 50) { p.work += 5; p.rest = Math.max(15, p.rest - 5); p.rounds = 10; return { big: true, txt: `${e.name} : ${p.work} s d\u2019effort, ${p.rest} s de récup` }; }
      }
      return null;
    }
    if (e.kind === 'time') {
      const ok = sets.length >= plan.n && sets.every((s) => s.sec >= plan.sec);
      if (ok && p.sec < e.max) { p.sec = Math.min(e.max, p.sec + (e.step || 5)); return { big: true, txt: `${e.name} : ${p.sec} s la prochaine fois` }; }
      return null;
    }
    const isLv = e.kind === 'level';
    const cur = isLv ? plan.lv : plan.w;
    const used = Math.min.apply(null, sets.map((s) => (isLv ? s.lv : s.w)));
    const reps = sets.map((s) => s.r);
    const full = sets.length >= plan.n;
    const max = p.max || e.max;
    const minR = Math.min.apply(null, reps);
    const lastR = reps[reps.length - 1];
    // Dernière série au max : si tu exploses le plafond, on monte tout de suite
    const blast = e.amrap && full && lastR >= max + 3 && minR >= Math.min(p.reps, max);
    if (full && used >= cur && (minR >= max || blast)) {
      if (isLv && p.lv < e.levels.length - 1) { p.lv = used + 1; p.reps = e.min; p.max = e.max; p.fails = 0; return { big: true, txt: `${e.name} : niveau suivant, ${e.levels[p.lv].toLowerCase()}` }; }
      if (!isLv) {
        const next = weightOptions(id).find((w) => w > used);
        if (next != null) { p.w = next; p.reps = e.min; p.max = e.max; p.stage = 0; p.fails = 0; return { big: true, txt: `${e.name} : ${used ? used + ' kg' : 'poids du corps'} → ${next} kg` }; }
      }
      if (max < 25) { p.max = 25; p.reps = Math.min(max + 1, 25); return { big: true, txt: `${e.name} : plafond du matériel atteint, on monte jusqu’à 25 répétitions` }; }
      if ((p.stage || 0) < 4) { p.stage = (p.stage || 0) + 1; p.reps = e.min; return { big: true, txt: `${e.name} : nouvelle difficulté, ${STAGES[p.stage].toLowerCase()}` }; }
      return { big: false, txt: `${e.name} : au maximum du programme` };
    }
    if (used !== cur) { if (isLv) p.lv = used; else p.w = used; }
    if (full && minR >= p.reps) {
      const nr = Math.min(Math.max(p.reps + 1, minR, e.amrap ? Math.min(lastR - 4, minR + 2) : 0), max);
      p.fails = 0;
      if (nr > p.reps) { p.reps = nr; return { big: false, txt: `${e.name} : objectif ${nr} répétitions` }; }
      return null;
    }
    if (minR < p.reps - 2) {
      p.fails = (p.fails || 0) + 1;
      if (p.fails >= 2) {
        p.fails = 0;
        if (isLv && p.lv > 0) { p.lv -= 1; p.reps = e.min; return { big: true, txt: `${e.name} : on repasse à « ${e.levels[p.lv].toLowerCase()} »` }; }
        if (!isLv) {
          const prev = weightOptions(id).slice().reverse().find((w) => w < used);
          if (prev != null) { p.w = prev; p.reps = e.min; return { big: true, txt: `${e.name} : on redescend à ${prev ? prev + ' kg' : 'poids du corps'}` }; }
        }
      }
    }
    return null;
  }
  // Score d'une série pour les records et la courbe de force
  const e1rm = (w, r) => w * (1 + r / 30);
  function setScore(id, s) {
    const e = EX[id];
    if (e.kind === 'time') return s.sec || 0;
    if (e.kind === 'interval') return (s.rounds || 0) * (s.work || 0);
    if (e.kind === 'level') return (s.lv || 0) * 100 + (s.r || 0);
    return s.w ? e1rm(s.w, s.r) : s.r / 10;
  }
  function setText(id, s) {
    const e = EX[id];
    if (e.kind === 'time') return s.sec + ' s';
    if (e.kind === 'cardio') return s.min + ' min';
    if (e.kind === 'interval') return s.rounds + ' × ' + s.work + ' s';
    if (e.kind === 'level') return s.r + ' rép., ' + e.levels[s.lv].toLowerCase();
    return (s.w ? s.w + ' kg × ' : '') + s.r + ' rép.';
  }
  function bestSet(id, workouts) {
    let best = null;
    (workouts || S.workouts).forEach((w) => { const it = w.items.find((x) => x.id === id); if (!it) return; it.sets.forEach((s) => { const sc = setScore(id, s); if (!best || sc > best.sc) best = { sc, s, date: w.date }; }); });
    return best;
  }

  // ---------- Séance ----------
  function buildSession(sid) {
    const wk = weekNo();
    const plan = {}, log = {}, steps = [];
    for (const [label, ids, opt] of SES[sid].blocks) {
      const rest = (opt && opt.rest) || [30, ids.length === 1 ? 60 : 75];
      for (const id of ids) {
        plan[id] = planFor(id, wk);
        const t = plan[id];
        log[id] = Array.from({ length: t.n }, () => ({ w: t.w, lv: t.lv, r: t.reps, sec: t.sec, min: t.min, rounds: t.rounds, work: t.work, rest: t.rest, done: false }));
      }
      const maxN = Math.max.apply(null, ids.map((id) => plan[id].n));
      for (let s = 0; s < maxN; s++) {
        const here = ids.filter((id) => s < plan[id].n);
        here.forEach((id, j) => steps.push({ id, set: s, label: ids.length > 1 ? label + (ids.indexOf(id) + 1) : label, endRound: j === here.length - 1, single: ids.length === 1, rIn: rest[0], rOut: rest[1], block: label }));
      }
    }
    return { kind: 'current', sid, date: dk(new Date()), startedAt: Date.now(), wk, plan, log, steps };
  }
  const curStepIndex = () => (S.current ? S.current.steps.findIndex((st) => !S.current.log[st.id][st.set].done) : -1);

  let audioCtx = null;
  function unlockAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; } }
  function beep(times) {
    if (!S.profile.sound || !audioCtx) return;
    try {
      const n = times || 2;
      for (let i = 0; i < n; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = i === n - 1 ? 1046 : 784;
        const t0 = audioCtx.currentTime + i * 0.22;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.2);
      }
    } catch (e) { /* rien */ }
    try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* rien */ }
  }
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  function startSession(sid) {
    unlockAudio();
    if (S.current && S.current.sid !== sid) {
      return confirmSheet('Une séance est déjà en cours', `Tu as commencé ${SES[S.current.sid].name}. La remplacer par ${SES[sid].name} ? Ce que tu as noté sera perdu.`, 'Remplacer', () => { S.current = null; startSession(sid); });
    }
    if (!S.current) { S.current = buildSession(sid); saveCurrent(); }
    openRun();
  }
  function openRun() { $('#run').classList.add('open'); keepAwake(true); renderRun(); $('#run').scrollTop = 0; }
  function closeRun() { $('#run').classList.remove('open'); stopTimer(true); keepAwake(false); S.finished = null; render(); }
  function validateStep(id, set, vals) {
    const c = S.current; if (!c) return;
    Object.assign(c.log[id][set], vals || {}, { done: true });
    saveCurrent();
    const st = c.steps.find((s) => s.id === id && s.set === set);
    if (curStepIndex() === -1) { stopTimer(true); return finishSheet(); }
    const nxt = c.steps[curStepIndex()];
    let rest = st ? (st.endRound ? st.rOut || 75 : st.rIn || 30) : 60;
    if (st && nxt && st.block !== nxt.block && (EX[st.id].kind === 'cardio' || EX[nxt.id].kind === 'interval')) rest = 30;
    startTimer(rest, 'rest');
  }

  // Minuteurs : repos, ou effort pour la planche et le rameur
  let tickI = null;
  function startTimer(sec, kind, onEnd, label, phases) {
    S.timer = { end: Date.now() + sec * 1000, total: sec, kind, onEnd, label, phases: phases || null, pi: 0 };
    clearInterval(tickI);
    tickI = setInterval(tickTimer, 250);
    renderRun(); tickTimer();
  }
  function stopTimer(silent) { clearInterval(tickI); tickI = null; S.timer = null; if (!silent) renderRun(); }
  function tickTimer() {
    const t = S.timer; if (!t) return;
    const left = (t.end - Date.now()) / 1000;
    const el = $('#ringT'); if (el) el.textContent = mmss(left);
    const fg = $('#ringV'); if (fg) fg.style.strokeDashoffset = String(691 * (1 - clamp(left / t.total, 0, 1)));
    if (left <= 0) {
      if (t.phases && t.pi < t.phases.length - 1) { t.pi++; const ph = t.phases[t.pi]; t.end = Date.now() + ph.sec * 1000; t.total = ph.sec; beep(ph.k === 'work' ? 2 : 1); renderRun(); return; }
      const cb = t.onEnd; const kind = t.kind; stopTimer(true); beep(kind === 'rest' ? 2 : 3); if (cb) cb(); else renderRun();
    }
  }

  // ---------- Rendu de la séance ----------
  function intensity(st, n) {
    const e = EX[st.id];
    if (e.kind === 'cardio' || e.kind === 'interval') return '';
    if (e.kind === 'time') return '<div class="intens">' + I('flame') + '<span>Tiens jusqu\u2019au bout, sans pause.</span></div>';
    if (e.amrap && st.set === n - 1) return '<div class="intens max">' + I('flame') + '<span><b>Dernière série : max de répétitions.</b> Va jusqu\u2019à l\u2019échec propre, puis note ce que tu as fait.</span></div>';
    return '<div class="intens">' + I('target') + '<span>Arrête-toi quand il te reste 1 ou 2 répétitions en réserve, pas avant.</span></div>';
  }
  function targetBig(id, v) {
    const e = EX[id];
    if (e.kind === 'time') return `<div class="target"><span class="t-giant">${v.sec}<span class="unit">s${esc(side(id))}</span></span></div>`;
    if (e.kind === 'cardio') return `<div class="target"><span class="t-giant">${v.min}<span class="unit">min</span></span></div>`;
    if (e.kind === 'interval') return `<div class="target"><span class="t-giant">${v.rounds}<span class="unit">rounds</span></span></div><div class="t-mute">${v.work} s à fond, ${v.rest} s de récup, soit ${Math.round((v.rounds * (v.work + v.rest)) / 60)} min</div>`;
    if (e.kind === 'level') return `<div class="target"><span class="t-giant">${v.r}<span class="unit">rép.${esc(side(id))}</span></span></div><div class="t-mute">${esc(e.levels[v.lv])}</div>`;
    return `<div class="target">${v.w ? `<span class="t-giant">${v.w}<span class="unit">kg</span></span><span class="x">×</span>` : ''}<span class="t-giant">${v.r}<span class="unit">rép.${esc(side(id))}</span></span></div>
      <div class="t-mute">${!v.w ? 'Au poids du corps' : e.kind === 'pair' ? 'Un haltère dans chaque main' : 'Un seul haltère'}</div>`;
  }
  function nextCard(i, title) {
    const c = S.current, st = c.steps[i]; if (!st) return '';
    const v = c.log[st.id][st.set];
    const e = EX[st.id];
    const tx = e.kind === 'time' ? v.sec + ' s' : e.kind === 'cardio' ? v.min + ' min' : e.kind === 'interval' ? v.rounds + ' rounds' : e.kind === 'level' ? v.r + ' rép.' : (v.w ? v.w + ' kg × ' : '') + v.r + ' rép.';
    return `<div class="next"><div class="thumb">${ANIM.svg(animOf(st.id, v.lv), '', true)}</div><div class="grow"><div class="t-label">${esc(title)}</div><div style="font-weight:600">${esc(st.label)}, ${esc(e.name)}</div></div><span class="kc">${esc(tx)}</span></div>`;
  }
  function renderRun() {
    const el = $('#run');
    if (S.finished) { el.innerHTML = doneView(); ANIM.mount(el); return; }
    const c = S.current;
    if (!c) { el.innerHTML = ''; return; }
    const ses = SES[c.sid];
    const total = c.steps.length, done = c.steps.filter((s) => c.log[s.id][s.set].done).length;
    const i = curStepIndex();
    const segs = c.steps.map((s, k) => `<i class="${c.log[s.id][s.set].done ? 'done' : k === i ? 'cur' : ''}"></i>`).join('');
    let body;
    if (S.timer) {
      const t = S.timer, rest = t.kind === 'rest', ph = t.phases ? t.phases[t.pi] : null;
      const phTop = ph ? `<div class="stack-s" style="justify-items:center"><span class="t-label">${esc(t.label || '')}, round ${ph.r} sur ${t.phases[t.phases.length - 1].r}</span><span class="phase-label ${ph.k === 'work' ? 'work' : ''}">${ph.k === 'work' ? 'À fond !' : 'Récup, rame doucement'}</span></div>` : `<div class="t-label">${rest ? 'Repos' : esc(t.label || '')}</div>`;
      body = `<div class="rest ${ph && ph.k !== 'work' ? 'phase-rest' : ''}">
        ${phTop}
        <div class="ring"><svg viewBox="0 0 250 250"><circle class="trk" cx="125" cy="125" r="110"/><circle class="val" id="ringV" cx="125" cy="125" r="110" stroke-dasharray="691" stroke-dashoffset="0"/></svg>
          <div class="ctr"><span class="t-giant" id="ringT">${mmss(t.total)}</span><span class="t-label">${rest ? 'secondes' : 'restantes'}</span></div></div>
        <div class="row" style="width:100%"><button class="btn outline grow" data-act="tplus">${I('plus')} 15 s</button><button class="btn primary grow" data-act="tskip">${rest ? 'Passer le repos' : 'Terminer'}</button></div>
        <div style="width:100%;text-align:left">${rest && i >= 0 ? nextCard(i, 'Ensuite') : ''}</div>
      </div>`;
    } else if (i >= 0) {
      const st = c.steps[i], e = EX[st.id], v = c.log[st.id][st.set], n = c.plan[st.id].n;
      const stage = c.plan[st.id].stage ? `<span class="pill lime">${esc(STAGES[c.plan[st.id].stage])}</span>` : '';
      let actions;
      if (e.kind === 'time') actions = `<button class="btn primary xl block" data-act="work" data-id="${st.id}" data-set="${st.set}">${I('play')} Lancer ${v.sec} s</button><div class="g2"><button class="btn" data-act="edit" data-id="${st.id}" data-set="${st.set}">Modifier</button><button class="btn" data-act="done" data-id="${st.id}" data-set="${st.set}">${I('check')} C’est fait</button></div>`;
      else if (e.kind === 'interval') actions = `<button class="btn primary xl block" data-act="work" data-id="${st.id}" data-set="${st.set}">${I('play')} Lancer le fractionné</button><div class="g2"><button class="btn" data-act="edit" data-id="${st.id}" data-set="${st.set}">Modifier</button><button class="btn" data-act="done" data-id="${st.id}" data-set="${st.set}">${I('check')} C\u2019est fait</button></div>`;
      else if (e.kind === 'cardio') actions = `<button class="btn primary xl block" data-act="work" data-id="${st.id}" data-set="${st.set}">${I('play')} Lancer ${v.min} min</button><button class="btn block" data-act="done" data-id="${st.id}" data-set="${st.set}">${I('check')} C’est déjà fait</button>`;
      else if (e.amrap && st.set === n - 1) actions = `<button class="btn primary xl block" data-act="edit" data-id="${st.id}" data-set="${st.set}">${I('pencil')} Noter mes répétitions</button><button class="btn ghost block" data-act="done" data-id="${st.id}" data-set="${st.set}">${I('check')} Pile l\u2019objectif</button>`;
      else actions = `<button class="btn primary xl block" data-act="done" data-id="${st.id}" data-set="${st.set}">${I('check')} Série réussie</button><button class="btn ghost block" data-act="edit" data-id="${st.id}" data-set="${st.set}">${I('pencil')} J’ai fait autrement</button>`;
      const wkNote = c.wk === 1 ? '<p class="note">Semaine 1 : une série de moins sur les gros exercices, le temps de caler la technique. Dès la semaine 2, programme complet.</p>' : c.wk % 8 === 0 ? '<p class="note">Semaine de récupération : une série de moins, mêmes poids. Tu repars plus fort la semaine suivante.</p>' : '';
      body = `<div class="row between"><div class="row" style="gap:10px"><span class="pill lime">${esc(st.label)}</span><span class="t-label">Série ${st.set + 1} sur ${n}</span></div><button class="ibtn sm" data-act="info" data-id="${st.id}" aria-label="Fiche de l'exercice">${I('info')}</button></div>
        <div class="stage">${ANIM.svg(animOf(st.id, v.lv), '', false, true)}</div>
        <div class="stack-s"><h1 class="t-title">${esc(e.long || e.name)}</h1><div class="meta"><span class="pill">${esc(e.muscle)}</span>${stage}</div></div>
        ${(e.tips || []).length ? `<ul class="cues">${e.tips.slice(1, 3).map((t) => `<li>${I('check', 'lime')}<span>${esc(t)}</span></li>`).join('')}</ul>` : ''}
        <div class="stack-s">${targetBig(st.id, v)}${intensity(st, n)}</div>
        <div class="stack">${actions}</div>
        <p class="note">${esc(e.cue)}</p>
        ${c.steps[i + 1] ? nextCard(i + 1, st.endRound ? 'Ensuite, après le repos' : 'Ensuite, après 30 s') : ''}
        ${wkNote}`;
    } else {
      body = `<div class="done-hero">${E('party_popper', 'xl pop')}<h1 class="t-title">Toutes les séries sont faites</h1><button class="btn primary xl block" data-act="finish">Voir le résultat</button></div>`;
    }
    el.innerHTML = `<header class="run-top">
        <div class="row between"><button class="ibtn sm" data-act="minimize" aria-label="Revenir à l'accueil">${I('chevron-down')}</button>
        <div class="ttl"><b>${esc(ses.name)}</b><span><span id="elapsed">0:00</span>  –  ${done} séries sur ${total}</span></div>
        <button class="ibtn sm" data-act="setsheet" aria-label="Voir toute la séance">${I('list')}</button></div>
        <div class="segbar" style="grid-template-columns:repeat(${total},1fr)">${segs}</div></header>
      <div class="run-body">${body}</div>`;
    ANIM.mount(el);
    updateElapsed();
    if (S.timer) tickTimer();
  }
  function updateElapsed() { const e = $('#elapsed'); if (e && S.current) { const t = Math.floor((Date.now() - S.current.startedAt) / 1000); e.textContent = Math.floor(t / 60) + ':' + pad(t % 60); } }
  setInterval(updateElapsed, 1000);

  function setsSheet() {
    const c = S.current; if (!c) return;
    const i = curStepIndex(), st = i >= 0 ? c.steps[i] : null;
    const html = SES[c.sid].blocks.map(([label, ids]) => `<div class="stack-s"><div class="t-label">${blockName(label)}${ids.length > 1 ? ', à enchaîner' : ''}</div>
      ${ids.map((id) => {
        const e = EX[id];
        const chips = c.log[id].map((v, s) => {
          const isCur = st && st.id === id && st.set === s;
          const sub = e.kind === 'time' ? v.sec + ' s' : e.kind === 'cardio' ? v.min + ' min' : e.kind === 'interval' ? v.rounds + ' rds' : e.kind === 'level' ? v.r + ' rép.' : (v.w ? v.w + ' kg' : 'PDC') + ' × ' + v.r;
          return `<button class="set ${v.done ? 'done' : ''} ${isCur ? 'cur' : ''}" data-edit="${id}" data-set="${s}" aria-label="Série ${s + 1}">${v.done ? I('check') : s + 1}<small>${esc(sub)}</small></button>`;
        }).join('');
        return `<div class="card" style="padding:14px"><div class="row"><div class="thumb">${ANIM.svg(animOf(id), '', true)}</div><div class="grow"><b>${esc(e.name)}</b><div class="t-label">${esc(planLine(id, c.plan[id]))}</div></div></div><div class="sets">${chips}</div></div>`;
      }).join('')}</div>`).join('');
    openSheet(`<div class="grab"></div><div class="row between"><h2>${esc(SES[c.sid].name)}</h2><button class="btn small" data-close>Fermer</button></div>${html}
      <button class="btn primary block" data-finish>Terminer la séance</button><button class="btn danger block" data-abandon>Abandonner la séance</button>`, (sh) => {
      ANIM.mount(sh);
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-close')) return closeSheet();
        if (b.dataset.edit) return editSetSheet(b.dataset.edit, +b.dataset.set);
        if (b.hasAttribute('data-finish')) { closeSheet(); return finishSheet(); }
        if (b.hasAttribute('data-abandon')) return confirmSheet('Abandonner la séance ?', 'Rien ne sera enregistré et ta progression ne bougera pas.', 'Abandonner', () => { S.current = null; saveCurrent(); closeRun(); }, true);
      };
    });
  }
  function stepper(key, val, label) {
    return `<label class="field"><span>${label}</span><div class="stepper"><button data-${key}="-1" aria-label="Moins">${I('minus')}</button><div class="val">${val}</div><button data-${key}="1" aria-label="Plus">${I('plus')}</button></div></label>`;
  }
  function editSetSheet(id, set) {
    const c = S.current, e = EX[id], v = Object.assign({}, c.log[id][set]);
    const wopts = weightOptions(id);
    const draw = () => {
      let load = '';
      if (e.kind === 'level') load = `<div class="field"><span>Niveau</span><div class="row wrap">${e.levels.map((l, i) => `<button class="chip ${v.lv === i ? 'on' : ''}" data-lv="${i}">${esc(l)}</button>`).join('')}</div></div>`;
      else if (e.kind === 'pair' || e.kind === 'single') load = stepper('w', v.w ? v.w + '<span class="unit">kg</span>' : '<span class="unit" style="font-size:18px">Poids du corps</span>', e.kind === 'pair' ? 'Poids par haltère' : 'Poids de l’haltère');
      let reps;
      if (e.kind === 'time') reps = stepper('s', v.sec + '<span class="unit">s</span>', 'Durée' + side(id));
      else if (e.kind === 'cardio') reps = stepper('m', v.min + '<span class="unit">min</span>', 'Durée');
      else if (e.kind === 'interval') reps = stepper('ro', v.rounds + '<span class="unit">rounds</span>', 'Rounds faits');
      else reps = stepper('r', v.r, 'Répétitions' + side(id));
      return `<div class="grab"></div><div><div class="t-label">Série ${set + 1}</div><h2>${esc(e.name)}</h2></div>${load}${reps}
        <button class="btn primary xl block" data-ok>${c.log[id][set].done ? 'Enregistrer' : 'Valider la série'}</button>
        ${c.log[id][set].done ? '<button class="btn ghost block" data-undo>Marquer comme pas faite</button>' : '<button class="btn ghost block" data-cancel>Annuler</button>'}`;
    };
    openSheet(draw(), (sh) => {
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.lv != null) v.lv = +b.dataset.lv;
        else if (b.dataset.w) { const i = wopts.indexOf(v.w); v.w = wopts[clamp((i < 0 ? 0 : i) + +b.dataset.w, 0, wopts.length - 1)]; }
        else if (b.dataset.r) v.r = clamp(v.r + +b.dataset.r, 0, 60);
        else if (b.dataset.s) v.sec = clamp(v.sec + +b.dataset.s * 5, 5, 300);
        else if (b.dataset.m) v.min = clamp(v.min + +b.dataset.m, 1, 60);
        else if (b.dataset.ro) v.rounds = clamp(v.rounds + +b.dataset.ro, 1, 20);
        else if (b.hasAttribute('data-ok')) { closeSheet(); return validateStep(id, set, { w: v.w, lv: v.lv, r: v.r, sec: v.sec, min: v.min, rounds: v.rounds }); }
        else if (b.hasAttribute('data-undo')) { c.log[id][set].done = false; saveCurrent(); closeSheet(); return renderRun(); }
        else if (b.hasAttribute('data-cancel')) return closeSheet();
        else return;
        sh.innerHTML = draw();
      };
    });
  }
  function exerciseSheet(id) {
    const e = EX[id];
    const p = S.current && S.current.plan[id] ? S.current.plan[id] : planFor(id, weekNo());
    const hist = S.workouts.slice().sort((a, b) => b.startedAt - a.startedAt).map((w) => { const it = w.items.find((x) => x.id === id); if (!it || !it.sets.length) return null; const b = it.sets.slice().sort((x, y) => setScore(id, y) - setScore(id, x))[0]; return { date: w.date, s: b }; }).filter(Boolean).slice(0, 4);
    const q = encodeURIComponent(e.name + ' haltère technique');
    openSheet(`<div class="grab"></div><div class="stage">${ANIM.svg(animOf(id), '', false, true)}</div>
      <div class="stack-s"><h2>${esc(e.long || e.name)}</h2><div class="meta"><span class="pill">${esc(e.muscle)}</span><span class="pill lime">${esc(planLine(id, p))}</span></div></div>
      <div class="card"><div class="t-card">Muscles travaillés</div>${ANIM.bodyMap(e.mus)}</div>
      <div class="card"><div class="t-card">Comment faire</div><ol style="margin:0;padding-left:20px;display:grid;gap:6px">${(e.tips || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
      <div class="card"><div class="t-card">Erreurs à éviter</div>${(e.errs || []).map((t) => `<div class="row" style="align-items:flex-start">${I('x', 'lime')}<span>${esc(t)}</span></div>`).join('')}</div>
      ${hist.length ? `<div class="card"><div class="t-card">Ton historique</div><div>${hist.map((h) => `<div class="li" style="min-height:44px"><div class="tx"><b>${esc(setText(id, h.s))}</b></div><span class="end">${esc(fmtShort(parseDk(h.date)))}</span></div>`).join('')}</div></div>` : ''}
      <a class="btn outline block" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${I('play')} Voir des vidéos du mouvement</a>
      <button class="btn block" data-close>Fermer</button>`, (sh) => { ANIM.mount(sh); sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  function finishSheet() {
    const c = S.current; if (!c) return;
    const left = c.steps.filter((s) => !c.log[s.id][s.set].done).length;
    if (left > 0) return confirmSheet('Terminer la séance ?', `Il reste ${plural(left, 'série')}. Les séries non faites ne comptent pas pour la progression.`, 'Terminer quand même', doFinish);
    doFinish();
  }
  function doFinish() {
    const c = S.current; if (!c) return;
    stopTimer(true);
    const changes = [], items = [], records = [];
    let volume = 0, nsets = 0;
    const before = S.workouts.slice();
    for (const id in c.plan) {
      const sets = c.log[id].filter((s) => s.done).map((s) => ({ w: s.w, lv: s.lv, r: s.r, sec: s.sec, min: s.min, rounds: s.rounds, work: s.work, rest: s.rest }));
      items.push({ id, plan: c.plan[id], sets });
      nsets += sets.length;
      sets.forEach((s) => { if (s.w) volume += s.w * s.r * (EX[id].kind === 'pair' ? 2 : 1) * (EX[id].uni ? 2 : 1); });
      if (sets.length && EX[id].kind !== 'cardio' && EX[id].kind !== 'interval') {
        const prev = bestSet(id, before);
        const top = sets.slice().sort((a, b) => setScore(id, b) - setScore(id, a))[0];
        if (prev && setScore(id, top) > prev.sc + 0.01) records.push({ id, txt: setText(id, top), was: setText(id, prev.s) });
      }
      const ch = progress(id, c.plan[id], sets);
      if (ch) changes.push(ch);
    }
    const w = { kind: 'workout', id: 'w_' + uid(), date: c.date, sid: c.sid, startedAt: c.startedAt, endedAt: Date.now(), wk: c.wk, items, changes, records, volume, nsets };
    S.workouts.push(w);
    saveWorkouts(w); saveProfile();
    S.current = null; saveCurrent();
    S.finished = w;
    closeSheet();
    $('#run').classList.add('open');
    renderRun(); $('#run').scrollTop = 0;
  }
  function doneView() {
    const w = S.finished;
    const mins = Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000));
    const big = w.changes.filter((x) => x.big), small = w.changes.filter((x) => !x.big);
    const prev = S.workouts.filter((x) => x.sid === w.sid && x.id !== w.id && x.startedAt < w.startedAt).sort((x, y) => y.startedAt - x.startedAt)[0];
    let cmp = '';
    if (prev) {
      const lines = [];
      for (const it of w.items) {
        const e = EX[it.id]; if (!it.sets.length || e.kind === 'cardio' || e.kind === 'interval') continue;
        const pit = prev.items.find((x) => x.id === it.id); if (!pit || !pit.sets.length) continue;
        const best = (arr) => arr.slice().sort((x, y) => setScore(it.id, y) - setScore(it.id, x))[0];
        const a1 = best(it.sets), a0 = best(pit.sets);
        if (e.kind === 'time') { const d = (a1.sec || 0) - (a0.sec || 0); if (d > 0) lines.push([e.name, '+' + d + ' s']); }
        else if (e.kind === 'level') { if ((a1.lv || 0) > (a0.lv || 0)) lines.push([e.name, 'niveau supérieur']); else { const d = (a1.r || 0) - (a0.r || 0); if (d > 0) lines.push([e.name, '+' + plural(d, 'rép.').replace('rép.s', 'rép.')]); } }
        else { const dw = (a1.w || 0) - (a0.w || 0), dr = (a1.r || 0) - (a0.r || 0); if (dw > 0) lines.push([e.name, '+' + num(dw, 1) + ' kg']); else if (dw === 0 && dr > 0) lines.push([e.name, '+' + dr + ' rép.']); }
      }
      const dv = Math.round(w.volume - (prev.volume || 0));
      cmp = `<div class="card"><div class="row between"><div class="t-card">Depuis la dernière fois</div><span class="t-label">${esc(fmtShort(parseDk(prev.date)))}</span></div>
        <div class="g2"><div class="delta ${dv >= 0 ? 'up' : 'down'}"><b>${dv >= 0 ? '+' : ''}${num(dv)} kg</b><span>de volume total</span></div><div class="delta ${w.nsets >= prev.nsets ? 'up' : 'down'}"><b>${w.nsets - prev.nsets >= 0 ? '+' : ''}${w.nsets - prev.nsets}</b><span>séries</span></div></div>
        ${lines.length ? `<div class="stack-s">${lines.slice(0, 6).map(([n, t]) => `<div class="row between"><span>${esc(n)}</span><b class="lime">${esc(t)}</b></div>`).join('')}</div>` : '<p class="note">Mêmes perfs que la dernière fois. Vise une répétition de plus à la prochaine.</p>'}</div>`;
    }
    const confetti = w.records.length ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 34 }, (_, k) => `<i style="left:${(k * 37) % 100}%;animation-delay:${((k * 53) % 90) / 100}s;animation-duration:${1.8 + ((k * 29) % 12) / 10}s;background:${['#b5f23d', '#ffffff', '#f2c94c', '#7fd1ff', '#ff7a59'][k % 5]};transform:rotate(${(k * 47) % 360}deg)"></i>`).join('')}</div>` : '';
    return `${confetti}<div class="run-body" style="padding-top:28px">
      <div class="done-hero">${E(w.records.length ? 'trophy' : 'party_popper', 'xl pop')}<div class="t-label">${esc(SES[w.sid].name)}</div><h1 class="t-title">Séance terminée</h1><p class="note" style="text-align:center">${(w.nsets || 0) >= 20 ? 'Grosse séance. Mange tes protéines et dors bien ce soir.' : 'Bien joué. Chaque séance compte.'}</p></div>
      <div class="g3"><div class="tile"><span class="v">${mins}<span class="unit">min</span></span><span class="t-label">durée</span></div><div class="tile"><span class="v">${w.nsets}</span><span class="t-label">séries</span></div><div class="tile"><span class="v">${num(w.volume)}<span class="unit">kg</span></span><span class="t-label">soulevés</span></div></div>
      ${w.records.length ? `<div class="card-lime">${E('sports_medal', 'big-em')}<div class="row"><b style="font-size:19px">${w.records.length > 1 ? plural(w.records.length, 'record') + ' battus' : 'Record battu'}</b></div>${w.records.map((r) => `<div><b>${esc(EX[r.id].name)}</b> : ${esc(r.txt)} <span class="t-label">(avant : ${esc(r.was)})</span></div>`).join('')}</div>` : ''}
${cmp}
      <div class="card"><div class="t-card">La prochaine fois</div>
        ${big.map((x) => `<div class="row" style="align-items:flex-start">${I('arrow-up-right', 'lime')}<span>${esc(x.txt)}</span></div>`).join('')}
        ${small.length ? `<p class="note">+1 répétition visée sur ${plural(small.length, 'exercice')} : ${esc(small.map((x) => x.txt.split(' : ')[0]).join(', '))}.</p>` : ''}
        ${!w.changes.length ? '<p class="note">On garde les mêmes objectifs. Réussis toutes les séries pour débloquer la suite.</p>' : ''}</div>
      <button class="btn primary xl block" data-act="closeDone">Terminer</button></div>`;
  }

  // ---------- Feuilles, messages ----------
  let sheetClose = null;
  function openSheet(html, mount, onClose) {
    const sh = $('#sheet');
    sh.innerHTML = html; sh.onclick = null; sh.oninput = null; sh.onchange = null; sh.scrollTop = 0;
    $('#scrim').classList.add('open');
    sheetClose = onClose || null;
    if (mount) mount(sh);
  }
  function closeSheet() { $('#scrim').classList.remove('open'); $('#sheet').innerHTML = ''; const f = sheetClose; sheetClose = null; if (f) f(); }
  $('#scrim').addEventListener('click', (e) => { if (e.target.id === 'scrim') closeSheet(); });
  function confirmSheet(title, text, okLabel, onOk, danger) {
    openSheet(`<div class="grab"></div><h2>${esc(title)}</h2><p class="t-mute" style="margin:0">${esc(text)}</p><button class="btn ${danger ? 'danger' : 'primary'} xl block" data-ok>${esc(okLabel)}</button><button class="btn block" data-no>Annuler</button>`,
      (sh) => { sh.querySelector('[data-ok]').onclick = () => { closeSheet(); onOk(); }; sh.querySelector('[data-no]').onclick = closeSheet; });
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('open'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('open'), 1800); }

  // ---------- Rendu principal ----------
  const TABS = [['home', 'Accueil', 'house'], ['progress', 'Progrès', 'chart-no-axes-column'], ['food', 'Nutrition', 'utensils'], ['profile', 'Profil', 'user']];
  function render() {
    const nav = $('#nav'), fab = $('#fab');
    if (!S.profile.onboarded) { nav.hidden = true; fab.hidden = true; $('#app').innerHTML = viewOnboarding(); ANIM.mount($('#app')); return; }
    nav.hidden = false;
    nav.innerHTML = TABS.map(([id, label, ic]) => `<button class="${S.tab === id ? 'on' : ''}" data-tab="${id}" aria-current="${S.tab === id ? 'page' : 'false'}">${I(ic)}<span>${label}</span></button>`).join('');
    fab.hidden = !(S.tab === 'food' && !S.sub);
    fab.innerHTML = I('plus');
    let html;
    if (S.sub && S.sub.name === 'detail') html = viewDetail(S.sub.sid);
    else if (S.sub && S.sub.name === 'history') html = viewHistory();
    else html = { home: viewHome, progress: viewProgress, food: viewFood, profile: viewProfile }[S.tab]();
    $('#app').innerHTML = `<main class="page">${html}</main>`;
    ANIM.mount($('#app'));
    if (S.tab === 'progress' && !S.sub) drawProgressCharts();
    if (S.tab === 'food') loadProducts().catch(() => {});
  }

  // ---------- Test de niveau ----------
  function calibLevels(c) {
    const push = c.push, pull = c.pull;
    let plv, preps;
    if (push < 5) { plv = 0; preps = 12; }
    else if (push <= 15) { plv = 1; preps = clamp(Math.round(push * 0.7), 5, 15); }
    else if (push <= 30) { plv = 2; preps = clamp(Math.round(push * 0.45), 8, 15); }
    else { plv = 3; preps = 10; }
    let ulv, ureps;
    if (pull === 0) { ulv = 0; ureps = 6; }
    else if (pull <= 3) { ulv = 1; ureps = 6; }
    else if (pull <= 9) { ulv = 2; ureps = clamp(Math.round(pull * 0.7), 3, 8); }
    else { ulv = 3; ureps = 5; }
    return { plv, preps, ulv, ureps };
  }
  function calibText(c) {
    const L = calibLevels(c);
    return `Départ : pompes « ${EX.pompes.levels[L.plv].toLowerCase()} » en séries de ${L.preps}, tractions « ${EX.pullup.levels[L.ulv].toLowerCase()} » en séries de ${L.ureps}. La dernière série de chaque exercice se fait au max.`;
  }
  function applyCalib(c) {
    const L = calibLevels(c), P = S.profile;
    Object.assign(P.prog.pompes, { lv: L.plv, reps: L.preps, max: EX.pompes.max, stage: 0, fails: 0 });
    Object.assign(P.prog.pullup, { lv: L.ulv, reps: L.ureps, max: EX.pullup.max, stage: 0, fails: 0 });
    // Plus tu es à l'aise en pompes, plus on charge les autres poussées
    if (c.push >= 15) { P.prog.dips.lv = Math.max(P.prog.dips.lv, 2); P.prog.dips.reps = 10; }
    if (c.push >= 25) { P.prog.floorpress.reps = 15; P.prog.ohp.w = 10; }
  }

  // ---------- Première ouverture ----------
  function viewOnboarding() {
    let st = S.onbStep; const P = S.profile;
    if (P.recal && st < 2) st = S.onbStep = 2;
    const dots = `<div class="dots">${[0, 1, 2, 3, 4].map((i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
    const lastW = P.body.weight.slice(-1)[0];
    let mid, cta;
    if (st === 0) {
      mid = `${E('flexed_biceps', 'xl pop')}<h1 style="font-size:34px;font-weight:800">Transformation</h1><p class="t-mute" style="margin:0;font-size:17px">Ton programme de muscu à la maison, tes repas et tes progrès, au même endroit. Cinq questions et c’est parti.</p>`;
      cta = `<button class="btn primary xl block" data-onb="next">Commencer</button>`;
    } else if (st === 1) {
      mid = `${E('balance_scale', 'l')}<h1 class="t-title">Ton point de départ</h1><p class="t-mute" style="margin:0">Il sert à mesurer tes progrès. Tu pourras le changer quand tu veux.</p>
        <label class="field"><span>Taille (cm)</span><input class="input" id="oH" type="number" inputmode="numeric" value="${P.height || ''}"></label>
        <label class="field"><span>Poids aujourd’hui (kg)</span><input class="input" id="oW" type="number" inputmode="decimal" step="0.1" value="${lastW ? lastW.v : ''}" placeholder="Par exemple 92,5"></label>`;
      cta = `<button class="btn primary xl block" data-onb="next">Continuer</button><button class="btn ghost block" data-onb="skip">Passer</button>`;
    } else if (st === 2) {
      const c = S.calib || (S.calib = { push: 10, pull: 0 });
      mid = `${E('flexed_biceps', 'l')}<h1 class="t-title">${P.recal ? 'Nouveau programme, plus dur' : 'Ton niveau'}</h1><p class="t-mute" style="margin:0">${P.recal ? 'Les charges et les volumes ont été revus à la hausse. ' : ''}Deux chiffres pour partir de ton vrai niveau. Sois honnête : l’appli ajuste ensuite à chaque séance.</p>
        ${stepper('cpu', c.push, 'Pompes au sol d’affilée, propres')}
        ${stepper('cpl', c.pull, 'Tractions sans élastique')}
        <p class="note">${esc(calibText(c))}</p>`;
      cta = `<button class="btn primary xl block" data-onb="next">Continuer</button>`;
    } else if (st === 3) {
      const opts = (sel) => [1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${sel === d ? 'selected' : ''}>${cap(DAYS[d])}</option>`).join('');
      mid = `${E('spiral_calendar', 'l')}<h1 class="t-title">Tes jours d\u2019entraînement</h1><p class="t-mute" style="margin:0">Quatre séances d’environ 1 h, finisher compris. Évite de faire deux séances « Haut » deux jours de suite.</p>
        <div class="daypick">${D.ORDER.map((sid) => `<label class="field"><span>${esc(SES[sid].name)}, ${esc(SES[sid].sub.toLowerCase())}</span><select class="input" data-oday="${sid}">${opts(P.days[sid])}</select></label>`).join('')}</div>`;
      cta = `<button class="btn primary xl block" data-onb="next">Continuer</button>`;
    } else {
      mid = `${E('bullseye', 'l')}<h1 class="t-title">Ton objectif nutrition</h1><p class="t-mute" style="margin:0">Environ 2 200 kcal et 140 g de protéines par jour pour perdre du gras sans perdre de muscle. Si ton poids ne bouge pas en 3 semaines, on baisse un peu.</p>
        <div class="g2"><label class="field"><span>Calories par jour</span><input class="input" id="oK" type="number" inputmode="numeric" value="${P.targets.kcal}"></label><label class="field"><span>Protéines (g)</span><input class="input" id="oP" type="number" inputmode="numeric" value="${P.targets.p}"></label></div>
        <div class="card"><div class="row">${E('sparkles', 's')}<b>Astuce</b></div><p class="note">Pour l’avoir comme une appli : dans Safari, bouton Partager puis « Sur l’écran d’accueil ».</p></div>`;
      cta = `<button class="btn primary xl block" data-onb="done">C’est parti</button>`;
    }
    return `<div class="onb">${dots}<div class="mid">${mid}</div><div class="stack">${cta}</div></div>`;
  }
  function onbAction(a) {
    const P = S.profile;
    if (S.onbStep === 1 && a === 'next') {
      const h = parseFloat(($('#oH') || {}).value), w = parseFloat(String(($('#oW') || {}).value || '').replace(',', '.'));
      if (h > 100 && h < 250) P.height = h;
      if (w > 30 && w < 300) { const d = dk(new Date()); const ex = P.body.weight.find((x) => x.d === d); if (ex) ex.v = w; else P.body.weight.push({ d, v: w }); }
    }
    if (S.onbStep === 2 && a === 'next') applyCalib(S.calib || { push: 10, pull: 0 });
    if (S.onbStep === 4) {
      const k = parseInt(($('#oK') || {}).value, 10), p = parseInt(($('#oP') || {}).value, 10);
      if (k > 1000) P.targets.kcal = k;
      if (p > 30) P.targets.p = p;
    }
    if (a === 'done') { P.onboarded = true; P.recal = false; if (!S.workouts.length) P.startDate = dk(new Date()); saveProfile(); S.tab = 'home'; render(); return; }
    S.onbStep = Math.min(4, S.onbStep + 1);
    saveProfile(); render(); window.scrollTo(0, 0);
  }

  // ---------- Accueil ----------
  const sidForDay = (wd) => D.ORDER.find((sid) => S.profile.days[sid] === wd);
  const workoutsOn = (date) => S.workouts.filter((w) => w.date === date);
  const weekCount = (mon) => Array.from({ length: 7 }, (_, i) => workoutsOn(dk(addDays(mon, i))).length).reduce((a, b) => a + b, 0);
  function weekStreak() {
    let n = 0, m = mondayOf(new Date());
    if (weekCount(m) >= 4) n++;
    m = addDays(m, -7);
    while (weekCount(m) >= 4) { n++; m = addDays(m, -7); }
    return n;
  }
  function challenge() {
    const wk = weekNo(), mon = mondayOf(new Date());
    const days = Array.from({ length: 7 }, (_, i) => S.days[dk(addDays(mon, i))]).filter(Boolean);
    const type = ['sessions', 'protein', 'steps'][(wk - 1) % 3];
    if (type === 'sessions') { const n = weekCount(mon); return { title: '4 séances sur 4', txt: 'Fais toutes les séances de la semaine, même en version courte.', n: Math.min(n, 4), goal: 4, icon: 'flexed_biceps' }; }
    if (type === 'protein') { const t = S.profile.targets.p - 10; const n = days.filter((d) => d.items.reduce((a, it) => a + it.p, 0) >= t).length; return { title: `${t} g de protéines, 5 jours`, txt: 'Une source de protéines à chaque repas : skyr, œufs, poulet, thon.', n: Math.min(n, 5), goal: 5, icon: 'bullseye' }; }
    const n = days.filter((d) => (d.steps || 0) >= 8000).length;
    return { title: '8 000 pas, 5 jours', txt: 'La marche, c’est ce qui fait fondre le gras sans courir.', n: Math.min(n, 5), goal: 5, icon: 'person_running' };
  }
  function viewHome() {
    const now = new Date(), today = dk(now), wk = weekNo(now), mon = mondayOf(now);
    const doneThisWeek = new Set();
    for (let i = 0; i < 7; i++) workoutsOn(dk(addDays(mon, i))).forEach((w) => doneThisWeek.add(w.sid));
    const strip = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i), key = dk(d), sid = sidForDay(d.getDay());
      const done = workoutsOn(key).length > 0;
      const miss = !done && sid && key < today && !doneThisWeek.has(sid);
      let inner = '', cls = '';
      if (done) { inner = I('check'); cls = 'done'; }
      else if (sid) { inner = SES[sid].name.replace('Haut ', 'H').replace('Bas ', 'B'); cls = miss ? 'miss' : 'plan'; }
      else { inner = '<i></i>'; cls = 'rest'; }
      return `<div class="wd ${key === today ? 'today' : ''}"><span class="l">${DAYS_S[d.getDay()]}<small>${d.getDate()}</small></span><span class="c ${cls}">${inner}</span></div>`;
    }).join('');

    const tsid = sidForDay(now.getDay());
    let hero;
    if (S.current) {
      const c = S.current, done = c.steps.filter((s) => c.log[s.id][s.set].done).length;
      hero = `<section class="hero"><div class="glow"></div>${E('stopwatch', 'hero-em')}<span class="pill lime" style="justify-self:start">En cours</span><div class="stack-s"><h2 class="t-title">${esc(SES[c.sid].name)}</h2><span class="t-mute">${done} séries sur ${c.steps.length}</span></div><div class="bar"><i style="width:${Math.round((done / c.steps.length) * 100)}%"></i></div><button class="btn primary xl block" data-act="resume">${I('play')} Reprendre la séance</button></section>`;
    } else if (tsid && !workoutsOn(today).some((w) => w.sid === tsid)) {
      const s = SES[tsid], nEx = s.blocks.reduce((a, [, ids]) => a + ids.length, 0);
      hero = `<section class="hero"><div class="glow"></div>${E('person_lifting_weights', 'hero-em')}<span class="pill lime" style="justify-self:start">Séance du jour</span>
        <div class="stack-s"><h2 style="font-size:40px;font-weight:800">${esc(s.name)}</h2><span class="t-mute">${esc(s.sub)}</span></div>
        <div class="meta"><span class="pill">${I('clock')} ${s.minutes} min</span><span class="pill">${I('dumbbell')} ${nEx} exercices</span><span class="pill">${I('calendar-days')} Semaine ${wk}</span></div>
        <div class="row"><button class="btn primary xl grow" data-act="start" data-sid="${tsid}">${I('play')} Commencer</button><button class="btn xl" data-act="detail" data-sid="${tsid}" aria-label="Voir le détail">${I('list')}</button></div></section>`;
    } else if (workoutsOn(today).length) {
      const w = workoutsOn(today)[0];
      hero = `<section class="hero"><div class="glow"></div>${E('party_popper', 'hero-em')}<span class="pill lime" style="justify-self:start">${I('circle-check')} Fait</span><div class="stack-s"><h2 class="t-title">${esc(SES[w.sid].name)} terminée</h2><span class="t-mute">${plural(w.nsets, 'série')}, ${num(w.volume)} kg soulevés. Une petite marche ce soir et la journée est parfaite.</span></div></section>`;
    } else {
      let next = null;
      for (let i = 1; i <= 7 && !next; i++) { const d = addDays(now, i); const s = sidForDay(d.getDay()); if (s) next = { d, s }; }
      hero = `<section class="hero">${E('crescent_moon', 'hero-em')}<span class="pill" style="justify-self:start">${I('moon')} Repos</span><div class="stack-s"><h2 class="t-title">Jour de récupération</h2><span class="t-mute">Les muscles grandissent pendant le repos. Objectif du jour : 8 000 pas.</span></div>
        ${next ? `<div class="next"><div class="thumb">${ANIM.svg(animOf(SES[next.s].blocks[1][1][0]), '', true)}</div><div class="grow"><div class="t-label">Prochaine séance, ${esc(DAYS[next.d.getDay()])}</div><b>${esc(SES[next.s].name)}</b></div><button class="btn small" data-act="detail" data-sid="${next.s}">Voir</button></div>` : ''}</section>`;
    }
    const missed = D.ORDER.filter((sid) => { const d = addDays(mon, (S.profile.days[sid] + 6) % 7); return dk(d) < today && !doneThisWeek.has(sid); });
    const catchUp = !S.current && missed.length ? `<section class="card"><div class="row between"><div class="t-card">À rattraper</div><span class="t-label">${plural(missed.length, 'séance')}</span></div><div class="row wrap">${missed.map((sid) => `<button class="btn small" data-act="start" data-sid="${sid}">${I('play')} ${esc(SES[sid].name)}</button>`).join('')}</div></section>` : '';
    const ch = challenge();
    const day = S.days[today];
    const kcal = day ? day.items.reduce((a, it) => a + it.k, 0) : 0;
    const steps = day ? day.steps || 0 : 0;
    const lastW = S.profile.body.weight.slice(-1)[0], firstW = S.profile.body.weight[0];
    const programme = D.ORDER.map((sid) => {
      const s = SES[sid];
      return `<button class="scard" data-act="detail" data-sid="${sid}"><div class="vis">${ANIM.svg(animOf(s.blocks[1][1][0]), '', true)}</div><div class="body"><div class="row between"><b style="font-size:19px">${esc(s.name)}</b><span class="pill">${esc(cap(DAYS_3[S.profile.days[sid]]))}</span></div><span class="t-label">${esc(s.sub)}, ${s.minutes} min</span></div></button>`;
    }).join('');
    const hour = now.getHours();
    return `<header class="head"><div><h1>${hour < 18 ? 'Bonjour' : 'Bonsoir'}</h1><p>${esc(fmtLong(now))}, semaine ${wk}</p></div>
        <div class="row" style="gap:8px"><button class="ibtn" data-act="history" aria-label="Historique des séances">${I('history')}</button><button class="ibtn" data-act="calendar" aria-label="Ajouter au calendrier">${I('calendar-plus')}</button></div></header>
      ${hero}
      <section class="stack"><div class="section-head"><h2>Ta semaine</h2><span class="t-label">${weekCount(mon)} sur 4</span></div><div class="week">${strip}</div></section>
      ${catchUp}
      <section class="card-lime">${E(ch.icon, 'big-em')}<span class="t-label">Défi de la semaine</span><b style="font-size:22px">${esc(ch.title)}</b><span style="font-size:14px;max-width:80%">${esc(ch.txt)}</span><div class="row"><div class="bar grow"><i style="width:${(ch.n / ch.goal) * 100}%"></i></div><b>${ch.n}/${ch.goal}</b></div></section>
      <section class="g2">
        <button class="tile" data-tab="food"><span class="top"><span class="t-label">Calories</span>${E('fire', 's')}</span><span class="v">${num(kcal)}</span><span class="t-label">sur ${num(S.profile.targets.kcal)} kcal</span></button>
        <button class="tile" data-act="steps"><span class="top"><span class="t-label">Pas</span>${E('person_running', 's')}</span><span class="v">${num(steps)}</span><span class="t-label">objectif 8 000</span></button>
        <button class="tile" data-act="weight"><span class="top"><span class="t-label">Poids</span>${E('balance_scale', 's')}</span><span class="v">${lastW ? num(lastW.v, 1) : '—'}<span class="unit">kg</span></span>${lastW && firstW && lastW !== firstW ? `<span class="trend ${lastW.v <= firstW.v ? 'up' : 'flat'}">${I(lastW.v <= firstW.v ? 'arrow-down-right' : 'arrow-up-right')}${num(lastW.v - firstW.v, 1)} kg</span>` : '<span class="t-label">Note ta pesée</span>'}</button>
        <div class="tile"><span class="top"><span class="t-label">Série</span>${E('high_voltage', 's')}</span><span class="v">${weekStreak()}</span><span class="t-label">semaines complètes d’affilée</span></div>
      </section>
      <section class="stack"><div class="section-head"><h2>Mon programme</h2><span class="t-label">4 séances</span></div><div class="rail">${programme}</div></section>`;
  }
  function viewDetail(sid) {
    const s = SES[sid], wk = weekNo();
    const nEx = s.blocks.reduce((a, [, ids]) => a + ids.length, 0);
    const list = s.blocks.map(([label, ids]) => `<div class="group-label" style="padding:12px 0 0">${blockName(label)}</div>` + ids.map((id, j) => `<button class="li" data-act="info" data-id="${id}"><div class="thumb">${ANIM.svg(animOf(id), '', true)}</div><div class="tx"><b><span class="lime">${label}${ids.length > 1 ? j + 1 : ''}</span>\u2002${esc(EX[id].name)}</b><span>${esc(planLine(id, planFor(id, wk)))}</span></div><span class="end">${I('chevron-right')}</span></button>`).join('')).join('');
    return `<header class="head"><button class="ibtn" data-act="back" aria-label="Retour">${I('chevron-left')}</button><div class="grow"><h1>${esc(s.name)}</h1><p>${esc(s.sub)}, le ${esc(DAYS[S.profile.days[sid]])}</p></div></header>
      <div class="strip">${s.blocks.flatMap(([, ids]) => ids).map((id) => `<button class="strip-it" data-act="info" data-id="${id}"><div class="sv">${ANIM.svg(animOf(id), '', true)}</div><span>${esc(EX[id].name)}</span></button>`).join('')}</div>
      <div class="meta"><span class="pill">${I('clock')} ${s.minutes} min</span><span class="pill">${I('dumbbell')} ${nEx} exercices</span><span class="pill">${I('flame')} Finisher cardio</span></div>
      <div class="card stack-s bm-wrap"><div class="t-card">Muscles travaillés</div>${ANIM.bodyMap(sesMuscles(sid))}</div>

      <p class="note">Les exercices numérotés 1 et 2 s\u2019enchaînent : une série de chaque, 30 s de pause entre les deux, puis 75 s avant de recommencer. Le finisher sert à vider le réservoir.</p>
      <div class="list">${list}</div>
      <button class="btn primary xl block" data-act="start" data-sid="${sid}">${I('play')} Commencer la séance</button>`;
  }
  function viewHistory() {
    const list = S.workouts.slice().sort((a, b) => b.startedAt - a.startedAt);
    return `<header class="head"><button class="ibtn" data-act="back" aria-label="Retour">${I('chevron-left')}</button><div class="grow"><h1>Historique</h1><p>${plural(list.length, 'séance')} au total</p></div></header>
      ${list.length ? `<div class="list">${list.map((w) => `<button class="li" data-act="wdetail" data-wid="${w.id}"><div class="ic-sq">${E('flexed_biceps', 's')}</div><div class="tx"><b>${esc(SES[w.sid].name)}</b><span>${esc(fmtLong(parseDk(w.date)))}, ${Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000))} min</span></div><span class="end">${num(w.volume)} kg ${I('chevron-right')}</span></button>`).join('')}</div>`
        : `<div class="card empty">${E('clipboard', 'l')}<span>Tes séances apparaîtront ici après la première.</span></div>`}`;
  }
  function workoutSheet(wid) {
    const w = S.workouts.find((x) => x.id === wid); if (!w) return;
    openSheet(`<div class="grab"></div><div><div class="t-label">${esc(fmtLong(parseDk(w.date)))}</div><h2>${esc(SES[w.sid].name)}</h2></div>
      <div class="g3"><div class="tile"><span class="v">${Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000))}<span class="unit">min</span></span></div><div class="tile"><span class="v">${w.nsets}</span><span class="t-label">séries</span></div><div class="tile"><span class="v">${num(w.volume)}<span class="unit">kg</span></span></div></div>
      <div class="list">${w.items.filter((it) => it.sets.length).map((it) => `<div class="li"><div class="tx"><b>${esc(EX[it.id].name)}</b><span>${esc(it.sets.map((s) => setText(it.id, s)).join(', '))}</span></div></div>`).join('')}</div>
      <button class="btn block" data-close>Fermer</button>`, (sh) => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  function stepsSheet() {
    const day = getDay(dk(new Date()));
    let v = day.steps || 0;
    const draw = () => `<div class="grab"></div><h2>Tes pas aujourd’hui</h2><p class="note">Regarde le chiffre dans l’app Santé de ton iPhone et recopie-le ici.</p>
      ${stepper('st', num(v), 'Nombre de pas')}<label class="field"><span>Ou tape le chiffre</span><input class="input" id="stIn" type="number" inputmode="numeric" value="${v || ''}"></label>
      <button class="btn primary xl block" data-ok>Enregistrer</button>`;
    openSheet(draw(), (sh) => {
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.st) { v = Math.max(0, v + +b.dataset.st * 500); sh.innerHTML = draw(); return; }
        if (b.hasAttribute('data-ok')) { const t = parseInt($('#stIn', sh).value, 10); if (t >= 0) v = t; day.steps = v; saveDay(day.date); closeSheet(); render(); toast('Pas enregistrés.'); }
      };
    });
  }
  function bodySheet(kind) {
    const isW = kind === 'weight';
    openSheet(`<div class="grab"></div><h2>${isW ? 'Ta pesée' : 'Ton tour de taille'}</h2><p class="note">${isW ? 'Le matin, à jeun, après les toilettes. Une fois par semaine suffit.' : 'Au niveau du nombril, ventre relâché. Tous les 15 jours.'}</p>
      <label class="field"><span>${isW ? 'Poids (kg)' : 'Tour de taille (cm)'}</span><input class="input" id="bIn" type="number" inputmode="decimal" step="0.1" placeholder="${isW ? 'Par exemple 92,4' : 'Par exemple 104'}"></label>
      <button class="btn primary xl block" data-ok>Enregistrer</button>`, (sh) => {
      setTimeout(() => { const i = $('#bIn', sh); if (i) i.focus(); }, 50);
      sh.querySelector('[data-ok]').onclick = () => {
        const v = parseFloat(String($('#bIn', sh).value).replace(',', '.'));
        if (!(isW ? v > 30 && v < 300 : v > 40 && v < 250)) return toast(isW ? 'Indique ton poids en kg, par exemple 92,4.' : 'Indique ton tour de taille en cm, par exemple 104.');
        const arr = S.profile.body[kind], d = dk(new Date());
        const ex = arr.find((x) => x.d === d); if (ex) ex.v = v; else arr.push({ d, v });
        arr.sort((a, b) => (a.d < b.d ? -1 : 1));
        saveProfile(); closeSheet(); render(); toast('Enregistré.');
      };
    });
  }

  // ---------- Progrès ----------
  function periodFilter(pts) {
    if (S.period === 'all') return pts;
    const days = S.period === '1m' ? 31 : 92;
    const lim = dk(addDays(new Date(), -days));
    return pts.filter((p) => p.x >= lim);
  }
  function strengthSeries(id) {
    const e = EX[id];
    return S.workouts.slice().sort((a, b) => a.startedAt - b.startedAt).map((w) => {
      const it = w.items.find((x) => x.id === id); if (!it || !it.sets.length) return null;
      const top = it.sets.slice().sort((a, b) => setScore(id, b) - setScore(id, a))[0];
      const y = e.kind === 'time' ? top.sec : e.kind === 'level' ? top.r : (top.w ? e1rm(top.w, top.r) : top.r);
      return { x: w.date, y: +y.toFixed(1), note: setText(id, top) };
    }).filter(Boolean);
  }
  function trendHtml(a, b, unit, lowerIsBetter) {
    if (a == null || b == null || a === b) return '<span class="trend flat">Pas encore de tendance</span>';
    const d = a - b, good = lowerIsBetter ? d < 0 : d > 0;
    const pct = b ? Math.round((d / b) * 100) : 0;
    return `<span class="trend ${good ? 'up' : 'flat'}">${I(d < 0 ? 'arrow-down-right' : 'arrow-up-right')}${d > 0 ? '+' : ''}${num(d, 1)} ${unit}${pct ? ` (${pct > 0 ? '+' : ''}${pct} %)` : ''}</span>`;
  }
  function viewProgress() {
    const seg = `<div class="seg">${[['force', 'Force'], ['body', 'Corps'], ['reg', 'Régularité'], ['photos', 'Photos']].map(([id, l]) => `<button class="${S.progTab === id ? 'on' : ''}" data-ptab="${id}">${l}</button>`).join('')}</div>`;
    const per = `<div class="seg" style="max-width:260px">${[['1m', '1 mois'], ['3m', '3 mois'], ['all', 'Tout']].map(([id, l]) => `<button class="${S.period === id ? 'on' : ''}" data-period="${id}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (S.progTab === 'force') {
      const ids = Object.keys(EX).filter((id) => EX[id].kind !== 'cardio');
      const withData = ids.filter((id) => S.workouts.some((w) => w.items.some((x) => x.id === id && x.sets.length)));
      if (!S.statEx || !withData.includes(S.statEx)) S.statEx = withData[0] || null;
      if (!S.statEx) body = `<div class="card empty">${E('chart_increasing', 'l')}<span>Tes courbes de force apparaîtront après ta première séance.</span><button class="btn primary small" data-tab="home">Voir la séance du jour</button></div>`;
      else {
        const e = EX[S.statEx];
        const pts = periodFilter(strengthSeries(S.statEx));
        const last = pts[pts.length - 1], first = pts[0];
        const unit = e.kind === 'time' ? 's' : e.kind === 'level' ? 'rép.' : 'kg';
        const label = e.kind === 'time' ? 'Meilleur temps' : e.kind === 'level' ? 'Meilleure série' : 'Force estimée';
        const recs = withData.filter((id) => EX[id].kind === 'pair' || EX[id].kind === 'single').map((id) => ({ id, b: bestSet(id) })).sort((a, b) => b.b.sc - a.b.sc).slice(0, 4);
        body = `<div class="chips">${withData.map((id) => `<button class="chip ${S.statEx === id ? 'on' : ''}" data-statex="${id}">${esc(EX[id].name)}</button>`).join('')}</div>
          <section class="hero"><div class="row between"><span class="t-label">${label}</span>${per}</div>
            <div class="stack-s"><span class="t-num lime">${last ? num(last.y, 1) : '—'}<span class="unit">${unit}</span></span>${trendHtml(last && last.y, first && first.y, unit)}</div>
            <div class="chart" id="chS"></div><p class="note">${e.kind === 'pair' || e.kind === 'single' ? 'Charge que tu pourrais soulever une seule fois, estimée à partir de ta meilleure série (formule d’Epley).' : 'Ta meilleure série à chaque séance.'}</p></section>
          ${recs.length ? `<section class="stack"><div class="section-head"><h2>Records personnels</h2></div><div class="g2">${recs.map((r) => `<div class="tile"><span class="top"><span class="t-label">${esc(EX[r.id].name)}</span>${E('trophy', 's')}</span><span class="v rec">${recHtml(r.id, r.b.s)}</span><span class="t-label">${esc(fmtShort(parseDk(r.b.date)))}</span></div>`).join('')}</div></section>` : ''}
          <button class="btn block" data-act="history">${I('history')} Voir l’historique des séances</button>`;
      }
    } else if (S.progTab === 'body') {
      const W = S.profile.body.weight, T = S.profile.body.waist;
      const lw = W.slice(-1)[0], fw = W[0], lt = T.slice(-1)[0], ft = T[0];
      const bmi = lw && S.profile.height ? lw.v / Math.pow(S.profile.height / 100, 2) : null;
      body = `<section class="hero"><div class="row between"><span class="t-label">Poids</span><button class="btn small primary" data-act="weight">${I('plus')} Noter</button></div>
          <div class="stack-s"><span class="t-num lime">${lw ? num(lw.v, 1) : '—'}<span class="unit">kg</span></span>${trendHtml(lw && lw.v, fw && fw.v, 'kg', true)}</div><div class="chart" id="chW"></div>
          ${bmi ? `<p class="note">IMC ${num(bmi, 1)}. Le tour de taille dit mieux ce qui se passe que la balance.</p>` : ''}</section>
        <section class="card"><div class="row between"><span class="t-card">Tour de taille</span><button class="btn small" data-act="waist">${I('plus')} Noter</button></div>
          <div class="stack-s"><span class="t-num">${lt ? num(lt.v, 1) : '—'}<span class="unit">cm</span></span>${trendHtml(lt && lt.v, ft && ft.v, 'cm', true)}</div><div class="chart" id="chT"></div></section>
        <section class="card"><div class="row between"><span class="t-card">Pas, 14 derniers jours</span><button class="btn small" data-act="steps">${I('plus')} Noter</button></div><div class="chart" id="chP"></div></section>`;
    } else if (S.progTab === 'reg') {
      const total = S.workouts.length, kg = S.workouts.reduce((a, w) => a + (w.volume || 0), 0);
      body = `<div class="g3"><div class="tile"><span class="v">${total}</span><span class="t-label">séances</span></div><div class="tile"><span class="v">${weekStreak()}</span><span class="t-label">semaines complètes</span></div><div class="tile"><span class="v">${kg >= 10000 ? num(kg / 1000, 1) + '<span class="unit">t</span>' : num(kg) + '<span class="unit">kg</span>'}</span><span class="t-label">soulevés</span></div></div>
        <section class="card"><div class="row between"><span class="t-card">Séances par semaine</span><span class="t-label">objectif 4</span></div><div class="chart" id="chR"></div></section>
        <section class="card"><div class="row between"><span class="t-card">Calories, 14 derniers jours</span><span class="t-label">objectif ${num(S.profile.targets.kcal)}</span></div><div class="chart" id="chK"></div></section>
        <button class="btn block" data-act="history">${I('history')} Voir l’historique des séances</button>`;
    } else body = photosBody();
    return `<header class="head"><div><h1>Progrès</h1><p>Semaine ${weekNo()} du programme</p></div></header>${seg}${body}`;
  }
  function drawProgressCharts() {
    if ($('#chS') && S.statEx) lineChart($('#chS'), periodFilter(strengthSeries(S.statEx)), { unit: EX[S.statEx].kind === 'time' ? 's' : EX[S.statEx].kind === 'level' ? 'rép.' : 'kg', dec: 1 });
    if ($('#chW')) lineChart($('#chW'), periodFilter(S.profile.body.weight.map((p) => ({ x: p.d, y: p.v }))), { unit: 'kg', dec: 1 });
    if ($('#chT')) lineChart($('#chT'), periodFilter(S.profile.body.waist.map((p) => ({ x: p.d, y: p.v }))), { unit: 'cm', dec: 1 });
    if ($('#chP')) barChart($('#chP'), Array.from({ length: 14 }, (_, i) => { const d = addDays(new Date(), -(13 - i)); const day = S.days[dk(d)]; const v = day ? day.steps || 0 : 0; return { label: DAYS_S[d.getDay()], y: v, tip: fmtShort(d) + ' : ' + num(v) + ' pas', dim: v < 8000 }; }), { target: 8000 });
    if ($('#chR')) { const mon = mondayOf(new Date()); barChart($('#chR'), Array.from({ length: 8 }, (_, i) => { const m = addDays(mon, -7 * (7 - i)); const n = weekCount(m); return { label: fmtShort(m), y: n, tip: 'Semaine du ' + fmtShort(m) + ' : ' + plural(n, 'séance'), dim: n < 4 }; }), { target: 4, max: 5, labelEvery: 2 }); }
    if ($('#chK')) barChart($('#chK'), Array.from({ length: 14 }, (_, i) => { const d = addDays(new Date(), -(13 - i)); const day = S.days[dk(d)]; const k = day ? day.items.reduce((a, it) => a + it.k, 0) : 0; return { label: DAYS_S[d.getDay()], y: k, tip: fmtShort(d) + ' : ' + num(k) + ' kcal', dim: k === 0 }; }), { target: S.profile.targets.kcal });
    if ($('#cmp')) bindCompare($('#cmp'));
  }
  function niceTicks(lo, hi, n) {
    if (lo === hi) { lo -= 1; hi += 1; }
    const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || 10 * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const t = []; for (let v = a; v <= b + 1e-9; v += step) t.push(+v.toFixed(6));
    return t;
  }
  function lineChart(el, pts, o) {
    if (!el) return;
    if (pts.length < 2) { el.innerHTML = `<div class="empty">${I('chart-no-axes-column')}<span>${pts.length ? 'Encore une valeur et la courbe apparaît.' : 'Pas encore de données sur cette période.'}</span></div>`; return; }
    const W = Math.max(260, el.clientWidth || 320), H = 170, L = 36, R = 10, Tp = 12, B = 24;
    const xs = pts.map((p) => parseDk(p.x).getTime()), ys = pts.map((p) => p.y);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    const ticks = niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 3);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = (t) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R);
    const Y = (v) => Tp + (1 - (v - y0) / (y1 - y0 || 1)) * (H - Tp - B);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    const area = path + ` L${X(xs[xs.length - 1]).toFixed(1)} ${H - B} L${X(xs[0]).toFixed(1)} ${H - B} Z`;
    const last = pts.length - 1, gid = 'g' + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5f23d" stop-opacity="0.26"/><stop offset="1" stop-color="#b5f23d" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axis" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${num(v, o.dec)}</text>`).join('')}
      <text class="axis" x="${L}" y="${H - 6}">${fmtShort(parseDk(pts[0].x))}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(parseDk(pts[last].x))}</text>
      <path d="${area}" fill="url(#${gid})"/><path class="line" d="${path}"/>
      <circle class="dot" cx="${X(xs[last]).toFixed(1)}" cy="${Y(pts[last].y).toFixed(1)}" r="6"/>
      <line class="cross" data-cx x1="0" x2="0" y1="${Tp}" y2="${H - B}" style="display:none"/><circle class="dot" data-cd r="6" style="display:none"/>
      <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg><div class="tip"></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cx = el.querySelector('[data-cx]'), cd = el.querySelector('[data-cd]');
    const move = (ev) => {
      const r = svg.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W;
      let bi = 0; xs.forEach((x, i) => { if (Math.abs(X(x) - px) < Math.abs(X(xs[bi]) - px)) bi = i; });
      const xx = X(xs[bi]), yy = Y(pts[bi].y);
      cx.setAttribute('x1', xx); cx.setAttribute('x2', xx); cx.style.display = ''; cd.setAttribute('cx', xx); cd.setAttribute('cy', yy); cd.style.display = '';
      tip.style.display = 'block'; tip.style.left = clamp((xx / W) * 100, 14, 86) + '%'; tip.style.top = Math.max(0, (yy / H) * r.height - 38) + 'px';
      tip.textContent = fmtShort(parseDk(pts[bi].x)) + ' : ' + (pts[bi].note || num(pts[bi].y, o.dec) + ' ' + o.unit);
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; cx.style.display = 'none'; cd.style.display = 'none'; });
  }
  function barChart(el, bars, o) {
    if (!el) return;
    const W = Math.max(260, el.clientWidth || 320), H = 160, L = 40, R = 6, Tp = 12, B = 22;
    const maxV = Math.max(o.max || 0, (o.target || 0) * 1.15, Math.max.apply(null, bars.map((b) => b.y)) * 1.1) || 1;
    const ticks = niceTicks(0, maxV, 3);
    const top = ticks[ticks.length - 1];
    const Y = (v) => Tp + (1 - v / top) * (H - Tp - B);
    const slot = (W - L - R) / bars.length, bw = Math.max(6, slot - 6);
    const body = bars.map((b, i) => {
      const x = L + i * slot + (slot - bw) / 2, y = Y(b.y), h = H - B - y;
      const r = Math.min(4, bw / 2, h);
      const d = h > 0.5 ? `M${x.toFixed(1)} ${(H - B).toFixed(1)} V${(y + r).toFixed(1)} Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)} H${(x + bw - r).toFixed(1)} Q${(x + bw).toFixed(1)} ${y.toFixed(1)} ${(x + bw).toFixed(1)} ${(y + r).toFixed(1)} V${(H - B).toFixed(1)} Z` : '';
      return `${d ? `<path class="bar ${b.dim ? 'dim' : ''}" d="${d}"/>` : ''}${i % (o.labelEvery || 1) === 0 ? `<text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>` : ''}<rect x="${(L + i * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" fill="transparent" data-bi="${i}"/>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogramme">
      ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axis" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${num(v)}</text>`).join('')}
      ${body}${o.target ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(o.target).toFixed(1)}" y2="${Y(o.target).toFixed(1)}"/>` : ''}</svg><div class="tip"></div>`;
    const tip = el.querySelector('.tip'), svg = el.querySelector('svg');
    const show = (ev) => {
      const t = ev.target.closest('[data-bi]'); if (!t) return;
      const i = +t.dataset.bi, r = svg.getBoundingClientRect();
      tip.style.display = 'block'; tip.style.left = clamp(((L + i * slot + slot / 2) / W) * 100, 16, 84) + '%'; tip.style.top = Math.max(0, (Y(bars[i].y) / H) * r.height - 38) + 'px'; tip.textContent = bars[i].tip;
    };
    svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show); svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
  }

  // ---------- Photos ----------
  function photosBody() {
    const list = S.photos.slice().sort((a, b) => b.createdAt - a.createdAt);
    const groups = {};
    list.forEach((p) => { (groups[p.date] = groups[p.date] || []).push(p); });
    let cmp = '';
    if (S.cmp.length === 2) {
      const [a, b] = S.cmp.map((id) => S.photos.find((x) => x.id === id)).sort((x, y) => x.createdAt - y.createdAt);
      if (a && b) cmp = `<section class="card"><div class="row between"><span class="t-card">Avant, après</span><button class="btn small" data-act="cmpClear">Fermer</button></div>
        <div class="cmp" id="cmp"><img src="${a.thumb}" data-full="${a.id}" alt="Avant"><img class="after" src="${b.thumb}" data-full="${b.id}" alt="Après"><div class="knob"></div><span class="lbl" style="left:10px">${esc(fmtShort(parseDk(a.date)))}</span><span class="lbl" style="right:10px">${esc(fmtShort(parseDk(b.date)))}</span></div>
        <p class="note">Fais glisser ton doigt sur la photo pour comparer.</p></section>`;
    } else if (S.cmp.length === 1) cmp = `<section class="card"><div class="row between"><span class="t-card">Comparer</span><button class="btn small" data-act="cmpClear">Annuler</button></div><p class="note">Choisis une deuxième photo dans la grille.</p></section>`;
    return `<section class="card"><span class="t-card">Nouvelle photo</span><p class="note">Une série toutes les 4 semaines : même endroit, même lumière, même heure. Visibles par toi seul.</p>
        <div class="seg">${['face', 'profil', 'dos'].map((p) => `<button class="${S.photoPose === p ? 'on' : ''}" data-pose="${p}">${cap(p)}</button>`).join('')}</div>
        <label class="btn primary block" style="cursor:pointer">${I('camera')} Prendre ou choisir une photo<input type="file" id="pfile" accept="image/*" hidden></label></section>
      ${cmp}
      ${list.length ? Object.keys(groups).sort().reverse().map((d) => `<section class="stack-s"><div class="t-label">${esc(fmtLong(parseDk(d)))}</div><div class="pgrid">${groups[d].map((p) => `<button class="ph ${S.cmp.includes(p.id) ? 'sel' : ''}" data-photo="${p.id}"><img src="${p.thumb}" alt="Photo ${esc(p.pose)} du ${esc(d)}"><span>${esc(cap(p.pose))}</span></button>`).join('')}</div></section>`).join('')
        : `<div class="card empty">${E('camera_with_flash', 'l')}<span>Pas encore de photo. La première sert de point de départ : tu seras content de l’avoir dans 3 mois.</span></div>`}`;
  }
  function bindCompare(box) {
    box.querySelectorAll('img[data-full]').forEach((im) => getFull(im.dataset.full).then((s) => { if (s) im.src = s; }));
    const after = box.querySelector('.after'), knob = box.querySelector('.knob');
    const set = (ev) => { const r = box.getBoundingClientRect(); const p = clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100); after.style.clipPath = `inset(0 0 0 ${p}%)`; knob.style.left = p + '%'; };
    box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); set(e); });
    box.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') set(e); });
  }
  function resizeImage(file, maxSide, quality, maxChars) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let s = maxSide, q = quality, out = '';
        for (let k = 0; k < 6; k++) {
          const sc = Math.min(1, s / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= maxChars) break;
          s = Math.round(s * 0.82); q = Math.max(0.5, q - 0.06);
        }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  async function addPhoto(file) {
    toast('Préparation de la photo…');
    try {
      const full = await resizeImage(file, 1100, 0.74, 220000);
      const thumb = await resizeImage(file, 260, 0.62, 24000);
      const id = uid();
      const meta = { kind: 'photo', id, date: dk(new Date()), pose: S.photoPose, thumb, createdAt: Date.now() };
      S.photos.push(meta); lsSet('photos', S.photos);
      if (Store.col) { await Store.write('pf_' + id, { kind: 'photofull', id, data: full }); Store.write('pm_' + id, meta); } else lsSet('pf_' + id, full);
      render(); toast('Photo ajoutée.');
    } catch (e) { toast('Cette image n’a pas pu être lue. Essaie une autre photo.'); }
  }
  async function getFull(id) { const local = lsGet('pf_' + id); if (local) return local; const d = await Store.get('pf_' + id); return d ? d.data : null; }
  function photoSheet(id) {
    const p = S.photos.find((x) => x.id === id); if (!p) return;
    openSheet(`<div class="grab"></div><div class="row between"><h2>${esc(cap(p.pose))}, ${esc(fmtShort(parseDk(p.date)))}</h2><button class="btn small" data-close>Fermer</button></div><img id="bigimg" src="${p.thumb}" alt="Photo de progression" style="width:100%;border-radius:18px;display:block"><div class="g2"><button class="btn" data-cmp>Comparer</button><button class="btn danger" data-del>${I('trash-2')} Supprimer</button></div>`, (sh) => {
      getFull(id).then((src) => { const im = $('#bigimg', sh); if (src && im) im.src = src; });
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-close')) return closeSheet();
        if (b.hasAttribute('data-cmp')) { S.cmp = [id]; closeSheet(); render(); return; }
        if (b.hasAttribute('data-del')) return confirmSheet('Supprimer cette photo ?', 'Elle sera effacée définitivement.', 'Supprimer', () => { S.photos = S.photos.filter((x) => x.id !== id); S.cmp = S.cmp.filter((x) => x !== id); lsSet('photos', S.photos); lsDel('pf_' + id); Store.del('pm_' + id); Store.del('pf_' + id); render(); }, true);
      };
    });
  }

  // ---------- Nutrition ----------
  const MEALS = [['pdj', 'Petit-déjeuner', 'hot_beverage'], ['dej', 'Déjeuner', 'shallow_pan_of_food'], ['col', 'Collation', 'cookie'], ['din', 'Dîner', 'steaming_bowl']];
  const CAT_EM = { 'Fruits': 'red_apple', 'Fruits secs': 'peanuts', 'Légumes': 'broccoli', 'Féculents': 'cooked_rice', 'Viandes': 'poultry_leg', 'Poissons': 'fish', 'Œufs et laitiers': 'egg', 'Sauces et matières grasses': 'butter', 'Plats préparés': 'bento_box', 'Restauration rapide': 'hamburger', 'Boulangerie et desserts': 'croissant', 'Grignotage': 'popcorn', 'Boissons': 'cup_with_straw', 'Mes aliments': 'star' };
  const KW_EM = [[/skyr|yaourt|yogourt|fromage blanc|lait|petit.suisse|kefir/, 'glass_of_milk'], [/fromage|emmental|comt|camembert|mozza|feta|chevre|raclette|brie/, 'cheese_wedge'], [/pain|brioche|baguette|biscotte|wrap|tortilla/, 'bread'], [/cookie|biscuit|gateau|madeleine|gaufre|prince|sable/, 'cookie'], [/chocolat|nutella|pate a tartiner/, 'chocolate_bar'], [/jus|soda|cola|boisson|eau|the glace|limonade|sirop/, 'cup_with_straw'], [/cereale|muesli|granola|flocon|corn flakes/, 'bowl_with_spoon'], [/jambon|poulet|dinde|saucisse|steak|boeuf|porc|lardon|chorizo|saucisson/, 'cut_of_meat'], [/thon|saumon|sardine|maquereau|poisson|crevette|surimi/, 'fish'], [/pizza/, 'pizza'], [/chips|cracker|bretzel|aperitif|pop.?corn/, 'popcorn'], [/pates|spaghetti|riz|semoule|quinoa|lentille/, 'cooked_rice'], [/compote|pomme|banane|fruit|orange/, 'red_apple'], [/legume|salade|soupe|gaspacho|tomate|carotte/, 'leafy_green'], [/beurre|huile|mayonnaise|sauce|vinaigrette|ketchup|moutarde/, 'butter'], [/cafe|capsule|expresso/, 'hot_beverage'], [/biere/, 'beer_mug'], [/\bvin\b/, 'wine_glass'], [/glace|sorbet/, 'ice_cream'], [/oeuf/, 'egg'], [/amande|noix|cacahu|noisette|pistache/, 'peanuts']];
  const foodEm = (f) => { const n = norm(f.name).replace(/œ/g, 'oe'); for (const [re, em] of KW_EM) if (re.test(n)) return em; return (f.cat && CAT_EM[f.cat]) || 'canned_food'; };
  const SNACKS = ['Clémentine', 'Radis', 'Skyr nature', 'Amandes', 'Pomme'];
  function mealNow() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? 'pdj' : h < 15 ? 'dej' : h < 18.5 ? 'col' : 'din'; }
  function ringSvg(size, stroke, pct, color, cls) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return `<svg class="${cls || ''}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--card-2)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - clamp(pct, 0, 1))).toFixed(1)}"/></svg>`;
  }
  function viewFood() {
    const date = S.nutDate, d = parseDk(date), day = S.days[date] || { items: [] };
    const tot = day.items.reduce((a, it) => ({ k: a.k + it.k, p: a.p + it.p, c: a.c + it.c, f: a.f + it.f }), { k: 0, p: 0, c: 0, f: 0 });
    const T = S.profile.targets, over = tot.k > T.kcal, left = T.kcal - tot.k;
    const isToday = date === dk(new Date());
    const yday = S.days[dk(addDays(d, -1))];
    const mr = (label, v, t, col) => `<div class="mring">${ringSvg(38, 5, v / t, col)}<div><b>${num(v)}<span class="t-label"> / ${t} g</span></b><span class="lab">${label}</span></div></div>`;
    const meals = MEALS.map(([m, label, ic]) => {
      const its = day.items.filter((it) => it.meal === m);
      const mk = its.reduce((a, it) => a + it.k, 0), mp = its.reduce((a, it) => a + it.p, 0);
      const yIts = yday ? yday.items.filter((it) => it.meal === m) : [];
      const snack = m === 'col' && !its.length ? `<div class="stack-s"><span class="t-label">Idées pour grignoter sans déraper</span><div class="row wrap">${SNACKS.map((n) => `<button class="chip" data-snack="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : '';
      return `<section class="card" style="gap:6px"><div class="meal-head"><div class="ic-sq">${E(ic, 's')}</div><div class="grow"><b style="font-size:17px">${label}</b><div class="t-label">${its.length ? num(mp) + ' g de protéines sur 30' : 'Rien pour l’instant'}</div></div><span class="kc">${num(mk)} <small>kcal</small></span>${its.length ? `<button class="ibtn sm" data-fav="${m}" aria-label="Enregistrer ce repas en favori">${I('star')}</button>` : ''}<button class="ibtn sm" data-act="addFood" data-meal="${m}" aria-label="Ajouter au ${label.toLowerCase()}">${I('plus')}</button></div>
        ${its.map((it) => `<button class="food-row" data-act="editItem" data-iid="${it.id}"><div class="tx"><b>${esc(it.name)}</b><span>${num(it.g)} g, ${num(it.p, 1)} g de protéines</span></div><span class="kc">${num(it.k)} <small>kcal</small></span></button>`).join('')}
        ${!its.length && yIts.length ? `<button class="btn small outline" data-copy="${m}">${I('copy')} Copier celui d’hier (${num(yIts.reduce((a, it) => a + it.k, 0))} kcal)</button>` : ''}${snack}</section>`;
    }).join('');
    return `<header class="head"><div><h1>Nutrition</h1><p>${isToday ? 'Aujourd’hui, ' + esc(fmtLong(d).toLowerCase()) : esc(fmtLong(d))}</p></div>
        <div class="row" style="gap:8px"><button class="ibtn" data-act="dayPrev" aria-label="Jour précédent">${I('chevron-left')}</button><button class="ibtn" data-act="dayNext" aria-label="Jour suivant" ${isToday ? 'disabled style="opacity:.35"' : ''}>${I('chevron-right')}</button></div></header>
      <section class="hero"><div class="glow"></div><div class="ringbox"><div class="kring">${ringSvg(140, 12, tot.k / T.kcal, over ? 'var(--m-c)' : 'var(--lime)')}<div class="ctr"><span class="t-num" style="font-size:32px">${num(Math.abs(left))}</span><span class="t-label">${over ? 'kcal en trop' : 'kcal restantes'}</span></div></div>
        <div class="mrings">${mr('Protéines', tot.p, T.p, 'var(--m-p)')}${mr('Glucides', tot.c, T.c, 'var(--m-c)')}${mr('Lipides', tot.f, T.f, 'var(--m-f)')}</div></div>
        <div class="row between"><span class="t-label">${num(tot.k)} kcal mangées</span><span class="t-label">objectif ${num(T.kcal)}</span></div></section>
      ${meals}
      <p class="note">Produits du commerce : données <a href="https://fr.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (licence ODbL), plus de 90 000 produits vendus en France. Aliments simples : valeurs moyennes.</p>`;
  }
  function allFoods() {
    const mine = (S.profile.foods || []).map((f) => ({ name: f.name, k: f.k, p: f.p, c: f.c, f: f.f, portion: f.portion, pg: f.pg, cat: 'Mes aliments', mine: true }));
    return mine.concat(FOODS.map((r) => ({ name: r[0], k: r[1], p: r[2], c: r[3], f: r[4], portion: r[5], pg: r[6], cat: r[7] })));
  }
  function addItem(day, meal, f, g) {
    day.items.push({ id: uid(), meal, name: f.name, g: Math.round(g), k: Math.round((f.k * g) / 100), p: +((f.p * g) / 100).toFixed(1), c: +((f.c * g) / 100).toFixed(1), f: +((f.f * g) / 100).toFixed(1), per: { k: f.k, p: f.p, c: f.c, f: f.f, portion: f.portion, pg: f.pg } });
  }
  let sampleFn = null, sampleImages = false;
  async function initSample() {
    try {
      if (!window.claude || !window.claude.use) return;
      sampleFn = await window.claude.use('sample');
      if (sampleFn && sampleFn.limits) { const l = await sampleFn.limits().catch(() => null); sampleImages = !!(l && l.images); }
    } catch (e) { sampleFn = null; }
  }
  // Base Open Food Facts, chargée au premier passage sur Nutrition
  const loadScript = (src) => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); });
  let PRODUCTS = null, BYCODE = null, productsP = null;
  function tidy(t) {
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letters.length > 3 && letters === letters.toUpperCase()) { t = t.toLowerCase(); t = t.charAt(0).toUpperCase() + t.slice(1); }
    return t;
  }
  function loadProducts() {
    if (productsP) return productsP;
    productsP = loadScript('products.js').then(() => {
      const raw = window.FORGE_OFF || '';
      PRODUCTS = []; BYCODE = new Map();
      raw.split('\n').forEach((line) => {
        const a = line.split('|'); if (a.length < 9) return;
        const pr = { code: a[0], name: tidy(a[1]), brand: tidy(a[2]), qty: a[3], k: +a[4], p: +a[5], c: +a[6], f: +a[7], sg: +a[8], off: true };
        if (pr.brand && norm(pr.name).includes(norm(pr.brand))) pr.brand = '';
        pr.key = norm(pr.name + ' ' + pr.brand);
        PRODUCTS.push(pr); BYCODE.set(pr.code, pr);
      });
      window.FORGE_OFF = null;
      return PRODUCTS;
    }).catch(() => { productsP = null; PRODUCTS = null; throw new Error('products'); });
    return productsP;
  }
  function productFood(pr) {
    let portion = '100 g', pg = 100, pack = 0;
    const m = /([\d.,]+)\s*(g|ml|cl|l|kg)\b/i.exec(pr.qty || '');
    if (m) { const v = parseFloat(m[1].replace(',', '.')); const u = m[2].toLowerCase(); pack = u === 'kg' || u === 'l' ? v * 1000 : u === 'cl' ? v * 10 : v; }
    if (pr.sg > 0 && pr.sg < 1500) { portion = '1 portion'; pg = pr.sg; } else if (pack > 0 && pack <= 400) { portion = '1 paquet ou 1 pot'; pg = Math.round(pack); }
    return { name: pr.brand ? pr.name + ' (' + pr.brand + ')' : pr.name, k: pr.k, p: pr.p, c: pr.c, f: pr.f, portion, pg, off: true, code: pr.code };
  }
  async function decodeBarcode(file) {
    const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
    if ('BarcodeDetector' in window) {
      try { const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }); const r = await det.detect(img); if (r && r[0]) return r[0].rawValue; } catch (e) { /* ZXing ensuite */ }
    }
    if (!window.ZXing) await loadScript('vendor/zxing.min.js');
    const ZX = window.ZXing;
    const hints = new Map();
    hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E]);
    hints.set(ZX.DecodeHintType.TRY_HARDER, true);
    const reader = new ZX.MultiFormatReader(); reader.setHints(hints);
    const W0 = img.naturalWidth, H0 = img.naturalHeight;
    for (const sz of [1200, 800, 1700, 600]) {
      for (const rot of [0, 90]) {
        const s = Math.min(1, sz / Math.max(W0, H0)), w = Math.round(W0 * s), h = Math.round(H0 * s);
        const c = document.createElement('canvas'); c.width = rot ? h : w; c.height = rot ? w : h;
        const ctx = c.getContext('2d');
        if (rot) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
        ctx.drawImage(img, 0, 0, w, h);
        try { const r = reader.decode(new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.HTMLCanvasElementLuminanceSource(c)))); if (r) return r.getText(); } catch (e) { /* essai suivant */ }
      }
    }
    return null;
  }
  function findCode(code) {
    if (!BYCODE || !code) return null;
    const c = String(code).replace(/\D/g, '');
    return BYCODE.get(c) || BYCODE.get('0' + c) || BYCODE.get(c.replace(/^0+/, '')) || null;
  }
  async function scanFlow(file, meal) {
    openSheet(`<div class="grab"></div><h2>Lecture du code-barres</h2><div class="skel"></div>`);
    let code = null;
    try { [code] = await Promise.all([decodeBarcode(file), loadProducts()]); } catch (e) { code = null; }
    if (!code) {
      return openSheet(`<div class="grab"></div><h2>Code-barres illisible</h2><p class="t-mute" style="margin:0">Reprends la photo de plus près, bien à plat et sans reflet. Ou tape les chiffres écrits sous le code.</p>
        <div class="row"><input class="input grow" id="mcode" inputmode="numeric" placeholder="Par exemple 3017620422003" aria-label="Chiffres du code-barres"><button class="btn primary" data-go>Chercher</button></div><button class="btn block" data-back>Retour</button>`, (sh) => {
        sh.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.hasAttribute('data-back')) return addFoodSheet(meal); if (b.hasAttribute('data-go')) codeResult($('#mcode', sh).value, meal); };
      });
    }
    codeResult(code, meal);
  }
  async function codeResult(code, meal) {
    try { await loadProducts(); } catch (e) { /* base indisponible */ }
    const pr = findCode(code);
    if (pr) return qtySheet(productFood(pr), meal);
    openSheet(`<div class="grab"></div><h2>Produit inconnu</h2><p class="t-mute" style="margin:0">Le code ${esc(code)} n’est pas dans la base. Prends l’étiquette nutritionnelle en photo, ou crée le produit : il restera dans « Mes aliments ».</p>
      ${sampleFn && sampleImages ? `<label class="btn primary block" style="cursor:pointer">${I('camera')} Photo de l’étiquette<input type="file" id="lphoto" accept="image/*" hidden></label>` : ''}<button class="btn block" data-create>Créer le produit</button><button class="btn ghost block" data-back>Retour</button>`, (sh) => {
      sh.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.hasAttribute('data-back')) return addFoodSheet(meal); if (b.hasAttribute('data-create')) return createFoodSheet(meal, ''); };
      const ph = $('#lphoto', sh); if (ph) ph.onchange = () => { if (ph.files && ph.files[0]) photoFood(ph.files[0], meal); };
    });
  }
  function addFoodSheet(meal) {
    meal = meal || mealNow();
    let q = '';
    const foods = allFoods();
    let shown = [];
    const row = (f, i) => `<button class="food-row" data-fi="${i}"><span class="avatar">${E(foodEm(f), 's')}</span><div class="tx"><b>${esc(f.name)} ${f.mine ? '<span class="tag">Perso</span>' : ''}</b><span>${esc(f.portion)}, ${num(f.pg)} g</span></div><span class="kc">${num((f.k * f.pg) / 100)} <small>kcal</small></span></button>`;
    const draw = () => {
      shown = [];
      const push = (f) => { shown.push(f); return row(f, shown.length - 1); };
      if (!q.trim()) {
        const favs = (S.profile.favMeals || []);
        const rec = (S.profile.recent || []).map((n) => foods.find((f) => f.name === n) || (S.profile.recentOff || {})[n]).filter(Boolean).slice(0, 10);
        const mine = foods.filter((f) => f.mine).slice(0, 15);
        let h = '';
        if (favs.length) h += '<div class="group-label">Mes repas</div>' + favs.map((fm, i) => `<button class="food-row" data-favi="${i}"><span class="avatar">${E('star', 's')}</span><div class="tx"><b>${esc(fm.name)}</b><span>${plural(fm.items.length, 'aliment')}</span></div><span class="kc">${num(fm.items.reduce((a, it) => a + it.k, 0))} <small>kcal</small></span></button>`).join('');
        if (rec.length) h += '<div class="group-label">Récents</div>' + rec.map(push).join('');
        if (mine.length) h += '<div class="group-label">Mes aliments</div>' + mine.map(push).join('');
        return h || `<div class="empty">${I('search')}<span>Tape un aliment, un produit ou une marque, ou scanne un code-barres.</span></div>`;
      }
      const words = norm(q).split(/\s+/).filter(Boolean);
      const gen = foods.filter((f) => { const n = norm(f.name + ' ' + f.cat); return words.every((w) => n.includes(w)); }).slice(0, 10);
      let prod = [];
      if (PRODUCTS) {
        const starts = [], other = [];
        for (const pr of PRODUCTS) {
          if (!words.every((w) => pr.key.includes(w))) continue;
          (pr.key.startsWith(words[0]) ? starts : other).push(pr);
          if (starts.length >= 40) break;
        }
        prod = starts.concat(other).slice(0, 40).map(productFood);
      }
      let h = '';
      if (gen.length) h += '<div class="group-label">Aliments</div>' + gen.map(push).join('');
      if (prod.length) h += '<div class="group-label">Produits du commerce</div>' + prod.map(push).join('');
      if (!PRODUCTS) h += '<div class="group-label">Produits du commerce</div><div class="skel"></div><div class="skel"></div>';
      if (!gen.length && !prod.length && PRODUCTS) h += `<div class="empty">${I('circle-alert')}<span>Rien trouvé pour « ${esc(q)} ». Scanne le code-barres ou crée l’aliment.</span></div>`;
      return h;
    };
    const mealLabel = (MEALS.find((m) => m[0] === meal) || MEALS[0])[1];
    openSheet(`<div class="grab"></div><div class="row between"><h2>${esc(mealLabel)}</h2><button class="btn small" data-close>Fermer</button></div>
      <div class="search">${I('search')}<input class="input" id="fq" type="search" placeholder="Aliment, produit ou marque" autocomplete="off" aria-label="Rechercher un aliment"></div>
      <div class="g2"><label class="btn primary" style="cursor:pointer">${I('scan-barcode')} Scanner<input type="file" id="fscan" accept="image/*" capture="environment" hidden></label>
        ${sampleFn && sampleImages ? `<label class="btn" style="cursor:pointer">${I('camera')} Photo du plat<input type="file" id="fphoto" accept="image/*" hidden></label>` : `<button class="btn" data-create>${I('plus')} Créer</button>`}</div>
      <div class="results" id="fres">${draw()}</div>
      <div class="row wrap">${sampleFn ? `<button class="btn small outline" data-ask>${I('sparkles')} Demander à Claude</button>` : ''}${sampleFn && sampleImages ? `<button class="btn small outline" data-create>${I('plus')} Créer un aliment</button>` : ''}</div>`, (sh) => {
      const inp = $('#fq', sh);
      let t;
      inp.oninput = () => { q = inp.value; clearTimeout(t); t = setTimeout(() => { $('#fres', sh).innerHTML = draw(); }, 120); };
      loadProducts().then(() => { if ($('#fres', sh)) $('#fres', sh).innerHTML = draw(); }).catch(() => {});
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-close')) return closeSheet();
        if (b.dataset.fi != null) return qtySheet(shown[+b.dataset.fi], meal);
        if (b.dataset.favi != null) { const fm = S.profile.favMeals[+b.dataset.favi]; const day = getDay(S.nutDate); fm.items.forEach((it) => day.items.push(Object.assign({}, it, { id: uid(), meal }))); saveDay(S.nutDate); closeSheet(); render(); return toast('Repas ajouté.'); }
        if (b.hasAttribute('data-ask')) return askClaude(q, meal);
        if (b.hasAttribute('data-create')) return createFoodSheet(meal, q);
      };
      const ph = $('#fphoto', sh); if (ph) ph.onchange = () => { if (ph.files && ph.files[0]) photoFood(ph.files[0], meal); };
      const sc = $('#fscan', sh); sc.onchange = () => { if (sc.files && sc.files[0]) scanFlow(sc.files[0], meal); };
    });
  }
  function qtySheet(f, meal, existing) {
    let g = existing ? existing.g : f.pg, m = existing ? existing.meal : meal;
    const vals = () => ({ k: (f.k * g) / 100, p: (f.p * g) / 100, c: (f.c * g) / 100, fa: (f.f * g) / 100 });
    const draw = () => {
      const v = vals();
      return `<div class="grab"></div><div class="row" style="align-items:flex-start">${E(foodEm(f), 'm')}<div class="stack-s grow"><h2>${esc(f.name)}</h2><div class="row wrap"><span class="t-label">${num(f.k)} kcal pour 100 g</span>${f.claude ? '<span class="tag">Estimation Claude</span>' : ''}${f.off ? '<span class="tag">Open Food Facts</span>' : ''}</div></div></div>
        <div class="chips">${[0.5, 1, 1.5, 2].map((x) => `<button class="chip ${Math.abs(g - f.pg * x) < 0.5 ? 'on' : ''}" data-x="${x}">${x === 1 ? esc(f.portion) : x === 0.5 ? 'Une demi' : x + ' ×'} (${num(f.pg * x)} g)</button>`).join('')}</div>
        <label class="field"><span>Quantité en grammes</span><input class="input" id="qg" type="number" inputmode="decimal" value="${Math.round(g)}"></label>
        <div class="g2"><div class="tile" style="background:var(--card)"><span class="t-label">Calories</span><span class="v lime" data-v="k">${num(v.k)}</span></div><div class="tile"><span class="t-label">Protéines</span><span class="v" data-v="p">${num(v.p, 1)}<span class="unit">g</span></span></div><div class="tile"><span class="t-label">Glucides</span><span class="v" data-v="c">${num(v.c)}<span class="unit">g</span></span></div><div class="tile"><span class="t-label">Lipides</span><span class="v" data-v="f">${num(v.fa)}<span class="unit">g</span></span></div></div>
        <div class="seg">${MEALS.map(([id, l]) => `<button class="${m === id ? 'on' : ''}" data-meal="${id}">${l.replace('Petit-déjeuner', 'Matin')}</button>`).join('')}</div>
        <button class="btn primary xl block" data-add>${existing ? 'Enregistrer' : 'Ajouter'}</button>
        ${existing ? `<button class="btn danger block" data-del>${I('trash-2')} Retirer</button>` : '<button class="btn ghost block" data-back>Retour</button>'}`;
    };
    openSheet(draw(), (sh) => {
      const bind = () => { const i = $('#qg', sh); i.oninput = () => { g = Math.max(0, parseFloat(i.value.replace(',', '.')) || 0); const v = vals(); sh.querySelector('[data-v="k"]').textContent = num(v.k); sh.querySelector('[data-v="p"]').innerHTML = num(v.p, 1) + '<span class="unit">g</span>'; sh.querySelector('[data-v="c"]').innerHTML = num(v.c) + '<span class="unit">g</span>'; sh.querySelector('[data-v="f"]').innerHTML = num(v.fa) + '<span class="unit">g</span>'; }; };
      bind();
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.x) { g = f.pg * +b.dataset.x; sh.innerHTML = draw(); bind(); return; }
        if (b.dataset.meal) { m = b.dataset.meal; sh.innerHTML = draw(); bind(); return; }
        if (b.hasAttribute('data-back')) return addFoodSheet(meal);
        if (b.hasAttribute('data-del')) { const day = getDay(S.nutDate); day.items = day.items.filter((it) => it.id !== existing.id); saveDay(S.nutDate); closeSheet(); render(); return; }
        if (b.hasAttribute('data-add')) {
          if (!g) return toast('Indique une quantité.');
          const day = getDay(S.nutDate);
          if (existing) day.items = day.items.filter((it) => it.id !== existing.id);
          addItem(day, m, f, g);
          if (f.claude || f.custom) rememberFood(f);
          S.profile.recent = [f.name].concat((S.profile.recent || []).filter((n) => n !== f.name)).slice(0, 20);
          if (f.off) { const ro = S.profile.recentOff || (S.profile.recentOff = {}); ro[f.name] = { name: f.name, k: f.k, p: f.p, c: f.c, f: f.f, portion: f.portion, pg: f.pg, off: true }; const keep = new Set(S.profile.recent); Object.keys(ro).forEach((n) => { if (!keep.has(n)) delete ro[n]; }); }
          saveProfile(); saveDay(S.nutDate); closeSheet(); render(); toast(existing ? 'Modifié.' : 'Ajouté : ' + f.name);
        }
      };
    });
  }
  function rememberFood(f) {
    const list = S.profile.foods || (S.profile.foods = []);
    if (list.some((x) => norm(x.name) === norm(f.name))) return;
    list.unshift({ name: f.name, k: +f.k, p: +f.p, c: +f.c, f: +f.f, portion: f.portion || '1 portion', pg: +f.pg || 100 });
    if (list.length > 300) list.length = 300;
  }
  function editItem(iid) {
    const day = getDay(S.nutDate), it = day.items.find((x) => x.id === iid); if (!it) return;
    const per = it.per || { k: (it.k / it.g) * 100, p: (it.p / it.g) * 100, c: (it.c / it.g) * 100, f: (it.f / it.g) * 100, portion: it.g + ' g', pg: it.g };
    qtySheet({ name: it.name, k: per.k, p: per.p, c: per.c, f: per.f, portion: per.portion, pg: per.pg }, it.meal, it);
  }
  function createFoodSheet(meal, name) {
    openSheet(`<div class="grab"></div><h2>Créer un aliment</h2><p class="note">Recopie les valeurs « pour 100 g » de l’étiquette.</p>
      <label class="field"><span>Nom</span><input class="input" id="cn" value="${esc(name || '')}"></label>
      <div class="g2"><label class="field"><span>kcal pour 100 g</span><input class="input" id="ck" type="number" inputmode="decimal"></label><label class="field"><span>Protéines (g)</span><input class="input" id="cp" type="number" inputmode="decimal"></label>
      <label class="field"><span>Glucides (g)</span><input class="input" id="cc" type="number" inputmode="decimal"></label><label class="field"><span>Lipides (g)</span><input class="input" id="cf" type="number" inputmode="decimal"></label>
      <label class="field"><span>Nom de la portion</span><input class="input" id="cpn" value="1 portion"></label><label class="field"><span>Poids de la portion (g)</span><input class="input" id="cpg" type="number" inputmode="decimal" value="100"></label></div>
      <button class="btn primary xl block" data-ok>Continuer</button><button class="btn ghost block" data-back>Retour</button>`, (sh) => {
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-back')) return addFoodSheet(meal);
        if (b.hasAttribute('data-ok')) {
          const v = (id) => parseFloat(String($(id, sh).value).replace(',', '.')) || 0;
          const n = $('#cn', sh).value.trim();
          if (!n || !v('#ck')) return toast('Il faut au moins un nom et les kcal.');
          qtySheet({ name: n, k: v('#ck'), p: v('#cp'), c: v('#cc'), f: v('#cf'), portion: $('#cpn', sh).value.trim() || '1 portion', pg: v('#cpg') || 100, custom: true }, meal);
        }
      };
    });
  }
  function sampleError(e) {
    const c = e && e.code;
    if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared') { sampleFn = null; return 'Claude n’est pas autorisé pour cette appli. Crée l’aliment à la main.'; }
    if (c === 'rate_limited') return 'Trop de demandes d’un coup. Réessaie dans un moment.';
    if (c === 'image_rejected') return 'Cette image n’a pas pu être lue. Essaie une autre photo.';
    if (c === 'invalid_json') return 'La réponse n’était pas lisible. Réessaie.';
    if (c === 'cancelled') return '';
    return 'Claude n’a pas pu répondre. Réessaie.';
  }
  async function askClaude(q, meal) {
    if (!sampleFn) return toast('Claude n’est pas disponible ici.');
    if (!q || q.trim().length < 2) return toast('Tape d’abord le nom du produit dans la recherche.');
    openSheet(`<div class="grab"></div><h2>${esc(q)}</h2><p class="t-mute" style="margin:0">Claude cherche les valeurs nutritionnelles…</p><div class="skel"></div>`);
    try {
      const r = await sampleFn.json(`Tu es une base de données nutritionnelle française (valeurs type Ciqual ou Open Food Facts). Aliment ou produit demandé : « ${q.slice(0, 120)} ».
Réponds uniquement avec un objet JSON : {"name": nom court en français, "kcal": kcal pour 100 g, "p": protéines g/100 g, "c": glucides g/100 g, "f": lipides g/100 g, "portion": nom d'une portion habituelle (ex. "1 pot"), "pg": poids de cette portion en g}.
Si c'est une marque connue, donne ses valeurs habituelles. Exemple : {"name":"Skyr nature","kcal":60,"p":10,"c":4,"f":0.2,"portion":"1 pot","pg":150}`, { modelTier: 'quick' });
      if (!r || !isFinite(+r.kcal)) throw { code: 'invalid_json' };
      qtySheet({ name: String(r.name || q).slice(0, 60), k: +r.kcal, p: +r.p || 0, c: +r.c || 0, f: +r.f || 0, portion: String(r.portion || '1 portion').slice(0, 30), pg: +r.pg || 100, claude: true }, meal);
    } catch (e) { const m = sampleError(e); closeSheet(); if (m) toast(m); }
  }
  async function photoFood(file, meal) {
    if (!sampleFn) return;
    openSheet(`<div class="grab"></div><h2>Analyse de la photo</h2><p class="t-mute" style="margin:0">Claude regarde ta photo. Ça peut prendre jusqu’à une minute.</p><div class="skel"></div><div class="skel"></div>`);
    try {
      const r = await sampleFn.json(`Photo pour une appli française de suivi des calories. C'est soit une étiquette nutritionnelle ou un emballage, soit une assiette ou un repas.
Réponds uniquement avec un objet JSON : {"type": "etiquette" ou "repas", "items": [{"name": nom court en français, "grams": quantité consommée estimée en g, "kcal": kcal pour 100 g, "p": protéines g/100 g, "c": glucides g/100 g, "f": lipides g/100 g}], "note": une phrase courte}.
Étiquette : recopie les valeurs pour 100 g et mets grams = la portion indiquée sur l'emballage, sinon 100. Repas : un élément par aliment visible, avec un poids réaliste.`, { images: [file] });
      const items = (r && Array.isArray(r.items) ? r.items : []).filter((x) => x && isFinite(+x.kcal)).slice(0, 12);
      if (!items.length) throw { code: 'invalid_json' };
      const sel = items.map(() => true), grams = items.map((x) => Math.round(+x.grams || 100));
      openSheet(`<div class="grab"></div><div class="stack-s"><h2>${r.type === 'etiquette' ? 'Étiquette lue' : 'Ce que Claude voit'}</h2>${r.note ? `<p class="note">${esc(String(r.note).slice(0, 200))}</p>` : ''}</div>
        ${items.map((x, i) => `<div class="card" style="gap:10px"><div class="row between"><label class="row" style="gap:10px"><input type="checkbox" data-sel="${i}" checked style="width:20px;height:20px;accent-color:#b5f23d"> <b>${esc(String(x.name).slice(0, 60))}</b></label><span class="kc" data-k="${i}">${num((+x.kcal * grams[i]) / 100)} <small>kcal</small></span></div>
          <label class="field"><span>Grammes</span><input class="input" type="number" inputmode="decimal" data-g="${i}" value="${grams[i]}"></label><span class="t-label">Pour 100 g : ${num(+x.kcal)} kcal, ${num(+x.p, 1)} g de protéines</span></div>`).join('')}
        <p class="note">Ce sont des estimations : corrige les grammes si besoin.</p>
        <button class="btn primary xl block" data-add>Ajouter la sélection</button><button class="btn ghost block" data-back>Retour</button>`, (sh) => {
        sh.oninput = (ev) => { const t = ev.target; if (t.dataset.g != null) { const i = +t.dataset.g; grams[i] = Math.max(0, parseFloat(t.value) || 0); sh.querySelector(`[data-k="${i}"]`).innerHTML = num((+items[i].kcal * grams[i]) / 100) + ' <small>kcal</small>'; } };
        sh.onchange = (ev) => { const t = ev.target; if (t.dataset.sel != null) sel[+t.dataset.sel] = t.checked; };
        sh.onclick = (ev) => {
          const b = ev.target.closest('button'); if (!b) return;
          if (b.hasAttribute('data-back')) return addFoodSheet(meal);
          if (b.hasAttribute('data-add')) {
            const day = getDay(S.nutDate);
            items.forEach((x, i) => {
              if (!sel[i] || !grams[i]) return;
              const g = grams[i], f = { name: String(x.name).slice(0, 60), k: +x.kcal, p: +x.p || 0, c: +x.c || 0, f: +x.f || 0, portion: g + ' g', pg: g };
              addItem(day, meal, f, g);
              if (r.type === 'etiquette') rememberFood(f);
            });
            saveProfile(); saveDay(S.nutDate); closeSheet(); render(); toast('Ajouté.');
          }
        };
      });
    } catch (e) { const m = sampleError(e); closeSheet(); if (m) toast(m); }
  }

  // ---------- Profil ----------
  function viewProfile() {
    const P = S.profile;
    const daysTxt = D.ORDER.map((sid) => DAYS_3[P.days[sid]]).join(', ');
    const li = (act, ic, title, sub, end, cls) => `<button class="li ${cls || ''}" data-act="${act}"><div class="ic-sq">${I(ic)}</div><div class="tx"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div><span class="end">${end || ''}${I('chevron-right')}</span></button>`;
    const tg = (act, ic, title, sub, on) => `<div class="li"><div class="ic-sq">${I(ic)}</div><div class="tx"><b>${title}</b><span>${sub}</span></div><button class="switch ${on ? 'on' : ''}" data-act="${act}" aria-pressed="${on}" aria-label="${title}"></button></div>`;
    return `<header class="head"><div><h1>Profil</h1><p>Objectif : ${num(P.targets.kcal)} kcal par jour et 4 séances par semaine</p></div></header>
      <section class="stack-s"><div class="t-label">Entraînement</div><div class="list">
        ${li('pDays', 'calendar-days', 'Jours d’entraînement', esc(daysTxt))}
        ${li('pLoads', 'dumbbell', 'Mes charges', 'Ce que l’appli te propose à la prochaine séance')}
        ${li('pTime', 'clock', 'Heure des séances', 'Pour les rappels du calendrier', esc(P.time))}
        ${li('calendar', 'calendar-plus', 'Ajouter mes séances au calendrier', 'Avec un rappel 30 min avant')}
      </div></section>
      <section class="stack-s"><div class="t-label">Nutrition et corps</div><div class="list">
        ${li('pTargets', 'target', 'Objectifs nutrition', `${num(P.targets.kcal)} kcal, ${P.targets.p} g de protéines`)}
        ${li('pBody', 'ruler', 'Taille et début du programme', `${P.height || '—'} cm, depuis le ${esc(fmtShort(parseDk(P.startDate)))}`)}
      </div></section>
      <section class="stack-s"><div class="t-label">Matériel et son</div><div class="list">
        ${tg('fullBar', 'dumbbell', 'Tous les disques sur une barre', 'Un seul haltère peut monter à 18 kg', P.fullBar)}
        ${tg('sound', 'volume-2', 'Bip à la fin du repos', 'Garde l’écran allumé pendant la séance', P.sound)}
      </div></section>
      <section class="stack-s"><div class="t-label">Données</div><div class="list">
        <div class="li"><div class="ic-sq ${Store.status === 'local' ? '' : 'on'}">${I('circle-check')}</div><div class="tx"><b>${Store.status === 'sync' ? 'Sauvegardé sur ton compte Claude' : Store.status === 'loading' ? 'Chargement…' : 'Enregistré sur cet iPhone'}</b><span>${Store.status === 'sync' ? 'Tu retrouves tout sur ton téléphone et ton ordinateur' : 'Tout reste sur ton téléphone. Exporte une sauvegarde de temps en temps.'}</span></div></div>
        ${li('export', 'download', 'Exporter une sauvegarde', 'Séances, repas, mesures et photos dans un fichier')}
        <label class="li" style="cursor:pointer"><div class="ic-sq">${I('rotate-ccw')}</div><div class="tx"><b>Restaurer une sauvegarde</b><span>À partir d’un fichier exporté</span></div><span class="end">${I('chevron-right')}</span><input type="file" id="importIn" accept="application/json,.json" hidden></label>
        ${li('homescreen', 'house', 'Ajouter à l’écran d’accueil', 'Pour l’ouvrir comme une appli')}
        ${li('reset', 'trash-2', 'Tout effacer', 'Séances, repas, mesures et photos', '', 'danger')}
      </div></section>
      <p class="note" style="text-align:center">Transformation. Produits : Open Food Facts (ODbL). Icônes : Lucide. Illustrations 3D : Microsoft Fluent Emoji (MIT).</p>`;
  }
  function daysSheet() {
    const P = S.profile;
    const opts = (sel) => [1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${sel === d ? 'selected' : ''}>${cap(DAYS[d])}</option>`).join('');
    openSheet(`<div class="grab"></div><h2>Jours d’entraînement</h2>${D.ORDER.map((sid) => `<label class="field"><span>${esc(SES[sid].name)}, ${esc(SES[sid].sub.toLowerCase())}</span><select class="input" data-sday="${sid}">${opts(P.days[sid])}</select></label>`).join('')}<button class="btn primary xl block" data-close>Terminé</button>`, (sh) => {
      sh.onchange = (ev) => { const t = ev.target; if (t.dataset.sday) { P.days[t.dataset.sday] = +t.value; saveProfile(); } };
      sh.querySelector('[data-close]').onclick = () => { closeSheet(); render(); toast('Jours enregistrés.'); };
    });
  }
  function loadsSheet() {
    const ids = Object.keys(EX).filter((id) => EX[id].kind !== 'cardio');
    openSheet(`<div class="grab"></div><div class="row between"><h2>Mes charges</h2><button class="btn small" data-close>Fermer</button></div><p class="note">Ajuste si c’est trop facile ou trop dur. L’appli continue ensuite toute seule.</p>
      <div class="list">${ids.map((id) => `<button class="li" data-adj="${id}"><div class="thumb">${ANIM.svg(animOf(id), '', true)}</div><div class="tx"><b>${esc(EX[id].name)}</b><span>${esc(planLine(id, planFor(id, 3)))}</span></div><span class="end">${I('pencil')}</span></button>`).join('')}</div>`, (sh) => {
      ANIM.mount(sh);
      sh.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.hasAttribute('data-close')) return closeSheet(); if (b.dataset.adj) adjustSheet(b.dataset.adj); };
    });
  }
  function adjustSheet(id) {
    const e = EX[id], v = Object.assign({}, S.profile.prog[id]), wopts = weightOptions(id);
    const draw = () => {
      let h = `<div class="grab"></div><h2>${esc(e.name)}</h2>`;
      if (e.kind === 'level') h += `<div class="field"><span>Niveau</span><div class="row wrap">${e.levels.map((l, i) => `<button class="chip ${v.lv === i ? 'on' : ''}" data-lv="${i}">${esc(l)}</button>`).join('')}</div></div>`;
      if (e.kind === 'pair' || e.kind === 'single') h += stepper('w', v.w ? v.w + '<span class="unit">kg</span>' : '<span class="unit" style="font-size:18px">Poids du corps</span>', e.kind === 'pair' ? 'Poids par haltère' : 'Poids de l’haltère');
      if (e.kind === 'time') h += stepper('s', v.sec + '<span class="unit">s</span>', 'Durée');
      else h += stepper('r', v.reps, `Répétitions visées, de ${e.min} à ${v.max || e.max}`);
      return h + '<button class="btn primary xl block" data-ok>Enregistrer</button><button class="btn ghost block" data-def>Revenir au départ</button>';
    };
    openSheet(draw(), (sh) => {
      sh.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.lv != null) v.lv = +b.dataset.lv;
        else if (b.dataset.w) { const i = wopts.indexOf(v.w); v.w = wopts[clamp((i < 0 ? 0 : i) + +b.dataset.w, 0, wopts.length - 1)]; }
        else if (b.dataset.r) v.reps = clamp(v.reps + +b.dataset.r, e.min, v.max || e.max);
        else if (b.dataset.s) v.sec = clamp(v.sec + +b.dataset.s * 5, 10, 120);
        else if (b.hasAttribute('data-ok')) { S.profile.prog[id] = v; saveProfile(); toast('Enregistré.'); return loadsSheet(); }
        else if (b.hasAttribute('data-def')) { S.profile.prog[id] = initProg(id); saveProfile(); return loadsSheet(); }
        else return;
        sh.innerHTML = draw();
      };
    });
  }
  function targetsSheet() {
    const T = S.profile.targets;
    openSheet(`<div class="grab"></div><h2>Objectifs nutrition</h2><p class="note">Repère : environ 2 200 kcal et 130 à 150 g de protéines. Si ton poids ne bouge pas en 3 semaines, baisse de 150 kcal.</p>
      <div class="g2">${[['kcal', 'Calories par jour'], ['p', 'Protéines (g)'], ['c', 'Glucides (g)'], ['f', 'Lipides (g)']].map(([k, l]) => `<label class="field"><span>${l}</span><input class="input" type="number" inputmode="numeric" data-t="${k}" value="${T[k]}"></label>`).join('')}</div>
      <button class="btn primary xl block" data-ok>Enregistrer</button>`, (sh) => {
      sh.querySelector('[data-ok]').onclick = () => { sh.querySelectorAll('[data-t]').forEach((i) => { const v = parseInt(i.value, 10); if (v > 0) T[i.dataset.t] = v; }); saveProfile(); closeSheet(); render(); toast('Objectifs enregistrés.'); };
    });
  }
  function bodyInfoSheet() {
    const P = S.profile;
    openSheet(`<div class="grab"></div><h2>Taille et début du programme</h2>
      <label class="field"><span>Taille (cm)</span><input class="input" id="bh" type="number" inputmode="numeric" value="${P.height || ''}"></label>
      <label class="field"><span>Début du programme</span><input class="input" id="bs" type="date" value="${P.startDate}"></label>
      <p class="note">Les semaines 1 et 2 se font à 2 séries, puis une semaine plus légère toutes les 9 semaines. Tu es en semaine ${weekNo()}.</p>
      <button class="btn primary xl block" data-ok>Enregistrer</button>`, (sh) => {
      sh.querySelector('[data-ok]').onclick = () => { const h = parseFloat($('#bh', sh).value); if (h > 100 && h < 250) P.height = h; const s = $('#bs', sh).value; if (s) P.startDate = s; saveProfile(); closeSheet(); render(); };
    });
  }
  function timeSheet() {
    openSheet(`<div class="grab"></div><h2>Heure des séances</h2><p class="note">Utilisée pour les rappels quand tu ajoutes tes séances au calendrier.</p><label class="field"><span>Heure</span><input class="input" id="tm" type="time" value="${S.profile.time}"></label><button class="btn primary xl block" data-ok>Enregistrer</button>`, (sh) => {
      sh.querySelector('[data-ok]').onclick = () => { const v = $('#tm', sh).value; if (v) S.profile.time = v; saveProfile(); closeSheet(); render(); };
    });
  }
  function homescreenSheet() {
    openSheet(`<div class="grab"></div><h2>Ajouter à l’écran d’accueil</h2><ol style="margin:0;padding-left:20px;display:grid;gap:10px"><li>Ouvre ce lien dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b>, le carré avec une flèche.</li><li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li></ol><p class="note">Ouvre-la ensuite depuis l’icône : elle s’affiche en plein écran et marche même sans réseau.</p><button class="btn primary block" data-close>Compris</button>`, (sh) => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  let dlFn = null;
  async function saveFile(filename, data) {
    try { if (!dlFn && window.claude && window.claude.use) dlFn = await window.claude.use('downloads'); } catch (e) { dlFn = null; }
    if (dlFn) { try { await dlFn.save({ filename, data }); return true; } catch (e) { if (e && e.code === 'cancelled') return false; } }
    const type = filename.endsWith('.ics') ? 'text/calendar' : 'application/json';
    try {
      const file = new File([data], filename, { type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return false; }
    try {
      const url = URL.createObjectURL(new Blob([data], { type }));
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); return true;
    } catch (e) { /* suite */ }
    try { await navigator.clipboard.writeText(data); toast('Téléchargement impossible ici : le contenu a été copié.'); } catch (e) { toast('Téléchargement impossible sur cet appareil.'); }
    return false;
  }
  async function exportAll() {
    const photos = [];
    for (const p of S.photos) photos.push(Object.assign({}, p, { full: await getFull(p.id) }));
    return JSON.stringify({ app: 'transformation', v: 1, exportedAt: Date.now(), profile: S.profile, workouts: S.workouts, days: S.days, photos, current: S.current });
  }
  async function importAll(text) {
    let d; try { d = JSON.parse(text); } catch (e) { return toast('Ce fichier n’est pas une sauvegarde valide.'); }
    if (!d || !d.profile || !Array.isArray(d.workouts)) return toast('Ce fichier n’est pas une sauvegarde Transformation.');
    S.profile = fixProfile(d.profile); S.profile.onboarded = true; S.profile.recal = false; S.profile.updatedAt = Date.now();
    S.workouts = d.workouts; S.days = d.days || {}; S.current = d.current || null;
    S.photos = (d.photos || []).map((p) => { const m = Object.assign({}, p); delete m.full; return m; });
    lsSet('profile', S.profile); lsSet('workouts', S.workouts); lsSet('days', S.days); lsSet('photos', S.photos); if (S.current) lsSet('current', S.current); else lsDel('current');
    Store.write('profile', S.profile);
    S.workouts.forEach((w) => Store.write(w.id, w));
    Object.keys(S.days).forEach((k) => Store.write('n_' + k, S.days[k]));
    for (const p of d.photos || []) { const m = Object.assign({}, p); delete m.full; Store.write('pm_' + p.id, m); if (p.full) Store.write('pf_' + p.id, { kind: 'photofull', id: p.id, data: p.full }); }
    if (S.current) Store.write('current', S.current);
    S.tab = 'home'; S.sub = null; render(); toast('Sauvegarde restaurée.');
  }
  function buildIcs() {
    const [hh, mm] = (S.profile.time || '18:30').split(':').map(Number);
    const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Transformation//FR', 'CALSCALE:GREGORIAN'];
    D.ORDER.forEach((sid) => {
      const wd = S.profile.days[sid];
      let d = new Date(); for (let i = 0; i < 7; i++) { const x = addDays(new Date(), i); if (x.getDay() === wd) { d = x; break; } }
      const start = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
      lines.push('BEGIN:VEVENT', `UID:${sid}-${S.profile.createdAt}@transformation`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DURATION:PT${SES[sid].minutes + 5}M`, `RRULE:FREQ=WEEKLY;BYDAY=${BY[wd]}`,
        `SUMMARY:Séance ${SES[sid].name}`, `DESCRIPTION:${SES[sid].sub}. Ouvre Transformation pour la faire.`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Séance dans 30 min', 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // ---------- Événements ----------
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('#sheet')) return;
    const tab = ev.target.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; S.sub = null; render(); window.scrollTo(0, 0); return; }
    if (ev.target.closest('#fab')) return addFoodSheet(S.nutDate === dk(new Date()) ? mealNow() : 'dej');
    const onb = ev.target.closest('[data-onb]'); if (onb) return onbAction(onb.dataset.onb);
    const cb = ev.target.closest('[data-cpu],[data-cpl]');
    if (cb && !S.profile.onboarded) {
      const c = S.calib || (S.calib = { push: 10, pull: 0 });
      if (cb.dataset.cpu) c.push = clamp(c.push + +cb.dataset.cpu, 0, 60); else c.pull = clamp(c.pull + +cb.dataset.cpl, 0, 30);
      return render();
    }
    const b = ev.target.closest('[data-act],[data-statex],[data-pose],[data-photo],[data-ptab],[data-period],[data-snack],[data-copy],[data-fav]');
    if (!b) return;
    if (b.dataset.ptab) { S.progTab = b.dataset.ptab; return render(); }
    if (b.dataset.period) { S.period = b.dataset.period; return render(); }
    if (b.dataset.statex) { S.statEx = b.dataset.statex; return render(); }
    if (b.dataset.pose) { S.photoPose = b.dataset.pose; return render(); }
    if (b.dataset.photo) { if (S.cmp.length === 1 && S.cmp[0] !== b.dataset.photo) { S.cmp.push(b.dataset.photo); return render(); } return photoSheet(b.dataset.photo); }
    if (b.dataset.snack) { const f = allFoods().find((x) => x.name === b.dataset.snack); if (f) qtySheet(f, 'col'); return; }
    if (b.dataset.copy) { const y = S.days[dk(addDays(parseDk(S.nutDate), -1))]; if (!y) return; const day = getDay(S.nutDate); y.items.filter((it) => it.meal === b.dataset.copy).forEach((it) => day.items.push(Object.assign({}, it, { id: uid() }))); saveDay(S.nutDate); render(); return toast('Repas copié.'); }
    if (b.dataset.fav) {
      const day = S.days[S.nutDate]; if (!day) return;
      const its = day.items.filter((it) => it.meal === b.dataset.fav); if (!its.length) return;
      const name = its.slice(0, 2).map((it) => it.name.split(' (')[0]).join(', ') + (its.length > 2 ? '…' : '');
      S.profile.favMeals = [{ name, items: its.map((it) => Object.assign({}, it)) }].concat(S.profile.favMeals || []).slice(0, 15);
      saveProfile(); return toast('Repas enregistré dans « Mes repas ».');
    }
    const a = b.dataset.act, id = b.dataset.id, set = b.dataset.set != null ? +b.dataset.set : null;
    switch (a) {
      case 'start': return startSession(b.dataset.sid);
      case 'resume': unlockAudio(); return openRun();
      case 'detail': S.sub = { name: 'detail', sid: b.dataset.sid }; render(); return window.scrollTo(0, 0);
      case 'history': S.sub = { name: 'history' }; render(); return window.scrollTo(0, 0);
      case 'back': S.sub = null; render(); return window.scrollTo(0, 0);
      case 'wdetail': return workoutSheet(b.dataset.wid);
      case 'minimize': return closeRun();
      case 'setsheet': return setsSheet();
      case 'info': return exerciseSheet(id);
      case 'done': unlockAudio(); return validateStep(id, set, null);
      case 'edit': return editSetSheet(id, set);
      case 'work': {
        unlockAudio(); const v = S.current.log[id][set];
        if (EX[id].kind === 'interval') {
          const phases = []; for (let r = 1; r <= v.rounds; r++) { phases.push({ k: 'work', sec: v.work, r }); if (r < v.rounds) phases.push({ k: 'rest', sec: v.rest, r }); }
          return startTimer(phases[0].sec, 'work', () => validateStep(id, set, null), EX[id].name, phases);
        }
        const secs = EX[id].kind === 'cardio' ? v.min * 60 : v.sec; return startTimer(secs, 'work', () => validateStep(id, set, null), EX[id].name);
      }
      case 'tplus': if (S.timer) { S.timer.end += 15000; S.timer.total += 15; } return tickTimer();
      case 'tskip': { const t = S.timer; stopTimer(true); if (t && t.kind === 'work' && t.onEnd) return t.onEnd(); return renderRun(); }
      case 'finish': return finishSheet();
      case 'closeDone': return closeRun();
      case 'steps': return stepsSheet();
      case 'weight': return bodySheet('weight');
      case 'waist': return bodySheet('waist');
      case 'addFood': return addFoodSheet(b.dataset.meal);
      case 'editItem': return editItem(b.dataset.iid);
      case 'dayPrev': S.nutDate = dk(addDays(parseDk(S.nutDate), -1)); return render();
      case 'dayNext': { const n = addDays(parseDk(S.nutDate), 1); if (dk(n) <= dk(new Date())) S.nutDate = dk(n); return render(); }
      case 'cmpClear': S.cmp = []; return render();
      case 'fullBar': S.profile.fullBar = !S.profile.fullBar; saveProfile(); return render();
      case 'sound': S.profile.sound = !S.profile.sound; saveProfile(); return render();
      case 'pDays': return daysSheet();
      case 'pLoads': return loadsSheet();
      case 'pTime': return timeSheet();
      case 'pTargets': return targetsSheet();
      case 'pBody': return bodyInfoSheet();
      case 'homescreen': return homescreenSheet();
      case 'calendar': return saveFile('transformation-seances.ics', buildIcs()).then((ok) => { if (ok) toast('Ouvre le fichier pour ajouter tes séances au calendrier.'); });
      case 'export': return exportAll().then((data) => saveFile('transformation-sauvegarde-' + dk(new Date()) + '.json', data)).then((ok) => { if (ok) toast('Données exportées.'); });
      case 'reset': return confirmSheet('Tout effacer ?', 'Séances, repas, mesures, réglages et photos seront supprimés définitivement.', 'Tout effacer', resetAll, true);
    }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'importIn' && t.files && t.files[0]) {
      const f = t.files[0]; t.value = '';
      return confirmSheet('Restaurer cette sauvegarde ?', 'Tes données actuelles seront remplacées par celles du fichier.', 'Restaurer', () => f.text().then(importAll));
    }
    if (t.closest('#sheet')) return;
    if (t.dataset.oday) { S.profile.days[t.dataset.oday] = +t.value; saveProfile(); }
    else if (t.id === 'pfile' && t.files && t.files[0]) addPhoto(t.files[0]);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tickTimer(); if ($('#run').classList.contains('open')) keepAwake(true); } });

  async function resetAll() {
    const ids = ['profile', 'current'].concat(S.workouts.map((w) => w.id), Object.keys(S.days).map((d) => 'n_' + d), S.photos.map((p) => 'pm_' + p.id), S.photos.map((p) => 'pf_' + p.id));
    S.photos.forEach((p) => lsDel('pf_' + p.id));
    ['profile', 'workouts', 'days', 'photos', 'current'].forEach(lsDel);
    S.profile = defaultProfile(); S.workouts = []; S.days = {}; S.photos = []; S.current = null; S.onbStep = 0; S.tab = 'home'; S.sub = null;
    render(); toast('Tout est effacé.');
    for (const id of ids) await Store.del(id);
  }

  // ---------- Démarrage ----------
  async function boot() {
    S.profile = fixProfile(lsGet('profile') || defaultProfile());
    S.workouts = lsGet('workouts') || [];
    S.days = lsGet('days') || {};
    S.photos = lsGet('photos') || [];
    S.current = lsGet('current');
    render();
    initSample();
    const slow = setTimeout(() => { if (Store.status === 'loading') Store.status = 'local'; }, 10000);
    await Store.init();
    clearTimeout(slow);
    if (!Store.col) { if (S.tab === 'profile') render(); return; }
    const [rp, rw, rd, rph, rc] = await Promise.all([Store.get('profile'), Store.list('workout'), Store.list('day'), Store.list('photo'), Store.get('current')]);
    if (rp && (rp.updatedAt || 0) >= (S.profile.updatedAt || 0)) S.profile = fixProfile(rp);
    else if (S.profile.updatedAt) Store.write('profile', S.profile);
    if (rw) {
      const byId = {}; S.workouts.forEach((w) => { byId[w.id] = w; });
      const remote = new Set(rw.map((w) => w.id));
      rw.forEach((w) => { const c = Object.assign({}, w); delete c._id; byId[w.id] = c; });
      S.workouts.forEach((w) => { if (!remote.has(w.id)) Store.write(w.id, w); });
      S.workouts = Object.values(byId).map((w) => Object.assign({ records: [], changes: [] }, w)).sort((a, b) => a.startedAt - b.startedAt);
    }
    if (rd) {
      rd.forEach((d) => { const loc = S.days[d.date]; const c = Object.assign({}, d); delete c._id; if (!loc || (d.updatedAt || 0) >= (loc.updatedAt || 0)) S.days[d.date] = c; });
      const remote = new Set(rd.map((d) => d.date));
      Object.keys(S.days).forEach((date) => { if (!remote.has(date) && (S.days[date].items.length || S.days[date].steps)) Store.write('n_' + date, S.days[date]); });
    }
    if (rph) { const byId = {}; S.photos.forEach((p) => { byId[p.id] = p; }); rph.forEach((p) => { const c = Object.assign({}, p); delete c._id; byId[p.id] = c; }); S.photos = Object.values(byId); }
    if (rc && (!S.current || (rc.updatedAt || 0) > (S.current.updatedAt || 0))) { const c = Object.assign({}, rc); delete c._id; S.current = c; }
    lsSet('profile', S.profile); lsSet('workouts', S.workouts); lsSet('days', S.days); lsSet('photos', S.photos); if (S.current) lsSet('current', S.current);
    if (!$('#run').classList.contains('open') && !$('#scrim').classList.contains('open')) render();
  }
  boot();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.claude) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__tf = { S, progress, planFor, decodeBarcode, loadProducts, findCode, loadScript, render, applyCalib, calibLevels, setsFor };
})();
