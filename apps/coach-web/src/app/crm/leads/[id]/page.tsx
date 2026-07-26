'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CoachShell } from '../../../../components/coach-shell';
import { CrmSubnav } from '../../../../components/crm-subnav';
import { Icon } from '../../../../components/icons';
import { useCoach } from '../../../../lib/coach-context';
import {
  CRM_STAGES,
  type LeadDetail,
  type MembershipPlan,
  formatInr,
  leadInitials,
  stageLabel,
} from '../../../../lib/crm';
import styles from '../../../page.module.css';

export default function CrmLeadDetailPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [packageName, setPackageName] = useState('Coaching package');
  const [amountInr, setAmountInr] = useState('5000');
  const [couponCode, setCouponCode] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const row = await api<LeadDetail>(`/crm/leads/${leadId}`);
    setDetail(row);
    setNotes(row.notes ?? '');
    setPhone(row.phone ?? '');
    setPackageName(row.packageName || 'Coaching package');
  }, [api, leadId]);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        await load();
        setPlans(await api<MembershipPlan[]>('/crm/membership-plans'));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [ready, session, api, router, load]);

  async function setStage(stage: string) {
    setSaving('stage');
    setError(null);
    try {
      await api(`/crm/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      setNotice(`Moved to ${stageLabel(stage)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function saveProfile() {
    setSaving('notes');
    try {
      await api(`/crm/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes, phone: phone.trim() || null }),
      });
      setNotice('Lead profile saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function invoice() {
    setSaving('invoice');
    try {
      await api(`/crm/leads/${leadId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          packageName: packageName.trim() || 'Coaching package',
          amountInr: Number(amountInr) || 5000,
          couponCode: couponCode.trim() || undefined,
        }),
      });
      setNotice('Package invoice created — lead marked active.');
      setCouponCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function addContract() {
    if (!detail) return;
    setSaving('contract');
    try {
      await api(`/crm/leads/${leadId}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          title: `${detail.name} coaching waiver`,
          kind: 'waiver',
        }),
      });
      setNotice('Waiver drafted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function markPaid(invoiceId: string) {
    setSaving(`paid-${invoiceId}`);
    try {
      await api(`/crm/invoices/${invoiceId}/paid`, { method: 'POST' });
      setNotice('Invoice marked paid.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function enroll(planId: string) {
    setSaving(`enroll-${planId}`);
    try {
      await api(`/crm/leads/${leadId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      setNotice('Lead enrolled in membership plan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

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
        {notice ? (
          <div className={styles.assignmentNotice}>
            <Icon name="check" size={16} />
            {notice}
          </div>
        ) : null}

        <div className={styles.crmBackRow}>
          <Link href="/crm/pipeline" className={styles.secondaryButton}>
            ← Back to pipeline
          </Link>
        </div>

        {!detail ? (
          <p className={styles.hint}>Loading lead…</p>
        ) : (
          <>
            <header className={styles.clientProfileHeader}>
              <div className={styles.profileIdentity}>
                <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>
                  {leadInitials(detail.name)}
                </span>
                <div>
                  <div className={styles.profileTitleRow}>
                    <h3>{detail.name}</h3>
                    <span className={styles.activePill}>
                      {stageLabel(detail.stage)}
                    </span>
                  </div>
                  <p>{detail.email || 'No email on file'}</p>
                </div>
              </div>
              <div className={styles.profileActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => router.push('/clients')}
                >
                  <Icon name="clients" size={16} /> Open clients
                </button>
              </div>
            </header>

            <div className={styles.clientMetricGrid}>
              <article>
                <span>
                  <Icon name="clients" size={17} />
                </span>
                <div>
                  <small>Stage</small>
                  <strong>{stageLabel(detail.stage)}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Icon name="sparkles" size={17} />
                </span>
                <div>
                  <small>Package</small>
                  <strong>{detail.packageName || 'None'}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Icon name="calendar" size={17} />
                </span>
                <div>
                  <small>Invoices</small>
                  <strong>{detail.invoices.length}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Icon name="check" size={17} />
                </span>
                <div>
                  <small>Contracts</small>
                  <strong>{detail.contracts.length}</strong>
                </div>
              </article>
            </div>

            <div className={styles.crmDetailGrid}>
              <section className={styles.crmPanel}>
                <h3>Pipeline stage</h3>
                <div className={styles.rosterFilters}>
                  {CRM_STAGES.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className={
                        detail.stage === stage
                          ? styles.filterChipActive
                          : undefined
                      }
                      onClick={() => setStage(stage)}
                      disabled={saving === 'stage'}
                    >
                      {stageLabel(stage)}
                    </button>
                  ))}
                </div>

                <label className={styles.label}>
                  Phone
                  <input
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91…"
                  />
                </label>
                <label className={styles.label}>
                  Coach notes
                  <textarea
                    className={styles.input}
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Discovery notes, goals, objections…"
                  />
                </label>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={saveProfile}
                  disabled={saving === 'notes'}
                >
                  {saving === 'notes' ? 'Saving…' : 'Save notes'}
                </button>
              </section>

              <section className={styles.crmPanel}>
                <h3>Sell package</h3>
                <p className={styles.hint}>
                  Create an invoice and move this lead to active.
                </p>
                <label className={styles.label}>
                  Package name
                  <input
                    className={styles.input}
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                  />
                </label>
                <label className={styles.label}>
                  Amount (INR)
                  <input
                    className={styles.input}
                    value={amountInr}
                    onChange={(e) => setAmountInr(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
                <label className={styles.label}>
                  Coupon code (optional)
                  <input
                    className={styles.input}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="e.g. WELCOME20"
                  />
                </label>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={invoice}
                  disabled={saving === 'invoice'}
                >
                  {saving === 'invoice' ? 'Invoicing…' : 'Invoice package'}
                </button>

                <h4 className={styles.crmSectionTitle}>Invoice history</h4>
                {detail.invoices.length === 0 ? (
                  <p className={styles.hint}>No invoices yet.</p>
                ) : (
                  <ul className={styles.suiteList}>
                    {detail.invoices.map((inv) => (
                      <li key={inv.id}>
                        <div>
                          <strong>{inv.packageName}</strong>
                          <small>
                            {formatInr(inv.amountInr)} · {inv.status} ·{' '}
                            {inv.createdAt.slice(0, 10)}
                          </small>
                        </div>
                        {inv.status !== 'PAID' ? (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => markPaid(inv.id)}
                            disabled={saving === `paid-${inv.id}`}
                          >
                            Mark paid
                          </button>
                        ) : (
                          <span className={styles.activePill}>Paid</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.crmPanel}>
                <h3>Membership enrollment</h3>
                <p className={styles.hint}>
                  Enroll this lead into a plan from your catalog.
                </p>
                {plans.filter((p) => p.active).length === 0 ? (
                  <p className={styles.hint}>
                    No plans yet.{' '}
                    <Link href="/crm/plans">Create a membership plan</Link>.
                  </p>
                ) : (
                  <ul className={styles.suiteList}>
                    {plans
                      .filter((p) => p.active)
                      .map((p) => (
                        <li key={p.id}>
                          <div>
                            <strong>{p.name}</strong>
                            <small>
                              {formatInr(p.priceInr)}
                              {p.sessionCount
                                ? ` · ${p.sessionCount} sessions`
                                : ''}
                            </small>
                          </div>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => enroll(p.id)}
                            disabled={saving === `enroll-${p.id}`}
                          >
                            Enroll
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              <section className={styles.crmPanel}>
                <h3>Contracts & waivers</h3>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={addContract}
                  disabled={saving === 'contract'}
                >
                  {saving === 'contract' ? 'Creating…' : 'Create waiver'}
                </button>
                {detail.contracts.length === 0 ? (
                  <p className={styles.hint}>No contracts yet.</p>
                ) : (
                  <ul className={styles.suiteList}>
                    {detail.contracts.map((c) => (
                      <li key={c.id}>
                        <div>
                          <strong>{c.title}</strong>
                          <small>
                            {c.kind} · {c.createdAt.slice(0, 10)}
                            {c.acceptedAt ? ' · accepted' : ' · pending'}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </CoachShell>
  );
}
