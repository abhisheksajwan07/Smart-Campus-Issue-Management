import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { get, post } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await get("/auth/me");
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [loadMe]);

  const login = async (email, password) => {
    const res = await post("/auth/login", { email, password });
    setUser(res.data.user);
    loadMe(); // fill phone/createdAt etc.
    return res.data.user;
  };

  const adopt = (u) => {
    setUser(u);
    loadMe();
  };

  const logout = async () => {
    try { await post("/auth/logout"); } catch { /* cookies cleared anyway */ }
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, adopt, reload: loadMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
