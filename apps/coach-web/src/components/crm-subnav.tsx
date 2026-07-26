'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '../app/page.module.css';

const tabs = [
  { href: '/crm', label: 'Overview', exact: true },
  { href: '/crm/pipeline', label: 'Pipeline' },
  { href: '/crm/coupons', label: 'Coupons' },
  { href: '/crm/plans', label: 'Membership plans' },
] as const;

export function CrmSubnav() {
  const pathname = usePathname();

  return (
    <nav className={styles.crmSubnav} aria-label="CRM sections">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.crmSubnavLink} ${active ? styles.crmSubnavLinkActive : ''}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
