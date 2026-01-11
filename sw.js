// Moles World - Service Worker
// Version: 2.0
// Caches: moles-world-v2

const CACHE_NAME = 'moles-world-v2';
const DYNAMIC_CACHE = 'moles-world-dynamic-v1';
const IMAGE_CACHE = 'moles-world-images-v1';

// Resources to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/styles.css',
  '/app.js',
  // External resources
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto+Slab:wght@400;500;600&display=swap'
];

// Mole images for offline use
const MOLE_IMAGES = [
  'https://images.unsplash.com/photo-1552053831-71594a27632d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1548681527-8b5f2c16f83d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1559253664-ca249d4608c6?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ========== INSTALL EVENT ==========
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event');
  
  event.waitUntil(
    Promise.all([
      // Cache core files
      caches.open(CACHE_NAME)
        .then(cache => {
          console.log('[Service Worker] Caching app shell');
          return cache.addAll(PRECACHE_URLS);
        }),
      
      // Cache mole images
      caches.open(IMAGE_CACHE)
        .then(cache => {
          console.log('[Service Worker] Caching mole images');
          return Promise.all(
            MOLE_IMAGES.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                })
                .catch(err => {
                  console.log(`Failed to cache ${url}:`, err);
                });
            })
          );
        }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients immediately
      self.clients.claim()
    ])
  );
});

// ========== FETCH EVENT ==========
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (!url.origin.startsWith(self.location.origin) && 
      !url.href.includes('unsplash.com') &&
      !url.href.includes('fonts.googleapis.com') &&
      !url.href.includes('cdnjs.cloudflare.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
          return cachedResponse;
        }
        
        // For navigation requests, return cached page or fetch
        if (event.request.mode === 'navigate') {
          return fetch(event.request)
            .catch(() => {
              return caches.match('/offline.html');
            });
        }
        
        // For image requests
        if (event.request.destination === 'image') {
          return caches.match(event.request)
            .then(cachedImage => {
              if (cachedImage) return cachedImage;
              
              return fetch(event.request)
                .then(networkResponse => {
                  // Cache the new image
                  return caches.open(IMAGE_CACHE)
                    .then(cache => {
                      cache.put(event.request, networkResponse.clone());
                      return networkResponse;
                    });
                })
                .catch(() => {
                  // Return a placeholder if fetch fails
                  return caches.match('/icons/icon-192x192.png');
                });
            });
        }
        
        // For other requests, try network first
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // If offline and request is for an HTML page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
            // Return offline image for image requests
            if (event.request.destination === 'image') {
              return caches.match('/icons/icon-192x192.png');
            }
          });
      })
  );
});

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-mole-data') {
    event.waitUntil(syncMoleData());
  }
  
  if (event.tag === 'send-notifications') {
    event.waitUntil(sendScheduledNotifications());
  }
});

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received');
  
  let notificationData = {
    title: 'Moles World',
    body: 'New mole fact available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'mole-update',
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // Check if push event has data
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ========== PERIODIC SYNC ==========
self.addEventListener('periodicsync', event => {
  console.log('[Service Worker] Periodic sync:', event.tag);
  
  if (event.tag === 'update-mole-content') {
    event.waitUntil(updateMoleContent());
  }
});

// ========== HELPER FUNCTIONS ==========

// Sync mole data in background
async function syncMoleData() {
  console.log('[Service Worker] Syncing mole data');
  
  try {
    // In a real app, you would fetch updated data from your server
    const response = await fetch('/api/mole-data.json');
    const data = await response.json();
    
    // Store in IndexedDB or cache
    await updateCachedData(data);
    
    // Show notification about new data
    await self.registration.showNotification('Moles World Updated', {
      body: 'New mole facts and images available!',
      icon: '/icons/icon-192x192.png',
      tag: 'data-update'
    });
    
    return true;
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    return false;
  }
}

// Send scheduled notifications
async function sendScheduledNotifications() {
  console.log('[Service Worker] Sending scheduled notifications');
  
  const moleFacts = [
    "Moles can dig tunnels at 18 feet per hour!",
    "Did you know? Mole fur lies flat in any direction.",
    "Moles consume 70-100% of their body weight daily.",
    "Star-nosed moles have 22 tentacles on their nose!",
    "Moles have special hemoglobin for low-oxygen tunnels.",
    "Mole tunnels help aerate soil and improve drainage.",
    "Moles are solitary except during mating season.",
    "Mole saliva paralyzes worms for later consumption.",
    "Moles can run through tunnels at 80 feet per minute.",
    "European moles detect vibrations through their snouts.",
    "Moles don't hibernate - they're active year-round.",
    "Mole tunnel systems can cover up to 2.7 acres!",
    "Moles have the highest muscle mass of any mammal.",
    "Some mole species are excellent swimmers.",
    "Moles live 3-6 years in the wild.",
    "Mole hills are created from excavated soil.",
    "Moles play a key role in soil ecology.",
    "Moles have tiny eyes but aren't completely blind.",
    "A mole's front paws rotate for efficient digging.",
    "Moles help control insect populations in gardens."
  ];
  
  const randomFact = moleFacts[Math.floor(Math.random() * moleFacts.length)];
  
  return self.registration.showNotification('Mole Fact of the Day', {
    body: randomFact,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'daily-fact',
    actions: [
      { action: 'learn-more', title: 'Learn More' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: '/',
      fact: randomFact
    }
  });
}

// Update mole content periodically
async function updateMoleContent() {
  console.log('[Service Worker] Updating mole content');
  
  try {
    // Fetch latest images
    const imageResponse = await fetch('https://api.unsplash.com/search/photos?query=mole&per_page=5&client_id=YOUR_UNSPLASH_ACCESS_KEY');
    const imageData = await imageResponse.json();
    
    // Cache new images
    const imageCache = await caches.open(IMAGE_CACHE);
    await Promise.all(
      imageData.results.slice(0, 3).map(photo => {
        return fetch(photo.urls.small)
          .then(response => imageCache.put(photo.urls.small, response));
      })
    );
    
    return true;
  } catch (error) {
    console.error('[Service Worker] Content update failed:', error);
    return false;
  }
}

// Update cached data
async function updateCachedData(data) {
  // In a real app, you would update IndexedDB
  console.log('[Service Worker] Updating cached data:', data);
  return Promise.resolve();
}

// ========== MESSAGE HANDLING ==========
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    caches.keys().then(cacheNames => {
      Promise.all(
        cacheNames.map(cacheName => {
          return caches.open(cacheName)
            .then(cache => cache.keys())
            .then(requests => requests.length);
        })
      ).then(sizes => {
        event.ports[0].postMessage({
          type: 'CACHE_SIZES',
          sizes: sizes.reduce((a, b) => a + b, 0)
        });
      });
    });
  }
});
