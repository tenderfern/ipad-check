(function () {
  "use strict";

  function hostsFromHar(har) {
    if (!har || !har.log || !Array.isArray(har.log.entries)) {
      throw new Error("This file has no log.entries array.");
    }
    var hosts = {};
    var skipped = 0;
    har.log.entries.forEach(function (entry) {
      var raw = entry && entry.request && entry.request.url;
      var host = "";
      try {
        host = new URL(raw).host;
      } catch (error) {
        skipped += 1;
        return;
      }
      if (!host) {
        skipped += 1;
        return;
      }
      if (!hosts[host]) hosts[host] = { count: 0, types: {} };
      hosts[host].count += 1;
      var type = (entry && entry._resourceType) || "";
      if (!type && entry && entry.response && entry.response.content && entry.response.content.mimeType) {
        type = entry.response.content.mimeType;
      }
      if (!type) type = "unknown";
      hosts[host].types[type] = (hosts[host].types[type] || 0) + 1;
    });
    var rows = Object.keys(hosts).map(function (host) {
      return { host: host, count: hosts[host].count, types: hosts[host].types };
    });
    rows.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.host < b.host ? -1 : a.host > b.host ? 1 : 0;
    });
    return { rows: rows, skipped: skipped, entries: har.log.entries.length };
  }

  function typeText(types) {
    return Object.keys(types)
      .sort()
      .map(function (type) {
        return type + " (" + types[type] + ")";
      })
      .join(", ");
  }

  function render(parsed, sourceLabel) {
    var report = document.getElementById("har-report");
    report.replaceChildren();
    var summary = document.createElement("p");
    summary.textContent =
      sourceLabel +
      ": " +
      parsed.entries +
      " requests, " +
      parsed.rows.length +
      " hosts" +
      (parsed.skipped ? ", " + parsed.skipped + " entries skipped" : "") +
      ".";
    report.appendChild(summary);
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";
    var table = document.createElement("table");
    var head = document.createElement("tr");
    ["Host", "Requests", "Types"].forEach(function (label) {
      var cell = document.createElement("th");
      cell.textContent = label;
      head.appendChild(cell);
    });
    var thead = document.createElement("thead");
    thead.appendChild(head);
    table.appendChild(thead);
    var body = document.createElement("tbody");
    parsed.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      [row.host, String(row.count), typeText(row.types)].forEach(function (value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    report.appendChild(wrap);

    var list = parsed.rows
      .map(function (row) {
        return row.host + "  " + row.count + "  " + typeText(row.types);
      })
      .join("\n");
    report.dataset.hostList = list;
    TFLog.push("HAR " + sourceLabel + ": " + parsed.rows.length + " hosts, file not stored");
    parsed.rows.forEach(function (row) {
      TFLog.push("host " + row.host + " count=" + row.count + " types=" + typeText(row.types));
    });
  }

  function showError(message) {
    var report = document.getElementById("har-report");
    report.replaceChildren();
    var paragraph = document.createElement("p");
    paragraph.className = "caution";
    paragraph.textContent = message;
    report.appendChild(paragraph);
    TFLog.push("HAR not read: " + message);
  }

  function parseText(text, sourceLabel) {
    var har;
    try {
      har = JSON.parse(text);
    } catch (error) {
      showError("This file is not JSON.");
      return;
    }
    try {
      render(hostsFromHar(har), sourceLabel);
    } catch (error) {
      showError(error && error.message ? error.message : String(error));
    }
  }

  document.getElementById("har-file").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      parseText(String(reader.result), file.name);
    };
    reader.onerror = function () {
      showError("The file could not be read.");
    };
    reader.readAsText(file);
  });

  document.getElementById("har-sample").addEventListener("click", function () {
    fetch("har-sample.json")
      .then(function (response) {
        if (!response.ok) throw new Error("sample file HTTP " + response.status);
        return response.text();
      })
      .then(function (text) {
        parseText(text, "har-sample.json");
      })
      .catch(function (error) {
        showError("The sample file did not load: " + (error && error.message ? error.message : error));
      });
  });

  document.getElementById("har-copy").addEventListener("click", function () {
    var list = document.getElementById("har-report").dataset.hostList || "";
    if (!list) {
      TFLog.push("copy hosts pressed with no list");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(list).then(
        function () {
          TFLog.push("copied the host list");
        },
        function (error) {
          TFLog.push("copy hosts failed: " + (error && error.message ? error.message : error));
        }
      );
    } else {
      TFLog.push("copy hosts is not available in this browser");
    }
  });

  window.TFHar = { hostsFromHar: hostsFromHar };
})();
