'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type Consultation = {
  id: string;
  topic: string;
  status: string;
  scheduledAt: string;
  amountInr: number;
  meetingUrl?: string | null;
  client: { displayName?: string | null };
  payment?: { status: string } | null;
};

export default function ConsultsPage() {
  const { session, api, ready } = useCoach();
  const router = useRouter();
  const [consults, setConsults] = useState<Consultation[]>([]);
  const pendingCount = consults.filter((item) => item.status === 'REQUESTED').length;
  const scheduledCount = consults.filter((item) => item.status === 'SCHEDULED').length;
  const paidCount = consults.filter((item) => item.payment?.status === 'PAID').length;

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    api<Consultation[]>('/consultations')
      .then(setConsults)
      .catch(() => setConsults([]));
  }, [ready, session, api, router]);

  async function setStatus(id: string, status: string) {
    await api(`/consultations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setConsults(await api<Consultation[]>('/consultations'));
  }

  async function joinMeeting(id: string) {
    const meeting = await api<{
      meetingUrl?: string;
      agora?: { meetingUrl?: string; channel?: string; mode?: string };
    }>(`/consultations/${id}/meeting`);
    const url = meeting.meetingUrl ?? meeting.agora?.meetingUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <CoachShell>
      {!ready || !session ? (
        <p className={styles.hint}>Loading…</p>
      ) : (
        <div className={styles.featurePage}>
          <section className={styles.scheduleStats}>
            <article><span><Icon name="calendar" size={18} /></span><div><small>Scheduled</small><strong>{scheduledCount}</strong></div></article>
            <article><span><Icon name="clock" size={18} /></span><div><small>Requests</small><strong>{pendingCount}</strong></div></article>
            <article><span><Icon name="check" size={18} /></span><div><small>Payments cleared</small><strong>{paidCount}</strong></div></article>
            <article><span><Icon name="trend" size={18} /></span><div><small>Booked value</small><strong>₹{consults.reduce((sum, item) => sum + item.amountInr, 0).toLocaleString('en-IN')}</strong></div></article>
          </section>
          <div className={styles.scheduleWorkspace}>
            <section className={styles.scheduleBoard}>
              <header className={styles.boardHeader}>
                <div>
                  <div><h3>This week</h3><span>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span></div>
                </div>
                <span className={styles.activePill}>Agenda</span>
              </header>
              <div className={styles.agendaList}>
                {consults.map((consult, index) => {
                  const date = new Date(consult.scheduledAt);
                  const clientName = consult.client.displayName || 'Client';
                  return (
                    <article className={styles.agendaItem} key={consult.id}>
                      <div className={styles.agendaDate}>
                        <strong>{date.toLocaleDateString('en-IN', { day: '2-digit' })}</strong>
                        <span>{date.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                      </div>
                      <span className={`${styles.agendaAccent} ${styles[`agendaAccent_${index % 3}`]}`} />
                      <div className={styles.agendaTime}>
                        <strong>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                        <span>45 min</span>
                      </div>
                      <span className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}>
                        {clientName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <div className={styles.agendaDetails}>
                        <strong>{consult.topic}</strong>
                        <span>{clientName} · ₹{consult.amountInr.toLocaleString('en-IN')}</span>
                      </div>
                      <span className={`${styles.consultStatus} ${styles[`consultStatus_${consult.status.toLowerCase()}`]}`}>
                        {consult.status.toLowerCase()}
                      </span>
                      <div className={styles.agendaActions}>
                        {consult.status === 'REQUESTED' ? <button type="button" onClick={() => setStatus(consult.id, 'SCHEDULED')}>Confirm</button> : null}
                        {consult.status === 'SCHEDULED' || consult.status === 'REQUESTED' ? <button className={styles.joinButton} type="button" onClick={() => joinMeeting(consult.id)}>Join</button> : null}
                        {consult.status === 'SCHEDULED' ? <button type="button" onClick={() => setStatus(consult.id, 'COMPLETED')}>Complete</button> : null}
                        {consult.status !== 'CANCELLED' && consult.status !== 'COMPLETED' ? <button type="button" onClick={() => setStatus(consult.id, 'CANCELLED')}>Cancel</button> : null}
                      </div>
                    </article>
                  );
                })}
                {consults.length === 0 ? <div className={styles.detailEmpty}><Icon name="calendar" size={27} /><h3>No consultations yet</h3><p>New consultation requests will appear here.</p></div> : null}
              </div>
            </section>
            <aside className={styles.scheduleRail}>
              <section>
                <div className={styles.railTitle}><h3>Pending requests</h3><span>{pendingCount}</span></div>
                {consults.filter((item) => item.status === 'REQUESTED').slice(0, 3).map((item) => (
                  <article className={styles.requestCard} key={item.id}>
                    <div><strong>{item.client.displayName || 'Client'}</strong><span>{item.topic}</span></div>
                    <time>{new Date(item.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time>
                    <button type="button" onClick={() => setStatus(item.id, 'SCHEDULED')}>Accept request</button>
                  </article>
                ))}
                {pendingCount === 0 ? <p className={styles.railEmpty}>No requests waiting.</p> : null}
              </section>
              <section className={styles.availabilityCard}>
                <span><Icon name="clock" size={19} /></span>
                <div><h4>Availability</h4><p>Synced from your connected calendar.</p></div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </CoachShell>
  );
}
