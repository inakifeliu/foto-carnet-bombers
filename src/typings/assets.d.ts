// Recursos binaris i scripts del paquet que Webpack emet com a `asset/resource`.
// En importar-los s'obté la URL final (dins els ClientSideAssets del paquet).
declare module '*.task' {
  const url: string;
  export default url;
}

declare module '*.tflite' {
  const url: string;
  export default url;
}

declare module '*.wasm' {
  const url: string;
  export default url;
}

// Loaders JS de MediaPipe (no s'empaqueten dins el bundle: es carreguen per URL).
declare module '*/vision_wasm_internal.js' {
  const url: string;
  export default url;
}

declare module '*/vision_wasm_module_internal.js' {
  const url: string;
  export default url;
}
