// Els mòduls CSS es resolen a un proxy que retorna el nom de la classe tal qual.
module.exports = new Proxy({}, { get: (_o, nom) => (nom === '__esModule' ? false : String(nom)) });
