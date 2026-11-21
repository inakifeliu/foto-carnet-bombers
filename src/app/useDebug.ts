import * as React from 'react';

/** Entorn mínim consultat pel mode diagnòstic (injectable per als tests). */
export type EntornDebug = Pick<Window, 'location' | 'addEventListener' | 'removeEventListener'>;

export function hashDebug(hash: string): boolean {
  return hash.toLowerCase() === '#debug';
}

export function esCombinacioDebug(e: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'key'>): boolean {
  return e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd';
}

/**
 * Mode diagnòstic (RF-18): s'activa amb `#debug` a l'adreça i es commuta amb Ctrl + Alt + D.
 * Aquí només n'hi ha la base (RF-18 complet a la Fase 2).
 */
export function useDebug(entorn: EntornDebug = window): boolean {
  const [actiu, setActiu] = React.useState<boolean>(() => hashDebug(entorn.location.hash));

  React.useEffect(() => {
    const alTeclat = (e: Event): void => {
      const ke = e as KeyboardEvent;
      if (esCombinacioDebug(ke)) {
        ke.preventDefault();
        setActiu((a) => !a);
      }
    };
    const alHash = (): void => setActiu(hashDebug(entorn.location.hash));
    entorn.addEventListener('keydown', alTeclat);
    entorn.addEventListener('hashchange', alHash);
    return (): void => {
      entorn.removeEventListener('keydown', alTeclat);
      entorn.removeEventListener('hashchange', alHash);
    };
  }, [entorn]);

  return actiu;
}
