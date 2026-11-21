import { RegistreRecursos } from './neteja';

describe('RegistreRecursos', () => {
  it('atura les pistes, revoca les URL i buida els canvas', () => {
    const revoca = jest.fn();
    const r = new RegistreRecursos(revoca);
    const stop1 = jest.fn();
    const stop2 = jest.fn();
    const canvas = { width: 413, height: 531 };
    r.registraFlux({ getTracks: () => [{ stop: stop1 }, { stop: stop2 }] });
    r.registraUrl('blob:a');
    r.registraUrl('blob:b');
    r.registraCanvas(canvas);
    expect(r.pendents).toBe(4);

    r.neteja();

    expect(stop1).toHaveBeenCalledTimes(1);
    expect(stop2).toHaveBeenCalledTimes(1);
    expect(revoca).toHaveBeenCalledWith('blob:a');
    expect(revoca).toHaveBeenCalledWith('blob:b');
    expect(canvas).toEqual({ width: 0, height: 0 });
    expect(r.pendents).toBe(0);
  });

  it('és idempotent', () => {
    const revoca = jest.fn();
    const r = new RegistreRecursos(revoca);
    r.registraUrl('blob:a');
    r.neteja();
    r.neteja();
    expect(revoca).toHaveBeenCalledTimes(1);
  });

  it('no falla sense res registrat', () => {
    expect(() => new RegistreRecursos().neteja()).not.toThrow();
  });
});

describe('RegistreRecursos: tasques addicionals', () => {
  it('executa les tasques registrades una sola vegada en netejar', () => {
    const r = new RegistreRecursos(jest.fn());
    const tasca = jest.fn();
    r.registraTasca(tasca);
    expect(r.pendents).toBe(1);
    r.neteja();
    r.neteja();
    expect(tasca).toHaveBeenCalledTimes(1);
    expect(r.pendents).toBe(0);
  });
});

describe('RegistreRecursos: un error no atura la resta de passos', () => {
  it('continua alliberant encara que una pista, una revocació, un canvas o una tasca llencin', () => {
    const boom = (): never => {
      throw new Error('boom');
    };
    const revoca = jest.fn((url: string) => {
      if (url === 'blob:a') {
        boom();
      }
    });
    const r = new RegistreRecursos(revoca);
    const stopBo = jest.fn();
    const stopSeguent = jest.fn();
    r.registraFlux({ getTracks: () => [{ stop: boom }, { stop: stopBo }] });
    r.registraFlux({ getTracks: boom });
    r.registraFlux({ getTracks: () => [{ stop: stopSeguent }] });
    r.registraUrl('blob:a');
    r.registraUrl('blob:b');
    const canvasMalament = {
      get width(): number {
        return 1;
      },
      set width(_v: number) {
        boom();
      },
      height: 5
    };
    const canvasBo = { width: 10, height: 10 };
    r.registraCanvas(canvasMalament);
    r.registraCanvas(canvasBo);
    const tascaMala = jest.fn(boom);
    const tascaBona = jest.fn();
    r.registraTasca(tascaMala);
    r.registraTasca(tascaBona);

    expect(() => r.neteja()).not.toThrow();

    expect(stopBo).toHaveBeenCalledTimes(1);
    expect(stopSeguent).toHaveBeenCalledTimes(1);
    expect(revoca).toHaveBeenCalledWith('blob:b');
    expect(canvasBo).toEqual({ width: 0, height: 0 });
    expect(tascaMala).toHaveBeenCalledTimes(1);
    expect(tascaBona).toHaveBeenCalledTimes(1);
    expect(r.pendents).toBe(0);
  });
});
