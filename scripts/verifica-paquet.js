'use strict';

/**
 * Guarda de build: inspecciona el .sppkg generat i FALLA (exit 1) si hi detecta telemetria
 * o peticions a hosts externs (spec §5: cap telemetria ni recurs extern).
 *
 * Ús: node scripts/verifica-paquet.js [ruta.sppkg]   (per defecte, sharepoint/solution/foto-carnet-bombers.sppkg)
 *
 * Es llegeix el zip amb zlib (sense dependències). Comprovacions:
 *  1. A cada fitxer de TEXT (js, css, json, xml, html, svg, txt, rels, map): cadenes prohibides
 *     "googleapis", "odml.", "google-analytics". Excepció documentada: "type.googleapis.com/"
 *     és l'identificador de tipus de protobuf (typeUrl) que MediaPipe fa servir internament;
 *     no és cap petició. Els binaris (.wasm/.task/.tflite/imatges) NO s'inspeccionen amb això:
 *     contenen cadenes internes de C++/protobuf (p. ex. "odml.infra.proto...") i no poden fer
 *     xarxa pel seu compte; només ho poden fer a través del loader JS (punt 3).
 *  2. A cada fitxer de text, tota URL http(s):// ha de ser d'un host de ALLOWLIST_HOSTS.
 *  3. El loader Emscripten del WASM (identificat per SHA-256 idèntic a
 *     src/webparts/fotoCarnet/assets/wasm/vision_wasm_internal.js) conté URLs de documentació només
 *     en comentaris (github, MDN, ietf...). S'hi aplica el punt 2 DESPRÉS d'eliminar-ne els
 *     comentaris. (Fa servir fetch/XMLHttpRequest, però només per carregar el .wasm des de
 *     la URL same-origin que li passem; no té cap URL pròpia al codi.)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROHIBIDES = ['googleapis', 'odml.', 'google-analytics'];

/** Prefix que s'elimina abans de buscar "googleapis" (typeUrl de protobuf, no és una URL de xarxa). */
const EXCEPCIONS_PROHIBIDES = ['type.googleapis.com/'];

/**
 * Hosts permesos en URL http(s):// dins de fitxers de text. Només identificadors d'espai de noms,
 * esquemes i documentació en comentaris/missatges d'error de llibreries (mai es sol·liciten):
 *  - www.w3.org / schemas.* / purl.org / schemas.openxmlformats.org: espais de noms XML/SVG/OPC,
 *    schema.org inclòs (esquemes de manifest i rels).
 *  - reactjs.org / react.dev / fb.me: missatges d'error de React (només text).
 *  - developer.microsoft.com / aka.ms: enllaços als $schema i de documentació de SPFx/Fluent.
 *  - localhost / 127.0.0.1: valors per defecte de només desenvolupament.
 * Qualsevol altre host (CDN, API, analítica...) fa fallar el build.
 */
const ALLOWLIST_HOSTS = [
  'www.w3.org',
  'schemas.microsoft.com',
  'schemas.openxmlformats.org',
  'purl.org',
  'schema.org',
  'reactjs.org',
  'react.dev',
  'fb.me',
  'developer.microsoft.com',
  'aka.ms',
  // Plantilla per defecte de l'URL del Microsoft Forms (config.default.json; l'administrador la canvia).
  'forms.office.com',
  // Marcador de posició que SPFx escriu als XML de l'element (WebPart_*.xml); no és un host real.
  'spclientsideassetlibrary',
  'localhost',
  '127.0.0.1'
];

const RUTA_LOADER_WASM = path.resolve(__dirname, '../src/webparts/fotoCarnet/assets/wasm/vision_wasm_internal.js');

const EXTENSIONS_TEXT = new Set([
  '.js',
  '.css',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.svg',
  '.txt',
  '.rels',
  '.map',
  '.config'
]);

/** Llegeix les entrades d'un zip (central directory) i retorna [{nom, dades: Buffer}]. */
function llegeixZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("No és un zip vàlid (no s'ha trobat el registre EOCD).");
  }
  const total = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const entrades = [];
  for (let n = 0; n < total; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) {
      throw new Error('Directori central del zip corrupte.');
    }
    const metode = buffer.readUInt16LE(p + 10);
    const midaComprimida = buffer.readUInt32LE(p + 20);
    const longNom = buffer.readUInt16LE(p + 28);
    const longExtra = buffer.readUInt16LE(p + 30);
    const longComentari = buffer.readUInt16LE(p + 32);
    const offsetLocal = buffer.readUInt32LE(p + 42);
    const nom = buffer.toString('utf8', p + 46, p + 46 + longNom);
    p += 46 + longNom + longExtra + longComentari;
    if (nom.endsWith('/')) {
      continue;
    }
    const inici = offsetLocal + 30 + buffer.readUInt16LE(offsetLocal + 26) + buffer.readUInt16LE(offsetLocal + 28);
    const crues = buffer.subarray(inici, inici + midaComprimida);
    const dades = metode === 0 ? crues : metode === 8 ? zlib.inflateRawSync(crues) : null;
    if (dades === null) {
      throw new Error(`Mètode de compressió ${metode} no suportat a ${nom}.`);
    }
    entrades.push({ nom, dades });
  }
  return entrades;
}

function hostDe(url) {
  const m = /^https?:\/\/([^/:?#\s"'\\)>\]]+)/i.exec(url);
  return m ? m[1].toLowerCase() : '';
}

function hostPermes(host) {
  return ALLOWLIST_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Analitza les entrades i retorna la llista de problemes (buida = correcte). */
function verifica(entrades, hashLoaderWasm) {
  const problemes = [];
  for (const { nom, dades } of entrades) {
    if (!EXTENSIONS_TEXT.has(path.extname(nom).toLowerCase())) {
      continue;
    }
    let text = dades.toString('utf8');
    for (const excepcio of EXCEPCIONS_PROHIBIDES) {
      text = text.split(excepcio).join('');
    }
    const minuscules = text.toLowerCase();
    for (const prohibida of PROHIBIDES) {
      if (minuscules.includes(prohibida)) {
        problemes.push(`${nom}: conté la cadena prohibida "${prohibida}"`);
      }
    }
    if (hashLoaderWasm !== undefined && sha256(dades) === hashLoaderWasm) {
      text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    }
    const hosts = new Set();
    for (const m of text.matchAll(/https?:\/\/[^\s"'`<>\\)]+/gi)) {
      const host = hostDe(m[0]);
      if (host === '' || !hostPermes(host)) {
        hosts.add(host || m[0]);
      }
    }
    hosts.forEach((h) => problemes.push(`${nom}: URL a un host no permès "${h}"`));
  }
  return problemes;
}

function principal() {
  const ruta = path.resolve(process.argv[2] || 'sharepoint/solution/foto-carnet-bombers.sppkg');
  if (!fs.existsSync(ruta)) {
    console.error(`verifica-paquet: no existeix ${ruta}`);
    process.exit(1);
  }
  const entrades = llegeixZip(fs.readFileSync(ruta));
  const hashLoader = fs.existsSync(RUTA_LOADER_WASM) ? sha256(fs.readFileSync(RUTA_LOADER_WASM)) : undefined;
  const problemes = verifica(entrades, hashLoader);
  if (problemes.length > 0) {
    console.error(`verifica-paquet: ERROR, ${problemes.length} problema(es) a ${ruta}:`);
    problemes.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log(`verifica-paquet: OK (${entrades.length} fitxers, cap telemetria ni host extern) a ${ruta}`);
}

if (require.main === module) {
  principal();
}

module.exports = { llegeixZip, verifica, sha256, ALLOWLIST_HOSTS };
