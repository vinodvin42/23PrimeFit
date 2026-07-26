'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCoach } from '../lib/coach-context';
import { Icon, type IconName } from './icons';
import styles from '../app/page.module.css';

const links: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { href: '/clients', label: 'Clients', icon: 'clients' },
  { href: '/chat', label: 'Messages', icon: 'message' },
  { href: '/consults', label: 'Schedule', icon: 'calendar' },
  { href: '/ai', label: 'AI insights', icon: 'sparkles' },
  { href: '/content', label: 'Content studio', icon: 'dumbbell' },
  { href: '/crm', label: 'Client CRM', icon: 'clients' },
  { href: '/workspace', label: 'Workspace', icon: 'activity' },
];

const pageChrome: Record<
  string,
  { eyebrow: string; title: string; action?: { label: string; href: string; icon: IconName } }
> = {
  '/dashboard': { eyebrow: 'Performance HQ', title: 'Overview' },
  '/clients': {
    eyebrow: 'Athlete roster',
    title: 'Clients',
    action: { label: 'Message client', href: '/chat', icon: 'message' },
  },
  '/chat': { eyebrow: 'Client communication', title: 'Messages' },
  '/consults': { eyebrow: 'Training calendar', title: 'Schedule' },
  '/ai': { eyebrow: 'Human-reviewed intelligence', title: 'AI insights' },
  '/content': { eyebrow: 'Coach CMS', title: 'Content studio' },
  '/crm': {
    eyebrow: 'Business suite',
    title: 'Client CRM',
    action: { label: 'Open clients', href: '/clients', icon: 'clients' },
  },
  '/workspace': {
    eyebrow: 'SaaS workspace',
    title: 'Team & billing',
    action: { label: 'Open CRM', href: '/crm', icon: 'clients' },
  },
  '/platform': { eyebrow: 'Platform admin', title: 'Tenants' },
};

function CoachNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className={styles.sideNav} aria-label="Primary navigation">
      <p className={styles.navSectionLabel}>Workspace</p>
      {links.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`${styles.sideNavLink} ${active ? styles.sideNavLinkActive : ''}`}
          >
            <Icon name={link.icon} size={19} />
            <span>{link.label}</span>
            {link.href === '/ai' ? <span className={styles.navBadge}>4</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AppChrome({
  children,
  signOut,
  coachName,
}: {
  children: React.ReactNode;
  signOut: () => void;
  coachName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const chrome =
    Object.entries(pageChrome).find(([path]) => pathname?.startsWith(path))?.[1] ??
    pageChrome['/dashboard'];
  const coachInitials = coachName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={styles.appShell}>
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brandLockup}>
          <div className={styles.brandMark}>
            <Image src="/23primefit-logo.svg" alt="" width={42} height={48} priority />
          </div>
          <div>
            <strong>23PrimeFit</strong>
            <small>Coach OS</small>
          </div>
          <button
            className={styles.mobileClose}
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            ×
          </button>
        </div>
        <Suspense fallback={null}>
          <CoachNav onNavigate={() => setMobileOpen(false)} />
        </Suspense>
        <div className={styles.sidebarFooter}>
          <div className={styles.coachAvatar}>{coachInitials}</div>
          <div className={styles.coachIdentity}>
            <strong>{coachName}</strong>
            <span>Performance coach</span>
          </div>
          <button className={styles.signOutLink} onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </aside>
      {mobileOpen ? (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <button
              className={styles.mobileMenu}
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div>
              <span>{chrome.eyebrow}</span>
              <h1>{chrome.title}</h1>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <form
              className={styles.searchBox}
              onSubmit={(event) => {
                event.preventDefault();
                const query = globalSearch.trim();
                router.push(query ? `/clients?search=${encodeURIComponent(query)}` : '/clients');
              }}
            >
              <Icon name="search" size={17} />
              <input
                aria-label="Search clients"
                placeholder="Search clients…"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </form>
            <Link className={styles.iconButton} href="/ai" aria-label="Open pending insights">
              <Icon name="activity" size={19} />
              <span className={styles.notificationDot} />
            </Link>
            {chrome.action ? (
              <Link className={styles.quickAdd} href={chrome.action.href}>
                <Icon name={chrome.action.icon} size={17} />
                {chrome.action.label}
              </Link>
            ) : null}
          </div>
        </header>
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}

export function CoachShell({ children }: { children: React.ReactNode }) {
  const { session, signOut, ready } = useCoach();
  const showChrome = ready && Boolean(session);

  if (showChrome) {
    return (
      <AppChrome signOut={signOut} coachName={session?.displayName || 'Head Coach'}>
        {children}
      </AppChrome>
    );
  }

  return (
    <main className={styles.authShell}>
      <header className={styles.authHeader}>
        <div className={styles.brandLockup}>
          <div className={styles.brandMark}>
            <Image src="/23primefit-logo.svg" alt="" width={42} height={48} priority />
          </div>
          <div>
            <strong>23PrimeFit</strong>
            <small>Coach OS</small>
          </div>
        </div>
        <span>Secure coach portal</span>
      </header>
      {children}
    </main>
  );
}
