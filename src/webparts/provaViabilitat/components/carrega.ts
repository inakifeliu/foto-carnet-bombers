/**
 * Lògica pura de càrrega del model (sense recursos ni MediaPipe): classificació d'errors i
 * retrocés GPU → CPU. Separada de `mediapipe.ts` perquè es pugui provar amb Jest.
 */
export type Delegat = 'GPU' | 'CPU';

/** Origen de l'error: GPU/WebGL, recursos (404, CSP, xarxa, WASM) o desconegut. */
export type TipusError = 'gpu' | 'recursos' | 'altre';

const PATRO_RECURSOS =
  /\b(404|403|500)\b|failed to fetch|networkerror|load failed|content security policy|\bcsp\b|refused to|violat|importscripts|failed to load|could not load|loading (the )?(wasm|model|script)|instantiat|compile|wasm|\.task|\.tflite|unexpected token|status (code )?[45]\d\d|not found/i;
const PATRO_GPU = /webgl|\bgpu\b|gl context|egl|emscripten_webgl|opengl|shader|delegate/i;
const PATRO_GPU_ESTRICTE = /webgl|gl context|\bgpu\b/i;

function textError(e: unknown): string {
  if (e instanceof Error) {
    return `${e.name}: ${e.message}`;
  }
  return String(e);
}

/**
 * Classifica un error de càrrega. Els errors de recursos (fitxers, CSP, WASM) tenen
 * prioritat: provar CPU no els arreglaria i s'han de mostrar tal qual. Només si el text
 * esmenta explícitament WebGL/GPU es considera un error propi de la GPU.
 */
export function classificaError(e: unknown): TipusError {
  const text = textError(e);
  if (PATRO_RECURSOS.test(text) && !PATRO_GPU_ESTRICTE.test(text)) {
    return 'recursos';
  }
  if (PATRO_GPU.test(text)) {
    return 'gpu';
  }
  return PATRO_RECURSOS.test(text) ? 'recursos' : 'altre';
}

/** Error de càrrega amb el tipus ja classificat (per mostrar-lo com a tal). */
export class ErrorCarregaModel extends Error {
  public readonly tipus: TipusError;
  public readonly delegat: Delegat;

  public constructor(tipus: TipusError, delegat: Delegat, original: unknown) {
    const etiqueta =
      tipus === 'recursos'
        ? "No s'han pogut carregar els recursos del model (fitxer inexistent, 404, CSP o WASM)"
        : tipus === 'gpu'
          ? 'Error del delegat GPU'
          : 'Error inesperat en carregar el model';
    super(`${etiqueta} [${delegat}]: ${textError(original)}`);
    // Necessari amb el target ES5 perquè instanceof funcioni en estendre Error.
    Object.setPrototypeOf(this, ErrorCarregaModel.prototype);
    this.name = 'ErrorCarregaModel';
    this.tipus = tipus;
    this.delegat = delegat;
  }
}

export interface IResultatCarregaGeneric<T> {
  landmarker: T;
  delegat: Delegat;
  avisos: string[];
}

/**
 * Crea el model amb GPU i només si falla per un motiu propi de la GPU retrocedeix a CPU.
 * Els errors de recursos/CSP/404 i els desconeguts es propaguen (com a ErrorCarregaModel)
 * sense provar CPU. Si la creació GPU ha retornat una instància però després falla
 * `validaInstancia`, es tanca abans de retrocedir.
 */
export async function carregaAmbRetrocesGpu<T extends { close: () => void }>(
  crea: (delegat: Delegat) => Promise<T>,
  validaInstancia?: (instancia: T) => void
): Promise<IResultatCarregaGeneric<T>> {
  const avisos: string[] = [];
  let gpu: T | undefined;
  try {
    gpu = await crea('GPU');
    if (validaInstancia) {
      validaInstancia(gpu);
    }
    return { landmarker: gpu, delegat: 'GPU', avisos };
  } catch (e) {
    if (gpu) {
      try {
        gpu.close();
      } catch {
        // la instància a mig crear pot no poder-se tancar; no és crític
      }
    }
    const tipus = classificaError(e);
    if (tipus !== 'gpu') {
      throw new ErrorCarregaModel(tipus, 'GPU', e);
    }
    avisos.push('Delegat GPU no disponible, es fa servir CPU: ' + textError(e));
  }
  try {
    return { landmarker: await crea('CPU'), delegat: 'CPU', avisos };
  } catch (e) {
    throw new ErrorCarregaModel(classificaError(e), 'CPU', e);
  }
}
