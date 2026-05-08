import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Byepo Organization Admin",
  description: "Manage tenant-scoped feature flags.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
