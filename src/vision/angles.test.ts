import { creaMatriu } from '../test/escena';
import { anglesDeMatriu } from './angles';

describe('anglesDeMatriu', () => {
  it('matriu identitat: tots els angles a 0', () => {
    const a = anglesDeMatriu(creaMatriu(0, 0, 0));
    expect(a?.yaw).toBeCloseTo(0, 6);
    expect(a?.pitch).toBeCloseTo(0, 6);
    expect(a?.roll).toBeCloseTo(0, 6);
  });

  it.each([
    [10, 0, 0],
    [-10, 0, 0],
    [0, 7, 0],
    [0, -7, 0],
    [0, 0, 4],
    [0, 0, -4],
    [20, -5, 3],
    [-35, 12, -8]
  ])('recupera yaw %p, pitch %p, roll %p d’una matriu coneguda', (yaw, pitch, roll) => {
    const a = anglesDeMatriu(creaMatriu(yaw, pitch, roll));
    expect(a?.yaw).toBeCloseTo(yaw, 5);
    expect(a?.pitch).toBeCloseTo(pitch, 5);
    expect(a?.roll).toBeCloseTo(roll, 5);
  });

  it('ignora l’escala i la translació de la matriu mètrica', () => {
    const a = anglesDeMatriu(creaMatriu(12, -6, 2, 14.3));
    expect(a?.yaw).toBeCloseTo(12, 5);
    expect(a?.pitch).toBeCloseTo(-6, 5);
    expect(a?.roll).toBeCloseTo(2, 5);
  });

  it('convenció: yaw positiu = el nas (+z) va cap a +x; pitch positiu = el nas va cap a −y (cap avall)', () => {
    const m = creaMatriu(30, 0, 0);
    // Tercera columna (en ordre de columnes: data[8..10]) = on va l’eix +z de la cara.
    expect(m.data[8]).toBeGreaterThan(0.4);
    const p = creaMatriu(0, 30, 0);
    expect(p.data[9]).toBeLessThan(-0.4);
    expect(anglesDeMatriu(p)?.pitch).toBeGreaterThan(0);
  });

  it('retorna undefined per a matrius no vàlides', () => {
    expect(anglesDeMatriu(undefined)).toBeUndefined();
    expect(anglesDeMatriu({ rows: 3, columns: 3, data: new Array(9).fill(1) })).toBeUndefined();
    expect(anglesDeMatriu({ rows: 4, columns: 4, data: new Array(16).fill(0) })).toBeUndefined();
    expect(anglesDeMatriu({ rows: 4, columns: 4, data: new Array(16).fill(NaN) })).toBeUndefined();
    expect(anglesDeMatriu({ rows: 4, columns: 4, data: [1, 0, 0] })).toBeUndefined();
  });
});
