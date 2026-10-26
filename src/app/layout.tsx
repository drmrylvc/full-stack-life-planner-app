import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "ezlife26 — A little better, every day",
  description: "A calmer way to plan your life. Set meaningful targets, build daily habits, organise your files, and make room for what matters.",
  applicationName: "ezlife26",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "ezlife26", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, themeColor: "#16132c", viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
