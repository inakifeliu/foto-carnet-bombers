import * as React from 'react';
import { registre } from '../cleanup/neteja';
import type { IConfig } from '../config/configuracio';
import { creaAnalitzador, type IAnalitzador } from './analitzador';
import { carregaModels } from './mediapipe';

export interface IEstatModels {
  estat: 'carregant' | 'llest' | 'error';
  analitzador?: IAnalitzador;
  delegat?: 'GPU' | 'CPU';
  /** Temps de càrrega (ms). */
  ms?: number;
}

/**
 * Carrega els models de MediaPipe en muntar-se (entrar a P3) des dels recursos incrustats i crea l'analitzador.
 * Els models queden a la memòria cau fins a la neteja RF-16 (que els tanca); l'analitzador (canvas i buffers
 * d'anàlisi) s'allibera en desmuntar-se. Un error de càrrega no atura la captura manual.
 */
export function useModels(config: IConfig, webGL2: boolean): IEstatModels {
  const [estat, setEstat] = React.useState<IEstatModels>({ estat: 'carregant' });

  React.useEffect(() => {
    let viu = true;
    let analitzador: IAnalitzador | undefined;
    carregaModels({ webGL2 })
      .then((models) => {
        if (!viu) {
          return;
        }
        analitzador = creaAnalitzador(models, config);
        const a = analitzador;
        registre.registraTasca(() => a.allibera());
        setEstat({ estat: 'llest', analitzador, delegat: models.delegat, ms: models.ms });
      })
      .catch((e: unknown) => {
        // Només per al diagnòstic: la pantalla ja explica l'error a la persona usuària.
        console.warn('[models] no s’han pogut carregar:', e instanceof Error ? e.message : String(e));
        if (viu) {
          setEstat({ estat: 'error' });
        }
      });
    return (): void => {
      viu = false;
      analitzador?.allibera();
    };
  }, [config, webGL2]);

  return estat;
}
