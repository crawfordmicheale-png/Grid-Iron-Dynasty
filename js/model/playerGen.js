// Player generation.
//
// The hard part is producing ratings that (a) roll up to a requested overall,
// (b) look like a real player at that position rather than a flat block of
// identical numbers, and (c) keep physical tools anchored to the position --
// a 62-overall corner still runs a 4.4, he just cannot cover anybody.

import { Player, DEV_TIERS } from './player.js';
import { POSITIONS } from '../data/positions.js';
import { TRAITS, traitsFor, conflictsWith } from '../data/traits.js';
import { FIRST_NAMES, LAST_NAMES, COLLEGES, BLUE_CHIP_COLLEGES } from '../data/names.js';
import { clamp, remap, uid } from '../core/util.js';

// Physical tools are drawn from the position profile, not from the overall.
// Everything else is what the overall correction moves.
const ANCHORED = ['speed', 'accel', 'agility', 'strength', 'jumping'];

const JERSEY_RANGES = {
  QB: [[1, 19]], RB: [[20, 49], [1, 9]], FB: [[20, 49], [40, 49]],
  WR: [[10, 19], [80, 89], [1, 9]], TE: [[80, 89], [40, 49]],
  OT: [[60, 79]], OG: [[60, 79]], C: [[50, 79]],
  EDGE: [[90, 99], [50, 59]], DT: [[90, 99], [60, 79]],
  LB: [[40, 59], [90, 99]], CB: [[20, 39], [1, 9]], S: [[20, 49]],
  K: [[1, 19]], P: [[1, 19]], LS: [[40, 59]],
};

export function pickJersey(rng, pos, taken = new Set()) {
  const ranges = JERSEY_RANGES[pos] ?? [[1, 99]];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const [lo, hi] = ranges[Math.min(ranges.length - 1, Math.floor(rng.next() * ranges.length * 1.35))] ?? ranges[0];
    const n = rng.int(lo, hi);
    if (!taken.has(n)) return n;
  }
  for (let n = 1; n <= 99; n += 1) if (!taken.has(n)) return n;
  return 0;
}

export function pickName(rng, usedNames = new Set()) {
  for (let i = 0; i < 40; i += 1) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const full = `${first} ${last}`;
    if (!usedNames.has(full)) {
      usedNames.add(full);
      return { firstName: first, lastName: last };
    }
  }
  return { firstName: rng.pick(FIRST_NAMES), lastName: rng.pick(LAST_NAMES) };
}

// Body type, nudged by archetype. A nose tackle and a 3-tech are not the same
// shape even though they share a position key.
function generateBody(rng, pos, archetype) {
  const def = POSITIONS[pos];
  const [hMin, hMax] = def.body.height;
  const [wMin, wMax] = def.body.weight;
  // Height and weight correlate: taller players at a position tend heavier.
  const z = rng.gaussClamped(0, 1, -2.2, 2.2);
  const height = Math.round(remap(z, -2.2, 2.2, hMin, hMax));
  const wz = clamp(z * 0.55 + rng.gauss(0, 0.8), -2.2, 2.2);
  let weight = Math.round(remap(wz, -2.2, 2.2, wMin, wMax));

  if (archetype === 'nose' || archetype === 'stuffer') weight += rng.int(8, 22);
  if (archetype === 'threetech' || archetype === 'penetrator') weight -= rng.int(4, 14);
  if (archetype === 'speed' && pos === 'EDGE') weight -= rng.int(6, 16);
  if (archetype === 'power' && pos === 'EDGE') weight += rng.int(4, 14);
  if (archetype === 'bruiser') weight += rng.int(5, 15);
  if (archetype === 'deep' || archetype === 'gadget') weight -= rng.int(4, 12);
  if (archetype === 'x') weight += rng.int(4, 14);
  if (archetype === 'inline') weight += rng.int(5, 15);

  return { height: clamp(height, hMin - 1, hMax + 1), weight: clamp(weight, wMin - 15, wMax + 20) };
}

// Physical anchors. Correlated with overall but only loosely -- speed is mostly
// a gift, not a skill.
function generateAnchors(rng, pos, target, body) {
  const def = POSITIONS[pos];
  const [sLo, sHi] = def.speedBase;
  const overallPull = remap(target, 45, 95, -0.55, 0.75);
  const out = {};

  const sz = clamp(rng.gauss(overallPull, 0.85), -2.4, 2.4);
  out.speed = Math.round(clamp(remap(sz, -2.4, 2.4, sLo, sHi), 20, 99));
  out.accel = Math.round(clamp(out.speed + rng.gauss(0, 5), 20, 99));
  // Heavier players at a position are less agile.
  const [wMin, wMax] = def.body.weight;
  const heavyPenalty = remap(body.weight, wMin, wMax, 4, -6);
  out.agility = Math.round(clamp(out.speed * 0.75 + 18 + heavyPenalty + rng.gauss(0, 7), 20, 99));
  out.strength = Math.round(clamp(remap(body.weight, wMin, wMax, 46, 84) + rng.gauss(overallPull * 5, 8), 20, 99));
  out.jumping = Math.round(clamp(out.speed * 0.55 + 32 + rng.gauss(overallPull * 4, 8), 20, 99));
  return out;
}

// Shift every non-anchored weighted attribute by a constant until the weighted
// overall lands on target. Uniform shift preserves the archetype's shape.
function fitOverall(ratings, pos, target) {
  const def = POSITIONS[pos];
  const movable = Object.keys(def.weights).filter((a) => !ANCHORED.includes(a));
  const movableWeight = movable.reduce((s, a) => s + def.weights[a], 0);
  if (movableWeight <= 0) return;

  for (let iter = 0; iter < 14; iter += 1) {
    let cur = 0;
    for (const [a, w] of Object.entries(def.weights)) cur += (ratings[a] ?? 40) * w;
    const diff = target - cur;
    if (Math.abs(diff) < 0.35) break;
    const delta = diff / movableWeight;
    let anyRoom = false;
    for (const a of movable) {
      const before = ratings[a];
      ratings[a] = clamp(before + delta, 12, 99);
      if (ratings[a] !== before) anyRoom = true;
    }
    if (!anyRoom) break;
  }
  for (const a of Object.keys(ratings)) ratings[a] = Math.round(clamp(ratings[a], 12, 99));
}

function generateTraits(rng, pos, target, age) {
  const pool = traitsFor(pos);
  // Better players carry more good traits; that is partly *why* they are better.
  const goodBias = remap(target, 50, 92, 0.35, 0.72);
  let count = 1;
  const roll = rng.next();
  if (roll > 0.80) count = 3;
  else if (roll > 0.42) count = 2;
  if (rng.next() < 0.05) count = 4;

  const chosen = [];
  for (let i = 0; i < count * 5 && chosen.length < count; i += 1) {
    const wantGood = rng.next() < goodBias;
    const candidates = pool.filter((k) => {
      if (chosen.includes(k)) return false;
      if (conflictsWith(k, chosen)) return false;
      const g = TRAITS[k].good;
      if (g === null) return true;
      return g === wantGood;
    });
    if (!candidates.length) continue;
    chosen.push(rng.weighted(candidates, (k) => TRAITS[k].weight));
  }
  // Veterans have had time to be figured out; rookies get the raw tag more often.
  if (age <= 22 && rng.next() < 0.22 && !conflictsWith('raw', chosen) && !chosen.includes('raw')) {
    chosen.push('raw');
  }
  return chosen;
}

// Apply an archetype's skew, then trait flat modifiers.
function applySkews(ratings, pos, archetypeKey, traits) {
  const def = POSITIONS[pos];
  const arch = def.archetypes.find((a) => a.key === archetypeKey);
  if (arch) {
    for (const [attr, delta] of Object.entries(arch.skew)) {
      if (ratings[attr] !== undefined) ratings[attr] = clamp(ratings[attr] + delta, 12, 99);
    }
  }
  for (const t of traits) {
    const flat = TRAITS[t]?.effects?.attr;
    if (!flat) continue;
    for (const [attr, delta] of Object.entries(flat)) {
      if (ratings[attr] !== undefined) ratings[attr] = clamp(ratings[attr] + delta, 12, 99);
    }
  }
}

// Ceilings. Young high-dev players have real room; a 31-year-old has none.
function generateCaps(rng, ratings, pos, age, dev) {
  const tier = DEV_TIERS[dev];
  const caps = {};
  const youth = clamp(remap(age, 21, 30, 1.0, 0.0), 0, 1);
  const base = youth * tier.mult * 14;
  for (const [attr, val] of Object.entries(ratings)) {
    // Mental attributes keep growing later into a career than physical ones.
    const mentalBonus = MENTAL_ROOM.has(attr) ? 5 * clamp(remap(age, 22, 32, 1, 0.25), 0, 1) : 0;
    const room = Math.max(0, base * rng.float(0.35, 1.5) + mentalBonus + rng.gauss(0, 2));
    caps[attr] = Math.round(clamp(val + room, val, 99));
  }
  return caps;
}

const MENTAL_ROOM = new Set([
  'awareness', 'playRecognition', 'discipline', 'composure', 'progression',
  'pocketPresence', 'decision', 'vision', 'gapDiscipline', 'zoneCover',
  'handTech', 'anchor', 'routeShort', 'routeMid', 'playAction', 'snapAccuracy',
  'blockShed', 'runStop', 'passBlock', 'runBlock',
]);

/**
 * @param {RNG} rng
 * @param {object} opts
 *   pos        position key (required)
 *   overall    target overall; defaults to a league-average draw
 *   age        defaults to a realistic distribution
 *   dev        development tier key; defaults to a weighted draw
 *   archetype  forced archetype key
 *   usedNames  Set of "First Last" already in use
 *   takenNumbers Set of jersey numbers already in use
 */
export function generatePlayer(rng, opts = {}) {
  const pos = opts.pos ?? 'WR';
  const def = POSITIONS[pos];
  const target = opts.overall ?? clamp(rng.gauss(70, 9), 42, 99);
  const age = opts.age ?? Math.round(clamp(rng.gauss(26, 3.4), 21, 39));

  const dev = opts.dev ?? rng.weighted(Object.keys(DEV_TIERS), (k) => DEV_TIERS[k].weight);
  const archetype = opts.archetype ?? rng.pick(def.archetypes).key;
  const { firstName, lastName } = pickName(rng, opts.usedNames ?? new Set());
  const body = generateBody(rng, pos, archetype);

  // Base pass: everything the position cares about starts near the target, with
  // spread, so no two players at the same overall have the same profile.
  const ratings = {};
  const spread = remap(target, 45, 95, 9, 6.5);
  for (const attr of def.attrs) {
    if (def.weights[attr] !== undefined) {
      ratings[attr] = clamp(rng.gauss(target, spread), 12, 99);
    } else {
      // Attributes outside the overall formula: generic, position-flavoured.
      ratings[attr] = clamp(rng.gauss(target * 0.72 + 14, 11), 12, 99);
    }
  }

  const anchors = generateAnchors(rng, pos, target, body);
  Object.assign(ratings, anchors);

  // Universal mental/condition attributes that are not scored by the overall.
  ratings.durability = clamp(rng.gauss(72, 13), 20, 99);
  ratings.toughness = clamp(rng.gauss(72, 11), 25, 99);
  ratings.stamina = clamp(rng.gauss(74, 10), 30, 99);
  ratings.workEthic = clamp(rng.gauss(70, 13), 20, 99);
  ratings.discipline = clamp(rng.gauss(72, 12), 20, 99);
  // Awareness tracks experience as much as talent.
  ratings.awareness = clamp(ratings.awareness * 0.7 + remap(age, 21, 32, 45, 82) * 0.3, 12, 99);

  const traits = opts.traits ?? generateTraits(rng, pos, target, age);
  applySkews(ratings, pos, archetype, traits);
  fitOverall(ratings, pos, target);

  const caps = generateCaps(rng, ratings, pos, age, dev);

  const eliteCollege = target > 78 && rng.bool(0.45);
  const college = opts.college ?? (eliteCollege ? rng.pick(BLUE_CHIP_COLLEGES) : rng.pick(COLLEGES));

  const player = new Player({
    id: opts.id ?? uid('p'),
    firstName, lastName, pos, archetype, age,
    exp: opts.exp ?? Math.max(0, age - 22),
    college,
    height: body.height, weight: body.weight,
    jersey: pickJersey(rng, pos, opts.takenNumbers ?? new Set()),
    ratings, caps, dev, traits,
    teamId: opts.teamId ?? null,
    draft: opts.draft ?? null,
    morale: opts.morale ?? clamp(rng.gauss(70, 10), 30, 95),
  });
  opts.takenNumbers?.add(player.jersey);
  return player;
}
