import { safeFileName } from './utils';
import { escapeHtml } from './text';

export function serializeMarkmapSvg(svg: SVGSVGElement, dark: boolean): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1600');
  clone.setAttribute('height', '1000');
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 1600 1000');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = dark
    ? 'svg{background:#0f172a}text,foreignObject{fill:#f8fafc!important;color:#f8fafc!important}path,line{stroke:#cbd5e1}'
    : 'svg{background:#ffffff}foreignObject{color:#0f172a}';
  clone.prepend(style);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

export async function svgToPng(svgMarkup: string, scale = 2): Promise<Blob> {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo rasterizar el SVG.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.width * scale);
    canvas.height = Math.max(1, image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D no está disponible.');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG.')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createInteractiveHtml(title: string, svgMarkup: string, dark: boolean): string {
  const background = dark ? '#0f172a' : '#ffffff';
  const foreground = dark ? '#f8fafc' : '#0f172a';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background};color:${foreground};font-family:system-ui,sans-serif}svg{width:100%;height:100%;touch-action:none;cursor:grab}svg:active{cursor:grabbing}.tools{position:fixed;right:16px;top:16px;display:flex;gap:6px}button{border:1px solid #64748b55;border-radius:7px;background:${background};color:${foreground};padding:8px 12px;cursor:pointer;font-size:16px}button:hover{background:#3b82f622}.hint{position:fixed;left:16px;bottom:12px;font-size:12px;opacity:.65}
</style></head><body>${svgMarkup}<div class="tools"><button id="minus" aria-label="Alejar">−</button><button id="plus" aria-label="Acercar">+</button><button id="fit" aria-label="Restablecer">Ajustar</button></div><div class="hint">Arrastra para desplazar · rueda para zoom · teclas +, − y 0</div>
<script>(()=>{const s=document.querySelector('svg');if(!s)return;let v=s.viewBox.baseVal;if(!v.width){s.setAttribute('viewBox','0 0 1600 1000');v=s.viewBox.baseVal}const initial={x:v.x,y:v.y,w:v.width,h:v.height};const zoom=f=>{const cx=v.x+v.width/2,cy=v.y+v.height/2,nw=v.width/f,nh=v.height/f;v.x=cx-nw/2;v.y=cy-nh/2;v.width=nw;v.height=nh};document.getElementById('plus').onclick=()=>zoom(1.25);document.getElementById('minus').onclick=()=>zoom(.8);document.getElementById('fit').onclick=()=>{v.x=initial.x;v.y=initial.y;v.width=initial.w;v.height=initial.h};s.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:.89)},{passive:false});let drag=null;s.addEventListener('pointerdown',e=>{s.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,vx:v.x,vy:v.y}});s.addEventListener('pointermove',e=>{if(!drag)return;const r=s.getBoundingClientRect();v.x=drag.vx-(e.clientX-drag.x)*v.width/r.width;v.y=drag.vy-(e.clientY-drag.y)*v.height/r.height});s.addEventListener('pointerup',()=>drag=null);document.addEventListener('keydown',e=>{if(e.key==='+')zoom(1.2);if(e.key==='-')zoom(.83);if(e.key==='0')document.getElementById('fit').click()})})();</script></body></html>`;
}

export function printMarkmap(title: string, svgMarkup: string): void {
  const frame = document.createElement('iframe');
  frame.title = 'Impresión del mapa mental';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    throw new Error('No se pudo abrir la vista de impresión.');
  }
  frameDocument.open();
  frameDocument.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:landscape;margin:8mm}html,body{margin:0;width:100%;height:100%}svg{width:100%;height:100%}</style></head><body>${svgMarkup}</body></html>`);
  frameDocument.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  }, 200);
}

export function exportBaseName(documentName: string): string {
  return safeFileName(documentName.replace(/\.(md|markdown|txt)$/i, '') || 'mapa-mental');
}
