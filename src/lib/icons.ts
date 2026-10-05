import {
  Anchor,
  ArrowLeftRight,
  Atom,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  Camera,
  Clock,
  Compass,
  Cpu,
  Drama,
  Dumbbell,
  Feather,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Languages,
  Leaf,
  LayoutDashboard,
  Library,
  Lightbulb,
  Microscope,
  Mountain,
  Music,
  Music4,
  Palette,
  PenLine,
  Plane,
  Receipt,
  Ruler,
  Scale,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Shirt,
  Star,
  Tags,
  Telescope,
  Trees,
  UserRound,
  Users,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_ICON_NAMES, type CategoryIconName } from "@/lib/validators/category";

/**
 * Lucide name → component maps.
 *
 * `lib/constants.ts` and `lib/validators/category.ts` store icon names as plain
 * strings so they stay free of JSX and importable from Server Components. This
 * module is the only place that turns those strings into components, and it is
 * imported **only** from Client Components — a Server Component pulling it in
 * would ship the whole icon set.
 *
 * Every lookup returns a reference held in a module-scope object, so the
 * component identity is stable across renders and React never remounts the
 * subtree.
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

/**
 * Category icons, keyed by the **curated whitelist** in
 * `lib/validators/category.ts`.
 *
 * Typed as `Record<CategoryIconName, LucideIcon>` rather than `Record<string, …>`
 * so a typo in the whitelist itself is a compile error, and so consumers get a
 * non-optional component back. Never build this map with a dynamic `import()`
 * keyed on user input — that would be a bundle-injection vector.
 */
export const CATEGORY_ICON_COMPONENTS: Record<CategoryIconName, LucideIcon> = {
  BookOpen,
  Landmark,
  Globe,
  FlaskConical,
  Atom,
  Cpu,
  Briefcase,
  Scale,
  Music,
  Palette,
  PenLine,
  Feather,
  Leaf,
  Users,
  Library,
  Tags,
  BarChart3,
  Heart,
  Clock,
  Star,
  ShieldCheck,
  ScrollText,
  Compass,
  Lightbulb,
  Languages,
  Music4,
  Drama,
  Camera,
  Ruler,
  Calculator,
  Microscope,
  Telescope,
  Wrench,
  Shirt,
  Utensils,
  Dumbbell,
  GraduationCap,
  Building2,
  Plane,
  Anchor,
  Mountain,
  Trees,
};

/**
 * Every whitelisted icon paired with its name, for grids and pickers.
 *
 * `name` narrows to the union and `Icon` can never be `undefined`, so render
 * code needs no null checks.
 */
export const RESOLVED_CATEGORY_ICONS: ReadonlyArray<{
  name: CategoryIconName;
  Icon: LucideIcon;
}> = CATEGORY_ICON_NAMES.map((name) => ({ name, Icon: CATEGORY_ICON_COMPONENTS[name] }));

/** Narrow an untrusted string (e.g. read from Mongo) to a whitelisted name. */
export function toCategoryIconName(value: string | null | undefined): CategoryIconName {
  return CATEGORY_ICON_NAMES.includes(value as CategoryIconName)
    ? (value as CategoryIconName)
    : "BookOpen";
}

/**
 * Resolve a stored icon name to a component, falling back to `BookOpen`.
 *
 * The API validates against the same whitelist, so the fallback only covers
 * records written before the whitelist existed.
 */
export function getCategoryIcon(value: string | null | undefined): LucideIcon {
  return CATEGORY_ICON_COMPONENTS[toCategoryIconName(value)];
}

/** Resolves a nav icon name, falling back to a neutral glyph. */
export function navIcon(name: string): LucideIcon {
  return NAV_ICONS[name] ?? LayoutDashboard;
}