// Contracts and the salary cap.
//
// Modelled on the real thing closely enough that the interesting decisions
// survive: signing bonus prorates over the life of the deal (five years max),
// cutting a player accelerates the unamortised bonus into dead money, and a
// post-June-1 designation splits that acceleration across two years.

import { clamp, remap, round } from '../core/util.js';

export const SALARY_CAP_BASE = 255_000_000;
export const CAP_GROWTH = 0.072;            // year over year
export const MAX_PRORATION_YEARS = 5;
export const PRACTICE_SQUAD_SIZE = 16;

// League minimum by accrued season.
export const MIN_SALARY = [
  795_000, 915_000, 1_010_000, 1_110_000, 1_210_000, 1_210_000,
  1_210_000, 1_285_000, 1_285_000, 1_285_000, 1_285_000,
];

export function minSalary(exp) {
  return MIN_SALARY[clamp(Math.floor(exp), 0, MIN_SALARY.length - 1)];
}

export function capForYear(yearsFromStart = 0) {
  return Math.round(SALARY_CAP_BASE * (1 + CAP_GROWTH) ** yearsFromStart);
}

export class Contract {
  constructor(data = {}) {
    this.years = data.years ?? 1;               // total length
    this.startYear = data.startYear ?? 0;       // league year the deal began
    this.signingBonus = data.signingBonus ?? 0; // paid up front, prorated
    this.baseSalaries = data.baseSalaries ?? [];// per contract year
    this.rosterBonuses = data.rosterBonuses ?? [];
    this.guaranteed = data.guaranteed ?? 0;     // total guaranteed at signing
    this.guaranteedYears = data.guaranteedYears ?? 0; // base salaries fully guaranteed
    this.rookieDeal = data.rookieDeal ?? false;
    this.fifthYearOption = data.fifthYearOption ?? false;
    this.franchiseTag = data.franchiseTag ?? false;
    this.noTrade = data.noTrade ?? false;
  }

  get prorationYears() {
    return Math.min(this.years, MAX_PRORATION_YEARS);
  }

  get annualProration() {
    return this.prorationYears > 0 ? this.signingBonus / this.prorationYears : 0;
  }

  get totalValue() {
    return this.signingBonus
      + this.baseSalaries.reduce((s, v) => s + v, 0)
      + this.rosterBonuses.reduce((s, v) => s + (v || 0), 0);
  }

  get apy() {
    return this.years > 0 ? this.totalValue / this.years : 0;
  }

  // Contract year index (0-based) for a given league year.
  yearIndex(leagueYear) {
    return leagueYear - this.startYear;
  }

  isActive(leagueYear) {
    const i = this.yearIndex(leagueYear);
    return i >= 0 && i < this.years;
  }

  capHit(leagueYear) {
    const i = this.yearIndex(leagueYear);
    if (i < 0 || i >= this.years) return 0;
    const proration = i < this.prorationYears ? this.annualProration : 0;
    return (this.baseSalaries[i] ?? 0) + (this.rosterBonuses[i] ?? 0) + proration;
  }

  // Signing bonus money not yet charged to the cap as of `leagueYear`.
  remainingProration(leagueYear) {
    const i = this.yearIndex(leagueYear);
    const left = Math.max(0, this.prorationYears - Math.max(0, i));
    return left * this.annualProration;
  }

  // Cost of releasing him. Pre-June-1 accelerates everything into this year.
  releaseCost(leagueYear, postJune1 = false) {
    const i = this.yearIndex(leagueYear);
    if (i < 0 || i >= this.years) return { thisYear: 0, nextYear: 0, savings: 0 };
    const guaranteedBase = i < this.guaranteedYears ? (this.baseSalaries[i] ?? 0) : 0;
    const remaining = this.remainingProration(leagueYear);
    let thisYear;
    let nextYear = 0;
    if (postJune1) {
      thisYear = this.annualProration + guaranteedBase;
      nextYear = Math.max(0, remaining - this.annualProration);
    } else {
      thisYear = remaining + guaranteedBase;
    }
    return {
      thisYear: Math.round(thisYear),
      nextYear: Math.round(nextYear),
      savings: Math.round(this.capHit(leagueYear) - thisYear),
    };
  }

  // Converting base salary to a signing bonus: cap relief now, more dead money later.
  restructureRoom(leagueYear) {
    const i = this.yearIndex(leagueYear);
    const yearsLeft = this.years - i;
    if (i < 0 || yearsLeft < 2) return 0;
    const base = this.baseSalaries[i] ?? 0;
    const convertible = Math.max(0, base - minSalary(0));
    const spread = Math.min(yearsLeft, MAX_PRORATION_YEARS);
    return Math.round(convertible * (1 - 1 / spread));
  }

  toJSON() {
    return { ...this };
  }

  static fromJSON(d) {
    return new Contract(d);
  }
}

// --- Valuation --------------------------------------------------------------

// What a player of this quality is worth per year, before position scarcity.
// Roughly matches the shape of the real market: the curve is steeply convex,
// because the difference between 85 and 92 costs far more than 70 to 77.
export function baseMarketAPY(overall, cap = SALARY_CAP_BASE) {
  const o = clamp(overall, 40, 99);
  // Fraction of the cap a player at this overall commands, before position
  // scarcity. Calibrated so that top-of-market at a premium position lands
  // where the real one does.
  let frac;
  if (o < 62) frac = remap(o, 40, 62, 0.0031, 0.0075);
  else if (o < 72) frac = remap(o, 62, 72, 0.0075, 0.019);
  else if (o < 80) frac = remap(o, 72, 80, 0.019, 0.040);
  else if (o < 87) frac = remap(o, 80, 87, 0.040, 0.068);
  else if (o < 93) frac = remap(o, 87, 93, 0.068, 0.092);
  else frac = remap(o, 93, 99, 0.092, 0.112);
  return frac * cap;
}

// Positional value multipliers. A 90-overall quarterback and a 90-overall
// fullback are not remotely the same asset.
export const POSITION_VALUE = {
  QB: 2.35, EDGE: 1.60, DT: 1.40, WR: 1.36, OT: 1.26, CB: 1.20, LB: 1.05,
  OG: 1.00, S: 1.00, TE: 0.98, C: 0.92, RB: 0.76, FB: 0.32,
  K: 0.39, P: 0.32, LS: 0.18,
};

// Age multiplier: teams pay for the years ahead, not the ones behind.
export function ageValueMult(age, pos) {
  const cliff = pos === 'RB' ? 26 : 29;
  if (age <= 24) return 1.06;
  if (age <= cliff) return 1.0;
  if (age <= cliff + 3) return remap(age, cliff, cliff + 3, 1.0, 0.78);
  return Math.max(0.34, remap(age, cliff + 3, cliff + 8, 0.78, 0.4));
}

export function marketValue(player, cap = SALARY_CAP_BASE, opts = {}) {
  const ovr = opts.overall ?? player.overall();
  const pot = player.potentialOverall();
  // Young players with room get paid partly on what they are about to be --
  // but only once they are good enough that somebody is bidding. Nobody pays a
  // premium for a 61-overall's ceiling; he is a camp body either way.
  const upsideEligible = player.age <= 25 && ovr >= 68;
  const upside = upsideEligible ? Math.min(9, (pot - ovr) * 0.42) : 0;
  const effective = ovr + upside;
  const base = baseMarketAPY(effective, cap);
  const posMult = POSITION_VALUE[player.pos] ?? 0.7;
  const ageMult = ageValueMult(player.age, player.pos);
  const durability = remap(player.rating('durability'), 40, 95, 0.9, 1.05);
  const traitMult = player.hasTrait('injuryProne') ? 0.86 : 1;
  const apy = base * posMult * ageMult * durability * traitMult;
  return Math.max(minSalary(player.exp), Math.round(apy));
}

// Build a realistic deal structure for a target APY and length.
export function buildContract(rng, player, apy, years, leagueYear, opts = {}) {
  const total = apy * years;
  // Bigger deals carry a bigger share as signing bonus.
  const bonusShare = clamp(remap(apy, 1_000_000, 40_000_000, 0.12, 0.46) + (rng?.gauss(0, 0.04) ?? 0), 0.05, 0.55);
  const signingBonus = Math.round(total * (years > 1 ? bonusShare : 0));
  const salaryPool = total - signingBonus;

  // Back-loaded base salaries: cheap now, painful later. That is the point.
  const weights = [];
  for (let i = 0; i < years; i += 1) weights.push(1 + i * 0.38);
  const wSum = weights.reduce((s, w) => s + w, 0);
  const baseSalaries = weights.map((w, i) => {
    const raw = (salaryPool * w) / wSum;
    return Math.max(minSalary(player.exp + i), Math.round(raw / 1000) * 1000);
  });

  const guaranteedYears = opts.guaranteedYears
    ?? clamp(Math.round(years * remap(apy, 2_000_000, 35_000_000, 0.25, 0.62)), years > 1 ? 1 : 0, years);
  const guaranteed = signingBonus + baseSalaries.slice(0, guaranteedYears).reduce((s, v) => s + v, 0);

  return new Contract({
    years, startYear: leagueYear, signingBonus, baseSalaries,
    rosterBonuses: new Array(years).fill(0),
    guaranteed, guaranteedYears,
    rookieDeal: opts.rookieDeal ?? false,
    noTrade: opts.noTrade ?? (apy > 0.09 * SALARY_CAP_BASE && (rng?.bool(0.35) ?? false)),
  });
}

// Rookie scale. Slot value falls off fast through round one and flattens after.
export function rookieScaleAPY(round_, pick, cap = SALARY_CAP_BASE) {
  const overallPick = clamp((round_ - 1) * 32 + pick, 1, 262);
  // The real slot chart follows a power law, not a straight line: the drop from
  // pick 1 to pick 10 is worth more than the drop from pick 10 to pick 32.
  // Round one is its own curve because those are five-year deals.
  const frac = overallPick <= 32
    ? 0.0330 * overallPick ** -0.2515
    : 0.0092 * (overallPick / 33) ** -0.4804;
  return Math.round(frac * cap);
}

export function buildRookieContract(rng, player, round_, pick, leagueYear, cap = SALARY_CAP_BASE) {
  const years = round_ === 1 ? 5 : 4;
  const apy = rookieScaleAPY(round_, pick, cap);
  return buildContract(rng, player, apy, years, leagueYear, {
    rookieDeal: true,
    guaranteedYears: round_ === 1 ? (pick <= 10 ? years : 3) : round_ === 2 ? 1 : 0,
  });
}

// Franchise tag: average of the top five cap hits at the position, league-wide.
export function franchiseTagValue(players, pos, leagueYear) {
  const hits = players
    .filter((p) => p.pos === pos && p.contract)
    .map((p) => p.contract.capHit(leagueYear))
    .sort((a, b) => b - a)
    .slice(0, 5);
  if (!hits.length) return 0;
  return Math.round(hits.reduce((s, v) => s + v, 0) / hits.length);
}
