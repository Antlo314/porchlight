import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const DESCRIPTION =
  "Your Georgia neighborhood, together — news, barter, local services, and neighbors you can actually reach.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_APP_URL to the real domain at deploy time so share images
  // resolve to absolute URLs.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
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
  // Standalone launch from the iOS home screen, with the app name under the icon.
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
  maximumScale: 1, // app-like feel; prevents zoom-on-input-focus on iOS
  themeColor: "#c2661b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
