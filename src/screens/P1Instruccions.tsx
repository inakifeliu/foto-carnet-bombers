import * as React from 'react';
import { useApp } from '../app/AppContext';
import { Boto } from '../components/Boto';
import { ICONES_INSTRUCCIONS } from '../components/IconesInstruccions';
import { TextRic } from '../components/TextRic';
import { ClauI18n, t } from '../i18n';
import { Titol } from '../components/Titol';
import styles from '../styles/brand.module.css';

const ELEMENTS: ClauI18n[] = [
  'p1.item1',
  'p1.item2',
  'p1.item3',
  'p1.item4',
  'p1.item5',
  'p1.item6',
  'p1.item7',
  'p1.item8',
  'p1.item9'
];

export const P1Instruccions: React.FC = () => {
  const { dispatch } = useApp();
  return (
    <section className={styles.pantalla}>
      <Titol>{t('p1.titol')}</Titol>
      <p className={styles.text}>{t('p1.intro')}</p>
      <ol className={styles.llistaInstruccions}>
        {ELEMENTS.map((clau, i) => (
          <li key={clau} className={styles.instruccio}>
            <span className={styles.iconaInstruccio} aria-hidden="true">
              {React.createElement(ICONES_INSTRUCCIONS[i])}
            </span>
            <span className={styles.textInstruccio}>
              <TextRic text={t(clau)} />
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('nav.enrere')}
        </Boto>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p1.continuar')}</Boto>
      </div>
    </section>
  );
};
