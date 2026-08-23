// The draft, and the scouting that precedes it.
//
// The interesting part of a draft is not picking the best player, it is not
// knowing who the best player is. Every club sees a prospect through its own
// noisy report: the noise shrinks with scouting work and with the quality of
// the scouts doing it, and it never quite reaches zero before the pick is made.
// Development tier and ceiling stay the foggiest things of all, which is why
// busts and steals both exist.

import { generatePlayer } from '../model/playerGen.js';
import { DEV_TIERS } from '../model/player.js';
import { POSITIONS, ROSTER_BLUEPRINT, POSITION_KEYS } from '../data/positions.js';
import { BLUE_CHIP_COLLEGES, COLLEGES } from '../data/names.js';
import { buildRookieContract } from '../model/contract.js';
import { clamp, remap, byDesc, round } from '../core/util.js';

export const DRAFT_ROUNDS = 7;
export const PICKS_PER_ROUND = 32;

// Athletic testing is measured, not estimated, so these come back accurate.
const COMBINE_ATTRS = ['speed', 'accel', 'agility', 'strength', 'jumping'];

/**
 * Generate a draft class. The talent curve is steep at the top: a handful of
 * blue-chip prospects, then a long tail of players who will not make a roster.
 */
export function generateDraftClass(rng, league, size = 260) {
  const usedNames = new Set(league.allPlayers({ includeFreeAgents: true }).map((p) => p.name));
  const players = [];

  for (let i = 0; i < size; i += 1) {
    // Expected draft slot drives the talent target.
    const slot = i / size;
    const target = clamp(
      remap(slot, 0, 1, 82, 52) + rng.gauss(0, 4.5),
      40, 95,
    );
    const pos = rng.weighted(POSITION_KEYS, (k) => DRAFT_POSITION_WEIGHT[k] ?? 1);
    const age = rng.weighted([21, 22, 23, 24], [3, 5, 3, 1]);

    // Young prospects have wide ceilings, and the class is where dev tiers live.
    const dev = rng.weighted(Object.keys(DEV_TIERS), (k) => {
      const base = DEV_TIERS[k].weight;
      // The top of the class is likelier to hold real developmental talent.
      return k === 'elite' || k === 'star' ? base * remap(slot, 0, 1, 3.2, 0.25) : base;
    });

    const p = generatePlayer(rng, {
      pos, overall: target, age, exp: 0, dev,
      usedNames,
      college: rng.bool(0.32) ? rng.pick(BLUE_CHIP_COLLEGES) : rng.pick(COLLEGES),
    });
    p.draftClassRank = i + 1;
    p.combine = runCombine(rng, p);
    players.push(p);
  }

  return players;
}

// Positions are drafted roughly in proportion to how many a roster carries,
// tilted toward the premium spots teams are always hunting for.
const DRAFT_POSITION_WEIGHT = {
  QB: 2.2, RB: 3, FB: 0.4, WR: 6.5, TE: 3, OT: 4.5, OG: 3.5, C: 1.6,
  EDGE: 5.5, DT: 4.5, LB: 4.5, CB: 5.5, S: 3.5, K: 0.5, P: 0.4, LS: 0.2,
};

/** Combine testing: measured accurately, and it is all anyone knows for sure. */
export function runCombine(rng, player) {
  const out = {};
  for (const attr of COMBINE_ATTRS) out[attr] = player.rating(attr);
  // Presented the way scouts read it.
  out.fortyTime = round(remap(player.rating('speed'), 40, 99, 5.15, 4.24) + rng.gauss(0, 0.02), 2);
  out.vertical = round(remap(player.rating('jumping'), 40, 99, 26, 43) + rng.gauss(0, 0.8), 1);
  out.bench = Math.round(remap(player.rating('strength'), 40, 99, 12, 38) + rng.gauss(0, 1.5));
  out.threeCone = round(remap(player.rating('agility'), 40, 99, 7.5, 6.5) + rng.gauss(0, 0.05), 2);
  return out;
}

/**
 * A club's view of a prospect. `effort` is how much scouting has been spent on
 * him (0..1); `scoutQuality` comes from the scouting department.
 */
export function scoutProspect(rng, prospect, effort = 0, scoutQuality = 55) {
  const quality = remap(scoutQuality, 25, 95, 0.55, 1.5);
  // Noise in rating points. Even a fully scouted prospect carries some.
  const noise = clamp(13 * (1 - effort * 0.72) / quality, 1.6, 16);

  // Scouting error is correlated, not independent per trait. A scout forms a
  // view of the whole player -- he likes him or he does not -- so the errors
  // move together. Independent per-attribute noise would simply average out in
  // the overall and leave every prospect correctly graded.
  const bias = rng.gauss(0, noise * 0.78);

  const ratings = {};
  for (const attr of POSITIONS[prospect.pos].attrs) {
    if (COMBINE_ATTRS.includes(attr)) {
      ratings[attr] = prospect.rating(attr); // measured at the combine
    } else {
      ratings[attr] = Math.round(clamp(prospect.rating(attr) + bias + rng.gauss(0, noise * 0.55), 20, 99));
    }
  }

  // The ceiling and the development tier are the hardest things to see, and
  // they are the things that decide whether a pick works out.
  const potentialNoise = noise * 1.6;
  const truePotential = prospect.potentialOverall();
  const potential = Math.round(clamp(truePotential + bias * 0.8 + rng.gauss(0, potentialNoise * 0.7), 40, 99));

  const devOrder = ['slow', 'normal', 'quick', 'star', 'elite'];
  const trueIdx = devOrder.indexOf(prospect.dev);
  const seenIdx = clamp(Math.round(trueIdx + rng.gauss(0, 1.5 * (1 - effort * 0.6))), 0, devOrder.length - 1);

  const view = {
    playerId: prospect.id,
    effort: round(effort, 2),
    confidence: round(clamp(effort * 0.72 + remap(scoutQuality, 25, 95, 0.05, 0.24), 0, 0.95), 2),
    ratings,
    overall: 0,
    potential,
    dev: devOrder[seenIdx],
    grade: '',
  };

  // Overall as this club computes it from what it thinks it sees.
  let acc = 0;
  for (const [attr, w] of Object.entries(POSITIONS[prospect.pos].weights)) acc += (ratings[attr] ?? 40) * w;
  view.overall = Math.round(acc);
  view.grade = draftGrade(view.overall, view.potential);
  return view;
}

function draftGrade(overall, potential) {
  const blended = overall * 0.62 + potential * 0.38;
  if (blended >= 84) return 'Top 10 talent';
  if (blended >= 79) return 'First round';
  if (blended >= 75) return 'Second round';
  if (blended >= 71) return 'Third round';
  if (blended >= 67) return 'Day three';
  if (blended >= 62) return 'Priority free agent';
  return 'Camp body';
}

/** Build every club's board for this class. */
export function buildScoutingBoards(rng, league, draftClass, effortByTeam = {}) {
  const boards = {};
  for (const team of league.allTeams()) {
    const scouts = Array.isArray(team.staff.SCOUT) ? team.staff.SCOUT : [team.staff.SCOUT].filter(Boolean);
    const quality = scouts.length
      ? scouts.reduce((s, c) => s + c.attr('talentEval') * 0.65 + c.attr('diligence') * 0.35, 0) / scouts.length
      : 50;
    const effortMap = effortByTeam[team.id] ?? {};
    const board = {};
    for (const prospect of draftClass) {
      // Clubs scout the top of the class more thoroughly by default.
      const baseEffort = clamp(remap(prospect.draftClassRank, 1, 260, 0.55, 0.06), 0.04, 0.7);
      const effort = clamp(baseEffort + (effortMap[prospect.id] ?? 0), 0, 1);
      board[prospect.id] = scoutProspect(rng, prospect, effort, quality);
    }
    boards[team.id] = board;
  }
  return boards;
}

/** Draft order: worst record picks first, playoff finish breaks the rest. */
export function draftOrder(league, priorSeason) {
  const teams = league.allTeams().slice();
  const champion = priorSeason?.champion;
  const runnerUp = priorSeason?.runnerUp;

  const playoffDepth = (teamId) => {
    const h = league.team(teamId)?.history ?? [];
    const last = h[h.length - 1];
    if (!last) return 0;
    if (teamId === champion) return 5;
    if (teamId === runnerUp) return 4;
    return { 'lost conference championship': 3, 'lost divisional': 2, 'lost wild card': 1 }[last.result] ?? 0;
  };

  return teams
    .sort((a, b) => {
      const depth = playoffDepth(a.id) - playoffDepth(b.id);
      if (depth !== 0) return depth;
      const pct = a.winPct - b.winPct;
      if (Math.abs(pct) > 1e-9) return pct;
      // Strength of schedule breaks it: the easier schedule picks first.
      return (a.record.pa - a.record.pf) - (b.record.pa - b.record.pf);
    })
    .map((t) => t.id);
}

/** Every pick in the draft, in order, with current ownership. */
export function buildDraftBoard(league, order) {
  const picks = [];
  for (let round = 1; round <= DRAFT_ROUNDS; round += 1) {
    order.forEach((teamId, i) => {
      // A club may have traded the pick away.
      const owner = league.team(teamId)?.draftPicks
        ?.find((p) => p.year === league.year && p.round === round && p.originalTeam === teamId)
        ? teamId
        : findPickOwner(league, teamId, round) ?? teamId;
      picks.push({
        overall: (round - 1) * order.length + i + 1,
        round,
        pickInRound: i + 1,
        originalTeam: teamId,
        teamId: owner,
        playerId: null,
      });
    });
  }
  return picks;
}

function findPickOwner(league, originalTeam, round) {
  for (const team of league.allTeams()) {
    if (team.draftPicks.some((p) => p.year === league.year && p.round === round && p.originalTeam === originalTeam)) {
      return team.id;
    }
  }
  return null;
}

/**
 * How much a club wants a prospect: what it thinks he is, what it thinks he can
 * become, and how badly it needs the position.
 */
export function prospectValue(team, view, prospect, needs) {
  const need = needs.find((n) => n.pos === prospect.pos);
  const needScore = need ? clamp(need.score, 0, 8) : 0;
  // Young clubs chase upside; contenders draft for now.
  const winNow = clamp(remap(team.winPct, 0.3, 0.75, 0, 1), 0, 1);
  const talent = view.overall * (0.55 + winNow * 0.25) + view.potential * (0.45 - winNow * 0.25);
  const posValue = POSITION_DRAFT_VALUE[prospect.pos] ?? 1;
  return talent * posValue + needScore * 2.4;
}

const POSITION_DRAFT_VALUE = {
  QB: 1.16, EDGE: 1.09, OT: 1.07, WR: 1.05, CB: 1.05, DT: 1.02, TE: 0.99,
  S: 0.97, LB: 0.97, OG: 0.97, C: 0.95, RB: 0.92, FB: 0.75,
  K: 0.72, P: 0.70, LS: 0.6,
};

/**
 * Run the draft. `userPick` lets a human make his own selections.
 */
export function runDraft(rng, league, draftClass, boards, opts = {}) {
  const order = opts.order ?? draftOrder(league, opts.priorSeason);
  const picks = buildDraftBoard(league, order);
  const available = new Set(draftClass.map((p) => p.id));
  const byId = new Map(draftClass.map((p) => [p.id, p]));
  const results = [];

  for (const pick of picks) {
    const team = league.team(pick.teamId);
    if (!team) continue;

    let chosen = null;
    if (opts.userTeamId && pick.teamId === opts.userTeamId && opts.userPick) {
      const id = opts.userPick({ pick, available: Array.from(available).map((i) => byId.get(i)), board: boards[team.id] });
      if (id && available.has(id)) chosen = byId.get(id);
    }

    if (!chosen) {
      const needs = team.positionNeeds();
      const board = boards[team.id];
      const candidates = Array.from(available)
        .map((id) => byId.get(id))
        .map((p) => ({ p, v: prospectValue(team, board[p.id], p, needs) }))
        .sort(byDesc((x) => x.v));
      // Clubs do not always take the top of their own board.
      const idx = Math.min(candidates.length - 1, rng.weighted([0, 1, 2, 3], [62, 22, 11, 5]));
      chosen = candidates[idx]?.p;
    }
    if (!chosen) continue;

    available.delete(chosen.id);
    pick.playerId = chosen.id;
    chosen.draft = { year: league.year, round: pick.round, pick: pick.pickInRound, teamId: team.id };
    chosen.contract = buildRookieContract(rng, chosen, pick.round, pick.pickInRound, league.leagueYear, league.salaryCap);
    team.addPlayer(chosen);
    results.push({ pick, player: chosen, team });
  }

  // Undrafted players become free agents.
  for (const id of available) {
    const p = byId.get(id);
    league.freeAgents.push(p);
  }

  for (const team of league.allTeams()) {
    team.rebuildDepthChart();
    // Consume this year's picks.
    team.draftPicks = team.draftPicks.filter((p) => p.year !== league.year);
    // And add a set three years out.
    for (let r = 1; r <= DRAFT_ROUNDS; r += 1) {
      team.draftPicks.push({ year: league.year + 3, round: r, originalTeam: team.id });
    }
  }

  league.draftClass = [];
  return { picks: results, order };
}

/** How a class actually turned out, for the "draft grades revisited" screen. */
export function evaluateDraft(league, results) {
  return results.map(({ pick, player, team }) => ({
    round: pick.round,
    overall: pick.overall,
    team: team.abbr,
    player: player.name,
    pos: player.pos,
    trueOverall: player.overall(),
    truePotential: player.potentialOverall(),
    dev: player.dev,
  }));
}
