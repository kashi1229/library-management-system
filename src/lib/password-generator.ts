/**
 * Temporary-password generator, shared by the client and the server.
 *
 * **Deliberately not `server-only`.** The "Add librarian" dialog generates the password
 * in the browser so the admin can read it before committing, and the server-side reset
 * generates one in the same shape. Two implementations would drift on the alphabet and
 * the letter/digit guarantee, so there is one, and both call it.
 *
 * Uses `crypto.getRandomValues` because this value **is a credential**. `Math.random`
 * is not a CSPRNG and would make every generated password guessable in principle.
 * That API exists in both the browser and Node 19+, so no polyfill and no
 * `node:crypto` import is needed — which is what keeps this file client-safe.
 *
 * Excludes `0`/`O`/`1`/`l`/`I`: these passwords get read off a screen once and typed
 * by hand at a desk, and those five characters are ambiguous in most sans-serif faces.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Index of the first digit: 26 upper + 26 lower letters. */
const FIRST_DIGIT_INDEX = 52;

export const TEMP_PASSWORD_LENGTH = 10;

/** A uniform integer in `[0, max)`, free of modulo bias. */
function randomIndex(max: number): number {
  if (max <= 0) return 0;

  // `getRandomValues` rejects a request above 65536 bytes, and the largest rejection
  // window we need here is far smaller than that.
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);

  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);

  return buffer[0] % max;
}

/**
 * Generate a temporary password.
 *
 * Guaranteed to contain **at least one letter and one digit**, because the shared
 * password policy requires both — a generated password that failed its own validator
 * would hand the admin an unusable credential. The Fisher-Yates shuffle below means
 * those two are not always in the same positions, so the result is not recognisable as
 * "a generated password" by its shape.
 */
export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  const size = Math.max(8, Math.min(64, Math.trunc(length)));

  const chars: string[] = [
    ALPHABET[randomIndex(FIRST_DIGIT_INDEX)],
    ALPHABET[randomIndex(FIRST_DIGIT_INDEX)],
    ALPHABET[FIRST_DIGIT_INDEX + randomIndex(ALPHABET.length - FIRST_DIGIT_INDEX)],
  ];

  while (chars.length < size) {
    chars.push(ALPHABET[randomIndex(ALPHABET.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}