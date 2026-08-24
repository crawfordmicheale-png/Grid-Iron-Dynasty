// The practice week.
//
// This is where a head coach actually spends his time. You have a fixed number
// of practice periods and more things to do with them than you have periods:
// install the game plan, drill the positions that need it, get healthy, study
// the opponent. Every choice costs you another.
//
// Installed plays run better than uninstalled ones, so a narrow game plan
// executed well beats a wide one nobody has practised.

import { POSITIONS } from '../data/positions.js';
import { positionCoachFor } from '../model/staff.js';
import { clamp, remap, round, byDesc } from '../core/util.js';

export const PRACTICE_PERIODS = 10;

export const DRILL_TYPES = {
  installOffense: {
    key: 'installOffense', name: 'Install Offense', unit: 'OFF',
    desc: 'Rep the game plan. Installed plays execute cleanly; ones nobody has seen do not.',
    fatigue: 5, injuryRisk: 0.8, familiarity: 0.16,
  },
  installDefense: {
    key: 'installDefense', name: 'Install Defense', unit: 'DEF',
    desc: 'Walk through the calls and the checks against what the opponent likes to do.',
    fatigue: 5, injuryRisk: 0.8, familiarity: 0.16,
  },
  padded: {
    key: 'padded', name: 'Full Pads', unit: 'both',
    desc: 'Live work. The fastest way to develop a young player, and the fastest way to lose one.',
    fatigue: 14, injuryRisk: 2.4, development: 1.9, morale: -0.7,
  },
  positionDrills: {
    key: 'positionDrills', name: 'Position Drills', unit: 'group',
    desc: 'Technique work with the position coach. Slow, steady, and it sticks.',
    fatigue: 7, injuryRisk: 1.0, development: 1.3, groupTargeted: true,
  },
  conditioning: {
    key: 'conditioning', name: 'Conditioning', unit: 'both',
    desc: 'Legs in the fourth quarter. Nobody enjoys it.',
    fatigue: 12, injuryRisk: 0.7, stamina: 1.6, morale: -0.9,
  },
  filmStudy: {
    key: 'filmStudy', name: 'Film Study', unit: 'both',
    desc: 'No physical cost at all. Sharpens recognition and tells you what the opponent likes.',
    fatigue: 0, injuryRisk: 0, awareness: 1.1, scouting: 0.22,
  },
  walkthrough: {
    key: 'walkthrough', name: 'Walkthrough', unit: 'both',
    desc: 'Helmets, no pads, half speed. Bodies get back and the plan stays fresh.',
    fatigue: -14, injuryRisk: 0.1, familiarity: 0.05, recovery: 1.0, morale: 0.5,
  },
  restDay: {
    key: 'restDay', name: 'Veterans Rest', unit: 'both',
    desc: 'Give the old legs a day. They will thank you in December.',
    fatigue: -22, injuryRisk: 0, recovery: 1.8, morale: 0.9,
  },
  redZone: {
    key: 'redZone', name: 'Red Zone Period', unit: 'both',
    desc: 'Tight field, tight windows. Pays off where drives are decided.',
    fatigue: 8, injuryRisk: 1.1, familiarity: 0.08, situational: 'redZone',
  },
  twoMinute: {
    key: 'twoMinute', name: 'Two-Minute Drill', unit: 'both',
    desc: 'Clock, timeouts, sideline. The operation has to be automatic.',
    fatigue: 8, injuryRisk: 1.0, familiarity: 0.08, situational: 'twoMinute',
  },
  shortYardage: {
    key: 'shortYardage', name: 'Short Yardage', unit: 'both',
    desc: 'Third and one, fourth and one. Pads on, and it is settled at the line.',
    fatigue: 11, injuryRisk: 1.9, familiarity: 0.08, situational: 'shortYardage',
  },
  specialTeams: {
    key: 'specialTeams', name: 'Special Teams', unit: 'ST',
    desc: 'The third of the game everyone forgets until it costs them a season.',
    fatigue: 5, injuryRisk: 0.8, development: 1.0, group: 'K',
  },
};

export const DRILL_KEYS = Object.keys(DRILL_TYPES);

/** A fresh, sensible practice week. */
export function defaultPlan() {
  return [
    'installOffense', 'installOffense', 'installDefense', 'installDefense',
    'positionDrills', 'padded', 'filmStudy', 'redZone',
    'walkthrough', 'restDay',
  ];
}

/**
 * A club's game plan: which plays are installed, and how well.
 * Familiarity decays week to week, so a plan has to be maintained.
 */
export function createGameplan() {
  return {
    familiarity: {},     // playId -> 0..1
    emphasis: {},        // playId -> weight multiplier for the caller
    situational: { redZone: 0, twoMinute: 0, shortYardage: 0 },
    opponentIntel: 0,    // 0..1, from film study
    installed: [],
  };
}

/** Between weeks, everything a staff learned fades a little. */
export function decayGameplan(gameplan) {
  for (const id of Object.keys(gameplan.familiarity)) {
    gameplan.familiarity[id] = clamp(gameplan.familiarity[id] * 0.74, 0, 1);
    if (gameplan.familiarity[id] < 0.03) delete gameplan.familiarity[id];
  }
  for (const k of Object.keys(gameplan.situational)) {
    gameplan.situational[k] = clamp(gameplan.situational[k] * 0.75, 0, 1);
  }
  gameplan.opponentIntel = 0; // a new opponent every week
}

/**
 * Run one practice week.
 * @param {object} cfg { rng, team, plan, playbook, focusGroups, league }
 */
export function runPracticeWeek(cfg) {
  const { rng, team, league } = cfg;
  const plan = cfg.plan ?? defaultPlan();
  const focusGroups = cfg.focusGroups ?? ['OL', 'DB'];
  const gameplan = team.gameplan ?? (team.gameplan = createGameplan());
  const installList = cfg.installList ?? [];

  decayGameplan(gameplan);

  const hc = team.staff?.HC;
  const trainer = team.staff?.TRAINER;
  const strength = team.staff?.STRENGTH;
  const injuryGuard = remap(trainer?.attr('injuryPrevention') ?? 55, 30, 95, 1.35, 0.6);
  const conditioningQuality = remap(strength?.attr('conditioning') ?? 55, 30, 95, 0.75, 1.3);
  const teaching = remap(hc?.attr('motivation') ?? 55, 30, 95, 0.85, 1.15);

  const report = {
    fatigue: 0, injuries: [], developed: [], moraleShift: 0,
    installed: [], intel: 0, situational: {},
  };

  for (const drillKey of plan.slice(0, PRACTICE_PERIODS)) {
    const drill = DRILL_TYPES[drillKey];
    if (!drill) continue;

    // --- Physical cost ---
    for (const p of team.roster) {
      if (!p.available) continue;
      const load = drill.fatigue * remap(p.rating('stamina'), 40, 95, 1.2, 0.8);
      p.fatigue = clamp(p.fatigue - load, 0, 100);
      if (drill.recovery && p.injury) {
        p.injury.weeksOut -= drill.recovery * 0.12 * remap(trainer?.attr('recovery') ?? 55, 30, 95, 0.7, 1.4);
        if (p.injury.weeksOut <= 0) p.injury = null;
      }
      if (drill.morale) p.morale = clamp(p.morale + drill.morale * teaching, 5, 100);
    }
    report.fatigue += drill.fatigue;

    // --- Injuries ---
    if (drill.injuryRisk > 0) {
      for (const p of team.roster) {
        if (p.injury) continue;
        const rate = 0.0016 * drill.injuryRisk * injuryGuard
          * p.traitMult('injuryMult')
          * remap(p.rating('durability'), 35, 95, 1.9, 0.5)
          * remap(p.fatigue, 20, 100, 1.5, 0.85);
        if (rng.next() < rate) {
          const weeks = rng.int(0, 3);
          p.injury = {
            name: rng.pick(['hamstring strain', 'ankle sprain', 'shoulder strain', 'groin strain']),
            weeksOut: weeks, severity: 0.3, partial: weeks === 0 ? 6 : 0,
          };
          report.injuries.push(p);
          league?.log('injury', `${p.name} (${team.abbr}) hurt in practice: ${p.injury.name}.`);
        }
      }
    }

    // --- Installing the plan ---
    if (drill.familiarity) {
      const toInstall = installList.length ? installList : (cfg.playbook?.all ?? []).slice(0, 40).map((p) => p.id);
      const coachQuality = remap(
        (drill.unit === 'DEF' ? team.staff?.DC : team.staff?.OC)?.attr('playCalling') ?? 55,
        30, 95, 0.75, 1.3,
      );
      // Practice time is finite. A period spent on forty plays teaches each of
      // them a quarter as well as a period spent on ten -- which is the whole
      // argument for a narrow game plan executed cleanly.
      const spread = 22 / Math.max(22, toInstall.length);
      for (const id of toInstall) {
        gameplan.familiarity[id] = clamp(
          (gameplan.familiarity[id] ?? 0) + drill.familiarity * coachQuality * spread, 0, 1,
        );
      }
      report.installed.push(...toInstall);
    }

    // --- Situational work ---
    if (drill.situational) {
      gameplan.situational[drill.situational] = clamp(
        (gameplan.situational[drill.situational] ?? 0) + 0.28 * teaching, 0, 1,
      );
      report.situational[drill.situational] = gameplan.situational[drill.situational];
    }

    // --- Film ---
    if (drill.scouting) {
      gameplan.opponentIntel = clamp(gameplan.opponentIntel + drill.scouting * teaching, 0, 1);
      report.intel = gameplan.opponentIntel;
    }

    // --- Development ---
    if (drill.development || drill.stamina || drill.awareness) {
      const targets = drill.groupTargeted
        ? team.roster.filter((p) => focusGroups.includes(POSITIONS[p.pos].group))
        : drill.group
          ? team.roster.filter((p) => POSITIONS[p.pos].group === drill.group)
          : team.roster;

      // Position-coach quality is per group, not per player.
      const coachingByGroup = new Map();
      for (const p of targets) {
        if (p.injury) continue;
        const group = POSITIONS[p.pos].group;
        if (!coachingByGroup.has(group)) {
          const c = positionCoachFor(team.staff, group);
          coachingByGroup.set(group, c ? remap(c.attr('technique'), 30, 95, 0.6, 1.5) : 1);
        }
        const coaching = coachingByGroup.get(group);
        const ethic = remap(p.rating('workEthic'), 30, 95, 0.6, 1.4);
        const youth = remap(p.age, 21, 32, 1.4, 0.35);

        // In-season gains are small and go to attributes with headroom. The
        // candidate list is only built when a roll actually lands -- allocating
        // it for every player on every drill was the whole cost of a practice week.
        const chance = 0.05 * (drill.development ?? 0.5) * coaching * ethic * youth;
        if (rng.next() < chance) {
          const candidates = POSITIONS[p.pos].attrs.filter((a) => p.cap(a) > p.rating(a));
          if (candidates.length) {
            const attr = rng.pick(candidates);
            p.ratings[attr] = clamp(p.ratings[attr] + 1, 0, p.cap(attr));
            p.invalidate();
            report.developed.push({ player: p, attr });
          }
        }
        if (drill.stamina) {
          const gain = rng.next() < 0.08 * conditioningQuality ? 1 : 0;
          if (gain && p.rating('stamina') < p.cap('stamina')) {
            p.ratings.stamina += 1;
            p.invalidate();
          }
        }
        if (drill.awareness && rng.next() < 0.05 * remap(p.rating('workEthic'), 30, 95, 0.6, 1.5)) {
          for (const attr of ['awareness', 'playRecognition']) {
            if (p.rating(attr) < p.cap(attr)) {
              p.ratings[attr] += 1;
              p.invalidate();
              break;
            }
          }
        }
      }
    }
  }

  gameplan.installed = Array.from(new Set(report.installed));
  team.rebuildDepthChart();
  return report;
}

/**
 * How well a play will be executed, given how much it has been practised.
 * An uninstalled play still works -- these are professionals -- but not as well.
 */
export function familiarityMultiplier(gameplan, playId) {
  // No game plan at all means nobody has been asked to prepare one -- treat it
  // as neutral rather than penalising a club for a system it never opted into.
  if (!gameplan) return 1;
  const f = gameplan.familiarity?.[playId] ?? 0;
  // Centred so that a club which prepares normally sits a shade above the
  // neutral 1.0 a club with no plan at all gets. A well-drilled call is worth
  // real yards; one nobody repped is a modest penalty, not a catastrophe.
  return remap(f, 0, 1, 0.94, 1.10);
}

/** Bonus in a situation the team has drilled this week. */
export function situationalBonus(gameplan, situation) {
  return remap(gameplan?.situational?.[situation] ?? 0, 0, 1, 0, 0.09);
}

/** The AI's practice week: fix what is broken, install what it will call. */
export function autoPlan(rng, team) {
  const plan = ['installOffense', 'installOffense', 'installDefense', 'installDefense'];
  const banged = team.roster.filter((p) => p.injury || p.fatigue < 70).length;
  if (banged > 12) plan.push('restDay', 'walkthrough');
  else plan.push('padded', 'positionDrills');
  plan.push('filmStudy');
  // Coaches drill whichever situation went worst.
  plan.push(rng.pick(['redZone', 'twoMinute', 'shortYardage']));
  plan.push('positionDrills', 'walkthrough');
  return plan.slice(0, PRACTICE_PERIODS);
}

/** Which position groups most need drill time. */
export function suggestFocusGroups(team) {
  const groups = new Map();
  for (const p of team.roster) {
    const g = POSITIONS[p.pos].group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  return Array.from(groups.entries())
    .map(([group, players]) => {
      const starters = players.slice().sort(byDesc((p) => p.overall())).slice(0, 3);
      const quality = starters.reduce((s, p) => s + p.overall(), 0) / Math.max(1, starters.length);
      const room = players.reduce((s, p) => s + (p.potentialOverall() - p.overall()), 0) / players.length;
      return { group, quality: round(quality, 1), room: round(room, 1), score: round(room * 1.6 - (quality - 75) * 0.3, 2) };
    })
    .sort(byDesc((g) => g.score));
}
