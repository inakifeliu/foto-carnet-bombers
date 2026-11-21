import * as React from 'react';
import { IConfig } from '../config/configuracio';
import { IFuncionalitats } from '../compat/funcionalitats';
import { netejaTot } from '../cleanup/neteja';
import { oblidaHandleDesat } from '../captura/desar';
import { alliberaFoto, type IFoto } from '../captura/fotos';
import { Accio, estatInicial, IEstat, reductor } from './estat';

export interface IContextApp {
  estat: IEstat;
  config: IConfig;
  funcionalitats: IFuncionalitats;
  dispatch: React.Dispatch<Accio>;
  /** Fotos capturades (ja retallades) en memòria; mai a cap emmagatzematge persistent (RF-16). */
  fotos: IFoto[];
  afegeixFoto: (foto: IFoto) => void;
  /** Allibera les fotos que no siguin `idConservada` (totes si no se'n passa cap) i en revoca les URL (RF-09). */
  alliberaFotos: (idConservada?: number) => void;
  /** Allibera tots els recursos sensibles (pistes, URL blob, canvas, fotos) sense canviar de pantalla (RF-16, P7). */
  alliberaTot: () => void;
  /** "Començar de nou": allibera recursos (RF-16) i torna a P0. */
  reinicia: () => void;
}

const ContextApp = React.createContext<IContextApp | undefined>(undefined);

export interface IProveidorProps {
  config: IConfig;
  funcionalitats: IFuncionalitats;
  children?: React.ReactNode;
}

export const ProveidorApp: React.FC<IProveidorProps> = ({ config, funcionalitats, children }) => {
  const [estat, dispatch] = React.useReducer(reductor, funcionalitats.compatible, estatInicial);
  const [fotos, setFotos] = React.useState<IFoto[]>([]);
  // Còpia síncrona de les fotos per poder-les alliberar fora del cicle de render (pagehide, desmuntatge).
  const fotosRef = React.useRef<IFoto[]>([]);
  fotosRef.current = fotos;

  const afegeixFoto = React.useCallback((foto: IFoto): void => {
    setFotos((f) => [...f, foto]);
  }, []);

  const alliberaFotos = React.useCallback((idConservada?: number): void => {
    const [conservar, alliberar] = fotosRef.current.reduce<[IFoto[], IFoto[]]>(
      (acc, f) => {
        acc[f.id === idConservada ? 0 : 1].push(f);
        return acc;
      },
      [[], []]
    );
    alliberar.forEach(alliberaFoto);
    fotosRef.current = conservar;
    setFotos(conservar);
  }, []);

  const alliberaTot = React.useCallback((): void => {
    netejaTot();
    fotosRef.current.forEach(alliberaFoto);
    fotosRef.current = [];
    setFotos([]);
  }, []);

  const reinicia = React.useCallback((): void => {
    alliberaTot();
    oblidaHandleDesat();
    dispatch({ tipus: 'REINICIA' });
  }, [alliberaTot]);

  // RF-16: en tancar la pestanya o navegar fora, s'allibera tot. Si la pàgina torna des de la memòria cau
  // endavant/enrere (bfcache, `pageshow` amb `persisted`), els recursos ja s'han alliberat a `pagehide`:
  // es reinicialitza l'app a P0 amb l'estat net.
  React.useEffect(() => {
    const alPagehide = (): void => {
      netejaTot();
      fotosRef.current.forEach(alliberaFoto);
      oblidaHandleDesat();
    };
    const alPageshow = (e: PageTransitionEvent): void => {
      if (e.persisted) {
        reinicia();
      }
    };
    window.addEventListener('pagehide', alPagehide);
    window.addEventListener('pageshow', alPageshow);
    return (): void => {
      window.removeEventListener('pagehide', alPagehide);
      window.removeEventListener('pageshow', alPageshow);
      alPagehide();
    };
  }, [reinicia]);

  const valor = React.useMemo<IContextApp>(
    () => ({ estat, config, funcionalitats, dispatch, fotos, afegeixFoto, alliberaFotos, alliberaTot, reinicia }),
    [estat, config, funcionalitats, fotos, afegeixFoto, alliberaFotos, alliberaTot, reinicia]
  );
  return <ContextApp.Provider value={valor}>{children}</ContextApp.Provider>;
};

export function useApp(): IContextApp {
  const ctx = React.useContext(ContextApp);
  if (!ctx) {
    throw new Error('useApp ha de usar-se dins de ProveidorApp');
  }
  return ctx;
}
