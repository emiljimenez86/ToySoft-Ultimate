let deferredPrompt;
const installButton = document.getElementById('installButton');

function esPaginaMesero() {
    return (window.location.pathname || '').toLowerCase().indexOf('mesero') !== -1;
}

function claveInstalacion() {
    return esPaginaMesero() ? 'appInstalledMesero' : 'appInstalled';
}

function nombreAppInstalacion() {
    return esPaginaMesero() ? 'ToySoft Mesero' : 'ToySoft POS';
}

function appEstaInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

function esIPhone() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPod/.test(ua)) return true;
    if (/iPad/.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
}

function showInstallButton() {
    if (installButton) {
        installButton.style.display = 'block';
    }
}

function hideInstallButton() {
    if (installButton) {
        installButton.style.display = 'none';
        localStorage.setItem(claveInstalacion(), 'true');
    }
}

function asegurarAvisoIos() {
    if (document.getElementById('avisoInstalarIos')) return;

    const estilo = document.createElement('style');
    estilo.textContent = [
        '#avisoInstalarIos{display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;padding:20px;background:rgba(8,16,32,.55);}',
        '#avisoInstalarIos .aviso-ios-card{width:100%;max-width:360px;background:#fff;color:#1b2430;border-radius:28px;padding:28px 24px 22px;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:Inter,system-ui,sans-serif;}',
        '#avisoInstalarIos h2{margin:0 0 18px;color:#2563eb;font-size:1.55rem;font-weight:800;}',
        '#avisoInstalarIos ol{margin:0;padding:0 0 0 1.25rem;color:#243044;font-size:.95rem;line-height:1.45;}',
        '#avisoInstalarIos li{margin:0 0 12px;}',
        '#avisoInstalarIos li:last-child{margin-bottom:0;}',
        '#avisoInstalarIos strong{color:#111827;}',
        '#avisoInstalarIos .aviso-ios-share{display:inline-flex;align-items:center;color:#2563eb;vertical-align:middle;margin:0 2px;}',
        '#avisoInstalarIos .aviso-ios-tip{margin:18px 0 18px;padding:12px 14px;border-radius:14px;background:#e8f1ff;color:#2563eb;font-size:.9rem;font-weight:600;}',
        '#avisoInstalarIos .aviso-ios-ok{width:100%;border:0;border-radius:999px;padding:14px 18px;background:#1d4ed8;color:#fff;font-size:1.05rem;font-weight:800;cursor:pointer;}'
    ].join('');
    document.head.appendChild(estilo);

    const wrap = document.createElement('div');
    wrap.id = 'avisoInstalarIos';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-labelledby', 'avisoInstalarIosTitulo');
    wrap.innerHTML = '' +
        '<div class="aviso-ios-card">' +
            '<h2 id="avisoInstalarIosTitulo">Instalar en iPhone</h2>' +
            '<ol>' +
                '<li>Toca el botón <strong>Compartir</strong> <span class="aviso-ios-share" aria-hidden="true">' +
                    '<svg width="18" height="22" viewBox="0 0 18 22" fill="none">' +
                        '<path d="M9 13V2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
                        '<path d="M5 5.5L9 1.5L13 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
                        '<path d="M3 10.5v7A2.5 2.5 0 0 0 5.5 20h7A2.5 2.5 0 0 0 15 17.5v-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
                    '</svg>' +
                '</span> (cuadrado con flecha hacia arriba)</li>' +
                '<li>Toca <strong>Ver más</strong></li>' +
                '<li>Elige <strong>Agregar a Inicio</strong></li>' +
                '<li>Confirma con <strong>Agregar</strong></li>' +
                '<li><strong>Listo</strong> — la app queda en tu pantalla de inicio</li>' +
            '</ol>' +
            '<div class="aviso-ios-tip">Usa Safari (no Chrome ni Instagram).</div>' +
            '<button type="button" class="aviso-ios-ok" id="btnEntendidoIos">Entendido</button>' +
        '</div>';
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (evento) {
        if (evento.target === wrap) ocultarAvisoIos();
    });
    const boton = document.getElementById('btnEntendidoIos');
    if (boton) boton.addEventListener('click', ocultarAvisoIos);
}

function mostrarAvisoIos() {
    if (!esIPhone() || appEstaInstalada()) return;
    asegurarAvisoIos();
    document.getElementById('avisoInstalarIos').style.display = 'flex';
}

function ocultarAvisoIos() {
    const el = document.getElementById('avisoInstalarIos');
    if (el) el.style.display = 'none';
}

if (appEstaInstalada() || localStorage.getItem(claveInstalacion()) === 'true') {
    hideInstallButton();
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

window.addEventListener('appinstalled', (evt) => {
    console.log('App instalada exitosamente');
    hideInstallButton();
    ocultarAvisoIos();
    deferredPrompt = null;
});

async function installPWA() {
    if (esIPhone()) {
        mostrarAvisoIos();
        return;
    }
    try {
        const registration = await navigator.serviceWorker.register('./sw.js?v=26');
        console.log('ServiceWorker registrado:', registration);

        await navigator.serviceWorker.ready;
        console.log('ServiceWorker listo');

        if (deferredPrompt) {
            deferredPrompt.prompt();

            const choiceResult = await deferredPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log('Usuario aceptó la instalación');
                alert('Listo. ' + nombreAppInstalacion() + ' quedó en la pantalla de inicio.');
            } else {
                console.log('Usuario rechazó la instalación');
                showInstallInstructions();
            }

            deferredPrompt = null;
        } else {
            showInstallInstructions();
        }
    } catch (error) {
        console.error('Error durante la instalación:', error);
        showInstallInstructions();
    }
}

function showInstallInstructions() {
    if (esIPhone()) {
        mostrarAvisoIos();
        return;
    }
    const nombre = nombreAppInstalacion();
    const instructions = 'Para instalar ' + nombre + ':\n\n' +
                        '1. Abre el menú del navegador (tres puntos)\n' +
                        '2. Elige "Instalar app" o "Añadir a pantalla de inicio"\n' +
                        '3. Confirma. El acceso directo se llamará ' + nombre;
    alert(instructions);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js?v=26');
            console.log('ServiceWorker registrado:', registration);
        } catch (error) {
            console.error('Error al registrar ServiceWorker:', error);
        }
    });
}

function iniciarAvisoIos() {
    if (appEstaInstalada()) {
        hideInstallButton();
        ocultarAvisoIos();
        return;
    }
    if (esIPhone()) mostrarAvisoIos();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarAvisoIos);
} else {
    iniciarAvisoIos();
}
