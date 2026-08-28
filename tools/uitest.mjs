import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const title = await page.textContent('.setup__title').catch(() => null);
console.log('setup screen title:', title);
const teamCount = await page.locator('.teamcard').count();
console.log('team cards rendered:', teamCount);

// The team picker is taller than any window, so it has to scroll. Without a
// scroll container of its own it gets clipped at the fold by the global
// `body { overflow: hidden }`, leaving only the first few clubs selectable.
const scroll = await page.evaluate(() => {
  const sc = document.querySelector('.screen--bare');
  if (!sc) return { ok: false, why: 'no .screen--bare container' };
  const cards = [...document.querySelectorAll('.teamcard')];
  const last = cards[cards.length - 1];
  sc.scrollTop = sc.scrollHeight;
  const box = last.getBoundingClientRect();
  return {
    ok: sc.scrollHeight > sc.clientHeight && box.top >= 0 && box.bottom <= window.innerHeight + 2,
    view: sc.clientHeight, content: sc.scrollHeight,
  };
});
console.log(`setup scrolls to the last club: ${scroll.ok}`
  + (scroll.view ? ` (${scroll.view}px view / ${scroll.content}px content)` : ` — ${scroll.why}`));
if (!scroll.ok) errors.push('setup screen does not scroll to the last club');
await page.evaluate(() => { document.querySelector('.screen--bare').scrollTop = 0; });

// Pick a team and start
await page.locator('.teamcard').filter({ hasText: 'Sentinels' }).first().click();
await page.waitForTimeout(300);
await page.locator('button.btn--primary').first().click();
await page.waitForTimeout(2500);

console.log('screen after start:', await page.locator('.nav__item.is-active').textContent().catch(() => 'none'));
console.log('topbar team:', (await page.textContent('.topbar__team').catch(() => '')).trim());
await page.screenshot({ path: '/tmp/shot-hub.png' });

// Walk each nav tab
for (const tab of ['Roster', 'Game Plan', 'Front Office', 'Staff', 'League']) {
  await page.locator('.nav__item', { hasText: tab }).click();
  await page.waitForTimeout(700);
  const panels = await page.locator('.panel').count();
  console.log(`${tab}: ${panels} panels`);
  await page.screenshot({ path: `/tmp/shot-${tab.replace(/\s/g, '')}.png` });
}

// Back to hub and coach a game
await page.locator('.nav__item', { hasText: 'Team' }).click();
await page.waitForTimeout(500);
const coach = page.locator('button', { hasText: 'Coach this game' });
if (await coach.count()) {
  await coach.first().click();
  await page.waitForTimeout(2500);
  console.log('scoreboard present:', await page.locator('.scoreboard').count() > 0);
  console.log('field canvas present:', await page.locator('canvas.field').count() > 0);
  const plays = await page.locator('.playcard').count();
  console.log('play call sheet entries:', plays);
  await page.screenshot({ path: '/tmp/shot-gameday.png' });
  if (plays > 0) {
    await page.locator('.playcard').first().click();
    await page.waitForTimeout(1200);
    console.log('play-by-play lines after one call:', await page.locator('.pbp__item').count());
    await page.screenshot({ path: '/tmp/shot-gameday2.png' });
  }
} else {
  console.log('no "Coach this game" button (bye week)');
}

console.log('\nconsole errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
