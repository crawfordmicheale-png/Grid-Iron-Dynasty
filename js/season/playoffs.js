// The postseason: seven clubs per conference, the top seed on a bye, reseeding
// after every round, and a championship at a neutral site.

import { CONFERENCES, CHAMPIONSHIP_NAME } from '../data/teams.js';
import { playoffField } from './standings.js';

export const ROUNDS = {
  WILD_CARD: { key: 'WILD_CARD', name: 'Wild Card', order: 0 },
  DIVISIONAL: { key: 'DIVISIONAL', name: 'Divisional', order: 1 },
  CONFERENCE: { key: 'CONFERENCE', name: 'Conference Championship', order: 2 },
  FINAL: { key: 'FINAL', name: CHAMPIONSHIP_NAME, order: 3 },
};

export function createBracket(league, games, rng) {
  const field = playoffField(league, games, rng, 7);
  const bracket = {
    year: league.year,
    field,
    rounds: {},
    currentRound: 'WILD_CARD',
    champion: null,
    complete: false,
  };

  // Wild card weekend: the top seed rests.
  const wildCard = [];
  for (const conf of Object.keys(CONFERENCES)) {
    const seeds = field[conf];
    for (const [hi, lo] of [[2, 7], [3, 6], [4, 5]]) {
      wildCard.push({
        conf,
        round: 'WILD_CARD',
        homeSeed: hi,
        awaySeed: lo,
        home: seeds[hi - 1].teamId,
        away: seeds[lo - 1].teamId,
        played: false,
        result: null,
      });
    }
  }
  bracket.rounds.WILD_CARD = wildCard;
  return bracket;
}

function seedOf(bracket, conf, teamId) {
  return bracket.field[conf].find((s) => s.teamId === teamId)?.seed ?? 99;
}

/**
 * Build the next round from the survivors. The bracket reseeds: the highest
 * remaining seed always hosts the lowest.
 */
export function advanceBracket(bracket) {
  const current = bracket.currentRound;
  const games = bracket.rounds[current] ?? [];
  if (games.some((g) => !g.played)) return { ready: false };

  // The championship is not tied to a conference, so it resolves on its own.
  if (current === 'FINAL') {
    const finalGame = games[0];
    bracket.champion = finalGame.result.homeScore > finalGame.result.awayScore
      ? finalGame.home : finalGame.away;
    bracket.runnerUp = bracket.champion === finalGame.home ? finalGame.away : finalGame.home;
    bracket.complete = true;
    bracket.currentRound = null;
    return { ready: true, round: null, champion: bracket.champion };
  }

  const winners = {};
  for (const conf of Object.keys(CONFERENCES)) winners[conf] = [];
  for (const g of games) {
    const winnerId = g.result.homeScore > g.result.awayScore ? g.home : g.away;
    winners[g.conf].push(winnerId);
  }

  if (current === 'WILD_CARD') {
    const divisional = [];
    for (const conf of Object.keys(CONFERENCES)) {
      const topSeed = bracket.field[conf][0].teamId;
      const survivors = winners[conf]
        .slice()
        .sort((a, b) => seedOf(bracket, conf, a) - seedOf(bracket, conf, b));
      // Top seed plays the lowest remaining seed; the other two meet.
      const lowest = survivors[survivors.length - 1];
      const middle = survivors.slice(0, survivors.length - 1);
      divisional.push({
        conf, round: 'DIVISIONAL',
        homeSeed: 1, awaySeed: seedOf(bracket, conf, lowest),
        home: topSeed, away: lowest, played: false, result: null,
      });
      divisional.push({
        conf, round: 'DIVISIONAL',
        homeSeed: seedOf(bracket, conf, middle[0]), awaySeed: seedOf(bracket, conf, middle[1]),
        home: middle[0], away: middle[1], played: false, result: null,
      });
    }
    bracket.rounds.DIVISIONAL = divisional;
    bracket.currentRound = 'DIVISIONAL';
    return { ready: true, round: 'DIVISIONAL' };
  }

  if (current === 'DIVISIONAL') {
    const conference = [];
    for (const conf of Object.keys(CONFERENCES)) {
      const survivors = winners[conf]
        .slice()
        .sort((a, b) => seedOf(bracket, conf, a) - seedOf(bracket, conf, b));
      conference.push({
        conf, round: 'CONFERENCE',
        homeSeed: seedOf(bracket, conf, survivors[0]), awaySeed: seedOf(bracket, conf, survivors[1]),
        home: survivors[0], away: survivors[1], played: false, result: null,
      });
    }
    bracket.rounds.CONFERENCE = conference;
    bracket.currentRound = 'CONFERENCE';
    return { ready: true, round: 'CONFERENCE' };
  }

  if (current === 'CONFERENCE') {
    const confKeys = Object.keys(CONFERENCES);
    const finalists = confKeys.map((c) => winners[c][0]);
    bracket.rounds.FINAL = [{
      conf: null, round: 'FINAL', neutralSite: true,
      homeSeed: seedOf(bracket, confKeys[0], finalists[0]),
      awaySeed: seedOf(bracket, confKeys[1], finalists[1]),
      home: finalists[0], away: finalists[1], played: false, result: null,
    }];
    bracket.currentRound = 'FINAL';
    return { ready: true, round: 'FINAL' };
  }

  return { ready: false };
}

export function bracketGames(bracket, round = bracket.currentRound) {
  return bracket.rounds[round] ?? [];
}

export function allBracketGames(bracket) {
  return Object.values(bracket.rounds).flat();
}

/** How far a club got, for the franchise history log. */
export function playoffResultFor(bracket, teamId) {
  if (!bracket) return null;
  if (bracket.champion === teamId) return 'champion';
  const games = allBracketGames(bracket).filter((g) => g.home === teamId || g.away === teamId);
  if (!games.length) return null;
  const last = games[games.length - 1];
  if (!last.played) return null;
  const won = (last.result.homeScore > last.result.awayScore ? last.home : last.away) === teamId;
  if (won && last.round === 'FINAL') return 'champion';
  const lostIn = {
    WILD_CARD: 'lost wild card',
    DIVISIONAL: 'lost divisional',
    CONFERENCE: 'lost conference championship',
    FINAL: `lost ${CHAMPIONSHIP_NAME}`,
  };
  return won ? 'advanced' : lostIn[last.round];
}
