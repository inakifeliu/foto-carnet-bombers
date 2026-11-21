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

function posaMediaDevices(getUserMedia: jest.Mock, enumerateDevices = jest.fn().mockResolvedValue([])): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices },
    configurable: true
  });
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
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
    const feta = Array.from(div.querySelectorAll('button')).find((b) => b.textContent === t('p3.feta'));
    expect(feta?.disabled).toBe(true);
    await act(async () => root.unmount());
    div.remove();
  });
});

describe('P3: càmera activa', () => {
  it('demana les restriccions de RF-01, mostra el selector amb diverses càmeres i atura les pistes en sortir', async () => {
    const stop = jest.fn();
    const flux = {
      getTracks: () => [{ stop }],
      getVideoTracks: () => [{ stop, getSettings: () => ({ width: 640, height: 480, deviceId: 'a' }) }]
    };
    const getUserMedia = jest.fn().mockResolvedValue(flux);
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

    // Canvi de càmera: s'aturen les pistes anteriors i se'n demana la nova.
    const select = div.querySelector('#fc-camera') as HTMLSelectElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      set?.call(select, 'b');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(stop).toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, deviceId: { exact: 'b' } },
      audio: false
    });

    stop.mockClear();
    await act(async () => root.unmount());
    expect(stop).toHaveBeenCalled();
    div.remove();
  });
});

describe('RF-16: pageshow persistit (bfcache)', () => {
  it('reinicialitza l’app a P0, revoca les URL i buida els canvas de les fotos', async () => {
    const revoca = jest.fn();
    URL.revokeObjectURL = revoca;
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
    const revoca = jest.fn();
    URL.revokeObjectURL = revoca;
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
    const desar = Array.from(div.querySelectorAll('button')).find((b) => b.textContent === t('p5.desar'));
    expect(desar?.disabled).toBe(true);
    await act(async () => root.unmount());
    div.remove();
  });
});
