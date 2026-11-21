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

const model = (): { close: jest.Mock } => ({ close: jest.fn() });

beforeEach(() => {
  crea.landmarker.mockReset();
  crea.segmenter.mockReset();
  revocaUrlsBlob.mockReset();
  crea.landmarker.mockImplementation(async () => model());
  crea.segmenter.mockImplementation(async () => model());
});

afterEach(() => {
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
    'Texture creation failed'
  ])('%s és un error de GPU', (missatge) => {
    expect(esErrorGpu(new Error(missatge))).toBe(true);
  });

  it.each([
    'Model corrupte',
    'WebAssembly.instantiate(): out of memory',
    'Failed to fetch',
    'Recurs incrustat desconegut: model-cara',
    'Unexpected token'
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

  it('si falla el segmentador, el Face Landmarker ja creat es tanca', async () => {
    const lm = model();
    crea.landmarker.mockImplementation(async () => lm);
    crea.segmenter.mockImplementation(async () => {
      throw new Error('Model corrupte');
    });
    await expect(carregaModels({ webGL2: true })).rejects.toThrow('Model corrupte');
    expect(lm.close).toHaveBeenCalledTimes(1);
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
