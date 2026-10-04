import {
  LayoutDashboard,
  Library,
  BookMarked,
  Clock,
  Heart,
  Receipt,
  Bell,
  UserRound,
  ArrowLeftRight,
  BookOpen,
  Tags,
  Users,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Settings as SettingsIcon,
  Landmark,
  Globe,
  FlaskConical,
  Music,
  Palette,
  Scale,
  Atom,
  Briefcase,
  PenLine,
  Cpu,
  Leaf,
  Feather,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_CATEGORY_ICON, type CategoryColor } from "@/lib/constants";

/**
 * Lucide name → component maps.
 *
 * `lib/constants.ts` stores icon names as plain strings so it stays free of JSX
 * and importable from Server Components. This module is the only place that
 * turns those strings into components, and it is imported **only** from Client
 * Components — a Server Component pulling it in would ship the whole icon set.
 */

/** Navigation icons, keyed by the names used in `MEMBER_NAV` / `STAFF_NAV`. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Library,
  BookMarked,
  Clock,
  Heart,
  Receipt,
  Bell,
  UserRound,
  ArrowLeftRight,
  BookOpen,
  Tags,
  Users,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Settings: SettingsIcon,
};

/** Category icon names, plus the common ones a librarian may pick. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ...NAV_ICONS,
  Landmark,
  Globe,
  FlaskConical,
  Music,
  Palette,
  Scale,
  Atom,
  Briefcase,
  PenLine,
  Cpu,
  Leaf,
  Feather,
};

/** Resolves a nav icon name, falling back to a neutral glyph. */
export function navIcon(name: string): LucideIcon {
  return NAV_ICONS[name] ?? LayoutDashboard;
}

/** Resolves a category icon name, falling back to `BookOpen` like the schema does. */
export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return CATEGORY_ICONS[DEFAULT_CATEGORY_ICON] ?? BookOpen;
  return CATEGORY_ICONS[name] ?? BookOpen;
}

/**
 * Every nav icon, resolved once at module scope.
 *
 * Looking a component up during render would create a new component reference
 * every pass, which defeats React's static-component optimisation and forces a
 * remount of the subtree on each parent render. These constants are safe because
 * the icon map never changes at runtime.
 */
export const NAV_ICON_COMPONENTS: Record<string, LucideIcon> = Object.fromEntries(
  Object.keys(NAV_ICONS).map((name) => [name, NAV_ICONS[name]]),
);

/** Swatch class for a category accent key, used by chips and generated covers. */
export function categorySwatch(color: CategoryColor | string | null | undefined): string {
  const map: Record<string, string> = {
    forest: "bg-cat-forest",
    terracotta: "bg-cat-terracotta",
    ocean: "bg-cat-ocean",
    plum: "bg-cat-plum",
    ochre: "bg-cat-ochre",
    slate: "bg-cat-slate",
  };
  return map[color ?? "forest"] ?? map.forest;
}
