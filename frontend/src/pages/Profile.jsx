import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { get } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Field, ErrorNote } from "../components/ui";
import { initials } from "../lib/format";

const ROLE = { STUDENT: "Student", STAFF: "Department staff", ADMIN: "Administrator" };

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const nav = useNavigate();
  const depts = useAsync(() => (user.departmentId ? get("/departments").then((r) => r.data) : Promise.resolve([])), [user.departmentId]);
  const dept = (depts.data || []).find((d) => d.id === user.departmentId);

  const [phone, setPhone] = useState(user.phone || "");
  const [name, setName] = useState(user.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setPhone(user.phone || "");
    setName(user.name || "");
  }, [user.phone, user.name]);

  const rows = [
    ["Email", user.email],
    ["Enrollment", user.enrollmentNo],
    ["School", user.school],
    ["Hostel", user.hostelBlock && `${user.hostelBlock}${user.roomNo ? `, Room ${user.roomNo}` : ""}`],
    ["Department", dept && `${dept.name} (${dept.code})`],
    ["Member since", user.createdAt && new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })],
  ].filter(([, v]) => v);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      await updateProfile({
        phone: phone.trim() || null,
        ...(user.role !== "STUDENT" ? { name: name.trim() } : {}),
      });
      setSaved("Profile updated.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const dirty = phone.trim() !== (user.phone || "") || (user.role !== "STUDENT" && name.trim() !== (user.name || ""));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="flex flex-col items-start bg-gradient-to-b from-white/80 to-sun-soft/80">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-ink text-2xl font-light text-white">{initials(user.name)}</span>
        <h1 className="mt-6 text-3xl font-light tracking-tight">{user.name}</h1>
        <span className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-medium">{ROLE[user.role] || user.role}</span>
        <Button variant="ghost" className="mt-8" onClick={async () => { await logout(); nav("/login"); }}><LogOut size={15} /> Sign out</Button>
      </Card>
      <div className="space-y-4">
        <Card>
          <h2 className="text-lg font-medium">Details</h2>
          <dl className="mt-4 divide-y divide-ink-line/70">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-ink-mute">{k}</dt><dd>{v}</dd>
              </div>
            ))}
          </dl>
          {user.role === "STUDENT" && <p className="mt-4 text-xs text-ink-mute">Enrollment, school, and hostel come from the university roster. Ask the registrar's office to correct anything wrong.</p>}
        </Card>

        <Card>
          <h2 className="text-lg font-medium">Contact settings</h2>
          <form onSubmit={save} className="mt-4 grid max-w-lg gap-4 sm:grid-cols-2">
            {user.role !== "STUDENT" && (
              <Field label="Display name" className="sm:col-span-2">
                <input className="field" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            <Field label="Phone number" className="sm:col-span-2">
              <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
            </Field>
            {saved && <p className="sm:col-span-2 text-sm text-leaf">{saved}</p>}
            <div className="sm:col-span-2"><ErrorNote error={error} /></div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={busy} disabled={!dirty}>Save changes</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
