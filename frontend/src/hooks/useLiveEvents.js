import { useEffect, useRef, useState } from "react";
import { API_ORIGIN, hasStoredSession, markSession, refreshSession } from "../lib/api";

const EVENTS = ["NEW_COMPLAINT", "STATUS_UPDATED", "AI_OVERRIDDEN"];

/**
 * Subscribes to the backend SSE stream (GET /api/complaints/stream).
 * Calls onEvent(type, payload) for complaint events and keeps a short feed.
 */
export function useLiveEvents(enabled, onEvent) {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState([]);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let es;
    let retry;
    let closed = false;

    const open = () => {
      es = new EventSource(`${API_ORIGIN}/api/complaints/stream`, { withCredentials: true });
      es.addEventListener("CONNECTED", () => setConnected(true));
      EVENTS.forEach((type) =>
        es.addEventListener(type, (e) => {
          let payload = {};
          try { payload = JSON.parse(e.data); } catch { /* ignore */ }
          setFeed((f) => [{ id: `${Date.now()}-${Math.random()}`, type, payload, at: new Date() }, ...f].slice(0, 20));
          cb.current?.(type, payload);
        })
      );
      es.onerror = async () => {
        setConnected(false);
        es.close();
        if (closed || !hasStoredSession()) return;
        const ok = await refreshSession(); // access cookie may have expired
        if (!ok) {
          markSession(false);
          window.dispatchEvent(new Event("auth:expired"));
          return;
        }
        retry = setTimeout(open, 5000);
      };
    };
    open();

    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
    };
  }, [enabled]);

  return { connected, feed };
}
