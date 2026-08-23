// The offseason, in the order it actually happens.

import { runProgression, ageStaff } from './progression.js';
import { runCoachingCarousel, replenishCoachPool } from './staffing.js';
import {
  expireContracts, reSignOwnPlayers, runFreeAgency, trimRoster, releasePlayer,
} from './freeAgency.js';
import { generateDraftClass, buildScoutingBoards, runDraft, draftOrder } from './draft.js';
import { generatePlayer } from '../model/playerGen.js';
import { ROSTER_BLUEPRINT, POSITION_KEYS } from '../data/positions.js';
import { minSalary, Contract, marketValue } from '../model/contract.js';
import { PHASES } from '../model/league.js';
import { ROSTER_LIMIT } from '../model/team.js';
import { clamp, byDesc, money } from '../core/util.js';

export const OFFSEASON_STAGES = [
  { key: 'review', name: 'Season Review' },
  { key: 'retirements', name: 'Retirements & Development' },
  { key: 'staff', name: 'Coaching Carousel' },
  { key: 'contracts', name: 'Contracts Expire' },
  { key: 'resign', name: 'Re-Sign Your Own' },
  { key: 'cuts', name: 'Cap Casualties' },
  { key: 'freeAgency', name: 'Free Agency' },
  { key: 'draft', name: 'The Draft' },
  { key: 'finalCuts', name: 'Final Roster Cuts' },
  { key: 'ready', name: 'Ready for Camp' },
];

export class Offseason {
  constructor(league, season) {
    this.league = league;
    this.season = season;
    this.stageIndex = 0;
    this.log = [];
    this.draftClass = null;
    this.boards = null;
    this.scoutingEffort = {};   // teamId -> { prospectId: extraEffort }
  }

  get stage() {
    return OFFSEASON_STAGES[this.stageIndex];
  }

  get complete() {
    return this.stageIndex >= OFFSEASON_STAGES.length - 1;
  }

  note(text, payload = {}) {
    this.log.push({ stage: this.stage.key, text, ...payload });
    this.league.log('offseason', text);
  }

  /** Advance one stage. Returns a summary of what happened. */
  advance(opts = {}) {
    const lg = this.league;
    const rng = lg.rng;
    const stage = this.stage.key;
    let summary = { stage, items: [] };

    switch (stage) {
      case 'review': {
        lg.phase = PHASES.OFFSEASON;
        const last = lg.history[lg.history.length - 1];
        if (last?.champion) this.note(`${lg.team(last.champion).fullName} are champions.`);
        break;
      }

      case 'retirements': {
        const { developed, retired } = runProgression(rng, lg);
        ageStaff(rng, lg);
        const risers = developed.filter((d) => d.delta >= 4).sort(byDesc((d) => d.delta));
        summary.items = retired.map((r) => `${r.player.name} (${r.player.pos}) retires`);
        summary.developed = developed;
        summary.retired = retired;
        summary.risers = risers.slice(0, 10);
        this.note(`${retired.length} players retire. ${risers.length} take a real step forward.`);
        break;
      }

      case 'staff': {
        const events = runCoachingCarousel(rng, lg, opts);
        replenishCoachPool(rng, lg);
        for (const t of lg.allTeams()) this.season?.invalidateBooks(t.id);
        summary.events = events;
        this.note(`${events.filter((e) => e.type === 'fired').length} head coaches are out.`);
        break;
      }

      case 'contracts': {
        const expiring = expireContracts(lg);
        this.expiring = expiring;
        summary.items = expiring.map((p) => p.name);
        this.note(`${expiring.length} contracts expire league-wide.`);
        break;
      }

      case 'resign': {
        const resigned = reSignOwnPlayers(rng, lg, this.expiring ?? [], {
          ...opts,
          teamOf: (p) => lg.team(p.__lastTeamId),
        });
        summary.items = resigned.map((r) => `${r.team.abbr} re-sign ${r.player.name} (${money(r.apy)}/yr)`);
        this.note(`${resigned.length} players re-sign with their own clubs.`);
        break;
      }

      case 'cuts': {
        let cut = 0;
        const capYear = lg.leagueYear + 1;
        for (const team of lg.allTeams()) {
          if (opts.userTeamId && team.id === opts.userTeamId) continue;
          // Only cap-driven cuts here; roster limits come after the draft.
          const released = trimRoster(rng, lg, team, 90, capYear);
          cut += released.length;
        }
        this.note(`${cut} players released as cap casualties.`);
        break;
      }

      case 'freeAgency': {
        const signings = runFreeAgency(rng, lg, opts);
        summary.items = signings.map((s) => `${s.team.abbr} sign ${s.player.name} (${s.player.pos}, ${money(s.apy)}/yr x${s.years})`);
        summary.signings = signings;
        this.note(`${signings.length} free agents sign.`);
        break;
      }

      case 'draft': {
        if (!this.draftClass) this.prepareDraft();
        const last = lg.history[lg.history.length - 1];
        const result = runDraft(rng, lg, this.draftClass, this.boards, {
          ...opts,
          priorSeason: { champion: last?.champion, runnerUp: last?.runnerUp },
        });
        summary.picks = result.picks;
        summary.items = result.picks.slice(0, 32).map((r) => `${r.pick.overall}. ${r.team.abbr} — ${r.player.pos} ${r.player.name}`);
        this.note(`${result.picks.length} players drafted.`);
        this.draftClass = null;
        this.boards = null;
        break;
      }

      case 'finalCuts': {
        let released = 0;
        const capYear = lg.leagueYear + 1;
        for (const team of lg.allTeams()) {
          if (opts.userTeamId && team.id === opts.userTeamId && opts.skipUserTeam) continue;
          // Fill, trim, and fill again until the club is both at the roster
          // limit and under the cap -- each pass changes the other constraint.
          for (let pass = 0; pass < 6; pass += 1) {
            this.fillHoles(rng, team, capYear);
            this.fillToLimit(rng, team, capYear);
            const before = team.roster.length;
            released += trimRoster(rng, lg, team, ROSTER_LIMIT, capYear).length;
            if (team.roster.length === ROSTER_LIMIT && team.capSpace(capYear, capYear) >= 0) break;
            if (team.roster.length === before && pass > 0) break;
          }
        }
        // Anyone still unsigned goes back into the veteran pool.
        lg.freeAgents = lg.freeAgents.filter((p) => !p.teamId);
        this.note(`${released} players released to reach the roster limit.`);
        break;
      }

      default:
        break;
    }

    if (this.stageIndex < OFFSEASON_STAGES.length - 1) this.stageIndex += 1;
    return summary;
  }

  prepareDraft(opts = {}) {
    const rng = this.league.rng;
    this.draftClass = generateDraftClass(rng, this.league, opts.size ?? 260);
    this.league.draftClass = this.draftClass;
    this.boards = buildScoutingBoards(rng, this.league, this.draftClass, this.scoutingEffort);
    return { draftClass: this.draftClass, boards: this.boards };
  }

  /** Make sure a club can actually field a legal lineup. */
  fillHoles(rng, team, capYear = null) {
    const counts = team.positionCounts();
    const usedNames = new Set();
    for (const [pos, want] of Object.entries(ROSTER_BLUEPRINT)) {
      const minimum = Math.max(1, Math.floor(want * 0.6));
      while ((counts[pos] ?? 0) < minimum) {
        // Sign the best available free agent at the spot, or find a camp body.
        const fa = this.league.freeAgents
          .filter((p) => p.pos === pos)
          .sort(byDesc((p) => p.overall()))[0];
        const player = fa ?? generatePlayer(rng, {
          pos,
          overall: clamp(rng.gauss(58, 5), 44, 72),
          age: rng.int(22, 27),
          usedNames,
        });
        if (fa) this.league.freeAgents = this.league.freeAgents.filter((p) => p.id !== fa.id);
        player.contract = new Contract({
          years: 1,
          startYear: capYear ?? this.league.leagueYear + 1,
          baseSalaries: [minSalary(player.exp)],
          rosterBonuses: [0],
        });
        team.addPlayer(player);
        counts[pos] = (counts[pos] ?? 0) + 1;
      }
    }
    team.rebuildDepthChart();
  }

  /**
   * Fill a roster all the way to the limit with minimum-salary players. A club
   * that is a few bodies short is carrying a competitive disadvantage for no
   * reason, so every front office does this.
   */
  fillToLimit(rng, team, capYear) {
    const usedNames = new Set();
    let guard = 0;
    while (team.roster.length < ROSTER_LIMIT && guard < 40) {
      guard += 1;
      const counts = team.positionCounts();
      // Sign at whichever position is furthest below the blueprint.
      const pos = POSITION_KEYS
        .map((k) => ({ k, gap: (ROSTER_BLUEPRINT[k] ?? 0) - (counts[k] ?? 0) }))
        .sort(byDesc((x) => x.gap))[0]?.k ?? 'WR';

      const fa = this.league.freeAgents
        .filter((p) => p.pos === pos)
        .sort(byDesc((p) => p.overall()))[0];
      const player = fa ?? generatePlayer(rng, {
        pos,
        overall: clamp(rng.gauss(57, 5), 42, 70),
        age: rng.int(22, 27),
        usedNames,
      });
      if (fa) this.league.freeAgents = this.league.freeAgents.filter((p) => p.id !== fa.id);
      player.contract = new Contract({
        years: 1,
        startYear: capYear,
        baseSalaries: [minSalary(player.exp)],
        rosterBonuses: [0],
      });
      team.addPlayer(player);
    }
    team.rebuildDepthChart();
  }

  /** Run every remaining stage without user input. */
  runAll(opts = {}) {
    const summaries = [];
    let guard = 0;
    while (!this.complete && guard < 20) {
      guard += 1;
      summaries.push(this.advance(opts));
    }
    // Roll the league into the new year.
    this.league.year += 1;
    this.league.week = 1;
    this.league.phase = PHASES.PRESEASON;
    for (const team of this.league.allTeams()) {
      team.deadMoney = Object.fromEntries(
        Object.entries(team.deadMoney).filter(([y]) => Number(y) >= this.league.leagueYear),
      );
      team.rebuildDepthChart();
    }
    return summaries;
  }
}
