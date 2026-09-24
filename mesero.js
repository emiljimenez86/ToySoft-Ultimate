let mesasActivas = new Map();
window.ToysoftSnapshotMesas = function () {
  try {
    return Array.from(mesasActivas.entries());
  } catch (e) {
    return [];
  }
};
let ordenesCocina = new Map();
let historialCocina = [];
let categorias = [];
let productos = [];
let mesaSeleccionada = null;
let categoriaActual = '';
let busquedaProductoMesero = '';
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
  purgarMesasCobradasMesero(false);
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
  const marca = Date.now();
  mesasActivas.forEach(function (pedido, id) {
    const normalizado = normalizarPedido(pedido);
    normalizado.actualizadoLocal = marca;
    mesasActivas.set(id, normalizado);
  });
  if (typeof purgarMesasCobradasMesero === 'function') purgarMesasCobradasMesero(false);
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

function sesionCobradaMesero(sesionId) {
  const id = String(sesionId || '');
  if (!id) return false;
  if (window.ToySoftFirebase && typeof ToySoftFirebase.sesionYaCobrada === 'function') {
    return ToySoftFirebase.sesionYaCobrada(id);
  }
  try {
    const arr = JSON.parse(localStorage.getItem('sesionesCobradasHoy') || '[]');
    return Array.isArray(arr) && arr.indexOf(id) !== -1;
  } catch (e) {
    return false;
  }
}

function purgarMesasCobradasMesero(pintar) {
  let cambio = false;
  Array.from(mesasActivas.keys()).forEach(function (id) {
    const pedido = mesasActivas.get(id);
    if (pedido && pedido.sesionId && sesionCobradaMesero(pedido.sesionId)) {
      mesasActivas.delete(id);
      ordenesCocina.delete(id);
      cambio = true;
    }
  });
  if (cambio) {
    localStorage.setItem('mesasActivas', JSON.stringify(Array.from(mesasActivas.entries())));
    localStorage.setItem('ordenesCocina', JSON.stringify(Array.from(ordenesCocina.entries())));
    hashOperacion = hashDeOperacion();
    if (pintar !== false) pintarMesero();
  }
  return cambio;
}

function persistirMesasMeseroLocal() {
  localStorage.setItem('mesasActivas', JSON.stringify(Array.from(mesasActivas.entries())));
  localStorage.setItem('ordenesCocina', JSON.stringify(Array.from(ordenesCocina.entries())));
}

function aplicarOperacionNube(datos) {
  if (!datos) return;
  if (window.ToySoftFirebase && typeof ToySoftFirebase.unirSesionesCobradas === 'function') {
    ToySoftFirebase.unirSesionesCobradas(datos);
  }
  if (persistiendo || window._operacionPersistiendo) {
    if (purgarMesasCobradasMesero(true)) persistirMesasMeseroLocal();
    return;
  }
  const nuevas = mapDesdeEntradas(datos.mesasActivas);
  mesasActivas = nuevas;
  ordenesCocina = mapDesdeEntradas(datos.ordenesCocina);
  historialCocina = Array.isArray(datos.historialCocina) ? datos.historialCocina : [];
  mesasActivas.forEach(function (pedido, id) {
    mesasActivas.set(id, normalizarPedido(pedido));
  });
  purgarMesasCobradasMesero(false);
  const nuevo = hashDeOperacion();
  if (nuevo === hashOperacion) return;
  hashOperacion = nuevo;
  pintarMesero();
}

function esMesaComedor(id) {
  const clave = String(id || '');
  return clave && !clave.startsWith('DOM-') && !clave.startsWith('REC-');
}

function esDomicilioMesero(id, pedido) {
  return String(id || '').startsWith('DOM-') || (pedido && pedido.tipo === 'domicilio');
}

function esRecogerMesero(id, pedido) {
  return String(id || '').startsWith('REC-') || (pedido && pedido.tipo === 'recoger');
}

function etiquetaPedidoMesero(id, pedido) {
  const clave = String(id || '');
  const datos = pedido || mesasActivas.get(clave);
  if (esDomicilioMesero(clave, datos)) return 'Domicilio ' + clave.replace(/^DOM-/, '');
  if (esRecogerMesero(clave, datos)) return 'Recoger ' + clave.replace(/^REC-/, '');
  return clave ? ('Mesa ' + clave) : 'Pedidos';
}

function tituloTicketCocinaMesero(mesa, pedido) {
  const clave = String(mesa || '');
  if (esDomicilioMesero(clave, pedido)) return 'Domicilio: ' + clave.replace(/^DOM-/, '');
  if (esRecogerMesero(clave, pedido)) return 'Recoger: ' + clave.replace(/^REC-/, '');
  return clave ? ('Mesa: ' + clave) : 'Pedidos';
}

function leerContadorMesero(clave) {
  return parseInt(localStorage.getItem(clave) || '0', 10) || 0;
}

function siguienteIdExternoMesero(tipo) {
  const esDom = tipo === 'domicilio';
  const clave = esDom ? 'contadorDomicilios' : 'contadorRecoger';
  const prefijo = esDom ? 'DOM-' : 'REC-';
  let n = leerContadorMesero(clave) + 1;
  while (mesasActivas.has(prefijo + n)) n += 1;
  localStorage.setItem(clave, String(n));
  return { id: prefijo + n, numero: n };
}

function crearPedidoMesero(tipo, extra) {
  const pedido = crearPedidoVacio();
  pedido.tipo = tipo || 'mesa';
  extra = extra || {};
  if (extra.numero) pedido.numero = extra.numero;
  if (extra.cliente) pedido.cliente = extra.cliente;
  if (extra.telefono) pedido.telefono = extra.telefono;
  if (extra.direccion) pedido.direccion = extra.direccion;
  if (extra.horaRecoger) pedido.horaRecoger = extra.horaRecoger;
  if (extra.clienteId) pedido.clienteId = extra.clienteId;
  anotarMeseroEnPedido(pedido);
  return pedido;
}

function pintarChipsPedidos(contId, ids, claseExtra) {
  const cont = document.getElementById(contId);
  if (!cont) return;
  if (!ids.length) {
    cont.innerHTML = '<p class="text-muted small mb-0 w-100">Ninguno abierto.</p>';
    return;
  }
  cont.innerHTML = ids.map(function (id) {
    const pedido = mesasActivas.get(id);
    const n = contarItems(pedido);
    const seleccionada = String(id) === String(mesaSeleccionada) ? ' mesa-seleccionada' : '';
    const idJs = String(id).replace(/'/g, '');
    let tipoClase = 'mesa-activa';
    let interior;
    if (claseExtra === 'domicilio' || esDomicilioMesero(id, pedido)) {
      tipoClase = 'mesa-domicilio';
      const num = parseInt(String(id).replace(/\D/g, ''), 10);
      interior = '<div class="mesa-btn-inner"><i class="fas fa-motorcycle"></i><span class="mesa-numero">D' +
        escaparHtml(String(Number.isFinite(num) ? num : id)) + '</span></div>';
    } else if (claseExtra === 'recoger' || esRecogerMesero(id, pedido)) {
      tipoClase = 'mesa-recoger';
      const num = parseInt(String(id).replace(/\D/g, ''), 10);
      interior = '<div class="mesa-btn-inner"><i class="fas fa-shopping-bag"></i><span class="mesa-numero">R' +
        escaparHtml(String(Number.isFinite(num) ? num : id)) + '</span></div>';
    } else {
      interior = '<div class="mesa-btn-inner"><span class="mesa-etiqueta">Mesa</span><span class="mesa-numero">' +
        escaparHtml(String(id)) + '</span></div>';
    }
    const cliente = pedido && pedido.cliente ? escaparHtml(pedido.cliente) : '';
    const pie = (cliente ? cliente + ' · ' : '') + n + ' prod.';
    return '<div class="mesero-mesa-item">' +
      '<button type="button" class="mesa-btn ' + tipoClase + seleccionada + '" onclick="abrirMesaMesero(\'' + idJs + '\')">' +
      interior + '</button>' +
      '<div class="mesa-caption">' + pie + '</div></div>';
  }).join('');
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
  const idsMesas = Array.from(mesasActivas.keys()).filter(esMesaComedor).sort(function (a, b) {
    return Number(a) - Number(b) || String(a).localeCompare(String(b));
  });
  const idsDom = Array.from(mesasActivas.keys()).filter(function (id) { return esDomicilioMesero(id); }).sort(function (a, b) {
    return Number(String(a).replace(/\D/g, '')) - Number(String(b).replace(/\D/g, ''));
  });
  const idsRec = Array.from(mesasActivas.keys()).filter(function (id) { return esRecogerMesero(id); }).sort(function (a, b) {
    return Number(String(a).replace(/\D/g, '')) - Number(String(b).replace(/\D/g, ''));
  });
  const contMesas = document.getElementById('listaMesasMesero');
  if (contMesas) {
    if (!idsMesas.length) {
      contMesas.innerHTML = '<p class="text-muted mb-0 w-100">No hay mesas abiertas. Escribe un número y ábrela.</p>';
    } else {
      pintarChipsPedidos('listaMesasMesero', idsMesas, '');
    }
  }
  pintarChipsPedidos('listaDomiciliosMesero', idsDom, 'domicilio');
  pintarChipsPedidos('listaRecogerMesero', idsRec, 'recoger');
}

function actualizarBotonCambioMesero() {
  const btn = document.getElementById('btnCambioPedidoMesero');
  const nav = document.getElementById('pedidoNavMesero');
  if (!btn) return;
  const id = mesaSeleccionada ? String(mesaSeleccionada) : '';
  const pedido = mesasActivas.get(id);
  const hay = !!(pedido && (pedido.items || []).length);
  btn.style.display = hay ? '' : 'none';
  if (nav) nav.classList.toggle('con-cambio', hay);
  if (!hay) return;
  if (esDomicilioMesero(id, pedido)) {
    btn.innerHTML = '<i class="fas fa-shopping-bag"></i><span>Pasar a Recoger</span>';
  } else if (esRecogerMesero(id, pedido)) {
    btn.innerHTML = '<i class="fas fa-motorcycle"></i><span>Pasar a Domicilio</span>';
  } else {
    btn.innerHTML = '<i class="fas fa-exchange-alt"></i><span>Cambio de mesa</span>';
  }
}

function pintarOrden() {
  const cont = document.getElementById('ordenMesero');
  const barra = document.getElementById('barraEnviar');
  const titulo = document.getElementById('tituloPedidoActual');
  if (titulo) titulo.textContent = mesaSeleccionada ? etiquetaPedidoMesero(mesaSeleccionada) : 'Pedidos';
  actualizarBotonCambioMesero();
  if (!cont) return;
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    cont.innerHTML = '';
    if (barra) barra.style.display = 'none';
    return;
  }
  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  mesasActivas.set(mesaSeleccionada, pedido);
  if (!pedido.items.length) {
    const cliente = pedido.cliente ? '<div class="small text-warning mb-2">' + escaparHtml(pedido.cliente) + (pedido.telefono ? ' · ' + escaparHtml(pedido.telefono) : '') + '</div>' : '';
    const extra = pedido.direccion ? '<div class="small text-white-50 mb-2">' + escaparHtml(pedido.direccion) + '</div>' : (pedido.horaRecoger ? '<div class="small text-white-50 mb-2">Hora: ' + escaparHtml(pedido.horaRecoger) + '</div>' : '');
    cont.innerHTML = cliente + extra + '<div class="text-muted">Pedido vacío. Elige productos abajo.</div>';
    if (barra) barra.style.display = 'none';
    return;
  }
  let total = 0;
  let pendientes = 0;
  const cabecera = (pedido.cliente || pedido.direccion || pedido.horaRecoger)
    ? '<div class="small text-warning mb-2">' + escaparHtml(pedido.cliente || '') + (pedido.telefono ? ' · ' + escaparHtml(pedido.telefono) : '') + '</div>' +
      (pedido.direccion ? '<div class="small text-white-50 mb-2">' + escaparHtml(pedido.direccion) + '</div>' : '') +
      (pedido.horaRecoger ? '<div class="small text-white-50 mb-2">Hora: ' + escaparHtml(pedido.horaRecoger) + '</div>' : '')
    : '';
  cont.innerHTML = cabecera + pedido.items.map(function (item, idx) {
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
  if (barra) {
    barra.style.display = 'block';
    const hayEnCocina = (pedido.items || []).some(function (item) { return item.estado === 'en_cocina'; });
    const btnEnviar = barra.querySelector('.btn-enviar-cocina-mesero');
    const btnImprimir = barra.querySelector('.btn-imprimir-ticket-mesero');
    if (btnEnviar) btnEnviar.style.display = pendientes ? '' : 'none';
    if (btnImprimir) btnImprimir.style.display = (hayEnCocina && puedeImprimirMeseroDesdeCelular()) ? '' : 'none';
    const acciones = document.getElementById('accionesPedidoMesero');
    if (acciones) acciones.classList.toggle('con-enviar', pendientes > 0 && hayEnCocina);
  }
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
    return '<button type="button" class="cat-chip-mesero' + activa + '" onclick="elegirCategoriaMesero(this.dataset.cat)" data-cat="' + escaparHtml(cat) + '">' + escaparHtml(cat) + '</button>';
  }).join('');
}

function pintarProductos() {
  const cont = document.getElementById('productosMesero');
  const msg = document.getElementById('mensajeBusquedaMesero');
  if (!cont) return;
  const query = normalizarTextoClienteMesero(busquedaProductoMesero);
  const lista = query
    ? productos.filter(function (p) { return productoCoincideBusquedaMesero(p, query); })
    : productos.filter(function (p) {
      if (!categoriaActual) return true;
      return p.categoria === categoriaActual;
    });
  if (msg) {
    if (query) {
      msg.style.display = 'block';
      if (!lista.length) {
        msg.className = 'small mb-2 text-warning';
        msg.textContent = 'No se encontraron productos con "' + busquedaProductoMesero + '".';
      } else {
        msg.className = 'small mb-2 text-success';
        msg.textContent = lista.length + ' producto' + (lista.length === 1 ? '' : 's') + ' encontrado' + (lista.length === 1 ? '' : 's') + '.';
      }
    } else {
      msg.style.display = 'none';
      msg.textContent = '';
    }
  }
  if (!lista.length) {
    cont.innerHTML = query
      ? '<div class="text-muted">Prueba con otro nombre o categoría.</div>'
      : '<div class="text-muted">No hay productos en esta categoría.</div>';
    return;
  }
  cont.innerHTML = lista.map(function (p) {
    const extra = query && p.categoria
      ? '<div class="small text-white-50">' + escaparHtml(p.categoria) + '</div>'
      : '';
    return '<div class="prod-card" onclick="abrirProductoMesero(\'' + String(p.id).replace(/'/g, '') + '\')">' +
      '<div class="fw-bold">' + escaparHtml(p.nombre) + '</div>' +
      extra +
      '<div class="text-info">' + formatearPrecioMesero(p.precio) + '</div></div>';
  }).join('');
}

function productoCoincideBusquedaMesero(producto, query) {
  const texto = normalizarTextoClienteMesero([
    producto.nombre, producto.categoria, producto.codigo
  ].filter(Boolean).join(' '));
  const palabras = String(query || '').split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  return palabras.every(function (palabra) { return texto.indexOf(palabra) !== -1; });
}

function buscarProductosMesero() {
  const input = document.getElementById('buscarProductoMesero');
  busquedaProductoMesero = input ? String(input.value || '').trim() : '';
  pintarProductos();
}

function limpiarBusquedaProductoMesero() {
  const input = document.getElementById('buscarProductoMesero');
  if (input) input.value = '';
  busquedaProductoMesero = '';
  pintarProductos();
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

function actualizarPasoAbrirMesa() {
  const input = document.getElementById('nuevaMesaMesero');
  const paso = document.getElementById('abrirMesaPaso');
  if (!paso) return;
  const hayNumero = !!(input && String(input.value || '').trim());
  paso.classList.toggle('con-numero', hayNumero);
  if (hayNumero) paso.classList.remove('falta-numero');
}

function crearMesaMesero() {
  const input = document.getElementById('nuevaMesaMesero');
  const paso = document.getElementById('abrirMesaPaso');
  const numero = input ? String(input.value || '').trim() : '';
  if (!numero) {
    if (input) input.focus();
    if (paso) {
      paso.classList.remove('falta-numero');
      void paso.offsetWidth;
      paso.classList.add('falta-numero');
    }
    return;
  }
  if (mesasActivas.has(numero)) {
    abrirMesaMesero(numero);
    if (input) input.value = '';
    actualizarPasoAbrirMesa();
    return;
  }
  mesasActivas.set(numero, crearPedidoMesero('mesa'));
  persistirMesero(true);
  if (input) input.value = '';
  actualizarPasoAbrirMesa();
  abrirMesaMesero(numero);
}

function leerClientesMesero() {
  try {
    const lista = JSON.parse(localStorage.getItem('clientes') || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

function nombreClienteMesero(cliente) {
  if (!cliente) return 'Sin nombre';
  const partes = [cliente.nombre, cliente.apellido].filter(function (parte) {
    const valor = String(parte || '').trim();
    return valor && valor.toLowerCase() !== 'no proporcionado';
  });
  return partes.join(' ').trim() || String(cliente.nombre || '').trim() || 'Sin nombre';
}

function normalizarTextoClienteMesero(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function normalizarTelefonoMesero(texto) {
  return String(texto || '').replace(/\D/g, '');
}

function clienteCoincideMesero(cliente, busqueda) {
  const query = normalizarTextoClienteMesero(busqueda);
  if (!query) return false;
  const texto = normalizarTextoClienteMesero([
    cliente.nombre, cliente.apellido, cliente.telefono, cliente.documento, cliente.direccion
  ].filter(Boolean).join(' '));
  const palabras = query.split(/\s+/).filter(Boolean);
  const coincideTexto = palabras.every(function (palabra) { return texto.indexOf(palabra) !== -1; });
  const telQuery = normalizarTelefonoMesero(busqueda);
  const telCliente = normalizarTelefonoMesero(cliente.telefono || cliente.documento);
  return coincideTexto || (telQuery.length >= 4 && telCliente.indexOf(telQuery) !== -1);
}

function filtrarClientesMesero(busqueda) {
  const fuente = leerClientesMesero();
  const query = String(busqueda || '').trim();
  if (!query) return [];
  return fuente.filter(function (cliente) { return clienteCoincideMesero(cliente, query); });
}

function direccionClienteMesero(cliente) {
  const dir = String((cliente && cliente.direccion) || '').trim();
  return (!dir || dir.toLowerCase() === 'no proporcionado') ? '' : dir;
}

function buscarClientesMesero() {
  const input = document.getElementById('buscarClienteMesero');
  const lista = document.getElementById('listaClientesMesero');
  if (!lista) return;
  const query = input ? input.value : '';
  const filtrados = filtrarClientesMesero(query);
  if (!filtrados.length) {
    lista.innerHTML = query
      ? '<div class="list-group-item bg-dark text-muted border-secondary small">No se encontró. Escríbelo abajo.</div>'
      : '<div class="list-group-item bg-dark text-muted border-secondary small">Escriba nombre o teléfono para buscar. Si es nuevo, escríbalo abajo.</div>';
    return;
  }
  const max = 12;
  lista.innerHTML = filtrados.slice(0, max).map(function (cliente) {
    const dir = direccionClienteMesero(cliente);
    const tel = cliente.telefono || '';
    return '<button type="button" class="list-group-item list-group-item-action bg-dark text-white border-secondary py-2" onclick="seleccionarClienteMesero(\'' +
      String(cliente.id).replace(/'/g, '') + '\')">' +
      '<div class="fw-semibold">' + escaparHtml(nombreClienteMesero(cliente)) + '</div>' +
      '<small class="text-white-50">' + escaparHtml(tel) + (dir ? ' · ' + escaparHtml(dir) : '') + '</small></button>';
  }).join('');
}

function seleccionarClienteMesero(clienteId) {
  const cliente = leerClientesMesero().find(function (c) { return String(c.id) === String(clienteId); });
  if (!cliente) return;
  const idEl = document.getElementById('clienteIdExternoMesero');
  const nombreEl = document.getElementById('clienteExternoMesero');
  const telEl = document.getElementById('telefonoExternoMesero');
  const dirEl = document.getElementById('direccionExternoMesero');
  const buscaEl = document.getElementById('buscarClienteMesero');
  if (idEl) idEl.value = String(cliente.id);
  if (nombreEl) nombreEl.value = nombreClienteMesero(cliente);
  if (telEl) telEl.value = cliente.telefono || '';
  if (dirEl) dirEl.value = direccionClienteMesero(cliente);
  if (buscaEl) buscaEl.value = '';
  const lista = document.getElementById('listaClientesMesero');
  if (lista) {
    lista.innerHTML = '<div class="list-group-item bg-dark text-info border-secondary py-2"><i class="fas fa-check-circle me-1"></i>' +
      escaparHtml(nombreClienteMesero(cliente)) + '</div>';
  }
}

function guardarClienteNuevoMesero(nombre, telefono, direccion) {
  const lista = leerClientesMesero();
  const tel = normalizarTelefonoMesero(telefono);
  let existente = null;
  if (tel.length >= 7) {
    existente = lista.find(function (cliente) {
      return normalizarTelefonoMesero(cliente.telefono) === tel || normalizarTelefonoMesero(cliente.documento) === tel;
    }) || null;
  }
  if (!existente && nombre) {
    const nom = normalizarTextoClienteMesero(nombre);
    existente = lista.find(function (cliente) {
      return normalizarTextoClienteMesero(nombreClienteMesero(cliente)) === nom;
    }) || null;
  }
  if (existente) return existente;
  const nuevo = {
    id: Date.now(),
    documento: telefono || '',
    nombre: nombre,
    apellido: 'No proporcionado',
    telefono: telefono || '',
    correo: 'No proporcionado',
    direccion: direccion || 'No proporcionado',
    fechaRegistro: new Date().toISOString()
  };
  lista.push(nuevo);
  localStorage.setItem('clientes', JSON.stringify(lista));
  if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirAltaCliente === 'function') {
    ToySoftFirebase.persistirAltaCliente(nuevo);
  } else if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirClientes === 'function') {
    ToySoftFirebase.persistirClientes(lista);
  }
  return nuevo;
}

function abrirFormPedidoExternoMesero(tipo) {
  const esDom = tipo === 'domicilio';
  const titulo = document.getElementById('tituloPedidoExternoMesero');
  const tipoEl = document.getElementById('tipoPedidoExternoMesero');
  const dirBox = document.getElementById('cajaDireccionExternoMesero');
  const horaBox = document.getElementById('cajaHoraExternoMesero');
  if (tipoEl) tipoEl.value = esDom ? 'domicilio' : 'recoger';
  if (titulo) titulo.textContent = esDom ? 'Domicilio' : 'Recoger';
  if (dirBox) dirBox.style.display = esDom ? '' : 'none';
  if (horaBox) horaBox.style.display = esDom ? 'none' : '';
  ['clienteExternoMesero', 'telefonoExternoMesero', 'direccionExternoMesero', 'horaExternoMesero', 'buscarClienteMesero', 'clienteIdExternoMesero'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  buscarClientesMesero();
  const modalEl = document.getElementById('modalPedidoExternoMesero');
  if (modalEl && typeof bootstrap !== 'undefined') {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

function confirmarPedidoExternoMesero() {
  const tipo = (document.getElementById('tipoPedidoExternoMesero') && document.getElementById('tipoPedidoExternoMesero').value) || 'domicilio';
  const cliente = (document.getElementById('clienteExternoMesero') && document.getElementById('clienteExternoMesero').value || '').trim();
  const telefono = (document.getElementById('telefonoExternoMesero') && document.getElementById('telefonoExternoMesero').value || '').trim();
  const direccion = (document.getElementById('direccionExternoMesero') && document.getElementById('direccionExternoMesero').value || '').trim();
  const horaRecoger = (document.getElementById('horaExternoMesero') && document.getElementById('horaExternoMesero').value || '').trim();
  if (!cliente) {
    alert('Escribe el nombre del cliente');
    return;
  }
  if (tipo === 'domicilio' && !direccion) {
    alert('Escribe la dirección del domicilio');
    return;
  }
  const guardado = guardarClienteNuevoMesero(cliente, telefono, direccion);
  const siguiente = siguienteIdExternoMesero(tipo);
  mesasActivas.set(siguiente.id, crearPedidoMesero(tipo, {
    numero: siguiente.numero,
    cliente: cliente,
    telefono: telefono,
    direccion: tipo === 'domicilio' ? direccion : '',
    horaRecoger: tipo === 'recoger' ? horaRecoger : '',
    clienteId: guardado && guardado.id
  }));
  persistirMesero(true);
  const modalEl = document.getElementById('modalPedidoExternoMesero');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
  abrirMesaMesero(siguiente.id);
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
  const input = document.getElementById('buscarProductoMesero');
  if (input) input.value = '';
  busquedaProductoMesero = '';
  pintarMesero();
}

function idsCocinaListosMesero() {
  try {
    const lista = JSON.parse(localStorage.getItem('pedidosCocinaListos') || '[]');
    if (!Array.isArray(lista) || !lista.length) return [];
    if (typeof lista[0] === 'number') return lista;
    return lista.map(function (p) { return p && p.id; }).filter(function (id) { return id != null; });
  } catch (e) {
    return [];
  }
}

function textoCambioPedidoMesero(cambio) {
  if (!cambio) return { titulo: '', linea: '' };
  const o = String(cambio.origen || '');
  const d = String(cambio.destino || '');
  const canal = cambio.tipoCambio === 'canal'
    || ((o.indexOf('DOM-') === 0 || o.indexOf('REC-') === 0) && (d.indexOf('DOM-') === 0 || d.indexOf('REC-') === 0));
  return {
    titulo: canal ? 'CAMBIO DE TIPO' : 'CAMBIO DE MESA',
    linea: etiquetaPedidoMesero(o) + ' → ' + etiquetaPedidoMesero(d)
  };
}

function abrirCambioPedidoMesero() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) {
    alert('Elige un pedido primero');
    return;
  }
  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  if (!(pedido.items || []).length) {
    alert('Agrega productos antes de cambiar');
    return;
  }
  const id = String(mesaSeleccionada);
  if (esDomicilioMesero(id, pedido)) {
    mostrarModalCambioTipoMesero('recoger');
  } else if (esRecogerMesero(id, pedido)) {
    mostrarModalCambioTipoMesero('domicilio');
  } else {
    mostrarModalCambioMesaMesero();
  }
}

function mostrarModalCambioMesaMesero() {
  const origen = document.getElementById('mesaOrigenMesero');
  const destino = document.getElementById('mesaDestinoMesero');
  if (origen) origen.value = String(mesaSeleccionada);
  if (destino) destino.value = '';
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCambioMesaMesero'));
  modal.show();
  setTimeout(function () { if (destino) destino.focus(); }, 300);
}

function mostrarModalCambioTipoMesero(tipoDestino) {
  const pedido = mesasActivas.get(mesaSeleccionada) || {};
  const titulo = document.getElementById('tituloCambioTipoMesero');
  const tipoEl = document.getElementById('tipoDestinoCambioMesero');
  const origenEl = document.getElementById('pedidoOrigenCambioMesero');
  const destinoEl = document.getElementById('pedidoDestinoCambioMesero');
  const cajaDir = document.getElementById('cajaDireccionCambioMesero');
  const dirEl = document.getElementById('direccionCambioMesero');
  const nota = document.getElementById('notaCambioTipoMesero');
  if (tipoEl) tipoEl.value = tipoDestino;
  if (origenEl) origenEl.value = etiquetaPedidoMesero(mesaSeleccionada, pedido) + (pedido.cliente ? ' · ' + pedido.cliente : '');
  if (destinoEl) destinoEl.value = tipoDestino === 'recoger' ? 'Pedido para recoger' : 'Pedido a domicilio';
  if (titulo) {
    titulo.innerHTML = tipoDestino === 'recoger'
      ? '<i class="fas fa-shopping-bag me-1"></i>Pasar a Recoger'
      : '<i class="fas fa-motorcycle me-1"></i>Pasar a Domicilio';
  }
  if (tipoDestino === 'domicilio') {
    if (cajaDir) cajaDir.style.display = 'block';
    if (dirEl) dirEl.value = pedido.direccion || '';
    if (nota) nota.textContent = 'Quedará como domicilio. Escribe o corrige la dirección. Si ya iba a cocina, se imprime un ticket nuevo.';
  } else {
    if (cajaDir) cajaDir.style.display = 'none';
    if (dirEl) dirEl.value = '';
    if (nota) nota.textContent = 'Quedará para recoger. Se conservan nombre y teléfono. Si ya iba a cocina, se imprime un ticket nuevo.';
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCambioTipoMesero')).show();
}

function reubicarPedidoMesero(origen, destino, pedido) {
  if (mesasActivas.has(destino) && String(origen) !== String(destino)) {
    const dest = normalizarPedido(mesasActivas.get(destino));
    dest.items = (dest.items || []).concat(pedido.items || []);
    dest.cambioMesa = pedido.cambioMesa;
    sincronizarRonda(dest);
    if (pedido.cliente && !dest.cliente) {
      dest.cliente = pedido.cliente;
      dest.telefono = pedido.telefono;
      dest.direccion = pedido.direccion;
      dest.horaRecoger = pedido.horaRecoger;
    }
    if (pedido.nombreMesero && !dest.nombreMesero) dest.nombreMesero = pedido.nombreMesero;
    if (pedido.sexoMesero && !dest.sexoMesero) dest.sexoMesero = pedido.sexoMesero;
    mesasActivas.set(destino, dest);
    pedido = dest;
  } else {
    mesasActivas.set(destino, pedido);
  }
  mesasActivas.delete(origen);
  if (ordenesCocina.has(origen)) {
    const items = ordenesCocina.get(origen) || [];
    ordenesCocina.delete(origen);
    ordenesCocina.set(destino, (ordenesCocina.get(destino) || []).concat(items));
  }
  const listos = idsCocinaListosMesero();
  historialCocina = historialCocina.filter(function (h) {
    return !(String(h.mesa) === String(origen) && listos.indexOf(h.id) === -1);
  });
  const enCocina = (pedido.items || []).filter(function (item) { return item.estado === 'en_cocina'; });
  if (enCocina.length) {
    historialCocina.push(registroCocinaMesero({
      id: Date.now(),
      fecha: new Date().toISOString(),
      fechaMostrar: (pedido.cambioMesa && pedido.cambioMesa.fecha) || new Date().toLocaleString(),
      mesa: destino,
      items: enCocina,
      ronda: enCocina.reduce(function (max, item) { return Math.max(max, rondaDeItem(item)); }, 1),
      sesionId: pedido.sesionId || null,
      origen: 'mesero',
      nombreMesero: pedido.nombreMesero || nombreMeseroSesion(),
      sexoMesero: pedido.sexoMesero || sexoMeseroSesion(),
      cliente: pedido.cliente || null,
      telefono: pedido.telefono || null,
      direccion: pedido.tipo === 'domicilio' ? (pedido.direccion || null) : null,
      horaRecoger: pedido.tipo === 'recoger' ? (pedido.horaRecoger || null) : null,
      cambioMesa: pedido.cambioMesa
    }));
  }
  mesaSeleccionada = destino;
  persistirMesero(true);
  pintarMesero();
  return enCocina;
}

function procesarCambioMesaMesero() {
  const origen = String(mesaSeleccionada || '').trim();
  const destino = String((document.getElementById('mesaDestinoMesero') || {}).value || '').trim();
  if (!origen || !mesasActivas.has(origen)) {
    alert('No se encontró la mesa actual');
    return;
  }
  if (!destino) {
    alert('Escribe el número de la nueva mesa');
    return;
  }
  if (!/^\d+$/.test(destino)) {
    alert('La mesa destino debe ser un número');
    return;
  }
  if (origen === destino) {
    alert('La mesa nueva debe ser distinta');
    return;
  }
  const pedido = normalizarPedido(mesasActivas.get(origen));
  if (!(pedido.items || []).length) {
    alert('No hay productos para mover');
    return;
  }
  pedido.cambioMesa = {
    origen: origen,
    destino: destino,
    fecha: new Date().toLocaleString()
  };
  mesasActivas.set(origen, pedido);
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambioMesaMesero'));
  if (modal) modal.hide();
  const enCocina = reubicarPedidoMesero(origen, destino, pedido);
  if (enCocina.length) imprimirTicketCocinaMesero(destino, enCocina, { pedido: mesasActivas.get(destino) });
}

function procesarCambioTipoMesero() {
  const origen = String(mesaSeleccionada || '');
  if (!origen || !mesasActivas.has(origen)) {
    alert('No hay un pedido seleccionado');
    return;
  }
  const pedido = normalizarPedido(mesasActivas.get(origen));
  if (!(pedido.items || []).length) {
    alert('No hay productos en este pedido');
    return;
  }
  const tipoDestino = (document.getElementById('tipoDestinoCambioMesero') || {}).value;
  if (tipoDestino !== 'domicilio' && tipoDestino !== 'recoger') {
    alert('No se pudo determinar el tipo');
    return;
  }
  if (esDomicilioMesero(origen, pedido) && tipoDestino === 'domicilio') {
    alert('Este pedido ya es un domicilio');
    return;
  }
  if (esRecogerMesero(origen, pedido) && tipoDestino === 'recoger') {
    alert('Este pedido ya es para recoger');
    return;
  }
  let nuevo;
  if (tipoDestino === 'recoger') {
    nuevo = siguienteIdExternoMesero('recoger');
    pedido.tipo = 'recoger';
    pedido.numero = nuevo.numero;
    pedido.direccion = '';
  } else {
    const direccion = String((document.getElementById('direccionCambioMesero') || {}).value || pedido.direccion || '').trim();
    if (!direccion) {
      alert('Escribe la dirección del domicilio');
      const inputDir = document.getElementById('direccionCambioMesero');
      if (inputDir) inputDir.focus();
      return;
    }
    nuevo = siguienteIdExternoMesero('domicilio');
    pedido.tipo = 'domicilio';
    pedido.numero = nuevo.numero;
    pedido.direccion = direccion;
    pedido.horaRecoger = '';
  }
  pedido.cambioMesa = {
    origen: origen,
    destino: nuevo.id,
    fecha: new Date().toLocaleString(),
    tipoCambio: 'canal'
  };
  mesasActivas.set(origen, pedido);
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambioTipoMesero'));
  if (modal) modal.hide();
  const enCocina = reubicarPedidoMesero(origen, nuevo.id, pedido);
  if (enCocina.length) imprimirTicketCocinaMesero(nuevo.id, enCocina, { pedido: mesasActivas.get(nuevo.id) });
}

function elegirCategoriaMesero(cat) {
  categoriaActual = cat;
  const input = document.getElementById('buscarProductoMesero');
  if (input) input.value = '';
  busquedaProductoMesero = '';
  pintarCategorias();
  pintarProductos();
}

function checksHtml(lista, name) {
  return (lista || []).map(function (nombre) {
    return '<label class="chip-opcion-mesero"><input type="checkbox" name="' + name + '" value="' + escaparHtml(nombre) + '"><span>' + escaparHtml(nombre) + '</span></label>';
  }).join('');
}

function abrirProductoMesero(id) {
  const producto = productos.find(function (p) { return String(p.id) === String(id); });
  if (!producto) return;
  if (!mesaSeleccionada) {
    alert('Elige una mesa, domicilio o recogida primero');
    return;
  }
  productoPendiente = producto;
  document.getElementById('nombreProductoMesero').textContent = producto.nombre;
  const precioEl = document.getElementById('precioProductoMesero');
  if (precioEl) precioEl.textContent = formatearPrecioMesero(producto.precio);
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
  const nombreMesero = nombreMeseroSesion();
  const existente = producto.editableEnVenta
    ? null
    : pedido.items.find(function (p) {
      return String(p.id) === String(producto.id)
        && p.estado !== 'en_cocina'
        && (!p.nombreMesero || !nombreMesero || p.nombreMesero === nombreMesero);
    });
  if (existente) {
    existente.cantidad = (Number(existente.cantidad) || 0) + cantidad;
    if (detalles) existente.detalles = existente.detalles ? (existente.detalles + '; ' + detalles) : detalles;
    anotarMeseroEnPedido(pedido, existente);
  } else {
    const item = {
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio) || 0,
      cantidad: cantidad,
      detalles: detalles,
      estado: 'pendiente',
      ronda: rondaActual
    };
    anotarMeseroEnPedido(pedido, item);
    pedido.items.push(item);
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
  nuevos.forEach(function (item) {
    item.estado = 'en_cocina';
    if (item.ronda == null) item.ronda = rondaEnviada;
    item.sesionId = pedido.sesionId;
    anotarMeseroEnPedido(pedido, item);
  });
  const existentes = (ordenesCocina.get(mesaSeleccionada) || []).filter(function (item) {
    return item && item.sesionId === pedido.sesionId;
  });
  ordenesCocina.set(mesaSeleccionada, existentes.concat(nuevos));
  historialCocina.push(registroCocinaMesero({
    id: Date.now(),
    fecha: new Date().toISOString(),
    fechaMostrar: new Date().toLocaleString(),
    mesa: mesaSeleccionada,
    items: nuevos,
    ronda: rondaEnviada,
    sesionId: pedido.sesionId || null,
    origen: 'mesero',
    nombreMesero: nombreMeseroSesion(),
    sexoMesero: sexoMeseroSesion(),
    cliente: pedido.cliente || null,
    telefono: pedido.telefono || null,
    direccion: pedido.direccion || null,
    horaRecoger: pedido.horaRecoger || null
  }));
  sincronizarRonda(pedido);
  anotarMeseroEnPedido(pedido);
  mesasActivas.set(mesaSeleccionada, pedido);
  persistirMesero(true);
  pintarMesero();
  imprimirTicketCocinaMesero(mesaSeleccionada, nuevos, { ronda: rondaEnviada, pedido: pedido });
}

function imprimirPedidoMesero() {
  if (!mesaSeleccionada || !mesasActivas.has(mesaSeleccionada)) return;
  const pedido = normalizarPedido(mesasActivas.get(mesaSeleccionada));
  const aImprimir = (pedido.items || []).filter(function (item) { return item.estado === 'en_cocina'; });
  if (!aImprimir.length) {
    avisoMesero('Primero envía el pedido a cocina');
    return;
  }
  imprimirTicketCocinaMesero(mesaSeleccionada, aImprimir, { ronda: pedido.ronda, pedido: pedido });
}

function avisoMesero(texto) {
  let el = document.getElementById('avisoMesero');
  if (!el) {
    el = document.createElement('div');
    el.id = 'avisoMesero';
    el.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:30000;background:#0dcaf0;color:#111;padding:10px 16px;border-radius:12px;font-weight:700;font-size:0.9rem;max-width:90%;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.35)';
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.style.display = 'none'; }, 3200);
}

function configImpresoraCocinaMesero() {
  const ip = String(localStorage.getItem('impresoraCocinaIp') || '').trim();
  let puerto = parseInt(localStorage.getItem('impresoraCocinaPuerto') || '9100', 10);
  if (!Number.isFinite(puerto) || puerto < 1 || puerto > 65535) puerto = 9100;
  const anchoMm = String(localStorage.getItem('impresoraCocinaAncho') || '80') === '58' ? '58' : '80';
  return { ip: ip, puerto: puerto, anchoMm: anchoMm };
}

function puedeImprimirMeseroDesdeCelular() {
  return !!(configImpresoraCocinaMesero().ip && esAndroidMesero());
}

function registroCocinaMesero(base) {
  const registro = base || {};
  registro.origen = 'mesero';
  registro.imprimirEnCaja = !puedeImprimirMeseroDesdeCelular();
  registro.impresoEnCaja = false;
  return registro;
}

function bytesLatinImpresora(texto) {
  const mapa = {
    'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ü': 0x81, 'ñ': 0xA4,
    'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ú': 0xE9, 'Ü': 0x9A, 'Ñ': 0xA5,
    '¿': 0xA8, '¡': 0xAD, '°': 0xF8
  };
  const out = [];
  String(texto || '').split('').forEach(function (ch) {
    if (mapa[ch] != null) out.push(mapa[ch]);
    else out.push(ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63);
  });
  return out;
}

function envolverTextoTicket(texto, ancho) {
  const palabras = String(texto || '').split(/\s+/);
  const lineas = [];
  let linea = '';
  palabras.forEach(function (palabra) {
    if (!palabra) return;
    if (!linea) {
      linea = palabra;
      return;
    }
    if ((linea + ' ' + palabra).length <= ancho) linea += ' ' + palabra;
    else {
      lineas.push(linea);
      linea = palabra;
    }
  });
  if (linea) lineas.push(linea);
  return lineas.length ? lineas : [''];
}

function bytesEscPosTicketCocina(mesa, productos, opciones) {
  opciones = opciones || {};
  const pedido = opciones.pedido || mesasActivas.get(mesa) || {};
  const fechaTicket = new Date().toLocaleString();
  const rondaTicket = Number(opciones.ronda) || rondaDeItem((productos || [])[0]) || 1;
  const nombreMeseroTicket = String(opciones.nombreMesero || pedido.nombreMesero || nombreMeseroSesion() || '').trim();
  const titulo = tituloTicketCocinaMesero(mesa, pedido);
  const cfg = configImpresoraCocinaMesero();
  const papel58 = cfg.anchoMm === '58';
  const ancho = papel58 ? 32 : 48;
  const puntos = papel58 ? 384 : 576;
  const colsItem = papel58 ? 32 : 24;
  const colCant = 4;
  const bytes = [
    0x1B, 0x40,
    0x1B, 0x33, 0x3C,
    0x1B, 0x4D, 0x00,
    0x1D, 0x4C, 0x00, 0x00,
    0x1D, 0x57, puntos & 0xFF, (puntos >> 8) & 0xFF,
    0x1B, 0x74, 0x02
  ];
  function add(arr) { Array.prototype.push.apply(bytes, arr); }
  function txt(s) { add(bytesLatinImpresora(s)); }
  function ln(s) { if (s) txt(s); add([0x0A]); }
  function sep() { ln(new Array(ancho + 1).join('-').slice(0, ancho)); }
  function centro(on) { add([0x1B, 0x61, on ? 1 : 0]); }
  function negrita(on) { add([0x1B, 0x45, on ? 1 : 0]); }
  function tamano(w, h) { add([0x1D, 0x21, ((Math.max(1, w) - 1) << 4) | (Math.max(1, h) - 1)]); }
  function padDer(s, n) {
    s = String(s || '');
    while (s.length < n) s += ' ';
    return s.slice(0, n);
  }

  centro(true);
  negrita(true);
  tamano(2, 2);
  ln('COCINA');
  ln(titulo);
  ln('Ronda: ' + rondaTicket);
  tamano(1, 1);
  if (nombreMeseroTicket) ln(etiquetaRolMeseroSesion(pedido, opciones) + ': ' + nombreMeseroTicket);
  negrita(false);
  ln(fechaTicket);
  centro(false);
  sep();
  if (pedido.cambioMesa) {
    const info = textoCambioPedidoMesero(pedido.cambioMesa);
    centro(true);
    negrita(true);
    ln(info.titulo);
    negrita(false);
    ln(info.linea);
    if (pedido.cambioMesa.fecha) ln(pedido.cambioMesa.fecha);
    centro(false);
    sep();
  }
  if (pedido.cliente) {
    negrita(true);
    ln('Cliente: ' + pedido.cliente);
    negrita(false);
    if (pedido.telefono) ln('Tel: ' + pedido.telefono);
    if (esDomicilioMesero(mesa, pedido) && pedido.direccion) {
      envolverTextoTicket('Dir: ' + pedido.direccion, ancho).forEach(ln);
    }
    if (esRecogerMesero(mesa, pedido) && pedido.horaRecoger) ln('Hora: ' + pedido.horaRecoger);
    sep();
  }
  negrita(true);
  ln(padDer('Cant', colCant) + 'Producto');
  negrita(false);
  (productos || []).forEach(function (item) {
    const cant = String(item.cantidad || 1);
    const nombre = String(item.nombre || '');
    tamano(papel58 ? 1 : 2, 2);
    negrita(true);
    const anchoNombre = colsItem - colCant;
    const lineasNom = envolverTextoTicket(nombre, Math.max(8, anchoNombre));
    lineasNom.forEach(function (lineaNom, i) {
      ln(padDer(i === 0 ? cant : '', colCant) + lineaNom);
    });
    tamano(1, 1);
    negrita(false);
    if (item.detalles) {
      envolverTextoTicket('Detalle: ' + item.detalles, ancho).forEach(function (lineaDet, i) {
        ln(i === 0 ? lineaDet : ('        ' + lineaDet));
      });
    }
  });
  sep();
  centro(true);
  negrita(true);
  ln('¡Gracias!');
  negrita(false);
  centro(false);
  add([0x1B, 0x32]);
  add([0x0A, 0x0A, 0x0A, 0x0A, 0x0A]);
  add([0x1D, 0x56, 0x41, 0x10]);
  add([0x1D, 0x56, 0x00]);
  add([0x1B, 0x69]);
  return new Uint8Array(bytes);
}

function bytesABase64Mesero(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let s = '';
  const paso = 0x8000;
  for (let i = 0; i < arr.length; i += paso) {
    s += String.fromCharCode.apply(null, arr.subarray(i, i + paso));
  }
  return btoa(s);
}

function enviarTicketRawBT(bytes) {
  if (!esAndroidMesero()) return false;
  try {
    const b64 = bytesABase64Mesero(bytes).replace(/\s+/g, '');
    // Formato oficial de RawBT. Sin type ni Play Store: si no coinciden, Chrome te manda a la tienda aunque la app ya esté instalada.
    const href = 'intent:base64,' + b64 + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end';
    window.location.href = href;
    return true;
  } catch (e) {
    return false;
  }
}

function htmlCuerpoTicketCocinaMesero(mesa, productos, opciones) {
  opciones = opciones || {};
  const pedido = opciones.pedido || mesasActivas.get(mesa) || {};
  const fechaTicket = new Date().toLocaleString();
  const rondaTicket = Number(opciones.ronda) || rondaDeItem((productos || [])[0]) || 1;
  const nombreMeseroTicket = String(opciones.nombreMesero || pedido.nombreMesero || nombreMeseroSesion() || '').trim();
  const titulo = tituloTicketCocinaMesero(mesa, pedido);
  let infoCliente = '';
  if (pedido.cliente) {
    const esDom = esDomicilioMesero(mesa, pedido);
    const esRec = esRecogerMesero(mesa, pedido);
    infoCliente =
      '<div class="cliente-info">' +
      '<div class="cliente-label">Cliente:</div>' +
      '<div><strong>' + escaparHtml(pedido.cliente) + '</strong><br>' +
      (pedido.telefono ? 'Tel: ' + escaparHtml(pedido.telefono) + '<br>' : '') +
      (esDom ? 'Dir: ' + escaparHtml(pedido.direccion || '') : (esRec && pedido.horaRecoger ? 'Hora: ' + escaparHtml(pedido.horaRecoger) : '')) +
      '</div></div>';
  }
  const filas = (productos || []).map(function (item) {
    return '<tr><td style="font-size:20px;font-weight:bold;">' + escaparHtml(item.cantidad) + '</td><td>' +
      '<div class="producto" style="font-weight:bold;font-size:16px;">' + escaparHtml(item.nombre) + '</div>' +
      (item.detalles ? '<div class="detalles"><span class="detalle-label">Detalle:</span> ' + escaparHtml(item.detalles) + '</div>' : '') +
      '</td></tr>';
  }).join('');
  let infoCambio = '';
  if (pedido.cambioMesa) {
    const info = textoCambioPedidoMesero(pedido.cambioMesa);
    infoCambio = '<div class="cliente-info" style="border:2px solid #000;text-align:center;">' +
      '<div style="font-weight:bold;font-size:16px;">' + escaparHtml(info.titulo) + '</div>' +
      '<div style="font-size:14px;">' + escaparHtml(info.linea) + '</div>' +
      (pedido.cambioMesa.fecha ? '<div>' + escaparHtml(pedido.cambioMesa.fecha) + '</div>' : '') +
      '</div>';
  }
  return '<div class="header text-center"><h2 style="margin:0;font-size:28px;">COCINA</h2>' +
    '<div style="font-size:22px;font-weight:bold;">' + escaparHtml(titulo) + '</div>' +
    '<div style="font-size:20px;font-weight:bold;">Ronda: ' + rondaTicket + '</div>' +
    (nombreMeseroTicket ? '<div style="font-size:18px;font-weight:bold;">' + escaparHtml(etiquetaRolMeseroSesion(pedido, opciones)) + ': ' + escaparHtml(nombreMeseroTicket) + '</div>' : '') +
    '<div>' + escaparHtml(fechaTicket) + '</div></div>' + infoCambio + infoCliente +
    '<table><thead><tr><th style="width:20%">Cant</th><th>Producto</th></tr></thead><tbody>' + filas +
    '</tbody></table><div class="text-center border-top">¡Gracias!</div>';
}

function esImpresionMovilMesero() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function esAndroidMesero() {
  return /Android/i.test(navigator.userAgent || '');
}

function restaurarElementosOcultosImpresionMesero() {
  Array.prototype.forEach.call(document.body.children, function (el) {
    if (!el.hasAttribute('data-print-prev-display')) return;
    const prev = el.getAttribute('data-print-prev-display');
    el.removeAttribute('data-print-prev-display');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    if (prev) el.style.display = prev;
  });
}

function ocultarAppParaImpresionMesero() {
  const capa = document.getElementById('capaImpresionMesero');
  Array.prototype.forEach.call(document.body.children, function (el) {
    if (el === capa) return;
    if (!el.hasAttribute('data-print-prev-display')) {
      el.setAttribute('data-print-prev-display', el.style.display || '');
    }
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
  });
  document.body.classList.add('imprimiendo-mesero');
}

function cerrarCapaImpresionMesero() {
  restaurarElementosOcultosImpresionMesero();
  const capa = document.getElementById('capaImpresionMesero');
  if (capa) {
    capa.hidden = true;
    capa.classList.remove('visible');
  }
  document.body.classList.remove('imprimiendo-mesero');
}

function confirmarImpresionMesero() {
  lanzarImpresionTicketMesero();
}

function imprimirTicketCocinaMesero(mesa, productos, opciones) {
  if (puedeImprimirMeseroDesdeCelular()) {
    const bytes = bytesEscPosTicketCocina(mesa, productos, opciones);
    if (enviarTicketRawBT(bytes)) {
      avisoMesero('Enviando a la impresora de cocina…');
      return;
    }
  }
  avisoMesero('Pedido enviado. El ticket se imprime en la caja principal.');
}

function lanzarImpresionTicketMesero() {
  document.body.classList.add('capturando-ticket');
  const esperaPintado = esImpresionMovilMesero() ? 400 : 50;
  setTimeout(function () {
    try { window.print(); } catch (e) {}
    setTimeout(function () {
      document.body.classList.remove('capturando-ticket');
    }, esImpresionMovilMesero() ? 1500 : 100);
  }, esperaPintado);
}

function imprimirTicketCocinaEnCelular(mesa, productos, opciones) {
  const ticket = htmlCuerpoTicketCocinaMesero(mesa, productos, opciones);
  const capa = document.getElementById('capaImpresionMesero');
  const contenido = document.getElementById('contenidoImpresionMesero');
  if (capa && contenido) {
    contenido.innerHTML = ticket;
    capa.hidden = false;
    capa.classList.add('visible');
    ocultarAppParaImpresionMesero();
    if (!esImpresionMovilMesero()) {
      const alTerminar = function () {
        window.removeEventListener('afterprint', alTerminar);
        cerrarCapaImpresionMesero();
      };
      window.addEventListener('afterprint', alTerminar);
    }
    lanzarImpresionTicketMesero();
    return;
  }
  try { window.print(); } catch (e) {}
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
    if (typeof ToySoftFirebase.sincronizarDatos === 'function') {
      await ToySoftFirebase.sincronizarDatos();
    }
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
    arrancarPulsoMesero();
    if (typeof ToySoftFirebase.escucharDatos === 'function') {
      ToySoftFirebase.escucharDatos(function () {
        const modal = document.getElementById('modalPedidoExternoMesero');
        if (modal && modal.classList.contains('show')) buscarClientesMesero();
      });
    }
  } catch (error) {
    console.warn('Mesero no pudo sincronizar', error);
  }
}

function uidMeseroSesion() {
  if (window.ToySoftFirebase && typeof ToySoftFirebase.uidMeseroActual === 'function') {
    return ToySoftFirebase.uidMeseroActual();
  }
  return '';
}

function nombreMeseroSesion() {
  if (window.ToySoftFirebase && typeof ToySoftFirebase.nombreMeseroActual === 'function') {
    return ToySoftFirebase.nombreMeseroActual();
  }
  return '';
}

function anotarMeseroEnPedido(pedido, item) {
  const nombre = nombreMeseroSesion();
  const sexo = sexoMeseroSesion();
  const uid = uidMeseroSesion();
  if (pedido) {
    if (nombre && !pedido.nombreMesero) pedido.nombreMesero = nombre;
    if (sexo && !pedido.sexoMesero) pedido.sexoMesero = sexo;
    if (uid && !pedido.meseroUid) pedido.meseroUid = uid;
    if (!pedido.origen) pedido.origen = 'mesero';
  }
  if (item) {
    if (nombre) item.nombreMesero = nombre;
    if (sexo) item.sexoMesero = sexo;
    if (uid) item.meseroUid = uid;
  }
}

function sexoMeseroSesion() {
  if (window.ToySoftFirebase && typeof ToySoftFirebase.sexoMeseroActual === 'function') {
    return ToySoftFirebase.sexoMeseroActual();
  }
  return '';
}

function etiquetaRolMeseroSesion(pedido, opciones) {
  const sexo = (opciones && opciones.sexoMesero) || (pedido && pedido.sexoMesero) || sexoMeseroSesion();
  return sexo === 'femenino' ? 'Mesera' : 'Mesero';
}

function pintarNombreMeseroCabecera() {
  const el = document.getElementById('nombreUsuarioMesero');
  if (el) el.textContent = nombreMeseroSesion() || '';
  const rol = etiquetaRolMeseroSesion();
  const rolEl = document.getElementById('rolMeseroCabecera');
  if (rolEl) rolEl.textContent = rol;
  const ayuda = document.getElementById('tituloAyuda');
  if (ayuda) ayuda.textContent = '- ' + rol;
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

function pulsarOperacionMesero() {
  if (persistiendo) return;
  if (!window.ToySoftFirebase || typeof ToySoftFirebase.refrescarOperacionDesdeNube !== 'function') return;
  ToySoftFirebase.refrescarOperacionDesdeNube().then(function (nube) {
    if (nube) aplicarOperacionNube(nube);
  }).catch(function () {});
}

function arrancarPulsoMesero() {
  if (window._toysoftPulsoMesero) return;
  window._toysoftPulsoMesero = setInterval(pulsarOperacionMesero, 4000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) pulsarOperacionMesero();
  });
}

function actualizarPaginaMesero() {
  const btn = document.getElementById('btnActualizarMesero');
  if (btn) btn.classList.add('girando');
  window.location.reload();
}

function mostrarLoginMesero() {
  const login = document.getElementById('loginMesero');
  const app = document.getElementById('appMesero');
  if (login) login.style.display = 'flex';
  if (app) {
    app.style.display = 'none';
    app.classList.remove('app-visible');
  }
}

function mostrarAppMesero() {
  const login = document.getElementById('loginMesero');
  const app = document.getElementById('appMesero');
  if (login) login.style.display = 'none';
  if (app) {
    app.style.display = 'flex';
    app.classList.add('app-visible');
  }
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
    const esMesero = typeof ToySoftFirebase.esMesero === 'function' && ToySoftFirebase.esMesero();
    const recordado = typeof ToySoftFirebase.sesionRecordada === 'function' && ToySoftFirebase.sesionRecordada('mesero');
    if (!esMesero && !recordado) {
      mostrarLoginMesero();
      mostrarLoginMensaje('');
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
