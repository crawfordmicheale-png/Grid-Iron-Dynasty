// The League: every team, every player under contract or not, the calendar,
// and the record of what has already happened.

import { Team } from './team.js';
import { Player } from './player.js';
import { Coach } from './staff.js';
import { TEAM_DATA, CONFERENCES, DIVISIONS, LEAGUE_NAME } from '../data/teams.js';
import { RNG } from '../core/rng.js';
import { capForYear } from './contract.js';
import { byDesc, uidState, resetUid } from '../core/util.js';

export const PHASES = {
  PRESEASON: 'preseason',
  REGULAR: 'regular',
  PLAYOFFS: 'playoffs',
  OFFSEASON: 'offseason',
  DRAFT: 'draft',
  FREE_AGENCY: 'freeAgency',
};

export const REGULAR_SEASON_WEEKS = 18;

export class League {
  constructor(data = {}) {
    this.seed = data.seed ?? 'gridiron';
    this.rng = new RNG(this.seed);
    if (data.rngState) this.rng.restore(data.rngState);

    this.startYear = data.startYear ?? 2025;
    this.year = data.year ?? this.startYear;
    this.week = data.week ?? 1;
    this.phase = data.phase ?? PHASES.PRESEASON;

    this.teams = new Map();
    for (const t of data.teams ?? []) {
      this.teams.set(t.id, t instanceof Team ? t : hydrateTeam(t));
    }

    this.freeAgents = (data.freeAgents ?? []).map((p) => (p instanceof Player ? p : Player.fromJSON(p)));
    this.draftClass = (data.draftClass ?? []).map((p) => (p instanceof Player ? p : Player.fromJSON(p)));
    this.coachPool = (data.coachPool ?? []).map((c) => (c instanceof Coach ? c : Coach.fromJSON(c)));
    this.retired = (data.retired ?? []).map((p) => (p instanceof Player ? p : Player.fromJSON(p)));

    this.schedule = data.schedule ?? [];      // [{week, home, away, played, result}]
    this.playoffs = data.playoffs ?? null;
    this.history = data.history ?? [];        // per-season summaries
    this.transactions = data.transactions ?? [];
    this.newsFeed = data.newsFeed ?? [];
    this.userTeamId = data.userTeamId ?? null;
    this.uidCounter = data.uidCounter ?? 0;
  }

  // --- Lookups --------------------------------------------------------------

  get leagueYear() {
    return this.year - this.startYear;
  }

  get salaryCap() {
    return capForYear(this.leagueYear);
  }

  team(id) {
    return this.teams.get(id) ?? null;
  }

  get userTeam() {
    return this.userTeamId ? this.team(this.userTeamId) : null;
  }

  allTeams() {
    return Array.from(this.teams.values());
  }

  teamsInDivision(conf, div) {
    return this.allTeams().filter((t) => t.conf === conf && t.div === div);
  }

  teamsInConference(conf) {
    return this.allTeams().filter((t) => t.conf === conf);
  }

  allPlayers({ includeFreeAgents = false, includeDraft = false } = {}) {
    const out = [];
    for (const t of this.teams.values()) out.push(...t.roster, ...t.practiceSquad);
    if (includeFreeAgents) out.push(...this.freeAgents);
    if (includeDraft) out.push(...this.draftClass);
    return out;
  }

  findPlayer(id) {
    for (const t of this.teams.values()) {
      const p = t.findPlayer(id);
      if (p) return p;
    }
    return this.freeAgents.find((p) => p.id === id)
      ?? this.draftClass.find((p) => p.id === id)
      ?? this.retired.find((p) => p.id === id)
      ?? null;
  }

  teamOf(player) {
    return player.teamId ? this.team(player.teamId) : null;
  }

  // --- Schedule -------------------------------------------------------------

  gamesInWeek(week) {
    return this.schedule.filter((g) => g.week === week);
  }

  teamSchedule(teamId) {
    return this.schedule.filter((g) => g.home === teamId || g.away === teamId);
  }

  nextGameFor(teamId) {
    return this.teamSchedule(teamId).find((g) => !g.played) ?? null;
  }

  byeWeekFor(teamId) {
    const weeks = new Set(this.teamSchedule(teamId).map((g) => g.week));
    for (let w = 1; w <= REGULAR_SEASON_WEEKS; w += 1) if (!weeks.has(w)) return w;
    return null;
  }

  // --- League-wide queries --------------------------------------------------

  statLeaders(statKey, limit = 10, filter = () => true) {
    return this.allPlayers()
      .filter((p) => p.stat(statKey) > 0 && filter(p))
      .sort(byDesc((p) => p.stat(statKey)))
      .slice(0, limit);
  }

  powerRankings() {
    return this.allTeams()
      .map((t) => ({
        team: t,
        score: t.overallRating * 0.55 + t.winPct * 40
          + (t.record.pf - t.record.pa) / Math.max(1, t.record.w + t.record.l + t.record.t) * 0.6,
      }))
      .sort(byDesc((r) => r.score));
  }

  // --- Journal --------------------------------------------------------------

  log(type, message, payload = {}) {
    const entry = { year: this.year, week: this.week, type, message, ...payload };
    this.newsFeed.unshift(entry);
    if (this.newsFeed.length > 600) this.newsFeed.length = 600;
    return entry;
  }

  recordTransaction(kind, detail) {
    this.transactions.unshift({ year: this.year, week: this.week, kind, ...detail });
    if (this.transactions.length > 1200) this.transactions.length = 1200;
  }

  // --- Serialization --------------------------------------------------------

  toJSON() {
    return {
      seed: this.seed,
      rngState: this.rng.save(),
      startYear: this.startYear, year: this.year, week: this.week, phase: this.phase,
      teams: this.allTeams().map((t) => t.toJSON()),
      freeAgents: this.freeAgents.map((p) => p.toJSON()),
      draftClass: this.draftClass.map((p) => p.toJSON()),
      coachPool: this.coachPool.map((c) => c.toJSON()),
      retired: this.retired.map((p) => p.toJSON()),
      schedule: this.schedule, playoffs: this.playoffs, history: this.history,
      transactions: this.transactions, newsFeed: this.newsFeed,
      userTeamId: this.userTeamId, uidCounter: uidState(),
    };
  }

  static fromJSON(data) {
    const lg = new League(data);
    if (data.uidCounter) resetUid(data.uidCounter);
    return lg;
  }
}

function hydrateTeam(raw) {
  const staff = {};
  for (const [k, v] of Object.entries(raw.staff ?? {})) {
    staff[k] = Array.isArray(v) ? v.map((c) => Coach.fromJSON(c)) : Coach.fromJSON(v);
  }
  return new Team({
    ...raw,
    roster: (raw.roster ?? []).map((p) => Player.fromJSON(p)),
    practiceSquad: (raw.practiceSquad ?? []).map((p) => Player.fromJSON(p)),
    staff,
  });
}

export { hydrateTeam, TEAM_DATA, CONFERENCES, DIVISIONS, LEAGUE_NAME };
