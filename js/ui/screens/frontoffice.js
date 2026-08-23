// Cap sheet, free agency, and the draft board.

import { h, btn, chip, panel, panelFlush, table, ovrBadge, empty, modal, closeModal, toast } from '../dom.js';
import { registerScreen, state, refresh, userTeam } from '../app.js';
import { playerCard } from './roster.js';
import { marketValue, buildContract, minSalary } from '../../model/contract.js';
import { releasePlayer, restructureContract, teamOffer, playerPreference } from '../../season/freeAgency.js';
import { scoutProspect, prospectValue } from '../../season/draft.js';
import { schemeFit, fitGrade } from '../../data/schemes.js';
import { POSITIONS } from '../../data/positions.js';
import { PHASES } from '../../model/league.js';
import { money, byDesc, round } from '../../core/util.js';

let tab = 'cap';

function capTab(team, lg) {
  const ly = lg.leagueYear;
  const contracts = team.roster.slice().sort(byDesc((p) => p.contract?.capHit(ly) ?? 0));
  const dead = team.deadMoney[ly] ?? 0;

  return h('div', { class: 'grid grid--sidebar' },
    panelFlush('Salary Cap Sheet',
      h('div', { class: 'scroll-y scroll-y--tall' },
        table([
          { label: 'Pos', render: (p) => p.pos },
          { label: 'Player', render: (p) => p.name },
          { label: 'Age', num: true, render: (p) => p.age },
          { label: 'OVR', num: true, render: (p) => ovrBadge(p.overall()) },
          { label: 'Cap hit', num: true, render: (p) => money(p.contract?.capHit(ly) ?? 0) },
          { label: 'Yrs', num: true, render: (p) => Math.max(0, (p.contract?.years ?? 0) - (p.contract?.yearIndex(ly) ?? 0)) },
          { label: 'Dead', num: true, render: (p) => h('span', { class: 'faint' }, money(p.contract?.releaseCost(ly).thisYear ?? 0)) },
          { label: 'Value', num: true, render: (p) => {
            const hit = p.contract?.capHit(ly) ?? 0;
            const worth = marketValue(p, lg.salaryCap);
            const ratio = hit / Math.max(1, worth);
            return h('span', { class: ratio > 1.35 ? 'bad' : ratio < 0.7 ? 'good' : 'faint' },
              ratio > 1.35 ? 'Overpaid' : ratio < 0.7 ? 'Bargain' : 'Fair');
          } },
          { label: '', render: (p) => h('div', { class: 'row' },
            btn('Restructure', (e) => {
              e.stopPropagation();
              const saved = restructureContract(p, ly);
              if (saved > 0) toast(`Freed ${money(saved)} — added to future dead money.`, 'good');
              else toast('Nothing left to restructure on that deal.', 'bad');
              refresh();
            }, { small: true, disabled: (p.contract?.restructureRoom(ly) ?? 0) < 500000 })) },
        ], contracts, { onRow: (p) => modal({ title: p.name, body: playerCard(p, team), actions: [btn('Close', () => closeModal())] }) }))),

    h('div', { class: 'stack' },
      panel('Cap Position', h('div', { class: 'stack' },
        h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Salary cap'), h('span', { class: 'stat-row__value' }, money(lg.salaryCap))),
        h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Committed'), h('span', { class: 'stat-row__value' }, money(team.capHitTotal(ly)))),
        h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Dead money'), h('span', { class: 'stat-row__value bad' }, money(dead))),
        h('div', { class: 'stat-row' },
          h('span', { class: 'stat-row__label' }, 'Space'),
          h('span', { class: `stat-row__value ${team.capSpace(ly, ly) < 0 ? 'bad' : 'good'}` }, money(team.capSpace(ly, ly)))),
        h('div', { class: 'stat-row' }, h('span', { class: 'stat-row__label' }, 'Roster'), h('span', { class: 'stat-row__value' }, `${team.roster.length}/53`)))),
      panel('Future Commitments', h('div', { class: 'stack' },
        [0, 1, 2, 3].map((offset) => {
          const y = ly + offset;
          const total = team.roster.reduce((s, p) => s + (p.contract?.capHit(y) ?? 0), 0) + (team.deadMoney[y] ?? 0);
          return h('div', { class: 'stat-row' },
            h('span', { class: 'stat-row__label' }, lg.startYear + y),
            h('span', { class: 'stat-row__value' }, money(total)));
        })))));
}

function freeAgencyTab(team, lg) {
  const pool = lg.freeAgents.slice().sort(byDesc((p) => marketValue(p, lg.salaryCap))).slice(0, 120);
  const ly = lg.leagueYear;

  const sign = (player) => {
    const value = marketValue(player, lg.salaryCap);
    const years = Math.max(1, Math.min(5, Math.round(30 - player.age) > 5 ? 4 : 2));
    let apy = value;
    modal({
      title: `Sign ${player.pos} ${player.name}`,
      body: h('div', { class: 'stack' },
        playerCard(player, team),
        h('div', { class: 'field-row' },
          h('label', {}, 'Offer per year'),
          h('input', {
            type: 'number', value: Math.round(value / 1e5) / 10, step: 0.5,
            oninput: (e) => { apy = Number(e.target.value) * 1e6; },
          }),
          h('span', { class: 'small faint' }, `market ${money(value)}`)),
        h('p', { class: 'small muted' },
          `Cap space: ${money(team.capSpace(ly, ly))}. He weighs money against playing time, the club's record, and scheme fit.`)),
      actions: [
        btn('Make the offer', () => {
          if (apy > team.capSpace(ly, ly)) {
            toast('Not enough cap space for that.', 'bad');
            return;
          }
          const appeal = playerPreference(player, team, lg, { apy });
          const wants = value * (2 - appeal);
          if (apy < wants * 0.88) {
            toast(`${player.name} turns it down. He is looking for more than that.`, 'bad');
            return;
          }
          player.contract = buildContract(lg.rng, player, Math.round(apy), years, ly);
          team.addPlayer(player);
          lg.freeAgents = lg.freeAgents.filter((p) => p.id !== player.id);
          team.rebuildDepthChart();
          lg.recordTransaction('signing', { playerId: player.id, name: player.name, pos: player.pos, teamId: team.id, apy });
          closeModal();
          toast(`${player.name} signs.`, 'good');
          refresh();
        }, { variant: 'primary' }),
        btn('Cancel', () => closeModal()),
      ],
    });
  };

  return panelFlush(`Free Agents (${lg.freeAgents.length})`,
    h('div', { class: 'scroll-y scroll-y--tall' },
      pool.length ? table([
        { label: 'Pos', render: (p) => p.pos },
        { label: 'Player', render: (p) => p.name },
        { label: 'Age', num: true, render: (p) => p.age },
        { label: 'OVR', num: true, render: (p) => ovrBadge(p.overall()) },
        { label: 'POT', num: true, render: (p) => h('span', { class: 'faint mono' }, p.potentialOverall()) },
        { label: 'Fit', render: (p) => {
          const scheme = POSITIONS[p.pos].unit === 'DEF' ? team.defScheme : team.offScheme;
          const f = schemeFit(p, scheme);
          return h('span', { class: f > 2.5 ? 'good' : f < -2 ? 'bad' : 'faint' }, fitGrade(f).label);
        } },
        { label: 'Asking', num: true, render: (p) => money(marketValue(p, lg.salaryCap)) },
        { label: '', render: (p) => btn('Sign', (e) => { e.stopPropagation(); sign(p); }, { small: true, variant: 'primary' }) },
      ], pool, { onRow: (p) => modal({ title: p.name, body: playerCard(p, team), actions: [btn('Close', () => closeModal())] }) })
        : empty('The market is empty.')));
}

function draftTab(team, lg) {
  const off = state.offseason;
  if (!off || !off.draftClass) {
    return panel('Draft', h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'The draft board opens during the offseason.'),
      off ? btn('Open the board now', () => { off.prepareDraft(); refresh(); }, { variant: 'primary' }) : null));
  }
  const board = off.boards[team.id];
  const needs = team.positionNeeds();
  const prospects = off.draftClass.slice()
    .map((p) => ({ p, view: board[p.id] }))
    .sort(byDesc((x) => prospectValue(team, x.view, x.p, needs)));

  return panelFlush(`Draft Board — ${prospects.length} prospects`,
    h('div', { class: 'scroll-y scroll-y--tall' },
      table([
        { label: 'Pos', render: (x) => x.p.pos },
        { label: 'Prospect', render: (x) => x.p.name },
        { label: 'College', render: (x) => h('span', { class: 'small faint' }, x.p.college) },
        { label: 'Age', num: true, render: (x) => x.p.age },
        { label: 'Grade', render: (x) => x.view.grade },
        { label: 'Est. OVR', num: true, render: (x) => ovrBadge(x.view.overall) },
        { label: 'Est. POT', num: true, render: (x) => h('span', { class: 'faint mono' }, x.view.potential) },
        { label: 'Confidence', num: true, render: (x) => h('span', { class: x.view.confidence > 0.6 ? 'good' : x.view.confidence < 0.3 ? 'bad' : 'warn' }, `${Math.round(x.view.confidence * 100)}%`) },
        { label: '40', num: true, render: (x) => x.p.combine.fortyTime },
      ], prospects.slice(0, 150), {
        onRow: (x) => modal({
          title: `${x.p.pos} ${x.p.name} — ${x.p.college}`,
          body: h('div', { class: 'stack' },
            h('div', { class: 'row' },
              chip(x.view.grade), chip(`Confidence ${Math.round(x.view.confidence * 100)}%`),
              chip(`Projected ${x.view.dev} development`)),
            h('p', { class: 'small muted' },
              'These are your scouts’ estimates, not the truth. More scouting narrows the gap.'),
            h('div', { class: 'section-title' }, 'Combine'),
            h('div', { class: 'row small' },
              chip(`40: ${x.p.combine.fortyTime}s`), chip(`Vert: ${x.p.combine.vertical}"`),
              chip(`Bench: ${x.p.combine.bench}`), chip(`3-cone: ${x.p.combine.threeCone}s`)),
            h('div', { class: 'section-title', style: { marginTop: '10px' } }, 'Estimated Ratings'),
            h('div', { class: 'grid grid--3' },
              Object.entries(x.view.ratings).slice(0, 24).map(([k, v]) =>
                h('div', { class: 'stat-row' },
                  h('span', { class: 'stat-row__label' }, k),
                  h('span', { class: 'stat-row__value' }, v))))),
          actions: [btn('Close', () => closeModal())],
        }),
      })));
}

registerScreen('frontoffice', {
  render() {
    const lg = state.league;
    const team = userTeam();
    if (!team) return empty('No franchise loaded.');

    const tabs = h('div', { class: 'row', style: { marginBottom: '14px' } },
      chip('Cap Sheet', { on: tab === 'cap', onclick: () => { tab = 'cap'; refresh(); } }),
      chip('Free Agents', { on: tab === 'fa', onclick: () => { tab = 'fa'; refresh(); } }),
      chip('Draft Board', { on: tab === 'draft', onclick: () => { tab = 'draft'; refresh(); } }));

    const body = tab === 'cap' ? capTab(team, lg)
      : tab === 'fa' ? freeAgencyTab(team, lg)
        : draftTab(team, lg);

    return h('div', { class: 'stack' }, tabs, body);
  },
});
