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
// ADDRESS LOOKUP (your exact working version + dynamic icon + dynamic API)
// -------------------------------
const addressLookup = `
<div id="lookup-wrapper">

<div id="sleigh-search-box" style="text-align:center;">
<input id="searchInput" placeholder="Type your street name...">
<button onclick="searchStreet()">Search</button>
</div>

<div id="results"></div>

</div>

<style>
#lookup-wrapper {
  width: 50%;
  margin: 0 auto;
  min-width: 280px;
}

/* Input styling */
#sleigh-search-box input {
  padding: 12px 16px;
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 1rem;
  margin-bottom: 14px;
  background-size: 22px;
  background-repeat: no-repeat;
  background-position: 12px center;
  padding-left: 46px;
}

/* Glow on focus */
#sleigh-search-box input:focus {
  outline: none;
  box-shadow: 0 0 14px rgba(211, 28, 28, 0.8);
  border: 1px solid rgba(255,255,255,0.4);
}

/* Button styling */
#sleigh-search-box button {
  padding: 12px 20px;
  background: #D31C1C;
  border: none;
  color: white;
  border-radius: 18px;
  cursor: pointer;
  font-weight: 600;
  box-shadow:
  0 0 8px rgba(211, 28, 28, 0.6),
  0 0 16px rgba(211, 28, 28, 0.5);
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}

#sleigh-search-box button:hover {
  transform: scale(1.04);
  box-shadow:
  0 0 14px rgba(211, 28, 28, 0.8),
  0 0 24px rgba(211, 28, 28, 0.7);
}

/* Result cards */
.route-card {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(5px);
  border-radius: 15px;
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

#results { color: white; user-select:none; }
</style>

<script>
let roads = [];

// Load lookup icon dynamically
fetch("${ensureApi()}?function=getGlobalLogo&type=lookup")
  .then(r => r.json())
  .then(d => {
    if (d?.url) {
      document.querySelector("#sleigh-search-box input").style.backgroundImage =
        "url('" + d.url + "')";
    }
  });

// Load road data dynamically
fetch("${ensureApi()}?function=getAddressLookup")
  .then(r => r.json())
  .then(data => roads = data);

// Normalisation
function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function searchStreet() {
  const input = document.getElementById("searchInput").value;
  const clean = normalise(input);

  const matches = roads.filter(r =>
    normalise(r.street + r.suffix).includes(clean)
  );

  displayResults(matches);
}

function displayResults(list) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = "<p style='color:white;'>No matching streets found.</p>";
    return;
  }

  list.forEach(item => {
    container.innerHTML += \`
<div class="route-card">
  <h3>\${item.route} – \${item.day} (\${item.date})</h3>
  <p><strong>📍 \${item.street} \${item.suffix}</strong></p>
  \${item.notes ? \`<p>📝 \${item.notes}</p>\` : ""}
</div>\`;
  });
}
</script>
`;


// -------------------------------
// Tracker + Routes
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
allowfullscreen
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
// GPX Animation Route List
// -------------------------------
async function loadRoutes() {
  try {
    const res = await fetch(ensureApi());
    const json = await res.json();

    if (!json.routes || !Array.isArray(json.routes)) {
      document.getElementById("gpxList").value = "No routes found in API.";
      return;
    }

    // FIXED NEWLINE BUG
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


// -------------------------------
// Inject all embed blocks
// -------------------------------
document.getElementById("miniThermo").value = miniThermo.trim();
document.getElementById("fullThermo").value = fullThermo.trim();
document.getElementById("carouselCode").value = carouselCode.trim();
document.getElementById("addressLookup").value = addressLookup.trim();

document.getElementById("trackerLink").value = trackerLink.trim();
document.getElementById("recommendedTracker").value = recommendedTracker.trim();

document.getElementById("routesLink").value = routesLink.trim();
document.getElementById("recommendedRoutes").value = recommendedRoutes.trim();
