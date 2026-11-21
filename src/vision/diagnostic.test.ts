import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { mesuresBones } from '../test/escena';
import { avalua } from './avaluacio';
import { creaDiagnostic, descarregaDiagnostic } from './diagnostic';
import type { IInstantania } from './estatAnalisi';

function instantania(): IInstantania {
  const mesures = mesuresBones();
  return {
    ts: 1234,
    ample: 640,
    alt: 360,
    mesures,
    avaluacio: avalua(mesures, CONFIG_PER_DEFECTE.llindars),
    retall: {
      rect: { x: 10, y: 20, w: 150, h: 190 },
      capY: 70,
      barbetaY: 210,
      origenCap: 'mascara',
      fora: { esq: 0, dalt: 0, dreta: 0, baix: 0 },
      fraccioFora: 0
    },
    // Aquestes dades només serveixen per dibuixar la superposició: no poden sortir al JSON.
    mascara: { data: new Uint8Array(64 * 36).fill(1), w: 64, h: 36 },
    landmarks: Array.from({ length: 478 }, () => ({ x: 0.123456, y: 0.654321 })),
    fpsAnalisi: 11.8765,
    msPerFotograma: 23.4567,
    fpsVideo: 29.97,
    delegat: 'GPU'
  };
}

describe('JSON de diagnòstic (RF-18)', () => {
  const config = {
    ...CONFIG_PER_DEFECTE,
    forms: { urlPlantilla: 'https://forms.office.com/Pages/ResponsePage.aspx?id=SECRET&rYYYY={MATRICULA}' }
  };

  it('porta versió, data, rendiment, mesures, controls, retall i configuració', () => {
    const j = creaDiagnostic(instantania(), config, '1.2.3', '2026-11-21', new Date('2026-11-21T10:00:00Z'));
    expect(j.versio).toBe('1.2.3');
    expect(j.dataCompilacio).toBe('2026-11-21');
    expect(j.generat).toBe('2026-11-21T10:00:00.000Z');
    expect(j.rendiment).toEqual({
      fpsAnalisi: 11.8765,
      msPerFotograma: 23.4567,
      fpsVideo: 29.97,
      delegat: 'GPU',
      nivellPressupost: null,
      fpsObjectiu: null,
      tempsPerPas: null,
      segmentacio: null
    });
    expect(j.fotograma).toEqual({ ample: 640, alt: 360 });
    expect(j.mesures?.yaw).toBe(0);
    expect(Object.keys(j.controls)).toEqual([
      'cara',
      'distancia',
      'centrat',
      'orientacio',
      'llum',
      'fons',
      'ombra',
      'polo',
      'espatlles',
      'ullsBoca',
      'nitidesa'
    ]);
    expect(j.controls.llum).toEqual({ estat: 'ok', valor: 155, missatge: null, puntuacio: expect.any(Number) });
    expect(j.retall).toEqual({ x: 10, y: 20, w: 150, h: 190, origenCap: 'mascara', fraccioFora: 0 });
    expect(j.config.llindars).toEqual(CONFIG_PER_DEFECTE.llindars);
    expect(j.config.pesosPuntuacio).toEqual(CONFIG_PER_DEFECTE.pesosPuntuacio);
  });

  it('només té les claus de la llista blanca: cap màscara, landmarks ni imatge', () => {
    const j = creaDiagnostic(instantania(), config, '1.0.0', '2026-11-21');
    expect(Object.keys(j).sort()).toEqual(
      [
        'config',
        'controls',
        'dataCompilacio',
        'fotograma',
        'generat',
        'mesures',
        'missatgePrioritari',
        'rendiment',
        'retall',
        'versio'
      ].sort()
    );
    const text = JSON.stringify(j);
    expect(text).not.toMatch(/landmarks|data:image|blob:|base64|Uint8|"mascara"s*:/i);
    // Els 478 landmarks (0.123456) no hi són.
    expect(text).not.toContain('0.123456');
    expect(text.length).toBeLessThan(6000);
  });

  it('no inclou la matrícula ni l’URL del Forms (només el host)', () => {
    const j = creaDiagnostic(instantania(), config, '1.0.0', '2026-11-21');
    const text = JSON.stringify(j);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('{MATRICULA}');
    expect(j.config.forms).toEqual({ host: 'forms.office.com' });
    // L'aplicació no té cap lloc on la matrícula arribi a aquesta funció: el JSON no té cap camp «matricula».
    expect(text.toLowerCase()).not.toContain('"matricula"');
  });

  it('sense anàlisi activa, tot i així genera un JSON vàlid', () => {
    const j = creaDiagnostic(undefined, config, '1.0.0', '2026-11-21');
    expect(j.mesures).toBeNull();
    expect(j.controls).toEqual({});
    expect(j.rendiment.delegat).toBeNull();
    expect(() => JSON.parse(JSON.stringify(j))).not.toThrow();
  });

  it('descarregaDiagnostic: <a download> sobre una URL blob, que es revoca', () => {
    jest.useFakeTimers();
    for (const nom of ['createObjectURL', 'revokeObjectURL'] as const) {
      if (typeof URL[nom] !== 'function') {
        Object.defineProperty(URL, nom, { value: () => 'blob:prova', configurable: true, writable: true });
      }
    }
    let blobRebut: Blob | undefined;
    jest.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobRebut = b as Blob;
      return 'blob:diag';
    });
    const revoca = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clics: { download: string; href: string }[] = [];
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push({ download: this.download, href: this.href });
    });
    descarregaDiagnostic(
      creaDiagnostic(instantania(), config, '1.0.0', '2026-11-21', new Date('2026-11-21T10:00:00Z'))
    );
    expect(clics).toHaveLength(1);
    expect(clics[0].download).toMatch(/^diagnostic-foto-carnet-.*\.json$/);
    expect(clics[0].href).toBe('blob:diag');
    expect(blobRebut?.type).toBe('application/json');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    jest.advanceTimersByTime(1500);
    expect(revoca).toHaveBeenCalledWith('blob:diag');
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
});

describe('JSON de diagnòstic: temps per pas i pressupost', () => {
  const config = CONFIG_PER_DEFECTE;

  it('porta el temps de cada pas, el nivell del pressupost i l’estat de la segmentació', () => {
    const base = instantania();
    const j = creaDiagnostic(
      {
        ...base,
        temps: { dibuix: 3.123456, landmarker: 18.5, segmentador: 9.25, metriques: 1.1 },
        nivell: 'reduit',
        fpsObjectiu: 8,
        segmentacio: false
      },
      config,
      '1',
      '2026-11-21'
    );
    expect(j.rendiment.tempsPerPas).toEqual({ dibuix: 3.1235, landmarker: 18.5, segmentador: 9.25, metriques: 1.1 });
    expect(j.rendiment.nivellPressupost).toBe('reduit');
    expect(j.rendiment.fpsObjectiu).toBe(8);
    expect(j.rendiment.segmentacio).toBe('noDisponible');
    expect(creaDiagnostic({ ...base, segmentacio: true }, config, '1', '2026-11-21').rendiment.segmentacio).toBe(
      'activa'
    );
  });
});
