# Informe de verificación — OpenHub 1.0.0

**Fecha:** 11 de noviembre de 2026.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Correcto, sin errores TypeScript. |
| `npm test` | 4 archivos; **15/15 pruebas unitarias** superadas. |
| `npm run build` | Build Vite de producción correcto; 2406 módulos transformados. |
| `npm audit --omit=dev --audit-level=low` | **0 vulnerabilidades** en dependencias de producción. |
| `node verify-improvements.mjs` | **7 comprobaciones** funcionales superadas; **`errors: []`**. |
| `node verify-usability.mjs` | **11 comprobaciones** de usabilidad superadas; **`errors: []`**. |

## E2E general

El script utiliza el frontend de producción servido en el puerto 1420 y Chromium mediante Playwright. No modifica la interfaz para simular funciones.

1. Abre `Ctrl+K`, busca “mapas” y ejecuta el comando.
2. Comprueba un índice Markdown de cuatro encabezados.
3. Busca “Implementación” en Markmap y comprueba el nodo activo.
4. Crea una regla “Kubernetes” → “ku ber ne tes” y verifica su persistencia.
5. Descarga una copia JSON y comprueba aplicación `OpenHub`, versión `1` y regla incluida.
6. Genera y abre un PDF real de dos páginas; verifica que el contador del encabezado corresponde al PDF y no al Markdown anterior.
7. Busca “Segunda”, comprueba `openhub-search`/`openhub-search-current` y el salto automático a página 2.

## E2E de usabilidad y regresiones

`verify-usability.mjs` sustituye Web Speech **solo dentro del navegador de prueba** para inspeccionar el texto entregado al motor. La aplicación distribuida conserva las voces reales de Windows/Web Speech.

1. Selecciona “selección importante” en la vista previa y comprueba que se lee exactamente ese fragmento.
2. Pulsa “Párrafo anterior” durante esa lectura y verifica que no vuelve al documento completo.
3. Finaliza y repite la selección sin cambiar de ámbito.
4. Elimina la selección y comprueba que aparecen instrucciones sin iniciar otra reproducción.
5. Selecciona texto dentro del editor Markdown y verifica su lectura.
6. Inicia y pausa Pomodoro; comprueba que el tiempo permanece inmóvil y no vuelve a 25:00.
7. Salta una sesión y comprueba que no incrementa las completadas.
8. Oculta la barra superior con su botón y verifica el aumento del área principal.
9. Recupera la barra con el botón “Mostrar barra”.
10. Alterna la barra mediante `Ctrl+Shift+H` y la paleta de comandos.
11. Comprueba el atajo en ambos sentidos y ausencia de errores de ejecución.

Capturas finales: `docs/screenshots/mejoras/07-…` hasta `13-…`.

## Errores corregidos en esta ronda

- La selección podía perderse al pulsar el botón; ahora se conserva y admite vista previa, editor y PDF.
- Anterior/Repetir podían cambiar de una selección o prueba de voz al documento completo.
- Pausar Pomodoro restablecía el tiempo inicial.
- Saltar una sesión de trabajo se contabilizaba como sesión completada.
- El tiempo TTS restante podía volver al total tras finalizar.
- El encabezado de un PDF mostraba el contador del Markdown anterior.
- Cancelar una exportación Markmap podía mostrar “Exportación completada”.
- Cerrar búsqueda Markmap conserva ahora un estado visual coherente; `Ctrl+G` navega coincidencias.
- Quitar recientes es accesible también mediante teclado.

## Alcance y límites

- El entorno de desarrollo actual no incluye Rust/Cargo ni WebView2; por ello no se afirma una compilación nativa local ni una ejecución real del instalador Windows.
- La configuración Tauri v2, iconos, permisos y `.github/workflows/build.yml` están incluidos. El workflow de `windows-latest` con Node 22 debe producir NSIS/MSI al ejecutarse en GitHub.
- WebView2 utiliza este mismo frontend de producción. Los diálogos nativos, impresión, rutas de archivos y voces dependen de Windows y del equipo.
- Playwright se instala únicamente para QA con `--no-save`; no se incluye en el bundle ni es un requisito de ejecución.
