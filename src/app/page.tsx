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
  const [newBoulderColor, setNewBoulderColor] = useState('');
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
  const [newGradeNote, setNewGradeNote] = useState('');
  const [newFreeGrade, setNewFreeGrade] = useState('');
  const [adding, setAdding] = useState(false);
  // right below newFreeGrade / adding / etc.
  const [newProjectPhoto, setNewProjectPhoto] = useState<File | null>(null);


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

  

  async function handleAddProblem(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;

    try {
      setAdding(true);

      // 1. Upload photo (if any)
      let photoUrl: string | undefined;
      if (newProjectPhoto) {
        photoUrl = await uploadProblemPhoto(newProjectPhoto);
      }
      if (!homeGym) {
        setError('Bitte zuerst ein Home-Gym auswählen.');
        return;
      }
      const homeGymId = homeGym.id;
      // 2. Determine gradeId
      const gradeId = homeGym
        ? selectedGradeId
        : null; // free-grade case handled separately if you still support it

      // 3. Determine title (THIS IS THE KEY CHANGE)
      const title = newGradeNote.trim() || null;

      // 4. Create problem (CLEAN)
      const created = await createProblem(
        homeGymId,
        gradeId,
        title,
        photoUrl,
        newBoulderColor || null
      );

      // 5. Update UI
      setProblems((prev) => [...prev, created]);

      // 6. Reset form
      setNewGradeNote('');
      setNewBoulderColor('');
      setNewProjectPhoto(null);
    } catch (err) {
      console.error(err);
      setError('Projekt konnte nicht gespeichert werden.');
    } finally {
      setAdding(false);
    }
  }

  


  const handleLogAttempt = async (
    problemId: string,
    outcome: Outcome
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

const handleDeleteProblem = async (problem: ProblemRow) => {
  setDeletingFor(problem.id);
  setError(null);

  try {
    await deleteProblemWithPhoto(problem);

    // remove from list
    setProblems((prev) => prev.filter((p) => p.id !== problem.id));

    // remove from maps
    setStatsByProblem((prev) => {
      const copy = { ...prev };
      delete copy[problem.id];
      return copy;
    });

    setSessionAttempts((prev) => {
      const copy = { ...prev };
      delete copy[problem.id];
      return copy;
    });

    setSessionStatsByProblem((prev) => {
      const copy = { ...prev };
      delete copy[problem.id];
      return copy;
    });

    if (activeProblemId === problem.id) {
      setActiveProblemId(null);
    }
  } catch (err: any) {
    console.error(err);
    setError('Problem konnte nicht gelöscht werden.');
  } finally {
    setDeletingFor(null);
  }
};




const AddProblemForm = (
  <form
    onSubmit={async (e) => {
      await handleAddProblem(e);
      // close modal only when it worked (optional: only close if no error)
      setAddOpen(false);
    }}
    className="space-y-3"
  >
            {/* Add new project */}
              <label className="text-xs font-medium text-muted">
                Neues Projekt hinzufügen
              </label>

              {homeGym && homeGrades.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      Grad:
                    </span>
                    <select
                      value={selectedGradeId}
                      onChange={(e) =>
                        setSelectedGradeId(e.target.value)
                      }
                      className="flex-1 rounded-xl bg-bg border border-border px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                    >
                      {homeGrades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.color})
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newGradeNote}
                    onChange={(e) =>
                      setNewGradeNote(e.target.value)
                    }
                    placeholder="Notiz / Wand / Bereich (optional)"
                    className="w-full rounded-xl bg-bg border border-border px-3 py-2 text-sm text-fg placeholder:text-fg0 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
              ) : (
                <>
                  <p className="text-xs text-fg0">
                    Kein Home-Gym mit Grades definiert. Du kannst trotzdem
                    einen freien Grad-Namen verwenden.
                  </p>
                  <input
                    type="text"
                    value={newFreeGrade}
                    onChange={(e) =>
                      setNewFreeGrade(e.target.value)
                    }
                    placeholder="z.B. Orange 5B+ rechte Wand"
                    className="w-full rounded-xl bg-bg border border-border px-3 py-2 text-sm text-fg placeholder:text-fg0 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </>
              )}

              <div className="mt-2 space-y-1">
                <label className="text-xs text-muted">
                  Boulder-Farbe (Hold-Farbe)
                </label>
                <select
                  value={newBoulderColor}
                  onChange={(e) => setNewBoulderColor(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-border px-3 py-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                >
                  <option value="">— auswählen —</option>
                  <option value="black">Schwarz</option>
                  <option value="white">Weiß</option>
                  <option value="gray">Grau</option>
                  <option value="yellow">Gelb</option>
                  <option value="orange">Orange</option>
                  <option value="red">Rot</option>
                  <option value="pink">Pink</option>
                  <option value="purple">Lila</option>
                  <option value="blue">Blau</option>
                  <option value="green">Grün</option>
                  <option value="brown">Braun</option>
                </select>

                <input
                  type="text"
                  value={newBoulderColor}
                  onChange={(e) => setNewBoulderColor(e.target.value)}
                  placeholder="oder frei tippen (z.B. neon-pink)"
                  className="w-full rounded-xl bg-bg border border-border px-3 py-3 text-sm text-fg placeholder:text-fg0 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>


              <div className="mt-2 space-y-1">
                <label className="text-xs text-muted">
                  Optionales Projektfoto:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setNewProjectPhoto(file);
                  }}
                  className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-100 hover:file:border-emerald-400"
                />
                {newProjectPhoto && (
                  <p className="text-[11px] text-fg0">
                    Ausgewählt: {newProjectPhoto.name}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  adding ||
                  (!homeGym && !newFreeGrade.trim())
                }
                className="mt-2 w-full rounded-xl border border-emerald-500/80 bg-emerald-950/60 px-3 py-2 text-sm font-medium hover:bg-emerald-900 disabled:opacity-60"
              >
                {adding ? 'Wird hinzugefügt…' : 'Projekt speichern'}
              </button>
  
    



  </form>
);








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
    <main className="min-h-screen app-pattern text-fg p-4">
      <div className="max-w-sm mx-auto px-3 space-y-5 pb-20">


        <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Current Projects</h1>
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

















        {/* Current projects */}
        <section className="space-y-3">

          {problems.length === 0 && (
            <p className="text-sm text-muted">
              Noch keine Projekte – füge unten ein neues hinzu.
            </p>
          )}

          <div className="space-y-6">
            {problems.map((problem) => {
              const stats = statsByProblem[problem.id] ?? {
                attempts: 0,
                lastOutcome: null,
              };

              const gradeMeta = homeGrades.find(
                (g) => g.id === problem.grade_id
              );

              return (
                <ProblemCard
                  key={problem.id}
                  problem={problem}
                  gradeLabel={getGradeLabel(problem.grade_id, homeGrades)}
                  gradeColor={gradeMeta?.color}
                  isActive={activeProblemId === problem.id}
                  stats={{
                    attempts: stats.attempts,
                    bestReach: stats.lastOutcome,
                  }}
                  onSelect={() => setActiveProblemId(problem.id)}
                  onLogAttempt={(outcome: Outcome) => {
                    void handleLogAttempt(problem.id, outcome);
                  }}
                  onDelete={() => {
                    void handleDeleteProblem(problem);
                  }}
                />
              );
            })}






          </div>
        </section>

      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
          />

          {/* Modal */}
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 ui-transition -translate-y-1/2">
            <div className="rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Neues Projekt</h2>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-full px-2 py-1 text-sm hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* form */}
              <div className="mt-3">
                {AddProblemForm}
              </div>
            </div>
          </div>
        </div>
      )}


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
