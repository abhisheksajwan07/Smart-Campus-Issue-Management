// Thin fetch wrapper around the Express backend.
// Auth lives in httpOnly cookies, so every request sends credentials.
const rawApiOrigin = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
export const API_ORIGIN = !rawApiOrigin
  ? ""
  : /^https?:\/\//i.test(rawApiOrigin)
  ? rawApiOrigin
  : `https://${rawApiOrigin}`;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
  /** Field errors from the backend's zod validator: { field: message } */
  get fields() {
    const out = {};
    (this.data?.errors || []).forEach((e) => (out[e.field] = e.message));
    return out;
  }
}

const NO_REFRESH = ["/auth/login", "/auth/refresh-token", "/auth/logout", "/auth/register",
  "/auth/register-student", "/auth/verify-enrollment", "/auth/resend-otp"];
const SESSION_KEY = "campus_has_session";

export function markSession(active) {
  try {
    if (active) localStorage.setItem(SESSION_KEY, "1");
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore storage errors */ }
}

export function hasStoredSession() {
  try { return localStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}

let refreshing = null;

function send(path, { method = "GET", body, form } = {}) {
  const opts = { method, credentials: "include", headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  return fetch(`${API_ORIGIN}/api${path}`, opts);
}

export function refreshSession() {
  if (!refreshing) {
    refreshing = send("/auth/refresh-token", { method: "POST", body: {} })
      .then((r) => {
        if (!r.ok) markSession(false);
        return r.ok;
      })
      .catch(() => {
        markSession(false);
        return false;
      })
      .finally(() => setTimeout(() => (refreshing = null), 0));
  }
  return refreshing;
}

export async function api(path, options = {}, canRetry = true) {
  let res;
  try {
    res = await send(path, options);
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running on port 5000.", 0);
  }

  const shouldTryRefresh =
    res.status === 401 &&
    canRetry &&
    !NO_REFRESH.includes(path) &&
    (path !== "/auth/me" || hasStoredSession());

  if (shouldTryRefresh) {
    const ok = await refreshSession();
    if (ok) return api(path, options, false);
    markSession(false);
    window.dispatchEvent(new Event("auth:expired"));
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: "POST", body });
export const patch = (p, body) => api(p, { method: "PATCH", body });

export function qs(params) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && s.set(k, v));
  const str = s.toString();
  return str ? `?${str}` : "";
}

export const fileUrl = (url) => (!url ? null : url.startsWith("http") ? url : `${API_ORIGIN}${url}`);
