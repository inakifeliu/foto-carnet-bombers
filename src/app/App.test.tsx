import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CONFIG_PER_DEFECTE, type IConfig } from '../config/configuracio';
import { t } from '../i18n';
import { Contingut } from './App';
import { ProveidorApp, useApp } from './AppContext';

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void) => void }).act;

const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  compatible: true
};

/** Salta directament a P6 (matrícula desada + 6 avenços) en muntar-se. */
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

function monta(config: IConfig, saltaAP6: boolean): { div: HTMLDivElement; root: Root } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(
      <ProveidorApp config={config} funcionalitats={FUNCIONALITATS}>
        {saltaAP6 && <SaltaAP6 />}
        <Contingut />
      </ProveidorApp>
    );
  });
  return { div, root };
}

function tecla(element: Element, key: string, shiftKey = false): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  });
}

describe('App: focus del modal de P6', () => {
  it('en entrar a P6 el modal conserva el focus (App no el roba) i atrapa el Tab', () => {
    const { div, root } = monta(CONFIG_PER_DEFECTE, true);
    const dialeg = div.querySelector('[aria-modal="true"]') as HTMLElement;
    expect(dialeg).not.toBeNull();
    expect(dialeg.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(div.querySelector('main'));

    // Tab des de l'últim element torna al primer.
    const focalitzables = Array.prototype.slice.call(
      dialeg.querySelectorAll('a[href], button:not([disabled])')
    ) as HTMLElement[];
    const ultim = focalitzables[focalitzables.length - 1];
    ultim.focus();
    tecla(ultim, 'Tab');
    expect(document.activeElement).toBe(focalitzables[0]);
    // Shift+Tab des del primer va a l'últim.
    tecla(focalitzables[0], 'Tab', true);
    expect(document.activeElement).toBe(ultim);

    act(() => root.unmount());
    div.remove();
  });

  it('Esc tanca el modal i el focus torna al botó «Mostrar les instruccions»', () => {
    const { div, root } = monta(CONFIG_PER_DEFECTE, true);
    const dialeg = div.querySelector('[aria-modal="true"]') as HTMLElement;
    tecla(document.activeElement as Element, 'Escape');
    expect(div.querySelector('[aria-modal="true"]')).toBeNull();
    expect(dialeg.isConnected).toBe(false);
    const actiu = document.activeElement as HTMLElement;
    expect(actiu.tagName).toBe('BUTTON');
    expect(actiu.textContent).toBe(t('p6.mostrarInstruccions'));

    act(() => root.unmount());
    div.remove();
  });

  it("plantilla no https: P6 mostra el missatge d'error de configuració en lloc de l'enllaç", () => {
    const config: IConfig = { ...CONFIG_PER_DEFECTE, forms: { urlPlantilla: 'http://f/?r={MATRICULA}' } };
    const { div, root } = monta(config, true);
    expect(div.textContent).toContain(t('p6.urlNoHttps'));
    expect(div.querySelector('a[href]')).toBeNull();

    act(() => root.unmount());
    div.remove();
  });

  it('sense plantilla (sense marcador): missatge sensePlantilla', () => {
    const config: IConfig = { ...CONFIG_PER_DEFECTE, forms: { urlPlantilla: 'https://f/?r=1' } };
    const { div, root } = monta(config, true);
    expect(div.textContent).toContain(t('p6.sensePlantilla'));

    act(() => root.unmount());
    div.remove();
  });
});
