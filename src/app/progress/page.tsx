import { supabase } from '@/lib/supabaseClient';
import { getHomeGymWithGrades } from '@/lib/api';
import ProgressVisxClient from './ProgressVisxClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Outcome = 'start' | 'crux' | 'almost' | 'sent';

type AttemptRow = {
  problem_id: string;
  outcome: Outcome;
  created_at: string;
};

type ProblemRow = {
  id: string;
  grade: string | null;
  status: 'project' | 'sent';
  created_at: string;
  gym_id: string | null;
  grade_id: string | null;
};

const GRADE_ORDER = [
  '4', '4+',
  '5', '5+',
  '5a', '5a+',
  '5b', '5b+',
  '5c', '5c+',
  '6a', '6a+',
  '6b', '6b+',
  '6c', '6c+',
  '7a', '7a+',
];

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function dayKey(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function weekKey(iso: string) {
  // ISO-ish week bucket: use Monday as start
  const d = new Date(iso);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diffToMon = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMon);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`; // week starting Monday
}

function extractGradeToken(grade: string | null): string | null {
  if (!grade) return null;
  const lower = grade.toLowerCase();
  for (const token of GRADE_ORDER) {
    if (lower.includes(token)) return token;
  }
  return null;
}

function gradeRankFallback(grade: string | null): number | null {
  const token = extractGradeToken(grade);
  if (!token) return null;
  const idx = GRADE_ORDER.indexOf(token);
  return idx === -1 ? null : idx;
}

export type ProgressPayload = {
  header: {
    totalAttempts: number;
    totalProblems: number;
    homeGymName?: string | null;
  };

  conversion14d: {
    attempts: number;
    sends: number;
    rate: number; // 0..1
    zone: 'cruising' | 'growth' | 'limit' | 'overreaching';
  };

  conversionWeekly: Array<{
    week: string; // YYYY-MM-DD (Mon)
    attempts: number;
    sends: number;
    rate: number;
  }>;

  attemptsToSendBuckets: {
    flash: number; // 1-2
    learn: number; // 3-6
    project: number; // 7+
    totalSends: number;
  };

  gradeStep: Array<{
    day: string; // YYYY-MM-DD
    maxRankSoFar: number; // step value
  }>;

  hardest: {
    label: string | null;
    color: string | null;
  };

  heatmap28d: Array<{
    day: string; // YYYY-MM-DD
    attempts: number;
    sends: number;
  }>;
};

export default async function ProgressPage() {
  const { data: problemsData, error: problemsError } = await supabase
    .from('problems')
    .select('id, grade, status, created_at, gym_id, grade_id')
    .order('created_at', { ascending: true });

  if (problemsError) {
    console.error(problemsError);
    return (
      <main className="min-h-screen bg-bg text-fg p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Probleme.</p>
      </main>
    );
  }

  const problems = (problemsData ?? []) as ProblemRow[];

  const { data: attemptsData, error: attemptsError } = await supabase
    .from('attempts')
    .select('problem_id, outcome, created_at')
    .order('created_at', { ascending: true });

  if (attemptsError) {
    console.error(attemptsError);
    return (
      <main className="min-h-screen bg-bg text-fg p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Versuche.</p>
      </main>
    );
  }

  const attempts = (attemptsData ?? []) as AttemptRow[];

  const { gym: homeGym, grades: homeGrades } = await getHomeGymWithGrades();

  // --- group attempts by problem ---
  const attemptsByProblem: Record<string, AttemptRow[]> = {};
  for (const a of attempts) (attemptsByProblem[a.problem_id] ??= []).push(a);

  // --- 14d conversion ---
  const since14 = daysAgoISO(14);
  const attempts14 = attempts.filter((a) => a.created_at >= since14);
  const sends14 = attempts14.filter((a) => a.outcome === 'sent');
  const conv14Rate = attempts14.length > 0 ? sends14.length / attempts14.length : 0;

  const zone: ProgressPayload['conversion14d']['zone'] =
    conv14Rate >= 0.25 ? 'cruising'
      : conv14Rate >= 0.12 ? 'growth'
      : conv14Rate >= 0.05 ? 'limit'
      : 'overreaching';

  // --- weekly conversion (last ~8w) ---
  const since56 = daysAgoISO(56);
  const attempts56 = attempts.filter((a) => a.created_at >= since56);
  const byWeek: Record<string, { attempts: number; sends: number }> = {};
  for (const a of attempts56) {
    const wk = weekKey(a.created_at);
    const slot = (byWeek[wk] ??= { attempts: 0, sends: 0 });
    slot.attempts += 1;
    if (a.outcome === 'sent') slot.sends += 1;
  }
  const conversionWeekly = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      week,
      attempts: v.attempts,
      sends: v.sends,
      rate: v.attempts > 0 ? v.sends / v.attempts : 0,
    }));

  // --- send records & attempts-to-send buckets ---
  let flash = 0, learn = 0, project = 0, totalSends = 0;

  // --- hardest grade + grade step ---
  type RankedSend = { day: string; rank: number; label: string; color: string | null };
  const rankedSends: RankedSend[] = [];

  for (const p of problems) {
    const list = attemptsByProblem[p.id] ?? [];
    if (list.length === 0) continue;

    const firstSent = list.find((x) => x.outcome === 'sent');
    if (!firstSent) continue;

    totalSends += 1;

    const attemptsUntilSent = list.filter((x) => x.created_at <= firstSent.created_at).length;
    if (attemptsUntilSent <= 2) flash += 1;
    else if (attemptsUntilSent <= 6) learn += 1;
    else project += 1;

    // rank: prefer home gym grade order if possible
    let rank: number | null = null;
    let label: string = p.grade ?? '—';
    let color: string | null = null;

    if (homeGym && p.gym_id === homeGym.id && p.grade_id) {
      const idx = homeGrades.findIndex((g) => g.id === p.grade_id);
      if (idx !== -1) {
        rank = idx;
        label = homeGrades[idx].name;
        color = homeGrades[idx].color ?? null;
      }
    }

    if (rank === null) {
      const fb = gradeRankFallback(p.grade);
      if (fb !== null) rank = fb;
    }

    if (rank !== null) {
      rankedSends.push({
        day: dayKey(firstSent.created_at),
        rank,
        label,
        color,
      });
    }
  }

  rankedSends.sort((a, b) => a.day.localeCompare(b.day));

  let hardestLabel: string | null = null;
  let hardestColor: string | null = null;
  if (rankedSends.length > 0) {
    const hardest = rankedSends.reduce((best, cur) => (cur.rank > best.rank ? cur : best), rankedSends[0]);
    hardestLabel = hardest.label;
    hardestColor = hardest.color;
  }

  // grade step series: max rank so far per day
  const gradeStep: ProgressPayload['gradeStep'] = [];
  let maxSoFar = -1;

  // build days present in rankedSends in order
  for (const rs of rankedSends) {
    if (rs.rank > maxSoFar) maxSoFar = rs.rank;
    gradeStep.push({ day: rs.day, maxRankSoFar: maxSoFar });
  }

  // --- heatmap 28d ---
  const since28 = daysAgoISO(28);
  const attempts28 = attempts.filter((a) => a.created_at >= since28);

  const heat: Record<string, { attempts: number; sends: number }> = {};
  for (const a of attempts28) {
    const d = dayKey(a.created_at);
    const slot = (heat[d] ??= { attempts: 0, sends: 0 });
    slot.attempts += 1;
    if (a.outcome === 'sent') slot.sends += 1;
  }

  // ensure all last 28 days exist (even 0)
  const heatmap28d: ProgressPayload['heatmap28d'] = [];
  {
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${dd}`;
      const v = heat[key] ?? { attempts: 0, sends: 0 };
      heatmap28d.push({ day: key, attempts: v.attempts, sends: v.sends });
    }
  }

  const payload: ProgressPayload = {
    header: {
      totalAttempts: attempts.length,
      totalProblems: problems.length,
      homeGymName: homeGym?.name ?? null,
    },
    conversion14d: {
      attempts: attempts14.length,
      sends: sends14.length,
      rate: conv14Rate,
      zone,
    },
    conversionWeekly,
    attemptsToSendBuckets: { flash, learn, project, totalSends },
    gradeStep,
    hardest: { label: hardestLabel, color: hardestColor },
    heatmap28d,
  };

  return <ProgressVisxClient data={payload} />;
}
