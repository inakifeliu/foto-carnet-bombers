import { llegeixManifest, obteRecurs } from './index';

export interface IResultatRecurs {
  nom: string;
  ok: boolean;
  /** Mida en bytes dels bytes descodificats. */
  mida: number;
  comprimit: boolean;
  motiu?: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string | undefined> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) {
    return undefined;
  }
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Autoverificació dels recursos incrustats: els descodifica (i descomprimeix) tots i comprova la
 * mida i el SHA-256 contra el manifest; els binaris WASM es validen amb `WebAssembly.validate`.
 * Només es crida des del mode diagnòstic (RF-18); no té efectes laterals.
 */
export async function verificaRecursos(doc: Document = document): Promise<IResultatRecurs[]> {
  const manifest = llegeixManifest(doc);
  const resultats: IResultatRecurs[] = [];
  for (const nom of Object.keys(manifest)) {
    const m = manifest[nom];
    try {
      const bytes = await obteRecurs(nom, doc);
      if (bytes.length !== m.mida) {
        resultats.push({ nom, ok: false, mida: bytes.length, comprimit: m.comprimit, motiu: 'mida diferent' });
        continue;
      }
      const hash = await sha256Hex(bytes);
      if (hash !== undefined && hash !== m.sha256) {
        resultats.push({ nom, ok: false, mida: bytes.length, comprimit: m.comprimit, motiu: 'SHA-256 diferent' });
        continue;
      }
      if (m.mime === 'application/wasm' && !WebAssembly.validate(bytes as unknown as BufferSource)) {
        resultats.push({ nom, ok: false, mida: bytes.length, comprimit: m.comprimit, motiu: 'WASM no vàlid' });
        continue;
      }
      resultats.push({ nom, ok: true, mida: bytes.length, comprimit: m.comprimit });
    } catch (e) {
      resultats.push({
        nom,
        ok: false,
        mida: 0,
        comprimit: m.comprimit,
        motiu: e instanceof Error ? e.message : String(e)
      });
    }
  }
  return resultats;
}
