(function () {
  const root = document.getElementById("communication");
  const progress = window.DrillCoachProgress;
  if (!root || !progress) return;
  const { skills } = progress;
  // Every usage limit, pause or provider-side quota problem reads the same to the learner.
  const unavailable = "AI evaluation is temporarily unavailable. Free Practice remains available.";
  const errors = {
    // Authentication outcomes are reported separately so the message matches what actually failed.
    session: "Your sign-in expired. Sign in again to evaluate.",
    google_token: "Google sign-in could not be verified. Sign in again.",
    nonce: "This sign-in attempt timed out or was already used. Sign in again.",
    verifier: "Google's sign-in service could not be reached. Try again in a moment.",
    owner: "AI feedback is limited to the site owner's account.",
    disabled: unavailable, daily: unavailable, budget: unavailable, credits: unavailable, provider_limit: unavailable,
    answer: "Write an answer of up to about 2,400 characters to evaluate.",
    duplicate: "This answer was evaluated recently. Revise it before trying again.",
    rate: "An evaluation just finished. Try again in a moment.",
    provider: "The evaluation could not be completed. Your answer is still here.",
    timeout: "The evaluation took too long. Your answer is still here.",
    feedback: "The feedback was incomplete. Your answer is still here.",
    follow_up: "This follow-up expired. Continue with the original question."
  };
  // Extra detail for Google token failures. Reason codes name the failed check only.
  const tokenReasons = {
    audience: "Google issued the sign-in for a different OAuth client than the coach expects.",
    expired: "Google's sign-in token had already expired. Check that this device's clock is correct.",
    not_yet_valid: "Google's sign-in token is not valid yet. Check that this device's clock is correct."
  };
  let endpoint, auth, googleLoader, instance = 0, dispose, memorySession = null;
  const memory = new Map();

  try {
    const url = new URL(root.dataset.coachApi);
    const development = ["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["localhost", "127.0.0.1"].includes(location.hostname) && url.protocol === "http:";
    if ((url.protocol === "https:" || development) && !url.username && !url.password) endpoint = url.origin;
  } catch {
    // The public frontend stays usable before an API URL is configured.
  }

  function element(tag, text, parent, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node);
    return node;
  }

  function button(parent, label, action, className) {
    const node = element("button", label, parent, className);
    node.type = "button";
    node.onclick = action;
    return node;
  }

  async function api(path, { method = "GET", body, token = auth?.session } = {}) {
    const headers = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (body) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetch(endpoint + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
        credentials: "omit", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(path.endsWith("/evaluations") ? 35_000 : 10_000)
      });
    } catch {
      throw new Error("The coach is unreachable. Your answer is still here.");
    }
    if (response.status === 204) return null;
    const value = await response.json().catch(() => null);
    if (!response.ok || !value) {
      if (value?.error === "session" && auth?.session === token) auth = null;
      const detail = value?.error === "google_token" ? tokenReasons[value.reason] : undefined;
      throw new Error((detail ? detail + " " : "") + (errors[value?.error] ?? unavailable));
    }
    return value;
  }

  function google() {
    if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
    if (!googleLoader) {
      googleLoader = new Promise((resolve, reject) => {
        const script = element("script", undefined, document.head);
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        const timer = setTimeout(fail, 8000);
        function fail() {
          clearTimeout(timer);
          googleLoader = null;
          script.remove();
          reject(new Error("Google Sign-In could not load. Free Practice remains available."));
        }
        script.onload = () => {
          clearTimeout(timer);
          if (window.google?.accounts?.id) resolve(window.google.accounts.id);
          else fail();
        };
        script.onerror = fail;
      });
    }
    return googleLoader;
  }

  const signedIn = () => Boolean(auth && auth.expires > Date.now());
  const score = value => value.toFixed(1);
  const money = micros => "$" + (micros / 1_000_000).toFixed(2);

  function details(parent, label, className) {
    const node = element("details", undefined, parent, className);
    element("summary", label, node);
    return node;
  }

  function list(parent, title, values, ordered = false) {
    if (!values?.length) return;
    element("h4", title, parent);
    const items = element(ordered ? "ol" : "ul", undefined, parent);
    for (const value of values) element("li", value, items);
  }

  // Compact score bars: the visible number is the accessible value; the bar is decorative.
  function skillBars(parent, scores) {
    const rows = element("div", undefined, parent, "comm-coach-skills");
    for (const [key, label] of Object.entries(skills)) {
      const value = scores[key];
      if (value === null || value === undefined) continue;
      const row = element("div", undefined, rows, "comm-coach-skill");
      element("span", label, row);
      const bar = element("span", undefined, row, "comm-coach-bar");
      bar.setAttribute("aria-hidden", "true");
      element("span", undefined, bar).style.width = (value / 5 * 100) + "%";
      element("span", `${value}`, row, "comm-coach-skill-value").setAttribute("aria-label", `${value} out of 5`);
    }
    return rows;
  }

  function mount(container, question, answerInput, context = {}) {
    const generation = ++instance;
    const active = () => instance === generation && container.isConnected;
    // Sites without a configured Worker (previews, the legacy origin) show plain Free Practice.
    if (!endpoint) {
      container.hidden = true;
      return;
    }
    // Within a daily session, keep the first evaluation of each question in page memory so the review
    // step can compare against it. Leaving the session (or using Free Practice) discards it.
    const sessionId = context.session ?? null;
    if (sessionId !== memorySession) {
      memory.clear();
      memorySession = sessionId;
    }
    const memoryKey = sessionId && sessionId + ":" + question.id;
    const box = details(container, "AI Communication Coach", "comm-coach");
    const summary = box.querySelector("summary");
    const note = element("p", undefined, box, "comm-coach-note");
    const controls = element("div", undefined, box, "comm-coach-controls");
    const status = element("p", undefined, box, "comm-coach-status");
    status.setAttribute("role", "status");
    const earlier = element("p", undefined, box, "comm-coach-note");
    const output = element("div", undefined, box);
    let result, initial = memoryKey ? memory.get(memoryKey) ?? null : null, followUp, config, busy = false;
    let input = answerInput;
    earlier.hidden = !initial;
    if (initial) earlier.textContent = `Earlier score in this session: ${score(initial.feedback.overall)} / 5. Evaluate your revision to compare.`;

    dispose = () => {
      result = initial = followUp = null;
      input = null;
      output.replaceChildren();
      container.querySelector(".comm-coach-followup")?.remove();
    };

    function showStatus(message) {
      if (active()) status.textContent = message;
    }

    function showControls() {
      controls.replaceChildren();
      if (!config?.enabled) return;
      if (!signedIn()) {
        button(controls, "Sign in to use AI feedback", signIn, "comm-coach-link");
        return;
      }
      const evaluate = button(controls, busy ? "Evaluating…" : "Evaluate my answer", submit, "solid");
      evaluate.disabled = busy;
      button(controls, "Sign out", signOut, "comm-coach-link");
    }

    function showNote() {
      if (!config?.enabled) {
        note.hidden = true;
        return;
      }
      note.hidden = false;
      note.textContent = config.mock
        ? "Mock mode: sample feedback for testing. No answer leaves this site."
        : "Evaluating sends your written answer to an external AI service (OpenAI). Answers and feedback are not saved.";
      if (config.mock && !summary.querySelector(".comm-coach-badge")) element("span", "Mock", summary, "comm-coach-badge");
    }

    async function signIn() {
      if (!active() || busy) return;
      busy = true;
      const signin = controls.querySelector("button");
      if (signin) signin.disabled = true;
      showStatus("");
      try {
        const identity = await google();
        const { nonce } = await api("/v1/auth/challenge", { method: "POST", token: null });
        if (!active()) return;
        identity.initialize({
          client_id: config.googleClientId, nonce, auto_select: false,
          callback: async ({ credential }) => {
            if (!active()) return;
            try {
              const session = await api("/v1/auth/session", { method: "POST", body: { credential }, token: null });
              if (!active()) return;
              auth = session;
              showStatus("");
              showControls();
            } catch (error) {
              showStatus(error.message);
              if (active()) showControls();
            }
          }
        });
        controls.replaceChildren();
        identity.renderButton(controls, { theme: "outline", text: "signin_with", size: "medium" });
      } catch (error) {
        showStatus(error.message);
        if (active()) showControls();
      } finally {
        busy = false;
      }
    }

    async function signOut() {
      const session = auth?.session;
      auth = null;
      memory.clear();
      earlier.hidden = true;
      result = initial = followUp = null;
      input = answerInput;
      output.replaceChildren();
      container.querySelector(".comm-coach-followup")?.remove();
      window.google?.accounts?.id?.disableAutoSelect();
      showControls();
      showStatus("Signed out.");
      try {
        if (session) await api("/v1/auth/session", { method: "DELETE", token: session });
      } catch {
        // The server session expires on its own; nothing else to tell the learner.
      }
    }

    async function submit() {
      if (!active() || busy) return;
      const answer = input.value.trim();
      if (!answer || new TextEncoder().encode(answer).length > 2400) {
        showStatus(errors.answer);
        input.focus();
        return;
      }
      if (result?.answer === answer) {
        showStatus("Revise your answer before evaluating again.");
        return;
      }
      if (!signedIn()) {
        auth = null;
        showStatus(errors.session);
        showControls();
        return;
      }
      busy = true;
      showStatus("Evaluating…");
      showControls();
      const session = auth.session;
      try {
        const evaluated = await api("/v1/evaluations", {
          method: "POST", token: session,
          body: { questionId: question.id, requestId: crypto.randomUUID(), answer, ...(followUp ? { followUp } : {}) }
        });
        if (!active() || auth?.session !== session) return;
        initial ??= { ...evaluated, answer, at: new Date().toISOString() };
        result = { ...evaluated, answer, at: new Date().toISOString() };
        if (memoryKey && !followUp && !memory.has(memoryKey)) memory.set(memoryKey, initial);
        showStatus("");
        renderFeedback();
      } catch (error) {
        if (!active() || (auth && auth.session !== session)) return;
        showStatus(error.message);
      } finally {
        busy = false;
        if (active()) showControls();
      }
    }

    function save(review) {
      if (!result) return;
      try {
        const entry = {
          id: result.id, questionId: question.id, topic: question.topic, category: question.category,
          at: result.at, model: result.model, rubric: result.rubric, overall: result.feedback.overall,
          scores: Object.fromEntries(Object.keys(skills).map(key => [key, result.feedback.skills[key].score])),
          reviewAt: review ? new Date(Date.now() + 86_400_000).toISOString() : null, mock: result.mock
        };
        progress.save(localStorage, entry);
        showStatus(review ? "Scores saved. This question is marked for review tomorrow." : "Scores saved.");
      } catch {
        showStatus("Browser storage could not save the scores.");
      }
    }

    function renderFeedback() {
      output.replaceChildren();
      const data = result.feedback;
      const view = element("section", undefined, output, "comm-coach-result");

      const head = element("div", undefined, view, "comm-coach-head");
      const heading = element("h3", undefined, head, "comm-coach-score");
      heading.tabIndex = -1;
      heading.setAttribute("aria-label", `${result.mock ? "Mock score" : "Overall score"} ${score(data.overall)} out of 5`);
      element("span", "Overall", heading, "comm-coach-score-label");
      element("span", score(data.overall), heading, "comm-coach-score-value");
      element("span", "/ 5", heading, "comm-coach-score-scale");

      // Priority first: the model returns at most three actions, already ordered by importance.
      if (data.actions.length) {
        const next = element("div", undefined, view, "comm-coach-priority");
        list(next, "Improve next", data.actions, true);
      }

      skillBars(view, Object.fromEntries(Object.keys(skills).map(key => [key, data.skills[key].score])));
      const reasons = details(view, "Why these scores");
      const reasonList = element("ul", undefined, reasons);
      for (const [key, label] of Object.entries(skills)) {
        const skill = data.skills[key];
        if (skill.score !== null) element("li", `${label}: ${skill.reason}`, reasonList);
      }

      if (data.technicalStrengths.length || data.technicalMistakes.length || data.missingConcepts.length) {
        const technical = details(view, "Technical feedback");
        list(technical, "Strengths", data.technicalStrengths);
        list(technical, "Mistakes", data.technicalMistakes);
        list(technical, "Missing concepts", data.missingConcepts);
      }
      if (data.corrections.length) {
        const english = details(view, "Professional English");
        const items = element("ul", undefined, english, "comm-coach-corrections");
        for (const item of data.corrections) {
          const line = element("li", undefined, items);
          element("s", item.original, line);
          element("span", " → ", line).setAttribute("aria-label", "becomes");
          element("strong", item.revision, line);
          element("span", item.reason, line, "comm-coach-reason");
        }
      }
      const example = details(view, "Improved example answer");
      element("p", data.suggestedStructure, example, "comm-coach-structure");
      element("p", data.improvedAnswer, example, "comm-answer");

      const follow = element("div", undefined, view, "comm-coach-next-question");
      element("h4", "Follow-up question", follow);
      element("p", data.followUp, follow);
      button(follow, "Answer the follow-up", () => {
        followUp = result.followUp;
        const prompt = result.feedback.followUp;
        result = initial = null;
        container.querySelector(".comm-coach-followup")?.remove();
        const label = element("label", prompt, undefined, "comm-coach-followup");
        input = element("textarea", undefined, label);
        input.rows = 4;
        output.before(label);
        output.replaceChildren();
        input.focus();
      });

      const actions = element("div", undefined, view, "acts comm-coach-actions");
      button(actions, "Try again", () => input.focus());
      if (initial.id !== result.id) button(actions, "Compare attempts", compare);
      button(actions, "Save scores", () => save(review.checked), "solid");
      const reviewLabel = element("label", undefined, actions, "comm-coach-check");
      const review = element("input", undefined, reviewLabel);
      review.type = "checkbox";
      reviewLabel.append(" Review again tomorrow");
      const next = container.closest("article")?.querySelector("#comm-next");
      if (next) button(actions, "Next question", () => next.click());
      heading.focus();
    }

    function compare() {
      let area = output.querySelector(".comm-coach-comparison");
      if (!area) {
        area = element("section", undefined, output.querySelector(".comm-coach-result") ?? output, "comm-coach-comparison");
        area.tabIndex = -1;
        element("h4", `Overall ${score(initial.feedback.overall)} → ${score(result.feedback.overall)}`, area);
        if (initial.rubric === result.rubric && initial.model === result.model) {
          const changes = Object.entries(skills).flatMap(([key, label]) => {
            const a = initial.feedback.skills[key].score, b = result.feedback.skills[key].score;
            return a === null || b === null || a === b ? [] : [`${label}: ${a} → ${b}`];
          });
          if (changes.length) {
            const items = element("ul", undefined, area);
            for (const change of changes) element("li", change, items);
          } else element("p", "Skill scores are unchanged.", area);
        }
        const columns = element("div", undefined, area, "comm-coach-columns");
        for (const [label, entry] of [["Earlier", initial], ["Revised", result]]) {
          const column = element("div", undefined, columns);
          element("h5", `${label} · ${score(entry.feedback.overall)}`, column);
          element("p", entry.answer, column, "comm-answer");
        }
      }
      area.focus();
    }

    box.addEventListener("toggle", async () => {
      if (!box.open || config || busy) return;
      busy = true;
      try {
        config = await api("/v1/config", { token: null });
        if (!active()) return;
        showNote();
        if (!config.enabled) showStatus(unavailable);
      } catch (error) {
        showStatus(error.message);
      } finally {
        busy = false;
        if (active()) showControls();
      }
    });
  }

  // Owner-only usage details, kept out of practice. Visible only while signed in.
  function showSettings(panel) {
    if (!endpoint || !signedIn()) return;
    const section = details(panel, "AI Coach settings", "comm-card comm-block comm-coach-settings");
    const body = element("div", undefined, section);
    section.addEventListener("toggle", async () => {
      if (!section.open) return;
      body.replaceChildren(element("p", "Loading usage…"));
      try {
        const usage = await api("/v1/usage");
        const daily = usage.evaluationsToday + usage.remainingToday;
        const monthly = usage.estimatedMonthlyMicros + usage.remainingMonthlyMicros;
        const rows = element("dl", undefined, undefined, "comm-scores");
        for (const [term, value] of [
          ["Evaluations today", `${usage.evaluationsToday} of ${daily}`],
          ["Estimated spend this month", `${money(usage.estimatedMonthlyMicros)} of ${money(monthly)}`],
          ["Tokens today", `${usage.inputTokensToday} in · ${usage.outputTokensToday} out`],
          ...(usage.reservedMonthlyMicros ? [["Unsettled reservations", money(usage.reservedMonthlyMicros)]] : []),
          ...(usage.mock ? [["Mode", "Mock (no OpenAI calls)"]] : [])
        ]) {
          const row = element("div", undefined, rows);
          element("dt", term, row);
          element("dd", value, row);
        }
        body.replaceChildren(rows, element("p", "Estimates from the coach's own ledger. Limits reset at midnight, Zurich time.", undefined, "comm-coach-note"));
      } catch (error) {
        body.replaceChildren(element("p", error.message));
      }
      const signOut = button(body, "Sign out", async () => {
        const session = auth?.session;
        auth = null;
        memory.clear();
        window.google?.accounts?.id?.disableAutoSelect();
        section.remove();
        try { if (session) await api("/v1/auth/session", { method: "DELETE", token: session }); } catch { /* expires */ }
      }, "comm-coach-link");
      signOut.setAttribute("aria-label", "Sign out of AI feedback");
    });
  }

  function showProgress(panel, bank) {
    const section = details(panel, "AI assessment history", "comm-card comm-block");
    function draw() {
      for (const child of [...section.children].slice(1)) child.remove();
      let rows;
      try { rows = progress.load(localStorage); } catch {
        element("p", "Saved AI scores could not be read.", section);
        return;
      }
      if (!rows.length) {
        element("p", "No saved AI scores yet.", section);
        return;
      }
      const live = rows.filter(row => !row.mock);
      if (live.length) {
        const average = values => (values.reduce((sum, value) => sum + value, 0) / values.length);
        element("p", `${live.length} saved AI assessments · average ${score(average(live.map(row => row.overall)))} / 5`, section);
        const averages = Object.fromEntries(Object.keys(skills).map(skill => {
          const values = live.map(row => row.scores[skill]).filter(value => value !== null);
          return [skill, values.length ? Number(average(values).toFixed(1)) : null];
        }));
        skillBars(details(section, "Average AI scores by skill"), averages);
        const questions = details(section, "AI scores by question", "comm-coach-questions");
        const items = element("ul", undefined, questions);
        for (const entry of progress.byQuestion(rows)) {
          const name = bank.find(q => q.id === entry.questionId)?.prompt ?? entry.questionId;
          const review = entry.reviewAt ? ` · review ${new Date(entry.reviewAt).toLocaleDateString()}` : "";
          element("li", `${name} · latest ${score(entry.latest)} · best ${score(entry.best)} · ` +
            `${entry.attempts} ${entry.attempts === 1 ? "attempt" : "attempts"}${review}`, items);
        }
      }
      const attempts = element("ul", undefined, section, "comm-coach-history");
      for (const row of rows.slice().reverse()) {
        const name = bank.find(q => q.id === row.questionId)?.prompt ?? row.questionId;
        const line = element("li", undefined, attempts);
        element("p", `${row.mock ? "Mock · " : ""}${name} · ${score(row.overall)} / 5 · ${new Date(row.at).toLocaleDateString()}` +
          (row.reviewAt ? ` · review ${new Date(row.reviewAt).toLocaleDateString()}` : ""), line);
        button(line, "Delete saved AI score", () => {
          try {
            progress.remove(localStorage, row.id);
            draw();
            section.querySelector("summary").focus();
          } catch {
            element("p", "The score could not be removed.", line).setAttribute("role", "status");
          }
        }, "comm-coach-link");
      }
    }
    draw();
    showSettings(panel);
  }

  window.DrillCoach = { mount, showProgress, clear: () => { instance++; dispose?.(); dispose = null; } };
})();
