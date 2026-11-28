(function () {
  // Public spoken-answer recorder. Recordings stay in this page's memory: they are never written to
  // storage, and nothing is uploaded unless the owner explicitly chooses to transcribe.
  const MAX_SECONDS = 300;
  const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
  const recordings = new Map();
  let active = null, generation = 0;

  const supported = () => typeof window.MediaRecorder === "function" && Boolean(navigator.mediaDevices?.getUserMedia) &&
    window.isSecureContext !== false;
  const clock = seconds => {
    const whole = Math.floor(seconds);
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
  };

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

  function discard(key) {
    if (active?.key === key) {
      active.dropped = true;
      stop();
    }
    const recording = recordings.get(key);
    if (recording) URL.revokeObjectURL(recording.url);
    recordings.delete(key);
  }

  // Stop any recording in progress (for example when the view changes). A finished take is kept.
  function stop() {
    if (!active) return;
    const session = active;
    active = null;
    session.finish();
  }

  function mount(container, key, { onChange } = {}) {
    const mine = ++generation;
    const current = () => mine === generation && container.isConnected;
    container.replaceChildren();
    const box = element("section", undefined, container, "comm-recorder");
    box.setAttribute("aria-labelledby", "comm-recorder-title");
    element("h4", "Spoken answer", box).id = "comm-recorder-title";
    const controls = element("div", undefined, box, "acts comm-recorder-controls");
    const time = element("span", "", box, "comm-recorder-time");
    time.setAttribute("role", "timer");
    time.setAttribute("aria-label", "Recording time");
    const status = element("p", "", box, "comm-recorder-status");
    status.setAttribute("role", "status");
    const playback = element("div", undefined, box);
    const say = message => { if (current()) status.textContent = message; };

    if (!supported()) {
      element("p", "Recording is not available in this browser. You can still answer aloud with the timer.", box, "comm-coach-note");
      controls.remove();
      time.remove();
      return;
    }

    function draw() {
      if (!current()) return;
      controls.replaceChildren();
      playback.replaceChildren();
      const take = recordings.get(key);
      if (active?.key === key) {
        const paused = active.recorder.state === "paused";
        button(controls, paused ? "Resume" : "Pause", () => {
          if (!active) return;
          if (active.recorder.state === "paused") active.resume();
          else active.pause();
          draw();
        });
        button(controls, "Stop recording", stop, "solid");
        tick();
        return;
      }
      time.textContent = "";
      if (!take) {
        button(controls, "Start recording", start, "solid");
        element("p", "Up to 5 minutes. The recording stays on this page and is not saved.", playback, "comm-coach-note");
        return;
      }
      const audio = element("audio", undefined, playback);
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = take.url;
      audio.setAttribute("aria-label", "Playback of your spoken answer");
      element("p", `Recorded ${clock(take.seconds)}`, playback, "comm-recorder-length");
      button(controls, "Record again", () => {
        discard(key);
        onChange?.();
        start();
      });
      button(controls, "Delete recording", () => {
        discard(key);
        onChange?.();
        say("Recording deleted.");
        draw();
      }, "comm-coach-link");
    }

    function tick() {
      if (!current() || active?.key !== key) return;
      const seconds = active.elapsed();
      time.textContent = `${clock(seconds)} / ${clock(MAX_SECONDS)}`;
    }

    async function start() {
      if (active) return;
      say("Waiting for microphone permission…");
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (error) {
        say(error?.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser settings to record."
          : "No microphone could be used. Check that one is connected.");
        return;
      }
      if (!current() || container.hidden || container.inert || active) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const mimeType = preferred.find(type => MediaRecorder.isTypeSupported?.(type));
      const options = mimeType ? { mimeType, audioBitsPerSecond: /opus/.test(mimeType) ? 32_000 : 64_000 } : {};
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        stream.getTracks().forEach(track => track.stop());
        say("Recording could not start in this browser.");
        return;
      }
      const chunks = [];
      let total = 0, since = performance.now(), timer, limited = false;
      const elapsed = () => total + (recorder.state === "recording" ? (performance.now() - since) / 1000 : 0);
      const session = active = {
        key, recorder, elapsed,
        pause() {
          total = elapsed();
          recorder.pause();
          say("Paused.");
        },
        resume() {
          since = performance.now();
          recorder.resume();
          say("Recording…");
        },
        finish() {
          clearInterval(timer);
          total = elapsed();
          if (recorder.state !== "inactive") recorder.stop();
          else release();
        }
      };
      function release() {
        stream.getTracks().forEach(track => track.stop());
      }
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = () => {
        release();
        if (active === session) active = null;
        const type = (recorder.mimeType || mimeType || chunks[0]?.type || "").toLowerCase();
        if (session.dropped) {
          onChange?.();
          return;
        }
        if (chunks.length && total >= 0.5) {
          discard(key);
          const blob = new Blob(chunks, { type });
          recordings.set(key, { blob, type, seconds: Math.min(total, MAX_SECONDS), url: URL.createObjectURL(blob) });
          say(limited ? "Recording stopped at the 5-minute limit." : "Recording stopped. Play it back or record again.");
        } else say("The recording was too short. Try again.");
        onChange?.();
        draw();
      };
      recorder.onerror = () => {
        say("Recording stopped because of a browser error.");
        session.finish();
      };
      timer = setInterval(() => {
        if (elapsed() >= MAX_SECONDS) {
          limited = true;
          if (active === session) stop();
        } else tick();
      }, 250);
      recorder.start(1000);
      say("Recording…");
      onChange?.();
      draw();
    }

    draw();
  }

  window.DrillRecorder = {
    MAX_SECONDS, mount, discard, stop, get: key => recordings.get(key) ?? null,
    recording: () => Boolean(active)
  };
})();
