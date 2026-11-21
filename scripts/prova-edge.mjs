/**
 * Prova manual reproduïble de la Fase 1: obre el HTML compilat a Microsoft Edge (headless, càmera simulada) i
 * recorre P0 → P7 pilotant-lo pel protocol de depuració (CDP). Comprova també la CSP i que no hi ha cap petició
 * externa. NO forma part de `npm test` (necessita Edge i un build previ).
 *
 * Ús:   npm run build && npm run prova-edge [-- [fitxer.html] [--jpeg sortida.jpg] [--visible]]
 *
 *   fitxer.html     HTML a provar (per defecte, el més recent de dist/).
 *   --jpeg ruta     desa el JPEG que l'app genera (per inspeccionar-lo a mà).
 *   --visible       obre Edge amb finestra en lloc de headless.
 * Variable d'entorn EDGE_PATH: ruta a msedge.exe si no és a cap de les ubicacions habituals.
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ARREL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function trobaEdge() {
  const candidats = [
    process.env.EDGE_PATH,
    process.env['ProgramFiles(x86)'] &&
      path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/microsoft-edge',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);
  const trobat = candidats.find((c) => fs.existsSync(c));
  if (!trobat) {
    console.error('No he trobat Microsoft Edge. Defineix la variable d’entorn EDGE_PATH amb la ruta de msedge.exe.');
    process.exit(2);
  }
  return trobat;
}

function triaHtml(arg) {
  if (arg) {
    return path.resolve(arg);
  }
  const dist = path.join(ARREL, 'dist');
  const fitxers = fs.existsSync(dist)
    ? fs
        .readdirSync(dist)
        .filter((f) => /^foto-carnet-bombers-v.+\.html$/.test(f))
        .map((f) => path.join(dist, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];
  if (!fitxers.length) {
    console.error('No hi ha cap HTML a dist/. Executa primer: npm run build');
    process.exit(2);
  }
  return fitxers[0];
}

/** Port lliure demanat al sistema operatiu (s'escolta al 0 i es llegeix el que ha donat). */
function portLliure() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const dorm = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const visible = args.includes('--visible');
const iJpeg = args.indexOf('--jpeg');
const rutaJpeg = iJpeg >= 0 ? path.resolve(args[iJpeg + 1] ?? 'prova.jpg') : undefined;
const posicionals = args.filter((a, i) => !a.startsWith('--') && i !== iJpeg + 1);
const html = triaHtml(posicionals[0]);
const edgeExe = trobaEdge();
const port = await portLliure();
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'fcb-edge-'));
console.log(`HTML: ${html}\nEdge: ${edgeExe}\nPort CDP: ${port} (perfil temporal ${perfil})`);

const edge = spawn(
  edgeExe,
  [
    visible ? '--new-window' : '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream=device-count=2',
    'about:blank'
  ],
  { stdio: 'ignore' }
);
const edgeTancat = new Promise((r) => edge.once('exit', r));

const resultats = [];
const ok = (nom, cond, detall = '') => {
  resultats.push({ nom, ok: !!cond });
  console.log((cond ? 'OK     ' : 'FALLA  ') + nom + (detall ? ' -> ' + detall : ''));
};

let ws;
try {
  let objectius = [];
  for (let i = 0; i < 50 && !objectius.length; i++) {
    try {
      objectius = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((o) => o.type === 'page');
    } catch {
      // Edge encara arrenca.
    }
    if (!objectius.length) await dorm(200);
  }
  if (!objectius.length) throw new Error('Edge no ha obert cap pàgina');
  ws = new WebSocket(objectius[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pendents = new Map();
  const peticions = [];
  const consola = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendents.has(d.id)) {
      pendents.get(d.id)(d);
      pendents.delete(d.id);
    } else if (d.method === 'Network.requestWillBeSent') {
      peticions.push(d.params.request.url);
    } else if (d.method === 'Runtime.consoleAPICalled') {
      consola.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (d.method === 'Runtime.exceptionThrown') {
      consola.push('EXCEPCIO: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
    } else if (d.method === 'Log.entryAdded') {
      consola.push('log ' + d.params.entry.level + ': ' + d.params.entry.text);
    }
  };
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pendents.set(i, (d) =>
        d.error ? reject(new Error(method + ': ' + JSON.stringify(d.error))) : resolve(d.result)
      );
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    }
    return r.result.value;
  };

  await cdp('Network.enable');
  await cdp('Runtime.enable');
  await cdp('Log.enable');
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' | ' + e.blockedURI + ' | ' + e.sourceFile));`
  });
  await cdp('Page.navigate', { url: pathToFileURL(html).href });
  await dorm(2500);

  const h1 = () => ev(`document.querySelector('h1')?.textContent ?? ''`);
  const text = () => ev(`document.body.textContent`);
  const clic = (txt) =>
    ev(
      `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)}); if (!b) return 'NO_BOTO'; if (b.disabled) return 'DESACTIVAT'; b.click(); return 'ok'; })()`
    );
  const escriu = (valor) =>
    ev(
      `(() => { const i = document.querySelector('#fc-matricula'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, ${JSON.stringify(valor)}); i.dispatchEvent(new Event('input', {bubbles:true})); return i.value; })()`
    );
  /** Espera fins que el vídeo tingui fotograma; si la càmera falla en arrencar, prem «Tornar a provar». */
  const esperaVideo = async () => {
    for (let i = 0; i < 40; i++) {
      const estat = await ev(
        `({ w: document.querySelector('video')?.videoWidth ?? 0, error: !!document.querySelector('[role="alert"] button') })`
      );
      if (estat.w > 100) return true;
      if (estat.error) {
        console.log(
          '   (reintent de càmera: ' + (await ev(`document.querySelector('[role="alert"]')?.textContent`)) + ')'
        );
        await clic('Tornar a provar');
      }
      await dorm(500);
    }
    return false;
  };
  const arribaACaptura = async (matricula) => {
    await clic('Començar');
    await dorm(300);
    await clic('Entesos, continuar');
    await dorm(300);
    await escriu(matricula);
    await clic('Continuar');
    await dorm(1500);
    await esperaVideo();
  };

  ok('P0 carregada', (await h1()) === 'Foto de carnet amb uniforme', await h1());
  await clic('Començar');
  await dorm(300);
  ok('P1', (await h1()) === 'Abans de començar', await h1());
  await clic('Entesos, continuar');
  await dorm(300);
  ok('P2', (await h1()) === 'La teva matrícula', await h1());

  for (const [valor, descripcio] of [
    ['12a45', 'amb lletres'],
    ['12 345', 'amb espai'],
    ['123', 'massa curta']
  ]) {
    await escriu(valor);
    await clic('Continuar');
    await dorm(250);
    ok(`P2: matrícula ${descripcio} rebutjada`, (await h1()) === 'La teva matrícula');
  }
  await escriu('12345');
  ok(
    'P2: confirmació amb la matrícula visible',
    (await ev(`document.querySelector('main').textContent`)).includes('12345')
  );
  await clic('Continuar');
  await dorm(2000);
  ok('P3 (matrícula vàlida acceptada)', (await h1()) === 'Fes-te la foto', await h1());
  ok('P3: el vídeo té fotograma', await esperaVideo());
  ok(
    'P3: «Fer la foto ara» activat amb fotograma',
    (await ev(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Fer la foto ara')?.disabled`)) ===
      false
  );

  const info = await ev(
    `(() => { const v = document.querySelector('video'); return { w: v.videoWidth, h: v.videoHeight, pistes: v.srcObject ? v.srcObject.getVideoTracks().map(t => t.readyState) : null, transform: getComputedStyle(v).transform, opcions: document.querySelectorAll('#fc-camera option').length, aria: document.querySelector('[role="status"][aria-live]')?.hasAttribute('aria-label') }; })()`
  );
  ok(
    'P3: vídeo actiu amb pista «live»',
    info.w > 0 && info.h > 0 && info.pistes?.[0] === 'live',
    `${info.w}x${info.h}`
  );
  ok('P3: mirall només per CSS (matrix(-1,...))', info.transform.startsWith('matrix(-1'), info.transform);
  ok('P3: selector amb 2 càmeres', info.opcions === 2, String(info.opcions));
  ok('P3: la regió d’estat no té aria-label', info.aria === false);

  // Canvi de càmera: s'ha d'aturar la pista anterior.
  const abans = await ev(`document.querySelector('#fc-camera').value`);
  const nou = await ev(
    `[...document.querySelectorAll('#fc-camera option')].map(o => o.value).find(v => v !== ${JSON.stringify(abans)})`
  );
  await ev(
    `(() => { window.__pistaAnt = document.querySelector('video').srcObject.getVideoTracks()[0]; const s = document.querySelector('#fc-camera'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s, ${JSON.stringify(nou)}); s.dispatchEvent(new Event('change', {bubbles:true})); })()`
  );
  await dorm(500);
  await esperaVideo();
  const canvi = await ev(
    `({ antiga: window.__pistaAnt.readyState, nova: document.querySelector('video').srcObject?.getVideoTracks()[0]?.getSettings().deviceId })`
  );
  ok(
    'P3: el canvi de càmera atura la pista anterior i n’obre una altra',
    canvi.antiga === 'ended' && canvi.nova === nou,
    JSON.stringify(canvi)
  );

  // Captura manual ×2
  ok('clic «Fer la foto ara»', (await clic('Fer la foto ara')) === 'ok');
  await dorm(1200);
  const rev = await ev(
    `({ miniatures: document.querySelectorAll('main ul img').length, botons: [...document.querySelectorAll('button')].map(b => b.textContent), focus: document.activeElement?.textContent })`
  );
  ok(
    'P3: miniatura i botons de revisió',
    rev.miniatures === 1 && rev.botons.includes('Fer-ne una altra') && rev.botons.includes('Ja en tinc prou'),
    JSON.stringify(rev.botons)
  );
  ok('P3: el focus va a «Fer-ne una altra»', rev.focus === 'Fer-ne una altra', rev.focus);
  await clic('Fer-ne una altra');
  await dorm(300);
  await esperaVideo();
  await clic('Fer la foto ara');
  await dorm(1200);
  ok('P3: 2 miniatures', (await ev(`document.querySelectorAll('main ul img').length`)) === 2);
  await clic('Ja en tinc prou');
  await dorm(500);
  ok('P4', (await h1()) === 'Tria la millor foto', await h1());
  const mides = await ev(
    `[...document.querySelectorAll('main ul img')].map(i => i.naturalWidth + 'x' + i.naturalHeight)`
  );
  ok('P4: 2 fotos retallades a 413x531', mides.length === 2 && mides.every((m) => m === '413x531'), mides.join(','));
  await clic('Triar aquesta');
  await dorm(500);
  ok('P5', (await h1()) === 'Desa la foto', await h1());
  ok('P5: nom 12345.jpg', (await ev(`document.querySelector('main').textContent`)).includes('12345.jpg'));
  ok('P5: la càmera ja està aturada', (await ev(`document.querySelectorAll('video').length`)) === 0);

  // Simulacre de showSaveFilePicker que captura els bytes pel mateix camí de codi que el real.
  await ev(`(() => {
    window.__desat = null; window.__opcions = null;
    window.showSaveFilePicker = async (opts) => {
      window.__opcions = JSON.stringify(opts);
      const trossos = [];
      return { name: '12345.jpg', createWritable: async () => ({ write: async (b) => { trossos.push(b); }, close: async () => { window.__desat = new Blob(trossos, {type:'image/jpeg'}); } }) };
    };
  })()`);
  ok('clic «Desar la foto»', (await clic('Desar la foto')) === 'ok');
  await dorm(2500);
  const des = await ev(`(async () => {
    const b = window.__desat; if (!b) return null;
    const buf = new Uint8Array(await b.arrayBuffer());
    const bmp = await createImageBitmap(b);
    let pos = 2, app1 = false; const marcadors = [];
    while (buf[pos] === 0xff && buf[pos+1] !== 0xda) { marcadors.push(buf[pos+1].toString(16)); if (buf[pos+1] === 0xe1) app1 = true; pos += 2 + ((buf[pos+2]<<8)|buf[pos+3]); }
    let s = ''; for (const c of buf) s += String.fromCharCode(c);
    return { mida: buf.length, app0: buf[2].toString(16)+buf[3].toString(16), ident: String.fromCharCode(...buf.slice(6,10)), unitats: buf[13], x: (buf[14]<<8)|buf[15], y: (buf[16]<<8)|buf[17], w: bmp.width, h: bmp.height, app1, marcadors, opcions: window.__opcions, b64: btoa(s) };
  })()`);
  if (des && rutaJpeg) {
    fs.writeFileSync(rutaJpeg, Buffer.from(des.b64, 'base64'));
    console.log('   JPEG desat a', rutaJpeg);
  }
  const esperatOpcions = JSON.stringify({
    suggestedName: '12345.jpg',
    startIn: 'pictures',
    types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }]
  });
  ok('Desat: el diàleg rep 12345.jpg, startIn pictures i tipus JPEG', des?.opcions === esperatOpcions, des?.opcions);
  ok('JPEG: 413x531', des?.w === 413 && des?.h === 531, des && `${des.w}x${des.h}`);
  ok(
    'JPEG: APP0 JFIF, unitats = 1, 300x300 ppp',
    des?.app0 === 'ffe0' && des.ident === 'JFIF' && des.unitats === 1 && des.x === 300 && des.y === 300,
    des && `${des.unitats}/${des.x}/${des.y}`
  );
  ok('JPEG: cap segment APP1/EXIF', des && !des.app1, des?.marcadors.join(','));
  ok('JPEG: mida < 300 KB', des && des.mida < 300 * 1024, des && String(des.mida));
  await dorm(500);
  ok('P6 després de desar', (await h1()) === 'Puja la foto al formulari', await h1());
  const p6 = await text();
  ok(
    'P6: parla de la carpeta on s’ha desat (per defecte, Imatges) i del nom 12345.jpg',
    p6.includes("on l'has desada (per defecte, Imatges)") && p6.includes('12345.jpg')
  );
  await ev(`document.querySelector('[role="dialog"] button, [aria-modal="true"] button')?.click()`);
  await dorm(200);
  await clic("Ja l'he enviat");
  await dorm(500);
  ok('P7', (await h1()) === 'Moltes gràcies!', await h1());
  ok(
    'P7: ni vídeo ni cap <img> blob al DOM',
    (await ev(
      `document.querySelectorAll('video').length + [...document.querySelectorAll('img')].filter(i => i.src.startsWith('blob:')).length`
    )) === 0
  );
  await clic('Començar de nou');
  await dorm(400);
  ok('«Començar de nou» torna a P0', (await h1()) === 'Foto de carnet amb uniforme');
  ok('Cap emmagatzematge usat', (await ev(`localStorage.length + sessionStorage.length`)) === 0);

  // Segon recorregut: cancel·lació, SecurityError (Baixades) i nom canviat al diàleg.
  await arribaACaptura('54321');
  await clic('Fer la foto ara');
  await dorm(1200);
  await clic('Ja en tinc prou');
  await dorm(400);
  await clic('Triar aquesta');
  await dorm(400);
  await ev(
    `window.showSaveFilePicker = async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; }`
  );
  await clic('Desar la foto');
  await dorm(800);
  ok(
    'AbortError: es queda a P5 sense error',
    (await h1()) === 'Desa la foto' &&
      (await ev(`[...document.querySelectorAll('[role="alert"]')].map(a => a.textContent).join('')`)) === ''
  );
  await ev(
    `window.showSaveFilePicker = async () => { const e = new Error('seg'); e.name = 'SecurityError'; throw e; }; window.__baixades = []; HTMLAnchorElement.prototype.click = function () { window.__baixades.push(this.download + '|' + this.href.slice(0,5)); };`
  );
  await clic('Desar la foto');
  await dorm(2000);
  const bx = await ev(`window.__baixades`);
  ok(
    'SecurityError: baixada amb <a download> (Baixades)',
    bx.length === 1 && bx[0].startsWith('54321.jpg|blob:'),
    JSON.stringify(bx)
  );
  ok(
    'P6 diu «Baixades»',
    (await h1()) === 'Puja la foto al formulari' && (await text()).includes('la carpeta Baixades')
  );

  await ev(`(() => { const e = new Event('pageshow'); e.persisted = true; window.dispatchEvent(e); })()`);
  await dorm(400);
  ok('pageshow persistit: torna a P0', (await h1()) === 'Foto de carnet amb uniforme');

  await arribaACaptura('11111');
  await clic('Fer la foto ara');
  await dorm(1200);
  await clic('Ja en tinc prou');
  await dorm(400);
  await clic('Triar aquesta');
  await dorm(400);
  await ev(
    `window.showSaveFilePicker = async () => ({ name: 'meva-foto.jpg', createWritable: async () => ({ write: async () => {}, close: async () => {} }) })`
  );
  await clic('Desar la foto');
  await dorm(2000);
  const p6nom = await text();
  ok(
    'Nom canviat al diàleg: P6 mostra «meva-foto.jpg»',
    (await h1()) === 'Puja la foto al formulari' && p6nom.includes('meva-foto.jpg') && !p6nom.includes('11111.jpg')
  );

  const csp = await ev(`window.__csp`);
  ok('Cap violació de CSP', csp.length === 0, JSON.stringify(csp));
  const externes = peticions.filter((u) => !/^(file|blob|data|about):/.test(u));
  ok('0 peticions externes', externes.length === 0, JSON.stringify(externes));
  console.log('   total de peticions (locals):', peticions.length);
  const errs = consola.filter((c) => /error|EXCEPCIO|csp|Content Security/i.test(c));
  ok('Cap error ni excepció a la consola', errs.length === 0, JSON.stringify(errs));
} catch (e) {
  console.error('EXCEPCIÓ DE LA PROVA:', e);
  resultats.push({ nom: 'prova', ok: false });
} finally {
  try {
    ws?.close();
  } catch {
    // Ja tancat.
  }
  // Edge pot haver delegat en altres processos (el llançador acaba de seguida): es tanquen tots els que fan
  // servir el perfil temporal d'aquesta prova, i només aquests.
  const nomPerfil = path.basename(perfil);
  if (process.platform === 'win32') {
    spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${nomPerfil}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
      ],
      { stdio: 'ignore' }
    );
  } else {
    spawnSync('pkill', ['-9', '-f', nomPerfil], { stdio: 'ignore' });
  }
  if (edge.exitCode === null) {
    edge.kill('SIGKILL');
  }
  await Promise.race([edgeTancat, dorm(3000)]);
  // Windows pot trigar a alliberar el perfil: es reintenta l'esborrat.
  for (let i = 0; i < 10; i++) {
    try {
      fs.rmSync(perfil, { recursive: true, force: true });
      break;
    } catch {
      await dorm(500);
    }
  }
  const fallades = resultats.filter((r) => !r.ok);
  console.log(`\n${resultats.length - fallades.length}/${resultats.length} comprovacions correctes`);
  process.exit(fallades.length ? 1 : 0);
}
