(function (global) {
  const STORAGE_CONFIG = 'toysoftFirebaseConfig';
  const NOMBRE_NEGOCIO_DEFAULT = 'ToySoft Ultimate';
  const FIREBASE_CONFIG_EMBEBIDA = {
    apiKey: 'AIzaSyD5qyCTo-tRc-lAxhst-k7iH0eurJICn5Y',
    authDomain: 'toysoft-ultimate.firebaseapp.com',
    projectId: 'toysoft-ultimate',
    storageBucket: 'toysoft-ultimate.firebasestorage.app',
    messagingSenderId: '1004634598810',
    appId: '1:1004634598810:web:b25b6e9f71ac0b68f75e23'
  };

  let appIniciada = false;
  let initPromise = null;
  let authListo = false;
  let usuarioAuth = null;
  let negocioIdActual = null;
  let usuarioDoc = null;
  const esperandoAuth = [];

  function configValida(cfg) {
    return !!(cfg && cfg.apiKey && cfg.projectId && cfg.appId);
  }

  function obtenerConfig() {
    if (configValida(FIREBASE_CONFIG_EMBEBIDA)) return FIREBASE_CONFIG_EMBEBIDA;
    if (configValida(global.FIREBASE_CONFIG_EMBEBIDA)) return global.FIREBASE_CONFIG_EMBEBIDA;
    if (typeof FIREBASE_CONFIG_ARCHIVO !== 'undefined' && configValida(FIREBASE_CONFIG_ARCHIVO)) {
      return FIREBASE_CONFIG_ARCHIVO;
    }
    try {
      const guardada = localStorage.getItem(STORAGE_CONFIG);
      if (guardada) {
        const parsed = JSON.parse(guardada);
        if (configValida(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Config Firebase en localStorage inválida', e);
    }
    return null;
  }

  function estaConfigurado() {
    return configValida(obtenerConfig());
  }

  function notificarAuth(user) {
    usuarioAuth = user || null;
    authListo = true;
    esperandoAuth.splice(0).forEach(function (fn) { fn(usuarioAuth); });
  }

  function esperarAuth() {
    if (authListo) return Promise.resolve(usuarioAuth);
    return new Promise(function (resolve) {
      esperandoAuth.push(resolve);
    });
  }

  function db() {
    return firebase.firestore();
  }

  function auth() {
    return firebase.auth();
  }

  function estaListo() {
    return appIniciada && !!usuarioAuth;
  }

  function getNegocioId() {
    return negocioIdActual;
  }

  function getUsuario() {
    return usuarioDoc;
  }

  function sincronizarLocal(datos) {
    if (!datos) return;
    const limpio = {
      nombre: datos.nombre || '',
      nit: datos.nit || '',
      direccion: datos.direccion || '',
      correo: datos.correo || '',
      telefono: datos.telefono || ''
    };
    localStorage.setItem('datosNegocio', JSON.stringify(limpio));
    if (limpio.nombre) localStorage.setItem('nombreNegocio', limpio.nombre);
  }

  async function asegurarNegocio() {
    const user = auth().currentUser;
    if (!user) return null;

    const userRef = db().collection('usuarios').doc(user.uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      usuarioDoc = userSnap.data();
      negocioIdActual = usuarioDoc.negocioId;
    } else {
      const local = JSON.parse(localStorage.getItem('datosNegocio') || '{}') || {};
      const negocioRef = db().collection('negocios').doc();
      negocioIdActual = negocioRef.id;
      usuarioDoc = {
        email: user.email || '',
        rol: 'admin',
        negocioId: negocioIdActual,
        nombre: user.displayName || '',
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      const negocio = {
        nombre: local.nombre || NOMBRE_NEGOCIO_DEFAULT,
        nit: local.nit || '',
        direccion: local.direccion || '',
        correo: local.correo || user.email || '',
        telefono: local.telefono || '',
        creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      const batch = db().batch();
      batch.set(userRef, usuarioDoc);
      batch.set(negocioRef, negocio);
      await batch.commit();
    }

    if (negocioIdActual) {
      const negSnap = await db().collection('negocios').doc(negocioIdActual).get();
      if (negSnap.exists) sincronizarLocal(negSnap.data());
    }

    return { usuario: usuarioDoc, negocioId: negocioIdActual };
  }

  async function guardarDatosNegocio(datos) {
    if (!negocioIdActual) await asegurarNegocio();
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    const payload = {
      nombre: datos.nombre || '',
      nit: datos.nit || '',
      direccion: datos.direccion || '',
      correo: datos.correo || '',
      telefono: datos.telefono || '',
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db().collection('negocios').doc(negocioIdActual).set(payload, { merge: true });
    sincronizarLocal(payload);
  }

  async function obtenerDatosNegocio() {
    if (!negocioIdActual) await asegurarNegocio();
    if (!negocioIdActual) return JSON.parse(localStorage.getItem('datosNegocio') || 'null');
    const snap = await db().collection('negocios').doc(negocioIdActual).get();
    if (!snap.exists) return JSON.parse(localStorage.getItem('datosNegocio') || 'null');
    sincronizarLocal(snap.data());
    return {
      nombre: snap.data().nombre || '',
      nit: snap.data().nit || '',
      direccion: snap.data().direccion || '',
      correo: snap.data().correo || '',
      telefono: snap.data().telefono || ''
    };
  }

  function mensajeErrorAuth(error) {
    const code = (error && error.code) || '';
    const mapa = {
      'auth/invalid-email': 'El correo no es válido.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/user-not-found': 'Esa cuenta no existe. Créala en Authentication de Firebase.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos. Las cuentas se crean en Firebase Authentication.',
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/network-request-failed': 'Sin conexión. Revisa internet e inténtalo de nuevo.',
      'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
      'auth/operation-not-allowed': 'Activa Email/Password en Authentication de Firebase.',
      'auth/invalid-api-key': 'La apiKey de Firebase no es válida. Revisa la configuración.'
    };
    if (mapa[code]) return mapa[code];
    if (error && error.message && /permission/i.test(error.message)) {
      return 'Firestore rechazó el acceso. Publica las reglas de firestore.rules en la consola.';
    }
    return (error && error.message) || 'No se pudo completar la operación.';
  }

  async function iniciarSesion(email, password) {
    const cred = await auth().signInWithEmailAndPassword(email, password);
    await asegurarNegocio();
    localStorage.setItem('sesionActiva', 'true');
    localStorage.setItem('usuarioActual', 'admin');
    return cred.user;
  }

  async function cerrarSesion() {
    negocioIdActual = null;
    usuarioDoc = null;
    localStorage.removeItem('sesionActiva');
    if (appIniciada) {
      await auth().signOut();
    }
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = (async function () {
      const cfg = obtenerConfig();
      if (!cfg) {
        notificarAuth(null);
        return false;
      }
      if (typeof firebase === 'undefined') {
        console.error('SDK de Firebase no cargó');
        notificarAuth(null);
        return false;
      }
      if (!appIniciada) {
        firebase.initializeApp(cfg);
        firebase.auth().languageCode = 'es';
        try {
          await firebase.firestore().enablePersistence({ synchronizeTabs: true });
        } catch (e) {
          if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
            console.warn('Persistencia offline de Firestore:', e);
          }
        }
        firebase.auth().onAuthStateChanged(function (user) {
          notificarAuth(user);
        });
        appIniciada = true;
      }
      await esperarAuth();
      if (usuarioAuth) {
        try {
          await asegurarNegocio();
        } catch (e) {
          console.error('No se pudo asegurar el negocio', e);
        }
      }
      return true;
    })();
    return initPromise;
  }

  global.ToySoftFirebase = {
    NOMBRE_NEGOCIO_DEFAULT: NOMBRE_NEGOCIO_DEFAULT,
    obtenerConfig: obtenerConfig,
    estaConfigurado: estaConfigurado,
    estaListo: estaListo,
    init: init,
    esperarAuth: esperarAuth,
    iniciarSesion: iniciarSesion,
    cerrarSesion: cerrarSesion,
    asegurarNegocio: asegurarNegocio,
    guardarDatosNegocio: guardarDatosNegocio,
    obtenerDatosNegocio: obtenerDatosNegocio,
    getNegocioId: getNegocioId,
    getUsuario: getUsuario,
    db: db,
    auth: auth,
    mensajeErrorAuth: mensajeErrorAuth
  };
})(window);
