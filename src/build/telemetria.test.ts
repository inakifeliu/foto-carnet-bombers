import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

// Els tests s'executen amb el directori de treball a l'arrel del projecte.
const ARREL = process.cwd();
const MEDIAPIPE = path.join(ARREL, 'node_modules/@mediapipe/tasks-vision');
const ASSETS_WASM = path.join(ARREL, 'src/assets/wasm');

type Pegat = { aplica: (codi: string) => string };
type Guarda = {
  sha256: (b: Buffer) => string;
  verifica: (html: string, opcions?: { hostsExtra?: string[]; hashLoaderWasm?: string }) => string[];
};

const sha = (fitxer: string): string => crypto.createHash('sha256').update(fs.readFileSync(fitxer)).digest('hex');

/** HTML mínim amb manifest i un recurs de text (loader fictici) per provar la guarda. */
function htmlAmb(js: string, recursText = 'var a=1;'): string {
  const bytes = Buffer.from(recursText);
  const manifest = {
    'wasm-loader': {
      mime: 'text/javascript',
      comprimit: false,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      mida: bytes.length
    }
  };
  return (
    '<!doctype html><html><head></head><body><div id="arrel"></div>' +
    `<script type="application/json" id="recursos-manifest">${JSON.stringify(manifest)}</script>` +
    `<script type="application/octet-stream" id="recurs-wasm-loader">${bytes.toString('base64')}</script>` +
    `<script>${js}</script></body></html>`
  );
}

const importaScript = (nom: string): Promise<unknown> => import(pathToFileURL(path.join(ARREL, 'scripts', nom)).href);

describe('pegat que neutralitza la telemetria de MediaPipe', () => {
  let pegat: Pegat;
  beforeAll(async () => {
    pegat = (await importaScript('mediapipe-sense-telemetria.mjs')) as Pegat;
  });

  ['vision_bundle.mjs', 'vision_bundle.cjs', 'vision_bundle.js'].forEach((nom) => {
    it(`${nom}: sense URL de telemetria, sense interval i amb flush buit`, () => {
      const original = fs.readFileSync(path.join(MEDIAPIPE, nom), 'utf8');
      // Prerequisit: el bundle original conté la telemetria (si no, aquest test no demostra res).
      expect(original).toContain('odml.pa.googleapis.com/v1/log');
      expect(original).toContain('setInterval(()=>{this.flush()},6e4)');

      const patch = pegat.aplica(original);
      expect(patch).not.toContain('odml.pa.googleapis.com');
      expect(patch).not.toContain('/v1/log');
      expect(patch).not.toContain('setInterval(()=>{this.flush()}');
      expect(patch).toContain('flush(t,e){return void(t&&t())}');
      // L'única aparició restant de "googleapis" és el typeUrl de protobuf (no és cap petició).
      const restants = patch.match(/.{0,20}googleapis.{0,20}/g) ?? [];
      restants.forEach((r) => expect(r).toContain('type.googleapis.com/'));
    });
  });

  it('falla en alt si el codi no conté el patró (p. ex. nova versió de MediaPipe)', () => {
    expect(() => pegat.aplica('var x = 1;')).toThrow(/no s'ha pogut neutralitzar/);
  });
});

describe("guarda de l'HTML (verifica-html.mjs)", () => {
  let guarda: Guarda;
  beforeAll(async () => {
    guarda = (await importaScript('verifica-html.mjs')) as Guarda;
  });

  const sensePegat =
    'xh=class{constructor(t){this.h=setInterval(()=>{this.flush()},6e4)}};u="https://odml.pa.googleapis.com/v1/log"';

  it('falla amb un bundle sense neutralitzar', () => {
    const problemes = guarda.verifica(htmlAmb(sensePegat));
    expect(problemes.length).toBeGreaterThan(0);
    expect(problemes.join('\n')).toContain('googleapis');
    expect(problemes.join('\n')).toContain('odml.');
  });

  it("passa amb el bundle de MediaPipe neutralitzat i falla amb l'original", async () => {
    const pegat = (await importaScript('mediapipe-sense-telemetria.mjs')) as Pegat;
    const original = fs.readFileSync(path.join(MEDIAPIPE, 'vision_bundle.mjs'), 'utf8');
    expect(guarda.verifica(htmlAmb(pegat.aplica(original)))).toEqual([]);
    expect(guarda.verifica(htmlAmb(original)).length).toBeGreaterThan(0);
  });

  it('detecta hosts externs i google-analytics, i permet els de la llista', () => {
    expect(guarda.verifica(htmlAmb('x="https://cdn.exemple.com/a.js"')).join()).toContain('cdn.exemple.com');
    expect(guarda.verifica(htmlAmb('x="https://www.google-analytics.com/c"')).length).toBeGreaterThan(0);
    expect(guarda.verifica(htmlAmb('x="http://www.w3.org/2000/svg"'))).toEqual([]);
    expect(guarda.verifica(htmlAmb('x="https://forms.exemple.cat/r"')).length).toBeGreaterThan(0);
    expect(guarda.verifica(htmlAmb('x="https://forms.exemple.cat/r"'), { hostsExtra: ['forms.exemple.cat'] })).toEqual(
      []
    );
  });

  it('detecta recursos externs (<script src>, <link href>)', () => {
    const base = htmlAmb('');
    expect(guarda.verifica(base.replace('<script>', '<script src="a.js">')).join()).toContain('<script src');
    expect(guarda.verifica(base.replace('</head>', '<link rel="stylesheet" href="a.css"></head>')).join()).toContain(
      '<link href'
    );
  });

  it('inspecciona els logos SVG (data:) com a text', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
    expect(guarda.verifica(htmlAmb(`x="data:image/svg+xml;base64,${svg}"`))).toEqual([]);
    const dolent = Buffer.from('<svg><image href="https://tercer.com/a.png"/></svg>').toString('base64');
    expect(guarda.verifica(htmlAmb(`x="data:image/svg+xml;base64,${dolent}"`)).join()).toContain('tercer.com');
  });

  it('detecta un recurs incrustat que no coincideix amb el manifest (SHA-256)', () => {
    const html = htmlAmb('').replace(
      Buffer.from('var a=1;').toString('base64'),
      Buffer.from('var b=2;').toString('base64')
    );
    expect(guarda.verifica(html).join()).toContain('no coincideix amb el manifest');
  });

  it('ignora els binaris (cadenes internes del WASM) i exclou del text els payloads base64', () => {
    const wasmFals = Buffer.from('odml.infra.proto googleapis https://tercer.com');
    const manifest = {
      wasm: {
        mime: 'application/wasm',
        comprimit: false,
        sha256: crypto.createHash('sha256').update(wasmFals).digest('hex'),
        mida: wasmFals.length
      }
    };
    const html =
      `<script type="application/json" id="recursos-manifest">${JSON.stringify(manifest)}</script>` +
      `<script type="application/octet-stream" id="recurs-wasm">${wasmFals.toString('base64')}</script>`;
    expect(guarda.verifica(html)).toEqual([]);
  });

  it('exempta de la comprovació de URL només els comentaris del loader WASM identificat per hash', () => {
    const loader = '// vegeu https://github.com/x\nvar a=1;/* https://developer.mozilla.org */';
    const hash = guarda.sha256(Buffer.from(loader));
    expect(guarda.verifica(htmlAmb('', loader), { hashLoaderWasm: hash })).toEqual([]);
    expect(guarda.verifica(htmlAmb('', loader)).length).toBeGreaterThan(0);
    const ambUrlReal = 'fetch("https://tercer.com/x")';
    expect(
      guarda.verifica(htmlAmb('', ambUrlReal), { hashLoaderWasm: guarda.sha256(Buffer.from(ambUrlReal)) }).join()
    ).toContain('tercer.com');
  });
});

describe('recursos WASM locals', () => {
  it('el loader i el binari WASM coincideixen (SHA-256) amb els de @mediapipe/tasks-vision', () => {
    // La telemetria és a vision_bundle.mjs (parxejat en compilar); el loader i el binari WASM
    // es copien sense modificar.
    ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'].forEach((nom) => {
      expect(sha(path.join(ASSETS_WASM, nom))).toBe(sha(path.join(MEDIAPIPE, 'wasm', nom)));
    });
  });

  it('no hi ha còpies sobrants (variants module) a assets/wasm', () => {
    expect(fs.readdirSync(ASSETS_WASM).sort()).toEqual(['vision_wasm_internal.js', 'vision_wasm_internal.wasm']);
  });
});
