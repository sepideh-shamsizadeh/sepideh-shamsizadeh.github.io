(function () {
  const root = document.getElementById("communication");
  const panel = document.getElementById("communication-view");
  const status = document.getElementById("communication-status");
  const content = window.DrillCommunicationContent;
  const model = window.DrillCommunicationModel;
  const source = root.questionBank;
  if (!content || !model || !source?.cards?.length) return;

  const { categories, lessons } = content;
  const { skills, scale } = model;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const option = (value, label, current) =>
    `<option value="${escape(value)}"${value === current ? " selected" : ""}>${escape(label)}</option>`;
  const fields = form => Object.fromEntries(new FormData(form));
  const formatScore = value => value === null ? "—" : `${value.toFixed(1)} / 5`;

  const bank = content.questionBank(source.cards, source.topics);
  if (!bank.length) return;
  let state = model.empty();
  let view = "practice";
  let filters = { topic: "", category: "" };
  let question;
  let activeLesson = null;
  const visitedLessons = new Set();
  let interval;
  let timerSeconds = "";
  let deadline = 0;
  let draft = {};
  let draftKey = "";
  const drafts = new Map();
  const reviewText = new Map();
  const coachDrafts = new Map();

  function announce(message) {
    status.textContent = message;
  }

  function persist(change) {
    try {
      state = model.update(window.localStorage, change);
      return true;
    } catch {
      announce("The change could not be saved. Check browser storage or reload if a session changed in another tab.");
      return false;
    }
  }

  function render(focus = false) {
    window.DrillCoach?.clear();
    window.DrillRecorder?.stop();
    clearInterval(interval);
    for (const button of root.querySelectorAll("[data-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    }
    if (view === "lessons") renderLessons();
    if (view === "progress") {
      renderProgress();
      window.DrillCoach?.showProgress(panel, bank);
    }
    if (view === "practice") renderPractice();
    if (view === "daily") renderDaily();
    if (focus) panel.querySelector("[data-heading]")?.focus();
  }

  function capture() {
    const form = panel.querySelector("#comm-assessment");
    if (!form) return;
    draft = {
      ...fields(form),
      example: !panel.querySelector("#comm-example").hidden,
      hint: !panel.querySelector("#comm-hint").hidden
    };
    drafts.set(draftKey, { draft, deadline });
  }

  function resetExercise(key) {
    window.DrillRecorder?.discard(draftKey);
    drafts.delete(draftKey);
    coachDrafts.delete(draftKey);
    draftKey = key;
    draft = {};
    deadline = 0;
  }

  function showView(next) {
    if (next === view) return;
    capture();
    view = next;
    announce("");
    render(true);
  }

  root.querySelector("nav").addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (button) showView(button.dataset.view);
  });

  function renderPractice() {
    const topics = new Map(bank.map(q => [q.topic, q.topicLabel]));
    const categoriesForTopic = new Set(bank.filter(q => !filters.topic || q.topic === filters.topic).map(q => q.category));
    const topicsForCategory = new Set(bank.filter(q => !filters.category || q.category === filters.category).map(q => q.topic));
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Practice</h2>
      <div class="comm-grid comm-filters">
        <div><label for="comm-category">Category</label><select id="comm-category">${option("", "All categories", filters.category)}
          ${Object.entries(categories).filter(([id]) => categoriesForTopic.has(id))
            .map(([id, [label]]) => option(id, label, filters.category)).join("")}</select></div>
        <div><label for="comm-topic">Topic</label><select id="comm-topic">${option("", "All topics", filters.topic)}
          ${[...topics].filter(([id]) => topicsForCategory.has(id))
            .map(([id, label]) => option(id, label, filters.topic)).join("")}</select></div>
        <button type="button" id="comm-random">Random practice</button>
      </div>
      <div class="comm-block" id="comm-exercise"></div>`;
    for (const filter of ["category", "topic"]) {
      panel.querySelector(`#comm-${filter}`).onchange = event => {
        filters[filter] = event.target.value;
        nextQuestion();
        panel.querySelector(`#comm-${filter}`).focus();
      };
    }
    panel.querySelector("#comm-random").onclick = () => {
      filters = { category: "", topic: "" };
      nextQuestion(true);
    };
    renderExercise(question);
  }

  function nextQuestion(focus = false, skipping = false) {
    const selected = model.selectQuestion(bank, state.attempts, {
      topic: filters.topic, category: filters.category ? [filters.category] : undefined,
      exclude: question ? [question.id] : []
    });
    if (skipping && selected?.id === question?.id) {
      render();
      announce("Question skipped. This is the only question for these filters. Change a filter or try Random practice.");
      panel.querySelector("#comm-prompt")?.focus();
      return;
    }
    question = selected;
    resetExercise("");
    render();
    if (focus) panel.querySelector("#comm-prompt")?.focus();
  }

  function renderExercise(current, session, prior) {
    const mount = panel.querySelector("#comm-exercise");
    if (!current) {
      mount.textContent = "No exercises match these filters.";
      return;
    }
    const step = session?.steps[session.index];
    const key = session ? `${session.id}:${session.index}` : current.id;
    if (draftKey !== key) {
      draftKey = key;
      draft = drafts.get(key)?.draft ?? {};
      deadline = drafts.get(key)?.deadline ?? 0;
    }
    const [label, structure] = categories[current.category];
    const ratingFields = Object.entries(skills).filter(([id]) => id !== "reasoning" || current.reasoning);
    const timerOptions = step ? [[String(step.minutes * 60), `${step.minutes} min (step budget)`]] : [];
    timerOptions.push(["60", "60 seconds"], ["90", "90 seconds"], ["120", "120 seconds"]);
    const duration = draft.duration ?? (step ? String(step.minutes * 60) : timerSeconds);
    const durations = new Map([["", "Off"], ...timerOptions.filter(([value], index) =>
      timerOptions.findIndex(([candidate]) => candidate === value) === index)]);
    mount.innerHTML = `
      <article class="comm-card">
        <span class="comm-kicker">${escape(current.topicLabel)} · ${escape(label)}</span>
        <h3 class="q" id="comm-prompt" tabindex="-1">${escape(current.prompt)}</h3>
        ${step?.review ? `<p>Review your earlier attempt, then give a revised answer.</p>
          <p>Earlier assessment · ${formatScore(model.score(prior))}</p>
          ${prior?.answer ? `<p class="comm-answer">${escape(prior.answer)}</p>` : ""}
          ${prior?.notes ? `<p class="comm-answer">Earlier notes · ${escape(prior.notes)}</p>` : ""}` : ""}
        <form id="comm-assessment">
          <div class="timer">
            <div><label for="comm-time">Countdown</label><select name="duration" id="comm-time">${[...durations].map(([value, text]) =>
              option(value, text, duration)).join("")}</select></div>
            <button type="button" id="comm-start">Start timer</button>
            <button type="button" id="comm-stop">Reset timer</button>
            <span role="timer" class="clock" id="comm-clock" aria-label="Time remaining"></span>
          </div>
          <button class="comm-disclosure" type="button" aria-controls="comm-hint" aria-expanded="${Boolean(draft.hint)}">Answer structure hint</button>
          <p id="comm-hint" class="comm-reveal" ${draft.hint ? "" : "hidden"}>${escape(structure)}</p>
          <fieldset class="comm-answer-modes">
            <legend class="sr-only">Answer mode</legend>
            <label><input type="radio" name="answerMode" value="written"${draft.answerMode === "spoken" ? "" : " checked"}>Written Answer</label>
            <label><input type="radio" name="answerMode" value="spoken"${draft.answerMode === "spoken" ? " checked" : ""}>Spoken Answer</label>
          </fieldset>
          <div id="comm-written" class="comm-block">
            <label for="comm-written-answer">Written answer</label>
            <textarea id="comm-written-answer" name="answer" rows="4" aria-describedby="comm-answer-count">${escape(draft.answer ?? "")}</textarea>
            <small id="comm-answer-count"></small>
          </div>
          <div class="comm-block" id="comm-recorder" hidden></div>
          <div class="comm-block" id="comm-coach"></div>
          <button class="comm-disclosure" type="button" aria-controls="comm-example" aria-expanded="${Boolean(draft.example)}">${draft.example ? "Hide example answer" : "Show example answer"}</button>
          <div id="comm-example" class="comm-reveal" ${draft.example ? "" : "hidden"}>
            <p>${escape(current.example)}</p>
            ${current.source ? `<details><summary>Related DRILL flashcard</summary><p><strong>${escape(current.source.q)}</strong></p>
              <p>${escape(current.source.a)}</p></details>` : ""}
          </div>
          <details class="comm-block" id="comm-self"><summary>Optional self-assessment</summary>
            <p>Choose a rating for each skill to save a self-assessment.</p>
            <details><summary>Scoring scale</summary><ol>${scale.map(text => `<li>${escape(text)}</li>`).join("")}</ol></details>
            <div class="comm-grid">${ratingFields.map(([id, text]) => `<div>
              <label for="comm-rate-${id}">${escape(text)}</label>
              <select id="comm-rate-${id}" name="${id}">${option("", "Select rating", draft[id] ?? "")}
              ${scale.map((_, index) => option(String(index + 1), index + 1, draft[id])).join("")}</select></div>`).join("")}</div>
          </details>
          <label class="comm-block">Personal notes (optional)
            <textarea name="notes" rows="2">${escape(draft.notes ?? "")}</textarea>
          </label>
          <div class="acts">
            <button class="solid" type="submit">${step?.review ? "Save and finish session" : "Save and next question"}</button>
            <button type="button" id="comm-next">${step?.review ? "Skip and finish session" : "Skip to next question"}</button>
          </div>
        </form>
      </article>`;
    for (const button of mount.querySelectorAll(".comm-disclosure")) {
      const target = mount.querySelector(`#${button.getAttribute("aria-controls")}`);
      button.onclick = () => {
        target.hidden = !target.hidden;
        button.setAttribute("aria-expanded", String(!target.hidden));
        if (target.id === "comm-example") {
          button.textContent = target.hidden ? "Show example answer" : "Hide example answer";
        }
      };
    }
    const form = mount.querySelector("form");
    const mode = () => form.elements.answerMode.value;
    const written = form.querySelector("#comm-written");
    const recorder = form.querySelector("#comm-recorder");
    const count = form.querySelector("#comm-answer-count");
    function drawAnswerMode() {
      written.hidden = mode() !== "written";
      recorder.hidden = mode() !== "spoken";
    }
    function countAnswer() {
      const answer = form.elements.answer.value.trim();
      const length = Array.from(answer).length;
      const exceedsLimit = new TextEncoder().encode(answer).length > 2400;
      count.textContent = `${length.toLocaleString()} / 2,400 characters` +
        (exceedsLimit ? " · Shorten this answer to fit the 2,400-byte limit." : "");
    }
    drawAnswerMode();
    countAnswer();
    form.elements.answer.addEventListener("input", countAnswer);
    for (const control of form.elements.answerMode) control.addEventListener("change", () => {
      if (mode() === "written") window.DrillRecorder?.stop();
      drawAnswerMode();
      window.DrillCoach?.recordingChanged();
    });
    // Recording is public. The coach (owner-only) can transcribe the take for this exercise.
    window.DrillRecorder?.mount(form.querySelector("#comm-recorder"), key, {
      onChange: () => window.DrillCoach?.recordingChanged()
    });
    const self = form.querySelector("#comm-self");
    const coachDraft = coachDrafts.get(key) ?? {};
    coachDrafts.set(key, coachDraft);
    window.DrillCoach?.mount(form.querySelector("#comm-coach"), current, form.elements.answer, {
      draft: coachDraft, mode,
      selectWritten: () => {
        form.elements.answerMode.value = "written";
        drawAnswerMode();
      },
      access: enabled => { self.hidden = enabled; },
      processing: busy => {
        recorder.inert = busy;
        for (const control of form.querySelectorAll('[type="submit"], #comm-next, [name="answerMode"]')) control.disabled = busy;
      },
      session: session?.id, recording: () => window.DrillRecorder?.get(key) ?? null
    });
    const timer = form.elements.duration;
    const start = mount.querySelector("#comm-start");
    const stop = mount.querySelector("#comm-stop");
    const clock = mount.querySelector("#comm-clock");

    function drawTimer() {
      const seconds = deadline ? model.remaining(deadline) : Number(timer.value);
      clock.textContent = timer.value ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "";
      start.disabled = !timer.value || Boolean(deadline && seconds);
      stop.disabled = !deadline;
      if (deadline && seconds === 0) {
        clearInterval(interval);
        announce("Time is up. You can finish your answer.");
      }
    }

    timer.onchange = () => {
      if (!session) timerSeconds = timer.value;
      deadline = 0;
      clearInterval(interval);
      drawTimer();
    };
    start.onclick = () => {
      clearInterval(interval);
      announce("");
      deadline = Date.now() + Number(timer.value) * 1000;
      drawTimer();
      interval = setInterval(drawTimer, 250);
    };
    stop.onclick = () => {
      clearInterval(interval);
      deadline = 0;
      announce("");
      drawTimer();
    };
    drawTimer();
    if (deadline && model.remaining(deadline)) interval = setInterval(drawTimer, 250);

    function finish(skip) {
      const evaluated = coachDraft.results?.[mode()] ??
        (coachDraft.assessed?.mode === mode() ? coachDraft.assessed : undefined);
      const spoken = mode() === "spoken";
      const values = skip ? {} : fields(form);
      if (spoken) values.answer = coachDraft.spoken?.text ?? "";
      if (self.hidden) for (const skill of Object.keys(skills)) delete values[skill];
      const attempt = model.assessment(current, values, new Date(), spoken && !skip ? "spoken" : "written", {
        optional: true, skip, ai: evaluated && { id: evaluated.id, overall: evaluated.feedback.overall }
      });
      if (!persist(data => model.recordAttempt(data, attempt, session))) return;
      if (session && !step.review && !skip) {
        reviewText.set(`${session.id}:${current.id}`, { answer: evaluated?.answer ?? attempt.answer, notes: attempt.notes });
      }
      resetExercise("");
      announce(step?.review ? "Session complete." : skip ? "Question skipped." : "Practice saved.");
      if (session) {
        if (step.review) reviewText.clear();
        render();
        (panel.querySelector("#comm-prompt") ?? panel.querySelector("[data-heading]")).focus();
      } else nextQuestion(true, skip);
    }
    form.onsubmit = event => {
      event.preventDefault();
      finish(false);
    };
    mount.querySelector("#comm-next").onclick = () => finish(true);
  }

  function renderDaily() {
    const session = state.active;
    if (session) {
      const step = session.steps[session.index];
      const prior = step.review ? state.attempts.filter(attempt => attempt.sessionId === session.id && model.kind(attempt) !== "skipped")
        .sort((a, b) => (model.score(a) ?? Infinity) - (model.score(b) ?? Infinity))[0] : undefined;
      panel.innerHTML = `
        <h2 tabindex="-1" data-heading>${session.mode === "daily" ? "Daily practice" : "Quick practice"}</h2>
        <div class="comm-session">
          <p class="comm-current">Step ${session.index + 1} of ${session.steps.length} · ${escape(step.label)} · ${escape(step.minutes)} min</p>
          <progress aria-label="Session steps completed" value="${session.index}" max="${session.steps.length}"></progress>
          <p>${session.steps.length - session.index - 1} steps after this one</p>
        </div>
        <div id="comm-exercise"></div>
        <details class="comm-block"><summary>End this session early</summary>
          <p>Saved attempts will still count toward your progress.</p>
          <button type="button" id="comm-end">End session</button>
        </details>`;
      const text = prior && reviewText.get(`${session.id}:${prior.questionId}`);
      renderExercise(bank.find(q => q.id === (prior?.questionId ?? step.questionId ?? session.steps[0].questionId)), session, prior && { ...prior, ...text });
      panel.querySelector("#comm-end").onclick = () => {
        if (!persist(data => {
          if (data.active?.id !== session.id || data.active.index !== session.index) throw new Error("Session changed");
          data.active = null;
        })) return;
        resetExercise("");
        reviewText.clear();
        announce("Session ended.");
        render(true);
      };
      return;
    }
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Daily practice</h2>
      <div class="comm-card">
        <h3>20-minute session plan</h3>
        <ol class="comm-plan">${model.dailySteps.map((step, index) => `
          <li><span>${escape(step.label)}</span><strong>${state.minutes[index]} min</strong></li>`).join("")}</ol>
        <form id="comm-plan" novalidate>
          <div class="acts">
            <button type="submit" class="solid">Start daily practice</button>
            <button type="button" id="comm-quick">Start 5-minute quick practice</button>
          </div>
          <details id="comm-settings" class="comm-block">
            <summary>Customize session durations</summary>
            <p>Set a whole number of minutes for each step. The total must be 20.</p>
            <div class="comm-grid">${model.dailySteps.map((step, index) => `
              <label>${escape(step.label)} (min)
                <input type="number" name="minutes" min="1" max="16" step="1" value="${state.minutes[index]}" required>
              </label>`).join("")}</div>
          </details>
        </form>
      </div>`;
    const form = panel.querySelector("#comm-plan");
    const start = (mode, minutes) => {
      if (!persist(data => {
        if (data.active) throw new Error("Session already active");
        data.minutes = minutes;
        data.active = {
          id: crypto.randomUUID(), mode, index: 0,
          steps: model.sessionPlan(bank, data.attempts, mode, minutes)
        };
      })) return;
      announce("");
      render(true);
    };
    form.onsubmit = event => {
      event.preventDefault();
      const minutes = new FormData(form).getAll("minutes").map(Number);
      if (!model.validMinutes(minutes)) {
        form.querySelector("#comm-settings").open = true;
        announce("Use positive whole minutes. The five steps must add up to 20 minutes.");
        return;
      }
      start("daily", minutes);
    };
    panel.querySelector("#comm-quick").onclick = () => start("quick", state.minutes);
  }

  function renderLessons() {
    if (activeLesson !== null) {
      renderLesson();
      return;
    }
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Lessons</h2>
      <div class="comm-lesson-grid">${lessons.map(([id, title, objective, explanation], index) => {
        const complete = Boolean(state.lessons[id]);
        const action = complete ? "Review lesson" : visitedLessons.has(id) ? "Continue lesson" : "Start lesson";
        return `<article class="comm-card comm-lesson">
          <header>
            <p class="comm-kicker">Lesson ${index + 1} of ${lessons.length}</p>
            <h3>${escape(title)}</h3>
          </header>
          <p>${escape(explanation)}</p>
          <p><strong>Objective.</strong> ${escape(objective)}</p>
          <p class="comm-lesson-status">${complete ? "Complete" : visitedLessons.has(id) ? "In progress" : "To do"}</p>
          <button type="button" data-lesson="${index}" aria-label="${action}: ${escape(title)}">${action}</button>
        </article>`;
      }).join("")}</div>`;
    for (const button of panel.querySelectorAll("[data-lesson]")) {
      button.onclick = () => {
        activeLesson = Number(button.dataset.lesson);
        visitedLessons.add(lessons[activeLesson][0]);
        render(true);
      };
    }
  }

  function renderLesson() {
    const [id, title, objective, explanation, framework, weak, improved, exercises] = lessons[activeLesson];
    const complete = Boolean(state.lessons[id]);
    panel.innerHTML = `
      <button type="button" id="comm-lesson-back">All lessons</button>
      <article class="comm-card comm-block">
        <p class="comm-kicker">Lesson ${activeLesson + 1} of ${lessons.length}</p>
        <h2 tabindex="-1" data-heading>${escape(title)}</h2>
        <p><strong>Objective.</strong> ${escape(objective)}</p>
        <section><h3>How it works</h3><p>${escape(explanation)}</p></section>
        <section><h3>Communication framework</h3><p>${escape(framework)}</p></section>
        <div class="comm-grid comm-block">
          <section class="comm-reveal"><h3>Weak answer</h3><p>${escape(weak)}</p></section>
          <section class="comm-reveal"><h3>Improved answer</h3><p>${escape(improved)}</p></section>
        </div>
        <section><h3>Try it</h3><ol>${exercises.map(text => `<li>${escape(text)}</li>`).join("")}</ol></section>
        <p class="comm-lesson-status">${complete ? "Complete" : "In progress"}</p>
        <div class="acts">
          <button type="button" class="${complete ? "" : "solid"}" id="comm-lesson-complete">${complete ? "Mark as incomplete" : "Mark as completed"}</button>
          ${activeLesson < lessons.length - 1 ? '<button type="button" id="comm-lesson-next">Next lesson</button>' : ""}
        </div>
      </article>`;
    panel.querySelector("#comm-lesson-back").onclick = () => {
      const index = activeLesson;
      activeLesson = null;
      announce("");
      render();
      panel.querySelector(`[data-lesson="${index}"]`).focus();
    };
    panel.querySelector("#comm-lesson-complete").onclick = () => {
      if (!persist(data => {
        if (complete) delete data.lessons[id];
        else data.lessons[id] = model.dayKey();
      })) return;
      announce(complete ? "Lesson marked incomplete." : "Lesson completed.");
      render();
      panel.querySelector("#comm-lesson-complete").focus();
    };
    const next = panel.querySelector("#comm-lesson-next");
    if (next) next.onclick = () => {
      activeLesson += 1;
      visitedLessons.add(lessons[activeLesson][0]);
      announce("");
      render(true);
    };
  }

  function renderProgress() {
    let historicalAI = [];
    try { historicalAI = window.DrillCoachProgress?.load(localStorage).filter(row => !row.mock) ?? []; }
    catch { /* An unreadable score history should not hide practice progress. */ }
    const stats = model.progress(state, new Date(), historicalAI);
    const stat = (value, label) => `<div class="stat"><b>${escape(value)}</b><span>${escape(label)}</span></div>`;
    if (!stats.attempts && !stats.counts.ai) {
      panel.innerHTML = `
        <h2 tabindex="-1" data-heading>Progress</h2>
        <div class="comm-card">
          <h3>No practice attempts yet</h3>
          <p>Save your first answer or spoken practice to see activity here.</p>
          ${stat(`${stats.lessons} / ${lessons.length}`, "Lessons completed")}
          <div class="acts"><button id="comm-first-practice" type="button" class="solid">Start practice</button></div>
        </div>`;
      panel.querySelector("#comm-first-practice").onclick = () => showView("practice");
      return;
    }
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Progress</h2>
      <div class="comm-grid comm-stats">
        ${stat(stats.completed, "Questions practiced")}
        ${stat(stats.counts.ai, "AI-assessed questions")}${stat(stats.counts.self, "Self-assessed questions")}
        ${stat(stats.counts.unassessed, "Practiced without assessment")}${stat(stats.counts.skipped, "Skipped questions")}
        ${stats.spoken ? stat(formatScore(stats.writtenAverage), "Average self-assessment · written") +
          stat(formatScore(stats.spokenAverage), "Average self-assessment · spoken") +
          stat(stats.spoken, "Spoken attempts") : stat(formatScore(stats.average), "Average self-assessment")}
        ${stat(`${stats.lessons} / ${lessons.length}`, "Lessons completed")}
        ${stat(`${stats.streak} days`, "Practice streak")}
        ${stat(stats.daily, stats.dailyToday ? "Daily sessions · completed today" : "Daily sessions completed")}
        ${stat(stats.quick, "Quick sessions completed")}
      </div>
      <div class="comm-grid">
        <section class="comm-card"><h3>Self-assessment by skill</h3>
          <dl class="comm-scores">${Object.entries(stats.bySkill).map(([id, value]) =>
            `<div><dt>${escape(skills[id])}</dt><dd>${value === null ? "No ratings yet" : formatScore(value)}</dd></div>`).join("")}</dl>
        </section>
        <section class="comm-card"><h3>Questions and categories to revisit</h3>
          <p>Based on the latest self-assessment for each question. Scores below 3 are flagged.</p>
          ${stats.weak.length ? `<ul>${stats.weak.map(attempt => `<li>
            <button type="button" data-retry="${escape(attempt.questionId)}">${escape(bank.find(q => q.id === attempt.questionId)?.prompt ?? attempt.questionId)}</button>
            ${formatScore(model.score(attempt))}</li>`).join("")}</ul>` : "<p>No questions flagged.</p>"}
          ${stats.weakCategories.length ? `<ul>${stats.weakCategories.map(([id, value]) =>
            `<li>${escape(categories[id]?.[0] ?? id)}: ${formatScore(value)}</li>`).join("")}</ul>` : "<p>No categories flagged.</p>"}
        </section>
      </div>
      <h3 class="comm-block" id="comm-week-heading">Last seven days</h3>
      <div class="comm-table" role="region" aria-labelledby="comm-week-heading" tabindex="0"><table>
        <thead><tr><th scope="col">Date</th><th scope="col">Attempts</th><th scope="col">Average self-assessment</th><th scope="col">Sessions</th></tr></thead>
        <tbody>${stats.weekly.map(day =>
          `<tr><td>${day.day}</td><td>${day.attempts}</td><td>${formatScore(day.average)}</td><td>${day.sessions}</td></tr>`).join("")}</tbody>
      </table></div>`;
    for (const button of panel.querySelectorAll("[data-retry]")) {
      const retry = bank.find(q => q.id === button.dataset.retry);
      button.disabled = !retry;
      button.onclick = () => {
        filters = { category: "", topic: "" };
        question = retry;
        resetExercise("");
        view = "practice";
        render();
        panel.querySelector("#comm-prompt").focus();
      };
    }
  }
  try {
    state = model.load(window.localStorage);
  } catch {
    announce("Communication progress could not be loaded. Check your browser storage settings.");
  }
  question = model.selectQuestion(bank, state.attempts);
  render();
  document.getElementById("communication-loading").hidden = true;
  panel.setAttribute("aria-busy", "false");
  for (const button of root.querySelectorAll("[data-view]")) button.disabled = false;
})();
