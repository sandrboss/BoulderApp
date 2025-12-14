import * as React from 'react';
import type { ProblemRow, Outcome } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { boulderColorToStyle } from '@/lib/uiStyles';

type Props = {
  problem: ProblemRow;
  gradeLabel?: string;
  gradeColor?: string;
  typeLabel?: string; 
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
  gradeLabel,
  gradeColor,
  typeLabel = 'overhang',
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
    <div className="relative w-full overflow-visible">
      {/* media */}
      {problem.photo_url ? (
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={problem.photo_url}
            alt=""
            className="h-80 w-full object-cover opacity-90"
            loading="lazy"
          />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 flex items-center">
  
            {/* Grade chip */}
            <div
              className="relative z-20 h-14 w-14 text-md font-regular"
              style={{ color: gradeColor ?? '#ffffff' }}
              aria-label="Grad"
              title="Grad"
            >
              {/* SVG shape */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="gradeColor" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_1148_11968)">
                <path d="M24.7264 0.239483C26.0704 0.0824549 27.3529 0.466661 28.3567 1.21836C29.3821 0.496241 30.6748 0.149654 32.0136 0.345705C33.3523 0.541855 34.4909 1.24524 35.2661 2.23099C36.4434 1.79889 37.7817 1.79863 39.0242 2.33463C40.2664 2.87057 41.1837 3.84421 41.6772 4.99688C42.9262 4.88418 44.2188 5.23033 45.2801 6.06941C46.3413 6.90856 46.9759 8.08689 47.1544 9.32803C48.3902 9.54226 49.5494 10.2113 50.3576 11.2967C51.1656 12.3822 51.4729 13.6846 51.3238 14.9299C52.4619 15.4567 53.4085 16.4026 53.9081 17.6601C54.4076 18.9175 54.367 20.2547 53.9009 21.4188C54.8643 22.2223 55.5341 23.3813 55.6913 24.7255C55.8483 26.069 55.4634 27.3502 54.7122 28.3539C55.4348 29.3794 55.7821 30.6723 55.5859 32.0116C55.3897 33.3507 54.6858 34.4891 53.6997 35.2642C54.1324 36.4419 54.1333 37.7802 53.5971 39.0232C53.0607 40.2666 52.0863 41.1852 50.9322 41.6785C51.0445 42.9272 50.6986 44.2194 49.8595 45.2804C49.0205 46.3414 47.8427 46.9751 46.6018 47.1536C46.3874 48.3893 45.7195 49.5487 44.634 50.3567C43.5489 51.1645 42.2469 51.4726 41.002 51.3238C40.4751 52.462 39.5294 53.4085 38.2717 53.9081C37.0138 54.4078 35.6758 54.3688 34.5113 53.9021C33.7078 54.8651 32.5495 55.5352 31.2055 55.6923C29.862 55.8493 28.58 55.4655 27.5762 54.7143C26.5513 55.4352 25.2599 55.7817 23.9222 55.5857C22.5827 55.3893 21.4428 54.6864 20.6677 53.6996C19.4903 54.132 18.1523 54.1329 16.9097 53.597C15.667 53.0609 14.748 52.0872 14.2546 50.934C13.0059 51.0463 11.7136 50.7003 10.6526 49.8613C9.59107 49.0218 8.95637 47.8434 8.77828 46.6017C7.54262 46.3873 6.38314 45.7194 5.57516 44.634C4.76721 43.5486 4.4589 42.2462 4.60795 41.001C3.46979 40.4741 2.52321 39.5284 2.02365 38.2707C1.52416 37.0132 1.56258 35.6755 2.02881 34.5113C1.06592 33.7079 0.396654 32.5493 0.23952 31.2054C0.0824467 29.8611 0.466155 28.5782 1.21828 27.5742C0.496722 26.5489 0.150613 25.2565 0.346712 23.9182C0.54285 22.5799 1.24478 21.441 2.23006 20.6659C1.79804 19.4886 1.79773 18.1502 2.3337 16.9078C2.86961 15.6659 3.84246 14.7474 4.99487 14.2539C4.88236 13.005 5.22919 11.7121 6.06836 10.6509C6.9077 9.5897 8.08569 8.95488 9.32698 8.77664C9.5412 7.54062 10.211 6.38153 11.2967 5.57329C12.3818 4.76552 13.6837 4.45646 14.9286 4.60523C15.4556 3.4677 16.402 2.52225 17.6591 2.02287C18.917 1.52319 20.2551 1.56222 21.4196 2.02889C22.2231 1.06589 23.3824 0.396609 24.7264 0.239483Z" fill="currentColor"/>
                </g>
                <defs>
                <clipPath id="clip0_1148_11968">
                <rect width="56" height="56" fill="white"/>
                </clipPath>
                </defs>
              </svg>

              {/* Grade label on top */}
              <span className="absolute inset-0 grid place-items-center fontfunky rotate-[12deg] text-black">
                {gradeLabel ?? '—'}
              </span>
            </div>

            {/* Type chip */}
            <div className="-ml-2 z-10 rounded-sm fontfunky bg-black px-5 py-2 text-white text-base font-semibold rotate-[-4deg]">
              <span className="inline-block">
                {typeLabel}
              </span>
            </div>
          </div>

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g opacity="0.6">
            <path d="M12 18L16 14L14.6 12.6L13 14.2V10H11V14.2L9.4 12.6L8 14L12 18ZM5 8V19H19V8H5ZM5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V6.525C3 6.29167 3.0375 6.06667 3.1125 5.85C3.1875 5.63333 3.3 5.43333 3.45 5.25L4.7 3.725C4.88333 3.49167 5.1125 3.3125 5.3875 3.1875C5.6625 3.0625 5.95 3 6.25 3H17.75C18.05 3 18.3375 3.0625 18.6125 3.1875C18.8875 3.3125 19.1167 3.49167 19.3 3.725L20.55 5.25C20.7 5.43333 20.8125 5.63333 20.8875 5.85C20.9625 6.06667 21 6.29167 21 6.525V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5.4 6H18.6L17.75 5H6.25L5.4 6Z" fill="black"/>
            </g>
            </svg>
          </button>
        )}
    </div>

      {/* content */}
      <div className="px-3 py-3 pt-8 flex flex-col items-center text-center">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            

            <div className="flex justify-center">
              <div className="flex items-center gap-1">
                <span className="text-md font-regular text-fg">
                  {problem.title ?? '—'}
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
