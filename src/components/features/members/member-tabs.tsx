"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookMarked,
  CalendarClock,
  CircleCheck,
  Hourglass,
  Receipt,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { BookCover } from "@/components/common/book-cover";
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils";
import { MEMBER_HISTORY_LIMIT } from "@/lib/constants";
import type { MemberFine, MemberLoan, MemberRecord, MemberReservation } from "@/lib/api-client";

/**
 * The member record's tabs (spec 10).
 *
 * **Every tab reads real data from `MemberRecord`.** The first version of this file
 * rendered "arrives with the circulation work" placeholders for Loans, Fines and
 * Reservations, on the reasoning that those units had not been built. That was wrong on
 * two counts: the `Loan`, `Fine` and `Reservation` collections and their indexes have
 * existed since Unit 02, so the data was there to read; and a librarian looking at a
 * member record is trying to answer a question about that member *now*, not discover
 * which units are unfinished. A tab that says "not built yet" is not an honest
 * placeholder, it is a broken page.
 *
 * Only two things remain genuinely unbuilt, and they are stated as such where they
 * appear: the actions inside each tab (issue a book, take a payment) belong to the
 * circulation and fines units, and each row says which screen will do it.
 */
export function MemberTabs({ member }: { member: MemberRecord }) {
  return (
    <Tabs defaultValue="overview" className="space-y-5">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">
          <UserRound className="size-4" aria-hidden="true" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="loans">
          <BookMarked className="size-4" aria-hidden="true" />
          Loans
          <TabCount count={member.activeLoans} />
        </TabsTrigger>
        <TabsTrigger value="fines">
          <Receipt className="size-4" aria-hidden="true" />
          Fines
          {member.unpaidFines > 0 ? (
            <TabCount count={member.unpaidFines} tone="danger" />
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="reservations">
          <Hourglass className="size-4" aria-hidden="true" />
          Reservations
          {member.activeReservations > 0 ? (
            <TabCount count={member.activeReservations} tone="info" />
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewPanel member={member} />
      </TabsContent>

      <TabsContent value="loans">
        <LoansPanel member={member} />
      </TabsContent>

      <TabsContent value="fines">
        <FinesPanel member={member} />
      </TabsContent>

      <TabsContent value="reservations">
        <ReservationsPanel member={member} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * A count on the tab itself.
 *
 * Carries `aria-hidden` and is decorative: the tab label already reads "Loans", and a
 * screen reader announcing "Loans 3" on top of that is noise rather than information.
 */
function TabCount({ count, tone = "neutral" }: { count: number; tone?: "neutral" | "danger" | "info" }) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className={
        tone === "danger"
          ? "ms-0.5 rounded-full bg-danger-soft px-1.5 py-px font-mono text-[11px] text-danger-ink"
          : tone === "info"
            ? "ms-0.5 rounded-full bg-info-soft px-1.5 py-px font-mono text-[11px] text-info-ink"
            : "ms-0.5 rounded-full bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground"
      }
    >
      {count}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Overview: what the header does not already show.
 *
 * The header answers "who is this and what can I do about it". This answers "what is
 * their standing right now" — borrowing, money, holds — as a breakdown the four KPI
 * numbers cannot express, plus the account facts a desk clerk asks for.
 *
 * The breakdown is **computed from the rows already on the record**, not from extra
 * aggregate queries. The lists are capped, so these are labelled "in the recent
 * activity" where a cap could bite, rather than presented as lifetime figures.
 */
function OverviewPanel({ member }: { member: MemberRecord }) {
  const loans = member.loans;
  const overdue = loans.filter((loan) => loan.view === "overdue");
  const dueSoon = loans.filter((loan) => loan.view === "due_soon");
  const outNow = loans.filter((loan) => loan.status === "active");

  const waiting = member.reservations.filter((hold) => hold.status === "waiting");
  const ready = member.reservations.filter((hold) => hold.status === "ready");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="gap-4 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-h3 font-display">Standing</CardTitle>
          <CardDescription>
            Where this member stands across borrowing, money and holds.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Fact
            icon={BookMarked}
            label="Out with them now"
            value={`${member.activeLoans}`}
            detail={
              overdue.length > 0
                ? `${overdue.length} overdue, ${overdue.reduce((sum, loan) => sum + loan.daysOverdue, 0)} days late in total`
                : dueSoon.length > 0
                  ? `Nothing overdue. ${dueSoon.length} due within three days`
                  : outNow.length > 0
                    ? "Nothing overdue or due soon"
                    : "No books out"
            }
            tone={overdue.length > 0 ? "danger" : "default"}
          />

          <Fact
            icon={Receipt}
            label="Owing"
            value={member.unpaidFines > 0 ? formatCurrency(member.unpaidFineTotal) : "Nothing"}
            detail={
              member.unpaidFines > 0
                ? `${member.unpaidFines} unpaid ${member.unpaidFines === 1 ? "fine" : "fines"}`
                : "No unpaid fines"
            }
            tone={member.unpaidFines > 0 ? "danger" : "success"}
          />

          <Fact
            icon={Hourglass}
            label="Holds"
            value={`${member.activeReservations}`}
            detail={
              ready.length > 0
                ? `${ready.length} ready to collect`
                : waiting.length > 0
                  ? `${waiting.length} waiting, first is number ${Math.min(...waiting.map((hold) => hold.queuePosition ?? Infinity))} in the queue`
                  : "No active holds"
            }
            tone={ready.length > 0 ? "info" : "default"}
          />

          <Fact
            icon={CalendarClock}
            label="Member since"
            value={formatDate(member.createdAt)}
            detail={
              member.lastLoginAt
                ? `Last signed in ${formatRelative(member.lastLoginAt)}`
                : "Has never signed in"
            }
          />
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-h3 font-display">Contact</CardTitle>
          <CardDescription>What the member has on file.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 text-small">
          <DetailRow label="Email" value={member.email} />
          <DetailRow label="Phone" value={member.phone ?? "Not provided"} muted={!member.phone} />
          <DetailRow
            label="Department"
            value={member.department ?? "Not provided"}
            muted={!member.department}
          />
          <DetailRow label="Membership ID" value={member.membershipId ?? "Not issued"} mono />
          <DetailRow label="Status" value={<StatusBadge status={member.status} />} />

          <Separator />

          <p className="text-caption text-muted-foreground">
            The member can change their own name, phone and department from their profile.
            A librarian cannot edit them here, because a member&rsquo;s own details are the
            ones they can vouch for.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "danger" | "success" | "info";
}) {
  const valueTone =
    tone === "danger"
      ? "text-danger-ink"
      : tone === "success"
        ? "text-success-ink"
        : tone === "info"
          ? "text-info-ink"
          : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-muted/50 p-4">
      <p className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </p>
      {/* The detail line is the second cue, so nothing here depends on the value's colour. */}
      <p className={`mt-1 font-display text-h3 font-semibold ${valueTone}`}>{value}</p>
      <p className="mt-0.5 text-caption text-muted-foreground">{detail}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-caption text-muted-foreground">{label}</span>
      <span
        className={
          mono
            ? "truncate font-mono text-code text-foreground"
            : muted
              ? "truncate text-muted-foreground"
              : "truncate text-right text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loans                                                                       */
/* -------------------------------------------------------------------------- */

function LoansPanel({ member }: { member: MemberRecord }) {
  if (member.loans.length === 0) {
    return (
      <EmptyState
        icon={BookMarked}
        title="Never borrowed anything"
        description={`${member.name} has no loan history yet. The first loan will appear here as soon as the circulation desk issues one.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelNote
        showing={member.loans.length}
        total={member.totalBorrowed}
        noun="loan"
      />

      <ul className="space-y-3">
        {member.loans.map((loan) => (
          <LoanRow key={loan.id} loan={loan} />
        ))}
      </ul>
    </div>
  );
}

function LoanRow({ loan }: { loan: MemberLoan }) {
  const returned = loan.status === "returned";

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <BookCover
        publicId={loan.book.cover?.publicId}
        url={loan.book.cover?.url}
        title={loan.book.title}
        author={loan.book.authors[0] ?? null}
        width={48}
        sizes="48px"
        className="h-16 w-11 shrink-0 rounded-sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <BookLink book={loan.book} className="font-medium" />
          <StatusBadge status={loan.view} />
        </div>

        <p className="mt-0.5 text-caption text-muted-foreground">
          {loan.book.authors.length > 0 ? `${loan.book.authors.join(", ")} · ` : ""}
          Issued {formatDate(loan.issuedAt)}
        </p>

        <p className="mt-0.5 text-caption text-muted-foreground">
          {returned ? (
            <>Returned {formatDate(loan.returnedAt ?? loan.dueDate)}</>
          ) : loan.view === "overdue" ? (
            <>
              Due {formatDate(loan.dueDate)} &middot;{" "}
              <span className="font-medium text-danger-ink">
                {loan.daysOverdue} {loan.daysOverdue === 1 ? "day" : "days"} overdue
              </span>
            </>
          ) : (
            <>Due {formatDate(loan.dueDate)}</>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {loan.renewCount > 0 ? (
          <Badge variant="outline" className="font-mono">
            {loan.renewCount}&times; renewed
          </Badge>
        ) : null}
        {loan.fineAmount > 0 ? (
          <Badge variant="danger" className="font-mono">
            {formatCurrency(loan.fineAmount)} fine
          </Badge>
        ) : null}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Fines                                                                       */
/* -------------------------------------------------------------------------- */

function FinesPanel({ member }: { member: MemberRecord }) {
  if (member.fines.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No fines"
        description={`${member.name} has never been fined. A fine appears here when a book comes back late.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelNote showing={member.fines.length} noun="fine" />

      {member.unpaidFines > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {member.unpaidFines} unpaid{" "}
            {member.unpaidFines === 1 ? "fine" : "fines"} totalling{" "}
            {formatCurrency(member.unpaidFineTotal)}. Payment is taken at the circulation
            desk.
          </span>
        </p>
      ) : null}

      <ul className="space-y-3">
        {member.fines.map((fine) => (
          <FineRow key={fine.id} fine={fine} />
        ))}
      </ul>
    </div>
  );
}

function FineRow({ fine }: { fine: MemberFine }) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <BookCover
        publicId={fine.book.cover?.publicId}
        url={fine.book.cover?.url}
        title={fine.book.title}
        author={fine.book.authors[0] ?? null}
        width={48}
        sizes="48px"
        className="h-16 w-11 shrink-0 rounded-sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <BookLink book={fine.book} className="font-medium" />
          <StatusBadge status={fine.status} />
        </div>

        <p className="mt-0.5 text-caption text-muted-foreground">
          Raised {formatDate(fine.raisedAt)} &middot; {fine.daysOverdue}{" "}
          {fine.daysOverdue === 1 ? "day" : "days"} overdue at{" "}
          {formatCurrency(fine.ratePerDay)}/day
        </p>

        {fine.reason ? (
          <p className="mt-1 text-caption text-pretty text-muted-foreground">
            {fine.reason}
          </p>
        ) : null}

        {fine.paidAt ? (
          <p className="mt-0.5 flex items-center gap-1 text-caption text-success-ink">
            <CircleCheck className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Paid {formatDate(fine.paidAt)}
          </p>
        ) : null}
      </div>

      <p className="shrink-0 font-display text-h3 font-semibold tabular-nums text-foreground">
        {formatCurrency(fine.amount)}
      </p>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Reservations                                                                */
/* -------------------------------------------------------------------------- */

function ReservationsPanel({ member }: { member: MemberRecord }) {
  if (member.reservations.length === 0) {
    return (
      <EmptyState
        icon={Hourglass}
        title="No reservations"
        description={`${member.name} is not waiting for any book. A hold appears here when a book they want is out on loan.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelNote showing={member.reservations.length} noun="reservation" />

      <ul className="space-y-3">
        {member.reservations.map((hold) => (
          <ReservationRow key={hold.id} hold={hold} />
        ))}
      </ul>
    </div>
  );
}

function ReservationRow({ hold }: { hold: MemberReservation }) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <BookCover
        publicId={hold.book.cover?.publicId}
        url={hold.book.cover?.url}
        title={hold.book.title}
        author={hold.book.authors[0] ?? null}
        width={48}
        sizes="48px"
        className="h-16 w-11 shrink-0 rounded-sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <BookLink book={hold.book} className="font-medium" />
          <StatusBadge status={hold.status} />
        </div>

        <p className="mt-0.5 text-caption text-muted-foreground">
          Requested {formatDate(hold.requestedAt)}
        </p>

        <p className="mt-0.5 text-caption text-muted-foreground">
          {hold.status === "ready" ? (
            <>
              Collect by {formatDate(hold.expiresAt ?? hold.readyAt ?? hold.requestedAt)}
            </>
          ) : hold.status === "waiting" ? (
            hold.queuePosition ? (
              <>
                Number {hold.queuePosition} in the queue
                {hold.queuePosition === 1 ? " next to be served" : ""}
              </>
            ) : (
              "Waiting in the queue"
            )
          ) : hold.status === "fulfilled" ? (
            <>Filled by a loan on {formatDate(hold.readyAt ?? hold.requestedAt)}</>
          ) : (
            <>Closed {formatRelative(hold.requestedAt)}</>
          )}
        </p>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A book title that links to the public catalog page.
 *
 * `MemberBookRef` is `LoanBookRef`, so the slug is part of the payload and this links
 * straight to `/catalog/[slug]`. It used to fall back to `/catalog?q=<title>` because the
 * member record carried no slug — reconstructing a slug from a title breaks on every title
 * that needed slugifying, and a search for the title is not the same page.
 *
 * `slug` is empty only for the "No longer in the catalog" placeholder, so the fallback
 * keeps that row clickable rather than rendering a dead link.
 */
function BookLink({
  book,
  className,
}: {
  book: MemberLoan["book"];
  className?: string;
}) {
  const href = book.slug ? `/catalog/${book.slug}` : `/catalog?q=${encodeURIComponent(book.title)}`;

  return (
    <Link
      href={href}
      className={`underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none ${className ?? ""}`}
    >
      {book.title}
    </Link>
  );
}

/**
 * Be honest about a capped list.
 *
 * The service returns at most `MEMBER_HISTORY_LIMIT` rows while the count beside it is
 * the real total. Rendering the truncated list with no note would read as "this is
 * everything they ever borrowed", which is the kind of quiet lie a member record should
 * not tell. When the numbers match, the note disappears entirely.
 */
function PanelNote({ showing, total, noun }: { showing: number; total?: number; noun: string }) {
  const label = noun === "fine" ? "fines" : `${noun}s`;

  if (showing < MEMBER_HISTORY_LIMIT) {
    return (
      <p className="text-caption text-muted-foreground">
        {showing} {showing === 1 ? noun : label}
        {typeof total === "number" ? ` of ${total}` : ""}
      </p>
    );
  }

  return (
    <p className="text-caption text-muted-foreground">
      Showing the {MEMBER_HISTORY_LIMIT} most recent
      {typeof total === "number" && total > MEMBER_HISTORY_LIMIT ? ` of ${total}` : ""}.{" "}
      {noun === "fine" ? "Fines" : "History"} for older activity is not listed here.
    </p>
  );
}
