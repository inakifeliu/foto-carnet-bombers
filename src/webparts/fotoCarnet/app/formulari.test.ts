import { construeixUrlForms, nomFitxer, validaMatricula } from './formulari';

const REGEX = '^[0-9]{4,6}$';

describe('validaMatricula', () => {
  it('accepta matrícules que compleixen la regex', () => {
    expect(validaMatricula('12345', REGEX)).toEqual({ valida: true, matricula: '12345', regexInvalida: false });
    expect(validaMatricula('1234', REGEX).valida).toBe(true);
  });

  it('retalla els espais als extrems', () => {
    expect(validaMatricula('  12345 ', REGEX).matricula).toBe('12345');
    expect(validaMatricula('  12345 ', REGEX).valida).toBe(true);
  });

  it('rebutja valors que no compleixen la regex o són buits', () => {
    expect(validaMatricula('123', REGEX).valida).toBe(false);
    expect(validaMatricula('12a45', REGEX).valida).toBe(false);
    expect(validaMatricula('1234567', REGEX).valida).toBe(false);
    expect(validaMatricula('', REGEX).valida).toBe(false);
    expect(validaMatricula('   ', '.*').valida).toBe(false);
  });

  it('marca la regex invàlida', () => {
    const r = validaMatricula('12345', '([');
    expect(r.valida).toBe(false);
    expect(r.regexInvalida).toBe(true);
  });
});

describe('nomFitxer', () => {
  it('afegeix .jpg', () => {
    expect(nomFitxer('12345')).toBe('12345.jpg');
  });
});

describe('construeixUrlForms', () => {
  it('substitueix el marcador', () => {
    expect(construeixUrlForms('https://f/?id=X&r={MATRICULA}', '12345')).toBe('https://f/?id=X&r=12345');
  });

  it('codifica la matrícula amb encodeURIComponent', () => {
    expect(construeixUrlForms('https://f/?r={MATRICULA}', 'A B&C/1')).toBe('https://f/?r=A%20B%26C%2F1');
  });

  it('substitueix totes les aparicions', () => {
    expect(construeixUrlForms('{MATRICULA}-{MATRICULA}', '7')).toBe('7-7');
  });

  it('retorna undefined si falta el marcador o la plantilla és buida', () => {
    expect(construeixUrlForms('https://f/?r=XXXX', '12345')).toBeUndefined();
    expect(construeixUrlForms('', '12345')).toBeUndefined();
  });
});
