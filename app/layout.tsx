import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { AnalyticsConsent } from "@/components/AnalyticsConsent";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthDebug } from "@/components/AuthDebug";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "KZN Plumbers Directory",
    template: "%s",
  },
  description:
    "Compare plumbing businesses across KwaZulu-Natal by area, listed service and transparent verification state.",
  applicationName: "KZN Plumbers Directory",
  category: "home services directory",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kznplumbers.co.za",
  ),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "KZN Plumbers Directory",
    description:
      "Compare plumbing businesses across KwaZulu-Natal by area, listed service and transparent verification state.",
    type: "website",
    locale: "en_ZA",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_GA_ID : undefined;

  return (
    <html lang="en-ZA" className={dmSans.variable}>
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Navbar />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        {process.env.NODE_ENV === "development" && <AuthDebug />}
        <AnalyticsConsent measurementId={gaId} />
      </body>
    </html>
  );
}
