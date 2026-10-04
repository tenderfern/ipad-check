(function () {
  "use strict";

  var report = document.getElementById("storage-report");
  var contextLine = document.getElementById("storage-context");
  var localKey = TF_CONFIG.storagePrefix + ":pairing";

  function ageOf(iso) {
    var ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms)) return "unknown age";
    if (ms < 0) return "timestamp is in the future";
    var minutes = Math.round(ms / 60000);
    if (minutes < 90) return minutes + " minutes";
    var hours = ms / 3600000;
    if (hours < 36) return hours.toFixed(1) + " hours";
    return (ms / 86400000).toFixed(1) + " days";
  }

  function cookiePath() {
    var path = location.pathname.replace(/[^/]*$/, "");
    return path || "/";
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(TF_CONFIG.idbName, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(TF_CONFIG.idbStore)) {
          request.result.createObjectStore(TF_CONFIG.idbStore);
        }
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error || new Error("IndexedDB open failed"));
      };
    });
  }

  function idbGet() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(TF_CONFIG.idbStore, "readonly");
        var request = tx.objectStore(TF_CONFIG.idbStore).get("current");
        request.onsuccess = function () {
          db.close();
          resolve(request.result || null);
        };
        request.onerror = function () {
          db.close();
          reject(request.error || new Error("IndexedDB read failed"));
        };
      });
    });
  }

  function idbPut(record) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(TF_CONFIG.idbStore, "readwrite");
        tx.objectStore(TF_CONFIG.idbStore).put(record, "current");
        tx.oncomplete = function () {
          db.close();
          resolve();
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error || new Error("IndexedDB write failed"));
        };
      });
    });
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return { error: "localStorage not readable: " + (error && error.message ? error.message : error) };
    }
  }

  function readCookie() {
    var prefix = TF_CONFIG.cookieName + "=";
    var parts = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(prefix) === 0) {
        try {
          return JSON.parse(decodeURIComponent(part.slice(prefix.length)));
        } catch (error) {
          return { error: "cookie present but not readable" };
        }
      }
    }
    return null;
  }

  function writeCookie(record) {
    var path = cookiePath();
    document.cookie =
      TF_CONFIG.cookieName +
      "=" +
      encodeURIComponent(JSON.stringify(record)) +
      "; Max-Age=" +
      TF_CONFIG.cookieMaxAgeSeconds +
      "; Path=" +
      path +
      "; SameSite=Lax";
    return path;
  }

  function newToken() {
    var bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    }
    return "tf_" + hex;
  }

  function lineFor(name, record) {
    if (!record) return name + " missing";
    if (record.error) return name + " " + record.error;
    return (
      name +
      " token=" +
      record.token +
      " created=" +
      record.createdAt +
      " age=" +
      ageOf(record.createdAt) +
      " writtenIn=" +
      (record.context || "(unrecorded)") +
      " persist()=" +
      (record.persistResult || "(unrecorded)")
    );
  }

  function render(copies, persistedNow) {
    report.replaceChildren();
    var banner = document.createElement("p");
    banner.textContent = "This page is open in a " + TFEnv.contextLabel() + ".";
    contextLine.textContent =
      "navigator.standalone is " +
      (navigator.standalone === undefined ? "undefined" : String(navigator.standalone)) +
      ". display-mode: standalone is " +
      String(TFEnv.standaloneMedia()) +
      ".";

    var persisted = document.createElement("p");
    persisted.textContent = "navigator.storage.persisted() now: " + persistedNow;

    var list = document.createElement("ul");
    list.className = "status-list";
    ["localStorage", "IndexedDB", "cookie"].forEach(function (name) {
      var item = document.createElement("li");
      item.textContent = lineFor(name, copies[name]);
      list.appendChild(item);
    });

    var tokens = ["localStorage", "IndexedDB", "cookie"]
      .map(function (name) {
        return copies[name] && copies[name].token;
      })
      .filter(Boolean);
    var unique = tokens.filter(function (token, index) {
      return tokens.indexOf(token) === index;
    });
    var match = document.createElement("p");
    if (!tokens.length) match.textContent = "No copy is stored in this context.";
    else if (unique.length === 1 && tokens.length === 3) match.textContent = "All three copies hold the same token.";
    else match.textContent = "The copies that are present do not all hold the same token.";

    report.appendChild(banner);
    report.appendChild(persisted);
    report.appendChild(list);
    report.appendChild(match);

    var summary =
      "storage context=" +
      TFEnv.contextLabel() +
      " persisted=" +
      persistedNow +
      " | " +
      lineFor("localStorage", copies.localStorage) +
      " | " +
      lineFor("IndexedDB", copies.IndexedDB) +
      " | " +
      lineFor("cookie", copies.cookie);
    TFLog.push(summary);
  }

  function persistedNow() {
    if (!navigator.storage || !navigator.storage.persisted) {
      return Promise.resolve("navigator.storage.persisted is missing");
    }
    return navigator.storage.persisted().then(
      function (value) {
        return String(value);
      },
      function (error) {
        return "failed: " + (error && error.message ? error.message : error);
      }
    );
  }

  function readAll() {
    return idbGet().then(
      function (idb) {
        return {
          localStorage: readLocal(),
          IndexedDB: idb,
          cookie: readCookie(),
        };
      },
      function (error) {
        return {
          localStorage: readLocal(),
          IndexedDB: { error: "IndexedDB read failed: " + (error && error.message ? error.message : error) },
          cookie: readCookie(),
        };
      }
    );
  }

  function show() {
    return Promise.all([readAll(), persistedNow()]).then(function (results) {
      render(results[0], results[1]);
    });
  }

  function askPersist() {
    if (!navigator.storage || !navigator.storage.persist) {
      return Promise.resolve("navigator.storage.persist is missing");
    }
    return navigator.storage.persist().then(
      function (granted) {
        return granted ? "granted" : "denied";
      },
      function (error) {
        return "failed: " + (error && error.message ? error.message : error);
      }
    );
  }

  document.getElementById("write-token").addEventListener("click", function () {
    var existing = readLocal() || readCookie();
    if (existing && existing.token && !window.confirm("Replace the saved token? This starts its age over.")) return;
    askPersist().then(function (persistResult) {
      var record = {
        token: newToken(),
        createdAt: new Date().toISOString(),
        context: TFEnv.contextLabel(),
        persistResult: persistResult,
      };
      var failures = [];
      try {
        localStorage.setItem(localKey, JSON.stringify(record));
      } catch (error) {
        failures.push("localStorage: " + (error && error.message ? error.message : error));
      }
      var path = writeCookie(record);
      if (!readCookie()) failures.push("cookie not visible after write (path " + path + ")");
      idbPut(record).then(
        function () {
          TFLog.push("token written; persist() " + persistResult + (failures.length ? "; " + failures.join("; ") : ""));
          if (failures.length) TFLog.push("write failures: " + failures.join("; "));
          show();
        },
        function (error) {
          failures.push("IndexedDB: " + (error && error.message ? error.message : error));
          TFLog.push("token write incomplete: " + failures.join("; "));
          show();
        }
      );
    });
  });

  show();
})();
