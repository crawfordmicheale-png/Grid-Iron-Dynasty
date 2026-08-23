// Game clock. The rules that matter for simulation: what stops the clock, how
// long a play takes, and how long a team burns between snaps.

import { clamp, remap } from '../core/util.js';

export const QUARTER_SECONDS = 900;
export const PLAY_CLOCK = 40;
export const HALFTIME_QUARTER = 2;

// Seconds of live action a play consumes.
export function playDuration(rng, result) {
  switch (result.type) {
    case 'incomplete':
    case 'throwaway':
      return rng.float(3.2, 4.6);
    case 'sack':
      return rng.float(5.5, 8.0);
    case 'scramble':
      return rng.float(5.5, 9.0);
    case 'interception':
      return rng.float(6.0, 11.0);
    case 'complete': {
      const base = 3.4 + (result.airYards ?? 5) * 0.09 + (result.yac ?? 0) * 0.13;
      return clamp(base + rng.float(-0.4, 1.0), 3.5, 15);
    }
    case 'run': {
      const base = 4.0 + Math.max(0, result.yards ?? 0) * 0.13;
      return clamp(base + rng.float(-0.5, 1.0), 3.5, 15);
    }
    case 'penalty':
      return 0;
    default:
      return rng.float(4, 6);
  }
}

/**
 * Does the clock stop after this play?
 * Out of bounds stops it, but outside the final two minutes of a half it
 * restarts as soon as the ball is spotted -- which the between-play timing
 * below accounts for rather than treating it as a full stoppage.
 */
export function clockStopsAfter(result, { quarter, clock, firstDown }) {
  if (result.type === 'penalty') return true;
  if (result.touchdown || result.safety) return true;
  if (result.turnover) return true;
  if (['incomplete', 'throwaway', 'interception'].includes(result.type)) return true;
  if (result.outOfBounds) {
    const twoMinute = (quarter === 2 || quarter === 4 || quarter === 0) && clock <= 120;
    return twoMinute;
  }
  return false;
}

/**
 * Seconds burned between the end of one play and the snap of the next.
 * `tempo` runs -1 (grind it out) to +1 (no huddle).
 */
export function betweenPlays(rng, { clockRunning, tempo = 0, hurry = false, killingClock = false }) {
  if (!clockRunning) return 0;
  if (hurry) return rng.float(12, 20);
  if (killingClock) return rng.float(36, 40);
  // A huddle team snaps it with a few seconds left on a 40-second play clock;
  // a no-huddle team is going in half that.
  const base = remap(tempo, -1, 1, 44, 26);
  return clamp(base + rng.float(-5, 4), 12, 40);
}

// Did the ball carrier get out of bounds? Sideline routes and perimeter runs do
// it far more often, and a team that needs the clock stopped tries harder.
export function wentOutOfBounds(rng, result, { needClockStopped = false } = {}) {
  if (result.type === 'complete') {
    const routeType = result.routeType ?? '';
    let p = routeType === 'out' ? 0.42 : 0.12;
    if (needClockStopped) p += 0.25;
    return rng.next() < p;
  }
  if (result.type === 'run' || result.type === 'scramble') {
    let p = result.gap === 'D' ? 0.22 : 0.08;
    if (needClockStopped) p += 0.2;
    return rng.next() < p;
  }
  return false;
}

export class GameClock {
  constructor(quarterSeconds = QUARTER_SECONDS) {
    this.quarterSeconds = quarterSeconds;
    this.quarter = 1;
    this.clock = quarterSeconds;
    this.overtime = false;
  }

  get expired() {
    return this.clock <= 0;
  }

  get half() {
    return this.quarter <= 2 ? 1 : 2;
  }

  get twoMinuteWarning() {
    return (this.quarter === 2 || this.quarter === 4) && this.clock <= 120;
  }

  tick(seconds) {
    const before = this.clock;
    this.clock = Math.max(0, this.clock - seconds);
    // The two-minute warning is an automatic stoppage.
    const crossed = (this.quarter === 2 || this.quarter === 4) && before > 120 && this.clock <= 120;
    return { crossedTwoMinute: crossed, elapsed: before - this.clock };
  }

  advanceQuarter() {
    this.quarter += 1;
    this.clock = this.quarterSeconds;
    return this.quarter;
  }

  startOvertime(seconds = 600) {
    this.overtime = true;
    this.quarter = 5;
    this.clock = seconds;
  }

  toString() {
    const m = Math.floor(this.clock / 60);
    const s = Math.floor(this.clock % 60);
    return `Q${this.quarter} ${m}:${String(s).padStart(2, '0')}`;
  }
}
