// Putting eleven men on the field.
//
// Offense: the formation names the slots, and each slot is filled by the best
// available player for that particular job -- which is not simply the highest
// overall, because a slot receiver and an X receiver are different assignments.
//
// Defense: the front decides how many linemen, the offense's personnel decides
// how many defensive backs (you match three receivers with a nickel), and
// linebackers fill whatever is left.

import { FORMATIONS, formationSlots, PERSONNEL, SLOT_POSITION } from '../data/formations.js';
import { FRONTS, COVERAGES, PRESSURES } from '../data/defense.js';
import { clamp, byDesc, remap } from '../core/util.js';

// Archetypes that suit each slot. A slot receiver playing X is doing a job he
// is not built for, and the engine should know it.
const SLOT_AFFINITY = {
  X: { x: 6, shutdown: 0, z: 2, slot: -5, deep: 2, gadget: -4 },
  Z: { z: 6, x: 2, slot: 1, deep: 3, gadget: 0 },
  SLOT: { slot: 7, gadget: 4, z: 1, x: -5, deep: -3 },
  SLOT2: { slot: 6, gadget: 4, z: 1, x: -4, deep: -2 },
  SLOT3: { slot: 5, gadget: 4, z: 0, x: -4, deep: -2 },
  TE: { inline: 3, receiving: 3, move: 3, yac: 2 },
  TE2: { inline: 5, move: 2, receiving: 0, yac: 0 },
  TE3: { inline: 6, move: 1, receiving: -2, yac: -2 },
  RB: { workhorse: 4, elusive: 3, bruiser: 3, speed: 2, receiving: 2 },
  // (see ROTATION_BONUS below: backs come off the field far more than ratings alone suggest)
  FB: { lead: 4, hbrid: 3 },
};

// How much a tired player's value drops. This is what produces snap rotation:
// once a starter is worn down, a fresh backup is genuinely the better option,
// which is exactly the calculation a position coach makes on the sideline.
const FATIGUE_PENALTY = 26;

function freshness(player) {
  return remap(player.fatigue, 45, 100, -FATIGUE_PENALTY, 0);
}

// Positions that share snaps by design rather than only when worn down.
const ROTATION_BONUS = { RB: 2.4, FB: 1.6, WR: 1.25, TE: 1.2 };

function slotScore(team, player, slot) {
  const affinity = SLOT_AFFINITY[slot]?.[player.archetype] ?? 0;
  const rotation = freshness(player) * (ROTATION_BONUS[player.pos] ?? 1);
  return team.depthValue(player) + affinity + rotation;
}

/**
 * Fill an offensive formation.
 * @returns {{ QB, OL: {LT,LG,C,RG,RT}, slots: Record<string, Player>, all: Player[] }}
 */
export function offensivePersonnel(team, formationKey) {
  const formation = FORMATIONS[formationKey];
  const slots = formationSlots(formation);

  const qb = team.depthAt('QB', 0) ?? team.depthAt('QB', 0, { healthyOnly: false });

  const olPool = (pos) => (team.depthChart[pos] ?? [])
    .map((id) => team.findPlayer(id))
    .filter((p) => p?.available)
    .sort(byDesc((p) => team.depthValue(p) + freshness(p) * 0.4));
  const tackles = olPool('OT');
  const guards = olPool('OG');
  const centers = olPool('C');

  // If a club is out of bodies at a spot, slide somebody over rather than
  // fielding ten men -- exactly what happens when a line gets banged up.
  const fallback = (list, alt, i) => list[i] ?? alt[i] ?? alt[0] ?? team.depthAt('OT', 0, { healthyOnly: false });
  const ol = {
    LT: fallback(tackles, guards, 0),
    LG: fallback(guards, tackles, 0),
    C: centers[0] ?? fallback(guards, tackles, 2),
    RG: fallback(guards, tackles, 1),
    RT: fallback(tackles, guards, 1),
  };

  const used = new Set([qb?.id, ...Object.values(ol).map((p) => p?.id)]);
  const filled = {};
  // Fill the most specialised slots first so the X does not get taken by a
  // player the SLOT job needs more.
  const order = slots.slice().sort((a, b) => (SLOT_PRIORITY[a] ?? 5) - (SLOT_PRIORITY[b] ?? 5));
  for (const slot of order) {
    const pos = SLOT_POSITION[slot];
    let pool = (team.depthChart[pos] ?? [])
      .map((id) => team.findPlayer(id))
      .filter((p) => p && p.available && !used.has(p.id));
    // No fullback on the roster? A tight end or a back does the job.
    if (!pool.length && pos === 'FB') {
      pool = ['TE', 'RB'].flatMap((alt) => (team.depthChart[alt] ?? [])
        .map((id) => team.findPlayer(id)).filter((p) => p && p.available && !used.has(p.id)));
    }
    if (!pool.length && pos === 'TE') {
      pool = (team.depthChart.WR ?? []).map((id) => team.findPlayer(id))
        .filter((p) => p && p.available && !used.has(p.id));
    }
    if (!pool.length) {
      pool = (team.depthChart[pos] ?? []).map((id) => team.findPlayer(id)).filter((p) => p && !used.has(p.id));
    }
    const best = pool.sort(byDesc((p) => slotScore(team, p, slot)))[0] ?? null;
    if (best) {
      filled[slot] = best;
      used.add(best.id);
    }
  }

  const all = [qb, ...Object.values(ol), ...Object.values(filled)].filter(Boolean);
  return { QB: qb, OL: ol, slots: filled, all, formation };
}

const SLOT_PRIORITY = { RB: 0, FB: 0, TE: 1, TE2: 2, TE3: 3, X: 1, Z: 2, SLOT: 1, SLOT2: 3, SLOT3: 4 };

/**
 * Fill a defensive call. Defensive back count is matched to the offense's
 * personnel, which is the single most important pre-snap decision a defensive
 * coordinator makes.
 */
export function defensivePersonnel(team, call, offensePersonnelKey = '11') {
  const front = FRONTS[call.front];
  const coverage = COVERAGES[call.coverage];
  const offPers = PERSONNEL[offensePersonnelKey] ?? PERSONNEL['11'];

  const dlCount = front.dl;
  // Match receivers: 2 WR -> base (4 DB), 3 WR -> nickel (5), 4+ -> dime (6).
  let dbCount = offPers.wr >= 4 ? 6 : offPers.wr === 3 ? 5 : 4;
  // A four-deep shell needs the bodies for it; a heavy front cannot spare them.
  if (coverage.deep >= 4) dbCount = Math.max(dbCount, 5);
  if (front.heavy) dbCount = Math.min(dbCount, 5);
  dbCount = clamp(dbCount, 4, 6);

  let lbCount = 11 - dlCount - dbCount;
  if (lbCount < 1) {
    lbCount = 1;
    dbCount = 11 - dlCount - lbCount;
  }

  // Rotation weight by group: defensive linemen come off the field constantly,
  // defensive backs almost never.
  const ROTATION = { EDGE: 1.0, DT: 1.15, LB: 0.55, CB: 0.3, S: 0.3 };
  const take = (pos, n, used) => (team.depthChart[pos] ?? [])
    .map((id) => team.findPlayer(id))
    .filter((p) => p && p.available && !used.has(p.id))
    .sort(byDesc((p) => team.depthValue(p) + freshness(p) * (ROTATION[pos] ?? 0.5)))
    .slice(0, n);

  const used = new Set();
  // Front: edges first, then interior. A three-man front is two interior and
  // one edge; a bear front is three interior and two edges.
  const edgeWanted = dlCount >= 5 ? 2 : dlCount === 4 ? 2 : 1;
  const edges = take('EDGE', edgeWanted, used);
  edges.forEach((p) => used.add(p.id));
  const interior = take('DT', dlCount - edges.length, used);
  interior.forEach((p) => used.add(p.id));

  // Short a lineman: a linebacker with rush ability stands up on the edge.
  const dl = [...edges, ...interior];
  while (dl.length < dlCount) {
    const filler = take('LB', 1, used)[0] ?? take('EDGE', 1, used)[0] ?? take('DT', 1, used)[0];
    if (!filler) break;
    used.add(filler.id);
    dl.push(filler);
  }

  const lbs = take('LB', lbCount, used);
  lbs.forEach((p) => used.add(p.id));

  const cbWanted = Math.min(dbCount - 2, 4);
  const cbs = take('CB', cbWanted, used);
  cbs.forEach((p) => used.add(p.id));
  const safeties = take('S', dbCount - cbs.length, used);
  safeties.forEach((p) => used.add(p.id));

  const all = [...dl, ...lbs, ...cbs, ...safeties];
  // Anybody left short gets filled by the best available defender.
  while (all.length < 11) {
    const extra = ['S', 'CB', 'LB', 'EDGE', 'DT']
      .flatMap((pos) => (team.depthChart[pos] ?? []).map((id) => team.findPlayer(id)))
      .filter((p) => p && !used.has(p.id))
      .sort(byDesc((p) => team.depthValue(p)))[0];
    if (!extra) break;
    used.add(extra.id);
    all.push(extra);
  }

  return {
    dl, lbs, cbs, safeties, all,
    front, coverage, pressure: PRESSURES[call.pressure],
    dbCount, lbCount, dlCount,
    personnelName: dbCount >= 6 ? 'Dime' : dbCount === 5 ? 'Nickel' : 'Base',
  };
}

/**
 * Who is covering whom. In man, the best corner travels with the most dangerous
 * receiver. In zone, the defender responsible for that area of the field is the
 * one the route runs into.
 */
export function assignCoverage(offense, defense, rng) {
  const coverage = defense.coverage;
  const isMan = coverage.manRatio >= 0.5;
  const receivers = Object.entries(offense.slots)
    .filter(([, p]) => p)
    .map(([slot, player]) => ({ slot, player }));

  // Real defenses mostly play sides and alignments rather than sending their
  // best corner to follow the best receiver everywhere. Only a genuine shutdown
  // corner travels, and only sometimes -- which is why a good corner does not
  // hoover up every interception in the league.
  const travels = defense.cbs[0]
    && defense.cbs[0].rating('manCover') >= 85
    && rng.bool(0.35);
  const ranked = travels
    ? receivers.slice().sort(byDesc((r) => r.player.overall()))
    : rng.shuffle(receivers);

  const coverPool = [...defense.cbs, ...defense.safeties, ...defense.lbs];
  const assignments = {};
  const usedDefenders = new Set();

  for (const { slot, player } of ranked) {
    const pos = SLOT_POSITION[slot];
    let candidates = coverPool.filter((d) => !usedDefenders.has(d.id));
    if (!candidates.length) candidates = coverPool;

    // Backs and tight ends draw linebackers and safeties; receivers draw corners.
    const preference = (d) => {
      let score = isMan ? d.rating('manCover') : d.rating('zoneCover');
      if (pos === 'WR') score += d.pos === 'CB' ? 12 : d.pos === 'S' ? 2 : -14;
      else if (pos === 'TE') score += d.pos === 'S' ? 8 : d.pos === 'LB' ? 5 : -2;
      else score += d.pos === 'LB' ? 8 : d.pos === 'S' ? 3 : -4;
      // Speed matters more the further the route goes.
      score += (d.rating('speed') - 80) * 0.25;
      return score;
    };

    const defender = candidates.sort(byDesc(preference))[0];
    if (defender) {
      assignments[slot] = defender;
      if (isMan) usedDefenders.add(defender.id);
    }
  }

  // Bracket coverage. A defense that is beaten repeatedly by one man starts
  // rolling help to him: a safety over the top, a linebacker walling the
  // inside. This is the real reason a dominant receiver's target share tops out
  // instead of climbing forever -- and it is why the receiver across from him
  // gets easier looks.
  const brackets = {};
  if (ranked.length > 1) {
    const top = ranked.reduce((a, b) => (b.player.overall() > a.player.overall() ? b : a));
    const others = ranked.filter((r) => r !== top);
    const avgOthers = others.reduce((sum, r) => sum + r.player.overall(), 0) / others.length;
    const edge = top.player.overall() - avgOthers;
    if (edge > 4) {
      // More spare defenders means more help available to send.
      const spare = Math.max(0, coverage.deep + coverage.underneath - receivers.length);
      // Deliberately modest. Bracket help should shave a star's production,
      // not push him below the third receiver -- the defense is spending extra
      // bodies on him precisely because he is still the man they fear.
      const strength = clamp((edge - 4) * 0.06, 0, 0.9) * (0.55 + Math.min(spare, 3) * 0.22);
      brackets[top.slot] = strength;
      // Everyone else is a little more open for it.
      const relief = strength / Math.max(1, others.length) * 0.5;
      for (const r of others) brackets[r.slot] = -relief;
    }
  }

  // Zone defenders left over are help: they collapse on whatever is thrown near them.
  const help = coverPool.filter((d) => !Object.values(assignments).includes(d));
  return { assignments, isMan, help, brackets, deepHelp: Math.max(0, coverage.deep) };
}
