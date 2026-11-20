import { FaceLandmarker } from '@mediapipe/tasks-vision';

// Cada import dóna la URL final del fitxer dins els recursos del paquet (ClientSideAssets).
// Cap URL externa: res es descarrega de CDN de tercers.
import modelUrl from '../../fotoCarnet/assets/models/face_landmarker.task';
import wasmLoaderUrl from '../../fotoCarnet/assets/wasm/vision_wasm_internal.js';
import wasmBinaryUrl from '../../fotoCarnet/assets/wasm/vision_wasm_internal.wasm';

// WasmFileset no s'exporta des de @mediapipe/tasks-vision; en repliquem la forma.
interface IWasmFileset {
  wasmLoaderPath: string;
  wasmBinaryPath: string;
}

export interface IFuncionalitats {
  getUserMedia: boolean;
  webAssembly: boolean;
  webGl2: boolean;
  showSaveFilePicker: boolean;
}

export function detectarFuncionalitats(): IFuncionalitats {
  let webGl2: boolean = false;
  try {
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    webGl2 = !!canvas.getContext('webgl2');
  } catch {
    webGl2 = false;
  }
  return {
    getUserMedia: !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'),
    webAssembly: typeof WebAssembly === 'object',
    webGl2,
    showSaveFilePicker: typeof window.showSaveFilePicker === 'function'
  };
}

export interface IResultatCarrega {
  landmarker: FaceLandmarker;
  delegat: 'GPU' | 'CPU';
  avisos: string[];
}

export async function carregarFaceLandmarker(): Promise<IResultatCarrega> {
  const fileset: IWasmFileset = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl };
  const avisos: string[] = [];

  const crear = (delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate },
      runningMode: 'VIDEO',
      numFaces: 1
    });

  try {
    return { landmarker: await crear('GPU'), delegat: 'GPU', avisos };
  } catch (e) {
    avisos.push('Delegat GPU no disponible, es fa servir CPU: ' + String(e));
    return { landmarker: await crear('CPU'), delegat: 'CPU', avisos };
  }
}
