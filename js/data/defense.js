// The defensive playbook: fronts, coverage shells, and pressure packages.
//
// A defensive call is three decisions stacked together -- what the front is,
// who is rushing, and what is happening behind it. The engine consumes them
// separately: the front decides the run fits and the base rush, the pressure
// decides how many extra rushers and where they come from, and the coverage
// decides what the receivers are running into.

// ---------------------------------------------------------------------------
// FRONTS
// gapStrength is how well the front defends each gap before any player ratings
// are applied. A front that is strong everywhere does not exist; the whole
// point of choosing one is deciding which gap you are willing to be light in.
// ---------------------------------------------------------------------------

export const FRONTS = {
  over: {
    key: 'over', name: '4-3 Over', dl: 4, boxBase: 6,
    desc: 'Three-technique to the strong side, shade nose to the weak. The standard four-man front.',
    gapStrength: { A: 1.05, B: 1.0, C: 0.95, D: 0.9 },
    passRush: 1.0, vsRun: 1.0, edgeSet: 1.0,
  },
  under: {
    key: 'under', name: '4-3 Under', dl: 4, boxBase: 6,
    desc: 'Front shifted away from the tight end. Strong against the weak-side run, softer at the edge.',
    gapStrength: { A: 1.1, B: 1.05, C: 0.85, D: 0.85 },
    passRush: 1.02, vsRun: 1.0, edgeSet: 0.92,
  },
  even: {
    key: 'even', name: 'Even Front', dl: 4, boxBase: 6,
    desc: 'Two three-techniques, both A gaps open. Built to get up the field, not to hold the point.',
    gapStrength: { A: 0.85, B: 1.15, C: 1.0, D: 0.95 },
    passRush: 1.08, vsRun: 0.94, edgeSet: 1.0,
  },
  bear: {
    key: 'bear', name: 'Bear Front', dl: 5, boxBase: 8,
    desc: 'Covers both guards and the center. Nobody can be doubled and nobody gets to a linebacker.',
    gapStrength: { A: 1.35, B: 1.3, C: 1.05, D: 0.8 },
    passRush: 0.95, vsRun: 1.28, edgeSet: 0.9, heavy: true,
  },
  okie: {
    key: 'okie', name: '3-4 Okie', dl: 3, boxBase: 7,
    desc: 'Three two-gapping linemen keep four linebackers clean. Pressure can come from anywhere.',
    gapStrength: { A: 1.1, B: 1.0, C: 1.05, D: 1.0 },
    passRush: 0.9, vsRun: 1.08, edgeSet: 1.08, disguise: 1.2,
  },
  nascar: {
    key: 'nascar', name: 'NASCAR', dl: 4, boxBase: 5,
    desc: 'Four best rushers on the field regardless of where they normally play. Obvious passing downs only.',
    gapStrength: { A: 0.7, B: 0.75, C: 0.8, D: 0.85 },
    passRush: 1.25, vsRun: 0.68, edgeSet: 0.8, passDownOnly: true,
  },
};

export const FRONT_KEYS = Object.keys(FRONTS);

// ---------------------------------------------------------------------------
// COVERAGES
// manRatio: 0 = pure zone, 1 = pure man. deep/underneath are body counts.
// The `vs` numbers are separation modifiers applied on top of each route's own
// coverage table, representing the shell's structural strengths.
// ---------------------------------------------------------------------------

export const COVERAGES = {
  cover0: {
    key: 'cover0', name: 'Cover 0', manRatio: 1.0, deep: 0, underneath: 5, baseRushers: 6,
    desc: 'No safety help at all. Everyone is on an island so everyone else can rush.',
    vsShort: -2, vsIntermediate: 1, vsDeep: 5, bigPlayRisk: 2.4, intBonus: -0.5,
    runSupport: 1.25, disguise: 0.5, requiresManCover: true, blitzy: true,
  },
  cover1: {
    key: 'cover1', name: 'Cover 1', manRatio: 0.85, deep: 1, underneath: 5, baseRushers: 5,
    desc: 'Man across the board with a free safety over the top and often a robber underneath.',
    vsShort: 0, vsIntermediate: 0, vsDeep: 1, bigPlayRisk: 1.35, intBonus: 0.1,
    runSupport: 1.1, disguise: 0.85, requiresManCover: true,
  },
  cover2: {
    key: 'cover2', name: 'Cover 2', manRatio: 0.1, deep: 2, underneath: 5, baseRushers: 4,
    desc: 'Two deep halves, five underneath. Corners sit on the flats and jump anything short and outside.',
    vsShort: -1, vsIntermediate: 2, vsDeep: -1, bigPlayRisk: 1.0, intBonus: 0.35,
    runSupport: 0.9, disguise: 1.0,
  },
  cover2man: {
    key: 'cover2man', name: 'Cover 2 Man', manRatio: 0.9, deep: 2, underneath: 5, baseRushers: 4,
    desc: 'Man underneath with two safeties over the top. Takes away the comeback and the out.',
    vsShort: 1, vsIntermediate: 0, vsDeep: -1, bigPlayRisk: 0.95, intBonus: 0.2,
    runSupport: 0.85, disguise: 0.9, requiresManCover: true,
  },
  cover3: {
    key: 'cover3', name: 'Cover 3', manRatio: 0.15, deep: 3, underneath: 4, baseRushers: 4,
    desc: 'Three deep thirds and four underneath. Sound against everything and elite against nothing.',
    vsShort: -2, vsIntermediate: -1, vsDeep: 2, bigPlayRisk: 0.85, intBonus: 0.15,
    runSupport: 1.05, disguise: 1.0,
  },
  cover4: {
    key: 'cover4', name: 'Cover 4 (Quarters)', manRatio: 0.35, deep: 4, underneath: 3, baseRushers: 4,
    desc: 'Four deep defenders matching vertical routes. Nothing gets behind it and everything in front of it is open.',
    vsShort: -3, vsIntermediate: -1, vsDeep: 4, bigPlayRisk: 0.55, intBonus: 0.25,
    runSupport: 1.0, disguise: 0.95,
  },
  cover6: {
    key: 'cover6', name: 'Cover 6', manRatio: 0.25, deep: 3, underneath: 4, baseRushers: 4,
    desc: 'Quarters to the field, Cover 2 to the boundary. Different answers on each side of the ball.',
    vsShort: -2, vsIntermediate: 0, vsDeep: 2, bigPlayRisk: 0.75, intBonus: 0.2,
    runSupport: 0.95, disguise: 1.1,
  },
  tampa2: {
    key: 'tampa2', name: 'Tampa 2', manRatio: 0.1, deep: 2, underneath: 5, baseRushers: 4,
    desc: 'Cover 2 with the middle linebacker carrying the deep hole. Closes the seam that beats normal Cover 2.',
    vsShort: -2, vsIntermediate: 1, vsDeep: 2, bigPlayRisk: 0.7, intBonus: 0.3,
    runSupport: 0.85, disguise: 1.0, needsRangeLB: true,
  },
};

export const COVERAGE_KEYS = Object.keys(COVERAGES);

// ---------------------------------------------------------------------------
// PRESSURE PACKAGES
// `extraRushers` is on top of the coverage's base rush. `coverageCost` is the
// separation the offense gains because bodies left coverage to rush.
// ---------------------------------------------------------------------------

export const PRESSURES = {
  none: {
    key: 'none', name: 'Four Man Rush', extraRushers: 0, from: [],
    desc: 'Rush four, cover seven. Make them earn every yard.',
    coverageCost: 0, pressureBonus: 0, freeRusherChance: 0.02, allow: COVERAGE_KEYS,
  },
  fireZone: {
    key: 'fireZone', name: 'Fire Zone', extraRushers: 1, from: ['LB', 'EDGE'],
    desc: 'Five rush, three deep, three under -- a lineman drops out so the pressure comes from an unexpected gap.',
    coverageCost: 1.4, pressureBonus: 0.16, freeRusherChance: 0.14,
    allow: ['cover3', 'cover2', 'cover6', 'tampa2'], disguise: 1.25,
  },
  doubleA: {
    key: 'doubleA', name: 'Double A Gap', extraRushers: 2, from: ['LB'],
    desc: 'Both linebackers walked up over the A gaps. The center has to be right and usually cannot be.',
    coverageCost: 2.6, pressureBonus: 0.28, freeRusherChance: 0.24,
    allow: ['cover1', 'cover0', 'cover2man', 'cover3'], interiorHeavy: true,
  },
  cornerBlitz: {
    key: 'cornerBlitz', name: 'Corner Blitz', extraRushers: 1, from: ['CB'],
    desc: 'Corner comes off the edge unblocked. Fast, and it leaves his receiver on somebody else.',
    coverageCost: 3.0, pressureBonus: 0.22, freeRusherChance: 0.30,
    allow: ['cover0', 'cover1', 'cover3'], edgeHeavy: true,
  },
  safetyBlitz: {
    key: 'safetyBlitz', name: 'Safety Blitz', extraRushers: 1, from: ['S'],
    desc: 'Safety walks down late and comes. Costs you a deep defender to do it.',
    coverageCost: 2.2, pressureBonus: 0.2, freeRusherChance: 0.22,
    allow: ['cover0', 'cover1', 'cover3'], disguise: 1.15,
  },
  nickelBlitz: {
    key: 'nickelBlitz', name: 'Nickel Pressure', extraRushers: 1, from: ['CB', 'LB'],
    desc: 'Slot defender blitzes off the edge with the front slanting away from him.',
    coverageCost: 2.0, pressureBonus: 0.19, freeRusherChance: 0.2,
    allow: ['cover1', 'cover3', 'cover2man', 'cover0'],
  },
  zeroBlitz: {
    key: 'zeroBlitz', name: 'Zero Blitz', extraRushers: 1, from: ['LB', 'S', 'CB'],
    desc: 'Everybody comes. No help anywhere. Get home or give up a touchdown.',
    coverageCost: 4.5, pressureBonus: 0.42, freeRusherChance: 0.42,
    allow: ['cover0'], allOut: true,
  },
  simPressure: {
    key: 'simPressure', name: 'Simulated Pressure', extraRushers: 0, from: ['LB'],
    desc: 'Still only four rushers, but not the four they blocked for. A lineman drops and a linebacker replaces him.',
    coverageCost: 0.5, pressureBonus: 0.13, freeRusherChance: 0.16,
    allow: COVERAGE_KEYS, disguise: 1.4,
  },
};

export const PRESSURE_KEYS = Object.keys(PRESSURES);

// A defensive call is a front + coverage + pressure that are legal together.
export function isLegalCall(frontKey, coverageKey, pressureKey) {
  const pressure = PRESSURES[pressureKey];
  const coverage = COVERAGES[coverageKey];
  if (!pressure || !coverage || !FRONTS[frontKey]) return false;
  if (!pressure.allow.includes(coverageKey)) return false;
  // An all-out blitz cannot be run from a shell that keeps defenders deep.
  if (pressure.allOut && coverage.deep > 0) return false;
  return true;
}

// Seven is the real ceiling: eleven men, five eligible receivers, and you must
// leave somebody to account for the ones that release. Cover 0 is already an
// all-out call at six, so a zero blitz on top of it is an overload of one side
// rather than another body.
export const MAX_RUSHERS = 7;

export function totalRushers(coverageKey, pressureKey) {
  const raw = (COVERAGES[coverageKey]?.baseRushers ?? 4) + (PRESSURES[pressureKey]?.extraRushers ?? 0);
  return Math.min(MAX_RUSHERS, raw);
}

// How many defenders are left to cover, given the rush.
export function coverDefenders(coverageKey, pressureKey) {
  return Math.max(0, 11 - totalRushers(coverageKey, pressureKey));
}
