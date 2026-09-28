import type { Metadata } from "next";
import "./globals.css";
import './themes.css';
import './theme-options.css';
import './social.css';
import './network.css';
import './feed-v2.css';
import './call-v2.css';
import CallInbox from './call-inbox';
import ThemeProvider from './theme-provider';
import AppShell from './app-shell';
import {themeBootstrap} from './theme-bootstrap';
import './shell.css';
import './mobile.css';

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
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head>
      <body className="antialiased"><ThemeProvider/><AppShell>{children}</AppShell><CallInbox/></body>
    </html>
  );
}
