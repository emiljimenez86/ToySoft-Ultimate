function mostrarLoginMensaje(texto, tipo) {
    const el = document.getElementById('loginMensaje');
    if (!el) {
        if (texto) alert(texto);
        return;
    }
    if (!texto) {
        el.style.display = 'none';
        el.textContent = '';
        return;
    }
    el.style.display = 'block';
    el.textContent = texto;
    el.className = 'alert py-2 px-3 small mb-2 ' + (tipo === 'ok' ? 'alert-success' : 'alert-danger');
}

function loginFormularioValores() {
    const email = (document.getElementById('usuario') && document.getElementById('usuario').value || '').trim();
    const clave = (document.getElementById('clave') && document.getElementById('clave').value) || '';
    const codigo = (document.getElementById('codigoEquipo') && document.getElementById('codigoEquipo').value || '').trim();
    const nombre = (document.getElementById('nombreMeseroLogin') && document.getElementById('nombreMeseroLogin').value || '').trim();
    return { email: email, clave: clave, codigo: codigo, nombre: nombre };
}

function paginaEsMesero() {
    const ruta = (window.location.pathname || '').toLowerCase();
    return ruta.indexOf('mesero') !== -1;
}

function destinoMesero() {
    const host = String((window.location && window.location.hostname) || '');
    if (/toysoft\.co$/i.test(host)) return '/mesero/';
    return 'mesero/';
}

function paginaEsPos() {
    const ruta = (window.location.pathname || '').toLowerCase();
    return /\/pos(\.html)?\/?$/.test(ruta) || ruta.indexOf('/pos.html') !== -1 || /pos\.html$/i.test(ruta);
}

function destinoPos() {
    const host = String((window.location && window.location.hostname) || '');
    if (/toysoft\.co$/i.test(host)) {
        return '/pos';
    }
    return 'POS.html';
}

function paginaEsPropietario() {
    const ruta = (window.location.pathname || '').toLowerCase();
    return ruta.indexOf('propietario') !== -1;
}

function destinoPropietario() {
    const host = String((window.location && window.location.hostname) || '');
    if (/toysoft\.co$/i.test(host)) {
        return '/propietario/';
    }
    return 'propietario/';
}

function paginaEsAdministracion() {
    const ruta = (window.location.pathname || '').toLowerCase();
    return ruta.indexOf('admon.html') !== -1;
}

function paginaEsInicio() {
    const ruta = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    return ruta === '/' || ruta === '' || /\/index(\.html)?$/.test(ruta);
}

function cuentaEsPos() {
    return window.ToySoftFirebase && typeof ToySoftFirebase.esPos === 'function' && ToySoftFirebase.esPos();
}

function cuentaEsPropietario() {
    return window.ToySoftFirebase && typeof ToySoftFirebase.esPropietario === 'function' && ToySoftFirebase.esPropietario();
}

function aplicarMenuPorRol() {
    const esMesero = window.ToySoftFirebase && typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero();
    const esPos = cuentaEsPos();
    const esPropietario = cuentaEsPropietario();
    const btnAdmon = document.getElementById('btnInicioAdmon');
    const btnPOS = document.getElementById('btnInicioPOS');
    if (btnAdmon) btnAdmon.style.display = (esMesero || esPos || esPropietario) ? 'none' : '';
    if (btnPOS) btnPOS.style.display = (esMesero || esPropietario) ? 'none' : '';
    aplicarCabeceraPos();
}

function aplicarCabeceraPos() {
    const esPos = cuentaEsPos();
    const btnInicio = document.getElementById('btnVolverInicioPOS');
    const btnSalir = document.getElementById('btnCerrarSesionPOS');
    const nombreEl = document.getElementById('nombreCajaPOS');
    if (btnInicio) btnInicio.style.display = esPos ? 'none' : '';
    if (btnSalir) btnSalir.style.display = esPos ? '' : 'none';
    if (nombreEl) {
        const nombre = (window.ToySoftFirebase && typeof ToySoftFirebase.nombreUsuarioActual === 'function')
            ? ToySoftFirebase.nombreUsuarioActual()
            : '';
        nombreEl.textContent = esPos && nombre ? nombre : '';
        nombreEl.style.display = (esPos && nombre) ? '' : 'none';
    }
}

function irSegunRol() {
    if (window.ToySoftFirebase && typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero()) {
        if (!paginaEsMesero()) window.location.href = destinoMesero();
        return true;
    }
    if (cuentaEsPropietario()) {
        if (!paginaEsPropietario()) window.location.href = destinoPropietario();
        return true;
    }
    if (cuentaEsPos()) {
        if (paginaEsAdministracion() || paginaEsInicio()) {
            window.location.href = destinoPos();
            return true;
        }
        aplicarMenuPorRol();
        return paginaEsPos();
    }
    aplicarMenuPorRol();
    return false;
}

function alternarVerClave(evento) {
    if (evento) {
        evento.preventDefault();
        evento.stopPropagation();
    }
    const input = document.getElementById('clave');
    const boton = document.getElementById('btnVerClave');
    if (!input || !boton) return;

    const visible = input.getAttribute('data-clave-visible') !== '1';
    input.setAttribute('data-clave-visible', visible ? '1' : '0');
    try {
        input.type = visible ? 'text' : 'password';
    } catch (e) {}
    input.style.webkitTextSecurity = visible ? 'none' : 'disc';

    const ojo = boton.querySelector('.icon-eye');
    const ojoTachado = boton.querySelector('.icon-eye-off');
    if (ojo) ojo.style.display = visible ? 'none' : 'block';
    if (ojoTachado) ojoTachado.style.display = visible ? 'block' : 'none';
    boton.setAttribute('aria-pressed', visible ? 'true' : 'false');
    boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    boton.title = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
}

async function verificarSesion() {
    if (window.ToySoftFirebase) {
        await ToySoftFirebase.init();
        const user = await ToySoftFirebase.esperarAuth();
        return !!user;
    }
    return localStorage.getItem('sesionActiva') === 'true';
}

function verificarCierreDiario() {
    const fechaHoy = new Date().toLocaleDateString();
    const cierresDiarios = JSON.parse(localStorage.getItem('cierresDiarios') || '[]');
    const cierreHoy = cierresDiarios.find(cierre =>
        new Date(cierre.fecha).toLocaleDateString() === fechaHoy
    );
    return !!cierreHoy;
}

function redirigirMeseroSiNoCorresponde() {
    if (!window.ToySoftFirebase || typeof ToySoftFirebase.esMesero !== 'function') return false;
    if (!ToySoftFirebase.esMesero()) return false;
    if (paginaEsMesero()) return false;
    window.location.href = destinoMesero();
    return true;
}

function redirigirPosSiNoCorresponde() {
    if (!cuentaEsPos()) return false;
    if (paginaEsPos()) return false;
    if (paginaEsAdministracion() || paginaEsInicio()) {
        window.location.href = destinoPos();
        return true;
    }
    return false;
}

function redirigirPropietarioSiNoCorresponde() {
    if (!cuentaEsPropietario()) return false;
    if (paginaEsPropietario()) return false;
    window.location.href = destinoPropietario();
    return true;
}

function posPideLogin() {
    return localStorage.getItem('posRequiereLogin') === 'true';
}

function mostrarLoginPOS() {
    const login = document.getElementById('loginPOS');
    if (login) login.style.display = 'flex';
    if (document.body) document.body.classList.add('esperando-acceso-pos');
}

function ocultarLoginPOS() {
    const login = document.getElementById('loginPOS');
    if (login) login.style.display = 'none';
    if (document.body) document.body.classList.remove('esperando-acceso-pos');
}

async function iniciarSesionPOS() {
    const { email, clave } = loginFormularioValores();
    mostrarLoginMensaje('');
    if (!window.ToySoftFirebase || !ToySoftFirebase.estaConfigurado()) {
        mostrarLoginMensaje('No hay conexión con Firebase. Recarga la página.');
        return;
    }
    if (!email || !clave) {
        mostrarLoginMensaje('Escribe el correo y la contraseña.');
        return;
    }
    try {
        await ToySoftFirebase.init();
        await ToySoftFirebase.iniciarSesion(email, clave, '', { soloUnirse: true });
        if (typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero()) {
            try { await ToySoftFirebase.cerrarSesion(); } catch (e) {}
            mostrarLoginMensaje('Esta cuenta es de mesero. Entra en ultimate.toysoft.co/mesero/.');
            return;
        }
        if (cuentaEsPropietario()) {
            try { await ToySoftFirebase.cerrarSesion(); } catch (e) {}
            mostrarLoginMensaje('Esta cuenta es de propietario. Entra en ultimate.toysoft.co/propietario/.');
            return;
        }
        const esCaja = (typeof ToySoftFirebase.esCaja === 'function' && ToySoftFirebase.esCaja())
            || (typeof ToySoftFirebase.esAdminNegocio === 'function' && ToySoftFirebase.esAdminNegocio())
            || cuentaEsPos();
        if (!esCaja) {
            try { await ToySoftFirebase.cerrarSesion(); } catch (e) {}
            mostrarLoginMensaje('Esta cuenta no es de punto de venta. Pide al administrador que te cree en Administración.');
            return;
        }
        localStorage.setItem('sesionActiva', 'true');
        window.location.reload();
    } catch (error) {
        mostrarLoginMensaje(ToySoftFirebase.mensajeErrorAuth(error));
    }
}

async function verificarAcceso() {
    const haySesion = await verificarSesion();
    if (!haySesion) {
        if (document.getElementById('loginPOS') && posPideLogin()) {
            mostrarLoginPOS();
            return false;
        }
        console.log('Redirigiendo al login...');
        window.location.href = 'index.html';
        return false;
    }
    localStorage.setItem('sesionActiva', 'true');
    if (redirigirMeseroSiNoCorresponde()) return false;
    if (redirigirPropietarioSiNoCorresponde()) return false;
    if (redirigirPosSiNoCorresponde()) return false;
    if (paginaEsPos() && window.ToySoftFirebase && typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero()) {
        window.location.href = destinoMesero();
        return false;
    }
    ocultarLoginPOS();
    aplicarCabeceraPos();
    return true;
}

async function iniciarSesion() {
    const { email, clave, codigo } = loginFormularioValores();
    mostrarLoginMensaje('');

    if (!window.ToySoftFirebase || !ToySoftFirebase.estaConfigurado()) {
        mostrarLoginMensaje('No hay conexión con Firebase. Recarga la página.');
        return;
    }

    if (!email || !clave) {
        mostrarLoginMensaje('Escribe el correo y la contraseña.');
        return;
    }

    try {
        await ToySoftFirebase.init();
        await ToySoftFirebase.iniciarSesion(email, clave, codigo);
        if (irSegunRol()) return;
        mostrarApp();
    } catch (error) {
        console.log('Login fallido', error);
        mostrarLoginMensaje(ToySoftFirebase.mensajeErrorAuth(error));
    }
}

async function unirseAlNegocio() {
    const { email, clave, codigo, nombre } = loginFormularioValores();
    mostrarLoginMensaje('');

    if (!window.ToySoftFirebase || !ToySoftFirebase.estaConfigurado()) {
        mostrarLoginMensaje('No hay conexión con Firebase. Recarga la página.');
        return;
    }

    if (!email || !clave) {
        mostrarLoginMensaje('Escribe el correo y la contraseña.');
        return;
    }
    if (!nombre) {
        mostrarLoginMensaje('Pide al administrador que cree tu cuenta en Administración.');
        return;
    }
    if (!codigo) {
        mostrarLoginMensaje('Pide al administrador que cree tu cuenta en Administración.');
        return;
    }

    try {
        await ToySoftFirebase.init();
        await ToySoftFirebase.unirseAlNegocio(email, clave, codigo, nombre);
        if (irSegunRol()) return;
        mostrarApp();
    } catch (error) {
        console.log('Unión al negocio fallida', error);
        mostrarLoginMensaje(ToySoftFirebase.mensajeErrorAuth(error));
    }
}

function mostrarApp() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');

    console.log('Mostrando aplicación...');

    if (loginSection && appSection) {
        loginSection.style.opacity = '0';
        loginSection.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            loginSection.style.display = 'none';
            appSection.style.display = 'block';
            aplicarMenuPorRol();
            setTimeout(() => {
                appSection.style.opacity = '1';
                inicializarSistemaRecordatorios();
            }, 50);
        }, 300);
    } else {
        console.error('No se encontraron las secciones necesarias');
    }
}

async function cerrarSesion() {
    if (window.ToySoftFirebase) {
        try {
            await ToySoftFirebase.cerrarSesion();
        } catch (e) {
            console.warn('Error al cerrar sesión Firebase', e);
        }
    }
    localStorage.removeItem('sesionActiva');
    if (paginaEsMesero()) {
        window.location.href = destinoMesero();
        return;
    }
    if (paginaEsPropietario() || cuentaEsPropietario()) {
        window.location.href = destinoPropietario();
        return;
    }
    if (paginaEsPos() || cuentaEsPos()) {
        window.location.href = destinoPos();
        return;
    }
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', async function() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');
    const mostrarCuerpo = function () {
        if (document.body) document.body.style.display = 'block';
    };

    if (loginSection && appSection && window.ToySoftFirebase) {
        try {
            const iniciado = await ToySoftFirebase.init();
            if (typeof firebase === 'undefined') {
                loginSection.style.display = 'block';
                loginSection.style.opacity = '1';
                appSection.style.display = 'none';
                mostrarLoginMensaje('No cargó el SDK de Firebase. Revisa la conexión a internet.');
                return;
            }
            if (!ToySoftFirebase.estaConfigurado()) {
                loginSection.style.display = 'block';
                loginSection.style.opacity = '1';
                appSection.style.display = 'none';
                mostrarLoginMensaje('No hay conexión con Firebase. Recarga la página.');
                return;
            }

            if (!iniciado) {
                loginSection.style.display = 'block';
                loginSection.style.opacity = '1';
                appSection.style.display = 'none';
                mostrarLoginMensaje('Hay configuración, pero no se pudo conectar con Firebase. Revisa internet, Authentication y Firestore.');
                return;
            }
            const user = await ToySoftFirebase.esperarAuth();

            if (user) {
                localStorage.setItem('sesionActiva', 'true');
                if (irSegunRol()) return;
                aplicarMenuPorRol();
                loginSection.style.display = 'none';
                appSection.style.display = 'block';
                appSection.style.opacity = '1';
                setTimeout(inicializarSistemaRecordatorios, 1000);
            } else {
                localStorage.removeItem('sesionActiva');
                loginSection.style.display = 'block';
                loginSection.style.opacity = '1';
                appSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error al iniciar sesión Firebase', error);
            loginSection.style.display = 'block';
            loginSection.style.opacity = '1';
            appSection.style.display = 'none';
            mostrarLoginMensaje((error && error.message) || 'No se pudo conectar con Firebase.');
        } finally {
            mostrarCuerpo();
        }
        return;
    }

    if (loginSection && appSection) {
        if (localStorage.getItem('sesionActiva') === 'true') {
            loginSection.style.display = 'none';
            appSection.style.display = 'block';
            appSection.style.opacity = '1';
            setTimeout(inicializarSistemaRecordatorios, 1000);
        } else {
            loginSection.style.opacity = '1';
        }
        mostrarCuerpo();
    }
});

function inicializarSistemaRecordatorios() {
    try {
        console.log('🔔 Inicializando sistema de recordatorios...');

        if (typeof cargarRecordatorios === 'function') {
            cargarRecordatorios();
            actualizarBadgeRecordatorios();
            setInterval(actualizarBadgeRecordatorios, 30000);
            console.log('✅ Sistema de recordatorios inicializado');
        } else {
            console.log('⚠️ Funciones de recordatorios no disponibles aún');
        }
    } catch (error) {
        console.error('❌ Error al inicializar sistema de recordatorios:', error);
    }
}

function actualizarBadgeRecordatorios() {
    try {
        if (typeof obtenerRecordatoriosUrgentes === 'function') {
            const recordatoriosUrgentes = obtenerRecordatoriosUrgentes();
            const badge = document.getElementById('badgeRecordatorios');

            if (badge && recordatoriosUrgentes.length > 0) {
                badge.textContent = recordatoriosUrgentes.length;
                badge.style.display = 'block';

                if (recordatoriosUrgentes.length >= 5) {
                    badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
                } else if (recordatoriosUrgentes.length >= 3) {
                    badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark';
                } else {
                    badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-info';
                }
            } else if (badge) {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('❌ Error al actualizar badge de recordatorios:', error);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (paginaEsMesero() || paginaEsPropietario()) return;
    if (!window.ToySoftFirebase || typeof ToySoftFirebase.init !== 'function') return;
    ToySoftFirebase.init().then(function () {
        return ToySoftFirebase.esperarAuth();
    }).then(function (user) {
        if (!user) return;
        if (redirigirMeseroSiNoCorresponde()) return;
        if (redirigirPropietarioSiNoCorresponde()) return;
        redirigirPosSiNoCorresponde();
    }).catch(function () {});
});

const PIN_INTENTOS_MAX = 3;
const PIN_BLOQUEO_MS = 15 * 60 * 1000;
const STORAGE_PIN_INTENTOS = 'toysoftPinIntentosFallidos';
const STORAGE_PIN_BLOQUEO = 'toysoftPinBloqueoHasta';
let timerBloqueoPin = null;

function minutosSegundosPin(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
}

function bloqueoPinHasta() {
    const hasta = parseInt(localStorage.getItem(STORAGE_PIN_BLOQUEO) || '0', 10) || 0;
    if (hasta && hasta <= Date.now()) {
        localStorage.removeItem(STORAGE_PIN_BLOQUEO);
        localStorage.removeItem(STORAGE_PIN_INTENTOS);
        return 0;
    }
    return hasta;
}

function pinAccesoBloqueado() {
    return bloqueoPinHasta() > Date.now();
}

function intentosPinFallidos() {
    return parseInt(localStorage.getItem(STORAGE_PIN_INTENTOS) || '0', 10) || 0;
}

function limpiarIntentosPin() {
    localStorage.removeItem(STORAGE_PIN_INTENTOS);
    localStorage.removeItem(STORAGE_PIN_BLOQUEO);
    if (timerBloqueoPin) {
        clearInterval(timerBloqueoPin);
        timerBloqueoPin = null;
    }
}

function registrarPinFallido() {
    const n = intentosPinFallidos() + 1;
    localStorage.setItem(STORAGE_PIN_INTENTOS, String(n));
    if (n >= PIN_INTENTOS_MAX) {
        localStorage.setItem(STORAGE_PIN_BLOQUEO, String(Date.now() + PIN_BLOQUEO_MS));
    }
    return n;
}

function mensajeIntentoPin(n) {
    if (n >= PIN_INTENTOS_MAX) {
        return 'ACCESO BLOQUEADO. Se detectaron 3 intentos fallidos. El sistema queda bloqueado por seguridad. El intento queda registrado.';
    }
    const quedan = PIN_INTENTOS_MAX - n;
    if (quedan === 1) {
        return 'PIN incorrecto. Queda 1 intento. El siguiente bloqueará todo el sistema.';
    }
    return 'PIN incorrecto. Quedan ' + quedan + ' intentos.';
}

function avisoBloqueoPinTexto() {
    return 'ÚLTIMO AVISO\n\nSe detectaron 3 intentos fallidos de PIN.\nPor seguridad, el sistema se va a bloquear.\n\nEl intento queda registrado.\nAvise al administrador.';
}

function actualizarTextosTiempoBloqueoPin() {
    const hasta = bloqueoPinHasta();
    const resto = hasta ? minutosSegundosPin(hasta - Date.now()) : '0:00';
    document.querySelectorAll('[data-tiempo-bloqueo-pin]').forEach(function (el) {
        el.textContent = resto;
    });
    if (!hasta) {
        if (timerBloqueoPin) {
            clearInterval(timerBloqueoPin);
            timerBloqueoPin = null;
        }
        prepararUiPin();
    }
}

function iniciarTemporizadorBloqueoPin() {
    actualizarTextosTiempoBloqueoPin();
    if (timerBloqueoPin) clearInterval(timerBloqueoPin);
    if (!pinAccesoBloqueado()) return;
    timerBloqueoPin = setInterval(actualizarTextosTiempoBloqueoPin, 1000);
}

function prepararUiPin() {
    const bloqueado = pinAccesoBloqueado();
    const formPos = document.getElementById('cuerpoPinAcceso');
    const lockPos = document.getElementById('capaBloqueoPinAcceso');
    const btnAcceder = document.getElementById('btnVerificarPinAcceso');
    const tituloPos = document.getElementById('modalPinAccesoLabel');
    if (lockPos) lockPos.style.display = bloqueado ? 'block' : 'none';
    if (formPos) formPos.style.display = bloqueado ? 'none' : '';
    if (btnAcceder) btnAcceder.style.display = bloqueado ? 'none' : '';
    if (tituloPos) tituloPos.textContent = bloqueado ? 'SISTEMA BLOQUEADO' : (tituloPos.dataset.tituloOriginal || tituloPos.textContent);

    const formAdmin = document.getElementById('formPinAdministracion');
    const lockAdmin = document.getElementById('capaBloqueoPinAdministracion');
    const tituloAdmin = document.getElementById('tituloPinAdministracion');
    const recuperarVisible = document.getElementById('formRecuperarPinAdministracion')
        && document.getElementById('formRecuperarPinAdministracion').style.display !== 'none';
    if (lockAdmin) lockAdmin.style.display = (bloqueado && !recuperarVisible) ? 'block' : 'none';
    if (formAdmin && !recuperarVisible) formAdmin.style.display = bloqueado ? 'none' : 'block';
    if (tituloAdmin && !recuperarVisible) {
        tituloAdmin.textContent = bloqueado ? 'SISTEMA BLOQUEADO' : 'Ingrese el PIN de Administración';
    }

    if (bloqueado) iniciarTemporizadorBloqueoPin();
    else actualizarTextosTiempoBloqueoPin();
}
