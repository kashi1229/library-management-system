"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle2,
  Download,
  Filter,
  LayoutDashboard,
  Library,
  Menu,
  MoreHorizontal,
  Plus,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  TriangleAlert,
  Users,
  X,
  XCircle,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { STAFF_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Section, TokenLabel } from "./surfaces";

/**
 * The complete icon set named in ui-context.md §Navigation Items, plus a preview
 * of the sidebar row treatment that Unit 05 will build into the App Shell.
 */
export function IconsSection() {
  const groups: [string, [string, React.ComponentType<{ className?: string; strokeWidth?: number }>][]][] = [
    [
      "Navigation",
      [
        ["LayoutDashboard", LayoutDashboard],
        ["Library", Library],
        ["Tags", Tags],
        ["Users", Users],
        ["BarChart3", ScrollText],
        ["ShieldCheck", ShieldCheck],
        ["Settings", Settings],
      ],
    ],
    [
      "Actions",
      [
        ["Search", Search],
        ["Plus", Plus],
        ["Trash2", Trash2],
        ["Download", Download],
        ["Filter", Filter],
        ["MoreHorizontal", MoreHorizontal],
        ["Menu", Menu],
        ["X", X],
      ],
    ],
    [
      "Feedback",
      [
        ["CheckCircle2", CheckCircle2],
        ["TriangleAlert", TriangleAlert],
        ["XCircle", XCircle],
        ["Info", Info],
        ["Bell", Bell],
        ["Star", Star],
      ],
    ],
  ];

  return (
    <Section id="icons" title="Icons" description="lucide-react only · stroke 1.75 · 16–20px">
      <div className="space-y-6 rounded-lg border border-border bg-surface p-6">
        {groups.map(([label, icons]) => (
          <div key={label} className="space-y-3">
            <TokenLabel>{label}</TokenLabel>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {icons.map(([name, Icon]) => (
                <div key={name} className="flex flex-col items-center gap-1.5 text-center">
                  <span className="grid size-10 place-items-center rounded-md border border-border bg-muted text-foreground">
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[10px] break-all text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Wordmark variants, sidebar row treatment and the theme toggle. */
export function ChromeSection() {
  return (
    <Section id="chrome" title="Logo, sidebar rows & theme toggle">
      <div className="grid gap-6 rounded-lg border border-border bg-surface p-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Logo />
          <Logo name="University Library" />
          <div className="flex items-center gap-3">
            <Logo markOnly />
            <Logo markOnly />
          </div>
          <TokenLabel>Logo · wordmark / custom name / mark only</TokenLabel>
        </div>

        <Card className="w-64 gap-1 p-3">
          {STAFF_NAV.map((item, index) => (
            <div
              key={item.href}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-small",
                index === 2
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="grid size-4 shrink-0 place-items-center">
                <LayoutDashboard className="size-4" strokeWidth={1.75} />
              </span>
              <span className="truncate font-medium">{item.label}</span>
            </div>
          ))}
          <TokenLabel>Sidebar row · active + hover</TokenLabel>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <ThemeToggle />
          </div>
          <TokenLabel>ThemeToggle · Sun ⇄ Moon, persisted</TokenLabel>
        </div>
      </div>
    </Section>
  );
}

/** Responsive proof: the same block reflows from 360px to 1280px. */
export function ResponsiveSection() {
  return (
    <Section id="responsive" title="Responsive" description="Verified at 360px · 768px · 1280px">
      <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
        {[360, 768, 1280].map((width) => (
          <div key={width} className="space-y-1.5">
            <TokenLabel>{width}px</TokenLabel>
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-3"
              style={{ maxWidth: width, marginInline: "auto", width: "100%" }}
            >
              <Button size="sm">One</Button>
              <Button size="sm" variant="outline">
                Two
              </Button>
              <Button size="sm" variant="ghost">
                Three
              </Button>
            </div>
          </div>
        ))}
        <p className="text-caption text-muted-foreground">
          Resize the window: no horizontal scrollbar appears between 360px and 1920px.
        </p>
      </div>
    </Section>
  );
}
