const CACHE_NAME = 'sleigh-shell-v2';
const STATIC_ASSETS = [
    'https://raw.githubusercontent.com/BeverleyRoundTable/BRT/main/icons/site_background.png',
    'https://raw.githubusercontent.com/BeverleyRoundTable/BRT/main/icons/RTBI_Santa.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install: Pre-cache core visual assets and force the new worker to take over
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: Clean up the old dummy caches and claim the clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Serve from cache or network to keep the PWA working offline
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Cache-First Strategy for Fonts and Static Images
    if (
        url.hostname.includes('fonts.googleapis.com') || 
        url.hostname.includes('fonts.gstatic.com') || 
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('raw.githubusercontent.com')
    ) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // 2. Network-First Strategy for HTML and Cloudflare API config
    if (event.request.method === 'GET') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Only cache successful responses
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(async () => {
                    // If network fails (offline), serve the cached version seamlessly
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) return cachedResponse;
                })
        );
    }
});
