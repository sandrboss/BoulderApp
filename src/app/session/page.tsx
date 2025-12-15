import { supabase } from '@/lib/supabaseClient';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Energy = 'low' | 'normal' | 'high';

type SessionRow = {
  id: string;
  date: string;
  energy: Energy;
};

type AttemptRow = {
  session_id: string;
  problem_id: string;
  outcome: 'crux' | 'almost' | 'sent';
};

type ProblemRow = {
  id: string;
  grade: string | null;
  gym_id: string | null;
  grade_id: string | null;
};

type GymGradeRow = {
  id: string;
  gym_id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  created_at: string;
};

// Fallback ordering for free-text grades (only used if grade_id is missing)
const GRADE_ORDER = [
  '4', '4+', '5', '5+',
  '5a', '5a+', '5b', '5b+', '5c', '5c+',
  '6a', '6a+', '6b', '6b+', '6c', '6c+',
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

const ENERGY_LABEL: Record<Energy, string> = {
  low: 'Low energy',
  normal: 'Normal energy',
  high: 'High energy',
};

const ENERGY_EMOJI: Record<Energy, string> = {
  low: '😵',
  normal: '🙂',
  high: '🚀',
};

function classifySession(totalAttempts: number, sends: number): { label: string; hint: string } {
  // Coach-y but short.
  if (sends >= 3 && totalAttempts > 0 && totalAttempts / sends <= 3) {
    return { label: 'Flow day', hint: 'Many sends with low effort.' };
  }
  if (sends >= 1 && totalAttempts >= 15) {
    return { label: 'Progress day', hint: 'Lots of work / projecting.' };
  }
  if (totalAttempts >= 25) {
    return { label: 'Volume day', hint: 'Conditioning + mileage.' };
  }
  if (totalAttempts === 0) {
    return { label: 'Warm-up', hint: 'Light session / no logged attempts.' };
  }
  return { label: 'Solid session', hint: 'Balanced session.' };
}

function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold text-slate-900">
      {children}
    </span>
  );
}

export default async function SessionHistoryPage() {
  // 1) Sessions
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, date, energy')
    .order('date', { ascending: false });

  if (sessionsError) {
    console.error(sessionsError);
    return (
      <main className="min-h-screen bg-bg text-fg p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Sessions.</p>
      </main>
    );
  }

  const sessions = (sessionsData ?? []) as SessionRow[];

  if (sessions.length === 0) {
    return (
      <main className="min-h-screen app-pattern text-fg p-4">
        <div className="max-w-sm mx-auto px-3 space-y-4 pb-24">
          <h1 className="text-xl font-semibold">Previous Sessions</h1>
          <div className="rounded-2xl border border-border bg-white/70 p-4 text-sm text-fg0 backdrop-blur">
            Noch keine Sessions – starte heute deine erste auf der „Heute“-Seite.
          </div>
        </div>
      </main>
    );
  }

  const sessionIds = sessions.map((s) => s.id);

  // 2) Attempts (all)
  const { data: attemptsData, error: attemptsError } = await supabase
    .from('attempts')
    .select('session_id, problem_id, outcome');

  if (attemptsError) {
    console.error(attemptsError);
    return (
      <main className="min-h-screen bg-bg text-fg p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Versuche.</p>
      </main>
    );
  }

  const attempts = (attemptsData ?? []) as AttemptRow[];

  // 3) Problems
  const { data: problemsData, error: problemsError } = await supabase
    .from('problems')
    .select('id, grade, gym_id, grade_id');

  if (problemsError) {
    console.error(problemsError);
    return (
      <main className="min-h-screen bg-bg text-fg p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Boulder-Probleme.</p>
      </main>
    );
  }

  const problems = (problemsData ?? []) as ProblemRow[];
  const problemsById = new Map<string, ProblemRow>();
  for (const p of problems) problemsById.set(p.id, p);

  // 4) Gym grades for custom ordering/colors
  const { data: gradesData, error: gradesError } = await supabase
    .from('gym_grades')
    .select('id, gym_id, name, color, sort_order, created_at')
    .order('gym_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (gradesError) {
    console.error(gradesError);
    return (
      <main className="min-h-screen bg-bg text-fg p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Gym-Grades.</p>
      </main>
    );
  }

  const gymGrades = (gradesData ?? []) as GymGradeRow[];

  const gradeMetaById = new Map<
    string,
    { name: string; color: string | null; index: number; gym_id: string }
  >();

  const indexCounters: Record<string, number> = {};
  for (const g of gymGrades) {
    if (!indexCounters[g.gym_id]) indexCounters[g.gym_id] = 0;
    const idx = indexCounters[g.gym_id]++;
    gradeMetaById.set(g.id, {
      name: g.name,
      color: g.color,
      index: idx,
      gym_id: g.gym_id,
    });
  }

  // 5) Group attempts by session (only those sessions)
  const attemptsBySession: Record<string, AttemptRow[]> = {};
  for (const a of attempts) {
    if (!sessionIds.includes(a.session_id)) continue;
    (attemptsBySession[a.session_id] ??= []).push(a);
  }

  // 6) View model per session
  const cards = sessions.map((session) => {
    const sessAttempts = attemptsBySession[session.id] ?? [];
    const totalAttempts = sessAttempts.length;
    const sends = sessAttempts.filter((a) => a.outcome === 'sent');
    const sendsCount = sends.length;

    const projectIds = new Set(sessAttempts.map((a) => a.problem_id));
    const projectsTouched = projectIds.size;

    // Hardest send (prefer custom grade)
    let hardestGrade: string | null = null;
    let hardestColor: string | null = null;
    let hardestRank = -1;

    for (const send of sends) {
      const problem = problemsById.get(send.problem_id);
      if (!problem) continue;

      let rank: number | null = null;
      let label: string | null = null;
      let color: string | null = null;

      if (problem.grade_id && gradeMetaById.has(problem.grade_id)) {
        const meta = gradeMetaById.get(problem.grade_id)!;
        rank = meta.index;
        label = meta.name;
        color = meta.color ?? null;
      } else if (problem.grade) {
        const fbRank = gradeRankFallback(problem.grade);
        if (fbRank !== null) {
          rank = fbRank;
          label = problem.grade;
        } else {
          label = problem.grade;
        }
      }

      if (rank !== null && rank > hardestRank) {
        hardestRank = rank;
        hardestGrade = label ?? null;
        hardestColor = color ?? null;
      } else if (hardestRank === -1 && label && !hardestGrade) {
        hardestGrade = label;
        hardestColor = color ?? null;
      }
    }

    const coach = classifySession(totalAttempts, sendsCount);

    return {
      session,
      totalAttempts,
      sendsCount,
      projectsTouched,
      hardestGrade,
      hardestColor,
      coach,
    };
  });

  return (
    <main className="min-h-screen app-pattern text-fg p-4">
      <div className="max-w-sm mx-auto px-3 pb-24 space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Previous Sessions</h1>
          <p className="text-sm text-fg0">
            History (MVP): what happened each day — your trends live in Stats.
          </p>
        </header>

        <div className="space-y-3">
          {cards.map(({ session, totalAttempts, sendsCount, projectsTouched, hardestGrade, hardestColor, coach }) => (
            <div
              key={session.id}
              className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-slate-900">
                    {session.date}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {ENERGY_EMOJI[session.energy]} {ENERGY_LABEL[session.energy]}
                  </div>
                </div>

                <StatPill>{coach.label}</StatPill>
              </div>

              {/* Middle stats */}
              <div className="mt-3 flex flex-wrap gap-2">
                <StatPill>{sendsCount} sends</StatPill>
                <StatPill>{totalAttempts} attempts</StatPill>
                <StatPill>{projectsTouched} projects</StatPill>
              </div>

              {/* Hardest */}
              <div className="mt-3 rounded-xl bg-black/5 px-3 py-2 text-sm text-slate-900">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Hardest send
                </div>
                <div className="mt-1 inline-flex items-center gap-2 font-semibold">
                  {hardestGrade ? (
                    <>
                      {hardestColor && (
                        <span
                          className="h-3 w-3 rounded-full border border-black/15"
                          style={{ backgroundColor: hardestColor }}
                        />
                      )}
                      {hardestGrade}
                    </>
                  ) : (
                    <span className="text-slate-600">–</span>
                  )}
                </div>
              </div>

              {/* Coach hint */}
              <div className="mt-2 text-xs text-slate-600">
                {coach.hint}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
