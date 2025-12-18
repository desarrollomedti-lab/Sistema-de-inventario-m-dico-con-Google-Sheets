// ============================================
// SEGUIMIENTO DE TICKETS - COMPLETO
// ============================================

// VARIABLES GLOBALES
let currentTicketPage = 1;
const ticketsPerPage = 10;
let ticketsFiltrados = [];
let ticketSeleccionado = null;

// CARGAR TICKETS CON PAGINACIÓN Y FILTROS
async function loadSeguimientoTickets(page = 1, filtroEstado = 'todos') {
  const tbody = document.querySelector('#tablaTickets tbody');
  if (!tbody) return;
  
  currentTicketPage = page;
  
  try {
    // Cargar tickets actualizados
    const ticketsResult = await apiRequest('getTickets');
    if (ticketsResult && ticketsResult.success) {
      tickets = ticketsResult.data;
      saveLocalData();
    }
    
    // Aplicar filtro de estado
    if (filtroEstado === 'todos') {
      ticketsFiltrados = [...tickets];
    } else {
      ticketsFiltrados = tickets.filter(t => t.estado === filtroEstado);
    }
    
    // Ordenar por fecha (más recientes primero)
    ticketsFiltrados.sort((a, b) => 
      new Date(b.fechaCreacion || b.fecha) - new Date(a.fechaCreacion || a.fecha)
    );
    
    // Calcular paginación
    const totalPages = Math.ceil(ticketsFiltrados.length / ticketsPerPage);
    const startIndex = (page - 1) * ticketsPerPage;
    const ticketsPagina = ticketsFiltrados.slice(startIndex, startIndex + ticketsPerPage);
    
    tbody.innerHTML = '';
    
    if (ticketsPagina.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4">
            <i class="fas fa-clipboard-list fa-2x mb-2 text-muted"></i>
            <p class="text-muted">No hay tickets en este estado</p>
          </td>
        </tr>
      `;
    } else {
      ticketsPagina.forEach(ticket => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.dataset.ticketId = ticket.id;
        
        // Formatear fecha
        const fechaFormateada = new Date(ticket.fecha).toLocaleDateString('es-ES');
        
        // Contar productos
        const numProductos = ticket.productos ? ticket.productos.length : 0;
        
        // Determinar color de prioridad
        let prioridadColor = '';
        switch(ticket.prioridad) {
          case 'baja': prioridadColor = '#2ecc71'; break;
          case 'media': prioridadColor = '#f39c12'; break;
          case 'alta': prioridadColor = '#e74c3c'; break;
          case 'urgente': prioridadColor = '#9b59b6'; break;
        }
        
        row.innerHTML = `
          <td><strong>#${ticket.id}</strong></td>
          <td>${fechaFormateada}</td>
          <td>${ticket.paciente}</td>
          <td>${ticket.habitacion}</td>
          <td>${numProductos} producto(s)</td>
          <td>${ticket.solicitante}</td>
          <td><span class="badge" style="background-color: ${prioridadColor}; color: white;">${ticket.prioridad}</span></td>
          <td><span class="badge" style="background-color: ${getColorByEstado(ticket.estado)}; color: white;">${ticket.estado}</span></td>
          <td>
            <button class="btn btn-sm" onclick="verDetalleTicket(${ticket.id})" title="Ver detalle">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        `;
        
        // Evento para seleccionar fila
        row.addEventListener('click', function(e) {
          if (!e.target.closest('button')) {
            verDetalleTicket(ticket.id);
          }
        });
        
        tbody.appendChild(row);
      });
    }
    
    // Actualizar estadísticas
    updateEstadisticas();
    
    // Generar paginación
    const paginationContainer = document.getElementById('paginationTickets');
    if (paginationContainer) {
      generatePagination(page, totalPages, 'paginationTickets', 
        (newPage) => loadSeguimientoTickets(newPage, filtroEstado));
    }
    
  } catch (error) {
    console.error('Error cargando tickets:', error);
    showAlert('Error cargando tickets', 'error');
  }
}

// CONFIGURAR EVENTOS CON FILTROS
function setupSeguimientoEvents() {
  // Filtro por estado
  const filtroEstado = document.getElementById('filtroEstado');
  if (filtroEstado) {
    filtroEstado.addEventListener('change', function() {
      loadSeguimientoTickets(1, this.value);
    });
  }
  
  // Búsqueda de tickets
  const buscarTicket = document.getElementById('buscarTicket');
  if (buscarTicket) {
    buscarTicket.addEventListener('input', function() {
      const termino = this.value.toLowerCase();
      const rows = document.querySelectorAll('#tablaTickets tbody tr');
      
      rows.forEach(row => {
        const texto = row.textContent.toLowerCase();
        row.style.display = texto.includes(termino) ? '' : 'none';
      });
    });
  }
  
  // Botones de acciones
  const btnMarcarProceso = document.getElementById('btnMarcarProceso');
  if (btnMarcarProceso) {
    btnMarcarProceso.addEventListener('click', function() {
      if (ticketSeleccionado) {
        cambiarEstadoTicket(ticketSeleccionado.id, 'proceso');
      }
    });
  }
  
  const btnMarcarCompletado = document.getElementById('btnMarcarCompletado');
  if (btnMarcarCompletado) {
    btnMarcarCompletado.addEventListener('click', function() {
      if (ticketSeleccionado) {
        cambiarEstadoTicket(ticketSeleccionado.id, 'completado');
      }
    });
  }
  
  const btnCancelarTicket = document.getElementById('btnCancelarTicket');
  if (btnCancelarTicket) {
    btnCancelarTicket.addEventListener('click', function() {
      if (ticketSeleccionado) {
        if (confirm('¿Está seguro de cancelar este ticket?')) {
          cambiarEstadoTicket(ticketSeleccionado.id, 'cancelado');
        }
      }
    });
  }
  
  // Botón REABRIR solo para ADMIN
  const userData = JSON.parse(localStorage.getItem('medUser'));
  if (userData && userData.role === 'admin') {
    const btnReabrirTicket = document.createElement('button');
    btnReabrirTicket.id = 'btnReabrirTicket';
    btnReabrirTicket.className = 'btn btn-info btn-sm';
    btnReabrirTicket.innerHTML = '<i class="fas fa-redo"></i> Reabrir Ticket';
    btnReabrirTicket.style.marginLeft = '5px';
    btnReabrirTicket.addEventListener('click', function() {
      if (ticketSeleccionado) {
        if (confirm('¿Reabrir este ticket?')) {
          cambiarEstadoTicket(ticketSeleccionado.id, 'pendiente');
        }
      }
    });
    
    const ticketActions = document.getElementById('ticketActions');
    if (ticketActions) {
      ticketActions.appendChild(btnReabrirTicket);
    }
  }
}

// VER DETALLE DE TICKET
function verDetalleTicket(ticketId) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  
  ticketSeleccionado = ticket;
  
  const detalleContainer = document.getElementById('detalleTicket');
  const ticketActions = document.getElementById('ticketActions');
  
  if (!detalleContainer || !ticketActions) return;
  
  // Formatear fecha
  const fechaFormateada = new Date(ticket.fecha).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Mostrar acciones según estado
  ticketActions.style.display = 'flex';
  
  // Configurar visibilidad de botones según estado
  const btnMarcarProceso = document.getElementById('btnMarcarProceso');
  const btnMarcarCompletado = document.getElementById('btnMarcarCompletado');
  const btnCancelarTicket = document.getElementById('btnCancelarTicket');
  const btnReabrirTicket = document.getElementById('btnReabrirTicket');
  
  if (btnMarcarProceso) btnMarcarProceso.style.display = ticket.estado === 'pendiente' ? 'inline-block' : 'none';
  if (btnMarcarCompletado) btnMarcarCompletado.style.display = ticket.estado === 'proceso' ? 'inline-block' : 'none';
  if (btnCancelarTicket) btnCancelarTicket.style.display = ticket.estado !== 'completado' && ticket.estado !== 'cancelado' ? 'inline-block' : 'none';
  if (btnReabrirTicket) btnReabrirTicket.style.display = (ticket.estado === 'completado' || ticket.estado === 'cancelado') ? 'inline-block' : 'none';
  
  // Mostrar productos del ticket
  let productosHTML = '';
  if (ticket.productos && ticket.productos.length > 0) {
    productosHTML = `
      <div class="mt-3">
        <h5><i class="fas fa-boxes"></i> Productos Solicitados</h5>
        <div class="table-responsive mt-2">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${ticket.productos.map((producto, index) => {
                const cantidad = ticket.cantidad && ticket.cantidad[index] ? ticket.cantidad[index] : 1;
                return `
                  <tr>
                    <td>${producto}</td>
                    <td>${cantidad}</td>
                    <td>
                      <span class="badge ${ticket.estado === 'completado' ? 'badge-success' : 'badge-warning'}">
                        ${ticket.estado === 'completado' ? 'Entregado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  detalleContainer.innerHTML = `
    <div class="ticket-detalle">
      <div class="row">
        <div class="col-md-6">
          <div class="info-group">
            <h4><i class="fas fa-user-injured"></i> Información del Paciente</h4>
            <div class="info-item">
              <strong>Paciente:</strong> ${ticket.paciente}
            </div>
            <div class="info-item">
              <strong>Habitación:</strong> ${ticket.habitacion}
            </div>
            <div class="info-item">
              <strong>Solicitante:</strong> ${ticket.solicitante}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="info-group">
            <h4><i class="fas fa-info-circle"></i> Detalles del Ticket</h4>
            <div class="info-item">
              <strong>ID:</strong> #${ticket.id}
            </div>
            <div class="info-item">
              <strong>Fecha:</strong> ${fechaFormateada}
            </div>
            <div class="info-item">
              <strong>Prioridad:</strong> 
              <span class="badge" style="background-color: ${getPrioridadColor(ticket.prioridad)}">
                ${ticket.prioridad}
              </span>
            </div>
            <div class="info-item">
              <strong>Estado:</strong> 
              <span class="badge" style="background-color: ${getColorByEstado(ticket.estado)}">
                ${ticket.estado}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      ${ticket.observaciones ? `
        <div class="mt-3">
          <h5><i class="fas fa-sticky-note"></i> Observaciones</h5>
          <div class="alert alert-light">${ticket.observaciones}</div>
        </div>
      ` : ''}
      
      ${productosHTML}
      
      <div class="mt-3 text-muted small">
        <i class="fas fa-clock"></i> Última actualización: ${new Date().toLocaleString('es-ES')}
      </div>
    </div>
  `;
  
  // Hacer scroll suave al detalle
  detalleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// CAMBIAR ESTADO DE TICKET
async function cambiarEstadoTicket(ticketId, nuevoEstado) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  
  const estadoAnterior = ticket.estado;
  ticket.estado = nuevoEstado;
  
  // Mostrar indicador de carga
  const buttons = document.querySelectorAll('#ticketActions button');
  buttons.forEach(btn => {
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.dataset.originalText = originalText;
  });
  
  try {
    const userData = JSON.parse(localStorage.getItem('medUser'));
    
    // Intentar actualizar en Google Sheets
    const result = await apiRequest('updateTicketStatus', {
      ticketId: ticketId,
      estado: nuevoEstado,
      usuario: userData ? userData.username : 'sistema'
    });
    
    if (result && result.success) {
      // Si se completó, actualizar stock localmente
      if (nuevoEstado === 'completado' && estadoAnterior !== 'completado') {
        actualizarStockPorTicket(ticket);
      }
      
      // Guardar localmente
      saveLocalData();
      
      // Recargar vista
      loadSeguimientoTickets(currentTicketPage, document.getElementById('filtroEstado').value);
      verDetalleTicket(ticketId);
      
      showAlert(`Ticket #${ticketId} actualizado a "${nuevoEstado}"`, 'success');
      
    } else {
      showAlert(result?.message || 'Error actualizando ticket', 'error');
      // Revertir cambio local
      ticket.estado = estadoAnterior;
    }
    
  } catch (error) {
    console.error('Error actualizando ticket:', error);
    showAlert('Error al actualizar el ticket', 'error');
    ticket.estado = estadoAnterior;
  } finally {
    // Restaurar botones
    buttons.forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.originalText) {
        btn.innerHTML = btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    });
  }
}

// OBTENER COLOR SEGÚN ESTADO
function getColorByEstado(estado) {
  switch(estado) {
    case 'pendiente': return '#f39c12';
    case 'proceso': return '#3498db';
    case 'completado': return '#2ecc71';
    case 'cancelado': return '#e74c3c';
    default: return '#95a5a6';
  }
}

// OBTENER COLOR DE PRIORIDAD
function getPrioridadColor(prioridad) {
  switch(prioridad) {
    case 'baja': return '#2ecc71';
    case 'media': return '#f39c12';
    case 'alta': return '#e74c3c';
    case 'urgente': return '#9b59b6';
    default: return '#95a5a6';
  }
}

// ACTUALIZAR ESTADÍSTICAS
function updateEstadisticas() {
  // Contadores por estado
  const pendientes = tickets.filter(t => t.estado === 'pendiente').length;
  const enProceso = tickets.filter(t => t.estado === 'proceso').length;
  const completados = tickets.filter(t => t.estado === 'completado').length;
  const cancelados = tickets.filter(t => t.estado === 'cancelado').length;
  
  document.getElementById('contadorPendientes').textContent = `${pendientes} Pendientes`;
  document.getElementById('contadorProceso').textContent = `${enProceso} En proceso`;
  document.getElementById('contadorCompletados').textContent = `${completados} Completados`;
  
  // Estadísticas por prioridad
  const prioridadAlta = tickets.filter(t => t.prioridad === 'alta' || t.prioridad === 'urgente').length;
  const prioridadMedia = tickets.filter(t => t.prioridad === 'media').length;
  const prioridadBaja = tickets.filter(t => t.prioridad === 'baja').length;
  
  document.getElementById('prioridadAlta').textContent = prioridadAlta;
  document.getElementById('prioridadMedia').textContent = prioridadMedia;
  document.getElementById('prioridadBaja').textContent = prioridadBaja;
  
  // Tiempo promedio de atención (solo para tickets completados)
  const tiempoPromedio = calcularTiempoPromedioAtencion();
  document.getElementById('tiempoPromedio').textContent = tiempoPromedio;
  
  // Productos más solicitados
  mostrarProductosMasSolicitados();
}

// CALCULAR TIEMPO PROMEDIO DE ATENCIÓN
function calcularTiempoPromedioAtencion() {
  const ticketsCompletados = tickets.filter(t => t.estado === 'completado');
  
  if (ticketsCompletados.length === 0) return '0 horas';
  
  let totalHoras = 0;
  const ahora = new Date();
  
  ticketsCompletados.forEach(ticket => {
    const fechaCreacion = new Date(ticket.fechaCreacion || ticket.fecha);
    const diferenciaMs = ahora - fechaCreacion;
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    totalHoras += diferenciaHoras;
  });
  
  const promedioHoras = Math.round(totalHoras / ticketsCompletados.length);
  
  if (promedioHoras < 24) {
    return `${promedioHoras} horas`;
  } else {
    const promedioDias = Math.round(promedioHoras / 24);
    return `${promedioDias} días`;
  }
}

// MOSTRAR PRODUCTOS MÁS SOLICITADOS
function mostrarProductosMasSolicitados() {
  const container = document.getElementById('topProductos');
  if (!container) return;
  
  // Contar productos más solicitados
  const conteoProductos = {};
  
  tickets.forEach(ticket => {
    if (ticket.productos && Array.isArray(ticket.productos)) {
      ticket.productos.forEach(producto => {
        conteoProductos[producto] = (conteoProductos[producto] || 0) + 1;
      });
    }
  });
  
  // Ordenar por frecuencia
  const productosOrdenados = Object.entries(conteoProductos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5
  
  if (productosOrdenados.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay datos suficientes</p>';
    return;
  }
  
  container.innerHTML = productosOrdenados.map(([producto, cantidad], index) => `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div>
        <span class="badge badge-primary mr-2">${index + 1}</span>
        <span>${producto}</span>
      </div>
      <span class="badge badge-secondary">${cantidad}</span>
    </div>
  `).join('');
}

// ACTUALIZAR STOCK POR TICKET (cuando se completa)
function actualizarStockPorTicket(ticket) {
  if (!ticket.productos || !ticket.cantidad) return;
  
  ticket.productos.forEach((productoNombre, index) => {
    const cantidad = ticket.cantidad[index] || 1;
    const producto = productos.find(p => p.nombre === productoNombre);
    
    if (producto) {
      // Actualizar stock local
      producto.stock -= cantidad;
      
      // Registrar movimiento
      const movimiento = {
        id: movimientos.length + 1,
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'salida',
        producto: productoNombre,
        cantidad: cantidad,
        usuario: 'sistema',
        motivo: `Ticket #${ticket.id} - ${ticket.paciente}`
      };
      
      movimientos.push(movimiento);
    }
  });
  
  saveLocalData();
}

// INICIALIZAR SEGUIMIENTO
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('seguimiento.html')) {
    // Crear contenedor de paginación si no existe
    const cardBody = document.querySelector('.card-body');
    if (cardBody && !document.getElementById('paginationTickets')) {
      const paginationDiv = document.createElement('div');
      paginationDiv.className = 'pagination-container mt-3 text-center';
      paginationDiv.id = 'paginationContainer';
      paginationDiv.innerHTML = `
        <div id="paginationTickets"></div>
        <small class="text-muted" id="paginationTicketInfo">Mostrando 0 de 0 tickets</small>
      `;
      cardBody.appendChild(paginationDiv);
    }
    
    setupSeguimientoEvents();
    loadSeguimientoTickets(1, 'todos');
  }
});