/**
 * Compilació: genera UN SOL fitxer HTML autònom a dist/foto-carnet-bombers-v{versió}.html
 * (spec §7 i §10).
 *
 *  1. Valida config/config.json amb la mateixa lògica que l'aplicació (resolConfig). Qualsevol avís
 *     fa fallar la compilació: ja no hi ha panell de propietats, la configuració ha de ser correcta aquí.
 *     També valida l'URL del Forms (https, {MATRICULA}, host de Microsoft Forms exacte) i la regex de
 *     la matrícula amb l'embolcall `^(?:…)$` de l'app. El marcador provisional `XXXX` només dona un avís.
 *  2. Empaqueta src/main.tsx amb esbuild (IIFE, React de producció, CSS en mòdul), amb:
 *     - el pegat de telemetria de MediaPipe (scripts/mediapipe-sense-telemetria.mjs; falla si no s'aplica),
 *     - els logos com a URI data: base64 (bytes sense modificar),
 *     - versió, data de compilació i configuració incrustades (`define`).
 *  3. Incrusta els recursos binaris (RF-20) en base64, amb gzip si redueix prou la mida.
 *  4. Escriu l'HTML a partir de src/index.html, el seu .sha256 i passa la guarda (scripts/verifica-html.mjs).
 */
import { build } from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import aplicaPegat from './mediapipe-sense-telemetria.mjs';
import { verificaFitxer } from './verifica-html.mjs';

const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dins = (...p) => path.join(arrel, ...p);

const pkg = JSON.parse(fs.readFileSync(dins('package.json'), 'utf8'));
const VERSIO = pkg.version;
const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now();
// Data en hora LOCAL de la màquina (no UTC): una compilació a les 00:30 d'Europe/Madrid porta el dia correcte.
const dCompilacio = new Date(epoch);
const DATA_COMPILACIO = [
  dCompilacio.getFullYear(),
  String(dCompilacio.getMonth() + 1).padStart(2, '0'),
  String(dCompilacio.getDate()).padStart(2, '0')
].join('-');
const NOM_FITXER = `foto-carnet-bombers-v${VERSIO}.html`;
const DIST = dins('dist');

/** Només per demostrar que la guarda atura una compilació sense el pegat (vegeu README). */
const SENSE_PEGAT = process.env.FCB_PROVA_SENSE_PEGAT === '1';

/** Una compilació fallida atura el procés amb un missatge clar. */
function falla(missatge) {
  console.error(`construeix: ERROR: ${missatge}`);
  process.exit(1);
}

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const MISSATGES_AVIS = {
  jsonInvalid: 'el fitxer no és JSON vàlid',
  jsonNoObjecte: 'el contingut ha de ser un objecte JSON',
  regexInvalida: "l'expressió regular no és vàlida",
  pppInvalid: 'la resolució (ppp) ha de ser 300 o 600',
  maxFotosInvalid: 'maxFotos ha de ser un enter entre 1 i 10',
  valorInvalid: 'el valor té un tipus no vàlid',
  campDesconegut: 'el camp no existeix a config.default.json',
  configInvalida: "la configuració no s'ha pogut llegir"
};

const MISSATGES_FORMS = {
  sensePlantilla: "falta el marcador {MATRICULA} a l'URL",
  noHttps: "l'URL no és vàlida o no és https:",
  hostNoPermes:
    "el host no és d'un servidor de Microsoft Forms (forms.office.com, forms.microsoft.com, forms.cloud.microsoft)"
};

/** FCB_CONFIG (ruta alternativa a config/config.json): l'usen els tests i `npm run verifica`. */
function rutaConfigEfectiva() {
  return process.env.FCB_CONFIG ? path.resolve(process.env.FCB_CONFIG) : dins('config/config.json');
}

// --- 1. Configuració ---------------------------------------------------------------------------
async function validaConfig() {
  // La validació viu a TypeScript (src/config/configuracio.ts): es compila al vol i s'importa.
  const r = await build({
    stdin: {
      contents: "export * from './src/config/configuracio.ts'; export * from './src/app/formulari.ts';",
      resolveDir: arrel,
      loader: 'ts'
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent'
  });
  const modul = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  const rutaConfig = rutaConfigEfectiva();
  if (!fs.existsSync(rutaConfig)) {
    falla('no existeix config/config.json');
  }
  const { config, avisos } = modul.resolConfigDeText(fs.readFileSync(rutaConfig, 'utf8'));
  const errors = avisos.map((a) => `${a.camp ? a.camp + ': ' : ''}${MISSATGES_AVIS[a.codi] ?? a.codi}`);
  // URL del Forms: mateix diagnòstic que l'app. XXXX = avís visible, qualsevol altre problema = error.
  const forms = modul.avaluaPlantillaForms(config.forms.urlPlantilla);
  if (forms.diagnostic !== 'ok') {
    errors.push(`forms.urlPlantilla: ${MISSATGES_FORMS[forms.diagnostic] ?? forms.diagnostic}`);
  }
  if (errors.length > 0) {
    console.error('construeix: ERROR: config/config.json no és vàlid (la compilació no continua):');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  if (forms.provisional) {
    console.warn(
      "construeix: AVÍS: l'URL del Forms (forms.urlPlantilla) encara porta el marcador provisional XXXX: " +
        'no és el Forms real. Cal substituir-la abans de distribuir (Fase 5).'
    );
  }
  return config;
}

// --- 2. Esbuild --------------------------------------------------------------------------------
const MIME_LOGOS = { '.svg': 'image/svg+xml', '.png': 'image/png' };

const pluginLogos = {
  name: 'logos-data-uri',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]assets[\\/]brand[\\/][^\\/]+\.(svg|png)$/ }, (args) => {
      const mime = MIME_LOGOS[path.extname(args.path).toLowerCase()];
      const uri = `data:${mime};base64,${fs.readFileSync(args.path).toString('base64')}`;
      return { contents: `export default ${JSON.stringify(uri)};`, loader: 'js' };
    });
  }
};

const pluginSenseTelemetria = {
  name: 'mediapipe-sense-telemetria',
  setup(b) {
    b.onLoad({ filter: /[\\/]@mediapipe[\\/]tasks-vision[\\/]vision_bundle\.(mjs|cjs|js)$/ }, (args) => {
      const codi = fs.readFileSync(args.path, 'utf8');
      // aplicaPegat() llança si el patró no es troba: la compilació falla en lloc de deixar passar la telemetria.
      return { contents: SENSE_PEGAT ? codi : aplicaPegat(codi), loader: 'js' };
    });
  }
};

async function empaqueta(config) {
  if (!SENSE_PEGAT) {
    // Comprovació prèvia: el pegat s'ha de poder aplicar encara que l'aplicació encara no importi MediaPipe.
    for (const v of ['mjs', 'cjs', 'js']) {
      aplicaPegat(fs.readFileSync(dins(`node_modules/@mediapipe/tasks-vision/vision_bundle.${v}`), 'utf8'));
    }
  } else {
    console.warn(
      "construeix: AVÍS: FCB_PROVA_SENSE_PEGAT=1, el pegat de telemetria NO s'aplica (només per provar la guarda)."
    );
  }
  const res = await build({
    entryPoints: [dins('src/main.tsx')],
    outdir: dins('dist/_esbuild'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120', 'edge120'],
    minify: true,
    write: false,
    legalComments: 'none',
    jsx: 'automatic',
    loader: { '.module.css': 'local-css' },
    define: {
      'process.env.NODE_ENV': '"production"',
      __VERSIO__: JSON.stringify(VERSIO),
      __DATA_COMPILACIO__: JSON.stringify(DATA_COMPILACIO),
      __CONFIG__: JSON.stringify(config)
    },
    plugins: [pluginLogos, pluginSenseTelemetria],
    logLevel: 'warning'
  });
  const sortida = (ext) => res.outputFiles.find((f) => f.path.endsWith(ext))?.text;
  const js = sortida('.js');
  const css = sortida('.css');
  if (js === undefined || css === undefined) {
    falla('esbuild no ha generat el JS i el CSS esperats');
  }
  return { js, css };
}

// --- 3. Recursos incrustats (RF-20) ------------------------------------------------------------
const RECURSOS = [
  { nom: 'wasm-loader', fitxer: 'src/assets/wasm/vision_wasm_internal.js', mime: 'text/javascript' },
  { nom: 'wasm-binari', fitxer: 'src/assets/wasm/vision_wasm_internal.wasm', mime: 'application/wasm' },
  { nom: 'model-cara', fitxer: 'src/assets/models/face_landmarker.task', mime: 'application/octet-stream' },
  { nom: 'model-segmentacio', fitxer: 'src/assets/models/selfie_segmenter.tflite', mime: 'application/octet-stream' }
];

/** Només es comprimeix si el gzip estalvia almenys un 10%. */
const ESTALVI_MINIM = 0.1;

function preparaRecursos() {
  const manifest = {};
  const blocs = [];
  const informe = [];
  for (const r of RECURSOS) {
    const original = fs.readFileSync(dins(r.fitxer));
    const gz = zlib.gzipSync(original, { level: 9 });
    const comprimit = gz.length < original.length * (1 - ESTALVI_MINIM);
    const incrustat = comprimit ? gz : original;
    const b64 = incrustat.toString('base64');
    manifest[r.nom] = {
      mime: r.mime,
      comprimit,
      sha256: crypto.createHash('sha256').update(original).digest('hex'),
      mida: original.length
    };
    blocs.push(`    <script type="application/octet-stream" id="recurs-${r.nom}">${b64}</script>`);
    informe.push({ nom: r.nom, original: original.length, gz: gz.length, comprimit, b64: b64.length });
  }
  return { manifest, blocs: blocs.join('\n'), informe };
}

// --- 4. HTML -----------------------------------------------------------------------------------
const escapaHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Escapament segur per incrustar contingut dins un <script>: ni `</script` (en qualsevol combinació
 * de majúscules) ni `<!--` poden aparèixer tal qual. En JS es trenquen amb una barra (dins d'una
 * cadena equival al mateix caràcter); en JSON, amb un escapament unicode (la barra davant de `!`
 * no és un escapament JSON vàlid).
 */
function escapaPerScript(text) {
  return text.replace(/<\/script/gi, (m) => '<\\' + m.slice(1)).replace(/<!--/g, '<\\!--');
}

function escapaJsonPerScript(text) {
  return text.replace(/<(\/script|!--)/gi, (_m, resta) => '\\u003c' + resta);
}

async function principal() {
  const inici = Date.now();
  const config = await validaConfig();
  const { js, css } = await empaqueta(config);
  const { manifest, blocs, informe } = preparaRecursos();

  // El missatge estàtic de RF-19 surt de ca.json: així l'HTML inicial i el de l'app són sempre el mateix.
  const ca = JSON.parse(fs.readFileSync(dins('src/i18n/ca.json'), 'utf8'));
  const missatgeRf19 = ca['rf19.missatge'];
  if (typeof missatgeRf19 !== 'string' || missatgeRf19.trim() === '') {
    falla('falta la clau "rf19.missatge" a src/i18n/ca.json');
  }

  // Evita tancar un <script>/<style> inline per accident i les seqüències "<!--" dins del JS.
  const jsSegur = escapaPerScript(js);
  const cssSegur = css.replace(/<\/style/gi, '<\\/style');

  const plantilla = fs.readFileSync(dins('src/index.html'), 'utf8');
  const html = plantilla
    .replace('@@TITOL@@', () => `Foto carnet Bombers de Barcelona v${VERSIO}`)
    .replace('@@CSS@@', () => cssSegur)
    .split('@@MISSATGE_RF19@@')
    .join(escapaHtml(missatgeRf19))
    .replace('@@MANIFEST@@', () => escapaJsonPerScript(JSON.stringify(manifest)))
    .replace('@@RECURSOS@@', () => blocs)
    .replace('@@JS@@', () => jsSegur);
  if (/@@[A-Z_0-9]+@@/.test(html.replace(jsSegur, '').replace(cssSegur, ''))) {
    falla('queden marcadors @@...@@ sense substituir a la plantilla');
  }

  fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(DIST)) {
    if (/^foto-carnet-bombers-v.*\.html(\.sha256)?$/.test(f)) {
      fs.rmSync(path.join(DIST, f));
    }
  }
  fs.rmSync(path.join(DIST, '_esbuild'), { recursive: true, force: true });
  const rutaHtml = path.join(DIST, NOM_FITXER);
  fs.writeFileSync(rutaHtml, html, 'utf8');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(rutaHtml)).digest('hex');
  const rutaSha = rutaHtml + '.sha256';
  fs.writeFileSync(rutaSha, `${hash}  ${NOM_FITXER}\n`, 'utf8');

  // --- Guarda ---
  const problemes = verificaFitxer(rutaHtml);
  if (problemes.length > 0) {
    fs.rmSync(rutaHtml);
    fs.rmSync(rutaSha);
    console.error(
      `construeix: ERROR: la guarda ha fallat (${problemes.length} problema/es); s'ha esborrat el fitxer generat:`
    );
    problemes.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }

  // --- Informe ---
  const midaHtml = fs.statSync(rutaHtml).size;
  console.log(`\nconstrueix: OK, guarda superada (${((Date.now() - inici) / 1000).toFixed(1)} s)`);
  console.log(`  Versió ${VERSIO}, data de compilació ${DATA_COMPILACIO}`);
  console.log("  Recursos incrustats (original -> gzip -> base64 dins l'HTML):");
  for (const r of informe) {
    console.log(
      `    ${r.nom.padEnd(18)} ${mb(r.original).padStart(10)} -> ${mb(r.gz).padStart(10)} ` +
        `(${r.comprimit ? 'es comprimeix' : 'sense comprimir'}) -> ${mb(r.b64).padStart(10)}`
    );
  }
  console.log(`  JS de l'aplicació (minificat, amb logos i React): ${kb(Buffer.byteLength(js))}`);
  console.log(`  CSS: ${kb(Buffer.byteLength(css))}`);
  console.log(`  ${path.relative(arrel, rutaHtml)}: ${mb(midaHtml)} (${midaHtml} bytes)`);
  console.log(`  ${path.relative(arrel, rutaSha)}: ${hash}`);
}

await principal();
