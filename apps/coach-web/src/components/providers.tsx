'use client';

import { CoachProvider } from '../lib/coach-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <CoachProvider>{children}</CoachProvider>;
}
