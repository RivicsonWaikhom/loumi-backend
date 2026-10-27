import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
  description?: string;
  className?: string;
}

export default function LoadingState({
  label = 'Working on it…',
  description,
  className = '',
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-forest-100 bg-white/70 p-8 text-center ${className}`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-forest-600" aria-hidden />
      <p className="font-display text-base font-semibold text-forest-800">{label}</p>
      {description && <p className="text-sm text-forest-600 max-w-sm">{description}</p>}
    </div>
  );
}
