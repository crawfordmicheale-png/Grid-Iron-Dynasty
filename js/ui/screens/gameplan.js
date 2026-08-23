// The practice week: how you spend ten periods, and what you install.

import { h, btn, chip, panel, panelFlush, table, empty, toast } from '../dom.js';
import { registerScreen, state, refresh, userTeam } from '../app.js';
import {
  DRILL_TYPES, DRILL_KEYS, PRACTICE_PERIODS, runPracticeWeek,
  createGameplan, suggestFocusGroups, autoPlan, familiarityMultiplier,
} from '../../season/practice.js';
import { PASS_CONCEPTS } from '../../data/passConcepts.js';
import { RUN_CONCEPTS } from '../../data/runConcepts.js';
import { FORMATIONS } from '../../data/formations.js';
import { round, byDesc } from '../../core/util.js';

let plan = null;
let focus = ['OL', 'DB'];
let installSet = null;
let practiceDone = false;

function ensurePlan(team) {
  if (!plan) plan = autoPlan(state.league.rng, team);
  if (!team.gameplan) team.gameplan = createGameplan();
  if (!installSet) {
    const book = state.season.booksFor(team).off;
    installSet = new Set(Object.keys(team.gameplan.familiarity).length
      ? Object.keys(team.gameplan.familiarity)
      : book.all.slice(0, 28).map((p) => p.id));
  }
}

function periodSlot(index) {
  const key = plan[index];
  return h('div', { class: 'row', style: { marginBottom: '6px' } },
    h('span', { class: 'mono faint', style: { width: '26px' } }, index + 1),
    h('select', {
      style: { flex: 1 },
      onchange: (e) => { plan[index] = e.target.value; refresh(); },
    }, DRILL_KEYS.map((k) => h('option', { value: k, selected: k === key }, DRILL_TYPES[k].name))),
    h('span', { class: 'small faint', style: { width: '130px' } },
      DRILL_TYPES[key]?.fatigue > 0 ? `−${DRILL_TYPES[key].fatigue} legs` : `+${-DRILL_TYPES[key].fatigue} rest`));
}

function planSummary(team) {
  const totals = { fatigue: 0, injury: 0, install: 0, dev: 0 };
  for (const key of plan) {
    const d = DRILL_TYPES[key];
    if (!d) continue;
    totals.fatigue += d.fatigue;
    totals.injury += d.injuryRisk ?? 0;
    totals.install += d.familiarity ?? 0;
    totals.dev += d.development ?? 0;
  }
  return h('div', { class: 'row' },
    chip(`Legs ${totals.fatigue > 0 ? `−${totals.fatigue}` : `+${-totals.fatigue}`}`, { variant: totals.fatigue > 55 ? 'bad' : totals.fatigue < 20 ? 'good' : 'warn' }),
    chip(`Injury risk ${round(totals.injury, 1)}`, { variant: totals.injury > 6 ? 'bad' : 'good' }),
    chip(`Install ${round(totals.install * 100, 0)}%`),
    chip(`Development ${round(totals.dev, 1)}`));
}

registerScreen('gameplan', {
  render() {
    const lg = state.league;
    const team = userTeam();
    if (!team) return empty('No franchise loaded.');
    ensurePlan(team);
    const book = state.season.booksFor(team).off;
    const spread = 22 / Math.max(22, installSet.size);

    const playRow = (p) => {
      const on = installSet.has(p.id);
      const fam = team.gameplan.familiarity[p.id] ?? 0;
      return h('tr', {
        class: 'clickable',
        onclick: () => {
          if (on) installSet.delete(p.id); else installSet.add(p.id);
          refresh();
        },
      },
      h('td', {}, chip(on ? '✓' : '', { on })),
      h('td', {}, p.shortName),
      h('td', { class: 'small faint' }, FORMATIONS[p.formation].name),
      h('td', {}, h('span', { class: `playcard__tag playcard__tag--${p.type}` }, p.type === 'pass' ? 'PASS' : 'RUN')),
      h('td', { class: 'num' }, h('span', { class: fam > 0.7 ? 'good' : fam > 0.3 ? 'warn' : 'faint' }, `${Math.round(fam * 100)}%`)));
    };

    const sortedPlays = book.all.slice().sort((a, b) => {
      const ai = installSet.has(a.id) ? 1 : 0;
      const bi = installSet.has(b.id) ? 1 : 0;
      return bi - ai || a.type.localeCompare(b.type) || a.shortName.localeCompare(b.shortName);
    });

    return h('div', { class: 'grid grid--sidebar' },
      h('div', { class: 'stack' },
        panel('Practice Week', h('div', { class: 'stack' },
          h('p', { class: 'small muted' },
            `Ten periods. Padded work develops players fastest and gets them hurt fastest; walkthroughs and rest days give bodies back. Installing plays is what makes them run cleanly on Sunday.`),
          Array.from({ length: PRACTICE_PERIODS }, (_, i) => periodSlot(i)),
          planSummary(team),
          h('div', { class: 'row' },
            btn('Run the week', () => {
              const report = runPracticeWeek({
                rng: lg.rng, team, plan,
                playbook: book,
                installList: Array.from(installSet),
                focusGroups: focus,
                league: lg,
              });
              practiceDone = true;
              toast(`Practice complete. ${report.injuries.length} knocks, ${report.developed.length} players improved.`,
                report.injuries.length ? 'bad' : 'good');
              refresh();
            }, { variant: 'primary' }),
            btn('Use the staff default', () => { plan = autoPlan(lg.rng, team); refresh(); })))),

        panelFlush(`Game Plan — ${installSet.size} plays installed`,
          h('div', { class: 'scroll-y scroll-y--tall' },
            h('table', { class: 'table' },
              h('thead', {}, h('tr', {},
                h('th', { style: { width: '40px' } }, ''),
                h('th', {}, 'Play'),
                h('th', {}, 'Formation'),
                h('th', {}, 'Type'),
                h('th', { class: 'num' }, 'Familiar'))),
              h('tbody', {}, sortedPlays.map(playRow)))),
          [
            btn('Clear', () => { installSet.clear(); refresh(); }, { small: true }),
            btn('Top 25', () => {
              installSet = new Set(book.all.slice(0, 25).map((p) => p.id));
              refresh();
            }, { small: true }),
          ])),

      h('div', { class: 'stack' },
        panel('Install Efficiency', h('div', { class: 'stack' },
          h('p', { class: 'small muted' },
            'Practice time is finite. The more plays you carry, the less each one gets repped.'),
          h('div', { class: 'stat-row' },
            h('span', { class: 'stat-row__label' }, 'Plays installed'),
            h('span', { class: 'stat-row__value' }, installSet.size)),
          h('div', { class: 'stat-row' },
            h('span', { class: 'stat-row__label' }, 'Reps per play'),
            h('span', { class: `stat-row__value ${spread < 0.5 ? 'bad' : spread < 0.85 ? 'warn' : 'good'}` }, `${Math.round(spread * 100)}%`)),
          h('p', { class: 'small faint' },
            spread >= 0.99 ? 'A tight plan. Everything you carry will be sharp.'
              : spread > 0.6 ? 'A broad plan. Some of it will be rough around the edges.'
                : 'Far too much to install in a week. Most of this will not be ready.'))),

        panel('Position Focus', h('div', { class: 'stack' },
          h('p', { class: 'small muted' }, 'Which groups get the position-drill periods.'),
          h('div', { class: 'chips' },
            suggestFocusGroups(team).map((g) => chip(`${g.group} (${g.quality})`, {
              on: focus.includes(g.group),
              onclick: () => {
                focus = focus.includes(g.group) ? focus.filter((x) => x !== g.group) : [...focus, g.group].slice(-3);
                refresh();
              },
              title: `Starters grade ${g.quality}, ${g.room} points of upside left in the group`,
            }))))),

        panel('Situational Sharpness', h('div', { class: 'stack' },
          ['redZone', 'twoMinute', 'shortYardage'].map((k) =>
            h('div', { class: 'stat-row' },
              h('span', { class: 'stat-row__label' }, { redZone: 'Red zone', twoMinute: 'Two-minute', shortYardage: 'Short yardage' }[k]),
              h('span', { class: 'stat-row__value' }, `${Math.round((team.gameplan.situational[k] ?? 0) * 100)}%`))),
          h('div', { class: 'stat-row' },
            h('span', { class: 'stat-row__label' }, 'Opponent film'),
            h('span', { class: 'stat-row__value' }, `${Math.round((team.gameplan.opponentIntel ?? 0) * 100)}%`))))));
  },
});
