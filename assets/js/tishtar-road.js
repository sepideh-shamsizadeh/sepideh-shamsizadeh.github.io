/* SVG path driving. Project data is read-only; exploration is local UI state. */
(function () {
  "use strict";
  var root = document.querySelector(".tr-drive");
  if (!root || !window.PointerEvent || !window.DOMPoint) return;
  var data;
  try {
    data = JSON.parse(document.getElementById("tr-drive-data").textContent);
  } catch (_) {
    return;
  }
  var svg = root.querySelector(".tr-road-svg");
  var path = root.querySelector(".tr-road-edge");
  if (!path || !path.getPointAtLength) return;
  var robot = root.querySelector(".tr-robot");
  var dialog = root.querySelector("dialog");
  if (!dialog.showModal) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var total = path.getTotalLength();
  var current = data.milestones.find(function (m) {
    return m.id === data.road_current_milestone_id;
  });
  if (!current || current.status !== "completed") return;
  var stops = data.milestones
    .map(function (milestone, index) {
      var progress = Number(milestone.road_position);
      return {
        milestone: milestone,
        progress: Number.isFinite(progress)
          ? Math.max(0, Math.min(1, progress))
          : (index + 1) / (data.milestones.length + 1),
      };
    })
    .sort(function (a, b) {
      return a.progress - b.progress;
    });
  var currentStop = stops.find(function (s) {
    return s.milestone.id === current.id;
  });
  var length = currentStop.progress * total;
  var heading = null;
  var wheelRotation = 0;
  var activeStop = null;
  var pointer = null;
  var pendingPoint = null;
  var frame = null;
  var suppressClick = false;
  var opener = null;
  var markerLayer = root.querySelector(".tr-road-markers");
  var trail = root.querySelector(".tr-road-trail");
  var description = root.querySelector(".tr-drive-description");
  var title = root.querySelector(".tr-drive-title");
  var state = root.querySelector(".tr-drive-state");
  var mission = root.querySelector(".tr-drive-mission");
  var position = root.querySelector("#tr-road-position");
  var announcement = root.querySelector(".tr-drive-announcement");
  var clamp = function (n, min, max) {
    return Math.max(min, Math.min(max, n));
  };
  var d = path.getAttribute("d");
  [".tr-road-line", ".tr-road-center", ".tr-road-trail"].forEach(
    function (selector) {
      root.querySelector(selector).setAttribute("d", d);
    },
  );

  // Cache full-path geometry once. Pointer moves inspect only a bounded arc-length
  // neighborhood (at most 220 SVG units), never a spatially nearby distant lane.
  var sampleStep = 5;
  var samples = [];
  for (var n = 0; n < total; n += sampleStep)
    samples.push({ length: n, point: path.getPointAtLength(n) });
  samples.push({ length: total, point: path.getPointAtLength(total) });
  function nearestPoint(point, previous) {
    var local = previous !== null;
    var radius = Math.min(110, total * 0.025);
    var low = local ? Math.max(0, previous - radius) : 0;
    var high = local ? Math.min(total, previous + radius) : total;
    var best = local ? previous : 0;
    var bestDistance = Infinity;
    function consider(at, p) {
      p = p || path.getPointAtLength(at);
      var distance = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
      // Break near-ties toward the previous position to resist branch ambiguity.
      if (local) distance += Math.abs(at - previous) * 0.001;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = at;
      }
    }
    consider(low);
    consider(high);
    if (local) consider(previous);
    var start = Math.max(0, Math.ceil(low / sampleStep));
    var end = Math.min(samples.length - 1, Math.floor(high / sampleStep));
    for (var i = start; i <= end; i++)
      consider(samples[i].length, samples[i].point);
    // Refine the best cached sample using actual getPointAtLength geometry.
    for (var step = sampleStep / 2; step >= 0.078125; step /= 2) {
      var center = best;
      consider(clamp(center - step, low, high));
      consider(clamp(center + step, low, high));
    }
    return best;
  }
  function svgPoint(event) {
    var matrix = svg.getScreenCTM();
    return matrix
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(
          matrix.inverse(),
        )
      : null;
  }
  function place(element, at) {
    var point = path.getPointAtLength(at);
    element.style.left = (point.x / 760) * 100 + "%";
    element.style.top = (point.y / 1220) * 100 + "%";
  }
  function statusFor(milestone) {
    return data.statuses.find(function (s) {
      return s.id === milestone.status;
    });
  }
  function nearestStop(at) {
    return stops.reduce(function (best, stop) {
      return Math.abs(stop.progress * total - at) <
        Math.abs(best.progress * total - at)
        ? stop
        : best;
    }, stops[0]);
  }
  function updateSummary(stop) {
    if (activeStop === stop) return;
    if (activeStop) {
      activeStop.button.classList.remove("is-nearest");
      activeStop.button.removeAttribute("aria-current");
    }
    activeStop = stop;
    stop.button.classList.add("is-nearest");
    stop.button.setAttribute("aria-current", "step");
    var phase = data.phases.find(function (p) {
      return p.id === stop.milestone.phase;
    });
    var phaseIndex = data.phases.indexOf(phase) + 1;
    var status = statusFor(stop.milestone);
    mission.textContent = "Mission " + phaseIndex + " of " + data.phases.length;
    root.querySelector(".tr-drive-phase").textContent = phase.title;
    title.textContent = stop.milestone.title;
    description.textContent = stop.milestone.description;
    state.textContent = status.icon + " " + status.label;
    state.className = "tr-drive-state tr-status tr-status--" + status.id;
    robot.setAttribute(
      "aria-label",
      "Drive TISHTAR. " +
        mission.textContent +
        ". Nearest: " +
        stop.milestone.title +
        ". " +
        status.label,
    );
  }
  function drive(at, announce) {
    var before = length;
    length = clamp(at, 0, total);
    root.dataset.progress = String(length / total);
    place(robot, length);
    var back = path.getPointAtLength(Math.max(0, length - 2));
    var ahead = path.getPointAtLength(Math.min(total, length + 2));
    var angle =
      (Math.atan2(ahead.y - back.y, ahead.x - back.x) * 180) / Math.PI;
    heading =
      heading === null
        ? angle
        : heading + (((angle - heading + 540) % 360) - 180);
    robot.style.setProperty("--tr-heading", heading + "deg");
    if (!reduced.matches) {
      wheelRotation += (length - before) * 5;
      root.querySelectorAll(".tr-wheel-spin").forEach(function (wheel) {
        wheel.setAttribute(
          "transform",
          "rotate(" +
            wheelRotation +
            " " +
            wheel.dataset.cx +
            " " +
            wheel.dataset.cy +
            ")",
        );
      });
    }
    trail.setAttribute("stroke-dasharray", length + " " + total);
    // Detect crossings even if a single pointer event passes several stops.
    var crossed = stops.filter(function (stop) {
      var at = stop.progress * total;
      return before < length
        ? at > before && at <= length
        : at < before && at >= length;
    });
    if (crossed.length)
      root.dataset.lastCrossed = (
        length > before ? crossed[crossed.length - 1] : crossed[0]
      ).milestone.id;
    updateSummary(nearestStop(length));
    position.textContent =
      "Exploring " +
      Math.round((length / total) * 100) +
      "% of the road · project completion is unchanged.";
    if (announce)
      announcement.textContent =
        mission.textContent +
        ". " +
        activeStop.milestone.title +
        ". " +
        statusFor(activeStop.milestone).label;
  }

  stops.forEach(function (stop, index) {
    var m = stop.milestone;
    var status = statusFor(m);
    var button = document.createElement("button");
    button.type = "button";
    button.className = "tr-road-marker tr-road-marker--" + m.status;
    button.dataset.milestone = m.id;
    button.setAttribute(
      "aria-label",
      m.title + ". " + status.label + ". Explore milestone",
    );
    button.setAttribute("aria-haspopup", "dialog");
    button.title = m.title + " · " + status.label;
    button.textContent = status.icon;
    if (stop === currentStop) button.classList.add("is-current");
    place(button, stop.progress * total);
    stop.button = button;
    markerLayer.appendChild(button);
    button.addEventListener("click", function () {
      drive(stop.progress * total, true);
      openPanel(stop, button);
    });
    // Highlight only the road interval belonging to each completed milestone.
    // A later bench success never paints earlier, unverified work as complete.
    if (m.status === "completed") {
      var segment = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      var from =
        index === 0
          ? 0
          : ((stops[index - 1].progress + stop.progress) / 2) * total;
      var to =
        index === stops.length - 1
          ? total
          : ((stop.progress + stops[index + 1].progress) / 2) * total;
      segment.setAttribute("d", d);
      segment.setAttribute(
        "stroke-dasharray",
        "0 " + from + " " + (to - from) + " " + total,
      );
      root.querySelector(".tr-road-completed").appendChild(segment);
    }
  });
  // Mission labels occupy the clear spaces between the road's bends.
  data.phases.forEach(function (phase, index) {
    var first = stops.find(function (stop) {
      return stop.milestone.phase === phase.id;
    });
    var point = path.getPointAtLength(first.progress * total);
    var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", 380);
    label.setAttribute("y", Math.max(110, point.y - 45));
    label.setAttribute("text-anchor", "middle");
    label.textContent = "0" + (index + 1) + " / " + phase.title;
    root.querySelector(".tr-road-mission-labels").appendChild(label);
  });
  root.querySelector(".tr-drive-current").textContent =
    "Current verified checkpoint: " +
    current.title +
    ". Builder-confirmed bench result; test date not recorded.";

  function cloneContent(source) {
    var clone = source.cloneNode(true);
    clone.removeAttribute("id");
    clone.removeAttribute("tabindex");
    clone.removeAttribute("hidden");
    clone.querySelectorAll("[id]").forEach(function (el) {
      el.removeAttribute("id");
    });
    clone.querySelectorAll("details").forEach(function (el) {
      el.open = true;
    });
    return clone;
  }
  function openPanel(stop, control) {
    if (pointer || dialog.open) return;
    opener = control;
    var content = root.querySelector(".tr-panel-content");
    content.replaceChildren();
    root.querySelector("#tr-panel-title").textContent = stop.milestone.title;
    var source = document.getElementById("milestone-" + stop.milestone.id);
    if (source) {
      var details = document.createElement("div");
      var clone = cloneContent(source);
      while (clone.firstChild) details.appendChild(clone.firstChild);
      var duplicateHeading = details.querySelector("h3");
      if (duplicateHeading) duplicateHeading.remove();
      content.appendChild(details);
    }
    var journal =
      stop.milestone.journal_id &&
      document.getElementById("journal-" + stop.milestone.journal_id);
    if (journal) {
      var journalTitle = document.createElement("h3");
      journalTitle.textContent = "From the build journal";
      content.appendChild(journalTitle);
      content.appendChild(cloneContent(journal));
    } else if (!stop.milestone.media_url) {
      var missing = document.createElement("p");
      missing.className = "tr-media-placeholder";
      missing.textContent =
        "Photos and a detailed build note have not yet been published for this milestone.";
      content.appendChild(missing);
    }
    dialog.returnValue = "";
    dialog.showModal();
  }
  root.querySelector(".tr-explore").addEventListener("click", function (event) {
    openPanel(activeStop, event.currentTarget);
  });
  root.querySelector(".tr-panel-close").addEventListener("click", function () {
    dialog.close();
  });
  dialog.addEventListener("close", function () {
    if (dialog.returnValue !== "navigate" && opener && opener.isConnected)
      opener.focus({ preventScroll: true });
  });
  // Let evidence/dependency links leave the modal and reveal their source notes.
  dialog.addEventListener(
    "click",
    function (event) {
      if (event.target.closest('a[href^="#"]')) dialog.close("navigate");
    },
    true,
  );
  root.querySelector(".tr-return").addEventListener("click", function () {
    drive(currentStop.progress * total, true);
    robot.focus({ preventScroll: true });
  });

  function flushPointer() {
    if (!pointer || !pendingPoint) return;
    var point = pendingPoint;
    pendingPoint = null;
    drive(nearestPoint(point, length), false);
  }
  function schedulePointer(event) {
    var point = svgPoint(event);
    if (!point) return;
    pendingPoint = {
      x: point.x - pointer.offset.x,
      y: point.y - pointer.offset.y,
    };
    if (frame === null)
      frame = requestAnimationFrame(function () {
        frame = null;
        flushPointer();
      });
  }
  robot.addEventListener("pointerdown", function (event) {
    if (pointer || !event.isPrimary || event.button !== 0) return;
    var point = svgPoint(event);
    if (!point) return;
    var origin = path.getPointAtLength(length);
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      offset: { x: point.x - origin.x, y: point.y - origin.y },
    };
    suppressClick = false;
    robot.setPointerCapture(event.pointerId);
    robot.classList.add("is-dragging");
    robot.focus({ preventScroll: true });
    event.preventDefault();
  });
  robot.addEventListener("pointermove", function (event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5)
      pointer.moved = true;
    if (pointer.moved) schedulePointer(event);
  });
  function release(event, cancelled) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!cancelled && pointer.moved) schedulePointer(event);
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    flushPointer();
    suppressClick = cancelled || pointer.moved;
    pointer = null;
    pendingPoint = null;
    robot.classList.remove("is-dragging");
    if (robot.hasPointerCapture(event.pointerId))
      robot.releasePointerCapture(event.pointerId);
    drive(length, true);
  }
  robot.addEventListener("pointerup", function (event) {
    release(event, false);
  });
  robot.addEventListener("pointercancel", function (event) {
    release(event, true);
  });
  robot.addEventListener("lostpointercapture", function (event) {
    release(event, true);
  });
  robot.addEventListener("click", function (event) {
    if (!suppressClick || event.detail === 0) openPanel(activeStop, robot);
    suppressClick = false;
  });
  robot.addEventListener("keydown", function (event) {
    if (pointer) return;
    var step = total * (event.shiftKey ? 0.02 : 0.004);
    if (
      [
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
      ].indexOf(event.key) === -1
    )
      return;
    event.preventDefault();
    var at =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? total
          : length +
            (event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -step
              : step);
    drive(at, true);
  });
  // An explicit desktop gesture permits intentional full-path repositioning.
  // Ordinary road touches remain free to scroll the page.
  svg.addEventListener("click", function (event) {
    if (!event.shiftKey || event.button !== 0 || dialog.open) return;
    var point = svgPoint(event);
    if (point) drive(nearestPoint(point, null), true);
  });
  root.hidden = false;
  drive(length, false);
})();
