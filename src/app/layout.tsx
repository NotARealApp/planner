import type { Metadata, Viewport } from "next";
import { Roboto, Noto_Sans_Malayalam, Vazirmatn } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeProvider";
import { I18nProvider } from "@/context/I18nProvider";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
});

const malayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  weight: ["400", "500", "700"],
  variable: "--font-malayalam",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-vazirmatn",
});

// Next does not prefix metadata manifest/icon URLs with basePath, so do it
// ourselves — otherwise they 404 under the GitHub Pages basePath (/RealApp).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Assistant",
  description: "Your little daily helpers — commute, trip outfit, and more.",
  manifest: `${BASE_PATH}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Assistant",
  },
  icons: {
    icon: [{ url: `${BASE_PATH}/icon-192.png`, sizes: "192x192" }],
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#141218",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} ${malayalam.variable} ${vazirmatn.variable}`}>
        <ThemeProvider>
          <I18nProvider>
            <AppShell>{children}</AppShell>
            <ServiceWorker />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
