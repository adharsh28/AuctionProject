const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: String,
  socketId: String,
  joinedAt: { type: Date, default: Date.now },
  team: { type: Array, default: [] },
  budget: Number // ✅ Removed default: 100
});

const roomSchema = new mongoose.Schema({
  roomCode: String,
  creator: String,
  maxPlayers: Number,
  budget: Number,
  totalPlayersPerTeam: {
  type: Number,
  required: true
},
maxForeignPlayers: {
  type: Number,
  required: true
},
  players: [playerSchema],
  dataset: String,
  currentPlayer: {
    name: String,
    team: String,
    role: String,
    image: String,
    price: Number
  },
  bid: { type: Number, default: 0 },
  bidder: { type: String, default: null },
  timer: { type: Number, default: 20 },
  auctionEnded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

module.exports = mongoose.model('Room', roomSchema);