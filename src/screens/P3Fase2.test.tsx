import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';
import { registre } from '../cleanup/neteja';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { t, type ClauI18n } from '../i18n';
import { creaLandmarks, mesuresBones } from '../test/escena';
import type { IMostra } from '../vision/analitzador';
import { estatAnalisi } from '../vision/estatAnalisi';
import { ORDRE_PRIORITAT, type IMesures } from '../vision/tipus';

const mockCarregaModels = jest.fn();
const mockCreaAnalitzador = jest.fn();
jest.mock('../vision/mediapipe', () => ({
  carregaModels: (...a: unknown[]) => mockCarregaModels(...a),
  tancaModels: jest.fn(),
  eliminaScriptsBlob: jest.fn()
}));
jest.mock('../vision/analitzador', () => ({
  creaAnalitzador: (...a: unknown[]) => mockCreaAnalitzador(...a)
}));

const act = (React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }).act;

const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  webGL: true,
  compatible: true
};

const Salta: React.FC<{ endavant: number }> = ({ endavant }) => {
  const { dispatch } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula: '12345' });
    for (let i = 0; i < endavant; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch, endavant]);
  return null;
};

/** Configuració que fa servir `monta` (es restableix a cada prova). */
let configMonta = CONFIG_PER_DEFECTE;

function monta(
  endavant: number,
  funcionalitats: typeof FUNCIONALITATS = FUNCIONALITATS
): { div: HTMLDivElement; root: Root } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  void act(() => {
    root.render(
      <ProveidorApp config={configMonta} funcionalitats={funcionalitats}>
        <Salta endavant={endavant} />
        <Contingut />
      </ProveidorApp>
    );
  });
  return { div, root };
}

const h1 = (div: HTMLElement): string => div.querySelector('h1')?.textContent ?? '';
const botoText = (div: HTMLElement, text: string): HTMLButtonElement | undefined =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent === text);

function fluxSimulat(stop = jest.fn()): MediaStream {
  const pista = { stop, getSettings: () => ({ width: 1280, height: 720, deviceId: 'a' }), addEventListener: jest.fn() };
  return { getTracks: () => [pista], getVideoTracks: () => [pista] } as unknown as MediaStream;
}

function posaCamera(getUserMedia = jest.fn().mockResolvedValue(fluxSimulat())): jest.Mock {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices: jest.fn().mockResolvedValue([]) },
    configurable: true
  });
  return getUserMedia;
}

function espiaUrl(): void {
  for (const nom of ['createObjectURL', 'revokeObjectURL'] as const) {
    if (typeof URL[nom] !== 'function') {
      Object.defineProperty(URL, nom, { value: () => 'blob:prova', configurable: true, writable: true });
    }
  }
  jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prova');
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
}

function simulaCanvas(): void {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    strokeRect: jest.fn()
  } as unknown as RenderingContext);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((cb: BlobCallback) => cb(new Blob(['x'], { type: 'image/png' })));
}

const mostra = (mesures: IMesures): IMostra => ({
  mesures,
  ample: 640,
  alt: 360,
  landmarks: mesures.nCares === 1 ? creaLandmarks() : undefined,
  temps: { dibuix: 1, landmarker: 2, segmentador: 0, metriques: 1 },
  segmentat: false,
  segmentacio: true
});

/** Analitzador simulat: la mostra que torna es pot canviar durant la prova. */
function creaFalsAnalitzador(inicial: IMesures): {
  analitza: jest.Mock;
  allibera: jest.Mock;
  posa: (m: IMesures) => void;
} {
  let actual = inicial;
  return {
    analitza: jest.fn(() => mostra(actual)),
    allibera: jest.fn(),
    posa: (m: IMesures): void => {
      actual = m;
    }
  };
}

async function donaFotograma(video: HTMLVideoElement): Promise<void> {
  Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
  Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
  await act(async () => {
    video.dispatchEvent(new Event('loadedmetadata'));
  });
}

const avanca = (ms: number): Promise<void> =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/** Munta P3 amb models simulats carregats i un analitzador fals. */
async function montaP3(
  inicial: IMesures,
  perfeccionaMostra?: (m: IMostra) => IMostra
): Promise<{
  div: HTMLDivElement;
  root: Root;
  video: HTMLVideoElement;
  an: ReturnType<typeof creaFalsAnalitzador>;
}> {
  const an = creaFalsAnalitzador(inicial);
  if (perfeccionaMostra) {
    const original = an.analitza.getMockImplementation() as () => IMostra;
    an.analitza.mockImplementation(() => perfeccionaMostra(original()));
  }
  mockCarregaModels.mockResolvedValue({ landmarker: {}, segmenter: {}, delegat: 'GPU', ms: 120 });
  mockCreaAnalitzador.mockReturnValue(an);
  posaCamera();
  const m = monta(3);
  await act(async () => {});
  await act(async () => {});
  const video = m.div.querySelector('video') as HTMLVideoElement;
  await donaFotograma(video);
  return { ...m, video, an };
}

const guia = (div: HTMLElement): string => div.querySelector('[role="status"][aria-live]')?.textContent ?? '';
const estats = (div: HTMLElement): string[] =>
  Array.from(div.querySelectorAll('[data-semafors] li')).map((li) => li.querySelector('strong')?.textContent ?? '');

beforeEach(() => {
  configMonta = CONFIG_PER_DEFECTE;
  jest.useFakeTimers();
  espiaUrl();
  simulaCanvas();
  mockCarregaModels.mockReset();
  mockCreaAnalitzador.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  registre.neteja();
  window.location.hash = '';
  document.body.innerHTML = '';
  estatAnalisi.publica(undefined);
});

describe('P3 Fase 2: càrrega dels models', () => {
  it('mostra el missatge de càrrega mentre es carreguen i després els semàfors (sense dades)', async () => {
    let resol: (v: unknown) => void = () => undefined;
    mockCarregaModels.mockReturnValue(new Promise((r) => (resol = r)));
    mockCreaAnalitzador.mockReturnValue(creaFalsAnalitzador(mesuresBones()));
    posaCamera();
    const { div, root } = monta(3);
    await act(async () => {});
    expect(h1(div)).toBe(t('p3.titol'));
    expect(div.querySelector('[data-carregant-models]')?.textContent).toBe(t('p3.carregantModels'));
    expect(div.querySelector('[data-semafors]')).toBeNull();
    // La captura manual està disponible mentre es carreguen.
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    expect(botoText(div, t('p3.feta'))?.disabled).toBe(false);

    await act(async () => resol({ landmarker: {}, segmenter: {}, delegat: 'CPU', ms: 800 }));
    expect(div.querySelector('[data-carregant-models]')).toBeNull();
    const llista = div.querySelector('[data-semafors]');
    expect(llista?.querySelectorAll('li')).toHaveLength(ORDRE_PRIORITAT.length);
    await act(async () => root.unmount());
  });

  it('un error de càrrega mostra un missatge clar i la captura manual continua disponible', async () => {
    mockCarregaModels.mockRejectedValue(new Error('Model corrupte'));
    posaCamera();
    const { div, root } = monta(3);
    await act(async () => {});
    await act(async () => {});
    expect(div.querySelector('[data-error-models]')?.textContent).toBe(t('p3.errorModels'));
    expect(div.querySelector('[data-semafors]')).toBeNull();
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    const feta = botoText(div, t('p3.feta'));
    expect(feta?.disabled).toBe(false);
    // Sense anàlisi no hi ha res a confirmar: la foto es fa directament.
    await act(async () => feta?.click());
    await act(async () => {});
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });
});

describe('P3 Fase 2: bucle d’anàlisi i semàfors', () => {
  it('«No et veiem la cara» quan no hi ha cara; els semàfors són «Sense dades» tret del de la cara', async () => {
    const { div, root, an } = await montaP3({ nCares: 0 });
    await avanca(1200);
    expect(an.analitza).toHaveBeenCalled();
    expect(guia(div)).toBe(t('p3.msg.capCara'));
    const e = estats(div);
    expect(e).toHaveLength(ORDRE_PRIORITAT.length);
    expect(e[0]).toBe(t('p3.estat.error'));
    expect(e.slice(1).every((x) => x === t('p3.estat.cap'))).toBe(true);
    await act(async () => root.unmount());
  });

  it('més d’una cara: «Només hi ha de sortir una persona»', async () => {
    const { div, root } = await montaP3({ nCares: 2 });
    await avanca(1200);
    expect(guia(div)).toBe(t('p3.msg.moltesCares'));
    await act(async () => root.unmount());
  });

  it('el bucle va a ~12 fps (entre 8 i 14 anàlisis per segon)', async () => {
    const { root, an } = await montaP3(mesuresBones());
    await avanca(300); // escalfament
    const abans = an.analitza.mock.calls.length;
    await avanca(2000);
    const fps = (an.analitza.mock.calls.length - abans) / 2;
    expect(fps).toBeGreaterThanOrEqual(8);
    expect(fps).toBeLessThanOrEqual(14);
    await act(async () => root.unmount());
  });

  it('reacciona: es corregeix a poc a poc cada control segons la prioritat i acaba en «Perfecte»', async () => {
    const mals: IMesures = { ...mesuresBones(), alcadaCara: 0.1, yaw: 30, llum: 40 };
    const { div, root, an } = await montaP3(mals);
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.apropa')); // 5.3 distància primer
    an.posa({ ...mals, alcadaCara: 0.26 });
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.giraDre')); // 5.4 orientació
    an.posa({ ...mals, alcadaCara: 0.26, yaw: 0 });
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.massaFosc')); // 5.7 llum (apagar el llum)
    an.posa(mesuresBones());
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.totOk'));
    expect(estats(div).every((x) => x === t('p3.estat.ok'))).toBe(true);
    await act(async () => root.unmount());
  });

  it('un fons no blanc posa el semàfor de fons en vermell i demana el fons blanc', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), fons: 0.2 });
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.fonsNoBlanc'));
    const fons = div.querySelectorAll('[data-semafors] li')[ORDRE_PRIORITAT.indexOf('fons')];
    expect(fons.textContent).toContain(t('p3.semafor.fons'));
    expect(fons.textContent).toContain(t('p3.estat.error'));
    await act(async () => root.unmount());
  });

  it('no fa spam: amb una situació estable, la regió aria-live no es torna a escriure', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), llum: 40 });
    await avanca(1500);
    const regio = div.querySelector('[role="status"][aria-live]') as HTMLElement;
    expect(regio.getAttribute('aria-live')).toBe('polite');
    const mutacions: MutationRecord[] = [];
    const obs = new MutationObserver((r) => mutacions.push(...r));
    obs.observe(regio, { childList: true, characterData: true, subtree: true });
    await avanca(3000);
    obs.takeRecords().forEach((r) => mutacions.push(r));
    obs.disconnect();
    expect(mutacions).toHaveLength(0);
    await act(async () => root.unmount());
  });

  it('un valor puntual dolent (parpelleig d’un fotograma) no canvia el missatge', async () => {
    // Sense captura automàtica enmig (l'estabilitat requerida és molt llarga).
    configMonta = { ...CONFIG_PER_DEFECTE, captura: { ...CONFIG_PER_DEFECTE.captura, segonsEstableAbansCompte: 10 } };
    const { div, root, an } = await montaP3(mesuresBones());
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.totOk'));
    an.posa({ ...mesuresBones(), llum: 5 });
    await avanca(90); // una sola anàlisi
    an.posa(mesuresBones());
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.totOk'));
    await act(async () => root.unmount());
  });

  it('el bucle s’atura en passar a revisió (després de capturar) i en desmuntar P3', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await avanca(1000);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    // En revisió, el mode «ocupat» de captura ha cridat analitza una vegada (RF-06); després no se'n fan més.
    const crides = an.analitza.mock.calls.length;
    await avanca(1500);
    expect(an.analitza.mock.calls.length).toBe(crides);
    expect(div.querySelector('[data-semafors]')).toBeNull();

    await act(async () => root.unmount());
    expect(an.allibera).toHaveBeenCalled();
    const despres = an.analitza.mock.calls.length;
    await avanca(1000);
    expect(an.analitza.mock.calls.length).toBe(despres);
    expect(estatAnalisi.llegeix()).toBeUndefined();
  });

  it('en tornar a «Fer-ne una altra» el bucle es reengega', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await avanca(1000);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    await act(async () => botoText(div, t('p3.altra'))?.click());
    const abans = an.analitza.mock.calls.length;
    await avanca(1000);
    expect(an.analitza.mock.calls.length).toBeGreaterThan(abans + 5);
    await act(async () => root.unmount());
  });

  it('si l’anàlisi falla repetidament, s’atura i avisa que la captura manual continua disponible', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    an.analitza.mockImplementation(() => {
      throw new Error('boom');
    });
    await avanca(1500);
    expect(div.querySelector('[data-error-models]')?.textContent).toBe(t('p3.errorAnalisi'));
    expect(botoText(div, t('p3.feta'))?.disabled).toBe(false);
    await act(async () => root.unmount());
  });
});

describe('P3 Fase 2: captura manual amb confirmació', () => {
  it('amb controls no verds demana confirmació; «Millorar-ho primer» no fa cap foto', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), llum: 40 });
    await avanca(1500);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    const dialeg = div.querySelector('[role="dialog"]');
    expect(dialeg?.textContent).toContain(t('p3.confirmaText'));
    await act(async () => botoText(div, t('p3.confirmaNo'))?.click());
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(div.querySelectorAll('main ul img')).toHaveLength(0);
    expect(div.textContent).not.toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('«Fer-la igualment» fa la foto', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), llum: 40 });
    await avanca(1500);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => botoText(div, t('p3.confirmaSi'))?.click());
    await act(async () => {});
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('sense cara també demana confirmació', async () => {
    const { div, root } = await montaP3({ nCares: 0 });
    await avanca(1500);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    expect(div.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it('amb tots els controls verds fa la foto directament, sense avís', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await avanca(1500);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });
});

describe('P3 Fase 2 → P4: puntuació real i avisos de cada foto', () => {
  it('P4 mostra la puntuació calculada sobre la captura i els avisos de la foto', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), llum: 40, alcadaCara: 0.1 });
    await avanca(1500);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => botoText(div, t('p3.confirmaSi'))?.click());
    await act(async () => {});
    await act(async () => botoText(div, t('p3.prouFotos'))?.click());
    expect(h1(div)).toBe(t('p4.titol'));
    const text = div.textContent ?? '';
    expect(text).not.toContain('simulad');
    expect(text).toMatch(/Puntuació: \d+ \/ 100/);
    const avisos = Array.from(div.querySelectorAll('[data-avisos-foto] li')).map((li) => li.textContent);
    expect(avisos).toContain(t('p3.msg.apropa' as ClauI18n));
    expect(avisos).toContain(t('p3.msg.massaFosc' as ClauI18n));
    await act(async () => root.unmount());
  });
});

describe('P3 Fase 2: mode diagnòstic', () => {
  it('amb #debug, mostra la superposició sobre el vídeo; sense #debug, no', async () => {
    const a = await montaP3(mesuresBones());
    expect(a.div.querySelector('[data-overlay-diagnostic]')).toBeNull();
    await act(async () => a.root.unmount());
    document.body.innerHTML = '';

    window.location.hash = '#debug';
    const b = await montaP3(mesuresBones());
    await avanca(500);
    expect(b.div.querySelector('[data-overlay-diagnostic]')).not.toBeNull();
    // El panell mostra els valors numèrics en directe de tots els controls.
    const items = b.div.querySelectorAll('#debug-controls li');
    expect(items).toHaveLength(ORDRE_PRIORITAT.length);
    expect(b.div.querySelector('#debug-rendiment')?.textContent).toContain('GPU');
    await act(async () => b.root.unmount());
  });
});

describe('P3 Fase 2: sense WebGL (RF-17)', () => {
  const SENSE_WEBGL = { ...FUNCIONALITATS, webGL2: false, webGL: false };

  it('NO carrega els models, ho diu directament i la captura manual continua funcionant', async () => {
    posaCamera();
    const { div, root } = monta(3, SENSE_WEBGL);
    await act(async () => {});
    await act(async () => {});
    expect(mockCarregaModels).not.toHaveBeenCalled();
    expect(mockCreaAnalitzador).not.toHaveBeenCalled();
    expect(div.querySelector('[data-analisi-no-disponible]')?.textContent).toBe(t('p3.senseWebgl'));
    expect(div.querySelector('[data-carregant-models]')).toBeNull();
    expect(div.querySelector('[data-semafors]')).toBeNull();
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    // Sense anàlisi no hi ha res a confirmar: la foto es fa directament.
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('només sense WebGL2 (però amb WebGL 1) sí que es carreguen els models', async () => {
    const an = creaFalsAnalitzador(mesuresBones());
    mockCarregaModels.mockResolvedValue({ landmarker: {}, segmenter: {}, delegat: 'CPU', ms: 800 });
    mockCreaAnalitzador.mockReturnValue(an);
    posaCamera();
    const { div, root } = monta(3, { ...FUNCIONALITATS, webGL2: false });
    await act(async () => {});
    await act(async () => {});
    expect(mockCarregaModels).toHaveBeenCalledWith({ webGL2: false });
    expect(div.querySelector('[data-analisi-no-disponible]')).toBeNull();
    await act(async () => root.unmount());
  });

  it('P0 avisa que no hi haurà anàlisi automàtica (i, amb WebGL 1, que anirà més lenta)', async () => {
    const a = monta(0, SENSE_WEBGL);
    await act(async () => {});
    expect(a.div.textContent).toContain(t('p0.senseWebgl'));
    expect(a.div.textContent).not.toContain(t('p0.senseWebgl2'));
    await act(async () => a.root.unmount());
    document.body.innerHTML = '';
    const b = monta(0, { ...FUNCIONALITATS, webGL2: false });
    await act(async () => {});
    expect(b.div.textContent).toContain(t('p0.senseWebgl2'));
    expect(b.div.textContent).not.toContain(t('p0.senseWebgl'));
    await act(async () => b.root.unmount());
  });
});

describe('P3 Fase 2: sense segmentació («no disponible»)', () => {
  const senseSegmentacio = (m: IMostra): IMostra => ({ ...m, segmentacio: false });

  it('fons, polo i espatlles surten en gris amb «No disponible»; no impedeixen el «Perfecte»', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), fons: undefined, polo: undefined }, senseSegmentacio);
    await avanca(1500);
    const e = estats(div);
    (['fons', 'polo', 'espatlles'] as const).forEach((c) => {
      expect(e[ORDRE_PRIORITAT.indexOf(c)]).toBe(t('p3.estat.noDisp'));
    });
    expect(e[ORDRE_PRIORITAT.indexOf('llum')]).toBe(t('p3.estat.ok'));
    expect(guia(div)).toBe(t('p3.msg.totOk'));
    // Tots els controls disponibles són verds: la foto es fa sense confirmació.
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it('amb segmentació, els mateixos controls surten com sempre', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await avanca(1500);
    expect(estats(div)[ORDRE_PRIORITAT.indexOf('fons')]).toBe(t('p3.estat.ok'));
    await act(async () => root.unmount());
  });

  it('el diagnòstic mostra el temps per pas i que la segmentació no està disponible', async () => {
    window.location.hash = '#debug';
    const { div, root } = await montaP3(mesuresBones(), senseSegmentacio);
    await avanca(800);
    const temps = div.querySelector('#debug-temps')?.textContent ?? '';
    expect(temps).toContain('dibuix');
    expect(temps).toContain('segmentador');
    expect(temps).toContain('no disponible');
    await act(async () => root.unmount());
  });
});

describe('P3 Fase 2: pressupost de temps', () => {
  it('si l’anàlisi és massa lenta de manera sostinguda, s’atura amb un avís i la captura manual continua', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    let ara = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => ara);
    // Cada anàlisi «dura» 400 ms de rellotge.
    an.analitza.mockImplementation(() => {
      ara += 400;
      return mostra(mesuresBones());
    });
    await avanca(5000);
    expect(div.querySelector('[data-error-models]')?.textContent).toBe(t('p3.analisiMassaLenta'));
    expect(div.querySelector('[data-semafors]')).toBeNull();
    const crides = an.analitza.mock.calls.length;
    await avanca(2000);
    expect(an.analitza.mock.calls.length).toBe(crides);
    expect(botoText(div, t('p3.feta'))?.disabled).toBe(false);
    // Sense anàlisi activa, la foto es fa directament.
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('a la captura es demana una anàlisi de captura (sempre segmenta)', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await avanca(1000);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    const darrera = an.analitza.mock.calls[an.analitza.mock.calls.length - 1];
    expect(darrera[3]).toEqual({ captura: true });
    // En directe es passa la cadència de segmentació del pressupost.
    expect(an.analitza.mock.calls[0][3]).toEqual({ segmentaCada: 3 });
    await act(async () => root.unmount());
  });
});

describe('useModels: neteja sense acumular tasques', () => {
  it('entrar i sortir de P3 diverses vegades no acumula tasques al registre de neteja', async () => {
    const an = creaFalsAnalitzador(mesuresBones());
    mockCarregaModels.mockResolvedValue({ landmarker: {}, segmenter: {}, delegat: 'GPU', ms: 1 });
    mockCreaAnalitzador.mockReturnValue(an);
    posaCamera();
    registre.neteja();
    // Es compta només el que afegeix la càrrega dels models simulada: l'analitzador n'hauria d'afegir UNA sola.
    const visita = async (): Promise<void> => {
      const m = monta(3);
      await act(async () => {});
      await act(async () => {});
      await act(async () => m.root.unmount());
      document.body.innerHTML = '';
    };
    await visita();
    const unaVisita = registre.pendents;
    for (let i = 0; i < 4; i++) {
      await visita();
    }
    // Quatre visites més (sense neteja entremig) no han d'haver afegit cap tasca més.
    expect(registre.pendents).toBe(unaVisita);
  });
});

describe('P3 Fase 3: captura automàtica', () => {
  /** Avança el temps en passos de 100 ms perquè React renderitzi (i reprogrami els efectes) entre un pas i el següent. */
  const passos = async (ms: number): Promise<void> => {
    for (let t0 = 0; t0 < ms; t0 += 100) {
      await avanca(100);
    }
  };
  const esperaCompte = async (div: HTMLElement, valor: string): Promise<void> => {
    for (let i = 0; i < 80 && div.querySelector('[data-compte-enrere]')?.textContent !== valor; i++) {
      await avanca(100);
    }
  };
  const comptador = (div: HTMLElement): string => div.querySelector('[data-compte-enrere]')?.textContent ?? '';
  const fotosFetes = (div: HTMLElement): number => div.querySelectorAll('main ul img').length;

  it('amb tot verd durant 1 s comença el compte 3-2-1 i fa la foto', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await passos(900);
    expect(comptador(div)).toBe('');
    await esperaCompte(div, '3');
    expect(guia(div)).toBe(t('p3.compteAuto', { n: 3 }));
    await passos(1000);
    expect(comptador(div)).toBe('2');
    await passos(1000);
    expect(comptador(div)).toBe('1');
    expect(fotosFetes(div)).toBe(0);
    await passos(1000);
    await act(async () => {});
    expect(comptador(div)).toBe('');
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('l’anunci aria-live durant el compte és constant (cap spam per segon)', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await esperaCompte(div, '3');
    expect(comptador(div)).not.toBe('');
    const regio = div.querySelector('[role="status"][aria-live]') as HTMLElement;
    const mutacions: MutationRecord[] = [];
    const obs = new MutationObserver((r) => mutacions.push(...r));
    obs.observe(regio, { childList: true, characterData: true, subtree: true });
    await passos(1900);
    obs.takeRecords().forEach((r) => mutacions.push(r));
    obs.disconnect();
    expect(mutacions).toHaveLength(0);
    await act(async () => root.unmount());
  });

  it('si un control passa a vermell durant el compte, es cancel·la i torna a esperar', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await passos(3000);
    expect(comptador(div)).not.toBe('');
    an.posa({ ...mesuresBones(), llum: 5 });
    await passos(1500);
    expect(comptador(div)).toBe('');
    expect(fotosFetes(div)).toBe(0);
    await passos(6000);
    expect(fotosFetes(div)).toBe(0);
    an.posa(mesuresBones());
    await passos(2800);
    expect(comptador(div)).not.toBe('');
    await act(async () => root.unmount());
  });

  it('si es perd la cara durant el compte, es cancel·la', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await passos(3000);
    expect(comptador(div)).not.toBe('');
    an.posa({ nCares: 0 });
    await passos(1500);
    expect(comptador(div)).toBe('');
    await act(async () => root.unmount());
  });

  it('sense cara no s’inicia mai', async () => {
    const { div, root } = await montaP3({ nCares: 0 });
    await passos(8000);
    expect(comptador(div)).toBe('');
    expect(fotosFetes(div)).toBe(0);
    await act(async () => root.unmount());
  });

  it('sense anàlisi (error de models) no hi ha captura automàtica', async () => {
    mockCarregaModels.mockRejectedValue(new Error('Model corrupte'));
    posaCamera();
    const { div, root } = monta(3);
    await act(async () => {});
    await act(async () => {});
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    await passos(10000);
    expect(comptador(div)).toBe('');
    expect(div.textContent).not.toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('sense WebGL no hi ha captura automàtica', async () => {
    posaCamera();
    const { div, root } = monta(3, { ...FUNCIONALITATS, webGL2: false, webGL: false });
    await act(async () => {});
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    await passos(10000);
    expect(comptador(div)).toBe('');
    expect(div.textContent).not.toContain(t('p3.capturada', { n: 1 }));
    await act(async () => root.unmount());
  });

  it('no s’inicia si el temporitzador manual és actiu, i el manual fa la seva foto', async () => {
    const { div, root, an } = await montaP3({ ...mesuresBones(), llum: 5 });
    await passos(1500);
    await act(async () => botoText(div, t('p3.temporitzador'))?.click());
    an.posa(mesuresBones());
    await passos(2500);
    expect(guia(div)).toContain('La foto es farà en');
    expect(guia(div)).not.toContain('automàticament');
    await passos(3500);
    await act(async () => {});
    expect(fotosFetes(div)).toBe(1);
    await act(async () => root.unmount());
  });

  it('un botó manual durant el compte automàtic hi preval (només es fa una foto)', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await passos(3000);
    expect(comptador(div)).not.toBe('');
    await act(async () => botoText(div, t('p3.temporitzador'))?.click());
    expect(guia(div)).toBe(t('p3.compteEnrere', { n: 5 }));
    await passos(5200);
    await act(async () => {});
    expect(fotosFetes(div)).toBe(1);
    await act(async () => root.unmount());
  });

  it('«Fer la foto ara» durant el compte automàtic fa una sola foto, sense confirmació', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await passos(3000);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    await passos(6000);
    expect(fotosFetes(div)).toBe(1);
    await act(async () => root.unmount());
  });

  it('després de capturar no es reinicia fins que es tria «Fer-ne una altra»', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await passos(7000);
    await act(async () => {});
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    await passos(10000);
    expect(fotosFetes(div)).toBe(1);
    expect(comptador(div)).toBe('');
    await act(async () => botoText(div, t('p3.altra'))?.click());
    await passos(7500);
    await act(async () => {});
    expect(fotosFetes(div)).toBe(2);
    await act(async () => root.unmount());
  });

  it('en desmuntar durant el compte no es fa cap foto ni queda cap temporitzador', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await passos(3000);
    expect(comptador(div)).not.toBe('');
    await act(async () => root.unmount());
    expect(jest.getTimerCount()).toBe(0);
    await passos(5000);
    expect(div.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('P3 Fase 3: captura automàtica robusta', () => {
  const passos = async (ms: number): Promise<void> => {
    for (let t0 = 0; t0 < ms; t0 += 100) {
      await avanca(100);
    }
  };
  const esperaCompte = async (div: HTMLElement, valor: string): Promise<void> => {
    for (let i = 0; i < 80 && div.querySelector('[data-compte-enrere]')?.textContent !== valor; i++) {
      await avanca(100);
    }
  };
  const comptador = (div: HTMLElement): string => div.querySelector('[data-compte-enrere]')?.textContent ?? '';
  const fotosFetes = (div: HTMLElement): number => div.querySelectorAll('main ul img').length;
  const posaReadyState = (video: HTMLVideoElement, valor: number): void => {
    Object.defineProperty(video, 'readyState', { value: valor, configurable: true });
  };
  const posaAmagada = (amagada: boolean): void => {
    Object.defineProperty(document, 'hidden', { value: amagada, configurable: true });
  };
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).hidden;
  });

  it('amb l’anàlisi encallada (avaluació obsoleta) no s’inicia el compte fins que torna a haver-hi avaluacions', async () => {
    const { div, root, video } = await montaP3(mesuresBones());
    await passos(300);
    posaReadyState(video, 1); // el bucle deixa d'avaluar
    await passos(4000);
    expect(comptador(div)).toBe('');
    expect(fotosFetes(div)).toBe(0);
    posaReadyState(video, 4);
    await esperaCompte(div, '3');
    expect(comptador(div)).toBe('3');
    await act(async () => root.unmount());
  });

  it('si el bucle s’encalla a mig compte, el compte es cancel·la i no es fa cap foto', async () => {
    const { div, root, video } = await montaP3(mesuresBones());
    await esperaCompte(div, '3');
    posaReadyState(video, 1);
    await passos(5000);
    expect(comptador(div)).toBe('');
    expect(fotosFetes(div)).toBe(0);
    await act(async () => root.unmount());
  });

  it('amb la pàgina amagada (visibilitychange) el compte es cancel·la', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await esperaCompte(div, '3');
    posaAmagada(true);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(comptador(div)).toBe('');
    await passos(5000);
    expect(fotosFetes(div)).toBe(0);
    posaAmagada(false);
    await esperaCompte(div, '3');
    expect(comptador(div)).toBe('3');
    await act(async () => root.unmount());
  });

  it('«Cancel·lar» és visible durant el compte automàtic, el cancel·la i no es reinicia fins que els controls passin per no-verd', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await esperaCompte(div, '3');
    expect(botoText(div, t('p3.feta'))).toBeDefined();
    await act(async () => botoText(div, t('p3.cancela'))?.click());
    expect(comptador(div)).toBe('');
    expect(botoText(div, t('p3.cancela'))).toBeUndefined();
    await passos(10000);
    expect(comptador(div)).toBe('');
    expect(fotosFetes(div)).toBe(0);
    an.posa({ ...mesuresBones(), llum: 5 });
    await passos(1500);
    an.posa(mesuresBones());
    await esperaCompte(div, '3');
    expect(comptador(div)).toBe('3');
    await act(async () => root.unmount());
  });

  it('«Fer la foto ara» continua visible durant el temporitzador manual i, si es prem, cancel·la el compte i fa la foto', async () => {
    const { div, root } = await montaP3(mesuresBones());
    await passos(300);
    await act(async () => botoText(div, t('p3.temporitzador'))?.click());
    expect(comptador(div)).toBe('5');
    expect(botoText(div, t('p3.cancela'))).toBeDefined();
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(fotosFetes(div)).toBe(1);
    expect(comptador(div)).toBe('');
    await passos(7000);
    expect(fotosFetes(div)).toBe(1);
    await act(async () => root.unmount());
  });

  it('«Fer la foto ara» durant el temporitzador manual amb controls no verds demana confirmació i cancel·la el compte', async () => {
    const { div, root } = await montaP3({ ...mesuresBones(), llum: 40 });
    await passos(1500);
    await act(async () => botoText(div, t('p3.temporitzador'))?.click());
    await act(async () => botoText(div, t('p3.feta'))?.click());
    expect(div.querySelector('[role="dialog"]')).not.toBeNull();
    expect(comptador(div)).toBe('');
    await passos(6000);
    expect(fotosFetes(div)).toBe(0);
    await act(async () => root.unmount());
  });

  it('un control en àmbar durant el compte no el cancel·la i la foto es fa', async () => {
    const { div, root, an } = await montaP3(mesuresBones());
    await esperaCompte(div, '3');
    an.posa({ ...mesuresBones(), llum: 90 }); // avís (àmbar), no vermell
    await passos(1500);
    expect(guia(div)).not.toBe(t('p3.msg.totOk'));
    expect(comptador(div)).not.toBe('');
    await passos(3000);
    await act(async () => {});
    expect(fotosFetes(div)).toBe(1);
    await act(async () => root.unmount());
  });

  it('en arribar a maxFotos no es fa cap foto automàtica més', async () => {
    configMonta = { ...CONFIG_PER_DEFECTE, maxFotos: 1 };
    const { div, root } = await montaP3(mesuresBones());
    await passos(7000);
    await act(async () => {});
    expect(fotosFetes(div)).toBe(1);
    await passos(15000);
    expect(fotosFetes(div)).toBe(1);
    expect(comptador(div)).toBe('');
    await act(async () => root.unmount());
  });

  it('un error de captura no provoca un bucle de reintents; es reactiva quan els controls tornen a passar per no-verd', async () => {
    const toBlob = jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => cb(null));
    const { div, root, an } = await montaP3(mesuresBones());
    await passos(7000);
    await act(async () => {});
    expect(div.querySelector('[role="alert"]')?.textContent).toBe(t('p3.errorCaptura'));
    const crides = toBlob.mock.calls.length;
    expect(crides).toBe(1);
    await passos(20000);
    expect(toBlob.mock.calls.length).toBe(crides);
    expect(comptador(div)).toBe('');
    // Es repara el problema i els controls passen per no-verd: la captura automàtica torna a funcionar.
    toBlob.mockImplementation((cb: BlobCallback) => cb(new Blob(['x'], { type: 'image/png' })));
    an.posa({ ...mesuresBones(), llum: 5 });
    await passos(1500);
    an.posa(mesuresBones());
    await passos(7000);
    await act(async () => {});
    expect(fotosFetes(div)).toBe(1);
    await act(async () => root.unmount());
  });

  it('una pista que s’acaba a mig compte el cancel·la', async () => {
    let alAcabar: () => void = () => undefined;
    const pista = {
      stop: jest.fn(),
      getSettings: () => ({ width: 1280, height: 720, deviceId: 'a' }),
      addEventListener: (nom: string, cb: () => void) => {
        if (nom === 'ended') {
          alAcabar = cb;
        }
      }
    };
    const flux = { getTracks: () => [pista], getVideoTracks: () => [pista] } as unknown as MediaStream;
    const an = creaFalsAnalitzador(mesuresBones());
    mockCarregaModels.mockResolvedValue({ landmarker: {}, segmenter: {}, delegat: 'GPU', ms: 1 });
    mockCreaAnalitzador.mockReturnValue(an);
    posaCamera(jest.fn().mockResolvedValue(flux));
    const { div, root } = monta(3);
    await act(async () => {});
    await act(async () => {});
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    await esperaCompte(div, '3');
    expect(comptador(div)).toBe('3');
    await act(async () => alAcabar());
    expect(comptador(div)).toBe('');
    await passos(6000);
    expect(fotosFetes(div)).toBe(0);
    await act(async () => root.unmount());
  });

  it('un canvi de càmera a mig compte el cancel·la', async () => {
    const an = creaFalsAnalitzador(mesuresBones());
    mockCarregaModels.mockResolvedValue({ landmarker: {}, segmenter: {}, delegat: 'GPU', ms: 1 });
    mockCreaAnalitzador.mockReturnValue(an);
    const getUserMedia = posaCamera(jest.fn().mockImplementation(() => Promise.resolve(fluxSimulat())));
    (navigator.mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([
      { kind: 'videoinput', deviceId: 'a', label: 'A' },
      { kind: 'videoinput', deviceId: 'b', label: 'B' }
    ]);
    const { div, root } = monta(3);
    await act(async () => {});
    await act(async () => {});
    await donaFotograma(div.querySelector('video') as HTMLVideoElement);
    await esperaCompte(div, '3');
    expect(comptador(div)).toBe('3');
    const select = div.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    await act(async () => {
      select.value = 'b';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(comptador(div)).toBe('');
    await passos(5000);
    expect(fotosFetes(div)).toBe(0);
    await act(async () => root.unmount());
  });
});
