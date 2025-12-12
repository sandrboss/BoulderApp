'use client';

import { useEffect, useState } from 'react';
import {
  getGymsAndGrades,
  createGym,
  setHomeGym,
  updateGymGradingMode,
  createGymGrade,
  updateGymGrade,
  deleteGymGrade,
  type GymRow,
  type GymGradeRow,
} from '@/lib/api';

const COLOR_OPTIONS = [
  'white',
  'black',
  'yellow',
  'orange',
  'green',
  'blue',
  'red',
  'purple',
  'pink',
];

export default function ProfilePage() {
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [gradesByGym, setGradesByGym] = useState<
    Record<string, GymGradeRow[]>
  >({});
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [newGymName, setNewGymName] = useState('');
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeColor, setNewGradeColor] = useState('orange');
  const [loading, setLoading] = useState(true);
  const [savingGym, setSavingGym] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { gyms, gradesByGym } = await getGymsAndGrades();
        setGyms(gyms);
        setGradesByGym(gradesByGym);
        if (gyms.length > 0) {
          const home = gyms.find((g) => g.is_home);
          setSelectedGymId(home?.id ?? gyms[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError('Profil-Daten konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const selectedGym = gyms.find((g) => g.id === selectedGymId) ?? null;
  const selectedGrades =
    (selectedGym && gradesByGym[selectedGym.id]) || [];

  const handleAddGym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGymName.trim()) return;
    setSavingGym(true);
    setError(null);
    try {
      const gym = await createGym(newGymName.trim());
      setGyms((prev) => [...prev, gym]);
      setNewGymName('');
      if (!selectedGymId) setSelectedGymId(gym.id);
    } catch (err: any) {
      console.error(err);
      setError('Gym konnte nicht angelegt werden.');
    } finally {
      setSavingGym(false);
    }
  };

  const handleSetHomeGym = async (gymId: string) => {
    setSavingGym(true);
    setError(null);
    try {
      await setHomeGym(gymId);
      setGyms((prev) =>
        prev.map((g) => ({ ...g, is_home: g.id === gymId }))
      );
    } catch (err: any) {
      console.error(err);
      setError('Home-Gym konnte nicht gesetzt werden.');
    } finally {
      setSavingGym(false);
    }
  };

  const handleToggleGradingMode = async () => {
    if (!selectedGym) return;
    const nextMode =
      selectedGym.grading_mode === 'specific' ? 'ranges' : 'specific';
    setError(null);
    setSavingGym(true);
    try {
      await updateGymGradingMode(selectedGym.id, nextMode);
      setGyms((prev) =>
        prev.map((g) =>
          g.id === selectedGym.id
            ? { ...g, grading_mode: nextMode }
            : g
        )
      );
    } catch (err: any) {
      console.error(err);
      setError('Grading-Mode konnte nicht aktualisiert werden.');
    } finally {
      setSavingGym(false);
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGym) return;
    if (!newGradeName.trim()) return;
    setSavingGrade(true);
    setError(null);
    try {
      const grade = await createGymGrade(
        selectedGym.id,
        newGradeName.trim(),
        newGradeColor
      );
      setGradesByGym((prev) => ({
        ...prev,
        [selectedGym.id]: [...(prev[selectedGym.id] ?? []), grade],
      }));
      setNewGradeName('');
    } catch (err: any) {
      console.error(err);
      setError('Grad konnte nicht angelegt werden.');
    } finally {
      setSavingGrade(false);
    }
  };

  const handleUpdateGrade = async (grade: GymGradeRow) => {
    setSavingGrade(true);
    setError(null);
    try {
      const updated = await updateGymGrade(
        grade.id,
        grade.name,
        grade.color
      );
      setGradesByGym((prev) => {
        const list = prev[grade.gym_id] ?? [];
        return {
          ...prev,
          [grade.gym_id]: list.map((g) =>
            g.id === grade.id ? updated : g
          ),
        };
      });
    } catch (err: any) {
      console.error(err);
      setError('Grad konnte nicht gespeichert werden.');
    } finally {
      setSavingGrade(false);
    }
  };

  const handleDeleteGrade = async (grade: GymGradeRow) => {
    setSavingGrade(true);
    setError(null);
    try {
      await deleteGymGrade(grade.id);
      setGradesByGym((prev) => {
        const list = prev[grade.gym_id] ?? [];
        return {
          ...prev,
          [grade.gym_id]: list.filter((g) => g.id !== grade.id),
        };
      });
    } catch (err: any) {
      console.error(err);
      setError('Grad konnte nicht gelöscht werden.');
    } finally {
      setSavingGrade(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p>Profil wird geladen…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row">
        {/* Left: Gyms */}
        <section className="w-full md:w-1/2 space-y-4">
          <h1 className="text-xl font-semibold">Mein Profil</h1>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Meine Gyms
            </h2>

            {gyms.length === 0 && (
              <p className="text-sm text-slate-400">
                Du hast noch keine Gyms angelegt. Lege unten dein Home-Gym an,
                um Grades zu definieren.
              </p>
            )}

            <div className="space-y-2">
            {gyms.map((gym) => (
                <div
                key={gym.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGymId(gym.id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedGymId(gym.id);
                    }
                }}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition cursor-pointer ${
                    selectedGymId === gym.id
                    ? 'border-emerald-400 bg-slate-900'
                    : 'border-slate-700 bg-slate-900/60 hover:border-emerald-300/60'
                }`}
                >
                <div className="flex items-center justify-between gap-2">
                    <div>
                    <div className="font-medium">{gym.name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                        Mode:{' '}
                        {gym.grading_mode === 'specific'
                        ? 'Spezifische Grades'
                        : 'Grade-Bereiche'}
                    </div>
                    </div>
                    <div className="flex items-center gap-2">
                    {gym.is_home && (
                        <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                        Home-Gym
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                        e.stopPropagation();
                        void handleSetHomeGym(gym.id);
                        }}
                        disabled={savingGym}
                        className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300 hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-60"
                    >
                        Als Home
                    </button>
                    </div>
                </div>
                </div>
            ))}
            </div>


            <form
              onSubmit={handleAddGym}
              className="mt-3 space-y-2 border-t border-slate-800 pt-3"
            >
              <label className="text-xs font-medium text-slate-300">
                Neues Gym hinzufügen
              </label>
              <input
                type="text"
                value={newGymName}
                onChange={(e) => setNewGymName(e.target.value)}
                placeholder="z.B. Beta Boulders, Escaladrome..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
              <button
                type="submit"
                disabled={savingGym || !newGymName.trim()}
                className="w-full rounded-xl border border-emerald-500/80 bg-emerald-950/60 px-3 py-2 text-sm font-medium hover:bg-emerald-900 disabled:opacity-60"
              >
                {savingGym ? 'Wird angelegt…' : 'Gym speichern'}
              </button>
            </form>
          </div>
        </section>

        {/* Right: Grades for selected gym */}
        <section className="w-full md:w-1/2 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Grades im Home-Gym
          </h2>

          {!selectedGym && (
            <p className="text-sm text-slate-400">
              Wähle links ein Gym aus oder lege eines an, um Grades zu
              definieren.
            </p>
          )}

          {selectedGym && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {selectedGym.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    Home-Gym:{' '}
                    {selectedGym.is_home ? 'Ja' : 'Noch nicht gesetzt'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleGradingMode}
                  disabled={savingGym}
                  className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300 hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-60"
                >
                  Mode:{' '}
                  {selectedGym.grading_mode === 'specific'
                    ? 'Spezifische Grades'
                    : 'Grade-Bereiche'}{' '}
                  (Toggle)
                </button>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-400">
                  Definiere hier deine Farben/Grades. Jede Zeile kann z.B.
                  &quot;Orange&quot;, &quot;V3&quot; oder &quot;6a&quot; sein.
                </p>

                {selectedGrades.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Noch keine Grades angelegt.
                  </p>
                )}

                <div className="space-y-2">
                  {selectedGrades.map((grade) => (
                    <GradeRow
                      key={grade.id}
                      grade={grade}
                      onSave={handleUpdateGrade}
                      onDelete={handleDeleteGrade}
                    />
                  ))}
                </div>

                {/* Add new grade */}
                <form
                  onSubmit={handleAddGrade}
                  className="mt-3 space-y-2 rounded-xl border border-dashed border-slate-700 p-3"
                >
                  <label className="text-xs font-medium text-slate-300">
                    Neuen Grad hinzufügen
                  </label>
                  <input
                    type="text"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    placeholder="z.B. Orange, V3, 6a..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      Farbe:
                    </span>
                    <select
                      value={newGradeColor}
                      onChange={(e) => setNewGradeColor(e.target.value)}
                      className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                    >
                      {COLOR_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={savingGrade || !newGradeName.trim()}
                    className="w-full rounded-xl border border-emerald-500/80 bg-emerald-950/60 px-3 py-2 text-sm font-medium hover:bg-emerald-900 disabled:opacity-60"
                  >
                    {savingGrade ? 'Wird gespeichert…' : 'Grad speichern'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

type GradeRowProps = {
  grade: GymGradeRow;
  onSave: (grade: GymGradeRow) => void;
  onDelete: (grade: GymGradeRow) => void;
};

function GradeRow({ grade, onSave, onDelete }: GradeRowProps) {
  const [localName, setLocalName] = useState(grade.name);
  const [localColor, setLocalColor] = useState(grade.color);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      await onSave({
        ...grade,
        name: localName,
        color: localColor,
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    setDeleting(true);
    try {
      await onDelete(grade);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
      <div
        className={`h-4 w-4 rounded-full border border-slate-600 ${
          colorToBgClass(localColor)
        }`}
      />
      <input
        type="text"
        value={localName}
        onChange={(e) => {
          setLocalName(e.target.value);
          setDirty(true);
        }}
        className="flex-1 bg-transparent text-sm text-slate-50 focus:outline-none"
      />
      <select
        value={localColor}
        onChange={(e) => {
          setLocalColor(e.target.value);
          setDirty(true);
        }}
        className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
      >
        {COLOR_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSaveClick}
        disabled={!dirty || saving}
        className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-40"
      >
        {saving ? '...' : 'Save'}
      </button>
      <button
        type="button"
        onClick={handleDeleteClick}
        disabled={deleting}
        className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-50"
      >
        {deleting ? '…' : '🗑️'}
      </button>
    </div>
  );
}

function colorToBgClass(color: string): string {
  switch (color) {
    case 'white':
      return 'bg-slate-100';
    case 'black':
      return 'bg-slate-900';
    case 'yellow':
      return 'bg-yellow-400';
    case 'orange':
      return 'bg-orange-500';
    case 'green':
      return 'bg-green-500';
    case 'blue':
      return 'bg-blue-500';
    case 'red':
      return 'bg-red-500';
    case 'purple':
      return 'bg-purple-500';
    case 'pink':
      return 'bg-pink-400';
    default:
      return 'bg-slate-500';
  }
}