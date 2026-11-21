import * as React from 'react';
import { netejaTot } from '../cleanup/neteja';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';
import { DATA_COMPILACIO, VERSIO } from '../versio';

interface IProps {
  children?: React.ReactNode;
}

interface IEstat {
  fallat: boolean;
}

/**
 * Última xarxa de seguretat: si qualsevol component llança en renderitzar, es mostra una pantalla
 * d'error en català en lloc d'una pàgina en blanc. No mostra mai cap imatge ni dada personal (ni el
 * missatge de l'error) i allibera la càmera i la resta de recursos (RF-16). El peu és text pla
 * (no reutilitza `Peu`) perquè el mateix error podria venir d'un component del peu.
 */
export class ErrorBoundary extends React.Component<IProps, IEstat> {
  public state: IEstat = { fallat: false };

  public static getDerivedStateFromError(): IEstat {
    return { fallat: true };
  }

  public componentDidCatch(): void {
    try {
      netejaTot();
    } catch {
      // Res més a fer: la pantalla d'error ja es mostra.
    }
  }

  private readonly reinicia = (): void => {
    window.location.reload();
  };

  public render(): React.ReactNode {
    if (!this.state.fallat) {
      return this.props.children;
    }
    return (
      <div className={styles.arrel}>
        <main className={styles.principal} data-error="">
          <section className={styles.pantalla}>
            <h1 className={styles.titol}>{t('error.titol')}</h1>
            <p className={styles.text} role="alert">
              {t('error.missatge')}
            </p>
            <div className={styles.accions}>
              <button type="button" className={styles.botoPrimari} onClick={this.reinicia}>
                {t('error.reinicia')}
              </button>
            </div>
          </section>
        </main>
        <footer className={styles.peu}>
          <p className={styles.versio} data-versio="">
            {t('peu.versio', { versio: VERSIO, data: DATA_COMPILACIO })}
          </p>
        </footer>
      </div>
    );
  }
}
