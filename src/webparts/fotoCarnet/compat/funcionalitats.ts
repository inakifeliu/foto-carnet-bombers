/** Entorn mínim que cal consultar per detectar funcionalitats (injectable per als tests). */
export interface IEntornDeteccio {
  mediaDevices?: { getUserMedia?: unknown };
  webAssembly?: unknown;
  /** Retorna true si es pot crear un context WebGL2. */
  teWebGL2: () => boolean;
}

export interface IFuncionalitats {
  getUserMedia: boolean;
  webAssembly: boolean;
  /** Opcional: sense WebGL2 MediaPipe va en CPU (només una nota). */
  webGL2: boolean;
  /** Totes les imprescindibles (getUserMedia i WebAssembly) hi són. */
  compatible: boolean;
}

export function entornActual(): IEntornDeteccio {
  return {
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
    webAssembly: typeof WebAssembly !== 'undefined' ? WebAssembly : undefined,
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
  let webGL2 = false;
  try {
    webGL2 = entorn.teWebGL2();
  } catch {
    webGL2 = false;
  }
  return { getUserMedia, webAssembly, webGL2, compatible: getUserMedia && webAssembly };
}
