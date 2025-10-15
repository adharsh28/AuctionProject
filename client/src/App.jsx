import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import RoomLobby from './pages/RoomLobby.jsx';
import AuctionRoom from './pages/AuctionRoom.jsx';
import TeamSquad from './pages/TeamSquad.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/room/:roomCode" element={<RoomLobby />} />
        <Route path="/auction/:roomCode" element={<AuctionRoom />} />
        <Route path="/team" element={<TeamSquad />} />
      </Routes>
    </Router>
  );
}

export default App;