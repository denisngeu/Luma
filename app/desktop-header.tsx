'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Bell, User, Minus, Square, X } from 'lucide-react';

interface LumaDesktopBridge {
  isDesktop?: boolean;
  platform?: string;
  version?: string;
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
  isMaximized?: () => Promise<boolean>;
}

export default function DesktopHeader() {
  const path = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    let live=true;
    queueMicrotask(()=>{
      const bridge = (window as unknown as { lumaDesktop?: LumaDesktopBridge }).lumaDesktop;
      if (live&&bridge?.isDesktop) {
        setIsDesktop(true);
        setIsWindows(bridge.platform === 'win32');
      }
    });
    return()=>{live=false;};
  }, []);

  const handleMinimize = () => {
    const bridge = (window as unknown as { lumaDesktop?: LumaDesktopBridge }).lumaDesktop;
    bridge?.minimize?.();
  };

  const handleMaximize = () => {
    const bridge = (window as unknown as { lumaDesktop?: LumaDesktopBridge }).lumaDesktop;
    bridge?.maximize?.();
  };

  const handleClose = () => {
    const bridge = (window as unknown as { lumaDesktop?: LumaDesktopBridge }).lumaDesktop;
    bridge?.close?.();
  };

  const navLinks = [
    { href: '/fil', label: 'Fil' },
    { href: '/messages', label: 'Messages' },
    { href: '/amis', label: 'Amis' },
    { href: '/communities', label: 'Communautés' },
  ];

  return (
    <header className={`luma-desktop-header ${isWindows ? 'is-windows' : ''}`}>
      {/* Left: Window controls (dots) & Luma Desktop branding */}
      <div className="header-left">
        {isDesktop&&<div className="window-dots" aria-label="Contrôles de fenêtre">
          <button
            type="button"
            className="dot dot-close group"
            onClick={handleClose}
            title={isDesktop ? 'Fermer la fenêtre' : 'Fermer'}
            aria-label="Fermer"
          >
            <X size={8} className="dot-icon" />
          </button>
          <button
            type="button"
            className="dot dot-minimize group"
            onClick={handleMinimize}
            title={isDesktop ? 'Réduire la fenêtre' : 'Réduire'}
            aria-label="Réduire"
          >
            <Minus size={8} className="dot-icon" />
          </button>
          <button
            type="button"
            className="dot dot-maximize group"
            onClick={handleMaximize}
            title={isDesktop ? 'Agrandir / Restaurer' : 'Agrandir'}
            aria-label="Agrandir"
          >
            <Square size={7} className="dot-icon" />
          </button>
        </div>}

        <Link href="/messages" className="header-brand" prefetch>
          <div className="brand-logo-glow">
            <Image
              src="/luma-logo.png"
              alt="Luma Logo"
              width={24}
              height={24}
              className="brand-logo-img"
              priority
            />
          </div>
          <span className="brand-title">Luma Desktop</span>
        </Link>
      </div>

      {/* Center: Top Navigation Pills */}
      <nav className="header-nav" aria-label="Navigation supérieure">
        {navLinks.map(({ href, label }) => {
          const isActive = path === href || path.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`header-nav-link ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              prefetch
            >
              {label}
              {isActive && <span className="nav-active-pill" />}
            </Link>
          );
        })}
      </nav>

      {/* Right: Quick actions (Search, Notifications, Profile) */}
      <div className={`header-right ${isWindows ? 'win-padding' : ''}`}>
        <Link
          href="/messages"
          className="header-action-btn"
          title="Recherche (⌘K)"
          aria-label="Rechercher"
        >
          <Search size={16} />
        </Link>
        <Link
          href="/fil"
          className="header-action-btn"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </Link>
        <Link
          href="/parametres"
          className="header-user-badge"
          title="Paramètres du compte"
          aria-label="Paramètres du compte"
        >
          <div className="user-avatar-circle">
            <User size={15} />
          </div>
        </Link>
      </div>
    </header>
  );
}
