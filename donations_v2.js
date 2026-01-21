(function () {

    // --- PUBLIC INIT FUNCTION ---
    window.BRT_DONATE_INIT = function () {
        startDonationsWidget();
    };

    // --- ACTUAL START FUNCTION ---
    function startDonationsWidget() {

        // 1. Get API base URL
        let apiBase = window.BRT_DONATE_API || null;

        if (!apiBase) {
            const params = new URLSearchParams(window.location.search);
            apiBase = params.get("api");
        }

        if (!apiBase) {
            console.error("❌ Donations v2: No API provided.");
            return;
        }

        apiBase = apiBase.replace(/\?.*$/, "");
        const API_URL = apiBase;

        installCSS();

        // Inject any mini or thermo elements present
        document.querySelectorAll("[data-santa-mini]").forEach(injectMini);
        document.querySelectorAll("[data-santa-thermo]").forEach(injectThermo);

        // Fetch and update UI
        fetch(API_URL)
            .then(r => r.json())
            .then(updateUI)
            .catch(err => console.error("Donations v2 error:", err));
    }

    /* ---------------------------------------------------------
       INSTALL SAFE CSS (Leaflet / Carrd compatible)
    --------------------------------------------------------- */
    function installCSS() {
        if (document.getElementById("donations-v2-style")) return;

        const css = `
        .santa-mini-wrapper,
        .santa-thermo-wrapper {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial;
            color: white;
            margin: 1.2rem auto;
            max-width: 420px;
            width: 100%;
            text-align: center;
        }

        .santa-mini-track {
            width: 100%;
            height: 14px;
            background: rgba(255,255,255,0.2);
            border-radius: 8px;
            overflow: hidden;
        }
        .santa-mini-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #d31c1c, #7f0f0f);
            border-radius: 8px;
            transition: width 1s ease-out;
        }
        .santa-mini-label {
            margin-bottom: 0.25rem;
            opacity: 0.9;
            font-size: 0.9rem;
        }
        .santa-mini-val {
            margin-top: 0.5rem;
            font-weight: 600;
            font-size: 1rem;
        }

        .santa-thermo-card {
    background: rgba(18,19,23,0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 16px;
    box-shadow:
      0 6px 20px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.05);
}
        }
        .santa-thermo-title {
            font-size: 1rem;
            font-weight: 600;
            text-align: center;
            margin-bottom: 1rem;
        }
        .santa-thermo-layout {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1.5rem;
        }
        .santa-thermo-bar {
            width: 26px;
            height: 260px;
            border-radius: 999px;
            overflow: hidden;
            background: #222;
            border: 3px solid #ffd700;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
        }
        .santa-thermo-fill {
            width: 100%;
            height: 0%;
            background: linear-gradient(#d31c1c, #7f0f0f);
            transition: height 1.4s ease-out;
        }
        .santa-thermo-info {
            font-size: 0.85rem;
            line-height: 1.4;
            width: 140px;
            color: white;
        }
        .santa-thermo-info strong {
            font-size: 1rem;
        }
        .santa-thermo-logo {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: 2px solid white;
            object-fit: cover;
            display: block;
            margin: 1rem auto 0;
        }
        @media(max-width: 500px){
            .santa-thermo-layout{
                flex-direction: column;
            }
        }`;

        const style = document.createElement("style");
        style.id = "donations-v2-style";
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ---------------------------------------------------------
       MINI MARKUP
    --------------------------------------------------------- */
    function injectMini(el) {
        el.innerHTML = `
            <div class="santa-mini-wrapper">
                <div class="santa-mini-label">Together we’ve raised:</div>
                <div class="santa-mini-track">
                    <div class="santa-mini-fill" id="miniFill"></div>
                </div>
                <div class="santa-mini-val" id="miniVal">Loading…</div>
            </div>
        `;
    }

    /* ---------------------------------------------------------
       FULL MARKUP
    --------------------------------------------------------- */
    function injectThermo(el) {
        el.innerHTML = `
            <div class="santa-thermo-wrapper">
                <div class="santa-thermo-card">
                    <h3 class="santa-thermo-title">Santa Sleigh Fundraiser</h3>
                    <div class="santa-thermo-layout">
                        <div class="santa-thermo-bar">
                            <div class="santa-thermo-fill" id="thermoFill"></div>
                        </div>
                        <div class="santa-thermo-info">
                            <div id="thermoAmount"><strong>Loading…</strong></div>
                            <div id="thermoLast" style="opacity:0.8;"></div>
                        </div>
                    </div>
                    <img class="santa-thermo-logo" id="thermoLogo" src="">
                </div>
            </div>
        `;
    }

    /* ---------------------------------------------------------
       UPDATE UI
    --------------------------------------------------------- */
    function updateUI(fullData) {
        const donations = fullData.donations || {};
        const settings = fullData.settings || {};

        const total  = Number(donations.total  || 0);
        const target = Number(donations.target || 0);
        const pct    = target > 0 ? Math.min(100, (total / target) * 100) : 0;

        /* MINI BAR */
        const mf = document.getElementById("miniFill");
        const mv = document.getElementById("miniVal");
        if (mf) mf.style.width = pct + "%";
        if (mv) mv.textContent =
            `£${total.toLocaleString("en-GB")} of £${target.toLocaleString("en-GB")}`;

        /* THERMOMETER */
        const tf = document.getElementById("thermoFill");
        const ta = document.getElementById("thermoAmount");
        const tl = document.getElementById("thermoLast");
        const logo = document.getElementById("thermoLogo");

        if (tf) tf.style.height = pct + "%";
        if (ta) ta.innerHTML =
            `<strong>£${total.toLocaleString("en-GB")}</strong> raised of £${target.toLocaleString("en-GB")}`;

        if (tl) tl.textContent =
            "Last updated: " + (donations.lastUpdatePretty || "Awaiting first update");

        // dynamic logo support (Settings → logo_overlay_url)
        if (logo) {
            logo.src = donations.logo || settings.logo_overlay_url || "";
        }
    }

})();
