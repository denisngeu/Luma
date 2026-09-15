import type { Metadata } from "next";
import "./globals.css";
import './themes.css';
import './social.css';
import './network.css';
import CallInbox from './call-inbox';
import ThemeProvider from './theme-provider';

export const metadata: Metadata = {
  title: "Luma — Votre cercle",
  description: "Publications, amis et conversations dans votre espace Luma.",
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
      <body className="antialiased"><ThemeProvider/>{children}<CallInbox/></body>
    </html>
  );
}
