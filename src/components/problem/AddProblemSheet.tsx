'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { GymGradeRow } from '@/lib/api';

const TYPES = ['Slab', 'Power', 'Tech', 'Dyno', 'Modern'] as const;

const HOLD_COLORS = [
  { name: 'Black', color: '#000000' },
  { name: 'White', color: '#ffffff' },
  { name: 'Gray', color: '#9ca3af' },
  { name: 'Yellow', color: '#fde047' },
  { name: 'Orange', color: '#fb923c' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Pink', color: '#f472b6' },
  { name: 'Purple', color: '#a78bfa' },
  { name: 'Blue', color: '#60a5fa' },
  { name: 'Green', color: '#86efac' },
  { name: 'Brown', color: '#a16207' },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;

  gymName?: string | null;

  // grades from backend
  homeGrades: GymGradeRow[];
  initialGradeId?: string;

  onSave: (data: {
    title: string;
    gradeId: string;
    holdColor: string;
    type: string; // fake for now
    image: File;
  }) => Promise<void> | void;
};

export function AddProblemSheet({
  open,
  onClose,
  gymName,
  homeGrades,
  initialGradeId,
  onSave,
}: Props) {
  const canAdd = !!gymName && homeGrades.length > 0;

  const [title, setTitle] = React.useState('');
  const [gradeId, setGradeId] = React.useState('');
  const [type, setType] = React.useState<(typeof TYPES)[number]>('Modern'); // fake
  const [holdColor, setHoldColor] = React.useState<(typeof HOLD_COLORS)[number]['name']>('Black');
  const [image, setImage] = React.useState<File | null>(null);

  // avoid objectURL leaks
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!image) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  React.useEffect(() => {
    if (!open) return;

    // defaults when opening
    const firstGrade = homeGrades[0]?.id ?? '';
    setGradeId(initialGradeId ?? firstGrade);
    setTitle('');
    setType('Modern');
    setHoldColor('Black');
    setImage(null);

    // prevent background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, homeGrades, initialGradeId]);

  const valid =
    canAdd &&
    title.trim().length > 0 &&
    gradeId.trim().length > 0 &&
    !!image &&
    holdColor.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white text-black"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            {/* handle */}
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>

            <div className="px-5 pb-8 pt-4 space-y-5">
              {/* header */}
              <div className="text-center">
                <h2 className="text-lg font-semibold">Add a new problem</h2>
                <p className="text-sm text-gray-500">Gym: {gymName ?? '—'}</p>
              </div>

              {/* gate if no grades */}
              {!canAdd && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  You need a Home Gym with grades to add problems.
                </div>
              )}

              {/* photo picker + preview */}
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Photo (required)
                </label>

                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={!canAdd}
                    onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  />

                  <motion.div
                    whileHover={canAdd ? { scale: 1.01 } : undefined}
                    whileTap={canAdd ? { scale: 0.98 } : undefined}
                    className="flex h-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 overflow-hidden"
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                          +
                        </span>
                        Add a photo
                      </div>
                    )}
                  </motion.div>
                </label>
              </div>

              {/* title */}
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give it a name"
                  disabled={!canAdd}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:opacity-50"
                />
              </div>

              {/* grade swatches */}
              <Section title="Grade">
                <div className="flex flex-wrap gap-2">
                  {homeGrades.map((g) => {
                    const selected = gradeId === g.id;
                    return (
                      <motion.button
                        key={g.id}
                        disabled={!canAdd}
                        onClick={() => setGradeId(g.id)}
                        whileHover={canAdd ? { y: -2, scale: 1.03 } : undefined}
                        whileTap={canAdd ? { scale: 0.96 } : undefined}
                        className={[
                          'flex h-20 w-16 flex-col items-center justify-center gap-2 rounded-2xl transition',
                          selected ? 'border-2 border-black bg-white' : 'bg-gray-200',
                          !canAdd ? 'opacity-50 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        <span
                          className="h-6 w-6 rounded-full"
                          style={{ backgroundColor: g.color ?? '#111827' }}
                        />
                        <span className="text-sm font-medium">{g.name}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </Section>

              {/* type segmented slider (one line) */}
              <Section title="Type">
                <div className="relative flex w-full rounded-full bg-gray-200 p-1">
                  {TYPES.map((t) => {
                    const selected = type === t;
                    return (
                      <button
                        key={t}
                        disabled={!canAdd}
                        onClick={() => setType(t)}
                        className="relative z-10 flex-1"
                        type="button"
                      >
                        <motion.div
                          layout
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className={[
                            'flex items-center justify-center rounded-full px-2 py-2 text-sm font-semibold',
                            selected ? 'bg-white text-black shadow-sm' : 'text-gray-700',
                          ].join(' ')}
                        >
                          {t}
                        </motion.div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* hold colors filled swatches (space-saving) */}
              <Section title="Hold Color">
                <div className="flex flex-wrap gap-2">
                  {HOLD_COLORS.map((c) => {
                    const selected = holdColor === c.name;
                    return (
                      <motion.button
                        key={c.name}
                        type="button"
                        disabled={!canAdd}
                        onClick={() => setHoldColor(c.name)}
                        whileHover={canAdd ? { y: -2, scale: 1.03 } : undefined}
                        whileTap={canAdd ? { scale: 0.96 } : undefined}
                        className={[
                          'flex h-14 w-20 items-center justify-center rounded-2xl transition',
                          selected ? 'border-2 border-black' : 'border border-transparent',
                          !canAdd ? 'opacity-50 cursor-not-allowed' : '',
                        ].join(' ')}
                        style={{
                          backgroundColor: c.color,
                          opacity: 0.6, // requested 60% opacity
                        }}
                      >
                        <span className="text-sm font-semibold text-black">{c.name}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </Section>

              {/* save */}
              <div className="flex justify-end pt-1">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  disabled={!valid}
                  className="rounded-full bg-black px-8 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={async () => {
                    if (!image) return;
                    await onSave({
                      title: title.trim(),
                      gradeId,
                      holdColor,
                      type,
                      image,
                    });
                  }}
                >
                  Save problem
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* helpers */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{title}</div>
      {children}
    </div>
  );
}

// ✅ IMPORTANT: use Framer Motion props type (fixes Vercel TS error)
function Chip({
  selected,
  children,
  disabled,
  ...props
}: HTMLMotionProps<'button'> & { selected?: boolean }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1, scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      disabled={disabled}
      className={[
        'rounded-full px-4 py-2 text-sm transition',
        selected ? 'border-2 border-black bg-white' : 'bg-gray-200',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      {...props}
    >
      {children}
    </motion.button>
  );
}
