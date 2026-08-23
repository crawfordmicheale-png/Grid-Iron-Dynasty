// Building a league from nothing.
//
// The goal is a league that looks like a real one on day one: a handful of
// contenders, a handful of rebuilds, most clubs in the muddled middle, rosters
// with a real starter/backup/depth gradient, and thirty-two front offices all
// pressed up against the salary cap the way real ones are.

import { League, PHASES } from './league.js';
import { Team, ROSTER_LIMIT } from './team.js';
import { generatePlayer } from './playerGen.js';
import { generateStaff, generateCoach, STAFF_ROLE_KEYS } from './staff.js';
import { TEAM_DATA } from '../data/teams.js';
import { ROSTER_BLUEPRINT, POSITION_KEYS } from '../data/positions.js';
import {
  marketValue, buildContract, minSalary, capForYear, Contract, POSITION_VALUE,
} from './contract.js';
import { clamp, remap, byDesc } from '../core/util.js';

// Starter quality by position: what a league-average team's best player at the
// spot grades out to. Premium positions run hotter because the whole league is
// hunting for them.
const STARTER_BASELINE = {
  QB: 80, RB: 79, FB: 72, WR: 81, TE: 78, OT: 80, OG: 78, C: 78,
  EDGE: 81, DT: 79, LB: 79, CB: 80, S: 78, K: 80, P: 78, LS: 69,
};

// How fast quality falls off down the depth chart at each position.
const DEPTH_FALLOFF = {
  QB: [0, -13, -20], RB: [0, -6, -11], WR: [0, -4, -7, -12, -17, -21],
  TE: [0, -8, -14], OT: [0, -3, -13, -17], OG: [0, -4, -13, -17], C: [0, -14],
  EDGE: [0, -4, -10, -15, -19], DT: [0, -4, -10, -15, -19], LB: [0, -5, -11, -16, -20],
  CB: [0, -4, -8, -14, -19], S: [0, -5, -12, -17], FB: [0], K: [0], P: [0], LS: [0],
};

function slotTarget(rng, pos, slot, teamStrength) {
  const base = STARTER_BASELINE[pos] ?? 72;
  const falloff = DEPTH_FALLOFF[pos] ?? [0];
  const drop = falloff[Math.min(slot, falloff.length - 1)] ?? -22;
  // Team strength matters most at the top of the chart; everybody's fifth
  // receiver is roughly the same guy.
  const strengthWeight = remap(slot, 0, 4, 1.0, 0.35);
  let target = base + drop + teamStrength * strengthWeight + rng.gauss(0, 5.0);
  // Every roster has a couple of genuine difference-makers. Without an explicit
  // fat right tail the league flattens into a sea of 76s and nobody stands out.
  if (slot === 0 && rng.bool(0.22)) target += rng.gaussClamped(7, 4, 1, 17);
  // Soft ceiling. Without it the clamp at 99 piles players up on the boundary
  // and a 99-overall stops meaning anything. Compressing the top instead keeps
  // the 85-92 band populated and makes a true 99 close to a once-a-decade player.
  if (target > 90) target = 90 + (target - 90) * 0.5;
  // Starting quarterbacks have a floor. A 65-overall starter posts numbers no
  // professional does, and because he touches every dropback he drags the whole
  // passing offense down with him.
  if (pos === 'QB' && slot === 0) target = Math.max(target, 73);
  return clamp(target, 42, 99);
}

function slotAge(rng, pos, slot, slots) {
  // Starters are in their prime; the bottom of the roster is young and cheap.
  const depth = slots > 1 ? slot / (slots - 1) : 0;
  const center = 28.4 - depth * 3.6 - (pos === 'RB' ? 1.2 : 0);
  return Math.round(clamp(rng.gauss(center, 2.9), 21, 38));
}

/**
 * Give a team a full 53-man roster.
 * @param {RNG} rng
 * @param {Team} team
 * @param {number} teamStrength roughly -8 (rebuilding) .. +8 (loaded)
 */
export function generateRoster(rng, team, teamStrength, usedNames) {
  const takenNumbers = new Set();
  for (const [pos, count] of Object.entries(ROSTER_BLUEPRINT)) {
    for (let slot = 0; slot < count; slot += 1) {
      const overall = slotTarget(rng, pos, slot, teamStrength);
      const age = slotAge(rng, pos, slot, count);
      const p = generatePlayer(rng, {
        pos, overall, age,
        exp: Math.max(0, age - 22 - (rng.bool(0.25) ? 1 : 0)),
        teamId: team.id,
        usedNames, takenNumbers,
      });
      team.addPlayer(p);
    }
  }
  team.rebuildDepthChart();
  return team;
}

/**
 * Put every player on a contract.
 *
 * A roster's worth of market-value deals adds up to well over the cap, which is
 * exactly why real clubs cannot pay everyone. So we price the roster, work out
 * what the club can actually afford, and scale the deals to fit -- the surplus
 * shows up as players on rookie contracts and team-friendly extensions, which
 * is where real cap space comes from too.
 */
export function assignContracts(rng, team, leagueYear, cap) {
  const sorted = team.roster.slice().sort(byDesc((p) => marketValue(p, cap)));

  // First pass: what everyone is worth, and who is a minimum-salary player.
  const priced = sorted.map((player, rank) => {
    const value = marketValue(player, cap);
    const isDepth = rank >= 30 || value < minSalary(player.exp) * 1.6;
    return { player, value, isDepth };
  });

  const marketTotal = priced.reduce(
    (s, e) => s + (e.isDepth ? minSalary(e.player.exp) * 1.15 : e.value), 0,
  );
  // Target payroll: most clubs sit just under the cap, a rebuilding one well below.
  const targetPayroll = cap * rng.float(0.80, 0.97);
  const scale = clamp(targetPayroll / Math.max(1, marketTotal), 0.35, 1.0);

  for (const { player, value, isDepth } of priced) {
    if (isDepth) {
      const years = rng.int(1, 3);
      const base = Math.round(minSalary(player.exp) * rng.float(1.0, 1.3));
      player.contract = new Contract({
        years,
        startYear: leagueYear - rng.int(0, Math.max(0, years - 1)),
        signingBonus: rng.bool(0.4) ? Math.round(base * 0.25) : 0,
        baseSalaries: new Array(years).fill(base),
        rosterBonuses: new Array(years).fill(0),
        guaranteed: 0, guaranteedYears: 0,
      });
      continue;
    }
    const years = clamp(Math.round(rng.gauss(value > 18_000_000 ? 4.6 : 3.4, 1.1)), 1, 6);
    const elapsed = rng.int(0, Math.max(0, years - 1));
    const apy = Math.max(
      minSalary(player.exp),
      Math.round(value * scale * rng.float(0.88, 1.10)),
    );
    player.contract = buildContract(rng, player, apy, years, leagueYear - elapsed);
  }

  enforceCap(rng, team, leagueYear, cap);
}

// Safety net. Restructure what can be restructured, then renegotiate the top of
// the payroll downward until the club is legal.
function enforceCap(rng, team, leagueYear, cap) {
  let guard = 0;
  while (team.capHitTotal(leagueYear) > cap && guard < 120) {
    guard += 1;
    const overBy = team.capHitTotal(leagueYear) - cap;
    const restructurable = team.roster
      .filter((p) => p.contract?.restructureRoom(leagueYear) > 500_000)
      .sort(byDesc((p) => p.contract.restructureRoom(leagueYear)));
    if (!restructurable.length) break;
    const p = restructurable[0];
    const c = p.contract;
    const i = c.yearIndex(leagueYear);
    const convert = Math.min(c.restructureRoom(leagueYear), overBy * 1.15);
    c.baseSalaries[i] = Math.max(minSalary(p.exp), c.baseSalaries[i] - convert);
    c.signingBonus += convert;
  }
  haircut(team, leagueYear, cap);
  team.rebuildDepthChart();
}

// Proportionally renegotiate every non-minimum deal down until the club fits.
// Signing-bonus proration is reduced too, since it is the one piece a haircut
// on base salary alone can never reach.
function haircut(team, leagueYear, cap) {
  for (let pass = 0; pass < 40; pass += 1) {
    const over = team.capHitTotal(leagueYear) - cap;
    if (over <= 0) return;

    const payers = team.roster.filter((p) => {
      const c = p.contract;
      if (!c) return false;
      const i = c.yearIndex(leagueYear);
      if (i < 0 || i >= c.years) return false;
      return (c.baseSalaries[i] ?? 0) > minSalary(p.exp) * 1.15 || c.signingBonus > 0;
    });
    if (!payers.length) return;

    // Reducible cap dollars this year: excess base salary plus this year's proration.
    let pool = 0;
    for (const p of payers) {
      const c = p.contract;
      const i = c.yearIndex(leagueYear);
      pool += Math.max(0, (c.baseSalaries[i] ?? 0) - minSalary(p.exp));
      pool += i < c.prorationYears ? c.annualProration : 0;
    }
    if (pool <= 1000) return;

    const ratio = clamp((over * 1.06) / pool, 0, 1);
    for (const p of payers) {
      const c = p.contract;
      const i = c.yearIndex(leagueYear);
      const floor = minSalary(p.exp);
      const excess = Math.max(0, (c.baseSalaries[i] ?? 0) - floor);
      c.baseSalaries[i] = Math.round((c.baseSalaries[i] ?? floor) - excess * ratio);
      c.signingBonus = Math.round(c.signingBonus * (1 - ratio));
      c.guaranteed = Math.min(c.guaranteed, c.signingBonus + (c.baseSalaries[i] ?? 0));
    }
  }
}

const OWNER_GOAL_POOL = [
  { key: 'playoffs', text: 'Reach the playoffs', weight: 3 },
  { key: 'division', text: 'Win the division', weight: 2 },
  { key: 'winning', text: 'Post a winning record', weight: 3 },
  { key: 'title', text: 'Win the championship', weight: 1 },
  { key: 'develop', text: 'Develop the young core', weight: 2 },
  { key: 'cap', text: 'Get the salary cap under control', weight: 2 },
  { key: 'offense', text: 'Field a top-10 offense', weight: 2 },
  { key: 'defense', text: 'Field a top-10 defense', weight: 2 },
];

function ownerGoals(rng, teamStrength) {
  const goals = [];
  const pool = OWNER_GOAL_POOL.filter((g) => {
    if (teamStrength > 4) return g.key !== 'develop';
    if (teamStrength < -3) return !['title', 'division'].includes(g.key);
    return true;
  });
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i += 1) {
    const pick = rng.weighted(pool, (g) => g.weight);
    if (pick && !goals.find((g) => g.key === pick.key)) goals.push({ ...pick, met: false });
  }
  return goals;
}

/**
 * Generate a complete, playable league.
 * @param {object} opts { seed, startYear, userTeamId }
 */
export function generateLeague(opts = {}) {
  const league = new League({
    seed: opts.seed ?? 'gridiron',
    startYear: opts.startYear ?? 2025,
    year: opts.startYear ?? 2025,
    phase: PHASES.PRESEASON,
    userTeamId: opts.userTeamId ?? null,
  });
  const rng = league.rng;
  const usedNames = new Set();
  const cap = capForYear(0);

  // Spread the league across a talent curve: a few real contenders, a few
  // genuinely bad clubs, most of them close enough that a good week matters.
  const strengths = TEAM_DATA.map(() => rng.gauss(0, 2.9));

  TEAM_DATA.forEach((data, i) => {
    const team = new Team({ id: data.id });
    const strength = clamp(strengths[i], -9, 9);
    team.isUserTeam = data.id === league.userTeamId;

    // A well-run club has a better staff, which compounds over seasons.
    const staffQuality = clamp(58 + strength * 1.4 + rng.gauss(0, 6), 32, 92);
    team.staff = generateStaff(rng, data.id, staffQuality, usedNames);

    generateRoster(rng, team, strength, usedNames);
    assignContracts(rng, team, 0, cap);

    team.chemistry = clamp(Math.round(58 + strength * 1.1 + rng.gauss(0, 8)), 25, 95);
    team.ownerPatience = clamp(Math.round(62 - strength * 0.9 + rng.gauss(0, 10)), 20, 95);
    team.ownerGoals = ownerGoals(rng, strength);

    // Three years of draft capital.
    for (let y = 0; y < 3; y += 1) {
      for (let r = 1; r <= 7; r += 1) {
        team.draftPicks.push({ year: league.year + y, round: r, originalTeam: data.id });
      }
    }

    league.teams.set(data.id, team);
  });

  // A pool of unsigned veterans, so there is always somebody to call in week 6
  // when the starting center goes down.
  const faCount = rng.int(70, 100);
  for (let i = 0; i < faCount; i += 1) {
    const pos = rng.weighted(POSITION_KEYS, (k) => (ROSTER_BLUEPRINT[k] ?? 1));
    const p = generatePlayer(rng, {
      pos,
      overall: clamp(rng.gauss(60, 7), 40, 80),
      age: Math.round(clamp(rng.gauss(29, 4), 22, 38)),
      usedNames,
    });
    league.freeAgents.push(p);
  }

  // Unemployed coaches, for when you fire your coordinator in December.
  for (let i = 0; i < 26; i += 1) {
    league.coachPool.push(generateCoach(rng, {
      role: rng.weighted(STAFF_ROLE_KEYS, (k) => (k === 'SCOUT' ? 3 : 1)),
      overall: clamp(rng.gauss(56, 11), 28, 90),
      usedNames,
    }));
  }

  league.log('league', `${league.year} season is underway across the ${TEAM_DATA.length}-team league.`);
  return league;
}
