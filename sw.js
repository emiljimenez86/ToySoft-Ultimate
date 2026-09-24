const CACHE_NAME = 'toysoft-pos-v74';
const urlsToCache = [
    './',
    './index.html',
    './POS.html',
    './admon.html',
    './mesero.html',
    './mesero.js',
    './propietario.html',
    './propietario.js',
    './cocina.html',
    './historial.html',
    './inventario.html',
    './recordatorios.html',
    './app.js',
    './admon.js',
    './firebase-init.js',
    './firebase-config.js',
    './gastos-modelo.js',
    './inventario.js',
    './cotizaciones.js',
    './seguridad.js',
    './install.js',
    './styles.css',
    './manifest.json',
    './manifest-mesero.json',
    './manifest-pos.json',
    './manifest-propietario.json',
    './image/logo-ToySoft.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

function esCodigo(request) {
    const url = new URL(request.url);
    return request.mode === 'navigate'
        || url.pathname.endsWith('.js')
        || url.pathname.endsWith('.html')
        || url.pathname.endsWith('.css');
}

function archivoDeApp(pathname) {
    var path = String(pathname || '').toLowerCase();
    if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    if (path === '/mesero' || path === '/mesero/index.html') return new URL('./mesero.html', self.registration.scope).href;
    if (path === '/propietario' || path === '/propietario/index.html') return new URL('./propietario.html', self.registration.scope).href;
    return '';
}

function servirApp(url) {
    return fetch(url).then(function (response) {
        if (response && response.status === 200) {
            var copia = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(url, copia); });
            return response;
        }
        return caches.match(url).then(function (cached) { return cached || response; });
    }).catch(function () {
        return caches.match(url).then(function (cached) {
            return cached || caches.match('./index.html');
        });
    });
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
        var mesero = '';
        try { mesero = archivoDeApp(new URL(event.request.url).pathname); } catch (e) {}
        if (mesero) {
            event.respondWith(servirApp(mesero));
            return;
        }
    }

    if (esCodigo(event.request)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const copia = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') return caches.match('./index.html');
                }))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) return response;
            return fetch(event.request.clone()).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const copia = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') return caches.match('./index.html');
            });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
