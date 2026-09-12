import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import { SyncProvider } from "@/components/signage/SyncProvider";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digital Signage POC",
  description:
    "Proof-of-concept offline-first digital signage / menu board system.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-black text-foreground">
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
