import "server-only";
import { Types } from "mongoose";
import { Book, User } from "@/models";
import type { CloudinaryImage, LoanBookRef, LoanMemberRef } from "@/types";

/**
 * Batched reference lookups for lists that show a book or a member per row (specs 11, 13).
 *
 * **These live here, not in `services/circulation.ts`, for one reason: imports.**
 * `fines.ts` needs the same shapes as `circulation.ts`, and having `fines.ts` import them
 * from `circulation.ts` while `circulation.ts` imports `createFineIfLate` from `fines.ts`
 * makes the two modules mutually dependent. That resolves at runtime today only because
 * every call happens inside a function body, after both modules have finished evaluating —
 * which is exactly the kind of accident that breaks the next time someone adds a
 * module-level constant that reads an import. Three consumers, one home.
 *
 * Each helper is one `$in` query plus a `Map` keyed by **string**, so callers never have to
 * think about `ObjectId` equality, mirroring `categoryMap` in `services/books.ts`.
 */

/** Book references for a set of ids, in one query. */
export async function bookRefs(ids: unknown[]): Promise<Map<string, LoanBookRef>> {
  const refs = new Map<string, LoanBookRef>();

  const unique = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (unique.length === 0) return refs;

  const docs = await Book.find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } })
    .select("title slug authors cover")
    .lean<Array<Record<string, unknown>>>();

  for (const doc of docs) {
    refs.set(String(doc._id), {
      id: String(doc._id),
      title: String(doc.title ?? ""),
      slug: String(doc.slug ?? ""),
      authors: Array.isArray(doc.authors) ? (doc.authors as string[]) : [],
      cover: (doc.cover as CloudinaryImage | null) ?? null,
    });
  }

  return refs;
}

/**
 * A row's book, or an honest placeholder if the book is gone.
 *
 * Deletion is refused while a book has loan history, so this should not happen — but
 * "should not happen" is exactly the assumption that produces a blank row. A named
 * placeholder renders; `undefined` crashes the list.
 */
export function bookRefOr(refs: Map<string, LoanBookRef>, id: unknown): LoanBookRef {
  return (
    refs.get(String(id)) ?? {
      id: String(id),
      title: "No longer in the catalog",
      slug: "",
      authors: [],
      cover: null,
    }
  );
}

/**
 * Member references for a set of ids, in one query.
 *
 * **The email is deliberately not selected.** A loan or fine row never needs it, and these
 * lists are read by staff who can already see every member's email — including it would
 * widen the payload and the audit surface for nothing.
 */
export async function memberRefs(ids: unknown[]): Promise<Map<string, LoanMemberRef>> {
  const refs = new Map<string, LoanMemberRef>();

  const unique = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (unique.length === 0) return refs;

  const docs = await User.find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } })
    .select("name membershipId avatar")
    .lean<Array<Record<string, unknown>>>();

  for (const doc of docs) {
    refs.set(String(doc._id), {
      id: String(doc._id),
      name: String(doc.name ?? ""),
      membershipId: (doc.membershipId as string | null) ?? null,
      avatar: (doc.avatar as CloudinaryImage | null) ?? null,
    });
  }

  return refs;
}

/** A row's member, or a placeholder rather than a crash. */
export function memberRefOr(refs: Map<string, LoanMemberRef>, id: unknown): LoanMemberRef {
  return (
    refs.get(String(id)) ?? {
      id: String(id),
      name: "Unknown member",
      membershipId: null,
      avatar: null,
    }
  );
}