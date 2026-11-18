#!/usr/bin/env node
// Builds the static site from site.config.json, data/scenes.json and src/index.html.
// No dependencies:  node tools/build.mjs
// Writes: index.html, c/<id>/index.html, 404.html, sitemap.xml
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qrSvg } from './qr.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const scenes = JSON.parse(readFileSync(join(ROOT, 'data/scenes.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');
const YEAR = new Date().getFullYear();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Judge lines from the app's share design (docs/share-mockups/share-judge-lines.md, final mix, English).
const JUDGE_LINES = [
  'Hollywood called. I gave them your number.',
  'My wig flew off. Worth it.',
  'I clapped so hard I broke my gavel.',
  "Illegal levels of talent. I'm calling someone.",
  'The real actor just got nervous.',
  'My goldfish gave it a standing ovation.',
  "So close to perfect it's rude.",
  'This voice belongs on a cereal box.',
  'I laughed, I cried, I ate my notes.',
  'Acting so good my chair fainted.',
  'The script said words. You said vibes.',
  'Not what the script said. Better? Maybe.',
  'Half acting, half sneeze. I loved it.',
  "I don't know what that was. More, please.",
  'Bold choices. I respect every one.',
  'Was that a line or a sandwich order?',
  'The words left. The confidence stayed.',
  'Chaos. Beautiful, beautiful chaos.',
  'My ears filed a complaint. I ignored it.',
  'Zero script. Full legend.',
];

// ---------- shared partials ----------
const APPLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.52zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#00d2ff" d="M3.6 2.2 13.5 12l-9.9 9.8c-.3-.2-.5-.6-.5-1.1V3.3c0-.5.2-.9.5-1.1z"/><path fill="#00f076" d="M3.6 2.2 13.5 12l3.1-3.1L5.2 2.4c-.6-.4-1.2-.4-1.6-.2z"/><path fill="#ff3a44" d="M3.6 21.8 13.5 12l3.1 3.1-11.4 6.5c-.6.4-1.2.4-1.6.2z"/><path fill="#ffd500" d="M16.6 8.9 13.5 12l3.1 3.1 3.7-2.1c.8-.5.8-1.5 0-2z"/></svg>';

const stores = (extraClass = '') => `<div class="stores ${extraClass}">
  <a class="store apple" href="${esc(cfg.appStoreUrl)}" rel="noopener">${APPLE_SVG}<span><small>Download on the</small><strong>App Store</strong></span></a>
  <a class="store google" href="${esc(cfg.playStoreUrl)}" rel="noopener">${PLAY_SVG}<span><small>GET IT ON</small><strong>Google Play</strong></span></a>
</div>`;

const header = (withNav) => `<a class="skip" href="#main">Skip to content</a>
<header class="bar">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Voice Judge home"><img src="/assets/img/icon-256.webp" width="36" height="36" alt="">VOICE <b>JUDGE</b></a>
    <nav aria-label="Main">
      ${withNav ? '<a class="link" href="#how">How it works</a><a class="link" href="#features">Features</a><a class="link" href="#challenge">Challenge</a>' : ''}
      <a class="pill" href="${withNav ? '#get' : '/#get'}">Get the app</a>
    </nav>
  </div>
</header>`;

const footer = () => `<footer class="foot">
  <div class="wrap">
    <a class="brand" href="/"><img src="/assets/img/icon-256.webp" width="36" height="36" alt="" loading="lazy">VOICE <b>JUDGE</b></a>
    <nav aria-label="Legal">
      <a href="${esc(cfg.termsUrl)}" rel="noopener">Terms</a>
      <a href="${esc(cfg.privacyUrl)}" rel="noopener">Privacy</a>
      <a href="mailto:${esc(cfg.supportEmail)}">Support</a>
    </nav>
    <p>&copy; ${YEAR} Voice Judge by <a href="${esc(cfg.companyUrl)}" rel="noopener">${esc(cfg.companyName)}</a></p>
  </div>
</footer>`;

const head = ({ title, description, path, image, imageAlt, robots = 'index,follow', canonical = true }) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#6A3FE0">
<meta name="color-scheme" content="dark">
<meta name="darkreader-lock">
${canonical ? `<link rel="canonical" href="${SITE}${path}">` : ''}
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/baloo2-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css?v=7">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Voice Judge">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}${image}">
<script>document.documentElement.classList.add('js')</script>`;

// Canonical public id: the scene's short code (K3). Every scene has one; the app burns
// voicejudge.app/<code> into shared videos, so codes never change once released.
const publicId = (s) => s.code;
for (const s of scenes) if (!/^[A-Z][0-9]{1,2}$/.test(s.code || '')) throw new Error(`Scene ${s.id} needs a short code like K3`);
// Every lowercase alias -> real page folder. 404.html uses it to fix the case of typed links.
const aliasMap = {};
for (const s of scenes) {
  aliasMap[s.id.toLowerCase()] = s.code;
  aliasMap[s.code.toLowerCase()] = s.code;
}

// ---------- challenge page ----------
function challengePage(s, folder) {
  const pid = publicId(s);
  const url = `${SITE}/${pid}`;
  const title = `Can you beat my dub? ${s.title} | Voice Judge`;
  const description = `Your friend dubbed "${s.title}" in Voice Judge. Download the free party game, dub the same scene and see if the judge scores you higher.`;
  const qr = qrSvg(url, { label: `QR code that opens ${url}` });
  const line = JUDGE_LINES[[...s.id].reduce((a, c) => a + c.charCodeAt(0), 0) % JUDGE_LINES.length];
  return `<!doctype html>
<html lang="en">
<head>
${head({ title, description, path: `/${pid}/`, image: `/assets/img/og/${s.id}.jpg`, imageAlt: `${s.title}: a scene from Voice Judge. Can you beat me?` })}
</head>
<body class="stage">
${header(false)}
<main id="main" class="ch">
  <div class="wrap">
    <section aria-label="The scene">
      <figure class="ch-scene" style="margin:0">
        <img src="/assets/img/scenes/${s.id}.webp" width="960" height="540" alt="Still from the scene ${esc(s.title)}${s.characters ? ` with ${esc(s.characters)}` : ''}" fetchpriority="high">
        <span class="ch-chip">${esc(s.pack)}</span>
        <figcaption class="cap"><strong>${esc(s.title)}</strong>${s.characters ? `<small>Starring ${esc(s.characters)}</small>` : ''}</figcaption>
      </figure>
      ${s.note ? `<p class="ch-note"><b>Director's note:</b> ${esc(s.note)}</p>` : ''}
      <div class="ch-judge desk"><picture><source srcset="/assets/img/judge/cheer-sm.webp" type="image/webp"><img src="/assets/img/judge/cheer-sm.webp" width="226" height="360" alt="The Voice Judge, a blue-haired judge with headphones and a gavel, cheering" loading="lazy"></picture><p>&ldquo;${esc(line)}&rdquo;</p></div>
    </section>
    <section aria-labelledby="ch-title">
      <h1 id="ch-title">Your friend dubbed this scene. <em>Can you beat them?</em></h1>
      <p class="sub">Get Voice Judge, play <b>${esc(s.title)}</b>, and let the judge decide who wins.</p>
      <p class="beat-score" data-beat aria-live="polite">They scored <b>0</b>. Beat it.</p>
      ${stores()}
      <!-- Universal link / App Link hook: this is the same https URL. Once the iOS app has
           "applinks:voicejudge.app" and the Android app has a verified intent filter for
           the short links (https://voicejudge.app/K3), opening this link on a phone with the app goes to the scene.
           No custom URL scheme on purpose. -->
      <a class="pill ghost big open-app" href="${url}" data-app-link data-scene="${esc(s.id)}">Already have the app? Open the scene</a>
      <div class="qr-box">${qr}<p><b>On a computer?</b>Scan with your phone camera to open this challenge there.</p></div>
      <ol class="mini-steps" aria-label="How it works">
        <li><b>1</b>Watch the scene, then the original voice is muted.</li>
        <li><b>2</b>Perform the lines with your own voice.</li>
        <li><b>3</b>The judge scores your timing, words and delivery.</li>
      </ol>
      <div class="ch-judge mob"><picture><source srcset="/assets/img/judge/point-sm.webp" type="image/webp"><img src="/assets/img/judge/point-sm.webp" width="212" height="360" alt="The Voice Judge, a blue-haired judge with headphones and a gavel, pointing at you" loading="lazy"></picture><p>&ldquo;${esc(line)}&rdquo;</p></div>
    </section>
  </div>
</main>
${footer()}
<script src="/assets/js/site.js?v=6" defer></script>
</body>
</html>
`;
}

// ---------- 404 ----------
function notFoundPage() {
  return `<!doctype html>
<html lang="en">
<head>
${head({ title: 'Scene not found | Voice Judge', description: 'This page is not here, but the party is. Get Voice Judge and dub a scene.', path: '/404', image: '/assets/img/og/og-main.jpg', imageAlt: 'Voice Judge: dub the scene, get judged', robots: 'noindex', canonical: false })}
<script>
// Links typed from a video may have the wrong case (/k3), a trailing dot, or the old /c/ form
// with a scene id (/c/closed_door). GitHub Pages is case-sensitive, so find the real page.
(function () {
  var map = ${JSON.stringify(aliasMap)};
  var m = /^\\/(?:c\\/)?([^\\/]+)\\/?$/i.exec(location.pathname);
  if (!m) return;
  var key = decodeURIComponent(m[1]).toLowerCase().replace(/[^a-z0-9_-]+$/, '');
  var hit = map[key];
  if (hit) location.replace('/' + hit + '/' + location.search);
})();
// Online room invites from the app: /j/482915. GitHub Pages has no rewrites, so the invite page lives at /j/
// and gets the code as ?code=. (With the app installed, the phone opens the app before this page loads.)
(function () {
  var m = /^\\/j\\/([^\\/?#]+)\\/?$/.exec(location.pathname);
  if (m) location.replace('/j/?code=' + encodeURIComponent(m[1]));
})();
</script>
</head>
<body class="stage">
${header(false)}
<main id="main" class="lost">
  <div class="wrap">
    <img src="/assets/img/judge/listen-sm.webp" width="185" height="360" alt="The Voice Judge listening with her headphones on">
    <h1>Objection! Page not found.</h1>
    <p>The judge listened very carefully, but this page isn't here. The scene link may have a typo. The game is still on, though.</p>
    ${stores()}
    <p style="margin-top:22px"><a class="pill ghost" href="/">Go to the home page</a></p>
  </div>
</main>
${footer()}
<script src="/assets/js/site.js?v=6" defer></script>
</body>
</html>
`;
}

// ---------- landing ----------
function landing() {
  const tpl = readFileSync(join(ROOT, 'src/index.html'), 'utf8');
  const packs = [...new Set(scenes.map((s) => s.pack))];
  // Rail: one scene from each pack first, then the rest; links go to the challenge pages.
  const firsts = packs.map((p) => scenes.find((s) => s.pack === p));
  const rail = [...firsts, ...scenes.filter((s) => !firsts.includes(s))].slice(0, 14);
  const railHtml = rail.map((s) => `<li><a class="scene-card" href="/${publicId(s)}/"><img src="/assets/img/scenes/${s.id}-sm.webp" width="480" height="270" alt="${esc(s.title)}" loading="lazy" decoding="async"><div><strong>${esc(s.title)}</strong><small>${esc(s.pack)}</small></div></a></li>`).join('\n');
  const quotes = JUDGE_LINES.map((q) => `<li>${esc(q)}</li>`).join('');
  const quotesDup = JUDGE_LINES.map((q) => `<li aria-hidden="true">${esc(q)}</li>`).join('');
  const sceneLookup = JSON.stringify(aliasMap);
  // Screenshots and rating come from the live App Store listing (tools/fetch_store.mjs).
  const store = JSON.parse(readFileSync(join(ROOT, 'data/store.json'), 'utf8'));
  const shotsHtml = store.shots.map((sh) => `      <li><img src="/assets/img/shots/${sh.file}?v=${store.fetchedAt}" width="600" height="1299" alt="${esc(sh.alt)}" loading="lazy" decoding="async"></li>`).join('\n');
  // Only show a rating the store really has, and only a good one.
  const ratingHtml = store.rating >= 4 && store.ratingCount >= 20
    ? `      <p class="rating"><span class="stars" style="--r:${store.rating}" aria-hidden="true">★★★★★</span><b>${store.rating.toFixed(1)}</b> on the App Store<small>${store.ratingCount} ratings</small></p>\n`
    : '';
  const vars = {
    HEAD: head({
      title: 'Voice Judge: Dub the Scene, Get Judged | Party Game for iPhone & Android',
      description: 'Voice Judge is the party game where you dub funny scenes with your own voice and a sassy judge scores your timing, words and delivery. Pass the phone, up to 4 players.',
      path: '/', image: '/assets/img/og/og-main.jpg', imageAlt: 'Voice Judge: dub the scene, get judged. The judge character swings her gavel.',
    }),
    HEADER: header(true),
    FOOTER: footer(),
    STORES: stores(),
    SCENE_COUNT: String(scenes.length),
    PACK_COUNT: String(packs.length),
    PACK_CHIPS: packs.map((p) => `<span>${esc(p)}</span>`).join(''),
    SCENE_RAIL: railHtml,
    QUOTES: quotes + quotesDup,
    HERO_QUOTES: esc(JSON.stringify(JUDGE_LINES.slice(5, 12))),
    SCENE_LOOKUP: sceneLookup,
    SHOTS: shotsHtml,
    RATING: ratingHtml,
    SUPPORT: esc(cfg.supportEmail),
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Unknown template var ${k}`);
    return vars[k];
  });
}

// ---------- write ----------
// The short link /K3/ is the page. The old /c/K3/ and /c/<scene id>/ links (in videos shared
// before the short links) get the same page, so they keep working.
const cDir = join(ROOT, 'c');
if (existsSync(cDir)) rmSync(cDir, { recursive: true });
for (const f of readdirSync(ROOT)) {
  if (/^[A-Z][0-9]{1,2}$/.test(f)) rmSync(join(ROOT, f), { recursive: true });
}
let pages = 0;
for (const s of scenes) {
  for (const dir of [join(ROOT, s.code), join(cDir, s.code), join(cDir, s.id)]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), challengePage(s));
    pages++;
  }
}
writeFileSync(join(ROOT, '404.html'), notFoundPage());

// Universal links (iOS): invites (/j/CODE) and challenge links (/K3, the older /c/...) open the app.
// One path per short code, so the site's other pages stay in Safari. The Android app lists the
// same paths in its App Link filter; assetlinks.json is domain-wide.
const appId = '89T79RTJ37.com.mindblows.voicejudge';
const challengePaths = scenes.flatMap((s) => [`/${s.code}`, `/${s.code}/`]);
const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: [appId],
        components: [
          { '/': '/j/*', comment: 'Online room invite: /j/ROOMCODE opens the app on the room' },
          ...challengePaths.map((path) => ({ '/': path, comment: 'Challenge link from a shared dub video' })),
          { '/': '/c/*', comment: 'Older challenge links: /c/K3 or /c/<scene id>' },
        ],
      },
      { appID: appId, paths: ['/j/*', ...challengePaths, '/c/*'] },
    ],
  },
};
writeFileSync(join(ROOT, '.well-known/apple-app-site-association'), JSON.stringify(aasa, null, 2) + '\n');
writeFileSync(join(ROOT, 'index.html'), landing());

const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...scenes.map((s) => `/${publicId(s)}/`)];
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
console.log(`built: index.html, 404.html, sitemap.xml, ${pages} challenge pages for ${scenes.length} scenes`);
