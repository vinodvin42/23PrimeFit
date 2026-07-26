'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type ChallengeKind =
  | 'WORKOUT_COUNT'
  | 'STREAK_DAYS'
  | 'NUTRITION_LOG_COUNT'
  | 'CUSTOM';

type Challenge = {
  id: string;
  title: string;
  description?: string | null;
  kind: ChallengeKind;
  targetValue: number;
  startAt: string;
  endAt: string;
  active: boolean;
  participantCount: number;
  myProgress: { progressValue: number; completedAt: string | null } | null;
};

type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string | null;
  progressValue: number;
  completedAt: string | null;
  isCurrentUser: boolean;
};

const KIND_LABEL: Record<ChallengeKind, string> = {
  WORKOUT_COUNT: 'Workout count',
  STREAK_DAYS: 'Streak days',
  NUTRITION_LOG_COUNT: 'Nutrition logs',
  CUSTOM: 'Custom',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function CommunityPage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ChallengeKind>('WORKOUT_COUNT');
  const [targetValue, setTargetValue] = useState('10');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  const loadLeaderboard = useCallback(
    async (challengeId: string) => {
      const result = await api<{ leaderboard: LeaderboardRow[] }>(
        `/community/challenges/${challengeId}/leaderboard`,
      );
      setLeaderboard(result.leaderboard);
    },
    [api],
  );

  const load = useCallback(async () => {
    const rows = await api<Challenge[]>('/community/challenges');
    setChallenges(rows);
    const nextId =
      (selectedId && rows.some((row) => row.id === selectedId)
        ? selectedId
        : rows[0]?.id) ?? null;
    setSelectedId(nextId);
    if (nextId) await loadLeaderboard(nextId);
    else setLeaderboard([]);
  }, [api, loadLeaderboard, selectedId]);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const rows = await api<Challenge[]>('/community/challenges');
        setChallenges(rows);
        const initial = rows[0]?.id ?? null;
        setSelectedId(initial);
        if (initial) await loadLeaderboard(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, router]);

  async function selectChallenge(id: string) {
    setSelectedId(id);
    setError(null);
    try {
      await loadLeaderboard(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createChallenge(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !startAt || !endAt) return;
    setSaving('create');
    setError(null);
    try {
      const created = await api<Challenge>('/community/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          kind,
          targetValue: Number(targetValue) || 1,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        }),
      });
      setTitle('');
      setDescription('');
      setTargetValue('10');
      setStartAt('');
      setEndAt('');
      setShowComposer(false);
      setNotice(`Challenge “${created.title}” launched.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function closeChallenge(id: string) {
    setSaving('close');
    try {
      await api(`/community/challenges/${id}/close`, { method: 'PATCH' });
      setNotice('Challenge closed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  const selected = challenges.find((c) => c.id === selectedId) ?? null;

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
                <h3>Challenges</h3>
                <span>{challenges.length} active</span>
              </div>
              <div className={styles.rosterHeaderActions}>
                <button
                  type="button"
                  onClick={() => setShowComposer((value) => !value)}
                >
                  {showComposer ? 'Close' : 'New challenge'}
                </button>
              </div>
            </div>

            {showComposer ? (
              <form className={styles.sidebarComposer} onSubmit={createChallenge}>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Challenge title"
                  required
                />
                <input
                  className={styles.input}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                />
                <select
                  className={styles.input}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ChallengeKind)}
                >
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Target value"
                />
                <input
                  className={styles.input}
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
                <input
                  className={styles.input}
                  type="date"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  required
                />
                <button
                  className={styles.assignSelectedButton}
                  type="submit"
                  disabled={saving === 'create'}
                >
                  <Icon name="trophy" size={15} />
                  {saving === 'create' ? 'Launching…' : 'Launch challenge'}
                </button>
              </form>
            ) : null}

            <ul className={styles.rosterList}>
              {challenges.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`${styles.rosterClient} ${
                      selectedId === c.id ? styles.rosterClientActive : ''
                    }`}
                    onClick={() => selectChallenge(c.id)}
                  >
                    <span className={styles.rosterClientName}>
                      <strong>{c.title}</strong>
                      <small>
                        {KIND_LABEL[c.kind]} · {c.participantCount} joined
                      </small>
                    </span>
                  </button>
                </li>
              ))}
              {challenges.length === 0 ? (
                <li className={styles.compactEmpty}>
                  No challenges yet — launch one to start engaging clients.
                </li>
              ) : null}
            </ul>
          </section>

          <section className={styles.clientDetail}>
            {selected ? (
              <>
                <header className={styles.clientProfileHeader}>
                  <div className={styles.profileIdentity}>
                    <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>
                      <Icon name="trophy" size={20} />
                    </span>
                    <div>
                      <div className={styles.profileTitleRow}>
                        <h3>{selected.title}</h3>
                        <span className={styles.activePill}>
                          {selected.active ? 'Active' : 'Closed'}
                        </span>
                      </div>
                      <p>
                        {fmtDate(selected.startAt)} – {fmtDate(selected.endAt)} ·
                        Target {selected.targetValue} ({KIND_LABEL[selected.kind]})
                      </p>
                    </div>
                  </div>
                  {selected.active ? (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={saving === 'close'}
                      onClick={() => closeChallenge(selected.id)}
                    >
                      Close challenge
                    </button>
                  ) : null}
                </header>

                {selected.description ? (
                  <p className={styles.hint}>{selected.description}</p>
                ) : null}

                <div className={styles.clientMetricGrid}>
                  <article>
                    <span>
                      <Icon name="clients" size={17} />
                    </span>
                    <div>
                      <small>Participants</small>
                      <strong>{selected.participantCount}</strong>
                    </div>
                  </article>
                  <article>
                    <span>
                      <Icon name="trend" size={17} />
                    </span>
                    <div>
                      <small>Target</small>
                      <strong>{selected.targetValue}</strong>
                    </div>
                  </article>
                </div>

                <section className={styles.assignmentCatalog}>
                  <header>
                    <div>
                      <h3>Leaderboard</h3>
                      <p>Top participants ranked by progress.</p>
                    </div>
                  </header>
                  {leaderboard.length === 0 ? (
                    <p className={styles.hint}>
                      No one has joined this challenge yet.
                    </p>
                  ) : (
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Client</th>
                          <th>Progress</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row) => (
                          <tr key={row.userId}>
                            <td>{row.rank}</td>
                            <td>{row.displayName ?? 'Member'}</td>
                            <td>
                              {row.progressValue} / {selected.targetValue}
                            </td>
                            <td>
                              {row.completedAt ? (
                                <span className={styles.activePill}>Done</span>
                              ) : (
                                <span className={styles.neutralPill}>
                                  In progress
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </>
            ) : (
              <p className={styles.hint}>
                Select or launch a challenge to see its leaderboard.
              </p>
            )}
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
