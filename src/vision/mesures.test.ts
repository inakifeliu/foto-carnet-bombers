import { LLINDARS, PARAMS_RETALL, creaImatge, creaLandmarks, creaMascara, creaMatriu } from '../test/escena';
import { rectangleVisor } from '../captura/retall';
import { geometriaCara } from './cara';
import { lluminancia, rgbAHsv } from './color';
import {
  ZONA_TORS,
  calculaMesures,
  diferenciaEsquerraDreta,
  lluminanciaMitjana,
  normalitzaMascara,
  proporcioFonsBlanc,
  proporcioPolo,
  varianciaLaplaciana,
  zonaInteriorCara,
  zonesTors
} from './mesures';

const TOT = { x: 0, y: 0, w: 1, h: 1 };

describe('color', () => {
  it('luminància Rec. 709', () => {
    expect(lluminancia(255, 255, 255)).toBeCloseTo(255, 6);
    expect(lluminancia(0, 0, 0)).toBe(0);
    expect(lluminancia(100, 100, 100)).toBeCloseTo(100, 6);
    expect(lluminancia(0, 255, 0)).toBeCloseTo(182.376, 2);
  });
  it('HSV: to, saturació i valor', () => {
    expect(rgbAHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 });
    const verd = rgbAHsv(0, 255, 0);
    expect(verd.h).toBeCloseTo(120, 6);
    const blau = rgbAHsv(0, 0, 255);
    expect(blau.h).toBeCloseTo(240, 6);
    expect(rgbAHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: 128 / 255 });
    expect(rgbAHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 });
    const magenta = rgbAHsv(255, 0, 128);
    expect(magenta.h).toBeGreaterThan(300);
  });
});

describe('luminància, ombres i nitidesa', () => {
  it('luminanciaMitjana d’una zona uniforme', () => {
    const img = creaImatge(40, 40, () => [100, 100, 100]);
    expect(lluminanciaMitjana(img, TOT)).toBeCloseTo(100, 6);
    expect(lluminanciaMitjana(img, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toBeCloseTo(100, 6);
  });

  it('zona buida: 0', () => {
    const img = creaImatge(10, 10, () => [200, 200, 200]);
    expect(lluminanciaMitjana(img, { x: 0.5, y: 0.5, w: 0, h: 0 })).toBe(0);
  });

  it('diferència esquerra/dreta: simètrica = 0; meitat fosca = diferència relativa a la mitjana', () => {
    const simetrica = creaImatge(40, 40, () => [120, 120, 120]);
    expect(diferenciaEsquerraDreta(simetrica, TOT)).toBeCloseTo(0, 9);
    const ombra = creaImatge(40, 40, (x) => (x < 20 ? [50, 50, 50] : [150, 150, 150]));
    expect(diferenciaEsquerraDreta(ombra, TOT)).toBeCloseTo(1, 6); // |50−150| / 100
    const lleu = creaImatge(40, 40, (x) => (x < 20 ? [110, 110, 110] : [130, 130, 130]));
    expect(diferenciaEsquerraDreta(lleu, TOT)).toBeCloseTo(20 / 120, 6);
  });

  it('variància del Laplacià: 0 en una imatge plana, alta amb tramat fi (nítida)', () => {
    const plana = creaImatge(40, 40, () => [128, 128, 128]);
    expect(varianciaLaplaciana(plana, TOT)).toBeCloseTo(0, 9);
    const nitida = creaImatge(40, 40, (x, y) => ((x + y) % 2 === 0 ? [138, 138, 138] : [118, 118, 118]));
    // Laplacià = ∓8·d, amb d = 10 → variància 6400.
    expect(varianciaLaplaciana(nitida, TOT)).toBeCloseTo(6400, 0);
  });

  it('una imatge borrosa (degradat suau) puntua molt menys que una de nítida', () => {
    const borrosa = creaImatge(60, 60, (x) => [x * 3, x * 3, x * 3]);
    expect(varianciaLaplaciana(borrosa, TOT)).toBeLessThan(1);
  });
});

describe('fons blanc (5.6)', () => {
  // Persona a l’esquerra (x < 5 de 10), fons a la dreta.
  const mascara = creaMascara(10, 10, (x) => x < 5);

  it('tot el fons blanc: proporció 1', () => {
    const img = creaImatge(100, 100, (x) => (x < 50 ? [150, 120, 100] : [240, 240, 240]));
    expect(proporcioFonsBlanc(img, mascara, TOT, LLINDARS)).toBeCloseTo(1, 6);
  });

  it('només els píxels de fons compten (la persona, encara que sigui fosca, no resta)', () => {
    const img = creaImatge(100, 100, (x) => (x < 50 ? [10, 10, 10] : [250, 250, 250]));
    expect(proporcioFonsBlanc(img, mascara, TOT, LLINDARS)).toBeCloseTo(1, 6);
  });

  it('meitat del fons gris: ~0,5; fons de color: 0', () => {
    const meitat = creaImatge(100, 100, (x, y) =>
      x < 50 ? [150, 120, 100] : y < 50 ? [240, 240, 240] : [120, 120, 120]
    );
    expect(proporcioFonsBlanc(meitat, mascara, TOT, LLINDARS)).toBeCloseTo(0.5, 1);
    const verd = creaImatge(100, 100, (x) => (x < 50 ? [150, 120, 100] : [60, 200, 90]));
    expect(proporcioFonsBlanc(verd, mascara, TOT, LLINDARS)).toBe(0);
    // Blanc càlid saturat (> 0,15) no és blanc.
    const crema = creaImatge(100, 100, (x) => (x < 50 ? [150, 120, 100] : [250, 200, 150]));
    expect(proporcioFonsBlanc(crema, mascara, TOT, LLINDARS)).toBe(0);
  });

  it('sense fons a la zona (tot persona): undefined', () => {
    const img = creaImatge(100, 100, () => [200, 200, 200]);
    expect(
      proporcioFonsBlanc(
        img,
        creaMascara(10, 10, () => true),
        TOT,
        LLINDARS
      )
    ).toBeUndefined();
  });

  it('només s’analitza la zona indicada', () => {
    const img = creaImatge(100, 100, (x, y) => (x < 50 ? [150, 120, 100] : y < 50 ? [240, 240, 240] : [60, 200, 90]));
    const zonaDalt = { x: 0.5, y: 0, w: 0.5, h: 0.5 };
    expect(proporcioFonsBlanc(img, mascara, zonaDalt, LLINDARS)).toBeCloseTo(1, 6);
  });
});

describe('polo blau (5.10)', () => {
  const mascara = creaMascara(10, 10, (x) => x < 5);

  it('persona vestida de blau polo: proporció 1', () => {
    const img = creaImatge(100, 100, (x) => (x < 50 ? [20, 40, 140] : [240, 240, 240]));
    expect(proporcioPolo(img, mascara, TOT, LLINDARS)).toBeCloseTo(1, 6);
  });

  it('jersei vermell, gris o massa clar: 0', () => {
    const vermell = creaImatge(100, 100, (x) => (x < 50 ? [180, 30, 30] : [240, 240, 240]));
    expect(proporcioPolo(vermell, mascara, TOT, LLINDARS)).toBe(0);
    const gris = creaImatge(100, 100, (x) => (x < 50 ? [110, 110, 120] : [240, 240, 240]));
    expect(proporcioPolo(gris, mascara, TOT, LLINDARS)).toBe(0);
    const clar = creaImatge(100, 100, (x) => (x < 50 ? [150, 190, 250] : [240, 240, 240]));
    expect(proporcioPolo(clar, mascara, TOT, LLINDARS)).toBe(0); // valor 0,98 > 0,65
  });

  it('el fons blau no compta: només els píxels de persona', () => {
    const img = creaImatge(100, 100, (x) => (x < 50 ? [200, 150, 120] : [20, 40, 140]));
    expect(proporcioPolo(img, mascara, TOT, LLINDARS)).toBe(0);
  });

  it('polo a la meitat dels píxels de persona: ~0,5', () => {
    const img = creaImatge(100, 100, (x, y) => (x < 50 ? (y < 50 ? [20, 40, 140] : [200, 150, 120]) : [240, 240, 240]));
    expect(proporcioPolo(img, mascara, TOT, LLINDARS)).toBeCloseTo(0.5, 1);
  });

  it('sense persona a la zona: 0', () => {
    const img = creaImatge(100, 100, () => [20, 40, 140]);
    expect(
      proporcioPolo(
        img,
        creaMascara(10, 10, () => false),
        TOT,
        LLINDARS
      )
    ).toBe(0);
  });
});

describe('zona del tors (5.10, 5.11)', () => {
  it('amplada 1,6 × la cara, centrada, per sota de la barbeta', () => {
    const g = geometriaCara(creaLandmarks({ yFront: 0.3, yBarbeta: 0.6, ample: 0.2 }));
    expect(g).toBeDefined();
    if (!g) {
      return;
    }
    const z = zonesTors(g);
    expect(z.nominal.w).toBeCloseTo(1.6 * 0.2, 9);
    expect(z.nominal.x + z.nominal.w / 2).toBeCloseTo(0.5, 9);
    expect(z.nominal.y).toBeCloseTo(0.6 + ZONA_TORS.inici * 0.3, 9);
    expect(z.fraccioVisible).toBeCloseTo(1, 9);
  });

  it('tallada pel límit inferior del fotograma: fracció visible parcial', () => {
    const g = geometriaCara(creaLandmarks({ yFront: 0.5, yBarbeta: 0.85, ample: 0.2 }));
    if (!g) {
      throw new Error('sense geometria');
    }
    const z = zonesTors(g);
    expect(z.fraccioVisible).toBeLessThan(0.5);
    expect(z.visible.y + z.visible.h).toBeLessThanOrEqual(1);
  });

  it('tallada pels costats: fracció visible parcial', () => {
    const g = geometriaCara(creaLandmarks({ centreX: 0.05, yFront: 0.3, yBarbeta: 0.6, ample: 0.2 }));
    if (!g) {
      throw new Error('sense geometria');
    }
    expect(zonesTors(g).fraccioVisible).toBeLessThan(0.7);
  });

  it('zona interior de la cara dins la caixa de la cara', () => {
    const g = geometriaCara(creaLandmarks());
    if (!g) {
      throw new Error('sense geometria');
    }
    const z = zonaInteriorCara(g);
    expect(z.x).toBeGreaterThan(g.centreX - g.ample / 2);
    expect(z.x + z.w).toBeLessThan(g.centreX + g.ample / 2);
  });
});

describe('normalitzaMascara', () => {
  it('l’etiqueta de persona és la del centre de la cara, sigui quin sigui el seu valor', () => {
    // Persona = 255, fons = 0
    const a = normalitzaMascara(
      { data: Uint8Array.from({ length: 100 }, (_v, i) => (i % 10 < 5 ? 255 : 0)), w: 10, h: 10 },
      { x: 0.2, y: 0.5 }
    );
    expect(a?.data[0]).toBe(1);
    expect(a?.data[9]).toBe(0);
    // Persona = 0, fons = 1 (etiquetes invertides)
    const b = normalitzaMascara(
      { data: Uint8Array.from({ length: 100 }, (_v, i) => (i % 10 < 5 ? 0 : 1)), w: 10, h: 10 },
      { x: 0.2, y: 0.5 }
    );
    expect(b?.data[0]).toBe(1);
    expect(b?.data[9]).toBe(0);
  });

  it('reutilitza el buffer de sortida si té la mida justa (sense reservar memòria nova)', () => {
    const bruta = { data: Uint8Array.from({ length: 100 }, (_v, i) => (i % 10 < 5 ? 255 : 0)), w: 10, h: 10 };
    const primera = normalitzaMascara(bruta, { x: 0.2, y: 0.5 });
    const segona = normalitzaMascara({ ...bruta, data: bruta.data.map((v) => 255 - v) }, { x: 0.8, y: 0.5 }, primera);
    expect(segona?.data).toBe(primera?.data);
    // El buffer reutilitzat s'ha sobreescrit amb la màscara nova.
    expect(segona?.data[0]).toBe(0);
    expect(segona?.data[9]).toBe(1);
    // Amb una mida diferent no es pot reutilitzar: se'n crea un de nou.
    const gran = normalitzaMascara({ data: new Uint8Array(400), w: 20, h: 20 }, { x: 0.5, y: 0.5 }, primera);
    expect(gran?.data).not.toBe(primera?.data);
    expect(gran?.data.length).toBe(400);
  });

  it('màscara buida o inconsistent: undefined', () => {
    expect(normalitzaMascara({ data: new Uint8Array(0), w: 0, h: 0 }, { x: 0.5, y: 0.5 })).toBeUndefined();
    expect(normalitzaMascara({ data: new Uint8Array(5), w: 10, h: 10 }, { x: 0.5, y: 0.5 })).toBeUndefined();
  });
});

describe('calculaMesures (escena sintètica 640×360)', () => {
  const W = 640;
  const H = 360;
  /** Cap x∈[.40,.60], y∈[.22,.62]; tors x∈[.25,.75], y∈[.62,1]; fons blanc; tors blau polo; cara amb tramat. */
  const esPersona = (x: number, y: number): boolean => {
    const fx = x / W;
    const fy = y / H;
    return (fx >= 0.4 && fx <= 0.6 && fy >= 0.22 && fy <= 0.62) || (fx >= 0.25 && fx <= 0.75 && fy >= 0.62);
  };
  const imatge = creaImatge(W, H, (x, y) => {
    if (!esPersona(x, y)) {
      return [240, 240, 240];
    }
    if (y / H >= 0.62) {
      return [20, 40, 140];
    }
    return (x + y) % 2 === 0 ? [160, 130, 110] : [140, 110, 90];
  });
  const mascaraBruta = (() => {
    const m = creaMascara(64, 36, (x, y) => esPersona(((x + 0.5) / 64) * W, ((y + 0.5) / 36) * H));
    return { data: m.data.map((v) => (v === 1 ? 255 : 0)), w: 64, h: 36 };
  })();

  it('amb una cara, calcula totes les mesures coherents', () => {
    const r = calculaMesures(
      {
        imatge,
        cares: [creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.62, ample: 0.2 })],
        blendshapes: { eyeBlinkLeft: 0.1, eyeBlinkRight: 0.3, jawOpen: 0.05 },
        matriu: creaMatriu(5, -3, 2),
        mascaraBruta
      },
      LLINDARS,
      PARAMS_RETALL
    );
    const m = r.mesures;
    expect(m.nCares).toBe(1);
    expect(m.desviacio).toBeCloseTo(0, 6);
    expect(m.alcadaCara).toBeCloseTo(0.32, 6);
    expect(m.yaw).toBeCloseTo(5, 4);
    expect(m.pitch).toBeCloseTo(-3, 4);
    expect(m.roll).toBeCloseTo(2, 4);
    expect(m.parpelleig).toBeCloseTo(0.3, 6);
    expect(m.bocaOberta).toBeCloseTo(0.05, 6);
    expect(m.llum).toBeGreaterThan(120);
    expect(m.llum).toBeLessThan(160);
    expect(m.ombra).toBeLessThan(0.05);
    expect(m.nitidesa).toBeGreaterThan(100); // tramat fi
    // La màscara és de 64×36: les cel·les de la vora del cap (de 10 px) en deixen una part com a «fons».
    expect(m.fons).toBeGreaterThan(0.7);
    expect(m.polo).toBeCloseTo(1, 2);
    expect(m.torsVisible).toBeCloseTo(1, 6);
    expect(r.retall?.origenCap).toBe('mascara');
    expect(r.mascara).toBeDefined();
    expect(r.zonaFons).toBeDefined();
    expect(r.zonaTors).toBeDefined();
  });

  it('el signe dels angles es pot invertir amb la configuració', () => {
    const r = calculaMesures(
      { imatge, cares: [creaLandmarks()], matriu: creaMatriu(10, 6, 0) },
      { ...LLINDARS, yawSigne: -1, pitchSigne: -1 },
      PARAMS_RETALL
    );
    expect(r.mesures.yaw).toBeCloseTo(-10, 4);
    expect(r.mesures.pitch).toBeCloseTo(-6, 4);
  });

  it('sense màscara: no hi ha fons ni polo i el retall surt dels landmarks', () => {
    const r = calculaMesures({ imatge, cares: [creaLandmarks()] }, LLINDARS, PARAMS_RETALL);
    expect(r.mesures.fons).toBeUndefined();
    expect(r.mesures.polo).toBeUndefined();
    expect(r.retall?.origenCap).toBe('landmarks');
  });

  it('0 cares o més d’una: només el nombre de cares', () => {
    expect(calculaMesures({ imatge, cares: [] }, LLINDARS, PARAMS_RETALL).mesures).toEqual({ nCares: 0 });
    expect(
      calculaMesures({ imatge, cares: [creaLandmarks(), creaLandmarks()] }, LLINDARS, PARAMS_RETALL).mesures
    ).toEqual({
      nCares: 2
    });
  });

  it('fons no blanc darrere la persona: la proporció de fons blanc baixa', () => {
    const verd = creaImatge(W, H, (x, y) => (esPersona(x, y) ? [20, 40, 140] : [60, 180, 90]));
    const r = calculaMesures({ imatge: verd, cares: [creaLandmarks()], mascaraBruta }, LLINDARS, PARAMS_RETALL);
    expect(r.mesures.fons).toBe(0);
  });

  it('habitació fosca: la llum de la cara baixa', () => {
    const fosca = creaImatge(W, H, () => [30, 30, 30]);
    const r = calculaMesures({ imatge: fosca, cares: [creaLandmarks()] }, LLINDARS, PARAMS_RETALL);
    expect(r.mesures.llum).toBeCloseTo(30, 3);
  });
});

describe('calculaMesures: la màscara pot tenir qualsevol mida (coordenades normalitzades)', () => {
  const W = 640;
  const H = 360;
  const esPersona = (fx: number, fy: number): boolean =>
    (fx >= 0.4 && fx <= 0.6 && fy >= 0.22 && fy <= 0.62) || (fx >= 0.25 && fx <= 0.75 && fy >= 0.62);
  const imatge = creaImatge(W, H, (x, y) => {
    if (!esPersona(x / W, y / H)) {
      return [240, 240, 240];
    }
    return y / H >= 0.62 ? [20, 40, 140] : (x + y) % 2 === 0 ? [160, 130, 110] : [140, 110, 90];
  });
  const mascaraDe = (w: number, h: number): { data: Uint8Array; w: number; h: number } => {
    const m = creaMascara(w, h, (x, y) => esPersona((x + 0.5) / w, (y + 0.5) / h));
    return { data: m.data.map((v) => (v === 1 ? 255 : 0)), w, h };
  };
  const cara = creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.62, ample: 0.2 });

  it.each([
    [64, 36, 0.7],
    [256, 144, 0.9],
    [640, 360, 0.9]
  ])(
    'mascara %i×%i dona fons, polo i retall coherents (la vora de la màscara és més tosca com més petita)',
    (w, h, fonsMin) => {
      const r = calculaMesures({ imatge, cares: [cara], mascaraBruta: mascaraDe(w, h) }, LLINDARS, PARAMS_RETALL);
      expect(r.mesures.fons).toBeGreaterThan(fonsMin);
      expect(r.mesures.polo).toBeGreaterThan(0.9);
      expect(r.mascara?.w).toBe(w);
      expect(r.retall?.origenCap).toBe('mascara');
      expect(r.retall?.capY).toBeCloseTo(0.22 * H, -1);
    }
  );

  it('una màscara ja normalitzada (`mascara`) té prioritat i s’usa tal qual (memòria cau entre segmentacions)', () => {
    const normalitzada = creaMascara(256, 144, (x, y) => esPersona((x + 0.5) / 256, (y + 0.5) / 144));
    const r = calculaMesures(
      { imatge, cares: [cara], mascara: normalitzada, mascaraBruta: mascaraDe(64, 36) },
      LLINDARS,
      PARAMS_RETALL
    );
    expect(r.mascara).toBe(normalitzada);
  });

  it('sense màscara, el retall surt dels landmarks i el fons i el polo no es mesuren', () => {
    const r = calculaMesures({ imatge, cares: [cara] }, LLINDARS, PARAMS_RETALL);
    expect(r.mesures.fons).toBeUndefined();
    expect(r.mesures.polo).toBeUndefined();
    expect(r.retall?.origenCap).toBe('landmarks');
    expect(r.retall?.capY).toBeCloseTo((0.3 - 0.25 * 0.32) * H, 4);
  });
});

describe('calculaMesures amb enquadrament «visor»', () => {
  const VISOR = { ...PARAMS_RETALL, enquadrament: 'visor' as const };
  const blanc = (w: number, h: number): ReturnType<typeof creaImatge> => creaImatge(w, h, () => [240, 240, 240]);
  const cara = creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.5, ample: 0.1 });

  it.each([
    [640, 360],
    [640, 480],
    [360, 640]
  ])('càmera %i×%i: el retall previst i la zona de fons són el rectangle del visor', (w, h) => {
    const r = calculaMesures(
      { imatge: blanc(w, h), cares: [cara], mascara: creaMascara(64, 36, () => false) },
      LLINDARS,
      VISOR
    );
    const v = rectangleVisor(w, h);
    expect(r.retall?.rect).toEqual(v);
    expect(r.retall?.origenCap).toBe('visor');
    expect(r.retall?.fraccioFora).toBe(0);
    expect(r.zonaFons?.x).toBeCloseTo(v.x / w, 9);
    expect(r.zonaFons?.y).toBeCloseTo(v.y / h, 9);
    expect(r.zonaFons?.w).toBeCloseTo(v.w / w, 9);
    expect(r.zonaFons?.h).toBeCloseTo(v.h / h, 9);
  });

  it('la distància és relativa a l’alçada del visor (en 16:9 coincideix amb la del fotograma)', () => {
    const a = calculaMesures({ imatge: blanc(640, 360), cares: [cara] }, LLINDARS, VISOR);
    expect(a.mesures.alcadaCara).toBeCloseTo(0.2, 6);
    // Càmera vertical 360×640: el visor fa 360×463.
    const b = calculaMesures({ imatge: blanc(360, 640), cares: [cara] }, LLINDARS, VISOR);
    expect(b.mesures.alcadaCara).toBeCloseTo(0.2 / (rectangleVisor(360, 640).h / 640), 6);
    // Sense «visor» (RF-07 «cap») continua sent relativa al fotograma.
    const c = calculaMesures({ imatge: blanc(360, 640), cares: [cara] }, LLINDARS, PARAMS_RETALL);
    expect(c.mesures.alcadaCara).toBeCloseTo(0.2, 6);
  });

  it('5.11: la zona del tors es limita al visor (no al fotograma)', () => {
    // Cara estreta: la zona (2,2 × 0,1 = 0,22 del fotograma) cap al visor 16:9 (0,4375 de l'amplada).
    const dins = calculaMesures({ imatge: blanc(640, 360), cares: [cara] }, LLINDARS, VISOR);
    expect(dins.mesures.torsVisible).toBeCloseTo(1, 6);
    // Cara molt ampla: la zona sobresurt del visor però no del fotograma.
    const ampla = creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.5, ample: 0.3 });
    const r = calculaMesures({ imatge: blanc(640, 360), cares: [ampla] }, LLINDARS, VISOR);
    expect(r.mesures.torsVisible).toBeLessThan(0.7);
    const sense = calculaMesures({ imatge: blanc(640, 360), cares: [ampla] }, LLINDARS, PARAMS_RETALL);
    expect(sense.mesures.torsVisible).toBeGreaterThan(r.mesures.torsVisible ?? 1);
  });
});
