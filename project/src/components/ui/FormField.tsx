import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const fieldBase =
  'w-full rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-sm text-forest-900 placeholder:text-forest-400 transition focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200 disabled:bg-forest-50/50';

export function FieldLabel({
  label,
  htmlFor,
  optional,
  hint,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-forest-800">
      {label}
      {optional && <span className="ml-2 text-xs font-normal text-forest-400">(optional)</span>}
      {hint && <span className="ml-2 text-xs font-normal text-forest-400">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  id,
  optional,
  hint,
  ...rest
}: { label: string; id: string; optional?: boolean; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} optional={optional} hint={hint} />
      <input id={id} className={fieldBase} {...rest} />
    </div>
  );
}

export function NumberField({
  label,
  id,
  optional,
  hint,
  unit,
  ...rest
}: { label: string; id: string; optional?: boolean; hint?: string; unit?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} optional={optional} hint={hint} />
      <div className="relative">
        <input id={id} type="number" className={`${fieldBase} ${unit ? 'pr-14' : ''}`} {...rest} />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-forest-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function SelectField({
  label,
  id,
  optional,
  hint,
  children,
  ...rest
}: { label: string; id: string; optional?: boolean; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} optional={optional} hint={hint} />
      <select id={id} className={fieldBase} {...rest}>
        {children}
      </select>
    </div>
  );
}

export function TextareaField({
  label,
  id,
  optional,
  hint,
  ...rest
}: { label: string; id: string; optional?: boolean; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} optional={optional} hint={hint} />
      <textarea id={id} rows={3} className={fieldBase} {...rest} />
    </div>
  );
}

export function FormGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${className}`}>{children}</div>;
}
