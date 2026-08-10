/* Porchlight service worker.
 *
 * Conservative on purpose. The app is entirely session-scoped: every HTML/RSC
 * response is rendered for one signed-in neighbor, and /api/ reads are live
 * neighborhood data. Serving either from a cache would be a real bug — a stale
 * feed at best, another household's page at worst. So the only things that ever
 * land in a cache here are immutable, public static assets and the offline
 * fallback page.
 *
 * Bump VERSION whenever the shell asset list or the strategies change; the
 * activate handler drops every cache that isn't in CURRENT_CACHES.
 */

const VERSION = "v1";
const SHELL_CACHE = `porchlight-shell-${VERSION}`;
const ASSET_CACHE = `porchlight-assets-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE];

/** Precached at install so the offline screen works on the very first drop. */
const SHELL_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_PATHS = ["/manifest.webmanifest", "/offline.html", "/favicon.ico"];
const STATIC_EXTENSION =
  /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One at a time: a single 404 shouldn't fail the whole installation and
      // leave the app with no worker at all.
      await Promise.all(
        SHELL_ASSETS.map((asset) =>
          cache.add(new Request(asset, { cache: "reload" })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("porchlight-") && !CURRENT_CACHES.includes(name)
          )
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only plain same-origin GETs are ours; everything else falls through to the
  // browser untouched (including every mutation and server action).
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(apiNetworkFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(documentNetworkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(assetCacheFirst(request));
    return;
  }

  // Anything left is an authenticated payload — RSC flight requests, prefetches,
  // route handlers outside /api/. Let the network handle it, cache nothing.
});

function isStaticAsset(url) {
  // A query string means it is parameterised (`?_rsc=…`, cache-busting, image
  // optimisation) and therefore not the immutable asset it looks like.
  if (url.search) return false;
  if (STATIC_PATHS.includes(url.pathname)) return true;
  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }
  return STATIC_EXTENSION.test(url.pathname);
}

/** Nothing personal or session-varying is allowed into a cache. */
function isCacheable(response) {
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== "basic") return false;

  const control = (response.headers.get("cache-control") || "").toLowerCase();
  if (control.includes("no-store") || control.includes("private")) return false;

  const vary = (response.headers.get("vary") || "").toLowerCase();
  if (vary.includes("cookie") || vary.includes("authorization")) return false;
  if (response.headers.has("set-cookie")) return false;

  return true;
}

/**
 * Network-first for the API, with no cache tier behind it by design: a cached
 * neighborhood read is worse than an honest failure, so an offline request gets
 * a 503 the client can surface instead of yesterday's data.
 */
async function apiNetworkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ error: "You're offline. Try again in a moment." }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

/**
 * Network-first for page loads. The response is never cached — it is rendered
 * for one signed-in session — so the only fallback is the static offline page.
 */
async function documentNetworkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match("/offline.html");
    return (
      offline ||
      new Response("You're offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      })
    );
  }
}

/** Cache-first for hashed/immutable static assets. */
async function assetCacheFirst(request) {
  const shell = await caches.open(SHELL_CACHE);
  const precached = await shell.match(request, { ignoreSearch: true });
  if (precached) return precached;

  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      // clone() before the body is consumed by the page.
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}
