(function () {
  const root = document.getElementById("communication");
  const panel = document.getElementById("communication-view");
  const status = document.getElementById("communication-status");
  const content = window.DrillCommunicationContent;
  const model = window.DrillCommunicationModel;
  const { categories, lessons } = content;
  const { skills, scale } = model;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const option = (value, label, current) =>
    `<option value="${escape(value)}"${value === current ? " selected" : ""}>${escape(label)}</option>`;
  const fields = form => Object.fromEntries(new FormData(form));
  const formatScore = value => value === null ? "—" : `${value.toFixed(1)} / 5`;

  let bank = [];
  let state = model.empty();
  let view = "practice";
  let filters = { topic: "", category: "" };
  let question;
  let interval;
  let timerSeconds = "";
  let deadline = 0;
  let draft = {};
  let draftKey = "";
  const drafts = new Map();

  root.addEventListener("drill:question-bank", event => {
    bank = content.questionBank(event.detail.cards, event.detail.topics);
    try {
      state = model.load(window.localStorage);
    } catch {
      announce("Communication progress could not be loaded. Check your browser storage settings.");
    }
    question = model.selectQuestion(bank, state.attempts);
    render();
  });

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
    clearInterval(interval);
    for (const button of root.querySelectorAll("[data-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    }
    if (view === "lessons") renderLessons();
    if (view === "progress") renderProgress();
    if (view === "practice") renderPractice();
    if (view === "daily") renderDaily();
    if (focus) panel.querySelector("[data-heading]")?.focus();
  }

  function capture() {
    const form = panel.querySelector("#comm-assessment");
    if (!form) return;
    draft = {
      ...fields(form),
      example: panel.querySelector("#comm-example").open,
      hint: panel.querySelector("#comm-hint").open
    };
    drafts.set(draftKey, { draft, deadline });
  }

  function resetExercise(key) {
    drafts.delete(draftKey);
    draftKey = key;
    draft = {};
    deadline = 0;
  }

  root.querySelector("nav").addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (!button || button.dataset.view === view) return;
    capture();
    view = button.dataset.view;
    announce("");
    render(true);
  });

  function renderPractice() {
    const topics = new Map(bank.map(q => [q.topic, q.topicLabel]));
    const categoriesForTopic = new Set(bank.filter(q => !filters.topic || q.topic === filters.topic).map(q => q.category));
    const topicsForCategory = new Set(bank.filter(q => !filters.category || q.category === filters.category).map(q => q.topic));
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Practice</h2>
      <div class="comm-grid">
        <label>Category <select id="comm-category">${option("", "All categories", filters.category)}
          ${Object.entries(categories).filter(([id]) => categoriesForTopic.has(id))
            .map(([id, [label]]) => option(id, label, filters.category)).join("")}</select></label>
        <label>Topic <select id="comm-topic">${option("", "All topics", filters.topic)}
          ${[...topics].filter(([id]) => topicsForCategory.has(id))
            .map(([id, label]) => option(id, label, filters.topic)).join("")}</select></label>
      </div>
      <div class="acts"><button type="button" id="comm-random">Random practice</button></div>
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

  function nextQuestion(focus = false) {
    const selected = model.selectQuestion(bank, state.attempts, {
      topic: filters.topic, category: filters.category ? [filters.category] : undefined,
      exclude: question ? [question.id] : []
    });
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
      <article class="card">
        <span class="tag">${escape(current.topicLabel)} · ${escape(label)}</span>
        <h3 class="q" id="comm-prompt" tabindex="-1">${escape(current.prompt)}</h3>
        ${step?.review ? `<p>Review your earlier attempt, then give a revised answer.</p>
          <p>Earlier self-assessment: ${formatScore(model.score(prior))}</p>
          ${prior.answer ? `<p class="comm-answer">${escape(prior.answer)}</p>` : ""}
          ${prior.notes ? `<p class="comm-answer">Earlier notes: ${escape(prior.notes)}</p>` : ""}` : ""}
        <form id="comm-assessment">
          <div class="timer">
            <label>Countdown <select name="duration" id="comm-time">${[...durations].map(([value, text]) =>
              option(value, text, duration)).join("")}</select></label>
            <button type="button" id="comm-start">Start timer</button>
            <button type="button" id="comm-stop">Reset timer</button>
            <span role="timer" class="clock" id="comm-clock" aria-label="Time remaining"></span>
          </div>
          <details id="comm-hint" ${draft.hint ? "open" : ""}><summary>Answer structure hint</summary><p>${escape(structure)}</p></details>
          <label class="comm-block">Written answer (optional)
            <textarea name="answer" rows="4" placeholder="Answer aloud or write here.">${escape(draft.answer ?? "")}</textarea>
          </label>
          <details id="comm-example" class="comm-example" ${draft.example ? "open" : ""}>
            <summary>Example answer</summary>
            <p>${escape(current.example)}</p>
            ${current.source ? `<details><summary>Related DRILL flashcard</summary><p><strong>${escape(current.source.q)}</strong></p>
              <p>${escape(current.source.a)}</p></details>` : ""}
          </details>
          <fieldset>
            <legend>Self-assessment</legend>
            <details><summary>Scoring scale</summary><ol>${scale.map(text => `<li>${escape(text)}</li>`).join("")}</ol></details>
            <div class="comm-grid">${ratingFields.map(([id, text]) => `<label>${escape(text)}
              <select name="${id}" required>${option("", "Select rating", draft[id] ?? "")}
              ${scale.map((_, index) => option(String(index + 1), index + 1, draft[id])).join("")}</select></label>`).join("")}</div>
            <label class="comm-block">Personal notes and knowledge gaps (optional)
              <textarea name="notes" rows="3">${escape(draft.notes ?? "")}</textarea>
            </label>
          </fieldset>
          <div class="acts">
            <button class="solid" type="submit">${step?.review ? "Save and finish session" : "Save and continue"}</button>
            ${session ? "" : '<button type="button" id="comm-next">Skip question</button>'}
          </div>
        </form>
      </article>`;
    const form = mount.querySelector("form");
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
        announce("Time is up. You can finish your answer and self-assessment.");
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

    form.onsubmit = event => {
      event.preventDefault();
      const attempt = model.assessment(current, fields(form));
      if (!attempt) {
        announce("Choose a self-assessment rating for each skill.");
        return;
      }
      if (!persist(data => model.recordAttempt(data, attempt, session))) return;
      resetExercise("");
      announce(step?.review ? "Session complete. Your self-assessments have been saved." : "Self-assessment saved.");
      if (session) {
        render();
        (panel.querySelector("#comm-prompt") ?? panel.querySelector("[data-heading]")).focus();
      } else nextQuestion(true);
    };
    const skip = mount.querySelector("#comm-next");
    if (skip) skip.onclick = () => {
      announce("");
      nextQuestion(true);
    };
  }

  function renderDaily() {
    const session = state.active;
    if (session) {
      const step = session.steps[session.index];
      const prior = step.review ? state.attempts.filter(attempt => attempt.sessionId === session.id)
        .sort((a, b) => model.score(a) - model.score(b))[0] : undefined;
      panel.innerHTML = `
        <h2 tabindex="-1" data-heading>${session.mode === "daily" ? "Daily practice" : "Quick practice"}</h2>
        <p class="comm-current">Step ${session.index + 1} of ${session.steps.length} · ${escape(step.label)} · ${step.minutes} min</p>
        <div id="comm-exercise"></div>
        <details class="comm-block"><summary>End this session early</summary>
          <p>Saved attempts will still count toward your progress.</p>
          <button type="button" id="comm-end">End session</button>
        </details>`;
      renderExercise(bank.find(q => q.id === (prior?.questionId ?? step.questionId)), session, prior);
      panel.querySelector("#comm-end").onclick = () => {
        if (!persist(data => {
          if (data.active?.id !== session.id || data.active.index !== session.index) throw new Error("Session changed");
          data.active = null;
        })) return;
        resetExercise("");
        announce("Session ended.");
        render(true);
      };
      return;
    }
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Daily practice</h2>
      <p>Practice a mix of categories and revisit questions with low self-assessments.</p>
      <form id="comm-plan">
        <fieldset>
          <legend>20-minute session plan</legend>
          <p>Adjust the minutes for each step. The total must be 20.</p>
          <div class="comm-grid">${model.dailySteps.map((step, index) => `
            <label>${escape(step.label)} (min)
              <input type="number" name="minutes" min="1" max="16" step="1" value="${state.minutes[index]}" required>
            </label>`).join("")}</div>
        </fieldset>
        <div class="acts">
          <button type="submit" class="solid">Start 20-minute session</button>
          <button type="button" id="comm-quick">Start 5-minute quick practice</button>
        </div>
      </form>`;
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
        announce("The five steps must add up to 20 minutes.");
        return;
      }
      start("daily", minutes);
    };
    panel.querySelector("#comm-quick").onclick = () => start("quick", state.minutes);
  }

  function renderLessons() {
    panel.innerHTML = `<h2 tabindex="-1" data-heading>Lessons</h2>${lessons.map(
      ([id, title, objective, explanation, framework, weak, improved, exercises]) => `
        <details class="comm-lesson">
          <summary>${escape(title)}<span data-lesson-status>${state.lessons[id] ? " · Complete" : ""}</span></summary>
          <p><strong>Objective.</strong> ${escape(objective)}</p>
          <p>${escape(explanation)}</p>
          <p><strong>Framework.</strong> ${escape(framework)}</p>
          <p><strong>Weak answer.</strong> ${escape(weak)}</p>
          <p><strong>Improved answer.</strong> ${escape(improved)}</p>
          <h3>Try it</h3>
          <ol>${exercises.map(text => `<li>${escape(text)}</li>`).join("")}</ol>
          <label><input type="checkbox" value="${id}" ${state.lessons[id] ? "checked" : ""}> Mark lesson complete</label>
        </details>`).join("")}`;
    for (const checkbox of panel.querySelectorAll("input[type=checkbox]")) {
      checkbox.onchange = () => {
        const id = checkbox.value;
        if (!persist(data => {
          if (checkbox.checked) data.lessons[id] = model.dayKey();
          else delete data.lessons[id];
        })) checkbox.checked = Boolean(state.lessons[id]);
        else announce(checkbox.checked ? "Lesson completed." : "Lesson marked incomplete.");
        checkbox.closest("details").querySelector("[data-lesson-status]").textContent =
          checkbox.checked ? " · Complete" : "";
      };
    }
  }

  function renderProgress() {
    const stats = model.progress(state);
    const stat = (value, label) => `<div class="stat"><b>${escape(value)}</b><span>${escape(label)}</span></div>`;
    panel.innerHTML = `
      <h2 tabindex="-1" data-heading>Progress</h2>
      <div class="comm-grid comm-stats">
        ${stat(stats.completed, "Exercises completed")}${stat(stats.attempts, "Attempts saved")}
        ${stat(formatScore(stats.average), "Average self-assessment")}
        ${stat(`${stats.lessons} / ${lessons.length}`, "Lessons completed")}
        ${stat(`${stats.streak} days`, "Practice streak")}
        ${stat(stats.daily, stats.dailyToday ? "Daily sessions · completed today" : "Daily sessions completed")}
        ${stat(stats.quick, "Quick sessions completed")}
      </div>
      <div class="comm-grid">
        <section><h3>Self-assessment by skill</h3>
          <ul>${Object.entries(stats.bySkill).map(([id, value]) => `<li>${escape(skills[id])}: ${formatScore(value)}</li>`).join("")}</ul>
        </section>
        <section><h3>Questions and categories to revisit</h3>
          <p>Based on the latest self-assessment for each question. Scores below 3 are flagged.</p>
          ${stats.weak.length ? `<ul>${stats.weak.map(attempt => `<li>
            <button type="button" data-retry="${escape(attempt.questionId)}">${escape(bank.find(q => q.id === attempt.questionId)?.prompt ?? attempt.questionId)}</button>
            ${formatScore(model.score(attempt))}</li>`).join("")}</ul>` : "<p>No questions flagged.</p>"}
          ${stats.weakCategories.length ? `<ul>${stats.weakCategories.map(([id, value]) =>
            `<li>${escape(categories[id]?.[0] ?? id)}: ${formatScore(value)}</li>`).join("")}</ul>` : "<p>No categories flagged.</p>"}
        </section>
      </div>
      <h3>Last seven days</h3>
      <div class="comm-table"><table>
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
})();
