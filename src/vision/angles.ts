import type { IMatriu } from './tipus';

export interface IAngles {
  /** Gir (graus). Positiu = el nas apunta cap a la DRETA de la imatge SENSE mirall (cap a l'esquerra de la persona). */
  yaw: number;
  /** Cabotada (graus). Positiu = el cap mira cap avall (barbeta cap al pit). */
  pitch: number;
  /** Inclinació (graus). Positiu = antihorari vist a la imatge sense mirall (el signe no es fa servir als missatges). */
  roll: number;
}

const RAD_A_GRAUS = 180 / Math.PI;

/**
 * Angles d'Euler a partir de la matriu de transformació facial de MediaPipe.
 *
 * CONVENCIÓ (a confirmar al Surface amb el mode diagnòstic, RF-18):
 *  - `data` és una matriu 4×4 en ORDRE DE COLUMNES: R[fila][columna] = data[columna * 4 + fila].
 *  - Espai de la càmera: x cap a la dreta de la imatge sense mirall, y cap amunt, z cap a l'observador;
 *    el davant de la cara és +z.
 *  - R = Ry(yaw) · Rx(pitch) · Rz(roll):
 *      pitch = asin(−R[1][2]),  yaw = atan2(R[0][2], R[2][2]),  roll = atan2(R[1][0], R[1][1]).
 *  - La matriu inclou escala (mètrica): se'n normalitza cada columna abans de calcular res.
 *
 * Retorna `undefined` si la matriu no és 4×4 o té valors no finits o columnes nul·les.
 */
export function anglesDeMatriu(matriu: IMatriu | undefined): IAngles | undefined {
  if (!matriu || matriu.rows !== 4 || matriu.columns !== 4 || matriu.data.length < 16) {
    return undefined;
  }
  const d = matriu.data;
  const r = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let col = 0; col < 3; col++) {
    const x = d[col * 4];
    const y = d[col * 4 + 1];
    const z = d[col * 4 + 2];
    const norma = Math.hypot(x, y, z);
    if (!isFinite(norma) || norma === 0) {
      return undefined;
    }
    r[0][col] = x / norma;
    r[1][col] = y / norma;
    r[2][col] = z / norma;
  }
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r[1][2]))) * RAD_A_GRAUS;
  const yaw = Math.atan2(r[0][2], r[2][2]) * RAD_A_GRAUS;
  const roll = Math.atan2(r[1][0], r[1][1]) * RAD_A_GRAUS;
  return { yaw, pitch, roll };
}
