import { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { registre } from '../cleanup/neteja';
import { obteRecurs, obteUrlBlob, revocaUrlsBlob } from '../recursos';

/**
 * MediaPipe carrega el loader del WASM afegint un `<script src="blob:…">` a `document.body` i no
 * l'elimina. Un cop carregat (o si ha fallat) ja no cal: l'esborrem perquè no quedi al DOM.
 */
export function eliminaScriptsBlob(doc: Document = document): void {
  doc.querySelectorAll('script[src^="blob:"]').forEach((s) => s.remove());
}

export interface IResultatProva {
  delegat: 'GPU' | 'CPU';
  ms: number;
}

/**
 * Prova de càrrega (només des del mode diagnòstic): crea el Face Landmarker amb el loader i el WASM
 * com a URL `blob:` i el model com a `modelAssetBuffer`, tots tretets dels recursos incrustats
 * (RF-20), i el tanca. No fa servir la càmera. La Fase 2 hi construirà la càrrega real.
 */
export async function provaCarregaFaceLandmarker(): Promise<IResultatProva> {
  const inici = performance.now();
  const wasmLoaderPath = await obteUrlBlob('wasm-loader', 'text/javascript');
  const wasmBinaryPath = await obteUrlBlob('wasm-binari', 'application/wasm');
  const model = await obteRecurs('model-cara');
  const crea = (delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> =>
    FaceLandmarker.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      { baseOptions: { modelAssetBuffer: model, delegate }, runningMode: 'IMAGE', numFaces: 1 }
    );
  let delegat: 'GPU' | 'CPU' = 'GPU';
  let landmarker: FaceLandmarker;
  try {
    try {
      landmarker = await crea('GPU');
    } catch {
      delegat = 'CPU';
      landmarker = await crea('CPU');
    }
  } finally {
    eliminaScriptsBlob();
  }
  landmarker.close();
  // RF-16: les URL blob ja no calen un cop carregat el model.
  revocaUrlsBlob();
  return { delegat, ms: Math.round(performance.now() - inici) };
}

/** Models carregats (Fase 2): Face Landmarker + Image Segmenter, tots dos en mode VIDEO i amb el mateix delegat. */
export interface IModels {
  landmarker: FaceLandmarker;
  segmenter: ImageSegmenter;
  delegat: 'GPU' | 'CPU';
  /** Temps de càrrega (ms). */
  ms: number;
}

/**
 * RF-02: el retrocés a CPU només és legítim si l'error és propi de la GPU (WebGL, context gràfic, textures,
 * shaders…). Qualsevol altre error (model corrupte, WASM, memòria…) es propaga: la CPU no el solucionaria.
 */
export function esErrorGpu(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /\b(gpu|webgl2?|egl|gles|opengl|gl[_ ]?context|graphics|texture|shader|framebuffer)\b/i.test(text);
}

export interface IOpcionsModels {
  /** RF-17: sense WebGL2 es va directament a la CPU. */
  webGL2: boolean;
}

let promesaModels: Promise<IModels> | undefined;
let modelsActuals: IModels | undefined;

export function modelsCarregats(): IModels | undefined {
  return modelsActuals;
}

/** Tanca els models (`close()`) i buida la memòria cau (RF-16). Segur de cridar diverses vegades. */
export function tancaModels(): void {
  const actuals = modelsActuals;
  modelsActuals = undefined;
  promesaModels = undefined;
  [actuals?.landmarker, actuals?.segmenter].forEach((m) => {
    try {
      m?.close();
    } catch {
      // Ja tancat: no s'ha d'aturar la neteja.
    }
  });
}

async function creaModels(webGL2: boolean): Promise<IModels> {
  const inici = performance.now();
  const wasmLoaderPath = await obteUrlBlob('wasm-loader', 'text/javascript');
  const wasmBinaryPath = await obteUrlBlob('wasm-binari', 'application/wasm');
  const [modelCara, modelSegmentacio] = await Promise.all([obteRecurs('model-cara'), obteRecurs('model-segmentacio')]);
  const fileset = { wasmLoaderPath, wasmBinaryPath };
  const crea = async (delegate: 'GPU' | 'CPU'): Promise<Omit<IModels, 'ms'>> => {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: modelCara, delegate },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
    try {
      const segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: modelSegmentacio, delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false
      });
      return { landmarker, segmenter, delegat: delegate };
    } catch (e) {
      landmarker.close();
      throw e;
    }
  };
  let r: Omit<IModels, 'ms'>;
  try {
    if (!webGL2) {
      r = await crea('CPU');
    } else {
      try {
        r = await crea('GPU');
      } catch (e) {
        if (!esErrorGpu(e)) {
          throw e;
        }
        r = await crea('CPU');
      }
    }
  } finally {
    // MediaPipe afegeix un <script src="blob:…"> per cada càrrega i no l'esborra.
    eliminaScriptsBlob();
  }
  // RF-16: les URL blob del loader i el WASM ja no calen un cop carregats.
  revocaUrlsBlob();
  return { ...r, ms: Math.round(performance.now() - inici) };
}

/**
 * Carrega (una sola vegada; les crides concurrents comparteixen la promesa) el Face Landmarker i l'Image Segmenter
 * des dels recursos incrustats (RF-20). Un error no es queda a la memòria cau: es pot tornar a provar.
 * Es tanquen a la neteja RF-16 (`registre`).
 */
export function carregaModels(opcions: IOpcionsModels): Promise<IModels> {
  if (!promesaModels) {
    const p = creaModels(opcions.webGL2).then((m) => {
      modelsActuals = m;
      registre.registraTasca(tancaModels);
      return m;
    });
    p.catch(() => {
      if (promesaModels === p) {
        promesaModels = undefined;
      }
    });
    promesaModels = p;
  }
  return promesaModels;
}
