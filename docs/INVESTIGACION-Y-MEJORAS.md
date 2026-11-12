# Investigación comparativa y mejoras implementadas

**Fecha de revisión:** 11 de noviembre de 2026  
**Alcance:** aplicaciones de lectura/TTS, escritura Markdown, visualización PDF y mapas mentales.  
**Decisión de arquitectura:** todas las funciones resultantes se ejecutan localmente. No se añadieron cuentas, IA en la nube, análisis ni dependencias de red en tiempo de ejecución.

## Comparativa profesional

| Referencia | Funciones y enfoque documentados | Decisión para OpenHub |
|---|---|---|
| **Balabolka** | Diccionarios de pronunciación, control de voz, seguimiento visual del texto y reproducción por frases. | Reglas de sustitución exclusivamente para TTS. El documento no se modifica y un mapa de rangos conserva el resaltado completo del término original. Se mantienen navegación por párrafos, velocidad/tono/volumen y prueba de voz. |
| **NaturalReader** | Lectura multi-formato, selección de voces, control de reproducción y flujo centrado en el texto. | Misma experiencia local con frase/palabra activa, avance automático y sincronización entre visor y estudio. No se reproduce su modelo de nube. |
| **Obsidian** | Paleta de comandos, esquema de documento y navegación por teclado como funciones centrales. | `Ctrl+K` abre una paleta accesible para módulos, documentos recientes, tema, barra lateral y Pomodoro. El índice Markdown ignora encabezados dentro de bloques de código y evita IDs duplicados. |
| **Typora** | Esquema navegable, escritura sin distracciones y opciones de enfoque. | Índice plegable, modos vista/preview/dividido y foco Markmap. Se adoptó el beneficio sin convertir el editor Markdown en un editor WYSIWYG incompatible con la arquitectura actual. |
| **PDF.js** | Home/End, PageUp/PageDown, flechas, `Ctrl+F`, `Ctrl+G` y `Shift+Ctrl+G`. | Atajos equivalentes, salto a la página de la coincidencia, navegación siguiente/anterior y dos niveles de resaltado independientes del TTS. El worker permanece local y se carga de forma diferida. |
| **XMind** | Navegación por temas, búsqueda, modos de concentración y mapas de gran tamaño. | Búsqueda con contador y centrado del tema activo. Los estados usan atributos `data-markmap-search`, compatibles con el ciclo D3 de Markmap. Se conservan foco, colapso y exportaciones. |
| **Pautas de accesibilidad** | Tamaño de texto, interlineado, medida de línea y ausencia de información basada solo en color. | Tamaño 80–200 %, interlineado 1,4–2,2, medida 600–1100 px, foco visible, navegación por teclado y contraste/coherencia con tema claro/oscuro/sistema. |

## Mejoras implementadas y verificación

| Mejora | Implementación | Verificación |
|---|---|---|
| Paleta de comandos | `src/components/layout/CommandPalette.tsx`; comandos centralizados, recientes filtrados, focus trap, Escape y restauración de foco. | E2E abre `Ctrl+K`, busca “mapas” y ejecuta el comando. |
| Índice Markdown | `src/lib/headings.ts` + `DocumentOutline.tsx`; IDs estables y salto por encabezado. | Pruebas unitarias y E2E con cuatro encabezados. |
| Lectura configurable | Estado persistido y variables CSS para Markdown/TTS. | Captura real de Ajustes; persistencia incluida en backup. |
| Pronunciación TTS | `pronunciation.ts`: rangos hablado→fuente; sustituciones de términos con límites Unicode. | Pruebas unitarias y E2E de alta/persistencia. |
| Prueba de voz | Reutiliza el servicio TTS seleccionado y cancelación global. | Typecheck/build; las voces disponibles dependen del equipo. |
| Búsqueda PDF | Índice por página, `CSS.Highlight` y fallback, salto de página y atajos. | E2E con PDF real de dos páginas, texto seleccionable, coincidencia en página 2 y cero errores. |
| Búsqueda Markmap | Consulta normalizada, siguiente/anterior, foco y centrado. | E2E con plantilla de proyecto, una coincidencia y atributo activo en DOM. |
| Backup/restauración | JSON versionado, exportación nativa/descarga y límite de importación de 5 MB. | E2E descarga y valida JSON; pruebas de esquema, límites, recientes y reglas. |
| Pomodoro superpuesto y alarmas | Portal a `document.body`, posición adaptada al viewport, cierre al ocultarse su herramienta y Web Audio local con melodías distintas para enfoque/descanso. | E2E pulsa los controles en Visor/TTS/Mapas, comprueba el elemento superior y recorre ambos vencimientos; AudioContext se simula solo en QA para inspeccionar las notas. |
| Robustez de texto y datos | Rangos Unicode exactos, borradores vacíos, backups parciales no destructivos, nombres seguros para Windows y versión tolerante a metadatos incompletos en CI. | 22 pruebas unitarias, incluidos coreano, acentos descompuestos, emojis, dispositivos reservados y `package.json` sin `version`. |
| Recientes y pantalla completa | Acciones laterales para texto/archivo, nombres únicos y `useFullscreen` con Tauri/Fullscreen API, `F11` y permisos nativos mínimos. Identidad `By SrMaxi` y versión base 1.0.5 sincronizadas. | 9 comprobaciones E2E de identidad, creación, recuperación, apertura, botón, atajo e IPC nativo. |

## Decisiones deliberadas

- **No se añaden marcadores de párrafo ni anotaciones PDF:** requieren un modelo persistente de posiciones y una migración adicional; no se simularon como controles sin función.
- **No se añade búsqueda global de contenido en PDF recientes:** los binarios PDF no se guardan en `localStorage` por capacidad y privacidad. Se conserva la ruta nativa cuando existe.
- **No se sustituye Markmap por una implementación propia:** se mantiene zoom/pan/colapso/exportación probados y se integra la búsqueda sin modificar dependencias.
- **No se fuerzan voces remotas:** la prueba y la lectura usan voces de Windows o del navegador. Su disponibilidad y comportamiento varían por máquina.
- **No se afirma compilación nativa local:** el frontend de producción y E2E se ejecutan aquí; los NSIS/MSI requieren Windows, Rust y WebView2. El workflow usa `windows-latest` y Node 22.

## Fuentes primarias y de producto

Consultadas durante el análisis comparativo:

1. [Balabolka — ficha de funciones](https://sourceforge.net/software/product/Balabolka/).
2. [NaturalReader — producto](https://www.naturalreaders.com/).
3. [Obsidian — plugins principales](https://obsidian.md/help/plugins).
4. [Obsidian — marcadores](https://obsidian.md/help/plugins/bookmarks).
5. [Typora — Focus y Typewriter Mode](https://support.typora.io/Focus-and-Typewriter-Mode/).
6. [Typora — producto y esquema](https://typora.io/).
7. [PDF.js — preguntas frecuentes y atajos](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions/81a843c3b413bc61d02519b145a5c78f4f43f0cd).
8. [XMind — guía de usuario](https://xmind.com/user-guide/intro-new).
9. [XMind — ficha y accesibilidad](https://apps.apple.com/us/app/xmind-ai-mind-map-brainstorm/id1286983622).

Estas fuentes sirven para comparar flujos y funciones; no se incorporó código propietario ni contenido visual de terceros.

## Reproducir verificación de navegador

Con la build de producción servida en `http://127.0.0.1:1420`:

```bash
# Dependencia solo para QA; no forma parte del bundle ni del runtime de OpenHub.
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node verify-improvements.mjs
node verify-usability.mjs
node verify-updater.mjs
node verify-pomodoro.mjs
node verify-navigation.mjs
```

El primer script crea un PDF real de dos páginas, lo carga mediante el input de archivos y verifica las funciones generales. El segundo comprueba selección TTS, edición durante reproducción, Pomodoro y barra superior; solo dentro de ese navegador de QA sustituye Web Speech por un doble que permite inspeccionar el texto enviado. El tercero valida el diálogo y el IPC del actualizador mediante otro doble aislado, sin instalar software. El cuarto comprueba que los controles Pomodoro reciben clics en las tres herramientas y recorre vencimientos breves reales; sustituye `AudioContext` únicamente en QA para registrar las notas programadas, no para simular los cambios de sesión. El quinto crea/recupera borradores, abre archivos desde Recientes y comprueba pantalla completa web y los comandos IPC nativos. Los cinco imprimen `errors: []`; las capturas auténticas se guardan en `docs/screenshots/mejoras/`. En Linux se pueden instalar las bibliotecas de Chromium con `npx playwright install-deps chromium`.

No se utilizan mockups, imágenes generadas por IA ni datos pintados para simular resultados.
