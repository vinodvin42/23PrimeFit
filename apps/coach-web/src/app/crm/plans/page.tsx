'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../../components/coach-shell';
import { CrmSubnav } from '../../../components/crm-subnav';
import { Icon } from '../../../components/icons';
import { useCoach } from '../../../lib/coach-context';
import { type MembershipPlan, formatInr } from '../../../lib/crm';
import styles from '../../page.module.css';

export default function CrmPlansPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [name, setName] = useState('');
  const [priceInr, setPriceInr] = useState('5000');
  const [sessionCount, setSessionCount] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPlans(await api<MembershipPlan[]>('/crm/membership-plans'));
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    load().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [ready, session, router, load]);

  async function createPlan() {
    if (!name.trim()) return;
    setSaving('create');
    setError(null);
    try {
      await api('/crm/membership-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          priceInr: Number(priceInr) || 5000,
          sessionCount: sessionCount.trim()
            ? Number(sessionCount)
            : undefined,
          durationDays: durationDays.trim()
            ? Number(durationDays)
            : undefined,
        }),
      });
      setNotice(`Plan “${name.trim()}” created.`);
      setName('');
      setDescription('');
      setSessionCount('');
      setDurationDays('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function deactivate(id: string) {
    setSaving(`off-${id}`);
    try {
      await api(`/crm/membership-plans/${id}/deactivate`, { method: 'PATCH' });
      await load();
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

  const active = plans.filter((p) => p.active);

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

        <header className={styles.crmPageHeader}>
          <div>
            <h2>Membership plans</h2>
            <p>
              Session packs and packages you sell to clients. Enroll a lead from
              their pipeline profile.
            </p>
          </div>
        </header>

        <div className={styles.crmSplit}>
          <section className={styles.crmPanel}>
            <h3>Create plan</h3>
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 12-Session Pack"
              />
            </label>
            <label className={styles.label}>
              Description
              <input
                className={styles.input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional short description"
              />
            </label>
            <label className={styles.label}>
              Price (INR)
              <input
                className={styles.input}
                value={priceInr}
                onChange={(e) => setPriceInr(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className={styles.label}>
              Session count (optional)
              <input
                className={styles.input}
                value={sessionCount}
                onChange={(e) => setSessionCount(e.target.value)}
                inputMode="numeric"
                placeholder="Unlimited"
              />
            </label>
            <label className={styles.label}>
              Duration in days (optional)
              <input
                className={styles.input}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                inputMode="numeric"
                placeholder="No end date"
              />
            </label>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={createPlan}
              disabled={saving === 'create'}
            >
              {saving === 'create' ? 'Creating…' : 'Create plan'}
            </button>
          </section>

          <section className={styles.crmPanel}>
            <h3>
              Catalog <span className={styles.crmCount}>{active.length}</span>
            </h3>
            {plans.length === 0 ? (
              <div className={styles.emptyState}>
                <h4>No plans yet</h4>
                <p>Create a plan, then enroll leads from their profile page.</p>
              </div>
            ) : (
              <ul className={styles.suiteList}>
                {plans.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {formatInr(p.priceInr)}
                        {p.sessionCount ? ` · ${p.sessionCount} sessions` : ''}
                        {p.durationDays ? ` · ${p.durationDays} days` : ''}
                        {p.description ? ` · ${p.description}` : ''}
                      </small>
                    </div>
                    {p.active ? (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => deactivate(p.id)}
                        disabled={saving === `off-${p.id}`}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <span className={styles.neutralPill}>Inactive</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
