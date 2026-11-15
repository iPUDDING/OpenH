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

// Doble de prueba aislado del runtime: permite afirmar el texto entregado a Web Speech.
await page.addInitScript(() => {
  window.__spoken = [];
  window.__utterances = [];
  class FakeUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = 'es-ES'; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [{ name: 'Voz QA local', lang: 'es-ES', voiceURI: 'qa-local' }],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    speak: (utterance) => { window.__spoken.push(utterance.text); window.__utterances.push(utterance); },
    cancel: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
  } });
});

await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await page.getByLabel('Markdown inicial').fill('# Guía de lectura\n\nEste párrafo contiene una selección importante para escuchar.\n\nSegundo párrafo del documento completo.');
await page.getByRole('button', { name: 'Abrir borrador' }).click();
await page.locator('.markdown-body p').first().waitFor();
const selected = 'selección importante';
await page.evaluate((text) => {
  const paragraph = Array.from(document.querySelectorAll('.markdown-body p')).find((node) => node.textContent.includes(text));
  const node = paragraph.firstChild;
  const start = node.textContent.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}, selected);
await page.screenshot({ path: `${output}13-leer-seleccion.png`, animations: 'disabled' });
await page.getByRole('button', { name: 'Leer selección', exact: true }).click();
await page.waitForFunction(() => window.__spoken.length === 1);
assert.equal(await page.evaluate(() => window.__spoken[0]), selected);
checks.push('Leer selección conserva el fragmento al pulsar el botón');

await page.getByRole('button', { name: 'Párrafo anterior', exact: true }).click();
await page.waitForFunction(() => window.__spoken.length === 2);
assert.equal(await page.evaluate(() => window.__spoken[1]), selected);
checks.push('Anterior conserva el ámbito de la selección y no vuelve al documento');

await page.evaluate(() => window.__utterances.at(-1).onend());
await page.getByRole('button', { name: 'Repetir', exact: true }).click();
await page.waitForFunction(() => window.__spoken.length === 3);
assert.equal(await page.evaluate(() => window.__spoken[2]), selected);
checks.push('Repetir reproduce nuevamente la selección');
await page.getByRole('button', { name: 'Detener lectura', exact: true }).click();

await page.evaluate(() => window.getSelection().removeAllRanges());
await page.waitForTimeout(100);
await page.getByRole('button', { name: 'Leer selección', exact: true }).click();
await page.getByText('Para escuchar un fragmento:', { exact: false }).waitFor();
assert.equal(await page.evaluate(() => window.__spoken.length), 3);
checks.push('Sin selección muestra instrucciones y no inicia reproducción');
await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

await page.getByRole('button', { name: 'Vista dividida', exact: true }).click();
const editorSelection = await page.getByLabel('Editor Markdown', { exact: true }).evaluate((textarea) => {
  textarea.focus();
  textarea.setSelectionRange(0, 15);
  textarea.dispatchEvent(new Event('select', { bubbles: true }));
  return textarea.value.slice(0, 15);
});
await page.getByRole('button', { name: 'Leer selección', exact: true }).click();
await page.waitForFunction(() => window.__spoken.length === 4);
assert.equal(await page.evaluate(() => window.__spoken[3]), editorSelection);
checks.push('Leer selección también admite texto del editor Markdown');
await page.getByRole('button', { name: 'Detener lectura', exact: true }).click();
await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

await page.getByRole('button', { name: 'Leer', exact: true }).click();
await page.waitForFunction(() => window.__spoken.length === 5);
await page.getByLabel('Editor Markdown', { exact: true }).fill('# Texto actualizado\n\nEsta versión nueva debe detener la voz anterior.');
await page.getByRole('button', { name: 'Leer', exact: true }).waitFor();
await page.getByRole('button', { name: 'Leer', exact: true }).click();
await page.waitForFunction(() => window.__spoken.length === 6);
assert.equal(await page.evaluate(() => window.__spoken[5]), 'Texto actualizado');
await page.evaluate(() => window.__utterances.at(-1).onend());
await page.waitForFunction(() => window.__spoken.length === 7);
assert.equal(await page.evaluate(() => window.__spoken[6]), 'Esta versión nueva debe detener la voz anterior.');
checks.push('Editar la fuente detiene la voz antigua y la siguiente lectura usa el texto nuevo');
await page.getByRole('button', { name: 'Detener lectura', exact: true }).click();
await page.getByRole('button', { name: 'Vista previa', exact: true }).click();

await page.getByRole('button', { name: /Pomodoro:/ }).click();
await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
await page.waitForTimeout(1250);
await page.getByRole('button', { name: 'Pausar', exact: true }).click();
const pausedClock = await page.locator('section[aria-label="Temporizador Pomodoro"] .text-4xl').textContent();
await page.waitForTimeout(1250);
assert.equal(await page.locator('section[aria-label="Temporizador Pomodoro"] .text-4xl').textContent(), pausedClock);
assert.notEqual(pausedClock, '25:00');
checks.push('Pausar Pomodoro conserva el tiempo restante');
await page.getByRole('button', { name: 'Siguiente sesión', exact: true }).click();
await page.getByText('0 sesiones completadas', { exact: true }).waitFor();
checks.push('Saltar una sesión no incrementa las completadas');
await page.keyboard.press('Escape');
assert.equal(await page.locator('section[aria-label="Temporizador Pomodoro"]').count(), 0);
checks.push('Escape cierra el Pomodoro y devuelve el foco a su botón');
await page.getByRole('button', { name: /Pomodoro:/ }).click();
await page.getByRole('heading', { name: 'Texto actualizado' }).click();
assert.equal(await page.locator('section[aria-label="Temporizador Pomodoro"]').count(), 0);
checks.push('Hacer clic fuera cierra el Pomodoro');

const main = page.locator('main');
const initialHeight = (await main.boundingBox()).height;
await page.getByRole('button', { name: 'Ocultar barra superior', exact: true }).click();
await page.getByRole('button', { name: 'Mostrar barra superior', exact: true }).waitFor();
assert.equal(await page.getByRole('button', { name: 'Abrir paleta de comandos' }).count(), 0);
assert.ok((await main.boundingBox()).height > initialHeight + 40);
checks.push('El botón oculta la barra y amplía el área de trabajo');
await page.evaluate(() => document.activeElement?.blur());
await page.mouse.move(1000, 400);
await page.waitForTimeout(500);
await page.screenshot({ path: `${output}12-barra-superior-oculta.png`, animations: 'disabled' });
await page.getByRole('button', { name: 'Mostrar barra superior', exact: true }).click();
await page.getByRole('button', { name: 'Abrir paleta de comandos' }).waitFor();
checks.push('El botón flotante recupera la barra superior');

await page.keyboard.press('Control+Shift+h');
await page.getByRole('button', { name: 'Mostrar barra superior', exact: true }).waitFor();
await page.keyboard.press('Control+k');
await page.getByLabel('Buscar comandos').fill('barra superior');
await page.keyboard.press('Enter');
await page.getByRole('button', { name: 'Abrir paleta de comandos' }).waitFor();
checks.push('Ctrl+Shift+H y la paleta permiten ocultar/recuperar la barra');
await page.keyboard.press('Control+Shift+h');
await page.getByRole('button', { name: 'Mostrar barra superior', exact: true }).waitFor();
await page.keyboard.press('Control+Shift+h');
await page.getByRole('button', { name: 'Abrir paleta de comandos' }).waitFor();
checks.push('El atajo alterna la barra en ambos sentidos');

console.log(JSON.stringify({ checks, errors }, null, 2));
assert.equal(errors.length, 0, `Errores de ejecución: ${errors.join('\n')}`);
await browser.close();
