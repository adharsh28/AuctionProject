import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function generateRoomCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function CreateRoom() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [budget, setBudget] = useState(null); // 💰 Default budget in Cr
  const [dataset, setDataset] = useState('ipl');
  const [totalPlayersPerTeam, setTotalPlayersPerTeam] = useState(null);
  const [maxForeignPlayers, setMaxForeignPlayers] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setRoomCode(generateRoomCode());
  }, []);
  

  const handleCreate = async () => {
     if (
    !name ||
    !maxPlayers ||
    !budget ||
    !totalPlayersPerTeam ||
    maxForeignPlayers === null ||
    maxForeignPlayers === '' ||
    isNaN(Number(maxForeignPlayers))
  ) {
    alert('Please fill all fields including a valid foreign player limit');
    return;
  }

    if (!name || !maxPlayers || !budget) {
      alert('Please fill all fields');
      return;
    }

    localStorage.setItem('name', name);
      try {
    // ✅ Step 1: Save room to backend
    await axios.post(`${API_BASE_URL}/api/create-room`, {
      creator: name, // ✅ this is the creator
      roomCode,
      maxPlayers,
      budget: Number(budget),
      dataset: dataset.toLowerCase(),
      totalPlayersPerTeam,
      maxForeignPlayers: Number(maxForeignPlayers) || 0
    });

    // ✅ Step 2: Emit socket event
    socket.emit('create-room', {
      roomCode,
      maxPlayers,
      name,
      budget: Number(budget),
      dataset: dataset.toLowerCase(),
      totalPlayersPerTeam,
      maxForeignPlayers: Number(maxForeignPlayers)
    });

    // ✅ Step 3: Navigate to room
    navigate(`/room/${roomCode}`);
  } catch (err) {
    console.error('❌ Error creating room:', err);
    alert('Failed to create room. Please try again.');
  }
};


  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Create Room</h2>
      <input placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
      <br />
      <input value={roomCode} readOnly />
      <br />
      <input type="number" placeholder="Max Players" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} />
      <br />
      <input
        type="number"
        placeholder="Auction Budget (in Cr)"
        value={budget}
        onChange={e => setBudget(e.target.value)}
        min={1}
        style={{ marginBottom: '10px', padding: '8px', width: '200px' }}
      />
      <br />
      <input
  type="number"
  placeholder="Max players per team"
  value={totalPlayersPerTeam}
  onChange={(e) => setTotalPlayersPerTeam(e.target.value)}
/>
<br />
<input
  type="number"
  placeholder="Max foreign players per team"
  value={maxForeignPlayers}
  onChange={(e) => setMaxForeignPlayers(e.target.value)}
/>
<br />

      {/* <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
  <option value="hundred">The Hundred</option>
  <option value="ipl">IPL</option>
</select> */}
<select value={dataset} onChange={(e) => setDataset(e.target.value)}>
  <option value="ipl">IPL</option>
  <option value="hundred">Hundred</option>
  <option value="test">Test (5 Players)</option> {/* ✅ Add this */}
</select>
    
      <button onClick={handleCreate}>Create</button>
    </div>
  );
}

export default CreateRoom;