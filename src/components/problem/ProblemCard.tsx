import * as React from 'react';
import type { ProblemRow, Outcome } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { boulderColorToStyle } from '@/lib/uiStyles';

type Props = {
  problem: ProblemRow;
  gradeColor?: string;
  isActive?: boolean;
  stats: {
    attempts: number;
    bestReach: Outcome | null;
  };
  onSelect?: () => void;
  onLogAttempt?: (outcome: Outcome) => void;
  onDelete?: () => void;
};

const outcomeLabel: Record<Outcome, string> = {
  start: 'Start',
  crux: 'Crux',
  almost: 'Fast Top',
  sent: 'Top 🎉',
};

export function ProblemCard({
  problem,
  gradeColor,
  isActive,
  stats,
  onSelect,
  onLogAttempt,
  onDelete,
}: Props) {
  return (
    <div
      style={boulderColorToStyle(problem.boulder_color)}
      className="rounded-lg p-1" // ← 4px border (p-1 = 4px)
    >
    <Card
      style={boulderColorToStyle(problem.boulder_color)}
      className={`overflow-hidden ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
      role="button"
    >
    <div className="relative w-full">
      {/* media */}
      {problem.photo_url ? (
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={problem.photo_url}
            alt=""
            className="h-70 w-full object-cover opacity-85"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="h-24 w-full bg-bg" />
      )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute right-3 text-xs top-3 rounded-full bg-white/70 p-2 shadow-sm backdrop-blur hover:bg-white"
            aria-label="Delete Problem"
          >
            archive
          </button>
        )}
    </div>

      {/* content */}
      <div className="px-3 py-3 flex flex-col items-center text-center">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            

            <div className="flex justify-center">
              <div className="flex items-center gap-1">
                {gradeColor && (
                  <span
                    className="h-3 w-3 rounded-sm border text-center border-border"
                    style={{ backgroundColor: gradeColor }}
                    aria-label="Grad-Farbe"
                  />
                )}
                <span className="text-md font-regular text-fg">
                  {problem.grade ?? '—'}
                </span>
              </div>
            </div>


           
          </div>

          
        </div>

        <div className="mt-4 w-full rounded-md bg-white/35 px-2 py-2">
          
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            {/* LEFT */}
            <div className="pr-4">
              <div className="text-[8px] font-semibold tracking-wide text-fg/60 uppercase">
                Best Reach
              </div>
              <div className="text-sm font-bold text-fg leading-tight">
                {stats.bestReach ? outcomeLabel[stats.bestReach] : '—'}
              </div>
            </div>

            {/* CENTER DIVIDER */}
            <div className="h-10 w-px bg-black/10" />

            {/* RIGHT */}
            <div className="pl-4 flex flex-col items-center">
              <div className="text-[8px] font-semibold tracking-wide text-fg/60 uppercase">
                Attempts
              </div>
              <div className="text-sm font-bold text-fg leading-tight tabular-nums">
                {String(stats.attempts).padStart(2, '0')}x
              </div>
            </div>
          </div>
                  
        </div>

      </div>

      {/* actions */}
      {isActive && onLogAttempt && (
        <div className="border-t border-border bg-card px-4 py-4">
          <p className="mb-3 text-center text-sm font-medium text-fg">
            Wie weit bist du bei diesem Versuch gekommen?
          </p>

          <div className="grid grid-cols-2 gap-2">
            {(['start', 'crux', 'almost', 'sent'] as Outcome[]).map((o) => (
              <Button
                key={o}
                variant={o === 'sent' ? 'primary' : 'secondary'}
                onClick={(e) => {
                  e.stopPropagation();
                  onLogAttempt(o);
                }}
              >
                {outcomeLabel[o]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
    </div>
  );
}
