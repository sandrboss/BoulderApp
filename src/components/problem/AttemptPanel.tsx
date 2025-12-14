import type { Outcome } from '@/lib/api';

const labels: Record<Outcome, string> = {
  start: 'Start',
  crux: 'Crux',
  almost: 'Fast Top',
  sent: 'Top 🎉',
};

export function AttemptPanel({
  onLogAttempt,
}: {
  onLogAttempt: (outcome: Outcome) => void;
}) {
  return (
    <div className="mx-auto mt-4 w-full max-w-[340px] rounded-2xl bg-black/70 p-4 backdrop-blur">
      <div className="flex justify-around">
        {(['start', 'crux', 'almost', 'sent'] as Outcome[]).map((o) => (
          <button
            key={o}
            type="button"
            className="ui-transition rounded-xl bg-bg px-3 py-2 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98]"
            onClick={() => onLogAttempt(o)}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  );
}
