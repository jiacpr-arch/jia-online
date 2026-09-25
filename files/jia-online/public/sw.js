// Service worker ของ cpr.morroo.com — เป้าหมายหลัก: คู่มือ CPR ฉุกเฉิน (/emergency.html) เปิดได้แม้ไม่มีเน็ต
// กลยุทธ์ (ระวังไม่ให้ผู้เรียนติดเวอร์ชันเก่า):
//   - หน้าเว็บ (navigate): network-first เสมอ → ออฟไลน์ค่อยใช้หน้าที่เคยโหลดไว้ ไม่มีก็ส่งคู่มือฉุกเฉิน
//   - /assets/* (ไฟล์ build มี hash ในชื่อ ไม่เปลี่ยนเนื้อหา): cache-first
//   - อื่น ๆ (API Supabase/Stripe/analytics, โดเมนอื่น): ไม่แตะเลย
// เปลี่ยน VERSION เมื่อแก้ไฟล์นี้/รายการ precache เพื่อล้าง cache เก่า
const VERSION = "v1";
const STATIC = `jia-static-${VERSION}`;
const PAGES = `jia-pages-${VERSION}`;
const PRECACHE = ["/emergency.html", "/manifest.webmanifest", "/logo.png", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("jia-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // เก็บเฉพาะหน้าที่โหลดสำเร็จ (ไม่เก็บหน้าแอดมิน/พอร์ทัล HR ที่มีข้อมูลลับ)
          if (res.ok && !/^\/(admin|org)\b/.test(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname === "/emergency.html" ? "/emergency.html" : "/", copy));
          }
          return res;
        })
        .catch(async () => {
          if (url.pathname === "/emergency.html") return (await caches.match("/emergency.html")) || Response.error();
          return (await caches.match("/", { cacheName: PAGES })) || (await caches.match("/emergency.html")) || Response.error();
        })
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.png") {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
