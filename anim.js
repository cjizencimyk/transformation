// Illustrations des mouvements : un personnage en volumes, muscles travaillés en vert, animé entre deux poses.
window.TF_ANIM = (function () {
  function side(o) {
    const off = (p, dx = -4, dy = -1) => p && [p[0] + dx, p[1] + dy];
    return {
      hd: o.hd, nk: o.s, pv: o.p,
      s1: o.s, e1: o.e1, w1: o.w1, s2: o.s, e2: o.e2 || off(o.e1), w2: o.w2 || off(o.w1),
      h1: o.p, k1: o.k1, a1: o.a1, h2: o.p, k2: o.k2 || off(o.k1), a2: o.a2 || off(o.a1),
      t1: o.t1, t2: o.t2,
    };
  }
  function front(o) {
    const L = (p) => [100 + p[0], p[1]], R = (p) => [100 - p[0], p[1]];
    return {
      hd: o.hd, nk: o.nk, pv: o.p,
      s1: L(o.s), e1: L(o.e), w1: L(o.w), s2: R(o.s), e2: R(o.e), w2: R(o.w),
      h1: L(o.h), k1: L(o.k), a1: L(o.a), h2: R(o.h), k2: R(o.k), a2: R(o.a),
      front: true,
    };
  }
  const st = (y = 0) => ({ hd: [101, 36 + y], s: [100, 50 + y], p: [100, 96 + y], k1: [101, 122 + y], a1: [100, 149] });

  const A = {
    pushup: { t: [2000, 1000], c: ['Descends', 'Pousse'], hi: ['torso','ua'], props: ['floor'], w: null, feet: false,
      a: side({ hd: [152, 103], s: [140, 108], p: [97, 124], e1: [140, 128], w1: [141, 148], k1: [72, 133], a1: [47, 143] }),
      b: side({ hd: [153, 131], s: [140, 134], p: [94, 138], e1: [126, 130], w1: [141, 148], k1: [68, 141], a1: [47, 143] }) },
    row1: { t: [1000, 2000], c: ['Tire', 'Relâche'], hi: ['torso','ua'], props: ['floor', 'chairSide'], w: 'w1',
      a: side({ hd: [140, 86], s: [128, 92], p: [82, 98], e1: [128, 112], w1: [127, 132], e2: [131, 102], w2: [133, 112], k1: [80, 124], a1: [76, 149], k2: [92, 124], a2: [98, 149] }),
      b: side({ hd: [140, 86], s: [128, 92], p: [82, 98], e1: [111, 86], w1: [113, 106], e2: [131, 102], w2: [133, 112], k1: [80, 124], a1: [76, 149], k2: [92, 124], a2: [98, 149] }) },
    floorpress: { t: [1000, 2000], c: ['Pousse', 'Descends'], hi: ['torso','ua'], props: ['floor'], w: 'both', feet: false,
      a: side({ hd: [152, 139], s: [138, 142], p: [92, 142], e1: [128, 147], w1: [130, 127], k1: [70, 121], a1: [54, 148] }),
      b: side({ hd: [152, 139], s: [138, 142], p: [92, 142], e1: [137, 121], w1: [138, 101], k1: [70, 121], a1: [54, 148] }) },
    lateral: { t: [1000, 2000], c: ['Monte', 'Descends'], hi: ['delt'], props: ['floor'], w: 'both',
      a: front({ hd: [100, 26], nk: [100, 40], p: [100, 90], s: [15, 44], e: [19, 66], w: [21, 88], h: [9, 92], k: [10, 120], a: [11, 148] }),
      b: front({ hd: [100, 26], nk: [100, 40], p: [100, 90], s: [15, 44], e: [36, 47], w: [56, 46], h: [9, 92], k: [10, 120], a: [11, 148] }) },
    ohp: { t: [1000, 2000], c: ['Pousse', 'Descends'], hi: ['delt','ua'], props: ['floor', 'chairFront'], w: 'both',
      a: front({ hd: [100, 38], nk: [100, 52], p: [100, 104], s: [15, 56], e: [30, 70], w: [30, 50], h: [10, 106], k: [16, 112], a: [16, 148] }),
      b: front({ hd: [100, 38], nk: [100, 52], p: [100, 104], s: [15, 56], e: [22, 34], w: [20, 14], h: [10, 106], k: [16, 112], a: [16, 148] }) },
    dips: { t: [2000, 1000], c: ['Descends', 'Pousse'], hi: ['ua'], props: ['floor', 'chairBack'], w: null,
      a: side({ hd: [78, 64], s: [72, 78], p: [75, 122], e1: [70, 95], w1: [68, 112], k1: [112, 118], a1: [114, 149] }),
      b: side({ hd: [80, 82], s: [74, 96], p: [77, 140], e1: [55, 97], w1: [68, 112], k1: [112, 128], a1: [114, 149] }) },
    triceps: { t: [2000, 1000], c: ['Descends', 'Tends'], hi: ['ua'], props: ['floor'], w: 'w1',
      a: side({ ...st(), e1: [106, 32], w1: [108, 12], e2: [104, 32], w2: [106, 12] }),
      b: side({ ...st(), e1: [106, 32], w1: [90, 44], e2: [104, 32], w2: [88, 44] }) },
    lunge: { t: [2000, 1000], c: ['Descends', 'Remonte'], hi: ['th','glute'], props: ['floor'], w: 'both',
      a: side({ hd: [101, 36], s: [100, 50], p: [100, 96], e1: [101, 72], w1: [102, 94], k1: [102, 122], a1: [102, 149], k2: [98, 122], a2: [98, 149] }),
      b: side({ hd: [98, 54], s: [97, 68], p: [95, 114], e1: [98, 90], w1: [99, 112], k1: [118, 120], a1: [116, 149], k2: [82, 144], a2: [60, 142] }) },
    plank: { c: ['Tiens', 'Tiens'], hi: ['torso'], props: ['floor'], w: null, feet: false, hold: true,
      a: side({ hd: [152, 110], s: [140, 116], p: [96, 130], e1: [140, 146], w1: [162, 147], k1: [71, 137], a1: [45, 146] }),
      b: side({ hd: [152, 110], s: [140, 116], p: [96, 128], e1: [140, 146], w1: [162, 147], k1: [71, 136], a1: [45, 146] }) },
    rdl: { t: [2000, 1000], c: ['Recule les fesses', 'Remonte'], hi: ['th','glute'], props: ['floor'], w: 'both',
      a: side({ ...st(), e1: [101, 72], w1: [102, 95] }),
      b: side({ hd: [140, 64], s: [128, 72], p: [84, 92], e1: [129, 92], w1: [130, 112], k1: [96, 121], a1: [100, 149] }) },
    goblet: { t: [2000, 1000], c: ['Descends', 'Remonte'], hi: ['th'], props: ['floor'], w: 'chest',
      a: side({ ...st(-2), e1: [108, 66], w1: [110, 54] }),
      b: side({ hd: [106, 60], s: [98, 74], p: [80, 116], e1: [116, 96], w1: [110, 82], k1: [114, 116], a1: [100, 149] }) },
    bridge: { t: [1000, 1600], h: [300, 1500], c: ['Pousse', 'Descends'], hc: 'Serre', hi: ['glute','th'], props: ['floor'], w: 'hip', feet: false,
      a: side({ hd: [156, 140], s: [142, 143], p: [100, 143], e1: [124, 146], w1: [108, 147], k1: [74, 120], a1: [60, 149] }),
      b: side({ hd: [156, 140], s: [142, 142], p: [102, 120], e1: [124, 146], w1: [108, 147], k1: [74, 115], a1: [60, 149] }) },
    rower: { t: [900, 1300], h: [150, 150], c: ['Tire', 'Reviens'], hi: ['th','torso'], props: ['rail'], w: 'handle', feet: false,
      a: side({ hd: [116, 78], s: [110, 92], p: [92, 134], e1: [124, 102], w1: [140, 108], k1: [122, 112], a1: [148, 138] }),
      b: side({ hd: [54, 78], s: [56, 92], p: [66, 134], e1: [46, 112], w1: [68, 112], k1: [106, 128], a1: [148, 138] }) },
    pullup: { t: [1200, 2000], c: ['Tire', 'Descends'], hi: ['torso','ua'], props: ['bar'], w: null,
      a: front({ hd: [100, 42], nk: [100, 54], p: [100, 104], s: [15, 56], e: [22, 34], w: [24, 14], h: [9, 106], k: [9, 128], a: [8, 148] }),
      b: front({ hd: [100, 8], nk: [100, 22], p: [100, 72], s: [15, 26], e: [34, 40], w: [24, 14], h: [9, 74], k: [9, 96], a: [8, 116] }) },
    bentrow: { t: [1000, 2500], c: ['Tire', 'Relâche'], hi: ['torso','ua'], props: ['floor'], w: 'both',
      a: side({ hd: [138, 68], s: [126, 76], p: [86, 98], e1: [127, 96], w1: [127, 116], k1: [104, 124], a1: [100, 149] }),
      b: side({ hd: [138, 68], s: [126, 76], p: [86, 98], e1: [106, 74], w1: [110, 94], k1: [104, 124], a1: [100, 149] }) },
    reardelt: { hi: ['delt', 'torso'], props: ['floor'], w: 'both', t: [1000, 2000], c: ['Ouvre', 'Ferme'],
      a: side({ hd: [140, 70], s: [128, 78], p: [86, 98], e1: [130, 98], w1: [131, 118], k1: [104, 124], a1: [100, 149] }),
      b: side({ hd: [140, 70], s: [128, 78], p: [86, 98], e1: [122, 62], w1: [112, 48], k1: [104, 124], a1: [100, 149] }) },
    pushinc: { hi: ['torso','ua'], props: ['bed'], w: null, feet: false, t: [2000, 1000], c: ['Descends', 'Pousse'],
      a: side({ hd: [158, 70], s: [148, 78], p: [100, 108], e1: [150, 95], w1: [151, 112], k1: [72, 128], a1: [44, 147] }),
      b: side({ hd: [152, 92], s: [140, 98], p: [96, 120], e1: [124, 100], w1: [151, 112], k1: [70, 134], a1: [44, 147] }) },
    curl: { t: [1000, 2000], c: ['Monte', 'Descends'], hi: ['ua'], props: ['floor'], w: 'both',
      a: side({ ...st(), e1: [101, 72], w1: [103, 95] }),
      b: side({ ...st(), e1: [101, 72], w1: [115, 57] }) },
    bulgarian: { t: [2000, 1000], c: ['Descends', 'Remonte'], hi: ['th','glute'], props: ['floor', 'chairLow'], w: 'both',
      a: side({ hd: [99, 36], s: [98, 50], p: [96, 96], e1: [99, 72], w1: [100, 94], k1: [108, 122], a1: [112, 149], k2: [82, 120], a2: [58, 116] }),
      b: side({ hd: [98, 56], s: [96, 70], p: [92, 116], e1: [97, 92], w1: [98, 114], k1: [118, 120], a1: [112, 149], k2: [80, 142], a2: [58, 116] }) },
    sideplank: { c: ['Tiens', 'Tiens'], hi: ['torso'], props: ['floor'], w: null, feet: false, hold: true,
      a: side({ hd: [152, 104], s: [140, 110], p: [97, 126], e1: [140, 146], w1: [162, 147], e2: [124, 104], w2: [104, 122], k1: [72, 134], a1: [47, 144] }),
      b: side({ hd: [152, 105], s: [140, 111], p: [97, 129], e1: [140, 146], w1: [162, 147], e2: [124, 106], w2: [104, 125], k1: [72, 136], a1: [47, 144] }) },
    slrdl: { t: [2000, 1000], c: ['Descends', 'Remonte'], hi: ['th','glute'], props: ['floor', 'wall'], w: 'w1',
      a: side({ ...st(), e1: [101, 72], w1: [102, 94], k2: [96, 122], a2: [92, 146] }),
      b: side({ hd: [155, 84], s: [142, 88], p: [98, 96], e1: [142, 108], w1: [141, 128], k1: [102, 122], a1: [100, 149], k2: [72, 94], a2: [46, 98], e2: [150, 104], w2: [156, 116] }) },
    calf: { t: [800, 1500], h: [300, 800], c: ['Monte', 'Descends'], hi: ['shin'], props: ['floor', 'step'], w: 'w1',
      a: side({ hd: [101, 24], s: [100, 38], p: [100, 84], e1: [101, 60], w1: [102, 82], k1: [99, 110], a1: [96, 137], t1: [108, 138] }),
      b: side({ hd: [102, 14], s: [101, 28], p: [101, 74], e1: [102, 50], w1: [103, 72], k1: [100, 100], a1: [98, 126], t1: [108, 138] }) },
    hipthrust: { t: [1000, 1600], h: [300, 1200], c: ['Pousse', 'Descends'], hc: 'Serre', hi: ['glute','th'], props: ['floor', 'bed'], w: 'hip', feet: false,
      a: side({ hd: [153, 104], s: [140, 110], p: [112, 140], e1: [128, 124], w1: [112, 132], k1: [80, 120], a1: [66, 149] }),
      b: side({ hd: [153, 100], s: [140, 108], p: [110, 110], e1: [126, 112], w1: [110, 104], k1: [80, 110], a1: [66, 149] }) },
    mountain: { t: [380, 380], h: [40, 40], c: ['Alterne', 'Alterne'], hi: ['th', 'torso'], props: ['floor'], w: null, feet: false,
      a: side({ hd: [152, 103], s: [140, 108], p: [97, 122], e1: [140, 128], w1: [141, 148], k1: [72, 133], a1: [47, 143], k2: [118, 128], a2: [100, 143] }),
      b: side({ hd: [152, 103], s: [140, 108], p: [97, 122], e1: [140, 128], w1: [141, 148], k1: [118, 128], a1: [100, 143], k2: [72, 133], a2: [47, 143] }) },
    wallsit: { c: ['Tiens', 'Tiens'], hi: ['th'], props: ['floor', 'wallL'], w: null, hold: true,
      a: side({ hd: [72, 56], s: [70, 70], p: [72, 116], e1: [84, 92], w1: [100, 108], k1: [110, 116], a1: [110, 149] }),
      b: side({ hd: [72, 57], s: [70, 71], p: [72, 117], e1: [84, 93], w1: [100, 109], k1: [110, 117], a1: [110, 149] }) },
    squat: { t: [1500, 800], c: ['Descends', 'Remonte'], hi: ['th', 'glute'], props: ['floor'], w: null,
      a: side({ hd: [101, 34], s: [100, 48], p: [100, 95], e1: [118, 52], w1: [136, 54], k1: [102, 121], a1: [100, 149] }),
      b: side({ hd: [106, 60], s: [98, 74], p: [80, 116], e1: [116, 78], w1: [136, 78], k1: [114, 116], a1: [100, 149] }) },
  };
  const lerp = (p, q, u) => (p && q ? [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u] : p || q);
  function mix(a, b, u) { const o = {}; for (const k in a) o[k] = Array.isArray(a[k]) ? lerp(a[k], b[k], u) : a[k]; return o; }
  const f = (n) => n.toFixed(1);
  const mid = (p, q, t = 0.5) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  // Segment effilé : largeur w1 au départ, w2 à l'arrivée, bouts arrondis
  function limb(p, q, w1, w2, cls) {
    if (!p || !q) return '';
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const r1 = w1 / 2, r2 = w2 / 2;
    const a = [p[0] + nx * r1, p[1] + ny * r1], b = [q[0] + nx * r2, q[1] + ny * r2], c = [q[0] - nx * r2, q[1] - ny * r2], d = [p[0] - nx * r1, p[1] - ny * r1];
    return `<path class="${cls}" d="M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} A${f(r2)} ${f(r2)} 0 0 0 ${f(c[0])} ${f(c[1])} L${f(d[0])} ${f(d[1])} A${f(r1)} ${f(r1)} 0 0 0 ${f(a[0])} ${f(a[1])} Z"/>`;
  }
  const dot = (p, r, cls) => (p ? `<circle class="${cls}" cx="${f(p[0])}" cy="${f(p[1])}" r="${r}"/>` : '');
  function dumbbell(p, vertical) {
    if (!p) return '';
    const [x, y] = p;
    if (vertical) return `<g class="db"><rect class="dbh" x="${f(x - 2)}" y="${f(y - 9)}" width="4" height="18" rx="2"/><rect class="dbp" x="${f(x - 8)}" y="${f(y - 14)}" width="16" height="7" rx="3"/><rect class="dbp" x="${f(x - 8)}" y="${f(y + 7)}" width="16" height="7" rx="3"/></g>`;
    return `<g class="db"><rect class="dbh" x="${f(x - 9)}" y="${f(y - 2)}" width="18" height="4" rx="2"/><rect class="dbp" x="${f(x - 15)}" y="${f(y - 8)}" width="7" height="16" rx="3"/><rect class="dbp" x="${f(x + 8)}" y="${f(y - 8)}" width="7" height="16" rx="3"/></g>`;
  }
  const PROPBOX = { chairSide: [117, 70, 159, 150], chairBack: [27, 68, 71, 150], chairLow: [29, 78, 67, 150], chairFront: [69, 106, 131, 150], bed: [131, 112, 191, 150], bar: [35, 3, 165, 25], step: [98, 138, 156, 150], wall: [174, 34, 181, 150], wallL: [48, 30, 58, 150], rail: [22, 118, 172, 143] };
  // Boîte englobante du mouvement (deux poses + matériel), pour cadrer serré
  const BOX = {};
  function bbox(name) {
    if (BOX[name]) return BOX[name];
    const def = A[name];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const add = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const pose of [def.a, def.b]) for (const k in pose) {
      const v = pose[k]; if (!Array.isArray(v)) continue;
      add(v[0], v[1], k === 'hd' ? 12 : (def.w && (k === 'w1' || k === 'w2')) ? 15 : 9);
    }
    for (const pr of def.props) if (PROPBOX[pr]) { const q = PROPBOX[pr]; add(q[0], q[1], 0); add(q[2], q[3], 0); }
    y1 = Math.max(y1, 153);
    return (BOX[name] = [x0, y0, x1, y1]);
  }
  function viewBox(name, pad, minW) {
    const [x0, y0, x1, y1] = bbox(name);
    let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
    w = Math.max(w, minW);
    if (w / h < 1.25) w = h * 1.25; else h = w / 1.25;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function props(list, name) {
    let s = '';
    for (const p of list) {
      if (p === 'floor') { const [x0, , x1] = bbox(name); s += `<ellipse class="shadow" cx="${f((x0 + x1) / 2)}" cy="151" rx="${f((x1 - x0) / 2 + 8)}" ry="4.5"/>`; }
      if (p === 'chairSide') s += '<g class="prop"><rect x="117" y="110" width="42" height="7" rx="3.5"/><rect x="120" y="117" width="4" height="33" rx="2"/><rect x="152" y="117" width="4" height="33" rx="2"/><rect x="153" y="70" width="6" height="47" rx="3"/></g>';
      if (p === 'chairBack') s += '<g class="prop"><rect x="27" y="110" width="44" height="7" rx="3.5"/><rect x="30" y="117" width="4" height="33" rx="2"/><rect x="64" y="117" width="4" height="33" rx="2"/><rect x="27" y="68" width="6" height="49" rx="3"/></g>';
      if (p === 'chairLow') s += '<g class="prop"><rect x="29" y="116" width="38" height="7" rx="3.5"/><rect x="32" y="123" width="4" height="27" rx="2"/><rect x="60" y="123" width="4" height="27" rx="2"/><rect x="29" y="78" width="6" height="45" rx="3"/></g>';
      if (p === 'chairFront') s += '<g class="prop"><rect x="69" y="106" width="62" height="8" rx="4"/><rect x="74" y="114" width="4" height="36" rx="2"/><rect x="122" y="114" width="4" height="36" rx="2"/></g>';
      if (p === 'bed') s += '<g class="prop"><rect x="131" y="112" width="60" height="23" rx="7"/><rect x="136" y="135" width="4" height="15" rx="2"/><rect x="182" y="135" width="4" height="15" rx="2"/></g>';
      if (p === 'bar') s += '<g class="prop"><rect x="40" y="11" width="120" height="6" rx="3"/><rect x="35" y="3" width="7" height="22" rx="3.5"/><rect x="158" y="3" width="7" height="22" rx="3.5"/></g>';
      if (p === 'step') s += '<g class="prop"><rect x="98" y="138" width="58" height="12" rx="3"/></g>';
      if (p === 'wall') s += '<g class="prop"><rect x="174" y="34" width="7" height="116" rx="3.5"/></g>';
      if (p === 'wallL') s += '<g class="prop"><rect x="48" y="30" width="10" height="120" rx="3"/></g>';
      if (p === 'rail') s += '<g class="prop"><rect x="22" y="138" width="150" height="5" rx="2.5"/><rect x="147" y="120" width="6" height="24" rx="3"/><rect x="44" y="130" width="72" height="7" rx="3.5"/><circle cx="160" cy="128" r="10"/></g>';
    }
    return s;
  }
  function figure(def, u, name, bare) {
    const q = mix(def.a, def.b, u);
    const H = new Set(bare ? [] : def.hi || []);
    const C = (part, far) => (H.has(part) ? (far ? 'mf' : 'mn') : (far ? 'bf' : 'bn'));
    const feet = def.feet !== false;
    const foot = (a, t, far) => {
      if (!a) return '';
      const end = t || (!feet ? null : q.front ? [a[0] + (a[0] >= 100 ? 7 : -7), a[1] + 0.5] : [a[0] + 11, a[1] + 0.5]);
      return end ? limb(a, end, 8, 6, C('foot', far)) : dot(a, 4, C('foot', far));
    };
    let s = bare ? '' : props(def.props, name);
    s += limb(q.h2, q.k2, 17, 12, C('th', 1)) + limb(q.k2, q.a2, 12, 8, C('shin', 1)) + foot(q.a2, q.t2 || (q.t1 && [q.t1[0] - 4, q.t1[1]]), 1);
    s += limb(q.s2, q.e2, 12, 9.5, C('ua', 1)) + limb(q.e2, q.w2, 9.5, 7, C('fa', 1)) + dot(q.w2, 4.6, 'bf');
    if (def.w === 'both' && !bare) s += dumbbell(q.w2, false);
    if (q.front) {
      const s1 = q.s1, s2 = q.s2, h1 = q.h1, h2 = q.h2;
      s += `<path class="${C('torso')}" d="M${f(s1[0] + 3)} ${f(s1[1] - 4)} Q${f((s1[0] + s2[0]) / 2)} ${f(s1[1] - 9)} ${f(s2[0] - 3)} ${f(s2[1] - 4)} Q${f(s2[0] - 9)} ${f(s2[1] + 10)} ${f(h2[0] - 3)} ${f(h2[1] + 4)} L${f(h1[0] + 3)} ${f(h1[1] + 4)} Q${f(s1[0] + 9)} ${f(s1[1] + 10)} ${f(s1[0] + 3)} ${f(s1[1] - 4)} Z"/>`;
    } else {
      s += limb(q.nk, q.pv, 26, 21, C('torso'));
    }
    if (H.has('glute')) s += dot([q.pv[0] - (q.front ? 0 : 5), q.pv[1]], 10, 'mn');
    s += limb(mid(q.hd, q.nk, 0.35), q.nk, 8, 10, 'bn');
    s += dot(q.hd, 11.5, 'bn head');
    s += limb(q.h1, q.k1, 17, 12, C('th')) + limb(q.k1, q.a1, 12, 8, C('shin')) + foot(q.a1, q.t1, 0);
    if (def.w === 'hip' && !bare) s += dumbbell([q.pv[0], q.pv[1] - 10], false);
    if (H.has('delt')) { s += dot(q.s1, 8.5, 'mn'); if (q.front) s += dot(q.s2, 8.5, 'mn'); }
    s += limb(q.s1, q.e1, 12, 9.5, C('ua')) + limb(q.e1, q.w1, 9.5, 7, C('fa')) + dot(q.w1, 4.6, 'bn');
    if (!bare) {
      if (def.w === 'both' || def.w === 'w1') s += dumbbell(q.w1, false);
      if (def.w === 'chest') s += dumbbell(q.w1, true);
      if (def.w === 'handle') s += `<rect class="dbh" x="${f(q.w1[0] - 2.5)}" y="${f(q.w1[1] - 9)}" width="5" height="18" rx="2.5"/>`;
    }
    return s;
  }
  // Rythme réel de la série : aller, pause, retour, pause
  const ease = (x) => x * x * (3 - 2 * x);
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function timeline(def) {
    if (def.hold) return { period: 3200 };
    const t = def.t || [1200, 1200], h = def.h || [350, 350];
    return { t, h, period: h[0] + t[0] + h[1] + t[1] };
  }
  function at(def, ms) {
    const tl = timeline(def);
    if (def.hold) { const x = (ms % tl.period) / tl.period; return { u: (1 - Math.cos(x * Math.PI * 2)) / 2, k: 0, p: x, label: def.c ? def.c[0] : 'Tiens' }; }
    let x = ms % tl.period; const [h0, h1] = tl.h, [t0, t1] = tl.t;
    if (x < h0) return { u: 0, k: 1, p: 1, label: def.c[1], hold: true };
    x -= h0; if (x < t0) return { u: easeIO(x / t0), k: 0, p: x / t0, label: def.c[0], sec: t0 };
    x -= t0; if (x < h1) return { u: 1, k: 0, p: 1, label: def.hc || def.c[0], hold: true };
    x -= h1; return { u: 1 - easeIO(x / t1), k: 1, p: x / t1, label: def.c[1], sec: t1 };
  }
  function frame(el, def, name, ms) {
    const st = at(def, ms);
    let s = '';
    const cue = el.dataset.cue;
    if (cue && !def.hold) s += `<g class="ghost">${figure(def, st.k === 0 ? 1 : 0, name, true)}</g>`;
    s += figure(def, st.u, name);
    if (cue) {
      const vb = el.viewBox.baseVal, fs = vb.width * 0.062, x = vb.x + vb.width * 0.05, y = vb.y + vb.height * 0.11;
      const secs = st.sec ? Math.round(st.sec / 100) / 10 : 0;
      const txt = st.label + (secs >= 1.5 && !st.hold ? ` · ${String(secs).replace('.', ',')} s` : '');
      s += `<text class="cue" x="${f(x)}" y="${f(y)}" font-size="${f(fs)}">${txt}</text>`;
      if (!def.hold) s += `<rect class="cue-trk" x="${f(x)}" y="${f(y + fs * 0.5)}" width="${f(vb.width * 0.26)}" height="${f(fs * 0.22)}" rx="${f(fs * 0.11)}"/><rect class="cue-bar" x="${f(x)}" y="${f(y + fs * 0.5)}" width="${f(vb.width * 0.26 * (st.hold ? 1 : st.p))}" height="${f(fs * 0.22)}" rx="${f(fs * 0.11)}"/>`;
    }
    el.innerHTML = s;
  }
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  const live = new Set();
  let raf = 0;
  function tick(t) {
    raf = 0;
    for (const el of live) {
      if (!el.isConnected) { live.delete(el); continue; }
      const name = el.dataset.anim, def = A[name];
      if (!def || el.dataset.still) continue;
      frame(el, def, name, t);
    }
    if (live.size) raf = requestAnimationFrame(tick);
  }
  function mount(root) {
    (root || document).querySelectorAll('svg[data-anim]').forEach((el) => {
      const name = el.dataset.anim, def = A[name]; if (!def) return;
      if (el.dataset.still) { el.innerHTML = figure(def, def.hold ? 0 : 1, name); return; }
      frame(el, def, name, def.hold ? 0 : timeline(def).h[0] + timeline(def).t[0] * 0.6);
      if (!reduce) live.add(el);
    });
    if (live.size && !raf) raf = requestAnimationFrame(tick);
  }
  const svg = (name, cls = '', still, cue) => {
    if (!A[name]) name = 'pushup';
    const vb = still ? viewBox(name, 8, 96) : viewBox(name, cue ? 22 : 14, 120);
    if (cue) { vb[1] -= vb[3] * 0.12; vb[3] *= 1.12; vb[0] -= (vb[3] * 1.25 - vb[2]) / 2; vb[2] = vb[3] * 1.25; }
    return `<svg class="anim ${cls}" viewBox="${vb.map(f).join(' ')}" data-anim="${name}" ${still ? 'data-still="1"' : ''} ${cue ? 'data-cue="1"' : ''} role="img" aria-label="Illustration du mouvement"></svg>`;
  };
  // Schéma des muscles, de face et de dos
  function bodyMap(mus) {
    const M = new Set(mus || []);
    const k = (id) => (M.has(id) ? 'm-on' : 'm-off');
    const fig = (x, back) => {
      const X = (n) => x + n;
      let s = `<circle class="m-base" cx="${X(40)}" cy="14" r="10"/>`;
      s += `<rect class="m-base" x="${X(36)}" y="22" width="8" height="8" rx="3"/>`;
      // bras
      s += `<rect class="${back ? k('triceps') : k('biceps')}" x="${X(10)}" y="40" width="10" height="34" rx="5"/><rect class="${back ? k('triceps') : k('biceps')}" x="${X(60)}" y="40" width="10" height="34" rx="5"/>`;
      s += `<rect class="m-base" x="${X(8)}" y="76" width="9" height="32" rx="4.5"/><rect class="m-base" x="${X(63)}" y="76" width="9" height="32" rx="4.5"/>`;
      s += `<circle class="${k('delts')}" cx="${X(17)}" cy="38" r="9"/><circle class="${k('delts')}" cx="${X(63)}" cy="38" r="9"/>`;
      if (!back) {
        s += `<rect class="${k('pecs')}" x="${X(23)}" y="31" width="16" height="20" rx="6"/><rect class="${k('pecs')}" x="${X(41)}" y="31" width="16" height="20" rx="6"/>`;
        s += `<rect class="${k('abs')}" x="${X(30)}" y="54" width="20" height="34" rx="6"/>`;
        s += `<rect class="${k('obliques')}" x="${X(23)}" y="54" width="6" height="32" rx="3"/><rect class="${k('obliques')}" x="${X(51)}" y="54" width="6" height="32" rx="3"/>`;
        s += `<rect class="${k('quads')}" x="${X(23)}" y="94" width="15" height="44" rx="7"/><rect class="${k('quads')}" x="${X(42)}" y="94" width="15" height="44" rx="7"/>`;
        s += `<rect class="m-base" x="${X(25)}" y="142" width="11" height="34" rx="5.5"/><rect class="m-base" x="${X(44)}" y="142" width="11" height="34" rx="5.5"/>`;
      } else {
        s += `<rect class="${k('upper')}" x="${X(25)}" y="30" width="30" height="16" rx="6"/>`;
        s += `<path class="${k('lats')}" d="M${X(23)} 48 L${X(39)} 48 L${X(37)} 74 L${X(28)} 70 Z"/><path class="${k('lats')}" d="M${X(41)} 48 L${X(57)} 48 L${X(52)} 70 L${X(43)} 74 Z"/>`;
        s += `<rect class="${k('lower')}" x="${X(31)}" y="74" width="18" height="14" rx="5"/>`;
        s += `<rect class="${k('glutes')}" x="${X(23)}" y="90" width="16" height="18" rx="7"/><rect class="${k('glutes')}" x="${X(41)}" y="90" width="16" height="18" rx="7"/>`;
        s += `<rect class="${k('hams')}" x="${X(23)}" y="110" width="15" height="30" rx="7"/><rect class="${k('hams')}" x="${X(42)}" y="110" width="15" height="30" rx="7"/>`;
        s += `<rect class="${k('calves')}" x="${X(25)}" y="142" width="11" height="34" rx="5.5"/><rect class="${k('calves')}" x="${X(44)}" y="142" width="11" height="34" rx="5.5"/>`;
      }
      return s;
    };
    return `<svg class="bodymap" viewBox="0 0 200 184" role="img" aria-label="Muscles travaillés">${fig(10, false)}${fig(110, true)}<text x="50" y="183" text-anchor="middle">Face</text><text x="150" y="183" text-anchor="middle">Dos</text></svg>`;
  }

  return { mount, svg, bodyMap, has: (n) => !!A[n] };
})();
