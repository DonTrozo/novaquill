import { SITE_URL } from "@/lib/siteIdentity";
import { requestLocale } from "@/lib/requestLocale";
import { createTranslator } from "@/lib/i18n";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const siteUrl = SITE_URL;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await requestLocale());
  return {
    title: t("NovaQuill — Fill & Sign PDFs Online"),
    description:
      t("Fill PDF forms, add text and sign documents online with NovaQuill at novaquill.co.za. Upload, sign, preview and download your PDF."),
    metadataBase: new URL(siteUrl),
    openGraph: {
      title: t("NovaQuill — Fill & Sign PDFs Online"),
      description:
        t("Ultra-simple e‑signing with ShapeAssist real-time smoothing. Free and Pro."),
      url: siteUrl,
      siteName: "NovaQuill",
      images: [{ url: "/novaquill-icon-512.png", width: 512, height: 512, alt: "NovaQuill logo" }],
    },
    icons: {
      icon: [
        { url: "/novaquill-icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/novaquill-icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.ico?v=novaquill-20261006",
      apple: [{ url: "/novaquill-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/site.webmanifest",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await requestLocale();
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers initialLocale={locale}>
          <ErrorBoundary>
            <Header />
            {children}
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
