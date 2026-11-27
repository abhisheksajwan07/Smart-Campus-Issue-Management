import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, User, Building2, Copy } from "lucide-react";
import { get, patch, fileUrl } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../components/Layout";
import { Card, CardHead, Spinner, ErrorNote, PriorityBadge, StatusBadge, Button, Field } from "../components/ui";
import { SlaRing } from "../components/SlaRing";
import { CATEGORIES, PRIORITIES, STATUSES, SLA_HOURS, statusLabel, priorityLabel, pct, dateTime, timeAgo } from "../lib/format";

const ACTION_LABEL = {
  SUBMITTED: "Reported", AI_ANALYZED: "Classified by AI", STATUS_UPDATED: "Status changed",
  RESOLVED: "Resolved", AI_OVERRIDDEN: "Classification corrected", ESCALATED: "Escalated",
};

function ConfidenceBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-ink-line"><div className="h-full rounded-full bg-ink" style={{ width: pct(value) }} /></div>
      <span className="w-9 text-right text-xs tabular-nums text-ink-mute">{pct(value)}</span>
    </div>
  );
}

function StatusForm({ c, onDone }) {
  const [status, setStatus] = useState(c.status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setStatus(c.status);
  }, [c.status]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setSaved("");
    try {
      await patch(`/complaints/${c.id}/status`, { status, note: note.trim() || undefined });
      setNote(""); setSaved(`Status updated to ${statusLabel(status).toLowerCase()}.`);
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="New status">
        {STATUSES.map((s) => (
          <button type="button" key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${status === s ? "bg-ink text-white" : "bg-white text-ink-soft hover:bg-paper"}`}>
            {statusLabel(s)}
          </button>
        ))}
      </div>
      <Field label="Note for the timeline" hint="Optional. The student sees this.">
        <textarea className="field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Electrician assigned, visiting at 4 pm" />
      </Field>
      <ErrorNote error={error} />
      {saved && <p className="text-sm text-leaf">{saved}</p>}
      <Button type="submit" loading={busy} disabled={status === c.status && !note.trim()} className="w-full">Update status</Button>
    </form>
  );
}

function OverrideForm({ c, onDone }) {
  const [category, setCategory] = useState(c.finalCategory);
  const [priority, setPriority] = useState(c.finalPriority);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setCategory(c.finalCategory);
    setPriority(c.finalPriority);
  }, [c.finalCategory, c.finalPriority]);
  const changed = category !== c.finalCategory || priority !== c.finalPriority;
  const cats = CATEGORIES.includes(c.finalCategory) ? CATEGORIES : [c.finalCategory, ...CATEGORIES];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setSaved("");
    try {
      await patch(`/complaints/${c.id}/override`, {
        category: category !== c.finalCategory ? category : undefined,
        priority: priority !== c.finalPriority ? priority : undefined,
        overrideReason: reason.trim(),
      });
      setReason(""); setSaved("Classification corrected. Department and deadline were recalculated.");
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Category">
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {cats.map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Priority" hint={`Sets a ${SLA_HOURS[priority]} h deadline from when it was reported.`}>
        <select className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
        </select>
      </Field>
      <Field label="Reason" error={error?.fields?.overrideReason}>
        <textarea className="field min-h-[70px]" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Why the AI got it wrong" />
      </Field>
      {error && !error.fields?.overrideReason && <ErrorNote error={error} />}
      {saved && <p className="text-sm text-leaf">{saved}</p>}
      <Button type="submit" variant="sun" loading={busy} disabled={!changed || reason.trim().length < 3} className="w-full">Save correction</Button>
    </form>
  );
}

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { tick, feed } = useLive();
  const ops = user.role !== "STUDENT";
  const [tab, setTab] = useState("status");
  const { data: c, loading, error, reload } = useAsync(() => get(`/complaints/${id}`).then((r) => r.data), [id]);

  useEffect(() => {
    const last = feed[0];
    if (tick && last && (last.payload?.complaintId === id)) reload(true);
  }, [tick]); // eslint-disable-line

  if (loading) return <Spinner />;
  if (error) return (
    <div className="space-y-4">
      <Link to="/complaints" className="inline-flex items-center gap-2 text-sm text-ink-soft"><ArrowLeft size={16} /> Back to complaints</Link>
      <ErrorNote error={error} onRetry={reload} />
    </div>
  );

  const img = fileUrl(c.imageUrl);

  return (
    <div className="space-y-6">
      <Link to="/complaints" className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm text-ink-soft hover:bg-white">
        <ArrowLeft size={16} /> Complaints
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <button onClick={() => navigator.clipboard?.writeText(c.ticketNumber)} title="Copy ticket number"
            className="inline-flex items-center gap-1.5 text-sm tabular-nums text-ink-mute hover:text-ink">
            {c.ticketNumber} <Copy size={12} />
          </button>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">{c.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PriorityBadge value={c.finalPriority} />
            <StatusBadge value={c.status} />
            <span className="text-sm text-ink-mute">Reported {timeAgo(c.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <p className="whitespace-pre-line leading-relaxed text-ink-soft">{c.description}</p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <div className="flex gap-2"><MapPin size={16} className="mt-0.5 text-ink-mute" /><div><dt className="text-ink-mute">Location</dt><dd>{c.location}</dd></div></div>
              <div className="flex gap-2"><Building2 size={16} className="mt-0.5 text-ink-mute" /><div><dt className="text-ink-mute">Department</dt><dd>{c.departmentName || "Not routed yet"}{c.departmentCode ? ` (${c.departmentCode})` : ""}</dd></div></div>
              {ops && <div className="flex gap-2"><User size={16} className="mt-0.5 text-ink-mute" /><div><dt className="text-ink-mute">Reported by</dt><dd>{c.studentName}<br /><span className="text-ink-mute">{c.studentEmail}</span></dd></div></div>}
            </dl>
            {img && <img src={img} alt="Photo attached to the complaint" className="mt-6 max-h-96 rounded-3xl object-cover" />}
          </Card>

          <Card>
            <CardHead title="AI triage" />
            {c.aiSummary && <p className="mb-4 rounded-2xl bg-sun-soft/70 px-4 py-3 text-sm">{c.aiSummary}</p>}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-mute">Predicted category</p>
                <p className="mt-1 font-medium">{c.predictedCategory}</p>
                <div className="mt-2"><ConfidenceBar value={c.aiConfidenceCategory} /></div>
              </div>
              <div>
                <p className="text-xs text-ink-mute">Predicted priority</p>
                <p className="mt-1 font-medium">{priorityLabel(c.predictedPriority)}</p>
                <div className="mt-2"><ConfidenceBar value={c.aiConfidencePriority} /></div>
              </div>
            </div>
            {c.suggestedAction && (
              <div className="mt-5 border-t border-ink-line pt-4 text-sm">
                <p className="text-xs text-ink-mute">Suggested action</p>
                <p className="mt-1">{c.suggestedAction}</p>
              </div>
            )}
            {c.isAiOverridden && (
              <div className="mt-5 rounded-2xl border border-ink-line px-4 py-3 text-sm">
                <p className="font-medium">Corrected by staff to {c.finalCategory}, {priorityLabel(c.finalPriority).toLowerCase()} priority</p>
                {c.overrideReason && <p className="mt-1 text-ink-mute">{c.overrideReason}</p>}
                {c.overriddenAt && <p className="mt-1 text-xs text-ink-mute">{dateTime(c.overriddenAt)}</p>}
              </div>
            )}
          </Card>

          {c.similarComplaints?.length > 0 && (
            <Card>
              <CardHead title="Possible duplicates" />
              <ul className="space-y-2">
                {c.similarComplaints.map((s) => {
                  const inner = (
                    <>
                      <span className="text-2xl font-light tabular-nums">{Math.round(s.similarity * 100)}<span className="text-sm text-ink-mute">%</span></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.title}</span>
                        <span className="block truncate text-xs text-ink-mute">
                          {s.ticketNumber} · {s.location}{s.canView === false ? " · Reported by another student" : ""}
                        </span>
                      </span>
                      <StatusBadge value={s.status} />
                    </>
                  );
                  return (
                    <li key={s.id}>
                      {s.canView === false ? (
                        <div className="flex items-center gap-4 rounded-2xl bg-white/60 px-4 py-3">{inner}</div>
                      ) : (
                        <Link to={`/complaints/${s.id}`} className="flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-3 hover:bg-white">{inner}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHead title="Timeline" />
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-ink-line">
              {(c.timeline || []).map((t, i) => (
                <li key={t.id} className="relative pl-8">
                  <span className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 border-white ${i === 0 ? "bg-sun" : "bg-ink"}`} />
                  <p className="text-sm font-medium">{ACTION_LABEL[t.action] || t.action}</p>
                  {t.note && <p className="mt-0.5 text-sm text-ink-soft">{t.note}</p>}
                  <p className="mt-0.5 text-xs text-ink-mute">{t.actorName ? `${t.actorName} · ` : "System · "}{dateTime(t.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHead title="Resolution deadline" />
            <SlaRing complaint={c} />
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-ink-mute">Window</dt><dd>{c.slaHours} hours</dd></div>
              <div><dt className="text-ink-mute">Due</dt><dd>{dateTime(c.slaDeadlineAt)}</dd></div>
              {c.resolvedAt && <div className="col-span-2"><dt className="text-ink-mute">Resolved</dt><dd>{dateTime(c.resolvedAt)}</dd></div>}
            </dl>
          </Card>

          {ops && (
            <Card dark>
              <div className="mb-4 inline-flex rounded-full bg-white/70 p-1">
                {[["status", "Update status"], ["override", "Correct AI"]].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${tab === k ? "bg-ink text-white" : "text-ink-soft"}`}>{l}</button>
                ))}
              </div>
              <div className="rounded-3xl bg-white/75 p-4 text-ink">
                {tab === "status" ? <StatusForm c={c} onDone={() => reload(true)} /> : <OverrideForm c={c} onDone={() => reload(true)} />}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
