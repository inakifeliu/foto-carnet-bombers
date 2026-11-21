/** Entorn mínim que cal consultar per detectar funcionalitats (injectable per als tests). */
export interface IEntornDeteccio {
  mediaDevices?: { getUserMedia?: unknown };
  webAssembly?: unknown;
  decompressionStream?: unknown;
  /** Retorna true si es pot crear un context WebGL2. */
  teWebGL2: () => boolean;
}

export interface IFuncionalitats {
  getUserMedia: boolean;
  webAssembly: boolean;
  /** Necessari per descomprimir els recursos incrustats (RF-17, RF-20). */
  decompressionStream: boolean;
  /** Opcional: sense WebGL2 MediaPipe va en CPU (només una nota). */
  webGL2: boolean;
  /** Totes les imprescindibles (getUserMedia, WebAssembly i DecompressionStream) hi són. */
  compatible: boolean;
}

export function entornActual(): IEntornDeteccio {
  return {
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
    webAssembly: typeof WebAssembly !== 'undefined' ? WebAssembly : undefined,
    decompressionStream: typeof DecompressionStream !== 'undefined' ? DecompressionStream : undefined,
    teWebGL2: (): boolean => {
      try {
        const canvas = document.createElement('canvas');
        const ok = !!canvas.getContext('webgl2');
        canvas.width = 0;
        canvas.height = 0;
        return ok;
      } catch {
        return false;
      }
    }
  };
}

/** Detecció de funcionalitats a l'inici (RF-17). */
export function detectaFuncionalitats(entorn: IEntornDeteccio = entornActual()): IFuncionalitats {
  const getUserMedia = !!entorn.mediaDevices && typeof entorn.mediaDevices.getUserMedia === 'function';
  const webAssembly = !!entorn.webAssembly;
  const decompressionStream = typeof entorn.decompressionStream === 'function';
  let webGL2 = false;
  try {
    webGL2 = entorn.teWebGL2();
  } catch {
    webGL2 = false;
  }
  return {
    getUserMedia,
    webAssembly,
    decompressionStream,
    webGL2,
    compatible: getUserMedia && webAssembly && decompressionStream
  };
}
