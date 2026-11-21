/**
 * Guarda de build: inspecciona l'HTML final i FALLA (exit 1) si hi detecta telemetria, peticions
 * a hosts externs o recursos externs (spec §5: cap telemetria ni petició de xarxa en execució).
 *
 * Ús: node scripts/verifica-html.mjs [ruta.html]   (per defecte, dist/foto-carnet-bombers-v{versió}.html)
 *
 * Què es comprova, sobre el TEXT de l'HTML final (amb els payloads base64 exclosos):
 *  1. Cadenes prohibides: "googleapis", "odml.", "google-analytics". Excepció documentada:
 *     "type.googleapis.com/" és l'identificador de tipus de protobuf (typeUrl) que MediaPipe fa
 *     servir internament; no és cap petició.
 *  2. Tota URL http(s):// ha de ser d'un host de ALLOWLIST_HOSTS (o del host del Forms configurat).
 *  3. Cap <script src=...> ni <link href=...> (tot ha d'anar incrustat).
 *  4. Les imatges `data:` SVG (logos) es descodifiquen i s'inspeccionen com a text.
 *
 * I, a més, sobre els recursos incrustats (RF-20):
 *  5. Cada recurs es descodifica (base64 + gzip si cal) i el seu SHA-256 ha de coincidir amb el manifest.
 *  6. El loader Emscripten del WASM (identificat per SHA-256 idèntic a src/assets/wasm/vision_wasm_internal.js)
 *     conté URLs de documentació només en comentaris (github, MDN, ietf...). S'hi apliquen els punts
 *     1 i 2 DESPRÉS d'eliminar-ne els comentaris. (Fa servir fetch/XMLHttpRequest, però només per
 *     carregar el .wasm des de la URL blob: que li passem; no té cap URL pròpia al codi.)
 *  Els binaris (.wasm/.task/.tflite) NO s'inspeccionen com a text: contenen cadenes internes de
 *  C++/protobuf (p. ex. "odml.infra.proto...") i no poden fer xarxa pel seu compte; només ho
 *  poden fer a través del loader JS (punt 6).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PROHIBIDES = ['googleapis', 'odml.', 'google-analytics'];

/** Prefix que s'elimina abans de buscar "googleapis" (typeUrl de protobuf, no és una URL de xarxa). */
export const EXCEPCIONS_PROHIBIDES = ['type.googleapis.com/'];

/**
 * Hosts permesos en URL http(s):// dins del text de l'HTML. Cada entrada és un identificador,
 * un missatge o un enllaç de documentació que MAI es sol·licita en execució:
 *  - www.w3.org: espais de noms XML/SVG/XLink/MathML (atributs `xmlns`, `xlink:href` de React DOM i
 *    dels SVG dels logos). Són identificadors, no URL que es descarreguin.
 *  - reactjs.org: React 18 (build de producció) inclou al text dels errors minificats
 *    "https://reactjs.org/docs/error-decoder.html?invariant=…"; només es mostra dins d'un missatge
 *    d'error i no se sol·licita mai.
 *  Qualsevol altre host (CDN, API, analítica...) fa fallar el build. A aquesta llista s'hi afegeix
 *  automàticament el host del Forms de `config/config.json` (RF-12): és el destí que l'usuari obre
 *  ell mateix amb un clic (RF-13), mai una petició de l'aplicació.
 */
export const ALLOWLIST_HOSTS = ['www.w3.org', 'reactjs.org'];

export const ID_MANIFEST = 'recursos-manifest';
const PREFIX_ID = 'recurs-';

const RUTA_LOADER_WASM = path.join(arrel, 'src/assets/wasm/vision_wasm_internal.js');

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hostDe(url) {
  const m = /^https?:\/\/([^/:?#\s"'\\)>\]]+)/i.exec(url);
  return m ? m[1].toLowerCase() : '';
}

function hostPermes(host, hostsExtra) {
  return [...ALLOWLIST_HOSTS, ...hostsExtra].some((h) => host === h || host.endsWith('.' + h));
}

/** Elimina comentaris `/* *\/` i `// ...` d'un JS no minificat (suficient per al loader d'Emscripten). */
export function senseComentaris(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Cadenes prohibides i hosts no permesos en un text. Retorna els problemes (buit = correcte). */
export function analitzaText(nom, text, hostsExtra = []) {
  const problemes = [];
  let net = text;
  for (const excepcio of EXCEPCIONS_PROHIBIDES) {
    net = net.split(excepcio).join('');
  }
  const minuscules = net.toLowerCase();
  for (const prohibida of PROHIBIDES) {
    if (minuscules.includes(prohibida)) {
      problemes.push(`${nom}: conté la cadena prohibida "${prohibida}"`);
    }
  }
  const hosts = new Set();
  for (const m of net.matchAll(/https?:\/\/[^\s"'`<>\\)]+/gi)) {
    const host = hostDe(m[0]);
    if (host === '' || !hostPermes(host, hostsExtra)) {
      hosts.add(host || m[0]);
    }
  }
  hosts.forEach((h) => problemes.push(`${nom}: URL a un host no permès "${h}"`));
  return problemes;
}

/** Extreu i descodifica els recursos incrustats; retorna també l'HTML amb els payloads buidats. */
export function extreuRecursos(html) {
  const mm = new RegExp(`<script type="application/json" id="${ID_MANIFEST}">([\\s\\S]*?)</script>`).exec(html);
  if (!mm) {
    throw new Error(`No s'ha trobat el manifest de recursos (#${ID_MANIFEST}).`);
  }
  const manifest = JSON.parse(mm[1]);
  const recursos = {};
  let sensePayloads = html;
  for (const nom of Object.keys(manifest)) {
    const re = new RegExp(`(<script type="application/octet-stream" id="${PREFIX_ID}${nom}">)([\\s\\S]*?)(</script>)`);
    const m = re.exec(html);
    if (!m) {
      throw new Error(`Falta el payload del recurs "${nom}".`);
    }
    const cru = Buffer.from(m[2].trim(), 'base64');
    recursos[nom] = manifest[nom].comprimit ? zlib.gunzipSync(cru) : cru;
    sensePayloads = sensePayloads.replace(re, (_t, a, _b, c) => a + c);
  }
  return { manifest, recursos, sensePayloads };
}

/** Analitza l'HTML final i retorna la llista de problemes (buida = correcte). */
export function verifica(html, { hostsExtra = [], hashLoaderWasm } = {}) {
  const problemes = [];
  const { manifest, recursos, sensePayloads } = extreuRecursos(html);

  // 5/6. Recursos: integritat i, si són el loader, comprovació del text.
  for (const [nom, bytes] of Object.entries(recursos)) {
    const m = manifest[nom];
    if (sha256(bytes) !== m.sha256 || bytes.length !== m.mida) {
      problemes.push(`recurs ${nom}: el contingut descodificat no coincideix amb el manifest (SHA-256/mida)`);
    }
    if (m.mime.startsWith('text/')) {
      let text = bytes.toString('utf8');
      if (hashLoaderWasm !== undefined && sha256(bytes) === hashLoaderWasm) {
        text = senseComentaris(text);
      }
      problemes.push(...analitzaText(`recurs ${nom}`, text, hostsExtra));
    }
  }

  // 4. Imatges data: SVG (es descodifiquen) i, després, tots els payloads data: base64 es buiden.
  let text = sensePayloads;
  text = text.replace(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g, (_t, b64) => {
    problemes.push(...analitzaText('logo SVG (data:)', Buffer.from(b64, 'base64').toString('utf8'), hostsExtra));
    return 'data:image/svg+xml;base64,';
  });
  text = text.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/g, 'data:;base64,');

  // 3. Cap recurs extern.
  if (/<script\b[^>]*\ssrc\s*=/i.test(text)) {
    problemes.push("HTML: conté <script src=...> (tot ha d'anar incrustat)");
  }
  if (/<link\b[^>]*\shref\s*=/i.test(text)) {
    problemes.push("HTML: conté <link href=...> (tot ha d'anar incrustat)");
  }
  if (/@import\b/i.test(text)) {
    problemes.push('HTML: conté @import de CSS');
  }

  // 1/2. Text restant (JS, CSS, HTML, manifest).
  problemes.push(...analitzaText('HTML', text, hostsExtra));
  return problemes;
}

/** Host del Forms de la configuració del repositori (si és llegible). */
function hostFormsDeConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(arrel, 'config/config.json'), 'utf8'));
    return [hostDe(String(cfg.forms.urlPlantilla))].filter(Boolean);
  } catch {
    return [];
  }
}

export function verificaFitxer(ruta) {
  const html = fs.readFileSync(ruta, 'utf8');
  const hashLoaderWasm = fs.existsSync(RUTA_LOADER_WASM) ? sha256(fs.readFileSync(RUTA_LOADER_WASM)) : undefined;
  return verifica(html, { hostsExtra: hostFormsDeConfig(), hashLoaderWasm });
}

function rutaPerDefecte() {
  const pkg = JSON.parse(fs.readFileSync(path.join(arrel, 'package.json'), 'utf8'));
  return path.join(arrel, 'dist', `foto-carnet-bombers-v${pkg.version}.html`);
}

function principal() {
  const ruta = path.resolve(process.argv[2] ?? rutaPerDefecte());
  if (!fs.existsSync(ruta)) {
    console.error(`verifica-html: no existeix ${ruta} (executa "npm run build" primer)`);
    process.exit(1);
  }
  const problemes = verificaFitxer(ruta);
  if (problemes.length > 0) {
    console.error(`verifica-html: ERROR, ${problemes.length} problema(es) a ${ruta}:`);
    problemes.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log(`verifica-html: OK (cap telemetria ni host extern; recursos íntegres) a ${ruta}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
