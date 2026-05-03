import React from 'react';

export default function TranscriptPanel({ transcript, onClose, roomId }) {
  const downloadTranscript = () => {
    const content = transcript.map(entry => 
      `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.speaker}: ${entry.text}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${roomId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      right: 336,
      top: 0,
      bottom: 0,
      width: 400,
      background: 'var(--color-surface)',
      borderLeft: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: 'var(--color-text)', fontSize: 16 }}>Transcript</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={downloadTranscript}
            disabled={transcript.length === 0}
            style={{
              padding: '6px 12px',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: transcript.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              opacity: transcript.length === 0 ? 0.5 : 1
            }}
          >
            Download
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        {transcript.length === 0 ? (
          <div style={{ color: 'var(--color-text-dim)', fontSize: 14, textAlign: 'center', marginTop: 20 }}>
            No transcript yet. Enable captions to start recording.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {transcript.map((entry, idx) => (
              <div key={idx} style={{
                padding: '8px 12px',
                background: 'var(--color-bg)',
                borderRadius: 6,
                borderLeft: '3px solid var(--color-primary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 13 }}>
                    {entry.speaker}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: 1.5 }}>
                  {entry.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
