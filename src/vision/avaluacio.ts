/**
 * Avaluació dels controls de RF-05 (funcions PURES): de les mesures numèriques als estats verd/àmbar/vermell,
 * el missatge de més prioritat i la puntuació de qualitat 0-100.
 *
 * Verd = compleix el llindar de la spec; àmbar = no el compleix però és a prop (`llindars.margeAmbar`);
 * vermell = més lluny. Tant l'àmbar com el vermell mostren el missatge d'acció.
 */
import type { ILlindars, IPesos } from '../config/configuracio';
import type { ClauI18n } from '../i18n';
import { avaluaInterval, avaluaMaxim, avaluaMinim, puntuacioControl, type IAvaluacioLlindar } from './llindar';
import {
  ORDRE_PRIORITAT,
  type ClauControl,
  type EstatControl,
  type IAvaluacio,
  type IControl,
  type IMesures
} from './tipus';

const GRAVETAT: Record<EstatControl, number> = { ok: 0, cap: 1, avis: 2, error: 3 };

const sensePunts = (): IControl => ({ estat: 'cap', puntuacio: 0 });

function control(a: IAvaluacioLlindar, valor: number, missatge: ClauI18n): IControl {
  return {
    estat: a.estat,
    valor,
    missatge: a.estat === 'ok' ? undefined : missatge,
    puntuacio: puntuacioControl(a)
  };
}

interface ICandidat {
  a: IAvaluacioLlindar;
  valor: number;
  missatge: ClauI18n;
}

/** Control format per diverses mètriques: l'estat és el pitjor i el missatge el de la mètrica amb més excés. */
function combina(candidats: ICandidat[], valorPrincipal: number): IControl {
  let pitjor = candidats[0];
  for (const c of candidats) {
    const mes = GRAVETAT[c.a.estat] > GRAVETAT[pitjor.a.estat];
    const empat = c.a.estat === pitjor.a.estat && c.a.excesRel > pitjor.a.excesRel;
    if (mes || empat) {
      pitjor = c;
    }
  }
  const puntuacio = Math.min(...candidats.map((c) => puntuacioControl(c.a)));
  return {
    estat: pitjor.a.estat,
    valor: valorPrincipal,
    missatge: pitjor.a.estat === 'ok' ? undefined : pitjor.missatge,
    puntuacio
  };
}

/** Avalua totes les mesures (instantànies o suavitzades) i en treu el missatge prioritari. */
export function avalua(m: IMesures, ll: ILlindars): IAvaluacio {
  const marge = ll.margeAmbar;
  const controls = {} as Record<ClauControl, IControl>;

  // 5.1 Una sola cara
  controls.cara =
    m.nCares === 1
      ? { estat: 'ok', valor: 1, puntuacio: 1 }
      : {
          estat: 'error',
          valor: m.nCares,
          missatge: m.nCares === 0 ? 'p3.msg.capCara' : 'p3.msg.moltesCares',
          puntuacio: 0
        };

  if (m.nCares !== 1) {
    ORDRE_PRIORITAT.forEach((clau) => {
      if (clau !== 'cara') {
        controls[clau] = sensePunts();
      }
    });
    return resumeix(controls);
  }

  // 5.3 Distància (alçada de la cara / alçada del fotograma)
  controls.distancia =
    m.alcadaCara === undefined
      ? sensePunts()
      : (() => {
          const a = avaluaInterval(m.alcadaCara, ll.alcadaCaraMin, ll.alcadaCaraMax, marge);
          return control(a, m.alcadaCara, a.costat === 'baix' ? 'p3.msg.apropa' : 'p3.msg.allunya');
        })();

  // 5.2 Centrat horitzontal. La visualització és en mirall: cara a l'esquerra del fotograma SENSE mirall (desviació
  // negativa) = a la dreta de la pantalla → l'usuari s'ha de moure cap a l'esquerra (el seu costat i el de la pantalla).
  controls.centrat =
    m.desviacio === undefined
      ? sensePunts()
      : control(
          avaluaMaxim(Math.abs(m.desviacio), ll.centratMax, marge),
          Math.abs(m.desviacio),
          m.desviacio < 0 ? 'p3.msg.movEsq' : 'p3.msg.movDre'
        );

  // 5.4 Orientació del cap (yaw, pitch, roll); els signes estan documentats a angles.ts.
  controls.orientacio =
    m.yaw === undefined || m.pitch === undefined || m.roll === undefined
      ? sensePunts()
      : combina(
          [
            {
              a: avaluaMaxim(Math.abs(m.yaw), ll.yawMax, marge),
              valor: m.yaw,
              missatge: m.yaw > 0 ? 'p3.msg.giraDre' : 'p3.msg.giraEsq'
            },
            {
              a: avaluaMaxim(Math.abs(m.pitch), ll.pitchMax, marge),
              valor: m.pitch,
              missatge: m.pitch > 0 ? 'p3.msg.aixeca' : 'p3.msg.abaixa'
            },
            { a: avaluaMaxim(Math.abs(m.roll), ll.rollMax, marge), valor: m.roll, missatge: 'p3.msg.recte' }
          ],
          Math.max(Math.abs(m.yaw), Math.abs(m.pitch), Math.abs(m.roll))
        );

  // 5.7 Il·luminació de la cara
  controls.llum =
    m.llum === undefined
      ? sensePunts()
      : (() => {
          const a = avaluaInterval(m.llum, ll.llumCaraMin, ll.llumCaraMax, marge);
          return control(a, m.llum, a.costat === 'baix' ? 'p3.msg.massaFosc' : 'p3.msg.massaLlum');
        })();

  // 5.6 Fons blanc (sense fons a la zona = res a jutjar: «cap», amb puntuació neutra)
  controls.fons =
    m.fons === undefined
      ? { estat: 'cap', puntuacio: 0.5 }
      : control(avaluaMinim(m.fons, ll.fonsBlancMin, marge, 1), m.fons, 'p3.msg.fonsNoBlanc');

  // 5.8 Ombres
  controls.ombra =
    m.ombra === undefined ? sensePunts() : control(avaluaMaxim(m.ombra, ll.ombraMax, marge), m.ombra, 'p3.msg.ombra');

  // 5.10 Polo blau
  controls.polo =
    m.polo === undefined
      ? sensePunts()
      : control(avaluaMinim(m.polo, ll.poloProporcioMin, marge, 1), m.polo, 'p3.msg.polo');

  // 5.11 Espatlles dins el fotograma
  controls.espatlles =
    m.torsVisible === undefined
      ? sensePunts()
      : control(avaluaMinim(m.torsVisible, ll.torsVisibleMin, marge, 1), m.torsVisible, 'p3.msg.espatlles');

  // 5.5 Ulls oberts i boca tancada
  controls.ullsBoca =
    m.parpelleig === undefined && m.bocaOberta === undefined
      ? sensePunts()
      : combina(
          [
            ...(m.parpelleig !== undefined
              ? [
                  {
                    a: avaluaMaxim(m.parpelleig, ll.parpelleigMax, marge),
                    valor: m.parpelleig,
                    missatge: 'p3.msg.ulls' as const
                  }
                ]
              : []),
            ...(m.bocaOberta !== undefined
              ? [
                  {
                    a: avaluaMaxim(m.bocaOberta, ll.bocaObertaMax, marge),
                    valor: m.bocaOberta,
                    missatge: 'p3.msg.boca' as const
                  }
                ]
              : [])
          ],
          Math.max(m.parpelleig ?? 0, m.bocaOberta ?? 0)
        );

  // 5.9 Nitidesa (variància del Laplacià)
  controls.nitidesa =
    m.nitidesa === undefined
      ? sensePunts()
      : control(avaluaMinim(m.nitidesa, ll.nitidesaMin, marge, ll.nitidesaMin * 3), m.nitidesa, 'p3.msg.nitidesa');

  return resumeix(controls);
}

function resumeix(controls: Record<ClauControl, IControl>): IAvaluacio {
  let missatge: ClauI18n | undefined;
  for (const clau of ORDRE_PRIORITAT) {
    const c = controls[clau];
    if ((c.estat === 'error' || c.estat === 'avis') && c.missatge) {
      missatge = c.missatge;
      break;
    }
  }
  const totOk = ORDRE_PRIORITAT.every((clau) => controls[clau].estat === 'ok');
  return { controls, missatge, totOk };
}

/** Missatges de tots els controls que no són verds, en ordre de prioritat (per als avisos de cada foto a P4). */
export function missatgesAvis(av: IAvaluacio): ClauI18n[] {
  const llista: ClauI18n[] = [];
  for (const clau of ORDRE_PRIORITAT) {
    const c = av.controls[clau];
    if ((c.estat === 'error' || c.estat === 'avis') && c.missatge) {
      llista.push(c.missatge);
    }
  }
  return llista;
}

/** Pes de cada control a la puntuació; `cara` no hi és (sense exactament una cara la puntuació és 0). */
const PES_DE: Record<Exclude<ClauControl, 'cara'>, keyof IPesos> = {
  distancia: 'distancia',
  centrat: 'centrat',
  orientacio: 'orientacio',
  llum: 'llum',
  fons: 'fons',
  ombra: 'ombra',
  polo: 'polo',
  espatlles: 'espatlles',
  ullsBoca: 'ullsBoca',
  nitidesa: 'nitidesa'
};

/**
 * Puntuació de qualitat 0-100: mitjana ponderada (`pesosPuntuacio`) de la «distància al llindar» de cada control
 * (`puntuacioControl`), menys la penalització (punts) per retall fora del fotograma. Sense exactament una cara, 0.
 */
export function calculaPuntuacio(av: IAvaluacio, pesos: IPesos, penalitzacio = 0): number {
  if (av.controls.cara.estat !== 'ok') {
    return 0;
  }
  let suma = 0;
  let pes = 0;
  (Object.keys(PES_DE) as (keyof typeof PES_DE)[]).forEach((clau) => {
    const w = pesos[PES_DE[clau]];
    if (w > 0) {
      suma += w * av.controls[clau].puntuacio;
      pes += w;
    }
  });
  const base = pes > 0 ? (suma / pes) * 100 : 0;
  return Math.max(0, Math.min(100, Math.round(base - penalitzacio)));
}
