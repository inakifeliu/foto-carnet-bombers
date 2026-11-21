/** Entorn mínim que cal consultar per detectar funcionalitats (injectable per als tests). */
export interface IEntornDeteccio {
  mediaDevices?: { getUserMedia?: unknown };
  webAssembly?: unknown;
  decompressionStream?: unknown;
  /** Retorna true si es pot crear un context WebGL2. */
  teWebGL2: () => boolean;
  /** Retorna true si es pot crear un context WebGL (1). Només es consulta si no hi ha WebGL2. */
  teWebGL?: () => boolean;
}

export interface IFuncionalitats {
  getUserMedia: boolean;
  webAssembly: boolean;
  /** Necessari per descomprimir els recursos incrustats (RF-17, RF-20). */
  decompressionStream: boolean;
  /** Opcional: sense WebGL2 MediaPipe va en CPU (només una nota). */
  webGL2: boolean;
  /**
   * WebGL (1 o 2). `@mediapipe/tasks-vision` 1.2.3 necessita WebGL fins i tot amb el delegat CPU: sense cap dels dos NO es
   * carreguen els models, l'anàlisi automàtica no està disponible i la captura manual continua (RF-17).
   */
  webGL: boolean;
  /** Totes les imprescindibles (getUserMedia, WebAssembly i DecompressionStream) hi són. */
  compatible: boolean;
}

function teContextGrafic(tipus: string): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ok = !!canvas.getContext(tipus);
    canvas.width = 0;
    canvas.height = 0;
    return ok;
  } catch {
    return false;
  }
}

export function entornActual(): IEntornDeteccio {
  return {
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
    webAssembly: typeof WebAssembly !== 'undefined' ? WebAssembly : undefined,
    decompressionStream: typeof DecompressionStream !== 'undefined' ? DecompressionStream : undefined,
    teWebGL2: (): boolean => teContextGrafic('webgl2'),
    teWebGL: (): boolean => teContextGrafic('webgl') || teContextGrafic('experimental-webgl')
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
  let webGL = webGL2;
  if (!webGL) {
    try {
      webGL = entorn.teWebGL?.() ?? false;
    } catch {
      webGL = false;
    }
  }
  return {
    getUserMedia,
    webAssembly,
    decompressionStream,
    webGL2,
    webGL,
    compatible: getUserMedia && webAssembly && decompressionStream
  };
}
