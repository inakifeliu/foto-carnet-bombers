import * as React from 'react';
import { estatAnalisi, type IInstantania } from '../vision/estatAnalisi';
import styles from '../styles/brand.module.css';

/** Dibuixa la superposició del mode diagnòstic (RF-18) sobre el vídeo: màscara, zona del tors i retall previst. */
function dibuixa(canvas: HTMLCanvasElement, temporal: HTMLCanvasElement, i: IInstantania | undefined): void {
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
    temporal.width = m.w;
    temporal.height = m.h;
    const tctx = temporal.getContext('2d');
    if (tctx) {
      const img = tctx.createImageData(m.w, m.h);
      for (let k = 0; k < m.data.length; k++) {
        if (m.data[k] === 1) {
          img.data[k * 4] = 235;
          img.data[k * 4 + 1] = 38;
          img.data[k * 4 + 2] = 60;
          img.data[k * 4 + 3] = 90;
        }
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
    const pinta = (i: IInstantania | undefined): void => {
      if (canvas.current) {
        dibuixa(canvas.current, temporal, i);
      }
    };
    pinta(estatAnalisi.llegeix());
    const cancela = estatAnalisi.subscriu(pinta);
    return (): void => {
      cancela();
      // RF-16: es buiden els canvas.
      temporal.width = 0;
      temporal.height = 0;
    };
  }, []);

  return <canvas ref={canvas} className={styles.overlay} aria-hidden="true" data-overlay-diagnostic="" />;
};
