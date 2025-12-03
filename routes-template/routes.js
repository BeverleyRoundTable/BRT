// 1. Replace with YOUR Script Web App URL
const ROUTES_URL = "YOUR_WEB_APP_URL?function=getRoutes";

// 2. Viewer URL (Ben's shared GPX Viewer - do not change)
const GPX_VIEWER = "https://brt-23f.pages.dev/gpx_viewer.html?gpx=";

(async function loadRoutes() {
    try {
        const res = await fetch(ROUTES_URL);
        const data = await res.json();

        window.renderRoutes && window.renderRoutes(data.routes);
    } catch (err) {
        console.error("Failed to load routes:", err);
    }
})();
