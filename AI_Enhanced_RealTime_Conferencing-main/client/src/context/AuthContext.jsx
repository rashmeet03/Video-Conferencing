import React, { createContext, useContext, useState } from 'react';
import { api, setToken } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Bypassing authentication for demo execution
  const [user, setUser] = useState({ name: 'Demo User', role: 'Host', id: 'demo1234', email: 'demo@college.edu' });
  const [jwt, setJwt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function login(email, password) {
    setLoading(true); setError(null);
    try {
      const res = await api.login({ email, password });
      setUser(res.user); setJwt(res.token); setToken(res.token);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function register(name, email, password, role='participant') {
    setLoading(true); setError(null);
    try {
      const res = await api.register({ name, email, password, role });
      setUser(res.user); setJwt(res.token); setToken(res.token);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  function logout() { setUser(null); setJwt(null); setToken(null); }

  return <AuthContext.Provider value={{ user, jwt, loading, error, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
