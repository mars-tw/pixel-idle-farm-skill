const CACHE_VERSION = "r72-20260719-1";
const CACHE_PREFIX = "pixel-farm-rpg-";
const HTML_CACHE = CACHE_PREFIX + CACHE_VERSION + "-html";
const STATIC_CACHE = CACHE_PREFIX + CACHE_VERSION + "-static";
const VERSION_QUERY = "?v=" + CACHE_VERSION;
const OFFLINE_URL = versioned("./offline.html");
const CORE_ASSETS = [
  "./",
  versioned("./index.html"),
  OFFLINE_URL,
  versioned("./manifest.webmanifest"),
  versioned("./assets/manifest.json"),
  versioned("./src/config.js"),
  versioned("./src/game.js"),
  versioned("./src/state.js"),
  versioned("./src/atlas.js"),
  versioned("./src/ui.js"),
  versioned("./assets/generated/crop-growth.png"),
  versioned("./assets/generated/terrain-tileset.png"),
  versioned("./assets/generated/ui-icons.png"),
  versioned("./assets/generated/r66/manifest.json"),
  versioned("./assets/generated/r66/ui-icons-32.json"),
  versioned("./assets/generated/r66/ui-icons-32.png"),
  versioned("./assets/generated/r66/native/assistant_idle-64.png"),
  versioned("./assets/generated/r66/native/assistant_tip-64.png"),
  versioned("./assets/generated/r66/native/assistant_alert-64.png"),
  "./assets/generated/r68/manifest.json?v=2a95c231",
  "./assets/generated/r68/loading-spring-low.png?v=7b001bb9",
  "./assets/generated/r68/loading-spring-med.png?v=1ff5a60e",
  "./assets/generated/r68/loading-spring-high.png?v=8c6373c4",
  "./assets/generated/r68/loading-summer-low.png?v=dd952edd",
  "./assets/generated/r68/loading-summer-med.png?v=0c46dfa1",
  "./assets/generated/r68/loading-summer-high.png?v=e226121d",
  "./assets/generated/r68/loading-autumn-low.png?v=bae800a8",
  "./assets/generated/r68/loading-autumn-med.png?v=961675fc",
  "./assets/generated/r68/loading-autumn-high.png?v=56d75371",
  "./assets/generated/r68/loading-winter-low.png?v=c557e0d0",
  "./assets/generated/r68/loading-winter-med.png?v=8b5c0616",
  "./assets/generated/r68/loading-winter-high.png?v=ee1876fe",
  "./assets/generated/r68/activity-panel-low.png?v=efe3dacd",
  "./assets/generated/r68/activity-panel-med.png?v=e100dd7f",
  "./assets/generated/r68/activity-panel-high.png?v=c772fbfc",
  versioned("./assets/generated/farm-actors-buildings.png"),
  versioned("./assets/generated/characters/miri-rowan-turnaround.png"),
  versioned("./assets/generated/characters/miri-rowan-farm-actions.png"),
  versioned("./assets/generated/characters/miri-rowan-farm-actions-cutout.png"),
  versioned("./assets/generated/characters/miri-rowan-walk-cycle.png"),
  versioned("./assets/generated/characters/miri-rowan-walk-cycle-cutout.png"),
  versioned("./assets/generated/v4/manifest.json"),
  versioned("./assets/generated/v4/animal-care-props-64.json"),
  versioned("./assets/generated/v4/animal-care-props-64.png"),
  versioned("./assets/generated/v4/animal-care-vfx-32.json"),
  versioned("./assets/generated/v4/animal-care-vfx-32.png"),
  versioned("./assets/generated/v4/animal-products-quality-32.json"),
  versioned("./assets/generated/v4/animal-products-quality-32.png"),
  versioned("./assets/generated/v4/animal-status-icons-32.json"),
  versioned("./assets/generated/v4/animal-status-icons-32.png"),
  versioned("./assets/generated/v4/animals-48.json"),
  versioned("./assets/generated/v4/animals-48.png"),
  versioned("./assets/generated/v4/animals-care-48.json"),
  versioned("./assets/generated/v4/animals-care-48.png"),
  versioned("./assets/generated/v4/animals-duck-48.json"),
  versioned("./assets/generated/v4/animals-duck-48.png"),
  versioned("./assets/generated/v4/buildings.json"),
  versioned("./assets/generated/v4/buildings.png"),
  versioned("./assets/generated/v4/crops-48.json"),
  versioned("./assets/generated/v4/crops-48.png"),
  versioned("./assets/generated/v4/crops2-48.json"),
  versioned("./assets/generated/v4/crops2-48.png"),
  versioned("./assets/generated/v4/crops3-48.json"),
  versioned("./assets/generated/v4/crops3-48.png"),
  versioned("./assets/generated/v4/crops4-48.json"),
  versioned("./assets/generated/v4/crops4-48.png"),
  versioned("./assets/generated/v4/duck-egg-quality-32.json"),
  versioned("./assets/generated/v4/duck-egg-quality-32.png"),
  versioned("./assets/generated/v4/max-actions-48x64.json"),
  versioned("./assets/generated/v4/max-actions-48x64.png"),
  versioned("./assets/generated/v4/max-walk-48x64.json"),
  versioned("./assets/generated/v4/max-walk-48x64.png"),
  versioned("./assets/generated/v4/miri-actions-48x64.json"),
  versioned("./assets/generated/v4/miri-actions-48x64.png"),
  versioned("./assets/generated/v4/miri-walk-48x64.json"),
  versioned("./assets/generated/v4/miri-walk-48x64.png"),
  versioned("./assets/generated/v4/npcs-48x64.json"),
  versioned("./assets/generated/v4/npcs-48x64.png"),
  versioned("./assets/generated/v4/structures-nature.json"),
  versioned("./assets/generated/v4/structures-nature.png"),
  versioned("./assets/generated/v4/terrain-organic-32.json"),
  versioned("./assets/generated/v4/terrain-organic-32.png"),
  versioned("./assets/generated/v3/action-vfx-32.json"),
  versioned("./assets/generated/v3/action-vfx-32.png"),
  versioned("./assets/generated/v3/props-stations.json"),
  versioned("./assets/generated/v3/props-stations.png"),
  versioned("./assets/icons/icon-192.png"),
  versioned("./assets/icons/icon-512.png")
];

function versioned(url) {
  return url + VERSION_QUERY;
}

function isHtmlRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

async function networkFirst(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      if (request.mode === "navigate") cache.put(versioned("./index.html"), response.clone());
    }
    return response;
  } catch (e) {
    return (await cache.match(request, { ignoreSearch: false })) ||
      (await cache.match(versioned("./index.html"), { ignoreSearch: false })) ||
      (await cache.match("./index.html", { ignoreSearch: false })) ||
      (await caches.match(OFFLINE_URL, { ignoreSearch: false })) ||
      Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && !key.includes(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(isHtmlRequest(request) ? networkFirst(request) : cacheFirst(request));
});
