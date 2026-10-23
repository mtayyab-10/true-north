import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueNorth | Catch the wrong number before it is saved",
  description:
    "A pre-submission quality gate before the database. TrueNorth checks context, shows evidence, and gives analysts a clear decision before data is accepted.",
  keywords: ["TrueNorth", "data quality", "pre-submission gate", "financial QA", "invoice verification", "Gemma 4"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "TrueNorth | Catch the wrong number before it is saved",
    description: "A pre-submission QA layer for financial and commercial data.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
