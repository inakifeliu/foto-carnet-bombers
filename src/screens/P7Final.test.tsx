import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';
import { type IHandleFitxer, obteHandleDesat, oblidaHandleDesat, recordaHandleDesat } from '../captura/desar';
import { registre } from '../cleanup/neteja';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { t } from '../i18n';

const act = (React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }).act;
const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  webGL: true,
  compatible: true
};

const SaltaAP7: React.FC = () => {
  const { dispatch } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula: '12345' });
    for (let i = 0; i < 7; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch]);
  return null;
};

async function monta(): Promise<{ div: HTMLDivElement; root: Root }> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <SaltaAP7 />
        <Contingut />
      </ProveidorApp>
    );
  });
  return { div, root };
}

const boto = (div: HTMLElement, text: string): HTMLButtonElement | undefined =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent === text);

const handleSimulat = (extra: Partial<IHandleFitxer> = {}): IHandleFitxer => ({
  name: '12345.jpg',
  createWritable: jest.fn(),
  remove: jest.fn().mockResolvedValue(undefined),
  queryPermission: jest.fn().mockResolvedValue('granted'),
  requestPermission: jest.fn().mockResolvedValue('granted'),
  ...extra
});

afterEach(() => {
  oblidaHandleDesat();
  registre.neteja();
  document.body.innerHTML = '';
});

describe('P7: final i RF-15', () => {
  it('mostra l’agraïment i el recordatori d’esborrar la foto', async () => {
    const { div, root } = await monta();
    expect(div.querySelector('h1')?.textContent).toBe(t('p7.titol'));
    expect(div.textContent).toContain(t('p7.recordatori', { fitxer: '12345.jpg', carpeta: t('carpeta.imatges') }));
    await act(async () => root.unmount());
  });

  it('amb handle i remove(): el botó esborra el fitxer i diu «Foto esborrada»', async () => {
    const handle = handleSimulat();
    recordaHandleDesat(handle);
    const { div, root } = await monta();
    // El handle no s'allibera en arribar a P7.
    expect(obteHandleDesat()).toBe(handle);
    await act(async () => boto(div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(handle.remove).toHaveBeenCalledTimes(1);
    expect(div.textContent).toContain(t('p7.esborrada'));
    expect(boto(div, t('p7.esborrar'))).toBeUndefined();
    await act(async () => root.unmount());
  });

  it('si el permís ja és concedit no el torna a demanar; si no, el demana abans d’esborrar', async () => {
    const concedit = handleSimulat();
    recordaHandleDesat(concedit);
    let m = await monta();
    await act(async () => boto(m.div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(concedit.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(concedit.requestPermission).not.toHaveBeenCalled();
    await act(async () => m.root.unmount());

    const calDemanar = handleSimulat({ queryPermission: jest.fn().mockResolvedValue('prompt') });
    recordaHandleDesat(calDemanar);
    m = await monta();
    await act(async () => boto(m.div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(calDemanar.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(calDemanar.remove).toHaveBeenCalledTimes(1);
    await act(async () => m.root.unmount());
  });

  it('permís denegat: no s’esborra res, s’amaga el botó i queda el recordatori', async () => {
    const handle = handleSimulat({
      queryPermission: jest.fn().mockResolvedValue('prompt'),
      requestPermission: jest.fn().mockResolvedValue('denied')
    });
    recordaHandleDesat(handle);
    const { div, root } = await monta();
    await act(async () => boto(div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(handle.remove).not.toHaveBeenCalled();
    expect(boto(div, t('p7.esborrar'))).toBeUndefined();
    expect(div.textContent).toContain(t('p7.errorEsborrar'));
    expect(div.textContent).toContain('Un cop enviada');
    await act(async () => root.unmount());
  });

  it('sense remove() el botó no apareix i només queda el recordatori', async () => {
    recordaHandleDesat(handleSimulat({ remove: undefined }));
    const { div, root } = await monta();
    expect(boto(div, t('p7.esborrar'))).toBeUndefined();
    expect(div.textContent).toContain('Un cop enviada');
    await act(async () => root.unmount());
  });

  it('sense handle (alternativa a Baixades) el botó no apareix', async () => {
    const { div, root } = await monta();
    expect(boto(div, t('p7.esborrar'))).toBeUndefined();
    await act(async () => root.unmount());
  });

  it('si remove() falla: s’amaga el botó, missatge discret i el recordatori es manté', async () => {
    const handle = handleSimulat({ remove: jest.fn().mockRejectedValue(new Error('NotAllowedError')) });
    recordaHandleDesat(handle);
    const { div, root } = await monta();
    await act(async () => boto(div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(handle.remove).toHaveBeenCalled();
    expect(boto(div, t('p7.esborrar'))).toBeUndefined();
    expect(div.textContent).toContain(t('p7.errorEsborrar'));
    expect(div.textContent).toContain('Un cop enviada');
    await act(async () => root.unmount());
  });

  it('en esborrar no es desactiva el botó (aria-disabled), no es pot duplicar i el focus acaba a «Començar de nou»', async () => {
    let acaba: () => void = () => undefined;
    const handle = handleSimulat({ remove: jest.fn(() => new Promise<void>((r) => (acaba = r))) });
    recordaHandleDesat(handle);
    const { div, root } = await monta();
    const esborrar = boto(div, t('p7.esborrar'));
    esborrar?.focus();
    await act(async () => esborrar?.click());
    const enCurs = boto(div, t('p7.esborrant'));
    expect(enCurs?.disabled).toBe(false);
    expect(enCurs?.getAttribute('aria-disabled')).toBe('true');
    await act(async () => enCurs?.click());
    expect(handle.remove).toHaveBeenCalledTimes(1);
    await act(async () => acaba());
    expect(div.textContent).toContain(t('p7.esborrada'));
    expect(document.activeElement).toBe(boto(div, t('p7.comencarDeNou')));
    await act(async () => root.unmount());
  });

  it('després d’esborrar-la s’amaga el recordatori d’esborrar', async () => {
    recordaHandleDesat(handleSimulat());
    const { div, root } = await monta();
    expect(div.textContent).toContain('Un cop enviada');
    await act(async () => boto(div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(div.textContent).toContain(t('p7.esborrada'));
    expect(div.textContent).not.toContain('Un cop enviada');
    await act(async () => root.unmount());
  });

  it('si l’esborrat falla, el focus també acaba a «Començar de nou»', async () => {
    recordaHandleDesat(handleSimulat({ remove: jest.fn().mockRejectedValue(new Error('x')) }));
    const { div, root } = await monta();
    boto(div, t('p7.esborrar'))?.focus();
    await act(async () => boto(div, t('p7.esborrar'))?.click());
    await act(async () => {});
    expect(div.textContent).toContain(t('p7.errorEsborrar'));
    expect(document.activeElement).toBe(boto(div, t('p7.comencarDeNou')));
    await act(async () => root.unmount());
  });

  it('requestPermission es crida a partir del mateix clic, sense cap altra interacció', async () => {
    const handle = handleSimulat({ queryPermission: jest.fn().mockResolvedValue('prompt') });
    recordaHandleDesat(handle);
    const { div, root } = await monta();
    await act(async () => boto(div, t('p7.esborrar'))?.click());
    expect(handle.requestPermission).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('«Començar de nou» torna a P0 i oblida el handle', async () => {
    recordaHandleDesat(handleSimulat());
    const { div, root } = await monta();
    await act(async () => boto(div, t('p7.comencarDeNou'))?.click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p0.titol'));
    expect(obteHandleDesat()).toBeUndefined();
    await act(async () => root.unmount());
  });

  it('pagehide oblida el handle', async () => {
    recordaHandleDesat(handleSimulat());
    const { root } = await monta();
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(obteHandleDesat()).toBeUndefined();
    await act(async () => root.unmount());
  });
});
