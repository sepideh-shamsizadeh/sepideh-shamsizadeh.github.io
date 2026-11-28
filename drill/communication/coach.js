(function () {
  const root = document.getElementById("communication");
  const progress = window.DrillCoachProgress;
  if (!root || !progress) return;
  const { skills } = progress;
  // Every usage limit, pause or provider-side quota problem reads the same to the learner.
  const unavailable = "AI evaluation is temporarily unavailable. Free Practice remains available.";
  const speechUnavailable = "Transcription is temporarily unavailable. Recording and Free Practice remain available.";
  const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
  const MAX_TRANSCRIPT_BYTES = 6000;
  const errors = {
    // Authentication outcomes are reported separately so the message matches what actually failed.
    session: "Your sign-in expired. Sign in again to evaluate.",
    google_token: "Google sign-in could not be verified. Sign in again.",
    nonce: "This sign-in attempt timed out or was already used. Sign in again.",
    verifier: "Google's sign-in service could not be reached. Try again in a moment.",
    owner: "AI feedback is limited to the site owner's account.",
    disabled: unavailable,
    daily: "Today's 10-evaluation limit has been reached. Try again tomorrow.",
    budget: "The monthly evaluation budget is full. You can save and continue.",
    credits: "The evaluation provider reported insufficient credits. You can save and continue.",
    provider_limit: "The evaluation provider is rate limited. Try again shortly.",
    answer: "Write an answer of up to about 2,400 characters to evaluate.",
    duplicate: "This answer was evaluated recently. Revise it before trying again.",
    rate: "An evaluation is running or just finished. Try again shortly.",
    in_progress: "This answer is already being evaluated. Wait before retrying.",
    uncertain: "The earlier request may have used AI credit. Wait up to 15 minutes before checking again.",
    new_attempt: "The previous request did not return a usable result. Choose Evaluate again to start a new request.",
    provider: "The provider rejected the evaluation. Your answer is still here. Try again shortly.",
    provider_unconfirmed: "The provider did not confirm the result. Your answer is still here. Wait up to 15 minutes before checking again.",
    output_limit: "Feedback was cut short. Try again, or shorten the answer. The previous request may count toward usage.",
    timeout: "The evaluation timed out. Your answer is still here. Wait up to 15 minutes before checking again.",
    feedback: "The feedback was incomplete. Your answer is still here. Choose Evaluate to try again.",
    follow_up: "This follow-up expired. Continue with the original question.",
    transcript: "Shorten the transcript to about 6,000 characters to evaluate it.",
    audio: "This recording could not be read. Record again in this browser.",
    audio_size: "This recording is too large to transcribe. Record a shorter answer.",
    audio_length: "Recordings can be up to 5 minutes long.",
    no_speech: "No speech was recognized. Check your microphone and record again.",
    transcription: "The recording could not be transcribed. Try again in a moment.",
    transcription_disabled: speechUnavailable, transcription_daily: speechUnavailable
  };
  // Codes shared with evaluation read differently when they come from transcription.
  const transcriptionErrors = {
    duplicate: "This recording was transcribed recently. Its transcript is shown below if you kept the page open.",
    rate: "A transcription just finished. Try again in a moment.",
    timeout: "Transcription took too long. Try again in a moment.",
    unreachable: "The coach is unreachable. Your recording is still here."
  };
  // Extra detail for Google token failures. Reason codes name the failed check only.
  const tokenReasons = {
    audience: "Google issued the sign-in for a different OAuth client than the coach expects.",
    expired: "Google's sign-in token had already expired. Check that this device's clock is correct.",
    not_yet_valid: "Google's sign-in token is not valid yet. Check that this device's clock is correct."
  };
  let endpoint, auth, googleLoader, instance = 0, dispose, refresh, memorySession = null;
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

  async function api(path, { method = "GET", body, audio, token = auth?.session } = {}) {
    const headers = {};
    const speech = path.startsWith("/v1/transcriptions");
    if (token) headers.Authorization = "Bearer " + token;
    if (body) headers["Content-Type"] = "application/json";
    if (audio) headers["Content-Type"] = audio.type;
    let response;
    try {
      response = await fetch(endpoint + path, {
        method, headers, body: audio ? audio.blob : body ? JSON.stringify(body) : undefined,
        credentials: "omit", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(speech ? 90_000 : path.endsWith("/evaluations") ? 35_000 : 10_000)
      });
    } catch {
      throw new Error(speech ? transcriptionErrors.unreachable : "The coach is unreachable. Your answer is still here.");
    }
    if (response.status === 204) return null;
    const value = await response.json().catch(() => null);
    if (!response.ok || !value) {
      if (value?.error === "session" && auth?.session === token) auth = null;
      const detail = value?.error === "google_token" ? tokenReasons[value.reason] : undefined;
      const message = (speech && transcriptionErrors[value?.error]) || errors[value?.error] || (speech ? speechUnavailable : unavailable);
      const reference = path.endsWith("/evaluations") && value?.requestId ?
        ` Reference: ${value.providerId ?? value.requestId}.` : "";
      throw Object.assign(new Error((detail ? detail + " " : "") + message + reference), {
        retryWithNewId: value?.retryWithNewId === true || value?.error === "new_attempt"
      });
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
  const clock = seconds => Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  const bytes = text => new TextEncoder().encode(text).length;

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
    const speechControls = element("div", undefined, box, "comm-coach-controls");
    const transcript = element("div", undefined, box);
    const controls = element("div", undefined, box, "comm-coach-controls");
    const status = element("p", undefined, box, "comm-coach-status");
    status.setAttribute("role", "status");
    const earlier = element("p", undefined, box, "comm-coach-note");
    const output = element("div", undefined, box);
    const draft = context.draft ?? {};
    let result = draft.result, initial = draft.initial ?? (memoryKey ? memory.get(memoryKey) ?? null : null);
    if (initial) draft.initial = initial;
    let followUp = draft.followUp, config, busy = false;
    let input = answerInput;
    // Recordings, transcripts, full answers and feedback live in the current exercise draft.
    let spoken = null;
    const take = () => context.recording?.() ?? null;
    function clearSpoken() {
      delete draft.spoken;
      spoken = null;
      box.querySelector(".comm-coach-spoken")?.remove();
    }
    refresh = () => {
      if (!active()) return;
      if (spoken && spoken.recording !== take()) clearSpoken();
      showControls();
    };
    earlier.hidden = !initial;
    if (initial) earlier.textContent = `Earlier score in this session: ${score(initial.feedback.overall)} / 5. Evaluate your revision to compare.`;

    dispose = () => {
      draft.notify = null;
      if (spoken && draft.spoken) draft.spoken.text = spoken.input.value;
      spoken = null;
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
      speechControls.replaceChildren();
      context.access?.(Boolean(signedIn() && config?.enabled !== false));
      const processing = busy || draft.evaluating;
      context.processing?.(Boolean(draft.evaluating));
      if (!config?.enabled) return;
      if (!signedIn()) {
        button(controls, "Sign in to use AI feedback", signIn, "comm-coach-link");
        return;
      }
      const evaluate = button(controls, draft.evaluating ? "Evaluating…" : "Evaluate my answer", () => submit("written"), "solid");
      evaluate.disabled = Boolean(processing);
      const recording = take();
      if (config.transcription && !followUp && recording && spoken?.recording !== recording) {
        const transcribe = button(speechControls, busy === "transcribe" ? "Transcribing…" : "Transcribe recording", transcribeTake);
        transcribe.disabled = Boolean(processing);
      }
      const signout = button(controls, "Sign out", signOut, "comm-coach-link");
      signout.disabled = Boolean(processing);
      if (spoken) {
        spoken.evaluate = button(controls, "Evaluate spoken answer", () => submit("spoken"), "solid");
        spoken.evaluate.disabled = Boolean(processing);
      }
    }

    function showNote() {
      if (!config?.enabled) {
        note.hidden = true;
        return;
      }
      note.hidden = false;
      note.textContent = config.mock
        ? "Mock mode: sample feedback for testing. No answer or recording leaves this site."
        : "Evaluating sends your written answer to an external AI service (OpenAI)." +
          (config.transcription ? " Transcribing sends your recording to Cloudflare Workers AI, and evaluating a transcript sends it to OpenAI." : "") +
          " Answers, recordings, transcripts and feedback are not saved.";
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
          client_id: config.googleClientId, nonce, auto_select: false, use_fedcm_for_button: true,
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
      delete draft.result;
      delete draft.initial;
      delete draft.followUp;
      delete draft.followUpAnswer;
      delete draft.followUpPrompt;
      delete draft.request;
      delete draft.message;
      clearSpoken();
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

    async function submit(mode) {
      if (!active() || busy || draft.evaluating) return;
      const field = mode === "spoken" ? spoken?.input : input;
      if (!field) return;
      const answer = field.value.trim();
      if (!answer || bytes(answer) > (mode === "spoken" ? MAX_TRANSCRIPT_BYTES : 2400)) {
        showStatus(mode === "spoken" ? errors.transcript : errors.answer);
        field.focus();
        return;
      }
      if (result?.answer === answer && result.mode === mode) {
        showStatus("Revise your answer before evaluating again.");
        return;
      }
      if (!signedIn()) {
        auth = null;
        showStatus(errors.session);
        showControls();
        return;
      }
      if (draft.request?.answer !== answer || draft.request?.mode !== mode || draft.request?.followUp !== followUp) {
        draft.request = { id: crypto.randomUUID(), answer, mode, followUp };
      }
      draft.evaluating = true;
      showStatus("Evaluating…");
      showControls();
      const session = auth.session;
      try {
        const evaluated = await api("/v1/evaluations", {
          method: "POST", token: session,
          body: { questionId: question.id, requestId: draft.request.id, answer,
            ...(mode === "spoken" ? { mode: "spoken" } : followUp ? { followUp } : {}) }
        });
        if (auth?.session !== session) return;
        const entry = { ...evaluated, mode: evaluated.mode ?? mode, answer, at: new Date().toISOString() };
        draft.initial ??= initial ?? entry;
        draft.result = draft.assessed = entry;
        if (memoryKey && !followUp && !memory.has(memoryKey)) memory.set(memoryKey, draft.initial);
        draft.message = save(false, entry) ? "Scores saved." : "Browser storage could not save the detailed scores.";
      } catch (error) {
        if (error.retryWithNewId) delete draft.request;
        draft.message = error.message;
      } finally {
        draft.evaluating = false;
        draft.notify?.();
      }
    }

    draft.notify = () => {
      if (!active()) return;
      showStatus(draft.message ?? "");
      showControls();
      if (draft.result && result !== draft.result) {
        result = draft.result;
        initial = draft.initial;
        renderFeedback();
      }
    };

    async function transcribeTake() {
      const recording = take();
      if (!active() || busy || draft.evaluating || !recording) return;
      if (recording.blob.size > MAX_AUDIO_BYTES) {
        showStatus(errors.audio_size);
        return;
      }
      if (!signedIn()) {
        auth = null;
        showStatus(errors.session);
        showControls();
        return;
      }
      busy = "transcribe";
      showStatus("Transcribing… Long answers can take up to a minute.");
      showControls();
      const session = auth.session;
      try {
        const query = new URLSearchParams({ questionId: question.id, requestId: crypto.randomUUID() });
        const value = await api("/v1/transcriptions?" + query, {
          method: "POST", token: session, audio: { blob: recording.blob, type: recording.type || recording.blob.type }
        });
        if (!active() || auth?.session !== session || take() !== recording) return;
        showStatus("");
        renderSpoken(recording, value);
      } catch (error) {
        if (!active() || (auth && auth.session !== session)) return;
        showStatus(error.message);
      } finally {
        busy = false;
        if (active()) showControls();
      }
    }

    // Transcript and timing from the original recognition. Editing the transcript never changes the metrics.
    function renderSpoken(recording, value, focus = true) {
      clearSpoken();
      const area = element("section", undefined, undefined, "comm-coach-spoken");
      transcript.append(area);
      const heading = element("h4", "Transcript", area);
      heading.tabIndex = -1;
      element("p", "Correct any recognition errors, then evaluate. The speech metrics below come from the original recording.", area, "comm-coach-note");
      const label = element("label", "Transcript of your spoken answer", area);
      const field = element("textarea", undefined, label);
      field.rows = 6;
      field.value = value.text;
      draft.spoken = { recording, ...value };
      field.oninput = () => { draft.spoken.text = field.value; };
      const m = value.metrics;
      const rows = element("dl", undefined, area, "comm-scores comm-coach-metrics");
      for (const [term, text] of [
        ["Duration", clock(m.duration)],
        ["Speaking pace", m.wordsPerMinute === null ? "Too short to measure" : `${m.wordsPerMinute} words per minute`],
        ["Pauses longer than 1 second", m.pauses ? `${m.pauses} · longest ${m.longestPause.toFixed(1)} s` : "None"],
        ["Filler words (approximate)", String(m.fillers)]
      ]) {
        const row = element("div", undefined, rows);
        element("dt", term, row);
        element("dd", text, row);
      }
      element("p", "Recognition can miss hesitations, so filler counts are approximate. Pronunciation, accent, confidence and intonation are not assessed.", area, "comm-coach-note");
      spoken = { recording, input: field };
      if (focus) heading.focus();
    }

    function save(review, evaluated = result) {
      if (!evaluated) return false;
      try {
        const entry = {
          id: evaluated.id, questionId: question.id, topic: question.topic, category: question.category,
          at: evaluated.at, model: evaluated.model, rubric: evaluated.rubric, overall: evaluated.feedback.overall,
          scores: Object.fromEntries(Object.keys(skills).map(key => [key, evaluated.feedback.skills[key].score])),
          reviewAt: review ? new Date(Date.now() + 86_400_000).toISOString() :
            progress.load(localStorage).find(item => item.id === evaluated.id)?.reviewAt ?? null, mock: evaluated.mock,
          ...(evaluated.mode === "spoken" ? { mode: "spoken" } : {})
        };
        progress.save(localStorage, entry);
        return true;
      } catch {
        return false;
      }
    }

    function renderFeedback(focus = true) {
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
      if (result.mode === "spoken") element("span", "Spoken answer", head, "comm-coach-badge");

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
        followUp = draft.followUp = result.followUp;
        draft.followUpPrompt = result.feedback.followUp;
        result = initial = null;
        delete draft.result;
        delete draft.initial;
        clearSpoken();
        container.querySelector(".comm-coach-followup")?.remove();
        draft.followUpAnswer = "";
        mountFollowUp();
        output.replaceChildren();
        showControls();
        input.focus();
      });

      const actions = element("div", undefined, view, "acts comm-coach-actions");
      button(actions, "Try again", () => {
        const record = result.mode === "spoken" && container.closest("form")?.querySelector("#comm-recorder button");
        (record || input).focus();
      });
      if (initial.id !== result.id) button(actions, "Compare attempts", compare);
      button(actions, "Review again tomorrow", () => {
        showStatus(save(true) ? "Marked for review tomorrow." : "Browser storage could not mark this question for review.");
      });
      if (focus) heading.focus();
    }

    function mountFollowUp() {
      const label = element("label", draft.followUpPrompt, undefined, "comm-coach-followup");
      input = element("textarea", undefined, label);
      input.rows = 4;
      input.value = draft.followUpAnswer ?? "";
      input.oninput = () => { draft.followUpAnswer = input.value; };
      transcript.before(label);
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
        const modes = initial.mode === "spoken" || result.mode === "spoken";
        for (const [label, entry] of [["Earlier", initial], ["Revised", result]]) {
          const column = element("div", undefined, columns);
          element("h5", `${label}${modes ? " · " + (entry.mode === "spoken" ? "spoken" : "written") : ""} · ${score(entry.feedback.overall)}`, column);
          element("p", entry.answer, column, "comm-answer");
        }
      }
      area.focus();
    }

    if (followUp) mountFollowUp();
    if (draft.spoken && draft.spoken.recording === take()) renderSpoken(take(), draft.spoken, false);
    else if (draft.spoken) clearSpoken();
    if (result) renderFeedback(false);
    showStatus(draft.message ?? "");
    if (signedIn()) {
      context.access?.(true);
      box.open = true;
    }
    if (draft.evaluating) context.processing?.(true);
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
          ...(Number.isInteger(usage.transcriptionsToday) ? [
            ["Transcriptions today", `${usage.transcriptionsToday} of ${usage.transcriptionsToday + usage.remainingTranscriptionsToday}`],
            ["Audio transcribed today", `${Math.round(usage.audioSecondsToday / 60)} min · free Workers AI allocation`]
          ] : []),
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
        const averages = group => Object.fromEntries(Object.keys(skills).map(skill => {
          const values = group.map(row => row.scores[skill]).filter(value => value !== null);
          return [skill, values.length ? Number(average(values).toFixed(1)) : null];
        }));
        // Written and spoken answers are scored on the same skills but reported separately.
        const groups = [["Written", live.filter(row => row.mode !== "spoken")], ["Spoken", live.filter(row => row.mode === "spoken")]]
          .filter(([, group]) => group.length);
        if (groups.length > 1) {
          const split = element("ul", undefined, section, "comm-coach-modes");
          for (const [label, group] of groups) {
            element("li", `${label} · ${group.length} saved · average ${score(average(group.map(row => row.overall)))} / 5`, split);
          }
        }
        const bySkill = details(section, "Average AI scores by skill");
        for (const [label, group] of groups) {
          if (groups.length > 1) element("h4", label, bySkill);
          skillBars(bySkill, averages(group));
        }
        const questions = details(section, "AI scores by question", "comm-coach-questions");
        const items = element("ul", undefined, questions);
        for (const entry of progress.byQuestion(rows)) {
          const name = bank.find(q => q.id === entry.questionId)?.prompt ?? entry.questionId;
          const review = entry.reviewAt ? ` · review ${new Date(entry.reviewAt).toLocaleDateString()}` : "";
          element("li", `${name} · latest ${score(entry.latest)} · best ${score(entry.best)} · ` +
            `${entry.attempts} ${entry.attempts === 1 ? "attempt" : "attempts"}` +
            `${entry.spoken ? ` (${entry.spoken} spoken)` : ""}${review}`, items);
        }
      }
      const attempts = element("ul", undefined, section, "comm-coach-history");
      for (const row of rows.slice().reverse()) {
        const name = bank.find(q => q.id === row.questionId)?.prompt ?? row.questionId;
        const line = element("li", undefined, attempts);
        element("p", `${row.mock ? "Mock · " : ""}${row.mode === "spoken" ? "Spoken · " : ""}${name} · ${score(row.overall)} / 5 · ${new Date(row.at).toLocaleDateString()}` +
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

  window.DrillCoach = {
    mount, showProgress, recordingChanged: () => refresh?.(),
    clear: () => { instance++; dispose?.(); dispose = refresh = null; }
  };
})();
