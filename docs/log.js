var TFLog = (function () {
  "use strict";

  var lines = [];
  var view = null;
  var statusEl = null;
  var noteInput = null;
  var persistWarned = false;
  var storageKey = TF_CONFIG.storagePrefix + ":log";

  function stamp(date) {
    var d = date || new Date();
    function two(n) {
      return (n < 10 ? "0" : "") + n;
    }
    function three(n) {
      if (n < 10) return "00" + n;
      if (n < 100) return "0" + n;
      return String(n);
    }
    return (
      d.getFullYear() +
      "-" +
      two(d.getMonth() + 1) +
      "-" +
      two(d.getDate()) +
      " " +
      two(d.getHours()) +
      ":" +
      two(d.getMinutes()) +
      ":" +
      two(d.getSeconds()) +
      "." +
      three(d.getMilliseconds())
    );
  }

  function formatLine(line) {
    if (line.count > 1) {
      return line.stamp + "  " + line.message + "  (×" + line.count + ", last " + line.lastStamp + ")";
    }
    return line.stamp + "  " + line.message;
  }

  function text() {
    return lines.map(formatLine).join("\n");
  }

  function render() {
    if (!view) return;
    var nearBottom = view.scrollHeight - view.scrollTop - view.clientHeight < 48;
    view.textContent = text();
    if (nearBottom) view.scrollTop = view.scrollHeight;
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch (error) {
      if (!persistWarned && statusEl) {
        persistWarned = true;
        statusEl.textContent = "The log is on screen only. Storage refused it: " + (error && error.message ? error.message : error);
      }
    }
  }

  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(saved)) return;
      lines = saved.filter(function (line) {
        return line && typeof line.stamp === "string" && typeof line.message === "string";
      }).slice(-TF_CONFIG.logMaxLines);
    } catch (error) {
      lines = [];
    }
  }

  function push(message, options) {
    var textMessage = String(message);
    if (textMessage.length > 4000) textMessage = textMessage.slice(0, 4000) + "…";
    var collapseKey = options && options.collapseKey;
    var now = stamp();
    if (collapseKey && lines.length) {
      var last = lines[lines.length - 1];
      if (last.collapseKey === collapseKey) {
        last.count += 1;
        last.lastStamp = now;
        render();
        persist();
        return;
      }
    }
    lines.push({
      stamp: now,
      lastStamp: now,
      message: textMessage,
      collapseKey: collapseKey || "",
      count: 1,
    });
    if (lines.length > TF_CONFIG.logMaxLines) {
      lines.splice(0, lines.length - TF_CONFIG.logMaxLines);
    }
    render();
    persist();
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function checkVersion() {
    var meta = document.querySelector('meta[name="tf-version"]');
    var shown = document.querySelector(".version");
    if (meta && meta.content !== TF_CONFIG.version) {
      push("version mismatch: meta " + meta.content + ", config " + TF_CONFIG.version);
    }
    if (shown && shown.textContent.trim() !== TF_CONFIG.version) {
      push("version mismatch: page header " + shown.textContent.trim() + ", config " + TF_CONFIG.version);
    }
  }

  function sessionHeader() {
    var page = location.pathname.split("/").pop() || "index.html";
    push("— " + page + " —");
    TFEnv.lines().forEach(function (line) {
      push(line);
    });
    checkVersion();
  }

  function clearLog() {
    lines = [];
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      setStatus("Storage refused a clear: " + (error && error.message ? error.message : error));
    }
    render();
    sessionHeader();
    setStatus("Log cleared.");
  }

  function copyLog() {
    var body = text();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).then(
        function () {
          setStatus("Copied the log.");
        },
        function (error) {
          fallbackCopy(body, error);
        }
      );
      return;
    }
    fallbackCopy(body);
  }

  function fallbackCopy(body, error) {
    var area = document.createElement("textarea");
    area.value = body;
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (copyError) {
      ok = false;
    }
    area.remove();
    if (ok) {
      setStatus("Copied the log.");
      return;
    }
    var why = error && error.message ? error.message : "clipboard unavailable";
    setStatus("Copy failed (" + why + "). Use Download.");
  }

  function shareLog() {
    var body = text();
    if (!navigator.share) {
      setStatus("Share is not available in this browser. Use Copy or Download.");
      return;
    }
    navigator.share({ title: "tenderfern iPad check log", text: body }).then(
      function () {
        setStatus("Share finished.");
      },
      function (error) {
        if (error && error.name === "AbortError") {
          setStatus("Share cancelled.");
          return;
        }
        setStatus("Share did not finish (" + (error && error.message ? error.message : error) + "). Use Download.");
      }
    );
  }

  function downloadLog() {
    var blob = new Blob([text()], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "ipad-check-log-" + stamp().replace(/[: ]/g, "-") + ".txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Download started (" + link.download + ").");
  }

  function addNote() {
    var value = noteInput.value.trim();
    if (!value) return;
    push("note: " + value);
    noteInput.value = "";
    setStatus("Note added.");
  }

  function mount(panel) {
    var actions = document.createElement("div");
    actions.className = "actions";
    function button(label, className, onClick) {
      var el = document.createElement("button");
      el.type = "button";
      el.textContent = label;
      if (className) el.className = className;
      el.addEventListener("click", onClick);
      actions.appendChild(el);
      return el;
    }
    button("Copy", "", copyLog);
    button("Share", "", shareLog);
    button("Download", "", downloadLog);
    button("Clear", "secondary", clearLog);

    var noteRow = document.createElement("div");
    noteRow.className = "actions";
    noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.placeholder = "Add a note to the log";
    noteInput.setAttribute("aria-label", "Note to add to the log");
    noteInput.style.flex = "1";
    noteInput.style.minWidth = "12rem";
    noteRow.appendChild(noteInput);
    buttonNote(noteRow);

    view = document.createElement("pre");
    view.className = "log-view";
    view.setAttribute("aria-label", "Log");
    statusEl = document.createElement("p");
    statusEl.className = "log-status";
    statusEl.setAttribute("role", "status");

    var heading = document.createElement("h2");
    heading.textContent = "Log";
    panel.appendChild(heading);
    panel.appendChild(actions);
    panel.appendChild(noteRow);
    panel.appendChild(view);
    panel.appendChild(statusEl);

    restore();
    render();
    sessionHeader();
  }

  function buttonNote(row) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "secondary";
    el.textContent = "Add note";
    el.addEventListener("click", addNote);
    noteInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addNote();
      }
    });
    row.appendChild(el);
  }

  return {
    push: push,
    text: text,
    clear: clearLog,
    mount: mount,
  };
})();

var TFEnv = (function () {
  "use strict";

  var ipadKey = TF_CONFIG.storagePrefix + ":ipados";

  function standaloneMedia() {
    return window.matchMedia("(display-mode: standalone)").matches;
  }

  function iosStandalone() {
    return navigator.standalone === true;
  }

  function contextLabel() {
    if (standaloneMedia() || iosStandalone()) return "home-screen web app";
    return "browser tab";
  }

  function ipados() {
    try {
      return localStorage.getItem(ipadKey) || "";
    } catch (error) {
      return "";
    }
  }

  function setIpados(value) {
    localStorage.setItem(ipadKey, value);
  }

  function lines() {
    var standalone = navigator.standalone;
    return [
      "version " + TF_CONFIG.version,
      "context " + contextLabel(),
      "navigator.standalone " + (standalone === undefined ? "undefined" : String(standalone)),
      "display-mode standalone " + String(standaloneMedia()),
      "maxTouchPoints " + String(navigator.maxTouchPoints),
      "viewport " + window.innerWidth + "×" + window.innerHeight,
      "userAgent " + navigator.userAgent,
      "time " + new Date().toISOString(),
      "href " + location.href,
      "iPadOS version (typed) " + (ipados() || "(none)"),
    ];
  }

  return {
    contextLabel: contextLabel,
    standaloneMedia: standaloneMedia,
    iosStandalone: iosStandalone,
    ipados: ipados,
    setIpados: setIpados,
    lines: lines,
  };
})();

var logPanel = document.getElementById("log-panel");
if (logPanel) TFLog.mount(logPanel);
