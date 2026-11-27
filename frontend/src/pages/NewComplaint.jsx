import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ImagePlus, X, Building2, Timer, Sparkles, CopyCheck } from "lucide-react";
import { api, get, post, fileUrl, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, CardHead, Button, Field, ErrorNote, PriorityBadge, StatusBadge, Spinner } from "../components/ui";
import { SlaRing } from "../components/SlaRing";
import { pct, priorityLabel } from "../lib/format";

function SimilarRows({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((s) => {
        const inner = (
          <>
            <span className="text-xl font-light tabular-nums">{Math.round(s.similarity * 100)}%</span>
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
              <div className="flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-3">{inner}</div>
            ) : (
              <Link to={`/complaints/${s.id}`} className="flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-3 hover:bg-white">{inner}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Result({ result, onAnother }) {
  const { complaint, aiAnalysis: ai, similarComplaints } = result;
  const deptLabel = complaint.departmentName || ai.departmentName;
  const deptCode = complaint.departmentCode || ai.departmentCode;
  const img = fileUrl(complaint.imageUrl);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm tabular-nums text-ink-mute">{complaint.ticketNumber}</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight">Reported. Here's where it went.</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="Deadline" />
          <SlaRing complaint={complaint} size={170} />
          <p className="mt-3 text-center text-sm text-ink-mute">{complaint.slaHours} hours to resolve</p>
        </Card>
        <Card className="lg:col-span-2">
          <CardHead title="How it was classified & routed" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/80 p-4">
              <Sparkles size={18} className="text-ink-mute" />
              <p className="mt-3 text-xs text-ink-mute">Category</p>
              <p className="font-medium">{ai.predictedCategory}</p>
              <p className="mt-1 text-xs text-ink-mute">{pct(ai.categoryConfidence)} confident</p>
            </div>
            <div className="rounded-3xl bg-white/80 p-4">
              <Timer size={18} className="text-ink-mute" />
              <p className="mt-3 text-xs text-ink-mute">Priority</p>
              <p className="font-medium">{priorityLabel(ai.predictedPriority)}</p>
              <p className="mt-1 text-xs text-ink-mute">{pct(ai.priorityConfidence)} confident</p>
            </div>
            <div className="rounded-3xl bg-white/80 p-4">
              <Building2 size={18} className="text-ink-mute" />
              <p className="mt-3 text-xs text-ink-mute">Assigned department</p>
              <p className="font-medium">{deptLabel || "General Administration"}</p>
              {deptCode && <p className="mt-1 text-xs text-ink-mute">Code: {deptCode}</p>}
            </div>
          </div>
          {ai.summary && <p className="mt-4 rounded-2xl bg-sun-soft/70 px-4 py-3 text-sm">{ai.summary}</p>}
          {ai.suggestedAction && (
            <p className="mt-3 text-sm text-ink-soft">
              <span className="font-medium text-ink">Next action:</span> {ai.suggestedAction}
            </p>
          )}
          {img && <img src={img} alt="Uploaded complaint evidence" className="mt-4 max-h-64 rounded-3xl object-cover" />}
          <p className="mt-4 text-xs text-ink-mute">Staff can correct the category or priority if this looks wrong.</p>
        </Card>
      </div>

      {similarComplaints?.length > 0 && (
        <Card>
          <CardHead title="Similar active complaints detected (pgvector)" />
          <SimilarRows items={similarComplaints} />
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to={`/complaints/${complaint.id}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-soft">Track this complaint</Link>
        <Button variant="ghost" onClick={onAnother}>Report another issue</Button>
      </div>
    </div>
  );
}

function toResultShape(c) {
  return {
    complaint: c,
    aiAnalysis: {
      predictedCategory: c.predictedCategory || c.finalCategory,
      predictedPriority: c.predictedPriority || c.finalPriority,
      categoryConfidence: c.aiConfidenceCategory ?? 0,
      priorityConfidence: c.aiConfidencePriority ?? 0,
      departmentName: c.departmentName,
      departmentCode: c.departmentCode,
      summary: c.aiSummary,
      suggestedAction: c.suggestedAction,
    },
    similarComplaints: c.similarComplaints || [],
  };
}

export default function NewComplaint() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const submittedId = params.get("submitted");
  const draftKey = `campus_report_draft_${user.id}`;

  const defaultLoc = user.hostelBlock ? `${user.hostelBlock}${user.roomNo ? `, Room ${user.roomNo}` : ""}` : "";
  const blank = { title: "", description: "", location: defaultLoc };
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      return saved ? { ...blank, ...JSON.parse(saved) } : blank;
    } catch {
      return blank;
    }
  });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingSubmitted, setLoadingSubmitted] = useState(false);
  const [liveCheck, setLiveCheck] = useState({ loading: false, data: null });
  const fileRef = useRef();
  const fe = error?.fields || {};

  // Persist form draft across accidental refreshes before submission
  useEffect(() => {
    if (submittedId) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(form));
    } catch { /* ignore */ }
  }, [form, draftKey, submittedId]);

  // Restore submitted report result from backend if URL has ?submitted=<id> (survives F5 refresh)
  useEffect(() => {
    if (!submittedId) {
      setResult(null);
      return;
    }
    if (result?.complaint?.id === submittedId) return;

    let cancelled = false;
    setLoadingSubmitted(true);
    get(`/complaints/${submittedId}`)
      .then((res) => {
        if (!cancelled) setResult(toResultShape(res.data));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setParams({}, { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSubmitted(false);
      });

    return () => { cancelled = true; };
  }, [submittedId, result?.complaint?.id, setParams]);

  // Live ML classification + pgvector duplicate check as student writes their complaint
  useEffect(() => {
    if (submittedId || result) return;
    const title = form.title.trim();
    const description = form.description.trim();
    if (title.length < 5 || description.length < 10) {
      setLiveCheck({ loading: false, data: null });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLiveCheck((s) => ({ ...s, loading: true }));
      try {
        const res = await post("/complaints/check-duplicates", {
          title,
          description,
          location: form.location.trim(),
        });
        if (!cancelled) setLiveCheck({ loading: false, data: res.data });
      } catch {
        if (!cancelled) setLiveCheck({ loading: false, data: null });
      }
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.title, form.description, form.location, submittedId, result]);

  const pick = (f) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError(new Error("Photo is larger than 5 MB. Choose a smaller one."));
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError(new Error("Use a JPG, PNG or WEBP photo."));
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      let imageUrl = null;
      if (file) {
        setBusy("Uploading photo");
        const fd = new FormData();
        fd.append("image", file);
        imageUrl = (await api("/upload", { method: "POST", form: fd })).data.url;
      }
      setBusy("Classifying");
      const res = await post("/complaints", { ...form, imageUrl });
      try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
      setResult(res.data);
      setParams({ submitted: res.data.complaint.id }, { replace: true });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error(String(err)));
    } finally {
      setBusy("");
    }
  };

  if (loadingSubmitted) return <Spinner label="Loading submitted complaint" />;

  if (result) {
    return (
      <Result
        result={result}
        onAnother={() => {
          setResult(null);
          setForm(blank);
          setFile(null);
          setPreview(null);
          setLiveCheck({ loading: false, data: null });
          setParams({}, { replace: true });
        }}
      />
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const aiPreview = liveCheck.data?.aiPreview;
  const dupes = liveCheck.data?.similarComplaints || [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <h1 className="text-4xl font-light tracking-tight">Report an issue</h1>
        <p className="mt-2 max-w-xl text-ink-mute">Describe what's wrong in your own words. Our ML service predicts the department, urgency, and checks for existing duplicates live.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="What's the problem?" error={fe.title} hint="At least 5 characters">
            <input className="field" required minLength={5} value={form.title} onChange={set("title")} placeholder="Ceiling fan not working" />
          </Field>
          <Field label="Details" error={fe.description} hint="What happened, since when, anything unsafe">
            <textarea className="field min-h-[140px]" required minLength={10} value={form.description} onChange={set("description")}
              placeholder="The fan stopped working two days ago and makes a burning smell when switched on." />
          </Field>
          <Field label="Where?" error={fe.location}>
            <input className="field" required minLength={3} value={form.location} onChange={set("location")} placeholder="Birsa Munda Hostel, Room B-204" />
          </Field>

          <div>
            <span className="label">Photo (optional)</span>
            {preview ? (
              <div className="relative w-fit">
                <img src={preview} alt="Selected photo" className="h-40 rounded-3xl object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink text-white"><X size={15} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
                className="hatch flex w-full flex-col items-center gap-2 rounded-3xl border border-dashed border-ink-line bg-white/50 px-6 py-8 text-sm text-ink-soft hover:bg-white/80">
                <ImagePlus size={22} />
                Add a photo, or drop one here
                <span className="text-xs text-ink-mute">JPG, PNG or WEBP up to 5 MB</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files[0])} />
          </div>

          {error && !Object.keys(fe).length && <ErrorNote error={error} />}
          <Button type="submit" loading={!!busy} className="px-7 py-3">{busy || "Submit complaint"}</Button>
        </form>
      </div>

      <aside className="space-y-4 lg:pt-20">
        {(liveCheck.loading || aiPreview) && (
          <Card className="border border-sun-deep/30 bg-sun-soft/50">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium"><Sparkles size={15} /> Live AI triage</h2>
              {liveCheck.loading && <span className="text-xs text-ink-mute">Analyzing…</span>}
            </div>
            {aiPreview && (
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge value={aiPreview.predictedPriority} />
                  <span className="rounded-full bg-white px-3 py-0.5 text-xs font-medium">{aiPreview.predictedCategory}</span>
                </div>
                <p className="text-xs text-ink-soft">
                  Routes to <span className="font-medium text-ink">{aiPreview.departmentName || "General"}</span> · {aiPreview.slaHours}h SLA
                </p>
                {dupes.length > 0 && (
                  <div className="border-t border-ink-line/70 pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-alarm">
                      <CopyCheck size={14} /> {dupes.length} similar {dupes.length === 1 ? "complaint" : "complaints"} already open
                    </p>
                    <SimilarRows items={dupes} />
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        <Card dark>
          <h2 className="font-medium">Response times</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[["CRITICAL", "6 h", "Sparking wires, flooding, safety risks"], ["HIGH", "12 h", "No water, no power in a room"],
              ["MEDIUM", "24 h", "Broken fan, slow Wi-Fi"], ["LOW", "48 h", "Cosmetic or minor issues"]].map(([p, h, d]) => (
              <li key={p} className="flex gap-3">
                <span className="w-12 shrink-0 text-xl font-light tabular-nums">{h}</span>
                <span><PriorityBadge value={p} /><span className="mt-1 block text-xs text-ink-mute">{d}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
