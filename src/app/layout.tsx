import type { Metadata } from "next";
import "./globals.css";
import { SeloKovex } from "@/components/SeloKovex";

export const metadata: Metadata = {
  title: "EtiquetaMO",
  description: "Sistema de impressão de etiquetas para gelateria artesanal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <SeloKovex />
      </body>
    </html>
  );
}
