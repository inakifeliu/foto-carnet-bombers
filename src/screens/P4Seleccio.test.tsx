import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';
import { registre } from '../cleanup/neteja';
import type { IFoto } from '../captura/fotos';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { t } from '../i18n';
import { indexMillorFoto } from './P4Seleccio';

const act = (React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }).act;
const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  webGL: true,
  compatible: true
};

const foto = (id: number, puntuacio?: number, avisos?: IFoto['avisos']): IFoto => ({
  id,
  canvas: document.createElement('canvas'),
  url: `blob:foto-${id}`,
  puntuacio,
  avisos
});

const Salta: React.FC<{ fotos: IFoto[] }> = ({ fotos }) => {
  const { dispatch, afegeixFoto } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula: '12345' });
    fotos.forEach(afegeixFoto);
    for (let i = 0; i < 4; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch, afegeixFoto, fotos]);
  return null;
};

async function monta(fotos: IFoto[]): Promise<{ div: HTMLDivElement; root: Root }> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <Salta fotos={fotos} />
        <Contingut />
      </ProveidorApp>
    );
  });
  return { div, root };
}

beforeEach(() => {
  for (const nom of ['createObjectURL', 'revokeObjectURL'] as const) {
    if (typeof URL[nom] !== 'function') {
      Object.defineProperty(URL, nom, { value: () => 'blob:prova', configurable: true, writable: true });
    }
  }
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  registre.neteja();
  document.body.innerHTML = '';
});

describe('indexMillorFoto', () => {
  it('la de més puntuació; en cas d’empat, la primera; sense puntuacions, la primera', () => {
    expect(indexMillorFoto([foto(1, 50), foto(2, 80), foto(3, 60)])).toBe(1);
    expect(indexMillorFoto([foto(1, 70), foto(2, 70)])).toBe(0);
    expect(indexMillorFoto([foto(1), foto(2)])).toBe(0);
    expect(indexMillorFoto([foto(1), foto(2, 10)])).toBe(1);
    expect(indexMillorFoto([])).toBe(0);
  });
});

describe('P4: puntuació real i avisos', () => {
  it('mostra la puntuació de cada foto, la millor ve marcada i cada foto porta els seus avisos', async () => {
    const { div, root } = await monta([
      foto(1, 50, ['p3.msg.massaFosc']),
      foto(2, 80, []),
      foto(3, 60, ['p3.msg.apropa', 'avis.retallFora'])
    ]);
    expect(div.querySelector('h1')?.textContent).toBe(t('p4.titol'));
    const items = Array.from(div.querySelectorAll('main li.fotoItem'));
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain(t('p4.puntuacio', { punts: 50 }));
    expect(items[1].textContent).toContain(t('p4.puntuacio', { punts: 80 }));
    expect(items[2].textContent).toContain(t('p4.puntuacio', { punts: 60 }));
    expect(div.textContent).not.toContain('simulad');
    // La millor (la 2) preseleccionada; les altres no.
    expect(items[1].querySelector('.miniaturaSeleccionada')).not.toBeNull();
    expect(items[1].textContent).toContain(t('p4.recomanada'));
    expect(items[0].querySelector('.miniaturaSeleccionada')).toBeNull();
    expect(items[0].textContent).not.toContain(t('p4.recomanada'));
    // Avisos de cada foto.
    expect(items[0].textContent).toContain(t('p3.msg.massaFosc'));
    expect(items[2].textContent).toContain(t('p3.msg.apropa'));
    expect(items[2].textContent).toContain(t('avis.retallFora'));
    expect(items[1].querySelector('[data-avisos-foto]')).toBeNull();
    // Sense avisos (amb puntuació): «Sense avisos»; amb avisos, no.
    expect(items[1].textContent).toContain(t('p4.cap'));
    expect(items[0].textContent).not.toContain(t('p4.cap'));
    await act(async () => root.unmount());
  });

  it('la preseleccionada és la que arriba a P5 si no se’n tria cap altra', async () => {
    const { div, root } = await monta([foto(1, 50), foto(2, 80)]);
    // «Triar aquesta» de la millor (la segona)
    const botons = Array.from(div.querySelectorAll('button')).filter((b) => b.textContent === t('p4.triar'));
    await act(async () => botons[1].click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p5.titol'));
    expect(div.querySelector('main img')?.getAttribute('src')).toBe('blob:foto-2');
    await act(async () => root.unmount());
  });

  it('una foto sense anàlisi diu que no té puntuació', async () => {
    const { div, root } = await monta([foto(1, undefined, ['avis.senseAnalisi'])]);
    expect(div.textContent).toContain(t('p4.senseAnalisi'));
    expect(div.textContent).toContain(t('avis.senseAnalisi'));
    expect(div.textContent).not.toContain(t('p4.recomanada'));
    await act(async () => root.unmount());
  });
});

describe('P4: alliberament de fotos (RF-09, RF-16)', () => {
  const botons = (div: HTMLElement, text: string): HTMLButtonElement[] =>
    Array.from(div.querySelectorAll('button')).filter((b) => b.textContent === text);

  it('«Triar aquesta» allibera immediatament les altres fotos i manté només la triada', async () => {
    const fotos = [foto(1, 50), foto(2, 80), foto(3, 60)];
    const { div, root } = await monta(fotos);
    await act(async () => botons(div, t('p4.triar'))[0].click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p5.titol'));
    const revocades = (URL.revokeObjectURL as jest.Mock).mock.calls.map((c) => c[0]);
    expect(revocades).toEqual(expect.arrayContaining(['blob:foto-2', 'blob:foto-3']));
    expect(revocades).not.toContain('blob:foto-1');
    expect(fotos[1].canvas.width).toBe(0);
    expect(fotos[2].canvas.width).toBe(0);
    expect(fotos[0].canvas.width).not.toBe(0);
    expect(div.querySelector('main img')?.getAttribute('src')).toBe('blob:foto-1');
    await act(async () => root.unmount());
  });

  it('en tornar enrere des de P5 només queda la foto triada (coherent amb l’alliberament)', async () => {
    const { div, root } = await monta([foto(1, 50), foto(2, 80)]);
    await act(async () => botons(div, t('p4.triar'))[1].click());
    await act(async () => botons(div, t('nav.enrere'))[0].click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p4.titol'));
    const items = div.querySelectorAll('main li.fotoItem');
    expect(items).toHaveLength(1);
    expect(items[0].querySelector('img')?.getAttribute('src')).toBe('blob:foto-2');
    await act(async () => root.unmount());
  });

  it('«Repetir les fotos» allibera totes les fotos i torna a P3', async () => {
    const fotos = [foto(1, 50), foto(2, 80)];
    const { div, root } = await monta(fotos);
    await act(async () => botons(div, t('p4.repetir'))[0].click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p3.titol'));
    const revocades = (URL.revokeObjectURL as jest.Mock).mock.calls.map((c) => c[0]);
    expect(revocades).toEqual(expect.arrayContaining(['blob:foto-1', 'blob:foto-2']));
    expect(fotos.every((f) => f.canvas.width === 0)).toBe(true);
    expect(div.textContent).toContain(t('p3.comptador', { n: 1, max: 3 }));
    await act(async () => root.unmount());
  });
});

describe('P4: lupa per veure la foto en gran', () => {
  it('cada foto té un botó de lupa que obre la foto en gran; «Tancar» torna a la llista', async () => {
    const { div, root } = await monta([foto(1, 50), foto(2, 80)]);
    const lupes = Array.from(div.querySelectorAll<HTMLButtonElement>('button[data-lupa]'));
    expect(lupes).toHaveLength(2);
    expect(lupes[1].getAttribute('aria-label')).toBe(t('p4.veureGran', { n: 2 }));
    await act(async () => lupes[1].click());
    const dialeg = document.querySelector('[role="dialog"]');
    expect(dialeg).not.toBeNull();
    expect(dialeg?.textContent).toContain(t('p4.fotoGran', { n: 2 }));
    expect(dialeg?.querySelector('img')?.getAttribute('src')).toBe('blob:foto-2');
    expect(dialeg?.textContent).toContain(t('p4.puntuacio', { punts: 80 }));
    const tancar = Array.from(dialeg!.querySelectorAll('button')).find((b) => b.textContent === t('nav.tancar'));
    await act(async () => tancar!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(div.querySelector('h1')?.textContent).toBe(t('p4.titol'));
    await act(async () => root.unmount());
  });

  it('des de la foto en gran es pot triar directament', async () => {
    const fotos = [foto(1, 50), foto(2, 80)];
    const { div, root } = await monta(fotos);
    await act(async () => div.querySelectorAll<HTMLButtonElement>('button[data-lupa]')[0].click());
    const dialeg = document.querySelector('[role="dialog"]')!;
    const triar = Array.from(dialeg.querySelectorAll('button')).find((b) => b.textContent === t('p4.triarGran'));
    await act(async () => triar!.click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p5.titol'));
    expect(div.querySelector('main img')?.getAttribute('src')).toBe('blob:foto-1');
    expect(fotos[1].canvas.width).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
