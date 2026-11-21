import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { registre } from '../cleanup/neteja';
import { t } from '../i18n';
import { Contingut } from './App';
import { ProveidorApp, useApp } from './AppContext';
import type { IFoto } from '../captura/fotos';

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }).act;

const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  compatible: true
};

/** Va a la pantalla indicada (nombre d'ENDAVANT des de P0) amb la matrícula 12345 i, opcionalment, una foto. */
const Salta: React.FC<{ endavant: number; foto?: IFoto }> = ({ endavant, foto }) => {
  const { dispatch, afegeixFoto } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula: '12345' });
    if (foto) {
      afegeixFoto(foto);
    }
    for (let i = 0; i < endavant; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch, afegeixFoto, endavant, foto]);
  return null;
};

function monta(endavant: number, foto?: IFoto): { div: HTMLDivElement; root: Root } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  void act(() => {
    root.render(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <Salta endavant={endavant} foto={foto} />
        <Contingut />
      </ProveidorApp>
    );
  });
  return { div, root };
}

const h1 = (div: HTMLElement): string => div.querySelector('h1')?.textContent ?? '';

const botoText = (div: HTMLElement, text: string): HTMLButtonElement | undefined =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent === text);

function posaMediaDevices(getUserMedia: jest.Mock, enumerateDevices = jest.fn().mockResolvedValue([])): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices },
    configurable: true
  });
}

/** jsdom no té `URL.createObjectURL`/`revokeObjectURL`: es defineixen i s'espien (es restauren amb restoreAllMocks). */
function espiaUrl(): { revoca: jest.SpyInstance } {
  for (const nom of ['createObjectURL', 'revokeObjectURL'] as const) {
    if (typeof URL[nom] !== 'function') {
      Object.defineProperty(URL, nom, { value: () => 'blob:prova', configurable: true, writable: true });
    }
  }
  jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prova');
  return { revoca: jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined) };
}

const posaSaveFilePicker = (valor: unknown): void => {
  (window as unknown as Record<string, unknown>).showSaveFilePicker = valor;
};

afterEach(() => {
  jest.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  registre.neteja();
});

describe('P3: errors de càmera', () => {
  const casos: [string, string][] = [
    ['NotAllowedError', 'p3.errorPermis'],
    ['NotFoundError', 'p3.errorCap'],
    ['OverconstrainedError', 'p3.errorCap'],
    ['NotReadableError', 'p3.errorOcupada'],
    ['AbortError', 'p3.errorOcupada'],
    ['Altre', 'p3.errorGeneric']
  ];
  it.each(casos)('%s mostra el missatge %s', async (nom, clau) => {
    posaMediaDevices(jest.fn().mockRejectedValue(Object.assign(new Error(nom), { name: nom })));
    const { div, root } = monta(3);
    await act(async () => {});
    expect(h1(div)).toBe(t('p3.titol'));
    expect(div.querySelector('[role="alert"]')?.textContent).toContain(t(clau as never));
    // El botó de captura queda desactivat sense càmera.
    expect(botoText(div, t('p3.feta'))?.disabled).toBe(true);
    await act(async () => root.unmount());
    div.remove();
  });
});

/** Flux simulat amb una pista de vídeo; `stop` s'espia per comprovar que s'atura. */
function fluxSimulat(deviceId: string, stop = jest.fn()): MediaStream {
  const pista = { stop, getSettings: () => ({ width: 640, height: 480, deviceId }), addEventListener: jest.fn() };
  return { getTracks: () => [pista], getVideoTracks: () => [pista] } as unknown as MediaStream;
}

describe('P3: càmera activa', () => {
  it('demana les restriccions de RF-01, mostra el selector amb diverses càmeres i atura les pistes en sortir', async () => {
    const stopA = jest.fn();
    const stopB = jest.fn();
    const getUserMedia = jest
      .fn()
      .mockResolvedValueOnce(fluxSimulat('a', stopA))
      .mockResolvedValueOnce(fluxSimulat('b', stopB));
    const enumerateDevices = jest.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'a', label: 'Integrada' },
      { kind: 'videoinput', deviceId: 'b', label: 'USB' }
    ]);
    posaMediaDevices(getUserMedia, enumerateDevices);
    const { div, root } = monta(3);
    await act(async () => {});
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false
    });
    expect(div.querySelectorAll('#fc-camera option')).toHaveLength(2);
    // Resolució 640×480 < 1280×720: avís no bloquejant.
    expect(div.querySelector('[data-avis-resolucio]')).not.toBeNull();
    expect(div.querySelector('video')?.hasAttribute('data-camera')).toBe(true);
    expect(stopA).not.toHaveBeenCalled();

    // Canvi de càmera: s'atura la pista de la primera (i només aquesta) i se'n demana la nova.
    const select = div.querySelector('#fc-camera') as HTMLSelectElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      set?.call(select, 'b');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, deviceId: { exact: 'b' } },
      audio: false
    });

    await act(async () => root.unmount());
    expect(stopB).toHaveBeenCalled();
    div.remove();
  });

  it('cursa: si P3 es desmunta amb getUserMedia pendent, quan resol el flux s’atura', async () => {
    let resol: (flux: MediaStream) => void = () => undefined;
    const pendent = new Promise<MediaStream>((r) => (resol = r));
    posaMediaDevices(jest.fn().mockReturnValue(pendent));
    const { div, root } = monta(3);
    await act(async () => {});
    await act(async () => root.unmount());
    const stop = jest.fn();
    await act(async () => resol(fluxSimulat('a', stop)));
    expect(stop).toHaveBeenCalledTimes(1);
    div.remove();
  });

  it('si la pista emet «ended» mostra l’error de càmera ocupada, atura el flux i permet tornar a provar', async () => {
    const stop = jest.fn();
    const flux = fluxSimulat('a', stop);
    const pista = flux.getVideoTracks()[0] as unknown as { addEventListener: jest.Mock };
    const getUserMedia = jest.fn().mockResolvedValue(flux);
    posaMediaDevices(getUserMedia);
    const { div, root } = monta(3);
    await act(async () => {});
    const [tipus, alFinal] = pista.addEventListener.mock.calls[0] as [string, () => void];
    expect(tipus).toBe('ended');
    await act(async () => alFinal());
    expect(div.querySelector('[role="alert"]')?.textContent).toContain(t('p3.errorOcupada'));
    expect(stop).toHaveBeenCalled();
    const reintenta = botoText(div, t('p3.reintentar'));
    expect(reintenta).toBeDefined();
    await act(async () => reintenta?.click());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(div.querySelector('[role="alert"]')).toBeNull();
    await act(async () => root.unmount());
    div.remove();
  });
});

/** Simula el context 2D i la codificació de jsdom (sense `canvas`): prou per al camí retalla → miniatura. */
function simulaCanvas(blobs: () => Blob | null): HTMLCanvasElement[] {
  const codificats: HTMLCanvasElement[] = [];
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage: jest.fn() } as unknown as RenderingContext);
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback
  ) {
    codificats.push(this);
    cb(blobs());
  });
  return codificats;
}

describe('P3: captura manual', () => {
  /** Munta P3 amb càmera simulada; el vídeo encara no té fotograma (videoWidth = 0). */
  async function montaP3(): Promise<{ div: HTMLDivElement; root: Root; video: HTMLVideoElement }> {
    posaMediaDevices(jest.fn().mockResolvedValue(fluxSimulat('a')));
    const m = monta(3);
    await act(async () => {});
    return { ...m, video: m.div.querySelector('video') as HTMLVideoElement };
  }
  const donaFotograma = async (video: HTMLVideoElement): Promise<void> => {
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
    await act(async () => {
      video.dispatchEvent(new Event('loadedmetadata'));
    });
  };

  it('«Fer la foto ara» només s’activa quan el vídeo té fotograma', async () => {
    const { div, root, video } = await montaP3();
    expect(botoText(div, t('p3.feta'))?.disabled).toBe(true);
    await donaFotograma(video);
    expect(botoText(div, t('p3.feta'))?.disabled).toBe(false);
    await act(async () => root.unmount());
    div.remove();
  });

  it('en capturar, el focus va a «Fer-ne una altra»; la regió d’estat no té aria-label', async () => {
    espiaUrl();
    simulaCanvas(() => new Blob(['x'], { type: 'image/png' }));
    const { div, root, video } = await montaP3();
    await donaFotograma(video);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.textContent).toContain(t('p3.capturada', { n: 1 }));
    expect(document.activeElement).toBe(botoText(div, t('p3.altra')));
    expect(div.querySelector('[role="status"][aria-live]')?.hasAttribute('aria-label')).toBe(false);
    // En tornar a capturar, el focus torna al botó de capturar.
    await act(async () => botoText(div, t('p3.altra'))?.click());
    expect(document.activeElement).toBe(botoText(div, t('p3.feta')));
    await act(async () => root.unmount());
    div.remove();
  });

  it('si creaFoto falla mostra l’error i buida el canvas retallat', async () => {
    espiaUrl();
    const codificats = simulaCanvas(() => null);
    const { div, root, video } = await montaP3();
    await donaFotograma(video);
    await act(async () => botoText(div, t('p3.feta'))?.click());
    await act(async () => {});
    expect(div.querySelector('[role="alert"]')?.textContent).toContain(t('p3.errorCaptura'));
    expect(codificats).toHaveLength(1);
    expect(codificats[0].width).toBe(0);
    expect(codificats[0].height).toBe(0);
    await act(async () => root.unmount());
    div.remove();
  });
});

/** JPEG mínim vàlid per a `escriuJfif` (SOI, DQT, SOS, dades, EOI). */
const JPEG_MINIM = new Uint8Array([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x12, 0xff, 0xd9
]);

if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // jsdom no implementa Blob.arrayBuffer (Edge sí): només per als tests.
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = (): void => resolve(lector.result as ArrayBuffer);
      lector.onerror = (): void => reject(lector.error);
      lector.readAsArrayBuffer(this);
    });
  };
}

describe('P5: desar (integració)', () => {
  async function montaP5(): Promise<{ div: HTMLDivElement; root: Root }> {
    espiaUrl();
    jest
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((cb: BlobCallback) => cb(new Blob([JPEG_MINIM], { type: 'image/jpeg' })));
    const canvas = document.createElement('canvas');
    canvas.width = 413;
    canvas.height = 531;
    const m = monta(5, { id: 200, canvas, url: 'blob:foto-200' });
    await act(async () => {});
    expect(h1(m.div)).toBe(t('p5.titol'));
    return m;
  }
  const desa = async (div: HTMLElement): Promise<void> => {
    await act(async () => botoText(div, t('p5.desar'))?.click());
    await act(async () => {});
    await act(async () => {});
  };
  const handle = (name: string): { handle: Record<string, unknown>; write: jest.Mock } => {
    const write = jest.fn().mockResolvedValue(undefined);
    return {
      write,
      handle: {
        name,
        createWritable: jest.fn().mockResolvedValue({ write, close: jest.fn().mockResolvedValue(undefined) })
      }
    };
  };

  it('amb showSaveFilePicker: el crida amb els paràmetres de RF-11, desa i P6 mostra la carpeta i el nom', async () => {
    const { handle: h, write } = handle('12345.jpg');
    const showSaveFilePicker = jest.fn().mockResolvedValue(h);
    posaSaveFilePicker(showSaveFilePicker);
    const { div, root } = await montaP5();
    expect(div.textContent).toContain(t('p5.ajuda'));
    await desa(div);
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: '12345.jpg',
      startIn: 'pictures',
      types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }]
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(h1(div)).toBe(t('p6.titol'));
    expect(div.textContent).toContain(t('carpeta.imatges'));
    expect(div.textContent).toContain('12345.jpg');
    expect(div.querySelector('[data-nom-diferent]')).toBeNull();
    await act(async () => root.unmount());
    div.remove();
  });

  it('amb SecurityError baixa amb <a download> i P6 i P7 diuen «Baixades»', async () => {
    posaSaveFilePicker(jest.fn().mockRejectedValue(Object.assign(new Error('seg'), { name: 'SecurityError' })));
    const clic = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { div, root } = await montaP5();
    await desa(div);
    expect(clic).toHaveBeenCalledTimes(1);
    expect(h1(div)).toBe(t('p6.titol'));
    expect(div.textContent).toContain(t('carpeta.baixades'));
    expect(div.textContent).not.toContain(t('carpeta.imatges'));
    await act(async () => botoText(div, t('p6.jaEnviat'))?.click());
    expect(h1(div)).toBe(t('p7.titol'));
    expect(div.textContent).toContain(t('carpeta.baixades'));
    await act(async () => root.unmount());
    div.remove();
  });

  it('sense showSaveFilePicker, P5 diu que es desarà a Baixades (sense finestra)', async () => {
    const { div, root } = await montaP5();
    expect(div.textContent).toContain(t('p5.baixades'));
    expect(div.textContent).not.toContain(t('p5.ajuda'));
    await act(async () => root.unmount());
    div.remove();
  });

  it('si l’usuari canvia el nom al diàleg, P6 i P7 mostren el nom real amb un avís', async () => {
    posaSaveFilePicker(jest.fn().mockResolvedValue(handle('carnet-meu.jpg').handle));
    const { div, root } = await montaP5();
    await desa(div);
    expect(h1(div)).toBe(t('p6.titol'));
    expect(div.querySelector('[data-nom-diferent]')?.textContent).toContain('carnet-meu.jpg');
    expect(div.textContent).toContain('carnet-meu.jpg');
    expect(div.textContent).not.toContain('12345.jpg');
    await act(async () => botoText(div, t('p6.jaEnviat'))?.click());
    expect(h1(div)).toBe(t('p7.titol'));
    expect(div.textContent).toContain('carnet-meu.jpg');
    await act(async () => root.unmount());
    div.remove();
  });
});

describe('RF-16: pageshow persistit (bfcache)', () => {
  it('reinicialitza l’app a P0, revoca les URL i buida els canvas de les fotos', async () => {
    const { revoca } = espiaUrl();
    const canvas = document.createElement('canvas');
    canvas.width = 413;
    canvas.height = 531;
    const foto: IFoto = { id: 99, canvas, url: 'blob:foto-99' };
    const { div, root } = monta(4, foto); // P4
    await act(async () => {});
    expect(h1(div)).toBe(t('p4.titol'));
    expect(div.querySelector('main img')?.getAttribute('src')).toBe('blob:foto-99');

    await act(async () => {
      const ev = new Event('pageshow') as Event & { persisted: boolean };
      ev.persisted = true;
      window.dispatchEvent(ev);
    });
    expect(h1(div)).toBe(t('p0.titol'));
    expect(revoca).toHaveBeenCalledWith('blob:foto-99');
    expect(canvas.width).toBe(0);

    // Un pageshow normal (no persistit) no fa res.
    await act(async () => {
      const ev = new Event('pageshow') as Event & { persisted: boolean };
      ev.persisted = false;
      window.dispatchEvent(ev);
    });
    expect(h1(div)).toBe(t('p0.titol'));
    await act(async () => root.unmount());
    div.remove();
  });
});

describe('P7: neteja en finalitzar (RF-16)', () => {
  it('en arribar a P7 s’alliberen les fotos i les pistes registrades', async () => {
    const { revoca } = espiaUrl();
    const stop = jest.fn();
    registre.registraFlux({ getTracks: () => [{ stop }] });
    const canvas = document.createElement('canvas');
    canvas.width = 413;
    canvas.height = 531;
    const { div, root } = monta(7, { id: 100, canvas, url: 'blob:foto-100' });
    await act(async () => {});
    expect(h1(div)).toBe(t('p7.titol'));
    expect(stop).toHaveBeenCalled();
    expect(revoca).toHaveBeenCalledWith('blob:foto-100');
    expect(canvas.width).toBe(0);
    await act(async () => root.unmount());
    div.remove();
  });
});

describe('P5: sense foto', () => {
  it('avisa i desactiva el botó de desar', async () => {
    const { div, root } = monta(5);
    await act(async () => {});
    expect(h1(div)).toBe(t('p5.titol'));
    expect(div.textContent).toContain(t('p5.sensefoto'));
    expect(botoText(div, t('p5.desar'))?.disabled).toBe(true);
    await act(async () => root.unmount());
    div.remove();
  });
});
