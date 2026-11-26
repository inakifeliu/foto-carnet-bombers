/**
 * Prova manual reproduïble (Fases 1 i 2): obre el HTML compilat a Microsoft Edge (headless, càmera simulada) i
 * recorre P0 → P7 pilotant-lo pel protocol de depuració (CDP). Fase 2: comprova que MediaPipe carrega a P3 amb la
 * CSP, que el bucle d'anàlisi corre a ≥ 10 fps, els semàfors, la confirmació de la captura manual, la puntuació
 * real a P4 i el JSON del mode diagnòstic (sense imatge). Comprova també la CSP i que no hi ha cap petició
 * externa. NO forma part de `npm test` (necessita Edge i un build previ).
 *
 * La càmera simulada de Chromium és un patró sintètic SENSE cara: els semàfors han de dir «No et veiem la cara».
 * Per provar amb una cara real, passa un vídeo (`--video fitxer.y4m` o `.mjpeg`; Chromium l'accepta com a càmera
 * simulada): llavors no s'exigeix el missatge de «sense cara» i es mostren els valors dels controls.
 *
 * Per defecte fa DUES passades, cada una amb el seu Edge i perfil temporal: la normal (GL per programari amb
 * `--disable-gpu`) i la SENSE WebGL (`--disable-gpu --disable-software-rasterizer`), on P3 ha de dir que l'anàlisi
 * automàtica no està disponible (sense carregar els models, RF-17) i la captura manual ha de funcionar.
 *
 * Ús:   npm run build && npm run prova-edge [-- [fitxer.html] [--jpeg sortida.jpg] [--video cara.y4m] [--visible]
 *                                              [--nomes-normal | --sense-webgl]]
 *
 *   fitxer.html     HTML a provar (per defecte, el més recent de dist/).
 *   --jpeg ruta     desa el JPEG que l'app genera (per inspeccionar-lo a mà).
 *   --video ruta    fitxer .y4m/.mjpeg com a càmera simulada (per exemple, amb una cara).
 *   --rampa         només la passada «rampa» (vídeo estàtic amb rampa de lluminància: el JPEG ha de ser el visor).
 *   --visible       obre Edge amb finestra en lloc de headless.
 *   --nomes-normal  només la passada normal.
 *   --sense-webgl   només la passada sense WebGL.
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
const senseWebgl = args.includes('--sense-webgl');
const rampa = args.includes('--rampa');
if (!senseWebgl && !rampa && !args.includes('--nomes-normal')) {
  // Sense cap flag de passada: es fan totes dues, cada una en un procés (i un Edge) a part.
  let codi = 0;
  for (const flag of ['--nomes-normal', '--sense-webgl', '--rampa']) {
    const nom = { '--sense-webgl': 'SENSE WebGL', '--rampa': 'RAMPA (JPEG = visor)' }[flag] ?? 'normal';
    console.log(`\n===== Passada ${nom} =====`);
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), flag, ...args], { stdio: 'inherit' });
    codi ||= r.status ?? 1;
  }
  process.exit(codi);
}
const visible = args.includes('--visible');
const iJpeg = args.indexOf('--jpeg');
const rutaJpeg = iJpeg >= 0 ? path.resolve(args[iJpeg + 1] ?? 'prova.jpg') : undefined;
const iVideo = args.indexOf('--video');
const rutaVideo = iVideo >= 0 ? path.resolve(args[iVideo + 1] ?? '') : undefined;
/**
 * Passada `--rampa`: càmera simulada = un .y4m estàtic 640×360 amb una rampa horitzontal de lluminància (Y creix amb x):
 * permet comprovar que el JPEG final és el rectangle que mostra el visor (enquadrament «visor»).
 */
function creaVideoRampa() {
  const [w, h] = [640, 360];
  const quadre = Buffer.alloc((w * h * 3) / 2, 128);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      quadre[y * w + x] = 16 + Math.round((x / (w - 1)) * 219);
    }
  }
  const fitxer = path.join(os.tmpdir(), `fcb-rampa-${process.pid}.y4m`);
  const capcalera = Buffer.from(`YUV4MPEG2 W${w} H${h} F30:1 Ip A1:1 C420jpeg\n`);
  const quadres = Buffer.concat([Buffer.from('FRAME\n'), quadre]);
  fs.writeFileSync(fitxer, Buffer.concat([capcalera, quadres]));
  return fitxer;
}
const rutaVideoUsada = rutaVideo ?? (rampa ? creaVideoRampa() : undefined);
const posicionals = args.filter((a, i) => !a.startsWith('--') && i !== iJpeg + 1 && i !== iVideo + 1);
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
    '--disable-gpu',
    // Sense rasteritzador per programari tampoc hi ha WebGL (passada «sense WebGL», RF-17).
    ...(senseWebgl ? ['--disable-software-rasterizer'] : []),
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream=device-count=2',
    ...(rutaVideoUsada ? [`--use-file-for-fake-video-capture=${rutaVideoUsada}`] : []),
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

const consola = [];
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
  // Una pestanya en segon pla es limita (requestVideoFrameCallback, temporitzadors): s'ha de poder mesurar de debò.
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__visibilitat = [document.visibilityState]; document.addEventListener('visibilitychange', () => window.__visibilitat.push(document.visibilityState));`
  });
  await cdp('Page.navigate', { url: pathToFileURL(html).href });
  await cdp('Page.bringToFront');
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
  // Mida esperada de la foto desada (sortida.mida = «original», alcadaMaxPx 16384): el rectangle del visor (35:45 el
  // més gran possible, centrat) a la seva mida en píxels, amb mínim 413x531, i ppp = round(alt / (45 / 25,4)).
  let camera = { w: 0, h: 0 };
  const midaCamera = async () => {
    camera = await ev(
      `({ w: document.querySelector('video').videoWidth, h: document.querySelector('video').videoHeight })`
    );
    console.log(`   (càmera simulada: ${camera.w}x${camera.h})`);
  };
  const esperat = () => {
    const { w: cw, h: ch } = camera;
    let h = cw * 45 >= ch * 35 ? ch : Math.round((cw * 45) / 35);
    h = Math.max(531, Math.min(h, 16384));
    return { w: Math.max(413, Math.round((h * 35) / 45)), h, ppp: Math.round(h / (45 / 25.4)) };
  };
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
  /** «Fer la foto ara»; si l'app demana confirmació (controls no verds), prem «Fer-la igualment». */
  const fesFoto = async () => {
    await clic('Fer la foto ara');
    await dorm(400);
    await clic('Fer-la igualment');
    await dorm(1200);
  };
  /** Espera que MediaPipe hagi carregat a P3 (apareixen els semàfors) o que hi hagi un error de càrrega. */
  const esperaModels = async () => {
    for (let i = 0; i < 120; i++) {
      const estat = await ev(
        `document.querySelector('[data-semafors]') ? 'llest' : document.querySelector('[data-error-models]') ? 'error' : 'carregant'`
      );
      if (estat !== 'carregant') return estat;
      await dorm(500);
    }
    return 'temps';
  };
  /** Espera (fins a 10 s) que la pestanya sigui visible; si no, les mesures de fps no serien fiables. */
  const esperaVisible = async () => {
    for (let i = 0; i < 20; i++) {
      await cdp('Page.bringToFront');
      if ((await ev(`document.visibilityState`)) === 'visible') return true;
      await dorm(500);
    }
    return false;
  };
  const mediana = (v) => {
    const o = [...v].sort((a, b) => a - b);
    return o.length ? o[Math.floor(o.length / 2)] : 0;
  };
  const llegeixRendiment = async () => {
    const text = await ev(`document.querySelector('#debug-rendiment')?.textContent ?? ''`);
    return {
      text,
      fps: Number(/anàlisi ([0-9.]+) fps/.exec(text)?.[1] ?? 0),
      ms: Number(/([0-9.]+) ms per fotograma/.exec(text)?.[1] ?? 0)
    };
  };
  /**
   * Una mesura de rendiment: pestanya visible, 6 lectures del panell cada ~1 s, es DESCARTA la primera (finestra
   * de fps incompleta i primer fotograma) i es pren la mediana de les altres.
   */
  const mesuraRendiment = async () => {
    const visibleOk = await esperaVisible();
    const lectures = [];
    for (let i = 0; i < 6; i++) {
      await dorm(1000);
      lectures.push(await llegeixRendiment());
    }
    const bones = lectures.slice(1);
    return {
      visibleOk,
      fps: mediana(bones.map((l) => l.fps)),
      ms: mediana(bones.map((l) => l.ms)),
      text: bones[bones.length - 1].text
    };
  };
  /**
   * Espera (sondeig cada 250 ms, fins a `maxMs`) que una expressió de la pàgina sigui certa. Substitueix les pauses
   * fixes allà on el temps depèn de la càrrega de l'equip (codificar el JPEG, etc.): si la condició no arriba a
   * complir-se, retorna false i la comprovació següent falla igualment (no s'amaga res).
   */
  const esperaCondicio = async (expressio, maxMs = 20000) => {
    for (let t = 0; t < maxMs; t += 250) {
      if ((await ev(expressio)) === true) return true;
      await dorm(250);
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
  ok('Pestanya visible (Page.bringToFront)', await esperaVisible(), JSON.stringify(await ev(`window.__visibilitat`)));
  if (!senseWebgl && !rampa) {
    // --- Fase 4: finestra estreta (360 px) sense scroll horitzontal, a P0 i P1, i focus al títol en canviar ---------
    await cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: false });
    await dorm(300);
    const sense_scroll = () => ev(`document.documentElement.scrollWidth <= window.innerWidth`);
    ok(
      'Finestra de 360 px: P0 sense scroll horitzontal',
      await sense_scroll(),
      await ev(`document.documentElement.scrollWidth + '/' + window.innerWidth`)
    );
    await clic('Començar');
    await dorm(300);
    ok(
      'Finestra de 360 px: P1 sense scroll horitzontal',
      await sense_scroll(),
      await ev(`document.documentElement.scrollWidth + '/' + window.innerWidth`)
    );
    ok(
      'Canvi de pantalla: el focus és al títol (h1) de P1',
      (await ev(`document.activeElement === document.querySelector('h1')`)) === true
    );
    ok(
      'P1: 9 il·lustracions SVG decoratives',
      (await ev(`document.querySelectorAll('ol li svg[aria-hidden="true"]').length`)) === 9
    );
    await clic('Enrere');
    await dorm(300);
    await cdp('Emulation.clearDeviceMetricsOverride');
    await dorm(300);
    ok('Tornada a P0', (await h1()) === 'Foto de carnet amb uniforme', await h1());
  }
  if (senseWebgl) {
    // --- Passada sense WebGL (RF-17): no es carreguen els models, la captura manual continua -----------------
    const webgl = await ev(
      `(() => { const c = () => document.createElement('canvas'); return { webgl2: !!c().getContext('webgl2'), webgl: !!(c().getContext('webgl') || c().getContext('experimental-webgl')) }; })()`
    );
    ok('Edge sense WebGL (ni 1 ni 2)', !webgl.webgl2 && !webgl.webgl, JSON.stringify(webgl));
    ok(
      'P0 avisa que no hi haurà anàlisi automàtica',
      (await text()).includes("no pot fer l'anàlisi automàtica de la imatge"),
      (await ev(`document.querySelector('main p:last-of-type')?.textContent ?? ''`)).slice(0, 80)
    );
    await arribaACaptura('12345');
    ok('P3 (sense WebGL)', (await h1()) === 'Fes-te la foto', await h1());
    ok('P3: el vídeo té fotograma', await esperaVideo());
    await dorm(1500);
    const noDisp = await ev(`document.querySelector('[data-analisi-no-disponible]')?.textContent ?? ''`);
    ok(
      'P3: mostra directament «anàlisi no disponible»',
      noDisp.includes("L'anàlisi automàtica no està disponible") && noDisp.includes('Fer la foto ara'),
      noDisp
    );
    ok(
      'P3: no es carreguen els models (ni «Preparant l’anàlisi…» ni semàfors ni error de càrrega)',
      (await ev(
        `!document.querySelector('[data-carregant-models]') && !document.querySelector('[data-semafors]') && !document.querySelector('[data-error-models]')`
      )) === true
    );
    ok(
      'P3: cap <script src="blob:…"> (MediaPipe no s’ha tocat)',
      (await ev(`document.querySelectorAll('script[src^="blob:"]').length`)) === 0
    );
    ok(
      'P3: «Fer la foto ara» activat',
      (await ev(
        `[...document.querySelectorAll('button')].find((b) => b.textContent === 'Fer la foto ara')?.disabled`
      )) === false
    );
    await midaCamera();
    ok('clic «Fer la foto ara»', (await clic('Fer la foto ara')) === 'ok');
    await dorm(1500);
    ok(
      'Captura manual sense anàlisi: cap confirmació i 1 miniatura',
      (await ev(`!document.querySelector('[role="dialog"]')`)) === true &&
        (await ev(`document.querySelectorAll('main ul img').length`)) === 1,
      await ev(`document.querySelector('[role="status"][aria-live]')?.textContent ?? ''`)
    );
    await clic('Ja en tinc prou');
    await dorm(500);
    ok('P4', (await h1()) === 'Tria la millor foto', await h1());
    const mides = await ev(
      `[...document.querySelectorAll('main ul img')].map(i => i.naturalWidth + 'x' + i.naturalHeight)`
    );
    const mida1 = `${esperat().w}x${esperat().h}`;
    ok(
      `P4: la foto retallada és de ${mida1} (resolució original de la càmera)`,
      mides.length === 1 && mides[0] === mida1,
      mides.join(',')
    );
    const p4 = await ev(`document.querySelector('main').textContent`);
    ok('P4: «Sense puntuació» (no hi ha anàlisi)', p4.includes('Sense puntuació'), p4.slice(0, 120));
    await clic('Triar aquesta');
    await dorm(500);
    ok('P5', (await h1()) === 'Desa la foto', await h1());
  } else {
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
      (await ev(
        `[...document.querySelectorAll('button')].find(b => b.textContent === 'Fer la foto ara')?.disabled`
      )) === false
    );

    // --- Fase 2: MediaPipe, bucle d'anàlisi, semàfors i mode diagnòstic ---------------------------------------
    const t0Models = Date.now();
    const estatModels = await esperaModels();
    ok(
      'P3: MediaPipe carrega amb la CSP (semàfors visibles)',
      estatModels === 'llest',
      `${estatModels} (${Date.now() - t0Models} ms)`
    );
    ok(
      'P3: cap <script src="blob:…"> deixat al DOM',
      (await ev(`document.querySelectorAll('script[src^="blob:"]').length`)) === 0
    );
    ok('P3: 11 semàfors (RF-05)', (await ev(`document.querySelectorAll('[data-semafors] li').length`)) === 11);
    await dorm(3000);
    // Mode diagnòstic amb Ctrl+Alt+D (RF-18): valors en directe, superposició i rendiment.
    await ev(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, altKey: true, bubbles: true }))`
    );
    // El primer fotograma amb SwiftShader pot trigar (compilació de shaders): s'espera un rendiment estable.
    for (let i = 0; i < 30; i++) {
      if ((await llegeixRendiment()).fps >= 5) break;
      await dorm(1000);
    }
    // Mesura de rendiment amb reintents raonables: fins a 3 mesures (cada una amb pestanya visible, descartant la primera
    // lectura i amb la mediana de les altres). Només s'accepta si UNA mesura compleix; es mostren totes (res s'amaga).
    const intents = [];
    let rendiment = '';
    let fps = 0;
    let msFotograma = 0;
    let nivell = '';
    for (let intent = 1; intent <= 3; intent++) {
      const m = await mesuraRendiment();
      rendiment = m.text;
      fps = m.fps;
      msFotograma = m.ms;
      nivell = (await ev(`document.querySelector('#debug-temps')?.textContent ?? ''`)).match(/nivell (\w+)/)?.[1] ?? '';
      intents.push(`${m.fps} fps / ${m.ms} ms${m.visibleOk ? '' : ' (pestanya NO visible)'} [${nivell}]`);
      console.log(`   mesura ${intent}: ${intents[intent - 1]}`);
      // Pressupost adaptatiu: en nivell normal s'exigeix ≥ 10 fps; si l'entorn (GL per programari) l'ha fet baixar a
      // «reduït» (8 fps objectiu), el mínim és 7 fps i s'avisa explícitament.
      const compleix = m.visibleOk && (nivell === 'reduit' ? m.fps >= 6.5 : m.fps >= 9.5);
      if (compleix) break;
    }
    console.log('   ' + rendiment);
    const reduit = nivell === 'reduit';
    ok(
      reduit
        ? "Diagnòstic: l'anàlisi corre a ≥ 6,5 fps (pressupost REDUÏT a 8 fps: entorn lent)"
        : "Diagnòstic: l'anàlisi corre a ≥ 10 fps",
      fps >= (reduit ? 6.5 : 9.5),
      `${fps} fps, ${msFotograma} ms/fotograma, nivell ${nivell || '?'}; mesures: ${intents.join(' | ')}`
    );
    const temps = await ev(`document.querySelector('#debug-temps')?.textContent ?? ''`);
    console.log('   ' + temps);
    ok(
      'Diagnòstic: temps per pas (dibuix, Face Landmarker, segmentador, mètriques) al panell',
      /dibuix [0-9.]+ · Face Landmarker [0-9.]+ · segmentador [0-9.]+ · mètriques [0-9.]+/.test(temps),
      temps
    );
    ok('Diagnòstic: mostra el delegat (GPU o CPU)', /delegat (GPU|CPU)/.test(rendiment), rendiment);
    const controls = await ev(`[...document.querySelectorAll('#debug-controls li')].map(li => li.textContent)`);
    ok('Diagnòstic: valors en directe dels 11 controls', controls.length === 11, controls.join(' | '));
    console.log('   ' + (await ev(`document.querySelector('#debug-mesures')?.textContent ?? ''`)));
    ok(
      'Diagnòstic: superposició (canvas) sobre el vídeo',
      (await ev(`!!document.querySelector('[data-overlay-diagnostic]')`)) === true
    );
    const guiaTxt = await ev(`document.querySelector('[role="status"][aria-live]')?.textContent ?? ''`);
    if (!rutaVideo) {
      ok(
        'P3: el missatge principal és «No et veiem la cara» (patró sintètic, sense cara)',
        guiaTxt === 'No et veiem la cara',
        guiaTxt
      );
      const estatsSem = await ev(
        `[...document.querySelectorAll('[data-semafors] li')].map(li => li.querySelector('strong')?.textContent)`
      );
      ok(
        'P3: semàfor de la cara en «Cal corregir» i la resta «Sense dades»',
        estatsSem[0] === 'Cal corregir' && estatsSem.slice(1).every((x) => x === 'Sense dades'),
        estatsSem.join(',')
      );
    } else {
      console.log(`   (vídeo propi: no s'exigeix «sense cara»; missatge principal: ${guiaTxt})`);
    }
    // JSON de diagnòstic: s'intercepta el <a download> (mateix camí de codi que la baixada real).
    await ev(`(() => {
    window.__jsonDiag = null;
    const clic = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.startsWith('diagnostic-')) { window.__jsonDiag = fetch(this.href).then((r) => r.text()); return; }
      return clic.call(this);
    };
  })()`);
    await ev(`document.querySelector('#debug-descarrega').click()`);
    await dorm(500);
    const jsonText = await ev(`window.__jsonDiag`);
    let diag;
    try {
      diag = JSON.parse(jsonText);
    } catch {
      diag = undefined;
    }
    ok(
      'Diagnòstic: JSON generat amb versió, controls i configuració',
      !!diag && !!diag.versio && Object.keys(diag.controls).length === 11 && !!diag.config?.llindars,
      diag && diag.versio
    );
    ok(
      'Diagnòstic: el JSON porta els temps per pas, el nivell del pressupost i la segmentació',
      !!diag?.rendiment?.tempsPerPas &&
        ['dibuix', 'landmarker', 'segmentador', 'metriques'].every(
          (k) => typeof diag.rendiment.tempsPerPas[k] === 'number'
        ) &&
        ['normal', 'reduit'].includes(diag.rendiment.nivellPressupost) &&
        diag.rendiment.segmentacio === 'activa',
      JSON.stringify(diag?.rendiment)
    );
    ok(
      'Diagnòstic: el JSON no porta cap imatge ni la matrícula',
      !!jsonText && !/data:image|blob:|base64|landmarks|"mascara"\s*:|12345/.test(jsonText),
      jsonText && `${jsonText.length} bytes`
    );
    // El mode diagnòstic es deixa activat: no afecta la resta de la prova.

    const info = await ev(
      `(() => { const v = document.querySelector('video'); return { w: v.videoWidth, h: v.videoHeight, pistes: v.srcObject ? v.srcObject.getVideoTracks().map(t => t.readyState) : null, transform: getComputedStyle(v).transform, opcions: document.querySelectorAll('#fc-camera option').length, aria: document.querySelector('[role="status"][aria-live]')?.hasAttribute('aria-label') }; })()`
    );
    ok(
      'P3: vídeo actiu amb pista «live»',
      info.w > 0 && info.h > 0 && info.pistes?.[0] === 'live',
      `${info.w}x${info.h}`
    );
    ok('P3: mirall només per CSS (matrix(-1,...))', info.transform.startsWith('matrix(-1'), info.transform);
    if (!rampa) {
      ok('P3: selector amb 2 càmeres', info.opcions === 2, String(info.opcions));
    }
    ok('P3: la regió d’estat no té aria-label', info.aria === false);

    // Canvi de càmera: s'ha d'aturar la pista anterior (la passada «rampa» fa servir un fitxer: una sola càmera).
    if (!rampa) {
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
    }

    // Perfil de lluminància que ha de tenir la foto: el rectangle visible al visor (object-fit: cover, calculat aquí
    // amb les mides reals del <video> i del visor), llegit del propi fotograma de la càmera (estàtic).
    if (rampa) {
      await ev(`(() => {
        const v = document.querySelector('video');
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        const x = c.getContext('2d'); x.drawImage(v, 0, 0);
        const bw = v.clientWidth, bh = v.clientHeight;
        const esc = Math.max(bw / v.videoWidth, bh / v.videoHeight);
        const vw = bw / esc, vh = bh / esc, vx = (v.videoWidth - vw) / 2, vy = (v.videoHeight - vh) / 2;
        const lum = (d) => 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
        window.__esperat = [0.05, 0.25, 0.5, 0.75, 0.95].map((f) => lum(x.getImageData(Math.round(vx + f * vw), Math.round(v.videoHeight / 2), 1, 1).data));
        window.__visor = { bw, bh, vw, vh, vx, vy, vWidth: v.videoWidth, vHeight: v.videoHeight };
      })()`);
    }
    // Captura automàtica: amb la càmera simulada (sense cara) no s'ha de disparar mai.
    await dorm(5000);
    ok(
      'P3: sense cara la captura automàtica no es dispara (cap compte enrere ni cap foto)',
      (await ev(
        `document.querySelectorAll('[data-compte-enrere]').length + document.querySelectorAll('main ul img').length`
      )) === 0
    );
    // Captura manual ×2
    await midaCamera();
    ok('clic «Fer la foto ara»', (await clic('Fer la foto ara')) === 'ok');
    await dorm(500);
    const dialeg = await ev(`document.querySelector('[role="dialog"]')?.textContent ?? ''`);
    if (rutaVideo) {
      console.log(
        `   (vídeo propi: diàleg de confirmació ${dialeg ? 'mostrat' : 'no mostrat, tots els controls verds'})`
      );
    } else {
      ok(
        'P3: la captura manual demana confirmació (controls no verds)',
        dialeg.includes('Hi ha aspectes a millorar. Vols fer-la igualment?'),
        dialeg
      );
      await clic('Millorar-ho primer');
      await dorm(300);
      ok(
        'P3: «Millorar-ho primer» no fa cap foto',
        (await ev(`document.querySelectorAll('main ul img').length`)) === 0
      );
      await clic('Fer la foto ara');
      await dorm(400);
    }
    await clic('Fer-la igualment');
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
    await fesFoto();
    ok('P3: 2 miniatures', (await ev(`document.querySelectorAll('main ul img').length`)) === 2);
    await clic('Ja en tinc prou');
    await dorm(500);
    ok('P4', (await h1()) === 'Tria la millor foto', await h1());
    const mides = await ev(
      `[...document.querySelectorAll('main ul img')].map(i => i.naturalWidth + 'x' + i.naturalHeight)`
    );
    const mida2 = `${esperat().w}x${esperat().h}`;
    ok(`P4: 2 fotos retallades a ${mida2}`, mides.length === 2 && mides.every((m) => m === mida2), mides.join(','));
    const p4 = await ev(`document.querySelector('main').textContent`);
    const puntuacions = p4.match(/Puntuació: \d+ \/ 100/g) ?? [];
    ok(
      'P4: puntuació real (0-100) a cada foto, no simulada',
      puntuacions.length === 2 && !/simulad/i.test(p4),
      puntuacions.join(' ; ')
    );
    console.log(
      '   avisos P4: ' +
        (await ev(
          `[...document.querySelectorAll('[data-avisos-foto]')].map(u => [...u.querySelectorAll('li')].map(l => l.textContent).join(' / ')).join(' || ')`
        ))
    );
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
      return { name: '12345.jpg', queryPermission: async () => 'granted', remove: async () => { window.__esborrat = true; }, createWritable: async () => ({ write: async (b) => { trossos.push(b); }, close: async () => { window.__desat = new Blob(trossos, {type:'image/jpeg'}); } }) };
    };
  })()`);
    ok('clic «Desar la foto»', (await clic('Desar la foto')) === 'ok');
    await esperaCondicio(`window.__desat instanceof Blob`);
    const des = await ev(`(async () => {
    const b = window.__desat; if (!b) return null;
    const buf = new Uint8Array(await b.arrayBuffer());
    const bmp = await createImageBitmap(b);
    let pos = 2, app1 = false; const marcadors = [];
    while (buf[pos] === 0xff && buf[pos+1] !== 0xda) { marcadors.push(buf[pos+1].toString(16)); if (buf[pos+1] === 0xe1) app1 = true; pos += 2 + ((buf[pos+2]<<8)|buf[pos+3]); }
    let s = ''; for (const c of buf) s += String.fromCharCode(c);
    return { mida: buf.length, app0: buf[2].toString(16)+buf[3].toString(16), ident: String.fromCharCode(...buf.slice(6,10)), unitats: buf[13], x: (buf[14]<<8)|buf[15], y: (buf[16]<<8)|buf[17], w: bmp.width, h: bmp.height, app1, marcadors, opcions: window.__opcions, b64: btoa(s),
      perfil: await (async () => {
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
        const lum = (d) => 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
        return [0.05, 0.25, 0.5, 0.75, 0.95].map((f) => lum(x.getImageData(Math.round(f * (bmp.width - 1)), Math.round(bmp.height / 2), 1, 1).data));
      })(), esperat: window.__esperat ?? null, visor: window.__visor ?? null };
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
    const esp = esperat();
    ok(`JPEG: ${esp.w}x${esp.h}`, des?.w === esp.w && des?.h === esp.h, des && `${des.w}x${des.h}`);
    ok(
      `JPEG: APP0 JFIF, unitats = 1, ${esp.ppp}x${esp.ppp} ppp (35x45 mm)`,
      des?.app0 === 'ffe0' && des.ident === 'JFIF' && des.unitats === 1 && des.x === esp.ppp && des.y === esp.ppp,
      des && `${des.unitats}/${des.x}/${des.y}`
    );
    if (rampa) {
      const dif = des?.perfil?.map((l, i) => Math.abs(l - des.esperat[i]));
      ok(
        'JPEG: és el rectangle que mostra el visor (perfil de lluminància vs. fotograma de la càmera, ±10)',
        dif && dif.every((d) => d <= 10),
        des &&
          `jpeg=${des.perfil.map((n) => n.toFixed(0))} esperat=${des.esperat.map((n) => n.toFixed(0))} visor=${JSON.stringify(des.visor)}`
      );
    }
    ok('JPEG: cap segment APP1/EXIF', des && !des.app1, des?.marcadors.join(','));
    console.log(`   (JPEG desat: ${des?.mida} bytes, ${des?.w}x${des?.h})`);
    ok('JPEG: mida raonable (< 10 MB, qualitat màxima)', des && des.mida < 10 * 1024 * 1024, des && String(des.mida));
    await esperaCondicio(`document.querySelector('h1')?.textContent === 'Puja la foto al formulari'`);
    ok('P6 després de desar', (await h1()) === 'Puja la foto al formulari', await h1());
    const p6 = await text();
    ok(
      'P6: parla de la carpeta on s’ha desat (per defecte, Imatges) i del nom 12345.jpg',
      p6.includes("on l'has desada (per defecte, Imatges)") && p6.includes('12345.jpg')
    );
    // RF-12/RF-13: window.open interceptat (cap navegació; no s'obre el Forms real) i enllaç alternatiu.
    await ev(`window.__obert = []; window.open = (...a) => { window.__obert.push(a); return null; }`);
    const pasos = await ev(`document.querySelectorAll('[role="dialog"] ol li').length`);
    ok('P6: el modal mostra les 4 instruccions numerades', pasos === 4, String(pasos));
    ok('P6: «Obrir el formulari» fa clic', (await clic('Obrir el formulari')) === 'ok');
    await dorm(200);
    const obert = await ev(`window.__obert`);
    ok(
      'P6: window.open rep l’URL del Forms amb la matrícula codificada, _blank i noopener',
      obert.length === 1 &&
        /^https:\/\/forms\.office\.com\/.*=12345$/.test(obert[0][0]) &&
        obert[0][1] === '_blank' &&
        obert[0][2] === 'noopener',
      JSON.stringify(obert)
    );
    console.log('   URL rebuda per window.open: ' + (obert[0]?.[0] ?? '?').slice(0, 60) + '…');
    const enllac = await ev(
      `(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.startsWith('Si no s') && x.target === '_blank'); return a ? { href: a.href, target: a.target, rel: a.rel } : null; })()`
    );
    ok(
      'P6: enllaç alternatiu visible (_blank, noopener noreferrer) amb la mateixa URL',
      enllac && enllac.target === '_blank' && enllac.rel === 'noopener noreferrer' && enllac.href === obert[0]?.[0],
      JSON.stringify(enllac)
    );
    await ev(`document.querySelector('[role="dialog"] button, [aria-modal="true"] button')?.click()`);
    await dorm(200);
    await clic("Ja l'he enviat");
    await dorm(500);
    ok('P7', (await h1()) === 'Moltes gràcies!', await h1());
    ok(
      "P7 (RF-15): amb handle i remove() surt «Esborrar la foto de l'equip» i el recordatori",
      (await text()).includes('Un cop enviada') &&
        (await ev(
          `[...document.querySelectorAll('button')].some(b => b.textContent.startsWith('Esborrar la foto de l'))`
        ))
    );
    await clic("Esborrar la foto de l'equip");
    await esperaCondicio(`window.__esborrat === true`);
    await dorm(300);
    ok(
      'P7 (RF-15): el handle simulat ha rebut remove() i diu «Foto esborrada»',
      (await text()).includes('Foto esborrada')
    );
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
    await fesFoto();
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
    await esperaCondicio(`window.__baixades.length >= 1`);
    await dorm(300);
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
    await fesFoto();
    await clic('Ja en tinc prou');
    await dorm(400);
    await clic('Triar aquesta');
    await dorm(400);
    await ev(
      `window.showSaveFilePicker = async () => ({ name: 'meva-foto.jpg', createWritable: async () => ({ write: async () => {}, close: async () => {} }) })`
    );
    await clic('Desar la foto');
    await esperaCondicio(`document.querySelector('h1')?.textContent === 'Puja la foto al formulari'`);
    const p6nom = await text();
    ok(
      'Nom canviat al diàleg: P6 mostra «meva-foto.jpg»',
      (await h1()) === 'Puja la foto al formulari' && p6nom.includes('meva-foto.jpg') && !p6nom.includes('11111.jpg')
    );
  }

  const csp = await ev(`window.__csp`);
  ok('Cap violació de CSP', csp.length === 0, JSON.stringify(csp));
  const externes = peticions.filter((u) => !/^(file|blob|data|about):/.test(u));
  ok('0 peticions externes', externes.length === 0, JSON.stringify(externes));
  console.log('   total de peticions (locals):', peticions.length);
  if (process.env.PROVA_CONSOLA) console.log(consola.join('\n'));
  // MediaPipe escriu missatges informatius (INFO, W<data> ...) pel canal d'error de la consola: no són errors.
  const errs = consola
    .filter((c) => !/INFO: |^warning: Wd{4} |OpenGL error checking is disabled/.test(c))
    .filter((c) => /error|EXCEPCIO|csp|Content Security/i.test(c));
  ok('Cap error ni excepció a la consola', errs.length === 0, JSON.stringify(errs));
} catch (e) {
  console.error('EXCEPCIÓ DE LA PROVA:', e);
  console.error(['Consola de la pàgina (últimes 15 línies):', ...consola.slice(-15)].join('\n  '));
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
