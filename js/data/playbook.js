// The playbook assembler.
//
// Concepts and formations are stored separately because that is how coaches
// think: "Dagger" is a concept you can run from half a dozen looks. This module
// pairs them into concrete plays, filters the result down to what a given
// scheme would actually carry, and tags each play for the situations it belongs
// in.

import { FORMATIONS, FORMATION_KEYS, formationSlots } from './formations.js';
import { PASS_CONCEPTS, PASS_CONCEPT_KEYS } from './passConcepts.js';
import { RUN_CONCEPTS, RUN_CONCEPT_KEYS } from './runConcepts.js';
import { ROUTES } from './routes.js';
import { FRONTS, COVERAGES, PRESSURES, FRONT_KEYS, COVERAGE_KEYS, PRESSURE_KEYS, isLegalCall } from './defense.js';
import { OFFENSIVE_SCHEMES, DEFENSIVE_SCHEMES } from './schemes.js';

// A concept needs its first few reads to exist in the formation. Routes for
// slots the formation does not have are simply dropped, which is what happens
// in a real playbook when you run a three-receiver concept from a two-receiver
// set -- somebody's route just is not in the picture.
const REQUIRED_READS = 3;

function conceptFitsFormation(concept, formation) {
  const slots = new Set(formationSlots(formation));
  const required = concept.progression.slice(0, REQUIRED_READS);
  if (!required.every((s) => slots.has(s))) return false;
  // A concept that needs a fullback needs a formation with one.
  if (concept.routes.FB && !slots.has('FB')) return false;
  return true;
}

// Fill in assignments for slots the concept did not name.
function completeRoutes(concept, formation) {
  const slots = formationSlots(formation);
  const routes = {};
  // A back stays in to protect only when the call actually asks for it. Five
  // linemen handle a four-man rush, so on an ordinary dropback he releases --
  // which is why backs see roughly a fifth of all NFL targets.
  const backMustBlock = concept.protection === 'maxProtect' || (concept.extraBlockers ?? 0) > 0;
  for (const slot of slots) {
    if (concept.routes[slot]) {
      const assigned = concept.routes[slot];
      if ((slot === 'RB' || slot === 'FB') && assigned === 'block' && !backMustBlock) {
        routes[slot] = slot === 'RB' ? 'checkdown' : 'flat';
        continue;
      }
      routes[slot] = assigned;
    } else if (slot === 'RB') {
      // A back who is not needed in protection releases as an outlet. Real
      // offenses throw to their backs on about a fifth of all attempts; leaving
      // him in to block by default starved that entirely.
      routes[slot] = concept.protection === 'maxProtect' ? 'block' : 'checkdown';
    } else if (slot === 'FB') {
      routes[slot] = concept.protection === 'maxProtect' ? 'block' : 'flat';
    } else if (slot.startsWith('TE')) {
      routes[slot] = concept.protection === 'maxProtect' ? 'block' : 'checkdown';
    } else {
      // An unassigned receiver runs a clear-out so he is at least occupying a defender.
      routes[slot] = 'go';
    }
  }
  return routes;
}

// How many bodies stay in to protect.
function countBlockers(routes, formation, concept) {
  let blockers = 5; // the offensive line
  for (const [slot, route] of Object.entries(routes)) {
    if (ROUTES[route]?.blocker) blockers += 1;
  }
  return blockers + (concept.extraBlockers ?? 0);
}

// Situational tags drive both the play-call sheet filters and the AI.
function situationTags(play) {
  const tags = new Set(play.tags ?? []);
  if (play.type === 'pass') {
    const c = PASS_CONCEPTS[play.concept];
    if (c.timing <= 1.8) { tags.add('quickGame'); tags.add('thirdAndShort'); tags.add('blitzBeater'); }
    if (c.timing >= 3.0) { tags.add('slowDeveloping'); tags.add('shot'); }
    if (c.tags.includes('deep')) tags.add('thirdAndLong');
    if (c.tags.includes('screen')) { tags.add('thirdAndLong'); tags.add('blitzBeater'); }
    if (c.family === 'quickGame' || c.family === 'westCoast') tags.add('twoMinute');
    if (c.playAction) tags.add('firstDown');
    const maxDepth = Math.max(...Object.values(play.routes).map((r) => ROUTES[r]?.depth ?? 0));
    if (maxDepth <= 8) tags.add('redZone');
    if (maxDepth >= 18) tags.add('needChunk');
  } else {
    const c = RUN_CONCEPTS[play.concept];
    if (c.tags.includes('shortYardage')) { tags.add('shortYardage'); tags.add('goalLine'); }
    if (c.timing <= 1.4) tags.add('shortYardage');
    if (c.tags.includes('passingDown')) tags.add('thirdAndLong');
    if (c.aimGap === 'D' || c.tags.includes('perimeter')) tags.add('perimeter');
    if (FORMATIONS[play.formation].tags.includes('heavy')) { tags.add('shortYardage'); tags.add('goalLine'); }
    tags.add('firstDown');
  }
  return Array.from(tags);
}

let playSeq = 0;

function makePassPlay(formationKey, conceptKey) {
  const formation = FORMATIONS[formationKey];
  const concept = PASS_CONCEPTS[conceptKey];
  const routes = completeRoutes(concept, formation);
  const progression = concept.progression.filter((s) => routes[s] && !ROUTES[routes[s]].blocker);
  // Any eligible receiver the concept did not name is still an option. The
  // outlet goes in as the third read rather than the last: a quarterback checks
  // it down when his first two are covered, he does not work through four
  // downfield receivers first. Backs take about a fifth of all NFL targets and
  // burying them at the end of every progression made that impossible.
  for (const slot of ['RB', 'FB', 'TE2']) {
    if (!routes[slot] || ROUTES[routes[slot]].blocker) continue;
    const existing = progression.indexOf(slot);
    if (existing >= 0) {
      // Already a read, but buried at the bottom. Move it up.
      if (existing > 2) {
        progression.splice(existing, 1);
        progression.splice(2, 0, slot);
      }
    } else {
      progression.splice(Math.min(2, progression.length), 0, slot);
    }
  }
  playSeq += 1;
  const play = {
    id: `pass_${conceptKey}_${formationKey}`,
    seq: playSeq,
    type: 'pass',
    name: `${formation.name} ${concept.name}`,
    shortName: concept.name,
    formation: formationKey,
    concept: conceptKey,
    personnel: formation.personnel,
    routes,
    progression,
    dropDepth: concept.dropDepth,
    timing: concept.timing,
    protection: concept.protection,
    blockers: countBlockers(routes, formation, concept),
    playAction: concept.playAction && formation.paMult >= 0.8,
    paMult: formation.paMult,
    rollout: concept.rollout ?? false,
    family: concept.family,
    tags: [...concept.tags, ...formation.tags],
  };
  // Depth of the first read: what the play is actually trying to do.
  const firstRead = progression[0];
  play.primaryDepth = firstRead ? (ROUTES[routes[firstRead]]?.depth ?? 0) : 0;
  play.tags = situationTags(play);
  return play;
}

function makeRunPlay(formationKey, conceptKey) {
  const formation = FORMATIONS[formationKey];
  const concept = RUN_CONCEPTS[conceptKey];
  playSeq += 1;
  const play = {
    id: `run_${conceptKey}_${formationKey}`,
    seq: playSeq,
    type: 'run',
    name: `${formation.name} ${concept.name}`,
    shortName: concept.name,
    formation: formationKey,
    concept: conceptKey,
    personnel: formation.personnel,
    aimGap: concept.aimGap,
    blocking: concept.blocking,
    pullers: concept.pullers,
    doubleTeams: concept.doubleTeams,
    cutback: concept.cutback,
    timing: concept.timing,
    qbRun: concept.qbRun ?? false,
    qbRead: concept.qbRead ?? false,
    misdirection: concept.misdirection ?? 0,
    gapStrength: formation.gaps,
    family: concept.family,
    tags: [...concept.tags, ...formation.tags],
  };
  play.tags = situationTags(play);
  return play;
}

function runFitsFormation(concept, formation) {
  const slots = new Set(formationSlots(formation));
  if (concept.requiresFB && !slots.has('FB')) return false;
  if (!concept.qbRun && !slots.has('RB')) return false;    // somebody has to carry it
  if (concept.motion && !slots.has('SLOT') && !slots.has('Z')) return false;
  // Sneaks and goal-line runs do not belong in empty sets.
  if (formation.empty && !concept.qbRun) return false;
  if (concept.sneak && formation.shotgun) return false;
  return true;
}

/** Every legal play in the game. */
export function buildPlayPool() {
  playSeq = 0;
  const passes = [];
  const runs = [];
  for (const fKey of FORMATION_KEYS) {
    const formation = FORMATIONS[fKey];
    for (const cKey of PASS_CONCEPT_KEYS) {
      if (conceptFitsFormation(PASS_CONCEPTS[cKey], formation)) passes.push(makePassPlay(fKey, cKey));
    }
    for (const cKey of RUN_CONCEPT_KEYS) {
      if (runFitsFormation(RUN_CONCEPTS[cKey], formation)) runs.push(makeRunPlay(fKey, cKey));
    }
  }
  return { passes, runs, all: [...passes, ...runs] };
}

// How well a play suits a scheme. Combines the scheme's concept bias, its run
// bias, and how much it likes that personnel grouping.
export function schemeAffinity(play, offScheme) {
  const personnelBias = offScheme.personnelBias?.[play.personnel] ?? 0.5;
  if (play.type === 'pass') {
    const familyBias = offScheme.conceptBias?.[play.family] ?? 1;
    const shotgun = FORMATIONS[play.formation].shotgun;
    const shotgunFit = shotgun
      ? 0.6 + offScheme.shotgunRate * 0.8
      : 0.6 + (1 - offScheme.shotgunRate) * 0.8;
    return familyBias * personnelBias * shotgunFit;
  }
  const familyBias = offScheme.runBias?.[play.family] ?? 1;
  return familyBias * personnelBias;
}

/**
 * The plays a club actually carries. Real playbooks are a few hundred plays
 * deep; a game plan is a slice of that. This returns the club's full book.
 */
export function playbookForScheme(rng, offSchemeKey, size = 150) {
  const scheme = OFFENSIVE_SCHEMES[offSchemeKey] ?? OFFENSIVE_SCHEMES.PRO_STYLE;
  const pool = buildPlayPool();

  const targetPass = Math.round(size * (0.5 + scheme.basePassRate * 0.35));
  const targetRun = size - targetPass;

  const pick = (plays, n) => {
    const chosen = [];
    const remaining = plays.slice();
    for (let i = 0; i < n && remaining.length; i += 1) {
      const weights = remaining.map((p) => schemeAffinity(p, scheme) ** 1.6);
      const play = rng.weighted(remaining, weights);
      chosen.push(play);
      remaining.splice(remaining.indexOf(play), 1);
    }
    return chosen;
  };

  const passes = pick(pool.passes, Math.min(targetPass, pool.passes.length));
  const runs = pick(pool.runs, Math.min(targetRun, pool.runs.length));

  // A playbook missing a short-yardage answer is a broken playbook, so make
  // sure the essentials are in there regardless of what the weights chose.
  const ensure = (list, source, predicate, count) => {
    const have = list.filter(predicate).length;
    if (have >= count) return;
    const extras = source.filter((p) => predicate(p) && !list.includes(p));
    list.push(...extras.slice(0, count - have));
  };
  ensure(runs, pool.runs, (p) => p.tags.includes('shortYardage'), 3);
  ensure(runs, pool.runs, (p) => RUN_CONCEPTS[p.concept].sneak, 1);
  ensure(passes, pool.passes, (p) => p.tags.includes('screen'), 2);
  ensure(passes, pool.passes, (p) => p.tags.includes('quickGame'), 4);
  ensure(passes, pool.passes, (p) => p.tags.includes('shot'), 3);
  ensure(passes, pool.passes, (p) => p.tags.includes('redZone'), 4);

  return { passes, runs, all: [...passes, ...runs] };
}

/** Every legal defensive call, weighted for a scheme. */
export function buildDefensiveCalls() {
  const calls = [];
  for (const f of FRONT_KEYS) {
    for (const c of COVERAGE_KEYS) {
      for (const p of PRESSURE_KEYS) {
        if (!isLegalCall(f, c, p)) continue;
        calls.push({
          id: `${f}_${c}_${p}`,
          front: f, coverage: c, pressure: p,
          name: PRESSURES[p].key === 'none'
            ? `${FRONTS[f].name} ${COVERAGES[c].name}`
            : `${FRONTS[f].name} ${PRESSURES[p].name} / ${COVERAGES[c].name}`,
          shortName: PRESSURES[p].key === 'none' ? COVERAGES[c].name : PRESSURES[p].name,
          blitz: PRESSURES[p].extraRushers > 0,
          man: COVERAGES[c].manRatio >= 0.5,
        });
      }
    }
  }
  return calls;
}

export function defensiveAffinity(call, defScheme) {
  const f = defScheme.frontBias?.[call.front] ?? 1;
  const c = defScheme.coverageBias?.[call.coverage] ?? 1;
  const blitzFit = PRESSURES[call.pressure].extraRushers > 0
    ? defScheme.baseBlitzRate * 2.2
    : 1.4 - defScheme.baseBlitzRate;
  return f * c * Math.max(0.05, blitzFit);
}

export function defensivePlaybookForScheme(rng, defSchemeKey, size = 60) {
  const scheme = DEFENSIVE_SCHEMES[defSchemeKey] ?? DEFENSIVE_SCHEMES.FOUR_THREE;
  const pool = buildDefensiveCalls();
  const chosen = [];
  const remaining = pool.slice();
  for (let i = 0; i < size && remaining.length; i += 1) {
    const weights = remaining.map((c) => defensiveAffinity(c, scheme) ** 1.5);
    const call = rng.weighted(remaining, weights);
    chosen.push(call);
    remaining.splice(remaining.indexOf(call), 1);
  }
  // Always carry a base call, a soft shell, and something to bring pressure with.
  const ensure = (predicate) => {
    if (chosen.some(predicate)) return;
    const extra = pool.find(predicate);
    if (extra) chosen.push(extra);
  };
  ensure((c) => c.pressure === 'none' && c.coverage === 'cover3');
  ensure((c) => c.coverage === 'cover4');
  ensure((c) => c.blitz);
  ensure((c) => c.coverage === 'cover2');
  ensure((c) => c.coverage === 'cover1');
  return chosen;
}
