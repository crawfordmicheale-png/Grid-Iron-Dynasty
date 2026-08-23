// Formations and personnel groupings.
//
// Personnel is named the way coaches name it: first digit is running backs,
// second is tight ends, and receivers make up the difference to five.
// A formation declares which receiver slots exist, where they line up (for the
// field render and for leverage), how many blockers stay in, and how strong it
// is at each run gap.
//
// Gaps run A (either side of the center) out through D (outside the tight end).

export const PERSONNEL = {
  '10': { key: '10', name: '10 Personnel', rb: 1, te: 0, wr: 4, tag: 'spread' },
  '11': { key: '11', name: '11 Personnel', rb: 1, te: 1, wr: 3, tag: 'base' },
  '12': { key: '12', name: '12 Personnel', rb: 1, te: 2, wr: 2, tag: 'balanced' },
  '13': { key: '13', name: '13 Personnel', rb: 1, te: 3, wr: 1, tag: 'heavy' },
  '20': { key: '20', name: '20 Personnel', rb: 2, te: 0, wr: 3, tag: 'spread' },
  '21': { key: '21', name: '21 Personnel', rb: 2, te: 1, wr: 2, tag: 'balanced' },
  '22': { key: '22', name: '22 Personnel', rb: 2, te: 2, wr: 1, tag: 'heavy' },
  '00': { key: '00', name: 'Empty', rb: 0, te: 0, wr: 5, tag: 'empty' },
  '01': { key: '01', name: '01 Personnel', rb: 0, te: 1, wr: 4, tag: 'empty' },
  '23': { key: '23', name: 'Goal Line', rb: 2, te: 3, wr: 0, tag: 'goalline' },
};

// A slot is a job, not a position: SLOT can be filled by a receiver or a tight
// end depending on the personnel grouping.
// side: L/R relative to the center. width: yards outside the ball.
// los: true if he is on the line of scrimmage. depth: yards behind it.
const s = (side, width, opts = {}) => ({ side, width, los: opts.los ?? true, depth: opts.depth ?? 0, ...opts });

function form(key, name, cfg) {
  return {
    key, name,
    passPro: cfg.passPro ?? 5,
    paMult: cfg.paMult ?? 1.0,
    tempoMult: cfg.tempoMult ?? 1.0,
    ...cfg,
  };
}

export const FORMATIONS = {
  // --- 11 personnel ---
  gunTrips: form('gunTrips', 'Gun Trips Right', {
    personnel: '11', shotgun: true, passPro: 5, paMult: 0.85,
    slots: { X: s('L', 24), Z: s('R', 22, { los: false }), SLOT: s('R', 14, { los: false }), TE: s('R', 8), RB: s('L', 3, { los: false, depth: 6 }) },
    gaps: { A: 1.0, B: 1.0, C: 0.85, D: 0.7 }, strongSide: 'R',
    tags: ['spread', 'pass'],
  }),
  gunSpread: form('gunSpread', 'Gun Spread', {
    personnel: '11', shotgun: true, passPro: 5, paMult: 0.8,
    slots: { X: s('L', 24), Z: s('R', 24, { los: false }), SLOT: s('L', 13, { los: false }), TE: s('R', 9), RB: s('R', 3, { los: false, depth: 6 }) },
    gaps: { A: 1.0, B: 1.05, C: 0.9, D: 0.75 }, strongSide: 'R',
    tags: ['spread', 'balanced'],
  }),
  gunBunch: form('gunBunch', 'Gun Bunch', {
    personnel: '11', shotgun: true, passPro: 5, paMult: 0.8,
    slots: { X: s('L', 24), Z: s('R', 15, { los: false }), SLOT: s('R', 12, { los: false }), TE: s('R', 10), RB: s('L', 3, { los: false, depth: 6 }) },
    gaps: { A: 1.0, B: 0.95, C: 0.9, D: 0.8 }, strongSide: 'R', bunch: true,
    tags: ['spread', 'pass', 'rub'],
  }),
  aceSlot: form('aceSlot', 'Singleback Slot', {
    personnel: '11', shotgun: false, passPro: 6, paMult: 1.15,
    slots: { X: s('L', 24), Z: s('R', 23, { los: false }), SLOT: s('L', 13, { los: false }), TE: s('R', 8), RB: s('C', 0, { los: false, depth: 7 }) },
    gaps: { A: 1.1, B: 1.1, C: 1.0, D: 0.85 }, strongSide: 'R',
    tags: ['balanced'],
  }),
  gunYOff: form('gunYOff', 'Gun Y-Off', {
    personnel: '11', shotgun: true, passPro: 6, paMult: 1.05,
    slots: { X: s('L', 24), Z: s('R', 23, { los: false }), SLOT: s('R', 13, { los: false }), TE: s('L', 5, { los: false, depth: 1 }), RB: s('R', 3, { los: false, depth: 6 }) },
    gaps: { A: 1.05, B: 1.05, C: 0.95, D: 0.9 }, strongSide: 'L',
    tags: ['balanced', 'motion'],
  }),

  // --- 12 personnel ---
  aceBig: form('aceBig', 'Singleback Big', {
    personnel: '12', shotgun: false, passPro: 7, paMult: 1.25,
    slots: { X: s('L', 24), Z: s('R', 23, { los: false }), TE: s('R', 8), TE2: s('L', 8), RB: s('C', 0, { los: false, depth: 7 }) },
    gaps: { A: 1.15, B: 1.2, C: 1.15, D: 1.0 }, strongSide: 'R',
    tags: ['balanced', 'run'],
  }),
  gunDoubleTE: form('gunDoubleTE', 'Gun Double Tight', {
    personnel: '12', shotgun: true, passPro: 6, paMult: 1.1,
    slots: { X: s('L', 24), Z: s('R', 22, { los: false }), TE: s('R', 8), TE2: s('R', 12, { los: false }), RB: s('L', 3, { los: false, depth: 6 }) },
    gaps: { A: 1.05, B: 1.1, C: 1.1, D: 0.95 }, strongSide: 'R',
    tags: ['balanced'],
  }),

  // --- 21 personnel ---
  iForm: form('iForm', 'I-Form Pro', {
    personnel: '21', shotgun: false, passPro: 7, paMult: 1.35,
    slots: { X: s('L', 24), Z: s('R', 23, { los: false }), TE: s('R', 8), FB: s('C', 0, { los: false, depth: 4 }), RB: s('C', 0, { los: false, depth: 7 }) },
    gaps: { A: 1.2, B: 1.25, C: 1.15, D: 1.0 }, strongSide: 'R',
    tags: ['run', 'power'],
  }),
  strongI: form('strongI', 'Strong I', {
    personnel: '21', shotgun: false, passPro: 7, paMult: 1.3,
    slots: { X: s('L', 24), Z: s('R', 22, { los: false }), TE: s('R', 8), FB: s('R', 3, { los: false, depth: 4 }), RB: s('C', 0, { los: false, depth: 7 }) },
    gaps: { A: 1.15, B: 1.2, C: 1.3, D: 1.15 }, strongSide: 'R',
    tags: ['run', 'power'],
  }),
  gunSplit: form('gunSplit', 'Gun Split Backs', {
    personnel: '21', shotgun: true, passPro: 7, paMult: 1.0,
    slots: { X: s('L', 24), Z: s('R', 23, { los: false }), TE: s('R', 8), FB: s('L', 4, { los: false, depth: 6 }), RB: s('R', 4, { los: false, depth: 6 }) },
    gaps: { A: 1.05, B: 1.05, C: 1.0, D: 0.95 }, strongSide: 'R',
    tags: ['balanced', 'protect'],
  }),

  // --- 22 / goal line ---
  fullHouse: form('fullHouse', 'Full House', {
    personnel: '22', shotgun: false, passPro: 8, paMult: 1.4,
    slots: { X: s('L', 22), TE: s('R', 8), TE2: s('L', 8), FB: s('C', 0, { los: false, depth: 4 }), RB: s('C', 0, { los: false, depth: 7 }) },
    gaps: { A: 1.3, B: 1.3, C: 1.25, D: 1.15 }, strongSide: 'R',
    tags: ['heavy', 'run'],
  }),
  goalLine: form('goalLine', 'Goal Line', {
    personnel: '23', shotgun: false, passPro: 9, paMult: 1.5,
    slots: { TE: s('R', 6), TE2: s('L', 6), TE3: s('R', 10), FB: s('C', 0, { los: false, depth: 3 }), RB: s('C', 0, { los: false, depth: 5 }) },
    gaps: { A: 1.45, B: 1.35, C: 1.25, D: 1.1 }, strongSide: 'R', goalLine: true,
    tags: ['goalline', 'heavy', 'run'],
  }),

  aceTwins: form('aceTwins', 'Singleback Twins Y-Flex', {
    personnel: '12', shotgun: false, passPro: 6, paMult: 1.2,
    slots: { X: s('L', 24), Z: s('L', 15, { los: false }), TE: s('R', 8), TE2: s('R', 13, { los: false }), RB: s('C', 0, { los: false, depth: 7 }) },
    gaps: { A: 1.1, B: 1.15, C: 1.1, D: 0.95 }, strongSide: 'R',
    tags: ['balanced', 'run'],
  }),

  // --- 20 personnel ---
  gunPro: form('gunPro', 'Gun Pro', {
    personnel: '20', shotgun: true, passPro: 7, paMult: 1.05,
    slots: { X: s('L', 24), Z: s('R', 23, { los: false }), SLOT: s('R', 13, { los: false }), FB: s('L', 4, { los: false, depth: 6 }), RB: s('R', 4, { los: false, depth: 6 }) },
    gaps: { A: 1.05, B: 1.0, C: 0.9, D: 0.85 }, strongSide: 'R',
    tags: ['balanced', 'protect'],
  }),

  // --- 10 / empty ---
  gunFourWide: form('gunFourWide', 'Gun 4-Wide', {
    personnel: '10', shotgun: true, passPro: 5, paMult: 0.7, tempoMult: 1.15,
    slots: { X: s('L', 25), Z: s('R', 25, { los: false }), SLOT: s('L', 14, { los: false }), SLOT2: s('R', 14, { los: false }), RB: s('R', 3, { los: false, depth: 6 }) },
    gaps: { A: 0.95, B: 0.95, C: 0.75, D: 0.6 }, strongSide: 'R',
    tags: ['spread', 'pass', 'tempo'],
  }),
  gunTrey: form('gunTrey', 'Gun Trey', {
    personnel: '10', shotgun: true, passPro: 5, paMult: 0.72, tempoMult: 1.15,
    slots: { X: s('L', 25), Z: s('R', 24, { los: false }), SLOT: s('R', 17, { los: false }), SLOT2: s('R', 11, { los: false }), RB: s('L', 3, { los: false, depth: 6 }) },
    gaps: { A: 0.95, B: 0.9, C: 0.7, D: 0.6 }, strongSide: 'R',
    tags: ['spread', 'pass', 'tempo'],
  }),
  gunDoubles: form('gunDoubles', 'Gun Doubles', {
    personnel: '10', shotgun: true, passPro: 5, paMult: 0.75, tempoMult: 1.12,
    slots: { X: s('L', 25), Z: s('R', 25, { los: false }), SLOT: s('L', 15, { los: false }), SLOT2: s('R', 15, { los: false }), RB: s('L', 3, { los: false, depth: 6 }) },
    gaps: { A: 0.95, B: 0.95, C: 0.75, D: 0.62 }, strongSide: 'R',
    tags: ['spread', 'pass', 'tempo'],
  }),
  gunEmpty: form('gunEmpty', 'Gun Empty', {
    personnel: '00', shotgun: true, passPro: 5, paMult: 0.5, tempoMult: 1.2,
    slots: { X: s('L', 26), Z: s('R', 26, { los: false }), SLOT: s('L', 16, { los: false }), SLOT2: s('R', 16, { los: false }), SLOT3: s('R', 10, { los: false }) },
    gaps: { A: 0.85, B: 0.8, C: 0.6, D: 0.5 }, strongSide: 'R', empty: true,
    tags: ['empty', 'pass', 'tempo'],
  }),
  emptyBunch: form('emptyBunch', 'Empty Bunch', {
    personnel: '01', shotgun: true, passPro: 5, paMult: 0.5, tempoMult: 1.1,
    slots: { X: s('L', 26), Z: s('R', 14, { los: false }), SLOT: s('R', 11, { los: false }), SLOT2: s('L', 15, { los: false }), TE: s('R', 9) },
    gaps: { A: 0.85, B: 0.8, C: 0.65, D: 0.55 }, strongSide: 'R', empty: true, bunch: true,
    tags: ['empty', 'pass', 'rub'],
  }),
  emptyTrey: form('emptyTrey', 'Empty Trey', {
    personnel: '00', shotgun: true, passPro: 5, paMult: 0.5, tempoMult: 1.18,
    slots: { X: s('L', 26), Z: s('R', 25, { los: false }), SLOT: s('R', 18, { los: false }), SLOT2: s('R', 12, { los: false }), SLOT3: s('L', 15, { los: false }) },
    gaps: { A: 0.85, B: 0.8, C: 0.6, D: 0.5 }, strongSide: 'R', empty: true,
    tags: ['empty', 'pass', 'tempo'],
  }),
};

export const FORMATION_KEYS = Object.keys(FORMATIONS);

// The receiving slots a formation actually has, in a stable order.
export const SLOT_ORDER = ['X', 'Z', 'SLOT', 'SLOT2', 'SLOT3', 'TE', 'TE2', 'TE3', 'RB', 'FB'];

export function formationSlots(formation) {
  return SLOT_ORDER.filter((k) => formation.slots[k]);
}

export function eligibleReceivers(formation) {
  return formationSlots(formation);
}

// Which roster position fills each slot, given the personnel grouping.
export const SLOT_POSITION = {
  X: 'WR', Z: 'WR', SLOT: 'WR', SLOT2: 'WR', SLOT3: 'WR',
  TE: 'TE', TE2: 'TE', TE3: 'TE', RB: 'RB', FB: 'FB',
};

export function formationsForPersonnel(personnelKey) {
  return FORMATION_KEYS.filter((k) => FORMATIONS[k].personnel === personnelKey);
}

export function formationsWithTag(tag) {
  return FORMATION_KEYS.filter((k) => FORMATIONS[k].tags.includes(tag));
}
