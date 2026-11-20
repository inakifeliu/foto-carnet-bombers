'use strict';

const path = require('path');

/**
 * Personalització de la configuració de Webpack de SPFx (heft, SPFx 1.24).
 *
 * Els models de MediaPipe (.task, .tflite), el binari WASM i el loader JS de
 * MediaPipe s'emeten com a `asset/resource`: no entren dins del bundle JS i, en
 * importar-los des del codi, s'obté la seva URL final dins els recursos del
 * paquet (ClientSideAssets). Així no es carrega res d'una CDN externa.
 */
module.exports = function customizeWebpack(config) {
  const rules = config.module.rules;

  // Neutralitza la telemetria de MediaPipe (POST a odml.pa.googleapis.com, spec §5).
  // S'aplica a totes les variants del bundle que Webpack podria resoldre (.mjs/.cjs/.js).
  rules.push({
    test: /[\\/]@mediapipe[\\/]tasks-vision[\\/]vision_bundle\.(mjs|cjs|js)$/,
    enforce: 'pre',
    loader: path.resolve(__dirname, 'mediapipe-sense-telemetria.js')
  });

  rules.push({
    test: /\.(task|tflite|wasm)$/i,
    type: 'asset/resource'
  });

  // El loader JS de MediaPipe s'ha de servir com a fitxer independent (es carrega
  // amb un <script src> en temps d'execució), no s'ha d'incloure al bundle.
  rules.push({
    test: /[\\/]assets[\\/]wasm[\\/].*\.js$/i,
    type: 'asset/resource'
  });
};
