/**
 * Accessibilitat automàtica (Fase 4): jest-axe sobre cada pantalla renderitzada, una sola h1 per pantalla,
 * focus al títol en canviar de pantalla, modals accessibles i icones decoratives. El contrast de colors
 * (que jsdom no pot calcular) es comprova a `contrast.test.ts`.
 */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';
import type { Pantalla } from '../app/estat';
import { registre } from '../cleanup/neteja';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ICONES_INSTRUCCIONS } from '../components/IconesInstruccions';
import { t } from '../i18n';
import { ContextIncorrecte } from '../screens/ContextIncorrecte';
import type { IFoto } from '../captura/fotos';

expect.extend(toHaveNoViolations);

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }).act;

/** Sense WebGL no es carreguen els models de MediaPipe: les proves d'accessibilitat no els necessiten. */
const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: false,
  webGL: false,
  compatible: true
};

const opcionsAxe = {
  rules: {
    // El vídeo de la càmera en directe no porta àudio (muted): no hi ha res a subtitular.
    'video-caption': { enabled: false }
  }
};

const fotoSimulada = (id: number): IFoto => ({
  id,
  canvas: document.createElement('canvas'),
  url: 'blob:foto-' + id,
  puntuacio: 80 + id,
  avisos: ['avis.retallFora']
});

/** Nombre d'ENDAVANT des de P0 per arribar a cada pantalla. */
const ENDAVANT: Record<Pantalla, number> = {
  P0Benvinguda: 0,
  P1Instruccions: 1,
  P2Matricula: 2,
  P3Captura: 3,
  P4Seleccio: 4,
  P5Desar: 5,
  P6Forms: 6,
  P7Final: 7,
  NoCompatible: 0
};

const Salta: React.FC<{ endavant: number; fotos: IFoto[] }> = ({ endavant, fotos }) => {
  const { dispatch, afegeixFoto } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula: '12345' });
    fotos.forEach(afegeixFoto);
    for (let i = 0; i < endavant; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch, afegeixFoto, endavant, fotos]);
  return null;
};

async function monta(
  pantalla: Pantalla,
  opcions: { compatible?: boolean; fotos?: IFoto[] } = {}
): Promise<{ div: HTMLDivElement; root: Root }> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const fotos = opcions.fotos ?? [];
  await act(async () => {
    root.render(
      <ProveidorApp
        config={CONFIG_PER_DEFECTE}
        funcionalitats={{ ...FUNCIONALITATS, compatible: opcions.compatible ?? true }}
      >
        <Salta endavant={ENDAVANT[pantalla]} fotos={fotos} />
        <Contingut />
      </ProveidorApp>
    );
  });
  await act(async () => {});
  return { div, root };
}

function posaCameraPermisDenegat(): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })),
      enumerateDevices: jest.fn().mockResolvedValue([])
    },
    configurable: true
  });
}

beforeEach(() => {
  for (const nom of ['createObjectURL', 'revokeObjectURL'] as const) {
    if (typeof URL[nom] !== 'function') {
      Object.defineProperty(URL, nom, { value: () => 'blob:prova', configurable: true, writable: true });
    }
  }
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  posaCameraPermisDenegat();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  registre.neteja();
  document.body.innerHTML = '';
});

const PANTALLES: [string, Pantalla, boolean][] = [
  ['P0 Benvinguda', 'P0Benvinguda', true],
  ['P1 Instruccions', 'P1Instruccions', true],
  ['P2 Matrícula', 'P2Matricula', true],
  ['P3 Captura', 'P3Captura', true],
  ['P4 Selecció', 'P4Seleccio', true],
  ['P5 Desar', 'P5Desar', true],
  ['P6 Forms (amb el modal d’instruccions)', 'P6Forms', true],
  ['P7 Final', 'P7Final', true],
  ['Navegador no compatible', 'NoCompatible', false]
];

describe('Accessibilitat: jest-axe per pantalla', () => {
  it.each(PANTALLES)('%s no té violacions', async (_nom, pantalla, compatible) => {
    const { div, root } = await monta(pantalla, { compatible, fotos: [fotoSimulada(1), fotoSimulada(2)] });
    expect(await axe(div, opcionsAxe)).toHaveNoViolations();
    await act(async () => root.unmount());
  });

  it('P6 amb el modal tancat tampoc no té violacions', async () => {
    const { div, root } = await monta('P6Forms');
    const tancar = Array.from(div.querySelectorAll('button')).find((b) => b.textContent === t('nav.tancar'));
    await act(async () => tancar?.click());
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    expect(await axe(div, opcionsAxe)).toHaveNoViolations();
    await act(async () => root.unmount());
  });

  it('P2 amb un error de validació no té violacions', async () => {
    const { div, root } = await monta('P2Matricula');
    const camp = div.querySelector('input') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(camp, 'abc');
      camp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      (div.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    });
    expect(div.querySelector('[role="alert"]')?.textContent).toBe(t('p2.error'));
    expect(await axe(div, opcionsAxe)).toHaveNoViolations();
    await act(async () => root.unmount());
  });

  it('la pantalla d’error (ErrorBoundary) no té violacions', async () => {
    const Trenca: React.FC = () => {
      throw new Error('prova');
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Trenca />
        </ErrorBoundary>
      );
    });
    expect(div.querySelectorAll('h1')).toHaveLength(1);
    expect(await axe(div, opcionsAxe)).toHaveNoViolations();
    await act(async () => root.unmount());
  });

  it('el context incorrecte (iframe, RF-19) no té violacions', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(<ContextIncorrecte />);
    });
    expect(div.querySelectorAll('h1')).toHaveLength(1);
    expect(await axe(div, opcionsAxe)).toHaveNoViolations();
    await act(async () => root.unmount());
  });
});

describe('Accessibilitat: estructura', () => {
  it.each(PANTALLES)('%s: una sola h1, sense salts de nivell i amb marcadors', async (_n, pantalla, compatible) => {
    const { div, root } = await monta(pantalla, { compatible, fotos: [fotoSimulada(1)] });
    expect(div.querySelectorAll('h1')).toHaveLength(1);
    const nivells = Array.from(div.querySelectorAll('h1, h2, h3, h4')).map((h) => Number(h.tagName[1]));
    expect(nivells[0]).toBe(1);
    nivells.forEach((n, i) => {
      if (i > 0) {
        expect(n - nivells[i - 1]).toBeLessThanOrEqual(1);
      }
    });
    expect(div.querySelector('header')).not.toBeNull();
    expect(div.querySelectorAll('main')).toHaveLength(1);
    expect(div.querySelector('footer')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it('el focus va al títol (h1) de la pantalla nova en canviar de pantalla', async () => {
    const { div, root } = await monta('P0Benvinguda');
    const clica = async (text: string): Promise<void> => {
      const b = Array.from(div.querySelectorAll('button')).find((x) => x.textContent === text);
      await act(async () => b?.click());
    };
    await clica(t('p0.comencar'));
    expect(document.activeElement).toBe(div.querySelector('h1'));
    expect(div.querySelector('h1')?.textContent).toBe(t('p1.titol'));
    expect(div.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    await clica(t('p1.continuar'));
    expect(document.activeElement).toBe(div.querySelector('h1'));
    expect(div.querySelector('h1')?.textContent).toBe(t('p2.titol'));
    await clica(t('nav.enrere'));
    expect(document.activeElement).toBe(div.querySelector('h1'));
    expect(div.querySelector('h1')?.textContent).toBe(t('p1.titol'));
    await act(async () => root.unmount());
  });

  it('el modal és un diàleg (role, aria-modal i nom) i s’hi pot sortir amb Escape', async () => {
    const { div, root } = await monta('P6Forms');
    const dialeg = div.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialeg.getAttribute('aria-modal')).toBe('true');
    const nom = document.getElementById(dialeg.getAttribute('aria-labelledby') ?? '')?.textContent;
    expect(nom).toBe(t('p6.modalTitol'));
    expect(dialeg.contains(document.activeElement)).toBe(true);
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(div.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it('les imatges de marca tenen text alternatiu adequat o són decoratives', async () => {
    const { div, root } = await monta('P0Benvinguda');
    const imatges = Array.from(div.querySelectorAll('img'));
    expect(imatges.length).toBeGreaterThanOrEqual(4);
    imatges.forEach((img) => expect(img.hasAttribute('alt')).toBe(true));
    // Capçalera: signatura de l'Ajuntament i escut de Bombers, amb nom.
    const capcalera = Array.from(div.querySelectorAll('header img')).map((i) => i.getAttribute('alt'));
    expect(capcalera).toEqual([t('capcalera.ajuntament'), t('capcalera.bombers')]);
    // Peu: el logo és decoratiu (el text del Servei ja hi és).
    expect(div.querySelector('footer img')?.getAttribute('alt')).toBe('');
    await act(async () => root.unmount());
  });

  it('P3 sense anàlisi mostra la nota neutra (no promet captura automàtica)', async () => {
    const { div, root } = await monta('P3Captura');
    expect(div.querySelector('[data-nota-p3]')?.textContent).toBe(t('p3.notaSenseAnalisi'));
    expect(div.textContent).not.toContain(t('p3.nota'));
    await act(async () => root.unmount());
  });

  it('P1 mostra una il·lustració decorativa per a cadascun dels 9 punts', async () => {
    expect(ICONES_INSTRUCCIONS).toHaveLength(9);
    const { div, root } = await monta('P1Instruccions');
    const punts = div.querySelectorAll('ol > li');
    expect(punts).toHaveLength(9);
    punts.forEach((li) => {
      const svg = li.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.querySelector('title')).toBeNull();
    });
    await act(async () => root.unmount());
  });
});
