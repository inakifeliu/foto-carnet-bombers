import * as React from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

import styles from './ProvaViabilitat.module.scss';
import { carregarFaceLandmarker, crearLandmarker, detectarFuncionalitats, type Delegat, type IFuncionalitats } from './mediapipe';
import { missatgeErrorCamera, missatgeErrorDesar } from './errors';

const MAX_VIOLACIONS: number = 20;
const INTERVAL_ANALISI_MS: number = 100; // ~10 fps

// Fotograma actual sense efecte mirall (el mirall només és CSS de visualització).
// eslint-disable-next-line @rushstack/no-new-null -- toBlob() de l'API del navegador retorna null
function fotogramaAJpeg(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.resolve(null);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

export default function ProvaViabilitat(): React.ReactElement {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | undefined>(undefined);
  const landmarkerRef = React.useRef<FaceLandmarker | undefined>(undefined);
  const rafRef = React.useRef<number>(0);
  const ultimaAnalisiRef = React.useRef<number>(0);
  const bucleActiuRef = React.useRef<boolean>(false);
  const desmuntatRef = React.useRef<boolean>(false);
  // Promesa de la càrrega en curs (o acabada): evita crear un segon landmarker si es torna a
  // obrir la càmera mentre el model encara es carrega.
  const carregaRef = React.useRef<Promise<void> | undefined>(undefined);
  // Es compta cada alliberament (desmuntatge/pagehide): una càrrega d'una generació anterior es tanca.
  const generacioRef = React.useRef<number>(0);
  const delegatRef = React.useRef<Delegat | undefined>(undefined);
  // Permet que recreaAmbCpu reprengui el bucle sense dependència circular entre funcions.
  const reprenAnalisiRef = React.useRef<() => void>(() => undefined);

  const [funcionalitats] = React.useState<IFuncionalitats>(() => detectarFuncionalitats());
  const [cameraActiva, setCameraActiva] = React.useState<boolean>(false);
  const [resolucio, setResolucio] = React.useState<string>('—');
  const [errorCamera, setErrorCamera] = React.useState<string>('');
  const [estatModel, setEstatModel] = React.useState<string>('Sense carregar');
  const [delegat, setDelegat] = React.useState<string>('—');
  const [tempsCarrega, setTempsCarrega] = React.useState<string>('—');
  const [cares, setCares] = React.useState<number>(0);
  const [errorsModel, setErrorsModel] = React.useState<string[]>([]);
  const [missatgeDesar, setMissatgeDesar] = React.useState<string>('');
  const [violacions, setViolacions] = React.useState<string[]>([]);

  // Violacions de CSP: es mostren en pantalla perquè es puguin capturar.
  React.useEffect(() => {
    const alViolar = (e: SecurityPolicyViolationEvent): void => {
      const origen: string = e.sourceFile ? ` [${e.sourceFile}:${e.lineNumber}]` : '';
      const text: string = `${e.violatedDirective} → ${e.blockedURI || '(inline)'}${origen}`;
      setViolacions((anteriors) => anteriors.concat(text).slice(-MAX_VIOLACIONS));
    };
    document.addEventListener('securitypolicyviolation', alViolar);
    return () => document.removeEventListener('securitypolicyviolation', alViolar);
  }, []);

  const aturarCamera = React.useCallback((): void => {
    bucleActiuRef.current = false;
    window.cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((pista) => pista.stop());
      streamRef.current = undefined;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Allibera càmera (pistes), model i bucle d'animació. Compartit pel desmuntatge i per pagehide.
  const alliberaTot = React.useCallback((): void => {
    generacioRef.current += 1;
    aturarCamera();
    carregaRef.current = undefined;
    delegatRef.current = undefined;
    if (landmarkerRef.current) {
      landmarkerRef.current.close();
      landmarkerRef.current = undefined;
    }
  }, [aturarCamera]);

  // Neteja en desmuntar i en tancar/abandonar la pàgina (pagehide).
  React.useEffect(() => {
    desmuntatRef.current = false;
    window.addEventListener('pagehide', alliberaTot);
    return () => {
      desmuntatRef.current = true;
      window.removeEventListener('pagehide', alliberaTot);
      alliberaTot();
    };
  }, [alliberaTot]);

  const executar = (promesa: Promise<void>): void => {
    promesa.catch((e) => setErrorsModel((anteriors) => anteriors.concat(String(e))));
  };

  const recreaAmbCpu = (causa: unknown): void => {
    bucleActiuRef.current = false;
    const generacio = generacioRef.current;
    const gpu = landmarkerRef.current;
    landmarkerRef.current = undefined;
    delegatRef.current = 'CPU'; // evita reintents: només es recrea una vegada
    if (gpu) {
      gpu.close();
    }
    setErrorsModel((anteriors) =>
      anteriors.concat('detectForVideo ha fallat amb GPU, es recrea amb CPU: ' + String(causa)).slice(-5)
    );
    executar(
      crearLandmarker('CPU').then((cpu) => {
        if (desmuntatRef.current || generacio !== generacioRef.current) {
          cpu.close();
          return;
        }
        landmarkerRef.current = cpu;
        setDelegat('CPU');
        if (streamRef.current) {
          reprenAnalisiRef.current();
        }
      })
    );
  };

  const analitzarFotograma = (): void => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!canvas || !video || !landmarker || video.videoWidth === 0) {
      return;
    }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    try {
      const resultat = landmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCares(resultat.faceLandmarks.length);
      ctx.fillStyle = '#FCB438';
      resultat.faceLandmarks.forEach((cara) => {
        cara.forEach((punt) => {
          ctx.fillRect(punt.x * canvas.width - 1.5, punt.y * canvas.height - 1.5, 3, 3);
        });
      });
    } catch (e) {
      if (delegatRef.current === 'GPU') {
        // detectForVideo ha fallat amb GPU: es recrea una sola vegada amb CPU.
        recreaAmbCpu(e);
        return;
      }
      setErrorsModel((anteriors) => anteriors.concat('detectForVideo: ' + String(e)).slice(-5));
      bucleActiuRef.current = false;
    }
  };

  const bucle = (ara: number): void => {
    if (!bucleActiuRef.current) {
      return;
    }
    if (ara - ultimaAnalisiRef.current >= INTERVAL_ANALISI_MS) {
      ultimaAnalisiRef.current = ara;
      analitzarFotograma();
    }
    rafRef.current = window.requestAnimationFrame(bucle);
  };

  const iniciarAnalisi = (): void => {
    window.cancelAnimationFrame(rafRef.current);
    bucleActiuRef.current = true;
    rafRef.current = window.requestAnimationFrame(bucle);
  };

  reprenAnalisiRef.current = iniciarAnalisi;

  const carregarModel = (): Promise<void> => {
    if (landmarkerRef.current) {
      iniciarAnalisi();
      return Promise.resolve();
    }
    if (!carregaRef.current) {
      setEstatModel('Carregant…');
      const inici: number = performance.now();
      const generacio = generacioRef.current;
      carregaRef.current = carregarFaceLandmarker().then(
        ({ landmarker, delegat: delegatUsat, avisos }) => {
          if (desmuntatRef.current || generacio !== generacioRef.current || landmarkerRef.current) {
            // Orfe: component desmuntat, pàgina abandonada o ja n'hi ha un altre.
            landmarker.close();
            return;
          }
          landmarkerRef.current = landmarker;
          delegatRef.current = delegatUsat;
          setDelegat(delegatUsat);
          setTempsCarrega(`${Math.round(performance.now() - inici)} ms`);
          setEstatModel('Carregat');
          if (avisos.length > 0) {
            setErrorsModel((anteriors) => anteriors.concat(avisos));
          }
        },
        (e: unknown) => {
          // Permet reintentar en tornar a obrir la càmera.
          if (generacio === generacioRef.current) {
            carregaRef.current = undefined;
          }
          setEstatModel('Error');
          setErrorsModel((anteriors) => anteriors.concat(String(e)));
        }
      );
    }
    return carregaRef.current.then(() => {
      if (landmarkerRef.current && streamRef.current) {
        iniciarAnalisi();
      }
    });
  };

  const obrirCamera = async (): Promise<void> => {
    setErrorCamera('');
    if (!funcionalitats.getUserMedia) {
      setErrorCamera('Aquest navegador no permet accedir a la càmera.');
      return;
    }
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' }
      });
      if (desmuntatRef.current) {
        stream.getTracks().forEach((pista) => pista.stop());
        return;
      }
      aturarCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setResolucio(`${video.videoWidth} × ${video.videoHeight} px`);
      }
      setCameraActiva(true);
      await carregarModel();
    } catch (e) {
      setErrorCamera(missatgeErrorCamera(e));
    }
  };

  const tancarCamera = (): void => {
    aturarCamera();
    setCameraActiva(false);
    setResolucio('—');
    setCares(0);
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const desarJpeg = async (): Promise<void> => {
    setMissatgeDesar('');
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setMissatgeDesar('Cal obrir la càmera abans de desar la imatge.');
      return;
    }
    if (!window.showSaveFilePicker) {
      setMissatgeDesar('Aquest navegador no permet desar fitxers directament (cal Microsoft Edge o Chrome).');
      return;
    }
    const blob = await fotogramaAJpeg(video);
    if (!blob) {
      setMissatgeDesar("No s'ha pogut codificar la imatge JPEG.");
      return;
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'prova.jpg',
        startIn: 'pictures',
        types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }]
      });
      const escriptable = await handle.createWritable();
      await escriptable.write(blob);
      await escriptable.close();
      setMissatgeDesar(`Imatge desada (${Math.round(blob.size / 1024)} KB).`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return; // l'usuari ha cancel·lat el diàleg
      }
      setMissatgeDesar(missatgeErrorDesar(e));
    }
  };

  const si = (valor: boolean): React.ReactElement => (
    <span className={valor ? styles.ok : styles.ko}>{valor ? 'Sí' : 'No'}</span>
  );

  return (
    <section className={styles.prova}>
      <h2 className={styles.titol}>Prova de viabilitat: càmera, MediaPipe i desat</h2>

      <div className={styles.botons}>
        <button type="button" className={styles.boto} onClick={() => executar(obrirCamera())} disabled={cameraActiva}>
          Obrir la càmera
        </button>
        <button type="button" className={styles.boto} onClick={tancarCamera} disabled={!cameraActiva}>
          Tancar la càmera
        </button>
        <button type="button" className={styles.boto} onClick={() => executar(desarJpeg())} disabled={!cameraActiva}>
          Desar JPEG de prova
        </button>
      </div>

      {errorCamera !== '' && (
        <p className={`${styles.missatge} ${styles.error}`} role="alert">{errorCamera}</p>
      )}
      {missatgeDesar !== '' && (
        <p className={styles.missatge} role="status">{missatgeDesar}</p>
      )}

      <div className={styles.escena} hidden={!cameraActiva}>
        <video ref={videoRef} className={styles.video} playsInline muted />
        <canvas ref={canvasRef} className={styles.superposicio} />
      </div>

      <div className={styles.diagnostic} aria-live="polite">
        <h3>Diagnòstic</h3>
        <ul>
          <li>getUserMedia: {si(funcionalitats.getUserMedia)}</li>
          <li>WebAssembly: {si(funcionalitats.webAssembly)}</li>
          <li>WebGL2: {si(funcionalitats.webGl2)}</li>
          <li>showSaveFilePicker: {si(funcionalitats.showSaveFilePicker)}</li>
          <li>Resolució real de la càmera: {resolucio}</li>
          <li>Model MediaPipe: {estatModel}</li>
          <li>Delegat de MediaPipe: {delegat}</li>
          <li>Temps de càrrega del model: {tempsCarrega}</li>
          <li>Cares detectades: {cares}</li>
        </ul>

        <h3>Errors capturats</h3>
        {errorsModel.length === 0 ? (
          <p>Cap.</p>
        ) : (
          <ul>{errorsModel.map((text, i) => <li key={i} className={styles.ko}>{text}</li>)}</ul>
        )}

        <h3>Violacions de CSP</h3>
        {violacions.length === 0 ? (
          <p>Cap violació detectada.</p>
        ) : (
          <ul>{violacions.map((text, i) => <li key={i} className={styles.ko}>{text}</li>)}</ul>
        )}
      </div>
    </section>
  );
}
