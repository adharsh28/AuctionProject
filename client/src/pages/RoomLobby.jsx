import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

function RoomLobby() {
  const { roomCode } = useParams();
  const [players, setPlayers] = useState([]);
  const [creator, setCreator] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(0);
  const navigate = useNavigate();
  const playerName = localStorage.getItem('name');

  useEffect(() => {
     // ✅ Rejoin the room on refresh
  if (playerName && roomCode) {
    socket.emit('rejoin-room', { roomCode, playerName });
  }

    socket.emit('get-room-info', { roomCode });

    socket.on('room-info', ({ creator, maxPlayers }) => {
      setCreator(creator);
      setMaxPlayers(maxPlayers);
    });

    socket.on('player-list', (list) => {
      setPlayers(list);
    });

    socket.on('game-started', () => {
        console.log('Game started — navigating to auction page');
      navigate(`/auction/${roomCode}`);
    });

    return () => {
      socket.off('room-info');
      socket.off('player-list');
      socket.off('game-started');
    };
  }, [roomCode,navigate,playerName]);

  const handleStart = () => {
    socket.emit('start-game', { roomCode }
    );
    console.log('Start game clicked:', roomCode);
  };
  

  console.log(maxPlayers)
  const isRoomFull = players.length === maxPlayers;
  console.log(isRoomFull)
  const isCreator = playerName?.trim().toLowerCase() === creator?.trim().toLowerCase();
  console.log('playerName:', JSON.stringify(playerName));
console.log('creator:', JSON.stringify(creator));
console.log('isCreator:', isCreator);
  console.log(isCreator)
  console.log('Logged in as:', playerName);
console.log('Room creator:', creator);
console.log('isCreator:', isCreator);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Room Lobby: {roomCode}</h2>
      <ul>
        {players.map((p, i) => (
          <li key={i}>{p.name}</li>
        ))}
      </ul>
      {isRoomFull && isCreator && (
        <button onClick={handleStart}>Start Game</button>
      )}
    </div>
  );
}

export default RoomLobby;