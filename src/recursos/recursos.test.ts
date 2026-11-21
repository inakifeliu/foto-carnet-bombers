import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { registre } from '../cleanup/neteja';
import { verificaRecursos } from './autoverificacio';
import {
  alliberaRecursos,
  base64ABytes,
  descomprimeixGzip,
  llegeixManifest,
  nomsRecursos,
  obteRecurs,
  obteUrlBlob
} from './index';

const sha = (b: Buffer): string => crypto.createHash('sha256').update(b).digest('hex');

// Contingut de prova: un de compressible (gzip) i un altre cru.
const TEXT = Buffer.from('foto carnet '.repeat(500));
const CRU = Buffer.from([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
// Mòdul WASM buit però vàlid (capçalera + versió).
const WASM = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

function muntaDocument(trencat = false): Document {
  const manifest = {
    text: { mime: 'text/javascript', comprimit: true, sha256: sha(TEXT), mida: TEXT.length },
    cru: { mime: 'application/octet-stream', comprimit: false, sha256: sha(CRU), mida: CRU.length },
    wasm: { mime: 'application/wasm', comprimit: false, sha256: sha(WASM), mida: WASM.length }
  };
  if (trencat) {
    manifest.cru.sha256 = '0'.repeat(64);
  }
  document.body.innerHTML = '';
  const afegeix = (id: string, tipus: string, text: string): void => {
    const s = document.createElement('script');
    s.type = tipus;
    s.id = id;
    s.textContent = text;
    document.body.appendChild(s);
  };
  afegeix('recursos-manifest', 'application/json', JSON.stringify(manifest));
  afegeix('recurs-text', 'application/octet-stream', zlib.gzipSync(TEXT, { level: 9 }).toString('base64'));
  afegeix('recurs-cru', 'application/octet-stream', CRU.toString('base64'));
  afegeix('recurs-wasm', 'application/octet-stream', WASM.toString('base64'));
  return document;
}

describe('recursos incrustats (RF-20)', () => {
  beforeEach(() => {
    alliberaRecursos();
    registre.neteja();
  });

  it('llegeix el manifest i en llista els noms', () => {
    muntaDocument();
    expect(nomsRecursos().sort()).toEqual(['cru', 'text', 'wasm']);
    expect(llegeixManifest().text.comprimit).toBe(true);
  });

  it('base64 -> bytes', () => {
    expect(Buffer.from(base64ABytes(CRU.toString('base64')))).toEqual(CRU);
    expect(Buffer.from(base64ABytes('AAEC\nAw=='))).toEqual(Buffer.from([0, 1, 2, 3]));
  });

  it('descomprimeix gzip amb DecompressionStream', async () => {
    const r = await descomprimeixGzip(zlib.gzipSync(TEXT));
    expect(Buffer.from(r).equals(TEXT)).toBe(true);
    await expect(descomprimeixGzip(Buffer.from('això no és gzip'))).rejects.toBeDefined();
  });

  it('obteRecurs descodifica un recurs comprimit (gzip) i un de cru', async () => {
    muntaDocument();
    expect(Buffer.from(await obteRecurs('text')).equals(TEXT)).toBe(true);
    expect(Buffer.from(await obteRecurs('cru')).equals(CRU)).toBe(true);
  });

  it("obteRecurs falla amb un recurs desconegut i no deixa l'error a la memòria cau", async () => {
    muntaDocument();
    await expect(obteRecurs('no-existeix')).rejects.toThrow(/desconegut/);
    await expect(obteRecurs('no-existeix')).rejects.toThrow(/desconegut/);
  });

  it('obteUrlBlob crea una URL blob: una sola vegada (memòria cau) i la revoca en la neteja (RF-16)', async () => {
    muntaDocument();
    const crea = jest.fn(() => 'blob:prova-1');
    const revoca = jest.fn();
    Object.assign(URL, { createObjectURL: crea, revokeObjectURL: revoca });
    const a = await obteUrlBlob('wasm', 'application/wasm');
    const b = await obteUrlBlob('wasm', 'application/wasm');
    expect(a).toBe('blob:prova-1');
    expect(b).toBe(a);
    expect(crea).toHaveBeenCalledTimes(1);
    const blob = (crea.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('application/wasm');
    expect(blob.size).toBe(WASM.length);

    registre.neteja(); // pagehide / «Començar de nou»
    expect(revoca).toHaveBeenCalledWith('blob:prova-1');
    // Després de la neteja se'n torna a crear una de nova.
    await obteUrlBlob('wasm', 'application/wasm');
    expect(crea).toHaveBeenCalledTimes(2);
  });

  it("l'autoverificació valida mida, SHA-256 i el WASM", async () => {
    muntaDocument();
    const r = await verificaRecursos();
    expect(r.map((x) => [x.nom, x.ok])).toEqual([
      ['text', true],
      ['cru', true],
      ['wasm', true]
    ]);
    expect(r.find((x) => x.nom === 'text')?.comprimit).toBe(true);
  });

  it("l'autoverificació detecta un SHA-256 que no coincideix", async () => {
    muntaDocument(true);
    const r = await verificaRecursos();
    expect(r.find((x) => x.nom === 'cru')).toMatchObject({ ok: false, motiu: 'SHA-256 diferent' });
  });
});
