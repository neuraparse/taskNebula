// Service Worker for TaskNebula PWA
const CACHE_NAME = 'tasknebula-offline-v3';
const RUNTIME_CACHE = 'tasknebula-static-v3';

// Assets to cache on install
const PRECACHE_URLS = ['/offline', '/manifest.json'];

function isNextInternalRequest(url) {
  return url.includes('/_next/') || url.includes('/_rsc') || url.includes('?_rsc=');
}

function isStaticAsset(requestUrl) {
  const url = new URL(requestUrl);
  const pathname = url.pathname;

  if (pathname === '/sw.js') {
    return false;
  }

  return (
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    /\.(avif|gif|ico|jpeg|jpg|otf|png|svg|ttf|webp|woff|woff2)$/i.test(pathname)
  );
}

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith('tasknebula-') && name !== CACHE_NAME && name !== RUNTIME_CACHE
          )
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip _next/static and other Next.js internal requests - let browser handle them
  if (isNextInternalRequest(event.request.url)) {
    return;
  }

  // API requests - network only (don't intercept to avoid issues)
  if (event.request.url.includes('/api/')) {
    // Don't intercept API requests - let them go through normally
    return;
  }

  // Navigation requests are network-first. Do not cache the app shell:
  // stale HTML/RSC can keep old deployment action IDs alive after an update.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline').then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
    );
    return;
  }

  if (!isStaticAsset(event.request.url)) {
    return;
  }

  // Static assets are network-first so changed files at stable public paths
  // don't stay pinned behind a service-worker cache after deployment.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cachedResponse) => cachedResponse || new Response('', { status: 404 }))
      )
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'TaskNebula';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: data.url || '/',
    tag: data.tag || 'default',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-issues') {
    event.waitUntil(syncIssues());
  }
});

async function syncIssues() {
  // Implement background sync logic here
  console.log('Background sync: syncing issues');
}
