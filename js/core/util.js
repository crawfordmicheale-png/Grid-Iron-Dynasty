// Small shared helpers. Kept dependency-free and pure.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
export const round = (v, places = 0) => {
  const m = 10 ** places;
  return Math.round(v * m) / m;
};
export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + fn(x), 0);
export const mean = (arr, fn = (x) => x) => (arr.length ? sum(arr, fn) / arr.length : 0);

export function median(arr, fn = (x) => x) {
  if (!arr.length) return 0;
  const v = arr.map(fn).sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function stdev(arr, fn = (x) => x) {
  if (arr.length < 2) return 0;
  const m = mean(arr, fn);
  return Math.sqrt(sum(arr, (x) => (fn(x) - m) ** 2) / (arr.length - 1));
}

// Logistic curve. The workhorse for every "A vs B" contest in the simulator:
// feed it (attackerRating - defenderRating) and get a win probability.
export const logistic = (x, steepness = 1) => 1 / (1 + Math.exp(-x * steepness));

// Contest between two 0-100 ratings. `spread` is how many rating points of
// advantage it takes to move meaningfully off 50/50.
export function contest(attack, defend, spread = 14) {
  return logistic((attack - defend) / spread);
}

export const byDesc = (fn) => (a, b) => fn(b) - fn(a);
export const byAsc = (fn) => (a, b) => fn(a) - fn(b);

export function groupBy(arr, fn) {
  const out = new Map();
  for (const item of arr) {
    const k = fn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export function countBy(arr, fn) {
  const out = {};
  for (const item of arr) {
    const k = fn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// --- Football-specific formatting -------------------------------------------

// Yard line as coaches say it: own 30, opponent 45, midfield.
// `absolute` runs 0..100 from the possessing team's own goal line.
export function fieldPosName(absolute) {
  const a = Math.round(absolute);
  if (a === 50) return 'midfield';
  if (a < 50) return `own ${a}`;
  return `opp ${100 - a}`;
}

export function downName(down) {
  return ['1st', '2nd', '3rd', '4th'][down - 1] || `${down}th`;
}

export function downDistance(down, distance, absolute) {
  const goalToGo = absolute + distance >= 100;
  const dist = goalToGo ? 'goal' : Math.max(1, Math.round(distance));
  return `${downName(down)} & ${dist}`;
}

export function clockString(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function money(dollars) {
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${round(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${sign}$${round(abs / 1e6, 2)}M`;
  if (abs >= 1e3) return `${sign}$${round(abs / 1e3, 0)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function heightString(inches) {
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}

export function pct(v, places = 1) {
  return `${round(v * 100, places)}%`;
}

// Passer rating, standard NFL formula.
export function passerRating(att, cmp, yds, td, int) {
  if (!att) return 0;
  const a = clamp((cmp / att - 0.3) * 5, 0, 2.375);
  const b = clamp((yds / att - 3) * 0.25, 0, 2.375);
  const c = clamp((td / att) * 20, 0, 2.375);
  const d = clamp(2.375 - (int / att) * 25, 0, 2.375);
  return round(((a + b + c + d) / 6) * 100, 1);
}

export function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach((k) => {
    const v = obj[k];
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  });
  return Object.freeze(obj);
}

let idCounter = 0;
export function uid(prefix = 'id') {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}`;
}
export function resetUid(n = 0) {
  idCounter = n;
}
export function uidState() {
  return idCounter;
}
