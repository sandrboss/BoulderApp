import { Outcome } from '@/lib/api';
import { Button } from '@/components/ui/Button';


const options: { label: string; value: Outcome }[] = [
  { label: 'Start', value: 'start' },
  { label: 'Crux', value: 'crux' },
  { label: 'Fast Top', value: 'almost' },
  { label: 'Top', value: 'sent' },
];

export function ProblemAttemptActions({
  onLogAttempt,
}: {
  onLogAttempt: (o: Outcome) => void;
}) {
  return (
    <div className="bg-primary px-4 py-5">
      <p className="mb-4 text-center text-sm font-medium text-white">
        Wie weit bist du bei diesem Versuch gekommen?
      </p>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <Button
            key={opt.value}
            variant="secondary"
            onClick={() => onLogAttempt(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
