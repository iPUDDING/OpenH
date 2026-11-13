# Informe de verificación — OpenHub 1.0.7

**Fecha:** 11 de noviembre de 2026.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Correcto, sin errores TypeScript. |
| `npm test` | 6 archivos; **27/27 pruebas unitarias** superadas. |
| `npm run build` | Build Vite de producción correcto; **2414 módulos** transformados. |
| `npm audit --omit=dev --audit-level=low` | **0 vulnerabilidades** en dependencias de producción. |
| `node verify-improvements.mjs` | **7 comprobaciones** funcionales superadas; **`errors: []`**. |
| `node verify-usability.mjs` | **14 comprobaciones** de usabilidad superadas; **`errors: []`**. |
| `node verify-updater.mjs` | **8 comprobaciones** del actualizador superadas; **`errors: []`**. |
| `node verify-pomodoro.mjs` | **6 comprobaciones** de apilamiento, clics y alarmas superadas; **`errors: []`**. |
| `node verify-navigation.mjs` | **10 comprobaciones** de identidad, Recientes y pantalla completa (`F11` global) superadas; **`errors: []`**. |
| `node verify-viewer-features.mjs` | **13 comprobaciones** de zoom con scroll, renombrado, subrayado de títulos/subtítulos y atajo `Espacio` superadas; **`errors: []`**. |

Total de navegador: **58/58 comprobaciones** sobre el frontend de producción servido en el puerto 1420 mediante Chromium/Playwright. No se modifica la interfaz distribuida para aparentar resultados.

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

En una segunda página aislada simula únicamente el IPC de Tauri para comprobar `isFullscreen`, `setFullscreen(true/false)`, la sincronización cuando la ventana cambia externamente y que `F11` continúa alternando pantalla completa incluso cuando la barra superior está oculta. La versión web utiliza la Fullscreen API real de Chromium, no un doble.

## E2E de zoom con scroll, renombrado, subrayado de títulos y atajo Espacio

`verify-viewer-features.mjs` verifica el visor sobre Markdown, editor dividido, PDF, archivos con ruta local simulada y lectura TTS en Visor y Estudio TTS:

1. La rueda normal sin `Ctrl` sigue desplazando el documento Markdown verticalmente sin alterar el zoom.
2. `Ctrl + rueda` acerca y aleja Markdown proporcionalmente sin desbordar horizontalmente la columna de lectura, y `Ctrl + 0` o los botones `− / % / +` controlan y restablecen el `100%`.
3. En vista dividida, `Ctrl + rueda` escala también el editor Markdown.
4. En PDF, `Ctrl + rueda` acerca y aleja la página y `Ctrl + 0` restablece al `100%`.
5. Hacer clic sobre el nombre en la barra superior permite renombrar el documento (`Enter` guarda y `Escape` cancela) sin colisiones con borradores posteriores.
6. Renombrar desde el menú lateral (`Recientes` vía botón de lápiz o doble clic) actualiza la lista sin interrumpir otro documento abierto y sincroniza la barra superior cuando corresponde al documento activo.
7. En archivos con ruta real en Windows, renombrar cambia únicamente el título visible dentro de OpenHub (conservando la ruta real sin emitir comandos de renombrado en disco) y persiste al reabrir desde Recientes y al recargar.
8. El subrayado TTS mediante `CSS.highlights` (`openhub-word` y `openhub-phrase`) permanece conectado y resalta exactamente palabras dentro de títulos (`h1`), subtítulos (`h2`/`h3`) y nodos con enlaces o negrita.
9. Pulsar `Espacio` pausa y reanuda la lectura tanto en el Visor como en Estudio TTS (incluso con el foco en controles TTS o tras pulsar un párrafo), mientras sigue escribiendo espacios normalmente dentro del editor Markdown.

Capturas finales: `docs/screenshots/mejoras/07-…` hasta `20-…`.

## Errores corregidos en esta ronda

- El resaltado TTS en títulos y subtítulos Markdown (`h1`–`h6`) y enlaces podía quedar desconectado al re-renderizar porque los wrappers inline en `ReactMarkdown` desmontaban esos nodos DOM y dejaban huérfanas las referencias guardadas en `DocumentTextMap`; ahora los encabezados nativos y `MarkdownLink` mantienen nodos estables y asignan IDs tras el commit en `useLayoutEffect`.
- `F11` ahora se escucha en fase de captura desde la raíz de la aplicación (`App.tsx` + `useFullscreen.ts`), de modo que funciona siempre incluso cuando la barra superior está oculta o en cualquier vista, y es invocable también desde la paleta `Ctrl+K`.
- Se añadió el atajo global contextual `Espacio` (`useSpeechSpaceShortcut`) en Visor y Estudio TTS para pausar/reanudar/detener la lectura activa sin interferir con editores, entradas, deslizadores, diálogos o Pomodoro.

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
