'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type StaffMembership = {
  id: string;
  role: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    subscriptions?: Array<{
      status: string;
      plan?: {
        name: string;
        clientSeatLimit: number;
        priceInrMonthly: number;
      };
    }>;
  };
};

type TeamMember = {
  id: string;
  role: string;
  user: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    role: string;
  };
};

type Invitation = {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

type Usage = {
  seats: { used: number; limit: number };
  plan?: { name: string; priceInrMonthly: number } | null;
  periodKey: string;
  team?: TeamMember[];
  invitations?: Invitation[];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function WorkspacePage() {
  const { api, ready, session, activeTenantId, setActiveTenantId } = useCoach();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMembership[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const selectedId = activeTenantId ?? staff[0]?.tenant.id ?? null;
  const selected = useMemo(
    () => staff.find((row) => row.tenant.id === selectedId) ?? null,
    [staff, selectedId],
  );

  const loadUsage = useCallback(
    async (tenantId: string) => {
      const u = await api<Usage>(`/tenants/${tenantId}/usage`);
      setUsage(u);
    },
    [api],
  );

  const refresh = useCallback(
    async (preferredId?: string | null) => {
      const me = await api<{ staff: StaffMembership[] }>('/tenants/me');
      setStaff(me.staff);
      const tid =
        preferredId ?? activeTenantId ?? me.staff[0]?.tenant.id ?? null;
      if (tid && tid !== activeTenantId) setActiveTenantId(tid);
      if (tid) await loadUsage(tid);
      else setUsage(null);
    },
    [api, activeTenantId, setActiveTenantId, loadUsage],
  );

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    refresh().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, router]);

  useEffect(() => {
    if (!ready || !session || !selectedId) return;
    loadUsage(selectedId).catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [ready, session, selectedId, loadUsage]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((row) =>
      `${row.tenant.name} ${row.tenant.slug} ${row.role}`
        .toLowerCase()
        .includes(query),
    );
  }, [staff, search]);

  async function selectWorkspace(id: string) {
    setActiveTenantId(id);
    setNotice(null);
    setInviteToken(null);
    setError(null);
  }

  async function createWorkspace() {
    setError(null);
    setSaving('create');
    try {
      const tenant = await api<{ id: string; name: string }>(
        '/tenants/register',
        {
          method: 'POST',
          body: JSON.stringify({
            name: workspaceName.trim() || 'My Coaching Studio',
          }),
        },
      );
      setWorkspaceName('');
      setShowCreate(false);
      setNotice(`Workspace “${tenant.name}” created with a 14-day trial.`);
      await refresh(tenant.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function activate() {
    if (!selectedId) return;
    setSaving('activate');
    setError(null);
    try {
      await api(`/tenants/${selectedId}/activate-subscription`, {
        method: 'POST',
      });
      setNotice('Subscription activated.');
      await refresh(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function invite() {
    if (!selectedId || !inviteEmail.trim()) return;
    setSaving('invite');
    setError(null);
    try {
      const res = await api<{ token: string; acceptPath: string }>(
        `/tenants/${selectedId}/invitations`,
        {
          method: 'POST',
          body: JSON.stringify({ email: inviteEmail.trim() }),
        },
      );
      setInviteToken(res.token);
      setInviteEmail('');
      setNotice(`Invite ready — client accepts via ${res.acceptPath}`);
      await loadUsage(selectedId);
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

  const sub = selected?.tenant.subscriptions?.[0];
  const team = usage?.team ?? [];
  const invitations = usage?.invitations ?? [];
  const priceLabel = usage?.plan
    ? `₹${usage.plan.priceInrMonthly.toLocaleString()}/mo`
    : sub?.plan
      ? `₹${sub.plan.priceInrMonthly.toLocaleString()}/mo`
      : 'Trial';

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
                <h3>Workspaces</h3>
                <span>{staff.length} studios</span>
              </div>
              <div className={styles.rosterHeaderActions}>
                <button
                  type="button"
                  onClick={() => setShowCreate((value) => !value)}
                >
                  {showCreate ? 'Close' : 'New studio'}
                </button>
              </div>
            </div>

            {showCreate ? (
              <div className={styles.sidebarComposer}>
                <input
                  className={styles.input}
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Studio name"
                />
                <button
                  className={styles.assignSelectedButton}
                  type="button"
                  onClick={createWorkspace}
                  disabled={saving === 'create'}
                >
                  <Icon name="check" size={15} />
                  {saving === 'create' ? 'Creating…' : 'Create & start trial'}
                </button>
              </div>
            ) : null}

            <label className={styles.rosterSearch}>
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workspaces"
              />
            </label>
            <div className={styles.rosterFilters}>
              <span className={styles.filterChipActive}>My memberships</span>
            </div>
            <ul className={styles.rosterList}>
              {filtered.map((row, index) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`${styles.rosterClient} ${
                      selectedId === row.tenant.id
                        ? styles.rosterClientActive
                        : ''
                    }`}
                    onClick={() => selectWorkspace(row.tenant.id)}
                  >
                    <span
                      className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}
                    >
                      {initials(row.tenant.name)}
                    </span>
                    <span className={styles.rosterClientName}>
                      <strong>{row.tenant.name}</strong>
                      <small>
                        {row.role} · {row.tenant.slug}
                      </small>
                    </span>
                    <span className={styles.statusDot} />
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className={styles.compactEmpty}>No matching workspaces</li>
              ) : null}
            </ul>
          </section>

          <section className={styles.clientDetail}>
            {selected ? (
              <>
                <header className={styles.clientProfileHeader}>
                  <div className={styles.profileIdentity}>
                    <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>
                      {initials(selected.tenant.name)}
                    </span>
                    <div>
                      <div className={styles.profileTitleRow}>
                        <h3>{selected.tenant.name}</h3>
                        <span className={styles.activePill}>
                          {sub?.status ?? 'trial'}
                        </span>
                      </div>
                      <p>
                        {selected.tenant.slug} ·{' '}
                        {selected.tenant.type.replaceAll('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className={styles.profileActions}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={activate}
                      disabled={saving === 'activate'}
                    >
                      <Icon name="sparkles" size={16} />
                      {saving === 'activate' ? 'Activating…' : 'Activate plan'}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => router.push('/crm')}
                    >
                      <Icon name="clients" size={16} /> Open CRM
                    </button>
                  </div>
                </header>

                <div className={styles.clientMetricGrid}>
                  <article>
                    <span>
                      <Icon name="sparkles" size={17} />
                    </span>
                    <div>
                      <small>Plan</small>
                      <strong>
                        {usage?.plan?.name ?? sub?.plan?.name ?? '—'}
                      </strong>
                    </div>
                  </article>
                  <article>
                    <span>
                      <Icon name="clients" size={17} />
                    </span>
                    <div>
                      <small>Seats</small>
                      <strong>
                        {usage
                          ? `${usage.seats.used}/${usage.seats.limit}`
                          : '—'}
                      </strong>
                    </div>
                  </article>
                  <article>
                    <span>
                      <Icon name="activity" size={17} />
                    </span>
                    <div>
                      <small>Billing</small>
                      <strong>{priceLabel}</strong>
                    </div>
                  </article>
                  <article>
                    <span>
                      <Icon name="check" size={17} />
                    </span>
                    <div>
                      <small>Your role</small>
                      <strong>{selected.role}</strong>
                    </div>
                  </article>
                </div>

                <div className={styles.clientDetailBody}>
                  <p className={styles.hint}>
                    SaaS billing is separate from client package invoices in
                    Client CRM. Period {usage?.periodKey ?? '—'}.
                  </p>

                  <section className={styles.assignmentCatalog}>
                    <header>
                      <div>
                        <h3>Invite client</h3>
                        <p>
                          Send a workspace invite that counts against seat usage.
                        </p>
                      </div>
                      <span>Seats</span>
                    </header>
                    <div className={styles.assignmentColumns}>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="message" size={17} />
                          </span>
                          <div>
                            <h4>New invite</h4>
                            <p>
                              {usage
                                ? `${usage.seats.limit - usage.seats.used} seats left`
                                : 'Loading seats…'}
                            </p>
                          </div>
                        </div>
                        <label className={styles.label}>
                          Client email
                          <input
                            className={styles.input}
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="client@email.com"
                            type="email"
                          />
                        </label>
                        <button
                          className={styles.assignSelectedButton}
                          type="button"
                          onClick={invite}
                          disabled={saving === 'invite' || !inviteEmail.trim()}
                        >
                          <Icon name="message" size={15} />
                          {saving === 'invite' ? 'Sending…' : 'Send invite'}
                        </button>
                        {inviteToken ? (
                          <p className={styles.hint}>Dev token: {inviteToken}</p>
                        ) : null}
                      </div>
                      <div className={styles.suiteFormColumn}>
                        <div className={styles.assignmentColumnTitle}>
                          <span>
                            <Icon name="calendar" size={17} />
                          </span>
                          <div>
                            <h4>Pending invites</h4>
                            <p>
                              {invitations.length === 0
                                ? 'None waiting'
                                : `${invitations.length} outstanding`}
                            </p>
                          </div>
                        </div>
                        {invitations.length === 0 ? (
                          <p className={styles.hint}>
                            Invites appear here until the client accepts.
                          </p>
                        ) : (
                          <ul className={styles.suiteList}>
                            {invitations.map((inv) => (
                              <li key={inv.id}>
                                <div>
                                  <strong>{inv.email}</strong>
                                  <small>
                                    Expires {inv.expiresAt.slice(0, 10)}
                                  </small>
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
                        <h3>Team</h3>
                        <p>Staff with access to this coaching workspace.</p>
                      </div>
                      <span>{team.length} members</span>
                    </header>
                    <div className={styles.assignmentColumnsSingle}>
                      <div className={styles.suiteFormStack}>
                        {team.length === 0 ? (
                          <p className={styles.hint}>No team members loaded.</p>
                        ) : (
                          <ul className={styles.suiteList}>
                            {team.map((member) => (
                              <li key={member.id}>
                                <div>
                                  <strong>
                                    {member.user.displayName ||
                                      member.user.email ||
                                      'Coach'}
                                  </strong>
                                  <small>
                                    {member.role}
                                    {member.user.email
                                      ? ` · ${member.user.email}`
                                      : ''}
                                  </small>
                                </div>
                                <span className={styles.activePill}>
                                  {member.role}
                                </span>
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
                  No workspace membership yet. Use <strong>New studio</strong> to
                  create one and start a trial.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
