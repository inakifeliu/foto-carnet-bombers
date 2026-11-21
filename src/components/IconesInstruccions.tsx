import * as React from 'react';
import styles from '../styles/brand.module.css';

/**
 * Il·lustracions de les 9 instruccions de P1: dibuix propi, traç de 2 px sobre una quadrícula de 48 × 48 i colors
 * de les variables de l'aplicació (traç fosc, farciment blanc i vermell com a accent). Són decoratives
 * (`aria-hidden`): el text de cada punt ja diu el mateix. Cap logo ni marca de tercers.
 */
const Dibuix: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <svg className={styles.icona} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** 1. Fons blanc i llis: una paret (vermell) amb una persona al davant. */
const Fons: React.FC = () => (
  <Dibuix>
    <rect x="6" y="6" width="36" height="36" rx="2" className={styles.icAccent} />
    <circle cx="24" cy="21" r="5" className={styles.icOmple} />
    <path d="M14 42 C14 32 34 32 34 42" className={styles.icOmple} />
  </Dibuix>
);

/** 2. Bona llum de cara: una bombeta amb els raigs en vermell. */
const Llum: React.FC = () => (
  <Dibuix>
    <path d="M17 31 C10 25 13 14 24 14 C35 14 38 25 31 31 V34 H17 Z" className={styles.icOmple} />
    <path d="M19 39 H29 M21 43 H27" className={styles.icTrac} />
    <path d="M24 4 V8 M8 11 L11 14 M40 11 L37 14 M4 24 H8 M40 24 H44" className={styles.icAccent} />
  </Dibuix>
);

/** 3. Polo de l'uniforme: una samarreta amb coll i obertura (vermell). */
const Polo: React.FC = () => (
  <Dibuix>
    <path d="M17 7 L5 13 L9 22 L15 20 V41 H33 V20 L39 22 L43 13 L31 7 C29 12 19 12 17 7 Z" className={styles.icOmple} />
    <path d="M24 11 V22" className={styles.icAccent} />
  </Dibuix>
);

/** 4. Galetes de categoria i de nom/matrícula: dues plaques (la del nom en vermell). */
const Galetes: React.FC = () => (
  <Dibuix>
    <rect x="8" y="9" width="32" height="12" rx="2" className={styles.icOmple} />
    <path d="M14 15 H24" className={styles.icTrac} />
    <rect x="8" y="27" width="32" height="12" rx="2" className={styles.icOmple} />
    <path d="M14 33 H34" className={styles.icAccent} />
  </Dibuix>
);

/** 5. Sense gorra, casc ni ulleres de sol: una gorra dins un senyal de prohibit (vermell). */
const SenseGorra: React.FC = () => (
  <Dibuix>
    <path d="M13 29 C13 18 33 18 33 29 Z M33 29 H42" className={styles.icOmple} />
    <circle cx="24" cy="24" r="19" className={styles.icAccent} />
    <path d="M10.6 37.4 L37.4 10.6" className={styles.icAccent} />
  </Dibuix>
);

/** 6. Cara descoberta: una cara amb els ulls ben visibles i els cabells (vermell) cap enrere. */
const CaraDescoberta: React.FC = () => (
  <Dibuix>
    <circle cx="24" cy="25" r="14" className={styles.icOmple} />
    <path d="M10.5 22 C12 8 36 8 37.5 22" className={styles.icAccent} />
    <path d="M18 26 H18.1 M30 26 H30.1" className={styles.icTrac} />
    <path d="M20 33 C22 35 26 35 28 33" className={styles.icTrac} />
  </Dibuix>
);

/** 7. Mirada a la càmera: un ull amb l'iris en vermell. */
const Mirada: React.FC = () => (
  <Dibuix>
    <path d="M4 24 C11 13 37 13 44 24 C37 35 11 35 4 24 Z" className={styles.icOmple} />
    <circle cx="24" cy="24" r="6" className={styles.icAccent} />
    <circle cx="24" cy="24" r="1.5" className={styles.icTrac} />
  </Dibuix>
);

/** 8. Espatlles rectes: un bust amb la línia de les espatlles (vermell) horitzontal. */
const Espatlles: React.FC = () => (
  <Dibuix>
    <circle cx="24" cy="13" r="6" className={styles.icOmple} />
    <path d="M7 43 C7 31 15 27 24 27 C33 27 41 31 41 43" className={styles.icOmple} />
    <path d="M4 31 H44" className={styles.icAccent} />
  </Dibuix>
);

/** 9. Un company/a que comprova l'enquadrament: dues persones (la segona amb el contorn en vermell). */
const Company: React.FC = () => (
  <Dibuix>
    <circle cx="16" cy="16" r="5" className={styles.icOmple} />
    <path d="M6 40 C6 30 12 27 16 27 C20 27 26 30 26 40" className={styles.icOmple} />
    <circle cx="33" cy="16" r="5" className={styles.icAccent} />
    <path d="M24 40 C24 30 29 27 33 27 C37 27 42 30 42 40" className={styles.icAccent} />
  </Dibuix>
);

/** Una il·lustració per a cada punt de P1 (índex 0-8). */
export const ICONES_INSTRUCCIONS: React.FC[] = [
  Fons,
  Llum,
  Polo,
  Galetes,
  SenseGorra,
  CaraDescoberta,
  Mirada,
  Espatlles,
  Company
];
