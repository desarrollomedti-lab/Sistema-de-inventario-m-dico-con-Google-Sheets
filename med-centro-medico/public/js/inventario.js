// ============================================
// GESTIÓN DE INVENTARIO - COMPLETO
// ============================================

// VARIABLES GLOBALES
let currentProductPage = 1;
const itemsPerPage = 10;
let categorias = ['Insumos', 'Curaciones', 'Medicamentos', 'Limpieza', 'Protección', 'Instrumental'];
let unidades = ['unidad', 'par', 'caja', 'paquete', 'litro', 'metro'];

// CARGAR INVENTARIO CON PAGINACIÓN
async function loadInventario(page = 1) {
  const tbody = document.querySelector('#productosBody');
  if (!tbody) return;
  
  currentProductPage = page;
  
  try {
    // Cargar productos actualizados
    const productosResult = await apiRequest('getProductos');
    if (productosResult && productosResult.success) {
      productos = productosResult.data;
      saveLocalData();
    }
    
    // Calcular paginación
    const totalPages = Math.ceil(productos.length / itemsPerPage);
    const productosPagina = paginateProductos(page, itemsPerPage);
    
    tbody.innerHTML = '';
    
    if (productosPagina.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center">
            <i class="fas fa-box-open fa-2x mb-2"></i><br>
            No hay productos en el inventario
          </td>
        </tr>
      `;
    } else {
      productosPagina.forEach(producto => {
        const row = document.createElement('tr');
        
        let estado = '';
        let estadoClass = '';
        
        if (producto.stock === 0) {
          estado = 'Agotado';
          estadoClass = 'badge-danger';
        } else if (producto.stock < producto.minStock) {
          estado = 'Bajo';
          estadoClass = 'badge-warning';
        } else if (producto.stock < producto.minStock * 2) {
          estado = 'Medio';
          estadoClass = 'badge-info';
        } else {
          estado = 'Óptimo';
          estadoClass = 'badge-success';
        }
        
        row.innerHTML = `
          <td>${producto.codigo}</td>
          <td><strong>${producto.nombre}</strong></td>
          <td>${producto.categoria}</td>
          <td>${producto.stock}</td>
          <td>${producto.minStock}</td>
          <td>${producto.unidad}</td>
          <td>${producto.ubicacion}</td>
          <td><span class="badge ${estadoClass}">${estado}</span></td>
          <td>
            <button class="btn btn-sm" onclick="editarProducto(${producto.id})" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${producto.id})" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        
        tbody.appendChild(row);
      });
    }
    
    // Actualizar información de paginación
    const startItem = ((page - 1) * itemsPerPage) + 1;
    const endItem = Math.min(page * itemsPerPage, productos.length);
    document.getElementById('paginationInfo').textContent = 
      `Mostrando ${startItem}-${endItem} de ${productos.length} productos`;
    
    // Generar controles de paginación
    generatePagination(page, totalPages, 'paginationProductos', loadInventario);
    
    // Cargar productos en select de salida
    loadProductosSelect();
    
    // Configurar eventos
    setupInventarioEvents();
    
    // Cargar alertas de stock
    loadAlertasStock();
    
  } catch (error) {
    console.error('Error cargando inventario:', error);
    showAlert('Error cargando productos', 'error');
  }
}

// CARGAR PRODUCTOS EN SELECT
function loadProductosSelect() {
  const selectSalida = document.getElementById('productoSalida');
  
  if (selectSalida) {
    selectSalida.innerHTML = '<option value="">Seleccione un producto</option>';
    productos.forEach(producto => {
      const option = document.createElement('option');
      option.value = producto.id;
      option.textContent = `${producto.nombre} (${producto.stock} ${producto.unidad})`;
      selectSalida.appendChild(option);
    });
  }
}

// CONFIGURAR EVENTOS DEL INVENTARIO
function setupInventarioEvents() {
  // Botón nuevo producto
  const btnNuevoProducto = document.getElementById('btnNuevoProducto');
  if (btnNuevoProducto) {
    btnNuevoProducto.addEventListener('click', function() {
      document.getElementById('modalProducto').style.display = 'block';
      document.getElementById('formProducto').reset();
      document.getElementById('codigoProducto').focus();
      setupModalProducto();
    });
  }
  
  // Formulario salida de productos
  const formSalida = document.getElementById('formSalida');
  if (formSalida) {
    formSalida.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const productoId = parseInt(document.getElementById('productoSalida').value);
      const cantidad = parseInt(document.getElementById('cantidadSalida').value);
      const motivo = document.getElementById('motivoSalida').value;
      const ticketId = document.getElementById('ticketIdSalida').value;
      
      if (!productoId || !cantidad || cantidad <= 0) {
        showAlert('Por favor complete todos los campos correctamente', 'error');
        return;
      }
      
      const producto = productos.find(p => p.id === productoId);
      if (!producto) {
        showAlert('Producto no encontrado', 'error');
        return;
      }
      
      // Verificar stock
      if (producto.stock < cantidad) {
        showAlert(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad} disponibles`, 'error');
        return;
      }
      
      // Mostrar indicador de carga
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
      submitBtn.disabled = true;
      
      try {
        const userData = JSON.parse(localStorage.getItem('medUser'));
        
        const result = await apiRequest('updateStock', {
          productoId: productoId,
          tipo: 'salida',
          cantidad: cantidad,
          usuario: userData ? userData.username : 'sistema',
          motivo: ticketId ? `Ticket ${ticketId} - ${motivo}` : motivo
        });
        
        if (result && result.success) {
          producto.stock -= cantidad;
          
          const movimiento = {
            id: movimientos.length + 1,
            fecha: new Date().toISOString().split('T')[0],
            tipo: 'salida',
            producto: producto.nombre,
            cantidad: cantidad,
            usuario: userData ? userData.username : 'sistema',
            motivo: motivo
          };
          
          movimientos.push(movimiento);
          saveLocalData();
          
          loadInventario(currentProductPage);
          formSalida.reset();
          showAlert(`Salida de ${cantidad} ${producto.unidad} de ${producto.nombre} registrada`, 'success');
          
        } else {
          showAlert(result?.message || 'Error registrando salida', 'error');
        }
        
      } catch (error) {
        console.error('Error registrando salida:', error);
        showAlert('Error al registrar la salida', 'error');
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }
  
  // Búsqueda de productos
  const searchInput = document.getElementById('searchProducto');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const rows = document.querySelectorAll('#tablaInventario tbody tr');
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    });
  }
  
  // Botones de admin
  const userData = JSON.parse(localStorage.getItem('medUser'));
  if (userData && userData.role === 'admin') {
    document.getElementById('adminControls').style.display = 'inline-block';
    
    document.getElementById('btnGestionCategorias').addEventListener('click', () => {
      cargarCategorias();
      document.getElementById('modalCategorias').style.display = 'block';
    });
    
    document.getElementById('btnGestionUnidades').addEventListener('click', () => {
      cargarUnidades();
      document.getElementById('modalUnidades').style.display = 'block';
    });
  }
}

// FORMULARIO NUEVO PRODUCTO
const formProducto = document.getElementById('formProducto');
if (formProducto) {
  formProducto.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const codigo = document.getElementById('codigoProducto').value;
    const nombre = document.getElementById('nombreProducto').value;
    const categoria = document.getElementById('categoriaProducto').value;
    const stock = parseInt(document.getElementById('stockInicial').value);
    const minStock = parseInt(document.getElementById('minStock').value);
    const unidad = document.getElementById('unidadProducto').value;
    const ubicacion = document.getElementById('ubicacionProducto').value;
    
    if (!nombre || !categoria) {
      showAlert('Por favor complete los campos obligatorios', 'error');
      return;
    }
    
    // Mostrar indicador de carga
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    submitBtn.disabled = true;
    
    try {
      const userData = JSON.parse(localStorage.getItem('medUser'));
      
      // Intentar guardar en Google Sheets
      const result = await apiRequest('addProducto', {
        codigo: codigo,
        nombre: nombre,
        categoria: categoria,
        stock: stock,
        minStock: minStock,
        unidad: unidad,
        ubicacion: ubicacion,
        usuario: userData ? userData.username : 'sistema'
      });
      
      if (result && result.success) {
        // Agregar localmente
        const nuevoProducto = {
          id: result.id || productos.length + 1,
          codigo: result.codigo || codigo,
          nombre: nombre,
          categoria: categoria,
          stock: stock,
          minStock: minStock,
          unidad: unidad,
          ubicacion: ubicacion
        };
        
        productos.push(nuevoProducto);
        saveLocalData();
        
        // Recargar inventario
        loadInventario(1);
        
        // Cerrar modal
        closeModal('modalProducto');
        showAlert('Producto agregado correctamente', 'success');
        
      } else {
        showAlert(result?.message || 'Error agregando producto', 'error');
      }
      
    } catch (error) {
      console.error('Error agregando producto:', error);
      showAlert('Error al agregar el producto', 'error');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// EDITAR PRODUCTO
async function editarProducto(id) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;
  
  // Llenar formulario
  document.getElementById('codigoProducto').value = producto.codigo;
  document.getElementById('nombreProducto').value = producto.nombre;
  document.getElementById('categoriaProducto').value = producto.categoria;
  document.getElementById('stockInicial').value = producto.stock;
  document.getElementById('minStock').value = producto.minStock;
  document.getElementById('unidadProducto').value = producto.unidad;
  document.getElementById('ubicacionProducto').value = producto.ubicacion;
  
  // Cambiar título del modal
  document.querySelector('#modalProducto h3').innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
  
  // Configurar modal para edición
  setupModalProducto();
  
  // Cambiar acción del formulario
  const form = document.getElementById('formProducto');
  const oldSubmit = form.onsubmit;
  
  form.onsubmit = async function(e) {
    e.preventDefault();
    
    // Actualizar producto
    producto.codigo = document.getElementById('codigoProducto').value;
    producto.nombre = document.getElementById('nombreProducto').value;
    producto.categoria = document.getElementById('categoriaProducto').value;
    producto.stock = parseInt(document.getElementById('stockInicial').value);
    producto.minStock = parseInt(document.getElementById('minStock').value);
    producto.unidad = document.getElementById('unidadProducto').value;
    producto.ubicacion = document.getElementById('ubicacionProducto').value;
    
    // Guardar localmente
    saveLocalData();
    
    // Recargar inventario
    loadInventario(currentProductPage);
    
    // Cerrar modal
    closeModal('modalProducto');
    showAlert('Producto actualizado correctamente', 'success');
    
    // Restaurar formulario original
    form.onsubmit = oldSubmit;
    document.querySelector('#modalProducto h3').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
  };
  
  // Mostrar modal
  document.getElementById('modalProducto').style.display = 'block';
}

// ELIMINAR PRODUCTO
async function eliminarProducto(id) {
  if (!confirm('¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
    return;
  }
  
  try {
    const index = productos.findIndex(p => p.id === id);
    if (index !== -1) {
      productos.splice(index, 1);
      saveLocalData();
      loadInventario(currentProductPage);
      showAlert('Producto eliminado correctamente', 'success');
    }
  } catch (error) {
    console.error('Error eliminando producto:', error);
    showAlert('Error al eliminar el producto', 'error');
  }
}

// SIMULAR CÓDIGO DE BARRAS (MANTENIDO POR COMPATIBILIDAD)
function simularCodigoBarras() {
  const codigoInput = document.getElementById('codigoProducto');
  const codigos = ['MED001', 'MED002', 'MED003', 'MED004', 'MED005', 'MED006', 'MED007', 'MED008'];
  const randomCodigo = codigos[Math.floor(Math.random() * codigos.length)];
  
  // Verificar si el código ya existe
  const existe = productos.some(p => p.codigo === randomCodigo);
  
  if (existe) {
    showAlert('Código ya existe, generando uno nuevo...', 'warning');
    
    // Generar nuevo código
    let nuevoCodigo;
    let num = productos.length + 1;
    
    do {
      nuevoCodigo = `MED${String(num).padStart(3, '0')}`;
      num++;
    } while (productos.some(p => p.codigo === nuevoCodigo));
    
    codigoInput.value = nuevoCodigo;
  } else {
    codigoInput.value = randomCodigo;
  }
}

// CONFIGURAR MODAL DE PRODUCTO
function setupModalProducto() {
  const categoriaSelect = document.getElementById('categoriaProducto');
  const unidadSelect = document.getElementById('unidadProducto');
  
  if (categoriaSelect) {
    categoriaSelect.innerHTML = '<option value="">Seleccione categoría</option>';
    categorias.forEach(categoria => {
      const option = document.createElement('option');
      option.value = categoria;
      option.textContent = categoria;
      categoriaSelect.appendChild(option);
    });
  }
  
  if (unidadSelect) {
    unidadSelect.innerHTML = '<option value="">Seleccione unidad</option>';
    unidades.forEach(unidad => {
      const option = document.createElement('option');
      option.value = unidad;
      option.textContent = unidad;
      unidadSelect.appendChild(option);
    });
  }
}

// CARGAR ALERTAS DE STOCK BAJO
function loadAlertasStock() {
  const container = document.getElementById('alertasStockContainer');
  if (!container) return;
  
  const productosBajos = productos.filter(p => p.stock < p.minStock);
  
  if (productosBajos.length === 0) {
    container.innerHTML = `
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i> Todo el stock está en niveles óptimos
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <strong>${productosBajos.length} producto(s) con stock bajo</strong>
        <ul style="margin-top: 10px; margin-bottom: 0;">
          ${productosBajos.slice(0, 3).map(p => `
            <li><strong>${p.nombre}</strong>: ${p.stock} ${p.unidad} (mínimo: ${p.minStock})</li>
          `).join('')}
        </ul>
        ${productosBajos.length > 3 ? `<small>... y ${productosBajos.length - 3} más</small>` : ''}
      </div>
    `;
  }
}

// MOSTRAR TODOS LOS PRODUCTOS BAJOS
function mostrarTodosProductosBajos() {
  const productosBajos = productos.filter(p => p.stock < p.minStock);
  const tbody = document.getElementById('tablaProductosBajos');
  
  if (!tbody || productosBajos.length === 0) {
    showAlert('No hay productos con stock bajo', 'info');
    return;
  }
  
  tbody.innerHTML = '';
  
  productosBajos.forEach(producto => {
    const diferencia = producto.minStock - producto.stock;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${producto.nombre}</strong></td>
      <td><span class="text-danger">${producto.stock} ${producto.unidad}</span></td>
      <td>${producto.minStock} ${producto.unidad}</td>
      <td><span class="badge badge-danger">-${diferencia}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="reabastecerProducto(${producto.id})">
          <i class="fas fa-arrow-down"></i> Reabastecer
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById('modalProductosBajos').style.display = 'block';
}

// REABASTECER PRODUCTO DESDE MODAL
function reabastecerProducto(productoId) {
  const producto = productos.find(p => p.id === productoId);
  if (!producto) return;
  
  const cantidad = parseInt(prompt(`¿Cuántas ${producto.unidad} desea agregar a ${producto.nombre}?`, 
    producto.minStock - producto.stock));
  
  if (!cantidad || cantidad <= 0) return;
  
  // Actualizar stock
  updateStock({
    productoId: productoId,
    tipo: 'entrada',
    cantidad: cantidad,
    motivo: `Reabastecimiento por stock bajo (${producto.minStock - producto.stock} faltantes)`
  }).then(result => {
    if (result && result.success) {
      showAlert(`Se agregaron ${cantidad} ${producto.unidad} a ${producto.nombre}`, 'success');
      loadInventario(currentProductPage);
      closeModal('modalProductosBajos');
    }
  });
}

// GESTIÓN DE CATEGORÍAS (ADMIN)
function cargarCategorias() {
  const container = document.getElementById('listaCategorias');
  if (!container) return;
  
  // Cargar categorías desde localStorage o usar las predeterminadas
  const savedCategorias = localStorage.getItem('medCategorias');
  if (savedCategorias) {
    categorias = JSON.parse(savedCategorias);
  }
  
  container.innerHTML = '';
  
  categorias.forEach((categoria, index) => {
    const item = document.createElement('div');
    item.className = 'categoria-item';
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 5px;
      margin-bottom: 5px;
    `;
    
    item.innerHTML = `
      <span>${categoria}</span>
      <button class="btn btn-sm btn-danger" onclick="eliminarCategoria(${index})">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    container.appendChild(item);
  });
}

function agregarCategoria() {
  const input = document.getElementById('nuevaCategoria');
  const nuevaCategoria = input.value.trim();
  
  if (!nuevaCategoria) {
    showAlert('Ingrese un nombre para la categoría', 'error');
    return;
  }
  
  if (categorias.includes(nuevaCategoria)) {
    showAlert('Esta categoría ya existe', 'warning');
    return;
  }
  
  categorias.push(nuevaCategoria);
  localStorage.setItem('medCategorias', JSON.stringify(categorias));
  cargarCategorias();
  input.value = '';
  showAlert('Categoría agregada', 'success');
}

function eliminarCategoria(index) {
  if (!confirm('¿Está seguro de eliminar esta categoría?')) return;
  
  categorias.splice(index, 1);
  localStorage.setItem('medCategorias', JSON.stringify(categorias));
  cargarCategorias();
  showAlert('Categoría eliminada', 'success');
}

// GESTIÓN DE UNIDADES (ADMIN)
function cargarUnidades() {
  const container = document.getElementById('listaUnidades');
  if (!container) return;
  
  // Cargar unidades desde localStorage o usar las predeterminadas
  const savedUnidades = localStorage.getItem('medUnidades');
  if (savedUnidades) {
    unidades = JSON.parse(savedUnidades);
  }
  
  container.innerHTML = '';
  
  unidades.forEach((unidad, index) => {
    const item = document.createElement('div');
    item.className = 'unidad-item';
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 5px;
      margin-bottom: 5px;
    `;
    
    item.innerHTML = `
      <span>${unidad}</span>
      <button class="btn btn-sm btn-danger" onclick="eliminarUnidad(${index})">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    container.appendChild(item);
  });
}

function agregarUnidad() {
  const input = document.getElementById('nuevaUnidad');
  const nuevaUnidad = input.value.trim();
  
  if (!nuevaUnidad) {
    showAlert('Ingrese una unidad de medida', 'error');
    return;
  }
  
  if (unidades.includes(nuevaUnidad)) {
    showAlert('Esta unidad ya existe', 'warning');
    return;
  }
  
  unidades.push(nuevaUnidad);
  localStorage.setItem('medUnidades', JSON.stringify(unidades));
  cargarUnidades();
  input.value = '';
  showAlert('Unidad agregada', 'success');
}

function eliminarUnidad(index) {
  if (!confirm('¿Está seguro de eliminar esta unidad?')) return;
  
  unidades.splice(index, 1);
  localStorage.setItem('medUnidades', JSON.stringify(unidades));
  cargarUnidades();
  showAlert('Unidad eliminada', 'success');
}

// FUNCIÓN PARA CERRAR MODALES
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  
  // Restaurar formulario de producto si es necesario
  if (modalId === 'modalProducto') {
    const form = document.getElementById('formProducto');
    form.reset();
    form.onsubmit = null;
    document.querySelector('#modalProducto h3').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
  }
}

// FUNCIÓN AUXILIAR PARA ACTUALIZAR STOCK
async function updateStock(data) {
  try {
    const userData = JSON.parse(localStorage.getItem('medUser'));
    
    const result = await apiRequest('updateStock', {
      productoId: data.productoId,
      tipo: data.tipo,
      cantidad: data.cantidad,
      usuario: userData ? userData.username : 'sistema',
      motivo: data.motivo || 'Movimiento de stock'
    });
    
    if (result && result.success) {
      // Actualizar localmente
      const producto = productos.find(p => p.id === data.productoId);
      if (producto) {
        if (data.tipo === 'entrada') {
          producto.stock += data.cantidad;
        } else {
          producto.stock -= data.cantidad;
        }
      }
      
      // Registrar movimiento local
      const movimiento = {
        id: movimientos.length + 1,
        fecha: new Date().toISOString().split('T')[0],
        tipo: data.tipo,
        producto: producto ? producto.nombre : 'Desconocido',
        cantidad: data.cantidad,
        usuario: userData ? userData.username : 'sistema',
        motivo: data.motivo
      };
      
      movimientos.push(movimiento);
      saveLocalData();
      
      return { success: true };
    } else {
      return result;
    }
  } catch (error) {
    console.error('Error actualizando stock:', error);
    return { success: false, message: error.toString() };
  }
}

// INICIALIZAR INVENTARIO
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('inventario.html')) {
    loadInventario(1);
  }
});