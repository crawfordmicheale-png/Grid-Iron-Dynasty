// Weather, and the situational context every rating read is filtered through.

import { clamp, remap } from '../core/util.js';

// Climate profiles: [meanTempSeptember, meanTempJanuary, windBase, precipChance]
const CLIMATE = {
  dome:      { sept: 72, jan: 72, wind: 0,  precip: 0.00, indoor: true },
  frigid:    { sept: 66, jan: 20, wind: 11, precip: 0.34 },
  cold:      { sept: 70, jan: 30, wind: 9,  precip: 0.28 },
  temperate: { sept: 74, jan: 40, wind: 8,  precip: 0.24 },
  rainy:     { sept: 66, jan: 44, wind: 7,  precip: 0.48 },
  warm:      { sept: 82, jan: 52, wind: 6,  precip: 0.20 },
  hot:       { sept: 88, jan: 68, wind: 7,  precip: 0.26 },
};

/**
 * Weather for a game. Week 1 is early September, week 18 is early January, and
 * the playoffs are colder still.
 */
export function generateWeather(rng, team, week = 1) {
  const profile = CLIMATE[team.climate] ?? CLIMATE.temperate;
  if (profile.indoor) {
    return { indoor: true, temp: 72, wind: 0, precip: 'none', severity: 0, label: 'Indoors' };
  }
  const t = clamp((week - 1) / 17, 0, 1.15);
  const temp = Math.round(remap(t, 0, 1, profile.sept, profile.jan) + rng.gauss(0, 8));
  const wind = Math.max(0, Math.round(rng.gaussClamped(profile.wind, 5, 0, 32)));

  let precip = 'none';
  const precipRoll = rng.next();
  const chance = profile.precip * (0.7 + t * 0.6);
  if (precipRoll < chance) {
    if (temp <= 32) precip = rng.bool(0.35) ? 'snow' : 'flurries';
    else precip = rng.bool(0.35) ? 'heavy rain' : 'rain';
  }

  // Severity 0..1: how much this weather actually degrades play.
  const coldPenalty = temp < 32 ? remap(temp, 32, 0, 0, 0.45) : 0;
  const windPenalty = remap(wind, 8, 30, 0, 0.5);
  const precipPenalty = { none: 0, flurries: 0.15, rain: 0.22, 'heavy rain': 0.4, snow: 0.5 }[precip] ?? 0;
  const severity = clamp(coldPenalty * 0.5 + windPenalty * 0.6 + precipPenalty, 0, 1);

  const parts = [`${temp}°F`];
  if (wind >= 10) parts.push(`${wind} mph wind`);
  if (precip !== 'none') parts.push(precip);
  return { indoor: false, temp, wind, precip, severity, label: parts.join(', ') };
}

/**
 * The situational context handed to Player.eff() and the play engines.
 *
 * `weather` here is the 0..1 severity that trait weather modifiers scale by;
 * `late` and `bigGame` switch on the trait buckets of the same name.
 */
export function buildContext({ weather, quarter = 1, clock = 900, scoreDiff = 0, playoffs = false, primetime = false } = {}) {
  const lateGame = (quarter >= 4 || quarter === 0) && clock <= 300 && Math.abs(scoreDiff) <= 8;
  return {
    weather: weather?.severity ?? 0,
    weatherDetail: weather ?? null,
    late: lateGame,
    bigGame: playoffs || primetime,
    quarter,
    clock,
    scoreDiff,
    playoffs,
  };
}

// Crowd noise: hurts the visiting offense's communication, worst in a loud
// stadium with a good team and a big moment.
export function crowdNoise(homeTeam, ctx, homeWinPct = 0.5) {
  const base = remap(homeTeam.capacity ?? 68000, 60000, 85000, 0.30, 0.70);
  const form = remap(homeWinPct, 0.2, 0.8, -0.15, 0.2);
  const stakes = ctx.late ? 0.12 : 0;
  const dome = homeTeam.climate === 'dome' ? 0.10 : 0;
  return clamp(base + form + stakes + dome, 0.15, 1.0);
}

// Altitude: Denver's thin air drains visitors faster and carries kicks further.
export function altitudeEffect(team) {
  const alt = team.altitude ?? 0;
  return {
    fatigueMult: 1 + remap(alt, 0, 5280, 0, 0.22),
    kickBonus: remap(alt, 0, 5280, 0, 4.5), // extra yards on kicks
  };
}
