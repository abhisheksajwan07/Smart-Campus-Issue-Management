import { useEffect, useState } from "react";
import { get } from "../lib/api";

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

/** Live campus department status fetched from GET /api/departments */
export function AuthAside() {
  const [depts, setDepts] = useState(null);

  useEffect(() => {
    let active = true;
    get("/departments")
      .then((r) => { if (active) setDepts(r.data || []); })
      .catch(() => { if (active) setDepts([]); });
    return () => { active = false; };
  }, []);

  return (
    <>
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[28px] border-white/60" aria-hidden />
      <div className="relative">
        <p className="max-w-xs text-2xl font-light leading-snug">
          Report it once. AI routes it to the right department with a live SLA deadline.
        </p>
        {depts === null ? (
          <p className="mt-8 text-sm text-ink-mute">Connecting to campus service desk…</p>
        ) : depts.length === 0 ? (
          <p className="mt-8 text-sm text-ink-mute">Ready to route student complaints across campus divisions.</p>
        ) : (
          <ul className="mt-8 space-y-2">
            {depts.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-white/50 px-4 py-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.openComplaints > 0 ? "bg-sun-deep" : "bg-leaf"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="truncate text-xs text-ink-mute">{d.code}{d.headName ? ` · ${d.headName}` : ""}</p>
                </div>
                <span className="text-xs tabular-nums text-ink-mute">{d.openComplaints} open</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
