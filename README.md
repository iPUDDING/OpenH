# OpenHub (DevSuite Hub)

Aplicación de escritorio **Windows 10/11, 100% offline**, que integra un visor Markdown/PDF, un estudio de texto a voz y mapas mentales interactivos. Construida con **Tauri v2, Rust, React 18, TypeScript, Tailwind CSS, Radix UI y Zustand**.

## Funcionalidades

- **Documentos:** Markdown, TXT y PDF; diálogo nativo, drag & drop, historial, editor dividido, GFM, código y KaTeX.
- **PDF local:** PDF.js y worker empaquetados; zoom, ajuste, páginas, búsqueda global y capa de texto seleccionable.
- **Voz:** Web Speech API / voces SAPI disponibles en WebView2; velocidad, tono, volumen, selección, párrafos, progreso, resaltado y auto-scroll.
- **Mapas:** CodeMirror 6 + Markmap, zoom, pan, colapso, modo foco, plantillas y exportación MD/SVG/HTML/PNG/PDF mediante impresión.
- **Pomodoro compartido:** trabajo/descanso configurables, pausa, salto, reinicio y estadísticas de la ejecución.
- **Productividad:** paleta `Ctrl+K`, índice Markdown navegable, búsqueda PDF con atajos y búsqueda/centrado de temas Markmap.
- **Lectura accesible:** tamaño, interlineado y ancho configurables; pronunciación TTS personalizada sin alterar el texto ni perder su resaltado.
- **Respaldo local:** exportación/restauración JSON versionada y validada de preferencias, pronunciaciones y recientes.
- **Privacidad:** sin cuentas, analítica, CDN ni servicios remotos. El estado se conserva en `localStorage` de WebView2.

El análisis comparativo, las decisiones de diseño, las fuentes y la matriz de verificación están en [Investigación y mejoras](docs/INVESTIGACION-Y-MEJORAS.md).

## Capturas reales

Las siguientes imágenes son capturas directas del **build de producción ejecutado en Chromium**, no mockups ni imágenes generadas por IA. El mismo frontend se empaqueta dentro de WebView2 en Windows.

![Vista general de OpenHub](docs/screenshots/00-vista-general.png)

Capturas individuales a 1440 × 900 px: [Inicio](docs/screenshots/01-inicio.png) · [Visor Markdown](docs/screenshots/02-visor-markdown.png) · [Estudio TTS](docs/screenshots/03-estudio-tts.png) · [Mapas mentales](docs/screenshots/04-mapas-mentales.png) · [Ajustes](docs/screenshots/05-ajustes.png) · [Modo oscuro](docs/screenshots/06-mapa-modo-oscuro.png).

**Nuevas mejoras verificadas:** [Paleta de comandos](docs/screenshots/mejoras/07-paleta-comandos.png) · [Índice de lectura](docs/screenshots/mejoras/08-indice-lectura.png) · [Búsqueda PDF en página 2](docs/screenshots/mejoras/09-busqueda-pdf.png) · [Búsqueda Markmap](docs/screenshots/mejoras/10-busqueda-markmap.png) · [Pronunciación y accesibilidad](docs/screenshots/mejoras/11-pronunciacion-ajustes.png).

## Requisitos

- Windows 10/11 para la aplicación nativa.
- Node.js 22.12 o superior (Node 22 LTS).
- Rust estable (`rustup`) y [requisitos de Tauri v2](https://v2.tauri.app/start/prerequisites/).
- Microsoft WebView2 (normalmente ya incluido en Windows 11).

## Desarrollo

```powershell
npm ci
npm run dev             # Solo frontend: http://localhost:1420
npm run tauri dev       # Escritorio + hot reload
```

El modo navegador incluye fallback para abrir y descargar archivos. Las rutas nativas, imágenes `asset://` y algunas voces dependen de Tauri/WebView2.

## Verificación y build

```powershell
npm run typecheck
npm test
npm run build
npm run tauri build
# Auditoría opcional de dependencias de producción
npm audit --omit=dev --audit-level=low
```

La verificación E2E opcional y reproducible de las nuevas funciones está documentada en [Investigación y mejoras](docs/INVESTIGACION-Y-MEJORAS.md#reproducir-verificación-de-navegador). Playwright es únicamente una herramienta de QA, no una dependencia del runtime.

Instaladores generados:

```text
src-tauri/target/release/bundle/nsis/OpenHub_1.0.0_x64-setup.exe
src-tauri/target/release/bundle/msi/OpenHub_1.0.0_x64_en-US.msi
```

> Los nombres pueden variar según la arquitectura y el idioma del bundle.

## Compilar en GitHub

1. Crea un repositorio y sube todo el contenido de esta carpeta:

   ```powershell
   git init
   git add .
   git commit -m "OpenHub 1.0.0"
   git branch -M main
   git remote add origin https://github.com/USUARIO/REPOSITORIO.git
   git push -u origin main
   ```

2. Abre la pestaña **Actions**. El workflow `Build OpenHub para Windows` se ejecuta en cada push a `main` y también manualmente mediante **Run workflow**.
3. Al terminar, descarga el artefacto **`openhub-windows`**; contiene los instaladores `.exe` y `.msi`.

## Estructura

```text
src/
├── components/
│   ├── layout/       # Shell, navegación, ajustes y ErrorBoundary
│   ├── tools/        # Visor, TTS, Markmap y Pomodoro
│   └── ui/           # Controles accesibles estilo Shadcn/Radix
├── hooks/            # TTS, filesystem, Markmap y Pomodoro
├── services/         # Wrappers Tauri/Web Speech
├── store/            # Zustand + persist
├── lib/              # Mapeo DOM, texto y exportación
├── App.tsx           # Lazy loading y conservación de vistas
└── main.tsx
src-tauri/            # Rust, permisos, assets y bundle
.github/workflows/    # Build Windows y artefactos
```

## Notas técnicas

- El visor se carga al inicio. TTS, Markmap, Ajustes y PDF.js se dividen en chunks; las vistas ya visitadas no se desmontan.
- El resaltado usa **CSS Custom Highlight API**. El fallback dibuja elementos `<mark>` superpuestos, sin modificar los nodos de texto ni romper los offsets TTS.
- Las imágenes Markdown relativas se resuelven respecto al archivo mediante `convertFileSrc`.
- El HTML exportado de Markmap incluye el SVG y controles propios de zoom/pan; no necesita internet.
- Para exportar PDF se abre la impresión del sistema: elige **Microsoft Print to PDF**.
- Las voces disponibles dependen de las voces instaladas en Windows. Algunas voces no emiten eventos `boundary`; OpenHub incluye una estimación de progreso para esos casos.

## Licencia

Proyecto privado (`"private": true`). Todos los derechos reservados salvo que el propietario indique lo contrario.
