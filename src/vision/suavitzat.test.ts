import { EstabilitzadorMissatge, Suavitzador } from './suavitzat';
import type { IMesures } from './tipus';

const amb = (yaw: number, extra: Partial<IMesures> = {}): IMesures => ({ nCares: 1, yaw, llum: 100, ...extra });

describe('Suavitzador (mitjana mòbil de 0,5 s)', () => {
  it('fa la mitjana de les mostres de la finestra', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, amb(0));
    s.afegeix(100, amb(10));
    const r = s.afegeix(200, amb(20));
    expect(r.yaw).toBeCloseTo(10, 9);
    expect(r.llum).toBeCloseTo(100, 9);
    expect(r.nCares).toBe(1);
  });

  it('les mostres més velles de 0,5 s surten de la finestra', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, amb(100));
    s.afegeix(100, amb(0));
    const r = s.afegeix(700, amb(0)); // la de t=0 i la de t=100 ja són fora (700 − 100 > 500)
    expect(r.yaw).toBe(0);
    expect(s.mida).toBe(1);
  });

  it('una mostra aïllada (parpelleig puntual) no fa saltar el valor', () => {
    const s = new Suavitzador(500);
    let r = s.afegeix(0, amb(2));
    for (let t = 83; t < 400; t += 83) {
      r = s.afegeix(t, amb(2));
    }
    r = s.afegeix(450, amb(30));
    expect(r.yaw ?? 99).toBeLessThan(8);
  });

  it('el nombre de cares és el més freqüent de la finestra (no parpelleja)', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, amb(1));
    s.afegeix(80, amb(1));
    const r = s.afegeix(160, { nCares: 0 });
    expect(r.nCares).toBe(1);
    expect(r.yaw).toBeCloseTo(1, 9);
  });

  it('sense cara la majoria de la finestra: només nCares', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, { nCares: 0 });
    s.afegeix(80, { nCares: 0 });
    const r = s.afegeix(160, amb(5));
    expect(r).toEqual({ nCares: 0 });
  });

  it('ignora les mostres sense cara quan fa la mitjana de valors', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, amb(10));
    s.afegeix(80, amb(10));
    s.afegeix(160, { nCares: 0 });
    const r = s.afegeix(240, amb(10));
    expect(r.yaw).toBeCloseTo(10, 9);
  });

  it('un valor absent (undefined) no entra a la mitjana', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, { nCares: 1, fons: 0.9 });
    const r = s.afegeix(80, { nCares: 1 });
    expect(r.fons).toBeCloseTo(0.9, 9);
    expect(r.yaw).toBeUndefined();
  });

  it('reinicia buida la finestra', () => {
    const s = new Suavitzador(500);
    s.afegeix(0, amb(50));
    s.reinicia();
    expect(s.afegeix(10, amb(0)).yaw).toBe(0);
  });
});

describe('EstabilitzadorMissatge (sense spam)', () => {
  it('un missatge nou només es mostra després de 3 avaluacions seguides', () => {
    const e = new EstabilitzadorMissatge<string>(3);
    expect(e.push('a')).toBeUndefined();
    expect(e.push('a')).toBeUndefined();
    expect(e.push('a')).toBe('a');
  });

  it('un canvi puntual no el fa canviar', () => {
    const e = new EstabilitzadorMissatge<string>(3);
    for (let i = 0; i < 3; i++) {
      e.push('a');
    }
    expect(e.push('b')).toBe('a');
    expect(e.push('a')).toBe('a');
    expect(e.push('b')).toBe('a');
    expect(e.push('b')).toBe('a');
    expect(e.push('b')).toBe('b');
  });

  it('la desaparició del missatge (tot correcte) també s’estabilitza', () => {
    const e = new EstabilitzadorMissatge<string>(2);
    e.push('a');
    e.push('a');
    expect(e.push(undefined)).toBe('a');
    expect(e.push(undefined)).toBeUndefined();
  });

  it('reinicia', () => {
    const e = new EstabilitzadorMissatge<string>(1);
    e.push('a');
    e.reinicia();
    expect(e.push(undefined)).toBeUndefined();
  });
});
