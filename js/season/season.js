// The season: week to week, through the playoffs, into the record books.

import { Game } from '../sim/game.js';
import { generateSchedule, assignPrimetime, REGULAR_SEASON_WEEKS } from './schedule.js';
import { applyGameResult, standingsTable, divisionStandings } from './standings.js';
import { createBracket, advanceBracket, bracketGames, playoffResultFor, ROUNDS } from './playoffs.js';
import { selectAwards, statLeaders, recordAccolades } from './awards.js';
import { playbookForScheme, defensivePlaybookForScheme } from '../data/playbook.js';
import { PHASES } from '../model/league.js';
import { CONFERENCES, DIVISIONS, CHAMPIONSHIP_NAME } from '../data/teams.js';
import { clamp, remap } from '../core/util.js';

export class Season {
  constructor(league) {
    this.league = league;
    this.books = new Map();
    this.bracket = null;
  }

  /** Books are rebuilt whenever a coordinator (and so a scheme) changes. */
  booksFor(team) {
    const key = `${team.id}:${team.staff?.OC?.offScheme}:${team.staff?.DC?.defScheme}`;
    const cached = this.books.get(team.id);
    if (cached?.key === key) return cached;
    const built = {
      key,
      off: playbookForScheme(this.league.rng, team.staff?.OC?.offScheme, 150),
      def: defensivePlaybookForScheme(this.league.rng, team.staff?.DC?.defScheme, 60),
    };
    this.books.set(team.id, built);
    return built;
  }

  invalidateBooks(teamId) {
    this.books.delete(teamId);
  }

  // --- Setup ---------------------------------------------------------------

  start(priorFinish = null) {
    const lg = this.league;
    lg.phase = PHASES.REGULAR;
    lg.week = 1;
    lg.schedule = assignPrimetime(lg, generateSchedule(lg.rng, lg, lg.year - lg.startYear, priorFinish));
    this.bracket = null;
    lg.playoffs = null;

    for (const team of lg.allTeams()) {
      team.record = { w: 0, l: 0, t: 0, divW: 0, divL: 0, divT: 0, confW: 0, confL: 0, confT: 0, pf: 0, pa: 0 };
      team.streak = 0;
      team.gameLog = [];
      for (const p of team.roster) {
        p.stats = {};
        p.snapCount = 0;
        p.fatigue = 100;
      }
      team.rebuildDepthChart();
    }
    lg.log('season', `The ${lg.year} season begins.`);
    return lg.schedule;
  }

  // --- Playing games -------------------------------------------------------

  /**
   * Simulate one game. `hooks` may carry a play-call callback for the club the
   * user is coaching.
   */
  playGame(game, hooks = {}) {
    const lg = this.league;
    const home = lg.team(game.home);
    const away = lg.team(game.away);
    const homeBooks = this.booksFor(home);
    const awayBooks = this.booksFor(away);

    for (const t of [home, away]) for (const p of t.roster) p.fatigue = 100;

    const sim = new Game({
      rng: lg.rng,
      home,
      away,
      week: game.week ?? lg.week,
      playoffs: Boolean(game.round),
      primetime: game.primetime ?? false,
      neutralSite: game.neutralSite ?? false,
      homeOffBook: homeBooks.off, homeDefBook: homeBooks.def,
      awayOffBook: awayBooks.off, awayDefBook: awayBooks.def,
      userTeamId: hooks.userTeamId ?? lg.userTeamId,
      playCallHook: hooks.playCallHook ?? null,
      onPlay: hooks.onPlay ?? null,
    });

    const result = sim.run();
    result.firstDowns = sim.firstDownsBy;
    return result;
  }

  /** Play every unplayed game in a week. */
  playWeek(week = this.league.week, hooks = {}) {
    const lg = this.league;
    const games = lg.gamesInWeek(week).filter((g) => !g.played);
    const results = [];
    for (const game of games) {
      const isUser = lg.userTeamId && (game.home === lg.userTeamId || game.away === lg.userTeamId);
      const result = this.playGame(game, isUser ? hooks : {});
      applyGameResult(lg, game, result);
      this.recordGameLog(game, result);
      results.push({ game, result });
    }
    this.weeklyUpkeep();
    return results;
  }

  recordGameLog(game, result) {
    const lg = this.league;
    for (const id of [game.home, game.away]) {
      const team = lg.team(id);
      const opp = id === game.home ? game.away : game.home;
      const mine = id === game.home ? result.homeScore : result.awayScore;
      const theirs = id === game.home ? result.awayScore : result.homeScore;
      team.gameLog.push({
        week: game.week, opponent: opp, home: id === game.home,
        score: mine, oppScore: theirs,
        outcome: mine > theirs ? 'W' : mine < theirs ? 'L' : 'T',
        overtime: result.overtime,
      });
    }
  }

  /** Between weeks: injuries heal, morale moves, the roster gets a breather. */
  weeklyUpkeep() {
    const lg = this.league;
    for (const team of lg.allTeams()) {
      const trainer = team.staff?.TRAINER;
      const healRate = remap(trainer?.attr('recovery') ?? 55, 30, 95, 0.8, 1.45);
      const motivator = team.staff?.HC;
      const moraleShift = remap(motivator?.attr('motivation') ?? 55, 30, 95, -0.6, 1.0);
      const won = team.gameLog[team.gameLog.length - 1]?.outcome === 'W';

      for (const p of team.roster) {
        p.fatigue = 100;
        if (p.injury) {
          p.injury.weeksOut -= healRate;
          if (p.injury.weeksOut <= 0) {
            if (p.injury.severity >= 0.7) {
              p.history.push({ year: lg.year, type: 'majorInjury', name: p.injury.name });
            }
            p.injury = null;
          }
        }
        // Morale drifts with results, playing time, and the head coach.
        let delta = moraleShift + (won ? 1.1 : -0.9);
        const snapsThisWeek = p.snapCount;
        if (snapsThisWeek < 5 && p.overall() > 74) delta -= 1.4; // good players want to play
        for (const t of team.roster) {
          // Leaders and problems move the room.
        }
        p.morale = clamp(p.morale + delta, 5, 100);
      }

      // Locker-room traits nudge everybody.
      let roomShift = 0;
      for (const p of team.roster) {
        roomShift += p.traitSum('moraleTeam');
      }
      for (const p of team.roster) p.morale = clamp(p.morale + roomShift * 0.05, 5, 100);

      team.chemistry = clamp(team.chemistry + (won ? 0.6 : -0.5) + roomShift * 0.05, 10, 99);
      team.rebuildDepthChart();
    }
  }

  // --- Advancing -----------------------------------------------------------

  advanceWeek() {
    const lg = this.league;
    if (lg.phase === PHASES.REGULAR) {
      if (lg.week >= REGULAR_SEASON_WEEKS) {
        this.startPlayoffs();
      } else {
        lg.week += 1;
      }
      return lg.phase;
    }
    if (lg.phase === PHASES.PLAYOFFS) {
      const step = advanceBracket(this.bracket);
      if (this.bracket.complete) {
        this.finishSeason();
      } else {
        lg.week += 1;
      }
      return lg.phase;
    }
    return lg.phase;
  }

  startPlayoffs() {
    const lg = this.league;
    // Regular-season totals are frozen here; anything from now on is postseason.
    // Without this a club that plays four playoff games has its stat leaders
    // inflated by a quarter against everyone who missed the field.
    for (const team of lg.allTeams()) {
      for (const p of team.roster) {
        p.regularSeasonStats = { ...p.stats };
        p.stats = {};
      }
    }
    lg.phase = PHASES.PLAYOFFS;
    lg.week = REGULAR_SEASON_WEEKS + 1;
    this.bracket = createBracket(lg, lg.schedule, lg.rng);
    lg.playoffs = this.bracket;
    const names = [];
    for (const conf of Object.keys(CONFERENCES)) {
      names.push(`${CONFERENCES[conf].abbr}: ${this.bracket.field[conf].map((s) => lg.team(s.teamId).abbr).join(', ')}`);
    }
    lg.log('playoffs', `Playoff field set. ${names.join(' | ')}`);
    return this.bracket;
  }

  /** Play the current playoff round. */
  playPlayoffRound(hooks = {}) {
    const lg = this.league;
    const games = bracketGames(this.bracket).filter((g) => !g.played);
    const results = [];
    for (const game of games) {
      const isUser = lg.userTeamId && (game.home === lg.userTeamId || game.away === lg.userTeamId);
      const result = this.playGame(game, isUser ? hooks : {});
      game.result = result;
      game.played = true;
      this.recordGameLog({ ...game, week: lg.week }, result);
      results.push({ game, result });
      const winner = result.homeScore > result.awayScore ? game.home : game.away;
      lg.log('playoffs', `${ROUNDS[game.round].name}: ${lg.team(winner).fullName} advance.`);
    }
    this.weeklyUpkeep();
    return results;
  }

  // --- Wrapping up ---------------------------------------------------------

  finishSeason() {
    const lg = this.league;
    // Put the regular season back in place before awards are voted on.
    for (const team of lg.allTeams()) {
      for (const p of team.roster) {
        if (p.regularSeasonStats) {
          p.playoffStats = p.stats;
          p.stats = p.regularSeasonStats;
          delete p.regularSeasonStats;
        }
      }
    }
    const awards = selectAwards(lg);
    const leaders = statLeaders(lg);
    recordAccolades(lg, awards);

    const championId = this.bracket?.champion;
    if (championId) {
      const champ = lg.team(championId);
      champ.history.push({ year: lg.year, result: 'champion', record: champ.recordString });
      const hc = champ.staff?.HC;
      if (hc) hc.record.titles += 1;
      lg.log('champion', `${champ.fullName} win the ${CHAMPIONSHIP_NAME}!`);
    }

    // Franchise history and coaching records.
    const finish = {};
    for (const conf of Object.keys(CONFERENCES)) {
      for (const div of DIVISIONS) {
        finish[`${conf}-${div}`] = divisionStandings(lg, lg.schedule, conf, div, lg.rng);
      }
    }

    for (const team of lg.allTeams()) {
      const playoff = playoffResultFor(this.bracket, team.id);
      if (team.id !== championId) {
        team.history.push({ year: lg.year, result: playoff ?? 'missed playoffs', record: team.recordString });
      }
      const hc = team.staff?.HC;
      if (hc) {
        hc.record.w += team.record.w;
        hc.record.l += team.record.l;
        hc.record.t += team.record.t;
        if (playoff) hc.record.playoffs += 1;
      }
      // Owner patience moves on results against expectation.
      const expected = remap(team.overallRating, 65, 88, 0.34, 0.68);
      team.ownerPatience = clamp(
        team.ownerPatience + (team.winPct - expected) * 55 + (playoff ? 8 : -5) + (team.id === championId ? 25 : 0),
        0, 100,
      );
      for (const p of team.roster) p.rollSeasonStats();
    }

    lg.history.push({
      year: lg.year,
      champion: championId,
      runnerUp: this.bracket?.runnerUp ?? null,
      awards,
      leaders,
      finish,
      standings: standingsTable(lg, lg.schedule, lg.rng),
    });

    lg.phase = PHASES.OFFSEASON;
    lg.log('season', `The ${lg.year} season is complete.`);
    return { awards, leaders, championId, finish };
  }

  /** Convenience: run a whole season with no user involvement. */
  simulateFullSeason(priorFinish = null) {
    this.start(priorFinish);
    for (let w = 1; w <= REGULAR_SEASON_WEEKS; w += 1) {
      this.league.week = w;
      this.playWeek(w);
    }
    this.startPlayoffs();
    let guard = 0;
    while (!this.bracket.complete && guard < 8) {
      guard += 1;
      this.playPlayoffRound();
      advanceBracket(this.bracket);
    }
    return this.finishSeason();
  }
}
