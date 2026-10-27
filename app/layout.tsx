import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Sparkflow — mobile apps that check their own work",
  description: "Mobile apps that look at themselves.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${bricolage.variable} ${geist.variable} ${geistMono.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-ink-950 text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}
