import { midaSortida, pasosReduccio, rectangleRetallCentrat, retallaCentrat } from './retall';

describe('midaSortida', () => {
  it('300 ppp → 413 × 531', () => {
    expect(midaSortida(300)).toEqual({ w: 413, h: 531 });
  });
  it('600 ppp → 827 × 1063', () => {
    expect(midaSortida(600)).toEqual({ w: 827, h: 1063 });
  });
  it('conserva la proporció 35:45 amb un error < 0,2 %', () => {
    [300, 600].forEach((ppp) => {
      const { w, h } = midaSortida(ppp);
      expect(Math.abs(w / h - 35 / 45) / (35 / 45)).toBeLessThan(0.002);
    });
  });
});

describe('rectangleRetallCentrat', () => {
  it('fotograma 16:9 (1920×1080): alçada completa, 840 d’ample, centrat', () => {
    expect(rectangleRetallCentrat(1920, 1080)).toEqual({ x: 540, y: 0, w: 840, h: 1080 });
  });
  it('1280×720', () => {
    expect(rectangleRetallCentrat(1280, 720)).toEqual({ x: 360, y: 0, w: 560, h: 720 });
  });
  it('fotograma 4:3 (640×480)', () => {
    expect(rectangleRetallCentrat(640, 480)).toEqual({ x: 133, y: 0, w: 373, h: 480 });
  });
  it('fotograma vertical més estret que 35:45 (700×1400): ample complet, centrat en vertical', () => {
    expect(rectangleRetallCentrat(700, 1400)).toEqual({ x: 0, y: 250, w: 700, h: 900 });
  });
  it('fotograma exactament 35:45', () => {
    expect(rectangleRetallCentrat(350, 450)).toEqual({ x: 0, y: 0, w: 350, h: 450 });
  });
  it('sempre és enter, cap dins el fotograma, centrat i de proporció 35:45 (±1 px)', () => {
    const mides: [number, number][] = [
      [1920, 1080],
      [1280, 720],
      [640, 480],
      [800, 600],
      [1000, 1000],
      [333, 777],
      [4096, 2160],
      [321, 123]
    ];
    mides.forEach(([a, b]) => {
      const r = rectangleRetallCentrat(a, b);
      expect([r.x, r.y, r.w, r.h].every(Number.isInteger)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(a);
      expect(r.y + r.h).toBeLessThanOrEqual(b);
      expect(Math.abs(r.x - (a - (r.x + r.w)))).toBeLessThanOrEqual(1);
      expect(Math.abs(r.y - (b - (r.y + r.h)))).toBeLessThanOrEqual(1);
      expect(Math.abs(r.w / r.h - 35 / 45)).toBeLessThan(0.005);
      // És el més gran possible: o ocupa tota l'amplada o tota l'alçada.
      expect(r.w === a || r.h === b).toBe(true);
    });
  });
  it('amb factor < 1 el rectangle és més petit i continua centrat', () => {
    expect(rectangleRetallCentrat(1920, 1080, 0.5)).toEqual({ x: 750, y: 270, w: 420, h: 540 });
  });
  it('factor o mida no vàlids', () => {
    expect(() => rectangleRetallCentrat(0, 100)).toThrow();
    expect(() => rectangleRetallCentrat(100, 100, 0)).toThrow();
    expect(() => rectangleRetallCentrat(100, 100, 1.1)).toThrow();
  });
});

describe('pasosReduccio', () => {
  it('sense passos intermedis si la reducció és < 2x: només la mida final', () => {
    expect(pasosReduccio({ w: 800, h: 1000 }, { w: 413, h: 531 })).toEqual([{ w: 413, h: 531 }]);
  });
  it('redueix per meitats i acaba exactament a la mida de sortida', () => {
    const passos = pasosReduccio({ w: 2400, h: 3086 }, { w: 413, h: 531 });
    expect(passos[passos.length - 1]).toEqual({ w: 413, h: 531 });
    expect(passos.length).toBeGreaterThan(1);
    let ant = { w: 2400, h: 3086 };
    passos.forEach((p) => {
      expect(p.w).toBeGreaterThanOrEqual(Math.round(ant.w / 2));
      expect(p.w).toBeLessThanOrEqual(ant.w);
      ant = p;
    });
  });
  it('si l’origen és més petit que la sortida, només la final (ampliació directa)', () => {
    expect(pasosReduccio({ w: 200, h: 257 }, { w: 413, h: 531 })).toEqual([{ w: 413, h: 531 }]);
  });
});

describe('retallaCentrat (amb un context 2D simulat)', () => {
  const crides: { args: number[]; qualitat: string }[] = [];
  const original = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    crides.length = 0;
    HTMLCanvasElement.prototype.getContext = function () {
      const ctx = {
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        drawImage: (...args: unknown[]): void => {
          crides.push({ args: args.slice(1) as number[], qualitat: ctx.imageSmoothingQuality });
        }
      };
      return ctx;
    } as unknown as typeof original;
  });
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = original;
  });

  it('1920×1080 a 300 ppp: retall 840×1080 centrat i sortida 413×531 amb qualitat alta i reducció per passos', () => {
    const origen = document.createElement('canvas');
    origen.width = 1920;
    origen.height = 1080;
    const sortida = retallaCentrat(origen, { ppp: 300 });
    expect([sortida.width, sortida.height]).toEqual([413, 531]);
    // 840×1080 → 413×531 és una reducció d'una mica més de 2x: un pas intermedi (420×540) i el final.
    expect(crides).toHaveLength(2);
    expect(crides[0].args).toEqual([540, 0, 840, 1080, 0, 0, 420, 540]);
    expect(crides[1].args).toEqual([0, 0, 420, 540, 0, 0, 413, 531]);
    expect(crides.every((c) => c.qualitat === 'high')).toBe(true);
    // L'origen no es modifica.
    expect([origen.width, origen.height]).toEqual([1920, 1080]);
  });

  it('600 ppp dóna 827×1063', () => {
    const origen = document.createElement('canvas');
    origen.width = 1920;
    origen.height = 1080;
    const sortida = retallaCentrat(origen, { ppp: 600 });
    expect([sortida.width, sortida.height]).toEqual([827, 1063]);
  });

  it('amb una font molt gran redueix per passos', () => {
    const origen = document.createElement('canvas');
    origen.width = 4000;
    origen.height = 3000;
    const sortida = retallaCentrat(origen, { ppp: 300 });
    expect([sortida.width, sortida.height]).toEqual([413, 531]);
    expect(crides.length).toBeGreaterThan(1);
    // El primer pas llegeix del rectangle centrat de l'origen; els següents, del canvas intermedi sencer.
    expect(crides[0].args.slice(0, 4)).toEqual([833, 0, 2333, 3000]);
    expect(crides[1].args.slice(0, 2)).toEqual([0, 0]);
  });
});
