import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { get } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { Card, Button } from "../components/ui";
import { initials } from "../lib/format";

const ROLE = { STUDENT: "Student", STAFF: "Department staff", ADMIN: "Administrator" };

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const depts = useAsync(() => (user.departmentId ? get("/departments").then((r) => r.data) : Promise.resolve([])), [user.departmentId]);
  const dept = (depts.data || []).find((d) => d.id === user.departmentId);

  const rows = [
    ["Email", user.email], ["Phone", user.phone], ["Enrollment", user.enrollmentNo], ["School", user.school],
    ["Hostel", user.hostelBlock && `${user.hostelBlock}${user.roomNo ? `, Room ${user.roomNo}` : ""}`],
    ["Department", dept && `${dept.name} (${dept.code})`],
    ["Member since", user.createdAt && new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })],
  ].filter(([, v]) => v);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="flex flex-col items-start bg-gradient-to-b from-white/80 to-sun-soft/80">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-ink text-2xl font-light text-white">{initials(user.name)}</span>
        <h1 className="mt-6 text-3xl font-light tracking-tight">{user.name}</h1>
        <span className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-medium">{ROLE[user.role] || user.role}</span>
        <Button variant="ghost" className="mt-8" onClick={async () => { await logout(); nav("/login"); }}><LogOut size={15} /> Sign out</Button>
      </Card>
      <Card>
        <h2 className="text-lg font-medium">Details</h2>
        <dl className="mt-4 divide-y divide-ink-line/70">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-mute">{k}</dt><dd>{v}</dd>
            </div>
          ))}
        </dl>
        {user.role === "STUDENT" && <p className="mt-4 text-xs text-ink-mute">These details come from the university roster. Ask the registrar's office to correct anything wrong.</p>}
      </Card>
    </div>
  );
}
