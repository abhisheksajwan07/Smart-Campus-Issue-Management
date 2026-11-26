import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Plus, Sparkles, AlertTriangle } from "lucide-react";
import { get, qs } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../components/Layout";
import { Card, Spinner, ErrorNote, PriorityBadge, StatusBadge, Empty, Segmented } from "../components/ui";
import { CATEGORIES, PRIORITIES, STATUSES, statusLabel, priorityLabel, timeAgo, isClosed } from "../lib/format";

export default function Complaints() {
  const { user } = useAuth();
  const { tick } = useLive();
  const ops = user.role !== "STUDENT";
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");

  const filters = {
    status: params.get("status") || "",
    priority: params.get("priority") || "",
    category: params.get("category") || "",
    departmentId: params.get("departmentId") || "",
    search: params.get("search") || "",
  };
  const openOnly = params.get("open") === "1";

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    if (k === "status") next.delete("open");
    setParams(next, { replace: true });
  };

  // debounce search box into URL
  useEffect(() => {
    const t = setTimeout(() => search !== filters.search && set("search", search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const depts = useAsync(() => (ops ? get("/departments").then((r) => r.data) : Promise.resolve([])), [ops]);
  const { data, loading, error, reload } = useAsync(() => get(`/complaints${qs(filters)}`).then((r) => r.data), [params.toString()]);
  useEffect(() => { if (tick) reload(true); }, [tick]); // eslint-disable-line

  const list = (data || []).filter((c) => !openOnly || !isClosed(c.status));
  const statusValue = openOnly ? "open" : filters.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight">{ops ? "Complaints" : "My complaints"}</h1>
          <p className="mt-1 text-ink-mute">{loading ? " " : `${list.length} ${list.length === 1 ? "complaint" : "complaints"}`}</p>
        </div>
        <Link to="/report" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-soft">
          <Plus size={16} /> Report issue
        </Link>
      </div>

      <div className="space-y-3">
        <div className="overflow-x-auto pb-1">
          <Segmented label="Status" value={statusValue}
            onChange={(v) => {
              const next = new URLSearchParams(params);
              next.delete("status"); next.delete("open");
              if (v === "open") next.set("open", "1"); else if (v) next.set("status", v);
              setParams(next, { replace: true });
            }}
            options={[{ value: "", label: "All" }, { value: "open", label: "Open" }, ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <label className="relative">
            <span className="sr-only">Search</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input className="field pl-10" placeholder="Search title, ticket or location" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select aria-label="Priority" className="field" value={filters.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
          </select>
          <select aria-label="Category" className="field" value={filters.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Any category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {ops && (
            <select aria-label="Department" className="field" value={filters.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
              <option value="">Any department</option>
              {(depts.data || []).map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? <Spinner /> : error ? <ErrorNote error={error} onRetry={reload} /> : list.length === 0 ? (
        <Empty title="No complaints match these filters">Clear a filter or try a different search.</Empty>
      ) : (
        <Card className="p-2 sm:p-3">
          <div className="hidden grid-cols-[1fr_12rem_6rem_7rem_6rem] gap-4 px-4 py-2 text-xs text-ink-mute lg:grid">
            <span>Complaint</span><span>Category</span><span>Priority</span><span>Status</span><span className="text-right">Time left</span>
          </div>
          <ul className="divide-y divide-ink-line/70">
            {list.map((c) => (
              <li key={c.id}>
                <Link to={`/complaints/${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3.5 hover:bg-white/70 lg:grid-cols-[1fr_12rem_6rem_7rem_6rem]">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.title}</span>
                      {c.isAiOverridden && <span title="Classification corrected by staff" className="text-ink-mute"><Sparkles size={13} /></span>}
                    </span>
                    <span className="block truncate text-xs text-ink-mute">
                      {c.ticketNumber} · {c.location}{ops && c.studentName ? ` · ${c.studentName}` : ""} · {timeAgo(c.createdAt)}
                    </span>
                  </span>
                  <span className="hidden truncate text-sm text-ink-soft lg:block">{c.finalCategory}</span>
                  <span className="hidden lg:block"><PriorityBadge value={c.finalPriority} /></span>
                  <span className="flex items-center gap-2 lg:block">
                    <span className="lg:hidden"><PriorityBadge value={c.finalPriority} /></span>
                    <StatusBadge value={c.status} />
                  </span>
                  <span className={`hidden text-right text-sm tabular-nums lg:block ${c.isSlaBreached && !isClosed(c.status) ? "text-alarm" : "text-ink-mute"}`}>
                    {isClosed(c.status) ? "—" : c.isSlaBreached ? <span className="inline-flex items-center gap-1"><AlertTriangle size={13} />Late</span> : c.slaRemaining}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
