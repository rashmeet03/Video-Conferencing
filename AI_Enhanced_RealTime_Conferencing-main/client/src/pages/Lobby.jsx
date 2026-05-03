import React, { useState } from 'react';

export default function Lobby({ onJoin, user }) {
  const [room, setRoom] = useState('');
  const [creating, setCreating] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState(null);

  function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function createMeeting() {
    setCreating(true);
    setError(null);
    try {
      const code = generateCode();
      const meeting = {
        _id: Date.now().toString(),
        code,
        title: `Session ${new Date().toLocaleTimeString()}`,
      };
      setRoom(code);
      setMeetings(m => [meeting, ...m]);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  function refreshMeetings() {
    // No backend – meetings list is local state only
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 48,
          height: 48,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          📹
        </div>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: 32, 
            fontWeight: 700, 
            color: '#fff',
            letterSpacing: '-0.5px'
          }}>
            Meetly
          </h1>
          <p style={{ 
            margin: 0, 
            fontSize: 14, 
            color: 'rgba(255,255,255,0.8)',
            fontWeight: 400
          }}>
            Connect, Collaborate, Communicate
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 24
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: 48,
          maxWidth: 600,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ 
              margin: '0 0 8px', 
              fontSize: 28, 
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Welcome Back! 👋
            </h2>
            <div style={{ fontSize: 16, color: '#666', fontWeight: 500 }}>
              {user.name}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              fontSize: 14, 
              fontWeight: 600,
              color: '#333'
            }}>
              Room Code
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input 
                value={room} 
                onChange={e => setRoom(e.target.value)} 
                placeholder="Enter room code" 
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: '2px solid #e0e0e0',
                  fontSize: 15,
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <button 
                onClick={() => onJoin(room)}
                style={{
                  padding: '14px 32px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Join Meeting
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 24,
            paddingTop: 24,
            borderTop: '1px solid #e0e0e0'
          }}>
            <button 
              onClick={createMeeting} 
              disabled={creating}
              style={{
                flex: 1,
                padding: '14px 24px',
                borderRadius: 12,
                border: '2px solid #667eea',
                background: 'transparent',
                color: '#667eea',
                fontSize: 15,
                fontWeight: 600,
                cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => !creating && (e.target.style.background = '#667eea', e.target.style.color = '#fff')}
              onMouseLeave={(e) => !creating && (e.target.style.background = 'transparent', e.target.style.color = '#667eea')}
            >
              {creating ? '⏳ Creating...' : '➕ Create New Meeting'}
            </button>
            <button 
              onClick={refreshMeetings}
              style={{
                padding: '14px 24px',
                borderRadius: 12,
                border: '2px solid #e0e0e0',
                background: '#fff',
                color: '#666',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.target.style.borderColor = '#667eea', e.target.style.color = '#667eea')}
              onMouseLeave={(e) => (e.target.style.borderColor = '#e0e0e0', e.target.style.color = '#666')}
            >
              🔄 Refresh
            </button>
          </div>

          {error && (
            <div style={{ 
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(211, 47, 47, 0.1)',
              border: '1px solid rgba(211, 47, 47, 0.3)',
              color: '#d32f2f',
              fontSize: 14,
              marginBottom: 24
            }}>
              ⚠️ {error}
            </div>
          )}

          {meetings.length > 0 && (
            <div style={{
              padding: '24px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              border: '1px solid rgba(102, 126, 234, 0.2)'
            }}>
              <h4 style={{ 
                margin: '0 0 16px', 
                fontSize: 18, 
                fontWeight: 600,
                color: '#333'
              }}>
                📋 Your Recent Meetings
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {meetings.map(m => (
                  <button
                    key={m._id}
                    onClick={() => { setRoom(m.code); onJoin(m.code); }}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 12,
                      border: '1px solid #e0e0e0',
                      background: '#fff',
                      color: '#333',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => (e.target.style.borderColor = '#667eea', e.target.style.transform = 'translateX(4px)')}
                    onMouseLeave={(e) => (e.target.style.borderColor = '#e0e0e0', e.target.style.transform = 'translateX(0)')}
                  >
                    <span>{m.title}</span>
                    <span style={{ 
                      fontSize: 12, 
                      color: '#666',
                      background: 'rgba(102, 126, 234, 0.1)',
                      padding: '4px 12px',
                      borderRadius: 8,
                      fontWeight: 600
                    }}>
                      {m.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '24px 40px',
        textAlign: 'center'
      }}>
        <div style={{ 
          color: '#fff', 
          fontSize: 14,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}>
          Made with <span style={{ color: '#ff6b6b', fontSize: 18, animation: 'pulse 1.5s ease-in-out infinite' }}>❤️</span> by the Meetly Team
        </div>
        <div style={{ 
          color: 'rgba(255,255,255,0.7)', 
          fontSize: 12,
          marginTop: 8
        }}>
          © 2026 Meetly. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
