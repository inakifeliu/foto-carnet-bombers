import * as React from 'react';
import { IConfig } from '../config/configuracio';
import { detectaFuncionalitats, IFuncionalitats } from '../compat/funcionalitats';
import { t } from '../i18n';
import { Capcalera } from '../components/Capcalera';
import { Peu } from '../components/Peu';
import { P0Benvinguda } from '../screens/P0Benvinguda';
import { P1Instruccions } from '../screens/P1Instruccions';
import { P2Matricula } from '../screens/P2Matricula';
import { P3Captura } from '../screens/P3Captura';
import { P4Seleccio } from '../screens/P4Seleccio';
import { P5Desar } from '../screens/P5Desar';
import { P6Forms } from '../screens/P6Forms';
import { P7Final } from '../screens/P7Final';
import { NoCompatible } from '../screens/NoCompatible';
import styles from '../styles/brand.module.scss';
import { ProveidorApp, useApp } from './AppContext';
import { Pantalla } from './estat';

const PANTALLES: Record<Pantalla, React.FC> = {
  P0Benvinguda,
  P1Instruccions,
  P2Matricula,
  P3Captura,
  P4Seleccio,
  P5Desar,
  P6Forms,
  P7Final,
  NoCompatible
};

const Contingut: React.FC = () => {
  const { estat } = useApp();
  const principal = React.useRef<HTMLElement>(null);
  const primera = React.useRef(true);

  // En canviar de pantalla, el focus passa al contingut (teclat i lectors de pantalla).
  React.useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    principal.current?.focus();
  }, [estat.pantalla]);

  const PantallaActual = PANTALLES[estat.pantalla];
  return (
    <div className={styles.arrel}>
      <Capcalera />
      <main className={styles.principal} ref={principal} tabIndex={-1} aria-label={t('app.principal')}>
        <PantallaActual />
      </main>
      <Peu />
    </div>
  );
};

export interface IAppProps {
  config: IConfig;
}

export const App: React.FC<IAppProps> = ({ config }) => {
  // La detecció (RF-17) es fa un sol cop a l'inici.
  const [funcionalitats] = React.useState<IFuncionalitats>(() => detectaFuncionalitats());
  return (
    <ProveidorApp config={config} funcionalitats={funcionalitats}>
      <Contingut />
    </ProveidorApp>
  );
};
