import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { get, post, patch, markSession, refreshSession } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await get("/auth/me");
      markSession(true);
      setUser(res.data);
      return res.data;
    } catch {
      markSession(false);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onExpired = () => {
      markSession(false);
      setUser(null);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [loadMe]);

  // Proactively refresh the 15m access cookie every 12 minutes while signed in
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      refreshSession().catch(() => {});
    }, 12 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  const login = async (email, password) => {
    const res = await post("/auth/login", { email, password });
    markSession(true);
    setUser(res.data.user);
    await loadMe().catch(() => res.data.user);
    return res.data.user;
  };

  const adopt = async (u) => {
    markSession(true);
    setUser(u);
    await loadMe().catch(() => u);
  };

  const updateProfile = async (payload) => {
    const res = await patch("/auth/me", payload);
    setUser(res.data);
    return res.data;
  };

  const logout = async () => {
    try { await post("/auth/logout"); } catch { /* cookies cleared anyway */ }
    markSession(false);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, adopt, updateProfile, reload: loadMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
