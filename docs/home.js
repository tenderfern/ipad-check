(function () {
  "use strict";

  var versionInput = document.getElementById("ipados");
  var videoSet = document.getElementById("video-set");

  function fillEnvironment() {
    var values = {
      context: TFEnv.contextLabel(),
      standalone: navigator.standalone === undefined ? "undefined" : String(navigator.standalone),
      displayMode: String(TFEnv.standaloneMedia()),
      touch: String(navigator.maxTouchPoints),
      viewport: window.innerWidth + "×" + window.innerHeight,
      time: new Date().toString(),
      href: location.href,
      ua: navigator.userAgent,
    };
    Object.keys(values).forEach(function (key) {
      var node = document.getElementById("env-" + key);
      if (node) node.textContent = values[key];
    });
  }

  function fillVideos() {
    TF_CONFIG.videos.forEach(function (video) {
      var article = document.createElement("article");
      var heading = document.createElement("h3");
      heading.textContent = video.caseName;
      var meta = document.createElement("p");
      meta.textContent = video.title + " — " + video.channel + " — " + video.length;
      var id = document.createElement("p");
      id.className = "mono";
      id.textContent = video.id;
      var why = document.createElement("p");
      why.textContent = video.why;
      var checked = document.createElement("p");
      checked.textContent = video.checked;
      article.appendChild(heading);
      article.appendChild(meta);
      article.appendChild(id);
      article.appendChild(why);
      article.appendChild(checked);
      videoSet.appendChild(article);
    });
  }

  versionInput.value = TFEnv.ipados();
  versionInput.addEventListener("input", function () {
    TFEnv.setIpados(versionInput.value.trim());
  });
  document.getElementById("log-env").addEventListener("click", function () {
    TFLog.push("environment recorded from the home page");
    TFEnv.lines().forEach(function (line) {
      TFLog.push(line);
    });
  });
  document.getElementById("refresh-env").addEventListener("click", fillEnvironment);
  window.addEventListener("resize", fillEnvironment);
  fillEnvironment();
  fillVideos();
})();
