import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Eldorado",
  description: "Describe a design, AI creates it, and it's printed on a t-shirt and shipped to you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
