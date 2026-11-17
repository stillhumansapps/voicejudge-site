// Voice Judge site: small progressive enhancements. Everything works without this file.
(function () {
  var root = document.documentElement;
  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  root.classList.add(isIOS ? "is-ios" : isAndroid ? "is-android" : "is-desktop");

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
    setInterval(function () {
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
})();
