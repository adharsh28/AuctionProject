// ------------------------------
// 📦 Imports (ES Module Style)
// ------------------------------
import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import setupSocket from "./socket/index.js";
import Room from "./models/Room.js";

// ------------------------------
// ⚙️ Config
// ------------------------------
dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(
  cors({
    origin: "*", // or specify your frontend origin
    methods: ["GET", "POST"],
    credentials: true,
  })
);









// ------------------------------
// 🏠 Room Creation Route
// ------------------------------
app.post("/api/create-room", async (req, res) => {
  const {
    creator,
    maxPlayers,
    budget,
    totalPlayersPerTeam,
    maxForeignPlayers,
  } = req.body;
  const roomCode = Math.floor(10000 + Math.random() * 90000).toString();

  try {
    const newRoom = new Room({
      roomCode,
      creator,
      maxPlayers,
      budget: Number(budget),
      totalPlayersPerTeam: Number(totalPlayersPerTeam),
      maxForeignPlayers: Number(maxForeignPlayers),
      players: [
        {
          name: creator,
          socketId: null,
          team: [],
          budget: Number(budget),
        },
      ],
    });

    await newRoom.save();
    console.log("✅ Room created:", newRoom.roomCode);
    res.json(newRoom);
  } catch (err) {
    console.error("❌ Error creating room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// ------------------------------
// 🚪 Join Room Route
// ------------------------------
app.post("/api/join-room", async (req, res) => {
  const { roomCode, name } = req.body;
  const room = await Room.findOne({ roomCode });
  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.creator.toLowerCase() === name.toLowerCase()) {
    return res
      .status(400)
      .json({ error: "Name matches room creator — choose a different name" });
  }

  const alreadyJoined = room.players.some(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (alreadyJoined) {
    return res.status(400).json({ error: "Name already taken in this room" });
  }

  room.players.push({
    name,
    socketId: null,
    team: [],
    budget: room.budget,
  });

  await room.save();
  res.json({ success: true });
});

// ------------------------------
// 🔍 Fetch Room Routes
// ------------------------------
app.get("/api/room/:roomCode", async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode });
    if (!room) return res.status(404).json({ error: "Room not found" });

    console.log("✅ Room fetched:", room.roomCode);
    res.json(room);
  } catch (err) {
    console.error("Error fetching room:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/room/:roomCode/state", async (req, res) => {
  const room = await Room.findOne({ roomCode: req.params.roomCode });
  if (!room) return res.status(404).json({ message: "Room not found" });

  res.json({
    auctionEnded: room.auctionEnded || false,
    currentPlayer: room.currentPlayer || null,
    bid: room.bid || 0,
    bidder: room.bidder || null,
    timer: room.timer || 0,
  });
});

// ------------------------------
// 🧩 Database + Socket Setup
// ------------------------------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(5000, "0.0.0.0", () => {
      console.log("🚀 Server running on port 5000");
    });
    setupSocket(server);
  })
  .catch((err) => console.error("❌ MongoDB error:", err));
