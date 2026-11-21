import { clauCarpeta, codificaJpeg, desaFitxer, obteHandleDesat, oblidaHandleDesat, recordaHandleDesat } from './desar';
import type { IEntornDesat, IHandleFitxer } from './desar';
import { llegeixDensitatJfif } from './jfif';

// jsdom no implementa Blob.arrayBuffer (Edge sí): es simula amb FileReader només per als tests.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = (): void => resolve(lector.result as ArrayBuffer);
      lector.onerror = (): void => reject(lector.error);
      lector.readAsArrayBuffer(this);
    });
  };
}

const err = (name: string): Error => Object.assign(new Error(name), { name });
const blob = (): Promise<Blob> => Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));

function handleSimulat(): { handle: IHandleFitxer; write: jest.Mock; close: jest.Mock; abort: jest.Mock } {
  const write = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn().mockResolvedValue(undefined);
  const abort = jest.fn().mockResolvedValue(undefined);
  return { handle: { createWritable: jest.fn().mockResolvedValue({ write, close, abort }) }, write, close, abort };
}

describe('desaFitxer', () => {
  it('èxit amb showSaveFilePicker: obre el diàleg amb les opcions de RF-11, escriu i retorna el handle (Imatges)', async () => {
    const { handle, write, close } = handleSimulat();
    const showSaveFilePicker = jest.fn().mockResolvedValue(handle);
    const baixa = jest.fn();
    const r = await desaFitxer('12345', blob, { showSaveFilePicker, baixa });
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: '12345.jpg',
      startIn: 'pictures',
      types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }]
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(baixa).not.toHaveBeenCalled();
    expect(r).toEqual({ tipus: 'ok', desti: 'imatges', handle });
  });

  it('el diàleg s’obre abans de codificar (dins el clic, sense cap await previ)', async () => {
    const ordre: string[] = [];
    const { handle } = handleSimulat();
    const showSaveFilePicker = jest.fn().mockImplementation(() => {
      ordre.push('diàleg');
      return Promise.resolve(handle);
    });
    const genera = (): Promise<Blob> => {
      ordre.push('codifica');
      return blob();
    };
    const promesa = desaFitxer('12345', genera, { showSaveFilePicker, baixa: jest.fn() });
    // Just després de la crida síncrona, el diàleg ja s'ha obert i encara no s'ha codificat.
    expect(ordre).toEqual(['diàleg']);
    await promesa;
    expect(ordre).toEqual(['diàleg', 'codifica']);
  });

  it('AbortError: cancel·lat, sense error, sense codificar ni baixar', async () => {
    const showSaveFilePicker = jest.fn().mockRejectedValue(err('AbortError'));
    const baixa = jest.fn();
    const genera = jest.fn(blob);
    const r = await desaFitxer('12345', genera, { showSaveFilePicker, baixa });
    expect(r).toEqual({ tipus: 'cancelat' });
    expect(genera).not.toHaveBeenCalled();
    expect(baixa).not.toHaveBeenCalled();
  });

  it('SecurityError: alternativa amb baixada (Baixades)', async () => {
    const showSaveFilePicker = jest.fn().mockRejectedValue(err('SecurityError'));
    const baixa = jest.fn();
    const r = await desaFitxer('12345', blob, { showSaveFilePicker, baixa });
    expect(r).toEqual({ tipus: 'ok', desti: 'baixades' });
    expect(baixa).toHaveBeenCalledTimes(1);
    expect(baixa.mock.calls[0][1]).toBe('12345.jpg');
    expect(baixa.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('sense showSaveFilePicker: baixada (Baixades)', async () => {
    const baixa = jest.fn();
    const r = await desaFitxer('77777', blob, { baixa });
    expect(r).toEqual({ tipus: 'ok', desti: 'baixades' });
    expect(baixa).toHaveBeenCalledWith(expect.any(Blob), '77777.jpg');
  });

  it('un altre error del diàleg: error (no s’intenta la baixada)', async () => {
    const e = err('NotAllowedError');
    const baixa = jest.fn();
    const r = await desaFitxer('12345', blob, { showSaveFilePicker: jest.fn().mockRejectedValue(e), baixa });
    expect(r).toEqual({ tipus: 'error', error: e });
    expect(baixa).not.toHaveBeenCalled();
  });

  it('error en codificar: error', async () => {
    const { handle } = handleSimulat();
    const e = new Error('toBlob');
    const r = await desaFitxer('1', () => Promise.reject(e), {
      showSaveFilePicker: jest.fn().mockResolvedValue(handle),
      baixa: jest.fn()
    });
    expect(r).toEqual({ tipus: 'error', error: e });
  });

  it('error en escriure: error i s’avorta l’escriptor', async () => {
    const { handle, write, abort } = handleSimulat();
    const e = err('NotAllowedError');
    write.mockRejectedValue(e);
    const r = await desaFitxer('1', blob, {
      showSaveFilePicker: jest.fn().mockResolvedValue(handle),
      baixa: jest.fn()
    });
    expect(r).toEqual({ tipus: 'error', error: e });
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('error en la baixada alternativa: error', async () => {
    const e = new Error('baixa');
    const entorn: IEntornDesat = {
      baixa: () => {
        throw e;
      }
    };
    expect(await desaFitxer('1', blob, entorn)).toEqual({ tipus: 'error', error: e });
  });
});

describe('handle desat (en memòria)', () => {
  it('es pot recordar i oblidar', () => {
    const { handle } = handleSimulat();
    recordaHandleDesat(handle);
    expect(obteHandleDesat()).toBe(handle);
    oblidaHandleDesat();
    expect(obteHandleDesat()).toBeUndefined();
  });
});

describe('clauCarpeta', () => {
  it('Imatges o Baixades segons on s’hagi desat', () => {
    expect(clauCarpeta('imatges')).toBe('carpeta.imatges');
    expect(clauCarpeta('baixades')).toBe('carpeta.baixades');
  });
});

describe('codificaJpeg', () => {
  it('codifica amb toBlob(image/jpeg, qualitat) i hi escriu la densitat JFIF', async () => {
    const jpegMinim = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x55, 0xff, 0xd9]);
    const toBlob = jest.fn((cb: (b: Blob | null) => void) => cb(new Blob([jpegMinim], { type: 'image/jpeg' })));
    const canvas = { toBlob } as unknown as HTMLCanvasElement;
    const r = await codificaJpeg(canvas, 0.92, 300);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
    expect(r.type).toBe('image/jpeg');
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect(llegeixDensitatJfif(bytes)).toEqual({ unitats: 1, x: 300, y: 300 });
  });

  it('falla si toBlob retorna null', async () => {
    const canvas = { toBlob: (cb: (b: Blob | null) => void) => cb(null) } as unknown as HTMLCanvasElement;
    await expect(codificaJpeg(canvas, 0.92, 300)).rejects.toThrow();
  });
});
