'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon, type IconName } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type ClientRow = {
  id: string;
  client: { id: string; displayName?: string | null; email?: string | null };
};

type ClientOverview = {
  client: { id: string; displayName?: string | null; email?: string | null };
  workoutProgram?: { title: string } | null;
  mealPlan?: { title: string } | null;
  recovery?: { sleepHours?: number; steps?: number; source?: string } | null;
  progressPhotos?: Array<{ id: string; takenAt: string }>;
};

type Consultation = {
  id: string;
  topic: string;
  status: string;
  scheduledAt: string;
  client: { displayName?: string | null };
};

type Insight = {
  id: string;
  title: string;
  severity?: string;
  category?: string;
  user?: { displayName?: string | null; email?: string | null };
};

function nameOf(client?: {
  displayName?: string | null;
  email?: string | null;
  id?: string;
}) {
  return client?.displayName || client?.email?.split('@')[0] || 'Client';
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: IconName;
  tone?: 'neutral' | 'positive' | 'warning';
}) {
  return (
    <article className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[`statIcon_${tone}`]}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className={styles.statCopy}>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={tone === 'positive' ? styles.positiveText : ''}>{detail}</small>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { session, api, ready } = useCoach();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [overviews, setOverviews] = useState<ClientOverview[]>([]);
  const [consults, setConsults] = useState<Consultation[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const coachFirstName = session?.displayName?.trim().split(/\s+/)[0] || 'Coach';
  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [clientRows, scheduled, pending] = await Promise.all([
          api<ClientRow[]>('/coach/clients'),
          api<Consultation[]>('/consultations').catch(() => []),
          api<Insight[]>('/ai/insights/pending').catch(() => []),
        ]);
        const details = await Promise.all(
          clientRows.slice(0, 24).map((row) =>
            api<ClientOverview>(`/coach/clients/${row.client.id}`).catch(() => ({
              client: row.client,
            })),
          ),
        );
        if (!cancelled) {
          setClients(clientRows);
          setOverviews(details);
          setConsults(scheduled);
          setInsights(pending);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Dashboard unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, ready, router, session]);

  const metrics = useMemo(() => {
    const withProgram = overviews.filter((item) => item.workoutProgram).length;
    const withRecovery = overviews.filter((item) => item.recovery).length;
    const attention = overviews.filter(
      (item) =>
        !item.workoutProgram ||
        (item.recovery?.sleepHours != null && item.recovery.sleepHours < 6.5),
    );
    const sleepValues = overviews
      .map((item) => item.recovery?.sleepHours)
      .filter((value): value is number => typeof value === 'number');
    const averageSleep =
      sleepValues.length > 0
        ? (sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length).toFixed(1)
        : '—';
    return {
      withProgram,
      withRecovery,
      attention,
      averageSleep,
      programRate: overviews.length ? Math.round((withProgram / overviews.length) * 100) : 0,
      recoveryRate: overviews.length ? Math.round((withRecovery / overviews.length) * 100) : 0,
    };
  }, [overviews]);

  const todayConsults = consults.filter(
    (consult) => new Date(consult.scheduledAt).toDateString() === new Date().toDateString(),
  );

  if (!ready || !session) {
    return (
      <CoachShell>
        <div className={styles.pageLoader}>Preparing your workspace…</div>
      </CoachShell>
    );
  }

  return (
    <CoachShell>
      <div className={styles.dashboardPage}>
        <section className={styles.welcomeRow}>
          <div>
            <p className={styles.pageEyebrow}>{todayLabel}</p>
            <h2>Good morning, {coachFirstName}.</h2>
            <p>
              Here is what needs your attention across the roster today.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} href="/consults">
              <Icon name="calendar" size={17} />
              View schedule
            </Link>
            <Link className={styles.primaryButton} href="/chat">
              <Icon name="message" size={17} />
              Message clients
            </Link>
          </div>
        </section>

        {error ? (
          <div className={styles.inlineError}>
            <Icon name="warning" size={18} />
            Some live data could not be loaded. {error}
          </div>
        ) : null}

        <section className={styles.statGrid} aria-label="Roster summary">
          <StatCard
            label="Active clients"
            value={loading ? '—' : clients.length}
            detail={`${metrics.withProgram} with active programs`}
            icon="clients"
            tone="positive"
          />
          <StatCard
            label="Needs attention"
            value={loading ? '—' : metrics.attention.length + insights.length}
            detail={`${insights.length} AI reviews pending`}
            icon="warning"
            tone="warning"
          />
          <StatCard
            label="Today’s sessions"
            value={loading ? '—' : todayConsults.length}
            detail={`${consults.filter((item) => item.status === 'REQUESTED').length} awaiting confirmation`}
            icon="calendar"
          />
          <StatCard
            label="Average sleep"
            value={loading ? '—' : `${metrics.averageSleep}${metrics.averageSleep !== '—' ? 'h' : ''}`}
            detail={`${metrics.withRecovery} clients synced`}
            icon="moon"
          />
        </section>

        <div className={styles.dashboardGrid}>
          <section className={`${styles.panel} ${styles.attentionPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitleRow}>
                  <h3>Priority queue</h3>
                  <span className={styles.countBadge}>
                    {metrics.attention.length + insights.length}
                  </span>
                </div>
                <p>High-signal actions, ordered by urgency</p>
              </div>
              <Link href="/clients" className={styles.textLink}>
                View roster <Icon name="arrow" size={15} />
              </Link>
            </div>
            <div className={styles.queueList}>
              {loading ? (
                <div className={styles.skeletonRows}>
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              {!loading &&
                insights.slice(0, 2).map((insight, index) => {
                  const clientName = nameOf(insight.user);
                  return (
                    <article className={styles.queueItem} key={insight.id}>
                      <div className={`${styles.queueSignal} ${styles.signalCritical}`}>
                        <Icon name="sparkles" size={18} />
                      </div>
                      <div className={styles.queueBody}>
                        <div className={styles.queueMeta}>
                          <span className={styles.urgentPill}>{index === 0 ? 'Review now' : 'AI draft'}</span>
                          <span>{insight.category?.replaceAll('_', ' ') || 'coaching insight'}</span>
                        </div>
                        <h4>{insight.title}</h4>
                        <p>{clientName} · Coach approval required before delivery</p>
                      </div>
                      <Link href="/ai" className={styles.queueAction}>
                        Review <Icon name="chevron" size={15} />
                      </Link>
                    </article>
                  );
                })}
              {!loading &&
                metrics.attention.slice(0, 3).map((item) => {
                  const clientName = nameOf(item.client);
                  const lowSleep =
                    item.recovery?.sleepHours != null && item.recovery.sleepHours < 6.5;
                  return (
                    <article className={styles.queueItem} key={item.client.id}>
                      <div className={`${styles.queueSignal} ${lowSleep ? styles.signalWarning : styles.signalNeutral}`}>
                        <Icon name={lowSleep ? 'moon' : 'dumbbell'} size={18} />
                      </div>
                      <div className={styles.queueBody}>
                        <div className={styles.queueMeta}>
                          <span className={lowSleep ? styles.warningPill : styles.neutralPill}>
                            {lowSleep ? 'Recovery' : 'Setup'}
                          </span>
                          <span>{lowSleep ? 'Wearable signal' : 'Program gap'}</span>
                        </div>
                        <h4>
                          {lowSleep
                            ? `Sleep dropped to ${item.recovery?.sleepHours} hours`
                            : 'No active training program'}
                        </h4>
                        <p>{clientName} · Recommended follow-up today</p>
                      </div>
                      <Link href="/clients" className={styles.queueAction}>
                        Open <Icon name="chevron" size={15} />
                      </Link>
                    </article>
                  );
                })}
              {!loading && metrics.attention.length === 0 && insights.length === 0 ? (
                <div className={styles.emptyState}>
                  <span><Icon name="check" /></span>
                  <h4>You’re all caught up</h4>
                  <p>No high-priority roster actions right now.</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.schedulePanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Today’s schedule</h3>
                <p>{todayConsults.length} coaching sessions</p>
              </div>
              <Link href="/consults" className={styles.iconButton} aria-label="Open schedule">
                <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className={styles.timeline}>
              {(todayConsults.length ? todayConsults : consults.slice(0, 3)).map((consult, index) => {
                const date = new Date(consult.scheduledAt);
                return (
                  <article className={styles.timelineItem} key={consult.id}>
                    <time>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <span className={`${styles.timelineDot} ${index === 0 ? styles.timelineDotActive : ''}`} />
                    <div>
                      <strong>{consult.topic}</strong>
                      <span>{nameOf(consult.client)} · 45 min</span>
                    </div>
                  </article>
                );
              })}
              {!loading && consults.length === 0 ? (
                <div className={styles.emptySchedule}>
                  <Icon name="calendar" size={24} />
                  <strong>No sessions scheduled</strong>
                  <span>Your calendar is clear for today.</span>
                </div>
              ) : null}
            </div>
            <Link href="/consults" className={styles.fullWidthButton}>
              Open calendar
            </Link>
          </section>

          <section className={`${styles.panel} ${styles.rosterPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Roster pulse</h3>
                <p>Coverage across active coaching plans</p>
              </div>
              <span className={styles.activePill}>Current roster</span>
            </div>
            <div className={styles.pulseLayout}>
              <div className={styles.pulseChart}>
                <div className={styles.donut} style={{ '--progress': `${metrics.programRate * 3.6}deg` } as React.CSSProperties}>
                  <div>
                    <strong>{metrics.programRate}%</strong>
                    <span>Programmed</span>
                  </div>
                </div>
              </div>
              <div className={styles.pulseMetrics}>
                <div>
                  <span><i className={styles.limeDot} /> Training plans</span>
                  <strong>{metrics.programRate}%</strong>
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${metrics.programRate}%` }} />
                  </div>
                </div>
                <div>
                  <span><i className={styles.blueDot} /> Recovery synced</span>
                  <strong>{metrics.recoveryRate}%</strong>
                  <div className={`${styles.progressTrack} ${styles.progressBlue}`}>
                    <span style={{ width: `${metrics.recoveryRate}%` }} />
                  </div>
                </div>
                <div>
                  <span><i className={styles.grayDot} /> Nutrition assigned</span>
                  <strong>
                    {overviews.length
                      ? Math.round(
                          (overviews.filter((item) => item.mealPlan).length / overviews.length) * 100,
                        )
                      : 0}
                    %
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.clientSnapshotPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Client snapshot</h3>
                <p>Recently active clients</p>
              </div>
              <Link href="/clients" className={styles.textLink}>
                All clients <Icon name="arrow" size={15} />
              </Link>
            </div>
            <div className={styles.snapshotList}>
              {overviews.slice(0, 4).map((item, index) => {
                const clientName = nameOf(item.client);
                return (
                  <Link href="/clients" className={styles.snapshotRow} key={item.client.id}>
                    <span className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}>
                      {initials(clientName)}
                    </span>
                    <div>
                      <strong>{clientName}</strong>
                      <span>{item.workoutProgram?.title || 'Program not assigned'}</span>
                    </div>
                    <div className={styles.snapshotMetric}>
                      <strong>{item.recovery?.sleepHours ?? '—'}{item.recovery?.sleepHours ? 'h' : ''}</strong>
                      <span>sleep</span>
                    </div>
                    <Icon name="chevron" size={16} />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
