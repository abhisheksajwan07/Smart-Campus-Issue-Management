import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthShell, { AuthAside } from "../components/AuthShell";
import { Button, Field, ErrorNote } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email.trim(), form.password);
      nav(loc.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" intro="Use your university email. Students, staff and admins all sign in here." aside={<AuthAside />}>
      {loc.state?.notice && <p className="mb-4 rounded-2xl bg-sun-soft px-4 py-3 text-sm">{loc.state.notice}</p>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className="field" type="email" autoComplete="email" required placeholder="name@gbu.ac.in"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className="field" type="password" autoComplete="current-password" required
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" loading={busy} className="w-full py-3">Sign in</Button>
      </form>
      <p className="mt-6 text-sm text-ink-mute">
        First time here as a student?{" "}
        <Link to="/activate" className="font-medium text-ink underline underline-offset-4">Activate your account</Link>
      </p>
    </AuthShell>
  );
}
