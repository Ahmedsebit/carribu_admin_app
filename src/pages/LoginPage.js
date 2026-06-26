import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
const LoginPage = () => {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  const {login}=useAuth(); const navigate=useNavigate();
  const handleSubmit = async e => { e.preventDefault(); setError(''); setLoading(true); try { await login(email,password); navigate('/dashboard'); } catch(err) { setError(err.response?.data?.error||'Login failed.'); } finally { setLoading(false); } };
  return (
    <div className="login-page"><div className="login-card">
      <h1>🚐 Carribu App</h1><p>Sign in to manage your school's transport fleet</p>
      {error&&<div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label>Email</label><input type="email" className="form-control" placeholder="admin@school.co.ke" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        <div className="form-group"><label>Password</label><input type="password" className="form-control" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
      </form>
      <div style={{marginTop:'1.5rem',padding:'1rem',background:'#f0f9ff',borderRadius:'8px',fontSize:'.8rem',color:'#1e40af'}}>
        <strong>Carribu App — Nairobi Academy:</strong><br/>Admin: admin@nairobiacademy.co.ke / admin123<br/>Driver: driver1@nairobiacademy.co.ke / driver123<br/>Parent: parent1@gmail.com / parent123
      </div>
    </div></div>);
};
export default LoginPage;
