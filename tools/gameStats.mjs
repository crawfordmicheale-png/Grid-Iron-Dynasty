// Full-game harness: simulates many complete games and reports the box-score
// level statistics that decide whether a season will feel like real football.

import { generateLeague } from '../js/model/leagueGen.js';
import { Game } from '../js/sim/game.js';
import { playbookForScheme, defensivePlaybookForScheme } from '../js/data/playbook.js';
import { RNG } from '../js/core/rng.js';
import { round, mean, median } from '../js/core/util.js';
import { ROUTES } from '../js/data/routes.js';

const N = Number(process.argv[2] ?? 200);
const lg = generateLeague({ seed: process.argv[3] ?? 'gamestats' });
const rng = new RNG('games');
const teams = lg.allTeams();

// Build each club's books once so we are not regenerating them per game.
const books = new Map();
for (const t of teams) {
  books.set(t.id, {
    off: playbookForScheme(rng, t.staff.OC.offScheme, 150),
    def: defensivePlaybookForScheme(rng, t.staff.DC.defScheme, 60),
  });
}

const g = {
  scores: [], totals: [], plays: [], drives: [], margins: [], ot: 0,
  passAtt: 0, passCmp: 0, passYds: 0, passTD: 0, ints: 0, sacks: 0,
  air: [], yac: [], scrimmage: 0, firstDowns: 0, elapsedPerPlay: [],
  bandAtt: {}, bandCmp: {},
  rushAtt: 0, rushYds: 0, rushTD: 0, fgMade: 0, fgAtt: 0, punts: 0,
  driveResults: {}, thirdDownConv: 0, thirdDownAtt: 0, fourthAtt: 0,
  penalties: 0, turnovers: 0, timeOfPossessionPlays: 0,
};

const t0 = Date.now();
for (let i = 0; i < N; i += 1) {
  const home = rng.pick(teams);
  let away = rng.pick(teams);
  while (away.id === home.id) away = rng.pick(teams);
  // Reset per-game state.
  for (const t of [home, away]) for (const p of t.roster) { p.stats = {}; p.fatigue = 100; p.injury = null; }

  const game = new Game({
    rng, home, away, week: rng.int(1, 18),
    homeOffBook: books.get(home.id).off, homeDefBook: books.get(home.id).def,
    awayOffBook: books.get(away.id).off, awayDefBook: books.get(away.id).def,
  });
  const r = game.run();

  g.scores.push(r.homeScore, r.awayScore);
  g.totals.push(r.homeScore + r.awayScore);
  g.margins.push(Math.abs(r.homeScore - r.awayScore));
  g.plays.push(r.playLog.filter((e) => e.type === 'play' && e.result?.type !== 'penalty').length);
  g.drives.push(r.drives.length);
  g.firstDowns += (r.firstDowns[home.id] ?? 0) + (r.firstDowns[away.id] ?? 0);
  if (r.overtime) g.ot += 1;

  for (const d of r.drives) g.driveResults[d.result ?? 'none'] = (g.driveResults[d.result ?? 'none'] || 0) + 1;
  for (const e of r.playLog) {
    if (e.type === 'play') {
      const res = e.result;
      if (res.type === 'complete' || res.type === 'incomplete' || res.type === 'interception' || res.type === 'throwaway') {
        g.passAtt += 1;
        if (res.route) {
          const d = ROUTES[res.route].depth;
          const b = d < 0 ? 'behind' : d <= 5 ? '0-5' : d <= 10 ? '6-10' : d <= 19 ? '11-19' : '20+';
          g.bandAtt[b] = (g.bandAtt[b] || 0) + 1;
          if (res.type === 'complete') g.bandCmp[b] = (g.bandCmp[b] || 0) + 1;
        }
        if (res.type === 'complete') {
          g.passCmp += 1; g.passYds += res.yards; if (res.touchdown) g.passTD += 1;
          g.air.push(res.airYards); g.yac.push(res.yac ?? 0);
        }
        if (res.type === 'interception') { g.ints += 1; g.turnovers += 1; }
      } else if (res.type === 'sack') g.sacks += 1;
      else if (res.type === 'run' || res.type === 'scramble') {
        g.rushAtt += 1; g.rushYds += res.yards; if (res.touchdown) g.rushTD += 1;
      }
      if (res.penalty) g.penalties += 1;

      if (res.type !== 'penalty') g.scrimmage += 1;
      if (res.fumble) g.turnovers += 1;
      if (e.play && res.down === 3) { /* placeholder */ }
    }
    if (e.type === 'fieldGoal') { g.fgAtt += 1; if (e.good) g.fgMade += 1; }
    if (e.type === 'punt') g.punts += 1;
  }
}
const elapsed = (Date.now() - t0) / 1000;

const row = (label, got, want) => console.log('  ' + label.padEnd(30) + String(got).padStart(8) + '   real NFL: ' + want);
console.log(`\n=== ${N} full games in ${round(elapsed, 1)}s (${round(elapsed / N * 1000, 0)}ms each) ===\n`);
console.log('SCORING');
row('points per team', round(mean(g.scores), 1), '21-23');
row('combined points', round(mean(g.totals), 1), '43-46');
row('median combined', median(g.totals), '~44');
row('avg margin', round(mean(g.margins), 1), '~10.5');
row('shutouts', g.scores.filter((s) => s === 0).length, `~1% (${round(100 * g.scores.filter((s) => s === 0).length / g.scores.length, 1)}%)`);
row('overtime games', `${round(100 * g.ot / N, 1)}%`, '~6%');
row('50+ point games', g.scores.filter((s) => s >= 50).length, '~0.3%');

console.log('\nVOLUME (per game, both teams)');
row('plays', round(mean(g.plays), 1), '125-133');
row('drives', round(mean(g.drives), 1), '~22-24');
row('pass attempts', round(g.passAtt / N, 1), '~66');
row('rush attempts', round(g.rushAtt / N, 1), '~53');
row('punts', round(g.punts / N, 1), '~8.5');
row('field goal attempts', round(g.fgAtt / N, 1), '~3.6');
row('turnovers', round(g.turnovers / N, 1), '~2.6');
row('penalties (flags thrown)', round(g.penalties / N, 1), '~12-13');

console.log('\nEFFICIENCY');
row('completion %', `${round(100 * g.passCmp / g.passAtt, 1)}%`, '64-67%');
row('yards per attempt', round(g.passYds / g.passAtt, 2), '6.9-7.3');
row('pass yards per team', round(g.passYds / (N * 2), 1), '~225');
row('yards per carry', round(g.rushYds / g.rushAtt, 2), '4.2-4.5');
row('rush yards per team', round(g.rushYds / (N * 2), 1), '~115');
row('sack rate', `${round(100 * g.sacks / (g.passAtt + g.sacks), 1)}%`, '6-7.5%');
row('interception rate', `${round(100 * g.ints / g.passAtt, 1)}%`, '2.0-2.6%');
row('field goal %', `${round(100 * g.fgMade / Math.max(1, g.fgAtt), 1)}%`, '~84%');
row('pass TD per game', round(g.passTD / N, 2), '~3.0');
row('avg air yards (comp)', round(mean(g.air), 1), '6.5-7.5');
row('avg YAC (comp)', round(mean(g.yac), 1), '4.8-5.6');
row('yards per completion', round(g.passYds / g.passCmp, 2), '11.0-11.6');
row('first downs per team', round(g.firstDowns / (N * 2), 1), '~20');
row('seconds per play', round(3600 / (g.scrimmage / N), 1), '~28');
row('rush TD per game', round(g.rushTD / N, 2), '~1.8');

console.log('\nPASS DEPTH');
{
  const realC = { behind: '85%', '0-5': '75%', '6-10': '66%', '11-19': '55%', '20+': '38%' };
  const realS = { behind: '13%', '0-5': '28%', '6-10': '24%', '11-19': '22%', '20+': '13%' };
  const tot = Object.values(g.bandAtt).reduce((a, b) => a + b, 0);
  console.log('  band      share  (real)   comp%   (real)');
  for (const b of ['behind', '0-5', '6-10', '11-19', '20+']) {
    const a = g.bandAtt[b] || 0;
    console.log('  ' + b.padEnd(8)
      + String(round(100 * a / tot, 1) + '%').padStart(6) + '  ' + realS[b].padStart(6) + '  '
      + String(round(100 * (g.bandCmp[b] || 0) / Math.max(1, a), 1) + '%').padStart(6) + '  ' + realC[b].padStart(6));
  }
}

console.log('\nDRIVE OUTCOMES');
const totalDrives = Object.values(g.driveResults).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(g.driveResults).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(32) + String(round(100 * v / totalDrives, 1) + '%').padStart(7));
}
console.log('  real NFL roughly: punt 38%  touchdown 21%  field goal 12%  downs 6%  interception 5%  fumble 4%  end of half 8%');
console.log();
