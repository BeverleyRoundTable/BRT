function startRoutes() {

    /* Inject styles once */
    if (!document.getElementById("santa-routes-style")) {
        const style = document.createElement("style");
        style.id = "santa-routes-style";
        style.textContent = `

        /* GENERAL TEXT FIXES */
        .santa-route-card,
        .santa-route-card * {
            color: #ffffff !important;
        }

        .santa-section-title {
            color: #ffffff !important;
            text-align: center;
            margin-bottom: 10px;
        }

        .santa-no-route {
            color: #ffffff !important;
            font-size: 1.15rem !important;
            text-align: center !important;
            opacity: 0.9 !important;
            margin: 20px auto !important;
            max-width: 700px !important;
            line-height: 1.6 !important;
        }

        /* CARD LAYOUT */
        .santa-route-card {
            background: rgba(0,0,0,0.65);
            backdrop-filter: blur(2px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            padding: 22px;
            margin: 30px auto;
            max-width: 900px;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.18);
        }

        /* TONIGHT / NEXT ROUTE HIGHLIGHT */
        .santa-route-card--highlight {
            border: 2px solid rgba(255,215,0,0.6) !important;
            box-shadow: 0 0 25px rgba(255,215,0,0.45) !important;
        }

        .santa-route-main {
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .santa-route-name {
            font-size: 1.8rem !important;
            text-align: center;
            margin-bottom: 6px;
        }

        .santa-route-date {
            text-align: center;
        }

        /* BUTTONS */
        .santa-route-actions {
            text-align: center;
            margin-top: 15px !important;
        }

        .santa-btn {
            display: inline-block;
            background: #e53935;
            padding: 10px 18px !important;
            border-radius: 14px !important;
            color: #fff !important;
            margin: 6px;
            font-weight: 600;
            border: 2px solid transparent;
            text-decoration: none !important;
        }

        .santa-btn--ghost {
            background: transparent !important;
            border: 2px solid #fff !important;
        }

        /* MAP PREVIEW */
        .santa-route-map img {
            width: 100% !important;
            max-width: 480px !important;
            height: auto;
            display: block;
            margin: 10px auto;
            border-radius: 14px;
            box-shadow: 0 0 10px rgba(0,0,0,0.35);
        }

        /* SPONSOR */
        .santa-route-sponsor {
            text-align: center;
            font-size: 1rem;
            margin-top: 25px !important;
        }

        .santa-route-sponsor img {
            width: 220px !important;
            max-width: 40% !important;
            height: auto;
            display: block;
            margin: 10px auto;
        }

        /* DESKTOP LAYOUT */
        @media (min-width: 700px) {
            .santa-route-main {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
            }
            .santa-route-text {
                flex: 1;
                padding-right: 20px;
            }
            .santa-route-map {
                flex: 1;
            }
        }
        `;
        document.head.appendChild(style);
    }

    /* Find containers */
    const tonightEl = document.getElementById("tonights-route");
    const allEl = document.getElementById("all-routes");

    if (!tonightEl || !allEl) {
        return setTimeout(startRoutes, 200);
    }

    console.log("ROUTES.JS INITIALISED");

    const ROUTES_URL =
        "https://script.google.com/macros/s/AKfycbx0cr7b-3GsKuI02aoITSNDnNNJWJ_HE_IbCm4Iu3PWUrytvMrvwXRYTeKHXaryrEfViw/exec?function=getRoutes";

    /* Load routes */
    (async function () {
        try {
            const res = await fetch(ROUTES_URL);
            const data = await res.json();
            const routes = (data.routes || []).slice();

            if (!routes.length) {
                tonightEl.innerHTML =
                    '<p class="santa-no-route">No sleigh routes have been added yet. 🎅</p>';
                return;
            }

            /* Sort by date */
            routes.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

            const todayIso = new Date().toISOString().slice(0, 10);

            /* Determine tonight or next route */
            let tonight = routes.find(r => r.date === todayIso);
            let next = tonight || routes.find(r => r.date >= todayIso);

            /* Display tonight/next route */
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
            const dividerHTML = `
                <div style="margin: 35px 0 15px; text-align:center;">
                    <hr style="border:0; height:2px; width:65%; background:rgba(255,255,255,0.3); border-radius:4px;">
                    <h2 class="santa-section-title" style="margin-top:1rem;">📜 Full Route List</h2>
                </div>
            `;
            allEl.insertAdjacentHTML("beforebegin", dividerHTML);

            /* Render all routes */
            allEl.innerHTML = routes.map(r => createRouteCard(r, false)).join("");

        } catch (err) {
            console.error(err);
            tonightEl.innerHTML =
                '<p class="santa-no-route">Sorry — unable to load routes right now.</p>';
        }
    })();


    /* =====================================================
       CARD BUILDER
    ===================================================== */
    function createRouteCard(route, highlight) {

        /* Match Google Sheet structure */
        const name = route.routeName || "";
        const date = route.dateHuman || route.date || "";
        const day = route.day || "";
        const notes = route.notes || "";
        const streets = route.streets ? route.streets.join(", ") : "";
        const mapImg = route.mapImageUrl || "";
        const gpx = route.gpxUrl || "";
        const sponsor = route.sponsorurl || "";

        /* GPX viewer link */
        const gpxViewer = gpx
            ? `https://raw.githack.com/BeverleyRoundTable/BRT/main/gpx_viewer.html?gpx=${encodeURIComponent(gpx)}`
            : "";

        const dateLabel = day ? `${day} ${date}` : date;

        return `
<article class="santa-route-card ${highlight ? "santa-route-card--highlight" : ""}">
<div class="santa-route-main">

    <div class="santa-route-text">
        <h3 class="santa-route-name">${escapeHtml(name)}</h3>

        ${dateLabel ? `<p class="santa-route-date">📅 ${escapeHtml(dateLabel)}</p>` : ""}
        ${notes ? `<p class="santa-route-notes">${escapeHtml(notes)}</p>` : ""}
        ${streets ? `<p class="santa-route-streets"><strong>Key streets:</strong> ${escapeHtml(streets)}</p>` : ""}

        <div class="santa-route-actions">
            ${mapImg ? `<a href="${mapImg}" class="santa-btn" target="_blank">View Map</a>` : ""}
            ${gpxViewer ? `<a href="${gpxViewer}" class="santa-btn santa-btn--ghost" target="_blank">Interactive GPX Map</a>` : ""}
        </div>
    </div>

    ${mapImg ? `<div class="santa-route-map"><img src="${mapImg}" loading="lazy"></div>` : ""}
</div>

${sponsor ? `<div class="santa-route-sponsor"><span>Proudly sponsored by</span><br><img src="${sponsor}"></div>` : ""}
</article>`;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"]/g, s => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;"
        })[s]);
    }
}

setTimeout(startRoutes, 100);
