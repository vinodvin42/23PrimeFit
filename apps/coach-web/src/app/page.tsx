'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../components/coach-shell';
import { Icon } from '../components/icons';
import { useCoach } from '../lib/coach-context';
import styles from './page.module.css';

export default function LoginPage() {
  const { session, setSession, apiBase, ready } = useCoach();
  const router = useRouter();
  const [email, setEmail] = useState('demo@23primefit.dev');
  const [password, setPassword] = useState('primefit');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace('/dashboard');
  }, [ready, session, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { coachSignIn } = await import('../lib/auth');
      const { token: bearer } = await coachSignIn(email, password);
      const meRes = await fetch(`${apiBase}/users/me`, {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      if (!meRes.ok) throw new Error(`API ${meRes.status}`);
      const me = await meRes.json();
      setSession({
        token: bearer,
        coachId: me.id,
        displayName: me.displayName || me.name || undefined,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CoachShell>
      <div className={styles.loginSplit}>
        <section className={styles.loginShowcase}>
          <p className={styles.loginShowcaseEyebrow}>Performance coaching, connected</p>
          <h1 className={styles.loginShowcaseTitle}>
            Coach every athlete <span>with complete context.</span>
          </h1>
          <p className={styles.loginShowcaseCopy}>
            Training, nutrition, recovery, and client communication in one focused operating system.
          </p>

          <div className={styles.loginSignalCard}>
            <div className={styles.loginSignalHeader}>
              <div>
                <span>Today&apos;s coaching pulse</span>
                <strong>12 athletes on track</strong>
              </div>
              <span className={styles.loginLiveBadge}><i /> Live</span>
            </div>
            <div className={styles.loginSignalGrid}>
              <article>
                <span className={styles.loginSignalIcon}><Icon name="activity" size={18} /></span>
                <div><strong>87%</strong><small>Program adherence</small></div>
                <em>+6.2%</em>
              </article>
              <article>
                <span className={styles.loginSignalIcon}><Icon name="heart" size={18} /></span>
                <div><strong>8.4</strong><small>Average recovery</small></div>
                <em>Optimal</em>
              </article>
              <article>
                <span className={styles.loginSignalIcon}><Icon name="message" size={18} /></span>
                <div><strong>4</strong><small>Need attention</small></div>
                <em>Review</em>
              </article>
            </div>
            <div className={styles.loginSignalFooter}>
              <span>AM</span>
              <div><strong>Arjun Mehta</strong><small>Strength block · Week 6</small></div>
              <span className={styles.loginStatus}>Progressing</span>
            </div>
          </div>

          <ul className={styles.loginTrustList}>
            <li><Icon name="check" size={14} /> Role-based access</li>
            <li><Icon name="check" size={14} /> Secure health data</li>
            <li><Icon name="check" size={14} /> Human-reviewed AI</li>
          </ul>
        </section>

        <section className={styles.loginPanel}>
          <div className={styles.loginPanelTop}>
            <span className={styles.loginLock}><Icon name="check" size={16} /></span>
            <span>Coach workspace</span>
          </div>
          <div className={styles.loginPanelHeading}>
            <h2>Welcome back</h2>
            <p>Sign in to review your athletes and coaching priorities.</p>
          </div>
          <form className={styles.loginForm} onSubmit={onSubmit}>
            <label className={styles.loginField}>
              <span>Work email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
                placeholder="coach@yourstudio.com"
              />
            </label>
            <label className={styles.loginField}>
              <span>Password <small>Secure access</small></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
            </label>
            {error ? <p className={styles.loginError} role="alert"><Icon name="warning" size={16} />{error}</p> : null}
            <button className={styles.loginSubmit} disabled={loading} type="submit">
              <span>{loading ? 'Signing you in…' : 'Sign in to workspace'}</span>
              {!loading ? <Icon name="arrow" size={18} /> : <i aria-hidden />}
            </button>
          </form>
          <div className={styles.loginPanelFooter}>
            <Icon name="check" size={14} />
            <span>Protected by encrypted authentication</span>
          </div>
        </section>
      </div>
    </CoachShell>
  );
}
