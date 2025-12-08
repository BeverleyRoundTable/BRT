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
    // Wait for DOM if needed
    return setTimeout(startAddressLookup, 200);
  }

  let rows = [];

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

  function renderResults(query) {
    const clean = normalise(query);
    resultsEl.innerHTML = "";

    if (!clean) {
      resultsEl.innerHTML =
        "<p class='addr-no-results'>Type a street name above to see your sleigh route.</p>";
      return;
    }

    const matches = rows.filter((r) => normalise(r.street).includes(clean));

    if (!matches.length) {
      resultsEl.innerHTML =
        "<p class='addr-no-results'>No matching streets found.</p>";
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

      const prettyDate = formatDate(first.date);

      const streetsHtml = list
        .map(
          (r) =>
            `<li>📍 <strong>${r.street}</strong></li>`
        )
        .join("");

      const card = document.createElement("article");
      card.className = "addr-route-card";
      card.innerHTML = `
        <h2 class="addr-route-title">${routeName}</h2>
        ${
          prettyDate
            ? `<p class="addr-route-date">📅 ${prettyDate}</p>`
            : ""
        }
        <ul class="addr-streets-list">
          ${streetsHtml}
        </ul>
      `;
      resultsEl.appendChild(card);
    });
  }

  // --- Wire events ---
  btnEl.addEventListener("click", () => renderResults(inputEl.value));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") renderResults(inputEl.value);
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

  // --- Pull logo from master API for the input icon ---
  fetch(apiBase)
    .then((r) => r.json())
    .then((data) => {
      const logo =
        data &&
        data.settings &&
        data.settings.logo_overlay_url;

      if (logo && inputEl) {
        inputEl.style.backgroundImage = `url('${logo}')`;
      }
    })
    .catch(() => {
      // silent fail – just no logo
    });
}

// kick off
setTimeout(startAddressLookup, 50);
