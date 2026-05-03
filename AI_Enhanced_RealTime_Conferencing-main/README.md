# AI Enhanced Real-Time Conferencing

A full-featured AI-powered video conferencing application with real-time communication, built with React, Node.js, Socket.IO, and WebRTC.

## Features

✅ **Multi-User Video/Audio Conferencing** - Multiple participants can join the same meeting
✅ **Real-time Chat** - Send messages during meetings
✅ **Interactive Whiteboard** - Collaborate with drawing tools
✅ **Host Controls** - Mute or remove participants (host only)
✅ **User Authentication** - Login/Register with JWT tokens
✅ **Meeting Management** - Create and join meetings with unique codes
✅ **Live Captions** - Caption overlay support (ready for integration)

## Architecture

### Tech Stack
- **Frontend**: React 18, Vite, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **Database**: MongoDB
- **Real-Time**: WebRTC for peer-to-peer video/audio, Socket.IO for signaling
- **Authentication**: JWT tokens with bcrypt password hashing

### How It Works

1. **User Registration/Login**
   - Users register or login with email/password
   - JWT token is issued and stored for API authentication
   - Users can be either "Host" or "Participant"

2. **Meeting Flow**
   - Host creates a meeting → gets a unique room code
   - Participants join using the room code
   - Socket.IO handles room management and signaling

3. **WebRTC Connection**
   - When a user joins, they emit `join-room` with their user info
   - Existing users receive `user-joined` event
   - WebRTC peer connections are established:
     - Offer/Answer SDP exchange via Socket.IO
     - ICE candidates exchanged for NAT traversal
     - Media streams (video/audio) flow peer-to-peer

4. **Real-Time Features**
   - **Chat**: Messages broadcast to room via Socket.IO
   - **Whiteboard**: Drawing events synced across all participants
   - **Host Controls**: Mute/remove commands sent through socket events

## Getting Started

### Prerequisites
- Node.js (v14+)
- MongoDB running on localhost:27017
- Modern browser with WebRTC support

### Installation & Running

1. **Start MongoDB** (if not running)
   ```bash
   mongod
   ```

2. **Server** (Terminal 1)
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Server runs on: http://localhost:3000

3. **Client** (Terminal 2)
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Client runs on: http://localhost:5173

### Default Credentials
- **Email**: admin@example.com
- **Password**: admin123
- **Role**: Host

## Usage Guide

### Creating a Meeting (Host)
1. Login with host credentials
2. Click "Create Meeting" button
3. Share the room code with participants
4. Click on the meeting to join

### Joining a Meeting (Participant)
1. Register/Login as participant
2. Enter the room code in the input field
3. Click "Join" button
4. Allow camera and microphone access

### During Meeting

**Video Controls**
- 📹 Video On/Off - Toggle your camera
- 🎤 Mic On/Off - Toggle your microphone

**Host Controls** (Host only)
- 🔇 Mute User - Force mute a participant
- ✕ Remove User - Kick a participant from the meeting

**Chat**
- Type messages in the chat panel (right side)
- Messages show sender name and timestamp

**Whiteboard**
- Select color and brush size
- Click and drag to draw
- Click "Clear" to reset the canvas
- All participants see drawings in real-time

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Meetings
- `POST /api/meetings` - Create new meeting (authenticated)
- `GET /api/meetings` - List user's meetings (authenticated)

### Health Check
- `GET /api/health` - Server health status

## Socket.IO Events

### Client → Server
- `join-room` - Join a meeting room
- `webrtc-offer` - Send WebRTC offer
- `webrtc-answer` - Send WebRTC answer
- `webrtc-ice-candidate` - Send ICE candidate
- `chat-message` - Send chat message
- `host-mute-user` - Mute participant (host)
- `host-remove-user` - Remove participant (host)
- `whiteboard-draw` - Draw on whiteboard
- `whiteboard-clear` - Clear whiteboard

### Server → Client
- `user-joined` - New user joined room
- `user-left` - User left room
- `room-users` - List of current users
- `webrtc-offer` - Receive WebRTC offer
- `webrtc-answer` - Receive WebRTC answer
- `webrtc-ice-candidate` - Receive ICE candidate
- `chat-message` - Receive chat message
- `force-mute` - Host muted you
- `removed-from-room` - Host removed you
- `whiteboard-draw` - Receive drawing
- `whiteboard-clear` - Whiteboard cleared

## File Structure

```
client/
  src/
    components/       # Reusable UI components
      AuthForm.jsx    # Login/Register form
      ChatPanel.jsx   # Chat interface
      VideoGrid.jsx   # Video tiles layout
      Whiteboard.jsx  # Collaborative drawing
      CaptionsOverlay.jsx # Live captions display
    context/
      AuthContext.jsx # Authentication state management
    pages/
      App.jsx         # Main app component
      Lobby.jsx       # Meeting lobby
      MeetingRoom.jsx # Video conference room
    services/
      api.js          # API client
    styles/
      theme.css       # Dark theme styling

server/
  src/
    controllers/      # Request handlers
    models/          # MongoDB schemas
    routes/          # API routes
    sockets/         # Socket.IO handlers
      io.js          # Main socket logic
    middleware/      # Express middleware
    config/          # Database config
```

## Testing with Multiple Users

1. Open the app in multiple browser windows/tabs
2. Login with different accounts in each window
3. Have one user (host) create a meeting
4. Join the same room code from other windows
5. Test features:
   - Video/audio streaming
   - Chat messages
   - Whiteboard drawing
   - Host controls (mute/remove)

## Troubleshooting

**Camera/Mic not working**
- Check browser permissions
- Ensure HTTPS or localhost (WebRTC requirement)
- Try refreshing the page

**Connection issues**
- Verify MongoDB is running
- Check if server is running on port 3000
- Check if client is running on port 5173
- Verify firewall settings

**WebRTC not connecting**
- Check browser console for errors
- Ensure STUN server is accessible
- For production, add TURN server for NAT traversal

## Future Enhancements

- [ ] Screen sharing
- [ ] Recording meetings
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Real-time transcription
- [ ] Meeting scheduling
- [ ] Reactions/Emoji
- [ ] Raise hand feature
- [ ] Grid/spotlight view toggle
- [ ] Waiting room

## License

MIT

## Support

For issues or questions, please check the console logs in both client and server terminals.
