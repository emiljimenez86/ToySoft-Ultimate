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
  let codigoEquipoPendiente = '';
  let nombreMeseroPendiente = '';
  const esperandoAuth = [];
  const STORAGE_NEGOCIO_ID = 'toysoftNegocioId';
  const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const CLAVES_CACHE_NEGOCIO = [
    'datosNegocio', 'nombreNegocio', 'categorias', 'productos', 'mesasActivas',
    'ordenesCocina', 'historialCocina', 'pedidosCocinaListos', 'contadorDomicilios',
    'contadorRecoger', 'ultimaFechaContadores', 'nombresDomiciliarios',
    'historialVentas', 'ventas', 'facturasPendientes', 'historialGastos', 'gastos',
    'historialCierres', 'historialCierresOperativos', 'inventario', 'clientes',
    'recordatorios', 'recordatoriosActivos', 'cotizaciones', 'logoNegocio'
  ];

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

  function getRol() {
    if (!usuarioDoc) return '';
    return usuarioDoc.rol || 'admin';
  }

  function cuentaActiva() {
    if (!usuarioDoc) return false;
    return usuarioDoc.activo !== false;
  }

  function esAdminNegocio() {
    return cuentaActiva() && getRol() === 'admin';
  }

  function esMesero() {
    return cuentaActiva() && getRol() === 'mesero';
  }

  function nombreMeseroActual() {
    const u = usuarioDoc || {};
    return String(u.nombre || '').trim();
  }

  async function guardarNombreUsuario(nombre) {
    const user = auth().currentUser;
    if (!user) throw new Error('No hay sesión');
    const limpio = String(nombre || '').trim();
    if (!limpio) throw new Error('Escribe el nombre del mesero.');
    await db().collection('usuarios').doc(user.uid).set({ nombre: limpio }, { merge: true });
    if (!usuarioDoc) usuarioDoc = {};
    usuarioDoc.nombre = limpio;
    try {
      await user.updateProfile({ displayName: limpio });
    } catch (e) {}
    return limpio;
  }

  function normalizarCodigoEquipo(valor) {
    return String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function marcarCodigoPendiente(valor) {
    codigoEquipoPendiente = normalizarCodigoEquipo(valor);
    return codigoEquipoPendiente;
  }

  function generarCodigoEquipo() {
    let codigo = '';
    for (let i = 0; i < 8; i++) {
      codigo += ALFABETO_CODIGO.charAt(Math.floor(Math.random() * ALFABETO_CODIGO.length));
    }
    return codigo;
  }

  function refCodigoEquipo(codigo) {
    return db().collection('codigosEquipo').doc(codigo);
  }

  function aislarCacheSiCambioNegocio(negocioId) {
    if (!negocioId) return;
    const anterior = localStorage.getItem(STORAGE_NEGOCIO_ID) || '';
    if (anterior && anterior !== negocioId) {
      CLAVES_CACHE_NEGOCIO.forEach(function (clave) {
        localStorage.removeItem(clave);
      });
    }
    localStorage.setItem(STORAGE_NEGOCIO_ID, negocioId);
  }

  async function buscarNegocioPorCodigo(codigo) {
    const limpio = normalizarCodigoEquipo(codigo);
    if (limpio.length < 6) throw new Error('El código de equipo no es válido.');
    const snap = await refCodigoEquipo(limpio).get();
    if (!snap.exists) throw new Error('Ese código no existe. Pídelo de nuevo en Administración.');
    const negocioId = snap.data().negocioId;
    if (!negocioId) throw new Error('Ese código ya no está activo.');
    return { codigo: limpio, negocioId: negocioId };
  }

  async function unirseANegocioConCodigo(user, codigo) {
    const hallado = await buscarNegocioPorCodigo(codigo);
    const nombre = String((nombreMeseroPendiente || user.displayName || '')).trim();
    const userRef = db().collection('usuarios').doc(user.uid);
    usuarioDoc = {
      email: user.email || '',
      rol: 'mesero',
      negocioId: hallado.negocioId,
      nombre: nombre,
      codigoUsado: hallado.codigo,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    await userRef.set(usuarioDoc);
    negocioIdActual = hallado.negocioId;
    if (nombre) {
      try { await user.updateProfile({ displayName: nombre }); } catch (e) {}
    }
    return usuarioDoc;
  }

  async function asegurarCodigoEquipo() {
    if (!negocioIdActual) await asegurarNegocio();
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    const negRef = db().collection('negocios').doc(negocioIdActual);
    const negSnap = await negRef.get();
    const actual = negSnap.exists ? normalizarCodigoEquipo(negSnap.data().codigoEquipo) : '';
    if (actual) {
      const lookup = await refCodigoEquipo(actual).get();
      if (lookup.exists && lookup.data().negocioId === negocioIdActual) return actual;
    }
    let codigo = '';
    for (let i = 0; i < 8; i++) {
      codigo = generarCodigoEquipo();
      const existe = await refCodigoEquipo(codigo).get();
      if (!existe.exists) break;
    }
    await refCodigoEquipo(codigo).set({
      negocioId: negocioIdActual,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    await negRef.set({ codigoEquipo: codigo }, { merge: true });
    return codigo;
  }

  async function obtenerCodigoEquipo() {
    return asegurarCodigoEquipo();
  }

  async function regenerarCodigoEquipo() {
    if (!esAdminNegocio()) throw new Error('Solo el dueño puede cambiar el código de equipo.');
    if (!negocioIdActual) await asegurarNegocio();
    const negRef = db().collection('negocios').doc(negocioIdActual);
    const negSnap = await negRef.get();
    const anterior = negSnap.exists ? normalizarCodigoEquipo(negSnap.data().codigoEquipo) : '';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
      codigo = generarCodigoEquipo();
      if (codigo === anterior) continue;
      const existe = await refCodigoEquipo(codigo).get();
      if (!existe.exists) break;
    }
    const batch = db().batch();
    if (anterior) batch.delete(refCodigoEquipo(anterior));
    batch.set(refCodigoEquipo(codigo), {
      negocioId: negocioIdActual,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.set(negRef, { codigoEquipo: codigo }, { merge: true });
    await batch.commit();
    return codigo;
  }

  async function listarUsuariosNegocio(incluirInactivos) {
    if (!negocioIdActual) await asegurarNegocio();
    if (!negocioIdActual) return [];
    const snap = await db().collection('usuarios').where('negocioId', '==', negocioIdActual).get();
    return snap.docs.map(function (doc) {
      const data = doc.data() || {};
      return {
        uid: doc.id,
        email: data.email || '',
        rol: data.rol || 'admin',
        nombre: data.nombre || '',
        activo: data.activo !== false
      };
    }).filter(function (u) {
      return incluirInactivos || u.activo;
    });
  }

  function normalizarCorreo(valor) {
    return String(valor || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
  }

  function normalizarClave(valor) {
    return String(valor || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  function errorDesdeIdentityToolkit(data) {
    const msg = String((data && data.error && (data.error.message || data.error.status)) || '');
    const err = new Error(msg || 'Error de autenticación');
    if (/EMAIL_EXISTS/i.test(msg)) err.code = 'auth/email-already-in-use';
    else if (/EMAIL_NOT_FOUND/i.test(msg)) err.code = 'auth/user-not-found';
    else if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|INVALID_AUTH/i.test(msg)) err.code = 'auth/invalid-credential';
    else if (/WEAK_PASSWORD/i.test(msg)) err.code = 'auth/weak-password';
    else if (/INVALID_EMAIL/i.test(msg)) err.code = 'auth/invalid-email';
    else if (/TOO_MANY_ATTEMPTS/i.test(msg)) err.code = 'auth/too-many-requests';
    else if (/USER_DISABLED/i.test(msg)) err.code = 'auth/user-disabled';
    else if (/OPERATION_NOT_ALLOWED/i.test(msg)) err.code = 'auth/operation-not-allowed';
    return err;
  }

  async function llamarIdentityToolkit(ruta, cuerpo) {
    const cfg = obtenerConfig();
    if (!cfg || !cfg.apiKey) throw new Error('Falta la configuración de Firebase.');
    const res = await fetch('https://identitytoolkit.googleapis.com/v1/' + ruta + '?key=' + encodeURIComponent(cfg.apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    const data = await res.json();
    if (data && data.error) throw errorDesdeIdentityToolkit(data);
    return data;
  }

  async function crearORecuperarAuthMesero(correo, clave, nombre) {
    try {
      const creado = await llamarIdentityToolkit('accounts:signUp', {
        email: correo,
        password: clave,
        displayName: nombre || '',
        returnSecureToken: true
      });
      if (!creado || !creado.localId) throw new Error('No se pudo crear la cuenta del mesero.');
      return creado.localId;
    } catch (error) {
      if (!error || error.code !== 'auth/email-already-in-use') throw error;
      try {
        const entra = await llamarIdentityToolkit('accounts:signInWithPassword', {
          email: correo,
          password: clave,
          returnSecureToken: true
        });
        if (!entra || !entra.localId) {
          throw new Error('Ese correo ya tiene una cuenta. Usa otro correo o la contraseña anterior.');
        }
        if (nombre && entra.idToken) {
          try {
            await llamarIdentityToolkit('accounts:update', {
              idToken: entra.idToken,
              displayName: nombre,
              returnSecureToken: false
            });
          } catch (e) {}
        }
        return entra.localId;
      } catch (e2) {
        if (e2 && (e2.code === 'auth/invalid-credential' || e2.code === 'auth/wrong-password' || e2.code === 'auth/user-not-found')) {
          throw new Error('Ese correo ya tiene una cuenta. Usa otro correo o la contraseña anterior.');
        }
        throw e2;
      }
    }
  }

  async function crearCuentaMesero(nombre, email, password) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede crear meseros.');
    if (!negocioIdActual) await asegurarNegocio();
    const nombreLimpio = String(nombre || '').trim();
    const correo = normalizarCorreo(email);
    const clave = normalizarClave(password);
    if (!nombreLimpio) throw new Error('Escribe el nombre del mesero.');
    if (!correo) throw new Error('Escribe el correo del mesero.');
    if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (!auth().currentUser) throw new Error('Se perdió la sesión del administrador. Vuelve a entrar.');

    const actuales = await listarUsuariosNegocio(true);
    const mismo = actuales.filter(function (u) {
      return normalizarCorreo(u.email) === correo;
    })[0];
    if (mismo && mismo.rol === 'admin') {
      throw new Error('Ese correo es del administrador.');
    }

    const uid = await crearORecuperarAuthMesero(correo, clave, nombreLimpio);
    if (!uid) throw new Error('No se pudo crear la cuenta del mesero.');
    if (!auth().currentUser) throw new Error('Se perdió la sesión del administrador. Vuelve a entrar e intenta de nuevo.');

    if (mismo && mismo.uid && mismo.uid !== uid) {
      try {
        await db().collection('usuarios').doc(mismo.uid).set({
          activo: false,
          eliminadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {}
    }

    try {
      await db().collection('usuarios').doc(uid).set({
        email: correo,
        rol: 'mesero',
        negocioId: negocioIdActual,
        nombre: nombreLimpio,
        activo: true,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      if (error && /permission/i.test(String(error.message || ''))) {
        throw new Error('Ese correo ya pertenece a otra cuenta. Usa uno distinto.');
      }
      throw error;
    }
    return { uid: uid, email: correo, nombre: nombreLimpio, rol: 'mesero' };
  }

  async function eliminarMesero(uid) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede eliminar meseros.');
    const id = String(uid || '').trim();
    if (!id) throw new Error('Falta el mesero a eliminar.');
    if (auth().currentUser && auth().currentUser.uid === id) {
      throw new Error('No puedes eliminar tu propia cuenta.');
    }
    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'mesero') throw new Error('Solo se pueden eliminar meseros.');
    await ref.set({
      activo: false,
      eliminadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  function esErrorClaveAuth(error) {
    const codigo = error && error.code;
    return codigo === 'auth/wrong-password'
      || codigo === 'auth/invalid-credential'
      || codigo === 'auth/invalid-login-credentials';
  }

  async function actualizarMesero(uid, nombre, password) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede modificar meseros.');
    const id = String(uid || '').trim();
    const nombreLimpio = String(nombre || '').trim();
    const clave = normalizarClave(password);
    if (!id) throw new Error('Falta el mesero a modificar.');
    if (!nombreLimpio) throw new Error('Escribe el nombre del mesero.');
    if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Ese mesero no existe.');
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'mesero') throw new Error('Solo se pueden modificar meseros.');

    await ref.set({
      nombre: nombreLimpio,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (!clave) return { uid: id, nombre: nombreLimpio };

    const correo = normalizarCorreo(data.email);
    if (!correo) return { uid: id, nombre: nombreLimpio };
    try {
      await llamarIdentityToolkit('accounts:signInWithPassword', {
        email: correo,
        password: clave,
        returnSecureToken: true
      });
    } catch (error) {
      if (esErrorClaveAuth(error)) {
        throw new Error('El nombre se actualizó. Para una contraseña nueva elimina el mesero y créalo otra vez con otro correo.');
      }
      throw error;
    }
    return { uid: id, nombre: nombreLimpio };
  }

  async function asegurarNegocio(opciones) {
    const user = auth().currentUser;
    if (!user) return null;
    const soloUnirse = !!(opciones && opciones.soloUnirse);

    const userRef = db().collection('usuarios').doc(user.uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      usuarioDoc = userSnap.data();
      if (usuarioDoc.activo === false) {
        usuarioDoc = null;
        negocioIdActual = null;
        localStorage.removeItem('sesionActiva');
        try { await auth().signOut(); } catch (e) {}
        throw new Error('Esta cuenta fue eliminada por el administrador.');
      }
      negocioIdActual = usuarioDoc.negocioId;
      if (esAdminNegocio()) {
        asegurarCodigoEquipo().catch(function (e) {
          console.warn('No se pudo asegurar el código de equipo', e);
        });
      }
    } else if (codigoEquipoPendiente) {
      await unirseANegocioConCodigo(user, codigoEquipoPendiente);
      codigoEquipoPendiente = '';
    } else if (soloUnirse) {
      throw new Error('Esta cuenta no está en el equipo. Pide al administrador que te cree en Administración.');
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
      try {
        await asegurarCodigoEquipo();
      } catch (e) {
        console.warn('No se pudo crear el código de equipo', e);
      }
    }

    aislarCacheSiCambioNegocio(negocioIdActual);

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
      'auth/user-not-found': 'Esa cuenta no existe. Pide al administrador que te cree en Administración.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/network-request-failed': 'Sin conexión. Revisa internet e inténtalo de nuevo.',
      'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
      'auth/operation-not-allowed': 'Activa Email/Password en Authentication de Firebase.',
      'auth/invalid-api-key': 'La apiKey de Firebase no es válida. Revisa la configuración.',
      'auth/requires-recent-login': 'Por seguridad, confirma la contraseña de la cuenta.',
      'auth/missing-password': 'Escribe la contraseña de la cuenta.'
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
      if (esMesero()) return local;
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

  const FLAGS_BOTONES_POS = ['posMostrarGastos', 'posMostrarInventario', 'posMostrarCierreAdmin', 'posMostrarBalance'];
  const POS_BOTONES_DEFAULTS_VERSION = 2;

  function versionBotonesPOS(datos) {
    if (arguments.length > 0) {
      return Number((datos && datos.posBotonesDefaultsVersion) || 0);
    }
    return parseInt(localStorage.getItem('posBotonesDefaultsVersion') || '0', 10) || 0;
  }

  function flagsBotonesPOSDesdeStorage() {
    const version = versionBotonesPOS();
    const out = { posBotonesDefaultsVersion: POS_BOTONES_DEFAULTS_VERSION };
    FLAGS_BOTONES_POS.forEach(function (clave) {
      out[clave] = version < POS_BOTONES_DEFAULTS_VERSION
        ? true
        : localStorage.getItem(clave) !== 'false';
    });
    return out;
  }

  function flagsBotonesPOSDesdeDatos(datos) {
    const origen = datos || {};
    const version = versionBotonesPOS(origen);
    const out = { posBotonesDefaultsVersion: POS_BOTONES_DEFAULTS_VERSION };
    FLAGS_BOTONES_POS.forEach(function (clave) {
      out[clave] = version < POS_BOTONES_DEFAULTS_VERSION
        ? true
        : origen[clave] !== false;
    });
    return out;
  }

  function snapshotOperacionLocal() {
    return Object.assign({
      mesasActivas: parseJsonLocal('mesasActivas', []),
      ordenesCocina: parseJsonLocal('ordenesCocina', []),
      historialCocina: parseJsonLocal('historialCocina', []),
      pedidosCocinaListos: parseJsonLocal('pedidosCocinaListos', []),
      contadorDomicilios: parseInt(localStorage.getItem('contadorDomicilios') || '0', 10) || 0,
      contadorRecoger: parseInt(localStorage.getItem('contadorRecoger') || '0', 10) || 0,
      ultimaFechaContadores: localStorage.getItem('ultimaFechaContadores') || '',
      nombresDomiciliarios: parseJsonLocal('nombresDomiciliarios', []),
      pantallaCocinaActivada: localStorage.getItem('pantallaCocinaActivada') === 'true',
      cocinaSonidoActivado: localStorage.getItem('cocinaSonidoActivado') !== 'false',
      cocinaIntervaloActualizacion: localStorage.getItem('cocinaIntervaloActualizacion') || '30'
    }, flagsBotonesPOSDesdeStorage());
  }

  function operacionLimpia(datos) {
    const origen = datos || {};
    const texto = JSON.stringify(Object.assign({
      mesasActivas: entradasAObjetos(origen.mesasActivas),
      ordenesCocina: entradasAObjetos(origen.ordenesCocina),
      historialCocina: Array.isArray(origen.historialCocina) ? origen.historialCocina : [],
      pedidosCocinaListos: Array.isArray(origen.pedidosCocinaListos) ? origen.pedidosCocinaListos : [],
      contadorDomicilios: parseInt(origen.contadorDomicilios, 10) || 0,
      contadorRecoger: parseInt(origen.contadorRecoger, 10) || 0,
      ultimaFechaContadores: origen.ultimaFechaContadores || '',
      nombresDomiciliarios: Array.isArray(origen.nombresDomiciliarios) ? origen.nombresDomiciliarios : [],
      pantallaCocinaActivada: origen.pantallaCocinaActivada === true,
      cocinaSonidoActivado: origen.cocinaSonidoActivado !== false,
      cocinaIntervaloActualizacion: String(origen.cocinaIntervaloActualizacion || '30')
    }, flagsBotonesPOSDesdeDatos(origen)), function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  function operacionParaLocal(nube) {
    return Object.assign({
      mesasActivas: objetosAEntradas(nube.mesasActivas),
      ordenesCocina: objetosAEntradas(nube.ordenesCocina),
      historialCocina: Array.isArray(nube.historialCocina) ? nube.historialCocina : [],
      pedidosCocinaListos: Array.isArray(nube.pedidosCocinaListos) ? nube.pedidosCocinaListos : [],
      contadorDomicilios: parseInt(nube.contadorDomicilios, 10) || 0,
      contadorRecoger: parseInt(nube.contadorRecoger, 10) || 0,
      ultimaFechaContadores: nube.ultimaFechaContadores || '',
      nombresDomiciliarios: Array.isArray(nube.nombresDomiciliarios) ? nube.nombresDomiciliarios : [],
      pantallaCocinaActivada: nube.pantallaCocinaActivada === true,
      cocinaSonidoActivado: nube.cocinaSonidoActivado !== false,
      cocinaIntervaloActualizacion: String(nube.cocinaIntervaloActualizacion || '30')
    }, flagsBotonesPOSDesdeDatos(nube));
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
    FLAGS_BOTONES_POS.forEach(function (clave) {
      localStorage.setItem(clave, local[clave] ? 'true' : 'false');
    });
    localStorage.setItem('posBotonesDefaultsVersion', String(local.posBotonesDefaultsVersion || POS_BOTONES_DEFAULTS_VERSION));
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
    const payload = {
      mesasActivas: limpio.mesasActivas,
      ordenesCocina: limpio.ordenesCocina,
      historialCocina: limpio.historialCocina,
      pedidosCocinaListos: limpio.pedidosCocinaListos,
      contadorDomicilios: limpio.contadorDomicilios,
      contadorRecoger: limpio.contadorRecoger,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!esMesero()) {
      payload.ultimaFechaContadores = limpio.ultimaFechaContadores;
      payload.nombresDomiciliarios = limpio.nombresDomiciliarios;
      payload.pantallaCocinaActivada = limpio.pantallaCocinaActivada;
      payload.cocinaSonidoActivado = limpio.cocinaSonidoActivado;
      payload.cocinaIntervaloActualizacion = limpio.cocinaIntervaloActualizacion;
      payload.posMostrarGastos = limpio.posMostrarGastos;
      payload.posMostrarInventario = limpio.posMostrarInventario;
      payload.posMostrarCierreAdmin = limpio.posMostrarCierreAdmin;
      payload.posMostrarBalance = limpio.posMostrarBalance;
      payload.posBotonesDefaultsVersion = limpio.posBotonesDefaultsVersion || POS_BOTONES_DEFAULTS_VERSION;
    }
    await refOperacion().set(payload, { merge: true });
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
        cocinaIntervaloActualizacion: nube.cocinaIntervaloActualizacion,
        posMostrarGastos: nube.posMostrarGastos,
        posMostrarInventario: nube.posMostrarInventario,
        posMostrarCierreAdmin: nube.posMostrarCierreAdmin,
        posMostrarBalance: nube.posMostrarBalance,
        posBotonesDefaultsVersion: nube.posBotonesDefaultsVersion
      });
      const dataSnap = snap.data() || {};
      if (Number(dataSnap.posBotonesDefaultsVersion) !== POS_BOTONES_DEFAULTS_VERSION) {
        await persistirOperacionInmediato();
      }
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
        cocinaIntervaloActualizacion: nube.cocinaIntervaloActualizacion,
        posMostrarGastos: nube.posMostrarGastos,
        posMostrarInventario: nube.posMostrarInventario,
        posMostrarCierreAdmin: nube.posMostrarCierreAdmin,
        posMostrarBalance: nube.posMostrarBalance,
        posBotonesDefaultsVersion: nube.posBotonesDefaultsVersion
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

  const PIN_DEFAULTS_VERSION = 2;
  const PIN_VIEJOS_FABRICA = ['1234', '7894'];
  const PIN_MODULOS = [
    { id: 'administracion', etiqueta: 'Administración', clave: 'pinAdministracionHash', defecto: '0011' },
    { id: 'inventario', etiqueta: 'Inventario', clave: 'pinInventarioHash', defecto: '0000' },
    { id: 'historial', etiqueta: 'Historial', clave: 'pinHistorialHash', defecto: '0000' },
    { id: 'gastos', etiqueta: 'Gastos', clave: 'pinGastosHash', defecto: '0000' },
    { id: 'cierre-administrativo', etiqueta: 'Cierre administrativo', clave: 'pinCierreHash', defecto: '0000' },
    { id: 'balance', etiqueta: 'Balance', clave: 'pinBalanceHash', defecto: '0000' }
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
      if (bruto && typeof bruto === 'object') {
        PIN_MODULOS.forEach(function (mod) {
          if (bruto[mod.id]) out[mod.id] = bruto[mod.id];
        });
        if (bruto.pinDefaultsVersion) out.pinDefaultsVersion = bruto.pinDefaultsVersion;
      }
    } catch (e) {}
    PIN_MODULOS.forEach(function (mod) {
      const hash = localStorage.getItem(mod.clave);
      if (hash && !out[mod.id]) out[mod.id] = hash;
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
    if (datos && datos.pinAdministracionHash) mezclado.administracion = datos.pinAdministracionHash;
    if (datos && datos.pinDefaultsVersion) mezclado.pinDefaultsVersion = datos.pinDefaultsVersion;
    const guardar = {
      pinDefaultsVersion: mezclado.pinDefaultsVersion || PIN_DEFAULTS_VERSION
    };
    PIN_MODULOS.forEach(function (mod) {
      if (mezclado[mod.id]) {
        guardar[mod.id] = mezclado[mod.id];
        localStorage.setItem(mod.clave, mezclado[mod.id]);
      }
    });
    localStorage.setItem('pinesModulos', JSON.stringify(guardar));
    return guardar;
  }

  async function hashesPorDefecto() {
    const out = {};
    for (let i = 0; i < PIN_MODULOS.length; i++) {
      const mod = PIN_MODULOS[i];
      out[mod.id] = await hashPin(mod.defecto);
    }
    return out;
  }

  async function hashesViejosFabricaSet() {
    const set = {};
    for (let i = 0; i < PIN_VIEJOS_FABRICA.length; i++) {
      set[await hashPin(PIN_VIEJOS_FABRICA[i])] = true;
    }
    return set;
  }

  async function aplicarPinDefaultsActuales(hashes) {
    const actuales = hashes || {};
    const version = Number(actuales.pinDefaultsVersion) || 0;
    const defs = await hashesPorDefecto();
    const out = {};
    PIN_MODULOS.forEach(function (mod) {
      out[mod.id] = actuales[mod.id] || defs[mod.id];
    });
    if (version < PIN_DEFAULTS_VERSION) {
      const viejos = await hashesViejosFabricaSet();
      PIN_MODULOS.forEach(function (mod) {
        if (mod.id === 'administracion') return;
        if (!actuales[mod.id] || viejos[actuales[mod.id]]) {
          out[mod.id] = defs[mod.id];
        }
      });
    }
    out.pinDefaultsVersion = PIN_DEFAULTS_VERSION;
    return out;
  }

  async function hashesEfectivos() {
    return aplicarPinDefaultsActuales(leerPinesLocal());
  }

  async function persistirRoles(hashes) {
    if (esMesero()) return hashes || {};
    if (!negocioIdActual) await asegurarNegocio();
    const actuales = await hashesEfectivos();
    const payload = Object.assign({}, actuales, hashes || {});
    const limpio = await aplicarPinDefaultsActuales(payload);
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

  function pinDefectoModulo(moduloId) {
    const mod = PIN_MODULOS.filter(function (m) { return m.id === moduloId; })[0];
    return mod ? mod.defecto : '';
  }

  async function restablecerPinAdministracion(password) {
    const user = auth().currentUser;
    if (!user || !user.email) {
      throw new Error('No hay una cuenta iniciada. Vuelve al inicio de sesión.');
    }
    const clave = String(password || '');
    if (!clave) {
      const err = new Error('Escribe la contraseña de la cuenta.');
      err.code = 'auth/missing-password';
      throw err;
    }
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, clave);
    await user.reauthenticateWithCredential(cred);
    const pin = pinDefectoModulo('administracion') || '0011';
    await persistirPinModulo('administracion', pin);
    return pin;
  }

  async function sincronizarRoles() {
    if (esMesero()) return {};
    if (!negocioIdActual) await asegurarNegocio();
    if (!negocioIdActual) return hashesEfectivos();
    const snap = await refRoles().get();
    if (snap.exists) {
      const data = snap.data() || {};
      delete data.actualizadoEn;
      const migrado = await aplicarPinDefaultsActuales(data);
      escribirRolesLocal(migrado);
      if (Number(data.pinDefaultsVersion) !== PIN_DEFAULTS_VERSION) {
        await persistirRoles(migrado);
      }
      return leerPinesLocal();
    }
    await persistirRoles(await hashesEfectivos());
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

  async function iniciarSesion(email, password, codigoEquipo, opciones) {
    const codigo = marcarCodigoPendiente(codigoEquipo);
    const correo = normalizarCorreo(email);
    const clave = normalizarClave(password);
    try {
      const cred = await auth().signInWithEmailAndPassword(correo, clave);
      try {
        await asegurarNegocio(opciones);
      } catch (error) {
        try { await auth().signOut(); } catch (e) {}
        throw error;
      }
      localStorage.setItem('sesionActiva', 'true');
      try {
        await sincronizarRoles();
      } catch (e) {
        console.warn('No se pudieron sincronizar los PIN', e);
      }
      return cred.user;
    } finally {
      codigoEquipoPendiente = '';
    }
  }

  async function unirseAlNegocio(email, password, codigoEquipo, nombre) {
    const codigo = marcarCodigoPendiente(codigoEquipo);
    nombreMeseroPendiente = String(nombre || '').trim();
    if (!codigo) throw new Error('Escribe el código de equipo que te dio Administración.');
    if (!nombreMeseroPendiente) throw new Error('Escribe tu nombre. Sale en el ticket de cocina.');
    try {
      const cred = await auth().createUserWithEmailAndPassword(normalizarCorreo(email), normalizarClave(password));
      try {
        await asegurarNegocio();
        if (nombreMeseroPendiente && !nombreMeseroActual()) {
          await guardarNombreUsuario(nombreMeseroPendiente);
        }
      } catch (error) {
        try {
          if (auth().currentUser) await auth().currentUser.delete();
        } catch (e) {}
        throw error;
      }
      localStorage.setItem('sesionActiva', 'true');
      try {
        await sincronizarRoles();
      } catch (e) {
        console.warn('No se pudieron sincronizar los PIN', e);
      }
      return cred.user;
    } catch (error) {
      if (error && error.code === 'auth/email-already-in-use') {
        const user = await iniciarSesion(email, password, codigo);
        if (nombreMeseroPendiente && !nombreMeseroActual()) {
          try { await guardarNombreUsuario(nombreMeseroPendiente); } catch (e) {}
        }
        return user;
      }
      throw error;
    } finally {
      codigoEquipoPendiente = '';
      nombreMeseroPendiente = '';
    }
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
    codigoEquipoPendiente = '';
    nombreMeseroPendiente = '';
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
          if (e && /eliminada/i.test(String(e.message || ''))) {
            try { await auth().signOut(); } catch (x) {}
          }
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
    unirseAlNegocio: unirseAlNegocio,
    cerrarSesion: cerrarSesion,
    asegurarNegocio: asegurarNegocio,
    obtenerCodigoEquipo: obtenerCodigoEquipo,
    regenerarCodigoEquipo: regenerarCodigoEquipo,
    listarUsuariosNegocio: listarUsuariosNegocio,
    crearCuentaMesero: crearCuentaMesero,
    actualizarMesero: actualizarMesero,
    eliminarMesero: eliminarMesero,
    getRol: getRol,
    esAdminNegocio: esAdminNegocio,
    esMesero: esMesero,
    nombreMeseroActual: nombreMeseroActual,
    guardarNombreUsuario: guardarNombreUsuario,
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
    restablecerPinAdministracion: restablecerPinAdministracion,
    pinDefectoModulo: pinDefectoModulo,
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
