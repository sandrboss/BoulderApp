import { supabase } from '@/lib/supabaseClient';
import { getHomeGymWithGrades } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Outcome = 'crux' | 'almost' | 'sent';

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

// Fallback ordering for FB-like grades (only used if grade_id is missing)
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

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold text-slate-900">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

type SendRecord = {
  problemId: string;
  grade: string | null;
  gymId: string | null;
  gradeId: string | null;
  firstSentAt: string;
  attemptsToSend: number;
};

type SendWithRank = SendRecord & {
  rank: number;
  displayGrade: string;
  displayColor?: string | null;
};

export default async function ProgressPage() {
  // Load problems
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

  // Load attempts
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

  // Home gym grades for proper ordering + color labels
  const { gym: homeGym, grades: homeGrades } = await getHomeGymWithGrades();

  // Group attempts by problem
  const attemptsByProblem: Record<string, AttemptRow[]> = {};
  for (const att of attempts) {
    (attemptsByProblem[att.problem_id] ??= []).push(att);
  }

  // Build send records (first sent + attempts to first send)
  const sendRecords: SendRecord[] = [];
  let totalAttemptToSend = 0;
  let problemsWithSend = 0;

  for (const problem of problems) {
    const list = attemptsByProblem[problem.id] ?? [];
    if (list.length === 0) continue;

    const firstSent = list.find((a) => a.outcome === 'sent');
    if (!firstSent) continue;

    problemsWithSend += 1;

    const attemptsUntilSent = list.filter(
      (a) => a.created_at <= firstSent.created_at
    ).length;

    totalAttemptToSend += attemptsUntilSent;

    sendRecords.push({
      problemId: problem.id,
      grade: problem.grade,
      gymId: problem.gym_id,
      gradeId: problem.grade_id,
      firstSentAt: firstSent.created_at,
      attemptsToSend: attemptsUntilSent,
    });
  }

  const avgAttemptsPerSend =
    problemsWithSend > 0 ? totalAttemptToSend / problemsWithSend : null;

  // Worked problems (% of created problems that have >=1 attempt)
  const workedProblemIds = new Set(attempts.map((a) => a.problem_id));
  const workedProblems = workedProblemIds.size;
  const totalProblems = problems.length;
  const workedPct = totalProblems > 0 ? (workedProblems / totalProblems) * 100 : null;

  // Recent window stats (last 14 days)
  const since14 = daysAgoISO(14);
  const recentAttempts = attempts.filter((a) => a.created_at >= since14);
  const recentSends = recentAttempts.filter((a) => a.outcome === 'sent').length;
  const recentAttemptsCount = recentAttempts.length;

  // Convert sends to ranked sends (home gym aware)
  const sentWithRank = sendRecords
    .map((rec) => {
      let rank: number | null = null;
      let displayGrade = rec.grade ?? 'Unbekannt';
      let displayColor: string | null | undefined = null;

      // Preferred: use home gym grade ordering for items from the home gym
      if (
        homeGym &&
        rec.gymId === homeGym.id &&
        rec.gradeId &&
        homeGrades.length > 0
      ) {
        const idx = homeGrades.findIndex((g) => g.id === rec.gradeId);
        if (idx !== -1) {
          rank = idx;
          displayGrade = homeGrades[idx].name;
          displayColor = homeGrades[idx].color ?? null;
        }
      }

      // Fallback
      if (rank === null) {
        const fbRank = gradeRankFallback(rec.grade ?? null);
        if (fbRank !== null) {
          rank = fbRank;
          displayGrade = rec.grade ?? displayGrade;
        }
      }

      if (rank === null) return null;

      return {
        ...rec,
        rank,
        displayGrade,
        displayColor,
      };
    })
    .filter(Boolean) as SendWithRank[];

  sentWithRank.sort((a, b) => a.firstSentAt.localeCompare(b.firstSentAt));

  // Timeline milestones (new hardest)
  const timeline: Array<{
    date: string;
    grade: string;
    attemptsToSend: number;
    isNewHardest: boolean;
    color?: string | null;
  }> = [];

  let hardestSoFar = -1;
  let hardestGrade: string | null = null;
  let hardestColor: string | null | undefined = null;

  for (const rec of sentWithRank) {
    const date = rec.firstSentAt.slice(0, 10);
    const isNewHardest = rec.rank > hardestSoFar;

    if (isNewHardest) {
      hardestSoFar = rec.rank;
      hardestGrade = rec.displayGrade;
      hardestColor = rec.displayColor ?? null;
    }

    timeline.push({
      date,
      grade: rec.displayGrade,
      attemptsToSend: rec.attemptsToSend,
      isNewHardest,
      color: rec.displayColor ?? null,
    });
  }

  // “Coach recommendation” (MVP heuristic)
  const recos: Array<{ title: string; body: string }> = [];

  if (recentAttemptsCount === 0) {
    recos.push({
      title: 'No recent data',
      body: 'Log 1–2 attempts this week to unlock meaningful trends.',
    });
  } else {
    // If you attempt a lot but send little -> focus on projecting tactics
    const sendRate = recentAttemptsCount > 0 ? recentSends / recentAttemptsCount : 0;

    if (sendRate < 0.08 && recentAttemptsCount >= 15) {
      recos.push({
        title: 'Projection week',
        body: 'You’re putting in work but sends are low. Pick 1–2 projects and repeat quality attempts (rest 2–3 min) instead of spreading tries across many problems.',
      });
    } else if (sendRate >= 0.15 && recentSends >= 3) {
      recos.push({
        title: 'Flow is high',
        body: 'Nice — you’re converting attempts into sends. Consider trying 1 “just above comfort” grade to nudge your ceiling.',
      });
    } else if (recentAttemptsCount < 10) {
      recos.push({
        title: 'Low volume',
        body: 'You’re climbing a bit less recently. Even one extra short session can boost consistency without overloading.',
      });
    } else {
      recos.push({
        title: 'Balanced progress',
        body: 'Steady effort. Keep your mix: a few warm-up sends + 1–2 harder projects.',
      });
    }

    if (workedPct !== null && workedPct < 55 && totalProblems >= 6) {
      recos.push({
        title: 'Too many “untried” projects',
        body: `Only ${workedProblems} of ${totalProblems} projects have attempts. Either prune old projects or commit to trying each at least once.`,
      });
    }
  }

  // --- MVP Render ---
  return (
    <main className="min-h-screen app-pattern text-fg p-4">
      <div className="max-w-sm mx-auto px-3 space-y-4 pb-24">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Progress</h1>
          <p className="text-sm text-fg0">
            Your trends & milestones — History stays in “Previous Sessions”.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>{attempts.length} attempts</Pill>
            <Pill>{problems.length} projects</Pill>
            {homeGym && <Pill>Home: {homeGym.name}</Pill>}
          </div>
        </header>

        {/* Coach recommendation */}
        <Card title="Coach Recommendation" right={<Pill>Last 14 days</Pill>}>
          <div className="space-y-2">
            {recos.slice(0, 2).map((r, idx) => (
              <div key={idx} className="rounded-xl bg-black/5 px-3 py-2">
                <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                <div className="mt-0.5 text-xs text-slate-700">{r.body}</div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Pill>{recentSends} sends</Pill>
              <Pill>{recentAttemptsCount} attempts</Pill>
            </div>
          </div>
        </Card>

        {/* Top 5 MVP stats */}
        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Hardest grade
            </div>
            <div className="mt-2 flex items-center gap-2">
              {hardestColor && (
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: hardestColor }}
                />
              )}
              <div className="text-lg font-semibold text-slate-900">
                {hardestGrade ?? '—'}
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Based on first sends.
            </div>
          </section>

          <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Avg attempts / send
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {avgAttemptsPerSend === null ? '—' : avgAttemptsPerSend.toFixed(1)}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              First-time send efficiency.
            </div>
          </section>

          <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Projects worked
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {workedPct === null ? '—' : `${workedPct.toFixed(0)}%`}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {workedProblems}/{totalProblems} have attempts.
            </div>
          </section>

          <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Sends (14d)
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {recentSends}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Quick momentum check.
            </div>
          </section>
        </div>

        {/* Milestones / grade curve */}
        <Card
          title="Milestones"
          right={
            hardestGrade ? (
              <Pill>Current: {hardestGrade.toUpperCase()}</Pill>
            ) : (
              <Pill>No sends yet</Pill>
            )
          }
        >
          {timeline.length === 0 ? (
            <div className="text-sm text-slate-700">
              Once you log your first <span className="font-semibold">Top</span>, you’ll see
              grade milestones here (using your home-gym grade order when available).
            </div>
          ) : (
            <div className="mt-1 space-y-2">
              {timeline
                .filter((t) => t.isNewHardest)
                .slice(-8)
                .reverse()
                .map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 rounded-xl bg-black/5 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
                        {t.color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-black/10"
                            style={{ backgroundColor: t.color }}
                          />
                        )}
                        {t.grade}
                      </div>
                      <div className="text-xs text-slate-700">
                        {t.date} · first send after {t.attemptsToSend} attempts
                      </div>
                    </div>
                    <Pill>New</Pill>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Optional: small “raw timeline” for debugging / MVP */}
        <Card title="Recent first sends" right={<Pill>Latest</Pill>}>
          {sentWithRank.length === 0 ? (
            <div className="text-sm text-slate-700">No sends yet.</div>
          ) : (
            <div className="space-y-2">
              {sentWithRank.slice(-5).reverse().map((r) => (
                <div
                  key={r.problemId + r.firstSentAt}
                  className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2"
                >
                  <div className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
                    {r.displayColor && (
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/10"
                        style={{ backgroundColor: r.displayColor }}
                      />
                    )}
                    {r.displayGrade}
                  </div>
                  <div className="text-xs text-slate-700">
                    {r.firstSentAt.slice(0, 10)} · {r.attemptsToSend} tries
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
