import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t=localStorage.getItem('token'); const u=localStorage.getItem('user'); if(t&&u) setUser(JSON.parse(u)); setLoading(false); }, []);
  const login = async (email, password) => { const {data}=await authAPI.login({email,password}); localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); return data; };
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };
  return <AuthContext.Provider value={{user,login,logout,loading,isAuthenticated:!!user}}>{children}</AuthContext.Provider>;
};
export const useAuth = () => { const c=useContext(AuthContext); if(!c) throw new Error('useAuth must be within AuthProvider'); return c; };
