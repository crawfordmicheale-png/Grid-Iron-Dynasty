// Who each club is on day one.
//
// The opening league is authored, not rolled. Every franchise starts from the
// same thirty-two teams, so "Cleveland has the best front seven in football and
// cannot get out of its own way" is a fact about the world rather than an
// accident of a seed.
//
// Talent and coaching are deliberately separate axes. A roll that drives both
// at once only ever produces good teams and bad teams; keeping them apart gives
// you the loaded club that wastes it, the thin roster that overachieves because
// the staff is superb, and the handful that genuinely have both.
//
//   talent    -9 .. +9   how much ability is on the roster
//   coaching  -9 .. +9   how good the staff is at using it
//   strong[]             position groups this club has invested in
//   weak[]               position groups it has neglected
//   window               'contend' | 'steady' | 'rebuild'
//   identity             one line of scouting shorthand

export const TEAM_IDENTITY = {
  // --- Empire East ---
  NYS: {
    talent: 6, coaching: -4, window: 'contend', strong: ['WR', 'DT'], weak: ['OG', 'S'],
    identity: 'Spends like a contender and coaches like a rebuild. The roster is not the problem.',
  },
  BOS: {
    talent: -1, coaching: 6, window: 'steady', strong: ['LB', 'C'], weak: ['WR', 'EDGE'],
    identity: 'Wins games it has no business winning. The staff is the best asset in the building.',
  },
  PHI: {
    talent: 3, coaching: 2, window: 'contend', strong: ['OT', 'EDGE'], weak: ['CB'],
    identity: 'Built from the lines out. Solid everywhere, spectacular nowhere.',
  },
  BAL: {
    talent: -5, coaching: -2, window: 'rebuild', strong: ['S'], weak: ['QB', 'OT', 'WR'],
    identity: 'Two years into a teardown with nothing to show for it yet.',
  },

  // --- Empire North ---
  PIT: {
    talent: 1, coaching: 5, window: 'steady', strong: ['EDGE', 'LB'], weak: ['WR', 'OG'],
    identity: 'Hard, disciplined, and short on playmakers. Nobody enjoys the trip.',
  },
  CLE: {
    talent: 4, coaching: -6, window: 'contend', strong: ['DT', 'OT', 'CB'], weak: ['QB'],
    identity: 'The most talented front seven in football, wasted weekly.',
  },
  DET: {
    talent: -3, coaching: 1, window: 'rebuild', strong: ['RB'], weak: ['CB', 'DT'],
    identity: 'Young, cheap, and a quarterback away from mattering.',
  },
  BUF: {
    talent: 5, coaching: 5, window: 'contend', strong: ['QB', 'S', 'OG'], weak: ['RB'],
    identity: 'Roster and staff both near the top. The standard the league measures itself against.',
  },

  // --- Empire South ---
  NSH: {
    talent: 0, coaching: -1, window: 'steady', strong: ['TE'], weak: ['S'],
    identity: 'Eight and nine every year, and nobody can say quite why.',
  },
  ATL: {
    talent: 2, coaching: -3, window: 'steady', strong: ['WR', 'RB'], weak: ['OT', 'LB'],
    identity: 'Explosive skill players behind a line that cannot protect them.',
  },
  CHA: {
    talent: -6, coaching: -5, window: 'rebuild', strong: [], weak: ['QB', 'EDGE', 'CB'],
    identity: 'Bad roster, bad staff, impatient owner. Start here if you want a challenge.',
  },
  MEM: {
    talent: -2, coaching: 4, window: 'steady', strong: ['CB', 'TE'], weak: ['DT', 'OT'],
    identity: 'Punches above its weight every single year on scheme alone.',
  },

  // --- Empire West ---
  DEN: {
    talent: 3, coaching: 3, window: 'contend', strong: ['WR', 'CB'], weak: ['DT'],
    identity: 'Thin air, fast receivers, and a staff that knows how to use both.',
  },
  LV: {
    talent: 1, coaching: -5, window: 'steady', strong: ['OT', 'WR'], weak: ['LB', 'S'],
    identity: 'Star power up front, no plan behind it.',
  },
  OAK: {
    talent: -4, coaching: 0, window: 'rebuild', strong: ['DT'], weak: ['QB', 'WR', 'CB'],
    identity: 'Stripped to the studs. Cap sheet is clean, roster is not.',
  },
  SEA: {
    talent: 2, coaching: 5, window: 'contend', strong: ['S', 'LB', 'C'], weak: ['RB'],
    identity: 'A secondary that travels and a head coach who never gets outcoached.',
  },

  // --- Frontier East ---
  WAS: {
    talent: -2, coaching: -6, window: 'rebuild', strong: ['RB'], weak: ['QB', 'LB', 'C'],
    identity: 'Dysfunction from the owner down. Talent leaves as soon as it can.',
  },
  MIA: {
    talent: 4, coaching: 1, window: 'contend', strong: ['WR', 'CB', 'EDGE'], weak: ['OG'],
    identity: 'Fastest team in football. Wilts in December and everyone knows it.',
  },
  TB: {
    talent: -1, coaching: 3, window: 'steady', strong: ['EDGE'], weak: ['WR', 'OT'],
    identity: 'Sound, unglamorous, and always in the wild card conversation.',
  },
  ORL: {
    talent: -6, coaching: -3, window: 'rebuild', strong: [], weak: ['QB', 'OT', 'DT'],
    identity: 'The worst roster in the league, and three years of picks to fix it.',
  },

  // --- Frontier North ---
  CHI: {
    talent: -3, coaching: -4, window: 'rebuild', strong: ['LB'], weak: ['QB', 'WR', 'OG'],
    identity: 'Good defense, no offense, and a staff on the last year of its deal.',
  },
  GB: {
    talent: 5, coaching: 4, window: 'contend', strong: ['QB', 'OT', 'LB'], weak: ['CB'],
    identity: 'Quarterback, offensive line, and a building that has done this before.',
  },
  MIN: {
    talent: 2, coaching: -2, window: 'steady', strong: ['WR', 'S'], weak: ['EDGE', 'C'],
    identity: 'Loaded at the skill spots, indifferent in the trenches.',
  },
  STL: {
    talent: -5, coaching: 5, window: 'rebuild', strong: ['C', 'LB'], weak: ['WR', 'CB', 'DT'],
    identity: 'The best coaching staff attached to the thinnest roster. Give them players.',
  },

  // --- Frontier South ---
  DAL: {
    talent: 6, coaching: -3, window: 'contend', strong: ['OT', 'EDGE', 'WR'], weak: ['S'],
    identity: 'Every January the same story: too much talent to lose this early, and they do.',
  },
  HOU: {
    talent: -4, coaching: 2, window: 'rebuild', strong: ['CB'], weak: ['OT', 'TE', 'DT'],
    identity: 'Well run and badly stocked. The plan is sound; the players are not there yet.',
  },
  NO: {
    talent: 1, coaching: 1, window: 'steady', strong: ['TE', 'DT'], weak: ['CB'],
    identity: 'Dead average in a division that will not stay quiet.',
  },
  SA: {
    talent: -1, coaching: -4, window: 'steady', strong: ['RB', 'OG'], weak: ['QB', 'EDGE'],
    identity: 'Runs the ball because it cannot do anything else.',
  },

  // --- Frontier West ---
  LA: {
    talent: 5, coaching: 4, window: 'contend', strong: ['QB', 'WR', 'EDGE'], weak: ['OG'],
    identity: 'The best roster in football, and a cap sheet that says this is the year.',
  },
  SF: {
    talent: 3, coaching: 4, window: 'contend', strong: ['DT', 'TE', 'S'], weak: ['QB'],
    identity: 'Everything a contender needs except the one position that decides it.',
  },
  PHX: {
    talent: -2, coaching: -2, window: 'steady', strong: ['K'], weak: ['OT', 'LB'],
    identity: 'Forgettable. That is the whole scouting report.',
  },
  POR: {
    talent: -6, coaching: 1, window: 'rebuild', strong: ['WR'], weak: ['DT', 'OG', 'S'],
    identity: 'An expansion-flavoured roster with one genuine star to build around.',
  },
};

// How much a strong/weak designation moves a position group, in overall points.
export const GROUP_STRONG = 5.4;
export const GROUP_WEAK = -5.0;

// Cap posture by window: contenders mortgage the future, rebuilds hoard room.
export const WINDOW_PAYROLL = {
  contend: [0.93, 0.995],
  steady: [0.86, 0.95],
  rebuild: [0.76, 0.89],
};

// Designations are relative, not absolute. Six clubs needing a quarterback is a
// true and interesting fact about the league; six clubs each carrying a flat
// penalty at the position is just a worse league. Centring the adjustments on
// their own league-wide mean keeps every position neutral in aggregate while
// preserving the gap between the clubs that invested and the clubs that did not.
export const GROUP_BASELINE = (() => {
  const totals = {};
  const teams = Object.values(TEAM_IDENTITY);
  for (const t of teams) {
    for (const pos of t.strong ?? []) totals[pos] = (totals[pos] ?? 0) + GROUP_STRONG;
    for (const pos of t.weak ?? []) totals[pos] = (totals[pos] ?? 0) + GROUP_WEAK;
  }
  const out = {};
  for (const [pos, sum] of Object.entries(totals)) out[pos] = sum / teams.length;
  return out;
})();

/** The per-position overall adjustment for one club, already centred. */
export function groupAdjustments(ident) {
  const out = {};
  for (const pos of Object.keys(GROUP_BASELINE)) out[pos] = -GROUP_BASELINE[pos];
  for (const pos of ident.strong ?? []) out[pos] = GROUP_STRONG - (GROUP_BASELINE[pos] ?? 0);
  for (const pos of ident.weak ?? []) out[pos] = GROUP_WEAK - (GROUP_BASELINE[pos] ?? 0);
  return out;
}

export function identityFor(teamId) {
  return TEAM_IDENTITY[teamId] ?? {
    talent: 0, coaching: 0, window: 'steady', strong: [], weak: [], identity: '',
  };
}
