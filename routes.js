function startRoutes() {
    /* Inject global styling for route cards */
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

        /* CARD LAYOUT FIXES */
        .santa-route-card {
            background: rgba(0,0,0,0.45);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            padding: 20px;
            margin: 25px auto;
            max-width: 900px;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.25);
        }

        .santa-route-main {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .santa-route-name {
            color: #ffffff !important;
            font-size: 1.8rem !important;
            text-align: center;
            margin-bottom: 5px;
        }

        .santa-route-date {
            text-align: center;
        }

        .santa-route-actions {
            text-align: center;
            margin-top: 10px;
        }

        /* BUTTONS */
        .santa-btn {
            display: inline-block;
            background: #e53935;
            padding: 8px 16px;
            border-radius: 12px;
            color: #fff !important;
            margin: 5px;
            text-decoration: none;
            font-weight: 600;
            border: 2px solid transparent;
        }

        .santa-btn--ghost {
            background: transparent;
            border: 2px solid #fff;
        }

        /* RESPONSIVE IMAGE FIXES */
        .santa-route-map img,
        .santa-route-sponsor img {
            width: 33%;
    max-width: 250px;      /* prevents it becoming huge on desktop */
    min-width: 120px;      /* keeps it readable on mobile */
    height: auto;
    display: block;
    margin: 10px auto;
    border-radius: 10px;
        }

        .santa-route-sponsor {
            text-align: center;
            font-size: 1rem;
            margin-top: 15px;
        }

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

    const tonightEl = document.getElementById('tonights-route');
    const allEl = document.getElementById('all-routes');

    if (!tonightEl || !allEl) {
        console.warn("Waiting for Carrd DOM…");
        return setTimeout(startRoutes, 200);
    }

    console.log("ROUTE SCRIPT INITIALISED");

    const ROUTES_URL =
        "https://script.google.com/macros/s/AKfycbx0cr7b-3GsKuI02aoITSNDnNNJWJ_HE_IbCm4Iu3PWUrytvMrvwXRYTeKHXaryrEfViw/exec?function=getRoutes";

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

            routes.sort((a, b) =>
                (a.date || "").localeCompare(b.date || "")
            );

            const todayIso = new Date().toISOString().slice(0, 10);

            let tonight = routes.find((r) => r.date === todayIso);
            let next = tonight || routes.find((r) => r.date >= todayIso);

            if (next) {
                const isTonight = next.date === todayIso;
                const title = isTonight
                    ? "🎅 Tonight's Sleigh Route"
                    : "🎅 Next Sleigh Route";

                tonightEl.innerHTML =
                    `<h2 class="santa-section-title">${title}</h2>` +
                    createRouteCard(next, true);
            }

            allEl.innerHTML = routes
                .map((r) => createRouteCard(r, false))
                .join("");

        } catch (err) {
            console.error(err);
            tonightEl.innerHTML =
                '<p class="santa-no-route">Sorry, we could not load the sleigh routes right now.</p>';
        }
    })();

    function createRouteCard(route, highlight) {
        const name = route.routeName || "";
        const dateLabel =
            route.day && route.dateHuman
                ? route.day + " " + route.dateHuman
                : route.dateHuman || route.date || "";

        const notes = route.notes || "";
        const streets = (route.streets || []).join(", ");
        const gpx = route.gpxUrl || "";
        const mapImg = route.mapImageUrl || "";
        const sponsorImg = route.sponsorUrl || "";

        return `
<article class="santa-route-card ${highlight ? "santa-route-card--highlight" : ""}">
<div class="santa-route-main">
    <div class="santa-route-text">
        <h3 class="santa-route-name">${escapeHtml(name)}</h3>
        ${dateLabel ? `<p class="santa-route-date">📅 ${escapeHtml(dateLabel)}</p>` : ""}
        ${notes ? `<p class="santa-route-notes">${escapeHtml(notes)}</p>` : ""}
        ${streets ? `<p class="santa-route-streets"><strong>Key streets:</strong> ${escapeHtml(streets)}</p>` : ""}
        <div class="santa-route-actions">
            ${mapImg ? `<a href="${mapImg}" class="santa-btn" target="_blank">View map</a>` : ""}
            ${gpx ? `<a href="${gpx}" class="santa-btn santa-btn--ghost" target="_blank">Download GPX</a>` : ""}
        </div>
    </div>

    ${mapImg ? `<div class="santa-route-map"><img src="${mapImg}" loading="lazy"></div>` : ""}
</div>

${sponsorImg ? `<div class="santa-route-sponsor"><span>Proudly sponsored by</span><br><img src="${sponsorImg}"></div>` : ""}
</article>`;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"]/g, (s) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        })[s]);
    }
}

setTimeout(startRoutes, 100);
