import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  cta?: string;
  accent?: 'forest' | 'pineapple' | 'earth';
}

const accents = {
  forest: 'bg-forest-50 text-forest-700 ring-forest-100',
  pineapple: 'bg-pineapple-50 text-pineapple-700 ring-pineapple-100',
  earth: 'bg-earth-50 text-earth-700 ring-earth-100',
};

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  to,
  cta = 'Open',
  accent = 'forest',
}: FeatureCardProps) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-4 rounded-2xl border border-forest-100 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-cardHover hover:border-forest-200 animate-fade-up"
    >
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${accents[accent]}`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold text-forest-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-forest-600">{description}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 transition group-hover:gap-2.5">
        {cta} <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}

export function FeatureCardChildren({
  icon: Icon,
  title,
  children,
  accent = 'forest',
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  accent?: 'forest' | 'pineapple' | 'earth';
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-forest-100 bg-white p-6 shadow-card animate-fade-up">
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${accents[accent]}`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="font-display text-lg font-semibold text-forest-900">{title}</h3>
      {children}
    </div>
  );
}
