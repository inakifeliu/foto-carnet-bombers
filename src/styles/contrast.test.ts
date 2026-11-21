/**
 * Identitat gràfica i contrast (spec §5 i §6): les parelles de colors de les variables de `brand.module.css`
 * compleixen WCAG AA, no hi ha colors escrits fora de les variables i es respecten les regles de la marca.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const css = fs.readFileSync(path.join(__dirname, 'brand.module.css'), 'utf8');

/** Bloc de variables (`.arrel { --x: ...; }`) i la resta del full d'estils. */
const blocArrel = /\.arrel\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
const restaCss = css.replace(blocArrel, '');

function variables(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const m of blocArrel.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) {
    v[m[1]] = m[2].trim();
  }
  return v;
}
const V = variables();

function llum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canals = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canals[0] + 0.7152 * canals[1] + 0.0722 * canals[2];
}

/** Relació de contrast WCAG 2.x entre dos colors `#rrggbb` de les variables. */
function contrast(a: string, b: string): number {
  const [clar, fosc] = [llum(V[a]), llum(V[b])].sort((x, y) => y - x);
  return (clar + 0.05) / (fosc + 0.05);
}

describe('Variables de color (§6)', () => {
  it('les variables de §6 existeixen amb els valors de la marca', () => {
    expect(V['--bcn-vermell']).toBe('#eb263c');
    expect(V['--bcn-vermell-text']).toBe('#c91f33');
    expect(V['--bcn-groc']).toBe('#fcb438');
    expect(V['--bcn-negre']).toBe('#000000');
    expect(V['--bcn-blanc']).toBe('#ffffff');
    expect(V['--color-text']).toBe('#1a1a1a');
    expect(V['--color-fons']).toBe('#ffffff');
    expect(V['--color-gris-suau']).toBe('#f2f2f2');
    expect(V['--color-ok']).toBe('#1e8e3e');
    expect(V['--color-avis']).toBe('#f29900');
    expect(V['--color-error']).toBe('#b3261e');
  });

  it('no hi ha cap color escrit fora de les variables (hex, rgb/rgba, hsl, noms de color)', () => {
    const sense = restaCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sense.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
    expect(sense.match(/\b(rgba?|hsla?)\(/gi)).toBeNull();
    expect(sense.match(/:\s*(white|black|red|yellow|green|blue|gr[ae]y|orange)\b/gi)).toBeNull();
  });

  it('el groc no es fa servir mai com a color de text', () => {
    expect(restaCss).not.toMatch(/(^|[^-])color:\s*var\(--bcn-groc\)/m);
    expect(restaCss).not.toMatch(/(^|[^-])color:\s*var\(--color-avis\)/m);
  });

  it('la pila de fonts és la de §6', () => {
    expect(V['--font-bombers']).toBe(
      "'ITC Franklin Gothic Std', 'Franklin Gothic Medium', 'Franklin Gothic', Arial, sans-serif"
    );
  });

  it('respecta prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});

describe('Contrast AA de les parelles de colors', () => {
  const TEXT_NORMAL: [string, string][] = [
    ['--color-text', '--color-fons'],
    ['--color-text', '--color-gris-suau'],
    ['--bcn-negre', '--color-fons'],
    ['--bcn-negre', '--color-gris-suau'],
    // Text vermell sobre blanc (etiquetes, accents) i botó primari amb el ratolí a sobre.
    ['--bcn-vermell-text', '--bcn-blanc'],
    ['--bcn-blanc', '--bcn-vermell-text'],
    // Missatges d'error i de «millor puntuació».
    ['--color-error', '--bcn-blanc'],
    ['--color-error', '--color-gris-suau'],
    ['--color-ok-text', '--bcn-blanc']
  ];

  it.each(TEXT_NORMAL)('text %s sobre %s: >= 4,5:1', (primer, fons) => {
    expect(contrast(primer, fons)).toBeGreaterThanOrEqual(4.5);
  });

  it('text blanc sobre el vermell de marca: només com a text gran (>= 3:1) i el botó primari és de 19 px en negreta', () => {
    expect(contrast('--bcn-blanc', '--bcn-vermell')).toBeGreaterThanOrEqual(3);
    // El valor real (4,31:1) no arriba a 4,5:1: per això és només per a text gran.
    expect(contrast('--bcn-blanc', '--bcn-vermell')).toBeLessThan(4.5);
    const primari =
      /\.botoPrimari\s*\{[^}]*?font-size:\s*(\d+)px;[^}]*?font-weight:\s*(\d+);[^}]*?background:\s*var\(--bcn-vermell\);/.exec(
        css
      );
    expect(primari).not.toBeNull();
    expect(Number(primari?.[1])).toBeGreaterThanOrEqual(19);
    expect(Number(primari?.[2])).toBeGreaterThanOrEqual(700);
  });

  it('el verd d’estat (--color-ok) no es fa servir com a color de text: per a text hi ha --color-ok-text', () => {
    expect(restaCss).not.toMatch(/(^|[^-])color:\s*var\(--color-ok\)/m);
  });

  const NO_TEXT: [string, string][] = [
    // Traços, vores i punts (>= 3:1 sobre blanc, WCAG 1.4.11). L'ambre només es fa servir en un punt que sempre
    // va acompanyat del text de l'estat, per això no hi és.
    ['--bcn-vermell', '--bcn-blanc'],
    ['--color-ok', '--bcn-blanc'],
    ['--color-error', '--bcn-blanc'],
    ['--color-gris-sense-dades', '--bcn-blanc'],
    ['--bcn-negre', '--bcn-blanc'],
    ['--bcn-negre', '--bcn-vermell']
  ];

  it.each(NO_TEXT)('element gràfic %s sobre %s: >= 3:1', (primer, fons) => {
    expect(contrast(primer, fons)).toBeGreaterThanOrEqual(3);
  });

  it('el focus (vora negra de 3 px) es veu sobre blanc, gris suau i vermell', () => {
    expect(restaCss).toMatch(/\.arrel :focus-visible\s*\{[^}]*outline:\s*3px solid var\(--bcn-negre\)/);
    for (const fons of ['--bcn-blanc', '--color-gris-suau', '--bcn-vermell']) {
      expect(contrast('--bcn-negre', fons)).toBeGreaterThanOrEqual(3);
    }
  });
});
