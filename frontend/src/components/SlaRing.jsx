import { slaCountdown, slaLeft, isClosed } from "../lib/format";

/** Yellow dial that empties as the SLA window runs out — the app's signature. */
export function SlaRing({ complaint, size = 180 }) {
  const closed = isClosed(complaint.status);
  const { overdue, text } = slaCountdown(complaint.slaDeadlineAt);
  const left = closed || overdue ? 1 : slaLeft(complaint);
  const r = 42;
  const C = 2 * Math.PI * r;
  const ticks = Array.from({ length: 60 });
  const color = closed ? "#3E8E5E" : overdue || complaint.isSlaBreached ? "#E0563F" : "#F5CF4E";

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {ticks.map((_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          return <line key={i} x1={50 + 34 * Math.cos(a)} y1={50 + 34 * Math.sin(a)} x2={50 + 36 * Math.cos(a)} y2={50 + 36 * Math.sin(a)} stroke="#D9D7D0" strokeWidth="0.6" />;
        })}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ECEAE4" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - left)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        {closed ? (
          <span className="text-lg font-medium">Closed</span>
        ) : (
          <>
            <span className={`text-3xl font-light tabular-nums ${overdue ? "text-alarm" : ""}`}>{overdue ? "+" : ""}{text}</span>
            <span className="text-xs text-ink-mute">{overdue ? "past deadline" : "hours left"}</span>
          </>
        )}
      </div>
    </div>
  );
}
