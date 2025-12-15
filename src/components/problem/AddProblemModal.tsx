'use client';

import * as React from 'react';
import type { GymRow, GymGradeRow } from '@/lib/api';
import { boulderColorToStyle } from '@/lib/uiStyles';

type Props = {
  open: boolean;
  onClose: () => void;

  homeGym: GymRow | null;
  homeGrades: GymGradeRow[];

  // initial selection (optional)
  initialGradeId?: string;

  // submit payload
  onSubmit: (payload: {
    gradeId: string;
    title: string;
    boulderColor: string;
    photo: File;
  }) => Promise<void> | void;

  submitting?: boolean;
  error?: string | null;
};

const HOLD_COLORS: { value: string; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'gray', label: 'Gray' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Purple' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'brown', label: 'Brown' },
];

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'ui-transition rounded-xl border px-3 py-2 text-sm font-semibold',
        'active:scale-[0.98]',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50',
        active
          ? 'border-emerald-500 bg-emerald-50 text-slate-900'
          : 'border-border bg-white text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function AddProblemModal({
  open,
  onClose,
  homeGym,
  homeGrades,
  initialGradeId,
  onSubmit,
  submitting,
  error,
}: Props) {
  const canAdd = !!homeGym && homeGrades.length > 0;

  const [gradeId, setGradeId] = React.useState<string>(initialGradeId ?? '');
  const [title, setTitle] = React.useState<string>('');
  const [boulderColor, setBoulderColor] = React.useState<string>('orange');
  const [photo, setPhoto] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // Initialize defaults on open
    setGradeId((prev) => prev || initialGradeId || homeGrades[0]?.id || '');
    setTitle('');
    setBoulderColor('orange');
    setPhoto(null);
  }, [open, initialGradeId, homeGrades]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    // Prevent background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const isValid =
    canAdd &&
    gradeId.trim().length > 0 &&
    title.trim().length > 0 &&
    boulderColor.trim().length > 0 &&
    !!photo;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Neues Problem
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {homeGym ? `Gym: ${homeGym.name ?? 'Home Gym'}` : 'Kein Home-Gym gesetzt'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-2 py-1 text-sm hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          {/* Gate: no gym => no adding */}
          {!canAdd && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Du kannst erst Probleme hinzufügen, wenn ein <b>Home-Gym</b> mit{' '}
              <b>Grades</b> eingerichtet ist.
            </div>
          )}

          <form
            className="mt-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!isValid || !photo) return;
              await onSubmit({
                gradeId,
                title: title.trim(),
                boulderColor,
                photo,
              });
              onClose();
            }}
          >
            {/* Grade chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Grad
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {homeGrades.map((g) => (
                  <Chip
                    key={g.id}
                    disabled={!canAdd}
                    active={gradeId === g.id}
                    onClick={() => setGradeId(g.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: g.color ?? '#111827' }}
                      />
                      {g.name}
                    </span>
                  </Chip>
                ))}
              </div>
            </div>

            {/* Title required */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Titel <span className="text-rose-600">*</span>
              </label>
              <input
                disabled={!canAdd}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Sloper links / Dach rechts / Wand 3"
                className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:opacity-60"
              />
            </div>

            {/* Hold color chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Hold-Farbe
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {HOLD_COLORS.map((c) => (
                  <Chip
                    key={c.value}
                    disabled={!canAdd}
                    active={boulderColor === c.value}
                    onClick={() => setBoulderColor(c.value)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-black/10"
                        style={boulderColorToStyle(c.value)}
                      />
                      {c.label}
                    </span>
                  </Chip>
                ))}
              </div>
            </div>

            {/* Image required (big custom button) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Foto <span className="text-rose-600">*</span>
              </label>

              <input
                id="problem-photo"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={!canAdd}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPhoto(f);
                }}
              />

              <label
                htmlFor="problem-photo"
                className={[
                  'mt-2 flex cursor-pointer items-center justify-center gap-2',
                  'rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5',
                  'ui-transition hover:bg-slate-100 active:scale-[0.99]',
                  !canAdd ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm">
                  <svg width="18" height="18" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 8H0V6H6V0H8V6H14V8H8V14H6V8Z" fill="black"/>
                  </svg>
                </span>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-900">
                    Foto hinzufügen
                  </div>
                  <div className="text-xs text-slate-500">
                    Tippe hier, um ein Foto zu machen oder auszuwählen
                  </div>
                </div>
              </label>

              {photo && (
                <div className="mt-2 text-xs text-slate-600">
                  Ausgewählt: <span className="font-semibold">{photo.name}</span>
                </div>
              )}
            </div>

            {/* Errors */}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || !!submitting}
              className="w-full rounded-2xl border border-emerald-500/80 bg-emerald-950/70 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              {submitting ? 'Wird gespeichert…' : 'Problem speichern'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
