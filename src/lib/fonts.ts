import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

/**
 * Parchment & Ink typography (ui-context.md): Fraunces for display/headings,
 * Inter for body & UI, JetBrains Mono for IDs, ISBNs and codes.
 *
 * `display: "swap"` plus preloaded subsets keep first paint stable and prevent
 * layout shift; the CSS variables are consumed by `@theme inline` in globals.css.
 */

export const fontDisplay = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const fontVariables = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`;
