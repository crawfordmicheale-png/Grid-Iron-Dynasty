// Coaches. In this game you are the head coach, which means most of the week is
// spent deciding who works for you and what they are allowed to do.
//
// A coordinator is not just a rating. He has a scheme he believes in, a
// tendency (aggression) that shows up on third down, a development number that
// decides whether your third-round pick becomes anything, and a reputation that
// decides whether another club hires him away from you in January.

import { OFFENSIVE_SCHEMES, DEFENSIVE_SCHEMES, OFF_SCHEME_KEYS, DEF_SCHEME_KEYS } from '../data/schemes.js';
import { pickName } from './playerGen.js';
import { clamp, remap, round, uid } from '../core/util.js';

export const STAFF_ROLES = {
  HC: { key: 'HC', name: 'Head Coach', unit: 'both', slots: 1,
    core: ['gameManagement', 'motivation', 'discipline', 'playCalling', 'adaptability'] },
  OC: { key: 'OC', name: 'Offensive Coordinator', unit: 'OFF', slots: 1,
    core: ['playCalling', 'adaptability', 'development'] },
  DC: { key: 'DC', name: 'Defensive Coordinator', unit: 'DEF', slots: 1,
    core: ['playCalling', 'adaptability', 'development'] },
  STC: { key: 'STC', name: 'Special Teams Coordinator', unit: 'ST', slots: 1,
    core: ['development', 'gameManagement', 'discipline'] },
  QB_COACH: { key: 'QB_COACH', name: 'Quarterbacks Coach', unit: 'OFF', slots: 1, groups: ['QB'],
    core: ['development', 'technique'] },
  RB_COACH: { key: 'RB_COACH', name: 'Running Backs Coach', unit: 'OFF', slots: 1, groups: ['BACK'],
    core: ['development', 'technique'] },
  WR_COACH: { key: 'WR_COACH', name: 'Wide Receivers Coach', unit: 'OFF', slots: 1, groups: ['WR', 'TE'],
    core: ['development', 'technique'] },
  OL_COACH: { key: 'OL_COACH', name: 'Offensive Line Coach', unit: 'OFF', slots: 1, groups: ['OL'],
    core: ['development', 'technique'] },
  DL_COACH: { key: 'DL_COACH', name: 'Defensive Line Coach', unit: 'DEF', slots: 1, groups: ['DL'],
    core: ['development', 'technique'] },
  LB_COACH: { key: 'LB_COACH', name: 'Linebackers Coach', unit: 'DEF', slots: 1, groups: ['LB'],
    core: ['development', 'technique'] },
  DB_COACH: { key: 'DB_COACH', name: 'Defensive Backs Coach', unit: 'DEF', slots: 1, groups: ['DB'],
    core: ['development', 'technique'] },
  STRENGTH: { key: 'STRENGTH', name: 'Strength & Conditioning', unit: 'both', slots: 1,
    core: ['conditioning', 'injuryPrevention'] },
  TRAINER: { key: 'TRAINER', name: 'Head Trainer', unit: 'both', slots: 1,
    core: ['recovery', 'injuryPrevention'] },
  SCOUT: { key: 'SCOUT', name: 'Scout', unit: 'both', slots: 3,
    core: ['talentEval', 'diligence'] },
};

export const STAFF_ROLE_KEYS = Object.keys(STAFF_ROLES);

// Every attribute a coach can carry. Roles only *use* some of them, but they
// all exist so a position coach can be promoted to coordinator and have a
// coordinator's numbers already on file.
export const COACH_ATTRS = [
  'playCalling',      // quality of situational play selection
  'development',      // how much his players improve
  'technique',        // in-season rating gains for his group
  'gameManagement',   // clock, timeouts, challenges, 4th down
  'motivation',       // weekly morale movement
  'discipline',       // penalty suppression
  'adaptability',     // halftime and in-game adjustments
  'talentEval',       // accuracy of scouting reports
  'diligence',        // how much scouting work gets done per week
  'conditioning',     // stamina and fatigue recovery
  'injuryPrevention', // injury rate suppression
  'recovery',         // weeks off an injury
];

export class Coach {
  constructor(data = {}) {
    this.id = data.id ?? uid('c');
    this.firstName = data.firstName ?? '';
    this.lastName = data.lastName ?? '';
    this.role = data.role ?? 'OC';
    this.age = data.age ?? 48;
    this.experience = data.experience ?? 5;
    this.teamId = data.teamId ?? null;

    this.attrs = data.attrs ?? {};
    this.offScheme = data.offScheme ?? null;
    this.defScheme = data.defScheme ?? null;
    this.aggression = data.aggression ?? 0;   // -1 conservative .. +1 aggressive
    this.tempo = data.tempo ?? 0;             // -1 grind .. +1 hurry
    this.reputation = data.reputation ?? 50;  // drives hiring interest
    this.contract = data.contract ?? null;
    this.record = data.record ?? { w: 0, l: 0, t: 0, playoffs: 0, titles: 0 };
    this.history = data.history ?? [];
    this.loyalty = data.loyalty ?? 50;        // resistance to being poached
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }

  get roleDef() {
    return STAFF_ROLES[this.role];
  }

  get roleName() {
    return this.roleDef?.name ?? this.role;
  }

  attr(key) {
    return this.attrs[key] ?? 50;
  }

  // Overall is scored only against the attributes his role actually uses, so a
  // brilliant position coach is not dragged down by a game-management rating he
  // never gets to use.
  get overall() {
    const core = this.roleDef?.core ?? COACH_ATTRS;
    return Math.round(core.reduce((s, k) => s + this.attr(k), 0) / core.length);
  }

  get scheme() {
    if (this.role === 'DC') return DEFENSIVE_SCHEMES[this.defScheme];
    if (this.role === 'OC') return OFFENSIVE_SCHEMES[this.offScheme];
    return null;
  }

  // How attractive he is as a head-coaching candidate elsewhere.
  hcCandidacy() {
    if (!['OC', 'DC', 'HC'].includes(this.role)) return 0;
    const base = this.overall * 0.55 + this.reputation * 0.45;
    const winBonus = remap(this.record.w - this.record.l, -20, 20, -8, 10);
    return clamp(Math.round(base + winBonus), 0, 99);
  }

  toJSON() {
    return {
      id: this.id, firstName: this.firstName, lastName: this.lastName, role: this.role,
      age: this.age, experience: this.experience, teamId: this.teamId, attrs: this.attrs,
      offScheme: this.offScheme, defScheme: this.defScheme, aggression: round(this.aggression, 3),
      tempo: round(this.tempo, 3), reputation: round(this.reputation, 1), contract: this.contract,
      record: this.record, history: this.history, loyalty: round(this.loyalty, 1),
    };
  }

  static fromJSON(d) {
    return new Coach(d);
  }
}

// Roles whose value is concentrated in one or two numbers get more spread on
// those numbers, so hiring decisions are real decisions.
const ROLE_PROFILE = {
  HC: { gameManagement: 8, motivation: 6, discipline: 5, playCalling: 4, adaptability: 6, talentEval: 4 },
  OC: { playCalling: 10, adaptability: 6, development: 5 },
  DC: { playCalling: 10, adaptability: 6, development: 5 },
  STC: { development: 6, gameManagement: 5, discipline: 5 },
  QB_COACH: { development: 9, technique: 8 },
  RB_COACH: { development: 8, technique: 7 },
  WR_COACH: { development: 8, technique: 7 },
  OL_COACH: { development: 9, technique: 8 },
  DL_COACH: { development: 9, technique: 8 },
  LB_COACH: { development: 8, technique: 7 },
  DB_COACH: { development: 8, technique: 7 },
  STRENGTH: { conditioning: 9, injuryPrevention: 7 },
  TRAINER: { recovery: 9, injuryPrevention: 8 },
  SCOUT: { talentEval: 10, diligence: 7 },
};

export function generateCoach(rng, opts = {}) {
  const role = opts.role ?? 'OC';
  const target = opts.overall ?? clamp(rng.gauss(62, 11), 30, 95);
  const age = opts.age ?? Math.round(clamp(rng.gauss(role === 'HC' ? 52 : 47, 8), 30, 71));

  const attrs = {};
  const profile = ROLE_PROFILE[role] ?? {};
  for (const key of COACH_ATTRS) {
    const emphasis = profile[key];
    if (emphasis) {
      attrs[key] = Math.round(clamp(rng.gauss(target, emphasis), 20, 99));
    } else {
      // Off-role attributes drift toward the middle -- a great trainer is not
      // automatically a great play caller.
      attrs[key] = Math.round(clamp(rng.gauss(target * 0.55 + 22, 12), 15, 95));
    }
  }

  // Experience tracks age but with variance -- some coaches start late.
  const experience = opts.experience ?? Math.max(0, Math.round(clamp((age - 27) * rng.float(0.55, 1.0), 0, 40)));
  attrs.gameManagement = Math.round(clamp(attrs.gameManagement + remap(experience, 0, 25, -7, 7), 15, 99));

  const coach = new Coach({
    id: opts.id ?? uid('c'),
    ...pickName(rng, opts.usedNames ?? new Set()),
    role, age, experience,
    teamId: opts.teamId ?? null,
    attrs,
    offScheme: opts.offScheme ?? (['HC', 'OC'].includes(role) ? rng.pick(OFF_SCHEME_KEYS) : null),
    defScheme: opts.defScheme ?? (['HC', 'DC'].includes(role) ? rng.pick(DEF_SCHEME_KEYS) : null),
    aggression: opts.aggression ?? round(clamp(rng.gauss(0, 0.38), -1, 1), 3),
    tempo: opts.tempo ?? round(clamp(rng.gauss(0, 0.35), -1, 1), 3),
    reputation: opts.reputation ?? Math.round(clamp(target * 0.7 + rng.gauss(15, 10), 10, 95)),
    loyalty: Math.round(clamp(rng.gauss(52, 16), 10, 95)),
  });

  // A coordinator's stated aggression should agree with the scheme he runs.
  const sch = coach.scheme;
  if (sch) coach.aggression = round(clamp(coach.aggression + (sch.aggression ?? 0) * 1.4, -1, 1), 3);
  if (sch?.tempo !== undefined) coach.tempo = round(clamp(coach.tempo + (sch.tempo - 0.45) * 0.9, -1, 1), 3);

  return coach;
}

// A full staff for one club. `quality` shifts every hire up or down together,
// so a well-run organisation is well-run top to bottom.
export function generateStaff(rng, teamId, quality = 62, usedNames = new Set()) {
  const staff = {};
  for (const roleKey of STAFF_ROLE_KEYS) {
    const def = STAFF_ROLES[roleKey];
    const made = [];
    for (let i = 0; i < def.slots; i += 1) {
      made.push(generateCoach(rng, {
        role: roleKey,
        teamId,
        overall: clamp(rng.gauss(quality, 9), 28, 96),
        usedNames,
      }));
    }
    staff[roleKey] = def.slots === 1 ? made[0] : made;
  }
  // Coordinators inherit the head coach's philosophy more often than not --
  // that is usually why he hired them.
  const hc = staff.HC;
  if (rng.bool(0.62)) staff.OC.offScheme = hc.offScheme;
  if (rng.bool(0.62)) staff.DC.defScheme = hc.defScheme;
  return staff;
}

// Convenience accessors used by the sim and progression systems.
export function positionCoachFor(staff, group) {
  for (const key of STAFF_ROLE_KEYS) {
    const def = STAFF_ROLES[key];
    if (def.groups?.includes(group)) return staff[key];
  }
  return null;
}

export function staffList(staff) {
  const out = [];
  for (const key of STAFF_ROLE_KEYS) {
    const v = staff[key];
    if (Array.isArray(v)) out.push(...v);
    else if (v) out.push(v);
  }
  return out;
}
