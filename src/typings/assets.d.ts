/** Els logos s'incrusten com a URI `data:` en compilar (scripts/construeix.mjs). */
declare module '*.svg' {
  const uri: string;
  export default uri;
}

declare module '*.png' {
  const uri: string;
  export default uri;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
