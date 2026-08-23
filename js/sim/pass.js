// Pass play resolution.
//
// A snap is resolved on a clock, not with a single dice roll. Two timelines run
// against each other:
//
//   the protection timeline -- when does the first rusher beat his man
//   the progression timeline -- when does the quarterback find somebody open
//
// Whichever resolves first decides what kind of play this is. That single idea
// produces most of real football's texture for free: a quick game concept beats
// a blitz because its timeline is shorter, a seven-step shot play needs a line
// that can hold up, and a quarterback who reads fast survives behind a bad one.

import { ROUTES, routeVsCoverage } from '../data/routes.js';
import { PASS_CONCEPTS } from '../data/passConcepts.js';
import { schemeFit } from '../data/schemes.js';
import { clamp, remap, logistic, contest, round } from '../core/util.js';

// --- Tuning constants -------------------------------------------------------
// Named so the balance harness has one place to reach for.
export const PASS_TUNING = {
  baseHoldTime: 4.6,      // seconds an even blocker/rusher matchup lasts
  holdSpread: 0.32,        // lognormal sigma on that
  ratingScale: 58,         // rating points that double or halve the hold time
  unblockedTime: 1.6,      // how long an unblocked edge rusher takes to arrive
  readTimeBase: 0.35,      // seconds per progression step at average PRG
  sightAdjust: 0.22,       // time after the break before the QB can see it
  sepThreshold: 0.55,      // yards of separation the QB wants before throwing
  sepRatingScale: 0.042,   // yards of separation per point of rating advantage
  sepStructural: 0.24,     // how much the route/coverage table is worth, in yards
  sepBase: 0.12,           // baseline daylight before route/coverage effects
  sepNoise: 1.0,
  duressThresholdDrop: 0.85, // how much less open he will settle for when hit
  duressPoiseBar: 60,      // poise needed to consistently get it out under duress
  pressureLag: 0.35,       // delay between a rusher winning and the QB feeling it
  depthThreshold: 0.098,   // extra separation demanded per yard of route depth
  urgencyDecay: 0.78,      // how fast he stops being picky once the play is late
  accBase: 42,             // difficulty floor for an accuracy check
  accDepthCost: 1.70,      // difficulty added per yard of air
  accSepRelief: 4.0,       // difficulty removed per yard of separation
  accSpread: 27,           // rating points that meaningfully move an accuracy check
  sackEscapeScale: 30,
  yacScale: 0.76,
  yacBreakScale: 0.30,
};

const BAND_ACC = { quick: 'accShort', short: 'accShort', intermediate: 'accMid', deep: 'accDeep' };

// --- Protection -------------------------------------------------------------

/**
 * Build the pass-rush timeline: how long each rusher needs to win, and
 * therefore when the pocket breaks down.
 */
export function buildProtection(sim) {
  const { rng, offense, defense, play, ctx } = sim;
  const pressure = defense.pressure;
  const T = PASS_TUNING;

  // Who is rushing. Edges and interior linemen first, then blitzers.
  const rushCount = Math.min(7, defense.coverage.baseRushers + pressure.extraRushers);
  const rushers = [];
  const frontRushers = defense.dl.slice();
  for (const p of frontRushers) rushers.push({ player: p, blitzer: false });
  let i = 0;
  const blitzPool = [...defense.lbs, ...defense.safeties, ...defense.cbs];
  while (rushers.length < rushCount && i < blitzPool.length) {
    rushers.push({ player: blitzPool[i], blitzer: true });
    i += 1;
  }

  // Who is blocking. The line always, plus any back or tight end kept in.
  const blockers = [offense.OL.LT, offense.OL.LG, offense.OL.C, offense.OL.RG, offense.OL.RT].filter(Boolean);
  for (const [slot, player] of Object.entries(offense.slots)) {
    if (ROUTES[play.routes[slot]]?.blocker) blockers.push(player);
  }

  // Did the offense identify the pressure? An undetected blitz means somebody
  // is unblocked; a detected one means the protection slides to meet it.
  const center = offense.OL.C;
  const idScore = (offense.QB?.eff('awareness', ctx) ?? 50) * 0.6 + (center?.eff('awareness', ctx) ?? 50) * 0.4;
  const disguiseScore = 50 + (pressure.disguise ?? 1) * 14 + (defense.front.disguise ?? 1) * 6
    - 50 + (sim.crowdNoise ?? 0) * 20;
  const detected = pressure.extraRushers === 0
    ? true
    : rng.next() < contest(idScore, disguiseScore, 16);

  let unblocked = Math.max(0, rushers.length - blockers.length);
  if (!detected && rng.next() < pressure.freeRusherChance * 2.2) unblocked += 1;
  unblocked = Math.min(unblocked, rushers.length);

  // Pair the best rushers against the best blockers -- that is what a
  // protection call is trying to achieve.
  const sortedRushers = rushers.slice().sort((a, b) => rushSkill(b.player, ctx) - rushSkill(a.player, ctx));
  const sortedBlockers = blockers.slice().sort((a, b) => b.eff('passBlock', ctx) - a.eff('passBlock', ctx));

  const matchups = [];
  for (let r = 0; r < sortedRushers.length; r += 1) {
    const rusher = sortedRushers[r];
    const isFree = r >= sortedRushers.length - unblocked;
    const blocker = isFree ? null : sortedBlockers[r] ?? null;

    let winTime;
    if (!blocker) {
      // Distance to the quarterback depends on where the rusher lined up.
      const depthMult = { EDGE: 1.0, DT: 1.05, LB: 1.34, S: 1.62, CB: 1.55 }[rusher.player.pos] ?? 1.3;
      // Even unblocked, a rusher with no pass-rush ability is easier to avoid.
      const skillMult = remap(rushSkill(rusher.player, ctx), 40, 90, 1.18, 0.9);
      winTime = T.unblockedTime * depthMult * skillMult * rng.float(0.82, 1.22);
    } else {
      const rs = rushSkill(rusher.player, ctx) + (rusher.blitzer ? 4 : 0)
        + (defense.front.passRush - 1) * 18;
      const bs = blockSkill(blocker, rusher.player, ctx);
      const base = T.baseHoldTime * Math.exp((bs - rs) / T.ratingScale);
      winTime = base * Math.exp(rng.gauss(0, T.holdSpread));
      // Getting off the ball fast shortens everything.
      winTime -= (rusher.player.eff('getOff', ctx) - 70) * 0.004;
    }
    winTime *= 1 - (pressure.pressureBonus ?? 0) * 0.55;
    matchups.push({
      rusher: rusher.player, blocker, blitzer: rusher.blitzer,
      free: !blocker, winTime: clamp(winTime, 0.5, 9),
    });
  }

  matchups.sort((a, b) => a.winTime - b.winTime);
  return {
    matchups,
    rushCount: rushers.length,
    blockerCount: blockers.length,
    detected,
    unblocked,
    pressureTime: matchups[0]?.winTime ?? 9,
    firstRusher: matchups[0] ?? null,
  };
}

function rushSkill(p, ctx) {
  if (!p) return 50;
  const power = p.eff('rushPower', ctx);
  const finesse = p.eff('rushFinesse', ctx);
  const counter = p.eff('rushCounter', ctx);
  // A rusher attacks with his better tool; the counter move is what he goes to
  // when the first one stalls, so it matters less to the initial win.
  return Math.max(power, finesse) * 0.68 + Math.min(power, finesse) * 0.14 + counter * 0.18;
}

function blockSkill(blocker, rusher, ctx) {
  if (!blocker) return 0;
  const pb = blocker.eff('passBlock', ctx);
  const anchor = blocker.eff('anchor', ctx);
  const hands = blocker.eff('handTech', ctx);
  const powerRusher = rusher.rating('rushPower') > rusher.rating('rushFinesse');
  // Anchor beats a bull rush; feet and hands beat a speed rush.
  return pb * 0.6 + (powerRusher ? anchor : blocker.eff('agility', ctx)) * 0.22 + hands * 0.18;
}

// --- Route separation -------------------------------------------------------

const ROUTE_SKILL = { quick: 'routeShort', short: 'routeShort', intermediate: 'routeMid', deep: 'routeDeep' };

/**
 * How much daylight a receiver has at the moment his route comes open.
 * Returns yards of separation; roughly 0 is blanketed and 3+ is wide open.
 */
export function computeSeparation(sim, slot, receiver, defender) {
  const { play, defense, ctx, rng } = sim;
  const T = PASS_TUNING;
  const routeKey = play.routes[slot];
  const route = ROUTES[routeKey];
  if (!route || route.blocker) return null;

  const coverage = defense.coverage;
  const isMan = coverage.manRatio >= 0.5;

  // Structural: does this route beat this shell?
  let sep = T.sepBase + routeVsCoverage(routeKey, coverage.key, isMan) * T.sepStructural;

  // Skill: route running against coverage ability.
  const routeAttr = ROUTE_SKILL[route.band];
  const coverAttr = isMan ? 'manCover' : 'zoneCover';
  const runSkill = receiver.eff(routeAttr, ctx) * 0.7 + receiver.eff('agility', ctx) * 0.3;
  const covSkill = defender
    ? defender.eff(coverAttr, ctx) * 0.7 + defender.eff('agility', ctx) * 0.18 + defender.eff('playRecognition', ctx) * 0.12
    : 45; // uncovered
  sep += (runSkill - covSkill) * T.sepRatingScale;

  // Press: a corner who can jam disrupts the timing of everything downfield.
  if (defender && isMan && defender.rating('press') > 60 && route.depth > 6) {
    const jam = contest(defender.eff('press', ctx), receiver.eff('release', ctx), 15);
    sep += (0.5 - jam) * 1.5 + (route.vsPress ?? 0) * 0.12;
  }

  // Shell tendencies by route depth.
  if (route.band === 'quick' || route.band === 'short') sep += (coverage.vsShort ?? 0) * -0.22;
  else if (route.band === 'intermediate') sep += (coverage.vsIntermediate ?? 0) * -0.22;
  else sep += (coverage.vsDeep ?? 0) * -0.22;

  // A blitz means fewer defenders in coverage.
  sep += (defense.pressure.coverageCost ?? 0) * 0.24;

  // Bracket help rolled to the offense's best receiver, and the corresponding
  // relief for everybody else.
  sep -= sim.coverage?.brackets?.[slot] ?? 0;

  // Physical mismatches: a linebacker on a receiver, a corner on a big tight end.
  if (defender) {
    if (defender.pos === 'LB' && (receiver.pos === 'WR')) sep += 1.5;
    else if (defender.pos === 'LB' && receiver.pos === 'TE') sep += 0.3;
    else if (defender.pos === 'CB' && receiver.pos === 'TE') sep += 0.2;
    const speedGap = receiver.eff('speed', ctx) - defender.eff('speed', ctx);
    if (route.band === 'deep') sep += speedGap * 0.035;
    sep += receiver.traitSum('mismatchBonus') * 0.08;
  }

  // Double moves take longer but buy a lot when they work.
  if (route.doubleMove) sep += contest(receiver.eff(routeAttr, ctx), defender?.eff('playRecognition', ctx) ?? 55, 14) * 2.2 - 0.7;

  sep += rng.gauss(0, T.sepNoise);

  return {
    slot, receiver, defender, route, routeKey,
    separation: sep,
    openAt: route.breakTime + T.sightAdjust,
    isMan,
  };
}

// --- The snap ---------------------------------------------------------------

export function resolvePass(sim) {
  const { rng, offense, defense, play, ctx } = sim;
  const T = PASS_TUNING;
  const qb = offense.QB;
  const concept = PASS_CONCEPTS[play.concept];
  const protection = buildProtection(sim);

  // Pre-snap: does the quarterback know what he is looking at?
  const disguise = 50 + ((defense.coverage.disguise ?? 1) - 1) * 30 + ((defense.front.disguise ?? 1) - 1) * 18;
  const readCorrect = rng.next() < contest(
    qb.eff('playRecognition', ctx) * 0.6 + qb.eff('awareness', ctx) * 0.4, disguise, 17,
  );

  // Separation for every live route.
  const looks = [];
  for (const slot of play.progression) {
    const receiver = offense.slots[slot];
    if (!receiver) continue;
    const defender = sim.coverage.assignments[slot] ?? null;
    const look = computeSeparation(sim, slot, receiver, defender);
    if (look) looks.push(look);
  }
  if (!looks.length) return sackResult(sim, protection, 'nobody open');

  // Misreading the coverage costs him the top of his progression.
  if (!readCorrect && looks.length > 1) {
    looks.push(looks.shift());
    for (const l of looks) l.separation -= 0.45;
  }

  // Play action holds the linebackers, but only if the run threat is real.
  if (play.playAction) {
    const paQuality = qb.eff('playAction', ctx) * 0.5 + (sim.runGameCredibility ?? 55) * 0.5;
    const paBonus = remap(paQuality, 40, 95, -0.3, 1.5) * (play.paMult ?? 1);
    for (const l of looks) {
      if (l.route.band === 'intermediate' || l.route.band === 'deep') l.separation += paBonus;
    }
  }

  // How long the quarterback needs per read.
  const prg = qb.eff('progression', ctx);
  // A loud stadium slows a visiting offense's communication and operation.
  const readTime = T.readTimeBase * remap(prg, 40, 99, 1.5, 0.62)
    * (1 + (sim.crowdNoise ?? 0) * 0.08);

  // What he is willing to throw into. Aggression comes from the coach, the
  // quarterback's own temperament, and the situation.
  let threshold = T.sepThreshold;
  // A blitz he saw coming is a blitz he has an answer for: the ball comes out
  // fast to the hot receiver rather than waiting on the concept.
  if (protection.detected && defense.pressure.extraRushers > 0) threshold -= 0.5;
  threshold -= (sim.aggression ?? 0) * 0.55;
  threshold -= qb.traitSum('aggression') * 2.4;
  threshold -= (sim.desperation ?? 0) * 0.9;
  threshold += remap(qb.eff('decision', ctx), 40, 99, -0.35, 0.5);

  // Walk the progression against the clock.
  let t = 0;
  let chosen = null;
  let readsMade = 0;
  for (const look of looks) {
    const availableAt = Math.max(look.openAt, t + readTime);
    if (availableAt > protection.pressureTime) { t = availableAt; break; }
    t = availableAt;
    readsMade += 1;
    // He wants a bigger window to throw deep, and he gets less picky the
    // longer the play goes past the timing the concept was designed for --
    // which is how a checkdown ends up being the right answer.
    const lateness = Math.max(0, t - (play.timing ?? 2.5));
    const needed = threshold + look.route.depth * T.depthThreshold - lateness * T.urgencyDecay;
    if (look.separation >= needed) { chosen = look; break; }
  }

  // A rusher winning his rep and actually affecting the throw are not the same
  // moment; there is roughly a quarter second between them.
  // Nobody open on the first trip through the progression. If the pocket is
  // still clean he does what a quarterback actually does: holds, comes back
  // through his reads, and gets less picky as the play gets late -- which is
  // how the checkdown ends up being the throw. Only once protection breaks is
  // he genuinely under pressure.
  while (!chosen && t < protection.pressureTime) {
    t += readTime * 0.6;
    const lateness = Math.max(0, t - (play.timing ?? 2.5));
    let best = null;
    let bestGap = -Infinity;
    for (const look of looks) {
      if (look.openAt > t) continue;
      const needed = threshold + look.route.depth * T.depthThreshold - lateness * T.urgencyDecay;
      const gap = look.separation - needed;
      if (gap > bestGap) { bestGap = gap; best = look; }
    }
    if (best && bestGap >= 0) { chosen = best; readsMade += 1; }
  }

  const pressured = t >= protection.pressureTime + PASS_TUNING.pressureLag;

  // Protection broke before he found anybody.
  if (!chosen) {
    return underPressure(sim, protection, looks, t, readsMade, threshold);
  }

  return throwBall(sim, chosen, {
    timeToThrow: t,
    pressured,
    protection,
    readsMade,
    path: 'clean',
  });
}

// --- Pressure outcomes ------------------------------------------------------

function underPressure(sim, protection, looks, t, readsMade, threshold) {
  const { rng, offense, ctx } = sim;
  const qb = offense.QB;
  const T = PASS_TUNING;

  // The pocket has broken. In order of what actually happens most often:
  // get it out to whoever is available, escape and make something happen,
  // throw it away, or take the sack.

  const available = looks
    .filter((l) => l.openAt <= protection.pressureTime + 0.4)
    .sort((a, b) => b.separation - a.separation);
  const best = available[0];

  // Getting rid of it under duress. A poised quarterback with anybody at all
  // in his vision throws it; a jittery one does not see him.
  const poise = qb.eff('underPressure', { ...ctx, pressure: true }) * 0.6
    + qb.eff('composure', ctx) * 0.2 + qb.eff('progression', ctx) * 0.2;
  if (best && best.separation >= threshold - T.duressThresholdDrop) {
    if (rng.next() < contest(poise, T.duressPoiseBar, 20)) {
      return throwBall(sim, best, {
        timeToThrow: t, pressured: true, protection, readsMade, duress: true, path: 'duress',
      });
    }
  }

  // Can he get out of it?
  const escapeSkill = qb.eff('pocketPresence', ctx) * 0.45 + qb.eff('scramble', ctx) * 0.3
    + qb.eff('agility', ctx) * 0.25;
  const rusher = protection.firstRusher?.rusher;
  const rusherClose = rusher ? rusher.eff('speed', ctx) * 0.3 + rusher.eff('tackle', ctx) * 0.7 : 60;
  const escapeChance = contest(escapeSkill, rusherClose, T.sackEscapeScale) / qb.traitMult('sackTakenMult');

  if (rng.next() < escapeChance) {
    // Play extended. Coverage breaks down when receivers start scrambling too.
    const bestLate = looks
      .map((l) => ({ ...l, separation: l.separation + 0.75 }))
      .sort((a, b) => b.separation - a.separation)[0];

    const scrambleValue = qb.eff('speed', ctx) * 0.5 + qb.eff('scramble', ctx) * 0.5;
    const wantsToRun = scrambleValue > 60 && (!bestLate || bestLate.separation < 1.5);

    if (!wantsToRun && bestLate && bestLate.separation >= 0.8) {
      return throwBall(sim, bestLate, {
        timeToThrow: t + 0.7, pressured: true, onTheRun: true, protection, readsMade, path: 'extended',
      });
    }
    if (wantsToRun) return scrambleResult(sim, protection, t);
    if (rng.next() < contest(qb.eff('awareness', ctx), 78, 20)) {
      return {
        type: 'throwaway', yards: 0, passer: qb, complete: false,
        timeToThrow: round(t + 0.8, 2), pressured: true, clockStops: true,
        narrative: `${qb.shortName} escapes the rush and throws it away.`,
      };
    }
    return scrambleResult(sim, protection, t);
  }

  // No escape, nobody to throw to. Throw it away if he has the presence.
  if (rng.next() < contest(qb.eff('awareness', ctx) * 0.6 + qb.eff('pocketPresence', ctx) * 0.4, 88, 18)) {
    return {
      type: 'throwaway', yards: 0, passer: qb, complete: false,
      timeToThrow: round(t + 0.4, 2), pressured: true, clockStops: true,
      narrative: `${qb.shortName} is flushed and throws it away.`,
    };
  }

  return sackResult(sim, protection, 'pressure', t);
}

function sackResult(sim, protection, reason, t = null) {
  const { rng, offense, ctx } = sim;
  const qb = offense.QB;
  // Several rushers are usually converging at once; the sack is credited to one
  // of the men who actually beat his block, not always the very first.
  const arrived = protection.matchups.filter(
    (m) => m.winTime <= protection.pressureTime + 0.55,
  );
  const sacker = arrived.length
    ? rng.weighted(arrived, (m) => 1 / Math.max(0.35, m.winTime - protection.pressureTime + 0.5)).rusher
    : protection.firstRusher?.rusher ?? null;
  // Sack yardage: usually short, occasionally a disaster.
  const loss = Math.round(clamp(rng.gaussClamped(6.4, 3.2, 0, 18), 1, 20));
  const fumbleChance = 0.075 * qb.traitMult('fumbleMult')
    * remap(qb.eff('ballSecurity', ctx), 40, 95, 1.6, 0.5)
    * (sacker ? remap(sacker.eff('hitPower', ctx), 50, 95, 0.8, 1.5) : 1);
  const fumble = rng.next() < fumbleChance;

  return {
    type: 'sack', yards: -loss, passer: qb, sackedBy: sacker, complete: false,
    timeToThrow: round(t ?? protection.pressureTime, 2),
    pressured: true, fumble, clockStops: false,
    narrative: sacker
      ? `${sacker.shortName} gets home — sacks ${qb.shortName} for a loss of ${loss}.`
      : `${qb.shortName} is sacked for a loss of ${loss}.`,
    reason,
  };
}

function scrambleResult(sim, protection, t) {
  const { rng, offense, defense, ctx } = sim;
  const qb = offense.QB;
  // Scrambling quarterbacks find grass because everyone has their back turned.
  const speed = qb.eff('speed', ctx);
  const elusive = qb.eff('scramble', ctx) * 0.6 + qb.eff('elusiveness', ctx) * 0.4;
  const pursuit = defense.all.reduce((s, d) => s + d.eff('pursuit', ctx), 0) / Math.max(1, defense.all.length);
  const base = remap(speed * 0.5 + elusive * 0.5, 45, 95, 2.0, 8.5);
  const yards = Math.round(clamp(rng.gaussClamped(base + (60 - pursuit) * 0.06, 4.5, -3, 40), -4, 60));
  const fumble = rng.next() < 0.011 * qb.traitMult('fumbleMult');
  return {
    type: 'scramble', yards, rusher: qb, passer: qb, complete: false, isRun: true,
    timeToThrow: round(t + 0.9, 2), pressured: true, fumble, clockStops: false,
    narrative: `${qb.shortName} escapes the pocket and scrambles for ${yards >= 0 ? yards : `a loss of ${-yards}`}.`,
  };
}

// --- The throw --------------------------------------------------------------

function throwBall(sim, look, opts) {
  const { rng, offense, defense, ctx } = sim;
  const T = PASS_TUNING;
  const qb = offense.QB;
  const { receiver, defender, route, separation } = look;
  const pressured = opts.pressured;
  const airYards = route.depth;

  const throwCtx = { ...ctx, pressure: pressured };

  // Accuracy. Difficulty rises with depth and falls with separation.
  let acc = qb.eff(BAND_ACC[route.band], throwCtx);
  if (pressured) acc -= remap(qb.eff('underPressure', throwCtx), 40, 95, 20, 4);
  if (opts.onTheRun || sim.play.rollout) acc -= remap(qb.eff('throwOnRun', throwCtx), 40, 95, 16, 2);
  // Arm strength matters most on deep and outside throws.
  if (route.band === 'deep') acc += (qb.eff('throwPower', throwCtx) - 78) * 0.30;
  else if (route.band === 'intermediate') acc += (qb.eff('throwPower', throwCtx) - 78) * 0.12;
  // Short throws are rhythm throws off a three-step drop: the ball is out
  // before the coverage can do much about it, and a screen is nearly a handoff.
  // Scaled by actual depth rather than by band, so a four-yard drag gets the
  // same help a four-yard slant does.
  acc += remap(clamp(airYards, -2, 12), -2, 12, 11, 0);
  // Weather: wind and wet balls hurt the deep throw most.
  acc -= ctx.weather * (route.band === 'deep' ? 17 : route.band === 'intermediate' ? 10 : 5);

  const difficulty = T.accBase + airYards * T.accDepthCost - separation * T.accSepRelief;
  const onTargetChance = clamp(logistic((acc - difficulty) / PASS_TUNING.accSpread), 0.02, 0.985);
  const roll = rng.next();

  const result = {
    passer: qb, target: receiver, defender, slot: look.slot, route: look.routeKey,
    airYards, separation: round(separation, 2),
    timeToThrow: round(opts.timeToThrow, 2), pressured, path: opts.path ?? 'clean',
    readsMade: opts.readsMade, complete: false, yards: 0, clockStops: true,
  };

  // Badly off target: a chance the defender takes it.
  if (roll > onTargetChance + (1 - onTargetChance) * 0.55) {
    const intChance = interceptionChance(sim, look, { dangerous: true, pressured });
    if (rng.next() < intChance) return interception(sim, look, result);
    return { ...result, type: 'incomplete', narrative: `${qb.shortName}'s pass for ${receiver.shortName} is off the mark.` };
  }

  // On target but contested, or simply not caught.
  const catchResult = attemptCatch(sim, look, { pressured, onTarget: roll <= onTargetChance });
  if (catchResult.intercepted) return interception(sim, look, result);
  if (!catchResult.caught) {
    return {
      ...result,
      type: 'incomplete',
      dropped: catchResult.dropped,
      brokenUpBy: catchResult.brokenUpBy,
      narrative: catchResult.narrative,
    };
  }

  // Caught. Now how far does he get with it?
  const yac = computeYac(sim, look, catchResult);
  const total = Math.max(-2, Math.round(airYards + yac));
  const fumbleChance = 0.0072 * receiver.traitMult('fumbleMult')
    * remap(receiver.eff('ballSecurity', ctx), 40, 95, 2.0, 0.5)
    * (1 + ctx.weather * 0.6);

  return {
    ...result,
    type: 'complete', complete: true, yards: total,
    yac: Math.round(yac), contested: catchResult.contested,
    tackledBy: catchResult.tackler,
    fumble: rng.next() < fumbleChance,
    clockStops: false,
    narrative: `${qb.shortName} finds ${receiver.shortName} on the ${route.name.toLowerCase()} for ${total}.`,
  };
}

function attemptCatch(sim, look, { pressured, onTarget }) {
  const { rng, ctx } = sim;
  const { receiver, defender, route, separation } = look;

  const contestedBall = separation < 1.0 || route.contested;
  let catchSkill = receiver.eff('hands', ctx);
  if (contestedBall) {
    catchSkill = catchSkill * 0.45 + receiver.eff('contested', ctx) * 0.4 + receiver.eff('jumping', ctx) * 0.15;
  }
  if (route.band !== 'deep' && separation < 2.2) {
    // Over the middle with a hit coming.
    catchSkill = catchSkill * 0.75 + receiver.eff('catchTraffic', ctx) * 0.25;
  }
  catchSkill -= ctx.weather * 9;

  const contestScore = defender
    ? defender.eff('ballHawk', ctx) * 0.5 + defender.eff('jumping', ctx) * 0.2 + defender.eff('manCover', ctx) * 0.3
    : 30;
  const pressureOnCatch = contestedBall ? contestScore : contestScore * 0.35;

  const dropMult = receiver.traitMult('dropMult');
  // Built in logit space around two anchors: an on-target ball to an average
  // receiver in space is caught about nine times in ten, and a ball that is
  // merely catchable is caught about one time in four. Everything else moves
  // relative to those. Working in logit space keeps the model off its ceiling,
  // which is what made an earlier version catch even bad deep balls.
  let logit = onTarget ? 3.35 : -1.0;
  logit += (catchSkill - 72) * 0.045;
  logit -= pressureOnCatch * 0.033;
  logit += clamp(separation, -1, 3) * 0.25;
  // A ball in the air for forty yards is simply harder to track and adjust to.
  if (route.band === 'deep') logit -= 0.55;
  const catchChance = clamp(logistic(logit) / dropMult ** 0.4, 0.02, 0.97);

  if (rng.next() < catchChance) {
    // Whoever is closest usually makes the tackle, but help arrives too.
    const help = sim.defense.all.filter((d) => d !== defender);
    const tackler = defender && rng.bool(0.44)
      ? defender
      : rng.weighted(help, (d) => d.eff('pursuit', ctx) * 0.5 + d.eff('speed', ctx) * 0.5) ?? defender;
    return { caught: true, contested: contestedBall, tackler };
  }

  // Not caught: was it a drop, or did the defender make a play?
  const defenderPlay = defender && contestedBall
    ? rng.next() < contest(contestScore, receiver.eff('contested', ctx), 16)
    : false;

  if (defenderPlay) {
    // A defender at the catch point sometimes comes down with it himself.
    const pickChance = 0.16 * remap(defender.eff('ballHawk', ctx), 45, 95, 0.5, 1.9);
    if (rng.next() < pickChance) return { caught: false, intercepted: true };
    return {
      caught: false, dropped: false, brokenUpBy: defender,
      narrative: `${defender.shortName} breaks it up.`,
    };
  }

  // Only a catchable, on-target ball can be charged as a drop; a throw that
  // was never catchable is simply an incompletion.
  return {
    caught: false, dropped: onTarget,
    narrative: onTarget
      ? `${receiver.shortName} can't hang on. Incomplete.`
      : `The throw is away from ${receiver.shortName}. Incomplete.`,
  };
}

function interceptionChance(sim, look, { dangerous, pressured }) {
  const { ctx } = sim;
  const { defender, route, separation } = look;
  const qb = sim.offense.QB;
  if (!defender) return 0.004;
  let p = dangerous ? 0.050 : 0.013;
  p *= route.risk ?? 1;
  p *= remap(defender.eff('ballHawk', ctx), 40, 95, 0.45, 2.0);
  p *= remap(separation, -1, 3.5, 1.9, 0.35);
  p *= qb.traitMult('intMult');
  p *= remap(qb.eff('decision', ctx), 40, 95, 1.32, 0.72);
  if (pressured) p *= 1.35;
  if (defender.hasTrait('gambler')) p *= 1.3;
  return clamp(p, 0, 0.5);
}

function interception(sim, look, result) {
  const { rng, ctx } = sim;
  const { receiver } = look;
  // The nearest defender usually makes the play, but in zone the ball is often
  // picked off by somebody breaking on it from elsewhere.
  const nearest = look.defender;
  const help = sim.defense.all.filter((d) => d !== nearest && ['CB', 'S', 'LB'].includes(d.pos));
  const defender = nearest && rng.bool(0.62)
    ? nearest
    : (rng.weighted(help, (d) => d.eff('ballHawk', ctx) * 0.6 + d.eff('zoneCover', ctx) * 0.4) ?? nearest);
  // Return yards: mostly short, occasionally house money.
  const ret = Math.round(clamp(
    rng.gaussClamped(remap(defender?.eff('speed', ctx) ?? 80, 70, 99, 6, 16), 9, 0, 70), 0, 90,
  ));
  return {
    ...result,
    type: 'interception', complete: false, turnover: true,
    interceptedBy: defender, returnYards: ret, yards: 0, clockStops: false,
    narrative: `Intercepted! ${defender?.shortName ?? 'The defense'} steps in front of ${receiver.shortName}.`,
  };
}

function computeYac(sim, look, catchResult) {
  const { rng, offense, defense, ctx } = sim;
  const { receiver, defender, route, separation } = look;
  const T = PASS_TUNING;

  // How much room he catches it in.
  const space = clamp(separation, -0.5, 4.5);
  let base = (route.yacBase ?? 3) * remap(space, 0, 4, 0.55, 1.6);

  // Screens are all yards after the catch, and they depend on blockers.
  if (route.screen) {
    const blockGrade = Object.values(offense.slots).reduce((s, p) => s + p.eff('runBlock', ctx), 0)
      / Math.max(1, Object.keys(offense.slots).length);
    base *= remap(blockGrade, 45, 90, 0.6, 1.5);
  }

  const yacSkill = receiver.eff('yac', ctx) * 0.45 + receiver.eff('elusiveness', ctx) * 0.25
    + receiver.eff('breakTackle', ctx) * 0.15 + receiver.eff('speed', ctx) * 0.15;
  const tackleSkill = defender
    ? defender.eff('tackle', ctx) * 0.7 + defender.eff('pursuit', ctx) * 0.3
    : 55;

  let yac = base * remap(yacSkill - tackleSkill, -25, 25, 0.5, 1.9) * T.yacScale;

  // Breaking the first tackle in space is where the long ones come from.
  const breakChance = contest(yacSkill, tackleSkill, 22) * remap(space, 0, 4, 0.5, 1.3);
  if (rng.next() < breakChance * T.yacBreakScale) {
    const helpNearby = defense.coverage.deep + (route.band === 'deep' ? 0 : 2);
    yac += rng.gaussClamped(remap(receiver.eff('speed', ctx), 75, 99, 5, 17), 8, 0, 62)
      * remap(helpNearby, 0, 4, 1.1, 0.4);
  }

  yac += rng.gauss(0, 1.7);
  return Math.max(-1, yac);
}
