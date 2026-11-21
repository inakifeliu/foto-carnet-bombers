import { registre } from '../cleanup/neteja';
import type { ClauI18n } from '../i18n';

/** Una foto capturada: el canvas ja retallat (mida de sortida) i la URL blob de la seva miniatura. */
export interface IFoto {
  id: number;
  canvas: HTMLCanvasElement;
  /** URL `blob:` per mostrar la foto (miniatura); es revoca en alliberar-la (RF-16). */
  url: string;
  /** Puntuació de qualitat 0-100 calculada sobre el fotograma capturat (RF-05/RF-06); undefined si no hi havia anàlisi. */
  puntuacio?: number;
  /** Avisos de la foto (claus i18n), mostrats a P4. */
  avisos?: ClauI18n[];
}

let seguent = 1;

/** Crea la foto a partir d'un canvas retallat i en registra els recursos perquè la neteja (RF-16) els alliberi. */
export async function creaFoto(
  canvas: HTMLCanvasElement,
  meta: { puntuacio?: number; avisos?: ClauI18n[] } = {}
): Promise<IFoto> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('No s’ha pogut crear la miniatura');
  }
  const url = URL.createObjectURL(blob);
  registre.registraUrl(url);
  registre.registraCanvas(canvas);
  return { id: seguent++, canvas, url, puntuacio: meta.puntuacio, avisos: meta.avisos ?? [] };
}

/** Allibera els recursos d'una foto (RF-09/RF-16): revoca la URL i buida el canvas. */
export function alliberaFoto(foto: IFoto): void {
  try {
    URL.revokeObjectURL(foto.url);
  } catch {
    // Ja revocada o no disponible.
  }
  foto.canvas.width = 0;
  foto.canvas.height = 0;
}
