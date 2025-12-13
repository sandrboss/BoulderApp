import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = 'secondary',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md border px-4 py-3 text-sm font-medium transition min-h-[44px] disabled:opacity-60';

  const variants: Record<Variant, string> = {
    primary: 'border-primary bg-primary text-white hover:opacity-95',
    secondary: 'border-border bg-card text-fg hover:bg-bg',
    ghost: 'border-transparent bg-transparent text-fg hover:bg-bg',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
