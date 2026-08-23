// Headless snap sampler: fires a large number of neutral-situation snaps
// across many team matchups and reports the rate statistics that decide
// whether the simulation is producing real football.

import { generateLeague } from '../js/model/leagueGen.js';
import { playbookForScheme, defensivePlaybookForScheme } from '../js/data/playbook.js';
import { runSnap } from '../js/sim/snap.js';
import { buildContext, generateWeather } from '../js/sim/context.js';
import { RNG } from '../js/core/rng.js';
import { round, mean } from '../js/core/util.js';

const N = Number(process.argv[2] ?? 20000);
const lg = generateLeague({ seed: process.argv[3] ?? 'stats' });
const rng = new RNG('sampler');
const teams = lg.allTeams();

const books = new Map();
for (const t of teams) {
  books.set(t.id, {
    off: playbookForScheme(rng, t.staff.OC.offScheme, 150),
    def: defensivePlaybookForScheme(rng, t.staff.DC.defScheme, 60),
  });
}

const s = {
  plays: 0, dropbacks: 0, att: 0, cmp: 0, passYds: 0, sacks: 0, sackYds: 0, ints: 0,
  scrambles: 0, scrambleYds: 0, throwaways: 0, pressured: 0, drops: 0, pbu: 0,
  rushes: 0, rushYds: 0, fumbles: 0, penalties: 0, injuries: 0,
  ttt: [], airYards: [], yac: [], sep: [], reads: [],
  runDist: {}, passDist: {},
};

for (let i = 0; i < N; i += 1) {
  const off = rng.pick(teams);
  let def = rng.pick(teams);
  while (def.id === off.id) def = rng.pick(teams);
  const ob = books.get(off.id); const db = books.get(def.id);
  const ctx = buildContext({ weather: generateWeather(rng, def, rng.int(1, 18)) });
  const isPass = rng.bool(0.57);
  const play = isPass ? rng.pick(ob.off.passes) : rng.pick(ob.off.runs);
  const call = rng.pick(db.def);
  const r = runSnap({ rng, offTeam: off, defTeam: def, play, defCall: call, ctx, crowdNoise: 0.5 });

  s.plays += 1;
  if (r.penalty || r.type === 'penalty') s.penalties += 1;
  if (r.injuries?.length) s.injuries += r.injuries.length;
  if (r.type === 'penalty') continue;
  if (r.fumble) s.fumbles += 1;

  if (play.type === 'pass') {
    s.dropbacks += 1;
    if (r.pressured) s.pressured += 1;
    if (r.timeToThrow) s.ttt.push(r.timeToThrow);
    if (r.readsMade) s.reads.push(r.readsMade);
    if (r.type === 'sack') { s.sacks += 1; s.sackYds += -r.yards; }
    else if (r.type === 'scramble') { s.scrambles += 1; s.scrambleYds += r.yards; }
    else if (r.type === 'throwaway') { s.throwaways += 1; s.att += 1; }
    else {
      s.att += 1;
      if (r.separation !== undefined) s.sep.push(r.separation);
      if (r.type === 'complete') {
        s.cmp += 1; s.passYds += r.yards;
        s.airYards.push(r.airYards); s.yac.push(r.yac ?? 0);
        const b = Math.min(9, Math.floor(r.yards / 10));
        s.passDist[b] = (s.passDist[b] || 0) + 1;
      } else if (r.type === 'interception') s.ints += 1;
      else { if (r.dropped) s.drops += 1; if (r.brokenUpBy) s.pbu += 1; }
    }
  } else {
    s.rushes += 1; s.rushYds += r.yards;
    const b = r.yards < 0 ? 'neg' : Math.min(4, Math.floor(r.yards / 5));
    s.runDist[b] = (s.runDist[b] || 0) + 1;
  }
}

const pctS = (a, b) => `${round(100 * a / b, 1)}%`;
const row = (label, got, want) => console.log('  ' + label.padEnd(28) + String(got).padStart(9) + '   real NFL: ' + want);

console.log(`\n=== ${s.plays} snaps sampled ===\n`);
console.log('PASSING');
row('completion %', pctS(s.cmp, s.att), '64-67%');
row('yards per attempt', round(s.passYds / s.att, 2), '6.9-7.3');
row('yards per completion', round(s.passYds / s.cmp, 2), '11.0-11.6');
row('sack rate (of dropbacks)', pctS(s.sacks, s.dropbacks), '6-7.5%');
row('interception rate', pctS(s.ints, s.att), '2.0-2.6%');
row('pressure rate', pctS(s.pressured, s.dropbacks), '33-38%');
row('drop rate (of att)', pctS(s.drops, s.att), '3-5%');
row('scramble rate', pctS(s.scrambles, s.dropbacks), '3-5%');
row('throwaway rate', pctS(s.throwaways, s.dropbacks), '2-4%');
row('avg time to throw', round(mean(s.ttt), 2) + 's', '2.7-2.9s');
row('avg air yards (comp)', round(mean(s.airYards), 1), '6.5-8.0');
row('avg YAC (comp)', round(mean(s.yac), 1), '4.8-5.6');
row('avg separation', round(mean(s.sep), 2), 'n/a');
row('avg reads made', round(mean(s.reads), 2), 'n/a');
row('avg sack yards', round(s.sackYds / Math.max(1, s.sacks), 1), '6.5-7.5');

console.log('\nRUSHING');
row('yards per carry', round(s.rushYds / s.rushes, 2), '4.2-4.5');
const rd = s.runDist;
const rtot = Object.values(rd).reduce((a, b) => a + b, 0);
row('stuffed (negative)', pctS(rd.neg || 0, rtot), '~10%');
row('0-4 yards', pctS(rd[0] || 0, rtot), '~48%');
row('5-9 yards', pctS(rd[1] || 0, rtot), '~24%');
row('10+ yards', pctS((rd[2] || 0) + (rd[3] || 0) + (rd[4] || 0), rtot), '~12-14%');

console.log('\nOTHER');
row('penalty rate per snap', pctS(s.penalties, s.plays), '~9-11%');
row('fumble rate per play', pctS(s.fumbles, s.plays), '~1.3%');
row('injury rate per snap', pctS(s.injuries, s.plays), '~0.15-0.3%');
console.log();
