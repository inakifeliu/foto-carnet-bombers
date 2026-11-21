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

function monta(endavant: number): { div: HTMLDivElement; root: Root } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  void act(() => {
    root.render(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
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
  landmarks: mesures.nCares === 1 ? creaLandmarks() : undefined
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
async function montaP3(inicial: IMesures): Promise<{
  div: HTMLDivElement;
  root: Root;
  video: HTMLVideoElement;
  an: ReturnType<typeof creaFalsAnalitzador>;
}> {
  const an = creaFalsAnalitzador(inicial);
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
    const mals: IMesures = { ...mesuresBones(), alcadaCara: 0.15, yaw: 30, llum: 40 };
    const { div, root, an } = await montaP3(mals);
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.apropa')); // 5.3 distància primer
    an.posa({ ...mals, alcadaCara: 0.37 });
    await avanca(1500);
    expect(guia(div)).toBe(t('p3.msg.giraDre')); // 5.4 orientació
    an.posa({ ...mals, alcadaCara: 0.37, yaw: 0 });
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
    const { div, root } = await montaP3({ ...mesuresBones(), llum: 40, alcadaCara: 0.2 });
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
