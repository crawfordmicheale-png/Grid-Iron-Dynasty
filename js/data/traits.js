// Traits are the things a scouting report says that a rating cannot. Each one
// declares its effects as plain data; the systems that care read the keys they
// know about and ignore the rest.
//
// effect keys, and who reads them:
//   attr        {attr: delta}   -- flat rating shift, applied at generation
//   late        {attr: delta}   -- applied in the 4th quarter / OT of a one-score game
//   pressure    {attr: delta}   -- applied when the QB is under duress
//   weather     {attr: delta}   -- applied in rain/snow/wind
//   fumbleMult / intMult / injuryMult / penaltyMult / sackTakenMult
//   devMult                     -- offseason progression multiplier
//   moraleTeam                  -- per-week morale nudge to every teammate
//   moraleSelf                  -- per-week morale nudge to himself
//   fatigueMult                 -- how fast he tires
//   holdoutRisk / tradeRequest  -- front-office behaviour

export const TRAITS = {
  clutch: {
    key: 'clutch', name: 'Clutch', pos: 'any', weight: 6, good: true,
    desc: 'The bigger the moment, the better he plays.',
    effects: { late: { composure: 10, hands: 6, accShort: 5, accMid: 5, kickAccuracy: 7, manCover: 5, tackle: 4 } },
  },
  frontRunner: {
    key: 'frontRunner', name: 'Front Runner', pos: 'any', weight: 5, good: false,
    desc: 'Terrific with a lead. Disappears when it is tight.',
    effects: { late: { composure: -10, hands: -5, accShort: -4, accMid: -5, kickAccuracy: -8, manCover: -4 } },
  },
  ironman: {
    key: 'ironman', name: 'Ironman', pos: 'any', weight: 7, good: true,
    desc: 'Has not missed a game since high school.',
    effects: { injuryMult: 0.6, attr: { durability: 8, toughness: 6 } },
  },
  injuryProne: {
    key: 'injuryProne', name: 'Injury Prone', pos: 'any', weight: 7, good: false,
    desc: 'Something is always tight. Medical staff knows him by name.',
    effects: { injuryMult: 1.75, attr: { durability: -12 } },
  },
  highMotor: {
    key: 'highMotor', name: 'High Motor', pos: 'any', weight: 8, good: true,
    desc: 'Plays to the whistle on every snap. Never off.',
    effects: { attr: { pursuit: 7, stamina: 8 }, fatigueMult: 0.82 },
  },
  takesPlaysOff: {
    key: 'takesPlaysOff', name: 'Takes Plays Off', pos: 'any', weight: 5, good: false,
    desc: 'The talent is real. The effort is a coaching project.',
    effects: { attr: { pursuit: -10, stamina: -6 }, fatigueMult: 1.2, devMult: 0.85 },
  },
  filmJunkie: {
    key: 'filmJunkie', name: 'Film Junkie', pos: 'any', weight: 6, good: true,
    desc: 'First in the building. Knows your play before you run it.',
    effects: { attr: { playRecognition: 9, awareness: 8, workEthic: 10 }, devMult: 1.22 },
  },
  raw: {
    key: 'raw', name: 'Raw', pos: 'any', weight: 6, good: false,
    desc: 'Tools well ahead of the technique. Somebody has to coach him up.',
    effects: { attr: { awareness: -12, playRecognition: -10 }, devMult: 1.3 },
  },
  leader: {
    key: 'leader', name: 'Team Leader', pos: 'any', weight: 5, good: true,
    desc: 'Sets the standard. The room follows him.',
    effects: { moraleTeam: 0.6, attr: { composure: 7 } },
  },
  divisive: {
    key: 'divisive', name: 'Locker Room Risk', pos: 'any', weight: 4, good: false,
    desc: 'Talented, and a weekly problem. Handle carefully.',
    effects: { moraleTeam: -0.7, holdoutRisk: 1.6, tradeRequest: 1.8 },
  },
  diva: {
    key: 'diva', name: 'Diva', pos: 'WR,TE,RB,QB', weight: 5, good: false,
    desc: 'Wants the ball and wants to be paid. Will tell you so.',
    effects: { moraleSelf: -0.5, holdoutRisk: 1.9, tradeRequest: 1.5, attr: { contested: 5 } },
  },
  hotHead: {
    key: 'hotHead', name: 'Hot Head', pos: 'any', weight: 5, good: false,
    desc: 'Plays angry. Sometimes that costs fifteen yards.',
    effects: { penaltyMult: 1.8, attr: { discipline: -14, hitPower: 8, power: 5 } },
  },
  disciplined: {
    key: 'disciplined', name: 'Disciplined', pos: 'any', weight: 6, good: true,
    desc: 'Never lines up wrong, never gets caught with his hands outside.',
    effects: { penaltyMult: 0.5, attr: { discipline: 12, gapDiscipline: 6 } },
  },
  fumbler: {
    key: 'fumbler', name: 'Ball Security Issues', pos: 'RB,WR,TE,QB,FB', weight: 5, good: false,
    desc: 'Puts it on the ground in traffic. It is a real problem.',
    effects: { fumbleMult: 2.2, attr: { ballSecurity: -14 } },
  },
  ballSecure: {
    key: 'ballSecure', name: 'Ball Secure', pos: 'RB,WR,TE,QB,FB', weight: 5, good: true,
    desc: 'High and tight. He has not fumbled since college.',
    effects: { fumbleMult: 0.4, attr: { ballSecurity: 10 } },
  },
  gambler: {
    key: 'gambler', name: 'Gambler', pos: 'CB,S,LB', weight: 5, good: null,
    desc: 'Jumps routes. Takes it away, and occasionally gives up six doing it.',
    effects: { attr: { ballHawk: 12, zoneCover: -6, manCover: -4 }, bigPlayAllowed: 1.5 },
  },
  gunslingerMind: {
    key: 'gunslingerMind', name: 'Trigger Happy', pos: 'QB', weight: 5, good: null,
    desc: 'Sees a window that is not there yet and throws it anyway.',
    effects: { intMult: 1.55, attr: { decision: -10 }, aggression: 0.18 },
  },
  gameManager: {
    key: 'gameManager', name: 'Protects the Ball', pos: 'QB', weight: 5, good: null,
    desc: 'Will take the checkdown every time. You will not lose the game because of him.',
    effects: { intMult: 0.55, attr: { decision: 10 }, aggression: -0.16 },
  },
  escapeArtist: {
    key: 'escapeArtist', name: 'Escape Artist', pos: 'QB', weight: 4, good: true,
    desc: 'Sacks turn into scrambles and scrambles turn into first downs.',
    effects: { sackTakenMult: 0.62, attr: { pocketPresence: 8, scramble: 8 } },
  },
  statue: {
    key: 'statue', name: 'Statue', pos: 'QB', weight: 4, good: false,
    desc: 'Feels nothing behind him. Takes sacks that should be throwaways.',
    effects: { sackTakenMult: 1.5, attr: { pocketPresence: -12, scramble: -14, speed: -8 } },
  },
  coldWeather: {
    key: 'coldWeather', name: 'All-Weather', pos: 'any', weight: 5, good: true,
    desc: 'Wind, rain, or twelve degrees -- nothing changes.',
    effects: { weather: { hands: 8, accShort: 6, accMid: 6, accDeep: 6, kickAccuracy: 8, ballSecurity: 6 } },
  },
  domeBaby: {
    key: 'domeBaby', name: 'Fair Weather', pos: 'any', weight: 4, good: false,
    desc: 'Beautiful in a dome. Ask him to play in sleet and find out.',
    effects: { weather: { hands: -9, accShort: -7, accMid: -8, accDeep: -9, kickAccuracy: -11, ballSecurity: -7 } },
  },
  pressureProof: {
    key: 'pressureProof', name: 'Unfazed by Rush', pos: 'QB', weight: 4, good: true,
    desc: 'Delivers with a man in his face and takes the hit.',
    effects: { pressure: { accShort: 10, accMid: 10, accDeep: 8, decision: 8 } },
  },
  happyFeet: {
    key: 'happyFeet', name: 'Happy Feet', pos: 'QB', weight: 4, good: false,
    desc: 'Bails the pocket early and throws off his back foot.',
    effects: { pressure: { accShort: -12, accMid: -12, accDeep: -12, decision: -10 } },
  },
  lateBloomer: {
    key: 'lateBloomer', name: 'Late Bloomer', pos: 'any', weight: 5, good: true,
    desc: 'Year three is when it clicks. Be patient.',
    effects: { devMult: 1.15, devCurveShift: 2 },
  },
  earlyPeak: {
    key: 'earlyPeak', name: 'Early Peak', pos: 'any', weight: 5, good: false,
    desc: 'Everything he is going to be, he already is.',
    effects: { devMult: 0.82, devCurveShift: -3 },
  },
  bigGame: {
    key: 'bigGame', name: 'Big Game Player', pos: 'any', weight: 4, good: true,
    desc: 'Prime time and playoffs. He is a different player.',
    effects: { bigGame: { composure: 8, awareness: 6, hands: 5, manCover: 5, rushFinesse: 5 } },
  },
  practiceHero: {
    key: 'practiceHero', name: 'Practice Player', pos: 'any', weight: 4, good: false,
    desc: 'Looks like an All-Pro Wednesday through Friday. Sunday is another matter.',
    effects: { devMult: 1.1, gameDay: { awareness: -7, composure: -8 } },
  },
  mismatch: {
    key: 'mismatch', name: 'Matchup Nightmare', pos: 'WR,TE,RB', weight: 4, good: true,
    desc: 'Too big for a corner, too fast for a linebacker. Somebody is wrong.',
    effects: { attr: { contested: 8, yac: 6 }, mismatchBonus: 6 },
  },
  possessionHands: {
    key: 'possessionHands', name: 'Sure Hands', pos: 'WR,TE,RB,FB', weight: 5, good: true,
    desc: 'If it touches him, he catches it.',
    effects: { attr: { hands: 10, catchTraffic: 6 }, dropMult: 0.5 },
  },
  drops: {
    key: 'drops', name: 'Drop Problems', pos: 'WR,TE,RB,FB', weight: 5, good: false,
    desc: 'Body catcher. Hears footsteps over the middle.',
    effects: { attr: { hands: -11, catchTraffic: -9 }, dropMult: 2.0 },
  },
  workhorse: {
    key: 'workhorse', name: 'Workhorse', pos: 'RB,FB,OT,OG,C,DT', weight: 5, good: true,
    desc: 'Give him the ball twenty-five times and he is fresh in the fourth.',
    effects: { attr: { stamina: 12 }, fatigueMult: 0.75 },
  },
  quickTwitch: {
    key: 'quickTwitch', name: 'Explosive First Step', pos: 'EDGE,DT,LB,RB,WR', weight: 5, good: true,
    desc: 'Off the ball before anybody else moves.',
    effects: { attr: { getOff: 10, accel: 8, burst: 8 } },
  },
  technician: {
    key: 'technician', name: 'Technician', pos: 'OT,OG,C,EDGE,DT,CB', weight: 5, good: true,
    desc: 'Hands, feet, and leverage are always right. Rarely out of position.',
    effects: { attr: { handTech: 10, blockShed: 6, press: 6 }, penaltyMult: 0.7 },
  },
};

export const TRAIT_KEYS = Object.keys(TRAITS);

// Traits that cannot coexist on the same player.
export const TRAIT_CONFLICTS = [
  ['clutch', 'frontRunner'], ['ironman', 'injuryProne'], ['highMotor', 'takesPlaysOff'],
  ['filmJunkie', 'raw'], ['leader', 'divisive'], ['disciplined', 'hotHead'],
  ['fumbler', 'ballSecure'], ['gunslingerMind', 'gameManager'], ['escapeArtist', 'statue'],
  ['coldWeather', 'domeBaby'], ['pressureProof', 'happyFeet'], ['lateBloomer', 'earlyPeak'],
  ['possessionHands', 'drops'], ['bigGame', 'practiceHero'], ['leader', 'diva'],
];

export function traitAllowedAt(traitKey, position) {
  const t = TRAITS[traitKey];
  if (!t) return false;
  if (t.pos === 'any') return true;
  return t.pos.split(',').includes(position);
}

export function conflictsWith(traitKey, existing) {
  return TRAIT_CONFLICTS.some(
    ([a, b]) => (a === traitKey && existing.includes(b)) || (b === traitKey && existing.includes(a)),
  );
}

export function traitsFor(position) {
  return TRAIT_KEYS.filter((k) => traitAllowedAt(k, position));
}
