import { createContext, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { Bell, LogOut, Menu, X, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLiveEvents } from "../hooks/useLiveEvents";
import { initials, timeAgo, statusLabel } from "../lib/format";

const LiveCtx = createContext({ feed: [], connected: false, tick: 0 });
export const useLive = () => useContext(LiveCtx);

function navFor(role) {
  const items = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/complaints", label: role === "STUDENT" ? "My complaints" : "Complaints" },
    { to: "/report", label: "Report issue" },
    { to: "/departments", label: "Departments" },
  ];
  if (role === "ADMIN") items.push({ to: "/roster", label: "Student roster" }, { to: "/team", label: "Team" });
  return items;
}

function describe(ev) {
  const p = ev.payload || {};
  if (ev.type === "NEW_COMPLAINT") return { title: p.complaint?.title || "New complaint", meta: p.complaint?.ticketNumber, id: p.complaint?.id };
  if (ev.type === "STATUS_UPDATED") return { title: `${p.ticketNumber} → ${statusLabel(p.status)}`, meta: p.note, id: p.complaintId };
  return { title: `${p.ticketNumber} reclassified`, meta: `${p.finalCategory}, ${p.finalPriority}`, id: p.complaintId };
}

function LiveBell({ feed, connected }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef(null);
  const unread = Math.max(0, feed.length - seen);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Live updates, ${unread} new`} onClick={() => { setOpen(!open); setSeen(feed.length); }}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white/80 hover:bg-white">
        <Bell size={17} />
        {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-alarm" />}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-3xl glass-white p-4 text-ink">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">Live updates</p>
            <span className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-leaf" : "bg-ink/25"}`} />
              {connected ? "Connected" : "Reconnecting"}
            </span>
          </div>
          {feed.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">New complaints and status changes appear here as they happen.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {feed.map((ev) => {
                const d = describe(ev);
                return (
                  <li key={ev.id}>
                    <Link to={d.id ? `/complaints/${d.id}` : "/complaints"} onClick={() => setOpen(false)}
                      className="block rounded-2xl px-3 py-2 hover:bg-white/60">
                      <p className="truncate text-sm">{d.title}</p>
                      <p className="truncate text-xs text-ink-mute">{d.meta} · {timeAgo(ev.at)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [tick, setTick] = useState(0);
  const isOps = user.role === "ADMIN" || user.role === "STAFF";
  const { connected, feed } = useLiveEvents(isOps, () => setTick((t) => t + 1));
  const items = navFor(user.role);

  useEffect(() => setMenu(false), [loc.pathname]);

  const pill = ({ isActive }) =>
    `rounded-full px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${isActive ? "bg-ink text-white" : "text-ink-soft hover:bg-white"}`;

  return (
    <LiveCtx.Provider value={{ feed, connected, tick }}>
      <div className="min-h-screen p-0 sm:p-4 lg:p-6">
        <div className="shell mx-auto min-h-screen max-w-[1440px] px-4 pb-10 pt-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-5xl sm:px-7 lg:px-9">
          <header className="flex items-center gap-3">
            <Link to="/" className="rounded-full border border-ink/70 px-4 py-1.5 text-lg font-medium tracking-tight">
              Campus Desk
            </Link>

            <nav aria-label="Main" className="ml-auto hidden items-center gap-1 rounded-full bg-white/60 p-1 lg:flex">
              {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={pill}>{i.label}</NavLink>)}
            </nav>

            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              {isOps && <LiveBell feed={feed} connected={connected} />}
              <Link to="/profile" aria-label="Your profile"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-xs font-semibold hover:bg-white">
                {initials(user.name) || <UserRound size={17} />}
              </Link>
              <button aria-label="Sign out" onClick={async () => { await logout(); nav("/login"); }}
                className="hidden h-10 w-10 place-items-center rounded-full bg-white/80 hover:bg-white sm:grid">
                <LogOut size={16} />
              </button>
              <button aria-label="Open menu" onClick={() => setMenu(!menu)}
                className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white lg:hidden">
                {menu ? <X size={17} /> : <Menu size={17} />}
              </button>
            </div>
          </header>

          {menu && (
            <nav aria-label="Main" className="mt-3 flex flex-col gap-1 rounded-3xl bg-white/80 p-2 lg:hidden">
              {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={pill}>{i.label}</NavLink>)}
              <button onClick={async () => { await logout(); nav("/login"); }} className="rounded-full px-4 py-2 text-left text-[13px] font-medium text-alarm">
                Sign out
              </button>
            </nav>
          )}

          <main className="mt-8">
            <Outlet />
          </main>
        </div>
      </div>
    </LiveCtx.Provider>
  );
}
