import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>AuctionPlay 🏏</h1>
      <button onClick={() => navigate('/create')}>Create Room</button>
      <button onClick={() => navigate('/join')} style={{ marginLeft: '10px' }}>Join Room</button>
      
    </div>
  );
}

export default Home;