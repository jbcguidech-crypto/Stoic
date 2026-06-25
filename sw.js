const CACHE = "stoicien-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Ne jamais mettre en cache les appels à l'API Anthropic.
  if (url.hostname.includes("api.anthropic.com")) return;

  if (url.origin === self.location.origin) {
    const isDoc =
      request.mode === "navigate" ||
      url.pathname.endsWith("/") ||
      url.pathname.endsWith(".html");

    // Page / navigation : RÉSEAU D'ABORD → les mises à jour s'affichent tout de suite.
    if (isDoc) {
      e.respondWith(
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          })
          .catch(() =>
            caches.match(request).then((hit) => hit || caches.match("./index.html"))
          )
      );
      return;
    }

    // Autres ressources même origine : cache d'abord, rafraîchi en arrière-plan.
    e.respondWith(
      caches.match(request).then((hit) => {
        const net = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Polices Google : cache opportuniste, repli silencieux.
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
              return res;
            })
            .catch(() => hit)
      )
    );
  }
});
