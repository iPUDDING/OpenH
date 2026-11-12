import { chromium } from 'playwright';

const output = new URL('./docs/screenshots/', import.meta.url).pathname;
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
await browser.close();
console.log('Capturas base 01–06 actualizadas desde el build de producción.');
