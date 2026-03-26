function startAddressLookup() {
  // --- Get API from URL ---
  const params = new URLSearchParams(window.location.search);
  const apiBase = params.get("api");
  if (!apiBase) {
    console.error("❌ No API provided. Use ?api=YOUR_SCRIPT_URL");
    const results = document.getElementById("results");
    if (results) {
      results.innerHTML =
        "<p class='addr-no-results'>No API detected – add <code>?api=YOUR_SCRIPT_URL</code>.</p>";
    }
    return;
  }

  const LOOKUP_URL = apiBase + "?function=getAddressLookup";
  const inputEl = document.getElementById("searchInput");
  const btnEl = document.getElementById("searchBtn");
  const resultsEl = document.getElementById("results");

  if (!inputEl || !btnEl || !resultsEl) {
    return setTimeout(startAddressLookup, 200);
  }

  let rows = [];
  let routeMeta = {}; // routeName → { mapImageUrl, sponsorUrl, ... }

  // --- Helpers ---
  function normalise(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function daysUntil(iso) {
    const target = new Date(iso);
    if (isNaN(target)) return null;
    const now = new Date();
    // Zero out times for clean day comparison
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function countdownText(days) {
    if (days === null) return "";
    if (days < 0) return "Route completed";
    if (days === 0) return "Tonight!";
    if (days === 1) return "Tomorrow!";
    return "In " + days + " days";
  }

  function countdownClass(days) {
    if (days === null) return "";
    if (days < 0) return "countdown-past";
    if (days <= 1) return "countdown-imminent";
    if (days <= 3) return "countdown-soon";
    return "countdown-future";
  }

  function highlightMatch(street, query) {
    if (!query) return street;
    const regex = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return street.replace(regex, "<mark>$1</mark>");
  }

  function doSearch() {
    btnEl.classList.remove("pulse");
    void btnEl.offsetWidth;
    btnEl.classList.add("pulse");
    renderResults(inputEl.value);
  }

  function renderResults(query) {
    const clean = normalise(query);
    resultsEl.innerHTML = "";

    if (!clean) {
      resultsEl.innerHTML =
        "<p class='addr-no-results'>Type your street name above to find out when Santa visits.</p>";
      return;
    }

    const matches = rows.filter((r) => normalise(r.street).includes(clean));

    if (!matches.length) {
      resultsEl.innerHTML =
        "<p class='addr-no-results'>No matching streets found.<br><small>Try a shorter search or check the spelling.</small></p>";
      return;
    }

    // Group by route
    const byRoute = {};
    matches.forEach((row) => {
      if (!byRoute[row.route]) byRoute[row.route] = [];
      byRoute[row.route].push(row);
    });

    Object.keys(byRoute).forEach((routeName) => {
      const list = byRoute[routeName];
      const first = list[0] || {};
      const meta = routeMeta[routeName] || {};

      const prettyDate = formatDate(first.date);
      const days = daysUntil(first.date);
      const cdText = countdownText(days);
      const cdClass = countdownClass(days);
      const timeStr = meta.startTime ? ` · ${meta.startTime}–${meta.endTime}` : "";

      // Street list with highlighted match
      const streetsHtml = list
        .map(
          (r) =>
            `<li><span class="pin">📍</span> <strong>${highlightMatch(r.street, query)}</strong></li>`
        )
        .join("");

      // Map thumbnail (if available)
      const mapHtml = meta.mapImageUrl
        ? `<div class="addr-route-map"><img src="${meta.mapImageUrl}" alt="${routeName} route map" loading="lazy" /></div>`
        : "";

      // Sponsor (if available)
      const sponsorHtml = meta.sponsorUrl
        ? `<div class="addr-sponsor"><span class="sponsor-label">Sponsored by</span><img src="${meta.sponsorUrl}" alt="Sponsor" loading="lazy" /></div>`
        : "";

      const card = document.createElement("article");
      card.className = "addr-route-card";
      card.innerHTML = `
        <div class="addr-card-header">
          <div class="addr-card-titles">
            <h2 class="addr-route-title">${routeName}</h2>
            ${prettyDate ? `<p class="addr-route-date">📅 ${prettyDate}${timeStr}</p>` : ""}
          </div>
          ${cdText ? `<span class="addr-countdown ${cdClass}">${cdText}</span>` : ""}
        </div>
        ${mapHtml}
        <ul class="addr-streets-list">
          ${streetsHtml}
        </ul>
        ${sponsorHtml}
      `;
      resultsEl.appendChild(card);
    });
  }

  // --- Wire events ---
  btnEl.addEventListener("click", doSearch);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    }
  });

  // --- Load address data ---
  fetch(LOOKUP_URL)
    .then((r) => r.json())
    .then((data) => {
      rows = Array.isArray(data) ? data : [];
    })
    .catch((err) => {
      console.error("Address lookup error:", err);
      resultsEl.innerHTML =
        "<p class='addr-no-results'>Sorry – could not load address data.</p>";
    });

  // --- Pull route metadata + logo from master API ---
  fetch(apiBase)
    .then((r) => r.json())
    .then((data) => {
      // Logo for input icon
      const logo = data && data.settings && data.settings.logo_overlay_url;
      if (logo && inputEl) {
        inputEl.style.backgroundImage = `url('${logo}')`;
      }

      // Build route metadata lookup
      if (data && Array.isArray(data.routes)) {
        data.routes.forEach((rt) => {
  if (rt.routeName) {
    routeMeta[rt.routeName] = {
      mapImageUrl: rt.mapImageUrl || "",
      sponsorUrl: rt.sponsorUrl || "",
      startTime: rt["Start Time"] || "",
      endTime: rt["End Time"] || "",
    };
  }
});
      }
    })
    .catch(() => {
      // silent fail – just no logo/meta
    });
}

// kick off
setTimeout(startAddressLookup, 50);
