/**
 * Desat de la foto (RF-10, RF-11). `showSaveFilePicker` s'obre DINS el clic, abans de qualsevol `await`
 * de codificació (per no perdre l'activació d'usuari); després es codifica i s'escriu amb `createWritable()`.
 * Si no existeix o dona `SecurityError`, es fa una baixada (`<a download>`, carpeta Baixades).
 */
import { nomFitxer } from '../app/formulari';
import type { ClauI18n } from '../i18n';
import { escriuJfif } from './jfif';

export type DestiDesat = 'imatges' | 'baixades';

/** Clau de i18n del nom de la carpeta on s'ha desat la foto (P6 i P7). */
export function clauCarpeta(desti: DestiDesat): ClauI18n {
  return desti === 'baixades' ? 'carpeta.baixades' : 'carpeta.imatges';
}

interface IEscriptor {
  write: (dades: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
}

/** Part del `FileSystemFileHandle` que fem servir (els tipus del DOM de TS no el porten tot). */
export interface IHandleFitxer {
  /** Nom real del fitxer desat (l'usuari pot haver-lo canviat al diàleg). */
  name?: string;
  /** `FileSystemFileHandle.remove()`: només en alguns navegadors (RF-15). */
  remove?: () => Promise<void>;
  queryPermission?: (opcions: { mode: 'readwrite' }) => Promise<string>;
  requestPermission?: (opcions: { mode: 'readwrite' }) => Promise<string>;
  createWritable: () => Promise<IEscriptor>;
}

export interface IOpcionsSelector {
  suggestedName: string;
  startIn: 'pictures';
  types: { description: string; accept: Record<string, string[]> }[];
}

export interface IEntornDesat {
  showSaveFilePicker?: (opcions: IOpcionsSelector) => Promise<IHandleFitxer>;
  /** Baixada via `<a download>`. */
  baixa: (blob: Blob, nom: string) => void;
}

export type ResultatDesat =
  | { tipus: 'ok'; desti: DestiDesat; handle?: IHandleFitxer; nom?: string }
  | { tipus: 'cancelat' }
  | { tipus: 'error'; error: unknown };

/** Deixa constància a la consola (diagnòstic al Surface o a l'equip de parc) del motiu pel qual no s'ha desat. */
function registraError(pas: string, error: unknown): void {
  const missatge = error instanceof Error ? error.message : String(error);
  console.warn(`[desar] ${pas}: ${nomError(error) || 'Error'}: ${missatge}`);
}

function nomError(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : '';
}

/** Baixada real amb un enllaç temporal; la URL es revoca poc després. */
export function baixaAmbEnllac(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function entornDesatActual(): IEntornDesat {
  const w = window as unknown as { showSaveFilePicker?: IEntornDesat['showSaveFilePicker'] };
  return {
    showSaveFilePicker: typeof w.showSaveFilePicker === 'function' ? w.showSaveFilePicker.bind(window) : undefined,
    baixa: baixaAmbEnllac
  };
}

/**
 * Desa el fitxer `{matricula}.jpg`. IMPORTANT: s'ha de cridar directament des del gestor del clic i sense cap
 * `await` abans (el selector s'obre de manera síncrona en aquesta crida).
 *
 * @param genera produeix els bytes del JPEG final (codificació); s'executa DESPRÉS d'obrir el diàleg.
 */
export async function desaFitxer(
  matricula: string,
  genera: () => Promise<Blob>,
  entorn: IEntornDesat = entornDesatActual()
): Promise<ResultatDesat> {
  const nom = nomFitxer(matricula);
  let handle: IHandleFitxer | undefined;

  if (entorn.showSaveFilePicker) {
    try {
      // Cap `await` previ: el diàleg s'obre dins l'activació d'usuari del clic.
      handle = await entorn.showSaveFilePicker({
        suggestedName: nom,
        startIn: 'pictures',
        types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }]
      });
    } catch (error) {
      registraError('selector', error);
      const n = nomError(error);
      if (n === 'AbortError') {
        return { tipus: 'cancelat' };
      }
      if (n !== 'SecurityError') {
        return { tipus: 'error', error };
      }
      handle = undefined; // SecurityError: es continua amb la baixada
    }
  }

  let blob: Blob;
  try {
    blob = await genera();
  } catch (error) {
    registraError('codificació', error);
    return { tipus: 'error', error };
  }

  if (handle) {
    let escriptor: IEscriptor | undefined;
    try {
      escriptor = await handle.createWritable();
      await escriptor.write(blob);
      await escriptor.close();
      return { tipus: 'ok', desti: 'imatges', handle, nom: typeof handle.name === 'string' ? handle.name : undefined };
    } catch (error) {
      registraError('escriptura', error);
      try {
        await escriptor?.abort?.();
      } catch {
        // Res més a fer: l'error original és el que importa.
      }
      return { tipus: 'error', error };
    }
  }

  try {
    entorn.baixa(blob, nom);
    return { tipus: 'ok', desti: 'baixades' };
  } catch (error) {
    registraError('baixada', error);
    return { tipus: 'error', error };
  }
}

/** Codifica el canvas ja retallat a JPEG (qualitat configurada) i hi escriu la capçalera JFIF amb la densitat (RF-08). */
export async function codificaJpeg(canvas: HTMLCanvasElement, qualitat: number, ppp: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualitat));
  if (!blob) {
    throw new Error('No s’ha pogut codificar la imatge');
  }
  const bytes = escriuJfif(new Uint8Array(await blob.arrayBuffer()), ppp);
  return new Blob([bytes as BlobPart], { type: 'image/jpeg' });
}

export type ResultatEsborrat = 'ok' | 'permisDenegat' | 'noSuportat' | 'error';

/** Indica si el handle permet esborrar el fitxer (RF-15): hi ha `remove()`. */
export function potEsborrar(handle: IHandleFitxer | undefined): boolean {
  return handle !== undefined && typeof handle.remove === 'function';
}

/**
 * Esborra el fitxer desat (RF-15, millor esforç). S'ha de cridar des del gestor d'un clic: si cal, demana el permís
 * `readwrite` (`queryPermission`/`requestPermission`) i després crida `remove()`.
 */
export async function esborraFitxerDesat(handle: IHandleFitxer | undefined): Promise<ResultatEsborrat> {
  if (!handle || typeof handle.remove !== 'function') {
    return 'noSuportat';
  }
  try {
    const opcions = { mode: 'readwrite' } as const;
    let permis = typeof handle.queryPermission === 'function' ? await handle.queryPermission(opcions) : 'granted';
    if (permis !== 'granted' && typeof handle.requestPermission === 'function') {
      permis = await handle.requestPermission(opcions);
    }
    if (permis !== 'granted') {
      return 'permisDenegat';
    }
    await handle.remove();
    return 'ok';
  } catch {
    return 'error';
  }
}

/** FileSystemFileHandle del fitxer desat, només en memòria (per a l'esborrat opcional de RF-15). */
let handleDesat: IHandleFitxer | undefined;

export function recordaHandleDesat(handle: IHandleFitxer | undefined): void {
  handleDesat = handle;
}

export function obteHandleDesat(): IHandleFitxer | undefined {
  return handleDesat;
}

export function oblidaHandleDesat(): void {
  handleDesat = undefined;
}
