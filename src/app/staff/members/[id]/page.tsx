import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getMemberDetail } from "@/lib/services/members";
import { PageHeader } from "@/components/common/page-header";
import { MemberHeader } from "@/components/features/members/member-header";
import { MemberTabs } from "@/components/features/members/member-tabs";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;

  const member = await getMemberOrNull(id);
  if (!member) return { title: "Member not found" };

  return {
    title: member.name,
    description: `Member record for ${member.name}, including status and loan history.`,
  };
}

/**
 * Member detail (spec 10).
 *
 * A Server Component on purpose: `getMemberDetail` reads Mongo directly, so there is
 * no HTTP hop back into our own API for data this process already has.
 *
 * **No manual serialization step.** `getMemberDetail` reads `.lean()` and maps through
 * `toMember`, so it already returns a plain object with `Date`s and string ids — the
 * same shape the API route sends. Passing a Mongoose *document* across a
 * `"use client"` boundary is what needs care, and there is no document here.
 */
export default async function MemberDetailPage({ params }: Params) {
  // Defence in depth: the layout guards the section, but this route reads a record by
  // id, so it asserts access itself. An anonymous request should never reach the query.
  await requireStaff();

  const { id } = await params;
  const member = await getMemberOrNull(id);

  if (!member) notFound();

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Member record"
        description="Everything the circulation desk needs about one member."
        action={
          <Link
            href="/staff/members"
            className="inline-flex items-center gap-1.5 text-small font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back to members
          </Link>
        }
      />

      <MemberHeader member={member} />

      <MemberTabs />
    </div>
  );
}

/**
 * Resolve a member, or `null` when it does not exist.
 *
 * `getMemberDetail` throws `AppError` for a bad or unknown id, which is what an API
 * route wants but wrong for a page: a page wants the 404 boundary, not an exception.
 * Wrapping it here keeps the page from knowing about error codes.
 */
async function getMemberOrNull(id: string) {
  try {
    return await getMemberDetail(id);
  } catch {
    return null;
  }
}
