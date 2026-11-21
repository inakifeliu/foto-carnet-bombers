import { CONFIG_PER_DEFECTE, type IConfig } from './configuracio';

/**
 * Configuració efectiva de l'aplicació: la de `config/config.json`, validada i incrustada en
 * compilar (`__CONFIG__`, vegeu scripts/construeix.mjs). Fora del build, la per defecte.
 */
export const CONFIG: IConfig = typeof __CONFIG__ !== 'undefined' ? __CONFIG__ : CONFIG_PER_DEFECTE;
