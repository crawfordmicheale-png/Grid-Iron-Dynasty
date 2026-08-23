// End-of-season honours.
//
// Awards are voted on production, not on ratings -- a 78-overall receiver who
// caught 100 balls wins over an 88 who missed six games. Team success is worth
// something too, the way it is in real voting.

import { POSITIONS } from '../data/positions.js';
import { passerRating, byDesc, round, clamp, remap } from '../core/util.js';

/** A single number for how well a player performed this season. */
export function productionScore(player, team) {
  const s = player.stats;
  const pos = player.pos;
  const group = POSITIONS[pos]?.group;
  let score = 0;

  if (pos === 'QB') {
    const att = s.passAtt ?? 0;
    if (att < 100) return 0;
    const rating = passerRating(att, s.passCmp ?? 0, s.passYds ?? 0, s.passTD ?? 0, s.passInt ?? 0);
    score = (s.passYds ?? 0) * 0.032
      + (s.passTD ?? 0) * 4.6
      - (s.passInt ?? 0) * 3.4
      - (s.sacked ?? 0) * 0.35
      + (s.rushYds ?? 0) * 0.045
      + (s.rushTD ?? 0) * 4.0
      + (rating - 85) * 0.85;
  } else if (group === 'BACK') {
    score = (s.rushYds ?? 0) * 0.055
      + (s.rushTD ?? 0) * 5.2
      + (s.recYds ?? 0) * 0.045
      + (s.rec ?? 0) * 0.35
      - (s.fumbles ?? 0) * 3.5;
  } else if (group === 'WR' || group === 'TE') {
    score = (s.recYds ?? 0) * 0.052
      + (s.rec ?? 0) * 0.55
      + (s.recTD ?? 0) * 5.4
      - (s.drops ?? 0) * 1.2;
  } else if (group === 'OL') {
    // No box score exists for a lineman, so he is judged on his own quality and
    // on how the offense in front of him functioned.
    const snaps = player.snapCount ?? 0;
    if (snaps < 300) return 0;
    score = player.overall() * 1.15
      + remap(team?.offenseRating ?? 70, 60, 90, -8, 12);
  } else if (group === 'DL' || group === 'LB') {
    score = (s.sacks ?? 0) * 8.5
      + (s.tackles ?? 0) * 0.55
      + (s.int ?? 0) * 6.5
      + (s.passDef ?? 0) * 1.5
      + (s.forcedFumbles ?? 0) * 4.5;
  } else if (group === 'DB') {
    score = (s.int ?? 0) * 11
      + (s.passDef ?? 0) * 3.2
      + (s.tackles ?? 0) * 0.42
      + (s.sacks ?? 0) * 5
      + (s.forcedFumbles ?? 0) * 4.5;
  } else if (pos === 'K') {
    const att = s.fgAtt ?? 0;
    if (att < 12) return 0;
    score = (s.fgMade ?? 0) * 2.6 - (att - (s.fgMade ?? 0)) * 2.2;
  } else if (pos === 'P') {
    score = (s.puntYds ?? 0) * 0.005;
  }

  // Availability matters.
  const gamesPlayed = clamp((player.snapCount ?? 0) / 55, 0, 17);
  score *= remap(gamesPlayed, 8, 17, 0.75, 1.0);
  return score;
}

function withTeams(league) {
  const out = [];
  for (const team of league.allTeams()) {
    for (const p of team.roster) out.push({ player: p, team });
  }
  return out;
}

function best(entries, filter, scorer = (e) => productionScore(e.player, e.team)) {
  const pool = entries.filter(filter).map((e) => ({ ...e, score: scorer(e) }));
  pool.sort(byDesc((e) => e.score));
  return pool[0] ?? null;
}

export function selectAwards(league) {
  const entries = withTeams(league);
  const isOffense = (e) => POSITIONS[e.player.pos]?.unit === 'OFF';
  const isDefense = (e) => POSITIONS[e.player.pos]?.unit === 'DEF';
  const isRookie = (e) => e.player.exp === 0;

  // MVP weights team success heavily, which is how the real award goes.
  const mvpScorer = (e) => productionScore(e.player, e.team)
    * remap(e.team.winPct, 0.3, 0.85, 0.72, 1.28)
    * (e.player.pos === 'QB' ? 1.30 : 1.0);

  const mvp = best(entries, () => true, mvpScorer);
  const opoy = best(entries, (e) => isOffense(e) && e.player.id !== mvp?.player.id);
  const dpoy = best(entries, isDefense);
  const oroy = best(entries, (e) => isOffense(e) && isRookie(e));
  const droy = best(entries, (e) => isDefense(e) && isRookie(e));
  const comeback = best(entries, (e) => (e.player.history ?? []).some((h) => h.type === 'majorInjury'));

  // Coach of the year: how far the club exceeded what its roster suggested.
  const coachEntries = league.allTeams().map((team) => {
    const expected = remap(team.overallRating, 65, 88, 0.32, 0.70);
    return { team, coach: team.staff?.HC, score: (team.winPct - expected) * 100 + team.winPct * 12 };
  }).sort(byDesc((e) => e.score));

  const allPro = selectAllPro(entries);

  return {
    year: league.year,
    mvp: mvp && { playerId: mvp.player.id, name: mvp.player.name, pos: mvp.player.pos, teamId: mvp.team.id, score: round(mvp.score, 1) },
    opoy: opoy && { playerId: opoy.player.id, name: opoy.player.name, pos: opoy.player.pos, teamId: opoy.team.id },
    dpoy: dpoy && { playerId: dpoy.player.id, name: dpoy.player.name, pos: dpoy.player.pos, teamId: dpoy.team.id },
    oroy: oroy && { playerId: oroy.player.id, name: oroy.player.name, pos: oroy.player.pos, teamId: oroy.team.id },
    droy: droy && { playerId: droy.player.id, name: droy.player.name, pos: droy.player.pos, teamId: droy.team.id },
    comeback: comeback && { playerId: comeback.player.id, name: comeback.player.name, teamId: comeback.team.id },
    coachOfYear: coachEntries[0] && {
      coachId: coachEntries[0].coach?.id, name: coachEntries[0].coach?.name, teamId: coachEntries[0].team.id,
    },
    allPro,
  };
}

// One first team and one second team, by position, across the whole league.
const ALL_PRO_SLOTS = {
  QB: 1, RB: 1, FB: 0, WR: 3, TE: 1, OT: 2, OG: 2, C: 1,
  EDGE: 2, DT: 2, LB: 3, CB: 2, S: 2, K: 1, P: 1, LS: 0,
};

export function selectAllPro(entries) {
  const first = [];
  const second = [];
  for (const [pos, slots] of Object.entries(ALL_PRO_SLOTS)) {
    if (!slots) continue;
    const pool = entries
      .filter((e) => e.player.pos === pos)
      .map((e) => ({ ...e, score: productionScore(e.player, e.team) }))
      .sort(byDesc((e) => e.score));
    for (let i = 0; i < slots && i < pool.length; i += 1) {
      first.push({ playerId: pool[i].player.id, name: pool[i].player.name, pos, teamId: pool[i].team.id });
    }
    for (let i = slots; i < slots * 2 && i < pool.length; i += 1) {
      second.push({ playerId: pool[i].player.id, name: pool[i].player.name, pos, teamId: pool[i].team.id });
    }
  }
  return { first, second };
}

/** League statistical leaders, for the season recap. */
export function statLeaders(league) {
  const all = league.allPlayers();
  const top = (key, n = 5, filter = () => true) => all
    .filter((p) => (p.stats[key] ?? 0) > 0 && filter(p))
    .sort(byDesc((p) => p.stats[key]))
    .slice(0, n)
    .map((p) => ({
      playerId: p.id, name: p.name, pos: p.pos, teamId: p.teamId, value: p.stats[key],
    }));

  return {
    passYds: top('passYds'), passTD: top('passTD'), passInt: top('passInt'),
    rushYds: top('rushYds'), rushTD: top('rushTD'),
    recYds: top('recYds'), rec: top('rec'), recTD: top('recTD'),
    sacks: top('sacks'), tackles: top('tackles'), int: top('int'),
  };
}

/** Attach accolades so they follow a player through his career. */
export function recordAccolades(league, awards) {
  const give = (playerId, label) => {
    const p = league.findPlayer(playerId);
    if (p) p.accolades.push({ year: league.year, label });
  };
  if (awards.mvp) give(awards.mvp.playerId, 'MVP');
  if (awards.opoy) give(awards.opoy.playerId, 'Offensive Player of the Year');
  if (awards.dpoy) give(awards.dpoy.playerId, 'Defensive Player of the Year');
  if (awards.oroy) give(awards.oroy.playerId, 'Offensive Rookie of the Year');
  if (awards.droy) give(awards.droy.playerId, 'Defensive Rookie of the Year');
  for (const s of awards.allPro.first) give(s.playerId, 'First Team All-Pro');
  for (const s of awards.allPro.second) give(s.playerId, 'Second Team All-Pro');
}
