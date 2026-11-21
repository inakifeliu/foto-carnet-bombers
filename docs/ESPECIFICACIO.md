# Especificació — Foto Carnet Bombers de Barcelona

> Versió 0.3 · Esborrany · 21/11/2026
> Canvis v0.3: l'aplicació passa a ser **un únic fitxer HTML autònom** que es descarrega i s'obre amb doble clic (D3 revisada). Desapareixen el web part SPFx, el catàleg d'aplicacions i la dependència de l'IMI. Nou apartat de distribució (§10), recursos incrustats (RF-20), versió visible (RF-21) i context incorrecte (RF-19). La viabilitat tècnica a `file://` ja s'ha validat (§11, Fase 0).
> Canvis v0.2: destí final a SharePoint (D4), identitat gràfica definida (D7).
> Document de referència per implementar l'aplicació amb Claude Code, fase a fase.
> Idioma de tota la interfície: **català**.

---

## 0. Context i objectiu

Els bombers de Barcelona (SPCPEIS) han de lliurar una **foto tipus carnet amb el polo de l'uniforme**. L'objectiu és que cada bomber se la pugui fer **ell mateix** des d'un ordinador corporatiu amb webcam, amb una aplicació que:

1. Es distribueix com **un sol fitxer HTML** (enllaç de SharePoint/OneDrive o correu) i s'obre amb doble clic a Edge, sense instal·lar res.
2. Li expliqui com s'ha de preparar.
3. El guiï en temps real (posició, distància, llum, fons) a l'estil de les apps KYC.
4. Li permeti fer fins a 3 fotos i triar la millor.
5. Retalli automàticament la foto al format oficial **35 × 45 mm**.
6. La desi a l'equip com a `MATRICULA.jpg` a la carpeta **Imatges**.
7. Obri un **Microsoft Forms** (amb la matrícula ja escrita) on el bomber puja la foto, identificat amb el seu usuari de Microsoft 365.

Després, un flux de **Power Automate** reanomena el fitxer i el deixa a la carpeta destí.

---

## 1. Abast

### Inclou
- **Un únic fitxer HTML autònom** (`foto-carnet-bombers-vX.Y.Z.html`) que conté tot el codi, els models, el WASM de MediaPipe i els logos. **Sense backend, sense servidor i sense instal·lació.**
  - S'executa en local (`file://`) en obrir-lo amb doble clic.
  - Motiu: SharePoint Online no executa fitxers `.html` (els descarrega) i desplegar un web part SPFx requereix permisos d'administrador que el Servei no té. Un fitxer local evita les dues coses i, a més, la CSP de SharePoint deixa de ser un risc.
- Instruccions inicials, captura guiada amb validacions automàtiques, selecció de la millor foto, retall, desat local i obertura del Forms.
- Procediment de distribució i actualització del fitxer (§10).
- Especificació del Forms i del flux de Power Automate (configuració *no-code*, fora del repositori de codi).

### No inclou
- Res especial a SharePoint: cap web part, cap pàgina, cap catàleg d'aplicacions. SharePoint/OneDrive només serveix per **guardar el fitxer perquè es descarregui** i com a biblioteca destí del Power Automate.
- Validar si porta les galetes (categoria i nom). Només es demana a les **instruccions**.
- Validar si la matrícula existeix o correspon a la persona (es pot fer després, a Power Automate).
- Escriure al NAS (el destí és SharePoint).
- Ús des de mòbils o tauletes.

---

## 2. Usuaris i entorn

| Aspecte | Valor |
|---|---|
| Usuari | Bomber/a del SPCPEIS, sense coneixements tècnics |
| Equip | Ordinador corporatiu de l'Ajuntament (Windows) |
| Navegador objectiu | **Microsoft Edge** (Chromium) actual. Chrome també compatible. Firefox: degradat (vegeu RF-17) |
| Càmera | Webcam integrada o USB. Mínim 1280×720 recomanat |
| Execució | Local, `file://`, en obrir el fitxer HTML. Funciona **sense connexió a internet**; només el Forms (P6) necessita xarxa i sessió de Microsoft 365 |
| Instal·lació | **Cap.** Descarregar el fitxer (o desar l'adjunt) i obrir-lo amb Edge. Cap permís d'administrador ni a l'equip ni a SharePoint |

---

## 3. Flux d'usuari (pantalles)

```
P0 Benvinguda → P1 Instruccions → P2 Matrícula → P3 Captura guiada (×3 màx.)
   → P4 Selecció → P5 Desar → P6 Pujar al Forms → P7 Final
```

### P0 — Benvinguda
- Capçalera amb identitat gràfica de Bombers de Barcelona.
- Títol: "Foto de carnet amb uniforme".
- Text breu: què farem, quant triga (~3 min), que la foto **no s'envia enlloc** fins que la pugi ell mateix al formulari, i que l'aplicació funciona tota dins l'ordinador.
- Botó **"Començar"**.
- Al peu: **versió i data** del fitxer (RF-21).

### P1 — Instruccions
Llista il·lustrada (icona + text curt). Totes s'han de llegir; botó "Entesos, continuar" al final.

1. **Fons blanc i llis** darrere teu (paret blanca, sense quadres ni portes).
2. **Bona llum de cara**. Evita finestres o llums darrere teu.
3. **Polo blau de l'uniforme**, net i ben posat.
4. **Galeta de la categoria laboral** i **galeta amb el nom i matrícula** visibles.
5. **Sense gorra, casc ni ulleres de sol**. Si portes ulleres graduades, evita reflexos.
6. **Cara descoberta**, cabells que no tapin els ulls.
7. **Mirada a la càmera**, expressió neutra, boca tancada.
8. **Espatlles rectes**, assegut/da a una distància d'un braç de la pantalla.
9. Si pots, demana a un company/a que comprovi l'enquadrament.

### P2 — Matrícula
- Camp únic: **Matrícula**.
- Validació amb expressió regular configurable (`config.matriculaRegex`), aplicada com a **coincidència completa**, i el valor ha de ser un **nom de fitxer segur** (sense `/ \ : * ? " < > |`, `..`, ni punts o espais als extrems). Missatge d'error clar, també en prémer Enter.
- Confirmació: "La teva matrícula és **12345**? Serà el nom de la foto."
- Botó "Continuar". En prémer-lo, es demana permís de càmera.
  - A `file://`, Edge pot tornar a demanar el permís cada vegada que s'obre el fitxer. És normal.

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
- Si l'equip no té connexió, avís: "Cal connexió a internet per enviar el formulari. La foto ja està desada a Imatges; pots enviar-la més tard."
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
- **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`), mode VIDEO, amb *blendshapes* i matriu de transformació facial.
- Si hi ha 0 cares → "No et veiem la cara". Si n'hi ha > 1 → "Només hi ha de sortir una persona" (configurar `numFaces: 2` per poder-ho detectar).
- Delegat **GPU** amb retrocés a **CPU** només si l'error és propi de la GPU.

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
| 5.3 | Distància | alçada cara (front–barbeta) / alçada del rectangle del visor (amb enquadrament «cap», del fotograma) | entre 0,22 i 0,30 (enquadrament «visor»; amb «cap», 0,30–0,45) | "Apropa't" / "Allunya't" |
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
- **Enquadrament** (`config.sortida.enquadrament`):
  - **`"visor"` (per defecte)**: la foto final és **exactament el que es veu al visor de P3** (sense el mirall): el rectangle 35:45 més gran centrat al fotograma de la càmera (el mateix que mostra `object-fit: cover`, sigui quina sigui la proporció de la càmera), de manera que s'hi veuen cap, espatlles i part de l'uniforme. Decisió de l'usuari del 21/11/2026 després de provar-ho al Surface. El visor, la captura, els controls que depenen del retall (5.3, 5.6, 5.11) i el rectangle previst del mode diagnòstic fan servir la mateixa funció (`rectangleVisor`). El retall sempre és dins el fotograma: no hi ha avís «Massa a prop / a la vora» ni penalització. Silueta guia i llindars (5.3: 0,22–0,30; zona del tors de 5.10/5.11 més avall i més ampla) pensats per a aquest enquadrament; **a calibrar** amb fotos reals.
  - **`"cap"`**: retall intel·ligent segons les normes DNI/OACI (opció configurable), descrit a continuació.
- Enquadrament «cap» (referència normes DNI/OACI, configurable):
  - **Alçada del cap** (barbeta → part superior del cap): **34 mm** dels 45 (≈ 75% de l'alçada).
  - **Marge superior** (part superior del cap → límit superior): **4 mm**.
  - Cara **centrada horitzontalment**.
- La **part superior del cap** s'estima amb la màscara de segmentació (primer píxel de persona per sobre del front a la columna central de la cara); si no és fiable, com a front (landmark 10) + 0,25 × l'alçada front–barbeta.
- La **barbeta** és el landmark 152.
- (Només «cap».) Si el retall necessita píxels fora del fotograma, la foto es marca amb avís "Massa a prop / a la vora" i rep una penalització a la puntuació.
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
- Si `window.showSaveFilePicker` existeix (validat a Edge en `file://`, 21/11/2026):
  ```js
  showSaveFilePicker({
    suggestedName: `${matricula}.jpg`,
    startIn: 'pictures',
    types: [{ description: 'Imatge JPEG', accept: { 'image/jpeg': ['.jpg'] } }],
  })
  ```
  - El diàleg s'obre **dins el clic** (abans de codificar), per no perdre l'activació d'usuari; després es codifica i s'escriu amb `createWritable()`.
  - **Guardar el `FileSystemFileHandle` en memòria** per a RF-15.
- Si no existeix o llança `SecurityError` (Firefox, polítiques), alternativa amb `<a download="{matricula}.jpg">` (anirà a Baixades). En aquest cas, el text de P6 ha de dir "carpeta **Baixades**" en lloc d'"Imatges".
- `AbortError` (l'usuari cancel·la el diàleg) → es queda a P5 sense mostrar cap error.

### RF-12 URL del Forms pre-omplerta
- `config.forms.urlPlantilla` conté l'URL obtinguda a Forms amb "Obtenir l'URL emplenada prèviament", amb el valor de mostra substituït pel marcador `{MATRICULA}`.
- L'app substitueix el marcador per `encodeURIComponent(matricula)`.
- La plantilla ha de ser `https:`; si no, P6 mostra un error de configuració en lloc de l'enllaç.

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
- `URL.revokeObjectURL()` de totes les miniatures i de les URL `blob:` dels recursos (RF-20) quan ja no calguin.
- Buidar els canvas (amplada i alçada a 0) i eliminar les referències a blobs i ImageData.
- Tancar els models de MediaPipe (`close()`).
- Cap ús de `localStorage`, `sessionStorage`, IndexedDB ni Cache API per a imatges o matrícules.

### RF-17 Compatibilitat
- Detecció de funcionalitats a l'inici: `getUserMedia`, WebAssembly, `DecompressionStream`, WebGL2 i WebGL (1).
- Si falta alguna cosa imprescindible → pantalla "Aquest navegador no és compatible. Obre el fitxer amb Microsoft Edge."
- **WebGL**: sense WebGL2 però amb WebGL 1, MediaPipe va en CPU (nota a P0: anirà més lenta). `@mediapipe/tasks-vision` 1.2.3 necessita WebGL **fins i tot amb el delegat CPU**: si no hi ha ni WebGL ni WebGL2, **NO es carreguen els models**; P0 avisa que l'anàlisi automàtica no estarà disponible i P3 ho diu directament («L'anàlisi automàtica no està disponible en aquest equip…», sense «Preparant l'anàlisi…» ni semàfors). La **captura manual continua** (retall centrat, sense puntuació: P4 diu «Sense puntuació»). No és un error d'incompatibilitat: l'app continua utilitzable.
- **Segmentador opcional**: el Face Landmarker i l'Image Segmenter es creen per separat. Si el segmentador no es pot crear, falla en escalfar-se o dona errors seguits en execució (3), es desactiva i el Face Landmarker continua. Sense màscara, els controls de fons blanc, polo blau i espatlles/tors passen a l'estat «No disponible» (semàfor gris amb aquest text): no compten per al «Perfecte!» ni per a la puntuació (els pesos dels altres es reponderen) i el retall RF-07 fa servir landmark 10 + 0,25 × alçada de la cara.

### RF-18 Mode diagnòstic (per calibrar)
- Activat amb la combinació **Ctrl + Alt + D** o afegint `#debug` al final de l'adreça.
- Mostra en directe els valors numèrics de tots els controls de RF-05, la màscara de segmentació, la zona del tors analitzada i el rectangle de retall previst.
- Botó per descarregar un JSON amb els valors del moment (per ajustar llindars). **Mai** la imatge.

### RF-19 Context d'obertura incorrecte
- Si el navegador no executa scripts (p. ex. la vista prèvia de l'Outlook, de OneDrive o de SharePoint), el fitxer mostra un missatge estàtic (`<noscript>` i contingut HTML inicial visible fins que arrenca l'app): "Descarrega aquest fitxer a l'ordinador i obre'l amb Microsoft Edge."
- Si l'app s'executa dins un `iframe` (vista prèvia d'algun servei), mostra el mateix missatge en lloc de demanar la càmera.

### RF-20 Recursos incrustats
- El fitxer HTML porta **dins** el loader i el binari WASM de MediaPipe, els models (`face_landmarker.task`, `selfie_segmenter.tflite`) i els logos.
- Els binaris van codificats en base64 i, quan redueixi la mida, **comprimits amb gzip**; en temps d'execució es descomprimeixen amb `DecompressionStream`.
- El loader i el WASM es passen a MediaPipe com a URL `blob:` (`wasmLoaderPath`, `wasmBinaryPath`); els models, com a `modelAssetBuffer`.
- A `file://` no es pot fer `fetch` de fitxers locals ni importar mòduls d'altres fitxers: **tot** ha d'anar dins l'HTML.
- Els logos, com a `data:` URI o SVG en línia, sense modificar-los (§6).

### RF-21 Versió visible
- Al peu de totes les pantalles: versió (`vX.Y.Z`) i data de compilació.
- El nom del fitxer distribuït inclou la versió: `foto-carnet-bombers-vX.Y.Z.html`.
- La versió també apareix al JSON del mode diagnòstic.

---

## 5. Requisits no funcionals

### Privacitat (RGPD)
- **Cap imatge ni matrícula surt del navegador** cap a cap servidor. L'únic enviament és el que fa l'usuari al Forms.
- Cap telemetria, analítica ni petició de xarxa en temps d'execució. L'app funciona sense connexió fins a P6.
- Text informatiu a P0 sobre el tractament (finalitat, destí, conservació). **Redacció a validar amb el DPD** de l'Ajuntament.

### Seguretat
- **Execució local (`file://`)**: no hi ha CSP de SharePoint ni de cap servidor. Tot i així, el codi propi no fa servir `eval`, `new Function` ni `innerHTML` amb contingut dinàmic.
- **Telemetria de MediaPipe**: `@mediapipe/tasks-vision` inclou un registre que envia dades d'ús a `odml.pa.googleapis.com`. Es neutralitza en compilar i una **guarda de build** fa fallar la compilació si el fitxer final conté `googleapis` (excepte l'identificador protobuf `type.googleapis.com/`), `odml.`, `google-analytics` o qualsevol host extern fora d'una llista permesa.
- **Integritat de les còpies**: com que el fitxer circula entre persones, pot arribar una còpia antiga o manipulada.
  - La font oficial és una **única ubicació a SharePoint/OneDrive** (§10). Les comunicacions sempre enllacen allà.
  - Cada versió es publica amb el seu **SHA-256** al costat.
  - La versió visible (RF-21) permet comprovar quina té cada persona.
- **Filtres de correu**: molts filtres corporatius (Defender for Office 365) bloquegen o posen en quarantena els adjunts `.html` amb scripts. Per això el canal recomanat és un **enllaç**, no un adjunt (§10, D13).
- **Marca de la web (Mark of the Web)**: un fitxer baixat d'internet o del correu pot arribar marcat. Si Windows o Edge el bloquegen, cal fer *Propietats → Desbloqueja*. S'ha d'explicar a les instruccions de distribució.

### Rendiment
- Mida del fitxer: objectiu **< 12 MB** (a mesurar; sense comprimir eren ~24 MB, dominats pel WASM de 14,7 MB).
- Obertura i càrrega del model < 5 s en un equip corporatiu estàndard.
- Vídeo fluid (≥ 24 fps de visualització). Anàlisi a ≥ 10 fps.
- Si l'anàlisi va lenta, reduir la resolució d'entrada als models (p. ex. 640 px d'amplada).
- **Pressupost de l'anàlisi en directe** (tot és síncron al fil principal; constants a `src/vision/pressupost.ts`): els models s'**escalfen** en carregar-se (una detecció i una segmentació amb un canvas buit, mentre es veu «Preparant l'anàlisi…»; no compten a la mitjana). El segmentador només corre cada 3 anàlisis (~4 Hz a 12 fps) amb entrada de 256 px d'amplada i es reaprofita l'última màscara (amb les seves mides; coordenades normalitzades); a la captura sempre se segmenta, a 640 px. Si la mitjana mòbil supera 50 ms, l'anàlisi baixa a 8 fps i la segmentació s'espaia (cada 6); torna a la normalitat per sota de 35 ms. Si supera 150 ms de manera sostinguda (10 anàlisis seguides), l'anàlisi en directe s'atura amb un avís en català i la captura manual continua.
- El mode diagnòstic mostra (i el JSON porta) el temps mitjà per pas: dibuix, Face Landmarker, segmentador i mètriques, el nivell del pressupost i l'estat de la segmentació.
- Mesura de referència (21/11/2026, Surface, Edge 157, `file://`): model carregat en 320 ms amb GPU, detecció 23 ms de mitjana (p95 37 ms), càmera 1920×1080 a 30 fps. **Pendent** de repetir en un equip de parc.

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
- Tots els logos van **incrustats** dins l'HTML (RF-20); no es carreguen en temps d'execució.

### Colors
Referències Pantone del manual; els valors de pantalla són els mostrejats de l'escut del manual en PDF.

```css
:root {
  --bcn-vermell: #EB263C;   /* Pantone 485C (vermell Bombers), per a fons i vores */
  --bcn-vermell-text: #C91F33; /* vermell per a text sobre blanc (5,6:1, AA) */
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
- Text blanc sobre `--bcn-vermell` per als botons primaris amb lletra **≥ 19 px en negreta** (4,31:1 només compleix AA com a text gran).
- La signatura vermella de l'Ajuntament (`#FF2828`) es fa servir tal com és, sense recolorir.

### Tipografia
- Tipografia corporativa: **ITC Franklin Gothic Std** (amb llicència; no es pot incloure com a font web sense llicència web).
- Pila de fonts: `"ITC Franklin Gothic Std", "Franklin Gothic Medium", "Franklin Gothic", Arial, sans-serif`. *Franklin Gothic Medium* ve instal·lada a Windows, així que als equips corporatius es veurà coherent sense carregar cap font.

### Estil
- Sobri i institucional. Fons blanc, molt d'espai, capçalera amb la signatura de l'Ajuntament a l'esquerra i l'escut de Bombers a la dreta.
- Pensat per a pantalla d'escriptori (≥ 1280 px), a pantalla completa del navegador, i adaptable a finestres més estretes.

---

## 7. Arquitectura i stack

| Capa | Tecnologia |
|---|---|
| Format de lliurament | **Un únic fitxer HTML** autònom (JS, CSS i recursos incrustats) |
| Compilació | **esbuild** (empaquetat IIFE) + un script de Node que genera l'HTML final, incrusta els recursos, aplica el pegat de telemetria i passa la guarda |
| Llenguatge | **TypeScript** estricte |
| UI | **React** (components funcionals, *hooks*), empaquetat dins l'HTML. Estil propi de marca, sense llibreria de components |
| Estat | `useReducer` + context (màquina d'estats de pantalles P0–P7). Sense llibreries externes d'estat |
| Visió | `@mediapipe/tasks-vision` (Face Landmarker + Image Segmenter), versió fixada |
| Processament d'imatge | Canvas 2D + funcions pròpies (luminància, HSV, Laplacià). **Sense OpenCV.js** (massa pes) |
| Fitxers | File System Access API (`showSaveFilePicker`) amb alternativa `<a download>` |
| Configuració | `config/config.json` dins el repositori, **validat i incrustat en compilar**. Per canviar la URL del Forms, la regex o els llindars cal editar-lo i tornar a compilar i distribuir (§10). La configuració s'ha de validar contra la forma i els tipus de `config.default.json` i mai pot fer fallar l'app |
| Tests | **Jest** per a les funcions pures (retall, JFIF, color i llum, controls, configuració, màquina d'estats) i components clau. Proves E2E **manuals** amb el fitxer HTML final en equips reals |
| Lint/format | ESLint + Prettier |

### Estructura de carpetes proposada
```
foto-carnet-bombers/
├─ config/
│  └─ config.json                 # configuració que s'incrusta en compilar
├─ scripts/
│  ├─ construeix.mjs              # esbuild + incrustació + guarda → dist/*.html
│  ├─ mediapipe-sense-telemetria.mjs
│  └─ verifica-html.mjs           # guarda: cap telemetria ni host extern
├─ src/
│  ├─ index.html                  # plantilla (amb <noscript> i missatge inicial, RF-19)
│  ├─ main.tsx                    # arrencada
│  ├─ app/                        # màquina d'estats, App.tsx
│  ├─ screens/                    # P0Benvinguda … P7Final, NoCompatible
│  ├─ components/                 # Capcalera, Peu, Semafor, SiluetaGuia, Miniatura, Modal…
│  ├─ vision/                     # carregar models, bucle d'anàlisi, controls RF-05
│  ├─ image/                      # retall RF-07, jpeg+JFIF RF-08, mètriques
│  ├─ fs/                         # desar RF-11, esborrar RF-15
│  ├─ recursos/                   # descompressió i URL blob dels recursos incrustats (RF-20)
│  ├─ i18n/ca.json
│  ├─ config/                     # config.default.json + validació
│  ├─ styles/
│  └─ assets/
│     ├─ brand/                   # escuts i signatures (§6)
│     ├─ models/                  # face_landmarker.task, selfie_segmenter.tflite
│     └─ wasm/                    # loader i binari WASM de MediaPipe (còpia verificada per SHA-256)
├─ dist/                          # foto-carnet-bombers-vX.Y.Z.html + .sha256 (no es versiona)
└─ README.md                      # build, distribució, configuració, calibratge
```

### `config.json` (exemple)
```json
{
  "matriculaRegex": "^[0-9]{4,6}$",
  "maxFotos": 3,
  "sortida": { "ppp": 300, "qualitatJpeg": 0.92, "enquadrament": "visor",
               "alcadaCapMm": 34, "margeSuperiorMm": 4 },
  "forms": { "urlPlantilla": "https://forms.office.com/Pages/ResponsePage.aspx?id=XXXX&rYYYY={MATRICULA}" },
  "captura": { "segonsEstableAbansCompte": 1, "compteEnrere": 3 },
  "llindars": {
    "centratMax": 0.08, "alcadaCaraMin": 0.22, "alcadaCaraMax": 0.30,
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
- Recomanat: que el Forms sigui un formulari del grup de Microsoft 365 associat al lloc del Servei.

---

## 10. Distribució i actualització

No cal cap permís d'administrador: n'hi ha prou amb poder pujar fitxers a una biblioteca de SharePoint o a OneDrive.

### Compilació
1. Editar `config/config.json` si cal (URL del Forms, llindars…) i incrementar la versió a `package.json`.
2. `npm run build` → `dist/foto-carnet-bombers-vX.Y.Z.html` i `dist/foto-carnet-bombers-vX.Y.Z.html.sha256`. La compilació falla si la guarda detecta telemetria o hosts externs.
3. Prova manual del fitxer generat (doble clic a Edge, flux complet).

### Publicació (font oficial única)
1. Pujar el fitxer a una **carpeta de SharePoint o OneDrive** amb permís de **lectura** per a tot el personal que s'hagi de fer la foto (p. ex. `Foto carnet/`), junt amb un document breu d'instruccions i el SHA-256.
2. Treure'n (o moure a una carpeta `Antigues/`) les versions anteriors.
3. Comunicar l'**enllaç** per correu o Teams. Recomanat: enllaç, **no** adjunt (filtres de correu, mida, còpies antigues).

### Ús per part del bomber
1. Obrir l'enllaç → **Descarregar** el fitxer.
2. Obrir-lo amb doble clic (o clic dret → *Obre amb* → **Microsoft Edge** si el navegador per defecte no és Edge o Chrome).
3. Si Windows avisa que el fitxer ve d'internet: clic dret → *Propietats* → marcar **Desbloqueja** → *D'acord*.

### Actualitzacions
- Una versió nova és un fitxer nou amb la versió al nom. Es substitueix a la font oficial i es comunica.
- Qui tingui una còpia antiga pot comprovar la versió al peu de la pàgina.

### Proves de distribució (abans del pilot)
- Descarregar des de SharePoint i des de OneDrive i obrir-lo en un equip de parc.
- Enviar-lo com a adjunt a un mateix per veure si el filtre corporatiu el bloqueja.
- Comprovar què passa si s'obre la vista prèvia (Outlook, OneDrive, SharePoint): ha de sortir el missatge de RF-19.

---

## 11. Fases d'implementació

Cada fase s'ha de tancar (funcionant i provada) abans de començar la següent.

### Fase 0 — Esquelet de l'HTML autònom
**Viabilitat (feta, 21/11/2026)**: una pàgina HTML autònoma de prova, oberta amb doble clic (`file://`) a Edge en un Surface, ha funcionat sense errors: càmera 1920×1080 a 30 fps, MediaPipe Face Landmarker amb GPU (càrrega 320 ms, detecció 23 ms), `showSaveFilePicker` obert a Imatges, cap petició de xarxa. **Pendent**: repetir-la en un equip corporatiu de parc.

Esquelet:
- Projecte TypeScript estricte + React + esbuild, ESLint/Prettier, Jest.
- `npm run build` que genera **un sol fitxer** `dist/foto-carnet-bombers-vX.Y.Z.html` amb:
  - recursos incrustats i comprimits (RF-20), pegat de telemetria i guarda;
  - el SHA-256 al costat;
  - versió i data al peu (RF-21);
  - missatge `<noscript>` i detecció d'`iframe` (RF-19).
- Màquina d'estats amb les pantalles P0–P7 i navegació amb dades simulades.
- `config.json` validat i incrustat, `ca.json` carregat a l'inici.
- Capçalera i peu amb els logos de §6 i variables de color.
- Es pot reaprofitar el codi de la branca `fase-0/viabilitat-esquelet` (màquina d'estats, pantalles, configuració, i18n, pegat de telemetria, guarda, prova local), traient-ne tot el que és específic de SPFx.

**Fet quan**: el fitxer generat s'obre amb doble clic a Edge, es pot navegar per totes les pantalles amb dades simulades, la guarda passa i se n'ha mesurat la mida.

### Fase 1 — Captura bàsica i sortida
- P1 instruccions, P2 matrícula amb validació.
- RF-01 càmera amb selector i errors.
- Captura **manual**, retall centrat **simple** (sense landmarks), JPEG amb JFIF a 300 ppp (RF-08).
- RF-11 desar a Imatges i RF-16 neteja.
- Tests unitaris de JFIF i proporcions.

**Fet quan**: es pot fer una foto, desar-la com a `12345.jpg` a Imatges i, oberta a Windows, té 413×531 px i 300 ppp.

**Estat (21/11/2026)**: implementada, **provada al Surface per l'usuari i fusionada a `main`**.

### Fase 2 — Visió i guiatge en temps real

**Estat (21/11/2026)**: implementada, **provada al Surface per l'usuari i fusionada a `main`**. El calibratge dels llindars amb cares reals en diversos parcs és de la Fase 5 (vegeu README, «Calibratge»).
- Càrrega de MediaPipe des dels recursos incrustats (RF-02, RF-03, RF-20), bucle d'anàlisi (RF-04).
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

> Estat (21/11/2026): implementada (captura automàtica, 3 fotos, P4, P5/P6/P7 i RF-15, amb RF-09 aplicat en triar a P4), **provada al Surface per l'usuari i fusionada a `main`** (PR #1).

### Fase 4 — Acabats
- Repàs de la identitat gràfica (§6) a totes les pantalles.
- Accessibilitat, textos revisats, il·lustracions de les instruccions.
- Guió de proves manuals amb el fitxer final (diferents equips de parc, webcams i llums) i proves de distribució (§10).
- README complet (build, configuració, distribució, calibratge) i document d'instruccions per als bombers.

> **Estat (v0.2.0, branca `html-autonom/fase-4`)**: **implementada, pendent de prova manual** amb el guió (`docs/GUIO-PROVES-MANUALS.md`). Fet: identitat gràfica a totes les pantalles (variables de §6, protecció dels logos, finestres estretes fins a ~360 px), accessibilitat (contrast AA comprovat per test, focus visible, focus al títol en canviar de pantalla, una sola `h1`, modals amb trampa de focus, `prefers-reduced-motion`, proves automàtiques amb `jest-axe` a cada pantalla), textos revisats, il·lustracions SVG de les instruccions de P1, guió de proves manuals, `docs/INSTRUCCIONS-BOMBERS.md` i README complet. Pendent: provar-ho tot amb el fitxer final a equips de parc, amb webcams i llums diferents, i fer les proves de distribució de §10.

### Fase 5 — Calibratge i pilot (sense codi nou)
- Sessió de calibratge amb el mode diagnòstic (Ctrl + Alt + D) en 2-3 parcs diferents (llums diferents). Ajust de `config.json`, nova compilació i nova versió.
- Crear el Forms (§8) i el flux de Power Automate (§9).
- Publicar el fitxer a la font oficial (§10).
- Pilot amb 10-20 bombers i recollida de comentaris.

---

## 12. Decisions

### Preses
| # | Decisió |
|---|---|
| D3 | *(revisada a v0.3)* L'aplicació és **un únic fitxer HTML autònom**, executat en local amb Edge. Res especial a SharePoint. Substitueix el web part SPFx de la v0.2 |
| D4 | Destí final: **biblioteca de SharePoint** (via Forms + Power Automate) |
| D7 | Identitat gràfica: escut de Bombers en color + segell històric (manual p. 5), signatura de l'Ajuntament (negre i vermell), sense logos 080 (§6) |
| D17 | **Enquadrament de la foto final** (21/11/2026, després de provar-ho al Surface): per defecte és exactament el que es veu al visor de P3 (rectangle 35:45 centrat, amb cap, espatlles i part del polo), no el retall RF-07 amb el cap a 34/45 mm. El retall RF-07 es manté com a opció (`sortida.enquadrament: "cap"`). Llindar 5.3 i silueta guia adaptats; a calibrar |
| D16 | Configuració fixada en compilar (`config/config.json`); canviar-la implica una versió nova |

### Pendents
| # | Pregunta | Valor provisional |
|---|---|---|
| D1 | Format exacte de la matrícula (dígits, lletres?) | `^[0-9]{4,6}$` |
| D2 | Si `matricula.jpg` ja existeix al destí: sobreescriure, versionar o avisar? | Sobreescriure (la biblioteca guarda l'historial de versions) |
| D5 | Resolució de sortida: 300 o 600 ppp? Requisits del destinatari (impressió de carnets, RRHH) | 300 ppp |
| D6 | Webcams reals dels parcs (resolució mínima) | ≥ 720p |
| D8 | Text RGPD de P0 | Pendent del DPD |
| D9 | Es permeten ulleres graduades? | Sí, sense reflexos |
| D10 | Validació matrícula ↔ usuari a Power Automate (necessita una llista) | No, a la primera versió |
| D13 | Canal de distribució: enllaç (SharePoint/OneDrive) o adjunt de correu? | Enllaç. L'adjunt només si les proves de §10 confirmen que el filtre no el bloqueja i la mida ho permet |
| D14 | On es publica la font oficial i qui en manté les versions | Pendent |
| D15 | Cal avisar dins l'app si la versió és antiga (p. ex. data de caducitat)? | No a la v1; només versió visible |

### Obsoletes (v0.2)
| # | Motiu |
|---|---|
| D11 | Qui desplega el `.sppkg`: ja no hi ha paquet SPFx |
| D12 | Pujar la foto directament a una biblioteca des del web part: sense context de SharePoint no és possible sense autenticació pròpia |

---

## 13. Criteris d'acceptació globals

- [ ] Un bomber sense ajuda pot completar el procés en < 5 min a partir de les instruccions, des de l'enllaç fins a l'enviament del Forms.
- [ ] L'aplicació és **un sol fitxer HTML** que funciona amb doble clic a l'Edge dels equips corporatius, sense instal·lar res i sense permisos d'administrador.
- [ ] El fitxer desat es diu exactament `{matricula}.jpg`, fa 35:45, té la resolució configurada i densitat JFIF correcta.
- [ ] La foto és el que es veu al visor de P3 (enquadrament «visor», per defecte); amb enquadrament «cap», el cap ocupa ~75% de l'alçada (±5%) i està centrat.
- [ ] L'aplicació no fa **cap petició de xarxa** fins que l'usuari obre el Forms (comprovat a les eines de desenvolupador), i la guarda de build passa.
- [ ] No queda cap dada a l'emmagatzematge del navegador després del procés.
- [ ] La càmera s'apaga en acabar o en tancar la pestanya.
- [ ] El Forms s'obre amb la matrícula pre-omplerta.
- [ ] El flux de Power Automate deixa `{matricula}.jpg` a la carpeta destí i esborra l'original.
- [ ] La versió és visible a l'app i al nom del fitxer, i el SHA-256 es publica amb cada versió.
- [ ] Si s'obre en una vista prèvia sense scripts, es mostra el missatge per descarregar-lo.
- [ ] Es fan servir només els logos autoritzats (§6) i cap amb el 080.

---

## 14. Instruccions per a Claude Code

- Treballa **una fase cada vegada** (§11). En acabar una fase, resumeix què s'ha fet, com provar-ho, i espera confirmació abans de seguir.
- Tots els textos visibles en **català**, des de `ca.json`.
- El lliurable és **un únic fitxer HTML**: tot el codi i tots els recursos incrustats (RF-20). Res de CDN, res de fitxers externs, res de servidor.
- **No afegeixis cap dependència que faci peticions a internet** en temps d'execució. La guarda de build ho ha de detectar.
- Ha de funcionar a `file://` a Edge: sense `fetch` de fitxers locals ni mòduls ES externs.
- Codi en TypeScript estricte; funcions de càlcul d'imatge **pures i testejades**.
- Fes servir **només** els fitxers de `assets/brand/` (§6). No recreïs ni modifiquis cap logo.
- Els llindars van sempre a la configuració, mai al codi.
- Si una decisió de §12 bloqueja la feina, fes servir el valor provisional i deixa-ho anotat al README.
