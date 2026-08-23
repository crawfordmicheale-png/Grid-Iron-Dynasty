// New franchise, load, import.

import { h, btn, panel, toast } from '../dom.js';
import { registerScreen, state, go, listSaves, loadFranchise, importFranchise, hydrate } from '../app.js';
import { generateLeague } from '../../model/leagueGen.js';
import { Season } from '../../season/season.js';
import { TEAM_DATA, CONFERENCES, DIVISIONS } from '../../data/teams.js';
import { money } from '../../core/util.js';

let chosenTeam = null;
let seedInput = '';

function teamCard(data, preview) {
  const t = preview?.team(data.id);
  return h('button', {
    class: `teamcard ${chosenTeam === data.id ? 'is-on' : ''}`,
    style: { '--tc': data.colors[0] },
    onclick: () => { chosenTeam = data.id; go('setup'); },
  },
  h('span', { class: 'teamcard__city' }, data.city),
  h('span', { class: 'teamcard__name' }, data.name),
  h('span', { class: 'teamcard__meta' },
    t ? `OVR ${t.overallRating} · OFF ${t.offenseRating} · DEF ${t.defenseRating}` : `${data.climate} · market ${data.market}`),
  t ? h('span', { class: 'teamcard__meta faint' },
    `${t.offScheme.name} / ${t.defScheme.name}`) : null);
}

function startFranchise(preview) {
  if (!chosenTeam) {
    toast('Pick a club first.', 'bad');
    return;
  }
  const league = preview ?? generateLeague({ seed: seedInput || `gid-${Date.now()}` });
  league.userTeamId = chosenTeam;
  for (const t of league.allTeams()) t.isUserTeam = t.id === chosenTeam;
  state.league = league;
  state.season = new Season(league);
  state.season.start();
  state.offseason = null;
  go('hub');
}

registerScreen('setup', {
  bare: true,
  render() {
    // Generate a preview league so the club list shows real ratings.
    if (!state.previewLeague || state.previewSeed !== seedInput) {
      state.previewLeague = generateLeague({ seed: seedInput || 'gridiron-preview' });
      state.previewSeed = seedInput;
    }
    const preview = state.previewLeague;
    const saves = listSaves();

    const byConf = Object.keys(CONFERENCES).map((conf) =>
      h('div', { class: 'stack' },
        h('h3', { class: 'section-title' }, CONFERENCES[conf].name),
        DIVISIONS.map((div) =>
          h('div', { class: 'stack' },
            h('div', { class: 'small faint', style: { marginTop: '6px' } }, div),
            h('div', { class: 'teamgrid' },
              TEAM_DATA.filter((t) => t.conf === conf && t.div === div).map((t) => teamCard(t, preview)))))));

    return h('div', { class: 'setup' },
      h('h1', { class: 'setup__title' }, 'GRID IRON DYNASTY'),
      h('p', { class: 'setup__sub' },
        'You are the head coach. Build the roster, install the game plan, call the plays.'),

      h('div', { class: 'grid grid--2', style: { marginBottom: '22px' } },
        panel('New Franchise', h('div', { class: 'stack' },
          h('div', { class: 'field-row' },
            h('label', {}, 'League seed'),
            h('input', {
              type: 'text', value: seedInput, placeholder: 'leave blank for random',
              oninput: (e) => { seedInput = e.target.value; },
              onchange: () => go('setup'),
            })),
          h('p', { class: 'small faint' },
            'The same seed always produces the same league, so you can replay a franchise from the start.'),
          h('div', { class: 'row' },
            btn(chosenTeam ? `Take over the ${preview.team(chosenTeam).name}` : 'Choose a club below',
              () => startFranchise(preview), { variant: 'primary', disabled: !chosenTeam }),
            btn('Reroll league', () => {
              seedInput = `gid-${Math.floor(Math.random() * 1e9).toString(36)}`;
              state.previewSeed = null;
              go('setup');
            })))),

        panel('Continue', h('div', { class: 'stack' },
          saves.length
            ? saves.map((s) => h('div', { class: 'row' },
              h('div', { style: { flex: 1 } },
                h('div', {}, s.meta?.team ?? s.slot),
                h('div', { class: 'small faint' },
                  `${s.meta?.year ?? ''} · ${s.meta?.record ?? ''} · saved ${new Date(s.savedAt).toLocaleString()}`)),
              btn('Load', () => loadFranchise(s.slot), { small: true, variant: 'primary' })))
            : h('p', { class: 'small faint' }, 'No saved franchises yet.'),
          h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '6px 0' } }),
          h('div', { class: 'row' },
            h('label', { class: 'btn btn--sm', style: { display: 'inline-block' } },
              'Import file',
              h('input', {
                type: 'file', accept: 'application/json', style: { display: 'none' },
                onchange: (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  file.text().then((text) => importFranchise(text));
                },
              })),
            state.league ? btn('Back to franchise', () => go('hub')) : null)))),

      h('div', { class: 'grid grid--2' }, byConf));
  },
});
