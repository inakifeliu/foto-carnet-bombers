import * as React from 'react';
import { registre } from '../cleanup/neteja';
import { t } from '../i18n';
import {
  aturaFlux,
  classificaErrorCamera,
  llistaCameres,
  resolucioInsuficient,
  restriccionsCamera,
  type ICamera,
  type TipusErrorCamera
} from './camera';

export interface IEstatCamera {
  /** El flux actiu (undefined mentre no hi ha càmera). */
  flux: MediaStream | undefined;
  carregant: boolean;
  error: TipusErrorCamera | undefined;
  cameres: ICamera[];
  deviceIdActual: string | undefined;
  /** Resolució real quan és inferior a 1280×720 (avís no bloquejant). */
  resolucioBaixa: { ample: number; alt: number } | undefined;
  canviaCamera: (deviceId: string) => void;
  reintenta: () => void;
}

/**
 * Obre la càmera en muntar-se (RF-01) i l'atura en desmuntar-se. Després del permís enumera les càmeres;
 * en canviar de càmera s'aturen les pistes anteriors. El flux es registra a la neteja (RF-16).
 */
export function useCamera(): IEstatCamera {
  const [flux, setFlux] = React.useState<MediaStream | undefined>(undefined);
  const [carregant, setCarregant] = React.useState<boolean>(true);
  const [error, setError] = React.useState<TipusErrorCamera | undefined>(undefined);
  const [cameres, setCameres] = React.useState<ICamera[]>([]);
  const [deviceIdActual, setDeviceIdActual] = React.useState<string | undefined>(undefined);
  const [resolucioBaixa, setResolucioBaixa] = React.useState<IEstatCamera['resolucioBaixa']>(undefined);
  // Cada petició té un número: si en arriba una de més nova, la resposta antiga s'atura i s'ignora.
  const peticio = React.useRef(0);
  const fluxActual = React.useRef<MediaStream | undefined>(undefined);
  const [intents, setIntents] = React.useState(0);
  const [demanat, setDemanat] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const id = ++peticio.current;
    let cancelat = false;
    setCarregant(true);
    setError(undefined);

    const obre = async (): Promise<void> => {
      // Atura el flux anterior abans d'obrir-ne un de nou (canvi de càmera).
      aturaFlux(fluxActual.current);
      fluxActual.current = undefined;
      setFlux(undefined);
      let nou: MediaStream;
      try {
        nou = await navigator.mediaDevices.getUserMedia(restriccionsCamera(demanat));
      } catch (e) {
        if (!cancelat && id === peticio.current) {
          setError(classificaErrorCamera(e));
          setCarregant(false);
        }
        return;
      }
      if (cancelat || id !== peticio.current) {
        aturaFlux(nou);
        return;
      }
      fluxActual.current = nou;
      registre.registraFlux(nou);
      const pista = nou.getVideoTracks()[0];
      const config = pista?.getSettings?.() ?? {};
      setDeviceIdActual(config.deviceId ?? demanat);
      const ample = config.width ?? 0;
      const alt = config.height ?? 0;
      setResolucioBaixa(ample > 0 && alt > 0 && resolucioInsuficient(ample, alt) ? { ample, alt } : undefined);
      // Si el sistema o una altra aplicació talla la càmera (desconnexió, Teams…), es mostra l'error i es pot tornar a provar.
      pista?.addEventListener?.('ended', () => {
        if (fluxActual.current === nou) {
          aturaFlux(nou);
          fluxActual.current = undefined;
          setFlux(undefined);
          setError('ocupada');
        }
      });
      setFlux(nou);
      setCarregant(false);
      try {
        // Les etiquetes només hi són un cop concedit el permís.
        const llista = await llistaCameres(navigator.mediaDevices, (n) => t('p3.cameraNom', { n }));
        if (!cancelat && id === peticio.current) {
          setCameres(llista);
        }
      } catch {
        // Sense llista no hi ha selector: no és un error de la captura.
      }
    };
    void obre();

    return (): void => {
      cancelat = true;
    };
  }, [intents, demanat]);

  // En desmuntar (sortir de P3), s'atura la càmera.
  React.useEffect(
    () => (): void => {
      peticio.current++;
      aturaFlux(fluxActual.current);
      fluxActual.current = undefined;
    },
    []
  );

  const canviaCamera = React.useCallback((deviceId: string): void => setDemanat(deviceId), []);
  const reintenta = React.useCallback((): void => setIntents((n) => n + 1), []);

  return { flux, carregant, error, cameres, deviceIdActual, resolucioBaixa, canviaCamera, reintenta };
}
