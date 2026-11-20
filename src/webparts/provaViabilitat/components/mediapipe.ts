import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { carregaAmbRetrocesGpu, type Delegat } from './carrega';

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

export type { Delegat } from './carrega';

export interface IResultatCarrega {
  landmarker: FaceLandmarker;
  delegat: Delegat;
  avisos: string[];
}

export function crearLandmarker(delegate: Delegat): Promise<FaceLandmarker> {
  const fileset: IWasmFileset = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl };
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'VIDEO',
    numFaces: 1
  });
}

/** Carrega el model: GPU i, només si falla per la GPU, CPU (vegeu carregaAmbRetrocesGpu). */
export function carregarFaceLandmarker(): Promise<IResultatCarrega> {
  return carregaAmbRetrocesGpu<FaceLandmarker>(crearLandmarker);
}
