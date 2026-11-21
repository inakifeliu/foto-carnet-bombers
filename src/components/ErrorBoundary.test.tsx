import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '../i18n';
import { ErrorBoundary } from './ErrorBoundary';

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void) => void }).act;

const Trenca: React.FC = () => {
  throw new Error('dada-personal-12345');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    // React escriu l'error capturat a la consola; en aquest test és esperat.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('un fill que llança mostra la pantalla d’error en català, sense dades ni imatges', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    act(() =>
      root.render(
        <ErrorBoundary>
          <Trenca />
        </ErrorBoundary>
      )
    );
    expect(div.querySelector('h1')?.textContent).toBe(t('error.titol'));
    expect(div.textContent).toContain(t('error.missatge'));
    expect(div.querySelector('button')?.textContent).toBe(t('error.reinicia'));
    expect(div.querySelector('[data-versio]')?.textContent).toMatch(/Versió v.+ · compilat el /);
    expect(div.querySelector('img, canvas, video')).toBeNull();
    // El missatge de l'error mai arriba a la pantalla.
    expect(div.textContent).not.toContain('dada-personal-12345');
    act(() => root.unmount());
  });

  it('sense errors, mostra els fills', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    act(() =>
      root.render(
        <ErrorBoundary>
          <p>contingut</p>
        </ErrorBoundary>
      )
    );
    expect(div.textContent).toBe('contingut');
    act(() => root.unmount());
  });
});
