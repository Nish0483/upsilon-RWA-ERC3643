import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Upsilon-Blocks-RWA",
  description: "Fractional real estate ownership powered by ERC-3643 security tokens",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} font-sans`}>
        <Providers>
          <div className="bg-grid min-h-screen">
            <Navbar />
            <main className="pt-16">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
