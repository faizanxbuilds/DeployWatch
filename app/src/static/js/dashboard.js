/* DeployWatch dashboard — live status polling, uptime ticker, try-it API rows.
 * Same-origin fetches: this script runs on the app itself, so the endpoints
 * are relative (no CORS involved). */
(function () {
  "use strict";

  var pill = document.getElementById("live-pill");
  var liveText = document.getElementById("live-text");
  var statStatus = document.getElementById("stat-status");
  var uptimeEl = document.getElementById("stat-uptime");

  // Uptime counts up client-side between polls so the number never looks frozen.
  var uptimeSeconds = parseInt(uptimeEl ? uptimeEl.getAttribute("data-uptime") : "0", 10) || 0;

  function formatUptime(totalSeconds) {
    var d = Math.floor(totalSeconds / 86400);
    var h = Math.floor((totalSeconds % 86400) / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    var parts = [];
    if (d > 0) parts.push(d + "d");
    if (h > 0 || d > 0) parts.push(h + "h");
    if (m > 0 || h > 0 || d > 0) parts.push(m + "m");
    parts.push(s + "s");
    return parts.join(" ");
  }

  function renderUptime() {
    if (uptimeEl) uptimeEl.textContent = formatUptime(uptimeSeconds);
  }

  function setState(state) {
    // state: "ok" | "down" | "checking"
    pill.classList.remove("ok", "down");
    if (state === "ok") {
      pill.classList.add("ok");
      liveText.textContent = "Live";
      if (statStatus) statStatus.textContent = "Running";
    } else if (state === "down") {
      pill.classList.add("down");
      liveText.textContent = "Unreachable";
      if (statStatus) statStatus.textContent = "Down";
    } else {
      liveText.textContent = "Checking…";
    }
  }

  function poll() {
    fetch("/api/status", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then(function (data) {
        if (data && data.status === "running") {
          setState("ok");
          if (typeof data.uptime_seconds === "number") {
            uptimeSeconds = data.uptime_seconds;
            renderUptime();
          }
        } else {
          setState("down");
        }
      })
      .catch(function () {
        setState("down");
      });
  }

  function prettyBody(endpoint, text) {
    var trimmed = text.trim();
    if (endpoint === "/metrics") {
      var lines = trimmed.split("\n");
      var head = lines.slice(0, 25).join("\n");
      return lines.length > 25 ? head + "\n… (" + lines.length + " lines total)" : head;
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch (e) {
      return trimmed.slice(0, 2000);
    }
  }

  function wireTryIt() {
    var list = document.querySelector(".api-list");
    if (!list) return;
    list.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button.api-row") : null;
      if (!btn) return;
      var pre = btn.parentNode.querySelector(".api-response");
      if (!pre) return;
      var willOpen = pre.hidden;
      // Close any other open response first.
      var others = list.querySelectorAll(".api-response");
      for (var i = 0; i < others.length; i++) {
        others[i].hidden = true;
        var b = others[i].parentNode.querySelector("button.api-row");
        if (b) b.setAttribute("aria-expanded", "false");
      }
      if (!willOpen) return;
      pre.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var endpoint = btn.getAttribute("data-endpoint");
      pre.textContent = "GET " + endpoint + " …";
      fetch(endpoint, { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("http " + res.status);
          return res.text();
        })
        .then(function (text) {
          pre.textContent = prettyBody(endpoint, text);
        })
        .catch(function () {
          pre.textContent = "request failed — try again.";
        });
    });
  }

  renderUptime();
  setState("checking");
  wireTryIt();
  poll();
  setInterval(poll, 5000);          // refresh health every 5s
  setInterval(function () {         // tick the uptime display every 1s
    uptimeSeconds += 1;
    renderUptime();
  }, 1000);
})();
