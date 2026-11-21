/**
 * Pegat que neutralitza la telemetria de @mediapipe/tasks-vision 1.2.3.
 *
 * El bundle de MediaPipe (vision_bundle.mjs / .cjs / .js) conté una classe de "logging"
 * que SEMPRE es construeix amb la tasca: el constructor crea un setInterval(flush, 60 s) i
 * flush()/close() fan un POST a https://odml.pa.googleapis.com/v1/log amb una x-goog-api-key.
 * L'especificació (§5) prohibeix qualsevol telemetria o petició externa.
 *
 * Per què un plugin d'esbuild (scripts/construeix.mjs) i no patch-package: s'aplica sempre que
 * es compila (no depèn que `postinstall` s'executi, com passa amb `npm ci --ignore-scripts`),
 * cobreix de cop les tres variants del bundle i FALLA el build si el patró no es troba (p. ex.
 * en pujar de versió de MediaPipe), en lloc de deixar passar la telemetria en silenci.
 *
 * Cada substitució ha de coincidir exactament una vegada.
 */

/** Substitucions [descripció, expressió, reemplaçament]. Independents dels noms minificats. */
export const SUBSTITUCIONS = [
  [
    'interval de flush',
    /this\.h=setInterval\(\(\)=>\{this\.flush\(\)\},6e4\)/g,
    // Sense interval; `error` truthy fa que la cua d'esdeveniments no s'ompli mai.
    'this.h=void 0,this.error=Error("telemetria desactivada")'
  ],
  [
    'flush',
    /flush\(t,e\)\{if\(this\.error\)/g,
    // flush() passa a ser un no-op que només crida el callback; el cos original queda com a
    // codi mort sota un altre nom (sense cap URL, vegeu la substitució següent).
    'flush(t,e){return void(t&&t())}_flushDesactivat(t,e){if(this.error)'
  ],
  ['URL de telemetria', /"https:\/\/odml\.pa\.googleapis\.com\/v1\/log"/g, '""']
];

export function aplica(codi) {
  let resultat = codi;
  for (const [descripcio, expressio, reemplacament] of SUBSTITUCIONS) {
    const coincidencies = resultat.match(expressio);
    if (!coincidencies || coincidencies.length !== 1) {
      throw new Error(
        `mediapipe-sense-telemetria: no s'ha pogut neutralitzar "${descripcio}" ` +
          `(coincidències: ${coincidencies ? coincidencies.length : 0}, esperat: 1). ` +
          `Ha canviat la versió de @mediapipe/tasks-vision? Revisa scripts/mediapipe-sense-telemetria.mjs.`
      );
    }
    resultat = resultat.replace(expressio, () => reemplacament);
  }
  return resultat;
}

export default aplica;
