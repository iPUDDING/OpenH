import type { SpeechSegment } from '@/types';

/**
 * Conversión de fórmulas LaTeX a español hablado.
 * Sin esto, la voz lee el código fuente (`$\ge 90\,\%$`) literalmente y se
 * traba. Todo es puro y testeable; el pipeline de TTS lo aplica antes de
 * las reglas de pronunciación conservando el mapa de offsets para el
 * resaltado sobre el documento visible.
 */

/** Comandos sin argumentos y su lectura en español. */
const SYMBOLS: Record<string, string> = {
  // Relaciones y conjuntos
  ge: 'mayor o igual que', geq: 'mayor o igual que', le: 'menor o igual que', leq: 'menor o igual que',
  ne: 'distinto de', neq: 'distinto de', approx: 'aproximadamente', sim: 'similar a', cong: 'congruente con',
  propto: 'proporcional a', ll: 'mucho menor que', gg: 'mucho mayor que', prec: 'precede a', succ: 'sucede a',
  in: 'pertenece a', notin: 'no pertenece a', ni: 'contiene a', subset: 'subconjunto de', supset: 'superconjunto de',
  subseteq: 'subconjunto o igual a', supseteq: 'superconjunto o igual a', cup: 'unión', cap: 'intersección',
  emptyset: 'conjunto vacío', varnothing: 'conjunto vacío', setminus: 'diferencia de',
  to: 'tiende a', rightarrow: 'tiende a', longrightarrow: 'tiende a', mapsto: 'se asigna a',
  implies: 'implica', impliedby: 'implicado por', iff: 'si y solo si', leftrightarrow: 'si y solo si',
  land: 'y', wedge: 'y', and: 'y', lor: 'o', vee: 'o', or: 'o', neg: 'no', lnot: 'no',
  forall: 'para todo', exists: 'existe', nexists: 'no existe',
  perp: 'perpendicular a', parallel: 'paralelo a', angle: 'ángulo', triangle: 'triángulo', square: 'cuadrado',
  // Aritmética y operadores
  times: 'por', cdot: 'por', ast: 'por', div: 'dividido', pm: 'más menos', mp: 'menos más',
  circ: 'compuesta con', oplus: 'suma directa', otimes: 'producto tensorial', star: 'estrella',
  // Funciones y operadores grandes
  sin: 'seno', cos: 'coseno', tan: 'tangente', sec: 'secante', csc: 'cosecante', cot: 'cotangente',
  arcsin: 'arco seno', arccos: 'arco coseno', arctan: 'arco tangente',
  sinh: 'seno hiperbólico', cosh: 'coseno hiperbólico', tanh: 'tangente hiperbólica',
  log: 'logaritmo', ln: 'logaritmo natural', lg: 'logaritmo decimal', exp: 'exponencial',
  lim: 'límite', max: 'máximo', min: 'mínimo', sup: 'supremo', inf: 'ínfimo',
  det: 'determinante', dim: 'dimensión', ker: 'núcleo', gcd: 'máximo común divisor',
  sum: 'sumatoria', prod: 'productoria', int: 'integral', iint: 'integral doble', oint: 'integral de contorno',
  // Constantes y símbolos
  infty: 'infinito', partial: 'parcial', nabla: 'gradiente', degree: 'grados', textdegree: 'grados',
  hbar: 'hache con barra', ell: 'ele', prime: 'prima', emptysetSymbol: 'conjunto vacío',
  // Letras griegas
  alpha: 'alfa', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'épsilon', varepsilon: 'épsilon',
  zeta: 'zeta', eta: 'eta', theta: 'theta', vartheta: 'theta', iota: 'iota', kappa: 'kappa',
  lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi', rho: 'rho', sigma: 'sigma',
  tau: 'tau', upsilon: 'upsilon', phi: 'phi', varphi: 'phi', chi: 'chi', psi: 'psi', omega: 'omega',
  Gamma: 'gamma', Delta: 'delta', Theta: 'theta', Lambda: 'lambda', Xi: 'xi', Pi: 'pi',
  Sigma: 'sigma', Phi: 'phi', Psi: 'psi', Omega: 'omega',
};

/** Comandos con un argumento que se lee como «palabra + argumento». */
const PREFIX_COMMANDS: Record<string, string> = {
  hat: 'con sombrero', bar: 'con barra', overline: 'con barra', tilde: 'con tilde',
  dot: 'punto', ddot: 'doble punto', vec: 'vector', underline: 'subrayado',
};

/** Comandos cuyo argumento se lee tal cual (formato, texto, cajas). */
const ARG_COMMANDS = new Set([
  'text', 'textbf', 'textit', 'textnormal', 'textup', 'textsc', 'textsf', 'texttt', 'textrm',
  'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathfrak', 'mathbb',
  'operatorname', 'mbox', 'boxed', 'fbox', 'href', 'boldsymbol', 'bm',
]);

/** Comandos que se descartan junto con su argumento (no deben leerse). */
const DROP_ARG_COMMANDS = new Set([
  'color', 'label', 'ref', 'eqref', 'cite', 'url', 'begin', 'end', 'tag',
]);

/** Comandos de descarte sin argumento. */
const DROP_COMMANDS = new Set(['notag', 'nonumber']);

/** Espaciados y comandos de formato sin lectura. */
const SPACING_COMMANDS = new Set([
  ',', ';', ':', ' ', '!', 'quad', 'qquad', 'enspace', 'thinspace', 'medspace', 'thickspace',
  'displaystyle', 'textstyle', 'scriptstyle', 'limits', 'nolimits', 'left', 'right',
  'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr',
  'bigm', 'Bigm', 'biggm', 'Biggm',
]);

/** Símbolos Unicode sueltos y su lectura. */
const UNICODE_SYMBOLS: Record<string, string> = {
  '≥': 'mayor o igual que', '≤': 'menor o igual que', '≠': 'distinto de', '≈': 'aproximadamente',
  '∞': 'infinito', 'π': 'pi', 'α': 'alfa', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'θ': 'theta',
  'λ': 'lambda', 'μ': 'mu', 'σ': 'sigma', 'φ': 'phi', 'ω': 'omega', 'Δ': 'delta', 'Σ': 'sumatoria',
  '∫': 'integral', '√': 'raíz cuadrada de', '∑': 'sumatoria', '∏': 'productoria',
  '∈': 'pertenece a', '∉': 'no pertenece a', '⊂': 'subconjunto de', '⊃': 'superconjunto de',
  '∪': 'unión', '∩': 'intersección', '∅': 'conjunto vacío', '∀': 'para todo', '∃': 'existe',
  '∧': 'y', '∨': 'o', '¬': 'no', '→': 'tiende a', '←': 'desde', '↔': 'si y solo si',
  '×': 'por', '÷': 'dividido', '·': 'por', '±': 'más menos', '∓': 'menos más',
  '°': 'grados', '−': 'menos', '∝': 'proporcional a', '⊥': 'perpendicular a', '∥': 'paralelo a',
  '∠': 'ángulo', '∂': 'parcial', '∇': 'gradiente',
};

function isLetter(char: string): boolean {
  return /[\p{L}]/u.test(char);
}

function isDigit(char: string): boolean {
  return /[\p{N}]/u.test(char);
}

/**
 * Convierte una expresión TeX (sin delimitadores `$…$`) a español hablado.
 * Ej.: `\ge 90\,\%` → `mayor o igual que 90 por ciento`.
 */
export function latexToSpeech(tex: string): string {
  const source = tex;
  let index = 0;
  const length = source.length;
  const output: string[] = [];

  const pushWord = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    const last = output.at(-1) ?? '';
    const needsSpace = last !== '' && !/[\s(,¿¡]$/.test(last) && /^[\p{L}\p{N}]/u.test(trimmed);
    output.push(needsSpace ? ` ${trimmed}` : trimmed);
  };
  const pushRaw = (chunk: string) => {
    if (chunk) output.push(chunk);
  };

  const readGroup = (): string => {
    // source[index] === '{'
    index += 1;
    const start = index;
    let depth = 1;
    while (index < length && depth > 0) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    const inner = source.slice(start, index);
    if (index < length) index += 1; // consume '}'
    return latexToSpeech(inner);
  };

  const readArg = (): string => {
    while (index < length && /\s/.test(source[index])) index += 1;
    if (index >= length) return '';
    if (source[index] === '{') return readGroup();
    if (source[index] === '\\') {
      // Un comando como argumento (p. ej. `^\alpha`).
      index += 1;
      const command = readCommandName();
      if (command) return commandSpeech(command);
      return '';
    }
    const char = source[index];
    index += 1;
    return char;
  };

  const readCommandName = (): string => {
    // index está justo después de la barra invertida.
    if (index >= length) return '';
    const char = source[index];
    if (/[a-zA-Z]/.test(char)) {
      const start = index;
      while (index < length && /[a-zA-Z]/.test(source[index])) index += 1;
      return source.slice(start, index);
    }
    index += 1;
    return char;
  };

  const commandSpeech = (command: string): string => {
    // Comandos de un solo carácter no alfabético: escapes y espaciados.
    if (command.length === 1 && !/[a-zA-Z]/.test(command)) {
      const escapes: Record<string, string> = {
        '%': 'por ciento', '$': 'dólares', '&': 'y', '#': 'numeral', '_': 'guion bajo',
        '{': 'llave izquierda', '}': 'llave derecha', '\\': '; ',
      };
      if (escapes[command] !== undefined) return escapes[command];
      return ' ';
    }
    if (SPACING_COMMANDS.has(command)) return ' ';
    if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
      const numerator = readArg();
      const denominator = readArg();
      return `fracción ${numerator} sobre ${denominator}`;
    }
    if (command === 'sqrt') {
      // \sqrt[n]{x} opcional: si sigue un grupo tras espacios, es el índice.
      const saved = index;
      while (index < length && /\s/.test(source[index])) index += 1;
      if (source[index] === '[') {
        index += 1;
        const start = index;
        while (index < length && source[index] !== ']') index += 1;
        const root = latexToSpeech(source.slice(start, index));
        if (index < length) index += 1;
        const radicand = readArg();
        return `raíz ${root} de ${radicand}`;
      }
      index = saved;
      return `raíz cuadrada de ${readArg()}`;
    }
    if (command === 'binom' || command === 'dbinom' || command === 'tbinom') {
      const n = readArg();
      const k = readArg();
      return `combinación de ${n} en ${k}`;
    }
    if (command === 'pmod') return `módulo ${readArg()}`;
    if (command === 'mod') return 'módulo';
    if (command === 'textcolor' || command === 'colorbox') {
      readArg(); // color: no se lee
      return readArg();
    }
    if (DROP_ARG_COMMANDS.has(command)) {
      // Se consume el argumento (p. ej. \begin{env}, \color{red}, \label{x}).
      readArg();
      return '';
    }
    if (DROP_COMMANDS.has(command)) return '';
    if (ARG_COMMANDS.has(command)) return readArg();
    const prefix = PREFIX_COMMANDS[command];
    if (prefix) {
      const arg = readArg();
      return command === 'vec' ? `vector ${arg}` : `${arg} ${prefix}`;
    }
    const symbol = SYMBOLS[command];
    if (symbol) return symbol;
    // Comando desconocido: se lee su argumento si lo tiene; si no, se omite
    // para no leer código fuente literalmente.
    const saved = index;
    while (index < length && /\s/.test(source[index])) index += 1;
    if (source[index] === '{') return readGroup();
    index = saved;
    return '';
  };

  while (index < length) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      const command = readCommandName();
      if (!command) continue;
      const spoken = commandSpeech(command);
      if (spoken.trim()) pushWord(spoken);
      else if (spoken) pushRaw(spoken);
      continue;
    }
    if (char === '{') {
      pushWord(readGroup());
      continue;
    }
    if (char === '}') {
      index += 1;
      continue;
    }
    if (char === '^') {
      index += 1;
      const exponent = readArg();
      pushWord(exponent === '2' ? 'al cuadrado' : exponent === '3' ? 'al cubo' : `elevado a ${exponent}`);
      continue;
    }
    if (char === '_') {
      index += 1;
      pushWord(`subíndice ${readArg()}`);
      continue;
    }
    if (char === '$') {
      index += 1;
      continue;
    }
    if (char === '%') {
      pushWord('por ciento');
      index += 1;
      continue;
    }
    if (char === '&') {
      pushRaw(',');
      index += 1;
      continue;
    }
    if (char === '~') {
      pushRaw(' ');
      index += 1;
      continue;
    }
    if (char === "'") {
      pushWord('prima');
      index += 1;
      continue;
    }
    if (char === '!') {
      pushWord('factorial');
      index += 1;
      continue;
    }
    if (char === '|') {
      pushRaw(' ');
      index += 1;
      continue;
    }
    const unicode = UNICODE_SYMBOLS[char];
    if (unicode) {
      pushWord(unicode);
      index += 1;
      continue;
    }
    if (isLetter(char) || isDigit(char)) {
      pushRaw(char);
      index += 1;
      continue;
    }
    pushRaw(char);
    index += 1;
  }

  return output
    .join('')
    .replace(/\s+([,.;:!?%])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/** ¿El contenido entre `$…$` parece TeX y no moneda u otro uso del signo? */
function looksLikeTex(inner: string): boolean {
  if (!inner.trim()) return false;
  return /\\/.test(inner) || /[\^_{}]/.test(inner) || /%/.test(inner) || /[\p{Math_Symbol}]/u.test(inner);
}

export interface ConvertedText {
  text: string;
  /** Fronteras de caracteres hablados → originales (longitud text.length + 1). */
  offsetMap: number[];
}

/**
 * Convierte las fórmulas `$…$`, `$$…$$`, `\(…\)` y `\[…\]` de un texto plano
 * a español hablado. Devuelve `null` si no hay fórmulas (sin cambios).
 */
export function latexTextToSpeech(text: string): ConvertedText | null {
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let spoken = '';
  const offsetMap: number[] = [];
  let cursor = 0;
  let found = false;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(text)) !== null) {
    const inner = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    const isExplicit = match[1] !== undefined || match[2] !== undefined || match[3] !== undefined;
    if (!isExplicit && !looksLikeTex(inner)) continue;
    found = true;
    const plain = text.slice(cursor, match.index);
    spoken += plain;
    for (let i = 0; i < plain.length; i += 1) offsetMap.push(cursor + i);
    const speech = latexToSpeech(inner);
    const spanStart = match.index;
    const spanEnd = match.index + match[0].length;
    for (let i = 0; i < speech.length; i += 1) {
      offsetMap.push(spanStart + Math.floor((i * (spanEnd - spanStart)) / Math.max(1, speech.length)));
    }
    spoken += speech;
    cursor = match.index + match[0].length;
  }
  if (!found) return null;
  const tail = text.slice(cursor);
  spoken += tail;
  for (let i = 0; i < tail.length; i += 1) offsetMap.push(cursor + i);
  offsetMap.push(text.length);
  return { text: spoken, offsetMap };
}

/** Elemento del segmento DOM (si lo tiene) para no tocar bloques de código. */
interface SegmentWithElement extends SpeechSegment {
  element?: HTMLElement;
}

/**
 * Aplica la lectura de fórmulas a los segmentos de TTS:
 * - Segmentos del visor con `mathRanges` (KaTeX): reemplaza los glifos por
 *   la lectura en español conservando el mapa de offsets.
 * - Texto plano con `$…$` (Estudio TTS, PDF, selección): convierte los
 *   delimitadores. Los bloques de código (`pre`/`code`) no se tocan.
 */
export function applyMathSpeech(segments: SpeechSegment[]): SpeechSegment[] {
  return segments.map((segment) => {
    const ranges = segment.mathRanges;
    if (ranges?.length) {
      let spoken = '';
      const offsetMap: number[] = [];
      let cursor = 0;
      for (const range of ranges) {
        const plain = segment.text.slice(cursor, range.start);
        spoken += plain;
        for (let i = 0; i < plain.length; i += 1) offsetMap.push(cursor + i);
        const speech = range.spoken || segment.text.slice(range.start, range.end);
        for (let i = 0; i < speech.length; i += 1) {
          offsetMap.push(range.start + Math.floor((i * (range.end - range.start)) / Math.max(1, speech.length)));
        }
        spoken += speech;
        cursor = range.end;
      }
      const tail = segment.text.slice(cursor);
      spoken += tail;
      for (let i = 0; i < tail.length; i += 1) offsetMap.push(cursor + i);
      offsetMap.push(segment.text.length);
      return { ...segment, text: spoken, sourceText: segment.sourceText ?? segment.text, offsetMap };
    }
    const element = (segment as SegmentWithElement).element;
    if (element?.closest('pre, code')) return segment;
    const converted = latexTextToSpeech(segment.text);
    if (!converted) return segment;
    return { ...segment, text: converted.text, sourceText: segment.sourceText ?? segment.text, offsetMap: converted.offsetMap };
  });
}
