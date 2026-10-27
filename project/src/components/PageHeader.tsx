import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export default function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden border-b border-forest-100 bg-gradient-to-b from-forest-50/80 to-white">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-forest-600 text-white shadow-sm">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          {eyebrow && (
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-500">
              {eyebrow}
            </span>
          )}
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-forest-600">
          {description}
        </p>
        {children}
      </div>
    </header>
  );
}
