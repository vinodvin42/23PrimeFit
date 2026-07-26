'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  stage: string;
  packageName?: string | null;
  notes?: string | null;
  updatedAt?: string;
};

type Invoice = {
  id: string;
  packageName: string;
  amountInr: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
};

type Contract = {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
  acceptedAt?: string | null;
};

type LeadDetail = Lead & {
  invoices: Invoice[];
  contracts: Contract[];
};

type Coupon = {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxRedemptions?: number | null;
  redemptionCount: number;
  expiresAt?: string | null;
  active: boolean;
};

type MembershipPlan = {
  id: string;
  name: string;
  description?: string | null;
  priceInr: number;
  durationDays?: number | null;
  sessionCount?: number | null;
  active: boolean;
};

const STAGES = ['lead', 'qualified', 'proposal', 'active', 'paused'] as const;

function stageLabel(stage: string) {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function CrmPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [packageName, setPackageName] = useState('Coaching package');
  const [amountInr, setAmountInr] = useState('5000');
  const [couponCode, setCouponCode] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'PERCENT' | 'FIXED'>(
    'PERCENT',
  );
  const [newCouponValue, setNewCouponValue] = useState('10');
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('5000');
  const [newPlanSessions, setNewPlanSessions] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('');

  const loadCoupons = useCallback(async () => {
    const rows = await api<Coupon[]>('/crm/coupons');
    setCoupons(rows);
  }, [api]);

  async function createCoupon() {
    if (!newCouponCode.trim()) return;
    setSaving('coupon');
    try {
      await api('/crm/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: newCouponCode.trim(),
          discountType: newCouponType,
          discountValue: Number(newCouponValue) || 10,
        }),
      });
      setNewCouponCode('');
      setNotice(`Coupon "${newCouponCode.trim().toUpperCase()}" created.`);
      await loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function deactivateCoupon(id: string) {
    setSaving(`coupon-${id}`);
    try {
      await api(`/crm/coupons/${id}/deactivate`, { method: 'PATCH' });
      await loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  const loadMembershipPlans = useCallback(async () => {
    const rows = await api<MembershipPlan[]>('/crm/membership-plans');
    setMembershipPlans(rows);
  }, [api]);

  async function createMembershipPlan() {
    if (!newPlanName.trim()) return;
    setSaving('plan');
    try {
      await api('/crm/membership-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: newPlanName.trim(),
          priceInr: Number(newPlanPrice) || 5000,
          sessionCount: newPlanSessions.trim()
            ? Number(newPlanSessions)
            : undefined,
          durationDays: newPlanDuration.trim()
            ? Number(newPlanDuration)
            : undefined,
        }),
      });
      setNewPlanName('');
      setNewPlanSessions('');
      setNewPlanDuration('');
      setNotice(`Plan "${newPlanName.trim()}" created.`);
      await loadMembershipPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function deactivateMembershipPlan(id: string) {
    setSaving(`plan-${id}`);
    try {
      await api(`/crm/membership-plans/${id}/deactivate`, {
        method: 'PATCH',
      });
      await loadMembershipPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function enrollSelectedLead(planId: string) {
    if (!selectedId) return;
    setSaving(`enroll-${planId}`);
    try {
      await api(`/crm/leads/${selectedId}/enroll`, {
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

  const loadDetail = useCallback(
    async (leadId: string) => {
      const row = await api<LeadDetail>(`/crm/leads/${leadId}`);
      setDetail(row);
      setNotes(row.notes ?? '');
      setPhone(row.phone ?? '');
      setPackageName(row.packageName || 'Coaching package');
    },
    [api],
  );

  const load = useCallback(async () => {
    const rows = await api<Lead[]>('/crm/leads');
    setLeads(rows);
    const nextId =
      (selectedId && rows.some((row) => row.id === selectedId)
        ? selectedId
        : rows[0]?.id) ?? null;
    setSelectedId(nextId);
    if (nextId) await loadDetail(nextId);
    else setDetail(null);
  }, [api, loadDetail, selectedId]);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const rows = await api<Lead[]>('/crm/leads');
        setLeads(rows);
        const initial = rows[0]?.id ?? null;
        setSelectedId(initial);
        if (initial) await loadDetail(initial);
        else setDetail(null);
        await loadCoupons();
        await loadMembershipPlans();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const stageOk = stageFilter === 'all' || lead.stage === stageFilter;
      const textOk =
        !query ||
        `${lead.name} ${lead.email ?? ''} ${lead.packageName ?? ''}`
          .toLowerCase()
          .includes(query);
      return stageOk && textOk;
    });
  }, [leads, search, stageFilter]);

  async function selectLead(id: string) {
    setSelectedId(id);
    setNotice(null);
    setError(null);
    try {
      await loadDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addLead(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setSaving('create');
    setError(null);
    try {
      const created = await api<Lead>('/crm/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
        }),
      });
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setShowComposer(false);
      setNotice(`Lead “${created.name}” added to pipeline.`);
      const rows = await api<Lead[]>('/crm/leads');
      setLeads(rows);
      setSelectedId(created.id);
      await loadDetail(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function setStage(stage: string) {
    if (!selectedId) return;
    setSaving('stage');
    try {
      await api(`/crm/leads/${selectedId}`, {
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
    if (!selectedId) return;
    setSaving('notes');
    try {
      await api(`/crm/leads/${selectedId}`, {
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
    if (!selectedId) return;
    setSaving('invoice');
    try {
      await api(`/crm/leads/${selectedId}/invoices`, {
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
    if (!selectedId || !detail) return;
    setSaving('contract');
    try {
      await api(`/crm/leads/${selectedId}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          title: `${detail.name} coaching waiver`,
          kind: 'waiver',
        }),
      });
      setNotice('Waiver / contract drafted for this lead.');
      await loadDetail(selectedId);
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
      if (selectedId) await loadDetail(selectedId);
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

        <div className={styles.clientWorkspace}>
          <section className={styles.rosterSidebar}>
            <div className={styles.rosterHeader}>
              <div>
                <h3>Pipeline</h3>
                <span>{leads.length} prospects</span>
              </div>
              <div className={styles.rosterHeaderActions}>
                <button
                  type="button"
                  onClick={() => setShowComposer((value) => !value)}
                >
                  {showComposer ? 'Close' : 'Add lead'}
                </button>
              </div>
            </div>

            {showComposer ? (
              <form className={styles.sidebarComposer} onSubmit={addLead}>
                <input
                  className={styles.input}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Lead name"
                  required
                />
                <input
                  className={styles.input}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                />
                <input
                  className={styles.input}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone (optional)"
                />
                <button
                  className={styles.assignSelectedButton}
                  type="submit"
                  disabled={saving === 'create'}
                >
                  <Icon name="clients" size={15} />
                  {saving === 'create' ? 'Adding…' : 'Add to pipeline'}
                </button>
              </form>
            ) : null}

            <label className={styles.rosterSearch}>
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads"
              />
            </label>
            <div className={styles.rosterFilters}>
              <button
                type="button"
                className={
                  stageFilter === 'all' ? styles.filterChipActive : undefined
                }
                onClick={() => setStageFilter('all')}
              >
                All
              </button>
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={
                    stageFilter === stage ? styles.filterChipActive : undefined
                  }
                  onClick={() => setStageFilter(stage)}
                >
                  {stageLabel(stage)}
                </button>
              ))}
            </div>
            <ul className={styles.rosterList}>
              {filtered.map((lead, index) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className={`${styles.rosterClient} ${
                      selectedId === lead.id ? styles.rosterClientActive : ''
                    }`}
                    onClick={() => selectLead(lead.id)}
                  >
                    <span
                      className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}
                    >
                      {initials(lead.name)}
                    </span>
                    <span className={styles.rosterClientName}>
                      <strong>{lead.name}</strong>
                      <small>
                        {stageLabel(lead.stage)}
                        {lead.email ? ` · ${lead.email}` : ''}
                      </small>
                    </span>
                    <span className={styles.statusDot} />
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className={styles.compactEmpty}>No matching leads</li>
              ) : null}
            </ul>
          </section>

          <section className={styles.clientDetail}>
            {detail ? (
              <>
                <header className={styles.clientProfileHeader}>
                  <div className={styles.profileIdentity}>
                    <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>
                      {initials(detail.name)}
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

                <div className={styles.clientDetailBody}>
                  <div>
                    <h3 className={styles.subTitle}>Pipeline stage</h3>
                    <div className={styles.rosterFilters}>
                      {STAGES.map((stage) => (
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
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Discovery notes, goals, objections…"
                    />
                  </label>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={saveProfile}
                    disabled={saving === 'notes'}
                  >
                    {saving === 'notes' ? 'Saving…' : 'Save notes'}
                  </button>

                  <section className={styles.assignmentCatalog}>
                    <header>
                      <div>
                        <h3>Sell package</h3>
                        <p>
                          Invoice a coaching package and move the lead to active.
                        </p>
                      </div>
                      <span>Commerce</span>
                    </header>
                    <div className={styles.assignmentColumns}>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="sparkles" size={17} />
                          </span>
                          <div>
                            <h4>New invoice</h4>
                            <p>Client commerce · separate from SaaS billing</p>
                          </div>
                        </div>
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
                            placeholder="e.g. SAVE20"
                          />
                        </label>
                        <button
                          className={styles.assignSelectedButton}
                          type="button"
                          onClick={invoice}
                          disabled={saving === 'invoice'}
                        >
                          <Icon name="check" size={15} />
                          {saving === 'invoice'
                            ? 'Invoicing…'
                            : 'Invoice package'}
                        </button>
                      </div>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="activity" size={17} />
                          </span>
                          <div>
                            <h4>Invoice history</h4>
                            <p>
                              {detail.invoices.length === 0
                                ? 'No invoices yet'
                                : `${detail.invoices.length} on file`}
                            </p>
                          </div>
                        </div>
                        {detail.invoices.length === 0 ? (
                          <p className={styles.hint}>
                            Create a package invoice to track client payments.
                          </p>
                        ) : (
                          <ul className={styles.suiteList}>
                            {detail.invoices.map((inv) => (
                              <li key={inv.id}>
                                <div>
                                  <strong>{inv.packageName}</strong>
                                  <small>
                                    ₹{inv.amountInr.toLocaleString()} ·{' '}
                                    {inv.status} · {inv.createdAt.slice(0, 10)}
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
                      </div>
                    </div>
                  </section>

                  <section className={styles.assignmentCatalog}>
                    <header>
                      <div>
                        <h3>Coupons</h3>
                        <p>
                          Discount codes clients can redeem on a package
                          invoice — separate from 23PrimeFit&apos;s own SaaS
                          billing discounts.
                        </p>
                      </div>
                      <span>Commerce</span>
                    </header>
                    <div className={styles.assignmentColumns}>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="plus" size={17} />
                          </span>
                          <div>
                            <h4>New coupon</h4>
                            <p>Apply it by code at invoice time</p>
                          </div>
                        </div>
                        <label className={styles.label}>
                          Code
                          <input
                            className={styles.input}
                            value={newCouponCode}
                            onChange={(e) => setNewCouponCode(e.target.value)}
                            placeholder="e.g. SAVE20"
                          />
                        </label>
                        <label className={styles.label}>
                          Discount type
                          <select
                            className={styles.input}
                            value={newCouponType}
                            onChange={(e) =>
                              setNewCouponType(
                                e.target.value as 'PERCENT' | 'FIXED',
                              )
                            }
                          >
                            <option value="PERCENT">Percent off</option>
                            <option value="FIXED">Fixed amount (INR)</option>
                          </select>
                        </label>
                        <label className={styles.label}>
                          {newCouponType === 'PERCENT'
                            ? 'Percent off'
                            : 'Amount off (INR)'}
                          <input
                            className={styles.input}
                            value={newCouponValue}
                            onChange={(e) => setNewCouponValue(e.target.value)}
                            inputMode="numeric"
                          />
                        </label>
                        <button
                          className={styles.assignSelectedButton}
                          type="button"
                          onClick={createCoupon}
                          disabled={saving === 'coupon'}
                        >
                          <Icon name="check" size={15} />
                          {saving === 'coupon' ? 'Creating…' : 'Create coupon'}
                        </button>
                      </div>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="activity" size={17} />
                          </span>
                          <div>
                            <h4>Active coupons</h4>
                            <p>
                              {coupons.filter((c) => c.active).length === 0
                                ? 'None yet'
                                : `${coupons.filter((c) => c.active).length} live`}
                            </p>
                          </div>
                        </div>
                        {coupons.length === 0 ? (
                          <p className={styles.hint}>
                            Create a coupon to offer clients a discount.
                          </p>
                        ) : (
                          <ul className={styles.suiteList}>
                            {coupons.map((c) => (
                              <li key={c.id}>
                                <div>
                                  <strong>{c.code}</strong>
                                  <small>
                                    {c.discountType === 'PERCENT'
                                      ? `${c.discountValue}% off`
                                      : `₹${c.discountValue.toLocaleString()} off`}{' '}
                                    · {c.redemptionCount} redeemed
                                    {c.maxRedemptions
                                      ? ` / ${c.maxRedemptions}`
                                      : ''}
                                  </small>
                                </div>
                                {c.active ? (
                                  <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => deactivateCoupon(c.id)}
                                    disabled={saving === `coupon-${c.id}`}
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <span className={styles.neutralPill}>
                                    Inactive
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className={styles.assignmentCatalog}>
                    <header>
                      <div>
                        <h3>Membership plans</h3>
                        <p>
                          Recurring or session-pack packages clients enroll
                          into — separate from 23PrimeFit&apos;s own SaaS
                          subscription plans.
                        </p>
                      </div>
                      <span>Commerce</span>
                    </header>
                    <div className={styles.assignmentColumns}>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="plus" size={17} />
                          </span>
                          <div>
                            <h4>New plan</h4>
                            <p>Leave sessions or duration blank for unlimited</p>
                          </div>
                        </div>
                        <label className={styles.label}>
                          Name
                          <input
                            className={styles.input}
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            placeholder="e.g. 12-Session Pack"
                          />
                        </label>
                        <label className={styles.label}>
                          Price (INR)
                          <input
                            className={styles.input}
                            value={newPlanPrice}
                            onChange={(e) => setNewPlanPrice(e.target.value)}
                            inputMode="numeric"
                          />
                        </label>
                        <label className={styles.label}>
                          Session count (optional)
                          <input
                            className={styles.input}
                            value={newPlanSessions}
                            onChange={(e) =>
                              setNewPlanSessions(e.target.value)
                            }
                            inputMode="numeric"
                          />
                        </label>
                        <label className={styles.label}>
                          Duration in days (optional)
                          <input
                            className={styles.input}
                            value={newPlanDuration}
                            onChange={(e) =>
                              setNewPlanDuration(e.target.value)
                            }
                            inputMode="numeric"
                          />
                        </label>
                        <button
                          className={styles.assignSelectedButton}
                          type="button"
                          onClick={createMembershipPlan}
                          disabled={saving === 'plan'}
                        >
                          <Icon name="check" size={15} />
                          {saving === 'plan' ? 'Creating…' : 'Create plan'}
                        </button>
                      </div>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="activity" size={17} />
                          </span>
                          <div>
                            <h4>Plans</h4>
                            <p>
                              {membershipPlans.length === 0
                                ? 'None yet'
                                : `${membershipPlans.length} active`}
                            </p>
                          </div>
                        </div>
                        {membershipPlans.length === 0 ? (
                          <p className={styles.hint}>
                            Create a plan, then enroll the selected lead
                            below.
                          </p>
                        ) : (
                          <ul className={styles.suiteList}>
                            {membershipPlans.map((p) => (
                              <li key={p.id}>
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>
                                    ₹{p.priceInr.toLocaleString()}
                                    {p.sessionCount
                                      ? ` · ${p.sessionCount} sessions`
                                      : ''}
                                    {p.durationDays
                                      ? ` · ${p.durationDays} days`
                                      : ''}
                                  </small>
                                </div>
                                <div className={styles.inlineActions}>
                                  <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => enrollSelectedLead(p.id)}
                                    disabled={
                                      !selectedId ||
                                      saving === `enroll-${p.id}`
                                    }
                                  >
                                    Enroll lead
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() =>
                                      deactivateMembershipPlan(p.id)
                                    }
                                    disabled={saving === `plan-${p.id}`}
                                  >
                                    Deactivate
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className={styles.assignmentCatalog}>
                    <header>
                      <div>
                        <h3>Contracts & waivers</h3>
                        <p>Draft agreements for this prospect before onboarding.</p>
                      </div>
                      <span>Legal</span>
                    </header>
                    <div className={styles.assignmentColumnsSingle}>
                      <div className={styles.suiteFormStack}>
                        <div className={styles.suiteFormActions}>
                          <button
                            className={styles.assignSelectedButton}
                            type="button"
                            onClick={addContract}
                            disabled={saving === 'contract'}
                          >
                            <Icon name="check" size={15} />
                            {saving === 'contract'
                              ? 'Creating…'
                              : 'Create waiver'}
                          </button>
                        </div>
                        {detail.contracts.length === 0 ? (
                          <p className={styles.hint}>
                            No contracts yet for this lead.
                          </p>
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
                      </div>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className={styles.clientDetailBody}>
                <p className={styles.hint}>
                  No leads yet. Use <strong>Add lead</strong> in the pipeline to
                  capture your first prospect.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
