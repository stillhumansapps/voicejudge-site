# voicejudge.app

Static marketing site for **Voice Judge** (iOS + Android), hosted on GitHub Pages at
`https://voicejudge.app`. Plain HTML/CSS/vanilla JS. No build step runs on the host:
every page is committed.

## What is here

| Path | What |
|------|------|
| `index.html` | Landing page (generated from `src/index.html`) |
| `c/<id>/index.html` | Challenge pages, one per catalog scene (generated) |
| `get/index.html` | `voicejudge.app/get`: one "get the app" link for every device (generated). A phone goes straight to its own store; a computer sees both stores and a QR code. On phones the challenge pages show one "Get the app" button in place of the two store badges |
| `404.html` | Friendly not-found page. Also fixes the case of challenge links (`/c/k3` -> `/c/K3/`); sends room invites `/j/482915` to `/j/?code=482915` |
| `j/index.html` | Online room invite page (hand-written, not generated; ported from the app repo's `firebase/hosting/public/join.html`). With the app installed, `/j/CODE` opens the app instead |
| `.well-known/assetlinks.json` | Android App Links |
| `.well-known/apple-app-site-association` | iOS universal links |
| `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml` | Hosting files |
| `assets/` | CSS, JS, self-hosted Baloo 2 heading font (woff2, OFL licence in `assets/fonts/OFL-Baloo2.txt`), images, hero video |
| `data/scenes.json` | Scene catalog copied from the app repo (input for the generator) |
| `site.config.json` | Store URLs, legal links, support email: the one place to change them |
| `tools/build.mjs` | Page generator (Node 18+, no dependencies) |
| `tools/qr.mjs` | Tiny QR encoder used for the desktop QR on challenge pages |
| `tools/prepare_assets.py` | Copies and optimizes art, screenshots, scene stills, OG images and video from the app repo |

## Regenerate pages

After editing `src/index.html`, `site.config.json` or `data/scenes.json`:

```sh
node tools/build.mjs
```

When the app's scene catalog or art changes, refresh the assets and catalog first
(needs Pillow with WebP/AVIF, fontTools, brotli and ffmpeg):

```sh
python3 -m venv .venv && .venv/bin/pip install pillow fonttools brotli
.venv/bin/python tools/prepare_assets.py ../voice-judge
node tools/build.mjs
```

The catalog comes from two places in the app repo:

- `scene_packs/pets_scenes.json` + `scene_packs/remote/catalog.json`: the remote "Pets Talk Back"
  pack. These scenes have a short code (`K3`) and an app id (`closed_door`); both get a page,
  the short code is canonical.
- `shared/src/commonMain/composeResources/files/scenes/packs.json`: the bundled packs. These
  scenes only have the app id (`/c/last_stand`).

### Challenge links

- `/c/<id>` shows the scene, "Can you beat them?", store buttons (App Store first on iOS,
  Google Play first on Android, both plus a QR code on desktop) and an
  "Already have the app? Open the scene" button whose href is the same https URL.
- `?s=<0-100>` shows "They scored N. Beat it." Anything else is ignored.
- Wrong case or a trailing dot (`/c/k3`, `/c/K3.`) is fixed by `404.html`, which redirects to
  the real page. GitHub Pages is case-sensitive and macOS disks usually are not, so only one
  folder per id exists.
- `/?scene=<id>` (the app's current caption link format) redirects to that challenge page.

## Deploy to GitHub Pages

1. Create a GitHub repo and push this folder (branch `main`).
2. Repo Settings > Pages: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Custom domain: `voicejudge.app` (the `CNAME` file already contains it). Tick "Enforce HTTPS"
   once the certificate is issued.
4. Recommended: verify the domain for your account or org (Settings > Pages > Verified domains)
   so nobody else can claim it.

DNS records at the registrar (source: GitHub docs, "Managing a custom domain for your GitHub
Pages site"):

| Type | Name | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<your-user-or-org>.github.io` (no repo name) |

GitHub then redirects `www.voicejudge.app` to `voicejudge.app`.

## App links: what the apps need

- **iOS**: add the Associated Domains capability with `applinks:voicejudge.app`. The AASA file
  lists `89T79RTJ37.com.mindblows.voicejudge` for `/c/*` (modern `components` and legacy
  `paths` format). Apple requires https and no redirects. GitHub Pages cannot set headers and
  serves the extensionless file as `application/octet-stream`; Apple's docs do not require a
  content type, but check after deploy:
  `curl -sI https://voicejudge.app/.well-known/apple-app-site-association` and
  `https://app-site-association.cdn-apple.com/a/v1/voicejudge.app`.
- **Android**: add an `autoVerify` intent filter for `https://voicejudge.app/c/*`, and put the
  SHA-256 fingerprint of the **Play app signing key** (Play Console > Setup > App signing) in
  `.well-known/assetlinks.json`. Check with
  `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://voicejudge.app&relation=delegate_permission/common.handle_all_urls`.
- Note: tapping "Open the scene" on the challenge page itself will not open the app on iOS
  (Safari does not hand same-site links to the app). The link in the shared video's caption,
  tapped from another app, will.

## Placeholders left

- `.well-known/assetlinks.json`: `REPLACE_WITH_SHA256` (not in the app repo; take it from Play Console).
- `site.config.json`: App Store id `6801482202` comes from the app's `app_spec.json`; confirm
  it is the live listing.
- The apps still use `AppConfig.SHARE_URL = https://mindblows.com/apps/voice-judge`; switch it
  to `https://voicejudge.app/c/<id>` once the domain is live.

## App Store screenshots and rating

The "Inside the app" screenshots and the star rating in the hero come from the live App Store
listing, not from files in the app repo:

    node tools/fetch_store.mjs   # downloads the screenshots, writes data/store.json
    node tools/build.mjs

A GitHub Actions job (`.github/workflows/store-sync.yml`) runs both once a day and commits only
when the listing changed; run them by hand to pick up a change sooner. The rating only shows when it is 4.0 or higher with at
least 20 ratings.
