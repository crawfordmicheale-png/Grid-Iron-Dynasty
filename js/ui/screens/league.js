// Standings, leaders, the bracket, and the transaction wire.

import { h, chip, panel, panelFlush, table, ovrBadge, empty } from '../dom.js';
import { registerScreen, state, refresh, userTeam } from '../app.js';
import { standingsTable } from '../../season/standings.js';
import { bracketGames, ROUNDS } from '../../season/playoffs.js';
import { CONFERENCES, DIVISIONS, CHAMPIONSHIP_NAME } from '../../data/teams.js';
import { PHASES } from '../../model/league.js';
import { byDesc, money, passerRating, round } from '../../core/util.js';

let tab = 'standings';

function standingsView(lg) {
  const tbl = standingsTable(lg, lg.schedule, lg.rng);
  return h('div', { class: 'grid grid--2' },
    Object.keys(CONFERENCES).map((conf) =>
      h('div', { class: 'stack' },
        h('h3', { class: 'section-title' }, CONFERENCES[conf].name),
        DIVISIONS.map((div) => panelFlush(div,
          table([
            { label: 'Team', render: (r) => h('span', { class: r.id === lg.userTeamId ? 'good' : '' }, r.name) },
            { label: 'W', key: 'w', num: true },
            { label: 'L', key: 'l', num: true },
            { label: 'T', num: true, render: (r) => (r.t || '') },
            { label: 'Div', render: (r) => h('span', { class: 'small faint' }, r.div) },
            { label: 'Conf', render: (r) => h('span', { class: 'small faint' }, r.conf) },
            { label: 'PF', key: 'pf', num: true },
            { label: 'PA', key: 'pa', num: true },
            { label: 'Diff', num: true, render: (r) => h('span', { class: r.diff > 0 ? 'good' : r.diff < 0 ? 'bad' : '' }, r.diff > 0 ? `+${r.diff}` : r.diff) },
          ], tbl[conf][div]))))));
}

function leadersView(lg) {
  const all = lg.allPlayers();
  const top = (key, n = 8, filter = () => true) => all
    .filter((p) => (p.stat(key) ?? 0) > 0 && filter(p))
    .sort(byDesc((p) => p.stat(key)))
    .slice(0, n);

  const board = (title, key, extra) => panelFlush(title,
    table([
      { label: 'Player', render: (p) => h('span', {}, p.shortName, h('span', { class: 'faint small' }, ` ${lg.team(p.teamId)?.abbr ?? ''}`)) },
      { label: 'Pos', render: (p) => p.pos },
      { label: title.split(' ').pop(), num: true, render: (p) => p.stat(key) },
      ...(extra ?? []),
    ], top(key)));

  return h('div', { class: 'grid grid--3' },
    board('Passing Yards', 'passYds', [
      { label: 'TD', num: true, render: (p) => p.stat('passTD') },
      { label: 'Rating', num: true, render: (p) => passerRating(p.stat('passAtt'), p.stat('passCmp'), p.stat('passYds'), p.stat('passTD'), p.stat('passInt')) },
    ]),
    board('Rushing Yards', 'rushYds', [{ label: 'TD', num: true, render: (p) => p.stat('rushTD') }]),
    board('Receiving Yards', 'recYds', [{ label: 'Rec', num: true, render: (p) => p.stat('rec') }]),
    board('Sacks', 'sacks'),
    board('Tackles', 'tackles'),
    board('Interceptions', 'int'));
}

function bracketView(lg) {
  const bracket = state.season?.bracket ?? lg.playoffs;
  if (!bracket) return panel('Playoffs', h('p', { class: 'muted' }, 'The bracket is set after week 18.'));
  return h('div', { class: 'grid grid--2' },
    Object.keys(ROUNDS).map((key) => {
      const games = bracket.rounds[key];
      if (!games) return null;
      return panelFlush(ROUNDS[key].name,
        table([
          { label: 'Matchup', render: (g) => h('span', {},
            `(${g.awaySeed}) ${lg.team(g.away).abbr} at (${g.homeSeed}) ${lg.team(g.home).abbr}`) },
          { label: 'Result', render: (g) => (g.played
            ? h('span', { class: 'mono' }, `${g.result.awayScore}–${g.result.homeScore}`)
            : h('span', { class: 'faint' }, 'scheduled')) },
          { label: 'Winner', render: (g) => (g.played
            ? h('span', { class: 'good' }, lg.team(g.result.homeScore > g.result.awayScore ? g.home : g.away).abbr)
            : '') },
        ], games));
    }).filter(Boolean),
    bracket.champion ? panel(CHAMPIONSHIP_NAME,
      h('div', { style: { fontSize: '20px', fontWeight: 700 } }, lg.team(bracket.champion).fullName)) : null);
}

function historyView(lg) {
  return h('div', { class: 'grid grid--2' },
    panelFlush('Season History',
      lg.history.length
        ? table([
          { label: 'Year', render: (s) => s.year },
          { label: 'Champion', render: (s) => lg.team(s.champion)?.fullName ?? '—' },
          { label: 'MVP', render: (s) => (s.awards?.mvp ? `${s.awards.mvp.pos} ${s.awards.mvp.name}` : '—') },
          { label: 'DPOY', render: (s) => (s.awards?.dpoy ? `${s.awards.dpoy.pos} ${s.awards.dpoy.name}` : '—') },
        ], lg.history.slice().reverse())
        : empty('No completed seasons yet.')),
    panelFlush('Transaction Wire',
      lg.transactions.length
        ? h('div', { class: 'scroll-y' }, lg.transactions.slice(0, 60).map((t) =>
          h('div', { class: 'pbp__item' },
            h('span', { class: 'pbp__time' }, t.year),
            h('span', { class: 'pbp__text' },
              `${t.kind}: ${t.name ?? ''} ${t.pos ? `(${t.pos})` : ''} ${lg.team(t.teamId)?.abbr ?? ''}`,
              t.apy ? ` — ${money(t.apy)}/yr` : ''))))
        : empty('Nothing yet.')));
}

registerScreen('league', {
  render() {
    const lg = state.league;
    if (!lg) return empty('No franchise loaded.');

    const tabs = h('div', { class: 'row', style: { marginBottom: '14px' } },
      chip('Standings', { on: tab === 'standings', onclick: () => { tab = 'standings'; refresh(); } }),
      chip('Leaders', { on: tab === 'leaders', onclick: () => { tab = 'leaders'; refresh(); } }),
      chip('Playoffs', { on: tab === 'bracket', onclick: () => { tab = 'bracket'; refresh(); } }),
      chip('History', { on: tab === 'history', onclick: () => { tab = 'history'; refresh(); } }));

    const body = tab === 'standings' ? standingsView(lg)
      : tab === 'leaders' ? leadersView(lg)
        : tab === 'bracket' ? bracketView(lg)
          : historyView(lg);

    return h('div', { class: 'stack' }, tabs, body);
  },
});
