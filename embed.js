(function() {
    const API_URL = "https://script.google.com/macros/s/AKfycbzbaKTtCF2ppCR0UBqFFzAHsgfHuMlm9jEkkfIsKZnN80U9wQyIZ0lh90J4uQB2H8bo/exec";

    // ============================================================
    // UTILITIES
    // ============================================================

    function loadScript(src) {
        return new Promise(res => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = res;
            document.body.appendChild(s);
        });
    }

    function loadCSS(href) {
        return new Promise(res => {
            const l = document.createElement("link");
            l.rel = "stylesheet";
            l.href = href;
            l.onload = res;
            document.head.appendChild(l);
        });
    }

    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    // ============================================================
    // FETCH DATA
    // ============================================================

    async function loadData() {
        const res = await fetch(API_URL);
        return await res.json();
    }

    // ============================================================
    // INITIALISE
    // ============================================================

    async function init() {
        const data = await loadData();

        const settings = data.settings || {};
        const routes = data.routes || [];
        const donations = data.donations || {};
        const tracker = data.tracker || {};
        const carousel = data.carousel || [];
        const lookup = data.lookup || [];
        const sponsors = data.sponsors || [];

        // ============================================================
        // AUTO-INJECT MAIN CONTAINER
        // ============================================================

        const root = document.createElement("div");
        root.id = "santa-platform";
        root.style.maxWidth = "900px";
        root.style.margin = "20px auto";
        root.style.color = "white";
        root.style.fontFamily = "system-ui, sans-serif";
        root.style.padding = "20px";
        root.style.borderRadius = "16px";
        root.style.background = "rgba(0,0,0,0.55)";
        root.style.border = "1px solid rgba(255,255,255,0.2)";
        root.style.boxShadow = "0 0 20px rgba(255,215,0,0.25)";
        document.body.prepend(root);

        // ============================================================
        // LOAD LEAFLET FOR MAP
        // ============================================================

        await loadCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

        // ============================================================
        // DETERMINE TODAY / NEXT ROUTE
        // ============================================================

        routes.sort((a,b)=> (a.date||"").localeCompare(b.date||""));
        const today = todayISO();

        const todayRoute = routes.find(r => r.date === today);
        const nextRoute = routes.find(r => r.date > today);
        const activeRoute = todayRoute || nextRoute;

        // Title
        const header = document.createElement("h2");
        header.style.marginTop = "0";
        header.innerHTML = todayRoute ? "🎅 Tonight’s Sleigh Route" :
                           nextRoute ? "🎅 Next Sleigh Route" :
                           "🎄 Sleigh Routes";
        root.appendChild(header);

        // ============================================================
        // MAP
        // ============================================================

        const mapEl = document.createElement("div");
        mapEl.id = "santa-map";
        mapEl.style.width = "100%";
        mapEl.style.height = "420px";
        mapEl.style.borderRadius = "12px";
        mapEl.style.marginBottom = "15px";
        root.appendChild(mapEl);

        const map = L.map("santa-map").setView([54, -1], parseInt(settings.default_map_zoom || 15));

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19})
         .addTo(map);

        // ============================================================
        // OPTIONAL GPX OVERLAY
        // ============================================================

        if (tracker.enable_gpx_overlay === "TRUE" && activeRoute && activeRoute.gpxUrl) {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/gpx.min.js");

            new L.GPX(activeRoute.gpxUrl, {
                async: true,
                polyline_options: {
                    color: settings.primary_color || "#d31c1c",
                    weight: 4,
                    opacity: 0.95
                }
            })
            .on("loaded", e => map.fitBounds(e.target.getBounds()))
            .addTo(map);
        }

        // ============================================================
        // LIVE TRACKER
        // ============================================================

        if (settings.show_tracker === "TRUE" && tracker.firebase_url) {

            const santaIcon = L.icon({
                iconUrl: tracker.map_icon || "https://i.imgur.com/N1P8Q2H.png",
                iconSize: [48,48],
                iconAnchor: [24,24]
            });

            const santa = L.marker([0,0], {icon: santaIcon}).addTo(map);

            async function refreshLocation() {
                try {
                    const url = tracker.firebase_url + tracker.firebase_path + ".json?auth=" + tracker.secret;
                    const res = await fetch(url);
                    const loc = await res.json();
                    if (loc && loc.lat && loc.lng) santa.setLatLng([loc.lat, loc.lng]);
                } catch {}
            }

            refreshLocation();
            setInterval(refreshLocation, 8000);
        }

        // ============================================================
        // SPONSOR BANNER
        // ============================================================

        if (settings.show_sponsors === "TRUE" && activeRoute && activeRoute.sponsorUrl) {
            const box = document.createElement("div");
            box.style.background = "rgba(0,0,0,0.35)";
            box.style.padding = "12px";
            box.style.borderRadius = "12px";
            box.style.textAlign = "center";
            box.style.marginTop = "15px";
            box.style.border = "1px solid rgba(255,255,255,0.2)";
            box.innerHTML = `
                <div style="font-size:1.1rem;">🎁 Tonight’s Sponsor</div>
                <img src="${activeRoute.sponsorUrl}" style="width:180px;max-width:60%;border-radius:10px;margin-top:8px;">
            `;
            root.appendChild(box);
        }

        // ============================================================
        // DONATIONS THERMOMETER
        // ============================================================

        if (settings.show_donations === "TRUE" && donations.goal > 0) {
            const pct = Math.min(100, (donations.current / donations.goal) * 100);

            root.innerHTML += `
                <h3>💰 Donations</h3>
                <div style="width:100%;height:24px;background:#444;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.3);">
                    <div id="thermo" style="
                        height:100%;
                        width:0%;
                        background:${donations.color || "#d31c1c"};
                        transition: width 1.4s ease;
                    "></div>
                </div>
                <div style="text-align:center;margin-top:5px;">
                    ${donations.currency || "£"}${donations.current} raised of ${donations.currency || "£"}${donations.goal}
                </div>
            `;

            requestAnimationFrame(()=>{
                document.getElementById("thermo").style.width = pct + "%";
            });
        }

        // ============================================================
        // PHOTO CAROUSEL
        // ============================================================

        if (settings.show_carousel === "TRUE" && carousel.length > 0) {
            root.innerHTML += `<h3>📸 Santa Visits</h3>
            <div id="carousel-box" style="text-align:center;">
                <img id="carousel-img" style="max-width:90%;border-radius:12px;box-shadow:0 0 10px rgba(0,0,0,0.35);">
            </div>`;

            const img = document.getElementById("carousel-img");
            let i = 0;
            function rotate() {
                img.src = carousel[i].imgUrl;
                i = (i+1) % carousel.length;
            }
            rotate();
            setInterval(rotate, 5000);
        }

        // ============================================================
        // FULL ROUTE LIST
        // ============================================================

        root.innerHTML += `<h3 style="margin-top:30px;">📜 Full Route List</h3>`;

        routes.forEach(r=>{
            root.innerHTML += `
                <div style="background:rgba(0,0,0,0.25);padding:12px;border-radius:10px;margin-top:10px;">
                    <strong>${r.routeName}</strong><br>
                    <span>${r.date}</span><br>
                    ${r.notes ? "<em>"+r.notes+"</em><br>" : ""}
                </div>
            `;
        });

    }

    init();
})();
