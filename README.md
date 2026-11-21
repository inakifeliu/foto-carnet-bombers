# Foto Carnet Bombers de Barcelona

Aplicació en **un únic fitxer HTML** perquè els bombers del SPCPEIS es facin ells mateixos la foto de carnet amb el polo de l'uniforme: captura guiada amb webcam, retall automàtic a 35 × 45 mm, desat local com a `MATRICULA.jpg` i pujada via Microsoft Forms. El fitxer es distribueix per SharePoint, OneDrive o correu i s'obre amb doble clic a Edge, sense instal·lar res.

- Especificació completa (v0.3): [docs/ESPECIFICACIO.md](docs/ESPECIFICACIO.md)
- Estat: viabilitat a `file://` validada en un Surface (21/11/2026). **Pendent**: esquelet de la Fase 0 i repetir la prova en un equip de parc.
- La branca `fase-0/viabilitat-esquelet` conté la versió anterior com a web part SPFx (v0.2). Es manté com a arxiu i se'n reaprofitarà codi.

## Recursos gràfics

A `src/webparts/fotoCarnet/assets/brand/` (es mouran a `src/assets/brand/` a la Fase 0):

- `escut_bombers_color.png` — escut de Bombers en color (manual, p. 5)
- `segell_historic_bombers.png` — segell històric (manual, p. 5)
- `AJBCN_Sign_Com_Negre_Transparent_0.svg` — signatura de l'Ajuntament en negre (capçalera)
- `AJBCN_Sign_Com_Vermell_Transparent.svg` — signatura de l'Ajuntament en vermell `#FF2828` (peu i pantalla final)

No s'han de modificar ni recolorir (vegeu §6 de l'especificació).
