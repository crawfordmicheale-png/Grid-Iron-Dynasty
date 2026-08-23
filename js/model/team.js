// A club: roster, depth chart, staff, gameplan, money, and the owner's patience.

import { POSITIONS, ROSTER_BLUEPRINT, POSITION_KEYS } from '../data/positions.js';
import { TEAM_BY_ID } from '../data/teams.js';
import { OFFENSIVE_SCHEMES, DEFENSIVE_SCHEMES, schemeFit } from '../data/schemes.js';
import { staffList, positionCoachFor } from './staff.js';
import { capForYear } from './contract.js';
import { clamp, mean, byDesc, round } from '../core/util.js';

export const ROSTER_LIMIT = 53;
export const GAMEDAY_ACTIVE = 48;

export class Team {
  constructor(data = {}) {
    this.id = data.id;
    Object.assign(this, TEAM_BY_ID[this.id] ?? {});
    this.roster = data.roster ?? [];              // Player[]
    this.practiceSquad = data.practiceSquad ?? [];
    this.injuredReserve = data.injuredReserve ?? [];
    this.staff = data.staff ?? {};
    this.depthChart = data.depthChart ?? {};
    this.gameplan = data.gameplan ?? null;

    this.record = data.record ?? { w: 0, l: 0, t: 0, divW: 0, divL: 0, divT: 0, confW: 0, confL: 0, confT: 0, pf: 0, pa: 0 };
    this.streak = data.streak ?? 0;
    this.seasonStats = data.seasonStats ?? {};
    this.gameLog = data.gameLog ?? [];

    this.draftPicks = data.draftPicks ?? [];      // {year, round, originalTeam}
    this.deadMoney = data.deadMoney ?? {};        // leagueYear -> amount
    this.chemistry = data.chemistry ?? 60;
    this.ownerPatience = data.ownerPatience ?? 60;
    this.ownerGoals = data.ownerGoals ?? [];
    this.history = data.history ?? [];
    this.isUserTeam = data.isUserTeam ?? false;
  }

  get fullName() {
    return `${this.city} ${this.name}`;
  }

  get offScheme() {
    return OFFENSIVE_SCHEMES[this.staff.OC?.offScheme ?? 'PRO_STYLE'];
  }

  get defScheme() {
    return DEFENSIVE_SCHEMES[this.staff.DC?.defScheme ?? 'FOUR_THREE'];
  }

  get wins() { return this.record.w; }
  get losses() { return this.record.l; }
  get ties() { return this.record.t; }

  get winPct() {
    const g = this.record.w + this.record.l + this.record.t;
    return g === 0 ? 0 : (this.record.w + this.record.t * 0.5) / g;
  }

  get recordString() {
    return this.record.t ? `${this.record.w}-${this.record.l}-${this.record.t}` : `${this.record.w}-${this.record.l}`;
  }

  // --- Roster ---------------------------------------------------------------

  activeRoster() {
    return this.roster.filter((p) => !this.injuredReserve.includes(p.id));
  }

  playersAt(pos) {
    return this.roster.filter((p) => p.pos === pos);
  }

  findPlayer(id) {
    return this.roster.find((p) => p.id === id)
      ?? this.practiceSquad.find((p) => p.id === id)
      ?? null;
  }

  addPlayer(player) {
    player.teamId = this.id;
    this.roster.push(player);
    return player;
  }

  removePlayer(playerId) {
    const i = this.roster.findIndex((p) => p.id === playerId);
    if (i < 0) return null;
    const [p] = this.roster.splice(i, 1);
    p.teamId = null;
    this.rebuildDepthChart();
    return p;
  }

  positionCounts() {
    const counts = {};
    for (const k of POSITION_KEYS) counts[k] = 0;
    for (const p of this.roster) counts[p.pos] = (counts[p.pos] ?? 0) + 1;
    return counts;
  }

  // Positions where the roster is thinner than the blueprint. Drives the AI's
  // free agency and draft priorities.
  positionNeeds() {
    const counts = this.positionCounts();
    const needs = [];
    for (const [pos, want] of Object.entries(ROSTER_BLUEPRINT)) {
      const have = counts[pos] ?? 0;
      // Some positions have no nominal starter in the base look (fullback), so
      // fall back to the best man on the roster rather than reading zero and
      // reporting a crisis at a spot nobody starts.
      const starters = this.startersAt(pos);
      const pool = starters.length ? starters : this.playersAt(pos).slice(0, 1);
      const quality = pool.length ? mean(pool, (p) => p.overall()) : 55;
      const countGap = Math.max(0, want - have);
      // Measured against a good starter rather than an adequate one, so the
      // list still ranks a strong roster's relative soft spots.
      const qualityGap = Math.max(0, 82 - quality) / 7;
      // A hole at left tackle is not the same as a hole at long snapper.
      const importance = (UNIT_WEIGHT[pos] ?? 1) / 1.5;
      const score = (countGap * 2.2 + qualityGap) * importance;
      if (score > 0.15) needs.push({ pos, score: round(score, 2), have, want, quality: Math.round(quality) });
    }
    return needs.sort(byDesc((n) => n.score));
  }

  // --- Depth chart ----------------------------------------------------------

  // How valuable this player is to *this* team at this position: his overall,
  // adjusted for how well he fits the coordinator's scheme.
  depthValue(player, pos = player.pos) {
    const scheme = POSITIONS[pos].unit === 'DEF' ? this.defScheme : this.offScheme;
    const fit = schemeFit(player, scheme);
    const ovr = player.overall(pos);
    const healthy = player.available ? 0 : -25;
    return ovr + fit * 0.8 + healthy;
  }

  rebuildDepthChart(respectLocks = true) {
    const locks = respectLocks ? (this.depthChart.__locks ?? {}) : {};
    const chart = { __locks: locks };
    for (const pos of POSITION_KEYS) {
      const candidates = this.roster
        .filter((p) => p.pos === pos)
        .sort(byDesc((p) => this.depthValue(p, pos)));
      let ids = candidates.map((p) => p.id);
      // A locked slot means the coach has overridden the automatic order.
      const lockList = locks[pos];
      if (lockList?.length) {
        const locked = lockList.filter((id) => ids.includes(id));
        ids = [...locked, ...ids.filter((id) => !locked.includes(id))];
      }
      chart[pos] = ids;
    }
    this.depthChart = chart;
    return chart;
  }

  lockDepthSlot(pos, playerIds) {
    if (!this.depthChart.__locks) this.depthChart.__locks = {};
    this.depthChart.__locks[pos] = playerIds;
    this.rebuildDepthChart();
  }

  clearDepthLocks(pos = null) {
    if (!this.depthChart.__locks) return;
    if (pos) delete this.depthChart.__locks[pos];
    else this.depthChart.__locks = {};
    this.rebuildDepthChart();
  }

  // Nth player on the depth chart at a position, skipping the unavailable.
  depthAt(pos, index = 0, { healthyOnly = true } = {}) {
    const ids = this.depthChart[pos] ?? [];
    const players = ids.map((id) => this.findPlayer(id)).filter(Boolean);
    const pool = healthyOnly ? players.filter((p) => p.available) : players;
    return pool[index] ?? null;
  }

  startersAt(pos) {
    const want = STARTER_COUNT[pos] ?? 1;
    const out = [];
    for (let i = 0; i < want; i += 1) {
      const p = this.depthAt(pos, i);
      if (p) out.push(p);
    }
    return out;
  }

  allStarters() {
    return POSITION_KEYS.flatMap((pos) => this.startersAt(pos));
  }

  // --- Ratings --------------------------------------------------------------

  // Unit rating for the front office screens: starters weighted heavily,
  // depth counting for something because injuries happen.
  unitRating(unit) {
    const positions = POSITION_KEYS.filter((k) => POSITIONS[k].unit === unit);
    let acc = 0;
    let w = 0;
    for (const pos of positions) {
      const starters = this.startersAt(pos);
      const weight = UNIT_WEIGHT[pos] ?? 1;
      for (let i = 0; i < starters.length; i += 1) {
        const slotWeight = weight * (i === 0 ? 1 : 0.85);
        acc += this.depthValue(starters[i], pos) * slotWeight;
        w += slotWeight;
      }
      // Backup quality, lightly.
      const backup = this.depthAt(pos, starters.length);
      if (backup) {
        acc += this.depthValue(backup, pos) * weight * 0.18;
        w += weight * 0.18;
      }
    }
    return w > 0 ? Math.round(acc / w) : 50;
  }

  get offenseRating() { return this.unitRating('OFF'); }
  get defenseRating() { return this.unitRating('DEF'); }
  get specialTeamsRating() { return this.unitRating('ST'); }

  get overallRating() {
    return Math.round(this.offenseRating * 0.45 + this.defenseRating * 0.45 + this.specialTeamsRating * 0.10);
  }

  // --- Money ----------------------------------------------------------------

  capHitTotal(leagueYear) {
    const active = this.roster.reduce((s, p) => s + (p.contract?.capHit(leagueYear) ?? 0), 0);
    const ps = this.practiceSquad.reduce((s, p) => s + (p.contract?.capHit(leagueYear) ?? 0), 0);
    return active + ps + (this.deadMoney[leagueYear] ?? 0);
  }

  capSpace(leagueYear, yearsFromStart = leagueYear) {
    return capForYear(yearsFromStart) - this.capHitTotal(leagueYear);
  }

  addDeadMoney(leagueYear, amount) {
    this.deadMoney[leagueYear] = (this.deadMoney[leagueYear] ?? 0) + amount;
  }

  // --- Staff ----------------------------------------------------------------

  coachFor(player) {
    return positionCoachFor(this.staff, POSITIONS[player.pos].group);
  }

  allCoaches() {
    return staffList(this.staff);
  }

  // --- Serialization --------------------------------------------------------

  toJSON() {
    return {
      id: this.id,
      roster: this.roster.map((p) => p.toJSON()),
      practiceSquad: this.practiceSquad.map((p) => p.toJSON()),
      injuredReserve: this.injuredReserve,
      staff: Object.fromEntries(Object.entries(this.staff).map(([k, v]) => [
        k, Array.isArray(v) ? v.map((c) => c.toJSON()) : v?.toJSON?.() ?? v,
      ])),
      depthChart: this.depthChart,
      gameplan: this.gameplan,
      record: this.record, streak: this.streak, seasonStats: this.seasonStats, gameLog: this.gameLog,
      draftPicks: this.draftPicks, deadMoney: this.deadMoney,
      chemistry: round(this.chemistry, 1), ownerPatience: round(this.ownerPatience, 1),
      ownerGoals: this.ownerGoals, history: this.history, isUserTeam: this.isUserTeam,
    };
  }
}

// How many players at each position are on the field in the most common look.
// Offense is 11 personnel and defense is nickel, because that is what the
// modern game actually plays the majority of its snaps in. Used for starter
// identification and unit ratings; real personnel packages are built per-play
// by the simulation.
export const STARTER_COUNT = {
  QB: 1, RB: 1, FB: 0, WR: 3, TE: 1, OT: 2, OG: 2, C: 1,
  EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1, LS: 1,
};

// Positional importance when rolling a unit up into one number.
const UNIT_WEIGHT = {
  QB: 4.5, RB: 1.0, FB: 0.3, WR: 1.5, TE: 1.0, OT: 1.8, OG: 1.2, C: 1.2,
  EDGE: 2.0, DT: 1.5, LB: 1.2, CB: 1.7, S: 1.2, K: 1.0, P: 0.7, LS: 0.3,
};

export { UNIT_WEIGHT };
