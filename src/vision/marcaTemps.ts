let darreraMarca = 0;

/**
 * Marca de temps (ms) estrictament creixent, compartida per totes les crides a `detectForVideo`/`segmentForVideo`
 * (escalfament, bucle en directe i captura): MediaPipe en mode VIDEO exigeix marques creixents.
 */
export function marcaTemps(): number {
  darreraMarca = Math.max(darreraMarca + 1, Math.floor(performance.now()));
  return darreraMarca;
}
