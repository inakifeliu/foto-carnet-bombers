import type { IConfig } from '../config/configuracio';
import type { IInstantania } from './estatAnalisi';
import { ORDRE_PRIORITAT, type IMesures } from './tipus';

/**
 * JSON del mode diagnòstic (RF-18) per ajustar llindars. Llista blanca: només hi van nombres, estats, claus de
 * missatge, la versió i la configuració. MAI cap imatge (ni la màscara ni els landmarks) ni la matrícula. De la
 * configuració només se n'omet l'URL del Forms (es conserva el host).
 */
export interface IDiagnosticJson {
  versio: string;
  dataCompilacio: string;
  generat: string;
  rendiment: {
    fpsAnalisi: number;
    msPerFotograma: number;
    fpsVideo: number | null;
    delegat: string | null;
    /** Pressupost adaptatiu: nivell (`normal`, `reduit`) i fps objectiu. */
    nivellPressupost: string | null;
    fpsObjectiu: number | null;
    /** Temps mitjà (ms) de cada pas: dibuix, Face Landmarker, segmentador i mètriques. */
    tempsPerPas: { dibuix: number; landmarker: number; segmentador: number; metriques: number } | null;
    segmentacio: 'activa' | 'noDisponible' | null;
  };
  fotograma: { ample: number; alt: number } | null;
  mesures: IMesures | null;
  controls: Record<string, { estat: string; valor: number | null; missatge: string | null; puntuacio: number }>;
  missatgePrioritari: string | null;
  retall: { x: number; y: number; w: number; h: number; origenCap: string; fraccioFora: number } | null;
  config: Omit<IConfig, 'forms'> & { forms: { host: string } };
}

function host(url: string): string {
  try {
    return new URL(url.replace('{MATRICULA}', 'X')).host;
  } catch {
    return '?';
  }
}

const arrodoneix = (x: number): number => Math.round(x * 10000) / 10000;

export function creaDiagnostic(
  instantania: IInstantania | undefined,
  config: IConfig,
  versio: string,
  dataCompilacio: string,
  ara: Date = new Date()
): IDiagnosticJson {
  const { forms, ...resta } = config;
  const controls: IDiagnosticJson['controls'] = {};
  if (instantania) {
    ORDRE_PRIORITAT.forEach((clau) => {
      const c = instantania.avaluacio.controls[clau];
      controls[clau] = {
        estat: c.estat,
        valor: c.valor === undefined ? null : arrodoneix(c.valor),
        missatge: c.missatge ?? null,
        puntuacio: arrodoneix(c.puntuacio)
      };
    });
  }
  const mesures: IMesures | null = instantania ? { ...instantania.mesures } : null;
  if (mesures) {
    (Object.keys(mesures) as (keyof IMesures)[]).forEach((k) => {
      const v = mesures[k];
      if (typeof v === 'number') {
        mesures[k] = arrodoneix(v);
      }
    });
  }
  const r = instantania?.retall;
  return {
    versio,
    dataCompilacio,
    generat: ara.toISOString(),
    rendiment: {
      fpsAnalisi: instantania ? arrodoneix(instantania.fpsAnalisi) : 0,
      msPerFotograma: instantania ? arrodoneix(instantania.msPerFotograma) : 0,
      fpsVideo: instantania?.fpsVideo === undefined ? null : arrodoneix(instantania.fpsVideo),
      delegat: instantania?.delegat ?? null,
      nivellPressupost: instantania?.nivell ?? null,
      fpsObjectiu: instantania?.fpsObjectiu ?? null,
      tempsPerPas: instantania?.temps
        ? {
            dibuix: arrodoneix(instantania.temps.dibuix),
            landmarker: arrodoneix(instantania.temps.landmarker),
            segmentador: arrodoneix(instantania.temps.segmentador),
            metriques: arrodoneix(instantania.temps.metriques)
          }
        : null,
      segmentacio: instantania?.segmentacio === undefined ? null : instantania.segmentacio ? 'activa' : 'noDisponible'
    },
    fotograma: instantania ? { ample: instantania.ample, alt: instantania.alt } : null,
    mesures,
    controls,
    missatgePrioritari: instantania?.avaluacio.missatge ?? null,
    retall: r ? { ...r.rect, origenCap: r.origenCap, fraccioFora: arrodoneix(r.fraccioFora) } : null,
    config: { ...resta, forms: { host: host(forms.urlPlantilla) } }
  };
}

/** Descarrega el JSON amb un `<a download>` sobre una URL `blob:` (que es revoca tot seguit). */
export function descarregaDiagnostic(json: IDiagnosticJson, doc: Document = document): void {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = `diagnostic-foto-carnet-${json.generat.replace(/[:.]/g, '-')}.json`;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
