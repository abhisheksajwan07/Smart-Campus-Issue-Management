import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Inbox, Timer, AlertTriangle, Plus, CheckCircle2, MapPin } from "lucide-react";
import { get } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../components/Layout";
import { Card, CardHead, Spinner, ErrorNote, BigStat, PriorityBadge, StatusBadge, Empty } from "../components/ui";
import { SlaRing } from "../components/SlaRing";
import { firstName, isClosed, PRIORITIES, priorityLabel, slaCountdown, timeAgo } from "../lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Segmented pipeline bar, echoing the reference's striped progress row */
function Pipeline({ segments, total }) {
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className="flex w-full max-w-3xl flex-wrap items-end gap-x-1 gap-y-3 sm:flex-nowrap">
      {shown.length === 0 && <div className="hatch h-11 w-full rounded-full bg-white/50" />}
      {shown.map((s) => (
        <div key={s.label} style={{ flexGrow: Math.max(s.value, total * 0.12), flexBasis: 0 }} className="min-w-[88px]">
          <p className="mb-1.5 text-sm text-ink-soft">{s.label}</p>
          <div className={`flex h-11 items-center rounded-full px-4 text-xs font-medium ${s.cls}`}>
            {total ? Math.round((s.value / total) * 100) : 0}%
          </div>
        </div>
      ))}
    </div>
  );
}

function PriorityBars({ dist }) {
  const max = Math.max(1, ...PRIORITIES.map((p) => dist[p] || 0));
  return (
    <div className="flex h-40 items-end justify-around gap-3">
      {PRIORITIES.map((p) => {
        const v = dist[p] || 0;
        const h = 12 + (v / max) * 100;
        return (
          <div key={p} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-xs tabular-nums text-ink-mute">{v}</span>
            <div className="relative w-2.5 rounded-full bg-ink-line" style={{ height: 112 }}>
              <div className={`absolute bottom-0 w-full rounded-full ${p === "CRITICAL" ? "bg-alarm" : p === "MEDIUM" ? "bg-sun" : "bg-ink"}`} style={{ height: `${h}%`, maxHeight: "100%" }} />
            </div>
            <span className="text-xs text-ink-mute">{priorityLabel(p)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Ring({ value, label }) {
  const r = 40, C = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ECEAE4" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F5CF4E" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-3xl font-light tabular-nums">{value}%</span>
        <span className="text-xs text-ink-mute">{label}</span>
      </div>
    </div>
  );
}

function UrgentCard({ complaint }) {
  if (!complaint) {
    return (
      <Card className="flex flex-col justify-between bg-sun/90">
        <CardHead title="Next deadline" />
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto" size={36} strokeWidth={1.5} />
          <p className="mt-3 font-medium">Nothing open right now</p>
        </div>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col">
      <CardHead title="Next deadline" to={`/complaints/${complaint.id}`} />
      <SlaRing complaint={complaint} size={160} />
      <div className="mt-4">
        <p className="truncate font-medium">{complaint.title}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-mute"><MapPin size={12} />{complaint.location}</p>
      </div>
    </Card>
  );
}

function QueueCard({ list, total }) {
  return (
    <Card dark className="flex flex-col lg:row-span-2">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-medium">Open queue</h2>
        <span className="text-3xl font-light tabular-nums">{list.length}<span className="text-ink-mute">/{total}</span></span>
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-mute">Queue is clear.</p>
      ) : (
        <ul className="space-y-1">
          {list.slice(0, 7).map((c) => {
            const { overdue, text } = slaCountdown(c.slaDeadlineAt);
            return (
              <li key={c.id}>
                <Link to={`/complaints/${c.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/50">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${c.finalPriority === "CRITICAL" ? "bg-alarm text-white" : "bg-white/70"}`}>
                    <Timer size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.title}</span>
                    <span className="block truncate text-xs text-ink-mute">{c.ticketNumber} · {c.departmentName || "Unrouted"}</span>
                  </span>
                  <span className={`text-xs tabular-nums ${overdue ? "font-medium text-alarm" : "text-ink-soft"}`}>{overdue ? "late" : text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link to="/complaints?open=1" className="mt-auto pt-4 text-center text-sm text-ink-soft hover:text-ink">See all open complaints</Link>
    </Card>
  );
}

function OpsDashboard({ user }) {
  const { tick } = useLive();
  const { data, loading, error, reload } = useAsync(async () => {
    const [a, c] = await Promise.all([get("/analytics/dashboard"), get("/complaints")]);
    return { a: a.data, list: c.data };
  }, []);

  useEffect(() => { if (tick) reload(true); }, [tick]); // eslint-disable-line

  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const { a, list } = data;
  const s = a.summary;
  const open = list.filter((c) => !isClosed(c.status)).sort((x, y) => new Date(x.slaDeadlineAt) - new Date(y.slaDeadlineAt));
  const prio = Object.fromEntries(a.priorityDistribution.map((d) => [d.priority, d.count]));
  const acc = parseFloat(a.aiMetrics.aiAccuracyRate) || 0;
  const cats = [...a.categoryDistribution].sort((x, y) => y.count - x.count);
  const depts = [...a.departmentWorkload].sort((x, y) => y.complaintsCount - x.complaintsCount);
  const deptMax = Math.max(1, ...depts.map((d) => d.complaintsCount));
  const inProgress = list.filter((c) => c.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-light tracking-tight sm:text-5xl">{greeting()}, {firstName(user.name)}</h1>
          <div className="mt-6">
            <Pipeline total={s.totalComplaints} segments={[
              { label: "New", value: Math.max(0, s.activeComplaints - inProgress), cls: "bg-ink text-white" },
              { label: "In progress", value: inProgress, cls: "bg-sun" },
              { label: "Resolved", value: s.resolvedComplaints, cls: "hatch bg-white/60" },
              { label: "Escalated", value: s.escalatedComplaints, cls: "border border-ink/40 bg-white/40" },
              { label: "Rejected", value: s.rejectedComplaints, cls: "bg-paper text-ink-mute" },
            ]} />
          </div>
        </div>
        <div className="flex flex-wrap gap-8">
          <BigStat icon={Inbox} label="Total" value={s.totalComplaints} />
          <BigStat icon={Timer} label="Active" value={s.activeComplaints} />
          <BigStat icon={AlertTriangle} label="Past SLA" value={s.slaBreachedComplaints} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UrgentCard complaint={open[0]} />
        <Card>
          <CardHead title="Priority mix" to="/complaints" />
          <PriorityBars dist={prio} />
        </Card>
        <Card>
          <CardHead title="AI triage" />
          <Ring value={acc} label="kept as predicted" />
          <p className="mt-3 text-center text-xs text-ink-mute">
            {a.aiMetrics.aiOverriddenCount} of {a.aiMetrics.totalAnalyzed} corrected by staff
          </p>
        </Card>
        <QueueCard list={open} total={s.totalComplaints} />

        <Card>
          <CardHead title="By category" />
          {cats.length === 0 ? <p className="text-sm text-ink-mute">No complaints yet.</p> : (
            <ul className="divide-y divide-ink-line/70">
              {cats.slice(0, 6).map((c) => (
                <li key={c.category}>
                  <Link to={`/complaints?category=${encodeURIComponent(c.category)}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-ink-soft">
                    <span className="truncate">{c.category}</span>
                    <span className="tabular-nums text-ink-mute">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="md:col-span-2">
          <CardHead title="Department workload" to="/departments" />
          <ul className="space-y-3">
            {depts.map((d) => (
              <li key={d.id}>
                <Link to={`/complaints?departmentId=${d.id}`} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 rounded-xl py-0.5 text-sm hover:opacity-85">
                  <span className="font-medium">{d.code}</span>
                  <div className="h-7 rounded-full bg-white/80">
                    <div className="flex h-full items-center rounded-full bg-sun px-3 text-xs" style={{ width: `${Math.max(6, (d.complaintsCount / deptMax) * 100)}%` }} />
                  </div>
                  <span className="text-right tabular-nums text-ink-mute">{d.complaintsCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function StudentDashboard({ user }) {
  const { tick } = useLive();
  const { data, loading, error, reload } = useAsync(() => get("/complaints").then((r) => r.data), []);
  useEffect(() => { if (tick) reload(true); }, [tick]); // eslint-disable-line

  const stats = useMemo(() => {
    const list = data || [];
    return {
      total: list.length,
      open: list.filter((c) => !isClosed(c.status)),
      resolved: list.filter((c) => c.status === "RESOLVED").length,
      inProgress: list.filter((c) => c.status === "IN_PROGRESS").length,
      submitted: list.filter((c) => c.status === "SUBMITTED").length,
      escalated: list.filter((c) => c.status === "ESCALATED").length,
      rejected: list.filter((c) => c.status === "REJECTED").length,
    };
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const latestOpen = [...stats.open].sort((a, b) => new Date(a.slaDeadlineAt) - new Date(b.slaDeadlineAt))[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-light tracking-tight sm:text-5xl">{greeting()}, {firstName(user.name)}</h1>
          <div className="mt-6">
            <Pipeline total={stats.total} segments={[
              { label: "Waiting", value: stats.submitted, cls: "bg-ink text-white" },
              { label: "Being fixed", value: stats.inProgress, cls: "bg-sun" },
              { label: "Escalated", value: stats.escalated, cls: "border border-ink/40 bg-white/40" },
              { label: "Resolved", value: stats.resolved, cls: "hatch bg-white/60" },
              { label: "Rejected", value: stats.rejected, cls: "bg-paper text-ink-mute" },
            ]} />
          </div>
        </div>
        <div className="flex flex-wrap gap-8">
          <BigStat icon={Inbox} label="Reported" value={stats.total} />
          <BigStat icon={Timer} label="Open" value={stats.open.length} />
          <BigStat icon={CheckCircle2} label="Fixed" value={stats.resolved} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col justify-between bg-gradient-to-b from-white/80 to-sun-soft/80">
          <div>
            <p className="text-sm text-ink-mute">{user.enrollmentNo}</p>
            <p className="mt-1 text-2xl font-light">{user.name}</p>
            <p className="mt-1 text-sm text-ink-soft">{user.school}</p>
          </div>
          {user.hostelBlock && (
            <div className="mt-8 flex items-center justify-between gap-2 rounded-full bg-white/80 py-2 pl-4 pr-2 text-sm">
              <span className="truncate">{user.hostelBlock}</span>
              <span className="rounded-full border border-ink-line px-3 py-1 text-xs">{user.roomNo}</span>
            </div>
          )}
        </Card>

        <Card dark className="flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-medium">Something broken?</h2>
            <p className="mt-2 text-sm text-ink-soft">Describe it in your own words. We work out the department and urgency for you.</p>
          </div>
          <Link to="/report" className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-soft">
            <Plus size={16} /> Report an issue
          </Link>
        </Card>

        <UrgentCard complaint={latestOpen} />

        <Card className="flex flex-col">
          <CardHead title="How it works" />
          <ol className="space-y-3 text-sm">
            {[["Report", "Title, what happened, where."], ["Routed", "AI picks the department and urgency."],
              ["Deadline", "Critical 6 h, high 12 h, medium 24 h, low 48 h."], ["Fixed", "You see every update on the timeline."]].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] text-white">{i + 1}</span>
                <span><span className="font-medium">{t}.</span> <span className="text-ink-mute">{d}</span></span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="md:col-span-2 lg:col-span-4">
          <CardHead title="Your recent complaints" to="/complaints" />
          {data.length === 0 ? (
            <Empty title="You haven't reported anything yet">
              <Link to="/report" className="font-medium text-ink underline underline-offset-4">Report your first issue</Link>
            </Empty>
          ) : (
            <ul className="divide-y divide-ink-line/70">
              {data.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/complaints/${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_10rem_6rem_6rem]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="block truncate text-xs text-ink-mute">
                        {c.ticketNumber}{c.departmentName ? ` · ${c.departmentName}` : ""} · {timeAgo(c.createdAt)}
                      </span>
                    </span>
                    <span className="hidden truncate text-sm text-ink-soft sm:block">{c.finalCategory}</span>
                    <span className="hidden sm:block"><PriorityBadge value={c.finalPriority} /></span>
                    <StatusBadge value={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === "STUDENT" ? <StudentDashboard user={user} /> : <OpsDashboard user={user} />;
}
