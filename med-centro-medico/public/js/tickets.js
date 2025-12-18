// ============================================
// GESTIÓN DE TICKETS - COMPLETO
// ============================================

// VARIABLES GLOBALES PARA TICKETS
let productosTicketSeleccionados = [];
let productosDisponiblesTicket = [];
let currentModalPage = 1;
const itemsPerModalPage = 5;

// FUNCIÓN PARA ABRIR MODAL DE SELECCIÓN DE PRODUCTOS
function abrirModalSeleccionProductos() {
  cargarProductosDisponiblesModal();
  document.getElementById('modalSeleccionProductos').style.display = 'block';
  
  // Configurar eventos de búsqueda
  document.getElementById('buscarProductoModal').addEventListener('input', filtrarProductosModal);
  document.getElementById('filtroCategoriaModal').addEventListener('change', filtrarProductosModal);
  document.getElementById('filtroStockModal').addEventListener('change', filtrarProductosModal);
}

// CARGAR PRODUCTOS DISPONIBLES EN MODAL
async function cargarProductosDisponiblesModal(page = 1) {
  const tbody = document.getElementById('productosDisponiblesModal');
  if (!tbody) return;
  
  try {
    // Cargar productos desde Google Sheets
    const productosResult = await apiRequest('getProductos');
    if (productosResult && productosResult.success) {
      productosDisponiblesTicket = productosResult.data;
    }
    
    // Cargar categorías para filtro
    cargarCategoriasFiltro();
    
    // Aplicar filtros
    const productosFiltrados = aplicarFiltrosProductos();
    
    // Calcular paginación
    const totalPages = Math.ceil(productosFiltrados.length / itemsPerModalPage);
    const startIndex = (page - 1) * itemsPerModalPage;
    const productosPagina = productosFiltrados.slice(startIndex, startIndex + itemsPerModalPage);
    
    tbody.innerHTML = '';
    
    if (productosPagina.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            <i class="fas fa-box-open fa-2x mb-2 text-muted"></i>
            <p class="text-muted">No hay productos disponibles</p>
          </td>
        </tr>
      `;
    } else {
      productosPagina.forEach(producto => {
        const yaSeleccionado = productosTicketSeleccionados.find(p => p.id === producto.id);
        const cantidadSeleccionada = yaSeleccionado ? yaSeleccionado.cantidadSolicitada : 1;
        
        const row = document.createElement('tr');
        row.className = `producto-seleccionable ${yaSeleccionado ? 'seleccionado' : ''}`;
        row.dataset.productoId = producto.id;
        
        const stockClass = producto.stock === 0 ? 'text-danger' : 
                          producto.stock < producto.minStock ? 'text-warning' : 'text-success';
        
        row.innerHTML = `
          <td>
            <input type="checkbox" class="producto-checkbox" 
                   value="${producto.id}" 
                   ${yaSeleccionado ? 'checked' : ''}
                   onchange="toggleSeleccionProducto(${producto.id}, this.checked)">
          </td>
          <td>
            <strong>${producto.nombre}</strong><br>
            <small class="text-muted">${producto.codigo} • ${producto.ubicacion}</small>
          </td>
          <td><span class="badge badge-info">${producto.categoria}</span></td>
          <td><span class="${stockClass}"><strong>${producto.stock}</strong> ${producto.unidad}</span></td>
          <td>${producto.unidad}</td>
          <td>
            <input type="number" 
                   id="cantidad-modal-${producto.id}" 
                   class="form-control cantidad-selector" 
                   min="1" 
                   max="${producto.stock}"
                   value="${cantidadSeleccionada}"
                   ${yaSeleccionado ? '' : 'disabled'}
                   onchange="actualizarCantidadModal(${producto.id})">
          </td>
        `;
        
        tbody.appendChild(row);
      });
    }
    
    // Actualizar contador
    actualizarContadorSeleccionados();
    
    // Generar paginación
    generatePagination(page, totalPages, 'paginationModal', cargarProductosDisponiblesModal);
    
  } catch (error) {
    console.error('Error cargando productos:', error);
    showAlert('Error cargando productos disponibles', 'error');
  }
}

// APLICAR FILTROS A PRODUCTOS
function aplicarFiltrosProductos() {
  const busqueda = document.getElementById('buscarProductoModal').value.toLowerCase();
  const categoria = document.getElementById('filtroCategoriaModal').value;
  const stockFiltro = document.getElementById('filtroStockModal').value;
  
  return productosDisponiblesTicket.filter(producto => {
    // Filtro por búsqueda
    const coincideBusqueda = !busqueda || 
      producto.nombre.toLowerCase().includes(busqueda) || 
      producto.codigo.toLowerCase().includes(busqueda);
    
    // Filtro por categoría
    const coincideCategoria = !categoria || producto.categoria === categoria;
    
    // Filtro por stock
    let coincideStock = true;
    if (stockFiltro === 'disponible') {
      coincideStock = producto.stock > 0;
    } else if (stockFiltro === 'bajo') {
      coincideStock = producto.stock < producto.minStock;
    }
    
    return coincideBusqueda && coincideCategoria && coincideStock;
  });
}

// CARGAR CATEGORÍAS PARA FILTRO
function cargarCategoriasFiltro() {
  const select = document.getElementById('filtroCategoriaModal');
  if (!select) return;
  
  // Obtener categorías únicas de productos
  const categoriasUnicas = [...new Set(productosDisponiblesTicket.map(p => p.categoria))];
  
  select.innerHTML = '<option value="">Todas las categorías</option>';
  categoriasUnicas.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria;
    option.textContent = categoria;
    select.appendChild(option);
  });
}

// FILTRAR PRODUCTOS EN MODAL
function filtrarProductosModal() {
  cargarProductosDisponiblesModal(1);
}

// TOGGLE SELECCIÓN DE PRODUCTO
function toggleSeleccionProducto(productoId, seleccionado) {
  const producto = productosDisponiblesTicket.find(p => p.id === productoId);
  if (!producto) return;
  
  const cantidadInput = document.getElementById(`cantidad-modal-${productoId}`);
  const row = document.querySelector(`tr[data-producto-id="${productoId}"]`);
  
  if (seleccionado) {
    // Agregar producto a selección
    const cantidad = parseInt(cantidadInput.value) || 1;
    
    if (cantidad > producto.stock) {
      showAlert(`Stock insuficiente. Máximo disponible: ${producto.stock} ${producto.unidad}`, 'error');
      cantidadInput.value = producto.stock;
      return;
    }
    
    productosTicketSeleccionados.push({
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      stockDisponible: producto.stock,
      cantidadSolicitada: cantidad,
      unidad: producto.unidad
    });
    
    cantidadInput.disabled = false;
    if (row) row.classList.add('seleccionado');
    
  } else {
    // Remover producto de selección
    productosTicketSeleccionados = productosTicketSeleccionados.filter(p => p.id !== productoId);
    cantidadInput.disabled = true;
    if (row) row.classList.remove('seleccionado');
  }
  
  actualizarContadorSeleccionados();
}

// ACTUALIZAR CANTIDAD EN MODAL
function actualizarCantidadModal(productoId) {
  const productoSeleccionado = productosTicketSeleccionados.find(p => p.id === productoId);
  const cantidadInput = document.getElementById(`cantidad-modal-${productoId}`);
  
  if (!productoSeleccionado || !cantidadInput) return;
  
  const producto = productosDisponiblesTicket.find(p => p.id === productoId);
  let nuevaCantidad = parseInt(cantidadInput.value) || 1;
  
  // Validar stock
  if (nuevaCantidad > producto.stock) {
    showAlert(`Stock insuficiente. Máximo disponible: ${producto.stock} ${producto.unidad}`, 'error');
    nuevaCantidad = producto.stock;
    cantidadInput.value = nuevaCantidad;
  }
  
  productoSeleccionado.cantidadSolicitada = nuevaCantidad;
}

// ACTUALIZAR CONTADOR DE SELECCIONADOS
function actualizarContadorSeleccionados() {
  const contador = document.getElementById('contadorSeleccionados');
  if (contador) {
    contador.textContent = `${productosTicketSeleccionados.length} producto(s) seleccionado(s)`;
  }
}

// GUARDAR SELECCIÓN DEL MODAL
function guardarSeleccionModal() {
  if (productosTicketSeleccionados.length === 0) {
    showAlert('Debe seleccionar al menos un producto', 'warning');
    return;
  }
  
  // Actualizar tabla principal
  actualizarTablaProductosTicket();
  cerrarModalSeleccion();
  
  // Mostrar tabla y ocultar mensaje
  document.getElementById('tablaProductosSeleccionados').style.display = 'block';
  document.getElementById('mensajeSinProductos').style.display = 'none';
}

// CERRAR MODAL DE SELECCIÓN
function cerrarModalSeleccion() {
  document.getElementById('modalSeleccionProductos').style.display = 'none';
  document.getElementById('buscarProductoModal').value = '';
  document.getElementById('filtroCategoriaModal').value = '';
  document.getElementById('filtroStockModal').value = '';
}

// ACTUALIZAR TABLA DE PRODUCTOS EN TICKET
function actualizarTablaProductosTicket() {
  const tbody = document.getElementById('productosSeleccionadosBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  productosTicketSeleccionados.forEach((producto, index) => {
    const stockClass = producto.cantidadSolicitada > producto.stockDisponible ? 'text-danger' : 'text-success';
    const stockText = producto.cantidadSolicitada > producto.stockDisponible ? 
      `Insuficiente (${producto.stockDisponible})` : 
      `Disponible (${producto.stockDisponible})`;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <strong>${producto.nombre}</strong><br>
        <small class="text-muted">${producto.codigo} • ${producto.categoria}</small>
      </td>
      <td>
        <div class="input-group input-group-sm" style="width: 120px;">
          <input type="number" 
                 class="form-control" 
                 min="1" 
                 max="${producto.stockDisponible}"
                 value="${producto.cantidadSolicitada}"
                 onchange="actualizarCantidadTicket(${producto.id}, this.value, ${index})">
          <div class="input-group-append">
            <span class="input-group-text">${producto.unidad}</span>
          </div>
        </div>
      </td>
      <td>${producto.unidad}</td>
      <td><span class="${stockClass}">${stockText}</span></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="eliminarProductoTicket(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  // Actualizar resumen
  actualizarResumenTicket();
}

// ACTUALIZAR CANTIDAD EN TICKET
function actualizarCantidadTicket(productoId, cantidad, index) {
  const producto = productosTicketSeleccionados[index];
  if (!producto) return;
  
  let nuevaCantidad = parseInt(cantidad) || 1;
  
  if (nuevaCantidad > producto.stockDisponible) {
    showAlert(`Stock insuficiente. Máximo disponible: ${producto.stockDisponible} ${producto.unidad}`, 'error');
    nuevaCantidad = producto.stockDisponible;
    
    // Actualizar input
    const inputs = document.querySelectorAll(`input[type="number"]`);
    inputs.forEach(input => {
      if (input.value === cantidad) {
        input.value = nuevaCantidad;
      }
    });
  }
  
  producto.cantidadSolicitada = nuevaCantidad;
  actualizarResumenTicket();
}

// ELIMINAR PRODUCTO DEL TICKET
function eliminarProductoTicket(index) {
  if (confirm('¿Eliminar este producto del ticket?')) {
    productosTicketSeleccionados.splice(index, 1);
    actualizarTablaProductosTicket();
    
    if (productosTicketSeleccionados.length === 0) {
      document.getElementById('tablaProductosSeleccionados').style.display = 'none';
      document.getElementById('mensajeSinProductos').style.display = 'block';
    }
  }
}

// ACTUALIZAR RESUMEN DEL TICKET
function actualizarResumenTicket() {
  const totalProductos = productosTicketSeleccionados.length;
  document.getElementById('resumenProductos').textContent = totalProductos;
  
  // Actualizar otros campos del resumen
  const paciente = document.getElementById('pacienteNombre').value;
  const habitacion = document.getElementById('habitacion').value;
  const prioridad = document.getElementById('prioridad').value;
  
  if (paciente) document.getElementById('resumenPaciente').textContent = paciente;
  if (habitacion) document.getElementById('resumenHabitacion').textContent = habitacion;
  if (prioridad) {
    const prioridadText = {
      'baja': 'Baja',
      'media': 'Media',
      'alta': 'Alta',
      'urgente': 'Urgente'
    }[prioridad] || 'Media';
    document.getElementById('resumenPrioridad').textContent = prioridadText;
  }
}

// ENVIAR TICKET A GOOGLE SHEETS
async function enviarTicket() {
  // Validar datos
  const paciente = document.getElementById('pacienteNombre').value.trim();
  const habitacion = document.getElementById('habitacion').value.trim();
  const solicitante = document.getElementById('solicitante').value.trim();
  const prioridad = document.getElementById('prioridad').value;
  const observaciones = document.getElementById('observaciones').value.trim();
  
  if (!paciente || !habitacion || !solicitante) {
    showAlert('Por favor complete los datos del paciente (*)', 'error');
    return;
  }
  
  if (productosTicketSeleccionados.length === 0) {
    showAlert('Debe agregar al menos un producto al ticket', 'error');
    return;
  }
  
  // Verificar stock de todos los productos
  const productosSinStock = productosTicketSeleccionados.filter(p => 
    p.cantidadSolicitada > p.stockDisponible
  );
  
  if (productosSinStock.length > 0) {
    const productosLista = productosSinStock.map(p => 
      `${p.nombre} (${p.cantidadSolicitada} > ${p.stockDisponible} ${p.unidad})`
    ).join(', ');
    
    showAlert(`Stock insuficiente para: ${productosLista}`, 'error');
    return;
  }
  
  // Mostrar indicador de carga
  const btnEnviar = document.getElementById('btnEnviarTicket');
  const originalText = btnEnviar.innerHTML;
  btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  btnEnviar.disabled = true;
  
  try {
    // Preparar datos para Google Sheets
    const ticketData = {
      solicitante: solicitante,
      paciente: paciente,
      habitacion: habitacion,
      productos: JSON.stringify(productosTicketSeleccionados.map(p => p.nombre)),
      cantidad: JSON.stringify(productosTicketSeleccionados.map(p => p.cantidadSolicitada)),
      prioridad: prioridad,
      observaciones: observaciones
    };
    
    // Enviar a Google Sheets
    const result = await apiRequest('createTicket', ticketData);
    
    if (result && result.success) {
      // Mostrar modal de éxito
      mostrarModalExitoTicket({
        id: result.ticketId || Math.floor(Math.random() * 9000) + 1000,
        paciente: paciente,
        habitacion: habitacion,
        solicitante: solicitante,
        prioridad: prioridad,
        productos: productosTicketSeleccionados.length,
        fecha: new Date().toLocaleString('es-ES')
      });
      
      // Limpiar formulario
      limpiarFormularioTicket();
      
    } else {
      showAlert(result?.message || 'Error creando ticket', 'error');
    }
    
  } catch (error) {
    console.error('Error creando ticket:', error);
    showAlert('Error al crear el ticket', 'error');
  } finally {
    // Restaurar botón
    btnEnviar.innerHTML = originalText;
    btnEnviar.disabled = false;
  }
}

// MOSTRAR MODAL DE ÉXITO
function mostrarModalExitoTicket(ticketData) {
  // Llenar datos en el modal
  document.getElementById('ticketNumeroModal').textContent = ticketData.id;
  document.getElementById('ticketFechaModal').textContent = ticketData.fecha;
  document.getElementById('previewPaciente').textContent = ticketData.paciente;
  document.getElementById('previewSolicitante').textContent = ticketData.solicitante;
  document.getElementById('previewHabitacion').textContent = ticketData.habitacion;
  document.getElementById('previewPrioridad').textContent = ticketData.prioridad;
  document.getElementById('previewTicketId').textContent = ticketData.id;
  document.getElementById('previewBarcode').textContent = `#${ticketData.id}`;
  
  // Llenar productos
  const container = document.getElementById('previewProductos');
  container.innerHTML = '';
  
  productosTicketSeleccionados.forEach(producto => {
    const div = document.createElement('div');
    div.className = 'd-flex justify-content-between border-bottom py-1';
    div.innerHTML = `
      <span>${producto.nombre}</span>
      <span>${producto.cantidadSolicitada} ${producto.unidad}</span>
    `;
    container.appendChild(div);
  });
  
  // Mostrar modal
  document.getElementById('modalImpresionTicket').style.display = 'block';
}

// IMPRIMIR TICKET
function imprimirTicket() {
  const contenidoOriginal = document.body.innerHTML;
  const contenidoTicket = document.querySelector('.ticket-preview').cloneNode(true);
  
  // Crear ventana de impresión
  const ventanaImpresion = window.open('', '_blank');
  ventanaImpresion.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ticket MED Centro Médico</title>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: Arial, sans-serif;
          width: 80mm;
          margin: 0;
          padding: 10px;
          font-size: 12px;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .header h2 {
          margin: 0;
          font-size: 16px;
        }
        .info {
          margin-bottom: 10px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .info-label {
          font-weight: bold;
        }
        .productos {
          margin: 10px 0;
        }
        .producto-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dotted #ccc;
        }
        .barcode {
          font-family: 'Libre Barcode 128', cursive;
          font-size: 36px;
          text-align: center;
          letter-spacing: 3px;
          margin: 15px 0;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px dashed #000;
          font-size: 10px;
          color: #666;
        }
        @media print {
          body {
            width: 80mm !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>MED CENTRO MÉDICO</h2>
        <p>Ticket #${document.getElementById('ticketNumeroModal').textContent}</p>
        <p>${document.getElementById('ticketFechaModal').textContent}</p>
      </div>
      
      <div class="info">
        <div class="info-item">
          <span class="info-label">PACIENTE:</span>
          <span>${document.getElementById('previewPaciente').textContent}</span>
        </div>
        <div class="info-item">
          <span class="info-label">HABITACIÓN:</span>
          <span>${document.getElementById('previewHabitacion').textContent}</span>
        </div>
        <div class="info-item">
          <span class="info-label">SOLICITANTE:</span>
          <span>${document.getElementById('previewSolicitante').textContent}</span>
        </div>
        <div class="info-item">
          <span class="info-label">PRIORIDAD:</span>
          <span>${document.getElementById('previewPrioridad').textContent}</span>
        </div>
      </div>
      
      <div class="productos">
        <h4>PRODUCTOS SOLICITADOS</h4>
        ${Array.from(contenidoTicket.querySelectorAll('#previewProductos > div')).map(div => `
          <div class="producto-item">
            <span>${div.children[0].textContent}</span>
            <span>${div.children[1].textContent}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="barcode">
        ${document.getElementById('previewBarcode').textContent}
      </div>
      
      <div class="footer">
        <p>Ticket generado electrónicamente</p>
        <p>MED CENTRO MÉDICO - Sistema de Gestión</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 1000);
        };
      </script>
    </body>
    </html>
  `);
  
  ventanaImpresion.document.close();
}

// CERRAR MODAL DE IMPRESIÓN
function cerrarModalImpresion() {
  document.getElementById('modalImpresionTicket').style.display = 'none';
}

// LIMPIAR FORMULARIO
function limpiarFormularioTicket() {
  document.getElementById('formTicketInfo').reset();
  productosTicketSeleccionados = [];
  document.getElementById('tablaProductosSeleccionados').style.display = 'none';
  document.getElementById('mensajeSinProductos').style.display = 'block';
  actualizarResumenTicket();
}

// CONFIGURAR EVENTOS DE TICKETS
function setupTicketsEvents() {
  // Botón agregar producto
  const btnAgregarProducto = document.getElementById('btnAgregarProducto');
  if (btnAgregarProducto) {
    btnAgregarProducto.addEventListener('click', abrirModalSeleccionProductos);
  }
  
  // Botón enviar ticket
  const btnEnviarTicket = document.getElementById('btnEnviarTicket');
  if (btnEnviarTicket) {
    btnEnviarTicket.addEventListener('click', enviarTicket);
  }
  
  // Botón guardar borrador
  const btnGuardarBorrador = document.getElementById('btnGuardarBorrador');
  if (btnGuardarBorrador) {
    btnGuardarBorrador.addEventListener('click', guardarBorrador);
  }
}

// GUARDAR BORRADOR
function guardarBorrador() {
  const paciente = document.getElementById('pacienteNombre').value.trim();
  if (!paciente) {
    showAlert('Ingrese al menos el nombre del paciente', 'warning');
    return;
  }
  
  const borrador = {
    paciente: paciente,
    habitacion: document.getElementById('habitacion').value.trim(),
    solicitante: document.getElementById('solicitante').value.trim(),
    prioridad: document.getElementById('prioridad').value,
    observaciones: document.getElementById('observaciones').value.trim(),
    productos: productosTicketSeleccionados,
    fecha: new Date().toISOString()
  };
  
  localStorage.setItem('medBorradorTicket', JSON.stringify(borrador));
  showAlert('Ticket guardado como borrador', 'success');
}

// INICIALIZAR TICKETS
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('tickets.html')) {
    setupTicketsEvents();
    actualizarResumenTicket();
    
    // Cargar borrador si existe
    const borrador = localStorage.getItem('medBorradorTicket');
    if (borrador) {
      try {
        const datos = JSON.parse(borrador);
        if (confirm('¿Desea cargar el ticket guardado como borrador?')) {
          document.getElementById('pacienteNombre').value = datos.paciente || '';
          document.getElementById('habitacion').value = datos.habitacion || '';
          document.getElementById('solicitante').value = datos.solicitante || '';
          document.getElementById('prioridad').value = datos.prioridad || 'media';
          document.getElementById('observaciones').value = datos.observaciones || '';
          
          if (datos.productos && datos.productos.length > 0) {
            productosTicketSeleccionados = datos.productos;
            actualizarTablaProductosTicket();
            document.getElementById('tablaProductosSeleccionados').style.display = 'block';
            document.getElementById('mensajeSinProductos').style.display = 'none';
          }
          
          actualizarResumenTicket();
          localStorage.removeItem('medBorradorTicket');
        }
      } catch (error) {
        console.error('Error cargando borrador:', error);
      }
    }
  }
});