(function () {
  const root = document.getElementById("communication");
  const progress = window.DrillCoachProgress;
  if (!root || !progress) return;
  const { skills } = progress;
  const errors = {
    // Authentication outcomes are reported separately so the message matches what actually failed.
    session: "Your sign-in expired. Sign in again to evaluate.",
    google_token: "Google sign-in could not be verified. Sign in again.",
    nonce: "This sign-in attempt timed out or was already used. Choose Set up Google Sign-In and try again.",
    verifier: "Google's sign-in service could not be reached to verify your account. Try again in a moment.",
    owner: "This coach is limited to the authorized account.",
    disabled: "The AI Coach is paused. You can still use Free Practice.",
    answer: "Enter a written answer of at most 2,400 UTF-8 bytes.",
    duplicate: "This answer was already submitted recently. Revise it before trying again.",
    rate: "An evaluation is in progress or finished just now. Try again shortly.",
    daily: "Today's 10-evaluation limit has been reached.",
    budget: "There is insufficient budget for this evaluation.",
    credits: "OpenAI reported insufficient credits. Free Practice remains available.",
    provider_limit: "OpenAI is rate limited or its credits are unavailable.",
    provider: "OpenAI could not complete the evaluation. Your answer is still here.",
    timeout: "The request timed out. Usage may still count. Your answer is still here.",
    feedback: "The evaluation returned incomplete feedback. Your answer is still here.",
    follow_up: "This follow-up expired. You can continue with the original question."
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

  function element(tag, text, parent) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent?.append(node);
    return node;
  }

  function button(parent, label, action, solid = false) {
    const node = element("button", label, parent);
    node.type = "button";
    if (solid) node.className = "solid";
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
      throw new Error((detail ? detail + " " : "") +
        (errors[value?.error] ?? "The coach is unavailable. You can continue in Free Practice."));
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
          reject(new Error("Google Sign-In could not load. You can continue in Free Practice."));
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

  const money = micros => "$" + (micros / 1_000_000).toFixed(3);
  function details(parent, label) {
    const node = element("details", undefined, parent);
    element("summary", label, node);
    return node;
  }
  function meter(parent, label, value, max, text) {
    const row = element("label", undefined, parent);
    row.className = "comm-coach-meter";
    element("span", `${label} · ${text}`, row);
    const bar = element("meter", undefined, row);
    bar.min = 0;
    bar.max = Math.max(1, max);
    bar.value = Math.min(value, bar.max);
    bar.high = bar.max * 0.8;
    bar.optimum = 0;
    return bar;
  }
  function list(parent, title, values) {
    if (!values.length) return;
    element("h4", title, parent);
    const items = element("ul", undefined, parent);
    for (const value of values) element("li", value, items);
  }

  function mount(container, question, answerInput, context = {}) {
    const generation = ++instance;
    const active = () => instance === generation && container.isConnected;
    // Within a daily session, keep the first evaluation of each question in page memory so the review
    // step can compare against it. Leaving the session (or using Free Practice) discards it.
    const sessionId = context.session ?? null;
    if (sessionId !== memorySession) {
      memory.clear();
      memorySession = sessionId;
    }
    const memoryKey = sessionId && sessionId + ":" + question.id;
    const box = details(container, "AI Communication Coach");
    const status = element("p", undefined, box);
    status.setAttribute("role", "status");
    const controls = element("div", undefined, box);
    const earlier = element("p", undefined, box);
    const output = element("div", undefined, box);
    let result, initial = memoryKey ? memory.get(memoryKey) ?? null : null, followUp, usage, config, busy = false;
    let input = answerInput;
    if (initial) {
      earlier.textContent = `Earlier AI assessment in this session · ${initial.feedback.overall.toFixed(1)} / 5. ` +
        "Evaluate your revised answer to compare the two attempts.";
    } else earlier.hidden = true;
    const signedIn = () => auth && auth.expires > Date.now();

    dispose = () => {
      result = initial = followUp = usage = null;
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
      const actions = element("div", undefined, controls);
      actions.className = "acts";
      if (!signedIn()) {
        button(actions, "Set up Google Sign-In", signIn);
        return;
      }
      const evaluate = button(actions, "Evaluate my answer", submit, true);
      evaluate.disabled = busy || usage?.remainingToday === 0 || usage?.remainingMonthlyMicros === 0;
      button(actions, "Sign out", signOut);
      if (usage) {
        const daily = usage.evaluationsToday + usage.remainingToday;
        const monthly = usage.estimatedMonthlyMicros + usage.remainingMonthlyMicros;
        meter(controls, "Evaluations today", usage.evaluationsToday, daily, `${usage.evaluationsToday} of ${daily}`);
        meter(controls, "Monthly budget used", usage.estimatedMonthlyMicros, monthly,
          `${money(usage.estimatedMonthlyMicros)} of ${money(monthly)}`);
        element("p", `${usage.evaluationsToday} used today · ${usage.remainingToday} left · ${usage.inputTokensToday} input and ${usage.outputTokensToday} output tokens reported`, controls);
        element("p", `Estimated today ${money(usage.estimatedDailyMicros)} · month ${money(usage.estimatedMonthlyMicros)} · available ${money(usage.remainingMonthlyMicros)}`, controls);
        if (usage.reservedMonthlyMicros) element("p", `Includes ${money(usage.reservedMonthlyMicros)} in unsettled reservations.`, controls);
        element("p", "Application estimates, separate from your OpenAI balance. Limits reset on Zurich dates.", controls);
      }
    }

    async function signIn() {
      if (!active() || busy) return;
      busy = true;
      const signin = controls.querySelector("button");
      if (signin) signin.disabled = true;
      showStatus("Preparing Google Sign-In…");
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
              await refresh();
            } catch (error) {
              showStatus(error.message);
              if (active()) showControls();
            }
          }
        });
        controls.replaceChildren();
        identity.renderButton(controls, { theme: "outline", text: "signin_with" });
        showStatus("Sign in with the authorized Google account.");
      } catch (error) {
        showStatus(error.message);
        if (active()) showControls();
      } finally {
        busy = false;
      }
    }

    async function refresh() {
      usage = await api("/v1/usage");
      if (!active()) return;
      showControls();
      showStatus(config.mock ? "Mock coach. No OpenAI call will be made." : "Each evaluation sends your written answer to OpenAI. Feedback stays in this session.");
    }

    async function signOut() {
      const session = auth?.session;
      auth = null;
      memory.clear();
      earlier.hidden = true;
      result = initial = followUp = usage = null;
      input = answerInput;
      output.replaceChildren();
      container.querySelector(".comm-coach-followup")?.remove();
      window.google?.accounts?.id?.disableAutoSelect();
      showControls();
      try {
        if (session) await api("/v1/auth/session", { method: "DELETE", token: session });
        showStatus("Signed out.");
      } catch {
        showStatus("Signed out in this tab. The server session will expire automatically.");
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
        showStatus("Revise the answer before requesting another evaluation.");
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
        usage = evaluated.usage;
        renderFeedback();
        showStatus("Evaluation complete.");
      } catch (error) {
        if (!active() || (auth && auth.session !== session)) return;
        showStatus(error.message);
        if (auth?.session === session) {
          try { usage = await api("/v1/usage", { token: session }); } catch { /* Keep the last known totals. */ }
        }
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
        if (!review) {
          entry.reviewAt = progress.load(localStorage).find(item => item.id === entry.id)?.reviewAt ?? null;
        }
        progress.save(localStorage, entry);
        showStatus(review ? "Scores saved and question marked for review tomorrow." : "Scores saved. Answer and feedback stay in this session.");
      } catch {
        showStatus("Browser storage could not save the scores.");
      }
    }

    function renderFeedback() {
      output.replaceChildren();
      const data = result.feedback;
      const heading = element("h3", `${result.mock ? "Mock result" : "AI assessment"} · ${data.overall.toFixed(1)} / 5`, output);
      heading.tabIndex = -1;
      element("p", "Scores are coaching judgments. Your self-assessment stays separate.", output);
      list(output, "Next steps", data.actions);
      const rubric = details(output, "Skill scores and reasons");
      for (const [key, label] of Object.entries(skills)) {
        const skill = data.skills[key];
        element("p", `${label} · ${skill.score === null ? "Not applicable" : skill.score + " / 5"} · ${skill.reason}`, rubric);
      }
      const specifics = details(output, "Technical feedback and professional English");
      for (const [label, entries] of [
        ["Technical strengths", data.technicalStrengths], ["Technical mistakes", data.technicalMistakes],
        ["Missing concepts", data.missingConcepts], ["Communication strengths", data.communicationStrengths],
        ["Communication weaknesses", data.communicationWeaknesses], ["Suggested learning topics", data.learningTopics],
        ["English corrections", data.corrections.map(item => `${item.original} → ${item.revision} · ${item.reason}`)]
      ]) list(specifics, label, entries);
      const example = details(output, "Recommended structure and improved answer");
      element("p", data.suggestedStructure, example);
      element("p", data.improvedAnswer, example);
      element("h4", "Suggested follow-up", output);
      element("p", data.followUp, output);
      const actions = element("div", undefined, output);
      actions.className = "acts";
      button(actions, "Try again", () => input.focus());
      if (initial.id !== result.id) button(actions, "Compare attempts", compare);
      button(actions, "Save scores", () => save(false));
      button(actions, "Mark knowledge gap for review", () => save(true));
      button(actions, "Continue to follow-up", () => {
        followUp = result.followUp;
        const prompt = result.feedback.followUp;
        result = initial = null;
        container.querySelector(".comm-coach-followup")?.remove();
        const label = element("label", prompt);
        label.className = "comm-coach-followup";
        input = element("textarea", undefined, label);
        input.rows = 4;
        output.before(label);
        output.replaceChildren();
        input.focus();
      });
      const next = container.closest("article")?.querySelector("#comm-next");
      if (next) button(actions, "Next question", () => next.click());
      heading.focus();
    }

    function compare() {
      let area = output.querySelector(".comm-coach-comparison");
      if (!area) {
        area = details(output, "Original and revised answers");
        area.className = "comm-coach-comparison";
        for (const [label, entry] of [["Original", initial], ["Revised", result]]) {
          element("h4", label, area);
          const answer = element("p", entry.answer, area);
          answer.className = "comm-answer";
        }
        const sameRubric = initial.rubric === result.rubric && initial.model === result.model;
        if (sameRubric) {
          const differences = Object.entries(skills).flatMap(([key, label]) => {
            const a = initial.feedback.skills[key].score, b = result.feedback.skills[key].score;
            return a === null || b === null ? [] : [`${label} · ${a} → ${b}`];
          });
          const items = element("ul", undefined, area);
          for (const difference of differences) element("li", difference, items);
        }
      }
      area.open = true;
      area.querySelector("summary").focus();
    }

    box.addEventListener("toggle", async () => {
      if (!box.open || config || busy) return;
      if (!endpoint) {
        showStatus("AI evaluation is unavailable on this site. Free Practice is ready to use.");
        return;
      }
      busy = true;
      showStatus("Connecting to the coach…");
      try {
        config = await api("/v1/config", { token: null });
        if (!active()) return;
        if (!config.enabled) showStatus(errors.disabled);
        else if (signedIn()) await refresh();
        else showStatus("Sign in to use the owner-only coach.");
      } catch (error) {
        showStatus(error.message);
      } finally {
        busy = false;
        if (active()) showControls();
      }
    });
  }

  function showProgress(panel, bank) {
    const section = details(panel, "AI assessment history");
    section.className = "comm-card comm-block";
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
        const average = values => (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
        element("p", `${live.length} saved AI assessments · average ${average(live.map(row => row.overall))} / 5`, section);
        const skillList = details(section, "Average AI scores by skill");
        for (const [skill, label] of Object.entries(skills)) {
          const values = live.map(row => row.scores[skill]).filter(value => value !== null);
          if (values.length) element("p", `${label} · ${average(values)} / 5`, skillList);
        }
        const questions = details(section, "AI scores by question");
        questions.className = "comm-coach-questions";
        const items = element("ul", undefined, questions);
        for (const entry of progress.byQuestion(rows)) {
          const name = bank.find(q => q.id === entry.questionId)?.prompt ?? entry.questionId;
          const review = entry.reviewAt ? ` · review ${new Date(entry.reviewAt).toLocaleDateString()}` : "";
          element("li", `${name} · latest ${entry.latest.toFixed(1)} · best ${entry.best.toFixed(1)} · ` +
            `${entry.attempts} ${entry.attempts === 1 ? "attempt" : "attempts"}${review}`, items);
        }
      }
      const attempts = element("ul", undefined, section);
      for (const row of rows.slice().reverse()) {
        const name = bank.find(q => q.id === row.questionId)?.prompt ?? row.questionId;
        const line = element("li", undefined, attempts);
        element("p", `${row.mock ? "Mock · " : ""}${name} · ${row.overall.toFixed(1)} / 5 · ${new Date(row.at).toLocaleDateString()}`, line);
        if (row.reviewAt) element("p", "Review " + new Date(row.reviewAt).toLocaleDateString(), line);
        button(line, "Delete saved AI score", () => {
          try {
            progress.remove(localStorage, row.id);
            draw();
            section.querySelector("summary").focus();
          } catch {
            element("p", "The score could not be removed.", line).setAttribute("role", "status");
          }
        });
      }
    }
    draw();
  }

  window.DrillCoach = { mount, showProgress, clear: () => { instance++; dispose?.(); dispose = null; } };
})();
