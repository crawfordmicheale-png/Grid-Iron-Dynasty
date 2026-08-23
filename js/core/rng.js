// Deterministic, seedable RNG. Every stochastic decision in the simulator draws
// from one of these so a season can be replayed bit-for-bit from its seed.

const MASK = 0xffffffff;

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed = Date.now()) {
    this.seed(seed);
  }

  seed(seed) {
    const s = typeof seed === 'string' ? hashString(seed) : Math.floor(seed) >>> 0;
    // SplitMix32 state. Small, fast, and good enough for gameplay distributions.
    this.state = (s || 0x9e3779b9) >>> 0;
    this.draws = 0;
    this.gaussSpare = null;
    return this;
  }

  // Snapshot / restore so a save file replays identically.
  save() {
    return { state: this.state, draws: this.draws };
  }

  restore(snap) {
    this.state = snap.state >>> 0;
    this.draws = snap.draws || 0;
    this.gaussSpare = null;
    return this;
  }

  // Fork a child stream. Used to keep unrelated systems from perturbing each
  // other -- injuries drawing an extra number should not shift the draft order.
  fork(label) {
    return new RNG(((this.state ^ hashString(String(label))) >>> 0) + this.draws);
  }

  next() {
    this.draws += 1;
    this.state = (this.state + 0x9e3779b9) & MASK;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }

  bool(chance = 0.5) {
    return this.next() < chance;
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  // Box-Muller with a cached spare.
  gauss(mean = 0, sd = 1) {
    if (this.gaussSpare !== null) {
      const v = this.gaussSpare;
      this.gaussSpare = null;
      return mean + v * sd;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    this.gaussSpare = v * mul;
    return mean + u * mul * sd;
  }

  // Gaussian truncated to a range, resampled rather than clamped so the tails
  // do not pile up on the boundary.
  gaussClamped(mean, sd, min, max) {
    for (let i = 0; i < 12; i += 1) {
      const v = this.gauss(mean, sd);
      if (v >= min && v <= max) return v;
    }
    return Math.max(min, Math.min(max, this.gauss(mean, sd)));
  }

  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  // weights may be an array of numbers parallel to items, or a key function.
  weighted(items, weights) {
    if (!items.length) return undefined;
    const w = typeof weights === 'function' ? items.map(weights) : weights;
    let total = 0;
    for (let i = 0; i < w.length; i += 1) total += Math.max(0, w[i]);
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= Math.max(0, w[i]);
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Sample n distinct items.
  sample(arr, n) {
    return this.shuffle(arr).slice(0, n);
  }
}

export const globalRng = new RNG(1);
