import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = new URL('./docs/screenshots/mejoras/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

const pdfPage = await context.newPage();
await pdfPage.setContent(`<html><body style="font-family:Arial;padding:50px"><h1>OpenHub profesional</h1><p>OpenHub permite buscar y resaltar texto en documentos PDF.</p><p>La navegación por teclado mejora la accesibilidad.</p><div style="break-before:page"><h1>Segunda página</h1><p>Esta página demuestra el salto automático a una coincidencia.</p></div></body></html>`);
await pdfPage.pdf({ path: '/tmp/openhub-e2e.pdf', format: 'A4', printBackground: true });
await pdfPage.close();

async function capture(name) {
  await page.screenshot({ path: `${output}${name}.png`, animations: 'disabled' });
  console.log(`Capturada: ${name}.png`);
}

await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await page.getByLabel('Markdown inicial').fill(`# Investigación profesional\n\nOpenHub incorpora mejoras basadas en aplicaciones reales.\n\n## Paleta de comandos\n\nAcceso rápido a todas las herramientas mediante teclado.\n\n## Lectura accesible\n\nTexto configurable, índice navegable y resaltado sincronizado.\n\n### Detalles técnicos\n\nEl contenido permanece siempre en el equipo.`);
await page.getByRole('button', { name: 'Abrir borrador' }).click();
await page.getByRole('button', { name: 'Mostrar índice' }).click();
await page.locator('aside[aria-label="Índice del documento"]').waitFor();
assert.equal(await page.locator('aside[aria-label="Índice del documento"] button').count(), 4);
checks.push('Índice Markdown con cuatro encabezados');
await page.waitForTimeout(400);
await capture('08-indice-lectura');

await page.keyboard.press('Control+k');
await page.getByRole('dialog', { name: 'Paleta de comandos' }).waitFor();
await page.getByLabel('Buscar comandos').fill('mapas');
await page.waitForTimeout(250);
await capture('07-paleta-comandos');
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'Mapas mentales' }).waitFor();
await page.getByRole('button', { name: 'Plan de proyecto' }).click();
await page.locator('.markmap-node').first().waitFor();
await page.keyboard.press('Control+f');
await page.getByPlaceholder('Buscar un tema en el mapa…').fill('Implementación');
await page.locator('[data-markmap-search="current"]').waitFor({ timeout: 15000 });
checks.push('Búsqueda y centrado de tema Markmap');
await page.waitForTimeout(700);
await capture('10-busqueda-markmap');

await page.getByRole('button', { name: /Ajustes/ }).click();
await page.getByLabel('Término original').fill('Kubernetes');
await page.getByLabel('Pronunciación', { exact: true }).fill('ku ber ne tes');
await page.getByRole('button', { name: 'Añadir regla' }).click();
await page.getByLabel('Original: Kubernetes').waitFor();
checks.push('Alta y persistencia de regla de pronunciación');
await page.getByRole('heading', { name: 'Pronunciación TTS' }).scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await capture('11-pronunciacion-ajustes');

const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Exportar copia' }).click();
const download = await downloadPromise;
await download.saveAs('/tmp/openhub-backup-e2e.json');
const backup = JSON.parse(await readFile('/tmp/openhub-backup-e2e.json', 'utf8'));
assert.equal(backup.app, 'OpenHub');
assert.equal(backup.version, 1);
assert.equal(backup.data.pronunciationRules[0].from, 'Kubernetes');
checks.push('Exportación JSON versionada de copia de seguridad');

await page.getByRole('button', { name: /Documentos/ }).click();
const chooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Abrir', exact: true }).click();
const chooser = await chooserPromise;
await chooser.setFiles('/tmp/openhub-e2e.pdf');
await page.locator('canvas').waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
const pdfMeta = await page.locator('section[aria-label="Visor de documentos"] > header p').textContent();
assert.match(pdfMeta, /^[1-9]\d* palabras$/);
assert.notEqual(pdfMeta, '38 palabras');
checks.push('El contador del encabezado corresponde al PDF abierto');
await page.keyboard.press('Control+f');
await page.getByPlaceholder('Buscar en el PDF…').fill('OpenHub');
await page.waitForTimeout(600);
assert.equal(await page.evaluate(() => Boolean(window.CSS?.highlights?.has('openhub-search'))), true);
checks.push('Coincidencias PDF resaltadas con CSS Highlights');
await page.getByPlaceholder('Buscar en el PDF…').fill('Segunda');
await page.waitForTimeout(1000);
assert.equal(await page.getByLabel('Página actual').inputValue(), '2');
checks.push('Salto automático de búsqueda PDF a página 2');
await capture('09-busqueda-pdf');

console.log(JSON.stringify({ checks, errors }, null, 2));
assert.equal(errors.length, 0, `Errores de ejecución: ${errors.join('\n')}`);
await browser.close();
