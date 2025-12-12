import { supabase } from '@/lib/supabaseClient';
import { getHomeGymWithGrades } from '@/lib/api';

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

// Very simple fallback ordering for FB-like grades
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

export default async function ProgressPage() {
  // Load all problems (now including gym + grade ids)
  const { data: problemsData, error: problemsError } = await supabase
    .from('problems')
    .select('id, grade, status, created_at, gym_id, grade_id')
    .order('created_at', { ascending: true });

  if (problemsError) {
    console.error(problemsError);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Probleme.</p>
      </main>
    );
  }

  const problems = (problemsData ?? []) as ProblemRow[];

  // Load all attempts
  const { data: attemptsData, error: attemptsError } = await supabase
    .from('attempts')
    .select('problem_id, outcome, created_at')
    .order('created_at', { ascending: true });

  if (attemptsError) {
    console.error(attemptsError);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 flex items-center justify-center">
        <p>Fehler beim Laden der Versuche.</p>
      </main>
    );
  }

  const attempts = (attemptsData ?? []) as AttemptRow[];

  // Load home gym + its grades so we can order by your real system
  const { gym: homeGym, grades: homeGrades } =
    await getHomeGymWithGrades();

  // --- 1) Average attempts per send ---

  const attemptsByProblem: Record<string, AttemptRow[]> = {};
  for (const att of attempts) {
    if (!attemptsByProblem[att.problem_id]) {
      attemptsByProblem[att.problem_id] = [];
    }
    attemptsByProblem[att.problem_id].push(att);
  }

  let totalAttemptToSend = 0;
  let problemsWithSend = 0;

  type SendRecord = {
    problemId: string;
    grade: string | null;
    gymId: string | null;
    gradeId: string | null;
    firstSentAt: string;
    attemptsToSend: number;
  };

  const sendRecords: SendRecord[] = [];

  for (const problem of problems) {
    const problemAttempts = attemptsByProblem[problem.id] ?? [];
    if (problemAttempts.length === 0) continue;

    const firstSent = problemAttempts.find(
      (a) => a.outcome === 'sent'
    );
    if (!firstSent) continue;

    problemsWithSend += 1;

    const attemptsUntilSent = problemAttempts.filter(
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
    problemsWithSend > 0
      ? totalAttemptToSend / problemsWithSend
      : null;

  // --- 2) "Crux reach" percentage (problems you've worked on at all) ---

  const problemIdsWithAttempts = new Set(
    attempts.map((a) => a.problem_id)
  );

  const totalProblems = problems.length;
  const workedProblems = [...problemIdsWithAttempts].length;

  const cruxReachPercentage =
    totalProblems > 0 ? (workedProblems / totalProblems) * 100 : null;

  // --- 3) Personal grade curve over time (home-gym–aware) ---

  type SendWithRank = SendRecord & {
    rank: number;
    displayGrade: string;
  };

  const sentWithRank = sendRecords
    .map((rec) => {
      let rank: number | null = null;
      let displayGrade = rec.grade ?? 'Unbekannter Grad';

      // ✅ Preferred: use home gym grade ordering if this send belongs to the home gym
      if (
        homeGym &&
        rec.gymId === homeGym.id &&
        rec.gradeId &&
        homeGrades.length > 0
      ) {
        const idx = homeGrades.findIndex((g) => g.id === rec.gradeId);
        if (idx !== -1) {
          rank = idx; // lower index = easier, higher = harder
          displayGrade = homeGrades[idx].name;
        }
      }

      // ❌ Fallback: parse something like "5b" or "6a+" from the grade text
      if (rank === null) {
        const fbRank = gradeRankFallback(rec.grade ?? null);
        if (fbRank !== null) {
          // offset fallback so it's still comparable even if no home grades exist
          rank = fbRank;
        }
      }

      if (rank === null) return null;

      return {
        ...rec,
        rank,
        displayGrade,
      };
    })
    .filter(Boolean) as SendWithRank[];

  // Sort by date
  sentWithRank.sort((a, b) =>
    a.firstSentAt.localeCompare(b.firstSentAt)
  );

  type GradeTimelineEntry = {
    date: string;
    grade: string;
    attemptsToSend: number;
    isNewHardest: boolean;
  };

  const timeline: GradeTimelineEntry[] = [];
  let hardestSoFar = -1;
  let hardestGrade: string | null = null;

  for (const rec of sentWithRank) {
    const readableDate = rec.firstSentAt.slice(0, 10); // YYYY-MM-DD
    const gradeLabel = rec.displayGrade;
    const isNewHardest = rec.rank > hardestSoFar;

    if (isNewHardest) {
      hardestSoFar = rec.rank;
      hardestGrade = gradeLabel;
    }

    timeline.push({
      date: readableDate,
      grade: gradeLabel,
      attemptsToSend: rec.attemptsToSend,
      isNewHardest,
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-sm mx-auto px-4 space-y-5 pb-28">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Progress</h1>
          <p className="text-sm text-slate-300">
            Ein erster Überblick über deine versteckte Bouldering-Progression.
          </p>
          <p className="text-xs text-slate-500">
            Datenbasis: {attempts.length} Versuche auf {problems.length}{' '}
            Problemen.
          </p>
          {homeGym && (
            <p className="text-xs text-slate-500">
              Home-Gym: {homeGym.name}
            </p>
          )}
        </header>

        {/* 1) Average attempts per send */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">
            📈 Durchschnittliche Versuche pro Top
          </h2>
          {avgAttemptsPerSend === null ? (
            <p className="text-sm text-slate-400">
              Noch keine getoppten Projekte – sobald du ein paar Tops
              geloggt hast, siehst du hier, wie viele Versuche du im
              Schnitt brauchst.
            </p>
          ) : (
            <>
              <p className="text-3xl font-semibold">
                {avgAttemptsPerSend.toFixed(1)}
              </p>
              <p className="text-sm text-slate-400">
                Im Schnitt so viele Versuche brauchst du, bis ein Projekt
                erstmals fällt.
              </p>
            </>
          )}
        </section>

        {/* 2) "Crux reach" percentage */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">
            🧩 Projekte, die du wirklich bearbeitest
          </h2>
          {cruxReachPercentage === null ? (
            <p className="text-sm text-slate-400">
              Du hast noch keine Projekte angelegt.
            </p>
          ) : (
            <>
              <p className="text-3xl font-semibold">
                {cruxReachPercentage.toFixed(0)}%
              </p>
              <p className="text-sm text-slate-400">
                Von all deinen angelegten Projekten hast du{' '}
                <span className="font-semibold">
                  {workedProblems} von {totalProblems}
                </span>{' '}
                mindestens einmal ernsthaft versucht.
              </p>
            </>
          )}
        </section>

        {/* 3) Grade curve over time */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">
            📊 Grad-Kurve über die Zeit
          </h2>

          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sobald du Probleme toppst, siehst du hier, wie sich deine
              härteren Projekte über die Zeit entwickelt haben – nach deinem
              eigenen Home-Gym-Gradsystem.
            </p>
          ) : (
            <>
              {hardestGrade && (
                <p className="text-sm text-emerald-300">
                  Aktuell härtester erkannter Grad:{' '}
                  <span className="font-semibold">
                    {hardestGrade.toUpperCase()}
                  </span>
                </p>
              )}

              <div className="mt-2 space-y-2">
                {timeline.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm">
                        {entry.date} · {entry.grade}
                      </p>
                      <p className="text-xs text-slate-400">
                        Erstes Top nach {entry.attemptsToSend} Versuchen
                      </p>
                    </div>
                    {entry.isNewHardest && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-900 text-emerald-200">
                        Neuer Meilenstein
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
