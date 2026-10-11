#!/usr/bin/env node
// capture.mjs — before/after evidence for a PR's static site changes.
//
//   node capture.mjs <features.json> <outDir>
//
// For every feature x viewport it produces, under <outDir>/<featureId>/:
//   <vp>-before.png, <vp>-after.png                  viewport screenshots
//   <vp>-before-element.png, <vp>-after-element.png  clipped to the selector (+12px)
//   <vp>-before.webm, <vp>-after.webm                ~4s hover/scroll videos
//   <vp>-boxes.json                                  after-page element boxes -> source lines
// and <outDir>/manifest.json summarizing everything.
//
// Dependencies: playwright 1.55 + Node built-ins only. Playwright is resolved from
// $PLAYWRIGHT_DIR, then the session tooling folder, then this script's own folder.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLING_DIR =
  '/private/tmp/claude-501/-Users-robertnowell-Documents-tranquility-base/3cec67e9-98e4-4489-b02c-ad0b81934142/scratchpad/tooling';

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_DIR, TOOLING_DIR, HERE].filter(Boolean);
  const errors = [];
  for (const dir of candidates) {
    try {
      const req = createRequire(path.join(dir, 'package.json'));
      const pw = req('playwright');
      const version = req('playwright/package.json').version;
      return { chromium: pw.chromium, version, from: dir };
    } catch (e) {
      errors.push(`${dir}: ${e.message.split('\n')[0]}`);
    }
  }
  console.error('capture.mjs: cannot load playwright from any of:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const PAD = 12;
const LOAD_WAIT_MS = 1200;
const VIDEO_LOAD_WAIT_MS = 800;
const VIDEO_TOTAL_MS = 4000;
const HOVER_GAP_MS = 400;
const MAX_HOVER_CHILDREN = 4;

// ---------- helpers ----------

function die(msg) {
  console.error('capture.mjs: ' + msg);
  process.exit(1);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    die(`cannot read JSON ${p}: ${e.message}`);
  }
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function fileUrl(dir, page) {
  return pathToFileURL(path.resolve(dir, page)).href;
}

function pageFor(feature, viewportName) {
  const pages = feature.pages;
  if (typeof pages === 'string') return pages;
  if (pages && typeof pages === 'object') {
    if (pages[viewportName]) return pages[viewportName];
    const first = Object.values(pages)[0];
    if (first) return first;
  }
  return 'index.html';
}

function clampClip(box, vw, vh) {
  const x = Math.max(0, box.x - PAD);
  const y = Math.max(0, box.y - PAD);
  const right = Math.min(vw, box.x + box.width + PAD);
  const bottom = Math.min(vh, box.y + box.height + PAD);
  const w = right - x;
  const h = bottom - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

const errMsg = (e) => String(e && e.message ? e.message.split('\n')[0] : e);

// Lazily read changedFiles (relative to the after dir), cached per feature.
class SourceIndex {
  constructor(afterDir, changedFiles) {
    this.files = [];
    this.missing = [];
    for (const rel of changedFiles || []) {
      const abs = path.resolve(afterDir, rel);
      try {
        this.files.push({ rel, lines: fs.readFileSync(abs, 'utf8').split(/\r?\n/) });
      } catch {
        this.missing.push(rel);
      }
    }
  }
  // First line (in changedFiles order) containing the token. Returns "file:line" or null.
  find(token) {
    if (!token) return null;
    for (const f of this.files) {
      for (let i = 0; i < f.lines.length; i++) {
        if (f.lines[i].includes(token)) return `${f.rel}:${i + 1}`;
      }
    }
    return null;
  }
}

// ---------- browser steps ----------

async function openPage(browser, url, vp) {
  const context = await browser.newContext({
    viewport: { width: vp[0], height: vp[1] },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  return { context, page };
}

// Viewport screenshot + element screenshot (clipped to selector + PAD).
async function captureStills(browser, url, vp, selector, outBase) {
  const result = {
    screenshot: null,
    element: null,
    selectorFound: selector ? false : null,
    elementRect: null,
    error: null,
  };
  let context;
  try {
    const opened = await openPage(browser, url, vp);
    context = opened.context;
    const page = opened.page;
    await page.waitForTimeout(LOAD_WAIT_MS);

    const shotPath = outBase + '.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    result.screenshot = shotPath;

    if (selector) {
      const el = await page.$(selector);
      if (el) {
        result.selectorFound = true;
        // Rect in the same scroll state as the viewport screenshot (top of page).
        const rectAtTop = await el.boundingBox();
        if (rectAtTop) {
          result.elementRect = {
            x: Math.round(rectAtTop.x),
            y: Math.round(rectAtTop.y),
            w: Math.round(rectAtTop.width),
            h: Math.round(rectAtTop.height),
          };
        }
        // Bring it into view for the clipped shot; clip is viewport-relative.
        await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(150);
        const box = await el.boundingBox();
        const clip = box ? clampClip(box, vp[0], vp[1]) : null;
        if (clip) {
          const elPath = outBase + '-element.png';
          await page.screenshot({ path: elPath, clip, fullPage: false });
          result.element = elPath;
        } else {
          result.error = 'selector found but has no visible bounding box';
        }
      }
    }
  } catch (e) {
    result.error = errMsg(e);
  } finally {
    if (context) await context.close().catch(() => {});
  }
  return result;
}

// ~4s video: load, scroll feature into view, hover up to 4 children, small scroll down/back.
async function captureVideo(browser, url, vp, selector, destPath) {
  const tmpDir = path.join(path.dirname(destPath), `.video-tmp-${process.pid}-${Date.now()}`);
  let context;
  let video = null;
  try {
    ensureDir(tmpDir);
    context = await browser.newContext({
      viewport: { width: vp[0], height: vp[1] },
      deviceScaleFactor: 1,
      recordVideo: { dir: tmpDir, size: { width: vp[0], height: vp[1] } },
    });
    const page = await context.newPage();
    video = page.video();
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(VIDEO_LOAD_WAIT_MS);

    const el = selector ? await page.$(selector).catch(() => null) : null;
    if (el) {
      await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(200);
      const children = await el.$$(':scope > *');
      for (const child of children.slice(0, MAX_HOVER_CHILDREN)) {
        await child.hover({ timeout: 1000, force: true }).catch(() => {});
        await page.waitForTimeout(HOVER_GAP_MS);
      }
    }
    await page.mouse.wheel(0, 200).catch(() => {});
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -200).catch(() => {});
    await page.waitForTimeout(400);

    const remaining = VIDEO_TOTAL_MS - (Date.now() - t0);
    if (remaining > 0) await page.waitForTimeout(remaining);

    await context.close();
    context = null;
    if (!video) throw new Error('page.video() returned null');
    await video.saveAs(destPath);
    await video.delete().catch(() => {});
    return { path: destPath, error: null };
  } catch (e) {
    if (context) await context.close().catch(() => {});
    return { path: null, error: errMsg(e) };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// After page: selector element, its direct children, and every [data-src] descendant.
// Rects are viewport-relative at scroll top (same state as <vp>-after.png).
async function collectBoxes(browser, url, vp, selector, sourceIndex) {
  const out = { selectorFound: selector ? false : null, boxes: [], error: null };
  if (!selector) return out;
  let context;
  try {
    const opened = await openPage(browser, url, vp);
    context = opened.context;
    const page = opened.page;
    await page.waitForTimeout(LOAD_WAIT_MS);
    await page.evaluate(() => window.scrollTo(0, 0));

    const raw = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return null;
      const seen = new Set();
      const list = [];
      const push = (el, role) => {
        if (!(el instanceof Element) || seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        list.push({
          role,
          rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          classes: Array.from(el.classList),
          id: el.id || null,
          dataSrc: el.getAttribute('data-src'),
        });
      };
      push(root, 'root');
      for (const c of root.children) push(c, 'child');
      for (const d of root.querySelectorAll('[data-src]')) push(d, 'data-src');
      return list;
    }, selector);

    if (!raw) return out;
    out.selectorFound = true;
    out.boxes = raw.map((b) => {
      let src = b.dataSrc || null;
      let srcMethod = src ? 'data-src' : null;
      if (!src) {
        const token = b.classes[0] || b.id || null;
        src = sourceIndex.find(token);
        srcMethod = src ? 'grep:' + token : null;
      }
      const r = b.rect;
      return {
        rect: r,
        inViewport: r.x < vp[0] && r.y < vp[1] && r.x + r.w > 0 && r.y + r.h > 0,
        tag: b.tag,
        text: b.text,
        classes: b.classes,
        id: b.id,
        role: b.role,
        src,
        srcMethod,
      };
    });
  } catch (e) {
    out.error = errMsg(e);
  } finally {
    if (context) await context.close().catch(() => {});
  }
  return out;
}

// ---------- main ----------

async function main() {
  const [featuresPath, outDir] = process.argv.slice(2);
  if (!featuresPath || !outDir) die('usage: node capture.mjs <features.json> <outDir>');

  const cfg = readJson(path.resolve(featuresPath));
  const beforeDir = path.resolve(cfg.before || '');
  const afterDir = path.resolve(cfg.after || '');
  if (!cfg.before || !fs.existsSync(beforeDir)) die(`before dir missing: ${cfg.before}`);
  if (!cfg.after || !fs.existsSync(afterDir)) die(`after dir missing: ${cfg.after}`);
  const viewports = cfg.viewports || { mobile: [390, 844], desktop: [1440, 900] };
  const features = Array.isArray(cfg.features) ? cfg.features : [];
  if (!features.length) die('features.json has no features');

  const absOut = path.resolve(outDir);
  ensureDir(absOut);
  const rel = (p) => (p ? path.relative(absOut, p).split(path.sep).join('/') : null);

  const { chromium, version: pwVersion, from: pwFrom } = loadPlaywright();

  const runStart = Date.now();
  const manifest = {
    generatedAt: new Date().toISOString(),
    before: beforeDir,
    after: afterDir,
    outDir: absOut,
    viewports: Object.fromEntries(
      Object.entries(viewports).map(([k, v]) => [k, { width: v[0], height: v[1] }])
    ),
    playwright: { version: pwVersion, from: pwFrom, channel: 'chrome' },
    features: [],
    timings: { totalMs: null },
  };

  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const feature of features) {
      const fid = String(feature.id || '').replace(/[^\w.-]+/g, '_') || 'feature';
      const fdir = path.join(absOut, fid);
      ensureDir(fdir);
      const sourceIndex = new SourceIndex(afterDir, feature.changedFiles);
      const fEntry = {
        id: feature.id,
        title: feature.title || feature.id,
        dir: fid,
        beforeSelector: feature.beforeSelector || null,
        afterSelector: feature.afterSelector || null,
        changedFiles: feature.changedFiles || [],
        changedFilesMissing: sourceIndex.missing,
        viewports: {},
        timings: {},
      };
      const fStart = Date.now();

      for (const [vpName, vp] of Object.entries(viewports)) {
        const t0 = Date.now();
        const pageName = pageFor(feature, vpName);
        const beforeUrl = fileUrl(beforeDir, pageName);
        const afterUrl = fileUrl(afterDir, pageName);
        const base = path.join(fdir, vpName);
        const vEntry = {
          size: { width: vp[0], height: vp[1] },
          page: pageName,
          pageExists: {
            before: fs.existsSync(path.resolve(beforeDir, pageName)),
            after: fs.existsSync(path.resolve(afterDir, pageName)),
          },
          before: {},
          after: {},
          boxes: null,
          boxesCount: 0,
          errors: [],
          timings: {},
        };

        const step = async (name, fn) => {
          const s = Date.now();
          try {
            return await fn();
          } finally {
            vEntry.timings[name + 'Ms'] = Date.now() - s;
          }
        };

        // 1. stills
        const bStill = await step('beforeStills', () =>
          captureStills(browser, beforeUrl, vp, feature.beforeSelector, base + '-before')
        );
        const aStill = await step('afterStills', () =>
          captureStills(browser, afterUrl, vp, feature.afterSelector, base + '-after')
        );

        // 2. videos
        const bVid = await step('beforeVideo', () =>
          captureVideo(browser, beforeUrl, vp, feature.beforeSelector, base + '-before.webm')
        );
        const aVid = await step('afterVideo', () =>
          captureVideo(browser, afterUrl, vp, feature.afterSelector, base + '-after.webm')
        );

        // 3. boxes (after page)
        const boxes = await step('boxes', () =>
          collectBoxes(browser, afterUrl, vp, feature.afterSelector, sourceIndex)
        );
        const boxesPath = base + '-boxes.json';
        fs.writeFileSync(
          boxesPath,
          JSON.stringify(
            {
              feature: feature.id,
              viewport: vpName,
              size: { width: vp[0], height: vp[1] },
              page: pageName,
              afterSelector: feature.afterSelector || null,
              selectorFound: boxes.selectorFound,
              screenshot: rel(aStill.screenshot),
              changedFiles: feature.changedFiles || [],
              boxes: boxes.boxes,
              error: boxes.error,
            },
            null,
            2
          )
        );

        vEntry.before = {
          screenshot: rel(bStill.screenshot),
          element: rel(bStill.element),
          selectorFound: bStill.selectorFound,
          elementRect: bStill.elementRect,
          video: bVid.path ? rel(bVid.path) : null,
        };
        vEntry.after = {
          screenshot: rel(aStill.screenshot),
          element: rel(aStill.element),
          selectorFound: aStill.selectorFound,
          elementRect: aStill.elementRect,
          video: aVid.path ? rel(aVid.path) : null,
        };
        vEntry.boxes = rel(boxesPath);
        vEntry.boxesCount = boxes.boxes.length;
        for (const [label, err] of [
          ['before stills', bStill.error],
          ['after stills', aStill.error],
          ['before video', bVid.error],
          ['after video', aVid.error],
          ['boxes', boxes.error],
        ]) {
          if (err) vEntry.errors.push(`${label}: ${err}`);
        }
        vEntry.timings.totalMs = Date.now() - t0;
        fEntry.viewports[vpName] = vEntry;
        console.error(
          `[${feature.id}/${vpName}] ${vEntry.timings.totalMs}ms` +
            (vEntry.errors.length ? ` — ${vEntry.errors.length} issue(s)` : '')
        );
      }
      fEntry.timings.totalMs = Date.now() - fStart;
      manifest.features.push(fEntry);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  manifest.timings.totalMs = Date.now() - runStart;
  const manifestPath = path.join(absOut, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(manifestPath);
}

main().catch((e) => {
  console.error('capture.mjs failed:', e && e.stack ? e.stack : e);
  process.exit(1);
});
