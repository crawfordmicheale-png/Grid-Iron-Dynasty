// The attribute registry. Every rating a player carries is declared here once,
// with the group it belongs to and a short coach-facing description. Position
// definitions then pick the subset that matters for them.

export const ATTR_GROUPS = {
  physical: 'Physical',
  mental: 'Mental',
  passing: 'Passing',
  carrying: 'Ball Carrying',
  receiving: 'Receiving',
  blocking: 'Blocking',
  rushing: 'Pass Rush',
  runDefense: 'Run Defense',
  coverage: 'Coverage',
  tackling: 'Tackling',
  kicking: 'Kicking',
};

// key: [group, short label, long description]
const RAW = {
  // --- Physical ---
  speed: ['physical', 'SPD', 'Top-end straight line speed.'],
  accel: ['physical', 'ACC', 'How fast he reaches top speed out of a stance or cut.'],
  agility: ['physical', 'AGI', 'Change of direction, ankle flexion, hip fluidity.'],
  strength: ['physical', 'STR', 'Functional playing strength at the point of attack.'],
  jumping: ['physical', 'JMP', 'Vertical explosion for contested balls and pass deflections.'],
  stamina: ['physical', 'STA', 'How long he holds his ratings before fatigue bites.'],
  durability: ['physical', 'DUR', 'Resistance to injury. Low numbers break.'],
  toughness: ['physical', 'TGH', 'Plays hurt, finishes runs, absorbs contact.'],

  // --- Mental ---
  awareness: ['mental', 'AWR', 'Overall feel for the game and his assignment.'],
  playRecognition: ['mental', 'PRC', 'Diagnosing the play pre- and post-snap.'],
  discipline: ['mental', 'DIS', 'Penalty avoidance: alignment, hands, jumping the count.'],
  workEthic: ['mental', 'WOR', 'Drives practice gains and long-term development.'],
  composure: ['mental', 'CMP', 'Performance in late, close, loud situations.'],

  // --- Passing ---
  throwPower: ['passing', 'THP', 'Arm strength: velocity into tight windows, deep ball carry.'],
  accShort: ['passing', 'SAC', 'Accuracy inside 10 yards.'],
  accMid: ['passing', 'MAC', 'Accuracy from 10 to 20 yards.'],
  accDeep: ['passing', 'DAC', 'Accuracy beyond 20 yards.'],
  throwOnRun: ['passing', 'TOR', 'Accuracy with a moving platform.'],
  underPressure: ['passing', 'TUP', 'Holding mechanics with rushers closing.'],
  progression: ['passing', 'PRG', 'Speed and correctness working through reads.'],
  pocketPresence: ['passing', 'PKT', 'Feeling and sliding away from unseen rush.'],
  playAction: ['passing', 'PAC', 'Selling the fake and resetting on time.'],
  decision: ['passing', 'DEC', 'Turnover avoidance and shot selection.'],
  scramble: ['passing', 'SCR', 'Escaping the pocket and gaining yards with his legs.'],

  // --- Ball carrying ---
  vision: ['carrying', 'VIS', 'Reading blocks and finding the real crease.'],
  elusiveness: ['carrying', 'ELU', 'Jukes, jump cuts, making the first man miss in space.'],
  breakTackle: ['carrying', 'BTK', 'Running through contact and arm tackles.'],
  power: ['carrying', 'TRK', 'Lowering the shoulder and finishing forward.'],
  ballSecurity: ['carrying', 'BCV', 'Ball high and tight. Low numbers put it on the ground.'],
  burst: ['carrying', 'BST', 'Hitting the hole and reaching the second level.'],

  // --- Receiving ---
  hands: ['receiving', 'CTH', 'Clean catches on catchable balls.'],
  contested: ['receiving', 'CIT', 'Winning the ball with a defender draped on him.'],
  catchTraffic: ['receiving', 'SPC', 'Securing it over the middle knowing a hit is coming.'],
  release: ['receiving', 'RLS', 'Beating press coverage at the line.'],
  routeShort: ['receiving', 'SRR', 'Short route precision: stems, sells, sharp breaks.'],
  routeMid: ['receiving', 'MRR', 'Intermediate route running and leverage manipulation.'],
  routeDeep: ['receiving', 'DRR', 'Vertical stems, tracking the deep ball.'],
  yac: ['receiving', 'YAC', 'Yards after the catch.'],

  // --- Blocking ---
  passBlock: ['blocking', 'PBK', 'Pass protection: set, mirror, punch.'],
  runBlock: ['blocking', 'RBK', 'Drive blocking and displacement in the run game.'],
  pullBlock: ['blocking', 'PUL', 'Pulling, reach blocks, moving in space.'],
  anchor: ['blocking', 'ANC', 'Absorbing bull rush without giving ground.'],
  handTech: ['blocking', 'HND', 'Hand placement and technique. Also a holding-penalty check.'],
  leadBlock: ['blocking', 'LBK', 'Isolation and lead blocking through the hole.'],
  snapAccuracy: ['blocking', 'SNP', 'Delivering a clean snap under center or in shotgun.'],

  // --- Pass rush ---
  rushPower: ['rushing', 'PMV', 'Bull rush, long arm, converting speed to power.'],
  rushFinesse: ['rushing', 'FMV', 'Speed rush, bend, hands, ghost.'],
  rushCounter: ['rushing', 'CTR', 'Second move when the first one stalls.'],
  getOff: ['rushing', 'GOF', 'First step timing off the snap.'],

  // --- Run defense ---
  blockShed: ['runDefense', 'BSH', 'Disengaging from a blocker to make the play.'],
  runStop: ['runDefense', 'RSP', 'Two-gapping, stacking, holding the point.'],
  gapDiscipline: ['runDefense', 'GAP', 'Staying home instead of chasing the fake.'],
  pursuit: ['runDefense', 'PUR', 'Angles and effort in backside chase.'],

  // --- Coverage ---
  manCover: ['coverage', 'MCV', 'Press and trail man coverage.'],
  zoneCover: ['coverage', 'ZCV', 'Zone spacing, pattern match, passing off routes.'],
  press: ['coverage', 'PRS', 'Disrupting the release at the line.'],
  ballHawk: ['coverage', 'BHK', 'Playing the ball at the catch point. Drives interceptions.'],
  deepRange: ['coverage', 'RNG', 'Ground covered from the deep middle.'],
  blitz: ['coverage', 'BTZ', 'Timing and effectiveness as a blitzer.'],

  // --- Tackling ---
  tackle: ['tackling', 'TAK', 'Wrapping up and finishing in the open field.'],
  hitPower: ['tackling', 'POW', 'Jarring contact. Forces fumbles and incompletions.'],

  // --- Kicking ---
  kickPower: ['kicking', 'KPW', 'Leg strength: range on field goals, distance on punts.'],
  kickAccuracy: ['kicking', 'KAC', 'Placement on field goals and directional punts.'],
  hangTime: ['kicking', 'HNG', 'Air time on punts and kickoffs, limiting the return.'],
};

export const ATTRIBUTES = Object.fromEntries(
  Object.entries(RAW).map(([key, [group, abbr, desc]]) => [key, { key, group, abbr, desc }]),
);

export const ATTR_KEYS = Object.keys(ATTRIBUTES);

// Attributes that decay with age vs ones that keep climbing. Physical tools
// peak around 26 and fall off; mental tools improve as long as he keeps playing.
export const PHYSICAL_DECAY = new Set([
  'speed', 'accel', 'agility', 'jumping', 'burst', 'stamina', 'elusiveness',
  'scramble', 'deepRange', 'getOff', 'kickPower', 'rushFinesse', 'press',
]);

export const MENTAL_GROWTH = new Set([
  'awareness', 'playRecognition', 'discipline', 'composure', 'progression',
  'pocketPresence', 'decision', 'vision', 'gapDiscipline', 'zoneCover',
  'handTech', 'anchor', 'routeShort', 'routeMid', 'playAction', 'snapAccuracy',
]);

export function attrLabel(key) {
  return ATTRIBUTES[key]?.abbr ?? key;
}
