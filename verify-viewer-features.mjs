import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = new URL('./docs/screenshots/mejoras/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const errors = [];
const checks = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
};

const page = await context.newPage();
watch(page);
await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });

// 1. Zoom en Markdown (rueda normal vs Ctrl+rueda, botones, Ctrl+0 y editor dividido)
const longParagraphs = Array.from({ length: 18 }, (_, i) => `Párrafo ${i + 1}: contenido extenso para comprobar el desplazamiento vertical normal y el zoom proporcional en Markdown.`).join('\n\n');
await page.getByLabel('Markdown inicial').fill(`# Documento de prueba\n\nFórmula $E = mc^2$ y \`código\`.\n\n${longParagraphs}`);
await page.getByRole('button', { name: 'Abrir borrador' }).click();
await page.locator('.markdown-body h1').waitFor();

const previewBox = await page.locator('.markdown-body').boundingBox();
assert.ok(previewBox);
await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + 120);
await page.mouse.wheel(0, 240);
await page.waitForTimeout(150);
const scrollAfterPlainWheel = await page.locator('.markdown-body').evaluate((el) => el.parentElement.scrollTop);
assert.ok(scrollAfterPlainWheel > 0);
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '100%');
checks.push('La rueda sin Ctrl mantiene el desplazamiento vertical normal en Markdown');

await page.keyboard.down('Control');
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.keyboard.up('Control');
await page.waitForTimeout(150);
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '140%');
const overflowState = await page.locator('.markdown-body').evaluate((el) => ({
  zoom: Number(getComputedStyle(el).zoom),
  articleRight: el.getBoundingClientRect().right,
  scrollerRight: el.parentElement.getBoundingClientRect().right,
}));
assert.equal(overflowState.zoom, 1.4);
assert.ok(overflowState.articleRight <= overflowState.scrollerRight + 2, 'El artículo ampliado no debe desbordar horizontalmente el contenedor');
await page.screenshot({ path: `${output}18-zoom-markdown.png`, animations: 'disabled' });
checks.push('Ctrl + rueda acerca Markdown hasta 140% sin desbordar la columna');

await page.keyboard.down('Control');
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.keyboard.up('Control');
await page.waitForTimeout(150);
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '90%');
checks.push('Ctrl + rueda aleja Markdown por debajo del 100%');

await page.getByRole('button', { name: 'Acercar documento', exact: true }).click();
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '100%');
await page.getByRole('button', { name: 'Acercar documento', exact: true }).click();
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '110%');
await page.keyboard.press('Control+0');
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '100%');
checks.push('Botones + / − y Ctrl+0 controlan y restablecen el zoom Markdown');

await page.getByRole('button', { name: 'Vista dividida', exact: true }).click();
const editorBox = await page.getByLabel('Editor Markdown', { exact: true }).boundingBox();
const initialEditorFont = await page.getByLabel('Editor Markdown', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + 120);
await page.keyboard.down('Control');
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.keyboard.up('Control');
await page.waitForTimeout(150);
const zoomedEditorFont = await page.getByLabel('Editor Markdown', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '120%');
assert.ok(zoomedEditorFont > initialEditorFont);
await page.getByRole('button', { name: 'Restablecer zoom' }).click();
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom' }).textContent(), '100%');
await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
checks.push('En vista dividida Ctrl + rueda escala también el editor Markdown');

// 2. Zoom con Ctrl + rueda en PDF
const pdfPage = await context.newPage();
await pdfPage.setContent('<html><body style="font-family:Arial;padding:48px"><h1>PDF de prueba</h1><p>Zoom con rueda y Ctrl+0 en PDF.</p></body></html>');
await pdfPage.pdf({ path: '/tmp/openhub-zoom.pdf', format: 'A4', printBackground: true });
await pdfPage.close();

const pdfChooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Abrir', exact: true }).click();
const pdfChooser = await pdfChooserPromise;
await pdfChooser.setFiles('/tmp/openhub-zoom.pdf');
await page.locator('canvas').waitFor({ timeout: 20000 });
await page.waitForTimeout(400);
const initialPdfZoom = parseInt((await page.getByRole('button', { name: 'Restablecer zoom del PDF' }).textContent()) ?? '0', 10);
const canvasBox = await page.locator('canvas').boundingBox();
await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + 120);
await page.keyboard.down('Control');
await page.mouse.wheel(0, -120);
await page.mouse.wheel(0, -120);
await page.keyboard.up('Control');
await page.waitForTimeout(400);
const zoomedInPdf = parseInt((await page.getByRole('button', { name: 'Restablecer zoom del PDF' }).textContent()) ?? '0', 10);
assert.ok(zoomedInPdf > initialPdfZoom);
await page.keyboard.down('Control');
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.mouse.wheel(0, 120);
await page.keyboard.up('Control');
await page.waitForTimeout(400);
const zoomedOutPdf = parseInt((await page.getByRole('button', { name: 'Restablecer zoom del PDF' }).textContent()) ?? '0', 10);
assert.ok(zoomedOutPdf < zoomedInPdf);
await page.keyboard.press('Control+0');
await page.waitForTimeout(300);
assert.equal(await page.getByRole('button', { name: 'Restablecer zoom del PDF' }).textContent(), '100%');
checks.push('PDF admite Ctrl + rueda para acercar/alejar y Ctrl+0 para 100%');

// 3. Renombrar borradores en barra superior y menú lateral sin colisiones
await page.getByRole('button', { name: 'Crear texto nuevo', exact: true }).click();
await page.getByRole('heading', { name: 'Texto 1.md', exact: true }).waitFor();
await page.getByLabel('Editor Markdown', { exact: true }).fill('# Primer apunte');
await page.waitForTimeout(750);

await page.getByRole('button', { name: 'Crear texto nuevo', exact: true }).click();
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).waitFor();
await page.getByLabel('Editor Markdown', { exact: true }).fill('# Segundo apunte');
await page.waitForTimeout(750);

// Escape cancela sin cambiar
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).click();
await page.getByLabel('Nombre del documento', { exact: true }).fill('Cancelado.md');
await page.keyboard.press('Escape');
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).waitFor();

// Clic sobre el nombre en la barra superior -> renombrar y Enter
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).click();
await page.getByLabel('Nombre del documento', { exact: true }).fill('Apuntes de clase.md');
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'Apuntes de clase.md', exact: true }).waitFor();
await page.getByRole('button', { name: /^Apuntes de clase\.md/ }).waitFor();
checks.push('Hacer clic en el nombre de la barra superior permite renombrar y Escape cancela');

// Crear otro texto -> reutiliza Texto 2.md sin colisionar con Apuntes de clase.md
await page.getByRole('button', { name: 'Crear texto nuevo', exact: true }).click();
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).waitFor();

// Renombrar desde el menú lateral un documento distinto sin cambiar el abierto
await page.getByRole('button', { name: 'Renombrar Texto 1.md', exact: true }).click();
await page.getByLabel('Nuevo nombre para Texto 1.md', { exact: true }).fill('Guía rápida.md');
await page.keyboard.press('Enter');
await page.getByRole('button', { name: /^Guía rápida\.md/ }).waitFor();
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).waitFor();
checks.push('Renombrar desde el menú lateral actualiza Recientes sin interrumpir el documento activo');

// Doble clic en el menú lateral sobre el documento activo actualiza la barra superior
await page.getByRole('button', { name: /^Texto 2\.md/ }).dblclick();
await page.getByLabel('Nuevo nombre para Texto 2.md', { exact: true }).fill('Resumen activo.md');
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'Resumen activo.md', exact: true }).waitFor();
checks.push('Renombrar el documento activo desde el menú lateral sincroniza la barra superior');

// 4. Archivo con ruta real en Windows (estilo captura del usuario): cambia solo el nombre visible en OpenHub
const tauriPage = await context.newPage();
watch(tauriPage);
const diskPath = 'C:\\Users\\srmax\\Downloads\\RESUMEN SEGUNDO PARCIAL VERSIÓN AUDIOS TERAPEUTICAS KINÉSICAS.md';
const diskBytes = Array.from(Buffer.from('# Resumen Segundo Parcial\n\nContenido terapéutico kinésico en disco local.\n\n## Unidad 1\n\nTexto de estudio.', 'utf8'));
await tauriPage.addInitScript(({ filePath, bytes }) => {
  let callbackId = 0;
  window.__tauriCommands = [];
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    transformCallback: () => ++callbackId,
    unregisterCallback: () => undefined,
    invoke: async (command) => {
      window.__tauriCommands.push(command);
      if (command === 'plugin:app|version') return '1.1.0';
      if (command === 'plugin:event|listen') return 1;
      if (command === 'plugin:updater|check') return null;
      if (command === 'plugin:dialog|open') return filePath;
      if (command === 'plugin:fs|read_file') return bytes;
      return null;
    },
  };
}, { filePath: diskPath, bytes: diskBytes });

await tauriPage.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await tauriPage.getByRole('button', { name: 'Abrir', exact: true }).click();
await tauriPage.getByRole('heading', { name: 'RESUMEN SEGUNDO PARCIAL VERSIÓN AUDIOS TERAPEUTICAS KINÉSICAS.md', exact: true }).waitFor();

await tauriPage.getByRole('heading', { name: 'RESUMEN SEGUNDO PARCIAL VERSIÓN AUDIOS TERAPEUTICAS KINÉSICAS.md', exact: true }).click();
await tauriPage.getByLabel('Nombre del documento', { exact: true }).fill('Resumen Kinésica · 2º Parcial');
await tauriPage.keyboard.press('Enter');

await tauriPage.getByRole('heading', { name: 'Resumen Kinésica · 2º Parcial', exact: true }).waitFor();
await tauriPage.getByText(diskPath, { exact: true }).waitFor();
await tauriPage.getByRole('button', { name: /^Resumen Kinésica · 2º Parcial/ }).waitFor();
await tauriPage.screenshot({ path: `${output}19-renombrar-documento.png`, animations: 'disabled' });

assert.equal(await tauriPage.evaluate(() => window.__tauriCommands.some((cmd) => cmd.includes('rename'))), false);
await tauriPage.getByRole('button', { name: 'Crear texto nuevo', exact: true }).click();
await tauriPage.getByRole('heading', { name: 'Texto 1.md', exact: true }).waitFor();
await tauriPage.getByRole('button', { name: /^Resumen Kinésica · 2º Parcial/ }).click();
await tauriPage.getByRole('heading', { name: 'Resumen Kinésica · 2º Parcial', exact: true }).waitFor();
await tauriPage.getByText('Contenido terapéutico kinésico en disco local.', { exact: true }).waitFor();
await tauriPage.reload({ waitUntil: 'networkidle' });
await tauriPage.getByRole('heading', { name: 'Resumen Kinésica · 2º Parcial', exact: true }).waitFor();
await tauriPage.getByText(diskPath, { exact: true }).waitFor();
checks.push('Renombrar un archivo del disco cambia solo su nombre visible en OpenHub, conserva la ruta real y persiste al reabrir/recargar');

// 5. Subrayado TTS de títulos/subtítulos/enlaces y atajo Espacio para detener/reanudar lectura
const ttsContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const ttsPage = await ttsContext.newPage();
watch(ttsPage);
await ttsPage.addInitScript(() => {
  window.__spoken = [];
  window.__utterances = [];
  window.__ttsPausedCalls = 0;
  window.__ttsResumedCalls = 0;
  window.__ttsCanceledCalls = 0;
  class FakeUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = 'es-ES'; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ name: 'Voz QA local', lang: 'es-ES', voiceURI: 'qa-local' }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speak: (utterance) => { window.__spoken.push(utterance.text); window.__utterances.push(utterance); },
      pause: () => { window.__ttsPausedCalls += 1; },
      resume: () => { window.__ttsResumedCalls += 1; },
      cancel: () => { window.__ttsCanceledCalls += 1; },
    },
  });
});

await ttsPage.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await ttsPage.getByLabel('Markdown inicial').fill(
  '# Título principal\n\n## Subtítulo de sección\n\n### Subtítulo con [enlace](https://example.com) y **negrita**\n\nPárrafo normal de verificación para probar Espacio y subrayado.'
);
await ttsPage.getByRole('button', { name: 'Abrir borrador' }).click();
await ttsPage.locator('.markdown-body h1').waitFor();

// Tiempo restante en reposo: muestra la duración total estimada en mm:ss
const viewerTime = ttsPage.locator('span[title^="Tiempo estimado"]');
await viewerTime.waitFor();
assert.match((await viewerTime.textContent()) ?? '', /en total/);
assert.match((await viewerTime.textContent()) ?? '', /\d{2}:\d{2}/);

await ttsPage.getByRole('button', { name: 'Leer', exact: true }).click();
await ttsPage.waitForFunction(() => window.__spoken.length === 1);
assert.equal(await ttsPage.evaluate(() => window.__spoken[0]), 'Título principal');
assert.match((await viewerTime.textContent()) ?? '', /Quedan \d{2}:\d{2}/);
const h1Highlight = await ttsPage.evaluate(() => {
  const word = Array.from(window.CSS.highlights.get('openhub-word') ?? [])[0];
  const phrase = Array.from(window.CSS.highlights.get('openhub-phrase') ?? [])[0];
  return {
    wordConnected: Boolean(word?.startContainer?.isConnected),
    wordInsideH1: Boolean(word?.startContainer?.parentElement?.closest('h1')),
    wordText: word?.toString() ?? '',
    phraseConnected: Boolean(phrase?.startContainer?.isConnected),
    phraseInsideH1: Boolean(phrase?.startContainer?.parentElement?.closest('h1')),
  };
});
assert.equal(h1Highlight.wordConnected, true);
assert.equal(h1Highlight.wordInsideH1, true);
assert.equal(h1Highlight.wordText, 'Título');
assert.equal(h1Highlight.phraseConnected, true);
assert.equal(h1Highlight.phraseInsideH1, true);
await ttsPage.screenshot({ path: `${output}20-subrayado-titulos.png`, animations: 'disabled' });

// Avanzar al subtítulo h2
await ttsPage.evaluate(() => window.__utterances.at(-1).onend());
await ttsPage.waitForFunction(() => window.__spoken.length === 2);
assert.equal(await ttsPage.evaluate(() => window.__spoken[1]), 'Subtítulo de sección');
const h2Highlight = await ttsPage.evaluate(() => {
  const word = Array.from(window.CSS.highlights.get('openhub-word') ?? [])[0];
  return {
    connected: Boolean(word?.startContainer?.isConnected),
    insideH2: Boolean(word?.startContainer?.parentElement?.closest('h2')),
    wordText: word?.toString() ?? '',
  };
});
assert.equal(h2Highlight.connected, true);
assert.equal(h2Highlight.insideH2, true);
assert.equal(h2Highlight.wordText, 'Subtítulo');

// Avanzar al subtítulo h3 con enlace y negrita y comprobar boundary en "negrita"
await ttsPage.evaluate(() => window.__utterances.at(-1).onend());
await ttsPage.waitForFunction(() => window.__spoken.length === 3);
await ttsPage.evaluate(() => {
  const u = window.__utterances.at(-1);
  u.onboundary({ name: 'word', charIndex: u.text.indexOf('negrita') });
});
await ttsPage.waitForFunction(() => Array.from(window.CSS.highlights.get('openhub-word') ?? [])[0]?.toString() === 'negrita');
const h3Highlight = await ttsPage.evaluate(() => {
  const word = Array.from(window.CSS.highlights.get('openhub-word') ?? [])[0];
  return {
    connected: Boolean(word?.startContainer?.isConnected),
    insideH3: Boolean(word?.startContainer?.parentElement?.closest('h3')),
    wordText: word?.toString() ?? '',
  };
});
assert.equal(h3Highlight.connected, true);
assert.equal(h3Highlight.insideH3, true);
assert.equal(h3Highlight.wordText, 'negrita');
checks.push('El subrayado TTS funciona en títulos (h1), subtítulos (h2/h3) y nodos con formato o enlaces');

// Espacio detiene/pausa la lectura aunque el botón Pausar tenga el foco, y la reanuda al volver a pulsarlo
await ttsPage.keyboard.press('Space');
await ttsPage.getByRole('button', { name: 'Reanudar', exact: true }).waitFor();
assert.equal(await ttsPage.evaluate(() => window.__ttsPausedCalls), 1);
await ttsPage.keyboard.press('Space');
await ttsPage.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
assert.equal(await ttsPage.evaluate(() => window.__ttsResumedCalls), 1);

// Espacio también pausa cuando el foco está en el cuerpo del documento
await ttsPage.locator('.markdown-body p').first().click();
await ttsPage.keyboard.press('Space');
await ttsPage.getByRole('button', { name: 'Reanudar', exact: true }).waitFor();
assert.equal(await ttsPage.evaluate(() => window.__ttsPausedCalls), 2);

// Espacio sigue escribiendo espacios normales en el editor Markdown
await ttsPage.getByRole('button', { name: 'Vista dividida', exact: true }).click();
await ttsPage.getByLabel('Editor Markdown', { exact: true }).focus();
await ttsPage.keyboard.press('Space');
assert.equal(await ttsPage.evaluate(() => window.__ttsResumedCalls), 1);
await ttsPage.getByRole('button', { name: 'Detener lectura', exact: true }).click();
checks.push('Espacio pausa/detiene y reanuda la lectura en el visor sin interferir al escribir en el editor');

// En Estudio TTS, hacer clic en un párrafo y pulsar Espacio pausa en lugar de reiniciar el párrafo
await ttsPage.keyboard.press('Alt+2');
await ttsPage.getByRole('button', { name: 'Leer párrafo 1', exact: true }).click();
await ttsPage.waitForFunction(() => window.__spoken.length === 4);
const pausesBeforeStudioSpace = await ttsPage.evaluate(() => window.__ttsPausedCalls);
await ttsPage.keyboard.press('Space');
await ttsPage.getByRole('button', { name: 'Reanudar', exact: true }).waitFor();
assert.equal(await ttsPage.evaluate(() => window.__ttsPausedCalls), pausesBeforeStudioSpace + 1);
assert.equal(await ttsPage.evaluate(() => window.__spoken.length), 4);
checks.push('En Estudio TTS, Espacio pausa y reanuda incluso tras pulsar un párrafo');

// Tiempo restante en Estudio TTS: la cuenta regresiva baja al avanzar de párrafo
await ttsPage.getByRole('button', { name: 'Reanudar', exact: true }).click();
await ttsPage.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
const studioTime = ttsPage.locator('section[aria-label="Estudio de texto a voz"] span[title^="Tiempo estimado"]');
const studioBefore = (await studioTime.textContent()) ?? '';
assert.match(studioBefore, /Quedan \d{2}:\d{2} de \d{2}:\d{2}/);
const studioWordsBefore = Number(studioBefore.match(/(\d+)\/(\d+) palabras/)?.[1] ?? '0');
await ttsPage.evaluate(() => window.__utterances.at(-1).onend());
await ttsPage.waitForFunction(() => window.__spoken.length === 5);
const studioAfter = (await studioTime.textContent()) ?? '';
assert.match(studioAfter, /Quedan \d{2}:\d{2} de \d{2}:\d{2}/);
const studioWordsAfter = Number(studioAfter.match(/(\d+)\/(\d+) palabras/)?.[1] ?? '0');
assert.ok(studioWordsAfter < studioWordsBefore, `Las palabras restantes deben bajar (${studioWordsBefore} → ${studioWordsAfter})`);
checks.push('El tiempo restante muestra la duración total en reposo y la cuenta regresiva mm:ss baja al avanzar de párrafo');

// 6. Fórmulas LaTeX: la voz lee español natural (sin código fuente) y el subrayado sigue conectado
const mathContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const mathPage = await mathContext.newPage();
watch(mathPage);
await mathPage.addInitScript(() => {
  window.__spoken = [];
  window.__utterances = [];
  window.__ttsPausedCalls = 0;
  window.__ttsResumedCalls = 0;
  window.__ttsCanceledCalls = 0;
  class FakeUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = 'es-ES'; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ name: 'Voz QA local', lang: 'es-ES', voiceURI: 'qa-local' }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speak: (utterance) => { window.__spoken.push(utterance.text); window.__utterances.push(utterance); },
      pause: () => { window.__ttsPausedCalls += 1; },
      resume: () => { window.__ttsResumedCalls += 1; },
      cancel: () => { window.__ttsCanceledCalls += 1; },
    },
  });
});

await mathPage.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await mathPage.getByLabel('Markdown inicial').fill(
  '# Fórmulas\n\nEl rendimiento es $\\ge 90\\,\\%$ y $\\frac{1}{2}$ más $x^2$.\n\nPárrafo normal de cierre.'
);
await mathPage.getByRole('button', { name: 'Abrir borrador' }).click();
await mathPage.locator('.markdown-body h1').waitFor();
await mathPage.locator('.katex').first().waitFor();
await mathPage.getByRole('button', { name: 'Leer', exact: true }).click();
await mathPage.waitForFunction(() => window.__spoken.length === 1);
assert.equal(await mathPage.evaluate(() => window.__spoken[0]), 'Fórmulas');
await mathPage.evaluate(() => window.__utterances.at(-1).onend());
await mathPage.waitForFunction(() => window.__spoken.length === 2);
const mathSpoken = await mathPage.evaluate(() => window.__spoken[1]);
assert.match(mathSpoken, /mayor o igual que 90 por ciento/);
assert.match(mathSpoken, /fracción 1 sobre 2/);
assert.match(mathSpoken, /al cuadrado/);
assert.equal(mathSpoken.includes('\\'), false);
assert.equal(mathSpoken.includes('$'), false);
const mathHighlight = await mathPage.evaluate(() => {
  const word = Array.from(window.CSS.highlights.get('openhub-word') ?? [])[0];
  return { connected: Boolean(word?.startContainer?.isConnected), text: word?.toString() ?? '' };
});
assert.equal(mathHighlight.connected, true);
await mathPage.screenshot({ path: `${output}21-formulas-tts.png`, animations: 'disabled' });
checks.push('Las fórmulas LaTeX se leen en español natural sin código fuente y el subrayado permanece conectado');
await mathContext.close();

// 7. Guiones: la voz no se salta `-`, `–` ni `—` (pausas, rangos y compuestos)
const dashContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const dashPage = await dashContext.newPage();
watch(dashPage);
await dashPage.addInitScript(() => {
  window.__spoken = [];
  window.__utterances = [];
  window.__ttsPausedCalls = 0;
  window.__ttsResumedCalls = 0;
  window.__ttsCanceledCalls = 0;
  class FakeUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = 'es-ES'; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ name: 'Voz QA local', lang: 'es-ES', voiceURI: 'qa-local' }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speak: (utterance) => { window.__spoken.push(utterance.text); window.__utterances.push(utterance); },
      pause: () => { window.__ttsPausedCalls += 1; },
      resume: () => { window.__ttsResumedCalls += 1; },
      cancel: () => { window.__ttsCanceledCalls += 1; },
    },
  });
});

await dashPage.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await dashPage.getByLabel('Markdown inicial').fill(
  '# Guiones\n\nLa técnica —que es nueva— funciona en el rango 10-15 y es teórico-práctico.\n\nPárrafo normal de cierre.'
);
await dashPage.getByRole('button', { name: 'Abrir borrador' }).click();
await dashPage.locator('.markdown-body h1').waitFor();
await dashPage.getByRole('button', { name: 'Leer', exact: true }).click();
await dashPage.waitForFunction(() => window.__spoken.length === 1);
assert.equal(await dashPage.evaluate(() => window.__spoken[0]), 'Guiones');
await dashPage.evaluate(() => window.__utterances.at(-1).onend());
await dashPage.waitForFunction(() => window.__spoken.length === 2);
const dashSpoken = await dashPage.evaluate(() => window.__spoken[1]);
assert.match(dashSpoken, /técnica, que es nueva, funciona/);
assert.match(dashSpoken, /10 a 15/);
assert.match(dashSpoken, /teórico práctico/);
assert.equal(dashSpoken.includes('—'), false);
assert.equal(dashSpoken.includes('–'), false);
assert.equal(dashSpoken.includes('-'), false);
const dashHighlight = await dashPage.evaluate(() => {
  const word = Array.from(window.CSS.highlights.get('openhub-word') ?? [])[0];
  return { connected: Boolean(word?.startContainer?.isConnected), text: word?.toString() ?? '' };
});
assert.equal(dashHighlight.connected, true);
await dashPage.screenshot({ path: `${output}22-guiones-tts.png`, animations: 'disabled' });
checks.push('Los guiones (`-`, `–`, `—`) se leen como pausa, rango o compuesto sin saltarse y el subrayado permanece conectado');
await dashContext.close();

// DOCX, PPTX y XLSX reales: apertura por input, render, TTS, zoom e índice.
const officeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const officePage = await officeContext.newPage();
watch(officePage);
await officePage.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await officePage.evaluate(() => {
  window.__spoken = [];
  window.__utterances = [];
  class MockUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = 'es-ES'; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ name: 'Voz QA local', lang: 'es-ES', voiceURI: 'qa-local' }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speak(utterance) {
        window.__utterances.push(utterance);
        window.__spoken.push(utterance.text);
        utterance.onend?.();
      },
      pause() {},
      resume() {},
      cancel() {},
    },
  });
});
// El input de archivo se crea al vuelo (fuera del DOM): lo capturamos y le
// asignamos el archivo directamente, sin abrir el picker nativo. Los
// fixtures se leen en Node y llegan en base64 (el preview solo sirve dist/).
const officeFixtures = {
  docx: (await readFile('tests/fixtures/muestra.docx')).toString('base64'),
  pptx: (await readFile('tests/fixtures/muestra.pptx')).toString('base64'),
  xlsx: (await readFile('tests/fixtures/muestra.xlsx')).toString('base64'),
};
await officePage.evaluate(() => {
  window.__fileInputs = [];
  const original = document.createElement.bind(document);
  document.createElement = (tag, ...rest) => {
    const element = original(tag, ...rest);
    if (tag === 'input') {
      // Sin esto, el click() abriría el picker nativo y en headless se
      // autocancela (resolve(null)) antes de que asignemos el archivo.
      element.click = () => {};
      window.__fileInputs.push(element);
    }
    return element;
  };
});
const openOfficeFile = async (base64, name, type) => {
  const before = await officePage.evaluate(() => window.__fileInputs.length);
  await officePage.getByRole('button', { name: 'Abrir', exact: true }).click();
  await officePage.waitForFunction((count) => window.__fileInputs.length > count, before);
  await officePage.evaluate(({ base64, name, type }) => {
    const input = window.__fileInputs.at(-1);
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const file = new File([bytes], name, { type });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { base64, name, type });
};
await openOfficeFile(officeFixtures.docx, 'muestra.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
await officePage.locator('.markdown-body h1').waitFor();
assert.equal(await officePage.locator('.markdown-body h1').first().innerText(), 'Fisioterapia respiratoria');
assert.equal(await officePage.locator('.markdown-body h2').first().innerText(), 'Técnicas principales');
assert.equal(await officePage.locator('.markdown-body ul li').count(), 3);
assert.equal(await officePage.locator('.markdown-body table th').count(), 2);
assert.equal(await officePage.locator('.markdown-body img').count(), 1);
assert.match(await officePage.locator('.markdown-body a').first().getAttribute('href'), /example\.com/);
assert.equal(await officePage.getByText('docx', { exact: true }).count(), 1);
await officePage.getByRole('button', { name: 'Leer', exact: true }).click();
await officePage.waitForFunction(() => window.__spoken.length > 0);
assert.equal(await officePage.evaluate(() => window.__spoken[0]), 'Fisioterapia respiratoria');
await officePage.screenshot({ path: `${output}23-docx.png`, animations: 'disabled' });
checks.push('DOCX real: encabezados, lista, tabla, imagen, enlace y TTS con subrayado');
await openOfficeFile(officeFixtures.pptx, 'muestra.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
await officePage.locator('.markdown-body h1').nth(1).waitFor();
assert.equal(await officePage.locator('.markdown-body h1').first().innerText(), 'Fisioterapia respiratoria');
assert.equal(await officePage.locator('.markdown-body h1').nth(1).innerText(), 'Técnicas y práctica');
assert.equal(await officePage.locator('.markdown-body ul li').count(), 2);
assert.equal(await officePage.locator('.markdown-body table th').count(), 2);
assert.equal(await officePage.locator('.markdown-body img').count(), 1);
assert.equal(await officePage.locator('.markdown-body blockquote').first().innerText(), 'Recordar la práctica de hoy con el grupo.');
assert.equal(await officePage.getByText('pptx', { exact: true }).count(), 1);
await officePage.getByRole('button', { name: 'Mostrar índice' }).click();
await officePage.locator('aside').getByRole('button', { name: 'Técnicas y práctica' }).click();
await officePage.screenshot({ path: `${output}24-pptx.png`, animations: 'disabled' });
checks.push('PPTX real: dos diapositivas en orden, tabla, imagen, notas e índice navegable');
await openOfficeFile(officeFixtures.xlsx, 'muestra.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
await officePage.locator('.markdown-body h2').nth(1).waitFor();
assert.equal(await officePage.locator('.markdown-body h2').first().innerText(), 'Técnicas');
assert.equal(await officePage.locator('.markdown-body h2').nth(1).innerText(), 'Resumen');
assert.equal(await officePage.locator('.markdown-body table').count(), 2);
assert.equal(await officePage.locator('.markdown-body table td').first().innerText(), 'Técnica');
assert.match(await officePage.locator('.markdown-body a').first().getAttribute('href'), /example\.com/);
assert.equal(await officePage.getByText('xlsx', { exact: true }).count(), 1);
await officePage.screenshot({ path: `${output}25-xlsx.png`, animations: 'disabled' });
checks.push('XLSX real: dos hojas en orden con tablas, valores e hipervínculo');
await officeContext.close();

console.log(JSON.stringify({ checks, errors }, null, 2));
assert.equal(errors.length, 0, `Errores de ejecución: ${errors.join('\n')}`);
await ttsContext.close();
await browser.close();
