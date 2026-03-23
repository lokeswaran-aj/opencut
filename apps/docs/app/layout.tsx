import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider";
import "fumadocs-ui/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCut Docs",
  description: "Documentation for the OpenCut monorepo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
