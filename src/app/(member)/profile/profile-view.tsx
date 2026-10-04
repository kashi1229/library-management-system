"use client";

import * as React from "react";
import { ProfileClient } from "@/components/features/profile/profile-client";
import type { PublicUser } from "@/types";

/**
 * Profile page.
 *
 * The initial user comes from the server (the layout already resolved it) and the
 * client owns it from then on, so an avatar change reaches the topbar without a
 * reload.
 */
export function ProfileView({ user }: { user: PublicUser }) {
  const [current, setCurrent] = React.useState(user);
  const [syncedFrom, setSyncedFrom] = React.useState(user);

  // React's documented "adjust state when a prop changes" pattern: comparing
  // during render avoids both an effect and the extra render pass an effect
  // would cause. A server refresh (after `router.refresh()`) hands down a new
  // object, which resets local edits.
  if (user !== syncedFrom) {
    setSyncedFrom(user);
    setCurrent(user);
  }

  return <ProfileClient user={current} onUpdated={setCurrent} />;
}
