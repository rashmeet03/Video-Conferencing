/* global io */

const els = {
  connStatus: document.getElementById("connStatus"),
  roomStatus: document.getElementById("roomStatus"),
  hint: document.getElementById("hint"),
  roomInput: document.getElementById("roomInput"),
  joinBtn: document.getElementById("joinBtn"),
  leaveBtn: document.getElementById("leaveBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  muteBtn: document.getElementById("muteBtn"),
  camBtn: document.getElementById("camBtn"),
  localVideo: document.getElementById("localVideo"),
  remoteVideos: document.getElementById("remoteVideos"),
  chatMessages: document.getElementById("chatMessages"),
  chatInput: document.getElementById("chatInput"),
  chatSendBtn: document.getElementById("chatSendBtn"),
};

const qsRoom = new URLSearchParams(window.location.search).get("room");
if (qsRoom) els.roomInput.value = qsRoom;

const socket = io(); // served from same origin (backend)

let localStream = null;
let peerConnections = {}; // Map of socketId -> RTCPeerConnection
let pendingCandidates = {}; // Map of socketId -> array of candidates
let joinedRoom = null;
let username = "";

function setPill(el, text, kind) {
  el.textContent = text;
  el.classList.remove("pill-ok", "pill-warn", "pill-bad");
  if (kind) el.classList.add(kind);
}

function setHint(msg) {
  els.hint.textContent = msg || "";
}

function normalizeRoom(input) {
  const r = (input || "").trim();
  return r.length ? r : "";
}

async function ensureLocalMedia() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  els.localVideo.srcObject = localStream;
  return localStream;
}

function createVideoElement(socketId) {
  const wrapper = document.createElement("div");
  wrapper.className = "videoWrap";
  wrapper.id = `video-wrapper-${socketId}`;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = `User ${socketId.slice(-4)}`;

  const video = document.createElement("video");
  video.id = `remote-${socketId}`;
  video.autoplay = true;
  video.playsinline = true;

  wrapper.appendChild(label);
  wrapper.appendChild(video);
  els.remoteVideos.appendChild(wrapper);

  return video;
}

function removeVideoElement(socketId) {
  const wrapper = document.getElementById(`video-wrapper-${socketId}`);
  if (wrapper) wrapper.remove();
}

function createPeerConnection(socketId) {
  const conn = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  conn.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    socket.emit("signal", socketId, { type: "ice-candidate", candidate: ev.candidate });
  };

  conn.ontrack = (ev) => {
    let video = document.getElementById(`remote-${socketId}`);
    if (!video) {
      video = createVideoElement(socketId);
    }

    const [stream] = ev.streams;
    if (stream) {
      video.srcObject = stream;
    } else {
      const s = video.srcObject || new MediaStream();
      s.addTrack(ev.track);
      video.srcObject = s;
    }
  };

  conn.onconnectionstatechange = () => {
    const st = conn.connectionState;
    if (st === "disconnected" || st === "failed") {
      removePeerConnection(socketId);
    }
  };

  return conn;
}

async function startOffer(socketId) {
  await ensureLocalMedia();

  if (!peerConnections[socketId]) {
    peerConnections[socketId] = createPeerConnection(socketId);
    localStream.getTracks().forEach((t) => peerConnections[socketId].addTrack(t, localStream));
  }

  const offer = await peerConnections[socketId].createOffer();
  await peerConnections[socketId].setLocalDescription(offer);
  socket.emit("signal", socketId, { type: "offer", sdp: peerConnections[socketId].localDescription });
}

async function handleOffer(fromId, sdp) {
  await ensureLocalMedia();

  if (!peerConnections[fromId]) {
    peerConnections[fromId] = createPeerConnection(fromId);
    localStream.getTracks().forEach((t) => peerConnections[fromId].addTrack(t, localStream));
  }

  await peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(sdp));
  await applyPendingCandidates(fromId);
  const answer = await peerConnections[fromId].createAnswer();
  await peerConnections[fromId].setLocalDescription(answer);
  socket.emit("signal", fromId, { type: "answer", sdp: peerConnections[fromId].localDescription });
}

async function handleAnswer(fromId, sdp) {
  if (!peerConnections[fromId]) return;
  await peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(sdp));
  await applyPendingCandidates(fromId);
}

async function handleIceCandidate(fromId, candidate) {
  if (!candidate) return;
  const pc = peerConnections[fromId];
  if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
    if (!pendingCandidates[fromId]) pendingCandidates[fromId] = [];
    pendingCandidates[fromId].push(candidate);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
    // ignore
  }
}

async function applyPendingCandidates(socketId) {
  const pc = peerConnections[socketId];
  if (!pc || !pendingCandidates[socketId] || pendingCandidates[socketId].length === 0) return;
  
  const toApply = pendingCandidates[socketId];
  pendingCandidates[socketId] = [];
  
  for (const cand of toApply) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch {
      // ignore individual failures
    }
  }
}

function removePeerConnection(socketId) {
  const pc = peerConnections[socketId];
  if (pc) {
    try { pc.ontrack = null; pc.onicecandidate = null; } catch {}
    try { pc.close(); } catch {}
    delete peerConnections[socketId];
  }
  delete pendingCandidates[socketId];
  removeVideoElement(socketId);
}

function resetAllPeers() {
  Object.keys(peerConnections).forEach(removePeerConnection);
  peerConnections = {};
  pendingCandidates = {};
  if (els.remoteVideos) els.remoteVideos.innerHTML = "";
}

function appendChatMessage({ sender, text, isOwn }) {
  if (!els.chatMessages) return;
  const wrapper = document.createElement("div");
  wrapper.className = "chatMessage" + (isOwn ? " me" : "");

  const senderEl = document.createElement("div");
  senderEl.className = "chatSender";
  senderEl.textContent = sender || (isOwn ? "You" : "Peer");

  const textEl = document.createElement("div");
  textEl.className = "chatText";
  textEl.textContent = text;

  wrapper.appendChild(senderEl);
  wrapper.appendChild(textEl);

  els.chatMessages.appendChild(wrapper);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function sendChatMessage() {
  if (!joinedRoom) {
    setHint("Join a room before sending chat.");
    return;
  }
  const text = (els.chatInput.value || "").trim();
  if (!text) return;

  if (!username) {
    username = socket.id ? `User-${socket.id.slice(-4)}` : "User";
  }

  socket.emit("chat-message", text, username);
  els.chatInput.value = "";
}

async function joinRoom() {
  const room = normalizeRoom(els.roomInput.value);
  if (!room) {
    setHint("Enter a room name (e.g. demo).");
    return;
  }

  joinedRoom = room;
  setPill(els.roomStatus, `room: ${room}`, null);

  try {
    await ensureLocalMedia();
  } catch (e) {
    setHint("Camera/mic permission denied.");
    return;
  }

  socket.emit("join-call", room);

  els.joinBtn.disabled = true;
  els.leaveBtn.disabled = false;
  els.muteBtn.disabled = false;
  els.camBtn.disabled = false;
  if (els.chatInput && els.chatSendBtn) {
    els.chatInput.disabled = false;
    els.chatSendBtn.disabled = false;
  }
  setHint("Joined. Waiting for the other person…");
}

function leaveRoom() {
  try { socket.disconnect(); } catch {}

  resetAllPeers();

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }
  localStream = null;
  els.localVideo.srcObject = null;

  joinedRoom = null;
  setPill(els.roomStatus, "room: -", null);

  els.joinBtn.disabled = false;
  els.leaveBtn.disabled = true;
  els.muteBtn.disabled = true;
  els.camBtn.disabled = true;

  if (els.chatInput && els.chatSendBtn && els.chatMessages) {
    els.chatInput.disabled = true;
    els.chatSendBtn.disabled = true;
    els.chatMessages.innerHTML = "";
  }

  try { socket.connect(); } catch {}
  setHint("Left the room.");
}

function copyLink() {
  const room = normalizeRoom(els.roomInput.value);
  if (!room) {
    setHint("Enter a room name first.");
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  navigator.clipboard.writeText(url.toString()).then(
    () => setHint("Link copied."),
    () => setHint(`Copy this: ${url.toString()}`)
  );
}

function toggleMute() {
  if (!localStream) return;
  const audio = localStream.getAudioTracks()[0];
  if (!audio) return;
  audio.enabled = !audio.enabled;
  els.muteBtn.textContent = audio.enabled ? "Mute" : "Unmute";
}

function toggleCam() {
  if (!localStream) return;
  const video = localStream.getVideoTracks()[0];
  if (!video) return;
  video.enabled = !video.enabled;
  els.camBtn.textContent = video.enabled ? "Camera off" : "Camera on";
}

// UI events
els.joinBtn.addEventListener("click", joinRoom);
els.leaveBtn.addEventListener("click", leaveRoom);
els.copyLinkBtn.addEventListener("click", copyLink);
els.muteBtn.addEventListener("click", toggleMute);
els.camBtn.addEventListener("click", toggleCam);
els.roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinRoom();
});
if (els.chatSendBtn && els.chatInput) {
  els.chatSendBtn.addEventListener("click", sendChatMessage);
  els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

// Socket events
socket.on("connect", () => {
  setPill(els.connStatus, "connected", "pill-ok");
  setHint(joinedRoom ? "Connected to signaling server." : "Enter a room and click Join.");
});

socket.on("disconnect", () => {
  setPill(els.connStatus, "disconnected", "pill-warn");
});

socket.on("existing-users", async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  setHint(`Connecting to ${ids.length} participant(s)...`);
  for (const id of ids) {
    await startOffer(id);
  }
});

socket.on("user-joined", async (id) => {
  if (!id || id === socket.id) return;
  setHint(`New participant joined.`);
  await startOffer(id);
});

socket.on("user-left", (id) => {
  if (id) {
    setHint(`A participant left.`);
    removePeerConnection(id);
    appendChatMessage({ sender: "System", text: `User ${id.slice(-4)} left the room.`, isOwn: false });
  }
});

socket.on("signal", async (fromId, payload) => {
  if (!payload || typeof payload !== "object") return;

  if (payload.type === "offer") {
    await handleOffer(fromId, payload.sdp);
    return;
  }
  if (payload.type === "answer") {
    await handleAnswer(fromId, payload.sdp);
    return;
  }
  if (payload.type === "ice-candidate") {
    await handleIceCandidate(fromId, payload.candidate);
  }
});

// Chat messages from server
socket.on("chat-message", (data, sender, socketId) => {
  const isOwn = socketId === socket.id;
  appendChatMessage({
    sender: isOwn ? "You" : sender || "Peer",
    text: data,
    isOwn,
  });
});

// Initial UI state
setPill(els.connStatus, socket.connected ? "connected" : "disconnected", socket.connected ? "pill-ok" : "pill-warn");
setPill(els.roomStatus, "room: -", null);
setHint("Enter a room and click Join.");
