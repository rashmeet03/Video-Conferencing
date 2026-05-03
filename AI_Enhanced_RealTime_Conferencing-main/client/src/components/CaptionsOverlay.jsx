import React from 'react';

export default function CaptionsOverlay({ captions, enabled }) {
  if (!enabled || captions.length === 0) return null;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: 10,
      right: 10,
      background: 'rgba(0,0,0,0.85)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 6,
      fontSize: 14,
      maxHeight: 120,
      overflowY: 'auto'
    }}>
      {captions.slice(-3).map((caption) => (
        <div key={caption.id} style={{ marginBottom: 4, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600, color: '#4fc3f7' }}>{caption.speaker}: </span>
          <span>{caption.text}</span>
        </div>
      ))}
    </div>
  );
}

