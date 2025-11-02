// Service Worker for Medi-mitra Offline Functionality
const CACHE_NAME = 'medimitra-offline-v1';
const APP_SHELL_CACHE = 'medimitra-shell-v1';
const PRESCRIPTION_CACHE = 'medimitra-prescriptions-v1';

// App shell files to cache for offline access
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
  '/manifest.json',
  // Add more critical files as needed
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/prescriptions\//,
  /\/api\/patient\//,
  /\/api\/appointments\//
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(APP_SHELL_CACHE).then((cache) => {
        console.log('Caching app shell files');
        return cache.addAll(APP_SHELL_FILES.map(url => new Request(url, { credentials: 'same-origin' })));
      }).catch(err => console.log('App shell cache error:', err)),
      
      caches.open(PRESCRIPTION_CACHE).then((cache) => {
        console.log('Prescription cache ready');
        return cache;
      })
    ]).then(() => {
      self.skipWaiting();
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== APP_SHELL_CACHE && cacheName !== PRESCRIPTION_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Handle other requests (CSS, JS, images, etc.)
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(request).then((fetchResponse) => {
        // Cache successful responses
        if (fetchResponse.status === 200) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return fetchResponse;
      });
    })
  );
});

// Handle API requests with caching strategy
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache prescription and patient data
      if (shouldCacheAPIResponse(url.pathname)) {
        const cache = await caches.open(PRESCRIPTION_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
  } catch (error) {
    console.log('Network request failed, trying cache:', error);
  }
  
  // If network fails, try cache
  const cache = await caches.open(PRESCRIPTION_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Add offline indicator header
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Served-From-Cache', 'true');
    
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: headers
    });
  }
  
  // Return offline fallback
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'No cached data available',
      offline: true
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Check if API response should be cached
function shouldCacheAPIResponse(pathname) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

// Message handling for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_PRESCRIPTION') {
    const { prescriptionData, patientId } = event.data;
    cachePrescriptionData(prescriptionData, patientId);
  }
  
  if (event.data && event.data.type === 'GET_CACHED_PRESCRIPTIONS') {
    const { patientId } = event.data;
    getCachedPrescriptions(patientId).then(prescriptions => {
      event.ports[0].postMessage({ prescriptions });
    });
  }
});

// Cache prescription data manually
async function cachePrescriptionData(prescriptionData, patientId) {
  try {
    const cache = await caches.open(PRESCRIPTION_CACHE);
    const cacheKey = `/api/prescriptions/patient/${patientId}`;
    
    const response = new Response(JSON.stringify(prescriptionData), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    await cache.put(cacheKey, response);
    console.log('Prescription data cached for patient:', patientId);
  } catch (error) {
    console.error('Error caching prescription data:', error);
  }
}

// Get cached prescriptions for a patient
async function getCachedPrescriptions(patientId) {
  try {
    const cache = await caches.open(PRESCRIPTION_CACHE);
    const cacheKey = `/api/prescriptions/patient/${patientId}`;
    const response = await cache.match(cacheKey);
    
    if (response) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error getting cached prescriptions:', error);
    return null;
  }
}