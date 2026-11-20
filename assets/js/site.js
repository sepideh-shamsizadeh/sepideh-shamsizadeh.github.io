/* Site-wide behaviour: theme toggle, pointer glow, typing effects, UTC clock,
   and two small easter eggs (console greeting, Konami code). */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- theme toggle (initial theme is applied in head/custom.html) ---- */
  var button = document.querySelector(".theme-toggle");
  if (button) {
    var current = function () { return root.getAttribute("data-theme") || "dark"; };
    var label = function () { button.setAttribute("aria-pressed", String(current() === "dark")); };
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      label();
    });
    label();
  }

  document.querySelectorAll(".site-nav__group").forEach(function (group) {
    document.addEventListener("click", function (event) {
      if (group.open && !group.contains(event.target)) group.open = false;
    });
    group.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !group.open) return;
      group.open = false;
      group.querySelector("summary").focus();
    });
  });

  /* ---- pointer glow ---- */
  if (window.matchMedia("(hover: hover)").matches && !reduce) {
    var glow = document.createElement("div");
    glow.className = "glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);
    var last = null, queued = false;
    window.addEventListener("pointermove", function (e) {
      last = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        glow.style.setProperty("--mx", last.clientX + "px");
        glow.style.setProperty("--my", last.clientY + "px");
      });
    }, { passive: true });
  }

  /* ---- hero typing line: cycles through data-words ---- */
  var word = document.querySelector(".typer__word[data-words]");
  if (word && !reduce) {
    var words = word.dataset.words.split(",");
    var wi = words.indexOf(word.textContent);
    if (wi < 0) wi = 0;
    var text = words[wi], deleting = false, hold = 0;
    (function tick() {
      var target = words[wi];
      if (hold > 0) { hold--; }
      else if (!deleting && text.length < target.length) { text = target.slice(0, text.length + 1); }
      else if (!deleting) { deleting = true; hold = 18; }
      else if (text.length > 0) { text = text.slice(0, -1); }
      else { deleting = false; wi = (wi + 1) % words.length; }
      word.textContent = text;
      setTimeout(tick, deleting ? 35 : 70);
    })();
  }

  /* ---- terminals marked data-type: type the command, then reveal the output ---- */
  var terms = document.querySelectorAll("pre[data-type]");
  Array.prototype.forEach.call(terms, function (pre) {
    if (reduce || !("IntersectionObserver" in window)) return;
    var lines = pre.innerHTML.split("\n");
    pre.innerHTML = lines.map(function (l) { return '<span class="line">' + (l || " ") + "</span>"; }).join("");
    var els = pre.querySelectorAll(".line");
    var fig = pre.closest(".term");
    fig.classList.add("is-typing");
    // first line: type the command after the prompt
    var first = els[0], prompt = first.querySelector(".p");
    var command = first.textContent.replace(/^\$\s*/, "");
    var obs = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      first.innerHTML = "";
      if (prompt) first.appendChild(prompt);
      var cmd = document.createTextNode(" ");
      first.appendChild(cmd);
      first.classList.add("is-shown");
      var c = 0;
      (function type() {
        cmd.textContent = " " + command.slice(0, ++c);
        if (c < command.length) return setTimeout(type, 28);
        var i = 1;
        (function reveal() {
          if (i >= els.length) return fig.classList.remove("is-typing");
          els[i++].classList.add("is-shown");
          setTimeout(reveal, 70);
        })();
      })();
    }, { threshold: 0.4 });
    obs.observe(pre);
  });

  /* ---- UTC clock in the footer ---- */
  var utc = document.querySelector(".utc");
  if (utc) {
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var clock = function () {
      var d = new Date();
      utc.textContent = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + " utc";
    };
    clock();
    setInterval(clock, 1000);
  }

  /* ---- hello, fellow nerd ---- */
  if (window.console && console.log) {
    console.log(
      "%c  ┌─┐\n  │°│  hello, fellow nerd.\n  └┬┘  physical ai · robot perception · ros 2\n  ┴─┴  say hi: sepideh.92sh@gmail.com",
      "font-family: monospace; color: #3cc6b5; font-size: 12px;"
    );
  }

  /* ---- Konami code: a robot drives across the screen ---- */
  var seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  var pos = 0;
  window.addEventListener("keydown", function (e) {
    pos = e.key === seq[pos] ? pos + 1 : (e.key === seq[0] ? 1 : 0);
    if (pos < seq.length) return;
    pos = 0;
    var bot = document.createElement("div");
    bot.className = "egg-bot";
    bot.setAttribute("aria-hidden", "true");
    bot.innerHTML = '<svg viewBox="-30 -22 60 44"><g fill="#1f2933"><rect x="-21" y="-21" width="15" height="9" rx="3"/><rect x="7" y="-21" width="15" height="9" rx="3"/><rect x="-21" y="12" width="15" height="9" rx="3"/><rect x="7" y="12" width="15" height="9" rx="3"/></g><rect x="-23" y="-14" width="44" height="28" rx="7" fill="#3cc6b5"/><circle cx="9" cy="0" r="8" fill="#0a6059"/><rect x="10" y="-5" width="13" height="10" rx="2" fill="#eef2f5"/></svg>';
    var toast = document.createElement("div");
    toast.className = "egg-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = "<b>achievement unlocked:</b> sudo make me a robot";
    document.body.appendChild(bot);
    document.body.appendChild(toast);
    setTimeout(function () { bot.remove(); toast.remove(); }, 5200);
  });
})();
