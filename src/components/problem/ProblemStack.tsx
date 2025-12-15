'use client';

import * as React from 'react';
import {
  motion,
  AnimatePresence,
  motionValue,
  useTransform,
} from 'framer-motion';
import type { ProblemRow, ProblemStats, Outcome } from '@/lib/api';
import { ProblemCard } from '@/components/problem/ProblemCard';
import { boulderColorToStyle } from '@/lib/uiStyles';

type Props = {
  problems: ProblemRow[];
  statsByProblem: Record<string, ProblemStats>;
  gradeLabelFor: (p: ProblemRow) => string;
  gradeColorFor: (p: ProblemRow) => string | undefined;
  typeLabelFor?: (p: ProblemRow) => string;
  onDelete?: (id: string) => void;

  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
};

function toStats(
  s?: ProblemStats
): { attempts: number; bestReach: Outcome | null } {
  return {
    attempts: s?.attempts ?? 0,
    bestReach: (s as any)?.lastOutcome ?? null,
  };
}

const DRAG_THRESHOLD = 120;

// How much the under-cards “peek out”
const PEEK_MIDDLE = 22;
const PEEK_BOTTOM = 38;

export function ProblemStack({
  problems,
  statsByProblem,
  gradeLabelFor,
  gradeColorFor,
  typeLabelFor,
  onDelete,
  activeIndex,
  setActiveIndex,
}: Props) {
  if (problems.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center text-sm">
        Noch keine Projekte.
      </div>
    );
  }

  const idx = (i: number) => (i + problems.length) % problems.length;

  const top = problems[activeIndex];
  const middle = problems[idx(activeIndex + 1)];
  const bottom = problems[idx(activeIndex + 2)];

  // ✅ Fresh MotionValue per top card => prevents "new card jumps"
  const y = React.useMemo(() => motionValue(0), [top.id]);

  // Top card subtle physical scale while dragging
  const topScale = useTransform(y, [-200, 0, 200], [1.02, 1, 1.02]);

  // Middle card: at rest it’s lower (peeking). As you drag far, it moves into place.
  const middleY = useTransform(y, [-200, 0, 200], [0, PEEK_MIDDLE, 0]);
  const middleScale = useTransform(y, [-200, 0, 200], [1, 0.95, 1]);

  // Optional tiny response for bottom card (keeps it calm, still feels alive)
  const bottomY = useTransform(y, [-200, 0, 200], [PEEK_BOTTOM - 10, PEEK_BOTTOM, PEEK_BOTTOM - 10]);
  const bottomScale = useTransform(y, [-200, 0, 200], [0.92, 0.9, 0.92]);

  const dragDirRef = React.useRef<1 | -1>(1);

  const handleDragEnd = (_: any, info: { offset: { y: number } }) => {
    if (info.offset.y < -DRAG_THRESHOLD) {
      dragDirRef.current = 1; // up => next
      setActiveIndex((i) => idx(i + 1));
    } else if (info.offset.y > DRAG_THRESHOLD) {
      dragDirRef.current = -1; // down => prev
      setActiveIndex((i) => idx(i - 1));
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none">
      {/* stack area */}
      <div className="relative h-[520px] overflow-visible">
        {/* RIGHT SIDE INDICATOR (fixed to viewport right) */}
        <div className="pointer-events-none fixed left-0 top-1/2 z-[60] -translate-y-[calc(50%+32px)]">
          <div
            className="flex flex-col items-start gap-1"
            style={{
              borderTopLeftRadius: 12,
              borderBottomLeftRadius: 12,
            }}
          >
            {problems.map((p, i) => {
              const isActive = i === activeIndex;

              // Sizes: active is wider/taller, others small
              const w = isActive ? 10 : 6;
              const h = isActive ? 17 : 17;

              return (
                <div
                  key={p.id}
                  style={{
                    width: w,
                    height: h,
                    opacity: isActive ? 1 : 0.75,
                    ...boulderColorToStyle(p.boulder_color),

                    // right aligned: grows to the left
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  }}
                />
              );
            })}
          </div>
        </div>


        {/* BOTTOM CARD (peeking) */}
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            y: bottomY,
            scale: bottomScale,
            opacity: 0.85,
          }}
        >
          <ProblemCard
            problem={bottom}
            gradeLabel={gradeLabelFor(bottom)}
            gradeColor={gradeColorFor(bottom)}
            typeLabel={typeLabelFor?.(bottom) ?? 'overhang'}
            stats={toStats(statsByProblem[bottom.id])}
          />
        </motion.div>

        {/* MIDDLE CARD (peeking, scales up as you drag) */}
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            y: middleY,
            scale: middleScale,
            opacity: 0.92,
          }}
        >
          <ProblemCard
            problem={middle}
            gradeLabel={gradeLabelFor(middle)}
            gradeColor={gradeColorFor(middle)}
            typeLabel={typeLabelFor?.(middle) ?? 'overhang'}
            stats={toStats(statsByProblem[middle.id])}
          />
        </motion.div>

        {/* TOP CARD (DRAGGABLE) */}
        <AnimatePresence initial={false}>
          <motion.div
            key={top.id}
            className="absolute inset-0 z-20"
            drag="y"
            dragListener
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            style={{
              y,
              scale: topScale,
              touchAction: 'none',
            }}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 1 }}
            exit={{
              y: dragDirRef.current === 1 ? -170 : 170,
              opacity: 0,
              scale: 1.02,
              transition: {
                duration: 0.28,
                ease: [0.25, 0.8, 0.25, 1],
              },
            }}
            transition={{
              type: 'spring',
              stiffness: 220,
              damping: 30,
            }}
          >
            <ProblemCard
              problem={top}
              gradeLabel={gradeLabelFor(top)}
              gradeColor={gradeColorFor(top)}
              typeLabel={typeLabelFor?.(top) ?? 'overhang'}
              stats={toStats(statsByProblem[top.id])}
              onDelete={onDelete ? () => onDelete(top.id) : undefined}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* expose active index for screen readers */}
      <div className="sr-only">Active: {activeIndex + 1}</div>
    </div>
  );
}
