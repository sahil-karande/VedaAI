import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VedaAI - AI Assessment Extraction & Answer Mapping",
  description: "Teacher-facing tool to automatically extract, map, and grade student answer sheets against question papers using Gemini 2.5 Flash multimodal AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F5F2EB] text-[#2C2A29] min-h-screen">
        {children}
      </body>
    </html>
  );
}
