'use client';

import * as React from 'react';
import type { ProblemRow, Outcome, ProblemStats } from '@/lib/api';
import { ProblemCard } from '@/components/problem/ProblemCard';


type Props = {
  problems: ProblemRow[];
  statsByProblem: Record<string, ProblemStats>;
  onDelete?: (problemId: string) => void;
  gradeLabelFor: (p: ProblemRow) => string;
  gradeColorFor: (p: ProblemRow) => string | undefined;
  typeLabelFor?: (p: ProblemRow) => string;
  onSelect?: (p: ProblemRow) => void; // optional

  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
};

export function ProblemStack({
  problems,
  onDelete,
  statsByProblem,
  gradeLabelFor,
  gradeColorFor,
  typeLabelFor,
  activeIndex, 
  setActiveIndex,
}: Props) {
  //const [activeIndex, setActiveIndex] = React.useState(0);

  // Keep index valid if problems change
  React.useEffect(() => {
    if (activeIndex > problems.length - 1) setActiveIndex(Math.max(0, problems.length - 1));
  }, [problems.length, activeIndex]);

  const go = (dir: 1 | -1) => {
  if (problems.length === 0) return;
  setActiveIndex((prev) => (prev + dir + problems.length) % problems.length);
};


  // Wheel / trackpad support (desktop)
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (Math.abs(e.deltaY) < 8) return;
    e.preventDefault();
    go(e.deltaY > 0 ? 1 : -1);
  };

  // Touch support (mobile)
  const touchRef = React.useRef<{ y: number } | null>(null);
  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchRef.current = { y: e.touches[0].clientY };
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const start = touchRef.current?.y;
    if (start == null) return;
    const end = e.changedTouches[0].clientY;
    const dy = end - start;
    if (Math.abs(dy) < 40) return; // swipe threshold
    go(dy < 0 ? 1 : -1); // swipe up = next
    touchRef.current = null;
  };

  if (problems.length === 0) {
    return <div className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-fg0">Noch keine Projekte.</div>;
  }

  // Show current + next 2 peeking behind
  const visibleCount = Math.min(3, problems.length);
  const visible = Array.from({ length: visibleCount }, (_, k) => problems[(activeIndex + k) % problems.length]);

  return (
    <div
      className="relative mx-auto w-full max-w-[340px] select-none"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative h-[520px]">
        {visible
        .slice()
        .reverse()
        .map((p, idxFromBack) => {
            const depth = visibleCount - 1 - idxFromBack;
            const topOffset = depth * 32;
            const scale = 1 - depth * 0.12;
            const opacity = 1 - depth * 0.2;

            const s = statsByProblem[p.id];
           
            const cardStats = {
            attempts: s?.attempts ?? 0,
            bestReach: s?.lastOutcome ?? null,
            };

            return (
            <div
                key={p.id}
                className="absolute inset-0 ui-transition"
                style={{
                transform: `translateY(${topOffset}px) scale(${scale})`,
                opacity,
                zIndex: 10 - depth,
                }}
            >
                <ProblemCard
                problem={p}
                gradeLabel={gradeLabelFor(p)}
                gradeColor={gradeColorFor(p)}
                typeLabel={typeLabelFor?.(p) ?? 'overhang'}
                isActive={depth === 0}
                stats={cardStats}
                onDelete={
                    onDelete && depth === 0
                    ? () => onDelete(p.id)
                    : undefined
                }
                />

            </div>
            );
        })}

      </div>

     
      {/* expose active index via data attribute if you want */}
      <div className="sr-only">Active: {activeIndex + 1}</div>
    </div>
  );
}
