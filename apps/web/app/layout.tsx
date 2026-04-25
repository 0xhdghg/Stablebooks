import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Stablebooks",
  description: "Arc-native stablecoin receivables and treasury automation"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

