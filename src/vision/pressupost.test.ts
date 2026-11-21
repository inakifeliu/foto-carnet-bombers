import {
  ANALISIS_SOSTINGUDES_PER_ATURAR,
  FPS_NORMAL,
  FPS_REDUIT,
  LLINDAR_ATURA_MS,
  LLINDAR_REDUIT_MS,
  MitjanaTemps,
  PressupostAnalisi,
  SEGMENTA_CADA_NORMAL,
  SEGMENTA_CADA_REDUIT
} from './pressupost';

const repeteix = (p: PressupostAnalisi, ms: number, n: number): void => {
  for (let i = 0; i < n; i++) {
    p.registra(ms);
  }
};

describe('PressupostAnalisi', () => {
  it('arrenca en nivell normal amb 12 fps, segmentant cada 3 anàlisis, i la mitjana 0', () => {
    const p = new PressupostAnalisi();
    expect(p.nivell).toBe('normal');
    expect(p.fps).toBe(FPS_NORMAL);
    expect(p.segmentaCada).toBe(SEGMENTA_CADA_NORMAL);
    expect(p.msMitja).toBe(0);
  });

  it('la mitjana arrenca amb la primera anàlisi real (no amb un 0 que l’abaixi)', () => {
    const p = new PressupostAnalisi();
    p.registra(40);
    expect(p.msMitja).toBe(40);
    p.registra(20);
    expect(p.msMitja).toBeCloseTo(36, 6); // 0,8·40 + 0,2·20
  });

  it('a 30 ms de mitjana es manté en normal', () => {
    const p = new PressupostAnalisi();
    repeteix(p, 30, 50);
    expect(p.nivell).toBe('normal');
    expect(p.fps).toBe(12);
  });

  it('per sobre de 50 ms baixa la freqüència (8 fps) i espaia més la segmentació', () => {
    const p = new PressupostAnalisi();
    repeteix(p, LLINDAR_REDUIT_MS + 20, 5);
    expect(p.nivell).toBe('reduit');
    expect(p.fps).toBe(FPS_REDUIT);
    expect(p.segmentaCada).toBe(SEGMENTA_CADA_REDUIT);
    expect(p.segmentaCada).toBeGreaterThan(SEGMENTA_CADA_NORMAL);
  });

  it('recupera el nivell normal només quan la mitjana baixa clarament (histèresi)', () => {
    const p = new PressupostAnalisi();
    repeteix(p, 80, 5);
    expect(p.nivell).toBe('reduit');
    // Entre 35 i 50 ms es manté en reduït, perquè no oscil·li.
    repeteix(p, 42, 60);
    expect(p.nivell).toBe('reduit');
    repeteix(p, 20, 60);
    expect(p.nivell).toBe('normal');
  });

  it('un pic puntual molt alt no atura l’anàlisi (cal que sigui sostingut)', () => {
    const p = new PressupostAnalisi();
    repeteix(p, 20, 20);
    p.registra(2000);
    repeteix(p, 20, 30);
    expect(p.nivell).not.toBe('aturat');
  });

  it('per sobre de 150 ms de mitjana durant prou anàlisis seguides s’atura, i ja no es recupera', () => {
    const p = new PressupostAnalisi();
    repeteix(p, LLINDAR_ATURA_MS + 100, ANALISIS_SOSTINGUDES_PER_ATURAR - 1);
    expect(p.nivell).toBe('reduit');
    p.registra(LLINDAR_ATURA_MS + 100);
    expect(p.nivell).toBe('aturat');
    repeteix(p, 5, 200);
    expect(p.nivell).toBe('aturat');
  });

  it('un tram sostingut amb la mitjana sota 150 ms reinicia el comptador d’aturada', () => {
    const p = new PressupostAnalisi();
    repeteix(p, 300, 3); // la mitjana encara triga a baixar: 3 + 3 anàlisis per sobre del llindar < 10
    repeteix(p, 10, 40); // la mitjana cau per sota de 150
    repeteix(p, 300, 3);
    expect(p.nivell).not.toBe('aturat');
  });

  it('els llindars són configurables', () => {
    const p = new PressupostAnalisi({
      llindarReduitMs: 10,
      fpsReduit: 5,
      analisisSostingudesPerAturar: 2,
      llindarAturaMs: 30
    });
    p.registra(20);
    expect(p.nivell).toBe('reduit');
    expect(p.fps).toBe(5);
    p.registra(100);
    p.registra(100);
    expect(p.nivell).toBe('aturat');
  });
});

describe('MitjanaTemps', () => {
  it('la primera mostra és el valor; després, mitjana exponencial', () => {
    const m = new MitjanaTemps(0.5);
    expect(m.afegeix({ dibuix: 4, landmarker: 10, segmentador: 0, metriques: 2 }, false)).toEqual({
      dibuix: 4,
      landmarker: 10,
      segmentador: 0,
      metriques: 2
    });
    const r = m.afegeix({ dibuix: 2, landmarker: 20, segmentador: 0, metriques: 2 }, false);
    expect(r.dibuix).toBeCloseTo(3, 6);
    expect(r.landmarker).toBeCloseTo(15, 6);
  });

  it('el temps del segmentador només s’actualitza quan s’ha segmentat de debò', () => {
    const m = new MitjanaTemps(0.5);
    m.afegeix({ dibuix: 1, landmarker: 1, segmentador: 12, metriques: 1 }, true);
    // Anàlisis sense segmentar (segmentador = 0 a la mostra): no el baixen.
    const sense = m.afegeix({ dibuix: 1, landmarker: 1, segmentador: 0, metriques: 1 }, false);
    expect(sense.segmentador).toBe(12);
    const una = m.afegeix({ dibuix: 1, landmarker: 1, segmentador: 8, metriques: 1 }, true);
    expect(una.segmentador).toBeCloseTo(10, 6);
  });
});
