// Play calling, and the fourth-down decision.
//
// The AI coordinator is not a random number generator with a scheme attached.
// It reads the situation the way a coordinator does -- down, distance, field
// position, score, and clock -- forms a run/pass lean, filters the game plan to
// the plays that belong in this situation, then weights what is left by how
// well it fits the scheme and the moment.

import { FORMATIONS } from '../data/formations.js';
import { COVERAGES, PRESSURES, FRONTS } from '../data/defense.js';
import { schemeAffinity, defensiveAffinity } from '../data/playbook.js';
import { clamp, remap, logistic } from '../core/util.js';

// --- Expected points --------------------------------------------------------
// Points the average offense will eventually score, given first and ten at this
// yard line (0 = own goal line, 100 = opponent's).
const EP_TABLE = [
  [0, -1.2], [10, -0.2], [20, 0.5], [30, 1.1], [40, 1.7],
  [50, 2.4], [60, 3.2], [70, 4.0], [80, 4.8], [90, 5.6], [100, 6.6],
];

export function expectedPoints(absolute) {
  const a = clamp(absolute, 0, 100);
  for (let i = 1; i < EP_TABLE.length; i += 1) {
    const [x1, y1] = EP_TABLE[i - 1];
    const [x2, y2] = EP_TABLE[i];
    if (a <= x2) return y1 + ((a - x1) / (x2 - x1)) * (y2 - y1);
  }
  return 6.6;
}

/** League-average conversion rate for a given distance to go. */
export function conversionRate(distance) {
  // Fitted to real fourth-down conversion rates. Fourth-and-inches gets its own
  // bump because that situation is a quarterback sneak, which converts far
  // better than the curve for every other distance would suggest.
  const base = 0.24 + 0.60 * logistic((3.0 - distance) / 2.6);
  const sneak = distance <= 1 ? 0.03 : 0;
  return clamp(base + sneak, 0.08, 0.75);
}

// --- Situational pass rate --------------------------------------------------

/**
 * How much this situation wants a pass, before the scheme's own lean.
 * Returns 0..1.
 */
export function situationalPassRate(sit) {
  const { down, distance, absolute, scoreDiff, quarter, clock } = sit;
  let rate;
  if (down === 1) rate = 0.52;
  else if (down === 2) {
    if (distance <= 3) rate = 0.40;
    else if (distance <= 7) rate = 0.56;
    else rate = 0.68;
  } else {
    if (distance <= 2) rate = 0.46;
    else if (distance <= 6) rate = 0.80;
    else rate = 0.90;
  }

  // Down near the goal line the field shrinks and the run comes back.
  if (absolute >= 97) rate -= 0.22;
  else if (absolute >= 92) rate -= 0.10;
  // Backed up against your own end zone, you do not want to throw.
  if (absolute <= 5) rate -= 0.12;

  // Score and clock.
  const late = quarter >= 4;
  const secondHalf = quarter >= 3;
  if (late || (quarter === 2 && clock < 240)) {
    if (scoreDiff <= -9) rate += 0.20;
    else if (scoreDiff <= -1) rate += 0.10;
    else if (scoreDiff >= 11) rate -= 0.22;
    else if (scoreDiff >= 4) rate -= 0.10;
  } else if (secondHalf) {
    if (scoreDiff <= -11) rate += 0.10;
    else if (scoreDiff >= 11) rate -= 0.10;
  }

  // Two-minute drill: you throw and you get out of bounds.
  const twoMinute = (quarter === 2 || quarter === 4) && clock <= 120;
  if (twoMinute && scoreDiff <= 3) rate += 0.22;
  // Sitting on a lead with the clock running out.
  if (quarter === 4 && clock <= 240 && scoreDiff > 0) rate -= 0.28;

  return clamp(rate, 0.05, 0.97);
}

// Which situational tags matter right now. Plays carrying them get weighted up.
function situationTagsFor(sit) {
  const { down, distance, absolute, quarter, clock, scoreDiff } = sit;
  const tags = [];
  if (down >= 3 && distance >= 7) tags.push('thirdAndLong', 'needChunk');
  if (down >= 3 && distance <= 2) tags.push('thirdAndShort', 'shortYardage');
  if (down === 1) tags.push('firstDown');
  if (distance <= 2) tags.push('shortYardage');
  if (absolute >= 80) tags.push('redZone');
  if (absolute >= 95) tags.push('goalLine');
  const twoMin = (quarter === 2 || quarter === 4) && clock <= 120;
  if (twoMin) tags.push('twoMinute', 'sideline');
  if (quarter === 4 && scoreDiff <= -9) tags.push('needChunk');
  return tags;
}

/**
 * How often a coordinator running this scheme reaches for this play, before any
 * situation is known. Practice installs against this: a call sheet is built
 * from the plays a coach means to run, not an arbitrary slice of the book.
 */
export function installPriority(play, scheme) {
  let w = schemeAffinity(play, scheme) ** 1.3;
  if (play.type === 'pass') {
    const d = play.primaryDepth ?? 8;
    w *= d < 0 ? 1.25 : d <= 5 ? 1.0 : d <= 10 ? 1.8 : d <= 19 ? 1.02 : 0.78;
  }
  return w;
}

/**
 * The week's call sheet. A coordinator installs a situational spine first --
 * he needs *something* ready for third and one and for the red zone -- and
 * spends what is left of the practice week on his base offense.
 */
export function buildInstallList(book, scheme, size = 34) {
  const ranked = [...(book?.all ?? [])].sort(
    (a, b) => installPriority(b, scheme) - installPriority(a, scheme),
  );
  const seen = new Set();
  const picked = [];
  const add = (play) => {
    if (!play || seen.has(play.id) || picked.length >= size) return;
    seen.add(play.id);
    picked.push(play.id);
  };

  for (const tag of ['shortYardage', 'redZone', 'goalLine', 'twoMinute', 'thirdAndLong']) {
    ranked.filter((p) => p.tags.includes(tag)).slice(0, 2).forEach(add);
  }
  // Base offense, keeping the run and pass halves of the sheet in proportion.
  const runs = ranked.filter((p) => p.type === 'run');
  const passes = ranked.filter((p) => p.type === 'pass');
  let ri = 0;
  let pi = 0;
  while (picked.length < size && (ri < runs.length || pi < passes.length)) {
    if (picked.length % 5 < 2 && ri < runs.length) { add(runs[ri]); ri += 1; }
    else if (pi < passes.length) { add(passes[pi]); pi += 1; }
    else if (ri < runs.length) { add(runs[ri]); ri += 1; }
    else break;
  }
  return picked;
}

/**
 * Call an offensive play.
 * @param {object} cfg { rng, playbook, scheme, coach, sit, gameplan, opponentTendency }
 */
export function callOffensivePlay(cfg) {
  const { rng, playbook, scheme, coach, sit } = cfg;

  // Blend the situation's lean with the scheme's identity and the coach's own.
  const situational = situationalPassRate(sit);
  const schemeLean = scheme.basePassRate;
  let passRate = situational * 0.68 + schemeLean * 0.32;
  passRate += (coach?.aggression ?? 0) * 0.05;
  passRate = clamp(passRate, 0.03, 0.98);

  const wantPass = rng.next() < passRate;
  let pool = wantPass ? playbook.passes : playbook.runs;
  if (!pool.length) pool = playbook.all;

  // Inside the five, empty sets and deep shots are not options.
  if (sit.absolute >= 95) {
    const filtered = pool.filter((p) => !FORMATIONS[p.formation].empty
      && !(p.type === 'pass' && p.tags.includes('shot')));
    if (filtered.length >= 3) pool = filtered;
  }
  // Fourth and one is not the time for a seven-step drop.
  if (sit.down === 4 && sit.distance <= 2) {
    const filtered = pool.filter((p) => p.tags.includes('shortYardage') || (p.type === 'pass' && p.timing <= 2.0));
    if (filtered.length >= 2) pool = filtered;
  }

  const tags = situationTagsFor(sit);
  const gameplanWeight = cfg.gameplan?.emphasis ?? {};

  const weights = pool.map((play) => {
    let w = schemeAffinity(play, scheme) ** 1.3;
    // Situational fit.
    let hits = 0;
    for (const t of tags) if (play.tags.includes(t)) hits += 1;
    w *= 1 + hits * 0.5;
    // Plays the coach emphasised this week.
    w *= gameplanWeight[play.id] ?? 1;
    // Real passing offenses are built on the six-to-ten yard throw. Playbooks
    // are full of shot plays, but coordinators call them sparingly.
    if (play.type === 'pass') {
      const d = play.primaryDepth ?? 8;
      w *= d < 0 ? 1.25 : d <= 5 ? 1.0 : d <= 10 ? 1.8 : d <= 19 ? 1.02 : 0.78;
    }
    // Needing a chunk means the concept has to be able to produce one.
    if (sit.down >= 3 && play.type === 'pass') {
      const conceptTiming = play.timing ?? 2.5;
      // On third and long a one-second concept cannot get to the sticks.
      if (sit.distance >= 8 && conceptTiming <= 1.6) w *= 0.25;
      if (sit.distance <= 4 && conceptTiming >= 3.2) w *= 0.4;
    }
    // Burning clock: no sideline routes, no incompletions.
    if (sit.killClock && play.type === 'pass') w *= 0.15;
    if (sit.killClock && play.type === 'run') w *= 2.0;
    // Hurrying: the ball has to get out and stop the clock.
    if (sit.hurry) {
      if (play.type === 'run') w *= 0.2;
      else if (play.tags.includes('sideline') || play.tags.includes('twoMinute')) w *= 2.2;
    }
    return Math.max(1e-4, w);
  });

  return rng.weighted(pool, weights) ?? pool[0];
}

/** Call a defensive front, coverage, and pressure. */
export function callDefensivePlay(cfg) {
  const { rng, calls, scheme, coach, sit } = cfg;
  const expectPass = situationalPassRate(sit);

  const weights = calls.map((call) => {
    let w = defensiveAffinity(call, scheme) ** 1.2;
    const cov = COVERAGES[call.coverage];
    const pres = PRESSURES[call.pressure];
    const front = FRONTS[call.front];

    // Match the call to what you think is coming.
    const passLook = (front.passRush - 1) * 2 + (pres.extraRushers > 0 ? 0.3 : 0) + cov.deep * 0.12;
    const runLook = front.vsRun - 1 + (cov.runSupport - 1);
    w *= 1 + (expectPass - 0.5) * passLook * 1.8;
    w *= 1 + (0.5 - expectPass) * runLook * 2.4;

    // A pass-rush-only front cannot be called on early downs.
    if (front.passDownOnly && expectPass < 0.7) w *= 0.08;
    // Short yardage wants bodies.
    if (sit.distance <= 2 && sit.down >= 3) w *= front.heavy ? 2.2 : 1;
    // Blitz more on obvious passing downs.
    if (pres.extraRushers > 0) {
      w *= 1 + (expectPass - 0.55) * 2.2;
      w *= 1 + (coach?.aggression ?? 0) * 0.5;
    }
    // Protecting a lead late means keeping everything in front of you.
    const prevent = sit.quarter === 4 && sit.clock <= 150 && sit.scoreDiff <= -4;
    if (prevent) {
      w *= cov.deep >= 3 ? 2.4 : 0.3;
      if (pres.extraRushers > 0) w *= 0.25;
    }
    // Backed up near their own goal line, give up nothing deep.
    if (sit.absolute >= 92) w *= cov.deep === 0 ? 1.6 : cov.deep >= 4 ? 0.5 : 1;
    return Math.max(1e-4, w);
  });

  return rng.weighted(calls, weights) ?? calls[0];
}

// --- Fourth down ------------------------------------------------------------

/**
 * Decide what to do on fourth down by comparing expected value, then nudging
 * for the coach's temperament and the game state. This is the same arithmetic
 * a modern staff runs on the sideline.
 */
export function fourthDownDecision(cfg) {
  const { sit, kicker, ctx = {}, coach, offenseRating = 75, fieldGoalChanceFn } = cfg;
  const { distance, absolute, scoreDiff, quarter, clock } = sit;

  // --- Go for it ---
  let convert = conversionRate(distance);
  convert *= remap(offenseRating, 60, 95, 0.88, 1.12);
  convert = clamp(convert, 0.04, 0.85);
  const gainedTo = clamp(absolute + distance, 0, 99);
  const goEV = convert * expectedPoints(gainedTo) - (1 - convert) * expectedPoints(100 - absolute);

  // --- Field goal ---
  const fgDistance = (100 - absolute) + 17;
  const fgChance = fgDistance <= 68 && kicker ? fieldGoalChanceFn(kicker, fgDistance, ctx) : 0;
  // A miss hands them the ball at the spot of the kick.
  const missSpot = Math.max(20, absolute - 8);
  const fgEV = fgChance * 3 - (1 - fgChance) * expectedPoints(100 - missSpot) * 0.85;

  // --- Punt ---
  // Expected net. Once you are past midfield you are pinning, not booming, so
  // the net shrinks fast -- which is exactly why punting from the opponent's
  // 45 is usually the wrong answer.
  const puntNet = absolute > 45 ? Math.max(10, 100 - absolute - 10) : 41;
  const puntTo = clamp(100 - (absolute + puntNet), 1, 99);
  const puntEV = -expectedPoints(puntTo) * 0.92;

  const options = [
    { action: 'go', ev: goEV, detail: { convert: Math.round(convert * 100) } },
    { action: 'fieldGoal', ev: fgEV, detail: { distance: fgDistance, chance: Math.round(fgChance * 100) } },
    { action: 'punt', ev: puntEV, detail: { net: Math.round(puntNet) } },
  ];

  // Inside your own 35 you simply punt; a field goal is not on the table.
  if (absolute < 55) options[1].ev = -99;
  // You cannot punt from inside the opponent's 32; you kick or you go.
  if (absolute >= 68) options[2].ev -= 0.8;

  // Coaches are more risk-averse than the arithmetic. A coach at aggression 0
  // sits just behind what the numbers say; a genuinely aggressive one plays
  // the analytics straight and then some.
  const aggression = coach?.aggression ?? 0;
  options[0].ev -= 0.30;
  options[0].ev += aggression * 0.65;
  options[2].ev -= aggression * 0.2;

  // Game state overrides the arithmetic.
  const desperate = quarter === 4 && clock <= 300 && scoreDiff < 0;
  if (desperate) {
    const needTD = scoreDiff < -3;
    const veryLate = clock <= 120;
    if (needTD && (veryLate || absolute >= 60)) options[1].ev -= 2.2;
    if (veryLate) { options[2].ev -= 6; options[0].ev += 1.2; }
    // Down by three or less late, a field goal that ties or wins is the play.
    if (scoreDiff >= -3 && fgChance > 0.55 && clock <= 60) options[1].ev += 3.5;
  }
  // Late and ahead: take the points, kill the clock.
  if (quarter === 4 && scoreDiff > 0 && clock <= 300) {
    options[1].ev += 0.6;
    options[2].ev += 0.4;
  }
  // End of half: no point punting with seconds left.
  if ((quarter === 2 || quarter === 4) && clock <= 12) {
    options[2].ev -= 5;
    if (fgChance > 0.2) options[1].ev += 2.5;
  }

  const best = options.reduce((a, b) => (b.ev > a.ev ? b : a));
  return { ...best, options };
}

/** Should the offense go for two? */
export function twoPointDecision(sit, coach) {
  const { scoreDiff, quarter, clock } = sit;
  // scoreDiff here is *after* the touchdown, before the try.
  const late = quarter >= 4 || (quarter === 4 && clock <= 300);
  // The chart: these margins are the ones where two is right.
  const chartGo = [-10, -8, -5, -2, 1, 4, 5, 12, 18, 19, 22].includes(scoreDiff);
  if (late && chartGo) return true;
  if (quarter >= 4 && clock <= 120 && (scoreDiff === -2 || scoreDiff === -10)) return true;
  // A very aggressive coach will do it early now and then.
  return (coach?.aggression ?? 0) > 0.7 && Math.random < 0;
}
