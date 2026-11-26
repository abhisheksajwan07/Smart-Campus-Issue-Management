import { useMemo, useRef, useState } from "react";
import { Upload, Search, X } from "lucide-react";
import { get, post } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { Card, Spinner, ErrorNote, Button, Empty } from "../components/ui";

const COLUMNS = ["enrollmentNo", "fullName", "school", "program", "hostelBlock", "roomNo", "registeredEmail"];

/** Parses CSV (header row with the column names above) or a JSON array. */
function parseRoster(text) {
  const t = text.trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    const j = JSON.parse(t);
    return Array.isArray(j) ? j : j.students || [];
  }
  const rows = t.split(/\r?\n/).filter(Boolean).map((line) => {
    const out = []; let cur = ""; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  });
  const head = rows.shift().map((h) => h.replace(/\s+/g, ""));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || undefined])));
}

function Importer({ onDone }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const parsed = useMemo(() => {
    if (!text.trim()) return { rows: [] };
    try { return { rows: parseRoster(text) }; } catch (e) { return { rows: [], err: "Couldn't read this. Check the CSV header or JSON format." }; }
  }, [text]);

  const submit = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const students = parsed.rows.map((r) => Object.fromEntries(COLUMNS.filter((c) => r[c]).map((c) => [c, String(r[c])])));
      const res = await post("/admin/roster/bulk-upload", { students });
      setResult(res.data); setText(""); onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="text-lg font-medium">Import students</h2>
      <p className="mt-1 text-sm text-ink-mute">Paste a CSV or JSON export from CSMS / Samarth. Existing enrollment numbers are updated, new ones are added.</p>
      <p className="mt-3 overflow-x-auto whitespace-nowrap rounded-2xl bg-white/80 px-4 py-2 font-mono text-xs text-ink-soft">{COLUMNS.join(",")}</p>
      <textarea className="field mt-3 min-h-[140px] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"enrollmentNo,fullName,school,program,hostelBlock,roomNo,registeredEmail\n24/ICS/101,Neha Singh,School of ICT,B.Tech CSE,Mahamaya Hostel,C-110,neha.singh@gbu.ac.in"} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" type="button" onClick={() => fileRef.current.click()}><Upload size={15} /> Choose file</Button>
        <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
          onChange={async (e) => { const f = e.target.files[0]; if (f) setText(await f.text()); e.target.value = ""; }} />
        <Button onClick={submit} loading={busy} disabled={!parsed.rows.length}>
          Import {parsed.rows.length ? `${parsed.rows.length} ${parsed.rows.length === 1 ? "student" : "students"}` : ""}
        </Button>
        {parsed.err && <span className="text-sm text-alarm">{parsed.err}</span>}
      </div>
      {error && (
        <div className="mt-3 space-y-1">
          <ErrorNote error={error} />
          {error.data?.errors?.slice(0, 5).map((e) => <p key={e.field} className="text-xs text-alarm">Row {Number(e.field.split(".")[1]) + 1}: {e.message}</p>)}
        </div>
      )}
      {result && (
        <p className="mt-3 rounded-2xl bg-leaf-soft px-4 py-3 text-sm text-leaf">
          Imported {result.totalProcessed}: {result.newStudentsAdded} added, {result.existingStudentsUpdated} updated.
        </p>
      )}
    </Card>
  );
}

export default function Roster() {
  const [showImport, setShowImport] = useState(false);
  const [q, setQ] = useState("");
  const { data, loading, error, reload } = useAsync(() => get("/admin/roster").then((r) => r.data), []);

  // Backend currently ignores ?search, so filter here as well.
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || []).filter((r) => !s || [r.enrollmentNo, r.fullName, r.registeredEmail, r.school].some((v) => v?.toLowerCase().includes(s)));
  }, [data, q]);
  const claimed = (data || []).filter((r) => r.isClaimed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Student roster</h1>
          <p className="mt-1 text-ink-mute">Only students on this list can activate an account.</p>
        </div>
        <div className="flex items-end gap-6">
          {data && <p className="text-right"><span className="text-4xl font-light tabular-nums">{claimed}</span><span className="text-ink-mute">/{data.length}</span><span className="block text-xs text-ink-mute">activated</span></p>}
          <Button onClick={() => setShowImport(!showImport)} variant={showImport ? "ghost" : "dark"}>
            {showImport ? <><X size={15} /> Close import</> : <><Upload size={15} /> Import students</>}
          </Button>
        </div>
      </div>

      {showImport && <Importer onDone={() => reload(true)} />}

      <label className="relative block max-w-md">
        <span className="sr-only">Search roster</span>
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" />
        <input className="field pl-10" placeholder="Search name, enrollment or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {loading ? <Spinner /> : error ? <ErrorNote error={error} onRetry={reload} /> : list.length === 0 ? (
        <Empty title={q ? "No students match that search" : "The roster is empty"}>{!q && "Import a CSV export to get started."}</Empty>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-ink-mute">
              <tr>{["Enrollment", "Name", "School", "Hostel", "Email", "Account"].map((h) => <th key={h} className="px-4 py-2 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-ink-line/70">
              {list.map((r) => (
                <tr key={r.enrollmentNo}>
                  <td className="px-4 py-3 tabular-nums">{r.enrollmentNo}</td>
                  <td className="px-4 py-3 font-medium">{r.fullName}<span className="block text-xs font-normal text-ink-mute">{r.program}</span></td>
                  <td className="px-4 py-3 text-ink-soft">{r.school}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.hostelBlock ? `${r.hostelBlock}, ${r.roomNo || ""}` : "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.registeredEmail}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.isClaimed ? "bg-ink text-white" : "hatch bg-white text-ink-mute"}`}>
                      {r.isClaimed ? "Active" : "Not yet"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
