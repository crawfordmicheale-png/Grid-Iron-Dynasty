// Run play resolution.
//
// A run is resolved gap by gap. The blocking scheme decides who is responsible
// for which defender, the front decides who is sitting in which gap, and each
// gap gets its own contest. The back then reads what actually happened -- with
// his vision rating deciding how well he reads it -- and takes the best crease
// he is allowed to take, which is what `cutback` governs.
//
// So a great back behind a bad line still finds yards the design did not
// create, and a zone scheme against a light box is a very different play from
// the same call against a bear front.

import { RUN_CONCEPTS, GAPS } from '../data/runConcepts.js';
import { clamp, remap, contest, round } from '../core/util.js';

export const RUN_TUNING = {
  gapYieldMin: -0.18,
  gapYieldMax: 4.55,
  visionScale: 26,
  boxAdvantageYards: 1.15,   // yards per body of numbers advantage
  secondLevelScale: 24,
  breakawayScale: 26,
  baseFumble: 0.0068,
};

// Which blockers are at each gap, before the concept's adjustments.
function blockersAtGap(offense, gap, play) {
  const { OL, slots } = offense;
  const map = {
    A: [OL.C, OL.LG, OL.RG],
    B: [OL.LG, OL.RG, OL.LT, OL.RT],
    C: [OL.LT, OL.RT, slots.TE, slots.TE2],
    D: [slots.TE, slots.TE2, slots.TE3, slots.FB],
  };
  const base = (map[gap] ?? []).filter(Boolean);
  // Pullers arrive at the point of attack; the fullback leads into it.
  if (gap === play.aimGap) {
    if (slots.FB && (play.blocking === 'man' || play.pullers > 0)) base.push(slots.FB);
    if (play.pullers > 0) base.push(OL.LG, OL.RG);
  }
  return base.filter(Boolean);
}

// Which defenders are responsible for each gap.
function defendersAtGap(defense, gap) {
  const interior = defense.dl.filter((p) => p.pos === 'DT');
  const edges = defense.dl.filter((p) => p.pos !== 'DT');
  const map = {
    A: [...interior, ...defense.lbs.slice(0, 2)],
    B: [...interior, ...edges.slice(0, 1), ...defense.lbs.slice(0, 2)],
    C: [...edges, ...defense.lbs.slice(0, 2)],
    D: [...edges, ...defense.lbs.slice(1), ...defense.safeties.slice(0, 1), ...defense.cbs.slice(0, 1)],
  };
  return (map[gap] ?? []).filter(Boolean);
}

function blockGrade(players, ctx, play) {
  if (!players.length) return 35;
  const attr = play.blocking === 'zone' ? 'runBlock' : 'runBlock';
  let acc = 0;
  let w = 0;
  players.forEach((p, i) => {
    // The first two men at the point of attack do most of the work.
    const weight = i === 0 ? 1 : i === 1 ? 0.75 : 0.4;
    let v = p.eff(attr, ctx) * 0.6 + p.eff('strength', ctx) * 0.2;
    v += play.blocking === 'zone' ? p.eff('pullBlock', ctx) * 0.2 : p.eff('leadBlock', ctx) * 0.2;
    acc += v * weight;
    w += weight;
  });
  return acc / w;
}

function defendGrade(players, ctx) {
  if (!players.length) return 30;
  let acc = 0;
  let w = 0;
  players.forEach((p, i) => {
    const weight = i === 0 ? 1 : i === 1 ? 0.7 : 0.35;
    const v = p.eff('runStop', ctx) * 0.4 + p.eff('blockShed', ctx) * 0.35
      + p.eff('gapDiscipline', ctx) * 0.15 + p.eff('strength', ctx) * 0.1;
    acc += v * weight;
    w += weight;
  });
  return acc / w;
}

/** How many defenders are committed to stopping the run. */
export function boxCount(defense, play) {
  const front = defense.front;
  let box = front.dl + defense.lbs.length;
  // Safeties creep down against heavy personnel, and blitzers count too.
  box += defense.coverage.runSupport >= 1.05 ? 1 : 0;
  box += (defense.pressure.extraRushers ?? 0) * 0.8;
  if (defense.coverage.deep === 0) box += 1;
  if (defense.coverage.deep >= 4) box -= 0.5;
  return box;
}

export function resolveRun(sim) {
  const { rng, offense, defense, play, ctx } = sim;
  const T = RUN_TUNING;
  const concept = RUN_CONCEPTS[play.concept];

  // Who is carrying it.
  const carrier = play.qbRun ? offense.QB : (offense.slots.RB ?? offense.slots.FB ?? offense.QB);
  if (!carrier) return { type: 'run', yards: 0, narrative: 'No back available.' };

  // Numbers. Blockers available against defenders in the box.
  const blockerCount = 5
    + (offense.slots.TE ? 1 : 0) + (offense.slots.TE2 ? 1 : 0) + (offense.slots.TE3 ? 1 : 0)
    + (offense.slots.FB ? 1 : 0) + (play.qbRun ? 1 : 0);
  const box = boxCount(defense, play);
  const numbers = blockerCount - box;

  // Did the defense guess right? A blitz into the play side wrecks it; a blitz
  // away from it means the back runs through where a defender used to be.
  const blitzGuess = defense.pressure.extraRushers > 0
    ? (rng.bool(0.5) ? -1 : 1) * defense.pressure.extraRushers * 0.55
    : 0;

  // Misdirection buys a beat against an aggressive, undisciplined front.
  const frontDiscipline = defense.all.reduce((s, d) => s + d.eff('gapDiscipline', ctx), 0)
    / Math.max(1, defense.all.length);
  const misdirect = (concept.misdirection ?? 0) * remap(frontDiscipline, 45, 92, 2.2, 0.4);

  // Resolve every gap so the back has real choices.
  const gapResults = {};
  for (const gap of GAPS) {
    const blockers = blockersAtGap(offense, gap, play);
    const defenders = defendersAtGap(defense, gap);
    let bg = blockGrade(blockers, ctx, play);
    let dg = defendGrade(defenders, ctx);

    // Formation strength at this gap, and the front's strength there.
    bg *= play.gapStrength?.[gap] ?? 1;
    dg *= defense.front.gapStrength[gap] ?? 1;
    // Double teams at the point of attack.
    if (gap === play.aimGap) {
      bg *= 1 + (play.doubleTeams ?? 1) * 0.045;
      bg += misdirect * 3.5;
    }
    // The concept aims somewhere; other gaps are incidental.
    const designPenalty = gap === play.aimGap ? 0 : -6.5;

    const win = contest(bg + designPenalty, dg, 15);
    let yield_ = remap(win, 0, 1, T.gapYieldMin, T.gapYieldMax);
    yield_ += numbers * T.boxAdvantageYards * (gap === play.aimGap ? 1 : 0.6);
    yield_ += blitzGuess * (gap === play.aimGap ? 1 : 0.4);
    yield_ += rng.gauss(0, 1.1);
    gapResults[gap] = { gap, yield: yield_, blockers, defenders, win };
  }

  // The back reads it. Vision decides how close he gets to the right answer,
  // and the concept decides how far he is allowed to stray from the design.
  const vision = carrier.eff('vision', ctx);
  const aim = gapResults[play.aimGap];
  const alternatives = GAPS.filter((g) => g !== play.aimGap).map((g) => gapResults[g]);
  const cutbackAllowed = play.cutback ?? 0.4;

  let chosen = aim;
  const best = alternatives.reduce((a, b) => (b.yield > a.yield ? b : a), alternatives[0]);
  if (best && best.yield > aim.yield) {
    // Does he see it, and is he allowed to take it?
    const seeIt = rng.next() < contest(vision, 62, T.visionScale);
    const allowed = rng.next() < cutbackAllowed;
    if (seeIt && allowed) chosen = best;
  } else if (rng.next() > contest(vision, 55, T.visionScale) && best) {
    // Poor vision: he bounces it when he should have stayed inside.
    if (rng.next() < 0.35) chosen = best;
  }

  // --- First level ---
  let yards = chosen.yield;

  // --- Second level: linebacker fit ---
  const secondLevel = defense.lbs.concat(defense.safeties.slice(0, 1));
  if (yards > 1 && secondLevel.length) {
    const fitter = secondLevel.reduce((a, b) => (
      b.eff('playRecognition', ctx) + b.eff('pursuit', ctx) > a.eff('playRecognition', ctx) + a.eff('pursuit', ctx) ? b : a
    ));
    const runnerSkill = carrier.eff('breakTackle', ctx) * 0.4 + carrier.eff('elusiveness', ctx) * 0.3
      + carrier.eff('power', ctx) * 0.15 + carrier.eff('burst', ctx) * 0.15;
    const tackleSkill = fitter.eff('tackle', ctx) * 0.55 + fitter.eff('pursuit', ctx) * 0.25
      + fitter.eff('playRecognition', ctx) * 0.2;
    const broke = rng.next() < contest(runnerSkill, tackleSkill, T.secondLevelScale) * 0.78;
    if (broke) {
      yards += rng.gaussClamped(4.6, 3.2, 0, 16);
      // --- Third level: now it is a footrace ---
      const lastLine = defense.safeties.concat(defense.cbs.slice(0, 2));
      const deepHelp = defense.coverage.deep;
      const chaseSkill = lastLine.length
        ? lastLine.reduce((s, d) => s + d.eff('speed', ctx) * 0.6 + d.eff('pursuit', ctx) * 0.4, 0) / lastLine.length
        : 70;
      const gone = rng.next() < contest(carrier.eff('speed', ctx), chaseSkill, T.breakawayScale)
        * remap(deepHelp, 0, 4, 0.72, 0.25);
      if (gone) yards += rng.gaussClamped(17, 11, 3, 58);
    } else {
      yards += rng.gauss(0.4, 1.1);
    }
  }

  // A back running behind his own momentum still falls forward.
  yards += remap(carrier.eff('power', ctx), 40, 95, -0.3, 0.9);
  yards = Math.round(clamp(yards, -9, 99));

  // --- Ball security ---
  const hitter = chosen.defenders[0];
  const fumbleChance = T.baseFumble
    * carrier.traitMult('fumbleMult')
    * remap(carrier.eff('ballSecurity', ctx), 40, 95, 2.1, 0.45)
    * (hitter ? remap(hitter.eff('hitPower', ctx), 45, 95, 0.75, 1.7) : 1)
    * (1 + ctx.weather * 0.7);
  const fumble = rng.next() < fumbleChance;

  const tackler = chosen.defenders[0] ?? defense.lbs[0] ?? null;
  return {
    type: 'run',
    yards,
    rusher: carrier,
    gap: chosen.gap,
    designedGap: play.aimGap,
    cutback: chosen.gap !== play.aimGap,
    boxCount: round(box, 1),
    numbers: round(numbers, 1),
    tackledBy: tackler,
    fumble,
    clockStops: false,
    isRun: true,
    narrative: buildRunNarrative(carrier, chosen, play, yards),
  };
}

function buildRunNarrative(carrier, chosen, play, yards) {
  const name = carrier.shortName;
  const cut = chosen.gap !== play.aimGap ? ' cuts it back and' : '';
  if (yards <= 0) return `${name}${cut} is stopped for ${yards === 0 ? 'no gain' : `a loss of ${-yards}`}.`;
  if (yards >= 20) return `${name}${cut} breaks through the ${chosen.gap} gap — ${yards} yards!`;
  if (yards >= 8) return `${name}${cut} finds the ${chosen.gap} gap for ${yards}.`;
  return `${name}${cut} takes it into the ${chosen.gap} gap for ${yards}.`;
}
