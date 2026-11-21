import { detectaFuncionalitats, entornActual } from './funcionalitats';

describe('detectaFuncionalitats', () => {
  it('compatible quan hi ha getUserMedia i WebAssembly', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
      decompressionStream: function DecompressionStream() {},
      teWebGL2: () => true
    });
    expect(r).toEqual({
      getUserMedia: true,
      webAssembly: true,
      decompressionStream: true,
      webGL2: true,
      webGL: true,
      compatible: true
    });
  });

  it('sense WebGL2 continua sent compatible (només nota)', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
      decompressionStream: function DecompressionStream() {},
      teWebGL2: () => false
    });
    expect(r.compatible).toBe(true);
    expect(r.webGL2).toBe(false);
  });

  it('incompatible sense getUserMedia', () => {
    expect(
      detectaFuncionalitats({
        mediaDevices: undefined,
        webAssembly: {},
        decompressionStream: Function,
        teWebGL2: () => true
      }).compatible
    ).toBe(false);
    expect(
      detectaFuncionalitats({ mediaDevices: {}, webAssembly: {}, decompressionStream: Function, teWebGL2: () => true })
        .getUserMedia
    ).toBe(false);
  });

  it('incompatible sense WebAssembly', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: undefined,
      teWebGL2: () => true
    });
    expect(r.webAssembly).toBe(false);
    expect(r.compatible).toBe(false);
  });

  it('incompatible sense DecompressionStream (RF-17)', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
      decompressionStream: undefined,
      teWebGL2: () => true
    });
    expect(r.decompressionStream).toBe(false);
    expect(r.compatible).toBe(false);
  });

  it('si la detecció de WebGL2 llença, es considera no disponible', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
      decompressionStream: function DecompressionStream() {},
      teWebGL2: () => {
        throw new Error('x');
      }
    });
    expect(r.webGL2).toBe(false);
    expect(r.compatible).toBe(true);
  });

  it('usa els globals mockejats per defecte', () => {
    const canvasSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: (): void => undefined },
      configurable: true
    });
    try {
      expect(entornActual().mediaDevices).toBeDefined();
      expect(detectaFuncionalitats().getUserMedia).toBe(true);
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'mediaDevices', original);
      } else {
        delete (navigator as unknown as Record<string, unknown>).mediaDevices;
      }
    }
    expect(detectaFuncionalitats().getUserMedia).toBe(false);
    canvasSpy.mockRestore();
  });
});

describe('detectaFuncionalitats: WebGL (RF-17)', () => {
  const base = {
    mediaDevices: { getUserMedia: (): void => undefined },
    webAssembly: {},
    decompressionStream: function DecompressionStream() {}
  };

  it('amb WebGL2 hi ha WebGL i no es consulta el WebGL 1', () => {
    const teWebGL = jest.fn(() => false);
    const r = detectaFuncionalitats({ ...base, teWebGL2: () => true, teWebGL });
    expect(r.webGL).toBe(true);
    expect(teWebGL).not.toHaveBeenCalled();
  });

  it('sense WebGL2 però amb WebGL 1: webGL2 fals, webGL cert (els models es carreguen, en CPU)', () => {
    const r = detectaFuncionalitats({ ...base, teWebGL2: () => false, teWebGL: () => true });
    expect(r.webGL2).toBe(false);
    expect(r.webGL).toBe(true);
    expect(r.compatible).toBe(true);
  });

  it('sense cap WebGL: webGL fals, però l’app continua sent compatible (captura manual)', () => {
    const r = detectaFuncionalitats({ ...base, teWebGL2: () => false, teWebGL: () => false });
    expect(r.webGL).toBe(false);
    expect(r.compatible).toBe(true);
  });

  it('si la consulta llança, es considera que no hi ha WebGL', () => {
    const r = detectaFuncionalitats({
      ...base,
      teWebGL2: () => {
        throw new Error('x');
      },
      teWebGL: () => {
        throw new Error('x');
      }
    });
    expect(r.webGL2).toBe(false);
    expect(r.webGL).toBe(false);
  });

  it('un entorn sense `teWebGL` i sense WebGL2 no té WebGL', () => {
    expect(detectaFuncionalitats({ ...base, teWebGL2: () => false }).webGL).toBe(false);
  });
});
