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
    'recordatorios', 'recordatoriosActivos', 'cotizaciones', 'logoNegocio',
    'facturacionElectronica'
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

  function claveSesion(nombre) {
    return appSecundaria() ? nombre + 'Propietario' : nombre;
  }

  function recordarRolLocal() {
    try {
      const user = appIniciada ? auth().currentUser : null;
      if (!user || !usuarioDoc) return;
      localStorage.setItem(claveSesion('sesionActiva'), 'true');
      localStorage.setItem(claveSesion('toysoftSesionUid'), user.uid);
      localStorage.setItem(claveSesion('toysoftSesionRol'), String(usuarioDoc.rol || ''));
    } catch (e) { /* ignore */ }
  }

  function olvidarRolLocal() {
    try {
      localStorage.removeItem(claveSesion('toysoftSesionUid'));
      localStorage.removeItem(claveSesion('toysoftSesionRol'));
    } catch (e) { /* ignore */ }
  }

  function sesionRecordada(rol) {
    try {
      const user = (appIniciada && auth().currentUser) || usuarioAuth;
      if (!user || !rol) return false;
      return localStorage.getItem(claveSesion('toysoftSesionUid')) === user.uid
        && localStorage.getItem(claveSesion('toysoftSesionRol')) === String(rol);
    } catch (e) {
      return false;
    }
  }

  function appSecundaria() {
    return global.TOYSOFT_APP_SECUNDARIA ? String(global.TOYSOFT_APP_SECUNDARIA) : '';
  }

  function appActual() {
    if (appFirebase) return appFirebase;
    const nombre = appSecundaria();
    const cfg = obtenerConfig();
    if (!nombre) {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      appFirebase = firebase.app();
      return appFirebase;
    }
    const previa = firebase.apps.filter(function (app) { return app.name === nombre; })[0];
    appFirebase = previa || firebase.initializeApp(cfg, nombre);
    return appFirebase;
  }

  let appFirebase = null;

  function db() {
    if (!appSecundaria()) return firebase.firestore();
    return appActual().firestore();
  }

  function auth() {
    if (!appSecundaria()) return firebase.auth();
    return appActual().auth();
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

  function esPos() {
    return cuentaActiva() && getRol() === 'pos';
  }

  function esPropietario() {
    return cuentaActiva() && getRol() === 'propietario';
  }

  function esCaja() {
    return cuentaActiva() && (getRol() === 'admin' || getRol() === 'pos');
  }

  function puedeEscribirCaja() {
    return esAdminNegocio() || esPos();
  }

  function normalizarSexoMesero(valor) {
    const s = String(valor || '').trim().toLowerCase();
    if (s === 'f' || s === 'femenino' || s === 'mujer' || s === 'mesera') return 'femenino';
    if (s === 'm' || s === 'masculino' || s === 'hombre' || s === 'mesero') return 'masculino';
    return '';
  }

  function etiquetaRolPorSexo(sexo) {
    return normalizarSexoMesero(sexo) === 'femenino' ? 'Mesera' : 'Mesero';
  }

  function uidMeseroActual() {
    if (usuarioAuth && usuarioAuth.uid) return String(usuarioAuth.uid);
    try {
      return (auth().currentUser && auth().currentUser.uid) || '';
    } catch (e) {
      return '';
    }
  }

  function nombreUsuarioActual() {
    const u = usuarioDoc || {};
    return String(u.nombre || '').trim();
  }

  function nombreMeseroActual() {
    return nombreUsuarioActual();
  }

  function sexoMeseroActual() {
    return normalizarSexoMesero((usuarioDoc || {}).sexo);
  }

  function etiquetaRolMeseroActual() {
    return etiquetaRolPorSexo(sexoMeseroActual());
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
        sexo: normalizarSexoMesero(data.sexo),
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

  async function crearORecuperarAuthEquipo(correo, clave, nombre) {
    try {
      const creado = await llamarIdentityToolkit('accounts:signUp', {
        email: correo,
        password: clave,
        displayName: nombre || '',
        returnSecureToken: true
      });
      if (!creado || !creado.localId) throw new Error('No se pudo crear la cuenta.');
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

  async function crearCuentaMesero(nombre, email, password, sexo) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede crear meseros.');
    if (!negocioIdActual) await asegurarNegocio();
    const nombreLimpio = String(nombre || '').trim();
    const correo = normalizarCorreo(email);
    const clave = normalizarClave(password);
    const sexoLimpio = normalizarSexoMesero(sexo);
    if (!nombreLimpio) throw new Error('Escribe el nombre del mesero.');
    if (!correo) throw new Error('Escribe el correo del mesero.');
    if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (!sexoLimpio) throw new Error('Elige el sexo: femenino o masculino.');
    if (!auth().currentUser) throw new Error('Se perdió la sesión del administrador. Vuelve a entrar.');

    const actuales = await listarUsuariosNegocio(true);
    const mismo = actuales.filter(function (u) {
      return normalizarCorreo(u.email) === correo;
    })[0];
    if (mismo && mismo.rol === 'admin') {
      throw new Error('Ese correo es del administrador.');
    }
    if (mismo && mismo.rol === 'pos') {
      throw new Error('Ese correo ya es de un punto de venta.');
    }
    if (mismo && mismo.rol === 'propietario') {
      throw new Error('Ese correo ya es de un propietario.');
    }

    const uid = await crearORecuperarAuthEquipo(correo, clave, nombreLimpio);
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
        sexo: sexoLimpio,
        activo: true,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      if (error && /permission/i.test(String(error.message || ''))) {
        throw new Error('Ese correo ya pertenece a otra cuenta. Usa uno distinto.');
      }
      throw error;
    }
    return { uid: uid, email: correo, nombre: nombreLimpio, rol: 'mesero', sexo: sexoLimpio };
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

  async function actualizarMesero(uid, nombre, password, sexo) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede modificar meseros.');
    const id = String(uid || '').trim();
    const nombreLimpio = String(nombre || '').trim();
    const clave = normalizarClave(password);
    const sexoLimpio = normalizarSexoMesero(sexo);
    if (!id) throw new Error('Falta el mesero a modificar.');
    if (!nombreLimpio) throw new Error('Escribe el nombre del mesero.');
    if (!sexoLimpio) throw new Error('Elige el sexo: femenino o masculino.');
    if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Ese mesero no existe.');
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'mesero') throw new Error('Solo se pueden modificar meseros.');

    await ref.set({
      nombre: nombreLimpio,
      sexo: sexoLimpio,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (!clave) return { uid: id, nombre: nombreLimpio, sexo: sexoLimpio };

    const correo = normalizarCorreo(data.email);
    if (!correo) return { uid: id, nombre: nombreLimpio, sexo: sexoLimpio };
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
    return { uid: id, nombre: nombreLimpio, sexo: sexoLimpio };
  }

  async function crearCuentaPos(nombre, email, password) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede crear puntos de venta.');
    if (!negocioIdActual) await asegurarNegocio();
    const nombreLimpio = String(nombre || '').trim();
    const correo = normalizarCorreo(email);
    const clave = normalizarClave(password);
    if (!nombreLimpio) throw new Error('Escribe el nombre del punto de venta.');
    if (!correo) throw new Error('Escribe el correo del punto de venta.');
    if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (!auth().currentUser) throw new Error('Se perdió la sesión del administrador. Vuelve a entrar.');

    const actuales = await listarUsuariosNegocio(true);
    const mismo = actuales.filter(function (u) {
      return normalizarCorreo(u.email) === correo;
    })[0];
    if (mismo && mismo.rol === 'admin') {
      throw new Error('Ese correo es del administrador.');
    }
    if (mismo && mismo.rol === 'mesero') {
      throw new Error('Ese correo ya es de un mesero.');
    }
    if (mismo && mismo.rol === 'propietario') {
      throw new Error('Ese correo ya es de un propietario.');
    }

    const uid = await crearORecuperarAuthEquipo(correo, clave, nombreLimpio);
    if (!uid) throw new Error('No se pudo crear la cuenta del punto de venta.');
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
        rol: 'pos',
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
    return { uid: uid, email: correo, nombre: nombreLimpio, rol: 'pos' };
  }

  async function eliminarPos(uid) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede eliminar puntos de venta.');
    const id = String(uid || '').trim();
    if (!id) throw new Error('Falta el punto de venta a eliminar.');
    if (auth().currentUser && auth().currentUser.uid === id) {
      throw new Error('No puedes eliminar tu propia cuenta.');
    }
    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'pos') throw new Error('Solo se pueden eliminar puntos de venta.');
    await ref.set({
      activo: false,
      eliminadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function actualizarPos(uid, nombre, password) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede modificar puntos de venta.');
    const id = String(uid || '').trim();
    const nombreLimpio = String(nombre || '').trim();
    const clave = normalizarClave(password);
    if (!id) throw new Error('Falta el punto de venta a modificar.');
    if (!nombreLimpio) throw new Error('Escribe el nombre del punto de venta.');
    if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Ese punto de venta no existe.');
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'pos') throw new Error('Solo se pueden modificar puntos de venta.');

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
        throw new Error('El nombre se actualizó. Para una contraseña nueva elimina el punto de venta y créalo otra vez con otro correo.');
      }
      throw error;
    }
    return { uid: id, nombre: nombreLimpio };
  }

  async function crearCuentaPropietario(nombre, email, password) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede crear propietarios.');
    if (!negocioIdActual) await asegurarNegocio();
    const nombreLimpio = String(nombre || '').trim();
    const correo = normalizarCorreo(email);
    const clave = normalizarClave(password);
    if (!nombreLimpio) throw new Error('Escribe el nombre del propietario.');
    if (!correo) throw new Error('Escribe el correo del propietario.');
    if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (!auth().currentUser) throw new Error('Se perdió la sesión del administrador. Vuelve a entrar.');

    const actuales = await listarUsuariosNegocio(true);
    const mismo = actuales.filter(function (u) {
      return normalizarCorreo(u.email) === correo;
    })[0];
    if (mismo && mismo.rol === 'admin') {
      throw new Error('Ese correo es del administrador.');
    }
    if (mismo && mismo.rol === 'mesero') {
      throw new Error('Ese correo ya es de un mesero.');
    }
    if (mismo && mismo.rol === 'pos') {
      throw new Error('Ese correo ya es de un punto de venta.');
    }
    if (mismo && mismo.rol === 'propietario') {
      throw new Error('Ese correo ya es de un propietario.');
    }

    const uid = await crearORecuperarAuthEquipo(correo, clave, nombreLimpio);
    if (!uid) throw new Error('No se pudo crear la cuenta del propietario.');
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
        rol: 'propietario',
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
    return { uid: uid, email: correo, nombre: nombreLimpio, rol: 'propietario' };
  }

  async function eliminarPropietario(uid) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede eliminar propietarios.');
    const id = String(uid || '').trim();
    if (!id) throw new Error('Falta el propietario a eliminar.');
    if (auth().currentUser && auth().currentUser.uid === id) {
      throw new Error('No puedes eliminar tu propia cuenta.');
    }
    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'propietario') throw new Error('Solo se pueden eliminar propietarios.');
    await ref.set({
      activo: false,
      eliminadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function actualizarPropietario(uid, nombre, password) {
    if (!esAdminNegocio()) throw new Error('Solo el administrador puede modificar propietarios.');
    const id = String(uid || '').trim();
    const nombreLimpio = String(nombre || '').trim();
    const clave = normalizarClave(password);
    if (!id) throw new Error('Falta el propietario a modificar.');
    if (!nombreLimpio) throw new Error('Escribe el nombre del propietario.');
    if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const ref = db().collection('usuarios').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Ese propietario no existe.');
    const data = snap.data() || {};
    if (data.negocioId !== negocioIdActual) throw new Error('Ese usuario no es de este negocio.');
    if (data.rol !== 'propietario') throw new Error('Solo se pueden modificar propietarios.');

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
        throw new Error('El nombre se actualizó. Para una contraseña nueva elimina el propietario y créalo otra vez con otro correo.');
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
        olvidarRolLocal();
        try { await auth().signOut(); } catch (e) {}
        throw new Error('Esta cuenta fue eliminada por el administrador.');
      }
      negocioIdActual = usuarioDoc.negocioId;
      recordarRolLocal();
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
        nombre: local.nombre || '',
        nit: local.nit || '',
        direccion: local.direccion || '',
        correo: local.correo || '',
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
    recordarRolLocal();

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
      if (!esAdminNegocio()) return local;
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

  function camposImpresoraCocina(origen) {
    const ip = String((origen && origen.impresoraCocinaIp) || '').trim();
    let puerto = parseInt((origen && origen.impresoraCocinaPuerto), 10);
    if (!Number.isFinite(puerto) || puerto < 1 || puerto > 65535) puerto = 9100;
    const ancho = String((origen && origen.impresoraCocinaAncho) || '') === '58' ? '58' : '80';
    return {
      impresoraCocinaIp: ip,
      impresoraCocinaPuerto: String(puerto),
      impresoraCocinaAncho: ancho
    };
  }

  function leerSesionesCobradas() {
    try {
      const arr = JSON.parse(localStorage.getItem('sesionesCobradasHoy') || '[]');
      return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function escribirSesionesCobradas(lista) {
    const uniq = [];
    const vistos = {};
    (lista || []).forEach(function (id) {
      const s = String(id || '');
      if (!s || vistos[s]) return;
      vistos[s] = true;
      uniq.push(s);
    });
    if (uniq.length > 400) uniq.splice(0, uniq.length - 400);
    localStorage.setItem('sesionesCobradasHoy', JSON.stringify(uniq));
    return uniq;
  }

  function unirSesionesCobradas(origen) {
    const extra = origen
      ? (Array.isArray(origen.sesionesCobradas) ? origen.sesionesCobradas : origen)
      : [];
    return escribirSesionesCobradas(leerSesionesCobradas().concat(Array.isArray(extra) ? extra : []));
  }

  function marcarSesionCobrada(sesionId) {
    const id = String(sesionId || '');
    if (!id) return leerSesionesCobradas();
    return escribirSesionesCobradas(leerSesionesCobradas().concat([id]));
  }

  function sesionYaCobrada(sesionId) {
    const id = String(sesionId || '');
    if (!id) return false;
    return leerSesionesCobradas().indexOf(id) !== -1;
  }

  function limpiarSesionesCobradas() {
    localStorage.removeItem('sesionesCobradasHoy');
    return [];
  }

  function filtrarEntradasMesasCobradas(entradas, sesiones) {
    const set = {};
    (sesiones || []).forEach(function (id) { if (id) set[String(id)] = true; });
    if (!Object.keys(set).length || !Array.isArray(entradas)) return entradas || [];
    return entradas.filter(function (par) {
      let pedido = null;
      if (Array.isArray(par) && par.length >= 2) pedido = par[1];
      else if (par && par.datos) pedido = par.datos;
      const sid = pedido && pedido.sesionId;
      return !(sid && set[String(sid)]);
    });
  }

  function leerMesasMemoriaOLocal() {
    try {
      if (typeof window.ToysoftSnapshotMesas === 'function') {
        const mem = window.ToysoftSnapshotMesas();
        if (Array.isArray(mem)) return mem;
      }
    } catch (e) { /* ignore */ }
    return parseJsonLocal('mesasActivas', []);
  }

  function snapshotOperacionLocal() {
    const sesiones = leerSesionesCobradas();
    return Object.assign({
      mesasActivas: filtrarEntradasMesasCobradas(leerMesasMemoriaOLocal(), sesiones),
      ordenesCocina: parseJsonLocal('ordenesCocina', []),
      historialCocina: parseJsonLocal('historialCocina', []),
      pedidosCocinaListos: parseJsonLocal('pedidosCocinaListos', []),
      contadorDomicilios: parseInt(localStorage.getItem('contadorDomicilios') || '0', 10) || 0,
      contadorRecoger: parseInt(localStorage.getItem('contadorRecoger') || '0', 10) || 0,
      contadoresReinicioEn: localStorage.getItem('contadoresReinicioEn') || '',
      ultimaFechaContadores: localStorage.getItem('ultimaFechaContadores') || '',
      nombresDomiciliarios: parseJsonLocal('nombresDomiciliarios', []),
      pantallaCocinaActivada: localStorage.getItem('pantallaCocinaActivada') === 'true',
      cocinaSonidoActivado: localStorage.getItem('cocinaSonidoActivado') !== 'false',
      cocinaIntervaloActualizacion: localStorage.getItem('cocinaIntervaloActualizacion') || '30',
      sesionesCobradas: sesiones
    }, camposImpresoraCocina({
      impresoraCocinaIp: localStorage.getItem('impresoraCocinaIp') || '',
      impresoraCocinaPuerto: localStorage.getItem('impresoraCocinaPuerto') || '9100',
      impresoraCocinaAncho: localStorage.getItem('impresoraCocinaAncho') || '80'
    }), flagsBotonesPOSDesdeStorage(), {
      posRequiereLogin: localStorage.getItem('posRequiereLogin') === 'true',
      posInstaladorActivo: localStorage.getItem('posInstaladorActivo') === 'true'
    });
  }

  function operacionLimpia(datos) {
    const origen = datos || {};
    const sesiones = unirSesionesCobradas(origen);
    const texto = JSON.stringify(Object.assign({
      mesasActivas: filtrarEntradasMesasCobradas(entradasAObjetos(origen.mesasActivas), sesiones),
      ordenesCocina: entradasAObjetos(origen.ordenesCocina),
      historialCocina: Array.isArray(origen.historialCocina) ? origen.historialCocina : [],
      pedidosCocinaListos: Array.isArray(origen.pedidosCocinaListos) ? origen.pedidosCocinaListos : [],
      contadorDomicilios: parseInt(origen.contadorDomicilios, 10) || 0,
      contadorRecoger: parseInt(origen.contadorRecoger, 10) || 0,
      contadoresReinicioEn: origen.contadoresReinicioEn || '',
      ultimaFechaContadores: origen.ultimaFechaContadores || '',
      nombresDomiciliarios: Array.isArray(origen.nombresDomiciliarios) ? origen.nombresDomiciliarios : [],
      pantallaCocinaActivada: origen.pantallaCocinaActivada === true,
      cocinaSonidoActivado: origen.cocinaSonidoActivado !== false,
      cocinaIntervaloActualizacion: String(origen.cocinaIntervaloActualizacion || '30'),
      sesionesCobradas: sesiones
    }, camposImpresoraCocina(origen), flagsBotonesPOSDesdeDatos(origen), {
      posRequiereLogin: origen.posRequiereLogin === true,
      posInstaladorActivo: origen.posInstaladorActivo === true
    }), function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  function operacionParaLocal(nube) {
    const origen = nube || {};
    const sesiones = unirSesionesCobradas(origen);
    return Object.assign({
      mesasActivas: filtrarEntradasMesasCobradas(objetosAEntradas(origen.mesasActivas), sesiones),
      ordenesCocina: objetosAEntradas(origen.ordenesCocina),
      historialCocina: Array.isArray(origen.historialCocina) ? origen.historialCocina : [],
      pedidosCocinaListos: Array.isArray(origen.pedidosCocinaListos) ? origen.pedidosCocinaListos : [],
      contadorDomicilios: parseInt(origen.contadorDomicilios, 10) || 0,
      contadorRecoger: parseInt(origen.contadorRecoger, 10) || 0,
      contadoresReinicioEn: origen.contadoresReinicioEn || '',
      ultimaFechaContadores: origen.ultimaFechaContadores || '',
      nombresDomiciliarios: Array.isArray(origen.nombresDomiciliarios) ? origen.nombresDomiciliarios : [],
      pantallaCocinaActivada: origen.pantallaCocinaActivada === true,
      cocinaSonidoActivado: origen.cocinaSonidoActivado !== false,
      cocinaIntervaloActualizacion: String(origen.cocinaIntervaloActualizacion || '30'),
      sesionesCobradas: sesiones
    }, camposImpresoraCocina(origen), flagsBotonesPOSDesdeDatos(origen), {
      posRequiereLogin: origen.posRequiereLogin === true,
      posInstaladorActivo: origen.posInstaladorActivo === true
    });
  }

  function marcaContadores(valor) {
    const t = Date.parse(valor || '');
    return Number.isFinite(t) ? t : 0;
  }

  function elegirContadoresDomRec(domLocal, recLocal, epochLocal, domRemoto, recRemoto, epochRemoto) {
    const local = marcaContadores(epochLocal);
    const remoto = marcaContadores(epochRemoto);
    if (remoto > local) {
      return { dom: domRemoto, rec: recRemoto, epoch: epochRemoto || '' };
    }
    if (local > remoto) {
      return { dom: domLocal, rec: recLocal, epoch: epochLocal || '' };
    }
    return {
      dom: Math.max(domLocal, domRemoto),
      rec: Math.max(recLocal, recRemoto),
      epoch: epochLocal || epochRemoto || ''
    };
  }

  function escribirOperacionLocal(datos) {
    const local = operacionParaLocal(datos || {});
    localStorage.setItem('mesasActivas', JSON.stringify(local.mesasActivas));
    localStorage.setItem('ordenesCocina', JSON.stringify(local.ordenesCocina));
    localStorage.setItem('historialCocina', JSON.stringify(local.historialCocina));
    localStorage.setItem('pedidosCocinaListos', JSON.stringify(local.pedidosCocinaListos));
    const domGuardado = parseInt(localStorage.getItem('contadorDomicilios') || '0', 10) || 0;
    const recGuardado = parseInt(localStorage.getItem('contadorRecoger') || '0', 10) || 0;
    const elegido = elegirContadoresDomRec(
      domGuardado,
      recGuardado,
      localStorage.getItem('contadoresReinicioEn') || '',
      parseInt(local.contadorDomicilios, 10) || 0,
      parseInt(local.contadorRecoger, 10) || 0,
      local.contadoresReinicioEn || ''
    );
    local.contadorDomicilios = elegido.dom;
    local.contadorRecoger = elegido.rec;
    local.contadoresReinicioEn = elegido.epoch;
    localStorage.setItem('contadorDomicilios', String(elegido.dom));
    localStorage.setItem('contadorRecoger', String(elegido.rec));
    if (elegido.epoch) localStorage.setItem('contadoresReinicioEn', elegido.epoch);
    if (local.ultimaFechaContadores) {
      localStorage.setItem('ultimaFechaContadores', local.ultimaFechaContadores);
    }
    localStorage.setItem('nombresDomiciliarios', JSON.stringify(local.nombresDomiciliarios));
    localStorage.setItem('pantallaCocinaActivada', local.pantallaCocinaActivada ? 'true' : 'false');
    localStorage.setItem('cocinaSonidoActivado', local.cocinaSonidoActivado ? 'true' : 'false');
    localStorage.setItem('cocinaIntervaloActualizacion', local.cocinaIntervaloActualizacion);
    localStorage.setItem('impresoraCocinaIp', local.impresoraCocinaIp || '');
    localStorage.setItem('impresoraCocinaPuerto', local.impresoraCocinaPuerto || '9100');
    localStorage.setItem('impresoraCocinaAncho', local.impresoraCocinaAncho || '80');
    escribirSesionesCobradas(local.sesionesCobradas || leerSesionesCobradas());
    FLAGS_BOTONES_POS.forEach(function (clave) {
      localStorage.setItem(clave, local[clave] ? 'true' : 'false');
    });
    localStorage.setItem('posRequiereLogin', local.posRequiereLogin ? 'true' : 'false');
    localStorage.setItem('posInstaladorActivo', local.posInstaladorActivo ? 'true' : 'false');
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

  let persistiendoOperacion = 0;
  let operacionPendiente = null;
  let idsMesasVistas = null;
  let idsCocinaVistas = null;
  let revisionOperacionLocal = 0;
  let revisionOperacionConfirmada = 0;
  let callbackOperacionVivo = null;

  function marcarOperacionLocalPendiente() {
    revisionOperacionLocal += 1;
    window._cambiosOperacionPendientes = revisionOperacionLocal - revisionOperacionConfirmada;
  }

  function operacionLocalEstaPendiente() {
    return revisionOperacionLocal > revisionOperacionConfirmada;
  }

  function confirmarRevisionOperacion(revision) {
    if (revision > revisionOperacionConfirmada) revisionOperacionConfirmada = revision;
    window._cambiosOperacionPendientes = Math.max(0, revisionOperacionLocal - revisionOperacionConfirmada);
  }

  function idDeEntrada(item) {
    if (Array.isArray(item) && item.length >= 1 && item[0] != null) return String(item[0]);
    if (item && item.id != null && item.datos !== undefined) return String(item.id);
    return '';
  }

  function datosDeEntrada(item) {
    if (Array.isArray(item) && item.length >= 2) return item[1];
    if (item && item.datos !== undefined) return item.datos;
    return null;
  }

  function idsDeLista(lista) {
    const set = {};
    (lista || []).forEach(function (item) {
      const id = idDeEntrada(item);
      if (id) set[id] = true;
    });
    return set;
  }

  function recordarOperacionVista(mesas, cocina) {
    idsMesasVistas = idsDeLista(mesas);
    idsCocinaVistas = idsDeLista(cocina);
  }

  function sesionDeDatos(datos) {
    if (!datos || Array.isArray(datos)) return '';
    return datos.sesionId ? String(datos.sesionId) : '';
  }

  function fusionarListasOperacion(remotas, locales, sesiones, vistas) {
    const cobradas = {};
    (sesiones || []).forEach(function (id) { if (id) cobradas[String(id)] = true; });
    const mapa = new Map();
    (remotas || []).forEach(function (item) {
      const id = idDeEntrada(item);
      const datos = datosDeEntrada(item);
      if (!id || datos == null) return;
      const sid = sesionDeDatos(datos);
      if (sid && cobradas[sid]) return;
      mapa.set(id, { id: id, datos: datos });
    });
    (locales || []).forEach(function (item) {
      const id = idDeEntrada(item);
      const datos = datosDeEntrada(item);
      if (!id || datos == null) return;
      const sid = sesionDeDatos(datos);
      if (sid && cobradas[sid]) {
        mapa.delete(id);
        return;
      }
      const previo = mapa.get(id);
      mapa.set(id, {
        id: id,
        datos: previo ? elegirPedidoOperacion(datos, previo.datos) : datos
      });
    });
    if (vistas) {
      Array.from(mapa.keys()).forEach(function (id) {
        const sigueEnLocal = (locales || []).some(function (item) { return idDeEntrada(item) === id; });
        if (!sigueEnLocal && vistas[id]) mapa.delete(id);
      });
    }
    Array.from(mapa.keys()).forEach(function (id) {
      if (!mesasEliminadasLocal[id]) return;
      const sigueEnLocal = (locales || []).some(function (item) { return idDeEntrada(item) === id; });
      if (sigueEnLocal) delete mesasEliminadasLocal[id];
      else mapa.delete(id);
    });
    return Array.from(mapa.values());
  }

  const mesasEliminadasLocal = {};

  function marcarMesaEliminada(id) {
    const clave = String(id || '');
    if (!clave) return;
    mesasEliminadasLocal[clave] = Date.now();
  }

  function elegirPedidoOperacion(local, remoto) {
    if (!local) return remoto;
    if (!remoto) return local;
    const tl = Number(local.actualizadoLocal) || 0;
    const tr = Number(remoto.actualizadoLocal) || 0;
    if (tl > tr) return local;
    if (tr > tl) return remoto;
    const il = Array.isArray(local.items) ? local.items.length : 0;
    const ir = Array.isArray(remoto.items) ? remoto.items.length : 0;
    if (il > ir) return local;
    return remoto;
  }

  function quitarExternosPreviosAlReinicio(lista, epoch) {
    const corte = marcaContadores(epoch);
    if (!corte) return lista || [];
    return (lista || []).filter(function (item) {
      const id = idDeEntrada(item);
      if (!id || (id.indexOf('DOM-') !== 0 && id.indexOf('REC-') !== 0)) return true;
      const datos = datosDeEntrada(item);
      const marca = Number(datos && datos.actualizadoLocal) || 0;
      return marca > corte;
    });
  }

  function fusionarMesasConMemoria(nube) {
    const memoria = leerMesasMemoriaOLocal();
    const remotas = Array.isArray(nube.mesasActivas) ? nube.mesasActivas : [];
    const mapa = new Map();
    remotas.forEach(function (par) {
      const id = idDeEntrada(par);
      const datos = datosDeEntrada(par);
      if (!id || datos == null || mesasEliminadasLocal[id]) return;
      mapa.set(id, datos);
    });
    (Array.isArray(memoria) ? memoria : []).forEach(function (par) {
      const id = idDeEntrada(par);
      const local = datosDeEntrada(par);
      if (!id || local == null) return;
      if (mesasEliminadasLocal[id]) delete mesasEliminadasLocal[id];
      mapa.set(id, elegirPedidoOperacion(local, mapa.get(id)));
    });
    Object.keys(mesasEliminadasLocal).forEach(function (id) {
      if (!mapa.has(id)) delete mesasEliminadasLocal[id];
    });
    return Object.assign({}, nube, { mesasActivas: Array.from(mapa.entries()) });
  }

  function fusionarHistorial(remoto, local) {
    const mapa = new Map();
    (Array.isArray(remoto) ? remoto : []).forEach(function (item) {
      if (!item) return;
      const id = item.id != null ? String(item.id) : '';
      if (!id) return;
      mapa.set(id, item);
    });
    (Array.isArray(local) ? local : []).forEach(function (item) {
      if (!item) return;
      const id = item.id != null ? String(item.id) : '';
      if (!id) return;
      mapa.set(id, item);
    });
    return Array.from(mapa.values());
  }

  function marcarPersistiendoOperacion() {
    persistiendoOperacion += 1;
    try { window._operacionPersistiendo = true; } catch (e) { /* ignore */ }
  }
  function liberarPersistiendoOperacion() {
    setTimeout(function () {
      persistiendoOperacion = Math.max(0, persistiendoOperacion - 1);
      if (persistiendoOperacion) return;
      try { window._operacionPersistiendo = false; } catch (e) { /* ignore */ }
      operacionPendiente = null;
      if (operacionLocalEstaPendiente() || !negocioIdActual || !callbackOperacionVivo) return;
      const callback = callbackOperacionVivo;
      refOperacion().get().then(function (snap) {
        if (!snap.exists) return;
        if (persistiendoOperacion || operacionLocalEstaPendiente()) return;
        aplicarOperacionDesdeNube(operacionDesdeSnap(snap), callback, true);
      }).catch(function () { /* ignore */ });
    }, 700);
  }

  function publicarOperacion(nube, callback) {
    if (callback) callbackOperacionVivo = callback;
    if (persistiendoOperacion || operacionLocalEstaPendiente()) {
      operacionPendiente = { nube: nube, callback: callback };
      return;
    }
    aplicarOperacionDesdeNube(nube, callback, true);
  }

  let colaGuardarOperacion = Promise.resolve();
  async function guardarOperacion(datos) {
    const previo = colaGuardarOperacion;
    let soltar;
    colaGuardarOperacion = new Promise(function (resolver) { soltar = resolver; });
    await previo;
    try {
      return await guardarOperacionCuerpo(datos);
    } finally {
      soltar();
    }
  }

  async function guardarOperacionCuerpo(datos) {
    marcarPersistiendoOperacion();
    let revisionEscrita = revisionOperacionLocal;
    try {
    if (!negocioIdActual) await asegurarNegocio();
    const ref = refOperacion();
    let escrito = null;
    await db().runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        const limpio = operacionLimpia(snapshotOperacionLocal() || datos);
        const remotoPrev = snap.exists ? (snap.data() || {}) : {};
        const elegido = elegirContadoresDomRec(
          parseInt(limpio.contadorDomicilios, 10) || 0,
          parseInt(limpio.contadorRecoger, 10) || 0,
          limpio.contadoresReinicioEn || '',
          parseInt(remotoPrev.contadorDomicilios, 10) || 0,
          parseInt(remotoPrev.contadorRecoger, 10) || 0,
          remotoPrev.contadoresReinicioEn || ''
        );
        limpio.contadorDomicilios = elegido.dom;
        limpio.contadorRecoger = elegido.rec;
        limpio.contadoresReinicioEn = elegido.epoch;
        revisionEscrita = revisionOperacionLocal;
        escrito = escribirOperacionLocal(limpio);
        const payload = {
          mesasActivas: entradasAObjetos(escrito.mesasActivas),
          ordenesCocina: entradasAObjetos(escrito.ordenesCocina),
          historialCocina: escrito.historialCocina,
          pedidosCocinaListos: escrito.pedidosCocinaListos,
          contadorDomicilios: escrito.contadorDomicilios,
          contadorRecoger: escrito.contadorRecoger,
          contadoresReinicioEn: escrito.contadoresReinicioEn || '',
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!esMesero() && !esPropietario()) {
          payload.ultimaFechaContadores = escrito.ultimaFechaContadores;
          payload.nombresDomiciliarios = escrito.nombresDomiciliarios;
          payload.pantallaCocinaActivada = escrito.pantallaCocinaActivada;
          payload.cocinaSonidoActivado = escrito.cocinaSonidoActivado;
          payload.cocinaIntervaloActualizacion = escrito.cocinaIntervaloActualizacion;
          payload.impresoraCocinaIp = escrito.impresoraCocinaIp || '';
          payload.impresoraCocinaPuerto = escrito.impresoraCocinaPuerto || '9100';
          payload.impresoraCocinaAncho = escrito.impresoraCocinaAncho || '80';
          payload.posMostrarGastos = escrito.posMostrarGastos;
          payload.posMostrarInventario = escrito.posMostrarInventario;
          payload.posMostrarCierreAdmin = escrito.posMostrarCierreAdmin;
          payload.posMostrarBalance = escrito.posMostrarBalance;
          payload.posRequiereLogin = escrito.posRequiereLogin === true;
          payload.posInstaladorActivo = escrito.posInstaladorActivo === true;
          payload.posBotonesDefaultsVersion = escrito.posBotonesDefaultsVersion || POS_BOTONES_DEFAULTS_VERSION;
          payload.sesionesCobradas = unirSesionesCobradas(escrito);
        }
        const remoto = snap.exists ? (snap.data() || {}) : {};
        const sesiones = unirSesionesCobradas(remoto);
        payload.mesasActivas = fusionarListasOperacion(
          entradasAObjetos(remoto.mesasActivas),
          entradasAObjetos(escrito.mesasActivas),
          sesiones,
          idsMesasVistas
        );
        payload.ordenesCocina = fusionarListasOperacion(
          entradasAObjetos(remoto.ordenesCocina),
          entradasAObjetos(escrito.ordenesCocina),
          sesiones,
          idsCocinaVistas
        );
        payload.mesasActivas = quitarExternosPreviosAlReinicio(payload.mesasActivas, limpio.contadoresReinicioEn || remoto.contadoresReinicioEn);
        payload.ordenesCocina = quitarExternosPreviosAlReinicio(payload.ordenesCocina, limpio.contadoresReinicioEn || remoto.contadoresReinicioEn);
        const reinicioLocal = marcaContadores(limpio.contadoresReinicioEn);
        const reinicioRemoto = marcaContadores(remoto.contadoresReinicioEn);
        if (reinicioLocal > reinicioRemoto) {
          const idsLocales = {};
          (escrito.mesasActivas || []).forEach(function (item) {
            const id = idDeEntrada(item);
            if (id) idsLocales[id] = true;
          });
          payload.mesasActivas = (payload.mesasActivas || []).filter(function (item) {
            const id = idDeEntrada(item);
            if (!id || (id.indexOf('DOM-') !== 0 && id.indexOf('REC-') !== 0)) return true;
            return !!idsLocales[id];
          });
          payload.ordenesCocina = entradasAObjetos(escrito.ordenesCocina);
          payload.historialCocina = Array.isArray(escrito.historialCocina) ? escrito.historialCocina : [];
          payload.pedidosCocinaListos = Array.isArray(escrito.pedidosCocinaListos) ? escrito.pedidosCocinaListos : [];
        } else {
          payload.historialCocina = fusionarHistorial(remoto.historialCocina, escrito.historialCocina);
        }
        tx.set(ref, payload, { merge: true });
      });
    });
    confirmarRevisionOperacion(revisionEscrita);
    return escrito;
    } finally {
      liberarPersistiendoOperacion();
    }
  }

  let operacionTimer = null;
  function persistirOperacionDebounced() {
    marcarOperacionLocalPendiente();
    if (operacionTimer) clearTimeout(operacionTimer);
    operacionTimer = setTimeout(function () {
      if (!estaListo()) return;
      guardarOperacion(snapshotOperacionLocal()).catch(function (error) {
        console.warn('Operación no se guardó en la nube', error);
      });
    }, 400);
  }

  function persistirOperacionInmediato() {
    marcarOperacionLocalPendiente();
    if (operacionTimer) {
      clearTimeout(operacionTimer);
      operacionTimer = null;
    }
    if (!estaListo()) return Promise.resolve();
    return guardarOperacion(snapshotOperacionLocal()).catch(function (error) {
      console.warn('Operación no se guardó en la nube', error);
      if (esMesero() && typeof window.avisoMesero === 'function') {
        window.avisoMesero('No se pudo enviar el pedido a la caja. Revisa la conexión.');
      }
    });
  }

  async function sincronizarOperacion() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotOperacionLocal();
    if (!negocioIdActual) return operacionParaLocal(operacionLimpia(local));
    if (persistiendoOperacion) return operacionParaLocal(operacionLimpia(local));
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
        contadoresReinicioEn: nube.contadoresReinicioEn || '',
        ultimaFechaContadores: nube.ultimaFechaContadores,
        nombresDomiciliarios: nube.nombresDomiciliarios,
        pantallaCocinaActivada: nube.pantallaCocinaActivada,
        cocinaSonidoActivado: nube.cocinaSonidoActivado,
        cocinaIntervaloActualizacion: nube.cocinaIntervaloActualizacion,
        impresoraCocinaIp: nube.impresoraCocinaIp,
        impresoraCocinaPuerto: nube.impresoraCocinaPuerto,
        impresoraCocinaAncho: nube.impresoraCocinaAncho,
        sesionesCobradas: nube.sesionesCobradas,
        posMostrarGastos: nube.posMostrarGastos,
        posMostrarInventario: nube.posMostrarInventario,
        posMostrarCierreAdmin: nube.posMostrarCierreAdmin,
        posMostrarBalance: nube.posMostrarBalance,
        posRequiereLogin: nube.posRequiereLogin === true,
        posInstaladorActivo: nube.posInstaladorActivo === true,
        posBotonesDefaultsVersion: nube.posBotonesDefaultsVersion
      });
      const dataSnap = snap.data() || {};
      if (Number(dataSnap.posBotonesDefaultsVersion) !== POS_BOTONES_DEFAULTS_VERSION) {
        await persistirOperacionInmediato();
      }
      recordarOperacionVista(nube.mesasActivas, nube.ordenesCocina);
      return nube;
    }
    if (operacionTieneDatos(local) || local.cocinaIntervaloActualizacion) {
      await guardarOperacion(local);
      return operacionParaLocal(operacionLimpia(local));
    }
    return operacionParaLocal(operacionLimpia(local));
  }

  function payloadOperacionParaLocal(nube) {
    return {
      mesasActivas: entradasAObjetos(nube.mesasActivas),
      ordenesCocina: entradasAObjetos(nube.ordenesCocina),
      historialCocina: nube.historialCocina,
      pedidosCocinaListos: nube.pedidosCocinaListos,
      contadorDomicilios: nube.contadorDomicilios,
      contadorRecoger: nube.contadorRecoger,
      contadoresReinicioEn: nube.contadoresReinicioEn || '',
      ultimaFechaContadores: nube.ultimaFechaContadores,
      nombresDomiciliarios: nube.nombresDomiciliarios,
      pantallaCocinaActivada: nube.pantallaCocinaActivada,
      cocinaSonidoActivado: nube.cocinaSonidoActivado,
      cocinaIntervaloActualizacion: nube.cocinaIntervaloActualizacion,
      impresoraCocinaIp: nube.impresoraCocinaIp,
      impresoraCocinaPuerto: nube.impresoraCocinaPuerto,
      impresoraCocinaAncho: nube.impresoraCocinaAncho,
      sesionesCobradas: nube.sesionesCobradas,
      posMostrarGastos: nube.posMostrarGastos,
      posMostrarInventario: nube.posMostrarInventario,
      posMostrarCierreAdmin: nube.posMostrarCierreAdmin,
      posMostrarBalance: nube.posMostrarBalance,
      posRequiereLogin: nube.posRequiereLogin === true,
      posInstaladorActivo: nube.posInstaladorActivo === true,
      posBotonesDefaultsVersion: nube.posBotonesDefaultsVersion
    };
  }

  function aplicarOperacionDesdeNube(nube, callback, escribirLocal) {
    if (!nube) return;
    nube = fusionarMesasConMemoria(nube);
    if (operacionLocalEstaPendiente()) return;
    unirSesionesCobradas(nube);
    if (escribirLocal !== false && !persistiendoOperacion) {
      escribirOperacionLocal(payloadOperacionParaLocal(nube));
    }
    if (typeof callback === 'function') callback(nube);
    recordarOperacionVista(nube.mesasActivas, nube.ordenesCocina);
  }

  async function refrescarOperacionDesdeNube() {
    if (!negocioIdActual) return null;
    const snap = await refOperacion().get();
    if (!snap.exists) return null;
    const nube = operacionDesdeSnap(snap);
    unirSesionesCobradas(nube);
    if (!persistiendoOperacion && !operacionLocalEstaPendiente()) {
      escribirOperacionLocal(payloadOperacionParaLocal(nube));
    }
    return nube;
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
      publicarOperacion(nube, callback);
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

  const CLAVE_CLIENTES_PENDIENTES = 'clientesPendientesAlta';

  function idDeCliente(cliente) {
    if (!cliente || cliente.id == null || cliente.id === '') return '';
    return String(cliente.id);
  }

  function fusionarClientesAditivo(base, extras) {
    const mapa = new Map();
    (Array.isArray(base) ? base : []).forEach(function (cliente) {
      if (!cliente || typeof cliente !== 'object') return;
      const id = idDeCliente(cliente);
      if (id) mapa.set(id, cliente);
    });
    (Array.isArray(extras) ? extras : []).forEach(function (cliente) {
      if (!cliente || typeof cliente !== 'object') return;
      const id = idDeCliente(cliente);
      if (id && !mapa.has(id)) mapa.set(id, cliente);
    });
    return Array.from(mapa.values());
  }

  function leerClientesPendientes() {
    return parseListaLocal(CLAVE_CLIENTES_PENDIENTES);
  }

  function guardarClientesPendientes(lista) {
    localStorage.setItem(CLAVE_CLIENTES_PENDIENTES, JSON.stringify(Array.isArray(lista) ? lista : []));
  }

  function registrarClientesPendientes(lista) {
    guardarClientesPendientes(fusionarClientesAditivo(leerClientesPendientes(), lista));
  }

  function limpiarClientesPendientesEn(lista) {
    const ids = {};
    (Array.isArray(lista) ? lista : []).forEach(function (cliente) {
      const id = idDeCliente(cliente);
      if (id) ids[id] = true;
    });
    guardarClientesPendientes(leerClientesPendientes().filter(function (cliente) {
      return !ids[idDeCliente(cliente)];
    }));
  }

  function aplicarPendientesAClientes(clientes) {
    return fusionarClientesAditivo(clientes, leerClientesPendientes());
  }

  function idDeVenta(venta) {
    if (venta && venta.id != null && venta.id !== '') return String(venta.id);
    return String(Date.now());
  }

  function valorParaJsonFirebase(clave, valor) {
    if (valor === undefined) return null;
    if (valor && typeof valor.toDate === 'function' && typeof valor.seconds === 'number') {
      try { return valor.toDate().toISOString(); } catch (e) { return null; }
    }
    return valor;
  }

  function ventaLimpia(venta) {
    const origen = venta && typeof venta === 'object' ? venta : {};
    const id = idDeVenta(origen);
    const texto = JSON.stringify(Object.assign({}, origen, { id: id }), valorParaJsonFirebase);
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

  let persistiendoVentas = 0;
  function marcarPersistiendoVentas() {
    persistiendoVentas += 1;
    try { window._ventasPersistiendo = true; } catch (e) { /* ignore */ }
  }
  function liberarPersistiendoVentas() {
    setTimeout(function () {
      persistiendoVentas = Math.max(0, persistiendoVentas - 1);
      if (!persistiendoVentas) {
        try { window._ventasPersistiendo = false; } catch (e) { /* ignore */ }
      }
    }, 700);
  }

  async function guardarVenta(venta) {
    marcarPersistiendoVentas();
    try {
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
    } finally {
      liberarPersistiendoVentas();
    }
  }

  async function sincronizarVentas() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = fusionarVentasLocales();
    if (!negocioIdActual) {
      escribirVentasLocal(local);
      return local;
    }
    if (persistiendoVentas) return local;
    const snap = await colVentas().get();
    const nube = [];
    snap.forEach(function (doc) {
      const data = doc.data() || {};
      delete data.actualizadoEn;
      nube.push(ventaLimpia(data));
    });
    if (nube.length === 0 && local.length) {
      if (!puedeEscribirCaja()) {
        escribirVentasLocal(nube.length ? nube : local);
        return nube.length ? nube : local;
      }
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
    if (faltan.length && puedeEscribirCaja()) await subirVentasEnLotes(faltan);
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
      if (persistiendoVentas) return;
      const lista = [];
      snap.forEach(function (doc) {
        const data = doc.data() || {};
        delete data.actualizadoEn;
        lista.push(ventaLimpia(data));
      });
      const fusion = fusionarListasPorId(fusionarVentasLocales(), lista);
      escribirVentasLocal(fusion);
      if (typeof callback === 'function') callback(fusion);
    }, function (error) {
      console.warn('No se pudo escuchar las ventas', error);
    });
    return unsubVentas;
  }

  function objetoLimpio(obj) {
    const origen = obj && typeof obj === 'object' ? obj : {};
    const id = origen.id != null && origen.id !== '' ? origen.id : Date.now();
    const texto = JSON.stringify(Object.assign({}, origen, { id: id }), valorParaJsonFirebase);
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
      if (!puedeEscribirCaja()) {
        escribirLocal(nube.length ? nube : local);
        return nube.length ? nube : local;
      }
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
    if (faltan.length && puedeEscribirCaja()) await subirListaEnLotes(nombreCol, faltan);
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

  function fusionarListasPorId(local, nube) {
    const mapa = new Map();
    (Array.isArray(nube) ? nube : []).forEach(function (item) {
      if (!item) return;
      const id = item.id != null && item.id !== '' ? String(item.id) : '';
      if (id) mapa.set(id, item);
    });
    (Array.isArray(local) ? local : []).forEach(function (item) {
      if (!item) return;
      const id = item.id != null && item.id !== '' ? String(item.id) : '';
      if (id && !mapa.has(id)) mapa.set(id, item);
    });
    return Array.from(mapa.values());
  }

  let persistiendoFinanzas = 0;
  function marcarPersistiendoFinanzas() {
    persistiendoFinanzas += 1;
    try { window._finanzasPersistiendo = true; } catch (e) { /* ignore */ }
  }
  function liberarPersistiendoFinanzas() {
    setTimeout(function () {
      persistiendoFinanzas = Math.max(0, persistiendoFinanzas - 1);
      if (!persistiendoFinanzas) {
        try { window._finanzasPersistiendo = false; } catch (e) { /* ignore */ }
      }
    }, 700);
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
    if (cfg.ultimaHoraCierre) {
      const localMs = Date.parse(localStorage.getItem('ultimaHoraCierre') || '');
      const nubeMs = Date.parse(cfg.ultimaHoraCierre);
      if (!Number.isFinite(localMs) || (Number.isFinite(nubeMs) && nubeMs >= localMs)) {
        localStorage.setItem('ultimaHoraCierre', cfg.ultimaHoraCierre);
      }
    }
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
    marcarPersistiendoFinanzas();
    try {
      const cfg = snapshotConfigCajaLocal();
      if (!estaListo()) return cfg;
      await refConfigCaja().set(Object.assign({}, cfg, {
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }), { merge: true });
      return cfg;
    } finally {
      liberarPersistiendoFinanzas();
    }
  }

  async function sincronizarConfigCaja() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotConfigCajaLocal();
    if (!negocioIdActual) return local;
    const snap = await refConfigCaja().get();
    if (!snap.exists) {
      if (puedeEscribirCaja() && (local.ultimaHoraCierre || local.ultimaBaseCaja || local.operarDespuesMedianoche)) {
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
    marcarPersistiendoFinanzas();
    return guardarDocLista('cierres', ['historialCierres'], cierre, escribirCierresLocal)
      .finally(liberarPersistiendoFinanzas);
  }
  function guardarCierreOperativo(cierre) {
    marcarPersistiendoFinanzas();
    return guardarDocLista('cierresOperativos', ['historialCierresOperativos'], cierre, escribirCierresOperativosLocal)
      .finally(liberarPersistiendoFinanzas);
  }

  async function eliminarGastoNube(id) {
    marcarPersistiendoFinanzas();
    try {
      const lista = fusionarListasLocales(['historialGastos', 'gastos']).filter(function (g) {
        return String(g.id) !== String(id);
      });
      escribirGastosLocal(lista);
      if (estaListo() && id != null) {
        await colNegocio('gastos').doc(String(id)).delete();
      }
      return lista;
    } finally {
      liberarPersistiendoFinanzas();
    }
  }

  async function vaciarColeccionDocs(col) {
    const snap = await col.get();
    const refs = [];
    snap.forEach(function (doc) { refs.push(doc.ref); });
    for (let i = 0; i < refs.length; i += 400) {
      const lote = refs.slice(i, i + 400);
      const batch = db().batch();
      lote.forEach(function (ref) { batch.delete(ref); });
      await batch.commit();
    }
  }

  function vaciarContableLocal() {
    escribirVentasLocal([]);
    escribirGastosLocal([]);
    escribirCierresLocal([]);
    escribirCierresOperativosLocal([]);
    localStorage.setItem('domicilios', JSON.stringify([]));
    localStorage.setItem('mesasActivas', JSON.stringify([]));
    localStorage.setItem('estadoMesas', JSON.stringify([]));
    localStorage.setItem('ordenesCocina', JSON.stringify([]));
    localStorage.setItem('ordenesPendientes', JSON.stringify([]));
    localStorage.setItem('historialCocina', JSON.stringify([]));
    localStorage.setItem('pedidosCocinaListos', JSON.stringify([]));
    localStorage.setItem('contadorDomicilios', '0');
    localStorage.setItem('contadorRecoger', '0');
    localStorage.setItem('contadoresReinicioEn', new Date().toISOString());
    localStorage.setItem('ultimaFechaContadores', new Date().toLocaleDateString());
    localStorage.removeItem('contadorDelivery');
    localStorage.removeItem('ultimaHoraCierre');
    localStorage.removeItem('ultimaBaseCaja');
    limpiarSesionesCobradas();
    try { window.ventas = []; } catch (e) { /* ignore */ }
    try { window.gastos = []; } catch (e) { /* ignore */ }
  }

  async function vaciarDatosContables() {
    marcarPersistiendoVentas();
    marcarPersistiendoFinanzas();
    marcarPersistiendoOperacion();
    try {
      vaciarContableLocal();
      if (estaListo() && negocioIdActual && puedeEscribirCaja()) {
        await vaciarColeccionDocs(colVentas());
        await vaciarColeccionDocs(colNegocio('gastos'));
        await vaciarColeccionDocs(colNegocio('cierres'));
        await vaciarColeccionDocs(colNegocio('cierresOperativos'));
      }
      vaciarContableLocal();
      if (estaListo() && puedeEscribirCaja()) {
        await persistirOperacionInmediato();
        await persistirConfigCaja();
      }
    } finally {
      liberarPersistiendoVentas();
      liberarPersistiendoFinanzas();
      liberarPersistiendoOperacion();
    }
  }

  async function sincronizarFinanzas() {
    if (persistiendoFinanzas) {
      return {
        gastos: fusionarListasLocales(['historialGastos', 'gastos']),
        cierres: fusionarListasLocales(['historialCierres']),
        cierresOperativos: fusionarListasLocales(['historialCierresOperativos']),
        configCaja: snapshotConfigCajaLocal()
      };
    }
  const resultados = await Promise.all([
    sincronizarLista('gastos', ['historialGastos', 'gastos'], escribirGastosLocal),
    sincronizarLista('cierres', ['historialCierres'], escribirCierresLocal),
    sincronizarLista('cierresOperativos', ['historialCierresOperativos'], escribirCierresOperativosLocal),
    sincronizarConfigCaja()
  ]);
  return {
    gastos: resultados[0],
    cierres: resultados[1],
    cierresOperativos: resultados[2],
    configCaja: resultados[3]
  };
  }

  let unsubGastos = null;
  let unsubCierres = null;
  let unsubCierresOp = null;
  let unsubConfigCaja = null;

  function escucharColeccion(unsubRefNombre, nombreCol, clavesLocal, escribirLocal, callback) {
    return colNegocio(nombreCol).onSnapshot(function (snap) {
      if (persistiendoFinanzas) return;
      const lista = [];
      snap.forEach(function (doc) {
        const data = doc.data() || {};
        delete data.actualizadoEn;
        lista.push(objetoLimpio(data));
      });
      const fusion = fusionarListasPorId(fusionarListasLocales(clavesLocal), lista);
      escribirLocal(fusion);
      if (typeof callback === 'function') callback(fusion);
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
    unsubGastos = escucharColeccion('gastos', 'gastos', ['historialGastos', 'gastos'], escribirGastosLocal, cb.gastos);
    unsubCierres = escucharColeccion('cierres', 'cierres', ['historialCierres'], escribirCierresLocal, cb.cierres);
    unsubCierresOp = escucharColeccion('cierresOperativos', 'cierresOperativos', ['historialCierresOperativos'], escribirCierresOperativosLocal, cb.cierresOperativos);
    unsubConfigCaja = refConfigCaja().onSnapshot(function (snap) {
      if (persistiendoFinanzas) return;
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
    const origen = Array.isArray(lista) ? lista : [];
    const recortada = origen.map(function (item) {
      if (!item || typeof item !== 'object') return item;
      if (!Array.isArray(item.ajustes) || item.ajustes.length <= 200) return item;
      const copia = Object.assign({}, item);
      copia.ajustes = item.ajustes.slice(-200);
      return copia;
    });
    const texto = JSON.stringify(recortada, function (clave, valor) {
      return valor === undefined ? null : valor;
    });
    return JSON.parse(texto);
  }

  let persistiendoInventario = false;
  let inventarioTimer = null;

  function marcarPersistiendoInventario() {
    persistiendoInventario = true;
    try { window._inventarioPersistiendo = true; } catch (e) { /* ignore */ }
  }

  function liberarPersistiendoInventario() {
    setTimeout(function () {
      persistiendoInventario = false;
      try { window._inventarioPersistiendo = false; } catch (e) { /* ignore */ }
    }, 700);
  }

  async function guardarInventarioNube(lista) {
    marcarPersistiendoInventario();
    try {
      if (!negocioIdActual) await asegurarNegocio();
      const limpio = inventarioLimpio(lista != null ? lista : inventarioDesdeLocal());
      escribirInventarioLocal(limpio);
      if (!negocioIdActual) return limpio;
      await refInventario().set({
        items: limpio,
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return limpio;
    } finally {
      liberarPersistiendoInventario();
    }
  }

  function persistirInventarioDebounced() {
    marcarPersistiendoInventario();
    if (inventarioTimer) clearTimeout(inventarioTimer);
    inventarioTimer = setTimeout(function () {
      if (!estaListo()) {
        liberarPersistiendoInventario();
        return;
      }
      guardarInventarioNube(inventarioDesdeLocal()).catch(function (error) {
        console.warn('Inventario no se guardó en la nube', error);
      });
    }, 400);
  }

  function persistirInventarioInmediato() {
    marcarPersistiendoInventario();
    if (inventarioTimer) {
      clearTimeout(inventarioTimer);
      inventarioTimer = null;
    }
    if (!estaListo()) {
      liberarPersistiendoInventario();
      return Promise.resolve(inventarioDesdeLocal());
    }
    return guardarInventarioNube(inventarioDesdeLocal()).catch(function (error) {
      console.warn('Inventario no se guardó en la nube', error);
    });
  }

  function timestampInventario(item) {
    const t = Date.parse((item && item.ultimaActualizacion) || 0);
    return Number.isFinite(t) ? t : 0;
  }

  function claveInventario(item) {
    if (!item) return '';
    if (item.codigo) return 'c:' + String(item.codigo);
    if (item.nombre) return 'n:' + String(item.nombre).toLowerCase().trim();
    return '';
  }

  function fusionarInventario(local, nube) {
    const mapa = {};
    (Array.isArray(nube) ? nube : []).forEach(function (item) {
      const k = claveInventario(item);
      if (k) mapa[k] = item;
    });
    (Array.isArray(local) ? local : []).forEach(function (item) {
      const k = claveInventario(item);
      if (!k) return;
      const actual = mapa[k];
      if (!actual || timestampInventario(item) >= timestampInventario(actual)) {
        mapa[k] = item;
      }
    });
    const ids = Object.keys(mapa);
    if (!ids.length) return Array.isArray(nube) && nube.length ? nube : (local || []);
    return ids.map(function (k) { return mapa[k]; });
  }

  async function sincronizarInventario() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = inventarioDesdeLocal();
    if (!negocioIdActual) return inventarioLimpio(local);
    const snap = await refInventario().get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (!Array.isArray(data.items)) {
        if (local.length) {
          if (puedeEscribirCaja()) await guardarInventarioNube(local);
          return inventarioLimpio(local);
        }
        return [];
      }
      const nube = inventarioLimpio(data.items);
      const fusion = fusionarInventario(local, nube);
      escribirInventarioLocal(fusion);
      if (JSON.stringify(fusion) !== JSON.stringify(nube)) {
        if (puedeEscribirCaja()) await guardarInventarioNube(fusion);
      }
      return fusion;
    }
    if (local.length) {
      if (puedeEscribirCaja()) await guardarInventarioNube(local);
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
      if (persistiendoInventario) return;
      if (!snap.exists) return;
      const data = snap.data() || {};
      if (!Array.isArray(data.items)) return;
      const nube = inventarioLimpio(data.items);
      const fusion = fusionarInventario(inventarioDesdeLocal(), nube);
      escribirInventarioLocal(fusion);
      if (typeof callback === 'function') callback(fusion);
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

  function refFacturacion() {
    if (!negocioIdActual) throw new Error('No hay negocio asociado a esta cuenta');
    return db().collection('negocios').doc(negocioIdActual).collection('config').doc('facturacion');
  }

  function resolucionFacturacionLimpia(datos) {
    const d = datos && typeof datos === 'object' ? datos : {};
    const num = function (v) {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    return {
      numero: String(d.numero || '').trim(),
      fecha: String(d.fecha || '').trim(),
      prefijo: String(d.prefijo || '').trim().toUpperCase().slice(0, 4),
      rangoDesde: num(d.rangoDesde),
      rangoHasta: num(d.rangoHasta),
      vigenciaDesde: String(d.vigenciaDesde || '').trim(),
      vigenciaHasta: String(d.vigenciaHasta || '').trim(),
      proximoConsecutivo: num(d.proximoConsecutivo)
    };
  }

  function facturacionLimpia(datos) {
    const d = datos && typeof datos === 'object' ? datos : {};
    const tarifa = parseFloat(d.tarifaInc);
    return {
      tipoDocumentoEmisor: d.tipoDocumentoEmisor === 'CC' ? 'CC' : 'NIT',
      digitoVerificacion: String(d.digitoVerificacion || '').replace(/\D/g, '').slice(0, 1),
      municipio: String(d.municipio || '').trim(),
      codigoDane: String(d.codigoDane || '').replace(/\D/g, '').slice(0, 8),
      regimen: (d.regimen === 'no_responsable' || d.regimen === 'simple') ? d.regimen : 'iva',
      aplicaIncRestaurantes: d.aplicaIncRestaurantes === true,
      tarifaInc: Number.isFinite(tarifa) ? tarifa : 8,
      responsabilidades: String(d.responsabilidades || '').trim(),
      documentoPorDefecto: d.documentoPorDefecto === 'factura' ? 'factura' : 'pos',
      resolucionPos: resolucionFacturacionLimpia(d.resolucionPos),
      resolucionFactura: resolucionFacturacionLimpia(d.resolucionFactura)
    };
  }

  function snapshotFacturacionLocal() {
    try {
      const bruto = JSON.parse(localStorage.getItem('facturacionElectronica') || '{}');
      return facturacionLimpia(bruto);
    } catch (e) {
      return facturacionLimpia({});
    }
  }

  function escribirFacturacionLocal(datos) {
    const limpio = facturacionLimpia(datos);
    localStorage.setItem('facturacionElectronica', JSON.stringify(limpio));
    return limpio;
  }

  async function persistirFacturacion(datos) {
    if (!esAdminNegocio()) return snapshotFacturacionLocal();
    const limpio = escribirFacturacionLocal(datos != null ? datos : snapshotFacturacionLocal());
    if (!negocioIdActual) await asegurarNegocio();
    if (!estaListo() || !negocioIdActual) return limpio;
    await refFacturacion().set(Object.assign({}, limpio, {
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }), { merge: true });
    return limpio;
  }

  async function sincronizarFacturacion() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotFacturacionLocal();
    if (!negocioIdActual) return local;
    const snap = await refFacturacion().get();
    if (snap.exists) {
      const data = snap.data() || {};
      delete data.actualizadoEn;
      return escribirFacturacionLocal(data);
    }
    if (esAdminNegocio() && (local.resolucionPos.numero || local.resolucionFactura.numero || local.municipio)) {
      await persistirFacturacion(local);
    }
    return local;
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
    const clientes = aplicarPendientesAClientes(Array.isArray(d.clientes) ? d.clientes : []);
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
    const escrito = escribirDatosLocal(datosLimpios(datos));
    if (!negocioIdActual) return escrito;
    await refDatos().set(Object.assign({}, escrito, {
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }), { merge: true });
    return escrito;
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

  function persistirClientes(lista) {
    const locales = Array.isArray(lista) ? lista : parseListaLocal('clientes');
    localStorage.setItem('clientes', JSON.stringify(locales));
    if (!estaListo() || !negocioIdActual) return Promise.resolve(locales);
    return db().runTransaction(function (transaction) {
      const ref = refDatos();
      return transaction.get(ref).then(function (snap) {
        const data = snap.exists ? (snap.data() || {}) : {};
        const nube = Array.isArray(data.clientes) ? data.clientes : [];
        const fusionados = fusionarClientesAditivo(nube, locales);
        transaction.set(ref, {
          clientes: fusionados,
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return fusionados;
      });
    }).then(function (fusionados) {
      limpiarClientesPendientesEn(fusionados);
      const conPendientes = aplicarPendientesAClientes(fusionados);
      localStorage.setItem('clientes', JSON.stringify(conPendientes));
      return conPendientes;
    }).catch(function (error) {
      console.warn('No se pudieron guardar los clientes en la nube', error);
      return locales;
    });
  }

  function persistirAltaCliente(cliente) {
    if (!cliente || typeof cliente !== 'object') {
      return persistirClientes();
    }
    registrarClientesPendientes([cliente]);
    const lista = fusionarClientesAditivo(parseListaLocal('clientes'), [cliente]);
    return persistirClientes(lista);
  }

  async function sincronizarDatos() {
    if (!negocioIdActual) await asegurarNegocio();
    const local = snapshotDatosLocal();
    if (!negocioIdActual) return datosLimpios(local);
    const snap = await refDatos().get();
    if (snap.exists) {
      const data = snap.data() || {};
      delete data.actualizadoEn;
      return escribirDatosLocal(datosLimpios(data));
    }
    if (local.clientes.length || local.recordatorios.length || local.cotizaciones.length) {
      try {
        await guardarDatosNube(local);
      } catch (error) {
        if (local.clientes.length) {
          await persistirClientes(local.clientes);
        } else {
          console.warn('Clientes, recordatorios o cotizaciones no se guardaron en la nube', error);
        }
      }
      return datosLimpios(snapshotDatosLocal());
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
      const local = escribirDatosLocal(datosLimpios(data));
      if (typeof callback === 'function') callback(local);
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
    if (!esAdminNegocio()) return snapshotExtrasLocal();
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
    if (esAdminNegocio() && (local.logoNegocio || (local.configuracionEmailJS && local.configuracionEmailJS.emailDestino))) {
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
    const facturacion = await sincronizarFacturacion();
    return { datos: datos, extras: extras, facturacion: facturacion };
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
    if (!esAdminNegocio()) return hashes || {};
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
    if (esMesero() || esPropietario()) return leerPinesLocal();
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
      localStorage.setItem(claveSesion('sesionActiva'), 'true');
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
      localStorage.setItem(claveSesion('sesionActiva'), 'true');
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
    localStorage.removeItem(claveSesion('sesionActiva'));
    olvidarRolLocal();
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
        if (appSecundaria()) appActual();
        else firebase.initializeApp(cfg);
        auth().languageCode = 'es';
        try {
          await auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (e) {
          console.warn('No se pudo guardar la sesión en el celular', e);
        }
        try {
          await db().enablePersistence({ synchronizeTabs: !appSecundaria() });
        } catch (e) {
          if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
            console.warn('Persistencia offline de Firestore:', e);
          }
        }
        const authFb = auth();
        if (typeof authFb.authStateReady === 'function') {
          await authFb.authStateReady();
          notificarAuth(authFb.currentUser);
        }
        authFb.onAuthStateChanged(function (user) {
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
    sesionRecordada: sesionRecordada,
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
    crearCuentaPos: crearCuentaPos,
    actualizarPos: actualizarPos,
    eliminarPos: eliminarPos,
    crearCuentaPropietario: crearCuentaPropietario,
    actualizarPropietario: actualizarPropietario,
    eliminarPropietario: eliminarPropietario,
    getRol: getRol,
    esAdminNegocio: esAdminNegocio,
    esMesero: esMesero,
    esPos: esPos,
    esPropietario: esPropietario,
    esCaja: esCaja,
    sexoMeseroActual: sexoMeseroActual,
    etiquetaRolMeseroActual: etiquetaRolMeseroActual,
    uidMeseroActual: uidMeseroActual,
    nombreMeseroActual: nombreMeseroActual,
    nombreUsuarioActual: nombreUsuarioActual,
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
    marcarMesaEliminada: marcarMesaEliminada,
    refrescarOperacionDesdeNube: refrescarOperacionDesdeNube,
    escucharOperacion: escucharOperacion,
    marcarSesionCobrada: marcarSesionCobrada,
    sesionYaCobrada: sesionYaCobrada,
    unirSesionesCobradas: unirSesionesCobradas,
    limpiarSesionesCobradas: limpiarSesionesCobradas,
    guardarVenta: guardarVenta,
    sincronizarVentas: sincronizarVentas,
    escucharVentas: escucharVentas,
    ventasDesdeLocal: fusionarVentasLocales,
    guardarGasto: guardarGasto,
    eliminarGastoNube: eliminarGastoNube,
    vaciarDatosContables: vaciarDatosContables,
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
    persistirClientes: persistirClientes,
    persistirAltaCliente: persistirAltaCliente,
    sincronizarDatos: sincronizarDatos,
    escucharDatos: escucharDatos,
    persistirExtras: persistirExtras,
    sincronizarExtras: sincronizarExtras,
    escucharExtras: escucharExtras,
    persistirFacturacion: persistirFacturacion,
    sincronizarFacturacion: sincronizarFacturacion,
    facturacionDesdeLocal: snapshotFacturacionLocal,
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
