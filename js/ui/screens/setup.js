// New franchise, load, import.

import { h, btn, panel, toast } from '../dom.js';
import { registerScreen, state, go, listSaves, loadFranchise, importFranchise } from '../app.js';
import { generateLeague } from '../../model/leagueGen.js';
import { Season } from '../../season/season.js';
import { TEAM_DATA, CONFERENCES, DIVISIONS } from '../../data/teams.js';

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
    t ? `Roster ${t.overallRating} · Staff ${t.staffRating}` : `${data.climate} · market ${data.market}`),
  t ? h('span', { class: 'teamcard__meta faint' },
    `${t.offScheme.name} / ${t.defScheme.name}`) : null,
  t?.identity ? h('span', { class: 'teamcard__identity' }, t.identity) : null);
}

function startFranchise(preview) {
  if (!chosenTeam) {
    toast('Pick a club first.', 'bad');
    return;
  }
  // Rebuild with the career seed. The rosters come out identical either way;
  // what changes is every coin flip from the first snap onward.
  const league = generateLeague({ seed: seedInput || `gid-${Date.now()}` });
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
    // The opening league is the same every time, so this is built once and
    // reused -- the seed below decides how the seasons play out, not who is on
    // the rosters.
    if (!state.previewLeague) state.previewLeague = generateLeague({ seed: 'preview' });
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
            h('label', {}, 'Career seed'),
            h('input', {
              type: 'text', value: seedInput, placeholder: 'leave blank for random',
              oninput: (e) => { seedInput = e.target.value; },
            })),
          h('p', { class: 'small faint' },
            'Every franchise starts from the same thirty-two clubs — the same rosters, the same '
            + 'staffs, the same problems. The seed decides how the seasons unfold from there, so '
            + 'the same seed replays a career exactly.'),
          chosenTeam
            ? h('p', { class: 'small' }, preview.team(chosenTeam).identity)
            : null,
          h('div', { class: 'row' },
            btn(chosenTeam ? `Take over the ${preview.team(chosenTeam).name}` : 'Choose a club below',
              () => startFranchise(preview), { variant: 'primary', disabled: !chosenTeam })))),

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
