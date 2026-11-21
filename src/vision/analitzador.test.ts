import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { creaLandmarks, creaMatriu } from '../test/escena';
import {
  AMPLADA_ANALISI,
  AMPLADA_SEGMENTACIO_DIRECTE,
  FALLADES_SEGMENTACIO_MAXIM,
  creaAnalitzador,
  marcaTemps
} from './analitzador';
import type { IModels } from './mediapipe';

interface IProva {
  detectForVideo: jest.Mock;
  segmentForVideo: jest.Mock;
  drawImage: jest.Mock;
  getImageData: jest.Mock;
  models: IModels;
}

interface IOpcionsProva {
  /** Sense segmentador (no s'ha pogut carregar). */
  senseSegmentador?: boolean;
  /** Mides de la màscara que torna el segmentador. */
  mascara?: { w: number; h: number };
}

function prepara(nCares: number, opcions: IOpcionsProva = {}): IProva {
  const drawImage = jest.fn();
  const getImageData = jest.fn((_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4).fill(200),
    width: w,
    height: h
  }));
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage, getImageData } as unknown as RenderingContext);
  const detectForVideo = jest.fn(() => ({
    faceLandmarks: Array.from({ length: nCares }, () => creaLandmarks()),
    faceBlendshapes: nCares > 0 ? [{ categories: [{ categoryName: 'jawOpen', score: 0.07 }] }] : [],
    facialTransformationMatrixes: nCares > 0 ? [creaMatriu(4, 0, 0)] : []
  }));
  const { w, h } = opcions.mascara ?? { w: 64, h: 36 };
  const segmentForVideo = jest.fn((_c: unknown, _ts: number, cb: (r: unknown) => void) => {
    const buffer = new Uint8Array(w * h).fill(1);
    cb({ categoryMask: { getAsUint8Array: () => buffer, width: w, height: h } });
    // Després del callback el buffer original deixa de ser vàlid.
    buffer.fill(99);
  });
  const models = {
    landmarker: { detectForVideo },
    segmenter: opcions.senseSegmentador ? undefined : { segmentForVideo },
    delegat: 'GPU',
    ms: 1,
    msEscalfament: 1
  } as unknown as IModels;
  return { detectForVideo, segmentForVideo, drawImage, getImageData, models };
}

const font = {} as CanvasImageSource;

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('marcaTemps', () => {
  it('és estrictament creixent encara que es cridi a la mateixa mil·lèsima', () => {
    const a = marcaTemps();
    const b = marcaTemps();
    const c = marcaTemps();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});

describe('creaAnalitzador: entrada i mesures', () => {
  it('redueix el fotograma a 640 px d’amplada (entrada del Face Landmarker i de les mètriques)', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    const mostra = an.analitza(font, 1920, 1080);
    expect(mostra.ample).toBe(AMPLADA_ANALISI);
    expect(mostra.alt).toBe(360);
    expect(p.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 360);
    expect(p.getImageData).toHaveBeenCalledWith(0, 0, 640, 360);
    const canvasLandmarker = p.detectForVideo.mock.calls[0][0] as HTMLCanvasElement;
    expect(canvasLandmarker.width).toBe(640);
  });

  it('no amplia un fotograma més petit de 640 px', () => {
    const p = prepara(1);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 320, 240);
    expect(mostra.ample).toBe(320);
    expect(mostra.alt).toBe(240);
  });

  it('calcula les mesures amb landmarks, blendshapes, matriu i màscara', () => {
    const p = prepara(1);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 1280, 720);
    expect(mostra.mesures.nCares).toBe(1);
    expect(mostra.mesures.bocaOberta).toBeCloseTo(0.07, 9);
    expect(mostra.mesures.yaw).toBeCloseTo(4, 4);
    expect(mostra.mascara?.data.length).toBe(64 * 36);
    // La màscara és una còpia: no es veu afectada pel buffer reutilitzat de MediaPipe.
    expect(mostra.mascara?.data.every((v) => v === 1 || v === 0)).toBe(true);
    expect(mostra.landmarks).toHaveLength(478);
    expect(mostra.segmentacio).toBe(true);
  });

  it('les marques de temps són estrictament creixents (mode VIDEO), també per al segmentador', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 1 });
    for (let i = 0; i < 5; i++) {
      an.analitza(font, 1280, 720);
    }
    const marques = p.detectForVideo.mock.calls.map((c) => c[1] as number);
    marques.slice(1).forEach((m, i) => expect(m).toBeGreaterThan(marques[i]));
    const marquesSeg = p.segmentForVideo.mock.calls.map((c) => c[1] as number);
    expect(marquesSeg).toEqual(marques);
  });

  it('sense cara, no es fa la segmentació', () => {
    const p = prepara(0);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 1280, 720);
    expect(mostra.mesures).toEqual({ nCares: 0 });
    expect(p.segmentForVideo).not.toHaveBeenCalled();
    expect(mostra.landmarks).toBeUndefined();
    expect(mostra.segmentat).toBe(false);
  });

  it('amb dues cares: només es compta el nombre de cares', () => {
    const p = prepara(2);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 1280, 720);
    expect(mostra.mesures).toEqual({ nCares: 2 });
    expect(p.segmentForVideo).not.toHaveBeenCalled();
  });

  it('RF-16: allibera buida els canvas d’anàlisi i ja no es pot fer servir', () => {
    const p = prepara(1);
    const creats: HTMLCanvasElement[] = [];
    const original = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = original(tag);
      if (tag === 'canvas') {
        creats.push(el as HTMLCanvasElement);
      }
      return el;
    }) as typeof document.createElement);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    an.analitza(font, 1280, 720);
    expect(creats[0].width).toBe(640);
    expect(creats).toHaveLength(2); // el principal i el reduït del segmentador
    expect(creats[1].width).toBe(AMPLADA_SEGMENTACIO_DIRECTE);
    an.allibera();
    creats.forEach((c) => {
      expect(c.width).toBe(0);
      expect(c.height).toBe(0);
    });
    expect(() => an.analitza(font, 1280, 720)).toThrow();
    expect(() => an.allibera()).not.toThrow();
  });
});

describe('creaAnalitzador: segmentació espaiada i d’entrada reduïda (rendiment)', () => {
  it('en directe, segmenta a la primera anàlisi i després cada N (per defecte 3), reaprofitant la màscara', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    const mostres = Array.from({ length: 7 }, () => an.analitza(font, 1280, 720));
    expect(p.segmentForVideo).toHaveBeenCalledTimes(3); // anàlisis 1, 4 i 7
    expect(mostres.map((m) => m.segmentat)).toEqual([true, false, false, true, false, false, true]);
    // Totes tenen màscara (la de l'última segmentació) i segmentació disponible.
    mostres.forEach((m) => {
      expect(m.mascara).toBeDefined();
      expect(m.segmentacio).toBe(true);
    });
    expect(mostres[1].mascara?.data).toBe(mostres[0].mascara?.data);
  });

  it('la cadència es pot canviar per crida (pressupost adaptatiu) i per opció de l’analitzador', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 2 });
    for (let i = 0; i < 4; i++) {
      an.analitza(font, 1280, 720);
    }
    expect(p.segmentForVideo).toHaveBeenCalledTimes(2);
    p.segmentForVideo.mockClear();
    const an2 = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    for (let i = 0; i < 12; i++) {
      an2.analitza(font, 1280, 720, { segmentaCada: 6 });
    }
    expect(p.segmentForVideo).toHaveBeenCalledTimes(2);
  });

  it('en directe el segmentador rep una entrada reduïda (256 px) i el Face Landmarker, la de 640 px', () => {
    const p = prepara(1);
    creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 1920, 1080);
    const entradaSeg = p.segmentForVideo.mock.calls[0][0] as HTMLCanvasElement;
    const entradaLandmarker = p.detectForVideo.mock.calls[0][0] as HTMLCanvasElement;
    expect(entradaSeg).not.toBe(entradaLandmarker);
    expect(entradaSeg.width).toBe(AMPLADA_SEGMENTACIO_DIRECTE);
    expect(entradaSeg.height).toBe(144);
    expect(entradaLandmarker.width).toBe(640);
    // La còpia reduïda es dibuixa a partir del canvas de 640, no del vídeo.
    expect(p.drawImage).toHaveBeenCalledWith(entradaLandmarker, 0, 0, 256, 144);
  });

  it('a la captura SEMPRE se segmenta, amb l’entrada de 640 px (resolució actual)', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    an.analitza(font, 1280, 720); // omple la memòria cau
    p.segmentForVideo.mockClear();
    const a = an.analitza(font, 1920, 1080, { captura: true });
    const b = an.analitza(font, 1920, 1080, { captura: true });
    expect(p.segmentForVideo).toHaveBeenCalledTimes(2);
    expect(a.segmentat && b.segmentat).toBe(true);
    const entrada = p.segmentForVideo.mock.calls[0][0] as HTMLCanvasElement;
    expect(entrada).toBe(p.detectForVideo.mock.calls[1][0]);
    expect(entrada.width).toBe(640);
  });

  it('la captura no toca la màscara reaprofitada del bucle en directe', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    const directe = an.analitza(font, 1280, 720);
    const dadesDirecte = directe.mascara?.data;
    const captura = an.analitza(font, 1280, 720, { captura: true });
    expect(captura.mascara?.data).not.toBe(dadesDirecte);
  });

  it('una màscara de mida diferent de la imatge (256×144 sobre 640×360) s’accepta tal qual (coordenades normalitzades)', () => {
    const p = prepara(1, { mascara: { w: 256, h: 144 } });
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 1280, 720);
    expect(mostra.mascara?.w).toBe(256);
    expect(mostra.mascara?.h).toBe(144);
    expect(mostra.ample).toBe(640);
    // Els landmarks i les zones segueixen sent normalitzats respecte al fotograma, no a la màscara.
    expect(mostra.zonaCara?.w).toBeLessThanOrEqual(1);
    expect(mostra.landmarks?.[10].y).toBeCloseTo(0.3, 6);
  });

  it('si la cara desapareix, la màscara reaprofitada s’oblida i es torna a segmentar en tornar', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    an.analitza(font, 1280, 720);
    p.detectForVideo.mockReturnValueOnce({ faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] });
    const sense = an.analitza(font, 1280, 720);
    expect(sense.mascara).toBeUndefined();
    const tornada = an.analitza(font, 1280, 720);
    expect(tornada.segmentat).toBe(true);
    expect(p.segmentForVideo).toHaveBeenCalledTimes(2);
  });

  it('una màscara massa antiga es descarta i es torna a segmentar', () => {
    const p = prepara(1);
    const ara = jest.spyOn(performance, 'now');
    ara.mockReturnValue(1000);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 100 });
    an.analitza(font, 1280, 720);
    ara.mockReturnValue(1500);
    expect(an.analitza(font, 1280, 720).segmentat).toBe(false);
    ara.mockReturnValue(3000);
    expect(an.analitza(font, 1280, 720).segmentat).toBe(true);
  });

  it('reutilitza el buffer de la màscara entre segmentacions successives (sense reserves per fotograma)', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 1 });
    const a = an.analitza(font, 1280, 720);
    const b = an.analitza(font, 1280, 720);
    expect(b.segmentat).toBe(true);
    expect(b.mascara?.data).toBe(a.mascara?.data);
  });
});

describe('creaAnalitzador: temps per pas', () => {
  it('informa del temps de cada pas; el del segmentador és 0 si no s’ha segmentat', () => {
    const p = prepara(1);
    const ara = jest.spyOn(performance, 'now');
    let t = 0;
    ara.mockImplementation(() => (t += 2));
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    const primera = an.analitza(font, 1280, 720);
    const segona = an.analitza(font, 1280, 720);
    (['dibuix', 'landmarker', 'segmentador', 'metriques'] as const).forEach((k) => {
      expect(primera.temps[k]).toBeGreaterThanOrEqual(0);
    });
    expect(primera.temps.segmentador).toBeGreaterThan(0);
    expect(primera.temps.dibuix).toBeGreaterThan(0);
    expect(primera.temps.landmarker).toBeGreaterThan(0);
    expect(segona.segmentat).toBe(false);
    expect(segona.temps.segmentador).toBe(0);
  });
});

describe('creaAnalitzador: segmentador opcional i errors de segmentació', () => {
  it('sense segmentador (no s’ha pogut carregar): el Face Landmarker funciona, segmentacio = false i sense màscara', () => {
    const p = prepara(1, { senseSegmentador: true });
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza(font, 1280, 720);
    expect(mostra.mesures.nCares).toBe(1);
    expect(mostra.mesures.yaw).toBeCloseTo(4, 4);
    expect(mostra.segmentacio).toBe(false);
    expect(mostra.segmentat).toBe(false);
    expect(mostra.mascara).toBeUndefined();
    expect(mostra.mesures.fons).toBeUndefined();
    expect(mostra.mesures.polo).toBeUndefined();
    // El retall segueix sortint dels landmarks (landmark 10 + 0,25 × alçada).
    expect(mostra.retall?.origenCap).toBe('landmarks');
  });

  it('un error de segmentació no propaga: l’anàlisi de la cara continua', () => {
    const p = prepara(1);
    p.segmentForVideo.mockImplementation(() => {
      throw new Error('segmentació trencada');
    });
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    let mostra;
    expect(() => {
      mostra = an.analitza(font, 1280, 720);
    }).not.toThrow();
    expect(mostra).toMatchObject({ mesures: { nCares: 1 }, segmentacio: true, segmentat: true });
    expect((mostra as unknown as { mascara?: unknown }).mascara).toBeUndefined();
  });

  it('després de diversos errors seguits la segmentació es desactiva i ja no es crida el segmentador', () => {
    const p = prepara(1);
    p.segmentForVideo.mockImplementation(() => {
      throw new Error('segmentació trencada');
    });
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 1 });
    const mostres = Array.from({ length: FALLADES_SEGMENTACIO_MAXIM + 3 }, () => an.analitza(font, 1280, 720));
    expect(p.segmentForVideo).toHaveBeenCalledTimes(FALLADES_SEGMENTACIO_MAXIM);
    expect(mostres[FALLADES_SEGMENTACIO_MAXIM - 2].segmentacio).toBe(true);
    expect(mostres[FALLADES_SEGMENTACIO_MAXIM - 1].segmentacio).toBe(false);
    expect(mostres[mostres.length - 1].segmentacio).toBe(false);
    // Tampoc a la captura.
    p.segmentForVideo.mockClear();
    expect(an.analitza(font, 1280, 720, { captura: true }).segmentacio).toBe(false);
    expect(p.segmentForVideo).not.toHaveBeenCalled();
  });

  it('un error aïllat no desactiva la segmentació: el comptador es reinicia amb un èxit', () => {
    const p = prepara(1);
    const bo = p.segmentForVideo.getMockImplementation();
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 1 });
    for (let ronda = 0; ronda < 3; ronda++) {
      p.segmentForVideo.mockImplementationOnce(() => {
        throw new Error('puntual');
      });
      p.segmentForVideo.mockImplementationOnce(() => {
        throw new Error('puntual');
      });
      an.analitza(font, 1280, 720);
      an.analitza(font, 1280, 720);
      p.segmentForVideo.mockImplementation(bo);
      expect(an.analitza(font, 1280, 720).segmentacio).toBe(true);
    }
  });

  it('un segmentador que no retorna cap màscara compta com a error', () => {
    const p = prepara(1);
    p.segmentForVideo.mockImplementation((_c: unknown, _ts: number, cb: (r: unknown) => void) => cb({}));
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE, { segmentaCada: 1 });
    for (let i = 0; i < FALLADES_SEGMENTACIO_MAXIM; i++) {
      an.analitza(font, 1280, 720);
    }
    expect(an.analitza(font, 1280, 720).segmentacio).toBe(false);
  });
});
