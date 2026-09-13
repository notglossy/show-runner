import type { ComponentProps, ReactNode } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-neutral-200 bg-white", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" };

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        variant === "primary" && "bg-neutral-900 text-white hover:bg-neutral-700",
        variant === "secondary" && "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
        variant === "danger" && "border border-red-300 bg-white text-red-700 hover:bg-red-50",
        variant === "ghost" && "text-neutral-600 hover:bg-neutral-100",
        className,
      )}
    />
  );
}

/** Input styling without a width, for inputs that size themselves. */
export const inputBase =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-100";
export const inputClass = `${inputBase} w-full`;

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function StatusDot({ tone, label }: { tone: "green" | "amber" | "gray" | "red"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
      <span
        className={cx(
          "size-2 rounded-full",
          tone === "green" && "bg-emerald-500",
          tone === "amber" && "bg-amber-500",
          tone === "gray" && "bg-neutral-300",
          tone === "red" && "bg-red-500",
        )}
      />
      {label}
    </span>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "blue" | "amber" | "red" | "green" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        tone === "gray" && "bg-neutral-100 text-neutral-700",
        tone === "blue" && "bg-blue-50 text-blue-700",
        tone === "amber" && "bg-amber-50 text-amber-800",
        tone === "red" && "bg-red-50 text-red-700",
        tone === "green" && "bg-emerald-50 text-emerald-700",
      )}
    >
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-700">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-neutral-500">{children}</p>;
}
