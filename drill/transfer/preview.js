(function () {
  const transfer = window.DrillTransfer;
  if (!transfer) return;
  const byId = id => document.getElementById("transfer-" + id);
  const file = byId("file");
  const status = byId("status");
  const preview = byId("preview");
  const prefer = byId("prefer");
  let incoming;
  let changes;
  let selection = 0;

  function prepare() {
    changes = transfer.plan(localStorage, incoming, prefer.checked);
    byId("summary").textContent = [
      incoming.drill && `${Object.keys(incoming.drill.box).length} flashcard ratings`,
      incoming.drill && `${Object.keys(incoming.drill.code).length +
        Object.keys(incoming.drill.lc?.py ?? {}).length + Object.keys(incoming.drill.lc?.cpp ?? {}).length} coding records`,
      incoming.communication && `${incoming.communication.attempts.length} communication attempts`,
      incoming.communication && `${Object.keys(incoming.communication.lessons).length} completed lessons`,
      incoming.communication && `${incoming.communication.sessions.length} completed sessions`,
      incoming.theme && "theme preference"
    ].filter(Boolean).join(" · ");
    byId("apply").disabled = !changes.length;
    preview.hidden = false;
    status.textContent = changes.length ? "Review the progress file before importing." : "This progress is already on this site.";
  }

  byId("export").onclick = () => {
    try {
      const data = transfer.snapshot(localStorage);
      const json = JSON.stringify(data);
      transfer.parse(json);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "drill-progress.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Progress file downloaded.";
    } catch {
      status.textContent = "No transferable progress was found, or browser storage could not be read.";
    }
  };

  file.onchange = async () => {
    const token = ++selection;
    const selected = file.files[0];
    preview.hidden = true;
    incoming = undefined;
    prefer.checked = false;
    if (!selected) return;
    try {
      if (selected.size > transfer.maxBytes) throw new Error();
      const json = await selected.text();
      if (token !== selection) return;
      incoming = transfer.parse(json);
      prepare();
    } catch {
      if (token === selection) status.textContent = "This progress file could not be read or is unsupported.";
    }
  };

  prefer.onchange = () => {
    try {
      prepare();
    } catch {
      preview.hidden = true;
      status.textContent = "Current browser progress could not be read.";
    }
  };
  byId("apply").onclick = () => {
    try {
      transfer.apply(localStorage, changes);
      status.textContent = "Progress imported. Open DRILL to see it.";
      preview.hidden = true;
      file.value = "";
      const theme = localStorage.getItem("theme");
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    } catch (error) {
      status.textContent = error.message;
      preview.hidden = true;
      file.value = "";
    }
  };

  byId("export").disabled = false;
  file.disabled = false;
})();
