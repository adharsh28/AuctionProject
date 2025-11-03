import mongoose from "mongoose";

// ✅ Schema for individual player stats inside a team
const playerStatsSchema = new mongoose.Schema({
  name: String,
  role: String,
  team: String,
  nation: String,
  price: { type: Number, default: 0 },
  stats: {
    Batting: {
      M: Number,
      I: Number,
      R: Number,
      Avg: Number,
      SR: Number
    },
    Bowling: {
      I: Number,
      W: Number,
      Avg: Number,
      Econ: Number
    }
  }
}, { _id: false });

// ✅ Schema for each participant in the room
const playerSchema = new mongoose.Schema({
  name: String,
  socketId: String,
  joinedAt: { type: Date, default: Date.now },
  team: { type: [playerStatsSchema], default: [] },
  budget: Number
});

// ✅ Main room schema
const RoomSchema = new mongoose.Schema({
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
    nation: String,
    price: Number,
    stats: {
      Batting: {
        M: Number,
        I: Number,
        R: Number,
        Avg: Number,
        SR: Number
      },
      Bowling: {
        I: Number,
        W: Number,
        Avg: Number,
        Econ: Number
      }
    }
  },
  bid: { type: Number, default: 0 },
  bidder: { type: String, default: null },
  timer: { type: Number, default: 20 },
  auctionEnded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

export default mongoose.model("Room", RoomSchema);
