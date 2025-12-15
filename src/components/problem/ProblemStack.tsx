'use client';

import * as React from 'react';
import type { ProblemRow, ProblemStats } from '@/lib/api';
import { ProblemCard } from '@/components/problem/ProblemCard';
import { boulderColorToStyle } from '@/lib/uiStyles';

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

  // clamp spikes
  dy = clamp(dy, -180, 180);
  return dy;
}

type AnimState =
  | null
  | {
      fromIndex: number;
      toIndex: number;
      dir: 1 | -1;
      step: 0 | 1; // 0 = initial (no transition), 1 = transitioned
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
  // Keep index valid if problems change
  React.useEffect(() => {
    if (activeIndex > problems.length - 1) {
      setActiveIndex(Math.max(0, problems.length - 1));
    }
  }, [problems.length, activeIndex, setActiveIndex]);

  // --- Animation config ---
  const ANIM_MS = 270;
  const SHIFT_PX = 80;

  // Peeking polish
  const PEEK_SHIFT_PX = 14;
  const PEEK_SCALE_BOOST = 0.04;

  const [anim, setAnim] = React.useState<AnimState>(null);
  const animTimerRef = React.useRef<number | null>(null);

  // Wheel smoothing + cooldown
  const wheelAccRef = React.useRef(0);
  const wheelCooldownUntilRef = React.useRef(0);

  // Pointer drag (touch + mouse)
  const pointerRef = React.useRef<{ active: boolean; startY: number } | null>(
    null
  );

  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const computeNextIndex = React.useCallback(
    (index: number, dir: 1 | -1) => {
      if (problems.length === 0) return 0;
      return (index + dir + problems.length) % problems.length;
    },
    [problems.length]
  );

  const clearAnimTimer = React.useCallback(() => {
    if (animTimerRef.current != null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => clearAnimTimer();
  }, [clearAnimTimer]);

  const triggerNav = React.useCallback(
    (dir: 1 | -1) => {
      if (problems.length <= 1) return;
      if (anim) return;

      const next = computeNextIndex(activeIndex, dir);

      clearAnimTimer();

      // Step 0: render initial positions (no transition)
      setAnim({ fromIndex: activeIndex, toIndex: next, dir, step: 0 });

      animTimerRef.current = window.setTimeout(() => {
        setActiveIndex(next);
        setAnim(null);
        animTimerRef.current = null;
      }, ANIM_MS);
    },
    [ANIM_MS, activeIndex, anim, clearAnimTimer, computeNextIndex, problems.length, setActiveIndex]
  );

  // Guarantee the transition by flipping to step=1 on the next frame
  React.useLayoutEffect(() => {
    if (!anim) return;
    if (anim.step !== 0) return;

    const id = requestAnimationFrame(() => {
      setAnim((prev) => (prev ? { ...prev, step: 1 } : prev));
    });

    return () => cancelAnimationFrame(id);
  }, [anim]);

  // Attach wheel + pointer handlers
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const WHEEL_THRESHOLD = 70;
    const WHEEL_SENSITIVITY = 0.9;
    const COOLDOWN_MS = 180;

    const onWheel = (e: WheelEvent) => {
      if (problems.length <= 1) return;

      e.preventDefault();

      const now = performance.now();
      if (now < wheelCooldownUntilRef.current) return;

      const dy = normalizeWheel(e) * WHEEL_SENSITIVITY;
      wheelAccRef.current += dy;

      if (Math.abs(wheelAccRef.current) >= WHEEL_THRESHOLD) {
        const dir: 1 | -1 = wheelAccRef.current > 0 ? 1 : -1;
        wheelAccRef.current = 0;
        wheelCooldownUntilRef.current = now + COOLDOWN_MS;
        triggerNav(dir);
      }
    };

    const DRAG_THRESHOLD_PX = 44;

    const onPointerDown = (e: PointerEvent) => {
      if (problems.length <= 1) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      pointerRef.current = { active: true, startY: e.clientY };
      try {
        (e.target as Element)?.setPointerCapture?.(e.pointerId);
      } catch {}

      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerRef.current?.active) return;
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = pointerRef.current;
      if (!st?.active) return;

      const dy = e.clientY - st.startY;
      if (Math.abs(dy) >= DRAG_THRESHOLD_PX) {
        triggerNav(dy < 0 ? 1 : -1); // swipe up => next
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
  }, [problems.length, triggerNav]);

  if (problems.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-fg0">
        Noch keine Projekte.
      </div>
    );
  }

  const getCardStats = (p: ProblemRow) => {
    const s = statsByProblem[p.id];
    return {
      attempts: s?.attempts ?? 0,
      bestReach: s?.lastOutcome ?? null,
    };
  };

  const isAnimating = !!anim;
  const dir = anim?.dir ?? 1;
  const step = anim?.step ?? 0;


  // For the indicator highlight: feel responsive during animation
  const indicatorIndex = anim ? anim.toIndex : activeIndex;

  // Peek stack uses the outgoing (fromIndex) while animating
  const topIndexForPeeks = isAnimating ? anim!.fromIndex : activeIndex;

  const visibleCount = Math.min(3, problems.length);
  const peek = Array.from({ length: visibleCount }, (_, k) => problems[(topIndexForPeeks + k) % problems.length]);

  const outY = step === 1 ? (dir === 1 ? -SHIFT_PX : SHIFT_PX) : 0;
  const inStartY = dir === 1 ? SHIFT_PX : -SHIFT_PX;
  const inY = isAnimating ? 3 : 3;
  const inScale = isAnimating ? 0.97 : 1;


  const outOpacity = step === 1 ? 0 : 1;
  const inOpacity = step === 1 ? 1 : 0;

  const peekShift = step === 1 ? (dir === 1 ? -PEEK_SHIFT_PX : PEEK_SHIFT_PX) : 0;
  const peekScaleBoost = step === 1 ? PEEK_SCALE_BOOST : 0;

  const transition = `transform ${ANIM_MS}ms ease, opacity ${ANIM_MS}ms ease`;

  const outgoing = problems[anim?.fromIndex ?? activeIndex];
  const incoming = problems[anim?.toIndex ?? activeIndex];

  return (
    <>
      {/* Sticky / fixed right-side indicator */}
      <div
        className="fixed right-1 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-end gap-1"
        style={{ pointerEvents: 'none' }} // purely visual
        aria-hidden="true"
      >
        {problems.map((p, i) => {
          const isActive = i === indicatorIndex;

          // Use your existing color styling helper.
          // It returns style props used on your cards; we can reuse it here.
          const colorStyle = boulderColorToStyle(p.boulder_color) as React.CSSProperties;

          return (
            <div
              key={`dot-${p.id}`}
              className={[
                'transition-all duration-200',
                isActive ? 'shadow-sm' : 'opacity-90',
              ].join(' ')}
              style={{
                width: isActive ? 8 : 4,
                height: isActive ? 11 : 11,
                borderTopLeftRadius: 3,
                borderBottomLeftRadius: 3,
                borderTopRightRadius: 3,
                borderBottomRightRadius: 3,
                backgroundColor:
                  (colorStyle as any)?.backgroundColor ??
                  (colorStyle as any)?.color ??
                  '#999',
              }}
            />
          );
        })}
      </div>

      {/* Stack */}
      <div
        ref={viewportRef}
        className="relative mx-auto w-full max-w-[340px] select-none"
        style={{
          overscrollBehavior: 'contain',
          touchAction: 'none',
        }}
        aria-label="Problem Stack"
      >
        <div className="relative h-[520px]">
          {/* Peek cards behind (animated shift) */}
          {peek
            .slice(1)
            .slice()
            .reverse()
            .map((p, idxFromBack) => {
              const depth = (visibleCount - 1) - idxFromBack; // 1..2
              const baseTopOffset = depth * 32;
              const topOffset = baseTopOffset + peekShift;
              const baseScale = 1 - depth * 0.12;
              const scale = baseScale + peekScaleBoost;
              const opacity = 1 - depth * 0.2;

              return (
                <div
                  key={`peek-${p.id}`}
                  style={{
                    transition: isAnimating ? transition : undefined,
                    transform: `translateY(${topOffset}px) scale(${scale})`,
                    opacity,
                    zIndex: 10 - depth,
                  }}
                  className="absolute inset-0"
                >
                  <ProblemCard
                    problem={p}
                    gradeLabel={gradeLabelFor(p)}
                    gradeColor={gradeColorFor(p)}
                    typeLabel={typeLabelFor?.(p) ?? 'overhang'}
                    isActive={false}
                    stats={getCardStats(p)}
                  />
                </div>
              );
            })}

          {/* Top cards */}
          {/* --- Top cards (iOS-safe: top card stays mounted, delete fades) --- */}
{isAnimating && (
  <div
    className="absolute inset-0"
    style={{
      transition,
      transform: `translateY(${outY}px) scale(1)`,
      opacity: outOpacity,
      zIndex: 22,
      willChange: 'transform, opacity',
    }}
  >
    <ProblemCard
      problem={outgoing}
      gradeLabel={gradeLabelFor(outgoing)}
      gradeColor={gradeColorFor(outgoing)}
      typeLabel={typeLabelFor?.(outgoing) ?? 'overhang'}
      isActive={true}
      stats={getCardStats(outgoing)}
      onDelete={onDelete ? () => onDelete(outgoing.id) : undefined}
      deleteOpacity={outOpacity}
    />
  </div>
)}

<div
  className="absolute inset-0"
  style={{
    transition: isAnimating ? transition : undefined,
   // transform: isAnimating ? `translateY(${inY}px) scale(1)` : 'translateY(0px) scale(1)', old one
    transform: `translateY(${inY}px) scale(${inScale})`,
    opacity: 1, // 👈 no fade on incoming
    zIndex: 21, // 👈 incoming BELOW
    willChange: isAnimating ? 'transform, opacity' : undefined,
  }}
>
  <ProblemCard
    problem={isAnimating ? incoming : problems[activeIndex]}
    gradeLabel={gradeLabelFor(isAnimating ? incoming : problems[activeIndex])}
    gradeColor={gradeColorFor(isAnimating ? incoming : problems[activeIndex])}
    typeLabel={
      typeLabelFor?.(isAnimating ? incoming : problems[activeIndex]) ?? 'overhang'
    }
    isActive={true}
    stats={getCardStats(isAnimating ? incoming : problems[activeIndex])}
    onDelete={
      onDelete
        ? () => onDelete((isAnimating ? incoming : problems[activeIndex]).id)
        : undefined
    }
    deleteOpacity={isAnimating ? inOpacity : 1}
  />
</div>

        </div>

        <div className="sr-only">Active: {activeIndex + 1}</div>
      </div>
    </>
  );
}
