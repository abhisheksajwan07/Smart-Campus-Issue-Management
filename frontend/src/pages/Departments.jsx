import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Plus, X } from "lucide-react";
import { get, post } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { Card, Spinner, ErrorNote, Button, Field, Empty } from "../components/ui";

function CreateDept({ onCreated, onClose }) {
  const [f, setF] = useState({ name: "", code: "", contactEmail: "", headName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fe = error?.fields || {};
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await post("/departments", { name: f.name.trim(), code: f.code.trim(), contactEmail: f.contactEmail.trim() || undefined, headName: f.headName.trim() || undefined });
      onCreated();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Card className="bg-white/90">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">New department</h2>
        <button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper"><X size={16} /></button>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fe.name}><input className="field" required value={f.name} onChange={set("name")} placeholder="Campus Security Office" /></Field>
        <Field label="Code" error={fe.code} hint="Short, unique, e.g. SEC"><input className="field uppercase" required value={f.code} onChange={set("code")} /></Field>
        <Field label="Contact email" error={fe.contactEmail}><input className="field" type="email" value={f.contactEmail} onChange={set("contactEmail")} /></Field>
        <Field label="Head of department"><input className="field" value={f.headName} onChange={set("headName")} /></Field>
        {error && !Object.keys(fe).length && <div className="sm:col-span-2"><ErrorNote error={error} /></div>}
        <div className="sm:col-span-2"><Button type="submit" loading={busy}>Create department</Button></div>
      </form>
    </Card>
  );
}

export default function Departments() {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const { data, loading, error, reload } = useAsync(() => get("/departments").then((r) => r.data), []);
  const ops = user.role !== "STUDENT";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Departments</h1>
          <p className="mt-1 text-ink-mute">Where complaints are routed, and how much each one is carrying.</p>
        </div>
        {user.role === "ADMIN" && !adding && <Button onClick={() => setAdding(true)}><Plus size={16} /> Add department</Button>}
      </div>

      {adding && <CreateDept onClose={() => setAdding(false)} onCreated={() => { setAdding(false); reload(true); }} />}

      {loading ? <Spinner /> : error ? <ErrorNote error={error} onRetry={reload} /> : data.length === 0 ? (
        <Empty title="No departments yet">Run the backend seed script, or add one above.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((d) => {
            const share = d.totalComplaints ? d.openComplaints / d.totalComplaints : 0;
            const Wrapper = ops ? Link : "div";
            return (
              <Wrapper key={d.id} {...(ops ? { to: `/complaints?departmentId=${d.id}` } : {})} className="card flex flex-col p-6 hover:bg-white/90">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">{d.code}</span>
                  <span className="text-right">
                    <span className="text-4xl font-light tabular-nums">{d.openComplaints}</span>
                    <span className="block text-xs text-ink-mute">open of {d.totalComplaints}</span>
                  </span>
                </div>
                <p className="mt-5 font-medium leading-snug">{d.name}</p>
                {d.headName && <p className="mt-1 text-sm text-ink-mute">{d.headName}</p>}
                <div className="mt-5 h-2 rounded-full bg-ink-line"><div className="h-full rounded-full bg-sun" style={{ width: `${share * 100}%` }} /></div>
                {d.contactEmail && <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft"><Mail size={14} />{d.contactEmail}</p>}
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
