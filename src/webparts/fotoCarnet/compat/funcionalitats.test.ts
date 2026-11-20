import { detectaFuncionalitats, entornActual } from './funcionalitats';

describe('detectaFuncionalitats', () => {
  it('compatible quan hi ha getUserMedia i WebAssembly', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
      teWebGL2: () => true
    });
    expect(r).toEqual({ getUserMedia: true, webAssembly: true, webGL2: true, compatible: true });
  });

  it('sense WebGL2 continua sent compatible (només nota)', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
      teWebGL2: () => false
    });
    expect(r.compatible).toBe(true);
    expect(r.webGL2).toBe(false);
  });

  it('incompatible sense getUserMedia', () => {
    expect(detectaFuncionalitats({ mediaDevices: undefined, webAssembly: {}, teWebGL2: () => true }).compatible).toBe(
      false
    );
    expect(detectaFuncionalitats({ mediaDevices: {}, webAssembly: {}, teWebGL2: () => true }).getUserMedia).toBe(false);
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

  it('si la detecció de WebGL2 llença, es considera no disponible', () => {
    const r = detectaFuncionalitats({
      mediaDevices: { getUserMedia: (): void => undefined },
      webAssembly: {},
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
