import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { Peu } from '../components/Peu';
import { t } from '../i18n';
import { DATA_COMPILACIO, VERSIO } from '../versio';
import { Contingut } from './App';
import { ProveidorApp } from './AppContext';
import { esCombinacioDebug, hashDebug, useDebug, type EntornDebug } from './useDebug';

const act = (React as unknown as { act: (cb: () => void) => void }).act;
const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  webGL: true,
  compatible: true
};

function monta(element: React.ReactElement): { div: HTMLDivElement; root: Root } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root.render(element));
  return { div, root };
}

const teclaDebug = (): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, altKey: true, bubbles: true }));
  });
};

describe('versió visible (RF-21)', () => {
  it('el peu mostra la versió i la data de compilació', () => {
    const { div, root } = monta(<Peu />);
    const text = div.querySelector('[data-versio]')?.textContent ?? '';
    expect(text).toBe(t('peu.versio', { versio: VERSIO, data: DATA_COMPILACIO }));
    expect(text).toContain(`v${VERSIO}`);
    expect(text).toContain(DATA_COMPILACIO);
    act(() => root.unmount());
    div.remove();
  });

  it('la versió es veu a totes les pantalles (P0 i les següents)', () => {
    const { div, root } = monta(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <Contingut />
      </ProveidorApp>
    );
    expect(div.querySelector('footer')?.textContent).toContain(`v${VERSIO}`);
    act(() => {
      (div.querySelector('main button') as HTMLButtonElement).click(); // P0 -> P1
    });
    expect(div.querySelector('h1')?.textContent).toBe(t('p1.titol'));
    expect(div.querySelector('footer')?.textContent).toContain(`v${VERSIO}`);
    act(() => root.unmount());
    div.remove();
  });

  it('en compilar, la versió ve de package.json (substitució per esbuild)', () => {
    // Fora del build es fa servir un valor de desenvolupament amb format semàntic.
    expect(VERSIO).toMatch(/^\d+\.\d+\.\d+/);
    expect(DATA_COMPILACIO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('mode diagnòstic (RF-18, base)', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('hashDebug i esCombinacioDebug', () => {
    expect(hashDebug('#debug')).toBe(true);
    expect(hashDebug('#DEBUG')).toBe(true);
    expect(hashDebug('#altre')).toBe(false);
    expect(hashDebug('')).toBe(false);
    expect(esCombinacioDebug({ ctrlKey: true, altKey: true, key: 'd' })).toBe(true);
    expect(esCombinacioDebug({ ctrlKey: true, altKey: true, key: 'D' })).toBe(true);
    expect(esCombinacioDebug({ ctrlKey: true, altKey: false, key: 'd' })).toBe(false);
    expect(esCombinacioDebug({ ctrlKey: false, altKey: true, key: 'd' })).toBe(false);
    expect(esCombinacioDebug({ ctrlKey: true, altKey: true, key: 'x' })).toBe(false);
  });

  it('useDebug: comença segons el hash i es commuta amb Ctrl+Alt+D', () => {
    const escoltes = new Map<string, EventListener>();
    const entorn = {
      location: { hash: '' },
      addEventListener: (n: string, f: EventListener) => escoltes.set(n, f),
      removeEventListener: (n: string) => escoltes.delete(n)
    } as unknown as EntornDebug;
    let valor = false;
    const Prova: React.FC = () => {
      valor = useDebug(entorn);
      return null;
    };
    const { div, root } = monta(<Prova />);
    expect(valor).toBe(false);
    const premeix = (): void =>
      act(() => {
        escoltes.get('keydown')?.(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, altKey: true }));
      });
    premeix();
    expect(valor).toBe(true);
    premeix();
    expect(valor).toBe(false);
    // hashchange
    (entorn.location as { hash: string }).hash = '#debug';
    act(() => escoltes.get('hashchange')?.(new Event('hashchange')));
    expect(valor).toBe(true);
    act(() => root.unmount());
    expect(escoltes.size).toBe(0);
    div.remove();

    const inicial = { ...entorn, location: { hash: '#debug' } } as unknown as EntornDebug;
    const Prova2: React.FC = () => {
      valor = useDebug(inicial);
      return null;
    };
    const m2 = monta(<Prova2 />);
    expect(valor).toBe(true);
    act(() => m2.root.unmount());
    m2.div.remove();
  });

  it('el panell surt amb Ctrl+Alt+D (versió, data i resum de configuració) i s’amaga amb la mateixa combinació', () => {
    const { div, root } = monta(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <Contingut />
      </ProveidorApp>
    );
    expect(div.querySelector('[data-debug]')).toBeNull();
    teclaDebug();
    const panell = div.querySelector('[data-debug]');
    expect(panell).not.toBeNull();
    expect(panell?.querySelector('#debug-versio')?.textContent).toBe(VERSIO);
    expect(panell?.querySelector('#debug-data')?.textContent).toBe(DATA_COMPILACIO);
    expect(panell?.textContent).toContain(CONFIG_PER_DEFECTE.matriculaRegex);
    expect(panell?.querySelector('img, canvas, video')).toBeNull(); // mai cap imatge
    teclaDebug();
    expect(div.querySelector('[data-debug]')).toBeNull();
    act(() => root.unmount());
    div.remove();
  });

  it('amb #debug a l’adreça el panell surt des de l’inici', () => {
    window.location.hash = '#debug';
    const { div, root } = monta(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <Contingut />
      </ProveidorApp>
    );
    expect(div.querySelector('[data-debug]')).not.toBeNull();
    act(() => root.unmount());
    div.remove();
  });
});
