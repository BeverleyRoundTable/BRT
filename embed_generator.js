// ================================
// Santa Sleigh Embed Generator
// Strict Mode – API REQUIRED
// ================================

// Read API from ?api=
const params = new URLSearchParams(window.location.search);
const api = params.get("api");

// Strict Mode → No fallback allowed
if (!api) {
    document.getElementById("apiDisplay").textContent =
        "❌ No API detected – add ?api=YOUR_SCRIPT_URL";

    // Disable all outputs so users cannot copy invalid code
    const fields = document.querySelectorAll("textarea");
    fields.forEach(f => f.value = "❌ ERROR: No API detected. Add ?api=YOUR_SCRIPT_URL");

    throw new Error("API missing – embed generator halted.");
}

document.getElementById("apiDisplay").textContent = api;

// Helper
function ensureApi() { return api; }


// ================================
// Mini Thermometer
// ================================
const miniThermo = `
<div data-santa-mini></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${ensureApi()}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`;


// ================================
// Full Thermometer
// ================================
const fullThermo = `
<div data-santa-thermo></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${ensureApi()}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`;


// ================================
// Carousel Embed
// ================================
const carouselCode = `
<iframe
src="${ensureApi()}?mode=carousel"
style="width:100%;height:450px;border:none;border-radius:12px;overflow:hidden;"
loading="lazy">
</iframe>
`;


// ================================
// ADDRESS LOOKUP — FINAL iFrame Version
// Works everywhere: Carrd, WordPress, Wix, Squarespace, etc.
// ================================
const addressLookup = `
<div style="width:100%;max-width:900px;margin:0 auto;">
<iframe
id="addressFrame"
src="https://brt-23f.pages.dev/address.html?api=${ensureApi()}"
style="width:100%;border:none;border-radius:12px;transition:height .25s ease;"
loading="lazy"
></iframe>
</div>

<script>
// Receive auto-height updates from address.html
window.addEventListener("message", (e) => {
  if (e.data.addressLookupHeight) {
    const frame = document.getElementById("addressFrame");
    if (frame) frame.style.height = e.data.addressLookupHeight + "px";
  }
});
</script>
`;


// ================================
// Tracker Embeds
// ================================
const trackerLink = `
https://brt-23f.pages.dev/santa_sleigh_tracker_dynamic?api=${ensureApi()}
`;

const recommendedTracker = `
<div style="width:90vw;max-width:1000px;margin:0 auto;padding:0 8px;">
<iframe
src="https://brt-23f.pages.dev/santa_sleigh_tracker_dynamic.html?api=${ensureApi()}"
style="width:100%;height:80vh;min-height:490px;border:none;border-radius:15px;overflow:hidden;box-shadow:0 4px 18px #0002;"
loading="lazy"
></iframe>
</div>
`;


// ================================
// Routes Embed
// ================================
const routesLink = `
https://brt-23f.pages.dev/routes.html?api=${ensureApi()}
`;

const recommendedRoutes = `
<div style="width:100%;max-width:1000px;margin:0 auto;">
<iframe
src="https://brt-23f.pages.dev/routes.html?api=${ensureApi()}"
style="width:100%;height:1200px;border:none;border-radius:15px;overflow:hidden;"
loading="lazy"
></iframe>
</div>
`;


// ================================
// GPX Animation Routes List
// ================================
async function loadRoutes() {
    try {
        const res = await fetch(ensureApi());
        const json = await res.json();

        if (!json.routes || !Array.isArray(json.routes)) {
            document.getElementById("gpxList").value = "No routes found in API.";
            return;
        }

        const output = json.routes
            .map(r =>
                `https://brt-23f.pages.dev/gpx_animation.html?api=${ensureApi()}&route=${encodeURIComponent(r.routeName)}`
            )
            .join("\\r\\n");

        document.getElementById("gpxList").value = output;

    } catch (e) {
        document.getElementById("gpxList").value = "Error reading GPX routes.";
    }
}
loadRoutes();


// ================================
// Inject into UI textareas
// ================================
document.getElementById("miniThermo").value = miniThermo.trim();
document.getElementById("fullThermo").value = fullThermo.trim();
document.getElementById("carouselCode").value = carouselCode.trim();
document.getElementById("addressLookup").value = addressLookup.trim();
document.getElementById("trackerLink").value = trackerLink.trim();
document.getElementById("recommendedTracker").value = recommendedTracker.trim();
document.getElementById("routesLink").value = routesLink.trim();
document.getElementById("recommendedRoutes").value = recommendedRoutes.trim();
