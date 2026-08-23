// The Player: ratings, the ceiling on those ratings, condition, and everything
// the front office tracks about him.
//
// A rating is never read raw by the simulation. Every read goes through
// `eff()`, which folds in fatigue, injury, scheme fit, morale, traits, and the
// situation -- so the same player is genuinely a different player in sleet, in
// the fourth quarter, on a bad ankle, in a scheme that does not suit him.

import { POSITIONS, POSITION_FLEX } from '../data/positions.js';
import { TRAITS } from '../data/traits.js';
import { clamp, round, remap } from '../core/util.js';

// Development tiers gate how much of the ceiling a player actually reaches and
// how fast he gets there.
export const DEV_TIERS = {
  slow: { key: 'slow', name: 'Slow', mult: 0.62, weight: 22 },
  normal: { key: 'normal', name: 'Normal', mult: 1.0, weight: 50 },
  quick: { key: 'quick', name: 'Quick', mult: 1.4, weight: 20 },
  star: { key: 'star', name: 'Star', mult: 1.85, weight: 6 },
  elite: { key: 'elite', name: 'Generational', mult: 2.4, weight: 2 },
};

// How strongly rating differences translate into on-field outcomes.
//
// Every phase of a snap reads ratings, and a stronger team is stronger in all
// of them at once, so a linear reading compounds: a thirteen-point roster gap
// produced a twenty-four point average margin, where the real league produces
// about eleven. Compressing toward the league mean keeps a 95 clearly better
// than a 70 while stopping the advantage from multiplying itself five times
// over in a single play. This is the master dial on league parity.
export const TALENT_MEAN = 70;
export const TALENT_COMPRESSION = 0.46;

export function compressRating(v) {
  return TALENT_MEAN + (v - TALENT_MEAN) * TALENT_COMPRESSION;
}

// Age curve: fraction of physical prime available at a given age.
// Peak 25-27, gentle rise before, real decline after 30.
export function ageFactor(age, shift = 0) {
  const a = age - shift;
  if (a <= 21) return 0.9;
  if (a <= 27) return remap(a, 21, 27, 0.9, 1.0);
  if (a <= 30) return remap(a, 27, 30, 1.0, 0.97);
  if (a <= 33) return remap(a, 30, 33, 0.97, 0.9);
  return Math.max(0.66, remap(a, 33, 38, 0.9, 0.7));
}

export class Player {
  constructor(data = {}) {
    this.id = data.id ?? '';
    this.firstName = data.firstName ?? '';
    this.lastName = data.lastName ?? '';
    this.pos = data.pos ?? 'WR';
    this.archetype = data.archetype ?? '';
    this.age = data.age ?? 24;
    this.exp = data.exp ?? 0;            // accrued seasons
    this.college = data.college ?? '';
    this.height = data.height ?? 72;     // inches
    this.weight = data.weight ?? 220;    // pounds
    this.jersey = data.jersey ?? 0;
    this.draft = data.draft ?? null;     // {year, round, pick, teamId} or null (UDFA)

    this.ratings = data.ratings ?? {};
    this.caps = data.caps ?? {};         // per-attribute ceiling
    this.dev = data.dev ?? 'normal';
    this.traits = data.traits ?? [];

    this.teamId = data.teamId ?? null;
    this.contract = data.contract ?? null;

    // Condition
    this.fatigue = data.fatigue ?? 100;  // 100 = fresh
    this.morale = data.morale ?? 70;     // 0-100
    this.injury = data.injury ?? null;   // {name, weeksOut, severity, partial}
    this.snapCount = data.snapCount ?? 0;

    this.stats = data.stats ?? {};
    this.playoffStats = data.playoffStats ?? {};
    this.careerStats = data.careerStats ?? {};
    this.accolades = data.accolades ?? [];
    this.history = data.history ?? [];

    // Scouting fog: what the front office *thinks* the ratings are. Null once
    // he has played enough for the coaching staff to know for sure.
    this.scouted = data.scouted ?? null;

    this._ovrCache = null;
    this._ovrKey = '';
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }

  get shortName() {
    return `${this.firstName[0] ?? ''}. ${this.lastName}`;
  }

  get def() {
    return POSITIONS[this.pos];
  }

  get archetypeName() {
    return this.def.archetypes.find((a) => a.key === this.archetype)?.name ?? '';
  }

  get available() {
    return !this.injury || this.injury.weeksOut <= 0;
  }

  get devTier() {
    return DEV_TIERS[this.dev] ?? DEV_TIERS.normal;
  }

  hasTrait(key) {
    return this.traits.includes(key);
  }

  rating(attr) {
    return this.ratings[attr] ?? 40;
  }

  cap(attr) {
    return this.caps[attr] ?? this.rating(attr);
  }

  // Headroom left at this attribute, 0..1.
  growthRoom(attr) {
    const c = this.cap(attr);
    const r = this.rating(attr);
    return c <= r ? 0 : (c - r) / Math.max(1, 99 - r);
  }

  // --- Overall ---------------------------------------------------------------

  overall(position = this.pos) {
    const key = `${position}:${JSON.stringify(this.ratings).length}:${this.ratings.awareness}:${this.ratings.speed}`;
    if (this._ovrCache !== null && this._ovrKey === key) return this._ovrCache;
    const val = this.computeOverall(position);
    this._ovrCache = val;
    this._ovrKey = key;
    return val;
  }

  computeOverall(position = this.pos) {
    const def = POSITIONS[position];
    if (!def) return 40;
    let total = 0;
    for (const [attr, w] of Object.entries(def.weights)) total += this.rating(attr) * w;
    // Out-of-position penalty, on top of simply grading him on the wrong weights.
    if (position !== this.pos) {
      const flex = POSITION_FLEX[this.pos]?.[position];
      total -= flex ?? 20;
    }
    return clamp(Math.round(total), 20, 99);
  }

  // What he would be if he hit every ceiling.
  potentialOverall(position = this.pos) {
    const def = POSITIONS[position];
    if (!def) return 40;
    let total = 0;
    for (const [attr, w] of Object.entries(def.weights)) total += this.cap(attr) * w;
    return clamp(Math.round(total), 20, 99);
  }

  invalidate() {
    this._ovrCache = null;
  }

  // --- Effective rating ------------------------------------------------------

  // ctx: { late, pressure, weather, bigGame, scheme, physical }
  eff(attr, ctx = {}) {
    let v = this.rating(attr);

    // Trait situational modifiers.
    for (const key of this.traits) {
      const e = TRAITS[key]?.effects;
      if (!e) continue;
      if (ctx.late && e.late?.[attr]) v += e.late[attr];
      if (ctx.pressure && e.pressure?.[attr]) v += e.pressure[attr];
      if (ctx.weather && e.weather?.[attr]) v += e.weather[attr] * ctx.weather;
      if (ctx.bigGame && e.bigGame?.[attr]) v += e.bigGame[attr];
      if (e.gameDay?.[attr]) v += e.gameDay[attr];
    }

    // Fatigue. Physical attributes bleed first; a high stamina rating buys time.
    const isPhysical = PHYSICAL_EFFORT.has(attr);
    if (isPhysical && this.fatigue < 100) {
      const resist = remap(this.rating('stamina'), 40, 99, 1.0, 0.55);
      const drop = ((100 - this.fatigue) / 100) * 24 * resist;
      v -= drop;
    } else if (this.fatigue < 60) {
      v -= ((60 - this.fatigue) / 60) * 6; // even the mental side slips when gassed
    }

    // Playing through an injury.
    if (this.injury?.partial) v -= this.injury.partial;

    // Scheme fit: a plus or minus few points across the board.
    if (ctx.scheme !== undefined) v += ctx.scheme;

    // Morale, mild but real.
    v += remap(this.morale, 0, 100, -5, 3);

    return clamp(compressRating(v), 5, 99);
  }

  // --- Condition -------------------------------------------------------------

  drainStamina(amount) {
    let mult = 1;
    for (const key of this.traits) {
      const m = TRAITS[key]?.effects?.fatigueMult;
      if (m) mult *= m;
    }
    const resist = remap(this.rating('stamina'), 40, 99, 1.25, 0.6);
    this.fatigue = clamp(this.fatigue - amount * mult * resist, 0, 100);
  }

  recover(amount) {
    const rate = remap(this.rating('stamina'), 40, 99, 0.8, 1.3);
    this.fatigue = clamp(this.fatigue + amount * rate, 0, 100);
  }

  // Multiplier product across traits for a named rate (fumbleMult, intMult, ...).
  traitMult(key) {
    let m = 1;
    for (const t of this.traits) {
      const v = TRAITS[t]?.effects?.[key];
      if (typeof v === 'number') m *= v;
    }
    return m;
  }

  // Additive value across traits for a named scalar (aggression, mismatchBonus).
  traitSum(key) {
    let s = 0;
    for (const t of this.traits) {
      const v = TRAITS[t]?.effects?.[key];
      if (typeof v === 'number') s += v;
    }
    return s;
  }

  // --- Stats -----------------------------------------------------------------

  addStat(key, value = 1) {
    this.stats[key] = (this.stats[key] || 0) + value;
  }

  stat(key) {
    return this.stats[key] || 0;
  }

  rollSeasonStats() {
    for (const [k, v] of Object.entries(this.stats)) {
      this.careerStats[k] = (this.careerStats[k] || 0) + v;
    }
    this.stats = {};
  }

  // --- Serialization ---------------------------------------------------------

  toJSON() {
    return {
      id: this.id, firstName: this.firstName, lastName: this.lastName, pos: this.pos,
      archetype: this.archetype, age: this.age, exp: this.exp, college: this.college,
      height: this.height, weight: this.weight, jersey: this.jersey, draft: this.draft,
      ratings: this.ratings, caps: this.caps, dev: this.dev, traits: this.traits,
      teamId: this.teamId, contract: this.contract, fatigue: round(this.fatigue, 1),
      morale: round(this.morale, 1), injury: this.injury, snapCount: this.snapCount,
      stats: this.stats, playoffStats: this.playoffStats,
      careerStats: this.careerStats, accolades: this.accolades,
      history: this.history, scouted: this.scouted,
    };
  }

  static fromJSON(data) {
    return new Player(data);
  }
}

// Attributes that degrade with in-game exertion.
const PHYSICAL_EFFORT = new Set([
  'speed', 'accel', 'agility', 'strength', 'jumping', 'burst', 'elusiveness',
  'breakTackle', 'power', 'rushPower', 'rushFinesse', 'getOff', 'blockShed',
  'pursuit', 'passBlock', 'runBlock', 'anchor', 'press', 'tackle', 'hitPower',
  'release', 'scramble', 'leadBlock', 'pullBlock', 'runStop', 'deepRange',
]);

export { PHYSICAL_EFFORT };
