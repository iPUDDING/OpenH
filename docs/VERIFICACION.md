# Informe de verificación — OpenHub 1.0.5

**Fecha:** 11 de noviembre de 2026.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Correcto, sin errores TypeScript. |
| `npm test` | 6 archivos; **22/22 pruebas unitarias** superadas. |
| `npm run build` | Build Vite de producción correcto; **2414 módulos** transformados. |
| `npm audit --omit=dev --audit-level=low` | **0 vulnerabilidades** en dependencias de producción. |
| `node verify-improvements.mjs` | **7 comprobaciones** funcionales superadas; **`errors: []`**. |
| `node verify-usability.mjs` | **14 comprobaciones** de usabilidad superadas; **`errors: []`**. |
| `node verify-updater.mjs` | **8 comprobaciones** del actualizador superadas; **`errors: []`**. |
| `node verify-pomodoro.mjs` | **6 comprobaciones** de apilamiento, clics y alarmas superadas; **`errors: []`**. |
| `node verify-navigation.mjs` | **9 comprobaciones** de identidad, Recientes y pantalla completa superadas; **`errors: []`**. |

Total de navegador: **44/44 comprobaciones** sobre el frontend de producción servido en el puerto 1420 mediante Chromium/Playwright. No se modifica la interfaz distribuida para aparentar resultados.

## E2E general

1. Abre `Ctrl+K`, busca “mapas” y ejecuta el comando.
2. Comprueba un índice Markdown de cuatro encabezados.
3. Busca “Implementación” en Markmap y comprueba el nodo activo.
4. Crea una regla “Kubernetes” → “ku ber ne tes” y verifica su persistencia.
5. Descarga una copia JSON y comprueba aplicación `OpenHub`, versión `1` y regla incluida.
6. Genera y abre un PDF real de dos páginas; verifica que el contador corresponde al PDF y no al Markdown anterior.
7. Busca “Segunda”, comprueba `openhub-search`/`openhub-search-current` y el salto automático a página 2.

## E2E de usabilidad y regresiones

`verify-usability.mjs` sustituye Web Speech **solo dentro del navegador de prueba** para inspeccionar el texto entregado al motor. La aplicación distribuida conserva las voces reales de Windows/Web Speech.

1. Lee exactamente una selección de la vista previa y conserva ese ámbito en Anterior/Repetir.
2. Comprueba instrucciones sin selección y lectura de una selección del editor Markdown.
3. Edita el documento durante TTS, verifica que se detiene la fuente anterior y que una nueva lectura recorre el título y párrafo actualizados.
4. Inicia y pausa Pomodoro; comprueba que el tiempo permanece inmóvil y no vuelve a 25:00.
5. Salta una sesión sin incrementar las completadas; cierra el panel con Escape y con clic exterior.
6. Oculta/recupera la barra superior mediante botones, `Ctrl+Shift+H` y paleta; comprueba el aumento del área principal.

## E2E del actualizador

`verify-updater.mjs` simula el IPC de Tauri solo en QA para no publicar ni instalar una release de prueba. Verifica detección automática, versión/notas, descarte persistente, recuperación manual, contención/restauración de foco, Escape, eventos de descarga, reinicio, estado actualizado y error de red con reintento. La validación criptográfica y el reinicio real deben probarse después en Windows con una release firmada.

## E2E específico de Pomodoro

`verify-pomodoro.mjs` comprueba con `document.elementFromPoint` y clics reales que Iniciar, Pausar, Reiniciar y Siguiente están por delante del contenido en Visor, Estudio TTS y Mapas. También verifica que pausar/reiniciar/saltar no generan alarmas.

Para recorrer los vencimientos sin esperar 30 minutos, la prueba configura sesiones de 1,2 segundos en el almacenamiento del navegador aislado. El temporizador real termina enfoque y descanso, cambia de modo y actualiza las estadísticas. Se sustituye `AudioContext` **solo en QA** para registrar las frecuencias programadas: `[880, 660, 880]` al terminar enfoque y `[523.25, 659.25, 523.25]` al terminar descanso. Esto valida la lógica y la programación de audio; la salida audible física y las políticas concretas de WebView2 deben comprobarse en Windows.

## E2E de Recientes y pantalla completa

`verify-navigation.mjs` crea dos borradores con nombres únicos, comprueba que el segundo no sobrescribe el primero, recupera su contenido desde Recientes y abre un Markdown real mediante el selector de archivos. Después entra y sale de pantalla completa con el botón y con `F11`.

En una segunda página aislada simula únicamente el IPC de Tauri para comprobar `isFullscreen`, `setFullscreen(true/false)` y la sincronización cuando la ventana cambia externamente. La versión web utiliza la Fullscreen API real de Chromium, no un doble.

Capturas finales: `docs/screenshots/mejoras/07-…` hasta `17-…`.

## Errores corregidos en esta ronda

- El panel Pomodoro podía quedar tapado por otros elementos: ahora usa un portal, z-index superior, posición adaptada al viewport y cierre al ocultarse su herramienta.
- No existía aviso sonoro al finalizar: ahora hay dos melodías Web Audio locales, desbloqueadas al pulsar Iniciar y aisladas de errores del dispositivo.
- Editar durante TTS podía conservar la fuente anterior; además, un primer intento de corrección reemplazaba indebidamente «Leer selección» por el documento. La fuente activa ahora solo cambia cuando cambian los segmentos.
- Los borradores Markdown vacíos recuperaban contenido antiguo en recientes.
- Restaurar una copia sin ruta o modo de visor podía borrar esos valores actuales.
- Los rangos de búsqueda normalizada se desplazaban con coreano, emojis y acentos descompuestos; ahora incluyen también las marcas combinantes finales.
- La búsqueda DOM podía limitarse al primer bloque; ahora recorre todos los segmentos hasta el límite global de 500 coincidencias.
- Se endurecieron nombres reservados de Windows, progreso no finito, índice activo, Pomodoro, paleta y foco del actualizador.
- Restaurar una copia cancela cualquier voz activa antes de reemplazar el estado.
- La compilación dentro de `tauri-action` podía recibir un `package.json` sin `version`; `useAppVersion` ahora tolera metadatos incompletos y conserva `getVersion()` como fuente real en Windows. Se verificó `npm run build` con la propiedad eliminada temporalmente y se restauró el archivo después.
- Recientes permite crear borradores únicos y abrir archivos sin salir de la barra lateral; el editor recupera correctamente el contenido seleccionado.
- Pantalla completa funciona con botón y `F11`, con permisos nativos explícitos, fallback web y sincronización de estado.

## Alcance y límites

- El entorno actual no incluye Rust/Cargo ni WebView2; no se afirma compilación nativa local, ejecución del instalador Windows ni prueba auditiva física.
- La configuración Tauri v2, iconos, permisos, actualizador y `.github/workflows/build.yml` están incluidos. El workflow de `windows-latest` con Node 22 y Rust 1.90+ debe producir NSIS/MSI al ejecutarse en GitHub; las releases requieren los secretos documentados en `docs/ACTUALIZACIONES.md`.
- WebView2 utiliza este mismo frontend de producción. Los diálogos nativos, impresión, rutas de archivos, voces y dispositivo de audio dependen de Windows y del equipo.
- Playwright se instala únicamente para QA con `--no-save`; no se incluye en el bundle ni es un requisito de ejecución.
