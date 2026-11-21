import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolConfigDeText } from '../config/configuracio';
import {
  avaluaPlantillaForms,
  compilaRegexMatricula,
  construeixUrlForms,
  diagnosticaPlantilla,
  esNomFitxerSegur,
  nomFitxer,
  validaMatricula
} from './formulari';

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
    ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a..b', '..', '.a', 'a.', 'CON', 'nul.x'].forEach(
      (m) => {
        expect(validaMatricula(m, '.*').valida).toBe(false);
      }
    );
    expect(validaMatricula('A-12_3', '.*').valida).toBe(true);
  });

  it('rebutja espais interns encara que la regex els admeti', () => {
    expect(validaMatricula('12 345', '.*').valida).toBe(false);
    expect(validaMatricula('12	345', '.*').valida).toBe(false);
    expect(validaMatricula('12 345', REGEX).valida).toBe(false);
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
    expect(construeixUrlForms('https://forms.office.com/?id=X&r={MATRICULA}', '12345')).toBe(
      'https://forms.office.com/?id=X&r=12345'
    );
  });

  it('codifica la matrícula amb encodeURIComponent', () => {
    expect(construeixUrlForms('https://forms.office.com/?r={MATRICULA}', 'A B&C/1')).toBe(
      'https://forms.office.com/?r=A%20B%26C%2F1'
    );
  });

  it('substitueix totes les aparicions', () => {
    expect(construeixUrlForms('https://forms.office.com/{MATRICULA}-{MATRICULA}', '7')).toBe(
      'https://forms.office.com/7-7'
    );
  });

  it('rebutja plantilles que no són https: (http, javascript, data, relatives)', () => {
    expect(construeixUrlForms('http://f/?r={MATRICULA}', '1')).toBeUndefined();
    expect(construeixUrlForms('javascript:alert({MATRICULA})', '1')).toBeUndefined();
    expect(construeixUrlForms('data:text/html,{MATRICULA}', '1')).toBeUndefined();
    expect(construeixUrlForms('/forms?r={MATRICULA}', '1')).toBeUndefined();
    expect(construeixUrlForms('HTTPS://forms.office.com/?r={MATRICULA}', '1')).toBe('HTTPS://forms.office.com/?r=1');
  });

  it('diagnosticaPlantilla distingeix els motius', () => {
    expect(diagnosticaPlantilla('https://forms.office.com/?r={MATRICULA}')).toBe('ok');
    expect(diagnosticaPlantilla('https://forms.office.com/?r=1')).toBe('sensePlantilla');
    expect(diagnosticaPlantilla('')).toBe('sensePlantilla');
    expect(diagnosticaPlantilla('http://f/?r={MATRICULA}')).toBe('noHttps');
    expect(diagnosticaPlantilla('no es url {MATRICULA}')).toBe('noHttps');
    expect(diagnosticaPlantilla('https://exemple.cat/?r={MATRICULA}')).toBe('hostNoPermes');
    expect(diagnosticaPlantilla('https://forms.microsoft.com/x?r={MATRICULA}')).toBe('ok');
    expect(diagnosticaPlantilla('https://forms.cloud.microsoft/x?r={MATRICULA}')).toBe('ok');
    // Host exacte, mai per sufix ni per subdomini.
    expect(diagnosticaPlantilla('https://forms.office.com.exemple.cat/?r={MATRICULA}')).toBe('hostNoPermes');
    expect(diagnosticaPlantilla('https://exemple.forms.office.com/?r={MATRICULA}')).toBe('hostNoPermes');
    expect(diagnosticaPlantilla('https://forms.office.com@exemple.cat/?r={MATRICULA}')).toBe('hostNoPermes');
    expect(construeixUrlForms('https://exemple.cat/?r={MATRICULA}', '1')).toBeUndefined();
  });

  it('retorna undefined si falta el marcador o la plantilla és buida', () => {
    expect(construeixUrlForms('https://forms.office.com/?r=XXXX', '12345')).toBeUndefined();
    expect(construeixUrlForms('', '12345')).toBeUndefined();
  });
});

describe('avaluaPlantillaForms (validació del build)', () => {
  it('el marcador XXXX és provisional però la plantilla és correcta (avís, no error)', () => {
    expect(avaluaPlantillaForms('https://forms.office.com/Pages/ResponsePage.aspx?id=XXXX&rYYYY={MATRICULA}')).toEqual({
      diagnostic: 'ok',
      provisional: true
    });
  });

  it('una plantilla real no és provisional; una de dolenta dona el diagnòstic', () => {
    expect(avaluaPlantillaForms('https://forms.office.com/r/abc?x={MATRICULA}')).toEqual({
      diagnostic: 'ok',
      provisional: false
    });
    expect(avaluaPlantillaForms('http://forms.office.com/r?x={MATRICULA}').diagnostic).toBe('noHttps');
    expect(avaluaPlantillaForms('https://forms.office.com/r?x=1').diagnostic).toBe('sensePlantilla');
    expect(avaluaPlantillaForms('https://tercer.com/r?x={MATRICULA}').diagnostic).toBe('hostNoPermes');
  });

  it("la regex de la matrícula es valida amb el mateix embolcall que l'app", () => {
    expect(compilaRegexMatricula('[0-9]+').source).toBe('^(?:[0-9]+)$');
    expect(() => compilaRegexMatricula('([')).toThrow();
  });
});

describe('config/config.json (el que s’entrega)', () => {
  it('resol sense avisos i la plantilla del Forms és vàlida', () => {
    const text = readFileSync(join(process.cwd(), 'config', 'config.json'), 'utf8');
    const r = resolConfigDeText(text);
    expect(r.avisos).toEqual([]);
    expect(diagnosticaPlantilla(r.config.forms.urlPlantilla)).toBe('ok');
    expect(avaluaPlantillaForms(r.config.forms.urlPlantilla).provisional).toBe(false);
  });
});
