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

type Phase = 'checking' | 'energy' | 'session';

const ENERGY_LABELS: Record<Energy, string> = {
  low: '😵 Niedrige Energie',
  normal: '🙂 Normale Energie',
  high: '🚀 Hohe Energie',
};

function boulderColorToStyle(color?: string | null): React.CSSProperties {
  if (!color) return {};

  // normalize
  const c = color.toLowerCase();

  // map common gym colors to safe rgba tints
  const map: Record<string, string> = {
    black: 'rgba(255,255,255,0.3)',
    white: 'rgba(255,255,255,0.3)',
    gray: 'rgba(255,255,255,0.3)',
    grey: 'rgba(255,255,255,0.3)',
    yellow: 'rgba(255,230,120,0.3)',
    orange: 'rgba(255,170,80,0.3)',
    red: 'rgba(255,90,90,0.3)',
    pink: 'rgba(255,120,200,0.3)',
    purple: 'rgba(180,120,255,0.3)',
    blue: 'rgba(120,180,255,0.3)',
    green: 'rgba(120,220,160,0.3)',
    brown: 'rgba(180,140,100,0.3)',
  };

  return {
    backgroundColor: map[c] ?? 'rgba(255,255,255,0.04)',
  };
}



function getGradeMeta(
  gradeId: string | null | undefined,
  grades: { id: string; color?: string | null }[]
) {
  if (!gradeId) return null;
  return grades.find((g) => g.id === gradeId) ?? null;
}




















export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBoulderColor, setNewBoulderColor] = useState('');


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

  

  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);

    try {
      let gradeLabel: string;
      let gymId: string | undefined;
      let gradeId: string | undefined;
      let photoUrl: string | undefined;


    if (homeGym && homeGrades.length > 0 && selectedGradeId) {
          const selected = homeGrades.find(
            (g) => g.id === selectedGradeId
          );
          if (!selected) {
            throw new Error('Ausgewählter Grad nicht gefunden.');
          }
          gymId = homeGym.id;
          gradeId = selected.id;
          gradeLabel = newGradeNote.trim()
            ? `${selected.name} – ${newGradeNote.trim()}`
            : selected.name;
        } else {
          if (!newFreeGrade.trim()) {
            setAdding(false);
            return;
          }
          gradeLabel = newFreeGrade.trim();
    }

    // ✅ If a project photo was selected, upload it first
    if (newProjectPhoto) {
      photoUrl = await uploadImageToBucket(
        'boulder-photos',
        newProjectPhoto,
        `problems/${session?.id ?? 'no-session'}`
      );
    }

      const created = await createProblem({
      gradeLabel,
      gymId,
      gradeId,
      photoUrl,
      boulderColor: newBoulderColor.trim() ? newBoulderColor.trim() : undefined,

    });

    setProblems((prev) => [...prev, created]);
    setNewGradeNote('');
    setNewFreeGrade('');
    setNewProjectPhoto(null);
  } catch (err: any) {
    console.error(err);
    setError('Problem konnte nicht erstellt werden.');
  } finally {
    setAdding(false);
    setNewBoulderColor('');

  }

  };

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


  // ---- Session summary derived data ----

  const touchedIds = Object.keys(sessionAttempts);
  const problemsTouched = touchedIds.length;
  const totalAttemptsSession = touchedIds.reduce(
    (sum, id) => sum + sessionAttempts[id].attempts,
    0
  );
  const sendsSession = touchedIds.filter(
    (id) => sessionAttempts[id].sent
  ).length;

  // Home-gym–aware hardest grade for today
  let hardestGradeLabel: string | null = null;
  let hardestGradeIndex = -1;

  for (const id of touchedIds) {
    if (!sessionAttempts[id].sent) continue;

    const problem = problems.find((p) => p.id === id);
    if (!problem) continue;

    // Prefer home gym grade ordering
    if (problem.grade_id && homeGrades.length > 0) {
      const idx = homeGrades.findIndex((g) => g.id === problem.grade_id);
      if (idx > hardestGradeIndex) {
        hardestGradeIndex = idx;
        hardestGradeLabel =
          homeGrades[idx]?.name ?? problem.grade ?? null;
      }
    } else if (problem.grade && hardestGradeIndex === -1) {
      // Fallback: just keep first textual grade we find
      hardestGradeLabel = problem.grade;
    }
  }

  let summaryMessage = '';
  if (totalAttemptsSession === 0) {
    summaryMessage =
      'Sobald du Versuche loggst, erscheint hier deine Session-Zusammenfassung.';
  } else if (sendsSession === 0) {
    summaryMessage =
      'Kein Top heute – aber viele Versuche sind starke Aufbauarbeit. Volume-Days zahlen sich später aus. 💪';
  } else if (sendsSession > 0 && hardestGradeLabel) {
    if (totalAttemptsSession / sendsSession <= 3) {
      summaryMessage = `Starker Tag! Du toppst Projekte im Schnitt nach sehr wenigen Versuchen. Härtester Grad heute: ${hardestGradeLabel}. 🚀`;
    } else {
      summaryMessage = `Gute Ausdauer-Session! Du hast dir Tops erarbeitet – härtester Grad heute: ${hardestGradeLabel}. 🔁`;
    }
  } else {
    summaryMessage =
      'Solide Session – deine Versuche bauen Technik und Körperspannung auf, auch wenn heute nichts komplett gefallen ist.';
  }

  // ---- RENDER ----

  // Initial loading
  if (phase === 'checking' && loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p>Heutige Session wird geprüft…</p>
      </main>
    );
  }

  // Energy selection screen
  if (phase === 'energy') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-2xl font-semibold text-center">
            Heute noch keine Session.
          </h1>
          <p className="text-sm text-slate-300 text-center">
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
                className={`w-full rounded-xl px-4 py-3 text-left border transition ${
                  energy === 'low'
                    ? 'border-slate-700 bg-slate-900'
                    : energy === 'normal'
                    ? 'border-sky-600/40 bg-slate-900'
                    : 'border-emerald-500/60 bg-emerald-950/40'
                } ${
                  creatingEnergy === energy
                    ? 'opacity-70 cursor-wait'
                    : 'hover:border-emerald-400 hover:bg-slate-900/80'
                }`}
              >
                <div className="font-medium">
                  {ENERGY_LABELS[energy]}
                </div>
                <div className="text-xs text-slate-300 mt-1">
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
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p>{error}</p>
      </main>
    );
  }

















  
  // If we got here, we have a session and data loaded
  if (!session) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-sm mx-auto px-4 space-y-5 pb-28">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Heutige Session</h1>
          <p className="text-xs text-slate-400">
            Datum: {session.date} · Energie: {session.energy}
          </p>
          {homeGym && (
            <p className="text-xs text-slate-500">
              Home-Gym: {homeGym.name}
            </p>
          )}
        </header>

        {/* Current projects */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Aktuelle Projekte
          </h2>

          {problems.length === 0 && (
            <p className="text-sm text-slate-400">
              Noch keine Projekte – füge unten ein neues hinzu.
            </p>
          )}

          <div className="space-y-3">
            {problems.map((problem) => {
              const isActive = activeProblemId === problem.id;
              const isLogging = loggingFor === problem.id;
              const stats = statsByProblem[problem.id];
              const attempts = stats?.attempts ?? 0;
              const lastOutcome = stats?.lastOutcome;
              const isSent = problem.status === 'sent';

              return (
                <div
                  key={problem.id}
                  style={boulderColorToStyle(problem.boulder_color)}
                  className={`rounded-2xl border p-3 transition-all ${
                    isActive
                      ? 'border-emerald-400 bg-slate-900 shadow-lg scale-[1.02]'
                      : 'border-slate-700 bg-slate-900/60 hover:border-emerald-300/60'
                  } ${isSent ? 'opacity-90' : 'opacity-100'}`}
                  onClick={() => handleToggleActive(problem.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {(() => {
                          const gradeMeta = getGradeMeta(problem.grade_id, homeGrades);
                          return (
                            <>
                              {gradeMeta?.color && (
                                <span
                                  className="h-3 w-3 rounded-sm border border-slate-800"
                                  style={{ backgroundColor: gradeMeta.color }}
                                  aria-label="Grad-Farbe"
                                />
                              )}
                              <span>{problem.grade}</span>
                            </>
                          );
                        })()}
                      </div>
                      {problem.boulder_color && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                          {problem.boulder_color} holds
                        </span>
                      )}

                      <div className="text-xs text-slate-400 mt-0.5">
                        Status:{' '}
                        {isSent ? 'Abgehakt (getoppt)' : 'Projekt'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Versuche insgesamt: {attempts}
                      </div>
                      {lastOutcome && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Letzter Versuch:{' '}
                          {lastOutcome === 'crux'
                            ? 'bis zur Crux'
                            : lastOutcome === 'almost'
                            ? 'fast getoppt'
                            : 'getoppt'}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteProblem(problem);
                      }}
                      disabled={deletingFor === problem.id}
                      className="text-slate-500 hover:text-red-400 disabled:opacity-50"
                      aria-label="Projekt löschen"
                    >
                      {deletingFor === problem.id ? '…' : '🗑️'}
                    </button>
                  </div>
                  {problem.photo_url && (
                  <div className="mt-3">
                    <img
                      src={problem.photo_url}
                      alt="Projektfoto"
                      className="w-full max-h-48 rounded-xl object-cover border border-slate-800"
                      loading="lazy"
                    />
                  </div>
                  )}
                  
                  {isActive && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="text-xs text-slate-400 mb-1">
                        Wie weit bist du bei diesem Versuch gekommen?
                      </div>

                      {(() => {
                        const sess = sessionStatsByProblem[problem.id];
                        const attemptsThisSession = sess?.attempts ?? 0;
                        const lastOutcomeThisSession = sess?.lastOutcome ?? null;

                        // ✅ Your requested rule:
                        // If problem is already sent, and you haven't logged it in this session yet,
                        // show "Top" as active until the first attempt is logged.
                        const defaultTopActive =
                          problem.status === 'sent' && attemptsThisSession === 0;

                        const isActiveOutcome = (o: Outcome) =>
                          defaultTopActive ? o === 'sent' : lastOutcomeThisSession === o;

                        return (
                          <div className="grid grid-cols-2 gap-2">
                            <LogButton
                              label="Start"
                              active={isActiveOutcome('start')}
                              disabled={isLogging}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleLogAttempt(problem.id, 'start');
                              }}
                            />
                            <LogButton
                              label="Crux"
                              active={isActiveOutcome('crux')}
                              disabled={isLogging}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleLogAttempt(problem.id, 'crux');
                              }}
                            />
                            <LogButton
                              label="Fast Top"
                              active={isActiveOutcome('almost')}
                              disabled={isLogging}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleLogAttempt(problem.id, 'almost');
                              }}
                            />
                            <LogButton
                              label="Top 🎉"
                              active={isActiveOutcome('sent')}
                              disabled={isLogging}
                              variant="sent"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleLogAttempt(problem.id, 'sent');
                              }}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              );
            })}

            {/* Add new project */}
            <form
              onSubmit={handleAddProblem}
              className="mt-2 rounded-2xl border border-dashed border-slate-600 bg-slate-900/40 p-4 space-y-2"
            >
              <label className="text-xs font-medium text-slate-300">
                Neues Projekt hinzufügen
              </label>

              {homeGym && homeGrades.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      Grad:
                    </span>
                    <select
                      value={selectedGradeId}
                      onChange={(e) =>
                        setSelectedGradeId(e.target.value)
                      }
                      className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
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
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
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
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </>
              )}

              <div className="mt-2 space-y-1">
                <label className="text-xs text-slate-400">
                  Boulder-Farbe (Hold-Farbe)
                </label>
                <select
                  value={newBoulderColor}
                  onChange={(e) => setNewBoulderColor(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-3 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
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
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>


              <div className="mt-2 space-y-1">
                <label className="text-xs text-slate-400">
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
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-600 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-100 hover:file:border-emerald-400"
                />
                {newProjectPhoto && (
                  <p className="text-[11px] text-slate-500">
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
          </div>
        </section>

        {/* End session button */}
        <div className="fixed inset-x-0 bottom-0 z-30 bg-slate-950/80 backdrop-blur border-t border-slate-800">
          <div className="max-w-sm mx-auto px-4 py-3">
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-100 hover:border-emerald-400 hover:text-emerald-200 hover:bg-slate-900 transition"
            >
              Session beenden & Zusammenfassung
            </button>
          </div>
        </div>

      </div>

      {/* Cinematic-ish modal overlay for summary */}
      {showSummary && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-200">
                Session-Zusammenfassung
              </h2>
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                Schließen
              </button>
            </div>

            {totalAttemptsSession === 0 ? (
              <p className="text-sm text-slate-400">
                {summaryMessage}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-slate-300">
                  Versuche heute:{' '}
                  <span className="font-semibold">
                    {totalAttemptsSession}
                  </span>
                </p>
                <p className="text-sm text-slate-300">
                  Bearbeitete Projekte:{' '}
                  <span className="font-semibold">
                    {problemsTouched}
                  </span>
                </p>
                <p className="text-sm text-slate-300">
                  Getoppte Projekte heute:{' '}
                  <span className="font-semibold">
                    {sendsSession}
                  </span>
                </p>
                <p className="text-sm text-slate-300">
                  Härtester Grad (heute gesendet):{' '}
                  {hardestGradeLabel ? (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            homeGrades.find(
                              (g) => g.name === hardestGradeLabel
                            )?.color ?? '#64748b',
                        }}
                      />
                      {hardestGradeLabel}
                    </span>
                  ) : (
                    '–'
                  )}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {summaryMessage}
                </p>
                <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
            
            </div>

              </div>
            )}
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
  'rounded-xl border px-3 py-3 text-sm leading-tight min-h-[44px] transition disabled:opacity-60';

  const activeStyles =
    variant === 'sent'
      ? 'border-emerald-400 bg-emerald-900'
      : 'border-emerald-300 bg-slate-900';
  const inactiveStyles =
    variant === 'sent'
      ? 'border-emerald-500 bg-emerald-950/60 hover:bg-emerald-900'
      : 'border-slate-600 bg-slate-900 hover:border-emerald-300';

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
