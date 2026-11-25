/** Càmera (RF-01): restriccions, mapatge d'errors a missatges en català i enumeració de dispositius. */
import type { ClauI18n } from '../i18n';

export type TipusErrorCamera = 'permis' | 'cap' | 'ocupada' | 'generic';

export const CLAU_ERROR_CAMERA: Record<TipusErrorCamera, ClauI18n> = {
  permis: 'p3.errorPermis',
  cap: 'p3.errorCap',
  ocupada: 'p3.errorOcupada',
  generic: 'p3.errorGeneric'
};

/** Resolució mínima recomanada (RF-01): per sota, avís no bloquejant. */
export const RESOLUCIO_MINIMA = { w: 1280, h: 720 };

function nomError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const nom = (error as { name: unknown }).name;
    return typeof nom === 'string' ? nom : '';
  }
  return '';
}

/**
 * Classifica un error de `getUserMedia`:
 * - NotAllowedError / SecurityError / PermissionDeniedError → permís denegat;
 * - NotFoundError / DevicesNotFoundError / OverconstrainedError → cap càmera;
 * - NotReadableError / TrackStartError / AbortError → càmera ocupada per una altra aplicació (Teams…);
 * - qualsevol altre → genèric.
 */
export function classificaErrorCamera(error: unknown): TipusErrorCamera {
  switch (nomError(error)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permis';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'cap';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'ocupada';
    default:
      return 'generic';
  }
}

/**
 * Restriccions de RF-01. Per defecte es demana la càmera **posterior** (`facingMode: { ideal: 'environment' }`): al mòbil
 * és la principal i la de més qualitat, i és preferible que la foto la faci una segona persona. És `ideal`, no `exact`:
 * en un ordinador amb una sola webcam s'obre igualment aquella. Amb `deviceId` s'obre aquella càmera concreta (sense
 * `facingMode`).
 */
export function restriccionsCamera(deviceId?: string): MediaStreamConstraints {
  const base = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  return {
    video: deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: { ideal: 'environment' } },
    audio: false
  };
}

/** true si la resolució real és inferior a 1280×720 (en qualsevol orientació, es compara el costat llarg i el curt). */
export function resolucioInsuficient(ample: number, alt: number): boolean {
  const llarg = Math.max(ample, alt);
  const curt = Math.min(ample, alt);
  return llarg < RESOLUCIO_MINIMA.w || curt < RESOLUCIO_MINIMA.h;
}

export interface ICamera {
  deviceId: string;
  etiqueta: string;
}

/** Llista les càmeres (cal haver obtingut el permís abans perquè hi hagi etiquetes). */
export async function llistaCameres(
  mediaDevices: Pick<MediaDevices, 'enumerateDevices'>,
  etiquetaPerDefecte: (n: number) => string
): Promise<ICamera[]> {
  const dispositius = await mediaDevices.enumerateDevices();
  return dispositius
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, etiqueta: d.label !== '' ? d.label : etiquetaPerDefecte(i + 1) }));
}

/** Atura totes les pistes d'un flux. */
export function aturaFlux(flux: MediaStream | undefined | null): void {
  flux?.getTracks().forEach((pista) => pista.stop());
}

/**
 * La visualització es mostra en mirall (com un mirall de bany) només amb una càmera frontal o desconeguda (webcam
 * d'ordinador). Amb la càmera posterior (`facingMode: 'environment'`) la persona que fa la foto veu l'escena tal com és.
 */
export function visualitzacioEnMirall(facingMode: string | undefined): boolean {
  return facingMode !== 'environment';
}
