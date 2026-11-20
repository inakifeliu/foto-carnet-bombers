/**
 * Prova local de càmera + MediaPipe (pàgina HTML autònoma, s'obre amb doble clic: file://).
 * DOM "vanilla", sense React. Es compila amb esbuild (scripts/construeix-prova-local.mjs).
 * Els recursos (loader WASM, .wasm i model) arriben en base64 dins la pròpia pàgina.
 */
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { carregaAmbRetrocesGpu, type Delegat } from '../../src/webparts/provaViabilitat/components/carrega';
import { missatgeErrorCamera, missatgeErrorDesar } from '../../src/webparts/provaViabilitat/components/errors';

/* eslint-disable @typescript-eslint/no-explicit-any */

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ---------- Estat ----------
let flux: MediaStream | undefined;
let landmarker: FaceLandmarker | undefined;
let delegat: Delegat | undefined;
let tempsCarregaMs: number | undefined;
let promesaCarrega: Promise<void> | undefined;
let modeActual: 'VIDEO' | 'IMAGE' = 'VIDEO';
let rafId = 0;
let ultimAnalisi = 0;
let ultimTempsVideo = -1;
let rotllo: { t: number; ms: number }[] = [];
let carasUltim = 0;
let metodeDesat = 'cap';
let imatgeProvada: HTMLCanvasElement | undefined;
const errors: string[] = [];
const avisosCarrega: string[] = [];
let resolucioReal = '';
let fpsCamera = '';
let resultatImatge = '';
let urlsBlob: string[] = [];

const INTERVAL_MS = 80; // ~12 fps d'anàlisi
const FINESTRA_MS = 5000;

function registraError(m: string): void {
  errors.push(m);
  mostra('avis-cam', m, 'error', false, true);
  actualitzaInforme();
}

function mostra(id: string, text: string, classe: 'error' | 'avis' | 'info' | '', _x = false, afegeix = false): void {
  const el = $<HTMLElement>(id);
  const d = document.createElement('div');
  d.className = classe;
  d.textContent = text;
  if (!afegeix) {
    el.textContent = '';
  }
  if (text) {
    el.appendChild(d);
  }
}

function fila(taula: HTMLElement, nom: string, valor: string, ok?: boolean): void {
  const tr = document.createElement('tr');
  const a = document.createElement('td');
  const b = document.createElement('td');
  a.textContent = nom;
  b.textContent = valor;
  if (ok !== undefined) {
    b.className = ok ? 'ok' : 'ko';
  }
  tr.appendChild(a);
  tr.appendChild(b);
  taula.appendChild(tr);
}

// ---------- Diagnòstic ----------
interface IDiag {
  navegador: string;
  segur: boolean;
  protocol: string;
  getUserMedia: boolean;
  webAssembly: boolean;
  webGl2: boolean;
  saveFilePicker: boolean;
  nuclis: string;
}

function diagnostic(): IDiag {
  let webGl2 = false;
  try {
    webGl2 = !!document.createElement('canvas').getContext('webgl2');
  } catch {
    webGl2 = false;
  }
  return {
    navegador: navigator.userAgent,
    segur: window.isSecureContext,
    protocol: location.protocol,
    getUserMedia: !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'),
    webAssembly: typeof WebAssembly === 'object',
    webGl2,
    saveFilePicker: typeof (window as any).showSaveFilePicker === 'function',
    nuclis: navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'desconegut'
  };
}

const diag = diagnostic();

function pintaDiagnostic(): void {
  const t = $('diagnostic');
  const si = (b: boolean): string => (b ? 'Sí' : 'No');
  fila(t, 'Navegador (user agent)', diag.navegador);
  fila(t, 'Context segur (isSecureContext)', si(diag.segur), diag.segur);
  fila(t, 'Protocol', diag.protocol);
  fila(t, 'getUserMedia (càmera)', si(diag.getUserMedia), diag.getUserMedia);
  fila(t, 'WebAssembly', si(diag.webAssembly), diag.webAssembly);
  fila(t, 'WebGL2', si(diag.webGl2), diag.webGl2);
  fila(t, 'showSaveFilePicker (desar a Imatges)', si(diag.saveFilePicker), diag.saveFilePicker);
  fila(t, 'Nuclis de CPU (hardwareConcurrency)', diag.nuclis);
}

// ---------- Recursos incrustats ----------
function decodifica(id: string): Uint8Array {
  const b64 = ($(id).textContent || '').trim();
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function urlBlob(bytes: Uint8Array, tipus: string): string {
  const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipus }));
  urlsBlob.push(u);
  return u;
}

// ---------- MediaPipe ----------
function carregaModel(): Promise<void> {
  if (landmarker) {
    return Promise.resolve();
  }
  if (promesaCarrega) {
    return promesaCarrega;
  }
  $<HTMLButtonElement>('carrega').disabled = true;
  mostra('avis-mp', 'Carregant el model…', 'info');
  promesaCarrega = (async () => {
    const inici = performance.now();
    try {
      // Deixa que el navegador pinti el missatge abans de la feina pesada (decodificar ~25 MB).
      await new Promise((r) => setTimeout(r, 30));
      const fileset = {
        wasmLoaderPath: urlBlob(decodifica('b64-loader'), 'text/javascript'),
        wasmBinaryPath: urlBlob(decodifica('b64-wasm'), 'application/wasm')
      };
      const model = decodifica('b64-model');
      const r = await carregaAmbRetrocesGpu<FaceLandmarker>((d) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: model, delegate: d },
          runningMode: 'VIDEO',
          numFaces: 1
        })
      );
      landmarker = r.landmarker;
      delegat = r.delegat;
      modeActual = 'VIDEO';
      avisosCarrega.push(...r.avisos);
      tempsCarregaMs = Math.round(performance.now() - inici);
      mostra('avis-mp', '', '');
      r.avisos.forEach((a) => mostra('avis-mp', a, 'avis', false, true));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push('MediaPipe: ' + m);
      mostra('avis-mp', 'Error en carregar el model: ' + m, 'error');
      promesaCarrega = undefined;
      $<HTMLButtonElement>('carrega').disabled = false;
    }
    pintaMediaPipe();
    actualitzaInforme();
  })();
  return promesaCarrega;
}

function estadistiques(): { fps: number; mitjana: number; p95: number } {
  const ara = performance.now();
  rotllo = rotllo.filter((x) => ara - x.t <= FINESTRA_MS);
  if (rotllo.length === 0) {
    return { fps: 0, mitjana: 0, p95: 0 };
  }
  const ms = rotllo.map((x) => x.ms).sort((a, b) => a - b);
  const mitjana = ms.reduce((a, b) => a + b, 0) / ms.length;
  const p95 = ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.95) - 1)];
  const span = Math.max(1, ara - rotllo[0].t);
  return { fps: rotllo.length > 1 ? ((rotllo.length - 1) / span) * 1000 : 0, mitjana, p95 };
}

function pintaMediaPipe(): void {
  const t = $('info-mp');
  t.textContent = '';
  if (!landmarker) {
    return;
  }
  const s = estadistiques();
  fila(t, 'Delegat', String(delegat), delegat === 'GPU');
  fila(t, 'Temps de càrrega del model', tempsCarregaMs + ' ms');
  fila(t, 'Cares detectades (darrer fotograma)', String(carasUltim));
  fila(t, 'Temps de detecció (mitjana, últims 5 s)', s.mitjana.toFixed(1) + ' ms');
  fila(t, 'Temps de detecció (p95, últims 5 s)', s.p95.toFixed(1) + ' ms');
  fila(t, "FPS d'anàlisi efectius", s.fps.toFixed(1));
}

function dibuixaLandmarks(
  ctx: CanvasRenderingContext2D,
  punts: { x: number; y: number }[],
  w: number,
  h: number
): void {
  const grups: { start: number; end: number }[][] = [
    FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    FaceLandmarker.FACE_LANDMARKS_LIPS,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW
  ];
  ctx.fillStyle = '#00e676';
  const r = Math.max(1.5, w / 600);
  for (const p of punts) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, w / 900);
  for (const g of grups) {
    ctx.beginPath();
    for (const c of g) {
      const a = punts[c.start];
      const b = punts[c.end];
      if (a && b) {
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
      }
    }
    ctx.stroke();
  }
}

function bucle(): void {
  rafId = requestAnimationFrame(bucle);
  const video = $<HTMLVideoElement>('video');
  const ara = performance.now();
  if (!landmarker || !flux || video.readyState < 2 || ara - ultimAnalisi < INTERVAL_MS) {
    return;
  }
  if (video.currentTime === ultimTempsVideo) {
    return;
  }
  ultimTempsVideo = video.currentTime;
  ultimAnalisi = ara;
  try {
    if (modeActual !== 'VIDEO') {
      landmarker.setOptions({ runningMode: 'VIDEO' });
      modeActual = 'VIDEO';
    }
    const t0 = performance.now();
    const res = landmarker.detectForVideo(video, t0);
    const ms = performance.now() - t0;
    rotllo.push({ t: ara, ms });
    carasUltim = res.faceLandmarks.length;
    const canvas = $<HTMLCanvasElement>('superposicio');
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      res.faceLandmarks.forEach((f) => dibuixaLandmarks(ctx, f, canvas.width, canvas.height));
    }
    pintaMediaPipe();
  } catch (e) {
    const m = 'Error de detecció: ' + (e instanceof Error ? e.message : String(e));
    if (!errors.includes(m)) {
      errors.push(m);
      mostra('avis-mp', m, 'error', false, true);
    }
  }
}

// ---------- Càmera ----------
async function llistaDispositius(): Promise<void> {
  const sel = $<HTMLSelectElement>('dispositiu');
  const actual = flux?.getVideoTracks()[0]?.getSettings().deviceId;
  try {
    const dev = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    sel.textContent = '';
    dev.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || 'Càmera ' + (i + 1);
      if (d.deviceId === actual) {
        o.selected = true;
      }
      sel.appendChild(o);
    });
    sel.disabled = dev.length === 0;
  } catch (e) {
    registraError('No es poden llistar les càmeres: ' + String(e));
  }
}

function aturaFlux(): void {
  if (flux) {
    flux.getTracks().forEach((t) => t.stop());
    flux = undefined;
  }
  $<HTMLVideoElement>('video').srcObject = null;
}

async function obreCamera(): Promise<void> {
  mostra('avis-cam', '', '');
  tancaCamera(false);
  if (!diag.getUserMedia) {
    registraError('Aquest navegador no ofereix getUserMedia (potser no és un context segur).');
    return;
  }
  const idSel = $<HTMLSelectElement>('dispositiu');
  const video: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: 'user'
  };
  if (!idSel.disabled && idSel.value) {
    video.deviceId = { exact: idSel.value };
  }
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (e) {
    registraError(missatgeErrorCamera(e));
    return;
  }
  const v = $<HTMLVideoElement>('video');
  v.srcObject = flux;
  try {
    await v.play();
  } catch {
    // autoplay + muted: no hauria de fallar; si falla, el bucle esperarà que hi hagi dades
  }
  $('escena-video').hidden = false;
  $<HTMLButtonElement>('obre').disabled = true;
  $<HTMLButtonElement>('tanca').disabled = false;
  const s = flux.getVideoTracks()[0].getSettings();
  const w = s.width || v.videoWidth;
  const h = s.height || v.videoHeight;
  resolucioReal = w + '×' + h;
  fpsCamera = s.frameRate ? s.frameRate.toFixed(1) : 'desconegut';
  const t = $('info-cam');
  t.textContent = '';
  fila(t, 'Càmera', flux.getVideoTracks()[0].label || 'sense nom');
  fila(t, 'Resolució real', resolucioReal, w >= 1280 && h >= 720);
  fila(t, 'Fotogrames per segon (càmera)', fpsCamera);
  if (w < 1280 || h < 720) {
    mostra(
      'avis-cam',
      'Resolució inferior a 1280×720: la prova continua, però la qualitat de la foto podria ser insuficient.',
      'avis'
    );
  }
  await llistaDispositius();
  ultimTempsVideo = -1;
  rotllo = [];
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(bucle);
  actualitzaInforme();
  void carregaModel();
}

function tancaCamera(tambeLandmarker: boolean): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
  aturaFlux();
  $('escena-video').hidden = true;
  $<HTMLButtonElement>('obre').disabled = false;
  $<HTMLButtonElement>('tanca').disabled = true;
  const c = $<HTMLCanvasElement>('superposicio');
  c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  if (tambeLandmarker) {
    if (landmarker) {
      try {
        landmarker.close();
      } catch {
        // no és crític
      }
      landmarker = undefined;
      promesaCarrega = undefined;
      $<HTMLButtonElement>('carrega').disabled = false;
      $('info-mp').textContent = '';
    }
    urlsBlob.forEach((u) => URL.revokeObjectURL(u));
    urlsBlob = [];
  }
}

// ---------- Prova amb imatge ----------
async function provaImatge(fitxer: File): Promise<void> {
  mostra('avis-img', 'Analitzant…', 'info');
  try {
    await carregaModel();
    if (!landmarker) {
      throw new Error('el model no està carregat');
    }
    const bmp = await createImageBitmap(fitxer);
    const canvas = $<HTMLCanvasElement>('canvas-img');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(bmp, 0, 0);
    imatgeProvada = document.createElement('canvas');
    imatgeProvada.width = bmp.width;
    imatgeProvada.height = bmp.height;
    imatgeProvada.getContext('2d')?.drawImage(bmp, 0, 0);
    bmp.close();
    landmarker.setOptions({ runningMode: 'IMAGE' });
    modeActual = 'IMAGE';
    const t0 = performance.now();
    const res = landmarker.detect(canvas);
    const ms = performance.now() - t0;
    res.faceLandmarks.forEach((f) => dibuixaLandmarks(ctx, f, canvas.width, canvas.height));
    $('escena-img').hidden = false;
    resultatImatge = `${canvas.width}x${canvas.height}, cares: ${res.faceLandmarks.length}, ${ms.toFixed(1)} ms`;
    mostra(
      'avis-img',
      `Cares detectades: ${res.faceLandmarks.length}. Temps de detecció: ${ms.toFixed(1)} ms.`,
      'info'
    );
  } catch (e) {
    const m = 'Prova amb imatge: ' + (e instanceof Error ? e.message : String(e));
    errors.push(m);
    mostra('avis-img', m, 'error');
  }
  actualitzaInforme();
}

// ---------- Desar JPEG ----------
function fotogramaActual(): HTMLCanvasElement | undefined {
  const v = $<HTMLVideoElement>('video');
  const c = document.createElement('canvas');
  if (flux && v.videoWidth > 0) {
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0); // sense mirall
    return c;
  }
  return imatgeProvada;
}

function aBlobJpeg(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob ha retornat buit'))), 'image/jpeg', 0.92)
  );
}

async function desaJpeg(): Promise<void> {
  mostra('avis-desa', '', '');
  const font = fotogramaActual();
  if (!font) {
    mostra('avis-desa', 'No hi ha cap imatge: obre la càmera o tria una imatge primer.', 'avis');
    return;
  }
  let handle: any;
  let motiuFallback = '';
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      // El selector s'obre PRIMER, dins del clic, per conservar l'activació d'usuari.
      handle = await (window as any).showSaveFilePicker({
        suggestedName: 'prova.jpg',
        startIn: 'pictures',
        types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }]
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        mostra('avis-desa', 'Desat cancel·lat.', 'info');
        return;
      }
      motiuFallback = 'showSaveFilePicker ha fallat (' + String(e) + ')';
    }
  } else {
    motiuFallback = 'showSaveFilePicker no disponible';
  }
  try {
    const blob = await aBlobJpeg(font);
    if (handle) {
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      metodeDesat =
        'showSaveFilePicker (' + (handle.name || 'prova.jpg') + ', ' + Math.round(blob.size / 1024) + ' KB)';
      mostra('avis-desa', 'Desat amb el selector de fitxers: ' + (handle.name || 'prova.jpg') + '.', 'info');
    } else {
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = 'prova.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
      metodeDesat = 'descàrrega <a download> (' + motiuFallback + ')';
      mostra('avis-desa', 'Descarregat com a prova.jpg: mira la carpeta Baixades (' + motiuFallback + ').', 'avis');
    }
  } catch (e) {
    const m = missatgeErrorDesar(e);
    errors.push(m);
    mostra('avis-desa', m, 'error');
  }
  actualitzaInforme();
}

// ---------- Informe ----------
function construeixInforme(): string {
  const s = estadistiques();
  const l: string[] = [];
  l.push('INFORME PROVA LOCAL DE CAMERA - Foto carnet Bombers');
  l.push('Data: ' + new Date().toISOString());
  l.push('Navegador: ' + diag.navegador);
  l.push('isSecureContext: ' + diag.segur);
  l.push('Protocol: ' + diag.protocol);
  l.push('getUserMedia: ' + diag.getUserMedia);
  l.push('WebAssembly: ' + diag.webAssembly);
  l.push('WebGL2: ' + diag.webGl2);
  l.push('showSaveFilePicker: ' + diag.saveFilePicker);
  l.push('Nuclis CPU: ' + diag.nuclis);
  l.push('Camera: ' + (flux ? flux.getVideoTracks()[0].label : 'tancada'));
  l.push('Resolucio real: ' + (resolucioReal || 'n/d'));
  l.push('FPS camera: ' + (fpsCamera || 'n/d'));
  l.push('MediaPipe delegat: ' + (delegat || 'no carregat'));
  l.push('Temps de carrega del model: ' + (tempsCarregaMs !== undefined ? tempsCarregaMs + ' ms' : 'n/d'));
  l.push('Cares detectades (ultim): ' + carasUltim);
  l.push(
    'Deteccio mitjana: ' +
      s.mitjana.toFixed(1) +
      ' ms; p95: ' +
      s.p95.toFixed(1) +
      ' ms; fps analisi: ' +
      s.fps.toFixed(1)
  );
  l.push('Prova amb imatge: ' + (resultatImatge || 'no feta'));
  l.push('Metode de desat: ' + metodeDesat);
  avisosCarrega.forEach((a) => l.push('Avis: ' + a));
  l.push('Errors: ' + (errors.length ? '' : 'cap'));
  errors.forEach((e) => l.push(' - ' + e));
  return l.join('\n');
}

function actualitzaInforme(): void {
  $<HTMLTextAreaElement>('informe').value = construeixInforme();
}

async function copiaInforme(): Promise<void> {
  actualitzaInforme();
  const ta = $<HTMLTextAreaElement>('informe');
  try {
    await navigator.clipboard.writeText(ta.value);
    mostra('avis-copia', 'Informe copiat al porta-retalls.', 'info');
    return;
  } catch {
    // file:// pot bloquejar l'API del porta-retalls: provem el mètode antic
  }
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  mostra(
    'avis-copia',
    ok
      ? 'Informe copiat al porta-retalls.'
      : "No s'ha pogut copiar automàticament: selecciona el text del quadre i copia'l amb Ctrl+C.",
    ok ? 'info' : 'avis'
  );
}

// ---------- Inici ----------
pintaDiagnostic();
actualitzaInforme();
$('obre').addEventListener('click', () => void obreCamera());
$('tanca').addEventListener('click', () => {
  tancaCamera(true);
  actualitzaInforme();
});
$('carrega').addEventListener('click', () => void carregaModel());
$('dispositiu').addEventListener('change', () => {
  if (flux) {
    void obreCamera();
  }
});
$<HTMLInputElement>('fitxer').addEventListener('change', (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (f) {
    void provaImatge(f);
  }
});
$('desa').addEventListener('click', () => void desaJpeg());
$('copia').addEventListener('click', () => void copiaInforme());
window.addEventListener('pagehide', () => tancaCamera(true));
