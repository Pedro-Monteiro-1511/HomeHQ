import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { ErrorPopup } from "@/components/shared/error-popup";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "HomeHQ",
  description: "A casa de todos, organizada num só lugar.",
  applicationName: "HomeHQ",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "HomeHQ" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#f5f7f2", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt"><body className={manrope.variable}>{children}<ServiceWorker /><ErrorPopup /></body></html>;
}
