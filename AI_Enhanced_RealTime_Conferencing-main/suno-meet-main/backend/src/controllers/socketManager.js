import { Server } from "socket.io";

let connections = {}; // roomId -> [{ socketId, user }]
let messages = {}; // roomId -> [{ user, message, ts }]

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true,
        }
    });

    // Helper: find which room a socket is in
    function findRoom(socketId) {
        for (const [roomId, members] of Object.entries(connections)) {
            if (members.some(m => m.socketId === socketId)) return roomId;
        }
        return null;
    }

    io.on("connection", (socket) => {

        // ─── join-room (used by React client) ─────────────────────────────────
        socket.on("join-room", ({ roomId, user }) => {
            if (!roomId) return;

            if (!connections[roomId]) connections[roomId] = [];

            // Avoid duplicate entries
            if (!connections[roomId].some(m => m.socketId === socket.id)) {
                connections[roomId].push({ socketId: socket.id, user });
            }

            socket.join(roomId);

            // Tell the joiner about existing members (excluding themselves)
            const others = connections[roomId].filter(m => m.socketId !== socket.id);
            socket.emit("room-users", others);

            // Tell everyone else a new user joined
            socket.to(roomId).emit("user-joined", { socketId: socket.id, user });

            console.log(`[room:${roomId}] ${user?.name || socket.id} joined. Members: ${connections[roomId].length}`);
        });

        // ─── Legacy join-call (kept for backwards compat) ─────────────────────
        socket.on("join-call", (path) => {
            if (!path || typeof path !== "string") return;
            if (!connections[path]) connections[path] = [];
            if (!connections[path].some(m => m.socketId === socket.id)) {
                connections[path].push({ socketId: socket.id, user: {} });
            }
            socket.join(path);
            const others = connections[path].filter(m => m.socketId !== socket.id).map(m => m.socketId);
            socket.emit("existing-users", others);
            socket.to(path).emit("user-joined", { socketId: socket.id, user: {} });
        });

        // ─── WebRTC Signalling ─────────────────────────────────────────────────
        socket.on("webrtc-offer", ({ target, sdp }) => {
            io.to(target).emit("webrtc-offer", { from: socket.id, sdp });
        });

        socket.on("webrtc-answer", ({ target, sdp }) => {
            io.to(target).emit("webrtc-answer", { from: socket.id, sdp });
        });

        socket.on("webrtc-ice-candidate", ({ target, candidate }) => {
            io.to(target).emit("webrtc-ice-candidate", { from: socket.id, candidate });
        });

        // Legacy signal passthrough
        socket.on("signal", (toId, signalData) => {
            io.to(toId).emit("signal", socket.id, signalData);
        });

        // ─── Chat ──────────────────────────────────────────────────────────────
        socket.on("chat-message", ({ roomId, message, user: msgUser } = {}) => {
            const room = roomId || findRoom(socket.id);
            if (!room) return;

            // Find user info from connections if not provided
            const member = connections[room]?.find(m => m.socketId === socket.id);
            const sender = msgUser || member?.user || { name: "Unknown" };

            const msg = { user: sender, message, ts: Date.now() };

            if (!messages[room]) messages[room] = [];
            messages[room].push(msg);

            // Broadcast to everyone in room (including sender for confirmation)
            io.to(room).emit("chat-message", msg);
        });

        // ─── Live Captions ─────────────────────────────────────────────────────
        socket.on("caption-text", ({ roomId, speaker, text, timestamp }) => {
            const room = roomId || findRoom(socket.id);
            if (!room) return;
            socket.to(room).emit("caption-broadcast", { speaker, text, timestamp });
        });

        // ─── Reactions ─────────────────────────────────────────────────────────
        socket.on("reaction", ({ roomId, emoji, userName }) => {
            const room = roomId || findRoom(socket.id);
            if (!room) return;
            socket.to(room).emit("reaction-broadcast", { emoji, userName });
        });

        // ─── Raise / Lower Hand ────────────────────────────────────────────────
        socket.on("raise-hand", ({ roomId, userName }) => {
            const room = roomId || findRoom(socket.id);
            if (!room) return;
            socket.to(room).emit("hand-raised", { socketId: socket.id, userName });
        });

        socket.on("lower-hand", ({ roomId }) => {
            const room = roomId || findRoom(socket.id);
            if (!room) return;
            socket.to(room).emit("hand-lowered", { socketId: socket.id });
        });

        // ─── Host Controls ─────────────────────────────────────────────────────
        socket.on("host-mute-user", ({ targetSocketId }) => {
            io.to(targetSocketId).emit("force-mute");
        });

        socket.on("host-remove-user", ({ targetSocketId }) => {
            io.to(targetSocketId).emit("removed-from-room");
        });

        // ─── Whiteboard ─────────────────────────────────────────────────────────
        socket.on("whiteboard-draw", (data) => {
            const room = findRoom(socket.id);
            if (room) socket.to(room).emit("whiteboard-draw", data);
        });

        socket.on("whiteboard-clear", () => {
            const room = findRoom(socket.id);
            if (room) socket.to(room).emit("whiteboard-clear");
        });

        // ─── Disconnect ────────────────────────────────────────────────────────
        socket.on("disconnect", () => {
            const room = findRoom(socket.id);
            if (!room) return;

            connections[room] = connections[room].filter(m => m.socketId !== socket.id);
            socket.to(room).emit("user-left", { socketId: socket.id });

            console.log(`[room:${room}] Socket ${socket.id} disconnected. Remaining: ${connections[room].length}`);

            if (connections[room].length === 0) {
                delete connections[room];
                delete messages[room];
            }
        });
    });

    return io;
};