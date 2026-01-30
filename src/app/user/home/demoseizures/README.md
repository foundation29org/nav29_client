# Análisis de Crisis Epilépticas - Sergio Isla

Esta aplicación web proporciona un análisis completo de los datos de crisis epilépticas y medicamentos del paciente Sergio Isla, extraídos de SeizureTracker.com.

## 🎯 Características

### 📊 Gráficos Interactivos
- **Gráfico de Crisis con Tendencia**: Muestra la frecuencia de crisis a lo largo del tiempo con línea de tendencia
- **Medicamentos vs Crisis**: Compara la frecuencia de crisis con las dosis de medicamentos
- **Evolución de Dosis**: Visualiza los cambios en las dosis de medicamentos a lo largo del tiempo

### 🔍 Filtros y Agrupación
- **Agrupación temporal**: Por día, mes o año
- **Rangos de fecha**: Último mes, 3 meses, 6 meses, 1 año o todo el período
- **Filtro por tipo de crisis**: Tonic Clonic, Unknown, etc.

### 📈 Insights Automáticos
- Análisis de frecuencia de crisis
- Identificación del tipo de crisis más común
- Detección de tendencias (mejora o empeoramiento)
- Información sobre medicamentos activos
- Análisis de patrones temporales (horarios más comunes)

### ⚠️ Alertas
- Notificación automática cuando hay crisis recientes (última semana)
- Estadísticas en tiempo real

### 📋 Tabla de Crisis Recientes
- Lista de las 20 crisis más recientes
- Información detallada: fecha, tipo, duración, triggers y descripción

## 🚀 Cómo Usar

### Paso 1: Abrir la Aplicación
1. Abre el archivo `index.html` en tu navegador web
2. Verás una pantalla de carga de archivos

### Paso 2: Cargar los Datos
Tienes dos opciones para cargar el archivo JSON:

**Opción A: Seleccionar archivo**
- Haz clic en el botón "Seleccionar Archivo JSON"
- Navega hasta el archivo `SergioIsla_ST20251104_ JSON.json`
- Selecciona el archivo

**Opción B: Arrastrar y soltar**
- Arrastra el archivo JSON directamente a la zona de carga
- El archivo se cargará automáticamente

### Paso 3: Explorar los Datos
Una vez cargados los datos:
- Los gráficos se generarán automáticamente
- Los insights aparecerán en la parte superior
- Las estadísticas se actualizarán
- La tabla mostrará las crisis más recientes

### Paso 4: Filtrar y Analizar
- Usa los filtros en la parte superior para personalizar la visualización:
  - Selecciona cómo agrupar los datos (día/mes/año)
  - Elige el rango de fechas que quieres analizar
  - Filtra por tipo específico de crisis
- Haz clic en "Actualizar Gráficos" para aplicar los filtros

## 📁 Estructura de Archivos

```
SeizureTracker/
├── index.html              # Página principal
├── styles.css              # Estilos CSS
├── script.js               # Lógica JavaScript
├── README.md                # Este archivo
└── SergioIsla_ST20251104_ JSON.json  # Datos del paciente
```

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura de la página
- **CSS3**: Estilos modernos y responsivos
- **JavaScript ES6+**: Lógica de procesamiento y visualización
- **Bootstrap 5**: Framework CSS para diseño responsivo
- **Chart.js 4.4.0**: Biblioteca para gráficos interactivos
- **Font Awesome 6.0**: Iconos
- **FileReader API**: Para cargar archivos JSON localmente

## 📊 Análisis de Datos

La aplicación procesa automáticamente:

### Crisis Epilépticas
- Fechas y horas de ocurrencia
- Tipos de crisis (Tonic Clonic, Unknown, etc.)
- Duración de cada crisis
- Factores desencadenantes (triggers)
- Descripciones y notas

### Medicamentos
- Nombres de medicamentos
- Dosis diarias
- Fechas de inicio y fin
- Efectos secundarios
- Notas adicionales

## 💡 Insights Generados

La aplicación genera automáticamente insights como:

1. **Frecuencia promedio** de crisis por mes
2. **Tipo de crisis más común** y su porcentaje
3. **Tendencias temporales** (mejora o empeoramiento)
4. **Medicamentos activos** actualmente
5. **Días sin crisis** desde la última ocurrencia
6. **Patrones temporales** (horarios más comunes)

## ⚙️ Requisitos del Sistema

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- JavaScript habilitado
- Conexión a internet (para cargar las librerías CDN)

## 🔒 Privacidad y Seguridad

- **Todos los datos se procesan localmente** en tu navegador
- **No se envía información a ningún servidor**
- **Los archivos JSON nunca abandonan tu computadora**
- **Completamente privado y seguro**

## ❓ Solución de Problemas

### El archivo no se carga
- Verifica que el archivo sea un JSON válido
- Asegúrate de que el archivo no esté corrupto
- Intenta abrir la consola del navegador (F12) para ver errores

### Los gráficos no aparecen
- Verifica que tengas conexión a internet (para cargar Chart.js)
- Abre la consola del navegador (F12) para ver errores
- Recarga la página

### No hay datos visibles
- Verifica que el archivo JSON contenga las secciones "Seizures" y "Medications"
- Asegúrate de que las fechas estén en formato válido

## 📝 Notas Importantes

- Los datos se cargan desde el archivo JSON local usando FileReader API
- La aplicación es completamente client-side (no requiere servidor)
- Todos los cálculos se realizan en tiempo real
- Los gráficos son interactivos y responsivos
- Puedes cargar diferentes archivos JSON para comparar datos

## 🎨 Características de Diseño

- **Interfaz moderna y profesional** con gradientes y animaciones
- **Diseño responsivo** que funciona en móviles y tablets
- **Colores médicos apropiados** (azules, verdes, rojos para alertas)
- **Iconos intuitivos** de Font Awesome
- **Gráficos interactivos** con tooltips y zoom

---

**Desarrollado para análisis médico de crisis epilépticas**
*Datos extraídos de SeizureTracker.com el 4 de noviembre de 2025*


