// Schemes. A scheme does three things: it biases play selection, it decides
// which plays a team can install, and it decides which players fit.
//
// Scheme fit is deliberately measured *relative to the player's own overall*.
// It asks "is this man's skill set shaped the way my system needs?", not "is he
// good?". So a 71-overall zone-blocking guard is a plus fit in an outside-zone
// team and a minus fit in a power team, and a 90-overall guard who cannot pull
// is still a minus fit -- he is just a very good minus fit.

import { clamp } from '../core/util.js';

export const OFFENSIVE_SCHEMES = {
  WEST_COAST: {
    key: 'WEST_COAST', name: 'West Coast', family: 'timing',
    desc: 'The pass is the run. Rhythm throws on time, receivers who win after the catch, and a quarterback who takes what is given.',
    basePassRate: 0.60, tempo: 0.5, aggression: -0.05, playActionRate: 0.22, shotgunRate: 0.55,
    personnelBias: { '11': 1.1, '12': 1.0, '21': 0.9, '10': 0.7, '22': 0.5 },
    conceptBias: { quickGame: 1.5, westCoast: 1.7, mesh: 1.3, verticals: 0.6, screen: 1.4, playAction: 1.1, deepShot: 0.6 },
    runBias: { insideZone: 1.1, outsideZone: 1.2, power: 0.8, counter: 0.9, draw: 1.2, trap: 1.0 },
    fit: {
      QB: { accShort: 3, accMid: 3, progression: 3, decision: 2, throwPower: -1, accDeep: 0.5 },
      RB: { hands: 3, routeShort: 2, passBlock: 2, vision: 1, power: -1 },
      WR: { routeShort: 3, yac: 3, hands: 3, release: 1, routeDeep: -1 },
      TE: { routeShort: 2, hands: 2, yac: 1, runBlock: 1 },
      OT: { passBlock: 3, agility: 1, runBlock: 1 }, OG: { passBlock: 2, pullBlock: 2, agility: 1 },
      C: { awareness: 3, passBlock: 2, pullBlock: 1 },
    },
  },
  AIR_RAID: {
    key: 'AIR_RAID', name: 'Air Raid', family: 'spread',
    desc: 'Four and five wide, no huddle, and a route concept for every coverage. Space is the scheme.',
    basePassRate: 0.68, tempo: 0.85, aggression: 0.12, playActionRate: 0.12, shotgunRate: 0.92,
    personnelBias: { '10': 1.8, '11': 1.3, '12': 0.4, '21': 0.2, '22': 0.1 },
    conceptBias: { quickGame: 1.4, mesh: 1.8, verticals: 1.6, westCoast: 1.0, deepShot: 1.3, screen: 1.2, playAction: 0.5 },
    runBias: { insideZone: 1.0, outsideZone: 0.9, power: 0.4, counter: 0.5, draw: 1.5, trap: 0.4 },
    fit: {
      QB: { progression: 3, accMid: 3, accShort: 2, throwPower: 1.5, pocketPresence: 1, playAction: -1 },
      WR: { routeMid: 3, routeShort: 2, release: 2, speed: 2, hands: 2 },
      RB: { hands: 3, routeShort: 2, elusiveness: 2, passBlock: 1, power: -2 },
      TE: { routeMid: 3, routeShort: 2, speed: 2, runBlock: -2, passBlock: -1 },
      OT: { passBlock: 3, anchor: 1, runBlock: -1 }, OG: { passBlock: 3, anchor: 2, runBlock: -1 },
      C: { passBlock: 2, awareness: 3, snapAccuracy: 2 },
    },
  },
  VERTICAL: {
    key: 'VERTICAL', name: 'Vertical Air', family: 'downfield',
    desc: 'Take the top off. Deep shots off play action, seven-step drops, and a line that can hold up long enough.',
    basePassRate: 0.60, tempo: 0.35, aggression: 0.22, playActionRate: 0.32, shotgunRate: 0.5,
    personnelBias: { '11': 1.3, '12': 1.0, '21': 0.8, '10': 0.8, '22': 0.4 },
    conceptBias: { verticals: 2.0, deepShot: 2.0, playAction: 1.7, quickGame: 0.5, mesh: 0.7, westCoast: 0.6, screen: 0.8 },
    runBias: { insideZone: 1.1, outsideZone: 0.9, power: 1.2, counter: 1.0, draw: 1.1, trap: 0.9 },
    fit: {
      QB: { throwPower: 3, accDeep: 3, playAction: 2, underPressure: 2, progression: -1 },
      WR: { routeDeep: 3, speed: 3, contested: 2, jumping: 2, routeShort: -1 },
      TE: { routeDeep: 2, contested: 2, runBlock: 1 },
      OT: { passBlock: 3, anchor: 3, handTech: 2 }, OG: { passBlock: 2, anchor: 3 },
      C: { passBlock: 2, anchor: 2, awareness: 2 },
      RB: { passBlock: 3, breakTackle: 1, hands: -1 },
    },
  },
  POWER_RUN: {
    key: 'POWER_RUN', name: 'Power Run', family: 'ground',
    desc: 'Extra linemen, a fullback, and the same play until you stop it. Play action is the reward.',
    basePassRate: 0.44, tempo: 0.25, aggression: -0.06, playActionRate: 0.30, shotgunRate: 0.30,
    personnelBias: { '21': 1.8, '22': 1.6, '12': 1.4, '11': 0.8, '10': 0.2 },
    conceptBias: { playAction: 1.9, deepShot: 1.0, quickGame: 0.9, westCoast: 0.9, verticals: 0.8, mesh: 0.6, screen: 0.8 },
    runBias: { power: 2.0, counter: 1.7, insideZone: 1.2, trap: 1.4, outsideZone: 0.6, draw: 0.7 },
    fit: {
      RB: { power: 3, breakTackle: 3, vision: 2, ballSecurity: 2, elusiveness: -1 },
      FB: { leadBlock: 3, strength: 2, runBlock: 2 },
      OG: { runBlock: 3, strength: 3, anchor: 2, pullBlock: 1 },
      OT: { runBlock: 3, strength: 2, anchor: 2, agility: -1 },
      C: { runBlock: 3, strength: 3, anchor: 2 },
      TE: { runBlock: 3, strength: 2, contested: 1, routeMid: -1 },
      QB: { playAction: 3, accDeep: 2, decision: 2, progression: -1 },
      WR: { contested: 2, runBlock: 2, routeDeep: 1 },
    },
  },
  ZONE_RUN: {
    key: 'ZONE_RUN', name: 'Outside Zone', family: 'ground',
    desc: 'Stretch the front sideline to sideline, let the back read the cut, and boot the quarterback off the same look.',
    basePassRate: 0.48, tempo: 0.3, aggression: 0.0, playActionRate: 0.34, shotgunRate: 0.35,
    personnelBias: { '11': 1.3, '12': 1.5, '21': 1.1, '10': 0.4, '22': 0.7 },
    conceptBias: { playAction: 1.8, westCoast: 1.2, quickGame: 1.0, deepShot: 1.1, verticals: 0.9, mesh: 0.9, screen: 1.0 },
    runBias: { outsideZone: 2.2, insideZone: 1.6, counter: 1.0, power: 0.6, trap: 0.9, draw: 0.8 },
    fit: {
      RB: { vision: 3, burst: 3, agility: 2, breakTackle: 1, power: -1 },
      OT: { pullBlock: 3, agility: 3, runBlock: 2, strength: -1 },
      OG: { pullBlock: 3, agility: 3, runBlock: 2, strength: -1 },
      C: { pullBlock: 3, agility: 2, awareness: 2 },
      TE: { runBlock: 2, pullBlock: 2, routeShort: 1 },
      QB: { playAction: 3, throwOnRun: 3, accMid: 1 },
      WR: { runBlock: 2, routeDeep: 1, yac: 1 },
    },
  },
  SPREAD_OPTION: {
    key: 'SPREAD_OPTION', name: 'Spread Option', family: 'spread',
    desc: 'The quarterback is a runner and every play has two answers. Defenses have to be right twice.',
    basePassRate: 0.52, tempo: 0.7, aggression: 0.08, playActionRate: 0.26, shotgunRate: 0.95,
    personnelBias: { '11': 1.6, '10': 1.2, '12': 0.9, '21': 0.4, '22': 0.2 },
    conceptBias: { quickGame: 1.5, mesh: 1.2, verticals: 1.2, playAction: 1.4, screen: 1.4, deepShot: 1.1, westCoast: 0.9 },
    runBias: { insideZone: 1.9, outsideZone: 1.4, power: 1.1, counter: 1.2, draw: 0.9, trap: 0.7 },
    fit: {
      QB: { scramble: 3, speed: 3, throwOnRun: 3, accShort: 2, pocketPresence: -1, progression: -1 },
      RB: { vision: 2, burst: 3, elusiveness: 2 },
      WR: { yac: 3, routeShort: 2, speed: 2, runBlock: 2 },
      OT: { pullBlock: 2, agility: 2, passBlock: 1 }, OG: { pullBlock: 2, agility: 2, runBlock: 2 },
      C: { agility: 2, snapAccuracy: 3, awareness: 2 },
      TE: { routeShort: 2, runBlock: 1, speed: 1 },
    },
  },
  PRO_STYLE: {
    key: 'PRO_STYLE', name: 'Pro Style', family: 'balanced',
    desc: 'Under center and in gun, run and pass off the same personnel. No tendency to hang your hat on, and none to give away.',
    basePassRate: 0.55, tempo: 0.45, aggression: 0.0, playActionRate: 0.24, shotgunRate: 0.5,
    personnelBias: { '11': 1.4, '12': 1.3, '21': 1.0, '10': 0.6, '22': 0.7 },
    conceptBias: { quickGame: 1.1, westCoast: 1.1, verticals: 1.1, playAction: 1.2, deepShot: 1.0, mesh: 1.0, screen: 1.0 },
    runBias: { insideZone: 1.3, outsideZone: 1.2, power: 1.2, counter: 1.1, trap: 1.0, draw: 1.0 },
    fit: {
      QB: { accMid: 2, progression: 2, awareness: 2, decision: 2 },
      RB: { vision: 2, breakTackle: 1, hands: 1, passBlock: 1 },
      WR: { routeMid: 2, hands: 2, contested: 1 },
      TE: { runBlock: 2, routeShort: 2, hands: 1 },
      OT: { passBlock: 2, runBlock: 2 }, OG: { runBlock: 2, passBlock: 2 }, C: { awareness: 2, runBlock: 1, passBlock: 1 },
    },
  },
  SMASHMOUTH: {
    key: 'SMASHMOUTH', name: 'Smashmouth', family: 'ground',
    desc: 'Win the line of scrimmage, shorten the game, and dare them to have enough possessions.',
    basePassRate: 0.40, tempo: 0.15, aggression: -0.14, playActionRate: 0.28, shotgunRate: 0.22,
    personnelBias: { '22': 2.0, '21': 1.8, '12': 1.4, '11': 0.6, '10': 0.1 },
    conceptBias: { playAction: 1.9, deepShot: 1.1, quickGame: 0.8, westCoast: 0.8, verticals: 0.7, mesh: 0.5, screen: 0.7 },
    runBias: { power: 2.1, insideZone: 1.6, trap: 1.5, counter: 1.4, outsideZone: 0.7, draw: 0.6 },
    fit: {
      RB: { power: 3, breakTackle: 3, ballSecurity: 2, stamina: 2, elusiveness: -2 },
      FB: { leadBlock: 3, strength: 3 },
      OG: { runBlock: 3, strength: 3, anchor: 2 }, OT: { runBlock: 3, strength: 3, anchor: 2 },
      C: { runBlock: 3, strength: 3 },
      TE: { runBlock: 3, strength: 3, routeMid: -2 },
      QB: { playAction: 3, decision: 3, accDeep: 1, progression: -2 },
      WR: { runBlock: 3, contested: 2 },
    },
  },
};

export const DEFENSIVE_SCHEMES = {
  FOUR_THREE: {
    key: 'FOUR_THREE', name: '4-3 Over', family: 'four-man',
    desc: 'Four rush, seven cover. Win with the front and keep it simple behind it.',
    baseBlitzRate: 0.20, baseManRate: 0.38, nickelRate: 0.55, aggression: 0.0,
    frontBias: { over: 1.8, under: 1.3, even: 1.2, bear: 0.6, okie: 0.2, nascar: 0.9 },
    coverageBias: { cover1: 1.1, cover2: 1.2, cover3: 1.3, cover4: 1.0, cover6: 0.9, cover0: 0.5, tampa2: 1.0, cover2man: 1.0 },
    fit: {
      EDGE: { rushFinesse: 3, getOff: 3, runStop: 1, speed: 2 },
      DT: { getOff: 2, rushPower: 2, blockShed: 2, runStop: 2 },
      LB: { playRecognition: 3, tackle: 2, pursuit: 2, zoneCover: 2, blockShed: 1 },
      CB: { zoneCover: 2, manCover: 2, playRecognition: 1 },
      S: { zoneCover: 2, tackle: 2, playRecognition: 2 },
    },
  },
  THREE_FOUR: {
    key: 'THREE_FOUR', name: '3-4 Two-Gap', family: 'three-man',
    desc: 'Big bodies control gaps so four linebackers can run free. Pressure comes from where you do not know.',
    baseBlitzRate: 0.30, baseManRate: 0.40, nickelRate: 0.48, aggression: 0.08,
    frontBias: { okie: 2.0, bear: 1.2, over: 0.8, under: 0.9, even: 0.6, nascar: 1.0 },
    coverageBias: { cover1: 1.4, cover3: 1.4, cover2: 0.8, cover4: 0.9, cover0: 0.9, cover6: 0.8, tampa2: 0.6, cover2man: 1.0 },
    fit: {
      DT: { strength: 3, runStop: 3, blockShed: 3, gapDiscipline: 2, rushFinesse: -1 },
      EDGE: { rushPower: 2, blockShed: 2, zoneCover: 2, runStop: 2, strength: 1 },
      LB: { blitz: 2, blockShed: 2, playRecognition: 3, tackle: 2, manCover: 1 },
      CB: { manCover: 3, press: 2 },
      S: { deepRange: 2, zoneCover: 2, runStop: 1 },
    },
  },
  TAMPA_TWO: {
    key: 'TAMPA_TWO', name: 'Tampa 2', family: 'four-man',
    desc: 'Speed everywhere, two deep halves, and a middle linebacker who runs to the deep hole. Nothing over the top, ever.',
    baseBlitzRate: 0.13, baseManRate: 0.22, nickelRate: 0.6, aggression: -0.12,
    frontBias: { even: 1.8, over: 1.3, under: 1.1, nascar: 1.1, bear: 0.4, okie: 0.2 },
    coverageBias: { tampa2: 2.4, cover2: 1.9, cover4: 1.2, cover3: 0.9, cover6: 1.0, cover1: 0.4, cover0: 0.15, cover2man: 0.8 },
    fit: {
      EDGE: { rushFinesse: 3, getOff: 3, speed: 3, pursuit: 2, rushPower: -1 },
      DT: { getOff: 3, rushFinesse: 2, pursuit: 2, strength: -1 },
      LB: { speed: 3, zoneCover: 3, pursuit: 3, playRecognition: 2, blockShed: -1 },
      CB: { zoneCover: 3, playRecognition: 2, tackle: 2, manCover: -1 },
      S: { deepRange: 3, zoneCover: 3, ballHawk: 2 },
    },
  },
  COVER_THREE_MATCH: {
    key: 'COVER_THREE_MATCH', name: 'Cover 3 Match', family: 'four-man',
    desc: 'Single high, corners bail, everyone matches routes. It looks like zone until it covers like man.',
    baseBlitzRate: 0.22, baseManRate: 0.30, nickelRate: 0.58, aggression: 0.02,
    frontBias: { over: 1.6, under: 1.4, even: 1.1, nascar: 1.0, bear: 0.7, okie: 0.5 },
    coverageBias: { cover3: 2.4, cover1: 1.3, cover4: 1.2, cover6: 1.1, cover2: 0.7, tampa2: 0.6, cover0: 0.5, cover2man: 0.8 },
    fit: {
      CB: { zoneCover: 3, manCover: 2, playRecognition: 2, press: 1 },
      S: { deepRange: 3, zoneCover: 3, playRecognition: 2, runStop: 1 },
      LB: { zoneCover: 3, playRecognition: 3, pursuit: 2 },
      EDGE: { rushFinesse: 2, rushPower: 2, runStop: 2 },
      DT: { runStop: 2, blockShed: 2, rushPower: 2 },
    },
  },
  NICKEL_BLITZ: {
    key: 'NICKEL_BLITZ', name: 'Pressure Nickel', family: 'pressure',
    desc: 'Five and six man pressures from everywhere, man coverage behind it. Get there or get beaten.',
    baseBlitzRate: 0.45, baseManRate: 0.62, nickelRate: 0.78, aggression: 0.25,
    frontBias: { nascar: 2.0, over: 1.2, under: 1.2, even: 0.9, okie: 0.8, bear: 0.6 },
    coverageBias: { cover1: 2.0, cover0: 1.8, cover2man: 1.5, cover3: 0.9, cover2: 0.5, cover4: 0.4, tampa2: 0.2, cover6: 0.4 },
    fit: {
      CB: { manCover: 3, press: 3, agility: 2, ballHawk: 1, zoneCover: -2 },
      S: { manCover: 2, blitz: 3, playRecognition: 2, tackle: 2, deepRange: -1 },
      LB: { blitz: 3, manCover: 2, getOff: 2, speed: 2 },
      EDGE: { getOff: 3, rushFinesse: 2, rushCounter: 2, rushPower: 2 },
      DT: { getOff: 3, rushPower: 3, rushFinesse: 2, runStop: -1 },
    },
  },
  BEAR_FRONT: {
    key: 'BEAR_FRONT', name: 'Bear Front', family: 'heavy',
    desc: 'Cover every interior lineman and dare them to throw it. The run game stops existing.',
    baseBlitzRate: 0.28, baseManRate: 0.45, nickelRate: 0.35, aggression: 0.06,
    frontBias: { bear: 2.4, okie: 1.2, over: 1.0, under: 1.0, even: 0.7, nascar: 0.5 },
    coverageBias: { cover1: 1.5, cover3: 1.4, cover0: 1.0, cover2: 0.8, cover4: 0.6, cover6: 0.6, tampa2: 0.3, cover2man: 1.1 },
    fit: {
      DT: { strength: 3, runStop: 3, blockShed: 3, rushPower: 2 },
      EDGE: { runStop: 3, blockShed: 2, strength: 2, rushPower: 2 },
      LB: { runStop: 3, blockShed: 2, hitPower: 2, tackle: 2, manCover: -1 },
      S: { runStop: 3, hitPower: 2, tackle: 2, manCover: 1, deepRange: -1 },
      CB: { manCover: 3, press: 2 },
    },
  },
  MULTIPLE: {
    key: 'MULTIPLE', name: 'Multiple', family: 'hybrid',
    desc: 'Different front and coverage every snap. Hard to prepare for, hard to master.',
    baseBlitzRate: 0.28, baseManRate: 0.45, nickelRate: 0.6, aggression: 0.05,
    frontBias: { over: 1.2, under: 1.2, even: 1.2, okie: 1.2, bear: 1.0, nascar: 1.2 },
    coverageBias: { cover1: 1.2, cover2: 1.2, cover3: 1.2, cover4: 1.2, cover6: 1.2, cover0: 0.8, tampa2: 1.0, cover2man: 1.2 },
    fit: {
      EDGE: { rushFinesse: 2, rushPower: 2, zoneCover: 1, runStop: 1, awareness: 2 },
      DT: { rushPower: 2, runStop: 2, blockShed: 2 },
      LB: { playRecognition: 3, zoneCover: 2, manCover: 2, blitz: 1, awareness: 2 },
      CB: { manCover: 2, zoneCover: 2, awareness: 2 },
      S: { zoneCover: 2, manCover: 2, playRecognition: 2, awareness: 2 },
    },
  },
  COVER_TWO_MAN: {
    key: 'COVER_TWO_MAN', name: 'Press Quarters', family: 'four-man',
    desc: 'Press at the line, four deep behind it. Take away the intermediate throw and make them be patient.',
    baseBlitzRate: 0.18, baseManRate: 0.48, nickelRate: 0.62, aggression: -0.04,
    frontBias: { over: 1.4, even: 1.3, under: 1.2, nascar: 1.0, okie: 0.6, bear: 0.6 },
    coverageBias: { cover4: 2.2, cover2man: 1.8, cover2: 1.4, cover6: 1.3, cover1: 1.0, cover3: 0.8, tampa2: 0.7, cover0: 0.3 },
    fit: {
      CB: { press: 3, manCover: 3, jumping: 2, playRecognition: 1 },
      S: { deepRange: 2, zoneCover: 3, ballHawk: 2, playRecognition: 2 },
      LB: { zoneCover: 2, playRecognition: 2, tackle: 2, runStop: 2 },
      EDGE: { rushFinesse: 2, rushPower: 2, getOff: 2 },
      DT: { rushPower: 2, runStop: 2, blockShed: 1 },
    },
  },
};

export const OFF_SCHEME_KEYS = Object.keys(OFFENSIVE_SCHEMES);
export const DEF_SCHEME_KEYS = Object.keys(DEFENSIVE_SCHEMES);

/**
 * Scheme fit as a rating modifier, roughly -9..+9.
 *
 * Positive weights mean "this scheme leans on this attribute". We compare the
 * player's weighted average in those attributes against his own overall, so the
 * result measures shape rather than quality.
 */
export function schemeFit(player, scheme) {
  const table = scheme?.fit?.[player.pos];
  if (!table) return 0;
  let wsum = 0;
  let acc = 0;
  for (const [attr, w] of Object.entries(table)) {
    acc += player.rating(attr) * w;
    wsum += w;
  }
  if (wsum <= 0) return 0;
  const shaped = acc / wsum;
  return clamp((shaped - player.overall()) * 0.55, -9, 9);
}

// Human-readable grade for the roster screen.
export function fitGrade(fit) {
  if (fit >= 5.5) return { label: 'Perfect Fit', tier: 'a' };
  if (fit >= 2.5) return { label: 'Good Fit', tier: 'b' };
  if (fit >= -2) return { label: 'Neutral', tier: 'c' };
  if (fit >= -5) return { label: 'Poor Fit', tier: 'd' };
  return { label: 'Wrong System', tier: 'f' };
}
