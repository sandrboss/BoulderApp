'use client';

import * as React from 'react';
import type { ProblemRow, ProblemStats } from '@/lib/api';
import { ProblemCard } from '@/components/problem/ProblemCard';

type Props = {
  problems: ProblemRow[];
  statsByProblem: Record<string, ProblemStats>;
  onDelete?: (problemId: string) => void;
  gradeLabelFor: (p: ProblemRow) => string;
  gradeColorFor: (p: ProblemRow) => string | undefined;
  typeLabelFor?: (p: ProblemRow) => string;
  onSelect?: (p: ProblemRow) => void;

  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function normalizeWheel(e: WheelEvent) {
  // deltaMode: 0=pixel, 1=line, 2=page
  const LINE_HEIGHT = 16;
  const PAGE_HEIGHT = 800;

  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= LINE_HEIGHT;
  if (e.deltaMode === 2) dy *= PAGE_HEIGHT;

  // clamp spikes from some devices
  dy = clamp(dy, -180, 180);
  return dy;
}

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
  // Keep index valid if problems change
  React.useEffect(() => {
    if (activeIndex > problems.length - 1) {
      setActiveIndex(Math.max(0, problems.length - 1));
    }
  }, [problems.length, activeIndex, setActiveIndex]);

  const go = React.useCallback(
    (dir: 1 | -1) => {
      if (problems.length === 0) return;
      setActiveIndex((prev) => (prev + dir + problems.length) % problems.length);
    },
    [problems.length, setActiveIndex]
  );

  // ----- Improved input handling (wheel + pointer drag) -----
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  // Wheel smoothing: accumulate small deltas, threshold, and cooldown to avoid “machine-gun scrolling”
  const wheelAccRef = React.useRef(0);
  const wheelCooldownUntilRef = React.useRef(0);

  // Pointer drag (touch + mouse): use pointer events + touch-action none for consistent behavior
  const pointerRef = React.useRef<{
    active: boolean;
    startY: number;
    lastY: number;
    hasMoved: boolean;
  } | null>(null);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    // --- wheel ---
    const WHEEL_THRESHOLD = 70; // higher = less sensitive
    const WHEEL_SENSITIVITY = 0.9; // lower = softer
    const COOLDOWN_MS = 180; // prevents multiple flips per gesture

    const onWheel = (e: WheelEvent) => {
      if (problems.length <= 1) return;

      // IMPORTANT: stops the page from scrolling
      e.preventDefault();

      const now = performance.now();
      if (now < wheelCooldownUntilRef.current) return;

      const dy = normalizeWheel(e) * WHEEL_SENSITIVITY;
      wheelAccRef.current += dy;

      if (Math.abs(wheelAccRef.current) >= WHEEL_THRESHOLD) {
        const dir: 1 | -1 = wheelAccRef.current > 0 ? 1 : -1;
        wheelAccRef.current = 0;
        wheelCooldownUntilRef.current = now + COOLDOWN_MS;
        go(dir);
      }
    };

    // --- pointer drag ---
    const DRAG_THRESHOLD_PX = 44; // swipe threshold

    const onPointerDown = (e: PointerEvent) => {
      if (problems.length <= 1) return;

      // only primary button
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      pointerRef.current = {
        active: true,
        startY: e.clientY,
        lastY: e.clientY,
        hasMoved: false,
      };

      // capture so we keep receiving events even if pointer leaves element
      try {
        (e.target as Element)?.setPointerCapture?.(e.pointerId);
      } catch {}

      // prevent focus/selection quirks
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = pointerRef.current;
      if (!st?.active) return;

      const dy = e.clientY - st.startY;
      st.lastY = e.clientY;
      if (Math.abs(dy) > 6) st.hasMoved = true;

      // Prevent page from scrolling while dragging on touch devices
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = pointerRef.current;
      if (!st?.active) return;

      const dy = e.clientY - st.startY;

      // If it was a real drag/swipe, change card
      if (Math.abs(dy) >= DRAG_THRESHOLD_PX) {
        go(dy < 0 ? 1 : -1); // swipe up -> next
      }

      pointerRef.current = null;
      e.preventDefault();
    };

    const onPointerCancel = () => {
      pointerRef.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp, { passive: false });
    el.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return () => {
      el.removeEventListener('wheel', onWheel as any);
      el.removeEventListener('pointerdown', onPointerDown as any);
      el.removeEventListener('pointermove', onPointerMove as any);
      el.removeEventListener('pointerup', onPointerUp as any);
      el.removeEventListener('pointercancel', onPointerCancel as any);
    };
  }, [go, problems.length]);

  if (problems.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-fg0">
        Noch keine Projekte.
      </div>
    );
  }

  // Show current + next 2 peeking behind
  const visibleCount = Math.min(3, problems.length);
  const visible = Array.from({ length: visibleCount }, (_, k) => problems[(activeIndex + k) % problems.length]);

  return (
    <div
      ref={viewportRef}
      className="relative mx-auto w-full max-w-[340px] select-none"
      style={{
        // Prevent scroll chaining + keep gestures inside
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'auto',
        // Makes pointer/touch drag predictable; we handle vertical gestures ourselves
        touchAction: 'none',
      }}
      aria-label="Problem Stack"
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
                  onDelete={onDelete && depth === 0 ? () => onDelete(p.id) : undefined}
                />
              </div>
            );
          })}
      </div>

      <div className="sr-only">Active: {activeIndex + 1}</div>
    </div>
  );
}
