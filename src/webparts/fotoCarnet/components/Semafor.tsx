import * as React from 'react';
import styles from '../styles/brand.module.scss';
import { t } from '../i18n';

export type EstatSemafor = 'ok' | 'avis' | 'error';

export interface ISemaforProps {
  etiqueta: string;
  estat: EstatSemafor;
}

const CLASSES: Record<EstatSemafor, string> = {
  ok: styles.semaforOk,
  avis: styles.semaforAvis,
  error: styles.semaforError
};

/** Placeholder del semàfor (la Fase 1 hi connectarà els controls RF-05). El color no és l'únic indicador: hi ha text. */
export const Semafor: React.FC<ISemaforProps> = ({ etiqueta, estat }) => (
  <li className={styles.semafor}>
    <span className={`${styles.semaforPunt} ${CLASSES[estat]}`} aria-hidden="true" />
    <span>
      {etiqueta}: <strong>{t(`p3.estat.${estat}` as const)}</strong>
    </span>
  </li>
);
