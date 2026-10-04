(function () {
  "use strict";

  var player = null;
  var pollTimer = null;
  var loadedId = "";
  var modeKind = "";
  var plainActive = false;
  var removedByGuard = false;
  var endedLogged = false;
  var foreignLoggedFor = "";
  var pagePlayTapped = false;
  var busy = false;
  var signInTimer = null;
  var apiPromise = null;

  var loadButton = document.getElementById("load-player");
  var playButton = document.getElementById("page-play");
  var removeButton = document.getElementById("remove-player");
  var startInput = document.getElementById("start");
  var relInput = document.getElementById("rel");
  var guardInput = document.getElementById("guard");
  var otherInput = document.createElement("input");
  otherInput.type = "text";
  otherInput.id = "other-id";
  otherInput.placeholder = "Video id";
  otherInput.autocomplete = "off";
  otherInput.spellcheck = false;
  otherInput.setAttribute("aria-label", "Other video id");
  otherInput.style.width = "16rem";
  var scriptStatus = document.getElementById("script-status");
  var frameStatus = document.getElementById("frame-status");
  var pollStatus = document.getElementById("poll-status");

  var stateNames = {
    "-1": "unstarted",
    0: "ended",
    1: "playing",
    2: "paused",
    3: "buffering",
    5: "cued",
  };

  var errorNames = {
    2: "invalid parameter",
    5: "HTML5 player error",
    100: "video not found",
    101: "embedding disabled by the owner",
    150: "embedding disabled by the owner (same as 101)",
    153: "Referer missing or not accepted",
  };

  function stateName(state) {
    if (Object.prototype.hasOwnProperty.call(stateNames, String(state))) {
      return stateNames[String(state)];
    }
    return "unknown";
  }

  function errorName(code) {
    if (Object.prototype.hasOwnProperty.call(errorNames, code)) return errorNames[code];
    return "unlisted code";
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function videoIdFromUrl(url) {
    if (!url) return "";
    var parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      return "";
    }
    var fromQuery = parsed.searchParams.get("v");
    if (fromQuery) return fromQuery;
    var parts = parsed.pathname.split("/").filter(Boolean);
    var markers = ["embed", "shorts", "live", "v"];
    for (var i = 0; i < parts.length; i++) {
      if (markers.indexOf(parts[i]) !== -1 && parts[i + 1]) return parts[i + 1];
    }
    return "";
  }

  function normalizeId(raw) {
    var text = String(raw || "").trim();
    if (!text) return "";
    var fromUrl = videoIdFromUrl(text);
    if (fromUrl) return fromUrl;
    var shortForm = text.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (shortForm) return shortForm[1];
    var watch = text.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watch) return watch[1];
    var shorts = text.match(/shorts\/([A-Za-z0-9_-]{11})/);
    if (shorts) return shorts[1];
    var embed = text.match(/embed\/([A-Za-z0-9_-]{11})/);
    if (embed) return embed[1];
    return text;
  }

  function selectedMode() {
    var chosen = document.querySelector('input[name="mode"]:checked');
    return chosen ? chosen.value : TF_CONFIG.modes[0].id;
  }

  function selectedPreset() {
    var chosen = document.querySelector('input[name="video"]:checked');
    if (!chosen || chosen.value === "other") return null;
    for (var i = 0; i < TF_CONFIG.videos.length; i++) {
      if (TF_CONFIG.videos[i].id === chosen.value) return TF_CONFIG.videos[i];
    }
    return null;
  }

  function selectedId() {
    var preset = selectedPreset();
    if (preset) return preset.id;
    return normalizeId(otherInput.value);
  }

  function startSeconds() {
    var raw = startInput.value.trim();
    if (raw === "") return 0;
    var value = Number(raw);
    if (!isFinite(value) || value < 0) {
      TFLog.push("start ignored (" + raw + "); using 0");
      return 0;
    }
    return Math.floor(value);
  }

  function relValue() {
    return relInput.checked ? 0 : 1;
  }

  function guardOn() {
    return guardInput.checked;
  }

  function stopPolling() {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function showPlaceholder(text) {
    var slot = document.getElementById("player-slot");
    slot.replaceChildren();
    var wrap = document.createElement("div");
    wrap.className = "placeholder";
    var paragraph = document.createElement("p");
    paragraph.textContent = text;
    wrap.appendChild(paragraph);
    slot.appendChild(wrap);
    setText(frameStatus, "none");
  }

  function showGuardPanel(reason) {
    var slot = document.getElementById("player-slot");
    slot.replaceChildren();
    var wrap = document.createElement("div");
    wrap.className = "guard-panel";
    var title = document.createElement("p");
    title.textContent = "The guard removed the player.";
    var detail = document.createElement("p");
    detail.textContent = reason;
    wrap.appendChild(title);
    wrap.appendChild(detail);
    slot.appendChild(wrap);
    setText(frameStatus, "none (removed by the guard)");
    setText(pollStatus, "polling stopped");
    playButton.disabled = true;
  }

  function logFrame() {
    if (!player || !player.getIframe) return;
    try {
      var frame = player.getIframe();
      var src = frame ? frame.src : "(none)";
      setText(frameStatus, src);
      TFLog.push("player frame " + src);
      if (frame) {
        TFLog.push("iframe referrerPolicy " + (frame.referrerPolicy || "(default)"));
        var rect = frame.getBoundingClientRect();
        var width = Math.round(rect.width);
        var height = Math.round(rect.height);
        TFLog.push("player frame box " + width + "×" + height);
        if (width < 200 || height < 200) TFLog.push("player frame is under 200×200");
      }
    } catch (error) {
      TFLog.push("getIframe failed: " + (error && error.message ? error.message : error));
    }
  }

  function removeForGuard(reason) {
    if (removedByGuard) return;
    clearSignInWait();
    removedByGuard = true;
    stopPolling();
    plainActive = false;
    TFLog.push("guard: stopping and removing the player — " + reason);
    var current = player;
    window.setTimeout(function () {
      try {
        if (current && current.stopVideo) current.stopVideo();
      } catch (error) {
        TFLog.push("stopVideo failed: " + (error && error.message ? error.message : error));
      }
      try {
        if (current && current.destroy) current.destroy();
      } catch (error) {
        TFLog.push("destroy failed: " + (error && error.message ? error.message : error));
      }
      if (player === current) player = null;
      showGuardPanel(reason);
    }, 0);
  }

  function evaluateGuard(source) {
    if (!player || removedByGuard || modeKind !== "api") return;
    var url = "";
    var state = null;
    try {
      url = player.getVideoUrl() || "";
    } catch (error) {
      TFLog.push(source + " getVideoUrl failed: " + (error && error.message ? error.message : error));
      return;
    }
    try {
      state = player.getPlayerState();
    } catch (error) {
      TFLog.push(source + " getPlayerState failed: " + (error && error.message ? error.message : error));
      return;
    }
    var id = videoIdFromUrl(url);
    if (source === "poll") {
      TFLog.push(
        "poll state=" + state + " (" + stateName(state) + ") url=" + (url || "(empty)") + " id=" + (id || "(none)"),
        { collapseKey: "poll:" + state + "|" + url }
      );
      setText(pollStatus, "state " + state + " (" + stateName(state) + ") — " + (url || "(no url)"));
    }
    if (state !== 0) endedLogged = false;
    if (!id || id === loadedId) foreignLoggedFor = "";
    var reasons = [];
    if (id && id !== loadedId) {
      var changed = "video id changed from " + loadedId + " to " + id;
      if (foreignLoggedFor !== id) {
        TFLog.push("guard (" + source + "): " + changed);
        foreignLoggedFor = id;
      }
      reasons.push(changed);
    }
    if (state === 0) {
      if (!endedLogged) {
        TFLog.push("guard (" + source + "): state ended (0)");
        endedLogged = true;
      }
      reasons.push("state ended (0)");
    }
    if (reasons.length && guardOn()) removeForGuard(reasons.join("; "));
  }

  function startPolling() {
    stopPolling();
    if (modeKind !== "api" || removedByGuard) return;
    evaluateGuard("poll");
    pollTimer = window.setInterval(function () {
      evaluateGuard("poll");
    }, TF_CONFIG.guardIntervalMs);
  }

  function onReady(event) {
    TFLog.push("onReady");
    playButton.disabled = false;
    logFrame();
    var start = startSeconds();
    if (start > 0) {
      try {
        event.target.seekTo(start, true);
        TFLog.push("seekTo " + start);
      } catch (error) {
        TFLog.push("seekTo failed: " + (error && error.message ? error.message : error));
      }
    }
    startPolling();
  }

  function onStateChange(event) {
    var state = event.data;
    TFLog.push("onStateChange " + state + " (" + stateName(state) + ")");
    if (state === 1) clearSignInWait();
    if (state === 1 && !pagePlayTapped) {
      TFLog.push("playback reported playing before the page play button was tapped");
    }
    evaluateGuard("onStateChange");
  }

  function onPlaybackQualityChange(event) {
    TFLog.push("onPlaybackQualityChange " + event.data);
  }

  function onPlaybackRateChange(event) {
    TFLog.push("onPlaybackRateChange " + event.data);
  }

  function onError(event) {
    clearSignInWait();
    TFLog.push("onError " + event.data + " (" + errorName(event.data) + ")");
  }

  function onApiChange() {
    TFLog.push("onApiChange");
  }

  function onAutoplayBlocked(event) {
    var extra = "";
    if (event && event.data !== undefined) {
      try {
        extra = " " + JSON.stringify(event.data);
      } catch (error) {
        extra = " " + String(event.data);
      }
    }
    TFLog.push("onAutoplayBlocked" + extra);
  }

  function loadApi() {
    if (window.YT && window.YT.Player) {
      setText(scriptStatus, "already loaded");
      TFLog.push("API script already present");
      return Promise.resolve();
    }
    if (apiPromise) return apiPromise;
    setText(scriptStatus, "loading");
    TFLog.push("requesting API script " + TF_CONFIG.apiScript);
    apiPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var timeout = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        apiPromise = null;
        setText(scriptStatus, "timed out");
        TFLog.push("API script timed out after " + TF_CONFIG.apiLoadTimeoutMs + " ms");
        reject(new Error("timeout"));
      }, TF_CONFIG.apiLoadTimeoutMs);
      window.onYouTubeIframeAPIReady = function () {
        window.clearTimeout(timeout);
        setText(scriptStatus, "loaded");
        TFLog.push(settled ? "API script loaded after timeout" : "API script loaded");
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      var script = document.createElement("script");
      script.src = TF_CONFIG.apiScript;
      script.async = true;
      script.onerror = function () {
        window.clearTimeout(timeout);
        apiPromise = null;
        if (settled) return;
        settled = true;
        setText(scriptStatus, "failed");
        TFLog.push("API script failed to load");
        reject(new Error("load error"));
      };
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  function destroyCurrent() {
    stopPolling();
    plainActive = false;
    var current = player;
    player = null;
    if (current) {
      try {
        if (current.stopVideo) current.stopVideo();
      } catch (error) {
        TFLog.push("stopVideo failed: " + (error && error.message ? error.message : error));
      }
      try {
        if (current.destroy) current.destroy();
      } catch (error) {
        TFLog.push("destroy failed: " + (error && error.message ? error.message : error));
      }
    }
    var slot = document.getElementById("player-slot");
    slot.replaceChildren();
  }

  function mountPlain(id, start, rel) {
    modeKind = "plain";
    plainActive = true;
    var slot = document.getElementById("player-slot");
    slot.replaceChildren();
    var iframe = document.createElement("iframe");
    var url = new URL(TF_CONFIG.nocookieOrigin + "/embed/" + encodeURIComponent(id));
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("fs", "1");
    url.searchParams.set("rel", String(rel));
    if (start > 0) url.searchParams.set("start", String(start));
    iframe.src = url.href;
    iframe.title = "Embedded player";
    iframe.allowFullscreen = true;
    iframe.allow = "encrypted-media; fullscreen; picture-in-picture; autoplay";
    slot.appendChild(iframe);
    setText(frameStatus, iframe.src);
    TFLog.push("iframe referrerPolicy " + (iframe.referrerPolicy || "(default)"));
    setText(scriptStatus, "not requested in plain mode");
    setText(pollStatus, "guard does not run in plain mode");
    playButton.disabled = true;
    TFLog.push("plain iframe " + iframe.src);
    TFLog.push("plain mode sends no messages and does not set enablejsapi");
    TFLog.push("guard does not run in plain mode; there is no player API");
    var rect = iframe.getBoundingClientRect();
    TFLog.push("player frame box " + Math.round(rect.width) + "×" + Math.round(rect.height));
  }

  function mountApi(mode, id, start, rel) {
    modeKind = "api";
    plainActive = false;
    var slot = document.getElementById("player-slot");
    slot.replaceChildren();
    var mount = document.createElement("div");
    mount.id = "player-mount";
    slot.appendChild(mount);
    var rect = slot.getBoundingClientRect();
    var width = Math.max(200, Math.round(rect.width));
    var height = Math.max(200, Math.round(rect.height));
    var playerVars = { playsinline: 1, fs: 1, rel: rel };
    if (start > 0) playerVars.start = start;
    var options = {
      width: width,
      height: height,
      videoId: id,
      playerVars: playerVars,
      events: {
        onReady: onReady,
        onStateChange: onStateChange,
        onPlaybackQualityChange: onPlaybackQualityChange,
        onPlaybackRateChange: onPlaybackRateChange,
        onError: onError,
        onApiChange: onApiChange,
        onAutoplayBlocked: onAutoplayBlocked,
      },
    };
    if (mode === "api-nocookie") {
      options.host = TF_CONFIG.nocookieOrigin;
      TFLog.push("passing host " + options.host + ", which the IFrame Player API reference does not list");
    } else {
      TFLog.push("host left unset, so the player uses its default");
    }
    TFLog.push("player size " + width + "×" + height + " playerVars " + JSON.stringify(playerVars));
    player = new YT.Player("player-mount", options);
    playButton.disabled = true;
    setText(pollStatus, "waiting for onReady");
  }

  function clearSignInWait() {
    if (signInTimer) {
      window.clearTimeout(signInTimer);
      signInTimer = null;
    }
  }

  function armSignInWait() {
    clearSignInWait();
    if (modeKind !== "api") return;
    var wait = TF_CONFIG.signInPromptWaitMs;
    var mode = selectedMode();
    var id = loadedId;
    signInTimer = window.setTimeout(function () {
      signInTimer = null;
      TFLog.push(
        "candidate sign-in prompt: no playing state within " +
          wait / 1000 +
          "s of the play tap — mode=" +
          mode +
          " id=" +
          id
      );
    }, wait);
  }

  function onSignInSeen() {
    TFLog.push(
      "sign-in prompt seen — mode=" +
        selectedMode() +
        " id=" +
        (loadedId || selectedId() || "(none)") +
        " account=" +
        TFAccount.label()
    );
  }

  function loadSelected() {
    if (busy) {
      TFLog.push("load ignored; a load is already in progress");
      return;
    }
    clearSignInWait();
    var id = selectedId();
    var mode = selectedMode();
    var start = startSeconds();
    var rel = relValue();
    if (!id) {
      TFLog.push("no video id");
      setText(scriptStatus, "no video id");
      return;
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
      TFLog.push("id " + id + " is not 11 characters of the usual alphabet; loading anyway");
    }
    busy = true;
    loadButton.disabled = true;
    removedByGuard = false;
    endedLogged = false;
    foreignLoggedFor = "";
    pagePlayTapped = false;
    loadedId = id;
    TFLog.push(
      "load mode=" + mode + " id=" + id + " start=" + start + " rel=" + rel + " guard=" + (guardOn() ? "on" : "off")
    );
    destroyCurrent();
    showPlaceholder("Loading the player. Nothing is drawn over it.");
    var pending = Promise.resolve();
    if (mode === "plain") {
      try {
        mountPlain(id, start, rel);
      } catch (error) {
        busy = false;
        loadButton.disabled = false;
        modeKind = "";
        plainActive = false;
        TFLog.push("plain iframe was not created: " + (error && error.message ? error.message : error));
        showPlaceholder("The iframe was not created. The log has the failure.");
        return;
      }
    } else {
      pending = loadApi().then(function () {
        mountApi(mode, id, start, rel);
      });
    }
    pending.then(
      function () {
        busy = false;
        loadButton.disabled = false;
      },
      function (error) {
        busy = false;
        loadButton.disabled = false;
        player = null;
        modeKind = "";
        TFLog.push("player was not created: " + (error && error.message ? error.message : error));
        showPlaceholder("The API script did not become ready. The log has the failure.");
      }
    );
  }

  function removeByHand() {
    clearSignInWait();
    if (removedByGuard) {
      TFLog.push("remove ignored; the guard already removed the player");
      return;
    }
    var hadPlayer = player !== null || modeKind === "plain";
    destroyCurrent();
    modeKind = "";
    loadedId = "";
    playButton.disabled = true;
    setText(pollStatus, "not polling");
    showPlaceholder("Player removed from the page.");
    if (hadPlayer) TFLog.push("player removed from the page");
    else TFLog.push("remove pressed with no player");
  }

  function onPagePlay() {
    pagePlayTapped = true;
    TFLog.push("page play button tapped");
    if (!player || modeKind !== "api") {
      TFLog.push("page play button has no API player to call");
      return;
    }
    try {
      player.playVideo();
      TFLog.push("playVideo called");
      armSignInWait();
    } catch (error) {
      TFLog.push("playVideo failed: " + (error && error.message ? error.message : error));
    }
  }

  function describeMessage(data) {
    var text;
    if (typeof data === "string") text = data;
    else {
      try {
        text = JSON.stringify(data);
      } catch (error) {
        text = String(data);
      }
    }
    if (text.length > 2000) return text.slice(0, 2000) + "…";
    return text;
  }

  function buildModes() {
    var fieldset = document.getElementById("modes");
    TF_CONFIG.modes.forEach(function (mode, index) {
      var label = document.createElement("label");
      label.className = "choice";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "mode";
      input.value = mode.id;
      if (index === 0) input.checked = true;
      var text = document.createElement("span");
      var name = document.createElement("strong");
      name.textContent = mode.label;
      var detail = document.createElement("span");
      detail.className = "muted";
      detail.textContent = mode.detail;
      text.appendChild(name);
      text.appendChild(document.createElement("br"));
      text.appendChild(detail);
      label.appendChild(input);
      label.appendChild(text);
      fieldset.appendChild(label);
    });
  }

  function buildVideos() {
    var fieldset = document.getElementById("videos");
    TF_CONFIG.videos.forEach(function (video, index) {
      var label = document.createElement("label");
      label.className = "choice";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "video";
      input.value = video.id;
      if (index === 0) input.checked = true;
      var text = document.createElement("span");
      var title = document.createElement("strong");
      title.textContent = video.caseName + " · " + video.length;
      var name = document.createElement("span");
      name.textContent = video.title;
      var meta = document.createElement("span");
      meta.className = "mono";
      meta.textContent = video.channel + " · " + video.id;
      var why = document.createElement("span");
      why.className = "muted";
      why.textContent = video.why;
      text.appendChild(title);
      text.appendChild(document.createElement("br"));
      text.appendChild(name);
      text.appendChild(document.createElement("br"));
      text.appendChild(meta);
      text.appendChild(document.createElement("br"));
      text.appendChild(why);
      label.appendChild(input);
      label.appendChild(text);
      fieldset.appendChild(label);
    });

    var otherLabel = document.createElement("label");
    otherLabel.className = "choice";
    var otherRadio = document.createElement("input");
    otherRadio.type = "radio";
    otherRadio.name = "video";
    otherRadio.value = "other";
    otherRadio.id = "video-other";
    var otherText = document.createElement("span");
    var otherName = document.createElement("strong");
    otherName.textContent = "Other id";
    otherText.appendChild(otherName);
    otherText.appendChild(document.createElement("br"));
    otherText.appendChild(otherInput);
    otherLabel.appendChild(otherRadio);
    otherLabel.appendChild(otherText);
    fieldset.appendChild(otherLabel);
    otherInput.addEventListener("focus", function () {
      otherRadio.checked = true;
      updateDetail();
    });
  }

  function updateDetail() {
    var box = document.getElementById("video-detail");
    var hint = document.getElementById("start-hint");
    box.replaceChildren();
    hint.replaceChildren();
    var video = selectedPreset();
    if (!video) {
      var other = document.createElement("p");
      other.textContent = "Other id. Use 11 characters, or paste a watch address and this page keeps the id.";
      box.appendChild(other);
      return;
    }
    var checked = document.createElement("p");
    checked.textContent = video.checked;
    box.appendChild(checked);
    if (video.caution) {
      var caution = document.createElement("p");
      caution.className = "caution";
      caution.textContent = video.caution;
      box.appendChild(caution);
    }
    if (video.suggestedStart) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = "Set start to " + video.suggestedStart + "s (" + video.startHint + ")";
      button.addEventListener("click", function () {
        startInput.value = String(video.suggestedStart);
        TFLog.push("start set to " + video.suggestedStart);
      });
      hint.appendChild(button);
    }
  }

  window.addEventListener("message", function (event) {
    if (!plainActive) return;
    if (TF_CONFIG.embedMessageOrigins.indexOf(event.origin) === -1) return;
    TFLog.push("message origin=" + event.origin + " data=" + describeMessage(event.data));
  });

  var referrerMeta = document.querySelector('meta[name="referrer"]');
  TFLog.push(referrerMeta ? "referrer meta " + referrerMeta.content : "no referrer meta; browser default");

  buildModes();
  buildVideos();
  updateDetail();
  showPlaceholder("The player appears here after Load. Nothing is drawn over it.");
  setText(scriptStatus, "not requested");
  setText(frameStatus, "none");
  setText(pollStatus, "not polling");

  document.getElementById("videos").addEventListener("change", updateDetail);
  var signInNote = document.getElementById("sign-in-note");
  if (signInNote) {
    signInNote.textContent =
      "Tap Sign-in prompt seen when the player shows a sign-in or bot-check message. In the API modes, if Play does not reach playing within " +
      TF_CONFIG.signInPromptWaitMs / 1000 +
      " seconds, the log records a candidate signal. The button is the record of what you saw.";
  }

  loadButton.addEventListener("click", loadSelected);
  playButton.addEventListener("click", onPagePlay);
  document.getElementById("sign-in-seen").addEventListener("click", onSignInSeen);
  removeButton.addEventListener("click", removeByHand);
  guardInput.addEventListener("change", function () {
    TFLog.push("guard " + (guardOn() ? "on" : "off"));
    if (modeKind === "plain") TFLog.push("guard does not run in plain mode");
    if (modeKind === "api") evaluateGuard("toggle");
  });
  relInput.addEventListener("change", function () {
    TFLog.push("rel=" + relValue() + " will apply on the next load");
  });
})();
