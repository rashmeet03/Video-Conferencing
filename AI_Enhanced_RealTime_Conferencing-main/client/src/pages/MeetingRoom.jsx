import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import Whiteboard from '../components/Whiteboard';
import CaptionsOverlay from '../components/CaptionsOverlay';
import TranscriptPanel from '../components/TranscriptPanel';
import { useGestureDetection } from '../hooks/useGestureDetection';

export default function MeetingRoom({ roomId, user, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [peers, setPeers] = useState([]); // array of {socketId, user}
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [captions, setCaptions] = useState([]); // live captions with {id, speaker, text, timestamp}
  const [transcript, setTranscript] = useState([]); // full transcript
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [activeReactions, setActiveReactions] = useState([]); // {id, emoji, user, x, y}
  const [raisedHands, setRaisedHands] = useState(new Set()); // Set of socketIds with raised hands
  const [myHandRaised, setMyHandRaised] = useState(false);
  const gestureDetectionEnabled = true; // Always enabled
  const localVideoRef = useRef();
  const [pcMap] = useState(new Map());
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const captionIdRef = useRef(1);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);

  // Handle detected gestures from AI
  const handleGestureDetected = useCallback((gesture) => {
    console.log('Gesture detected:', gesture);
    sendReaction(gesture);
  }, [user.name, roomId]);

  // Initialize gesture detection
  const { modelLoaded } = useGestureDetection(
    localVideoRef, 
    gestureDetectionEnabled && videoEnabled, 
    handleGestureDetected
  );

  useEffect(() => {
    // Create socket connection only once
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:3011');
    }
    const socket = socketRef.current;

    // Determine if current user is host
    setIsHost(user.role === 'host');

    // ── Register all socket event listeners BEFORE joining ──────────────────
    socket.on('user-joined', ({ socketId, user: joinedUser }) => {
      console.log('User joined:', socketId, joinedUser);
      setPeers(p => {
        if (p.some(peer => peer.socketId === socketId)) return p;
        return [...p, { socketId, user: joinedUser }];
      });
      // Create offer after a small delay to allow tracks to settle
      setTimeout(() => {
        if (localStreamRef.current) {
          createPeer(socketId, false, true);
        }
      }, 300);
    });

    socket.on('user-left', ({ socketId }) => {
      console.log('User left:', socketId);
      setPeers(p => p.filter(peer => peer.socketId !== socketId));
      const pc = pcMap.get(socketId);
      if (pc) { pc.close(); pcMap.delete(socketId); }
      setRemoteStreams(m => { const nm = new Map(m); nm.delete(socketId); return nm; });
      setRaisedHands(prev => {
        const newSet = new Set(prev);
        newSet.delete(socketId);
        return newSet;
      });
    });

    socket.on('room-users', (users) => {
      console.log('Room users:', users);
      const uniqueUsers = [];
      const seenIds = new Set();
      users.forEach(u => {
        if (!seenIds.has(u.socketId)) {
          seenIds.add(u.socketId);
          uniqueUsers.push({ socketId: u.socketId, user: u.user });
        }
      });
      setPeers(uniqueUsers);

      if (uniqueUsers.length > 0) {
        // Stream is guaranteed ready because we await initMedia before joining
        uniqueUsers.forEach((u, i) => {
          setTimeout(() => {
            console.log('Creating peer for existing user:', u.socketId);
            createPeer(u.socketId, false, true);
          }, 100 * (i + 1));
        });
      }
    });

    socket.on('chat-message', msg => setMessages(m => [...m, msg]));

    socket.on('webrtc-offer', async ({ from, sdp }) => {
      console.log('Received offer from:', from);
      const pc = createPeer(from, true, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { target: from, sdp: pc.localDescription });
        console.log('Sent answer to:', from);
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('webrtc-answer', async ({ from, sdp }) => {
      console.log('Received answer from:', from);
      const pc = pcMap.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error('Error setting answer:', err);
        }
      }
    });

    socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
      const pc = pcMap.get(from);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('force-mute', () => toggleAudio(false));
    socket.on('removed-from-room', () => {
      alert('You have been removed from the meeting by the host');
      onLeave();
    });

    socket.on('caption-broadcast', ({ speaker, text, timestamp }) => {
      const caption = { id: captionIdRef.current++, speaker, text, timestamp };
      setCaptions(c => [...c.slice(-5), caption]);
      setTranscript(t => [...t, caption]);
    });

    socket.on('reaction-broadcast', ({ emoji, userName }) => showReaction(emoji, userName));

    socket.on('hand-raised', ({ socketId, userName }) => {
      setRaisedHands(prev => new Set([...prev, socketId]));
    });

    socket.on('hand-lowered', ({ socketId }) => {
      setRaisedHands(prev => {
        const newSet = new Set(prev);
        newSet.delete(socketId);
        return newSet;
      });
    });

    // ── Get camera/mic FIRST, then join room ────────────────────────────────
    (async () => {
      await initMedia();
      // Only join after stream is ready so peer connections get tracks immediately
      socket.emit('join-room', { roomId, user });
    })();

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      socket.off();
      socket.disconnect();
      socketRef.current = null;
      pcMap.forEach(pc => pc.close());
      pcMap.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, [roomId]);

  async function initMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('✅ Local media ready:', stream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error('Camera/mic error:', err);
      // Try audio-only fallback
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = audioOnly;
        console.warn('⚠️ Camera unavailable — audio-only mode');
      } catch (audioErr) {
        console.error('Audio also unavailable:', audioErr);
        alert('Could not access camera or microphone.\n\nPlease:\n1. Allow permissions in your browser\n2. Make sure no other app is using the camera\n3. Try refreshing the page');
      }
    }
  }


  async function toggleScreenShare() {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        // Switch back to camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        // Replace tracks in all peer connections
        const videoTrack = stream.getVideoTracks()[0];
        pcMap.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
        
        setIsScreenSharing(false);
        setVideoEnabled(true);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { cursor: 'always' }, 
          audio: false 
        });
        
        screenStreamRef.current = screenStream;
        
        // Replace video track with screen track
        const screenTrack = screenStream.getVideoTracks()[0];
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        
        // Replace tracks in all peer connections
        pcMap.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        
        setIsScreenSharing(true);
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      if (error.name !== 'NotAllowedError') {
        alert('Failed to share screen. Please try again.');
      }
    }
  }

  function toggleVideo() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }

  function toggleAudio(forceState = null) {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = forceState !== null ? forceState : !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        
        // Stop speech recognition when muted
        if (!audioTrack.enabled && recognitionRef.current) {
          recognitionRef.current.stop();
        } else if (audioTrack.enabled && captionsEnabled && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Already running
          }
        }
      }
    }
  }

  function toggleCaptions() {
    const newState = !captionsEnabled;
    setCaptionsEnabled(newState);
    
    if (newState) {
      startSpeechRecognition();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }

  function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      setCaptionsEnabled(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      const isFinal = event.results[last].isFinal;

      if (isFinal && text.trim()) {
        const caption = {
          id: captionIdRef.current++,
          speaker: user.name,
          text: text.trim(),
          timestamp: Date.now()
        };
        
        // Add to local captions and transcript
        setCaptions(c => [...c.slice(-5), caption]);
        setTranscript(t => [...t, caption]);
        
        // Broadcast to other users
        socketRef.current?.emit('caption-text', { 
          roomId, 
          speaker: user.name, 
          text: text.trim(), 
          timestamp: Date.now() 
        });
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart if no speech detected
        try {
          recognition.start();
        } catch (e) {
          // Already running
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if captions are still enabled and mic is on
      if (captionsEnabled && audioEnabled) {
        try {
          recognition.start();
        } catch (e) {
          console.log('Recognition restart failed:', e);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      console.log('Speech recognition started');
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  }

  function muteUser(socketId) {
    if (isHost) {
      socketRef.current?.emit('host-mute-user', { roomId, targetSocketId: socketId });
    }
  }

  function removeUser(socketId) {
    if (isHost) {
      if (confirm('Remove this user from the meeting?')) {
        socketRef.current?.emit('host-remove-user', { roomId, targetSocketId: socketId });
      }
    }
  }

  function createPeer(targetId, isAnswerer = false, forceOffer = false) {
    let pc = pcMap.get(targetId);
    if (pc) {
      console.log('Peer connection already exists for:', targetId);
      return pc;
    }
    
    console.log('Creating new peer connection for:', targetId, 'isAnswerer:', isAnswerer);
    pc = new RTCPeerConnection({ 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ] 
    });
    pcMap.set(targetId, pc);

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
        console.log('Added local track to peer:', targetId, track.kind);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', { target: targetId, candidate: e.candidate });
        console.log('Sent ICE candidate to:', targetId);
      }
    };
    
    pc.ontrack = (e) => {
      console.log('Received track from:', targetId, e.track.kind);
      const [stream] = e.streams;
      setRemoteStreams(m => {
        const nm = new Map(m);
        nm.set(targetId, stream);
        return nm;
      });
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', targetId, ':', pc.iceConnectionState);
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state for', targetId, ':', pc.connectionState);
      if (['failed','disconnected','closed'].includes(pc.connectionState)) {
        setRemoteStreams(m => { const nm = new Map(m); nm.delete(targetId); return nm; });
      }
    };

    // Only create offer if we're the initiator
    if (forceOffer && !isAnswerer) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('webrtc-offer', { target: targetId, sdp: pc.localDescription });
          console.log('Sent offer to:', targetId);
        } catch (err) {
          console.error('Error creating offer for:', targetId, err);
        }
      })();
    }
    return pc;
  }

  function sendMessage(text) {
    const msg = { roomId, message: text, user };
    socketRef.current?.emit('chat-message', msg);
  }

  function sendReaction(emoji) {
    // Show locally
    showReaction(emoji, user.name);
    // Broadcast to others
    socketRef.current?.emit('reaction', { roomId, emoji, userName: user.name });
    setShowReactions(false);
  }

  function showReaction(emoji, userName) {
    const id = Date.now() + Math.random();
    const x = Math.random() * 60 + 20; // Random position between 20-80%
    const y = Math.random() * 40 + 30; // Random position between 30-70%
    
    setActiveReactions(prev => [...prev, { id, emoji, userName, x, y }]);
    
    // Remove after animation completes
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  }

  function toggleRaiseHand() {
    const newState = !myHandRaised;
    setMyHandRaised(newState);
    
    if (newState) {
      socketRef.current?.emit('raise-hand', { roomId, userName: user.name });
    } else {
      socketRef.current?.emit('lower-hand', { roomId });
    }
  }

  function leave() { onLeave(); }

  return (
    <div style={{ display: 'flex', height: '100vh', background:'var(--color-bg)' }}>
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', position:'relative', padding:16, gap:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ margin:0, color:'var(--color-text)' }}>Room: {roomId}</h3>
            <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--color-text-dim)' }}>
              {user.name} ({isHost ? 'Host' : 'Participant'}) • {peers.length} other{peers.length !== 1 ? 's' : ''} in room
            </p>
          </div>
          {(raisedHands.size > 0 || myHandRaised) && (
            <div style={{ 
              background: 'rgba(255, 165, 0, 0.2)', 
              border: '1px solid #FFA500',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 20 }}>✋</span>
              <div style={{ fontSize: 13, color: 'var(--color-text)' }}>
                <div style={{ fontWeight: 600 }}>{raisedHands.size + (myHandRaised ? 1 : 0)} hand{(raisedHands.size + (myHandRaised ? 1 : 0)) !== 1 ? 's' : ''} raised</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                  {myHandRaised && 'You'}
                  {myHandRaised && raisedHands.size > 0 && ', '}
                  {Array.from(raisedHands).slice(0, 2).map(socketId => {
                    const peer = peers.find(p => p.socketId === socketId);
                    return peer?.user?.name;
                  }).filter(Boolean).join(', ')}
                  {raisedHands.size > 2 && ` +${raisedHands.size - 2} more`}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className='flex gap' style={{ alignItems:'flex-start', gap:12 }}>
          {/* Local Video - smaller when screen sharing */}
          <div style={{ position:'relative', border:'2px solid var(--color-primary)', borderRadius:8, overflow:'hidden', background:'#000' }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: isScreenSharing ? 300 : 200, aspectRatio:'16/9', display:'block' }} />
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.75)', padding:'6px 8px' }}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--color-text)' }}>
                {user.name} (You) {isScreenSharing && '🖥️ Sharing'}
              </div>
            </div>
          </div>
          
          <div style={{ flex:1 }}>
            <VideoGrid 
              peers={peers} 
              remoteStreams={remoteStreams}
              isHost={isHost}
              onMuteUser={muteUser}
              onRemoveUser={removeUser}
              raisedHands={raisedHands}
              screenSharingUser={isScreenSharing ? user.name : null}
            />
          </div>
        </div>
        
        {showWhiteboard && (
          <div className='panel whiteboard-wrapper' style={{ padding:8, position:'relative' }}>
            <Whiteboard roomId={roomId} socket={socketRef.current} />
          </div>
        )}
        
        {/* Live Captions Display */}
        {captionsEnabled && captions.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 800,
            width: '80%',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 16,
            lineHeight: 1.5,
            zIndex: 9
          }}>
            {captions.slice(-3).map((caption) => (
              <div key={caption.id} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: '#4fc3f7' }}>{caption.speaker}: </span>
                <span>{caption.text}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Bottom Control Bar */}
        <div style={{ 
          position: 'absolute', 
          bottom: 20, 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          background: 'rgba(30, 30, 30, 0.95)',
          padding: '12px 24px',
          borderRadius: 40,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10
        }}>
          <button 
            onClick={toggleVideo}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: videoEnabled ? 'rgba(255,255,255,0.1)' : '#d32f2f',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? '📹' : '🚫'}
          </button>
          
          <button 
            onClick={() => toggleAudio()}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: audioEnabled ? 'rgba(255,255,255,0.1)' : '#d32f2f',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {audioEnabled ? '🎤' : '🔇'}
          </button>
          
          <button 
            onClick={toggleScreenShare}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: isScreenSharing ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            🖥️
          </button>
          
          <button 
            onClick={toggleCaptions}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: captionsEnabled ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Toggle live captions"
          >
            CC
          </button>
          
          <button 
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: showWhiteboard ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Toggle whiteboard"
          >
            🖊️
          </button>
          
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: showTranscript ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="View transcript"
          >
            📄
          </button>
          
          <button 
            onClick={() => setShowReactions(!showReactions)}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: showReactions ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Send reaction"
          >
            😊
          </button>
          
          <button 
            onClick={toggleRaiseHand}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: myHandRaised ? '#FFA500' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={myHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            ✋
          </button>
          
          <button 
            onClick={leave}
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              background: '#d32f2f',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              marginLeft: 8
            }}
            title="Leave meeting"
          >
            📞
          </button>
        </div>
        
        {/* Reaction Picker */}
        {showReactions && (
          <div style={{
            position: 'absolute',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 30, 30, 0.95)',
            padding: '12px',
            borderRadius: 12,
            display: 'flex',
            gap: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 11
          }}>
            {['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥'].map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 24,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 8,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        {/* Floating Reactions */}
        {activeReactions.map(reaction => (
          <div
            key={reaction.id}
            style={{
              position: 'absolute',
              left: `${reaction.x}%`,
              top: `${reaction.y}%`,
              fontSize: 48,
              animation: 'float-up 3s ease-out forwards',
              zIndex: 100,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}
          >
            <div>{reaction.emoji}</div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(0,0,0,0.7)',
              padding: '4px 8px',
              borderRadius: 12,
              whiteSpace: 'nowrap'
            }}>
              {reaction.userName === user.name ? 'You' : reaction.userName}
            </div>
          </div>
        ))}
      </div>
      <div style={{ width:320, borderLeft:'1px solid var(--color-border)', display:'flex', flexDirection:'column' }}>
        <ChatPanel messages={messages} onSend={sendMessage} />
      </div>
      {showTranscript && (
        <TranscriptPanel 
          transcript={transcript} 
          onClose={() => setShowTranscript(false)}
          roomId={roomId}
        />
      )}
    </div>
  );
}
