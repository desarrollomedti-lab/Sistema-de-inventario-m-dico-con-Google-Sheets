// ============================================
// SISTEMA DE AUTENTICACIÓN - COMPLETO
// ============================================

// CONFIGURACIÓN - ¡REEMPLAZA ESTA URL!
const API_URL = 'https://script.google.com/macros/s/AKfycbw4eUaaZ2SFxfrZ6nCzPR2r1qaHQ5OWGDgipL-oHdmNyHEx6RlkI3pnb4d41Jk6X8nF/exec';

// VARIABLES GLOBALES
let productos = [];
let tickets = [];
let movimientos = [];
let productosTicket = [];

// FUNCIÓN PARA PETICIONES HTTP
async function apiRequest(action, data = {}) {
  try {
    // Crear URL con parámetros
    let url = `${API_URL}?action=${action}`;
    
    // Agregar datos como parámetros URL
    const params = new URLSearchParams();
    for (const key in data) {
      if (data[key] !== null && data[key] !== undefined) {
        params.append(key, data[key]);
      }
    }
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    console.log('Enviando petición a:', url);
    
    // Hacer la petición
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Respuesta recibida:', result);
    
    if (!result.success) {
      showAlert(result.message || 'Error en la petición', 'error');
      return null;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error en apiRequest:', error);
    
    // Si falla la conexión, usar modo local
    console.log('Usando modo local...');
    
    // Para login, verificar localmente
    if (action === 'login') {
      return verifyLocalLogin(data);
    }
    
    // Para otras acciones, cargar datos locales
    return loadLocalData(action);
  }
}

// VERIFICAR LOGIN LOCALMENTE
function verifyLocalLogin(data) {
  const localUsers = {
    'almacen': { password: '123', role: 'almacen', name: 'Responsable de Almacén' },
    'enfermeria': { password: '123', role: 'enfermeria', name: 'Enfermera/o' },
    'admin': { password: '123', role: 'admin', name: 'Administrador' }
  };
  
  const user = localUsers[data.username];
  if (user && user.password === data.password && user.role === data.role) {
    return {
      success: true,
      user: {
        username: data.username,
        role: data.role,
        name: user.name
      }
    };
  }
  
  return { success: false, message: 'Credenciales incorrectas' };
}

// CARGAR DATOS LOCALES
function loadLocalData(action) {
  try {
    switch(action) {
      case 'getProductos':
        const productosData = JSON.parse(localStorage.getItem('medProductos') || '[]');
        return { success: true, data: productosData };
        
      case 'getTickets':
        const ticketsData = JSON.parse(localStorage.getItem('medTickets') || '[]');
        return { success: true, data: ticketsData };
        
      case 'getDashboardStats':
        const productos = JSON.parse(localStorage.getItem('medProductos') || '[]');
        const tickets = JSON.parse(localStorage.getItem('medTickets') || '[]');
        
        return {
          success: true,
          data: {
            totalProductos: productos.length,
            totalTickets: tickets.filter(t => t.estado !== 'completado').length,
            productosBajosStock: productos.filter(p => p.stock < p.minStock).length,
            pacientesUnicos: [...new Set(tickets.map(t => t.paciente))].length
          }
        };
        
      case 'getAlerts':
        const productosAlert = JSON.parse(localStorage.getItem('medProductos') || '[]');
        const ticketsAlert = JSON.parse(localStorage.getItem('medTickets') || '[]');
        const alertas = [];
        
        const productosBajos = productosAlert.filter(p => p.stock < p.minStock);
        if (productosBajos.length > 0) {
          alertas.push({
            tipo: 'warning',
            titulo: 'Stock bajo',
            mensaje: `${productosBajos.length} producto(s) con stock bajo`
          });
        }
        
        const ticketsPendientes = ticketsAlert.filter(t => t.estado === 'pendiente');
        if (ticketsPendientes.length > 0) {
          alertas.push({
            tipo: 'info',
            titulo: 'Tickets pendientes',
            mensaje: `${ticketsPendientes.length} ticket(s) pendientes`
          });
        }
        
        if (alertas.length === 0) {
          alertas.push({
            tipo: 'success',
            titulo: 'Todo en orden',
            mensaje: 'No hay alertas críticas'
          });
        }
        
        return { success: true, data: alertas };
        
      default:
        return { success: false, message: 'Acción no disponible en modo local' };
    }
  } catch (error) {
    console.error('Error cargando datos locales:', error);
    return { success: false, message: 'Error cargando datos locales' };
  }
}

// MOSTRAR ALERTAS
function showAlert(message, type = 'info') {
  // Crear elemento de alerta
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  // Estilos
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 10px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    animation: fadeInUp 0.3s ease-out;
  `;
  
  // Colores según tipo
  if (type === 'error') {
    alertDiv.style.backgroundColor = '#e74c3c';
  } else if (type === 'success') {
    alertDiv.style.backgroundColor = '#2ecc71';
  } else if (type === 'warning') {
    alertDiv.style.backgroundColor = '#f39c12';
  } else {
    alertDiv.style.backgroundColor = '#3498db';
  }
  
  // Agregar al documento
  document.body.appendChild(alertDiv);
  
  // Eliminar después de 5 segundos
  setTimeout(() => {
    alertDiv.style.opacity = '0';
    alertDiv.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (alertDiv.parentNode) {
        document.body.removeChild(alertDiv);
      }
    }, 500);
  }, 5000);
}

// ============================================
// MANEJADOR DE LOGIN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      
      // Validaciones
      if (!username || !password || !role) {
        showAlert('Por favor complete todos los campos', 'error');
        return;
      }
      
      // Mostrar indicador de carga
      const submitBtn = this.querySelector('.btn-login');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
      submitBtn.disabled = true;
      
      try {
        // Intentar login con Google Sheets
        const result = await apiRequest('login', {
          username: username,
          password: password,
          role: role
        });
        
        if (result && result.success) {
          // Guardar sesión
          const userData = {
            username: username,
            role: role,
            name: result.user.name,
            loginTime: new Date().toISOString()
          };
          
          localStorage.setItem('medUser', JSON.stringify(userData));
          
          // Cargar datos iniciales
          await loadInitialData();
          
          // Redirigir con mensaje
          showAlert(`Bienvenido ${result.user.name}`, 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1500);
          
        } else {
          showAlert(result?.message || 'Credenciales incorrectas', 'error');
        }
        
      } catch (error) {
        console.error('Error en login:', error);
        showAlert('Error de conexión. Usando modo local.', 'warning');
      } finally {
        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }
  
  // Verificar sesión existente
  checkExistingSession();
});

// VERIFICAR SESIÓN EXISTENTE
function checkExistingSession() {
  const currentPage = window.location.pathname.split('/').pop();
  
  // Si no estamos en login, verificar sesión
  if (currentPage !== 'index.html' && currentPage !== '') {
    const userData = localStorage.getItem('medUser');
    if (!userData) {
      window.location.href = 'index.html';
      return;
    }
    
    // Mostrar información del usuario
    const user = JSON.parse(userData);
    updateUserUI(user);
    
    // Ajustar UI según rol
    adjustUIForRole(user.role);
  }
}

// ACTUALIZAR INTERFAZ DE USUARIO
function updateUserUI(user) {
  const userInfoElements = document.querySelectorAll('.user-name, .user-role');
  
  userInfoElements.forEach(element => {
    if (element.classList.contains('user-name')) {
      element.textContent = user.name;
    } else if (element.classList.contains('user-role')) {
      const roles = {
        'almacen': 'Almacén',
        'enfermeria': 'Enfermería',
        'admin': 'Administrador'
      };
      element.textContent = roles[user.role] || user.role;
    }
  });
}

// AJUSTAR UI SEGÚN ROL
function adjustUIForRole(role) {
  const navItems = document.querySelectorAll('.nav-link');
  const pageTitle = document.querySelector('.page-title');
  
  navItems.forEach(item => {
    const itemRole = item.getAttribute('data-role');
    if (itemRole && !itemRole.includes(role) && role !== 'admin') {
      item.parentElement.style.display = 'none';
    }
  });
  
  if (pageTitle) {
    if (role === 'almacen') {
      pageTitle.innerHTML = '<i class="fas fa-warehouse"></i> Dashboard - Almacén';
    } else if (role === 'enfermeria') {
      pageTitle.innerHTML = '<i class="fas fa-user-nurse"></i> Dashboard - Enfermería';
    }
  }
}

// CARGAR DATOS INICIALES CON PAGINACIÓN
async function loadInitialData() {
  try {
    // Cargar productos actualizados
    const productosResult = await apiRequest('getProductos');
    if (productosResult && productosResult.success) {
      productos = productosResult.data;
      localStorage.setItem('medProductos', JSON.stringify(productos));
      
      // Guardar solo primeros 10 para vista inicial
      localStorage.setItem('medProductosFirstPage', JSON.stringify(productos.slice(0, 10)));
    }
    
    // Cargar tickets actualizados
    const ticketsResult = await apiRequest('getTickets');
    if (ticketsResult && ticketsResult.success) {
      tickets = ticketsResult.data;
      localStorage.setItem('medTickets', JSON.stringify(tickets));
      
      // Guardar solo tickets de la última semana
      const unaSemanaAtras = new Date();
      unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
      
      const ticketsRecientes = tickets.filter(t => {
        const fechaTicket = new Date(t.fecha);
        return fechaTicket >= unaSemanaAtras;
      });
      
      localStorage.setItem('medTicketsRecientes', JSON.stringify(ticketsRecientes.slice(0, 10)));
    }
    
    // Si no hay datos, usar ejemplos
    if (!productos || productos.length === 0) {
      productos = getDefaultProductos();
      localStorage.setItem('medProductos', JSON.stringify(productos));
      localStorage.setItem('medProductosFirstPage', JSON.stringify(productos.slice(0, 10)));
    }
    
    if (!tickets || tickets.length === 0) {
      tickets = getDefaultTickets();
      localStorage.setItem('medTickets', JSON.stringify(tickets));
      
      const unaSemanaAtras = new Date();
      unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
      const ticketsRecientes = tickets.filter(t => {
        const fechaTicket = new Date(t.fecha);
        return fechaTicket >= unaSemanaAtras;
      });
      
      localStorage.setItem('medTicketsRecientes', JSON.stringify(ticketsRecientes.slice(0, 10)));
    }
    
    console.log('Datos iniciales cargados:', {
      productos: productos.length,
      tickets: tickets.length
    });
    
  } catch (error) {
    console.error('Error cargando datos iniciales:', error);
    // Usar datos por defecto
    productos = getDefaultProductos();
    tickets = getDefaultTickets();
    localStorage.setItem('medProductos', JSON.stringify(productos));
    localStorage.setItem('medTickets', JSON.stringify(tickets));
    localStorage.setItem('medProductosFirstPage', JSON.stringify(productos.slice(0, 10)));
    
    const unaSemanaAtras = new Date();
    unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
    const ticketsRecientes = tickets.filter(t => {
      const fechaTicket = new Date(t.fecha);
      return fechaTicket >= unaSemanaAtras;
    });
    
    localStorage.setItem('medTicketsRecientes', JSON.stringify(ticketsRecientes.slice(0, 10)));
  }
}

// DATOS POR DEFECTO
function getDefaultProductos() {
  return [
    { id: 1, codigo: 'MED001', nombre: 'Guantes de látex', categoria: 'Insumos', stock: 150, minStock: 50, unidad: 'par', ubicacion: 'Estante A1' },
    { id: 2, codigo: 'MED002', nombre: 'Jeringa 10ml', categoria: 'Insumos', stock: 200, minStock: 100, unidad: 'unidad', ubicacion: 'Estante B2' },
    { id: 3, codigo: 'MED003', nombre: 'Gasas estériles', categoria: 'Curaciones', stock: 80, minStock: 30, unidad: 'paquete', ubicacion: 'Estante C3' },
    { id: 4, codigo: 'MED004', nombre: 'Alcohol antiséptico', categoria: 'Limpieza', stock: 45, minStock: 20, unidad: 'litro', ubicacion: 'Estante D4' },
    { id: 5, codigo: 'MED005', nombre: 'Mascarilla N95', categoria: 'Protección', stock: 120, minStock: 60, unidad: 'unidad', ubicacion: 'Estante A2' },
    { id: 6, codigo: 'MED006', nombre: 'Termómetro digital', categoria: 'Instrumental', stock: 15, minStock: 10, unidad: 'unidad', ubicacion: 'Estante E1' }
  ];
}

function getDefaultTickets() {
  return [
    { id: 1001, fecha: '2023-10-15', solicitante: 'Enf. Martínez', paciente: 'Juan Pérez', habitacion: '201', productos: ['Guantes de látex', 'Jeringa 10ml'], cantidad: [2, 5], estado: 'completado', prioridad: 'media' },
    { id: 1002, fecha: '2023-10-16', solicitante: 'Enf. Rodríguez', paciente: 'María González', habitacion: '305', productos: ['Gasas estériles', 'Alcohol antiséptico'], cantidad: [3, 1], estado: 'proceso', prioridad: 'alta' },
    { id: 1003, fecha: '2023-10-17', solicitante: 'Enf. López', paciente: 'Carlos Sánchez', habitacion: '102', productos: ['Mascarilla N95'], cantidad: [10], estado: 'pendiente', prioridad: 'baja' }
  ];
}

// CERRAR SESIÓN
function logout() {
  if (confirm('¿Está seguro de cerrar sesión?')) {
    localStorage.removeItem('medUser');
    showAlert('Sesión cerrada', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  }
}

// INICIALIZAR BOTÓN DE LOGOUT
document.addEventListener('DOMContentLoaded', function() {
  const logoutBtn = document.querySelector('.btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

// FUNCIÓN PARA GUARDAR DATOS LOCALMENTE
function saveLocalData() {
  try {
    localStorage.setItem('medProductos', JSON.stringify(productos));
    localStorage.setItem('medTickets', JSON.stringify(tickets));
    localStorage.setItem('medMovimientos', JSON.stringify(movimientos));
    return true;
  } catch (error) {
    console.error('Error guardando datos locales:', error);
    return false;
  }
}

// FUNCIÓN PARA PAGINACIÓN DE PRODUCTOS
function paginateProductos(page = 1, itemsPerPage = 10) {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return productos.slice(startIndex, endIndex);
}

// FUNCIÓN PARA PAGINACIÓN DE TICKETS
function paginateTickets(page = 1, itemsPerPage = 10) {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return tickets.slice(startIndex, endIndex);
}

// GENERAR HTML DE PAGINACIÓN
function generatePagination(currentPage, totalPages, containerId, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  // Botón Anterior
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.onclick = () => callback(currentPage - 1);
    container.appendChild(prevBtn);
  }
  
  // Números de página
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : ''}`;
    pageBtn.textContent = i;
    pageBtn.onclick = () => callback(i);
    container.appendChild(pageBtn);
  }
  
  // Botón Siguiente
  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.onclick = () => callback(currentPage + 1);
    container.appendChild(nextBtn);
  }
}
