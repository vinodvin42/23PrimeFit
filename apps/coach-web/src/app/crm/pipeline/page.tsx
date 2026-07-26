'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../../components/coach-shell';
import { CrmSubnav } from '../../../components/crm-subnav';
import { Icon } from '../../../components/icons';
import { useCoach } from '../../../lib/coach-context';
import {
  CRM_STAGES,
  type Lead,
  leadInitials,
  stageLabel,
} from '../../../lib/crm';
import styles from '../../page.module.css';

export default function CrmPipelinePage() {
  const { api, ready, session } = useCoach();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [showComposer, setShowComposer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stage = new URLSearchParams(window.location.search).get('stage');
    if (stage && CRM_STAGES.includes(stage as (typeof CRM_STAGES)[number])) {
      setStageFilter(stage);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        setLeads(await api<Lead[]>('/crm/leads'));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [ready, session, api, router]);

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

  async function addLead(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
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
      setNotice(`Lead “${created.name}” added.`);
      setLeads(await api<Lead[]>('/crm/leads'));
      router.push(`/crm/leads/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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
            <h2>Pipeline</h2>
            <p>
              {leads.length} prospect{leads.length === 1 ? '' : 's'} · open a
              card to manage notes, invoices, and enrollment
            </p>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setShowComposer((v) => !v)}
          >
            <Icon name="plus" size={16} />
            {showComposer ? 'Close' : 'Add lead'}
          </button>
        </header>

        {showComposer ? (
          <form className={styles.crmComposer} onSubmit={addLead}>
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Prospect name"
                required
              />
            </label>
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </label>
            <label className={styles.label}>
              Phone
              <input
                className={styles.input}
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+91…"
              />
            </label>
            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add to pipeline'}
            </button>
          </form>
        ) : null}

        <div className={styles.crmToolbar}>
          <label className={styles.rosterSearch}>
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads"
            />
          </label>
          <div className={styles.rosterFilters}>
            <button
              type="button"
              className={stageFilter === 'all' ? styles.filterChipActive : undefined}
              onClick={() => setStageFilter('all')}
            >
              All
            </button>
            {CRM_STAGES.map((stage) => (
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
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <span>
              <Icon name="clients" size={22} />
            </span>
            <h4>No matching leads</h4>
            <p>Try another stage filter or add a new prospect.</p>
          </div>
        ) : (
          <div className={styles.crmPipelineGrid}>
            {filtered.map((lead, index) => (
              <Link
                key={lead.id}
                href={`/crm/leads/${lead.id}`}
                className={styles.crmLeadCard}
              >
                <span
                  className={`${styles.clientAvatar} ${styles[`avatar_${index % 4}`]}`}
                >
                  {leadInitials(lead.name)}
                </span>
                <div className={styles.crmLeadCardBody}>
                  <strong>{lead.name}</strong>
                  <small>
                    {lead.email || 'No email'}
                    {lead.phone ? ` · ${lead.phone}` : ''}
                  </small>
                  <span className={styles.activePill}>
                    {stageLabel(lead.stage)}
                  </span>
                </div>
                <Icon name="chevron" size={18} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </CoachShell>
  );
}
