import * as React from 'react';
import styles from '../styles/brand.module.css';

export interface ITitolProps {
  children?: React.ReactNode;
}

/**
 * L'únic h1 de cada pantalla. Té `tabIndex={-1}` perquè en canviar de pantalla el focus hi va a parar
 * (vegeu `Contingut` a App.tsx): els lectors de pantalla el llegeixen i el teclat continua des d'aquí.
 */
export const Titol: React.FC<ITitolProps> = ({ children }) => (
  <h1 className={styles.titol} tabIndex={-1} data-titol-pantalla="">
    {children}
  </h1>
);
