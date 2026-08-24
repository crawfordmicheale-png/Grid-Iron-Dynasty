// Position definitions: which attributes matter, how they roll up into an
// overall, the body types that show up at the position, and the archetypes a
// scout would put on a report.


// Every player carries these regardless of position.
const UNIVERSAL = [
  'speed', 'accel', 'agility', 'strength', 'jumping', 'stamina', 'durability',
  'toughness', 'awareness', 'playRecognition', 'discipline', 'workEthic', 'composure',
];

function def(cfg) {
  const weights = cfg.weights;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const normalized = {};
  for (const [k, w] of Object.entries(weights)) normalized[k] = w / total;
  const attrs = Array.from(new Set([...UNIVERSAL, ...Object.keys(weights), ...(cfg.extraAttrs || [])]));
  return { ...cfg, weights: normalized, attrs };
}

export const POSITIONS = {
  QB: def({
    key: 'QB', name: 'Quarterback', unit: 'OFF', group: 'QB', rosterMin: 2, rosterTarget: 3,
    body: { height: [72, 79], weight: [200, 250] },
    speedBase: [56, 90],
    weights: {
      accShort: 12, accMid: 10, accDeep: 7, throwPower: 8, progression: 12, decision: 11,
      underPressure: 8, pocketPresence: 7, awareness: 7, throwOnRun: 4, playAction: 3,
      composure: 4, scramble: 3, ballSecurity: 3,
    },
    extraAttrs: ['breakTackle', 'elusiveness'],
    archetypes: [
      { key: 'pocket', name: 'Pocket Passer', desc: 'Wins from the platform. Timing, anticipation, and a clean throwing base.',
        skew: { accShort: 8, accMid: 8, progression: 7, pocketPresence: 6, scramble: -18, speed: -14, throwOnRun: -10 } },
      { key: 'gunslinger', name: 'Gunslinger', desc: 'Big arm, bigger nerve. Will put it in a window nobody else sees, and sometimes nobody was open.',
        skew: { throwPower: 12, accDeep: 9, underPressure: 5, decision: -12, composure: -4, progression: -5 } },
      { key: 'general', name: 'Field General', desc: 'Gets you into the right play. Physical tools are ordinary; the operation is not.',
        skew: { progression: 12, awareness: 12, decision: 10, playAction: 6, throwPower: -8, speed: -8, accDeep: -5 } },
      { key: 'improviser', name: 'Improviser', desc: 'Play breaks down and the play starts. Off-platform throws, extended downs.',
        skew: { throwOnRun: 12, pocketPresence: 9, scramble: 8, underPressure: 7, progression: -6, decision: -5 } },
      { key: 'dual', name: 'Dual-Threat', desc: 'A designed run threat who forces the defense to account for eleven blockers.',
        skew: { speed: 18, scramble: 16, accel: 12, throwOnRun: 8, accDeep: -6, progression: -7, pocketPresence: -5 } },
    ],
  }),

  RB: def({
    key: 'RB', name: 'Running Back', unit: 'OFF', group: 'BACK', rosterMin: 2, rosterTarget: 3,
    body: { height: [66, 75], weight: [190, 240] },
    speedBase: [82, 98],
    weights: {
      vision: 16, elusiveness: 12, breakTackle: 12, speed: 11, burst: 10, power: 8,
      ballSecurity: 8, accel: 6, agility: 5, hands: 5, passBlock: 4, routeShort: 3,
    },
    extraAttrs: ['yac', 'catchTraffic', 'routeMid'],
    archetypes: [
      { key: 'bruiser', name: 'Bruiser', desc: 'Downhill, one cut, finishes forward. The fourth quarter belongs to him.',
        skew: { power: 14, breakTackle: 12, strength: 10, elusiveness: -12, speed: -8, agility: -8 } },
      { key: 'elusive', name: 'Elusive Back', desc: 'Makes the unblocked defender wrong. Creates yards the blocking did not.',
        skew: { elusiveness: 14, agility: 12, accel: 8, vision: 5, power: -12, strength: -10 } },
      { key: 'speed', name: 'Home Run Hitter', desc: 'One crease and the play is over. Not much between the tackles.',
        skew: { speed: 14, burst: 12, accel: 10, breakTackle: -10, power: -10, passBlock: -6 } },
      { key: 'receiving', name: 'Receiving Back', desc: 'A matchup problem split out. Blitz pickup is part of the deal.',
        skew: { hands: 16, routeShort: 14, routeMid: 10, yac: 8, passBlock: 6, power: -8, breakTackle: -6 } },
      { key: 'workhorse', name: 'Three-Down Back', desc: 'No package tips the play. He can carry it 22 times and stay on the field on third down.',
        skew: { vision: 8, stamina: 12, passBlock: 8, hands: 6, ballSecurity: 6 } },
    ],
  }),

  FB: def({
    key: 'FB', name: 'Fullback', unit: 'OFF', group: 'BACK', rosterMin: 0, rosterTarget: 1,
    body: { height: [70, 76], weight: [235, 260] },
    speedBase: [68, 84],
    weights: {
      leadBlock: 32, runBlock: 18, passBlock: 12, strength: 12, hands: 8,
      breakTackle: 8, ballSecurity: 5, toughness: 5,
    },
    extraAttrs: ['vision', 'power', 'routeShort'],
    archetypes: [
      { key: 'lead', name: 'Lead Blocker', desc: 'A guard in the backfield. Isolation blocks, kick-outs, and nothing else.',
        skew: { leadBlock: 12, strength: 10, hands: -14, speed: -8 } },
      { key: 'hbrid', name: 'H-Back', desc: 'Moves around the formation. Blocks, catches, and occasionally carries.',
        skew: { hands: 14, routeShort: 12, speed: 6, leadBlock: -8, strength: -6 } },
    ],
  }),

  WR: def({
    key: 'WR', name: 'Wide Receiver', unit: 'OFF', group: 'WR', rosterMin: 4, rosterTarget: 6,
    body: { height: [67, 78], weight: [170, 230] },
    speedBase: [86, 99],
    weights: {
      hands: 15, routeShort: 12, routeMid: 12, routeDeep: 9, speed: 12, release: 8,
      contested: 9, yac: 9, catchTraffic: 6, agility: 4, accel: 4,
    },
    extraAttrs: ['runBlock', 'jumping', 'elusiveness', 'breakTackle'],
    archetypes: [
      { key: 'x', name: 'X Receiver', desc: 'Isolated on the backside against press. Wins with size and strength at the catch point.',
        skew: { contested: 14, release: 12, jumping: 10, strength: 8, agility: -8, speed: -4, yac: -4 } },
      { key: 'z', name: 'Z Receiver', desc: 'Flanker off the line. Route technician who beats you with stems and leverage.',
        skew: { routeMid: 12, routeShort: 10, release: 6, awareness: 6, contested: -6, strength: -6 } },
      { key: 'slot', name: 'Slot Receiver', desc: 'Lives inside. Option routes, sits in zone holes, takes the hit over the middle.',
        skew: { routeShort: 14, catchTraffic: 12, agility: 10, yac: 8, routeDeep: -10, contested: -6 } },
      { key: 'deep', name: 'Deep Threat', desc: 'Removes a safety by alignment alone. Everything else is a work in progress.',
        skew: { routeDeep: 16, speed: 12, accel: 8, routeShort: -12, contested: -8, hands: -5 } },
      { key: 'gadget', name: 'Gadget', desc: 'Touch the ball in space and let him play. Jet sweeps, screens, manufactured looks.',
        skew: { yac: 16, elusiveness: 14, agility: 10, routeMid: -10, routeDeep: -8, contested: -8 } },
    ],
  }),

  TE: def({
    key: 'TE', name: 'Tight End', unit: 'OFF', group: 'TE', rosterMin: 2, rosterTarget: 3,
    body: { height: [74, 80], weight: [235, 275] },
    speedBase: [72, 90],
    weights: {
      runBlock: 15, routeShort: 12, routeMid: 10, hands: 15, contested: 9,
      catchTraffic: 7, strength: 7, yac: 6, speed: 6, passBlock: 7, routeDeep: 6,
    },
    extraAttrs: ['release', 'handTech', 'anchor', 'jumping'],
    archetypes: [
      { key: 'inline', name: 'In-Line Blocker', desc: 'A sixth lineman who can be left in against an edge rusher.',
        skew: { runBlock: 16, passBlock: 14, strength: 12, anchor: 10, speed: -10, routeMid: -12, routeDeep: -12 } },
      { key: 'receiving', name: 'Receiving Tight End', desc: 'A linebacker cannot run with him and a safety cannot body him.',
        skew: { routeMid: 14, routeShort: 12, hands: 10, speed: 8, runBlock: -16, passBlock: -12 } },
      { key: 'move', name: 'Move Tight End', desc: 'Flexes out, motions across, creates the matchup you want.',
        skew: { routeShort: 10, yac: 10, agility: 8, speed: 6, runBlock: -10 } },
      { key: 'yac', name: 'Seam Threat', desc: 'Vertical stress up the hash. Turns a completion into a chunk.',
        skew: { routeDeep: 14, speed: 10, yac: 10, contested: 6, runBlock: -8, passBlock: -8 } },
    ],
  }),

  OT: def({
    key: 'OT', name: 'Offensive Tackle', unit: 'OFF', group: 'OL', rosterMin: 3, rosterTarget: 4,
    body: { height: [76, 82], weight: [295, 340] },
    speedBase: [54, 72],
    weights: {
      passBlock: 28, runBlock: 19, anchor: 14, handTech: 12, strength: 8,
      agility: 6, awareness: 6, pullBlock: 4, durability: 3,
    },
    extraAttrs: ['leadBlock', 'discipline'],
    archetypes: [
      { key: 'pass', name: 'Pass Protector', desc: 'Blindside insurance. Long arms, quiet feet, rarely beaten around the arc.',
        skew: { passBlock: 14, agility: 10, handTech: 8, runBlock: -12, strength: -6 } },
      { key: 'grader', name: 'Road Grader', desc: 'Moves people in the run game. Speed rushers are an adventure.',
        skew: { runBlock: 16, strength: 14, anchor: 10, passBlock: -12, agility: -10 } },
      { key: 'balanced', name: 'Balanced Tackle', desc: 'No glaring weakness, no elite trait. You can run any scheme behind him.',
        skew: { awareness: 8, handTech: 6, discipline: 6 } },
    ],
  }),

  OG: def({
    key: 'OG', name: 'Offensive Guard', unit: 'OFF', group: 'OL', rosterMin: 2, rosterTarget: 4,
    body: { height: [74, 79], weight: [300, 345] },
    speedBase: [52, 70],
    weights: {
      runBlock: 25, passBlock: 21, anchor: 14, strength: 12, handTech: 10,
      pullBlock: 9, awareness: 6, durability: 3,
    },
    extraAttrs: ['leadBlock', 'agility', 'discipline'],
    archetypes: [
      { key: 'power', name: 'Power Guard', desc: 'Down blocks and double teams. Displaces a nose tackle by himself.',
        skew: { strength: 14, runBlock: 12, anchor: 12, pullBlock: -10, agility: -10 } },
      { key: 'zone', name: 'Zone Guard', desc: 'Reach blocks, climbs to the second level, pulls on counter.',
        skew: { pullBlock: 16, agility: 12, runBlock: 6, strength: -10, anchor: -8 } },
      { key: 'anchor', name: 'Pass-First Guard', desc: 'Rock in the middle of the pocket. Interior pressure dies on him.',
        skew: { passBlock: 14, anchor: 12, handTech: 8, pullBlock: -8, runBlock: -6 } },
    ],
  }),

  C: def({
    key: 'C', name: 'Center', unit: 'OFF', group: 'OL', rosterMin: 1, rosterTarget: 2,
    body: { height: [73, 78], weight: [290, 325] },
    speedBase: [54, 70],
    weights: {
      awareness: 16, runBlock: 18, passBlock: 18, anchor: 12, handTech: 10,
      snapAccuracy: 8, strength: 8, pullBlock: 6, playRecognition: 4,
    },
    extraAttrs: ['leadBlock', 'agility', 'discipline'],
    archetypes: [
      { key: 'pivot', name: 'Line Caller', desc: 'Sets the protection and gets four other men right. Worth a rating point to everyone beside him.',
        skew: { awareness: 14, playRecognition: 14, snapAccuracy: 8, strength: -8 } },
      { key: 'power', name: 'Power Center', desc: 'Wins the nose-tackle fight on his own so the guards can climb.',
        skew: { strength: 14, anchor: 12, runBlock: 8, agility: -10 } },
      { key: 'athletic', name: 'Athletic Center', desc: 'Reaches the play side and gets to linebackers in the zone game.',
        skew: { pullBlock: 14, agility: 12, runBlock: 4, strength: -10, anchor: -8 } },
    ],
  }),

  EDGE: def({
    key: 'EDGE', name: 'Edge Rusher', unit: 'DEF', group: 'DL', rosterMin: 3, rosterTarget: 4,
    body: { height: [73, 80], weight: [240, 290] },
    speedBase: [74, 92],
    weights: {
      rushFinesse: 16, rushPower: 14, getOff: 10, blockShed: 11, rushCounter: 9,
      runStop: 8, pursuit: 7, tackle: 7, speed: 7, strength: 5, gapDiscipline: 3,
      hitPower: 3,
    },
    extraAttrs: ['zoneCover', 'manCover', 'agility'],
    archetypes: [
      { key: 'speed', name: 'Speed Rusher', desc: 'Bends the corner and flattens to the quarterback. Tackles reach for him.',
        skew: { rushFinesse: 16, getOff: 12, speed: 10, agility: 10, rushPower: -12, runStop: -12, strength: -10 } },
      { key: 'power', name: 'Power Rusher', desc: 'Long-arms a tackle into the quarterback’s lap. Collapses the pocket rather than skirting it.',
        skew: { rushPower: 16, strength: 14, blockShed: 8, rushFinesse: -12, agility: -10, speed: -6 } },
      { key: 'setter', name: 'Edge Setter', desc: 'The run stops on his side. Rush production is incidental.',
        skew: { runStop: 16, blockShed: 12, gapDiscipline: 12, strength: 8, rushFinesse: -14, getOff: -8 } },
      { key: 'hybrid', name: 'Hybrid Rusher', desc: 'Stands up, drops into coverage, rushes from anywhere. Scheme-proof.',
        skew: { zoneCover: 18, manCover: 12, pursuit: 8, agility: 6, rushPower: -8 } },
      { key: 'bender', name: 'Complete Rusher', desc: 'Wins with speed, converts it to power, and has an answer when both fail.',
        skew: { rushCounter: 14, rushFinesse: 8, rushPower: 8, awareness: 6 } },
    ],
  }),

  DT: def({
    key: 'DT', name: 'Defensive Tackle', unit: 'DEF', group: 'DL', rosterMin: 3, rosterTarget: 4,
    body: { height: [72, 79], weight: [290, 350] },
    speedBase: [58, 78],
    weights: {
      runStop: 18, rushPower: 16, blockShed: 15, strength: 13, rushFinesse: 10,
      gapDiscipline: 9, tackle: 8, pursuit: 5, getOff: 4, hitPower: 2,
    },
    extraAttrs: ['rushCounter', 'agility'],
    archetypes: [
      { key: 'nose', name: 'Nose Tackle', desc: 'Eats the center and a guard. The linebackers behind him get to run free.',
        skew: { strength: 16, runStop: 16, gapDiscipline: 10, rushFinesse: -16, speed: -10, pursuit: -10, stamina: -6 } },
      { key: 'threetech', name: '3-Tech Penetrator', desc: 'Shoots the B gap and wrecks the play in the backfield.',
        skew: { getOff: 14, rushFinesse: 14, rushPower: 8, runStop: -10, strength: -6 } },
      { key: 'stuffer', name: 'Run Stuffer', desc: 'Two-gaps, holds the point, and does not get moved. Third down is somebody else’s job.',
        skew: { runStop: 14, blockShed: 12, strength: 10, rushFinesse: -14, rushPower: -6 } },
      { key: 'penetrator', name: 'Interior Rusher', desc: 'Pressure from the inside is the pressure a quarterback cannot escape.',
        skew: { rushPower: 14, rushFinesse: 10, rushCounter: 10, runStop: -8, strength: -4 } },
    ],
  }),

  LB: def({
    key: 'LB', name: 'Linebacker', unit: 'DEF', group: 'LB', rosterMin: 4, rosterTarget: 5,
    body: { height: [71, 77], weight: [220, 255] },
    speedBase: [78, 93],
    weights: {
      playRecognition: 15, tackle: 14, zoneCover: 12, pursuit: 10, blockShed: 9,
      runStop: 9, speed: 8, manCover: 8, blitz: 5, hitPower: 5, awareness: 5,
    },
    extraAttrs: ['ballHawk', 'agility', 'gapDiscipline', 'strength', 'getOff'],
    archetypes: [
      { key: 'thumper', name: 'Thumper', desc: 'Downhill run defender. Fills the gap and the ball carrier stops moving.',
        skew: { runStop: 14, hitPower: 14, blockShed: 12, tackle: 8, manCover: -16, zoneCover: -12, speed: -8 } },
      { key: 'coverage', name: 'Coverage Linebacker', desc: 'Runs with tight ends and backs. Stays on the field in nickel.',
        skew: { manCover: 16, zoneCover: 14, speed: 10, agility: 8, blockShed: -12, runStop: -10, strength: -8 } },
      { key: 'blitzer', name: 'Blitzing Linebacker', desc: 'Times the snap and arrives clean through the A gap.',
        skew: { blitz: 18, getOff: 10, pursuit: 8, zoneCover: -10, manCover: -8 } },
      { key: 'sideline', name: 'Sideline-to-Sideline', desc: 'Range. Chases down plays the rest of the front never touches.',
        skew: { speed: 12, pursuit: 14, agility: 8, tackle: 4, strength: -8, blockShed: -6 } },
      { key: 'mike', name: 'Signal Caller', desc: 'The quarterback of the defense. Gets eleven men lined up and diagnoses before the snap.',
        skew: { playRecognition: 16, awareness: 14, gapDiscipline: 10, speed: -6 } },
    ],
  }),

  CB: def({
    key: 'CB', name: 'Cornerback', unit: 'DEF', group: 'DB', rosterMin: 4, rosterTarget: 5,
    body: { height: [68, 76], weight: [175, 210] },
    speedBase: [87, 99],
    weights: {
      manCover: 23, zoneCover: 16, speed: 14, agility: 10, ballHawk: 10,
      press: 8, playRecognition: 7, tackle: 5, jumping: 4, accel: 3,
    },
    extraAttrs: ['blitz', 'pursuit', 'strength', 'catchTraffic'],
    archetypes: [
      { key: 'press', name: 'Press Man Corner', desc: 'Puts hands on at the line and travels. You can leave him alone out there.',
        skew: { press: 16, manCover: 14, strength: 8, jumping: 6, zoneCover: -12 } },
      { key: 'zone', name: 'Zone Corner', desc: 'Eyes on the quarterback, drives on the throw. Needs help in trail man.',
        skew: { zoneCover: 16, playRecognition: 14, ballHawk: 8, manCover: -14, press: -12 } },
      { key: 'slot', name: 'Slot Corner', desc: 'Covers the hardest release in football and blitzes off the edge.',
        skew: { agility: 14, manCover: 8, blitz: 12, tackle: 10, speed: -6, jumping: -6 } },
      { key: 'ballhawk', name: 'Ballhawk', desc: 'Takes it away. Also gives up the occasional touchdown gambling on it.',
        skew: { ballHawk: 18, jumping: 10, playRecognition: 8, manCover: -8, tackle: -6 } },
      { key: 'shutdown', name: 'Shutdown Corner', desc: 'Erases a side of the field. The play sheet gets shorter for the other team.',
        skew: { manCover: 10, zoneCover: 8, speed: 8, press: 6, ballHawk: 6 } },
    ],
  }),

  S: def({
    key: 'S', name: 'Safety', unit: 'DEF', group: 'DB', rosterMin: 3, rosterTarget: 4,
    body: { height: [70, 76], weight: [190, 225] },
    speedBase: [83, 96],
    weights: {
      zoneCover: 17, playRecognition: 15, manCover: 11, tackle: 12, deepRange: 12,
      ballHawk: 10, speed: 8, pursuit: 6, hitPower: 6, runStop: 3,
    },
    extraAttrs: ['blitz', 'press', 'blockShed', 'strength', 'agility'],
    archetypes: [
      { key: 'free', name: 'Free Safety', desc: 'Single-high range. Lets you play one-high and leave a corner isolated.',
        skew: { deepRange: 16, zoneCover: 12, speed: 10, ballHawk: 8, runStop: -14, hitPower: -12, tackle: -8 } },
      { key: 'strong', name: 'Strong Safety', desc: 'An extra linebacker who can cover a tight end. Lives in the box.',
        skew: { runStop: 16, hitPower: 14, tackle: 12, blockShed: 10, deepRange: -16, speed: -8 } },
      { key: 'nickel', name: 'Big Nickel', desc: 'A third safety who can match a slot, cover a back, and tackle in space.',
        skew: { manCover: 14, agility: 10, tackle: 6, deepRange: -8, hitPower: -4 } },
      { key: 'robber', name: 'Robber', desc: 'Reads the quarterback from depth and jumps the intermediate throw.',
        skew: { playRecognition: 16, ballHawk: 14, zoneCover: 8, deepRange: -6, tackle: -4 } },
    ],
  }),

  K: def({
    key: 'K', name: 'Kicker', unit: 'ST', group: 'K', rosterMin: 1, rosterTarget: 1,
    body: { height: [69, 76], weight: [180, 220] },
    speedBase: [55, 75],
    weights: { kickAccuracy: 48, kickPower: 34, composure: 18 },
    extraAttrs: ['hangTime'],
    archetypes: [
      { key: 'accurate', name: 'Accurate Kicker', desc: 'Automatic inside 45. Do not ask for 55.',
        skew: { kickAccuracy: 10, kickPower: -12 } },
      { key: 'leg', name: 'Big Leg', desc: 'Range changes your fourth-down math. Occasionally pulls one.',
        skew: { kickPower: 14, hangTime: 10, kickAccuracy: -9 } },
      { key: 'clutch', name: 'Ice in Veins', desc: 'The kick to win it is the one he wants.',
        skew: { composure: 16, kickPower: -4 } },
    ],
  }),

  P: def({
    key: 'P', name: 'Punter', unit: 'ST', group: 'K', rosterMin: 1, rosterTarget: 1,
    body: { height: [71, 78], weight: [185, 230] },
    speedBase: [55, 78],
    weights: { kickPower: 34, kickAccuracy: 34, hangTime: 24, composure: 8 },
    archetypes: [
      { key: 'boomer', name: 'Boomer', desc: 'Flips the field. Coverage had better hustle.',
        skew: { kickPower: 14, hangTime: -8, kickAccuracy: -6 } },
      { key: 'directional', name: 'Directional Punter', desc: 'Pins them inside the ten and takes the return away.',
        skew: { kickAccuracy: 14, hangTime: 8, kickPower: -10 } },
    ],
  }),

  LS: def({
    key: 'LS', name: 'Long Snapper', unit: 'ST', group: 'K', rosterMin: 1, rosterTarget: 1,
    body: { height: [72, 78], weight: [230, 260] },
    speedBase: [60, 76],
    weights: { snapAccuracy: 68, tackle: 16, runBlock: 16 },
    archetypes: [
      { key: 'specialist', name: 'Specialist', desc: 'You will never hear his name, which is the entire job description.', skew: {} },
    ],
  }),
};

export const POSITION_KEYS = Object.keys(POSITIONS);

export const UNIT_POSITIONS = {
  OFF: POSITION_KEYS.filter((k) => POSITIONS[k].unit === 'OFF'),
  DEF: POSITION_KEYS.filter((k) => POSITIONS[k].unit === 'DEF'),
  ST: POSITION_KEYS.filter((k) => POSITIONS[k].unit === 'ST'),
};

// A 53-man roster, by position. Sums to 53 exactly.
export const ROSTER_BLUEPRINT = {
  QB: 3, RB: 3, FB: 1, WR: 6, TE: 3, OT: 4, OG: 4, C: 2,
  EDGE: 5, DT: 5, LB: 5, CB: 5, S: 4, K: 1, P: 1, LS: 1,
};

// Positions a player can slide to without a large penalty, and the cost of doing it.
export const POSITION_FLEX = {
  OT: { OG: 4 }, OG: { OT: 8, C: 5 }, C: { OG: 4 },
  EDGE: { DT: 8, LB: 9 }, DT: { EDGE: 10 },
  LB: { EDGE: 10, S: 12 }, S: { CB: 8, LB: 10 }, CB: { S: 8 },
  WR: { RB: 14 }, RB: { WR: 14, FB: 8 }, FB: { TE: 8, RB: 7 }, TE: { FB: 8 },
};

export function positionsInGroup(group) {
  return POSITION_KEYS.filter((k) => POSITIONS[k].group === group);
}
