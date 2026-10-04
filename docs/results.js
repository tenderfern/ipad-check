(function () {
  "use strict";

  var form = document.getElementById("results-form");
  var saveStatus = document.getElementById("save-status");
  var exportPath = document.getElementById("export-path");
  var draftKey = TF_CONFIG.storagePrefix + ":results-draft";
  var saveTimer = null;

  function today() {
    var date = new Date();
    function two(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return date.getFullYear() + "-" + two(date.getMonth() + 1) + "-" + two(date.getDate());
  }

  function addSection(title, intro) {
    var section = document.createElement("section");
    var heading = document.createElement("h2");
    heading.textContent = title;
    section.appendChild(heading);
    if (intro) {
      var paragraph = document.createElement("p");
      paragraph.textContent = intro;
      section.appendChild(paragraph);
    }
    form.appendChild(section);
    return section;
  }

  function addField(parent, field) {
    var label = document.createElement("label");
    label.className = "field";
    var name = document.createElement("span");
    name.className = "field-label";
    name.textContent = field.label;
    label.appendChild(name);
    if (field.hint) {
      var hint = document.createElement("span");
      hint.className = "muted";
      hint.textContent = field.hint;
      label.appendChild(hint);
    }
    var input = field.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (field.type !== "textarea") input.type = field.type || "text";
    input.dataset.field = field.id;
    input.dataset.label = field.label;
    if (field.readonly) input.readOnly = true;
    label.appendChild(input);
    parent.appendChild(label);
    return input;
  }

  function addTable(parent, caption, columns, rows, idFor, placeholder) {
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";
    var table = document.createElement("table");
    var cap = document.createElement("caption");
    cap.textContent = caption;
    table.appendChild(cap);
    var head = document.createElement("tr");
    var corner = document.createElement("th");
    corner.textContent = "";
    head.appendChild(corner);
    columns.forEach(function (column) {
      var cell = document.createElement("th");
      cell.textContent = column.label;
      head.appendChild(cell);
    });
    var thead = document.createElement("thead");
    thead.appendChild(head);
    table.appendChild(thead);
    var body = document.createElement("tbody");
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var rowHead = document.createElement("th");
      rowHead.textContent = row.label;
      tr.appendChild(rowHead);
      columns.forEach(function (column) {
        var td = document.createElement("td");
        var input = document.createElement("input");
        input.type = "text";
        input.dataset.field = idFor(row, column);
        input.dataset.label = caption + " — " + row.label + " — " + column.label;
        input.placeholder = placeholder || "played / error / not tried";
        td.appendChild(input);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    parent.appendChild(wrap);
  }

  var session = addSection("Session", "These fields name the export. The version is this copy of the pages.");
  addField(session, { id: "session.date", label: "Date", type: "date" });
  addField(session, {
    id: "session.device",
    label: "Device name",
    hint: "Used in the filename, for example ipad or ipad-home.",
  });
  addField(session, { id: "session.ipados", label: "iPadOS version", hint: "Typed on the home page, or here." });
  addField(session, {
    id: "session.context",
    label: "Where this form is open",
    hint: "Safari tab, home-screen web app, or desktop.",
  });
  addField(session, {
    id: "session.app",
    label: "Is the video app installed?",
    hint: "Yes, no, or not checked. Run A records this.",
  });
  addField(session, { id: "session.version", label: "Page version", type: "text", readonly: true });

  var runA = addSection(
    "Run A — baseline, no restrictions",
    "Every video, every mode, with the guard off and then on. A blank cell was not tried. Leave the guard off while watching the end of a video."
  );
  ["off", "on"].forEach(function (guard) {
    addTable(
      runA,
      "Guard " + guard,
      TF_CONFIG.modes.map(function (mode) {
        return { id: mode.id, label: mode.label };
      }),
      TF_CONFIG.videos.map(function (video) {
        return { id: video.id, label: video.caseName + " (" + video.id + ")" };
      }),
      function (row, column) {
        return "runA.guard-" + guard + "." + row.id + "." + column.id;
      }
    );
  });
  addField(runA, {
    id: "runA.notes",
    label: "Baseline notes",
    type: "textarea",
    hint: "What played, what failed, fullscreen, and taps that do not fit a cell.",
  });

  var runB = addSection(
    "Run B — allowlist",
    "Start from tenderfern.github.io alone. Add hosts one at a time. Add www.youtube.com last."
  );
  [
    ["runB.alone", "Started from tenderfern.github.io alone", "What each mode did before any other host was added."],
    ["runB.order", "Hosts added, in order", "After each addition: what played and what failed, in each mode."],
    ["runB.youtube", "www.youtube.com added last", "What changed, including whether the API script loaded before this."],
    ["runB.api", "Smallest list — API, default host", ""],
    ["runB.nocookie", "Smallest list — API, privacy-enhanced host", ""],
    ["runB.plain", "Smallest list — plain iframe", ""],
  ].forEach(function (field) {
    addField(runB, { id: field[0], label: field[1], type: "textarea", hint: field[2] });
  });

  var runC = addSection(
    "Run C — ads",
    "On the smallest list that plays the monetized video, with the guard off. This records what the allowlist does. It is not a test of blocking ads."
  );
  [
    ["runC.list", "List in force"],
    ["runC.ads", "Did ads play, and on which plays?"],
    ["runC.hosts", "Ad hosts, from the HAR"],
    ["runC.removed", "Hosts removed"],
    ["runC.after", "Did playback survive after those hosts were removed?"],
  ].forEach(function (field) {
    addField(runC, { id: field[0], label: field[1], type: "textarea" });
  });

  var runD = addSection(
    "Run D — pairing",
    "A Safari tab and a home-screen web app keep separate storage. Record each copy at day 0 and after about one, three and eight days."
  );
  var days = [
    { id: "d0", label: "Day 0, written" },
    { id: "d1", label: "About 1 day" },
    { id: "d3", label: "About 3 days" },
    { id: "d8", label: "About 8 days" },
  ];
  var stores = [
    { id: "local", label: "localStorage" },
    { id: "idb", label: "IndexedDB" },
    { id: "cookie", label: "cookie" },
    { id: "persisted", label: "persisted()" },
  ];
  [
    ["tab", "Safari tab"],
    ["home", "Home-screen web app"],
  ].forEach(function (context) {
    addTable(
      runD,
      context[1],
      stores,
      days,
      function (row, column) {
        return "runD." + context[0] + "." + row.id + "." + column.id;
      },
      "present, age / missing / not visited"
    );
  });
  addField(runD, { id: "runD.notes", label: "Pairing notes", type: "textarea" });

  var questions = addSection(
    "Answers",
    "These are the seven questions. The run notes above are the evidence; these boxes are the answer a later reader should not have to reconstruct."
  );
  [
    ["q1", "1. Domains", "Which domains did each mode need? Which list was smallest?"],
    ["q2", "2. www.youtube.com", "Did the API script load without it listed? Did any mode play without it?"],
    ["q3", "3. Ads", "Did ads play? Did playback survive when the ad hosts were not listed?"],
    [
      "q4",
      "4. End of a video",
      "Last seconds, after the end, taps, whether another video loaded in the same player, whether the log showed it in time, and what changed in fullscreen.",
    ],
    ["q5", "5. Ways out", "Title, channel, logo, and any Watch on YouTube link: new tab, restricted page, or the video app."],
    ["q6", "6. Signals", "Which events, states and errors arrived, in each case and each mode?"],
    ["q7", "7. Pairing", "Which copies survived in a Safari tab and in the home-screen web app, and how old were they?"],
  ].forEach(function (field) {
    addField(questions, { id: field[0], label: field[1], type: "textarea", hint: field[2] });
  });

  var attached = addSection("Attached log", "The export includes this text. It starts as the log stored on this device, in this context.");
  addField(attached, { id: "log", label: "Log", type: "textarea" });

  function fields() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-field]"));
  }

  function collect() {
    var values = {};
    fields().forEach(function (field) {
      values[field.dataset.field] = field.value;
    });
    return values;
  }

  function deviceSlug() {
    var raw = "";
    var input = document.querySelector('[data-field="session.device"]');
    if (input) raw = input.value;
    var slug = raw.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return slug || "device";
  }

  function dateValue() {
    var input = document.querySelector('[data-field="session.date"]');
    return input && input.value ? input.value : today();
  }

  function repoPath() {
    return "results/" + dateValue() + "-" + deviceSlug() + ".md";
  }

  function showPath() {
    exportPath.textContent = "Save the export in the repository as " + repoPath();
  }

  function fillDefaults() {
    var date = document.querySelector('[data-field="session.date"]');
    if (date && !date.value) date.value = today();
    var version = document.querySelector('[data-field="session.version"]');
    if (version) version.value = TF_CONFIG.version;
    var ipados = document.querySelector('[data-field="session.ipados"]');
    if (ipados && !ipados.value) ipados.value = TFEnv.ipados();
    var log = document.querySelector('[data-field="log"]');
    if (log && !log.value) log.value = TFLog.text();
  }

  function restore() {
    var payload = null;
    try {
      payload = JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch (error) {
      payload = null;
    }
    if (payload && payload.fields) {
      fields().forEach(function (field) {
        if (Object.prototype.hasOwnProperty.call(payload.fields, field.dataset.field)) {
          field.value = payload.fields[field.dataset.field];
        }
      });
      saveStatus.textContent = "Draft restored from " + (payload.savedAt || "storage") + ".";
    }
    fillDefaults();
    showPath();
  }

  function saveDraft() {
    var payload = { savedAt: new Date().toISOString(), fields: collect() };
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
      saveStatus.textContent = "Draft saved " + payload.savedAt + ".";
    } catch (error) {
      saveStatus.textContent = "Draft was not saved: " + (error && error.message ? error.message : error);
    }
    showPath();
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 300);
  }

  function fence(body) {
    var ticks = "```";
    while (body.indexOf(ticks) !== -1) ticks += "`";
    return ticks + "\n" + body + "\n" + ticks;
  }

  function buildMarkdown() {
    var path = repoPath();
    var lines = [
      "# tenderfern iPad check",
      "",
      "- version: " + TF_CONFIG.version,
      "- exported: " + new Date().toISOString(),
      "- path: " + path,
      "",
      "## Video set",
      "",
    ];
    TF_CONFIG.videos.forEach(function (video) {
      lines.push("- " + video.id + " — " + video.caseName + " — " + video.title + " — " + video.channel + " — " + video.length);
    });
    lines.push("");
    var section = "";
    fields().forEach(function (field) {
      var heading = field.closest("section");
      var title = heading ? heading.querySelector("h2").textContent : "Fields";
      if (title !== section) {
        section = title;
        lines.push("## " + title, "");
      }
      var value = field.value.trim();
      if (field.dataset.field === "log" && value) {
        lines.push("### " + field.dataset.label, "", fence(value), "");
      } else {
        lines.push("### " + field.dataset.label, "", value || "_empty_", "");
      }
    });
    return lines.join("\n");
  }

  function download(filename, body, type) {
    var blob = new Blob([body], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.getElementById("save-draft").addEventListener("click", saveDraft);
  document.getElementById("attach-log").addEventListener("click", function () {
    var log = document.querySelector('[data-field="log"]');
    log.value = TFLog.text();
    saveDraft();
    saveStatus.textContent = "Attached the current log and saved the draft.";
  });
  document.getElementById("export-copy").addEventListener("click", function () {
    var body = buildMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).then(
        function () {
          saveStatus.textContent = "Copied the Markdown.";
        },
        function () {
          saveStatus.textContent = "Copy failed. Use Download.";
        }
      );
    } else {
      saveStatus.textContent = "Copy is not available. Use Download.";
    }
  });
  document.getElementById("export-download").addEventListener("click", function () {
    var name = dateValue() + "-" + deviceSlug() + ".md";
    download(name, buildMarkdown(), "text/markdown;charset=utf-8");
    saveStatus.textContent = "Download started. Save the file as " + repoPath() + ".";
  });
  document.getElementById("clear-draft").addEventListener("click", function () {
    if (!window.confirm("Clear the saved draft on this page? The on-screen log is kept.")) return;
    try {
      localStorage.removeItem(draftKey);
    } catch (error) {
      saveStatus.textContent = "Draft was not cleared: " + (error && error.message ? error.message : error);
      return;
    }
    fields().forEach(function (field) {
      field.value = "";
    });
    fillDefaults();
    showPath();
    saveStatus.textContent = "Draft cleared.";
  });

  form.addEventListener("input", scheduleSave);
  form.addEventListener("change", scheduleSave);
  restore();
})();
