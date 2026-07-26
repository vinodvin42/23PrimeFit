'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { CrmSubnav } from '../../components/crm-subnav';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import {
  type Coupon,
  type Lead,
  type MembershipPlan,
  formatInr,
  stageLabel,
} from '../../lib/crm';
import styles from '../page.module.css';

export default function CrmOverviewPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const [leadRows, couponRows, planRows] = await Promise.all([
          api<Lead[]>('/crm/leads'),
          api<Coupon[]>('/crm/coupons'),
          api<MembershipPlan[]>('/crm/membership-plans'),
        ]);
        setLeads(leadRows);
        setCoupons(couponRows);
        setPlans(planRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [ready, session, api, router]);

  const stats = useMemo(() => {
    const byStage = Object.fromEntries(
      ['lead', 'qualified', 'proposal', 'active', 'paused'].map((s) => [
        s,
        leads.filter((l) => l.stage === s).length,
      ]),
    );
    return {
      total: leads.length,
      active: byStage.active ?? 0,
      open:
        (byStage.lead ?? 0) +
        (byStage.qualified ?? 0) +
        (byStage.proposal ?? 0),
      coupons: coupons.filter((c) => c.active).length,
      plans: plans.filter((p) => p.active).length,
      byStage,
    };
  }, [leads, coupons, plans]);

  const recent = leads.slice(0, 5);

  if (!ready || !session) {
    return (
      <CoachShell>
        <p className={styles.hint}>Loading…</p>
      </CoachShell>
    );
  }

  return (
    <CoachShell>
      <div className={styles.featurePage}>
        <CrmSubnav />
        {error ? (
          <div className={styles.inlineError}>
            <Icon name="warning" size={18} />
            {error}
          </div>
        ) : null}

        <header className={styles.crmHero}>
          <div>
            <p className={styles.crmEyebrow}>Business suite</p>
            <h2>Client CRM</h2>
            <p>
              Manage prospects, sell packages, and run coupons — separate from
              your athlete Clients roster.
            </p>
          </div>
          <Link className={styles.primaryButton} href="/crm/pipeline">
            <Icon name="plus" size={16} /> Open pipeline
          </Link>
        </header>

        <div className={styles.crmStatGrid}>
          <article>
            <small>Total leads</small>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <small>Open pipeline</small>
            <strong>{stats.open}</strong>
          </article>
          <article>
            <small>Active clients</small>
            <strong>{stats.active}</strong>
          </article>
          <article>
            <small>Live coupons</small>
            <strong>{stats.coupons}</strong>
          </article>
          <article>
            <small>Membership plans</small>
            <strong>{stats.plans}</strong>
          </article>
        </div>

        <div className={styles.crmHubGrid}>
          <Link href="/crm/pipeline" className={styles.crmHubCard}>
            <span className={styles.crmHubIcon}>
              <Icon name="clients" size={20} />
            </span>
            <h3>Pipeline</h3>
            <p>Capture leads, move stages, and open a prospect workspace.</p>
            <span className={styles.crmHubCta}>
              {stats.total} leads <Icon name="arrow" size={14} />
            </span>
          </Link>
          <Link href="/crm/coupons" className={styles.crmHubCard}>
            <span className={styles.crmHubIcon}>
              <Icon name="sparkles" size={20} />
            </span>
            <h3>Coupons</h3>
            <p>Discount codes for package invoices — not SaaS billing.</p>
            <span className={styles.crmHubCta}>
              {stats.coupons} active <Icon name="arrow" size={14} />
            </span>
          </Link>
          <Link href="/crm/plans" className={styles.crmHubCard}>
            <span className={styles.crmHubIcon}>
              <Icon name="calendar" size={20} />
            </span>
            <h3>Membership plans</h3>
            <p>Session packs and packages you sell to clients.</p>
            <span className={styles.crmHubCta}>
              {stats.plans} plans <Icon name="arrow" size={14} />
            </span>
          </Link>
        </div>

        <section className={styles.crmPanel}>
          <div className={styles.crmPanelHeader}>
            <div>
              <h3>Recent leads</h3>
              <p>Jump into a prospect without scrolling a packed page.</p>
            </div>
            <Link href="/crm/pipeline" className={styles.secondaryButton}>
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className={styles.emptyState}>
              <span>
                <Icon name="clients" size={22} />
              </span>
              <h4>No leads yet</h4>
              <p>Add your first prospect from the pipeline page.</p>
              <Link href="/crm/pipeline" className={styles.primaryButton}>
                Go to pipeline
              </Link>
            </div>
          ) : (
            <ul className={styles.crmLeadList}>
              {recent.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/crm/leads/${lead.id}`}>
                    <strong>{lead.name}</strong>
                    <small>
                      {stageLabel(lead.stage)}
                      {lead.email ? ` · ${lead.email}` : ''}
                    </small>
                  </Link>
                  <span className={styles.activePill}>
                    {stageLabel(lead.stage)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.crmPanel}>
          <div className={styles.crmPanelHeader}>
            <div>
              <h3>Stage snapshot</h3>
              <p>Where prospects sit in your sales funnel.</p>
            </div>
          </div>
          <div className={styles.crmStageRow}>
            {(['lead', 'qualified', 'proposal', 'active', 'paused'] as const).map(
              (stage) => (
                <Link
                  key={stage}
                  href={`/crm/pipeline?stage=${stage}`}
                  className={styles.crmStageChip}
                >
                  <strong>{stats.byStage[stage] ?? 0}</strong>
                  <span>{stageLabel(stage)}</span>
                </Link>
              ),
            )}
          </div>
          {plans[0] ? (
            <p className={styles.hint}>
              Featured plan: <strong>{plans[0].name}</strong> ·{' '}
              {formatInr(plans[0].priceInr)}
            </p>
          ) : null}
        </section>
      </div>
    </CoachShell>
  );
}
