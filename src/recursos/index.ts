import { registre } from '../cleanup/neteja';

/**
 * Recursos incrustats (RF-20). Els binaris (loader i WASM de MediaPipe, models) van dins l'HTML
 * en base64 dins d'etiquetes `<script type="application/octet-stream" id="recurs-NOM">` (no
 * s'executen), amb gzip quan redueix la mida. `scripts/construeix.mjs` escriu també un manifest
 * JSON (`<script type="application/json" id="recursos-manifest">`) amb, per cada recurs, si està
 * comprimit i el SHA-256 dels bytes originals.
 */
export interface IRecursManifest {
  mime: string;
  /** Si el contingut base64 és un gzip que cal descomprimir amb DecompressionStream. */
  comprimit: boolean;
  /** SHA-256 (hex) dels bytes ORIGINALS (ja descomprimits). */
  sha256: string;
  /** Mida en bytes dels bytes originals. */
  mida: number;
}

export type ManifestRecursos = Record<string, IRecursManifest>;

export const ID_MANIFEST = 'recursos-manifest';
export const prefixId = 'recurs-';

export function llegeixManifest(doc: Document = document): ManifestRecursos {
  const el = doc.getElementById(ID_MANIFEST);
  if (!el) {
    throw new Error('Manifest de recursos no trobat');
  }
  return JSON.parse(el.textContent ?? '{}') as ManifestRecursos;
}

export function nomsRecursos(doc: Document = document): string[] {
  return Object.keys(llegeixManifest(doc));
}

export function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/** Descomprimeix gzip amb `DecompressionStream` (RF-17: és una funcionalitat imprescindible). */
export async function descomprimeixGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const escriptor = ds.writable.getWriter();
  // No s'espera l'escriptura abans de llegir: amb contrapressió es bloquejaria. Els errors
  // de dades corruptes surten per la banda de lectura.
  escriptor.write(bytes as unknown as BufferSource).catch(() => undefined);
  escriptor.close().catch(() => undefined);
  const lector = ds.readable.getReader();
  const trossos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) {
      break;
    }
    trossos.push(value);
    total += value.length;
  }
  const sortida = new Uint8Array(total);
  let pos = 0;
  trossos.forEach((tros) => {
    sortida.set(tros, pos);
    pos += tros.length;
  });
  return sortida;
}

// --- Memòria cau (RF-16: s'allibera en reiniciar o en tancar la pestanya) ---------------------
const bytesCau = new Map<string, Promise<Uint8Array>>();
const urlsCau = new Map<string, string>();
let registrat = false;

/** Allibera les URL `blob:` i els bytes descodificats (RF-16). Segur de cridar diverses vegades. */
export function alliberaRecursos(): void {
  urlsCau.forEach((url) => URL.revokeObjectURL(url));
  urlsCau.clear();
  bytesCau.clear();
  registrat = false;
}

/** Només les URL `blob:` (p. ex. quan MediaPipe ja ha carregat el loader i el WASM). */
export function revocaUrlsBlob(): void {
  urlsCau.forEach((url) => URL.revokeObjectURL(url));
  urlsCau.clear();
}

function asseguraRegistre(): void {
  if (!registrat) {
    registrat = true;
    registre.registraTasca(alliberaRecursos);
  }
}

/** Bytes originals (descodificats i, si cal, descomprimits) d'un recurs incrustat. */
export function obteRecurs(nom: string, doc: Document = document): Promise<Uint8Array> {
  const cau = bytesCau.get(nom);
  if (cau) {
    return cau;
  }
  const promesa = (async (): Promise<Uint8Array> => {
    const manifest = llegeixManifest(doc)[nom];
    const el = doc.getElementById(prefixId + nom);
    if (!manifest || !el) {
      throw new Error(`Recurs incrustat desconegut: ${nom}`);
    }
    const cru = base64ABytes(el.textContent ?? '');
    return manifest.comprimit ? descomprimeixGzip(cru) : cru;
  })();
  // Un error no es queda a la memòria cau: el següent intent ho tornarà a provar.
  promesa.catch(() => bytesCau.delete(nom));
  bytesCau.set(nom, promesa);
  asseguraRegistre();
  return promesa;
}

/**
 * URL `blob:` d'un recurs (memòria cau). S'allibera amb `revocaUrlsBlob()`/`alliberaRecursos()`,
 * i automàticament amb la neteja de memòria (RF-16).
 */
export async function obteUrlBlob(nom: string, mime: string, doc: Document = document): Promise<string> {
  const clau = `${nom}|${mime}`;
  const existent = urlsCau.get(clau);
  if (existent) {
    return existent;
  }
  const bytes = await obteRecurs(nom, doc);
  // Pot haver arribat una altra crida concurrent mentre s'esperava.
  const ambdues = urlsCau.get(clau);
  if (ambdues) {
    return ambdues;
  }
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: mime }));
  urlsCau.set(clau, url);
  asseguraRegistre();
  return url;
}
