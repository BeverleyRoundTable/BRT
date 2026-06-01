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

  async function initInteractiveMap(mapId, gpxUrl) {
  const container = document.getElementById(mapId);
  if (!container) return;

  // Initialize the Leaflet map and disable scroll zooming to prevent users getting stuck when scrolling the page
  const map = L.map(mapId, { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

  try {
    // Fetch the GPX file
    const res = await fetch(gpxUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch GPX");
    const text = await res.text();

    // Parse XML (Borrowed from Tracker logic)
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const pts = [...xml.getElementsByTagName("trkpt")];
    if (pts.length < 2) return;

    // Extract coordinates
    const latLngs = pts.map(p => [
      parseFloat(p.getAttribute("lat")),
      parseFloat(p.getAttribute("lon"))
    ]);

    // Draw the red route line
    const routeLine = L.polyline(latLngs, { color: "#d31c1c", weight: 4, opacity: 0.95 }).addTo(map);

    // Auto-center and zoom the map to fit the route perfectly
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

    // Define Start and End markers using Tracker assets
    const startIcon = L.icon({ 
      iconUrl: "https://i.ibb.co/PzDYmwzZ/Santa-Marker-4.png", 
      iconSize: [48, 48], 
      iconAnchor: [24, 48] 
    });
    
    const endIcon = L.icon({ 
      iconUrl: "https://i.ibb.co/39WF0kBd/Santa-Marker-5.png", 
      iconSize: [48, 48], 
      iconAnchor: [24, 48] 
    });

    // Drop the pins
    L.marker(latLngs[0], { icon: startIcon }).addTo(map);
    L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(map);

  } catch (err) {
    console.error("Map rendering error:", err);
    container.innerHTML = "<p style='text-align:center; padding: 20px; color:var(--text-muted);'>Interactive map currently unavailable.</p>";
  }
}
  
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

      // Create a unique ID for the map container based on the route name
      const mapId = 'map-' + routeName.replace(/\s+/g, '-').toLowerCase();

      // Use the interactive map if GPX is available, otherwise fallback to the static image
      const mapHtml = meta.gpxUrl
        ? `<div id="${mapId}" class="addr-route-map leaflet-container" style="height: 300px; z-index: 1; border-radius: 10px; overflow: hidden; border: 1px solid var(--border);"></div>`
        : (meta.mapImageUrl ? `<div class="addr-route-map"><img src="${meta.mapImageUrl}" alt="${routeName} route map" loading="lazy" /></div>` : "");

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

      // --- MOVED INSIDE THE LOOP ---
      // Initialize the map if a GPX URL was found
      if (meta.gpxUrl) {
        // Use setTimeout to ensure the DOM has painted the new map div before Leaflet tries to bind to it
        setTimeout(() => initInteractiveMap(mapId, meta.gpxUrl), 0);
      }
      
    }); // <-- End of forEach loop
  } // <-- End of renderResults function
  
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

  // --- Pull route metadata from master API ---
  fetch(apiBase)
    .then((r) => r.json())
    .then((data) => {
      
      // Build route metadata lookup
if (data && Array.isArray(data.routes)) {
  data.routes.forEach((rt) => {
    if (rt.routeName) {
      routeMeta[rt.routeName] = {
        mapImageUrl: rt.mapImageUrl || "",
        gpxUrl: rt.gpxUrl || "", // <-- ADD THIS LINE
        sponsorUrl: rt.sponsorUrl || "",
        startTime: rt["Start Time"] || "",
        endTime: rt["End Time"] || "",
      };
    }
  });
}
    })
    .catch(() => {
      // silent fail – just no meta
    });
}

// kick off
setTimeout(startAddressLookup, 50);
