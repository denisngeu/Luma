'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link, { useLinkStatus } from 'next/link';
import {
  House,
  MessageSquare,
  Users,
  Hash,
  Settings,
  User,
  Mic,
  MicOff,
  Headphones,
} from 'lucide-react';

function Pending() {
  const { pending } = useLinkStatus();
  return (
    <i
      className="nav-pending"
      aria-hidden="true"
      data-pending={pending || undefined}
    />
  );
}

export default function SocialNav() {
  const path = usePathname();
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const mainNavItems = [
    {
      Icon: House,
      href: '/fil',
      label: 'Fil',
      badge: null,
      dot: false,
    },
    {
      Icon: MessageSquare,
      href: '/messages',
      label: 'Messages',
      badge: '3',
      dot: false,
    },
    {
      Icon: Users,
      href: '/amis',
      label: 'Amis',
      badge: null,
      dot: true,
    },
    {
      Icon: Hash,
      href: '/communities',
      label: 'Communautés',
      badge: null,
      dot: false,
    },
  ];

  return (
    <aside className="social-nav" aria-label="Navigation principale">
      {/* Top Section: Home Shortcut + Main navigation */}
      <div className="dock-top-group">
        <Link
          href="/fil"
          className={`dock-home-btn group ${path === '/fil' ? 'active' : ''}`}
          title="Accueil"
          prefetch
        >
          <div className="home-icon-wrap">
            <House size={20} />
          </div>
          <span className="dock-tooltip">Fil d'actualité</span>
        </Link>

        <div className="dock-divider" />

        <div className="dock-nav-items">
          {mainNavItems.map(({ Icon, href, label, badge, dot }) => {
            const active =
              path === href ||
              (href !== '/fil' && path.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`dock-nav-link group ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                prefetch
              >
                {active && <span className="dock-active-pill" />}
                <Icon size={22} className="dock-link-icon" />
                {badge && <span className="dock-badge">{badge}</span>}
                {dot && <span className="dock-online-dot" />}
                <span className="dock-tooltip">{label}</span>
                <Pending />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Settings + User Avatar & Mic/Headphone Controls */}
      <div className="dock-bottom-group">
        <Link
          href="/parametres"
          className={`dock-nav-link group ${
            ['/parametres', '/apparence', '/mes-donnees'].some((p) =>
              path.startsWith(p)
            )
              ? 'active'
              : ''
          }`}
          title="Paramètres"
          prefetch
        >
          <Settings size={22} className="dock-link-icon" />
          <span className="dock-tooltip">Paramètres</span>
          <Pending />
        </Link>

        <div className="dock-user-box">
          <Link
            href="/parametres"
            className="dock-user-avatar-btn group"
            title="Votre profil"
            prefetch
          >
            <div className="dock-avatar">
              <User size={18} />
            </div>
            <span className="dock-user-status" />
            <span className="dock-tooltip">En ligne</span>
          </Link>

          <div className="dock-audio-controls">
            <button
              type="button"
              className={`dock-control-btn ${micMuted ? 'muted' : ''}`}
              onClick={() => setMicMuted(!micMuted)}
              title={micMuted ? 'Activer le micro' : 'Couper le micro'}
              aria-label="Microphone"
            >
              {micMuted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
            <button
              type="button"
              className={`dock-control-btn ${deafened ? 'muted' : ''}`}
              onClick={() => setDeafened(!deafened)}
              title={deafened ? 'Activer le son' : 'Couper le son'}
              aria-label="Casque"
            >
              <Headphones size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
