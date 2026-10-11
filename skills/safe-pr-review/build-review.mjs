// build-review.mjs <review.json> <manifest.json> <outDir>
// Inlines the review description (goal, architecture, risks, checks, features) and the capture manifest into one static page, copying evidence and before/after sites beside it.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [reviewPath, manifestPath, outDir] = process.argv.slice(2);
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const evDir = path.dirname(manifestPath);
fs.mkdirSync(outDir, { recursive: true });
const cpDir = (src, dst) => { fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true }); };
cpDir(manifest.before, path.join(outDir, 'before')); cpDir(manifest.after, path.join(outDir, 'after'));
fs.rmSync(path.join(outDir, 'evidence'), { recursive: true, force: true }); fs.cpSync(evDir, path.join(outDir, 'evidence'), { recursive: true });
const sizeOf = (p) => { try { const b = fs.readFileSync(p); if (b.toString('ascii', 1, 4) !== 'PNG') return null; return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; } catch { return null; } };
const features = review.features.map((f) => {
  const m = manifest.features.find((x) => x.id === f.id); if (!m) throw new Error('no capture for feature ' + f.id);
  const viewports = {};
  for (const [vp, v] of Object.entries(m.viewports)) {
    const page = typeof m.pages === 'string' ? m.pages : (v.page || f.page);
    const boxes = v.boxes ? JSON.parse(fs.readFileSync(path.join(evDir, v.boxes), 'utf8')) : [];
    const pick = (side) => {
      // a feature that is a small part of the page is shown as its crop (element box + 12px, as capture.mjs cut it); otherwise the viewport shot
      const r = side.elementRect; const small = !f.full && side.element && r && r.h < v.size.height * 0.45;
      if (small) { const x0 = Math.max(0, r.x - 12), y0 = Math.max(0, r.y - 12); return { screenshot: 'evidence/' + side.element, screenshotSize: sizeOf(path.join(evDir, side.element)), offset: { x: x0, y: y0 } }; }
      return { screenshot: side.screenshot && 'evidence/' + side.screenshot, screenshotSize: side.screenshot ? sizeOf(path.join(evDir, side.screenshot)) : null };
    };
    viewports[vp] = { size: v.size, page,
      before: { ...pick(v.before), video: v.before.video && 'evidence/' + v.before.video, live: 'before/' + page },
      after: { ...pick(v.after), video: v.after.video && 'evidence/' + v.after.video, live: 'after/' + page, boxes: Array.isArray(boxes) ? boxes : (boxes.boxes || []) } };
  }
  return { ...f, viewports };
});
const data = { ...review, features, generatedAt: new Date().toISOString() };
const tplName = process.env.SPR_TEMPLATE || 'template-page.html';
const fonts = fs.existsSync(path.join(here, 'fonts.css')) ? fs.readFileSync(path.join(here, 'fonts.css'), 'utf8') : '';
const tpl = fs.readFileSync(path.join(here, tplName), 'utf8').replace('/*FONTS*/', fonts);
fs.writeFileSync(path.join(outDir, 'index.html'), tpl.replace('/*DATA*/', JSON.stringify(data).replace(/<\//g, '<\\/')));
console.log('review written:', path.join(outDir, 'index.html'), 'features:', features.length);
