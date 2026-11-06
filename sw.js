/* NaikTaraf.AI — offline support ("service worker").
   After the first visit, the app's own files are kept on the phone so the
   chat still opens without internet. Videos and Google Forms still need
   internet.

   When online, the newest files are always fetched first, so your edits
   to content.js show up straight away. If you add a new file to the app,
   add it to the list below and change the version number. */

const CACHE_NAME = "naiktaraf-v2";
const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "content.js",
  "assets/logo.png",
  "assets/badge.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Network first, saved copy if offline. Only for this site's own files.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((saved) => saved || caches.match("index.html"))
      )
  );
});
