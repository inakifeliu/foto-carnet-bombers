# Foto Carnet Bombers de Barcelona

Aplicació en **un únic fitxer HTML autònom** perquè els bombers del SPCPEIS es facin ells mateixos la foto de carnet amb el polo de l'uniforme: captura guiada amb webcam, retall automàtic a 35 × 45 mm, desat local com a `MATRICULA.jpg` i pujada via Microsoft Forms. El fitxer es distribueix per SharePoint, OneDrive o correu i s'obre amb doble clic a Edge, sense instal·lar res i sense connexió (només el Forms necessita xarxa).

- Especificació completa (v0.3): [docs/ESPECIFICACIO.md](docs/ESPECIFICACIO.md)
- Guió de proves manuals: [docs/GUIO-PROVES-MANUALS.md](docs/GUIO-PROVES-MANUALS.md)
- Instruccions per als bombers: [docs/INSTRUCCIONS-BOMBERS.md](docs/INSTRUCCIONS-BOMBERS.md)
- **Estat (v0.2.0)**: les Fases 0-3 estan provades al Surface i fusionades a `main`. La **Fase 4 (acabats)** és implementada a la branca `html-autonom/fase-4` i està **pendent de prova manual** amb el guió. Queden la Fase 5 (calibratge amb cares reals, Forms i flux de Power Automate, pilot).
- La branca `fase-0/viabilitat-esquelet` conté la versió anterior com a web part SPFx (v0.2 de l'especificació). És només un arxiu: no es fusiona.

## Requisits

- **Node 22 o superior** i npm (només per compilar; l'usuari final no necessita res més que Edge).
- Per provar el fitxer amb `npm run prova-edge`: Microsoft Edge instal·lat (si no és a una ubicació habitual, defineix `EDGE_PATH`).

## Scripts npm

| Ordre                | Què fa                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`        | Instal·la les dependències                                                                                                               |
| `npm run build`      | Valida `config/config.json`, compila i genera **`dist/foto-carnet-bombers-vX.Y.Z.html`** i el seu `.sha256`, i passa la guarda de xarxa  |
| `npm run verifica`   | Torna a passar la guarda sobre l'HTML ja generat a `dist/`                                                                               |
| `npm test`           | Tests (Jest + jsdom, amb `--experimental-vm-modules`; no cridis `npx jest` directament). Inclou les proves d'accessibilitat amb jest-axe |
| `npm run typecheck`  | TypeScript estricte, sense emetre                                                                                                        |
| `npm run lint`       | ESLint (configuració plana, typescript-eslint, react-hooks)                                                                              |
| `npm run format`     | Prettier (`npm run format:check` només comprova)                                                                                         |
| `npm run prova-edge` | Obre el HTML de `dist/` a Edge (perfil temporal, port lliure, càmera simulada) i recorre P0 → P7. No forma part de `npm test`            |

Abans de lliurar una versió: `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` i `npm run prova-edge` han de passar sense avisos.

## Compilació (build)

`npm run build` (`scripts/construeix.mjs`):

1. Valida `config/config.json` (vegeu «Configuració»): **qualsevol avís fa fallar la compilació**.
2. Empaqueta `src/main.tsx` amb esbuild (IIFE, React 18 de producció, CSS en mòdul), amb el pegat de telemetria de MediaPipe, els logos com a URI `data:` i la versió i la data (hora **local**) incrustades.
3. Incrusta els recursos binaris (RF-20): loader i WASM de MediaPipe i els dos models, en base64 i amb gzip si estalvia almenys el 10 %.
4. Escriu l'HTML a partir de `src/index.html`, el seu `.sha256` i passa la guarda (`scripts/verifica-html.mjs`).

La sortida és sempre a `dist/` (no es versiona). Els finals de línia del repositori són sempre LF (`.gitattributes`), de manera que el hash és el mateix compilant a qualsevol màquina amb la mateixa versió i data de compilació.

**Mida** (v0.2.0): ≈ 10,7 MB (objectiu < 12 MB). Domina el WASM (14,0 MB → 4,0 MB amb gzip → 5,3 MB en base64) i el model de cara (3,6 MB → 3,2 MB → 4,2 MB). El build en mostra el detall.

### Com s'incrusten els recursos (RF-20)

El loader i el binari WASM de MediaPipe i els dos models es llegeixen en compilar, es comprimeixen amb **gzip (nivell 9) només si estalvia almenys el 10 %**, es codifiquen en base64 i es posen a `<script type="application/octet-stream" id="recurs-NOM">` (no s'executen). Un manifest JSON (`#recursos-manifest`) diu de cada recurs el tipus MIME, si està comprimit, la mida original i el SHA-256 dels bytes originals. En execució, `src/recursos` ofereix `obteRecurs(nom)` (base64 → bytes → `DecompressionStream('gzip')` si cal) i `obteUrlBlob(nom, mime)` (URL `blob:` amb memòria cau, que s'allibera amb `revocaUrlsBlob()` i amb la neteja de memòria, RF-16). Els logos van com a URI `data:` amb els bytes originals sense modificar.

### Telemetria de MediaPipe i guarda de build

`@mediapipe/tasks-vision` inclou un registre que envia dades d'ús a `odml.pa.googleapis.com`. El pegat `scripts/mediapipe-sense-telemetria.mjs` el neutralitza en compilar (3 substitucions; **falla si el patró no es troba**, p. ex. en pujar de versió). La guarda `scripts/verifica-html.mjs` s'executa sempre al final del build sobre l'HTML final i fa fallar la compilació (i n'esborra la sortida) si hi troba:

- `googleapis` (excepte l'identificador protobuf `type.googleapis.com/`), `odml.` o `google-analytics`;
- qualsevol URL `http(s)://` fora de la llista permesa: `www.w3.org` (espais de noms XML/SVG), `reactjs.org` (text dels errors minificats de React) i el host del Forms de `config.json`;
- `<script src>`, `<link href>` o `@import` (res no pot ser extern);
- recursos incrustats que no coincideixin amb el seu SHA-256 del manifest.

A més dels patrons `http(s)://`, la guarda detecta URL `ws(s)://`, `ftp://`, protocol-relatives (`//host.tld/`) en cadenes i barres escapades; els hosts permesos es comparen **exactament** (cap subdomini). Per comprovar que la guarda funciona: `FCB_PROVA_SENSE_PEGAT=1 npm run build` desactiva el pegat i el build ha de fallar. `npm run verifica` respecta `FCB_CONFIG` (ruta alternativa de configuració) igual que el build.

### Content-Security-Policy (bloqueig de xarxa en execució)

La guarda només inspecciona text; el bloqueig real de xarxa el fa la meta `Content-Security-Policy` de `src/index.html`:

```
default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; connect-src blob:;
img-src data: blob:; style-src 'unsafe-inline'; media-src blob: mediastream:; worker-src blob:;
font-src data:; form-action 'none'; base-uri 'none'
```

Cap directiva admet `http(s):`, `ws(s):` ni `*`: qualsevol `fetch`/XHR/WebSocket/imatge externs queden bloquejats pel navegador. Cada excepció està documentada en un comentari a `src/index.html`. Obrir el Forms (`window.open` / enllaç `target=_blank`) és una navegació i no queda afectat. `frame-ancestors` no funciona en una meta i no s'hi posa (l'iframe es detecta per codi, RF-19). La guarda comprova que la meta hi és, abans de qualsevol `<script>`, que no té cap directiva ni token fora de la llista (`CSP_PERMESA`) i que `connect-src`, `default-src`, `form-action` i `base-uri` són exactament els esperats.

## Configuració

`config/config.json` s'**incrusta en compilar** (D16): per canviar-la cal editar el fitxer, incrementar la versió a `package.json`, `npm run build` i tornar a distribuir. La mateixa lògica que fa servir l'app (`resolConfig` a `src/config/configuracio.ts`) la valida contra la forma i els tipus de `src/config/config.default.json`; **la compilació falla amb qualsevol avís** (clau desconeguda, tipus incorrecte, regex invàlida, `ppp` que no sigui 300/600…), perquè no hi ha cap panell on corregir-ho en execució.

Què es pot canviar:

| Clau                                                       | Què fa                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `matriculaRegex`                                           | Format de la matrícula (coincidència completa, p. ex. `^[0-9]{4,6}$`); a més ha de ser un nom de fitxer segur                                                      |
| `maxFotos`                                                 | Fotos màximes per sessió (1-10; 3)                                                                                                                                 |
| `sortida.ppp`                                              | Resolució del JPEG: 300 (413 × 531 px) o 600 (827 × 1063 px)                                                                                                       |
| `sortida.qualitatJpeg`                                     | Qualitat del JPEG (0-1)                                                                                                                                            |
| `sortida.enquadrament`                                     | `"visor"` (per defecte: la foto és el que es veu al visor de P3) o `"cap"` (retall intel·ligent RF-07: cap = `alcadaCapMm`, marge superior `margeSuperiorMm`)      |
| `sortida.penalitzacioForaFotograma`                        | Punts que es resten a la puntuació si el retall surt del fotograma                                                                                                 |
| `forms.urlPlantilla`                                       | URL del Forms amb el marcador `{MATRICULA}` (vegeu sota)                                                                                                           |
| `captura.segonsEstableAbansCompte`, `captura.compteEnrere` | Segons amb tot verd abans del compte enrere i durada del compte (captura automàtica)                                                                               |
| `llindars.*`                                               | Llindars dels controls de qualitat (centrat, mida de la cara, angles, fons, llum, ombra, nitidesa, polo, espatlles, ulls i boca, marge ambre, signes de yaw/pitch) |
| `pesosPuntuacio.*`                                         | Pes de cada control a la puntuació de P4                                                                                                                           |

**URL del Forms** (`forms.urlPlantilla`): el build la valida amb `diagnosticaPlantilla` (`src/app/formulari.ts`, la mateixa funció que fa servir P6). Ha de ser `https:`, contenir `{MATRICULA}` i el seu host ha de ser **exactament** un de `forms.office.com`, `forms.microsoft.com` o `forms.cloud.microsoft` (comparació exacta, mai per sufix ni subdomini). Qualsevol incompliment fa fallar el build. Mentre l'URL encara porti el marcador provisional `XXXX`, el build només mostra un **AVÍS** visible i continua. Si Microsoft canvia de domini, cal ampliar `HOSTS_FORMS` (i `HOSTS_FORMS_GUARDA` a la guarda; un test comprova que coincideixen).

## Distribució i actualització (spec §10)

No cal cap permís d'administrador: n'hi ha prou amb poder pujar fitxers a una biblioteca de SharePoint o a OneDrive.

1. **Compilar**: editar `config/config.json` si cal, incrementar la versió a `package.json` i `npm run build`. Es generen `dist/foto-carnet-bombers-vX.Y.Z.html` i `dist/foto-carnet-bombers-vX.Y.Z.html.sha256`.
2. **Provar** el fitxer generat amb el [guió de proves manuals](docs/GUIO-PROVES-MANUALS.md) (doble clic a Edge, flux complet, proves de distribució).
3. **Publicar** a **una única ubicació de SharePoint/OneDrive** (font oficial) amb permís de **lectura** per al personal, junt amb el `.sha256` i el document [INSTRUCCIONS-BOMBERS.md](docs/INSTRUCCIONS-BOMBERS.md) (convertit al format que es vulgui). Treure'n (o moure a `Antigues/`) les versions anteriors.
4. **Comunicar l'enllaç** per correu o Teams, **no** com a adjunt (filtres de correu, mida, còpies antigues).

Una versió nova és un fitxer nou amb la versió al nom: es substitueix a la font oficial i es comunica. Qui tingui una còpia antiga pot comprovar la versió al peu de la pàgina (D15: no hi ha cap avís dins l'app).

**Integritat (SHA-256)**: al costat de cada HTML hi ha el seu `.sha256`. A PowerShell, des de la carpeta del fitxer:

```powershell
Get-FileHash -Algorithm SHA256 .\foto-carnet-bombers-vX.Y.Z.html
```

El valor `Hash` ha de coincidir amb el contingut de `foto-carnet-bombers-vX.Y.Z.html.sha256`.

**Per a l'usuari**: obrir l'enllaç → _Descarregar_ → doble clic (o clic dret → _Obre amb_ → Microsoft Edge). Si Windows avisa que el fitxer ve d'internet (Mark of the Web): clic dret → _Propietats_ → **Desbloqueja** → _D'acord_. Si s'obre en una vista prèvia (Outlook, OneDrive, SharePoint) o dins un `iframe`, l'app mostra «Descarrega aquest fitxer a l'ordinador i obre'l amb Microsoft Edge.».

## Calibratge amb el mode diagnòstic (Ctrl + Alt + D)

Els llindars de `config.json` són valors de partida: s'han d'ajustar amb cares reals (Fase 5) en 2-3 parcs amb llums diferents.

1. Obre el fitxer a Edge, arriba a P3 i prem **Ctrl + Alt + D** (o afegeix `#debug` a l'adreça). Apareix un panell amb versió, data i configuració, valors en directe de cada control i la **superposició** sobre el vídeo (màscara de persona, zona del tors i retall previst). Mai mostra cap imatge.
2. Per a cada control mira el valor mesurat amb la persona ben col·locada i amb situacions dolentes (fosc, llum de darrere, fons no blanc, gir del cap…) i decideix el llindar.
3. Si els missatges direccionals («Gira el cap a l'esquerra») van al revés, canvia `llindars.yawSigne` / `pitchSigne` a `-1`.
4. El botó **Descarregar JSON de diagnòstic** baixa un fitxer amb valors numèrics, versió i configuració (mai imatge ni matrícula), útil per comparar parcs.
5. «Comprovar els recursos incrustats» descodifica, descomprimeix i verifica el SHA-256 i `WebAssembly.validate`; «Provar la càrrega de MediaPipe» comprova el delegat (GPU/CPU) i el temps de càrrega.
6. Edita `config/config.json`, incrementa la versió, `npm run build` i torna a provar.

Rendiment de referència (21/11/2026, Surface, Edge 157): model carregat en 320 ms amb GPU, detecció 23 ms de mitjana, càmera 1920 × 1080 a 30 fps. **Pendent** de repetir en un equip de parc.

## Estructura del projecte

```
config/config.json            configuració que s'incrusta
docs/                         especificació, guió de proves manuals, instruccions per als bombers
scripts/construeix.mjs        esbuild + incrustació de recursos + HTML + sha256 + guarda
scripts/mediapipe-sense-telemetria.mjs   pegat de telemetria de MediaPipe
scripts/verifica-html.mjs     guarda: cap telemetria ni host extern
scripts/prova-edge.mjs        prova del fitxer final a Edge (CDP, perfil temporal)
src/index.html                plantilla (CSP, missatge estàtic i <noscript>, RF-19)
src/main.tsx, arrenca.tsx     arrencada (detecció d'iframe, RF-19)
src/app                       màquina d'estats, context, formulari (matrícula i URL del Forms), mode diagnòstic
src/screens                   pantalles P0–P7, NoCompatible i ContextIncorrecte
src/components                capçalera, peu, botons, modal, títol, il·lustracions de P1, semàfors, silueta…
src/a11y                      proves d'accessibilitat (jest-axe)
src/styles                    brand.module.css (variables de §6) i el test de contrast
src/captura                   càmera (RF-01), retall (RF-07), JFIF (RF-08), desat (RF-11), fotos en memòria
src/vision                    MediaPipe, mètriques, avaluació dels controls (RF-05), diagnòstic
src/recursos                  descodificació dels recursos incrustats (RF-20)
src/i18n/ca.json              tots els textos (català)
src/assets                    brand/ (logos), models/, wasm/
```

## Funcionament (resum)

- **Càmera** (`src/captura/camera.ts`, `useCamera.ts`): `getUserMedia` amb 1920 × 1080 ideal; selector si hi ha diverses càmeres; errors en català (permís denegat, cap càmera, càmera ocupada, genèric) amb «Tornar a provar»; avís no bloquejant si la resolució real és < 1280 × 720. El mirall és només CSS a la visualització: la foto no és invertida (RF-06).
- **Visió i guiatge** (Fase 2): angles yaw/pitch/roll de la matriu facial de MediaPipe (els signes es poden invertir amb `llindars.yawSigne`/`pitchSigne`); semàfors i un missatge principal alhora; zona ambre al voltant del llindar (`margeAmbar`). Rendiment: segmentació cada 3 anàlisis a 256 px, pressupost adaptatiu (> 50 ms → 8 fps; > 150 ms sostinguts → s'atura l'anàlisi en directe amb avís i la captura manual continua).
- **Degradació** (RF-17): el segmentador és opcional; **sense WebGL no es carreguen els models** (`@mediapipe/tasks-vision` 1.2.3 en necessita fins i tot amb CPU): P3 diu que l'anàlisi automàtica no està disponible i la captura manual funciona (retall centrat, sense puntuació).
- **Captura automàtica** (Fase 3): tot verd durant `segonsEstableAbansCompte` → compte enrere → foto; es cancel·la si un control passa a vermell; només amb anàlisi fresca i pàgina visible. L'anunci per a lectors de pantalla només canvia quan canvia el missatge prioritari (estabilitzat) i el compte enrere s'anuncia una sola vegada.
- **JPEG i desat**: `toBlob('image/jpeg')` + un únic APP0 JFIF (unitats = 1, X = Y = ppp) sense EXIF/XMP (`src/captura/jfif.ts`); `showSaveFilePicker` s'obre dins el clic (Imatges); si no existeix, baixada amb `<a download>` i els textos diuen «Baixades».
- **Fotos i selecció**: fins a `maxFotos`; a P4 «Triar aquesta» allibera de seguida les altres (RF-09).
- **P6 i P7**: modal amb les instruccions, `window.open(url, '_blank', 'noopener')` dins el clic, enllaç alternatiu i avís sense connexió; P7 amb l'esborrat opcional (RF-15, només si el navegador dona el handle i el permís).
- **Neteja (RF-16)**: a P7, a «Començar de nou» i a `pagehide` s'aturen les pistes, es revoquen les URL blob, es buiden els canvas i es lliuren les fotos. Cap ús de `localStorage`, `sessionStorage`, IndexedDB ni Cache API.

## Identitat gràfica i accessibilitat (Fase 4)

- Només es fan servir els fitxers de `src/assets/brand/` (no s'han de modificar ni recolorir, §6): `escut_bombers_color.png`, `segell_historic_bombers.png`, `AJBCN_Sign_Com_Negre_Transparent_0.svg` i `AJBCN_Sign_Com_Vermell_Transparent.svg`. Capçalera: signatura negra a l'esquerra i escut a la dreta; P0 amb escut i segell; P7 amb segell; peu amb signatura vermella, text del Servei, versió i data. Mai el logo amb el telèfon 080 ni la versió en blanc i negre de l'escut.
- Tots els colors són variables de `src/styles/brand.module.css` (`.arrel`); un test impedeix escriure colors fora de les variables i comprova el contrast AA de cada parella (`src/styles/contrast.test.ts`). Text blanc sobre `--bcn-vermell` només en botons de 19 px en negreta; el groc mai és text.
- Cada pantalla té una sola `h1` (`components/Titol.tsx`, `tabIndex={-1}`) que rep el focus en canviar de pantalla; focus visible a tots els controls; modals amb `role="dialog"`, `aria-modal`, trampa de focus i Escape; `lang="ca"`; `prefers-reduced-motion`; adaptable fins a ~360 px.
- `jest-axe` (només de desenvolupament, cap dependència en temps d'execució) comprova cada pantalla a `src/a11y/accessibilitat.test.tsx`.
- Les il·lustracions de P1 són SVG propis en components React (`components/IconesInstruccions.tsx`), decoratives.
- Els textos són a `src/i18n/ca.json`. Els apòstrofs són rectes (`'`) a tot arreu, com al text del peu fixat per l'usuari.

## Decisions provisionals (spec §12)

Mentre no es resolguin, es fan servir els valors provisionals:

- D1 matrícula `^[0-9]{4,6}$`.
- D2 sobreescriure si el fitxer ja existeix.
- D5 300 ppp (requisits de RRHH pendents).
- D6 càmera ≥ 720p.
- D8 **text de privacitat (RGPD) de P0**: la redacció actual (`p0.privacitat` a `src/i18n/ca.json`) és provisional i **està pendent de validar amb el DPD** de l'Ajuntament (finalitat, destí, conservació).
- D9 ulleres graduades permeses.
- D10 sense validació matrícula ↔ usuari.
- D13 distribució per enllaç; adjunt només si les proves de distribució ho confirmen.
- D14 ubicació de la font oficial pendent.
- D15 sense avís de versió antiga.

La URL del Forms de `config/config.json` ja és la real (pre-omplerta amb `{MATRICULA}`); el flux de Power Automate (§9) i el calibratge amb cares reals són de la Fase 5.
