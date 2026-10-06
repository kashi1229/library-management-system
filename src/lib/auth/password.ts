import "server-only";
import bcrypt from "bcryptjs";

/**
 * Password hashing (bcrypt, cost 10 per `project-overview.md` F1).
 *
 * Wrapped in one module so the cost factor is defined in exactly one place and
 * `passwordHash` never has to be handled by a caller.
 *
 * The temporary-password **generator** lives in `lib/password-generator.ts` instead,
 * because the "Add librarian" dialog generates one in the browser and both sides must
 * produce the same shape. That module is not `server-only` and does not import this one.
 */

const BCRYPT_COST = 10;

/** Hash a plaintext password. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Compare a plaintext candidate against a stored hash.
 * Returns `false` rather than throwing on a malformed hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export { generateTempPassword, TEMP_PASSWORD_LENGTH } from "@/lib/password-generator";