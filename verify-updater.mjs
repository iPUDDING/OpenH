import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = new URL('./docs/screenshots/mejoras/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

// IPC de Tauri simulado exclusivamente en QA; nunca forma parte del bundle de producción.
await page.addInitScript(() => {
  let callbackId = 0;
  const callbacks = new Map();
  window.__qaHasUpdate = true;
  window.__qaCheckError = false;
  window.__downloadEvents = [];
  window.__restartCalled = false;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    transformCallback(callback, once = false) {
      const id = ++callbackId;
      callbacks.set(id, { callback, once });
      return id;
    },
    unregisterCallback(id) { callbacks.delete(id); },
    invoke: async (command, args = {}) => {
      if (command === 'plugin:app|version') return '1.0.7';
      if (command === 'plugin:event|listen') return 1;
      if (command === 'plugin:updater|check') {
        if (window.__qaCheckError) throw new Error('Red de QA no disponible');
        if (!window.__qaHasUpdate) return null;
        return {
          rid: 1,
          currentVersion: '1.0.0',
          version: '1.0.99',
          date: '2026-11-12T00:00:00Z',
          body: 'Mejoras de lectura, Pomodoro y estabilidad.\n\nActualización firmada de prueba.',
          rawJson: {},
        };
      }
      if (command === 'plugin:updater|download_and_install') {
        const entry = callbacks.get(args.onEvent.id);
        const send = async (index, event, data) => {
          window.__downloadEvents.push(event);
          entry?.callback({ index, message: { event, data } });
          await new Promise((resolve) => setTimeout(resolve, 120));
        };
        await send(0, 'Started', { contentLength: 1048576 });
        await send(1, 'Progress', { chunkLength: 524288 });
        await send(2, 'Progress', { chunkLength: 524288 });
        await send(3, 'Finished', {});
        entry?.callback({ index: 4, end: true });
        return null;
      }
      if (command === 'plugin:process|restart') { window.__restartCalled = true; return null; }
      return null;
    },
  };
});

await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await page.getByRole('dialog').waitFor({ timeout: 10000 });
await page.getByRole('heading', { name: 'Nueva versión 1.0.99' }).waitFor();
await page.getByText('Mejoras de lectura, Pomodoro y estabilidad.', { exact: false }).waitFor();
checks.push('La comprobación automática muestra versión y notas');
await page.screenshot({ path: `${output}14-actualizacion-disponible.png`, animations: 'disabled' });

await page.getByRole('button', { name: 'Más tarde', exact: true }).click();
assert.equal(await page.evaluate(() => localStorage.getItem('openhub-update-dismissed')), '1.0.99');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
assert.equal(await page.getByRole('dialog').count(), 0);
checks.push('Más tarde descarta esa versión en el siguiente arranque');

await page.getByRole('button', { name: /Ajustes/ }).click();
await page.getByRole('button', { name: 'Buscar actualizaciones', exact: true }).click();
await page.getByRole('heading', { name: 'Nueva versión 1.0.99' }).waitFor();
checks.push('La búsqueda manual recupera una versión descartada');
await page.getByRole('button', { name: 'Descargar y actualizar', exact: true }).focus();
await page.keyboard.press('Tab');
assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Cerrar actualización');
await page.keyboard.press('Shift+Tab');
assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Descargar y actualizar');
checks.push('El foco permanece dentro del diálogo de actualización');
await page.keyboard.press('Escape');
assert.equal(await page.getByRole('dialog').count(), 0);
checks.push('Escape cierra el diálogo cuando no está instalando');
await page.getByRole('button', { name: 'Buscar actualizaciones', exact: true }).click();
await page.getByRole('button', { name: 'Descargar y actualizar', exact: true }).click();
await page.waitForFunction(() => window.__restartCalled, { timeout: 10000 });
assert.deepEqual(await page.evaluate(() => window.__downloadEvents), ['Started', 'Progress', 'Progress', 'Finished']);
checks.push('Descargar e instalar procesa progreso y solicita reinicio');

await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => { window.__qaHasUpdate = false; });
await page.getByRole('button', { name: /Ajustes/ }).click();
await page.getByRole('button', { name: 'Buscar actualizaciones', exact: true }).click();
await page.getByRole('heading', { name: 'OpenHub está actualizado' }).waitFor();
checks.push('Sin una versión superior informa que OpenHub está actualizado');
await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

await page.evaluate(() => { window.__qaCheckError = true; });
await page.getByRole('button', { name: 'Buscar actualizaciones', exact: true }).click();
await page.getByRole('heading', { name: 'Actualización no completada' }).waitFor();
await page.getByText('Revisa tu conexión', { exact: false }).waitFor();
checks.push('Un fallo manual de red ofrece un mensaje y reintento');

console.log(JSON.stringify({ checks, errors }, null, 2));
assert.equal(errors.length, 0, `Errores de ejecución: ${errors.join('\n')}`);
await browser.close();
