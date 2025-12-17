const CACHE_NAME = 'estoque-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './script.js',
  './logo.png',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://unpkg.com/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});