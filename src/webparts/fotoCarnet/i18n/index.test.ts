import { interpola, t } from './index';

describe('i18n', () => {
  it('interpola variables {var}', () => {
    expect(interpola('Hola {nom}, {n} fotos', { nom: 'Pau', n: 3 })).toBe('Hola Pau, 3 fotos');
    expect(interpola('{a}{a}', { a: 'x' })).toBe('xx');
  });

  it('deixa els marcadors sense valor i el text sense variables', () => {
    expect(interpola('Hola {nom}', {})).toBe('Hola {nom}');
    expect(interpola('Hola {nom}')).toBe('Hola {nom}');
  });

  it('t() resol claus del catàleg amb variables', () => {
    expect(t('p0.comencar')).toBe('Començar');
    expect(t('p3.comptador', { n: 1, max: 3 })).toBe('Foto 1 de 3');
    expect(t('p5.nomFitxer', { fitxer: '12345.jpg' })).toContain('12345.jpg');
  });

  it('t() retorna la clau si no existeix', () => {
    expect(t('clau.inexistent' as never)).toBe('clau.inexistent');
  });
});
