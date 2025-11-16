// Variables globales para almacenar los datos CSV
let datosAutos = [];
let datosAccidentes = [];

// Cargar datos CSV al iniciar la página
document.addEventListener('DOMContentLoaded', function() {
    cargarDatosCSV();
    inicializarFormulario();
});

// Función para cargar ambos archivos CSV
async function cargarDatosCSV() {
    try {
        // Cargar autos.csv
        const responseAutos = await fetch('data/autos.csv');
        const textoAutos = await responseAutos.text();
        const parseadoAutos = Papa.parse(textoAutos, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
        datosAutos = parseadoAutos.data.filter(auto => auto.horsepower && auto.weight && auto.model_year && auto.origin);

        // Cargar accidentes.csv
        const responseAccidentes = await fetch('data/accidentes.csv');
        const textoAccidentes = await responseAccidentes.text();
        const parseadoAccidentes = Papa.parse(textoAccidentes, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
        datosAccidentes = parseadoAccidentes.data.filter(acc => acc.ID_EDAD);

        // Llenar select de años
        llenarSelectAnios();
        
        // Calcular y mostrar estadísticas
        mostrarEstadisticas();
    } catch (error) {
        console.error('Error al cargar los archivos CSV:', error);
        alert('Error al cargar los datos. Por favor, verifica que los archivos CSV estén en la carpeta data/');
    }
}

// Llenar el select de años con los años disponibles en autos.csv
function llenarSelectAnios() {
    const selectAnio = document.getElementById('anio');
    const añosUnicos = [...new Set(datosAutos.map(auto => auto.model_year + 1900))].sort((a, b) => b - a);
    
    añosUnicos.forEach(año => {
        const option = document.createElement('option');
        option.value = año;
        option.textContent = año;
        selectAnio.appendChild(option);
    });
}

// Inicializar eventos del formulario
function inicializarFormulario() {
    const formulario = document.getElementById('formulario-cotizar');
    formulario.addEventListener('submit', function(e) {
        e.preventDefault();
        calcularCotizacion();
    });

    // Sincronizar marca y origen
    const selectMarca = document.getElementById('marca');
    const selectOrigen = document.getElementById('origen');
    
    selectMarca.addEventListener('change', function() {
        selectOrigen.value = this.value;
    });
    
    selectOrigen.addEventListener('change', function() {
        selectMarca.value = this.value;
    });

    // Modal para "Te llamamos"
    const modal = document.getElementById('modal-llamada');
    const closeModal = document.querySelector('.close-modal');
    const formLlamada = document.getElementById('form-llamada');

    closeModal.addEventListener('click', function() {
        modal.classList.add('oculto');
    });

    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.add('oculto');
        }
    });

    formLlamada.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('¡Gracias! Nos pondremos en contacto contigo pronto.');
        modal.classList.add('oculto');
        formLlamada.reset();
    });
}

// Función principal para calcular la cotización
function calcularCotizacion() {
    const marca = document.getElementById('marca').value;
    const anio = parseInt(document.getElementById('anio').value);
    const origen = document.getElementById('origen').value;
    const edad = parseInt(document.getElementById('edad').value);
    const cobertura = document.getElementById('cobertura').value;

    // Validar que todos los campos estén llenos
    if (!marca || !anio || !origen || !edad || !cobertura) {
        alert('Por favor, completa todos los campos.');
        return;
    }

    // Buscar autos que coincidan con los criterios (origen y año)
    const autosEncontrados = datosAutos.filter(auto => {
        const añoAuto = auto.model_year + 1900;
        return auto.origin === origen && añoAuto === anio;
    });

    if (autosEncontrados.length === 0) {
        alert('No se encontró un auto con esas características. Por favor, selecciona otras opciones.');
        return;
    }

    // Si hay múltiples autos, calcular promedios de horsepower y weight
    let autoEncontrado;
    if (autosEncontrados.length === 1) {
        autoEncontrado = autosEncontrados[0];
    } else {
        // Calcular promedio de horsepower y weight
        const avgHorsepower = autosEncontrados.reduce((sum, auto) => sum + (parseFloat(auto.horsepower) || 0), 0) / autosEncontrados.length;
        const avgWeight = autosEncontrados.reduce((sum, auto) => sum + (parseFloat(auto.weight) || 0), 0) / autosEncontrados.length;
        autoEncontrado = {
            horsepower: avgHorsepower,
            weight: avgWeight,
            origin: origen,
            model_year: anio - 1900
        };
    }

    // Calcular costo base
    const horsepower = parseFloat(autoEncontrado.horsepower) || 100;
    const weight = parseFloat(autoEncontrado.weight) || 3000;
    const costoBase = (horsepower * 10) + (weight / 5);

    // Factor de edad
    let factorEdad;
    if (edad < 25) {
        factorEdad = 1.3;
    } else if (edad > 60) {
        factorEdad = 1.2;
    } else {
        factorEdad = 1.0;
    }

    // Calcular riesgo de accidentes según edad
    const riesgoAccidentes = calcularRiesgoAccidentes(edad);

    // Factor de cobertura (Plus es más caro)
    let factorCobertura;
    let nombreCobertura;
    if (cobertura === 'plus') {
        factorCobertura = 1.15; // 15% más caro
        nombreCobertura = 'Cobertura 100 Plus';
    } else {
        factorCobertura = 1.0; // Precio base
        nombreCobertura = 'Cobertura 100 Clásica';
    }

    // Calcular costo final
    const costoFinal = costoBase * factorEdad * (1 + riesgoAccidentes / 100) * factorCobertura;

    // Calcular precios
    const precioContado = costoFinal;
    const precioMensual = costoFinal * 1.08 / 12;
    const primerPago = precioMensual * 1.1; // Primer pago 10% más alto
    const pagosRestantes = precioMensual;



    // Mostrar resultado
    mostrarResultado(precioContado, precioMensual, primerPago, pagosRestantes, nombreCobertura);
    
    // Actualizar índice de fatalidad según la edad ingresada
    actualizarIndiceFatalidad(edad);
}

// Calcular riesgo de accidentes basado en la edad
function calcularRiesgoAccidentes(edad) {
    // Filtrar accidentes en un rango de edad similar (±5 años)
    const rangoMin = edad - 5;
    const rangoMax = edad + 5;
    
    const accidentesRango = datosAccidentes.filter(acc => {
        const edadAcc = parseInt(acc.ID_EDAD);
        return edadAcc >= rangoMin && edadAcc <= rangoMax;
    });

    if (accidentesRango.length === 0) {
        return 5; // Valor por defecto si no hay datos
    }

    // Calcular porcentaje de accidentes fatales en este rango
    const accidentesFatales = accidentesRango.filter(acc => 
        acc.CLASACC && acc.CLASACC.toLowerCase().includes('fatal')
    ).length;

    const porcentajeFatal = (accidentesFatales / accidentesRango.length) * 100;
    
    // Convertir a factor de riesgo (0-20%)
    return Math.min(porcentajeFatal * 2, 20);
}

// Mostrar el resultado de la cotización
function mostrarResultado(precioContado, precioMensual, primerPago, pagosRestantes, nombreCobertura) {
    const resultadoDiv = document.getElementById('resultado');
    resultadoDiv.classList.remove('oculto');

    const precioContadoFormateado = formatearPrecio(precioContado);
    const precioMensualFormateado = formatearPrecio(precioMensual);
    const primerPagoFormateado = formatearPrecio(primerPago);
    const pagosRestantesFormateado = formatearPrecio(pagosRestantes);

    // Descripción de la cobertura según el tipo
    let descripcionCobertura;
    if (nombreCobertura === 'Cobertura 100 Plus') {
        descripcionCobertura = 'Cobertura 100 Plus - 3% daños, 3% robo, No pagas deducible (2 accidentes)';
    } else {
        descripcionCobertura = 'Cobertura 100 Clásica - 3% daños, 3% robo, No pagas deducible (1 accidente)';
    }

    resultadoDiv.innerHTML = `
        <div class="cotizacion-card">
            <div class="cotizacion-header">
                <h2>Tu Cotización</h2>
            </div>
            
            <div class="cobertura-info">
                <p><strong>Cobertura:</strong> ${descripcionCobertura}</p>
            </div>

            <div class="precios-container">
                <div class="precio-card">
                    <h3>Precio de Contado</h3>
                    <p class="precio-grande">${precioContadoFormateado}</p>
                    <p class="precio-descripcion">Pago único</p>
                </div>

                <div class="precio-card">
                    <h3>Precio Mensual</h3>
                    <p class="precio-grande">${precioMensualFormateado}</p>
                    <p class="precio-descripcion">
                        Primer pago: ${primerPagoFormateado}<br>
                        11 pagos de: ${pagosRestantesFormateado}
                    </p>
                </div>
            </div>

            <div class="botones-accion">
                <button class="btn-accion btn-te-llamamos" onclick="abrirModalLlamada()">Te llamamos</button>
            </div>
        </div>
    `;

    // Scroll suave al resultado
    resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Formatear precio en formato mexicano
function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(precio);
}

// Abrir modal de "Te llamamos"
function abrirModalLlamada() {
    const modal = document.getElementById('modal-llamada');
    modal.classList.remove('oculto');
}

// Calcular y mostrar estadísticas generales
function mostrarEstadisticas() {
    if (datosAccidentes.length === 0) return;

    // Calcular promedio de accidentes fatales por edad
    const accidentesFatales = datosAccidentes.filter(acc => 
        acc.CLASACC && acc.CLASACC.toLowerCase().includes('fatal')
    );
    
    const edadesFatales = accidentesFatales.map(acc => parseInt(acc.ID_EDAD)).filter(edad => !isNaN(edad));
    const promedioFatal = edadesFatales.length > 0 
        ? (edadesFatales.reduce((a, b) => a + b, 0) / edadesFatales.length).toFixed(1)
        : 0;

    // Mostrar estadísticas iniciales
    document.getElementById('promedio-fatal').textContent = `${promedioFatal} años`;
    document.getElementById('porcentaje-leves').textContent = '-';

    const estadisticasDiv = document.getElementById('estadisticas');
    estadisticasDiv.classList.remove('oculto');
}

// Calcular y actualizar el índice de fatalidad según la edad del conductor
function actualizarIndiceFatalidad(edad) {
    if (datosAccidentes.length === 0) return;

    // Filtrar accidentes en un rango de edad similar (±5 años)
    const rangoMin = edad - 5;
    const rangoMax = edad + 5;
    
    const accidentesRango = datosAccidentes.filter(acc => {
        const edadAcc = parseInt(acc.ID_EDAD);
        return !isNaN(edadAcc) && edadAcc >= rangoMin && edadAcc <= rangoMax;
    });

    if (accidentesRango.length === 0) {
        document.getElementById('porcentaje-leves').textContent = 'N/A';
        return;
    }

    // Filtrar accidentes fatales en este rango de edad
    // Fatales: accidentes donde una o más personas fallecen en el lugar
    const accidentesFatalesRango = accidentesRango.filter(acc => {
        if (!acc.CLASACC) return false;
        const clasificacion = acc.CLASACC.toLowerCase();
        // Buscar accidentes fatales (puede estar como "fatal", "fatales", etc.)
        return clasificacion.includes('fatal');
    });

    // Calcular el índice de fatalidad (porcentaje de accidentes fatales en este rango de edad)
    const indiceFatalidad = ((accidentesFatalesRango.length / accidentesRango.length) * 100).toFixed(2);
    
    // Actualizar el valor en la interfaz
    document.getElementById('porcentaje-leves').textContent = `${indiceFatalidad}%`;
}

