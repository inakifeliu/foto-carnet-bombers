import * as React from 'react';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';
import { Boto } from './Boto';

export interface IModalProps {
  titol: string;
  onTancar: () => void;
  /** Element on retornar el focus en tancar; per defecte, el que tenia el focus en obrir-se (si encara existeix). */
  retornaFocusA?: () => HTMLElement | undefined;
  children?: React.ReactNode;
}

const FOCALITZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Diàleg modal accessible: aria-modal, focus atrapat, Esc per tancar i retorn del focus. */
export const Modal: React.FC<IModalProps> = ({ titol, onTancar, retornaFocusA, children }) => {
  const dialeg = React.useRef<HTMLDivElement>(null);
  const retornaFocusRef = React.useRef(retornaFocusA);
  retornaFocusRef.current = retornaFocusA;
  const idTitol = 'fc-modal-titol';

  React.useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const elements = dialeg.current?.querySelectorAll<HTMLElement>(FOCALITZABLES);
    if (elements && elements.length > 0) {
      elements[0].focus();
    } else {
      dialeg.current?.focus();
    }
    return (): void => {
      const destinacio = retornaFocusRef.current?.() ?? (anterior && anterior.isConnected ? anterior : undefined);
      if (destinacio && typeof destinacio.focus === 'function') {
        destinacio.focus();
      }
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onTancar();
      return;
    }
    if (e.key !== 'Tab' || !dialeg.current) {
      return;
    }
    const elements = dialeg.current.querySelectorAll<HTMLElement>(FOCALITZABLES);
    if (elements.length === 0) {
      e.preventDefault();
      return;
    }
    const primer = elements[0];
    const ultim = elements[elements.length - 1];
    const actiu = document.activeElement;
    if (e.shiftKey && (actiu === primer || actiu === dialeg.current)) {
      e.preventDefault();
      ultim.focus();
    } else if (!e.shiftKey && actiu === ultim) {
      e.preventDefault();
      primer.focus();
    }
  };

  return (
    <div className={styles.modalFons}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitol}
        ref={dialeg}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={idTitol} className={styles.titolModal}>
          {titol}
        </h2>
        {children}
        <div className={styles.accions}>
          <Boto variant="secundari" onClick={onTancar}>
            {t('nav.tancar')}
          </Boto>
        </div>
      </div>
    </div>
  );
};
