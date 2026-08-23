// A full game: possessions, downs, the clock, scoring, and the two coaching
// staffs making decisions against each other.

import { runSnap } from './snap.js';
import { callOffensivePlay, callDefensivePlay, fourthDownDecision, twoPointDecision } from './playCaller.js';
import {
  attemptFieldGoal, attemptExtraPoint, attemptPunt, attemptKickoff,
  attemptOnsideKick, fieldGoalChance, twoPointChance,
} from './specialTeams.js';
import {
  GameClock, playDuration, clockStopsAfter, betweenPlays, wentOutOfBounds, QUARTER_SECONDS,
} from './clock.js';
import { buildContext, generateWeather, crowdNoise, altitudeEffect } from './context.js';
import { playbookForScheme, defensivePlaybookForScheme } from '../data/playbook.js';
import { travelMiles } from '../data/teams.js';
import { familiarityMultiplier, situationalBonus } from '../season/practice.js';
import { clamp, remap, round, fieldPosName, downDistance } from '../core/util.js';

export const TIMEOUTS_PER_HALF = 3;

class Possession {
  constructor(teamId, absolute) {
    this.teamId = teamId;
    this.absolute = absolute; // 0-100 from this team's own goal line
    this.down = 1;
    this.distance = 10;
    this.firstDownLine = Math.min(100, absolute + 10);
  }
}

export class Game {
  /**
   * @param {object} cfg { rng, home, away, week, playoffs, primetime, onPlay }
   */
  constructor(cfg) {
    this.rng = cfg.rng;
    this.home = cfg.home;
    this.away = cfg.away;
    this.week = cfg.week ?? 1;
    this.playoffs = cfg.playoffs ?? false;
    this.primetime = cfg.primetime ?? false;
    this.neutralSite = cfg.neutralSite ?? false;
    this.onPlay = cfg.onPlay ?? null;       // callback for UI / logging
    this.userTeamId = cfg.userTeamId ?? null;
    this.playCallHook = cfg.playCallHook ?? null; // lets a human call the plays

    this.clock = new GameClock(cfg.quarterSeconds ?? QUARTER_SECONDS);
    this.score = { [this.home.id]: 0, [this.away.id]: 0 };
    this.timeouts = {
      [this.home.id]: TIMEOUTS_PER_HALF,
      [this.away.id]: TIMEOUTS_PER_HALF,
    };
    this.quarterScores = { [this.home.id]: [], [this.away.id]: [] };
    this.firstDownsBy = { [this.home.id]: 0, [this.away.id]: 0 };

    this.weather = cfg.weather ?? generateWeather(this.rng, this.home, this.week);
    this.altitude = altitudeEffect(this.home);

    // Books. A club's playbook is a function of its coordinators' schemes.
    this.books = {
      [this.home.id]: {
        off: cfg.homeOffBook ?? playbookForScheme(this.rng, this.home.staff.OC?.offScheme, 150),
        def: cfg.homeDefBook ?? defensivePlaybookForScheme(this.rng, this.home.staff.DC?.defScheme, 60),
      },
      [this.away.id]: {
        off: cfg.awayOffBook ?? playbookForScheme(this.rng, this.away.staff.OC?.offScheme, 150),
        def: cfg.awayDefBook ?? defensivePlaybookForScheme(this.rng, this.away.staff.DC?.defScheme, 60),
      },
    };

    this.playLog = [];
    this.drives = [];
    this.currentDrive = null;
    this.possession = null;
    this.receivedSecondHalf = null;
    this.finished = false;
    this.overtimePossessions = 0;

    // Travel: a west-coast club flying east for a one o'clock start is tired.
    const miles = this.neutralSite ? 0 : travelMiles(this.away, this.home);
    this.travelPenalty = clamp(remap(miles, 400, 2600, 0, 1.6), 0, 1.6);
  }

  team(id) { return id === this.home.id ? this.home : this.away; }
  opponent(id) { return id === this.home.id ? this.away : this.home; }

  get scoreDiffFor() {
    return (id) => this.score[id] - this.score[this.opponent(id).id];
  }

  // --- Context --------------------------------------------------------------

  contextFor(teamId) {
    const diff = this.score[teamId] - this.score[this.opponent(teamId).id];
    return buildContext({
      weather: this.weather,
      quarter: this.clock.quarter,
      clock: this.clock.clock,
      scoreDiff: diff,
      playoffs: this.playoffs,
      primetime: this.primetime,
    });
  }

  situationFor(teamId) {
    const p = this.possession;
    const diff = this.score[teamId] - this.score[this.opponent(teamId).id];
    const q = this.clock.quarter;
    const c = this.clock.clock;
    const trailing = diff < 0;
    return {
      down: p.down,
      distance: p.distance,
      absolute: p.absolute,
      scoreDiff: diff,
      quarter: q,
      clock: c,
      timeouts: this.timeouts[teamId],
      hurry: (q === 2 || q === 4 || q === 5) && c <= 120 && (trailing || (q === 2 && diff <= 7)),
      killClock: q === 4 && c <= 300 && diff > 0,
    };
  }

  // --- Scoring --------------------------------------------------------------

  addScore(teamId, points, kind) {
    this.score[teamId] += points;
    this.emit({
      type: 'score', teamId, points, kind,
      score: { ...this.score }, clock: this.clock.toString(),
    });
  }

  emit(event) {
    event.quarter = this.clock.quarter;
    event.clockSeconds = this.clock.clock;
    this.playLog.push(event);
    if (this.onPlay) this.onPlay(event, this);
  }

  // --- Possession flow ------------------------------------------------------

  startDrive(teamId, absolute, reason) {
    this.possession = new Possession(teamId, clamp(absolute, 1, 99));
    this.currentDrive = {
      teamId, startAbsolute: this.possession.absolute, startQuarter: this.clock.quarter,
      startClock: this.clock.clock, plays: 0, yards: 0, result: null, reason,
    };
    this.drives.push(this.currentDrive);
    this.emit({
      type: 'driveStart', teamId, absolute: this.possession.absolute,
      text: `${this.team(teamId).abbr} takes over at the ${fieldPosName(this.possession.absolute)}.`,
    });
  }

  endDrive(result) {
    if (this.currentDrive) {
      this.currentDrive.result = result;
      this.currentDrive.endQuarter = this.clock.quarter;
      this.currentDrive.endClock = this.clock.clock;
    }
  }

  changePossession(newTeamId, absolute, reason) {
    this.endDrive(reason);
    this.startDrive(newTeamId, absolute, reason);
  }

  kickoff(kickingTeamId, { onside = false } = {}) {
    const kicking = this.team(kickingTeamId);
    const receiving = this.opponent(kickingTeamId);
    const ctx = this.contextFor(receiving.id);
    const kicker = kicking.depthAt('K', 0);
    const returner = receiving.depthAt('WR', 2) ?? receiving.depthAt('RB', 1);

    if (onside) {
      const r = attemptOnsideKick(this.rng, kicker, ctx, this.clock.clock > 180);
      this.emit({ type: 'kickoff', text: r.narrative, onside: true });
      if (r.recovered) this.startDrive(kickingTeamId, 48, 'onside recovery');
      else this.startDrive(receiving.id, 45, 'onside failed');
      return;
    }

    const r = attemptKickoff(this.rng, kicker, returner, ctx, { altitudeBonus: this.altitude.kickBonus });
    this.emit({ type: 'kickoff', text: r.narrative });
    if (r.touchdown) {
      this.addScore(receiving.id, 6, 'kickoff return');
      this.extraPointTry(receiving.id);
      this.kickoff(receiving.id);
      return;
    }
    this.startDrive(receiving.id, r.receiveAt, 'kickoff');
  }

  extraPointTry(teamId) {
    const team = this.team(teamId);
    const ctx = this.contextFor(teamId);
    const diffAfterTD = this.score[teamId] - this.score[this.opponent(teamId).id];
    const sit = { scoreDiff: diffAfterTD, quarter: this.clock.quarter, clock: this.clock.clock };
    const goForTwo = twoPointDecision(sit, team.staff?.HC);

    if (goForTwo) {
      const chance = twoPointChance(team.offenseRating, this.opponent(teamId).defenseRating);
      const good = this.rng.next() < chance;
      if (good) this.addScore(teamId, 2, 'two-point conversion');
      this.emit({ type: 'twoPoint', teamId, good, text: good ? 'Two-point conversion is good!' : 'The two-point try fails.' });
      return;
    }
    const kicker = team.depthAt('K', 0);
    const r = attemptExtraPoint(this.rng, kicker, ctx);
    if (r.good) this.addScore(teamId, 1, 'extra point');
    this.emit({ type: 'extraPoint', teamId, good: r.good, text: r.narrative });
  }

  // --- The main loop --------------------------------------------------------

  run() {
    // Coin toss: the winner defers, as almost everyone does.
    const homeWins = this.rng.bool(0.5);
    const firstReceiver = homeWins ? this.away.id : this.home.id;
    this.receivedSecondHalf = homeWins ? this.home.id : this.away.id;
    this.emit({ type: 'kickoffStart', text: `${this.team(this.receivedSecondHalf).abbr} wins the toss and defers.` });
    this.kickoff(this.receivedSecondHalf === this.home.id ? this.home.id : this.away.id);

    let guard = 0;
    while (!this.finished && guard < 500) {
      guard += 1;
      this.runPlay();
      if (this.clock.expired) this.handleQuarterEnd();
    }
    this.finalize();
    return this.result();
  }

  handleQuarterEnd() {
    const q = this.clock.quarter;
    if (q === 1 || q === 3) {
      this.clock.advanceQuarter();
      this.emit({ type: 'quarterEnd', text: `End of the ${q === 1 ? 'first' : 'third'} quarter.` });
      return;
    }
    if (q === 2) {
      this.endDrive('end of half');
      this.emit({ type: 'halftime', text: `Halftime. ${this.away.abbr} ${this.score[this.away.id]}, ${this.home.abbr} ${this.score[this.home.id]}.` });
      this.clock.advanceQuarter();
      this.timeouts[this.home.id] = TIMEOUTS_PER_HALF;
      this.timeouts[this.away.id] = TIMEOUTS_PER_HALF;
      this.halftimeAdjustments();
      this.recoverBetweenHalves();
      this.kickoff(this.opponent(this.receivedSecondHalf).id);
      return;
    }
    if (q === 4) {
      if (this.score[this.home.id] === this.score[this.away.id]) {
        this.endDrive('end of regulation');
        this.emit({ type: 'overtime', text: 'Tied at the end of regulation. We go to overtime.' });
        this.clock.startOvertime(600);
        this.timeouts[this.home.id] = 2;
        this.timeouts[this.away.id] = 2;
        this.kickoff(this.rng.bool(0.5) ? this.home.id : this.away.id);
        return;
      }
      this.finished = true;
      return;
    }
    // Overtime expired.
    this.finished = true;
  }

  // Coordinators adjust at the half. A good one is worth real points.
  halftimeAdjustments() {
    for (const team of [this.home, this.away]) {
      const oc = team.staff?.OC;
      const dc = team.staff?.DC;
      const adj = ((oc?.attr('adaptability') ?? 55) + (dc?.attr('adaptability') ?? 55)) / 2;
      team._halftimeEdge = remap(adj, 35, 95, -0.04, 0.05);
    }
    this.emit({
      type: 'adjustments',
      text: 'Both staffs make their halftime adjustments.',
    });
  }

  recoverBetweenHalves() {
    for (const team of [this.home, this.away]) {
      for (const p of team.roster) p.recover(45);
    }
  }

  // Both sides get a breather when possession changes: the unit coming off the
  // field is resting whichever club it plays for. Recovering only the team that
  // had the ball leaves defenses permanently gassed.
  recoverBetweenDrives() {
    for (const team of [this.home, this.away]) {
      for (const p of team.roster) p.recover(17);
    }
  }

  runPlay() {
    const p = this.possession;
    if (!p) { this.finished = true; return; }
    const offTeam = this.team(p.teamId);
    const defTeam = this.opponent(p.teamId);
    const sit = this.situationFor(p.teamId);

    // Fourth down: kick, punt, or go.
    if (p.down === 4) {
      const decided = this.decideFourthDown(offTeam, defTeam, sit);
      if (decided) return;
    }

    const ctx = this.contextFor(p.teamId);
    const book = this.books[offTeam.id];
    const defBook = this.books[defTeam.id];

    // The human coach calls his own plays when a hook is installed.
    let play;
    let defCall;
    if (this.playCallHook && p.teamId === this.userTeamId) {
      const called = this.playCallHook({ game: this, sit, book, offTeam, defTeam });
      play = called?.play;
    }
    if (!play) {
      play = callOffensivePlay({
        rng: this.rng, playbook: book.off, scheme: offTeam.offScheme,
        coach: offTeam.staff?.OC, sit, gameplan: offTeam.gameplan,
      });
    }
    defCall = callDefensivePlay({
      rng: this.rng, calls: defBook.def, scheme: defTeam.defScheme,
      coach: defTeam.staff?.DC, sit,
    });

    const noise = this.neutralSite || p.teamId === this.home.id
      ? 0
      : crowdNoise(this.home, ctx, this.home.winPct);

    const result = runSnap({
      rng: this.rng,
      offTeam, defTeam, play, defCall, ctx,
      crowdNoise: noise,
      aggression: (offTeam.staff?.OC?.aggression ?? 0) + (offTeam._halftimeEdge ?? 0) * 4,
      desperation: sit.hurry ? 0.6 : 0,
      runGameCredibility: this.runCredibility(offTeam.id),
      // How well this specific play has been practised this week.
      execution: familiarityMultiplier(offTeam.gameplan, play.id)
        + situationalBonus(offTeam.gameplan, sit.absolute >= 80 ? 'redZone'
          : sit.hurry ? 'twoMinute' : sit.distance <= 2 ? 'shortYardage' : null),
      injuryPreventionMult: remap(offTeam.staff?.TRAINER?.attr('injuryPrevention') ?? 55, 35, 95, 1.25, 0.7),
      altitudeMult: p.teamId === this.away.id ? this.altitude.fatigueMult * (1 + this.travelPenalty * 0.06) : 1,
    });

    this.applyResult(result, play, defCall, sit);
  }

  // How much the defense respects this team's run game, which is what makes
  // play action work.
  runCredibility(teamId) {
    const drives = this.drives.filter((d) => d.teamId === teamId);
    const rushYards = this.playLog
      .filter((e) => e.type === 'play' && e.teamId === teamId && e.result?.isRun)
      .reduce((s, e) => s + (e.result.yards ?? 0), 0);
    const rushes = this.playLog.filter((e) => e.type === 'play' && e.teamId === teamId && e.result?.isRun).length;
    const ypc = rushes >= 5 ? rushYards / rushes : 4.2;
    return clamp(remap(ypc, 2.5, 6.0, 35, 85), 30, 90);
  }

  decideFourthDown(offTeam, defTeam, sit) {
    const p = this.possession;
    const ctx = this.contextFor(p.teamId);
    const kicker = offTeam.depthAt('K', 0);
    const decision = fourthDownDecision({
      sit, kicker, ctx, coach: offTeam.staff?.HC,
      offenseRating: offTeam.offenseRating,
      fieldGoalChanceFn: (k, d, c) => fieldGoalChance(k, d, c, {
        altitudeBonus: p.teamId === this.home.id ? this.altitude.kickBonus : this.altitude.kickBonus * 0.6,
        pressure: this.clock.quarter >= 4 && Math.abs(sit.scoreDiff) <= 3,
      }),
    });

    if (decision.action === 'go') {
      this.emit({ type: 'decision', text: `${offTeam.abbr} is going for it on 4th and ${p.distance}.` });
      return false; // fall through and run a play
    }

    if (decision.action === 'fieldGoal') {
      const r = attemptFieldGoal(this.rng, kicker, p.absolute, ctx, {
        altitudeBonus: p.teamId === this.home.id ? this.altitude.kickBonus : this.altitude.kickBonus * 0.6,
        pressure: this.clock.quarter >= 4 && Math.abs(sit.scoreDiff) <= 3,
      });
      this.emit({ type: 'fieldGoal', teamId: p.teamId, good: r.good, distance: r.distance, text: r.narrative });
      this.burnClock(this.rng.float(4, 6), false);
      if (r.good) {
        this.addScore(p.teamId, 3, 'field goal');
        kicker?.addStat('fgMade'); kicker?.addStat('fgAtt');
        this.endDrive('field goal');
        this.afterScore(p.teamId);
      } else {
        kicker?.addStat('fgAtt');
        this.changePossession(defTeam.id, clamp(100 - Math.max(20, p.absolute - 8), 1, 99), 'missed field goal');
      }
      return true;
    }

    // Punt.
    const punter = offTeam.depthAt('P', 0);
    const returner = defTeam.depthAt('WR', 2) ?? defTeam.depthAt('RB', 1);
    const r = attemptPunt(this.rng, punter, returner, p.absolute, ctx, defTeam.specialTeamsRating);
    this.emit({ type: 'punt', teamId: p.teamId, text: r.narrative });
    punter?.addStat('punts'); punter?.addStat('puntYds', r.gross);
    this.burnClock(this.rng.float(5, 8), false);
    this.endDrive('punt');
    this.recoverBetweenDrives();
    this.startDrive(defTeam.id, r.receiveAt, 'punt');
    return true;
  }

  burnClock(seconds, clockRunning = true) {
    const { crossedTwoMinute } = this.clock.tick(seconds);
    if (crossedTwoMinute) {
      this.emit({ type: 'twoMinuteWarning', text: 'Two-minute warning.' });
      for (const team of [this.home, this.away]) for (const pl of team.roster) pl.recover(12);
    }
  }

  applyResult(result, play, defCall, sit) {
    const p = this.possession;
    const offTeam = this.team(p.teamId);
    const defTeam = this.opponent(p.teamId);

    // Pre-snap penalty: no play.
    if (result.type === 'penalty') {
      this.applyPenalty(result.penalty, p, true);
      this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: result.narrative });
      this.burnClock(this.rng.float(4, 8));
      return;
    }

    result.outOfBounds = wentOutOfBounds(this.rng, result, { needClockStopped: sit.hurry });
    result.routeType = result.route ? undefined : undefined;

    // Turnovers first.
    if (result.type === 'interception') {
      const spot = clamp(p.absolute + result.airYards - (result.returnYards ?? 0), 1, 99);
      this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: result.narrative });
      this.recordPlay(result, play);
      this.burnClock(playDuration(this.rng, result));
      const takeoverAbsolute = clamp(100 - spot, 1, 99);
      if (takeoverAbsolute >= 100) {
        this.addScore(defTeam.id, 6, 'pick six');
        this.extraPointTry(defTeam.id);
        this.endDrive('interception returned for touchdown');
        this.afterScore(defTeam.id);
        return;
      }
      this.changePossession(defTeam.id, takeoverAbsolute, 'interception');
      return;
    }

    let gained = result.yards ?? 0;
    let newAbsolute = clamp(p.absolute + gained, -5, 105);

    // Fumble lost.
    if (result.fumble && this.rng.bool(0.52)) {
      this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: `${result.narrative} FUMBLE — recovered by ${defTeam.abbr}!` });
      this.recordPlay(result, play);
      this.burnClock(playDuration(this.rng, result));
      this.changePossession(defTeam.id, clamp(100 - clamp(newAbsolute, 1, 99), 1, 99), 'fumble');
      return;
    }

    // Safety.
    if (newAbsolute <= 0) {
      this.addScore(defTeam.id, 2, 'safety');
      this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: `${result.narrative} Safety!` });
      this.recordPlay(result, play);
      this.burnClock(playDuration(this.rng, result));
      this.endDrive('safety');
      // Free kick from the 20 to the team that just conceded.
      this.startDrive(defTeam.id, 40, 'free kick after safety');
      return;
    }

    // Touchdown.
    if (newAbsolute >= 100) {
      result.touchdown = true;
      this.firstDownsBy[p.teamId] = (this.firstDownsBy[p.teamId] ?? 0) + 1;
      this.recordPlay(result, play);
      this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: `${result.narrative} TOUCHDOWN.` });
      this.addScore(p.teamId, 6, result.isRun ? 'rushing touchdown' : 'passing touchdown');
      this.burnClock(playDuration(this.rng, result));
      this.currentDrive.yards += gained;
      this.currentDrive.plays += 1;
      this.extraPointTry(p.teamId);
      this.endDrive('touchdown');
      this.afterScore(p.teamId);
      return;
    }

    // Post-play penalty.
    if (result.penalty) {
      const pen = result.penalty;
      // The offense declines a defensive flag if the play was better.
      const penaltyYards = pen.yards === 'spot' ? gained : pen.yards;
      const acceptForDefense = pen.on === 'OFF' && (pen.negates || gained > 0);
      const acceptForOffense = pen.on === 'DEF' && (penaltyYards > gained || pen.autoFirst);
      if (acceptForDefense || acceptForOffense) {
        this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: `${result.narrative} Flag — ${pen.name} on ${pen.player.shortName}.` });
        this.recordPlay(result, play, { negated: pen.negates });
        this.applyPenalty(pen, p, pen.negates, gained);
        this.burnClock(playDuration(this.rng, result));
        return;
      }
    }

    // Ordinary play.
    this.recordPlay(result, play);
    this.emit({ type: 'play', teamId: p.teamId, result, play, defCall, text: result.narrative });
    this.currentDrive.plays += 1;
    this.currentDrive.yards += gained;

    p.absolute = newAbsolute;
    const madeLine = p.absolute >= p.firstDownLine;
    if (madeLine) {
      this.firstDownsBy[p.teamId] = (this.firstDownsBy[p.teamId] ?? 0) + 1;
      p.down = 1;
      p.distance = Math.min(10, 100 - p.absolute);
      p.firstDownLine = Math.min(100, p.absolute + p.distance);
      result.firstDown = true;
    } else {
      p.down += 1;
      p.distance = Math.max(1, Math.round(p.firstDownLine - p.absolute));
    }

    // Clock.
    const duration = playDuration(this.rng, result);
    this.burnClock(duration);
    const stops = clockStopsAfter(result, { quarter: this.clock.quarter, clock: this.clock.clock });
    if (!stops && !this.clock.expired) {
      const tempo = (offTeam.staff?.OC?.tempo ?? 0) + (sit.hurry ? 1.5 : 0) + (sit.killClock ? -1.5 : 0);
      this.burnClock(betweenPlays(this.rng, {
        clockRunning: true, tempo: clamp(tempo, -1, 1),
        hurry: sit.hurry, killingClock: sit.killClock,
      }));
    }

    // Turnover on downs.
    if (p.down > 4) {
      this.emit({ type: 'turnoverOnDowns', teamId: p.teamId, text: `${offTeam.abbr} turns it over on downs.` });
      this.recoverBetweenDrives();
      this.changePossession(defTeam.id, clamp(100 - p.absolute, 1, 99), 'downs');
    }
  }

  applyPenalty(pen, p, replay, gained = 0) {
    const yards = pen.yards === 'spot' ? Math.max(1, gained || 15) : pen.yards;
    if (pen.on === 'OFF') {
      // Half the distance to the goal when backed up.
      const move = p.absolute + yards < 1 ? -Math.floor(p.absolute / 2) : yards;
      p.absolute = clamp(p.absolute + move, 1, 99);
      if (replay) {
        p.distance = Math.max(1, Math.round(p.firstDownLine - p.absolute));
      }
    } else {
      const toGoal = 100 - p.absolute;
      const move = yards > toGoal / 2 && p.absolute > 50 ? Math.floor(toGoal / 2) : yards;
      p.absolute = clamp(p.absolute + move, 1, 99);
      if (pen.autoFirst) {
        this.firstDownsBy[p.teamId] = (this.firstDownsBy[p.teamId] ?? 0) + 1;
        p.down = 1;
        p.distance = Math.min(10, 100 - p.absolute);
        p.firstDownLine = Math.min(100, p.absolute + p.distance);
      } else {
        p.distance = Math.max(1, Math.round(p.firstDownLine - p.absolute));
      }
    }
    if (p.absolute >= 100) {
      p.absolute = 99;
    }
  }

  recordPlay(result, play, opts = {}) {
    if (opts.negated) return;
    // Stats are accumulated by the snap module; this hook is where drive-level
    // bookkeeping happens.
    const { recordStats } = recordStatsModule;
    recordStats(result);
  }

  afterScore(scoringTeamId) {
    // Trailing badly and out of time: try an onside kick.
    const diff = this.score[scoringTeamId] - this.score[this.opponent(scoringTeamId).id];
    const desperate = this.clock.quarter >= 4 && this.clock.clock <= 180 && diff < 0;
    if (this.clock.expired) return;
    this.recoverBetweenDrives();
    this.kickoff(scoringTeamId, { onside: desperate && this.clock.clock <= 120 });
  }

  finalize() {
    this.endDrive('game over');
    const h = this.score[this.home.id];
    const a = this.score[this.away.id];
    this.emit({
      type: 'final',
      text: `Final: ${this.away.abbr} ${a}, ${this.home.abbr} ${h}.`,
    });
  }

  result() {
    const h = this.score[this.home.id];
    const a = this.score[this.away.id];
    return {
      homeId: this.home.id, awayId: this.away.id,
      homeScore: h, awayScore: a,
      winner: h > a ? this.home.id : a > h ? this.away.id : null,
      overtime: this.clock.overtime,
      weather: this.weather,
      drives: this.drives,
      firstDowns: { ...this.firstDownsBy },
      playLog: this.playLog,
      plays: this.playLog.filter((e) => e.type === 'play').length,
    };
  }
}

// Late-bound so the module graph stays acyclic.
import * as recordStatsModule from './snap.js';
