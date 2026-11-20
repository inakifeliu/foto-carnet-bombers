import * as React from 'react';
import { IConfig } from '../config/configuracio';
import { IFuncionalitats } from '../compat/funcionalitats';
import { netejaTot } from '../cleanup/neteja';
import { Accio, estatInicial, IEstat, reductor } from './estat';

export interface IContextApp {
  estat: IEstat;
  config: IConfig;
  funcionalitats: IFuncionalitats;
  dispatch: React.Dispatch<Accio>;
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

  const reinicia = React.useCallback((): void => {
    netejaTot();
    dispatch({ tipus: 'REINICIA' });
  }, []);

  // RF-16: en tancar la pestanya o navegar fora, s'allibera tot.
  React.useEffect(() => {
    window.addEventListener('pagehide', netejaTot);
    return (): void => {
      window.removeEventListener('pagehide', netejaTot);
      netejaTot();
    };
  }, []);

  const valor = React.useMemo<IContextApp>(
    () => ({ estat, config, funcionalitats, dispatch, reinicia }),
    [estat, config, funcionalitats, reinicia]
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
