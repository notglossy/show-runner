import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hmacSha256 = (key: string, value: string) =>
  createHmac('sha256', key).update(value).digest('hex');

/** 256-bit URL-safe random token. */
export const randomToken = () => randomBytes(32).toString('base64url');

/** Constant-time string comparison (hashes first so length differences don't leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}

// No 0/O, 1/I/L: readable across a room.
const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomPairingCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  return code;
}
