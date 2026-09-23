// Sistema de Ayuda Contextual con F1
// Archivo: ayuda.js

// Mapeo de ayuda contextual por página y contexto
const ayudaContextual = {
    'index.html': {
        titulo: 'Página Principal',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-home text-info"></i> Bienvenido al Sistema POS</h4>
                <div class="alert alert-info">
                    <strong>¿Qué puedes hacer aquí?</strong>
                    <ul class="mb-0 mt-2">
                        <li><strong>Punto de Venta:</strong> Gestionar ventas, mesas y pedidos</li>
                        <li><strong>Administración:</strong> Configurar productos, clientes y reportes</li>
                        <li><strong>Inventario:</strong> Controlar stock y materias primas</li>
                    </ul>
                </div>
                
                <h5 class="mt-4">Acceso Rápido:</h5>
                <div class="row">
                    <div class="col-md-4">
                        <div class="card bg-dark border-info">
                            <div class="card-body text-center">
                                <i class="fas fa-cash-register fa-2x text-info mb-2"></i>
                                <h6>Punto de Venta</h6>
                                <small>Ventas, mesas, domicilios</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-dark border-warning">
                            <div class="card-body text-center">
                                <i class="fas fa-cog fa-2x text-warning mb-2"></i>
                                <h6>Administración</h6>
                                <small>Configuración y reportes</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-dark border-success">
                            <div class="card-body text-center">
                                <i class="fas fa-boxes fa-2x text-success mb-2"></i>
                                <h6>Inventario</h6>
                                <small>Stock y materias primas</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    
    'POS.html': {
        titulo: 'Punto de Venta',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-cash-register text-info"></i> Punto de Venta - Guía Completa</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-warning">📋 Gestión de Mesas Activas</h5>
                        <ul>
                            <li><strong>Nueva Mesa:</strong> Ingresa el número y presiona "Nueva Mesa"</li>
                            <li><strong>Mesas Activas:</strong> Solo aparecen las mesas con pedidos pendientes</li>
                            <li><strong>Seleccionar Mesa:</strong> Haz clic en cualquier mesa activa para ver su orden</li>
                            <li><strong>Colores de Mesas:</strong>
                                <ul>
                                    <li>🟠 <strong>Naranja:</strong> Mesas normales con pedidos</li>
                                    <li>🟢 <strong>Verde:</strong> Pedidos a domicilio (D1, D2...)</li>
                                    <li>🔵 <strong>Azul:</strong> Pedidos para recoger (R1, R2...)</li>
                                    <li>🟠 <strong>Naranja intenso:</strong> Mesa seleccionada actualmente</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h5 class="text-success">🚚 Pedidos Especiales</h5>
                        <ul>
                            <li><strong>Domicilio:</strong> Para entregas a domicilio con cliente</li>
                            <li><strong>Recoger:</strong> Para pedidos para llevar con cliente</li>
                            <li><strong>Cliente Nuevo:</strong> Se puede crear al momento</li>
                            <li><strong>Desaparición:</strong> Los pedidos desaparecen al generar el recibo final</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-primary">🛒 Agregar Productos</h5>
                        <ul>
                            <li><strong>Categorías:</strong> Filtra productos por tipo (se crean en Administración)</li>
                            <li><strong>Productos:</strong> Se crean en Administración, preferiblemente en MAYÚSCULAS</li>
                            <li><strong>Agregar:</strong> Haz clic en el producto</li>
                            <li><strong>Nombre y precio libres:</strong> Si la tarjeta dice “Nombre y precio libres”, escribe el nombre y el precio de esa venta (el catálogo no cambia)</li>
                            <li><strong>Modificaciones:</strong> Casillas como sin cebolla o extra queso, si el producto las tiene</li>
                            <li><strong>Salsas:</strong> Casillas aparte (Ají, Mayonesa…). Llegan a cocina como “Salsas: …”</li>
                            <li><strong>Cantidad:</strong> Se puede modificar en la orden</li>
                            <li><strong>Detalles:</strong> Notas libres para cocina</li>
                        </ul>
                        
                        <h5 class="text-info">💰 Procesar Venta</h5>
                        <ul>
                            <li><strong>Propina:</strong> Porcentaje automático</li>
                            <li><strong>Descuento:</strong> Monto fijo en pesos</li>
                            <li><strong>Domicilio:</strong> Costo de entrega; se resta en el cierre porque se paga al domiciliario</li>
                            <li><strong>Métodos de Pago:</strong> Efectivo, tarjeta, transferencia, crédito o mixto</li>
                        </ul>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-md-12">
                        <h5 class="text-success">⚡ Venta Rápida</h5>
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-warning">🚀 Características Principales</h6>
                                <ul>
                                    <li><strong>Sin ventana extra:</strong> Al tocar el producto entra directo a la orden</li>
                                    <li><strong>Vista Lateral:</strong> Cantidad, salsas, detalle de cocina y total a la derecha</li>
                                    <li><strong>Contador en Vivo:</strong> Ve cuántos productos has agregado</li>
                                    <li><strong>Total Dinámico:</strong> Se actualiza al cambiar cantidad o precio</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-primary">🎯 Cómo Usar</h6>
                                <ul>
                                    <li><strong>1. Abrir:</strong> Haz clic en "Venta Rápida"</li>
                                    <li><strong>2. Seleccionar:</strong> Elige categoría y toca el producto</li>
                                    <li><strong>3. Ajustar:</strong> En el panel derecho cambia cantidad, salsas o detalle</li>
                                    <li><strong>4. Procesar:</strong> "Procesar Venta" o "Limpiar Orden"</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="row mt-2">
                            <div class="col-md-6">
                                <h6 class="text-info">📱 Panel de Control</h6>
                                <ul>
                                    <li><strong>Salsas:</strong> Casillas en el ítem si el producto las tiene</li>
                                    <li><strong>Nombre y precio libres:</strong> Campos para escribirlos si el producto es editable</li>
                                    <li><strong>Detalle cocina:</strong> Notas libres en cada ítem</li>
                                    <li><strong>Total:</strong> Monto de la venta en vivo</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-warning">⚙️ Funciones Disponibles</h6>
                                <ul>
                                    <li><strong>Procesar Venta:</strong> Generar recibo y cobrar</li>
                                    <li><strong>Limpiar Orden:</strong> Reiniciar la venta</li>
                                    <li><strong>Ayuda:</strong> Presiona F1 dentro de venta rápida</li>
                                    <li><strong>Cancelar:</strong> Cerrar sin procesar</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="alert alert-warning mt-3">
                    <strong>💡 Consejos:</strong>
                    <ul class="mb-0 mt-2">
                        <li>Usa "Enviar a Cocina" para pedidos que requieren preparación</li>
                        <li>El "Recibo Preliminar" te permite revisar antes de cobrar</li>
                        <li>Los clientes se guardan automáticamente para futuras ventas</li>
                        <li>Al generar el recibo final, la mesa/pedido se elimina automáticamente</li>
                        <li>Las mesas solo aparecen cuando tienen productos agregados</li>
                        <li><strong>⚡ Venta Rápida:</strong> El producto entra directo a la orden; salsas y detalle se marcan a la derecha</li>
                        <li><strong>📱 Panel Lateral:</strong> En venta rápida, el panel derecho muestra la orden en tiempo real</li>
                        <li><strong>📝 Configuración:</strong> Categorías, productos, modificaciones, salsas y productos editables se crean en Administración</li>
                        <li><strong>📝 Nomenclatura:</strong> Los productos deben estar en MAYÚSCULAS para mejor visibilidad</li>
                        <li><strong>❓ Ayuda:</strong> F1 abre la guía de la pantalla actual (cierre, balance, POS…)</li>
                    </ul>
                </div>
            </div>
        `
    },
    
    'inventario.html': {
        titulo: 'Gestión de Inventario',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-boxes text-success"></i> Inventario - Control de Stock</h4>
                
                <div class="alert alert-warning">
                    <strong>📋 Tipos de Productos:</strong>
                    <ul class="mb-0 mt-2">
                        <li><strong>Productos Principales:</strong> Se crean en Administración/POS y se sincronizan automáticamente</li>
                        <li><strong>Componentes / Materia Prima:</strong> Se crean desde el botón "+Ingrediente/Insumo" y se asocian a uno o varios productos del POS (un mismo componente puede usarse en muchos productos)</li>
                    </ul>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-warning">📦 Productos Principales</h5>
                        <ul>
                            <li><strong>Origen:</strong> Se crean en Administración/POS</li>
                            <li><strong>Sincronización:</strong> Aparecen automáticamente en "Productos del POS"</li>
                            <li><strong>Tarjetas Verdes:</strong> Productos ya en inventario</li>
                            <li><strong>Tarjetas Amarillas:</strong> Productos faltantes</li>
                            <li><strong>Agregar Individual:</strong> Un producto a la vez</li>
                            <li><strong>Agregar Masivo:</strong> Todos los faltantes de una vez</li>
                            <li><strong>Descuento Automático:</strong> Se descuentan al vender</li>
                        </ul>
                        
                        <h5 class="text-info">🔧 Componentes / Materia Prima</h5>
                        <ul>
                            <li><strong>Creación:</strong> Botón "+Ingrediente/Insumo" (solo componentes)</li>
                            <li><strong>Asociación:</strong> Elige los productos del POS que llevan este componente (selección múltiple: Ctrl o Cmd + clic)</li>
                            <li><strong>Ejemplo:</strong> Empaques J1 → Café, Té, Jugo (un solo ítem en inventario; se descuenta al vender cualquiera)</li>
                            <li><strong>Descuento Automático:</strong> Se descuentan cuando se vende cualquiera de los productos que lo llevan</li>
                            <li><strong>Visualización:</strong> Aparecen en gris en la tabla; debajo del nombre se muestra "Usado en: Producto A, Producto B..."</li>
                            <li><strong>Cantidad por Unidad:</strong> Para gramos, litros, etc. (ej: 10g por café)</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-success">🔄 Sincronización y Descuentos</h5>
                        <ul>
                            <li><strong>Productos Principales:</strong> Se descuentan directamente al vender</li>
                            <li><strong>Componentes:</strong> Se descuentan automáticamente cuando se vende cualquiera de los productos asociados</li>
                            <li><strong>Unidades:</strong> Productos por unidad se descuentan 1:1</li>
                            <li><strong>Gramos/Litros:</strong> Usan "Cantidad por Unidad" para calcular descuentos</li>
                            <li><strong>Verificación:</strong> Stock antes de agregar</li>
                            <li><strong>Alertas:</strong> Stock insuficiente en tiempo real</li>
                        </ul>
                        
                        <h5 class="text-primary">⚙️ Gestión</h5>
                        <ul>
                            <li><strong>Filtros:</strong> Por categoría, estado, tipo (producto/componente)</li>
                            <li><strong>Editar:</strong> Modificar productos y componentes</li>
                            <li><strong>Ajustar Stock:</strong> Actualizar cantidades manualmente</li>
                            <li><strong>Eliminar:</strong> Quitar del inventario</li>
                            <li><strong>Exportar:</strong> Reportes en Excel</li>
                            <li><strong>Imprimir Tirilla:</strong> Lista general con productos y componentes agrupados</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-success mt-3">
                    <strong>💡 Flujo Recomendado:</strong>
                    <ol class="mb-0 mt-2">
                        <li><strong>Crear Productos:</strong> En Administración/POS (productos principales)</li>
                        <li><strong>Sincronizar:</strong> Refrescar productos del POS en Inventario</li>
                        <li><strong>Agregar al Inventario:</strong> Desde "Productos del POS"</li>
                        <li><strong>Crear Componentes:</strong> Usar "+Ingrediente/Insumo" y elegir los productos del POS que los llevan (puedes seleccionar varios)</li>
                        <li><strong>Configurar Stock:</strong> Establecer cantidades iniciales y límites</li>
                    </ol>
                </div>
                
                <div class="alert alert-info mt-3">
                    <strong>🔗 Integración con POS:</strong>
                    <ul class="mb-0 mt-2">
                        <li>Los productos del POS se sincronizan automáticamente como productos principales</li>
                        <li>El stock se descuenta automáticamente al procesar ventas</li>
                        <li>Los componentes se descuentan cuando se vende cualquiera de los productos que los llevan</li>
                        <li>Las alertas aparecen en tiempo real</li>
                        <li>La tirilla muestra productos principales con sus componentes agrupados (un componente compartido puede aparecer bajo varios productos)</li>
                    </ul>
                </div>
                
                <div class="mt-4">
                    <h5 class="text-primary mb-3"><i class="fas fa-mouse-pointer"></i> Guía de Botones y Funciones</h5>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h6 class="text-success">🔘 Botones Principales (Barra Superior)</h6>
                            <div class="card bg-dark border-success mb-3">
                                <div class="card-body">
                                    <ul class="mb-0">
                                        <li><strong><i class="fas fa-plus text-success"></i> Ingrediente / Insumo:</strong><br>
                                            <small>Crea un nuevo componente/materia prima. Elige los productos del POS que lo llevan (selección múltiple con Ctrl o Cmd). Un mismo componente puede usarse en varios productos con un solo stock.</small></li>
                                        <li><strong><i class="fas fa-file-excel text-info"></i> Exportar a Excel:</strong><br>
                                            <small>Genera un archivo Excel con todo el inventario actual, incluyendo productos principales y componentes, con sus stocks y categorías.</small></li>
                                        <li><strong><i class="fas fa-print text-success"></i> Imprimir Tirilla Inventario:</strong><br>
                                            <small>Genera una tirilla de impresión con todos los productos y componentes agrupados. Los componentes aparecen debajo de cada producto que los utiliza.</small></li>
                                        <li><strong><i class="fas fa-refresh text-warning"></i> Refrescar Productos POS:</strong><br>
                                            <small>Actualiza la lista de productos del POS. Úsalo después de crear nuevos productos en Administración para verlos en la sección "Productos del POS".</small></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <h6 class="text-info">🔘 Botones de Información y Navegación</h6>
                            <div class="card bg-dark border-info mb-3">
                                <div class="card-body">
                                    <ul class="mb-0">
                                        <li><strong><i class="fas fa-chart-line text-secondary"></i> Reporte Movimientos:</strong><br>
                                            <small>Muestra un reporte detallado de todos los movimientos de inventario (entradas y salidas) en un rango de fechas. Permite exportar a Excel.</small></li>
                                        <li><strong><i class="fas fa-info-circle text-info"></i> Info Integración:</strong><br>
                                            <small>Muestra información detallada sobre cómo funciona la integración entre el POS y el Inventario, flujos de trabajo recomendados y configuraciones.</small></li>
                                        <li><strong><i class="fas fa-arrow-left text-light"></i> Volver al POS:</strong><br>
                                            <small>Regresa a la pantalla principal del Punto de Venta.</small></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <h6 class="text-warning">🔘 Filtros de Búsqueda</h6>
                            <div class="card bg-dark border-warning mb-3">
                                <div class="card-body">
                                    <ul class="mb-0">
                                        <li><strong>Buscar producto:</strong><br>
                                            <small>Campo de texto para buscar productos por nombre o código. Busca en tiempo real mientras escribes.</small></li>
                                        <li><strong>Filtro Categoría:</strong><br>
                                            <small>Filtra productos por categoría. Selecciona una categoría específica o "Todas las categorías" para ver todo.</small></li>
                                        <li><strong>Filtro Tipo:</strong><br>
                                            <small>Filtra por tipo: "Productos Principales" o "Componentes / Materia Prima". Útil para separar visualmente.</small></li>
                                        <li><strong>Filtro Estado:</strong><br>
                                            <small>Filtra por estado de stock: "Stock Bajo", "Stock Normal" o "Stock Alto". Ayuda a identificar productos que necesitan reposición.</small></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <h6 class="text-danger">🔘 Botones de Acción en la Tabla</h6>
                            <div class="card bg-dark border-danger mb-3">
                                <div class="card-body">
                                    <ul class="mb-0">
                                        <li><strong><i class="fas fa-edit text-warning"></i> Editar (Amarillo):</strong><br>
                                            <small>Abre el formulario para editar el producto o componente. Puedes modificar nombre, categoría, stocks, unidad de medida, y para componentes cambiar los productos del POS que lo llevan (selección múltiple).</small></li>
                                        <li><strong><i class="fas fa-boxes text-info"></i> Ajustar Stock (Azul):</strong><br>
                                            <small>Permite ajustar manualmente el stock actual del producto. Útil para correcciones, inventarios físicos o ajustes de pérdidas/ganancias.</small></li>
                                        <li><strong><i class="fas fa-trash text-danger"></i> Eliminar (Rojo):</strong><br>
                                            <small>Elimina el producto o componente del inventario. Se solicita confirmación antes de eliminar. Ten cuidado, esta acción no se puede deshacer.</small></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <h6 class="text-primary">📋 Sección "Productos del POS"</h6>
                            <div class="card bg-dark border-primary mb-3">
                                <div class="card-body">
                                    <p class="mb-2">Esta sección muestra todos los productos creados en Administración/POS:</p>
                                    <ul class="mb-0">
                                        <li><strong>Tarjetas Verdes:</strong> Productos que ya están en el inventario. Muestra el estado "En Inventario".</li>
                                        <li><strong>Tarjetas Amarillas:</strong> Productos que aún no están en el inventario. Muestra el estado "Falta en Inventario".</li>
                                        <li><strong>Botón "Agregar al Inventario":</strong> Solo aparece en productos faltantes. Agrega el producto al inventario con stock inicial en 0.</li>
                                        <li><strong>Filtro "Solo Faltantes":</strong> Muestra únicamente los productos que aún no están en inventario, facilitando la gestión.</li>
                                        <li><strong>Botón "Agregar Productos del POS":</strong> En el modal de información, permite agregar todos los productos faltantes de una vez.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <h6 class="text-success">🏷️ Indicadores Visuales en la Tabla</h6>
                            <div class="card bg-dark border-success mb-3">
                                <div class="card-body">
                                    <ul class="mb-0">
                                        <li><strong>Filas Grises:</strong> Indican componentes/materia prima. Se muestran separadas de los productos principales.</li>
                                        <li><strong>Badge "Componente":</strong> Aparece en gris junto al estado, identificando componentes.</li>
                                        <li><strong>Badge Rojo "Bajo":</strong> Stock actual está en o por debajo del stock mínimo. Necesita reposición urgente.</li>
                                        <li><strong>Badge Amarillo "Normal":</strong> Stock está entre el mínimo y máximo. Estado saludable.</li>
                                        <li><strong>Badge Verde "Alto":</strong> Stock está cerca o en el máximo. Buen nivel de inventario.</li>
                                        <li><strong>"Usado en: [Producto A, Producto B, ...]":</strong> Texto debajo del nombre del componente que indica en qué productos del POS se utiliza (puede ser uno o varios).</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert alert-warning mt-3">
                        <strong>💡 Consejos de Uso:</strong>
                        <ul class="mb-0 mt-2">
                            <li>Usa los filtros para encontrar rápidamente productos específicos o identificar stock bajo</li>
                            <li>Revisa regularmente el "Reporte Movimientos" para llevar un control detallado</li>
                            <li>Exporta a Excel periódicamente para tener respaldos de tu inventario</li>
                            <li>La tirilla de impresión es útil para inventarios físicos o entregas a proveedores</li>
                            <li>Recuerda refrescar productos del POS después de crear nuevos productos en Administración</li>
                        </ul>
                    </div>
                </div>
            </div>
        `
    },
    
    'admon.html': {
        titulo: 'Administración',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-cog text-warning"></i> Administración</h4>
                <div class="alert alert-info">
                    Aquí configuras el negocio, el menú, el equipo, los PIN, la facturación electrónica (solo el contador) y las copias de seguridad. Los cambios de productos, cocina y botones del POS se ven en todos los equipos de este restaurante.
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-info"><i class="fas fa-lock me-1"></i> Entrar y recuperar PIN</h5>
                        <ul>
                            <li>Esta pantalla pide el <strong>PIN de Administración</strong> (4 dígitos).</li>
                            <li><strong>Olvidé el PIN:</strong> escribe la contraseña de la cuenta. Si es correcta, aparece el PIN para entrar.</li>
                            <li>El PIN no se muestra hasta confirmar la contraseña.</li>
                        </ul>

                        <h5 class="text-warning"><i class="fas fa-clock me-1"></i> Horario de operación</h5>
                        <ul>
                            <li>Si cierras después de medianoche, actívalo para que el día de ventas no cambie a las 12:00.</li>
                            <li>Indica la hora de fin del día laboral (ej. 4 = 4:00 a.m.) y guarda.</li>
                        </ul>

                        <h5 class="text-info">👥 Clientes</h5>
                        <ul>
                            <li>Agrega documento, nombre, teléfono, dirección y correo.</li>
                            <li>Busca en la lista, edita con el lápiz o elimina los seleccionados.</li>
                        </ul>

                        <h5 class="text-primary">🏷️ Categorías</h5>
                        <ul>
                            <li>Crea las categorías del menú (ej. COMIDAS, BEBIDAS).</li>
                            <li>Edítalas o elimina las que ya no uses. Cada producto debe tener una.</li>
                        </ul>

                        <h5 class="text-success">📦 Productos</h5>
                        <ul>
                            <li><strong>Nombre y precio:</strong> escribe el precio en números, sin puntos (ej. 12800). El costo es opcional, para utilidad.</li>
                            <li><strong>Imagen:</strong> pega la URL. El botón de ayuda explica cómo copiarla en el celular.</li>
                            <li><strong>Modificaciones:</strong> una por línea (sin cebolla, extra queso). En venta salen como casillas.</li>
                            <li><strong>Salsas:</strong> lista aparte (Ají, Mayonesa). No se mezclan con las modificaciones.</li>
                            <li><strong>Nombre y precio editables:</strong> el cajero los cambia al vender (producto comodín).</li>
                            <li>Usa <strong>MAYÚSCULAS</strong> para que se lean bien en el POS y en cocina.</li>
                        </ul>

                        <h5 class="text-primary"><i class="fas fa-store me-1"></i> Logo y datos del negocio</h5>
                        <ul>
                            <li><strong>Logo:</strong> JPG, PNG o GIF, máximo 500 KB. Se usa en impresión.</li>
                            <li><strong>Datos del negocio:</strong> nombre, NIT, dirección, correo y teléfono. Salen en tickets y facturas.</li>
                        </ul>

                        <h5 class="text-info"><i class="fas fa-tv me-1"></i> Cocina, mesero e impresora</h5>
                        <ul>
                            <li><strong>Pantalla de cocina:</strong> actívala solo si vas a usarla. Puedes poner sonido y abrirla ya.</li>
                            <li><strong>Imprimir desde el celular del mesero:</strong> es <strong>opcional</strong>. Si lo dejas apagado, el pedido del mesero se imprime en la caja principal, sin entrar a Historial. Si el negocio no usa meseros y todo se toma en caja, déjalo apagado: no hay que poner IP.</li>
                            <li>Si sí usan la app de mesero y una térmica de red en cocina, enciende esa opción, pon la <strong>IP</strong> (puerto casi siempre <strong>9100</strong>) y guarda.</li>
                            <li>En cada celular Android instala <strong>RawBT</strong> (gratis). En RawBT agrega la impresora por <strong>WiFi / Ethernet</strong> con la misma IP y déjala predeterminada. El ticket sale y <strong>corta el papel</strong>.</li>
                            <li>El celular y la térmica deben estar en la <strong>misma WiFi</strong>. Una Epson de escritorio (L4160 y similares) no es la térmica de cocina: esa sale por el diálogo de Android.</li>
                            <li>Con la IP configurada, al enviar a cocina el ticket sale desde el celular. Si no sale, en caja aparece <strong>Imprimir en esta caja</strong>. Sin IP, la caja imprime sola.</li>
                            <li><strong>Botones del POS:</strong> oculta Gastos, Inventario, Cierre administrativo o Balance si el cajero no los necesita.</li>
                        </ul>
                    </div>

                    <div class="col-md-6">
                        <h5 class="text-warning"><i class="fas fa-users me-1"></i> Equipo del negocio</h5>
                        <ul>
                            <li><strong>Copiar enlace:</strong> envía ese link al mesero. Ya no hay botón de Mesero en el inicio del POS.</li>
                            <li><strong>Agregar:</strong> nombre, sexo, correo y contraseña (mínimo 6 caracteres). El sexo hace que la app diga Mesero o Mesera. El nombre sale en el ticket de cocina.</li>
                            <li>Entra con ese correo y contraseña. Puede mesa, domicilio, recoger e imprimir ticket de cocina. No cobra.</li>
                            <li><strong>Lápiz:</strong> cambia nombre o contraseña. El correo no se cambia.</li>
                            <li><strong>Basura:</strong> quita al mesero de este negocio. Queda en verde un momento al agregarlo o editarlo.</li>
                            <li>Cada correo queda ligado a <strong>este</strong> restaurante. No ve datos de otro negocio.</li>
                        </ul>

                        <h5 class="text-warning"><i class="fas fa-cash-register me-1"></i> Punto de Venta</h5>
                        <ul>
                            <li><strong>Pedir correo y contraseña:</strong> apagado, el POS entra directo con la sesión de administración. Encendido, la caja entra en /pos con la cuenta que crees aquí.</li>
                            <li><strong>Copiar enlace:</strong> envía <strong>ultimate.toysoft.co/pos</strong> a la caja. Esa cuenta solo trabaja el POS, no entra a Administración.</li>
                            <li><strong>Agregar:</strong> nombre del punto de venta, correo y contraseña (mínimo 6 caracteres).</li>
                            <li>Entra con ese correo y contraseña. Cobra, mesas, cocina e historial. Los PIN de cada módulo siguen valiendo.</li>
                            <li><strong>Lápiz / Basura:</strong> igual que en meseros. El correo no se cambia.</li>
                        </ul>

                        <h5 class="text-warning"><i class="fas fa-user-tie me-1"></i> Propietario</h5>
                        <ul>
                            <li><strong>Copiar enlace:</strong> envía <strong>ultimate.toysoft.co/propietario</strong> al dueño. Esa cuenta solo consulta el negocio en el celular.</li>
                            <li><strong>Agregar:</strong> nombre, correo y contraseña (mínimo 6 caracteres).</li>
                            <li>Ve balance, gastos, inventario bajo y cierres en tiempo real. No cobra, no toca menú ni Administración.</li>
                            <li>El administrador también puede entrar ahí con su misma cuenta para ver el panel en el teléfono.</li>
                            <li><strong>Lápiz / Basura:</strong> igual que en meseros. El correo no se cambia.</li>
                        </ul>

                        <h5 class="text-success"><i class="fas fa-key me-1"></i> PIN por módulo</h5>
                        <ul>
                            <li>Cada área tiene su PIN: Administración, Inventario, Historial, Gastos, Cierre y Balance.</li>
                            <li>Se guarda cifrado en la nube y aplica en todos los equipos de este negocio.</li>
                            <li>De fábrica: <strong>0011</strong> esta pantalla y <strong>0000</strong> los demás, hasta que los cambies.</li>
                        </ul>

                        <h5 class="text-danger"><i class="fas fa-file-invoice me-1"></i> Facturación electrónica</h5>
                        <ul>
                            <li>Está al final, <strong>antes de Backup</strong>. Va <strong>cerrada con un +</strong>.</li>
                            <li><strong>Usted no la diligencia.</strong> La abre y completa el <strong>contador público</strong> con la resolución de la DIAN (Formato 1876): prefijo, rangos, vigencia y consecutivos.</li>
                            <li>Al abrirla aparece un aviso rojo: si administra el restaurante y no es el contador, pulse − y no cambie nada.</li>
                            <li>Todavía <strong>no se envían documentos a la DIAN</strong>. El cobro del POS no cambia.</li>
                        </ul>

                        <h5 class="text-info"><i class="fas fa-database me-1"></i> Backup y Restauración</h5>
                        <ul>
                            <li>Está abajo, justo antes de Herramientas del sistema.</li>
                            <li><strong>Exportar datos:</strong> descarga una copia de seguridad en este dispositivo. Guárdala en un lugar seguro.</li>
                            <li><strong>Importar datos:</strong> restaura desde un archivo. Reemplaza datos: úsalo con cuidado.</li>
                            <li>Haz backup <strong>antes</strong> de borrar datos contables o de reiniciar el sistema.</li>
                        </ul>

                        <h5 class="text-danger"><i class="fas fa-tools me-1"></i> Herramientas del sistema</h5>
                        <ul>
                            <li>Es lo <strong>último</strong> de esta pantalla.</li>
                            <li><strong>Borrar datos contables:</strong> quita ventas, gastos, créditos y cierres. Deja categorías, productos y clientes. Sirve después de una demostración o pruebas.</li>
                            <li><strong>Limpiar datos temporales:</strong> solo si la app se traba (mesas, ventas del día, cocina).</li>
                            <li><strong>Reiniciar sistema:</strong> borra todo, incluido el menú y los clientes. No lo uses salvo que quieras empezar de cero.</li>
                            <li>Borrar datos contables y Reiniciar sistema piden el <strong>PIN actual de administrador</strong>, recomiendan hacer Backup y avisan que ToySoft no se hace responsable de la pérdida de información.</li>
                        </ul>
                    </div>
                </div>

                <div class="alert alert-danger mt-3">
                    <strong>Importante:</strong>
                    <ul class="mb-0 mt-2">
                        <li>Los productos nuevos o editados se ven de inmediato en caja y en mesero.</li>
                        <li>Facturación electrónica es del <strong>contador</strong>, no del administrador del restaurante.</li>
                        <li>No uses <em>Reiniciar sistema</em> ni <em>Borrar datos contables</em> sin hacer antes un Backup. ToySoft no se hace responsable de la pérdida de información por esos reinicios.</li>
                    </ul>
                </div>
            </div>
        `
    },
    
    'gastos.html': {
        titulo: 'Gestión de Gastos',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-receipt text-danger"></i> Gestión de Gastos - Control Financiero</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-warning">➕ Registrar Gastos</h5>
                        <ul>
                            <li><strong>Descripción:</strong> Detalle del gasto</li>
                            <li><strong>Monto:</strong> Cantidad en pesos</li>
                            <li><strong>Categoría:</strong> Tipo de gasto</li>
                            <li><strong>Forma de pago:</strong> Efectivo, transferencia o crédito con el proveedor</li>
                        </ul>
                        
                        <h5 class="text-info">📋 Gestión de Gastos</h5>
                        <ul>
                            <li><strong>Ver Todos:</strong> Lista completa de gastos</li>
                            <li><strong>Modificar:</strong> Editar gastos existentes</li>
                            <li><strong>Eliminar:</strong> Quitar gastos incorrectos</li>
                            <li><strong>Pagar crédito:</strong> Cuando se le pague al proveedor</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-success">📊 Cómo afecta el cierre</h5>
                        <ul>
                            <li><strong>Efectivo:</strong> Sale de la caja y se resta del balance</li>
                            <li><strong>Al contado, no sale de caja:</strong> Ya se pagó (transferencia, Nequi, cuenta del negocio o del dueño), pero no con el efectivo de la caja</li>
                            <li><strong>Crédito proveedor:</strong> No sale de caja ni del balance hasta que registres el pago</li>
                        </ul>
                        
                        <h5 class="text-primary">🔗 Integración</h5>
                        <ul>
                            <li><strong>Cierre de Caja:</strong> Solo resta de efectivo lo que sí salió de caja</li>
                            <li><strong>Cuentas por pagar:</strong> Las compras a crédito quedan pendientes hasta el pago</li>
                            <li><strong>Balance:</strong> Incluye efectivo, transferencias y créditos ya pagados</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-info mt-3">
                    <strong>💡 Consejos:</strong>
                    <ul class="mb-0 mt-2">
                        <li>Si compras la carne de la semana por transferencia o a crédito, el cierre del día no queda en negativo por esa compra</li>
                        <li>Registra los gastos inmediatamente para mayor precisión</li>
                        <li>Usa descripciones claras para facilitar el análisis</li>
                    </ul>
                </div>
            </div>
        `
    },
    
    'historial.html': {
        titulo: 'Historial de Ventas',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-history text-primary"></i> Historial de Ventas - Registro Completo</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-info">📋 Ver Ventas</h5>
                        <ul>
                            <li><strong>Filtros:</strong> Por fecha, método de pago, cliente</li>
                            <li><strong>Búsqueda:</strong> Por número de factura o cliente</li>
                            <li><strong>Detalles:</strong> Ver productos de cada venta</li>
                            <li><strong>Cierres administrativos:</strong> piden el mismo PIN de Cierre administrativo.</li>
                        </ul>
                        
                        <h5 class="text-success">📊 Estadísticas</h5>
                        <ul>
                            <li><strong>Ventas Totales:</strong> Por período</li>
                            <li><strong>Métodos de Pago:</strong> Distribución</li>
                            <li><strong>Productos Populares:</strong> Más vendidos</li>
                            <li><strong>Clientes Frecuentes:</strong> Mejores clientes</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-warning">🖨️ Impresión</h5>
                        <ul>
                            <li><strong>Factura Individual:</strong> Reimprimir venta específica</li>
                            <li><strong>Reporte de Ventas:</strong> Resumen por período</li>
                            <li><strong>Exportar Excel:</strong> Datos para análisis</li>
                            <li><strong>Configuración:</strong> Formato de impresión</li>
                        </ul>
                        
                        <h5 class="text-primary">🔍 Información Detallada</h5>
                        <ul>
                            <li><strong>Fecha y Hora:</strong> Cuándo se realizó</li>
                            <li><strong>Mesa/Cliente:</strong> A quién se vendió</li>
                            <li><strong>Productos:</strong> Lista completa</li>
                            <li><strong>Totales:</strong> Subtotal, propina, descuento</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-warning mt-3">
                    <strong>📈 Análisis de Datos:</strong>
                    <ul class="mb-0 mt-2">
                        <li>Usa los filtros para analizar tendencias de ventas</li>
                        <li>Identifica productos más y menos populares</li>
                        <li>Monitorea el rendimiento por método de pago</li>
                    </ul>
                </div>
            </div>
        `
    },
    
    'cotizaciones': {
        titulo: 'Gestión de Cotizaciones',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-file-invoice text-info"></i> Cotizaciones - Presupuestos y Propuestas</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-warning">📝 Crear Cotización</h5>
                        <ul>
                            <li><strong>Cliente:</strong> Seleccionar cliente existente o crear nuevo</li>
                            <li><strong>Fecha:</strong> Fecha de la cotización (por defecto hoy)</li>
                            <li><strong>Productos:</strong> Agregar items desde el catálogo</li>
                            <li><strong>Cantidades:</strong> Especificar cantidades para cada producto</li>
                            <li><strong>Precios:</strong> Se calculan automáticamente</li>
                        </ul>
                        
                        <h5 class="text-success">🛒 Agregar Productos</h5>
                        <ul>
                            <li><strong>Categorías:</strong> Filtrar por tipo de producto</li>
                            <li><strong>Búsqueda:</strong> Buscar productos por nombre</li>
                            <li><strong>Selección:</strong> Hacer clic en el producto deseado</li>
                            <li><strong>Cantidad:</strong> Modificar cantidad en la lista</li>
                            <li><strong>Eliminar:</strong> Quitar productos no deseados</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-info">📋 Gestión de Cotizaciones</h5>
                        <ul>
                            <li><strong>Ver Todas:</strong> Lista completa de cotizaciones</li>
                            <li><strong>Buscar:</strong> Por cliente o fecha</li>
                            <li><strong>Editar:</strong> Modificar cotizaciones existentes</li>
                            <li><strong>Eliminar:</strong> Quitar cotizaciones obsoletas</li>
                            <li><strong>Duplicar:</strong> Crear nueva basada en existente</li>
                        </ul>
                        
                        <h5 class="text-primary">🖨️ Impresión y Envío</h5>
                        <ul>
                            <li><strong>Vista Previa:</strong> Revisar antes de imprimir</li>
                            <li><strong>Imprimir:</strong> Generar documento físico</li>
                            <li><strong>PDF:</strong> Exportar como archivo digital</li>
                            <li><strong>Enviar:</strong> Compartir por email o WhatsApp</li>
                            <li><strong>Guardar:</strong> Almacenar para referencia futura</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-info mt-3">
                    <strong>💡 Flujo de Trabajo Recomendado:</strong>
                    <ol class="mb-0 mt-2">
                        <li><strong>Crear Cotización:</strong> Selecciona cliente y fecha</li>
                        <li><strong>Agregar Productos:</strong> Busca y selecciona items</li>
                        <li><strong>Revisar Total:</strong> Verifica cantidades y precios</li>
                        <li><strong>Guardar:</strong> Almacena la cotización</li>
                        <li><strong>Imprimir/Enviar:</strong> Comparte con el cliente</li>
                        <li><strong>Seguimiento:</strong> Convierte a venta cuando se apruebe</li>
                    </ol>
                </div>
                
                <div class="alert alert-warning mt-3">
                    <strong>⚠️ Diferencias con Ventas:</strong>
                    <ul class="mb-0 mt-2">
                        <li><strong>Cotizaciones:</strong> Son propuestas, no ventas reales</li>
                        <li><strong>No afectan inventario:</strong> No descuentan stock</li>
                        <li><strong>Precios estimados:</strong> Pueden cambiar antes de la venta</li>
                        <li><strong>Vigencia:</strong> Tienen fecha de expiración</li>
                        <li><strong>Conversión:</strong> Se pueden convertir a venta cuando se apruebe</li>
                    </ul>
                </div>
                
                <div class="row mt-4">
                    <div class="col-12">
                        <h5 class="text-success">🎯 Beneficios de las Cotizaciones</h5>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card bg-dark border-success">
                                    <div class="card-body text-center">
                                        <i class="fas fa-handshake fa-2x text-success mb-2"></i>
                                        <h6>Profesionalismo</h6>
                                        <small>Presenta propuestas formales</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-dark border-info">
                                    <div class="card-body text-center">
                                        <i class="fas fa-clock fa-2x text-info mb-2"></i>
                                        <h6>Planificación</h6>
                                        <small>Anticipa necesidades</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-dark border-warning">
                                    <div class="card-body text-center">
                                        <i class="fas fa-chart-line fa-2x text-warning mb-2"></i>
                                        <h6>Seguimiento</h6>
                                        <small>Monitorea oportunidades</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    
    'cierre-caja': {
        titulo: 'Cierre de Caja',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-calculator text-success"></i> Cierre de Caja - Control Financiero Diario</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-info">📅 Rango de ventas</h5>
                        <ul>
                            <li><strong>Desde el último cierre:</strong> Opción por defecto. Trae el turno abierto, aunque las ventas sean de anoche</li>
                            <li><strong>Todo el día laboral:</strong> Solo el día de hoy (o el día laboral si operan después de medianoche)</li>
                            <li><strong>Aviso:</strong> Si el día laboral sale en 0 y hay ventas de anoche, el sistema te lo indica</li>
                        </ul>
                        
                        <h5 class="text-info">💰 Resumen de Ventas</h5>
                        <ul>
                            <li><strong>Total Ventas:</strong> Incluye lo cobrado al cliente por domicilio</li>
                            <li><strong>Efectivo / Transferencia / Tarjeta / Crédito</strong></li>
                            <li><strong>Mixto:</strong> Ya está desglosado en efectivo y transferencia; no se suma otra vez</li>
                        </ul>
                        
                        <h5 class="text-warning">🚚 Domicilios a restar</h5>
                        <ul>
                            <li><strong>No es otra venta:</strong> El valor ya está en el total de ventas</li>
                            <li><strong>Se resta:</strong> Porque se le paga al domiciliario, no se queda en el negocio</li>
                            <li><strong>Por domiciliario:</strong> El cierre muestra cuánto corresponde a cada uno</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-success">💵 Efectivo que queda en caja</h5>
                        <ul>
                            <li><strong>Efectivo en caja:</strong> Base anterior + efectivo cobrado − gastos en efectivo − domicilios en efectivo o mixto − propinas en efectivo o mixto</li>
                        <li><strong>Gastos por transferencia o crédito:</strong> No se restan de la caja física</li>
                            <li><strong>Domicilio por transferencia:</strong> No se resta de la caja física, porque no entró en efectivo</li>
                            <li><strong>La base:</strong> Es dinero que ya estaba en caja, no una venta del día</li>
                        </ul>
                        
                        <h5 class="text-primary">📊 Balance del restaurante</h5>
                        <ul>
                            <li><strong>Fórmula:</strong> Ventas − Propinas − Gastos − Domicilios (pago a domiciliarios)</li>
                            <li><strong>La base no entra aquí:</strong> Solo afecta el efectivo físico</li>
                        </ul>
                        
                        <h5 class="text-warning">👥 Información del Cierre</h5>
                        <ul>
                            <li><strong>Quien Cierra / Quien Recibe</strong></li>
                            <li><strong>Monto base para el siguiente cierre:</strong> Se sugiere la base anterior; el valor que dejes se suma en el próximo cierre</li>
                            <li>Puedes hacer varios cierres el mismo día; cada uno queda con su hora y su base</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-success mt-3">
                    <strong>💡 Proceso de Cierre Recomendado:</strong>
                    <ol class="mb-0 mt-2">
                        <li><strong>Elegir el rango:</strong> Normalmente “Solo desde el último cierre”</li>
                        <li><strong>Revisar ventas</strong> por método de pago y ventas rápidas</li>
                        <li><strong>Confirmar domicilios a restar</strong> y gastos</li>
                        <li><strong>Contar el efectivo</strong> contra “Efectivo en caja”</li>
                        <li><strong>Completar nombres</strong> y la base que se deja</li>
                        <li><strong>Guardar e imprimir</strong></li>
                    </ol>
                </div>
                
                <div class="alert alert-warning mt-3">
                    <strong>⚠️ Importante:</strong>
                    <ul class="mb-0 mt-2">
                        <li>Si anoche ya se guardó un cierre, esas ventas no salen aquí; míralas en Balance con la fecha de ayer</li>
                        <li><strong>Base Caja:</strong> El monto que dejes se suma al efectivo del siguiente cierre</li>
                        <li><strong>Documentación:</strong> Guarda la copia impresa</li>
                    </ul>
                </div>
                
                <div class="row mt-4">
                    <div class="col-12">
                        <h5 class="text-info">🎯 Beneficios del Cierre de Caja</h5>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card bg-dark border-success">
                                    <div class="card-body text-center">
                                        <i class="fas fa-chart-bar fa-2x text-success mb-2"></i>
                                        <h6>Control Financiero</h6>
                                        <small>Monitoreo diario de ingresos</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-dark border-warning">
                                    <div class="card-body text-center">
                                        <i class="fas fa-shield-alt fa-2x text-warning mb-2"></i>
                                        <h6>Seguridad</h6>
                                        <small>Control de efectivo</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-dark border-info">
                                    <div class="card-body text-center">
                                        <i class="fas fa-file-alt fa-2x text-info mb-2"></i>
                                        <h6>Documentación</h6>
                                        <small>Registro histórico</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    
    'cierre-operativo': {
        titulo: 'Cierre Operativo',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-user-clock text-success"></i> Cierre Operativo - Control de Turnos</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-info">👤 Información del Empleado</h5>
                        <ul>
                            <li><strong>Nombre:</strong> Nombre completo del empleado</li>
                            <li><strong>Cargo:</strong> Función específica en el negocio</li>
                            <li><strong>Horario:</strong> Hora de inicio y fin del turno</li>
                            <li><strong>Responsabilidad:</strong> Áreas bajo su cuidado</li>
                        </ul>
                        
                        <h5 class="text-warning">✅ Checklist de Cierre</h5>
                        <ul>
                            <li><strong>Limpieza:</strong> Área de trabajo limpia y ordenada</li>
                            <li><strong>Inventario:</strong> Verificación de productos disponibles</li>
                            <li><strong>Equipos:</strong> Apagado correcto de máquinas</li>
                            <li><strong>Seguridad:</strong> Verificación de puertas y alarmas</li>
                            <li><strong>Mesas:</strong> Organización y limpieza de mesas</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-danger">📝 Documentación del Turno</h5>
                        <ul>
                            <li><strong>Observaciones:</strong> Incidentes o eventos importantes</li>
                            <li><strong>Tareas Pendientes:</strong> Trabajos para el siguiente turno</li>
                            <li><strong>Problemas:</strong> Reportar cualquier inconveniente</li>
                            <li><strong>Sugerencias:</strong> Mejoras para el proceso</li>
                        </ul>
                        
                        <h5 class="text-success">💰 Totales de Ventas (Opcional)</h5>
                        <ul>
                            <li><strong>Ingreso Manual:</strong> El empleado puede registrar totales de ventas</li>
                            <li><strong>Efectivo:</strong> Total de ventas en efectivo del turno</li>
                            <li><strong>Transferencia:</strong> Total de ventas por transferencia</li>
                            <li><strong>Tarjeta:</strong> Total de ventas con tarjeta</li>
                            <li><strong>Cálculo Automático:</strong> El total general se calcula automáticamente</li>
                        </ul>
                        
                        <h5 class="text-primary">🎯 Propósito del Cierre Operativo</h5>
                        <ul>
                            <li><strong>Totales Manuales:</strong> El empleado puede ingresar totales de ventas si lo desea</li>
                            <li><strong>Control Operativo:</strong> Gestión de tareas y responsabilidades</li>
                            <li><strong>Comunicación:</strong> Información para el siguiente turno</li>
                            <li><strong>Responsabilidad:</strong> Verificación de cumplimiento</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-success mt-3">
                    <strong>💡 Proceso de Cierre Operativo:</strong>
                    <ol class="mb-0 mt-2">
                        <li><strong>Completar Checklist:</strong> Verificar todas las tareas</li>
                        <li><strong>Registrar Información:</strong> Datos del empleado y horario</li>
                        <li><strong>Documentar Observaciones:</strong> Notas importantes del turno</li>
                        <li><strong>Listar Pendientes:</strong> Tareas para el siguiente turno</li>
                        <li><strong>Guardar e Imprimir:</strong> Documentar el cierre operativo</li>
                    </ol>
                </div>
                
                <div class="alert alert-warning mt-3">
                    <strong>⚠️ Diferencias con Cierre de Caja:</strong>
                    <ul class="mb-0 mt-2">
                        <li><strong>Totales Manuales:</strong> El empleado ingresa los totales si lo desea</li>
                        <li><strong>Enfoque Operativo:</strong> Control de tareas y responsabilidades</li>
                        <li><strong>Para Empleados:</strong> Uso diario de personal operativo</li>
                        <li><strong>Checklist:</strong> Verificación de cumplimiento de tareas</li>
                        <li><strong>Comunicación:</strong> Información entre turnos</li>
                    </ul>
                </div>
                
                <div class="row mt-4">
                    <div class="col-12">
                        <h5 class="text-info">🎯 Beneficios del Cierre Operativo</h5>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card bg-dark border-success">
                                    <div class="card-body text-center">
                                        <i class="fas fa-clipboard-check fa-2x text-success mb-2"></i>
                                        <h6>Control de Tareas</h6>
                                        <small>Verificación de cumplimiento</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-dark border-warning">
                                    <div class="card-body text-center">
                                        <i class="fas fa-users fa-2x text-warning mb-2"></i>
                                        <h6>Comunicación</h6>
                                        <small>Información entre turnos</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-dark border-info">
                                    <div class="card-body text-center">
                                        <i class="fas fa-file-alt fa-2x text-info mb-2"></i>
                                        <h6>Documentación</h6>
                                        <small>Registro de responsabilidades</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },

    'balance': {
        titulo: 'Balance',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-balance-scale text-info"></i> Balance - Resumen del periodo</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-info">📅 Periodo</h5>
                        <ul>
                            <li><strong>Diario, semanal, mensual o anual</strong> según la fecha que elijas</li>
                            <li>Muestra ventas, gastos, créditos y domicilios de ese periodo</li>
                        </ul>
                        
                        <h5 class="text-success">🛒 Ventas por tipo</h5>
                        <ul>
                            <li>Mesas, Domicilios, Recoger y Venta rápida</li>
                            <li>Toca <strong>Ver productos</strong> en cada tipo para ver el detalle; el botón pasa a <strong>Ocultar</strong></li>
                        </ul>
                        
                        <h5 class="text-warning">👤 Ventas por mesero</h5>
                        <ul>
                            <li>Muestra cuánto vendió cada mesero en el periodo</li>
                            <li>Las ventas hechas en caja, sin mesero, salen como <strong>Caja (POS)</strong></li>
                            <li>Toca el nombre para ver los productos de ese mesero</li>
                        </ul>
                        
                        <h5 class="text-warning">🚚 Domicilios</h5>
                        <ul>
                            <li>Se restan del balance porque se pagan al domiciliario</li>
                            <li>Aparecen agrupados por domiciliario</li>
                        </ul>
                        
                        <h5 class="text-info">🤝 Propinas</h5>
                        <ul>
                            <li>Se restan del balance porque son dinero del personal</li>
                            <li>En el cierre también se restan del efectivo si se cobraron en efectivo o mixto</li>
                        </ul>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="text-success">💵 Bases de caja por cierre</h5>
                        <ul>
                            <li>Cada cierre del periodo sale con hora, quién entregó y quién recibió</li>
                            <li><strong>Base que entró</strong> y <strong>base que se dejó</strong> en ese cierre</li>
                            <li>Si hay varios cierres el mismo día, <strong>no se suman las bases</strong>: queda la del último (es el mismo dinero de la caja)</li>
                        </ul>
                        
                        <h5 class="text-primary">📊 Balance total</h5>
                        <ul>
                            <li>Ventas − propinas − gastos − créditos − domicilios</li>
                            <li>La última base dejada se suma aparte (efectivo que quedó en caja)</li>
                        </ul>
                    </div>
                </div>
                
                <div class="alert alert-info mt-3">
                    <strong>💡 Tip:</strong> El cierre de caja mira el turno abierto. El Balance mira el periodo que elijas, con todos los cierres de esas fechas.
                </div>
            </div>
        `
    },

    'mesero.html': {
        titulo: 'Mesero',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-concierge-bell text-info"></i> App de Mesero</h4>
                <div class="alert alert-info">
                    Entra con el correo y la contraseña que te dio Administración. El pedido llega a caja y a cocina. Aquí no se cobra ni se toca inventario.
                </div>
                <h5 class="text-warning">Mesas, domicilio y recoger</h5>
                <ul>
                    <li><strong>Actualizar:</strong> el círculo de la esquina superior izquierda recarga la app si el internet se trabó.</li>
                    <li><strong>Abrir mesa:</strong> escribe el N° en el recuadro blanco y toca el botón naranja <strong>Abrir mesa</strong> (la flecha lo indica).</li>
                    <li><strong>Volver a Pedidos:</strong> dentro del pedido, el botón cyan regresa a la lista de mesas.</li>
                    <li><strong>Cambio de mesa:</strong> dentro del pedido, toca <strong>Cambio de mesa</strong> y escribe el número nuevo. Si la mesa ya tenía pedido, se unen.</li>
                    <li><strong>Domicilio y Recoger:</strong> aparecen los clientes de Administración. Búscalo por nombre o teléfono; si es nuevo, escríbelo y queda en la misma base.</li>
                    <li><strong>Buscar producto:</strong> dentro del pedido, el campo blanco filtra por nombre o categoría, igual que en caja.</li>
                    <li>Si ya se había enviado a cocina, se imprime un ticket nuevo con el cambio desde el celular.</li>
                </ul>
                <h5 class="text-success">Enviar e imprimir</h5>
                <ul>
                    <li><strong>Enviar a cocina:</strong> manda el pedido a caja. Si en Administración activaron la térmica de red, en Android abre RawBT y el ticket sale cortado. Si no hay IP o el celular no puede imprimir, el ticket se abre en la caja principal.</li>
                    <li><strong>Imprimir ticket:</strong> aparece después de enviar a cocina, para reimprimir ese ticket.</li>
                </ul>
                <div class="alert alert-warning mb-0">
                    El cobro lo hace caja en el Punto de Venta.
                </div>
            </div>
        `
    },

    'propietario.html': {
        titulo: 'Propietario',
        contenido: `
            <div class="help-content">
                <h4><i class="fas fa-user-tie text-info"></i> App del propietario</h4>
                <div class="alert alert-info">
                    Entra con el correo y la contraseña que te asignaron en Administración (enlace <strong>ultimate.toysoft.co/propietario</strong>). Ves el negocio en tiempo real, como el Balance del computador. <strong>No cobras, no cambias el menú y no entras a Administración.</strong>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <h5 class="text-warning">Cómo entrar</h5>
                        <ul>
                            <li>Usa el correo y la contraseña de la cuenta de propietario (o la de administrador, si quieres ver este panel en el celular).</li>
                            <li>Si no tienes cuenta, pídesela a quien maneja Administración.</li>
                            <li><strong>Salir:</strong> el botón de abajo cierra la sesión.</li>
                            <li>Instálala en el celular como <strong>ToySoft Propietario</strong>.</li>
                        </ul>

                        <h5 class="text-info">El día</h5>
                        <ul>
                            <li>Elige la fecha o usa las flechas. El resumen es <strong>de ese día</strong>.</li>
                            <li>No hay semana ni mes: un día a la vez, como en el Balance de caja.</li>
                            <li>Si el restaurante opera después de medianoche, el día sigue la hora configurada en Administración.</li>
                        </ul>

                        <h5 class="text-success">Resumen de arriba</h5>
                        <ul>
                            <li><strong>Ventas, Gastos y Balance</strong> del día elegido.</li>
                            <li>El balance resta gastos de caja, créditos, valor de domicilios y <strong>propinas</strong> (las propinas son del personal, igual que el domicilio).</li>
                            <li>Chips: Efectivo, Transferencia, Tarjeta, Crédito, Tickets, Domicilios y Propinas (estos dos últimos restan).</li>
                        </ul>
                    </div>

                    <div class="col-md-6">
                        <h5 class="text-primary">Detalle (toca el +)</h5>
                        <ul>
                            <li><strong>Productos vendidos:</strong> cada producto, cantidad y total.</li>
                            <li><strong>Ventas por tipo:</strong> mesas, domicilios, recoger y venta rápida. El + de cada tipo muestra sus productos.</li>
                            <li><strong>Ventas por mesero:</strong> el nombre registrado. Lo vendido en caja, sin mesero, sale como <strong>Caja (POS)</strong>.</li>
                            <li><strong>Domicilios y domiciliarios:</strong> lo cobrado de domicilio, por persona. Se resta del balance.</li>
                            <li><strong>Propinas:</strong> total y por venta. Se restan del balance.</li>
                            <li><strong>Créditos pendientes:</strong> ventas a crédito de ese día.</li>
                            <li><strong>Gastos:</strong> <em>Sale de la caja</em>, <em>Al contado, no sale de caja</em> y <em>Crédito con el proveedor</em>. El + abre el detalle.</li>
                            <li><strong>Inventario bajo:</strong> productos en o por debajo del mínimo.</li>
                            <li><strong>Cierres:</strong> administrativo y operativo de ese día.</li>
                        </ul>

                        <h5 class="text-info">En vivo</h5>
                        <ul>
                            <li>Si en caja cobran o gastan, esto se actualiza solo.</li>
                            <li><strong>Actualizar:</strong> el círculo de la esquina recarga si el internet se trabó.</li>
                        </ul>
                    </div>
                </div>

                <div class="alert alert-warning mb-0 mt-3">
                    El cobro, el menú, los PIN, la facturación electrónica y las herramientas del sistema se manejan en el <strong>Punto de Venta</strong> y en <strong>Administración</strong>. Esta app solo consulta.
                </div>
            </div>
        `
    }
};

// Función para mostrar ayuda contextual
function mostrarAyudaContextual() {
    const contexto = obtenerContextoActual();
    let ayuda;
    
    // Detectar si estamos en cotizaciones desde el POS
    if (contexto.pagina === 'POS.html' && contexto.modulo === 'cotizaciones') {
        // Verificar si estamos en el modal de nueva cotización específicamente
        if (document.getElementById('modalNuevaCotizacion') && 
            document.getElementById('modalNuevaCotizacion').classList.contains('show')) {
            ayuda = {
                titulo: 'Nueva Cotización - Ayuda Completa',
                contenido: ayudaContextual['cotizaciones'].contenido + `
                    <div class="alert alert-warning mt-3">
                        <strong>💡 Ayuda Específica:</strong>
                        <ul class="mb-0 mt-2">
                            <li>Haz clic en los botones de ayuda (❓) en cada sección para ayuda específica</li>
                            <li>Usa F1 desde cualquier parte del modal para esta ayuda general</li>
                            <li>Los productos se pueden buscar por categoría o nombre</li>
                            <li>Las cantidades y precios se pueden modificar antes de agregar</li>
                        </ul>
                    </div>
                `
            };
        } else {
            ayuda = ayudaContextual['cotizaciones'];
        }
    } else if (contexto.pagina === 'POS.html' && contexto.modulo === 'cierre-caja') {
        ayuda = ayudaContextual['cierre-caja'];
    } else if (contexto.pagina === 'POS.html' && contexto.modulo === 'cierre-operativo') {
        ayuda = ayudaContextual['cierre-operativo'];
    } else if (contexto.pagina === 'POS.html' && contexto.modulo === 'balance') {
        ayuda = ayudaContextual['balance'];
    } else {
        ayuda = ayudaContextual[contexto.pagina]
            || ayudaContextual[contexto.pagina + '.html']
            || ayudaContextual['index.html'];
    }

    if (!ayuda) ayuda = ayudaContextual['index.html'];
    
    // Actualizar contenido del modal
    document.getElementById('tituloAyuda').textContent = ayuda.titulo;
    document.getElementById('contenidoAyuda').innerHTML = ayuda.contenido;
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalAyuda'));
    modal.show();
}

// Función para obtener el contexto actual
function obtenerContextoActual() {
    const path = (window.location.pathname || '').toLowerCase();
    let url = path.split('/').pop() || 'index.html';
    if (path.indexOf('propietario') !== -1) url = 'propietario.html';
    if (path.indexOf('mesero') !== -1) url = 'mesero.html';
    return {
        pagina: url,
        modulo: detectarModulo(),
        elementoActivo: document.querySelector('.active, .selected')?.id || null
    };
}

// Función para detectar el módulo actual
function detectarModulo() {
    if (document.getElementById('modalCierreDiario') &&
        document.getElementById('modalCierreDiario').classList.contains('show')) {
        return 'cierre-caja';
    }
    if (document.getElementById('modalCierreOperativo') &&
        document.getElementById('modalCierreOperativo').classList.contains('show')) {
        return 'cierre-operativo';
    }
    if (document.getElementById('modalBalance') &&
        document.getElementById('modalBalance').classList.contains('show')) {
        return 'balance';
    }
    if (document.getElementById('modalNuevaCotizacion') &&
        document.getElementById('modalNuevaCotizacion').classList.contains('show')) {
        return 'cotizaciones';
    }
    if (document.getElementById('modalCotizaciones') &&
        document.getElementById('modalCotizaciones').classList.contains('show')) {
        return 'cotizaciones';
    }

    const url = window.location.pathname;
    if (url.includes('POS.html')) return 'pos';
    if (url.includes('inventario.html')) return 'inventario';
    if (url.includes('admon.html')) return 'administracion';
    if (url.includes('gastos.html')) return 'gastos';
    if (url.includes('historial.html')) return 'historial';
    
    return 'principal';
}

// Event listener para F1
document.addEventListener('keydown', function(event) {
    if (event.key === 'F1') {
        event.preventDefault();
        mostrarAyudaContextual();
    }
});

// Función para inicializar botones de ayuda
function inicializarBotonesAyuda() {
    // Agregar botones de ayuda a elementos específicos
    const elementosAyuda = document.querySelectorAll('[data-ayuda]');
    elementosAyuda.forEach(elemento => {
        elemento.addEventListener('click', function() {
            const ayudaEspecifica = this.getAttribute('data-ayuda');
            mostrarAyudaEspecifica(ayudaEspecifica);
        });
    });
}

// Función para mostrar ayuda específica de un elemento
function mostrarAyudaEspecifica(tipo) {
    const ayudasEspecificas = {
        'mesas': {
            titulo: 'Gestión de Mesas',
            contenido: `
                <div class="alert alert-info">
                    <h6><i class="fas fa-table"></i> Gestión de Mesas y Pedidos</h6>
                    <ul class="mb-0">
                        <li><strong>Nueva Mesa:</strong> Ingresa el número y presiona "Nueva Mesa"</li>
                        <li><strong>Mesas Activas:</strong> Solo aparecen las mesas con pedidos</li>
                        <li><strong>Colores:</strong> Naranja (normal), Verde (domicilio), Azul (recoger)</li>
                        <li><strong>Seleccionar:</strong> Haz clic en cualquier mesa para ver su orden</li>
                    </ul>
                </div>
            `
        },
        'productos': {
            titulo: 'Gestión de Productos',
            contenido: `
                <div class="alert alert-success">
                    <h6><i class="fas fa-box"></i> Agregar y Gestionar Productos</h6>
                    <ul class="mb-0">
                        <li><strong>Categorías:</strong> Filtra productos por tipo</li>
                        <li><strong>Productos:</strong> Se crean en Administración</li>
                        <li><strong>Agregar:</strong> Haz clic en el producto</li>
                        <li><strong>Nombre y precio libres:</strong> Si el producto está marcado así en Administración, escribe el nombre y el precio de esa venta</li>
                        <li><strong>Modificaciones:</strong> Casillas (sin cebolla, extra queso…) si el producto las tiene</li>
                        <li><strong>Salsas:</strong> Casillas aparte; llegan a cocina como “Salsas: …”</li>
                        <li><strong>Cantidad:</strong> Se puede modificar en la orden</li>
                        <li><strong>Detalles:</strong> Notas libres para cocina</li>
                    </ul>
                </div>
            `
        },
        'pago': {
            titulo: 'Procesar Pagos',
            contenido: `
                <div class="alert alert-warning">
                    <h6><i class="fas fa-credit-card"></i> Procesar Pagos y Generar Recibos</h6>
                    <ul class="mb-0">
                        <li><strong>Propina:</strong> Porcentaje automático</li>
                        <li><strong>Descuento:</strong> Monto fijo en pesos</li>
                        <li><strong>Domicilio:</strong> Costo de entrega; en el cierre se resta porque se paga al domiciliario</li>
                        <li><strong>Métodos:</strong> Efectivo, tarjeta, transferencia, crédito o mixto</li>
                        <li><strong>Recibo:</strong> Preliminar y final</li>
                    </ul>
                </div>
            `
        },
        'clientes': {
            titulo: 'Gestión de Clientes',
            contenido: `
                <div class="alert alert-primary">
                    <h6><i class="fas fa-users"></i> Gestión de Clientes y Domicilios</h6>
                    <ul class="mb-0">
                        <li><strong>Domicilio:</strong> Para entregas a domicilio</li>
                        <li><strong>Recoger:</strong> Para pedidos para llevar</li>
                        <li><strong>Cliente Nuevo:</strong> Se puede crear al momento</li>
                        <li><strong>Datos:</strong> Nombre, teléfono, dirección</li>
                        <li><strong>Historial:</strong> Se guardan para futuras ventas</li>
                    </ul>
                </div>
            `
        },
        'cotizaciones': {
            titulo: 'Gestión de Cotizaciones',
            contenido: `
                <div class="alert alert-info">
                    <h6><i class="fas fa-file-invoice"></i> Crear y Gestionar Cotizaciones</h6>
                    <ul class="mb-0">
                        <li><strong>Nueva Cotización:</strong> Crear propuesta para cliente</li>
                        <li><strong>Buscar:</strong> Por cliente o fecha</li>
                        <li><strong>Editar:</strong> Modificar cotizaciones existentes</li>
                        <li><strong>Imprimir:</strong> Generar documento formal</li>
                        <li><strong>Diferencias:</strong> No afectan inventario, son propuestas</li>
                    </ul>
                </div>
            `
        },
        'nueva-cotizacion': {
            titulo: 'Nueva Cotización',
            contenido: `
                <div class="alert alert-success">
                    <h6><i class="fas fa-plus-circle"></i> Crear Nueva Cotización</h6>
                    <ol class="mb-0">
                        <li><strong>Cliente:</strong> Selecciona cliente existente o crea nuevo</li>
                        <li><strong>Fecha:</strong> Fecha de la cotización</li>
                        <li><strong>Productos:</strong> Busca y agrega items</li>
                        <li><strong>Cantidades:</strong> Especifica cantidades</li>
                        <li><strong>Revisar:</strong> Verifica total y detalles</li>
                        <li><strong>Guardar:</strong> Almacena la cotización</li>
                    </ol>
                </div>
            `
        },
        'editar-cotizacion': {
            titulo: 'Editar Cotización',
            contenido: `
                <div class="alert alert-warning">
                    <h6><i class="fas fa-edit"></i> Modificar Cotización Existente</h6>
                    <ul class="mb-0">
                        <li><strong>Seleccionar:</strong> Elige la cotización a editar</li>
                        <li><strong>Modificar:</strong> Cambia cliente, fecha o productos</li>
                        <li><strong>Agregar:</strong> Nuevos productos si es necesario</li>
                        <li><strong>Eliminar:</strong> Quita productos no deseados</li>
                        <li><strong>Guardar:</strong> Actualiza los cambios</li>
                    </ul>
                </div>
            `
        },
        'imprimir-cotizacion': {
            titulo: 'Imprimir Cotización',
            contenido: `
                <div class="alert alert-primary">
                    <h6><i class="fas fa-print"></i> Generar e Imprimir Documento</h6>
                    <ul class="mb-0">
                        <li><strong>Vista Previa:</strong> Revisa antes de imprimir</li>
                        <li><strong>Formato:</strong> Documento profesional</li>
                        <li><strong>Datos:</strong> Cliente, productos, totales</li>
                        <li><strong>PDF:</strong> Exportar como archivo digital</li>
                        <li><strong>Enviar:</strong> Compartir por email o WhatsApp</li>
                    </ul>
                </div>
            `
        },
        'buscar-cotizacion': {
            titulo: 'Buscar Cotizaciones',
            contenido: `
                <div class="alert alert-info">
                    <h6><i class="fas fa-search"></i> Buscar Cotizaciones</h6>
                    <ul class="mb-0">
                        <li><strong>Por Cliente:</strong> Busca por nombre del cliente</li>
                        <li><strong>Por Fecha:</strong> Filtra por fecha específica</li>
                        <li><strong>Resultados:</strong> Muestra cotizaciones encontradas</li>
                        <li><strong>Acciones:</strong> Editar, imprimir o eliminar</li>
                    </ul>
                </div>
            `
        },
        'items-cotizacion': {
            titulo: 'Items de Cotización',
            contenido: `
                <div class="alert alert-success">
                    <h6><i class="fas fa-list"></i> Gestionar Productos de la Cotización</h6>
                    <ul class="mb-0">
                        <li><strong>Agregar:</strong> Busca y selecciona productos</li>
                        <li><strong>Cantidad:</strong> Especifica cantidad para cada item</li>
                        <li><strong>Precio:</strong> Se calcula automáticamente</li>
                        <li><strong>Modificar:</strong> Cambia cantidad o precio</li>
                        <li><strong>Eliminar:</strong> Quita productos no deseados</li>
                        <li><strong>Total:</strong> Se actualiza automáticamente</li>
                    </ul>
                </div>
            `
        },
        'cierre-caja': {
            titulo: 'Cierre de Caja',
            contenido: `
                <div class="alert alert-success">
                    <h6><i class="fas fa-calculator"></i> Control Financiero Diario</h6>
                    <ul class="mb-0">
                        <li><strong>Rango:</strong> Por defecto, desde el último cierre (incluye anoche si no se cerró)</li>
                        <li><strong>Domicilios a restar:</strong> Ya están en ventas; se restan porque se pagan al domiciliario</li>
                        <li><strong>Propinas a restar:</strong> Ya están en ventas; se restan porque son del personal</li>
                        <li><strong>Efectivo en caja:</strong> Base anterior + efectivo − gastos en efectivo − domicilios en efectivo/mixto − propinas en efectivo/mixto</li>
                        <li><strong>Balance del restaurante:</strong> Ventas − propinas − gastos (efectivo, transferencia y créditos pagados) − domicilios</li>
                        <li><strong>Base:</strong> El valor que dejes se suma en el siguiente cierre</li>
                    </ul>
                </div>
            `
        },
        'resumen-ventas': {
            titulo: 'Resumen de Ventas',
            contenido: `
                <div class="alert alert-info">
                    <h6><i class="fas fa-chart-bar"></i> Totales por Método de Pago</h6>
                    <ul class="mb-0">
                        <li><strong>Total Ventas:</strong> Incluye el domicilio y las propinas cobrados al cliente</li>
                        <li><strong>Efectivo / Transferencia / Tarjeta / Crédito</strong></li>
                        <li><strong>Mixto:</strong> Ya está incluido en efectivo y transferencia</li>
                        <li><strong>Ventas rápidas:</strong> Se muestran aparte si hubo en el periodo</li>
                    </ul>
                </div>
            `
        },
        'gestion-gastos': {
            titulo: 'Gestión de Gastos',
            contenido: `
                <div class="alert alert-danger">
                    <h6><i class="fas fa-receipt"></i> Registrar Gastos del Día</h6>
                    <ul class="mb-0">
                        <li><strong>Forma de pago:</strong> Efectivo, transferencia o crédito con el proveedor</li>
                        <li><strong>Efectivo:</strong> Resta caja y balance</li>
                        <li><strong>Transferencia:</strong> No resta caja; sí el balance</li>
                        <li><strong>Crédito:</strong> No afecta hasta que se pague al proveedor</li>
                    </ul>
                </div>
            `
        },
        'balance-final': {
            titulo: 'Balance Final',
            contenido: `
                <div class="alert alert-warning">
                    <h6><i class="fas fa-balance-scale"></i> Cálculo del Balance</h6>
                    <ul class="mb-0">
                        <li><strong>Restaurante:</strong> Ventas − Propinas − Gastos − Domicilios</li>
                        <li><strong>Efectivo en caja:</strong> Base anterior + efectivo cobrado − gastos en efectivo − domicilios en efectivo/mixto − propinas en efectivo/mixto</li>
                        <li><strong>Base:</strong> No es una venta; es el dinero que ya estaba en caja</li>
                        <li><strong>Impresión:</strong> El comprobante muestra ambas cuentas</li>
                    </ul>
                </div>
            `
        },
        'informacion-cierre': {
            titulo: 'Información del Cierre',
            contenido: `
                <div class="alert alert-primary">
                    <h6><i class="fas fa-user-check"></i> Datos del Cierre</h6>
                    <ul class="mb-0">
                        <li><strong>Quien Cierra / Quien Recibe</strong></li>
                        <li><strong>Monto base para el siguiente cierre:</strong> Se sugiere la base anterior</li>
                        <li>Ese valor se suma al efectivo del próximo cierre</li>
                        <li>Si hay varios cierres el mismo día, en Balance no se suman las bases: queda la última</li>
                    </ul>
                </div>
            `
        },
        'balance': {
            titulo: 'Balance',
            contenido: `
                <div class="alert alert-info">
                    <h6><i class="fas fa-balance-scale"></i> Balance del periodo</h6>
                    <ul class="mb-0">
                        <li><strong>Ver productos:</strong> En Ventas por tipo, abre el detalle de cada canal</li>
                        <li><strong>Ventas por mesero:</strong> Cuánto vendió cada uno; Caja (POS) es lo que no tomó un mesero</li>
                        <li><strong>Bases de caja:</strong> Cada cierre con la base que entró y la que se dejó</li>
                        <li><strong>Varios cierres:</strong> No se suman las bases; queda la del último</li>
                        <li><strong>Total:</strong> Ventas − propinas − gastos − créditos − domicilios, más la última base dejada</li>
                    </ul>
                </div>
            `
        },
        'cierre-operativo': {
            titulo: 'Cierre Operativo',
            contenido: `
                <div class="help-content">
                    <h4><i class="fas fa-user-clock text-success"></i> Cierre Operativo - Control de Turnos</h4>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h5 class="text-info">👤 Información del Empleado</h5>
                            <ul>
                                <li><strong>Nombre:</strong> Nombre completo del empleado</li>
                                <li><strong>Cargo:</strong> Posición o rol en el negocio</li>
                                <li><strong>Hora Inicio:</strong> Cuándo comenzó el turno</li>
                                <li><strong>Hora Fin:</strong> Cuándo termina el turno</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h5 class="text-warning">📋 Checklist de Tareas</h5>
                            <ul>
                                <li><strong>Limpieza:</strong> Área de trabajo ordenada</li>
                                <li><strong>Inventario:</strong> Verificar stock disponible</li>
                                <li><strong>Equipos:</strong> Verificar funcionamiento</li>
                                <li><strong>Seguridad:</strong> Cerrar y asegurar</li>
                                <li><strong>Mesas:</strong> Verificar estado final</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <h5 class="text-success">💰 Totales de Ventas</h5>
                            <ul>
                                <li><strong>Efectivo:</strong> Ventas en dinero en efectivo</li>
                                <li><strong>Transferencia:</strong> Pagos por transferencia</li>
                                <li><strong>Tarjeta:</strong> Pagos con tarjeta</li>
                                <li><strong>Total General:</strong> Suma de todos los métodos</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h5 class="text-primary">🔄 Entrega de Turno</h5>
                            <ul>
                                <li><strong>Quien Recibe:</strong> Nombre del siguiente empleado</li>
                                <li><strong>Cargo:</strong> Posición del que recibe</li>
                                <li><strong>Base Caja:</strong> Dinero que deja para el siguiente</li>
                                <li><strong>Observaciones:</strong> Notas importantes</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="alert alert-info mt-3">
                        <h6><i class="fas fa-lightbulb"></i> Consejos Importantes</h6>
                        <ul class="mb-0">
                            <li><strong>Completar Checklist:</strong> Marcar todas las tareas realizadas</li>
                            <li><strong>Verificar Totales:</strong> Confirmar que los números coincidan</li>
                            <li><strong>Documentar Problemas:</strong> Anotar cualquier incidencia</li>
                            <li><strong>Comunicar Cambios:</strong> Informar al siguiente turno</li>
                        </ul>
                    </div>
                </div>
            `
        }
    };
    
    const ayuda = ayudasEspecificas[tipo];
    if (!ayuda) {
        alert('Ayuda no disponible');
        return;
    }
    
    // Crear modal de ayuda específica
    const modalHTML = `
        <div class="modal fade" id="modalAyudaEspecifica" tabindex="-1" style="z-index: 1070;">
            <div class="modal-dialog">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <img src="image/logo-ToySoft.png" alt="ToySoft" style="width: 32px; height: 32px; margin-right: 8px; vertical-align: middle;">
                            <span style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: 600; font-size: 1.2rem; color: #0dcaf0;">Toy Ayudas</span>
                            <span style="color: #ffffff; font-size: 1rem; margin-left: 8px;">- ${ayuda.titulo}</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${ayuda.contenido}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-info" onclick="mostrarAyudaContextual()">
                            <i class="fas fa-book"></i> Ayuda Completa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al body si no existe
    if (!document.getElementById('modalAyudaEspecifica')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } else {
        // Actualizar contenido si ya existe
        document.getElementById('modalAyudaEspecifica').outerHTML = modalHTML;
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalAyudaEspecifica'));
    modal.show();
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    inicializarBotonesAyuda();
    
    // Agregar botón de ayuda flotante si no existe
    if (!document.getElementById('btnAyudaFlotante')) {
        const btnAyuda = document.createElement('button');
        btnAyuda.id = 'btnAyudaFlotante';
        btnAyuda.className = 'btn btn-info position-fixed';
        btnAyuda.style.cssText = `
            bottom: 16px; 
            right: 16px; 
            z-index: 1000; 
            border-radius: 22px; 
            width: 108px; 
            height: 40px; 
            padding: 4px 8px;
            background: linear-gradient(135deg, #0dcaf0 0%, #0a58ca 100%);
            border: none;
            box-shadow: 0 6px 16px rgba(13, 202, 240, 0.35), 0 3px 8px rgba(0, 0, 0, 0.15);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        btnAyuda.innerHTML = `
            <img src="image/logo-ToySoft.png" alt="ToySoft" style="width: 24px; height: 24px; margin-right: 6px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); object-fit: cover;">
            <span style="font-family: 'Orbitron', 'Exo 2', 'Rajdhani', 'Roboto Mono', monospace; font-weight: 800; font-size: 0.68rem; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.4); letter-spacing: 0.2px; line-height: 1.05; display: block; text-align: center;">Toy de<br>Ayudas</span>
        `;
        btnAyuda.title = 'Ayuda (F1)';
        btnAyuda.onclick = mostrarAyudaContextual;
        
        // Efectos hover modernos
        btnAyuda.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.05)';
            this.style.boxShadow = '0 12px 35px rgba(13, 202, 240, 0.6), 0 6px 16px rgba(0, 0, 0, 0.2)';
            this.style.background = 'linear-gradient(135deg, #17a2b8 0%, #0c63e4 100%)';
        });
        
        btnAyuda.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 8px 25px rgba(13, 202, 240, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)';
            this.style.background = 'linear-gradient(135deg, #0dcaf0 0%, #0a58ca 100%)';
        });
        
        // Efecto de click
        btnAyuda.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(1px) scale(0.98)';
        });
        
        btnAyuda.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-2px) scale(1.05)';
        });
        
        document.body.appendChild(btnAyuda);
    }
}); 