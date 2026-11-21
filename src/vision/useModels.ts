import * as React from 'react';
import { registre } from '../cleanup/neteja';
import type { IConfig } from '../config/configuracio';
import { creaAnalitzador, type IAnalitzador } from './analitzador';
import { carregaModels } from './mediapipe';

/**
 * Analitzadors vius (RF-16: s'alliberen també a la neteja global). Hi ha UNA sola tasca al registre, encara que es
 * entri moltes vegades a P3: cada analitzador s'afegeix aquí i es treu en desmuntar-se.
 */
const analitzadorsVius = new Set<IAnalitzador>();
let tascaRegistrada = false;

function registraAnalitzador(a: IAnalitzador): void {
  analitzadorsVius.add(a);
  if (!tascaRegistrada) {
    tascaRegistrada = true;
    registre.registraTasca(() => {
      tascaRegistrada = false;
      analitzadorsVius.forEach((x) => x.allibera());
      analitzadorsVius.clear();
    });
  }
}

export interface IEstatModels {
  /** `noDisponible`: sense WebGL (RF-17) no es carrega res; la captura manual continua. */
  estat: 'carregant' | 'llest' | 'error' | 'noDisponible';
  analitzador?: IAnalitzador;
  delegat?: 'GPU' | 'CPU';
  /** Temps de càrrega (ms). */
  ms?: number;
}

/**
 * Carrega els models de MediaPipe en muntar-se (entrar a P3) des dels recursos incrustats i crea l'analitzador.
 * Els models queden a la memòria cau fins a la neteja RF-16 (que els tanca); l'analitzador (canvas i buffers
 * d'anàlisi) s'allibera en desmuntar-se. Un error de càrrega no atura la captura manual.
 * RF-17: sense WebGL (ni 1 ni 2) NO es carreguen els models (tasks-vision 1.2.3 en necessita fins i tot amb el delegat
 * CPU): l'estat és directament `noDisponible`.
 */
export function useModels(config: IConfig, webGL2: boolean, webGL: boolean): IEstatModels {
  const [estat, setEstat] = React.useState<IEstatModels>({ estat: webGL ? 'carregant' : 'noDisponible' });

  React.useEffect(() => {
    if (!webGL) {
      return;
    }
    let viu = true;
    let analitzador: IAnalitzador | undefined;
    carregaModels({ webGL2 })
      .then((models) => {
        if (!viu) {
          return;
        }
        analitzador = creaAnalitzador(models, config);
        registraAnalitzador(analitzador);
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
      if (analitzador) {
        analitzador.allibera();
        analitzadorsVius.delete(analitzador);
      }
    };
  }, [config, webGL2, webGL]);

  return estat;
}
