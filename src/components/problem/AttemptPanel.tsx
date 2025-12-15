import type { Outcome } from '@/lib/api';

const labels: Record<Outcome, string> = {
  start: 'start',
  crux: 'middle',
  almost: 'close',
  sent: 'topped',
};

export function AttemptPanel({
  onLogAttempt,
}: {
  onLogAttempt: (outcome: Outcome) => void;
}) {
  return (
    <div className="mx-auto mt-0 -translate-y-3 w-full max-w-[340px]">
      {/* Outer wrapper: subtle 2px rounding */}
      <div className="overflow-hidden rounded-[20px]">
        {/* Black bar with angled ends */}
        <div
          className="relative bg-black text-white"
          style={{
            height: 62,
            clipPath:
              'polygon(6% 0%, 94% 0%, 100% 20%, 100% 80%, 94% 100%, 6% 100%, 0% 80%, 0% 20%)',
          }}
        >
          {/* Inner content with horizontal padding */}
          <div className="grid h-full grid-cols-4 px-[32px]">
            {(['start', 'crux', 'almost', 'sent'] as Outcome[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onLogAttempt(o)}
                className="
                  ui-transition
                  flex items-center justify-center
                  border-r border-white/10 last:border-r-0
                  font-sora font-semibold
                  text-[12px] leading-none
                  tracking-wide
                  hover:bg-white/10
                  active:bg-white/20
                  focus:outline-none
                "
              >
                {labels[o]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
