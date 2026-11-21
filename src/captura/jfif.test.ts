import { construeixApp0, escriuJfif, llegeixDensitatJfif } from './jfif';

/** Segment amb marcador `FF m`, longitud i càrrega útil. */
function segment(marcador: number, carrega: number[]): number[] {
  const longitud = carrega.length + 2;
  return [0xff, marcador, (longitud >> 8) & 0xff, longitud & 0xff, ...carrega];
}

const CARREGA_SOS = [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
const DADES = [0x12, 0x34, 0xff, 0x00, 0x56]; // inclou un byte farcit (FF 00)
const EOI = [0xff, 0xd9];
const sos = (): number[] => [...segment(0xda, CARREGA_SOS), ...DADES, ...EOI];
const dqt = (): number[] => segment(0xdb, [0x00, ...new Array<number>(64).fill(8)]);

/** APP0 JFIF 1.01 amb unitats/densitat i miniatura opcional. */
function app0Jfif(unitats: number, x: number, y: number, miniatura: number[] = []): number[] {
  return segment(0xe0, [
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    unitats,
    x >> 8,
    x & 0xff,
    y >> 8,
    y & 0xff,
    miniatura.length ? 1 : 0,
    miniatura.length ? 1 : 0,
    ...miniatura
  ]);
}

const jpeg = (...parts: number[][]): Uint8Array => new Uint8Array([0xff, 0xd8, ...parts.flat()]);

describe('escriuJfif', () => {
  it('insereix l’APP0 just després del SOI quan no n’hi ha (unitats = 1, X = Y = ppp)', () => {
    const origen = jpeg(dqt(), sos());
    const sortida = escriuJfif(origen, 300);
    expect(Array.from(sortida.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(llegeixDensitatJfif(sortida)).toEqual({ unitats: 1, x: 300, y: 300 });
    // La resta (DQT + SOS + dades) queda intacta i a continuació.
    const app0 = construeixApp0(300);
    expect(sortida.length).toBe(origen.length + app0.length);
    expect(Array.from(sortida.subarray(2 + app0.length))).toEqual(Array.from(origen.subarray(2)));
  });

  it('el segment APP0 generat té l’estructura JFIF 1.01 sense miniatura (18 bytes amb el marcador)', () => {
    expect(Array.from(construeixApp0(300))).toEqual([
      0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x01, 0x2c, 0x01, 0x2c, 0x00, 0x00
    ]);
  });

  it('codifica ppp > 255 en dos bytes (600 → 0x0258)', () => {
    const sortida = escriuJfif(jpeg(sos()), 600);
    expect(llegeixDensitatJfif(sortida)).toEqual({ unitats: 1, x: 600, y: 600 });
    expect([sortida[14], sortida[15], sortida[16], sortida[17]]).toEqual([0x02, 0x58, 0x02, 0x58]);
  });

  it('reemplaça un APP0 JFIF existent amb una altra densitat (i descarta la seva miniatura)', () => {
    const origen = jpeg(app0Jfif(0, 1, 1, [1, 2, 3]), dqt(), sos());
    const sortida = escriuJfif(origen, 300);
    expect(llegeixDensitatJfif(sortida)).toEqual({ unitats: 1, x: 300, y: 300 });
    // Un sol APP0 JFIF: mida = origen - APP0 antic (18 + 3) + APP0 nou (18).
    expect(sortida.length).toBe(origen.length - 21 + 18);
    // Només un cop la signatura "JFIF\0".
    const text = Array.from(sortida).join(',');
    expect(text.split('74,70,73,70,0').length - 1).toBe(1);
  });

  it('reemplaça un APP0 JFIF que ja tenia 72 ppp o 118 punts/cm', () => {
    expect(llegeixDensitatJfif(escriuJfif(jpeg(app0Jfif(1, 72, 72), sos()), 300))).toEqual({
      unitats: 1,
      x: 300,
      y: 300
    });
    expect(llegeixDensitatJfif(escriuJfif(jpeg(app0Jfif(2, 118, 118), sos()), 300))).toEqual({
      unitats: 1,
      x: 300,
      y: 300
    });
  });

  it('elimina qualsevol segment EXIF (APP1) i també XMP', () => {
    const exif = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xaa, 0xbb, 0xcc]);
    const xmp = segment(0xe1, [...Array.from('http://ns.adobe.com/xap/1.0/\0').map((c) => c.charCodeAt(0)), 0x3c]);
    const origen = jpeg(app0Jfif(1, 72, 72), exif, dqt(), xmp, sos());
    const sortida = escriuJfif(origen, 300);
    // No queda cap marcador APP1 entre el SOI i el SOS: només APP0 i DQT.
    let pos = 2;
    const marcadors: number[] = [];
    while (sortida[pos] === 0xff && sortida[pos + 1] !== 0xda) {
      marcadors.push(sortida[pos + 1]);
      pos += 2 + ((sortida[pos + 2] << 8) | sortida[pos + 3]);
    }
    expect(marcadors).toEqual([0xe0, 0xdb]);
    expect(llegeixDensitatJfif(sortida)).toEqual({ unitats: 1, x: 300, y: 300 });
  });

  it('JPEG amb EXIF però sense APP0: l’APP0 s’insereix i l’EXIF desapareix', () => {
    const exif = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x01]);
    const sortida = escriuJfif(jpeg(exif, dqt(), sos()), 300);
    expect(sortida[3]).toBe(0xe0);
    expect(sortida.length).toBe(2 + 18 + dqt().length + sos().length);
    expect(Array.from(sortida.subarray(2 + 18, 2 + 18 + 2))).toEqual([0xff, 0xdb]);
  });

  it('conserva altres segments APP0 no JFIF (p. ex. JFXX)', () => {
    const jfxx = segment(0xe0, [0x4a, 0x46, 0x58, 0x58, 0x00, 0x10]);
    const sortida = escriuJfif(jpeg(app0Jfif(1, 72, 72), jfxx, sos()), 300);
    expect(sortida.length).toBe(2 + 18 + jfxx.length + sos().length);
  });

  it('no toca les dades d’imatge (bytes farcits FF 00 inclosos) ni l’EOI', () => {
    const sortida = escriuJfif(jpeg(dqt(), sos()), 300);
    const cua = Array.from(sortida.subarray(sortida.length - (DADES.length + 2)));
    expect(cua).toEqual([...DADES, ...EOI]);
  });

  it('és idempotent: tornar-la a aplicar dóna el mateix resultat', () => {
    const una = escriuJfif(jpeg(app0Jfif(0, 1, 1), dqt(), sos()), 300);
    expect(Array.from(escriuJfif(una, 300))).toEqual(Array.from(una));
  });

  it('no modifica l’entrada', () => {
    const origen = jpeg(app0Jfif(0, 1, 1), sos());
    const copia = Array.from(origen);
    escriuJfif(origen, 300);
    expect(Array.from(origen)).toEqual(copia);
  });

  it('accepta bytes de farciment FF abans d’un marcador', () => {
    const origen = new Uint8Array([0xff, 0xd8, 0xff, ...dqt(), ...sos()]);
    expect(llegeixDensitatJfif(escriuJfif(origen, 300))).toEqual({ unitats: 1, x: 300, y: 300 });
  });

  describe('entrada invàlida', () => {
    it('no comença per FF D8', () => {
      expect(() => escriuJfif(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), 300)).toThrow('No és un JPEG');
      expect(() => escriuJfif(new Uint8Array([0xd8, 0xff, 0xe0, 0x00]), 300)).toThrow('No és un JPEG');
    });

    it('buida o massa curta', () => {
      expect(() => escriuJfif(new Uint8Array([]), 300)).toThrow();
      expect(() => escriuJfif(new Uint8Array([0xff, 0xd8]), 300)).toThrow();
    });

    it('segment truncat o amb longitud fora dels límits', () => {
      expect(() => escriuJfif(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x7f, 0x00]), 300)).toThrow('truncat');
    });

    it('sense SOS', () => {
      expect(() => escriuJfif(jpeg(dqt()), 300)).toThrow();
      expect(() => escriuJfif(jpeg(dqt(), EOI), 300)).toThrow();
    });

    it('marcador esperat però no hi és', () => {
      expect(() => escriuJfif(new Uint8Array([0xff, 0xd8, 0x00, 0x01, 0x02, 0x03]), 300)).toThrow('malformat');
    });

    it('ppp no vàlid', () => {
      [0, -1, 1.5, 65536, NaN].forEach((ppp) => expect(() => escriuJfif(jpeg(sos()), ppp)).toThrow('ppp'));
    });
  });
});

describe('llegeixDensitatJfif', () => {
  it('retorna undefined sense APP0 JFIF al principi', () => {
    expect(llegeixDensitatJfif(jpeg(dqt(), sos()))).toBeUndefined();
    expect(llegeixDensitatJfif(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});
