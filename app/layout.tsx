import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
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

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "KZN Plumbers Directory — Verified plumbers across KwaZulu-Natal",
  description:
    "Find verified, PIRB-registered plumbers in Durban, PMB, Richards Bay and across KZN. Real Google reviews, instant WhatsApp booking.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://kznplumbers.co.za",
  ),
  openGraph: {
    title: "KZN Plumbers Directory",
    description:
      "Verified, PIRB-registered plumbers across KwaZulu-Natal. Real reviews, instant WhatsApp booking.",
    type: "website",
    locale: "en_ZA",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // GA4 only loads in production AND when NEXT_PUBLIC_GA_ID is set.
  // This keeps preview/dev deployments out of your analytics data.
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const enableGA = process.env.NODE_ENV === "production" && !!gaId;

  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        {process.env.NODE_ENV === "development" && <AuthDebug />}
      </body>
      {enableGA && <GoogleAnalytics gaId={gaId!} />}
    </html>
  );
}
