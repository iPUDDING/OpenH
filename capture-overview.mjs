import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const output = new URL('./docs/screenshots/', import.meta.url).pathname;
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${output}01-inicio.png`, animations: 'disabled' });

await page.getByLabel('Markdown inicial').fill(`# Guía de OpenHub\n\n## Lectura y escritura\n\nOpenHub reúne **documentos**, voz y mapas mentales en un espacio local.\n\n- Markdown, TXT y PDF.\n- Resaltado de frase y palabra.\n- Trabajo sin conexión.\n\n### Ejemplo de código\n\n\`\`\`ts\nconst privacidad = 'local';\nconsole.log(privacidad);\n\`\`\`\n\n### Matemáticas\n\nLa fórmula $E = mc^2$ se renderiza localmente con KaTeX.`);
await page.getByRole('button', { name: 'Abrir borrador' }).click();
await page.locator('.markdown-body pre').waitFor();
await page.screenshot({ path: `${output}02-visor-markdown.png`, animations: 'disabled' });

await page.keyboard.press('Alt+2');
await page.getByRole('heading', { name: 'Estudio TTS' }).waitFor();
await page.screenshot({ path: `${output}03-estudio-tts.png`, animations: 'disabled' });

await page.keyboard.press('Alt+3');
await page.locator('.markmap-node').first().waitFor();
await page.getByRole('button', { name: 'Ajustar mapa', exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${output}04-mapas-mentales.png`, animations: 'disabled' });

await page.keyboard.press('Alt+4');
await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor();
await page.screenshot({ path: `${output}05-ajustes.png`, animations: 'disabled' });

await page.getByRole('button', { name: 'Cambiar tema' }).click();
await page.keyboard.press('Alt+3');
await page.locator('.markmap-node').first().waitFor();
await page.getByRole('button', { name: 'Ajustar mapa', exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${output}06-mapa-modo-oscuro.png`, animations: 'disabled' });

const items = [
  ['01-inicio.png', 'Inicio'],
  ['02-visor-markdown.png', 'Visor Markdown'],
  ['03-estudio-tts.png', 'Estudio TTS'],
  ['04-mapas-mentales.png', 'Mapas mentales'],
  ['05-ajustes.png', 'Ajustes'],
  ['06-mapa-modo-oscuro.png', 'Modo oscuro'],
];
const cards = await Promise.all(items.map(async ([file, label]) => {
  const data = await readFile(`${output}${file}`);
  return `<figure style="margin:0"><img src="data:image/png;base64,${data.toString('base64')}" style="width:100%;display:block;border:1px solid #cbd5e1;border-radius:8px" /><figcaption style="margin-top:6px;font-size:18px;color:#334155">${label}</figcaption></figure>`;
}));

const overviewPage = await browser.newPage({ viewport: { width: 1440, height: 1516 }, locale: 'es-ES' });
await overviewPage.setContent(`<!doctype html><html><body style="margin:0;padding:18px;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <h1 style="margin:0 0 14px;font-size:24px;font-weight:700">OpenHub ${pkg.version} — By SrMaxi · Capturas reales</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${cards.join('')}</div>
</body></html>`);
await overviewPage.screenshot({ path: `${output}00-vista-general.png`, fullPage: true, animations: 'disabled' });
await browser.close();
console.log(`Capturas base 00–06 actualizadas desde el build de producción (${pkg.version}).`);
