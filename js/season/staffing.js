// Hiring and firing.
//
// An owner who has run out of patience fires the head coach. A coordinator who
// just had a good year gets hired away. Both happen in January, and both are
// things a franchise has to plan around.

import { generateCoach, STAFF_ROLES, STAFF_ROLE_KEYS } from '../model/staff.js';
import { clamp, remap, byDesc } from '../core/util.js';

/** Clubs whose owner has seen enough. */
export function firingCandidates(league) {
  return league.allTeams()
    .filter((t) => t.ownerPatience < 25 && !t.isUserTeam)
    .sort((a, b) => a.ownerPatience - b.ownerPatience);
}

/** Coordinators good enough to be hired as head coaches elsewhere. */
export function headCoachCandidates(league) {
  const pool = [];
  for (const team of league.allTeams()) {
    for (const role of ['OC', 'DC']) {
      const coach = team.staff[role];
      if (coach && coach.hcCandidacy() >= 68) pool.push({ coach, from: team });
    }
  }
  for (const coach of league.coachPool) {
    if (['HC', 'OC', 'DC'].includes(coach.role) && coach.hcCandidacy() >= 62) {
      pool.push({ coach, from: null });
    }
  }
  return pool.sort(byDesc((c) => c.coach.hcCandidacy()));
}

/**
 * Run the January hiring cycle: fire, then fill, then backfill the coordinators
 * who got promoted away.
 */
export function runCoachingCarousel(rng, league, opts = {}) {
  const events = [];
  const openings = [];

  // --- Firings ---
  for (const team of firingCandidates(league)) {
    // Not everybody with a bad year gets fired.
    const chance = clamp(remap(team.ownerPatience, 25, 0, 0.35, 0.95), 0, 0.95);
    if (!rng.bool(chance)) continue;
    const fired = team.staff.HC;
    if (fired) {
      fired.teamId = null;
      fired.history.push({ year: league.year, team: team.id, event: 'fired' });
      league.coachPool.push(fired);
      events.push({ type: 'fired', teamId: team.id, coach: fired });
      league.log('staff', `${team.fullName} part ways with head coach ${fired.name}.`);
    }
    team.staff.HC = null;
    openings.push(team);
    // Coordinators often follow a fired head coach out the door.
    for (const role of ['OC', 'DC']) {
      if (rng.bool(0.45) && team.staff[role]) {
        const c = team.staff[role];
        c.teamId = null;
        league.coachPool.push(c);
        team.staff[role] = null;
      }
    }
  }

  // --- Head coach hires ---
  const candidates = headCoachCandidates(league);
  for (const team of openings) {
    // Better jobs attract better candidates.
    const jobAppeal = team.overallRating * 0.5 + team.market * 4 + (team.winPct * 20);
    const pool = candidates.filter((c) => c.coach.teamId === null || c.from);
    if (!pool.length) break;
    const weights = pool.map((c) => {
      let w = c.coach.hcCandidacy() ** 1.6;
      // A coordinator on a good team needs a good job to leave for.
      if (c.from) w *= remap(jobAppeal - c.from.overallRating * 0.5, -20, 30, 0.3, 1.5);
      w *= remap(c.coach.loyalty, 10, 95, 1.2, 0.7);
      return Math.max(0.01, w);
    });
    const picked = rng.weighted(pool, weights);
    if (!picked) break;

    if (picked.from) {
      picked.from.staff[picked.coach.role] = null;
      events.push({ type: 'poached', from: picked.from.id, to: team.id, coach: picked.coach });
      league.log('staff', `${team.fullName} hire ${picked.coach.name} away from ${picked.from.fullName} as head coach.`);
    } else {
      league.coachPool = league.coachPool.filter((c) => c.id !== picked.coach.id);
      league.log('staff', `${team.fullName} hire ${picked.coach.name} as head coach.`);
    }
    picked.coach.role = 'HC';
    picked.coach.teamId = team.id;
    picked.coach.history.push({ year: league.year, team: team.id, event: 'hired as HC' });
    team.staff.HC = picked.coach;
    team.ownerPatience = clamp(team.ownerPatience + 35, 30, 90);
    candidates.splice(candidates.indexOf(picked), 1);
    events.push({ type: 'hired', teamId: team.id, coach: picked.coach });
  }

  // --- Backfill every empty seat ---
  const usedNames = new Set();
  for (const team of league.allTeams()) {
    for (const roleKey of STAFF_ROLE_KEYS) {
      const def = STAFF_ROLES[roleKey];
      if (def.slots > 1) {
        const list = Array.isArray(team.staff[roleKey]) ? team.staff[roleKey].filter(Boolean) : [];
        while (list.length < def.slots) {
          list.push(hireFromPool(rng, league, roleKey, team, usedNames));
        }
        team.staff[roleKey] = list;
        continue;
      }
      if (!team.staff[roleKey]) {
        team.staff[roleKey] = hireFromPool(rng, league, roleKey, team, usedNames);
        // A new head coach usually brings his own system.
        if (roleKey === 'OC' && team.staff.HC && rng.bool(0.55)) {
          team.staff.OC.offScheme = team.staff.HC.offScheme;
        }
        if (roleKey === 'DC' && team.staff.HC && rng.bool(0.55)) {
          team.staff.DC.defScheme = team.staff.HC.defScheme;
        }
      }
    }
  }

  return events;
}

function hireFromPool(rng, league, roleKey, team, usedNames) {
  // Prefer somebody already in the pool who fits the role.
  const inPool = league.coachPool.filter((c) => c.role === roleKey);
  const quality = team.overallRating * 0.5 + team.market * 3 + 20;
  if (inPool.length && rng.bool(0.7)) {
    const picked = rng.weighted(inPool, (c) => c.overall ** 1.4);
    league.coachPool = league.coachPool.filter((c) => c.id !== picked.id);
    picked.teamId = team.id;
    return picked;
  }
  // Otherwise promote or hire from outside the league.
  return generateCoach(rng, {
    role: roleKey,
    teamId: team.id,
    overall: clamp(rng.gauss(quality * 0.55 + 25, 10), 28, 92),
    usedNames,
  });
}

/** Refresh the pool of unemployed coaches so hiring never runs dry. */
export function replenishCoachPool(rng, league, target = 26) {
  const usedNames = new Set();
  while (league.coachPool.length < target) {
    league.coachPool.push(generateCoach(rng, {
      role: rng.weighted(STAFF_ROLE_KEYS, (k) => (k === 'SCOUT' ? 3 : 1)),
      overall: clamp(rng.gauss(56, 11), 28, 90),
      usedNames,
    }));
  }
  // Coaches who sit out too long leave the profession.
  league.coachPool = league.coachPool.filter(() => !rng.bool(0.06));
}
