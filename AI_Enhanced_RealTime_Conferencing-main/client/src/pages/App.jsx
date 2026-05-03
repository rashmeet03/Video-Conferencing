import React, { useState } from 'react';
import Lobby from './Lobby';
import MeetingRoom from './MeetingRoom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import AuthForm from '../components/AuthForm';
import RagChatbotWidget from '../components/RagChatbotWidget';

function InnerApp() {
  const [room, setRoom] = useState(null);
  const { user } = useAuth();
  if (!user) return <AuthForm />;
  return (
    <>
      {room ? <MeetingRoom roomId={room} user={user} onLeave={() => setRoom(null)} /> : <Lobby onJoin={setRoom} user={user} />}
      <RagChatbotWidget />
    </>
  );
}

export default function App() {
  return <AuthProvider><InnerApp /></AuthProvider>;
}
