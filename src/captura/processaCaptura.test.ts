import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { creaLandmarks, creaMascara, mesuresBones } from '../test/escena';
import type { IAnalitzador, IMostra } from '../vision/analitzador';
import type { IMesures } from '../vision/tipus';
import { rectangleVisor, retallaRectangle, type IOpcionsSortida } from './retall';
import { processaCaptura } from './processaCaptura';

interface ICtx {
  drawImage: jest.Mock;
  fillRect: jest.Mock;
  fillStyle: string;
}

function espiaCanvas(): ICtx {
  const ctx: ICtx = { drawImage: jest.fn(), fillRect: jest.fn(), fillStyle: '' };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as RenderingContext);
  return ctx;
}

function fotograma(w = 1920, h = 1080): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const analitzadorAmb = (mostra: Partial<IMostra> & { mesures: IMesures }): IAnalitzador => ({
  analitza: jest.fn(() => ({
    ample: 640,
    alt: 360,
    temps: { dibuix: 0, landmarker: 0, segmentador: 0, metriques: 0 },
    segmentat: true,
    segmentacio: true,
    ...mostra
  })),
  allibera: jest.fn()
});

const FIXA: IOpcionsSortida = { mida: 'fixa', ppp: 300, alcadaMaxPx: 2160 };
const ORIGINAL: IOpcionsSortida = { mida: 'original', ppp: 300, alcadaMaxPx: 2160 };

afterEach(() => jest.restoreAllMocks());

describe('retallaRectangle', () => {
  it('rectangle dins el fotograma: es copia directament i surt a 413×531', () => {
    const ctx = espiaCanvas();
    const sortida = retallaRectangle(fotograma(), { x: 754, y: 253, w: 412, h: 529 }, FIXA);
    expect(sortida.width).toBe(413);
    expect(sortida.height).toBe(531);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage.mock.calls[0].slice(1)).toEqual([754, 253, 412, 529, 0, 0, 413, 531]);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('rectangle que surt del fotograma: la part de fora es pinta de blanc i la imatge hi va desplaçada', () => {
    const ctx = espiaCanvas();
    const sortida = retallaRectangle(fotograma(), { x: 100, y: -60, w: 700, h: 900 }, FIXA);
    expect(sortida.width).toBe(413);
    expect(sortida.height).toBe(531);
    expect(ctx.fillStyle).toBe('#ffffff');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 700, 900);
    // El fotograma es dibuixa desplaçat, sense escalar-lo ni tocar-lo.
    const aFons = ctx.drawImage.mock.calls.find((c) => c.length === 3);
    expect(aFons?.slice(1)).toEqual([-100, 60]);
  });

  it('«original»: un rectangle de 840×1080 es desa a 840×1080, sense reescalar', () => {
    const ctx = espiaCanvas();
    const sortida = retallaRectangle(fotograma(), { x: 540, y: 0, w: 840, h: 1080 }, ORIGINAL);
    expect([sortida.width, sortida.height]).toEqual([840, 1080]);
    expect(ctx.drawImage.mock.calls[0].slice(1)).toEqual([540, 0, 840, 1080, 0, 0, 840, 1080]);
  });

  it('600 ppp: 827 × 1063', () => {
    espiaCanvas();
    const sortida = retallaRectangle(fotograma(), { x: 700, y: 100, w: 800, h: 1000 }, { ...FIXA, ppp: 600 });
    expect([sortida.width, sortida.height]).toEqual([827, 1063]);
  });
});

describe('processaCaptura (RF-06, RF-07)', () => {
  // Aquest bloc prova el retall RF-07 (enquadrament «cap»); el «visor» (per defecte) té el seu bloc més avall.
  const cfg = {
    ...CONFIG_PER_DEFECTE,
    sortida: { ...CONFIG_PER_DEFECTE.sortida, enquadrament: 'cap' as const, mida: 'fixa' as const }
  };

  it('sense analitzador (models no carregats): retall centrat de la Fase 1, sense puntuació i amb avís', () => {
    const ctx = espiaCanvas();
    const r = processaCaptura(fotograma(1280, 720), undefined, cfg);
    expect(r.puntuacio).toBeUndefined();
    expect(r.avisos).toEqual(['avis.senseAnalisi']);
    expect([r.retallada.width, r.retallada.height]).toEqual([413, 531]);
    // Retall centrat 35:45 d'un fotograma 1280×720: 560×720 centrat a x = 360.
    expect(ctx.drawImage.mock.calls[0].slice(1, 5)).toEqual([360, 0, 560, 720]);
  });

  it('si l’anàlisi llança un error, la foto es fa igualment (retall centrat)', () => {
    espiaCanvas();
    const an: IAnalitzador = {
      analitza: jest.fn(() => {
        throw new Error('boom');
      }),
      allibera: jest.fn()
    };
    const r = processaCaptura(fotograma(), an, cfg);
    expect(r.avisos).toEqual(['avis.senseAnalisi']);
    expect(r.puntuacio).toBeUndefined();
  });

  it('sense cara: retall centrat, puntuació 0 i avisos', () => {
    const ctx = espiaCanvas();
    const r = processaCaptura(fotograma(1280, 720), analitzadorAmb({ mesures: { nCares: 0 } }), cfg);
    expect(r.puntuacio).toBe(0);
    expect(r.avisos).toEqual(['p3.msg.capCara', 'avis.senseCara']);
    expect(ctx.drawImage.mock.calls[0].slice(1, 5)).toEqual([360, 0, 560, 720]);
  });

  it('amb dues cares: retall centrat, puntuació 0 i avís', () => {
    espiaCanvas();
    const r = processaCaptura(fotograma(), analitzadorAmb({ mesures: { nCares: 2 } }), cfg);
    expect(r.puntuacio).toBe(0);
    expect(r.avisos).toContain('p3.msg.moltesCares');
  });

  it('amb cara: el retall situa el cap segons RF-07 (34/45 de l’alçada, marge superior 4/45)', () => {
    const ctx = espiaCanvas();
    const mascara = creaMascara(100, 100, (x, y) => x >= 40 && x <= 60 && y >= 20);
    const r = processaCaptura(
      fotograma(1920, 1080),
      analitzadorAmb({
        mesures: mesuresBones(),
        landmarks: creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.62, ample: 0.2 }),
        mascara
      }),
      cfg
    );
    const [sx, sy, sw, sh] = ctx.drawImage.mock.calls[0].slice(1, 5) as number[];
    const capY = 0.2 * 1080;
    const barbetaY = 0.62 * 1080;
    expect((barbetaY - capY) / sh).toBeCloseTo(34 / 45, 2);
    expect((capY - sy) / sh).toBeCloseTo(4 / 45, 2);
    expect(Math.abs(sx + sw / 2 - 960)).toBeLessThanOrEqual(1);
    expect(sw / sh).toBeCloseTo(35 / 45, 2);
    expect(r.avisos).toEqual([]);
    expect(r.puntuacio).toBeGreaterThan(90);
    expect([r.retallada.width, r.retallada.height]).toEqual([413, 531]);
  });

  it('el retall surt del fotograma: avís «massa a prop / a la vora», fons blanc i penalització a la puntuació', () => {
    const ctx = espiaCanvas();
    const bona = processaCaptura(
      fotograma(),
      analitzadorAmb({ mesures: mesuresBones(), landmarks: creaLandmarks({ yFront: 0.3, yBarbeta: 0.62 }) }),
      cfg
    );
    const propera = processaCaptura(
      fotograma(),
      // La part superior del cap quasi a la vora de dalt: el retall surt per dalt.
      analitzadorAmb({ mesures: mesuresBones(), landmarks: creaLandmarks({ yFront: 0.1, yBarbeta: 0.8 }) }),
      cfg
    );
    expect(propera.avisos).toContain('avis.retallFora');
    expect(bona.avisos).not.toContain('avis.retallFora');
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(propera.puntuacio).toBeLessThan((bona.puntuacio ?? 0) - 5);
  });

  it('els avisos porten els controls no verds en ordre de prioritat', () => {
    espiaCanvas();
    const r = processaCaptura(
      fotograma(),
      analitzadorAmb({ mesures: { ...mesuresBones(), llum: 20, nitidesa: 5 }, landmarks: creaLandmarks() }),
      cfg
    );
    expect(r.avisos.slice(0, 2)).toEqual(['p3.msg.massaFosc', 'p3.msg.nitidesa']);
  });

  it('el fotograma complet (resolució de la càmera) és el que s’analitza (RF-06)', () => {
    espiaCanvas();
    const completa = fotograma(1920, 1080);
    const an = analitzadorAmb({ mesures: { nCares: 0 } });
    processaCaptura(completa, an, cfg);
    expect(an.analitza).toHaveBeenCalledWith(completa, 1920, 1080, { captura: true });
  });

  it('la penalització configurable es respecta', () => {
    espiaCanvas();
    const lm = creaLandmarks({ yFront: 0.1, yBarbeta: 0.8 });
    const a = processaCaptura(fotograma(), analitzadorAmb({ mesures: mesuresBones(), landmarks: lm }), cfg);
    const b = processaCaptura(fotograma(), analitzadorAmb({ mesures: mesuresBones(), landmarks: lm }), {
      ...cfg,
      sortida: { ...cfg.sortida, penalitzacioForaFotograma: 0 }
    });
    expect(b.puntuacio ?? 0).toBeGreaterThan(a.puntuacio ?? 0);
  });
});

describe('processaCaptura amb enquadrament «visor» (per defecte)', () => {
  const cfg = { ...CONFIG_PER_DEFECTE, sortida: { ...CONFIG_PER_DEFECTE.sortida, mida: 'fixa' as const } };

  it('el per defecte és «visor»', () => {
    expect(cfg.sortida.enquadrament).toBe('visor');
  });

  it.each([
    [1920, 1080],
    [1280, 720],
    [640, 480],
    [720, 1280]
  ])('càmera %i×%i: retalla exactament el rectangle del visor, 413×531, sense avisos ni penalització', (w, h) => {
    const ctx = espiaCanvas();
    // Cap que, amb RF-07, sortiria fora del fotograma: amb «visor» no hi ha avís ni penalització.
    const r = processaCaptura(
      fotograma(w, h),
      analitzadorAmb({ mesures: mesuresBones(), landmarks: creaLandmarks({ yFront: 0.1, yBarbeta: 0.8 }) }),
      cfg
    );
    const v = rectangleVisor(w, h);
    expect(ctx.drawImage.mock.calls[0].slice(1, 5)).toEqual([v.x, v.y, v.w, v.h]);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect([r.retallada.width, r.retallada.height]).toEqual([413, 531]);
    expect(r.avisos).toEqual([]);
    expect(r.puntuacio).toBeGreaterThan(90); // sense penalització per retall fora del fotograma
  });

  it('«original» (visor): la foto té la mida del retall, 840×1080 amb una càmera 1920×1080', () => {
    espiaCanvas();
    const r = processaCaptura(
      fotograma(1920, 1080),
      analitzadorAmb({ mesures: mesuresBones(), landmarks: creaLandmarks() }),
      { ...cfg, sortida: { ...cfg.sortida, mida: 'original' } }
    );
    expect([r.retallada.width, r.retallada.height]).toEqual([840, 1080]);
  });

  it('«original» sense anàlisi: retall centrat a la seva mida', () => {
    espiaCanvas();
    const r = processaCaptura(fotograma(1280, 720), undefined, {
      ...cfg,
      sortida: { ...cfg.sortida, mida: 'original' }
    });
    expect([r.retallada.width, r.retallada.height]).toEqual([560, 720]);
  });

  it('600 ppp: 827×1063', () => {
    espiaCanvas();
    const r = processaCaptura(
      fotograma(1920, 1080),
      analitzadorAmb({ mesures: mesuresBones(), landmarks: creaLandmarks() }),
      {
        ...cfg,
        sortida: { ...cfg.sortida, ppp: 600 }
      }
    );
    expect([r.retallada.width, r.retallada.height]).toEqual([827, 1063]);
  });

  it('els controls no verds continuen donant avisos i puntuació', () => {
    espiaCanvas();
    const r = processaCaptura(
      fotograma(),
      analitzadorAmb({ mesures: { ...mesuresBones(), llum: 20 }, landmarks: creaLandmarks() }),
      cfg
    );
    expect(r.avisos).toEqual(['p3.msg.massaFosc']);
    expect(r.puntuacio).toBeLessThan(100);
  });
});
