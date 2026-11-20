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
