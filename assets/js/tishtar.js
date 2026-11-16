/* Progressive enhancement: Liquid owns content and progress; JS only changes visibility. */
(function () {
  "use strict";
  var root = document.querySelector(".tr-page");
  if (!root) return;
  var filters = root.querySelector(".tr-filters");
  var buttons = Array.from(filters.querySelectorAll("button"));
  var phases = Array.from(root.querySelectorAll(".tr-phase"));
  var milestones = Array.from(root.querySelectorAll(".tr-milestone"));
  var message = root.querySelector("#tr-filter-result");
  var empty = root.querySelector("#tr-empty");
  var previousOpen = null;
  function filter(status) {
    if (status !== "all" && previousOpen === null)
      previousOpen = phases.map(function (p) {
        return p.open;
      });
    buttons.forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === status),
      );
    });
    var count = 0;
    milestones.forEach(function (milestone) {
      milestone.hidden =
        status !== "all" && milestone.dataset.status !== status;
      if (!milestone.hidden) count++;
    });
    phases.forEach(function (phase, index) {
      phase.hidden = !Array.from(phase.querySelectorAll(".tr-milestone")).some(
        function (item) {
          return !item.hidden;
        },
      );
      if (status !== "all" && !phase.hidden) phase.open = true;
      else if (status === "all" && previousOpen !== null)
        phase.open = previousOpen[index];
    });
    if (status === "all") previousOpen = null;
    empty.hidden = count !== 0;
    message.textContent =
      count +
      " of " +
      milestones.length +
      " milestones shown. Progress always reflects the full roadmap.";
  }
  filters.hidden = false;
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      filter(button.dataset.filter);
    });
  });
  function revealHash(focus) {
    var id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch (_) {
      return;
    }
    if (!id) return;
    var target = document.getElementById(id);
    if (!target || !root.contains(target)) return;
    if (target.classList.contains("tr-milestone") && target.hidden)
      filter("all");
    var ancestor = target.parentElement;
    while (ancestor && ancestor !== root) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    if (target.tagName === "DETAILS") target.open = true;
    target.scrollIntoView({ block: "start" });
    if (focus && target.classList.contains("tr-milestone"))
      target.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", function () {
    revealHash(true);
  });
  // Handle fragment links before the theme's global smooth-scroll handler.
  // Hidden milestones must be revealed before their scroll position is measured.
  root.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (
        !link ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (!document.getElementById(link.hash.slice(1))) return;
      event.preventDefault();
      event.stopPropagation();
      if (link.hash !== window.location.hash)
        window.history.pushState(null, "", link.hash);
      revealHash(true);
    },
    true,
  );
  revealHash(false);
})();
