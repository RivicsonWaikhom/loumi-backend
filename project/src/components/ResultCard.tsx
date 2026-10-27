import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';

type Tone = 'success' | 'warning' | 'info' | 'error' | 'neutral';

const toneStyles: Record<Tone, { wrap: string; icon: string; ring: string }> = {
  success: { wrap: 'bg-forest-50 border-forest-200', icon: 'text-forest-600', ring: 'ring-forest-100' },
  warning: { wrap: 'bg-pineapple-50 border-pineapple-200', icon: 'text-pineapple-700', ring: 'ring-pineapple-100' },
  info: { wrap: 'bg-earth-50 border-earth-200', icon: 'text-earth-700', ring: 'ring-earth-100' },
  error: { wrap: 'bg-red-50 border-red-200', icon: 'text-red-600', ring: 'ring-red-100' },
  neutral: { wrap: 'bg-white border-forest-100', icon: 'text-forest-600', ring: 'ring-forest-100' },
};

const icons: Record<Tone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertCircle,
  info: Info,
  error: XCircle,
  neutral: Info,
};

interface ResultCardProps {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  icon?: typeof CheckCircle2;
  className?: string;
}

export default function ResultCard({
  tone = 'neutral',
  title,
  children,
  icon,
  className = '',
}: ResultCardProps) {
  const styles = toneStyles[tone];
  const Icon = icon ?? icons[tone];
  return (
    <section
      className={`rounded-2xl border p-6 shadow-card animate-fade-up ${styles.wrap} ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ${styles.ring} ${styles.icon}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="mt-1 font-display text-lg font-semibold text-forest-900">{title}</h3>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function ResultList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`space-y-2 ${ordered ? 'list-decimal' : 'list-disc'} pl-5 text-sm text-forest-700`}>
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">{item}</li>
      ))}
    </Tag>
  );
}
