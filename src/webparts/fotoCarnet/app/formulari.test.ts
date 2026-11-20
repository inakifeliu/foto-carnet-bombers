import { construeixUrlForms, diagnosticaPlantilla, esNomFitxerSegur, nomFitxer, validaMatricula } from './formulari';

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

  it('exigeix coincidència completa encara que la regex no tingui àncores', () => {
    expect(validaMatricula('12345', '[0-9]{4,6}').valida).toBe(true);
    expect(validaMatricula('x12345', '[0-9]{4,6}').valida).toBe(false);
    expect(validaMatricula('12345x', '[0-9]{4,6}').valida).toBe(false);
    expect(validaMatricula('1234567', '[0-9]{4,6}').valida).toBe(false);
  });

  it("les alternatives s'embolcallen: 'a|b' no accepta 'ab' ni 'xb'", () => {
    expect(validaMatricula('a', 'a|b').valida).toBe(true);
    expect(validaMatricula('b', 'a|b').valida).toBe(true);
    expect(validaMatricula('xb', 'a|b').valida).toBe(false);
    expect(validaMatricula('ab', 'a|b').valida).toBe(false);
  });

  it('rebutja matrícules que no són segures com a nom de fitxer', () => {
    ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a..b', '..', '.a', 'a.', 'CON', 'nul.x'].forEach((m) => {
      expect(validaMatricula(m, '.*').valida).toBe(false);
    });
    expect(validaMatricula('A-12_3', '.*').valida).toBe(true);
  });

  it('marca la regex invàlida', () => {
    const r = validaMatricula('12345', '([');
    expect(r.valida).toBe(false);
    expect(r.regexInvalida).toBe(true);
  });
});

describe('esNomFitxerSegur', () => {
  it('accepta noms normals i rebutja buits, punts i espais als extrems', () => {
    expect(esNomFitxerSegur('12345')).toBe(true);
    expect(esNomFitxerSegur('')).toBe(false);
    expect(esNomFitxerSegur('ab ')).toBe(false);
    expect(esNomFitxerSegur(' ab')).toBe(false);
    expect(esNomFitxerSegur('a' + String.fromCharCode(1) + 'b')).toBe(false);
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
    expect(construeixUrlForms('https://f/{MATRICULA}-{MATRICULA}', '7')).toBe('https://f/7-7');
  });

  it("rebutja plantilles que no són https: (http, javascript, data, relatives)", () => {
    expect(construeixUrlForms('http://f/?r={MATRICULA}', '1')).toBeUndefined();
    // eslint-disable-next-line no-script-url
    expect(construeixUrlForms('javascript:alert({MATRICULA})', '1')).toBeUndefined();
    expect(construeixUrlForms('data:text/html,{MATRICULA}', '1')).toBeUndefined();
    expect(construeixUrlForms('/forms?r={MATRICULA}', '1')).toBeUndefined();
    expect(construeixUrlForms('HTTPS://f/?r={MATRICULA}', '1')).toBe('HTTPS://f/?r=1');
  });

  it('diagnosticaPlantilla distingeix els motius', () => {
    expect(diagnosticaPlantilla('https://f/?r={MATRICULA}')).toBe('ok');
    expect(diagnosticaPlantilla('https://f/?r=1')).toBe('sensePlantilla');
    expect(diagnosticaPlantilla('')).toBe('sensePlantilla');
    expect(diagnosticaPlantilla('http://f/?r={MATRICULA}')).toBe('noHttps');
    expect(diagnosticaPlantilla('no es url {MATRICULA}')).toBe('noHttps');
  });

  it('retorna undefined si falta el marcador o la plantilla és buida', () => {
    expect(construeixUrlForms('https://f/?r=XXXX', '12345')).toBeUndefined();
    expect(construeixUrlForms('', '12345')).toBeUndefined();
  });
});
