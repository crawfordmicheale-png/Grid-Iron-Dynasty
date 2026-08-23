// Standings and tiebreakers.
//
// The tiebreaker ladder is the real one, in order, and it matters: division
// titles and the last playoff spot are decided on it every season.

import { CONFERENCES, DIVISIONS } from '../data/teams.js';
import { byDesc } from '../core/util.js';

/** Win percentage over a set of games, from one team's point of view. */
function record(games, teamId, filter = () => true) {
  let w = 0;
  let l = 0;
  let t = 0;
  for (const g of games) {
    if (!g.played || !g.result) continue;
    const isHome = g.home === teamId;
    const isAway = g.away === teamId;
    if (!isHome && !isAway) continue;
    if (!filter(g)) continue;
    const mine = isHome ? g.result.homeScore : g.result.awayScore;
    const theirs = isHome ? g.result.awayScore : g.result.homeScore;
    if (mine > theirs) w += 1;
    else if (mine < theirs) l += 1;
    else t += 1;
  }
  const played = w + l + t;
  return { w, l, t, played, pct: played ? (w + t * 0.5) / played : 0 };
}

function opponentsOf(games, teamId) {
  const out = [];
  for (const g of games) {
    if (!g.played) continue;
    if (g.home === teamId) out.push(g.away);
    else if (g.away === teamId) out.push(g.home);
  }
  return out;
}

/** Combined record of everyone this club beat. */
function strengthOfVictory(league, games, teamId) {
  let w = 0;
  let total = 0;
  for (const g of games) {
    if (!g.played || !g.result) continue;
    const isHome = g.home === teamId;
    const isAway = g.away === teamId;
    if (!isHome && !isAway) continue;
    const mine = isHome ? g.result.homeScore : g.result.awayScore;
    const theirs = isHome ? g.result.awayScore : g.result.homeScore;
    if (mine <= theirs) continue;
    const opp = league.team(isHome ? g.away : g.home);
    if (!opp) continue;
    w += opp.record.w + opp.record.t * 0.5;
    total += opp.record.w + opp.record.l + opp.record.t;
  }
  return total ? w / total : 0;
}

/** Combined record of everyone this club played. */
function strengthOfSchedule(league, games, teamId) {
  let w = 0;
  let total = 0;
  for (const oppId of opponentsOf(games, teamId)) {
    const opp = league.team(oppId);
    if (!opp) continue;
    w += opp.record.w + opp.record.t * 0.5;
    total += opp.record.w + opp.record.l + opp.record.t;
  }
  return total ? w / total : 0;
}

/** Head-to-head record of `teamId` against everyone in `group`. */
function headToHead(games, teamId, group) {
  const others = new Set(group.filter((id) => id !== teamId));
  return record(games, teamId, (g) => others.has(g.home) || others.has(g.away));
}

/** Opponents every club in the group has faced. */
function commonGames(games, group) {
  const sets = group.map((id) => new Set(opponentsOf(games, id)));
  if (!sets.length) return new Set();
  const common = new Set(sets[0]);
  for (const s of sets.slice(1)) {
    for (const id of Array.from(common)) if (!s.has(id)) common.delete(id);
  }
  for (const id of group) common.delete(id);
  return common;
}

/**
 * The tiebreaker ladder. Returns a comparator over team ids for a group that is
 * already tied on record. `scope` is 'division' or 'conference'.
 */
export function breakTie(league, games, group, scope = 'division', rng = null) {
  const common = commonGames(games, group);

  const metrics = group.map((id) => {
    const team = league.team(id);
    const h2h = headToHead(games, id, group);
    const div = record(games, id, (g) => {
      const other = g.home === id ? g.away : g.home;
      const o = league.team(other);
      return o && o.conf === team.conf && o.div === team.div;
    });
    const conf = record(games, id, (g) => {
      const other = g.home === id ? g.away : g.home;
      return league.team(other)?.conf === team.conf;
    });
    const commonRec = record(games, id, (g) => {
      const other = g.home === id ? g.away : g.home;
      return common.has(other);
    });
    return {
      id,
      h2h: h2h.played ? h2h.pct : -1,
      div: div.pct,
      common: commonRec.played >= 4 ? commonRec.pct : -1,
      conf: conf.pct,
      sov: strengthOfVictory(league, games, id),
      sos: strengthOfSchedule(league, games, id),
      pointDiff: team.record.pf - team.record.pa,
      pointsFor: team.record.pf,
      // Deterministic final coin flip, seeded off the club id.
      coin: rng ? rng.next() : 0,
    };
  });

  // Division ties go to head-to-head then division record; conference ties skip
  // straight past division record to conference record.
  const ladder = scope === 'division'
    ? ['h2h', 'div', 'common', 'conf', 'sov', 'sos', 'pointDiff', 'pointsFor', 'coin']
    : ['h2h', 'conf', 'common', 'sov', 'sos', 'pointDiff', 'pointsFor', 'coin'];

  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  return (a, b) => {
    for (const key of ladder) {
      const diff = byId[b][key] - byId[a][key];
      if (Math.abs(diff) > 1e-9) return diff;
    }
    return 0;
  };
}

/** Sort a set of teams by record, breaking ties properly. */
export function rankTeams(league, games, teamIds, scope = 'division', rng = null) {
  const withPct = teamIds.map((id) => ({ id, pct: league.team(id).winPct }));
  withPct.sort(byDesc((x) => x.pct));

  const out = [];
  let i = 0;
  while (i < withPct.length) {
    let j = i;
    while (j + 1 < withPct.length && Math.abs(withPct[j + 1].pct - withPct[i].pct) < 1e-9) j += 1;
    const tiedGroup = withPct.slice(i, j + 1).map((x) => x.id);
    if (tiedGroup.length === 1) {
      out.push(tiedGroup[0]);
    } else {
      const cmp = breakTie(league, games, tiedGroup, scope, rng);
      out.push(...tiedGroup.slice().sort(cmp));
    }
    i = j + 1;
  }
  return out;
}

export function divisionStandings(league, games, conf, div, rng = null) {
  const ids = league.teamsInDivision(conf, div).map((t) => t.id);
  return rankTeams(league, games, ids, 'division', rng);
}

/**
 * Conference seeding: four division winners first, ranked among themselves,
 * then the wild cards. A division winner always outranks a wild card even with
 * a worse record.
 */
export function conferenceSeeding(league, games, conf, rng = null) {
  const winners = [];
  const rest = [];
  for (const div of DIVISIONS) {
    const order = divisionStandings(league, games, conf, div, rng);
    winners.push(order[0]);
    rest.push(...order.slice(1));
  }
  const rankedWinners = rankTeams(league, games, winners, 'conference', rng);
  const rankedRest = rankTeams(league, games, rest, 'conference', rng);
  return [...rankedWinners, ...rankedRest];
}

export function playoffField(league, games, rng = null, spots = 7) {
  const field = {};
  for (const conf of Object.keys(CONFERENCES)) {
    const seeding = conferenceSeeding(league, games, conf, rng);
    field[conf] = seeding.slice(0, spots).map((id, i) => ({ seed: i + 1, teamId: id }));
  }
  return field;
}

/** A displayable standings table. */
export function standingsTable(league, games, rng = null) {
  const table = {};
  for (const conf of Object.keys(CONFERENCES)) {
    table[conf] = {};
    for (const div of DIVISIONS) {
      table[conf][div] = divisionStandings(league, games, conf, div, rng).map((id) => {
        const t = league.team(id);
        return {
          id,
          abbr: t.abbr,
          name: t.fullName,
          w: t.record.w,
          l: t.record.l,
          t: t.record.t,
          pct: t.winPct,
          pf: t.record.pf,
          pa: t.record.pa,
          diff: t.record.pf - t.record.pa,
          div: `${t.record.divW}-${t.record.divL}${t.record.divT ? `-${t.record.divT}` : ''}`,
          conf: `${t.record.confW}-${t.record.confL}${t.record.confT ? `-${t.record.confT}` : ''}`,
          streak: t.streak,
        };
      });
    }
  }
  return table;
}

/** Apply a completed game to both clubs' records. */
export function applyGameResult(league, game, result) {
  const home = league.team(game.home);
  const away = league.team(game.away);
  if (!home || !away) return;
  const sameDiv = home.conf === away.conf && home.div === away.div;
  const sameConf = home.conf === away.conf;

  home.record.pf += result.homeScore;
  home.record.pa += result.awayScore;
  away.record.pf += result.awayScore;
  away.record.pa += result.homeScore;

  const tie = result.homeScore === result.awayScore;
  const homeWon = result.homeScore > result.awayScore;

  const credit = (team, won, tied) => {
    if (tied) team.record.t += 1;
    else if (won) team.record.w += 1;
    else team.record.l += 1;
    if (sameDiv) {
      if (tied) team.record.divT += 1;
      else if (won) team.record.divW += 1;
      else team.record.divL += 1;
    }
    if (sameConf) {
      if (tied) team.record.confT += 1;
      else if (won) team.record.confW += 1;
      else team.record.confL += 1;
    }
    if (tied) team.streak = 0;
    else if (won) team.streak = team.streak >= 0 ? team.streak + 1 : 1;
    else team.streak = team.streak <= 0 ? team.streak - 1 : -1;
  };

  credit(home, homeWon, tie);
  credit(away, !homeWon && !tie, tie);

  game.played = true;
  game.result = result;
}
