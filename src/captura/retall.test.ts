import {
  midaFinal,
  midaSortida,
  pppPerAlcada,
  pppSortida,
  type IOpcionsSortida,
  pasosReduccio,
  rectangleRetallCentrat,
  rectangleVisor,
  retallaCentrat,
  type IRectangle
} from './retall';

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

const FIXA: IOpcionsSortida = { mida: 'fixa', ppp: 300, alcadaMaxPx: 2160 };
const ORIGINAL: IOpcionsSortida = { mida: 'original', ppp: 300, alcadaMaxPx: 2160 };

describe('midaFinal', () => {
  it('«fixa»: sempre midaSortida(ppp), sigui quin sigui el retall', () => {
    expect(midaFinal({ w: 840, h: 1080 }, FIXA)).toEqual({ w: 413, h: 531 });
    expect(midaFinal({ w: 840, h: 1080 }, { ...FIXA, ppp: 600 })).toEqual({ w: 827, h: 1063 });
  });
  it('«original»: càmera 1920×1080 amb visor (840×1080) → 840×1080, sense reescalar', () => {
    expect(midaFinal(rectangleVisor(1920, 1080), ORIGINAL)).toEqual({ w: 840, h: 1080 });
  });
  it('«original»: 1280×720 → 560×720; 640×480 (retall de 480 d’alçada) s’amplia al mínim 413×531', () => {
    expect(midaFinal(rectangleVisor(1280, 720), ORIGINAL)).toEqual({ w: 560, h: 720 });
    expect(midaFinal(rectangleVisor(640, 480), ORIGINAL)).toEqual({ w: 413, h: 531 });
    expect(midaFinal(rectangleVisor(1280, 960), ORIGINAL)).toEqual({ w: 747, h: 960 });
  });
  it('«original»: un retall més petit que el mínim s’amplia fins a 413×531 (300 ppp) o 827×1063 (600 ppp)', () => {
    expect(midaFinal({ w: 200, h: 257 }, ORIGINAL)).toEqual({ w: 413, h: 531 });
    expect(midaFinal({ w: 200, h: 257 }, { ...ORIGINAL, ppp: 600 })).toEqual({ w: 827, h: 1063 });
  });
  it('«original»: més alt que alcadaMaxPx es redueix a aquesta alçada mantenint 35:45', () => {
    expect(midaFinal(rectangleVisor(3840, 2160), ORIGINAL)).toEqual({ w: 1680, h: 2160 });
    expect(midaFinal({ w: 2000, h: 2571 }, ORIGINAL)).toEqual({ w: 1680, h: 2160 });
    expect(midaFinal({ w: 2000, h: 2571 }, { ...ORIGINAL, alcadaMaxPx: 1000 })).toEqual({ w: 778, h: 1000 });
  });
  it('«original»: la proporció és 35:45 amb un error < 0,2 % (alçades ≥ 531)', () => {
    [531, 540, 720, 1080, 1440, 2160].forEach((h) => {
      const m = midaFinal({ w: 1, h }, ORIGINAL);
      expect(m.h).toBe(h);
      expect(Math.abs(m.w / m.h - 35 / 45) / (35 / 45)).toBeLessThan(0.002);
    });
  });
});

describe('pppPerAlcada / pppSortida', () => {
  it('ppp = round(alt / (45 / 25,4))', () => {
    expect(pppPerAlcada(1080)).toBe(610);
    expect(pppPerAlcada(531)).toBe(300);
    expect(pppPerAlcada(1063)).toBe(600);
    expect(pppPerAlcada(2160)).toBe(1219);
    expect(pppPerAlcada(720)).toBe(406);
  });
  it('«fixa» fa servir la densitat configurada; «original» la calculada amb l’alçada real', () => {
    expect(pppSortida({ ...FIXA, ppp: 600 }, 1080)).toBe(600);
    expect(pppSortida(ORIGINAL, 1080)).toBe(610);
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
    const sortida = retallaCentrat(origen, { sortida: FIXA });
    expect([sortida.width, sortida.height]).toEqual([413, 531]);
    // 840×1080 → 413×531 és una reducció d'una mica més de 2x: un pas intermedi (420×540) i el final.
    expect(crides).toHaveLength(2);
    expect(crides[0].args).toEqual([540, 0, 840, 1080, 0, 0, 420, 540]);
    expect(crides[1].args).toEqual([0, 0, 420, 540, 0, 0, 413, 531]);
    expect(crides.every((c) => c.qualitat === 'high')).toBe(true);
    // L'origen no es modifica.
    expect([origen.width, origen.height]).toEqual([1920, 1080]);
  });

  it('«original» 1920×1080: sortida 840×1080 en un sol pas 1:1', () => {
    const origen = document.createElement('canvas');
    origen.width = 1920;
    origen.height = 1080;
    const sortida = retallaCentrat(origen, { sortida: ORIGINAL });
    expect([sortida.width, sortida.height]).toEqual([840, 1080]);
    expect(crides).toHaveLength(1);
    expect(crides[0].args).toEqual([540, 0, 840, 1080, 0, 0, 840, 1080]);
  });

  it('«original» 4K (3840×2160) amb alcadaMaxPx 1080: es redueix a 840×1080', () => {
    const origen = document.createElement('canvas');
    origen.width = 3840;
    origen.height = 2160;
    const sortida = retallaCentrat(origen, { sortida: { ...ORIGINAL, alcadaMaxPx: 1080 } });
    expect([sortida.width, sortida.height]).toEqual([840, 1080]);
  });

  it('600 ppp dona 827×1063', () => {
    const origen = document.createElement('canvas');
    origen.width = 1920;
    origen.height = 1080;
    const sortida = retallaCentrat(origen, { sortida: { ...FIXA, ppp: 600 } });
    expect([sortida.width, sortida.height]).toEqual([827, 1063]);
  });

  it('amb una font molt gran redueix per passos', () => {
    const origen = document.createElement('canvas');
    origen.width = 4000;
    origen.height = 3000;
    const sortida = retallaCentrat(origen, { sortida: FIXA });
    expect([sortida.width, sortida.height]).toEqual([413, 531]);
    expect(crides.length).toBeGreaterThan(1);
    // El primer pas llegeix del rectangle centrat de l'origen; els següents, del canvas intermedi sencer.
    expect(crides[0].args.slice(0, 4)).toEqual([833, 0, 2333, 3000]);
    expect(crides[1].args.slice(0, 2)).toEqual([0, 0]);
  });
});

describe('rectangleVisor (el que mostra .visor: aspect-ratio 35/45 + object-fit: cover)', () => {
  /** Rectangle visible segons la definició de `object-fit: cover` (coordenades reals, sense arrodoniments). */
  function cover(ample: number, alt: number, visorW: number, visorH: number): IRectangle {
    const escala = Math.max(visorW / ample, visorH / alt);
    const w = visorW / escala;
    const h = visorH / escala;
    return { x: (ample - w) / 2, y: (alt - h) / 2, w, h };
  }

  it.each([
    [1920, 1080],
    [1280, 720],
    [640, 480],
    [1000, 1000],
    [720, 1280],
    [480, 640],
    [350, 450],
    [1600, 1200]
  ])('càmera %i×%i: coincideix amb object-fit: cover (±1 px) i amb el retall centrat 35:45', (a, b) => {
    const r = rectangleVisor(a, b);
    expect(r).toEqual(rectangleRetallCentrat(a, b));
    // Visors de mides diferents (el CSS només en fixa la proporció): el rectangle visible és el mateix.
    [
      [350, 450],
      [420, 540],
      [175, 225]
    ].forEach(([vw, vh]) => {
      const c = cover(a, b, vw, vh);
      expect(Math.abs(r.x - c.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.y - c.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.w - c.w)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.h - c.h)).toBeLessThanOrEqual(1);
    });
  });
});
