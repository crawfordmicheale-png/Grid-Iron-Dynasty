// Pass concepts.
//
// A concept is a set of routes by slot, a progression the quarterback works in
// order, a drop depth that sets the timing, and a protection call. The engine
// reads `progression` literally: the quarterback comes off receivers in this
// order at a rate set by his PRG rating, so a concept with a deep first read is
// genuinely slower to get the ball out than a quick-game concept.
//
// `requires` is derived from the routes, and the playbook assembler only pairs
// a concept with formations that actually have those slots.

const C = (key, name, cfg) => ({
  key, name,
  requires: Object.keys(cfg.routes),
  dropDepth: cfg.dropDepth ?? 5,
  protection: cfg.protection ?? 'slide',
  extraBlockers: cfg.extraBlockers ?? 0,
  playAction: cfg.playAction ?? false,
  tags: cfg.tags ?? [],
  ...cfg,
});

export const PASS_CONCEPTS = {
  // ---------------- Quick game ----------------
  slantFlat: C('slantFlat', 'Slant-Flat', {
    family: 'quickGame', dropDepth: 3, timing: 1.5, protection: 'quick',
    desc: 'The oldest answer to man coverage there is. Flat clears, slant replaces.',
    routes: { X: 'slant', SLOT: 'flat', Z: 'slant', RB: 'checkdown' },
    progression: ['SLOT', 'X', 'Z', 'RB'],
    tags: ['quick', 'manBeater', 'hot'],
  }),
  doubleSlants: C('doubleSlants', 'Double Slants', {
    family: 'quickGame', dropDepth: 3, timing: 1.4, protection: 'quick',
    desc: 'Two slants stacked. Somebody is running into space against any man call.',
    routes: { X: 'slant', SLOT: 'slant', Z: 'hitch', RB: 'checkdown' },
    progression: ['X', 'SLOT', 'Z', 'RB'],
    tags: ['quick', 'manBeater', 'hot'],
  }),
  stickConcept: C('stickConcept', 'Stick', {
    family: 'quickGame', dropDepth: 3, timing: 1.6, protection: 'quick',
    desc: 'Option route inside, flat outside. The underneath defender is wrong either way.',
    routes: { TE: 'stick', SLOT: 'flat', X: 'go', Z: 'hitch', RB: 'checkdown' },
    progression: ['TE', 'Z', 'SLOT', 'RB'],
    tags: ['quick', 'zoneBeater'],
  }),
  spotConcept: C('spotConcept', 'Spot', {
    family: 'quickGame', dropDepth: 3, timing: 1.7, protection: 'quick',
    desc: 'Triangle read: corner, spot sit-down, flat. A staple against soft zone.',
    routes: { Z: 'corner', SLOT: 'spot', TE: 'flat', X: 'go', RB: 'checkdown' },
    progression: ['SLOT', 'TE', 'Z', 'RB'],
    tags: ['quick', 'zoneBeater'],
  }),
  hitches: C('hitches', 'All Hitches', {
    family: 'quickGame', dropDepth: 3, timing: 1.6, protection: 'quick',
    desc: 'Take the cushion they are giving you. Nothing fancy, nothing risky.',
    routes: { X: 'hitch', Z: 'hook', SLOT: 'hitch', RB: 'checkdown' },
    progression: ['X', 'Z', 'SLOT', 'RB'],
    tags: ['quick', 'safe', 'zoneBeater'],
  }),

  // ---------------- West Coast ----------------
  curlFlat: C('curlFlat', 'Curl-Flat', {
    family: 'westCoast', dropDepth: 5, timing: 2.3,
    desc: 'Puts the flat defender in a bind: jump the flat and the curl is open behind him.',
    routes: { X: 'curl', SLOT: 'flat', Z: 'hook', TE: 'checkdown', RB: 'block' },
    progression: ['Z', 'SLOT', 'X', 'TE'],
    tags: ['zoneBeater', 'cover3Beater'],
  }),
  drive: C('drive', 'Drive', {
    family: 'westCoast', dropDepth: 5, timing: 2.2,
    desc: 'Shallow underneath with a dig behind it. Man coverage has to chase across the field.',
    routes: { X: 'drag', SLOT: 'dig', Z: 'comeback', TE: 'checkdown', RB: 'block' },
    progression: ['X', 'Z', 'SLOT', 'TE'],
    tags: ['manBeater', 'intermediate'],
  }),
  yOption: C('yOption', 'Y-Option', {
    family: 'westCoast', dropDepth: 5, timing: 2.1,
    desc: 'The tight end reads leverage and breaks whichever way the defender is not.',
    routes: { TE: 'stick', X: 'hook', Z: 'quickOut', SLOT: 'drag', RB: 'swing' },
    progression: ['TE', 'SLOT', 'X', 'RB'],
    tags: ['zoneBeater', 'safe'],
  }),
  texas: C('texas', 'Texas', {
    family: 'westCoast', dropDepth: 5, timing: 2.2,
    desc: 'Back on an angle route against a linebacker. A matchup you take every time.',
    routes: { RB: 'angle', X: 'go', Z: 'dig', SLOT: 'drag', TE: 'block' },
    progression: ['RB', 'SLOT', 'Z', 'X'],
    tags: ['manBeater', 'checkdown'],
  }),

  hookCurl: C('hookCurl', 'Hook-Curl', {
    family: 'westCoast', dropDepth: 5, timing: 2.1,
    desc: 'Sit down in the soft spot at nine yards. The most reliable throw in football against zone.',
    routes: { X: 'hook', Z: 'hook', SLOT: 'quickOut', TE: 'checkdown', RB: 'swing' },
    progression: ['X', 'SLOT', 'Z', 'RB'],
    tags: ['zoneBeater', 'safe'],
  }),
  quickOuts: C('quickOuts', 'Quick Outs', {
    family: 'quickGame', dropDepth: 3, timing: 1.8, protection: 'quick',
    desc: 'Get to the sideline and stop the clock. The two-minute staple.',
    routes: { X: 'quickOut', Z: 'quickOut', SLOT: 'pivot', RB: 'checkdown' },
    progression: ['X', 'Z', 'SLOT', 'RB'],
    tags: ['quick', 'sideline', 'twoMinute'],
  }),

  // ---------------- Mesh family ----------------
  mesh: C('mesh', 'Mesh', {
    family: 'mesh', dropDepth: 5, timing: 2.2,
    desc: 'Two shallow crossers rub off each other. Man coverage cannot survive the traffic.',
    routes: { X: 'drag', Z: 'drag', SLOT: 'spot', TE: 'corner', RB: 'swing' },
    progression: ['X', 'Z', 'SLOT', 'RB'],
    tags: ['manBeater', 'rub'],
  }),
  meshSit: C('meshSit', 'Mesh Sit', {
    family: 'mesh', dropDepth: 5, timing: 2.4,
    desc: 'Same rub, but the crossers sit down in the zone holes instead of running through.',
    routes: { X: 'drag', Z: 'drag', SLOT: 'hook', TE: 'seam', RB: 'checkdown' },
    progression: ['SLOT', 'X', 'Z', 'RB'],
    tags: ['zoneBeater', 'rub'],
  }),
  shallowCross: C('shallowCross', 'Shallow Cross', {
    family: 'mesh', dropDepth: 5, timing: 2.5,
    desc: 'Shallow from one side, deep cross from the other. Stresses every level in the middle.',
    routes: { X: 'drag', SLOT: 'cross', Z: 'go', TE: 'checkdown', RB: 'block' },
    progression: ['X', 'SLOT', 'Z', 'TE'],
    tags: ['manBeater', 'intermediate'],
  }),

  stickNod: C('stickNod', 'Stick-Nod', {
    family: 'westCoast', dropDepth: 5, timing: 2.2,
    desc: 'Tight end sticks at seven and nods up. The underneath defender has to honour both.',
    routes: { TE: 'stick', SLOT: 'hook', X: 'quickOut', Z: 'comeback', RB: 'checkdown' },
    progression: ['TE', 'SLOT', 'X', 'RB'],
    tags: ['zoneBeater', 'safe'],
  }),
  optionRoutes: C('optionRoutes', 'Option', {
    family: 'westCoast', dropDepth: 5, timing: 2.2,
    desc: 'Every inside receiver reads leverage and breaks away from it. Almost impossible to jump.',
    routes: { SLOT: 'pivot', TE: 'stick', X: 'hook', Z: 'hook', RB: 'swing' },
    progression: ['SLOT', 'Z', 'TE', 'RB'],
    tags: ['manBeater', 'zoneBeater', 'safe'],
  }),
  ohio: C('ohio', 'Ohio', {
    family: 'quickGame', dropDepth: 3, timing: 1.9, protection: 'quick',
    desc: 'Quick out and a pivot underneath. Gets the ball out on rhythm against pressure.',
    routes: { X: 'quickOut', SLOT: 'pivot', Z: 'slant', TE: 'stick', RB: 'checkdown' },
    progression: ['SLOT', 'Z', 'TE', 'RB'],
    tags: ['quick', 'blitzBeater', 'zoneBeater'],
  }),
  hankConcept: C('hankConcept', 'Hank', {
    family: 'westCoast', dropDepth: 5, timing: 2.2,
    desc: 'Hooks outside, back releases late underneath. The staple third-and-six answer.',
    routes: { X: 'hook', Z: 'hook', SLOT: 'quickOut', TE: 'stick', RB: 'angle' },
    progression: ['SLOT', 'Z', 'X', 'RB'],
    tags: ['zoneBeater', 'safe', 'thirdAndShort'],
  }),

  // ---------------- Vertical game ----------------
  fourVerts: C('fourVerts', 'Four Verticals', {
    family: 'verticals', dropDepth: 7, timing: 3.0,
    desc: 'Four go routes divide the field. Single-high has four to cover with three.',
    routes: { X: 'go', Z: 'go', SLOT: 'seam', SLOT2: 'seam', RB: 'checkdown' },
    progression: ['Z', 'SLOT', 'X', 'SLOT2', 'RB'],
    tags: ['deep', 'cover3Beater'],
  }),
  vertsTE: C('vertsTE', 'Verts Y-Seam', {
    family: 'verticals', dropDepth: 7, timing: 3.0,
    desc: 'Three receivers vertical with the tight end up the seam behind the linebackers.',
    routes: { X: 'go', Z: 'go', TE: 'seam', SLOT: 'seam', RB: 'block' },
    progression: ['TE', 'SLOT', 'X', 'Z'],
    tags: ['deep', 'cover3Beater'],
  }),
  dagger: C('dagger', 'Dagger', {
    family: 'verticals', dropDepth: 7, timing: 2.9,
    desc: 'Vertical clears the middle, dig comes in behind it. Punishes a two-deep shell.',
    routes: { SLOT: 'go', X: 'dig', Z: 'comeback', TE: 'checkdown', RB: 'block' },
    progression: ['X', 'Z', 'SLOT', 'TE'],
    tags: ['intermediate', 'cover2Beater'],
  }),
  yankee: C('yankee', 'Yankee', {
    family: 'verticals', dropDepth: 7, timing: 3.3, protection: 'maxProtect', extraBlockers: 1,
    desc: 'Deep cross under a post. Two routes, maximum protection, one big answer.',
    routes: { X: 'post', Z: 'cross', TE: 'block', RB: 'block' },
    progression: ['Z', 'X'],
    tags: ['deep', 'shot', 'maxProtect'],
  }),

  // ---------------- Flood / horizontal stretch ----------------
  smash: C('smash', 'Smash', {
    family: 'quickGame', dropDepth: 5, timing: 2.5,
    desc: 'Hitch under a corner route. The classic Cover 2 killer -- the corner is wrong either way.',
    routes: { X: 'hitch', Z: 'hitch', SLOT: 'corner', TE: 'corner', RB: 'checkdown' },
    progression: ['SLOT', 'Z', 'TE', 'RB'],
    tags: ['cover2Beater', 'zoneBeater'],
  }),
  flood: C('flood', 'Sail (Flood)', {
    family: 'westCoast', dropDepth: 5, timing: 2.6,
    desc: 'Three receivers to one side at three depths. A three-deep zone runs out of bodies.',
    routes: { X: 'go', Z: 'out', SLOT: 'flat', TE: 'block', RB: 'block' },
    progression: ['Z', 'SLOT', 'X'],
    tags: ['cover3Beater', 'zoneBeater'],
  }),
  levels: C('levels', 'Levels', {
    family: 'westCoast', dropDepth: 5, timing: 2.4,
    desc: 'Two in-breaking routes at different depths in the same window. Pick a level.',
    routes: { X: 'dig', SLOT: 'pivot', Z: 'comeback', TE: 'checkdown', RB: 'block' },
    progression: ['Z', 'X', 'SLOT', 'TE'],
    tags: ['zoneBeater', 'intermediate'],
  }),

  // ---------------- Shot plays ----------------
  postWheel: C('postWheel', 'Post-Wheel', {
    family: 'deepShot', dropDepth: 7, timing: 3.2,
    desc: 'Inside receiver takes the post, outside runs the wheel underneath him. Man coverage gets crossed up.',
    routes: { SLOT: 'post', X: 'wheel', Z: 'comeback', TE: 'block', RB: 'block' },
    progression: ['SLOT', 'X', 'Z'],
    tags: ['deep', 'shot', 'manBeater'],
  }),
  doublePost: C('doublePost', 'Double Post', {
    family: 'deepShot', dropDepth: 7, timing: 3.2,
    desc: 'Two posts at different depths on the same safety. He can only take one.',
    routes: { X: 'post', SLOT: 'post', Z: 'comeback', TE: 'checkdown', RB: 'block' },
    progression: ['SLOT', 'X', 'Z', 'TE'],
    tags: ['deep', 'shot'],
  }),
  sluggoSeam: C('sluggoSeam', 'Sluggo Seam', {
    family: 'deepShot', dropDepth: 7, timing: 3.5, protection: 'maxProtect',
    desc: 'Sell the slant, take it vertical. Punishes a corner who has been jumping the quick game.',
    routes: { X: 'sluggo', TE: 'seam', Z: 'comeback', SLOT: 'drag', RB: 'block' },
    progression: ['X', 'TE', 'SLOT', 'Z'],
    tags: ['deep', 'shot', 'doubleMove'],
  }),
  fadeOut: C('fadeOut', 'Fade-Out', {
    family: 'deepShot', dropDepth: 5, timing: 2.7,
    desc: 'Isolation on the outside. If you like your receiver against their corner, take it.',
    routes: { X: 'fade', Z: 'quickOut', SLOT: 'pivot', TE: 'checkdown', RB: 'block' },
    progression: ['X', 'Z', 'SLOT', 'TE'],
    tags: ['deep', 'iso', 'contested'],
  }),
  postCornerShot: C('postCornerShot', 'Post-Corner', {
    family: 'deepShot', dropDepth: 7, timing: 3.6, protection: 'maxProtect', extraBlockers: 1,
    desc: 'Double move to the boundary. Slow developing, and worth it when it hits.',
    routes: { Z: 'postCorner', X: 'go', SLOT: 'curl', RB: 'block' },
    progression: ['Z', 'SLOT', 'X'],
    tags: ['deep', 'shot', 'doubleMove', 'maxProtect'],
  }),

  // ---------------- Play action ----------------
  paBoot: C('paBoot', 'PA Bootleg', {
    family: 'playAction', dropDepth: 5, timing: 2.6, playAction: true, rollout: true,
    desc: 'Fake the run, put the quarterback on the edge, and cut the field in half.',
    routes: { TE: 'flat', Z: 'comeback', X: 'cross', SLOT: 'go', RB: 'block' },
    progression: ['TE', 'X', 'Z'],
    tags: ['playAction', 'rollout', 'safe'],
  }),
  paCrossers: C('paCrossers', 'PA Crossers', {
    family: 'playAction', dropDepth: 7, timing: 3.0, playAction: true,
    desc: 'Linebackers bite on the run fake and two crossers run through where they were.',
    routes: { X: 'cross', Z: 'cross', TE: 'seam', SLOT: 'checkdown', RB: 'block' },
    progression: ['Z', 'X', 'TE', 'SLOT'],
    tags: ['playAction', 'intermediate'],
  }),
  paShot: C('paShot', 'PA Deep Shot', {
    family: 'playAction', dropDepth: 7, timing: 3.4, playAction: true,
    protection: 'maxProtect', extraBlockers: 1,
    desc: 'Sell it hard, keep everyone in to block, and take one swing at the safety.',
    routes: { X: 'post', Z: 'go', TE: 'block', RB: 'block' },
    progression: ['Z', 'X'],
    tags: ['playAction', 'deep', 'shot', 'maxProtect'],
  }),
  paYSail: C('paYSail', 'PA Y-Sail', {
    family: 'playAction', dropDepth: 5, timing: 2.7, playAction: true, rollout: true,
    desc: 'Boot action with a three-level flood to the roll side.',
    routes: { TE: 'out', X: 'go', SLOT: 'flat', Z: 'comeback', RB: 'block' },
    progression: ['TE', 'SLOT', 'X'],
    tags: ['playAction', 'rollout', 'cover3Beater'],
  }),

  // ---------------- Screens ----------------
  rbScreen: C('rbScreen', 'RB Screen', {
    family: 'screen', dropDepth: 5, timing: 2.4, protection: 'screen',
    desc: 'Let them come, then throw it behind the rush. Turns a good pass rush into a liability.',
    routes: { RB: 'screenRB', X: 'go', Z: 'go', SLOT: 'go', TE: 'block' },
    progression: ['RB'],
    tags: ['screen', 'blitzBeater'],
  }),
  tunnelScreen: C('tunnelScreen', 'Tunnel Screen', {
    family: 'screen', dropDepth: 3, timing: 1.9, protection: 'screen',
    desc: 'Receiver works back inside behind a wall of blockers.',
    routes: { SLOT: 'tunnel', X: 'block', Z: 'go', TE: 'block', RB: 'block' },
    progression: ['SLOT'],
    tags: ['screen', 'blitzBeater'],
  }),
  bubbleScreen: C('bubbleScreen', 'Bubble Screen', {
    family: 'screen', dropDepth: 1, timing: 1.0, protection: 'quick',
    desc: 'Instant answer to a light box. Get it out and let him run.',
    routes: { SLOT: 'bubble', X: 'block', Z: 'go', RB: 'checkdown' },
    progression: ['SLOT'],
    tags: ['screen', 'quick', 'hot'],
  }),
};

export const PASS_CONCEPT_KEYS = Object.keys(PASS_CONCEPTS);

export function conceptsInFamily(family) {
  return PASS_CONCEPT_KEYS.filter((k) => PASS_CONCEPTS[k].family === family);
}

export function conceptsWithTag(tag) {
  return PASS_CONCEPT_KEYS.filter((k) => PASS_CONCEPTS[k].tags.includes(tag));
}
