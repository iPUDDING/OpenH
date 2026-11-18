# Rendimiento de OpenHub 1.4.1

## Cambios aplicados

- **Inicio más liviano:** `MarkdownRenderer` pasa a `React.lazy`; `react-markdown`, remark/rehype y KaTeX se descargan/ejecutan cuando se muestra la vista previa. El CSS de KaTeX se importa junto al módulo diferido. Los recursos siguen empacados localmente, sin CDN ni conexión de red.
- **Menos trabajo al escribir Markdown:** las listas de plugins remark/rehype son constantes y no cambian de identidad en cada render.
- **Scroll sin renders del visor:** la barra de progreso modifica `transform` y `aria-valuenow` directamente en el evento pasivo; no se llama a `setState` por cada movimiento. La posición de reanudación se lee del store solo al cambiar de documento, sin suscribir el componente al mapa completo de posiciones. La persistencia sigue debounced.
- **Búsqueda global más barata:** con la paleta cerrada no normaliza los documentos recientes. Al abrirla crea una sola representación normalizada por conjunto de recientes y reutiliza esa cadena para las consultas; `useDeferredValue` mantiene prioritaria la escritura.
- **TTS más inmediato:** el contador de palabras restantes se actualiza en el mismo ciclo en que empieza la frase siguiente, sin esperar al efecto de calibración.

## Bundle medido

Comparación de `npm run build` antes/después sobre el mismo árbol de código 1.4.0, con Vite y compresión gzip reportada por Vite. Los tamaños son de los chunks iniciales de la aplicación; los módulos pesados de herramientas ya diferidas no se suman.

| Recurso inicial | Antes | 1.4.1 | Reducción aproximada |
|---|---:|---:|---:|
| Chunk principal JS | 766,36 KB / 235,89 KB gzip | 265,68 KB / 85,34 KB gzip | 65% sin comprimir; 64% gzip |
| CSS inicial | 73,35 KB / 17,44 KB gzip | 43,26 KB / 9,21 KB gzip | 41% sin comprimir; 47% gzip |
| JS+CSS inicial aproximado, sumando chunks comunes | 1.045 KB / 324 KB gzip | 544 KB / 174 KB gzip | 48% sin comprimir; 46% gzip |

El trabajo diferido se conserva completo: el chunk `MarkdownRenderer` es 500,51 KB (151,05 KB gzip) y su CSS de KaTeX 30,20 KB (8,08 KB gzip). Se carga cuando hay una vista previa Markdown, no al arrancar sin documento. Si OpenHub restaura un documento Markdown al iniciar, ese módulo se solicitará en ese momento.

## Regresión y seguridad

- `npm run typecheck`: 0 errores.
- `npm test`: 72/72 tests.
- `npm run build`: 2.430 módulos transformados.
- Seis suites E2E: 77 comprobaciones, `errors: []`. Se agregó comprobación de búsqueda de texto reciente y se hizo esperar explícitamente al commit React en la aserción del contador TTS (el doble de voz registra la siguiente frase antes de que React pinte el contador).
- `npm audit --omit=dev`: 0 vulnerabilidades en dependencias de producción.

Las cifras son tamaños de bundle, no un benchmark de tiempo de CPU en un PC Windows. La compilación nativa/arranque de WebView2 debe medirse también en el equipo Windows de destino.
