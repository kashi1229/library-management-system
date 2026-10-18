import type { Metadata } from "next";
import { getPublicStats, pickShowcaseCategories } from "@/lib/services/public-stats";
import { getSettings } from "@/lib/services/settings";
import { Hero } from "@/components/features/marketing/hero";
import { StatsBand } from "@/components/features/marketing/stats-band";
import { CategoryShowcase } from "@/components/features/marketing/category-showcase";
import { NewArrivals } from "@/components/features/marketing/new-arrivals";
import { HowItWorks } from "@/components/features/marketing/how-it-works";
import { PlatformHighlights } from "@/components/features/marketing/platform-highlights";
import { LibraryQuote } from "@/components/features/marketing/library-quote";
import { CtaBand } from "@/components/features/marketing/cta-band";
import { ScrollProgress } from "@/components/features/marketing/scroll-progress";
import { BackToTop } from "@/components/features/marketing/back-to-top";
import type { PublicStats } from "@/types";

export const metadata: Metadata = {
  title: "Athenaeum — Academic Library Management System",
  description:
    "A university library catalog, circulation desk, reservation queue, and fine ledger in one unified system. Search, borrow, reserve, and return with effortless grace.",
};

const HERO_COVERS = 6;

const EMPTY_STATS: PublicStats = {
  books: 0,
  copies: 0,
  members: 0,
  loansThisMonth: 0,
  newArrivals: [],
  categories: [],
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [stats, settings] = await Promise.all([
    getPublicStats().catch(() => EMPTY_STATS),
    getSettings().catch(() => null),
  ]);

  const showcase = pickShowcaseCategories(stats.categories);
  const libraryName = settings?.libraryName ?? "Athenaeum";

  return (
    <>
      <ScrollProgress />
      <Hero covers={stats.newArrivals.slice(0, HERO_COVERS)} libraryName={libraryName} />
      <StatsBand
        books={stats.books}
        copies={stats.copies}
        members={stats.members}
        loansThisMonth={stats.loansThisMonth}
      />
      <CategoryShowcase categories={showcase.categories} hidden={showcase.hidden} />
      <NewArrivals books={stats.newArrivals} />
      <HowItWorks />
      <PlatformHighlights />
      <LibraryQuote />
      <CtaBand />
      <BackToTop />
    </>
  );
}