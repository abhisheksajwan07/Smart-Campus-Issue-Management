import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { post } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";
import { Button, Field, ErrorNote } from "../components/ui";

const STEPS = ["Enrollment", "Verify email", "Set password"];

export default function Activate() {
  const { adopt } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [student, setStudent] = useState(null);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) {
      setError(e);
      if (e.data?.cooldownRemaining) setCooldown(e.data.cooldownRemaining);
    } finally { setBusy(false); }
  };

  const verify = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await post("/auth/verify-enrollment", { enrollmentNo: enrollmentNo.trim() });
      setStudent(res.data);
      setCooldown(res.data.cooldownSeconds || 60);
      if (res.data.devOtp) setNotice(`Development mode: your code is ${res.data.devOtp}`);
      setStep(1);
    });
  };

  const resend = () => run(async () => {
    const res = await post("/auth/resend-otp", { enrollmentNo: student.enrollmentNo });
    setCooldown(res.data.cooldownSeconds || 60);
    setNotice(res.data.devOtp ? `Development mode: your new code is ${res.data.devOtp}` : `New code sent to ${res.data.maskedEmail}.`);
  });

  const finish = (e) => {
    e.preventDefault();
    if (password !== confirm) return setError(new Error("Passwords don't match."));
    run(async () => {
      const res = await post("/auth/register-student", { enrollmentNo: student.enrollmentNo, otp, password });
      adopt(res.data.user);
      nav("/", { replace: true });
    });
  };

  const aside = student ? (
    <div className="relative">
      <p className="text-sm text-ink-mute">Found in the university roster</p>
      <p className="mt-2 text-3xl font-light">{student.fullName}</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        {[["Enrollment", student.enrollmentNo], ["School", student.school], ["Programme", student.program],
          ["Hostel", student.hostelBlock && `${student.hostelBlock}, ${student.roomNo || ""}`]].map(([k, v]) => v && (
          <div key={k}><dt className="text-ink-mute">{k}</dt><dd className="mt-0.5">{v}</dd></div>
        ))}
      </dl>
    </div>
  ) : (
    <p className="relative max-w-xs text-2xl font-light leading-snug">
      Your details come straight from the university roster, so there's nothing to fill in but a password.
    </p>
  );

  return (
    <AuthShell title="Activate your account" intro="Students activate once with their enrollment number." aside={aside}>
      <ol className="mb-8 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-9 rounded-full px-3 text-xs font-medium leading-9 ${i < step ? "bg-ink text-white" : i === step ? "bg-sun" : "hatch bg-white/60 text-ink-mute"}`}>
              {i < step ? <Check size={14} className="inline -mt-0.5 mr-1" /> : null}{s}
            </div>
          </li>
        ))}
      </ol>

      {notice && <p className="mb-4 rounded-2xl bg-sun-soft px-4 py-3 text-sm">{notice}</p>}

      {step === 0 && (
        <form onSubmit={verify} className="space-y-4">
          <Field label="Enrollment number" hint="As printed on your ID card, e.g. 23/SOBT/019">
            <input className="field uppercase" required autoFocus value={enrollmentNo}
              onChange={(e) => setEnrollmentNo(e.target.value)} placeholder="22/ICS/045" />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" loading={busy} className="w-full py-3">Send verification code</Button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); setError(null); setStep(2); }} className="space-y-4">
          <p className="text-sm text-ink-mute">We sent a 6-digit code to <span className="font-medium text-ink">{student.maskedEmail}</span>.</p>
          <Field label="Verification code">
            <input className="field text-center text-2xl tracking-[0.5em] tabular-nums" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} required autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" disabled={otp.length < 4} className="w-full py-3">Continue</Button>
          <button type="button" onClick={resend} disabled={cooldown > 0 || busy}
            className="w-full text-sm text-ink-soft underline underline-offset-4 disabled:no-underline disabled:text-ink-mute">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={finish} className="space-y-4">
          <Field label="Password" hint="At least 6 characters">
            <input className="field" type="password" autoComplete="new-password" minLength={6} required autoFocus
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password">
            <input className="field" type="password" autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          {error?.message?.toLowerCase().includes("otp") && (
            <button type="button" onClick={() => { setStep(1); setError(null); }} className="text-sm underline">Re-enter the code</button>
          )}
          <Button type="submit" loading={busy} className="w-full py-3">Activate account</Button>
        </form>
      )}

      <p className="mt-6 text-sm text-ink-mute">
        Already activated? <Link to="/login" className="font-medium text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </AuthShell>
  );
}
