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
s.onload = () => { window.BRT_DONATE_API = '${ensureApi()}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`;

const fullThermo = `
<div data-santa-thermo></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${ensureApi()}'; BRT_DONATE_INIT(); };
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
const addressLookup = `
<div id="santa-lookup"></div>
<script>
(function() {
const container = document.getElementById("santa-lookup");
const shadow = container.attachShadow({ mode: "open" });

// Temporary default — replaced dynamically below
let lookupIcon = "https://i.ibb.co/LDS2tJZZ/Santa-Marker.png";

// Load from Settings sheet (global logos)
fetch("${ensureApi()}?function=getGlobalLogo&type=lookup")
  .then(r => r.json())
  .then(d => { if (d?.url) lookupIcon = d.url; })
  .catch(()=>{});

shadow.innerHTML = String.raw\`
<style>
#lookup-wrapper { width: 50%; margin: 0 auto; min-width: 280px; }
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
#sleigh-search-box button {
  padding:12px 20px;
  background:#D31C1C;
  border:none;
  color:white;
  border-radius:18px;
  cursor:pointer;
  font-weight:600;
}
.route-card {
  margin:1rem 0;
  padding:1rem;
  background:rgba(255,255,255,0.08);
  border-radius:15px;
  color:white;
  line-height:1.55;
}
.route-card h3 { margin:0 0 .3rem 0; }
</style>

<div id="lookup-wrapper">
 <div id="sleigh-search-box">
  <input id="searchInput" placeholder="Type your street name..." />
  <button id="searchBtn">Search</button>
 </div>
 <div id="results"></div>
</div>
\`;

let roads = [];
fetch("${ensureApi()}?function=getAddressLookup")
 .then(r => r.json())
 .then(d => roads = d);

// Apply the dynamic icon AFTER shadow loads
setTimeout(() => {
  const input = shadow.querySelector("#searchInput");
  if (input) input.style.backgroundImage = "url('" + lookupIcon + "')";
}, 200);

// --------------------------------------
// Helpers (fuzzy search + date formatting)
// --------------------------------------
function normalise(s){
  return s.toLowerCase().replace(/[^a-z0-9]/g,"");
}

// Fuzzy scoring system
function fuzzyScore(input, target) {
  if (!input || !target) return 0;
  if (target.includes(input)) return 200 + input.length;

  let score = 0;
  let pos = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const found = target.indexOf(c, pos);
    if (found >= 0) {
      score += 4;
      pos = found + 1;
    }
  }
  return score;
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date)) return "";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

const results = shadow.querySelector("#results");
const searchInput = shadow.querySelector("#searchInput");
const searchBtn = shadow.querySelector("#searchBtn");

// --------------------------------------
// SEARCH
// --------------------------------------
function searchStreet(){
  const clean = normalise(searchInput.value);
  if (!clean) return;

  const scored = roads.map(r => {
    const hay = normalise(r.street + " " + (r.suffix || ""));
    return { ...r, score: fuzzyScore(clean, hay) };
  });

  const matches = scored
    .filter(x => x.score > 3)
    .sort((a,b) => b.score - a.score);

  display(matches);
}

// --------------------------------------
// DISPLAY
// --------------------------------------
function display(list){
  results.innerHTML = "";
  if(list.length === 0){
    results.innerHTML = "<p>No matching streets found.</p>";
    return;
  }

  const now = new Date();

  // Future routes first, then past
  list.sort((a,b) => new Date(a.date) - new Date(b.date));

  list.forEach(item => {
    const niceDate = formatDate(item.date);

    results.innerHTML += \`
      <div class="route-card">
        <h3>\${item.route} – \${item.day} (\${niceDate})</h3>
        <p><strong>📍 \${item.street} \${item.suffix || ""}</strong></p>
        \${item.notes ? \`<p>📝 \${item.notes}</p>\` : ""}
      </div>
    \`;
  });
}

searchBtn.onclick = searchStreet;
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
<!-- 🎅 Santa Sleigh Tracker Embed -->
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
allowfullscreen
loading="lazy"
></iframe>
</div>
`;

const routesLink = `
https://brt-23f.pages.dev/routes.html?api=${ensureApi()}
`;

const recommendedRoutes = `
<!-- 🎅 Sleigh Routes Embed -->
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
            .join("\n");

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
