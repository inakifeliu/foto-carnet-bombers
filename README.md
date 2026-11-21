# Foto Carnet Bombers de Barcelona

Aplicació en **un únic fitxer HTML autònom** perquè els bombers del SPCPEIS es facin ells mateixos la foto de carnet amb el polo de l'uniforme: captura guiada amb webcam, retall automàtic a 35 × 45 mm, desat local com a `MATRICULA.jpg` i pujada via Microsoft Forms. El fitxer es distribueix per SharePoint, OneDrive o correu i s'obre amb doble clic a Edge, sense instal·lar res i sense connexió (només el Forms necessita xarxa).

- Especificació completa (v0.3): [docs/ESPECIFICACIO.md](docs/ESPECIFICACIO.md)
- Estat: **Fase 3 (captura automàtica, selecció i Forms) implementada**, pendent de la prova manual al Surface amb una cara real (les Fases 1-2 ja s'hi han provat). Flux complet P0 → P7: captura manual (amb confirmació si hi ha controls no verds), temporitzador de 5 s i **captura automàtica** (tot verd durant 1 s → compte enrere 3-2-1 → foto; es cancel·la si un control passa a vermell; només amb anàlisi disponible); fins a 3 fotos amb puntuació real a P4 (la triada és l'única que es manté, RF-09); desat a Imatges o Baixades (P5); P6 amb les instruccions i `window.open` al Forms pre-omplert; P7 amb el recordatori i l'esborrat opcional de la foto (RF-15). **Pendent**: el calibratge amb cares reals (Fase 5) i els acabats (Fase 4). La URL del Forms de `config/config.json` és el marcador `XXXX` fins que s'hi posi la real.
- La branca `fase-0/viabilitat-esquelet` conté la versió anterior com a web part SPFx (v0.2). És només un arxiu: no es fusiona.

## Requisits

- **Node 22 o superior** i npm (només per compilar; l'usuari final no necessita res més que Edge).

## Ordres

| Ordre               | Què fa                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm install`       | Instal·la les dependències                                                                                                |
| `npm run build`     | Valida la configuració, compila i genera **`dist/foto-carnet-bombers-vX.Y.Z.html`** i el seu `.sha256`, i passa la guarda |
| `npm run verifica`  | Torna a passar la guarda sobre l'HTML ja generat a `dist/`                                                                |
| `npm test`          | Tests (Jest + jsdom)                                                                                                      |
| `npm run typecheck` | TypeScript estricte, sense emetre                                                                                         |
| `npm run lint`      | ESLint (configuració plana, typescript-eslint, react-hooks)                                                               |
| `npm run format`    | Prettier (`format:check` només comprova)                                                                                  |

La sortida és sempre a `dist/` (no es versiona). El fitxer porta tot el codi, React, els models, el WASM de MediaPipe, els logos i la configuració.

## Configuració

`config/config.json` (llindars, regex de la matrícula, URL del Forms, ppp...) s'**incrusta en compilar**. Per canviar-la: edita el fitxer, incrementa la versió a `package.json`, `npm run build` i torna a distribuir (spec §10, D16).

La mateixa lògica que fa servir l'app (`resolConfig` a `src/config/configuracio.ts`) la valida contra la forma i els tipus de `src/config/config.default.json`. **La compilació falla amb qualsevol avís** (clau desconeguda, tipus incorrecte, regex invàlida, `ppp` que no sigui 300/600...), perquè ja no hi ha cap panell on corregir-ho en execució. La regex de la matrícula es valida amb el mateix embolcall `^(?:…)$` que usa l'app.

**URL del Forms** (`forms.urlPlantilla`): el build la valida amb `diagnosticaPlantilla` (`src/app/formulari.ts`, la mateixa funció que fa servir P6). Ha de ser `https:`, contenir `{MATRICULA}` i el seu host ha de ser **exactament** un de `forms.office.com`, `forms.microsoft.com` o `forms.cloud.microsoft` (comparació exacta, mai per sufix ni subdomini). Qualsevol incompliment fa fallar el build. Mentre l'URL encara porti el marcador provisional `XXXX` (fins que hi hagi el Forms real), el build només mostra un **AVÍS** visible i continua. Si Microsoft canvia de domini, cal ampliar `HOSTS_FORMS` (i `HOSTS_FORMS_GUARDA` a la guarda; un test comprova que coincideixen).

La data de compilació és en hora **local** de la màquina (no UTC).

## Estructura

```
config/config.json            configuració que s'incrusta
scripts/construeix.mjs        esbuild + incrustació de recursos + HTML + sha256 + guarda
scripts/mediapipe-sense-telemetria.mjs   pegat de telemetria de MediaPipe
scripts/verifica-html.mjs     guarda: cap telemetria ni host extern
src/index.html                plantilla (CSP, missatge estàtic i <noscript>, RF-19)
src/main.tsx, arrenca.tsx     arrencada (detecció d'iframe, RF-19)
src/app, screens, components  màquina d'estats, pantalles P0–P7 + NoCompatible, components
src/recursos                  descodificació dels recursos incrustats (RF-20)
src/captura                  càmera (RF-01), retall (RF-07), JFIF (RF-08), desat (RF-11), fotos en memòria
src/vision                    (de moment, només la prova de càrrega del mode diagnòstic)
src/i18n/ca.json              tots els textos (català)
src/assets                    brand/ (logos), models/, wasm/ (còpia verificada per SHA-256)
```

## Com s'incrusten els recursos (RF-20)

El loader i el binari WASM de MediaPipe i els dos models es llegeixen en compilar, es comprimeixen amb **gzip (nivell 9) només si estalvia almenys el 10 %**, es codifiquen en base64 i es posen a `<script type="application/octet-stream" id="recurs-NOM">` (no s'executen). Un manifest JSON (`#recursos-manifest`) diu de cada recurs el tipus MIME, si està comprimit, la mida original i el SHA-256 dels bytes originals. En execució, `src/recursos` ofereix:

- `obteRecurs(nom): Promise<Uint8Array>` — base64 → bytes → `DecompressionStream('gzip')` si cal.
- `obteUrlBlob(nom, mime): Promise<string>` — URL `blob:` amb memòria cau, que s'allibera amb `revocaUrlsBlob()` i amb la neteja de memòria (RF-16: `pagehide` i «Començar de nou»).

Els logos van com a URI `data:` (SVG com a `data:image/svg+xml;base64`), amb els bytes originals sense modificar.

## Telemetria de MediaPipe i guarda de build

`@mediapipe/tasks-vision` inclou un registre que envia dades d'ús a `odml.pa.googleapis.com`. El pegat `scripts/mediapipe-sense-telemetria.mjs` el neutralitza en compilar (3 substitucions; **falla si el patró no es troba**, p. ex. en pujar de versió). La guarda `scripts/verifica-html.mjs` s'executa sempre al final del build sobre l'HTML final i fa fallar la compilació (i n'esborra la sortida) si hi troba:

- `googleapis` (excepte l'identificador protobuf `type.googleapis.com/`), `odml.` o `google-analytics`;
- qualsevol URL `http(s)://` fora de la llista permesa: `www.w3.org` (espais de noms XML/SVG de React i dels logos), `reactjs.org` (text dels errors minificats de React) i el host del Forms de `config.json`;
- `<script src>`, `<link href>` o `@import` (res no pot ser extern);
- recursos incrustats que no coincideixin amb el seu SHA-256 del manifest.

## Content-Security-Policy (bloqueig de xarxa en execució)

La guarda només inspecciona text; el bloqueig real de xarxa el fa la meta `Content-Security-Policy` de `src/index.html`:

```
default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; connect-src blob:;
img-src data: blob:; style-src 'unsafe-inline'; media-src blob: mediastream:; worker-src blob:;
font-src data:; form-action 'none'; base-uri 'none'
```

Cap directiva admet `http(s):`, `ws(s):` ni `*`: qualsevol `fetch`/XHR/WebSocket/imatge externs queden bloquejats pel navegador. Cada excepció (`'unsafe-inline'` per al JS/CSS incrustats, `'wasm-unsafe-eval'` i `blob:` pel loader i el WASM de MediaPipe, `blob:`/`data:` per a imatges, etc.) està documentada en un comentari a `src/index.html`. Obrir el Forms (`window.open` / enllaç `target=_blank`) és una navegació i no queda afectat. `frame-ancestors` no funciona en una meta i no s'hi posa (l'iframe es detecta per codi, RF-19). La guarda comprova que la meta hi és, abans de qualsevol `<script>`, que no té cap directiva ni token fora de la llista (`CSP_PERMESA`) i que `connect-src`, `default-src`, `form-action` i `base-uri` són exactament els esperats.

`npm run verifica` respecta `FCB_CONFIG` (ruta alternativa de configuració) igual que el build. A més dels patrons `http(s)://`, la guarda detecta URL `ws(s)://`, `ftp://`, protocol-relatives (`//host.tld/`) en cadenes i barres escapades (`https://`); els hosts permesos es comparen **exactament** (cap subdomini).

Per comprovar que la guarda funciona: `FCB_PROVA_SENSE_PEGAT=1 npm run build` desactiva el pegat i el build ha de fallar.

## Prova manual a Edge (Fase 1)

`npm run build && npm run prova-edge` obre el HTML de `dist/` a Microsoft Edge (headless, càmera simulada amb `--use-fake-device-for-media-stream`, perfil temporal i port de depuració lliure) i recorre P0 → P7 comprovant, entre altres coses, el JPEG desat (413×531, JFIF 300 ppp, sense EXIF), l'alternativa a Baixades, el nom canviat al diàleg, la CSP i que **no hi ha cap petició externa**. Opcions: `npm run prova-edge -- fitxer.html --jpeg sortida.jpg --visible`. Si Edge no és a una ubicació habitual, defineix `EDGE_PATH`. No forma part de `npm test`.

## Comprovar el hash (Windows)

Al costat de cada HTML hi ha el seu `.sha256`. A PowerShell, des de la carpeta del fitxer:

```powershell
Get-FileHash -Algorithm SHA256 .oto-carnet-bombers-vX.Y.Z.html
```

El valor `Hash` ha de coincidir amb el contingut de `foto-carnet-bombers-vX.Y.Z.html.sha256`. Els finals de línia del repositori són sempre LF (`.gitattributes`), de manera que el hash és el mateix compilant a qualsevol màquina amb la mateixa versió i data de compilació.

## Mida

Fitxer final (v0.1.0): **≈ 10,7 MB** (objectiu < 12 MB). Domina el WASM (14,0 MB → 4,0 MB amb gzip → 5,3 MB en base64) i el model de cara (3,6 MB → 3,2 MB → 4,2 MB). El build en mostra el detall.

## Mode diagnòstic (base de RF-18)

`Ctrl + Alt + D` o `#debug` al final de l'adreça mostra un panell amb versió, data de compilació i resum de la configuració, un botó que **comprova tots els recursos incrustats** (descodifica, descomprimeix i verifica SHA-256 i `WebAssembly.validate`) i un altre que prova la càrrega de MediaPipe amb els recursos incrustats. Mai mostra cap imatge. En la Fase 2 també mostra valors en directe, rendiment (fps, ms, delegat), la superposició (màscara, zona del tors, retall previst) i baixa un JSON de diagnòstic (valors, versió i configuració; mai imatge ni matrícula).

## Captura i sortida (Fase 1)

- **Càmera** (`src/captura/camera.ts`, `useCamera.ts`): `getUserMedia` amb 1920×1080 ideal i `facingMode: 'user'`; si hi ha diverses càmeres, selector desplegable (es llisten després del permís; en canviar-ne s'aturen les pistes anteriors). Errors en català: permís denegat, cap càmera, càmera ocupada (Teams…) i genèric, amb «Tornar a provar». Avís no bloquejant si la resolució real és < 1280×720. El mirall és només CSS (`transform`) a la visualització.
- **Captura manual**: es dibuixa el fotograma a resolució completa sobre un canvas **sense mirall** (RF-06), es retalla segons `config.sortida.enquadrament`: per defecte **`"visor"`**, exactament el que es veu al visor de P3 (rectangle 35:45 més gran possible centrat, `rectangleVisor`; cap, espatlles i part del polo, sense avís de retall); amb `"cap"`, el retall intel·ligent RF-07 (cap a 34/45 mm) i es reescala per passos amb `imageSmoothingQuality = 'high'` a la mida de `config.sortida.ppp` (300 → 413×531, 600 → 827×1063). El canvas de resolució completa s'allibera de seguida.
- **JPEG** (`src/captura/jfif.ts`): `toBlob('image/jpeg', config.sortida.qualitatJpeg)` i `escriuJfif` escriu un únic APP0 JFIF (unitats = 1, X = Y = ppp) i elimina els segments APP1 (EXIF/XMP).
- **Desat** (`src/captura/desar.ts`): `showSaveFilePicker` s'obre dins el clic, abans de codificar; el `FileSystemFileHandle` es guarda només en memòria per a l'esborrat opcional de P7 (RF-15). `AbortError` no mostra cap error; si no existeix o dona `SecurityError`, es baixa amb `<a download>` i P6/P7 diuen «Baixades» en lloc d'«Imatges».
- **Neteja (RF-16)**: en arribar a P7, a «Començar de nou» i a `pagehide` s'aturen les pistes, es revoquen les URL blob, es buiden els canvas i s'allibera l'estat de les fotos. Si la pàgina torna des de la memòria cau endavant/enrere (`pageshow` amb `persisted`), l'app es reinicialitza a P0. Cap ús de `localStorage`, `sessionStorage`, IndexedDB ni Cache API.
- **CSP**: sense canvis; el vídeo s'assigna amb `srcObject` i les miniatures són URL `blob:` (ja permeses).

## Distribució

Vegeu l'especificació, §10: compilar → prova manual del fitxer → publicar-lo a **una única ubicació de SharePoint/OneDrive** amb el `.sha256` → comunicar l'**enllaç** (no adjunt). Una versió nova és un fitxer nou amb la versió al nom. Cada usuari el descarrega i l'obre amb Edge (si Windows el marca com a baixat d'internet: _Propietats → Desbloqueja_). Si s'obre en una vista prèvia (Outlook, OneDrive, SharePoint) o dins un `iframe`, mostra «Descarrega aquest fitxer a l'ordinador i obre'l amb Microsoft Edge.».

## Decisions provisionals (spec §12)

Mentre no es resolguin, es fan servir els valors provisionals: D1 matrícula `^[0-9]{4,6}$`; D2 sobreescriure si el fitxer ja existeix; D5 300 ppp; D6 càmera ≥ 720p; D8 text RGPD de P0 pendent del DPD (el text actual és provisional); D9 ulleres graduades permeses; D10 sense validació matrícula ↔ usuari; D13 distribució per enllaç; D15 sense avís de versió antiga. La URL del Forms de `config.json` és un marcador (`XXXX`) fins a la Fase 5.

## Recursos gràfics

A `src/assets/brand/` (no s'han de modificar ni recolorir, §6):

- `escut_bombers_color.png` — escut de Bombers en color (manual, p. 5)
- `segell_historic_bombers.png` — segell històric (manual, p. 5)
- `AJBCN_Sign_Com_Negre_Transparent_0.svg` — signatura de l'Ajuntament en negre (capçalera)
- `AJBCN_Sign_Com_Vermell_Transparent.svg` — signatura de l'Ajuntament en vermell `#FF2828` (peu i pantalla final)

## Visió i guiatge (Fase 2)

- **Angles**: yaw/pitch/roll de la matriu de transformació facial de MediaPipe (column-major, R = Ry·Rx·Rz). Els signes es poden invertir amb `llindars.yawSigne` i `pitchSigne` (±1) si a la càmera real surten girats. Els missatges direccionals tenen en compte el mirall.
- **Marge ambre**: `llindars.margeAmbar` (0,25 per defecte): zona ambre al voltant del llindar verd.
- **Captura**: es reanalitza el fotograma complet en mode VIDEO de MediaPipe (marques de temps creixents); el mode IMAGE necessitaria models separats.
- **Rendiment del bucle** (`src/vision/pressupost.ts`, `analitzador.ts`): escalfament dels models en carregar-los; segmentació cada 3 anàlisis amb entrada de 256 px i màscara reaprofitada (a la captura, sempre i a 640 px); pressupost adaptatiu (> 50 ms de mitjana → 8 fps i segmentació més espaiada; > 150 ms sostinguts → s'atura l'anàlisi en directe amb avís i la captura manual continua). El mode diagnòstic i el JSON mostren el temps per pas.
- **Degradació** (RF-17): el segmentador és opcional (si falla, el Face Landmarker continua i fons, polo i espatlles passen a «No disponible», excloses del «Perfecte!» i de la puntuació). **Sense WebGL (ni 1 ni 2) no es carreguen els models**, perquè `@mediapipe/tasks-vision` 1.2.3 en necessita fins i tot amb el delegat CPU: P3 diu que l'anàlisi automàtica no està disponible i la captura manual funciona (retall centrat, sense puntuació).
- **Retall fora del fotograma**: s'omple de blanc, s'avisa («Massa a prop / a la vora») i es resta `sortida.penalitzacioForaFotograma` a la puntuació.
- **Prova a Edge**: `npm run prova-edge` fa dues passades: normal (`--disable-gpu`, GL per programari) i **sense WebGL** (`--disable-gpu --disable-software-rasterizer`: P3 diu «anàlisi no disponible» i la captura manual funciona); amb càmera simulada sense cara valida càrrega sota CSP, bucle (≥ 10 fps en nivell normal; si el GL per programari fa baixar el pressupost a «reduït», ≥ 6,5 fps i s'indica), «No et veiem la cara», temps per pas, confirmació, JSON sense imatge. La pestanya es porta a primer pla i s'espera que sigui visible; es descarta la primera lectura de rendiment i es fan fins a 3 mesures (totes es mostren). Flags: `--nomes-normal`, `--sense-webgl`. **Amb cara real no s'ha provat** (cap vídeo local); opcional `--video fitxer.y4m`.

## Captura automàtica, selecció i Forms (Fase 3)

- **Captura automàtica (P3)**: quan `avaluacio.totOk` és cert (els controls «No disponible» no compten) durant `captura.segonsEstableAbansCompte` (1 s) comença el compte enrere `captura.compteEnrere` (3-2-1) i es fa la foto. Si durant el compte un control passa a vermell (o es perd la cara) es cancel·la i torna a esperar; l'àmbar no cancel·la. No s'inicia sense anàlisi (sense WebGL, error o equip massa lent) ni amb el temporitzador manual actiu; qualsevol botó manual preval sobre un compte automàtic. Un cop feta la foto no es reinicia fins que es tria «Fer-ne una altra». La regió `aria-live` anuncia el compte una sola vegada (no cada segon). La config es valida en compilar (`capturaInvalida`).
- **Fotos i selecció**: fins a `maxFotos` (3), «Foto n de 3», miniatures i «Fer-ne una altra» / «Ja en tinc prou». A P4, «Triar aquesta» **allibera de seguida** les altres fotos (RF-09; en tornar enrere des de P5 només hi ha la triada) i «Repetir les fotos» les allibera totes i torna a P3.
- **P6**: modal amb les 4 instruccions (carpeta i nom reals segons on s'ha desat), «Obrir el formulari» (`window.open(url, '_blank', 'noopener')` dins el clic), enllaç alternatiu `target=_blank rel="noopener noreferrer"`, avís sense connexió i error de configuració si la plantilla no és vàlida; els avisos es veuen dins el modal.
- **P7 i RF-15**: «Esborrar la foto de l'equip» només si hi ha el handle de RF-11 amb `remove()`; demana el permís `readwrite` dins el clic; en cas d'error o permís denegat s'amaga el botó i queda el recordatori. El handle s'oblida a «Començar de nou», `pagehide` i `pageshow` persistit.
- **Prova a Edge**: ara recorre també P6 (window.open interceptat, sense navegar) i P7 (esborrat amb un handle simulat) i comprova que amb la càmera simulada sense cara la captura automàtica no es dispara. **Amb cara real no s'ha provat.**
