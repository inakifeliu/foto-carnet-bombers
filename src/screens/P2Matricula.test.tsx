import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { t } from '../i18n';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void) => void }).act;

const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  webGL: true,
  compatible: true
};

const VaAP2: React.FC = () => {
  const { dispatch } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'ENDAVANT' });
    dispatch({ tipus: 'ENDAVANT' });
  }, [dispatch]);
  return null;
};

describe('P2Matricula', () => {
  it("el botó Continuar sempre està actiu i, en enviar un valor invàlid (Enter), mostra l'error", () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => {
      root.render(
        <ProveidorApp config={CONFIG_PER_DEFECTE} funcionalitats={FUNCIONALITATS}>
          <VaAP2 />
          <Contingut />
        </ProveidorApp>
      );
    });
    const boto = div.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(boto.disabled).toBe(false);
    const alerta = div.querySelector('#fc-matricula-error') as HTMLElement;
    expect(alerta.textContent).toBe('');

    // Enviar el formulari amb el camp buit (equivalent a Enter) mostra l'error.
    act(() => {
      (div.querySelector('form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );
    });
    expect(alerta.textContent).toBe(t('p2.error'));
    expect(div.querySelector('#fc-matricula')?.getAttribute('aria-invalid')).toBe('true');

    act(() => root.unmount());
    div.remove();
  });
});
