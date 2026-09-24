let fechaPropietario = '';
let productosAbiertosPropietario = false;
let tipoAbiertoPropietario = '';
let meseroAbiertoPropietario = '';
let gastosAbiertosPropietario = false;
let inventarioAbiertoPropietario = false;
let cierresAbiertosPropietario = false;
let ventasPropietario = [];
let gastosPropietario = [];
let cierresPropietario = [];
let cierresOperativosPropietario = [];
let inventarioPropietario = [];
let iniciadoPropietario = false;

function cuentaPuedeVerPropietario() {
  if (!window.ToySoftFirebase) return false;
  const esDueño = typeof ToySoftFirebase.esPropietario === 'function' && ToySoftFirebase.esPropietario();
  const esAdmin = typeof ToySoftFirebase.esAdminNegocio === 'function' && ToySoftFirebase.esAdminNegocio();
  return esDueño || esAdmin;
}

function formatearDineroPropietario(valor) {
  return '$ ' + Math.round(Number(valor) || 0).toLocaleString('es-CO');
}

const cacheFechaPropietario = new Map();

function parseFechaPropietario(valor) {
  if (typeof valor === 'string') {
    if (cacheFechaPropietario.has(valor)) return cacheFechaPropietario.get(valor);
    const fecha = parseFechaTextoPropietario(valor);
    if (cacheFechaPropietario.size > 3000) cacheFechaPropietario.clear();
    cacheFechaPropietario.set(valor, fecha);
    return fecha;
  }
  return parseFechaTextoPropietario(valor);
}

function parseFechaTextoPropietario(valor) {
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
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const dNum = new Date(valor);
    return isNaN(dNum.getTime()) ? null : dNum;
  }
  if (typeof valor !== 'string') return null;
  const texto = valor.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ').trim();
  const iso = new Date(texto);
  if (!isNaN(iso.getTime()) && (/^\d{4}-\d{2}-\d{2}/.test(texto) || texto.includes('T') || /GMT|UTC|Z$/i.test(texto))) {
    return iso;
  }
  if (!isNaN(iso.getTime()) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(texto)) {
    return iso;
  }
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
  return isNaN(iso.getTime()) ? null : iso;
}

function horaFinDiaLaboral() {
  const hora = parseInt(localStorage.getItem('horaFinDiaLaboral') || '4', 10);
  return Number.isFinite(hora) && hora >= 0 && hora <= 23 ? hora : 4;
}

function operaPasadaMedianochePropietario() {
  return localStorage.getItem('operarDespuesMedianoche') === 'true';
}

function inicioFinDiaLaboralPropietario(ref) {
  const base = parseFechaPropietario(ref) || new Date();
  const hora = horaFinDiaLaboral();
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hora, 0, 0, 0);
  if (base.getHours() < hora) inicio.setDate(inicio.getDate() - 1);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio: inicio, fin: fin };
}

function fechaLaboralDePropietario(ahora) {
  const d = parseFechaPropietario(ahora) || new Date();
  if (!operaPasadaMedianochePropietario()) return d;
  const hora = horaFinDiaLaboral();
  if (d.getHours() < hora) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0);
  }
  return d;
}

function fechaISOLocal(d) {
  const fecha = parseFechaPropietario(d) || new Date();
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function fechaHoyISOPropietario() {
  return fechaISOLocal(fechaLaboralDePropietario(new Date()));
}

function asegurarFechaPropietario() {
  if (!fechaPropietario) fechaPropietario = fechaHoyISOPropietario();
  return fechaPropietario;
}

function fechaDesdeISO(iso) {
  const partes = String(iso || '').split('-');
  const y = parseInt(partes[0], 10);
  const m = parseInt(partes[1], 10) - 1;
  const d = parseInt(partes[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
  return new Date(y, m, d, 12, 0, 0);
}

function rangoPeriodoPropietario() {
  const iso = asegurarFechaPropietario();
  const ref = fechaDesdeISO(iso);
  if (operaPasadaMedianochePropietario()) {
    return inicioFinDiaLaboralPropietario(ref);
  }
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  const fin = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1, 0, 0, 0, 0);
  return { inicio: inicio, fin: fin };
}

function sincronizarInputFechaPropietario() {
  const input = document.getElementById('fechaPropietario');
  if (!input) return;
  asegurarFechaPropietario();
  if (input.value !== fechaPropietario) input.value = fechaPropietario;
  input.max = fechaHoyISOPropietario();
}

function fechaEnRango(valor, rango) {
  const d = parseFechaPropietario(valor);
  if (!d) return false;
  return d >= rango.inicio && d < rango.fin;
}

function totalVentaPropietario(venta) {
  if (!venta || typeof venta !== 'object') return 0;
  const total = Number(venta.total);
  if (Number.isFinite(total)) return total;
  const items = Array.isArray(venta.items) ? venta.items : [];
  return items.reduce(function (suma, item) {
    const precio = Number(item && (item.precioTotal != null ? item.precioTotal : (item.precio * (item.cantidad || 1))));
    return suma + (Number.isFinite(precio) ? precio : 0);
  }, 0);
}

function metodoPagoVenta(venta) {
  return String((venta && (venta.metodoPago || venta.formaPago)) || '').toLowerCase();
}

function montoGastoPropietario(gasto) {
  const n = Number(gasto && gasto.monto);
  return Number.isFinite(n) ? n : 0;
}

function fechaDeItem(item) {
  if (!item) return null;
  return item.fecha || item.fechaLocal || item.fechaPago || item.creadoEn || null;
}

function leerListaLocal(clave) {
  try {
    const lista = JSON.parse(localStorage.getItem(clave) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

function cargarLocalPropietario() {
  ventasPropietario = leerListaLocal('historialVentas');
  if (!ventasPropietario.length) ventasPropietario = leerListaLocal('ventas');
  gastosPropietario = leerListaLocal('historialGastos');
  if (!gastosPropietario.length) gastosPropietario = leerListaLocal('gastos');
  cierresPropietario = leerListaLocal('historialCierres');
  cierresOperativosPropietario = leerListaLocal('historialCierresOperativos');
  inventarioPropietario = leerListaLocal('inventario');
}

function pintarCabeceraPropietario() {
  const nombreEl = document.getElementById('nombreUsuarioPropietario');
  const rolEl = document.getElementById('rolPropietarioCabecera');
  const nombre = (window.ToySoftFirebase && typeof ToySoftFirebase.nombreUsuarioActual === 'function' && ToySoftFirebase.nombreUsuarioActual())
    || localStorage.getItem('nombreNegocio')
    || 'Propietario';
  if (nombreEl) nombreEl.textContent = nombre;
  if (rolEl) {
    const esAdmin = window.ToySoftFirebase && typeof ToySoftFirebase.esAdminNegocio === 'function' && ToySoftFirebase.esAdminNegocio();
    rolEl.textContent = esAdmin ? 'Administrador · en vivo' : 'Propietario · en vivo';
  }
}

function htmlEscape(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function montoLineaProducto(item) {
  if (!item) return 0;
  const cantidad = Number(item.cantidad) || 0;
  if (item.total != null && item.total !== '') return Number(item.total) || 0;
  if (item.precioTotal != null && item.precioTotal !== '') return Number(item.precioTotal) || 0;
  return (Number(item.precio) || 0) * cantidad;
}

function esVentaCajaRapidaPropietario(venta) {
  if (!venta) return false;
  const mesa = String(venta.mesa || '');
  return venta.tipo === 'venta_rapida' || venta.origen === 'caja_rapida'
    || mesa === 'VENTA DIRECTA' || mesa.indexOf('VENTA DIRECTA') === 0;
}

function clasificarCanalPropietario(venta) {
  if (!venta) return 'mesa';
  if (esVentaCajaRapidaPropietario(venta)) return 'venta_rapida';
  const tipo = String(venta.tipo || '').toLowerCase();
  const canal = String(venta.canal || '').toLowerCase();
  const mesa = String(venta.mesa || '');
  if (tipo === 'domicilio' || canal === 'domicilio' || mesa.indexOf('DOM-') === 0) return 'domicilio';
  if (tipo === 'recoger' || canal === 'recoger' || mesa.indexOf('REC-') === 0) return 'recoger';
  return 'mesa';
}

function resumirCanalesPropietario(ventas) {
  const canales = {
    mesa: { clave: 'mesa', etiqueta: 'Mesas', icono: 'fa-utensils', cantidadVentas: 0, total: 0, productos: {} },
    domicilio: { clave: 'domicilio', etiqueta: 'Domicilios', icono: 'fa-motorcycle', cantidadVentas: 0, total: 0, productos: {} },
    recoger: { clave: 'recoger', etiqueta: 'Recoger', icono: 'fa-shopping-bag', cantidadVentas: 0, total: 0, productos: {} },
    venta_rapida: { clave: 'venta_rapida', etiqueta: 'Venta rápida', icono: 'fa-bolt', cantidadVentas: 0, total: 0, productos: {} }
  };
  (ventas || []).forEach(function (venta) {
    const canal = canales[clasificarCanalPropietario(venta)] || canales.mesa;
    canal.cantidadVentas += 1;
    canal.total += totalVentaPropietario(venta);
    ((venta && (venta.items || venta.productos)) || []).forEach(function (item) {
      const nombre = String((item && item.nombre) || 'Producto').trim() || 'Producto';
      if (!canal.productos[nombre]) canal.productos[nombre] = { nombre: nombre, cantidad: 0, total: 0 };
      canal.productos[nombre].cantidad += Number(item && item.cantidad) || 0;
      canal.productos[nombre].total += montoLineaProducto(item);
    });
  });
  return canales;
}

var ETIQUETA_CAJA_MESERO = 'Caja (POS)';

function nombreMeseroDeTexto(valor) {
  return String(valor || '').trim();
}

function grupoMeseroPropietario(mapa, nombre) {
  const clave = nombreMeseroDeTexto(nombre) || ETIQUETA_CAJA_MESERO;
  if (!mapa[clave]) {
    mapa[clave] = {
      clave: clave,
      nombre: clave,
      esCaja: clave === ETIQUETA_CAJA_MESERO,
      cantidadVentas: 0,
      total: 0,
      productos: {},
      icono: clave === ETIQUETA_CAJA_MESERO ? 'fa-cash-register' : 'fa-user-tie'
    };
  }
  return mapa[clave];
}

function resumirMeserosPropietario(ventas) {
  const mapa = {};
  (ventas || []).forEach(function (venta) {
    const items = (venta && (venta.items || venta.productos)) || [];
    const nombreVenta = nombreMeseroDeTexto(venta.nombreMesero);
    const nombresItems = {};
    items.forEach(function (item) {
      const n = nombreMeseroDeTexto(item && item.nombreMesero);
      if (!n) return;
      if (!nombresItems[n]) nombresItems[n] = [];
      nombresItems[n].push(item);
    });
    const nombresUnicos = Object.keys(nombresItems);
    const totalVenta = totalVentaPropietario(venta);
    if (nombresUnicos.length <= 1) {
      const nombre = nombresUnicos[0] || nombreVenta || (venta.origen === 'mesero' ? 'Mesero' : ETIQUETA_CAJA_MESERO);
      const grupo = grupoMeseroPropietario(mapa, nombre);
      grupo.cantidadVentas += 1;
      grupo.total += totalVenta;
      items.forEach(function (item) {
        const prod = String((item && item.nombre) || 'Producto').trim() || 'Producto';
        if (!grupo.productos[prod]) grupo.productos[prod] = { nombre: prod, cantidad: 0, total: 0 };
        grupo.productos[prod].cantidad += Number(item && item.cantidad) || 0;
        grupo.productos[prod].total += montoLineaProducto(item);
      });
      return;
    }
    const subtotalItems = items.reduce(function (s, i) { return s + montoLineaProducto(i); }, 0) || 1;
    const itemsSinMesero = items.filter(function (i) { return !nombreMeseroDeTexto(i && i.nombreMesero); });
    const destinoSinNombre = nombreVenta || ETIQUETA_CAJA_MESERO;
    const aportes = {};
    nombresUnicos.forEach(function (n) {
      aportes[n] = nombresItems[n].reduce(function (s, i) { return s + montoLineaProducto(i); }, 0);
    });
    if (itemsSinMesero.length) {
      aportes[destinoSinNombre] = (aportes[destinoSinNombre] || 0)
        + itemsSinMesero.reduce(function (s, i) { return s + montoLineaProducto(i); }, 0);
    }
    Object.keys(aportes).forEach(function (n) {
      const grupo = grupoMeseroPropietario(mapa, n);
      grupo.cantidadVentas += 1;
      grupo.total += totalVenta * (aportes[n] / subtotalItems);
      const susItems = n === destinoSinNombre
        ? (nombresItems[n] || []).concat(itemsSinMesero)
        : (nombresItems[n] || []);
      susItems.forEach(function (item) {
        const prod = String((item && item.nombre) || 'Producto').trim() || 'Producto';
        if (!grupo.productos[prod]) grupo.productos[prod] = { nombre: prod, cantidad: 0, total: 0 };
        grupo.productos[prod].cantidad += Number(item && item.cantidad) || 0;
        grupo.productos[prod].total += montoLineaProducto(item);
      });
    });
  });
  return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) {
    if (a.esCaja !== b.esCaja) return a.esCaja ? 1 : -1;
    return b.total - a.total;
  });
}

function productosDeMapa(mapa) {
  return Object.keys(mapa || {}).map(function (k) { return mapa[k]; }).sort(function (a, b) {
    return b.cantidad - a.cantidad;
  });
}

function htmlListaProductosGrupo(productos) {
  if (!productos.length) {
    return '<p class="vacio-lista mb-0">Sin productos en este tipo.</p>';
  }
  return productos.map(function (p) {
    const cant = Number(p.cantidad) || 0;
    const cantTxt = Number.isInteger(cant) ? String(cant) : String(Math.round(cant * 100) / 100);
    return '<div class="item-lista">' +
      '<div class="fila-producto">' +
      '<div class="titulo">' + htmlEscape(p.nombre) + '</div>' +
      '<div class="cant">× ' + htmlEscape(cantTxt) + '</div>' +
      '<div class="monto">' + formatearDineroPropietario(p.total) + '</div>' +
      '</div></div>';
  }).join('');
}

function propinaDeVentaPropietario(venta) {
  if (!venta) return 0;
  if (venta.propinaMonto != null && venta.propinaMonto !== '') {
    const directo = Number(venta.propinaMonto);
    if (Number.isFinite(directo) && directo > 0) return Math.round(directo);
  }
  const pct = Number(venta.propina) || 0;
  if (pct <= 0) return 0;
  let subtotal = Number(venta.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    subtotal = ((venta.items || [])).reduce(function (sum, item) {
      return sum + montoLineaProducto(item);
    }, 0);
  }
  return Math.round((subtotal * pct) / 100);
}

function valorDomicilioVenta(venta) {
  return Number(venta && venta.valorDomicilio) || 0;
}

function esCreditoVenta(venta) {
  const m = metodoPagoVenta(venta);
  return m === 'credito' || m === 'crédito';
}

function formaGastoPropietario(gasto) {
  if (typeof normalizarFormaPagoGasto === 'function') return normalizarFormaPagoGasto(gasto && gasto.formaPago);
  const v = String((gasto && gasto.formaPago) || '').toLowerCase();
  if (v.indexOf('trans') !== -1 || v.indexOf('nequi') !== -1) return 'transferencia';
  if (v.indexOf('cred') !== -1) return 'credito';
  return 'efectivo';
}

function etiquetaFormaGastoPropietario(gasto) {
  if (typeof etiquetaFormaPagoGasto === 'function') {
    const etiqueta = etiquetaFormaPagoGasto(gasto);
    if (etiqueta === 'Efectivo de caja') return 'Sale de la caja';
    if (etiqueta === 'Al contado (no caja)') return 'Al contado, no sale de caja';
    if (etiqueta === 'Crédito pendiente') return 'Crédito con el proveedor';
    return etiqueta;
  }
  const forma = formaGastoPropietario(gasto);
  if (forma === 'transferencia') return 'Al contado, no sale de caja';
  if (forma === 'credito') return (gasto && gasto.estadoPago) === 'pagado' ? 'Crédito pagado' : 'Crédito con el proveedor';
  return 'Sale de la caja';
}

function claseFormaGasto(gasto) {
  const forma = formaGastoPropietario(gasto);
  if (forma === 'transferencia') return 'contado';
  if (forma === 'credito') return 'credito';
  return 'caja';
}

function impactoGastosPropietario(gastos, rango) {
  const pred = function (fecha) { return fechaEnRango(fecha, rango); };
  if (typeof construirImpactoGastos === 'function') {
    return construirImpactoGastos(gastos, pred);
  }
  const incurridos = (gastos || []).filter(function (g) { return pred(fechaDeItem(g)); });
  const saleCaja = incurridos.filter(function (g) { return formaGastoPropietario(g) === 'efectivo'; });
  const contado = incurridos.filter(function (g) { return formaGastoPropietario(g) === 'transferencia'; });
  const credito = incurridos.filter(function (g) { return formaGastoPropietario(g) === 'credito' && g.estadoPago !== 'pagado'; });
  const sumar = function (arr) {
    return arr.reduce(function (s, g) { return s + montoGastoPropietario(g); }, 0);
  };
  return {
    gastos: incurridos,
    totalGastosBalance: sumar(saleCaja) + sumar(contado),
    totalGastosCaja: sumar(saleCaja),
    totalTransferencia: sumar(contado),
    totalCreditoPendiente: sumar(credito)
  };
}

function agruparProductosVendidos(ventas) {
  const mapa = {};
  (ventas || []).forEach(function (venta) {
    const items = (venta && (venta.items || venta.productos)) || [];
    items.forEach(function (item) {
      const nombre = String((item && item.nombre) || 'Producto').trim() || 'Producto';
      if (!mapa[nombre]) mapa[nombre] = { nombre: nombre, cantidad: 0, total: 0 };
      mapa[nombre].cantidad += Number(item && item.cantidad) || 0;
      mapa[nombre].total += montoLineaProducto(item);
    });
  });
  return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) {
    return b.cantidad - a.cantidad;
  });
}

function pintarProductosVendidos(ventas) {
  const caja = document.getElementById('listaProductosVendidos');
  const boton = document.getElementById('btnMasProductos');
  if (boton) {
    boton.textContent = productosAbiertosPropietario ? '−' : '+';
    boton.classList.toggle('abierto', productosAbiertosPropietario);
    boton.setAttribute('aria-expanded', productosAbiertosPropietario ? 'true' : 'false');
    boton.setAttribute('aria-label', productosAbiertosPropietario ? 'Ocultar productos vendidos' : 'Ver productos vendidos');
  }
  if (!caja) return;
  caja.style.display = productosAbiertosPropietario ? '' : 'none';
  if (!productosAbiertosPropietario) return;
  const productos = agruparProductosVendidos(ventas);
  if (!productos.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay productos vendidos este día.</p>';
    return;
  }
  caja.innerHTML = productos.map(function (p) {
    const cant = Number(p.cantidad) || 0;
    const cantTxt = Number.isInteger(cant) ? String(cant) : String(Math.round(cant * 100) / 100);
    return '<div class="item-lista">' +
      '<div class="fila-producto">' +
      '<div class="titulo">' + htmlEscape(p.nombre) + '</div>' +
      '<div class="cant">× ' + htmlEscape(cantTxt) + '</div>' +
      '<div class="monto">' + formatearDineroPropietario(p.total) + '</div>' +
      '</div></div>';
  }).join('');
}

function pintarVentasPorTipo(ventas) {
  const caja = document.getElementById('listaVentasPorTipo');
  if (!caja) return;
  const canales = resumirCanalesPropietario(ventas);
  const orden = ['mesa', 'domicilio', 'recoger', 'venta_rapida'];
  caja.innerHTML = orden.map(function (clave) {
    const canal = canales[clave];
    const abierto = tipoAbiertoPropietario === clave;
    const productos = productosDeMapa(canal.productos);
    const detalle = abierto
      ? '<div class="detalle-interno">' + htmlListaProductosGrupo(productos) + '</div>'
      : '';
    return '<div class="item-lista">' +
      '<div class="fila-tipo">' +
      '<div class="titulo"><i class="fas ' + canal.icono + '"></i>' + htmlEscape(canal.etiqueta) + '</div>' +
      '<div class="cant">' + htmlEscape(String(canal.cantidadVentas)) + '</div>' +
      '<div class="monto">' + formatearDineroPropietario(canal.total) + '</div>' +
      '<button type="button" class="btn-mas-productos chico' + (abierto ? ' abierto' : '') + '" onclick="alternarTipoPropietario(\'' + clave + '\')" aria-label="Ver productos de ' + htmlEscape(canal.etiqueta) + '" aria-expanded="' + (abierto ? 'true' : 'false') + '">' +
      (abierto ? '−' : '+') + '</button>' +
      '</div></div>' + detalle;
  }).join('');
}

function pintarVentasPorMesero(ventas) {
  const caja = document.getElementById('listaVentasPorMesero');
  if (!caja) return;
  const lista = resumirMeserosPropietario(ventas);
  if (!lista.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay ventas este día.</p>';
    return;
  }
  caja.innerHTML = lista.map(function (mesero) {
    const abierto = meseroAbiertoPropietario === mesero.clave;
    const productos = productosDeMapa(mesero.productos);
    const detalle = abierto
      ? '<div class="detalle-interno">' + htmlListaProductosGrupo(productos) + '</div>'
      : '';
    return '<div class="item-lista">' +
      '<div class="fila-tipo">' +
      '<div class="titulo"><i class="fas ' + mesero.icono + '"></i>' + htmlEscape(mesero.nombre) + '</div>' +
      '<div class="cant">' + htmlEscape(String(mesero.cantidadVentas)) + '</div>' +
      '<div class="monto">' + formatearDineroPropietario(mesero.total) + '</div>' +
      '<button type="button" class="btn-mas-productos chico' + (abierto ? ' abierto' : '') + '" data-mesero="' + encodeURIComponent(mesero.clave) + '" onclick="alternarMeseroPropietario(this)" aria-label="Ver productos de ' + htmlEscape(mesero.nombre) + '" aria-expanded="' + (abierto ? 'true' : 'false') + '">' +
      (abierto ? '−' : '+') + '</button>' +
      '</div></div>' + detalle;
  }).join('');
}

function pintarPropinas(ventas) {
  const caja = document.getElementById('listaPropinas');
  if (!caja) return;
  const total = (ventas || []).reduce(function (s, v) { return s + propinaDeVentaPropietario(v); }, 0);
  const conPropina = (ventas || []).filter(function (v) { return propinaDeVentaPropietario(v) > 0; });
  if (!conPropina.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay propinas este día. Se restan del balance, igual que el domicilio.</p>';
    return;
  }
  caja.innerHTML = '<div class="item-lista">' +
    '<div class="d-flex justify-content-between gap-2">' +
    '<div><div class="titulo">Total propinas</div>' +
    '<div class="meta">Del personal. Se restan del balance, igual que el domicilio.</div></div>' +
    '<div class="monto gasto">' + formatearDineroPropietario(total) + '</div>' +
    '</div></div>' +
    conPropina.map(function (v) {
      const fecha = parseFechaPropietario(fechaDeItem(v));
      const etiqueta = fecha
        ? fecha.toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' })
        : '';
      const mesero = nombreMeseroDeTexto(v.nombreMesero) || (v.origen === 'mesero' ? 'Mesero' : 'Caja');
      return '<div class="item-lista">' +
        '<div class="d-flex justify-content-between gap-2">' +
        '<div><div class="titulo">' + htmlEscape(mesero) + '</div>' +
        '<div class="meta">' + htmlEscape(etiqueta) + '</div></div>' +
        '<div class="monto gasto">' + formatearDineroPropietario(propinaDeVentaPropietario(v)) + '</div>' +
        '</div></div>';
    }).join('');
}

function pintarDomiciliarios(ventas) {
  const caja = document.getElementById('listaDomiciliarios');
  if (!caja) return;
  const mapa = {};
  let total = 0;
  (ventas || []).forEach(function (v) {
    const valor = valorDomicilioVenta(v);
    if (valor <= 0) return;
    const nombre = String(v.nombreDomiciliario || v.domiciliario || 'Sin nombre').trim() || 'Sin nombre';
    mapa[nombre] = (mapa[nombre] || 0) + valor;
    total += valor;
  });
  const nombres = Object.keys(mapa).sort(function (a, b) { return mapa[b] - mapa[a]; });
  if (!nombres.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay domicilios este día.</p>';
    return;
  }
  caja.innerHTML = nombres.map(function (nombre) {
    return '<div class="item-lista">' +
      '<div class="d-flex justify-content-between gap-2">' +
      '<div class="titulo">' + htmlEscape(nombre) + '</div>' +
      '<div class="monto">' + formatearDineroPropietario(mapa[nombre]) + '</div>' +
      '</div></div>';
  }).join('') +
    '<div class="item-lista"><div class="d-flex justify-content-between gap-2">' +
    '<div class="titulo">Total domicilios</div>' +
    '<div class="monto">' + formatearDineroPropietario(total) + '</div></div></div>';
}

function pintarCreditosPendientes(ventas) {
  const caja = document.getElementById('listaCreditos');
  if (!caja) return;
  const creditos = (ventas || []).filter(esCreditoVenta);
  if (!creditos.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay créditos pendientes este día.</p>';
    return;
  }
  caja.innerHTML = creditos.map(function (c) {
    const fecha = parseFechaPropietario(fechaDeItem(c));
    const etiqueta = fecha
      ? fecha.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    return '<div class="item-lista">' +
      '<div class="d-flex justify-content-between gap-2">' +
      '<div><div class="titulo">' + htmlEscape(c.cliente || 'Sin cliente') + '</div>' +
      '<div class="meta">' + htmlEscape(etiqueta) + '</div></div>' +
      '<div class="monto">' + formatearDineroPropietario(totalVentaPropietario(c)) + '</div>' +
      '</div></div>';
  }).join('');
}

function pintarGastosAgrupados(impacto) {
  const setTexto = function (id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatearDineroPropietario(valor);
  };
  setTexto('gastoSaleCaja', impacto.totalGastosCaja || 0);
  setTexto('gastoAlContado', impacto.totalTransferencia || 0);
  setTexto('gastoCreditoProveedor', impacto.totalCreditoPendiente || 0);

  const boton = document.getElementById('btnMasGastos');
  if (boton) {
    boton.textContent = gastosAbiertosPropietario ? '−' : '+';
    boton.classList.toggle('abierto', gastosAbiertosPropietario);
    boton.setAttribute('aria-expanded', gastosAbiertosPropietario ? 'true' : 'false');
  }
  const caja = document.getElementById('listaGastos');
  if (!caja) return;
  caja.style.display = gastosAbiertosPropietario ? '' : 'none';
  if (!gastosAbiertosPropietario) return;
  const lista = impacto.gastos || [];
  if (!lista.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay gastos este día.</p>';
    return;
  }
  caja.innerHTML = lista.map(function (gasto) {
    const fecha = parseFechaPropietario(fechaDeItem(gasto));
    const etiqueta = fecha
      ? fecha.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    const forma = etiquetaFormaGastoPropietario(gasto);
    const clase = claseFormaGasto(gasto);
    return '<div class="item-lista">' +
      '<div class="d-flex justify-content-between gap-2">' +
      '<div><div class="titulo">' + htmlEscape(gasto.descripcion || gasto.concepto || 'Gasto') + '</div>' +
      '<div class="meta">' + htmlEscape(etiqueta || gasto.proveedor || '') + '</div>' +
      '<span class="badge-forma ' + clase + '">' + htmlEscape(forma) + '</span></div>' +
      '<div class="monto gasto">' + formatearDineroPropietario(montoGastoPropietario(gasto)) + '</div>' +
      '</div></div>';
  }).join('');
}

function aplicarBotonMas(idBoton, idLista, abierto, labelVer, labelOcultar) {
  const boton = document.getElementById(idBoton);
  const caja = document.getElementById(idLista);
  if (boton) {
    boton.textContent = abierto ? '−' : '+';
    boton.classList.toggle('abierto', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    boton.setAttribute('aria-label', abierto ? (labelOcultar || 'Ocultar') : (labelVer || 'Ver'));
  }
  if (caja) caja.style.display = abierto ? '' : 'none';
  return caja;
}

function ordenarPorFechaDesc(lista) {
  return (lista || []).slice().sort(function (a, b) {
    const da = parseFechaPropietario(fechaDeItem(a)) || new Date(0);
    const db = parseFechaPropietario(fechaDeItem(b)) || new Date(0);
    return db - da;
  });
}

function etiquetaFechaCierre(cierre) {
  const fecha = parseFechaPropietario(fechaDeItem(cierre));
  if (fecha) {
    return fecha.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return cierre && cierre.fechaLocal ? cierre.fechaLocal : 'Cierre';
}

function pintarInventarioBajo() {
  const caja = aplicarBotonMas('btnMasInventario', 'listaInventarioBajo', inventarioAbiertoPropietario, 'Ver inventario bajo', 'Ocultar inventario bajo');
  if (!caja || !inventarioAbiertoPropietario) return;
  const bajos = inventarioPropietario.filter(function (item) {
    const actual = Number(item && item.stockActual);
    const minimo = Number(item && item.stockMinimo);
    if (!Number.isFinite(actual)) return false;
    return actual <= (Number.isFinite(minimo) ? minimo : 0);
  }).sort(function (a, b) {
    return Number(a.stockActual) - Number(b.stockActual);
  });
  if (!bajos.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">Todo el inventario está por encima del mínimo.</p>';
    return;
  }
  caja.innerHTML = bajos.map(function (item) {
    const unidad = htmlEscape(item.unidadMedida || '');
    return '<div class="item-lista alerta">' +
      '<div class="d-flex justify-content-between gap-2">' +
      '<div><div class="titulo">' + htmlEscape(item.nombre || 'Producto') + '</div>' +
      '<div class="meta">Mínimo ' + htmlEscape(String(item.stockMinimo || 0)) + (unidad ? ' ' + unidad : '') + '</div></div>' +
      '<div class="monto">' + htmlEscape(String(item.stockActual)) + (unidad ? ' ' + unidad : '') + '</div>' +
      '</div></div>';
  }).join('');
}

function pintarCierresDia(rango) {
  const caja = aplicarBotonMas('btnMasCierres', 'listaCierres', cierresAbiertosPropietario, 'Ver cierres', 'Ocultar cierres');
  if (!caja || !cierresAbiertosPropietario) return;
  const admin = ordenarPorFechaDesc(cierresPropietario.filter(function (c) {
    return fechaEnRango(fechaDeItem(c), rango);
  }));
  const operativos = ordenarPorFechaDesc(cierresOperativosPropietario.filter(function (c) {
    return fechaEnRango(fechaDeItem(c), rango);
  }));
  if (!admin.length && !operativos.length) {
    caja.innerHTML = '<p class="vacio-lista mb-0">No hay cierres este día.</p>';
    return;
  }
  let html = '<p class="vacio-lista mb-2">Administrativo</p>';
  if (!admin.length) {
    html += '<p class="vacio-lista mb-3">No hay cierre administrativo este día.</p>';
  } else {
    html += admin.map(function (cierre) {
      const ventasCierre = cierre.ventas && cierre.ventas.total != null ? cierre.ventas.total : 0;
      const gastosCierre = cierre.gastos != null ? cierre.gastos : 0;
      const balanceCierre = cierre.balance != null ? cierre.balance : (ventasCierre - gastosCierre);
      const quien = [cierre.nombreCierre, cierre.nombreRecibe].filter(Boolean).join(' → ');
      const meta = (quien ? quien + ' · ' : '') + 'Ventas ' + formatearDineroPropietario(ventasCierre) + ' · Gastos ' + formatearDineroPropietario(gastosCierre);
      return '<div class="item-lista">' +
        '<div class="d-flex justify-content-between gap-2">' +
        '<div><div class="titulo">' + htmlEscape(etiquetaFechaCierre(cierre)) + '</div>' +
        '<div class="meta">' + htmlEscape(meta) + '</div>' +
        '<span class="badge-forma caja">Administrativo</span></div>' +
        '<div class="monto">' + formatearDineroPropietario(balanceCierre) + '</div>' +
        '</div></div>';
    }).join('');
  }
  html += '<p class="vacio-lista mb-2 mt-3">Operativo</p>';
  if (!operativos.length) {
    html += '<p class="vacio-lista mb-0">No hay cierre operativo este día.</p>';
  } else {
    html += operativos.map(function (cierre) {
      const empleado = cierre.empleado && cierre.empleado.nombre ? cierre.empleado.nombre : '';
      const recibe = cierre.entregaTurno && cierre.entregaTurno.nombreRecibe ? cierre.entregaTurno.nombreRecibe : '';
      const total = (cierre.totales && cierre.totales.general != null)
        ? cierre.totales.general
        : ((cierre.totales && ((Number(cierre.totales.efectivo) || 0) + (Number(cierre.totales.transferencia) || 0) + (Number(cierre.totales.tarjeta) || 0))) || 0);
      const quien = [empleado, recibe].filter(Boolean).join(' → ');
      return '<div class="item-lista">' +
        '<div class="d-flex justify-content-between gap-2">' +
        '<div><div class="titulo">' + htmlEscape(etiquetaFechaCierre(cierre)) + '</div>' +
        '<div class="meta">' + htmlEscape(quien || 'Cierre operativo') + '</div>' +
        '<span class="badge-forma contado">Operativo</span></div>' +
        '<div class="monto">' + formatearDineroPropietario(total) + '</div>' +
        '</div></div>';
    }).join('');
  }
  caja.innerHTML = html;
}

function pintarDashboardPropietario() {
  sincronizarInputFechaPropietario();
  const rango = rangoPeriodoPropietario();
  const ventas = ventasPropietario.filter(function (v) { return fechaEnRango(fechaDeItem(v), rango); });
  const impacto = impactoGastosPropietario(gastosPropietario, rango);
  const totalVentas = ventas.reduce(function (s, v) { return s + totalVentaPropietario(v); }, 0);
  const totalGastos = Number(impacto.totalGastosBalance) || 0;
  const totalPropinas = ventas.reduce(function (s, v) { return s + propinaDeVentaPropietario(v); }, 0);
  const totalDomicilios = ventas.reduce(function (s, v) { return s + valorDomicilioVenta(v); }, 0);
  const creditos = ventas.filter(esCreditoVenta);
  const totalCreditos = creditos.reduce(function (s, v) { return s + totalVentaPropietario(v); }, 0);
  const balance = totalVentas - totalGastos - totalPropinas - totalCreditos - totalDomicilios;

  let efectivo = 0;
  let transferencia = 0;
  let tarjeta = 0;
  let creditoPago = 0;
  ventas.forEach(function (v) {
    const m = metodoPagoVenta(v);
    const total = totalVentaPropietario(v);
    if (m === 'mixto') {
      efectivo += Number(v.montoRecibido) || 0;
      transferencia += Number(v.montoTransferencia) || 0;
      return;
    }
    if (m.indexOf('efectivo') !== -1) efectivo += total;
    else if (m.indexOf('transfer') !== -1 || m.indexOf('nequi') !== -1 || m.indexOf('davi') !== -1) transferencia += total;
    else if (m.indexOf('tarjeta') !== -1) tarjeta += total;
    else if (esCreditoVenta(v)) creditoPago += total;
  });

  const setTexto = function (id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  };
  setTexto('datoVentas', formatearDineroPropietario(totalVentas));
  setTexto('datoGastos', formatearDineroPropietario(totalGastos));
  setTexto('datoBalance', formatearDineroPropietario(balance));
  setTexto('datoEfectivo', formatearDineroPropietario(efectivo));
  setTexto('datoTransferencia', formatearDineroPropietario(transferencia));
  setTexto('datoTarjeta', formatearDineroPropietario(tarjeta));
  setTexto('datoCredito', formatearDineroPropietario(creditoPago));
  setTexto('datoTickets', String(ventas.length));
  setTexto('datoDomicilios', formatearDineroPropietario(totalDomicilios));
  setTexto('datoPropinas', formatearDineroPropietario(totalPropinas));
  const nota = document.getElementById('notaBalance');
  if (nota) {
    const partes = [];
    if (totalPropinas) partes.push('− propinas ' + formatearDineroPropietario(totalPropinas));
    if (totalDomicilios) partes.push('− domicilios ' + formatearDineroPropietario(totalDomicilios));
    if (totalCreditos) partes.push('− créditos ' + formatearDineroPropietario(totalCreditos));
    nota.textContent = partes.length ? ('Balance: ventas − gastos' + (partes.length ? ' ' + partes.join(' ') : '')) : '';
  }
  const tarjetaBalanceEl = document.getElementById('tarjetaBalance');
  if (tarjetaBalanceEl) {
    if (balance < 0) tarjetaBalanceEl.classList.add('negativo');
    else tarjetaBalanceEl.classList.remove('negativo');
  }

  pintarProductosVendidos(ventas);
  pintarVentasPorTipo(ventas);
  pintarVentasPorMesero(ventas);
  pintarDomiciliarios(ventas);
  pintarPropinas(ventas);
  pintarCreditosPendientes(ventas);
  pintarGastosAgrupados(impacto);
  pintarInventarioBajo();
  pintarCierresDia(rango);
}

function cambiarFechaPropietario() {
  const input = document.getElementById('fechaPropietario');
  const valor = input && input.value;
  if (!valor) return;
  fechaPropietario = valor;
  pintarDashboardPropietario();
}

function cambiarDiaPropietario(delta) {
  asegurarFechaPropietario();
  const actual = fechaDesdeISO(fechaPropietario);
  actual.setDate(actual.getDate() + (Number(delta) || 0));
  const iso = fechaISOLocal(actual);
  const tope = fechaHoyISOPropietario();
  if (iso > tope) fechaPropietario = tope;
  else fechaPropietario = iso;
  pintarDashboardPropietario();
}

function alternarProductosPropietario() {
  productosAbiertosPropietario = !productosAbiertosPropietario;
  pintarDashboardPropietario();
}

function alternarTipoPropietario(clave) {
  tipoAbiertoPropietario = tipoAbiertoPropietario === clave ? '' : clave;
  pintarDashboardPropietario();
}

function alternarMeseroPropietario(boton) {
  const clave = decodeURIComponent((boton && boton.getAttribute('data-mesero')) || '');
  meseroAbiertoPropietario = meseroAbiertoPropietario === clave ? '' : clave;
  pintarDashboardPropietario();
}

function alternarGastosPropietario() {
  gastosAbiertosPropietario = !gastosAbiertosPropietario;
  pintarDashboardPropietario();
}

function alternarInventarioPropietario() {
  inventarioAbiertoPropietario = !inventarioAbiertoPropietario;
  pintarDashboardPropietario();
}

function alternarCierresPropietario() {
  cierresAbiertosPropietario = !cierresAbiertosPropietario;
  pintarDashboardPropietario();
}

function mostrarLoginPropietario() {
  const login = document.getElementById('loginPropietario');
  const app = document.getElementById('appPropietario');
  if (login) login.style.display = 'flex';
  if (app) {
    app.style.display = 'none';
    app.classList.remove('app-visible');
  }
}

function mostrarAppPropietario() {
  const login = document.getElementById('loginPropietario');
  const app = document.getElementById('appPropietario');
  if (login) login.style.display = 'none';
  if (app) {
    app.style.display = 'flex';
    app.classList.add('app-visible');
  }
}

async function actualizarPaginaPropietario() {
  const btn = document.getElementById('btnActualizarPropietario');
  if (btn) btn.classList.add('girando');
  try {
    escucharDatosPropietario();
    await cargarDatosPropietario();
  } finally {
    setTimeout(function () {
      if (btn) btn.classList.remove('girando');
    }, 400);
  }
}

let pinturaPropietarioTimer = 0;
let pinturaPropietarioSucia = false;

function programarPinturaPropietario() {
  pinturaPropietarioSucia = true;
  if (pinturaPropietarioTimer) return;
  pinturaPropietarioTimer = setTimeout(function () {
    pinturaPropietarioTimer = 0;
    if (!pinturaPropietarioSucia) return;
    pinturaPropietarioSucia = false;
    pintarDashboardPropietario();
  }, 40);
}

async function cargarDatosPropietario() {
  if (!window.ToySoftFirebase) {
    cargarLocalPropietario();
    pintarDashboardPropietario();
    return;
  }
  const tareas = [];
  const seguir = function (promesa) {
    tareas.push(promesa.catch(function (e) {
      console.warn('No se pudo sincronizar el panel del propietario', e);
    }));
  };
  if (typeof ToySoftFirebase.sincronizarVentas === 'function') {
    seguir(ToySoftFirebase.sincronizarVentas().then(function (lista) {
      ventasPropietario = lista || [];
      programarPinturaPropietario();
    }));
  }
  if (typeof ToySoftFirebase.sincronizarFinanzas === 'function') {
    seguir(ToySoftFirebase.sincronizarFinanzas().then(function (finanzas) {
      gastosPropietario = (finanzas && finanzas.gastos) || [];
      cierresPropietario = (finanzas && finanzas.cierres) || [];
      cierresOperativosPropietario = (finanzas && finanzas.cierresOperativos) || [];
      programarPinturaPropietario();
    }));
  }
  if (typeof ToySoftFirebase.sincronizarInventario === 'function') {
    seguir(ToySoftFirebase.sincronizarInventario().then(function (lista) {
      inventarioPropietario = lista || [];
      programarPinturaPropietario();
    }));
  }
  await Promise.all(tareas);
}

function escucharDatosPropietario() {
  if (!window.ToySoftFirebase) return;
  if (typeof ToySoftFirebase.escucharVentas === 'function') {
    ToySoftFirebase.escucharVentas(function (lista) {
      ventasPropietario = Array.isArray(lista) ? lista : [];
      programarPinturaPropietario();
    });
  }
  if (typeof ToySoftFirebase.escucharFinanzas === 'function') {
    ToySoftFirebase.escucharFinanzas({
      gastos: function (lista) {
        gastosPropietario = Array.isArray(lista) ? lista : [];
        programarPinturaPropietario();
      },
      cierres: function (lista) {
        cierresPropietario = Array.isArray(lista) ? lista : [];
        programarPinturaPropietario();
      },
      cierresOperativos: function (lista) {
        cierresOperativosPropietario = Array.isArray(lista) ? lista : [];
        programarPinturaPropietario();
      }
    });
  }
  if (typeof ToySoftFirebase.escucharInventario === 'function') {
    ToySoftFirebase.escucharInventario(function (lista) {
      inventarioPropietario = Array.isArray(lista) ? lista : [];
      programarPinturaPropietario();
    });
  }
}

async function iniciarPropietario() {
  if (iniciadoPropietario) {
    pintarCabeceraPropietario();
    await cargarDatosPropietario();
    return;
  }
  iniciadoPropietario = true;
  pintarCabeceraPropietario();
  cargarLocalPropietario();
  pintarDashboardPropietario();
  await cargarDatosPropietario();
  escucharDatosPropietario();
}

async function iniciarSesionPropietario() {
  const { email, clave } = loginFormularioValores();
  mostrarLoginMensaje('');
  if (!email || !clave) {
    mostrarLoginMensaje('Escribe el correo y la contraseña.');
    return;
  }
  try {
    await ToySoftFirebase.init();
    await ToySoftFirebase.iniciarSesion(email, clave, '', { soloUnirse: true });
    if (!cuentaPuedeVerPropietario()) {
      try { await ToySoftFirebase.cerrarSesion(); } catch (e) {}
      mostrarLoginMensaje('Esta cuenta no es de propietario. Pide al administrador que te cree en Administración.');
      return;
    }
    localStorage.setItem('sesionActivaPropietario', 'true');
    mostrarAppPropietario();
    iniciarPropietario();
  } catch (error) {
    mostrarLoginMensaje(ToySoftFirebase.mensajeErrorAuth(error));
  }
}

async function iniciarPantallaPropietario() {
  if (!window.ToySoftFirebase) {
    mostrarLoginPropietario();
    return;
  }
  try {
    await ToySoftFirebase.init();
    const user = await ToySoftFirebase.esperarAuth();
    if (!user) {
      mostrarLoginPropietario();
      return;
    }
    const recordado = window.ToySoftFirebase
      && typeof ToySoftFirebase.sesionRecordada === 'function'
      && (ToySoftFirebase.sesionRecordada('propietario') || ToySoftFirebase.sesionRecordada('admin'));
    if (!cuentaPuedeVerPropietario() && !recordado) {
      mostrarLoginPropietario();
      mostrarLoginMensaje('');
      return;
    }
    localStorage.setItem('sesionActivaPropietario', 'true');
    mostrarAppPropietario();
    iniciarPropietario();
  } catch (error) {
    mostrarLoginPropietario();
    mostrarLoginMensaje((error && error.message) || 'No se pudo conectar.');
  }
}
