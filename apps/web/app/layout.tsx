import type { ReactNode } from "react";

export const metadata = {
  title: "Dean of Merchants",
  description: "AI shopping assistant that finds the best local and global price.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
