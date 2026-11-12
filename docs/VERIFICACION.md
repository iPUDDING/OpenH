# Informe de verificación — OpenHub 1.0.0

**Fecha:** 11 de noviembre de 2026.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Correcto, sin errores TypeScript. |
| `npm test` | 4 archivos; **15/15 pruebas** superadas. |
| `npm run build` | Build Vite de producción correcto; 2405 módulos transformados. |
| `npm audit --omit=dev --audit-level=low` | **0 vulnerabilidades** en dependencias de producción. |
| `node verify-improvements.mjs` | Seis comprobaciones funcionales superadas; **`errors: []`**. |

## E2E auténtico de navegador

El script utiliza el frontend de producción servido en el puerto 1420 y Chromium mediante Playwright. No modifica la interfaz para simular funciones.

1. Abre `Ctrl+K`, busca “mapas” y ejecuta el comando.
2. Comprueba un índice Markdown de cuatro encabezados.
3. Busca “Implementación” en Markmap y comprueba el nodo activo.
4. Crea una regla “Kubernetes” → “ku ber ne tes” y verifica su persistencia.
5. Descarga una copia JSON y comprueba aplicación `OpenHub`, versión `1`, fecha ISO y regla incluida.
6. Genera y abre un PDF real de dos páginas con texto seleccionable; busca “Segunda”, comprueba los registros `openhub-search` y `openhub-search-current`, y verifica el salto automático a página 2.

Capturas finales: `docs/screenshots/mejoras/07-…` hasta `11-…`.

## Alcance y límites

- El entorno de desarrollo actual no incluye Rust/Cargo ni WebView2; por ello no se afirma una compilación nativa local ni una ejecución real del instalador Windows.
- La configuración Tauri v2, iconos, permisos y `.github/workflows/build.yml` están incluidos. El workflow de `windows-latest` con Node 22 debe producir NSIS/MSI al ejecutarse en GitHub.
- WebView2 utiliza este mismo frontend de producción. Los diálogos nativos, impresión, rutas de archivos y voces dependen de Windows y del equipo.
- Playwright se instaló únicamente para QA con `--no-save`; no se incluye en el bundle ni es un requisito de ejecución.
