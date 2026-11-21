import { registre } from '../cleanup/neteja';

const crea = {
  landmarker: jest.fn(),
  segmenter: jest.fn()
};
const revocaUrlsBlob = jest.fn();

jest.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { createFromOptions: (...a: unknown[]) => crea.landmarker(...a) },
  ImageSegmenter: { createFromOptions: (...a: unknown[]) => crea.segmenter(...a) }
}));
jest.mock('../recursos', () => ({
  obteUrlBlob: jest.fn(async (nom: string) => `blob:${nom}`),
  obteRecurs: jest.fn(async (nom: string) => new Uint8Array([nom.length])),
  revocaUrlsBlob: (...a: unknown[]) => revocaUrlsBlob(...a)
}));

import { carregaModels, esErrorGpu, modelsCarregats, tancaModels } from './mediapipe';

const model = (): { close: jest.Mock; detectForVideo: jest.Mock; segmentForVideo: jest.Mock } => ({
  close: jest.fn(),
  detectForVideo: jest.fn(),
  segmentForVideo: jest.fn()
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  crea.landmarker.mockReset();
  crea.segmenter.mockReset();
  revocaUrlsBlob.mockReset();
  crea.landmarker.mockImplementation(async () => model());
  crea.segmenter.mockImplementation(async () => model());
});

afterEach(() => {
  jest.restoreAllMocks();
  tancaModels();
  registre.neteja();
  document.body.innerHTML = '';
});

describe('esErrorGpu (RF-02)', () => {
  it.each([
    'WebGL context lost',
    'Failed to create WebGL canvas context',
    'EGL error: BAD_ALLOC',
    'GPU delegate could not be initialized',
    'OpenGL ES 3.0 not supported',
    'Failed to compile shader',
    'Texture creation failed',
    'EGL_BAD_ALLOC',
    'GL_INVALID_OPERATION: glTexImage2D',
    'TfLiteGpuDelegate Init: No shader implementation',
    'OpenCL library not loaded',
    'Cannot read WebGLRenderingContext',
    'CONTEXT_LOST_WEBGL',
    'The context was lost',
    'Failed to create glContext',
    'Framebuffer is incomplete',
    'Unable to initialize graphics'
  ])('%s és un error de GPU', (missatge) => {
    expect(esErrorGpu(new Error(missatge))).toBe(true);
  });

  it.each([
    'Model corrupte',
    'WebAssembly.instantiate(): out of memory',
    'Failed to fetch',
    'Recurs incrustat desconegut: model-cara',
    'Unexpected token',
    'Negligible difference in tensor shapes',
    'Single value expected',
    'Unexpected end of JSON input'
  ])('%s NO és un error de GPU', (missatge) => {
    expect(esErrorGpu(new Error(missatge))).toBe(false);
  });

  it('accepta valors que no són Error', () => {
    expect(esErrorGpu('webgl no disponible')).toBe(true);
    expect(esErrorGpu(undefined)).toBe(false);
  });
});

describe('carregaModels', () => {
  it('crea el Face Landmarker (VIDEO, 2 cares, blendshapes i matriu) i el segmentador amb GPU', async () => {
    const m = await carregaModels({ webGL2: true });
    expect(m.delegat).toBe('GPU');
    expect(crea.landmarker).toHaveBeenCalledTimes(1);
    const [fileset, opcions] = crea.landmarker.mock.calls[0];
    expect(fileset).toEqual({ wasmLoaderPath: 'blob:wasm-loader', wasmBinaryPath: 'blob:wasm-binari' });
    expect(opcions).toMatchObject({
      baseOptions: { delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
    expect(opcions.baseOptions.modelAssetBuffer).toBeInstanceOf(Uint8Array);
    const [, opcionsSeg] = crea.segmenter.mock.calls[0];
    expect(opcionsSeg).toMatchObject({
      baseOptions: { delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputCategoryMask: true
    });
    expect(modelsCarregats()).toBe(m);
  });

  it('retrocés a CPU només si l’error és propi de la GPU', async () => {
    crea.landmarker.mockImplementationOnce(async () => {
      throw new Error('WebGL context creation failed');
    });
    const m = await carregaModels({ webGL2: true });
    expect(m.delegat).toBe('CPU');
    expect(crea.landmarker).toHaveBeenCalledTimes(2);
    expect(crea.landmarker.mock.calls[1][1].baseOptions.delegate).toBe('CPU');
    expect(crea.segmenter.mock.calls[0][1].baseOptions.delegate).toBe('CPU');
  });

  it('un error que no és de la GPU es propaga sense reintentar amb CPU', async () => {
    crea.landmarker.mockImplementation(async () => {
      throw new Error('Model corrupte');
    });
    await expect(carregaModels({ webGL2: true })).rejects.toThrow('Model corrupte');
    expect(crea.landmarker).toHaveBeenCalledTimes(1);
    expect(modelsCarregats()).toBeUndefined();
  });

  it('RF-17: sense WebGL2 va directament a la CPU', async () => {
    const m = await carregaModels({ webGL2: false });
    expect(m.delegat).toBe('CPU');
    expect(crea.landmarker).toHaveBeenCalledTimes(1);
    expect(crea.landmarker.mock.calls[0][1].baseOptions.delegate).toBe('CPU');
  });

  it('el segmentador és opcional: si no es pot crear, el Face Landmarker continua', async () => {
    const lm = model();
    crea.landmarker.mockImplementation(async () => lm);
    crea.segmenter.mockImplementation(async () => {
      throw new Error('Model corrupte');
    });
    const m = await carregaModels({ webGL2: true });
    expect(m.landmarker).toBe(lm);
    expect(m.segmenter).toBeUndefined();
    expect(lm.close).not.toHaveBeenCalled();
    expect(modelsCarregats()).toBe(m);
  });

  it('crea el segmentador DESPRÉS del landmarker, amb el mateix delegat (també a CPU)', async () => {
    crea.landmarker.mockImplementationOnce(async () => {
      throw new Error('GPU delegate failed');
    });
    const m = await carregaModels({ webGL2: true });
    expect(m.delegat).toBe('CPU');
    expect(crea.segmenter).toHaveBeenCalledTimes(1);
    expect(crea.segmenter.mock.calls[0][1].baseOptions.delegate).toBe('CPU');
  });

  it('les crides concurrents comparteixen la mateixa càrrega', async () => {
    const [a, b] = await Promise.all([carregaModels({ webGL2: true }), carregaModels({ webGL2: true })]);
    expect(a).toBe(b);
    expect(crea.landmarker).toHaveBeenCalledTimes(1);
  });

  it('un error no es queda a la memòria cau: es pot tornar a provar', async () => {
    crea.landmarker.mockImplementationOnce(async () => {
      throw new Error('Model corrupte');
    });
    await expect(carregaModels({ webGL2: true })).rejects.toThrow();
    const m = await carregaModels({ webGL2: true });
    expect(m.delegat).toBe('GPU');
  });

  it('elimina els <script src="blob:…"> que MediaPipe deixa al DOM i revoca les URL blob', async () => {
    const s = document.createElement('script');
    s.src = 'blob:http://exemple/abc';
    document.body.appendChild(s);
    await carregaModels({ webGL2: true });
    expect(document.querySelectorAll('script[src^="blob:"]')).toHaveLength(0);
    expect(revocaUrlsBlob).toHaveBeenCalled();
  });

  it('elimina els scripts blob també si la càrrega falla', async () => {
    const s = document.createElement('script');
    s.src = 'blob:http://exemple/abc';
    document.body.appendChild(s);
    crea.landmarker.mockImplementation(async () => {
      throw new Error('Model corrupte');
    });
    await expect(carregaModels({ webGL2: true })).rejects.toThrow();
    expect(document.querySelectorAll('script[src^="blob:"]')).toHaveLength(0);
  });
});

describe('escalfament dels models', () => {
  it('fa una detecció i una segmentació amb un canvas buit abans de retornar, i en mesura el temps a part', async () => {
    const lm = model();
    const seg = model();
    crea.landmarker.mockImplementation(async () => lm);
    crea.segmenter.mockImplementation(async () => seg);
    const m = await carregaModels({ webGL2: true });
    expect(lm.detectForVideo).toHaveBeenCalledTimes(1);
    expect(seg.segmentForVideo).toHaveBeenCalledTimes(1);
    const [canvas, marcaDeteccio] = lm.detectForVideo.mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(seg.segmentForVideo.mock.calls[0][1]).toBeGreaterThan(marcaDeteccio);
    expect(typeof m.msEscalfament).toBe('number');
    expect(m.segmenter).toBe(seg);
  });

  it('si l’escalfament del segmentador falla, es tanca i es continua sense segmentador', async () => {
    const lm = model();
    const seg = model();
    seg.segmentForVideo.mockImplementation(() => {
      throw new Error('boom');
    });
    crea.landmarker.mockImplementation(async () => lm);
    crea.segmenter.mockImplementation(async () => seg);
    const m = await carregaModels({ webGL2: true });
    expect(m.segmenter).toBeUndefined();
    expect(seg.close).toHaveBeenCalledTimes(1);
    expect(lm.close).not.toHaveBeenCalled();
  });

  it('si l’escalfament del Face Landmarker falla no impedeix la càrrega', async () => {
    const lm = model();
    lm.detectForVideo.mockImplementation(() => {
      throw new Error('boom');
    });
    crea.landmarker.mockImplementation(async () => lm);
    const m = await carregaModels({ webGL2: true });
    expect(m.landmarker).toBe(lm);
  });
});

describe('generació de càrrega', () => {
  it('una càrrega en curs que acaba després de tancaModels tanca els models i no els assigna', async () => {
    const lm = model();
    const seg = model();
    let alliberaLandmarker: (m: unknown) => void = () => undefined;
    crea.landmarker.mockImplementation(() => new Promise((r) => (alliberaLandmarker = r)));
    crea.segmenter.mockImplementation(async () => seg);
    const p = carregaModels({ webGL2: true });
    const rebutjada = expect(p).rejects.toThrow('cancel·lada');
    await new Promise((r) => setTimeout(r, 0));
    tancaModels(); // p. ex. la neteja RF-16 mentre es carrega
    alliberaLandmarker(lm);
    await rebutjada;
    expect(lm.close).toHaveBeenCalledTimes(1);
    expect(seg.close).toHaveBeenCalledTimes(1);
    expect(modelsCarregats()).toBeUndefined();
    // Una nova càrrega funciona amb normalitat.
    crea.landmarker.mockImplementation(async () => model());
    const nous = await carregaModels({ webGL2: true });
    expect(modelsCarregats()).toBe(nous);
  });

  it('un tancaModels sense càrrega en curs no afecta les càrregues posteriors', async () => {
    tancaModels();
    const m = await carregaModels({ webGL2: true });
    expect(modelsCarregats()).toBe(m);
  });
});

describe('neteja RF-16: tancar els models', () => {
  it('tancaModels tanca el Face Landmarker i el segmentador i buida la memòria cau', async () => {
    const m = await carregaModels({ webGL2: true });
    tancaModels();
    expect((m.landmarker as unknown as { close: jest.Mock }).close).toHaveBeenCalledTimes(1);
    expect((m.segmenter as unknown as { close: jest.Mock }).close).toHaveBeenCalledTimes(1);
    expect(modelsCarregats()).toBeUndefined();
    // Una nova càrrega els torna a crear.
    const nous = await carregaModels({ webGL2: true });
    expect(nous).not.toBe(m);
  });

  it('el registre de neteja (RF-16) els tanca', async () => {
    const m = await carregaModels({ webGL2: true });
    registre.neteja();
    expect((m.landmarker as unknown as { close: jest.Mock }).close).toHaveBeenCalledTimes(1);
    expect((m.segmenter as unknown as { close: jest.Mock }).close).toHaveBeenCalledTimes(1);
    expect(modelsCarregats()).toBeUndefined();
  });

  it('és idempotent i no falla si close() llança', async () => {
    const m = await carregaModels({ webGL2: true });
    (m.landmarker as unknown as { close: jest.Mock }).close.mockImplementation(() => {
      throw new Error('ja tancat');
    });
    expect(() => {
      tancaModels();
      tancaModels();
    }).not.toThrow();
    expect((m.segmenter as unknown as { close: jest.Mock }).close).toHaveBeenCalledTimes(1);
  });
});
