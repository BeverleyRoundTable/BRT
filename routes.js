function startRoutes() {

    /* ===== Detect API from URL ===== */
    const params = new URLSearchParams(window.location.search);
    const apiBase = params.get("api");

    if (!apiBase) {
        console.error("❌ No API provided. Use ?api=YOUR_SCRIPT_URL");
        return;
    }

    const ROUTES_URL = apiBase + "?function=getRoutes";

    /* ===== Inject styling if missing ===== */
    if (!document.getElementById("santa-routes-style")) {
        const style = document.createElement("style");
        style.id = "santa-routes-style";
        style.textContent = `
            /* (your full CSS unchanged) */
        `;
        document.head.appendChild(style);
    }

    const tonightEl = document.getElementById("tonights-route");
    const allEl = document.getElementById("all-routes");

    if (!tonightEl || !allEl) {
        return setTimeout(startRoutes, 200);
    }

    console.log("ROUTES: Using API → " + ROUTES_URL);

    (async function () {
        try {
            const res = await fetch(ROUTES_URL);
            const data = await res.json();
            const routes = (data.routes || []).slice();

            if (!routes.length) {
                tonightEl.innerHTML =
                    '<p class="santa-no-route">No sleigh routes added yet. 🎅</p>';
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
                    ? "🎅 Tonight's Sleigh Route"
                    : "🎅 Next Sleigh Route";

                tonightEl.innerHTML =
                    `<h2 class="santa-section-title">${title}</h2>` +
                    createRouteCard(next, true);
            }

            /* Divider */
            allEl.insertAdjacentHTML("beforebegin", `
                <div style="margin: 35px 0 15px; text-align:center;">
                    <hr style="border:0; height:2px; width:65%; background:rgba(255,255,255,0.3); border-radius:4px;">
                    <h2 class="santa-section-title" style="margin-top:1rem;">📜 Full Route List</h2>
                </div>
            `);

            /* Full route list */
            allEl.innerHTML = routes.map(r => createRouteCard(r, false)).join("");

        } catch (err) {
            console.error(err);
            tonightEl.innerHTML =
                '<p class="santa-no-route">Sorry — could not load sleigh routes.</p>';
        }
    })();

    /* --- CARD BUILDER --- */
    function createRouteCard(route, highlight) {
        const name = route.routeName || "";
        const dateLabel = route.dateHuman || route.date || "";
        const notes = route.notes || "";
        const streets = route.streets || "";
        const gpx = route.gpxUrl || "";
        const sponsor = route.sponsorurl || route.sponsorUrl || "";
        const map = route.mapImageUrl || "";

        const gpxViewer = gpx
            ? `https://raw.githack.com/BeverleyRoundTable/BRT/main/gpx_viewer.html?gpx=${encodeURIComponent(gpx)}`
            : "";

        return `
<article class="santa-route-card ${highlight ? "santa-route-card--highlight" : ""}">
    <div class="santa-route-main">
        <div class="santa-route-text">
            <h3 class="santa-route-name">${name}</h3>
            <p class="santa-route-date">📅 ${dateLabel}</p>
            ${notes ? `<p>${notes}</p>` : ""}
            ${streets ? `<p><strong>Streets:</strong> ${streets}</p>` : ""}
            <div class="santa-route-actions">
                ${map ? `<a href="${map}" class="santa-btn" target="_blank">View Map</a>` : ""}
                ${gpxViewer ? `<a href="${gpxViewer}" class="santa-btn santa-btn--ghost" target="_blank">Interactive GPX Map</a>` : ""}
            </div>
        </div>
        ${map ? `<div><img src="${map}" class="santa-preview"></div>` : ""}
    </div>

    ${sponsor ? `
    <div class="santa-route-sponsor">
        Proudly sponsored by<br>
        <img src="${sponsor}">
    </div>` : ""}
</article>`;
    }
}

setTimeout(startRoutes, 100);
