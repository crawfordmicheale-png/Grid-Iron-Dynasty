// The route library.
//
// Each route carries the numbers the play engine needs to build a separation
// curve: how deep it goes, how long until the break, what it does against
// press, and -- the important part -- how it fares against each coverage shell.
//
// `vs` values are separation modifiers in rough yards-of-daylight terms,
// -5 (route is covered by design) to +5 (route is the answer to that call).
// They encode real coverage structure: a dig is death against quarters and
// gold against a two-deep shell; a corner route is the reason Cover 2 has a
// hole; four verticals eat single-high and stall against four-deep.

export const ROUTE_DEPTHS = { quick: 0, short: 1, intermediate: 2, deep: 3 };

const R = (key, name, cfg) => ({ key, name, ...cfg });

export const ROUTES = {
  // --- Quick game (ball out under 2.0s) ---
  flat: R('flat', 'Flat', {
    depth: 2, breakTime: 1.1, band: 'quick', type: 'out', yacBase: 5.2, risk: 0.5,
    vsPress: -1, manBonus: -1, zoneBonus: 3,
    vs: { cover0: 1, cover1: -1, cover2: -3, cover2man: -2, cover3: 4, cover4: 2, cover6: 2, tampa2: -2 },
  }),
  slant: R('slant', 'Slant', {
    depth: 4, breakTime: 1.3, band: 'quick', type: 'in', yacBase: 5.8, risk: 1.15,
    vsPress: 2, manBonus: 2, zoneBonus: 0,
    vs: { cover0: 4, cover1: 3, cover2: 1, cover2man: 2, cover3: 1, cover4: 3, cover6: 2, tampa2: 1 },
  }),
  hitch: R('hitch', 'Hitch', {
    depth: 7, breakTime: 1.7, band: 'quick', type: 'back', yacBase: 2.6, risk: 0.6,
    vsPress: -2, manBonus: -2, zoneBonus: 3,
    vs: { cover0: -1, cover1: -2, cover2: 2, cover2man: -1, cover3: 3, cover4: 2, cover6: 2, tampa2: 3 },
  }),
  bubble: R('bubble', 'Bubble Screen', {
    depth: -1, breakTime: 0.8, band: 'quick', type: 'screen', yacBase: 7.5, risk: 0.3,
    vsPress: -3, manBonus: -3, zoneBonus: 3, screen: true,
    vs: { cover0: -2, cover1: -2, cover2: 2, cover2man: -2, cover3: 3, cover4: 2, cover6: 2, tampa2: 2 },
  }),
  swing: R('swing', 'Swing', {
    depth: -1, breakTime: 1.0, band: 'quick', type: 'out', yacBase: 6.4, risk: 0.4, checkdown: true,
    vsPress: 0, manBonus: -2, zoneBonus: 2,
    vs: { cover0: 2, cover1: 0, cover2: -1, cover2man: -1, cover3: 2, cover4: 1, cover6: 1, tampa2: 0 },
  }),
  checkdown: R('checkdown', 'Checkdown', {
    depth: 3, breakTime: 1.4, band: 'quick', type: 'sit', yacBase: 4.2, risk: 0.35, checkdown: true,
    vsPress: 0, manBonus: -1, zoneBonus: 3,
    vs: { cover0: 0, cover1: 0, cover2: 2, cover2man: 0, cover3: 2, cover4: 2, cover6: 2, tampa2: 1 },
  }),

  // --- Short / underneath ---
  drag: R('drag', 'Shallow Cross', {
    depth: 4, breakTime: 1.5, band: 'short', type: 'across', yacBase: 6.8, risk: 0.6,
    vsPress: 1, manBonus: 4, zoneBonus: 1, rub: true,
    vs: { cover0: 5, cover1: 4, cover2: 1, cover2man: 4, cover3: 1, cover4: 2, cover6: 2, tampa2: 0 },
  }),
  stick: R('stick', 'Stick', {
    depth: 7, breakTime: 1.7, band: 'short', type: 'option', yacBase: 3.4, risk: 0.6, option: true,
    vsPress: -1, manBonus: 1, zoneBonus: 3,
    vs: { cover0: 2, cover1: 1, cover2: 2, cover2man: 1, cover3: 3, cover4: 3, cover6: 3, tampa2: 3 },
  }),
  spot: R('spot', 'Spot', {
    depth: 5, breakTime: 1.7, band: 'short', type: 'sit', yacBase: 3.0, risk: 0.5,
    vsPress: -1, manBonus: 0, zoneBonus: 4,
    vs: { cover0: 0, cover1: 0, cover2: 3, cover2man: 0, cover3: 4, cover4: 3, cover6: 3, tampa2: 3 },
  }),
  angle: R('angle', 'Angle', {
    depth: 5, breakTime: 1.9, band: 'short', type: 'in', yacBase: 5.5, risk: 0.7,
    vsPress: 1, manBonus: 4, zoneBonus: -1,
    vs: { cover0: 4, cover1: 4, cover2: 0, cover2man: 3, cover3: 0, cover4: 1, cover6: 1, tampa2: -1 },
  }),
  whip: R('whip', 'Whip', {
    depth: 7, breakTime: 2.0, band: 'short', type: 'out', yacBase: 4.4, risk: 0.8,
    vsPress: 0, manBonus: 4, zoneBonus: -1,
    vs: { cover0: 4, cover1: 4, cover2: -1, cover2man: 4, cover3: 0, cover4: 1, cover6: 0, tampa2: -1 },
  }),

  quickOut: R('quickOut', 'Speed Out', {
    depth: 8, breakTime: 1.9, band: 'short', type: 'out', yacBase: 3.0, risk: 1.1,
    vsPress: -2, manBonus: 1, zoneBonus: 1,
    vs: { cover0: 2, cover1: 1, cover2: -2, cover2man: -1, cover3: 3, cover4: 0, cover6: 1, tampa2: -1 },
  }),
  hook: R('hook', 'Hook', {
    depth: 9, breakTime: 2.0, band: 'short', type: 'back', yacBase: 3.2, risk: 0.7,
    vsPress: -1, manBonus: -1, zoneBonus: 4,
    vs: { cover0: 0, cover1: -1, cover2: 3, cover2man: 0, cover3: 4, cover4: 3, cover6: 3, tampa2: 3 },
  }),
  pivot: R('pivot', 'Pivot', {
    depth: 8, breakTime: 2.0, band: 'short', type: 'in', yacBase: 4.8, risk: 0.9,
    vsPress: 1, manBonus: 4, zoneBonus: 0,
    vs: { cover0: 4, cover1: 4, cover2: 1, cover2man: 3, cover3: 1, cover4: 2, cover6: 1, tampa2: 0 },
  }),

  // --- Intermediate ---
  out: R('out', 'Out', {
    depth: 10, breakTime: 2.2, band: 'intermediate', type: 'out', yacBase: 2.4, risk: 1.5,
    vsPress: -2, manBonus: 0, zoneBonus: 1,
    vs: { cover0: 1, cover1: 0, cover2: -3, cover2man: -3, cover3: 3, cover4: -1, cover6: 0, tampa2: -2 },
  }),
  dig: R('dig', 'Dig', {
    depth: 14, breakTime: 2.45, band: 'intermediate', type: 'in', yacBase: 4.6, risk: 1.3,
    vsPress: -1, manBonus: 0, zoneBonus: 3,
    vs: { cover0: 1, cover1: 0, cover2: 4, cover2man: 0, cover3: 3, cover4: -3, cover6: 1, tampa2: -2 },
  }),
  curl: R('curl', 'Curl', {
    depth: 12, breakTime: 2.4, band: 'intermediate', type: 'back', yacBase: 2.8, risk: 0.9,
    vsPress: -2, manBonus: -1, zoneBonus: 4,
    vs: { cover0: -1, cover1: -1, cover2: 3, cover2man: 0, cover3: 4, cover4: 2, cover6: 3, tampa2: 3 },
  }),
  comeback: R('comeback', 'Comeback', {
    depth: 15, breakTime: 2.9, band: 'intermediate', type: 'back', yacBase: 1.8, risk: 1.2,
    vsPress: -2, manBonus: 3, zoneBonus: 0,
    vs: { cover0: 3, cover1: 3, cover2: -1, cover2man: 2, cover3: 2, cover4: 1, cover6: 1, tampa2: 0 },
  }),
  cross: R('cross', 'Deep Cross', {
    depth: 15, breakTime: 2.55, band: 'intermediate', type: 'across', yacBase: 5.6, risk: 1.1,
    vsPress: 0, manBonus: 4, zoneBonus: 2,
    vs: { cover0: 4, cover1: 4, cover2: 3, cover2man: 4, cover3: 2, cover4: 0, cover6: 2, tampa2: 1 },
  }),
  corner: R('corner', 'Corner', {
    depth: 16, breakTime: 2.6, band: 'intermediate', type: 'out', yacBase: 2.2, risk: 1.5,
    vsPress: -1, manBonus: 1, zoneBonus: 2,
    vs: { cover0: 2, cover1: 1, cover2: 5, cover2man: 2, cover3: 1, cover4: -2, cover6: 2, tampa2: 4 },
  }),
  wheel: R('wheel', 'Wheel', {
    depth: 18, breakTime: 2.7, band: 'intermediate', type: 'up', yacBase: 3.4, risk: 1.8,
    vsPress: 1, manBonus: 4, zoneBonus: -1,
    vs: { cover0: 5, cover1: 4, cover2: 0, cover2man: 3, cover3: 1, cover4: -1, cover6: 0, tampa2: 0 },
  }),

  // --- Deep ---
  go: R('go', 'Go', {
    depth: 24, breakTime: 2.75, band: 'deep', type: 'up', yacBase: 2.0, risk: 1.6,
    vsPress: -3, manBonus: 1, zoneBonus: -1,
    vs: { cover0: 4, cover1: 2, cover2: 1, cover2man: 2, cover3: -1, cover4: -3, cover6: -1, tampa2: -2 },
  }),
  seam: R('seam', 'Seam', {
    depth: 20, breakTime: 2.6, band: 'deep', type: 'up', yacBase: 3.2, risk: 1.7,
    vsPress: -1, manBonus: 1, zoneBonus: 2,
    vs: { cover0: 3, cover1: 2, cover2: 4, cover2man: 2, cover3: 4, cover4: -2, cover6: 1, tampa2: -3 },
  }),
  post: R('post', 'Post', {
    depth: 20, breakTime: 2.6, band: 'deep', type: 'in', yacBase: 4.0, risk: 1.9,
    vsPress: -1, manBonus: 2, zoneBonus: 1,
    vs: { cover0: 5, cover1: 1, cover2: 4, cover2man: 3, cover3: -3, cover4: -1, cover6: 1, tampa2: -3 },
  }),
  fade: R('fade', 'Fade', {
    depth: 22, breakTime: 2.6, band: 'deep', type: 'up', yacBase: 1.4, risk: 1.4, contested: true,
    vsPress: 1, manBonus: 2, zoneBonus: -2,
    vs: { cover0: 4, cover1: 3, cover2: -1, cover2man: 3, cover3: 0, cover4: -2, cover6: 0, tampa2: -1 },
  }),
  postCorner: R('postCorner', 'Post-Corner', {
    depth: 21, breakTime: 3.05, band: 'deep', type: 'out', yacBase: 2.2, risk: 1.6, doubleMove: true,
    vsPress: -1, manBonus: 4, zoneBonus: -1,
    vs: { cover0: 4, cover1: 5, cover2: 2, cover2man: 4, cover3: 3, cover4: -1, cover6: 1, tampa2: 1 },
  }),
  sluggo: R('sluggo', 'Slant-and-Go', {
    depth: 22, breakTime: 3.15, band: 'deep', type: 'up', yacBase: 2.4, risk: 1.7, doubleMove: true,
    vsPress: 0, manBonus: 5, zoneBonus: -2,
    vs: { cover0: 5, cover1: 5, cover2: 1, cover2man: 4, cover3: 2, cover4: -2, cover6: 0, tampa2: -1 },
  }),

  // --- Blocking / non-receiving assignments ---
  block: R('block', 'Pass Protect', {
    depth: 0, breakTime: 99, band: 'quick', type: 'block', yacBase: 0, risk: 0,
    vsPress: 0, manBonus: 0, zoneBonus: 0, blocker: true, vs: {},
  }),
  screenRB: R('screenRB', 'Back Screen', {
    depth: -2, breakTime: 2.2, band: 'quick', type: 'screen', yacBase: 8.5, risk: 0.7, screen: true,
    vsPress: 0, manBonus: -2, zoneBonus: 2,
    vs: { cover0: 5, cover1: 2, cover2: 0, cover2man: 1, cover3: 1, cover4: 0, cover6: 0, tampa2: 0 },
  }),
  tunnel: R('tunnel', 'Tunnel Screen', {
    depth: -1, breakTime: 1.9, band: 'quick', type: 'screen', yacBase: 8.0, risk: 0.6, screen: true,
    vsPress: 0, manBonus: -2, zoneBonus: 2,
    vs: { cover0: 4, cover1: 1, cover2: 1, cover2man: 0, cover3: 2, cover4: 1, cover6: 1, tampa2: 1 },
  }),
};

export const ROUTE_KEYS = Object.keys(ROUTES);

// A route's separation modifier against a given coverage, folding in the
// man/zone character of that shell.
export function routeVsCoverage(routeKey, coverageKey, isMan) {
  const r = ROUTES[routeKey];
  if (!r) return 0;
  const shell = r.vs?.[coverageKey] ?? 0;
  const character = isMan ? (r.manBonus ?? 0) : (r.zoneBonus ?? 0);
  return shell + character * 0.55;
}

export function routesInBand(band) {
  return ROUTE_KEYS.filter((k) => ROUTES[k].band === band);
}
