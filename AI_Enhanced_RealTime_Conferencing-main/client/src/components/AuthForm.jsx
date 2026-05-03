import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthForm() {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'participant' });

  function handleChange(e){ setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  async function handleSubmit(e){
    e.preventDefault();
    if(mode==='login') await login(form.email, form.password);
    else await register(form.name, form.email, form.password, form.role);
  }

  return (
    <div className='panel' style={{ maxWidth:380, margin:'48px auto' }}>
      <h2 style={{ marginTop:0 }}>{mode==='login'?'Login':'Register'}</h2>
      <form onSubmit={handleSubmit} className='flex' style={{ flexDirection:'column', gap:12 }}>
        {mode==='register' && <input name='name' placeholder='Name' value={form.name} onChange={handleChange} required />}
        <input name='email' placeholder='Email' type='email' value={form.email} onChange={handleChange} required />
        <input name='password' placeholder='Password' type='password' value={form.password} onChange={handleChange} required />
        {mode==='register' && <select name='role' value={form.role} onChange={handleChange}><option value='participant'>Participant</option><option value='host'>Host</option></select>}
        <button type='submit' disabled={loading}>{loading?'Please wait':'Submit'}</button>
      </form>
      <button className='link-btn' onClick={()=> setMode(m=> m==='login'?'register':'login')} style={{ marginTop:16 }}>
        Switch to {mode==='login'?'Register':'Login'}
      </button>
      {error && <div style={{ color:'var(--color-danger)', marginTop:12 }}>{error}</div>}
    </div>
  );
}
