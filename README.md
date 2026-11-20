# Foto carnet Bombers de Barcelona

Web part de SharePoint (SPFx) perquè els bombers del SPCPEIS es facin ells mateixos la foto de carnet amb el polo de l'uniforme: captura guiada amb la càmera web, comprovació de qualitat i retall automàtic a 35 × 45 mm al navegador, desat local com a `MATRICULA.jpg` i pujada via Microsoft Forms. Cap imatge ni dada surt del navegador, excepte el que la persona usuària puja ella mateixa al formulari.

- Especificació completa: [docs/ESPECIFICACIO.md](docs/ESPECIFICACIO.md)

## Estat actual

- **Fase 0 feta, pendent de validar a SharePoint.** Inclou:
  - L'esquelet del web part `FotoCarnet` (pantalles P0–P7 amb dades simulades, màquina d'estats, identitat gràfica, panell de propietats, textos en català a `i18n/ca.json`) i els mòduls purs amb tests (configuració, matrícula/Forms, compatibilitat, neteja).
  - El web part temporal `ProvaViabilitat` (spike): càmera, MediaPipe i desat de JPEG sota la CSP de SharePoint.
- Encara **no s'ha provat dins un lloc de SharePoint real**: el que depengui de la CSP (WASM, `getUserMedia`, `showSaveFilePicker`) no es pot comprovar en local (vegeu «Riscos»).
- Fases 1–5 (captura real, visió en temps real, selecció, acabats i calibratge): pendents (§11 de l'especificació).

> **`ProvaViabilitat` s'ha d'eliminar abans de producció.** És un web part de prova (manifest, codi a `src/webparts/provaViabilitat/` i entrada a `config/config.json`); no ha d'arribar al catàleg d'aplicacions de producció.

## Requisits

- Node.js **22** (22.14 o superior) o **24** (el `package.json` també accepta 26). Cal `node` al `PATH`.
- SPFx **1.24.2** (heft, `@microsoft/spfx-web-build-rig`). No cal instal·lar `gulp` ni cap eina global.
- Edge (o Chrome) als equips que executen el web part.

## Ordres

```bash
npm install                 # instal·la dependències
npm run build               # tests + lint + paquet de producció + guarda anti-telemetria
npm start                   # servidor local (heft start) per al workbench
npx heft trust-dev-cert     # una sola vegada: confia el certificat HTTPS de desenvolupament
npm test                    # només els tests (heft test)
npm run format              # formata el codi amb Prettier
npm run format:check        # comprova el format (sense modificar)
npm run verifica-paquet     # torna a executar la guarda sobre el .sppkg existent
```

`npm run build` executa `heft test --clean --production`, `heft package-solution --production` i, al final, `node scripts/verifica-paquet.js`. Si la guarda falla, el build falla.

Per provar: `npm start` i obrir el workbench hostatjat d'un lloc de proves (`https://<tenant>.sharepoint.com/sites/<lloc>/_layouts/15/workbench.aspx`). El workbench local no reprodueix la CSP de SharePoint.

## On queda el paquet

`sharepoint/solution/foto-carnet-bombers.sppkg` (carpeta ignorada per git). Per guardar-ne còpies de prova, la carpeta local `paquets/` també està ignorada.

## Desplegament (§10 de l'especificació)

1. `npm run build` → `sharepoint/solution/foto-carnet-bombers.sppkg` (amb `includeClientSideAssets: true`: models, WASM i logos viatgen dins el paquet).
2. Pujar el `.sppkg` al catàleg d'aplicacions: del **tenant** (administrador de SharePoint, probablement l'IMI) o d'un **catàleg de lloc**.
3. Al lloc del Servei: afegir l'aplicació, crear una **pàgina moderna** (p. ex. `Foto-carnet.aspx`) amb una **secció d'amplada completa** i afegir-hi el web part «Foto carnet Bombers».
4. Configurar el web part al panell de propietats i publicar la pàgina.
5. Permisos: lectura per a tot el personal que s'hagi de fer la foto.
6. Actualitzacions: pujar un `.sppkg` nou amb la versió incrementada (`config/package-solution.json`).

El web part només admet els hosts `SharePointWebPart` i `SharePointFullPage` (no Teams) i `supportsFullBleed`.

## Configuració del web part

Configuració efectiva = **valors per defecte** (`src/webparts/fotoCarnet/config/config.default.json`) ← **JSON avançat** ← **camps del panell de propietats** (els camps explícits guanyen).

Panell de propietats:

| Camp                              | Descripció                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| URL plantilla del Forms           | URL `https` amb el marcador `{MATRICULA}`, que se substitueix per la matrícula codificada                 |
| Expressió regular de la matrícula | Per defecte `^[0-9]{4,6}$`; s'aplica com a coincidència completa                                          |
| Resolució (ppp)                   | 300 o 600                                                                                                 |
| Configuració avançada (JSON)      | Qualsevol clau de `config.default.json` (llindars, pesos de puntuació, `maxFotos`, `captura`, `sortida`…) |

Exemple de JSON avançat: `{"maxFotos": 2, "llindars": {"yawMax": 10}}`.

La configuració fusionada es **valida** contra la forma i els tipus de `config.default.json`: cada valor ha de ser del mateix tipus que el per defecte (nombres finits, cadenes), els objectes han de ser objectes, `sortida.ppp` ∈ {300, 600}, `maxFotos` és un enter d'1 a 10, la regex ha de compilar i `forms.urlPlantilla` ha de ser una cadena. Els valors invàlids es descarten (s'usa el per defecte) i les claus desconegudes s'ignoren, sempre amb un avís en català al panell de propietats. `resolConfig` no llança mai una excepció, de manera que el panell sempre s'obre. A P6 la plantilla del Forms ha de ser `https:`; si no, es mostra un missatge d'error de configuració en lloc de l'enllaç.

## Recursos: models, WASM i logos

- Els fitxers estan a `src/webparts/fotoCarnet/assets/`: `brand/` (logos, no s'han de modificar ni recolorir, §6), `models/` (`face_landmarker.task`, `selfie_segmenter.tflite`) i `wasm/` (`vision_wasm_internal.js` i `.wasm` de `@mediapipe/tasks-vision`).
- `config/spfx-customize-webpack.js` els emet com a `asset/resource`: no entren dins del bundle JS, sinó que s'empaqueten a `ClientSideAssets` i, en importar-los (`import url from '…/model.task'`), el codi n'obté la URL final dins el paquet. Així no es carrega res d'una CDN externa.
- Un test de Jest comprova que el loader i el binari WASM d'`assets/wasm/` tenen el mateix SHA-256 que els de `node_modules/@mediapipe/tasks-vision/wasm/` (cal tornar a copiar-los si es puja de versió de MediaPipe). `selfie_segmenter.tflite` s'usarà a la Fase 2.

## Telemetria de MediaPipe: parxe i guarda de build

`@mediapipe/tasks-vision@1.2.3` (`vision_bundle.mjs`/`.cjs`/`.js`) inclou una classe de _logging_ que **sempre** es construeix amb la tasca: crea un `setInterval` de 60 s i fa un `POST` a `https://odml.pa.googleapis.com/v1/log` amb una `x-goog-api-key`. L'especificació (§5) prohibeix qualsevol telemetria o petició externa, i el proxy corporatiu/CSP tampoc ho permetrien.

- **Parxe**: el loader de Webpack `config/mediapipe-sense-telemetria.js` (registrat a `config/spfx-customize-webpack.js`, `enforce: 'pre'`) reescriu el bundle en compilar: elimina l'interval, converteix `flush()` en un no-op, impedeix que la cua s'ompli i buida la cadena de la URL. S'ha triat un loader en lloc de `patch-package` perquè s'aplica sempre en compilar (no depèn que s'executi `postinstall`, com passa amb `npm ci --ignore-scripts` o en CI), cobreix les tres variants del bundle i **falla el build en alt** si el patró no es troba (per exemple en pujar de versió de MediaPipe), en lloc de deixar passar la telemetria en silenci.
- **Guarda**: `scripts/verifica-paquet.js` s'executa al final de `npm run build`, obre el `.sppkg` (zip) i falla si als fitxers de text hi troba `googleapis`, `odml.` o `google-analytics` (excepte l'identificador de tipus protobuf `type.googleapis.com/`, que no és cap petició) o qualsevol URL `http(s)://` d'un host fora de la llista permesa (documentada al mateix script: espais de noms XML/SVG, `forms.office.com` de la plantilla per defecte, etc.). El loader JS del WASM (Emscripten) només té URLs en comentaris; s'identifica per SHA-256 i s'hi comprova després d'eliminar-ne els comentaris. Els binaris (`.wasm`, `.task`) no s'inspeccionen: no poden fer xarxa pel seu compte.
- Els tests de Jest (`src/build/telemetria.test.ts`) demostren que el bundle original fa fallar la guarda i que el bundle parxejat la passa.
- El `vision_wasm_internal.js` i el WASM no contenen cap crida de xarxa pròpia: el loader només usa `fetch`/`XMLHttpRequest` per carregar el `.wasm` des de la URL del paquet que li passem.

## Riscos

- **CSP i WebAssembly (`'unsafe-eval'`)** (§5): MediaPipe compila WebAssembly. SharePoint no permet afegir `'wasm-unsafe-eval'` com a font fiable; avui la compilació de WASM funciona perquè la CSP de SharePoint inclou `'unsafe-eval'`. Si Microsoft l'elimina en el futur, MediaPipe deixaria de funcionar i el web part quedaria inservible. No es pot comprovar en local: cal validar-ho a la Fase 0 amb `ProvaViabilitat` en un lloc real (`npm start` o `.sppkg` provisional) i vigilar els canvis de la CSP de SharePoint Online.
- **Mida del paquet**: el WASM pesa 14,7 MB i el model `face_landmarker.task` 3,8 MB **sense comprimir**, a comparar amb el pressupost de ~15 MB de la §5 (càrrega inicial < 5 s). El `.sppkg` comprimit ocupa ~8 MB, però el que compta és la mida de **transferència** real des de la CDN de Microsoft 365 (que normalment serveix amb compressió i memòria cau). **Cal mesurar-la a SharePoint** (pestanya Xarxa de les eines de desenvolupador) abans d'acceptar el pressupost.
- `getUserMedia` i `showSaveFilePicker` dins el web part (no en un iframe): pendent de validar a SharePoint.

## Decisions provisionals (§12 i §14)

Mentre no hi hagi resposta es fan servir aquests valors (editables via configuració):

| #   | Pregunta                                | Valor provisional                                                            |
| --- | --------------------------------------- | ---------------------------------------------------------------------------- |
| D1  | Format de la matrícula                  | `^[0-9]{4,6}$` (coincidència completa; ha de ser segura com a nom de fitxer) |
| D2  | Si `matricula.jpg` ja existeix al destí | Sobreescriure (la biblioteca guarda l'historial de versions)                 |
| D5  | Resolució de sortida                    | 300 ppp (600 ppp disponible)                                                 |
| D6  | Webcams dels parcs                      | ≥ 720p                                                                       |
| D8  | Text RGPD de P0                         | Pendent del DPD                                                              |
| D9  | Ulleres graduades                       | Sí, sense reflexos                                                           |
| D10 | Validació matrícula ↔ usuari           | No, a la primera versió                                                      |
| D11 | Qui desplega el `.sppkg`                | A coordinar amb l'IMI                                                        |
| D12 | Pujada directa a biblioteca             | No a la v1                                                                   |

## Accessibilitat i identitat gràfica

- Botons primaris amb text blanc sobre vermell de marca (`#EB263C`, 4,31:1): només compleixen WCAG AA com a text gran, per això són de 19 px en negreta. Qualsevol **text** vermell sobre blanc usa `--bcn-vermell-text` (`#C91F33`, 5,6:1); el vermell de marca queda per a farciments i vores.
- Recursos gràfics a `src/webparts/fotoCarnet/assets/brand/`: `escut_bombers_color.png`, `segell_historic_bombers.png`, `AJBCN_Sign_Com_Negre_Transparent_0.svg` (capçalera) i `AJBCN_Sign_Com_Vermell_Transparent.svg` (peu i pantalla final). No s'han de modificar ni recolorir.

## Estil de codi

Prettier (`.prettierrc`): `npm run format` per formatar i `npm run format:check` per comprovar. TypeScript estricte, textos visibles sempre des de `i18n/ca.json`, llindars sempre a la configuració.
