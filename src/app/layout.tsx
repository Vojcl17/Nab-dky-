import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nabídky a faktury",
  description: "Ceník, nabídky, faktury, ARES a Fio banka pro obchodníka",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
