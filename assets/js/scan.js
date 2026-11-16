/* RViz-style panel on the home page: an animated LiDAR-like point cloud over a
   ground grid, an XYZ axis triad and one tracked 3D bounding box.
   Plain canvas 2D, no dependencies. Pauses off-screen; static with reduced motion. */
(function () {
  "use strict";
  var canvas = document.querySelector(".scan canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var fpsEl = document.querySelector(".scan-fps");
  var ptsEl = document.querySelector(".scan-pts");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var NX = 64, NY = 40, SX = 9, SY = 6;
  var W = 0, H = 0;
  var mouse = 0, mouseTarget = 0;

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function height(x, y, t) {
    return 0.32 * Math.sin(x * 0.9 + t * 0.7) +
      0.22 * Math.cos(y * 1.4 - t * 0.5) +
      0.12 * Math.sin((x + y) * 2.1 + t * 1.2);
  }

  // colour ramp: deep teal -> mint -> near white (by height)
  var stops = [[10, 79, 73], [60, 198, 181], [214, 255, 246]];
  function ramp(v) {
    v = Math.max(0, Math.min(1, v));
    var i = v < 0.5 ? 0 : 1, k = (v - i * 0.5) * 2;
    var a = stops[i], b = stops[i + 1];
    return "rgb(" + (a[0] + (b[0] - a[0]) * k | 0) + "," + (a[1] + (b[1] - a[1]) * k | 0) + "," + (a[2] + (b[2] - a[2]) * k | 0) + ")";
  }

  var cam = { yaw: 0, pitch: 0.62, dist: 8.2 };
  function project(x, y, z) {
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var xr = x * cy - y * sy, yr = x * sy + y * cy;
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var depth = yr * cp - z * sp + cam.dist;
    var up = yr * sp + z * cp;
    var f = Math.min(W, H * 1.9) * 0.95;
    return { x: W / 2 + (xr * f) / depth, y: H * 0.46 - (up * f) / depth, d: depth };
  }

  function line(a, b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    mouse += (mouseTarget - mouse) * 0.05;
    cam.yaw = 0.35 * Math.sin(t * 0.12) + mouse * 0.45;

    // ground grid
    ctx.beginPath();
    ctx.strokeStyle = "rgba(120, 160, 180, 0.12)";
    ctx.lineWidth = 1;
    for (var gx = -5; gx <= 5; gx++) line(project(gx, -3.5, -0.9), project(gx, 3.5, -0.9));
    for (var gy = -3; gy <= 3; gy++) line(project(-5, gy, -0.9), project(5, gy, -0.9));
    ctx.stroke();

    // point cloud
    var n = 0;
    for (var i = 0; i < NX; i++) {
      for (var j = 0; j < NY; j++) {
        var x = (i / (NX - 1) - 0.5) * SX, y = (j / (NY - 1) - 0.5) * SY;
        var z = height(x, y, t);
        var p = project(x, y, z);
        var s = Math.max(0.9, Math.min(2.6, 11 / p.d));
        ctx.fillStyle = ramp((z + 0.6) / 1.2);
        ctx.globalAlpha = Math.max(0.4, Math.min(1, 2 - p.d / 8));
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        n++;
      }
    }
    ctx.globalAlpha = 1;

    // tracked 3D bounding box
    var bx = 2.6 * Math.sin(t * 0.22), by = 0.6 + 0.8 * Math.cos(t * 0.17);
    var bz = height(bx, by, t);
    var hw = 0.38, hd = 0.38, hh = 1.0;
    var c = [];
    for (var k = 0; k < 8; k++) {
      c.push(project(bx + (k & 1 ? hw : -hw), by + (k & 2 ? hd : -hd), bz + (k & 4 ? hh : 0)));
    }
    ctx.beginPath();
    ctx.strokeStyle = "#f2c14e";
    ctx.lineWidth = 1.4;
    [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { line(c[e[0]], c[e[1]]); });
    ctx.stroke();
    var top = c[6];
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#f2c14e";
    ctx.fillText("person · 0.96", top.x, top.y - 6);

    // axis triad (x red, y green, z blue)
    var o = project(-4.2, -2.6, -0.9);
    [[0.9, 0, 0, "#ef5350"], [0, 0.9, 0, "#66bb6a"], [0, 0, 0.9, "#42a5f5"]].forEach(function (a) {
      var e = project(-4.2 + a[0], -2.6 + a[1], -0.9 + a[2]);
      ctx.beginPath(); ctx.strokeStyle = a[3]; ctx.lineWidth = 2; line(o, e); ctx.stroke();
    });

    if (ptsEl) ptsEl.textContent = n.toLocaleString("en-US");
  }

  var running = false, raf = null, last = 0, frames = 0, fpsT = 0;
  function loop(now) {
    if (!running) return;
    var t = now / 1000;
    draw(t);
    frames++;
    if (now - fpsT > 1000) {
      if (fpsEl) fpsEl.textContent = Math.round((frames * 1000) / (now - fpsT));
      frames = 0; fpsT = now;
    }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduce) return; running = true; fpsT = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

  resize();
  draw(2.0);
  window.addEventListener("resize", function () { resize(); if (!running) draw(2.0); });
  canvas.parentElement.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    mouseTarget = ((e.clientX - r.left) / r.width - 0.5) * 2;
  });

  if (reduce) { if (fpsEl) fpsEl.textContent = "0"; return; }
  var inView = !("IntersectionObserver" in window);
  if (!inView) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      inView ? start() : stop();
    }).observe(canvas);
  } else start();
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (inView) start();
  });
})();
