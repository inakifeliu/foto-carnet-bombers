import { createRoot, type Root } from 'react-dom/client';
import { App } from './app/App';
import { CONFIG } from './config/actual';
import { ContextIncorrecte } from './screens/ContextIncorrecte';

/** RF-19: true si la pàgina s'executa dins un iframe (o si no es pot determinar). */
export function esDinsIframe(win: Pick<Window, 'top' | 'self'> = window): boolean {
  try {
    return win.top !== win.self;
  } catch {
    // L'accés a window.top pot llençar en alguns contextos d'aïllament: millor tractar-ho com a iframe.
    return true;
  }
}

export interface IArrencada {
  root: Root;
  mode: 'app' | 'iframe';
}

/**
 * Arrencada: substitueix el missatge estàtic de l'HTML (RF-19) per l'aplicació o, dins un iframe,
 * pel mateix missatge amb la capçalera i el peu (sense demanar mai la càmera).
 */
export function arrenca(arrel: HTMLElement, win: Pick<Window, 'top' | 'self'> = window): IArrencada {
  const root = createRoot(arrel);
  if (esDinsIframe(win)) {
    root.render(<ContextIncorrecte />);
    return { root, mode: 'iframe' };
  }
  root.render(<App config={CONFIG} />);
  return { root, mode: 'app' };
}
