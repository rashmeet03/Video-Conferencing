import React, { useState, useRef, useEffect } from 'react';
export default function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--color-bg-alt)' }}>
      <div style={{ padding:12, borderBottom:'1px solid var(--color-border)' }}>
        <h4 style={{ margin:0, fontSize:14, color:'var(--color-text)' }}>Chat</h4>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:12, fontSize:13 }}>
        {messages.map((m,i) => (
          <div key={i} style={{ marginBottom:12, padding:8, background:'var(--color-surface)', borderRadius:6, borderLeft:'3px solid var(--color-primary)' }}>
            <div style={{ fontSize:11, color:'var(--color-text-dim)', marginBottom:4 }}>
              <strong style={{ color:'var(--color-primary-accent)' }}>{m.user?.name || 'User'}</strong>
              <span style={{ marginLeft:8 }}>{new Date(m.ts).toLocaleTimeString()}</span>
            </div>
            <div style={{ color:'var(--color-text)' }}>{m.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form style={{ display:'flex', gap:8, padding:12, borderTop:'1px solid var(--color-border)' }} onSubmit={e=>{ e.preventDefault(); if(!text.trim()) return; onSend(text); setText(''); }}>
        <input 
          style={{ flex:1, padding:8, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:4, color:'var(--color-text)' }} 
          value={text} 
          onChange={e=>setText(e.target.value)} 
          placeholder='Type a message...' 
        />
        <button type='submit' style={{ padding:'8px 16px', background:'var(--color-primary)', color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontWeight:500 }}>
          Send
        </button>
      </form>
    </div>
  );
}
