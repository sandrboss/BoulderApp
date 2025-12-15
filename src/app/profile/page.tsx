'use client';

import * as React from 'react';
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
import { AnimatePresence, motion } from 'framer-motion';

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
] as const;

function colorToHex(color: string) {
  switch (color) {
    case 'white':
      return '#ffffff';
    case 'black':
      return '#0b0b0c';
    case 'yellow':
      return '#facc15';
    case 'orange':
      return '#fb923c';
    case 'green':
      return '#22c55e';
    case 'blue':
      return '#3b82f6';
    case 'red':
      return '#ef4444';
    case 'purple':
      return '#a78bfa';
    case 'pink':
      return '#f472b6';
    default:
      return '#94a3b8';
  }
}

type SheetMode =
  | { kind: 'addGym' }
  | { kind: 'addGrade' }
  | { kind: 'editGrade'; grade: GymGradeRow };

export default function ProfilePage() {
  const [gyms, setGyms] = React.useState<GymRow[]>([]);
  const [gradesByGym, setGradesByGym] = React.useState<Record<string, GymGradeRow[]>>({});
  const [selectedGymId, setSelectedGymId] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [sheet, setSheet] = React.useState<SheetMode | null>(null);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { gyms, gradesByGym } = await getGymsAndGrades();
        setGyms(gyms);
        setGradesByGym(gradesByGym);

        if (gyms.length > 0) {
          const home = gyms.find((g) => g.is_home);
          setSelectedGymId(home?.id ?? gyms[0].id);
        } else {
          setSelectedGymId(null);
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
  const selectedGrades = (selectedGym && gradesByGym[selectedGym.id]) || [];

  const handleSetHomeGym = async (gymId: string) => {
    setBusy(true);
    setError(null);
    try {
      await setHomeGym(gymId);
      setGyms((prev) => prev.map((g) => ({ ...g, is_home: g.id === gymId })));
      setSelectedGymId(gymId);
    } catch (err: any) {
      console.error(err);
      setError('Home-Gym konnte nicht gesetzt werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleGradingMode = async () => {
    if (!selectedGym) return;
    const nextMode = selectedGym.grading_mode === 'specific' ? 'ranges' : 'specific';
    setBusy(true);
    setError(null);
    try {
      await updateGymGradingMode(selectedGym.id, nextMode);
      setGyms((prev) =>
        prev.map((g) => (g.id === selectedGym.id ? { ...g, grading_mode: nextMode } : g))
      );
    } catch (err: any) {
      console.error(err);
      setError('Grading-Mode konnte nicht aktualisiert werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGym = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const gym = await createGym(name.trim());
      setGyms((prev) => [...prev, gym]);
      setSelectedGymId(gym.id);
      setSheet(null);
    } catch (err: any) {
      console.error(err);
      setError('Gym konnte nicht angelegt werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGrade = async (payload: { name: string; color: string }) => {
    if (!selectedGym) return;
    setBusy(true);
    setError(null);
    try {
      const grade = await createGymGrade(selectedGym.id, payload.name.trim(), payload.color);
      setGradesByGym((prev) => ({
        ...prev,
        [selectedGym.id]: [...(prev[selectedGym.id] ?? []), grade],
      }));
      setSheet(null);
    } catch (err: any) {
      console.error(err);
      setError('Grad konnte nicht angelegt werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateGrade = async (gradeId: string, name: string, color: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateGymGrade(gradeId, name.trim(), color);
      setGradesByGym((prev) => {
        const list = prev[updated.gym_id] ?? [];
        return {
          ...prev,
          [updated.gym_id]: list.map((g) => (g.id === updated.id ? updated : g)),
        };
      });
      setSheet(null);
    } catch (err: any) {
      console.error(err);
      setError('Grad konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGrade = async (grade: GymGradeRow) => {
    setBusy(true);
    setError(null);
    try {
      await deleteGymGrade(grade.id);
      setGradesByGym((prev) => {
        const list = prev[grade.gym_id] ?? [];
        return { ...prev, [grade.gym_id]: list.filter((g) => g.id !== grade.id) };
      });
      setSheet(null);
    } catch (err: any) {
      console.error(err);
      setError('Grad konnte nicht gelöscht werden.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg">
        <p>Profil wird geladen…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen app-pattern text-fg p-4">
      <div className="mx-auto w-full max-w-sm px-3 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Profil</h1>
            <p className="mt-1 text-sm text-fg0">Home Gym & Grades für Claimb</p>
          </div>

          <button
            type="button"
            onClick={() => setSheet({ kind: 'addGym' })}
            className="shrink-0 rounded-full bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50"
            aria-label="Gym hinzufügen"
            title="Gym hinzufügen"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 8H0V6H6V0H8V6H14V8H8V14H6V8Z" fill="black"/>
            </svg>
          </button>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        {/* Gyms */}
        <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold tracking-wide text-fg/60 uppercase">Gyms</div>
              <div className="text-sm font-semibold">Wähle dein Home Gym</div>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">
              {gyms.length} {gyms.length === 1 ? 'Gym' : 'Gyms'}
            </span>
          </div>

          {gyms.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white/70 p-4 text-sm text-fg0">
              Du hast noch keine Gyms angelegt. Erstelle zuerst dein Home-Gym.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {gyms.map((g) => {
                const active = g.id === selectedGymId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGymId(g.id)}
                    className={[
                      'ui-transition rounded-full border px-3 py-2 text-sm font-semibold',
                      active ? 'border-emerald-500 bg-emerald-50 text-slate-900' : 'border-border bg-white text-slate-900 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="inline-flex items-center gap-2">
                      {g.name}
                      {g.is_home && (
                        <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Home
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedGym && (
            <div className="flex items-center justify-between pt-2 border-t border-black/10">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSetHomeGym(selectedGym.id)}
                className="rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                Als Home setzen
              </button>

              {/* Mode toggle as compact segmented */}
              <div className="rounded-full bg-black/5 p-1 flex">
                {(['specific', 'ranges'] as const).map((m) => {
                  const active = selectedGym.grading_mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!active) void handleToggleGradingMode();
                      }}
                      className={[
                        'rounded-full px-3 py-1 text-[11px] font-semibold ui-transition',
                        active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900',
                      ].join(' ')}
                    >
                      {m === 'specific' ? 'Specific' : 'Ranges'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Grades */}
        <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold tracking-wide text-fg/60 uppercase">Grades</div>
              <div className="text-sm font-semibold">
                {selectedGym ? selectedGym.name : 'Kein Gym ausgewählt'}
              </div>
              <div className="text-xs text-fg0">
                Tippe einen Grad zum Bearbeiten. „+“ zum Hinzufügen.
              </div>
            </div>

            <button
              type="button"
              disabled={!selectedGym}
              onClick={() => setSheet({ kind: 'addGrade' })}
              className="rounded-full bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              aria-label="Grad hinzufügen"
              title="Grad hinzufügen"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8H0V6H6V0H8V6H14V8H8V14H6V8Z" fill="black"/>
              </svg>
            </button>
          </div>

          {!selectedGym ? (
            <div className="rounded-2xl border border-border bg-white/70 p-4 text-sm text-fg0">
              Wähle zuerst ein Gym aus.
            </div>
          ) : selectedGrades.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white/70 p-4 text-sm text-fg0">
              Noch keine Grades. Lege deine Farben/Level an.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedGrades.map((g) => (
                <GradeSwatch
                  key={g.id}
                  name={g.name}
                  color={colorToHex(g.color)}
                  onClick={() => setSheet({ kind: 'editGrade', grade: g })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bottom sheets */}
      <AddGymSheet
        open={sheet?.kind === 'addGym'}
        busy={busy}
        onClose={() => setSheet(null)}
        onCreate={handleCreateGym}
      />

      <AddEditGradeSheet
        open={sheet?.kind === 'addGrade' || sheet?.kind === 'editGrade'}
        busy={busy}
        mode={sheet?.kind === 'editGrade' ? 'edit' : 'add'}
        grade={sheet?.kind === 'editGrade' ? sheet.grade : null}
        onClose={() => setSheet(null)}
        onCreate={handleCreateGrade}
        onUpdate={handleUpdateGrade}
        onDelete={handleDeleteGrade}
        disabled={!selectedGym}
      />
    </main>
  );
}

/* ---------------- UI Components ---------------- */

function GradeSwatch({
  name,
  color,
  onClick,
}: {
  name: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-transition flex h-20 w-16 flex-col items-center justify-center gap-2 rounded-2xl bg-white border border-border hover:bg-slate-50 active:scale-[0.98]"
    >
      <span className="h-6 w-6 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm font-medium text-slate-900">{name}</span>
    </button>
  );
}

/* ---------- Sheet base ---------- */

function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Close"
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white text-slate-900"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-black/20" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Add Gym Sheet ---------- */

function AddGymSheet({
  open,
  onClose,
  onCreate,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    if (open) setName('');
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-7 pt-4 space-y-4">
        <div className="text-center">
          <div className="text-lg font-semibold">Neues Gym</div>
          <div className="text-sm text-slate-500">Füge dein Gym hinzu</div>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Beta Boulders, Escaladrome…"
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
        />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onCreate(name)}
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Speichern…' : 'Gym speichern'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Add/Edit Grade Sheet ---------- */

function AddEditGradeSheet({
  open,
  onClose,
  busy,
  mode,
  grade,
  onCreate,
  onUpdate,
  onDelete,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  mode: 'add' | 'edit';
  grade: GymGradeRow | null;
  onCreate: (payload: { name: string; color: string }) => void;
  onUpdate: (gradeId: string, name: string, color: string) => void;
  onDelete: (grade: GymGradeRow) => void;
  disabled: boolean;
}) {
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState<(typeof COLOR_OPTIONS)[number]>('orange');

  React.useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && grade) {
      setName(grade.name);
      setColor((grade.color as any) ?? 'orange');
    } else {
      setName('');
      setColor('orange');
    }
  }, [open, mode, grade]);

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-7 pt-4 space-y-4">
        <div className="text-center">
          <div className="text-lg font-semibold">
            {mode === 'edit' ? 'Grad bearbeiten' : 'Neuer Grad'}
          </div>
          <div className="text-sm text-slate-500">
            {mode === 'edit' ? 'Name & Farbe anpassen' : 'Definiere einen neuen Grad'}
          </div>
        </div>

        {disabled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Wähle zuerst ein Gym aus.
          </div>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='z.B. "Orange", "V3", "6a"'
          disabled={disabled}
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:opacity-50"
        />

        {/* Color swatches */}
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Farbe</div>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => {
              const active = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={disabled}
                  onClick={() => setColor(c)}
                  className={[
                    'ui-transition h-12 w-12 rounded-2xl border',
                    active ? 'border-black' : 'border-border',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]',
                  ].join(' ')}
                  style={{ backgroundColor: colorToHex(c) }}
                  aria-label={c}
                  title={c}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {mode === 'edit' && grade ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(grade)}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50"
            >
              Löschen
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            disabled={busy || disabled || !name.trim()}
            onClick={() => {
              if (mode === 'edit' && grade) {
                onUpdate(grade.id, name, color);
              } else {
                onCreate({ name, color });
              }
            }}
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
