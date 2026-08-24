// Game day. You call the plays; the staff handles everything else.

import { h, btn, chip, empty, modal, closeModal } from '../dom.js';
import { registerScreen, state, go, refresh, userTeam } from '../app.js';
import { Game } from '../../sim/game.js';
import { FieldRenderer } from '../field.js';
import { applyGameResult } from '../../season/standings.js';
import { advanceBracket } from '../../season/playoffs.js';
import { PASS_CONCEPTS } from '../../data/passConcepts.js';
import { RUN_CONCEPTS } from '../../data/runConcepts.js';
import { FORMATIONS, PERSONNEL } from '../../data/formations.js';
import { REGULAR_SEASON_WEEKS } from '../../season/schedule.js';
import { clockString, downDistance, fieldPosName, round } from '../../core/util.js';

let renderer = null;
let previewPlay = null;
let filter = { type: 'all', tag: null, search: '' };

function ensureGame(scratch) {
  if (state.game && state.gameMeta?.game === scratch.scheduleGame) return state.game;
  const lg = state.league;
  const g = scratch.scheduleGame;
  const home = lg.team(g.home);
  const away = lg.team(g.away);
  const homeBooks = state.season.booksFor(home);
  const awayBooks = state.season.booksFor(away);

  for (const t of [home, away]) for (const p of t.roster) p.fatigue = 100;

  const game = new Game({
    rng: lg.rng,
    home, away,
    week: g.week ?? lg.week,
    playoffs: Boolean(g.round),
    primetime: g.primetime ?? false,
    neutralSite: g.neutralSite ?? false,
    homeOffBook: homeBooks.off, homeDefBook: homeBooks.def,
    awayOffBook: awayBooks.off, awayDefBook: awayBooks.def,
    userTeamId: lg.userTeamId,
  });
  game.begin();
  state.game = game;
  state.gameMeta = { game: g };
  advanceToDecision(game);
  return game;
}

/** Run plays until the user has to call one, or the game ends. */
function advanceToDecision(game, maxPlays = 400) {
  let guard = 0;
  while (!game.finished && guard < maxPlays && !game.awaitingUserCall()) {
    guard += 1;
    game.step();
  }
}

function finishGame(game) {
  const lg = state.league;
  const meta = state.gameMeta.game;
  const result = game.result();
  result.firstDowns = game.firstDownsBy;

  if (meta.round) {
    meta.result = result;
    meta.played = true;
    state.season.recordGameLog({ ...meta, week: lg.week }, result);
    advanceBracket(state.season.bracket);
    if (state.season.bracket.complete) state.season.finishSeason();
    else lg.week += 1;
  } else {
    applyGameResult(lg, meta, result);
    state.season.recordGameLog(meta, result);
    // Play out the rest of the league's week.
    state.season.playWeek(meta.week, { userTeamId: lg.userTeamId, skipPractice: true });
    if (meta.week >= REGULAR_SEASON_WEEKS) state.season.startPlayoffs();
    else lg.week = Math.max(lg.week, meta.week + 1);
  }
  state.game = null;
  state.gameMeta = null;
  return result;
}

// --- Rendering ---------------------------------------------------------------

function scoreboard(game) {
  const home = game.home;
  const away = game.away;
  const p = game.possession;
  const poss = p ? game.team(p.teamId) : null;
  return h('div', { class: 'scoreboard' },
    h('div', { class: 'sb-team sb-team--away' },
      h('span', { class: 'sb-team__bar', style: { background: away.colors[0] } }),
      h('div', {},
        h('div', { class: 'sb-team__name' }, away.abbr, poss?.id === away.id ? ' ●' : ''),
        h('div', { class: 'sb-team__rec' }, away.recordString)),
      h('div', { class: 'sb-team__score' }, game.score[away.id])),
    h('div', { class: 'sb-center' },
      h('div', { class: 'sb-center__qtr' }, game.clock.overtime ? 'Overtime' : `Quarter ${game.clock.quarter}`),
      h('div', { class: 'sb-center__clock' }, clockString(game.clock.clock)),
      p ? h('div', { class: 'sb-center__dd' },
        `${downDistance(p.down, p.distance, p.absolute)} · ${fieldPosName(p.absolute)}`) : null,
      h('div', { class: 'sb-center__extra' },
        `Timeouts ${game.timeouts[away.id]}–${game.timeouts[home.id]}`,
        game.weather?.label && !game.weather.indoor ? ` · ${game.weather.label}` : '')),
    h('div', { class: 'sb-team sb-team--home' },
      h('span', { class: 'sb-team__bar', style: { background: home.colors[0] } }),
      h('div', { style: { textAlign: 'right' } },
        h('div', { class: 'sb-team__name' }, poss?.id === home.id ? '● ' : '', home.abbr),
        h('div', { class: 'sb-team__rec' }, home.recordString)),
      h('div', { class: 'sb-team__score' }, game.score[home.id])));
}

function playByPlay(game) {
  const items = game.playLog.slice(-160).reverse();
  return h('div', { class: 'pbp' },
    items.map((e) => {
      const cls = e.type === 'score' ? 'pbp__item--score'
        : e.result?.turnover || e.type === 'turnoverOnDowns' ? 'pbp__item--turnover'
          : ['driveStart', 'quarterEnd', 'halftime', 'twoMinuteWarning', 'adjustments', 'kickoffStart'].includes(e.type) ? 'pbp__item--meta'
            : (e.result?.yards ?? 0) >= 20 ? 'pbp__item--big' : '';
      if (e.type === 'score') return null;
      return h('div', { class: `pbp__item ${cls}` },
        h('span', { class: 'pbp__time' }, `Q${e.quarter} ${clockString(e.clockSeconds)}`),
        h('span', { class: 'pbp__text' }, e.text ?? e.type));
    }).filter(Boolean));
}

function playCard(play, game) {
  const concept = play.type === 'pass' ? PASS_CONCEPTS[play.concept] : RUN_CONCEPTS[play.concept];
  const formation = FORMATIONS[play.formation];
  const team = userTeam();
  const installed = (team.gameplan?.familiarity?.[play.id] ?? 0) > 0.5;
  return h('button', {
    class: `playcard ${installed ? 'playcard--installed' : ''}`,
    onmouseenter: () => { previewPlay = play; drawField(game); },
    onfocus: () => { previewPlay = play; drawField(game); },
    onclick: () => callPlay(game, play),
    title: concept?.desc ?? '',
  },
  h('span', { class: 'playcard__name' }, play.shortName),
  h('span', { class: `playcard__tag playcard__tag--${play.type}` }, play.type === 'pass' ? 'PASS' : 'RUN'),
  h('span', { class: 'playcard__meta' },
    `${formation.name} · ${PERSONNEL[play.personnel]?.name ?? play.personnel}`,
    play.type === 'pass' ? ` · ${play.timing}s` : ` · ${play.aimGap} gap`));
}

function callSheet(game) {
  const lg = state.league;
  const team = userTeam();
  const book = state.season.booksFor(team).off;
  const p = game.possession;
  const sit = p ? game.situationFor(p.teamId) : null;

  let plays = book.all;
  if (filter.type !== 'all') plays = plays.filter((x) => x.type === filter.type);
  if (filter.tag) plays = plays.filter((x) => x.tags.includes(filter.tag));
  if (filter.search) {
    const q = filter.search.toLowerCase();
    plays = plays.filter((x) => x.name.toLowerCase().includes(q) || x.shortName.toLowerCase().includes(q));
  }
  // Installed plays first, then the ones that suit the situation.
  const tagsNow = sit ? situationTags(sit) : [];
  const score = (x) => (team.gameplan?.familiarity?.[x.id] ?? 0)
    + tagsNow.filter((t) => x.tags.includes(t)).length * 0.5;
  const ranked = plays.slice().sort((a, b) => score(b) - score(a));
  if (filter.type === 'all') {
    // Interleave so the sheet does not open as a wall of one play type.
    const passes = ranked.filter((x) => x.type === 'pass');
    const runs = ranked.filter((x) => x.type === 'run');
    const mixed = [];
    while (passes.length || runs.length) {
      if (passes.length) mixed.push(passes.shift());
      if (passes.length) mixed.push(passes.shift());
      if (runs.length) mixed.push(runs.shift());
    }
    plays = mixed.slice(0, 90);
  } else {
    plays = ranked.slice(0, 90);
  }

  const tagChip = (label, value) => chip(label, {
    on: filter.tag === value,
    onclick: () => { filter.tag = filter.tag === value ? null : value; refresh(); },
  });

  return h('div', { class: 'callsheet' },
    h('div', { class: 'callsheet__filters' },
      chip('All', { on: filter.type === 'all', onclick: () => { filter.type = 'all'; refresh(); } }),
      chip('Pass', { on: filter.type === 'pass', onclick: () => { filter.type = 'pass'; refresh(); } }),
      chip('Run', { on: filter.type === 'run', onclick: () => { filter.type = 'run'; refresh(); } }),
      tagChip('Quick', 'quickGame'),
      tagChip('Shot', 'shot'),
      tagChip('Screen', 'screen'),
      tagChip('Short yds', 'shortYardage'),
      tagChip('Red zone', 'redZone'),
      tagChip('Play action', 'playAction'),
      h('input', {
        type: 'text', placeholder: 'search…', value: filter.search,
        style: { flex: '1 1 100px' },
        oninput: (e) => { filter.search = e.target.value; },
        onchange: () => refresh(),
      })),
    h('div', { class: 'callsheet__list' },
      plays.length ? plays.map((x) => playCard(x, game)) : empty('No plays match that filter.')));
}

function situationTags(sit) {
  const tags = [];
  if (sit.down >= 3 && sit.distance >= 7) tags.push('thirdAndLong', 'needChunk');
  if (sit.down >= 3 && sit.distance <= 2) tags.push('thirdAndShort', 'shortYardage');
  if (sit.distance <= 2) tags.push('shortYardage');
  if (sit.absolute >= 80) tags.push('redZone');
  if (sit.absolute >= 95) tags.push('goalLine');
  if (sit.hurry) tags.push('twoMinute', 'sideline');
  return tags;
}

function callPlay(game, play) {
  previewPlay = null;
  game.step(play);
  advanceToDecision(game);
  if (game.finished) endOfGame(game);
  else refresh();
}

function endOfGame(game) {
  const result = game.result();
  const lg = state.league;
  const team = userTeam();
  const mine = result.homeId === team.id ? result.homeScore : result.awayScore;
  const theirs = result.homeId === team.id ? result.awayScore : result.homeScore;
  const opp = lg.team(result.homeId === team.id ? result.awayId : result.homeId);

  finishGame(game);
  modal({
    title: mine > theirs ? 'Win' : mine < theirs ? 'Loss' : 'Tie',
    body: h('div', { class: 'stack' },
      h('div', { style: { fontSize: '26px', fontWeight: 700 } },
        `${team.abbr} ${mine} — ${theirs} ${opp.abbr}`),
      boxScore(result, lg)),
    actions: [btn('Back to the team', () => { closeModal(); go('hub'); }, { variant: 'primary' })],
    onClose: () => go('hub'),
  });
}

function boxScore(result, lg) {
  const rows = [];
  for (const teamId of [result.awayId, result.homeId]) {
    const team = lg.team(teamId);
    const passers = team.roster.filter((p) => (p.stat('passAtt') ?? 0) > 0)
      .sort((a, b) => b.stat('passYds') - a.stat('passYds')).slice(0, 1);
    const rushers = team.roster.filter((p) => (p.stat('rushAtt') ?? 0) > 0)
      .sort((a, b) => b.stat('rushYds') - a.stat('rushYds')).slice(0, 2);
    const receivers = team.roster.filter((p) => (p.stat('rec') ?? 0) > 0)
      .sort((a, b) => b.stat('recYds') - a.stat('recYds')).slice(0, 3);
    rows.push(h('div', { class: 'stack' },
      h('div', { class: 'section-title' }, team.fullName),
      passers.map((p) => h('div', { class: 'small' },
        `${p.shortName}: ${p.stat('passCmp')}/${p.stat('passAtt')}, ${p.stat('passYds')} yds, ${p.stat('passTD')} TD, ${p.stat('passInt')} INT`)),
      rushers.map((p) => h('div', { class: 'small' },
        `${p.shortName}: ${p.stat('rushAtt')} car, ${p.stat('rushYds')} yds, ${p.stat('rushTD')} TD`)),
      receivers.map((p) => h('div', { class: 'small' },
        `${p.shortName}: ${p.stat('rec')} rec, ${p.stat('recYds')} yds, ${p.stat('recTD')} TD`))));
  }
  return h('div', { class: 'grid grid--2' }, rows);
}

function drawField(game) {
  if (!renderer) return;
  const lg = state.league;
  const p = game.possession;
  const team = userTeam();
  if (!p) return;
  const offense = game.team(p.teamId);
  const defense = game.opponent(p.teamId);
  renderer.draw({
    absolute: p.absolute,
    firstDownLine: p.firstDownLine,
    homeColors: offense.colors,
    awayColors: defense.colors,
    leftToRight: true,
    offenseAbbr: offense.abbr,
    defenseAbbr: defense.abbr,
    play: previewPlay,
    lastResultYards: game.playLog.filter((e) => e.type === 'play').slice(-1)[0]?.result?.yards ?? null,
  });
}

registerScreen('gameday', {
  flush: true,
  hideNav: true,
  render() {
    const lg = state.league;
    const scratch = state.scratch;
    if (!scratch.scheduleGame && !state.game) {
      return empty('No game to play.');
    }
    const game = ensureGame(scratch.scheduleGame ? scratch : { scheduleGame: state.gameMeta.game });

    if (game.finished) {
      queueMicrotask(() => endOfGame(game));
      return empty('Final.');
    }

    const canvas = h('canvas', { class: 'field' });
    queueMicrotask(() => {
      renderer = new FieldRenderer(canvas);
      drawField(game);
    });

    const waiting = game.awaitingUserCall();

    return h('div', { class: 'gameday' },
      h('div', { class: 'gameday__main' },
        scoreboard(game),
        h('div', { class: 'fieldwrap' }, canvas),
        h('div', { class: 'controls' },
          waiting
            ? h('span', { class: 'small good' }, 'Your ball. Call a play from the sheet.')
            : h('span', { class: 'small faint' }, 'Defense is on the field.'),
          h('span', { class: 'spacer' }),
          btn('Sim this drive', () => {
            const startTeam = game.possession?.teamId;
            let guard = 0;
            while (!game.finished && guard < 60 && game.possession?.teamId === startTeam) {
              guard += 1;
              if (game.awaitingUserCall()) {
                const book = state.season.booksFor(userTeam()).off;
                game.step(lg.rng.pick(book.all));
              } else game.step();
            }
            advanceToDecision(game);
            if (game.finished) endOfGame(game); else refresh();
          }),
          btn('Sim to the end', () => {
            let guard = 0;
            while (!game.finished && guard < 600) {
              guard += 1;
              if (game.awaitingUserCall()) {
                const book = state.season.booksFor(userTeam()).off;
                game.step(lg.rng.pick(book.all));
              } else game.step();
            }
            endOfGame(game);
          }, { variant: 'primary' }),
          btn('Leave', () => {
            if (confirm('Abandon this game? The result will be simulated.')) {
              let guard = 0;
              while (!game.finished && guard < 600) { guard += 1; game.step(); }
              endOfGame(game);
            }
          })),
        h('div', { style: { flex: 1, minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--line)' } },
          playByPlay(game))),
      h('aside', { class: 'gameday__side' },
        waiting ? callSheet(game) : h('div', { class: 'stack', style: { padding: '14px' } },
          h('div', { class: 'section-title' }, 'Defense'),
          h('p', { class: 'small muted' },
            'Your coordinator is calling it. Use the controls to move the game along.'),
          btn('Run the next play', () => {
            game.step();
            advanceToDecision(game);
            if (game.finished) endOfGame(game); else refresh();
          }, { variant: 'primary', block: true }))));
  },
});
