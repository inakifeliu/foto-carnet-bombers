# Especificació — Foto Carnet Bombers de Barcelona

> Versió 0.2 · Esborrany · 20/11/2026
> Canvis v0.2: allotjament a SharePoint com a web part SPFx (D3), destí final a SharePoint (D4), identitat gràfica definida (D7).
> Document de referència per implementar l'aplicació amb Claude Code, fase a fase.
> Idioma de tota la interfície: **català**.

---

## 0. Context i objectiu

Els bombers de Barcelona (SPCPEIS) han de lliurar una **foto tipus carnet amb el polo de l'uniforme**. L'objectiu és que cada bomber se la pugui fer **ell mateix** des d'un ordinador corporatiu amb webcam, amb una aplicació que:

1. Li expliqui com s'ha de preparar.
2. El guiï en temps real (posició, distància, llum, fons) a l'estil de les apps KYC.
3. Li permeti fer fins a 3 fotos i triar la millor.
4. Retalli automàticament la foto al format oficial **35 × 45 mm**.
5. La desi a l'equip com a `MATRICULA.jpg` a la carpeta **Imatges**.
6. Obri un **Microsoft Forms** (amb la matrícula ja escrita) on el bomber puja la foto, identificat amb el seu usuari de Microsoft 365.

Després, un flux de **Power Automate** reanomena el fitxer i el deixa a la carpeta destí.

---

## 1. Abast

### Inclou
- **Web part de SharePoint (SPFx)** inserit en una pàgina moderna d'un lloc de SharePoint de l'organització, **sense backend**.
  - Motiu: SharePoint Online no mostra fitxers `.html` pujats a una biblioteca com a pàgines web (els descarrega), així que una web estàtica normal no hi pot viure. La via suportada és un web part SPFx.
- Instruccions inicials, captura guiada amb validacions automàtiques, selecció de la millor foto, retall, desat local i obertura del Forms.
- Especificació del Forms i del flux de Power Automate (configuració *no-code*, fora del repositori de codi).

### No inclou
- Validar si porta les galetes (categoria i nom). Només es demana a les **instruccions**.
- Validar si la matrícula existeix o correspon a la persona (es pot fer després, a Power Automate).
- Escriure al NAS (el destí és SharePoint).
- Ús des de mòbils o des de fora de la xarxa corporativa.

---

## 2. Usuaris i entorn

| Aspecte | Valor |
|---|---|
| Usuari | Bomber/a del SPCPEIS, sense coneixements tècnics |
| Equip | Ordinador corporatiu de l'Ajuntament (Windows) |
| Navegador objectiu | **Microsoft Edge** (Chromium) actual. Chrome també compatible. Firefox: degradat (vegeu RF-17) |
| Càmera | Webcam integrada o USB. Mínim 1280×720 recomanat |
| Allotjament | Pàgina d'un **lloc de SharePoint Online** (HTTPS inclòs). L'usuari hi entra amb el seu compte de Microsoft 365 |
| Instal·lació | Cap per a l'usuari. Només obrir la pàgina de SharePoint. El paquet SPFx l'ha de desplegar un administrador al catàleg d'aplicacions |

---

## 3. Flux d'usuari (pantalles)

```
P0 Benvinguda → P1 Instruccions → P2 Matrícula → P3 Captura guiada (×3 màx.)
   → P4 Selecció → P5 Desar → P6 Pujar al Forms → P7 Final
```

### P0 — Benvinguda
- Capçalera amb identitat gràfica de Bombers de Barcelona.
- Títol: "Foto de carnet amb uniforme".
- Text breu: què farem, quant triga (~3 min), que la foto **no s'envia enlloc** fins que la pugi ell mateix al formulari.
- Botó **"Començar"**.

### P1 — Instruccions
Llista il·lustrada (icona + text curt). Totes s'han de llegir; botó "Entesos, continuar" al final.

1. **Fons blanc i llis** darrere teu (paret blanca, sense quadres ni portes).
2. **Bona llum de cara**. Evita finestres o llums darrere teu.
3. **Polo blau de l'uniforme**, net i ben posat.
4. **Galeta de la categoria laboral** i **galeta amb el nom** cosides i visibles.
5. **Sense gorra, casc ni ulleres de sol**. Si portes ulleres graduades, evita reflexos.
6. **Cara descoberta**, cabells que no tapin els ulls.
7. **Mirada a la càmera**, expressió neutra, boca tancada.
8. **Espatlles rectes**, assegut/da a una distància d'un braç de la pantalla.
9. Si pots, demana a un company que comprovi l'enquadrament.

### P2 — Matrícula
- Camp únic: **Matrícula**.
- Validació amb expressió regular configurable (`config.matriculaRegex`). Missatge d'error clar.
- Confirmació: "La teva matrícula és **12345**? Serà el nom de la foto."
- Botó "Continuar". En prémer-lo, es demana permís de càmera.

### P3 — Captura guiada
- Vídeo de la webcam en mode **mirall** (només visualització; la foto final **no** es desa invertida).
- Superposició: **silueta guia** (oval per a la cara + línia d'espatlles).
- Panell de **semàfors** (vegeu RF-05): cada control en verd/àmbar/vermell amb un missatge d'acció curt ("Apropa't una mica", "Gira el cap a l'esquerra", "Massa fosc", "El fons no és blanc", "No es detecta el polo blau").
- Missatge principal gran amb **una sola indicació alhora** (la de més prioritat).
- Quan **tots els controls són verds durant ≥ 1 s seguit** → compte enrere **3-2-1** i captura automàtica.
  - Si durant el compte enrere algun control passa a vermell, es cancel·la.
- Botó secundari **"Fer la foto ara"** (captura manual), visible sempre. Si hi ha controls no verds, avisa: "Hi ha aspectes a millorar. Vols fer-la igualment?".
- Comptador "Foto 1 de 3". Després de cada captura: miniatura + "Fer-ne una altra" / "Ja en tinc prou".
- Màxim **3 fotos** (`config.maxFotos`).

### P4 — Selecció
- Les fotos capturades, **ja retallades a 35×45**, una al costat de l'altra.
- Cada foto amb la seva **puntuació de qualitat** (0-100) i els avisos que tenia.
- La de puntuació més alta ve preseleccionada.
- Botons: "Triar aquesta" / "Repetir les fotos".

### P5 — Desar
- Vista prèvia gran de la foto triada i el nom del fitxer: `12345.jpg`.
- Botó **"Desar la foto"** → obre el diàleg de Windows:
  - Nom suggerit: `{matricula}.jpg`
  - Carpeta inicial: **Imatges**
- Si l'usuari cancel·la el diàleg, es queda a P5 i pot tornar-ho a provar.
- En desar correctament → P6.

### P6 — Pujar al Forms
- Pop-up modal amb les instruccions (amb captures o icones):
  1. "S'obrirà el formulari en una pestanya nova, amb la teva matrícula ja escrita."
  2. "Clica **Penja el fitxer**."
  3. "Ves a la carpeta **Imatges** i tria **12345.jpg**."
  4. "Clica **Envia**."
- Botó **"Obrir el formulari"** → `window.open(urlForms, '_blank', 'noopener')` (cal que sigui en resposta al clic, per evitar el bloqueig de finestres emergents).
- Enllaç alternatiu visible "Si no s'ha obert, clica aquí".
- Botó "Ja l'he enviat" → P7.

### P7 — Final
- Missatge d'agraïment.
- Recordatori: "Un cop enviada, pots esborrar la foto de la carpeta Imatges."
- Botó **"Esborrar la foto de l'equip"** si el navegador ho permet (RF-15). Si no, es mostra només el recordatori.
- Botó "Començar de nou" (neteja tot i torna a P0).
- **Neteja automàtica de memòria** (RF-16).

---

## 4. Requisits funcionals

### RF-01 Càmera
- `getUserMedia` amb `video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' }`.
- Si l'equip té diverses càmeres, selector desplegable.
- Gestió d'errors en català: permís denegat, cap càmera, càmera ocupada per una altra aplicació (Teams…).
- Si la resolució real és < 1280×720, avís no bloquejant.

### RF-02 Detecció de cara
- **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`), mode VIDEO, 1 cara, amb *blendshapes* i matriu de transformació facial.
- Si hi ha 0 cares → "No et veiem la cara". Si n'hi ha > 1 → "Només hi ha de sortir una persona" (configurar `numFaces: 2` per poder-ho detectar).

### RF-03 Segmentació persona/fons
- **MediaPipe Image Segmenter** (model *selfie segmenter* o *selfie multiclass*).
- La màscara serveix per a: anàlisi del fons (RF-05.6) i estimació de la part superior del cap (RF-07).

### RF-04 Freqüència d'anàlisi
- Anàlisi a ~10-15 fps (no cal a cada fotograma). Suavitzat dels valors amb mitjana mòbil de ~0,5 s per evitar parpelleig dels semàfors.

### RF-05 Controls de qualitat en temps real
Tots els llindars són **configurables** a `config.json` i s'han de **calibrar** amb fotos reals (vegeu RF-18, mode diagnòstic).

| # | Control | Mètode | Llindar inicial (a calibrar) | Missatge si falla |
|---|---|---|---|---|
| 5.1 | Una sola cara | Face Landmarker | exactament 1 | "Només hi ha de sortir una persona" |
| 5.2 | Centrat horitzontal | centre de la cara vs centre del frame | desviació ≤ 8% de l'amplada | "Mou-te a l'esquerra / dreta" |
| 5.3 | Distància | alçada cara (front–barbeta) / alçada frame | entre 0,30 i 0,45 | "Apropa't" / "Allunya't" |
| 5.4 | Orientació del cap | angles de la matriu facial | gir (yaw) ≤ 8°, cabotada (pitch) ≤ 8°, inclinació (roll) ≤ 5° | "Gira el cap…", "Aixeca / abaixa la barbeta", "Posa el cap recte" |
| 5.5 | Ulls oberts i boca tancada | blendshapes `eyeBlinkLeft/Right`, `jawOpen` | parpelleig < 0,4; jawOpen < 0,15 | "Obre bé els ulls" / "Tanca la boca" |
| 5.6 | Fons blanc | píxels de fons (màscara) en la zona que quedarà dins el retall | ≥ 85% de píxels amb luminància > 190/255 i saturació < 0,15 | "El fons no és prou blanc" |
| 5.7 | Il·luminació | luminància mitjana de la cara | entre 100 i 210 /255 | "Massa fosc" / "Massa llum" |
| 5.8 | Ombres | diferència de luminància meitat esquerra vs dreta de la cara | ≤ 25% | "Tens una ombra a un costat de la cara" |
| 5.9 | Nitidesa | variància del Laplacià sobre la cara (escala de grisos) | > valor a calibrar | "Queda't quiet/a" |
| 5.10 | Polo blau | zona del tors sota la barbeta (rectangle d'amplada ≈ 1,6× la cara), píxels de persona | ≥ 50% de píxels amb to 200°–250°, saturació > 0,25, valor 0,08–0,65 | "No es detecta el polo blau de l'uniforme" |
| 5.11 | Espatlles dins el retall | la zona del tors és visible i no tallada pel límit inferior del frame | — | "Allunya't una mica, no es veuen les espatlles" |

- **Prioritat dels missatges** (es mostra el primer que falla): 5.1 → 5.3 → 5.2 → 5.4 → 5.7 → 5.6 → 5.8 → 5.10 → 5.11 → 5.5 → 5.9.
- **Puntuació de qualitat** (0-100): mitjana ponderada de la "distància al llindar" de cada control, calculada sobre el fotograma capturat. Pesos a `config.json`.

### RF-06 Captura
- La captura es fa a **resolució completa de la càmera** sobre un canvas, **sense efecte mirall**.
- Sobre aquest fotograma es tornen a calcular tots els controls (no s'aprofiten els del vídeo) i es guarda la puntuació.

### RF-07 Retall al format oficial
- Proporció **35:45** (amplada:alçada).
- Mida de sortida per defecte: **413 × 531 px** (300 ppp). Configurable (`config.sortida.ppp`: 300 o 600 → 827 × 1063 px).
- Enquadrament (referència normes DNI/OACI, configurable):
  - **Alçada del cap** (barbeta → part superior del cap): **34 mm** dels 45 (≈ 75% de l'alçada).
  - **Marge superior** (part superior del cap → límit superior): **4 mm**.
  - Cara **centrada horitzontalment**.
- La **part superior del cap** s'estima amb la màscara de segmentació (primer píxel de persona per sobre del front a la columna central de la cara); si no és fiable, com a front (landmark 10) + 0,25 × l'alçada front–barbeta.
- La **barbeta** és el landmark 152.
- Si el retall necessita píxels fora del fotograma, la foto es marca amb avís "Massa a prop / a la vora" i rep una penalització a la puntuació.
- **No** es modifica el fons ni s'aplica cap retoc a la cara. Només retall i reescalat (interpolació d'alta qualitat).

### RF-08 Codificació JPEG
- `canvas.toBlob('image/jpeg', 0.92)`.
- **Escriure la densitat a la capçalera JFIF** (APP0): unitats = 1 (ppp), X = Y = `ppp` configurat, perquè s'imprimeixi a 35 × 45 mm. Implementar una funció petita que modifiqui els bytes de la capçalera, o la insereixi si no hi és.
- Sense metadades EXIF (cap dada de l'equip ni de geolocalització).
- Mida orientativa: < 300 KB.

### RF-09 Selecció
- Segons P4. La foto triada és l'única que es manté. Les altres s'alliberen immediatament (RF-16).

### RF-10 Nom del fitxer
- `{matricula}.jpg`, exactament el text validat a P2, sense espais.

### RF-11 Desar a l'equip
- Si `window.showSaveFilePicker` existeix:
  ```js
  showSaveFilePicker({
    suggestedName: `${matricula}.jpg`,
    startIn: 'pictures',
    types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }],
  })
  ```
  Escriure el blob amb `createWritable()`. **Guardar el `FileSystemFileHandle` en memòria** per a RF-15.
- Si no existeix (Firefox), alternativa amb `<a download="{matricula}.jpg">` (anirà a Baixades). En aquest cas, el text de P6 ha de dir "carpeta **Baixades**" en lloc d'"Imatges".
- `AbortError` (l'usuari cancel·la el diàleg) → es queda a P5 sense mostrar cap error.

### RF-12 URL del Forms pre-omplerta
- `config.forms.urlPlantilla` conté l'URL obtinguda a Forms amb "Obtenir l'URL emplenada prèviament", amb el valor de mostra substituït pel marcador `{MATRICULA}`.
- L'app substitueix el marcador per `encodeURIComponent(matricula)`.

### RF-13 Obertura del Forms
- Segons P6. Sempre en resposta directa a un clic.

### RF-14 Textos configurables
- Tots els textos de la interfície en un fitxer `src/i18n/ca.json` (només català, però centralitzat per poder-los revisar fàcilment).

### RF-15 Esborrar la foto de l'equip (opcional, millor esforç)
- Si hi ha el *handle* de RF-11 i el navegador implementa `FileSystemFileHandle.remove()`, mostrar el botó a P7. Demanar permís `readwrite` si cal.
- Si falla o no hi és, amagar el botó i mostrar només el recordatori.

### RF-16 Neteja de memòria
En finalitzar (P7), en "Començar de nou" i en tancar la pestanya (`pagehide`):
- Aturar totes les pistes de la càmera (`track.stop()`).
- `URL.revokeObjectURL()` de totes les miniatures.
- Buidar els canvas (amplada i alçada a 0) i eliminar les referències a blobs i ImageData.
- Tancar els models de MediaPipe (`close()`).
- Cap ús de `localStorage`, `sessionStorage`, IndexedDB ni Cache API per a imatges o matrícules.

### RF-17 Compatibilitat
- Detecció de funcionalitats a l'inici: `getUserMedia`, WebAssembly, WebGL2 (si no hi és, MediaPipe en CPU).
- Si falta alguna cosa imprescindible → pantalla "Aquest navegador no és compatible. Obre l'aplicació amb Microsoft Edge."

### RF-18 Mode diagnòstic (per calibrar)
- Activat amb `?debug=1`.
- Mostra en directe els valors numèrics de tots els controls de RF-05, la màscara de segmentació, la zona del tors analitzada i el rectangle de retall previst.
- Botó per descarregar un JSON amb els valors del moment (per ajustar llindars). **Mai** la imatge.

---

## 5. Requisits no funcionals

### Privacitat (RGPD)
- **Cap imatge ni matrícula surt del navegador** cap a cap servidor. L'únic enviament és el que fa l'usuari al Forms.
- Cap telemetria, analítica ni crida a CDN externes en temps d'execució.
- Text informatiu a P0 sobre el tractament (finalitat, destí, conservació). **Redacció a validar amb el DPD** de l'Ajuntament.

### Seguretat (context SharePoint)
- L'HTTPS i les capçaleres HTTP les controla SharePoint, no nosaltres.
- **Content Security Policy de SharePoint Online**: des de març de 2026 SharePoint bloqueja scripts de fonts no fiables i els scripts *inline*. Per tant:
  - Cap script *inline*, cap `eval`, cap `innerHTML` amb `<script>`.
  - Tots els scripts (inclòs el *loader* JS de MediaPipe) s'han de servir **des del mateix paquet SPFx** (biblioteca *ClientSideAssets* / CDN de Microsoft 365 del tenant), que SharePoint considera font fiable.
  - **Risc a validar a la Fase 0**: MediaPipe compila **WebAssembly**. SharePoint no permet afegir `'wasm-unsafe-eval'` com a font fiable. Avui la compilació de WASM funciona perquè la CSP de SharePoint inclou `'unsafe-eval'`, però si Microsoft l'elimina en el futur, MediaPipe deixaria de funcionar. Cal tenir-ho present i documentar-ho al README.
- **Permís de càmera**: validar a la Fase 0 que la pàgina de SharePoint permet `getUserMedia` dins el web part i `showSaveFilePicker` (el web part s'executa al DOM de la pàgina, no en un iframe).

### Recursos locals
- Els fitxers **WASM de MediaPipe** i els **models** (`.task` / `.tflite`) s'empaqueten com a recursos del paquet SPFx (`includeClientSideAssets: true`). Res de CDN externes: la CSP i el proxy corporatiu ho bloquejarien.

### Rendiment
- Càrrega inicial < 5 s dins SharePoint (models inclosos, < ~15 MB).
- Vídeo fluid (≥ 24 fps de visualització). Anàlisi a ≥ 10 fps en un equip corporatiu estàndard.
- Si l'anàlisi va lenta, reduir la resolució d'entrada als models (p. ex. 640 px d'amplada).

### Accessibilitat i usabilitat
- Contrast AA, mida de lletra gran als missatges de guia, navegació amb teclat, `aria-live` per als missatges de guia.
- Missatges en positiu i d'acció ("Apropa't"), mai tècnics.

---

## 6. Identitat gràfica

Font: manual *Identitat visual dels Bombers de Barcelona*, apartat 9.1 (pàgina 5), i normativa gràfica de l'Ajuntament de Barcelona.

### Recursos gràfics (carpeta `src/assets/brand/`)

| Fitxer | Origen | Ús |
|---|---|---|
| `escut_bombers_color.png` | Manual p. 5, "Versió en color" (extret, fons transparent, 1004×1003 px) | Capçalera (dreta) i pantalla de benvinguda P0 |
| `segell_historic_bombers.png` | Manual p. 5, "Segell històric" (extret, fons transparent, 472×537 px) | P0 (al costat de l'escut en color) i P7 |
| `AJBCN_Sign_Com_Negre_Transparent_0.svg` | https://ajuntament.barcelona.cat/normativagrafica/sites/default/files/2025-12/AJBCN_Sign_Com_Negre_Transparent_0.svg | Capçalera sobre fons blanc (esquerra) |
| `AJBCN_Sign_Com_Vermell_Transparent.svg` | https://ajuntament.barcelona.cat/normativagrafica/sites/default/files/2025-12/AJBCN_Sign_Com_Vermell_Transparent.svg | Peu de pàgina i pantalla final |

Regles:
- **No fer servir cap logo amb el telèfon 080** (manual, apartat 9.2).
- **No fer servir la versió en blanc i negre** de l'escut de Bombers.
- No deformar, retallar, recolorir ni recrear cap logo. Respectar un espai de protecció al voltant (com a mínim el 10% de la mida del logo).
- Els dos SVG de l'Ajuntament s'han de **descarregar manualment** de les URL de la taula i afegir al repositori (no es carreguen en temps d'execució).

### Colors
Referències Pantone del manual; els valors de pantalla són els mostrejats de l'escut del manual en PDF.

```css
:root {
  --bcn-vermell: #EB263C;   /* Pantone 485C (vermell Bombers) */
  --bcn-groc:    #FCB438;   /* Pantone 123C (groc Bombers) */
  --bcn-negre:   #000000;
  --bcn-blanc:   #FFFFFF;
  --color-text:  #1A1A1A;
  --color-fons:  #FFFFFF;
  --color-gris-suau: #F2F2F2;
  /* Estats dels semàfors (funcionals, no de marca) */
  --color-ok:    #1E8E3E;
  --color-avis:  #F29900;
  --color-error: #B3261E;   /* diferent del vermell de marca per no confondre */
}
```
- El **vermell** és el color principal (botons primaris, capçalera, accents). El **groc** només com a accent puntual (mai text groc sobre blanc: no compleix contrast).
- Text blanc sobre `--bcn-vermell` per als botons primaris (verificar contrast AA amb lletra ≥ 18 px en negreta).

### Tipografia
- Tipografia corporativa: **ITC Franklin Gothic Std** (amb llicència; no es pot incloure com a font web sense llicència web).
- Pila de fonts: `"ITC Franklin Gothic Std", "Franklin Gothic Medium", "Franklin Gothic", Arial, sans-serif`. *Franklin Gothic Medium* ve instal·lada a Windows, així que als equips corporatius es veurà coherent sense carregar cap font.

### Estil
- Sobri i institucional. Fons blanc, molt d'espai, capçalera amb la signatura de l'Ajuntament a l'esquerra i l'escut de Bombers a la dreta.
- Pensat per a pantalla d'escriptori (≥ 1280 px). Com que és un web part, ha d'ocupar la **secció d'amplada completa** de la pàgina de SharePoint i adaptar-se a l'amplada que tingui.

---

## 7. Arquitectura i stack

| Capa | Tecnologia |
|---|---|
| Plataforma | **SharePoint Framework (SPFx)**, última versió estable, web part client-side. Toolchain oficial de SPFx (no Vite) |
| Llenguatge | **TypeScript** estricte |
| UI | **React** (la versió que suporti SPFx; components funcionals, *hooks*). Sense Fluent UI obligatori: estil propi de marca |
| Estat | `useReducer` + context (màquina d'estats de pantalles P0–P7). Sense llibreries externes d'estat |
| Visió | `@mediapipe/tasks-vision` (Face Landmarker + Image Segmenter) |
| Processament d'imatge | Canvas 2D + funcions pròpies (luminància, HSV, Laplacià). **Sense OpenCV.js** (massa pes) |
| Fitxers | File System Access API (`showSaveFilePicker`) amb alternativa `<a download>` |
| Configuració | `config.json` per defecte dins el paquet + **panell de propietats del web part** (URL del Forms, regex de matrícula, ppp i un camp "Configuració avançada (JSON)" per als llindars). El propietari del lloc ho pot canviar sense recompilar |
| Tests | **Jest** (el que porta SPFx) per a les funcions pures: retall, JFIF, càlculs de color i llum. Proves E2E manuals al *workbench* hostatjat de SharePoint |
| Lint/format | ESLint (config SPFx) + Prettier |
| Distribució | Paquet `.sppkg` al **catàleg d'aplicacions** (del tenant o del lloc) i web part afegit a una pàgina moderna del lloc |

### Estructura de carpetes proposada
```
foto-carnet-bombers/              # solució SPFx (yo @microsoft/sharepoint)
├─ config/                        # package-solution.json (includeClientSideAssets: true)
├─ src/webparts/fotoCarnet/
│  ├─ FotoCarnetWebPart.ts        # entrada del web part + panell de propietats
│  ├─ app/                        # màquina d'estats, App.tsx
│  ├─ screens/                    # P0Benvinguda … P7Final
│  ├─ components/                 # Capcalera, Semafor, SiluetaGuia, Miniatura, Modal…
│  ├─ vision/                     # carregar models, bucle d'anàlisi, controls RF-05
│  ├─ image/                      # retall RF-07, jpeg+JFIF RF-08, mètriques
│  ├─ fs/                         # desar RF-11, esborrar RF-15
│  ├─ i18n/ca.json
│  ├─ config/config.default.json
│  ├─ styles/brand.module.scss
│  └─ assets/
│     ├─ brand/                   # escuts i signatures (§6)
│     ├─ models/                  # face_landmarker.task, selfie_segmenter.tflite
│     └─ wasm/                    # fitxers WASM i loader de MediaPipe
├─ tests/
└─ README.md                      # build, desplegament, calibratge i riscos CSP
```
- Els fitxers de `models/` i `wasm/` s'han de copiar tal qual al paquet (configurar la còpia d'actius a la toolchain de SPFx) i resoldre la seva URL en temps d'execució a partir de la ubicació dels recursos del web part.

### `config.json` (exemple)
```json
{
  "matriculaRegex": "^[0-9]{4,6}$",
  "maxFotos": 3,
  "sortida": { "ppp": 300, "qualitatJpeg": 0.92,
               "alcadaCapMm": 34, "margeSuperiorMm": 4 },
  "forms": { "urlPlantilla": "https://forms.office.com/Pages/ResponsePage.aspx?id=XXXX&rYYYY={MATRICULA}" },
  "captura": { "segonsEstableAbansCompte": 1, "compteEnrere": 3 },
  "llindars": {
    "centratMax": 0.08, "alcadaCaraMin": 0.30, "alcadaCaraMax": 0.45,
    "yawMax": 8, "pitchMax": 8, "rollMax": 5,
    "parpelleigMax": 0.4, "bocaObertaMax": 0.15,
    "fonsBlancMin": 0.85, "fonsLumMin": 190, "fonsSatMax": 0.15,
    "llumCaraMin": 100, "llumCaraMax": 210, "ombraMax": 0.25,
    "nitidesaMin": 100,
    "poloHueMin": 200, "poloHueMax": 250, "poloSatMin": 0.25,
    "poloValMin": 0.08, "poloValMax": 0.65, "poloProporcioMin": 0.5
  },
  "pesosPuntuacio": { "orientacio": 2, "fons": 2, "llum": 2, "ombra": 1,
                      "nitidesa": 2, "polo": 1, "centrat": 1, "distancia": 1 }
}
```

---

## 8. Microsoft Forms (configuració manual)

- **Tipus**: formulari **de grup** (equip/grup de Microsoft 365 del Servei), perquè els fitxers vagin a SharePoint i no al OneDrive d'una persona.
- **Qui pot respondre**: només persones de l'organització (requisit per a la pujada de fitxers), **registrant el nom**.
- **Preguntes**:
  1. **Matrícula** (text, obligatòria). Restricció numèrica si el format ho permet.
  2. **Foto carnet** (pujada de fitxers, obligatòria): 1 fitxer, tipus *Imatge*, mida màxima 10 MB.
- **Activar respostes pre-emplenades**. Obtenir l'URL amb un valor de mostra a la matrícula i substituir-lo per `{MATRICULA}` a `config.json`.
- Missatge d'agraïment personalitzat: "Foto rebuda. Ja pots esborrar-la de la carpeta Imatges."

---

## 9. Flux de Power Automate (configuració manual)

**Nom**: `FotoCarnet - Reanomenar i arxivar`

1. **Disparador**: *Quan s'envia una resposta nova* (formulari de §8).
2. **Obtenir els detalls de la resposta** → matrícula, correu de qui respon, fitxer.
3. **Analitzar JSON** del camp del fitxer (és una matriu; agafar el primer element: nom, enllaç, id).
4. **Obtenir el contingut del fitxer** (SharePoint, per id o camí).
5. *(Opcional)* **Validar** la matrícula: format, o consulta a una llista de SharePoint `Matricula ↔ Correu`. Si no quadra → correu d'avís al gestor i aturar.
6. **Crear el fitxer** a la carpeta destí amb nom `{matricula}.jpg`.
   - Si ja existeix: **sobreescriure** *(decisió pendent; vegeu §12)*.
7. **Esborrar l'original** de la carpeta de Forms (que porta el nom de l'usuari afegit).
8. *(Opcional)* Afegir una fila a una llista de registre: matrícula, correu, data i hora.

**Destí (decidit, D4)**: una **biblioteca de documents de SharePoint** del lloc del Servei, per exemple `Fotos carnet`.
- Permisos: només lectura/edició per al personal gestor. Els bombers **no** hi tenen accés (pugen via Forms, i el flux s'executa amb el compte del propietari del flux).
- Recomanat: fer servir el mateix lloc de SharePoint on hi ha la pàgina de l'aplicació, i que el Forms sigui un formulari del grup de Microsoft 365 associat a aquest lloc.

---

## 10. Desplegament

1. Build de producció amb la toolchain de SPFx → paquet `foto-carnet-bombers.sppkg` (amb `includeClientSideAssets: true`, perquè els models, el WASM i els logos viatgin dins el paquet).
2. Pujar el `.sppkg` al **catàleg d'aplicacions**:
   - del **tenant** (ho ha de fer un administrador de SharePoint, probablement l'IMI), o
   - d'un **catàleg a nivell de lloc** (també el crea un administrador, però després el propietari del lloc pot gestionar les versions sense dependre d'ell).
3. Al lloc de SharePoint del Servei: afegir l'aplicació al lloc, crear una **pàgina moderna** (p. ex. `Foto-carnet.aspx`) amb una secció d'amplada completa i afegir-hi el web part.
4. Configurar el web part des del panell de propietats (URL del Forms, etc.) i publicar la pàgina.
5. Permisos de la pàgina: lectura per a tot el personal que s'hagi de fer la foto.
6. Actualitzacions: pujar un `.sppkg` nou amb la versió incrementada. Els usuaris no han de fer res.

**Desenvolupament**: provar al *workbench* hostatjat del lloc de proves (`/_layouts/15/workbench.aspx`) amb `gulp serve` / `heft start` (segons la versió de SPFx).

**Atenció**: el que no funcioni per la CSP de SharePoint (§5) **no es veurà en local**, només dins SharePoint. Per això la Fase 0 es prova directament en un lloc de SharePoint real.

---

## 11. Fases d'implementació

Cada fase s'ha de tancar (funcionant i provada) abans de començar la següent.

### Fase 0 — Prova de viabilitat a SharePoint + esquelet
**Primer, una prova mínima (spike)** desplegada en un lloc de SharePoint real, no al workbench local:
- Web part que obre la webcam (`getUserMedia`) i la mostra.
- Carrega MediaPipe Face Landmarker **des dels recursos del paquet** i pinta els punts de la cara.
- Botó que desa un JPEG de prova amb `showSaveFilePicker` a Imatges.
- Revisar la consola: **cap violació de CSP**.

Si alguna de les tres coses falla, **aturar-se i informar** abans de continuar (cal replantejar l'allotjament).

Després, l'esquelet:
- Solució SPFx amb React + TS estricte, ESLint/Prettier, Jest.
- Màquina d'estats amb les pantalles P0–P7 buides i navegació.
- `config.default.json`, panell de propietats i `ca.json` carregats a l'inici.
- Capçalera amb els logos de §6 i variables de color.

**Fet quan**: la prova de viabilitat funciona dins SharePoint i es pot navegar per totes les pantalles amb dades simulades.

### Fase 1 — Captura bàsica i sortida
- P1 instruccions, P2 matrícula amb validació.
- RF-01 càmera amb selector i errors.
- Captura **manual**, retall centrat **simple** (sense landmarks), JPEG amb JFIF a 300 ppp (RF-08).
- RF-11 desar a Imatges i RF-16 neteja.
- Tests unitaris de JFIF i proporcions.

**Fet quan**: es pot fer una foto, desar-la com a `12345.jpg` a Imatges i, oberta a Windows, té 413×531 px i 300 ppp.

### Fase 2 — Visió i guiatge en temps real
- Càrrega local de MediaPipe (RF-02, RF-03), bucle d'anàlisi (RF-04).
- Tots els controls de RF-05, semàfors, missatge prioritari i silueta guia.
- Retall intel·ligent RF-07.
- Mode diagnòstic RF-18.

**Fet quan**: els semàfors reaccionen correctament a moure's, girar el cap, apagar el llum i posar-se davant d'un fons no blanc. El retall situa el cap segons RF-07.

### Fase 3 — Captura automàtica, selecció i Forms
- Compte enrere i captura automàtica, i captura manual amb avís.
- Fins a 3 fotos, puntuació, P4 selecció.
- P5/P6: desar, pop-up d'instruccions i obertura del Forms pre-omplert (RF-12, RF-13).
- P7 i RF-15.

**Fet quan**: el flux complet funciona de punta a punta amb un Forms de proves.

### Fase 4 — Acabats
- Repàs de la identitat gràfica (§6) a totes les pantalles.
- Accessibilitat, textos revisats, il·lustracions de les instruccions.
- Guió de proves manuals dins SharePoint (diferents equips, webcams i llums).
- README complet (build, desplegament al catàleg, configuració del web part, calibratge, risc CSP/WASM).

### Fase 5 — Calibratge i pilot (sense codi nou)
- Sessió de calibratge amb `?debug=1` (afegit a l'URL de la pàgina de SharePoint) en 2-3 parcs diferents (llums diferents) i ajust de la configuració des del panell de propietats.
- Crear el Forms (§8) i el flux de Power Automate (§9).
- Pilot amb 10-20 bombers i recollida de comentaris.

---

## 12. Decisions

### Preses
| # | Decisió |
|---|---|
| D3 | Allotjament en un **lloc de SharePoint**, com a **web part SPFx** en una pàgina moderna |
| D4 | Destí final: **biblioteca de SharePoint** (via Forms + Power Automate) |
| D7 | Identitat gràfica: escut de Bombers en color + segell històric (manual p. 5), signatura de l'Ajuntament (negre i vermell), sense logos 080 (§6) |

### Pendents
| # | Pregunta | Valor provisional |
|---|---|---|
| D1 | Format exacte de la matrícula (dígits, lletres?) | `^[0-9]{4,6}$` |
| D2 | Si `matricula.jpg` ja existeix al destí: sobreescriure, versionar o avisar? | Sobreescriure (la biblioteca guarda l'historial de versions) |
| D5 | Resolució de sortida: 300 o 600 ppp? Requisits del destinatari (impressió de carnets, RRHH) | 300 ppp |
| D6 | Webcams reals dels parcs (resolució mínima) | ≥ 720p |
| D8 | Text RGPD de P0 | Pendent del DPD |
| D11 | Qui desplega el `.sppkg`: catàleg del tenant (IMI) o catàleg del lloc | A coordinar amb l'IMI |
| D12 | Ara que l'app viu dins SharePoint, es podria **pujar la foto directament a una biblioteca** des del web part (sense desar a l'equip ni Forms). Ho volem per a una v2? | No a la v1 |
| D9 | Es permeten ulleres graduades? | Sí, sense reflexos |
| D10 | Validació matrícula ↔ usuari a Power Automate (necessita una llista) | No, a la primera versió |

---

## 13. Criteris d'acceptació globals

- [ ] Un bomber sense ajuda pot completar el procés en < 5 min a partir de les instruccions.
- [ ] El fitxer desat es diu exactament `{matricula}.jpg`, fa 35:45, té la resolució configurada i densitat JFIF correcta.
- [ ] El cap ocupa ~75% de l'alçada (±5%) i està centrat.
- [ ] Cap petició de xarxa conté la imatge ni la matrícula (comprovat a les eines de desenvolupador).
- [ ] No queda cap dada a l'emmagatzematge del navegador després del procés.
- [ ] La càmera s'apaga en acabar o en tancar la pestanya.
- [ ] El Forms s'obre amb la matrícula pre-omplerta.
- [ ] El flux de Power Automate deixa `{matricula}.jpg` a la carpeta destí i esborra l'original.
- [ ] Funciona a l'Edge dels equips corporatius dins la pàgina de SharePoint, sense cap violació de CSP a la consola.
- [ ] Es fan servir només els logos autoritzats (§6) i cap amb el 080.

---

## 14. Instruccions per a Claude Code

- Treballa **una fase cada vegada** (§11). En acabar una fase, resumeix què s'ha fet, com provar-ho, i espera confirmació abans de seguir.
- Tots els textos visibles en **català**, des de `ca.json`.
- **No afegeixis cap dependència que faci peticions a internet** en temps d'execució.
- És un **web part SPFx**: respecta la CSP de SharePoint (cap script inline, cap `eval`, tot servit des del paquet).
- Codi en TypeScript estricte; funcions de càlcul d'imatge **pures i testejades**.
- Fes servir **només** els fitxers de `assets/brand/` (§6). No recreïs ni modifiquis cap logo.
- Els llindars van sempre a la configuració, mai al codi.
- Si una decisió de §12 bloqueja la feina, fes servir el valor provisional i deixa-ho anotat al README.
