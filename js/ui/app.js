// Application state and shell.

import { h, mount, btn, toast } from './dom.js';
import { PHASES } from '../model/league.js';
import { REGULAR_SEASON_WEEKS } from '../season/schedule.js';
import { ROUNDS } from '../season/playoffs.js';
import { saveGame, loadGame, listSaves, toJSON, fromJSON } from '../core/save.js';
import { League } from '../model/league.js';
import { Season } from '../season/season.js';
import { money } from '../core/util.js';

export const state = {
  league: null,
  season: null,
  offseason: null,
  screen: 'setup',
  game: null,        // live Game instance on game day
  gameMeta: null,    // { scheduleGame, bracketGame }
  scratch: {},       // per-screen transient state
};

const screens = new Map();
export function registerScreen(key, def) {
  screens.set(key, def);
}

export function go(screen, scratch = {}) {
  state.screen = screen;
  state.scratch = scratch;
  render();
}

export function refresh() {
  render();
}

export const NAV = [
  { key: 'hub', label: 'Team' },
  { key: 'roster', label: 'Roster' },
  { key: 'gameplan', label: 'Game Plan' },
  { key: 'frontoffice', label: 'Front Office' },
  { key: 'staff', label: 'Staff' },
  { key: 'league', label: 'League' },
];

let root = null;

export function bootstrap(el) {
  root = el;
  render();
}

export function userTeam() {
  return state.league?.userTeam ?? null;
}

function phaseLabel() {
  const lg = state.league;
  if (!lg) return '';
  if (lg.phase === PHASES.PLAYOFFS) {
    const round = state.season?.bracket?.currentRound;
    return round ? ROUNDS[round].name : 'Playoffs';
  }
  if (lg.phase === PHASES.OFFSEASON) {
    return state.offseason ? state.offseason.stage.name : 'Offseason';
  }
  if (lg.phase === PHASES.PRESEASON) return 'Preseason';
  return `Week ${lg.week}`;
}

function render() {
  if (!root) return;
  const def = screens.get(state.screen);
  if (!def) {
    mount(root, h('div', { class: 'empty' }, `No screen registered for "${state.screen}".`));
    return;
  }

  // The setup screen owns the whole window.
  if (def.bare) {
    mount(root, def.render());
    return;
  }

  const lg = state.league;
  const team = userTeam();
  if (team) {
    document.documentElement.style.setProperty('--team-primary', team.colors[0]);
    document.documentElement.style.setProperty('--team-secondary', team.colors[1]);
  }

  const body = h('main', { class: `screen ${def.flush ? 'screen--flush' : ''}` }, def.render());

  mount(root,
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar__brand' }, 'GRID IRON DYNASTY'),
      team ? h('span', { class: 'topbar__team' },
        h('span', { class: 'topbar__swatch' }),
        h('span', {}, team.fullName),
        h('span', { class: 'faint small' }, team.recordString)) : null,
      h('div', { class: 'topbar__meta' },
        h('span', {}, lg?.year ?? '', ' ', h('b', {}, phaseLabel())),
        team ? h('span', {}, 'Cap ', h('b', { class: team.capSpace(lg.leagueYear, lg.leagueYear) < 0 ? 'bad' : 'good' },
          money(team.capSpace(lg.leagueYear, lg.leagueYear)))) : null,
        btn('Save', () => quickSave(), { small: true }),
        btn('Menu', () => go('setup'), { small: true }))),
    def.hideNav ? null : h('nav', { class: 'nav' },
      NAV.map((item) => h('button', {
        class: `nav__item ${state.screen === item.key ? 'is-active' : ''}`,
        onclick: () => go(item.key),
      }, item.label))),
    body);
}

// --- Save / load -------------------------------------------------------------

export function quickSave(slot = 'auto') {
  if (!state.league) return;
  const team = userTeam();
  const res = saveGame(slot, state.league.toJSON(), {
    year: state.league.year,
    week: state.league.week,
    phase: state.league.phase,
    team: team?.fullName ?? '',
    record: team?.recordString ?? '',
  });
  toast(res.ok ? 'Franchise saved.' : 'Could not save (browser storage unavailable).', res.ok ? 'good' : 'bad');
  return res;
}

export function loadFranchise(slot) {
  const env = loadGame(slot);
  if (!env) {
    toast('No save found in that slot.', 'bad');
    return false;
  }
  hydrate(env.state);
  toast('Franchise loaded.', 'good');
  return true;
}

export function hydrate(raw) {
  state.league = League.fromJSON(raw);
  state.season = new Season(state.league);
  // Rebuild the season's live bracket reference if we are mid-playoffs.
  if (state.league.playoffs) state.season.bracket = state.league.playoffs;
  state.offseason = null;
  state.game = null;
  go(state.league.phase === PHASES.PRESEASON ? 'hub' : 'hub');
}

export function exportFranchise() {
  if (!state.league) return;
  const team = userTeam();
  const text = toJSON(state.league.toJSON(), { team: team?.fullName, year: state.league.year });
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grid-iron-dynasty-${state.league.year}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importFranchise(text) {
  const env = fromJSON(text);
  if (!env?.state) {
    toast('That file could not be read.', 'bad');
    return false;
  }
  hydrate(env.state);
  return true;
}

export { listSaves, REGULAR_SEASON_WEEKS, PHASES };
