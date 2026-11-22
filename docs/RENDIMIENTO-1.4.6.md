# Rendimiento y robustez de OpenHub 1.4.6

## Cambios

- **Indexación PDF más rápida sin paralelismo ilimitado:** extracción de texto concurrente con un máximo de cuatro páginas activas. Los resultados se ensamblan en el orden original, así que el índice, la búsqueda y la lectura TTS conservan el orden de las páginas.
- **Cancelación de cargas PDF:** al cerrar el visor, cambiar el PDF o desmontar el componente, se aborta el trabajo pendiente y se destruye la tarea de PDF.js. También se comprueba la cancelación después de cargar los módulos locales y antes de iniciar la tarea, para no crear una lectura huérfana durante una carrera de desmontaje.
- **Menos asignaciones al mapear texto:** el recorrido del DOM ahora usa referencias a hermanos en lugar de materializar `Array.from(childNodes)` en cada nivel. Se conserva la misma lectura de fórmulas KaTeX, nodos excluidos y offsets TTS.
- **Utilidad de concurrencia reusable y comprobada:** `mapConcurrentOrdered` valida el límite, preserva orden, limita tareas simultáneas, deja de despachar al abortar/fallar y espera las tareas ya iniciadas antes de finalizar.

## Verificación

- `npm run typecheck`: sin errores.
- `npm test`: **76/76 pruebas**; incluye 4 pruebas para límite de concurrencia, orden, lista vacía, validación y cancelación.
- `npm run build`: build de producción y worker de PDF.js local.
- E2E Chromium: búsqueda y salto de coincidencia PDF, PDF de dos páginas, render y zoom, Markdown, DOCX, PPTX y XLSX; además, barra Apple Oscuro con controles de transporte horizontales al acoplarse en vertical.
- `npm audit --omit=dev`: 0 vulnerabilidades de producción.

La concurrencia fija en cuatro evita crear una tarea por página y acota la memoria temporal. La mejora reduce el cuello de botella serial para documentos extensos; los tiempos reales dependen del archivo, del dispositivo y de WebView2. No se hacen solicitudes a Internet: PDF.js y su worker siguen siendo recursos locales empaquetados.
