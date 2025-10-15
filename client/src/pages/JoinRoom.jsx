import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';


function JoinRoom() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    localStorage.setItem('name', name);
    socket.emit('join-room', { roomCode, name });
    navigate(`/room/${roomCode}`);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Join Room</h2>
      <input placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
      <br />
      <input placeholder="Room Code" value={roomCode} onChange={e => setRoomCode(e.target.value)} />
      <br />
      <button onClick={handleJoin}>Join</button>
    </div>
  );
}

export default JoinRoom;