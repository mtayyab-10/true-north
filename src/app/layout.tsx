import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasdeeq — Document Verification for Small Businesses",
  description:
    "Catch typing mistakes in ledger entries before they cost money. Upload a photo of a bill or invoice and let Gemma 4 read the numbers for you.",
  keywords: ["document verification", "invoice", "ledger", "small business", "Urdu", "Gemma", "AI"],
  openGraph: {
    title: "Tasdeeq — Document Verification",
    description: "AI-powered verification for handwritten bills and invoices",
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
      <body>
        {children}
      </body>
    </html>
  );
}
