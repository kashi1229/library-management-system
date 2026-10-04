"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/ui/field";
import { StatusBadge } from "@/components/common/status-badge";
import { BookCover } from "@/components/common/book-cover";
import { StatCard } from "@/components/common/stat-card";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Spinner } from "@/components/common/spinner";
import { Section, TokenLabel } from "./surfaces";

/* -------------------------------------------------------------------------- */

export function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons" description="Variants and sizes from ui-context.md">
      <div className="space-y-5 rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">
            <Plus className="size-3.5" />
            Small
          </Button>
          <Button size="md">
            <Plus className="size-4" />
            Medium
          </Button>
          <Button size="lg">
            <Plus className="size-4" />
            Large
          </Button>
          <Button size="icon" aria-label="Search">
            <Search className="size-4" />
          </Button>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button disabled>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </Button>
          <Button asChild>
            <a href="#buttons">Rendered as link</a>
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function BadgesSection() {
  const statuses = [
    "available",
    "low",
    "unavailable",
    "on_time",
    "due_soon",
    "overdue",
    "returned",
    "waiting",
    "ready",
    "fulfilled",
    "expired",
    "cancelled",
    "unpaid",
    "paid",
    "waived",
    "active",
    "suspended",
    "archived",
  ];

  return (
    <Section id="badges" title="Badges & status" description="StatusBadge maps domain state to tone exactly as specified">
      <div className="space-y-5 rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="soft">
            <StarGlyph />
            Accent soft
          </Badge>
          <Badge variant="info">
            <CheckCircle2 className="size-3" />
            With icon
          </Badge>
        </div>
      </div>
    </Section>
  );
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

export function FormsSection() {
  return (
    <Section id="forms" title="Form controls" description="44px inputs, label above, helper or error below">
      <div className="grid gap-6 rounded-lg border border-border bg-surface p-6 md:grid-cols-2">
        <Field label="Book title" required helper="As printed on the title page.">
          <Input placeholder="The Left Hand of Darkness" />
        </Field>

        <Field label="ISBN" helper="10 or 13 digits, validated by checksum.">
          <Input placeholder="978-0-13-235088-4" inputMode="numeric" className="font-mono text-code" />
        </Field>

        <Field label="Description" error="Description must be 2000 characters or fewer.">
          <Textarea defaultValue="A lone envoy crosses a frozen world." />
        </Field>

        <Field label="Category">
          <Select defaultValue="fiction">
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fiction">Fiction</SelectItem>
              <SelectItem value="science">Science</SelectItem>
              <SelectItem value="history">History</SelectItem>
              <SelectItem value="arts">Arts</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3">
            <Checkbox id="sg-available" defaultChecked />
            <Label htmlFor="sg-available">Available for circulation</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="sg-featured" defaultChecked />
            <Label htmlFor="sg-featured">Feature on the landing page</Label>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          <Label htmlFor="sg-disabled">Disabled input</Label>
          <Input id="sg-disabled" disabled placeholder="Read-only field" />
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="copies">Copies</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4 text-small text-muted-foreground">
              The default tab variant uses a muted track with a lifted active pill.
            </TabsContent>
            <TabsContent value="copies" className="pt-4 text-small text-muted-foreground">
              Three of five copies available.
            </TabsContent>
            <TabsContent value="reviews" className="pt-4 text-small text-muted-foreground">
              Average rating 4.4 from 128 reviews.
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function OverlaySection() {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <Section id="overlays" title="Dialogs, sheets & toasts">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-6">
        <Button onClick={() => setConfirmOpen(true)} variant="outline">
          <TriangleAlert className="size-4" />
          Open confirm dialog
        </Button>
        <Button variant="outline" onClick={() => toast("Book reserved", { description: "You are 2nd in the queue." })}>
          <CheckCircle2 className="size-4" />
          Success toast
        </Button>
        <Button variant="outline" onClick={() => toast.error("Could not issue the loan")}>
          <XCircle className="size-4" />
          Error toast
        </Button>
        <Button variant="outline" onClick={() => toast.loading("Saving…")}>
          <Loader2 className="size-4" />
          Loading toast
        </Button>
        <Button variant="outline" onClick={() => toast("Report ready", { action: { label: "Download", onClick: () => undefined } })}>
          <Download className="size-4" />
          Toast with action
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Suspend this member?"
        consequence="They will keep read access but cannot borrow, renew or reserve until an administrator reactivates the account."
        confirmLabel="Suspend member"
        onConfirm={() => Promise.resolve()}
      />
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function DataSection() {
  return (
    <Section id="data" title="Covers, KPIs & spinners">
      <div className="grid gap-6 rounded-lg border border-border bg-surface p-6 lg:grid-cols-4">
        <div className="space-y-3">
          <BookCover title="The Left Hand of Darkness" author="Ursula K. Le Guin" categoryColor="forest" />
          <TokenLabel>Generated fallback</TokenLabel>
        </div>
        <div className="space-y-3">
          <BookCover title="Thinking, Fast and Slow" author="Daniel Kahneman" categoryColor="terracotta" />
          <TokenLabel>2:3 · spine highlight</TokenLabel>
        </div>
        <StatCard label="Total copies" value={12480} icon={BookOpen} hint="Across 1,932 titles" />
        <StatCard label="Overdue loans" value={23} tone="danger" icon={TriangleAlert} hint="7 more than yesterday" />
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-surface p-6">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
        <TokenLabel>Spinner · sm / md / lg</TokenLabel>
      </div>
    </Section>
  );
}
