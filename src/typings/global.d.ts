import type { IConfig } from '../config/configuracio';

/**
 * Constants que substitueix esbuild (`define`) en compilar. En executar els tests no existeixen:
 * consulta-les sempre a través de `src/versio.ts` i `src/config/actual.ts`.
 */
declare global {
  const __VERSIO__: string;
  const __DATA_COMPILACIO__: string;
  const __CONFIG__: IConfig;
}
