#!/usr/bin/env python3
"""Copy and optimize assets from the Voice Judge app repo into this site.

Run only when the app's art, screenshots or scene catalog change. The outputs are
committed, so GitHub Pages never runs this.

    python3 -m venv .venv && .venv/bin/pip install pillow fonttools brotli
    .venv/bin/python tools/prepare_assets.py /path/to/voice-judge

Needs: Pillow (with WebP + AVIF), fontTools + brotli (woff2), ffmpeg on PATH.
Writes: assets/img/**, assets/fonts/*.woff2, assets/video/*, data/scenes.json,
favicon files at the site root.
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SITE = Path(__file__).resolve().parent.parent
APP = Path(sys.argv[1] if len(sys.argv) > 1 else SITE.parent / "voice-judge").resolve()
IMG = SITE / "assets" / "img"
FONTS = SITE / "assets" / "fonts"
VIDEO = SITE / "assets" / "video"
DATA = SITE / "data"
for d in (IMG / "judge", IMG / "shots", IMG / "scenes", IMG / "og", FONTS, VIDEO, DATA):
    d.mkdir(parents=True, exist_ok=True)

BG_DEEP = (7, 8, 26)
BG_MID = (19, 12, 51)
PINK = (255, 61, 138)
GOLD = (255, 213, 79)
VIOLET = (123, 92, 255)


def fit_w(im, w):
    return im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def fit_h(im, h):
    return im if im.height <= h else im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def save_webp(im, path, q=80):
    im.save(path, "WEBP", quality=q, method=6)


def save_avif(im, path, q=55):
    im.save(path, "AVIF", quality=q)


# ---------- fonts: Unbounded subset to basic Latin -> woff2 ----------
def fonts():
    from fontTools import subset

    src = APP / "shared/src/commonMain/composeResources/font"
    text = "".join(chr(c) for c in range(0x20, 0x7F)) + "’‘“”–—…·×•©™"
    for name, out in (("unbounded_extrabold.ttf", "unbounded-800.woff2"), ("unbounded_semibold.ttf", "unbounded-600.woff2")):
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["kern", "liga"]
        opts.name_IDs = ["*"]
        font = subset.load_font(str(src / name), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        subset.save_font(font, str(FONTS / out), opts)


# ---------- judge character ----------
def judge():
    poses = APP / "branding/character/poses"
    for pose in ("cheer", "listen", "point", "verdict"):
        im = Image.open(poses / f"pose_{pose}.png").convert("RGBA")
        im = im.crop(im.getbbox())
        big = fit_h(im, 760)
        save_webp(big, IMG / "judge" / f"{pose}.webp", 82)
        save_avif(big, IMG / "judge" / f"{pose}.avif", 60)
        save_webp(fit_h(im, 360), IMG / "judge" / f"{pose}-sm.webp", 82)


# ---------- icon + favicons ----------
def icons():
    icon = Image.open(APP / "branding/app-icon-options/icon_option_3.png").convert("RGB")
    save_webp(icon.resize((256, 256), Image.LANCZOS), IMG / "icon-256.webp", 85)
    icon.resize((180, 180), Image.LANCZOS).save(SITE / "apple-touch-icon.png", optimize=True)
    icon.resize((192, 192), Image.LANCZOS).save(SITE / "icon-192.png", optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(SITE / "icon-512.png", optimize=True)
    icon.resize((48, 48), Image.LANCZOS).save(SITE / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    icon.resize((32, 32), Image.LANCZOS).save(SITE / "favicon-32.png", optimize=True)


# ---------- store screenshots ----------
SHOTS = [
    ("01_hook", "Make funny dubs with friends: the Voice Judge character at her neon desk"),
    ("02_home", "Pick a scene: the home screen with tonight's scene and scene packs"),
    ("03_listen", "Do the voices: the dub screen with the line, timeline and waveform"),
    ("04_score", "Get judged: a score of 88 with timing, energy and delivery bars"),
    ("05_board", "Share the laughs: share your dubbed scene with friends"),
]


def shots():
    src = APP / "store/screenshots/en-US"
    for name, _ in SHOTS:
        im = Image.open(src / f"{name}.png").convert("RGB")
        save_webp(fit_w(im, 540), IMG / "shots" / f"{name}.webp", 78)


# ---------- scene catalog + stills ----------
def scenes():
    out = []
    pets = json.loads((APP / "scene_packs/pets_scenes.json").read_text())
    remote = json.loads((APP / "scene_packs/remote/catalog.json").read_text())
    pet_pack = remote["packs"][0]
    pro = set(pet_pack.get("proScenes", []))
    for s in pets:
        code = s["raw"]
        im = Image.open(APP / "scene_packs/start_images" / f"{code}.png").convert("RGB")
        save_webp(fit_w(im, 960), IMG / "scenes" / f"{s['id']}.webp", 76)
        save_webp(fit_w(im, 480), IMG / "scenes" / f"{s['id']}-sm.webp", 74)
        out.append({
            "id": s["id"], "code": code, "title": s["title"], "characters": s["characters"],
            "note": s["note"], "pack": pet_pack["title"], "pro": s["id"] in pro,
        })
    bundled_dir = APP / "shared/src/commonMain/composeResources/files/scenes"
    packs = json.loads((bundled_dir / "packs.json").read_text())["packs"]
    for pack in packs:
        for sid in pack["scenes"]:
            meta = json.loads((bundled_dir / f"{sid}.json").read_text())
            im = Image.open(bundled_dir / f"{sid}.jpg").convert("RGB")
            save_webp(fit_w(im, 960), IMG / "scenes" / f"{sid}.webp", 78)
            save_webp(fit_w(im, 480), IMG / "scenes" / f"{sid}-sm.webp", 74)
            out.append({
                "id": sid, "code": None, "title": meta["title"], "characters": meta.get("character", ""),
                "note": meta.get("note", ""), "pack": pack["title"], "pro": sid in pack.get("proScenes", []),
            })
    (DATA / "scenes.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    return out


# ---------- Open Graph images (1200x630) ----------
def stage_bg(w, h):
    bg = Image.new("RGB", (w, h), BG_DEEP)
    glow = Image.new("RGB", (w, h), BG_DEEP)
    d = ImageDraw.Draw(glow)
    d.ellipse((w * 0.35, -h * 0.4, w * 1.15, h * 0.9), fill=(90, 26, 110))
    d.ellipse((-w * 0.2, h * 0.5, w * 0.5, h * 1.4), fill=BG_MID)
    return Image.blend(bg, glow.filter(ImageFilter.GaussianBlur(120)), 0.9)


def font(size, weight="extrabold"):
    return ImageFont.truetype(str(APP / f"shared/src/commonMain/composeResources/font/unbounded_{weight}.ttf"), size)


def og_main():
    W, H = 1200, 630
    im = stage_bg(W, H)
    d = ImageDraw.Draw(im)
    d.text((70, 120), "DUB THE SCENE.", font=font(68), fill=(255, 255, 255))
    d.text((70, 205), "GET JUDGED.", font=font(68), fill=GOLD)
    d.text((72, 320), "The party game where you dub funny", font=font(28, "semibold"), fill=(220, 214, 255))
    d.text((72, 360), "scenes and a judge scores you.", font=font(28, "semibold"), fill=(220, 214, 255))
    d.rounded_rectangle((70, 450, 430, 520), radius=35, fill=PINK)
    d.text((105, 466), "VOICE JUDGE", font=font(30), fill=(255, 255, 255))
    judge = Image.open(APP / "branding/character/poses/pose_verdict.png").convert("RGBA")
    judge = fit_h(judge.crop(judge.getbbox()), 600)
    im.paste(judge, (W - judge.width - 30, H - judge.height + 10), judge)
    im.save(IMG / "og" / "og-main.jpg", quality=86, optimize=True, progressive=True)


def og_scene(scene):
    W, H = 1200, 630
    still = Image.open(IMG / "scenes" / f"{scene['id']}.webp").convert("RGB")
    scale = max(W / still.width, H / still.height)
    still = still.resize((round(still.width * scale), round(still.height * scale)), Image.LANCZOS)
    still = still.crop(((still.width - W) // 2, (still.height - H) // 2, (still.width - W) // 2 + W, (still.height - H) // 2 + H))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(H):
        a = int(max(0, (y - H * 0.35) / (H * 0.65)) * 225)
        sd.line([(0, y), (W, y)], fill=BG_DEEP + (a,))
    im = Image.alpha_composite(still.convert("RGBA"), shade)
    d = ImageDraw.Draw(im)
    d.text((60, 440), "CAN YOU BEAT ME?", font=font(60), fill=GOLD)
    d.text((62, 525), scene["title"], font=font(30, "semibold"), fill=(255, 255, 255))
    d.rounded_rectangle((60, 36, 330, 92), radius=28, fill=PINK)
    d.text((84, 48), "VOICE JUDGE", font=font(24), fill=(255, 255, 255))
    judge = Image.open(IMG / "judge" / "cheer.webp").convert("RGBA")
    judge = fit_h(judge, 330)
    im.paste(judge, (W - judge.width - 30, H - judge.height - 10), judge)
    im.convert("RGB").save(IMG / "og" / f"{scene['id']}.jpg", quality=80, optimize=True, progressive=True)


# ---------- hero video (muted gameplay clip) ----------
def video():
    src = APP / "scene_packs/remote/closed_door.mp4"
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", "scale=640:-2,fps=24",
        "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "slow",
        "-movflags", "+faststart", str(VIDEO / "hero-clip.mp4"),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", "0.5", "-i", str(src), "-frames:v", "1", "-vf", "scale=640:-2",
        str(VIDEO / "hero-poster.png"),
    ], check=True)
    poster = Image.open(VIDEO / "hero-poster.png").convert("RGB")
    save_webp(poster, VIDEO / "hero-poster.webp", 72)
    poster.save(VIDEO / "hero-poster.jpg", quality=72, optimize=True, progressive=True)
    (VIDEO / "hero-poster.png").unlink()


if __name__ == "__main__":
    if not APP.is_dir():
        sys.exit(f"App repo not found: {APP}")
    fonts()
    judge()
    icons()
    shots()
    all_scenes = scenes()
    og_main()
    for s in all_scenes:
        og_scene(s)
    video()
    print(f"ok: {len(all_scenes)} scenes")
