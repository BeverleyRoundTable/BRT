// -------------------------------
// Santa Sleigh Embed Generator
// -------------------------------

// Extract API from ?api=
const params = new URLSearchParams(window.location.search);
const api = params.get("api") || "";
document.getElementById("apiDisplay").textContent = api || "❌ No API found";

function ensureApi() {
    return api || "YOUR_API_HERE";
}

// -------------------------------
// Standard Embeds
// -------------------------------
const miniThermo = `
<div data-santa-mini></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => {
    window.BRT_DONATE_API = '${ensureApi()}';
    BRT_DONATE_INIT();
};
document.head.appendChild(s);
</script>
`;

const fullThermo = `
<div data-santa-thermo></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => {
    window.BRT_DONATE_API = '${ensureApi()}';
    BRT_DONATE_INIT();
};
document.head.appendChild(s);
</script>
`;

const carouselCode = `
<iframe
src="${ensureApi()}?mode=carousel"
style="width:100%;height:450px;border:none;border-radius:12px;overflow:hidden;"
loading="lazy">
</iframe>
`;

// -------------------------------
// ADDRESS LOOKUP (Dynamic Logo + Fuzzy + Nice Dates)
// -------------------------------
// -------------------------------
// ADDRESS LOOKUP (Dynamic Logo + Fuzzy + Nice Dates)
// -------------------------------
const addressLookup = `
<div id="santa-lookup"></div>
<script>
(function() {
const container = document.getElementById("santa-lookup");
const shadow = container.attachShadow({ mode: "open" });

// Defaults BEFORE API loads
let lookupIcon = "";
let overlayLogo = "";

// Fetch dynamic icon for the INPUT FIELD
fetch("${ensureApi()}?function=getGlobalLogo&type=lookup")
  .then(r => r.json())
  .then(d => { if (d?.url) lookupIcon = d.url; applyInputIcon(); })
  .catch(()=>{});

// Fetch dynamic overlay logo (top branding)
fetch("${ensureApi()}?function=getGlobalLogo&type=overlay")
  .then(r => r.json())
  .then(d => { if (d?.url) overlayLogo = d.url; applyOverlay(); })
  .catch(()=>{});

// Inject HTML
shadow.innerHTML = String.raw\`
<style>
#lookup-wrapper { width: 50%; margin: 0 auto; min-width: 280px; position:relative; }

#overlay-logo {
  display:block;
  width:140px;
  margin:0 auto 18px auto;
  opacity:0.95;
}
#overlay-logo.hidden { display:none; }

#sleigh-search-box input {
  padding: 12px 16px;
  width: 100%;
  border-radius:14px;
  border:1px solid rgba(255,255,255,0.25);
  background:rgba(0,0,0,0.35);
  backdrop-filter:blur(8px);
  color:white;
  font-size:1rem;
  margin-bottom:14px;
  background-size:22px;
  background-repeat:no-repeat;
  background-position:12px center;
  padding-left:46px;
}
</style>

<div id="lookup-wrapper">
  <img id="overlay-logo" class="hidden" />
  <div id="sleigh-search-box">
    <input id="searchInput" placeholder="Type your street name..." />
    <button id="searchBtn">Search</button>
  </div>
  <div id="results"></div>
</div>
\`;

// Load road data
let roads = [];
fetch("${ensureApi()}?function=getAddressLookup")
 .then(r => r.json())
 .then(d => roads = d);

// Apply the INPUT ICON dynamically
function applyInputIcon(){
  const input = shadow.querySelector("#searchInput");
  if (input && lookupIcon) {
    input.style.backgroundImage = "url('" + lookupIcon + "')";
  }
}

// Apply OVERLAY LOGO dynamically
function applyOverlay(){
  const el = shadow.querySelector("#overlay-logo");
  if (el && overlayLogo) {
    el.src = overlayLogo;
    el.classList.remove("hidden");
  }
}
})();
</script>
`;

// -------------------------------
// Tracker and Routes
// -------------------------------
const trackerLink = `
https://brt-23f.pages.dev/santa_sleigh_tracker_dynamic?api=${ensureApi()}
`;

const recommendedTracker = `
<div style="width:90vw;max-width:1000px;margin:0 auto;padding:0 8px;">
<iframe
src="https://brt-23f.pages.dev/santa_sleigh_tracker_dynamic.html?api=${ensureApi()}"
style="
width:100%;
height:80vh;
min-height:490px;
border:none;
border-radius:15px;
box-shadow:0 4px 18px #0002;
display:block;
margin:0 auto;
overflow:hidden;
"
loading="lazy"
></iframe>
</div>
`;

const routesLink = `
https://brt-23f.pages.dev/routes.html?api=${ensureApi()}
`;

const recommendedRoutes = `
<div style="width:100%;max-width:1000px;margin:0 auto;">
<iframe
src="https://brt-23f.pages.dev/routes.html?api=${ensureApi()}"
style="
width:100%;
height:1200px;
border:none;
border-radius:15px;
overflow:hidden;
"
loading="lazy"
></iframe>
</div>
`;

// -------------------------------
// GPX ANIMATION ROUTE LIST
// -------------------------------
async function loadRoutes() {
    try {
        const res = await fetch(ensureApi());
        const json = await res.json();

        if (!json.routes || !Array.isArray(json.routes)) {
            document.getElementById("gpxList").value = "No routes found in API.";
            return;
        }

        const output = json.routes
            .map(r => {
                const route = r.routeName;
                return `https://brt-23f.pages.dev/gpx_animation.html?api=${ensureApi()}&route=${encodeURIComponent(route)}`;
            })
            .join("\\n");

        document.getElementById("gpxList").value = output;

    } catch (e) {
        document.getElementById("gpxList").value = "Error reading GPX routes.";
    }
}
loadRoutes();

// -------------------------------
// Inject all embed outputs
// -------------------------------
document.getElementById("miniThermo").value = miniThermo.trim();
document.getElementById("fullThermo").value = fullThermo.trim();
document.getElementById("carouselCode").value = carouselCode.trim();
document.getElementById("addressLookup").value = addressLookup.trim();

document.getElementById("trackerLink").value = trackerLink.trim();
document.getElementById("recommendedTracker").value = recommendedTracker.trim();

document.getElementById("routesLink").value = routesLink.trim();
document.getElementById("recommendedRoutes").value = recommendedRoutes.trim();
