// mutate.js <before.html> <after.html> <w> <h>: apply the PR to a frozen page in the DOM: the live strip becomes the sport-grouped scoreboard mount; drop <base>.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [inp, out, w, h] = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  await page.goto('file://' + inp); await page.waitForTimeout(500);
  const html = await page.evaluate(() => {
    document.querySelector('base')?.remove();
    // remove the top strip and the 89px header slot that held it; mount the dock at the end of the body
    const strip = document.querySelector('.r-lltvgl');
    let slot = strip; for (let e = strip, i = 0; e && i < 4; e = e.parentElement, i++) { if (Math.round(e.getBoundingClientRect().height) === 89) slot = e; }
    slot.remove();
    const mount = document.createElement('div'); mount.id = 'live-scoreboard'; mount.className = 'sb'; mount.setAttribute('aria-label', 'Live games by sport'); mount.setAttribute('data-src', 'index.html:0');
    // desktop: a fixed dock at the bottom of the window. mobile: a row in the bottom column, between the search box and the Home / Portfolio / Ranks tabs
    const ranks = [...document.querySelectorAll('div[dir="auto"]')].find(d => d.textContent.trim() === 'Ranks');
    let tabs = null; if (innerWidth < 480 && ranks) { let e = ranks; while (e && e !== document.body) { const b = e.getBoundingClientRect(); if (Math.round(b.width) >= innerWidth - 1 && b.height > 60 && b.height < 100 && b.bottom >= innerHeight - 2) { tabs = e; break; } e = e.parentElement; } }
    if (tabs) tabs.parentElement.insertBefore(mount, tabs); else document.body.appendChild(mount);
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'scoreboard/scoreboard.css'; document.head.appendChild(link);
    const s1 = document.createElement('script'); s1.src = 'scoreboard/games.js'; document.body.appendChild(s1);
    const s2 = document.createElement('script'); s2.src = 'scoreboard/scoreboard.js'; document.body.appendChild(s2);
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });
  fs.writeFileSync(out, html);
  await browser.close(); console.log('wrote', out, html.length);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
