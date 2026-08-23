// Schedule generation, built on the real formula.
//
// Seventeen games over eighteen weeks:
//   6  -- home and away against the three division rivals
//   4  -- against every team in one other division of the same conference
//   4  -- against every team in one division of the other conference
//   2  -- against the same-place finishers in the two remaining own-conference divisions
//   1  -- against a same-place finisher in the other conference
//
// 32 teams x 17 games / 2 = 272 games. The division pairings rotate on a fixed
// cycle so every matchup comes back around, which is what makes a franchise's
// schedule genuinely vary from year to year.

import { CONFERENCES, DIVISIONS } from '../data/teams.js';

export const REGULAR_SEASON_WEEKS = 18;
export const GAMES_PER_TEAM = 17;
export const TOTAL_GAMES = 272;

// The three ways to split four divisions into two pairs. Cycling through them
// means a division plays each of the other three once every three years.
const INTRA_PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

export function intraConferencePairs(year) {
  return INTRA_PAIRINGS[year % 3];
}

export function interConferenceOpponentDivision(divIndex, year) {
  return (divIndex + year) % 4;
}

// The seventeenth game comes from a different division than the full crossover.
export function crossoverOpponentDivision(divIndex, year) {
  return (divIndex + year + 1) % 4;
}

function divisionKey(conf, dIndex) {
  return `${conf}-${DIVISIONS[dIndex]}`;
}

/**
 * Divisions in last season's finishing order, which is what the same-place
 * games are based on.
 */
function orderedDivisions(league, priorFinish) {
  const out = {};
  for (const conf of Object.keys(CONFERENCES)) {
    for (let d = 0; d < DIVISIONS.length; d += 1) {
      const key = divisionKey(conf, d);
      const teams = league.teamsInDivision(conf, DIVISIONS[d]);
      const ordered = priorFinish?.[key]
        ? priorFinish[key].map((id) => league.team(id)).filter(Boolean)
        : teams;
      out[key] = ordered.length === teams.length ? ordered : teams;
    }
  }
  return out;
}

/** All 272 matchups for a season, without weeks assigned. */
export function buildMatchups(league, year, priorFinish = null) {
  const div = orderedDivisions(league, priorFinish);
  const [confA, confB] = Object.keys(CONFERENCES);
  const games = [];
  const add = (home, away, kind) => games.push({ home: home.id, away: away.id, kind });

  // --- 6 division games: home and away against each rival (96 games) ---
  for (const key of Object.keys(div)) {
    const teams = div[key];
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        add(teams[i], teams[j], 'division');
        add(teams[j], teams[i], 'division');
      }
    }
  }

  // --- 4 games against one other division in the same conference (64) ---
  const pairs = intraConferencePairs(year);
  for (const conf of [confA, confB]) {
    for (const [d1, d2] of pairs) {
      const a = div[divisionKey(conf, d1)];
      const b = div[divisionKey(conf, d2)];
      a.forEach((t, i) => b.forEach((o, j) => {
        // Alternate hosts so the same club is not always at home.
        if ((i + j + year) % 2 === 0) add(t, o, 'intraConf');
        else add(o, t, 'intraConf');
      }));
    }
  }

  // --- 4 games against one division in the other conference (64) ---
  // Generated once, from conference A's side, so the pairing is a bijection.
  for (let d = 0; d < DIVISIONS.length; d += 1) {
    const a = div[divisionKey(confA, d)];
    const b = div[divisionKey(confB, interConferenceOpponentDivision(d, year))];
    a.forEach((t, i) => b.forEach((o, j) => {
      if ((i + j + year) % 2 === 0) add(t, o, 'interConf');
      else add(o, t, 'interConf');
    }));
  }

  // --- 2 same-place games in the remaining own-conference divisions (32) ---
  // Removing the crossover pairing from the four divisions leaves exactly four
  // pairs, and those form a cycle. Orienting the cycle consistently is what
  // guarantees every club hosts exactly one of its two same-place games --
  // parity on the division indices does not, because the two divisions a club
  // is left with can share a parity.
  for (const conf of [confA, confB]) {
    const [[a1, b1], [a2, b2]] = pairs;
    const cycle = [a1, a2, b1, b2]; // a1 -> a2 -> b1 -> b2 -> a1
    for (let i = 0; i < cycle.length; i += 1) {
      const dHost = cycle[i];
      const dGuest = cycle[(i + 1) % cycle.length];
      const hostTeams = div[divisionKey(conf, dHost)];
      const guestTeams = div[divisionKey(conf, dGuest)];
      for (let place = 0; place < 4; place += 1) {
        const t = hostTeams[place];
        const o = guestTeams[place];
        if (!t || !o) continue;
        // Flip the whole cycle some years so the same club is not always host.
        if ((place + year) % 2 === 0) add(t, o, 'samePlace');
        else add(o, t, 'samePlace');
      }
    }
  }

  // --- The 17th game: a same-place finisher in the other conference (16) ---
  // A whole conference gets the extra home game, alternating by year, which is
  // what keeps every club at either eight or nine home games.
  const confAHosts = year % 2 === 0;
  for (let d = 0; d < DIVISIONS.length; d += 1) {
    const a = div[divisionKey(confA, d)];
    const b = div[divisionKey(confB, crossoverOpponentDivision(d, year))];
    for (let place = 0; place < 4; place += 1) {
      const t = a[place];
      const o = b[place];
      if (!t || !o) continue;
      if (confAHosts) add(t, o, 'crossover17');
      else add(o, t, 'crossover17');
    }
  }

  return games;
}

/**
 * Byes: one per club, spread across the middle of the season. The count per
 * week must be even so the remaining teams pair off exactly.
 */
export function assignByes(rng, teamIds) {
  const plan = { 5: 2, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 2, 13: 2, 14: 2 };
  const slots = [];
  for (const [week, count] of Object.entries(plan)) {
    for (let i = 0; i < count; i += 1) slots.push(Number(week));
  }
  const shuffled = rng.shuffle(teamIds);
  const byeOf = new Map();
  shuffled.forEach((id, i) => byeOf.set(id, slots[i]));
  return byeOf;
}

/**
 * Place every matchup into a week.
 *
 * This is an edge-colouring problem: each club has seventeen games and exactly
 * seventeen legal weeks, so every club must use every one of its legal weeks
 * exactly once. A greedy pass paints itself into a corner, so this uses
 * min-conflicts local search instead: start from a random legal assignment,
 * then repeatedly move a game that is causing a clash to whichever legal week
 * causes the fewest, with the occasional random jump to escape a dead end.
 */
export function assignWeeks(rng, teamIds, matchups, restarts = 12) {
  const teamIndex = new Map(teamIds.map((id, i) => [id, i]));
  const W = REGULAR_SEASON_WEEKS;

  for (let attempt = 0; attempt < restarts; attempt += 1) {
    const byeOf = assignByes(rng, teamIds);
    const games = matchups.map((m) => ({ ...m }));

    // Legal weeks for each game: any week neither club is on bye.
    const legal = games.map((g) => {
      const hb = byeOf.get(g.home);
      const ab = byeOf.get(g.away);
      const out = [];
      for (let w = 1; w <= W; w += 1) if (w !== hb && w !== ab) out.push(w);
      return out;
    });

    // counts[teamIdx * W + (week - 1)] = games that club has that week.
    const counts = new Int16Array(teamIds.length * W);
    const at = (team, week) => teamIndex.get(team) * W + (week - 1);

    let conflicts = 0;
    const bump = (g, week, delta) => {
      for (const side of [g.home, g.away]) {
        const idx = at(side, week);
        const before = counts[idx];
        counts[idx] = before + delta;
        // Conflict count is the number of surplus games beyond one.
        conflicts += Math.max(0, counts[idx] - 1) - Math.max(0, before - 1);
      }
    };

    games.forEach((g, i) => {
      g.week = legal[i][Math.floor(rng.next() * legal[i].length)];
      bump(g, g.week, 1);
    });

    const maxSteps = 120000;
    for (let step = 0; step < maxSteps && conflicts > 0; step += 1) {
      // Pick a game that is currently clashing.
      let pickIdx = -1;
      for (let tries = 0; tries < 80; tries += 1) {
        const i = Math.floor(rng.next() * games.length);
        const g = games[i];
        if (counts[at(g.home, g.week)] > 1 || counts[at(g.away, g.week)] > 1) { pickIdx = i; break; }
      }
      if (pickIdx < 0) {
        pickIdx = games.findIndex((g) => counts[at(g.home, g.week)] > 1 || counts[at(g.away, g.week)] > 1);
        if (pickIdx < 0) break;
      }

      const g = games[pickIdx];
      bump(g, g.week, -1);

      // Occasionally jump at random so we do not get stuck in a local minimum.
      if (rng.next() < 0.04) {
        g.week = legal[pickIdx][Math.floor(rng.next() * legal[pickIdx].length)];
      } else {
        let best = g.week;
        let bestCost = Infinity;
        for (const w of legal[pickIdx]) {
          const cost = counts[at(g.home, w)] + counts[at(g.away, w)];
          if (cost < bestCost || (cost === bestCost && rng.next() < 0.35)) {
            bestCost = cost;
            best = w;
          }
        }
        g.week = best;
      }
      bump(g, g.week, 1);
    }

    if (conflicts === 0) return { games, byeOf };
  }
  return null;
}

/** Full schedule for a season, sorted by week. */
export function generateSchedule(rng, league, year, priorFinish = null) {
  const matchups = buildMatchups(league, year, priorFinish);
  const teamIds = league.allTeams().map((t) => t.id);
  const placed = assignWeeks(rng, teamIds, matchups);
  if (!placed) throw new Error('Could not build a legal schedule');

  return placed.games
    .map((m) => ({
      id: `${year}-w${m.week}-${m.away}@${m.home}`,
      week: m.week,
      home: m.home,
      away: m.away,
      kind: m.kind,
      played: false,
      result: null,
      primetime: false,
    }))
    .sort((a, b) => a.week - b.week || a.home.localeCompare(b.home));
}

/** Mark the most attractive games each week as prime time. */
export function assignPrimetime(league, schedule) {
  const byWeek = new Map();
  for (const g of schedule) {
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week).push(g);
  }
  for (const games of byWeek.values()) {
    const scoreOf = (g) => (league.team(g.home)?.overallRating ?? 0)
      + (league.team(g.away)?.overallRating ?? 0)
      + (league.team(g.home)?.div === league.team(g.away)?.div ? 4 : 0);
    games.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 2)
      .forEach((g) => { g.primetime = true; });
  }
  return schedule;
}
