import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const publicFiles = new Map([
  ['index.html', 'index.html'],
  ['favicon.svg', 'favicon.svg'],
  ['src/main.js', 'src/main.js'],
  ['src/totp.js', 'src/totp.js'],
  ['src/styles.css', 'src/styles.css'],
  ['vendor/otpauth.js', 'node_modules/otpauth/dist/otpauth.esm.min.js'],
  ['vendor/otpauth.esm.min.js.map', 'node_modules/otpauth/dist/otpauth.esm.min.js.map'],
  ['vendor/OTPAuth-LICENSE.txt', 'node_modules/otpauth/LICENSE.md'],
  ['vendor/noble-hashes-LICENSE.txt', 'node_modules/@noble/hashes/LICENSE'],
]);
