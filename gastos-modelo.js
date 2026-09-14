// Modelo compartido de gastos: forma de pago, caja vs balance, crédito a proveedor.
// Lo usan gastos.js (pantalla de gastos) y app.js (cierre y balance).

function normalizarFormaPagoGasto(valor) {
    const v = String(valor || '').toLowerCase().trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (v === 'transferencia' || v === 'banco' || v === 'nequi' || v === 'daviplata') return 'transferencia';
    if (v === 'credito' || v === 'proveedor') return 'credito';
    return 'efectivo';
}

function montoGastoNumero(gasto) {
    return parseFloat(gasto && gasto.monto) || 0;
}

function esCreditoPendiente(gasto) {
    if (!gasto) return false;
    return normalizarFormaPagoGasto(gasto.formaPago) === 'credito' && gasto.estadoPago !== 'pagado';
}

function etiquetaFormaPagoGasto(gasto) {
    const forma = normalizarFormaPagoGasto(gasto && gasto.formaPago);
    if (forma === 'transferencia') return 'Al contado (no caja)';
    if (forma === 'credito') {
        return (gasto && gasto.estadoPago) === 'pagado' ? 'Crédito pagado' : 'Crédito pendiente';
    }
    return 'Efectivo de caja';
}

function textoAyudaFormaPagoGasto(formaPago) {
    const forma = normalizarFormaPagoGasto(formaPago);
    if (forma === 'transferencia') {
        return 'Pagaron ya, pero no con el efectivo de la caja: transferencia, Nequi, cuenta del negocio o del dueño. No se resta de la caja; sí del balance.';
    }
    if (forma === 'credito') {
        return 'Todavía no se paga. No sale de la caja ni del balance hasta que registres el pago al proveedor.';
    }
    return 'El dinero sí salió de la caja física. Se resta del efectivo y del balance del día.';
}

function claseBadgeFormaPagoGasto(gasto) {
    const forma = normalizarFormaPagoGasto(gasto && gasto.formaPago);
    if (forma === 'transferencia') return 'forma-transferencia';
    if (forma === 'credito') {
        return (gasto && gasto.estadoPago) === 'pagado' ? 'forma-credito-pagado' : 'forma-credito';
    }
    return 'forma-efectivo';
}

function fechaRelevanteParaCaja(gasto) {
    if (!gasto) return null;
    const forma = normalizarFormaPagoGasto(gasto.formaPago);
    if (forma === 'efectivo') return gasto.fecha || null;
    if (forma === 'credito' && gasto.estadoPago === 'pagado' && normalizarFormaPagoGasto(gasto.formaPagoLiquidacion) === 'efectivo') {
        return gasto.fechaPago || gasto.fecha || null;
    }
    return null;
}

function fechaRelevanteParaBalance(gasto) {
    if (!gasto) return null;
    const forma = normalizarFormaPagoGasto(gasto.formaPago);
    if (forma === 'credito') {
        if (gasto.estadoPago === 'pagado') return gasto.fechaPago || gasto.fecha || null;
        return null;
    }
    return gasto.fecha || null;
}

function montoGastoAfectaCaja(gasto) {
    if (!fechaRelevanteParaCaja(gasto)) return 0;
    return montoGastoNumero(gasto);
}

function montoGastoAfectaBalance(gasto) {
    if (!fechaRelevanteParaBalance(gasto)) return 0;
    return montoGastoNumero(gasto);
}

function obtenerGastosCombinados() {
    const historial = JSON.parse(localStorage.getItem('historialGastos') || '[]') || [];
    const operativos = JSON.parse(localStorage.getItem('gastos') || '[]') || [];
    const todos = Array.isArray(historial) ? [...historial] : [];
    (Array.isArray(operativos) ? operativos : []).forEach(g => {
        if (!todos.some(existing => String(existing.id) === String(g.id))) {
            todos.push(g);
        }
    });
    return todos;
}

function guardarGastoEnStorage(gastoActualizado) {
    let listaGastos = JSON.parse(localStorage.getItem('gastos') || '[]') || [];
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos') || '[]') || [];
    const id = gastoActualizado && gastoActualizado.id;

    const idxG = listaGastos.findIndex(g => String(g.id) === String(id));
    if (idxG >= 0) listaGastos[idxG] = { ...listaGastos[idxG], ...gastoActualizado };
    else listaGastos.push(gastoActualizado);

    const idxH = historialGastos.findIndex(g => String(g.id) === String(id));
    if (idxH >= 0) historialGastos[idxH] = { ...historialGastos[idxH], ...gastoActualizado };
    else historialGastos.push(gastoActualizado);

    localStorage.setItem('gastos', JSON.stringify(listaGastos));
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    return listaGastos;
}

function eliminarGastoDeStorage(id) {
    let listaGastos = JSON.parse(localStorage.getItem('gastos') || '[]') || [];
    let historialGastos = JSON.parse(localStorage.getItem('historialGastos') || '[]') || [];
    listaGastos = listaGastos.filter(g => String(g.id) !== String(id));
    historialGastos = historialGastos.filter(g => String(g.id) !== String(id));
    localStorage.setItem('gastos', JSON.stringify(listaGastos));
    localStorage.setItem('historialGastos', JSON.stringify(historialGastos));
    return listaGastos;
}

function construirObjetoGasto(datos) {
    const existente = datos.existente || null;
    const forma = normalizarFormaPagoGasto(datos.formaPago);
    const gasto = {
        id: datos.id || (existente && existente.id) || Date.now(),
        fecha: datos.fecha || (existente && existente.fecha) || new Date().toISOString(),
        descripcion: datos.descripcion,
        monto: datos.monto,
        categoria: datos.categoria || (existente && existente.categoria) || '',
        formaPago: forma,
        proveedor: forma === 'credito' ? String(datos.proveedor || '').trim() : String((existente && existente.proveedor) || datos.proveedor || '').trim()
    };

    if (forma === 'credito') {
        if (existente && normalizarFormaPagoGasto(existente.formaPago) === 'credito' && existente.estadoPago === 'pagado') {
            gasto.estadoPago = 'pagado';
            gasto.fechaPago = existente.fechaPago;
            gasto.formaPagoLiquidacion = existente.formaPagoLiquidacion;
        } else {
            gasto.estadoPago = 'pendiente';
        }
    } else {
        gasto.estadoPago = 'pagado';
    }

    return gasto;
}

function registrarPagoGastoCredito(id, formaLiquidacion) {
    const todos = obtenerGastosCombinados();
    const gasto = todos.find(g => String(g.id) === String(id));
    if (!gasto) return { ok: false, error: 'No se encontró el gasto' };
    if (!esCreditoPendiente(gasto)) return { ok: false, error: 'Este gasto no es un crédito pendiente' };

    const actualizado = {
        ...gasto,
        estadoPago: 'pagado',
        fechaPago: new Date().toISOString(),
        formaPagoLiquidacion: normalizarFormaPagoGasto(formaLiquidacion) === 'transferencia' ? 'transferencia' : 'efectivo'
    };
    guardarGastoEnStorage(actualizado);
    return { ok: true, gasto: actualizado };
}

function cuentasPorPagarProveedores(lista) {
    const origen = Array.isArray(lista) ? lista : obtenerGastosCombinados();
    return origen.filter(esCreditoPendiente);
}

function construirImpactoGastos(todosLosGastos, estaEnRango) {
    const lista = Array.isArray(todosLosGastos) ? todosLosGastos : [];
    const enRango = typeof estaEnRango === 'function' ? estaEnRango : () => true;
    const incurridos = [];
    const enCaja = [];
    const enBalance = [];
    const pagosCredito = [];

    lista.forEach(g => {
        if (enRango(g.fecha)) incurridos.push(g);
        const fCaja = fechaRelevanteParaCaja(g);
        if (fCaja && enRango(fCaja) && montoGastoAfectaCaja(g) > 0) enCaja.push(g);
        const fBal = fechaRelevanteParaBalance(g);
        if (fBal && enRango(fBal)) enBalance.push(g);
        if (normalizarFormaPagoGasto(g.formaPago) === 'credito' && g.estadoPago === 'pagado' && enRango(g.fechaPago)) {
            pagosCredito.push(g);
        }
    });

    const idsMostrar = new Set();
    const paraMostrar = [];
    incurridos.concat(pagosCredito).forEach(g => {
        const id = String(g.id);
        if (idsMostrar.has(id)) return;
        idsMostrar.add(id);
        paraMostrar.push(g);
    });

    const sumar = (arr, fn) => arr.reduce((sum, g) => sum + (fn ? fn(g) : montoGastoNumero(g)), 0);
    const formaDe = (g) => normalizarFormaPagoGasto(g.formaPago);

    return {
        gastos: paraMostrar,
        incurridos,
        enCaja,
        enBalance,
        pagosCredito,
        cuentasPorPagar: cuentasPorPagarProveedores(lista),
        totalIncurrido: sumar(incurridos),
        totalGastosCaja: sumar(enCaja),
        totalGastosBalance: sumar(enBalance),
        totalTransferencia: sumar(incurridos.filter(g => formaDe(g) === 'transferencia')),
        totalCreditoPendiente: sumar(incurridos.filter(esCreditoPendiente)),
        totalPagoCreditoCaja: sumar(pagosCredito.filter(g => normalizarFormaPagoGasto(g.formaPagoLiquidacion) === 'efectivo')),
        totalCuentasPorPagar: sumar(cuentasPorPagarProveedores(lista))
    };
}

function gastoAfectaBalanceEnFecha(gasto, predFecha) {
    const fecha = fechaRelevanteParaBalance(gasto);
    if (!fecha) return false;
    return typeof predFecha === 'function' ? predFecha(fecha) : true;
}

function descripcionGastoParaCierre(gasto) {
    const etiqueta = etiquetaFormaPagoGasto(gasto);
    const proveedor = (gasto && gasto.proveedor) ? ` · ${gasto.proveedor}` : '';
    const desc = (gasto && gasto.descripcion) || 'Gasto';
    if (normalizarFormaPagoGasto(gasto && gasto.formaPago) === 'credito' && gasto.estadoPago === 'pagado' && gasto.fechaPago) {
        try {
            const comprada = gasto.fecha ? new Date(gasto.fecha).toLocaleDateString('es-CO') : '';
            if (comprada) return `${desc} (pago crédito${proveedor}, compra ${comprada}) · ${etiqueta}`;
        } catch (e) { /* ignore */ }
    }
    return `${desc}${proveedor} · ${etiqueta}`;
}
