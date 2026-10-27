import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'outlineLight' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-forest-600 text-white shadow-sm hover:bg-forest-700 hover:shadow-md active:bg-forest-800',
  secondary:
    'bg-pineapple-400 text-forest-900 shadow-sm hover:bg-pineapple-500 hover:text-forest-950 active:bg-pineapple-600',
  outline:
    'border border-forest-300 text-forest-700 bg-white hover:bg-forest-50 hover:border-forest-400',
  // For use on dark/forest-900 backgrounds — transparent by default, white text
  outlineLight:
    'border border-white/40 bg-transparent text-white hover:bg-white/10 hover:border-white/60 active:bg-white/20',
  ghost: 'text-forest-700 hover:bg-forest-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
};

const sizes: Record<Size, string> = {
  sm: 'text-sm px-4 py-2',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-6 py-3',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };

type LinkButtonProps = CommonProps & { to: string };

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  to,
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
