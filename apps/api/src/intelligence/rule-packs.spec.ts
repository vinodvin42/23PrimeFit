import {
  computeLoads,
  runCricketRules,
  runInjuryRules,
  runPredictiveRules,
} from './rule-packs';
import type { DailyFeatures } from './feature-builder.service';

function baseFeatures(over: Partial<DailyFeatures> = {}): DailyFeatures {
  return {
    dateKey: '2026-07-22',
    userId: 'u1',
    goals: ['CRICKET_PERFORMANCE'],
    lifestyleDisorders: [],
    recovery7: [
      {
        dateKey: '2026-07-20',
        sleepHours: 5,
        stressScore: 75,
        hrvMs: 40,
        trainingLoad: 90,
        steps: 8000,
        restingHr: 60,
      },
      {
        dateKey: '2026-07-21',
        sleepHours: 5.5,
        stressScore: 72,
        hrvMs: 38,
        trainingLoad: 95,
        steps: 7000,
        restingHr: 62,
      },
      {
        dateKey: '2026-07-22',
        sleepHours: 6,
        stressScore: 70,
        hrvMs: 36,
        trainingLoad: 100,
        steps: 9000,
        restingHr: 61,
      },
    ],
    recovery28: [
      ...Array.from({ length: 21 }).map((_, i) => ({
        dateKey: `2026-07-${String(i + 1).padStart(2, '0')}`,
        sleepHours: 7.5,
        trainingLoad: 25,
        hrvMs: 65,
        stressScore: 25,
      })),
      {
        dateKey: '2026-07-20',
        sleepHours: 5,
        trainingLoad: 90,
        hrvMs: 40,
        stressScore: 75,
      },
      {
        dateKey: '2026-07-21',
        sleepHours: 5.5,
        trainingLoad: 95,
        hrvMs: 38,
        stressScore: 72,
      },
      {
        dateKey: '2026-07-22',
        sleepHours: 6,
        trainingLoad: 100,
        hrvMs: 36,
        stressScore: 70,
      },
    ],
    sessions7: [
      { dateKey: '2026-07-20', status: 'COMPLETED', rpe: 9, durationMin: 90 },
      { dateKey: '2026-07-21', status: 'COMPLETED', rpe: 9, durationMin: 90 },
      { dateKey: '2026-07-22', status: 'COMPLETED', rpe: 8, durationMin: 75 },
    ],
    cricket7: [
      {
        dateKey: '2026-07-20',
        kind: 'NETS',
        overs: 12,
        durationMin: 90,
        rpe: 8,
      },
      {
        dateKey: '2026-07-21',
        kind: 'MATCH',
        overs: 10,
        durationMin: 120,
        rpe: 9,
      },
      {
        dateKey: '2026-07-22',
        kind: 'MATCH',
        overs: 8,
        durationMin: 100,
        rpe: 8,
      },
    ],
    cricket28: [
      ...Array.from({ length: 10 }).map((_, i) => ({
        dateKey: `2026-06-${String(i + 15).padStart(2, '0')}`,
        kind: 'NETS',
        overs: 1,
        durationMin: 45,
        rpe: 4,
      })),
      {
        dateKey: '2026-07-20',
        kind: 'NETS',
        overs: 12,
        durationMin: 90,
        rpe: 8,
      },
      {
        dateKey: '2026-07-21',
        kind: 'MATCH',
        overs: 10,
        durationMin: 120,
        rpe: 9,
      },
      {
        dateKey: '2026-07-22',
        kind: 'MATCH',
        overs: 8,
        durationMin: 100,
        rpe: 8,
      },
    ],
    cricketRole: 'BOWLER',
    nutrition7: [],
    plannedSessions3d: 1,
    missedSessions7: 1,
    featureHash: 'abc',
    ...over,
  };
}

describe('Phase 7 rule packs', () => {
  it('flags elevated ACWR injury stress', () => {
    const f = baseFeatures();
    const { acwr } = computeLoads(f);
    expect(acwr).toBeGreaterThan(1.0);
    const signals = runInjuryRules(f);
    const injury = signals.find((s) => s.type === 'INJURY_RISK');
    expect(injury).toBeDefined();
    expect(['MOD', 'HIGH']).toContain(injury!.band);
    expect(injury!.explain.disclaimer).toMatch(/not a medical/i);
  });

  it('detects cricket bowl load spike', () => {
    const signals = runCricketRules(baseFeatures());
    expect(signals.some((s) => s.type.startsWith('CRICKET_'))).toBe(true);
  });

  it('emits predictive snapshots with model hooks', () => {
    const { predictions, signals } = runPredictiveRules(baseFeatures());
    expect(predictions.some((p) => p.horizonHours === 24)).toBe(true);
    expect(predictions.some((p) => p.horizonHours === 72)).toBe(true);
    expect(predictions.some((p) => p.horizonHours === 168)).toBe(true);
    expect(signals.some((s) => s.insight?.category === 'predictive')).toBe(
      true,
    );
  });
});
