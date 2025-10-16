const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const setupSocket = require('./socket');
const Room = require('./models/Room');
const cors = require('cors'); // ✅

require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({
  origin: '*', // ✅ allows all origins (or specify 'http://10.153.33.129:5173' for tighter control)
  methods: ['GET', 'POST'],
  credentials: true
}));

const path = require('path');

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Handle direct URL access (e.g., /room/12345)
// ✅ Only serve index.html for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ✅ Route: Create Room with Budget
app.post('/api/create-room', async (req, res) => {
  const { creator, maxPlayers, budget, totalPlayersPerTeam, maxForeignPlayers } = req.body;

  // Simple room code generator (5-digit number)
  const roomCode = Math.floor(10000 + Math.random() * 90000).toString();

  try {
    const newRoom = new Room({
  roomCode,
  creator, // ✅ must be included
  maxPlayers,
  budget: Number(budget),
  totalPlayersPerTeam: Number(totalPlayersPerTeam),
  maxForeignPlayers: Number(maxForeignPlayers),
  players: [{
    name: creator,
    socketId: null,
    team: [],
    budget: Number(budget)
  }]
});


    await newRoom.save();
    console.log('✅ Room created:', newRoom);
    res.json(newRoom);
  } catch (err) {
    console.error('❌ Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});



// Route for fetching room
app.get('/api/room/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    console.log('✅ Room fetched:', room.players.map(p => ({
      name: p.name,
      budget: p.budget,
      teamSize: p.team.length
    })));
    res.json(room);
  } catch (err) {
    console.error('Error fetching room:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/room/:roomCode/state', async (req, res) => {
  const room = await Room.findOne({ roomCode: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  res.json({
    auctionEnded: room.auctionEnded || false,
    currentPlayer: room.currentPlayer || null,
    bid: room.bid || 0,
    bidder: room.bidder || null,
    timer: room.timer || 0
  });
});


// ✅ Route: Join Room
app.post('/api/join-room', async (req, res) => {
  const { roomCode, name } = req.body;
  const room = await Room.findOne({ roomCode });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // ❌ Block if name matches creator
  if (room.creator.toLowerCase() === name.toLowerCase()) {
    return res.status(400).json({ error: 'Name matches room creator — choose a different name' });
  }

  // ❌ Block if name already exists in this room
  const alreadyJoined = room.players.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (alreadyJoined) {
    return res.status(400).json({ error: 'Name already taken in this room' });
  }

  // ✅ Add player
  room.players.push({
    name,
    socketId: null,
    team: [],
    budget: room.budget
  });
  await room.save();

  res.json({ success: true });
});


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
  server.listen(5000, '0.0.0.0', () => {
  console.log('Server running on port 5000');
});

}).catch(err => console.error('❌ MongoDB error:', err));

setupSocket(server);
