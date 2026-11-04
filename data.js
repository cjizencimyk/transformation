// Programme Transformation : exercices, séances, poids de départ.
// kind : pair (2 haltères), single (1 haltère), level (poids du corps par niveaux), time (secondes), cardio (minutes)
window.FORGE_DATA = (function () {
  const EX = {
    pompes: { name: 'Pompes', muscle: 'Pecs, triceps', kind: 'level', sets: 4, min: 8, max: 20, amrap: true,
      levels: ['Mains sur le lit', 'Au sol', 'Pieds sur le lit', 'Pompes diamant', 'Pompes archer'],
      anim: 'pushup', cue: 'Corps gainé de la tête aux pieds. La poitrine frôle le sol, puis tu pousses fort.' },
    row1: { name: 'Rowing un bras', muscle: 'Dos', kind: 'single', uni: true, sets: 4, min: 8, max: 15, amrap: true,
      anim: 'row1', cue: 'Une main sur la chaise. Tire le coude vers la hanche, pas vers le plafond.' },
    floorpress: { name: 'Développé couché au sol', muscle: 'Pecs, triceps', kind: 'pair', sets: 4, min: 10, max: 20, amrap: true,
      anim: 'floorpress', cue: 'Coudes à 45° du corps. Ils touchent le sol, puis tu pousses.' },
    lateral: { name: 'Élévations latérales', muscle: 'Épaules', kind: 'pair', sets: 4, min: 12, max: 25,
      anim: 'lateral', cue: 'Léger. Monte jusqu’à la hauteur des épaules, pas plus haut.' },
    ohp: { name: 'Développé épaules assis', muscle: 'Épaules, triceps', kind: 'pair', sets: 4, min: 8, max: 15, amrap: true,
      anim: 'ohp', cue: 'Dos contre le dossier de la chaise, ne cambre pas.' },
    dips: { name: 'Dips sur chaise', muscle: 'Triceps, pecs', kind: 'level', sets: 3, min: 8, max: 20,
      levels: ['Genoux pliés', 'Jambes tendues', 'Pieds surélevés', 'Pieds surélevés, sac à dos lesté'],
      anim: 'dips', cue: 'Mains au bord de la chaise. Ne descends pas plus bas que les coudes à 90°.' },
    triceps: { name: 'Extensions triceps', long: 'Extensions triceps au-dessus de la tête', muscle: 'Triceps', kind: 'single', sets: 3, min: 10, max: 20,
      anim: 'triceps', cue: 'Un haltère tenu à deux mains. Les coudes restent pointés vers le plafond.' },
    lunge: { name: 'Fentes arrière', muscle: 'Cuisses, fessiers', kind: 'pair', bw: true, uni: true, sets: 4, min: 8, max: 15, amrap: true,
      anim: 'lunge', cue: 'Le genou arrière frôle le sol. C’est l’exercice principal : mets le plus lourd ici.' },
    plank: { name: 'Planche', muscle: 'Abdos', kind: 'time', sets: 3, min: 40, max: 90, step: 5,
      anim: 'plank', cue: 'Corps droit, hanches ni trop hautes ni trop basses. Respire.' },
    rdl: { name: 'Soulevé de terre jambes tendues', muscle: 'Ischios, fessiers', kind: 'pair', sets: 4, min: 10, max: 20, amrap: true,
      anim: 'rdl', cue: 'Genoux légèrement fléchis, dos plat. Recule les fesses. Descente en 3 s.' },
    goblet: { name: 'Goblet squat', muscle: 'Cuisses', kind: 'single', sets: 4, min: 10, max: 20, amrap: true,
      anim: 'goblet', cue: 'Haltère contre la poitrine. Descends sous la parallèle, talons au sol.' },
    bridge: { name: 'Pont fessier', muscle: 'Fessiers', kind: 'single', sets: 3, min: 12, max: 25,
      anim: 'bridge', cue: 'Haltère posé sur les hanches. Serre les fessiers 2 s en haut.' },
    rower: { name: 'Rameur', muscle: 'Cardio', kind: 'cardio', sets: 1, minutes: 10,
      anim: 'rower', cue: 'Rythme tranquille : tu dois pouvoir parler en ramant.' },
    pullup: { name: 'Tractions assistées', muscle: 'Dos, biceps', kind: 'level', sets: 4, min: 5, max: 10, amrap: true,
      levels: ['Élastique sous le pied', 'Élastique sous le genou', 'Sans élastique', 'Lestées, sac à dos'],
      anim: 'pullup', cue: 'Élastique accroché à la barre, sous le pied (plus d’aide) ou le genou. Après la dernière série : 3 négatives, tu montes avec une chaise et tu descends en 5 s.' },
    bentrow: { name: 'Rowing buste penché', muscle: 'Dos', kind: 'pair', sets: 4, min: 10, max: 20, amrap: true,
      anim: 'bentrow', cue: 'Buste à 45°, dos plat. Tire vers le nombril, descente en 3 s.' },
    reardelt: { name: 'Oiseau', muscle: 'Arrière d’épaule', kind: 'pair', sets: 3, min: 12, max: 25,
      anim: 'reardelt', cue: 'Léger. Buste penché, les bras s’ouvrent comme des ailes.' },
    curl: { name: 'Curl biceps', muscle: 'Biceps', kind: 'pair', sets: 3, min: 10, max: 20,
      anim: 'curl', cue: 'Coudes collés au corps, descente lente.' },
    hammer: { name: 'Curl marteau', muscle: 'Biceps, avant-bras', kind: 'pair', sets: 3, min: 10, max: 20,
      anim: 'curl', cue: 'Pouces vers le haut, comme si tu tenais un marteau.' },
    bulgarian: { name: 'Squat bulgare', muscle: 'Cuisses, fessiers', kind: 'pair', bw: true, uni: true, sets: 4, min: 8, max: 15, amrap: true,
      anim: 'bulgarian', cue: 'Pied arrière posé sur la chaise. Sans poids au début, puis haltères en main.' },
    sideplank: { name: 'Gainage latéral', muscle: 'Obliques', kind: 'time', uni: true, sets: 3, min: 30, max: 60, step: 5,
      anim: 'sideplank', cue: 'Coude sous l’épaule, corps aligné, hanches hautes.' },
    slrdl: { name: 'Soulevé de terre sur une jambe', muscle: 'Ischios, fessiers', kind: 'single', uni: true, sets: 3, min: 8, max: 15,
      anim: 'slrdl', cue: 'Main libre contre un mur pour l’équilibre. Dos plat, la jambe arrière monte.' },
    calf: { name: 'Mollets sur une marche', muscle: 'Mollets', kind: 'single', sets: 4, min: 15, max: 30,
      anim: 'calf', cue: 'Talon sous la marche, monte le plus haut possible, 1 s en haut.' },
    hipthrust: { name: 'Hip thrust', muscle: 'Fessiers', kind: 'single', sets: 4, min: 10, max: 20, amrap: true,
      anim: 'hipthrust', cue: 'Épaules sur le lit ou le canapé, haltère sur les hanches. Monte jusqu’à l’horizontale.' },
    warm: { name: 'Échauffement', long: 'Échauffement au rameur', muscle: 'Tout le corps', kind: 'cardio', sets: 1, minutes: 5,
      anim: 'rower', cue: '4 min de rameur facile, puis 10 rotations d\u2019épaules et 10 squats sans poids.' },
    rowint: { name: 'Rameur fractionné', muscle: 'Cardio, dos, jambes', kind: 'interval', sets: 1, rounds: 10, work: 40, rest: 20,
      anim: 'rower', cue: 'Effort : tire fort, comme un sprint. Récup : rame tout doucement sans t\u2019arrêter. Tu dois finir rincé.' },
    mountain: { name: 'Mountain climbers', muscle: 'Abdos, cardio', kind: 'time', sets: 3, min: 30, max: 60, step: 5,
      anim: 'mountain', cue: 'En position de pompe, ramène les genoux vers la poitrine l\u2019un après l\u2019autre, vite.' },
    wallsit: { name: 'Chaise contre le mur', muscle: 'Cuisses', kind: 'time', sets: 3, min: 45, max: 120, step: 5,
      anim: 'wallsit', cue: 'Dos au mur, cuisses parallèles au sol. Tiens jusqu\u2019à ce que ça brûle, puis encore 5 s.' },
    squat: { name: 'Squats enchaînés', muscle: 'Cuisses, fessiers, cardio', kind: 'level', sets: 3, min: 15, max: 30,
      levels: ['Squat au poids du corps', 'Squat sauté'], anim: 'squat', cue: 'Le plus vite possible en gardant une bonne technique. Talons au sol en bas.' },
  };


  // Fiches exercice : muscles (pour le schéma), consignes, erreurs fréquentes
  const INFO = {
    pompes: { mus: ['pecs', 'triceps', 'delts'], tips: ['Mains un peu plus larges que les épaules', 'Corps gainé, fesses serrées', 'Poitrine qui frôle le sol, puis pousse fort'], errs: ['Hanches qui tombent', 'Coudes ouverts à 90°'] },
    row1: { mus: ['lats', 'upper', 'biceps'], tips: ['Main et genou en appui sur la chaise', 'Dos plat, regard vers le sol', 'Tire le coude vers la hanche'], errs: ['Tourner le buste pour tricher', 'Tirer avec la main au lieu du coude'] },
    floorpress: { mus: ['pecs', 'triceps'], tips: ['Allongé, genoux pliés, pieds au sol', 'Coudes à 45° du corps', 'Les coudes touchent le sol, puis pousse'], errs: ['Rebondir sur le sol', 'Coudes collés à la tête'] },
    lateral: { mus: ['delts'], tips: ['Bras légèrement fléchis', 'Monte jusqu’à la hauteur des épaules', 'Descente lente, 2 s'], errs: ['Prendre de l’élan avec le dos', 'Hausser les épaules'] },
    ohp: { mus: ['delts', 'triceps'], tips: ['Assis, dos contre le dossier', 'Haltères à hauteur d’oreilles', 'Pousse vers le plafond sans bloquer les coudes'], errs: ['Cambrer le bas du dos', 'Descendre trop bas trop vite'] },
    dips: { mus: ['triceps', 'pecs'], tips: ['Mains au bord d’une chaise stable', 'Dos près de la chaise', 'Descends jusqu’aux coudes à 90°'], errs: ['Descendre trop bas', 'Épaules qui remontent vers les oreilles'] },
    triceps: { mus: ['triceps'], tips: ['Un haltère tenu à deux mains', 'Coudes pointés vers le plafond', 'Seuls les avant-bras bougent'], errs: ['Coudes qui s’écartent', 'Cambrer le dos'] },
    lunge: { mus: ['quads', 'glutes'], tips: ['Grand pas en arrière', 'Le genou arrière frôle le sol', 'Pousse sur le talon avant pour remonter'], errs: ['Genou avant qui rentre vers l’intérieur', 'Buste penché en avant'] },
    plank: { mus: ['abs'], tips: ['Coudes sous les épaules', 'Corps droit de la tête aux talons', 'Respire normalement'], errs: ['Fesses en l’air', 'Bas du dos creusé'] },
    rdl: { mus: ['hams', 'glutes', 'lower'], tips: ['Genoux légèrement fléchis', 'Recule les fesses, dos plat', 'Haltères qui frôlent les cuisses'], errs: ['Dos rond', 'Plier les genoux comme un squat'] },
    goblet: { mus: ['quads', 'glutes'], tips: ['Haltère contre la poitrine', 'Pieds largeur d’épaules', 'Descends sous la parallèle, talons au sol'], errs: ['Talons qui décollent', 'Genoux qui rentrent'] },
    bridge: { mus: ['glutes', 'hams'], tips: ['Allongé, pieds près des fesses', 'Haltère posé sur les hanches', 'Serre les fessiers 2 s en haut'], errs: ['Cambrer au lieu de pousser avec les fessiers', 'Pieds trop loin'] },
    rower: { mus: ['lats', 'quads', 'hams'], tips: ['Pousse d’abord avec les jambes', 'Puis recule le buste, puis tire les bras', 'Rythme où tu peux parler'], errs: ['Tirer avec les bras en premier', 'Dos rond'] },
    pullup: { mus: ['lats', 'biceps', 'upper'], tips: ['Un genou dans l’élastique', 'Tire les coudes vers les côtes', 'Menton au-dessus de la barre'], errs: ['Se balancer', 'Descendre à moitié'] },
    bentrow: { mus: ['lats', 'upper', 'biceps'], tips: ['Buste penché à 45°, dos plat', 'Tire les haltères vers le nombril', 'Descente lente, 3 s'], errs: ['Dos rond', 'Se redresser pour tricher'] },
    reardelt: { mus: ['delts', 'upper'], tips: ['Buste penché, dos plat', 'Bras presque tendus', 'Ouvre les bras comme des ailes'], errs: ['Trop lourd', 'Remonter le buste'] },
    curl: { mus: ['biceps'], tips: ['Coudes collés au corps', 'Monte sans balancer', 'Descente lente, 2 s'], errs: ['Se balancer avec le dos', 'Coudes qui avancent'] },
    hammer: { mus: ['biceps'], tips: ['Pouces vers le haut', 'Coudes collés au corps', 'Descente contrôlée'], errs: ['Poignets cassés', 'Élan avec les épaules'] },
    bulgarian: { mus: ['quads', 'glutes'], tips: ['Pied arrière posé sur la chaise', 'Descends à la verticale', 'Pousse sur le talon avant'], errs: ['Pied avant trop près de la chaise', 'Genou avant qui rentre'] },
    sideplank: { mus: ['obliques', 'abs'], tips: ['Coude sous l’épaule', 'Corps aligné', 'Hanches hautes'], errs: ['Hanches qui tombent', 'Corps qui tourne'] },
    slrdl: { mus: ['hams', 'glutes'], tips: ['Main libre contre un mur', 'Dos plat, la jambe arrière monte', 'Genou d’appui légèrement fléchi'], errs: ['Dos rond', 'Hanche qui s’ouvre'] },
    calf: { mus: ['calves'], tips: ['Avant du pied sur la marche', 'Descends le talon sous la marche', 'Monte le plus haut possible, 1 s en haut'], errs: ['Rebondir', 'Mouvement trop court'] },
    hipthrust: { mus: ['glutes', 'hams'], tips: ['Épaules sur le lit ou le canapé', 'Haltère sur les hanches', 'Monte jusqu’à l’horizontale, serre 1 s'], errs: ['Cambrer le bas du dos', 'Pousser avec les orteils'] },
    warm: { mus: ['quads', 'lats', 'delts'], tips: ['Rythme où tu peux parler', 'Pousse avec les jambes, puis tire', 'Termine par la mobilité des épaules'], errs: ['Partir trop fort', 'Sauter l\u2019échauffement'] },
    rowint: { mus: ['lats', 'quads', 'hams', 'upper'], tips: ['Jambes, puis buste, puis bras', 'À fond pendant l\u2019effort', 'Ne t\u2019arrête jamais pendant la récup'], errs: ['Tirer seulement avec les bras', 'Dos rond en fin de mouvement'] },
    mountain: { mus: ['abs', 'quads', 'delts'], tips: ['Mains sous les épaules', 'Hanches basses', 'Genoux vers la poitrine, vite'], errs: ['Fesses en l\u2019air', 'Pieds qui ne bougent presque pas'] },
    wallsit: { mus: ['quads', 'glutes'], tips: ['Dos collé au mur', 'Genoux à 90°', 'Mains sur les cuisses, pas en appui'], errs: ['Cuisses trop hautes', 'Pousser avec les mains'] },
    squat: { mus: ['quads', 'glutes'], tips: ['Pieds largeur d\u2019épaules', 'Descends sous la parallèle', 'Remonte en poussant fort'], errs: ['Talons qui décollent', 'Dos qui s\u2019arrondit en bas'] },
  };
  for (const id in INFO) Object.assign(EX[id], INFO[id]);

  // Poids "normaux" de départ : kg par haltère (pair/single), index de niveau (level), secondes (time)
  const START = {
    pompes: 1, row1: 12, floorpress: 10, lateral: 4, ohp: 8, dips: 1, triceps: 12,
    lunge: 8, plank: 40, rdl: 10, goblet: 14, bridge: 16, rower: 10,
    pullup: 0, bentrow: 10, reardelt: 4, curl: 8, hammer: 8,
    bulgarian: 6, sideplank: 30, slrdl: 10, calf: 14, hipthrust: 18,
    warm: 5, rowint: 10, mountain: 30, wallsit: 45, squat: 1,
  };

  const SESSIONS = {
    haut_a: { name: 'Haut A', sub: 'Pecs, épaules, triceps', minutes: 60,
      blocks: [['É', ['warm']], ['A', ['pompes', 'row1']], ['B', ['floorpress', 'lateral']], ['C', ['ohp', 'reardelt']], ['D', ['dips', 'triceps'], { rest: [20, 60] }], ['F', ['rowint']]] },
    bas_a: { name: 'Bas A', sub: 'Jambes, fessiers, gainage', minutes: 60,
      blocks: [['É', ['warm']], ['A', ['lunge', 'plank']], ['B', ['rdl', 'goblet']], ['C', ['bridge', 'calf'], { rest: [20, 60] }], ['F', ['rowint']]] },
    haut_b: { name: 'Haut B', sub: 'Dos, épaules, biceps', minutes: 60,
      blocks: [['É', ['warm']], ['A', ['pullup', 'pompes']], ['B', ['bentrow', 'ohp']], ['C', ['lateral', 'reardelt'], { rest: [20, 60] }], ['D', ['curl', 'hammer'], { rest: [20, 60] }], ['F', ['squat', 'mountain'], { rest: [15, 40] }]] },
    bas_b: { name: 'Bas B', sub: 'Jambes, fessiers, gainage', minutes: 60,
      blocks: [['É', ['warm']], ['A', ['bulgarian', 'sideplank']], ['B', ['slrdl', 'squat']], ['C', ['hipthrust', 'wallsit']], ['F', ['rowint']]] },
  };
  const ORDER = ['haut_a', 'bas_a', 'haut_b', 'bas_b'];
  // getDay() : 0 = dimanche
  const DEFAULT_DAYS = { haut_a: 1, bas_a: 2, haut_b: 4, bas_b: 5 };

  return { EX, START, SESSIONS, ORDER, DEFAULT_DAYS };
})();
