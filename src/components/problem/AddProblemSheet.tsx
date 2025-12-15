'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GymGradeRow } from '@/lib/api';

const TYPES = ['Slab', 'Power', 'Tech', 'Dyno', 'Modern'];

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
];

type Props = {
  open: boolean;
  onClose: () => void;

  gymName?: string | null;

  // ✅ grades from backend
  homeGrades: GymGradeRow[];

  // optional default selection
  initialGradeId?: string;

  onSave: (data: {
    title: string;
    gradeId: string; // ✅ backend grade id
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
  const [type, setType] = React.useState('Modern'); // fake for now
  const [holdColor, setHoldColor] = React.useState('Black');
  const [image, setImage] = React.useState<File | null>(null);

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
            className="fixed inset-0 z-99 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-100 rounded-t-3xl bg-white text-black"
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

            <div className="px-5 pb-8 pt-4 space-y-6">
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-500"
                >
                  {image ? (
                    // small preview
                    // NOTE: objectURL is fine for preview; can optionally revoke on cleanup
                    <img
                      src={URL.createObjectURL(image)}
                      alt=""
                      className="h-full w-full rounded-xl object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span>Add a photo</span>
                  )}
                </motion.div>
              </label>

              {/* title */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give it a name"
                disabled={!canAdd}
                className="w-full border-b-2 border-black bg-transparent py-2 text-center text-lg focus:outline-none disabled:opacity-50"
              />

              {/* grade (from backend) */}
              <Section title="Grade">
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
                        'flex h-12 w-14 flex-col items-center justify-center gap-1 rounded-2xl transition',
                        selected
                          ? 'border-2 border-black bg-white'
                          : 'bg-gray-200',
                        !canAdd ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {/* color dot */}
                     

                      {/* label */}
                      <span className="text-xs font-small">{g.name}</span>
                    </motion.button>
                  );
                })}
              </Section>

              {/* type (fake) */}
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
                      >
                        <motion.div
                          layout
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          className={[
                            'flex items-center justify-center rounded-full px-3 py-2 text-sm',
                            selected
                              ? 'bg-white text-black shadow'
                              : 'text-gray-700',
                          ].join(' ')}
                        >
                          {t}
                        </motion.div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* hold color */}
             <Section title="Hold Color">
              {HOLD_COLORS.map((c) => {
                const selected = holdColor === c.name;

                return (
                  <motion.button
                    key={c.name}
                    disabled={!canAdd}
                    onClick={() => setHoldColor(c.name)}
                    whileHover={canAdd ? { y: -2, scale: 1.03 } : undefined}
                    whileTap={canAdd ? { scale: 0.96 } : undefined}
                    className={[
                      'flex h-12 w-14 items-center justify-center rounded-2xl transition',
                      selected ? 'border-2 border-black' : 'border border-transparent',
                      !canAdd ? 'opacity-90 cursor-not-allowed' : '',
                    ].join(' ')}
                    style={{
                      backgroundColor: c.color,
                      opacity: 0.8, // ✅ 60% opacity as requested
                    }}
                  >
                    <span className="text-xs font-small text-black">
                      {c.name}
                    </span>
                  </motion.button>
                );
              })}
            </Section>



              {/* save */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={!valid}
                className="ml-auto block rounded-full bg-black px-8 py-3 text-white disabled:opacity-40"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* helpers */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  selected,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
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
