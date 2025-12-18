// ============================================
// GESTIÓN DE INVENTARIO - CORREGIDO
// ============================================

// CARGAR INVENTARIO
async function loadInventario() {
  const tbody = document.querySelector('#tablaInventario tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

  try {
    // Cargar productos actualizados
    const productosResult = await apiRequest('getProductos');
    if (productosResult && productosResult.success) {
      productos = productosResult.data;
      saveLocalData();
    }

    // Si no hay productos, mostrar mensaje
    if (!productos || productos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center">
            <i class="fas fa-box-open fa-2x mb-2"></i><br>
            No hay productos en el inventario<br>
            <button class="btn btn-sm btn-primary mt-2" onclick="document.getElementById('btnNuevoProducto').click()">
              <i class="fas fa-plus"></i> Agregar primer producto
            </button>
          </td>
        </tr>
      `;
      return;
    }

    // Ordenar productos por nombre
    const productosOrdenados = [...productos].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );

    tbody.innerHTML = '';

    productosOrdenados.forEach(producto => {
      const row = document.createElement('tr');
      
      // Determinar estado del stock
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

    // Cargar productos en select
    loadProductosSelect();

    // Configurar eventos
    setupInventarioEvents();

    // Actualizar dashboard si está en esa página
    if (typeof updateDashboard === 'function') {
      updateDashboard();
    }

  } catch (error) {
    console.error('Error cargando inventario:', error);
    showAlert('Error cargando productos', 'error');
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-danger">
          <i class="fas fa-exclamation-triangle"></i> Error cargando datos
        </td>
      </tr>
    `;
  }
}

// CARGAR PRODUCTOS EN SELECT
function loadProductosSelect() {
  const selectEntrada = document.getElementById('productoEntrada');
  const selectSalida = document.getElementById('productoSalida');

  if (selectEntrada) {
    selectEntrada.innerHTML = '<option value="">Seleccione un producto</option>';
    productos.forEach(producto => {
      const option = document.createElement('option');
      option.value = producto.id;
      option.textContent = `${producto.nombre} (${producto.stock} ${producto.unidad})`;
      option.dataset.stock = producto.stock;
      option.dataset.unidad = producto.unidad;
      selectEntrada.appendChild(option);
    });
  }

  if (selectSalida) {
    selectSalida.innerHTML = '<option value="">Seleccione un producto</option>';
    productos.forEach(producto => {
      const option = document.createElement('option');
      option.value = producto.id;
      option.textContent = `${producto.nombre} (${producto.stock} ${producto.unidad})`;
      option.dataset.stock = producto.stock;
      option.dataset.unidad = producto.unidad;
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
      document.querySelector('#modalProducto h3').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
    });
  }

  // Formulario entrada de productos
  const formEntrada = document.getElementById('formEntrada');
  if (formEntrada) {
    formEntrada.addEventListener('submit', async function(e) {
      e.preventDefault();

      const productoId = parseInt(document.getElementById('productoEntrada').value);
      const cantidad = parseInt(document.getElementById('cantidadEntrada').value);
      const motivo = document.getElementById('motivoEntrada').value;

      if (!productoId || !cantidad || cantidad <= 0) {
        showAlert('Por favor complete todos los campos correctamente', 'error');
        return;
      }

      // Buscar producto
      const producto = productos.find(p => p.id === productoId);
      if (!producto) {
        showAlert('Producto no encontrado', 'error');
        return;
      }

      // Mostrar indicador de carga
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
      submitBtn.disabled = true;

      try {
        // Obtener usuario actual
        const userData = JSON.parse(localStorage.getItem('medUser'));

        // Intentar guardar en Google Sheets
        const result = await apiRequest('updateStock', {
          productoId: productoId,
          tipo: 'entrada',
          cantidad: cantidad,
          usuario: userData ? userData.username : 'sistema',
          motivo: motivo || 'Entrada de stock'
        });

        if (result && result.success) {
          // Actualizar localmente
          producto.stock += cantidad;

          // Registrar movimiento local
          const movimiento = {
            id: movimientos.length + 1,
            fecha: new Date().toISOString().split('T')[0],
            tipo: 'entrada',
            producto: producto.nombre,
            cantidad: cantidad,
            usuario: userData ? userData.username : 'sistema',
            motivo: motivo
          };

          if (!movimientos) movimientos = [];
          movimientos.push(movimiento);
          saveLocalData();

          // Recargar inventario
          await loadInventario();

          // Limpiar formulario
          formEntrada.reset();
          showAlert(`Entrada de ${cantidad} ${producto.unidad} de ${producto.nombre} registrada`, 'success');

        } else {
          showAlert(result?.message || 'Error registrando entrada', 'error');
        }

      } catch (error) {
        console.error('Error registrando entrada:', error);
        showAlert('Error al registrar la entrada', 'error');
      } finally {
        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
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
          motivo: motivo || 'Salida de stock'
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

          if (!movimientos) movimientos = [];
          movimientos.push(movimiento);
          saveLocalData();

          await loadInventario();
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

  // Botón generar código de barras
  const btnGenerarCodigo = document.querySelector('button[onclick="simularCodigoBarras()"]');
  if (btnGenerarCodigo) {
    btnGenerarCodigo.onclick = simularCodigoBarras;
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
    const stock = parseInt(document.getElementById('stockInicial').value) || 0;
    const minStock = parseInt(document.getElementById('minStock').value) || 10;
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
        await loadInventario();

        // Cerrar modal
        closeModal();
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
  if (!producto) {
    showAlert('Producto no encontrado', 'error');
    return;
  }

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

  // Cambiar acción del formulario
  const form = document.getElementById('formProducto');
  const originalSubmit = form.onsubmit;

  form.onsubmit = async function(e) {
    e.preventDefault();

    // Actualizar producto localmente
    producto.codigo = document.getElementById('codigoProducto').value;
    producto.nombre = document.getElementById('nombreProducto').value;
    producto.categoria = document.getElementById('categoriaProducto').value;
    producto.stock = parseInt(document.getElementById('stockInicial').value) || 0;
    producto.minStock = parseInt(document.getElementById('minStock').value) || 10;
    producto.unidad = document.getElementById('unidadProducto').value;
    producto.ubicacion = document.getElementById('ubicacionProducto').value;

    // Guardar localmente
    saveLocalData();

    // Recargar inventario
    await loadInventario();

    // Cerrar modal
    closeModal();
    showAlert('Producto actualizado correctamente', 'success');
  };

  // Restaurar el submit original después de cerrar
  const modal = document.getElementById('modalProducto');
  modal.dataset.originalSubmit = true;

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
      await loadInventario();
      showAlert('Producto eliminado correctamente', 'success');
    } else {
      showAlert('Producto no encontrado', 'error');
    }
  } catch (error) {
    console.error('Error eliminando producto:', error);
    showAlert('Error al eliminar el producto', 'error');
  }
}

// SIMULAR CÓDIGO DE BARRAS
function simularCodigoBarras() {
  const codigoInput = document.getElementById('codigoProducto');
  const codigos = ['MED001', 'MED002', 'MED003', 'MED004', 'MED005', 'MED006', 'MED007', 'MED008', 'MED009', 'MED010'];
  const randomCodigo = codigos[Math.floor(Math.random() * codigos.length)];

  // Verificar si el código ya existe
  const existe = productos.some(p => p.codigo === randomCodigo);

  if (existe) {
    // Generar nuevo código
    let nuevoCodigo;
    let num = productos.length + 1;

    do {
      nuevoCodigo = `MED${String(num).padStart(3, '0')}`;
      num++;
    } while (productos.some(p => p.codigo === nuevoCodigo));

    codigoInput.value = nuevoCodigo;
    showAlert(`Código ${randomCodigo} ya existe, generando: ${nuevoCodigo}`, 'info');
  } else {
    codigoInput.value = randomCodigo;
    showAlert(`Código generado: ${randomCodigo}`, 'info');
  }
}

// CERRAR MODAL
function closeModal() {
  document.getElementById('modalProducto').style.display = 'none';

  // Restaurar formulario para nuevo producto
  const form = document.getElementById('formProducto');
  form.reset();
  
  // Restaurar el evento submit original
  form.onsubmit = null;
  
  document.querySelector('#modalProducto h3').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
}

// INICIALIZAR INVENTARIO CUANDO SE CARGA LA PÁGINA
document.addEventListener('DOMContentLoaded', function() {
  // Verificar si estamos en la página de inventario
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage === 'inventario.html' || window.location.href.includes('inventario')) {
    console.log('Inicializando inventario...');
    
    // Cargar datos locales primero
    const productosData = JSON.parse(localStorage.getItem('medProductos') || '[]');
    if (productosData && productosData.length > 0) {
      productos = productosData;
    }
    
    // Cargar inventario
    loadInventario();
    
    // Configurar cierre del modal al hacer clic fuera
    const modal = document.getElementById('modalProducto');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeModal();
        }
      });
    }
    
    // Agregar botón de cerrar al modal si no existe
    const modalContent = document.querySelector('.modal-content');
    if (modalContent && !document.querySelector('.modal-close')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = closeModal;
      modalContent.querySelector('.modal-header').appendChild(closeBtn);
    }
  }
});

// Asegurarse de que las variables globales existan
if (typeof productos === 'undefined') {
  var productos = [];
}
if (typeof movimientos === 'undefined') {
  var movimientos = [];
}
