// Voice Judge site: small progressive enhancements. Everything works without this file.
(function () {
  var root = document.documentElement;
  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  root.classList.add(isIOS ? "is-ios" : isAndroid ? "is-android" : "is-desktop");

  // Phones: the one "Get the app" button goes straight to this phone's store (its own href, /get/, does the same with a hop).
  var phoneStore = document.querySelector(isIOS ? ".store.apple" : isAndroid ? ".store.google" : null);
  var openApp = document.querySelector("[data-app-link]");
  if (phoneStore) {
    var storeUrl = phoneStore.href;
    // Android, on a challenge page: Google Play hands the scene to the app on its first launch
    // (install referrer), so the friend's scene opens once the new player is through onboarding.
    if (isAndroid && openApp && openApp.getAttribute("data-code")) {
      storeUrl += (storeUrl.indexOf("?") < 0 ? "?" : "&") + "referrer=" +
        encodeURIComponent("scene=" + openApp.getAttribute("data-code") + "&utm_source=challenge&utm_medium=link");
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-get-app]"), function (el) { el.href = storeUrl; });
  }

  // Phones: "Open the scene" goes to the app's own scheme. Its https href is this very page, and a
  // tap on a link to the page's own address (or inside a mail app's browser) never opens the app.
  // No app installed: nothing happens, so a note points at the "Get the app" button.
  if (openApp && (isIOS || isAndroid) && openApp.getAttribute("data-app-link")) {
    openApp.addEventListener("click", function (e) {
      e.preventDefault();
      location.href = openApp.getAttribute("data-app-link");
      var note = document.querySelector("[data-open-note]");
      setTimeout(function () { if (note && !document.hidden) note.hidden = false; }, 1600);
    });
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reveal on scroll
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  // Hero: judge quote bubble cycles through lines
  var bubble = document.querySelector("[data-quotes]");
  if (bubble && !reduce) {
    var lines = JSON.parse(bubble.getAttribute("data-quotes"));
    var i = 0;
    var bubbleTimer = setInterval(function () {
      bubble.classList.add("swap");
      setTimeout(function () {
        i = (i + 1) % lines.length;
        bubble.textContent = "“" + lines[i] + "”";
        bubble.classList.remove("swap");
      }, 350);
    }, 3800);
  }

  // Hero: score counts up when visible
  var score = document.querySelector("[data-count]");
  if (score && !reduce && "IntersectionObserver" in window) {
    var target = parseInt(score.getAttribute("data-count"), 10);
    var so = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      so.disconnect();
      var t0 = null;
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 1400);
        score.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      score.textContent = "0";
      requestAnimationFrame(tick);
    });
    so.observe(score);
  }

  // Hero video: no autoplay for reduced motion; pause when off screen to save battery
  var vid = document.querySelector("video[data-hero]");
  if (vid) {
    if (reduce) {
      vid.removeAttribute("autoplay");
      vid.pause();
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var p = entries[0].isIntersecting ? vid.play() : vid.pause();
        if (p && p.catch) p.catch(function () {});
      }).observe(vid);
    }
  }

  // Challenge page: optional ?s=<score> (0-100), shown as text only
  var beat = document.querySelector("[data-beat]");
  if (beat) {
    var m = /[?&]s=(\d{1,3})(?:&|$)/.exec(location.search);
    if (m) {
      var s = parseInt(m[1], 10);
      if (s >= 0 && s <= 100) {
        beat.querySelector("b").textContent = String(s);
        beat.classList.add("on");
      }
    }
  }
  // ---------- v2: lights, an interactive judge, motion ----------

  // Scroll progress line under the top edge
  var prog = document.querySelector(".progress");
  if (prog) {
    var ticking = false;
    var setProg = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.setProperty("--p", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(setProg); }
    }, { passive: true });
    setProg();
  }

  // Cards: a glow that follows the pointer
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".step, .feature").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  // Wave bars for the share card
  document.querySelectorAll("[data-wave]").forEach(function (el) {
    var n = parseInt(el.getAttribute("data-wave"), 10) || 20;
    for (var k = 0; k < n; k++) {
      var bar = document.createElement("i");
      bar.style.animationDelay = (-((k * 37) % 100) / 100).toFixed(2) + "s";
      el.appendChild(bar);
    }
  });

  // Confetti burst on a canvas
  var canvas = document.querySelector("[data-confetti]");
  function confetti() {
    if (!canvas || reduce || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var colors = ["#FF3D8A", "#FFD54F", "#3BE8FF", "#7B5CFF", "#3BE8A0", "#FFFFFF"];
    var bits = [];
    for (var k = 0; k < 90; k++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      var sp = 5 + Math.random() * 9;
      bits.push({ x: w * 0.45, y: h * 0.62, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 5, c: colors[k % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 0 });
    }
    var start = null;
    (function frame(t) {
      if (!start) start = t;
      var age = t - start;
      ctx.clearRect(0, 0, w, h);
      bits.forEach(function (b) {
        b.vy += 0.28; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.globalAlpha = Math.max(0, 1 - age / 2200);
        ctx.fillStyle = b.c; ctx.fillRect(-b.r, -b.r * 0.5, b.r * 2, b.r);
        ctx.restore();
      });
      if (age < 2200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })(performance.now());
  }

  // Hero: tap "Judge my dub" for a new verdict
  var judgeBtn = document.querySelector("[data-judge]");
  if (judgeBtn && score) {
    var verdicts = [
      { s: 96, p: [97, 95, 96], q: "Hollywood called. I gave them your number." },
      { s: 34, p: [41, 28, 39], q: "Was that a line or a sandwich order?" },
      { s: 78, p: [82, 74, 79], q: "So close to perfect it's rude." },
      { s: 61, p: [58, 66, 60], q: "The script said words. You said vibes." },
      { s: 91, p: [93, 88, 92], q: "My wig flew off. Worth it." },
      { s: 87, p: [91, 84, 86], q: "My goldfish gave it a standing ovation." }
    ];
    var turn = 0;
    var phone = document.querySelector(".phone");
    var judgeImg = document.querySelector(".show .judge");
    var bars = document.querySelectorAll("[data-bar]");
    var rerun = function (el, cls) {
      if (!el || reduce) return;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    };
    judgeBtn.addEventListener("click", function () {
      var v = verdicts[turn % verdicts.length]; turn++;
      if (typeof bubbleTimer !== "undefined") clearInterval(bubbleTimer);
      if (bubble) bubble.textContent = "“" + v.q + "”";
      var from = parseInt(score.textContent, 10) || 0, t0 = null;
      if (reduce) score.textContent = v.s; else requestAnimationFrame(function tick(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 900);
        score.textContent = Math.round(from + (v.s - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      });
      bars.forEach(function (row, n) {
        row.querySelector("span").style.setProperty("--v", v.p[n] + "%");
        row.querySelector("b").textContent = v.p[n];
      });
      rerun(phone, "bang"); rerun(judgeImg, "hop"); rerun(score.parentNode, "pop");
      if (v.s >= 88) confetti();
      judgeBtn.textContent = "Judge another take";
    });
  }

  // Scene rail drifts slowly until someone touches it
  var rail = document.querySelector(".rail");
  if (rail && !reduce && "IntersectionObserver" in window) {
    var drifting = true, seen = false, pos = 0, dir = 1;
    var stop = function () { drifting = false; rail.classList.remove("drift"); };
    ["pointerdown", "touchstart", "wheel", "keydown", "focusin"].forEach(function (ev) {
      rail.addEventListener(ev, stop, { passive: true, once: true });
    });
    rail.addEventListener("mouseenter", function () { seen = false; });
    rail.addEventListener("mouseleave", function () { seen = true; pos = rail.scrollLeft; });
    new IntersectionObserver(function (en) { seen = en[0].isIntersecting; pos = rail.scrollLeft; }).observe(rail);
    rail.classList.add("drift");
    (function step() {
      if (!drifting) return;
      if (seen) {
        var max = rail.scrollWidth - rail.clientWidth;
        pos += 0.45 * dir;
        if (pos >= max) { pos = max; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
        rail.scrollLeft = pos;
      }
      requestAnimationFrame(step);
    })();
  }

  // Phone: sticky "get the app" button between the hero and the final call to action
  var sticky = document.querySelector("[data-sticky]");
  var hero = document.querySelector(".hero");
  var getSec = document.getElementById("get");
  if (sticky && hero && getSec && "IntersectionObserver" in window) {
    var store = document.querySelector(isIOS ? ".store.apple" : isAndroid ? ".store.google" : null);
    if (store) sticky.href = store.href;
    var heroIn = true, getIn = false;
    var upd = function () { sticky.classList.toggle("on", !heroIn && !getIn); };
    new IntersectionObserver(function (en) { heroIn = en[0].isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(function (en) { getIn = en[0].isIntersecting; upd(); }).observe(getSec);
  }
})();
