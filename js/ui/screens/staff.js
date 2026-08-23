// The coaching staff: who works for you, and who you could hire instead.

import { h, btn, chip, panel, panelFlush, table, empty, modal, closeModal, toast } from '../dom.js';
import { registerScreen, state, refresh, userTeam } from '../app.js';
import { STAFF_ROLES, STAFF_ROLE_KEYS, COACH_ATTRS } from '../../model/staff.js';
import { OFFENSIVE_SCHEMES, DEFENSIVE_SCHEMES } from '../../data/schemes.js';
import { round, byDesc } from '../../core/util.js';

function coachCard(coach) {
  return h('div', { class: 'stack' },
    h('div', { class: 'row' },
      h('span', { style: { fontSize: '17px', fontWeight: 700 } }, coach.name),
      chip(coach.roleName), chip(`${coach.age} yrs`), chip(`${coach.experience} seasons`)),
    h('div', { class: 'row small muted' },
      chip(`Overall ${coach.overall}`),
      chip(`Reputation ${Math.round(coach.reputation)}`),
      coach.offScheme ? chip(OFFENSIVE_SCHEMES[coach.offScheme]?.name ?? coach.offScheme) : null,
      coach.defScheme ? chip(DEFENSIVE_SCHEMES[coach.defScheme]?.name ?? coach.defScheme) : null),
    h('div', { class: 'row small' },
      chip(coach.aggression > 0.3 ? 'Aggressive' : coach.aggression < -0.3 ? 'Conservative' : 'Balanced'),
      chip(coach.tempo > 0.3 ? 'Up-tempo' : coach.tempo < -0.3 ? 'Grinds the clock' : 'Normal tempo')),
    h('div', { class: 'section-title', style: { marginTop: '8px' } }, 'Attributes'),
    h('div', { class: 'grid grid--3' },
      COACH_ATTRS.map((a) => h('div', { class: 'stat-row' },
        h('span', { class: 'stat-row__label' }, a.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())),
        h('span', { class: 'stat-row__value' }, coach.attr(a))))),
    coach.record ? h('div', { class: 'small faint', style: { marginTop: '8px' } },
      `Career ${coach.record.w}-${coach.record.l}${coach.record.t ? `-${coach.record.t}` : ''} · ${coach.record.playoffs} playoff berths · ${coach.record.titles} titles`) : null);
}

function hireModal(roleKey, team) {
  const lg = state.league;
  const pool = lg.coachPool
    .filter((c) => c.role === roleKey || ['OC', 'DC', 'HC'].includes(c.role) === ['OC', 'DC', 'HC'].includes(roleKey))
    .sort(byDesc((c) => c.overall))
    .slice(0, 25);

  modal({
    title: `Hire a ${STAFF_ROLES[roleKey].name}`,
    body: pool.length
      ? table([
        { label: 'Name', render: (c) => c.name },
        { label: 'Age', num: true, render: (c) => c.age },
        { label: 'Overall', num: true, render: (c) => c.overall },
        { label: 'Reputation', num: true, render: (c) => Math.round(c.reputation) },
        { label: 'Scheme', render: (c) => (c.offScheme ? OFFENSIVE_SCHEMES[c.offScheme]?.name : c.defScheme ? DEFENSIVE_SCHEMES[c.defScheme]?.name : '—') },
        { label: '', render: (c) => btn('Hire', (e) => {
          e.stopPropagation();
          const current = team.staff[roleKey];
          if (current) {
            current.teamId = null;
            lg.coachPool.push(current);
          }
          lg.coachPool = lg.coachPool.filter((x) => x.id !== c.id);
          c.role = roleKey;
          c.teamId = team.id;
          team.staff[roleKey] = c;
          state.season.invalidateBooks(team.id);
          closeModal();
          toast(`${c.name} hired as ${STAFF_ROLES[roleKey].name}.`, 'good');
          refresh();
        }, { small: true, variant: 'primary' }) },
      ], pool, { onRow: (c) => modal({ title: c.name, body: coachCard(c), actions: [btn('Close', () => closeModal())] }) })
      : empty('Nobody available for that job right now.'),
    actions: [btn('Close', () => closeModal())],
  });
}

registerScreen('staff', {
  render() {
    const lg = state.league;
    const team = userTeam();
    if (!team) return empty('No franchise loaded.');

    const rows = STAFF_ROLE_KEYS.flatMap((key) => {
      const def = STAFF_ROLES[key];
      const held = team.staff[key];
      const list = Array.isArray(held) ? held : [held];
      return list.filter(Boolean).map((coach) => ({ key, def, coach }));
    });

    return h('div', { class: 'grid grid--sidebar' },
      panelFlush('Coaching Staff',
        table([
          { label: 'Role', render: (r) => r.def.name },
          { label: 'Name', render: (r) => r.coach.name },
          { label: 'Age', num: true, render: (r) => r.coach.age },
          { label: 'Overall', num: true, render: (r) => h('span', { class: r.coach.overall >= 78 ? 'good' : r.coach.overall < 55 ? 'bad' : '' }, r.coach.overall) },
          { label: 'Scheme / Speciality', render: (r) => h('span', { class: 'small faint' },
            r.coach.offScheme ? OFFENSIVE_SCHEMES[r.coach.offScheme]?.name
              : r.coach.defScheme ? DEFENSIVE_SCHEMES[r.coach.defScheme]?.name
                : r.def.core.slice(0, 2).join(', ')) },
          { label: '', render: (r) => btn('Replace', (e) => { e.stopPropagation(); hireModal(r.key, team); }, { small: true }) },
        ], rows, { onRow: (r) => modal({ title: r.coach.name, body: coachCard(r.coach), actions: [btn('Close', () => closeModal())] }) })),

      h('div', { class: 'stack' },
        panel('Your Systems', h('div', { class: 'stack' },
          h('div', { class: 'section-title' }, 'Offense'),
          h('div', {}, team.offScheme.name),
          h('p', { class: 'small muted' }, team.offScheme.desc),
          h('div', { class: 'section-title', style: { marginTop: '10px' } }, 'Defense'),
          h('div', {}, team.defScheme.name),
          h('p', { class: 'small muted' }, team.defScheme.desc),
          h('p', { class: 'small faint', style: { marginTop: '10px' } },
            'Change a coordinator and the system changes with him — and so does which of your players fit it.'))),
        panel('Free Agent Coaches', h('div', { class: 'stack' },
          h('p', { class: 'small muted' }, `${lg.coachPool.length} coaches are out of work.`),
          lg.coachPool.slice().sort(byDesc((c) => c.overall)).slice(0, 8).map((c) =>
            h('div', { class: 'row small' },
              h('span', { style: { flex: 1 } }, c.name),
              chip(c.roleName), chip(String(c.overall))))))));
  },
});
