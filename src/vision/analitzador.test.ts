import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { creaLandmarks, creaMatriu } from '../test/escena';
import { AMPLADA_ANALISI, creaAnalitzador, marcaTemps } from './analitzador';
import type { IModels } from './mediapipe';

interface IProva {
  detectForVideo: jest.Mock;
  segmentForVideo: jest.Mock;
  drawImage: jest.Mock;
  getImageData: jest.Mock;
  models: IModels;
}

function prepara(nCares: number): IProva {
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
  const segmentForVideo = jest.fn((_c: unknown, _ts: number, cb: (r: unknown) => void) => {
    const buffer = new Uint8Array(64 * 36).fill(1);
    cb({ categoryMask: { getAsUint8Array: () => buffer, width: 64, height: 36 } });
    // Després del callback el buffer original deixa de ser vàlid.
    buffer.fill(99);
  });
  const models = {
    landmarker: { detectForVideo },
    segmenter: { segmentForVideo },
    delegat: 'GPU',
    ms: 1
  } as unknown as IModels;
  return { detectForVideo, segmentForVideo, drawImage, getImageData, models };
}

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

describe('creaAnalitzador', () => {
  it('redueix el fotograma a 640 px d’amplada (entrada dels models i de les mètriques)', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    const mostra = an.analitza({} as CanvasImageSource, 1920, 1080);
    expect(mostra.ample).toBe(AMPLADA_ANALISI);
    expect(mostra.alt).toBe(360);
    expect(p.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 360);
    expect(p.getImageData).toHaveBeenCalledWith(0, 0, 640, 360);
  });

  it('no amplia un fotograma més petit de 640 px', () => {
    const p = prepara(1);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza({} as CanvasImageSource, 320, 240);
    expect(mostra.ample).toBe(320);
    expect(mostra.alt).toBe(240);
  });

  it('calcula les mesures amb landmarks, blendshapes, matriu i màscara', () => {
    const p = prepara(1);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza({} as CanvasImageSource, 1280, 720);
    expect(mostra.mesures.nCares).toBe(1);
    expect(mostra.mesures.bocaOberta).toBeCloseTo(0.07, 9);
    expect(mostra.mesures.yaw).toBeCloseTo(4, 4);
    expect(mostra.mascara?.data.length).toBe(64 * 36);
    // La màscara és una còpia: no es veu afectada pel buffer reutilitzat de MediaPipe.
    expect(mostra.mascara?.data.every((v) => v === 1 || v === 0)).toBe(true);
    expect(mostra.landmarks).toHaveLength(478);
  });

  it('les marques de temps que reben els models són estrictament creixents (mode VIDEO)', () => {
    const p = prepara(1);
    const an = creaAnalitzador(p.models, CONFIG_PER_DEFECTE);
    for (let i = 0; i < 5; i++) {
      an.analitza({} as CanvasImageSource, 1280, 720);
    }
    const marques = p.detectForVideo.mock.calls.map((c) => c[1] as number);
    marques.slice(1).forEach((m, i) => expect(m).toBeGreaterThan(marques[i]));
    const marquesSeg = p.segmentForVideo.mock.calls.map((c) => c[1] as number);
    expect(marquesSeg).toEqual(marques);
  });

  it('sense cara, no es fa la segmentació', () => {
    const p = prepara(0);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza({} as CanvasImageSource, 1280, 720);
    expect(mostra.mesures).toEqual({ nCares: 0 });
    expect(p.segmentForVideo).not.toHaveBeenCalled();
    expect(mostra.landmarks).toBeUndefined();
  });

  it('amb dues cares: només es compta el nombre de cares', () => {
    const p = prepara(2);
    const mostra = creaAnalitzador(p.models, CONFIG_PER_DEFECTE).analitza({} as CanvasImageSource, 1280, 720);
    expect(mostra.mesures).toEqual({ nCares: 2 });
    expect(p.segmentForVideo).not.toHaveBeenCalled();
  });

  it('RF-16: allibera buida el canvas d’anàlisi i ja no es pot fer servir', () => {
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
    an.analitza({} as CanvasImageSource, 1280, 720);
    expect(creats[0].width).toBe(640);
    an.allibera();
    expect(creats[0].width).toBe(0);
    expect(creats[0].height).toBe(0);
    expect(() => an.analitza({} as CanvasImageSource, 1280, 720)).toThrow();
    expect(() => an.allibera()).not.toThrow();
  });
});
