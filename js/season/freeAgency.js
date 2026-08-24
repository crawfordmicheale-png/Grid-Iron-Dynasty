// Free agency.
//
// Players do not simply go to the highest bidder. Money matters most, but so do
// playing time, whether the club wins, whether he fits the scheme, and how he
// feels about the place he already is. A club with cap space and a losing
// record has to overpay, which is exactly right.

import { marketValue, buildContract, minSalary } from '../model/contract.js';
import { schemeFit } from '../data/schemes.js';
import { POSITIONS, ROSTER_BLUEPRINT } from '../data/positions.js';
import { clamp, remap, byDesc, round, money } from '../core/util.js';

/** Contracts that run out this league year become free agents. */
export function expireContracts(league) {
  const newFreeAgents = [];
  const leagueYear = league.leagueYear;
  for (const team of league.allTeams()) {
    for (const player of team.roster.slice()) {
      const c = player.contract;
      if (!c || c.isActive(leagueYear + 1)) continue;
      // Remember where he was so his old club gets first crack at re-signing.
      player.__lastTeamId = team.id;
      team.removePlayer(player.id);
      player.contract = null;
      newFreeAgents.push(player);
      league.freeAgents.push(player);
    }
    team.rebuildDepthChart();
  }
  return newFreeAgents;
}

/**
 * How much a player wants to sign with a club, beyond the money.
 * Returns a multiplier applied to the offer.
 */
export function playerPreference(player, team, league, offer) {
  let appeal = 1;

  // Winning. Everybody says it matters and for most players it does.
  appeal *= remap(team.winPct, 0.2, 0.8, 0.88, 1.14);
  // A shot at playing. A veteran will not sign behind a better player.
  const ahead = team.playersAt(player.pos).filter((p) => p.overall() > player.overall()).length;
  const slots = ROSTER_BLUEPRINT[player.pos] ?? 3;
  appeal *= remap(ahead / Math.max(1, slots), 0, 1, 1.12, 0.80);
  // Scheme fit: he knows whether the system suits him.
  const scheme = POSITIONS[player.pos].unit === 'DEF' ? team.defScheme : team.offScheme;
  appeal *= remap(schemeFit(player, scheme), -9, 9, 0.90, 1.12);
  // A good head coach and a functional locker room are worth something.
  appeal *= remap(team.staff?.HC?.attr('motivation') ?? 55, 30, 95, 0.95, 1.07);
  appeal *= remap(team.chemistry, 20, 95, 0.94, 1.06);
  // Market size and warm weather have a mild pull.
  appeal *= remap(team.market, 1, 5, 0.97, 1.05);
  // Staying put is worth something to most players.
  if (player.teamId === team.id) appeal *= remap(player.morale, 20, 95, 0.92, 1.14);
  // Divas chase the money and nothing else.
  if (player.hasTrait('diva')) appeal = 1 + (appeal - 1) * 0.35;
  if (player.hasTrait('leader')) appeal *= 1.03;

  return appeal;
}

/** What a club is willing to pay, given need and cap room. */
export function teamOffer(rng, team, player, league) {
  const cap = league.salaryCap;
  const leagueYear = league.leagueYear;
  const space = team.capSpace(leagueYear + 1, leagueYear + 1);
  const value = marketValue(player, cap);

  // No room, no offer.
  if (space < minSalary(player.exp) * 1.05) return null;

  const needs = team.positionNeeds();
  const need = needs.find((n) => n.pos === player.pos);
  const needScore = need ? clamp(need.score, 0, 8) : 0;

  // Would he even start here?
  const starters = team.startersAt(player.pos);
  const wouldStart = !starters.length || player.overall() > Math.min(...starters.map((p) => p.overall()));
  if (!wouldStart && needScore < 1.2 && player.overall() < 72) return null;

  // Scheme fit changes what he is worth to this club specifically.
  const scheme = POSITIONS[player.pos].unit === 'DEF' ? team.defScheme : team.offScheme;
  const fit = schemeFit(player, scheme);

  let apy = value;
  apy *= remap(needScore, 0, 6, 0.86, 1.30);
  apy *= remap(fit, -9, 9, 0.88, 1.14);
  apy *= remap(team.staff?.HC?.attr('talentEval') ?? 55, 30, 95, 0.94, 1.08);
  // A club with room to burn bids it up.
  apy *= remap(space / cap, 0, 0.3, 0.92, 1.18);
  apy *= rng.float(0.93, 1.08);

  apy = Math.max(minSalary(player.exp), Math.round(Math.min(apy, space * 0.62)));

  // Length: clubs give long deals to young players and short ones to old.
  const years = clamp(
    Math.round(remap(player.age, 24, 34, 5, 1) + rng.gauss(0, 0.8)),
    1, 6,
  );

  return { teamId: team.id, apy, years, total: apy * years };
}

/**
 * Run free agency in waves. The best players sign first, and the market thins
 * as it goes -- which is why a club that waits gets bargains and gaps.
 */
export function runFreeAgency(rng, league, opts = {}) {
  const signings = [];
  const waves = opts.waves ?? 5;
  const leagueYear = league.leagueYear;

  for (let wave = 0; wave < waves; wave += 1) {
    // Best available first.
    const pool = league.freeAgents
      .slice()
      .sort(byDesc((p) => marketValue(p, league.salaryCap)));
    if (!pool.length) break;

    // Each wave, the top slice of the market signs.
    const slice = pool.slice(0, Math.ceil(pool.length * (wave === 0 ? 0.28 : 0.34)));

    for (const player of slice) {
      const offers = [];
      for (const team of league.allTeams()) {
        if (team.roster.length >= (opts.rosterLimit ?? 70)) continue;
        if (opts.userTeamId && team.id === opts.userTeamId && opts.skipUserTeam) continue;
        const offer = teamOffer(rng, team, player, league);
        if (!offer) continue;
        const appeal = playerPreference(player, team, league, offer);
        offers.push({ ...offer, appeal, score: offer.apy * appeal * (1 + offer.years * 0.012) });
      }
      if (!offers.length) continue;

      offers.sort(byDesc((o) => o.score));
      const best = offers[0];
      // He will not sign for a fraction of his worth just because somebody asked.
      const floor = marketValue(player, league.salaryCap) * (wave >= 3 ? 0.55 : 0.78);
      if (best.apy < floor) continue;

      const team = league.team(best.teamId);
      player.contract = buildContract(rng, player, best.apy, best.years, leagueYear + 1);
      team.addPlayer(player);
      player.morale = clamp(player.morale + 6, 10, 99);
      league.freeAgents = league.freeAgents.filter((p) => p.id !== player.id);
      signings.push({ player, team, apy: best.apy, years: best.years, offers: offers.length });
      league.recordTransaction('signing', {
        playerId: player.id, name: player.name, pos: player.pos,
        teamId: team.id, apy: best.apy, years: best.years,
      });
    }

    for (const team of league.allTeams()) team.rebuildDepthChart();
  }

  return signings;
}

/** Re-sign your own before the market opens. */
export function reSignOwnPlayers(rng, league, expiring, opts = {}) {
  const resigned = [];
  const leagueYear = league.leagueYear;

  for (const player of expiring.slice()) {
    const team = opts.teamOf?.(player) ?? league.team(player.__lastTeamId);
    if (!team) continue;
    if (opts.userTeamId && team.id === opts.userTeamId) continue;

    const offer = teamOffer(rng, team, player, league);
    if (!offer) continue;
    const appeal = playerPreference(player, team, league, offer);
    // Re-signing before market is a discount for the club and security for him.
    const wants = marketValue(player, league.salaryCap) * remap(appeal, 0.8, 1.2, 1.12, 0.90);
    if (offer.apy < wants * 0.9) continue;
    if (!rng.bool(clamp(0.35 + (offer.apy / Math.max(1, wants) - 1) * 1.5, 0.1, 0.85))) continue;

    player.contract = buildContract(rng, player, offer.apy, offer.years, leagueYear + 1);
    team.addPlayer(player);
    league.freeAgents = league.freeAgents.filter((p) => p.id !== player.id);
    resigned.push({ player, team, apy: offer.apy, years: offer.years });
    league.recordTransaction('re-sign', {
      playerId: player.id, name: player.name, pos: player.pos, teamId: team.id, apy: offer.apy,
    });
  }
  return resigned;
}

/** Release a player, taking the dead money. */
export function releasePlayer(league, team, player, postJune1 = false) {
  const leagueYear = league.leagueYear;
  const cost = player.contract?.releaseCost(leagueYear, postJune1) ?? { thisYear: 0, nextYear: 0, savings: 0 };
  team.addDeadMoney(leagueYear, cost.thisYear);
  if (cost.nextYear) team.addDeadMoney(leagueYear + 1, cost.nextYear);
  team.removePlayer(player.id);
  player.contract = null;
  league.freeAgents.push(player);
  league.recordTransaction('release', {
    playerId: player.id, name: player.name, pos: player.pos, teamId: team.id,
    deadMoney: cost.thisYear, savings: cost.savings,
  });
  return cost;
}

/**
 * Convert base salary into signing bonus to buy cap room now at the cost of
 * dead money later. Every real front office does this, and it is how a club
 * ends up in cap trouble two years after a good season.
 */
export function restructureContract(player, leagueYear, targetSaving = Infinity) {
  const c = player.contract;
  if (!c) return 0;
  if (c.restructureRoom(leagueYear, player.exp) < 500_000) return 0;
  return c.restructure(leagueYear, targetSaving, player.exp);
}

/**
 * Get a club to the roster limit and under the cap. Worst value goes first --
 * an expensive player who is not good enough is the first one cut.
 */
export function trimRoster(rng, league, team, limit = 53, capYear = null) {
  // During the offseason the cap being balanced is next season's, not the one
  // that just finished -- new contracts start then.
  const leagueYear = capYear ?? league.leagueYear;
  const released = [];
  let guard = 0;

  while ((team.roster.length > limit || team.capSpace(leagueYear, leagueYear) < 0) && guard < 90) {
    guard += 1;
    const cap = league.salaryCap;

    // Over the cap but at a legal roster size? Restructure before cutting --
    // that is the order a real front office works in.
    if (team.roster.length <= limit && team.capSpace(leagueYear, leagueYear) < 0) {
      const restructurable = team.roster
        .filter((p) => p.contract?.restructureRoom(leagueYear, p.exp) > 500_000)
        .sort(byDesc((p) => p.contract.restructureRoom(leagueYear, p.exp)));
      if (restructurable.length) {
        restructureContract(restructurable[0], leagueYear);
        continue;
      }
    }
    const candidates = team.roster
      .slice()
      .map((p) => {
        const hit = p.contract?.capHit(leagueYear) ?? 0;
        const worth = marketValue(p, cap);
        const depth = team.playersAt(p.pos).filter((o) => o.overall() > p.overall()).length;
        const needed = depth < (ROSTER_BLUEPRINT[p.pos] ?? 3);
        // Cutting a player you have no replacement for is not a saving.
        return { p, score: (hit / Math.max(1, worth)) - (needed ? 1.4 : 0) - p.overall() * 0.012 };
      })
      .sort(byDesc((x) => x.score));

    // A release that does not save money does not help; dead money can make
    // cutting a player more expensive than keeping him.
    const overCap = team.capSpace(leagueYear, leagueYear) < 0;
    const viable = overCap
      ? candidates.filter((x) => (x.p.contract?.releaseCost(leagueYear).savings ?? 0) > 0)
      : candidates;
    const victim = (viable[0] ?? (team.roster.length > limit ? candidates[0] : null))?.p;
    if (!victim) break;
    releasePlayer(league, team, victim, false);
    released.push(victim);
  }
  team.rebuildDepthChart();
  return released;
}
