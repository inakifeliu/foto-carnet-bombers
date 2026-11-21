import * as React from 'react';
import styles from '../styles/brand.module.css';
import { t } from '../i18n';

export type EstatSemafor = 'ok' | 'avis' | 'error' | 'cap' | 'noDisp';

export interface ISemaforProps {
  etiqueta: string;
  estat: EstatSemafor;
}

const CLASSES: Record<EstatSemafor, string> = {
  ok: styles.semaforOk,
  avis: styles.semaforAvis,
  error: styles.semaforError,
  cap: styles.semaforCap,
  noDisp: styles.semaforCap
};

/** Semàfor d'un control de qualitat (RF-05). El color no és l'únic indicador: hi ha text. `cap` = sense dades; `noDisp` = no es pot avaluar en aquest equip (gris). */
export const Semafor: React.FC<ISemaforProps> = ({ etiqueta, estat }) => (
  <li className={styles.semafor}>
    <span className={`${styles.semaforPunt} ${CLASSES[estat]}`} aria-hidden="true" />
    <span>
      {etiqueta}: <strong>{t(`p3.estat.${estat}` as const)}</strong>
    </span>
  </li>
);
