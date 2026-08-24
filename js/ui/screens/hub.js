// The team hub: what is next, how the season is going, what just happened.

import { h, btn, panel, panelFlush, table, ovrBadge, empty, toast, chip } from '../dom.js';
import { registerScreen, state, go, refresh, userTeam, PHASES } from '../app.js';
import { REGULAR_SEASON_WEEKS } from '../../season/schedule.js';
import { standingsTable } from '../../season/standings.js';
import { bracketGames, advanceBracket } from '../../season/playoffs.js';
import { Offseason, OFFSEASON_STAGES } from '../../season/offseason.js';
import { generateWeather } from '../../sim/context.js';
import { round } from '../../core/util.js';

function nextGame() {
  const lg = state.league;
  if (lg.phase === PHASES.PLAYOFFS) {
    return bracketGames(state.season.bracket).find(
      (g) => !g.played && (g.home === lg.userTeamId || g.away === lg.userTeamId),
    ) ?? null;
  }
  // Only this week's game counts. The schedule lookup happily returns a game
  // several weeks out, which would put a bye week on the field and send the
  // "Coach this game" button to a fixture that has not come around yet.
  const next = lg.nextGameFor(lg.userTeamId);
  return next && next.week === lg.week ? next : null;
}

// Is the user's club still playing in the postseason?
function stillAlive() {
  const lg = state.league;
  if (lg.phase !== PHASES.PLAYOFFS) return true;
  const bracket = state.season?.bracket;
  if (!bracket || bracket.complete) return false;
  return bracketGames(bracket).some((g) => g.home === lg.userTeamId || g.away === lg.userTeamId);
}

function simWeek() {
  const lg = state.league;
  const season = state.season;
  if (lg.phase === PHASES.PLAYOFFS) {
    season.playPlayoffRound();
    advanceBracket(season.bracket);
    if (season.bracket.complete) {
      season.finishSeason();
      toast(`${lg.team(season.bracket.champion).fullName} win it all.`, 'good');
    } else {
      lg.week += 1;
    }
    refresh();
    return;
  }
  season.playWeek(lg.week, { userTeamId: lg.userTeamId });
  if (lg.week >= REGULAR_SEASON_WEEKS) season.startPlayoffs();
  else lg.week += 1;
  refresh();
}

function playNextGame() {
  const game = nextGame();
  if (!game) {
    toast('Nothing scheduled — it is a bye week.');
    return;
  }
  go('gameday', { scheduleGame: game });
}

// Run the league forward until the user's club is next on the field. If they
// are out of the playoffs there is no next game, so this carries the season to
// its end instead.
function simToNextUserGame() {
  const lg = state.league;
  let guard = 0;
  while (guard < 30) {
    guard += 1;
    if (lg.phase === PHASES.OFFSEASON) break;
    if (nextGame()) break;
    simWeek();
  }
  refresh();
}

function recordPanel(team) {
  const lg = state.league;
  const log = team.gameLog.slice(-6).reverse();
  return panelFlush('Recent Results',
    log.length
      ? table([
        { label: 'Wk', key: 'week', num: true },
        { label: '', render: (g) => (g.home ? 'vs' : '@') },
        { label: 'Opponent', render: (g) => lg.team(g.opponent)?.abbr ?? '' },
        { label: 'Result', render: (g) => h('span', { class: g.outcome === 'W' ? 'good' : g.outcome === 'L' ? 'bad' : '' },
          `${g.outcome} ${g.score}-${g.oppScore}${g.overtime ? ' OT' : ''}`) },
      ], log)
      : empty('No games played yet.'));
}

function divisionPanel(team) {
  const lg = state.league;
  const tbl = standingsTable(lg, lg.schedule, lg.rng);
  const rows = tbl[team.conf][team.div];
  return panelFlush(`${team.conf === 'EMPIRE' ? 'Empire' : 'Frontier'} ${team.div}`,
    table([
      { label: 'Team', render: (r) => h('span', { class: r.id === team.id ? 'good' : '' }, r.abbr) },
      { label: 'W', key: 'w', num: true },
      { label: 'L', key: 'l', num: true },
      { label: 'PF', key: 'pf', num: true },
      { label: 'PA', key: 'pa', num: true },
      { label: 'Diff', num: true, render: (r) => h('span', { class: r.diff > 0 ? 'good' : r.diff < 0 ? 'bad' : '' }, r.diff > 0 ? `+${r.diff}` : r.diff) },
    ], rows));
}

function injuryPanel(team) {
  const hurt = team.roster.filter((p) => p.injury);
  return panelFlush('Injury Report',
    hurt.length
      ? table([
        { label: 'Pos', key: 'pos', render: (p) => p.pos },
        { label: 'Player', render: (p) => p.name },
        { label: 'OVR', num: true, render: (p) => ovrBadge(p.overall()) },
        { label: 'Injury', render: (p) => p.injury.name },
        { label: 'Out', num: true, render: (p) => (p.injury.weeksOut <= 0 ? 'Probable' : `${Math.ceil(p.injury.weeksOut)} wk`) },
      ], hurt.sort((a, b) => b.injury.weeksOut - a.injury.weeksOut))
      : empty('Everybody is healthy.'));
}

function offseasonPanel() {
  const lg = state.league;
  if (!state.offseason) state.offseason = new Offseason(lg, state.season);
  const off = state.offseason;
  return panel(`Offseason — ${off.stage.name}`, h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, offseasonBlurb(off.stage.key)),
    off.log.length
      ? h('div', { class: 'scroll-y small' }, off.log.slice(-14).reverse().map((l) => h('div', { class: 'pbp__item' }, l.text)))
      : null,
    h('div', { class: 'row' },
      btn(off.complete ? 'Start the season' : `Advance to ${nextStageName(off)}`, () => {
        if (off.complete) {
          off.runAll({ userTeamId: lg.userTeamId });
          state.season.start();
          state.offseason = null;
          toast(`${lg.year} season is under way.`, 'good');
        } else {
          off.advance({ userTeamId: lg.userTeamId });
        }
        refresh();
      }, { variant: 'primary' }),
      btn('Run the whole offseason', () => {
        off.runAll({ userTeamId: lg.userTeamId });
        state.season.start();
        state.offseason = null;
        toast(`${lg.year} season is under way.`, 'good');
        refresh();
      }))));
}

function nextStageName(off) {
  return OFFSEASON_STAGES[off.stageIndex + 1]?.name ?? 'Camp';
}

function offseasonBlurb(key) {
  return {
    review: 'The season is over. Time to take stock.',
    retirements: 'Players develop, decline, and some walk away.',
    staff: 'Owners fire coaches and clubs poach coordinators.',
    contracts: 'Deals run out across the league.',
    resign: 'Your own free agents will listen to you first.',
    cuts: 'Clubs shed salary to get compliant.',
    freeAgency: 'The market opens.',
    draft: 'Seven rounds. Your scouting reports are all you have.',
    finalCuts: 'Everyone gets to fifty-three.',
    ready: 'Camp is open.',
  }[key] ?? '';
}

registerScreen('hub', {
  render() {
    const lg = state.league;
    const team = userTeam();
    if (!lg || !team) return empty('No franchise loaded.');

    if (lg.phase === PHASES.OFFSEASON) {
      return h('div', { class: 'grid grid--sidebar' },
        h('div', { class: 'stack' },
          offseasonPanel(),
          recordPanel(team)),
        h('div', { class: 'stack' },
          panelFlush('League News',
            h('div', { class: 'scroll-y' },
              lg.newsFeed.slice(0, 24).map((n) => h('div', { class: 'pbp__item' },
                h('span', { class: 'pbp__time' }, n.year),
                h('span', { class: 'pbp__text' }, n.message)))))));
    }

    const game = nextGame();
    const opponent = game ? lg.team(game.home === team.id ? game.away : game.home) : null;
    const isHome = game ? game.home === team.id : false;
    const weather = game ? generateWeather(lg.rng.fork('preview'), lg.team(game.home), lg.week) : null;

    const nextPanel = panel('Next Game', h('div', { class: 'stack' },
      game
        ? h('div', { class: 'stack' },
          h('div', { style: { fontSize: '18px', fontWeight: 700 } },
            isHome ? `vs ${opponent.fullName}` : `at ${opponent.fullName}`),
          h('div', { class: 'row small muted' },
            chip(`${opponent.recordString}`),
            chip(`OVR ${opponent.overallRating}`),
            chip(`OFF ${opponent.offenseRating}`),
            chip(`DEF ${opponent.defenseRating}`)),
          h('div', { class: 'small faint' },
            `${opponent.offScheme.name} offense · ${opponent.defScheme.name} defense`),
          weather ? h('div', { class: 'small faint' }, `Forecast: ${weather.label}`) : null,
          h('div', { class: 'row' },
            btn('Coach this game', () => playNextGame(), { variant: 'primary' }),
            btn('Simulate the week', () => simWeek())))
        : h('div', { class: 'stack' },
          h('p', { class: 'muted' }, lg.phase === PHASES.PLAYOFFS
            ? 'Your season is over. The rest of the bracket plays on.'
            : 'Bye week — no game scheduled.'),
          h('div', { class: 'row' },
            btn('Simulate the week', () => simWeek(), { variant: 'primary' }),
            btn(stillAlive() ? 'Sim to my next game' : 'Sim to the offseason',
              () => simToNextUserGame())))));

    const unitPanel = panel('Team Report', h('div', { class: 'stack' },
      h('div', { class: 'row' },
        chip(`Overall ${team.overallRating}`),
        chip(`Offense ${team.offenseRating}`),
        chip(`Defense ${team.defenseRating}`),
        chip(`Special ${team.specialTeamsRating}`)),
      h('div', { class: 'row' },
        chip(`Chemistry ${Math.round(team.chemistry)}`, { variant: team.chemistry > 70 ? 'good' : team.chemistry < 45 ? 'bad' : '' }),
        chip(`Owner patience ${Math.round(team.ownerPatience)}`, { variant: team.ownerPatience > 60 ? 'good' : team.ownerPatience < 30 ? 'bad' : 'warn' })),
      h('div', { class: 'section-title', style: { marginTop: '8px' } }, "Owner's Goals"),
      team.ownerGoals.length
        ? team.ownerGoals.map((g) => h('div', { class: 'small' }, '• ', g.text))
        : h('div', { class: 'small faint' }, 'None stated.'),
      h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Biggest Needs'),
      team.positionNeeds().slice(0, 4).map((n) =>
        h('div', { class: 'small' }, `• ${n.pos} — ${n.have} on the roster, starters grade ${n.quality}`))));

    return h('div', { class: 'grid grid--sidebar' },
      h('div', { class: 'stack' },
        nextPanel,
        h('div', { class: 'grid grid--2' }, recordPanel(team), divisionPanel(team)),
        injuryPanel(team)),
      h('div', { class: 'stack' },
        unitPanel,
        panelFlush('League News',
          h('div', { class: 'scroll-y' },
            lg.newsFeed.slice(0, 20).map((n) => h('div', { class: 'pbp__item' },
              h('span', { class: 'pbp__time' }, `W${n.week}`),
              h('span', { class: 'pbp__text' }, n.message)))))));
  },
});
