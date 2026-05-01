function startRoutes() {

    /* ===== Detect API from URL ===== */
    const params = new URLSearchParams(window.location.search);
    const apiBase = params.get("api");

    if (!apiBase) {
        console.error("❌ No API provided. Use ?api=YOUR_SCRIPT_URL");
        return;
    }

    const ROUTES_URL = apiBase + "?function=getRoutes";

    /* ===== Inject styling and Leaflet if missing ===== */
    if (!document.getElementById("santa-routes-style")) {
        const style = document.createElement("style");
        style.id = "santa-routes-style";
        style.textContent = `
            /* Your full CSS unchanged */
            .santa-route-map-container {
                width: 100%;
                height: 300px;
                border-radius: 10px;
                border: 1px solid var(--border);
                box-shadow: 0 12px 30px rgba(0,0,0,0.5);
                overflow: hidden;
            }
        `;
        document.head.appendChild(style);
    }

    // Inject Leaflet CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const leafletCss = document.createElement('link');
        leafletCss.rel = 'stylesheet';
        leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCss);
    }

    // Inject Leaflet JS and GPX Plugin
    if (!window.L) {
        const leafletJs = document.createElement('script');
        leafletJs.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        document.head.appendChild(leafletJs);
        
        leafletJs.onload = () => {
            const gpxJs = document.createElement('script');
            gpxJs.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/gpx.min.js';
            document.head.appendChild(gpxJs);
        };
    }

    const tonightEl = document.getElementById("tonights-route");
    const allEl = document.getElementById("all-routes");

    if (!tonightEl || !allEl) {
        return setTimeout(startRoutes, 200);
    }

    console.log("ROUTES: Using API → " + ROUTES_URL);

    /* ===== Friendly Date Formatter ===== */
    function formatDate(d) {
        const date = new Date(d);
        if (isNaN(date)) return d;
        return date.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    (async function () {
        try {
            const res = await fetch(ROUTES_URL);
            const data = await res.json();
            const routes = (data.routes || []).slice();

            if (!routes.length) {
                tonightEl.innerHTML =
                    '<p style="text-align:center; color: var(--text-dim); padding: 24px;">No sleigh routes added yet. 🎅</p>';
                return;
            }

            /* Sort routes by date */
            routes.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

            const todayIso = new Date().toISOString().slice(0, 10);

            let tonight = routes.find(r => r.date === todayIso);
            let next = tonight || routes.find(r => r.date >= todayIso);

            /* TONIGHT OR NEXT ROUTE */
            if (next) {
                const isTonight = next.date === todayIso;
                const title = isTonight
                    ? "Tonight's Sleigh Route"
                    : "Next Sleigh Route";

                tonightEl.innerHTML =
                    `<h2 class="santa-section-title">${title}</h2>` +
                    createRouteCard(next, true);
            }

            // subtle pulse on featured route
            setTimeout(() => {
                const card = tonightEl.querySelector(".santa-route-card");
                if (card) {
                    card.classList.add("pulse");
                    setTimeout(() => card.classList.remove("pulse"), 1400);
                }
            }, 120);

            /* Divider */
            allEl.insertAdjacentHTML("beforebegin", `
                <h2 class="santa-section-title">📜 Full Route List</h2>
            `);

            /* Full route list */
            allEl.innerHTML = routes.map(r => createRouteCard(r, false)).join("");

            /* Initialize Mini Maps after DOM is updated */
            setTimeout(() => initMiniMaps(routes), 500);

        } catch (err) {
            console.error(err);
            tonightEl.innerHTML =
                '<p style="text-align:center; color: var(--red); padding: 24px;">Sorry — could not load sleigh routes.</p>';
        }
    })();


    /* --- CARD BUILDER --- */
    function createRouteCard(route, highlight) {
        const name = route.routeName || "";
        const safeNameId = name.replace(/\s+/g, '-').toLowerCase() || Math.random().toString(36).substring(7);
        const dateLabel = formatDate(route.date); 
        const startTime = route["Start Time"] || "";
        const endTime = route["End Time"] || "";
        const timeStr = startTime ? ` · ${startTime}–${endTime}` : "";
        const notes = route.notes || "";
        const streets = route.streets || "";
        const gpx = route.gpxUrl || "";
        const sponsor = route.sponsorurl || route.sponsorUrl || "";

        return `
<article class="santa-route-card ${highlight ? "santa-route-card--highlight" : ""}">
    <div class="santa-route-main">
        <div class="santa-route-text">
            <h3 class="santa-route-name">${name}</h3>
            <p class="santa-route-date">📅 ${dateLabel}${timeStr}</p>
            ${notes ? `<p>${notes}</p>` : ""}
            ${streets ? `<p><strong>Streets:</strong> ${streets}</p>` : ""}
        </div>
        ${gpx ? `<div class="santa-route-map"><div id="map-${safeNameId}" class="santa-route-map-container" data-gpx="${gpx}"></div></div>` : ""}
    </div>

    ${sponsor ? `
    <div class="santa-route-sponsor">
        Proudly sponsored by<br>
        <img src="${sponsor}">
    </div>` : ""}
</article>`;
    }

    /* --- MAP INITIALIZER --- */
    function initMiniMaps(routes) {
        // Ensure Leaflet and GPX plugin are fully loaded before firing
        if (!window.L || !L.GPX) {
            setTimeout(() => initMiniMaps(routes), 200);
            return;
        }

        const mapContainers = document.querySelectorAll('.santa-route-map-container');
        
        mapContainers.forEach(container => {
            const gpxUrl = container.getAttribute('data-gpx');
            if (!gpxUrl) return;

            // Initialize map
            const map = L.map(container.id, {
                zoomControl: true,
                scrollWheelZoom: false // Prevent page scrolling from getting stuck on the map
            }).setView([53.844, -0.428], 13);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            // Load GPX
            new L.GPX(gpxUrl, {
                async: true,
                marker_options: {
                  startIconUrl: 'https://i.ibb.co/PzDYmwzZ/Santa-Marker-4.png',
                  endIconUrl: 'https://i.ibb.co/39WF0kBd/Santa-Marker-5.png',
                  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                  iconSize: [32, 32], 
                  iconAnchor: [16, 32]
                },
                polyline_options: {
                  color: '#d31c1c', 
                  opacity: 0.8,
                  weight: 4,
                  lineCap: 'round'
                }
            }).on('loaded', function(e) {
                map.fitBounds(e.target.getBounds());
            }).addTo(map);
        });
    }
}

setTimeout(startRoutes, 100);
