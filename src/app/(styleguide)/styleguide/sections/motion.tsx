"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Heart, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { springs, transitions } from "@/lib/motion";
import { useMotionVariants } from "@/hooks/use-motion-variants";
import { Section, TokenLabel } from "./surfaces";

/**
 * Live proof of the shared motion language in `lib/motion.ts`:
 * page rise, 40ms list stagger, dialog scale-in and the spring heart pop.
 */
export function MotionSection() {
  const { fadeUp, stagger, scaleIn, reduced } = useMotionVariants();

  return (
    <Section
      id="motion"
      title="Motion"
      description={`Easing cubic-bezier(0.22, 1, 0.36, 1) · fast 150ms · base 250ms · slow 450ms${
        reduced ? " · reduced motion is ON (transforms disabled)" : ""
      }`}
    >
      <div className="space-y-6 rounded-lg border border-border bg-surface p-6">
        <div className="space-y-3">
          <TokenLabel>fadeUp — page transition (fade + 8px rise)</TokenLabel>
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Card className="p-4 text-small text-muted-foreground">
              Fades in and rises 8px once on mount.
            </Card>
          </motion.div>
        </div>

        <div className="space-y-3">
          <TokenLabel>stagger — list children 40ms apart</TokenLabel>
          <motion.div variants={stagger} initial="hidden" animate="visible" className="grid gap-2 sm:grid-cols-3">
            {["Catalogued", "Issued", "Returned"].map((label, index) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="rounded-md border border-border bg-muted px-3 py-2 text-small"
              >
                <span className="font-mono text-code text-muted-foreground">0{index + 1}</span> {label}
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="space-y-3">
          <TokenLabel>scaleIn — dialog scale 0.97 → 1</TokenLabel>
          <motion.div variants={scaleIn} initial="hidden" animate="visible" className="w-fit">
            <Card className="p-4 text-small text-muted-foreground">Settles rather than snaps.</Card>
          </motion.div>
        </div>

        <div className="space-y-3">
          <TokenLabel>springs.bouncy — wishlist heart pop</TokenLabel>
          <HeartPop />
        </div>

        <div className="space-y-3">
          <TokenLabel>press — buttons scale to 0.98</TokenLabel>
          <div>
            <Button variant="accent">
              <Play className="size-4" />
              Press me
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function HeartPop() {
  const [liked, setLiked] = React.useState(false);

  return (
    <Button variant="outline" onClick={() => setLiked((value) => !value)} aria-pressed={liked}>
      <motion.span
        animate={{ scale: liked ? [1, 1.25, 1] : 1 }}
        transition={springs.bouncy}
        className="grid place-items-center"
      >
        <motion.span
          animate={{ color: liked ? "var(--accent)" : "currentColor" }}
          transition={transitions.fast}
          className="grid place-items-center"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75}>
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </motion.span>
      </motion.span>
      <Heart className="size-3.5" />
      {liked ? "In wishlist" : "Add to wishlist"}
    </Button>
  );
}
