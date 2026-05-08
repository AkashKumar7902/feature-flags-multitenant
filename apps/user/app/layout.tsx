import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Byepo Feature Check",
  description: "Check whether a tenant feature is enabled.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
