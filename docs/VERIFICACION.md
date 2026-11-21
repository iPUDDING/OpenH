# Informe de verificación — OpenHub 1.4.4

**Fecha:** 11 de noviembre de 2026.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Correcto, sin errores TypeScript. |
| `npm test` | 14 archivos; **72/72 pruebas unitarias** superadas (incluye parsers OOXML: XML, DOCX, PPTX y XLSX). |
| `npm run build` | Build Vite de producción correcto; **2430 módulos** transformados (chunk `office` diferido con JSZip). |
| `npm audit --omit=dev --audit-level=low` | **0 vulnerabilidades** en dependencias de producción. |
| `node verify-improvements.mjs` | **11 comprobaciones** funcionales superadas, incluida búsqueda en el documento abierto desde `Ctrl+K` en Markdown y PDF; **`errors: []`**. |
| `node verify-usability.mjs` | **21 comprobaciones** de usabilidad superadas, incluida barra de lectura arrastrable y vertical en Apple Oscuro; **`errors: []`**. |
| `node verify-updater.mjs` | **8 comprobaciones** del actualizador superadas; **`errors: []`**. |
| `node verify-pomodoro.mjs` | **6 comprobaciones** de apilamiento, clics y alarmas superadas; **`errors: []`**. |
| `node verify-navigation.mjs` | **10 comprobaciones** de identidad, Recientes y pantalla completa (`F11` global) superadas; **`errors: []`**. |
| `node verify-viewer-features.mjs` | **25 comprobaciones** de zoom con scroll, renombrado, subrayado de títulos/subtítulos, atajo `Espacio`, tiempo restante, fórmulas LaTeX, guiones, menú contextual de lectura y visor DOCX/PPTX/XLSX superadas; **`errors: []`**. |

Total de navegador: **81/81 comprobaciones** sobre el frontend de producción servido en el puerto 1420 mediante Chromium/Playwright. No se modifica la interfaz distribuida para aparentar resultados.

## Rendimiento (1.4.1)

El parser Markdown/KaTeX y sus estilos ahora se cargan bajo demanda al mostrar una vista previa. El chunk inicial de la aplicación pasó de 766,36 KB (235,89 KB gzip) a 265,68 KB (85,34 KB gzip); la hoja CSS inicial de 73,35 KB (17,44 KB gzip) pasó a 43,26 KB (9,21 KB gzip). La barra de progreso actualiza su transform/ARIA directamente durante el scroll, evitando renders del visor por cada evento; la búsqueda de contenido no normaliza documentos mientras la paleta está cerrada y reutiliza el texto normalizado durante la sesión de búsqueda. Detalle y límites en [RENDIMIENTO-1.4.1.md](RENDIMIENTO-1.4.1.md).

## Búsqueda en el documento abierto desde la paleta

`verify-improvements.mjs` escribe un término único en `Ctrl+K`, selecciona “Buscar … en [documento actual]” y verifica que el visor salta a la coincidencia y la resalta mediante CSS Custom Highlight API o el fallback local. En documentos DOM (Markdown/TXT/Office), `Ctrl+G` avanza y `Ctrl+Mayús+G` retrocede; en PDF la solicitud de la paleta usa el buscador PDF existente, incluidos el conteo, el resaltado y la navegación de página. No reemplaza las acciones de comandos ni la búsqueda global en Recientes. Captura real de Chromium: `docs/screenshots/mejoras/33-busqueda-documento-paleta.png`.

## E2E general

En Mapas mentales, el botón “Ocultar editor Markdown” amplía el lienzo sin cerrar el mapa; “Mostrar editor Markdown” restaura el panel y el texto.


1. Abre `Ctrl+K`, busca texto dentro de un documento reciente y comprueba el fragmento; después busca “mapas” y ejecuta el comando.
2. Comprueba un índice Markdown de cuatro encabezados.
3. Busca “Implementación” en Markmap y comprueba el nodo activo.
4. Crea una regla “Kubernetes” → “ku ber ne tes” y verifica su persistencia.
5. Descarga una copia JSON y comprueba aplicación `OpenHub`, versión `1` y regla incluida.
6. Genera y abre un PDF real de dos páginas; verifica que el contador corresponde al PDF y no al Markdown anterior.
7. Busca “Segunda”, comprueba `openhub-search`/`openhub-search-current` y el salto automático a página 2.

## E2E de documentos Office (DOCX, PPTX y XLSX)

`verify-viewer-features.mjs` abre archivos DOCX, PPTX y XLSX reales generados por
`scripts/generate-fixtures.mjs` (con encabezados, listas, tablas, imágenes, enlaces,
notas de diapositiva y hojas múltiples) y verifica:

1. DOCX: encabezados `h1`/`h2`, lista de 3 elementos, tabla con cabecera, imagen
   embebida, enlace externo, insignia `DOCX` y lectura TTS del título.
2. PPTX: dos diapositivas en orden con títulos, cuerpo, lista, tabla, imagen,
   notas del orador en cita, insignia `PPTX` e índice navegable entre diapositivas.
3. XLSX: dos hojas en orden (`Técnicas`, `Resumen`) con tablas, valores numéricos,
   booleano, celda combinada, hipervínculo e insignia `XLSX`.

## E2E de menú contextual de lectura

`verify-viewer-features.mjs` verifica el clic derecho sobre el documento:

1. Clic derecho sobre el segundo párrafo: aparece el menú con
   “Empezar lectura desde aquí” junto al cursor.
2. Al elegir la acción, la lectura TTS comienza en ese párrafo (no desde el título).
3. Clic derecho en zona vacía, lejos del texto: no aparece el menú propio
   (se conserva el menú nativo del navegador).

## E2E de temas Apple

`verify-usability.mjs` verifica la sección Temas de Ajustes:

1. Al elegir “Apple Claro”: `data-theme="apple-light"` en `<html>` y barra
   de lectura flotante (`position: absolute`).
2. “Apple Oscuro”: `data-theme="apple-dark"` con clase `dark`.
3. “Apple con Índice”: el panel de índice del documento visible por defecto.
4. En “Apple Oscuro”, arrastrar el control de agarre al lateral izquierdo acopla la barra, la convierte en una columna vertical y guarda la posición local; `ArrowDown` la devuelve abajo.
5. “Apple Foco”: la barra lateral queda totalmente oculta (`w-0`).
6. Volver a “Claro” restaura el aspecto clásico (sin `data-theme`).

Captura real de la barra acoplada en vertical: `docs/screenshots/mejoras/34-barra-lectura-vertical.png`.

## E2E de experiencia de lectura y productividad

`verify-viewer-features.mjs` verifica las funciones de lectura:

1. Barra de progreso visible y `aria-valuenow` actualizado al desplazarse (`role="progressbar"`).
2. Estadísticas en el encabezado: palabras, caracteres y minutos estimados.
3. Papel sepia aplicado al área del documento y persistente tras recargar.
4. Marcador y nota guardados y visibles en el panel lateral.

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
10. El tiempo restante muestra la duración total estimada en `mm:ss` en reposo y, durante la lectura, una cuenta regresiva en vivo que baja al avanzar de párrafo (con palabras restantes y total).
11. Las fórmulas LaTeX (`$\ge 90\,\%$`, `$\frac{1}{2}$`, `$x^2$`) se leen en español natural («mayor o igual que 90 por ciento», «fracción 1 sobre 2», «al cuadrado») sin código fuente literal, y el subrayado TTS permanece conectado.
12. Los guiones (`-`, `–`, `—`) no se saltan: la raya larga se lee como pausa («técnica, que es nueva, funciona»), el rango como «10 a 15» y el compuesto como «teórico práctico», con subrayado conectado.

Capturas finales: `docs/screenshots/mejoras/07-…` hasta `22-…`.

## Errores corregidos en esta ronda

- La voz se saltaba los guiones (`-`, `–`, `—`) y leía las palabras pegadas. Ahora (`src/lib/dashSpeech.ts`) la raya larga y el guion espaciado se leen como pausa, los rangos como «10 a 15», los compuestos como «teórico práctico», el marcador de lista se omite, el signo menos se conserva y el guion suave de PDF une la palabra cortada; todo con mapa de offsets y sin tocar bloques de código.
- Las fórmulas LaTeX se leían literalmente (`$\ge 90\,\%$` sonaba como código) y el visor saltaba de forma errática durante la lectura: el mapa de texto incluía el MathML invisible de KaTeX (con la anotación del código TeX duplicada) junto con los glifos visibles. Ahora (`src/lib/mathSpeech.ts` + `domTextMap.ts`) el MathML se excluye, cada fórmula se convierte a español hablado («mayor o igual que 90 por ciento») con mapa de offsets hacia los glifos visibles, los bloques de código no se tocan y los rangos colapsados ya no mueven el auto-scroll.
- El apartado de tiempo restante se rehízo: antes solo se recalculaba al cambiar de párrafo (no bajaba dentro del párrafo), se mostraba redondeado a minutos enteros y usaba una velocidad fija de 180 palabras/min sin tener en cuenta la voz real. Ahora (`src/lib/readingTime.ts` + `useTts.ts`) calcula las palabras restantes desde la palabra actual, muestra una cuenta regresiva en vivo `mm:ss` (con duración total y palabras en reposo), suma pausas por puntuación y calibra la velocidad con la velocidad real observada de la voz; la pausa congela el contador y al reanudar no cuenta el tiempo detenido.
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
