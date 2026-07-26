'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api';

type CoachSession = {
  token: string;
  coachId: string;
  displayName?: string;
};

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

type CoachCtx = {
  apiBase: string;
  /** false until sessionStorage has been read on the client */
  ready: boolean;
  session: CoachSession | null;
  setSession: (s: CoachSession | null) => void;
  activeTenantId: string | null;
  setActiveTenantId: (id: string | null) => void;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  signOut: () => void;
};

const Ctx = createContext<CoachCtx | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  // Always null on first render (SSR + client) to avoid hydration mismatch.
  const [session, setSession] = useState<CoachSession | null>(null);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('pf_coach_token');
    const coachId = sessionStorage.getItem('pf_coach_id');
    const displayName = sessionStorage.getItem('pf_coach_name') ?? undefined;
    const tenantId = sessionStorage.getItem('pf_tenant_id');
    if (token && coachId) {
      setSession({ token, coachId, displayName });
    }
    if (tenantId) setActiveTenantIdState(tenantId);
    setReady(true);
  }, []);

  const persist = useCallback((s: CoachSession | null) => {
    setSession(s);
    if (!s) {
      sessionStorage.removeItem('pf_coach_token');
      sessionStorage.removeItem('pf_coach_id');
      sessionStorage.removeItem('pf_coach_name');
      sessionStorage.removeItem('pf_tenant_id');
      setActiveTenantIdState(null);
      return;
    }
    sessionStorage.setItem('pf_coach_token', s.token);
    sessionStorage.setItem('pf_coach_id', s.coachId);
    if (s.displayName) sessionStorage.setItem('pf_coach_name', s.displayName);
    else sessionStorage.removeItem('pf_coach_name');
  }, []);

  const setActiveTenantId = useCallback((id: string | null) => {
    setActiveTenantIdState(id);
    if (id) sessionStorage.setItem('pf_tenant_id', id);
    else sessionStorage.removeItem('pf_tenant_id');
  }, []);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!session?.token) throw new Error('Not signed in');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };
      if (activeTenantId) headers['X-Tenant-Id'] = activeTenantId;
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
      });
      if (!res.ok) throw new Error(`${path} → ${res.status}`);
      return res.json() as Promise<T>;
    },
    [session?.token, activeTenantId],
  );

  const value = useMemo(
    () => ({
      apiBase: API_BASE,
      ready,
      session,
      setSession: persist,
      activeTenantId,
      setActiveTenantId,
      api,
      signOut: () => persist(null),
    }),
    [ready, session, persist, api, activeTenantId, setActiveTenantId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoach() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCoach outside provider');
  return ctx;
}

export type { TenantSummary };
export { API_BASE };
