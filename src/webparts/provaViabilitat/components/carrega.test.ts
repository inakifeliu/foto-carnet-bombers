import { carregaAmbRetrocesGpu, classificaError, ErrorCarregaModel, type Delegat } from './carrega';

interface IFals {
  tancat: boolean;
  close: () => void;
}
const fals = (): IFals => {
  const f: IFals = {
    tancat: false,
    close: (): void => {
      f.tancat = true;
    }
  };
  return f;
};

describe('classificaError', () => {
  it('reconeix errors de GPU/WebGL', () => {
    expect(classificaError(new Error('Failed to create WebGL canvas context'))).toBe('gpu');
    expect(classificaError(new Error('GPU delegate not supported'))).toBe('gpu');
    expect(classificaError(new Error('emscripten_webgl_create_context failed'))).toBe('gpu');
  });

  it('reconeix errors de recursos (404, CSP, xarxa, WASM)', () => {
    expect(classificaError(new Error('Failed to fetch'))).toBe('recursos');
    expect(classificaError(new Error('HTTP status 404'))).toBe('recursos');
    expect(
      classificaError(new Error('Refused to load the script because it violates the Content Security Policy'))
    ).toBe('recursos');
    expect(classificaError(new Error('WebAssembly.instantiate(): CompileError'))).toBe('recursos');
    expect(classificaError(new Error('Failed to load model asset .task'))).toBe('recursos');
  });

  it('la resta és desconeguda', () => {
    expect(classificaError(new Error('boom'))).toBe('altre');
    expect(classificaError('xxx')).toBe('altre');
  });
});

describe('carregaAmbRetrocesGpu', () => {
  it('usa GPU si funciona', async () => {
    const crea = jest.fn(() => Promise.resolve(fals()));
    const r = await carregaAmbRetrocesGpu(crea);
    expect(r.delegat).toBe('GPU');
    expect(crea).toHaveBeenCalledTimes(1);
  });

  it('retrocedeix a CPU només amb error de GPU, i ho avisa', async () => {
    const crea = jest.fn((d: Delegat) =>
      d === 'GPU' ? Promise.reject(new Error('WebGL not supported')) : Promise.resolve(fals())
    );
    const r = await carregaAmbRetrocesGpu(crea);
    expect(r.delegat).toBe('CPU');
    expect(r.avisos[0]).toContain('GPU no disponible');
    expect(crea).toHaveBeenCalledTimes(2);
  });

  it('NO retrocedeix amb errors de recursos/CSP/404: els mostra com a tals', async () => {
    const crea = jest.fn(() => Promise.reject(new Error('Failed to fetch (404)')));
    const error = await carregaAmbRetrocesGpu(crea).then(
      () => undefined,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(ErrorCarregaModel);
    expect((error as ErrorCarregaModel).tipus).toBe('recursos');
    expect((error as Error).message).toContain('recursos del model');
    expect(crea).toHaveBeenCalledTimes(1);
  });

  it('NO retrocedeix amb errors desconeguts', async () => {
    const crea = jest.fn(() => Promise.reject(new Error('boom')));
    await expect(carregaAmbRetrocesGpu(crea)).rejects.toBeInstanceOf(ErrorCarregaModel);
    expect(crea).toHaveBeenCalledTimes(1);
  });

  it('tanca la instància GPU a mig crear si falla la validació posterior i retrocedeix si és error de GPU', async () => {
    const gpu = fals();
    const cpu = fals();
    const crea = jest.fn((d: Delegat) => Promise.resolve(d === 'GPU' ? gpu : cpu));
    const valida = (): void => {
      throw new Error('WebGL context lost');
    };
    const r = await carregaAmbRetrocesGpu(crea, valida);
    expect(gpu.tancat).toBe(true);
    expect(r.landmarker).toBe(cpu);
    expect(r.delegat).toBe('CPU');
  });

  it('un error de CPU es propaga classificat', async () => {
    const crea = (d: Delegat): Promise<IFals> =>
      d === 'GPU' ? Promise.reject(new Error('GPU delegate failed')) : Promise.reject(new Error('Failed to fetch'));
    await expect(carregaAmbRetrocesGpu(crea)).rejects.toMatchObject({ tipus: 'recursos', delegat: 'CPU' });
  });
});
