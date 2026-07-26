import type { DailyFeatures } from './feature-builder.service';

export type RuleSignal = {
  type: string;
  score: number;
  band: 'LOW' | 'MOD' | 'HIGH';
  explain: Record<string, unknown>;
  insight?: { category: string; title: string; body: string; severity: string };
};

export type RulePrediction = {
  horizonHours: number;
  metric: string;
  predictedValue: number;
  confidence: 'LOW' | 'MED' | 'HIGH';
  drivers: Record<string, unknown>;
};

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

/** Acute:chronic workload ratio from training load + session RPE×min + cricket overs. */
export function computeLoads(f: DailyFeatures) {
  const acuteWearable = sum(f.recovery7.map((r) => r.trainingLoad ?? 0));
  const chronicWearable = avg(f.recovery28.map((r) => r.trainingLoad ?? 0)) * 7;

  const acuteSession = sum(
    f.sessions7.map((s) => (s.rpe ?? 5) * (s.durationMin ?? 45) * 0.1),
  );
  // Sessions history is 7d-only today — assume chronic ~55% of a hot week.
  const chronicSession = Math.max(acuteSession * 0.55, 1);

  const acuteBowl = sum(f.cricket7.map((c) => (c.overs ?? 0) * 10));
  const chronicBowl = avg(f.cricket28.map((c) => (c.overs ?? 0) * 10)) * 7;

  const acute = acuteWearable + acuteSession + acuteBowl;
  const chronic = Math.max(1, chronicWearable + chronicSession + chronicBowl);
  const acwr = acute / chronic;

  return { acute, chronic, acwr, acuteBowl, chronicBowl };
}

export function runInjuryRules(f: DailyFeatures): RuleSignal[] {
  const { acute, chronic, acwr } = computeLoads(f);
  const sleepLowDays = f.recovery7.filter(
    (r) => (r.sleepHours ?? 8) < 6,
  ).length;
  const hrvVals = f.recovery28
    .map((r) => r.hrvMs)
    .filter((v): v is number => v != null);
  const hrv7 = f.recovery7
    .map((r) => r.hrvMs)
    .filter((v): v is number => v != null);
  const hrvBaseline = avg(hrvVals);
  const hrvNow = avg(hrv7);
  const hrvDrop = hrvBaseline > 0 ? (hrvBaseline - hrvNow) / hrvBaseline : 0;
  const stressHigh = f.recovery7.filter(
    (r) => (r.stressScore ?? 0) >= 70,
  ).length;

  let score = Math.min(100, Math.max(0, (acwr - 0.8) * 80));
  const drivers: string[] = [];
  if (acwr > 1.5) {
    score = Math.max(score, 78);
    drivers.push(`ACWR ${acwr.toFixed(2)} (elevated training stress)`);
  } else if (acwr > 1.3) {
    score = Math.max(score, 58);
    drivers.push(`ACWR ${acwr.toFixed(2)} (moderate spike)`);
  } else {
    drivers.push(`ACWR ${acwr.toFixed(2)} within typical range`);
  }
  if (sleepLowDays >= 2) {
    score = Math.min(100, score + 12);
    drivers.push(`${sleepLowDays} nights under 6h sleep`);
  }
  if (hrvDrop > 0.2) {
    score = Math.min(100, score + 10);
    drivers.push(`HRV down ${(hrvDrop * 100).toFixed(0)}% vs 14–28d baseline`);
  }
  if (stressHigh >= 2) {
    score = Math.min(100, score + 8);
    drivers.push(`${stressHigh} high-stress days`);
  }

  const band: RuleSignal['band'] =
    score >= 70 ? 'HIGH' : score >= 45 ? 'MOD' : 'LOW';

  const insight =
    band === 'LOW'
      ? undefined
      : {
          category: 'injury_risk',
          title:
            band === 'HIGH'
              ? 'Elevated training stress'
              : 'Moderate training stress',
          body: `Training load stress indicator (not a medical diagnosis). Drivers: ${drivers.join('; ')}. Discuss recovery and volume with your coach.`,
          severity: band === 'HIGH' ? 'alert' : 'info',
        };

  return [
    {
      type: 'INJURY_RISK',
      score,
      band,
      explain: {
        disclaimer:
          'Training load stress indicator — not a medical injury diagnosis.',
        acwr: Number(acwr.toFixed(3)),
        acute: Number(acute.toFixed(1)),
        chronic: Number(chronic.toFixed(1)),
        drivers,
      },
      insight,
    },
    {
      type: 'READINESS',
      score: Math.max(0, 100 - score * 0.7),
      band: score >= 70 ? 'LOW' : score >= 45 ? 'MOD' : 'HIGH',
      explain: {
        note: 'Inverse of training-stress band for Recover tab readiness.',
        sleepAvg: Number(
          avg(f.recovery7.map((r) => r.sleepHours ?? 7)).toFixed(2),
        ),
      },
    },
  ];
}

export function runCricketRules(f: DailyFeatures): RuleSignal[] {
  if (
    !f.goals.includes('CRICKET_PERFORMANCE') &&
    !f.cricketRole &&
    f.cricket28.length === 0
  ) {
    return [];
  }

  const overs7 = sum(f.cricket7.map((c) => c.overs ?? 0));
  const overs28Avg =
    avg(
      (() => {
        const byDay = new Map<string, number>();
        for (const c of f.cricket28) {
          byDay.set(c.dateKey, (byDay.get(c.dateKey) ?? 0) + (c.overs ?? 0));
        }
        return [...byDay.values()];
      })(),
    ) || 0.01;
  const chronicWeekly = overs28Avg * 7;
  const ratio = chronicWeekly > 0 ? overs7 / chronicWeekly : 0;

  const signals: RuleSignal[] = [];
  let bowlScore = Math.min(100, ratio * 55);
  let bowlBand: RuleSignal['band'] = 'LOW';
  const drivers: string[] = [`7d overs ${overs7.toFixed(1)}`];

  if (ratio > 1.3) {
    bowlBand = 'HIGH';
    bowlScore = Math.max(bowlScore, 75);
    drivers.push('Bowling load > 1.3× 28d average');
    signals.push({
      type: 'CRICKET_BOWL_LOAD',
      score: bowlScore,
      band: bowlBand,
      explain: { overs7, chronicWeekly, ratio, drivers },
      insight: {
        category: 'cricket',
        title: 'Bowling load spike',
        body: `Your last 7 days bowling (${overs7.toFixed(1)} overs) is elevated vs recent average. Consider volume management with your coach — wellness guidance only.`,
        severity: 'alert',
      },
    });
  } else {
    signals.push({
      type: 'CRICKET_BOWL_LOAD',
      score: bowlScore,
      band: ratio > 1.0 ? 'MOD' : 'LOW',
      explain: { overs7, chronicWeekly, ratio, drivers },
    });
  }

  const matchDays = new Set(
    f.cricket7.filter((c) => c.kind === 'MATCH').map((c) => c.dateKey),
  );
  if (matchDays.size >= 2) {
    const sorted = [...matchDays].sort();
    const congested =
      sorted.length >= 2 &&
      (new Date(sorted[sorted.length - 1]).getTime() -
        new Date(sorted[0]).getTime()) /
        86400000 <=
        3;
    if (congested || matchDays.size >= 2) {
      signals.push({
        type: 'CRICKET_MATCH_CONGESTION',
        score: 60,
        band: 'MOD',
        explain: { matchDays: [...matchDays] },
        insight: {
          category: 'cricket',
          title: 'Match congestion',
          body: 'Multiple match sessions in a short window. Prioritize sleep and soft-tissue recovery. Not a medical assessment.',
          severity: 'info',
        },
      });
    }
  }

  const isBowler =
    f.cricketRole === 'BOWLER' || f.cricketRole === 'ALL_ROUNDER';
  const bowlLogs14 = f.cricket28.filter(
    (c) => (c.overs ?? 0) > 0 && c.dateKey >= f.dateKey,
  );
  // approximate last 14d
  const from14 = f.cricket28.filter((c) => {
    const age =
      (new Date(f.dateKey).getTime() - new Date(c.dateKey).getTime()) /
      86400000;
    return age <= 14 && (c.overs ?? 0) > 0;
  });
  if (isBowler && from14.length === 0 && f.sessions7.length > 0) {
    signals.push({
      type: 'CRICKET_ROLE_GAP',
      score: 40,
      band: 'MOD',
      explain: { role: f.cricketRole, gymSessions: f.sessions7.length },
      insight: {
        category: 'cricket',
        title: 'Bowling practice gap',
        body: 'Gym work without recent bowling logs. Add nets volume before match intensity if that fits your plan.',
        severity: 'info',
      },
    });
  }

  if (
    matchDays.has(f.dateKey) &&
    chronicWeekly > 0 &&
    overs7 < chronicWeekly * 0.5
  ) {
    signals.push({
      type: 'CRICKET_UNDER_BOWL',
      score: 35,
      band: 'MOD',
      explain: { overs7, chronicWeekly },
      insight: {
        category: 'cricket',
        title: 'Match-day under-bowl taper',
        body: 'Match day with low recent bowling volume vs chronic load — skill sharpness note for coach discussion, not injury risk.',
        severity: 'info',
      },
    });
  }

  void bowlLogs14;
  return signals;
}

export function runPredictiveRules(f: DailyFeatures): {
  signals: RuleSignal[];
  predictions: RulePrediction[];
} {
  const { acwr } = computeLoads(f);
  const sleepAvg = avg(f.recovery7.map((r) => r.sleepHours ?? 7));
  const sleepDebt = Math.max(0, 7.5 - sleepAvg);
  const yesterdayLoad = f.recovery7.at(-1)?.trainingLoad ?? acwr * 40;
  const readiness24 = Math.max(
    20,
    Math.min(
      95,
      82 - sleepDebt * 8 - Math.max(0, acwr - 1) * 25 - yesterdayLoad * 0.05,
    ),
  );

  const overreach72 = Math.max(
    5,
    Math.min(95, (acwr - 0.9) * 70 + sleepDebt * 6),
  );

  const deficitDays = f.nutrition7.filter(
    (n) => n.target != null && n.calories < n.target * 0.75,
  ).length;
  const fatigue7 = Math.max(
    5,
    Math.min(
      95,
      f.missedSessions7 * 12 +
        deficitDays * 8 +
        avg(f.recovery7.map((r) => r.stressScore ?? 40)) * 0.4,
    ),
  );

  const predictions: RulePrediction[] = [
    {
      horizonHours: 24,
      metric: 'READINESS',
      predictedValue: Number(readiness24.toFixed(1)),
      confidence: sleepAvg > 0 ? 'HIGH' : 'MED',
      drivers: {
        sleepAvg,
        sleepDebt,
        acwr,
        plannedSessions3d: f.plannedSessions3d,
      },
    },
    {
      horizonHours: 72,
      metric: 'OVERREACH_RISK',
      predictedValue: Number(overreach72.toFixed(1)),
      confidence: 'MED',
      drivers: { acwr, sleepDebt },
    },
    {
      horizonHours: 168,
      metric: 'FATIGUE_ADHERENCE',
      predictedValue: Number(fatigue7.toFixed(1)),
      confidence: 'LOW',
      drivers: {
        missedSessions7: f.missedSessions7,
        deficitDays,
        stressAvg: avg(f.recovery7.map((r) => r.stressScore ?? 40)),
      },
    },
  ];

  const signals: RuleSignal[] = [
    {
      type: 'PRED_READINESS_24H',
      score: readiness24,
      band: readiness24 >= 70 ? 'HIGH' : readiness24 >= 45 ? 'MOD' : 'LOW',
      explain: predictions[0].drivers,
      insight: {
        category: 'predictive',
        title: '24h readiness outlook',
        body: `Rules-based readiness forecast ~${readiness24.toFixed(0)}/100 for the next day (sleep debt + load). Guidance only — not a medical prediction.`,
        severity: 'info',
      },
    },
  ];

  if (overreach72 >= 55) {
    signals.push({
      type: 'PRED_OVERREACH_72H',
      score: overreach72,
      band: overreach72 >= 70 ? 'HIGH' : 'MOD',
      explain: predictions[1].drivers,
      insight: {
        category: 'predictive',
        title: '72h overreach watch',
        body: `Rising load trajectory suggests elevated fatigue risk over ~3 days. Consider dialing volume with your coach.`,
        severity: overreach72 >= 70 ? 'alert' : 'info',
      },
    });
  }

  if (
    f.goals.includes('CRICKET_PERFORMANCE') &&
    f.cricket7.some((c) => c.kind === 'MATCH')
  ) {
    signals.push({
      type: 'PRED_MATCH_FUEL',
      score: 50,
      band: 'MOD',
      explain: { tip: 'carbs_pre_match' },
      insight: {
        category: 'predictive',
        title: 'Pre-match fueling nudge',
        body: 'Match session logged recently or upcoming — prioritize carbs around training. Not a personalized meal plan.',
        severity: 'info',
      },
    });
  }

  return { signals, predictions };
}

export const MODEL_VERSION = 'rules-v1';
