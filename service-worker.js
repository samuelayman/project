const CACHE_NAME = 'student-attendance-v7';

// الملفات الأساسية للعمل بدون إنترنت
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// التثبيت: خزّن الملفات الأساسية (نتجاهل أي ملف يفشل بدل ما نوقف كله)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map((u) => cache.add(u)))
    )
  );
});

// التفعيل: امسح كل الكاش القديم وسيطر على الصفحات فورًا
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

// استقبال أمر تخطّي الانتظار من الصفحة (عشان التحديث الفوري)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// الاستراتيجية:
// - طلبات Firebase/Google: تمر مباشرة للشبكة (من غير كاش)
// - ملفات التطبيق (نفس الأصل): الشبكة أولًا، والكاش احتياطي وقت عدم وجود نت
//   (ده بيضمن إن أي نسخة جديدة ترفعها تظهر فورًا)
// - المصادر الخارجية (خطوط/مكتبات): الكاش أولًا ثم الشبكة
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const href = url.href;

  if (
    href.includes('firebaseio.com') ||
    href.includes('firebaseapp.com') ||
    href.includes('identitytoolkit') ||
    href.includes('googleapis.com')
  ) {
    return; // اترك المتصفح يتعامل معها
  }

  // ملفات التطبيق — الشبكة أولًا
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // مصادر خارجية — الكاش أولًا
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached)
    )
  );
});
