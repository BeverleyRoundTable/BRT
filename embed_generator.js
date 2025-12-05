// -------------------------------
// Santa Sleigh Embed Generator
// -------------------------------

// API supplied by embed.html BEFORE this file loads
const api = window.EMBED_API || "";

// Display API or warning message
document.getElementById("apiDisplay").textContent =
  api || "❌ No API found in ?api=";

// fallback text for missing API
function ensureApi() {
    return api || "YOUR_API_HERE";
}

// -------------------------------
// Embed Snippets
// -------------------------------

// Mini thermometer
const miniThermo = `
<div data-santa-mini></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${ensureApi()}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`;

// Full thermometer
const fullThermo = `
<div data-santa-thermo></div>
<script>
const s = document.createElement('script');
s.src = 'https://brt-23f.pages.dev/donations_v2.js';
s.onload = () => { window.BRT_DONATE_API = '${ensureApi()}'; BRT_DONATE_INIT(); };
document.head.appendChild(s);
</script>
`;

// Carousel
const carouselCode = `
<iframe
src="${ensureApi()}?mode=carousel"
style="width:100%;height:450px;border:none;border-radius:12px;overflow:hidden;"
loading="lazy">
</iframe>
`;

// Address lookup
const addressLookup = `
<div id="santa-lookup"></div>
<script>
(function() {
const container = document.getElementById("santa-lookup");
const shadow = container.attachShadow({ mode: "open" });

shadow.innerHTML = String.raw\`
<style>
#lookup-wrapper { width: 50%; margin: 0 auto; min-width: 280px; }
#sleigh-search-box input {
  padding: 12px 16px; width: 100%; border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.35);
  backdrop-filter: blur(8px); color: #fff; font-size: 1rem; margin-bottom: 14px;
  background-image: url('https://i.ibb.co/LDS2tJZZ/Santa-Marker.png');
  background-size: 22px; background-repeat: no-repeat; background-position: 12px center;
  padding-left: 46px;
}
#sleigh-search-box button {
  padding: 12px 20px; background: #D31C1C; border: none; color:white;
  border-radius: 18px; cursor:pointer; font-weight:600;
}
.route-card {
  margin:1rem 0; padding:1rem; background:rgba(0,0,0,0.4);
  border-radius:15px; color:white;
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

const searchInput = shadow.querySelector("#searchInput");
const searchBtn = shadow.querySelector("#searchBtn");
const results = shadow.querySelector("#results");

let roads = [];
fetch("${ensureApi()}?function=getAddressLookup")
 .then(r => r.json())
 .then(d => roads = d);

function normalise(s){ return s.toLowerCase().replace(/[^a-z0-9]/g,""); }

function searchStreet(){
 const clean = normalise(searchInput.value);
 const matches = roads.filter(r =>
    normalise(r.street + r.suffix).includes(clean)
 );
 display(matches);
}

function display(list){
 results.innerHTML = "";
 if(list.length === 0){
   results.innerHTML = "<p>No matching streets found.</p>";
   return;
 }
 list.forEach(item => {
   results.innerHTML += \`
   <div class="route-card">
      <h3>\${item.route} – \${item.day} (\${item.date})</h3>
      <p><strong>📍 \${item.street} \${item.suffix}</strong></p>
      \${item.notes ? \`<p>📝 \${item.notes}</p>\` : ""}
   </div>\`;
 });
}

searchBtn.onclick = searchStreet;

})();
</script>
`;

// Tracker link
const trackerLink = `
https://brt-23f.pages.dev/santa_sleigh_tracker_dynamic?api=${ensureApi()}
`.trim();

// Routes link
const routesLink = `
https://brt-23f.pages.dev/routes.html?api=${ensureApi()}
`.trim();

// Inject into page
document.getElementById("miniThermo").value = miniThermo.trim();
document.getElementById("fullThermo").value = fullThermo.trim();
document.getElementById("carouselCode").value = carouselCode.trim();
document.getElementById("addressLookup").value = addressLookup.trim();
document.getElementById("trackerLink").value = trackerLink.trim();
document.getElementById("routesLink").value = routesLink.trim();
