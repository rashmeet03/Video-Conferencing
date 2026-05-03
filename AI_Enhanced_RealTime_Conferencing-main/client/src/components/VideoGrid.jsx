import React, { useEffect, useRef } from 'react';

function RemoteVideo({ stream, peerInfo, isHost, onMute, onRemove, hasHandRaised, isScreenSharing }) {
  const ref = useRef();
  
  useEffect(() => {
    if (ref.current && stream) {
      console.log('Setting video stream for:', peerInfo.user?.name, stream);
      ref.current.srcObject = stream;
      // Force play in case autoplay didn't work
      ref.current.play().catch(err => console.log('Video play error:', err));
    }
  }, [stream, peerInfo.user?.name]);
  
  // If this user is screen sharing, make it larger
  const videoStyle = isScreenSharing ? {
    width: '100%',
    maxWidth: 800,
    aspectRatio: '16/9',
    display: 'block'
  } : {
    width: 200,
    aspectRatio: '16/9',
    display: 'block'
  };
  
  return (
    <div style={{ 
      position:'relative', 
      border: isScreenSharing ? '3px solid var(--color-primary)' : '2px solid var(--color-border)', 
      borderRadius:8, 
      overflow:'hidden', 
      background:'#000',
      flex: isScreenSharing ? '1 1 100%' : 'none'
    }}>
      {hasHandRaised && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: '#FFA500',
          borderRadius: '50%',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          zIndex: 1,
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          ✋
        </div>
      )}
      <video ref={ref} autoPlay muted playsInline style={videoStyle} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.75)', padding:'6px 8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--color-text)' }}>
            {peerInfo.user?.name || 'User'} {isScreenSharing && '🖥️ Sharing Screen'}
          </div>
          <div style={{ fontSize:10, color:'var(--color-text-dim)' }}>{peerInfo.user?.role || 'participant'}</div>
        </div>
        {isHost && (
          <div style={{ display:'flex', gap:4 }}>
            <button 
              onClick={() => onMute(peerInfo.socketId)}
              style={{ padding:'4px 8px', fontSize:10, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:3, cursor:'pointer', color:'var(--color-text)' }}
              title="Mute user"
            >
              🔇
            </button>
            <button 
              onClick={() => onRemove(peerInfo.socketId)}
              style={{ padding:'4px 8px', fontSize:10, background:'#d32f2f', border:'none', borderRadius:3, cursor:'pointer', color:'#fff' }}
              title="Remove user"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideoGrid({ peers, remoteStreams, isHost, onMuteUser, onRemoveUser, raisedHands, screenSharingUser }) {
  // Only show peers that have established streams
  const connectedPeers = peers.filter(peer => remoteStreams?.get(peer.socketId));
  
  // Detect if any peer is screen sharing (heuristic: video track with large resolution)
  const detectScreenShare = (stream) => {
    if (!stream) return false;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return false;
    const settings = videoTrack.getSettings();
    // Screen shares typically have higher resolution or specific constraints
    return settings.width > 1280 || settings.height > 720;
  };
  
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {connectedPeers.length === 0 && (
        <div style={{ color:'var(--color-text-dim)', fontSize:13, padding:12 }}>
          Waiting for others to join...
        </div>
      )}
      {connectedPeers.map(peer => {
        const stream = remoteStreams.get(peer.socketId);
        const isScreenSharing = detectScreenShare(stream);
        return (
          <RemoteVideo 
            key={peer.socketId} 
            stream={stream} 
            peerInfo={peer}
            isHost={isHost}
            onMute={onMuteUser}
            onRemove={onRemoveUser}
            hasHandRaised={raisedHands?.has(peer.socketId)}
            isScreenSharing={isScreenSharing}
          />
        );
      })}
    </div>
  );
}
