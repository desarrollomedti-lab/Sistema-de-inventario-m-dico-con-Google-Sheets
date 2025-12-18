// ============================================
// FUNCIONES PRINCIPALES DEL SISTEMA - COMPLETO
// ============================================

// ACTUALIZAR DASHBOARD
async function updateDashboard() {
  try {
    // Intentar obtener estadísticas desde Google Sheets
    const statsResult = await apiRequest('getDashboardStats');
    
    if (statsResult && statsResult.success) {
      const stats = statsResult.data;
      
      document.getElementById('totalProductos').textContent = stats.totalProductos || 0;
      document.getElementById('totalTickets').textContent = stats.totalTickets || 0;
      document.getElementById('totalPacientes').textContent = stats.pacientesUnicos || 0;
      
      // Cargar productos bajos
      loadProductosBajosDashboard();
      
    } else {
      // Calcular localmente
      calculateLocalStats();
    }
    
    // Cargar tickets recientes
    loadTicketsRecientesDashboard();
    
  } catch (error) {
    console.error('Error actualizando dashboard:', error);
    calculateLocalStats();
  }
}

// CALCULAR ESTADÍSTICAS LOCALES
function calculateLocalStats() {
  // Total productos
  document.getElementById('totalProductos').textContent = productos.length;
  
  // Total tickets activos
  const ticketsActivos = tickets.filter(t => t.estado !== 'completado' && t.estado !== 'cancelado').length;
  document.getElementById('totalTickets').textContent = ticketsActivos;
  
  // Total pacientes únicos
  const pacientesUnicos = [...new Set(tickets.map(t => t.paciente))].length;
  document.getElementById('totalPacientes').textContent = pacientesUnicos;
  
  // Productos bajos en stock
  const productosBajos = productos.filter(p => p.stock < p.minStock).length;
  document.getElementById('productosBajos').textContent = productosBajos;
  
  // Hacer clicable
  const statProductosBajos = document.getElementById('productosBajos');
  if (statProductosBajos) {
    statProductosBajos.style.cursor = 'pointer';
    statProductosBajos.title = 'Click para ver detalles';
    statProductosBajos.addEventListener('click', mostrarProductosBajosDashboard);
  }
}

// CARGAR PRODUCTOS BAJOS EN STOCK PARA DASHBOARD
async function loadProductosBajosDashboard() {
  const statProductosBajos = document.getElementById('productosBajos');
  if (!statProductosBajos) return;
  
  try {
    // Cargar productos actualizados
    const productosResult = await apiRequest('getProductos');
    if (productosResult && productosResult.success) {
      productos = productosResult.data;
    }
    
    const productosBajos = productos.filter(p => p.stock < p.minStock);
    statProductosBajos.textContent = productosBajos.length;
    
    // Hacer clicable
    statProductosBajos.style.cursor = 'pointer';
    statProductosBajos.title = 'Click para ver detalles';
    statProductosBajos.addEventListener('click', mostrarProductosBajosDashboard);
    
  } catch (error) {
    console.error('Error cargando productos bajos:', error);
    statProductosBajos.textContent = '0';
  }
}

// MOSTRAR PRODUCTOS BAJOS EN DASHBOARD
function mostrarProductosBajosDashboard() {
  const productosBajos = productos.filter(p => p.stock < p.minStock);
  const tbody = document.getElementById('tablaProductosBajosDash');
  
  if (!tbody || productosBajos.length === 0) {
    showAlert('No hay productos con stock bajo', 'info');
    return;
  }
  
  tbody.innerHTML = '';
  
  productosBajos.forEach(producto => {
    const diferencia = producto.minStock - producto.stock;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${producto.nombre}</strong><br><small>${producto.codigo}</small></td>
      <td><span class="badge badge-info">${producto.categoria}</span></td>
      <td><span class="text-danger"><strong>${producto.stock}</strong> ${producto.unidad}</span></td>
      <td>${producto.minStock} ${producto.unidad}</td>
      <td><span class="badge badge-danger">-${diferencia}</span></td>
      <td>${producto.ubicacion}</td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById('modalProductosBajosDash').style.display = 'block';
}

// CARGAR TICKETS RECIENTES EN DASHBOARD
async function loadTicketsRecientesDashboard() {
  const container = document.getElementById('ticketsRecientesDash');
  if (!container) return;
  
  try {
    // Cargar tickets actualizados
    const ticketsResult = await apiRequest('getTickets');
    if (ticketsResult && ticketsResult.success) {
      tickets = ticketsResult.data;
    }
    
    // Filtrar tickets de la última semana
    const unaSemanaAtras = new Date();
    unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
    
    const ticketsRecientes = tickets.filter(t => {
      const fechaTicket = new Date(t.fecha);
      return fechaTicket >= unaSemanaAtras;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5); // Últimos 5
    
    container.innerHTML = '';
    
    if (ticketsRecientes.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-3">
          <i class="fas fa-clipboard-list fa-2x mb-2"></i>
          <p>No hay tickets recientes</p>
        </div>
      `;
    } else {
      ticketsRecientes.forEach(ticket => {
        const ticketElement = document.createElement('div');
        ticketElement.className = `ticket-item-reciente ${ticket.estado}`;
        ticketElement.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <strong>#${ticket.id}</strong>
            <span class="badge" style="background-color: ${getColorByEstado(ticket.estado)}">
              ${ticket.estado}
            </span>
          </div>
          <div class="mt-2">
            <small><i class="fas fa-user-injured"></i> ${ticket.paciente}</small><br>
            <small><i class="fas fa-bed"></i> Hab. ${ticket.habitacion}</small>
          </div>
        `;
        
        ticketElement.addEventListener('click', () => {
          window.location.href = `seguimiento.html`;
        });
        
        container.appendChild(ticketElement);
      });
    }
    
  } catch (error) {
    console.error('Error cargando tickets recientes:', error);
    container.innerHTML = '<p class="text-muted">Error cargando tickets</p>';
  }
}

// CARGAR ACTIVIDAD RECIENTE
async function loadRecentActivity() {
  const tbody = document.querySelector('#recentActivity tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  try {
    // Ordenar movimientos por fecha
    const movimientosOrdenados = [...movimientos].sort((a, b) =>
      new Date(b.fecha) - new Date(a.fecha)
    );
    
    // Mostrar solo los 5 más recientes
    movimientosOrdenados.slice(0, 5).forEach(mov => {
      const row = document.createElement('tr');
      
      // Formatear fecha
      const fechaFormateada = new Date(mov.fecha).toLocaleDateString('es-ES');
      
      // Icono según tipo
      const tipoIcon = mov.tipo === 'entrada'
        ? '<i class="fas fa-arrow-down text-success"></i>'
        : '<i class="fas fa-arrow-up text-danger"></i>';
      
      const tipoTexto = mov.tipo === 'entrada' ? 'Entrada' : 'Salida';
      
      row.innerHTML = `
        <td>${fechaFormateada}</td>
        <td>${tipoIcon} ${tipoTexto}</td>
        <td>${mov.usuario || 'Sistema'}</td>
        <td>${mov.producto} (${mov.cantidad} ${getProductUnit(mov.producto)})</td>
      `;
      
      tbody.appendChild(row);
    });
    
  } catch (error) {
    console.error('Error cargando actividad reciente:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">No hay actividad reciente</td>
      </tr>
    `;
  }
}

// CARGAR ALERTAS
async function loadAlerts() {
  const container = document.getElementById('alertasContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  try {
    // Intentar obtener alertas desde Google Sheets
    const alertsResult = await apiRequest('getAlerts');
    
    if (alertsResult && alertsResult.success) {
      alertsResult.data.forEach(alerta => {
        createAlertElement(container, alerta);
      });
    } else {
      // Mostrar alertas locales
      showLocalAlerts(container);
    }
    
  } catch (error) {
    console.error('Error cargando alertas:', error);
    showLocalAlerts(container);
  }
}

// CREAR ELEMENTO DE ALERTA
function createAlertElement(container, alerta) {
  const alertaElement = document.createElement('div');
  alertaElement.className = 'alert-item';
  
  let iconClass = 'fas fa-info-circle';
  if (alerta.tipo === 'warning') iconClass = 'fas fa-exclamation-triangle text-warning';
  if (alerta.tipo === 'success') iconClass = 'fas fa-check-circle text-success';
  if (alerta.tipo === 'error') iconClass = 'fas fa-times-circle text-danger';
  
  alertaElement.innerHTML = `
    <div class="alert-header">
      <i class="${iconClass}"></i>
      <strong>${alerta.titulo}</strong>
    </div>
    <p>${alerta.mensaje}</p>
    ${alerta.productos ? `<small>${alerta.productos.join(', ')}</small>` : ''}
  `;
  
  container.appendChild(alertaElement);
}

// MOSTRAR ALERTAS LOCALES
function showLocalAlerts(container) {
  // Alertas de stock bajo
  const productosBajos = productos.filter(p => p.stock < p.minStock);
  
  if (productosBajos.length > 0) {
    const alerta = document.createElement('div');
    alerta.className = 'alert-item';
    alerta.innerHTML = `
      <div class="alert-header">
        <i class="fas fa-exclamation-triangle text-warning"></i>
        <strong>Stock bajo</strong>
      </div>
      <p>${productosBajos.length} producto(s) con stock por debajo del mínimo.</p>
      <small>${productosBajos.map(p => p.nombre).join(', ')}</small>
    `;
    container.appendChild(alerta);
  } else {
    const alerta = document.createElement('div');
    alerta.className = 'alert-item';
    alerta.innerHTML = `
      <div class="alert-header">
        <i class="fas fa-check-circle text-success"></i>
        <strong>Stock óptimo</strong>
      </div>
      <p>Todos los productos tienen stock suficiente.</p>
    `;
    container.appendChild(alerta);
  }
  
  // Alertas de tickets pendientes
  const ticketsPendientes = tickets.filter(t => t.estado === 'pendiente');
  if (ticketsPendientes.length > 0) {
    const alerta = document.createElement('div');
    alerta.className = 'alert-item';
    alerta.innerHTML = `
      <div class="alert-header">
        <i class="fas fa-clipboard-list text-danger"></i>
        <strong>Tickets pendientes</strong>
      </div>
      <p>${ticketsPendientes.length} ticket(s) pendientes de procesar.</p>
    `;
    container.appendChild(alerta);
  }
}

// OBTENER UNIDAD DE PRODUCTO
function getProductUnit(productName) {
  const producto = productos.find(p => p.nombre === productName);
  return producto ? producto.unidad : 'unidad';
}

// FUNCIÓN PARA ACTUALIZAR FECHA EN DASHBOARD
function updateCurrentDate() {
  const dateElement = document.getElementById('currentDate');
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// IR A INVENTARIO DESDE MODAL
function irAInventario() {
  window.location.href = 'inventario.html';
}

// CERRAR MODAL
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// INICIALIZAR DASHBOARD
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('dashboard.html')) {
    updateCurrentDate();
    updateDashboard();
    loadRecentActivity();
    loadAlerts();
    
    // Actualizar cada 30 segundos
    setInterval(() => {
      updateDashboard();
      loadRecentActivity();
      loadAlerts();
    }, 30000);
  }
});