/* Vocab Trainer — offline service worker
 * App-shell precache + runtime cache. Music is large, so it is cached
 * lazily on first play with an LRU cap instead of being precached.
 */
const VERSION = "vocab-trainer-v8";
const SHELL_CACHE = VERSION + "-shell";
const RUNTIME_CACHE = VERSION + "-runtime";
const MUSIC_CAP = 14; // max cached music tracks

const SHELL = [
  "./",
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/css/mini-player.css",
  "assets/js/app.js",
  "assets/js/vocab-data.js",
  "assets/js/vocab-extra-a1.js",
  "assets/js/vocab-extra-a2.js",
  "assets/js/vocab-extra-b1.js",
  "assets/js/vocab-extra-b2.js",
  "assets/js/vocab-extra-c1.js",
  "assets/js/vocab-extra-c2.js",
  "assets/js/vocab-extra-colloc.js",
  "assets/js/vocab-extra-colloc-b.js",
  "assets/js/vocab-extra-colloc-c1.js",
  "assets/js/vocab-extra-colloc-c2.js",
  "assets/js/vocab-th-extra.js",
  "assets/js/vocab-i18n.js",
  "assets/js/vocab-fsrs.js",
  "assets/js/vocab-csv.js",
  "assets/js/cefr.js",
  "assets/js/cefr-selector.js",
  "assets/js/placement.js",
  "assets/js/mini-player.js",
  "assets/js/auth.js",
  "assets/js/firebase-config.js",
  "assets/js/boot.js",
  "assets/img/favicon.svg",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "assets/audio/ui/button%20sound.mp3"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isMusic(url) {
  return url.pathname.indexOf("/music/") !== -1;
}

function cacheMusic(request, cache) {
  return fetch(request).then(function (res) {
    if (res && res.ok) {
      cache.put(request, res.clone());
      // Trim oldest music entries beyond the cap.
      cache.keys().then(function (keys) {
        const music = keys.filter(function (r) { return isMusic(new URL(r.url)); });
        if (music.length > MUSIC_CAP) {
          music.slice(0, music.length - MUSIC_CAP).forEach(function (r) { cache.delete(r); });
        }
      });
    }
    return res;
  });
}

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept cross-origin non-GET beyond simple passthrough.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first with offline fallback.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) { return res; }).catch(function () {
        return caches.match("offline.html").then(function (o) { return o || caches.match("index.html"); });
      })
    );
    return;
  }

  // Music: network-first, lazily cached with LRU cap.
  if (isMusic(url)) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return cacheMusic(req.clone(), cache).catch(function () { return hit; });
        });
      })
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return caches.open(RUNTIME_CACHE).then(function (cache) {
        return fetch(req).then(function (res) {
          if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        });
      });
    })
  );
});

self.addEventListener("message", function (e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", function (e) {
  const data = e.data ? e.data.json() : { title: "Vocab Trainer", body: "Time to review your vocabulary and keep your streak alive!" };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "assets/img/icon-192.png",
      badge: "assets/img/icon-192.png",
      tag: "vocab-reminder"
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow("./");
    })
  );
});
