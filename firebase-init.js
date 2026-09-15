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

  function refCatalogo() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('catalogo').doc('actual');
  }

  function escribirCatalogoLocal(categorias, productos) {
    localStorage.setItem('categorias', JSON.stringify(Array.isArray(categorias) ? categorias : []));
    localStorage.setItem('productos', JSON.stringify(Array.isArray(productos) ? productos : []));
  }

  function catalogoDesdeLocal() {
    let categorias = [];
    let productos = [];
    try {
      const cats = JSON.parse(localStorage.getItem('categorias') || '[]');
      if (Array.isArray(cats)) categorias = cats;
    } catch (e) {}
    try {
      const prods = JSON.parse(localStorage.getItem('productos') || '[]');
      if (Array.isArray(prods)) productos = prods;
    } catch (e) {}
    return { categorias: categorias, productos: productos };
  }

  function catalogoLimpio(datos) {
    const origen = datos || {};
    const texto = JSON.stringify({
      categorias: Array.isArray(origen.categorias) ? origen.categorias : [],
      productos: Array.isArray(origen.productos) ? origen.productos : []
    }, function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  function catalogoDesdeSnap(snap) {
    const data = snap && snap.exists ? (snap.data() || {}) : {};
    return {
      categorias: Array.isArray(data.categorias) ? data.categorias : [],
      productos: Array.isArray(data.productos) ? data.productos : []
    };
  }

  async function guardarCatalogo(datos) {
    if (!negocioIdActual) await asegurarNegocio();
    const limpio = catalogoLimpio(datos);
    escribirCatalogoLocal(limpio.categorias, limpio.productos);
    await refCatalogo().set({
      categorias: limpio.categorias,
      productos: limpio.productos,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return limpio;
  }

  function persistirCatalogo(categorias, productos) {
    const limpio = catalogoLimpio({ categorias: categorias, productos: productos });
    escribirCatalogoLocal(limpio.categorias, limpio.productos);
    if (!estaListo()) return Promise.resolve(limpio);
    return guardarCatalogo(limpio).catch(function (error) {
      console.warn('Catálogo no se guardó en la nube', error);
      throw error;
    });
  }

  async function obtenerCatalogo() {
    if (!negocioIdActual) await asegurarNegocio();
    if (!negocioIdActual) return catalogoDesdeLocal();
    const snap = await refCatalogo().get();
    if (!snap.exists) return catalogoDesdeLocal();
    const nube = catalogoDesdeSnap(snap);
    escribirCatalogoLocal(nube.categorias, nube.productos);
    return nube;
  }

  async function sincronizarCatalogo() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = catalogoDesdeLocal();
    if (!negocioIdActual) return local;
    const snap = await refCatalogo().get();
    if (snap.exists) {
      const nube = catalogoDesdeSnap(snap);
      escribirCatalogoLocal(nube.categorias, nube.productos);
      return nube;
    }
    if (local.categorias.length || local.productos.length) {
      await guardarCatalogo(local);
      return local;
    }
    return { categorias: [], productos: [] };
  }

  let unsubCatalogo = null;
  function escucharCatalogo(callback) {
    if (unsubCatalogo) {
      unsubCatalogo();
      unsubCatalogo = null;
    }
    if (!negocioIdActual) return function () {};
    unsubCatalogo = refCatalogo().onSnapshot(function (snap) {
      if (!snap.exists) return;
      const nube = catalogoDesdeSnap(snap);
      escribirCatalogoLocal(nube.categorias, nube.productos);
      if (typeof callback === 'function') callback(nube);
    }, function (error) {
      console.warn('No se pudo escuchar el catálogo', error);
    });
    return unsubCatalogo;
  }

  function refOperacion() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('operacion').doc('actual');
  }

  function parseJsonLocal(clave, fallback) {
    try {
      const bruto = localStorage.getItem(clave);
      if (bruto == null) return fallback;
      return JSON.parse(bruto);
    } catch (e) {
      return fallback;
    }
  }

  function entradasAObjetos(entradas) {
    if (!Array.isArray(entradas)) return [];
    return entradas.map(function (par) {
      if (par && !Array.isArray(par) && par.id != null) {
        return { id: String(par.id), datos: par.datos };
      }
      if (!Array.isArray(par) || par.length < 2) return null;
      return { id: String(par[0]), datos: par[1] };
    }).filter(Boolean);
  }

  function objetosAEntradas(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.map(function (item) {
      if (Array.isArray(item) && item.length >= 2) return [String(item[0]), item[1]];
      if (item && item.id != null) return [String(item.id), item.datos];
      return null;
    }).filter(function (par) { return par && par[1] !== undefined; });
  }

  function snapshotOperacionLocal() {
    return {
      mesasActivas: parseJsonLocal('mesasActivas', []),
      ordenesCocina: parseJsonLocal('ordenesCocina', []),
      historialCocina: parseJsonLocal('historialCocina', []),
      pedidosCocinaListos: parseJsonLocal('pedidosCocinaListos', []),
      contadorDomicilios: parseInt(localStorage.getItem('contadorDomicilios') || '0', 10) || 0,
      contadorRecoger: parseInt(localStorage.getItem('contadorRecoger') || '0', 10) || 0,
      ultimaFechaContadores: localStorage.getItem('ultimaFechaContadores') || '',
      nombresDomiciliarios: parseJsonLocal('nombresDomiciliarios', []),
      pantallaCocinaActivada: localStorage.getItem('pantallaCocinaActivada') !== 'false',
      cocinaSonidoActivado: localStorage.getItem('cocinaSonidoActivado') !== 'false',
      cocinaIntervaloActualizacion: localStorage.getItem('cocinaIntervaloActualizacion') || '30'
    };
  }

  function operacionLimpia(datos) {
    const origen = datos || {};
    const texto = JSON.stringify({
      mesasActivas: entradasAObjetos(origen.mesasActivas),
      ordenesCocina: entradasAObjetos(origen.ordenesCocina),
      historialCocina: Array.isArray(origen.historialCocina) ? origen.historialCocina : [],
      pedidosCocinaListos: Array.isArray(origen.pedidosCocinaListos) ? origen.pedidosCocinaListos : [],
      contadorDomicilios: parseInt(origen.contadorDomicilios, 10) || 0,
      contadorRecoger: parseInt(origen.contadorRecoger, 10) || 0,
      ultimaFechaContadores: origen.ultimaFechaContadores || '',
      nombresDomiciliarios: Array.isArray(origen.nombresDomiciliarios) ? origen.nombresDomiciliarios : [],
      pantallaCocinaActivada: origen.pantallaCocinaActivada !== false,
      cocinaSonidoActivado: origen.cocinaSonidoActivado !== false,
      cocinaIntervaloActualizacion: String(origen.cocinaIntervaloActualizacion || '30')
    }, function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  function operacionParaLocal(nube) {
    return {
      mesasActivas: objetosAEntradas(nube.mesasActivas),
      ordenesCocina: objetosAEntradas(nube.ordenesCocina),
      historialCocina: Array.isArray(nube.historialCocina) ? nube.historialCocina : [],
      pedidosCocinaListos: Array.isArray(nube.pedidosCocinaListos) ? nube.pedidosCocinaListos : [],
      contadorDomicilios: parseInt(nube.contadorDomicilios, 10) || 0,
      contadorRecoger: parseInt(nube.contadorRecoger, 10) || 0,
      ultimaFechaContadores: nube.ultimaFechaContadores || '',
      nombresDomiciliarios: Array.isArray(nube.nombresDomiciliarios) ? nube.nombresDomiciliarios : [],
      pantallaCocinaActivada: nube.pantallaCocinaActivada !== false,
      cocinaSonidoActivado: nube.cocinaSonidoActivado !== false,
      cocinaIntervaloActualizacion: String(nube.cocinaIntervaloActualizacion || '30')
    };
  }

  function escribirOperacionLocal(datos) {
    const local = operacionParaLocal(datos || {});
    localStorage.setItem('mesasActivas', JSON.stringify(local.mesasActivas));
    localStorage.setItem('ordenesCocina', JSON.stringify(local.ordenesCocina));
    localStorage.setItem('historialCocina', JSON.stringify(local.historialCocina));
    localStorage.setItem('pedidosCocinaListos', JSON.stringify(local.pedidosCocinaListos));
    localStorage.setItem('contadorDomicilios', String(local.contadorDomicilios));
    localStorage.setItem('contadorRecoger', String(local.contadorRecoger));
    if (local.ultimaFechaContadores) {
      localStorage.setItem('ultimaFechaContadores', local.ultimaFechaContadores);
    }
    localStorage.setItem('nombresDomiciliarios', JSON.stringify(local.nombresDomiciliarios));
    localStorage.setItem('pantallaCocinaActivada', local.pantallaCocinaActivada ? 'true' : 'false');
    localStorage.setItem('cocinaSonidoActivado', local.cocinaSonidoActivado ? 'true' : 'false');
    localStorage.setItem('cocinaIntervaloActualizacion', local.cocinaIntervaloActualizacion);
    return local;
  }

  function operacionDesdeSnap(snap) {
    const data = snap && snap.exists ? (snap.data() || {}) : {};
    return operacionParaLocal(data);
  }

  function operacionTieneDatos(op) {
    if (!op) return false;
    return (op.mesasActivas && op.mesasActivas.length)
      || (op.ordenesCocina && op.ordenesCocina.length)
      || (op.historialCocina && op.historialCocina.length)
      || (op.pedidosCocinaListos && op.pedidosCocinaListos.length)
      || op.contadorDomicilios
      || op.contadorRecoger
      || (op.nombresDomiciliarios && op.nombresDomiciliarios.length);
  }

  async function guardarOperacion(datos) {
    if (!negocioIdActual) await asegurarNegocio();
    const limpio = operacionLimpia(datos || snapshotOperacionLocal());
    escribirOperacionLocal(limpio);
    await refOperacion().set({
      mesasActivas: limpio.mesasActivas,
      ordenesCocina: limpio.ordenesCocina,
      historialCocina: limpio.historialCocina,
      pedidosCocinaListos: limpio.pedidosCocinaListos,
      contadorDomicilios: limpio.contadorDomicilios,
      contadorRecoger: limpio.contadorRecoger,
      ultimaFechaContadores: limpio.ultimaFechaContadores,
      nombresDomiciliarios: limpio.nombresDomiciliarios,
      pantallaCocinaActivada: limpio.pantallaCocinaActivada,
      cocinaSonidoActivado: limpio.cocinaSonidoActivado,
      cocinaIntervaloActualizacion: limpio.cocinaIntervaloActualizacion,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return operacionParaLocal(limpio);
  }

  let operacionTimer = null;
  function persistirOperacionDebounced() {
    if (operacionTimer) clearTimeout(operacionTimer);
    operacionTimer = setTimeout(function () {
      if (!estaListo()) return;
      guardarOperacion(snapshotOperacionLocal()).catch(function (error) {
        console.warn('Operación no se guardó en la nube', error);
      });
    }, 400);
  }

  function persistirOperacionInmediato() {
    if (operacionTimer) {
      clearTimeout(operacionTimer);
      operacionTimer = null;
    }
    if (!estaListo()) return Promise.resolve();
    return guardarOperacion(snapshotOperacionLocal()).catch(function (error) {
      console.warn('Operación no se guardó en la nube', error);
    });
  }

  async function sincronizarOperacion() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotOperacionLocal();
    if (!negocioIdActual) return operacionParaLocal(operacionLimpia(local));
    const snap = await refOperacion().get();
    if (snap.exists) {
      const nube = operacionDesdeSnap(snap);
      escribirOperacionLocal({
        mesasActivas: entradasAObjetos(nube.mesasActivas),
        ordenesCocina: entradasAObjetos(nube.ordenesCocina),
        historialCocina: nube.historialCocina,
        pedidosCocinaListos: nube.pedidosCocinaListos,
        contadorDomicilios: nube.contadorDomicilios,
        contadorRecoger: nube.contadorRecoger,
        ultimaFechaContadores: nube.ultimaFechaContadores,
        nombresDomiciliarios: nube.nombresDomiciliarios,
        pantallaCocinaActivada: nube.pantallaCocinaActivada,
        cocinaSonidoActivado: nube.cocinaSonidoActivado,
        cocinaIntervaloActualizacion: nube.cocinaIntervaloActualizacion
      });
      return nube;
    }
    if (operacionTieneDatos(local) || local.cocinaIntervaloActualizacion) {
      await guardarOperacion(local);
      return operacionParaLocal(operacionLimpia(local));
    }
    return operacionParaLocal(operacionLimpia(local));
  }

  let unsubOperacion = null;
  function escucharOperacion(callback) {
    if (unsubOperacion) {
      unsubOperacion();
      unsubOperacion = null;
    }
    if (!negocioIdActual) return function () {};
    unsubOperacion = refOperacion().onSnapshot(function (snap) {
      if (!snap.exists) return;
      const nube = operacionDesdeSnap(snap);
      escribirOperacionLocal({
        mesasActivas: entradasAObjetos(nube.mesasActivas),
        ordenesCocina: entradasAObjetos(nube.ordenesCocina),
        historialCocina: nube.historialCocina,
        pedidosCocinaListos: nube.pedidosCocinaListos,
        contadorDomicilios: nube.contadorDomicilios,
        contadorRecoger: nube.contadorRecoger,
        ultimaFechaContadores: nube.ultimaFechaContadores,
        nombresDomiciliarios: nube.nombresDomiciliarios,
        pantallaCocinaActivada: nube.pantallaCocinaActivada,
        cocinaSonidoActivado: nube.cocinaSonidoActivado,
        cocinaIntervaloActualizacion: nube.cocinaIntervaloActualizacion
      });
      if (typeof callback === 'function') callback(nube);
    }, function (error) {
      console.warn('No se pudo escuchar la operación en vivo', error);
    });
    return unsubOperacion;
  }

  async function iniciarSesion(email, password) {
    const cred = await auth().signInWithEmailAndPassword(email, password);
    await asegurarNegocio();
    localStorage.setItem('sesionActiva', 'true');
    localStorage.setItem('usuarioActual', 'admin');
    return cred.user;
  }

  async function cerrarSesion() {
    if (unsubCatalogo) {
      unsubCatalogo();
      unsubCatalogo = null;
    }
    if (unsubOperacion) {
      unsubOperacion();
      unsubOperacion = null;
    }
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
    guardarCatalogo: guardarCatalogo,
    obtenerCatalogo: obtenerCatalogo,
    sincronizarCatalogo: sincronizarCatalogo,
    persistirCatalogo: persistirCatalogo,
    escucharCatalogo: escucharCatalogo,
    guardarOperacion: guardarOperacion,
    sincronizarOperacion: sincronizarOperacion,
    persistirOperacionDebounced: persistirOperacionDebounced,
    persistirOperacionInmediato: persistirOperacionInmediato,
    escucharOperacion: escucharOperacion,
    getNegocioId: getNegocioId,
    getUsuario: getUsuario,
    db: db,
    auth: auth,
    mensajeErrorAuth: mensajeErrorAuth
  };
})(window);
