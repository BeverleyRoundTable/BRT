/* ============================================================
   TurboSanta — "Talk to Father Christmas" widget loader  v2
   ElevenLabs Agents integration for the tracker site
   ------------------------------------------------------------
   Install: upload alongside the tracker and add before </body>:
     <script src="santa-chat.js" defer></script>

   v2: pulls route nights straight from the tracker's Apps
   Script API (the same endpoint as ?api=). The widget shows
   itself on route days between the hours you set, and Santa
   is told tonight's route via the {{route_info}} dynamic
   variable — no double-entry of dates anywhere.

   Requirements (see santa-agent-setup.md):
   - Agent must be PUBLIC (authentication disabled)
   - Tracker domain added to the agent's allowlist
   - route_info dynamic variable defined on the agent
   ============================================================ */

(function () {
  "use strict";

  var CONFIG = {
    // From the ElevenLabs dashboard → your agent → Widget tab
    agentId: "PASTE_AGENT_ID_HERE",

    // Master switch. False = widget never loads.
    enabled: true,

    // Tracker Apps Script endpoint. Leave "" to auto-read the
    // page's ?api= parameter — same multi-chapter pattern as
    // the rest of the platform.
    apiUrl: "",

    // true  = widget only appears on route days (needs the API)
    // false = widget appears whenever enabled; the API is still
    //         used to feed Santa the route details
    routeNightsOnly: true,

    // On route days, when is Santa taking calls? (local time)
    routeDayHours: { start: "15:00", end: "21:30" },

    // Manual fallback windows, used only if the API is missing
    // or unreachable. Empty = always available while enabled.
    // Example: { start: "2026-12-07T17:00", end: "2026-12-07T20:30" }
    schedule: [],

    labels: {
      action: "Talk to Father Christmas",
      start: "Ho ho ho — tap to talk!",
      end: "Back to the North Pole"
    },

    // Optional https:// image for the widget button (use a Santa
    // or sleigh photo — not the Round Table rondel; see brand notes)
    avatarUrl: "",

    // Visiting ?santa=1 forces the widget on for testing.
    previewParam: "santa"
  };

  var WIDGET_TAG = "elevenlabs-convai";
  var EMBED_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";
  var injected = false;
  var lastRouteInfo = "Route details unavailable — check the tracker map with a grown-up.";

  /* ---------- helpers ---------- */

  function resolveApiUrl() {
    if (CONFIG.apiUrl) return CONFIG.apiUrl;
    try {
      return new URLSearchParams(window.location.search).get("api") || "";
    } catch (e) { return ""; }
  }

  function hasPreviewFlag() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(CONFIG.previewParam) === "1";
    } catch (e) { return false; }
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10); // matches God Mode convention
  }

  function getTodayRoute(routes) {
    var today = todayISO();
    return routes.find(function (r) { return r.date === today; }) || null;
  }

  function getNextRoute(routes) {
    var today = todayISO();
    return routes
      .filter(function (r) { return r.date && r.date > today; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); })[0] || null;
  }

  function fmtDate(d) {
    var dt = new Date(d + "T00:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  function withinHours(hours) {
    var now = new Date();
    var hm = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    return hm >= hours.start && hm <= hours.end;
  }

  function inManualWindow() {
    if (!CONFIG.schedule || CONFIG.schedule.length === 0) return true;
    var now = new Date();
    return CONFIG.schedule.some(function (w) {
      var s = new Date(w.start), e = new Date(w.end);
      return !isNaN(s) && !isNaN(e) && now >= s && now <= e;
    });
  }

  function buildRouteInfo(todayRoute, nextRoute) {
    var parts = [];
    if (todayRoute) {
      parts.push("The sleigh IS out tonight on the " + (todayRoute.routeName || "Beverley") + " route.");
      if (todayRoute.streets) parts.push("Streets tonight: " + todayRoute.streets + ".");
    } else {
      parts.push("The sleigh is not out tonight.");
    }
    if (nextRoute) {
      parts.push("Next visit: " + fmtDate(nextRoute.date) +
        (nextRoute.routeName ? " (" + nextRoute.routeName + " route)" : "") + ".");
    }
    return parts.join(" ") || lastRouteInfo;
  }

  function fetchRoutes(apiUrl) {
    return fetch(apiUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status);
        return res.json();
      })
      .then(function (data) { return data.routes || []; });
  }

  /* ---------- widget ---------- */

  function injectWidget() {
    if (injected) return;
    if (!CONFIG.agentId || CONFIG.agentId === "PASTE_AGENT_ID_HERE") {
      console.warn("[SantaChat] No agent ID set — widget not loaded.");
      return;
    }

    var el = document.createElement(WIDGET_TAG);
    el.setAttribute("agent-id", CONFIG.agentId);
    el.setAttribute("dynamic-variables", JSON.stringify({ route_info: lastRouteInfo }));
    if (CONFIG.labels.action) el.setAttribute("action-text", CONFIG.labels.action);
    if (CONFIG.labels.start) el.setAttribute("start-call-text", CONFIG.labels.start);
    if (CONFIG.labels.end) el.setAttribute("end-call-text", CONFIG.labels.end);
    if (CONFIG.avatarUrl) el.setAttribute("avatar-image-url", CONFIG.avatarUrl);
    document.body.appendChild(el);

    var script = document.createElement("script");
    script.src = EMBED_SRC;
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);

    injected = true;
    console.info("[SantaChat] Widget loaded. route_info: " + lastRouteInfo);
  }

  function removeWidget() {
    var el = document.querySelector(WIDGET_TAG);
    if (el) el.remove();
    injected = false;
    console.info("[SantaChat] Widget removed.");
  }

  /* ---------- decide & init ---------- */

  function init() {
    if (!CONFIG.enabled && !hasPreviewFlag()) {
      console.info("[SantaChat] Disabled.");
      return;
    }

    var apiUrl = resolveApiUrl();

    if (!apiUrl) {
      // No API available — fall back to manual schedule behaviour
      if (hasPreviewFlag() || inManualWindow()) injectWidget();
      else console.info("[SantaChat] Hidden (manual schedule). Append ?santa=1 to preview.");
      return;
    }

    fetchRoutes(apiUrl)
      .then(function (routes) {
        var todayRoute = getTodayRoute(routes);
        var nextRoute = getNextRoute(routes);
        lastRouteInfo = buildRouteInfo(todayRoute, nextRoute);

        var show = hasPreviewFlag() ||
          !CONFIG.routeNightsOnly ||
          (todayRoute && withinHours(CONFIG.routeDayHours));

        if (show) injectWidget();
        else console.info("[SantaChat] Hidden (no route tonight / outside hours). Append ?santa=1 to preview.");
      })
      .catch(function (e) {
        console.warn("[SantaChat] API unreachable (" + e.message + ") — using manual schedule fallback.");
        if (hasPreviewFlag() || inManualWindow()) injectWidget();
      });
  }

  /* Public hooks — ready for God Mode wiring:
       SantaChat.show() / SantaChat.hide() / SantaChat.status() */
  window.SantaChat = {
    show: injectWidget,
    hide: removeWidget,
    status: function () {
      return {
        enabled: CONFIG.enabled,
        preview: hasPreviewFlag(),
        apiUrl: resolveApiUrl() || "(none)",
        routeInfo: lastRouteInfo,
        injected: injected
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
