// Minimal Service Worker to enable PWA installation
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // We just let the browser handle all network requests normally.
  // We only need this file to exist to trigger the "Add to Home Screen" prompt!
});
