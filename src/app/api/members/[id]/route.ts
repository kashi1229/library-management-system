import { handler, ok, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { getMemberDetail } from "@/lib/services/members";
import { memberIdSchema } from "@/lib/validators/members";

/** GET /api/members/:id — staff. Detail plus the four summary counts. */
export const GET = handler(async (_request, { params }) => {
  await requireStaff();
  const { id } = await parseParams(memberIdSchema, params);

  const member = await getMemberDetail(id);
  return ok({ member });
}, { name: "GET /api/members/:id" });