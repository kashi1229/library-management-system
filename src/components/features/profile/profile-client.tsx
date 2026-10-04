"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { CalendarDays, IdCard, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InitialAvatar } from "@/components/common/logo";
import { ImageUploader } from "@/components/common/image-uploader";
import { DetailsTab } from "@/components/features/profile/details-tab";
import { SecurityTab } from "@/components/features/profile/security-tab";
import { useMotionVariants } from "@/hooks/use-motion-variants";
import { cn, formatDate } from "@/lib/utils";
import { profileApi, toErrorMessage } from "@/lib/api-client";
import type { PublicUser } from "@/types";

const ROLE_LABEL: Record<PublicUser["role"], string> = {
  member: "Member",
  librarian: "Librarian",
  admin: "Administrator",
};

/**
 * Two-column profile: identity card on the left, tabbed forms on the right.
 * Below `lg` the columns stack, identity first.
 */
export function ProfileClient({
  user,
  onUpdated,
}: {
  user: PublicUser;
  onUpdated: (user: PublicUser) => void;
}) {
  const router = useRouter();
  const { fadeUp } = useMotionVariants();
  const [tab, setTab] = React.useState("details");

  // The avatar is derived straight from `user` — the parent owns it, so there is
  // no local copy to keep in sync.
  const handleAvatarChange = React.useCallback(
    async (next: PublicUser["avatar"]) => {
      try {
        // The file upload already succeeded, so the new reference still has to be
        // persisted. Without this the change would live only in client state and
        // be undone by the next server refresh.
        const { user: updated } = await profileApi.update({
          name: user.name,
          phone: user.phone ?? undefined,
          department: user.department ?? undefined,
          avatar: next,
        });

        onUpdated(updated);
        // Re-run the layout so the server-rendered topbar picks up the new image.
        router.refresh();
      } catch (error) {
        toast.error("Could not save your photo", {
          description: toErrorMessage(error, "Please try again."),
        });
      }
    },
    [onUpdated, router, user],
  );

  return (
    <div className="container-page space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground">
          Your profile
        </h1>
        <p className="text-pretty text-body text-muted-foreground">
          Manage how you appear across the catalogue and at the circulation desk.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        {/* --------------------------- Identity card --------------------------- */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <InitialAvatar name={user.name} imageUrl={user.avatar?.url} size="lg" className="size-24 text-h2" />
                <div className="space-y-1.5">
                  <p className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground">
                    {user.name}
                  </p>
                  <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
                </div>
              </div>

              <Separator />

              <dl className="space-y-3 text-small">
                <Row icon={Mail} label="Email" value={user.email} />
                <Row
                  icon={IdCard}
                  label="Membership ID"
                  value={user.membershipId ?? "Not applicable"}
                  mono={Boolean(user.membershipId)}
                />
                <Row icon={CalendarDays} label="Member since" value={formatDate(user.createdAt)} />
              </dl>

              {user.status === "suspended" ? (
                <div
                  role="status"
                  className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-caption text-warning-ink"
                >
                  This account is suspended. Contact the library desk to reactivate it.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-h3">Photo</CardTitle>
              <CardDescription>
                A square image works best. It appears beside your name at the desk and on your loans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploader
                folder="avatars"
                value={user.avatar}
                onChange={handleAvatarChange}
                aspect="square"
                className="mx-auto max-w-64"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* -------------------------------- Tabs -------------------------------- */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-6">
              <DetailsTab user={user} onUpdated={onUpdated} />
            </TabsContent>

            <TabsContent value="security" className="pt-6">
              <SecurityTab />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

/** Label/value row with a leading icon. */
function Row({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <dt className="text-caption text-muted-foreground">{label}</dt>
        <dd className={cn("truncate text-foreground", mono ? "font-mono text-code" : "text-small")}>
          {value}
        </dd>
      </div>
    </div>
  );
}
