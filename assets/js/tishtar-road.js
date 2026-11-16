/* Tishtar vertical roadmap.
   When the roadmap scrolls into view, the robot drives down the centre line and
   stops just above the current phase. Phases light up as the robot reaches them.
   Purely visual. Without JS the roadmap is shown in its final state. */
(function () {
  "use strict";

  var rm = document.querySelector(".rm");
  if (!rm) return;
  var rows = Array.prototype.slice.call(rm.querySelectorAll(".rm-row"));
  var bot = rm.querySelector(".rm-bot");
  var progress = rm.querySelector(".rm-progress");
  var replay = document.querySelector(".tr-replay");
  var currentIndex = Number(rm.dataset.current) - 1;
  if (!rows[currentIndex] || !bot) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // y of each phase badge centre, relative to the roadmap box
  function badgeY(row) {
    var badge = row.querySelector(".rm-badge");
    var a = badge.getBoundingClientRect();
    var b = rm.getBoundingClientRect();
    return a.top - b.top + a.height / 2;
  }
  function stopY() {
    // park the robot just above the current badge
    var badge = rows[currentIndex].querySelector(".rm-badge");
    return badgeY(rows[currentIndex]) - badge.offsetHeight / 2 - bot.offsetHeight / 2 - 6;
  }

  function setY(y) {
    bot.style.top = y + "px";
    progress.style.height = Math.max(0, y) + "px";
    rows.forEach(function (row, i) {
      if (i <= currentIndex) row.classList.toggle("is-reached", badgeY(row) <= y + bot.offsetHeight);
    });
  }

  function ease(k) {
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  }

  var frame = null;
  function arrive() {
    setY(stopY());
    rows.forEach(function (row, i) { if (i <= currentIndex) row.classList.add("is-reached"); });
    rm.classList.add("is-arrived");
  }
  function drive() {
    if (frame) cancelAnimationFrame(frame);
    rm.classList.remove("is-arrived");
    if (reduceMotion.matches) return arrive();
    var target = stopY();
    var duration = Math.max(1400, Math.min(3200, target * 6));
    var t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / duration);
      setY(ease(k) * target);
      if (k < 1) frame = requestAnimationFrame(step);
      else { frame = null; arrive(); }
    }
    frame = requestAnimationFrame(step);
  }

  rm.classList.add("rm--drive");
  setY(0);
  if (replay) {
    replay.hidden = false;
    replay.addEventListener("click", drive);
  }
  window.addEventListener("resize", function () {
    if (!frame && rm.classList.contains("is-arrived")) arrive();
  });

  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();
      drive();
    }, { rootMargin: "0px 0px -35% 0px" });
    seen.observe(rm);
  } else {
    arrive();
  }
})();
