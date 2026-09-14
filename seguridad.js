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
    return { email: email, clave: clave };
}

function alternarVerClave() {
    const input = document.getElementById('clave');
    const boton = document.getElementById('btnVerClave');
    if (!input || !boton) return;

    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    boton.setAttribute('aria-pressed', visible ? 'true' : 'false');
    boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    boton.title = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';

    const ojo = boton.querySelector('.icon-eye');
    const ojoTachado = boton.querySelector('.icon-eye-off');
    if (ojo) ojo.hidden = visible;
    if (ojoTachado) ojoTachado.hidden = !visible;
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

async function verificarAcceso() {
    const haySesion = await verificarSesion();
    if (!haySesion) {
        console.log('Redirigiendo al login...');
        window.location.href = 'index.html';
        return false;
    }
    localStorage.setItem('sesionActiva', 'true');
    return true;
}

async function iniciarSesion() {
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
        await ToySoftFirebase.iniciarSesion(email, clave);
        mostrarApp();
    } catch (error) {
        console.log('Login fallido', error);
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
