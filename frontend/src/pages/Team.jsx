import { useState } from "react";
import { get, post } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { Card, Button, Field, ErrorNote, Spinner, Empty } from "../components/ui";
import { dateTime } from "../lib/format";

export default function Team() {
  const depts = useAsync(() => get("/departments").then((r) => r.data), []);
  const team = useAsync(() => get("/admin/users").then((r) => r.data), []);
  const blank = { name: "", email: "", password: "", role: "STAFF", departmentId: "", phone: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState("");
  const fe = error?.fields || {};
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      const res = await post("/admin/users", {
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        role: f.role,
        departmentId: f.role === "STAFF" && f.departmentId ? f.departmentId : null,
        phone: f.phone.trim() || undefined,
      });
      setSaved(`Created account for ${res.data.email}.`);
      setF(blank);
      await team.reload(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const members = team.data || [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Team</h1>
          <p className="mt-2 max-w-xl text-ink-mute">Create accounts for department staff or additional admins. Students activate themselves from the roster.</p>
          <form onSubmit={submit} className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Full name" error={fe.name}><input className="field" required value={f.name} onChange={set("name")} /></Field>
            <Field label="Email" error={fe.email}><input className="field" type="email" required value={f.email} onChange={set("email")} placeholder="staff.name@gbu.ac.in" /></Field>
            <Field label="Temporary password" error={fe.password} hint="At least 6 characters"><input className="field" type="text" minLength={6} required value={f.password} onChange={set("password")} /></Field>
            <Field label="Phone"><input className="field" type="tel" value={f.phone} onChange={set("phone")} /></Field>
            <Field label="Role">
              <select className="field" value={f.role} onChange={set("role")}>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            {f.role === "STAFF" && (
              <Field label="Department" error={fe.departmentId} hint="Staff only see complaints routed to their department">
                <select className="field" required value={f.departmentId} onChange={set("departmentId")}>
                  <option value="">Choose a department</option>
                  {(depts.data || []).map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                </select>
              </Field>
            )}
            {saved && <p className="sm:col-span-2 rounded-2xl bg-leaf-soft px-4 py-3 text-sm text-leaf">{saved}</p>}
            {error && !Object.keys(fe).length && <div className="sm:col-span-2"><ErrorNote error={error} /></div>}
            <div className="sm:col-span-2"><Button type="submit" loading={busy}>Create account</Button></div>
          </form>
        </div>
        <aside className="lg:pt-20">
          <Card dark>
            <h2 className="font-medium">Department scoping</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Staff accounts automatically scope dashboards, queues, and live updates to their assigned department. Admins see all university departments.
            </p>
          </Card>
        </aside>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Active team members ({members.length})</h2>
        {team.loading ? <Spinner /> : team.error ? <ErrorNote error={team.error} onRetry={team.reload} /> : members.length === 0 ? (
          <Empty title="No team members found" />
        ) : (
          <Card className="overflow-x-auto p-2 sm:p-3">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr>{["Name", "Email", "Role", "Department", "Phone", "Created"].map((h) => <th key={h} className="px-4 py-2 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-ink-line/70">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.role === "ADMIN" ? "bg-ink text-white" : "bg-sun-soft text-ink"}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{m.departmentName ? `${m.departmentCode} · ${m.departmentName}` : "All departments"}</td>
                    <td className="px-4 py-3 text-ink-soft">{m.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-mute">{dateTime(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
