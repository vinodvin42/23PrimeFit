'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type ClientRow = {
  client: { id: string; displayName?: string | null; email?: string | null };
};

type Message = {
  id: string;
  body: string;
  sender: {
    id?: string;
    role?: string;
    displayName?: string | null;
  };
};

export default function ChatPage() {
  const { session, api, ready } = useCoach();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [threadSearch, setThreadSearch] = useState('');

  const openThread = useCallback(async (id: string) => {
    setClientId(id);
    const thread = await api<{ id: string }>('/chat/threads', {
      method: 'POST',
      body: JSON.stringify({ clientId: id }),
    });
    setThreadId(thread.id);
    const msgPayload = await api<{ messages: Message[] }>(
      `/chat/threads/${thread.id}/messages`,
    );
    setMessages(msgPayload.messages ?? []);
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      const rows = await api<ClientRow[]>('/coach/clients');
      setClients(rows);
      const requestedId = new URLSearchParams(window.location.search).get('clientId');
      const initial = rows.find((item) => item.client.id === requestedId) ?? rows[0];
      if (initial) await openThread(initial.client.id);
    })();
  }, [ready, session, api, router, openThread]);

  const uniqueClients = useMemo(
    () =>
      Array.from(
        new Map(clients.map((item) => [item.client.id, item])).values(),
      ),
    [clients],
  );
  const visibleClients = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return uniqueClients;
    return uniqueClients.filter((item) =>
      `${item.client.displayName ?? ''} ${item.client.email ?? ''}`.toLowerCase().includes(query),
    );
  }, [threadSearch, uniqueClients]);
  const selectedClient = uniqueClients.find((item) => item.client.id === clientId)?.client;
  const selectedName =
    selectedClient?.displayName || selectedClient?.email?.split('@')[0] || 'Select a client';

  function initials(name: string) {
    return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  async function sendMessage() {
    if (!threadId || !draft.trim()) return;
    const msg = await api<Message>(`/chat/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: draft }),
    });
    setMessages((prev) => [...prev, msg]);
    setDraft('');
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
      <div className={`${styles.featurePage} ${styles.messagesPage}`}>
        <div className={styles.messageWorkspace}>
          <aside className={styles.inboxSidebar}>
            <div className={styles.inboxHeader}>
              <div><h3>Inbox</h3><span>{uniqueClients.length} conversations</span></div>
            </div>
            <label className={styles.rosterSearch}>
              <Icon name="search" size={16} />
              <input
                placeholder="Search conversations"
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
              />
            </label>
            <div className={styles.inboxTabs}>
              <span className={styles.filterChipActive}>All conversations</span>
            </div>
            <div className={styles.threadList}>
              {visibleClients.map((item, index) => {
                const name = item.client.displayName || item.client.email?.split('@')[0] || 'Client';
                return (
                  <button
                    key={item.client.id}
                    type="button"
                    className={`${styles.threadRow} ${clientId === item.client.id ? styles.threadRowActive : ''}`}
                    onClick={() => openThread(item.client.id)}
                  >
                    <span className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}>{initials(name)}</span>
                    <span>
                      <strong>{name}</strong>
                      <small>{clientId === item.client.id ? 'Conversation open' : 'Open conversation'}</small>
                    </span>
                    <time>{index === 0 ? 'Now' : `${index + 1}h`}</time>
                  </button>
                );
              })}
            </div>
          </aside>
          <section className={styles.conversationPanel}>
            <header className={styles.conversationHeader}>
              <div className={styles.profileIdentity}>
                <span className={`${styles.clientAvatar} ${styles.avatar_0}`}>{initials(selectedName)}</span>
                <div><h3>{selectedName}</h3><p><i /> Active coaching client</p></div>
              </div>
              <div className={styles.profileActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => router.push(`/clients?clientId=${encodeURIComponent(clientId ?? '')}`)}
                >
                  View profile
                </button>
              </div>
            </header>
            <div className={styles.messageHistory}>
              <div className={styles.dayDivider}><span>Today</span></div>
              {messages.map((message, index) => {
                const fromCoach =
                  message.sender.id === session.coachId ||
                  message.sender.role?.toUpperCase() === 'COACH' ||
                  (!message.sender.id &&
                    !message.sender.role &&
                    /^coach\b/i.test(message.sender.displayName || ''));
                const senderName = fromCoach
                  ? session.displayName || message.sender.displayName || 'You'
                  : message.sender.displayName || selectedName;
                return (
                  <article
                    className={fromCoach ? styles.messageOutgoing : styles.messageIncoming}
                    key={message.id}
                  >
                    {!fromCoach ? (
                      <span className={`${styles.clientAvatar} ${styles.avatar_0}`}>
                        {initials(senderName)}
                      </span>
                    ) : null}
                    <div>
                      <small>{fromCoach ? 'You' : senderName}</small>
                      <p>{message.body}</p>
                      <time>{index === messages.length - 1 ? 'Just now' : 'Earlier today'}</time>
                    </div>
                  </article>
                );
              })}
              {messages.length === 0 ? (
                <div className={styles.conversationEmpty}>
                  <span><Icon name="message" size={23} /></span>
                  <h4>Start the conversation</h4>
                  <p>Send a check-in, answer a question, or celebrate a win.</p>
                </div>
              ) : null}
            </div>
            <div className={styles.composer}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${selectedName}…`}
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button className={styles.sendButton} type="button" onClick={sendMessage} disabled={!draft.trim()}>
                <Icon name="arrow" size={17} /> Send
              </button>
            </div>
          </section>
          <aside className={styles.contextRail}>
            <div className={styles.contextProfile}>
              <span className={`${styles.profileAvatar} ${styles.avatar_0}`}>{initials(selectedName)}</span>
              <strong>{selectedName}</strong>
              <small>{selectedClient?.email || 'Coaching client'}</small>
            </div>
            <div className={styles.contextSection}>
              <h4>Coaching context</h4>
              <div><span><Icon name="dumbbell" size={15} /> Current program</span><strong>Active plan</strong></div>
              <div><span><Icon name="calendar" size={15} /> Next check-in</span><strong>This week</strong></div>
              <div><span><Icon name="activity" size={15} /> Status</span><strong className={styles.positiveText}>On track</strong></div>
            </div>
            <button
              type="button"
              className={styles.fullWidthButton}
              onClick={() => router.push(`/clients?clientId=${encodeURIComponent(clientId ?? '')}`)}
            >
              View client profile
            </button>
          </aside>
        </div>
      </div>
    </CoachShell>
  );
}
