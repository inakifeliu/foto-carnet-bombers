/** Funcions de color i llum (RF-05). Els canals RGB van de 0 a 255. */

/** Luminància (Rec. 709) sobre valors sRGB, de 0 a 255. */
export function lluminancia(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface IHsv {
  /** To en graus [0, 360). */
  h: number;
  /** Saturació [0, 1]. */
  s: number;
  /** Valor [0, 1]. */
  v: number;
}

export function rgbAHsv(r: number, g: number, b: number): IHsv {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}
