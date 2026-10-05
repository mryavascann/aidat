// Renders scene/index.html frame by frame with headless Chromium and encodes it with ffmpeg.
//
//   node render.mjs stills --format h --times 1,5,9
//   node render.mjs video  --format h --fps 30 --workers 3 --out build/x-16x9.mp4
//
// Playwright is resolved from the global install; set PLAYWRIGHT_MODULE to override.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pwPath = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(pwPath).href);

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const format = opt('format', 'h');
const scale = Number(opt('scale', '1'));
const [W, H] = format === 'v' ? [1080, 1920] : [1920, 1080];
const vw = Math.round(W * scale), vh = Math.round(H * scale);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/scene/index.html`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });

async function frame(page, t) {
  await page.evaluate(t => window.renderAt(t), t);
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
}

if (mode === 'stills') {
  const out = opt('out', path.join(root, 'build', 'stills'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const page = await openPage(browser);
  for (const t of opt('times', '0').split(',').map(Number)) {
    const buf = await frame(page, t);
    const f = path.join(out, `${format}-${t.toFixed(2)}.png`);
    fs.writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
} else if (mode === 'video') {
  const fps = Number(opt('fps', '30'));
  const workers = Number(opt('workers', '3'));
  const out = path.resolve(opt('out', path.join(root, 'build', `video-${format}.mp4`)));
  const tmp = path.join(path.dirname(out), `.seg-${format}`);
  fs.mkdirSync(tmp, { recursive: true });
  const probe = await launch();
  const dur = await (await openPage(probe)).evaluate(() => window.DURATION);
  await probe.close();
  const total = Math.round(dur * fps);
  const per = Math.ceil(total / workers);
  const t0 = Date.now();
  let done = 0;
  const segs = await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per);
    const seg = path.join(tmp, `seg-${w}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv444p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const browser = await launch();
    const page = await openPage(browser);
    for (let i = a; i < b; i++) {
      const buf = await frame(page, i / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      done++;
      if (done % 30 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${format}: ${done}/${total} frames, ${el.toFixed(0)}s elapsed, ~${(el / done * (total - done)).toFixed(0)}s left`);
      }
    }
    ff.stdin.end();
    await new Promise((r, j) => ff.on('close', c => c === 0 ? r() : j(new Error('ffmpeg ' + c))));
    await browser.close();
    return seg;
  }));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  await new Promise((r, j) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
    .on('close', c => c === 0 ? r() : j(new Error('concat ' + c))));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} (${total} frames) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
server.close();
