(() => {
  const header = document.querySelector(".site-header");
  const toggle = header?.querySelector("[data-nav-toggle]");
  if (!toggle) return;
  const nav = header.querySelector("#primary-nav");
  const dropdown = nav.querySelector(".site-nav__group");
  const mobile = matchMedia("(max-width: 760px)");
  const expanded = () => toggle.getAttribute("aria-expanded") === "true";
  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    if (dropdown) dropdown.open = false;
  };

  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    if (expanded()) close();
    else toggle.setAttribute("aria-expanded", "true");
  });
  // The navigation follows the toggle in DOM order, so Tab enters the opened menu.
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !header.contains(document.activeElement)) return;
    if (dropdown?.open && dropdown.contains(document.activeElement)) {
      dropdown.open = false;
      dropdown.querySelector("summary").focus();
    } else if (mobile.matches && expanded()) {
      close();
      toggle.focus();
    }
  });
  document.addEventListener("click", event => {
    if (dropdown?.open && !dropdown.contains(event.target)) dropdown.open = false;
    if (mobile.matches && expanded() && !header.contains(event.target)) close();
  });
  mobile.addEventListener("change", () => {
    if (mobile.matches && nav.contains(document.activeElement)) toggle.focus();
    close();
  });
})();
