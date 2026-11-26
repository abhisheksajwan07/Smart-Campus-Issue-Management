/** Split layout for login / activation screens */
export default function AuthShell({ title, intro, children, aside }) {
  return (
    <div className="min-h-screen p-0 sm:p-4 lg:p-6">
      <div className="shell mx-auto grid min-h-screen max-w-[1200px] gap-6 p-4 sm:min-h-[calc(100vh-3rem)] sm:rounded-5xl sm:p-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col">
          <span className="w-fit rounded-full border border-ink/70 px-4 py-1.5 text-lg font-medium tracking-tight">Campus Desk</span>
          <div className="my-auto w-full max-w-md py-10">
            <h1 className="text-4xl font-light tracking-tight sm:text-5xl">{title}</h1>
            {intro && <p className="mt-3 text-ink-mute">{intro}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <div className="card-glass relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-end">
          {aside}
        </div>
      </div>
    </div>
  );
}

/** The aside: a calm illustration of what the product does */
export function AuthAside() {
  const rows = [
    { t: "Fan not working, B-204", c: "Electrical Maintenance", p: "MEDIUM", done: true },
    { t: "Water leakage near washroom", c: "Plumbing & Sanitation", p: "HIGH", done: true },
    { t: "Wi-Fi down in Library block", c: "IT & Digital Services", p: "HIGH", done: false },
    { t: "Exposed wire, corridor C", c: "Electrical Maintenance", p: "CRITICAL", done: false },
  ];
  return (
    <>
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[28px] border-white/60" aria-hidden />
      <div className="relative">
        <p className="max-w-xs text-2xl font-light leading-snug">
          Report it once. It reaches the right department with a deadline attached.
        </p>
        <ul className="mt-8 space-y-2">
          {rows.map((r) => (
            <li key={r.t} className="flex items-center gap-3 rounded-2xl bg-white/50 px-4 py-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.p === "CRITICAL" ? "bg-alarm" : r.done ? "bg-ink" : "bg-ink/25"}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${r.done ? "text-ink-mute line-through" : ""}`}>{r.t}</p>
                <p className="truncate text-xs text-ink-mute">{r.c}</p>
              </div>
              <span className="text-xs text-ink-mute">{r.p[0] + r.p.slice(1).toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
