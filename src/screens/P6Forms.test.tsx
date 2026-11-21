import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { t } from '../i18n';

const act = (React as unknown as { act: (cb: () => void) => void }).act;
const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  compatible: true
};

const SaltaAP6: React.FC = () => {
  const { dispatch } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula: '12345' });
    for (let i = 0; i < 6; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch]);
  return null;
};

function monta(): { div: HTMLDivElement; desmonta: () => void } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  act(() =>
    root.render(
      <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
        <SaltaAP6 />
        <Contingut />
      </ProveidorApp>
    )
  );
  return {
    div,
    desmonta: () => {
      act(() => root.unmount());
      div.remove();
    }
  };
}

function posaOnLine(valor: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: valor, configurable: true });
}

describe('P6: avís sense connexió', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).onLine;
  });

  it('amb navigator.onLine === false mostra l’avís de la spec §3 P6', () => {
    posaOnLine(false);
    const { div, desmonta } = monta();
    expect(div.querySelector('[data-offline]')?.textContent).toBe(
      'Cal connexió a internet per enviar el formulari. La foto ja està desada a Imatges; pots enviar-la més tard.'
    );
    expect(div.textContent).toContain(t('p6.senseConnexio'));
    desmonta();
  });

  it('amb connexió no mostra l’avís, i reacciona als esdeveniments offline/online', () => {
    posaOnLine(true);
    const { div, desmonta } = monta();
    expect(div.querySelector('[data-offline]')).toBeNull();
    posaOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(div.querySelector('[data-offline]')).not.toBeNull();
    posaOnLine(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(div.querySelector('[data-offline]')).toBeNull();
    desmonta();
  });
});

describe('P0: privacitat', () => {
  it('el text de P0 diu que l’aplicació funciona tota dins l’ordinador', () => {
    expect(t('p0.privacitat')).toContain('dins el teu ordinador');
  });
});
