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
