import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Athenaeum — Library Management System",
    template: "%s · Athenaeum",
  },
  description:
    "Athenaeum is a library management system for cataloguing, circulation, reservations, fines and reporting.",
  applicationName: "Athenaeum",
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
      className={`${fontVariables} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
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
