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

  function colVentas() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('ventas');
  }

  function parseListaLocal(clave) {
    try {
      const arr = JSON.parse(localStorage.getItem(clave) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function idDeVenta(venta) {
    if (venta && venta.id != null && venta.id !== '') return String(venta.id);
    return String(Date.now());
  }

  function ventaLimpia(venta) {
    const origen = venta && typeof venta === 'object' ? venta : {};
    const id = idDeVenta(origen);
    const texto = JSON.stringify(Object.assign({}, origen, { id: id }), function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  function fusionarVentasLocales() {
    const mapa = new Map();
    ['historialVentas', 'ventas', 'facturasPendientes', 'domicilios'].forEach(function (clave) {
      parseListaLocal(clave).forEach(function (venta) {
        if (!venta || typeof venta !== 'object') return;
        const id = venta.id != null && venta.id !== ''
          ? String(venta.id)
          : [venta.fecha, venta.mesa, venta.total, venta.metodoPago].join('|');
        if (!id || mapa.has(id)) return;
        mapa.set(id, ventaLimpia(Object.assign({}, venta, { id: venta.id != null ? venta.id : id })));
      });
    });
    return Array.from(mapa.values());
  }

  function escribirVentasLocal(lista) {
    const limpia = Array.isArray(lista) ? lista : [];
    localStorage.setItem('historialVentas', JSON.stringify(limpia));
    localStorage.setItem('ventas', JSON.stringify(limpia));
    const pendientes = limpia.filter(function (v) {
      const metodo = String((v && v.metodoPago) || '').toLowerCase();
      const estado = String((v && v.estado) || '').toLowerCase();
      return metodo === 'credito' || metodo === 'crédito' || estado === 'pendiente';
    });
    localStorage.setItem('facturasPendientes', JSON.stringify(pendientes));
    return limpia;
  }

  async function subirVentasEnLotes(lista) {
    const col = colVentas();
    for (let i = 0; i < lista.length; i += 400) {
      const lote = lista.slice(i, i + 400);
      const batch = db().batch();
      lote.forEach(function (venta) {
        const limpia = ventaLimpia(venta);
        const id = idDeVenta(limpia);
        if (!id) return;
        batch.set(col.doc(id), Object.assign({}, limpia, {
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
      });
      await batch.commit();
    }
  }

  async function guardarVenta(venta) {
    const limpia = ventaLimpia(venta);
    const lista = fusionarVentasLocales();
    const id = idDeVenta(limpia);
    limpia.id = isNaN(Number(id)) ? id : Number(id);
    const idx = lista.findIndex(function (v) { return String(v.id) === String(limpia.id); });
    if (idx >= 0) lista[idx] = limpia;
    else lista.push(limpia);
    escribirVentasLocal(lista);
    if (estaListo()) {
      await colVentas().doc(String(limpia.id)).set(Object.assign({}, limpia, {
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }), { merge: true });
    }
    return limpia;
  }

  async function sincronizarVentas() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = fusionarVentasLocales();
    if (!negocioIdActual) {
      escribirVentasLocal(local);
      return local;
    }
    const snap = await colVentas().get();
    const nube = [];
    snap.forEach(function (doc) {
      const data = doc.data() || {};
      delete data.actualizadoEn;
      nube.push(ventaLimpia(data));
    });
    if (nube.length === 0 && local.length) {
      await subirVentasEnLotes(local);
      escribirVentasLocal(local);
      return local;
    }
    const mapa = new Map();
    nube.forEach(function (v) { mapa.set(String(v.id), v); });
    const faltan = [];
    local.forEach(function (v) {
      const id = String(v.id);
      if (!mapa.has(id)) {
        mapa.set(id, v);
        faltan.push(v);
      }
    });
    if (faltan.length) await subirVentasEnLotes(faltan);
    const merged = Array.from(mapa.values());
    escribirVentasLocal(merged);
    return merged;
  }

  let unsubVentas = null;
  function escucharVentas(callback) {
    if (unsubVentas) {
      unsubVentas();
      unsubVentas = null;
    }
    if (!negocioIdActual) return function () {};
    unsubVentas = colVentas().onSnapshot(function (snap) {
      const lista = [];
      snap.forEach(function (doc) {
        const data = doc.data() || {};
        delete data.actualizadoEn;
        lista.push(ventaLimpia(data));
      });
      escribirVentasLocal(lista);
      if (typeof callback === 'function') callback(lista);
    }, function (error) {
      console.warn('No se pudo escuchar las ventas', error);
    });
    return unsubVentas;
  }

  function objetoLimpio(obj) {
    const origen = obj && typeof obj === 'object' ? obj : {};
    const id = origen.id != null && origen.id !== '' ? origen.id : Date.now();
    const texto = JSON.stringify(Object.assign({}, origen, { id: id }), function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  function fusionarListasLocales(claves) {
    const mapa = new Map();
    (claves || []).forEach(function (clave) {
      parseListaLocal(clave).forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        const id = item.id != null && item.id !== ''
          ? String(item.id)
          : [item.fecha, item.descripcion, item.monto, item.nombreCierre].join('|');
        if (!id || mapa.has(id)) return;
        mapa.set(id, objetoLimpio(Object.assign({}, item, { id: item.id != null ? item.id : id })));
      });
    });
    return Array.from(mapa.values());
  }

  function colNegocio(nombre) {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection(nombre);
  }

  async function subirListaEnLotes(nombreCol, lista) {
    const col = colNegocio(nombreCol);
    for (let i = 0; i < lista.length; i += 400) {
      const lote = lista.slice(i, i + 400);
      const batch = db().batch();
      lote.forEach(function (item) {
        const limpio = objetoLimpio(item);
        const id = String(limpio.id);
        if (!id) return;
        batch.set(col.doc(id), Object.assign({}, limpio, {
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
      });
      await batch.commit();
    }
  }

  async function guardarDocLista(nombreCol, clavesLocal, item, escribirLocal) {
    const limpio = objetoLimpio(item);
    const lista = fusionarListasLocales(clavesLocal);
    const idx = lista.findIndex(function (v) { return String(v.id) === String(limpio.id); });
    if (idx >= 0) lista[idx] = limpio;
    else lista.push(limpio);
    escribirLocal(lista);
    if (estaListo()) {
      await colNegocio(nombreCol).doc(String(limpio.id)).set(Object.assign({}, limpio, {
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }), { merge: true });
    }
    return limpio;
  }

  async function sincronizarLista(nombreCol, clavesLocal, escribirLocal) {
    if (!negocioIdActual) await asegurarNegocio();
    const local = fusionarListasLocales(clavesLocal);
    if (!negocioIdActual) {
      escribirLocal(local);
      return local;
    }
    const snap = await colNegocio(nombreCol).get();
    const nube = [];
    snap.forEach(function (doc) {
      const data = doc.data() || {};
      delete data.actualizadoEn;
      nube.push(objetoLimpio(data));
    });
    if (nube.length === 0 && local.length) {
      await subirListaEnLotes(nombreCol, local);
      escribirLocal(local);
      return local;
    }
    const mapa = new Map();
    nube.forEach(function (v) { mapa.set(String(v.id), v); });
    const faltan = [];
    local.forEach(function (v) {
      const id = String(v.id);
      if (!mapa.has(id)) {
        mapa.set(id, v);
        faltan.push(v);
      }
    });
    if (faltan.length) await subirListaEnLotes(nombreCol, faltan);
    const merged = Array.from(mapa.values());
    escribirLocal(merged);
    return merged;
  }

  function escribirGastosLocal(lista) {
    const limpia = Array.isArray(lista) ? lista : [];
    localStorage.setItem('historialGastos', JSON.stringify(limpia));
    localStorage.setItem('gastos', JSON.stringify(limpia));
    return limpia;
  }
  function escribirCierresLocal(lista) {
    localStorage.setItem('historialCierres', JSON.stringify(Array.isArray(lista) ? lista : []));
    return lista;
  }
  function escribirCierresOperativosLocal(lista) {
    localStorage.setItem('historialCierresOperativos', JSON.stringify(Array.isArray(lista) ? lista : []));
    return lista;
  }

  function snapshotConfigCajaLocal() {
    return {
      ultimaHoraCierre: localStorage.getItem('ultimaHoraCierre') || '',
      ultimaBaseCaja: localStorage.getItem('ultimaBaseCaja') || '',
      operarDespuesMedianoche: localStorage.getItem('operarDespuesMedianoche') === 'true',
      horaFinDiaLaboral: localStorage.getItem('horaFinDiaLaboral') || '4'
    };
  }

  function escribirConfigCajaLocal(datos) {
    const cfg = datos || {};
    if (cfg.ultimaHoraCierre) localStorage.setItem('ultimaHoraCierre', cfg.ultimaHoraCierre);
    if (cfg.ultimaBaseCaja != null && cfg.ultimaBaseCaja !== '') {
      localStorage.setItem('ultimaBaseCaja', String(cfg.ultimaBaseCaja));
    }
    localStorage.setItem('operarDespuesMedianoche', cfg.operarDespuesMedianoche ? 'true' : 'false');
    localStorage.setItem('horaFinDiaLaboral', String(cfg.horaFinDiaLaboral || '4'));
    return cfg;
  }

  function refConfigCaja() {
    return colNegocio('config').doc('caja');
  }

  async function persistirConfigCaja() {
    const cfg = snapshotConfigCajaLocal();
    if (!estaListo()) return cfg;
    await refConfigCaja().set(Object.assign({}, cfg, {
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }), { merge: true });
    return cfg;
  }

  async function sincronizarConfigCaja() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotConfigCajaLocal();
    if (!negocioIdActual) return local;
    const snap = await refConfigCaja().get();
    if (!snap.exists) {
      if (local.ultimaHoraCierre || local.ultimaBaseCaja || local.operarDespuesMedianoche) {
        await persistirConfigCaja();
      }
      return local;
    }
    const data = snap.data() || {};
    delete data.actualizadoEn;
    escribirConfigCajaLocal(data);
    return snapshotConfigCajaLocal();
  }

  function guardarGasto(gasto) {
    return guardarDocLista('gastos', ['historialGastos', 'gastos'], gasto, escribirGastosLocal);
  }
  function guardarCierre(cierre) {
    return guardarDocLista('cierres', ['historialCierres'], cierre, escribirCierresLocal);
  }
  function guardarCierreOperativo(cierre) {
    return guardarDocLista('cierresOperativos', ['historialCierresOperativos'], cierre, escribirCierresOperativosLocal);
  }

  async function eliminarGastoNube(id) {
    const lista = fusionarListasLocales(['historialGastos', 'gastos']).filter(function (g) {
      return String(g.id) !== String(id);
    });
    escribirGastosLocal(lista);
    if (estaListo() && id != null) {
      await colNegocio('gastos').doc(String(id)).delete();
    }
    return lista;
  }

  async function sincronizarFinanzas() {
    const gastos = await sincronizarLista('gastos', ['historialGastos', 'gastos'], escribirGastosLocal);
    const cierres = await sincronizarLista('cierres', ['historialCierres'], escribirCierresLocal);
    const cierresOperativos = await sincronizarLista('cierresOperativos', ['historialCierresOperativos'], escribirCierresOperativosLocal);
    const configCaja = await sincronizarConfigCaja();
    return { gastos: gastos, cierres: cierres, cierresOperativos: cierresOperativos, configCaja: configCaja };
  }

  let unsubGastos = null;
  let unsubCierres = null;
  let unsubCierresOp = null;
  let unsubConfigCaja = null;

  function escucharColeccion(unsubRefNombre, nombreCol, escribirLocal, callback) {
    return colNegocio(nombreCol).onSnapshot(function (snap) {
      const lista = [];
      snap.forEach(function (doc) {
        const data = doc.data() || {};
        delete data.actualizadoEn;
        lista.push(objetoLimpio(data));
      });
      escribirLocal(lista);
      if (typeof callback === 'function') callback(lista);
    }, function (error) {
      console.warn('No se pudo escuchar ' + nombreCol, error);
    });
  }

  function escucharFinanzas(callbacks) {
    const cb = callbacks || {};
    if (unsubGastos) unsubGastos();
    if (unsubCierres) unsubCierres();
    if (unsubCierresOp) unsubCierresOp();
    if (unsubConfigCaja) unsubConfigCaja();
    unsubGastos = unsubCierres = unsubCierresOp = unsubConfigCaja = null;
    if (!negocioIdActual) return;
    unsubGastos = escucharColeccion('gastos', 'gastos', escribirGastosLocal, cb.gastos);
    unsubCierres = escucharColeccion('cierres', 'cierres', escribirCierresLocal, cb.cierres);
    unsubCierresOp = escucharColeccion('cierresOperativos', 'cierresOperativos', escribirCierresOperativosLocal, cb.cierresOperativos);
    unsubConfigCaja = refConfigCaja().onSnapshot(function (snap) {
      if (!snap.exists) return;
      const data = snap.data() || {};
      delete data.actualizadoEn;
      escribirConfigCajaLocal(data);
      if (typeof cb.configCaja === 'function') cb.configCaja(snapshotConfigCajaLocal());
    }, function (error) {
      console.warn('No se pudo escuchar config de caja', error);
    });
  }

  function refInventario() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('inventario').doc('actual');
  }

  function inventarioDesdeLocal() {
    try {
      const lista = JSON.parse(localStorage.getItem('inventario') || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  }

  function escribirInventarioLocal(lista) {
    const limpia = Array.isArray(lista) ? lista : [];
    localStorage.setItem('inventario', JSON.stringify(limpia));
    return limpia;
  }

  function inventarioLimpio(lista) {
    const texto = JSON.stringify(Array.isArray(lista) ? lista : [], function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  async function guardarInventarioNube(lista) {
    if (!negocioIdActual) await asegurarNegocio();
    const limpio = inventarioLimpio(lista != null ? lista : inventarioDesdeLocal());
    escribirInventarioLocal(limpio);
    if (!negocioIdActual) return limpio;
    await refInventario().set({
      items: limpio,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return limpio;
  }

  let inventarioTimer = null;
  function persistirInventarioDebounced() {
    if (inventarioTimer) clearTimeout(inventarioTimer);
    inventarioTimer = setTimeout(function () {
      if (!estaListo()) return;
      guardarInventarioNube(inventarioDesdeLocal()).catch(function (error) {
        console.warn('Inventario no se guardó en la nube', error);
      });
    }, 400);
  }

  function persistirInventarioInmediato() {
    if (inventarioTimer) {
      clearTimeout(inventarioTimer);
      inventarioTimer = null;
    }
    if (!estaListo()) return Promise.resolve(inventarioDesdeLocal());
    return guardarInventarioNube(inventarioDesdeLocal()).catch(function (error) {
      console.warn('Inventario no se guardó en la nube', error);
    });
  }

  async function sincronizarInventario() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = inventarioDesdeLocal();
    if (!negocioIdActual) return inventarioLimpio(local);
    const snap = await refInventario().get();
    if (snap.exists) {
      const data = snap.data() || {};
      const nube = inventarioLimpio(data.items);
      escribirInventarioLocal(nube);
      return nube;
    }
    if (local.length) {
      await guardarInventarioNube(local);
      return inventarioLimpio(local);
    }
    return [];
  }

  let unsubInventario = null;
  function escucharInventario(callback) {
    if (unsubInventario) {
      unsubInventario();
      unsubInventario = null;
    }
    if (!negocioIdActual) return function () {};
    unsubInventario = refInventario().onSnapshot(function (snap) {
      if (!snap.exists) return;
      const data = snap.data() || {};
      const nube = inventarioLimpio(data.items);
      escribirInventarioLocal(nube);
      if (typeof callback === 'function') callback(nube);
    }, function (error) {
      console.warn('No se pudo escuchar el inventario', error);
    });
    return unsubInventario;
  }

  function refDatos() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('datos').doc('actual');
  }

  function refExtras() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('config').doc('extras');
  }

  function snapshotDatosLocal() {
    return {
      clientes: parseListaLocal('clientes'),
      recordatorios: parseListaLocal('recordatorios'),
      cotizaciones: parseListaLocal('cotizaciones')
    };
  }

  function escribirDatosLocal(datos) {
    const d = datos || {};
    const clientes = Array.isArray(d.clientes) ? d.clientes : [];
    const recordatorios = Array.isArray(d.recordatorios) ? d.recordatorios : [];
    const cotizaciones = Array.isArray(d.cotizaciones) ? d.cotizaciones : [];
    localStorage.setItem('clientes', JSON.stringify(clientes));
    localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    localStorage.setItem('recordatoriosActivos', JSON.stringify(recordatorios.filter(function (r) {
      return r && r.activo !== false && !r.completado;
    })));
    localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));
    return { clientes: clientes, recordatorios: recordatorios, cotizaciones: cotizaciones };
  }

  function datosLimpios(datos) {
    const origen = datos || snapshotDatosLocal();
    const texto = JSON.stringify({
      clientes: Array.isArray(origen.clientes) ? origen.clientes : [],
      recordatorios: Array.isArray(origen.recordatorios) ? origen.recordatorios : [],
      cotizaciones: Array.isArray(origen.cotizaciones) ? origen.cotizaciones : []
    }, function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  async function guardarDatosNube(datos) {
    if (!negocioIdActual) await asegurarNegocio();
    const limpio = datosLimpios(datos);
    escribirDatosLocal(limpio);
    if (!negocioIdActual) return limpio;
    await refDatos().set(Object.assign({}, limpio, {
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }), { merge: true });
    return limpio;
  }

  let datosTimer = null;
  function persistirDatosDebounced() {
    if (datosTimer) clearTimeout(datosTimer);
    datosTimer = setTimeout(function () {
      if (!estaListo()) return;
      guardarDatosNube(snapshotDatosLocal()).catch(function (error) {
        console.warn('Clientes, recordatorios o cotizaciones no se guardaron en la nube', error);
      });
    }, 400);
  }

  async function sincronizarDatos() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotDatosLocal();
    if (!negocioIdActual) return datosLimpios(local);
    const snap = await refDatos().get();
    if (snap.exists) {
      const data = snap.data() || {};
      delete data.actualizadoEn;
      const nube = datosLimpios(data);
      escribirDatosLocal(nube);
      return nube;
    }
    if (local.clientes.length || local.recordatorios.length || local.cotizaciones.length) {
      await guardarDatosNube(local);
      return datosLimpios(local);
    }
    return datosLimpios(local);
  }

  let unsubDatos = null;
  function escucharDatos(callback) {
    if (unsubDatos) {
      unsubDatos();
      unsubDatos = null;
    }
    if (!negocioIdActual) return function () {};
    unsubDatos = refDatos().onSnapshot(function (snap) {
      if (!snap.exists) return;
      const data = snap.data() || {};
      delete data.actualizadoEn;
      const nube = datosLimpios(data);
      escribirDatosLocal(nube);
      if (typeof callback === 'function') callback(nube);
    }, function (error) {
      console.warn('No se pudieron escuchar clientes/recordatorios/cotizaciones', error);
    });
    return unsubDatos;
  }

  function snapshotExtrasLocal() {
    return {
      logoNegocio: localStorage.getItem('logoNegocio') || '',
      configuracionEmailJS: parseJsonLocal('configuracionEmailJS', {}),
      configuracionEmail: parseJsonLocal('configuracionEmail', {})
    };
  }

  function escribirExtrasLocal(datos) {
    const e = datos || {};
    if (e.logoNegocio) localStorage.setItem('logoNegocio', e.logoNegocio);
    else if (e.logoNegocio === '') localStorage.removeItem('logoNegocio');
    if (e.configuracionEmailJS && typeof e.configuracionEmailJS === 'object') {
      localStorage.setItem('configuracionEmailJS', JSON.stringify(e.configuracionEmailJS));
    }
    if (e.configuracionEmail && typeof e.configuracionEmail === 'object') {
      localStorage.setItem('configuracionEmail', JSON.stringify(e.configuracionEmail));
    }
    return snapshotExtrasLocal();
  }

  async function persistirExtras() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotExtrasLocal();
    if (!estaListo() || !negocioIdActual) return local;
    const payload = {
      configuracionEmailJS: local.configuracionEmailJS || {},
      configuracionEmail: local.configuracionEmail || {},
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (local.logoNegocio && local.logoNegocio.length <= 700000) {
      payload.logoNegocio = local.logoNegocio;
    } else if (!local.logoNegocio) {
      payload.logoNegocio = '';
    } else {
      console.warn('El logo es demasiado grande para Firestore; se queda en este equipo');
    }
    await refExtras().set(payload, { merge: true });
    return local;
  }

  async function sincronizarExtras() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotExtrasLocal();
    if (!negocioIdActual) return local;
    const snap = await refExtras().get();
    if (snap.exists) {
      const data = snap.data() || {};
      delete data.actualizadoEn;
      escribirExtrasLocal(data);
      return snapshotExtrasLocal();
    }
    if (local.logoNegocio || (local.configuracionEmailJS && local.configuracionEmailJS.emailDestino)) {
      await persistirExtras();
    }
    return local;
  }

  let unsubExtras = null;
  function escucharExtras(callback) {
    if (unsubExtras) {
      unsubExtras();
      unsubExtras = null;
    }
    if (!negocioIdActual) return function () {};
    unsubExtras = refExtras().onSnapshot(function (snap) {
      if (!snap.exists) return;
      const data = snap.data() || {};
      delete data.actualizadoEn;
      escribirExtrasLocal(data);
      if (typeof callback === 'function') callback(snapshotExtrasLocal());
    }, function (error) {
      console.warn('No se pudo escuchar logo/email', error);
    });
    return unsubExtras;
  }

  async function sincronizarResto() {
    const datos = await sincronizarDatos();
    const extras = await sincronizarExtras();
    return { datos: datos, extras: extras };
  }

  const PIN_MODULOS = [
    { id: 'administracion', etiqueta: 'Administración', clave: 'pinAdministracionHash', defecto: '0011', legado: null },
    { id: 'inventario', etiqueta: 'Inventario', clave: 'pinInventarioHash', defecto: '1234', legado: 'pinEmpleadoHash' },
    { id: 'historial', etiqueta: 'Historial', clave: 'pinHistorialHash', defecto: '1234', legado: 'pinEmpleadoHash' },
    { id: 'gastos', etiqueta: 'Gastos', clave: 'pinGastosHash', defecto: '1234', legado: 'pinEmpleadoHash' },
    { id: 'cierre-administrativo', etiqueta: 'Cierre administrativo', clave: 'pinCierreHash', defecto: '7894', legado: 'pinAdminHash' },
    { id: 'balance', etiqueta: 'Balance', clave: 'pinBalanceHash', defecto: '7894', legado: 'pinAdminHash' }
  ];

  function refRoles() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('config').doc('roles');
  }

  async function hashPin(pin) {
    const texto = 'toysoft-pin-v1:' + String(pin || '');
    if (global.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    }
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h) + texto.charCodeAt(i);
    return 'x' + (h >>> 0).toString(16);
  }

  function leerPinesLocal() {
    const out = {};
    try {
      const bruto = JSON.parse(localStorage.getItem('pinesModulos') || '{}');
      if (bruto && typeof bruto === 'object') Object.assign(out, bruto);
    } catch (e) {}
    PIN_MODULOS.forEach(function (mod) {
      const hash = localStorage.getItem(mod.clave);
      if (hash) out[mod.id] = hash;
      if (!out[mod.id] && mod.legado) {
        const viejo = localStorage.getItem(mod.legado);
        if (viejo) out[mod.id] = viejo;
      }
    });
    return out;
  }

  function escribirRolesLocal(datos) {
    const actual = leerPinesLocal();
    const mezclado = Object.assign({}, actual, datos || {});
    PIN_MODULOS.forEach(function (mod) {
      if (datos && datos[mod.clave]) mezclado[mod.id] = datos[mod.clave];
      if (datos && datos[mod.id]) mezclado[mod.id] = datos[mod.id];
    });
    if (datos && datos.pinAdminHash) {
      if (!mezclado.balance) mezclado.balance = datos.pinAdminHash;
      if (!mezclado['cierre-administrativo']) mezclado['cierre-administrativo'] = datos.pinAdminHash;
    }
    if (datos && datos.pinEmpleadoHash) {
      if (!mezclado.inventario) mezclado.inventario = datos.pinEmpleadoHash;
      if (!mezclado.historial) mezclado.historial = datos.pinEmpleadoHash;
      if (!mezclado.gastos) mezclado.gastos = datos.pinEmpleadoHash;
    }
    if (datos && datos.pinAdministracionHash) mezclado.administracion = datos.pinAdministracionHash;
    localStorage.setItem('pinesModulos', JSON.stringify(mezclado));
    PIN_MODULOS.forEach(function (mod) {
      if (mezclado[mod.id]) localStorage.setItem(mod.clave, mezclado[mod.id]);
    });
    return mezclado;
  }

  async function hashesPorDefecto() {
    const out = {};
    for (let i = 0; i < PIN_MODULOS.length; i++) {
      const mod = PIN_MODULOS[i];
      out[mod.id] = await hashPin(mod.defecto);
    }
    return out;
  }

  async function hashesEfectivos() {
    const local = leerPinesLocal();
    const defs = await hashesPorDefecto();
    const out = {};
    PIN_MODULOS.forEach(function (mod) {
      out[mod.id] = local[mod.id] || defs[mod.id];
    });
    return out;
  }

  async function persistirRoles(hashes) {
    if (!negocioIdActual) await asegurarNegocio();
    const actuales = await hashesEfectivos();
    const payload = Object.assign({}, actuales, hashes || {});
    const limpio = {};
    PIN_MODULOS.forEach(function (mod) {
      if (payload[mod.id]) limpio[mod.id] = payload[mod.id];
      else if (payload[mod.clave]) limpio[mod.id] = payload[mod.clave];
    });
    escribirRolesLocal(limpio);
    if (!estaListo() || !negocioIdActual) return limpio;
    await refRoles().set(Object.assign({}, limpio, {
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }), { merge: true });
    return limpio;
  }

  async function persistirPinModulo(moduloId, pin) {
    const hash = await hashPin(String(pin || '').trim());
    const par = {};
    par[moduloId] = hash;
    return persistirRoles(par);
  }

  async function sincronizarRoles() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = leerPinesLocal();
    if (!negocioIdActual) return hashesEfectivos();
    const snap = await refRoles().get();
    if (snap.exists) {
      const data = snap.data() || {};
      delete data.actualizadoEn;
      escribirRolesLocal(data);
      return leerPinesLocal();
    }
    const iniciales = Object.keys(local).length ? local : await hashesPorDefecto();
    await persistirRoles(iniciales);
    return leerPinesLocal();
  }

  async function pinCorrecto(moduloId, pin) {
    const h = await hashPin(String(pin || '').trim());
    const hashes = await hashesEfectivos();
    return !!(h && hashes[moduloId] && h === hashes[moduloId]);
  }

  async function rolDesdePin(pin) {
    if (await pinCorrecto('cierre-administrativo', pin) || await pinCorrecto('balance', pin)) return 'admin';
    if (await pinCorrecto('inventario', pin) || await pinCorrecto('historial', pin) || await pinCorrecto('gastos', pin)) {
      return 'empleado';
    }
    return null;
  }

  async function esPinAdministracion(pin) {
    return pinCorrecto('administracion', pin);
  }

  function listarModulosPin() {
    return PIN_MODULOS.map(function (m) {
      return { id: m.id, etiqueta: m.etiqueta };
    });
  }

  async function iniciarSesion(email, password) {
    const cred = await auth().signInWithEmailAndPassword(email, password);
    await asegurarNegocio();
    localStorage.setItem('sesionActiva', 'true');
    try {
      await sincronizarRoles();
    } catch (e) {
      console.warn('No se pudieron sincronizar los PIN', e);
    }
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
    if (unsubVentas) {
      unsubVentas();
      unsubVentas = null;
    }
    if (unsubGastos) { unsubGastos(); unsubGastos = null; }
    if (unsubCierres) { unsubCierres(); unsubCierres = null; }
    if (unsubCierresOp) { unsubCierresOp(); unsubCierresOp = null; }
    if (unsubConfigCaja) { unsubConfigCaja(); unsubConfigCaja = null; }
    if (unsubInventario) { unsubInventario(); unsubInventario = null; }
    if (unsubDatos) { unsubDatos(); unsubDatos = null; }
    if (unsubExtras) { unsubExtras(); unsubExtras = null; }
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
    guardarVenta: guardarVenta,
    sincronizarVentas: sincronizarVentas,
    escucharVentas: escucharVentas,
    ventasDesdeLocal: fusionarVentasLocales,
    guardarGasto: guardarGasto,
    eliminarGastoNube: eliminarGastoNube,
    gastosDesdeLocal: function () { return fusionarListasLocales(['historialGastos', 'gastos']); },
    guardarCierre: guardarCierre,
    guardarCierreOperativo: guardarCierreOperativo,
    persistirConfigCaja: persistirConfigCaja,
    sincronizarFinanzas: sincronizarFinanzas,
    escucharFinanzas: escucharFinanzas,
    cierresDesdeLocal: function () { return fusionarListasLocales(['historialCierres']); },
    cierresOperativosDesdeLocal: function () { return fusionarListasLocales(['historialCierresOperativos']); },
    guardarInventarioNube: guardarInventarioNube,
    persistirInventarioDebounced: persistirInventarioDebounced,
    persistirInventarioInmediato: persistirInventarioInmediato,
    sincronizarInventario: sincronizarInventario,
    escucharInventario: escucharInventario,
    inventarioDesdeLocal: inventarioDesdeLocal,
    persistirDatosDebounced: persistirDatosDebounced,
    sincronizarDatos: sincronizarDatos,
    escucharDatos: escucharDatos,
    persistirExtras: persistirExtras,
    sincronizarExtras: sincronizarExtras,
    escucharExtras: escucharExtras,
    sincronizarResto: sincronizarResto,
    hashPin: hashPin,
    pinCorrecto: pinCorrecto,
    persistirPinModulo: persistirPinModulo,
    listarModulosPin: listarModulosPin,
    rolDesdePin: rolDesdePin,
    esPinAdministracion: esPinAdministracion,
    sincronizarRoles: sincronizarRoles,
    persistirRoles: persistirRoles,
    getNegocioId: getNegocioId,
    getUsuario: getUsuario,
    db: db,
    auth: auth,
    mensajeErrorAuth: mensajeErrorAuth
  };
})(window);
