'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type ClientRow = {
  id: string;
  client: {
    id: string;
    email?: string | null;
    displayName?: string | null;
  };
};

type Catalog = {
  programs: Array<{
    slug: string;
    title: string;
    description?: string;
    level?: string;
    durationMin?: number;
    daysPerWeek?: number;
    imageUrl?: string | null;
  }>;
  mealPlans: Array<{
    slug: string;
    title: string;
    description?: string;
    dailyKcal?: number;
    imageUrl?: string | null;
  }>;
};

type Overview = {
  link: { notes?: string | null };
  client: { id: string; displayName?: string | null; email?: string | null };
  workoutProgram?: { title: string; slug: string } | null;
  mealPlan?: { title: string; slug: string } | null;
  recovery?: {
    sleepHours?: number;
    steps?: number;
    source?: string;
    recoveryScore?: number;
  } | null;
  progressPhotos?: Array<{
    id: string;
    pose: string;
    fileUrl: string;
    weightKg?: number | null;
    takenAt: string;
  }>;
  bloodReports?: Array<{
    id: string;
    title?: string | null;
    summary?: string | null;
    markersJson?: string | null;
    createdAt: string;
  }>;
  healthSignals?: Array<{
    type: string;
    score?: number | null;
    band?: string | null;
    explain?: Record<string, unknown>;
  }>;
  recentCricketSessions?: Array<{
    id: string;
    dateKey: string;
    kind?: string | null;
    rpe?: number | null;
  }>;
};

type FemaleHealthSummary = {
  phase?: { phase?: string; irregular?: boolean };
  suggestion?: string;
};

export default function ClientsPage() {
  const { session, api, ready } = useCoach();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [femaleHealth, setFemaleHealth] = useState<FemaleHealthSummary | null>(null);
  const [notes, setNotes] = useState('');
  const [programSlug, setProgramSlug] = useState('');
  const [mealSlug, setMealSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const selectClient = useCallback(async (clientId: string) => {
    setSelectedId(clientId);
    setNotice(null);
    const ov = await api<Overview>(`/coach/clients/${clientId}`);
    setOverview(ov);
    setFemaleHealth(
      await api<FemaleHealthSummary>(`/female-health/coach/clients/${clientId}`).catch(() => null),
    );
    setNotes(ov.link?.notes ?? '');
    if (ov.workoutProgram?.slug) setProgramSlug(ov.workoutProgram.slug);
    if (ov.mealPlan?.slug) setMealSlug(ov.mealPlan.slug);
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    setSearch(new URLSearchParams(window.location.search).get('search') ?? '');
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const [clientRows, cat] = await Promise.all([
          api<ClientRow[]>('/coach/clients'),
          api<Catalog>('/coach/catalog'),
        ]);
        setClients(clientRows);
        setCatalog(cat);
        setProgramSlug(cat.programs?.[0]?.slug ?? '');
        setMealSlug(cat.mealPlans?.[0]?.slug ?? '');
        const requestedId = new URLSearchParams(window.location.search).get('clientId');
        const initial = clientRows.find((row) => row.client.id === requestedId) ?? clientRows[0];
        if (initial) await selectClient(initial.client.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, [ready, session, api, router, selectClient]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((row) =>
      `${row.client.displayName ?? ''} ${row.client.email ?? ''}`.toLowerCase().includes(query),
    );
  }, [clients, search]);

  function clientName(client: ClientRow['client']) {
    return client.displayName || client.email?.split('@')[0] || 'Client';
  }

  function clientInitials(client: ClientRow['client']) {
    return clientName(client)
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  async function saveNotes() {
    if (!selectedId) return;
    setSaving('notes');
    try {
      await api(`/coach/clients/${selectedId}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
    } finally {
      setSaving(null);
    }
  }

  async function assignWorkout() {
    if (!selectedId || !programSlug) return;
    setSaving('workout');
    try {
      await api(`/coach/clients/${selectedId}/assign-workout/${programSlug}`, {
        method: 'POST',
      });
      await selectClient(selectedId);
      setNotice('Training program assigned successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign training program');
    } finally {
      setSaving(null);
    }
  }

  async function assignMeal() {
    if (!selectedId || !mealSlug) return;
    setSaving('meal');
    try {
      await api(`/coach/clients/${selectedId}/assign-meal-plan/${mealSlug}`, {
        method: 'POST',
      });
      await selectClient(selectedId);
      setNotice('Meal plan assigned successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign meal plan');
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
        {error ? <div className={styles.inlineError}><Icon name="warning" size={18} />{error}</div> : null}
        {notice ? <div className={styles.assignmentNotice}><Icon name="check" size={16} />{notice}</div> : null}
        <div className={styles.clientWorkspace}>
        <section className={styles.rosterSidebar}>
          <div className={styles.rosterHeader}>
            <div><h3>Active roster</h3><span>{clients.length} clients</span></div>
          </div>
          <label className={styles.rosterSearch}>
            <Icon name="search" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roster" />
          </label>
          <div className={styles.rosterFilters}>
            <span className={styles.filterChipActive}>All clients</span>
          </div>
          <ul className={styles.rosterList}>
            {filteredClients.map((row, index) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`${styles.rosterClient} ${selectedId === row.client.id ? styles.rosterClientActive : ''}`}
                  onClick={() => selectClient(row.client.id)}
                >
                  <span className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}>{clientInitials(row.client)}</span>
                  <span className={styles.rosterClientName}>
                    <strong>{clientName(row.client)}</strong>
                    <small>{row.client.email || 'Active coaching client'}</small>
                  </span>
                  <span className={styles.statusDot} />
                </button>
              </li>
            ))}
            {filteredClients.length === 0 ? <li className={styles.compactEmpty}>No matching clients</li> : null}
          </ul>
        </section>

        {overview ? (
          <section className={styles.clientDetail}>
            <header className={styles.clientProfileHeader}>
              <div className={styles.profileIdentity}>
                <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>{clientInitials(overview.client)}</span>
                <div>
                  <div className={styles.profileTitleRow}>
                    <h3>{clientName(overview.client)}</h3>
                    <span className={styles.activePill}>Active</span>
                  </div>
                  <p>{overview.client.email || 'Private coaching client'}</p>
                </div>
              </div>
              <div className={styles.profileActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => router.push(`/chat?clientId=${encodeURIComponent(overview.client.id)}`)}
                >
                  <Icon name="message" size={16} /> Message
                </button>
              </div>
            </header>
            <div className={styles.clientMetricGrid}>
              <article><span><Icon name="moon" size={17} /></span><div><small>Sleep</small><strong>{overview.recovery?.sleepHours ?? '—'}{overview.recovery?.sleepHours ? ' h' : ''}</strong></div></article>
              <article><span><Icon name="activity" size={17} /></span><div><small>Recovery</small><strong>{overview.recovery?.recoveryScore ?? '—'}</strong></div></article>
              <article><span><Icon name="dumbbell" size={17} /></span><div><small>Training</small><strong>{overview.workoutProgram ? 'Assigned' : 'Missing'}</strong></div></article>
              <article><span><Icon name="check" size={17} /></span><div><small>Check-ins</small><strong>{overview.progressPhotos?.length ?? 0}</strong></div></article>
            </div>
            <div className={styles.clientDetailBody}>

            {femaleHealth ? (
              <div>
                <h3 className={styles.subTitle}>Female health (shared by client)</h3>
                <p className={styles.hint}>
                  {femaleHealth.phase?.phase ?? 'Cycle'}{femaleHealth.phase?.irregular ? ' · irregular pattern noted' : ''}
                  {femaleHealth.suggestion ? ` · ${femaleHealth.suggestion}` : ''}
                </p>
              </div>
            ) : null}

            {(overview.healthSignals?.length ?? 0) > 0 ? (
              <div>
                <h3 className={styles.subTitle}>Today&apos;s signals</h3>
                <ul className={styles.list}>
                  {overview.healthSignals!.map((s, i) => (
                    <li key={`${s.type}-${i}`} className={styles.hint}>
                      {s.type}: {s.band ?? '—'}
                      {s.score != null ? ` (${s.score})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className={styles.subTitle}>Blood reports</h3>
              {(overview.bloodReports?.length ?? 0) === 0 ? (
                <p className={styles.hint}>No lab uploads yet</p>
              ) : (
                <ul className={styles.list}>
                  {overview.bloodReports!.map((b) => (
                    <li key={b.id} className={styles.listItem}>
                      <div>
                        <strong>{b.title || 'Lab report'}</strong>
                        <div className={styles.hint}>
                          {b.createdAt.slice(0, 10)} · {b.summary ?? 'No summary'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className={styles.subTitle}>Progress photos</h3>
              {(overview.progressPhotos?.length ?? 0) === 0 ? (
                <p className={styles.hint}>No check-ins yet</p>
              ) : (
                <div className={styles.photoStrip}>
                  {overview.progressPhotos!.map((p) => (
                    <a
                      key={p.id}
                      className={styles.photoCard}
                      href={p.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.fileUrl} alt={`${p.pose} check-in`} />
                      <span>
                        {p.pose} · {p.takenAt.slice(0, 10)}
                        {p.weightKg != null ? ` · ${p.weightKg}kg` : ''}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {(overview.recentCricketSessions?.length ?? 0) > 0 ? (
              <div>
                <h3 className={styles.subTitle}>Recent cricket</h3>
                <ul className={styles.list}>
                  {overview.recentCricketSessions!.map((s) => (
                    <li key={s.id} className={styles.hint}>
                      {s.dateKey} · {s.kind ?? 'session'}
                      {s.rpe != null ? ` · RPE ${s.rpe}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <label className={styles.label}>
              Coach notes
              <textarea
                className={styles.input}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button className={styles.primary} type="button" onClick={saveNotes} disabled={saving === 'notes'}>
              {saving === 'notes' ? 'Saving…' : 'Save notes'}
            </button>
            <section className={styles.assignmentCatalog}>
              <header>
                <div><h3>Assign coaching content</h3><p>Select a published plan from the Content Studio.</p></div>
                <span>{(catalog?.programs.length ?? 0) + (catalog?.mealPlans.length ?? 0)} available</span>
              </header>
              <div className={styles.assignmentColumns}>
                <div className={styles.assignmentColumn}>
                  <div className={styles.assignmentColumnTitle}>
                    <span><Icon name="dumbbell" size={17} /></span>
                    <div><h4>Training programs</h4><p>Current: {overview.workoutProgram?.title ?? 'None assigned'}</p></div>
                  </div>
                  <div className={styles.assignableList}>
                    {(catalog?.programs ?? []).map((item) => {
                      const selected = programSlug === item.slug;
                      const current = overview.workoutProgram?.slug === item.slug;
                      return (
                        <button
                          type="button"
                          key={item.slug}
                          className={`${styles.assignableCard} ${selected ? styles.assignableCardSelected : ''}`}
                          onClick={() => setProgramSlug(item.slug)}
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" />
                          ) : <span className={styles.assignableIcon}><Icon name="dumbbell" size={16} /></span>}
                          <span className={styles.assignableCopy}>
                            <strong>{item.title}</strong>
                            <small>{item.level || 'All levels'}{item.durationMin ? ` · ${item.durationMin} min` : ''}{item.daysPerWeek ? ` · ${item.daysPerWeek}× week` : ''}</small>
                          </span>
                          {current ? <em>Current</em> : <i />}
                        </button>
                      );
                    })}
                    {(catalog?.programs.length ?? 0) === 0 ? <p className={styles.assignmentEmpty}>No published training programs.</p> : null}
                  </div>
                  <button className={styles.assignSelectedButton} type="button" onClick={assignWorkout} disabled={saving === 'workout' || !programSlug}>
                    <Icon name="check" size={15} /> {saving === 'workout' ? 'Assigning…' : 'Assign selected program'}
                  </button>
                </div>

                <div className={styles.assignmentColumn}>
                  <div className={styles.assignmentColumnTitle}>
                    <span><Icon name="heart" size={17} /></span>
                    <div><h4>Meal plans</h4><p>Current: {overview.mealPlan?.title ?? 'None assigned'}</p></div>
                  </div>
                  <div className={styles.assignableList}>
                    {(catalog?.mealPlans ?? []).map((item) => {
                      const selected = mealSlug === item.slug;
                      const current = overview.mealPlan?.slug === item.slug;
                      return (
                        <button
                          type="button"
                          key={item.slug}
                          className={`${styles.assignableCard} ${selected ? styles.assignableCardSelected : ''}`}
                          onClick={() => setMealSlug(item.slug)}
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" />
                          ) : <span className={styles.assignableIcon}><Icon name="heart" size={16} /></span>}
                          <span className={styles.assignableCopy}>
                            <strong>{item.title}</strong>
                            <small>{item.dailyKcal ? `${item.dailyKcal.toLocaleString()} kcal/day` : 'Flexible calorie target'}</small>
                          </span>
                          {current ? <em>Current</em> : <i />}
                        </button>
                      );
                    })}
                    {(catalog?.mealPlans.length ?? 0) === 0 ? <p className={styles.assignmentEmpty}>No published meal plans.</p> : null}
                  </div>
                  <button className={styles.assignSelectedButton} type="button" onClick={assignMeal} disabled={saving === 'meal' || !mealSlug}>
                    <Icon name="check" size={15} /> {saving === 'meal' ? 'Assigning…' : 'Assign selected meal plan'}
                  </button>
                </div>
              </div>
            </section>
            </div>
          </section>
        ) : null}
        </div>
      </div>
    </CoachShell>
  );
}
