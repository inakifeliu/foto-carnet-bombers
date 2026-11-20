/**
 * Genera paquets/prova-local-camera.html: pàgina ÚNICA i autònoma (s'obre amb doble clic, file://).
 *
 *  - Empaqueta eines/prova-local/principal.ts + @mediapipe/tasks-vision en un IIFE clàssic (esbuild),
 *    aplicant al bundle de MediaPipe el MATEIX transform que SPFx (config/mediapipe-sense-telemetria.js).
 *  - Incrusta en base64 el loader WASM, el .wasm i face_landmarker.task (a runtime es converteixen
 *    en URL blob: / Uint8Array; a file:// no hi ha fetch ni import de fitxers locals).
 *  - Executa la guarda de verifica-paquet.js (verifica) sobre el text JS/HTML generat i sobre el loader
 *    decodificat; si falla, el build falla i no es deixa el fitxer.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sensTelemetria = require('../config/mediapipe-sense-telemetria.js');
const { verifica, sha256 } = require('./verifica-paquet.js');

const ASSETS = path.join(arrel, 'src/webparts/fotoCarnet/assets');
const ruta = {
  loader: path.join(ASSETS, 'wasm/vision_wasm_internal.js'),
  wasm: path.join(ASSETS, 'wasm/vision_wasm_internal.wasm'),
  model: path.join(ASSETS, 'models/face_landmarker.task'),
  plantilla: path.join(arrel, 'eines/prova-local/plantilla.html'),
  sortida: path.join(arrel, 'paquets/prova-local-camera.html')
};

const pluginSenseTelemetria = {
  name: 'mediapipe-sense-telemetria',
  setup(b) {
    b.onLoad({ filter: /[\\/]@mediapipe[\\/]tasks-vision[\\/]vision_bundle\.(mjs|cjs|js)$/ }, (args) => ({
      contents: sensTelemetria(fs.readFileSync(args.path, 'utf8')),
      loader: 'js'
    }));
  }
};

const res = await build({
  entryPoints: [path.join(arrel, 'eines/prova-local/principal.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
  legalComments: 'none',
  plugins: [pluginSenseTelemetria],
  logLevel: 'warning'
});
// Evita tancar el <script> inline per accident.
const appJs = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const bufLoader = fs.readFileSync(ruta.loader);
const plantilla = fs.readFileSync(ruta.plantilla, 'utf8');

// Guarda: el text JS i HTML (sense base64) i el loader (identificat pel seu SHA-256, comentaris exclosos).
const htmlSenseDades = plantilla.replace(/@@B64_\w+@@/g, '').replace('@@APP_JS@@', '');
const problemes = verifica(
  [
    { nom: 'prova-local/app.js', dades: Buffer.from(appJs, 'utf8') },
    { nom: 'prova-local/plantilla.html', dades: Buffer.from(htmlSenseDades, 'utf8') },
    { nom: 'prova-local/vision_wasm_internal.js', dades: bufLoader }
  ],
  sha256(bufLoader)
);
if (problemes.length > 0) {
  console.error('prova-local: ERROR, la guarda ha fallat:');
  problemes.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

const b64 = (f) => fs.readFileSync(f).toString('base64');
// Reemplaços amb funció: el base64/JS no ha d'interpretar patrons "$&" de String.replace.
const html = plantilla
  .replace('@@B64_LOADER@@', () => bufLoader.toString('base64'))
  .replace('@@B64_WASM@@', () => b64(ruta.wasm))
  .replace('@@B64_MODEL@@', () => b64(ruta.model))
  .replace('@@APP_JS@@', () => appJs);

fs.mkdirSync(path.dirname(ruta.sortida), { recursive: true });
fs.writeFileSync(ruta.sortida, html);
const mb = (fs.statSync(ruta.sortida).size / 1048576).toFixed(1);
console.log(`prova-local: OK, guarda superada. ${ruta.sortida} (${mb} MB)`);
