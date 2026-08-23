// Run concepts.
//
// A run is a blocking scheme, an aiming point, and a set of rules for what the
// back does when the aiming point is not there. The engine resolves each gap
// separately -- who is blocking whom, who wins, who is unblocked -- so `aimGap`
// is where the play is designed to go and `cutback` decides how freely the back
// is allowed to take something else.
//
// Gaps: A (either side of center), B (guard-tackle), C (tackle-tight end),
// D (outside everything).

const RUN = (key, name, cfg) => ({
  key, name,
  blocking: cfg.blocking ?? 'zone',
  pullers: cfg.pullers ?? 0,
  doubleTeams: cfg.doubleTeams ?? 1,
  cutback: cfg.cutback ?? 0.4,
  timing: cfg.timing ?? 1.4,
  requiresFB: cfg.requiresFB ?? false,
  qbRun: cfg.qbRun ?? false,
  tags: cfg.tags ?? [],
  ...cfg,
});

export const RUN_CONCEPTS = {
  // ---------------- Zone ----------------
  insideZone: RUN('insideZone', 'Inside Zone', {
    family: 'insideZone', aimGap: 'A', blocking: 'zone', doubleTeams: 2, cutback: 0.75, timing: 1.3,
    desc: 'Everybody steps playside and blocks the man in their zone. The back presses the A gap and takes whatever crease opens.',
    boxTolerance: 0.0, tags: ['zone', 'downhill'],
  }),
  outsideZone: RUN('outsideZone', 'Outside Zone', {
    family: 'outsideZone', aimGap: 'C', blocking: 'zone', doubleTeams: 1, cutback: 0.85, timing: 1.7,
    desc: 'Stretch the front to the sideline. The back reads the reach blocks and either bounces, bangs, or cuts all the way back.',
    boxTolerance: -0.2, tags: ['zone', 'stretch', 'athletic'],
  }),
  duo: RUN('duo', 'Duo', {
    family: 'insideZone', aimGap: 'B', blocking: 'zone', doubleTeams: 3, cutback: 0.55, timing: 1.4,
    desc: 'Double teams across the front with no puller. Move the line and make the linebackers wrong.',
    boxTolerance: 0.15, tags: ['zone', 'power', 'downhill'],
  }),
  pinPull: RUN('pinPull', 'Pin & Pull', {
    family: 'outsideZone', aimGap: 'D', blocking: 'gap', pullers: 2, doubleTeams: 1, cutback: 0.5, timing: 1.9,
    desc: 'Down block inside, pull around it. Gets athletic linemen in space on the perimeter.',
    boxTolerance: -0.25, tags: ['gap', 'perimeter', 'athletic'],
  }),

  // ---------------- Gap ----------------
  power: RUN('power', 'Power', {
    family: 'power', aimGap: 'B', blocking: 'gap', pullers: 1, doubleTeams: 2, cutback: 0.35, timing: 1.6,
    desc: 'Down block, kick out the edge, and pull the backside guard through the hole.',
    boxTolerance: 0.25, tags: ['gap', 'power', 'downhill'],
  }),
  counter: RUN('counter', 'Counter', {
    family: 'counter', aimGap: 'B', blocking: 'gap', pullers: 2, doubleTeams: 1, cutback: 0.3, timing: 1.9,
    desc: 'False step one way, two pullers the other. Slower to develop and devastating when the front over-flows.',
    boxTolerance: 0.1, misdirection: 0.35, tags: ['gap', 'misdirection'],
  }),
  trap: RUN('trap', 'Trap', {
    family: 'trap', aimGap: 'A', blocking: 'gap', pullers: 1, doubleTeams: 1, cutback: 0.35, timing: 1.4,
    desc: 'Let the three-technique come, then blindside him with a pulling guard. Punishes an aggressive interior rusher.',
    boxTolerance: 0.1, misdirection: 0.25, tags: ['gap', 'misdirection', 'trap'],
  }),
  iso: RUN('iso', 'Isolation', {
    family: 'power', aimGap: 'A', blocking: 'man', doubleTeams: 1, cutback: 0.3, timing: 1.3,
    requiresFB: true,
    desc: 'Fullback on the linebacker, back right behind him. No deception at all.',
    boxTolerance: 0.3, tags: ['man', 'power', 'downhill'],
  }),
  dive: RUN('dive', 'Dive', {
    family: 'power', aimGap: 'A', blocking: 'man', doubleTeams: 1, cutback: 0.2, timing: 1.0,
    desc: 'Straight ahead, right now. Two yards and a cloud of dust when you need exactly two yards.',
    boxTolerance: 0.35, tags: ['man', 'shortYardage'],
  }),

  // ---------------- Perimeter ----------------
  toss: RUN('toss', 'Toss Sweep', {
    family: 'outsideZone', aimGap: 'D', blocking: 'gap', pullers: 1, doubleTeams: 0, cutback: 0.45, timing: 2.1,
    desc: 'Get outside fast and let the speed decide it. Nothing if the edge sets.',
    boxTolerance: -0.35, tags: ['perimeter', 'speed'],
  }),
  jetSweep: RUN('jetSweep', 'Jet Sweep', {
    family: 'outsideZone', aimGap: 'D', blocking: 'zone', pullers: 0, doubleTeams: 0, cutback: 0.3, timing: 1.8,
    desc: 'Receiver on a full run across the formation. Punishes a defense that is slow to widen.',
    boxTolerance: -0.4, misdirection: 0.3, motion: true, tags: ['perimeter', 'speed', 'misdirection'],
  }),

  // ---------------- Delayed / passing-down runs ----------------
  draw: RUN('draw', 'Draw', {
    family: 'draw', aimGap: 'B', blocking: 'zone', doubleTeams: 1, cutback: 0.6, timing: 2.0,
    desc: 'Show pass, let the rush get upfield, and run through where they were.',
    boxTolerance: -0.5, misdirection: 0.4, tags: ['draw', 'passingDown'],
  }),
  drawQB: RUN('drawQB', 'QB Draw', {
    family: 'draw', aimGap: 'A', blocking: 'zone', doubleTeams: 1, cutback: 0.55, timing: 2.2,
    qbRun: true,
    desc: 'The quarterback keeps it up the middle after the rush has committed.',
    boxTolerance: -0.55, misdirection: 0.45, tags: ['draw', 'qb', 'passingDown'],
  }),

  // ---------------- Quarterback runs ----------------
  sneak: RUN('sneak', 'QB Sneak', {
    family: 'power', aimGap: 'A', blocking: 'man', doubleTeams: 2, cutback: 0.05, timing: 0.6,
    qbRun: true,
    desc: 'Behind the center on the snap. In one-yard situations nothing else is close.',
    boxTolerance: 0.6, sneak: true, tags: ['qb', 'shortYardage'],
  }),
  qbPower: RUN('qbPower', 'QB Power', {
    family: 'power', aimGap: 'B', blocking: 'gap', pullers: 1, doubleTeams: 2, cutback: 0.3, timing: 1.6,
    qbRun: true, requiresFB: false,
    desc: 'Power blocking with the quarterback carrying. An extra blocker means an extra hat on every defender.',
    boxTolerance: 0.4, tags: ['qb', 'gap', 'power'],
  }),
  readOption: RUN('readOption', 'Read Option', {
    family: 'insideZone', aimGap: 'B', blocking: 'zone', doubleTeams: 1, cutback: 0.6, timing: 1.5,
    qbRead: true,
    desc: 'Leave the backside end unblocked and read him. If he crashes, the quarterback keeps.',
    boxTolerance: 0.2, misdirection: 0.3, tags: ['zone', 'option', 'qb'],
  }),
};

export const RUN_CONCEPT_KEYS = Object.keys(RUN_CONCEPTS);

export const GAPS = ['A', 'B', 'C', 'D'];

export function runsInFamily(family) {
  return RUN_CONCEPT_KEYS.filter((k) => RUN_CONCEPTS[k].family === family);
}

export function runsWithTag(tag) {
  return RUN_CONCEPT_KEYS.filter((k) => RUN_CONCEPTS[k].tags.includes(tag));
}
