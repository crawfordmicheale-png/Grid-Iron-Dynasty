# Grid Iron Dynasty

A deep American football head-coaching simulator, in the spirit of NFL Head Coach 09.

You are the head coach of a club in the fictional 32-team **Gridiron Football League**. You never
move a player with a stick. You build the roster, hire the staff, install the game plan in practice,
and call the plays on Sunday.

No build step, no dependencies. Serve the folder and open it.

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

---

## What it actually simulates

The core of the game is a **per-snap resolution engine**, not a yardage roll. Every play runs two
clocks against each other:

- the **protection timeline** — when does a rusher beat the man in front of him
- the **progression timeline** — when does the quarterback find somebody open

Whichever resolves first decides what kind of play this was. That one idea produces most of real
football's texture for free. Quick game beats a blitz because its timeline is shorter. A seven-step
shot play needs a line that can hold up. A fast processor survives behind a bad one. A quarterback
who works his whole progression with a clean pocket holds, comes back through, and gets less picky
as the play runs past the timing the concept was designed for — which is how a checkdown ends up
being the right throw.

**Passing** resolves through route separation built from the route/coverage table, route-running
against coverage skill, press at the line, shell tendencies by depth, physical mismatches, and the
coverage cost of a blitz. Then accuracy, then the catch, then yards after it. A quarterback needs a
bigger window to throw deep than to throw short. Defenses roll bracket help to a receiver who keeps
beating them, which is what caps a star's target share in the real league.

**Running** resolves gap by gap. The blocking scheme decides who is responsible for whom, the front
decides who is sitting in which gap, and each gap gets its own contest. The back then reads what
actually happened — with his vision rating deciding how well he reads it — and takes the best crease
the concept allows him to take.

Around that sit penalties, fatigue by positional exertion, injuries with real recovery timelines,
weather, altitude, travel, and crowd noise.

## Depth

| System | What is in it |
| --- | --- |
| Players | 64 attributes, 16 positions, 59 scouting archetypes, 34 traits, per-attribute ceilings |
| Playbook | 30 routes, 37 pass concepts, 16 run concepts, 20 formations across 9 personnel groupings |
| Defense | 6 fronts, 8 coverage shells, 8 pressure packages — 210 legal calls |
| Schemes | 8 offensive and 8 defensive systems that bias play calling and decide who fits |
| Staff | 14 roles including position coaches, trainers, strength staff, and scouts |
| Front office | Salary cap with proration, dead money, restructures, franchise tags, rookie scale |
| Draft | Scouting fog that narrows with investment, combine testing, busts and steals |

**Scheme fit** is measured against a player's own overall, so it grades the *shape* of a skill set
rather than its quality. A 71-overall zone-blocking guard is a plus fit in an outside-zone offense
and a 90-overall mauler is not.

**Practice** is where a head coach spends his week. Ten periods, and more things to do with them
than you have periods. Installed plays execute better than uninstalled ones, and practice time is
finite — a period spent on forty plays teaches each of them a quarter as well as a period spent on
ten. A narrow game plan executed cleanly beats a wide one nobody has repped.

**Scouting error is correlated, not independent.** A scout forms a view of the whole player rather
than making a separate mistake on each trait, which is why draft grades are genuinely wrong and not
merely noisy.

## Calibration

Every number in the simulation is fitted against the real league. Measured over 400 simulated games:

| | Simulated | Real NFL |
| --- | --- | --- |
| Points per team | 22.0 | 21–23 |
| Plays per game | 129 | 125–133 |
| Completion percentage | 65.3% | 64–67% |
| Yards per attempt | 7.21 | 6.9–7.3 |
| Yards per carry | 4.54 | 4.2–4.5 |
| Sack rate | 5.8% | 6–7.5% |
| Interception rate | 2.1% | 2.0–2.6% |
| Field goal percentage | 84.3% | ~84% |
| First downs per team | 20.7 | ~20 |
| Seconds per play | 27.8 | ~28 |
| Penalties per game | 12.9 | 12–13 |

Completion rate by pass depth, drive outcomes, target share by position, and the field-goal make
curve are all fitted to the real distributions rather than to a single average.

Franchises are validated over nine simulated seasons: league talent, average age, and the count of
elite players all stay flat, every club finishes at exactly 53 players under the cap, season
statistical leaders land where real ones do, and championships rotate.

Three tools re-run the checks:

```bash
node tools/snapStats.mjs 25000     # snap-level rates
node tools/gameStats.mjs 400       # full-game box score distributions
node tools/franchise.mjs 10        # ten seasons, checking the league stays healthy
node tools/uitest.mjs              # drives the interface in a real browser
```

The first three need nothing but Node. The browser test needs Playwright
(`npm install playwright`), which is the only dependency anywhere in the project
and is not required to play.

## Playing it

**Team** is the hub: your next opponent, the division race, the injury report, what the owner wants.

**Game Plan** is the practice week. Assign ten periods and choose what to install.

**Game day** hands you a call sheet. Hover a play to see the route art on the field, with the
primary read highlighted. Your coordinator handles the defense; the staff makes the fourth-down
calls unless they decide to go for it, at which point you pick the play.

**Front Office** carries the cap sheet, free agency, and the draft board — showing your scouts'
estimates, not the truth.

The offseason runs one stage at a time: retirements and development, the coaching carousel, expiring
contracts, re-signing your own, cap casualties, free agency, the draft, and final cuts.

## Architecture

```
js/
  core/     rng, math and football formatting, event bus, save/load
  data/     attributes, positions, traits, teams, schemes, routes,
            concepts, formations, defensive calls, playbook assembler
  model/    player, team, league, contracts, staff, generators
  sim/      context and weather, personnel, pass, run, snap,
            clock, special teams, play caller, game
  season/   schedule, standings, playoffs, awards, season,
            progression, draft, free agency, practice, staffing, offseason
  ui/       dom helpers, canvas field renderer, app shell, screens
```

The simulation never touches the DOM, which is what lets the balance harnesses run headless. Every
random draw comes from a seeded RNG, so a franchise replays bit-for-bit from its seed. A save is
plain JSON with ids instead of object references — readable, and portable between browsers.
