let mesasActivas = new Map();
let ordenesCocina = new Map();
let historialCocina = [];
let categorias = [];
let productos = [];
let mesaSeleccionada = null;
let categoriaActual = '';
let productoPendiente = null;
let hashOperacion = '';
let persistiendo = false;

function formatearPrecioMesero(valor) {
  return '$ ' + Math.round(Number(valor) || 0).toLocaleString('es-CO');
}

function crearIdSesionMesa() {
  return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function crearPedidoVacio() {
  return {
    items: [],
    estado: 'pendiente',
    fecha: new Date().toLocaleString(),
    ronda: 1,
    sesionId: crearIdSesionMesa(),
    origen: 'mesero'
  };
}

function rondaDeItem(item) {
  const ronda = Number(item && item.ronda);
  return Number.isFinite(ronda) && ronda > 0 ? ronda : 1;
}

function sincronizarRonda(pedido) {
  if (!pedido) return 1;
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  if (!items.length) {
    pedido.ronda = pedido.ronda > 0 ? pedido.ronda : 1;
    return pedido.ronda;
  }
  const maxRonda = items.reduce(function (max, item) { return Math.max(max, rondaDeItem(item)); }, 1);
  const hayPendientes = items.some(function (item) { return item.estado !== 'en_cocina'; });
  pedido.ronda = hayPendientes ? maxRonda : maxRonda + 1;
  return pedido.ronda;
}

function normalizarPedido(pedido) {
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido)) {
    pedido = crearPedidoVacio();
  }
  if (!Array.isArray(pedido.items)) pedido.items = [];
  if (!pedido.sesionId) pedido.sesionId = crearIdSesionMesa();
  sincronizarRonda(pedido);
  return pedido;
}

function mapDesdeEntradas(lista) {
  const mapa = new Map();
  (Array.isArray(lista) ? lista : []).forEach(function (par) {
    if (!Array.isArray(par) || par.length < 2 || par[0] == null) return;
    mapa.set(String(par[0]), par[1]);
  });
  return mapa;
}

function leerCatalogoLocal() {
  try {
    const cats = JSON.parse(localStorage.getItem('categorias') || '[]');
    categorias = Array.isArray(cats) ? cats : [];
  } catch (e) { categorias = []; }
  try {
    const prods = JSON.parse(localStorage.getItem('productos') || '[]');
    productos = Array.isArray(prods) ? prods : [];
  } catch (e) { productos = []; }
}

function leerOperacionLocal() {
  try {
    mesasActivas = mapDesdeEntradas(JSON.parse(localStorage.getItem('mesasActivas') || '[]'));
  } catch (e) { mesasActivas = new Map(); }
  try {
    ordenesCocina = mapDesdeEntradas(JSON.parse(localStorage.getItem('ordenesCocina') || '[]'));
  } catch (e) { ordenesCocina = new Map(); }
  try {
    const hist = JSON.parse(localStorage.getItem('historialCocina') || '[]');
    historialCocina = Array.isArray(hist) ? hist : [];
  } catch (e) { historialCocina = []; }
  mesasActivas.forEach(function (pedido, id) {
    mesasActivas.set(id, normalizarPedido(pedido));
  });
}

function hashDeOperacion() {
  try {
    return JSON.stringify({
      mesas: Array.from(mesasActivas.entries()),
      cocina: Array.from(ordenesCocina.entries()),
      historial: historialCocina.length
    });
  } catch (e) {
    return String(Date.now());
  }
}

function persistirMesero(inmediato) {
  mesasActivas.forEach(function (pedido, id) {
    mesasActivas.set(id, normalizarPedido(pedido));
  });
  localStorage.setItem('mesasActivas', JSON.stringify(Array.from(mesasActivas.entries())));
  localStorage.setItem('ordenesCocina', JSON.stringify(Array.from(ordenesCocina.entries())));
  localStorage.setItem('historialCocina', JSON.stringify(historialCocina));
  hashOperacion = hashDeOperacion();
  if (!window.ToySoftFirebase) return;
  persistiendo = true;
  const fin = function () { setTimeout(function () { persistiendo = false; }, 500); };
  const p = inmediato
    ? ToySoftFirebase.persistirOperacionInmediato()
    : ToySoftFirebase.persistirOperacionDebounced();
  if (p && typeof p.then === 'function') p.finally(fin);
  else fin();
}

function aplicarOperacionNube(datos) {
  if (persistiendo || !datos) return;
  mesasActivas = mapDesdeEntradas(datos.mesasActivas);
  ordenesCocina = mapDesdeEntradas(datos.ordenesCocina);
  historialCocina = Array.isArray(datos.historialCocina) ? datos.historialCocina : [];
  mesasActivas.forEach(function (pedido, id) {
    mesasActivas.set(id, normalizarPedido(pedido));
  });
  const nuevo = hashDeOperacion();
  if (nuevo === hashOperacion) return;
  hashOperacion = nuevo;
  pintarMesero();
}

function esMesaComedor(id) {
  const clave = String(id || '');
  return clave && !clave.startsWith('DOM-') && !clave.startsWith('REC-');
}

function contarItems(pedido) {
  if (!pedido || !Array.isArray(pedido.items)) return 0;
  return pedido.items.reduce(function (sum, item) { return sum + (Number(item.cantidad) || 0); }, 0);
}

function mostrarVista(id) {
  document.querySelectorAll('.vista').forEach(function (el) { el.classList.remove('visible'); });
  const vista = document.getElementById(id);
  if (vista) vista.classList.add('visible');
}

function pintarListaMesas() {
  const cont = document.getElementById('listaMesasMesero');
  if (!cont) return;
  const ids = Array.from(mesasActivas.keys()).filter(esMesaComedor).sort(function (a, b) {
    return Number(a) - Number(b) || String(a).localeCompare(String(b));
  });
  if (!ids.length) {
    cont.innerHTML = '<div class="col-12 text-muted">No hay mesas abiertas. Escribe un número y ábrela.</div>';
    return;
  }
  cont.innerHTML = ids.map(function (id) {
    const pedido = mesasActivas.get(id);
    const n = contarItems(pedido);
    const activa = String(id) === String(mesaSeleccionada) ? ' activa' : '';
    return '<div class="col-4 col-sm-3">' +
      '<button type="button" class="mesa-chip ocupada w-100' + activa + '" onclick="abrirMesaMesero(\'' + String(id).replace(/'/g, '') + '\')">' +
      '<div>Mesa ' + id + '</div><div class="small fw-normal text-info">' + n + ' prod.</div></button></div>';
  }).join('');
}

function pintarOrden() {
  const cont = document.getElementById('ordenMesero');
  const barra = document.getElementById('barraEnviar');
  const sub = document.getElementById('subtituloMesero');
  if (sub) sub.textContent = mesaSeleccionada ? ('Mesa ' + mesaSeleccionada) : 'Mesas';
  if (!cont) return;
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    cont.innerHTML = '';
    if (barra) barra.style.display = 'none';
    return;
  }
  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  mesasActivas.set(mesaSeleccionada, pedido);
  if (!pedido.items.length) {
    cont.innerHTML = '<div class="text-muted">Mesa vacía. Elige productos abajo.</div>';
    if (barra) barra.style.display = 'none';
    return;
  }
  let total = 0;
  let pendientes = 0;
  cont.innerHTML = pedido.items.map(function (item, idx) {
    const subtotal = (Number(item.precio) || 0) * (Number(item.cantidad) || 0);
    total += subtotal;
    const enCocina = item.estado === 'en_cocina';
    if (!enCocina) pendientes += 1;
    const nota = item.detalles ? '<div class="small text-white-50">' + escaparHtml(item.detalles) + '</div>' : '';
    const quitar = enCocina ? '' : '<button type="button" class="btn btn-sm btn-outline-danger" onclick="quitarItemMesero(' + idx + ')">Quitar</button>';
    return '<div class="d-flex justify-content-between align-items-start border-bottom border-secondary py-2">' +
      '<div><div class="' + (enCocina ? 'item-cocina' : 'item-pendiente') + '">' + (item.cantidad || 1) + ' × ' + escaparHtml(item.nombre) + '</div>' +
      nota + '<div class="small">' + (enCocina ? 'En cocina' : 'Pendiente') + '</div></div>' +
      '<div class="text-end">' + formatearPrecioMesero(subtotal) + '<div class="mt-1">' + quitar + '</div></div></div>';
  }).join('') + '<div class="fw-bold mt-2">Total: ' + formatearPrecioMesero(total) + '</div>';
  if (barra) barra.style.display = pendientes ? 'block' : 'none';
}

function escaparHtml(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pintarCategorias() {
  const cont = document.getElementById('categoriasMesero');
  if (!cont) return;
  const lista = categorias.length ? categorias : [];
  if (!categoriaActual && lista.length) categoriaActual = lista[0];
  cont.innerHTML = lista.map(function (cat) {
    const activa = cat === categoriaActual ? ' active' : '';
    return '<button type="button" class="btn btn-outline-info btn-sm cat-btn' + activa + '" onclick="elegirCategoriaMesero(this.dataset.cat)" data-cat="' + escaparHtml(cat) + '">' + escaparHtml(cat) + '</button>';
  }).join('');
}

function pintarProductos() {
  const cont = document.getElementById('productosMesero');
  if (!cont) return;
  const lista = productos.filter(function (p) {
    if (!categoriaActual) return true;
    return p.categoria === categoriaActual;
  });
  if (!lista.length) {
    cont.innerHTML = '<div class="text-muted">No hay productos en esta categoría.</div>';
    return;
  }
  cont.innerHTML = lista.map(function (p) {
    return '<div class="prod-card" onclick="abrirProductoMesero(\'' + String(p.id).replace(/'/g, '') + '\')">' +
      '<div class="fw-bold">' + escaparHtml(p.nombre) + '</div>' +
      '<div class="text-info">' + formatearPrecioMesero(p.precio) + '</div></div>';
  }).join('');
}

function pintarMesero() {
  if (mesaSeleccionada) {
    mostrarVista('vistaPedido');
    pintarOrden();
    pintarCategorias();
    pintarProductos();
  } else {
    mostrarVista('vistaMesas');
    const barra = document.getElementById('barraEnviar');
    if (barra) barra.style.display = 'none';
    pintarListaMesas();
  }
  pintarNombreMeseroCabecera();
}

function crearMesaMesero() {
  const input = document.getElementById('nuevaMesaMesero');
  const numero = input ? String(input.value || '').trim() : '';
  if (!numero) {
    alert('Escribe el número de mesa');
    return;
  }
  if (mesasActivas.has(numero)) {
    abrirMesaMesero(numero);
    if (input) input.value = '';
    return;
  }
  mesasActivas.set(numero, crearPedidoVacio());
  persistirMesero(true);
  if (input) input.value = '';
  abrirMesaMesero(numero);
}

function abrirMesaMesero(id) {
  mesaSeleccionada = String(id);
  if (!mesasActivas.has(mesaSeleccionada)) {
    mesasActivas.set(mesaSeleccionada, crearPedidoVacio());
    persistirMesero(true);
  }
  pintarMesero();
}

function volverAMesas() {
  mesaSeleccionada = null;
  pintarMesero();
}

function elegirCategoriaMesero(cat) {
  categoriaActual = cat;
  pintarCategorias();
  pintarProductos();
}

function checksHtml(lista, name) {
  return (lista || []).map(function (nombre) {
    return '<label class="form-check"><input class="form-check-input" type="checkbox" name="' + name + '" value="' + escaparHtml(nombre) + '"> <span class="form-check-label">' + escaparHtml(nombre) + '</span></label>';
  }).join('');
}

function abrirProductoMesero(id) {
  const producto = productos.find(function (p) { return String(p.id) === String(id); });
  if (!producto) return;
  if (!mesaSeleccionada) {
    alert('Elige una mesa primero');
    return;
  }
  productoPendiente = producto;
  document.getElementById('nombreProductoMesero').textContent = producto.nombre;
  document.getElementById('cantidadProductoMesero').value = '1';
  document.getElementById('detalleProductoMesero').value = '';
  const salsasBox = document.getElementById('salsasMeseroBox');
  const salsas = document.getElementById('salsasMesero');
  if (producto.llevaSalsas && Array.isArray(producto.salsas) && producto.salsas.length) {
    salsasBox.style.display = 'block';
    salsas.innerHTML = checksHtml(producto.salsas, 'salsaMesero');
  } else {
    salsasBox.style.display = 'none';
    salsas.innerHTML = '';
  }
  const opcBox = document.getElementById('opcionesSalsasMeseroBox');
  const opc = document.getElementById('opcionesSalsasMesero');
  if (producto.llevaOpcionesSalsas && Array.isArray(producto.opcionesSalsas) && producto.opcionesSalsas.length) {
    opcBox.style.display = 'block';
    opc.innerHTML = checksHtml(producto.opcionesSalsas, 'opcionSalsaMesero');
  } else {
    opcBox.style.display = 'none';
    opc.innerHTML = '';
  }
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProductoMesero'));
  modal.show();
}

function cambiarCantidadMesero(delta) {
  const input = document.getElementById('cantidadProductoMesero');
  let n = parseInt(input.value, 10) || 1;
  n = Math.max(1, Math.min(99, n + delta));
  input.value = String(n);
}

function valoresCheck(name) {
  return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function (el) { return el.value; });
}

function confirmarProductoMesero() {
  if (!productoPendiente || !mesaSeleccionada) return;
  const producto = productoPendiente;
  const cantidad = Math.max(1, parseInt(document.getElementById('cantidadProductoMesero').value, 10) || 1);
  let detalles = String(document.getElementById('detalleProductoMesero').value || '').trim();
  const mods = valoresCheck('salsaMesero');
  const salsas = valoresCheck('opcionSalsaMesero');
  if (mods.length) detalles = (detalles ? detalles + '; ' : '') + 'Modificaciones: ' + mods.join(', ');
  if (salsas.length) detalles = (detalles ? detalles + '; ' : '') + 'Salsas: ' + salsas.join(', ');

  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  const rondaActual = pedido.ronda || 1;
  const existente = producto.editableEnVenta
    ? null
    : pedido.items.find(function (p) { return String(p.id) === String(producto.id) && p.estado !== 'en_cocina'; });
  if (existente) {
    existente.cantidad = (Number(existente.cantidad) || 0) + cantidad;
    if (detalles) existente.detalles = existente.detalles ? (existente.detalles + '; ' + detalles) : detalles;
  } else {
    pedido.items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio) || 0,
      cantidad: cantidad,
      detalles: detalles,
      estado: 'pendiente',
      ronda: rondaActual
    });
  }
  mesasActivas.set(mesaSeleccionada, pedido);
  persistirMesero(true);
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalProductoMesero'));
  if (modal) modal.hide();
  productoPendiente = null;
  pintarMesero();
}

function quitarItemMesero(indice) {
  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  const item = pedido.items[indice];
  if (!item || item.estado === 'en_cocina') return;
  pedido.items.splice(indice, 1);
  mesasActivas.set(mesaSeleccionada, pedido);
  persistirMesero(true);
  pintarMesero();
}

function enviarPedidoCocinaMesero() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) return;
  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  const nuevos = (pedido.items || []).filter(function (item) { return item.estado !== 'en_cocina'; });
  if (!nuevos.length) {
    alert('No hay productos nuevos para cocina');
    return;
  }
  const rondaEnviada = nuevos.reduce(function (max, item) { return Math.max(max, rondaDeItem(item)); }, pedido.ronda || 1);
  const nombreMesero = nombreMeseroSesion();
  nuevos.forEach(function (item) {
    item.estado = 'en_cocina';
    if (item.ronda == null) item.ronda = rondaEnviada;
    item.sesionId = pedido.sesionId;
    if (nombreMesero) item.nombreMesero = nombreMesero;
  });
  const existentes = (ordenesCocina.get(mesaSeleccionada) || []).filter(function (item) {
    return item && item.sesionId === pedido.sesionId;
  });
  ordenesCocina.set(mesaSeleccionada, existentes.concat(nuevos));
  historialCocina.push({
    id: Date.now(),
    fecha: new Date().toISOString(),
    fechaMostrar: new Date().toLocaleString(),
    mesa: mesaSeleccionada,
    items: nuevos,
    ronda: rondaEnviada,
    sesionId: pedido.sesionId || null,
    origen: 'mesero',
    nombreMesero: nombreMeseroSesion()
  });
  sincronizarRonda(pedido);
  if (nombreMesero) pedido.nombreMesero = nombreMesero;
  mesasActivas.set(mesaSeleccionada, pedido);
  persistirMesero(true);
  pintarMesero();
  alert('Pedido enviado a cocina. Ya aparece en caja.');
}

async function iniciarMesero() {
  leerCatalogoLocal();
  leerOperacionLocal();
  hashOperacion = hashDeOperacion();
  pintarMesero();
  pintarNombreMeseroCabecera();
  if (!window.ToySoftFirebase) return;
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) return;
    await asegurarNombreMeseroSesion();
    pintarNombreMeseroCabecera();
    await ToySoftFirebase.sincronizarCatalogo();
    await ToySoftFirebase.sincronizarOperacion();
    leerCatalogoLocal();
    leerOperacionLocal();
    hashOperacion = hashDeOperacion();
    pintarMesero();
    ToySoftFirebase.escucharCatalogo(function (nube) {
      categorias = (nube && nube.categorias) || [];
      productos = (nube && nube.productos) || [];
      pintarMesero();
    });
    ToySoftFirebase.escucharOperacion(aplicarOperacionNube);
  } catch (error) {
    console.warn('Mesero no pudo sincronizar', error);
  }
}

function nombreMeseroSesion() {
  if (window.ToySoftFirebase && typeof ToySoftFirebase.nombreMeseroActual === 'function') {
    return ToySoftFirebase.nombreMeseroActual();
  }
  return '';
}

function pintarNombreMeseroCabecera() {
  const sub = document.getElementById('subtituloMesero');
  if (!sub) return;
  const nombre = nombreMeseroSesion();
  if (mesaSeleccionada) {
    sub.textContent = nombre ? (nombre + ' · Mesa ' + mesaSeleccionada) : ('Mesa ' + mesaSeleccionada);
  } else {
    sub.textContent = nombre || 'Mesas';
  }
}

async function asegurarNombreMeseroSesion() {
  if (!window.ToySoftFirebase || typeof ToySoftFirebase.esMesero !== 'function' || !ToySoftFirebase.esMesero()) return;
  if (nombreMeseroSesion()) return;
  const escrito = (document.getElementById('nombreMeseroLogin') && document.getElementById('nombreMeseroLogin').value || '').trim();
  const nombre = escrito || String(prompt('¿Cómo te llamas? Ese nombre sale en el ticket de cocina.') || '').trim();
  if (!nombre) return;
  try {
    await ToySoftFirebase.guardarNombreUsuario(nombre);
  } catch (e) {
    console.warn('No se pudo guardar el nombre del mesero', e);
  }
}

function mostrarLoginMesero() {
  const login = document.getElementById('loginMesero');
  const app = document.getElementById('appMesero');
  if (login) login.style.display = 'flex';
  if (app) app.style.display = 'none';
  document.body.style.paddingBottom = '0';
}

function mostrarAppMesero() {
  const login = document.getElementById('loginMesero');
  const app = document.getElementById('appMesero');
  if (login) login.style.display = 'none';
  if (app) app.style.display = 'block';
  document.body.style.paddingBottom = '';
}

async function iniciarSesionMesero() {
  const { email, clave } = loginFormularioValores();
  mostrarLoginMensaje('');
  if (!email || !clave) {
    mostrarLoginMensaje('Escribe el correo y la contraseña.');
    return;
  }
  try {
    await ToySoftFirebase.init();
    await ToySoftFirebase.iniciarSesion(email, clave, '', { soloUnirse: true });
    if (typeof ToySoftFirebase.esMesero === 'function' && !ToySoftFirebase.esMesero()) {
      try { await ToySoftFirebase.cerrarSesion(); } catch (e) {}
      mostrarLoginMensaje('Esta cuenta no es de mesero. Pide al administrador que te cree en Administración.');
      return;
    }
    mostrarAppMesero();
    iniciarMesero();
  } catch (error) {
    mostrarLoginMensaje(ToySoftFirebase.mensajeErrorAuth(error));
  }
}

async function unirseAlNegocioMesero() {
  await unirseAlNegocio();
  if (window.ToySoftFirebase && ToySoftFirebase.estaListo && ToySoftFirebase.estaListo()) {
    mostrarAppMesero();
    iniciarMesero();
  }
}

async function iniciarPantallaMesero() {
  if (!window.ToySoftFirebase) {
    mostrarLoginMesero();
    return;
  }
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) {
      mostrarLoginMesero();
      return;
    }
    if (typeof ToySoftFirebase.esMesero === 'function' && !ToySoftFirebase.esMesero()) {
      mostrarLoginMesero();
      mostrarLoginMensaje('Esta cuenta no es de mesero. Pide al administrador que te cree en Administración.');
      return;
    }
    localStorage.setItem('sesionActiva', 'true');
    mostrarAppMesero();
    iniciarMesero();
  } catch (error) {
    mostrarLoginMesero();
    mostrarLoginMensaje((error && error.message) || 'No se pudo conectar.');
  }
}
