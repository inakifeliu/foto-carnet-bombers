import * as React from 'react';
import { arrenca, esDinsIframe } from './arrenca';
import { t } from './i18n';

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void) => void }).act;

const finestra = (top: unknown, self: unknown): Pick<Window, 'top' | 'self'> =>
  ({ top, self }) as unknown as Pick<Window, 'top' | 'self'>;

describe('RF-19: context incorrecte', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    // jsdom no té càmera ni WebGL2: es simulen perquè l'app es consideri compatible.
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: (): void => undefined },
      configurable: true
    });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  });

  it("esDinsIframe: false a la finestra principal, true dins un iframe o si l'accés a window.top llença", () => {
    const w = {};
    expect(esDinsIframe(finestra(w, w))).toBe(false);
    expect(esDinsIframe(finestra({}, {}))).toBe(true);
    const llença = {
      get top(): never {
        throw new Error('SecurityError');
      },
      self: {}
    } as unknown as Pick<Window, 'top' | 'self'>;
    expect(esDinsIframe(llença)).toBe(true);
    // jsdom executa fora de qualsevol iframe.
    expect(esDinsIframe()).toBe(false);
  });

  it("fora d'un iframe, en muntar-se substitueix el missatge estàtic per l'aplicació", () => {
    const arrel = document.createElement('div');
    arrel.id = 'arrel';
    arrel.innerHTML = `<p class="missatge-inicial">${t('rf19.missatge')}</p>`;
    document.body.appendChild(arrel);
    const w = {};
    let mode = '';
    act(() => {
      mode = arrenca(arrel, finestra(w, w)).mode;
    });
    expect(mode).toBe('app');
    expect(arrel.querySelector('.missatge-inicial')).toBeNull();
    expect(arrel.textContent).toContain(t('p0.titol'));
    expect(arrel.textContent).not.toContain(t('rf19.missatge'));
    expect(arrel.querySelector('button')?.textContent).toBe(t('p0.comencar'));
  });

  it("dins un iframe mostra el missatge de descàrrega i NO l'aplicació (ni demana la càmera)", () => {
    const arrel = document.createElement('div');
    document.body.appendChild(arrel);
    let mode = '';
    act(() => {
      mode = arrenca(arrel, finestra({}, {})).mode;
    });
    expect(mode).toBe('iframe');
    expect(arrel.textContent).toContain(t('rf19.missatge'));
    expect(arrel.textContent).not.toContain(t('p0.titol'));
    expect(arrel.querySelector('button')).toBeNull();
    expect(arrel.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("el missatge és el que es dona a l'usuari", () => {
    expect(t('rf19.missatge')).toBe("Descarrega aquest fitxer a l'ordinador i obre'l amb Microsoft Edge.");
  });
});
