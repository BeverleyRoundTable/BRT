function startAddressLookup() {

    /* ===== Detect API from URL ===== */
    const params = new URLSearchParams(window.location.search);
    const apiBase = params.get("api");

    if (!apiBase) {
        console.error("❌ No API provided. Use ?api=YOUR_SCRIPT_URL");
        return;
    }

    const LOOKUP_URL = apiBase + "?function=getAddressLookup";
    const LOGO_URL   = apiBase + "?function=getGlobalLogo&type=lookup";

    let roads = [];

    /* ===== Load input icon ===== */
    fetch(LOGO_URL)
        .then(r => r.json())
        .then(d => {
            if (d?.url) {
                document.querySelector("#sleigh-search-box input").style.backgroundImage =
                    `url('${d.url}')`;
            }
        });

    /* ===== Load road data ===== */
    fetch(LOOKUP_URL)
        .then(r => r.json())
        .then(data => roads = data);

    /* ===== Helpers ===== */
    function normalise(str) {
        return str.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    /* ===== Search ===== */
    window.searchStreet = function () {
        const input = document.getElementById("searchInput").value.trim();
        const clean = normalise(input);

        const matches = roads.filter(r =>
            normalise(r.street).includes(clean)
        );

        renderResults(matches);
    };

    /* ===== Render Results ===== */
    function renderResults(list) {
        const container = document.getElementById("results");
        container.innerHTML = "";

        if (!list.length) {
            container.innerHTML = `<p style="color:white;text-align:center;">
                No matching streets found.
            </p>`;
            return;
        }

        container.innerHTML = list.map(item => `
            <div class="route-card">
                <h3>${item.route}</h3>
                <p>📅 ${item.day} — ${formatNiceDate(item.date)}</p>
                <p><strong>📍 ${item.street}</strong></p>
            </div>
        `).join("");
    }

    /* ===== Format to match routes UI ===== */
    function formatNiceDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    }
}

/* Run after page loads */
setTimeout(startAddressLookup, 100);
