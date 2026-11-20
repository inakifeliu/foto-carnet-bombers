function nomError(e: unknown): string {
  return e instanceof DOMException || e instanceof Error ? e.name : '';
}

export function missatgeErrorCamera(e: unknown): string {
  switch (nomError(e)) {
    case 'NotAllowedError':
      return "S'ha denegat el permís de càmera. Permet-lo a la icona del cadenat de la barra d'adreces i torna-ho a provar.";
    case 'NotFoundError':
      return "No s'ha trobat cap càmera connectada a aquest equip.";
    case 'NotReadableError':
      return 'La càmera està ocupada per una altra aplicació (per exemple Teams). Tanca-la i torna-ho a provar.';
    case 'OverconstrainedError':
      return 'La càmera no compleix la resolució sol·licitada.';
    default:
      return "No s'ha pogut obrir la càmera: " + String(e);
  }
}

export function missatgeErrorDesar(e: unknown): string {
  if (nomError(e) === 'NotAllowedError') {
    return "No s'ha permès escriure el fitxer en aquesta ubicació.";
  }
  return "No s'ha pogut desar la imatge: " + String(e);
}
