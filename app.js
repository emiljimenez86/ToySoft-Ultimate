// Variables globales
window.ultimaHoraCierre = null;
let productos = [];
let categorias = [];
let mesasActivas = new Map(); // Almacena las órdenes por mesa
window.ToysoftSnapshotMesas = function () {
  try {
    return Array.from(mesasActivas.entries());
  } catch (e) {
    return [];
  }
};
let mesaSeleccionada = null; // Mesa actualmente seleccionada
let ordenesCocina = new Map(); // Almacena las órdenes enviadas a cocina
let clientes = []; // Almacena los clientes frecuentes
let tipoPedidoActual = null; // 'domicilio' o 'recoger'
let contadorDomicilios = 0; // Contador de pedidos a domicilio
let contadorRecoger = 0; // Contador de pedidos para recoger
let historialVentas = []; // Almacena el historial de ventas
let historialCocina = []; // Almacena el historial de órdenes de cocina
let ultimaFechaContadores = null; // Fecha del último contador

// Abrir modal Bootstrap sin cerrar por clic afuera ni Escape
function abrirModalEstatico(elementOrId, extraOptions) {
  extraOptions = extraOptions || {};
  const el = typeof elementOrId === 'string'
    ? document.getElementById(elementOrId)
    : elementOrId;
  if (!el) {
    console.warn('Modal no encontrado:', elementOrId);
    return null;
  }
  if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
    mostrarModalRespaldo(el);
    return null;
  }
  const opciones = {
    backdrop: 'static',
    keyboard: false
  };
  Object.keys(extraOptions).forEach(function (clave) {
    opciones[clave] = extraOptions[clave];
  });
  let modal = null;
  try {
    modal = bootstrap.Modal.getOrCreateInstance(el, opciones);
  } catch (error) {
    try {
      const previa = bootstrap.Modal.getInstance(el);
      if (previa) previa.dispose();
    } catch (e) {}
    try {
      modal = new bootstrap.Modal(el, opciones);
    } catch (e2) {
      console.warn('No se pudo crear el modal con Bootstrap', e2);
      mostrarModalRespaldo(el);
      return null;
    }
  }
  try {
    modal.show();
  } catch (error) {
    console.warn('No se pudo mostrar el modal con Bootstrap', error);
    mostrarModalRespaldo(el);
  }
  return modal;
}

function mostrarModalRespaldo(el) {
  if (!el) return;
  el.classList.add('show');
  el.style.display = 'block';
  el.removeAttribute('aria-hidden');
  el.setAttribute('aria-modal', 'true');
  if (!document.querySelector('.modal-backdrop')) {
    const fondo = document.createElement('div');
    fondo.className = 'modal-backdrop fade show';
    document.body.appendChild(fondo);
  }
  document.body.classList.add('modal-open');
}

function correoCuentaFirebase() {
  try {
    if (window.ToySoftFirebase && typeof ToySoftFirebase.getUsuario === 'function') {
      const u = ToySoftFirebase.getUsuario() || {};
      if (u.email) return String(u.email).trim().toLowerCase();
    }
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      return String(firebase.auth().currentUser.email || '').trim().toLowerCase();
    }
  } catch (e) {}
  return '';
}

function esNombreNegocioPorDefecto(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  return !n
    || n === 'toysoft'
    || n === 'toysoft pos'
    || n === 'toysoft ultimate'
    || n === 'toysoft ultimate version';
}

function datosNegocioParaTicket() {
  let datos = {};
  try {
    datos = JSON.parse(localStorage.getItem('datosNegocio') || '{}') || {};
  } catch (e) {
    datos = {};
  }
  const correo = String(datos.correo || '').trim();
  const correoCuenta = correoCuentaFirebase();
  return {
    nombre: esNombreNegocioPorDefecto(datos.nombre) ? '' : String(datos.nombre || '').trim(),
    nit: String(datos.nit || '').trim(),
    direccion: String(datos.direccion || '').trim(),
    correo: (correo && correo.toLowerCase() !== correoCuenta) ? correo : '',
    telefono: String(datos.telefono || '').trim()
  };
}

function htmlPieDatosNegocioTicket() {
  const d = datosNegocioParaTicket();
  if (!d.nombre && !d.nit && !d.direccion && !d.telefono) return '';
  return `
    <div class="border-top mt-1">
      ${d.nombre ? `<div><strong>${d.nombre}</strong></div>` : ''}
      ${d.nit ? `<div>NIT/Cédula: ${d.nit}</div>` : ''}
      ${d.direccion ? `<div>Dirección: ${d.direccion}</div>` : ''}
      ${d.telefono ? `<div>Teléfono: ${d.telefono}</div>` : ''}
    </div>
  `;
}

// Memoria de nombres de domiciliarios (autocompletado)
const STORAGE_DOMICILIARIOS = 'nombresDomiciliarios';
const MAX_DOMICILIARIOS = 50;
function obtenerNombresDomiciliarios() {
  try {
    const s = localStorage.getItem(STORAGE_DOMICILIARIOS);
    return s ? JSON.parse(s) : [];
  } catch (e) {
    return [];
  }
}
function guardarNombreDomiciliario(nombre) {
  const n = (nombre || '').trim();
  if (!n) return;
  let lista = obtenerNombresDomiciliarios();
  lista = lista.filter(x => x.toLowerCase() !== n.toLowerCase());
  lista.unshift(n);
  lista = lista.slice(0, MAX_DOMICILIARIOS);
  localStorage.setItem(STORAGE_DOMICILIARIOS, JSON.stringify(lista));
  actualizarDatalistDomiciliarios();
  notificarOperacionNube();
}
function actualizarDatalistDomiciliarios() {
  const datalist = document.getElementById('listaDomiciliarios');
  if (!datalist) return;
  datalist.innerHTML = '';
  const nombres = obtenerNombresDomiciliarios();
  nombres.forEach(nombre => {
    const opt = document.createElement('option');
    opt.value = nombre;
    datalist.appendChild(opt);
  });
}

function esVentaCajaRapida(venta) {
  if (!venta) return false;
  const mesa = (venta.mesa || '').toString();
  return venta.tipo === 'venta_rapida'
    || venta.origen === 'caja_rapida'
    || mesa === 'VENTA DIRECTA'
    || mesa.startsWith('VENTA DIRECTA');
}

function clasificarCanalVentaBalance(venta) {
  if (!venta) return 'mesa';
  if (esVentaCajaRapida(venta)) return 'venta_rapida';
  const tipo = (venta.tipo || '').toLowerCase();
  const canal = (venta.canal || '').toLowerCase();
  const mesa = (venta.mesa || '').toString();
  if (tipo === 'domicilio' || canal === 'domicilio' || mesa.startsWith('DOM-')) return 'domicilio';
  if (tipo === 'recoger' || canal === 'recoger' || mesa.startsWith('REC-')) return 'recoger';
  return 'mesa';
}

function resumirVentasPorCanalBalance(ventas) {
  const canales = {
    mesa: { clave: 'mesa', etiqueta: 'Mesas', icono: 'fa-utensils', cantidadVentas: 0, total: 0, productos: {} },
    domicilio: { clave: 'domicilio', etiqueta: 'Domicilios', icono: 'fa-motorcycle', cantidadVentas: 0, total: 0, productos: {} },
    recoger: { clave: 'recoger', etiqueta: 'Recoger', icono: 'fa-shopping-bag', cantidadVentas: 0, total: 0, productos: {} },
    venta_rapida: { clave: 'venta_rapida', etiqueta: 'Venta rápida', icono: 'fa-bolt', cantidadVentas: 0, total: 0, productos: {} }
  };

  (ventas || []).forEach(venta => {
    const canal = canales[clasificarCanalVentaBalance(venta)] || canales.mesa;
    canal.cantidadVentas += 1;
    canal.total += parseFloat(venta.total) || 0;
    (venta.items || venta.productos || []).forEach(item => {
      const nombre = (item.nombre || 'Producto').toString().trim() || 'Producto';
      if (!canal.productos[nombre]) {
        canal.productos[nombre] = { nombre, cantidad: 0, total: 0 };
      }
      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precio) || 0;
      canal.productos[nombre].cantidad += cantidad;
      canal.productos[nombre].total += item.total != null
        ? (parseFloat(item.total) || 0)
        : (precio * cantidad);
    });
  });

  return canales;
}

function htmlTablaProductosCanalBalance(canal) {
  if (!canal) return '';
  const productos = Object.values(canal.productos || {}).sort((a, b) => b.cantidad - a.cantidad);
  const filas = productos.length
    ? productos.map(p => `
        <tr>
          <td>${p.nombre}</td>
          <td class="text-end">${p.cantidad.toLocaleString()}</td>
          <td class="text-end">$ ${Math.round(p.total).toLocaleString()}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" class="text-muted">Sin ventas en este tipo</td></tr>';
  return `
    <h6 class="mt-1 mb-2"><i class="fas ${canal.icono} me-1"></i>${canal.etiqueta}</h6>
    <div class="table-responsive">
      <table class="table table-sm mb-0">
        <thead>
          <tr>
            <th>Producto</th>
            <th class="text-end">Cantidad</th>
            <th class="text-end">Total</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function mostrarDetalleCanalBalance(clave) {
  const data = window._balanceCanales;
  const detalleCanal = document.getElementById('detalleProductosPorCanal');
  if (!data || !detalleCanal) return;

  window._balanceCanalActivo = window._balanceCanalActivo === clave ? null : clave;
  document.querySelectorAll('#resumenVentasPorCanal tr[data-canal]').forEach(tr => {
    const activo = tr.dataset.canal === window._balanceCanalActivo;
    tr.classList.toggle('canal-activo', activo);
    tr.setAttribute('aria-expanded', activo ? 'true' : 'false');
  });

  if (!window._balanceCanalActivo) {
    detalleCanal.innerHTML = '';
    return;
  }

  detalleCanal.innerHTML = htmlTablaProductosCanalBalance(data[clave]);
}

function htmlImpresionTotalesPorCanalBalance() {
  const data = window._balanceCanales;
  const orden = [
    ['mesa', 'Mesas'],
    ['domicilio', 'Domicilios'],
    ['recoger', 'Recoger'],
    ['venta_rapida', 'Venta rápida']
  ];
  if (!data) return '';
  return orden.map(([clave, etiqueta]) => {
    const canal = data[clave] || {};
    return `
      <tr>
        <td>${etiqueta}</td>
        <td style="text-align:right;">${(canal.cantidadVentas || 0).toLocaleString()}</td>
        <td style="text-align:right;">$ ${Math.round(canal.total || 0).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

const ETIQUETA_CAJA_BALANCE_MESERO = 'Caja (POS)';

function montoLineaProductoBalance(item) {
  if (!item) return 0;
  const cantidad = parseFloat(item.cantidad) || 0;
  const precio = parseFloat(item.precio) || 0;
  if (item.total != null) return parseFloat(item.total) || 0;
  return precio * cantidad;
}

function nombreMeseroDeTexto(valor) {
  return String(valor || '').trim();
}

function agregarProductoAGrupoBalance(grupo, item) {
  if (!grupo || !item) return;
  const nombre = (item.nombre || 'Producto').toString().trim() || 'Producto';
  if (!grupo.productos[nombre]) {
    grupo.productos[nombre] = { nombre, cantidad: 0, total: 0 };
  }
  grupo.productos[nombre].cantidad += parseFloat(item.cantidad) || 0;
  grupo.productos[nombre].total += montoLineaProductoBalance(item);
}

function grupoMeseroBalance(mapa, nombre, sexo) {
  const clave = nombreMeseroDeTexto(nombre) || ETIQUETA_CAJA_BALANCE_MESERO;
  if (!mapa[clave]) {
    mapa[clave] = {
      clave,
      nombre: clave,
      esCaja: clave === ETIQUETA_CAJA_BALANCE_MESERO,
      cantidadVentas: 0,
      total: 0,
      productos: {},
      icono: clave === ETIQUETA_CAJA_BALANCE_MESERO ? 'fa-cash-register' : 'fa-user-tie',
      etiqueta: clave
    };
  }
  if (sexo === 'femenino') mapa[clave].sexo = 'femenino';
  return mapa[clave];
}

function resumirVentasPorMeseroBalance(ventas) {
  const mapa = {};
  (ventas || []).forEach(venta => {
    const items = venta.items || venta.productos || [];
    const nombreVenta = nombreMeseroDeTexto(venta.nombreMesero);
    const nombresItems = {};
    items.forEach(item => {
      const n = nombreMeseroDeTexto(item && item.nombreMesero);
      if (!n) return;
      if (!nombresItems[n]) nombresItems[n] = [];
      nombresItems[n].push(item);
    });
    const nombresUnicos = Object.keys(nombresItems);
    const sexo = venta.sexoMesero || ((items.find(i => i && i.sexoMesero) || {}).sexoMesero);
    const totalVenta = parseFloat(venta.total) || 0;

    if (nombresUnicos.length <= 1) {
      const nombre = nombresUnicos[0] || nombreVenta || (venta.origen === 'mesero' ? 'Mesero' : ETIQUETA_CAJA_BALANCE_MESERO);
      const grupo = grupoMeseroBalance(mapa, nombre, sexo);
      grupo.cantidadVentas += 1;
      grupo.total += totalVenta;
      items.forEach(item => agregarProductoAGrupoBalance(grupo, item));
      return;
    }

    const subtotalItems = items.reduce((s, i) => s + montoLineaProductoBalance(i), 0) || 1;
    const itemsSinMesero = items.filter(i => !nombreMeseroDeTexto(i && i.nombreMesero));
    const destinoSinNombre = nombreVenta || ETIQUETA_CAJA_BALANCE_MESERO;
    const aportes = {};
    nombresUnicos.forEach(n => {
      aportes[n] = nombresItems[n].reduce((s, i) => s + montoLineaProductoBalance(i), 0);
    });
    if (itemsSinMesero.length) {
      aportes[destinoSinNombre] = (aportes[destinoSinNombre] || 0)
        + itemsSinMesero.reduce((s, i) => s + montoLineaProductoBalance(i), 0);
    }

    Object.keys(aportes).forEach(n => {
      const grupo = grupoMeseroBalance(mapa, n, sexo);
      grupo.cantidadVentas += 1;
      grupo.total += totalVenta * (aportes[n] / subtotalItems);
      const susItems = n === destinoSinNombre
        ? (nombresItems[n] || []).concat(itemsSinMesero)
        : (nombresItems[n] || []);
      susItems.forEach(item => agregarProductoAGrupoBalance(grupo, item));
    });
  });
  return mapa;
}

function listaMeserosBalanceOrdenada(mapa) {
  return Object.values(mapa || {}).sort((a, b) => {
    if (a.esCaja !== b.esCaja) return a.esCaja ? 1 : -1;
    return (b.total || 0) - (a.total || 0);
  });
}

function mostrarDetalleMeseroBalance(clave) {
  const data = window._balanceMeseros;
  const detalle = document.getElementById('detalleProductosPorMesero');
  if (!data || !detalle) return;

  window._balanceMeseroActivo = window._balanceMeseroActivo === clave ? null : clave;
  document.querySelectorAll('#resumenVentasPorMesero tr[data-mesero]').forEach(tr => {
    const activo = tr.dataset.mesero === window._balanceMeseroActivo;
    tr.classList.toggle('canal-activo', activo);
    tr.setAttribute('aria-expanded', activo ? 'true' : 'false');
  });

  if (!window._balanceMeseroActivo) {
    detalle.innerHTML = '';
    return;
  }

  detalle.innerHTML = htmlTablaProductosCanalBalance(data[clave]);
}

function htmlImpresionTotalesPorMeseroBalance() {
  const lista = listaMeserosBalanceOrdenada(window._balanceMeseros);
  if (!lista.length) {
    return '<tr><td colspan="3">Sin ventas en este periodo</td></tr>';
  }
  return lista.map(mesero => `
    <tr>
      <td>${mesero.nombre}</td>
      <td style="text-align:right;">${(mesero.cantidadVentas || 0).toLocaleString()}</td>
      <td style="text-align:right;">$ ${Math.round(mesero.total || 0).toLocaleString()}</td>
    </tr>
  `).join('');
}

function datosMeseroDePedido(pedido) {
  const items = (pedido && pedido.items) || [];
  const itemConMesero = items.find(function (i) {
    return i && (i.nombreMesero || i.meseroUid);
  }) || {};
  const nombreMesero = nombreMeseroDeTexto((pedido && pedido.nombreMesero) || itemConMesero.nombreMesero);
  return {
    origen: (pedido && pedido.origen) || (nombreMesero ? 'mesero' : 'pos'),
    nombreMesero,
    sexoMesero: (pedido && pedido.sexoMesero) || itemConMesero.sexoMesero || '',
    meseroUid: (pedido && pedido.meseroUid) || itemConMesero.meseroUid || ''
  };
}

function obtenerCanalVentaRapida(venta) {
  if (!esVentaCajaRapida(venta)) return null;
  const canal = (venta.canal || '').toLowerCase().trim();
  if (canal === 'domicilio' || canal === 'recoger' || canal === 'mesa') return canal;
  return 'sin_canal';
}

function claveUnicaVentaCierre(venta) {
    if (!venta || typeof venta !== 'object') return '';
    if (venta.id != null && venta.id !== '') return String(venta.id);
    return [venta.fecha, venta.mesa, venta.total, venta.metodoPago, venta.tipo].join('|');
}

// Función simplificada para obtener todas las ventas del día
function obtenerTodasLasVentas() {
    try {
        if (window.ToySoftFirebase && typeof ToySoftFirebase.ventasDesdeLocal === 'function') {
            const unificadas = ToySoftFirebase.ventasDesdeLocal();
            console.log(`📊 Total ventas encontradas: ${unificadas.length}`);
            return unificadas;
        }
        const historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        const ventasActivas = JSON.parse(localStorage.getItem('ventas') || '[]');
        const domicilios = JSON.parse(localStorage.getItem('domicilios') || '[]');
        const pendientes = JSON.parse(localStorage.getItem('facturasPendientes') || '[]');
        const todasLasVentas = [...historial, ...ventasActivas, ...domicilios, ...pendientes];
        const ventasValidas = [];
        const idsVistos = new Set();

        for (const venta of todasLasVentas) {
            if (!venta || typeof venta !== 'object') continue;
            const clave = claveUnicaVentaCierre(venta);
            if (!clave || idsVistos.has(clave)) continue;
            idsVistos.add(clave);
            ventasValidas.push(venta);
        }

        console.log(`📊 Total ventas encontradas: ${ventasValidas.length}`);
        return ventasValidas;
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        return [];
    }
}

// Helper: parseo robusto de fechas (ISO y formato local dd/mm/yyyy, hh:mm:ss a. m./p. m.)
function parseFechaSeguro(valor) {
    if (valor instanceof Date) {
        return isNaN(valor.getTime()) ? null : valor;
    }
    if (valor && typeof valor === 'object') {
        if (typeof valor.toDate === 'function') {
            try {
                const dTs = valor.toDate();
                return isNaN(dTs.getTime()) ? null : dTs;
            } catch (e) { /* ignore */ }
        }
        if (typeof valor.seconds === 'number') {
            const dSec = new Date(valor.seconds * 1000);
            return isNaN(dSec.getTime()) ? null : dSec;
        }
    }
    if (typeof valor !== 'string') {
        if (typeof valor === 'number' && Number.isFinite(valor)) {
            const dNum = new Date(valor);
            return isNaN(dNum.getTime()) ? null : dNum;
        }
        return null;
    }

    // Normalizar espacios raros de locales es-CO (NBSP / narrow NBSP en a. m. / p. m.)
    const texto = valor
        .replace(/\u202f/g, ' ')
        .replace(/\u00a0/g, ' ')
        .trim();

    // Intentar ISO primero
    const iso = new Date(texto);
    if (!isNaN(iso.getTime()) && (/^\d{4}-\d{2}-\d{2}/.test(texto) || texto.includes('T') || /GMT|UTC|Z$/i.test(texto))) {
        return iso;
    }
    // Date() a veces parsea strings locales; si es válido y no es formato ambiguo dd/mm, usarlo
    if (!isNaN(iso.getTime()) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(texto)) {
        return iso;
    }

    // Intentar formato local: 16/9/2025, 5:58:46 p. m.
    const re = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.\s*m\.|p\.\s*m\.)\s*)?$/i;
    const m = texto.match(re);
    if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        let h = m[4] ? parseInt(m[4], 10) : 0;
        const min = m[5] ? parseInt(m[5], 10) : 0;
        const s = m[6] ? parseInt(m[6], 10) : 0;
        const ampm = m[7] ? m[7].toLowerCase().replace(/\s+/g, ' ') : null;
        if (ampm && ampm.includes('p. m.') && h < 12) h += 12;
        if (ampm && ampm.includes('a. m.') && h === 12) h = 0;
        const dt = new Date(y, mo, d, h, min, s);
        if (!isNaN(dt.getTime())) return dt;
    }

    // Último intento: dejando que el motor parseé
    if (!isNaN(iso.getTime())) return iso;
    return null;
}

// Helper: compara fechas por componentes locales (año/mes/día)
function esMismaFechaLocal(fechaA, fechaB = new Date()) {
    try {
        const a = parseFechaSeguro(fechaA);
        const b = parseFechaSeguro(fechaB) || new Date();
        if (!a) return false;
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    } catch (e) {
        return false;
    }
}

// YYYY-MM-DD en zona LOCAL (NUNCA usar toISOString().slice(0,10) para "hoy":
// en Colombia UTC-5, después de las 7:00 p.m. toISOString ya es el día siguiente).
function fechaLocalISO(valor = new Date()) {
    const d = parseFechaSeguro(valor) || (valor instanceof Date ? valor : new Date());
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function operaPasadaMedianoche() {
    return localStorage.getItem('operarDespuesMedianoche') === 'true';
}

function horaFinDiaLaboralConfigurada() {
    const h = parseInt(localStorage.getItem('horaFinDiaLaboral') || '4', 10);
    return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 4;
}

function fechaLaboralDe(fechaValor) {
    const d = parseFechaSeguro(fechaValor);
    if (!d) return null;
    if (!operaPasadaMedianoche()) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    }
    if (d.getHours() < horaFinDiaLaboralConfigurada()) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0);
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

// Fecha "de hoy" para cierre, balance y ventas del día.
// Si la opción de Administración está APAGADA, el día es el calendario (cambia a medianoche).
// Si está ENCENDIDA, el día laboral termina a la hora configurada (ej: 4 AM).
function getFechaHoyParaCierre() {
    if (!operaPasadaMedianoche()) return new Date();
    return fechaLaboralDe(new Date()) || new Date();
}

function aplicarEtiquetasHorarioOperacion() {
    const activo = operaPasadaMedianoche();
    const etFecha = document.getElementById('etiquetaFechaBalance');
    if (etFecha) etFecha.textContent = activo ? 'Fecha del día laboral' : 'Fecha';
    const etRango = document.getElementById('etiquetaRangoTodoDia');
    if (etRango) etRango.textContent = activo ? 'Todo el día laboral' : 'Todo el día';
}

function textoHorarioLaboral(fechaRef, tipo) {
    if (!operaPasadaMedianoche()) return '';
    const hora = horaFinDiaLaboralConfigurada();
    if (tipo === 'diario' && fechaRef) {
        const { inicio, fin } = inicioFinDiaLaboral(fechaRef);
        const fmt = (d) => d.toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return `Día laboral (Administración): ${fmt(inicio)} → ${fmt(fin)}. Antes de las ${hora}:00 cuenta en el día anterior.`;
    }
    return `Según Administración, el día laboral cierra a las ${String(hora).padStart(2, '0')}:00. Las ventas de madrugada cuentan en el día anterior.`;
}

function obtenerUltimoCierreAdministrativo() {
    try {
        const historial = JSON.parse(localStorage.getItem('historialCierres') || '[]');
        if (!Array.isArray(historial) || historial.length === 0) return null;
        return historial[historial.length - 1];
    } catch (e) {
        return null;
    }
}

function obtenerBaseCajaAnterior() {
    const ultimo = obtenerUltimoCierreAdministrativo();
    if (ultimo) {
        const desdeCierre = parseFloat(ultimo.montoBaseCaja);
        if (Number.isFinite(desdeCierre) && desdeCierre >= 0) return desdeCierre;
    }
    const guardada = parseFloat(localStorage.getItem('ultimaBaseCaja'));
    return Number.isFinite(guardada) && guardada > 0 ? guardada : 0;
}

function fechaCierreAdministrativo(cierre) {
    if (!cierre) return null;
    return parseFechaSeguro(cierre.fecha) || parseFechaSeguro(cierre.fechaLocal) || null;
}

function cierresAdministrativosEnPeriodo(fechaSeleccionada, tipoBalance, inicioPeriodoStr, finPeriodoStr) {
    let historial = [];
    try {
        historial = JSON.parse(localStorage.getItem('historialCierres') || '[]');
    } catch (e) {
        historial = [];
    }
    if (!Array.isArray(historial)) return [];

    return historial.filter(cierre => {
        const fecha = fechaCierreAdministrativo(cierre);
        if (!fecha) return false;
        const laboral = fechaLaboralDe(fecha) || fecha;
        if (tipoBalance === 'diario') return esMismaFechaLocal(laboral, fechaSeleccionada);
        const iso = fechaLocalISO(laboral);
        return iso >= inicioPeriodoStr && iso <= finPeriodoStr;
    }).sort((a, b) => {
        const fa = fechaCierreAdministrativo(a);
        const fb = fechaCierreAdministrativo(b);
        return (fa ? fa.getTime() : 0) - (fb ? fb.getTime() : 0);
    });
}

function baseInicialDeCierresPeriodo(cierresPeriodo) {
    if (!cierresPeriodo.length) return 0;
    const primero = cierresPeriodo[0];
    if (primero.baseCajaAnterior != null) return parseFloat(primero.baseCajaAnterior) || 0;
    try {
        const historial = JSON.parse(localStorage.getItem('historialCierres') || '[]');
        const idx = historial.findIndex(c => c && c.id === primero.id);
        if (idx > 0) return parseFloat(historial[idx - 1].montoBaseCaja) || 0;
    } catch (e) { /* ignore */ }
    return 0;
}

function formatearFechaHoraCierreBalance(cierre) {
    const fecha = fechaCierreAdministrativo(cierre);
    if (fecha && !isNaN(fecha.getTime())) {
        return fecha.toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    return `${cierre.fechaLocal || ''} ${cierre.hora || ''}`.trim() || 'Cierre';
}

function obtenerMarcaUltimoCierre() {
    const str = localStorage.getItem('ultimaHoraCierre');
    if (str) {
        const d = parseFechaSeguro(str) || new Date(str);
        if (d && !isNaN(d.getTime())) return d;
    }
    try {
        const historial = JSON.parse(localStorage.getItem('historialCierres') || '[]');
        if (Array.isArray(historial) && historial.length > 0) {
            const ultimo = historial[historial.length - 1];
            const d = parseFechaSeguro(ultimo && ultimo.fecha);
            if (d && !isNaN(d.getTime())) return d;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function inicioFinDiaLaboral(refDate) {
    const ref = parseFechaSeguro(refDate) || getFechaHoyParaCierre();
    if (operaPasadaMedianoche()) {
        const horaFin = horaFinDiaLaboralConfigurada();
        const inicio = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), horaFin, 0, 0, 0);
        const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
        return { inicio, fin };
    }
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const fin = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1, 0, 0, 0, 0);
    return { inicio, fin };
}

function fechaEnRangoCierre(fechaValor, rango = 'todoDia') {
    const fecha = parseFechaSeguro(fechaValor);
    if (!fecha) return false;
    const t = fecha.getTime();
    const { inicio, fin } = inicioFinDiaLaboral(getFechaHoyParaCierre());

    if (rango === 'ultimoCierre') {
        const marcaCierre = obtenerMarcaUltimoCierre();
        if (marcaCierre) return t > marcaCierre.getTime();
        // Sin cierre previo: incluir el día laboral anterior para no perder ventas de anoche
        return t >= (inicio.getTime() - 24 * 60 * 60 * 1000);
    }

    return t >= inicio.getTime() && t < fin.getTime();
}

// Filtra ventas para cierre: 'todoDia' = día laboral; 'ultimoCierre' = desde el último cierre (puede cruzar medianoche)
function filtrarVentasParaCierre(ventas, rango = 'todoDia') {
    const lista = Array.isArray(ventas) ? ventas : [];
    return lista.filter(v => {
        try {
            return fechaEnRangoCierre(v && v.fecha, rango);
        } catch (e) {
            return false;
        }
    });
}

function filtrarGastosParaCierre(gastos, rango = 'todoDia') {
    return filtrarVentasParaCierre(gastos, rango);
}

function obtenerRangoVentasCierre() {
    return document.querySelector('input[name="rangoVentas"]:checked')?.value || 'ultimoCierre';
}

function resumirDomiciliosDeVentas(ventas) {
    const porDomiciliario = {};
    let total = 0;
    let enEfectivoOMixto = 0;
    (ventas || []).forEach(v => {
        const valorDom = parseFloat(v.valorDomicilio) || 0;
        if (valorDom <= 0) return;
        total += valorDom;
        const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
        porDomiciliario[nombre] = (porDomiciliario[nombre] || 0) + valorDom;
        const metodo = (v.metodoPago || '').toLowerCase();
        if (metodo === 'efectivo' || metodo === 'mixto') enEfectivoOMixto += valorDom;
    });
    return { total, porDomiciliario, enEfectivoOMixto };
}

function propinaMontoDeVenta(venta) {
    if (!venta) return 0;
    if (venta.propinaMonto != null && venta.propinaMonto !== '') {
        const directo = parseFloat(venta.propinaMonto);
        if (Number.isFinite(directo) && directo > 0) return Math.round(directo);
    }
    const pct = parseFloat(venta.propina) || 0;
    if (pct <= 0) return 0;
    let subtotal = parseFloat(venta.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
        subtotal = (venta.items || []).reduce((sum, item) => {
            return sum + (parseFloat(item.precio) || 0) * (parseFloat(item.cantidad) || 0);
        }, 0);
    }
    return Math.round((subtotal * pct) / 100);
}

function resumirPropinasDeVentas(ventas) {
    let total = 0;
    let enEfectivoOMixto = 0;
    (ventas || []).forEach(v => {
        const monto = propinaMontoDeVenta(v);
        if (monto <= 0) return;
        total += monto;
        const metodo = (v.metodoPago || '').toLowerCase();
        if (metodo === 'efectivo' || metodo === 'mixto') enEfectivoOMixto += monto;
    });
    return { total, enEfectivoOMixto };
}

function textoDineroCierre(valor) {
    return `$ ${(Number(valor) || 0).toLocaleString()}`;
}

function setTextoCierre(id, valorOTexto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof valorOTexto === 'number' ? textoDineroCierre(valorOTexto) : String(valorOTexto);
}

function construirResumenCierre(rango) {
    const rangoSel = rango || obtenerRangoVentasCierre();
    const ventas = filtrarVentasParaCierre(obtenerTodasLasVentas(), rangoSel);
    const estaEnRango = (fechaValor) => fechaEnRangoCierre(fechaValor, rangoSel);
    const impacto = construirImpactoGastos(obtenerGastosCombinados(), estaEnRango);
    const totalGastos = impacto.totalGastosBalance;
    const totalGastosCaja = impacto.totalGastosCaja;
    const gastos = impacto.gastos;
    const calculos = calcularTotalesVentas(ventas);
    const domicilios = resumirDomiciliosDeVentas(ventas);
    const propinas = resumirPropinasDeVentas(ventas);
    const { inicio, fin } = inicioFinDiaLaboral(getFechaHoyParaCierre());
    const baseCajaAnterior = obtenerBaseCajaAnterior();
    return {
        rango: rangoSel,
        ventas,
        gastos,
        impactoGastos: impacto,
        totalGastos,
        totalGastosCaja,
        calculos,
        domicilios,
        propinas,
        baseCajaAnterior,
        balance: calculos.totalGeneral - totalGastos - domicilios.total - propinas.total,
        efectivoEnCaja: baseCajaAnterior + calculos.totalEfectivo - totalGastosCaja - domicilios.enEfectivoOMixto - propinas.enEfectivoOMixto,
        marcaCierre: obtenerMarcaUltimoCierre(),
        inicioLaboral: inicio,
        finLaboral: fin
    };
}

function pintarResumenCierreModal(resumen) {
    if (!resumen) return;
    const { calculos, domicilios, propinas, totalGastos, totalGastosCaja, balance, efectivoEnCaja, ventas, gastos, impactoGastos } = resumen;
    const impacto = impactoGastos || {};

    setTextoCierre('totalVentasHoy', calculos.totalGeneral);
    setTextoCierre('totalEfectivoHoy', calculos.totalEfectivo);
    setTextoCierre('totalTransferenciaHoy', calculos.totalTransferencia);
    setTextoCierre('totalTarjetaHoy', calculos.totalTarjeta);
    setTextoCierre('totalCreditoHoy', calculos.totalCredito);
    setTextoCierre('totalMixtoHoy', calculos.totalMixto);
    setTextoCierre('totalDomiciliosHoy', domicilios.total);
    setTextoCierre('totalPropinasHoy', (propinas && propinas.total) || 0);
    setTextoCierre('totalGastosHoy', impacto.totalIncurrido != null ? impacto.totalIncurrido : totalGastos);
    setTextoCierre('gastosCajaCierre', impacto.totalGastosCaja || 0);
    setTextoCierre('gastosTransferenciaCierre', impacto.totalTransferencia || 0);
    setTextoCierre('gastosCreditoCierre', impacto.totalCreditoPendiente || 0);
    setTextoCierre('gastosPagoCreditoCajaCierre', impacto.totalPagoCreditoCaja || 0);
    setTextoCierre('balanceFinal', balance);
    setTextoCierre('balanceCierreVentas', calculos.totalGeneral);
    setTextoCierre('balanceCierreGastos', totalGastos);
    setTextoCierre('balanceCierreDomicilios', domicilios.total);
    setTextoCierre('balanceCierrePropinas', (propinas && propinas.total) || 0);
    setTextoCierre('baseCajaAnteriorCierre', resumen.baseCajaAnterior || 0);
    setTextoCierre('efectivoEntradoCierre', calculos.totalEfectivo);
    setTextoCierre('gastosRestarCierre', totalGastosCaja != null ? totalGastosCaja : totalGastos);
    setTextoCierre('domiciliosEfectivoCierre', domicilios.enEfectivoOMixto);
    setTextoCierre('propinasEfectivoCierre', (propinas && propinas.enEfectivoOMixto) || 0);
    setTextoCierre('efectivoQueQuedaCierre', efectivoEnCaja);

    const notaBase = document.getElementById('notaBaseCajaAnterior');
    if (notaBase) {
        notaBase.textContent = (resumen.baseCajaAnterior || 0) > 0
            ? 'Se suma la base que se dejó en el cierre anterior.'
            : 'No hay base de un cierre anterior.';
    }

    const listaDom = document.getElementById('listaDomiciliariosCierre');
    if (listaDom) {
        const entradas = Object.entries(domicilios.porDomiciliario || {});
        listaDom.innerHTML = entradas.length === 0 ? '' :
            entradas.map(([nombre, monto]) => `${nombre}: ${textoDineroCierre(monto)}`).join('<br>');
    }

    const indicadorRango = document.getElementById('indicadorRango');
    if (indicadorRango) {
        if (resumen.rango === 'ultimoCierre' && resumen.marcaCierre) {
            indicadorRango.textContent = `Mostrando desde ${resumen.marcaCierre.toLocaleString('es-CO')} (${ventas.length} ventas)`;
        } else if (resumen.rango === 'ultimoCierre') {
            indicadorRango.textContent = `Mostrando turno abierto, incluye anoche si no hubo cierre (${ventas.length} ventas)`;
        } else {
            indicadorRango.textContent = operaPasadaMedianoche()
                ? `Mostrando el día laboral hasta las ${horaFinDiaLaboralConfigurada()}:00 (${ventas.length} ventas)`
                : `Mostrando el día laboral (${ventas.length} ventas)`;
        }
    }

    const notaHorarioCierre = document.getElementById('notaHorarioLaboralCierre');
    if (notaHorarioCierre) {
        notaHorarioCierre.textContent = textoHorarioLaboral(getFechaHoyParaCierre(), 'diario');
    }

    const aviso = document.getElementById('avisoRangoCierre');
    if (aviso) {
        aviso.textContent = '';
        if (resumen.rango === 'todoDia' && ventas.length === 0) {
            const desdeCierre = construirResumenCierre('ultimoCierre');
            if (desdeCierre.ventas.length > 0) {
                aviso.textContent = `Hoy no hay ventas de este día laboral. Hay ${desdeCierre.ventas.length} venta(s) desde el último cierre (pueden ser de anoche). Elige “Solo desde el último cierre”.`;
            }
        }
    }

    const setBloqueRapida = (idBloque, idValor, monto) => {
        const bloque = document.getElementById(idBloque);
        const valor = document.getElementById(idValor);
        if (!bloque || !valor) return;
        if ((monto || 0) > 0) {
            bloque.style.display = 'block';
            valor.textContent = textoDineroCierre(monto);
        } else {
            bloque.style.display = 'none';
        }
    };

    const sr = document.getElementById('seccionVentasRapidasCierre');
    if (sr) {
        if (calculos.totalVentasRapidas > 0) {
            sr.style.display = 'block';
            setTextoCierre('totalVentasRapidasHoy', calculos.totalVentasRapidas);
            setTextoCierre('totalEfectivoRapidasHoy', calculos.efectivoRapidas || 0);
            setTextoCierre('totalTransferenciaRapidasHoy', calculos.transferenciaRapidas || 0);
            setTextoCierre('totalTarjetaRapidasHoy', calculos.tarjetaRapidas || 0);
            setTextoCierre('totalCreditoRapidasHoy', calculos.creditoRapidas || 0);
            setTextoCierre('totalMixtoRapidasHoy', calculos.mixtoRapidas || 0);
            setBloqueRapida('bloqueRapidaDomicilioCierre', 'totalRapidaDomicilioHoy', calculos.totalRapidaDomicilio || 0);
            setBloqueRapida('bloqueRapidaMesaCierre', 'totalRapidaMesaHoy', calculos.totalRapidaMesa || 0);
            setBloqueRapida('bloqueRapidaRecogerCierre', 'totalRapidaRecogerHoy', calculos.totalRapidaRecoger || 0);
            setBloqueRapida('bloqueRapidaSinCanalCierre', 'totalRapidaSinCanalHoy', calculos.totalRapidaSinCanal || 0);
        } else {
            sr.style.display = 'none';
        }
    }

    const sm = document.getElementById('seccionVentasMesasCierre');
    if (sm) {
        if (calculos.totalVentasMesas > 0) {
            sm.style.display = 'block';
            setTextoCierre('totalVentasMesasHoy', calculos.totalVentasMesas);
            setTextoCierre('totalEfectivoMesasHoy', calculos.efectivoMesas || 0);
            setTextoCierre('totalTransferenciaMesasHoy', calculos.transferenciaMesas || 0);
            setTextoCierre('totalTarjetaMesasHoy', calculos.tarjetaMesas || 0);
            setTextoCierre('totalCreditoMesasHoy', calculos.creditoMesas || 0);
            setTextoCierre('totalMixtoMesasHoy', calculos.mixtoMesas || 0);
        } else {
            sm.style.display = 'none';
        }
    }

    const detalleGastosEl = document.getElementById('detalleGastosCierre');
    if (detalleGastosEl) {
        detalleGastosEl.innerHTML = gastos.length === 0 ? '' :
            gastos.map(g => `${descripcionGastoParaCierre(g)}: ${textoDineroCierre(parseFloat(g.monto) || 0)}`).join('<br>');
    }

    const cxpEl = document.getElementById('cuentasPorPagarCierre');
    if (cxpEl) {
        const pendientes = impacto.cuentasPorPagar || [];
        cxpEl.innerHTML = pendientes.length === 0
            ? 'No hay compras a crédito pendientes.'
            : pendientes.map(g => `${g.descripcion || 'Gasto'}${g.proveedor ? ` (${g.proveedor})` : ''}: ${textoDineroCierre(parseFloat(g.monto) || 0)}`).join('<br>');
    }

    const ultimoDom = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
    const ultimoRec = parseInt(localStorage.getItem('contadorRecoger')) || 0;
    setTextoCierre('ultimoDomCierre', 'D' + ultimoDom);
    setTextoCierre('ultimoRecCierre', 'R' + ultimoRec);

    const creditosHoy = ventas.filter(v => {
        const metodo = (v.metodoPago || '').toLowerCase();
        return metodo === 'credito' || metodo === 'crédito';
    });
    const detallesCreditosEl = document.getElementById('detallesCreditos');
    if (detallesCreditosEl) {
        detallesCreditosEl.innerHTML = creditosHoy.length === 0
            ? 'No hay créditos pendientes en este período.'
            : creditosHoy.map(c => `${c.cliente || 'Cliente'}: ${textoDineroCierre(parseFloat(c.total) || 0)}`).join('<br>');
    }
}

// Normaliza el historial de ventas: asegura fecha ISO, método/tipo coherentes
function normalizarHistorialVentas() {
    try {
        let historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        if (!Array.isArray(historial)) return;

        const normalizado = historial.map((venta) => {
            const copia = { ...venta };

            // Fecha: si no es ISO, convertir a ISO local
            if (typeof copia.fecha === 'string' || copia.fecha instanceof Date) {
                const d = parseFechaSeguro(copia.fecha);
                if (d) {
                    copia.fecha = d.toISOString();
                } else {
                    // Mantener fecha original si no podemos parsear; NO cambiarla a hoy
                    copia.fechaOriginal = copia.fecha;
                }
            }

            // Método de pago a minúsculas
            if (copia.metodoPago && typeof copia.metodoPago === 'string') {
                copia.metodoPago = copia.metodoPago.toLowerCase().trim();
                if (copia.metodoPago === 'combinado') copia.metodoPago = 'mixto';
            }

            // Tipo de venta estandarizado - NO modificar si ya existe
            if (!copia.tipo) {
                copia.tipo = copia.mesa && copia.mesa !== 'VENTA DIRECTA' ? 'mesa' : 'venta_rapida';
            }
            // Si ya tiene tipo, mantenerlo tal como está

            // Totales numéricos seguros
            copia.total = parseFloat(copia.total) || 0;

            return copia;
        });

        localStorage.setItem('historialVentas', JSON.stringify(normalizado));
    } catch (e) {
        console.error('Error normalizando historial de ventas:', e);
    }
}

// Función para limpiar duplicados en localStorage
function limpiarDuplicadosVentas() {
    try {
        console.log('=== LIMPIANDO DUPLICADOS DE VENTAS ===');
        
        const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
        const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        
        console.log(`Ventas antes: ${ventas.length}`);
        console.log(`Historial antes: ${historialVentas.length}`);
        
        // Crear un mapa de ventas únicas por ID
        const ventasUnicas = new Map();
        
        // Agregar ventas del historial (prioridad)
        historialVentas.forEach(venta => {
            if (venta.id) {
                ventasUnicas.set(venta.id, venta);
            }
        });
        
        // Agregar ventas de ventas (solo si no existen en historial)
        ventas.forEach(venta => {
            if (venta.id && !ventasUnicas.has(venta.id)) {
                ventasUnicas.set(venta.id, venta);
            }
        });
        
        const ventasLimpias = Array.from(ventasUnicas.values());
        
        // Guardar solo en historialVentas
        localStorage.setItem('historialVentas', JSON.stringify(ventasLimpias));
        
        // Limpiar ventas duplicadas
        localStorage.setItem('ventas', '[]');
        
        console.log(`Ventas después de limpiar: ${ventasLimpias.length}`);
        console.log('✅ Duplicados eliminados exitosamente');
        
        return ventasLimpias;
    } catch (error) {
        console.error('Error al limpiar duplicados:', error);
        return [];
    }
}

// Función para limpiar completamente el localStorage de ventas
function limpiarCompletamenteVentas() {
    try {
        console.log('=== LIMPIEZA COMPLETA DE VENTAS ===');
        
        // Obtener todas las ventas
        const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
        const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
        
        console.log(`Ventas totales antes: ${ventas.length + historialVentas.length}`);
        
        // Crear un mapa de ventas únicas por ID
        const ventasUnicas = new Map();
        
        // Agregar todas las ventas (historial + ventas)
        [...historialVentas, ...ventas].forEach(venta => {
            if (venta.id) {
                ventasUnicas.set(venta.id, venta);
            }
        });
        
        const ventasLimpias = Array.from(ventasUnicas.values());
        
        // Guardar solo en historialVentas
        localStorage.setItem('historialVentas', JSON.stringify(ventasLimpias));
        
        // Limpiar ventas duplicadas
        localStorage.setItem('ventas', '[]');
        
        console.log(`Ventas únicas después: ${ventasLimpias.length}`);
        console.log('✅ Limpieza completa exitosa');
        
        return ventasLimpias;
    } catch (error) {
        console.error('Error en limpieza completa:', error);
        return [];
    }
}

// Función para reiniciar completamente el sistema después del cierre
function reiniciarSistemaCompleto() {
    try {
        console.log('=== REINICIANDO SISTEMA COMPLETO ===');
        // Marcar hora de cierre para que los siguientes cálculos ignoren ventas previas
        localStorage.setItem('ultimaHoraCierre', new Date().toISOString());
        
        // 1. Limpiar ventas del día actual
        console.log('🧹 Limpiando ventas del día...');
        localStorage.setItem('ventas', '[]');
        
        // Importante: NO limpiar el historial de ventas del día actual.
        // Antes se filtraban y eliminaban las ventas del día de hoy de "historialVentas",
        // lo que hacía que luego el Balance (por fecha) y "Ventas por producto"
        // se quedaran sin información después de un cierre administrativo.
        //
        // Ahora se conserva todo el historial para que:
        // - El balance pueda consultar cualquier día por fecha.
        // - La sección "Ventas por producto" siga funcionando incluso después de cerrar.
        console.log('📊 Manteniendo historial de ventas para reportes por fecha...');
        const hoy = getFechaHoyParaCierre();
        
        // 2. Limpiar domicilios del día actual (comparar por fecha LOCAL, no UTC)
        console.log('🚚 Limpiando domicilios del día...');
        const domicilios = JSON.parse(localStorage.getItem('domicilios') || '[]');
        const hoyStr = fechaLocalISO(hoy);
        const domiciliosFiltrados = domicilios.filter(domicilio => {
            try {
                const fechaDomicilio = fechaLocalISO(domicilio.fecha);
                return fechaDomicilio !== hoyStr;
            } catch (e) {
                return true; // Mantener si hay error en fecha
            }
        });
        localStorage.setItem('domicilios', JSON.stringify(domiciliosFiltrados));
        
        // 3. Limpiar gastos del día actual (fecha LOCAL; también limpia historial operativo del día)
        console.log('💰 Limpiando gastos del día...');
        const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
        const gastosFiltrados = gastos.filter(gasto => {
            if (typeof esCreditoPendiente === 'function' && esCreditoPendiente(gasto)) {
                return true;
            }
            try {
                const fechaGasto = fechaLocalISO(gasto.fecha);
                if (fechaGasto === hoyStr) return false;
                if (gasto.fechaPago && fechaLocalISO(gasto.fechaPago) === hoyStr) return false;
                return true;
            } catch (e) {
                return true; // Mantener si hay error en fecha
            }
        });
        localStorage.setItem('gastos', JSON.stringify(gastosFiltrados));

        // historialGastos se conserva para reportes/balance por fecha,
        // pero los del día cerrado ya no deben contarse en el turno operativo:
        // no se borran del historial; el corte lo marca ultimaHoraCierre.
        
        // 4. Reiniciar estado de mesas
        console.log('🪑 Reiniciando estado de mesas...');
        localStorage.setItem('mesasActivas', '[]');
        localStorage.setItem('estadoMesas', '[]');
        try { window._operacionPersistiendo = true; } catch (e) { /* ignore */ }
        
        // 5. Reiniciar órdenes de cocina
        console.log('👨‍🍳 Reiniciando órdenes de cocina...');
        localStorage.setItem('ordenesCocina', '[]');
        localStorage.setItem('historialCocina', '[]');
        localStorage.setItem('pedidosCocinaListos', '[]');
        
        // 6. Limpiar órdenes pendientes
        console.log('📋 Limpiando órdenes pendientes...');
        localStorage.setItem('ordenesPendientes', '[]');
        
        // 7. Reiniciar variables globales
        console.log('🔄 Reiniciando variables globales...');
        if (typeof mesasActivas !== 'undefined') {
            mesasActivas.clear();
        }
        if (typeof ordenesCocina !== 'undefined') {
            ordenesCocina.clear();
        }
        if (typeof historialCocina !== 'undefined') {
            historialCocina = [];
        }
        reiniciarContadoresDomRec();
        
        console.log('✅ Sistema reiniciado completamente');
        console.log('📊 Estado después del reinicio:');
        console.log(`   - Ventas del día: ${JSON.parse(localStorage.getItem('ventas') || '[]').length}`);
        console.log(`   - Historial de ventas: ${JSON.parse(localStorage.getItem('historialVentas') || '[]').length}`);
        console.log(`   - Domicilios del día: ${domiciliosFiltrados.length}`);
        console.log(`   - Gastos del día: ${gastosFiltrados.length}`);
        console.log(`   - Mesas activas: ${JSON.parse(localStorage.getItem('mesasActivas') || '[]').length}`);
        console.log(`   - Órdenes de cocina: ${JSON.parse(localStorage.getItem('ordenesCocina') || '[]').length}`);
        if (typeof persistirConfigCajaNube === 'function') persistirConfigCajaNube();
        
        return true;
    } catch (error) {
        console.error('Error al reiniciar sistema:', error);
        return false;
    }
}

// Función para limpiar la interfaz de ventas después del cierre
function limpiarInterfazVentas() {
    try {
        console.log('🧹 Limpiando interfaz de ventas...');
        
        // Limpiar carrito de venta rápida
        if (typeof carritoVentaRapida !== 'undefined') {
            carritoVentaRapida.length = 0;
        }
        
        // Limpiar totales de venta rápida
        const totalElement = document.getElementById('totalVentaRapida');
        if (totalElement) {
            totalElement.textContent = '$ 0';
        }
        
        // Limpiar lista de productos en venta rápida
        const listaProductos = document.getElementById('listaProductosVentaRapida');
        if (listaProductos) {
            listaProductos.innerHTML = '';
        }
        
        // Limpiar campos de pago
        const montoRecibido = document.getElementById('montoRecibido');
        if (montoRecibido) {
            montoRecibido.value = '';
        }
        
        const cambio = document.getElementById('cambio');
        if (cambio) {
            cambio.textContent = '$ 0';
        }
        
        // Limpiar selección de método de pago
        const metodoPago = document.getElementById('metodoPago');
        if (metodoPago) {
            metodoPago.value = 'efectivo';
        }
        
        // Limpiar campos de transferencia
        const numeroTransferencia = document.getElementById('numeroTransferencia');
        if (numeroTransferencia) {
            numeroTransferencia.value = '';
        }
        
        // Limpiar campos de tarjeta
        const numeroTarjeta = document.getElementById('numeroTarjeta');
        if (numeroTarjeta) {
            numeroTarjeta.value = '';
        }
        
        // Limpiar campos de crédito
        const nombreCliente = document.getElementById('nombreCliente');
        if (nombreCliente) {
            nombreCliente.value = '';
        }
        
        const telefonoCliente = document.getElementById('telefonoCliente');
        if (telefonoCliente) {
            telefonoCliente.value = '';
        }
        
        // Limpiar campos de domicilio
        const direccionDomicilio = document.getElementById('direccionDomicilio');
        if (direccionDomicilio) {
            direccionDomicilio.value = '';
        }
        
        const horaRecoger = document.getElementById('horaRecoger');
        if (horaRecoger) {
            horaRecoger.value = '';
        }
        
        // Limpiar campos de cliente
        const nombreClienteGeneral = document.getElementById('nombreClienteGeneral');
        if (nombreClienteGeneral) {
            nombreClienteGeneral.value = '';
        }
        
        const telefonoClienteGeneral = document.getElementById('telefonoClienteGeneral');
        if (telefonoClienteGeneral) {
            telefonoClienteGeneral.value = '';
        }
        
        // Limpiar campos de propina y descuento
        const propina = document.getElementById('propina');
        if (propina) {
            propina.value = '0';
        }
        
        const descuento = document.getElementById('descuento');
        if (descuento) {
            descuento.value = '0';
        }
        
        // Limpiar campos de domicilio
        const nombreDomiciliario = document.getElementById('nombreDomiciliario');
        if (nombreDomiciliario) {
            nombreDomiciliario.value = '';
        }
        const valorDomicilio = document.getElementById('valorDomicilio');
        if (valorDomicilio) {
            valorDomicilio.value = '0';
        }
        
        // Ocultar campos específicos de pago
        const camposTransferencia = document.getElementById('camposTransferencia');
        if (camposTransferencia) {
            camposTransferencia.style.display = 'none';
        }
        
        const camposTarjeta = document.getElementById('camposTarjeta');
        if (camposTarjeta) {
            camposTarjeta.style.display = 'none';
        }
        
        const camposCredito = document.getElementById('camposCredito');
        if (camposCredito) {
            camposCredito.style.display = 'none';
        }
        
        const camposDomicilio = document.getElementById('camposDomicilio');
        if (camposDomicilio) {
            camposDomicilio.style.display = 'none';
        }
        
        console.log('✅ Interfaz de ventas limpiada');
        
    } catch (error) {
        console.error('Error al limpiar interfaz de ventas:', error);
    }
}

// Función para actualizar solo los datos del modal de cierre sin recrearlo
function actualizarDatosCierreModal() {
    try {
        const resumen = construirResumenCierre();
        console.log(`🔄 Actualizando cierre: ${resumen.ventas.length} ventas (rango: ${resumen.rango})`);
        pintarResumenCierreModal(resumen);
    } catch (error) {
        console.error('Error al actualizar datos del modal:', error);
    }
}

// Función para limpiar overlays de Bootstrap que puedan quedar activos
function limpiarOverlaysBootstrap() {
    try {
        console.log('🧹 Limpiando overlays de Bootstrap...');
        
        // Remover todos los backdrops de modales
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => {
            backdrop.remove();
            console.log('✅ Backdrop removido');
        });
        
        // Remover clases del body que causan el oscurecimiento
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Remover cualquier overlay de Bootstrap
        const overlays = document.querySelectorAll('.modal, .fade, .show');
        overlays.forEach(overlay => {
            if (overlay.classList.contains('modal-backdrop') || 
                overlay.classList.contains('modal')) {
                overlay.classList.remove('show', 'fade');
                overlay.style.display = 'none';
            }
        });
        
        // Limpiar instancias de modales de Bootstrap
        const modales = document.querySelectorAll('[data-bs-toggle="modal"]');
        modales.forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.dispose();
            }
        });
        
        // Forzar reflow del DOM
        document.body.offsetHeight;
        
        console.log('✅ Overlays de Bootstrap limpiados');
        
    } catch (error) {
        console.error('Error al limpiar overlays de Bootstrap:', error);
    }
}

// Función de debug para verificar el estado del sistema después del cierre
window.debugEstadoSistema = function() {
    console.log('=== DEBUG ESTADO DEL SISTEMA ===');
    
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const domicilios = JSON.parse(localStorage.getItem('domicilios') || '[]');
    const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
    const mesasActivas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
    const ultimaHoraCierre = localStorage.getItem('ultimaHoraCierre');
    
    console.log('📊 Estado actual:');
    console.log(`   - Ventas activas: ${ventas.length}`);
    console.log(`   - Historial de ventas: ${historialVentas.length}`);
    console.log(`   - Domicilios: ${domicilios.length}`);
    console.log(`   - Gastos: ${gastos.length}`);
    console.log(`   - Mesas activas: ${mesasActivas.length}`);
    console.log(`   - Última hora de cierre: ${ultimaHoraCierre}`);
    
    // Verificar ventas de hoy
    const hoy = new Date();
    const ventasHoy = historialVentas.filter(v => {
        try {
            const fechaVenta = new Date(v.fecha);
            return esMismaFechaLocal(fechaVenta, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`   - Ventas de hoy en historial: ${ventasHoy.length}`);
    
    if (ventasHoy.length > 0) {
        console.log('⚠️ PROBLEMA: Aún hay ventas de hoy en el historial');
        console.log('Ventas encontradas:', ventasHoy.map(v => ({
            id: v.id,
            fecha: v.fecha,
            total: v.total,
            tipo: v.tipo
        })));
    } else {
        console.log('✅ CORRECTO: No hay ventas de hoy en el historial');
    }
}

// Función de debug para probar el recibo de venta rápida
window.debugReciboVentaRapida = function() {
    console.log('🔍 DEBUG RECIBO VENTA RÁPIDA - PRUEBA');
    
    // Crear una venta de prueba
    const ventaPrueba = {
        id: Date.now(),
        mesa: 'VENTA DIRECTA',
        items: [
            {
                id: 1,
                nombre: 'Empanada de carne',
                precio: 2500,
                cantidad: 3,
                estado: 'listo'
            },
            {
                id: 2,
                nombre: 'Bebida',
                precio: 2000,
                cantidad: 2,
                estado: 'listo'
            }
        ],
        subtotal: 11500,
        propina: 0,
        descuento: 0,
        valorDomicilio: 0,
        total: 11500,
        metodoPago: 'efectivo',
        montoRecibido: 15000,
        cambio: 3500,
        fecha: new Date().toISOString(),
        tipo: 'venta_rapida',
        estado: 'completada'
    };
    
    console.log('Venta de prueba creada:', ventaPrueba);
    
    // Mostrar el recibo
    mostrarReciboVentaRapida(ventaPrueba);
}

// Función de debug para probar el flujo completo de venta rápida
window.debugFlujoVentaRapida = function() {
    console.log('🔍 DEBUG FLUJO COMPLETO VENTA RÁPIDA');
    
    // 1. Crear pedido inicial
    const pedido = {
        items: [],
        cliente: null,
        telefono: null,
        direccion: null,
        horaRecoger: null,
        tipo: 'venta_rapida'
    };
    
    console.log('1. Pedido inicial creado:', pedido);
    
    // 2. Simular agregar productos
    pedido.items.push({
        id: 1,
        nombre: 'Empanada de carne',
        precio: 2500,
        cantidad: 2,
        estado: 'listo'
    });
    
    pedido.items.push({
        id: 2,
        nombre: 'Bebida',
        precio: 2000,
        cantidad: 1,
        estado: 'listo'
    });
    
    console.log('2. Productos agregados:', pedido);
    
    // 3. Calcular total
    const total = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    console.log('3. Total calculado:', total);
    
    // 4. Simular procesar venta rápida
    procesarVentaRapida(pedido, total, 'efectivo', total);
    
    console.log('4. Venta procesada');
}

// Función de debug específica para el problema de ventas que se sobrescriben
window.debugVentasConflictivas = function() {
    console.log('=== DEBUG VENTAS CONFLICTIVAS ===');
    
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const hoy = new Date();
    
    // Filtrar ventas de hoy
    const ventasHoy = historialVentas.filter(v => {
        try {
            const fechaVenta = new Date(v.fecha);
            return esMismaFechaLocal(fechaVenta, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`📊 Ventas de hoy encontradas: ${ventasHoy.length}`);
    
    // Mostrar todas las ventas de hoy con detalles
    ventasHoy.forEach((venta, index) => {
        console.log(`Venta ${index + 1}:`, {
            id: venta.id,
            fecha: venta.fecha,
            mesa: venta.mesa,
            tipo: venta.tipo,
            total: venta.total,
            metodoPago: venta.metodoPago,
            items: venta.items?.length || 0
        });
    });
    
    // Verificar si hay IDs duplicados
    const ids = ventasHoy.map(v => v.id);
    const idsUnicos = [...new Set(ids)];
    
    if (ids.length !== idsUnicos.length) {
        console.log('⚠️ PROBLEMA: Hay IDs duplicados');
        const duplicados = ids.filter((id, index) => ids.indexOf(id) !== index);
        console.log('IDs duplicados:', duplicados);
    } else {
        console.log('✅ IDs únicos correctos');
    }
    
    // Verificar si hay ventas rápidas
    const ventasRapidas = ventasHoy.filter(v => v.tipo === 'venta_rapida' || v.mesa === 'VENTA DIRECTA');
    console.log(`⚡ Ventas rápidas: ${ventasRapidas.length}`);
    
    // Verificar si hay ventas de mesa
    const ventasMesa = ventasHoy.filter(v => v.tipo === 'mesa' && v.mesa !== 'VENTA DIRECTA');
    console.log(`🪑 Ventas de mesa: ${ventasMesa.length}`);
    
    // Calcular totales
    const totalEfectivo = ventasHoy
        .filter(v => v.metodoPago === 'efectivo')
        .reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    
    console.log(`💰 Total efectivo calculado: $${totalEfectivo.toLocaleString()}`);
    
    return {
        ventasHoy,
        ventasRapidas,
        ventasMesa,
        totalEfectivo,
        idsDuplicados: ids.length !== idsUnicos.length
    };
}

// Función de depuración para verificar ventas rápidas
function debugVentasRapidas() {
    console.log('=== DEBUG VENTAS RÁPIDAS ===');
    
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    
    console.log('Ventas activas:', ventas.length);
    console.log('Historial ventas:', historialVentas.length);
    
    const ventasRapidas = historialVentas.filter(v => v.tipo === 'venta_rapida');
    console.log('Ventas rápidas en historial:', ventasRapidas.length);
    console.log('Ventas rápidas:', ventasRapidas);
    
    const hoy = new Date();
    const ventasRapidasHoy = ventasRapidas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log('Ventas rápidas de hoy:', ventasRapidasHoy.length);
    console.log('Ventas rápidas de hoy:', ventasRapidasHoy);
    
    return {
        ventas,
        historialVentas,
        ventasRapidas,
        ventasRapidasHoy
    };
}


// Variables globales para cotizaciones
window.cotizaciones = window.cotizaciones || [];
let modoProductoManual = false;
let productosFiltrados = [];

// Variable global para la ventana de impresión
let ventanaImpresion = null;

let cotizacionEditandoId = null;

// Variables globales para recordatorios de tareas
let recordatorios = [];
let recordatoriosActivos = [];
let notificacionesActivas = [];

let accionPendiente = null;
let usuarioActual = null;
window.usuarioActual = usuarioActual;

function moduloPinDeAccion(accion) {
  if (accion === 'historial-admin') return 'cierre-administrativo';
  return accion;
}

async function pinModuloLocal(modulo, pin) {
  try {
    if (window.ToySoftFirebase && typeof ToySoftFirebase.pinCorrecto === 'function') {
      return await ToySoftFirebase.pinCorrecto(modulo, pin);
    }
  } catch (error) {
    console.warn('No se pudo validar el PIN', error);
  }
  return false;
}

// Utilidad: obtener fecha local en formato ISO (YYYY-MM-DD) evitando desfase por zona horaria
function obtenerFechaLocalISO() {
    const hoy = new Date();
    // Ajustar la hora restando el desfase de zona horaria para obtener la fecha local correcta
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    return hoy.toISOString().split('T')[0];
}


// Función para guardar productos en localStorage y Firestore
function guardarProductos() {
  localStorage.setItem('productos', JSON.stringify(productos));
  if (window.ToySoftFirebase && ToySoftFirebase.estaListo()) {
    ToySoftFirebase.persistirCatalogo(categorias, productos).catch(function (error) {
      console.warn('Catálogo no se guardó en la nube', error);
    });
  }
}

// Función para guardar clientes en localStorage
function guardarClientes() {
  localStorage.setItem('clientes', JSON.stringify(clientes));
  if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
    ToySoftFirebase.persistirDatosDebounced();
  }
}

function recargarClientesDesdeStorage() {
  try {
    const guardados = JSON.parse(localStorage.getItem('clientes') || '[]');
    clientes = Array.isArray(guardados) ? guardados : [];
  } catch (error) {
    console.error('Error al recargar clientes:', error);
    if (!Array.isArray(clientes)) clientes = [];
  }
  window.clientes = clientes;
  return clientes;
}

function escaparHtmlTexto(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizarTextoBusqueda(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizarTelefono(texto) {
  return String(texto || '').replace(/\D/g, '');
}

function nombreCompletoCliente(cliente) {
  if (!cliente) return 'Sin nombre';
  const partes = [cliente.nombre, cliente.apellido].filter(parte => {
    const valor = String(parte || '').trim();
    return valor && valor.toLowerCase() !== 'no proporcionado';
  });
  return partes.join(' ').trim() || String(cliente.nombre || '').trim() || 'Sin nombre';
}

function clienteCoincideBusqueda(cliente, busqueda) {
  const query = normalizarTextoBusqueda(busqueda);
  if (!query) return false;
  const texto = normalizarTextoBusqueda([
    cliente.nombre,
    cliente.apellido,
    cliente.telefono,
    cliente.documento,
    cliente.direccion,
    cliente.correo
  ].filter(Boolean).join(' '));
  const palabras = query.split(/\s+/).filter(Boolean);
  const coincideTexto = palabras.every(palabra => texto.includes(palabra));
  const telQuery = normalizarTelefono(busqueda);
  const telCliente = normalizarTelefono(cliente.telefono || cliente.documento);
  const coincideTelefono = telQuery.length >= 4 && telCliente.includes(telQuery);
  return coincideTexto || coincideTelefono;
}

function encontrarClienteDuplicado(nombre, telefono) {
  const fuente = recargarClientesDesdeStorage();
  const tel = normalizarTelefono(telefono);
  if (tel.length >= 7) {
    return fuente.find(cliente => {
      const telCliente = normalizarTelefono(cliente.telefono);
      const docCliente = normalizarTelefono(cliente.documento);
      return (telCliente && telCliente === tel) || (docCliente && docCliente === tel);
    }) || null;
  }
  const nom = normalizarTextoBusqueda(nombre);
  if (nom.length >= 4) {
    return fuente.find(cliente => normalizarTextoBusqueda(nombreCompletoCliente(cliente)) === nom) || null;
  }
  return null;
}

function filtrarClientesParaLista(busqueda) {
  const fuente = recargarClientesDesdeStorage();
  const query = String(busqueda || '').trim();
  if (query) {
    return fuente.filter(cliente => clienteCoincideBusqueda(cliente, query));
  }
  return [...fuente].slice(-12).reverse();
}

function notificarOperacionNube(inmediato) {
  if (!window.ToySoftFirebase) return;
  if (inmediato) {
    if (typeof ToySoftFirebase.persistirOperacionInmediato === 'function') {
      ToySoftFirebase.persistirOperacionInmediato();
    }
  } else if (typeof ToySoftFirebase.persistirOperacionDebounced === 'function') {
    ToySoftFirebase.persistirOperacionDebounced();
  }
}

// Función para guardar contadores en localStorage
function guardarContadores() {
  localStorage.setItem('contadorDomicilios', String(contadorDomicilios || 0));
  localStorage.setItem('contadorRecoger', String(contadorRecoger || 0));
  if (ultimaFechaContadores) {
    localStorage.setItem('ultimaFechaContadores', ultimaFechaContadores);
  }
  notificarOperacionNube();
}

// Reinicia DOM/REC a 0 en memoria y localStorage (próximo pedido = D1 / R1)
function reiniciarContadoresDomRec() {
  contadorDomicilios = 0;
  contadorRecoger = 0;
  ultimaFechaContadores = new Date().toLocaleDateString();
  localStorage.setItem('contadorDomicilios', '0');
  localStorage.setItem('contadorRecoger', '0');
  localStorage.setItem('contadoresReinicioEn', new Date().toISOString());
  localStorage.setItem('ultimaFechaContadores', ultimaFechaContadores);
  // Limpiar clave antigua errónea (admon usaba "contadorDelivery")
  localStorage.removeItem('contadorDelivery');
  localStorage.removeItem('sesionesCobradasHoy');
  if (window.ToySoftFirebase && typeof ToySoftFirebase.limpiarSesionesCobradas === 'function') {
    ToySoftFirebase.limpiarSesionesCobradas();
  }
  notificarOperacionNube(true);
  console.log('🔁 Contadores DOM/REC reiniciados → próximo D1 / R1');
}

// Función para guardar historial de ventas
function registrarVentaUnificada(factura) {
  if (!factura) return;
  const sesionId = factura.sesionId ? String(factura.sesionId) : '';
  if (sesionId) marcarSesionPedidoCobrada(sesionId);

  if (typeof historialVentas !== 'undefined' && Array.isArray(historialVentas) && sesionId) {
    const ya = historialVentas.some(function (v) { return v && String(v.sesionId) === sesionId; });
    if (ya) return;
  }

  if (typeof historialVentas !== 'undefined' && Array.isArray(historialVentas)) {
    const id = String(factura.id);
    const idx = historialVentas.findIndex(function (v) { return v && String(v.id) === id; });
    if (idx >= 0) historialVentas[idx] = factura;
    else historialVentas.push(factura);
  }

  if (window.ToySoftFirebase && typeof ToySoftFirebase.guardarVenta === 'function') {
    ToySoftFirebase.guardarVenta(factura).then(function (guardada) {
      if (typeof historialVentas !== 'undefined' && Array.isArray(historialVentas)) {
        const id = String(guardada.id);
        const idx = historialVentas.findIndex(function (v) { return String(v.id) === id; });
        if (idx >= 0) historialVentas[idx] = guardada;
        else historialVentas.push(guardada);
      }
    }).catch(function (error) {
      console.warn('Venta no se guardó en la nube', error);
    });
    return;
  }
  let historialActual = JSON.parse(localStorage.getItem('historialVentas') || '[]');
  if (!Array.isArray(historialActual)) historialActual = [];
  if (sesionId && historialActual.some(function (v) { return v && String(v.sesionId) === sesionId; })) {
    return;
  }
  historialActual.push(factura);
  localStorage.setItem('historialVentas', JSON.stringify(historialActual));
}

function aplicarVentasEnPOS(lista) {
  if (window._ventasPersistiendo) return;
  historialVentas = Array.isArray(lista) ? lista : [];
  window.ventas = historialVentas;
  if (typeof refrescarBalanceSiAbierto === 'function') refrescarBalanceSiAbierto();
}

async function cargarVentasDesdeNube() {
  if (!window.ToySoftFirebase) return;
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) return;
    const lista = await ToySoftFirebase.sincronizarVentas();
    aplicarVentasEnPOS(lista);
    ToySoftFirebase.escucharVentas(aplicarVentasEnPOS);
  } catch (error) {
    console.warn('No se pudieron cargar las ventas de Firebase', error);
  }
}

async function cargarFinanzasDesdeNube() {
  if (!window.ToySoftFirebase) return;
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) return;
    await ToySoftFirebase.sincronizarFinanzas();
    ToySoftFirebase.escucharFinanzas({
      gastos: refrescarBalanceSiAbierto,
      cierres: refrescarBalanceSiAbierto,
      configCaja: refrescarBalanceSiAbierto
    });
    if (typeof refrescarBalanceSiAbierto === 'function') refrescarBalanceSiAbierto();
  } catch (error) {
    console.warn('No se pudieron cargar gastos y cierres de Firebase', error);
  }
}

function aplicarRestoEnMemoria(datos) {
  const d = datos || {};
  if (typeof clientes !== 'undefined') {
    clientes = Array.isArray(d.clientes) ? d.clientes : [];
    window.clientes = clientes;
  }
  if (typeof recordatorios !== 'undefined') {
    recordatorios = Array.isArray(d.recordatorios) ? d.recordatorios : [];
    try {
      recordatoriosActivos = JSON.parse(localStorage.getItem('recordatoriosActivos') || '[]');
    } catch (e) {
      recordatoriosActivos = [];
    }
  }
  if (typeof cotizaciones !== 'undefined') {
    cotizaciones = Array.isArray(d.cotizaciones) ? d.cotizaciones : [];
  }
  if (typeof cargarClientes === 'function' && document.querySelector('#tablaClientes, #listaClientes, #clienteSelect')) {
    try { cargarClientes(); } catch (e) {}
  }
  if (typeof cargarInterfazRecordatorios === 'function') {
    try { cargarInterfazRecordatorios(); } catch (e) {}
  }
}

async function cargarRestoDesdeNube() {
  if (!window.ToySoftFirebase) return;
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) return;
    const resultado = await ToySoftFirebase.sincronizarResto();
    aplicarRestoEnMemoria(resultado && resultado.datos);
    ToySoftFirebase.escucharDatos(aplicarRestoEnMemoria);
    ToySoftFirebase.escucharExtras();
  } catch (error) {
    console.warn('No se pudieron cargar clientes, recordatorios o cotizaciones de Firebase', error);
  }
}

// Función para guardar historial de cocina
function guardarHistorialCocina() {
  // Guardar todo el historial de cocina
  localStorage.setItem('historialCocina', JSON.stringify(historialCocina));
  notificarOperacionNube();
}

// ===== SISTEMA DE PANTALLA DE COCINA =====

// Variable global para la ventana de cocina
let ventanaCocina = null;
// También disponible en window para acceso desde otras páginas
window.ventanaCocina = null;

// Función para obtener pedidos pendientes en cocina
function obtenerPedidosPendientesCocina() {
  try {
    const historialCocina = JSON.parse(localStorage.getItem('historialCocina') || '[]');
    const pedidosListosIds = obtenerIdsPedidosListos(); // Usar función auxiliar para compatibilidad
    
    // Obtener fecha de hoy para filtrar
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Filtrar solo los pedidos que:
    // 1. No están marcados como listos
    // 2. Son del día actual
    const pendientes = historialCocina.filter(pedido => {
      // Verificar que no esté marcado como listo
      if (pedidosListosIds.includes(pedido.id)) {
        return false;
      }
      
      // Verificar que sea del día actual
      try {
        let fechaPedido = null;
        
        // Intentar parsear la fecha del pedido
        // Priorizar fecha ISO si existe, sino usar fecha (puede ser formato local)
        const fechaAUsar = pedido.fecha || pedido.fechaMostrar;
        
        if (fechaAUsar) {
          if (typeof fechaAUsar === 'string') {
            // Intentar parsear como fecha ISO primero (más confiable)
            const fechaISO = new Date(fechaAUsar);
            if (!isNaN(fechaISO.getTime())) {
              fechaPedido = fechaISO;
            } else {
              // Si no es ISO, intentar parsear como formato local
              fechaPedido = parseFechaSeguro(fechaAUsar);
            }
          } else if (fechaAUsar instanceof Date) {
            fechaPedido = fechaAUsar;
          }
        }
        
        if (!fechaPedido) {
          console.warn('No se pudo parsear fecha del pedido:', pedido);
          return false; // Si no se puede parsear la fecha, no mostrar
        }
        
        // Comparar solo año, mes y día
        const fechaPedidoNormalizada = new Date(fechaPedido);
        fechaPedidoNormalizada.setHours(0, 0, 0, 0);
        
        return esMismaFechaLocal(fechaPedidoNormalizada, hoy);
      } catch (e) {
        console.error('Error al parsear fecha del pedido:', e, pedido);
        return false; // Si hay error al parsear, no mostrar
      }
    });

    // Ordenar por fecha (más antiguos primero)
    pendientes.sort((a, b) => {
      const fechaA = new Date(a.fecha || 0);
      const fechaB = new Date(b.fecha || 0);
      return fechaA - fechaB;
    });

    return pendientes;
  } catch (error) {
    console.error('Error al obtener pedidos pendientes:', error);
    return [];
  }
}

// Función para marcar pedido como listo
function marcarPedidoListo(pedidoId) {
  try {
    let pedidosListos = JSON.parse(localStorage.getItem('pedidosCocinaListos') || '[]');
    
    // Migrar estructura antigua (array de IDs) a nueva (array de objetos)
    if (pedidosListos.length > 0 && typeof pedidosListos[0] === 'number') {
      // Es la estructura antigua, convertir a nueva
      pedidosListos = pedidosListos.map(id => ({
        id: id,
        fechaHoraListo: new Date().toISOString(),
        fechaHoraListoMostrar: new Date().toLocaleString()
      }));
    }
    
    // Verificar si el pedido ya está marcado como listo
    const yaMarcado = pedidosListos.some(p => (typeof p === 'object' ? p.id : p) === pedidoId);
    
    if (!yaMarcado) {
      // Agregar el pedido con la fecha/hora
      const fechaHoraListo = new Date().toISOString();
      const fechaHoraListoMostrar = new Date().toLocaleString();
      
      pedidosListos.push({
        id: pedidoId,
        fechaHoraListo: fechaHoraListo,
        fechaHoraListoMostrar: fechaHoraListoMostrar
      });
      
      localStorage.setItem('pedidosCocinaListos', JSON.stringify(pedidosListos));
      notificarOperacionNube();
      console.log('✅ Pedido marcado como listo. ID:', pedidoId, 'Hora:', fechaHoraListoMostrar);
      console.log('✅ Total pedidos listos:', pedidosListos.length);
      
      // Disparar evento personalizado para notificar a otras ventanas
      window.dispatchEvent(new CustomEvent('pedidoMarcadoListo', { detail: { pedidoId } }));
      
      // Actualizar panel flotante si existe
      actualizarPanelCocina();
      
      // Mostrar confirmación
      mostrarConfirmacionPedidoListo(pedidoId);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error al marcar pedido como listo:', error);
    return false;
  }
}

// Función auxiliar para obtener IDs de pedidos listos (compatibilidad)
function obtenerIdsPedidosListos() {
  try {
    const pedidosListos = JSON.parse(localStorage.getItem('pedidosCocinaListos') || '[]');
    // Si es la estructura antigua (array de números), devolverla tal cual
    if (pedidosListos.length > 0 && typeof pedidosListos[0] === 'number') {
      return pedidosListos;
    }
    // Si es la nueva estructura (array de objetos), extraer los IDs
    return pedidosListos.map(p => p.id);
  } catch (error) {
    console.error('Error al obtener IDs de pedidos listos:', error);
    return [];
  }
}

// Función auxiliar para obtener información completa de un pedido listo
function obtenerInfoPedidoListo(pedidoId) {
  try {
    const pedidosListos = JSON.parse(localStorage.getItem('pedidosCocinaListos') || '[]');
    const pedido = pedidosListos.find(p => (typeof p === 'object' ? p.id : null) === pedidoId);
    return pedido || null;
  } catch (error) {
    console.error('Error al obtener info de pedido listo:', error);
    return null;
  }
}

// Función para mostrar confirmación de pedido marcado como listo
function mostrarConfirmacionPedidoListo(pedidoId) {
  const pedido = historialCocina.find(p => p.id === pedidoId);
  if (!pedido) return;
  
  const codigo = pedido.mesa.startsWith('VENTA DIRECTA')
    ? (formatearCodigoPedidoCocina(pedido.mesa))
    : pedido.mesa.startsWith('DOM-') ? `DOMICILIO ${pedido.mesa.replace('DOM-', '')}` :
                 pedido.mesa.startsWith('REC-') ? `RECOGER ${pedido.mesa.replace('REC-', '')}` :
                 `MESA ${pedido.mesa}`;
  
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>✅ Pedido Marcado como Listo</strong>
    <p class="mb-0">${codigo}</p>
    <p class="mb-0 small">El pedido ha sido removido de la pantalla de cocina</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 3 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 3000);
}

// Función para formatear código de pedido
function formatearCodigoPedidoCocina(mesa) {
  if (!mesa) return 'PEDIDO';
  const m = mesa.toString();
  if (m.startsWith('VENTA DIRECTA')) {
    const extra = m.replace(/^VENTA DIRECTA\s*-?\s*/i, '').trim();
    return extra ? `⚡ VR · ${extra}` : '⚡ VENTA RÁPIDA';
  }
  if (m.startsWith('DOM-')) {
    return `DOM-${m.replace('DOM-', '')}`;
  } else if (m.startsWith('REC-')) {
    return `REC-${m.replace('REC-', '')}`;
  } else {
    return `MESA ${m}`;
  }
}

// Función para actualizar panel flotante de cocina
function actualizarPanelCocina() {
  const panel = document.getElementById('panelCocinaFlotante');
  if (!panel) return;
  
  // Si la pantalla de cocina está desactivada en administración,
  // no mostrar el panel flotante aunque haya pedidos
  const cocinaActivada = localStorage.getItem('pantallaCocinaActivada') === 'true';
  if (!cocinaActivada) {
    panel.style.display = 'none';
    return;
  }
  
  const pedidos = obtenerPedidosPendientesCocina();
  const contador = document.getElementById('contadorCocinaFlotante');
  const lista = document.getElementById('listaPedidosCocina');
  
  if (contador) {
    contador.textContent = pedidos.length;
  }
  
  if (lista) {
    if (pedidos.length === 0) {
      lista.innerHTML = '<div class="text-muted text-center p-2">No hay pedidos pendientes</div>';
      panel.style.display = 'none';
    } else {
      lista.innerHTML = pedidos.slice(0, 5).map(pedido => {
        const codigo = formatearCodigoPedidoCocina(pedido.mesa);
        // Acortar código si es muy largo para que quepa en 140px
        const codigoCorto = codigo.length > 12 ? codigo.substring(0, 10) + '...' : codigo;
        return `
          <div class="d-flex justify-content-between align-items-center p-1 border-bottom border-secondary" style="font-size: 0.75rem;">
            <span class="text-white text-truncate" style="max-width: 80px;" title="${codigo}">${codigoCorto}</span>
            <button class="btn btn-sm btn-success" onclick="marcarPedidoListo(${pedido.id})" title="Marcar como listo" style="padding: 2px 6px; font-size: 0.7rem;">
              <i class="fas fa-check"></i>
            </button>
          </div>
        `;
      }).join('');
      if (pedidos.length > 5) {
        lista.innerHTML += `<div class="text-center p-1"><small class="text-muted" style="font-size: 0.7rem;">+${pedidos.length - 5} más</small></div>`;
      }
      panel.style.display = 'block';
    }
  }
}

// Función para actualizar badge de cocina en la barra superior
function actualizarBadgeCocina() {
  const badge = document.getElementById('badgeCocinaPOS');
  if (!badge) return;
  
  const pedidos = obtenerPedidosPendientesCocina();
  if (pedidos.length > 0) {
    badge.textContent = pedidos.length;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// Función para abrir pantalla de cocina
function abrirPantallaCocina() {
  // Verificar si ya hay una ventana abierta (usando window para acceso global)
  if (typeof window.ventanaCocina !== 'undefined' && window.ventanaCocina && !window.ventanaCocina.closed) {
    window.ventanaCocina.focus();
    return;
  }
  
  // Detectar si hay segunda pantalla
  let tieneSegundaPantalla = false;
  try {
    if (typeof detectarSegundaPantalla === 'function') {
      tieneSegundaPantalla = detectarSegundaPantalla();
    }
  } catch (e) {
    console.error('Error al detectar segunda pantalla:', e);
  }
  
  // Configuración de la ventana
  const width = 1920;
  const height = 1080;
  let left = 0;
  let top = 0;
  
  if (tieneSegundaPantalla) {
    // Abrir en segunda pantalla (asumiendo que está a la derecha)
    left = screen.width;
    top = 0;
  } else {
    // Abrir en pantalla principal pero maximizada
    left = 0;
    top = 0;
  }
  
  const features = `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,status=no`;
  
  const ventana = window.open('cocina.html', 'PantallaCocina', features);
  
  // Guardar referencia globalmente
  window.ventanaCocina = ventana;
  if (typeof ventanaCocina !== 'undefined') {
    ventanaCocina = ventana;
  }
  
  if (ventana) {
    // Intentar maximizar
    setTimeout(() => {
      try {
        if (ventana && !ventana.closed) {
          ventana.focus();
          // Intentar entrar en pantalla completa (requiere interacción del usuario)
          console.log('Pantalla de cocina abierta. Presiona F11 para pantalla completa.');
        }
      } catch (e) {
        console.error('Error al configurar ventana de cocina:', e);
      }
    }, 500);
  } else {
    alert('No se pudo abrir la pantalla de cocina. Por favor, verifica que los bloqueadores de ventanas emergentes estén desactivados.');
  }
}

// Función para detectar segunda pantalla
function detectarSegundaPantalla() {
  try {
    // Verificar si hay múltiples pantallas
    // En algunos navegadores, screen.width puede ser mayor que window.screenX + window.innerWidth
    // cuando hay una segunda pantalla
    if (screen.width > window.innerWidth + window.screenX) {
      return true;
    }
    
    // Verificar usando la API de múltiples pantallas (si está disponible)
    if (window.screen && window.screen.mozScreens) {
      return window.screen.mozScreens.length > 1;
    }
    
    // Verificar usando la API estándar (experimental)
    if (window.screen && window.screen.isExtended) {
      return window.screen.isExtended;
    }
    
    // Método alternativo: verificar si hay espacio más allá de la ventana principal
    return false; // Por defecto, asumir que no hay segunda pantalla
  } catch (error) {
    console.error('Error al detectar segunda pantalla:', error);
    return false;
  }
}

function actualizarVisibilidadBotonesPOS() {
  const botones = [
    { id: 'btnGastosPOS', clave: 'posMostrarGastos' },
    { id: 'btnInventarioPOS', clave: 'posMostrarInventario' },
    { id: 'btnCierreAdminPOS', clave: 'posMostrarCierreAdmin' },
    { id: 'btnBalancePOS', clave: 'posMostrarBalance' }
  ];
  const esCajaDelLocal = window.ToySoftFirebase
    && typeof ToySoftFirebase.esPos === 'function'
    && ToySoftFirebase.esPos();
  const version = parseInt(localStorage.getItem('posBotonesDefaultsVersion') || '0', 10) || 0;
  botones.forEach(function (btn) {
    const el = document.getElementById(btn.id);
    if (!el) return;
    const ocultoEnCaja = version >= 2 && localStorage.getItem(btn.clave) === 'false';
    const visible = !esCajaDelLocal || !ocultoEnCaja;
    el.style.display = visible ? 'inline-block' : 'none';
  });
}

// Función para verificar y mostrar/ocultar botón de cocina según configuración
function actualizarVisibilidadBotónCocina() {
  const btnCocina = document.getElementById('btnCocinaPOS');
  if (!btnCocina) return;
  
  // Verificar si la pantalla de cocina está activada
  const cocinaActivada = localStorage.getItem('pantallaCocinaActivada') === 'true';
  
  // Mostrar u ocultar el botón según la configuración
  if (cocinaActivada) {
    btnCocina.style.display = 'inline-block';
  } else {
    btnCocina.style.display = 'none';
  }
}

// Función para inicializar sistema de cocina
function inicializarSistemaCocina() {
  actualizarVisibilidadBotónCocina();
  if (typeof actualizarVisibilidadBotonesPOS === 'function') {
    actualizarVisibilidadBotonesPOS();
  }
  
  // Verificar si la pantalla de cocina está activada
  const cocinaActivada = localStorage.getItem('pantallaCocinaActivada') === 'true';
  
  if (cocinaActivada) {
    // Intentar abrir automáticamente si hay segunda pantalla
    setTimeout(() => {
      if (detectarSegundaPantalla()) {
        abrirPantallaCocina();
      }
    }, 2000);
    
    // Obtener intervalo configurado (por defecto 30 segundos)
    const intervaloConfig = localStorage.getItem('cocinaIntervaloActualizacion');
    console.log('🔍 DEBUG app.js - Intervalo leído:', intervaloConfig);
    let intervaloNum = 30; // Valor por defecto: 30 segundos
    if (intervaloConfig) {
      const parsed = parseInt(intervaloConfig, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
        intervaloNum = parsed;
      }
    }
    const intervaloMs = intervaloNum * 1000;
    console.log('✅ app.js - Usando intervalo de:', intervaloNum, 'segundos');
    
    // Actualizar panel flotante y badge según intervalo configurado
    setInterval(() => {
      actualizarPanelCocina();
      actualizarBadgeCocina();
      if (typeof actualizarBadgeTicketsMesero === 'function') actualizarBadgeTicketsMesero();
    }, intervaloMs);
    
    // Actualizar panel y badge inicial
    actualizarPanelCocina();
    actualizarBadgeCocina();
    if (typeof actualizarBadgeTicketsMesero === 'function') actualizarBadgeTicketsMesero();
    
    // Escuchar cambios en el intervalo de actualización
    window.addEventListener('storage', (e) => {
      if (e.key === 'cocinaIntervaloActualizacion') {
        // Recargar la página para aplicar el nuevo intervalo
        // (más simple que manejar múltiples intervalos)
        location.reload();
      }
    });
  } else {
    // Si está desactivada, ocultar también el panel flotante
    const panel = document.getElementById('panelCocinaFlotante');
    if (panel) {
      panel.style.display = 'none';
    }
  }
  
  // Escuchar cambios en localStorage para actualizar panel y visibilidad del botón
  window.addEventListener('storage', (e) => {
    if (e.key === 'historialCocina' || e.key === 'pedidosCocinaListos') {
      actualizarPanelCocina();
      actualizarBadgeCocina();
    }
    if (e.key === 'pantallaCocinaActivada') {
      actualizarVisibilidadBotónCocina();
      // Reinicializar sistema si se activa
      if (localStorage.getItem('pantallaCocinaActivada') === 'true') {
        inicializarSistemaCocina();
      }
    }
    if (e.key && e.key.indexOf('posMostrar') === 0 && typeof actualizarVisibilidadBotonesPOS === 'function') {
      actualizarVisibilidadBotonesPOS();
    }
  });
  
  // También escuchar eventos personalizados (para cambios en la misma ventana)
  window.addEventListener('pedidoMarcadoListo', () => {
    actualizarPanelCocina();
    actualizarBadgeCocina();
  });
}

// Función para obtener pedidos listos de cocina (del día actual)
function obtenerPedidosListosCocina() {
  try {
    const historialCocina = JSON.parse(localStorage.getItem('historialCocina') || '[]');
    const pedidosListos = JSON.parse(localStorage.getItem('pedidosCocinaListos') || '[]');
    const pedidosListosIds = obtenerIdsPedidosListos();
    
    // Obtener fecha de hoy para filtrar
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Filtrar solo los pedidos que:
    // 1. Están marcados como listos
    // 2. Son del día actual
    const listos = historialCocina.filter(pedido => {
      // Verificar que esté marcado como listo
      if (!pedidosListosIds.includes(pedido.id)) {
        return false;
      }
      
      // Agregar información de fecha/hora de marcado como listo
      const infoListo = pedidosListos.find(p => (typeof p === 'object' ? p.id : p) === pedido.id);
      if (infoListo && typeof infoListo === 'object') {
        pedido.fechaHoraListo = infoListo.fechaHoraListo;
        pedido.fechaHoraListoMostrar = infoListo.fechaHoraListoMostrar || infoListo.fechaHoraListo;
      }
      
      // Verificar que sea del día actual
      try {
        let fechaPedido = null;
        const fechaAUsar = pedido.fecha || pedido.fechaMostrar;
        
        if (fechaAUsar) {
          if (typeof fechaAUsar === 'string') {
            const fechaISO = new Date(fechaAUsar);
            if (!isNaN(fechaISO.getTime())) {
              fechaPedido = fechaISO;
            }
          } else if (fechaAUsar instanceof Date) {
            fechaPedido = fechaAUsar;
          }
        }
        
        if (!fechaPedido) {
          return false;
        }
        
        const fechaPedidoNormalizada = new Date(fechaPedido);
        fechaPedidoNormalizada.setHours(0, 0, 0, 0);
        
        return fechaPedidoNormalizada.getTime() === hoy.getTime();
      } catch (e) {
        return false;
      }
    });

    // Ordenar por fecha de marcado como listo (más recientes primero)
    listos.sort((a, b) => {
      const fechaA = new Date(a.fechaHoraListo || a.fecha || 0);
      const fechaB = new Date(b.fechaHoraListo || b.fecha || 0);
      return fechaB - fechaA;
    });

    return listos;
  } catch (error) {
    console.error('Error al obtener pedidos listos:', error);
    return [];
  }
}

// Función para mostrar modal completo de pedidos en cocina
function mostrarModalPedidosCocina() {
  const pedidosPendientes = obtenerPedidosPendientesCocina();
  const pedidosListos = obtenerPedidosListosCocina();
  
  // Contenido de pedidos pendientes
  let contenidoPendientes = '';
  if (pedidosPendientes.length === 0) {
    contenidoPendientes = `
      <div class="text-center p-5">
        <i class="fas fa-utensils fa-3x text-muted mb-3"></i>
        <h5 class="text-muted">No hay pedidos pendientes en cocina</h5>
      </div>
    `;
  } else {
    contenidoPendientes = pedidosPendientes.map(pedido => {
      const codigo = formatearCodigoPedidoCocina(pedido.mesa);
      const productos = (pedido.items || []).map(item => {
        const detalle = item.detalles ? ` <small class="text-muted">(${item.detalles})</small>` : '';
        return `<li class="mb-1" style="padding: 5px; background: rgba(255, 107, 53, 0.1); border-left: 3px solid #ff6b35; margin-bottom: 5px;">${item.cantidad}x ${item.nombre}${detalle}</li>`;
      }).join('');
      
      let infoCliente = '';
      if (pedido.cliente) {
        infoCliente = `<p class="mb-1"><strong>Cliente:</strong> ${pedido.cliente}</p>`;
        if (pedido.telefono) {
          infoCliente += `<p class="mb-1"><strong>Tel:</strong> ${pedido.telefono}</p>`;
        }
        if (pedido.direccion && pedido.mesa.startsWith('DOM-')) {
          infoCliente += `<p class="mb-1"><strong>Dirección:</strong> ${pedido.direccion}</p>`;
        }
        if (pedido.horaRecoger && pedido.mesa.startsWith('REC-')) {
          infoCliente += `<p class="mb-1"><strong>Hora Recoger:</strong> ${pedido.horaRecoger}</p>`;
        }
      }
      
      return `
        <div class="card bg-dark mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h5 class="text-warning mb-1">${codigo}</h5>
                <p class="text-muted mb-0"><small>Ronda ${rondaDeProductos(pedido.items, pedido.ronda)} - ${pedido.fechaMostrar || pedido.fecha || ''}</small></p>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-outline-info" onclick="reimprimirTicketCocina('${String(pedido.id).replace(/'/g, '')}')">
                  <i class="fas fa-print"></i> Imprimir ticket
                </button>
                <button class="btn btn-success btn-lg" onclick="marcarPedidoListo(${pedido.id}); mostrarModalPedidosCocina();">
                  <i class="fas fa-check-circle"></i> Marcar como Listo
                </button>
              </div>
            </div>
            ${infoCliente}
            <div class="mt-3">
              <strong class="text-info"><i class="fas fa-list"></i> Productos:</strong>
              <ul class="mb-0 mt-2" style="list-style-type: none; padding-left: 0;">
                ${productos || '<li class="text-muted">No hay productos</li>'}
              </ul>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Contenido de pedidos listos
  let contenidoListos = '';
  if (pedidosListos.length === 0) {
    contenidoListos = `
      <div class="text-center p-5">
        <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
        <h5 class="text-muted">No hay pedidos listos</h5>
      </div>
    `;
  } else {
    contenidoListos = pedidosListos.map(pedido => {
      const codigo = formatearCodigoPedidoCocina(pedido.mesa);
      const productos = (pedido.items || []).map(item => {
        const detalle = item.detalles ? ` <small class="text-muted">(${item.detalles})</small>` : '';
        return `<li class="mb-1" style="padding: 5px; background: rgba(255, 107, 53, 0.1); border-left: 3px solid #ff6b35; margin-bottom: 5px;">${item.cantidad}x ${item.nombre}${detalle}</li>`;
      }).join('');
      
      let infoCliente = '';
      if (pedido.cliente) {
        infoCliente = `<p class="mb-1"><strong>Cliente:</strong> ${pedido.cliente}</p>`;
        if (pedido.telefono) {
          infoCliente += `<p class="mb-1"><strong>Tel:</strong> ${pedido.telefono}</p>`;
        }
        if (pedido.direccion && pedido.mesa.startsWith('DOM-')) {
          infoCliente += `<p class="mb-1"><strong>Dirección:</strong> ${pedido.direccion}</p>`;
        }
        if (pedido.horaRecoger && pedido.mesa.startsWith('REC-')) {
          infoCliente += `<p class="mb-1"><strong>Hora Recoger:</strong> ${pedido.horaRecoger}</p>`;
        }
      }
      
      const fechaListo = pedido.fechaHoraListoMostrar || pedido.fechaHoraListo || 'N/A';
      
      return `
        <div class="card bg-dark mb-3 border-success">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h5 class="text-success mb-1">${codigo} <i class="fas fa-check-circle"></i></h5>
                <p class="text-muted mb-0"><small>Ronda ${rondaDeProductos(pedido.items, pedido.ronda)} - ${pedido.fechaMostrar || pedido.fecha || ''}</small></p>
                <p class="text-success mb-0 mt-1"><small><i class="fas fa-clock"></i> Listo desde: ${fechaListo}</small></p>
              </div>
            </div>
            ${infoCliente}
            <div class="mt-3">
              <strong class="text-info"><i class="fas fa-list"></i> Productos:</strong>
              <ul class="mb-0 mt-2" style="list-style-type: none; padding-left: 0;">
                ${productos || '<li class="text-muted">No hay productos</li>'}
              </ul>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Crear o actualizar modal
  let modal = document.getElementById('modalPedidosCocina');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalPedidosCocina';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'modalPedidosCocinaLabel');
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="modal-dialog modal-xl modal-dialog-scrollable" style="max-height: 90vh;">
      <div class="modal-content bg-dark" style="max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header border-secondary flex-shrink-0">
          <h5 class="modal-title text-info" id="modalPedidosCocinaLabel">
            <i class="fas fa-utensils"></i> Pedidos en Cocina
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" style="overflow-y: auto; flex: 1; min-height: 0;">
          <!-- Nav tabs -->
          <ul class="nav nav-tabs mb-3" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active" id="pendientes-tab" data-bs-toggle="tab" data-bs-target="#pendientes" type="button" role="tab">
                Pendientes <span class="badge bg-warning">${pedidosPendientes.length}</span>
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="listos-tab" data-bs-toggle="tab" data-bs-target="#listos" type="button" role="tab">
                Listos <span class="badge bg-success">${pedidosListos.length}</span>
              </button>
            </li>
          </ul>
          
          <!-- Tab content -->
          <div class="tab-content">
            <div class="tab-pane fade show active" id="pendientes" role="tabpanel">
              ${contenidoPendientes}
            </div>
            <div class="tab-pane fade" id="listos" role="tabpanel">
              ${contenidoListos}
            </div>
          </div>
        </div>
        <div class="modal-footer border-secondary flex-shrink-0">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          <button type="button" class="btn btn-info" onclick="abrirPantallaCocina()">
            <i class="fas fa-tv"></i> Abrir Pantalla de Cocina
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Mostrar modal usando Bootstrap
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}

// Función para cerrar modal de pedidos en cocina
function cerrarModalPedidosCocina() {
  const modal = document.getElementById('modalPedidosCocina');
  if (modal) {
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
      bsModal.hide();
    }
  }
}

// ===== SISTEMA DE RECORDATORIOS DE TAREAS =====

// Función para guardar recordatorios en localStorage
function guardarRecordatorios() {
  try {
    localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    localStorage.setItem('recordatoriosActivos', JSON.stringify(recordatoriosActivos));
    if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
      ToySoftFirebase.persistirDatosDebounced();
    }
    console.log('✅ Recordatorios guardados:', recordatorios);
  } catch (error) {
    console.error('❌ Error al guardar recordatorios:', error);
  }
}

// Función para cargar recordatorios desde localStorage
function cargarRecordatorios() {
  try {
    recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    recordatoriosActivos = JSON.parse(localStorage.getItem('recordatoriosActivos')) || [];
    console.log('✅ Recordatorios cargados:', recordatorios);
  } catch (error) {
    console.error('❌ Error al cargar recordatorios:', error);
    recordatorios = [];
    recordatoriosActivos = [];
  }
}

// Función para crear un nuevo recordatorio
function crearRecordatorio(titulo, descripcion, tipo, prioridad = 'media', fechaLimite = null, repetir = false) {
  const recordatorio = {
    id: Date.now() + Math.random(),
    titulo: titulo,
    descripcion: descripcion,
    tipo: tipo, // 'pedido', 'limpieza', 'inventario', 'general', 'cocina'
    prioridad: prioridad, // 'baja', 'media', 'alta', 'urgente'
    fechaCreacion: new Date().toISOString(),
    fechaLimite: fechaLimite,
    completado: false,
    repetir: repetir,
    activo: true,
    asignadoA: null, // Para futuras implementaciones de usuarios
    categoria: 'general'
  };

  recordatorios.push(recordatorio);
  recordatoriosActivos.push(recordatorio);
  guardarRecordatorios();
  
  // Mostrar notificación inmediata
  mostrarNotificacionRecordatorio(recordatorio);
  
  return recordatorio;
}

// Función para marcar recordatorio como completado
function completarRecordatorio(id) {
  const recordatorio = recordatorios.find(r => r.id === id);
  if (recordatorio) {
    recordatorio.completado = true;
    recordatorio.activo = false;
    recordatorio.fechaCompletado = new Date().toISOString();
    
    // Remover de activos
    recordatoriosActivos = recordatoriosActivos.filter(r => r.id !== id);
    
    guardarRecordatorios();
    
    // Si es repetitivo, crear uno nuevo
    if (recordatorio.repetir && recordatorio.fechaLimite) {
      const nuevaFechaLimite = new Date(recordatorio.fechaLimite);
      nuevaFechaLimite.setDate(nuevaFechaLimite.getDate() + 1);
      crearRecordatorio(
        recordatorio.titulo,
        recordatorio.descripcion,
        recordatorio.tipo,
        recordatorio.prioridad,
        nuevaFechaLimite.toISOString(),
        true
      );
    }
    
    return true;
  }
  return false;
}

// Función para eliminar recordatorio
function eliminarRecordatorio(id) {
  recordatorios = recordatorios.filter(r => r.id !== id);
  recordatoriosActivos = recordatoriosActivos.filter(r => r.id !== id);
  guardarRecordatorios();
}

// Función para mostrar notificación de recordatorio
function mostrarNotificacionRecordatorio(recordatorio) {
  // Verificar si el navegador soporta notificaciones
  if (!("Notification" in window)) {
    console.log("Este navegador no soporta notificaciones del sistema");
    return;
  }

  // Solo mostrar notificación si ya se han dado permisos
  // No solicitar permisos automáticamente
  if (Notification.permission !== "granted") {
    console.log("Permisos de notificación no otorgados - usar notificaciones internas");
    return;
  }

  if (Notification.permission === "granted") {
    const notificacion = new Notification(recordatorio.titulo, {
      body: recordatorio.descripcion,
      icon: './image/logo-ToySoft.png',
      tag: recordatorio.id,
      requireInteraction: recordatorio.prioridad === 'urgente'
    });

    // Agregar a notificaciones activas
    notificacionesActivas.push({
      id: recordatorio.id,
      notificacion: notificacion,
      recordatorio: recordatorio
    });

    // Configurar auto-eliminación
    setTimeout(() => {
      notificacion.close();
      notificacionesActivas = notificacionesActivas.filter(n => n.id !== recordatorio.id);
    }, 10000); // 10 segundos
  }
}

// Función para verificar recordatorios vencidos
function verificarRecordatoriosVencidos() {
  const ahora = new Date();
  const vencidos = recordatoriosActivos.filter(recordatorio => {
    if (recordatorio.fechaLimite && !recordatorio.completado) {
      const fechaLimite = new Date(recordatorio.fechaLimite);
      return fechaLimite < ahora;
    }
    return false;
  });

  vencidos.forEach(recordatorio => {
    if (recordatorio.prioridad !== 'urgente') {
      recordatorio.prioridad = 'urgente';
      mostrarNotificacionRecordatorio({
        ...recordatorio,
        titulo: `⚠️ URGENTE: ${recordatorio.titulo}`,
        descripcion: `Tarea vencida: ${recordatorio.descripcion}`
      });
    }
  });

  guardarRecordatorios();
}

// Función para crear recordatorios automáticos
function crearRecordatoriosAutomaticos() {
  const ahora = new Date();
  const hora = ahora.getHours();
  
  // Recordatorio de cierre de caja (si no existe)
  const cierreCaja = recordatoriosActivos.find(r => r.tipo === 'cierre' && r.titulo.includes('Cierre de Caja'));
  if (!cierreCaja && hora >= 20) { // Después de las 8 PM
    crearRecordatorio(
      'Cierre de Caja',
      'Realizar cierre de caja y conteo de efectivo',
      'general',
      'alta',
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59).toISOString(),
      false
    );
  }

  // Recordatorio de limpieza (si no existe)
  const limpieza = recordatoriosActivos.find(r => r.tipo === 'limpieza' && r.titulo.includes('Limpieza'));
  if (!limpieza && hora >= 21) { // Después de las 9 PM
    crearRecordatorio(
      'Limpieza General',
      'Limpiar mesas, cocina y área de trabajo',
      'limpieza',
      'media',
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 30).toISOString(),
      false
    );
  }
}

// Función para obtener recordatorios por tipo
function obtenerRecordatoriosPorTipo(tipo) {
  return recordatoriosActivos.filter(r => r.tipo === tipo && !r.completado);
}

// Función para obtener recordatorios por prioridad
function obtenerRecordatoriosPorPrioridad(prioridad) {
  return recordatoriosActivos.filter(r => r.prioridad === prioridad && !r.completado);
}

// Función para actualizar recordatorio
function actualizarRecordatorio(id, datos) {
  const recordatorio = recordatorios.find(r => r.id === id);
  if (recordatorio) {
    Object.assign(recordatorio, datos);
    guardarRecordatorios();
    return true;
  }
  return false;
}

// ===== FUNCIONES DE INTEGRACIÓN CON OTROS MÓDULOS =====

// Función para crear recordatorio automático de pedido
function crearRecordatorioPedido(mesa, productos, tiempoEstimado = 15) {
  const recordatorio = crearRecordatorio(
    `Pedido Mesa ${mesa}`,
    `Preparar: ${productos.join(', ')}. Tiempo estimado: ${tiempoEstimado} min`,
    'pedido',
    'alta',
    new Date(Date.now() + tiempoEstimado * 60 * 1000).toISOString(),
    false
  );
  
  console.log(`🔔 Recordatorio de pedido creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio de limpieza de mesa
function crearRecordatorioLimpieza(mesa) {
  const recordatorio = crearRecordatorio(
    `Limpiar Mesa ${mesa}`,
    `La mesa ${mesa} necesita limpieza después del servicio`,
    'limpieza',
    'media',
    new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    false
  );
  
  console.log(`🧹 Recordatorio de limpieza creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio de inventario
function crearRecordatorioInventario(producto, cantidadMinima) {
  const recordatorio = crearRecordatorio(
    `Stock Bajo: ${producto}`,
    `El producto ${producto} tiene stock bajo (${cantidadMinima} unidades restantes)`,
    'inventario',
    'alta',
    new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
    false
  );
  
  console.log(`📦 Recordatorio de inventario creado para ${producto}`);
  return recordatorio;
}

// Función para crear recordatorio de cierre
function crearRecordatorioCierre() {
  const ahora = new Date();
  const horaCierre = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 0); // 11 PM
  
  const recordatorio = crearRecordatorio(
    'Cierre de Caja',
    'Realizar cierre de caja, conteo de efectivo y limpieza general',
    'cierre',
    'alta',
    horaCierre.toISOString(),
    false
  );
  
  console.log('💰 Recordatorio de cierre de caja creado');
  return recordatorio;
}

// Función para obtener recordatorios urgentes para mostrar en el dashboard
function obtenerRecordatoriosUrgentes() {
  return recordatoriosActivos.filter(r => 
    r.prioridad === 'urgente' && !r.completado
  );
}

// Función para obtener recordatorios pendientes por tipo
function obtenerRecordatoriosPendientesPorTipo(tipo) {
  return recordatoriosActivos.filter(r => 
    r.tipo === tipo && !r.completado
  );
}

// Función para marcar recordatorio como completado desde otros módulos
function completarRecordatorioPorTipo(tipo, identificador) {
  const recordatorio = recordatoriosActivos.find(r => 
    r.tipo === tipo && 
    r.descripcion.includes(identificador) && 
    !r.completado
  );
  
  if (recordatorio) {
    return completarRecordatorio(recordatorio.id);
  }
  
  return false;
}

// ===== FUNCIONES DE INTEGRACIÓN CON POS =====

// Función para crear recordatorio automático cuando se envía un pedido a cocina
function crearRecordatorioPedidoCocina(mesa, productos) {
  const recordatorio = crearRecordatorio(
    `Pedido Cocina - Mesa ${mesa}`,
    `Preparar: ${productos.join(', ')}. Mesa: ${mesa}`,
    'cocina',
    'alta',
    new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutos
    false
  );
  
  console.log(`🔔 Recordatorio de cocina creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio cuando se completa un pedido
function crearRecordatorioLimpiezaMesa(mesa) {
  const recordatorio = crearRecordatorio(
    `Limpiar Mesa ${mesa}`,
    `La mesa ${mesa} necesita limpieza después del servicio`,
    'limpieza',
    'media',
    new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
    false
  );
  
  console.log(`🧹 Recordatorio de limpieza creado para mesa ${mesa}`);
  return recordatorio;
}

// Función para crear recordatorio de inventario cuando se vende un producto
function crearRecordatorioInventarioProducto(producto, cantidadRestante) {
  if (cantidadRestante <= 5) { // Solo si queda poco stock
    const recordatorio = crearRecordatorio(
      `Stock Bajo: ${producto}`,
      `El producto ${producto} tiene stock bajo (${cantidadRestante} unidades restantes)`,
      'inventario',
      'alta',
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
      false
    );
    
    console.log(`📦 Recordatorio de inventario creado para ${producto}`);
    return recordatorio;
  }
  return null;
}

// Función para crear recordatorio de cierre cuando se acerca la hora
function crearRecordatorioCierreAutomatico() {
  const ahora = new Date();
  const hora = ahora.getHours();
  
  // Solo crear si no existe ya uno de cierre para hoy
  const cierreExistente = recordatoriosActivos.find(r => 
    r.tipo === 'cierre' && 
    r.titulo.includes('Cierre de Caja') &&
    new Date(r.fechaCreacion).toDateString() === ahora.toDateString()
  );
  
  if (!cierreExistente && hora >= 20) { // Después de las 8 PM
    const recordatorio = crearRecordatorio(
      'Cierre de Caja',
      'Realizar cierre de caja, conteo de efectivo y limpieza general',
      'cierre',
      'alta',
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 0).toISOString(), // 11 PM
      false
    );
    
    console.log('💰 Recordatorio de cierre de caja creado automáticamente');
    return recordatorio;
  }
  
  return null;
}

// ===== FUNCIONES PARA ACTIVAR NOTIFICACIONES MANUALMENTE =====

// Función para activar notificaciones del navegador
function activarNotificacionesNavegador() {
  try {
    if (!("Notification" in window)) {
      alert('Este navegador no soporta notificaciones del sistema');
      return false;
    }

    if (Notification.permission === "granted") {
      alert('Las notificaciones ya están activadas');
      return true;
    }

    if (Notification.permission === "denied") {
      alert('Las notificaciones están bloqueadas. Por favor, habilítalas en la configuración del navegador y recarga la página.');
      return false;
    }

    // Solicitar permisos solo cuando el usuario lo active manualmente
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        alert('✅ Notificaciones activadas exitosamente');
        console.log('🔔 Notificaciones del navegador activadas');
        
        // Probar notificación
        mostrarNotificacionRecordatorio({
          titulo: '🔔 Notificaciones Activadas',
          descripcion: 'El sistema de recordatorios ahora mostrará notificaciones del navegador',
          id: 'test-notificacion'
        });
      } else {
        alert('❌ Las notificaciones no fueron activadas');
        console.log('🔕 Usuario rechazó las notificaciones');
      }
    });

    return true;
  } catch (error) {
    console.error('Error al activar notificaciones:', error);
    alert('Error al activar notificaciones: ' + error.message);
    return false;
  }
}

// Función para verificar estado de notificaciones
function verificarEstadoNotificaciones() {
  if (!("Notification" in window)) {
    return 'no-soportado';
  }
  
  return Notification.permission;
}

// Función para mostrar estado de notificaciones
function mostrarEstadoNotificaciones() {
  const estado = verificarEstadoNotificaciones();
  
  switch (estado) {
    case 'granted':
      return '✅ Activadas';
    case 'denied':
      return '❌ Bloqueadas';
    case 'default':
      return '⏳ Pendientes';
    case 'no-soportado':
      return '🚫 No soportadas';
    default:
      return '❓ Desconocido';
  }
}

// Función para sincronizar datos con la administración
function sincronizarConAdministracion() {
  console.log('🔄 Sincronizando con datos de administración...');
  
  // Intentar cargar desde localStorage (donde admon.js los guarda)
  const categoriasAdmin = JSON.parse(localStorage.getItem('categorias')) || [];
  const productosAdmin = JSON.parse(localStorage.getItem('productos')) || [];
  
  console.log('📋 Categorías desde administración:', categoriasAdmin);
  console.log('🛍️ Productos desde administración:', productosAdmin);
  
  // Si hay datos de administración, usarlos
  if (categoriasAdmin.length > 0) {
    categorias = categoriasAdmin;
    console.log('✅ Categorías sincronizadas desde administración');
  }
  
  if (productosAdmin.length > 0) {
    productos = productosAdmin;
    console.log('✅ Productos sincronizados desde administración');
  }
  
  // Si no hay datos de administración, NO crear datos de prueba automáticamente
  if (categorias.length === 0) {
    console.log('ℹ️ No hay categorías en administración. El usuario debe crear categorías desde la sección de administración.');
    categorias = [];
  }
  
  if (productos.length === 0) {
    console.log('ℹ️ No hay productos en administración. El usuario debe crear productos desde la sección de administración.');
    productos = [];
  }
  
  console.log('✅ Sincronización completada:', { categorias, productos });
}

function aplicarCatalogoEnPOS(datos) {
  const cats = Array.isArray(datos && datos.categorias) ? datos.categorias : [];
  const prods = Array.isArray(datos && datos.productos) ? datos.productos : [];
  const hash = JSON.stringify({ categorias: cats, productos: prods });
  if (hash === window._catalogoPOSHash) return;
  window._catalogoPOSHash = hash;
  categorias = cats;
  productos = prods;
  window.categorias = categorias;
  window.productos = productos;
  if (document.getElementById('categorias') && typeof mostrarProductos === 'function') {
    mostrarProductos();
  }
}

async function cargarCatalogoDesdeNube() {
  if (!window.ToySoftFirebase) return;
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) return;
    const catalogo = await ToySoftFirebase.sincronizarCatalogo();
    aplicarCatalogoEnPOS(catalogo);
    ToySoftFirebase.escucharCatalogo(aplicarCatalogoEnPOS);
  } catch (error) {
    console.warn('No se pudo cargar el catálogo de Firebase', error);
  }
}

function hashOperacionLocal(datos) {
  try {
    return JSON.stringify({
      mesasActivas: datos && datos.mesasActivas,
      ordenesCocina: datos && datos.ordenesCocina,
      historialCocina: datos && datos.historialCocina,
      pedidosCocinaListos: datos && datos.pedidosCocinaListos,
      contadorDomicilios: datos && datos.contadorDomicilios,
      contadorRecoger: datos && datos.contadorRecoger,
      contadoresReinicioEn: datos && datos.contadoresReinicioEn,
      nombresDomiciliarios: datos && datos.nombresDomiciliarios,
      pantallaCocinaActivada: datos && datos.pantallaCocinaActivada,
      cocinaIntervaloActualizacion: datos && datos.cocinaIntervaloActualizacion,
      posMostrarGastos: datos && datos.posMostrarGastos,
      posMostrarInventario: datos && datos.posMostrarInventario,
      posMostrarCierreAdmin: datos && datos.posMostrarCierreAdmin,
      posMostrarBalance: datos && datos.posMostrarBalance,
      posRequiereLogin: datos && datos.posRequiereLogin,
      posInstaladorActivo: datos && datos.posInstaladorActivo
    });
  } catch (e) {
    return String(Date.now());
  }
}

function pedidosCocinaDeMesero(horas) {
  const limiteMs = (Number(horas) > 0 ? Number(horas) : 12) * 60 * 60 * 1000;
  const limite = Date.now() - limiteMs;
  return (historialCocina || []).filter(function (orden) {
    if (!orden || orden.origen !== 'mesero') return false;
    if (orden.cobrada || orden.anulada) return false;
    if (orden.sesionId && typeof sesionMesaYaCobrada === 'function' && sesionMesaYaCobrada(orden.sesionId)) return false;
    if (typeof mesaEstaActiva === 'function' && !mesaEstaActiva(orden.mesa)) return false;
    const t = Date.parse(orden.fecha);
    return Number.isFinite(t) ? t >= limite : true;
  }).sort(function (a, b) {
    return (Date.parse(b && b.fecha) || 0) - (Date.parse(a && a.fecha) || 0);
  });
}

function anularTicketsMeseroDeMesa(mesaId) {
  const id = String(mesaId || '');
  if (!id || !Array.isArray(historialCocina)) return;
  let cambio = false;
  historialCocina.forEach(function (orden) {
    if (!orden || String(orden.mesa) !== id || orden.cobrada || orden.anulada) return;
    orden.anulada = true;
    cambio = true;
  });
  if (cambio && typeof guardarHistorialCocina === 'function') guardarHistorialCocina();
}

function restaurarMesasPerdidasDeTicketsMesero() {
  if (!Array.isArray(historialCocina) || !historialCocina.length) return false;
  const porMesa = new Map();
  historialCocina.forEach(function (orden) {
    if (!orden || orden.origen !== 'mesero' || orden.cobrada || orden.anulada) return;
    if (orden.sesionId && typeof sesionMesaYaCobrada === 'function' && sesionMesaYaCobrada(orden.sesionId)) return;
    const corte = Date.parse(localStorage.getItem('contadoresReinicioEn') || localStorage.getItem('ultimaHoraCierre') || '');
    if (Number.isFinite(corte)) {
      const cuando = Date.parse(orden.fecha || '');
      if (!Number.isFinite(cuando) || cuando < corte) return;
    }
    const mesaId = String(orden.mesa || '');
    if (!mesaId || mesaEstaActiva(mesaId)) return;
    const fecha = Date.parse(orden.fecha);
    if (Number.isFinite(fecha)) {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      if (fecha < inicio.getTime()) return;
    }
    if (!porMesa.has(mesaId)) porMesa.set(mesaId, []);
    porMesa.get(mesaId).push(orden);
  });
  let cambio = false;
  porMesa.forEach(function (ordenes, mesaId) {
    const base = ordenes[ordenes.length - 1] || {};
    const pedido = crearPedidoMesaVacio({
      sesionId: base.sesionId || undefined,
      cliente: base.cliente || undefined,
      telefono: base.telefono || undefined,
      direccion: base.direccion || undefined,
      horaRecoger: base.horaRecoger || undefined,
      tipo: mesaId.startsWith('DOM-') ? 'domicilio' : (mesaId.startsWith('REC-') ? 'recoger' : 'mesa'),
      origen: 'mesero',
      nombreMesero: base.nombreMesero,
      sexoMesero: base.sexoMesero
    });
    pedido.items = [];
    ordenes.forEach(function (orden) {
      (orden.items || []).forEach(function (item) {
        if (!item) return;
        const ronda = rondaDeItem(item.ronda != null && item.ronda !== '' ? item : { ronda: orden.ronda });
        const ya = pedido.items.some(function (p) {
          return String(p.id) === String(item.id) && rondaDeItem(p) === ronda;
        });
        if (ya) return;
        pedido.items.push(Object.assign({}, item, {
          estado: 'en_cocina',
          ronda: ronda,
          sesionId: pedido.sesionId
        }));
      });
    });
    if (!pedido.items.length) return;
    sincronizarRondaPedido(pedido);
    mesasActivas.set(mesaId, pedido);
    cambio = true;
  });
  if (cambio && typeof guardarMesas === 'function') guardarMesas(true);
  return cambio;
}

function actualizarBadgeTicketsMesero() {
  const badge = document.getElementById('badgeTicketsMeseroPOS');
  if (!badge) return;
  const n = pedidosCocinaDeMesero(3).length;
  if (n > 0) {
    badge.textContent = String(n);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function mostrarModalTicketsMesero() {
  const pedidos = pedidosCocinaDeMesero(12);
  let cuerpo = '';
  if (!pedidos.length) {
    cuerpo = '<div class="text-center p-4 text-muted">No hay tickets de mesero pendientes. Los ya cobrados se buscan en Historial.</div>';
  } else {
    cuerpo = pedidos.map(function (pedido) {
      const id = String(pedido.id).replace(/'/g, '');
      const codigo = typeof formatearCodigoPedidoCocina === 'function'
        ? formatearCodigoPedidoCocina(pedido.mesa)
        : String(pedido.mesa || '');
      const mesero = pedido.nombreMesero ? String(pedido.nombreMesero) : '';
      const hora = pedido.fechaMostrar || (pedido.fecha ? new Date(pedido.fecha).toLocaleString() : '');
      const ronda = rondaDeProductos(pedido.items, pedido.ronda);
      const productos = (pedido.items || []).map(function (item) {
        const det = item.detalles ? ' <small class="text-white-50">(' + String(item.detalles) + ')</small>' : '';
        return '<li>' + (item.cantidad || 1) + ' × ' + String(item.nombre || '') + det + '</li>';
      }).join('');
      return '<div class="card bg-dark border-secondary mb-3">' +
        '<div class="card-body">' +
        '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">' +
        '<div>' +
        '<h5 class="text-info mb-1">' + codigo + '</h5>' +
        '<div class="small text-white-50">Ronda ' + ronda + (mesero ? ' · ' + mesero : '') + '</div>' +
        '<div class="small text-white-50">' + hora + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-info" onclick="imprimirTicketCocinaDesdeListaMesero(\'' + id + '\')">' +
        '<i class="fas fa-print"></i> Imprimir en esta caja</button>' +
        '</div>' +
        '<ul class="mb-0 mt-3 ps-3">' + (productos || '<li class="text-muted">Sin productos</li>') + '</ul>' +
        '</div></div>';
    }).join('');
  }

  let modal = document.getElementById('modalTicketsMesero');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalTicketsMesero';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
    '<div class="modal-content bg-dark text-white">' +
    '<div class="modal-header border-secondary">' +
    '<h5 class="modal-title"><i class="fas fa-mobile-alt me-2"></i>Tickets de mesero</h5>' +
    '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<p class="text-white-50 small">Solo lo que envió la app de mesero. Si se te pasó el aviso, imprímelo aquí.</p>' +
    cuerpo +
    '</div>' +
    '<div class="modal-footer border-secondary">' +
    '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>' +
    '</div></div></div>';
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

function imprimirTicketCocinaDesdeListaMesero(ordenId) {
  const id = String(ordenId);
  const orden = (historialCocina || []).find(function (o) { return String(o.id) === id; });
  if (!orden) {
    alert('No se encontró ese ticket de mesero');
    return;
  }
  imprimirTicketCocinaDeOrden(orden);
}

function ordenCocinaMeseroReciente(orden) {
  const t = Date.parse(orden && orden.fecha);
  if (!Number.isFinite(t)) return false;
  return (Date.now() - t) <= 45 * 60 * 1000;
}

function imprimirTicketCocinaDeOrden(orden, opciones) {
  opciones = opciones || {};
  if (!orden || typeof imprimirTicketCocina !== 'function') return;
  imprimirTicketCocina(orden.mesa, orden.items, {
    ronda: orden.ronda,
    pedido: orden,
    nombreMesero: orden.nombreMesero,
    sexoMesero: orden.sexoMesero,
    silencioso: !!opciones.silencioso
  });
}

function marcarOrdenCocinaImpresaEnCaja(orden) {
  if (!orden) return;
  const id = String(orden.id);
  orden.impresoEnCaja = true;
  (historialCocina || []).forEach(function (h) {
    if (String(h.id) === id) h.impresoEnCaja = true;
  });
  localStorage.setItem('historialCocina', JSON.stringify(historialCocina));
}

function procesarPedidoNuevoDeMesero(orden, opciones) {
  opciones = opciones || {};
  if (!orden || orden.origen !== 'mesero') return;
  const pendienteCaja = !!orden.imprimirEnCaja && !orden.impresoEnCaja;
  if (pendienteCaja) {
    if (opciones.soloRecientes && !ordenCocinaMeseroReciente(orden)) return;
    imprimirTicketCocinaDeOrden(orden, { silencioso: true });
    marcarOrdenCocinaImpresaEnCaja(orden);
    if (typeof mostrarAvisoTicketCocinaMesero === 'function') {
      mostrarAvisoTicketCocinaMesero({
        mesa: orden.mesa,
        nombreMesero: orden.nombreMesero,
        imprimiendoEnCaja: true,
        orden: orden
      });
    }
    return;
  }
  if (opciones.omitirAviso) return;
  if (typeof mostrarAvisoTicketCocinaMesero !== 'function') return;
  mostrarAvisoTicketCocinaMesero({
    mesa: orden.mesa,
    nombreMesero: orden.nombreMesero,
    orden: orden
  });
}

function imprimirPedidosNuevosDeMesero(lista) {
  const actuales = Array.isArray(lista) ? lista : [];
  const primeraVez = !window._idsCocinaMeseroVistos;
  if (primeraVez) window._idsCocinaMeseroVistos = new Set();
  actuales.forEach(function (orden) {
    const id = String(orden && orden.id || '');
    if (!id || window._idsCocinaMeseroVistos.has(id)) return;
    window._idsCocinaMeseroVistos.add(id);
    procesarPedidoNuevoDeMesero(orden, {
      soloRecientes: primeraVez,
      omitirAviso: primeraVez && !(orden && orden.imprimirEnCaja && !orden.impresoEnCaja)
    });
  });
  if (typeof actualizarBadgeTicketsMesero === 'function') actualizarBadgeTicketsMesero();
}

function aplicarOperacionEnPOS(datos) {
  if (window._operacionPersistiendo) return;
  if (!datos) return;
  if (typeof aplicarInstaladorPos === 'function') aplicarInstaladorPos();
  const hash = hashOperacionLocal(datos);
  if (hash === window._operacionPOSHash) {
    if (purgarMesasCobradas()) {
      persistirOperacionTrasCobro();
      if (typeof actualizarMesasActivas === 'function') actualizarMesasActivas();
    }
    return;
  }
  window._operacionPOSHash = hash;

  try {
    const previas = new Map(mesasActivas);
    const entradas = Array.isArray(datos.mesasActivas) ? datos.mesasActivas : [];
    mesasActivas = new Map();
    entradas.forEach(function (par) {
      if (!Array.isArray(par) || par.length < 2 || par[0] == null) return;
      const mesaId = String(par[0]);
      mesasActivas.set(mesaId, typeof normalizarPedidoMesa === 'function' ? normalizarPedidoMesa(par[1]) : par[1]);
    });
    previas.forEach(function (pedido, id) {
      const mesaId = String(id);
      const remoto = mesasActivas.get(mesaId);
      if (!remoto) {
        const marca = Number(pedido && pedido.actualizadoLocal) || 0;
        if (marca > Date.now() - 4000) mesasActivas.set(mesaId, pedido);
        return;
      }
      const tl = Number(pedido && pedido.actualizadoLocal) || 0;
      const tr = Number(remoto && remoto.actualizadoLocal) || 0;
      const il = pedido && Array.isArray(pedido.items) ? pedido.items.length : 0;
      const ir = remoto && Array.isArray(remoto.items) ? remoto.items.length : 0;
      if (tl > tr || (tl === tr && il > ir)) mesasActivas.set(mesaId, pedido);
    });
    const corteReinicio = Date.parse(localStorage.getItem('contadoresReinicioEn') || '');
    if (Number.isFinite(corteReinicio)) {
      Array.from(mesasActivas.keys()).forEach(function (mesaId) {
        const clave = String(mesaId);
        if (clave.indexOf('DOM-') !== 0 && clave.indexOf('REC-') !== 0) return;
        const pedido = mesasActivas.get(mesaId);
        const marca = Number(pedido && pedido.actualizadoLocal) || 0;
        if (marca > 0 && marca < corteReinicio) mesasActivas.delete(mesaId);
      });
    }
  } catch (error) {
    console.warn('No se pudieron aplicar mesas de la nube', error);
  }

  try {
    ordenesCocina = new Map(Array.isArray(datos.ordenesCocina) ? datos.ordenesCocina : []);
  } catch (error) {
    console.warn('No se pudieron aplicar órdenes de cocina de la nube', error);
  }

  historialCocina = Array.isArray(datos.historialCocina) ? datos.historialCocina : [];
  if (typeof imprimirPedidosNuevosDeMesero === 'function') {
    imprimirPedidosNuevosDeMesero(historialCocina);
  }
  const domAntes = contadorDomicilios || 0;
  const recAntes = contadorRecoger || 0;
  contadorDomicilios = parseInt(localStorage.getItem('contadorDomicilios') || '0', 10) || 0;
  contadorRecoger = parseInt(localStorage.getItem('contadorRecoger') || '0', 10) || 0;
  if (datos.ultimaFechaContadores) ultimaFechaContadores = datos.ultimaFechaContadores;
  let maxDom = 0;
  let maxRec = 0;
  mesasActivas.forEach(function (_pedido, mesaId) {
    const clave = String(mesaId);
    const n = parseInt(clave.split('-')[1], 10) || 0;
    if (clave.indexOf('DOM-') === 0) maxDom = Math.max(maxDom, n);
    if (clave.indexOf('REC-') === 0) maxRec = Math.max(maxRec, n);
  });
  if (contadorDomicilios > domAntes && maxDom <= domAntes) contadorDomicilios = domAntes;
  if (contadorRecoger > recAntes && maxRec <= recAntes) contadorRecoger = recAntes;
  localStorage.setItem('contadorDomicilios', String(contadorDomicilios || 0));
  localStorage.setItem('contadorRecoger', String(contadorRecoger || 0));

  const mesaAntes = mesaSeleccionada;
  if (purgarMesasCobradas()) persistirOperacionTrasCobro();

  if (typeof actualizarMesasActivas === 'function') actualizarMesasActivas();
  if (mesaSeleccionada && mesaEstaActiva(mesaSeleccionada) && typeof actualizarVistaOrden === 'function') {
    if (typeof hayEdicionOrdenActiva !== 'function' || !hayEdicionOrdenActiva()) {
      actualizarVistaOrden(mesaSeleccionada);
    }
  } else if (mesaAntes && !mesaEstaActiva(mesaAntes)) {
    limpiarVistaOrdenSiPedidoLibre(mesaAntes);
  }
  if (typeof actualizarPanelCocina === 'function') actualizarPanelCocina();
  if (typeof actualizarBadgeCocina === 'function') actualizarBadgeCocina();
  if (typeof actualizarBadgeTicketsMesero === 'function') actualizarBadgeTicketsMesero();
  if (typeof actualizarDatalistDomiciliarios === 'function') actualizarDatalistDomiciliarios();
  if (typeof actualizarVisibilidadBotónCocina === 'function') actualizarVisibilidadBotónCocina();
  if (typeof actualizarVisibilidadBotonesPOS === 'function') actualizarVisibilidadBotonesPOS();
}

async function cargarOperacionDesdeNube() {
  if (!window.ToySoftFirebase) return;
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) return;
    const operacion = await ToySoftFirebase.sincronizarOperacion();
    aplicarOperacionEnPOS(operacion);
    ToySoftFirebase.escucharOperacion(aplicarOperacionEnPOS);
  } catch (error) {
    console.warn('No se pudo cargar la operación en vivo de Firebase', error);
  }
}

// Función para inicializar datos de prueba si no existen (mantenida por compatibilidad)
function inicializarDatosPrueba() {
  console.log('🔄 Llamando a sincronización con administración...');
  sincronizarConAdministracion();
}

function rondaDeItem(item) {
  const ronda = Number(item && item.ronda);
  return Number.isFinite(ronda) && ronda > 0 ? ronda : 1;
}

// Ronda de los productos enviados (no usar pedido.ronda: ese valor es la *siguiente* ronda).
function rondaDeProductos(productos, fallback = 1) {
  const items = Array.isArray(productos) ? productos : [];
  if (items.length === 0) {
    const n = Number(fallback);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  return items.reduce((max, item) => Math.max(max, rondaDeItem(item)), 1);
}

function crearIdSesionMesa() {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function crearPedidoMesaVacio(extra = {}) {
  return {
    items: [],
    estado: 'pendiente',
    fecha: new Date().toLocaleString(),
    ronda: 1,
    ...extra,
    sesionId: extra.sesionId || crearIdSesionMesa()
  };
}

function sincronizarRondaPedido(pedido) {
  if (!pedido) return 1;
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  if (items.length === 0) {
    pedido.ronda = pedido.ronda > 0 ? pedido.ronda : 1;
    return pedido.ronda;
  }
  const maxRonda = items.reduce((max, item) => Math.max(max, rondaDeItem(item)), 1);
  const hayPendientes = items.some(item => item.estado !== 'en_cocina');
  pedido.ronda = hayPendientes ? maxRonda : maxRonda + 1;
  return pedido.ronda;
}

function normalizarPedidoMesa(pedido) {
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido)) {
    const itemsDesdeArray = Array.isArray(pedido)
      ? (Array.isArray(pedido.items) && pedido.items.length > 0 ? pedido.items : pedido.filter(item => item && typeof item === 'object' && !Array.isArray(item)))
      : [];
    pedido = crearPedidoMesaVacio({ items: itemsDesdeArray });
  }
  if (!Array.isArray(pedido.items)) {
    pedido.items = [];
  }
  pedido.items.forEach(item => {
    if (item && (item.ronda == null || item.ronda === '')) {
      item.ronda = 1;
    }
  });
  if (!pedido.sesionId) {
    pedido.sesionId = crearIdSesionMesa();
  }
  sincronizarRondaPedido(pedido);
  return pedido;
}

function encontrarItemPedido(pedido, id, ronda) {
  if (!pedido || !Array.isArray(pedido.items)) return undefined;
  const rondaNum = ronda == null || ronda === '' ? null : Number(ronda);
  const idBuscado = String(id);
  return pedido.items.find(item => {
    if (String(item.id) !== idBuscado) return false;
    if (rondaNum == null || !Number.isFinite(rondaNum)) return true;
    return rondaDeItem(item) === rondaNum;
  });
}

function hayEdicionOrdenActiva() {
  const el = document.activeElement;
  return !!(el && el.classList && el.classList.contains('input-detalles-orden'));
}

function acumularOrdenesCocina(mesaId, productosNuevos) {
  if (!mesaId || !productosNuevos || productosNuevos.length === 0) return;
  const pedido = mesasActivas.get(mesaId);
  const sesionId = pedido && pedido.sesionId;
  productosNuevos.forEach(item => {
    if (sesionId) item.sesionId = sesionId;
  });
  const existentes = (ordenesCocina.get(mesaId) || []).filter(item => {
    if (!sesionId) return false;
    return item && item.sesionId === sesionId;
  });
  ordenesCocina.set(mesaId, existentes.concat(productosNuevos));
}

function limpiarCocinaDeMesa(mesaId) {
  if (mesaId == null || mesaId === '') return;
  ordenesCocina.delete(mesaId);
  const comoTexto = String(mesaId);
  if (comoTexto !== mesaId) ordenesCocina.delete(comoTexto);
}

function sesionMesaYaCobrada(sesionId) {
  if (!sesionId) return false;
  const id = String(sesionId);
  if (window.ToySoftFirebase && typeof ToySoftFirebase.sesionYaCobrada === 'function') {
    if (ToySoftFirebase.sesionYaCobrada(id)) return true;
  }
  try {
    const arr = JSON.parse(localStorage.getItem('sesionesCobradasHoy') || '[]');
    if (Array.isArray(arr) && arr.indexOf(id) !== -1) return true;
  } catch (e) { /* ignore */ }
  if (typeof historialVentas !== 'undefined' && Array.isArray(historialVentas)) {
    if (historialVentas.some(function (venta) { return venta && String(venta.sesionId) === id; })) return true;
  }
  try {
    const historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    return Array.isArray(historial) && historial.some(function (venta) { return venta && String(venta.sesionId) === id; });
  } catch (e) {
    return false;
  }
}

function marcarSesionPedidoCobrada(sesionId) {
  const id = String(sesionId || '');
  if (!id) return;
  if (window.ToySoftFirebase && typeof ToySoftFirebase.marcarSesionCobrada === 'function') {
    ToySoftFirebase.marcarSesionCobrada(id);
    return;
  }
  try {
    const arr = JSON.parse(localStorage.getItem('sesionesCobradasHoy') || '[]');
    const lista = Array.isArray(arr) ? arr : [];
    if (lista.indexOf(id) === -1) {
      lista.push(id);
      localStorage.setItem('sesionesCobradasHoy', JSON.stringify(lista));
    }
  } catch (e) { /* ignore */ }
}

function purgarMesasCobradas() {
  const aBorrar = [];
  mesasActivas.forEach(function (pedido, mesaId) {
    const sesion = pedido && pedido.sesionId;
    if (sesion && sesionMesaYaCobrada(sesion)) aBorrar.push({ mesaId: mesaId, sesion: sesion });
  });
  aBorrar.forEach(function (item) {
    marcarOrdenesCocinaCobradas(String(item.mesaId), item.sesion);
    limpiarCocinaDeMesa(item.mesaId);
    mesasActivas.delete(item.mesaId);
  });
  return aBorrar.length > 0;
}

function persistirOperacionTrasCobro() {
  if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirOperacionInmediato === 'function') {
    ToySoftFirebase.persistirOperacionInmediato();
  }
}

function limpiarVistaOrdenSiPedidoLibre(mesaId) {
  if (mesaSeleccionada && mesaId && String(mesaSeleccionada) !== String(mesaId) && mesaEstaActiva(mesaSeleccionada)) {
    return;
  }
  const cuerpo = document.getElementById('ordenCuerpo');
  if (cuerpo) cuerpo.innerHTML = '';
  const propina = document.getElementById('propina');
  if (propina) propina.value = '';
  const descuento = document.getElementById('descuento');
  if (descuento) descuento.value = '';
  const valorDom = document.getElementById('valorDomicilio');
  if (valorDom) valorDom.value = '';
  const total = document.getElementById('totalOrden');
  if (total) total.textContent = '$ 0';
  const desglose = document.getElementById('desgloseTotal');
  if (desglose) desglose.innerHTML = '';
  const mesaActual = document.getElementById('mesaActual');
  if (mesaActual) mesaActual.textContent = '-';
  if (mesaId && String(mesaSeleccionada) === String(mesaId)) mesaSeleccionada = null;
  if (typeof actualizarBotonCambioPedido === 'function') actualizarBotonCambioPedido();
}

function pedidoDeMesa(id) {
  if (id == null || id === '') return undefined;
  return mesasActivas.get(id) || mesasActivas.get(String(id));
}

function mesaEstaActiva(id) {
  if (id == null || id === '') return false;
  return mesasActivas.has(id) || mesasActivas.has(String(id));
}

function marcarOrdenesCocinaCobradas(mesaId, sesionId) {
  if (!Array.isArray(historialCocina) || mesaId == null || mesaId === '') return;
  const id = String(mesaId);
  let cambio = false;
  historialCocina.forEach(orden => {
    if (!orden || String(orden.mesa) !== id) return;
    if (sesionId && orden.sesionId && orden.sesionId !== sesionId) return;
    if (!orden.cobrada) {
      orden.cobrada = true;
      cambio = true;
    }
  });
  if (cambio) guardarHistorialCocina();
}

function liberarMesaTrasCobro(mesaId, sesionId) {
  if (mesaId == null || mesaId === '') return;
  const id = String(mesaId);
  const pedido = mesasActivas.get(mesaId) || mesasActivas.get(id);
  const sesion = sesionId || (pedido && pedido.sesionId) || null;
  if (sesion) marcarSesionPedidoCobrada(sesion);
  marcarOrdenesCocinaCobradas(id, sesion);
  limpiarCocinaDeMesa(mesaId);
  limpiarCocinaDeMesa(id);
  Array.from(mesasActivas.keys()).forEach(clave => {
    if (clave === mesaId || String(clave) === id) {
      mesasActivas.delete(clave);
    }
  });
  guardarMesas();
  persistirOperacionTrasCobro();
  if (typeof actualizarBadgeTicketsMesero === 'function') actualizarBadgeTicketsMesero();
}

function restaurarItemsMesaDesdeCocina(mesasObjetivo) {
  if (!Array.isArray(historialCocina) || historialCocina.length === 0) return false;
  const objetivo = mesasObjetivo instanceof Set ? mesasObjetivo : null;
  let restauradas = false;

  mesasActivas.forEach((pedido, mesaId) => {
    if (objetivo && !objetivo.has(mesaId)) return;
    const sesionId = pedido && pedido.sesionId;
    if (!sesionId) return;

    const ordenesMesa = historialCocina.filter(orden => {
      if (!orden || orden.cobrada) return false;
      if (orden.mesa !== mesaId) return false;
      if (orden.sesionId !== sesionId) return false;
      const fecha = parseFechaSeguro(orden.fecha || orden.fechaMostrar);
      return fecha ? esMismaFechaLocal(fecha, new Date()) : false;
    });
    if (ordenesMesa.length === 0) return;

    if (!Array.isArray(pedido.items)) pedido.items = [];

    ordenesMesa.forEach(orden => {
      (orden.items || []).forEach(productoCocina => {
        if (productoCocina.sesionId && productoCocina.sesionId !== sesionId) return;
        const ronda = productoCocina.ronda != null && productoCocina.ronda !== ''
          ? rondaDeItem(productoCocina)
          : (orden.ronda || 1);
        const existe = pedido.items.find(item =>
          item.id === productoCocina.id && rondaDeItem(item) === ronda
        );
        if (existe) {
          existe.estado = 'en_cocina';
          if (existe.ronda == null) existe.ronda = ronda;
        } else {
          pedido.items.push({
            ...productoCocina,
            estado: 'en_cocina',
            ronda,
            sesionId
          });
          restauradas = true;
        }
      });
    });

    sincronizarRondaPedido(pedido);
  });

  return restauradas;
}

// Función para cargar datos desde localStorage
function cargarDatos() {
  try {
    console.log('Iniciando carga de datos...');
    console.log('Elemento #categorias existe:', !!document.getElementById('categorias'));
    console.log('Elemento #productosGrid existe:', !!document.getElementById('productosGrid'));
    let mesasFormatoViejo = new Set();
    
    // Cargar mesas activas primero
    const mesasGuardadas = localStorage.getItem('mesasActivas');
    if (mesasGuardadas) {
      try {
        const mesasArray = JSON.parse(mesasGuardadas);
        mesasActivas = new Map(mesasArray);
        console.log('Mesas activas cargadas:', mesasActivas);
        
        // Verificar y normalizar cada mesa (formato viejo guardaba [] y perdía los items)
        mesasActivas.forEach((pedido, mesaId) => {
          if (Array.isArray(pedido)) mesasFormatoViejo.add(mesaId);
          mesasActivas.set(mesaId, normalizarPedidoMesa(pedido));
        });

      // Si los contadores se reiniciaron por cierre, eliminar residuos DOM/REC
      try {
        const contadorDomLS = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
        const contadorRecLS = parseInt(localStorage.getItem('contadorRecoger')) || 0;
        const ultimaHoraCierre = localStorage.getItem('ultimaHoraCierre');
        const huboCierreReciente = !!ultimaHoraCierre;
        if (huboCierreReciente && contadorDomLS === 0 && contadorRecLS === 0) {
          let removidas = 0;
          Array.from(mesasActivas.keys()).forEach((mesaId) => {
            if (typeof mesaId === 'string' && (mesaId.startsWith('DOM-') || mesaId.startsWith('REC-'))) {
              mesasActivas.delete(mesaId);
              removidas++;
            }
          });
          if (removidas > 0) {
            console.log(`🧹 Eliminadas ${removidas} mesas DOM/REC residuales tras cierre`);
            guardarMesas();
          }
        }
      } catch (e) {
        console.warn('No se pudo limpiar mesas DOM/REC residuales:', e);
      }
      } catch (error) {
        console.error('Error al parsear mesas activas:', error);
        mesasActivas = new Map();
      }
    }

    // Cargar historial de ventas
    const historialVentasGuardado = localStorage.getItem('historialVentas');
    if (historialVentasGuardado) {
      try {
        historialVentas = JSON.parse(historialVentasGuardado);
        if (!Array.isArray(historialVentas)) {
          console.error('Error: historialVentas no es un array');
          historialVentas = [];
        }
      } catch (error) {
        console.error('Error al parsear historial de ventas:', error);
        historialVentas = [];
      }
    }
    
    // Cargar otros datos
    const productosGuardados = localStorage.getItem('productos');
    const categoriasGuardadas = localStorage.getItem('categorias');
    const ordenesCocinaGuardadas = localStorage.getItem('ordenesCocina');
    const clientesGuardados = localStorage.getItem('clientes');
    const historialCocinaGuardado = localStorage.getItem('historialCocina');
    const cotizacionesGuardadas = localStorage.getItem('cotizaciones');
    
    if (productosGuardados) {
      try {
        productos = JSON.parse(productosGuardados);
      } catch (error) {
        console.error('Error al parsear productos:', error);
        productos = [];
      }
    }
    
    if (categoriasGuardadas) {
      try {
        categorias = JSON.parse(categoriasGuardadas);
      } catch (error) {
        console.error('Error al parsear categorías:', error);
        categorias = [];
      }
    }

    if (ordenesCocinaGuardadas) {
      try {
        const ordenesArray = JSON.parse(ordenesCocinaGuardadas);
        ordenesCocina = new Map(ordenesArray);
        console.log('Órdenes de cocina cargadas:', ordenesCocina);
        
        // Restaurar el estado de los productos en cocina en las mesas activas
        ordenesCocina.forEach((productos, mesaId) => {
          if (mesasActivas.has(mesaId)) {
            const pedido = mesasActivas.get(mesaId);
            if (!pedido.items) {
              pedido.items = [];
            }
            
            // Asegurarse de que todos los productos de cocina estén en la mesa
            productos.forEach(productoCocina => {
              const sesionMesa = pedido.sesionId;
              if (sesionMesa && productoCocina.sesionId !== sesionMesa) {
                return;
              }
              const ronda = rondaDeItem(productoCocina);
              const productoExistente = pedido.items.find(item =>
                item.id === productoCocina.id && rondaDeItem(item) === ronda
              );
              if (productoExistente) {
                productoExistente.estado = 'en_cocina';
                if (productoExistente.ronda == null) productoExistente.ronda = ronda;
              } else if (sesionMesa && productoCocina.sesionId === sesionMesa) {
                pedido.items.push({
                  ...productoCocina,
                  estado: 'en_cocina',
                  ronda
                });
              }
            });
            sincronizarRondaPedido(pedido);
          }
        });
      } catch (error) {
        console.error('Error al parsear órdenes de cocina:', error);
        ordenesCocina = new Map();
      }
    }

    if (clientesGuardados) {
      try {
        clientes = JSON.parse(clientesGuardados);
        if (!Array.isArray(clientes)) {
          console.error('Error: clientes no es un array');
          clientes = [];
        }
      } catch (error) {
        console.error('Error al parsear clientes:', error);
        clientes = [];
      }
    }

    // Cargar contadores (incluir "0": no usar if (valor) porque '0' es falsy)
    const contadorDomiciliosGuardado = localStorage.getItem('contadorDomicilios');
    const contadorRecogerGuardado = localStorage.getItem('contadorRecoger');
    if (contadorDomiciliosGuardado !== null && contadorDomiciliosGuardado !== '') {
      contadorDomicilios = parseInt(contadorDomiciliosGuardado, 10) || 0;
    }
    if (contadorRecogerGuardado !== null && contadorRecogerGuardado !== '') {
      contadorRecoger = parseInt(contadorRecogerGuardado, 10) || 0;
    }
    ultimaFechaContadores = localStorage.getItem('ultimaFechaContadores') || ultimaFechaContadores;
    console.log(`📦 Contadores cargados: DOM=${contadorDomicilios}, REC=${contadorRecoger}`);

    if (historialCocinaGuardado) {
      try {
        historialCocina = JSON.parse(historialCocinaGuardado);
        if (!Array.isArray(historialCocina)) {
          console.error('Error: historialCocina no es un array');
          historialCocina = [];
        }
      } catch (error) {
        console.error('Error al parsear historial de cocina:', error);
        historialCocina = [];
      }
    }

    if (restaurarItemsMesaDesdeCocina(mesasFormatoViejo)) {
      console.log('Rondas de cocina restauradas en mesas activas');
      guardarMesas();
    }

    const mesasYaCobradas = [];
    mesasActivas.forEach((pedido, mesaId) => {
      if (pedido && sesionMesaYaCobrada(pedido.sesionId)) {
        mesasYaCobradas.push(mesaId);
      }
    });
    if (mesasYaCobradas.length > 0) {
      mesasYaCobradas.forEach(mesaId => {
        const pedido = mesasActivas.get(mesaId);
        liberarMesaTrasCobro(mesaId, pedido && pedido.sesionId);
      });
      console.log('Mesas ya cobradas liberadas:', mesasYaCobradas);
    }

    if (cotizacionesGuardadas) {
      try {
        cotizaciones = JSON.parse(cotizacionesGuardadas);
      } catch (error) {
        console.error('Error al parsear cotizaciones:', error);
        cotizaciones = [];
      }
    }
    
    console.log('Datos cargados exitosamente');
    console.log('Estado final de mesas:', Array.from(mesasActivas.entries()));
    
    // Inicializar datos de prueba si no existen
    inicializarDatosPrueba();
    cargarCatalogoDesdeNube();
    cargarOperacionDesdeNube();
    cargarVentasDesdeNube();
    cargarFinanzasDesdeNube();
    if (typeof cargarInventarioDesdeNube === 'function') {
      cargarInventarioDesdeNube();
    }
    if (typeof cargarRestoDesdeNube === 'function') {
      cargarRestoDesdeNube();
    }
    if (window.ToySoftFirebase && typeof ToySoftFirebase.sincronizarRoles === 'function') {
      ToySoftFirebase.sincronizarRoles().catch(function (error) {
        console.warn('No se pudieron sincronizar los PIN', error);
      });
    }
    
    // Asegurar que los elementos estén disponibles antes de mostrar productos
    setTimeout(() => {
      console.log('Mostrando productos después de timeout...');
      mostrarProductos();
      actualizarMesasActivas();
    }, 100);
  } catch (error) {
    console.error('Error general al cargar datos:', error);
  }
}

// Función para guardar el estado de las mesas
function guardarMesas(inmediato) {
  try {
    console.log('Guardando estado de mesas...');
    const marca = Date.now();
    if (!window._firmasPedidosPOS) window._firmasPedidosPOS = {};
    mesasActivas.forEach((pedido, mesaId) => {
      const normalizado = normalizarPedidoMesa(pedido);
      const firma = firmaPedidoSinMarca(normalizado);
      const previa = window._firmasPedidosPOS[mesaId];
      if (previa == null) {
        if (!normalizado.actualizadoLocal) normalizado.actualizadoLocal = marca;
      } else if (previa !== firma) {
        normalizado.actualizadoLocal = marca;
      }
      window._firmasPedidosPOS[mesaId] = firmaPedidoSinMarca(normalizado);
      mesasActivas.set(mesaId, normalizado);
    });
    Object.keys(window._firmasPedidosPOS).forEach(function (id) {
      if (!mesasActivas.has(id) && !mesasActivas.has(String(id))) delete window._firmasPedidosPOS[id];
    });
    const mesasArray = Array.from(mesasActivas.entries());
    const ordenesCocinaArray = Array.from(ordenesCocina.entries());
    
    localStorage.setItem('mesasActivas', JSON.stringify(mesasArray));
    localStorage.setItem('ordenesCocina', JSON.stringify(ordenesCocinaArray));
    notificarOperacionNube(!!inmediato);
    
    console.log('Estado de mesas guardado exitosamente');
  } catch (error) {
    console.error('Error al guardar estado de mesas:', error);
    alert('Error al guardar el estado de las mesas. Por favor, intente nuevamente.');
  }
}

function firmaPedidoSinMarca(pedido) {
  if (!pedido || typeof pedido !== 'object') return '';
  const copia = Object.assign({}, pedido);
  delete copia.actualizadoLocal;
  try { return JSON.stringify(copia); } catch (e) { return String(Date.now()); }
}

function textoPedidoExterno(orden, conCliente) {
  const cliente = orden && orden.cliente ? String(orden.cliente).trim() : '';
  const cantidad = Array.isArray(orden && orden.items)
    ? orden.items.reduce((sum, item) => sum + (Number(item && item.cantidad) || 0), 0)
    : 0;
  const cantidadTexto = cantidad + ' prod.';
  if (conCliente && cliente) return cliente + ' · ' + cantidadTexto;
  return cantidadTexto;
}

// Función para actualizar la vista de mesas activas
function actualizarMesasActivas() {
  const container = document.getElementById('mesasContainer');
  if (!container) {
    console.log('No se encontró el elemento mesasContainer - probablemente no estamos en la página POS');
    return;
  }
  container.innerHTML = '';

  mesasActivas.forEach((orden, mesa) => {
    const boton = document.createElement('button');
    const esExterno = typeof mesa === 'string' && (mesa.startsWith('DOM-') || mesa.startsWith('REC-'));
    
    // Determinar el tipo de botón basado en el ID de la mesa
    if (typeof mesa === 'string' && mesa.startsWith('DOM-')) {
      const numeroDomicilio = mesa.split('-')[1];
      boton.className = `mesa-btn mesa-domicilio ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <i class="fas fa-motorcycle" style="margin-bottom: 12px; margin-top: -6px;"></i>
          <span class="mesa-numero" style="font-size: 1.5rem;">D${parseInt(numeroDomicilio)}</span>
        </div>
      `;
    } else if (typeof mesa === 'string' && mesa.startsWith('REC-')) {
      const numeroRecoger = mesa.split('-')[1];
      boton.className = `mesa-btn mesa-recoger ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <i class="fas fa-shopping-bag" style="margin-bottom: 12px; margin-top: -6px;"></i>
          <span class="mesa-numero" style="font-size: 1.5rem;">R${parseInt(numeroRecoger)}</span>
        </div>
      `;
    } else {
      boton.className = `mesa-btn mesa-activa ${mesa === mesaSeleccionada ? 'mesa-seleccionada' : ''}`;
      boton.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <span style="font-size: 1rem; opacity: 0.95; margin-bottom: 8px; margin-top: -4px;">Mesa</span>
          <span class="mesa-numero" style="font-size: 1.5rem;">${mesa}</span>
        </div>
      `;
    }

    boton.onclick = () => seleccionarMesa(mesa);
    const pieza = document.createElement('div');
    pieza.className = 'pedido-externo-item';
    const pie = document.createElement('div');
    pie.className = 'pedido-externo-caption';
    const resumen = textoPedidoExterno(orden, esExterno);
    pie.textContent = resumen;
    pie.title = resumen;
    pieza.appendChild(boton);
    pieza.appendChild(pie);
    container.appendChild(pieza);
  });
}

// Función para seleccionar una mesa
function seleccionarMesa(mesa) {
  console.log('Seleccionando mesa:', mesa);
  mesaSeleccionada = mesa == null ? null : String(mesa);
  document.getElementById('mesaActual').textContent = mesaSeleccionada;
  actualizarMesasActivas();
  actualizarVistaOrden(mesaSeleccionada);
  actualizarBotonCambioPedido();
}

// Función para mostrar productos en el panel
function mostrarProductos() {
  console.log('=== DEBUG MOSTRAR PRODUCTOS ===');
  console.log('Categorías disponibles:', categorias);
  console.log('Productos disponibles:', productos);
  console.log('Longitud de categorías:', categorias.length);
  console.log('Longitud de productos:', productos.length);
  
  const categoriasDiv = document.getElementById('categorias');
  console.log('Elemento #categorias encontrado:', !!categoriasDiv);
  if (!categoriasDiv) {
    console.log('No se encontró el elemento #categorias - probablemente no estamos en la página POS');
    return;
  }
  
  // Verificar si el elemento está oculto
  console.log('Estilo del elemento #categorias:', {
    display: categoriasDiv.style.display,
    visibility: categoriasDiv.style.visibility,
    opacity: categoriasDiv.style.opacity,
    position: categoriasDiv.style.position,
    zIndex: categoriasDiv.style.zIndex
  });
  
  categoriasDiv.innerHTML = '';
  
  if (categorias.length === 0) {
    console.log('No hay categorías disponibles');
    categoriasDiv.innerHTML = '<p class="text-muted">No hay categorías disponibles</p>';
    return;
  }
  
  console.log('Creando botones de categorías...');
  
  // Agregar botón "Todos los Productos" al principio
  const botonTodos = document.createElement('button');
  botonTodos.classList.add('btn', 'btn-success', 'mb-2', 'w-100', 'fw-bold');
  botonTodos.innerHTML = '<i class="fas fa-th-large me-2"></i>Todos los Productos';
  botonTodos.onclick = () => mostrarTodosLosProductos();
  categoriasDiv.appendChild(botonTodos);
  console.log('Botón "Todos los Productos" creado');
  
  // Agregar separador visual
  const separador = document.createElement('hr');
  separador.className = 'my-3 border-info';
  categoriasDiv.appendChild(separador);
  
  // Crear botones para cada categoría
  categorias.forEach((categoria, index) => {
    console.log(`Creando botón para categoría ${index + 1}:`, categoria);
    const botonCategoria = document.createElement('button');
    botonCategoria.classList.add('btn', 'btn-info', 'mb-2', 'w-100');
    botonCategoria.textContent = categoria;
    botonCategoria.onclick = () => filtrarProductosPorCategoria(categoria);
    categoriasDiv.appendChild(botonCategoria);
    console.log(`Botón creado y agregado para:`, categoria);
  });
  console.log('Total de botones creados:', categoriasDiv.children.length);
  
  // Verificar que los botones se crearon correctamente
  const botonesCreados = categoriasDiv.querySelectorAll('button');
  console.log('Botones verificados en DOM:', botonesCreados.length);
  botonesCreados.forEach((boton, index) => {
    console.log(`Botón ${index + 1}:`, boton.textContent, boton.className);
  });
}

// Función de debug para verificar el estado (se puede llamar desde la consola)
function debugEstado() {
  console.log('=== DEBUG ESTADO COMPLETO ===');
  console.log('Variables globales:');
  console.log('- categorias:', categorias);
  console.log('- productos:', productos);
  console.log('- mesaSeleccionada:', mesaSeleccionada);
  
  console.log('Elementos DOM:');
  console.log('- #categorias:', document.getElementById('categorias'));
  console.log('- #productosGrid:', document.getElementById('productosGrid'));
  console.log('- #ordenCuerpo:', document.getElementById('ordenCuerpo'));
  
  console.log('localStorage:');
  console.log('- categorias:', localStorage.getItem('categorias'));
  console.log('- productos:', localStorage.getItem('productos'));
  
  console.log('Estado de elementos:');
  const categoriasDiv = document.getElementById('categorias');
  if (categoriasDiv) {
    console.log('- Hijos de #categorias:', categoriasDiv.children.length);
    console.log('- HTML de #categorias:', categoriasDiv.innerHTML);
    console.log('- Estilo display:', categoriasDiv.style.display);
    console.log('- Estilo visibility:', categoriasDiv.style.visibility);
  }
  
  const productosGrid = document.getElementById('productosGrid');
  if (productosGrid) {
    console.log('- Hijos de #productosGrid:', productosGrid.children.length);
    console.log('- HTML de #productosGrid:', productosGrid.innerHTML);
    console.log('- Estilo display:', productosGrid.style.display);
    console.log('- Estilo visibility:', productosGrid.style.visibility);
  }
  
  console.log('Verificación de funciones:');
  console.log('- mostrarProductos es función:', typeof mostrarProductos);
  console.log('- filtrarProductosPorCategoria es función:', typeof filtrarProductosPorCategoria);
  console.log('- mostrarProductosFiltrados es función:', typeof mostrarProductosFiltrados);
  
  // Verificar si hay errores en la consola
  console.log('=== VERIFICACIÓN DE ERRORES ===');
  try {
    mostrarProductos();
    console.log('✅ mostrarProductos() ejecutado sin errores');
  } catch (error) {
    console.error('❌ Error en mostrarProductos():', error);
  }
  
  try {
    if (categorias.length > 0) {
      filtrarProductosPorCategoria(categorias[0]);
      console.log('✅ filtrarProductosPorCategoria() ejecutado sin errores');
    }
  } catch (error) {
    console.error('❌ Error en filtrarProductosPorCategoria():', error);
  }
}

// Función para forzar la recarga de datos (se puede llamar desde la consola)
function recargarDatos() {
  console.log('=== RECARGANDO DATOS ===');
  
  // Limpiar localStorage
  localStorage.removeItem('categorias');
  localStorage.removeItem('productos');
  
  // Limpiar variables globales
  categorias = [];
  productos = [];
  
  // Reinicializar
  inicializarDatosPrueba();
  
  // Forzar la recarga del DOM
  setTimeout(() => {
    mostrarProductos();
    console.log('Datos recargados. Estado actual:');
    debugEstado();
  }, 200);
}

// Función para reiniciar completamente el sistema
function reiniciarSistema() {
  console.log('=== REINICIANDO SISTEMA COMPLETO ===');
  
  // Limpiar todo el localStorage
  localStorage.clear();
  
  // Limpiar variables globales
  categorias = [];
  productos = [];
  mesasActivas = new Map();
  mesaSeleccionada = null;
  ordenesCocina = new Map();
  clientes = [];
  historialVentas = [];
  historialCocina = [];
  
  // Reinicializar desde cero
  inicializarDatosPrueba();
  
  // Recargar la página después de un delay
  setTimeout(() => {
    console.log('Reiniciando página...');
    window.location.reload();
  }, 1000);
}

// Función para verificar acceso (requerida por POS.html)
function verificarAcceso() {
  console.log('Verificando acceso...');
  // Por ahora, permitir acceso directo
  return true;
}

// Función para mostrar todos los productos
function mostrarTodosLosProductos() {
  const inputBusqueda = document.getElementById('buscarProductoPOS');
  if (inputBusqueda) inputBusqueda.value = '';
  const msgBusqueda = document.getElementById('mensajeBusquedaPOS');
  if (msgBusqueda) { msgBusqueda.style.display = 'none'; msgBusqueda.textContent = ''; }
  console.log('Mostrando todos los productos...');
  console.log('Total de productos:', productos.length);
  mostrarProductosFiltrados(productos);
}

// Función para filtrar productos por categoría
function filtrarProductosPorCategoria(categoria) {
  const inputBusqueda = document.getElementById('buscarProductoPOS');
  if (inputBusqueda) inputBusqueda.value = '';
  const msgBusqueda = document.getElementById('mensajeBusquedaPOS');
  if (msgBusqueda) { msgBusqueda.style.display = 'none'; msgBusqueda.textContent = ''; }
  console.log('Filtrando productos por categoría:', categoria);
  console.log('Productos totales:', productos);
  const productosFiltrados = productos.filter(p => p.categoria === categoria);
  console.log('Productos filtrados:', productosFiltrados);
  mostrarProductosFiltrados(productosFiltrados);
}

// Buscador de productos en POS: busca por nombre y categoría en todos los productos (Administración)
function buscarProductosPOS(termino) {
  const productosGrid = document.getElementById('productosGrid');
  const mensajeBusqueda = document.getElementById('mensajeBusquedaPOS');
  if (!productosGrid) return;

  if (mensajeBusqueda) {
    mensajeBusqueda.style.display = 'none';
    mensajeBusqueda.textContent = '';
  }

  if (!termino) {
    mostrarTodosLosProductos();
    return;
  }

  const terminoLower = termino.toLowerCase();
  const productosFiltrados = productos.filter(p => {
    const nombre = (p.nombre || '').toLowerCase();
    const categoria = (p.categoria || '').toLowerCase();
    const codigo = (p.codigo || '').toLowerCase();
    return nombre.includes(terminoLower) || categoria.includes(terminoLower) || codigo.includes(terminoLower);
  });

  mostrarProductosFiltrados(productosFiltrados);

  if (mensajeBusqueda && termino.length > 0) {
    mensajeBusqueda.style.display = 'block';
    if (productosFiltrados.length === 0) {
      mensajeBusqueda.textContent = 'No se encontraron productos con "' + termino + '".';
      mensajeBusqueda.classList.remove('text-success');
      mensajeBusqueda.classList.add('text-warning');
    } else {
      mensajeBusqueda.textContent = productosFiltrados.length + ' producto(s) encontrado(s).';
      mensajeBusqueda.classList.remove('text-warning');
      mensajeBusqueda.classList.add('text-success');
    }
  }
}

// Función para formatear precio (sin decimales)
function formatearPrecio(precio) {
  const numero = Math.round(precio);
  return `$ ${formatearNumero(numero)}`;
}

// Función para formatear precio con decimales (para recibos)
function formatearPrecioRecibo(precio) {
  const numero = Math.round(precio);
  return formatearNumero(numero);
}

// Función para mostrar los productos filtrados
function mostrarProductosFiltrados(productosFiltrados) {
  const tablaOrden = document.getElementById('ordenCuerpo');
  const productosGrid = document.getElementById('productosGrid');
  tablaOrden.innerHTML = '';
  
  // Mostrar indicador de carga
  if (productosGrid) {
    productosGrid.innerHTML = '<div class="col-12 productos-loading">Cargando productos...</div>';
  }
  
  // Simular un pequeño delay para mejor UX
  setTimeout(() => {
    if (productosGrid) productosGrid.innerHTML = '';

    if (productosFiltrados.length === 0) {
      tablaOrden.innerHTML = '<tr><td colspan="3" class="text-center">No hay productos en esta categoría</td></tr>';
      if (productosGrid) {
        productosGrid.innerHTML = '<div class="col-12 text-center py-4"><i class="fas fa-box-open fa-3x text-muted mb-3"></i><p class="text-muted">No hay productos disponibles en esta categoría</p></div>';
      }
      return;
    }

    // Configurar visualización como cuadrícula
    // if (tablaOrden) tablaOrden.style.display = 'none'; // Comentado para mantener visible la tabla de la orden
    if (productosGrid) productosGrid.style.display = '';

    // Encabezado removido - solo se muestran los productos directamente
    // const encabezado = document.createElement('div');
    // encabezado.className = 'col-12 mb-3';
    
    // if (productosFiltrados.length === productos.length) {
    //   // Mostrando todos los productos
    //   encabezado.innerHTML = `
    //     <div class="alert alert-success text-center">
    //       <h5 class="mb-2"><i class="fas fa-th-large me-2"></i>Todos los Productos</h5>
    //       <p class="mb-0">Vista completa de ${productosFiltrados.length} productos disponibles</p>
    //     </div>
    //   `;
    // } else {
    //   // Mostrando productos filtrados por categoría
    //   const categoria = productosFiltrados[0]?.categoria || 'Categoría';
    //   encabezado.innerHTML = `
    //     <div class="alert alert-info text-center">
    //       <h5 class="mb-2"><i class="fas fa-filter me-2"></i>${categoria}</h5>
    //       <p class="mb-0">${productosFiltrados.length} productos en esta categoría</p>
    //     </div>
    //   `;
    // }
    
    // productosGrid.appendChild(encabezado);

    productosFiltrados.forEach(producto => {
      // Permite rutas relativas (locales) o URLs externas. Si falla, muestra placeholder universal
      const imagenSrc = producto.imagen && producto.imagen.trim() ? producto.imagen : 'image/placeholder-product.png';
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML = `
        <div class="card h-100 text-center border-info shadow-sm">
          <img src="${imagenSrc}" class="card-img-top" alt="Imagen de ${producto.nombre}" onerror="this.onerror=null;this.src='image/placeholder-product.png'" style="object-fit:cover;border-top-left-radius:0.5rem;border-top-right-radius:0.5rem;background:#fff;" />
          <div class="card-body d-flex flex-column justify-content-between">
            <div>
              <h6 class="card-title mb-2" title="${producto.nombre}">${producto.nombre}</h6>
              <p class="card-text text-info fw-bold mb-2">${formatearPrecio(producto.precio)}</p>
              <small class="text-muted">${producto.categoria}</small>
              ${producto.editableEnVenta ? '<div class="mt-1"><span class="badge bg-warning text-dark">Nombre y precio libres</span></div>' : ''}
            </div>
            <button class="btn btn-primary btn-sm w-100" onclick="agregarProducto(${producto.id})">
              <i class="fas fa-plus me-1"></i>Agregar
            </button>
          </div>
        </div>
      `;
      productosGrid.appendChild(col);
    });
  }, 100); // Pequeño delay para mejor UX
}



function productoEsEditableEnVenta(producto) {
  return !!(producto && producto.editableEnVenta);
}

function productoTieneOpcionesSalsas(producto) {
  return !!(producto && producto.llevaOpcionesSalsas && Array.isArray(producto.opcionesSalsas) && producto.opcionesSalsas.length);
}

function rellenarCheckboxesOpciones(containerId, checkboxesId, inputName, opciones) {
  const container = document.getElementById(containerId);
  const checkboxes = document.getElementById(checkboxesId);
  if (!container || !checkboxes) return;
  if (Array.isArray(opciones) && opciones.length > 0) {
    container.style.display = 'block';
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    checkboxes.innerHTML = opciones.map((nombre) =>
      `<label class="form-check form-check-inline mb-0"><input class="form-check-input" type="checkbox" name="${inputName}" value="${esc(nombre)}"> <span class="form-check-label">${esc(nombre)}</span></label>`
    ).join('');
  } else {
    container.style.display = 'none';
    checkboxes.innerHTML = '';
  }
}

function configurarCamposEditablesModal(producto) {
  const nombreFijo = document.getElementById('productoNombre');
  const precioFijo = document.getElementById('productoPrecio');
  const camposEditables = document.getElementById('productoEditableCampos');
  const nombreEditable = document.getElementById('productoNombreEditable');
  const precioEditable = document.getElementById('productoPrecioEditable');
  const esEditable = productoEsEditableEnVenta(producto);

  if (nombreFijo) nombreFijo.style.display = esEditable ? 'none' : '';
  if (precioFijo) precioFijo.style.display = esEditable ? 'none' : '';
  if (camposEditables) camposEditables.style.display = esEditable ? 'block' : 'none';

  if (nombreEditable) nombreEditable.value = esEditable ? (producto.nombre || '') : '';
  if (precioEditable) precioEditable.value = esEditable ? (producto.precio ?? '') : '';
}

function obtenerNombreModalCantidad() {
  const producto = window.productoSeleccionado;
  if (productoEsEditableEnVenta(producto)) {
    const input = document.getElementById('productoNombreEditable');
    const valor = input ? input.value.trim() : '';
    return valor || producto.nombre;
  }
  return producto ? producto.nombre : '';
}

function obtenerPrecioModalCantidad() {
  const producto = window.productoSeleccionado;
  if (productoEsEditableEnVenta(producto)) {
    const input = document.getElementById('productoPrecioEditable');
    const valor = input ? parseFloat(input.value) : NaN;
    return isNaN(valor) ? Number(producto.precio) : valor;
  }
  return producto ? Number(producto.precio) : 0;
}

// Función para agregar producto a la orden (ahora abre modal de cantidad)
function agregarProducto(id) {
  if (!mesaSeleccionada) {
    alert('Por favor, seleccione una mesa primero');
    return;
  }

  const producto = productos.find(p => p.id === id);
  if (!producto) {
    console.error('Producto no encontrado:', id);
    alert('Producto no encontrado');
    return;
  }

  // Guardar el producto seleccionado globalmente para el modal
  window.productoSeleccionado = producto;
  
  // Configurar el modal con la información del producto
  document.getElementById('productoImagen').src = producto.imagen || 'image/placeholder-product.png';
  document.getElementById('productoImagen').alt = producto.nombre;
  document.getElementById('productoNombre').textContent = producto.nombre;
  document.getElementById('productoPrecio').textContent = formatearPrecio(producto.precio);
  document.getElementById('cantidadProducto').value = '1';
  document.getElementById('detallesProducto').value = '';
  configurarCamposEditablesModal(producto);

  rellenarCheckboxesOpciones(
    'salsasProductoContainer',
    'salsasProductoCheckboxes',
    'salsaProducto',
    (producto.llevaSalsas && Array.isArray(producto.salsas)) ? producto.salsas : []
  );
  rellenarCheckboxesOpciones(
    'opcionesSalsasProductoContainer',
    'opcionesSalsasProductoCheckboxes',
    'opcionSalsaProducto',
    productoTieneOpcionesSalsas(producto) ? producto.opcionesSalsas : []
  );
  
  // Calcular y mostrar el total inicial
  actualizarTotalModal();
  
  // Mostrar el modal
  abrirModalEstatico('modalCantidad');

  if (productoEsEditableEnVenta(producto)) {
    setTimeout(() => {
      const input = document.getElementById('productoNombreEditable');
      if (input) {
        input.focus();
        input.select();
      }
    }, 300);
  }
}

// Función para cambiar cantidad en el modal
function cambiarCantidadModal(cambio) {
  const input = document.getElementById('cantidadProducto');
  let cantidad = parseInt(input.value) || 1;
  cantidad = Math.max(1, Math.min(99, cantidad + cambio));
  input.value = cantidad;
  actualizarTotalModal();
}

// Función para actualizar el total en el modal
function actualizarTotalModal() {
  const cantidad = parseInt(document.getElementById('cantidadProducto').value) || 1;
  const precio = obtenerPrecioModalCantidad();
  const total = cantidad * precio;
  document.getElementById('totalProducto').textContent = formatearPrecio(total);
}

// Función para confirmar agregar producto con cantidad seleccionada
function confirmarAgregarProducto() {
  if (!window.productoSeleccionado) {
    console.error('No hay producto seleccionado');
    return;
  }

  const producto = window.productoSeleccionado;
  const cantidad = parseInt(document.getElementById('cantidadProducto').value) || 1;
  const nombreVenta = obtenerNombreModalCantidad();
  const precioVenta = obtenerPrecioModalCantidad();
  let detalles = document.getElementById('detallesProducto').value.trim();
  const salsasChecks = document.querySelectorAll('#salsasProductoCheckboxes input[name="salsaProducto"]:checked');
  const salsasSeleccionadas = Array.from(salsasChecks).map(c => c.value);
  if (salsasSeleccionadas.length) {
    detalles = (detalles ? detalles + '; ' : '') + 'Modificaciones: ' + salsasSeleccionadas.join(', ');
  }
  const opcionesSalsasChecks = document.querySelectorAll('#opcionesSalsasProductoCheckboxes input[name="opcionSalsaProducto"]:checked');
  const opcionesSalsasSeleccionadas = Array.from(opcionesSalsasChecks).map(c => c.value);
  if (opcionesSalsasSeleccionadas.length) {
    detalles = (detalles ? detalles + '; ' : '') + 'Salsas: ' + opcionesSalsasSeleccionadas.join(', ');
  }

  if (productoEsEditableEnVenta(producto)) {
    if (!nombreVenta) {
      alert('Escribe el nombre del producto');
      const nombreInput = document.getElementById('productoNombreEditable');
      if (nombreInput) nombreInput.focus();
      return;
    }
    if (isNaN(precioVenta) || precioVenta < 0) {
      alert('Escribe un precio válido');
      const precioInput = document.getElementById('productoPrecioEditable');
      if (precioInput) precioInput.focus();
      return;
    }
  }

  // ========================================
  // VERIFICACIÓN DE DISPONIBILIDAD EN INVENTARIO
  // ========================================
  try {
    if (!productoEsEditableEnVenta(producto) && typeof verificarDisponibilidadProducto === 'function') {
      const disponibilidad = verificarDisponibilidadProducto(producto.nombre, cantidad);
      
      if (!disponibilidad.disponible) {
        const mensaje = `Producto no disponible: ${disponibilidad.mensaje}`;
        console.warn(mensaje);
        
        // Determinar el tipo de alerta según el stock
        const esStockCero = disponibilidad.stockActual === 0;
        const claseAlerta = esStockCero ? 'alert-danger' : 'alert-warning';
        const tituloAlerta = esStockCero ? '🚫 Producto Sin Stock' : '⚠️ Producto No Disponible';
        
        // Mostrar alerta al usuario
        const alerta = document.createElement('div');
        alerta.className = `alert ${claseAlerta} alert-dismissible fade show position-fixed`;
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alerta.innerHTML = `
          <strong>${tituloAlerta}</strong>
          <p class="mb-0">${producto.nombre}</p>
          <p class="mb-0 small">${disponibilidad.mensaje}</p>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alerta);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
          if (alerta.parentNode) {
            alerta.remove();
          }
        }, 5000);
        
        return; // No agregar el producto si no está disponible
      }
      
      // Mostrar alerta informativa si el stock está en el mínimo (no bloquea la venta)
      if (disponibilidad.stockEnMinimo) {
        const alertaMinimo = document.createElement('div');
        alertaMinimo.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        alertaMinimo.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alertaMinimo.innerHTML = `
          <strong>⚠️ Stock en Mínimo</strong>
          <p class="mb-0">${producto.nombre}</p>
          <p class="mb-0 small">Stock actual: ${disponibilidad.stockActual} ${producto.unidadMedida || ''} (Mínimo: ${disponibilidad.stockMinimo})</p>
          <p class="mb-0 small text-danger"><strong>¡Se está agotando! Considera reponer.</strong></p>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertaMinimo);
        
        // Auto-remover después de 7 segundos (un poco más que las otras alertas)
        setTimeout(() => {
          if (alertaMinimo.parentNode) {
            alertaMinimo.remove();
          }
        }, 7000);
      }
    }
  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    // Continuar con la venta si hay error en la verificación
  }

  let pedido = normalizarPedidoMesa(pedidoDeMesa(mesaSeleccionada));
  mesasActivas.set(mesaSeleccionada, pedido);

  if (!pedido.items) {
    pedido.items = [];
  }

  const rondaActual = pedido.ronda || 1;
  const esEditable = productoEsEditableEnVenta(producto);

  const productoExistente = esEditable
    ? null
    : pedido.items.find(p => p.id === producto.id && p.estado !== 'en_cocina');

  if (productoExistente) {
    // Verificar disponibilidad para la cantidad adicional
    try {
      if (typeof verificarDisponibilidadProducto === 'function') {
        const disponibilidad = verificarDisponibilidadProducto(producto.nombre, productoExistente.cantidad + cantidad);
        
        if (!disponibilidad.disponible) {
          const mensaje = `Stock insuficiente para agregar más unidades: ${disponibilidad.mensaje}`;
          console.warn(mensaje);
          
          // Determinar el tipo de alerta según el stock
          const esStockCero = disponibilidad.stockActual === 0;
          const claseAlerta = esStockCero ? 'alert-danger' : 'alert-warning';
          const tituloAlerta = esStockCero ? '🚫 Producto Sin Stock' : '⚠️ Stock Insuficiente';
          
          // Mostrar alerta al usuario
          const alerta = document.createElement('div');
          alerta.className = `alert ${claseAlerta} alert-dismissible fade show position-fixed`;
          alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
          alerta.innerHTML = `
            <strong>${tituloAlerta}</strong>
            <p class="mb-0">${producto.nombre}</p>
            <p class="mb-0 small">${disponibilidad.mensaje}</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          `;
          
          document.body.appendChild(alerta);
          
          // Auto-remover después de 5 segundos
          setTimeout(() => {
            if (alerta.parentNode) {
              alerta.remove();
            }
          }, 5000);
          
          return; // No agregar más unidades si no hay stock suficiente
        }
        
        // Mostrar alerta informativa si el stock está en el mínimo (no bloquea la venta)
        if (disponibilidad.stockEnMinimo) {
          const alertaMinimo = document.createElement('div');
          alertaMinimo.className = 'alert alert-warning alert-dismissible fade show position-fixed';
          alertaMinimo.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
          alertaMinimo.innerHTML = `
            <strong>⚠️ Stock en Mínimo</strong>
            <p class="mb-0">${producto.nombre}</p>
            <p class="mb-0 small">Stock actual: ${disponibilidad.stockActual} ${producto.unidadMedida || ''} (Mínimo: ${disponibilidad.stockMinimo})</p>
            <p class="mb-0 small text-danger"><strong>¡Se está agotando! Considera reponer.</strong></p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          `;
          
          document.body.appendChild(alertaMinimo);
          
          // Auto-remover después de 7 segundos
          setTimeout(() => {
            if (alertaMinimo.parentNode) {
              alertaMinimo.remove();
            }
          }, 7000);
        }
      }
    } catch (error) {
      console.error('Error al verificar disponibilidad para cantidad adicional:', error);
    }
    
    productoExistente.cantidad += cantidad;
    // Si hay detalles, agregarlos al producto existente
    if (detalles && !productoExistente.detalles) {
      productoExistente.detalles = detalles;
    } else if (detalles && productoExistente.detalles) {
      productoExistente.detalles += '; ' + detalles;
    }
  } else {
    pedido.items.push({
      id: producto.id,
      nombre: nombreVenta,
      precio: Number(precioVenta),
      cantidad: cantidad,
      detalles: detalles,
      estado: 'pendiente',
      ronda: rondaActual
    });
  }

  console.log('Producto agregado:', producto, 'Cantidad:', cantidad, 'Detalles:', detalles);
  console.log('Orden actual:', pedido);
  
  // Cerrar el modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalCantidad'));
  modal.hide();
  
  // Limpiar la variable global
  window.productoSeleccionado = null;
  
  guardarMesas(true);
  actualizarVistaOrden(mesaSeleccionada);
  
  // Mostrar confirmación visual
  mostrarConfirmacionAgregado(nombreVenta, cantidad);
}

// Función para mostrar confirmación visual de producto agregado
function mostrarConfirmacionAgregado(nombreProducto, cantidad) {
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>✅ Producto Agregado</strong>
    <p class="mb-0">${nombreProducto}</p>
    <p class="mb-0 small">Cantidad: ${cantidad}</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 3 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 3000);
}

// Event listeners para el modal de cantidad
document.addEventListener('DOMContentLoaded', function() {
  // Event listener para el input de cantidad
  const cantidadInput = document.getElementById('cantidadProducto');
  if (cantidadInput) {
    cantidadInput.addEventListener('input', actualizarTotalModal);
    cantidadInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        confirmarAgregarProducto();
      }
    });
  }

  const precioEditableInput = document.getElementById('productoPrecioEditable');
  if (precioEditableInput) {
    precioEditableInput.addEventListener('input', actualizarTotalModal);
    precioEditableInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        confirmarAgregarProducto();
      }
    });
  }

  const nombreEditableInput = document.getElementById('productoNombreEditable');
  if (nombreEditableInput) {
    nombreEditableInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const precioInput = document.getElementById('productoPrecioEditable');
        if (precioInput) precioInput.focus();
      }
    });
  }
  
  // Event listener para el textarea de detalles
  const detallesInput = document.getElementById('detallesProducto');
  if (detallesInput) {
    detallesInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) {
        confirmarAgregarProducto();
      }
    });
  }
  
  // Event listeners para el modal de venta rápida
  const metodoPagoSelect = document.getElementById('metodoPagoVentaRapida');
  if (metodoPagoSelect) {
    metodoPagoSelect.addEventListener('change', function() {
      const seccionEfectivo = document.getElementById('seccionEfectivoVentaRapida');
      if (this.value === 'efectivo') {
        seccionEfectivo.style.display = 'block';
      } else {
        seccionEfectivo.style.display = 'none';
      }
    });
  }
  
  // Event listener para Enter en monto recibido
  const montoRecibidoInput = document.getElementById('montoRecibidoVentaRapida');
  if (montoRecibidoInput) {
    montoRecibidoInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        confirmarVentaRapida();
      }
    });
  }
});

function esPedidoDomicilioId(mesa) {
  return typeof mesa === 'string' && mesa.startsWith('DOM-');
}

function obtenerValorDomicilioPedido(mesa, pedido) {
  if (!esPedidoDomicilioId(mesa)) return 0;
  const desdeInput = parseFloat(document.getElementById('valorDomicilio')?.value);
  if (Number.isFinite(desdeInput) && desdeInput > 0) return desdeInput;
  const desdePedido = parseFloat(pedido && pedido.valorDomicilio);
  return Number.isFinite(desdePedido) && desdePedido > 0 ? desdePedido : 0;
}

function obtenerNombreDomiciliarioPedido(mesa, pedido) {
  if (!esPedidoDomicilioId(mesa)) return '';
  const desdeInput = (document.getElementById('nombreDomiciliario')?.value || '').trim();
  if (desdeInput) return desdeInput;
  return ((pedido && pedido.nombreDomiciliario) || '').trim();
}

function aplicarCamposDomicilioEnVista(mesa, pedido) {
  const container = document.getElementById('domicilioContainer');
  const inputValor = document.getElementById('valorDomicilio');
  const inputNombre = document.getElementById('nombreDomiciliario');
  if (!container || !inputValor) return;

  if (esPedidoDomicilioId(mesa)) {
    const valorEnInput = parseFloat(inputValor.value);
    if (Number.isFinite(valorEnInput) && valorEnInput > 0) {
      pedido.valorDomicilio = valorEnInput;
    }
    if (inputNombre && inputNombre.value.trim()) {
      pedido.nombreDomiciliario = inputNombre.value.trim();
    }

    container.style.display = 'block';
    container.classList.add('domicilio-activo');

    const valor = obtenerValorDomicilioPedido(mesa, pedido);
    inputValor.value = valor > 0 ? valor : (inputValor.value || '');
    if (inputNombre) {
      inputNombre.value = obtenerNombreDomiciliarioPedido(mesa, pedido) || inputNombre.value || '';
    }
  } else {
    container.style.display = 'none';
    container.classList.remove('domicilio-activo');
    inputValor.value = '';
    if (inputNombre) inputNombre.value = '';
  }
}

// Función para actualizar la vista de la orden
function actualizarVistaOrden(mesa) {
  console.log('Actualizando vista de orden para mesa:', mesa);
  const ordenCuerpo = document.getElementById('ordenCuerpo');
  if (!ordenCuerpo) return;
  if (hayEdicionOrdenActiva() && String(mesa) === String(mesaSeleccionada)) return;
  ordenCuerpo.innerHTML = '';

  if (!mesasActivas.has(mesa)) {
    console.log('No hay orden para la mesa:', mesa);
    return;
  }

  const pedido = normalizarPedidoMesa(mesasActivas.get(mesa));
  mesasActivas.set(mesa, pedido);
  console.log('Orden de la mesa:', pedido);

  // Mostrar/ocultar y conservar valor de domicilio (no se borra al agregar platos)
  aplicarCamposDomicilioEnVista(mesa, pedido);

  // Actualizar el título de la orden con el nombre del cliente si es domicilio o recoger
  const mesaActual = document.getElementById('mesaActual');
  if (mesa.startsWith('DOM-')) {
    const cliente = pedido.cliente || 'Cliente no especificado';
    mesaActual.textContent = `Domicilio - ${cliente}`;
  } else if (mesa.startsWith('REC-')) {
    const cliente = pedido.cliente || 'Cliente no especificado';
    mesaActual.textContent = `Recoger - ${cliente}`;
  } else {
    mesaActual.textContent = mesa;
  }

  if (!pedido.items || pedido.items.length === 0) {
    ordenCuerpo.innerHTML = '<tr><td colspan="6" class="text-center">No hay productos en la orden</td></tr>';
    guardarMesas();
    return;
  }

  // Agrupar productos por ronda
  const productosPorRonda = {};
  pedido.items.forEach(item => {
    const ronda = rondaDeItem(item);
    if (!productosPorRonda[ronda]) {
      productosPorRonda[ronda] = [];
    }
    productosPorRonda[ronda].push(item);
  });

  // Mostrar productos por ronda
  Object.entries(productosPorRonda).forEach(([ronda, items]) => {
    // Agregar encabezado de ronda
    const filaRonda = document.createElement('tr');
    filaRonda.className = 'table-secondary';
    filaRonda.innerHTML = `
      <td colspan="6" class="text-center">
        <strong>Ronda ${ronda}</strong>
        ${items.some(item => item.estado === 'en_cocina') ? 
          '<span class="badge bg-success ms-2">En Cocina</span>' : ''}
      </td>
    `;
    ordenCuerpo.appendChild(filaRonda);

    // Mostrar productos de esta ronda
    items.forEach(item => {
      const rondaItem = rondaDeItem(item);
      const fila = document.createElement('tr');
      fila.className = item.estado === 'en_cocina' ? 'table-success' : '';
      fila.innerHTML = `
        <td style="width: 30%">${item.nombre}</td>
        <td style="width: 12%">
          <div class="input-group input-group-sm">
            <button class="btn btn-outline-light btn-sm px-1" onclick="cambiarCantidad(${item.id}, '${mesa}', -1, ${rondaItem})">-</button>
            <input type='number' class='form-control form-control-sm bg-dark text-white border-light text-center' 
                   value='${item.cantidad}' min='1'
                   style="width: 40px;"
                   onchange='actualizarCantidad(this, ${item.id}, "${mesa}", ${rondaItem})' />
            <button class="btn btn-outline-light btn-sm px-1" onclick="cambiarCantidad(${item.id}, '${mesa}', 1, ${rondaItem})">+</button>
          </div>
        </td>
        <td style="width: 12%">${formatearPrecio(item.precio)}</td>
        <td style="width: 12%">${formatearPrecio(item.precio * item.cantidad)}</td>
        <td class="celda-detalles-orden" style="width: 31%"></td>
        <td style="width: 3%">
          <button class='btn btn-danger btn-sm' onclick='eliminarProductoOrden(this, "${mesa}", ${item.id}, ${rondaItem})'>
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      const inputDetalles = document.createElement('input');
      inputDetalles.type = 'text';
      inputDetalles.className = 'form-control form-control-sm bg-dark text-white border-light input-detalles-orden';
      inputDetalles.value = item.detalles || '';
      inputDetalles.placeholder = 'Ej: Sin lechuga, sin salsa...';
      inputDetalles.title = 'Haz clic para modificar los detalles';
      inputDetalles.autocomplete = 'off';
      inputDetalles.addEventListener('input', function () {
        actualizarDetalles(this, item.id, mesa, rondaItem);
      });
      inputDetalles.addEventListener('change', function () {
        actualizarDetalles(this, item.id, mesa, rondaItem);
      });
      fila.querySelector('.celda-detalles-orden').appendChild(inputDetalles);
      ordenCuerpo.appendChild(fila);
    });
  });

  actualizarTotal(mesa);
}

// Función para cambiar cantidad con botones + y -
function cambiarCantidad(id, mesa, cambio, ronda) {
  const pedido = mesasActivas.get(mesa);
  if (!pedido || !pedido.items) return;

  const producto = encontrarItemPedido(pedido, id, ronda);
  if (producto) {
    const nuevaCantidad = producto.cantidad + cambio;
    if (nuevaCantidad >= 1) {
      producto.cantidad = nuevaCantidad;
      guardarMesas();
      actualizarVistaOrden(mesa);
    }
  }
}

// Función para actualizar cantidad
function actualizarCantidad(input, id, mesa, ronda) {
  const cantidad = parseInt(input.value);
  if (isNaN(cantidad) || cantidad < 1) {
    input.value = 1;
    return;
  }

  const pedido = mesasActivas.get(mesa);
  if (!pedido || !pedido.items) return;

  const producto = encontrarItemPedido(pedido, id, ronda);
  if (producto) {
    producto.cantidad = cantidad;
    guardarMesas();
    actualizarVistaOrden(mesa);
  }
}

// Función para actualizar detalles del producto
function actualizarDetalles(input, id, mesa, ronda) {
  const detalles = String((input && input.value) || '').trim();
  const pedido = mesasActivas.get(mesa);
  
  if (!pedido || !pedido.items) return;
  
  const producto = encontrarItemPedido(pedido, id, ronda);
  if (producto) {
    producto.detalles = detalles;
    guardarMesas();
  }
}

// Función para eliminar producto de la orden
function eliminarProductoOrden(boton, mesa, id, ronda) {
  const pedido = mesasActivas.get(mesa);
  
  if (!pedido || !pedido.items) return;

  let index = -1;
  if (id != null) {
    const rondaNum = ronda == null || ronda === '' ? null : Number(ronda);
    index = pedido.items.findIndex(p =>
      p.id === id && (rondaNum == null || !Number.isFinite(rondaNum) || rondaDeItem(p) === rondaNum)
    );
  }
  if (index === -1 && boton) {
    const fila = boton.closest('tr');
    const nombreProducto = fila && fila.cells[0] ? fila.cells[0].textContent : '';
    index = pedido.items.findIndex(p => p.nombre === nombreProducto);
  }
  if (index !== -1) {
    pedido.items.splice(index, 1);
    sincronizarRondaPedido(pedido);
    guardarMesas();
    actualizarVistaOrden(mesa);
  }
}

// Función para actualizar el total
function actualizarTotal(mesa) {
  if (!mesasActivas.has(mesa)) return;

  const pedido = mesasActivas.get(mesa);
  if (!pedido || !pedido.items) return;

  let subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = obtenerValorDomicilioPedido(mesa, pedido);
  const nombreDomiciliario = obtenerNombreDomiciliarioPedido(mesa, pedido);
  
  pedido.propina = propina;
  pedido.descuento = descuento;
  pedido.valorDomicilio = valorDomicilio;
  pedido.nombreDomiciliario = nombreDomiciliario;
  
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);
  
  document.getElementById('totalOrden').textContent = formatearPrecio(total);
  
  const desglose = document.getElementById('desgloseTotal');
  if (desglose) {
    desglose.innerHTML = `
      <div class="small text-muted">
        <div>Subtotal: ${formatearPrecio(subtotal)}</div>
        <div>Propina (${propina}%): ${formatearPrecio(propinaMonto)}</div>
        <div>Descuento: ${formatearPrecio(descuento)}</div>
        ${valorDomicilio > 0 ? `<div>Domicilio: ${formatearPrecio(valorDomicilio)}</div>` : ''}
      </div>
    `;
  }
  
  guardarMesas();
}

// Función para enviar a cocina
function enviarACocina() {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = normalizarPedidoMesa(pedidoDeMesa(mesaSeleccionada));
  mesasActivas.set(mesaSeleccionada, pedido);
  if (!pedido.items || pedido.items.length === 0) {
    alert('No hay productos para enviar a cocina');
    return;
  }

  // Filtrar solo los productos que no han sido enviados a cocina
  const productosNuevos = pedido.items.filter(item => item.estado !== 'en_cocina');
  
  if (productosNuevos.length === 0) {
    alert('No hay nuevos productos para enviar a cocina');
    return;
  }

  const rondaEnviada = rondaDeProductos(productosNuevos, pedido.ronda);

  // Marcar productos nuevos como enviados a cocina
  productosNuevos.forEach(item => {
    item.estado = 'en_cocina';
    if (item.ronda == null) item.ronda = rondaEnviada;
  });

  // Acumular rondas en cocina (no reemplazar la ronda anterior)
  acumularOrdenesCocina(mesaSeleccionada, productosNuevos);
  
  // Agregar al historial de cocina
  const ordenCocina = {
    id: Date.now(),
    fecha: new Date().toISOString(), // Guardar en formato ISO para mejor compatibilidad
    fechaMostrar: new Date().toLocaleString(), // Fecha formateada para mostrar
    mesa: mesaSeleccionada,
    items: productosNuevos,
    cliente: pedido.cliente || null,
    telefono: pedido.telefono || null,
    direccion: pedido.direccion || null,
    horaRecoger: pedido.horaRecoger || null,
    ronda: rondaEnviada,
    sesionId: pedido.sesionId || null
  };
  
  historialCocina.push(ordenCocina);
  guardarHistorialCocina();
  sincronizarRondaPedido(pedido);
  guardarMesas();

  // Actualizar la vista de la orden para mostrar el estado "En Cocina"
  actualizarVistaOrden(mesaSeleccionada);
  
  // Mostrar confirmación de que se envió a cocina
  mostrarConfirmacionEnviadoACocina(productosNuevos.length);
  
  // Mostrar inmediatamente la vista previa del ticket de cocina para imprimir
  imprimirTicketCocina(mesaSeleccionada, productosNuevos, { ronda: rondaEnviada });
  
  // Actualizar panel flotante de cocina
  actualizarPanelCocina();
  actualizarBadgeCocina();
}

// Función para mostrar confirmación de productos enviados a cocina
function mostrarConfirmacionEnviadoACocina(cantidadProductos) {
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>✅ Enviado a Cocina</strong>
    <p class="mb-0">${cantidadProductos} producto${cantidadProductos > 1 ? 's' : ''} enviado${cantidadProductos > 1 ? 's' : ''} a cocina</p>
    <p class="mb-0 small">Los productos ahora aparecen como "En Cocina"</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 4 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 4000);
}

function etiquetaIdentificadorPedido(id) {
  const m = String(id || '');
  if (m.startsWith('DOM-')) return `Domicilio ${m.replace(/^DOM-/, '')}`;
  if (m.startsWith('REC-')) return `Recoger ${m.replace(/^REC-/, '')}`;
  return `Mesa ${m}`;
}

function esCambioEntreTiposPedido(cambio) {
  if (!cambio) return false;
  if (cambio.tipoCambio === 'canal') return true;
  const o = String(cambio.origen || '');
  const d = String(cambio.destino || '');
  return (o.startsWith('DOM-') || o.startsWith('REC-')) && (d.startsWith('DOM-') || d.startsWith('REC-'));
}

function textoBloqueCambioPedido(cambio) {
  if (!cambio) return { titulo: '', linea: '' };
  if (esCambioEntreTiposPedido(cambio)) {
    return {
      titulo: 'CAMBIO DE TIPO',
      linea: `${etiquetaIdentificadorPedido(cambio.origen)} → ${etiquetaIdentificadorPedido(cambio.destino)}`
    };
  }
  return {
    titulo: 'CAMBIO DE MESA',
    linea: `Mesa ${cambio.origen} → Mesa ${cambio.destino}`
  };
}

function htmlBloqueCambioPedidoRecibo(cambio) {
  if (!cambio) return '';
  const info = textoBloqueCambioPedido(cambio);
  return `
      <div class="border-top" style="border-top: 2px solid #ff6b00; padding-top: 2mm; margin-top: 2mm; background: #fff3e0;">
        <div class="mb-1" style="text-align: center;">
          <strong style="color: #ff6b00; font-size: 14px;">${info.titulo}</strong>
        </div>
        <div class="mb-1" style="text-align: center; font-size: 13px;">
          ${info.linea}
        </div>
        <div class="mb-1" style="text-align: center; font-size: 11px; color: #666;">
          Fecha del cambio: ${cambio.fecha}
        </div>
      </div>
    `;
}

function actualizarBotonCambioPedido() {
  const btn = document.getElementById('btnCambioPedido');
  if (!btn) return;
  const id = mesaSeleccionada ? String(mesaSeleccionada) : '';
  if (id.startsWith('DOM-')) {
    btn.innerHTML = '<i class="fas fa-shopping-bag"></i> Pasar a Recoger';
    btn.onclick = () => mostrarModalCambioTipoPedido('recoger');
  } else if (id.startsWith('REC-')) {
    btn.innerHTML = '<i class="fas fa-motorcycle"></i> Pasar a Domicilio';
    btn.onclick = () => mostrarModalCambioTipoPedido('domicilio');
  } else {
    btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Cambio de Mesa';
    btn.onclick = () => mostrarModalCambioMesa();
  }
}

function reubicarClavePedido(mesaOrigen, mesaDestino, pedidoOrigen) {
  mesasActivas.set(mesaDestino, pedidoOrigen);
  mesasActivas.delete(mesaOrigen);

  if (ordenesCocina.has(mesaOrigen)) {
    const productosEnCocinaMapa = ordenesCocina.get(mesaOrigen) || [];
    ordenesCocina.delete(mesaOrigen);
    acumularOrdenesCocina(mesaDestino, productosEnCocinaMapa);
  }

  const productosEnCocina = (pedidoOrigen.items || []).filter(item => item.estado === 'en_cocina');
  const pedidosListosIds = obtenerIdsPedidosListos();
  historialCocina = historialCocina.filter(pedido => {
    if (pedido.mesa === mesaOrigen && !pedidosListosIds.includes(pedido.id)) {
      return false;
    }
    return true;
  });

  const fechaCambio = (pedidoOrigen.cambioMesa && pedidoOrigen.cambioMesa.fecha) || new Date().toLocaleString();
  if (productosEnCocina.length > 0) {
    historialCocina.push({
      id: Date.now(),
      fecha: new Date().toISOString(),
      fechaMostrar: fechaCambio,
      mesa: mesaDestino,
      items: productosEnCocina,
      cliente: pedidoOrigen.cliente || null,
      telefono: pedidoOrigen.telefono || null,
      direccion: pedidoOrigen.tipo === 'domicilio' ? (pedidoOrigen.direccion || null) : null,
      horaRecoger: pedidoOrigen.tipo === 'recoger' ? (pedidoOrigen.horaRecoger || null) : null,
      ronda: rondaDeProductos(productosEnCocina, 1),
      sesionId: pedidoOrigen.sesionId || null,
      cambioMesa: pedidoOrigen.cambioMesa
    });
  }

  guardarHistorialCocina();
  guardarMesas();
  actualizarPanelCocina();
  actualizarBadgeCocina();
  mesaSeleccionada = mesaDestino;
  seleccionarMesa(mesaDestino);
  return productosEnCocina;
}

function mostrarToastCambioPedido(titulo, mensaje, extra) {
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-info alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>${titulo}</strong>
    <p class="mb-0">${mensaje}</p>
    ${extra ? `<p class="mb-0 small">${extra}</p>` : ''}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(confirmacion);
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) confirmacion.remove();
      }, 500);
    }
  }, 5000);
}

// Función para mostrar el modal de cambio de mesa
function mostrarModalCambioMesa() {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = pedidoDeMesa(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos para cambiar de mesa');
    return;
  }

  // En domicilio / recoger el mismo botón cambia el tipo de pedido
  if (mesaSeleccionada.startsWith('DOM-')) {
    mostrarModalCambioTipoPedido('recoger');
    return;
  }
  if (mesaSeleccionada.startsWith('REC-')) {
    mostrarModalCambioTipoPedido('domicilio');
    return;
  }

  // Llenar el campo de mesa origen
  document.getElementById('mesaOrigen').value = mesaSeleccionada;
  document.getElementById('mesaDestino').value = '';

  // Mostrar el modal
  abrirModalEstatico('modalCambioMesa');

  // Enfocar el campo de mesa destino
  setTimeout(() => {
    document.getElementById('mesaDestino').focus();
  }, 500);
}

function mostrarModalCambioTipoPedido(tipoDestino) {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Por favor, seleccione un domicilio o un pedido para recoger');
    return;
  }

  const pedido = pedidoDeMesa(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos en este pedido');
    return;
  }

  const origen = String(mesaSeleccionada);
  const esDom = origen.startsWith('DOM-');
  const esRec = origen.startsWith('REC-');
  if (!esDom && !esRec) {
    mostrarModalCambioMesa();
    return;
  }

  if (esDom && tipoDestino !== 'recoger') tipoDestino = 'recoger';
  if (esRec && tipoDestino !== 'domicilio') tipoDestino = 'domicilio';

  const inputTipo = document.getElementById('tipoPedidoDestinoCambio');
  const inputOrigen = document.getElementById('pedidoOrigenCambioTipo');
  const inputDestino = document.getElementById('pedidoDestinoCambioTipo');
  const contenedorDir = document.getElementById('contenedorDireccionCambioTipo');
  const inputDir = document.getElementById('direccionCambioTipo');
  const nota = document.getElementById('notaCambioTipo');
  const titulo = document.getElementById('modalCambioTipoPedidoLabel');

  if (!inputTipo || !inputOrigen) {
    alert('No se encontró el formulario de cambio de tipo');
    return;
  }

  inputTipo.value = tipoDestino;
  const clienteTxt = pedido.cliente ? ` · ${pedido.cliente}` : '';
  inputOrigen.value = `${etiquetaIdentificadorPedido(origen)}${clienteTxt}`;
  inputDestino.value = tipoDestino === 'recoger' ? 'Pedido para recoger' : 'Pedido a domicilio';

  if (titulo) {
    titulo.innerHTML = tipoDestino === 'recoger'
      ? '<i class="fas fa-shopping-bag"></i> Pasar a Recoger'
      : '<i class="fas fa-motorcycle"></i> Pasar a Domicilio';
  }

  if (tipoDestino === 'domicilio') {
    if (contenedorDir) contenedorDir.style.display = 'block';
    if (inputDir) inputDir.value = pedido.direccion || '';
    if (nota) nota.textContent = 'Quedará como domicilio. Puede indicar o corregir la dirección.';
  } else {
    if (contenedorDir) contenedorDir.style.display = 'none';
    if (inputDir) inputDir.value = '';
    if (nota) nota.textContent = 'Se quitará el valor de domicilio. El cliente y el teléfono se conservan.';
  }

  abrirModalEstatico('modalCambioTipoPedido');
}

function procesarCambioTipoPedido() {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Error: no hay un pedido seleccionado');
    return;
  }

  const mesaOrigen = mesaSeleccionada;
  const pedidoOrigen = normalizarPedidoMesa(mesasActivas.get(mesaOrigen));
  mesasActivas.set(mesaOrigen, pedidoOrigen);

  if (!pedidoOrigen.items || pedidoOrigen.items.length === 0) {
    alert('Error: no hay productos en el pedido');
    return;
  }

  const tipoDestino = (document.getElementById('tipoPedidoDestinoCambio') || {}).value;
  if (tipoDestino !== 'domicilio' && tipoDestino !== 'recoger') {
    alert('No se pudo determinar el tipo destino');
    return;
  }

  const origenEsDom = String(mesaOrigen).startsWith('DOM-');
  const origenEsRec = String(mesaOrigen).startsWith('REC-');
  if (origenEsDom && tipoDestino === 'domicilio') {
    alert('Este pedido ya es un domicilio');
    return;
  }
  if (origenEsRec && tipoDestino === 'recoger') {
    alert('Este pedido ya es para recoger');
    return;
  }

  let nuevoId = '';
  if (tipoDestino === 'recoger') {
    contadorRecoger++;
    guardarContadores();
    nuevoId = `REC-${contadorRecoger}`;
    pedidoOrigen.tipo = 'recoger';
    pedidoOrigen.numero = contadorRecoger;
    pedidoOrigen.valorDomicilio = 0;
    pedidoOrigen.nombreDomiciliario = '';
    const valorDomInput = document.getElementById('valorDomicilio');
    const nombreDomInput = document.getElementById('nombreDomiciliario');
    if (valorDomInput) valorDomInput.value = '';
    if (nombreDomInput) nombreDomInput.value = '';
  } else {
    const direccion = (document.getElementById('direccionCambioTipo') || {}).value;
    const direccionFinal = (direccion || pedidoOrigen.direccion || '').trim();
    if (!direccionFinal) {
      alert('Ingrese la dirección del domicilio');
      const inputDir = document.getElementById('direccionCambioTipo');
      if (inputDir) inputDir.focus();
      return;
    }
    contadorDomicilios++;
    guardarContadores();
    nuevoId = `DOM-${contadorDomicilios}`;
    pedidoOrigen.tipo = 'domicilio';
    pedidoOrigen.numero = contadorDomicilios;
    pedidoOrigen.direccion = direccionFinal;
  }

  const fechaCambio = new Date().toLocaleString();
  pedidoOrigen.cambioMesa = {
    origen: mesaOrigen,
    destino: nuevoId,
    fecha: fechaCambio,
    tipoCambio: 'canal'
  };

  const productosEnCocina = reubicarClavePedido(mesaOrigen, nuevoId, pedidoOrigen);

  const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambioTipoPedido'));
  if (modal) modal.hide();

  if (productosEnCocina.length > 0) {
    imprimirTicketCocina(nuevoId, productosEnCocina);
  }

  const info = textoBloqueCambioPedido(pedidoOrigen.cambioMesa);
  mostrarToastCambioPedido(
    'Cambio realizado',
    info.linea,
    productosEnCocina.length > 0
      ? 'Se imprimió un nuevo ticket de cocina'
      : 'El pedido se actualizó en caja'
  );
}

// Función para procesar el cambio de mesa
function procesarCambioMesa() {
  const mesaOrigen = document.getElementById('mesaOrigen').value.trim();
  const mesaDestino = document.getElementById('mesaDestino').value.trim();

  // Validaciones
  if (!mesaOrigen) {
    alert('Error: No se pudo determinar la mesa origen');
    return;
  }

  if (!mesaDestino) {
    alert('Por favor, ingrese el número de la mesa destino');
    document.getElementById('mesaDestino').focus();
    return;
  }

  if (mesaOrigen === mesaDestino) {
    alert('La mesa destino debe ser diferente a la mesa origen');
    document.getElementById('mesaDestino').focus();
    return;
  }

  // Verificar que la mesa origen tenga un pedido
  if (!mesasActivas.has(mesaOrigen)) {
    alert('Error: No se encontró el pedido en la mesa origen');
    return;
  }

  // Verificar que la mesa destino no tenga un pedido activo (o permitir fusionar)
  const pedidoOrigen = mesasActivas.get(mesaOrigen);
  
  if (!pedidoOrigen || !pedidoOrigen.items || pedidoOrigen.items.length === 0) {
    alert('Error: No hay productos en la mesa origen');
    return;
  }

  // Obtener la fecha y hora del cambio
  const fechaCambio = new Date().toLocaleString();

  // Guardar información del cambio en el pedido
  pedidoOrigen.cambioMesa = {
    origen: mesaOrigen,
    destino: mesaDestino,
    fecha: fechaCambio
  };

  // Si la mesa destino ya tiene un pedido, fusionar los items
  if (mesasActivas.has(mesaDestino)) {
    const pedidoDestino = normalizarPedidoMesa(mesasActivas.get(mesaDestino));
    mesasActivas.set(mesaDestino, pedidoDestino);
    // Fusionar items
    pedidoDestino.items = [...(pedidoDestino.items || []), ...pedidoOrigen.items];
    // Mantener información del cambio
    pedidoDestino.cambioMesa = pedidoOrigen.cambioMesa;
    sincronizarRondaPedido(pedidoDestino);
    // Actualizar otros campos si es necesario
    if (pedidoOrigen.cliente && !pedidoDestino.cliente) {
      pedidoDestino.cliente = pedidoOrigen.cliente;
      pedidoDestino.telefono = pedidoOrigen.telefono;
      pedidoDestino.direccion = pedidoOrigen.direccion;
    }
  } else {
    // Mover el pedido completo a la nueva mesa
    mesasActivas.set(mesaDestino, pedidoOrigen);
  }

  // Eliminar el pedido de la mesa origen
  mesasActivas.delete(mesaOrigen);

  // Actualizar ordenesCocina si hay productos en cocina
  if (ordenesCocina.has(mesaOrigen)) {
    const productosEnCocinaMapa = ordenesCocina.get(mesaOrigen) || [];
    ordenesCocina.delete(mesaOrigen);
    acumularOrdenesCocina(mesaDestino, productosEnCocinaMapa);
  }

  // Actualizar historial de cocina para productos que ya estaban en cocina
  const productosEnCocina = pedidoOrigen.items.filter(item => item.estado === 'en_cocina');
  
  // Obtener IDs de pedidos listos para no eliminar pedidos ya marcados como listos
  const pedidosListosIds = obtenerIdsPedidosListos();
  
  // Eliminar del historial de cocina todos los pedidos pendientes de la mesa origen
  // (solo los que NO están marcados como listos)
  historialCocina = historialCocina.filter(pedido => {
    // Si el pedido es de la mesa origen y NO está marcado como listo, eliminarlo
    if (pedido.mesa === mesaOrigen && !pedidosListosIds.includes(pedido.id)) {
      return false; // Eliminar este pedido
    }
    return true; // Mantener este pedido
  });
  
  if (productosEnCocina.length > 0) {
    // Crear un nuevo ticket de cocina con la información del cambio
    const ordenCocinaCambio = {
      id: Date.now(),
      fecha: new Date().toISOString(), // Guardar en formato ISO
      fechaMostrar: fechaCambio, // Fecha formateada para mostrar
      mesa: mesaDestino,
      items: productosEnCocina,
      cliente: pedidoOrigen.cliente || null,
      telefono: pedidoOrigen.telefono || null,
      direccion: pedidoOrigen.direccion || null,
      horaRecoger: pedidoOrigen.horaRecoger || null,
      ronda: rondaDeProductos(productosEnCocina, 1),
      sesionId: pedidoOrigen.sesionId || null,
      cambioMesa: {
        origen: mesaOrigen,
        destino: mesaDestino,
        fecha: fechaCambio
      }
    };
    
    historialCocina.push(ordenCocinaCambio);
  }
  
  // Guardar el historial actualizado
  guardarHistorialCocina();

  // Guardar cambios
  guardarMesas();

  // Actualizar panel flotante y badge de cocina después del cambio
  actualizarPanelCocina();
  actualizarBadgeCocina();

  // Cambiar la mesa seleccionada a la nueva mesa
  mesaSeleccionada = mesaDestino;
  seleccionarMesa(mesaDestino);

  // Cerrar el modal
  bootstrap.Modal.getInstance(document.getElementById('modalCambioMesa')).hide();

  // Imprimir nuevo ticket de cocina con la información del cambio
  if (productosEnCocina.length > 0) {
    imprimirTicketCocina(mesaDestino, productosEnCocina);
  }

  // Mostrar confirmación
  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-info alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>✅ Cambio de Mesa Realizado</strong>
    <p class="mb-0">Pedido movido de Mesa ${mesaOrigen} a Mesa ${mesaDestino}</p>
    ${productosEnCocina.length > 0 ? 
      `<p class="mb-0 small">Se imprimió un nuevo ticket de cocina con la información del cambio</p>` : 
      `<p class="mb-0 small">El pedido ha sido movido exitosamente</p>`
    }
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 5 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 5000);
}

// Función para venta rápida (productos listos)
function ventaRapida() {
  // Crear un pedido temporal para venta rápida sin mesa
  let pedido = {
    items: [],
    cliente: null,
    telefono: null,
    direccion: null,
    horaRecoger: null,
    tipo: 'venta_rapida'
  };

  // Mostrar modal para agregar productos directamente
  mostrarModalAgregarProductosVentaRapida(pedido);
}

// Función para procesar venta rápida (eliminada - duplicada)
// La función correcta está más adelante en el código

// Función para mostrar recibo de venta rápida
// ventanaExistente: reutiliza la del ticket de cocina (evita bloqueo de popups)
function mostrarReciboVentaRapida(venta, ventanaExistente) {
  console.log('🔍 DEBUG RECIBO VENTA RÁPIDA:');
  console.log('   - Venta recibida:', venta);
  console.log('   - Items:', venta.items);
  console.log('   - Cantidad de items:', venta.items ? venta.items.length : 'undefined');

  let ventanaRecibo = null;
  try {
    if (ventanaExistente && !ventanaExistente.closed) {
      ventanaRecibo = ventanaExistente;
    }
  } catch (e) {
    ventanaRecibo = null;
  }

  if (!ventanaRecibo) {
    ventanaRecibo = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  }

  if (!ventanaRecibo) {
    ofrecerAbrirReciboVentaRapida(venta);
    return;
  }

  const canal = typeof obtenerCanalVentaRapida === 'function' ? obtenerCanalVentaRapida(venta) : (venta.canal || null);
  const subtotal = venta.subtotal != null
    ? venta.subtotal
    : (venta.items || []).reduce((sum, item) => sum + ((item.precio || 0) * (item.cantidad || 0)), 0);
  const propina = venta.propina || 0;
  const descuento = venta.descuento || 0;
  const valorDomicilio = venta.valorDomicilio || 0;
  const propinaMonto = venta.propinaMonto != null
    ? venta.propinaMonto
    : Math.round((subtotal * propina) / 100);
  const total = venta.total != null ? venta.total : Math.round(subtotal + propinaMonto - descuento + valorDomicilio);
  const metodoPago = (venta.metodoPago || 'efectivo').toLowerCase();
  const logoNegocio = localStorage.getItem('logoNegocio');

  let tipoPedido = '';
  let infoAdicional = '';
  let lineaMesa = '';

  if (canal === 'domicilio') {
    tipoPedido = 'Pedido a Domicilio';
    if (venta.cliente || venta.direccion || venta.telefono) {
      infoAdicional = `
        <div class="border-top">
          ${venta.cliente ? `<div class="mb-1"><strong>Cliente:</strong> <strong>${venta.cliente}</strong></div>` : ''}
          ${venta.direccion ? `<div class="mb-1"><strong>Dir:</strong> <strong>${venta.direccion}</strong></div>` : ''}
          ${venta.telefono ? `<div class="mb-1"><strong>Tel:</strong> <strong>${venta.telefono}</strong></div>` : ''}
        </div>
      `;
    }
  } else if (canal === 'recoger') {
    tipoPedido = 'Pedido para Recoger';
    if (venta.cliente || venta.telefono || venta.horaRecoger) {
      infoAdicional = `
        <div class="border-top">
          ${venta.cliente ? `<div class="mb-1"><strong>Cliente:</strong> <strong>${venta.cliente}</strong></div>` : ''}
          ${venta.telefono ? `<div class="mb-1"><strong>Tel:</strong> <strong>${venta.telefono || 'No especificado'}</strong></div>` : ''}
          ${venta.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${venta.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  } else if (canal === 'mesa' && venta.numeroMesa) {
    lineaMesa = `<div class="mb-1">Mesa: ${venta.numeroMesa}</div>`;
  }

  const items = venta.items || [];
  // Contenido alineado con recibo de venta normal (procesarPago)
  const contenidoRecibo = `
    <div class="logo-container">
      ${logoNegocio ? `<img src="${logoNegocio}" alt="Logo">` : ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date(venta.fecha || Date.now()).toLocaleString()}</div>
      ${lineaMesa}
    </div>
    
    ${infoAdicional}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.length > 0 ? items.map(item => `
          <tr>
            <td>${item.nombre || 'Producto'}</td>
            <td>${item.cantidad || 0}</td>
            <td style="text-align:right;">${formatearNumero(item.precio || 0)}</td>
            <td style="text-align:right;">${formatearNumero((item.precio || 0) * (item.cantidad || 0))}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="4" class="text-center">No hay productos en esta venta</td>
          </tr>
        `}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(subtotal)}</span></div>
      <div class="mb-1">Propina (${propina}%): <span class="text-right">$ ${formatearNumero(propinaMonto)}</span></div>
      <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(descuento)}</span></div>
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>${(venta.nombreDomiciliario || '').trim() ? `<div class="mb-1">Domiciliario: ${venta.nombreDomiciliario}</div>` : ''}` : ''}
      <div class="mb-1 total-row"><strong>Total: $ ${formatearNumero(total)}</strong></div>
    </div>
    
    <div class="border-top">
      <div class="mb-1">Método de Pago: ${metodoPago}</div>
      ${metodoPago === 'efectivo' || metodoPago === 'mixto' ? `
        <div class="mb-1">Recibido en Efectivo: $ ${formatearNumero(venta.montoRecibido || 0)}</div>
        <div class="mb-1">Cambio: $ ${formatearNumero(venta.cambio || 0)}</div>
      ` : ''}
      ${metodoPago === 'transferencia' ? `
        <div class="mb-1">N° Transferencia: ${venta.numeroTransferencia || 'N/A'}</div>
        <div class="mb-1">Transferencia: $ ${formatearNumero(venta.montoTransferencia || 0)}</div>
      ` : ''}
      ${metodoPago === 'mixto' ? `
        <div class="mb-1">Monto en Efectivo: $ ${formatearNumero(venta.montoRecibido || 0)}</div>
        <div class="mb-1">Cambio: $ ${formatearNumero(venta.cambio || 0)}</div>
        <div class="mb-1">N° Transferencia: ${venta.numeroTransferencia || 'N/A'}</div>
        <div class="mb-1">Transferencia: $ ${formatearNumero(venta.montoTransferencia || 0)}</div>
      ` : ''}
    </div>
    
    ${htmlPieDatosNegocioTicket()}
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su compra!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  ventanaRecibo.document.open();
  ventanaRecibo.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo de Pago</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
  
  ventanaRecibo.document.close();
  try { ventanaRecibo.focus(); } catch (e) { /* ignore */ }
}

// Si el navegador bloqueó el popup, deja un botón para abrir el recibo con un clic
function ofrecerAbrirReciboVentaRapida(venta) {
  window._ventaReciboPendienteVR = venta;
  const existente = document.getElementById('alertaReciboPendienteVR');
  if (existente) existente.remove();

  const alerta = document.createElement('div');
  alerta.id = 'alertaReciboPendienteVR';
  alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed';
  alerta.style.cssText = 'top: 20px; right: 20px; z-index: 10000; max-width: 420px;';
  alerta.innerHTML = `
    <strong>Recibo del cliente pendiente</strong>
    <p class="mb-2 small">El navegador bloqueó la ventana. Haz clic para abrirlo.</p>
    <button type="button" class="btn btn-sm btn-warning" id="btnAbrirReciboPendienteVR">
      <i class="fas fa-receipt"></i> Abrir recibo del cliente
    </button>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alerta);
  const btn = document.getElementById('btnAbrirReciboPendienteVR');
  if (btn) {
    btn.onclick = function () {
      const v = window._ventaReciboPendienteVR;
      if (v) mostrarReciboVentaRapida(v);
      window._ventaReciboPendienteVR = null;
      alerta.remove();
    };
  }
}

// Función para mostrar modal de agregar productos venta rápida
function mostrarModalAgregarProductosVentaRapida(pedido) {
  // Guardar el pedido en variable global
  window.pedidoVentaRapida = pedido;
  
  // Cargar categorías
  cargarCategoriasVentaRapida();
  
  // Mostrar modal
  const modalEl = document.getElementById('modalAgregarProductosVentaRapida');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false });
  modal.show();
  
  // F1 ayuda: un solo listener (evitar acumulación)
  document.removeEventListener('keydown', mostrarAyudaVentaRapida);
  document.addEventListener('keydown', mostrarAyudaVentaRapida);
  modalEl.addEventListener('hidden.bs.modal', () => {
    document.removeEventListener('keydown', mostrarAyudaVentaRapida);
  }, { once: true });
}

// Función para mostrar ayuda de venta rápida con F1
function mostrarAyudaVentaRapida(event) {
  if (event.key === 'F1') {
    event.preventDefault();
    
    const ayudaHTML = `
      <div class="alert alert-info border-info">
        <div class="d-flex align-items-center mb-2">
          <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="me-2" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(13, 110, 253, 0.4); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); object-fit: cover;">
          <h6 class="mb-0" style="font-family: 'Orbitron', 'Exo 2', 'Rajdhani', 'Roboto Mono', monospace; font-weight: 800; font-size: 1.2rem; color: #0d6efd; letter-spacing: 0.3px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.1; text-align: center;">
            Toy de<br>Ayudas
          </h6>
        </div>
        <ul class="mb-0">
          <li><strong>Venta Directa:</strong> Al tocar el producto entra a la orden; no se abre otra ventana</li>
          <li><strong>Panel derecho:</strong> Ahí cambias cantidad, detalle de cocina y salsas</li>
          <li><strong>Nombre y precio libres:</strong> Si el producto es editable, escríbelos en el panel</li>
          <li><strong>Salsas:</strong> Casillas en el ítem si el producto las tiene en Administración</li>
          <li><strong>Procesar:</strong> Completa la venta; opcional enviar a cocina con esos detalles</li>
        </ul>
        <small class="text-muted">Presiona F1 nuevamente para cerrar esta ayuda</small>
      </div>
    `;
    
    // Mostrar ayuda en el modal
    const modalBody = document.querySelector('#modalAgregarProductosVentaRapida .modal-body');
    const ayudaExistente = modalBody.querySelector('.ayuda-venta-rapida');
    
    if (ayudaExistente) {
      ayudaExistente.remove();
    } else {
      const ayudaDiv = document.createElement('div');
      ayudaDiv.className = 'ayuda-venta-rapida mb-3';
      ayudaDiv.innerHTML = ayudaHTML;
      modalBody.insertBefore(ayudaDiv, modalBody.firstChild);
    }
  }
}

// Función para cargar categorías en venta rápida
function cargarCategoriasVentaRapida() {
  const categoriasContainer = document.getElementById('categoriasVentaRapida');
  categoriasContainer.innerHTML = '';
  
  // Obtener categorías únicas de productos
  const categoriasUnicas = [...new Set(productos.map(p => p.categoria))];
  
  // Agregar botón "Todos los Productos" al principio
  const botonTodos = document.createElement('button');
  botonTodos.className = 'btn btn-success btn-sm fw-bold';
  botonTodos.innerHTML = '<i class="fas fa-th-large me-1"></i>Todos';
  botonTodos.onclick = () => mostrarTodosLosProductosVentaRapida();
  categoriasContainer.appendChild(botonTodos);
  
  // Agregar separador visual
  const separador = document.createElement('hr');
  separador.className = 'my-2 border-info';
  categoriasContainer.appendChild(separador);
  
  // Crear botones para cada categoría
  categoriasUnicas.forEach(categoria => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-info btn-sm';
    btn.textContent = categoria;
    btn.onclick = () => mostrarProductosCategoriaVentaRapida(categoria);
    categoriasContainer.appendChild(btn);
  });
  
  // Mostrar todos los productos por defecto
  mostrarTodosLosProductosVentaRapida();
}

// Función para mostrar todos los productos en venta rápida
function mostrarTodosLosProductosVentaRapida() {
  const productosContainer = document.getElementById('productosVentaRapida');
  productosContainer.innerHTML = '';
  
  // Encabezado removido - solo se muestran los productos directamente
  // const encabezado = document.createElement('div');
  // encabezado.className = 'col-12 mb-3';
  // encabezado.innerHTML = `
  //   <div class="alert alert-success text-center py-2">
  //     <h6 class="mb-1"><i class="fas fa-th-large me-2"></i>Todos los Productos</h6>
  //     <small class="mb-0">Vista completa de ${productos.length} productos disponibles</small>
  //   </div>
  // `;
  // productosContainer.appendChild(encabezado);
  
  // Mostrar todos los productos
  productos.forEach(producto => {
    // Permite rutas relativas (locales) o URLs externas. Si falla, muestra placeholder universal
    const imagenSrc = producto.imagen && producto.imagen.trim() ? producto.imagen : 'image/placeholder-product.png';
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="card h-100 text-center border-info shadow-sm">
        <img src="${imagenSrc}" class="card-img-top" alt="Imagen de ${producto.nombre}" onerror="this.onerror=null;this.src='image/placeholder-product.png'" style="object-fit:cover;border-top-left-radius:0.5rem;border-top-right-radius:0.5rem;background:#fff;" />
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h6 class="card-title mb-2" title="${producto.nombre}">${producto.nombre}</h6>
            <p class="card-text text-info fw-bold mb-2">${formatearPrecio(producto.precio)}</p>
            <small class="text-muted">${producto.categoria}</small>
              ${producto.editableEnVenta ? '<div class="mt-1"><span class="badge bg-warning text-dark">Nombre y precio libres</span></div>' : ''}
            </div>
            <button class="btn btn-primary btn-sm w-100" onclick="agregarProductoVentaRapida(${producto.id})">
            <i class="fas fa-plus me-1"></i>Agregar
          </button>
        </div>
      </div>
    `;
    productosContainer.appendChild(col);
  });
}

// Función para mostrar productos de una categoría en venta rápida
function mostrarProductosCategoriaVentaRapida(categoria) {
  const productosContainer = document.getElementById('productosVentaRapida');
  productosContainer.innerHTML = '';
  
  // Encabezado removido - solo se muestran los productos directamente
  // const encabezado = document.createElement('div');
  // encabezado.className = 'col-12 mb-3';
  // encabezado.innerHTML = `
  //   <div class="alert alert-info text-center py-2">
  //     <h6 class="mb-1"><i class="fas fa-filter me-2"></i>${categoria}</h6>
  //     <small class="mb-0">${productos.filter(p => p.categoria === categoria).length} productos en esta categoría</small>
  //   </div>
  // `;
  // productosContainer.appendChild(encabezado);
  
  const productosFiltrados = productos.filter(p => p.categoria === categoria);
  
  productosFiltrados.forEach(producto => {
    // Permite rutas relativas (locales) o URLs externas. Si falla, muestra placeholder universal
    const imagenSrc = producto.imagen && producto.imagen.trim() ? producto.imagen : 'image/placeholder-product.png';
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="card h-100 text-center border-info shadow-sm">
        <img src="${imagenSrc}" class="card-img-top" alt="Imagen de ${producto.nombre}" onerror="this.onerror=null;this.src='image/placeholder-product.png'" style="object-fit:cover;border-top-left-radius:0.5rem;border-top-right-radius:0.5rem;background:#fff;" />
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h6 class="card-title mb-2" title="${producto.nombre}">${producto.nombre}</h6>
            <p class="card-text text-info fw-bold mb-2">${formatearPrecio(producto.precio)}</p>
            <small class="text-muted">${producto.categoria}</small>
              ${producto.editableEnVenta ? '<div class="mt-1"><span class="badge bg-warning text-dark">Nombre y precio libres</span></div>' : ''}
            </div>
            <button class="btn btn-primary btn-sm w-100" onclick="agregarProductoVentaRapida(${producto.id})">
            <i class="fas fa-plus me-1"></i>Agregar
          </button>
        </div>
      </div>
    `;
    productosContainer.appendChild(col);
  });
}

// Función para agregar producto a venta rápida (directo al pedido; cantidad y notas se editan en Orden Actual)
function agregarProductoVentaRapida(productoId) {
  if (!window.pedidoVentaRapida) {
    alert('Error: no hay una venta rápida activa');
    return;
  }

  const producto = productos.find(p => p.id === productoId);
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }

  const cantidad = 1;
  const detalles = '';
  const esEditable = productoEsEditableEnVenta(producto);
  const tieneSalsas = productoTieneOpcionesSalsas(producto);

  try {
    if (!esEditable && typeof verificarDisponibilidadProducto === 'function') {
      const yaEnPedido = window.pedidoVentaRapida.items
        .filter(item => item.id === producto.id)
        .reduce((sum, item) => sum + (item.cantidad || 0), 0);
      const disponibilidad = verificarDisponibilidadProducto(producto.nombre, yaEnPedido + cantidad);

      if (!disponibilidad.disponible) {
        alert(`Producto no disponible: ${disponibilidad.mensaje}`);
        return;
      }
      if (disponibilidad.stockEnMinimo) {
        console.warn(`Stock en mínimo: ${producto.nombre}`);
      }
    }
  } catch (error) {
    console.error('Error al verificar disponibilidad en venta rápida:', error);
  }

  const itemExistente = (esEditable || tieneSalsas)
    ? null
    : window.pedidoVentaRapida.items.find(
      item => item.id === producto.id && (item.detalles || '') === detalles
    );

  if (itemExistente) {
    itemExistente.cantidad += cantidad;
  } else {
    window.pedidoVentaRapida.items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: cantidad,
      detalles: detalles,
      estado: 'listo',
      editableEnVenta: esEditable,
      notasCocina: '',
      opcionesSalsas: tieneSalsas ? producto.opcionesSalsas.slice() : [],
      salsasElegidas: []
    });
  }

  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();

  if (esEditable) {
    const lastIdx = window.pedidoVentaRapida.items.length - 1;
    const input = document.getElementById(`nombreVentaRapida_${lastIdx}`);
    if (input) {
      input.focus();
      input.select();
    }
  }
}

function recomponerDetallesItemVentaRapida(item) {
  if (!item) return;
  const partes = [];
  const notas = (item.notasCocina || '').trim();
  if (notas) partes.push(notas);
  if (Array.isArray(item.salsasElegidas) && item.salsasElegidas.length) {
    partes.push('Salsas: ' + item.salsasElegidas.join(', '));
  }
  item.detalles = partes.join('; ');
}

function actualizarDetallesVentaRapida(index, valor) {
  const item = window.pedidoVentaRapida?.items?.[index];
  if (!item) return;
  item.notasCocina = (valor || '').trim();
  recomponerDetallesItemVentaRapida(item);
}

function actualizarSalsasVentaRapida(index, salsa, checked) {
  const item = window.pedidoVentaRapida?.items?.[index];
  if (!item) return;
  if (!Array.isArray(item.salsasElegidas)) item.salsasElegidas = [];
  const nombre = String(salsa || '').trim();
  if (!nombre) return;
  if (checked) {
    if (!item.salsasElegidas.includes(nombre)) item.salsasElegidas.push(nombre);
  } else {
    item.salsasElegidas = item.salsasElegidas.filter(s => s !== nombre);
  }
  recomponerDetallesItemVentaRapida(item);
}

function actualizarNombreVentaRapida(index, valor) {
  const item = window.pedidoVentaRapida?.items?.[index];
  if (!item) return;
  const nombre = (valor || '').trim();
  if (nombre) item.nombre = nombre;
}

function actualizarPrecioVentaRapida(index, valor) {
  const item = window.pedidoVentaRapida?.items?.[index];
  if (!item) return;
  const precio = parseFloat(valor);
  item.precio = isNaN(precio) || precio < 0 ? 0 : precio;
  const subtotalEl = document.getElementById(`subtotalVentaRapida_${index}`);
  if (subtotalEl) subtotalEl.textContent = formatearPrecio(item.precio * item.cantidad);
  const unitEl = document.getElementById(`unitarioVentaRapida_${index}`);
  if (unitEl) unitEl.textContent = formatearPrecio(item.precio) + ' c/u';
  actualizarTotalVentaRapida();
}

// Función para actualizar lista de productos en venta rápida
function actualizarListaProductosVentaRapida() {
  const listaContainer = document.getElementById('listaProductosVentaRapida');
  const contadorContainer = document.getElementById('contadorProductosVentaRapida');
  if (!listaContainer || !window.pedidoVentaRapida) return;
  const items = window.pedidoVentaRapida.items;
  
  // Actualizar contador de productos
  if (contadorContainer) {
    const totalProductos = items.reduce((sum, item) => sum + item.cantidad, 0);
    contadorContainer.textContent = `${totalProductos} productos`;
  }
  
  if (items.length === 0) {
    listaContainer.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="fas fa-shopping-bag fa-2x mb-2"></i>
        <p class="mb-0">No hay productos agregados</p>
        <small>Selecciona productos de la izquierda</small>
      </div>
    `;
    return;
  }

  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  let html = '';
  items.forEach((item, index) => {
    const esEditable = !!item.editableEnVenta;
    const nombreHtml = esEditable
      ? `<input type="text" id="nombreVentaRapida_${index}" class="form-control form-control-sm bg-dark text-white border-info mb-1"
               value="${esc(item.nombre)}" placeholder="Nombre del producto"
               oninput="actualizarNombreVentaRapida(${index}, this.value)"
               onblur="actualizarNombreVentaRapida(${index}, this.value)">`
      : `<span class="fw-bold text-white nombre-producto">${esc(item.nombre)}</span>`;
    const precioHtml = esEditable
      ? `<input type="number" id="precioVentaRapida_${index}" class="form-control form-control-sm bg-dark text-white border-info"
               min="0" step="1" value="${item.precio}" placeholder="Precio"
               oninput="actualizarPrecioVentaRapida(${index}, this.value)"
               onblur="actualizarPrecioVentaRapida(${index}, this.value)">`
      : `<small class="fw-semibold" id="unitarioVentaRapida_${index}" style="color: #c5d8ee;">${formatearPrecio(item.precio)} c/u</small>`;
    const salsasHtml = (Array.isArray(item.opcionesSalsas) && item.opcionesSalsas.length)
      ? `<label class="form-label small text-success mb-1 mt-1">Salsas</label>
         <div class="d-flex flex-wrap gap-2 mb-1">${item.opcionesSalsas.map((nombre) => {
           const checked = (item.salsasElegidas || []).includes(nombre) ? 'checked' : '';
           return `<label class="form-check form-check-inline mb-0"><input class="form-check-input" type="checkbox" ${checked} value="${esc(nombre)}" onchange="actualizarSalsasVentaRapida(${index}, this.value, this.checked)"> <span class="form-check-label small">${esc(nombre)}</span></label>`;
         }).join('')}</div>`
      : '';
    html += `
      <div class="mb-2 p-2 bg-gradient bg-secondary bg-opacity-10 border border-secondary rounded producto-venta-rapida">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1 pe-2">
            <div class="d-flex justify-content-between align-items-start mb-1">
              ${nombreHtml}
              <span class="badge bg-info fs-6">${item.cantidad}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              ${precioHtml}
              <span class="fw-bold text-warning precio-producto" id="subtotalVentaRapida_${index}">${formatearPrecio(item.precio * item.cantidad)}</span>
            </div>
            ${salsasHtml}
            <label class="form-label small text-info mb-0">Detalle cocina</label>
            <input type="text" class="form-control form-control-sm bg-dark text-white border-secondary"
                   value="${esc(item.notasCocina != null ? item.notasCocina : (item.detalles || ''))}"
                   placeholder="Ej: Sin cebolla, poco cocido..."
                   onchange="actualizarDetallesVentaRapida(${index}, this.value)"
                   onblur="actualizarDetallesVentaRapida(${index}, this.value)">
          </div>
          <div class="d-flex flex-column align-items-center gap-1 ms-1">
            <button type="button" class="btn btn-outline-warning btn-sm" onclick="cambiarCantidadVentaRapida(${index}, -1)" title="Reducir cantidad">
              <i class="fas fa-minus"></i>
            </button>
            <button type="button" class="btn btn-outline-success btn-sm" onclick="cambiarCantidadVentaRapida(${index}, 1)" title="Aumentar cantidad">
              <i class="fas fa-plus"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="eliminarProductoVentaRapida(${index})" title="Eliminar producto">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  listaContainer.innerHTML = html;
}

// Función para eliminar producto de venta rápida
function eliminarProductoVentaRapida(index) {
  window.pedidoVentaRapida.items.splice(index, 1);
  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();
}

// Función para cambiar cantidad de un producto en venta rápida
function cambiarCantidadVentaRapida(index, cambio) {
  const item = window.pedidoVentaRapida.items[index];
  if (!item) return;
  
  const nuevaCantidad = item.cantidad + cambio;
  
  // Validar que la cantidad no sea menor a 1
  if (nuevaCantidad < 1) {
    // Si la cantidad sería 0, eliminar el producto
    eliminarProductoVentaRapida(index);
    return;
  }
  
  // Validar que la cantidad no exceda 99
  if (nuevaCantidad > 99) {
    alert('La cantidad máxima por producto es 99');
    return;
  }
  
  // Actualizar cantidad
  item.cantidad = nuevaCantidad;
  
  // Actualizar interfaz
  actualizarListaProductosVentaRapida();
  actualizarTotalVentaRapida();
}

// Función para actualizar total en venta rápida
function actualizarTotalVentaRapida() {
  const total = window.pedidoVentaRapida.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalElement = document.getElementById('totalVentaRapidaModal');
  
  if (totalElement) {
    totalElement.textContent = formatearPrecio(total);
  }
  
  // Habilitar/deshabilitar botón de procesar
  const btnProcesar = document.getElementById('btnProcesarVentaRapida');
  
  if (btnProcesar) {
    btnProcesar.disabled = total === 0;
    btnProcesar.classList.toggle('btn-success', total > 0);
    btnProcesar.classList.toggle('btn-secondary', total === 0);
  }
}

// Función para procesar venta rápida directa
function procesarVentaRapidaDirecta() {
  console.log('🔍 DEBUG PROCESAR VENTA RÁPIDA DIRECTA:');
  console.log('   - window.pedidoVentaRapida:', window.pedidoVentaRapida);
  console.log('   - Items:', window.pedidoVentaRapida?.items);
  
  if (!window.pedidoVentaRapida || window.pedidoVentaRapida.items.length === 0) {
    alert('No hay productos en la orden');
    return;
  }
  
  const total = window.pedidoVentaRapida.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  console.log('   - Total calculado:', total);
  
  // No limpiar el carrito al cerrar productos: vamos al modal de pago
  window._ventaRapidaIgnorarLimpiezaProductos = true;
  
  // Cerrar modal de productos
  const modalProductosEl = document.getElementById('modalAgregarProductosVentaRapida');
  const modalProductos = bootstrap.Modal.getInstance(modalProductosEl) || bootstrap.Modal.getOrCreateInstance(modalProductosEl, { backdrop: 'static', keyboard: false });
  modalProductos.hide();
  
  // Mostrar modal de confirmación
  mostrarModalVentaRapida(window.pedidoVentaRapida, total, total, 0, 0, 0, 0);
}

// Volver del pago a la selección de productos sin perder la orden
function volverAProductosVentaRapida() {
  const modalPagoEl = document.getElementById('modalVentaRapida');
  const modalPago = bootstrap.Modal.getInstance(modalPagoEl);
  if (modalPago) modalPago.hide();

  // Restaurar items desde datos temporales si el pedido se vació por error
  if (window.datosVentaRapida?.pedido?.items?.length) {
    if (!window.pedidoVentaRapida) {
      window.pedidoVentaRapida = {
        items: [],
        cliente: null,
        telefono: null,
        direccion: null,
        horaRecoger: null,
        tipo: 'venta_rapida'
      };
    }
    if (!window.pedidoVentaRapida.items?.length) {
      window.pedidoVentaRapida.items = window.datosVentaRapida.pedido.items.map(item => ({ ...item }));
    }
  }

  const modalProductosEl = document.getElementById('modalAgregarProductosVentaRapida');
  const modalProductos = bootstrap.Modal.getOrCreateInstance(modalProductosEl, { backdrop: 'static', keyboard: false });
  modalProductos.show();

  setTimeout(() => {
    actualizarListaProductosVentaRapida();
    actualizarTotalVentaRapida();
  }, 150);
}

// Función para limpiar pedido de venta rápida
function limpiarPedidoVentaRapida() {
  if (window.pedidoVentaRapida) {
    window.pedidoVentaRapida.items = [];
    const lista = document.getElementById('listaProductosVentaRapida');
    const totalEl = document.getElementById('totalVentaRapidaModal');
    if (lista || totalEl) {
      actualizarListaProductosVentaRapida();
      actualizarTotalVentaRapida();
    }
  }
}

function obtenerCanalSeleccionadoVentaRapida() {
  return 'mesa';
}

function cambiarCanalVentaRapida() {
  actualizarTotalCanalVentaRapida();
}

function escaparHtmlClienteVR(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buscarClientesVentaRapida(mostrarRecientes = false) {
  const input = document.getElementById('buscarClienteVentaRapida');
  const lista = document.getElementById('listaClientesVentaRapida');
  if (!lista) return;

  lista.innerHTML = '';
  const busqueda = (input?.value || '').trim();
  const fuente = recargarClientesDesdeStorage();

  let filtrados;
  if (busqueda) {
    filtrados = fuente.filter(cliente => clienteCoincideBusqueda(cliente, busqueda));
  } else if (mostrarRecientes) {
    filtrados = [...fuente].slice(-8).reverse();
  } else {
    return;
  }

  if (filtrados.length === 0) {
    lista.innerHTML = '<div class="list-group-item bg-dark text-muted border-secondary small">No se encontraron clientes</div>';
    return;
  }

  filtrados.forEach(cliente => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary py-2';
    const dir = (cliente.direccion && cliente.direccion !== 'No proporcionado') ? cliente.direccion : '';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="text-start">
          <div class="fw-semibold">${escaparHtmlClienteVR(cliente.nombre)}</div>
          <small class="text-muted">${escaparHtmlClienteVR(cliente.telefono)}${dir ? ' · ' + escaparHtmlClienteVR(dir) : ''}</small>
        </div>
        <span class="badge bg-warning text-dark align-self-center">Usar</span>
      </div>
    `;
    item.onclick = () => seleccionarClienteVentaRapida(cliente.id);
    lista.appendChild(item);
  });
}

function seleccionarClienteVentaRapida(clienteId) {
  const fuente = Array.isArray(clientes) ? clientes : [];
  const cliente = fuente.find(c => String(c.id) === String(clienteId));
  if (!cliente) {
    alert('No se encontró el cliente seleccionado');
    return;
  }

  const nombreEl = document.getElementById('clienteDomicilioVentaRapida');
  const telEl = document.getElementById('telefonoDomicilioVentaRapida');
  const dirEl = document.getElementById('direccionDomicilioVentaRapida');
  if (nombreEl) nombreEl.value = cliente.nombre || '';
  if (telEl) telEl.value = cliente.telefono || '';
  if (dirEl) {
    const dir = cliente.direccion || '';
    dirEl.value = (dir === 'No proporcionado') ? '' : dir;
  }

  const aviso = document.getElementById('clienteSeleccionadoVentaRapida');
  if (aviso) {
    aviso.style.display = 'block';
    aviso.innerHTML = `<i class="fas fa-check-circle"></i> Cliente: <strong>${escaparHtmlClienteVR(cliente.nombre)}</strong>`;
  }

  const lista = document.getElementById('listaClientesVentaRapida');
  if (lista) lista.innerHTML = '';
  const busqueda = document.getElementById('buscarClienteVentaRapida');
  if (busqueda) busqueda.value = '';
}

function limpiarClienteVentaRapida() {
  const ids = [
    'buscarClienteVentaRapida',
    'clienteDomicilioVentaRapida',
    'telefonoDomicilioVentaRapida',
    'direccionDomicilioVentaRapida'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const aviso = document.getElementById('clienteSeleccionadoVentaRapida');
  if (aviso) {
    aviso.style.display = 'none';
    aviso.innerHTML = '';
  }
  buscarClientesVentaRapida(false);
}

function obtenerValorDomicilioVentaRapida() {
  return 0;
}

function obtenerPropinaVentaRapida() {
  return Math.max(0, Math.min(100, parseFloat(document.getElementById('propinaVentaRapida')?.value) || 0));
}

function obtenerDescuentoVentaRapida() {
  return Math.max(0, parseFloat(document.getElementById('descuentoVentaRapida')?.value) || 0);
}

function calcularTotalesVentaRapida(subtotal, propinaPct, descuento, valorDomicilio) {
  const sub = Math.round(Number(subtotal) || 0);
  const propina = Math.max(0, Math.min(100, Number(propinaPct) || 0));
  const desc = Math.max(0, Number(descuento) || 0);
  const dom = Math.max(0, Number(valorDomicilio) || 0);
  const propinaCalculada = Math.round((sub * propina) / 100);
  const total = Math.max(0, Math.round(sub + propinaCalculada - desc + dom));
  return { subtotal: sub, propina, descuento: desc, valorDomicilio: dom, propinaCalculada, total };
}

function actualizarTotalCanalVentaRapida() {
  if (!window.datosVentaRapida) return;
  const subtotal = window.datosVentaRapida.subtotal || 0;
  const propina = obtenerPropinaVentaRapida();
  const descuento = obtenerDescuentoVentaRapida();
  const valorDomicilio = obtenerValorDomicilioVentaRapida();
  const calc = calcularTotalesVentaRapida(subtotal, propina, descuento, valorDomicilio);

  window.datosVentaRapida.propina = calc.propina;
  window.datosVentaRapida.descuento = calc.descuento;
  window.datosVentaRapida.valorDomicilio = calc.valorDomicilio;
  window.datosVentaRapida.propinaCalculada = calc.propinaCalculada;
  window.datosVentaRapida.total = calc.total;

  actualizarResumenVentaRapidaUI(
    calc.subtotal,
    calc.propina,
    calc.descuento,
    calc.valorDomicilio,
    calc.propinaCalculada,
    calc.total
  );
  calcularCambioVentaRapida();
}

function actualizarResumenVentaRapidaUI(subtotal, propina, descuento, valorDomicilio, propinaCalculada, total) {
  const resumenEl = document.getElementById('resumenVentaRapida');
  if (resumenEl) {
    resumenEl.innerHTML = `
      <div class="small">
        <div class="d-flex justify-content-between mb-1">
          <span>Subtotal:</span>
          <span>${formatearPrecio(subtotal)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Propina (${propina}%):</span>
          <span>${formatearPrecio(propinaCalculada)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Descuento:</span>
          <span>${formatearPrecio(descuento)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Domicilio:</span>
          <span>${formatearPrecio(valorDomicilio)}</span>
        </div>
        <hr class="my-2">
        <div class="d-flex justify-content-between fw-bold">
          <span>TOTAL:</span>
          <span class="text-warning">${formatearPrecio(total)}</span>
        </div>
      </div>
    `;
  }
  const totalEl = document.getElementById('totalVentaRapida');
  if (totalEl) totalEl.textContent = formatearPrecio(total);
}

function recolectarDatosCanalVentaRapida() {
  return {
    canal: 'mesa',
    cliente: null,
    telefono: null,
    direccion: null,
    horaRecoger: null,
    numeroMesa: null,
    valorDomicilio: 0,
    nombreDomiciliario: ''
  };
}

function validarDatosCanalVentaRapida(datosCanal) {
  if (datosCanal.canal !== 'domicilio') return true;
  if (!datosCanal.cliente) {
    alert('En domicilio el nombre del cliente es obligatorio');
    return false;
  }
  if (!datosCanal.telefono) {
    alert('En domicilio el teléfono es obligatorio');
    return false;
  }
  if (!datosCanal.direccion) {
    alert('En domicilio la dirección es obligatoria');
    return false;
  }
  return true;
}

function etiquetaMesaVentaRapida(canal, numeroMesa) {
  if (canal === 'domicilio') return 'VENTA DIRECTA - DOMICILIO';
  if (canal === 'recoger') return 'VENTA DIRECTA - RECOGER';
  if (canal === 'mesa' && numeroMesa) return `VENTA DIRECTA - MESA ${numeroMesa}`;
  if (canal === 'mesa') return 'VENTA DIRECTA - AQUÍ';
  return 'VENTA DIRECTA';
}

// Función para mostrar modal de venta rápida
function mostrarModalVentaRapida(pedido, total, subtotal, propina, descuento, valorDomicilio, propinaCalculada) {
  actualizarResumenVentaRapidaUI(subtotal, propina, descuento, valorDomicilio || 0, propinaCalculada, total);
  
  // Limpiar campos
  document.getElementById('montoRecibidoVentaRapida').value = '';
  const cambioEl = document.getElementById('cambioVentaRapida');
  cambioEl.textContent = 'Cambio: $0';
  cambioEl.classList.remove('text-danger');
  cambioEl.classList.add('text-success');
  cambioEl.style.fontWeight = 'bold';
  cambioEl.style.fontSize = '1.2em';

  const enviarCocinaEl = document.getElementById('enviarCocinaVentaRapida');
  if (enviarCocinaEl) enviarCocinaEl.checked = false;
  const propinaEl = document.getElementById('propinaVentaRapida');
  if (propinaEl) propinaEl.value = propina > 0 ? propina : '';
  const descuentoEl = document.getElementById('descuentoVentaRapida');
  if (descuentoEl) descuentoEl.value = descuento > 0 ? descuento : '';

  // Guardar datos para usar en confirmación
  window.datosVentaRapida = {
    pedido: {
      items: (pedido.items || []).map(item => ({ ...item })),
      cliente: pedido.cliente,
      telefono: pedido.telefono,
      direccion: pedido.direccion,
      horaRecoger: pedido.horaRecoger,
      tipo: pedido.tipo
    },
    total: total,
    subtotal: subtotal,
    propina: propina || 0,
    descuento: descuento || 0,
    valorDomicilio: valorDomicilio || 0,
    propinaCalculada: propinaCalculada || 0
  };

  actualizarTotalCanalVentaRapida();
  
  // Mostrar modal (no se cierra con clic afuera ni Escape)
  const modalEl = document.getElementById('modalVentaRapida');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false });
  modal.show();
}

// Función para calcular cambio en venta rápida
function calcularCambioVentaRapida() {
  const montoRecibido = parseFloat(document.getElementById('montoRecibidoVentaRapida').value) || 0;
  const total = window.datosVentaRapida ? window.datosVentaRapida.total : 0;
  const cambio = montoRecibido - total;
  const el = document.getElementById('cambioVentaRapida');
  
  el.textContent = `Cambio: ${formatearPrecio(Math.max(0, cambio))}`;
  el.style.fontWeight = 'bold';
  el.style.fontSize = '1.2em';

  if (cambio < 0) {
    el.classList.remove('text-success');
    el.classList.add('text-danger');
  } else {
    el.classList.remove('text-danger');
    el.classList.add('text-success');
  }
}

// Función para confirmar venta rápida desde modal
let ventaRapidaEnCurso = false;
function botonConfirmarVentaRapida() {
  return document.getElementById('btnConfirmarVentaRapida');
}

function desbloquearVentaRapida() {
  ventaRapidaEnCurso = false;
  const btn = botonConfirmarVentaRapida();
  if (btn) {
    btn.disabled = false;
    if (btn.dataset.textoOriginal) {
      btn.innerHTML = btn.dataset.textoOriginal;
      delete btn.dataset.textoOriginal;
    }
  }
}

function confirmarVentaRapida() {
  if (ventaRapidaEnCurso) return;
  if (!window.datosVentaRapida) {
    alert('Error: No hay datos de venta rápida');
    return;
  }

  const datosCanal = recolectarDatosCanalVentaRapida();
  if (!validarDatosCanalVentaRapida(datosCanal)) return;
  
  const metodoPago = document.getElementById('metodoPagoVentaRapida').value;
  const montoRecibido = parseFloat(document.getElementById('montoRecibidoVentaRapida').value) || 0;
  const subtotal = window.datosVentaRapida.subtotal || 0;
  const calc = calcularTotalesVentaRapida(
    subtotal,
    obtenerPropinaVentaRapida(),
    obtenerDescuentoVentaRapida(),
    datosCanal.valorDomicilio || 0
  );
  const total = calc.total;
  window.datosVentaRapida.propina = calc.propina;
  window.datosVentaRapida.descuento = calc.descuento;
  window.datosVentaRapida.propinaCalculada = calc.propinaCalculada;
  window.datosVentaRapida.total = total;
  window.datosVentaRapida.valorDomicilio = calc.valorDomicilio;
  window.datosVentaRapida.canalDatos = datosCanal;
  
  // Validar monto recibido si es efectivo
  if (metodoPago === 'efectivo' && montoRecibido < total) {
    alert('El monto recibido debe ser mayor o igual al total');
    return;
  }

  // ========================================
  // VALIDACIÓN FINAL DE STOCK ANTES DE PROCESAR
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      const productosSinStock = [];
      
      for (const item of window.datosVentaRapida.pedido.items) {
        const disponibilidad = verificarDisponibilidadProducto(item.nombre, item.cantidad);
        
        if (!disponibilidad.disponible) {
          productosSinStock.push({
            nombre: item.nombre,
            cantidadSolicitada: item.cantidad,
            stockDisponible: disponibilidad.stockActual,
            mensaje: disponibilidad.mensaje
          });
        }
      }
      
      if (productosSinStock.length > 0) {
        const mensaje = productosSinStock.map(p => 
          `${p.nombre}: solicitado ${p.cantidadSolicitada}, disponible ${p.stockDisponible}`
        ).join('\n');
        
        alert(`⚠️ No se puede procesar la venta. Los siguientes productos no tienen stock suficiente:\n\n${mensaje}\n\nPor favor, ajusta las cantidades o elimina estos productos de la orden.`);
        return;
      }
    }
  } catch (error) {
    console.error('Error al validar stock antes de procesar venta rápida:', error);
  }

  ventaRapidaEnCurso = true;
  const btnVR = botonConfirmarVentaRapida();
  if (btnVR) {
    btnVR.disabled = true;
    btnVR.dataset.textoOriginal = btnVR.innerHTML;
    btnVR.innerHTML = 'Procesando...';
  }
  
  // Marcar items: cocina opcional o listos
  const enviarACocina = !!document.getElementById('enviarCocinaVentaRapida')?.checked;
  window.datosVentaRapida.enviarACocina = enviarACocina;
  if (!window.datosVentaRapida.sesionId) {
    window.datosVentaRapida.sesionId = crearIdSesionMesa();
  }
  window.datosVentaRapida.pedido.items.forEach(item => {
    item.estado = enviarACocina ? 'en_cocina' : 'listo';
  });
  
  // Procesar venta rápida con método de pago seleccionado
  window._ventaRapidaVentaCompletada = true;
  try {
    procesarVentaRapida(window.datosVentaRapida.pedido, total, metodoPago, montoRecibido);
  } catch (error) {
    console.error('Error al procesar venta rápida:', error);
    desbloquearVentaRapida();
    return;
  }
  
  // Cerrar modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalVentaRapida'));
  if (modal) modal.hide();
  
  // Limpiar datos
  window.datosVentaRapida = null;
  window.pedidoVentaRapida = null;
  desbloquearVentaRapida();
}

// Función para procesar venta rápida (actualizada)
function procesarVentaRapida(pedido, total, metodoPago = 'efectivo', montoRecibido = 0) {
  const datosCanal = (window.datosVentaRapida && window.datosVentaRapida.canalDatos)
    ? window.datosVentaRapida.canalDatos
    : { canal: 'mesa', valorDomicilio: 0, nombreDomiciliario: '', cliente: null, telefono: null, direccion: null, horaRecoger: null, numeroMesa: null };

  const propina = (window.datosVentaRapida && typeof window.datosVentaRapida.propina === 'number')
    ? window.datosVentaRapida.propina
    : 0;
  const descuento = (window.datosVentaRapida && typeof window.datosVentaRapida.descuento === 'number')
    ? window.datosVentaRapida.descuento
    : 0;
  const valorDomicilio = datosCanal.valorDomicilio || 0;
  const subtotal = (pedido.items || []).reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  // Crear objeto de venta
  const sesionVentaRapida = (window.datosVentaRapida && window.datosVentaRapida.sesionId)
    ? window.datosVentaRapida.sesionId
    : crearIdSesionMesa();
  if (window.datosVentaRapida) window.datosVentaRapida.sesionId = sesionVentaRapida;
  if (sesionMesaYaCobrada(sesionVentaRapida)) return;

  const venta = {
    id: Date.now(),
    mesa: etiquetaMesaVentaRapida(datosCanal.canal, datosCanal.numeroMesa),
    items: pedido.items || [],
    subtotal: subtotal,
    propina: propina,
    propinaMonto: (window.datosVentaRapida && typeof window.datosVentaRapida.propinaCalculada === 'number')
      ? Math.round(window.datosVentaRapida.propinaCalculada)
      : Math.round((subtotal * propina) / 100),
    descuento: descuento,
    valorDomicilio: valorDomicilio,
    nombreDomiciliario: datosCanal.nombreDomiciliario || '',
    cliente: datosCanal.cliente,
    telefono: datosCanal.telefono,
    direccion: datosCanal.direccion,
    horaRecoger: datosCanal.horaRecoger,
    numeroMesa: datosCanal.numeroMesa,
    total: total,
    metodoPago: metodoPago,
    montoRecibido: montoRecibido,
    cambio: Math.max(0, montoRecibido - total),
    fecha: new Date().toISOString(),
    tipo: 'venta_rapida',
    origen: 'caja_rapida',
    canal: datosCanal.canal,
    estado: 'completada',
    enviadoACocina: !!(window.datosVentaRapida && window.datosVentaRapida.enviarACocina),
    sesionId: sesionVentaRapida
  };

  registrarVentaUnificada(venta);
  if (venta.nombreDomiciliario) guardarNombreDomiciliario(venta.nombreDomiciliario);

  // Enviar a cocina si se marcó la opción
  if (venta.enviadoACocina) {
    // Primero ticket de cocina; al continuar se reutiliza la misma ventana para el recibo
    enviarVentaRapidaACocina(venta, (ventanaCocina) => {
      mostrarReciboVentaRapida(venta, ventanaCocina);
    });
  }

  // Actualizar inventario si está disponible
  try {
    if (typeof actualizarInventarioDesdeVenta === 'function') {
      const itemsParaInventario = pedido.items.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        ventaId: venta.id,
        mesa: venta.mesa || 'VENTA DIRECTA'
      }));
      
      const resultadoInventario = actualizarInventarioDesdeVenta(itemsParaInventario);
      
      if (resultadoInventario && resultadoInventario.success) {
        console.log('Inventario actualizado exitosamente desde venta rápida:', resultadoInventario);
        
        if (resultadoInventario.productosStockBajo && resultadoInventario.productosStockBajo.length > 0) {
          const productosBajo = resultadoInventario.productosStockBajo.map(p => p.nombre).join(', ');
          console.warn(`Productos con stock bajo después de la venta: ${productosBajo}`);
        }
        
        if (resultadoInventario.productosNoEncontrados && resultadoInventario.productosNoEncontrados.length > 0) {
          const productosNoEncontrados = resultadoInventario.productosNoEncontrados.join(', ');
          console.warn(`Productos no encontrados en inventario: ${productosNoEncontrados}`);
        }
      } else if (resultadoInventario) {
        console.error('Error al actualizar inventario desde venta rápida:', resultadoInventario.message);
      }
    } else {
      console.log('Función de actualización de inventario no disponible');
    }
  } catch (error) {
    console.error('Error al actualizar inventario desde venta rápida:', error);
  }

  // La venta rápida no debe tocar mesas activas
  window.pedidoVentaRapida = null;

  // Sin cocina: abrir recibo del cliente de inmediato
  if (!venta.enviadoACocina) {
    mostrarReciboVentaRapida(venta);
  }

  // Mostrar confirmación
  mostrarConfirmacionVentaRapida(venta);
}

// Función para mostrar confirmación de venta rápida
function mostrarConfirmacionVentaRapida(venta) {
  const canal = obtenerCanalVentaRapida(venta);
  let etiquetaCanal = 'Venta Directa';
  if (canal === 'domicilio') etiquetaCanal = 'Domicilio (caja rápida)';
  else if (canal === 'recoger') etiquetaCanal = 'Recoger (caja rápida)';
  else if (canal === 'mesa') {
    etiquetaCanal = venta.numeroMesa
      ? `Mesa / Aquí ${venta.numeroMesa} (caja rápida)`
      : 'Mesa / Aquí (caja rápida)';
  }

  const confirmacion = document.createElement('div');
  confirmacion.className = 'alert alert-success alert-dismissible fade show position-fixed';
  confirmacion.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px; animation: slideInRight 0.5s ease;';
  confirmacion.innerHTML = `
    <strong>⚡ Venta Rápida Completada</strong>
    <p class="mb-0">${etiquetaCanal}</p>
    <p class="mb-0">Total: ${formatearPrecio(venta.total)}</p>
    <p class="mb-0">Método: ${venta.metodoPago.toUpperCase()}</p>
    <p class="mb-0 small">${venta.enviadoACocina ? 'Cocina lista · pulsa Continuar al recibo' : 'Productos listos - sin cocina'}</p>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(confirmacion);
  
  // Auto-remover después de 5 segundos
  setTimeout(() => {
    if (confirmacion.parentNode) {
      confirmacion.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => {
        if (confirmacion.parentNode) {
          confirmacion.remove();
        }
      }, 500);
    }
  }, 5000);
}

// Enviar venta rápida a historial de cocina + imprimir ticket
// alCerrarTicket: se llama al cerrar el ticket de cocina (p. ej. abrir recibo del cliente)
function enviarVentaRapidaACocina(venta, alCerrarTicket) {
  const dispararAlCerrar = (() => {
    let usado = false;
    return (ventanaCocina) => {
      if (usado || typeof alCerrarTicket !== 'function') return;
      usado = true;
      try {
        alCerrarTicket(ventanaCocina || null);
      } catch (e) {
        console.error('Error al abrir recibo tras cerrar cocina:', e);
      }
    };
  })();

  try {
    const itemsCocina = (venta.items || []).map(item => ({
      ...item,
      estado: 'en_cocina'
    }));

    if (itemsCocina.length === 0) {
      dispararAlCerrar();
      return;
    }

    const ordenCocina = {
      id: venta.id,
      fecha: new Date().toISOString(),
      fechaMostrar: new Date().toLocaleString(),
      mesa: venta.mesa,
      items: itemsCocina,
      cliente: venta.cliente || null,
      telefono: venta.telefono || null,
      direccion: venta.direccion || null,
      horaRecoger: venta.horaRecoger || null,
      numeroMesa: venta.numeroMesa || null,
      canal: venta.canal || null,
      origen: 'caja_rapida',
      tipo: 'venta_rapida',
      esVentaRapida: true,
      ronda: 1,
      ventaId: venta.id,
      sesionId: venta.sesionId || null
    };

    if (!Array.isArray(historialCocina)) {
      historialCocina = JSON.parse(localStorage.getItem('historialCocina') || '[]');
    }
    historialCocina.push(ordenCocina);
    guardarHistorialCocina();

    try {
      if (typeof ordenesCocina !== 'undefined' && ordenesCocina instanceof Map) {
        acumularOrdenesCocina(venta.mesa, itemsCocina);
      }
    } catch (e) { /* ignore */ }

    imprimirTicketCocina(venta.mesa, itemsCocina, {
      esVentaRapida: true,
      alCerrar: dispararAlCerrar,
      pedido: {
        cliente: venta.cliente,
        telefono: venta.telefono,
        direccion: venta.direccion,
        horaRecoger: venta.horaRecoger,
        numeroMesa: venta.numeroMesa,
        canal: venta.canal,
        ronda: 1,
        origen: 'caja_rapida',
        tipo: 'venta_rapida'
      }
    });

    if (typeof actualizarPanelCocina === 'function') actualizarPanelCocina();
    if (typeof actualizarBadgeCocina === 'function') actualizarBadgeCocina();
    if (typeof mostrarConfirmacionEnviadoACocina === 'function') {
      mostrarConfirmacionEnviadoACocina(itemsCocina.length);
    }
  } catch (error) {
    console.error('Error al enviar venta rápida a cocina:', error);
    alert('La venta se guardó, pero hubo un problema al enviar a cocina. Revisa la pantalla de cocina.');
    dispararAlCerrar();
  }
}

// Función para generar ticket de cocina
function generarTicketCocina(pedido) {
  const fecha = new Date().toLocaleString();
  let ticket = `
    <div class="ticket-cocina">
      <div class="ticket-header">
        <h2>Ticket de Cocina</h2>
        <p>Fecha: ${fecha}</p>
        <p>Mesa: ${pedido.mesa}</p>
        ${pedido.cliente ? `<p>Cliente: ${pedido.cliente}</p>` : ''}
      </div>
      <div class="ticket-body">
        <table>
          <thead>
            <tr>
              <th style="width: 20%; font-size: 18px;">Cant</th>
              <th style="font-size: 18px;">Producto</th>
            </tr>
          </thead>
          <tbody>
            ${productos.map(item => `
              <tr>
                <td style="font-size: 24px; font-weight: bold;">${item.cantidad}</td>
                <td>
                  <div class="producto" style="font-weight: bold; font-size: 24px;">${item.nombre}</div>
                  ${item.detalles ? `
                    <div class="detalles" style="font-size: 16px; margin-top: 4px;">
                      <span class="detalle-label">Detalle:</span> ${item.detalles}
                    </div>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="ticket-footer">
        <p>Total de productos: ${pedido.items.length}</p>
      </div>
    </div>
  `;

  return ticket;
}

// Función para obtener o crear la ventana de impresión
function obtenerVentanaImpresion() {
  const ventana = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!ventana) return null;

  // Esperar a que la ventana esté completamente cargada
  ventana.document.open();
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            /* Aumentamos bastante el tamaño para mejorar legibilidad */
            font-size: 22px;
            width: 100%;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 22px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 22px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              /* Sin tamaño fijo: que use el ancho real del papel */
              margin: 0;
            }
            body {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido"></div>
      </body>
    </html>
  `);
  ventana.document.close();
  return ventana;
}

// Función para mostrar vista previa del ticket de cocina
function mostrarVistaPreviaPedido() {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const mesa = mesaSeleccionada;
  const pedido = mesasActivas.get(mesa);
  const productos = pedido.items || [];
  
  if (productos.length === 0) {
    alert('No hay productos para mostrar en la vista previa');
    return;
  }

  const ventana = obtenerVentanaImpresion();
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }
  
  // Obtener el pedido completo para acceder a la información del cliente
  const pedidoCompleto = mesasActivas.get(mesa);
  let infoCliente = '';
  
  if (pedidoCompleto && pedidoCompleto.cliente) {
    infoCliente = `
      <div class="cliente-info">
        <div class="cliente-label">Cliente:</div>
        <div class="cliente-datos">
          <strong>${pedidoCompleto.cliente}</strong><br>
          Tel: ${pedidoCompleto.telefono || 'No disponible'}<br>
          ${mesa.startsWith('DOM-') ? 
            `Dir: ${pedidoCompleto.direccion || 'No disponible'}` : 
            `Hora: ${pedidoCompleto.horaRecoger || 'No disponible'}`
          }
        </div>
      </div>
    `;
  }
  
  const contenido = `
    <div class="header text-center">
      <h2 style="margin: 0; font-size: 28px; font-weight: bold;">COCINA</h2>
      <div class="mb-1" style="font-size: 22px; font-weight: bold;">Mesa: ${mesa}</div>
      <div class="mb-1" style="font-size: 20px; font-weight: bold;">Ronda: ${rondaDeProductos(productos, pedidoCompleto && pedidoCompleto.ronda)}</div>
      <div class="mb-1">${new Date().toLocaleString()}</div>
    </div>
    
    ${infoCliente}
    
    <table>
      <thead>
        <tr>
          <th style="width: 20%">Cant</th>
          <th>Producto</th>
        </tr>
      </thead>
      <tbody>
        ${productos.map(item => `
          <tr>
            <td>${item.cantidad}</td>
            <td>
              <div class="producto" style="font-weight: bold; font-size: 16px;">${item.nombre}</div>
              ${item.detalles ? `
                <div class="detalles">
                  <span class="detalle-label">Detalle:</span> ${item.detalles}
                </div>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias!</div>
    </div>
  `;
  
  // Esperar a que la ventana esté completamente cargada
  setTimeout(() => {
    try {
      const contenidoDiv = ventana.document.getElementById('contenido');
      if (contenidoDiv) {
        contenidoDiv.innerHTML = contenido;
        ventana.focus();
      } else {
        console.error('No se pudo encontrar el div de contenido');
        alert('Error: No se pudo cargar la vista previa');
      }
    } catch (error) {
      console.error('Error al insertar contenido:', error);
      alert('Error al mostrar la vista previa: ' + error.message);
    }
  }, 100);
}

// Ejecutar callback al cerrar / continuar desde una ventana de impresión
// opciones: { etiquetaBotonCerrar, reutilizarVentana }
function enCerrarVentanaImpresion(ventana, alCerrar, opciones = {}) {
  if (!ventana || typeof alCerrar !== 'function') return;

  const opts = (typeof opciones === 'string')
    ? { etiquetaBotonCerrar: opciones, reutilizarVentana: false }
    : (opciones || {});
  const reutilizar = !!opts.reutilizarVentana;

  let usado = false;
  let watch = null;
  const disparar = (ventanaParaRecibo) => {
    if (usado) return;
    usado = true;
    if (watch) clearInterval(watch);
    try {
      alCerrar(ventanaParaRecibo || null);
    } catch (e) {
      console.error('Error en callback al cerrar impresión:', e);
    }
  };

  try {
    const btn = ventana.document.getElementById('btnCerrarImpresion');
    if (btn) {
      if (opts.etiquetaBotonCerrar) btn.textContent = opts.etiquetaBotonCerrar;
      btn.onclick = function () {
        if (reutilizar) {
          // Misma ventana → recibo del cliente (sin segundo popup)
          disparar(ventana);
        } else {
          disparar(null);
          try { ventana.close(); } catch (e) { /* ignore */ }
        }
      };
    }
  } catch (e) {
    console.warn('No se pudo enlazar botón cerrar de impresión:', e);
  }

  watch = setInterval(() => {
    try {
      if (ventana.closed) {
        clearInterval(watch);
        // Ventana ya cerrada: no se puede reutilizar
        disparar(null);
      }
    } catch (e) {
      clearInterval(watch);
      disparar(null);
    }
  }, 400);
}

// Función para imprimir ticket de cocina
function imprimirHtmlEnIframe(html) {
  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(function () {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) { /* ignore */ }
      setTimeout(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 4000);
    }, 350);
  } catch (e) { /* ignore */ }
}

function mostrarAvisoTicketCocinaMesero(datos) {
  datos = datos || {};
  let aviso = document.getElementById('avisoTicketMesero');
  if (aviso && aviso.parentNode) aviso.remove();
  aviso = document.createElement('div');
  aviso.id = 'avisoTicketMesero';
  aviso.className = 'alert alert-info position-fixed shadow';
  aviso.style.cssText = 'top: 16px; right: 16px; z-index: 10050; max-width: 380px;';
  const mesa = String(datos.mesa || '');
  const mesero = datos.nombreMesero ? (' · ' + String(datos.nombreMesero)) : '';
  window._ordenCocinaMeseroPendiente = datos.orden || null;
  const extraAuto = datos.imprimiendoEnCaja
    ? ' Se mandó a imprimir en esta caja. Si no salió, usa el botón.'
    : ' Si el celular no imprimió, usa este botón. No hace falta entrar a Historial.';
  aviso.innerHTML =
    '<div class="fw-bold">' + (datos.imprimiendoEnCaja ? 'Pedido de mesero' : 'Pedido de mesero en cocina') + '</div>' +
    '<div class="mb-2">' + mesa + mesero + '.' + extraAuto + '</div>' +
    '<div class="d-flex gap-2 flex-wrap">' +
    '<button type="button" class="btn btn-info btn-sm" id="btnImprimirAvisoTicketMesero">Imprimir en esta caja</button>' +
    '<button type="button" class="btn btn-outline-light btn-sm" id="btnVerTicketsMesero">Ver todos</button>' +
    '<button type="button" class="btn btn-outline-light btn-sm" id="btnCerrarAvisoTicketMesero">Cerrar</button>' +
    '</div>';
  document.body.appendChild(aviso);
  const btnCerrar = document.getElementById('btnCerrarAvisoTicketMesero');
  if (btnCerrar) btnCerrar.onclick = function () { if (aviso.parentNode) aviso.remove(); };
  const btnPrint = document.getElementById('btnImprimirAvisoTicketMesero');
  if (btnPrint) {
    btnPrint.onclick = function () {
      if (window._ordenCocinaMeseroPendiente) imprimirTicketCocinaDeOrden(window._ordenCocinaMeseroPendiente);
    };
  }
  const btnVer = document.getElementById('btnVerTicketsMesero');
  if (btnVer) {
    btnVer.onclick = function () {
      if (aviso.parentNode) aviso.remove();
      if (typeof mostrarModalTicketsMesero === 'function') mostrarModalTicketsMesero();
    };
  }
  setTimeout(function () {
    if (aviso && aviso.parentNode) aviso.remove();
  }, 25000);
}

function entregarDocumentoImpresionCocina(html, opciones) {
  opciones = opciones || {};
  const alCerrar = typeof opciones.alCerrar === 'function' ? opciones.alCerrar : null;
  const silencioso = !!opciones.silencioso;
  if (silencioso) {
    imprimirHtmlEnIframe(html);
    if (alCerrar) {
      try { alCerrar(null); } catch (e) { /* ignore */ }
    }
    return null;
  }
  let ventana = null;
  try {
    ventana = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  } catch (e) {
    ventana = null;
  }
  if (!ventana) {
    imprimirHtmlEnIframe(html);
    if (alCerrar) {
      try { alCerrar(null); } catch (e) { /* ignore */ }
    }
    return null;
  }
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  return ventana;
}

function imprimirTicketCocina(mesa, productos, opciones = {}) {
  const alCerrar = typeof opciones.alCerrar === 'function' ? opciones.alCerrar : null;
  const silencioso = !!opciones.silencioso;

  // Obtener el pedido completo (mesa activa o datos explícitos ej. venta rápida)
  const pedidoCompleto = opciones.pedido || mesasActivas.get(mesa);
  const esVentaRapida = !!(opciones.esVentaRapida
    || opciones.origen === 'caja_rapida'
    || (pedidoCompleto && (pedidoCompleto.esVentaRapida || pedidoCompleto.origen === 'caja_rapida' || pedidoCompleto.tipo === 'venta_rapida'))
    || (mesa && String(mesa).startsWith('VENTA DIRECTA')));

  let etiquetaCanalVR = '';
  if (esVentaRapida) {
    const canal = (pedidoCompleto && pedidoCompleto.canal) || '';
    if (canal === 'domicilio') etiquetaCanalVR = 'DOMICILIO';
    else if (canal === 'recoger') etiquetaCanalVR = 'RECOGER';
    else if (canal === 'mesa') {
      etiquetaCanalVR = pedidoCompleto.numeroMesa
        ? `MESA / AQUÍ ${pedidoCompleto.numeroMesa}`
        : 'MESA / AQUÍ';
    } else {
      etiquetaCanalVR = String(mesa || 'VENTA DIRECTA').replace(/^VENTA DIRECTA\s*-?\s*/i, '') || 'DIRECTA';
    }
  }

  let infoCliente = '';
  
  if (pedidoCompleto && pedidoCompleto.cliente) {
    const esDom = String(mesa || '').startsWith('DOM-') || (pedidoCompleto.canal === 'domicilio') || (esVentaRapida && pedidoCompleto.direccion);
    const esRec = String(mesa || '').startsWith('REC-') || (pedidoCompleto.canal === 'recoger');
    if (esVentaRapida) {
      infoCliente = `
        <div class="vr-cliente">
          <div class="vr-cliente-titulo">CLIENTE</div>
          <div class="vr-cliente-nombre">${pedidoCompleto.cliente}</div>
          ${pedidoCompleto.telefono ? `<div>Tel: ${pedidoCompleto.telefono}</div>` : ''}
          ${esDom && pedidoCompleto.direccion ? `<div>Dir: ${pedidoCompleto.direccion}</div>` : ''}
          ${esRec && pedidoCompleto.horaRecoger ? `<div>Hora: ${pedidoCompleto.horaRecoger}</div>` : ''}
        </div>
      `;
    } else {
      infoCliente = `
        <div class="cliente-info">
          <div class="cliente-label">Cliente:</div>
          <div class="cliente-datos">
            <strong>${pedidoCompleto.cliente}</strong><br>
            Tel: ${pedidoCompleto.telefono || 'No disponible'}<br>
            ${esDom
              ? `Dir: ${pedidoCompleto.direccion || 'No disponible'}`
              : (esRec ? `Hora: ${pedidoCompleto.horaRecoger || 'No disponible'}` : '')
            }
          </div>
        </div>
      `;
    }
  }

  // Información de cambio de mesa o tipo si existe
  let infoCambioMesa = '';
  if (pedidoCompleto && pedidoCompleto.cambioMesa) {
    const infoCambio = textoBloqueCambioPedido(pedidoCompleto.cambioMesa);
    infoCambioMesa = `
      <div class="cambio-mesa-info" style="border: 2px solid #000; padding: 2mm; margin: 1mm 0; text-align: center;">
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 1mm;">
          ${infoCambio.titulo}
        </div>
        <div style="font-size: 14px;">
          ${infoCambio.linea}
        </div>
        <div style="font-size: 12px; margin-top: 1mm;">
          ${pedidoCompleto.cambioMesa.fecha}
        </div>
      </div>
    `;
  }

  const totalItems = (productos || []).reduce((s, p) => s + (parseInt(p.cantidad, 10) || 0), 0);
  const fechaTicket = new Date().toLocaleString();
  const rondaTicket = rondaDeProductos(productos, opciones.ronda);
  const nombreMeseroTicket = String(
    opciones.nombreMesero
    || (pedidoCompleto && pedidoCompleto.nombreMesero)
    || ((productos || []).find(function (item) { return item && item.nombreMesero; }) || {}).nombreMesero
    || ''
  ).trim();
  const etiquetaRolMeseroTicket = (
    opciones.sexoMesero
    || (pedidoCompleto && pedidoCompleto.sexoMesero)
    || ((productos || []).find(function (item) { return item && item.sexoMesero; }) || {}).sexoMesero
  ) === 'femenino' ? 'Mesera' : 'Mesero';

  let contenido = '';
  if (esVentaRapida) {
    contenido = `
      <div class="vr-ticket">
        <div class="vr-banda">COCINA</div>
        <div class="vr-subbanda">VENTA RAPIDA</div>
        <div class="vr-canal">${etiquetaCanalVR || 'DIRECTA'}</div>
        <div class="vr-meta">
          <div>${fechaTicket}</div>
          <div>Items: ${totalItems}</div>
          ${nombreMeseroTicket ? `<div>${etiquetaRolMeseroTicket}: ${nombreMeseroTicket}</div>` : ''}
        </div>

        ${infoCliente}

        <div class="vr-sep"></div>
        <div class="vr-lista-titulo">PEDIDO</div>

        ${(productos || []).map(item => `
          <div class="vr-item">
            <div class="vr-cant">${item.cantidad}x</div>
            <div class="vr-prod">
              <div class="vr-nombre">${item.nombre}</div>
              ${item.detalles ? `<div class="vr-detalle">* ${item.detalles}</div>` : ''}
            </div>
          </div>
        `).join('')}

        <div class="vr-sep"></div>
        <div class="vr-footer">PREPARAR · VENTA RAPIDA</div>
      </div>
    `;
  } else {
    contenido = `
      <div class="header text-center">
        <h2 style="margin: 0; font-size: 28px; font-weight: bold;">COCINA</h2>
        <div class="mb-1" style="font-size: 22px; font-weight: bold;">Mesa: ${mesa}</div>
        <div class="mb-1" style="font-size: 20px; font-weight: bold;">Ronda: ${rondaTicket}</div>
        ${nombreMeseroTicket ? `<div class="mb-1" style="font-size: 18px; font-weight: bold;">${etiquetaRolMeseroTicket}: ${nombreMeseroTicket}</div>` : ''}
        <div class="mb-1">${fechaTicket}</div>
      </div>
      
      ${infoCambioMesa}
      ${infoCliente}
      
      <table>
        <thead>
          <tr>
            <th style="width: 20%">Cant</th>
            <th>Producto</th>
          </tr>
        </thead>
        <tbody>
          ${(productos || []).map(item => `
            <tr>
              <td style="font-size: 20px; font-weight: bold;">${item.cantidad}</td>
              <td>
                <div class="producto" style="font-weight: bold; font-size: 16px;">${item.nombre}</div>
                ${item.detalles ? `
                  <div class="detalles">
                    <span class="detalle-label">Detalle:</span> ${item.detalles}
                  </div>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="text-center mt-1">
        <div class="border-top">¡Gracias!</div>
      </div>
    `;
  }
  
  const htmlDocumento = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket de Cocina</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
            vertical-align: top;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .cliente-info {
            border: 1px solid #000;
            padding: 1mm;
            margin: 1mm 0;
          }
          .cliente-label {
            font-weight: bold;
            margin-bottom: 0.5mm;
          }
          .detalle-label {
            font-weight: bold;
          }
          /* ===== Ticket Venta Rápida ===== */
          .vr-ticket { width: 100%; }
          .vr-banda {
            text-align: center;
            font-size: 26px;
            font-weight: 900;
            letter-spacing: 2px;
            border: 2px solid #000;
            padding: 2mm 1mm;
            margin-bottom: 1mm;
          }
          .vr-subbanda {
            text-align: center;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 1px;
            background: #000;
            color: #fff;
            padding: 1.5mm 1mm;
            margin-bottom: 1.5mm;
          }
          .vr-canal {
            text-align: center;
            font-size: 18px;
            font-weight: 900;
            border: 2px dashed #000;
            padding: 2mm 1mm;
            margin-bottom: 2mm;
          }
          .vr-meta {
            text-align: center;
            font-size: 12px;
            margin-bottom: 2mm;
            line-height: 1.35;
          }
          .vr-cliente {
            border: 1.5px solid #000;
            padding: 2mm;
            margin-bottom: 2mm;
          }
          .vr-cliente-titulo {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1px;
            margin-bottom: 1mm;
            border-bottom: 1px solid #000;
            padding-bottom: 0.5mm;
          }
          .vr-cliente-nombre {
            font-size: 15px;
            font-weight: 800;
            margin-bottom: 0.5mm;
          }
          .vr-sep {
            border-top: 2px dashed #000;
            margin: 2mm 0;
          }
          .vr-lista-titulo {
            text-align: center;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 2px;
            margin-bottom: 1.5mm;
          }
          .vr-item {
            display: flex;
            gap: 2mm;
            align-items: flex-start;
            padding: 1.5mm 0;
            border-bottom: 1px dotted #000;
          }
          .vr-cant {
            min-width: 12mm;
            font-size: 22px;
            font-weight: 900;
            line-height: 1;
          }
          .vr-prod { flex: 1; }
          .vr-nombre {
            font-size: 16px;
            font-weight: 800;
            line-height: 1.2;
          }
          .vr-detalle {
            font-size: 13px;
            margin-top: 1mm;
            font-weight: 700;
          }
          .vr-footer {
            text-align: center;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1px;
            border: 1.5px solid #000;
            padding: 2mm 1mm;
            margin-top: 1mm;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            .vr-subbanda {
              background: #000 !important;
              color: #fff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              margin: 0;
            }
            body {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button id="btnCerrarImpresion" type="button">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenido}
        </div>
      </body>
    </html>
  `;

  const ventana = entregarDocumentoImpresionCocina(htmlDocumento, {
    silencioso: silencioso,
    alCerrar: alCerrar,
    mesa: mesa,
    nombreMesero: nombreMeseroTicket
  });
  if (!ventana) return;

  if (alCerrar) {
    enCerrarVentanaImpresion(ventana, alCerrar, {
      etiquetaBotonCerrar: esVentaRapida ? 'Continuar al recibo' : 'Cerrar',
      reutilizarVentana: !!esVentaRapida
    });
  } else {
    try {
      const btn = ventana.document.getElementById('btnCerrarImpresion');
      if (btn) btn.onclick = function () { try { ventana.close(); } catch (e) { /* ignore */ } };
    } catch (e) { /* ignore */ }
  }
}

// Función para mostrar el modal de pago
function mostrarModalPago() {
  // Primero generar el recibo preliminar
  generarReciboPreliminar();

  // Mostrar el modal de pago inmediatamente después de generar el recibo
  // setTimeout(() => {
    if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
      alert('Por favor, seleccione una mesa con productos');
      return;
    }

    const pedido = pedidoDeMesa(mesaSeleccionada);
    if (!pedido || !pedido.items || pedido.items.length === 0) {
      alert('No hay productos para generar recibo');
      return;
    }

    // Actualizar la lista de clientes (solo si se busca)
    const buscarPago = document.getElementById('buscarClientePago');
    if (buscarPago) buscarPago.value = '';
    actualizarListaClientesPago();
    
    // Calcular totales
    const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const propina = parseFloat(document.getElementById('propina').value) || 0;
    const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = obtenerValorDomicilioPedido(mesaSeleccionada, pedido);
    const propinaMonto = Math.round((subtotal * propina) / 100);
    const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

    // Actualizar los totales en el modal
    document.getElementById('subtotalModal').textContent = formatearPrecio(subtotal);
    document.getElementById('propinaModal').textContent = formatearPrecio(propinaMonto);
    document.getElementById('descuentoModal').textContent = formatearPrecio(descuento);
    
    // Limpiar el modal de totales
    const totalesSection = document.getElementById('totalesSection');
    totalesSection.innerHTML = `
      <div class="border-top border-light pt-2">
        <div class="d-flex justify-content-between mb-1">
          <span>Subtotal:</span>
          <span id="subtotalModal">${formatearPrecio(subtotal)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Propina (${propina}%):</span>
          <span id="propinaModal">${formatearPrecio(propinaMonto)}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Descuento:</span>
          <span id="descuentoModal">${formatearPrecio(descuento)}</span>
        </div>
        ${mesaSeleccionada.startsWith('DOM-') ? `
          <div class="d-flex justify-content-between mb-1">
            <span>Domicilio:</span>
            <span id="domicilioModal">${formatearPrecio(valorDomicilio)}</span>
          </div>
        ` : ''}
        <div class="d-flex justify-content-between mb-1 fw-bold">
          <span>Total:</span>
          <span id="totalModal">${formatearPrecio(total)}</span>
        </div>
      </div>
    `;
    
    // Limpiar campos del modal
    document.getElementById('montoRecibido').value = '';
    document.getElementById('cambio').textContent = formatearPrecio(0);
    document.getElementById('numeroTransferencia').value = '';
    
    // Actualizar opciones de método de pago
    const metodoPagoSelect = document.getElementById('metodoPago');
    metodoPagoSelect.innerHTML = `
      <option value="efectivo">Efectivo</option>
      <option value="tarjeta">Tarjeta</option>
      <option value="transferencia">Transferencia</option>
      <option value="credito">Crédito</option>
      <option value="mixto">Efectivo y Transferencia</option>
    `;
    
    // Mostrar el modal después de imprimir el recibo preliminar
    abrirModalEstatico('modalPago');

    // Asegurarse de que el event listener no se duplique en montoRecibido
    const montoRecibidoInput = document.getElementById('montoRecibido');
    montoRecibidoInput.removeEventListener('input', calcularCambio);
    montoRecibidoInput.addEventListener('input', calcularCambio);

    // Asegurarse de que el event listener no se duplique en metodoPago
    metodoPagoSelect.removeEventListener('change', toggleMetodoPago);
    metodoPagoSelect.addEventListener('change', () => {
      toggleMetodoPago();
      calcularCambio(); // Sincroniza los campos al cambiar método
    });

    // Llamar a toggleMetodoPago y calcularCambio para ajustar los inputs y valores según el método seleccionado actual
    toggleMetodoPago();
    calcularCambio();
  // }, 500); // Dar tiempo para que el usuario vea el recibo preliminar
}

// Función para actualizar la lista de clientes
function actualizarListaClientes() {
  buscarClientes();
}

// Función para actualizar la lista de clientes en el modal de pago
function actualizarListaClientesPago() {
  buscarClientesPago();
}

function renderizarResultadosClientes(lista, busqueda, alSeleccionar, opciones) {
  if (!lista) return;
  lista.innerHTML = '';
  const query = String(busqueda || '').trim();
  const soloConBusqueda = !!(opciones && opciones.soloConBusqueda);

  if (soloConBusqueda && !query) {
    lista.innerHTML = '<p class="text-muted mb-0 small">Escriba nombre o teléfono para buscar. Si no busca, el pedido queda sin cliente.</p>';
    return;
  }

  const filtrados = filtrarClientesParaLista(busqueda);

  if (filtrados.length === 0) {
    lista.innerHTML = query
      ? '<p class="text-muted mb-0">No se encontró ese cliente. Revise el nombre o el teléfono, o créelo abajo.</p>'
      : '<p class="text-muted mb-0">No hay clientes guardados. Cree uno nuevo.</p>';
    return;
  }

  if (!query) {
    const hint = document.createElement('div');
    hint.className = 'small text-muted mb-2';
    hint.textContent = 'Clientes recientes · escriba nombre o teléfono para buscar';
    lista.appendChild(hint);
  }

  const max = 20;
  filtrados.slice(0, max).forEach(cliente => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'list-group-item list-group-item-action bg-dark text-white border-light text-start';
    const direccion = (cliente.direccion && cliente.direccion !== 'No proporcionado') ? cliente.direccion : '';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h6 class="mb-1">${escaparHtmlTexto(nombreCompletoCliente(cliente))}</h6>
          <small>${escaparHtmlTexto(cliente.telefono || '')}${direccion ? ' · ' + escaparHtmlTexto(direccion) : ''}</small>
        </div>
        <span class="badge bg-info text-dark align-self-center">Usar</span>
      </div>
    `;
    item.addEventListener('click', () => alSeleccionar(cliente.id));
    lista.appendChild(item);
  });

  if (filtrados.length > max) {
    const extra = document.createElement('div');
    extra.className = 'small text-muted mt-2';
    extra.textContent = `Mostrando ${max} de ${filtrados.length}. Siga escribiendo para afinar la búsqueda.`;
    lista.appendChild(extra);
  }
}

function buscarClientes() {
  const input = document.getElementById('buscarCliente');
  const listaClientes = document.getElementById('listaClientes');
  if (!listaClientes) return;
  renderizarResultadosClientes(listaClientes, input ? input.value : '', seleccionarClientePorId, { soloConBusqueda: true });
}

function buscarClientesPago() {
  const input = document.getElementById('buscarClientePago');
  const listaClientes = document.getElementById('listaClientesPago');
  if (!listaClientes) return;
  renderizarResultadosClientes(listaClientes, input ? input.value : '', seleccionarClientePagoPorId, { soloConBusqueda: true });
}

function seleccionarClientePorId(clienteId) {
  recargarClientesDesdeStorage();
  const cliente = clientes.find(c => String(c.id) === String(clienteId));
  if (!cliente) {
    alert('No se encontró el cliente seleccionado. Intente buscarlo de nuevo.');
    buscarClientes();
    return;
  }
  seleccionarCliente(cliente);
}

function seleccionarClientePagoPorId(clienteId) {
  recargarClientesDesdeStorage();
  const cliente = clientes.find(c => String(c.id) === String(clienteId));
  if (!cliente) {
    alert('No se encontró el cliente seleccionado. Intente buscarlo de nuevo.');
    buscarClientesPago();
    return;
  }
  seleccionarClientePago(cliente);
}

// Función para seleccionar un cliente en el pago
function seleccionarClientePago(cliente) {
  const pedido = pedidoDeMesa(mesaSeleccionada);
  if (pedido) {
    pedido.cliente = nombreCompletoCliente(cliente);
    pedido.telefono = cliente.telefono;
    pedido.direccion = cliente.direccion;
    guardarMesas();
    
    // Actualizar opciones de método de pago para incluir crédito
    const metodoPagoSelect = document.getElementById('metodoPago');
    metodoPagoSelect.innerHTML = `
      <option value="efectivo">Efectivo</option>
      <option value="tarjeta">Tarjeta</option>
      <option value="transferencia">Transferencia</option>
      <option value="credito">Crédito</option>
      <option value="mixto">Efectivo y Transferencia</option>
    `;
    
    // Mostrar mensaje de confirmación y quitar la lista para no elegir otro por error
    const listaPago = document.getElementById('listaClientesPago');
    if (listaPago) {
      listaPago.innerHTML = '';
      const mensaje = document.createElement('div');
      mensaje.className = 'alert alert-success mt-2 mb-0';
      mensaje.textContent = `Cliente ${nombreCompletoCliente(cliente)} seleccionado`;
      listaPago.appendChild(mensaje);
    }
    const inputPago = document.getElementById('buscarClientePago');
    if (inputPago) inputPago.value = '';
  }
}

// Función para calcular el cambio
function calcularCambio() {
  const montoRecibido = parseFloat(document.getElementById('montoRecibido').value) || 0;
  const totalElement = document.getElementById('totalModal');
  // Eliminar el símbolo de moneda y los separadores de miles, y convertir a número
  const total = parseFloat(totalElement.textContent.replace(/[$.]/g, '').replace(/,/g, ''));
  const cambio = montoRecibido - total;
  
  const cambioElement = document.getElementById('cambio');
  if (cambio >= 0) {
    cambioElement.textContent = formatearPrecio(cambio);
    cambioElement.classList.remove('text-danger', 'bg-danger');
    cambioElement.classList.add('text-success', 'bg-light');
    cambioElement.style.fontWeight = 'bold';
    cambioElement.style.fontSize = '1.2em';
  } else {
    cambioElement.textContent = 'Monto insuficiente';
    cambioElement.classList.remove('text-success', 'bg-light');
    cambioElement.classList.add('text-danger', 'bg-danger');
    cambioElement.style.fontWeight = 'bold';
    cambioElement.style.fontSize = '1.2em';
  }

  // Si el método de pago es mixto, actualizar automáticamente el monto de transferencia
  const metodoPago = document.getElementById('metodoPago').value;
  if (metodoPago === 'mixto') {
    const montoTransferencia = total - montoRecibido;
    document.getElementById('montoTransferencia').value = montoTransferencia > 0 ? montoTransferencia : 0;
  }
}

// Función para alternar entre métodos de pago
function toggleMetodoPago() {
  const metodo = document.getElementById('metodoPago').value;
  const efectivoSection = document.getElementById('efectivoSection');
  const transferenciaSection = document.getElementById('transferenciaSection');
  const montoTransferenciaInput = document.getElementById('montoTransferencia');
  // Mostrar/ocultar secciones según el método
  if (metodo === 'efectivo') {
    efectivoSection.style.display = 'block';
    transferenciaSection.style.display = 'none';
  } else if (metodo === 'transferencia') {
    efectivoSection.style.display = 'none';
    transferenciaSection.style.display = 'block';
    // Ocultar monto por transferencia, mostrar solo número
    if (montoTransferenciaInput) montoTransferenciaInput.style.display = 'none';
  } else if (metodo === 'mixto') {
    efectivoSection.style.display = 'block';
    transferenciaSection.style.display = 'block';
    // Mostrar monto por transferencia
    if (montoTransferenciaInput) montoTransferenciaInput.style.display = '';
  } else if (metodo === 'credito') {
    efectivoSection.style.display = 'none';
    transferenciaSection.style.display = 'none';
  } else {
    efectivoSection.style.display = 'none';
    transferenciaSection.style.display = 'none';
  }
}

// Función para mostrar el modal de cliente
function mostrarModalCliente(tipo) {
  tipoPedidoActual = tipo;
  recargarClientesDesdeStorage();
  ocultarFormularioNuevoCliente();
  const input = document.getElementById('buscarCliente');
  if (input) input.value = '';
  const aviso = document.getElementById('avisoClienteDuplicado');
  if (aviso) {
    aviso.style.display = 'none';
    aviso.innerHTML = '';
  }
  abrirModalEstatico('modalCliente');
  buscarClientes();
  setTimeout(() => {
    const el = document.getElementById('buscarCliente');
    if (el) el.focus();
  }, 250);
}

function mostrarFormularioNuevoCliente() {
  document.getElementById('formularioNuevoCliente').style.display = 'block';
  document.getElementById('listaClientes').style.display = 'none';
  const busqueda = (document.getElementById('buscarCliente')?.value || '').trim();
  const nombreEl = document.getElementById('nuevoClienteNombre');
  const telEl = document.getElementById('nuevoClienteTelefono');
  if (busqueda && /^\+?\d[\d\s-]{5,}$/.test(busqueda)) {
    if (telEl && !telEl.value) telEl.value = normalizarTelefono(busqueda) || busqueda;
  } else if (busqueda && nombreEl && !nombreEl.value) {
    nombreEl.value = busqueda;
  }
  avisarClienteDuplicado();
  setTimeout(() => {
    if (nombreEl && !nombreEl.value) nombreEl.focus();
    else if (telEl) telEl.focus();
  }, 100);
}

function ocultarFormularioNuevoCliente() {
  const form = document.getElementById('formularioNuevoCliente');
  const lista = document.getElementById('listaClientes');
  if (form) form.style.display = 'none';
  if (lista) lista.style.display = 'block';
  const aviso = document.getElementById('avisoClienteDuplicado');
  if (aviso) {
    aviso.style.display = 'none';
    aviso.innerHTML = '';
  }
  buscarClientes();
}

function avisarClienteDuplicado() {
  const aviso = document.getElementById('avisoClienteDuplicado');
  if (!aviso) return;
  const nombre = document.getElementById('nuevoClienteNombre')?.value || '';
  const telefono = document.getElementById('nuevoClienteTelefono')?.value || '';
  const existente = encontrarClienteDuplicado(nombre, telefono);
  if (!existente) {
    aviso.style.display = 'none';
    aviso.innerHTML = '';
    return;
  }
  aviso.style.display = 'block';
  aviso.className = 'alert alert-warning py-2 mb-3';
  aviso.innerHTML = `
    Ya existe <strong>${escaparHtmlTexto(nombreCompletoCliente(existente))}</strong>
    (${escaparHtmlTexto(existente.telefono || '')}).
    <button type="button" class="btn btn-sm btn-warning ms-2" onclick="seleccionarClientePorId('${String(existente.id).replace(/'/g, '')}')">
      Usar este cliente
    </button>
  `;
}

function guardarNuevoClienteDesdePOS() {
  const nombre = (document.getElementById('nuevoClienteNombre').value || '').trim();
  const telefono = (document.getElementById('nuevoClienteTelefono').value || '').trim();
  const direccion = (document.getElementById('nuevoClienteDireccion').value || '').trim();

  if (!nombre || !telefono) {
    alert('Por favor, complete los campos requeridos');
    return;
  }

  const existente = encontrarClienteDuplicado(nombre, telefono);
  if (existente) {
    const usar = confirm(
      `Este cliente ya está guardado:\n${nombreCompletoCliente(existente)} - ${existente.telefono || ''}\n\n¿Usar el cliente existente en lugar de crear otro?`
    );
    if (usar) {
      document.getElementById('nuevoClienteNombre').value = '';
      document.getElementById('nuevoClienteTelefono').value = '';
      document.getElementById('nuevoClienteDireccion').value = '';
      ocultarFormularioNuevoCliente();
      seleccionarCliente(existente);
    }
    return;
  }

  const nuevoCliente = {
    id: Date.now(),
    documento: telefono,
    nombre: nombre,
    apellido: 'No proporcionado',
    telefono: telefono,
    correo: 'No proporcionado',
    direccion: direccion || 'No proporcionado',
    fechaRegistro: new Date().toISOString()
  };

  recargarClientesDesdeStorage();
  clientes.push(nuevoCliente);
  guardarClientes();

  document.getElementById('nuevoClienteNombre').value = '';
  document.getElementById('nuevoClienteTelefono').value = '';
  document.getElementById('nuevoClienteDireccion').value = '';

  ocultarFormularioNuevoCliente();
  seleccionarCliente(nuevoCliente);
}

// Función para seleccionar un cliente
function seleccionarCliente(cliente) {
  if (tipoPedidoActual === 'domicilio') {
    crearPedidoDomicilioConCliente(cliente);
  } else {
    crearPedidoRecogerConCliente(cliente);
  }
  
  // Cerrar modal
  const modalEl = document.getElementById('modalCliente');
  const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
  if (modal) modal.hide();
}

window.addEventListener('storage', (e) => {
  if (e.key !== 'clientes') return;
  recargarClientesDesdeStorage();
  const modalCliente = document.getElementById('modalCliente');
  if (modalCliente && modalCliente.classList.contains('show')) {
    buscarClientes();
  }
  const listaPago = document.getElementById('listaClientesPago');
  const modalPago = document.getElementById('modalPago');
  if (listaPago && modalPago && modalPago.classList.contains('show')) {
    buscarClientesPago();
  }
});

// Función para crear pedido de domicilio con cliente
function crearPedidoDomicilioConCliente(cliente) {
  contadorDomicilios++;
  guardarContadores();
  
  const idPedido = `DOM-${contadorDomicilios}`;
  const pedido = {
    tipo: 'domicilio',
    numero: contadorDomicilios,
    cliente: nombreCompletoCliente(cliente),
    telefono: cliente.telefono,
    direccion: cliente.direccion,
    items: [],
    estado: 'pendiente',
    fecha: new Date().toLocaleString(),
    ronda: 1,
    sesionId: crearIdSesionMesa()
  };

  mesasActivas.set(idPedido, pedido);
  guardarMesas(true);
  actualizarMesasActivas();
  seleccionarMesa(idPedido);
}

// Función para crear pedido para recoger con cliente
function crearPedidoRecogerConCliente(cliente) {
  contadorRecoger++;
  guardarContadores();
  
  const idPedido = `REC-${contadorRecoger}`;
  const pedido = {
    tipo: 'recoger',
    numero: contadorRecoger,
    cliente: nombreCompletoCliente(cliente),
    telefono: cliente.telefono,
    horaRecoger: '', // Dejar vacío o poner 'No especificada' si prefieres
    items: [],
    estado: 'pendiente',
    fecha: new Date().toLocaleString(),
    ronda: 1,
    sesionId: crearIdSesionMesa()
  };

  mesasActivas.set(idPedido, pedido);
  guardarMesas(true);
  actualizarMesasActivas();
  seleccionarMesa(idPedido);
}

// Función para reiniciar contadores (puedes llamarla al inicio del día)
function reiniciarContadores() {
  reiniciarContadoresDomRec();
}

// Modificar las funciones existentes de crear pedido
function crearPedidoDomicilio() {
  mostrarModalCliente('domicilio');
}

function crearPedidoRecoger() {
  mostrarModalCliente('recoger');
}

// Función para crear nueva mesa
function crearNuevaMesa() {
  const numeroMesa = String(document.getElementById('nuevaMesa').value || '').trim();
  
  if (!numeroMesa) {
    alert('Por favor, ingrese un número de mesa');
    return;
  }

  if (mesaEstaActiva(numeroMesa)) {
    const pedidoExistente = pedidoDeMesa(numeroMesa);
    if (sesionMesaYaCobrada(pedidoExistente && pedidoExistente.sesionId)) {
      liberarMesaTrasCobro(numeroMesa, pedidoExistente && pedidoExistente.sesionId);
    } else {
      const cantidad = (pedidoExistente && Array.isArray(pedidoExistente.items))
        ? pedidoExistente.items.reduce((sum, item) => sum + (item.cantidad || 0), 0)
        : 0;
      alert(`La mesa ${numeroMesa} ya tiene una cuenta abierta (${cantidad} producto${cantidad === 1 ? '' : 's'}). Cobre o elimine ese pedido antes de sentar a otro cliente.`);
      seleccionarMesa(numeroMesa);
      document.getElementById('nuevaMesa').value = '';
      return;
    }
  }

  // Crear nueva mesa como objeto (un array pierde los productos al guardar)
  limpiarCocinaDeMesa(numeroMesa);
  mesasActivas.set(numeroMesa, crearPedidoMesaVacio());
  guardarMesas();
  
  // Limpiar el input
  document.getElementById('nuevaMesa').value = '';
  
  // Actualizar la vista de mesas
  actualizarMesasActivas();
  
  // Seleccionar la nueva mesa
  seleccionarMesa(numeroMesa);
}

// Función para eliminar un pedido/mesa
function eliminarPedido() {
  if (!mesaSeleccionada) {
    alert('Por favor, seleccione una mesa o pedido para eliminar');
    return;
  }

  let mensaje = '';
  if (mesaSeleccionada.startsWith('DOM-')) {
    mensaje = '¿Está seguro que desea eliminar este pedido a domicilio?';
  } else if (mesaSeleccionada.startsWith('REC-')) {
    mensaje = '¿Está seguro que desea eliminar este pedido para recoger?';
  } else {
    mensaje = '¿Está seguro que desea eliminar esta mesa?';
  }

  if (confirm(mensaje)) {
    if (window.ToySoftFirebase && typeof ToySoftFirebase.marcarMesaEliminada === 'function') {
      ToySoftFirebase.marcarMesaEliminada(mesaSeleccionada);
    }
    const idBorrado = String(mesaSeleccionada);
    Array.from(mesasActivas.keys()).forEach(function (clave) {
      if (clave === mesaSeleccionada || String(clave) === idBorrado) mesasActivas.delete(clave);
    });
    limpiarCocinaDeMesa(mesaSeleccionada);
    limpiarCocinaDeMesa(idBorrado);
    anularTicketsMeseroDeMesa(idBorrado);

    guardarMesas(true);

    // Limpiar la interfaz
    document.getElementById('ordenCuerpo').innerHTML = '';
    document.getElementById('propina').value = '';
    document.getElementById('descuento').value = '';
    document.getElementById('totalOrden').textContent = formatearPrecio(0);
    document.getElementById('desgloseTotal').innerHTML = '';
    document.getElementById('mesaActual').textContent = '-';
    mesaSeleccionada = null;
    actualizarBotonCambioPedido();

    // Actualizar vista de mesas
    actualizarMesasActivas();
  }
}

// Función para procesar el pago
let pagoEnCurso = false;
function botonConfirmarPago() {
  return document.querySelector('#modalPago .btn-primary[onclick*="procesarPago"], #btnConfirmarPago');
}

function desbloquearPago() {
  pagoEnCurso = false;
  const btnPago = botonConfirmarPago();
  if (btnPago) {
    btnPago.disabled = false;
    if (btnPago.dataset.textoOriginal) {
      btnPago.innerHTML = btnPago.dataset.textoOriginal;
      delete btnPago.dataset.textoOriginal;
    }
  }
}

function procesarPago() {
  if (pagoEnCurso) return;
  const btnPago = botonConfirmarPago();
  const metodoPago = document.getElementById('metodoPago').value;
  const pedido = pedidoDeMesa(mesaSeleccionada);
  
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos en la orden');
    return;
  }

  const sesionActual = pedido.sesionId || null;
  if (sesionActual && sesionMesaYaCobrada(sesionActual)) {
    const mesaCobrada = mesaSeleccionada;
    liberarMesaTrasCobro(mesaCobrada, sesionActual);
    try {
      const modalPago = bootstrap.Modal.getInstance(document.getElementById('modalPago'));
      if (modalPago) modalPago.hide();
    } catch (e) { /* ignore */ }
    actualizarMesasActivas();
    limpiarVistaOrdenSiPedidoLibre(mesaCobrada);
    return;
  }

  pagoEnCurso = true;
  if (btnPago) {
    btnPago.disabled = true;
    btnPago.dataset.textoOriginal = btnPago.innerHTML;
    btnPago.innerHTML = 'Procesando...';
  }

  // ========================================
  // VALIDACIÓN FINAL DE STOCK ANTES DE PROCESAR
  // ========================================
  try {
    if (typeof verificarDisponibilidadProducto === 'function') {
      const productosSinStock = [];
      
      for (const item of pedido.items) {
        const disponibilidad = verificarDisponibilidadProducto(item.nombre, item.cantidad);
        
        if (!disponibilidad.disponible) {
          productosSinStock.push({
            nombre: item.nombre,
            cantidadSolicitada: item.cantidad,
            stockDisponible: disponibilidad.stockActual,
            mensaje: disponibilidad.mensaje
          });
        }
      }
      
      if (productosSinStock.length > 0) {
        const mensaje = productosSinStock.map(p => 
          `${p.nombre}: solicitado ${p.cantidadSolicitada}, disponible ${p.stockDisponible}`
        ).join('\n');
        
        alert(`⚠️ No se puede procesar la venta. Los siguientes productos no tienen stock suficiente:\n\n${mensaje}\n\nPor favor, ajusta las cantidades o elimina estos productos de la orden.`);
        desbloquearPago();
        return; // Bloquear el procesamiento de la venta
      }
    }
  } catch (error) {
    console.error('Error al validar stock antes de procesar venta:', error);
    // Continuar con la venta si hay error en la verificación (por seguridad)
  }

  // Validar que haya cliente seleccionado para crédito
  if (metodoPago === 'credito' && !pedido.cliente) {
    alert('Debe seleccionar un cliente para realizar un pago a crédito');
    desbloquearPago();
    return;
  }

  // Calcular totales
  const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = obtenerValorDomicilioPedido(mesaSeleccionada, pedido);
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

  // Validar montos para pago mixto
  if (metodoPago === 'mixto') {
    const montoEfectivo = parseFloat(document.getElementById('montoRecibido').value) || 0;
    const montoTransferencia = parseFloat(document.getElementById('montoTransferencia').value) || 0;
    const totalMixto = montoEfectivo + montoTransferencia;

    if (totalMixto !== total) {
      alert('La suma de los montos en efectivo y transferencia debe ser igual al total');
      desbloquearPago();
      return;
    }
  }

  // Crear objeto de factura
  const factura = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    mesa: mesaSeleccionada,
    items: pedido.items,
    subtotal: subtotal,
    propina: propina,
    propinaMonto: propinaMonto,
    descuento: descuento,
    valorDomicilio: valorDomicilio,
    nombreDomiciliario: (mesaSeleccionada.startsWith('DOM-')
      ? (document.getElementById('nombreDomiciliario')?.value || '').trim()
      : ''),
    total: total,
    metodoPago: metodoPago,
    montoRecibido: (function () {
      if (metodoPago !== 'efectivo' && metodoPago !== 'mixto') return 0;
      const escrito = parseFloat(document.getElementById('montoRecibido').value);
      if (Number.isFinite(escrito)) return escrito;
      return metodoPago === 'efectivo' ? total : 0;
    })(),
    montoTransferencia: metodoPago === 'transferencia' || metodoPago === 'mixto' ? (parseFloat(document.getElementById('montoTransferencia').value) || 0) : 0,
    cambio: (function () {
      if (metodoPago !== 'efectivo' && metodoPago !== 'mixto') return 0;
      const escrito = parseFloat(document.getElementById('montoRecibido').value);
      if (metodoPago === 'mixto') return 0;
      const recibido = Number.isFinite(escrito) ? escrito : total;
      return Math.max(0, Math.round(recibido - total));
    })(),
    numeroTransferencia: metodoPago === 'transferencia' || metodoPago === 'mixto' ? document.getElementById('numeroTransferencia').value : null,
    cliente: pedido.cliente || null,
    telefono: pedido.telefono || null,
    direccion: pedido.direccion || null,
    horaRecoger: pedido.horaRecoger || null,
    sesionId: pedido.sesionId || null,
    tipo: mesaSeleccionada.startsWith('DOM-') ? 'domicilio' : 
          mesaSeleccionada.startsWith('REC-') ? 'recoger' : 'mesa',
    estado: metodoPago === 'credito' ? 'pendiente' : 'pagado'
  };

  const datosMeseroVenta = datosMeseroDePedido(pedido);
  factura.origen = datosMeseroVenta.origen;
  if (datosMeseroVenta.nombreMesero) factura.nombreMesero = datosMeseroVenta.nombreMesero;
  if (datosMeseroVenta.sexoMesero) factura.sexoMesero = datosMeseroVenta.sexoMesero;
  if (datosMeseroVenta.meseroUid) factura.meseroUid = datosMeseroVenta.meseroUid;

  registrarVentaUnificada(factura);
  if (factura.nombreDomiciliario) guardarNombreDomiciliario(factura.nombreDomiciliario);

  // Debug: verificar que se guardó correctamente
  console.log('🔍 DEBUG VENTA DE MESA:');
  console.log('   - Factura creada:', factura);

  // ========================================
  // INTEGRACIÓN CON INVENTARIO
  // ========================================
  try {
    // Verificar si existe la función de actualización de inventario
    if (typeof actualizarInventarioDesdeVenta === 'function') {
      // Preparar los items para la actualización del inventario
      const itemsParaInventario = pedido.items.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        ventaId: factura.id,
        mesa: mesaSeleccionada
      }));
      
      // Actualizar inventario
      const resultadoInventario = actualizarInventarioDesdeVenta(itemsParaInventario);
      
      if (resultadoInventario.success) {
        console.log('Inventario actualizado exitosamente:', resultadoInventario);
        
        // Mostrar notificación si hay productos con stock bajo
        if (resultadoInventario.productosStockBajo && resultadoInventario.productosStockBajo.length > 0) {
          const productosBajo = resultadoInventario.productosStockBajo.map(p => p.nombre).join(', ');
          console.warn(`Productos con stock bajo después de la venta: ${productosBajo}`);
        }
        
        // Mostrar notificación si hay productos no encontrados en inventario
        if (resultadoInventario.productosNoEncontrados && resultadoInventario.productosNoEncontrados.length > 0) {
          const productosNoEncontrados = resultadoInventario.productosNoEncontrados.join(', ');
          console.warn(`Productos no encontrados en inventario: ${productosNoEncontrados}`);
        }
      } else {
        console.error('Error al actualizar inventario:', resultadoInventario.message);
      }
    } else {
      console.log('Función de actualización de inventario no disponible');
    }
  } catch (error) {
    console.error('Error en la integración con inventario:', error);
  }

  let tipoPedido = '';
  let infoAdicional = '';

  if (mesaSeleccionada.startsWith('DOM-')) {
    tipoPedido = 'Pedido a Domicilio';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Dir:</strong> <strong>${pedido.direccion || 'No especificada'}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
        </div>
      `;
    }
  } else if (mesaSeleccionada.startsWith('REC-')) {
    tipoPedido = 'Pedido para Recoger';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
          ${pedido.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${pedido.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  }

  const contenidoRecibo = `
    <div class="logo-container">
      ${localStorage.getItem('logoNegocio') ? 
        `<img src="${localStorage.getItem('logoNegocio')}" alt="Logo">` : 
        ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date().toLocaleString()}</div>
      ${!mesaSeleccionada.startsWith('DOM-') && !mesaSeleccionada.startsWith('REC-') ? 
        `<div class="mb-1">Mesa: ${mesaSeleccionada}</div>` : ''}
    </div>
    
    ${infoAdicional}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items.map(item => `
          <tr>
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.precio * item.cantidad)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(subtotal)}</span></div>
      <div class="mb-1">Propina (${propina}%): <span class="text-right">$ ${formatearNumero(propinaMonto)}</span></div>
      <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(descuento)}</span></div>
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>${(factura.nombreDomiciliario || '').trim() ? `<div class="mb-1">Domiciliario: ${factura.nombreDomiciliario}</div>` : ''}` : ''}
      <div class="mb-1 total-row"><strong>Total: $ ${formatearNumero(total)}</strong></div>
    </div>
    
    <div class="border-top">
      <div class="mb-1">Método de Pago: ${metodoPago}</div>
      ${metodoPago === 'efectivo' || metodoPago === 'mixto' ? `
        <div class="mb-1">Recibido en Efectivo: $ ${formatearNumero(factura.montoRecibido)}</div>
        <div class="mb-1">Cambio: $ ${formatearNumero(factura.cambio)}</div>
      ` : ''}
      ${metodoPago === 'transferencia' ? `
        <div class="mb-1">N° Transferencia: ${factura.numeroTransferencia}</div>
        <div class="mb-1">Transferencia: $ ${formatearNumero(factura.montoTransferencia)}</div>
      ` : ''}
      ${metodoPago === 'mixto' ? `
        <div class="mb-1">Monto en Efectivo: $ ${formatearNumero(factura.montoRecibido)}</div>
        <div class="mb-1">Cambio: $ ${formatearNumero(factura.cambio)}</div>
        <div class="mb-1">N° Transferencia: ${factura.numeroTransferencia}</div>
        <div class="mb-1">Transferencia: $ ${formatearNumero(factura.montoTransferencia)}</div>
      ` : ''}
    </div>
    
    ${htmlPieDatosNegocioTicket()}
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su compra!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  const mesaCobrada = mesaSeleccionada;
  const sesionCobrada = pedido.sesionId || null;
  liberarMesaTrasCobro(mesaCobrada, sesionCobrada);
  try {
    const modalPago = bootstrap.Modal.getInstance(document.getElementById('modalPago'));
    if (modalPago) modalPago.hide();
  } catch (e) {
    console.warn('No se pudo cerrar el modal de pago:', e);
  }
  actualizarMesasActivas();
  document.getElementById('ordenCuerpo').innerHTML = '';
  document.getElementById('propina').value = '';
  document.getElementById('descuento').value = '';
  document.getElementById('valorDomicilio').value = '';
  document.getElementById('totalOrden').textContent = '$ 0';
  document.getElementById('desgloseTotal').innerHTML = '';
  document.getElementById('mesaActual').textContent = '-';
  mesaSeleccionada = null;

  try {
    const ventana = obtenerVentanaImpresion();
    if (!ventana) {
      alert('La venta se registró y la mesa quedó libre. No se pudo abrir el recibo (revise el bloqueador de ventanas).');
      desbloquearPago();
      return;
    }
    try { ventana.document.open(); } catch (e) { /* ignore */ }
    // Escribir el contenido completo en la ventana
    ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo de Pago</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
    ventana.document.close();
    ventana.focus();
  } catch (error) {
    console.error('Error al imprimir recibo de mesa:', error);
    alert('La venta se registró y la mesa quedó libre. Hubo un problema al imprimir el recibo.');
  }
  desbloquearPago();
}

// Función para reimprimir ticket de cocina desde el historial
function reimprimirTicketCocina(ordenId) {
  const id = String(ordenId);
  const orden = (historialCocina || []).find(function (o) { return String(o.id) === id; });
  if (orden) imprimirTicketCocinaDeOrden(orden);
}

// Función para reimprimir factura desde el historial
function reimprimirFactura(ventaId) {
  const venta = historialVentas.find(v => v.id === ventaId);
  if (venta) {
    const ventana = obtenerVentanaImpresion();
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
      return;
    }
    
    let tipoPedido = '';
    let infoAdicional = '';
    
    if (venta.mesa.startsWith('DOM-')) {
      tipoPedido = 'Pedido a Domicilio';
      if (venta.cliente) {
        infoAdicional = `
          <div class="border-top">
            <div class="mb-1"><strong>Cliente:</strong> <strong>${venta.cliente}</strong></div>
            <div class="mb-1"><strong>Dir:</strong> <strong>${venta.direccion}</strong></div>
            <div class="mb-1"><strong>Tel:</strong> <strong>${venta.telefono}</strong></div>
          </div>
        `;
      }
    } else if (venta.mesa.startsWith('REC-')) {
      tipoPedido = 'Pedido para Recoger';
      if (venta.cliente) {
        infoAdicional = `
          <div class="border-top">
            <div class="mb-1"><strong>Cliente:</strong> <strong>${venta.cliente}</strong></div>
            <div class="mb-1"><strong>Tel:</strong> <strong>${venta.telefono}</strong></div>
            ${venta.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${venta.horaRecoger}</strong></div>` : ''}
          </div>
        `;
      }
    }

    const contenido = `
      <html>
        <head>
          <title>Recibo</title>
          <style>
            body { 
              font-family: monospace;
              font-size: 14px;
              width: 57mm;
              margin: 0;
              padding: 1mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .mb-1 { margin-bottom: 0.5mm; }
            .mt-1 { margin-top: 0.5mm; }
            table { 
              width: 100%;
              border-collapse: collapse;
              margin: 1mm 0;
              font-size: 14px;
            }
            th, td { 
              padding: 0.5mm;
              text-align: left;
              font-size: 14px;
            }
            .border-top { 
              border-top: 1px dashed #000;
              margin-top: 1mm;
              padding-top: 1mm;
            }
            .header {
              border-bottom: 1px dashed #000;
              padding-bottom: 1mm;
              margin-bottom: 1mm;
            }
            .total-row {
              font-weight: bold;
              font-size: 16px;
            }
            .botones-impresion {
              position: fixed;
              top: 10px;
              right: 10px;
              z-index: 1000;
              background: #fff;
              padding: 5px;
              border-radius: 5px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .botones-impresion button {
              margin: 0 5px;
              padding: 5px 10px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 3px;
              cursor: pointer;
            }
            .botones-impresion button:hover {
              background: #0056b3;
            }
            .logo-container {
              text-align: center;
              margin-bottom: 2mm;
            }
            .logo-container img {
              max-width: 100%;
              max-height: 120px;
            }
            @media print {
              .botones-impresion {
                display: none;
              }
              @page {
                margin: 0;
                size: 57mm auto;
              }
              body {
                width: 57mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="botones-impresion">
            <button onclick="window.print()">Imprimir</button>
            <button onclick="window.close()">Cerrar</button>
          </div>
          <div id="contenido"></div>
        </body>
      </html>
    `;
    
    ventana.document.write(contenido);
    ventana.document.close();
  }
}

// Función simplificada para mostrar el modal de cierre diario
function mostrarModalCierreDiario() {
    try {
        aplicarEtiquetasHorarioOperacion();
        console.log('=== INICIANDO CIERRE ADMINISTRATIVO ===');
        const resumen = construirResumenCierre();
        pintarResumenCierreModal(resumen);
        console.log(`📊 Ventas del cierre: ${resumen.ventas.length} (rango: ${resumen.rango})`);

        const nombreCierreEl = document.getElementById('nombreCierre');
        const nombreRecibeEl = document.getElementById('nombreRecibe');
        const montoBaseCajaEl = document.getElementById('montoBaseCaja');
        const detallesCierreEl = document.getElementById('detallesCierre');
        if (nombreCierreEl) nombreCierreEl.value = '';
        if (nombreRecibeEl) nombreRecibeEl.value = '';
        if (montoBaseCajaEl) {
            montoBaseCajaEl.value = (resumen.baseCajaAnterior || 0) > 0 ? String(resumen.baseCajaAnterior) : '';
        }
        if (detallesCierreEl) detallesCierreEl.value = '';

        if (typeof debugVentasConflictivas === 'function') debugVentasConflictivas();
        abrirModalEstatico('modalCierreDiario');

        console.log('✅ Modal de cierre mostrado correctamente');
        console.log(`💰 Total ventas: ${textoDineroCierre(resumen.calculos.totalGeneral)} | Domicilios a restar: ${textoDineroCierre(resumen.domicilios.total)} | Balance: ${textoDineroCierre(resumen.balance)}`);
    } catch (error) {
        console.error('Error en mostrarModalCierreDiario:', error);
        alert('Error al mostrar el cierre diario: ' + error.message);
    }
}

// ===== NUEVO CIERRE ADMINISTRATIVO MEJORADO =====
let cierreAdministrativoEnCurso = false;
async function guardarCierreDiario() {
    if (cierreAdministrativoEnCurso) return;
    const botonesCierre = document.querySelectorAll('#modalCierreDiario button.btn-primary');
    try {
        console.log('=== GUARDANDO CIERRE ADMINISTRATIVO ===');
        // 1. VALIDAR CAMPOS
        const nombreCierre = document.getElementById('nombreCierre')?.value?.trim() || '';
        const nombreRecibe = document.getElementById('nombreRecibe')?.value?.trim() || '';
        const montoBaseCaja = parseFloat(document.getElementById('montoBaseCaja')?.value) || 0;
        const detalles = document.getElementById('detallesCierre')?.value?.trim() || '';

        if (!nombreCierre) {
            alert('❌ Por favor, ingrese el nombre de quien realiza el cierre');
            return;
        }

        if (!nombreRecibe) {
            alert('❌ Por favor, ingrese el nombre de quien recibe la caja');
            return;
        }

        cierreAdministrativoEnCurso = true;
        botonesCierre.forEach(function (btn) { btn.disabled = true; });

        // 2-5. Mismo criterio del modal: día laboral o desde el último cierre (puede incluir anoche)
        const hoy = getFechaHoyParaCierre();
        const resumen = construirResumenCierre();
        const rangoSeleccionado = resumen.rango;
        const ventasHoy = resumen.ventas;
        const gastosHoy = resumen.gastos;
        const calculos = resumen.calculos;
        const totalVentas = calculos.totalGeneral;
        const totalEfectivo = calculos.totalEfectivo;
        const totalTransferencia = calculos.totalTransferencia;
        const totalTarjeta = calculos.totalTarjeta;
        const totalCredito = calculos.totalCredito;
        const totalMixto = calculos.totalMixto;
        const totalGastos = resumen.totalGastos;
        const totalDomiciliosCierre = resumen.domicilios.total;
        const totalesDomiciliariosCierre = resumen.domicilios.porDomiciliario;
        const totalPropinasCierre = (resumen.propinas && resumen.propinas.total) || 0;
        const balanceFinal = resumen.balance;

        // 6. CREAR OBJETO DE CIERRE
        const cierre = {
            id: Date.now(),
            fecha: hoy.toISOString(),
            fechaLocal: hoy.toLocaleDateString('es-ES'),
            hora: hoy.toLocaleTimeString('es-ES'),
            ventas: {
                total: totalVentas,
                efectivo: totalEfectivo,
                transferencia: totalTransferencia,
                tarjeta: totalTarjeta,
                credito: totalCredito,
                mixto: totalMixto
            },
            ventasRapidas: {
                total: calculos.totalVentasRapidas,
                efectivo: calculos.efectivoRapidas,
                transferencia: calculos.transferenciaRapidas,
                tarjeta: calculos.tarjetaRapidas,
                credito: calculos.creditoRapidas,
                mixto: calculos.mixtoRapidas,
                domicilio: calculos.totalRapidaDomicilio || 0,
                mesa: calculos.totalRapidaMesa || 0,
                recoger: calculos.totalRapidaRecoger || 0,
                sinCanal: calculos.totalRapidaSinCanal || 0
            },
            ventasMesas: {
                total: calculos.totalVentasMesas,
                efectivo: calculos.efectivoMesas,
                transferencia: calculos.transferenciaMesas,
                tarjeta: calculos.tarjetaMesas,
                credito: calculos.creditoMesas,
                mixto: calculos.mixtoMesas
            },
            totalDomicilios: totalDomiciliosCierre,
            totalesDomiciliarios: totalesDomiciliariosCierre,
            domiciliosEnEfectivo: resumen.domicilios.enEfectivoOMixto,
            totalPropinas: totalPropinasCierre,
            propinasEnEfectivo: (resumen.propinas && resumen.propinas.enEfectivoOMixto) || 0,
            efectivoEnCaja: resumen.efectivoEnCaja,
            baseCajaAnterior: resumen.baseCajaAnterior || 0,
            gastos: totalGastos,
            gastosCaja: resumen.totalGastosCaja || 0,
            gastosTransferencia: (resumen.impactoGastos && resumen.impactoGastos.totalTransferencia) || 0,
            gastosCreditoPendiente: (resumen.impactoGastos && resumen.impactoGastos.totalCreditoPendiente) || 0,
            cuentasPorPagar: (resumen.impactoGastos && resumen.impactoGastos.totalCuentasPorPagar) || 0,
            detalleGastos: gastosHoy.map(g => ({
                descripcion: g.descripcion,
                monto: g.monto,
                formaPago: g.formaPago,
                estadoPago: g.estadoPago,
                proveedor: g.proveedor,
                fecha: g.fecha,
                fechaPago: g.fechaPago,
                formaPagoLiquidacion: g.formaPagoLiquidacion
            })),
            cuentasPorPagarDetalle: ((resumen.impactoGastos && resumen.impactoGastos.cuentasPorPagar) || []).map(g => ({
                descripcion: g.descripcion,
                monto: g.monto,
                proveedor: g.proveedor
            })),
            balance: balanceFinal,
            nombreCierre: nombreCierre,
            nombreRecibe: nombreRecibe,
            montoBaseCaja: montoBaseCaja,
            detalles: detalles,
            rangoVentas: rangoSeleccionado
        };

        // 7. GUARDAR EN LOCALSTORAGE
        const historialCierres = JSON.parse(localStorage.getItem('historialCierres') || '[]');
        historialCierres.push(cierre);
        localStorage.setItem('historialCierres', JSON.stringify(historialCierres));
        localStorage.setItem('ultimaBaseCaja', String(montoBaseCaja));
        if (typeof guardarCierreEnNube === 'function') {
            await Promise.resolve(guardarCierreEnNube(cierre));
        }

        // 8. IMPRIMIR
        try {
            imprimirBalanceDiario(cierre);
        } catch (e) {
            console.error('Error al imprimir:', e);
        }

        // 9. REINICIAR SISTEMA
        const reinicioExitoso = reiniciarSistemaCompleto();
        if (typeof persistirConfigCajaNube === 'function') {
            await Promise.resolve(persistirConfigCajaNube());
        }
        
        if (reinicioExitoso) {
            console.log('✅ Sistema reiniciado correctamente');
            // Asegurar de nuevo DOM/REC en 0 (por si algo intermedio los reescribió)
            try {
                reiniciarContadoresDomRec();
            } catch (e) {
                console.error('Error al guardar contadores tras reinicio:', e);
            }
            // Forzar actualización de la interfaz
            setTimeout(() => {
                try {
                    // Recargar datos
                    if (typeof cargarDatos === 'function') {
                        cargarDatos();
                    }
                    // Volver a forzar contadores tras cargarDatos
                    reiniciarContadoresDomRec();
                    // Actualizar vista de mesas
                    if (typeof actualizarVistaMesas === 'function') {
                        actualizarVistaMesas();
                    }
                    if (typeof actualizarMesasActivas === 'function') {
                        actualizarMesasActivas();
                    }
                    // Limpiar interfaz de ventas
                    limpiarInterfazVentas();
                    console.log('✅ Interfaz actualizada después del reinicio');
                    console.log(`🔁 Próximos pedidos: D${(contadorDomicilios || 0) + 1} / R${(contadorRecoger || 0) + 1}`);
                    // Verificar estado del sistema
                    debugEstadoSistema();
                } catch (e) {
                    console.error('Error al actualizar interfaz:', e);
                }
            }, 500);
        } else {
            console.error('❌ Error al reiniciar sistema');
            // Aunque falle el reinicio general, al menos resetear DOM/REC
            try { reiniciarContadoresDomRec(); } catch (e) { /* ignore */ }
        }

        // 10. CERRAR MODAL
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCierreDiario'));
            if (modal) modal.hide();
        
        // 11. LIMPIAR OVERLAYS
        setTimeout(() => {
            limpiarOverlaysBootstrap();
        }, 100);
        
        // 12. MENSAJE DE ÉXITO
        alert('✅ Cierre diario guardado exitosamente\n\n' +
              `💰 Total Ventas: $${totalVentas.toLocaleString()}\n` +
              `💵 Efectivo: $${totalEfectivo.toLocaleString()}\n` +
              `🏦 Transferencia: $${totalTransferencia.toLocaleString()}\n` +
              `💳 Tarjeta: $${totalTarjeta.toLocaleString()}\n` +
              `📝 Crédito: $${totalCredito.toLocaleString()}\n` +
              `🔄 Mixto: $${totalMixto.toLocaleString()}\n` +
              `💸 Gastos (balance): $${totalGastos.toLocaleString()}\n` +
              `💵 Gastos en efectivo: $${(resumen.totalGastosCaja || 0).toLocaleString()}\n` +
              `🤝 Cuentas por pagar: $${((resumen.impactoGastos && resumen.impactoGastos.totalCuentasPorPagar) || 0).toLocaleString()}\n` +
              `🚚 Domicilios restados: $${totalDomiciliosCierre.toLocaleString()}\n` +
              `🤝 Propinas restadas: $${totalPropinasCierre.toLocaleString()}\n` +
              `📦 Base anterior: $${(resumen.baseCajaAnterior || 0).toLocaleString()}\n` +
              `💵 Efectivo en caja: $${resumen.efectivoEnCaja.toLocaleString()}\n` +
              `⚖️ Balance Final: $${balanceFinal.toLocaleString()}`);
        
        console.log('=== CIERRE COMPLETADO EXITOSAMENTE ===');

    } catch (error) {
        console.error('ERROR EN CIERRE:', error);
        alert('❌ Error al guardar el cierre: ' + error.message);
    } finally {
        cierreAdministrativoEnCurso = false;
        botonesCierre.forEach(function (btn) { btn.disabled = false; });
    }
}

// ===== FUNCIÓN PARA OBTENER VENTANA DE IMPRESIÓN =====
function obtenerVentanaImpresion() {
    try {
        // Intentar reutilizar ventana existente
        let ventana = window.open('', 'ImpresionBalance', 'width=800,height=600,scrollbars=yes,resizable=yes');
        
        if (!ventana || ventana.closed) {
            // Si no se puede abrir, crear una nueva
            ventana = window.open('', 'ImpresionBalance', 'width=800,height=600,scrollbars=yes,resizable=yes');
        }
        
        if (!ventana) {
            throw new Error('No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes.');
        }
        
        // Configurar la ventana
        ventana.document.title = 'Cierre Diario - ToySoft POS';
        ventana.focus();
        
        return ventana;
    } catch (error) {
        console.error('Error al obtener ventana de impresión:', error);
        throw error;
    }
}

// ===== FUNCIÓN PARA ENVIAR EMAIL DE CIERRE ADMINISTRATIVO =====
function enviarCierreAdministrativoEmail(cierre) {
    try {
        console.log('=== ENVIANDO EMAIL DE CIERRE ADMINISTRATIVO ===');
        
        // Verificar si EmailJS está disponible
        if (typeof emailjs === 'undefined') {
            console.log('EmailJS no está disponible, saltando envío de email');
            return;
        }
        
        // Obtener configuración de email
        const configEmail = JSON.parse(localStorage.getItem('configuracionEmail') || '{}');
        if (!configEmail.serviceId || !configEmail.templateId || !configEmail.publicKey) {
            console.log('Configuración de email incompleta, saltando envío');
            return;
        }
        
        // Configurar EmailJS
        emailjs.init(configEmail.publicKey);
        
        // Preparar datos del email
        const datosEmail = {
            to_email: configEmail.emailDestino || 'admin@toysoft.com',
            subject: `Cierre Administrativo - ${cierre.fechaFormateada}`,
            nombre_negocio: JSON.parse(localStorage.getItem('datosNegocio') || '{}').nombre || 'ToySoft',
            fecha: cierre.fechaFormateada,
            hora: cierre.hora,
            total_ventas: cierre.ventas.total.toLocaleString(),
            efectivo: cierre.ventas.efectivo.toLocaleString(),
            transferencia: cierre.ventas.transferencia.toLocaleString(),
            tarjeta: cierre.ventas.tarjeta.toLocaleString(),
            credito: cierre.ventas.credito.toLocaleString(),
            mixto: cierre.ventas.mixto.toLocaleString(),
            ventas_rapidas: cierre.ventasRapidas.total.toLocaleString(),
            ventas_mesas: cierre.ventasMesas.total.toLocaleString(),
            gastos: cierre.gastos.toLocaleString(),
            propinas: (cierre.totalPropinas || 0).toLocaleString(),
            balance_final: cierre.balance.toLocaleString(),
            nombre_cierre: cierre.nombreCierre,
            nombre_recibe: cierre.nombreRecibe,
            monto_base_caja: cierre.montoBaseCaja.toLocaleString(),
            detalles: cierre.detalles || 'Sin detalles adicionales'
        };
        
        // Enviar email
        emailjs.send(configEmail.serviceId, configEmail.templateId, datosEmail)
            .then(function(response) {
                console.log('✅ Email enviado exitosamente:', response);
            })
            .catch(function(error) {
                console.error('❌ Error al enviar email:', error);
            });
            
    } catch (error) {
        console.error('Error en enviarCierreAdministrativoEmail:', error);
    }
}

// ===== FUNCIÓN PARA CALCULAR TOTALES DE FORMA PRECISA =====
function calcularTotalesVentas(ventas) {
    console.log('=== CALCULANDO TOTALES DE VENTAS ===');
    
    // Eliminar duplicados por ID
    const ventasUnicas = [];
    const idsVistos = new Set();
    
    ventas.forEach(venta => {
        const clave = claveUnicaVentaCierre(venta);
        if (!clave || idsVistos.has(clave)) return;
        idsVistos.add(clave);
        ventasUnicas.push(venta);
    });
    
    console.log(`📊 Ventas procesadas: ${ventasUnicas.length} de ${ventas.length} totales`);
    if (ventas.length !== ventasUnicas.length) {
        console.log(`⚠️ Se eliminaron ${ventas.length - ventasUnicas.length} duplicados`);
    }
    
    // Inicializar contadores
    let totalGeneral = 0;
    let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0;
    let totalVentasRapidas = 0, totalVentasMesas = 0;
    let efectivoRapidas = 0, transferenciaRapidas = 0, tarjetaRapidas = 0, creditoRapidas = 0, mixtoRapidas = 0;
    let efectivoMesas = 0, transferenciaMesas = 0, tarjetaMesas = 0, creditoMesas = 0, mixtoMesas = 0;
    let totalRapidaDomicilio = 0, totalRapidaMesa = 0, totalRapidaRecoger = 0, totalRapidaSinCanal = 0;

    // Procesar cada venta individualmente
    ventasUnicas.forEach((venta) => {
        const total = parseFloat(venta.total) || 0;
        const metodo = (venta.metodoPago || '').toLowerCase().trim();
        const esVentaRapida = esVentaCajaRapida(venta);
        
        // Sumar al total general
        totalGeneral += total;
        
        // Clasificar por tipo de venta
        if (esVentaRapida) {
            totalVentasRapidas += total;
            const canal = obtenerCanalVentaRapida(venta);
            if (canal === 'domicilio') totalRapidaDomicilio += total;
            else if (canal === 'mesa') totalRapidaMesa += total;
            else if (canal === 'recoger') totalRapidaRecoger += total;
            else totalRapidaSinCanal += total;
        } else {
            totalVentasMesas += total;
        }

        // Procesar por método de pago
        switch (metodo) {
            case 'efectivo':
                totalEfectivo += total;
                if (esVentaRapida) {
                    efectivoRapidas += total;
                } else {
                    efectivoMesas += total;
                }
                break;
                
            case 'transferencia':
                totalTransferencia += total;
                if (esVentaRapida) {
                    transferenciaRapidas += total;
                } else {
                    transferenciaMesas += total;
                }
                break;
                
            case 'tarjeta':
                totalTarjeta += total;
                if (esVentaRapida) {
                    tarjetaRapidas += total;
                } else {
                    tarjetaMesas += total;
                }
                break;
                
            case 'crédito':
            case 'credito':
                totalCredito += total;
                if (esVentaRapida) {
                    creditoRapidas += total;
                } else {
                    creditoMesas += total;
                }
                break;
                
            case 'mixto':
                totalMixto += total;
                const efectivoMixto = parseFloat(venta.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(venta.montoTransferencia) || 0;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
                
                if (esVentaRapida) {
                    mixtoRapidas += total;
                    efectivoRapidas += efectivoMixto;
                    transferenciaRapidas += transferenciaMixto;
                } else {
                    mixtoMesas += total;
                    efectivoMesas += efectivoMixto;
                    transferenciaMesas += transferenciaMixto;
                }
                break;
                
            default:
                console.warn(`Método de pago no reconocido: "${metodo}"`);
                break;
        }
    });

    console.log(`📊 Total General: $${totalGeneral.toLocaleString()}`);
    console.log(`⚡ Ventas Rápidas: $${totalVentasRapidas.toLocaleString()}`);
    console.log(`🪑 Ventas Mesas: $${totalVentasMesas.toLocaleString()}`);
    console.log(`🚚 VR Domicilio: $${totalRapidaDomicilio.toLocaleString()} | Mesa: $${totalRapidaMesa.toLocaleString()} | Recoger: $${totalRapidaRecoger.toLocaleString()}`);

    return {
        totalGeneral,
        totalEfectivo,
        totalTransferencia,
        totalTarjeta,
        totalCredito,
        totalMixto,
        totalVentasRapidas,
        totalVentasMesas,
        efectivoRapidas,
        transferenciaRapidas,
        tarjetaRapidas,
        creditoRapidas,
        mixtoRapidas,
        efectivoMesas,
        transferenciaMesas,
        tarjetaMesas,
        creditoMesas,
        mixtoMesas,
        totalRapidaDomicilio,
        totalRapidaMesa,
        totalRapidaRecoger,
        totalRapidaSinCanal
    };
}

// ===== FUNCIÓN DE DEBUG PARA VERIFICAR VENTAS =====
function debugVentasCompletas() {
    console.log('=== DEBUG COMPLETO DE VENTAS ===');
    
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const todasLasVentas = [...ventas, ...historialVentas];
    
    console.log(`📊 Ventas activas: ${ventas.length}`);
    console.log(`📊 Historial ventas: ${historialVentas.length}`);
    console.log(`📊 Total ventas: ${todasLasVentas.length}`);
}

// ===== FUNCIÓN DE DEBUG ESPECÍFICA PARA CIERRE ADMINISTRATIVO =====
function debugCierreAdministrativo() {
    console.log('=== DEBUG CIERRE ADMINISTRATIVO ===');
    
    // Obtener todas las ventas del día
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const todasLasVentas = [...ventas, ...historialVentas];
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    
    const ventasHoy = todasLasVentas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`📅 Fecha de hoy (local): ${hoy.toLocaleDateString('es-ES')}`);
    console.log(`📊 Ventas de mesas: ${ventas.length}`);
    console.log(`📊 Ventas rápidas (historial): ${historialVentas.length}`);
    console.log(`📊 Total ventas: ${todasLasVentas.length}`);
    console.log(`📊 Ventas de hoy: ${ventasHoy.length}`);
    
    // Calcular usando la función mejorada
    const calculos = calcularTotalesVentas(ventasHoy);
    
    console.log('\n=== RESULTADOS DEL CÁLCULO ===');
    console.log(`💰 Total General: $${calculos.totalGeneral.toLocaleString()}`);
    console.log(`💵 Efectivo: $${calculos.totalEfectivo.toLocaleString()}`);
    console.log(`🏦 Transferencia: $${calculos.totalTransferencia.toLocaleString()}`);
    console.log(`💳 Tarjeta: $${calculos.totalTarjeta.toLocaleString()}`);
    console.log(`📝 Crédito: $${calculos.totalCredito.toLocaleString()}`);
    console.log(`🔄 Mixto: $${calculos.totalMixto.toLocaleString()}`);
    
    console.log('\n=== VENTAS RÁPIDAS ===');
    console.log(`📊 Total: $${calculos.totalVentasRapidas.toLocaleString()}`);
    console.log(`💵 Efectivo: $${calculos.efectivoRapidas.toLocaleString()}`);
    console.log(`🏦 Transferencia: $${calculos.transferenciaRapidas.toLocaleString()}`);
    console.log(`💳 Tarjeta: $${calculos.tarjetaRapidas.toLocaleString()}`);
    console.log(`📝 Crédito: $${calculos.creditoRapidas.toLocaleString()}`);
    console.log(`🔄 Mixto: $${calculos.mixtoRapidas.toLocaleString()}`);
    
    console.log('\n=== VENTAS MESAS ===');
    console.log(`📊 Total: $${calculos.totalVentasMesas.toLocaleString()}`);
    console.log(`💵 Efectivo: $${calculos.efectivoMesas.toLocaleString()}`);
    console.log(`🏦 Transferencia: $${calculos.transferenciaMesas.toLocaleString()}`);
    console.log(`💳 Tarjeta: $${calculos.tarjetaMesas.toLocaleString()}`);
    console.log(`📝 Crédito: $${calculos.creditoMesas.toLocaleString()}`);
    console.log(`🔄 Mixto: $${calculos.mixtoMesas.toLocaleString()}`);
    
    // Verificar coherencia
    const sumaTotal = calculos.totalEfectivo + calculos.totalTransferencia + calculos.totalTarjeta + calculos.totalCredito;
    console.log('\n=== VERIFICACIÓN ===');
    console.log(`🔍 Total General: $${calculos.totalGeneral.toLocaleString()}`);
    console.log(`🔢 Suma por métodos: $${sumaTotal.toLocaleString()}`);
    console.log(`✅ ¿Coinciden? ${calculos.totalGeneral === sumaTotal ? 'SÍ' : 'NO'}`);
    
    // Verificar total de ventas
    const totalManual = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`💰 Total ventas del día: $${totalManual.toLocaleString()}`);
    
    return calculos;
}

// ===== FUNCIÓN DE DEBUG DETALLADO PARA VENTAS =====
function debugVentasDetallado() {
    console.log('=== DEBUG DETALLADO DE VENTAS ===');
    
    // Obtener todas las ventas
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    const historialVentas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    
    console.log(`📊 Ventas de mesas: ${ventas.length}`);
    console.log(`📊 Ventas rápidas: ${historialVentas.length}`);
    
    // Verificar fechas
    const hoy = getFechaHoyParaCierre();
    console.log(`\n📅 Fecha de hoy (local): ${hoy.toLocaleDateString('es-ES')}`);
    
    // Filtrar ventas de hoy
    const todasLasVentas = [...ventas, ...historialVentas];
    const ventasHoy = todasLasVentas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            console.error('Error al procesar fecha:', e, v);
            return false;
        }
    });
    
    console.log(`📊 Ventas de hoy: ${ventasHoy.length}`);
    
    // Calcular totales manualmente
    const totalManual = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`\n💰 TOTAL MANUAL: $${totalManual.toLocaleString()}`);
    
    return {
        ventas,
        historialVentas,
        ventasHoy,
        totalManual
    };
}

// ===== FUNCIÓN PARA OBTENER VENTAS DEL DÍA =====
function obtenerVentasDelDia() {
    const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
    
    // Filtrar solo ventas activas de hoy (NO historial) — fecha LOCAL
    const hoy = getFechaHoyParaCierre();
    
    const ventasHoy = ventas.filter(v => {
        try {
            return esMismaFechaLocal(v.fecha, hoy);
        } catch (e) {
            return false;
        }
    });
    
    console.log(`📅 Filtro aplicado: Solo ventas activas de hoy (${fechaLocalISO(hoy)})`);
    console.log(`📊 Ventas activas de hoy: ${ventasHoy.length}`);
    
    console.log(`📊 Ventas de hoy: ${ventasHoy.length}`);
    
    // Verificar total de ventas
    const totalManual = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`💰 Total ventas del día: $${totalManual.toLocaleString()}`);
    
    const sumaTotal = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    console.log(`\n💰 SUMA TOTAL MANUAL: $${sumaTotal.toLocaleString()}`);
    
    return ventasHoy;
}

// ===== FUNCIÓN PARA REINICIAR SISTEMA =====
function reiniciarSistemaDespuesCierre() {
    console.log('=== REINICIANDO SISTEMA ===');
    
    // Usar la función de reinicio completo
    const reinicioExitoso = reiniciarSistemaCompleto();
    
    if (!reinicioExitoso) {
        console.error('❌ Error al reiniciar sistema');
        return;
    }
    
    // Reiniciar contadores específicos y globales
    reiniciarContadoresDomRec();
    // Reiniciar contadores en memoria (redundante, ya lo hace reiniciarContadoresDomRec)
    if (typeof contadorDomicilios !== 'undefined') contadorDomicilios = 0;
    if (typeof contadorRecoger !== 'undefined') contadorRecoger = 0;
    if (typeof ultimaFechaContadores !== 'undefined') ultimaFechaContadores = new Date().toLocaleDateString();
    // Guardar contadores reiniciados en almacenamiento
    try {
        if (typeof guardarContadores === 'function') guardarContadores();
        if (typeof cargarDatos === 'function') cargarDatos();
        reiniciarContadoresDomRec();
    } catch (e) {
        console.error('Error al refrescar datos:', e);
    }
    
    console.log('✅ Sistema reiniciado correctamente');
    
    // Recargar la página para reiniciar completamente
    setTimeout(() => {
        location.reload();
    }, 1000);
}

function exportarCierresDiariosExcel() {
    try {
        // Obtener cierres diarios
        const cierres = JSON.parse(localStorage.getItem('historialCierres')) || [];
        
        if (cierres.length === 0) {
            alert('No hay cierres diarios para exportar');
            return;
        }

        // Crear un nuevo libro de Excel
        const wb = XLSX.utils.book_new();
        
        // Preparar los datos para la hoja de cálculo
        const datos = cierres.map(cierre => ({
            'Fecha': new Date(cierre.fecha).toLocaleString(),
            'Total Ventas': cierre.ventas.total,
            'Efectivo': cierre.ventas.efectivo,
            'Transferencia': cierre.ventas.transferencia,
            'Tarjeta': cierre.ventas.tarjeta,
            'Crédito': cierre.ventas.credito,
            'Mixto': cierre.ventas.mixto,
            'Propinas': cierre.totalPropinas || 0,
            'Gastos': cierre.gastos,
            'Balance Final': cierre.balance,
            'Entrega': cierre.nombreCierre,
            'Recibe': cierre.nombreRecibe,
            'Base Caja': cierre.montoBaseCaja,
            'Detalles': cierre.detalles || ''
        }));

        // Crear la hoja de cálculo
        const ws = XLSX.utils.json_to_sheet(datos);

        // Ajustar el ancho de las columnas
        const anchos = [
            { wch: 20 }, // Fecha
            { wch: 15 }, // Total Ventas
            { wch: 15 }, // Efectivo
            { wch: 15 }, // Transferencia
            { wch: 15 }, // Tarjeta
            { wch: 15 }, // Crédito
            { wch: 15 }, // Mixto
            { wch: 15 }, // Gastos
            { wch: 15 }, // Balance Final
            { wch: 20 }, // Entrega
            { wch: 20 }, // Recibe
            { wch: 15 }, // Base Caja
            { wch: 40 }  // Detalles
        ];
        ws['!cols'] = anchos;

        // Agregar la hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Cierres Diarios');

        // Generar el archivo Excel
        const fecha = obtenerFechaLocalISO();
        XLSX.writeFile(wb, `Cierres_Diarios_${fecha}.xlsx`);
        
        alert('Archivo Excel generado exitosamente');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        alert('Error al generar el archivo Excel');
    }
}

function imprimirBalanceDiario(datosCierre = null) {
    try {
        console.log('Iniciando imprimirBalanceDiario con datos:', datosCierre);
        
        // Obtener la marca de tiempo del último cierre (si existe)
        const ultimaHoraCierreStr = localStorage.getItem('ultimaHoraCierre');
        const ultimaHoraCierre = ultimaHoraCierreStr ? new Date(ultimaHoraCierreStr) : null;
        
        // Obtener todas las ventas (normales + rápidas)
        const todasLasVentas = obtenerTodasLasVentas();
        console.log('Ventas obtenidas:', todasLasVentas.length);
        
        const hoy = getFechaHoyParaCierre();
        console.log('Fecha de hoy (local):', hoy.toLocaleDateString('es-ES'), fechaLocalISO(hoy));
        
        const rangoBalance = (datosCierre && datosCierre.rangoVentas) || obtenerRangoVentasCierre();
        const ventasHoy = filtrarVentasParaCierre(todasLasVentas, rangoBalance);
        console.log('Ventas de hoy filtradas:', ventasHoy.length);

        // Usar datos del cierre si están disponibles, sino calcular
        let totalEfectivo, totalTransferencia, totalTarjeta, totalCredito, totalMixto, totalVentas;
        let totalEfectivoRapida, totalTransferenciaRapida, totalTarjetaRapida, totalCreditoRapida, totalMixtoRapida, totalVentasRapidas;
        let totalEfectivoMesa, totalTransferenciaMesa, totalTarjetaMesa, totalCreditoMesa, totalMixtoMesa, totalVentasMesas;
        let totalRapidaDomicilio = 0, totalRapidaMesa = 0, totalRapidaRecoger = 0, totalRapidaSinCanal = 0;
        
        if (datosCierre && datosCierre.ventas) {
            // Usar datos del cierre
            totalVentas = datosCierre.ventas.total || 0;
            totalEfectivo = datosCierre.ventas.efectivo || 0;
            totalTransferencia = datosCierre.ventas.transferencia || 0;
            totalTarjeta = datosCierre.ventas.tarjeta || 0;
            totalCredito = datosCierre.ventas.credito || 0;
            totalMixto = datosCierre.ventas.mixto || 0;
            
            // Datos separados por tipo
            if (datosCierre.ventasRapidas) {
                totalVentasRapidas = datosCierre.ventasRapidas.total || 0;
                totalEfectivoRapida = datosCierre.ventasRapidas.efectivo || 0;
                totalTransferenciaRapida = datosCierre.ventasRapidas.transferencia || 0;
                totalTarjetaRapida = datosCierre.ventasRapidas.tarjeta || 0;
                totalCreditoRapida = datosCierre.ventasRapidas.credito || 0;
                totalMixtoRapida = datosCierre.ventasRapidas.mixto || 0;
                totalRapidaDomicilio = datosCierre.ventasRapidas.domicilio || 0;
                totalRapidaMesa = datosCierre.ventasRapidas.mesa || 0;
                totalRapidaRecoger = datosCierre.ventasRapidas.recoger || 0;
                totalRapidaSinCanal = datosCierre.ventasRapidas.sinCanal || 0;
            } else {
                // Fallback: recalcular canales desde ventas del período
                const calcFallback = calcularTotalesVentas(ventasHoy);
                totalVentasRapidas = calcFallback.totalVentasRapidas;
                totalEfectivoRapida = calcFallback.efectivoRapidas;
                totalTransferenciaRapida = calcFallback.transferenciaRapidas;
                totalTarjetaRapida = calcFallback.tarjetaRapidas;
                totalCreditoRapida = calcFallback.creditoRapidas;
                totalMixtoRapida = calcFallback.mixtoRapidas;
                totalRapidaDomicilio = calcFallback.totalRapidaDomicilio || 0;
                totalRapidaMesa = calcFallback.totalRapidaMesa || 0;
                totalRapidaRecoger = calcFallback.totalRapidaRecoger || 0;
                totalRapidaSinCanal = calcFallback.totalRapidaSinCanal || 0;
            }
            
            if (datosCierre.ventasMesas) {
                totalVentasMesas = datosCierre.ventasMesas.total || 0;
                totalEfectivoMesa = datosCierre.ventasMesas.efectivo || 0;
                totalTransferenciaMesa = datosCierre.ventasMesas.transferencia || 0;
                totalTarjetaMesa = datosCierre.ventasMesas.tarjeta || 0;
                totalCreditoMesa = datosCierre.ventasMesas.credito || 0;
                totalMixtoMesa = datosCierre.ventasMesas.mixto || 0;
            } else {
                const calcMesas = calcularTotalesVentas(ventasHoy);
                totalVentasMesas = calcMesas.totalVentasMesas;
                totalEfectivoMesa = calcMesas.efectivoMesas;
                totalTransferenciaMesa = calcMesas.transferenciaMesas;
                totalTarjetaMesa = calcMesas.tarjetaMesas;
                totalCreditoMesa = calcMesas.creditoMesas;
                totalMixtoMesa = calcMesas.mixtoMesas;
            }
        } else {
            // Si no hay datos de cierre, usar la función mejorada de cálculo
            const calculos = calcularTotalesVentas(ventasHoy);
            totalVentas = calculos.totalGeneral;
            totalEfectivo = calculos.totalEfectivo;
            totalTransferencia = calculos.totalTransferencia;
            totalTarjeta = calculos.totalTarjeta;
            totalCredito = calculos.totalCredito;
            totalMixto = calculos.totalMixto;
            totalVentasRapidas = calculos.totalVentasRapidas;
            totalVentasMesas = calculos.totalVentasMesas;
            totalEfectivoRapida = calculos.efectivoRapidas;
            totalTransferenciaRapida = calculos.transferenciaRapidas;
            totalTarjetaRapida = calculos.tarjetaRapidas;
            totalCreditoRapida = calculos.creditoRapidas;
            totalMixtoRapida = calculos.mixtoRapidas;
            totalEfectivoMesa = calculos.efectivoMesas;
            totalTransferenciaMesa = calculos.transferenciaMesas;
            totalTarjetaMesa = calculos.tarjetaMesas;
            totalCreditoMesa = calculos.creditoMesas;
            totalMixtoMesa = calculos.mixtoMesas;
            totalRapidaDomicilio = calculos.totalRapidaDomicilio || 0;
            totalRapidaMesa = calculos.totalRapidaMesa || 0;
            totalRapidaRecoger = calculos.totalRapidaRecoger || 0;
            totalRapidaSinCanal = calculos.totalRapidaSinCanal || 0;
        }

        // Obtener gastos del día (caja vs balance)
        const impactoPrint = construirImpactoGastos(
            obtenerGastosCombinados(),
            (fechaValor) => fechaEnRangoCierre(fechaValor, rangoBalance)
        );
        const gastosHoy = (datosCierre && Array.isArray(datosCierre.detalleGastos))
            ? datosCierre.detalleGastos
            : impactoPrint.gastos;
        const totalGastos = (datosCierre && datosCierre.gastos != null)
            ? (parseFloat(datosCierre.gastos) || 0)
            : impactoPrint.totalGastosBalance;
        const totalGastosCajaPrint = (datosCierre && datosCierre.gastosCaja != null)
            ? (parseFloat(datosCierre.gastosCaja) || 0)
            : impactoPrint.totalGastosCaja;

        // Calcular total de domicilios del día y por domiciliario
        const totalesDomiciliarios = {};
        let totalDomicilios;
        if (datosCierre && datosCierre.totalDomicilios != null) {
            totalDomicilios = parseFloat(datosCierre.totalDomicilios) || 0;
            Object.assign(totalesDomiciliarios, datosCierre.totalesDomiciliarios || {});
        } else {
            totalDomicilios = ventasHoy.reduce((sum, v) => {
                const valorDom = parseFloat(v.valorDomicilio) || 0;
                if (valorDom > 0) {
                    const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
                    if (!totalesDomiciliarios[nombre]) {
                        totalesDomiciliarios[nombre] = 0;
                    }
                    totalesDomiciliarios[nombre] += valorDom;
                }
                return sum + valorDom;
            }, 0);
        }

        const propinasResumenPrint = resumirPropinasDeVentas(ventasHoy);
        const totalPropinas = (datosCierre && datosCierre.totalPropinas != null)
            ? (parseFloat(datosCierre.totalPropinas) || 0)
            : propinasResumenPrint.total;
        const propinasEnEfectivoPrint = (datosCierre && datosCierre.propinasEnEfectivo != null)
            ? (parseFloat(datosCierre.propinasEnEfectivo) || 0)
            : propinasResumenPrint.enEfectivoOMixto;

        // Calcular balance final (ventas - propinas - gastos - todos los domicilios)
        const balanceFinal = (datosCierre && datosCierre.balance != null)
            ? (parseFloat(datosCierre.balance) || 0)
            : (totalVentas - totalGastos - totalDomicilios - totalPropinas);

        // Efectivo que queda en caja: efectivo - gastos - domicilios pagados en efectivo/mixto
        const domiciliosEnEfectivoPrint = (datosCierre && datosCierre.domiciliosEnEfectivo != null)
            ? (parseFloat(datosCierre.domiciliosEnEfectivo) || 0)
            : ventasHoy
                .filter(v => ((v.metodoPago || '').toLowerCase() === 'efectivo' || (v.metodoPago || '').toLowerCase() === 'mixto') && (parseFloat(v.valorDomicilio) || 0) > 0)
                .reduce((sum, v) => sum + (parseFloat(v.valorDomicilio) || 0), 0);
        const baseCajaAnteriorPrint = (datosCierre && datosCierre.baseCajaAnterior != null)
            ? (parseFloat(datosCierre.baseCajaAnterior) || 0)
            : obtenerBaseCajaAnterior();
        const efectivoQueQuedaPrint = (datosCierre && datosCierre.efectivoEnCaja != null)
            ? (parseFloat(datosCierre.efectivoEnCaja) || 0)
            : (baseCajaAnteriorPrint + totalEfectivo - totalGastosCajaPrint - domiciliosEnEfectivoPrint - propinasEnEfectivoPrint);

        // Obtener información del cierre
        let nombreCierre, nombreRecibe, montoBaseCaja, detalles;
        
        if (datosCierre) {
            // Usar datos pasados como parámetro
            nombreCierre = datosCierre.nombreCierre || '';
            nombreRecibe = datosCierre.nombreRecibe || '';
            montoBaseCaja = datosCierre.montoBaseCaja || 0;
            detalles = datosCierre.detalles || '';
        } else {
            // Intentar obtener del DOM (para compatibilidad)
            const nombreCierreEl = document.getElementById('nombreCierre');
            const nombreRecibeEl = document.getElementById('nombreRecibe');
            const montoBaseCajaEl = document.getElementById('montoBaseCaja');
            const detallesEl = document.getElementById('detallesCierre');
            
            nombreCierre = nombreCierreEl ? nombreCierreEl.value.trim() : '';
            nombreRecibe = nombreRecibeEl ? nombreRecibeEl.value.trim() : '';
            montoBaseCaja = montoBaseCajaEl ? parseFloat(montoBaseCajaEl.value) || 0 : 0;
            detalles = detallesEl ? detallesEl.value : '';
        }

        // Leer últimos consecutivos DOM/REC antes del reinicio
        const ultimoDom = parseInt(localStorage.getItem('contadorDomicilios')) || 0;
        const ultimoRec = parseInt(localStorage.getItem('contadorRecoger')) || 0;

        // Crear ventana de impresión
        let ventana;
        try {
            ventana = obtenerVentanaImpresion();
        } catch (error) {
            alert('Error al abrir ventana de impresión: ' + error.message);
            return;
        }
        let infoNegocio = typeof htmlPieDatosNegocioTicket === 'function' ? htmlPieDatosNegocioTicket() : '';

        const contenido = `
            <html>
                <head>
                    <title>Cierre Diario</title>
                    <style>
                        body { font-family: monospace; font-size: 14px; width: 57mm; margin: 0; padding: 1mm; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .mb-1 { margin-bottom: 0.5mm; }
                        .mt-1 { margin-top: 0.5mm; }
                        .border-top { border-top: 1px dashed #000; margin-top: 1mm; padding-top: 1mm; }
                        .header { border-bottom: 1px dashed #000; padding-bottom: 1mm; margin-bottom: 1mm; }
                        .total-row { font-weight: bold; font-size: 16px; }
                        .botones-impresion { position: fixed; top: 10px; right: 10px; z-index: 1000; background: #fff; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                        .botones-impresion button { margin: 0 5px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
                        .botones-impresion button:hover { background: #0056b3; }
                        .logo-container { text-align: center; margin-bottom: 2mm; }
                        .logo-container img { max-width: 100%; max-height: 120px; }
                        @media print { .botones-impresion { display: none; } @page { margin: 0; size: 57mm auto; } body { width: 57mm; } }
                    </style>
                </head>
                <body>
                    <div class="botones-impresion">
                        <button onclick="window.print()">Imprimir</button>
                        <button onclick="window.close()">Cerrar</button>
                    </div>

                    <div class="header text-center">
                        <h2 style="margin: 0; font-size: 14px;">CIERRE DIARIO</h2>
                        <div class="mb-1">${hoy.toLocaleDateString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Información de Cierre</strong></div>
                        <div class="mb-1">Entrega: ${nombreCierre}</div>
                        <div class="mb-1">Recibe: ${nombreRecibe}</div>
                        <div class="mb-1">Base anterior (entró a caja): $ ${baseCajaAnteriorPrint.toLocaleString()}</div>
                        <div class="mb-1">Base que se deja: $ ${montoBaseCaja.toLocaleString()}</div>
                        <div class="mb-1">Último DOMICILIO: D${ultimoDom}</div>
                        <div class="mb-1">Último RECOGIDA: R${ultimoRec}</div>
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1"><strong>Resumen de Ventas</strong></div>
                        <div class="mb-1">Total General: $ ${totalVentas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${totalEfectivo.toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${totalTransferencia.toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${totalTarjeta.toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${totalCredito.toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${totalMixto.toLocaleString()}</div>
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Domicilios a restar (pago a domiciliarios)</strong></div>
                        <div class="mb-1">Total a restar: $ ${totalDomicilios.toLocaleString()}</div>
                        ${Object.keys(totalesDomiciliarios).length > 0 ? `
                        <div class="mb-1"><strong>Por domiciliario:</strong></div>
                        ${Object.entries(totalesDomiciliarios).map(([nombre, monto]) => `
                            <div class="mb-1">- ${nombre}: $ ${monto.toLocaleString()}</div>
                        `).join('')}
                        ` : ''}
                    </div>

                    <div class="border-top">
                        <div class="mb-1"><strong>Propinas a restar (dinero del personal)</strong></div>
                        <div class="mb-1">Total a restar: $ ${totalPropinas.toLocaleString()}</div>
                    </div>
                    
                    ${totalVentasRapidas > 0 ? `
                    <div class="border-top">
                        <div class="mb-1"><strong>Ventas Rápidas (caja rápida)</strong></div>
                        <div class="mb-1">Total: $ ${totalVentasRapidas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${(totalEfectivoRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${(totalTransferenciaRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${(totalTarjetaRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${(totalCreditoRapida || 0).toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${(totalMixtoRapida || 0).toLocaleString()}</div>
                        ${(totalRapidaDomicilio || 0) > 0 ? `<div class="mb-1">Domicilios (caja rápida): $ ${totalRapidaDomicilio.toLocaleString()}</div>` : ''}
                        ${(totalRapidaMesa || 0) > 0 ? `<div class="mb-1">Mesa / Aquí (caja rápida): $ ${totalRapidaMesa.toLocaleString()}</div>` : ''}
                        ${(totalRapidaRecoger || 0) > 0 ? `<div class="mb-1">Recoger (caja rápida): $ ${totalRapidaRecoger.toLocaleString()}</div>` : ''}
                        ${(totalRapidaSinCanal || 0) > 0 ? `<div class="mb-1">Sin clasificar: $ ${totalRapidaSinCanal.toLocaleString()}</div>` : ''}
                    </div>
                    ` : ''}
                    
                    ${totalVentasMesas > 0 ? `
                    <div class="border-top">
                        <div class="mb-1"><strong>Ventas de Mesas (flujo normal)</strong></div>
                        <div class="mb-1">Total: $ ${totalVentasMesas.toLocaleString()}</div>
                        <div class="mb-1">- Efectivo: $ ${(totalEfectivoMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Transferencia: $ ${(totalTransferenciaMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Tarjeta: $ ${(totalTarjetaMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Crédito: $ ${(totalCreditoMesa || 0).toLocaleString()}</div>
                        <div class="mb-1">- Mixto: $ ${(totalMixtoMesa || 0).toLocaleString()}</div>
                    </div>
                    ` : ''}
                    
                    <div class="border-top">
                        <div class="mb-1"><strong>Gastos</strong></div>
                        <div class="mb-1">Total del periodo (balance): $ ${totalGastos.toLocaleString()}</div>
                        <div class="mb-1">En efectivo (sale de caja): $ ${totalGastosCajaPrint.toLocaleString()}</div>
                        ${(datosCierre && datosCierre.gastosTransferencia) ? `<div class="mb-1">Por transferencia: $ ${Number(datosCierre.gastosTransferencia).toLocaleString()}</div>` : ''}
                        ${(datosCierre && datosCierre.gastosCreditoPendiente) ? `<div class="mb-1">A crédito pendientes: $ ${Number(datosCierre.gastosCreditoPendiente).toLocaleString()}</div>` : ''}
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1"><strong>Efectivo en caja</strong></div>
                        <div class="mb-1">Base del cierre anterior: $ ${baseCajaAnteriorPrint.toLocaleString()}</div>
                        <div class="mb-1">+ Efectivo cobrado: $ ${totalEfectivo.toLocaleString()}</div>
                        <div class="mb-1">Menos gastos en efectivo: $ ${totalGastosCajaPrint.toLocaleString()}</div>
                        <div class="mb-1">Menos domicilios en efectivo/mixto: $ ${domiciliosEnEfectivoPrint.toLocaleString()}</div>
                        <div class="mb-1">Menos propinas en efectivo/mixto: $ ${propinasEnEfectivoPrint.toLocaleString()}</div>
                        <div class="mb-1 total-row">= Efectivo que queda: $ ${efectivoQueQuedaPrint.toLocaleString()}</div>
                    </div>
                    
                    <div class="border-top">
                        <div class="mb-1">Total ventas: $ ${totalVentas.toLocaleString()}</div>
                        <div class="mb-1">Menos propinas: $ ${totalPropinas.toLocaleString()}</div>
                        <div class="mb-1">Menos gastos: $ ${totalGastos.toLocaleString()}</div>
                        <div class="mb-1">Menos domicilios: $ ${totalDomicilios.toLocaleString()}</div>
                        <div class="mb-1 total-row">Balance del restaurante: $ ${balanceFinal.toLocaleString()}</div>
                    </div>

                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Detalle de Gastos:</strong></div>
                        ${gastosHoy.map(gasto => `
                            <div class="mb-1">- ${typeof descripcionGastoParaCierre === 'function' ? descripcionGastoParaCierre(gasto) : (gasto.descripcion || 'Gasto')}: $ ${(parseFloat(gasto.monto) || 0).toLocaleString()}</div>
                        `).join('') || '<div class="mb-1">No hay gastos</div>'}
                    </div>

                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Cuentas por pagar a proveedores:</strong></div>
                        ${((datosCierre && datosCierre.cuentasPorPagarDetalle) || (typeof impactoPrint !== 'undefined' ? impactoPrint.cuentasPorPagar : []) || []).map(g => `
                            <div class="mb-1">- ${g.descripcion || 'Gasto'}${g.proveedor ? ` (${g.proveedor})` : ''}: $ ${(parseFloat(g.monto) || 0).toLocaleString()}</div>
                        `).join('') || '<div class="mb-1">No hay compras a crédito pendientes</div>'}
                    </div>

                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Créditos Pendientes:</strong></div>
                        ${ventasHoy.filter(v => (v.metodoPago || '').toLowerCase() === 'crédito').map(credito => `
                            <div class="mb-1">- ${credito.cliente || 'No especificado'}: $ ${credito.total.toLocaleString()}</div>
                        `).join('') || '<div class="mb-1">No hay créditos pendientes</div>'}
                    </div>

                    ${detalles ? `
                    <div class="border-top mt-1">
                        <div class="mb-1"><strong>Notas:</strong></div>
                        <div class="mb-1">${detalles}</div>
                    </div>
                    ` : ''}
                    
                    ${infoNegocio}
                    <div class="text-center mt-1">
                        <div class="border-top">¡Fin del Cierre!</div>
                        <div class="border-top">ToySoft POS</div>
                    </div>
                    
                    <div class="border-top text-center mt-3">
                        <div class="mb-1">Firma de Entrega: _________________</div>
                        <div class="mb-1">Firma de Recibe: _________________</div>
                    </div>
                </body>
            </html>
        `;
        ventana.document.write(contenido);
        ventana.document.close();
    } catch (error) {
        console.error('Error al imprimir balance:', error);
        console.error('Stack trace:', error.stack);
        alert('Error al generar el balance: ' + error.message);
    }
}

// ===== FUNCIÓN DE IMPRESIÓN MEJORADA =====
function imprimirBalanceDiarioMejorado(cierre) {
    console.log('=== IMPRIMIENDO BALANCE DIARIO MEJORADO ===');
    
    const fecha = new Date(cierre.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-ES');
    const hora = fecha.toLocaleTimeString('es-ES');
    
    // Extraer datos del cierre
    const { ventas, ventasRapidas, ventasMesas, gastos, balance, nombreCierre, nombreRecibe, montoBaseCaja, detalles, totalDomicilios = 0, totalesDomiciliarios = {}, totalPropinas = 0 } = cierre;
    
    const contenido = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cierre Diario - ToySoft POS</title>
        <style>
            @page {
                size: A4;
                margin: 1cm;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                margin: 0;
                padding: 0;
            }
            
            .header {
                text-align: center;
                border-bottom: 3px solid #2c3e50;
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
            }
            
            .title {
                font-size: 18px;
                font-weight: bold;
                color: #34495e;
                margin: 10px 0;
            }
            
            .date-time {
                font-size: 14px;
                color: #7f8c8d;
                margin-bottom: 10px;
            }
            
            .section {
                margin-bottom: 20px;
                border: 1px solid #bdc3c7;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .section-header {
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
                padding: 10px 15px;
                font-weight: bold;
                font-size: 14px;
            }
            
            .section-content {
                padding: 15px;
                background: #f8f9fa;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: white;
                border-radius: 5px;
                border-left: 4px solid #3498db;
            }
            
            .info-label {
                font-weight: 600;
                color: #2c3e50;
            }
            
            .info-value {
                font-weight: bold;
                color: #27ae60;
            }
            
            .totals-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 15px;
            }
            
            .total-section {
                background: white;
                border-radius: 8px;
                padding: 15px;
                border: 2px solid #e74c3c;
            }
            
            .total-section.rapidas {
                border-color: #f39c12;
            }
            
            .total-section.mesas {
                border-color: #9b59b6;
            }
            
            .total-title {
                font-size: 16px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 10px;
                padding: 8px;
                border-radius: 5px;
            }
            
            .total-title.rapidas {
                background: #f39c12;
                color: white;
            }
            
            .total-title.mesas {
                background: #9b59b6;
                color: white;
            }
            
            .total-item {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #ecf0f1;
            }
            
            .total-item:last-child {
                border-bottom: none;
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
                margin-top: 5px;
                padding-top: 10px;
                border-top: 2px solid #34495e;
            }
            
            .summary-section {
                background: linear-gradient(135deg, #27ae60, #2ecc71);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin: 20px 0;
            }
            
            .summary-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 15px;
            }
            
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
            }
            
            .summary-item {
                background: rgba(255, 255, 255, 0.2);
                padding: 15px;
                border-radius: 8px;
            }
            
            .summary-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .summary-label {
                font-size: 12px;
                opacity: 0.9;
            }
            
            .footer {
                margin-top: 30px;
                text-align: center;
                border-top: 2px solid #bdc3c7;
                padding-top: 20px;
            }
            
            .signature-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-top: 30px;
            }
            
            .signature-box {
                text-align: center;
                border-top: 1px solid #7f8c8d;
                padding-top: 10px;
            }
            
            .signature-label {
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 40px;
            }
            
            .signature-line {
                border-bottom: 1px solid #7f8c8d;
                height: 40px;
                margin-bottom: 5px;
            }
            
            .no-data {
                text-align: center;
                color: #7f8c8d;
                font-style: italic;
                padding: 20px;
            }
            
            @media print {
                body { margin: 0; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🏪 ToySoft POS</div>
            <div class="title">CIERRE DIARIO</div>
            <div class="date-time">📅 ${fechaFormateada} - 🕐 ${hora}</div>
        </div>

        <div class="section">
            <div class="section-header">📋 Información del Cierre</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">👤 Entrega:</span>
                        <span class="info-value">${nombreCierre}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">👤 Recibe:</span>
                        <span class="info-value">${nombreRecibe}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💰 Base Caja:</span>
                        <span class="info-value">$${montoBaseCaja.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">📝 Detalles:</span>
                        <span class="info-value">${detalles || 'Sin detalles'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">📊 Resumen General de Ventas</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">💰 Total General:</span>
                        <span class="info-value">$${ventas.total.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💵 Efectivo:</span>
                        <span class="info-value">$${ventas.efectivo.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🏦 Transferencia:</span>
                        <span class="info-value">$${ventas.transferencia.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💳 Tarjeta:</span>
                        <span class="info-value">$${ventas.tarjeta.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">📝 Crédito:</span>
                        <span class="info-value">$${ventas.credito.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🔄 Mixto:</span>
                        <span class="info-value">$${ventas.mixto.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🚚 Domicilios a restar:</span>
                        <span class="info-value">$${(totalDomicilios || 0).toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">🤝 Propinas a restar:</span>
                        <span class="info-value">$${(totalPropinas || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
        ${Object.keys(totalesDomiciliarios || {}).length > 0 ? `
        <div class="section">
            <div class="section-header">🚚 Domiciliarios</div>
            <div class="section-content">
                <div class="info-grid">
                    ${Object.entries(totalesDomiciliarios).map(([nombre, monto]) => `
                    <div class="info-item">
                        <span class="info-label">${nombre}:</span>
                        <span class="info-value">$${monto.toLocaleString()}</span>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}

        <div class="totals-grid">
            <div class="total-section rapidas">
                <div class="total-title rapidas">⚡ Ventas Rápidas (caja rápida)</div>
                <div class="total-item">
                    <span>💵 Efectivo:</span>
                    <span>$${ventasRapidas.efectivo.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🏦 Transferencia:</span>
                    <span>$${ventasRapidas.transferencia.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>💳 Tarjeta:</span>
                    <span>$${ventasRapidas.tarjeta.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📝 Crédito:</span>
                    <span>$${ventasRapidas.credito.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🔄 Mixto:</span>
                    <span>$${ventasRapidas.mixto.toLocaleString()}</span>
                </div>
                ${(ventasRapidas.domicilio || 0) > 0 ? `
                <div class="total-item">
                    <span>🚚 Domicilios (caja rápida):</span>
                    <span>$${ventasRapidas.domicilio.toLocaleString()}</span>
                </div>` : ''}
                ${(ventasRapidas.mesa || 0) > 0 ? `
                <div class="total-item">
                    <span>🍽️ Mesa / Aquí (caja rápida):</span>
                    <span>$${ventasRapidas.mesa.toLocaleString()}</span>
                </div>` : ''}
                ${(ventasRapidas.recoger || 0) > 0 ? `
                <div class="total-item">
                    <span>🛍️ Recoger (caja rápida):</span>
                    <span>$${ventasRapidas.recoger.toLocaleString()}</span>
                </div>` : ''}
                ${(ventasRapidas.sinCanal || 0) > 0 ? `
                <div class="total-item">
                    <span>Sin clasificar:</span>
                    <span>$${ventasRapidas.sinCanal.toLocaleString()}</span>
                </div>` : ''}
                <div class="total-item">
                    <span>📊 TOTAL RÁPIDAS:</span>
                    <span>$${ventasRapidas.total.toLocaleString()}</span>
                </div>
            </div>

            <div class="total-section mesas">
                <div class="total-title mesas">🪑 Ventas de Mesas (flujo normal)</div>
                <div class="total-item">
                    <span>💵 Efectivo:</span>
                    <span>$${ventasMesas.efectivo.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🏦 Transferencia:</span>
                    <span>$${ventasMesas.transferencia.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>💳 Tarjeta:</span>
                    <span>$${ventasMesas.tarjeta.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📝 Crédito:</span>
                    <span>$${ventasMesas.credito.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>🔄 Mixto:</span>
                    <span>$${ventasMesas.mixto.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>📊 TOTAL MESAS:</span>
                    <span>$${ventasMesas.total.toLocaleString()}</span>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">💸 Gastos del Día</div>
            <div class="section-content">
                ${gastos > 0 ? `
                    <div class="info-item">
                        <span class="info-label">💰 Total Gastos:</span>
                        <span class="info-value">$${gastos.toLocaleString()}</span>
                    </div>
                ` : `
                    <div class="no-data">No hay gastos registrados</div>
                `}
            </div>
        </div>

        <div class="summary-section">
            <div class="summary-title">🎯 Resumen Final</div>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">$${ventas.total.toLocaleString()}</div>
                    <div class="summary-label">Total Ventas</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">$${(totalPropinas || 0).toLocaleString()}</div>
                    <div class="summary-label">Propinas</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">$${gastos.toLocaleString()}</div>
                    <div class="summary-label">Total Gastos</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">$${balance.toLocaleString()}</div>
                    <div class="summary-label">Balance Final</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-label">Firma de Entrega</div>
                    <div class="signature-line"></div>
                    <div>${nombreCierre}</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">Firma de Recibe</div>
                    <div class="signature-line"></div>
                    <div>${nombreRecibe}</div>
                </div>
            </div>
            <div style="margin-top: 30px; font-size: 10px; color: #7f8c8d;">
                Generado por ToySoft POS - ${new Date().toLocaleString('es-ES')}
            </div>
        </div>
    </body>
    </html>
    `;

    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
    ventanaImpresion.document.write(contenido);
    ventanaImpresion.document.close();
    
    // Esperar a que se cargue el contenido y luego imprimir
    ventanaImpresion.onload = function() {
        setTimeout(() => {
            ventanaImpresion.print();
            ventanaImpresion.close();
        }, 500);
    };
}

// Función para mostrar historial de ventas
function mostrarHistorialVentas() {
  const tablaHistorial = document.getElementById('tablaHistorialVentas');
  const cuerpoTabla = tablaHistorial.querySelector('tbody');
  cuerpoTabla.innerHTML = '';

  // Obtener la fecha seleccionada del input
  const fechaSeleccionada = document.getElementById('fechaHistorialVentas').value;
  const fechaFiltro = fechaSeleccionada ? new Date(fechaSeleccionada) : new Date();

  // Obtener todas las ventas (normales + rápidas)
  const todasLasVentas = obtenerTodasLasVentas();

  // Filtrar ventas por fecha
  const ventasFiltradas = todasLasVentas.filter(venta => {
    const fechaVenta = new Date(venta.fecha);
    return fechaVenta.toDateString() === fechaFiltro.toDateString();
  });

  ventasFiltradas.forEach(venta => {
    const fila = document.createElement('tr');
    const fechaFormateada = new Date(venta.fecha).toLocaleString();
    fila.innerHTML = `
      <td>${fechaFormateada}</td>
      <td>${venta.tipo || 'Normal'}</td>
      <td>${venta.cliente || venta.mesa || '-'}</td>
      <td>$${venta.total.toFixed(2)}</td>
      <td>${venta.metodoPago}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="reimprimirFactura('${venta.id}')">
          <i class="fas fa-print"></i>
        </button>
      </td>
    `;
    cuerpoTabla.appendChild(fila);
  });

  // Actualizar totales
  const totalVentas = ventasFiltradas.reduce((sum, venta) => sum + venta.total, 0);
  document.getElementById('totalVentasHistorial').textContent = totalVentas.toFixed(2);
}

// Función para mostrar historial de cocina
function mostrarHistorialCocina() {
  const tablaHistorial = document.getElementById('tablaHistorialCocina');
  if (!tablaHistorial) {
    console.error('No se encontró la tabla de historial de cocina');
    return;
  }

  const cuerpoTabla = tablaHistorial.querySelector('tbody');
  if (!cuerpoTabla) {
    console.error('La tabla de historial de cocina no tiene <tbody>');
    return;
  }

  cuerpoTabla.innerHTML = '';

  // Obtener la fecha seleccionada del input
  const inputFecha = document.getElementById('fechaHistorialCocina');
  const valorFecha = inputFecha ? inputFecha.value : '';
  const fechaFiltro = valorFecha ? new Date(valorFecha) : new Date();

  // Filtrar órdenes por fecha usando helpers robustos de fecha
  const ordenesFiltradas = historialCocina.filter(orden => {
    try {
      const fechaAUsar = orden.fecha || orden.fechaMostrar;
      if (!fechaAUsar) {
        return false;
      }
      return esMismaFechaLocal(fechaAUsar, fechaFiltro);
    } catch (e) {
      console.error('Error al filtrar orden de cocina por fecha:', e, orden);
      return false;
    }
  });

  ordenesFiltradas.forEach(orden => {
    const fila = document.createElement('tr');

    // Formatear fecha de manera segura
    const baseFecha = orden.fecha || orden.fechaMostrar;
    let fechaFormateada = '-';
    if (baseFecha) {
      const fechaParseada = parseFechaSeguro(baseFecha);
      if (fechaParseada) {
        fechaFormateada = fechaParseada.toLocaleString();
      } else {
        fechaFormateada = baseFecha;
      }
    }

    const itemsTexto = Array.isArray(orden.items)
      ? orden.items.map(item => item.nombre).join(', ')
      : '-';

    fila.innerHTML = `
      <td>${fechaFormateada}</td>
      <td>${orden.mesa || orden.tipo || '-'}</td>
      <td>${orden.cliente || '-'}</td>
      <td>${itemsTexto}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="reimprimirTicketCocina('${orden.id}')">
          <i class="fas fa-print"></i>
        </button>
      </td>
    `;
    cuerpoTabla.appendChild(fila);
  });
}

// Función para mostrar el modal de historial de ventas
function mostrarModalHistorialVentas() {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorialVentas'));
  // Establecer la fecha actual por defecto
  document.getElementById('fechaHistorialVentas').valueAsDate = new Date();
  mostrarHistorialVentas();
  modal.show();
}

// Función para mostrar el modal de historial de cocina
function mostrarModalHistorialCocina() {
  const modal = new bootstrap.Modal(document.getElementById('modalHistorialCocina'));
  // Establecer la fecha actual por defecto
  document.getElementById('fechaHistorialCocina').valueAsDate = new Date();
  mostrarHistorialCocina();
  modal.show();
}

// Función para formatear número
function formatearNumero(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-CO');
}

// Función para inicializar WhatsApp Web
function inicializarWhatsApp() {
    const container = document.getElementById('whatsappContainer');
    if (!container) return;

    // Crear el iframe
    const iframe = document.createElement('iframe');
    iframe.src = 'https://web.whatsapp.com';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    // Mensaje de carga
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'whatsapp-loading';
    loadingDiv.innerHTML = `
        <div class="spinner-border text-success" role="status">
            <span class="visually-hidden">Cargando...</span>
        </div>
        <p>Cargando WhatsApp Web...</p>
    `;

    container.appendChild(loadingDiv);

    // Manejar la carga del iframe
    iframe.onload = function() {
        loadingDiv.remove();
        container.appendChild(iframe);
    };

    iframe.onerror = function() {
        loadingDiv.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-circle"></i>
                Error al cargar WhatsApp Web
            </div>
            <button class="btn btn-primary mt-3" onclick="inicializarWhatsApp()">
                <i class="fas fa-redo"></i> Reintentar
            </button>
        `;
    };
}

// Inicializar WhatsApp cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    inicializarWhatsApp();
});

// Función para mostrar/ocultar el panel de WhatsApp
function toggleWhatsApp() {
    const whatsappPanel = document.getElementById('whatsappPanel');
    const whatsappContainer = document.getElementById('whatsappContainer');
    
    if (whatsappPanel.style.display === 'none' || !whatsappPanel.style.display) {
        whatsappPanel.style.display = 'block';
        // Crear un iframe para WhatsApp Web
        whatsappContainer.innerHTML = `
            <iframe 
                src="https://web.whatsapp.com" 
                style="width: 100%; height: 600px; border: none;"
                allow="camera; microphone"
            ></iframe>
        `;
    } else {
        whatsappPanel.style.display = 'none';
        whatsappContainer.innerHTML = '';
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM cargado, iniciando aplicación...');
  
  // Cargar datos primero (esto ya incluye inicializarDatosPrueba y mostrarProductos)
  cargarDatos();
  
  // Inicializar lista de domiciliarios para autocompletado
  if (obtenerNombresDomiciliarios().length === 0) {
    try {
      const historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
      const unicos = new Set();
      historial.forEach(v => {
        const n = (v.nombreDomiciliario || v.domiciliario || '').trim();
        if (n) unicos.add(n);
      });
      unicos.forEach(n => guardarNombreDomiciliario(n));
    } catch (e) { /* ignorar */ }
  }
  actualizarDatalistDomiciliarios();
  const inputDomiciliario = document.getElementById('nombreDomiciliario');
  if (inputDomiciliario) {
    inputDomiciliario.addEventListener('blur', function() {
      const n = (this.value || '').trim();
      if (n) guardarNombreDomiciliario(n);
    });
  }

  // Inicializar WhatsApp Web
  inicializarWhatsApp();
  
  // Agregar evento para el botón de nueva mesa
  const btnNuevaMesa = document.getElementById('btnNuevaMesa');
  if (btnNuevaMesa) {
    btnNuevaMesa.addEventListener('click', crearNuevaMesa);
  }
  
  // Agregar evento para la tecla Enter en el input de número de mesa
  const nuevaMesa = document.getElementById('nuevaMesa');
  if (nuevaMesa) {
    nuevaMesa.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        crearNuevaMesa();
      }
    });
  }
  
  // Actualizar total cuando cambian propina o descuento
  const propina = document.getElementById('propina');
  if (propina) {
    propina.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }
  
  const descuento = document.getElementById('descuento');
  if (descuento) {
    descuento.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }
  
  const valorDomicilio = document.getElementById('valorDomicilio');
  if (valorDomicilio) {
    valorDomicilio.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }

  const nombreDomiciliario = document.getElementById('nombreDomiciliario');
  if (nombreDomiciliario) {
    nombreDomiciliario.addEventListener('input', () => {
      if (mesaSeleccionada) {
        actualizarTotal(mesaSeleccionada);
      }
    });
  }
});


// Funciones para gestionar gastos
function modificarGasto(id) {
    const gastos = obtenerGastosCombinados();
    const gasto = gastos.find(g => String(g.id) === String(id));
    
    if (!gasto) {
        alert('Gasto no encontrado');
        return;
    }

    document.getElementById('descripcionGasto').value = gasto.descripcion;
    document.getElementById('montoGasto').value = gasto.monto;
    if (document.getElementById('fechaGasto') && gasto.fecha) {
        document.getElementById('fechaGasto').value = String(gasto.fecha).split('T')[0];
    }
    const forma = document.getElementById('formaPagoGasto');
    if (forma) {
        forma.value = normalizarFormaPagoGasto(gasto.formaPago);
        forma.disabled = gasto.estadoPago === 'pagado' && normalizarFormaPagoGasto(gasto.formaPago) === 'credito';
    }
    const proveedor = document.getElementById('proveedorGasto');
    if (proveedor) proveedor.value = gasto.proveedor || '';
    if (typeof actualizarAyudaFormaPagoGastoPOS === 'function') actualizarAyudaFormaPagoGastoPOS();
    
    const btnGuardar = document.getElementById('btnGuardarGasto');
    btnGuardar.textContent = 'Actualizar Gasto';
    btnGuardar.onclick = () => actualizarGasto(id);
}

function actualizarGasto(id) {
    const descripcion = document.getElementById('descripcionGasto').value;
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const fecha = document.getElementById('fechaGasto') ? document.getElementById('fechaGasto').value : '';
    const formaPago = document.getElementById('formaPagoGasto')?.value || 'efectivo';
    const proveedor = document.getElementById('proveedorGasto')?.value || '';
    
    if (!descripcion || !monto || (document.getElementById('fechaGasto') && !fecha)) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const existente = obtenerGastosCombinados().find(g => String(g.id) === String(id));
    if (!existente) {
        alert('Gasto no encontrado');
        return;
    }

    const fechaISO = fecha ? new Date(fecha + 'T12:00:00').toISOString() : (existente.fecha || new Date().toISOString());
    const actualizado = construirObjetoGasto({
        id: existente.id,
        fecha: fechaISO,
        descripcion,
        monto,
        categoria: existente.categoria || 'otros',
        formaPago,
        proveedor,
        existente
    });
    guardarGastoEnStorage(actualizado);
    
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    if (document.getElementById('fechaGasto')) document.getElementById('fechaGasto').value = '';
    if (document.getElementById('proveedorGasto')) document.getElementById('proveedorGasto').value = '';
    const forma = document.getElementById('formaPagoGasto');
    if (forma) {
        forma.value = 'efectivo';
        forma.disabled = false;
    }
    
    const btnGuardar = document.getElementById('btnGuardarGasto');
    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Gasto';
    btnGuardar.onclick = guardarGasto;
    
    mostrarGastos();
    alert('Gasto actualizado exitosamente');
}

function eliminarGasto(id) {
    if (!confirm('¿Está seguro que desea eliminar este gasto?')) {
        return;
    }
    eliminarGastoDeStorage(id);
    mostrarGastos();
    alert('Gasto eliminado exitosamente');
}

function mostrarGastos() {
    const tablaGastos = document.getElementById('tablaGastos');
    if (!tablaGastos) return;
    const cuerpoTabla = tablaGastos.querySelector('tbody');
    cuerpoTabla.innerHTML = '';
    
    const gastos = obtenerGastosCombinados().slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    gastos.forEach(gasto => {
        const fila = document.createElement('tr');
        const puedePagar = esCreditoPendiente(gasto);
        fila.innerHTML = `
            <td>${new Date(gasto.fecha).toLocaleDateString()}</td>
            <td>${gasto.descripcion || ''}${gasto.proveedor ? `<br><small>${gasto.proveedor}</small>` : ''}</td>
            <td>${etiquetaFormaPagoGasto(gasto)}</td>
            <td>$${(parseFloat(gasto.monto) || 0).toLocaleString()}</td>
            <td>
                ${puedePagar ? `<button class="btn btn-sm btn-warning me-1" onclick="abrirPagoGastoCreditoPOS('${String(gasto.id).replace(/'/g, '')}')" title="Registrar pago">
                    <i class="fas fa-hand-holding-usd"></i>
                </button>` : ''}
                <button class="btn btn-sm btn-warning" onclick="modificarGasto(${JSON.stringify(gasto.id)})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarGasto(${JSON.stringify(gasto.id)})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}

function mostrarModalGastos() {
    abrirModalEstatico('modalGastos');
    if (typeof actualizarAyudaFormaPagoGastoPOS === 'function') actualizarAyudaFormaPagoGastoPOS();
    mostrarGastos();
}

function actualizarAyudaFormaPagoGastoPOS() {
    const forma = document.getElementById('formaPagoGasto')?.value || 'efectivo';
    const ayuda = document.getElementById('ayudaFormaPagoGasto');
    if (ayuda && typeof textoAyudaFormaPagoGasto === 'function') {
        ayuda.textContent = textoAyudaFormaPagoGasto(forma);
    }
    const grupo = document.getElementById('grupoProveedorGasto');
    if (grupo) grupo.style.display = forma === 'credito' ? 'block' : 'none';
}

function abrirPagoGastoCreditoPOS(id) {
    const gasto = obtenerGastosCombinados().find(g => String(g.id) === String(id));
    if (!gasto || !esCreditoPendiente(gasto)) {
        alert('Este gasto no está pendiente de pago');
        return;
    }
    document.getElementById('gastoCreditoPagarIdPOS').value = String(gasto.id);
    document.getElementById('resumenPagoCreditoPOS').textContent =
        `${gasto.descripcion} · $${(parseFloat(gasto.monto) || 0).toLocaleString()}${gasto.proveedor ? ` · ${gasto.proveedor}` : ''}`;
    document.getElementById('formaPagoLiquidacionGastoPOS').value = 'efectivo';
    const modalEl = document.getElementById('modalPagarGastoCreditoPOS');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function confirmarPagoGastoCreditoPOS() {
    const id = document.getElementById('gastoCreditoPagarIdPOS').value;
    const forma = document.getElementById('formaPagoLiquidacionGastoPOS').value;
    const resultado = registrarPagoGastoCredito(id, forma);
    if (!resultado.ok) {
        alert(resultado.error || 'No se pudo registrar el pago');
        return;
    }
    const modalEl = document.getElementById('modalPagarGastoCreditoPOS');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    mostrarGastos();
    alert(forma === 'efectivo' ? 'Pago registrado. Se restará del efectivo en caja de hoy.' : 'Pago registrado. No sale de la caja física.');
}

function guardarGasto() {
    const descripcion = document.getElementById('descripcionGasto').value;
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const fecha = document.getElementById('fechaGasto') ? document.getElementById('fechaGasto').value : '';
    const formaPago = document.getElementById('formaPagoGasto')?.value || 'efectivo';
    const proveedor = document.getElementById('proveedorGasto')?.value || '';
    
    if (!descripcion || !monto || (document.getElementById('fechaGasto') && !fecha)) {
        alert('Por favor, complete todos los campos');
        return;
    }

    const fechaISO = fecha ? new Date(fecha + 'T12:00:00').toISOString() : new Date().toISOString();
    const nuevoGasto = construirObjetoGasto({
        descripcion,
        monto,
        categoria: 'otros',
        formaPago,
        proveedor,
        fecha: fechaISO
    });
    guardarGastoEnStorage(nuevoGasto);
    
    document.getElementById('descripcionGasto').value = '';
    document.getElementById('montoGasto').value = '';
    if (document.getElementById('fechaGasto')) document.getElementById('fechaGasto').value = '';
    if (document.getElementById('proveedorGasto')) document.getElementById('proveedorGasto').value = '';
    const forma = document.getElementById('formaPagoGasto');
    if (forma) {
        forma.value = 'efectivo';
        forma.disabled = false;
    }
    if (typeof actualizarAyudaFormaPagoGastoPOS === 'function') actualizarAyudaFormaPagoGastoPOS();
    
    mostrarGastos();
    alert('Gasto guardado exitosamente');
}

// Función para mostrar vista previa del recibo
function mostrarVistaPreviaRecibo() {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = pedidoDeMesa(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos para generar recibo');
    return;
  }

  // Calcular totales
  const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = obtenerValorDomicilioPedido(mesaSeleccionada, pedido);
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

  // Obtener la ventana de impresión
  const ventanaPrevia = obtenerVentanaImpresion();
  if (!ventanaPrevia) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  // Determinar tipo de pedido e información adicional
  let tipoPedido = '';
  let infoAdicional = '';

  if (mesaSeleccionada.startsWith('DOM-')) {
    tipoPedido = 'Pedido a Domicilio';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Dir:</strong> <strong>${pedido.direccion || 'No especificada'}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
        </div>
      `;
    }
  } else if (mesaSeleccionada.startsWith('REC-')) {
    tipoPedido = 'Pedido para Recoger';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
          ${pedido.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${pedido.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  }

  // Información de cambio de mesa o tipo si existe
  let infoCambioMesa = htmlBloqueCambioPedidoRecibo(pedido.cambioMesa);

  const contenidoRecibo = `
    <div class="logo-container">
      ${localStorage.getItem('logoNegocio') ? 
        `<img src="${localStorage.getItem('logoNegocio')}" alt="Logo">` : 
        ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      <div class="mb-1">RECIBO PRELIMINAR</div>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date().toLocaleString()}</div>
      ${!mesaSeleccionada.startsWith('DOM-') && !mesaSeleccionada.startsWith('REC-') ? 
        `<div class="mb-1">Mesa: ${mesaSeleccionada}</div>` : ''}
    </div>
    
    ${infoAdicional}
    ${infoCambioMesa}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items.map(item => `
          <tr>
            <td><strong>${item.nombre}</strong></td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.precio * item.cantidad)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1"><strong>Subtotal:</strong> <span style="float:right;">${formatearNumero(subtotal)}</span></div>
      ${propina > 0 ? `<div class="mb-1"><strong>Propina (${propina}%):</strong> <span style="float:right;">${formatearNumero(propinaMonto)}</span></div>` : ''}
      ${descuento > 0 ? `<div class="mb-1"><strong>Descuento:</strong> <span style="float:right;">-${formatearNumero(descuento)}</span></div>` : ''}
      ${valorDomicilio > 0 ? `<div class="mb-1"><strong>Domicilio:</strong> <span style="float:right;">${formatearNumero(valorDomicilio)}</span></div>${(pedido.nombreDomiciliario || '').trim() ? `<div class="mb-1"><strong>Domiciliario:</strong> ${pedido.nombreDomiciliario}</div>` : ''}` : ''}
      <div class="mb-1 total-row"><strong>TOTAL:</strong> <span style="float:right;">${formatearNumero(total)}</span></div>
    </div>
    
    ${htmlPieDatosNegocioTicket()}
    
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su visita!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;
  
  // Escribir el contenido completo en la ventana
  ventanaPrevia.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vista Previa Recibo</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
  
  // Cerrar el documento y enfocar la ventana
  ventanaPrevia.document.close();
  ventanaPrevia.focus();
}

// Función para generar recibo preliminar
function generarReciboPreliminar() {
  if (!mesaSeleccionada || !mesaEstaActiva(mesaSeleccionada)) {
    alert('Por favor, seleccione una mesa con productos');
    return;
  }

  const pedido = pedidoDeMesa(mesaSeleccionada);
  if (!pedido || !pedido.items || pedido.items.length === 0) {
    alert('No hay productos para generar recibo');
    return;
  }

  // Calcular totales
  const subtotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const propina = parseFloat(document.getElementById('propina').value) || 0;
  const descuento = parseFloat(document.getElementById('descuento').value) || 0;
  const valorDomicilio = obtenerValorDomicilioPedido(mesaSeleccionada, pedido);
  const propinaMonto = Math.round((subtotal * propina) / 100);
  const total = Math.round(subtotal + propinaMonto - descuento + valorDomicilio);

  // Obtener la ventana de impresión
  const ventanaPrevia = obtenerVentanaImpresion();
  if (!ventanaPrevia) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }

  // Determinar tipo de pedido e información adicional
  let tipoPedido = '';
  let infoAdicional = '';

  if (mesaSeleccionada.startsWith('DOM-')) {
    tipoPedido = 'Pedido a Domicilio';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Dir:</strong> <strong>${pedido.direccion || 'No especificada'}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
        </div>
      `;
    }
  } else if (mesaSeleccionada.startsWith('REC-')) {
    tipoPedido = 'Pedido para Recoger';
    if (pedido.cliente) {
      infoAdicional = `
        <div class="border-top">
          <div class="mb-1"><strong>Cliente:</strong> <strong>${pedido.cliente}</strong></div>
          <div class="mb-1"><strong>Tel:</strong> <strong>${pedido.telefono || 'No especificado'}</strong></div>
          ${pedido.horaRecoger ? `<div class="mb-1"><strong>Hora:</strong> <strong>${pedido.horaRecoger}</strong></div>` : ''}
        </div>
      `;
    }
  }

  // Información de cambio de mesa o tipo si existe
  let infoCambioMesa = htmlBloqueCambioPedidoRecibo(pedido.cambioMesa);

  const contenidoRecibo = `
    <div class="logo-container">
      ${localStorage.getItem('logoNegocio') ? 
        `<img src="${localStorage.getItem('logoNegocio')}" alt="Logo">` : 
        ''}
    </div>

    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">RESTAURANTE</h2>
      <div class="mb-1">RECIBO PRELIMINAR</div>
      ${tipoPedido ? `<div class="mb-1">${tipoPedido}</div>` : ''}
      <div class="mb-1">${new Date().toLocaleString()}</div>
      ${!mesaSeleccionada.startsWith('DOM-') && !mesaSeleccionada.startsWith('REC-') ? 
        `<div class="mb-1">Mesa: ${mesaSeleccionada}</div>` : ''}
    </div>
    
    ${infoAdicional}
    ${infoCambioMesa}
    
    <table>
      <thead>
        <tr>
          <th style="width: 40%">Producto</th>
          <th style="width: 15%">Cant</th>
          <th style="width: 20%">Precio</th>
          <th style="width: 25%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items.map(item => `
          <tr>
            <td><strong>${item.nombre}</strong></td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.precio * item.cantidad)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="border-top">
      <div class="mb-1">Subtotal: <span class="text-right">$ ${formatearNumero(subtotal)}</span></div>
      <div class="mb-1">Propina (${propina}%): <span class="text-right">$ ${formatearNumero(propinaMonto)}</span></div>
      <div class="mb-1">Descuento: <span class="text-right">$ ${formatearNumero(descuento)}</span></div>
      ${valorDomicilio > 0 ? `<div class="mb-1">Domicilio: <span class="text-right">$ ${formatearNumero(valorDomicilio)}</span></div>${(pedido.nombreDomiciliario || '').trim() ? `<div class="mb-1">Domiciliario: ${pedido.nombreDomiciliario}</div>` : ''}` : ''}
      <div class="mb-1 total-row"><strong>Total: $ ${formatearNumero(total)}</strong></div>
    </div>
    
    <div class="text-center mt-1">
      <div class="border-top">RECIBO PRELIMINAR - NO VÁLIDO COMO FACTURA</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  // Escribir el contenido completo en la ventana
  ventanaPrevia.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo Preliminar</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: monospace;
            font-size: 14px;
            width: 57mm;
            margin: 0;
            padding: 1mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { 
            width: 100%;
            border-collapse: collapse;
            margin: 1mm 0;
            font-size: 14px;
          }
          th, td { 
            padding: 0.5mm;
            text-align: left;
            font-size: 14px;
          }
          .border-top { 
            border-top: 1px dashed #000;
            margin-top: 1mm;
            padding-top: 1mm;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .total-row {
            font-weight: bold;
            font-size: 16px;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 2mm;
          }
          .logo-container img {
            max-width: 100%;
            max-height: 120px;
          }
          .botones-impresion {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #fff;
            padding: 5px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .botones-impresion button {
            margin: 0 5px;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .botones-impresion button:hover {
            background: #0056b3;
          }
          @media print {
            .botones-impresion {
              display: none;
            }
            @page {
              margin: 0;
              size: 57mm auto;
            }
            body {
              width: 57mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenido">
          ${contenidoRecibo}
        </div>
      </body>
    </html>
  `);
  
  // Cerrar el documento y enfocar la ventana
  ventanaPrevia.document.close();
  ventanaPrevia.focus();
}

function imprimirBalancePorPeriodo(tipoPeriodo) {
    try {
        // Obtener todas las ventas (normales + rápidas)
        const todasLasVentas = obtenerTodasLasVentas();
        const hoy = new Date();
        let fechaInicio, fechaFin;
        // Determinar el rango de fechas según el tipo de período
        switch(tipoPeriodo) {
            case 'semanal':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(hoy.getDate() - hoy.getDay() + 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(fechaInicio);
                fechaFin.setDate(fechaInicio.getDate() + 6);
                fechaFin.setHours(23, 59, 59, 999);
                break;
            case 'mensual':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
                fechaFin.setHours(23, 59, 59, 999);
                break;
            case 'anual':
                fechaInicio = new Date(hoy.getFullYear(), 0, 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy.getFullYear(), 11, 31);
                fechaFin.setHours(23, 59, 59, 999);
                break;
            default:
                throw new Error('Tipo de período no válido');
        }
        // Filtrar ventas por rango de fechas
        const ventasFiltradas = todasLasVentas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            return fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
        });
        // Calcular totales por método de pago
        let totalEfectivo = 0, totalTransferencia = 0, totalTarjeta = 0, totalCredito = 0, totalMixto = 0, totalVentas = 0;
        ventasFiltradas.forEach(v => {
            const total = parseFloat(v.total) || 0;
            const metodo = (v.metodoPago || '').toLowerCase();
            if (metodo === 'mixto') {
                const efectivoMixto = parseFloat(v.montoRecibido) || 0;
                const transferenciaMixto = parseFloat(v.montoTransferencia) || 0;
                totalMixto += total;
                totalEfectivo += efectivoMixto;
                totalTransferencia += transferenciaMixto;
            } else {
                switch (metodo) {
                    case 'efectivo':
                        totalEfectivo += total;
                        break;
                    case 'transferencia':
                        totalTransferencia += total;
                        break;
                    case 'tarjeta':
                        totalTarjeta += total;
                        break;
                    case 'crédito':
                        totalCredito += total;
                        break;
                }
            }
            totalVentas += total;
        });
        // Total domicilios del período (todos: efectivo y transferencia)
        const totalDomiciliosPeriodo = ventasFiltradas.reduce((sum, v) => sum + (parseFloat(v.valorDomicilio) || 0), 0);
        const totalPropinasPeriodo = ventasFiltradas.reduce((sum, v) => sum + propinaMontoDeVenta(v), 0);
        // Obtener gastos del período
        const todosGastosPeriodo = typeof obtenerGastosCombinados === 'function'
            ? obtenerGastosCombinados()
            : (JSON.parse(localStorage.getItem('historialGastos')) || []);
        const predPeriodo = (fechaValor) => {
            if (!fechaValor) return false;
            const fechaGasto = new Date(fechaValor);
            return fechaGasto >= fechaInicio && fechaGasto <= fechaFin;
        };
        const gastosFiltrados = todosGastosPeriodo.filter(gasto => predPeriodo(gasto.fecha) || predPeriodo(gasto.fechaPago));
        const totalGastos = gastosFiltrados.reduce((sum, g) => {
            if (typeof gastoAfectaBalanceEnFecha === 'function') {
                return sum + (gastoAfectaBalanceEnFecha(g, predPeriodo) ? (parseFloat(g.monto) || 0) : 0);
            }
            return sum + (parseFloat(g.monto) || 0);
        }, 0);
        // Calcular balance final (ventas - gastos - todos los domicilios)
        const balanceFinal = totalVentas - totalGastos - totalDomiciliosPeriodo - totalPropinasPeriodo;
        // Formatear fechas para mostrar
        const formatoFecha = (fecha) => {
            return fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Crear una ventana modal en lugar de una nueva ventana
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'modalBalance';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'modalBalanceLabel');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="modalBalanceLabel">Balance ${tipoPeriodo.charAt(0).toUpperCase() + tipoPeriodo.slice(1)}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-3">
                            <h4>Del ${formatoFecha(fechaInicio)}</h4>
                            <h4>Al ${formatoFecha(fechaFin)}</h4>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Total Ventas: $ ${totalVentas.toLocaleString()}</h5>
                            <div>- Efectivo: $ ${totalEfectivo.toLocaleString()}</div>
                            <div>- Transferencia: $ ${totalTransferencia.toLocaleString()}</div>
                            <div>- Tarjeta: $ ${totalTarjeta.toLocaleString()}</div>
                            <div>- Crédito: $ ${totalCredito.toLocaleString()}</div>
                            <div>- Propinas a restar: $ ${totalPropinasPeriodo.toLocaleString()}</div>
                            <div>- Domicilios a restar: $ ${totalDomiciliosPeriodo.toLocaleString()}</div>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Total Gastos: $ ${totalGastos.toLocaleString()}</h5>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Balance Final: $ ${balanceFinal.toLocaleString()}</h5>
                        </div>
                        <div class="border-top border-light pt-3 mb-3">
                            <h5>Detalle de Gastos:</h5>
                            ${gastosFiltrados.map(gasto => `
                                <div>- ${gasto.descripcion}: $ ${gasto.monto.toLocaleString()}</div>
                            `).join('')}
                        </div>
                        <div class="border-top border-light pt-3">
                            <h5>Créditos Pendientes:</h5>
                            ${ventasFiltradas.filter(v => (v.metodoPago || '').toLowerCase() === 'crédito').map(credito => `
                                <div>- ${credito.cliente || 'No especificado'}: $ ${credito.total.toLocaleString()}</div>
                            `).join('') || '<div>No hay créditos pendientes</div>'}
                        </div>
                        
                        <div class="border-top border-light pt-3 text-center">
                            <div class="mb-1">Firma de Entrega: _________________</div>
                            <div class="mb-1">Firma de Recibe: _________________</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="imprimirBalanceModal()">Imprimir</button>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al body
        document.body.appendChild(modal);

        // Inicializar el modal de Bootstrap
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Limpiar el modal cuando se cierre
        modal.addEventListener('hidden.bs.modal', function () {
            document.body.removeChild(modal);
        });

    } catch (error) {
        console.error('Error al generar balance:', error);
        alert('Error al generar el balance: ' + error.message);
    }
}

// Función para imprimir el balance desde el modal
function imprimirBalanceModal() {
    const modalContent = document.querySelector('#modalBalance .modal-content');
    const ventana = window.open('', '_blank');
    
    ventana.document.write(`
        <html>
            <head>
                <title>Balance</title>
                <style>
                    body { 
                        font-family: monospace;
                        font-size: 14px;
                        width: 57mm;
                        margin: 0;
                        padding: 1mm;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .mb-1 { margin-bottom: 0.5mm; }
                    .mt-1 { margin-top: 0.5mm; }
                    .border-top { 
                        border-top: 1px dashed #000;
                        margin-top: 1mm;
                        padding-top: 1mm;
                    }
                    @media print {
                        @page {
                            margin: 0;
                            size: 57mm auto;
                        }
                        body {
                            width: 57mm;
                        }
                    }
                </style>
            </head>
            <body>
                ${modalContent.innerHTML}
            </body>
        </html>
    `);
    
    ventana.document.close();
    ventana.print();
}

// Función para verificar y reiniciar contadores si es un nuevo día
function verificarContadoresDiarios() {
  const fechaActual = new Date().toLocaleDateString();
  
  // Si no hay fecha guardada o es un nuevo día, reiniciar contadores
  if (!ultimaFechaContadores || ultimaFechaContadores !== fechaActual) {
    reiniciarContadoresDomRec();
  }
}

// Función para cargar contadores desde localStorage
function cargarContadores() {
  const dom = localStorage.getItem('contadorDomicilios');
  const rec = localStorage.getItem('contadorRecoger');
  contadorDomicilios = (dom !== null && dom !== '') ? (parseInt(dom, 10) || 0) : 0;
  contadorRecoger = (rec !== null && rec !== '') ? (parseInt(rec, 10) || 0) : 0;
  ultimaFechaContadores = localStorage.getItem('ultimaFechaContadores');
  verificarContadoresDiarios();
}

// Funciones para manejar cotizaciones
function mostrarModalCotizaciones() {
  try {
    actualizarTablaCotizaciones();
    abrirModalEstatico('modalCotizaciones');
  } catch (error) {
    console.error('Error al mostrar las cotizaciones:', error);
    alert('Error al mostrar las cotizaciones');
  }
}

// Función para mostrar el modal de nueva cotización
function mostrarModalNuevaCotizacion() {
  try {
    // Verificar que el modal existe
    const modalElement = document.getElementById('modalNuevaCotizacion');
    if (!modalElement) {
      throw new Error('El modal de nueva cotización no existe en el DOM');
    }

    // Inicializar arrays si no existen
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    if (!Array.isArray(window.productosFiltrados)) {
      window.productosFiltrados = [];
    }

    // Verificar y establecer fecha actual
    const fechaInput = document.getElementById('fechaCotizacion');
    if (!fechaInput) {
      throw new Error('El campo de fecha no existe');
    }
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().split('T')[0];

    // Verificar y cargar clientes
    const selectCliente = document.getElementById('clienteCotizacion');
    if (!selectCliente) {
      throw new Error('El selector de clientes no existe');
    }
    selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    clientes.forEach(cliente => {
      const option = document.createElement('option');
      option.value = cliente.id;
      option.textContent = cliente.nombre;
      selectCliente.appendChild(option);
    });

    // Limpiar campos de búsqueda y resultados
    const buscarProducto = document.getElementById('buscarProducto');
    if (buscarProducto) {
      buscarProducto.value = '';
    }
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    if (resultadosBusqueda) {
      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';
    }
    const productoManual = document.getElementById('productoManual');
    if (productoManual) {
      productoManual.value = '';
      productoManual.style.display = 'none';
    }

    // Limpiar tabla de items
    const tablaItems = document.getElementById('itemsCotizacion');
    if (!tablaItems) {
      throw new Error('La tabla de items no existe');
    }
    tablaItems.innerHTML = '';

    // Actualizar total
    actualizarTotalCotizacion();

    // Cerrar el modal de cotizaciones primero
    const modalCotizaciones = bootstrap.Modal.getInstance(document.getElementById('modalCotizaciones'));
    if (modalCotizaciones) {
      modalCotizaciones.hide();
    }

    // Mostrar el modal de nueva cotización
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    });
    modal.show();

    // Asegurar que el modal esté por encima
    modalElement.style.zIndex = '1060';

    // Cargar productos iniciales
    filtrarProductosCotizacion();
  } catch (error) {
    console.error('Error detallado:', error);
    alert(`Error al mostrar el formulario de nueva cotización: ${error.message}`);
  }
}

function agregarItemCotizacion() {
  try {
    const producto = document.getElementById('productoManual').style.display === 'none' 
      ? document.getElementById('buscarProducto').value
      : document.getElementById('productoManual').value;
    const cantidad = parseInt(document.getElementById('cantidadItem').value) || 1;
    const precio = parseFloat(document.getElementById('precioItem').value) || 0;

    if (!producto) {
      alert('Por favor, seleccione o escriba un producto');
      return;
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (precio <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }

    const item = {
      id: Date.now(),
      producto: producto,
      cantidad: cantidad,
      precio: precio,
      subtotal: cantidad * precio
    };

    // Agregar el item al array global
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    window.itemsCotizacion.push(item);
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();

    // Limpiar campos
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('cantidadItem').value = '1';
    document.getElementById('precioItem').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';

    // Volver a mostrar la lista de productos disponibles
    if (typeof filtrarProductosCotizacion === 'function') {
      filtrarProductosCotizacion();
    } else if (typeof buscarProductosCotizacion === 'function') {
      buscarProductosCotizacion();
    }
  } catch (error) {
    console.error('Error al agregar item:', error);
    alert('Error al agregar el item a la cotización');
  }
}

function mostrarItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizacionActual || !cotizacionActual.items || cotizacionActual.items.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="text-center">No hay items en la cotización</td></tr>';
        return;
    }

    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    // Actualizar total
    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarFormularioItem() {
    document.getElementById('cantidadItem').value = '';
    document.getElementById('precioItem').value = '';
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function eliminarItemCotizacion(id) {
    if (!cotizacionActual) return;
    
    cotizacionActual.items = cotizacionActual.items.filter(item => item.id !== id);
    cotizacionActual.total = cotizacionActual.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    actualizarTablaItemsCotizacion();
}

function guardarCotizacion() {
    try {
        const clienteId = document.getElementById('clienteCotizacion').value;
        const fecha = document.getElementById('fechaCotizacion').value;

        if (!clienteId) {
            alert('Por favor, seleccione un cliente');
            return;
        }

        if (!fecha) {
            alert('Por favor, seleccione una fecha');
            return;
        }

        if (window.itemsCotizacion.length === 0) {
            alert('Por favor, agregue al menos un item a la cotización');
            return;
        }

        const cotizacion = {
            id: Date.now(),
            fecha: fecha,
            clienteId: clienteId,
            items: window.itemsCotizacion,
            total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
        };

        // Guardar en localStorage
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        cotizaciones.push(cotizacion);
        localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));
        if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
          ToySoftFirebase.persistirDatosDebounced();
        }

        // Cerrar modal y limpiar
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
        modal.hide();
        window.itemsCotizacion = [];
        actualizarTablaCotizaciones();

        alert('Cotización guardada exitosamente');
    } catch (error) {
        console.error('Error al guardar cotización:', error);
        alert('Error al guardar la cotización');
    }
}

function mostrarCotizaciones() {
    const tabla = document.getElementById('tablaCotizaciones');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizaciones || cotizaciones.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center">No hay cotizaciones</td></tr>';
        return;
    }

    cotizaciones.forEach(cotizacion => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${formatearFecha(cotizacion.fecha)}</td>
            <td>${cotizacion.cliente.nombre}</td>
            <td>${cotizacion.items.length} items</td>
            <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="verCotizacion(${cotizacion.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

function verCotizacion(id) {
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    const cotizacion = cotizaciones.find(c => c.id === id);
    
    if (!cotizacion) {
        alert('Cotización no encontrada');
        return;
    }

    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    
    // Mostrar detalles en el modal
    document.getElementById('fechaCotizacionVer').textContent = formatearFecha(cotizacion.fecha);
    document.getElementById('clienteCotizacionVer').textContent = cliente ? cliente.nombre : 'Cliente no encontrado';
    
    const tbody = document.getElementById('tablaItemsCotizacionVer');
    tbody.innerHTML = '';
    cotizacion.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.producto}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('totalCotizacionVer').textContent = formatearPrecio(cotizacion.total);
    
    const modal = new bootstrap.Modal(document.getElementById('modalVerCotizacion'));
    modal.show();
}

function eliminarCotizacion(id) {
    if (confirm('¿Está seguro de eliminar esta cotización?')) {
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        const nuevasCotizaciones = cotizaciones.filter(c => c.id !== id);
        localStorage.setItem('cotizaciones', JSON.stringify(nuevasCotizaciones));
        if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
          ToySoftFirebase.persistirDatosDebounced();
        }
        actualizarTablaCotizaciones();
    }
}

function limpiarFormularioCotizacion() {
    cotizacionActual = null;
    document.getElementById('clienteCotizacion').value = '';
    document.getElementById('fechaCotizacion').value = obtenerFechaLocalISO();
    document.getElementById('tablaItemsCotizacion').innerHTML = '';
    document.getElementById('totalCotizacion').textContent = formatearPrecio(0);
}

function buscarProductosCotizacion() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const categoria = document.getElementById('categoriaProducto').value;
    
    let resultados = productos;
    
    if (busqueda) {
        resultados = resultados.filter(p => 
            p.nombre.toLowerCase().includes(busqueda) ||
            p.categoria.toLowerCase().includes(busqueda)
        );
    }
    
    if (categoria) {
        resultados = resultados.filter(p => p.categoria === categoria);
    }
    
    const resultadosDiv = document.getElementById('resultadosBusqueda');
    resultadosDiv.innerHTML = '';
    
    if (resultados.length === 0) {
        resultadosDiv.innerHTML = '<p class="text-muted">No se encontraron productos</p>';
        return;
    }
    
    resultados.forEach(producto => {
        const div = document.createElement('div');
        div.className = 'resultado-busqueda';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${producto.nombre}</strong>
                    <br>
                    <small class="text-muted">${producto.categoria}</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="seleccionarProducto(${producto.id})">
                    Seleccionar
                </button>
            </div>
        `;
        resultadosDiv.appendChild(div);
    });
}

function seleccionarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('buscarProducto').value = producto.nombre;
    document.getElementById('precioItem').value = producto.precio;
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function actualizarTablaItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla || !cotizacionActual) return;

    tabla.innerHTML = '';
    
    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarRecursosModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;

    // Remover event listeners
    const newModalElement = modalElement.cloneNode(true);
    modalElement.parentNode.replaceChild(newModalElement, modalElement);

    // Limpiar contenido si es necesario
    if (modalId === 'modalNuevaCotizacion') {
        limpiarFormularioCotizacion();
    }
}

// Funciones para Cotizaciones
function actualizarTotalCotizacion() {
  const total = window.itemsCotizacion.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const totalElement = document.getElementById('totalCotizacion');
  if (totalElement) {
    totalElement.textContent = formatearPrecio(total);
  }
}

function agregarItemCotizacion() {
  try {
    const producto = document.getElementById('productoManual').style.display === 'none' 
      ? document.getElementById('buscarProducto').value
      : document.getElementById('productoManual').value;
    const cantidad = parseInt(document.getElementById('cantidadItem').value) || 1;
    const precio = parseFloat(document.getElementById('precioItem').value) || 0;

    if (!producto) {
      alert('Por favor, seleccione o escriba un producto');
      return;
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (precio <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }

    const item = {
      id: Date.now(),
      producto: producto,
      cantidad: cantidad,
      precio: precio,
      subtotal: cantidad * precio
    };

    // Agregar el item al array global
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    window.itemsCotizacion.push(item);
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();

    // Limpiar campos
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('cantidadItem').value = '1';
    document.getElementById('precioItem').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';

    // Volver a mostrar la lista de productos disponibles
    if (typeof filtrarProductosCotizacion === 'function') {
      filtrarProductosCotizacion();
    } else if (typeof buscarProductosCotizacion === 'function') {
      buscarProductosCotizacion();
    }
  } catch (error) {
    console.error('Error al agregar item:', error);
    alert('Error al agregar el item a la cotización');
  }
}

function mostrarItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizacionActual || !cotizacionActual.items || cotizacionActual.items.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="text-center">No hay items en la cotización</td></tr>';
        return;
    }

    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    // Actualizar total
    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarFormularioItem() {
    document.getElementById('cantidadItem').value = '';
    document.getElementById('precioItem').value = '';
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function eliminarItemCotizacion(id) {
    if (!cotizacionActual) return;
    
    cotizacionActual.items = cotizacionActual.items.filter(item => item.id !== id);
    cotizacionActual.total = cotizacionActual.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    actualizarTablaItemsCotizacion();
}

function guardarCotizacion() {
    try {
        const clienteId = document.getElementById('clienteCotizacion').value;
        const fecha = document.getElementById('fechaCotizacion').value;

        if (!clienteId) {
            alert('Por favor, seleccione un cliente');
            return;
        }

        if (!fecha) {
            alert('Por favor, seleccione una fecha');
            return;
        }

        if (window.itemsCotizacion.length === 0) {
            alert('Por favor, agregue al menos un item a la cotización');
            return;
        }

        const cotizacion = {
            id: Date.now(),
            fecha: fecha,
            clienteId: clienteId,
            items: window.itemsCotizacion,
            total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
        };

        // Guardar en localStorage
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        cotizaciones.push(cotizacion);
        localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));
        if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
          ToySoftFirebase.persistirDatosDebounced();
        }

        // Cerrar modal y limpiar
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
        modal.hide();
        window.itemsCotizacion = [];
        actualizarTablaCotizaciones();

        alert('Cotización guardada exitosamente');
    } catch (error) {
        console.error('Error al guardar cotización:', error);
        alert('Error al guardar la cotización');
    }
}

function mostrarCotizaciones() {
    const tabla = document.getElementById('tablaCotizaciones');
    if (!tabla) return;

    tabla.innerHTML = '';
    
    if (!cotizaciones || cotizaciones.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center">No hay cotizaciones</td></tr>';
        return;
    }

    cotizaciones.forEach(cotizacion => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${formatearFecha(cotizacion.fecha)}</td>
            <td>${cotizacion.cliente.nombre}</td>
            <td>${cotizacion.items.length} items</td>
            <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="verCotizacion(${cotizacion.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

function verCotizacion(id) {
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    const cotizacion = cotizaciones.find(c => c.id === id);
    
    if (!cotizacion) {
        alert('Cotización no encontrada');
        return;
    }

    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    
    // Mostrar detalles en el modal
    document.getElementById('fechaCotizacionVer').textContent = formatearFecha(cotizacion.fecha);
    document.getElementById('clienteCotizacionVer').textContent = cliente ? cliente.nombre : 'Cliente no encontrado';
    
    const tbody = document.getElementById('tablaItemsCotizacionVer');
    tbody.innerHTML = '';
    cotizacion.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.producto}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('totalCotizacionVer').textContent = formatearPrecio(cotizacion.total);
    
    const modal = new bootstrap.Modal(document.getElementById('modalVerCotizacion'));
    modal.show();
}

function eliminarCotizacion(id) {
    if (confirm('¿Está seguro de eliminar esta cotización?')) {
        const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
        const nuevasCotizaciones = cotizaciones.filter(c => c.id !== id);
        localStorage.setItem('cotizaciones', JSON.stringify(nuevasCotizaciones));
        if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
          ToySoftFirebase.persistirDatosDebounced();
        }
        actualizarTablaCotizaciones();
    }
}

function limpiarFormularioCotizacion() {
    cotizacionActual = null;
    document.getElementById('clienteCotizacion').value = '';
    document.getElementById('fechaCotizacion').value = obtenerFechaLocalISO();
    document.getElementById('tablaItemsCotizacion').innerHTML = '';
    document.getElementById('totalCotizacion').textContent = formatearPrecio(0);
}

function buscarProductosCotizacion() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const categoria = document.getElementById('categoriaProducto').value;
    
    let resultados = productos;
    
    if (busqueda) {
        resultados = resultados.filter(p => 
            p.nombre.toLowerCase().includes(busqueda) ||
            p.categoria.toLowerCase().includes(busqueda)
        );
    }
    
    if (categoria) {
        resultados = resultados.filter(p => p.categoria === categoria);
    }
    
    const resultadosDiv = document.getElementById('resultadosBusqueda');
    resultadosDiv.innerHTML = '';
    
    if (resultados.length === 0) {
        resultadosDiv.innerHTML = '<p class="text-muted">No se encontraron productos</p>';
        return;
    }
    
    resultados.forEach(producto => {
        const div = document.createElement('div');
        div.className = 'resultado-busqueda';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${producto.nombre}</strong>
                    <br>
                    <small class="text-muted">${producto.categoria}</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="seleccionarProducto(${producto.id})">
                    Seleccionar
                </button>
            </div>
        `;
        resultadosDiv.appendChild(div);
    });
}

function seleccionarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('buscarProducto').value = producto.nombre;
    document.getElementById('precioItem').value = producto.precio;
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

function actualizarTablaItemsCotizacion() {
    const tabla = document.getElementById('tablaItemsCotizacion');
    if (!tabla || !cotizacionActual) return;

    tabla.innerHTML = '';
    
    cotizacionActual.items.forEach(item => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    const totalElement = document.getElementById('totalCotizacion');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(cotizacionActual.total);
    }
}

function limpiarRecursosModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;

    // Remover event listeners
    const newModalElement = modalElement.cloneNode(true);
    modalElement.parentNode.replaceChild(newModalElement, modalElement);

    // Limpiar contenido si es necesario
    if (modalId === 'modalNuevaCotizacion') {
        limpiarFormularioCotizacion();
    }
}

// Funciones para Cotizaciones
function actualizarTotalCotizacion() {
  const total = window.itemsCotizacion.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const totalElement = document.getElementById('totalCotizacion');
  if (totalElement) {
    totalElement.textContent = formatearPrecio(total);
  }
}

function agregarItemCotizacion() {
  try {
    const producto = document.getElementById('productoManual').style.display === 'none' 
      ? document.getElementById('buscarProducto').value
      : document.getElementById('productoManual').value;
    const cantidad = parseInt(document.getElementById('cantidadItem').value) || 1;
    const precio = parseFloat(document.getElementById('precioItem').value) || 0;

    if (!producto) {
      alert('Por favor, seleccione o escriba un producto');
      return;
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (precio <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }

    const item = {
      id: Date.now(),
      producto: producto,
      cantidad: cantidad,
      precio: precio,
      subtotal: cantidad * precio
    };

    // Agregar el item al array global
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }
    window.itemsCotizacion.push(item);
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();

    // Limpiar campos
    document.getElementById('buscarProducto').value = '';
    document.getElementById('productoManual').value = '';
    document.getElementById('cantidadItem').value = '1';
    document.getElementById('precioItem').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';

    // Volver a mostrar la lista de productos disponibles
    if (typeof filtrarProductosCotizacion === 'function') {
      filtrarProductosCotizacion();
    } else if (typeof buscarProductosCotizacion === 'function') {
      buscarProductosCotizacion();
    }
  } catch (error) {
    console.error('Error al agregar item:', error);
    alert('Error al agregar el item a la cotización');
  }
}

function actualizarTablaItemsCotizacion() {
  const tbody = document.getElementById('itemsCotizacion');
  if (!tbody) return;

  tbody.innerHTML = '';
  window.itemsCotizacion.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
      <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="eliminarItemCotizacion(${item.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function eliminarItemCotizacion(id) {
  window.itemsCotizacion = window.itemsCotizacion.filter(item => item.id !== id);
  actualizarTablaItemsCotizacion();
  actualizarTotalCotizacion();
}

function guardarCotizacion() {
  try {
    const clienteId = document.getElementById('clienteCotizacion').value;
    const fecha = document.getElementById('fechaCotizacion').value;

    if (!clienteId) {
      alert('Por favor, seleccione un cliente');
      return;
    }

    if (!fecha) {
      alert('Por favor, seleccione una fecha');
      return;
    }

    if (window.itemsCotizacion.length === 0) {
      alert('Por favor, agregue al menos un item a la cotización');
      return;
    }

    const cotizacion = {
      id: Date.now(),
      fecha: fecha,
      clienteId: clienteId,
      items: window.itemsCotizacion,
      total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
    };

    // Guardar en localStorage
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    cotizaciones.push(cotizacion);
    localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));
    if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
      ToySoftFirebase.persistirDatosDebounced();
    }

    // Cerrar modal y limpiar
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
    modal.hide();
    window.itemsCotizacion = [];
    actualizarTablaCotizaciones();

    alert('Cotización guardada exitosamente');
  } catch (error) {
    console.error('Error al guardar cotización:', error);
    alert('Error al guardar la cotización');
  }
}

function actualizarTablaCotizaciones() {
  const tbody = document.getElementById('tablaCotizaciones');
  if (!tbody) return;

  let cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];

  // Ordenar de más reciente a más antigua (por fecha y luego por id)
  cotizaciones = cotizaciones.sort((a, b) => {
    const fechaA = new Date(a.fecha);
    const fechaB = new Date(b.fecha);
    if (fechaA.getTime() === fechaB.getTime()) {
      return b.id - a.id; // Si la fecha es igual, ordenar por id (timestamp)
    }
    return fechaB - fechaA;
  });

  tbody.innerHTML = '';
  cotizaciones.forEach(cotizacion => {
    const cliente = clientes.find(c => String(c.id) === String(cotizacion.clienteId));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="radio" name="cotizacionSeleccionada" value="${cotizacion.id}"></td>
      <td>${formatearFecha(cotizacion.fecha)}</td>
      <td>${cliente ? cliente.nombre : 'Cliente no encontrado'}</td>
      <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarCotizacion(${cotizacion.id})">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function verCotizacion(id) {
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  const cotizacion = cotizaciones.find(c => c.id === id);
  
  if (!cotizacion) {
    alert('Cotización no encontrada');
    return;
  }

  const cliente = clientes.find(c => c.id === cotizacion.clienteId);
  
  // Mostrar detalles en el modal
  document.getElementById('fechaCotizacionVer').textContent = formatearFecha(cotizacion.fecha);
  document.getElementById('clienteCotizacionVer').textContent = cliente ? cliente.nombre : 'Cliente no encontrado';
  
  const tbody = document.getElementById('tablaItemsCotizacionVer');
  tbody.innerHTML = '';
  cotizacion.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td style="text-align:right;">${formatearPrecio(item.precio)}</td>
      <td style="text-align:right;">${formatearPrecio(item.subtotal)}</td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById('totalCotizacionVer').textContent = formatearPrecio(cotizacion.total);
  
  const modal = new bootstrap.Modal(document.getElementById('modalVerCotizacion'));
  modal.show();
}

function eliminarCotizacion(id) {
  if (confirm('¿Está seguro de eliminar esta cotización?')) {
    const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    const nuevasCotizaciones = cotizaciones.filter(c => c.id !== id);
    localStorage.setItem('cotizaciones', JSON.stringify(nuevasCotizaciones));
    if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
      ToySoftFirebase.persistirDatosDebounced();
    }
    actualizarTablaCotizaciones();
  }
}

function buscarCotizaciones() {
  const busqueda = document.getElementById('buscarCotizacion').value.toLowerCase();
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  
  const cotizacionesFiltradas = cotizaciones.filter(cotizacion => {
    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    return (
      (cliente && cliente.nombre.toLowerCase().includes(busqueda)) ||
      cotizacion.fecha.includes(busqueda)
    );
  });

  const tbody = document.getElementById('tablaCotizaciones');
  tbody.innerHTML = '';
  
  cotizacionesFiltradas.forEach(cotizacion => {
    const cliente = clientes.find(c => c.id === cotizacion.clienteId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatearFecha(cotizacion.fecha)}</td>
      <td>${cliente ? cliente.nombre : 'Cliente no encontrado'}</td>
      <td style="text-align:right;">${formatearPrecio(cotizacion.total)}</td>
      <td>
        <button class="btn btn-info btn-sm" onclick="verCotizacion(${cotizacion.id})">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-primary btn-sm" onclick="editarCotizacion(${cotizacion.id})">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Funciones para manejar productos en cotizaciones
function filtrarProductosCotizacion() {
  // Ya no se filtra por categoría
  const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
  
  // Obtener todos los productos
  const productos = JSON.parse(localStorage.getItem('productos')) || [];
  
  // Filtrar solo por búsqueda
  window.productosFiltrados = productos.filter(producto => {
    return !busqueda || producto.nombre.toLowerCase().includes(busqueda);
  });

  mostrarResultadosBusqueda();
}

function mostrarResultadosBusqueda() {
  const resultadosDiv = document.getElementById('resultadosBusqueda');
  if (!resultadosDiv) return;

  resultadosDiv.innerHTML = '';
  
  if (window.productosFiltrados.length === 0) {
    resultadosDiv.style.display = 'none';
    return;
  }

  window.productosFiltrados.forEach(producto => {
    const div = document.createElement('div');
    div.className = 'list-group-item list-group-item-action bg-dark text-white border-light';
    div.style.cursor = 'pointer';
    div.textContent = producto.nombre;
    div.onclick = () => seleccionarProducto(producto);
    resultadosDiv.appendChild(div);
  });

  resultadosDiv.style.display = 'block';
}

function seleccionarProducto(producto) {
  document.getElementById('buscarProducto').value = producto.nombre;
  document.getElementById('precioItem').value = producto.precio;
  document.getElementById('resultadosBusqueda').style.display = 'none';
}

function toggleProductoManual() {
  const productoManual = document.getElementById('productoManual');
  const buscarProducto = document.getElementById('buscarProducto');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');

  if (productoManual.style.display === 'none') {
    productoManual.style.display = 'block';
    buscarProducto.style.display = 'none';
    resultadosBusqueda.style.display = 'none';
    productoManual.focus();
  } else {
    productoManual.style.display = 'none';
    buscarProducto.style.display = 'block';
    productoManual.value = '';
  }
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '';

    // Si es una cadena con formato YYYY-MM-DD sin hora, formatear manualmente
    if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        const [anio, mes, dia] = fechaStr.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    // Para otros formatos construiremos la fecha forzando hora local 00:00 si no la trae
    const fecha = typeof fechaStr === 'string'
        ? new Date(fechaStr.includes('T') ? fechaStr : `${fechaStr}T00:00:00`)
        : new Date(fechaStr);

    if (isNaN(fecha.getTime())) return fechaStr;

    const diaTxt = String(fecha.getDate()).padStart(2, '0');
    const mesTxt = String(fecha.getMonth() + 1).padStart(2, '0');
    const anioTxt = fecha.getFullYear();
    return `${diaTxt}/${mesTxt}/${anioTxt}`;
}

function imprimirCotizacion() {
  // Obtén los datos mostrados en el modal de ver cotización
  const fecha = document.getElementById('fechaCotizacionVer').textContent;
  const cliente = document.getElementById('clienteCotizacionVer').textContent;
  const items = Array.from(document.querySelectorAll('#tablaItemsCotizacionVer tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      producto: tds[0]?.textContent || '',
      cantidad: tds[1]?.textContent || '',
      precio: tds[2]?.textContent || '',
      subtotal: tds[3]?.textContent || ''
    };
  });
  const total = document.getElementById('totalCotizacionVer').textContent;

  // Logo (ajusta la ruta si es necesario)
  const logo = './image/logo-ToySoft.png';

  // Crea el HTML para imprimir
  let html = `
    <div style="font-family: Arial; width: 300px;">
      <div style="text-align:center; margin-bottom:10px;">
        <img src="${logo}" alt="Logo" style="max-width:90px; max-height:90px; margin-bottom:5px;">
        <h2 style="margin:0; font-size:1.2em;">Cotización</h2>
      </div>
      <div><strong>Fecha:</strong> ${fecha}</div>
      <div><strong>Cliente:</strong> ${cliente}</div>
      <hr>
      <table style="width:100%; font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;">Producto</th>
            <th>Cant</th>
            <th>Precio</th>
            <th>Subt.</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.producto}</td>
              <td style="text-align:center;">${item.cantidad}</td>
              <td style="text-align:right;">${formatearNumero(item.precio)}</td>
              <td style="text-align:right;">${formatearNumero(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <hr>
      <div style="text-align:right; font-size:16px;"><strong>Total: ${total}</strong></div>
    </div>
  `;

  // Abre una ventana nueva y manda a imprimir
  const win = window.open('', 'Imprimir Cotización', 'width=350,height=600');
  win.document.write(`<html><head><title>Imprimir Cotización</title></head><body onload="window.print();window.close();">${html}</body></html>`);
  win.document.close();
}

function obtenerVentanaImpresionCotizacion() {
  const ventana = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!ventana) return null;
  ventana.document.open();
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cotización</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: monospace; font-size: 14px; width: 57mm; margin: 0; padding: 1mm; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .mb-1 { margin-bottom: 0.5mm; }
          .mt-1 { margin-top: 0.5mm; }
          table { width: 100%; border-collapse: collapse; margin: 1mm 0; font-size: 14px; }
          th, td { padding: 0.5mm; text-align: left; font-size: 14px; }
          .border-top { border-top: 1px dashed #000; margin-top: 1mm; padding-top: 1mm; }
          .header { border-bottom: 1px dashed #000; padding-bottom: 1mm; margin-bottom: 1mm; }
          .total-row { font-weight: bold; font-size: 16px; }
          .botones-impresion { position: fixed; top: 10px; right: 10px; z-index: 1000; background: #fff; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
          .botones-impresion button { margin: 0 5px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
          .botones-impresion button:hover { background: #0056b3; }
          .logo-container { text-align: center; margin-bottom: 2mm; }
          .logo-container img { max-width: 100%; max-height: 120px; }
          @media print { .botones-impresion { display: none; } @page { margin: 0; size: 57mm auto; } body { width: 57mm; } }
        </style>
      </head>
      <body>
        <div class="botones-impresion">
          <button onclick="window.print()">Imprimir</button>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <div id="contenidoCotizacion"></div>
      </body>
    </html>
  `);
  return ventana;
}

function imprimirCotizacionSeleccionada() {
  const seleccionada = document.querySelector('input[name="cotizacionSeleccionada"]:checked');
  if (!seleccionada) {
    alert('Por favor, seleccione una cotización para imprimir.');
    return;
  }
  const id = seleccionada.value;
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  const cotizacion = cotizaciones.find(c => c.id == id);
  if (!cotizacion) {
    alert('Cotización no encontrada.');
    return;
  }
  // Forzar coincidencia de tipos y log para depuración
  const cliente = clientes.find(c => String(c.id) === String(cotizacion.clienteId));
  if (!cliente) {
    console.warn('Cliente no encontrado. ID buscado:', cotizacion.clienteId, 'Lista de clientes:', clientes.map(c=>c.id));
  }

  // Armamos el HTML directamente desde los datos
  const fecha = formatearFecha(cotizacion.fecha);
  const nombreCliente = cliente ? cliente.nombre : 'Cliente no encontrado';
  const telefonoCliente = cliente && cliente.telefono ? cliente.telefono : '';
  const direccionCliente = cliente && cliente.direccion ? cliente.direccion : '';
  const emailCliente = cliente && cliente.email ? cliente.email : '';
  const items = cotizacion.items;
  const total = formatearPrecio(cotizacion.total);

  const logo = localStorage.getItem('logoNegocio');
  let html = '';
  if (logo) {
    html += `<div class="logo-container"><img src="${logo}" alt="Logo"></div>`;
  }
  html += `
    <div class="header text-center">
      <h2 style="margin: 0; font-size: 14px;">COTIZACIÓN</h2>
      <div class="mb-1">${fecha}</div>
    </div>
    <div class="border-top">
      <div class="mb-1"><strong>Cliente:</strong> <span>${nombreCliente}</span></div>
      ${telefonoCliente ? `<div class='mb-1'><strong>Teléfono:</strong> <span>${telefonoCliente}</span></div>` : ''}
      ${direccionCliente ? `<div class='mb-1'><strong>Dirección:</strong> <span>${direccionCliente}</span></div>` : ''}
      ${emailCliente ? `<div class='mb-1'><strong>Email:</strong> <span>${emailCliente}</span></div>` : ''}
    </div>
    <table style="width:100%; font-size:13px; border-collapse:collapse; margin-top:8px;">
      <thead>
        <tr>
          <th style="text-align:left;">Producto</th>
          <th style="text-align:center; width: 12%;">Cant</th>
          <th style="text-align:right; width: 22%;">Precio</th>
          <th style="text-align:right; width: 22%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.producto}</td>
            <td style="text-align:center;">${item.cantidad}</td>
            <td style="text-align:right;">${formatearNumero(item.precio)}</td>
            <td style="text-align:right;">${formatearNumero(item.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="border-top" style="margin-top:8px;">
      <div class="mb-1 total-row" style="text-align:right;"><strong>Total: ${total}</strong></div>
    </div>
    <div class="text-center mt-1">
      <div class="border-top">¡Gracias por su preferencia!</div>
      <div class="border-top">ToySoft POS</div>
    </div>
  `;

  const ventana = obtenerVentanaImpresionCotizacion();
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Por favor, verifique que los bloqueadores de ventanas emergentes estén desactivados.');
    return;
  }
  setTimeout(() => {
    const contenidoDiv = ventana.document.getElementById('contenidoCotizacion');
    if (contenidoDiv) {
      contenidoDiv.innerHTML = html;
      ventana.focus();
    }
  }, 100);
}

function editarCotizacion(id) {
  const cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
  const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
  const cotizacion = cotizaciones.find(c => c.id == id);
  if (!cotizacion) {
    alert('Cotización no encontrada.');
    return;
  }
  cotizacionEditandoId = id;

  // Abrir el modal de nueva cotización
  mostrarModalNuevaCotizacion();

  // Cargar datos en el formulario
  setTimeout(() => {
    document.getElementById('clienteCotizacion').value = cotizacion.clienteId;
    document.getElementById('fechaCotizacion').value = cotizacion.fecha;
    window.itemsCotizacion = cotizacion.items.map(item => ({ ...item }));
    actualizarTablaItemsCotizacion();
    actualizarTotalCotizacion();
  }, 300);
}

// Modificar guardarCotizacion para actualizar si se está editando
const guardarCotizacionOriginal = guardarCotizacion;
guardarCotizacion = function() {
  try {
    const clienteId = document.getElementById('clienteCotizacion').value;
    const fecha = document.getElementById('fechaCotizacion').value;

    if (!clienteId) {
      alert('Por favor, seleccione un cliente');
      return;
    }

    if (!fecha) {
      alert('Por favor, seleccione una fecha');
      return;
    }

    if (window.itemsCotizacion.length === 0) {
      alert('Por favor, agregue al menos un item a la cotización');
      return;
    }

    let cotizaciones = JSON.parse(localStorage.getItem('cotizaciones')) || [];
    if (cotizacionEditandoId) {
      // Editar cotización existente
      cotizaciones = cotizaciones.map(c =>
        c.id == cotizacionEditandoId
          ? {
              ...c,
              fecha: fecha,
              clienteId: clienteId,
              items: window.itemsCotizacion,
              total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
            }
          : c
      );
    } else {
      // Nueva cotización
      const cotizacion = {
        id: Date.now(),
        fecha: fecha,
        clienteId: clienteId,
        items: window.itemsCotizacion,
        total: window.itemsCotizacion.reduce((sum, item) => sum + item.subtotal, 0)
      };
      cotizaciones.push(cotizacion);
    }
    localStorage.setItem('cotizaciones', JSON.stringify(cotizaciones));
    if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
      ToySoftFirebase.persistirDatosDebounced();
    }

    // Cerrar modal y limpiar
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevaCotizacion'));
    modal.hide();
    window.itemsCotizacion = [];
    cotizacionEditandoId = null;
    actualizarTablaCotizaciones();

    alert('Cotización guardada exitosamente');
  } catch (error) {
    console.error('Error al guardar cotización:', error);
    alert('Error al guardar la cotización');
  }
}

function fechaDesdeInputDate(valor) {
  if (!valor) return null;
  const partes = String(valor).split('-').map(Number);
  if (partes.length < 3 || !partes[0] || !partes[1] || !partes[2]) return null;
  const d = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function fechaEnPeriodoBalance(fechaValor, tipoBalance, fechaSeleccionada, inicioPeriodoStr, finPeriodoStr) {
  const fecha = parseFechaSeguro(fechaValor);
  if (!fecha) return false;
  if (tipoBalance === 'diario') {
    const { inicio, fin } = inicioFinDiaLaboral(fechaSeleccionada);
    const t = fecha.getTime();
    return t >= inicio.getTime() && t < fin.getTime();
  }
  const laboral = fechaLaboralDe(fecha) || fecha;
  const iso = fechaLocalISO(laboral);
  if (!iso) return false;
  return iso >= inicioPeriodoStr && iso <= finPeriodoStr;
}

function refrescarBalanceSiAbierto() {
  const modal = document.getElementById('modalBalance');
  if (!modal || !modal.classList.contains('show')) return;
  if (!document.getElementById('tipoBalance') || !document.getElementById('fechaBalance')) return;
  try { generarBalance(); } catch (e) { /* ignore */ }
}

// Función para mostrar el modal de balance
function mostrarModalBalance() {
  try {
    aplicarEtiquetasHorarioOperacion();
    const fechaBalanceEl = document.getElementById('fechaBalance');
    if (fechaBalanceEl) {
      const hoy = typeof getFechaHoyParaCierre === 'function' ? getFechaHoyParaCierre() : new Date();
      fechaBalanceEl.value = fechaLocalISO(hoy);
    }
    // abrirModalEstatico ya hace .show(); no llamar modal.show() aparte
    abrirModalEstatico('modalBalance');
    generarBalance();
  } catch (error) {
    console.error('Error al mostrar modal de balance:', error);
    alert('Error al mostrar el balance');
  }
}

// Función para generar el balance
function generarBalance() {
  try {
    aplicarEtiquetasHorarioOperacion();
    const tipoEl = document.getElementById('tipoBalance');
    const fechaEl = document.getElementById('fechaBalance');
    if (!tipoEl || !fechaEl) return;
    const tipoBalance = tipoEl.value;
    const fechaInput = fechaEl.value;
    
    // Validar que haya una fecha seleccionada
    if (!fechaInput) {
      console.warn('No se ha seleccionado una fecha');
      return;
    }
    
    const fechaSeleccionada = fechaDesdeInputDate(fechaInput);
    if (!fechaSeleccionada) {
      console.error('Fecha inválida:', fechaInput);
      return;
    }
    
    const ventas = (typeof obtenerTodasLasVentas === 'function')
      ? obtenerTodasLasVentas()
      : (JSON.parse(localStorage.getItem('historialVentas')) || []);
    const gastos = typeof obtenerGastosCombinados === 'function'
      ? obtenerGastosCombinados()
      : (JSON.parse(localStorage.getItem('historialGastos')) || []);
    console.log('[BALANCE] Total gastos combinados:', gastos.length);
    let ventasFiltradas = [];
    let gastosFiltrados = [];
    let inicioPeriodoStr = '', finPeriodoStr = '';
    switch (tipoBalance) {
      case 'semanal': {
        const inicioSemana = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate() - fechaSeleccionada.getDay());
        const finSemana = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate() + 6);
        inicioPeriodoStr = fechaLocalISO(inicioSemana);
        finPeriodoStr = fechaLocalISO(finSemana);
        break;
      }
      case 'mensual': {
        inicioPeriodoStr = fechaLocalISO(new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1));
        finPeriodoStr = fechaLocalISO(new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth() + 1, 0));
        break;
      }
      case 'anual': {
        inicioPeriodoStr = fechaLocalISO(new Date(fechaSeleccionada.getFullYear(), 0, 1));
        finPeriodoStr = fechaLocalISO(new Date(fechaSeleccionada.getFullYear(), 11, 31));
        break;
      }
      default: {
        inicioPeriodoStr = fechaLocalISO(fechaSeleccionada);
        finPeriodoStr = inicioPeriodoStr;
      }
    }
    const predGastoPeriodo = (fechaValor) => fechaEnPeriodoBalance(fechaValor, tipoBalance, fechaSeleccionada, inicioPeriodoStr, finPeriodoStr);
    ventasFiltradas = ventas.filter(v => predGastoPeriodo(v && v.fecha));
    const impactoBalance = typeof construirImpactoGastos === 'function'
      ? construirImpactoGastos(gastos, predGastoPeriodo)
      : null;
    gastosFiltrados = impactoBalance
      ? (impactoBalance.enBalance || [])
      : gastos.filter(g => predGastoPeriodo(g.fecha) || (g.fechaPago && predGastoPeriodo(g.fechaPago)));
    // LOG de depuración
    console.log('--- DEPURACIÓN BALANCE ---');
    console.log('Tipo de balance:', tipoBalance);
    console.log('Rango de fechas:', inicioPeriodoStr, 'a', finPeriodoStr);
    console.log('Total ventas en historial:', ventas.length);
    console.log('Ventas filtradas:', ventasFiltradas.length);
    console.log('Gastos originales:', gastos.length);
    console.log('Gastos filtrados:', gastosFiltrados.length);
    const notaHorario = document.getElementById('notaHorarioLaboralBalance');
    if (notaHorario) {
      notaHorario.textContent = textoHorarioLaboral(fechaSeleccionada, tipoBalance);
    }
    // ... resto del código ...

    // Calcular totales por método de pago
    const totalesPorMetodo = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      credito: 0,
      mixto: 0
    };

    ventasFiltradas.forEach(venta => {
      const metodo = (venta.metodoPago || '').toLowerCase();
      const total = parseFloat(venta.total) || 0;
      
      if (metodo === 'mixto') {
        totalesPorMetodo.mixto += total;
        totalesPorMetodo.efectivo += parseFloat(venta.montoRecibido) || 0;
        totalesPorMetodo.transferencia += parseFloat(venta.montoTransferencia) || 0;
      } else {
        totalesPorMetodo[metodo] = (totalesPorMetodo[metodo] || 0) + total;
      }
    });

    // Actualizar tabla de ventas
    const resumenVentas = document.getElementById('resumenVentas');
    resumenVentas.innerHTML = '';
    
    Object.entries(totalesPorMetodo).forEach(([metodo, total]) => {
      if (total > 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${metodo.charAt(0).toUpperCase() + metodo.slice(1)}</td>
          <td style="text-align:right;">${total.toLocaleString()}</td>
        `;
        resumenVentas.appendChild(fila);
      }
    });

// Actualizar total de ventas
const totalVentas = ventasFiltradas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
document.getElementById('totalVentas').textContent = `$ ${totalVentas.toLocaleString()}`;

// Domicilios y domiciliarios
const totalesDomiciliariosBalance = {};
const totalDomiciliosBalance = ventasFiltradas.reduce((sum, v) => {
  const valorDom = parseFloat(v.valorDomicilio) || 0;
  if (valorDom > 0) {
    const nombre = (v.nombreDomiciliario || v.domiciliario || 'SIN NOMBRE').toString().trim() || 'SIN NOMBRE';
    totalesDomiciliariosBalance[nombre] = (totalesDomiciliariosBalance[nombre] || 0) + valorDom;
  }
  return sum + valorDom;
}, 0);
const resumenDomiciliarios = document.getElementById('resumenDomiciliarios');
if (resumenDomiciliarios) {
  resumenDomiciliarios.innerHTML = '';
  Object.entries(totalesDomiciliariosBalance).forEach(([nombre, monto]) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${nombre}</td>
      <td style="text-align:right;">$${monto.toLocaleString()}</td>
    `;
    resumenDomiciliarios.appendChild(fila);
  });
}
const elTotalDom = document.getElementById('totalDomiciliosBalance');
if (elTotalDom) elTotalDom.textContent = `$ ${totalDomiciliosBalance.toLocaleString()}`;

    const totalPropinasBalance = ventasFiltradas.reduce((sum, v) => sum + propinaMontoDeVenta(v), 0);
    const elTotalPropinas = document.getElementById('totalPropinasBalance');
    if (elTotalPropinas) elTotalPropinas.textContent = `$ ${totalPropinasBalance.toLocaleString()}`;

    const canalesBalance = resumirVentasPorCanalBalance(ventasFiltradas);
    const ordenCanales = ['mesa', 'domicilio', 'recoger', 'venta_rapida'];
    window._balanceCanales = canalesBalance;
    window._balanceCanalActivo = null;
    const resumenCanalBody = document.getElementById('resumenVentasPorCanal');
    const detalleCanal = document.getElementById('detalleProductosPorCanal');
    let totalCantidadCanal = 0;
    let totalMontoCanal = 0;
    if (resumenCanalBody) {
      resumenCanalBody.innerHTML = '';
      ordenCanales.forEach(clave => {
        const canal = canalesBalance[clave];
        totalCantidadCanal += canal.cantidadVentas;
        totalMontoCanal += canal.total;
        const fila = document.createElement('tr');
        fila.dataset.canal = clave;
        fila.setAttribute('role', 'button');
        fila.setAttribute('aria-expanded', 'false');
        fila.title = `Ver productos de ${canal.etiqueta}`;
        fila.innerHTML = `
          <td>
            <div class="canal-tipo-cell">
              <span class="canal-tipo-nombre"><i class="fas ${canal.icono}"></i>${canal.etiqueta}</span>
              <span class="canal-ver-detalle">
                <span class="canal-ver-label"><i class="fas fa-list-ul"></i> Ver productos</span>
                <span class="canal-ocultar-label"><i class="fas fa-chevron-up"></i> Ocultar</span>
              </span>
            </div>
          </td>
          <td class="text-end">${canal.cantidadVentas.toLocaleString()}</td>
          <td class="text-end">$ ${Math.round(canal.total).toLocaleString()}</td>
        `;
        fila.addEventListener('click', () => mostrarDetalleCanalBalance(clave));
        resumenCanalBody.appendChild(fila);
      });
    }
    const elCantCanal = document.getElementById('totalVentasPorCanalCantidad');
    const elMontoCanal = document.getElementById('totalVentasPorCanalMonto');
    if (elCantCanal) elCantCanal.textContent = totalCantidadCanal.toLocaleString();
    if (elMontoCanal) elMontoCanal.textContent = `$ ${Math.round(totalMontoCanal).toLocaleString()}`;
    if (detalleCanal) {
      detalleCanal.innerHTML = '';
    }

    const meserosBalance = resumirVentasPorMeseroBalance(ventasFiltradas);
    window._balanceMeseros = meserosBalance;
    window._balanceMeseroActivo = null;
    const resumenMeseroBody = document.getElementById('resumenVentasPorMesero');
    const detalleMesero = document.getElementById('detalleProductosPorMesero');
    let totalCantidadMesero = 0;
    let totalMontoMesero = 0;
    if (resumenMeseroBody) {
      resumenMeseroBody.innerHTML = '';
      const listaMeseros = listaMeserosBalanceOrdenada(meserosBalance);
      if (!listaMeseros.length) {
        const filaVacia = document.createElement('tr');
        filaVacia.innerHTML = '<td colspan="3" class="text-muted">Sin ventas en este periodo</td>';
        resumenMeseroBody.appendChild(filaVacia);
      }
      listaMeseros.forEach(mesero => {
        totalCantidadMesero += mesero.cantidadVentas;
        totalMontoMesero += mesero.total;
        const fila = document.createElement('tr');
        fila.dataset.mesero = mesero.clave;
        fila.setAttribute('role', 'button');
        fila.setAttribute('aria-expanded', 'false');
        fila.title = `Ver productos de ${mesero.nombre}`;
        fila.innerHTML = `
          <td>
            <div class="canal-tipo-cell">
              <span class="canal-tipo-nombre"><i class="fas ${mesero.icono}"></i>${mesero.nombre}</span>
              <span class="canal-ver-detalle">
                <span class="canal-ver-label"><i class="fas fa-list-ul"></i> Ver productos</span>
                <span class="canal-ocultar-label"><i class="fas fa-chevron-up"></i> Ocultar</span>
              </span>
            </div>
          </td>
          <td class="text-end">${mesero.cantidadVentas.toLocaleString()}</td>
          <td class="text-end">$ ${Math.round(mesero.total).toLocaleString()}</td>
        `;
        fila.addEventListener('click', () => mostrarDetalleMeseroBalance(mesero.clave));
        resumenMeseroBody.appendChild(fila);
      });
    }
    const elCantMesero = document.getElementById('totalVentasPorMeseroCantidad');
    const elMontoMesero = document.getElementById('totalVentasPorMeseroMonto');
    if (elCantMesero) elCantMesero.textContent = totalCantidadMesero.toLocaleString();
    if (elMontoMesero) elMontoMesero.textContent = `$ ${Math.round(totalMontoMesero).toLocaleString()}`;
    if (detalleMesero) detalleMesero.innerHTML = '';

// Actualizar tabla de gastos
const resumenGastos = document.getElementById('resumenGastos');
resumenGastos.innerHTML = '';

// 1) Detalle línea por línea
gastosFiltrados.forEach(gasto => {
  const fila = document.createElement('tr');
  const descripcion = gasto.descripcion || 'Sin descripción';
  const categoria = gasto.categoria || 'sin-categoria';
  const forma = typeof etiquetaFormaPagoGasto === 'function' ? etiquetaFormaPagoGasto(gasto) : '';
  fila.innerHTML = `
    <td>${descripcion} <small class="text-muted">(${categoria}${forma ? ` · ${forma}` : ''})</small></td>
    <td style="text-align:right;">$${(parseFloat(gasto.monto) || 0).toLocaleString()}</td>
  `;
  resumenGastos.appendChild(fila);
});

// 2) Totales por categoría
const totalesPorCategoria = {};
gastosFiltrados.forEach(gasto => {
  const categoria = (gasto.categoria || 'sin-categoria').toLowerCase();
  const monto = parseFloat(gasto.monto) || 0;
  totalesPorCategoria[categoria] = (totalesPorCategoria[categoria] || 0) + monto;
});

// Separador visual
if (Object.keys(totalesPorCategoria).length > 0) {
  const filaSeparador = document.createElement('tr');
  filaSeparador.innerHTML = `
    <td colspan="2" class="text-center" style="font-weight:bold; border-top: 2px solid #ccc;">
      Totales por categoría
    </td>
  `;
  resumenGastos.appendChild(filaSeparador);
}

Object.entries(totalesPorCategoria).forEach(([categoria, monto]) => {
  const filaCat = document.createElement('tr');
  filaCat.innerHTML = `
    <td><strong>${categoria}</strong></td>
    <td style="text-align:right;"><strong>$${monto.toLocaleString()}</strong></td>
  `;
  resumenGastos.appendChild(filaCat);
});

// Actualizar total de gastos (solo los que afectan el balance del periodo)
const totalGastos = impactoBalance
  ? (impactoBalance.totalGastosBalance || 0)
  : gastosFiltrados.reduce((sum, g) => {
  if (typeof gastoAfectaBalanceEnFecha === 'function') {
    return sum + (gastoAfectaBalanceEnFecha(g, predGastoPeriodo) ? (parseFloat(g.monto) || 0) : 0);
  }
  return sum + (parseFloat(g.monto) || 0);
}, 0);
document.getElementById('totalGastos').textContent = `$ ${totalGastos.toLocaleString()}`;

// Actualizar tabla de créditos pendientes
const creditosPendientes = document.getElementById('creditosPendientes');
creditosPendientes.innerHTML = '';

const creditosFiltrados = ventasFiltradas.filter(v => 
  (v.metodoPago || '').toLowerCase() === 'crédito' || 
  (v.metodoPago || '').toLowerCase() === 'credito'
);

creditosFiltrados.forEach(credito => {
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td>${credito.cliente || 'No especificado'}</td>
    <td>${credito.fecha}</td>
    <td style="text-align:right;">${(parseFloat(credito.total) || 0).toLocaleString()}</td>
  `;
  creditosPendientes.appendChild(fila);
});

    // Actualizar total de créditos
    const totalCreditos = creditosFiltrados.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
    document.getElementById('totalCreditos').textContent = `$ ${totalCreditos.toLocaleString()}`;

    const cierresPeriodo = cierresAdministrativosEnPeriodo(
      fechaSeleccionada,
      tipoBalance,
      inicioPeriodoStr,
      finPeriodoStr
    );
    const baseInicialPeriodo = baseInicialDeCierresPeriodo(cierresPeriodo);
    const ultimaBaseDejada = cierresPeriodo.length
      ? (parseFloat(cierresPeriodo[cierresPeriodo.length - 1].montoBaseCaja) || 0)
      : 0;

    const tbodyCierres = document.getElementById('resumenCierresBalance');
    if (tbodyCierres) {
      tbodyCierres.innerHTML = '';
      if (!cierresPeriodo.length) {
        const filaVacia = document.createElement('tr');
        filaVacia.innerHTML = '<td colspan="4" class="text-muted">No hay cierres administrativos en este periodo</td>';
        tbodyCierres.appendChild(filaVacia);
      } else {
        cierresPeriodo.forEach((cierre, idx) => {
          const baseEntro = cierre.baseCajaAnterior != null
            ? (parseFloat(cierre.baseCajaAnterior) || 0)
            : (idx === 0 ? baseInicialPeriodo : (parseFloat(cierresPeriodo[idx - 1].montoBaseCaja) || 0));
          const baseDejo = parseFloat(cierre.montoBaseCaja) || 0;
          const fila = document.createElement('tr');
          fila.innerHTML = `
            <td>${formatearFechaHoraCierreBalance(cierre)}</td>
            <td>${cierre.nombreCierre || '—'} → ${cierre.nombreRecibe || '—'}</td>
            <td class="text-end">$ ${Math.round(baseEntro).toLocaleString()}</td>
            <td class="text-end">$ ${Math.round(baseDejo).toLocaleString()}</td>
          `;
          tbodyCierres.appendChild(fila);
        });
      }
    }
    const elCantCierres = document.getElementById('cantidadCierresBalance');
    if (elCantCierres) elCantCierres.textContent = String(cierresPeriodo.length);
    const elBaseIni = document.getElementById('baseInicialBalance');
    if (elBaseIni) elBaseIni.textContent = `$ ${Math.round(baseInicialPeriodo).toLocaleString()}`;
    const elUltimaBase = document.getElementById('ultimaBaseBalance');
    if (elUltimaBase) elUltimaBase.textContent = `$ ${Math.round(ultimaBaseDejada).toLocaleString()}`;

    const resultadoPeriodo = totalVentas - totalPropinasBalance - totalGastos - totalCreditos - totalDomiciliosBalance;
    const balanceTotalNumero = resultadoPeriodo + ultimaBaseDejada;
    window._balanceResumen = {
      ventas: totalVentas,
      propinas: totalPropinasBalance,
      gastos: totalGastos,
      creditos: totalCreditos,
      domicilios: totalDomiciliosBalance,
      resultadoPeriodo,
      baseInicial: baseInicialPeriodo,
      ultimaBase: ultimaBaseDejada,
      cantidadCierres: cierresPeriodo.length,
      cierres: cierresPeriodo.map((cierre, idx) => ({
        etiqueta: formatearFechaHoraCierreBalance(cierre),
        entrega: cierre.nombreCierre || '—',
        recibe: cierre.nombreRecibe || '—',
        baseEntro: cierre.baseCajaAnterior != null
          ? (parseFloat(cierre.baseCajaAnterior) || 0)
          : (idx === 0 ? baseInicialPeriodo : (parseFloat(cierresPeriodo[idx - 1].montoBaseCaja) || 0)),
        baseDejo: parseFloat(cierre.montoBaseCaja) || 0
      })),
      balance: balanceTotalNumero
    };
    const setTextoBalance = (id, valor, restar) => {
      const el = document.getElementById(id);
      if (!el) return;
      const texto = `$ ${Math.round(valor).toLocaleString()}`;
      el.textContent = restar ? `- ${texto}` : texto;
    };
    setTextoBalance('balanceDesgloseVentas', totalVentas, false);
    setTextoBalance('balanceDesglosePropinas', totalPropinasBalance, true);
    setTextoBalance('balanceDesgloseGastos', totalGastos, true);
    setTextoBalance('balanceDesgloseCreditos', totalCreditos, true);
    setTextoBalance('balanceDesgloseDomicilios', totalDomiciliosBalance, true);
    setTextoBalance('balanceResultadoPeriodo', resultadoPeriodo, false);
    setTextoBalance('balanceDesgloseBase', ultimaBaseDejada, false);
    const elDesgloseBase = document.getElementById('balanceDesgloseBase');
    if (elDesgloseBase) elDesgloseBase.textContent = `+ $ ${Math.round(ultimaBaseDejada).toLocaleString()}`;
    const elBalanceTotal = document.getElementById('balanceTotalModal');
    if (elBalanceTotal) elBalanceTotal.textContent = `$ ${Math.round(balanceTotalNumero).toLocaleString()}`;

    // Ventas por producto (mismo periodo, no modifica el balance)
    const cuerpoVentasPorProducto = document.getElementById('cuerpoVentasPorProducto');
    if (cuerpoVentasPorProducto) {
      const porProducto = {};
      ventasFiltradas.forEach(venta => {
        (venta.items || []).forEach(item => {
          const clave = item.id != null ? String(item.id) : (item.nombre || 'sin nombre');
          porProducto[clave] = (porProducto[clave] || 0) + (item.cantidad || 0);
        });
      });
      const productos = JSON.parse(localStorage.getItem('productos') || '[]');
      const idANombre = {};
      productos.forEach(p => { idANombre[String(p.id)] = p.nombre || ''; });
      cuerpoVentasPorProducto.innerHTML = '';
      const entradas = Object.entries(porProducto).sort((a, b) => b[1] - a[1]);
      entradas.forEach(([clave, cantidad]) => {
        const nombre = idANombre[clave] || (isNaN(Number(clave)) ? clave : '');
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${nombre || clave}</td>
          <td class="text-end">${cantidad.toLocaleString()}</td>
        `;
        cuerpoVentasPorProducto.appendChild(fila);
      });
      if (entradas.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = '<td colspan="2" class="text-muted text-center">No hay ventas por producto en este periodo</td>';
        cuerpoVentasPorProducto.appendChild(fila);
      }
    }

    // Calcular utilidad por período
    calcularUtilidadPorPeriodo(ventasFiltradas);

  } catch (error) {
    console.error('Error al generar balance:', error);
    alert('Error al generar el balance');
  }
}

// Función para calcular utilidad por período
function calcularUtilidadPorPeriodo(ventasFiltradas) {
  try {
    const productos = JSON.parse(localStorage.getItem('productos') || '[]');
    
    // Crear mapa de productos por id y nombre para búsqueda rápida
    const productosMap = {};
    productos.forEach(p => {
      productosMap[String(p.id)] = p;
      productosMap[p.nombre.toLowerCase().trim()] = p;
    });

    // Calcular utilidad por producto
    const utilidadPorProducto = {};
    let totalUtilidad = 0;

    ventasFiltradas.forEach(venta => {
      const items = venta.items || venta.productos || [];
      items.forEach(item => {
        const productoId = item.id != null ? String(item.id) : null;
        const productoNombre = (item.nombre || '').toLowerCase().trim();
        const cantidad = item.cantidad || 0;
        const precioVenta = parseFloat(item.precio) || 0;

        // Buscar producto por id o nombre
        let producto = null;
        if (productoId && productosMap[productoId]) {
          producto = productosMap[productoId];
        } else if (productoNombre && productosMap[productoNombre]) {
          producto = productosMap[productoNombre];
        }

        // Solo calcular si el producto tiene costo definido
        if (producto && producto.costo != null && producto.costo !== undefined) {
          const costo = parseFloat(producto.costo) || 0;
          const utilidadUnitaria = precioVenta - costo;
          const utilidadTotal = utilidadUnitaria * cantidad;

          const clave = productoId || productoNombre;
          if (!utilidadPorProducto[clave]) {
            utilidadPorProducto[clave] = {
              nombre: producto.nombre,
              cantidadVendida: 0,
              precioVenta: precioVenta,
              costo: costo,
              utilidadUnitaria: utilidadUnitaria,
              utilidadTotal: 0
            };
          }

          utilidadPorProducto[clave].cantidadVendida += cantidad;
          utilidadPorProducto[clave].utilidadTotal += utilidadTotal;
          totalUtilidad += utilidadTotal;
        }
      });
    });

    // Mostrar utilidad en el balance
    mostrarUtilidadEnBalance(utilidadPorProducto, totalUtilidad);

  } catch (error) {
    console.error('Error al calcular utilidad:', error);
  }
}

// Función para mostrar utilidad en el balance
function mostrarUtilidadEnBalance(utilidadPorProducto, totalUtilidad) {
  const cuerpoUtilidadFinal = document.getElementById('cuerpoUtilidad');
  const totalUtilidadElement = document.getElementById('totalUtilidad');
  
  if (cuerpoUtilidadFinal) {
    cuerpoUtilidadFinal.innerHTML = '';
    
    const productosConUtilidad = Object.values(utilidadPorProducto).sort((a, b) => b.utilidadTotal - a.utilidadTotal);
    
    if (productosConUtilidad.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = '<td colspan="6" class="text-muted text-center">No hay productos con costo definido en este período</td>';
      cuerpoUtilidadFinal.appendChild(fila);
    } else {
      productosConUtilidad.forEach(producto => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${producto.nombre}</td>
          <td class="text-end">${producto.cantidadVendida.toLocaleString()}</td>
          <td class="text-end">$ ${producto.precioVenta.toLocaleString()}</td>
          <td class="text-end">$ ${producto.costo.toLocaleString()}</td>
          <td class="text-end text-success">$ ${producto.utilidadUnitaria.toLocaleString()}</td>
          <td class="text-end text-success"><strong>$ ${producto.utilidadTotal.toLocaleString()}</strong></td>
        `;
        cuerpoUtilidadFinal.appendChild(fila);
      });
    }
  }

  if (totalUtilidadElement) {
    totalUtilidadElement.textContent = `$ ${totalUtilidad.toLocaleString()}`;
  }
  
  // Guardar datos de utilidad para impresión y exportación
  window.utilidadActual = {
    productos: utilidadPorProducto,
    total: totalUtilidad,
    tipoPeriodo: document.getElementById('tipoBalance')?.value || 'diario',
    fecha: document.getElementById('fechaBalance')?.value || new Date().toISOString().split('T')[0]
  };
}

// Función para imprimir el balance
function imprimirBalance() {
  try {
    const tipoBalance = document.getElementById('tipoBalance').value;
    const fechaSeleccionada = fechaDesdeInputDate(document.getElementById('fechaBalance').value) || new Date();
    const ventana = window.open('', 'ImpresionBalance', 'width=400,height=600,scrollbars=yes');
    
    if (!ventana) {
      alert('Por favor, permite las ventanas emergentes para este sitio');
      return;
    }

    // Obtener los datos de las tablas
    const resumenVentas = document.getElementById('resumenVentas').innerHTML;
    const totalVentas = document.getElementById('totalVentas').textContent;
    const totalVentasPorCanalCantidad = document.getElementById('totalVentasPorCanalCantidad');
    const totalVentasPorCanalMonto = document.getElementById('totalVentasPorCanalMonto');
    const resumenVentasPorCanalHTML = htmlImpresionTotalesPorCanalBalance();
    const totalCanalCantidadTexto = totalVentasPorCanalCantidad ? totalVentasPorCanalCantidad.textContent : '0';
    const totalCanalMontoTexto = totalVentasPorCanalMonto ? totalVentasPorCanalMonto.textContent : '$ 0';
    const totalVentasPorMeseroCantidad = document.getElementById('totalVentasPorMeseroCantidad');
    const totalVentasPorMeseroMonto = document.getElementById('totalVentasPorMeseroMonto');
    const resumenVentasPorMeseroHTML = htmlImpresionTotalesPorMeseroBalance();
    const totalMeseroCantidadTexto = totalVentasPorMeseroCantidad ? totalVentasPorMeseroCantidad.textContent : '0';
    const totalMeseroMontoTexto = totalVentasPorMeseroMonto ? totalVentasPorMeseroMonto.textContent : '$ 0';
    const resumenDomiciliarios = document.getElementById('resumenDomiciliarios');
    const totalDomiciliosBalance = document.getElementById('totalDomiciliosBalance');
    const resumenDomiciliariosHTML = resumenDomiciliarios ? resumenDomiciliarios.innerHTML : '';
    const totalDomiciliosTexto = totalDomiciliosBalance ? totalDomiciliosBalance.textContent : '$ 0';
    const resumenGastos = document.getElementById('resumenGastos').innerHTML;
    const totalGastos = document.getElementById('totalGastos').textContent;
    const creditosPendientes = document.getElementById('creditosPendientes').innerHTML;
    const totalCreditos = document.getElementById('totalCreditos').textContent;

    const resumen = window._balanceResumen || {};
    const numeroVentas = resumen.ventas != null ? resumen.ventas : (parseInt(totalVentas.replace(/[^0-9]+/g, '')) || 0);
    const numeroPropinas = resumen.propinas != null ? resumen.propinas : 0;
    const numeroGastos = resumen.gastos != null ? resumen.gastos : (parseInt(totalGastos.replace(/[^0-9]+/g, '')) || 0);
    const numeroCreditos = resumen.creditos != null ? resumen.creditos : (parseInt(totalCreditos.replace(/[^0-9]+/g, '')) || 0);
    const numeroDomicilios = resumen.domicilios != null ? resumen.domicilios : (parseInt((totalDomiciliosTexto || '').replace(/[^0-9]+/g, '')) || 0);
    const numeroResultado = resumen.resultadoPeriodo != null
      ? resumen.resultadoPeriodo
      : (numeroVentas - numeroPropinas - numeroGastos - numeroCreditos - numeroDomicilios);
    const numeroUltimaBase = resumen.ultimaBase != null ? resumen.ultimaBase : 0;
    const numeroBaseInicial = resumen.baseInicial != null ? resumen.baseInicial : 0;
    const balanceTotalNumero = resumen.balance != null
      ? resumen.balance
      : (numeroResultado + numeroUltimaBase);
    const fmtBalance = n => `$ ${Math.round(n).toLocaleString('es-CO')}`;
    const totalVentasTexto = fmtBalance(numeroVentas);
    const totalPropinasTexto = fmtBalance(numeroPropinas);
    const totalGastosTexto = fmtBalance(numeroGastos);
    const totalCreditosTexto = fmtBalance(numeroCreditos);
    const costoDomiciliosTexto = fmtBalance(numeroDomicilios);
    const resultadoPeriodoTexto = fmtBalance(numeroResultado);
    const ultimaBaseTexto = fmtBalance(numeroUltimaBase);
    const baseInicialTexto = fmtBalance(numeroBaseInicial);
    const balanceTotalTexto = fmtBalance(balanceTotalNumero);
    const cierresPrint = Array.isArray(resumen.cierres) ? resumen.cierres : [];
    const htmlCierresPrint = cierresPrint.length
      ? cierresPrint.map(c => `
          <tr>
            <td>${c.etiqueta}</td>
            <td>${c.entrega} → ${c.recibe}</td>
            <td style="text-align:right;">$ ${Math.round(c.baseDejo || 0).toLocaleString()}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3">No hay cierres en este periodo</td></tr>';

    // Formatear la fecha según el tipo de balance
    let tituloPeriodo = '';
    switch (tipoBalance) {
      case 'diario':
        tituloPeriodo = `Día ${fechaSeleccionada.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        if (operaPasadaMedianoche()) {
          const { inicio, fin } = inicioFinDiaLaboral(fechaSeleccionada);
          tituloPeriodo += ` (${inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} a ${fin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})`;
        }
        break;
      case 'semanal':
        const inicioSemana = new Date(fechaSeleccionada);
        inicioSemana.setDate(fechaSeleccionada.getDate() - fechaSeleccionada.getDay());
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        tituloPeriodo = `Semana del ${inicioSemana.toLocaleDateString()} al ${finSemana.toLocaleDateString()}`;
        break;
      case 'mensual':
        tituloPeriodo = `Mes de ${fechaSeleccionada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        break;
      case 'anual':
        tituloPeriodo = `Año ${fechaSeleccionada.getFullYear()}`;
        break;
    }

    ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Balance</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: monospace; 
              font-size: 14px; 
              width: 57mm; 
              margin: 0; 
              padding: 1mm;
              background: white;
              color: black;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .mb-1 { margin-bottom: 0.5mm; }
            .mt-1 { margin-top: 0.5mm; }
            .border-top { border-top: 1px dashed #000; margin-top: 1mm; padding-top: 1mm; }
            .header { border-bottom: 1px dashed #000; padding-bottom: 1mm; margin-bottom: 1mm; }
            .total-row { font-weight: bold; font-size: 16px; }
            .botones-impresion { 
              position: fixed; 
              top: 10px; 
              right: 10px; 
              z-index: 1000; 
              background: #fff; 
              padding: 5px; 
              border-radius: 5px; 
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              display: flex;
              gap: 5px;
            }
            .botones-impresion button { 
              margin: 0; 
              padding: 5px 10px; 
              background: #007bff; 
              color: white; 
              border: none; 
              border-radius: 3px; 
              cursor: pointer;
              font-size: 12px;
            }
            .botones-impresion button:hover { background: #0056b3; }
            .contenido-balance {
              margin-top: 40px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 2mm;
              text-align: left;
            }
            th.text-end, td.text-end {
              text-align: right;
            }
            h6 {
              font-size: 12px;
              margin: 2mm 0 1mm 0;
            }
            .table-responsive {
              width: 100%;
            }
            @media print { 
              .botones-impresion { display: none; } 
              @page { margin: 0; size: 57mm auto; } 
              body { width: 57mm; } 
            }
          </style>
        </head>
        <body>
          <div class="botones-impresion">
            <button onclick="window.print()">Imprimir</button>
            <button onclick="window.close()">Cerrar</button>
          </div>

          <div class="contenido-balance">
            <div class="header text-center">
              <h2 style="margin: 0; font-size: 14px;">BALANCE</h2>
              <div class="mb-1">${tituloPeriodo}</div>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Resumen de Ventas</strong></div>
              <table>
                ${resumenVentas}
                <tfoot>
                  <tr>
                    <th>Total Ventas</th>
                    <th style="text-align:right;">${totalVentas}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Ventas por tipo</strong></div>
              <table>
                ${resumenVentasPorCanalHTML}
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th style="text-align:right;">${totalCanalCantidadTexto}</th>
                    <th style="text-align:right;">${totalCanalMontoTexto}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Ventas por mesero</strong></div>
              <table>
                ${resumenVentasPorMeseroHTML}
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th style="text-align:right;">${totalMeseroCantidadTexto}</th>
                    <th style="text-align:right;">${totalMeseroMontoTexto}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Domicilios y Domiciliarios</strong></div>
              <table>
                ${resumenDomiciliariosHTML}
                <tfoot>
                  <tr>
                    <th>Total Domicilios</th>
                    <th style="text-align:right;">${totalDomiciliosTexto}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Resumen de Gastos</strong></div>
              <table>
                ${resumenGastos}
                <tfoot>
                  <tr>
                    <th>Total Gastos</th>
                    <th style="text-align:right;">${totalGastos}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Créditos Pendientes</strong></div>
              <table>
                ${creditosPendientes}
                <tfoot>
                  <tr>
                    <th colspan="2">Total Créditos</th>
                    <th style="text-align:right;">${totalCreditos}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="border-top">
              <div class="mb-1"><strong>Bases de caja por cierre</strong></div>
              <div class="mb-1">No se suman si hay varios: queda la del último cierre.</div>
              <table>
                <thead>
                  <tr>
                    <th>Cierre</th>
                    <th>Entrega / Recibe</th>
                    <th style="text-align:right;">Base dejada</th>
                  </tr>
                </thead>
                <tbody>
                  ${htmlCierresPrint}
                </tbody>
              </table>
              <div class="mb-1">Base inicial: ${baseInicialTexto}</div>
              <div class="mb-1">Última base dejada: ${ultimaBaseTexto}</div>
            </div>

            <!-- Balance Total -->
            <div class="border-top total-row">
              <div class="mb-1 text-center"><strong>BALANCE TOTAL</strong></div>
              <table>
                <tr>
                  <td>Ventas</td>
                  <td style="text-align:right;">${totalVentasTexto}</td>
                </tr>
                <tr>
                  <td>Propinas</td>
                  <td style="text-align:right;">- ${totalPropinasTexto}</td>
                </tr>
                <tr>
                  <td>Gastos</td>
                  <td style="text-align:right;">- ${totalGastosTexto}</td>
                </tr>
                <tr>
                  <td>Créditos</td>
                  <td style="text-align:right;">- ${totalCreditosTexto}</td>
                </tr>
                <tr>
                  <td>Costo domicilios</td>
                  <td style="text-align:right;">- ${costoDomiciliosTexto}</td>
                </tr>
                <tr>
                  <td>Resultado del periodo</td>
                  <td style="text-align:right;">${resultadoPeriodoTexto}</td>
                </tr>
                <tr>
                  <td>Última base dejada</td>
                  <td style="text-align:right;">+ ${ultimaBaseTexto}</td>
                </tr>
                <tr>
                  <th>Balance total</th>
                  <th style="text-align:right;">${balanceTotalTexto}</th>
                </tr>
              </table>
            </div>

            <div class="text-center mt-1">
              <div class="border-top">¡Fin del Balance!</div>
              <div class="border-top">ToySoft POS</div>
            </div>
            
            <div class="border-top text-center mt-3">
              <div class="mb-1">Firma de Entrega: _________________</div>
              <div class="mb-1">Firma de Recibe: _________________</div>
            </div>
          </div>
        </body>
      </html>
    `);
    ventana.document.close();
  } catch (error) {
    console.error('Error al imprimir balance:', error);
    alert('Error al imprimir el balance: ' + error.message);
  }
}

// Función para mostrar el modal de nuevo cliente
function mostrarModalNuevoCliente() {
    // Ocultar el modal de cotización
    const modalCotizacion = document.getElementById('modalNuevaCotizacion');
    const bsModalCotizacion = bootstrap.Modal.getInstance(modalCotizacion);
    if (bsModalCotizacion) {
        bsModalCotizacion.hide();
    }

    // Limpiar el formulario de nuevo cliente
    document.getElementById('formNuevoCliente').reset();
    // Si existe el errorCliente, lo limpiamos
    const errorCliente = document.getElementById('errorCliente');
    if (errorCliente) errorCliente.textContent = '';

    // Mostrar el modal de nuevo cliente
    const modalNuevoCliente = document.getElementById('modalNuevoCliente');
    abrirModalEstatico(modalNuevoCliente);

    // Solo agregar el listener una vez
    if (!modalNuevoCliente.dataset.listenerAgregado) {
        modalNuevoCliente.addEventListener('hidden.bs.modal', function () {
            // Recargar el select de clientes
            if (typeof cargarClientesCotizacion === 'function') {
                cargarClientesCotizacion();
            }
            // Volver a mostrar el modal de cotización
            if (bsModalCotizacion) {
                bsModalCotizacion.show();
            }
        });
        modalNuevoCliente.dataset.listenerAgregado = 'true';
    }
}

function guardarNuevoCliente() {
    try {
        const form = document.getElementById('formNuevoCliente');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const cliente = {
            id: Date.now(),
            nombre: document.getElementById('nombreCliente').value.trim(),
            telefono: document.getElementById('telefonoCliente').value.trim(),
            direccion: document.getElementById('direccionCliente').value.trim(),
            email: document.getElementById('emailCliente').value.trim()
        };

        // Guardar en localStorage
        const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
        clientes.push(cliente);
        localStorage.setItem('clientes', JSON.stringify(clientes));
        if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
          ToySoftFirebase.persistirDatosDebounced();
        }

        // Actualizar select de clientes y seleccionar el nuevo
        if (typeof cargarClientesCotizacion === 'function') {
            cargarClientesCotizacion();
        }
        const selectCliente = document.getElementById('clienteCotizacion');
        if (selectCliente) selectCliente.value = cliente.id;

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoCliente'));
        modal.hide();

        alert('Cliente guardado exitosamente');
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        alert('Error al guardar el cliente');
    }
}

// Función para cargar categorías en el select
function cargarCategoriasCotizacion() {
  const categorias = JSON.parse(localStorage.getItem('categorias')) || [];
  const selectCategoria = document.getElementById('categoriaProducto');
  
  selectCategoria.innerHTML = '<option value="">Todas las categorías</option>';
  categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria;
    option.textContent = categoria;
    selectCategoria.appendChild(option);
  });
}

// Función para filtrar productos por categoría y búsqueda
function filtrarProductosCotizacion() {
  const categoria = document.getElementById('categoriaProducto').value;
  const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
  const productos = JSON.parse(localStorage.getItem('productos')) || [];
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  
  let productosFiltrados = productos;
  
  // Filtrar por categoría
  if (categoria) {
    productosFiltrados = productosFiltrados.filter(p => p.categoria === categoria);
  }
  
  // Filtrar por búsqueda
  if (busqueda) {
    productosFiltrados = productosFiltrados.filter(p => 
      p.nombre.toLowerCase().includes(busqueda)
    );
  }
  
  // Mostrar resultados
  resultadosBusqueda.innerHTML = '';
  if (productosFiltrados.length > 0) {
    resultadosBusqueda.style.display = 'block';
    productosFiltrados.forEach(producto => {
      const item = document.createElement('a');
      item.href = '#';
      item.className = 'list-group-item list-group-item-action bg-dark text-white';
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>${producto.nombre}</strong>
            <br>
            <small>${producto.categoria}</small>
          </div>
          <div>
            <span class="badge bg-primary">${formatearPrecio(producto.precio)}</span>
            <button class="btn btn-sm btn-outline-light ms-2" onclick="seleccionarProductoCotizacion(${producto.id})">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      `;
      resultadosBusqueda.appendChild(item);
    });
  } else {
    resultadosBusqueda.style.display = 'none';
  }
}

// Función para seleccionar un producto en la cotización
function seleccionarProductoCotizacion(id) {
  const productos = JSON.parse(localStorage.getItem('productos')) || [];
  const producto = productos.find(p => p.id === id);
  
  if (producto) {
    document.getElementById('buscarProducto').value = producto.nombre;
    document.getElementById('precioItem').value = producto.precio;
    document.getElementById('resultadosBusqueda').style.display = 'none';
  }
}

// Función para mostrar el modal de nueva cotización
function mostrarModalNuevaCotizacion() {
  try {
    // Verificar que el modal existe
    const modalElement = document.getElementById('modalNuevaCotizacion');
    if (!modalElement) {
      throw new Error('El modal de nueva cotización no existe en el DOM');
    }

    // Inicializar arrays si no existen
    if (!Array.isArray(window.itemsCotizacion)) {
      window.itemsCotizacion = [];
    }

    // Verificar y establecer fecha actual
    const fechaInput = document.getElementById('fechaCotizacion');
    if (!fechaInput) {
      throw new Error('El campo de fecha no existe');
    }
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().split('T')[0];

    // Verificar y cargar clientes
    const selectCliente = document.getElementById('clienteCotizacion');
    if (!selectCliente) {
      throw new Error('El selector de clientes no existe');
    }
    selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    clientes.forEach(cliente => {
      const option = document.createElement('option');
      option.value = cliente.id;
      option.textContent = cliente.nombre;
      selectCliente.appendChild(option);
    });

    // Cargar categorías
    cargarCategoriasCotizacion();

    // Limpiar campos de búsqueda y resultados
    const buscarProducto = document.getElementById('buscarProducto');
    if (buscarProducto) {
      buscarProducto.value = '';
    }
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    if (resultadosBusqueda) {
      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';
    }
    const productoManual = document.getElementById('productoManual');
    if (productoManual) {
      productoManual.value = '';
      productoManual.style.display = 'none';
    }

    // Limpiar tabla de items
    const tablaItems = document.getElementById('itemsCotizacion');
    if (!tablaItems) {
      throw new Error('La tabla de items no existe');
    }
    tablaItems.innerHTML = '';

    // Actualizar total
    actualizarTotalCotizacion();

    // Cerrar el modal de cotizaciones primero
    const modalCotizaciones = bootstrap.Modal.getInstance(document.getElementById('modalCotizaciones'));
    if (modalCotizaciones) {
      modalCotizaciones.hide();
    }

    // Mostrar el modal de nueva cotización
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    });
    modal.show();

    // Asegurar que el modal esté por encima
    modalElement.style.zIndex = '1060';
  } catch (error) {
    console.error('Error detallado:', error);
    alert(`Error al mostrar el formulario de nueva cotización: ${error.message}`);
  }
}

// Función para mostrar el modal de PIN
function mostrarModalPin(accion) {
  accionPendiente = accion;
  const pinInput = document.getElementById('pinAcceso');
  const mensajeError = document.getElementById('mensajeErrorPin');
  if (pinInput) pinInput.value = '';
  if (mensajeError) mensajeError.style.display = 'none';

  const titulos = {
    'cierre-administrativo': 'Acceso restringido — Cierre administrativo',
    balance: 'Acceso restringido — Balance',
    inventario: 'Acceso restringido — Inventario',
    historial: 'Acceso restringido — Historial',
    gastos: 'Acceso restringido — Gastos',
    'historial-admin': 'Acceso restringido — Cierres administrativos'
  };
  const tituloModal = document.getElementById('modalPinAccesoLabel');
  if (tituloModal) {
    tituloModal.dataset.tituloOriginal = titulos[accion] || 'Acceso restringido';
    tituloModal.textContent = tituloModal.dataset.tituloOriginal;
  }

  if (typeof prepararUiPin === 'function') {
    try { prepararUiPin(); } catch (e) { console.warn(e); }
  }
  const modalEl = document.getElementById('modalPinAcceso');
  if (modalEl) modalEl.style.zIndex = '2000';
  abrirModalEstatico('modalPinAcceso');
  setTimeout(function () {
    if (pinInput && typeof pinAccesoBloqueado === 'function' && !pinAccesoBloqueado()) {
      try { pinInput.focus(); } catch (e) {}
    }
  }, 250);
}

function ejecutarAccionTrasPin(accion) {
  if (accion === 'balance') {
    mostrarModalBalance();
  } else if (accion === 'inventario') {
    window.location.href = 'inventario.html';
  } else if (accion === 'cierre-administrativo') {
    mostrarModalCierreDiario();
  } else if (accion === 'historial') {
    localStorage.setItem('usuarioActual', 'historial');
    window.location.href = 'historial.html';
  } else if (accion === 'gastos') {
    window.location.href = 'gastos.html';
  } else if (accion === 'historial-admin') {
    const tabCierresAdmin = document.getElementById('cierres-admin-tab');
    if (tabCierresAdmin) {
      const tab = new bootstrap.Tab(tabCierresAdmin);
      tab.show();
    }
  }
}

async function verificarPinAcceso() {
  try {
    if (typeof pinAccesoBloqueado === 'function' && pinAccesoBloqueado()) {
      if (typeof prepararUiPin === 'function') prepararUiPin();
      return;
    }
    const pinInput = document.getElementById('pinAcceso');
    const pinIngresado = pinInput ? pinInput.value : '';
    const mensajeError = document.getElementById('mensajeErrorPin');
    const modulo = moduloPinDeAccion(accionPendiente);
    const ok = await pinModuloLocal(modulo, pinIngresado);
    if (!ok) {
      const n = typeof registrarPinFallido === 'function' ? registrarPinFallido() : 1;
      if (mensajeError) {
        mensajeError.textContent = typeof mensajeIntentoPin === 'function'
          ? mensajeIntentoPin(n)
          : 'PIN incorrecto. Intente nuevamente.';
        mensajeError.style.display = 'block';
      }
      if (pinInput) pinInput.value = '';
      if (navigator.vibrate) navigator.vibrate(n >= 3 ? [200, 80, 200, 80, 400] : 200);
      if (n >= 3) {
        alert(typeof avisoBloqueoPinTexto === 'function'
          ? avisoBloqueoPinTexto()
          : 'ÚLTIMO AVISO: el sistema se va a bloquear.');
        if (typeof prepararUiPin === 'function') prepararUiPin();
      }
      return;
    }
    if (typeof limpiarIntentosPin === 'function') limpiarIntentosPin();

    const accion = accionPendiente;
    const el = document.getElementById('modalPinAcceso');
    const modal = el && bootstrap.Modal.getInstance(el);
    const abreOtroModal = accion === 'balance' || accion === 'cierre-administrativo' || accion === 'historial-admin';
    const continuar = function () {
      ejecutarAccionTrasPin(accion);
    };
    accionPendiente = null;
    if (modal && abreOtroModal) {
      el.addEventListener('hidden.bs.modal', function handler() {
        el.removeEventListener('hidden.bs.modal', handler);
        continuar();
      });
      modal.hide();
      return;
    }
    if (modal) modal.hide();
    continuar();
  } catch (error) {
    console.error('Error al verificar el PIN', error);
    alert('No se pudo validar el PIN. Recarga la página e inténtalo de nuevo.');
  }
}

// Modificar el botón de balance en el HTML para usar el PIN
document.addEventListener('DOMContentLoaded', function() {
  const btnBalance = document.querySelector('button[onclick="mostrarModalBalance()"]');
  if (btnBalance) {
    btnBalance.onclick = function() {
      mostrarModalPin('balance');
    };
  }
  
  const btnInventario = document.querySelector('a[href="inventario.html"]');
  if (btnInventario) {
    btnInventario.onclick = function(e) {
      e.preventDefault();
      mostrarModalPin('inventario');
    };
  }
});

// Función para migrar cierres existentes
function migrarCierresExistentes() {
    try {
        const cierresAntiguos = JSON.parse(localStorage.getItem('cierres')) || [];
        const historialCierres = JSON.parse(localStorage.getItem('historialCierres')) || [];
        
        if (cierresAntiguos.length > 0) {
            // Agregar los cierres antiguos al historial
            historialCierres.push(...cierresAntiguos);
            localStorage.setItem('historialCierres', JSON.stringify(historialCierres));
            
            // Limpiar la clave antigua
            localStorage.removeItem('cierres');
        }
    } catch (error) {
        console.error('Error al migrar cierres:', error);
    }
}

// Llamar a la migración al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    migrarCierresExistentes();
    // ... resto del código existente ...
});

// Función para cargar clientes en el select de cotización
function cargarClientesCotizacion() {
    const selectCliente = document.getElementById('clienteCotizacion');
    if (!selectCliente) return;
    selectCliente.innerHTML = '<option value="">Seleccionar cliente</option>';
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre;
        selectCliente.appendChild(option);
    });
}

// Modificar mostrarModalNuevaCotizacion para usar cargarClientesCotizacion
const mostrarModalNuevaCotizacionOriginal = mostrarModalNuevaCotizacion;
mostrarModalNuevaCotizacion = function() {
    try {
        // Verificar que el modal existe
        const modalElement = document.getElementById('modalNuevaCotizacion');
        if (!modalElement) {
            throw new Error('El modal de nueva cotización no existe en el DOM');
        }

        // Inicializar arrays si no existen
        if (!Array.isArray(window.itemsCotizacion)) {
            window.itemsCotizacion = [];
        }

        // Verificar y establecer fecha actual
        const fechaInput = document.getElementById('fechaCotizacion');
        if (!fechaInput) {
            throw new Error('El campo de fecha no existe');
        }
        const hoy = new Date();
        fechaInput.value = hoy.toISOString().split('T')[0];

        // Cargar clientes en el select
        cargarClientesCotizacion();

        // Cargar categorías
        if (typeof cargarCategoriasCotizacion === 'function') {
            cargarCategoriasCotizacion();
        }

        // Limpiar campos de búsqueda y resultados
        const buscarProducto = document.getElementById('buscarProducto');
        if (buscarProducto) {
            buscarProducto.value = '';
        }
        const resultadosBusqueda = document.getElementById('resultadosBusqueda');
        if (resultadosBusqueda) {
            resultadosBusqueda.innerHTML = '';
            resultadosBusqueda.style.display = 'none';
        }
        const productoManual = document.getElementById('productoManual');
        if (productoManual) {
            productoManual.value = '';
            productoManual.style.display = 'none';
        }

        // Limpiar tabla de items
        const tablaItems = document.getElementById('itemsCotizacion');
        if (tablaItems) {
            tablaItems.innerHTML = '';
        }
        document.getElementById('totalCotizacion').textContent = formatearPrecio(0);

        // Mostrar el modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error('Error al mostrar modal de cotización:', error);
        alert('Error al mostrar el modal de cotización');
    }
}

// Modificar guardarNuevoCliente para actualizar el select y seleccionar el nuevo cliente
const guardarNuevoClienteOriginal = guardarNuevoCliente;
guardarNuevoCliente = function() {
    try {
        const form = document.getElementById('formNuevoCliente');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const cliente = {
            id: Date.now(),
            nombre: document.getElementById('nombreCliente').value.trim(),
            telefono: document.getElementById('telefonoCliente').value.trim(),
            direccion: document.getElementById('direccionCliente').value.trim(),
            email: document.getElementById('emailCliente').value.trim()
        };

        // Guardar en localStorage
        const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
        clientes.push(cliente);
        localStorage.setItem('clientes', JSON.stringify(clientes));
        if (window.ToySoftFirebase && typeof ToySoftFirebase.persistirDatosDebounced === 'function') {
          ToySoftFirebase.persistirDatosDebounced();
        }

        // Actualizar select de clientes y seleccionar el nuevo
        cargarClientesCotizacion();
        const selectCliente = document.getElementById('clienteCotizacion');
        selectCliente.value = cliente.id;

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoCliente'));
        modal.hide();

        alert('Cliente guardado exitosamente');
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        alert('Error al guardar el cliente');
    }
}

// Migración de fechas de gastos a formato ISO
function migrarFechasGastosISO() {
    let gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    let cambiado = false;
    gastos = gastos.map(gasto => {
        if (gasto.fecha && !/^\d{4}-\d{2}-\d{2}T/.test(gasto.fecha)) {
            // Si la fecha no es ISO, intentamos convertirla
            // Soporta formatos como dd/mm/yyyy o yyyy-mm-dd
            let partes;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(gasto.fecha)) {
                partes = gasto.fecha.split('/');
                // dd/mm/yyyy
                gasto.fecha = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`).toISOString();
                cambiado = true;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(gasto.fecha)) {
                // yyyy-mm-dd
                gasto.fecha = new Date(gasto.fecha).toISOString();
                cambiado = true;
            }
        }
        return gasto;
    });
    if (cambiado) {
        localStorage.setItem('gastos', JSON.stringify(gastos));
        console.log('Fechas de gastos migradas a formato ISO');
    }
}

// Llamar la migración al cargar datos
(function() {
    migrarFechasGastosISO();
    // --- MIGRAR GASTOS A HISTORIAL ---
    if (!localStorage.getItem('historialGastos')) {
        const gastos = JSON.parse(localStorage.getItem('historialGastos')) || [];
console.log('[BALANCE] Fuente de gastos: historialGastos', gastos);
        localStorage.setItem('historialGastos', JSON.stringify(gastos));
        console.log('[GASTOS] Migrados gastos iniciales a historialGastos');
    }
    
    // --- INICIALIZAR SISTEMA DE RECORDATORIOS ---
    cargarRecordatorios();
    crearRecordatoriosAutomaticos();
    
    // Configurar verificación periódica de recordatorios
    setInterval(verificarRecordatoriosVencidos, 60000); // Cada minuto
    setInterval(crearRecordatoriosAutomaticos, 300000); // Cada 5 minutos
    setInterval(crearRecordatorioCierreAutomatico, 600000); // Cada 10 minutos
})();

// Utilidad para obtener solo la fecha en formato YYYY-MM-DD (zona LOCAL)
function soloFechaISO(fecha) {
    return fechaLocalISO(fecha);
}

// Función para mostrar el modal "Acerca de"
function mostrarAcercaDe() {
    const modal = new bootstrap.Modal(document.getElementById('modalAcercaDe'));
    modal.show();
}

// ===== EXPORTAR FUNCIONES PARA USO GLOBAL =====
// Funciones de recordatorios
window.crearRecordatorio = crearRecordatorio;
window.completarRecordatorio = completarRecordatorio;
window.eliminarRecordatorio = eliminarRecordatorio;
window.obtenerRecordatoriosUrgentes = obtenerRecordatoriosUrgentes;
window.obtenerRecordatoriosPendientesPorTipo = obtenerRecordatoriosPendientesPorTipo;
window.completarRecordatorioPorTipo = completarRecordatorioPorTipo;
window.crearRecordatorioPedidoCocina = crearRecordatorioPedidoCocina;
window.crearRecordatorioLimpiezaMesa = crearRecordatorioLimpiezaMesa;
window.crearRecordatorioInventarioProducto = crearRecordatorioInventarioProducto;
window.crearRecordatorioCierreAutomatico = crearRecordatorioCierreAutomatico;
window.activarNotificacionesNavegador = activarNotificacionesNavegador;
window.verificarEstadoNotificaciones = verificarEstadoNotificaciones;
window.mostrarEstadoNotificaciones = mostrarEstadoNotificaciones;

// Funciones de vista previa
window.mostrarVistaPreviaPedido = mostrarVistaPreviaPedido;
window.mostrarVistaPreviaRecibo = mostrarVistaPreviaRecibo;

// Funciones del sistema
window.reiniciarSistema = reiniciarSistema;
window.reiniciarContadores = reiniciarContadores;
window.reiniciarContadoresDomRec = reiniciarContadoresDomRec;
window.guardarContadores = guardarContadores;

// Función para limpiar completamente el localStorage (útil para desarrollo y pruebas)
function limpiarLocalStorageCompleto() {
  try {
    // Lista de todas las claves que se usan en la aplicación
    const clavesALimpiar = [
      'productos',
      'categorias',
      'mesasActivas',
      'ordenesCocina',
      'clientes',
      'historialVentas',
      'historialCocina',
      'cotizaciones',
      'recordatorios',
      'recordatoriosActivos',
      'notificacionesActivas',
      'contadorDomicilios',
      'contadorRecoger',
      'ultimaFechaContadores',
      'historialGastos',
      'gastos',
      'historialCierres',
      'cierres',
      'historialCierresOperativos',
      'datosNegocio',
      'logoNegocio',
      'configuracionCierre',
      'ultimaHoraCierre'
    ];
    
    // Limpiar cada clave
    clavesALimpiar.forEach(clave => {
      localStorage.removeItem(clave);
      console.log(`🗑️ Clave "${clave}" eliminada del localStorage`);
    });
    
    // Limpiar variables globales
    productos = [];
    categorias = [];
    mesasActivas = new Map();
    mesaSeleccionada = null;
    ordenesCocina = new Map();
    clientes = [];
    historialVentas = [];
    historialCocina = [];
    cotizaciones = [];
    recordatorios = [];
    recordatoriosActivos = [];
    notificacionesActivas = [];
    contadorDomicilios = 0;
    contadorRecoger = 0;
    
    console.log('✅ localStorage completamente limpiado');
    alert('LocalStorage limpiado completamente. La página se recargará.');
    
    // Recargar la página para aplicar los cambios
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al limpiar localStorage:', error);
    alert('Error al limpiar el localStorage: ' + error.message);
  }
}

// Función para limpiar solo productos y categorías
function limpiarProductosYCategorias() {
  try {
    // Limpiar solo productos y categorías
    localStorage.removeItem('productos');
    localStorage.removeItem('categorias');
    
    // Limpiar variables globales
    productos = [];
    categorias = [];
    
    console.log('✅ Productos y categorías limpiados');
    alert('Productos y categorías eliminados. La página se recargará.');
    
    // Recargar la página para aplicar los cambios
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al limpiar productos y categorías:', error);
    alert('Error al limpiar productos y categorías: ' + error.message);
  }
}

// Exportar funciones de limpieza
window.limpiarLocalStorageCompleto = limpiarLocalStorageCompleto;
window.limpiarProductosYCategorias = limpiarProductosYCategorias;

// ========================================
// SISTEMA DE AYUDA CON LOGO TOYSOFT
// ========================================

/**
 * Muestra ayuda específica con logo de ToySoft
 * @param {string} tipo - Tipo de ayuda a mostrar
 */
function mostrarAyudaEspecifica(tipo) {
  console.log('❓ Mostrando ayuda específica:', tipo);
  
  // Crear modal de ayuda si no existe
  let modalAyuda = document.getElementById('modalAyudaRobot');
  if (!modalAyuda) {
    modalAyuda = crearModalAyuda();
  }
  
  // Obtener contenido de ayuda según el tipo
  const contenidoAyuda = obtenerContenidoAyuda(tipo);
  
  // Actualizar contenido del modal
  const modalBody = modalAyuda.querySelector('.modal-body');
  modalBody.innerHTML = contenidoAyuda;
  
  // Mostrar modal
  const modal = new bootstrap.Modal(modalAyuda);
  modal.show();
}

/**
 * Crea el modal de ayuda con el logo de ToySoft
 */
function crearModalAyuda() {
  const modalHTML = `
    <div class="modal fade" id="modalAyudaRobot" tabindex="-1" aria-labelledby="modalAyudaRobotLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <div class="d-flex align-items-center">
              <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="me-3" style="width: 40px; height: 40px;">
              <h5 class="modal-title" id="modalAyudaRobotLabel">
                <i class="fas fa-question-circle me-2"></i>Centro de Ayuda
              </h5>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <!-- Contenido dinámico se inserta aquí -->
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-2"></i>Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Insertar modal en el body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  return document.getElementById('modalAyudaRobot');
}

/**
 * Obtiene el contenido de ayuda según el tipo
 * @param {string} tipo - Tipo de ayuda
 * @returns {string} HTML del contenido
 */
function obtenerContenidoAyuda(tipo) {
  const ayudas = {
    'cierre-caja-general': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">💰 Cierre de Caja</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-calculator text-success me-2"></i>Qué muestra</h6>
          <ul class="list-unstyled">
            <li>• Por defecto, ventas desde el último cierre (incluye anoche si no se cerró)</li>
            <li>• Total de ventas, con mixto ya desglosado en efectivo y transferencia</li>
            <li>• Domicilios a restar (se pagan al domiciliario)</li>
            <li>• Efectivo en caja: base anterior + efectivo − gastos en efectivo − domicilios en efectivo/mixto</li>
            <li>• Las compras por transferencia o a crédito no salen de la caja</li>
            <li>• Balance del restaurante: ventas − gastos (efectivo, transferencia y créditos pagados) − domicilios</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-lightbulb text-warning me-2"></i>Consejos</h6>
          <ul class="list-unstyled">
            <li>• La base que dejes se suma en el siguiente cierre</li>
            <li>• El domicilio pagado por transferencia no se resta de la caja física</li>
            <li>• Puedes hacer varios cierres el mismo día; en Balance queda la última base</li>
            <li>• Imprime el comprobante para archivo</li>
          </ul>
        </div>
      </div>
    `,

    'balance-general': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">📊 Balance</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-layer-group text-info me-2"></i>Ventas y domicilios</h6>
          <ul class="list-unstyled">
            <li>• Elige diario, semanal, mensual o anual</li>
            <li>• En Ventas por tipo, toca <strong>Ver productos</strong> para el detalle; el botón pasa a <strong>Ocultar</strong></li>
            <li>• En Ventas por mesero ves cuánto vendió cada uno; lo de caja sale como Caja (POS)</li>
            <li>• Los domicilios se restan porque se pagan al domiciliario</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-cash-register text-success me-2"></i>Bases de caja</h6>
          <ul class="list-unstyled">
            <li>• Cada cierre del periodo: hora, quién entregó y la base que entró / se dejó</li>
            <li>• Si hay varios cierres, no se suman las bases: queda la del último</li>
            <li>• El total es ventas − gastos − créditos − domicilios, más la última base dejada</li>
          </ul>
        </div>
      </div>
    `,
    
    'cierre-operativo': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">⚙️ Cierre Operativo</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-cogs text-info me-2"></i>Funciones</h6>
          <ul class="list-unstyled">
            <li>• Cierra órdenes pendientes</li>
            <li>• Finaliza mesas activas</li>
            <li>• Limpia órdenes de cocina</li>
            <li>• Prepara sistema para cierre</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-exclamation-triangle text-danger me-2"></i>Importante</h6>
          <ul class="list-unstyled">
            <li>• Solo usar al final del día</li>
            <li>• Verificar que no hay órdenes pendientes</li>
            <li>• Confirmar con el personal de cocina</li>
            <li>• Hacer backup antes de proceder</li>
          </ul>
        </div>
      </div>
    `,
    
    'cotizaciones': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">📋 Sistema de Cotizaciones</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-file-invoice text-primary me-2"></i>Crear Cotización</h6>
          <ul class="list-unstyled">
            <li>• Agrega productos al carrito</li>
            <li>• Configura precios y descuentos</li>
            <li>• Ingresa datos del cliente</li>
            <li>• Genera PDF para envío</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-search text-success me-2"></i>Buscar Cotización</h6>
          <ul class="list-unstyled">
            <li>• Busca por número de cotización</li>
            <li>• Filtra por fecha o cliente</li>
            <li>• Visualiza detalles completos</li>
            <li>• Reimprime si es necesario</li>
          </ul>
        </div>
      </div>
    `,
    
    'buscar-cotizacion': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">🔍 Búsqueda de Cotizaciones</h6>
      </div>
      <div class="alert alert-info">
        <h6><i class="fas fa-info-circle me-2"></i>Métodos de Búsqueda</h6>
        <ul class="mb-0">
          <li><strong>Por número:</strong> Ingresa el ID de la cotización</li>
          <li><strong>Por cliente:</strong> Busca por nombre o teléfono</li>
          <li><strong>Por fecha:</strong> Filtra por rango de fechas</li>
          <li><strong>Por estado:</strong> Pendiente, Aprobada, Rechazada</li>
        </ul>
      </div>
    `,
    
    'imprimir-cotizacion': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">🖨️ Impresión de Cotizaciones</h6>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h6><i class="fas fa-print text-primary me-2"></i>Configuración</h6>
          <ul class="list-unstyled">
            <li>• Verifica impresora conectada</li>
            <li>• Selecciona formato A4</li>
            <li>• Configura márgenes apropiados</li>
            <li>• Revisa vista previa</li>
          </ul>
        </div>
        <div class="col-md-6">
          <h6><i class="fas fa-file-pdf text-danger me-2"></i>Exportar PDF</h6>
          <ul class="list-unstyled">
            <li>• Genera archivo PDF</li>
            <li>• Guarda en carpeta local</li>
            <li>• Envía por email</li>
            <li>• Comparte por WhatsApp</li>
          </ul>
        </div>
      </div>
    `,
    
    'nueva-cotizacion': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">➕ Nueva Cotización</h6>
      </div>
      <div class="alert alert-success">
        <h6><i class="fas fa-plus-circle me-2"></i>Pasos para Crear</h6>
        <ol class="mb-0">
          <li>Selecciona productos del catálogo</li>
          <li>Configura cantidades y precios</li>
          <li>Agrega descuentos si aplica</li>
          <li>Ingresa datos del cliente</li>
          <li>Revisa totales y detalles</li>
          <li>Genera y guarda la cotización</li>
        </ol>
      </div>
    `,
    
    'default': `
      <div class="text-center mb-4">
        <img src="image/logo-ToySoft.png" alt="ToySoft Logo" class="mb-3" style="width: 80px; height: 80px;">
        <h6 class="text-primary">❓ Centro de Ayuda</h6>
      </div>
      <div class="alert alert-info">
        <h6><i class="fas fa-question-circle me-2"></i>¿En qué puedo ayudarte?</h6>
        <p class="mb-0">Soy tu asistente virtual y estoy aquí para ayudarte con cualquier duda sobre el sistema POS.</p>
      </div>
    `
  };
  
  return ayudas[tipo] || ayudas['default'];
}

// Hacer función globalmente accesible
window.mostrarAyudaEspecifica = mostrarAyudaEspecifica;

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

// Función para imprimir tirilla de utilidad
function imprimirTirillaUtilidad() {
  try {
    if (!window.utilidadActual || !window.utilidadActual.productos) {
      alert('Por favor, genere primero el balance para calcular la utilidad');
      return;
    }

    const { productos, total, tipoPeriodo, fecha } = window.utilidadActual;
    const productosConUtilidad = Object.values(productos).sort((a, b) => b.utilidadTotal - a.utilidadTotal);

    if (productosConUtilidad.length === 0) {
      alert('No hay productos con costo definido para imprimir');
      return;
    }

    const ventana = window.open('', 'ImpresionTirillaUtilidad', 'width=400,height=600,scrollbars=yes');
    
    if (!ventana) {
      alert('Por favor, permite las ventanas emergentes para este sitio');
      return;
    }

    const fechaImpresion = new Date().toLocaleDateString('es-ES');
    const horaImpresion = new Date().toLocaleTimeString('es-ES');
    
    let tituloPeriodo = '';
    switch(tipoPeriodo) {
      case 'diario':
        tituloPeriodo = `Día ${new Date(fecha).toLocaleDateString('es-ES')}`;
        break;
      case 'semanal':
        tituloPeriodo = 'Semana Actual';
        break;
      case 'mensual':
        tituloPeriodo = `Mes de ${new Date(fecha).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        break;
      case 'anual':
        tituloPeriodo = `Año ${new Date(fecha).getFullYear()}`;
        break;
      default:
        tituloPeriodo = 'Período Seleccionado';
    }

    let productosHTML = '';
    productosConUtilidad.forEach((producto, index) => {
      productosHTML += `
        <div class="producto-item">
          <div class="producto-nombre">${producto.nombre}</div>
          <div class="utilidad-info">
            <div>Cantidad: ${producto.cantidadVendida}</div>
            <div>Precio Venta: $${producto.precioVenta.toLocaleString()}</div>
            <div>Costo: $${producto.costo.toLocaleString()}</div>
            <div>Utilidad Unitaria: $${producto.utilidadUnitaria.toLocaleString()}</div>
            <div class="utilidad-total">Utilidad Total: $${producto.utilidadTotal.toLocaleString()}</div>
          </div>
        </div>
      `;
      if (index < productosConUtilidad.length - 1) {
        productosHTML += '<div class="separador"></div>';
      }
    });

    ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tirilla Utilidad</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: monospace;
              font-size: 14px;
              width: 57mm;
              margin: 0;
              padding: 1mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .mb-1 { margin-bottom: 0.5mm; }
            .mt-1 { margin-top: 0.5mm; }
            .header {
              border-bottom: 1px dashed #000;
              padding-bottom: 1mm;
              margin-bottom: 1mm;
              text-align: center;
            }
            .producto-item {
              margin-bottom: 2mm;
              padding-bottom: 1mm;
            }
            .producto-nombre {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 0.5mm;
              word-wrap: break-word;
            }
            .utilidad-info {
              font-size: 12px;
              margin-left: 2mm;
            }
            .utilidad-total {
              font-weight: bold;
              color: #006400;
              margin-top: 1mm;
            }
            .separador {
              border-top: 1px dashed #ccc;
              margin: 1mm 0;
            }
            .total-section {
              border-top: 2px solid #000;
              margin-top: 2mm;
              padding-top: 2mm;
              text-align: center;
              font-weight: bold;
              font-size: 16px;
            }
            .fecha-hora {
              font-size: 11px;
              color: #666;
              margin-bottom: 1mm;
            }
            .botones-impresion {
              position: fixed;
              top: 10px;
              right: 10px;
              z-index: 1000;
            }
            @media print { 
              .botones-impresion { display: none; } 
              @page { margin: 0; size: 57mm auto; } 
              body { width: 57mm; } 
            }
          </style>
        </head>
        <body>
          <div class="botones-impresion">
            <button onclick="window.print()">Imprimir</button>
          </div>
          <div class="header">
            <div class="mb-1"><strong>REPORTE DE UTILIDAD</strong></div>
            <div class="fecha-hora">${tituloPeriodo}</div>
            <div class="fecha-hora">${fechaImpresion} ${horaImpresion}</div>
          </div>
          ${productosHTML}
          <div class="total-section">
            TOTAL UTILIDAD: $${total.toLocaleString()}
          </div>
        </body>
      </html>
    `);
    
    ventana.document.close();
  } catch (error) {
    console.error('Error al imprimir tirilla de utilidad:', error);
    alert('Error al generar la tirilla de utilidad: ' + error.message);
  }
}

// Función para exportar utilidad a Excel
function exportarUtilidadExcel() {
  try {
    if (typeof XLSX === 'undefined') {
      alert('La funcionalidad de exportación a Excel no está disponible. Por favor, instale la librería XLSX.');
      return;
    }

    if (!window.utilidadActual || !window.utilidadActual.productos) {
      alert('Por favor, genere primero el balance para calcular la utilidad');
      return;
    }

    const { productos, total, tipoPeriodo, fecha } = window.utilidadActual;
    const productosConUtilidad = Object.values(productos).sort((a, b) => b.utilidadTotal - a.utilidadTotal);

    if (productosConUtilidad.length === 0) {
      alert('No hay productos con costo definido para exportar');
      return;
    }

    const wb = XLSX.utils.book_new();
    
    let tituloPeriodo = '';
    switch(tipoPeriodo) {
      case 'diario':
        tituloPeriodo = `Día ${new Date(fecha).toLocaleDateString('es-ES')}`;
        break;
      case 'semanal':
        tituloPeriodo = 'Semana Actual';
        break;
      case 'mensual':
        tituloPeriodo = `Mes de ${new Date(fecha).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        break;
      case 'anual':
        tituloPeriodo = `Año ${new Date(fecha).getFullYear()}`;
        break;
      default:
        tituloPeriodo = 'Período Seleccionado';
    }

    const datos = productosConUtilidad.map(producto => ({
      'Producto': producto.nombre,
      'Cantidad Vendida': producto.cantidadVendida,
      'Precio Venta': producto.precioVenta,
      'Costo': producto.costo,
      'Utilidad Unitaria': producto.utilidadUnitaria,
      'Utilidad Total': producto.utilidadTotal
    }));

    // Agregar fila de total
    datos.push({
      'Producto': 'TOTAL',
      'Cantidad Vendida': '',
      'Precio Venta': '',
      'Costo': '',
      'Utilidad Unitaria': '',
      'Utilidad Total': total
    });

    const ws = XLSX.utils.json_to_sheet(datos);

    const anchos = [
      { wch: 30 }, // Producto
      { wch: 15 }, // Cantidad Vendida
      { wch: 15 }, // Precio Venta
      { wch: 15 }, // Costo
      { wch: 18 }, // Utilidad Unitaria
      { wch: 18 }  // Utilidad Total
    ];
    ws['!cols'] = anchos;

    XLSX.utils.book_append_sheet(wb, ws, `Utilidad ${tituloPeriodo}`);

    const fechaArchivo = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Utilidad_${tituloPeriodo.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaArchivo}.xlsx`);
    
    alert('Archivo Excel de utilidad generado exitosamente');
  } catch (error) {
    console.error('Error al exportar utilidad a Excel:', error);
    alert('Error al generar el archivo Excel: ' + error.message);
  }
}

// Hacer funciones globalmente accesibles
window.imprimirTirillaUtilidad = imprimirTirillaUtilidad;
window.exportarUtilidadExcel = exportarUtilidadExcel;
  
