import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Field, ErrorNote } from "../components/ui";

/**
 * Creates staff / admin accounts via POST /api/auth/register.
 * Note: that endpoint signs the browser in as the NEW user (it sets auth cookies),
 * so after creating an account the admin is sent back to sign in.
 */
export default function Team() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const depts = useAsync(() => get("/departments").then((r) => r.data), []);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "STAFF", departmentId: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fe = error?.fields || {};
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await post("/auth/register", {
        name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role,
        departmentId: f.role === "STAFF" && f.departmentId ? f.departmentId : null,
        phone: f.phone.trim() || undefined,
      });
      await logout(); // end the session the endpoint just opened for the new account
      nav("/login", { replace: true, state: { notice: `Account created for ${res.data.user.email}. Sign in again to continue.` } });
    } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <h1 className="text-4xl font-light tracking-tight">Add a team member</h1>
        <p className="mt-2 max-w-xl text-ink-mute">Create an account for department staff or another admin. Students don't need this; they activate themselves from the roster.</p>
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
            <Field label="Department" hint="Staff only see complaints routed to their department">
              <select className="field" required value={f.departmentId} onChange={set("departmentId")}>
                <option value="">Choose a department</option>
                {(depts.data || []).map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
              </select>
            </Field>
          )}
          {error && !Object.keys(fe).length && <div className="sm:col-span-2"><ErrorNote error={error} /></div>}
          <div className="sm:col-span-2"><Button type="submit" loading={busy}>Create account</Button></div>
        </form>
      </div>
      <aside className="lg:pt-20">
        <Card dark>
          <h2 className="font-medium">You'll be signed out</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Creating an account signs this browser in as the new person, so we sign you out straight after. Sign back in with your own email to carry on.
          </p>
        </Card>
      </aside>
    </div>
  );
}
