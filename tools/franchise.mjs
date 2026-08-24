// Long-run franchise validation: does the league stay healthy over a decade?

import { generateLeague } from '../js/model/leagueGen.js';
import { Season } from '../js/season/season.js';
import { Offseason } from '../js/season/offseason.js';
import { round, mean, byDesc } from '../js/core/util.js';

const YEARS = Number(process.argv[2] ?? 10);
const lg = generateLeague({ seed: process.argv[3] ?? 'franchise' });
const season = new Season(lg);
const champs = [];
const t0 = Date.now();

console.log('year  champ   record  | league OVR  90+  80+ | age  | teams over cap | roster | leader: pass / rush / rec');
for (let y = 0; y < YEARS; y += 1) {
  const out = season.simulateFullSeason();
  const all = lg.allPlayers();
  const ly = lg.leagueYear;
  const sizes = lg.allTeams().map((t) => t.roster.length);
  const overCap = lg.allTeams().filter((t) => t.capSpace(ly, ly) < 0).length;
  // Season leaders come from the history entry, which is written before the
  // season's stats are rolled into career totals.
  const leaders = lg.history[lg.history.length - 1]?.leaders ?? {};
  const best = (k) => leaders[k]?.[0]?.value ?? 0;
  const champ = lg.team(out.championId);
  champs.push(out.championId);
  console.log(
    lg.year,
    champ.abbr.padEnd(6),
    champ.recordString.padEnd(7),
    '|', String(round(mean(all, (p) => p.overall()), 1)).padStart(5),
    String(all.filter((p) => p.overall() >= 90).length).padStart(4),
    String(all.filter((p) => p.overall() >= 80).length).padStart(4),
    '|', round(mean(all, (p) => p.age), 1),
    '|', String(overCap).padStart(14),
    '|', `${Math.min(...sizes)}-${Math.max(...sizes)}`.padStart(6),
    '|', String(best('passYds')).padStart(4), '/', String(best('rushYds')).padStart(4), '/', String(best('recYds')).padStart(4),
  );
  if (y < YEARS - 1) new Offseason(lg, season).runAll();
}

console.log(`\n${YEARS} seasons in ${round((Date.now() - t0) / 1000, 1)}s`);
console.log('champions:', champs.map((c) => lg.team(c).abbr).join(', '));
console.log('distinct champions:', new Set(champs).size, `of ${YEARS}`);

const ratings = lg.allTeams().map((t) => t.overallRating);
console.log('team rating spread now:', Math.min(...ratings), '-', Math.max(...ratings));

const decorated = lg.allPlayers().concat(lg.retired)
  .filter((p) => (p.accolades ?? []).length >= 4)
  .sort(byDesc((p) => p.accolades.length));
console.log('\nplayers with 4+ career honours:', decorated.length);
for (const p of decorated.slice(0, 6)) {
  console.log(`  ${p.pos.padEnd(5)}${p.name.padEnd(22)} age ${p.age}  ${p.accolades.length} honours`);
}
const hallOfFame = lg.retired.filter((p) => (p.accolades ?? []).length >= 3);
console.log('retired with 3+ honours:', hallOfFame.length, '| total retired:', lg.retired.length);
