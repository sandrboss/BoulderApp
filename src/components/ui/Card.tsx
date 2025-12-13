import * as React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  style?: React.CSSProperties;
};

export function Card({ className = '', style, ...props }: CardProps) {
  return (
    <div
      style={style}
      className={`rounded-lg bg-card shadow-[var(--shadow)] ${className}`}
      {...props}
    />
  );
}
