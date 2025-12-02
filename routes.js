function startRoutes() {

    // Inject FULL CSS once
    if (!document.getElementById("santa-routes-style")) {
        const style = document.createElement("style");
        style.id = "santa-routes-style";
        style.textContent = `
            /* Make all route text white */
            .santa-route-card,
            .santa-route-card * {
                color: #ffffff !important;
            }

            /* Card background styling */
            .santa-route-card {
                background: rgba(0, 0, 0, 0.55);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 14px;
                padding: 1.2rem;
                margin: 1.5rem auto;
                max-width: 720px;
                backdrop-filter: blur(6px);
            }

            /* Highlight card (Tonight / Next) */
            .santa-route-card--highlight {
                border-color: #ffcf5c !important;
                box-shadow: 0 0 18px rgba(255,207,92,0.5);
            }

            .santa-route-name {
                font-size: 1.35rem;
                font-weight: 600;
                margin-bottom: 0.25rem;
            }

            .santa-route-date {
                font-size: 1.05rem;
                margin-bottom: 0.5rem;
                opacity: 0.9;
            }

            .santa-route-notes,
            .santa-route-streets {
                font-size: 1rem;
                margin-bottom: 0.35rem;
                line-height: 1.5;
            }

            .santa-btn {
                display: inline-block;
                padding: 0.35rem 0.9rem;
                border-radius: 30px;
                background: #ff3b3b;
                color: #fff !important;
                text-decoration: none !important;
                margin-right: 0.5rem;
                font-size: 0.9rem;
            }

            .santa-btn--ghost {
                background: transparent !important;
                border: 1px solid rgba(255,255,255,0.8) !important;
            }

            .santa-route-sponsor {
                margin-top: 0.6rem;
                font-size: 0.9rem;
                opacity: 0.9;
            }

            /* Error message styling */
            .santa-no-route {
                color: #ffffff !important;
                font-size: 1.15rem !important;
                text-align: center !important;
                opacity: 0.9 !important;
                margin: 20px auto !important;
                max-width: 700px !important;
                line-height: 1.6 !important;
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
                    '<h2 class="santa-section-title">' +
                    title +
                    "</h2>" +
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
${sponsorImg ? `<div class="santa-route-sponsor"><span>Proudly sponsored by</span><img src="${sponsorImg}"></div>` : ""}
</article>`;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"]/g, (s) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        }[s]));
    }
}

setTimeout(startRoutes, 100);
