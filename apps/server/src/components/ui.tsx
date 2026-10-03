import type { ComponentProps, ReactNode } from 'react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-ink text-4xl leading-none font-medium tracking-tight sm:text-5xl">
        {title}
      </h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  className,
  actions,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cx('border-graphite bg-ground rounded border', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-ink text-xl leading-none font-medium">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'label-mono inline-flex items-center justify-center gap-2 rounded border whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3' : 'h-10 px-5',
        variant === 'primary' &&
          'border-signal bg-signal hover:border-ink hover:bg-ink hover:text-signal-tint text-white',
        variant === 'secondary' &&
          'border-ink text-ink hover:bg-ink hover:text-ground bg-transparent',
        variant === 'danger' &&
          'border-danger text-danger hover:bg-danger bg-transparent hover:text-white',
        variant === 'ghost' && 'text-ink hover:bg-well border-transparent',
        className,
      )}
    />
  );
}

/** Input styling without a width, for inputs that size themselves. */
export const inputBase =
  'h-10 rounded border border-ink bg-white px-3 text-sm text-ink placeholder:text-subtle disabled:cursor-not-allowed disabled:opacity-50';
export const inputClass = `${inputBase} w-full`;

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('flex flex-col gap-2', className)}>
      <span className="label-mono text-ink">{label}</span>
      {children}
      {hint && <span className="text-subtle text-xs">{hint}</span>}
    </label>
  );
}

export function StatusDot({
  tone,
  label,
}: {
  tone: 'green' | 'amber' | 'gray' | 'red';
  label: string;
}) {
  return (
    <span className="caption-mono text-ink inline-flex items-center gap-2">
      {/* Tones differ in fill and outline, not hue alone; the label always carries the meaning. */}
      <span
        className={cx(
          'size-2.5 rounded-full border',
          tone === 'green' && 'border-signal bg-signal',
          tone === 'amber' && 'border-signal bg-transparent',
          tone === 'gray' && 'border-concrete bg-transparent',
          tone === 'red' && 'border-danger bg-danger',
        )}
      />
      {label}
    </span>
  );
}

export function Badge({
  children,
  tone = 'gray',
}: {
  children: ReactNode;
  tone?: 'gray' | 'blue' | 'amber' | 'red' | 'green';
}) {
  return (
    <span
      className={cx(
        'caption-mono inline-flex h-6 items-center rounded-full border px-2.5 whitespace-nowrap',
        tone === 'gray' && 'border-well bg-well text-ink',
        tone === 'blue' && 'border-signal bg-signal text-white',
        tone === 'amber' && 'border-signal-tint bg-signal-tint text-ink',
        tone === 'red' && 'border-danger bg-danger text-white',
        tone === 'green' && 'border-ink text-ink bg-transparent',
      )}
    >
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-danger text-sm">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-subtle py-6 text-center text-sm">{children}</p>;
}
