// Kicking game: field goals, punts, kickoffs, returns, and the desperate ones.

import { clamp, remap, logistic, contest, round } from '../core/util.js';

// A kick from the `absolute` yard line (0-100 from the offense's own goal) is
// this many yards: distance to the goal line, plus 10 for the end zone and 7
// for the snap and hold.
export function fieldGoalDistance(absolute) {
  return (100 - absolute) + 17;
}

/**
 * Make probability. Calibrated to the real make-rate curve:
 * under 30 ~97%, 30-39 ~93%, 40-49 ~84%, 50-59 ~65%, 60+ ~35%.
 */
export function fieldGoalChance(kicker, distance, ctx = {}, opts = {}) {
  if (!kicker) return 0.5;
  const power = kicker.eff('kickPower', ctx);
  const accuracy = kicker.eff('kickAccuracy', ctx);
  // Every kicker has a range beyond which leg strength, not aim, is the limit.
  const range = remap(power, 45, 99, 53.5, 69) + (opts.altitudeBonus ?? 0);

  // Base curve on distance alone for a league-average leg.
  let p = logistic((range - distance) / 6.6);
  // Accuracy shifts the whole curve.
  p *= remap(accuracy, 40, 99, 0.80, 1.10);
  // Weather: wind and footing.
  p *= 1 - (ctx.weather ?? 0) * remap(distance, 25, 60, 0.10, 0.42);
  // A kick to win it or tie it late.
  if (opts.pressure) {
    p *= remap(kicker.eff('composure', { ...ctx, late: true }), 40, 99, 0.90, 1.04);
  }
  // Blocks and bad snaps happen regardless of the kicker.
  return clamp(p, 0.01, 0.985) * (1 - (opts.blockRisk ?? 0.008));
}

export function attemptFieldGoal(rng, kicker, absolute, ctx = {}, opts = {}) {
  const distance = fieldGoalDistance(absolute);
  const chance = fieldGoalChance(kicker, distance, ctx, opts);
  const good = rng.next() < chance;
  const blocked = !good && rng.next() < 0.04;
  return {
    type: 'fieldGoal', distance, good, blocked, kicker,
    chance: round(chance, 3),
    narrative: good
      ? `${kicker?.shortName ?? 'The kicker'} is good from ${distance}.`
      : blocked
        ? `The ${distance}-yard attempt is blocked!`
        : `${kicker?.shortName ?? 'The kicker'} misses from ${distance}.`,
  };
}

export function attemptExtraPoint(rng, kicker, ctx = {}) {
  const chance = fieldGoalChance(kicker, 33, ctx, { blockRisk: 0.006 });
  const good = rng.next() < chance * 1.01;
  return { type: 'extraPoint', good, kicker, narrative: good ? 'Extra point is good.' : 'The extra point is no good!' };
}

/**
 * Punt. Returns the new absolute field position for the receiving team
 * (measured from *their* own goal line) plus the narrative bits.
 */
export function attemptPunt(rng, punter, returner, absolute, ctx = {}, coverage = 60) {
  const power = punter?.eff('kickPower', ctx) ?? 65;
  const accuracy = punter?.eff('kickAccuracy', ctx) ?? 65;
  const hang = punter?.eff('hangTime', ctx) ?? 65;

  const toEndzone = 100 - absolute;
  let gross = remap(power, 40, 99, 38, 54) + rng.gauss(0, 4.5);
  gross *= 1 - (ctx.weather ?? 0) * 0.14;

  // Inside the 40 he is aiming to pin them, not to boom it.
  const pinning = toEndzone < 45;
  if (pinning) {
    const placement = contest(accuracy, 55, 18);
    gross = Math.min(gross, toEndzone - remap(placement, 0, 1, 12, 3) + rng.gauss(0, 3));
  }
  gross = clamp(gross, 15, 70);

  let landing = absolute + gross;
  let touchback = false;
  let downed = false;
  let returnYards = 0;
  let fairCatch = false;
  let muffed = false;

  if (landing >= 100) {
    touchback = true;
    landing = 100;
  } else if (pinning && rng.next() < contest(accuracy, 50, 20) * 0.55) {
    downed = true;
  } else {
    // Return.
    const hangQuality = remap(hang, 40, 99, 0.75, 1.3);
    const retSpeed = returner?.eff('speed', ctx) ?? 82;
    const retSkill = returner ? returner.eff('elusiveness', ctx) * 0.5 + retSpeed * 0.5 : 78;
    fairCatch = rng.next() < clamp(0.42 * hangQuality - remap(retSkill, 70, 99, 0, 0.12), 0.1, 0.75);
    if (!fairCatch) {
      muffed = rng.next() < 0.012;
      if (!muffed) {
        const base = remap(retSkill - coverage, -25, 25, 2, 14) / hangQuality;
        returnYards = Math.round(clamp(rng.gaussClamped(base, 7, -3, 45), -5, 60));
        // The occasional one that goes all the way.
        if (rng.next() < 0.006 * remap(retSkill, 70, 99, 0.4, 2.2)) {
          returnYards = Math.round((100 - (100 - landing)) + rng.float(0, 5));
          returnYards = 100 - landing;
        }
      }
    }
  }

  // Convert to the receiving team's own-goal-relative position.
  const receiveAt = touchback ? 25 : clamp(100 - landing + returnYards, 1, 99);
  return {
    type: 'punt', gross: Math.round(gross), touchback, downed, fairCatch, muffed,
    returnYards, punter, returner, receiveAt: Math.round(receiveAt),
    narrative: touchback
      ? `${punter?.shortName ?? 'The punter'} punts it into the end zone. Touchback.`
      : downed
        ? `Punt downed at the ${100 - Math.round(landing)}.`
        : muffed
          ? 'The punt is muffed!'
          : fairCatch
            ? `Fair catch at the ${Math.round(100 - landing)}.`
            : `${returner?.shortName ?? 'The returner'} brings it back ${returnYards}.`,
  };
}

/** Kickoff. Returns where the receiving team starts. */
export function attemptKickoff(rng, kicker, returner, ctx = {}, opts = {}) {
  const power = kicker?.eff('kickPower', ctx) ?? 75;
  const depth = remap(power, 45, 99, 58, 75) + rng.gauss(0, 4) + (opts.altitudeBonus ?? 0)
    - (ctx.weather ?? 0) * 6;
  // Kicked from the 35, so depth of 65 reaches the goal line.
  const landsInEndzone = depth >= 65;
  const touchbackChance = landsInEndzone ? clamp(0.24 + (depth - 65) * 0.05, 0.20, 0.85) : 0.04;

  if (rng.next() < touchbackChance) {
    return { type: 'kickoff', touchback: true, receiveAt: 30, returnYards: 0, narrative: 'Touchback.' };
  }
  const landAt = Math.round(clamp(100 - (35 + depth), 0, 25));
  const retSkill = returner ? returner.eff('speed', ctx) * 0.5 + returner.eff('elusiveness', ctx) * 0.5 : 80;
  const base = remap(retSkill, 70, 99, 19, 29);
  let returnYards = Math.round(clamp(rng.gaussClamped(base, 8, 0, 55), 0, 70));
  let touchdown = false;
  if (rng.next() < 0.004 * remap(retSkill, 70, 99, 0.4, 2.4)) {
    returnYards = 100 - landAt;
    touchdown = true;
  }
  const receiveAt = Math.round(clamp(landAt + returnYards, 1, 99));
  return {
    type: 'kickoff', touchback: false, touchdown, receiveAt, returnYards, returner,
    narrative: touchdown
      ? `${returner?.shortName ?? 'The returner'} takes the kickoff all the way!`
      : `${returner?.shortName ?? 'The returner'} returns it to the ${receiveAt}.`,
  };
}

export function attemptOnsideKick(rng, kicker, ctx = {}, surprise = false) {
  // Real recovery rates: about 6% when expected, 3-4x that as a surprise.
  const base = surprise ? 0.20 : 0.045;
  const skill = remap(kicker?.eff('kickAccuracy', ctx) ?? 70, 45, 99, 0.75, 1.35);
  const recovered = rng.next() < base * skill;
  return {
    type: 'onside', recovered,
    receiveAt: recovered ? 48 : 45,
    narrative: recovered ? 'The onside kick is recovered by the kicking team!' : 'The onside kick is covered by the receiving team.',
  };
}

/** Two-point conversion, resolved as a single play from the two. */
export function twoPointChance(offRating, defRating) {
  return clamp(0.475 + (offRating - defRating) * 0.010, 0.20, 0.75);
}
