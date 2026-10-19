import type { Metadata } from "next";
import './app.css';
import CallInbox from './call-inbox';
import ThemeProvider from './theme-provider';
import AppShell from './app-shell';
import {themeBootstrap} from './theme-bootstrap';

export const metadata: Metadata = {
  title: "Luma — Votre cercle",
  description: "Publications, amis et conversations dans votre espace Luma.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="antialiased">
        <ThemeProvider />
        <AppShell>{children}</AppShell>
        <CallInbox />
      </body>
    </html>
  );
}
