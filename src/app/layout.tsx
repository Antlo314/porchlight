import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PwaRegister from "@/components/PwaRegister";
import { appUrl } from "@/lib/appUrl";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

const DESCRIPTION =
  "Your Georgia neighborhood, together — trades, calm notices, Storm Mode, and neighbors you can actually reach.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_APP_URL to the real domain at deploy time so share images
  // resolve to absolute URLs. Resolved through appUrl() so a blank or
  // malformed value falls back instead of failing the build.
  metadataBase: appUrl(),
  title: { default: "Porchlight", template: "%s · Porchlight" },
  description: DESCRIPTION,
  openGraph: {
    title: "Porchlight",
    description: DESCRIPTION,
    siteName: "Porchlight",
    images: [{ url: "/images/og.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Porchlight",
    description: DESCRIPTION,
    images: ["/images/og.jpg"],
  },
  applicationName: "Porchlight",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Porchlight",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#c2661b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <PwaRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
