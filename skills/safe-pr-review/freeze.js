// freeze.js <url> <out.html> <width> <height>: a static, script-free snapshot of a rendered page with its runtime CSS inlined.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [url, out, w, h] = [process.argv[2], process.argv[3], +process.argv[4] || 1440, +process.argv[5] || 900];
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  for (let i=0;i<12;i++){ if (!/Human Verification/.test(await page.title())) break; await page.waitForTimeout(2500);} await page.waitForTimeout(3000);
  const html = await page.evaluate(() => {
    const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };
    // 1. serialize every stylesheet rule the page has (runtime-injected included)
    let css = '';
    for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) css += r.cssText + '\n'; } catch (e) { if (sh.href) css += `@import url("${sh.href}");\n`; } }
    css = css.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (m, q, p) => `url("${abs(p)}")`);
    // 2. absolutize src/href/srcset
    for (const el of document.querySelectorAll('[src]')) el.setAttribute('src', abs(el.getAttribute('src')));
    for (const el of document.querySelectorAll('[srcset]')) el.removeAttribute('srcset');
    for (const el of document.querySelectorAll('link[href]')) el.setAttribute('href', abs(el.getAttribute('href')));
    for (const el of document.querySelectorAll('a[href]')) el.setAttribute('href', abs(el.getAttribute('href')));
    for (const el of document.querySelectorAll('[style*="url("]')) el.setAttribute('style', el.getAttribute('style').replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (m, q, p) => `url("${abs(p)}")`));
    // 3. drop scripts and existing stylesheet links/styles, add one frozen style
    document.querySelectorAll('script, link[rel=stylesheet], style, link[rel=preload], link[rel=modulepreload]').forEach(e => e.remove());
    const st = document.createElement('style'); st.id = 'frozen-css'; st.textContent = css; document.head.appendChild(st);
    const base = document.createElement('base'); base.href = location.href; document.head.prepend(base);
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });
  fs.writeFileSync(out, html);
  console.log('wrote', out, html.length, 'bytes; title:', await page.title());
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
