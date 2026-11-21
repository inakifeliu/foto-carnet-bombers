/**
 * Versió i data de compilació (RF-21). `__VERSIO__` i `__DATA_COMPILACIO__` els substitueix
 * esbuild en compilar (`define`, scripts/construeix.mjs) a partir de package.json i de la data
 * del dia. Fora del build (tests, ts-node...) no existeixen i es fan servir valors de desenvolupament.
 */
export const VERSIO: string = typeof __VERSIO__ !== 'undefined' ? __VERSIO__ : '0.0.0-dev';
export const DATA_COMPILACIO: string = typeof __DATA_COMPILACIO__ !== 'undefined' ? __DATA_COMPILACIO__ : '1970-01-01';
