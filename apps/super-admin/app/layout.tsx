import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Byepo Super Admin",
  description: "Create and manage tenant organizations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
