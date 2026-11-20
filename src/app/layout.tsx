import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { BridgeImportListener } from "@/components/bridge/import-listener";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/site";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "learning management system",
    "LMS",
    "online classroom",
    "google classroom alternative",
    "assignments",
    "grading",
    "rubrics",
    "education software",
    "teachers",
    "students",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    // A static asset rather than a rendered route: the satori renderer pulled
    // two wasm binaries into the server bundle, which the Cloudflare Workers
    // build cannot afford. See public/og.svg.
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: siteConfig.tagline }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ["/og.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "education",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans min-h-screen antialiased">
        {/* Keyboard users land here first and can jump past the header. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        {children}
        {/* Bookmarklet payloads can arrive before the estimator mounts (for
            example during the sign-in redirect), so listen on every page. */}
        <BridgeImportListener />
        <Toaster />
      </body>
    </html>
  );
}
// force rebuild Sat Nov 21 01:29:55 South Africa Standard Time 2026
