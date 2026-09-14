import type { Metadata } from "next";
import "./globals.css";
import './themes.css';
import ThemeProvider from './theme-provider';

export const metadata: Metadata = {
  title: "Luma — Vos conversations",
  description: "Votre espace de messagerie pour garder le lien.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased"><ThemeProvider/>{children}</body>
    </html>
  );
}
