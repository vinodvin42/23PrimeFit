'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../../components/coach-shell';
import { CrmSubnav } from '../../../components/crm-subnav';
import { Icon } from '../../../components/icons';
import { useCoach } from '../../../lib/coach-context';
import { type Coupon, formatInr } from '../../../lib/crm';
import styles from '../../page.module.css';

export default function CrmCouponsPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>(
    'PERCENT',
  );
  const [discountValue, setDiscountValue] = useState('10');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCoupons(await api<Coupon[]>('/crm/coupons'));
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

  async function createCoupon() {
    if (!code.trim()) return;
    setSaving('create');
    setError(null);
    try {
      await api('/crm/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountValue: Number(discountValue) || 10,
          maxRedemptions: maxRedemptions.trim()
            ? Number(maxRedemptions)
            : undefined,
        }),
      });
      setNotice(`Coupon ${code.trim().toUpperCase()} created.`);
      setCode('');
      setMaxRedemptions('');
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
      await api(`/crm/coupons/${id}/deactivate`, { method: 'PATCH' });
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

  const active = coupons.filter((c) => c.active);

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
            <h2>Coupons</h2>
            <p>
              Discount codes for client package invoices — not 23PrimeFit SaaS
              billing.
            </p>
          </div>
        </header>

        <div className={styles.crmSplit}>
          <section className={styles.crmPanel}>
            <h3>Create coupon</h3>
            <label className={styles.label}>
              Code
              <input
                className={styles.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WELCOME20"
              />
            </label>
            <label className={styles.label}>
              Discount type
              <select
                className={styles.input}
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as 'PERCENT' | 'FIXED')
                }
              >
                <option value="PERCENT">Percent off</option>
                <option value="FIXED">Fixed amount (INR)</option>
              </select>
            </label>
            <label className={styles.label}>
              {discountType === 'PERCENT' ? 'Percent off' : 'Amount off (INR)'}
              <input
                className={styles.input}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className={styles.label}>
              Max redemptions (optional)
              <input
                className={styles.input}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                inputMode="numeric"
                placeholder="Unlimited"
              />
            </label>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={createCoupon}
              disabled={saving === 'create'}
            >
              {saving === 'create' ? 'Creating…' : 'Create coupon'}
            </button>
          </section>

          <section className={styles.crmPanel}>
            <h3>
              Active coupons{' '}
              <span className={styles.crmCount}>{active.length}</span>
            </h3>
            {coupons.length === 0 ? (
              <div className={styles.emptyState}>
                <h4>No coupons yet</h4>
                <p>Create one to offer clients a package discount.</p>
              </div>
            ) : (
              <ul className={styles.suiteList}>
                {coupons.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.code}</strong>
                      <small>
                        {c.discountType === 'PERCENT'
                          ? `${c.discountValue}% off`
                          : `${formatInr(c.discountValue)} off`}{' '}
                        · {c.redemptionCount} redeemed
                        {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                      </small>
                    </div>
                    {c.active ? (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => deactivate(c.id)}
                        disabled={saving === `off-${c.id}`}
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
