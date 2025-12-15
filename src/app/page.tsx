'use client';

import { useEffect, useState } from 'react';
import {
  getOrCreateTodaySession,
  getActiveProblems,
  getProblemStats,
  getSessionAttemptStats,
  createProblem,
  logAttempt,
  deleteProblem,
  deleteProblemWithPhoto,
  getHomeGymWithGrades,
  type SessionRow,
  type ProblemRow,
  type ProblemStats,
  type Outcome,
  type GymRow,
  type GymGradeRow,
  type Energy,
  uploadImageToBucket,
} from '@/lib/api';

import { ProblemCard } from '@/components/problem/ProblemCard';
import { uploadProblemPhoto } from '@/lib/storage';
import { ProblemStack } from '@/components/problem/ProblemStack';
import { AttemptPanel } from '@/components/problem/AttemptPanel';
import { AddProblemModal } from '@/components/problem/AddProblemModal';



type Phase = 'checking' | 'energy' | 'session';

const ENERGY_LABELS: Record<Energy, string> = {
  low: '😵 Niedrige Energie',
  normal: '🙂 Normale Energie',
  high: '🚀 Hohe Energie',
};



function getGradeMeta(
  gradeId: string | null | undefined,
  grades: { id: string; color?: string | null }[]
) {
  if (!gradeId) return null;
  return grades.find((g) => g.id === gradeId) ?? null;
}

function getGradeLabel(
  gradeId: string | null,
  grades: { id: string; name: string }[]
) {
  if (!gradeId) return '—';
  return grades.find((g) => g.id === gradeId)?.name ?? '—';
}






export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  




  const [creatingEnergy, setCreatingEnergy] = useState<Energy | null>(
    null
  );

  // Data for current session view
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [statsByProblem, setStatsByProblem] = useState<
    Record<string, ProblemStats>
  >({});
  const [sessionStatsByProblem, setSessionStatsByProblem] = useState<
    Record<string, { attempts: number; lastOutcome: Outcome | null }>
  >({});

  const [activeProblemId, setActiveProblemId] = useState<string | null>(
    null
  );
  const [loggingFor, setLoggingFor] = useState<string | null>(null);
  const [deletingFor, setDeletingFor] = useState<string | null>(null);

  // Gym / grades
  const [homeGym, setHomeGym] = useState<GymRow | null>(null);
  const [homeGrades, setHomeGrades] = useState<GymGradeRow[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [adding, setAdding] = useState(false);



  // Session-only stats for summary
  const [sessionAttempts, setSessionAttempts] = useState<
    Record<string, { attempts: number; sent: boolean }>
  >({});
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const checkToday = async () => {
      setLoading(true);
      setError(null);
      try {
        const s = (await getOrCreateTodaySession()) as SessionRow;
        setSession(s);
        await loadSessionData(s.id);
        setPhase('session');
      } catch (err: any) {
        const msg = err?.message ?? '';
        if (
          typeof msg === 'string' &&
          msg.includes(
            'No session for today and no energy provided to create one.'
          )
        ) {
          // No session yet → ask for energy
          setPhase('energy');
        } else {
          console.error(err);
          setError('Konnte die heutige Session nicht laden.');
        }
      } finally {
        setLoading(false);
      }
    };

    void checkToday();
  }, []);

  useEffect(() => {
  if (!addOpen) return;

  // Prevent background scroll
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setAddOpen(false);
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    document.body.style.overflow = originalOverflow;
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [addOpen]);


const [activeIndex, setActiveIndex] = useState(0);
const activeProblem = problems.length > 0 ? problems[activeIndex] : null;



  const loadSessionData = async (sessionId: string) => {
  const [p, stats, home, sessionStats] = await Promise.all([
    getActiveProblems(),
    getProblemStats(),
    getHomeGymWithGrades(),
    getSessionAttemptStats(sessionId),
  ]);

  setProblems(p);
  setStatsByProblem(stats);
  setHomeGym(home.gym);
  setHomeGrades(home.grades);
  setSessionStatsByProblem(sessionStats);

  if (home.grades.length > 0) {
    setSelectedGradeId(home.grades[0].id);
  }
};


  const handleCreateSessionWithEnergy = async (energy: Energy) => {
    setCreatingEnergy(energy);
    setError(null);
    setLoading(true);
    try {
      const s = (await getOrCreateTodaySession(energy)) as SessionRow;
      setSession(s);
      await loadSessionData(s.id);
      setPhase('session');
    } catch (err: any) {
      console.error(err);
      setError('Session konnte nicht erstellt werden.');
    } finally {
      setCreatingEnergy(null);
      setLoading(false);
    }
  };

  const handleToggleActive = (problemId: string) => {
    setActiveProblemId((prev) => (prev === problemId ? null : problemId));
  };

  

async function handleAddProblem(payload: {
  gradeId: string;
  title: string;
  boulderColor: string;
  photo: File;
}) {
  if (adding) return;

  if (!homeGym || homeGrades.length === 0) {
    setError('Bitte zuerst ein Home-Gym mit Grades einrichten.');
    return;
  }

  try {
    setAdding(true);
    setError(null);

    // 1) upload required photo
    const photoUrl = await uploadProblemPhoto(payload.photo);

    // 2) create problem (title required)
    const created = await createProblem(
      homeGym.id,
      payload.gradeId,
      payload.title,        // required title
      photoUrl,             // required photo
      payload.boulderColor  // hold color
    );

    // 3) update UI
    setProblems((prev) => [...prev, created]);

    // Keep selection stable
    setSelectedGradeId(payload.gradeId);
  } catch (err) {
    console.error(err);
    setError('Problem konnte nicht gespeichert werden.');
  } finally {
    setAdding(false);
  }
}


  


  const handleLogAttempt = async (
    problemId: string, outcome: Outcome
  ) => {
    if (!session) return;
    setLoggingFor(problemId);
    setError(null);
    try {
      await logAttempt(session.id, problemId, outcome);

      // Update long-term stats
      setStatsByProblem((prev) => {
        const existing = prev[problemId] ?? {
          attempts: 0,
          lastOutcome: null,
        };
        return {
          ...prev,
          [problemId]: {
            attempts: existing.attempts + 1,
            lastOutcome: outcome,
          },
        };
      });

      setSessionStatsByProblem((prev) => {
        const existing = prev[problemId] ?? { attempts: 0, lastOutcome: null };
        return {
          ...prev,
          [problemId]: {
            attempts: existing.attempts + 1,
            lastOutcome: outcome,
          },
        };
      });


      // Update session-only stats
      setSessionAttempts((prev) => {
        const existing = prev[problemId] ?? {
          attempts: 0,
          sent: false,
        };
        return {
          ...prev,
          [problemId]: {
            attempts: existing.attempts + 1,
            sent: existing.sent || outcome === 'sent',
          },
        };
      });

      // Update local problem status if sent
      if (outcome === 'sent') {
        setProblems((prev) =>
          prev.map((p) =>
            p.id === problemId ? { ...p, status: 'sent' } : p
          )
        );
      }
    } catch (err: any) {
      console.error('Log attempt failed:', JSON.stringify(err, null, 2));
      setError('Versuch konnte nicht geloggt werden.');
    } finally {
      setLoggingFor(null);
    }
  };

const handleDeleteProblem = async (problemId: string) => {
  setDeletingFor(problemId);
  setError(null);

  try {
    const problem = problems.find((p) => p.id === problemId);

    await deleteProblemWithPhoto({
      id: problemId,
      photo_url: problem?.photo_url ?? null,
    });


    setProblems((prev) => prev.filter((p) => p.id !== problemId));

    setStatsByProblem((prev) => {
      const copy = { ...prev };
      delete copy[problemId];
      return copy;
    });

    setActiveIndex((i) => Math.min(i, Math.max(0, problems.length - 2)));

    if (activeProblemId === problemId) {
      setActiveProblemId(null);
    }
  } catch (err) {
    console.error(err);
    setError('Problem konnte nicht gelöscht werden.');
  } finally {
    setDeletingFor(null);
  }
};




// grade label shown on card (e.g. "V3", "Orange")
const gradeLabelFor = (p: ProblemRow) => {
  if (!p.grade_id) return '—';
  return homeGrades.find((g) => g.id === p.grade_id)?.name ?? '—';
};

// grade color (for the blob SVG / chip)
const gradeColorFor = (p: ProblemRow) => {
  if (!p.grade_id) return undefined;
  return homeGrades.find((g) => g.id === p.grade_id)?.color ?? undefined;
};

// optional: type label (can be static for now)
const typeLabelFor = (_p: ProblemRow) => {
  return 'overhang'; // MVP default
};







  // ---- RENDER ----

  // Initial loading
  if (phase === 'checking' && loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg">
        <p>Heutige Session wird geprüft…</p>
      </main>
    );
  }

  // Energy selection screen
  if (phase === 'energy') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-4">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-2xl font-semibold text-center">
            Heute noch keine Session.
          </h1>
          <p className="text-sm text-muted text-center">
            Wie fühlst du dich? Deine Energie hilft dir, die Session fair
            einzuordnen – nicht jeder Tag ist ein Rekordtag.
          </p>

          {error && (
            <p className="text-sm text-red-400 text-center">
              {error}
            </p>
          )}

          <div className="space-y-3">
            {(['low', 'normal', 'high'] as Energy[]).map((energy) => (
              <button
                key={energy}
                onClick={() => void handleCreateSessionWithEnergy(energy)}
                disabled={creatingEnergy !== null}
                className={`w-full rounded-xl px-4 py-3 text-left border ui-transition ${
                  energy === 'low'
                    ? 'border-border bg-card'
                    : energy === 'normal'
                    ? 'border-sky-600/40 bg-card'
                    : 'border-emerald-500/60 bg-emerald-950/40'
                } ${
                  creatingEnergy === energy
                    ? 'opacity-70 cursor-wait'
                    : 'hover:border-emerald-400 hover:bg-card/80'
                }`}
              >
                <div className="font-medium">
                  {ENERGY_LABELS[energy]}
                </div>
                <div className="text-xs text-muted mt-1">
                  {energy === 'low' &&
                    'Alles gut – wir behandeln diese Session vorsichtig in deinen Trends.'}
                  {energy === 'normal' &&
                    'Perfekt für ehrliche Progression über die Zeit.'}
                  {energy === 'high' &&
                    'Nice, starker Tag – wir markieren das als High-Energy Session.'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Error fallback
  if (error && !session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg">
        <p>{error}</p>
      </main>
    );
  }

















  
  // If we got here, we have a session and data loaded
  if (!session) return null;

  return (
    <main className="min-h-screen app-pattern text-fg p-3 flex">
    {/* This wrapper centers the content vertically on tall screens */}
    <div className="w-full max-w-sm mx-auto px-3 pb-20 flex flex-col justify-center pt-8 min-h-[calc(100dvh-4rem)]">
    {/* Inner block keeps your original spacing */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl center font-semibold">My current projects</h1>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-full bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50"
          aria-label="Neues Projekt hinzufügen"
          title="Neues Projekt"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 8H0V6H6V0H8V6H14V8H8V14H6V8Z" fill="black"/>
          </svg>
        </button>
      </div>



<ProblemStack
  problems={problems}
  statsByProblem={statsByProblem}
  gradeLabelFor={gradeLabelFor}
  gradeColorFor={gradeColorFor}
  typeLabelFor={typeLabelFor}
  activeIndex={activeIndex}
  setActiveIndex={setActiveIndex}
  onDelete={(id) => handleDeleteProblem(id)}
/>


{activeProblem && (
  <AttemptPanel
    onLogAttempt={(o) => handleLogAttempt(activeProblem.id, o)}
  />
)}

         </div>

<AddProblemModal
  open={addOpen}
  onClose={() => setAddOpen(false)}
  homeGym={homeGym}
  homeGrades={homeGrades}
  initialGradeId={selectedGradeId}
  submitting={adding}
  error={error}
  onSubmit={handleAddProblem}
/>


    </div>
    </main>
    
  );
}

type LogButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'sent';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

function LogButton({
  label,
  active,
  disabled,
  variant = 'default',
  onClick,
}: LogButtonProps) {
  const base =
  'rounded-xl border px-3 py-3 text-sm leading-tight min-h-[44px] ui-transition disabled:opacity-60';

  const activeStyles =
    variant === 'sent'
      ? 'border-emerald-400 bg-emerald-900'
      : 'border-emerald-300 bg-card';
  const inactiveStyles =
    variant === 'sent'
      ? 'border-emerald-500 bg-emerald-950/60 hover:bg-emerald-900'
      : 'border-border bg-card hover:border-emerald-300';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${
        active ? activeStyles : inactiveStyles
      }`}
    >
      {label}
    </button>
  );
}
