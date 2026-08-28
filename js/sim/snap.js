// One snap, start to finish: pre-snap penalties, the play itself, post-play
// flags, fatigue, injuries, and the box score.

import { resolvePass } from './pass.js';
import { resolveRun } from './run.js';
import { offensivePersonnel, defensivePersonnel, assignCoverage } from './personnel.js';
import { remap, round } from '../core/util.js';

// --- Penalties --------------------------------------------------------------
// Rates are per-snap probabilities before player discipline is applied. They
// are set so a game lands near the real average of 12-13 accepted penalties.

export const PENALTIES = {
  falseStart: { key: 'falseStart', name: 'False Start', on: 'OFF', yards: -5, preSnap: true, replay: true, rate: 0.01518, pos: ['OT', 'OG', 'C', 'TE'] },
  offside: { key: 'offside', name: 'Offside', on: 'DEF', yards: 5, preSnap: true, replay: true, rate: 0.00792, pos: ['EDGE', 'DT'] },
  delayOfGame: { key: 'delayOfGame', name: 'Delay of Game', on: 'OFF', yards: -5, preSnap: true, replay: true, rate: 0.00462, pos: ['QB'] },
  neutralZone: { key: 'neutralZone', name: 'Neutral Zone Infraction', on: 'DEF', yards: 5, preSnap: true, replay: true, rate: 0.00396, pos: ['EDGE', 'DT'] },
  illegalFormation: { key: 'illegalFormation', name: 'Illegal Formation', on: 'OFF', yards: -5, preSnap: true, replay: true, rate: 0.00264, pos: ['WR', 'TE'] },

  offensiveHolding: { key: 'offensiveHolding', name: 'Offensive Holding', on: 'OFF', yards: -10, negates: true, rate: 0.02178, pos: ['OT', 'OG', 'C', 'TE'] },
  defensiveHolding: { key: 'defensiveHolding', name: 'Defensive Holding', on: 'DEF', yards: 5, autoFirst: true, rate: 0.00726, pos: ['CB', 'S', 'LB'] },
  passInterference: { key: 'passInterference', name: 'Defensive Pass Interference', on: 'DEF', yards: 'spot', autoFirst: true, rate: 0.01452, passOnly: true, pos: ['CB', 'S', 'LB'] },
  illegalContact: { key: 'illegalContact', name: 'Illegal Contact', on: 'DEF', yards: 5, autoFirst: true, rate: 0.00462, passOnly: true, pos: ['CB'] },
  offensivePI: { key: 'offensivePI', name: 'Offensive Pass Interference', on: 'OFF', yards: -10, negates: true, rate: 0.00462, passOnly: true, pos: ['WR', 'TE'] },
  faceMask: { key: 'faceMask', name: 'Facemask', on: 'DEF', yards: 15, autoFirst: true, rate: 0.0037, pos: ['LB', 'DT', 'EDGE', 'S'] },
  roughingPasser: { key: 'roughingPasser', name: 'Roughing the Passer', on: 'DEF', yards: 15, autoFirst: true, rate: 0.00528, passOnly: true, pos: ['EDGE', 'DT'] },
  unnecessaryRoughness: { key: 'unnecessaryRoughness', name: 'Unnecessary Roughness', on: 'DEF', yards: 15, autoFirst: true, rate: 0.00396, pos: ['S', 'LB', 'CB'] },
  illegalBlock: { key: 'illegalBlock', name: 'Illegal Block in the Back', on: 'OFF', yards: -10, negates: true, rate: 0.00396, pos: ['WR', 'RB'] },
};

const PENALTY_KEYS = Object.keys(PENALTIES);

function penaltyCandidates(personnel, positions) {
  const pool = personnel.all.filter((p) => positions.includes(p.pos));
  return pool.length ? pool : personnel.all;
}

/**
 * Roll for a penalty. `phase` is 'pre' or 'post'. A player's discipline rating
 * and his coach's discipline both suppress the rate.
 */
export function rollPenalty(sim, phase, isPass) {
  const { rng, offense, defense, ctx } = sim;
  for (const key of PENALTY_KEYS) {
    const pen = PENALTIES[key];
    if (phase === 'pre' ? !pen.preSnap : pen.preSnap) continue;
    if (pen.passOnly && !isPass) continue;

    const side = pen.on === 'OFF' ? offense : defense;
    const candidates = penaltyCandidates(side, pen.pos);
    if (!candidates.length) continue;
    const culprit = rng.pick(candidates);

    let rate = pen.rate;
    rate *= culprit.traitMult('penaltyMult');
    rate *= remap(culprit.eff('discipline', ctx), 35, 95, 1.9, 0.35);
    const coachDiscipline = pen.on === 'OFF' ? (sim.offCoachDiscipline ?? 60) : (sim.defCoachDiscipline ?? 60);
    rate *= remap(coachDiscipline, 35, 95, 1.25, 0.75);
    // Crowd noise causes false starts on the road.
    if (key === 'falseStart' && pen.on === 'OFF') rate *= 1 + (sim.crowdNoise ?? 0) * 2.4;

    if (rng.next() < rate) {
      return { ...pen, player: culprit, side: pen.on };
    }
  }
  return null;
}

// --- Fatigue and injuries ---------------------------------------------------

// Linemen work hardest on every snap; a receiver running a deep route works
// hard on that one.
const EXERTION = {
  OT: 1.15, OG: 1.15, C: 1.1, DT: 1.3, EDGE: 1.25, LB: 1.0,
  RB: 1.05, FB: 1.1, WR: 0.85, TE: 1.0, CB: 0.9, S: 0.85, QB: 0.5,
  K: 0.1, P: 0.1, LS: 0.1,
};

export function applyFatigue(sim, result) {
  const { offense, defense, altitudeMult = 1 } = sim;
  const intensity = result.type === 'run' || result.isRun ? 1.0 : 1.15;
  for (const p of offense.all) {
    p.drainStamina(3.1 * (EXERTION[p.pos] ?? 1) * intensity);
    p.snapCount += 1;
  }
  for (const p of defense.all) {
    p.drainStamina(3.3 * (EXERTION[p.pos] ?? 1) * intensity * altitudeMult);
    p.snapCount += 1;
  }

  // Carrying the ball is not the same as running a route. The man who took the
  // hit wears down far faster than the ten around him, which is what puts a
  // second back on the field -- without this a workhorse takes every snap of
  // every game and posts a season nobody has ever had.
  if (result.rusher) result.rusher.drainStamina(2.9);
  if (result.target && result.complete) result.target.drainStamina(2.2);
  if (result.tackledBy) result.tackledBy.drainStamina(1.6);
}

export const INJURY_TYPES = [
  { name: 'ankle sprain', weeks: [0, 3], severity: 0.35, weight: 16 },
  { name: 'hamstring strain', weeks: [1, 4], severity: 0.4, weight: 14 },
  { name: 'knee sprain', weeks: [1, 6], severity: 0.55, weight: 10 },
  { name: 'shoulder sprain', weeks: [0, 3], severity: 0.35, weight: 10 },
  { name: 'concussion', weeks: [1, 3], severity: 0.5, weight: 8 },
  { name: 'hip pointer', weeks: [0, 2], severity: 0.3, weight: 7 },
  { name: 'groin strain', weeks: [1, 3], severity: 0.35, weight: 7 },
  { name: 'high ankle sprain', weeks: [2, 6], severity: 0.5, weight: 6 },
  { name: 'rib injury', weeks: [1, 4], severity: 0.4, weight: 6 },
  { name: 'hand fracture', weeks: [2, 6], severity: 0.45, weight: 4 },
  { name: 'MCL tear', weeks: [4, 9], severity: 0.75, weight: 3 },
  { name: 'broken collarbone', weeks: [5, 10], severity: 0.8, weight: 2 },
  { name: 'torn ACL', weeks: [26, 40], severity: 1.0, weight: 1.4, seasonEnding: true },
  { name: 'Achilles rupture', weeks: [30, 44], severity: 1.0, weight: 0.8, seasonEnding: true },
  { name: 'torn pectoral', weeks: [8, 16], severity: 0.85, weight: 1 },
];

// Per exposed player per snap. Calibrated so a club carries roughly five or six
// unavailable players at a time across a season, which is what makes depth,
// the practice squad, and a backup quarterback worth paying for.
const BASE_INJURY_RATE = 0.00125;

// How exposed a position is on a normal snap, before direct involvement. The
// trenches are a car crash every down; a corner in off coverage mostly runs.
const POSITION_EXPOSURE = {
  OT: 1.5, OG: 1.6, C: 1.5, DT: 1.7, EDGE: 1.5, LB: 1.15,
  RB: 1.2, FB: 1.3, TE: 1.2, WR: 0.85, CB: 0.8, S: 0.85, QB: 0.55,
  K: 0.05, P: 0.05, LS: 0.2,
};

export function rollInjuries(sim, result) {
  const { rng, offense, defense } = sim;
  const injured = [];

  // Everybody on the field is exposed. Restricting this to the six players who
  // touched the ball meant corners and safeties were nearly unbreakable, and it
  // capped how many men a club could have in the training room no matter how
  // the rate was tuned -- the same handful were rolled over and over.
  const involved = new Set();
  const mark = (p) => p && involved.add(p);
  mark(result.rusher); mark(result.target); mark(result.tackledBy); mark(result.sackedBy);
  mark(result.passer); mark(result.interceptedBy);

  for (const p of [...offense.all, ...defense.all]) {
    if (!p || p.injury) continue;
    let rate = BASE_INJURY_RATE * (POSITION_EXPOSURE[p.pos] ?? 1);
    // Being in the collision is the dangerous part of any given snap.
    if (involved.has(p)) rate *= 2.6;
    rate *= p.traitMult('injuryMult');
    rate *= remap(p.rating('durability'), 35, 95, 2.0, 0.45);
    // Tired players get hurt.
    rate *= remap(p.fatigue, 20, 100, 1.7, 0.85);
    rate *= sim.injuryPreventionMult ?? 1;
    if (result.type === 'sack' && p === result.passer) rate *= 2.2;
    if (result.yards > 15 && involved.has(p)) rate *= 1.25;

    if (rng.next() < rate) {
      const type = rng.weighted(INJURY_TYPES, (t) => t.weight);
      const weeks = rng.int(type.weeks[0], type.weeks[1]);
      p.injury = {
        name: type.name,
        weeksOut: weeks,
        severity: type.severity,
        seasonEnding: type.seasonEnding ?? false,
        // A player can be active but limited.
        partial: weeks === 0 ? Math.round(type.severity * 12) : 0,
      };
      injured.push({ player: p, injury: p.injury });
    }
  }
  return injured;
}

// --- Stats ------------------------------------------------------------------

export function recordStats(result) {
  const r = result;
  if (r.type === 'complete') {
    r.passer.addStat('passAtt'); r.passer.addStat('passCmp'); r.passer.addStat('passYds', r.yards);
    r.target.addStat('rec'); r.target.addStat('targets'); r.target.addStat('recYds', r.yards);
    r.target.addStat('yac', r.yac ?? 0);
    if (r.touchdown) { r.passer.addStat('passTD'); r.target.addStat('recTD'); }
    r.tackledBy?.addStat('tackles');
  } else if (r.type === 'incomplete') {
    r.passer.addStat('passAtt');
    r.target?.addStat('targets');
    if (r.dropped) r.target?.addStat('drops');
    if (r.brokenUpBy) r.brokenUpBy.addStat('passDef');
  } else if (r.type === 'interception') {
    r.passer.addStat('passAtt'); r.passer.addStat('passInt');
    r.target?.addStat('targets');
    r.interceptedBy?.addStat('int');
    r.interceptedBy?.addStat('intRetYds', r.returnYards ?? 0);
  } else if (r.type === 'sack') {
    r.passer.addStat('sacked'); r.passer.addStat('sackYds', -r.yards);
    r.sackedBy?.addStat('sacks');
    r.sackedBy?.addStat('tackles');
  } else if (r.type === 'throwaway') {
    r.passer.addStat('passAtt');
  } else if (r.type === 'run' || r.type === 'scramble') {
    r.rusher.addStat('rushAtt'); r.rusher.addStat('rushYds', r.yards);
    if (r.touchdown) r.rusher.addStat('rushTD');
    if (r.yards >= 10) r.rusher.addStat('rush10plus');
    r.tackledBy?.addStat('tackles');
  }
  if (r.fumble) {
    const carrier = r.rusher ?? r.target ?? r.passer;
    carrier?.addStat('fumbles');
  }
}

// --- The snap ---------------------------------------------------------------

/**
 * Run one snap.
 * @param {object} cfg
 *   rng, offTeam, defTeam, play, defCall, ctx, situation
 */
export function runSnap(cfg) {
  const { rng, offTeam, defTeam, play, defCall, ctx } = cfg;

  const offense = offensivePersonnel(offTeam, play.formation);
  const defense = defensivePersonnel(defTeam, defCall, play.personnel);
  const coverage = assignCoverage(offense, defense, rng);

  const sim = {
    rng, offense, defense, play, defCall, ctx, coverage,
    offTeam, defTeam,
    crowdNoise: cfg.crowdNoise ?? 0,
    aggression: cfg.aggression ?? 0,
    desperation: cfg.desperation ?? 0,
    runGameCredibility: cfg.runGameCredibility ?? 55,
    // How well this play was practised this week. Without this the whole
    // install system is decorative: the game plan changes nothing on the field.
    execution: cfg.execution ?? 1,
    toGoal: cfg.toGoal ?? 50,
    offCoachDiscipline: offTeam.staff?.HC?.attr('discipline') ?? 60,
    defCoachDiscipline: defTeam.staff?.HC?.attr('discipline') ?? 60,
    injuryPreventionMult: cfg.injuryPreventionMult ?? 1,
    altitudeMult: cfg.altitudeMult ?? 1,
  };

  // Pre-snap flag: the play never happens.
  const preFlag = rollPenalty(sim, 'pre', play.type === 'pass');
  if (preFlag) {
    return {
      type: 'penalty', penalty: preFlag, yards: 0, noPlay: true,
      clockStops: true, offense, defense,
      narrative: `${preFlag.name} on ${preFlag.player.shortName}.`,
    };
  }

  const result = play.type === 'pass' ? resolvePass(sim) : resolveRun(sim);
  result.offense = offense;
  result.defense = defense;
  result.play = play;
  result.defCall = defCall;

  // Post-play flag. A holding call wipes out whatever just happened; a defensive
  // flag is usually declined if the play gained more than the penalty.
  const postFlag = rollPenalty(sim, 'post', play.type === 'pass');
  if (postFlag) {
    result.penalty = postFlag;
    // Roughing the passer only applies if he actually threw or was hit.
    if (postFlag.key === 'roughingPasser' && !['sack', 'complete', 'incomplete', 'interception'].includes(result.type)) {
      delete result.penalty;
    }
  }

  applyFatigue(sim, result);
  result.injuries = rollInjuries(sim, result);

  return result;
}
