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
        mostrarLoginMensaje('Primero pega la configuración de Firebase.');
        if (window.ToySoftFirebase) ToySoftFirebase.mostrarPanelSetup(true);
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

async function crearCuentaNegocio() {
    const { email, clave } = loginFormularioValores();
    mostrarLoginMensaje('');

    if (!window.ToySoftFirebase || !ToySoftFirebase.estaConfigurado()) {
        mostrarLoginMensaje('Primero pega la configuración de Firebase.');
        ToySoftFirebase.mostrarPanelSetup(true);
        return;
    }

    if (!email || !clave) {
        mostrarLoginMensaje('Escribe el correo y una contraseña de al menos 6 caracteres.');
        return;
    }

    try {
        await ToySoftFirebase.init();
        await ToySoftFirebase.crearCuentaInicial(email, clave);
        mostrarApp();
    } catch (error) {
        console.log('Alta de cuenta fallida', error);
        mostrarLoginMensaje(ToySoftFirebase.mensajeErrorAuth(error));
    }
}

function guardarConfigFirebaseDesdeLogin() {
    const area = document.getElementById('firebaseConfigTexto');
    mostrarLoginMensaje('');
    if (!area || !window.ToySoftFirebase) return;
    try {
        const cfg = ToySoftFirebase.parsearConfigFirebase(area.value);
        ToySoftFirebase.guardarConfig(cfg);
        mostrarLoginMensaje('Configuración guardada. Recargando…', 'ok');
        setTimeout(function () { window.location.reload(); }, 600);
    } catch (error) {
        mostrarLoginMensaje('No pude leer la config. Copia el objeto firebaseConfig completo. ' + (error.message || ''));
    }
}

async function copiarReglasFirestore() {
    mostrarLoginMensaje('');
    try {
        const res = await fetch('firestore.rules');
        if (!res.ok) throw new Error('No se encontró firestore.rules');
        const texto = await res.text();
        await navigator.clipboard.writeText(texto);
        mostrarLoginMensaje('Reglas copiadas. En Firebase: Firestore → Reglas → pega → Publicar.', 'ok');
    } catch (error) {
        mostrarLoginMensaje('No pude copiar las reglas. Ábreas en el archivo firestore.rules y pégalas en la consola.');
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
            if (!iniciado || !ToySoftFirebase.estaConfigurado()) {
                loginSection.style.display = 'block';
                loginSection.style.opacity = '1';
                appSection.style.display = 'none';
                ToySoftFirebase.mostrarPanelSetup(true);
                return;
            }

            ToySoftFirebase.mostrarPanelSetup(false);
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
            ToySoftFirebase.mostrarPanelSetup(true);
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
