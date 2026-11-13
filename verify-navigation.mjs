import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
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
await page.getByText('By SrMaxi', { exact: true }).waitFor();
await page.getByText('v1.0.7', { exact: true }).waitFor();
checks.push('La cabecera muestra By SrMaxi y la versión base v1.0.7');
await page.getByRole('button', { name: 'Crear texto nuevo', exact: true }).click();
await page.getByLabel('Editor Markdown', { exact: true }).waitFor();
assert.equal(await page.getByLabel('Editor Markdown', { exact: true }).inputValue(), '');
await page.getByRole('heading', { name: 'Texto 1.md', exact: true }).waitFor();
await page.getByLabel('Editor Markdown', { exact: true }).fill('# Primer borrador\n\nContenido conservado.');
await page.waitForTimeout(800);
checks.push('Nuevo texto crea Texto 1.md, abre el editor y lo añade a Recientes');

await page.getByRole('button', { name: 'Crear texto nuevo', exact: true }).click();
await page.getByRole('heading', { name: 'Texto 2.md', exact: true }).waitFor();
assert.equal(await page.getByLabel('Editor Markdown', { exact: true }).inputValue(), '');
await page.getByLabel('Editor Markdown', { exact: true }).fill('Segundo borrador independiente.');
await page.waitForTimeout(800);
checks.push('El segundo borrador recibe un nombre único y no sobrescribe el primero');

await page.getByRole('button', { name: /^Texto 1\.md/ }).click();
await page.getByRole('heading', { name: 'Texto 1.md', exact: true }).waitFor();
assert.equal(await page.getByLabel('Editor Markdown', { exact: true }).inputValue(), '# Primer borrador\n\nContenido conservado.');
checks.push('Recientes recupera el contenido del borrador seleccionado');

const chooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Abrir archivo desde Recientes', exact: true }).click();
const chooser = await chooserPromise;
await chooser.setFiles({ name: 'Archivo reciente.md', mimeType: 'text/markdown', buffer: Buffer.from('# Archivo desde Recientes\n\nContenido local.') });
await page.getByRole('heading', { name: 'Archivo reciente.md', exact: true }).waitFor();
await page.getByText('Contenido local.', { exact: true }).waitFor();
await page.getByRole('button', { name: /^Archivo reciente\.md/ }).waitFor();
checks.push('Abrir archivo desde Recientes carga el documento y actualiza la lista');
await page.screenshot({ path: `${output}16-recientes-acciones.png`, animations: 'disabled' });

await page.getByRole('button', { name: 'Poner pantalla completa', exact: true }).click();
await page.waitForFunction(() => Boolean(document.fullscreenElement));
await page.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).waitFor();
await page.screenshot({ path: `${output}17-pantalla-completa.png`, animations: 'disabled' });
await page.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).click();
await page.waitForFunction(() => !document.fullscreenElement);
checks.push('El botón entra y sale de pantalla completa mediante Fullscreen API');

await page.keyboard.press('F11');
await page.waitForFunction(() => Boolean(document.fullscreenElement));
await page.keyboard.press('F11');
await page.waitForFunction(() => !document.fullscreenElement);
checks.push('F11 alterna pantalla completa en ambos sentidos');

const nativePage = await context.newPage();
watch(nativePage);
await nativePage.addInitScript(() => {
  let callbackId = 0;
  window.__nativeFullscreen = false;
  window.__fullscreenCalls = [];
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    transformCallback: () => ++callbackId,
    unregisterCallback: () => undefined,
    invoke: async (command, args = {}) => {
      if (command === 'plugin:app|version') return '1.0.7';
      if (command === 'plugin:event|listen') return 1;
      if (command === 'plugin:updater|check') return null;
      if (command === 'plugin:window|is_fullscreen') return window.__nativeFullscreen;
      if (command === 'plugin:window|set_fullscreen') {
        const value = typeof args === 'boolean' ? args : args.fullscreen ?? args.value;
        window.__nativeFullscreen = Boolean(value);
        window.__fullscreenCalls.push(Boolean(value));
        return null;
      }
      return null;
    },
  };
});
await nativePage.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await nativePage.getByRole('button', { name: 'Poner pantalla completa', exact: true }).click();
await nativePage.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).waitFor();
assert.deepEqual(await nativePage.evaluate(() => window.__fullscreenCalls), [true]);
await nativePage.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).click();
await nativePage.getByRole('button', { name: 'Poner pantalla completa', exact: true }).waitFor();
assert.deepEqual(await nativePage.evaluate(() => window.__fullscreenCalls), [true, false]);
checks.push('Tauri recibe setFullscreen(true/false) y el botón refleja isFullscreen');

await nativePage.evaluate(() => { window.__nativeFullscreen = true; window.dispatchEvent(new Event('resize')); });
await nativePage.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).waitFor();
checks.push('El estado se sincroniza cuando la ventana nativa cambia externamente');

await nativePage.getByRole('button', { name: 'Ocultar barra superior', exact: true }).click();
await nativePage.getByRole('button', { name: 'Mostrar barra superior', exact: true }).waitFor();
await nativePage.keyboard.press('F11');
await nativePage.waitForFunction(() => window.__nativeFullscreen === false);
await nativePage.keyboard.press('F11');
await nativePage.waitForFunction(() => window.__nativeFullscreen === true);
checks.push('F11 funciona en Tauri incluso con la barra superior oculta');

console.log(JSON.stringify({ checks, errors }, null, 2));
assert.equal(errors.length, 0, `Errores de ejecución: ${errors.join('\n')}`);
await browser.close();
