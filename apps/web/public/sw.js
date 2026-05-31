// Service Worker for TaskNebula PWA
const CACHE_NAME = 'tasknebula-v2';
const RUNTIME_CACHE = 'tasknebula-runtime';

// Assets to cache on install
const PRECACHE_URLS = ['/', '/offline', '/manifest.json'];

function shouldHandleNavigation(requestUrl) {
  const pathname = new URL(requestUrl).pathname;
  return pathname === '/' || pathname === '/offline';
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
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip _next/static and other Next.js internal requests - let browser handle them
  if (
    event.request.url.includes('/_next/') ||
    event.request.url.includes('/_rsc') ||
    event.request.url.includes('?_rsc=')
  ) {
    return;
  }

  // API requests - network only (don't intercept to avoid issues)
  if (event.request.url.includes('/api/')) {
    // Don't intercept API requests - let them go through normally
    return;
  }

  // Only cache navigation requests for offline support
  if (event.request.mode === 'navigate') {
    if (!shouldHandleNavigation(event.request.url)) {
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache or offline page
          return caches
            .match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return caches.match('/offline');
            })
            .then((response) => {
              // If still no response, return a basic offline response
              return (
                response ||
                new Response('Offline', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' },
                })
              );
            });
        })
    );
    return;
  }

  // For other requests (images, fonts, etc.) - cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }

          // Only cache same-origin basic responses
          if (response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return response;
        })
        .catch(() => {
          // Return nothing if fetch fails for static assets
          return new Response('', { status: 404 });
        });
    })
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
