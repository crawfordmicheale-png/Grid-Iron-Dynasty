// Roster and depth chart, with a full scouting card on every player.

import { h, btn, chip, panel, panelFlush, table, ovrBadge, bar, empty, modal, closeModal, toast } from '../dom.js';
import { registerScreen, state, refresh, userTeam } from '../app.js';
import { POSITIONS, POSITION_KEYS } from '../../data/positions.js';
import { ATTRIBUTES, ATTR_GROUPS } from '../../data/attributes.js';
import { TRAITS } from '../../data/traits.js';
import { schemeFit, fitGrade } from '../../data/schemes.js';
import { marketValue } from '../../model/contract.js';
import { releasePlayer } from '../../season/freeAgency.js';
import { money, heightString, round, byDesc } from '../../core/util.js';

let sortKey = 'ovr';
let posFilter = 'ALL';

export function playerCard(player, team) {
  const lg = state.league;
  const def = POSITIONS[player.pos];
  const scheme = def.unit === 'DEF' ? team.defScheme : team.offScheme;
  const fit = schemeFit(player, scheme);
  const grade = fitGrade(fit);

  // Group the ratings the way a coach reads them.
  const groups = new Map();
  for (const attr of def.attrs) {
    const g = ATTRIBUTES[attr].group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(attr);
  }

  const ratingBlock = Array.from(groups.entries()).map(([group, attrs]) =>
    h('div', { class: 'stack', style: { marginBottom: '10px' } },
      h('div', { class: 'section-title' }, ATTR_GROUPS[group] ?? group),
      attrs.map((attr) => {
        const v = player.rating(attr);
        const cap = player.cap(attr);
        return h('div', { class: 'stat-row', title: ATTRIBUTES[attr].desc },
          h('span', { class: 'stat-row__label' }, ATTRIBUTES[attr].abbr),
          h('span', { style: { flex: 1, margin: '0 10px' } },
            h('div', { class: 'bar' },
              h('div', { class: 'bar__fill', style: { width: `${cap}%`, background: 'rgba(255,255,255,.14)', position: 'absolute', inset: 0 } }),
              h('div', { class: 'bar__fill', style: { width: `${v}%` } }))),
          h('span', { class: 'stat-row__value' }, v, cap > v ? h('span', { class: 'faint small' }, ` /${cap}`) : null));
      })));

  const c = player.contract;
  const ly = lg.leagueYear;

  return h('div', { class: 'stack' },
    h('div', { class: 'row' },
      ovrBadge(player.overall()),
      h('span', { style: { fontSize: '18px', fontWeight: 700 } }, player.name),
      chip(player.pos), chip(`#${player.jersey}`),
      chip(`${player.age} yrs`), chip(`${heightString(player.height)}, ${player.weight} lb`),
      chip(player.college)),
    h('div', { class: 'row small muted' },
      h('span', {}, player.archetypeName),
      h('span', {}, '·'),
      h('span', {}, `${player.exp === 0 ? 'Rookie' : `${player.exp} seasons`}`),
      h('span', {}, '·'),
      chip(grade.label, { variant: fit > 2.5 ? 'good' : fit < -2 ? 'bad' : '' }),
      chip(`Potential ${player.potentialOverall()}`),
      chip(`${player.dev} development`)),
    player.injury ? h('div', { class: 'row' },
      chip(`${player.injury.name} — ${Math.max(0, Math.ceil(player.injury.weeksOut))} weeks`, { variant: 'bad' })) : null,
    h('div', { class: 'row' },
      player.traits.map((t) => chip(TRAITS[t]?.name ?? t, {
        variant: TRAITS[t]?.good === true ? 'good' : TRAITS[t]?.good === false ? 'bad' : 'warn',
        title: TRAITS[t]?.desc,
      }))),
    h('div', { class: 'grid grid--2' },
      h('div', {},
        h('div', { class: 'section-title' }, 'Contract'),
        c ? h('div', { class: 'stack' },
          h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Cap hit'), h('span', { class: 'stat-row__value' }, money(c.capHit(ly)))),
          h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Years left'), h('span', { class: 'stat-row__value' }, Math.max(0, c.years - c.yearIndex(ly)))),
          h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Average value'), h('span', { class: 'stat-row__value' }, money(c.apy))),
          h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Dead money if cut'), h('span', { class: 'stat-row__value bad' }, money(c.releaseCost(ly).thisYear))),
          h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Market value'), h('span', { class: 'stat-row__value' }, `${money(marketValue(player, lg.salaryCap))}/yr`)))
          : h('p', { class: 'small faint' }, 'No contract.'),
        h('div', { class: 'section-title', style: { marginTop: '12px' } }, 'Condition'),
        h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Morale'), h('span', { class: 'stat-row__value' }, Math.round(player.morale))),
        h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Snaps this season'), h('span', { class: 'stat-row__value' }, player.snapCount)),
        player.accolades.length ? h('div', {},
          h('div', { class: 'section-title', style: { marginTop: '12px' } }, 'Honours'),
          player.accolades.slice(-6).map((a) => h('div', { class: 'small' }, `${a.year} — ${a.label}`))) : null),
      h('div', { style: { maxHeight: '340px', overflowY: 'auto' } }, ratingBlock)));
}

function openPlayer(player, team) {
  const lg = state.league;
  modal({
    title: `${player.pos} ${player.name}`,
    body: playerCard(player, team),
    actions: [
      btn('Release', () => {
        const cost = player.contract?.releaseCost(lg.leagueYear);
        if (!confirm(`Release ${player.name}? Dead money: ${money(cost?.thisYear ?? 0)}.`)) return;
        releasePlayer(lg, team, player, false);
        closeModal();
        toast(`${player.name} released.`, 'bad');
        refresh();
      }, { variant: 'danger' }),
      btn('Close', () => closeModal()),
    ],
  });
}

function depthChartPanel(team) {
  const lg = state.league;
  const positions = posFilter === 'ALL' ? POSITION_KEYS : [posFilter];
  return positions.map((pos) => {
    const ids = team.depthChart[pos] ?? [];
    const players = ids.map((id) => team.findPlayer(id)).filter(Boolean);
    if (!players.length) return null;
    const scheme = POSITIONS[pos].unit === 'DEF' ? team.defScheme : team.offScheme;
    return panelFlush(`${POSITIONS[pos].name} (${pos})`,
      table([
        { label: '#', width: '34px', render: (_, i) => h('span', { class: 'mono faint' }, i + 1) },
        { label: 'Player', render: (p) => h('span', {}, p.name, p.injury ? h('span', { class: 'bad small' }, ' ✚') : null) },
        { label: 'Age', num: true, render: (p) => p.age },
        { label: 'OVR', num: true, render: (p) => ovrBadge(p.overall()) },
        { label: 'POT', num: true, render: (p) => h('span', { class: 'faint mono' }, p.potentialOverall()) },
        { label: 'Fit', render: (p) => {
          const f = schemeFit(p, scheme);
          return h('span', { class: f > 2.5 ? 'good' : f < -2 ? 'bad' : 'faint' }, fitGrade(f).label);
        } },
        { label: 'Archetype', render: (p) => h('span', { class: 'small faint' }, p.archetypeName) },
        { label: 'Cap', num: true, render: (p) => h('span', { class: 'small' }, money(p.contract?.capHit(lg.leagueYear) ?? 0)) },
        { label: '', render: (p, i) => h('div', { class: 'row' },
          i > 0 ? btn('▲', (e) => {
            e.stopPropagation();
            const order = ids.slice();
            [order[i - 1], order[i]] = [order[i], order[i - 1]];
            team.lockDepthSlot(pos, order);
            refresh();
          }, { small: true, class: 'btn--ghost' }) : null) },
      ], players, { onRow: (p) => openPlayer(p, team) }),
      [btn('Auto', () => { team.clearDepthLocks(pos); refresh(); }, { small: true, title: 'Clear manual ordering' })]);
  }).filter(Boolean);
}

registerScreen('roster', {
  render() {
    const team = userTeam();
    const lg = state.league;
    if (!team) return empty('No franchise loaded.');

    const all = team.roster.slice().sort(byDesc((p) => (sortKey === 'ovr' ? p.overall()
      : sortKey === 'age' ? -p.age
        : sortKey === 'cap' ? (p.contract?.capHit(lg.leagueYear) ?? 0)
          : p.potentialOverall())));

    const filters = h('div', { class: 'row', style: { marginBottom: '14px' } },
      chip('All', { on: posFilter === 'ALL', onclick: () => { posFilter = 'ALL'; refresh(); } }),
      POSITION_KEYS.map((p) => chip(p, { on: posFilter === p, onclick: () => { posFilter = p; refresh(); } })),
      h('span', { class: 'spacer' }),
      h('span', { class: 'small faint' }, 'Sort'),
      ['ovr', 'pot', 'age', 'cap'].map((k) => chip(k.toUpperCase(), { on: sortKey === k, onclick: () => { sortKey = k; refresh(); } })));

    return h('div', { class: 'stack' },
      filters,
      h('div', { class: 'grid grid--2' },
        panelFlush(`Roster (${team.roster.length}/53)`,
          h('div', { class: 'scroll-y scroll-y--tall' },
            table([
              { label: 'Pos', render: (p) => p.pos },
              { label: 'Player', render: (p) => h('span', {}, p.name, p.injury ? h('span', { class: 'bad small' }, ' ✚') : null) },
              { label: 'Age', num: true, render: (p) => p.age },
              { label: 'OVR', num: true, render: (p) => ovrBadge(p.overall()) },
              { label: 'POT', num: true, render: (p) => h('span', { class: 'faint mono' }, p.potentialOverall()) },
              { label: 'Cap', num: true, render: (p) => h('span', { class: 'small' }, money(p.contract?.capHit(lg.leagueYear) ?? 0)) },
            ], all, { onRow: (p) => openPlayer(p, team) }))),
        h('div', { class: 'stack' }, depthChartPanel(team))));
  },
});
