import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl bg-ink-900/80 ring-1 ring-white/5 shadow-soft", className)} {...props}>
      {children}
    </div>
  );
}

export function Section({ title, subtitle, action, children, className }: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-6", className)}>
      {(title || action) && (
        <header className="flex items-end justify-between gap-6">
          <div>
            {title && <h2 className="text-2xl md:text-3xl font-medium tracking-tight">{title}</h2>}
            {subtitle && <p className="text-ink-300 mt-1 text-sm md:text-base max-w-xl">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};
export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  } as const;
  const variants = {
    primary: "bg-ink-50 text-ink-950 hover:bg-white",
    secondary: "bg-ink-700 text-ink-50 hover:bg-ink-600",
    ghost: "bg-transparent text-ink-100 hover:bg-white/5 ring-1 ring-inset ring-white/10",
    danger: "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/30",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-colors disabled:opacity-50 disabled:pointer-events-none",
        sizes[size], variants[variant], className,
      )}
      {...rest}
    />
  );
}

export function LinkButton({ href, variant = "primary", size = "md", className, children }: {
  href: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg"; className?: string; children?: React.ReactNode;
}) {
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  } as const;
  const variants = {
    primary: "bg-ink-50 text-ink-950 hover:bg-white",
    secondary: "bg-ink-700 text-ink-50 hover:bg-ink-600",
    ghost: "bg-transparent text-ink-100 hover:bg-white/5 ring-1 ring-inset ring-white/10",
  } as const;
  return (
    <Link href={href} className={cn(
      "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-colors",
      sizes[size], variants[variant], className,
    )}>
      {children}
    </Link>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "info"; className?: string }) {
  const tones = {
    neutral: "bg-white/5 text-ink-200 ring-white/10",
    ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    danger: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
    info: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] tracking-wide ring-1", tones[tone], className)}>{children}</span>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[11px] uppercase tracking-[0.18em] text-ink-300", className)}>{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10 placeholder:text-ink-400 focus:ring-ink-100",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10 placeholder:text-ink-400 focus:ring-ink-100 leading-relaxed",
        props.className,
      )}
    />
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("text-xs uppercase tracking-wider text-ink-300", className)}>{children}</label>;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-white/5", className)} />;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Eyebrow>{label}</Eyebrow>
      <div className="text-2xl md:text-3xl font-medium tracking-tight">{value}</div>
      {sub && <div className="text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-ink-900/60 ring-1 ring-white/5 p-10 text-center">
      <div className="serif text-2xl text-ink-100">{title}</div>
      {children && <div className="text-sm text-ink-300 mt-2 max-w-md mx-auto">{children}</div>}
    </div>
  );
}
