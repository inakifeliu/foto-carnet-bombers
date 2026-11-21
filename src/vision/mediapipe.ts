import { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { registre } from '../cleanup/neteja';
import { obteRecurs, obteUrlBlob, revocaUrlsBlob } from '../recursos';
import { marcaTemps } from './marcaTemps';

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

/**
 * Models carregats (Fase 2): Face Landmarker + Image Segmenter, tots dos en mode VIDEO i amb el mateix delegat.
 * El segmentador és OPCIONAL: si no s'ha pogut crear (o l'escalfament ha fallat) `segmenter` és undefined i el Face
 * Landmarker continua; sense màscara no es poden jutjar el fons, el polo ni les espatlles (queden «no disponibles»).
 */
export interface IModels {
  landmarker: FaceLandmarker;
  segmenter?: ImageSegmenter;
  delegat: 'GPU' | 'CPU';
  /** Temps de càrrega (ms), sense comptar l'escalfament. */
  ms: number;
  /** Temps de l'escalfament (ms): una primera detecció i segmentació sobre un canvas buit. */
  msEscalfament: number;
}

/**
 * Fragments propis d'un error de la GPU/WebGL. Els identificadors llargs i inconfusibles (`webgl`, `opengl`, `opencl`,
 * `gpu`…) es busquen sense límits de paraula (així també casen `WebGLRenderingContext` o `TfLiteGpuDelegate`); els curts
 * (`egl`, `gles`, `gl_`) només si no van precedits/seguits d'una lletra (no es pot fer servir el límit de paraula: `_` i
 * els dígits compten com a lletra i `EGL_BAD_ALLOC` o `GL_INVALID_OPERATION` no casarien; sense límit, «negligible»
 * casaria amb `egl`).
 */
const PATRO_ERROR_GPU =
  /gpu|webgl|opengl|opencl|vulkan|gl\s*context|context[\s_-]+(?:was[\s_-]+)?lost|lost[\s_-]+context|graphics|texture|shader|framebuffer|(?<![a-z])egl(?![a-z])|(?<![a-z])gles(?![a-z])|(?<![a-z])gl_/i;

/**
 * RF-02: el retrocés a CPU només és legítim si l'error és propi de la GPU (WebGL, context gràfic, textures,
 * shaders, delegat GPU de TFLite, OpenCL…). Qualsevol altre error (model corrupte, WASM, memòria…) es propaga: la CPU
 * no el solucionaria.
 */
export function esErrorGpu(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return PATRO_ERROR_GPU.test(text);
}

export interface IOpcionsModels {
  /** RF-17: sense WebGL2 es va directament a la CPU (la detecció d'absència total de WebGL es fa abans, a `useModels`). */
  webGL2: boolean;
}

/** Mida (px) del canvas buit amb què s'escalfen els models. */
const MIDA_ESCALFAMENT = { ample: 256, alt: 144 };

let promesaModels: Promise<IModels> | undefined;
let modelsActuals: IModels | undefined;
/** S'incrementa a cada `tancaModels`: una càrrega que ha començat abans i acaba després ha de tancar els seus models. */
let generacio = 0;

export function modelsCarregats(): IModels | undefined {
  return modelsActuals;
}

function tancaInstancies(m: { landmarker?: FaceLandmarker; segmenter?: ImageSegmenter } | undefined): void {
  [m?.landmarker, m?.segmenter].forEach((model) => {
    try {
      model?.close();
    } catch {
      // Ja tancat: no s'ha d'aturar la neteja.
    }
  });
}

/** Tanca els models (`close()`) i buida la memòria cau (RF-16). Segur de cridar diverses vegades. */
export function tancaModels(): void {
  const actuals = modelsActuals;
  generacio++;
  modelsActuals = undefined;
  promesaModels = undefined;
  tancaInstancies(actuals);
}

/**
 * Escalfament: la primera inferència de cada model compila shaders i reserva textures (centenars de ms amb GPU o
 * programari). Es fa aquí, mentre la pantalla diu «Preparant l'anàlisi…», amb un canvas petit buit, perquè no la
 * pagui el primer fotograma real del bucle. Retorna si el segmentador ha sobreviscut (si no, s'ha de descartar).
 */
function escalfaModels(landmarker: FaceLandmarker, segmenter: ImageSegmenter | undefined): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = MIDA_ESCALFAMENT.ample;
  canvas.height = MIDA_ESCALFAMENT.alt;
  let segmentadorOk = segmenter !== undefined;
  try {
    try {
      landmarker.detectForVideo(canvas, marcaTemps());
    } catch (e) {
      // No és fatal: si el model és realment inservible, el bucle ho notarà i s'aturarà amb el seu avís.
      console.warn('[models] escalfament del Face Landmarker:', e instanceof Error ? e.message : String(e));
    }
    if (segmenter) {
      try {
        segmenter.segmentForVideo(canvas, marcaTemps(), () => undefined);
      } catch (e) {
        console.warn('[models] escalfament del segmentador:', e instanceof Error ? e.message : String(e));
        segmentadorOk = false;
      }
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
  return segmentadorOk;
}

async function creaModels(webGL2: boolean): Promise<IModels> {
  const inici = performance.now();
  const wasmLoaderPath = await obteUrlBlob('wasm-loader', 'text/javascript');
  const wasmBinaryPath = await obteUrlBlob('wasm-binari', 'application/wasm');
  const fileset = { wasmLoaderPath, wasmBinaryPath };
  const modelCara = await obteRecurs('model-cara');
  const creaLandmarker = (delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: modelCara, delegate },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
  let landmarker: FaceLandmarker;
  let delegat: 'GPU' | 'CPU';
  let segmenter: ImageSegmenter | undefined;
  try {
    // El Face Landmarker és imprescindible: el seu error (després del retrocés a CPU, si és de GPU) es propaga.
    if (!webGL2) {
      delegat = 'CPU';
      landmarker = await creaLandmarker('CPU');
    } else {
      try {
        delegat = 'GPU';
        landmarker = await creaLandmarker('GPU');
      } catch (e) {
        if (!esErrorGpu(e)) {
          throw e;
        }
        delegat = 'CPU';
        landmarker = await creaLandmarker('CPU');
      }
    }
    // El segmentador és opcional: si falla es continua només amb el Face Landmarker.
    try {
      const modelSegmentacio = await obteRecurs('model-segmentacio');
      segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: modelSegmentacio, delegate: delegat },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false
      });
    } catch (e) {
      console.warn('[models] sense segmentador:', e instanceof Error ? e.message : String(e));
      segmenter = undefined;
    }
  } finally {
    // MediaPipe afegeix un <script src="blob:…"> per cada càrrega i no l'esborra.
    eliminaScriptsBlob();
  }
  // RF-16: les URL blob del loader i el WASM ja no calen un cop carregats.
  revocaUrlsBlob();
  const ms = Math.round(performance.now() - inici);
  const iniciEscalfament = performance.now();
  if (!escalfaModels(landmarker, segmenter) && segmenter) {
    // Només es descarta el segmentador: el Face Landmarker segueix en ús.
    tancaInstancies({ segmenter });
    segmenter = undefined;
  }
  return { landmarker, segmenter, delegat, ms, msEscalfament: Math.round(performance.now() - iniciEscalfament) };
}

/**
 * Carrega (una sola vegada; les crides concurrents comparteixen la promesa) el Face Landmarker i l'Image Segmenter
 * des dels recursos incrustats (RF-20) i els escalfa. Un error no es queda a la memòria cau: es pot tornar a provar.
 * Es tanquen a la neteja RF-16 (`registre`). Si `tancaModels` s'ha cridat mentre es carregava, els models nous es
 * tanquen en acabar (no s'assignen) i la promesa es rebutja.
 */
export function carregaModels(opcions: IOpcionsModels): Promise<IModels> {
  if (!promesaModels) {
    const generacioInicial = generacio;
    const p = creaModels(opcions.webGL2).then((m) => {
      if (generacioInicial !== generacio) {
        tancaInstancies(m);
        throw new Error('Càrrega dels models cancel·lada');
      }
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
