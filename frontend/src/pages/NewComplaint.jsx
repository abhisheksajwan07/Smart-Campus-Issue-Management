import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, X, Building2, Timer } from "lucide-react";
import { api, post, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, CardHead, Button, Field, ErrorNote, PriorityBadge, StatusBadge } from "../components/ui";
import { SlaRing } from "../components/SlaRing";
import { pct, priorityLabel } from "../lib/format";

function Result({ result, onAnother }) {
  const { complaint, aiAnalysis: ai, similarComplaints } = result;
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
          <CardHead title="How it was classified" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white/80 p-4">
              <Building2 size={18} className="text-ink-mute" />
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
          </div>
          {ai.summary && <p className="mt-4 rounded-2xl bg-sun-soft/70 px-4 py-3 text-sm">{ai.summary}</p>}
          <p className="mt-4 text-xs text-ink-mute">Staff can correct the category or priority if this looks wrong.</p>
        </Card>
      </div>

      {similarComplaints?.length > 0 && (
        <Card>
          <CardHead title="Someone may have reported this already" />
          <ul className="space-y-2">
            {similarComplaints.map((s) => (
              <li key={s.id} className="flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-3">
                <span className="text-xl font-light tabular-nums">{Math.round(s.similarity * 100)}%</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-ink-mute">{s.location}</span>
                </span>
                <StatusBadge value={s.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to={`/complaints/${complaint.id}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-soft">Track this complaint</Link>
        <Button variant="ghost" onClick={onAnother}>Report another issue</Button>
      </div>
    </div>
  );
}

export default function NewComplaint() {
  const { user } = useAuth();
  const defaultLoc = user.hostelBlock ? `${user.hostelBlock}${user.roomNo ? `, Room ${user.roomNo}` : ""}` : "";
  const blank = { title: "", description: "", location: defaultLoc };
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const fe = error?.fields || {};

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
      setResult(res.data);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error(String(err)));
    } finally {
      setBusy("");
    }
  };

  if (result) return <Result result={result} onAnother={() => { setResult(null); setForm(blank); setFile(null); setPreview(null); }} />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <h1 className="text-4xl font-light tracking-tight">Report an issue</h1>
        <p className="mt-2 max-w-xl text-ink-mute">Describe what's wrong in your own words. You don't need to pick a department; it's worked out from your description.</p>

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
