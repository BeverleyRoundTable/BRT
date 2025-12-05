/* -----------------------------------------------------------
   Santa Sleigh — Universal Embed Generator
   Users paste their API URL below. Everything else builds
   automatically. No Google Sheets needed.
------------------------------------------------------------ */

const API = "PASTE_YOUR_API_URL_HERE";  
// Example:
// const API = "https://script.google.com/macros/s/AKfycb.../exec";

// -----------------------------------------------------------
// BUILDERS
// -----------------------------------------------------------

// Mini Thermometer
function buildMiniThermo() {
  return `
<div data-santa-mini></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${API}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`.trim();
}

// Full Thermometer
function buildFullThermo() {
  return `
<div data-santa-thermo></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${API}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`.trim();
}

// Carousel
function buildCarousel() {
  return `
<iframe
  src="${API}?mode=carousel"
  style="width:100%;height:450px;border:none;border-radius:12px;overflow:hidden;"
  loading="lazy">
</iframe>
`.trim();
}

// Tracker + Routes Links
function buildTrackerURL() {
  return `https://brt-23f.pages.dev/santa_sleigh_tracker_dynamic?api=${API}`;
}

function buildRoutesURL() {
  return `https://brt-23f.pages.dev/routes.html?api=${API}`;
}

// Address Lookup (Shadow DOM, safe version)
function buildAddressLookup() {
  return `
<div id="santa-lookup"></div>
<script>
(function() {
const container = document.getElementById("santa-lookup");
const shadow = container.attachShadow({ mode: "open" });

shadow.innerHTML = \`
<style>
#lookup-wrapper { width: 50%; margin: 0 auto; min-width: 280px; }
#sleigh-search-box input {
  padding: 12px 16px; width: 100%; border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.35); backdrop-filter: blur(8px);
  color: #fff; font-size: 1rem; margin-bottom: 14px;
  background-image: url('https://i.ibb.co/LDS2tJZZ/Santa-Marker.png');
  background-size: 22px; background-repeat: no-repeat;
  background-position: 12px center; padding-left: 46px;
}
#sleigh-search-box button {
  padding: 12px 20px; background: #D31C1C; border: none;
  color: white; border-radius: 18px; cursor: pointer;
  font-weight: 600;
}
.route-card {
  margin: 1rem 0; padding: 1rem;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(5px);
  border-radius: 15px; color: white;
}
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
fetch("${API}?function=getAddressLookup")
  .then(r => r.json())
  .then(data => roads = data);

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function searchStreet() {
  const clean = normalise(shadow.querySelector("#searchInput").value);
  const matches = roads.filter(r => 
    normalise(r.street + r.suffix).includes(clean)
  );
  display(matches);
}

function display(list) {
  const out = shadow.querySelector("#results");
  out.innerHTML = "";
  if (list.length === 0) {
    out.innerHTML = "<p>No matching streets found.</p>";
    return;
  }
  list.forEach(item => {
    out.innerHTML += \`
      <div class="route-card">
        <h3>\${item.route} – \${item.day} (\${item.date})</h3>
        <p><strong>📍 \${item.street} \${item.suffix}</strong></p>
        \${item.notes ? "<p>📝 " + item.notes + "</p>" : ""}
      </div>
    \`;
  });
}

shadow.querySelector("#searchBtn").onclick = searchStreet;

})();
</script>
`.trim();
}

// -----------------------------------------------------------
// OUTPUT EVERYTHING
// -----------------------------------------------------------
console.log("===== MINI THERMOMETER EMBED =====\n", buildMiniThermo(), "\n");
console.log("===== FULL THERMOMETER EMBED =====\n", buildFullThermo(), "\n");
console.log("===== CAROUSEL EMBED =====\n", buildCarousel(), "\n");
console.log("===== ADDRESS LOOKUP EMBED =====\n", buildAddressLookup(), "\n");
console.log("===== TRACKER URL =====\n", buildTrackerURL(), "\n");
console.log("===== ROUTES URL =====\n", buildRoutesURL(), "\n");

console.log("\n🎄 All embed codes generated successfully!");
