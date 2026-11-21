/**
 * Capçalera JFIF (RF-08): escriu la densitat (unitats = 1, ppp) perquè la foto s'imprimeixi a 35 × 45 mm
 * i elimina qualsevol metadada EXIF/XMP (segments APP1). Funcions pures sobre bytes.
 */
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;

/** "JFIF\0" */
const IDENT_JFIF = [0x4a, 0x46, 0x49, 0x46, 0x00];

/** Construeix el segment APP0 JFIF 1.01 sense miniatura, amb densitat en ppp (unitats = 1). */
export function construeixApp0(ppp: number): Uint8Array {
  return new Uint8Array([
    0xff,
    APP0,
    0x00,
    0x10, // longitud 16 (sense comptar el marcador)
    ...IDENT_JFIF,
    0x01,
    0x01, // versió 1.01
    0x01, // unitats: punts per polzada
    (ppp >> 8) & 0xff,
    ppp & 0xff, // X
    (ppp >> 8) & 0xff,
    ppp & 0xff, // Y
    0x00,
    0x00 // sense miniatura
  ]);
}

function esJfif(jpeg: Uint8Array, inici: number, longitud: number): boolean {
  // marcador (2) + longitud (2) + identificador (5)
  if (longitud < 7) {
    return false;
  }
  return IDENT_JFIF.every((b, i) => jpeg[inici + 4 + i] === b);
}

/**
 * Retorna una còpia del JPEG amb un únic APP0 JFIF just després del SOI (X = Y = `ppp`, unitats = 1) i sense
 * cap segment APP1 (EXIF, XMP). Si ja hi havia un APP0 JFIF, es reemplaça; la resta de segments (i les dades
 * d'imatge) es copien sense canvis.
 *
 * @throws Error si l'entrada no és un JPEG (no comença per FF D8), és truncada o `ppp` no és un enter 1–65535.
 */
export function escriuJfif(jpeg: Uint8Array, ppp: number): Uint8Array {
  if (!Number.isInteger(ppp) || ppp < 1 || ppp > 0xffff) {
    throw new Error('Densitat (ppp) no vàlida: ' + String(ppp));
  }
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== SOI) {
    throw new Error('No és un JPEG: no comença per FF D8');
  }

  const segments: Uint8Array[] = [];
  let pos = 2;
  let trobatSos = false;
  while (pos < jpeg.length) {
    if (jpeg[pos] !== 0xff) {
      throw new Error('JPEG malformat: s’esperava un marcador a la posició ' + pos);
    }
    // Els bytes de farciment FF abans d'un marcador són vàlids.
    let marcador = jpeg[pos + 1];
    let inici = pos;
    while (marcador === 0xff && inici + 2 < jpeg.length) {
      inici++;
      marcador = jpeg[inici + 1];
    }
    if (marcador === undefined) {
      throw new Error('JPEG truncat');
    }
    if (marcador === SOS) {
      // A partir d'aquí hi ha les dades entropicodificades: es copia tot fins al final.
      segments.push(jpeg.subarray(inici));
      trobatSos = true;
      break;
    }
    if (marcador === EOI) {
      throw new Error('JPEG sense dades d’imatge (SOS)');
    }
    // Marcadors sense longitud (TEM 0x01, RSTn D0–D7): només ocupen 2 bytes. No haurien d'aparèixer abans del SOS,
    // però si hi són es copien tal qual i es continua (llegir-ne la «longitud» desquadraria tot el fitxer).
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      segments.push(jpeg.subarray(inici, inici + 2));
      pos = inici + 2;
      continue;
    }
    if (inici + 4 > jpeg.length) {
      throw new Error('JPEG truncat');
    }
    const longitud = (jpeg[inici + 2] << 8) | jpeg[inici + 3];
    const fi = inici + 2 + longitud;
    if (longitud < 2 || fi > jpeg.length) {
      throw new Error('JPEG truncat: segment fora dels límits');
    }
    const descarta = marcador === APP1 || (marcador === APP0 && esJfif(jpeg, inici, longitud));
    if (!descarta) {
      segments.push(jpeg.subarray(inici, fi));
    }
    pos = fi;
  }
  if (!trobatSos) {
    throw new Error('JPEG sense dades d’imatge (SOS)');
  }

  const app0 = construeixApp0(ppp);
  const total = 2 + app0.length + segments.reduce((suma, s) => suma + s.length, 0);
  const sortida = new Uint8Array(total);
  sortida[0] = 0xff;
  sortida[1] = SOI;
  sortida.set(app0, 2);
  let off = 2 + app0.length;
  for (const s of segments) {
    sortida.set(s, off);
    off += s.length;
  }
  return sortida;
}

export interface IDensitatJfif {
  unitats: number;
  x: number;
  y: number;
}

/** Llegeix la densitat de l'APP0 JFIF si és el primer segment; undefined si no n'hi ha. (Per a proves i diagnòstic.) */
export function llegeixDensitatJfif(jpeg: Uint8Array): IDensitatJfif | undefined {
  if (jpeg.length < 20 || jpeg[0] !== 0xff || jpeg[1] !== SOI || jpeg[2] !== 0xff || jpeg[3] !== APP0) {
    return undefined;
  }
  const longitud = (jpeg[4] << 8) | jpeg[5];
  if (!esJfif(jpeg, 2, longitud) || longitud < 16) {
    return undefined;
  }
  return {
    unitats: jpeg[13],
    x: (jpeg[14] << 8) | jpeg[15],
    y: (jpeg[16] << 8) | jpeg[17]
  };
}
