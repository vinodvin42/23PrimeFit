'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  active: boolean;
  subscriptions?: Array<{
    status: string;
    plan?: { name: string; priceInrMonthly: number };
  }>;
  _count?: { memberships: number; clientMemberships: number };
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function PlatformAdminPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [analytics, setAnalytics] = useState<{
    mrrInr: number;
    activeTenants: number;
  } | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const rows = await api<TenantRow[]>('/tenants/platform/tenants');
        setTenants(rows);
        setSelectedId(rows[0]?.id ?? null);
        setAnalytics(
          await api<{ mrrInr: number; activeTenants: number }>(
            '/platform/analytics',
          ).catch(() => null),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [api, ready, session, router]);

  const selected = useMemo(
    () => tenants.find((row) => row.id === selectedId) ?? null,
    [tenants, selectedId],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((row) =>
      `${row.name} ${row.slug} ${row.type}`.toLowerCase().includes(query),
    );
  }, [tenants, search]);

  async function uploadKnowledge() {
    try {
      await api('/knowledge', {
        method: 'POST',
        body: JSON.stringify({
          title: knowledgeTitle,
          content: knowledgeContent,
        }),
      });
      setKnowledgeTitle('');
      setKnowledgeContent('');
      setNotice('Knowledge document uploaded for tenant AI citations.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
                <h3>Tenants</h3>
                <span>{tenants.length} workspaces</span>
              </div>
            </div>
            <label className={styles.rosterSearch}>
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants"
              />
            </label>
            <div className={styles.rosterFilters}>
              <span className={styles.filterChipActive}>Platform</span>
            </div>
            <ul className={styles.rosterList}>
              {filtered.map((row, index) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`${styles.rosterClient} ${
                      selectedId === row.id ? styles.rosterClientActive : ''
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span
                      className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}
                    >
                      {initials(row.name)}
                    </span>
                    <span className={styles.rosterClientName}>
                      <strong>{row.name}</strong>
                      <small>
                        {row.type.replaceAll('_', ' ')} · {row.slug}
                      </small>
                    </span>
                    <span className={styles.statusDot} />
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className={styles.compactEmpty}>No matching tenants</li>
              ) : null}
            </ul>
          </section>

          <section className={styles.clientDetail}>
            <header className={styles.clientProfileHeader}>
              <div className={styles.profileIdentity}>
                <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>
                  {selected ? initials(selected.name) : 'PF'}
                </span>
                <div>
                  <div className={styles.profileTitleRow}>
                    <h3>{selected?.name ?? 'Platform'}</h3>
                    <span className={styles.activePill}>
                      {selected?.active ? 'Active' : 'Offline'}
                    </span>
                  </div>
                  <p>{selected?.slug ?? 'Select a tenant'}</p>
                </div>
              </div>
            </header>

            <div className={styles.clientMetricGrid}>
              <article>
                <span>
                  <Icon name="trend" size={17} />
                </span>
                <div>
                  <small>Tenant MRR</small>
                  <strong>₹{analytics?.mrrInr?.toLocaleString() ?? '—'}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Icon name="clients" size={17} />
                </span>
                <div>
                  <small>Active tenants</small>
                  <strong>{analytics?.activeTenants ?? '—'}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Icon name="activity" size={17} />
                </span>
                <div>
                  <small>Staff</small>
                  <strong>{selected?._count?.memberships ?? '—'}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Icon name="heart" size={17} />
                </span>
                <div>
                  <small>Clients</small>
                  <strong>{selected?._count?.clientMemberships ?? '—'}</strong>
                </div>
              </article>
            </div>

            <div className={styles.clientDetailBody}>
              {selected ? (
                <div>
                  <h3 className={styles.subTitle}>Subscription</h3>
                  <p className={styles.hint}>
                    {selected.subscriptions?.[0]?.plan?.name ?? 'No plan'} ·{' '}
                    {selected.subscriptions?.[0]?.status ?? 'none'}
                    {selected.subscriptions?.[0]?.plan?.priceInrMonthly != null
                      ? ` · ₹${selected.subscriptions[0].plan.priceInrMonthly.toLocaleString()}/mo`
                      : ''}
                  </p>
                </div>
              ) : null}

              <section className={styles.assignmentCatalog}>
                <header>
                  <div>
                    <h3>Tenant AI knowledge</h3>
                    <p>Upload content coaches can cite in AI answers.</p>
                  </div>
                </header>
                <div className={styles.assignmentColumns}>
                  <div className={styles.assignmentColumn}>
                    <label className={styles.label}>
                      Title
                      <input
                        className={styles.input}
                        value={knowledgeTitle}
                        onChange={(e) => setKnowledgeTitle(e.target.value)}
                        placeholder="Document title"
                      />
                    </label>
                    <label className={styles.label}>
                      Content
                      <textarea
                        className={styles.input}
                        rows={5}
                        value={knowledgeContent}
                        onChange={(e) => setKnowledgeContent(e.target.value)}
                        placeholder="Paste coaching knowledge…"
                      />
                    </label>
                    <button
                      className={styles.assignSelectedButton}
                      type="button"
                      onClick={uploadKnowledge}
                      disabled={!knowledgeTitle || !knowledgeContent}
                    >
                      <Icon name="sparkles" size={15} /> Upload knowledge
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
