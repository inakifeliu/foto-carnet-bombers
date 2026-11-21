import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import { mesuresBones } from '../test/escena';
import { avalua } from '../vision/avaluacio';
import { estatAnalisi, type IInstantania } from '../vision/estatAnalisi';
import { OverlayDiagnostic } from './OverlayDiagnostic';

const act = (React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }).act;

function instantania(mascara: Uint8Array, w: number, h: number): IInstantania {
  const mesures = mesuresBones();
  return {
    ts: 1,
    ample: 640,
    alt: 360,
    mesures,
    avaluacio: avalua(mesures, CONFIG_PER_DEFECTE.llindars),
    mascara: { data: mascara, w, h },
    fpsAnalisi: 12,
    msPerFotograma: 10
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  estatAnalisi.publica(undefined);
  document.body.innerHTML = '';
});

describe('OverlayDiagnostic: reutilitza buffers entre fotogrames', () => {
  it('només reserva un ImageData per a diverses pintades amb la mateixa mida de màscara', async () => {
    const createImageData = jest.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h
    }));
    const putImageData = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData,
      putImageData,
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      strokeRect: jest.fn()
    } as unknown as RenderingContext);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => root.render(<OverlayDiagnostic />));

    const mascara = new Uint8Array(64 * 36).fill(1);
    for (let i = 0; i < 5; i++) {
      estatAnalisi.publica(instantania(mascara, 64, 36));
    }
    expect(createImageData).toHaveBeenCalledTimes(1);
    expect(putImageData).toHaveBeenCalledTimes(5);
    // Cada pintada reescriu la transparència segons la màscara de llavors.
    const img = putImageData.mock.calls[4][0] as { data: Uint8ClampedArray };
    expect(img.data[3]).toBe(90);
    const buida = new Uint8Array(64 * 36);
    estatAnalisi.publica(instantania(buida, 64, 36));
    expect((putImageData.mock.calls[5][0] as { data: Uint8ClampedArray }).data[3]).toBe(0);
    expect(createImageData).toHaveBeenCalledTimes(1);

    // Si canvia la mida de la màscara (p. ex. una captura a 640×360) se'n crea un de nou.
    estatAnalisi.publica(instantania(new Uint8Array(256 * 144), 256, 144));
    expect(createImageData).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });
});
