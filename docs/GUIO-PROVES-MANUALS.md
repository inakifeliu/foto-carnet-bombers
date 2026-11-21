# Guió de proves manuals del fitxer final

Guió pas a pas per provar `foto-carnet-bombers-vX.Y.Z.html` abans del pilot (Fase 4 i Fase 5). Es pot repetir a cada versió nova. Les proves automàtiques (`npm test`, `npm run prova-edge`) no substitueixen aquestes: la càmera real, el diàleg de Windows, el Forms real i els equips de parc només es poden provar a mà.

## 0. Preparació

- [ ] Tens l'HTML i el seu `.sha256` de la mateixa versió (nom: `foto-carnet-bombers-vX.Y.Z.html`).
- [ ] Comprova el hash a PowerShell, des de la carpeta del fitxer:
  `Get-FileHash -Algorithm SHA256 .\foto-carnet-bombers-vX.Y.Z.html` i compara el valor `Hash` amb el del `.sha256`. Han de ser iguals.
- [ ] Apunta a la taula de resultats (final del document): equip (model, Windows, Edge), webcam, tipus de llum i data.
- [ ] Obre Edge, prem **F12** (eines de desenvolupador) i deixa la pestanya **Xarxa (Network)** oberta **abans** d'obrir el fitxer, amb «Conserva el registre» marcat.
- [ ] Tingues a mà el polo blau de l'uniforme amb les galetes (categoria laboral i nom/matrícula) i una paret blanca.

Una matrícula de prova vàlida és `12345` (4-6 dígits).

## 1. Matriu de proves (equips, webcams i llums)

Repeteix el **flux complet (secció 2)** com a mínim en aquestes combinacions i omple la taula del final.

| Eix | Combinacions a provar |
| --- | --- |
| Equip | Surface (ja provat a les Fases 0-3), un portàtil de parc, un sobretaula de parc, un equip antic (el més lent que hi hagi) |
| Webcam | La integrada del portàtil, una webcam USB externa, una webcam de 720p o menys (si n'hi ha) |
| Llum | Llum de dia amb finestra **de cara**, llum artificial de sostre, llum amb finestra **al darrere** (ha de dir «Massa fosc» o similar), llum de nit |
| Persona | Una persona amb ulleres graduades, una amb barba o cabell llarg, una amb pell fosca i una amb pell clara (els controls de llum i fons han de funcionar igual) |

## 2. Flux complet P0 → P7

Anota qualsevol cosa estranya a «Observacions». Marca cada pas.

### P0 — Benvinguda
- [ ] Doble clic al fitxer: s'obre a Edge en pocs segons i no demana res més.
- [ ] Es veu la capçalera (signatura de l'Ajuntament a l'esquerra i escut de Bombers a la dreta), l'escut en color i el segell històric, el títol «Foto de carnet amb uniforme» i el text de privacitat.
- [ ] Al peu: signatura vermella, «Servei de Prevenció, Protecció Civil, Extinció d'Incendis i Salvaments» i **versió i data** (han de ser les del fitxer).
- [ ] Els logos no estan deformats ni retallats ni tenen cap color estrany.
- [ ] Botó **Començar**.

### P1 — Instruccions
- [ ] 9 punts, cadascun amb la seva il·lustració i el text; tots es llegeixen bé.
- [ ] «Enrere» torna a P0; «Entesos, continuar» va a P2.

### P2 — Matrícula
- [ ] Amb el camp buit i «Continuar»: error clar.
- [ ] Amb `12a45`, `123`, `1234567` i espais: error clar (també prement Enter).
- [ ] Amb `12345`: apareix «La teva matrícula és 12345? Serà el nom de la foto.»
- [ ] No hi ha cap text d'ajuda del tipus «Escriu la teva matrícula…».
- [ ] «Continuar» demana el permís de càmera. Amb `file://`, Edge pot tornar-lo a demanar cada vegada que s'obre el fitxer: és normal.

### P3 — Captura guiada
- [ ] El vídeo es veu en **mirall** (si aixeques la mà dreta, la veus a la dreta de la imatge) i amb la silueta guia.
- [ ] Surten els semàfors i un missatge gran amb **una sola** indicació alhora. Es mouen amb una mica de retard raonable, sense parpellejar.
- [ ] Prova cada control: acostar-se i allunyar-se, desplaçar-se a l'esquerra i a la dreta, girar el cap, abaixar i aixecar la barbeta, tancar els ulls, obrir la boca, tapar-se mig rostre amb l'ombra, apagar el llum, posar-se davant d'un fons de color, treure's el polo o tapar-lo.
- [ ] Els missatges direccionals són correctes (si diu «Gira el cap a l'esquerra», girar-lo a l'esquerra millora). Si van al revés, apunta-ho (calibratge: `yawSigne`/`pitchSigne`).
- [ ] **Captura automàtica**: amb tot en verd durant ~1 s surt el compte enrere 3-2-1 i es fa la foto. Si durant el compte et mous i un control passa a vermell, es cancel·la.
- [ ] **Cancel·lar** durant el compte: s'atura i no es reinicia al moment.
- [ ] **Temporitzador** («Foto en 5 s»): fa la foto als 5 s i no conviu amb la captura automàtica.
- [ ] **Fer la foto ara** amb controls no verds: demana confirmació («Hi ha aspectes a millorar. Vols fer-la igualment?»); amb tot verd, la fa directament.
- [ ] Després de cada foto: miniatura, «Foto n de 3», «Fer-ne una altra» i «Ja en tinc prou». Màxim 3 fotos; a la tercera ja no surt «Fer-ne una altra».
- [ ] **Selector de càmera**: amb més d'una càmera, es pot canviar i el vídeo continua.
- [ ] Si la càmera és de menys de 1280 × 720, surt l'avís (no bloquejant).
- [ ] Accessibilitat: amb Tab es pot arribar a tots els botons i es veu on és el focus.

### P4 — Selecció
- [ ] Les fotos surten ja retallades (format 35:45) amb la seva puntuació (0-100) i els avisos.
- [ ] La de més puntuació ve marcada com a «Millor puntuació».
- [ ] «Triar aquesta» continua a P5; «Repetir les fotos» torna a P3 amb el comptador a «Foto 1 de 3».

### P5 — Desar
- [ ] Vista prèvia gran i «Nom del fitxer: 12345.jpg».
- [ ] «Desar la foto» obre el diàleg de Windows amb el nom `12345.jpg` i la carpeta **Imatges**.
- [ ] Si cancel·les el diàleg: et quedes a P5 sense error i ho pots tornar a provar.
- [ ] En desar: continua a P6.

### P6 — Pujar al Forms
- [ ] Modal amb les 4 instruccions, amb la carpeta i el nom reals (`12345.jpg`).
- [ ] «Obrir el formulari» obre una pestanya nova amb el **Forms real i la matrícula ja escrita**. No s'ha bloquejat cap finestra emergent.
- [ ] L'enllaç «Si no s'ha obert, obre el formulari des d'aquest enllaç» funciona.
- [ ] Pujar la foto al Forms amb «Penja el fitxer» des de Imatges i enviar-lo.
- [ ] Sense connexió (desconnecta la xarxa): surt l'avís «Cal connexió a internet…» i la foto ja és desada.
- [ ] Escape tanca el modal; amb Tab el focus no surt del modal; en tancar, el focus torna a «Mostrar les instruccions».
- [ ] «Ja l'he enviat» continua a P7.

### P7 — Final
- [ ] Missatge d'agraïment, segell històric i recordatori amb el nom i la carpeta.
- [ ] «Esborrar la foto de l'equip» (si Edge ho permet): demana permís, esborra el fitxer i ho confirma. **Comprova a l'Explorador que el fitxer ja no hi és (RF-15).**
- [ ] Si denegues el permís, el botó desapareix i queda el recordatori.
- [ ] «Començar de nou» torna a P0 i la càmera **s'apaga** (el llum de la webcam s'apaga).
- [ ] Tancar la pestanya també apaga la càmera.

## 3. Comprovacions del fitxer desat

Desa una foto i comprova-la a l'Explorador de fitxers de Windows (clic dret → *Propietats* → *Detalls*), o amb un visor d'imatges.

- [ ] Nom exacte: `{matricula}.jpg` (p. ex. `12345.jpg`), a la carpeta **Imatges** (o a Baixades si el navegador no permet triar carpeta; llavors els textos de P6 i P7 han de dir «Baixades»).
- [ ] Dimensions: **413 × 531 píxels** (300 ppp; amb 600 ppp serien 827 × 1063).
- [ ] Resolució horitzontal i vertical: **300 ppp**.
- [ ] La imatge **no està invertida** (el mirall només és a la pantalla): un rètol o el nom de la galeta es llegeix bé.
- [ ] La foto és el que es veia al visor de P3 (cap, espatlles i part del polo; enquadrament «visor»).
- [ ] Format 35:45 i fons blanc, sense franges.
- [ ] El fitxer no porta dades EXIF (cap ubicació ni model de càmera).

## 4. Comprovació de xarxa i privacitat

- [ ] A la pestanya **Xarxa** de les eines de desenvolupador, des que s'obre el fitxer fins a P5 **no hi ha cap petició** (cap fila, o només el propi fitxer `file://`). Cap domini de Google, cap telemetria.
- [ ] A la **Consola** no hi ha errors en vermell.
- [ ] Només en prémer «Obrir el formulari» s'obre una pestanya nova cap al Forms; aquest tràfic és del Forms, no de l'app.
- [ ] Application → Storage: després del procés no hi ha dades a Local storage, Session storage, IndexedDB ni Cache.
- [ ] Mode diagnòstic (**Ctrl + Alt + D**): no mostra cap imatge i «Comprovar els recursos incrustats» diu que tots són correctes.
- [ ] Rendiment (al diagnòstic): anàlisi ≥ 10 fps en un equip estàndard; apunta els fps i el delegat (GPU/CPU).
- [ ] Temps d'obertura i càrrega del model < 5 s.

## 5. Casos d'error

| Cas | Com provar-ho | Resultat esperat | OK |
| --- | --- | --- | --- |
| Sense càmera | Desconnecta la webcam externa (o desactiva-la al Gestor de dispositius) i arriba a P3 | Missatge «No s'ha trobat cap càmera…» i botó «Tornar a provar»; en connectar-la i tornar-ho a provar, funciona | [ ] |
| Permís denegat | A P2 prem «Continuar» i, al diàleg d'Edge, tria **Bloqueja** | Missatge sobre com permetre la càmera a la icona de la barra d'adreces; després de permetre-la, «Tornar a provar» funciona | [ ] |
| Càmera ocupada | Obre Teams, Zoom o la Càmera de Windows amb la webcam encesa i arriba a P3 | Missatge «La càmera la fa servir una altra aplicació…»; en tancar-la i «Tornar a provar», funciona | [ ] |
| Sense WebGL / mode manual | Edge → `edge://settings/system` → desactiva «Usa l'acceleració per maquinari» i reinicia (o `msedge --disable-gpu --disable-software-rasterizer`) | P0 avisa que no hi haurà anàlisi automàtica; a P3 no hi ha semàfors però «Fer la foto ara» funciona (retall centrat, sense puntuació) | [ ] |
| Equip lent | En un equip antic, observa P3 | Si l'anàlisi va massa lenta, s'atura amb un avís i la captura manual continua | [ ] |
| Vista prèvia sense scripts (RF-19) | Adjunta el fitxer a un correu i previsualitza'l a Outlook, o obre'l a la vista prèvia d'OneDrive/SharePoint | Surt «Descarrega aquest fitxer a l'ordinador i obre'l amb Microsoft Edge.» (sense càmera ni errors) | [ ] |
| Iframe (RF-19) | Obre una pàgina HTML local amb `<iframe src="…/foto-carnet-bombers-vX.Y.Z.html">` | Missatge «Obre el fitxer a l'ordinador» amb capçalera i peu, sense demanar la càmera | [ ] |
| Navegador no compatible | Obre el fitxer amb un navegador antic o sense `getUserMedia` (si n'hi ha cap) | «Aquest navegador no és compatible. Obre el fitxer amb Microsoft Edge.» | [ ] |
| Sense JavaScript | Desactiva els scripts del navegador (`edge://settings/content/javascript`) i obre'l | Surt el missatge estàtic de descarregar el fitxer | [ ] |
| Diàleg de desat cancel·lat | A P5 prem «Cancel·lar» al diàleg | Es queda a P5 sense error | [ ] |
| Pàgina enrere/endavant | Des de P7 clica el botó «Enrere» del navegador i torna endavant | Tot torna a P0 (res de la sessió anterior queda en memòria) | [ ] |

## 6. Accessibilitat i finestres

- [ ] Navegació amb **només el teclat** de P0 a P7: Tab/Maj+Tab, Enter i Espai, sense necessitar el ratolí.
- [ ] En canviar de pantalla, el focus va al **títol** de la pantalla nova (es veu un contorn al títol).
- [ ] El focus es veu clarament a cada botó, camp i enllaç.
- [ ] Amb un lector de pantalla (Narrator: Windows + Ctrl + Enter): cada pantalla té un sol títol principal; els missatges de guia de P3 s'anuncien només quan canvien, no contínuament; els modals s'anuncien com a diàleg.
- [ ] Amb l'opció de Windows «Mostra animacions» desactivada no hi ha moviments innecessaris.
- [ ] Finestra a pantalla completa (≥ 1280 px): l'aspecte és sobri i amb molt d'espai.
- [ ] Finestra estreta (arrossega el costat fins a ~360 px): **no hi ha scroll horitzontal** a cap pantalla i tot es continua llegint.
- [ ] Zoom del navegador al 150 % i 200 %: tot es continua llegint i usant.

## 7. Proves de distribució (spec §10)

| Prova | Com | Resultat esperat | OK |
| --- | --- | --- | --- |
| SharePoint | Puja el fitxer a la biblioteca oficial; des d'un **equip de parc** obre l'enllaç i prem *Descarregar* | Es descarrega sencer (comprova la mida i el SHA-256) i s'obre amb doble clic a Edge | [ ] |
| OneDrive | El mateix des d'OneDrive (enllaç compartit) | El mateix | [ ] |
| Adjunt de correu | Envia't el fitxer com a adjunt i prova de baixar-lo des d'Outlook | Apunta si el filtre (Defender for Office 365) el bloqueja, el posa en quarantena o el deixa passar, i amb quina mida/nom | [ ] |
| Vista prèvia | Clica el fitxer a SharePoint, OneDrive i Outlook sense descarregar-lo | Surt el missatge de descarregar-lo (RF-19) i no es demana la càmera | [ ] |
| Mark of the Web | Després de baixar-lo, clic dret → *Propietats*: mira si hi ha la casella **Desbloqueja** i si Windows/Edge avisen o bloquegen en obrir-lo | Si està bloquejat: marca *Desbloqueja* → *D'acord* i prova-ho de nou; ha de funcionar. Apunta quins equips ho necessiten | [ ] |
| Obrir amb | Si el navegador per defecte no és Edge: clic dret → *Obre amb* → Microsoft Edge | S'obre i funciona | [ ] |
| Versió | Compara la versió del peu amb el nom del fitxer | Coincideixen | [ ] |
| Actualització | Publica una versió nova i treu l'antiga | L'enllaç oficial només porta la nova; qui té l'antiga veu la versió al peu | [ ] |

## 8. Taula de resultats

Una fila per combinació provada. Resultat: **OK**, **OK amb observacions** o **FALLA**.

| Data | Versió | Equip (model, Windows, Edge) | Webcam | Llum | Persona | Resultat | Observacions |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |

### Resultats de la distribució

| Data | Canal | Equip | Resultat | Cal «Desbloqueja»? | Observacions |
| --- | --- | --- | --- | --- | --- |
|  | SharePoint |  |  |  |  |
|  | OneDrive |  |  |  |  |
|  | Adjunt de correu |  |  |  |  |
|  | Vista prèvia |  |  |  |  |

Si alguna prova falla, anota el pas, l'equip, la versió i, si pot ser, una captura de pantalla **sense** la teva cara (el mode diagnòstic mai mostra imatges) i el JSON de diagnòstic (Ctrl + Alt + D → «Descarregar JSON de diagnòstic»).
