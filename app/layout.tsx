import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sparkflow",
  description: "Mobile apps that look at themselves.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden font-sans antialiased">{children}</body>
    </html>
  );
}
