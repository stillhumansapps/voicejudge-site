// Pull the live App Store listing into the site: screenshots and the star rating.
// Run before tools/build.mjs whenever the listing changes:  node tools/fetch_store.mjs
// The site shows exactly what the store shows, instead of copies that can go stale.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const id = /id(\d+)/.exec(cfg.appStoreUrl)?.[1];
if (!id) throw new Error('No App Store id in site.config.json appStoreUrl');

const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=us`);
if (!res.ok) throw new Error(`App Store lookup failed: HTTP ${res.status}`);
const app = (await res.json()).results?.[0];
if (!app) throw new Error(`App Store id ${id} returned no app`);
if (!app.screenshotUrls?.length) throw new Error('The listing has no iPhone screenshots');

// What each store screenshot shows, by the file name it was uploaded with.
const ALT = {
  '01_hook': 'Make funny dubs with friends: the judge at her neon desk with a gavel',
  '02_home': "Pick a scene: the home screen with tonight's scene and scene packs",
  '03_listen': 'Do the voices: the dub screen with the line to say and a waveform',
  '04_score': 'Get judged: a score with timing, energy and delivery bars',
  '05_board': 'Share the laughs: the judge celebrates next to a glowing microphone',
};

const dir = join(ROOT, 'assets/img/shots');
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) rmSync(join(dir, f));

const shots = [];
for (const [i, url] of app.screenshotUrls.entries()) {
  // .../<uploaded name>.png/<size>bb.jpg : ask the image server for a 600px wide WebP instead.
  const base = url.replace(/\/[^/]+$/, '');
  const name = /\/([^/]+)\.(png|jpe?g)$/i.exec(base)?.[1] ?? `shot_${i + 1}`;
  const img = await fetch(`${base}/600x1300bb.webp`);
  if (!img.ok) throw new Error(`Screenshot ${i + 1} failed: HTTP ${img.status}`);
  const file = `${String(i + 1).padStart(2, '0')}.webp`;
  writeFileSync(join(dir, file), Buffer.from(await img.arrayBuffer()));
  shots.push({ file, alt: ALT[name] ?? `Voice Judge screenshot ${i + 1}` });
}

const store = {
  appStoreId: id,
  version: app.version,
  rating: app.averageUserRating ? Math.round(app.averageUserRating * 10) / 10 : null,
  ratingCount: app.userRatingCount ?? 0,
  shots,
  fetchedAt: new Date().toISOString().slice(0, 10),
};
writeFileSync(join(ROOT, 'data/store.json'), JSON.stringify(store, null, 2) + '\n');
console.log(`store: ${shots.length} screenshots, rating ${store.rating} (${store.ratingCount}), version ${store.version}`);
