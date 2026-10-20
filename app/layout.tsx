import type { Metadata } from "next";
import './app.css';
import CallInbox from './call-inbox';
import ThemeProvider from './theme-provider';
import AppShell from './app-shell';
import {themeBootstrap} from './theme-bootstrap';
import fontManifest from '../public/fonts/manifest.json';

const preloadFonts=fontManifest.assets.filter(font=>font.subset==='latin'||font.family==='material-symbols-outlined');

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
        {preloadFonts.map(font=><link key={font.file} rel="preload" href={'/fonts/'+font.file} as="font" type="font/woff2" crossOrigin="anonymous"/>)}
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
