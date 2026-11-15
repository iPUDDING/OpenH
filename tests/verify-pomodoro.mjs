import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const output = new URL('./docs/screenshots/mejoras/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
const page = await context.newPage();
const checks = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.addInitScript(() => {
  window.__alarmNotes = [];
  class FakeAudioContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    async resume() { this.state = 'running'; }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
    createOscillator() {
      const oscillator = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime(value) { this.value = value; } },
        connect() {}, disconnect() {},
        start() { window.__alarmNotes.push(oscillator.frequency.value); },
        stop() {},
      };
      return oscillator;
    }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
});

const openPanel = async () => {
  await page.getByRole('button', { name: /Pomodoro:/ }).click();
  const panel = page.getByLabel('Temporizador Pomodoro', { exact: true });
  await panel.waitFor();
  return panel;
};
const assertButtonsAreOnTop = async () => {
  const start = page.getByRole('button', { name: 'Iniciar', exact: true });
  assert.ok(await start.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit instanceof Element && hit.closest('button') === button;
  }), 'Otro elemento está tapando Iniciar');
  await start.click();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Reiniciar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente sesión', exact: true }).click();
};

await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await page.getByLabel('Markdown inicial').fill('# Prueba Pomodoro\n\nContenido del visor.');
await page.getByRole('button', { name: 'Abrir borrador' }).click();
await openPanel();
await assertButtonsAreOnTop();
checks.push('Visor: Iniciar, Pausar, Reiniciar y Siguiente reciben clics por encima del documento');
await page.keyboard.press('Escape');

await page.keyboard.press('Alt+2');
await page.getByRole('heading', { name: 'Estudio TTS' }).waitFor();
await openPanel();
await assertButtonsAreOnTop();
checks.push('TTS: los controles del portal reciben clics por encima del editor y la lectura');
await page.keyboard.press('Escape');

await page.keyboard.press('Alt+3');
await page.getByRole('heading', { name: 'Mapas mentales' }).waitFor();
await page.locator('.markmap-node').first().waitFor();
await page.getByRole('button', { name: 'Ajustar mapa', exact: true }).click();
await page.waitForTimeout(700);
await openPanel();
await page.mouse.move(800, 500);
await page.screenshot({ path: `${output}15-pomodoro-superpuesto.png`, animations: 'disabled' });
await assertButtonsAreOnTop();
checks.push('Mapas: los controles reciben clics por encima del lienzo y la barra de exportación');
assert.equal(await page.evaluate(() => window.__alarmNotes.length), 0);
checks.push('Pausar, reiniciar y saltar no producen falsas alarmas');
await page.keyboard.press('Escape');

// Sesiones de 1,2 segundos para recorrer ambos vencimientos con el temporizador real.
await page.evaluate(() => {
  const key = 'openhub-store';
  const saved = JSON.parse(localStorage.getItem(key));
  saved.state.pomodoro = { workMinutes: 0.02, breakMinutes: 0.02 };
  localStorage.setItem(key, JSON.stringify(saved));
});
await page.reload({ waitUntil: 'networkidle' });
await openPanel();
await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
await page.waitForFunction(() => window.__alarmNotes.length >= 3);
await page.getByRole('heading', { name: 'Descanso', exact: true }).waitFor();
assert.deepEqual(await page.evaluate(() => window.__alarmNotes.slice(0, 3)), [880, 660, 880]);
await page.getByText('1 sesión completada', { exact: true }).waitFor();
checks.push('Al agotarse el enfoque suena su melodía, cuenta una sesión y comienza el descanso');
await page.waitForFunction(() => window.__alarmNotes.length >= 6);
await page.getByRole('heading', { name: 'Sesión de enfoque', exact: true }).waitFor();
assert.deepEqual(await page.evaluate(() => window.__alarmNotes.slice(3, 6)), [523.25, 659.25, 523.25]);
await page.getByText('1 sesión completada', { exact: true }).waitFor();
checks.push('Al agotarse el descanso suena otra melodía y vuelve el enfoque sin inflar las estadísticas');

console.log(JSON.stringify({ checks, errors }, null, 2));
assert.equal(errors.length, 0, `Errores de ejecución: ${errors.join('\n')}`);
await browser.close();
