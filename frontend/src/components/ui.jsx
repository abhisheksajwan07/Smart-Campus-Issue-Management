import { Loader2, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { priorityLabel, statusLabel } from "../lib/format";

export function Card({ className = "", dark = false, children, ...rest }) {
  return <section className={`${dark ? "card-glass" : "card"} p-5 sm:p-6 ${className}`} {...rest}>{children}</section>;
}

export function CardHead({ title, to, action, dark = false }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={`text-lg font-medium ${"text-ink"}`}>{title}</h2>
      {action}
      {to && (
        <Link to={to} aria-label={`Open ${title}`}
          className={`grid h-9 w-9 place-items-center rounded-full ${dark ? "bg-white/70 hover:bg-white" : "bg-white hover:bg-paper"} transition-colors`}>
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

const BTN = {
  dark: "bg-ink text-white hover:bg-ink-soft",
  sun: "bg-sun text-ink hover:bg-sun-deep",
  ghost: "bg-white/80 text-ink border border-ink-line hover:bg-white",
  danger: "bg-alarm text-white hover:brightness-95",
};

export function Button({ variant = "dark", loading, className = "", children, ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-alarm">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-ink-mute">{hint}</span> : null}
    </label>
  );
}

const PRIORITY_STYLE = {
  CRITICAL: "bg-alarm text-white",
  HIGH: "bg-ink text-white",
  MEDIUM: "bg-sun text-ink",
  LOW: "bg-white text-ink-soft border border-ink-line",
};
export function PriorityBadge({ value }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLE[value] || PRIORITY_STYLE.LOW}`}>{priorityLabel(value)}</span>;
}

const STATUS_DOT = {
  SUBMITTED: "bg-ink-mute", IN_PROGRESS: "bg-sun-deep", RESOLVED: "bg-leaf", REJECTED: "bg-ink-soft", ESCALATED: "bg-alarm",
};
export function StatusBadge({ value, dark }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${dark ? "text-ink-soft" : "text-ink-soft"}`}>
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value] || "bg-ink-mute"}`} />
      {statusLabel(value)}
    </span>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-mute" role="status">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-alarm-soft px-4 py-3 text-sm text-alarm">
      <span>{error.message || String(error)}</span>
      {onRetry && <button onClick={() => onRetry()} className="font-medium underline">Try again</button>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-line px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-mute">{children}</div>}
    </div>
  );
}

/** Pill tabs, like the nav in the reference */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-white/70 p-1">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${value === o.value ? "bg-ink text-white" : "text-ink-soft hover:bg-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BigStat({ value, label, icon: Icon }) {
  return (
    <div className="flex items-end gap-2">
      <div className="pb-1.5 text-ink-mute">
        {Icon && <span className="mb-1 grid h-6 w-6 place-items-center rounded-md border border-ink-line"><Icon size={13} /></span>}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-5xl font-light tracking-tight tabular-nums sm:text-6xl">{value}</span>
    </div>
  );
}
