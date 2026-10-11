// gates.js <before-dir> <after-dir> <repo-dir> <base> <head> <out.json>: the machine checks for a static-site PR. A check that cannot run is reported as not_run, never pass.
const { chromium } = require('playwright'); const fs = require('fs'); const { execSync } = require('child_process'); const { PNG } = (() => { try { return require('pngjs'); } catch { return {}; } })();
(async () => {
  const [before, after, repo, base, head, out] = process.argv.slice(2);
  const gates = [];
  // 1 scope: every changed file sits under the PR's declared area
  try { const files = execSync(`git -C ${repo} diff --name-only ${base}..${head}`).toString().trim().split('\n'); const outside = files.filter(f => !f.startsWith('demo/novig/')); gates.push({ id: 'scope', state: outside.length ? 'fail' : 'pass', detail: `${files.length} files, ${outside.length} outside demo/novig/` }); } catch (e) { gates.push({ id: 'scope', state: 'not_run', detail: e.message.slice(0, 80) }); }
  const browser = await chromium.launch({ channel: 'chrome' });
  // 2 console errors on the changed pages, after vs before
  for (const page of ['index.html', 'index.mobile.html']) {
    const count = async (dir) => { const ctx = await browser.newContext({ viewport: page.includes('mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 } }); const p = await ctx.newPage(); let n = 0; const seen = []; p.on('pageerror', e => { n++; seen.push(String(e.message).slice(0, 80)); }); p.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|favicon|net::/.test(m.text())) { n++; seen.push(m.text().slice(0, 80)); } }); await p.goto('file://' + dir + '/' + page); await p.waitForTimeout(1500); await ctx.close(); return { n, seen }; };
    const b = await count(before), a = await count(after);
    gates.push({ id: 'console:' + page, state: a.n > b.n ? 'fail' : 'pass', detail: `after ${a.n} errors, before ${b.n}${a.seen.length ? ' · ' + a.seen[0] : ''}` });
  }
  // 3 untouched region: pixels below the header on the desktop page, before vs after
  try {
    // the PR moves the strip from the top to a bottom dock: compare the same content region, below the old header before and from the top after, above the dock
    const SHIFT = +(process.env.SHIFT || 0), DOCK = +(process.env.DOCK || 0); const H = 900 - 95 - DOCK;
    const shot = async (dir, y) => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); const p = await ctx.newPage(); await p.goto('file://' + dir + '/index.html'); await p.waitForTimeout(1500); const buf = await p.screenshot({ clip: { x: 0, y, width: 1440, height: H } }); await ctx.close(); return buf; };
    const b = await shot(before, 95), a = await shot(after, 95 - SHIFT);
    if (PNG) { const pb = PNG.sync.read(b), pa = PNG.sync.read(a); let diff = 0; for (let i = 0; i < pb.data.length; i += 4) { if (Math.abs(pb.data[i] - pa.data[i]) + Math.abs(pb.data[i+1] - pa.data[i+1]) + Math.abs(pb.data[i+2] - pa.data[i+2]) > 30) diff++; } const pct = diff / (pb.width * pb.height) * 100; gates.push({ id: 'untouched-region', state: pct < 0.5 ? 'pass' : 'fail', detail: `${pct.toFixed(2)}% of pixels in the page content differ (threshold 0.5%)` }); }
    else gates.push({ id: 'untouched-region', state: 'not_run', detail: 'pngjs not installed' });
  } catch (e) { gates.push({ id: 'untouched-region', state: 'not_run', detail: e.message.slice(0, 80) }); }
  // 4 the board renders at both widths with the expected shape
  for (const [page, vp] of [['index.html', { width: 1440, height: 900 }], ['index.mobile.html', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp }); const p = await ctx.newPage(); await p.goto('file://' + after + '/' + page); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const groups = [...document.querySelectorAll('#live-scoreboard .sb-sport')]; return { groups: groups.length, maxCards: Math.max(...groups.map(g => g.querySelectorAll('.sb-game').length)), actions: document.querySelectorAll('#live-scoreboard .sb-action .sb-trade').length, cards: document.querySelectorAll('#live-scoreboard .sb-game').length, overflow: (() => { const b = document.querySelector('#live-scoreboard'); const r = b.getBoundingClientRect(); return r.height > 95 || r.bottom > innerHeight + 1; })() }; });
    await ctx.close();
    gates.push({ id: 'renders:' + page, state: r.groups > 0 && r.maxCards <= 3 && r.actions === r.cards && !r.overflow ? 'pass' : 'fail', detail: `${r.groups} sports, max ${r.maxCards} cards per sport, ${r.actions}/${r.cards} cards with a Trade action${r.overflow ? ', board taller than its slot' : ''}` });
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), base, head, gates }, null, 1)); console.log(JSON.stringify(gates, null, 1));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
