/**
 * Service Worker - عصر الهيمنة (PWA Standalone & Fullscreen Support)
 * يتيح تثبيت اللعبة كتطبيق مستقل على شاشة الجوال بدون شريط المتصفح
 */
const CACHE_NAME = "hegemony-pwa-v5.1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
