import { Types } from "mongoose";
import { AppError, handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { runMaintenance } from "@/lib/services/maintenance";
import { isValidCronSecret } from "@/lib/cron-secret";

/**
 * POST /api/maintenance/run — the maintenance job, on demand.
 *
 * **Two callers, and the check for each is independent of the other:**
 *
 * 1. An **admin session** (the "Run maintenance" button in Unit 19's Settings page). The run is
 *    audited against that admin, because somebody pressed the button and somebody is
 *    responsible for what it did.
 * 2. **An external scheduler** presenting `x-cron-secret`. There is no user at all here, so no
 *    audit row is written — inventing a "system" actor is exactly what Units 13 and 14 got
 *    wrong on the automatic fine and the automatic reservation expiry. The clock did it.
 *
 * **A signed-in member is a 403 even when the secret is correct.** A valid secret identifies a
 * *deployment*, not a person, and this job moves copies between books and writes notices to
 * members; it stays behind a role. The role check runs **first**, so a member's session cannot
 * be upgraded by adding a header.
 *
 * `getSession()` rather than `requireAdmin()`, because the two callers are alternatives rather
 * than a sequence: an unauthenticated cron request must not fail as "not signed in" before the
 * secret has been considered at all.
 *
 * **The refusal distinguishes "no access" from "wrong key"** and nothing more. A member gets the
 * first and a scheduler gets the second, because they are different problems for whoever is
 * configuring the deployment. It never says anything about the secret itself.
 */
export const POST = handler(async (request) => {
  const session = await getSession();
  const providedSecret = request.headers.get("x-cron-secret");

  // A signed-in account's role is what decides, and it decides on its own: the header is only
  // consulted for a caller with no session at all.
  if (session) {
    if (session.role !== "admin") {
      throw AppError.forbidden("Only an administrator can run maintenance.");
    }

    /*
     * The actor id is converted rather than cast. `session.sub` is a **string** (it came out of
     * the JWT payload) and `Actor.id` is an `ObjectId`; `as` would silence the compiler while
     * leaving a string where `logAudit` does `new Types.ObjectId(entityId)` and every downstream
     * comparison. This is the Unit 08 RSC-boundary lesson at a different boundary: a cast hides
     * the only thing that would have caught it.
     */
    const counts = await runMaintenance({
      actor: { id: new Types.ObjectId(session.sub), role: session.role },
    });

    return ok({ counts, triggeredBy: "admin" });
  }

  if (providedSecret && !isValidCronSecret(providedSecret)) {
    throw AppError.forbidden("That maintenance key is not valid.");
  }

  if (!isValidCronSecret(providedSecret)) {
    throw AppError.forbidden("Only an administrator or the maintenance key can run this job.");
  }

  const counts = await runMaintenance();

  return ok({ counts, triggeredBy: "cron" });
}, { name: "POST /api/maintenance/run" });