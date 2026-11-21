import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { obteRecurs, obteUrlBlob, revocaUrlsBlob } from '../recursos';

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
    landmarker = await crea('GPU');
  } catch {
    delegat = 'CPU';
    landmarker = await crea('CPU');
  }
  landmarker.close();
  // RF-16: les URL blob ja no calen un cop carregat el model.
  revocaUrlsBlob();
  return { delegat, ms: Math.round(performance.now() - inici) };
}
