'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type Insight = {
  id: string;
  title: string;
  body: string;
  category?: string;
  severity?: string;
  user?: { id?: string; displayName?: string | null; email?: string | null };
};

type ClientRow = {
  client: { id: string; displayName?: string | null; email?: string | null };
};

const CATEGORIES = ['all', 'cricket', 'injury_risk', 'predictive', 'recovery', 'nutrition', 'training', 'metabolic', 'blood', 'female_health', 'healthspan'] as const;

export default function AiReviewPage() {
  const { session, api, apiBase, ready } = useCoach();
  const router = useRouter();
  const [pendingAi, setPendingAi] = useState<Insight[]>([]);
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>('all');
  const [outcomeKind, setOutcomeKind] = useState('INJURY_REPORTED');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [outcomeClientId, setOutcomeClientId] = useState('');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    Promise.all([
      api<Insight[]>('/ai/insights/pending').catch(() => []),
      api<ClientRow[]>('/coach/clients').catch(() => []),
    ]).then(([insights, clientRows]) => {
      setPendingAi(insights);
      setClients(clientRows);
      setOutcomeClientId((current) => current || clientRows[0]?.client.id || '');
    });
  }, [ready, session, api, router]);

  const filtered = useMemo(() => {
    if (filter === 'all') return pendingAi;
    return pendingAi.filter((i) => (i.category || '') === filter);
  }, [pendingAi, filter]);

  async function review(id: string, status: 'APPROVED' | 'REJECTED', editedBody?: string) {
    setReviewing(id);
    try {
      await fetch(`${apiBase}/ai/insights/${id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session!.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, editedBody }),
      });
      setPendingAi((rows) => rows.filter((r) => r.id !== id));
    } finally {
      setReviewing(null);
    }
  }

  async function submitOutcome() {
    if (!outcomeClientId) return;
    await fetch(`${apiBase}/intelligence/outcomes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session!.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: outcomeClientId,
        kind: outcomeKind,
        note: outcomeNote || undefined,
      }),
    });
    setOutcomeNote('');
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function editDraft(insight: Insight) {
    const editedBody = window.prompt('Edit this coaching insight before approval:', insight.body);
    if (editedBody && editedBody.trim() && editedBody !== insight.body) {
      void review(insight.id, 'APPROVED', editedBody.trim());
    }
  }

  return (
    <CoachShell>
      {!ready || !session ? (
        <p className={styles.hint}>Loading…</p>
      ) : (
        <div className={styles.featurePage}>
          <section className={styles.insightStats}>
            <article><span><Icon name="sparkles" size={18} /></span><div><small>Awaiting review</small><strong>{pendingAi.length}</strong></div></article>
            <article><span><Icon name="warning" size={18} /></span><div><small>High priority</small><strong>{pendingAi.filter((item) => item.severity === 'high').length}</strong></div></article>
            <article><span><Icon name="clients" size={18} /></span><div><small>Clients covered</small><strong>{new Set(pendingAi.map((item) => item.user?.id).filter(Boolean)).size}</strong></div></article>
          </section>
          <div className={styles.insightWorkspace}>
            <section className={styles.insightReviewPanel}>
              <header className={styles.reviewHeader}>
                <div><h3>Review queue</h3><p>Nothing reaches a client until you approve it.</p></div>
                <span>{filtered.length} drafts</span>
              </header>
              <div className={styles.categoryFilters}>
                {CATEGORIES.map((category) => (
                  <button key={category} type="button" className={filter === category ? styles.filterChipActive : ''} onClick={() => setFilter(category)}>
                    {category.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
              <p className={styles.hint}>Female health insights appear only when the client has explicitly enabled coach sharing.</p>
              <div className={styles.insightList}>
                {filtered.map((insight) => {
                  const clientName = insight.user?.displayName || insight.user?.email || 'Client';
                  return (
                    <article className={styles.insightCard} key={insight.id}>
                      <div className={styles.insightCardTop}>
                        <span className={`${styles.insightTypeIcon} ${insight.severity === 'high' ? styles.signalCritical : styles.signalNeutral}`}>
                          <Icon name={insight.category === 'injury_risk' ? 'warning' : 'sparkles'} size={18} />
                        </span>
                        <div>
                          <div className={styles.insightMeta}>
                            <span>{(insight.category || 'general').replaceAll('_', ' ')}</span>
                            <i />
                            <span>{clientName}</span>
                          </div>
                          <h4>{insight.title}</h4>
                        </div>
                        <span className={insight.severity === 'high' ? styles.urgentPill : styles.neutralPill}>{insight.severity || 'review'}</span>
                      </div>
                      <div className={styles.insightBody}>
                        <p>{insight.body}</p>
                        <div className={styles.safetyNote}><Icon name="warning" size={14} /><span>Wellness guidance only. Review against client context before sending.</span></div>
                      </div>
                      <footer className={styles.insightActions}>
                        <button type="button" className={styles.rejectButton} onClick={() => review(insight.id, 'REJECTED')} disabled={reviewing === insight.id}>Dismiss</button>
                        <button type="button" className={styles.editButton} onClick={() => editDraft(insight)}>Edit and approve</button>
                        <button type="button" className={styles.approveButton} onClick={() => review(insight.id, 'APPROVED')} disabled={reviewing === insight.id}>
                          <Icon name="check" size={16} /> {reviewing === insight.id ? 'Saving…' : 'Approve insight'}
                        </button>
                      </footer>
                    </article>
                  );
                })}
                {filtered.length === 0 ? <div className={styles.detailEmpty}><Icon name="check" size={27} /><h3>Queue cleared</h3><p>No draft insights match this filter.</p></div> : null}
              </div>
            </section>
            <aside className={styles.outcomePanel}>
              <header><span><Icon name="activity" size={18} /></span><div><h3>Record an outcome</h3><p>Improve future recommendations with real-world feedback.</p></div></header>
              <div className={styles.outcomeForm}>
                <label>Client
                  <select value={outcomeClientId} onChange={(event) => setOutcomeClientId(event.target.value)}>
                    <option value="">Select client</option>
                    {clients.map((item) => <option key={item.client.id} value={item.client.id}>{item.client.displayName || item.client.email || item.client.id}</option>)}
                  </select>
                </label>
                <label>Outcome type
                  <select value={outcomeKind} onChange={(event) => setOutcomeKind(event.target.value)}>
                    <option value="INJURY_REPORTED">Injury reported</option>
                    <option value="ILLNESS">Illness</option>
                    <option value="MISSED_SESSION">Missed session</option>
                    <option value="SORENESS">Soreness</option>
                  </select>
                </label>
                <label>Coach note
                  <textarea value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} placeholder="Add useful context for this outcome…" rows={5} />
                </label>
                <button type="button" className={styles.primaryButton} onClick={submitOutcome} disabled={!outcomeClientId}>
                  <Icon name={saved ? 'check' : 'plus'} size={16} /> {saved ? 'Outcome saved' : 'Save outcome'}
                </button>
              </div>
              <div className={styles.privacyNote}><Icon name="settings" size={15} /><p><strong>Private coaching data</strong><span>Outcomes support model evaluation and are never presented as diagnosis.</span></p></div>
            </aside>
          </div>
        </div>
      )}
    </CoachShell>
  );
}
