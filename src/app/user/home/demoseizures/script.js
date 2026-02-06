// Variables globales
let seizuresData = [];
let medicationsData = [];
let charts = {};

// Configuración de Chart.js
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.color = '#495057';

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
    // Verificar si hay datos guardados
    checkSavedData();

    initializeFileLoader();

    // Event listeners para filtros
    const groupBy = document.getElementById('groupBy');
    const dateRange = document.getElementById('dateRange');
    const seizureType = document.getElementById('seizureType');
    const customStartDate = document.getElementById('customStartDate');
    const customEndDate = document.getElementById('customEndDate');
    const maxSeizureScale = document.getElementById('maxSeizureScale');
    const maxMedicationScale = document.getElementById('maxMedicationScale');
    const showMedicationChanges = document.getElementById('showMedicationChanges');

    if (groupBy) groupBy.addEventListener('change', updateCharts);
    if (dateRange) dateRange.addEventListener('change', handleDateRangeChange);
    if (seizureType) seizureType.addEventListener('change', updateCharts);
    if (customStartDate) customStartDate.addEventListener('change', updateCharts);
    if (customEndDate) customEndDate.addEventListener('change', updateCharts);
    if (maxSeizureScale) maxSeizureScale.addEventListener('input', updateCharts);
    if (maxMedicationScale) maxMedicationScale.addEventListener('input', updateCharts);
    if (showMedicationChanges) showMedicationChanges.addEventListener('change', updateCharts);
});

// Inicializar cargador de archivos
function initializeFileLoader() {
    const fileInput = document.getElementById('jsonFileInput');

    // Cargar archivo al seleccionarlo
    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            loadJSONFile(file);
        }
    });

    // Drag and drop
    const fileLoaderContainer = document.getElementById('fileLoaderContainer');
    fileLoaderContainer.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileLoaderContainer.style.opacity = '0.7';
    });

    fileLoaderContainer.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileLoaderContainer.style.opacity = '1';
    });

    fileLoaderContainer.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileLoaderContainer.style.opacity = '1';

        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/json' || file.name.endsWith('.json')) {
            fileInput.files = e.dataTransfer.files;
            loadJSONFile(file);
        } else {
            alert('Por favor, selecciona un archivo JSON válido');
        }
    });
}

// Cargar archivo JSON
function loadJSONFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            seizuresData = data.Seizures || [];
            medicationsData = data.Medications || [];

            if (seizuresData.length === 0 && medicationsData.length === 0) {
                throw new Error('El archivo JSON no contiene datos válidos');
            }

            // Guardar en localStorage
            saveData(data);

            // Procesar datos
            processSeizuresData();
            processMedicationsData();

            // Ocultar cargador y mostrar contenido principal
            document.getElementById('fileLoaderContainer').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';

            // Inicializar gráficos
            initializeCharts();

            // Cargar insights
            generateInsights();

            // Actualizar estadísticas
            updateStatistics();

            // Verificar crisis recientes
            checkRecentSeizures();

            // Poblar filtros
            populateFilters();

            console.log('Datos cargados exitosamente:', {
                crisis: seizuresData.length,
                medicamentos: medicationsData.length
            });

        } catch (error) {
            console.error('Error procesando archivo:', error);
            alert('Error al procesar el archivo JSON: ' + error.message);
        }
    };

    reader.onerror = function () {
        alert('Error al leer el archivo');
    };

    reader.readAsText(file);
}

// Guardar datos en localStorage
function saveData(data) {
    try {
        localStorage.setItem('seizureTrackerData', JSON.stringify(data));
        // Notificar éxito discretamente
        const alertBox = document.createElement('div');
        alertBox.className = 'alert alert-success position-fixed bottom-0 end-0 m-3';
        alertBox.style.zIndex = '9999';
        alertBox.innerHTML = '<i class="fas fa-save me-2"></i>Datos guardados localmente';
        document.body.appendChild(alertBox);
        setTimeout(() => alertBox.remove(), 3000);
    } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
        let msg = 'No se pudieron guardar los datos localmente.';
        if (e.name === 'QuotaExceededError') {
            msg += ' El almacenamiento está lleno.';
        } else if (e.name === 'SecurityError') {
            msg += ' El navegador bloqueó el acceso al almacenamiento (posiblemente por modo incógnito o archivo local).';
        }
        alert(msg + '\n\nTendrás que cargar el archivo nuevamente la próxima vez.');
    }
}

// Verificar datos guardados
function checkSavedData() {
    try {
        const saved = localStorage.getItem('seizureTrackerData');
        if (saved) {
            const data = JSON.parse(saved);
            seizuresData = data.Seizures || [];
            medicationsData = data.Medications || [];

            if (seizuresData.length > 0 || medicationsData.length > 0) {
                // Procesar y mostrar directamente
                processSeizuresData();
                processMedicationsData();

                document.getElementById('fileLoaderContainer').style.display = 'none';
                document.getElementById('mainContent').style.display = 'block';

                initializeCharts();
                generateInsights();
                updateStatistics();
                checkRecentSeizures();
                populateFilters();

                console.log('Datos cargados desde localStorage');
            }
        }
    } catch (e) {
        console.error('Error al leer localStorage:', e);
        alert('Hubo un problema al cargar los datos guardados. Por favor, carga el archivo nuevamente.');
        localStorage.removeItem('seizureTrackerData'); // Limpiar datos corruptos
    }
}

// Resetear datos (para el botón del header)
function resetData() {
    if (confirm('¿Estás seguro de que quieres cargar un nuevo archivo? Esto borrará los datos actuales de la vista.')) {
        localStorage.removeItem('seizureTrackerData');
        location.reload();
    }
}

// Procesar datos de crisis
function processSeizuresData() {
    seizuresData.forEach(seizure => {
        // Convertir fecha
        try {
            seizure.date = new Date(seizure.Date_Time);
            if (isNaN(seizure.date.getTime())) {
                // Intentar formato alternativo
                seizure.date = new Date(seizure.Date_Time.replace('+', ' '));
            }
        } catch (e) {
            console.warn('Error procesando fecha:', seizure.Date_Time);
            seizure.date = new Date();
        }

        seizure.dateString = seizure.date.toLocaleDateString('es-ES');

        // Calcular duración en minutos
        const hours = parseInt(seizure.length_hr) || 0;
        const minutes = parseInt(seizure.length_min) || 0;
        const seconds = parseInt(seizure.length_sec) || 0;
        seizure.durationMinutes = hours * 60 + minutes + seconds / 60;

        // Agrupar por día, mes, año
        seizure.day = seizure.date.toISOString().split('T')[0];
        seizure.month = seizure.date.toISOString().slice(0, 7);
        seizure.year = seizure.date.getFullYear().toString();
    });

    // Filtrar crisis con fechas válidas
    seizuresData = seizuresData.filter(s => !isNaN(s.date.getTime()));
}

// Procesar datos de medicamentos
function processMedicationsData() {
    medicationsData.forEach(med => {
        try {
            med.startDate = new Date(med['Start Date']);
            med.endDate = new Date(med['End Date']);
            med.dailyDose = parseFloat(med['Total Daily Dose']) || 0;
        } catch (e) {
            console.warn('Error procesando medicamento:', med);
        }
    });

    // Filtrar medicamentos con fechas válidas
    medicationsData = medicationsData.filter(m => !isNaN(m.startDate.getTime()) && !isNaN(m.endDate.getTime()));
}

// Inicializar gráficos
function initializeCharts() {
    createSeizuresChart();
    createCombinedChart();
    createTimeOfDayChart();
}

// Crear gráfico de crisis con tendencia
function createSeizuresChart() {
    const ctx = document.getElementById('seizuresChart').getContext('2d');

    if (charts.seizures) {
        charts.seizures.destroy();
    }

    const data = getSeizuresChartData();

    // Obtener escala máxima del usuario o calcular automática
    const maxSeizureScaleInput = document.getElementById('maxSeizureScale');
    const userMaxScale = maxSeizureScaleInput && maxSeizureScaleInput.value ? parseInt(maxSeizureScaleInput.value) : null;
    const autoMaxScale = Math.max(...data.values) * 1.1;
    const maxScale = userMaxScale || autoMaxScale;

    charts.seizures = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Crisis Epilépticas',
                data: data.values.map((val, idx) => ({ x: data.labels[idx], y: val })),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }, {
                label: 'Tendencia',
                data: data.trend.map((val, idx) => ({ x: data.labels[idx], y: val })),
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 20 }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: getTimeUnit(),
                        displayFormats: {
                            day: 'dd/MM',
                            month: 'MMM yyyy',
                            year: 'yyyy'
                        }
                    },
                    title: { display: true, text: 'Fecha' }
                },
                y: {
                    beginAtZero: true,
                    max: maxScale,
                    title: { display: true, text: 'Número de Crisis' }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Crear gráfico combinado simplificado (Crisis + Timeline de Medicamentos)
function createCombinedChart() {
    const ctx = document.getElementById('combinedSeizuresChart').getContext('2d');

    if (charts.combinedSeizures) {
        charts.combinedSeizures.destroy();
    }

    // Destruir gráficos individuales anteriores si existen
    Object.keys(charts).forEach(key => {
        if (key.startsWith('medication_')) {
            charts[key].destroy();
            delete charts[key];
        }
    });

    const seizureData = getSeizuresChartData();

    // Obtener el rango de fechas actual de los filtros
    const dateRange = document.getElementById('dateRange').value;
    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date(now);

    if (dateRange === 'custom') {
        const customStartDate = document.getElementById('customStartDate').value;
        const customEndDate = document.getElementById('customEndDate').value;

        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) {
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
        }
    } else {
        switch (dateRange) {
            case '1year': startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
            case '6months': startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
            case '3months': startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
            case '1month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
        }
    }

    // Preparar datasets de medicamentos como líneas escalonadas
    const medDatasets = [];
    const colors = ['#28a745', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];
    const medChanges = [];

    // Agrupar medicamentos
    const medGroups = {};
    medicationsData.forEach(med => {
        // Filtrar medicamentos según el rango de fechas
        // Incluir si el medicamento se superpone con el rango seleccionado
        if (dateRange !== 'all') {
            // El medicamento debe terminar después del inicio del rango Y comenzar antes del final del rango
            if (med.endDate < startDate || med.startDate > endDate) {
                return; // Saltar este medicamento
            }
        }

        if (!medGroups[med.Medication]) medGroups[med.Medication] = [];
        medGroups[med.Medication].push(med);
    });

    let colorIdx = 0;
    Object.keys(medGroups).forEach(medName => {
        const meds = medGroups[medName].sort((a, b) => a.startDate - b.startDate);
        const dataPoints = [];

        // Crear puntos para gráfico escalonado
        meds.forEach((med, idx) => {
            // Ajustar las fechas del medicamento al rango visible si es necesario
            let visibleStartDate = med.startDate;
            let visibleEndDate = med.endDate;

            // Si el rango no es "all", ajustar las fechas visibles
            if (dateRange !== 'all') {
                if (visibleStartDate < startDate) visibleStartDate = startDate;
                if (visibleEndDate > endDate) visibleEndDate = endDate;
            }

            // Marcar cambios de medicación (inicio y fin)
            if (idx === 0 || meds[idx - 1].dailyDose !== med.dailyDose) {
                medChanges.push({ date: visibleStartDate, medication: medName, dose: med.dailyDose, type: 'change' });
            }

            dataPoints.push({ x: visibleStartDate, y: med.dailyDose });
            dataPoints.push({ x: visibleEndDate, y: med.dailyDose });
            // Añadir un punto null para romper la línea si hay gap
            dataPoints.push({ x: visibleEndDate, y: null });
        });

        medDatasets.push({
            label: medName,
            data: dataPoints,
            borderColor: colors[colorIdx % colors.length],
            backgroundColor: 'transparent',
            borderWidth: 3,
            stepped: true,
            yAxisID: 'y1',
            pointRadius: 0,
            pointHoverRadius: 4
        });
        colorIdx++;
    });

    // Obtener escalas personalizadas
    const maxSeizureScaleInput = document.getElementById('maxSeizureScale');
    const maxMedicationScaleInput = document.getElementById('maxMedicationScale');
    const userMaxSeizureScale = maxSeizureScaleInput && maxSeizureScaleInput.value ? parseInt(maxSeizureScaleInput.value) : null;
    const userMaxMedScale = maxMedicationScaleInput && maxMedicationScaleInput.value ? parseInt(maxMedicationScaleInput.value) : null;

    const autoMaxSeizureScale = Math.max(...seizureData.values) * 1.1;
    const maxSeizureScale = userMaxSeizureScale || autoMaxSeizureScale;

    // Calcular escala máxima de medicación
    let autoMaxMedScale = 100;
    medDatasets.forEach(ds => {
        ds.data.forEach(point => {
            if (point.y && point.y > autoMaxMedScale) autoMaxMedScale = point.y;
        });
    });
    autoMaxMedScale *= 1.1;
    const maxMedScale = userMaxMedScale || autoMaxMedScale;

    // Preparar anotaciones para cambios de medicación
    const showChanges = document.getElementById('showMedicationChanges')?.checked ?? true;
    const annotations = {};
    if (showChanges) {
        medChanges.forEach((change, idx) => {
            annotations[`line${idx}`] = {
                type: 'line',
                xMin: change.date,
                xMax: change.date,
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                    display: true,
                    content: `${change.medication}: ${change.dose}mg`,
                    position: 'start',
                    backgroundColor: 'rgba(255, 99, 132, 0.8)',
                    color: 'white',
                    font: { size: 10 }
                }
            };
        });
    }

    charts.combinedSeizures = new Chart(ctx, {
        type: 'line',
        data: {
            labels: seizureData.labels,
            datasets: [
                {
                    label: 'Crisis (Frecuencia)',
                    data: seizureData.values.map((val, idx) => ({ x: seizureData.labels[idx], y: val })),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                    order: 2
                },
                ...medDatasets
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.yAxisID === 'y1') {
                                label += context.parsed.y + ' mg';
                            } else {
                                label += context.parsed.y + ' crisis';
                            }
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: getTimeUnit(),
                        displayFormats: {
                            day: 'dd/MM',
                            month: 'MMM yyyy',
                            year: 'yyyy'
                        }
                    },
                    title: { display: true, text: 'Fecha' },
                    // Establecer límites del eje x al rango de fechas seleccionado
                    min: dateRange !== 'all' ? startDate : undefined,
                    max: dateRange !== 'all' ? endDate : undefined
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Frecuencia de Crisis' },
                    beginAtZero: true,
                    max: maxSeizureScale
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Dosis Medicamento (mg)' },
                    grid: {
                        drawOnChartArea: false
                    },
                    beginAtZero: true,
                    max: maxMedScale
                }
            }
        }
    });

    // Limpiar contenedor de gráficos individuales ya que ahora usamos el combinado mejorado
    document.getElementById('medicationsSections').innerHTML = '';
}

// Crear gráfico de distribución horaria
function createTimeOfDayChart() {
    const ctx = document.getElementById('timeOfDayChart').getContext('2d');

    if (charts.timeOfDay) {
        charts.timeOfDay.destroy();
    }

    // Calcular distribución por hora (0-23)
    const hourCounts = new Array(24).fill(0);

    // Filtrar según rango de fechas seleccionado
    const dateRange = document.getElementById('dateRange').value;
    const now = new Date();
    let startDate = new Date(0);

    if (dateRange === '1year') startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    else if (dateRange === '6months') startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    else if (dateRange === '3months') startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    else if (dateRange === '1month') startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const filteredSeizures = seizuresData.filter(s => s.date >= startDate);

    filteredSeizures.forEach(s => {
        const hour = s.date.getHours();
        hourCounts[hour]++;
    });

    charts.timeOfDay = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Crisis por Hora',
                data: hourCounts,
                backgroundColor: hourCounts.map(count => {
                    // Color más intenso para horas con más crisis
                    const max = Math.max(...hourCounts);
                    const opacity = max > 0 ? (count / max) * 0.8 + 0.2 : 0.2;
                    return `rgba(102, 126, 234, ${opacity})`;
                }),
                borderColor: '#667eea',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => `Hora: ${items[0].label}`,
                        label: (item) => `${item.raw} crisis registradas`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Cantidad de Crisis' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Obtener datos para el gráfico de crisis (lógica compartida)
function getSeizuresChartData() {
    const groupBy = document.getElementById('groupBy').value;
    const dateRange = document.getElementById('dateRange').value;
    const seizureType = document.getElementById('seizureType').value;

    // Filtrar datos
    let filteredData = seizuresData;

    if (seizureType !== 'all') {
        filteredData = filteredData.filter(s => s.type === seizureType);
    }

    // Aplicar filtro de fecha
    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date(now);

    if (dateRange === 'custom') {
        const customStartDate = document.getElementById('customStartDate').value;
        const customEndDate = document.getElementById('customEndDate').value;

        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) {
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
        }

        filteredData = filteredData.filter(s => {
            const seizureDate = new Date(s.date);
            return seizureDate >= startDate && seizureDate <= endDate;
        });
    } else {
        switch (dateRange) {
            case '1year': startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
            case '6months': startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
            case '3months': startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
            case '1month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
        }

        if (dateRange !== 'all') {
            filteredData = filteredData.filter(s => s.date >= startDate);
        }
    }

    // Agrupar datos
    const grouped = {};
    filteredData.forEach(seizure => {
        let key;
        switch (groupBy) {
            case 'day': key = seizure.day; break;
            case 'month': key = seizure.month; break;
            case 'year': key = seizure.year; break;
        }
        if (!grouped[key]) grouped[key] = 0;
        grouped[key]++;
    });

    // Ordenar y preparar arrays
    const sortedKeys = Object.keys(grouped).sort();
    const labels = sortedKeys.map(key => {
        switch (groupBy) {
            case 'day': return new Date(key);
            case 'month': return new Date(key + '-01');
            case 'year': return new Date(key + '-01-01');
        }
    });

    const values = sortedKeys.map(key => grouped[key]);
    const trend = calculateTrend(values);

    return { labels, values, trend };
}

// Calcular tendencia lineal
function calculateTrend(values) {
    if (values.length < 2) return values;
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return x.map(xi => slope * xi + intercept);
}

// Generar insights mejorados para el paciente
function generateInsights() {
    const insights = [];
    const container = document.getElementById('insightsContainer');
    container.innerHTML = '';

    if (seizuresData.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">No hay datos suficientes para generar insights.</p></div>';
        return;
    }

    // 1. Insight de Horario (Patrón Circadiano)
    const hours = seizuresData.map(s => s.date.getHours());
    const morning = hours.filter(h => h >= 6 && h < 12).length;
    const afternoon = hours.filter(h => h >= 12 && h < 18).length;
    const evening = hours.filter(h => h >= 18 && h < 24).length;
    const night = hours.filter(h => h >= 0 && h < 6).length;

    let maxPeriod = 'Mañana';
    let maxCount = morning;
    if (afternoon > maxCount) { maxPeriod = 'Tarde'; maxCount = afternoon; }
    if (evening > maxCount) { maxPeriod = 'Noche'; maxCount = evening; }
    if (night > maxCount) { maxPeriod = 'Madrugada'; maxCount = night; }

    insights.push({
        type: 'info',
        icon: 'fa-clock',
        title: 'Patrón Horario',
        content: `Tus crisis tienden a ocurrir más frecuentemente por la <strong>${maxPeriod.toLowerCase()}</strong>.`
    });

    // 2. Racha sin crisis
    const lastSeizureDate = new Date(Math.max(...seizuresData.map(s => s.date)));
    const daysSince = Math.floor((new Date() - lastSeizureDate) / (1000 * 60 * 60 * 24));

    if (daysSince > 30) {
        insights.push({
            type: 'positive',
            icon: 'fa-trophy',
            title: '¡Excelente Racha!',
            content: `Llevas <strong>${daysSince} días</strong> sin registrar crisis. ¡Sigue así!`
        });
    } else {
        insights.push({
            type: 'info',
            icon: 'fa-calendar-day',
            title: 'Estado Actual',
            content: `Han pasado ${daysSince} días desde tu última crisis registrada.`
        });
    }

    // 3. Tendencia Reciente (Comparativa simple)
    const now = new Date();
    const last3Months = seizuresData.filter(s => s.date >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
    const prev3Months = seizuresData.filter(s =>
        s.date >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()) &&
        s.date < new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    );

    if (last3Months.length < prev3Months.length) {
        const reduction = Math.round(((prev3Months.length - last3Months.length) / prev3Months.length) * 100);
        insights.push({
            type: 'positive',
            icon: 'fa-chart-line',
            title: 'Tendencia Positiva',
            content: `Has tenido un <strong>${reduction}% menos</strong> de crisis en los últimos 3 meses comparado con el periodo anterior.`
        });
    } else if (last3Months.length > prev3Months.length) {
        insights.push({
            type: 'warning',
            icon: 'fa-exclamation-circle',
            title: 'Atención a la Tendencia',
            content: `La frecuencia ha aumentado recientemente. Revisa si ha habido cambios en tu medicación o rutina.`
        });
    }

    // Renderizar insights
    insights.forEach(insight => {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-3';
        col.innerHTML = `
            <div class="insight-card ${insight.type} h-100">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas ${insight.icon} fa-lg me-2"></i>
                    <h6 class="mb-0 fw-bold">${insight.title}</h6>
                </div>
                <p class="mb-0 small">${insight.content}</p>
            </div>
        `;
        container.appendChild(col);
    });
}

// Actualizar estadísticas
function updateStatistics() {
    const totalSeizures = seizuresData.length;
    if (totalSeizures === 0) return;

    const lastSeizure = new Date(Math.max(...seizuresData.map(s => s.date)));
    const firstSeizure = new Date(Math.min(...seizuresData.map(s => s.date)));
    const monthsBetween = (lastSeizure - firstSeizure) / (1000 * 60 * 60 * 24 * 30);
    const avg = monthsBetween > 0 ? totalSeizures / monthsBetween : 0;
    const daysFree = Math.floor((new Date() - lastSeizure) / (1000 * 60 * 60 * 24));

    document.getElementById('totalSeizures').textContent = totalSeizures;
    document.getElementById('avgSeizures').textContent = avg.toFixed(1);
    document.getElementById('lastSeizure').textContent = lastSeizure.toLocaleDateString('es-ES');
    document.getElementById('seizureFree').textContent = daysFree;
}

// Verificar crisis recientes
function checkRecentSeizures() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recent = seizuresData.filter(s => s.date >= oneWeekAgo);

    const alertBox = document.getElementById('crisisAlert');
    if (recent.length > 0) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i><strong>Actividad Reciente:</strong> Se han registrado ${recent.length} crisis en los últimos 7 días.`;
    } else {
        alertBox.style.display = 'none';
    }
}

// Poblar filtros
function populateFilters() {
    const types = [...new Set(seizuresData.map(s => s.type || 'Unknown'))];
    const select = document.getElementById('seizureType');
    while (select.children.length > 1) select.removeChild(select.lastChild);
    types.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        select.appendChild(opt);
    });

    // Inicializar fechas custom
    const dates = seizuresData.map(s => s.date).filter(d => !isNaN(d));
    if (dates.length > 0) {
        const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const max = new Date(Math.max(...dates)).toISOString().split('T')[0];
        const startIn = document.getElementById('customStartDate');
        const endIn = document.getElementById('customEndDate');
        if (startIn && endIn) {
            startIn.min = min; startIn.max = max; startIn.value = min;
            endIn.min = min; endIn.max = max; endIn.value = max;
        }
    }
}

// Manejar cambio de rango fecha
function handleDateRangeChange() {
    const range = document.getElementById('dateRange').value;
    const start = document.getElementById('customStartDate');
    const end = document.getElementById('customEndDate');
    if (range === 'custom') {
        start.disabled = false;
        end.disabled = false;
    } else {
        start.disabled = true;
        end.disabled = true;
    }
    updateCharts();
}

// Actualizar todos los gráficos
function updateCharts() {
    createSeizuresChart();
    createCombinedChart();
    createTimeOfDayChart();
}

// Helpers
function getTimeUnit() {
    const gb = document.getElementById('groupBy').value;
    return gb === 'year' ? 'year' : gb === 'day' ? 'day' : 'month';
}
