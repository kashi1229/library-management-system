import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SkipLink } from "@/components/layout/skip-link";
import "./globals.css";

/**
 * Every absolute URL the app publishes — canonical links, OpenGraph, the sitemap and
 * robots — resolves against this. `NEXT_PUBLIC_APP_URL` is already documented in
 * `.env.example`; the fallback is the dev server, so a missing variable degrades to a
 * correct local origin rather than to a relative URL that crashes `new URL()`.
 */
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Athenaeum — Library Management System",
    template: "%s · Athenaeum",
  },
  description:
    "Athenaeum is a library management system for cataloguing, circulation, reservations, fines and reporting.",
  applicationName: "Athenaeum",
  openGraph: {
    type: "website",
    siteName: "Athenaeum",
    url: "/",
    title: "Athenaeum — Library Management System",
    description:
      "A university library catalog, circulation desk, reservation queue, and fine ledger in one unified system.",
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#14120F" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // `globals.css` sets `scroll-behavior: smooth` on `<html>`. Next.js reads
      // this attribute to know the smooth scrolling is intentional, and without
      // it every client-side route transition logs a console warning and animates
      // the scroll. Documented at nextjs.org/docs/messages/missing-data-scroll-behavior.
      data-scroll-behavior="smooth"
      className={`${fontVariables} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <SkipLink />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
