/// <reference types="node" />
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Els tests s'executen amb el directori de treball a l'arrel del projecte.
const ARREL = process.cwd();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loader = require(path.join(ARREL, 'config/mediapipe-sense-telemetria.js')) as {
  aplica: (codi: string) => string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const guarda = require(path.join(ARREL, 'scripts/verifica-paquet.js')) as {
  verifica: (entrades: { nom: string; dades: Buffer }[], hashLoader?: string) => string[];
  sha256: (b: Buffer) => string;
};

const MEDIAPIPE = path.join(ARREL, 'node_modules/@mediapipe/tasks-vision');
const ASSETS_WASM = path.join(ARREL, 'src/webparts/fotoCarnet/assets/wasm');

const sha = (fitxer: string): string => crypto.createHash('sha256').update(fs.readFileSync(fitxer)).digest('hex');
const entrada = (nom: string, text: string): { nom: string; dades: Buffer } => ({ nom, dades: Buffer.from(text) });

describe('loader que neutralitza la telemetria de MediaPipe', () => {
  ['vision_bundle.mjs', 'vision_bundle.cjs', 'vision_bundle.js'].forEach((nom) => {
    it(`${nom}: sense URL de telemetria, sense interval i amb flush buit`, () => {
      const original = fs.readFileSync(path.join(MEDIAPIPE, nom), 'utf8');
      // Prerequisit: el bundle original conté la telemetria (si no, aquest test no demostra res).
      expect(original).toContain('odml.pa.googleapis.com/v1/log');
      expect(original).toContain('setInterval(()=>{this.flush()},6e4)');

      const patch = loader.aplica(original);
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
    expect(() => loader.aplica('var x = 1;')).toThrow(/no s'ha pogut neutralitzar/);
  });
});

describe('guarda del paquet (verifica-paquet.js)', () => {
  const sensePatch =
    'xh=class{constructor(t){this.h=setInterval(()=>{this.flush()},6e4)}};u="https://odml.pa.googleapis.com/v1/log"';

  it('falla amb un bundle sense neutralitzar', () => {
    const problemes = guarda.verifica([entrada('ClientSideAssets/web.js', sensePatch)]);
    expect(problemes.length).toBeGreaterThan(0);
    expect(problemes.join('\n')).toContain('googleapis');
    expect(problemes.join('\n')).toContain('odml.');
  });

  it('passa amb el bundle neutralitzat pel loader', () => {
    const original = fs.readFileSync(path.join(MEDIAPIPE, 'vision_bundle.mjs'), 'utf8');
    expect(guarda.verifica([entrada('ClientSideAssets/web.js', loader.aplica(original))])).toEqual([]);
    expect(guarda.verifica([entrada('ClientSideAssets/web.js', original)]).length).toBeGreaterThan(0);
  });

  it('detecta hosts externs i google-analytics, i permet els de la llista', () => {
    expect(guarda.verifica([entrada('a.js', 'x="https://cdn.exemple.com/a.js"')]).join()).toContain('cdn.exemple.com');
    expect(guarda.verifica([entrada('a.js', 'x="https://www.google-analytics.com/c"')]).length).toBeGreaterThan(0);
    expect(guarda.verifica([entrada('a.xml', '<a xmlns="http://www.w3.org/2000/svg"/>')])).toEqual([]);
  });

  it('ignora els binaris (cadenes internes del WASM)', () => {
    expect(guarda.verifica([{ nom: 'a.wasm', dades: Buffer.from('odml.infra.proto googleapis') }])).toEqual([]);
  });

  it('exempta de la comprovació de URL només els comentaris del loader WASM identificat per hash', () => {
    const loaderWasm = Buffer.from('// vegeu https://github.com/x\nvar a=1;/* https://developer.mozilla.org */');
    const hash = guarda.sha256(loaderWasm);
    expect(guarda.verifica([{ nom: 'l.js', dades: loaderWasm }], hash)).toEqual([]);
    expect(guarda.verifica([{ nom: 'l.js', dades: loaderWasm }]).length).toBeGreaterThan(0);
    const ambUrlReal = Buffer.from('fetch("https://tercer.com/x")');
    expect(guarda.verifica([{ nom: 'l.js', dades: ambUrlReal }], guarda.sha256(ambUrlReal)).join()).toContain(
      'tercer.com'
    );
  });
});

describe('recursos WASM locals', () => {
  it('el loader i el binari WASM coincideixen (SHA-256) amb els de @mediapipe/tasks-vision', () => {
    // La telemetria és a vision_bundle.mjs (parxejat pel loader de Webpack); el loader i el
    // binari WASM es copien sense modificar.
    ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'].forEach((nom) => {
      expect(sha(path.join(ASSETS_WASM, nom))).toBe(sha(path.join(MEDIAPIPE, 'wasm', nom)));
    });
  });

  it('no hi ha còpies sobrants (variants module) a assets/wasm', () => {
    expect(fs.readdirSync(ASSETS_WASM).sort()).toEqual(['vision_wasm_internal.js', 'vision_wasm_internal.wasm']);
  });
});
