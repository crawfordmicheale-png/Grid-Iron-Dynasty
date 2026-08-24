// Offseason development, decline, and retirement.
//
// A player's year is decided by four things: how much headroom he has left,
// how old he is, how much he played, and who coached him. That last one is the
// point -- a good position coach is worth real rating points every winter,
// which is why the hiring screen matters.

import { DEV_TIERS } from '../model/player.js';
import { POSITIONS } from '../data/positions.js';
import { PHYSICAL_DECAY, MENTAL_GROWTH } from '../data/attributes.js';
import { positionCoachFor } from '../model/staff.js';
import { clamp, remap, round } from '../core/util.js';

/**
 * Develop one player by a year.
 * @returns {{ before:number, after:number, changes:object, note:string }}
 */
export function developPlayer(rng, player, team, opts = {}) {
  const before = player.overall();
  const tier = DEV_TIERS[player.dev] ?? DEV_TIERS.normal;
  const coach = team ? positionCoachFor(team.staff, POSITIONS[player.pos].group) : null;
  const strength = team?.staff?.STRENGTH;

  // Coaching. A great position coach is worth roughly double a poor one.
  const coachDev = coach ? remap(coach.attr('development'), 30, 95, 0.55, 1.55) : 1;
  const coachTech = coach ? remap(coach.attr('technique'), 30, 95, 0.7, 1.35) : 1;
  const conditioning = strength ? remap(strength.attr('conditioning'), 30, 95, 0.85, 1.2) : 1;

  // Playing time is the biggest single driver of a young player's growth.
  const snaps = player.snapCount ?? 0;
  const playingTime = remap(clamp(snaps, 0, 1000), 0, 700, 0.45, 1.25);

  // Work ethic and traits.
  const ethic = remap(player.rating('workEthic'), 30, 95, 0.7, 1.35);
  const traitMult = player.traitMult('devMult');
  const curveShift = player.traitSum('devCurveShift');

  const age = player.age;
  const changes = {};
  let anyGrowth = 0;
  let anyDecline = 0;

  for (const attr of POSITIONS[player.pos].attrs) {
    const cur = player.rating(attr);
    const cap = player.cap(attr);
    const room = cap - cur;

    // --- Growth ---
    let growth = 0;
    if (room > 0) {
      const youthful = clamp(remap(age - curveShift, 21, 29, 1.15, 0.0), 0, 1.15);
      const mentalBonus = MENTAL_GROWTH.has(attr) ? 0.4 : 0;
      const base = (youthful + mentalBonus) * tier.mult * coachDev * coachTech * playingTime * ethic * traitMult;
      // Attributes closest to their ceiling move slowest.
      const roomFactor = clamp(room / 12, 0.15, 1);
      growth = rng.gaussClamped(base * roomFactor * 1.35, base * 0.55, 0, room);
    }

    // --- Decline ---
    let decline = 0;
    const declineAge = PHYSICAL_DECAY.has(attr) ? 28 : 32;
    if (age > declineAge) {
      const years = age - declineAge;
      const severity = PHYSICAL_DECAY.has(attr) ? 1.35 : 0.55;
      decline = rng.gaussClamped(years * 0.90 * severity / conditioning, 1.2, 0, 10);
      // Toughness and awareness hold up; speed does not.
      if (MENTAL_GROWTH.has(attr)) decline *= 0.3;
    }

    const delta = growth - decline;
    if (Math.abs(delta) >= 0.5) {
      const next = clamp(Math.round(cur + delta), 12, Math.max(cap, cur));
      if (next !== cur) {
        changes[attr] = next - cur;
        if (next > cur) anyGrowth += next - cur;
        else anyDecline += cur - next;
        player.ratings[attr] = next;
      }
    }
  }

  // Ceilings themselves can move: a young player who exceeds expectations gets
  // a higher ceiling, and one who stalls has it revised down.
  if (age <= 25 && anyGrowth > 6 && rng.bool(0.12)) {
    for (const attr of Object.keys(player.caps)) {
      player.caps[attr] = clamp(player.caps[attr] + rng.int(1, 4), player.ratings[attr], 99);
    }
    player.history.push({ year: opts.year, type: 'breakout' });
  } else if (age <= 25 && anyGrowth < 2 && rng.bool(0.30)) {
    for (const attr of Object.keys(player.caps)) {
      player.caps[attr] = clamp(player.caps[attr] - rng.int(1, 4), player.ratings[attr], 99);
    }
  }

  player.invalidate();
  player.age += 1;
  player.exp += 1;
  const after = player.overall();

  let note = 'steady';
  if (after - before >= 4) note = 'major improvement';
  else if (after - before >= 1) note = 'improved';
  else if (after - before <= -4) note = 'sharp decline';
  else if (after - before <= -1) note = 'declined';

  return { before, after, changes, note, delta: after - before };
}

/** Will he keep playing? */
export function retirementCheck(rng, player, opts = {}) {
  const age = player.age;
  if (age < 29) return false;
  const ovr = player.overall();

  // Chance rises steeply with age and falls with how good he still is.
  let chance = clamp(remap(age, 29, 40, 0.02, 0.85), 0, 0.9);
  chance *= remap(ovr, 55, 90, 1.7, 0.35);
  // A player nobody signed is far more likely to walk away.
  if (!player.teamId) chance *= 2.2;
  // Wear and tear.
  const majorInjuries = (player.history ?? []).filter((h) => h.type === 'majorInjury').length;
  chance *= 1 + majorInjuries * 0.28;
  chance *= player.hasTrait('ironman') ? 0.7 : 1;
  chance *= player.hasTrait('injuryProne') ? 1.35 : 1;
  // A ring can be a good place to stop.
  if ((player.accolades ?? []).some((a) => a.year === opts.year && a.label === 'MVP')) chance *= 0.4;

  return rng.next() < clamp(chance, 0, 0.95);
}

/**
 * Run the whole league through a year of development.
 * @returns {{ developed:Array, retired:Array }}
 */
export function runProgression(rng, league) {
  const developed = [];
  const retired = [];

  for (const team of league.allTeams()) {
    for (const player of team.roster.slice()) {
      const result = developPlayer(rng, player, team, { year: league.year });
      developed.push({ player, team, ...result });
      if (Math.abs(result.delta) >= 4) {
        league.log('development', `${player.name} (${team.abbr}) ${result.note}: ${result.before} to ${result.after} overall.`);
      }
      if (retirementCheck(rng, player, { year: league.year })) {
        team.removePlayer(player.id);
        player.history.push({ year: league.year, type: 'retired' });
        league.retired.push(player);
        retired.push({ player, team });
        league.log('retirement', `${player.name}, ${player.pos} (${team.abbr}), retires after ${player.exp} seasons.`);
      }
    }
    team.rebuildDepthChart();
  }

  // Free agents age too.
  for (const player of league.freeAgents.slice()) {
    developPlayer(rng, player, null, { year: league.year });
    if (retirementCheck(rng, player, { year: league.year })) {
      league.freeAgents = league.freeAgents.filter((p) => p.id !== player.id);
      league.retired.push(player);
      retired.push({ player, team: null });
    }
  }

  return { developed, retired };
}

/** Coaches age and develop too, and eventually walk away. */
export function ageStaff(rng, league) {
  const retiredCoaches = [];
  for (const team of league.allTeams()) {
    for (const coach of team.allCoaches()) {
      coach.age += 1;
      coach.experience += 1;
      // Coaches sharpen early and plateau.
      if (coach.age < 55 && rng.bool(0.4)) {
        const key = rng.pick(['gameManagement', 'playCalling', 'development', 'adaptability', 'motivation']);
        coach.attrs[key] = clamp(coach.attrs[key] + rng.int(1, 3), 15, 99);
      }
      if (coach.age > 62 && rng.bool(remap(coach.age, 62, 75, 0.06, 0.6))) {
        retiredCoaches.push({ coach, team });
      }
    }
  }
  return retiredCoaches;
}
