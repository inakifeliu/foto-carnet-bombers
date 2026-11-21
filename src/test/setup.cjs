// jsdom no porta DecompressionStream ni Web Crypto: es prenen de Node (només per als tests).
const { DecompressionStream, CompressionStream } = require('node:stream/web');
const { webcrypto } = require('node:crypto');

if (typeof globalThis.DecompressionStream === 'undefined') {
  globalThis.DecompressionStream = DecompressionStream;
}
if (typeof globalThis.CompressionStream === 'undefined') {
  globalThis.CompressionStream = CompressionStream;
}
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
