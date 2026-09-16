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
    return 'mesero.html';
}

function aplicarMenuPorRol() {
    const esMesero = window.ToySoftFirebase && typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero();
    const btnAdmon = document.getElementById('btnInicioAdmon');
    const btnPOS = document.getElementById('btnInicioPOS');
    const btnMesero = document.getElementById('btnInicioMesero');
    if (btnAdmon) btnAdmon.style.display = esMesero ? 'none' : '';
    if (btnPOS) btnPOS.style.display = esMesero ? 'none' : '';
    if (btnMesero && esMesero) btnMesero.href = destinoMesero();
}

function irSegunRol() {
    if (window.ToySoftFirebase && typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero()) {
        if (!paginaEsMesero()) window.location.href = destinoMesero();
        return true;
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

async function verificarAcceso() {
    const haySesion = await verificarSesion();
    if (!haySesion) {
        console.log('Redirigiendo al login...');
        window.location.href = 'index.html';
        return false;
    }
    localStorage.setItem('sesionActiva', 'true');
    if (redirigirMeseroSiNoCorresponde()) return false;
    return true;
}

function paginaEsAdministracion() {
    const ruta = (window.location.pathname || '').toLowerCase();
    return ruta.indexOf('admon.html') !== -1;
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
    window.location.href = paginaEsMesero() ? destinoMesero() : 'index.html';
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
    if (paginaEsMesero()) return;
    if (!window.ToySoftFirebase || typeof ToySoftFirebase.init !== 'function') return;
    ToySoftFirebase.init().then(function () {
        return ToySoftFirebase.esperarAuth();
    }).then(function (user) {
        if (user) redirigirMeseroSiNoCorresponde();
    }).catch(function () {});
});
