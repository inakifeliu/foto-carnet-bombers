import * as React from 'react';
import { estatAnalisi, type IInstantania } from '../vision/estatAnalisi';
import styles from '../styles/brand.module.css';

/** Buffer de píxels de la màscara, reutilitzat entre fotogrames (no es reserva un `ImageData` nou a cada pintada). */
interface IBufferMascara {
  img?: ImageData;
}

/** Dibuixa la superposició del mode diagnòstic (RF-18) sobre el vídeo: màscara, zona del tors i retall previst. */
function dibuixa(
  canvas: HTMLCanvasElement,
  temporal: HTMLCanvasElement,
  buffer: IBufferMascara,
  i: IInstantania | undefined
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  if (!i) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (canvas.width !== i.ample || canvas.height !== i.alt) {
    canvas.width = i.ample;
    canvas.height = i.alt;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const m = i.mascara;
  if (m) {
    // Només es redimensiona (i es buida) el canvas temporal si la mida de la màscara canvia.
    if (temporal.width !== m.w || temporal.height !== m.h) {
      temporal.width = m.w;
      temporal.height = m.h;
      buffer.img = undefined;
    }
    const tctx = temporal.getContext('2d');
    if (tctx) {
      if (!buffer.img || buffer.img.width !== m.w || buffer.img.height !== m.h) {
        // El color és constant: s'escriu un sol cop; a cada fotograma només canvia la transparència.
        buffer.img = tctx.createImageData(m.w, m.h);
        for (let k = 0; k < m.data.length; k++) {
          buffer.img.data[k * 4] = 235;
          buffer.img.data[k * 4 + 1] = 38;
          buffer.img.data[k * 4 + 2] = 60;
        }
      }
      const img = buffer.img;
      for (let k = 0; k < m.data.length; k++) {
        img.data[k * 4 + 3] = m.data[k] === 1 ? 90 : 0;
      }
      tctx.putImageData(img, 0, 0);
      ctx.drawImage(temporal, 0, 0, canvas.width, canvas.height);
    }
  }
  const rect = (r: { x: number; y: number; w: number; h: number } | undefined, color: string, gruix: number): void => {
    if (r) {
      ctx.strokeStyle = color;
      ctx.lineWidth = gruix;
      ctx.strokeRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
    }
  };
  rect(i.zonaCara, '#00b4d8', 2);
  rect(i.zonaTors, '#2a5bd7', 3);
  rect(i.zonaFons, '#1e8e3e', 2);
  if (i.retall) {
    rect(
      {
        x: i.retall.rect.x / canvas.width,
        y: i.retall.rect.y / canvas.height,
        w: i.retall.rect.w / canvas.width,
        h: i.retall.rect.h / canvas.height
      },
      '#fcb438',
      4
    );
  }
}

export const OverlayDiagnostic: React.FC = () => {
  const canvas = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const temporal = document.createElement('canvas');
    const buffer: IBufferMascara = {};
    const pinta = (i: IInstantania | undefined): void => {
      if (canvas.current) {
        dibuixa(canvas.current, temporal, buffer, i);
      }
    };
    pinta(estatAnalisi.llegeix());
    const cancela = estatAnalisi.subscriu(pinta);
    return (): void => {
      cancela();
      // RF-16: es buiden els canvas.
      temporal.width = 0;
      temporal.height = 0;
      buffer.img = undefined;
    };
  }, []);

  return <canvas ref={canvas} className={styles.overlay} aria-hidden="true" data-overlay-diagnostic="" />;
};
