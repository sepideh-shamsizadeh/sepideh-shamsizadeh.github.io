/* Shared navigation and modest media enhancements. No page-specific design logic. */
(function () {
  "use strict";
  var toggle = document.querySelector(".site-menu-toggle");
  var links = document.querySelector(".site-links");
  if (toggle && links) {
    toggle.hidden = false;
    var mobile = matchMedia("(max-width: 760px)");
    function setOpen(open, restoreFocus) {
      toggle.setAttribute("aria-expanded", String(open));
      links.hidden = mobile.matches && !open;
      if (restoreFocus) toggle.focus();
    }
    toggle.addEventListener("click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setOpen(false, true); });
    document.addEventListener("click", function (event) { if (!event.target.closest(".site-navigation")) setOpen(false); });
    mobile.addEventListener("change", function () { setOpen(false); });
    setOpen(false);
  }
  // Preserve image-gallery and responsive video behavior from the original theme.
  if (window.jQuery) {
    var $ = window.jQuery;
    if ($.fn.fitVids) $(".prose").fitVids();
    if ($.fn.magnificPopup) $("a[href$='.jpg'],a[href$='.jpeg'],a[href$='.png'],.image-popup").magnificPopup({ type: "image", gallery: { enabled: true }, closeOnContentClick: true });
  }
})();
