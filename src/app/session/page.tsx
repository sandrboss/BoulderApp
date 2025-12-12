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

// Fallback FB-style ordering only for problems without custom grade_id
const GRADE_ORDER = [
  '4',
  '4+',
  '5',
  '5+',
  '5a',
  '5a+',
  '5b',
  '5b+',
  '5c',
  '5c+',
  '6a',
  '6a+',
  '6b',
  '6b+',
  '6c',
  '6c+',
  '7a',
  '7a+',
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
  low: 'Niedrige Energie',
  normal: 'Normale Energie',
  high: 'Hohe Energie',
};

const ENERGY_EMOJI: Record<Energy, string> = {
  low: '😵',
  normal: '🙂',
  high: '🚀',
};

function classifySession(totalAttempts: number, sends: number): string {
  if (sends >= 3 && totalAttempts > 0 && totalAttempts / sends <= 3) {
    return 'Send Day (Flow)';
  }
  if (sends >= 1 && totalAttempts >= 15) {
    return 'Work Day (Progress)';
  }
  if (totalAttempts >= 25) {
    return 'Volume Day (Conditioning)';
  }
  if (totalAttempts === 0) {
    return 'Leichte Session / Warm-up';
  }
  return 'Solide Session';
}

export default async function SessionHistoryPage() {
  // 1) Load sessions
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, date, energy')
    .order('date', { ascending: false });

  if (sessionsError) {
    console.error(sessionsError);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Sessions.</p>
      </main>
    );
  }

  const sessions = (sessionsData ?? []) as SessionRow[];

  if (sessions.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
        <div className="max-w-sm mx-auto px-4 space-y-5 pb-28">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">Session-Historie</h1>
            <p className="text-sm text-slate-300">
              Noch keine Sessions – starte heute deine erste auf der
              &quot;Heute&quot;-Seite.
            </p>
          </header>
        </div>
      </main>
    );
  }

  const sessionIds = sessions.map((s) => s.id);

  // 2) Load attempts for all sessions
  const { data: attemptsData, error: attemptsError } = await supabase
    .from('attempts')
    .select('session_id, problem_id, outcome');

  if (attemptsError) {
    console.error(attemptsError);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Versuche.</p>
      </main>
    );
  }

  const attempts = (attemptsData ?? []) as AttemptRow[];

  // 3) Load problems incl. gym + grade ids
  const { data: problemsData, error: problemsError } = await supabase
    .from('problems')
    .select('id, grade, gym_id, grade_id');

  if (problemsError) {
    console.error(problemsError);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Boulder-Probleme.</p>
      </main>
    );
  }

  const problems = (problemsData ?? []) as ProblemRow[];
  const problemsById = new Map<string, ProblemRow>();
  problems.forEach((p) => problemsById.set(p.id, p));

  // 4) Load all custom gym grades to respect user-defined grading
  const { data: gradesData, error: gradesError } = await supabase
    .from('gym_grades')
    .select('id, gym_id, name, color, sort_order, created_at')
    .order('gym_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (gradesError) {
    console.error(gradesError);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Gym-Grades.</p>
      </main>
    );
  }

  const gymGrades = (gradesData ?? []) as GymGradeRow[];

  // Map grade_id -> { name, color, indexInGym }
  const gradeMetaById = new Map<
    string,
    { name: string; color: string | null; index: number; gym_id: string }
  >();

  const indexCounters: Record<string, number> = {};
  for (const g of gymGrades) {
    if (!indexCounters[g.gym_id]) {
      indexCounters[g.gym_id] = 0;
    }
    const idx = indexCounters[g.gym_id]++;
    gradeMetaById.set(g.id, {
      name: g.name,
      color: g.color,
      index: idx,
      gym_id: g.gym_id,
    });
  }

  // 5) Group attempts by session
  const attemptsBySession: Record<string, AttemptRow[]> = {};
  for (const att of attempts) {
    if (!sessionIds.includes(att.session_id)) continue;
    if (!attemptsBySession[att.session_id]) {
      attemptsBySession[att.session_id] = [];
    }
    attemptsBySession[att.session_id].push(att);
  }

  // 6) Build view model per session, using custom grades where possible
  const sessionCards = sessions.map((session) => {
    const sessAttempts = attemptsBySession[session.id] ?? [];
    const totalAttempts = sessAttempts.length;

    const sends = sessAttempts.filter(
      (a) => a.outcome === 'sent'
    );
    const sendsCount = sends.length;

    const projectIds = new Set(
      sessAttempts.map((a) => a.problem_id)
    );
    const projectsTouched = projectIds.size;

    // Hardest grade sent this session – prefer custom gym grades
    let hardestGrade: string | null = null;
    let hardestColor: string | null = null;
    let hardestRank = -1;

    for (const send of sends) {
      const problem = problemsById.get(send.problem_id);
      if (!problem) continue;

      let rank: number | null = null;
      let label: string | null = null;
      let color: string | null = null;

      // ✅ Preferred: custom grade from gym_grades
      if (problem.grade_id && gradeMetaById.has(problem.grade_id)) {
        const meta = gradeMetaById.get(problem.grade_id)!;
        rank = meta.index;
        label = meta.name;
        color = meta.color ?? null;
      } else if (problem.grade) {
        // ❌ Fallback: try to parse something like "5b"
        const fbRank = gradeRankFallback(problem.grade);
        if (fbRank !== null) {
          rank = fbRank;
          label = problem.grade;
        } else if (!hardestGrade) {
          // last fallback: just take the textual grade
          label = problem.grade;
        }
      }

      if (rank !== null && rank > hardestRank) {
        hardestRank = rank;
        hardestGrade = label ?? null;
        hardestColor = color ?? null;
      } else if (hardestRank === -1 && label && !hardestGrade) {
        // first valid label if we never set rank
        hardestGrade = label;
        hardestColor = color ?? null;
      }
    }

    const typeLabel = classifySession(totalAttempts, sendsCount);

    return {
      session,
      totalAttempts,
      sendsCount,
      projectsTouched,
      hardestGrade,
      hardestColor,
      typeLabel,
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-sm mx-auto px-4 space-y-5 pb-28">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Previous Sessions</h1>
          <p className="text-sm text-slate-300">
            Übersicht deiner vergangenen Sessions nach Datum – mit deinem
            eigenen Gradsystem als Referenz.
          </p>
        </header>

        <div className="space-y-2">
          {sessionCards.map(
            ({
              session,
              totalAttempts,
              sendsCount,
              projectsTouched,
              hardestGrade,
              hardestColor,
              typeLabel,
            }) => (

            <div
              key={session.id}
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            >
              <div className="flex gap-3">
                <div className="flex-1">
                  {/* First line: date + energy */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{session.date}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>
                        {ENERGY_EMOJI[session.energy]} {ENERGY_LABEL[session.energy]}
                      </span>
                    </div>
                  </div>

                  {/* Second line: hardest + numbers */}
                  <div className="mt-1 flex flex-col gap-1 text-xs text-slate-300">
                    <div>
                      Hardest:{' '}
                      <span className="font-semibold inline-flex items-center gap-1">
                        {hardestColor && hardestGrade ? (
                          <>
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-slate-800"
                              style={{ backgroundColor: hardestColor }}
                            />
                            {hardestGrade}
                          </>
                        ) : (
                          hardestGrade ?? '–'
                        )}
                      </span>
                    </div>
                    <div>
                      {sendsCount} Sends • {totalAttempts} Versuche •{' '}
                      {projectsTouched} Projekte
                    </div>
                  </div>

                  {/* Third line: session type */}
                  <div className="mt-1 text-xs text-slate-400">
                    {typeLabel}
                  </div>
                </div>

               
              </div>
            </div>
  
            )
          )}
        </div>
      </div>
    </main>
  );
}
