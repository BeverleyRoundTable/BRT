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
            console.error("❌ TurboSanta Donations: No API provided.");
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
            .catch(err => console.error("TurboSanta Donations error:", err));
    }

    /* ---------------------------------------------------------
       INSTALL SAFE CSS (TurboSanta National Styling)
    --------------------------------------------------------- */
    function installCSS() {
    if (document.getElementById("donations-v2-style")) return;

    const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');

.ts-donations-wrapper {
    --gold: #FBAF33;
    --gold-glow: rgba(251,175,51,0.25);
    --dark: #0d0d0b;
    --surface: #161614;
    --surface-2: #1e1e1b;
    --border: rgba(255,255,255,0.08);
    --text: #eaeae5;
    --text-dim: rgba(255,255,255,0.55);
    --text-muted: rgba(255,255,255,0.3);
    --red: #D31C1C;

    font-family: 'DM Sans', sans-serif;
    color: var(--text);
    margin: 1.2rem auto;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
}

.ts-donations-wrapper * {
    box-sizing: border-box;
}

/* ---------- MINI BAR ---------- */
.ts-mini-label {
    margin-bottom: 8px;
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.ts-mini-track {
    width: 100%;
    height: 16px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
}
.ts-mini-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--red), var(--gold));
    border-radius: 6px;
    transition: width 1s ease-out;
}
.ts-mini-val {
    margin-top: 10px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 26px;
    letter-spacing: 1px;
    color: var(--text);
    line-height: 1;
}
.ts-mini-val span {
    color: var(--gold);
}

/* ---------- THERMO CARD ---------- */
.ts-thermo-card {
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    padding: 32px 24px;
    position: relative;
    overflow: hidden;
}

/* Background glow */
.ts-thermo-card::before {
    content: '';
    position: absolute;
    top: -50%;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(251,175,51,0.05) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
}

.ts-thermo-card > * {
    position: relative;
    z-index: 1;
}

.ts-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    background: rgba(251,175,51,0.12);
    color: var(--gold);
    border: 1px solid rgba(251,175,51,0.2);
    margin-bottom: 16px;
}

.ts-thermo-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 40px;
    letter-spacing: 2px;
    margin: 0 0 24px 0;
    line-height: 1;
    color: #fff;
}
.ts-thermo-title span {
    color: var(--gold);
}

.ts-thermo-layout {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
}

.ts-thermo-bar {
    width: 32px;
    height: 240px;
    border-radius: 16px;
    overflow: hidden;
    background: var(--surface-2);
    border: 2px solid var(--border);
    box-shadow: inset 0 4px 12px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.ts-thermo-fill {
    width: 100%;
    height: 0%;
    background: linear-gradient(to top, var(--red), var(--gold));
    transition: height 1.4s ease-out;
    border-radius: 12px;
    box-shadow: 0 0 14px var(--gold-glow);
}

@keyframes tsThermoPulse {
  0%   { box-shadow: 0 0 10px rgba(251, 175, 51, 0.2); }
  50%  { box-shadow: 0 0 25px rgba(251, 175, 51, 0.6); }
  100% { box-shadow: 0 0 10px rgba(251, 175, 51, 0.2); }
}

.ts-thermo-fill.pulse {
  animation: tsThermoPulse 1.2s ease-out;
}

.ts-thermo-info {
    text-align: left;
}

.ts-thermo-amount-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 56px;
    color: var(--gold);
    line-height: 1;
    letter-spacing: 1px;
    margin-bottom: 4px;
}

.ts-thermo-amount-lbl {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1px;
}

.ts-thermo-last {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 16px;
}

.ts-thermo-logo {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.04);
    padding: 4px;
    object-fit: contain;
    display: block;
    margin: 24px auto 0;
}

@media (max-width: 500px) {
    .ts-thermo-layout {
        flex-direction: column;
        text-align: center;
    }
    .ts-thermo-info {
        text-align: center;
    }
    .ts-thermo-bar {
        height: 180px;
    }
}
`;

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
            <div class="ts-donations-wrapper">
                <div class="ts-mini-label">Together we've raised</div>
                <div class="ts-mini-track">
                    <div class="ts-mini-fill" id="tsMiniFill"></div>
                </div>
                <div class="ts-mini-val" id="tsMiniVal">Loading…</div>
            </div>
        `;
    }

    /* ---------------------------------------------------------
       FULL MARKUP
    --------------------------------------------------------- */
    function injectThermo(el) {
        el.innerHTML = `
            <div class="ts-donations-wrapper">
                <div class="ts-thermo-card">
                    <div class="ts-hero-badge">🎄 Fundraiser</div>
                    <h3 class="ts-thermo-title">SANTA <span>SLEIGH</span></h3>
                    <div class="ts-thermo-layout">
                        <div class="ts-thermo-bar">
                            <div class="ts-thermo-fill" id="tsThermoFill"></div>
                        </div>
                        <div class="ts-thermo-info">
                            <div class="ts-thermo-amount-val" id="tsThermoAmountVal">—</div>
                            <div class="ts-thermo-amount-lbl" id="tsThermoAmountLbl">Raised of target</div>
                            <div class="ts-thermo-last" id="tsThermoLast"></div>
                        </div>
                    </div>
                    <img class="ts-thermo-logo" id="tsThermoLogo" src="">
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
        const mf = document.getElementById("tsMiniFill");
        const mv = document.getElementById("tsMiniVal");
        if (mf) mf.style.width = pct + "%";
        if (mv) mv.innerHTML = `<span>£${total.toLocaleString("en-GB")}</span> of £${target.toLocaleString("en-GB")}`;

        /* THERMOMETER */
        const tf    = document.getElementById("tsThermoFill");
        const taVal = document.getElementById("tsThermoAmountVal");
        const taLbl = document.getElementById("tsThermoAmountLbl");
        const tl    = document.getElementById("tsThermoLast");
        const logo  = document.getElementById("tsThermoLogo");

        if (tf) {
            tf.style.height = pct + "%";

            // subtle pulse on update
            tf.classList.remove("pulse");
            void tf.offsetWidth; // force reflow so animation can retrigger
            tf.classList.add("pulse");
        }

        if (taVal) taVal.textContent = `£${total.toLocaleString("en-GB")}`;
        if (taLbl) taLbl.textContent = `Raised of £${target.toLocaleString("en-GB")}`;

        if (tl) tl.textContent = "Last updated: " + (donations.lastUpdatePretty || "Awaiting first update");

        // dynamic logo support (Settings → logo_overlay_url)
        if (logo) {
            logo.src = donations.logo || settings.logo_overlay_url || "";
            logo.style.display = logo.src ? "block" : "none"; // Hide if no source
        }
    }

})();
