import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-8xl font-light tracking-tight">404</p>
      <p className="mt-3 text-ink-mute">This page doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Go to dashboard</Link>
    </div>
  );
}
