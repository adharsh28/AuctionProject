import { Server } from "socket.io";
import Room from "../models/Room.js";
import crypto from "crypto";
import dotenv from "dotenv";
import winston from "winston";
import jwt from "jsonwebtoken";

// load env
dotenv.config();

// --------------------
// Logger (winston)
// --------------------
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// --------------------
// In-memory auction state (kept minimal)
// --------------------
// NOTE: production scale should push this into Redis or DB — this keeps short lived timers
const auctionState = {};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper: safe socket wrapper for async handlers
function safeSocket(handler) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      logger.error("Socket handler error: %O", err);
      // args[0] is usually payload, last arg sometimes callback. We don't crash the server.
      const socket = args[args.length - 1] && args[args.length - 1].id ? args[args.length - 1] : null;
      if (socket && typeof socket.emit === "function") {
        socket.emit("error-message", "Internal server error");
      }
    }
  };
}

// Clean up auction state for a room (clear timers)
function cleanupAuctionState(roomCode) {
  const state = auctionState[roomCode];
  if (!state) return;
  if (state.intervalId) {
    try {
      clearInterval(state.intervalId);
    } catch (e) {
      logger.warn("Error clearing interval for %s: %O", roomCode, e);
    }
  }
  delete auctionState[roomCode];
  logger.info("Cleared auctionState for %s", roomCode);
}

async function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || (process.env.NODE_ENV === "production" ? "https://yourfrontend.example" : "http://localhost:5173"),
      methods: ["GET", "POST"],
    },
    // pingInterval/pingTimeout can be tuned for production
    pingInterval: Number(process.env.SOCKET_PING_INTERVAL) || 25000,
    pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT) || 60000,
    maxHttpBufferSize: 1e6,
  });

  // --------------------
  // Redis adapter for horizontal scaling (optional)
  // --------------------
  // if (process.env.REDIS_URL) {
  //   try {
  //     const pubClient = createClient({ url: process.env.REDIS_URL });
  //     const subClient = pubClient.duplicate();
  //     await pubClient.connect();
  //     await subClient.connect();
  //     io.adapter(createAdapter(pubClient, subClient));
  //     logger.info("Socket.io Redis adapter initialized");
  //   } catch (err) {
  //     logger.error("Failed to initialize Redis adapter: %O", err);
  //   }
  // }

  // --------------------
  // Authentication middleware
  // Supports: a) simple token via handshake.auth.token
  //           b) JWT via Authorization header in handshake
  // --------------------
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) {
        // If SOCKET_SECRET is set, require token. Otherwise allow anonymous (dev only)
        if (process.env.SOCKET_SECRET && process.env.NODE_ENV === "production") {
          logger.warn("Socket auth missing token");
          return next(new Error("Authentication error"));
        }
        return next();
      }

      // If JWT secret provided, try verify
      if (process.env.JWT_SECRET) {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = payload; // attach to socket
          return next();
        } catch (e) {
          logger.warn("JWT verify failed: %O", e);
          return next(new Error("Authentication error"));
        }
      }

      // fallback: simple token compare
      if (process.env.SOCKET_SECRET && token !== process.env.SOCKET_SECRET) {
        logger.warn("Socket token mismatch");
        return next(new Error("Authentication error"));
      }

      return next();
    } catch (err) {
      logger.error("Socket auth middleware error: %O", err);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    logger.info("Socket connected: %s", socket.id);

    socket.on("get-room", safeSocket(async () => {
      const room = await Room.findOne({ "players.socketId": socket.id }).lean();
      if (room) socket.emit("room-data", room);
      else logger.debug("No room found for socket %s", socket.id);
    }));

    socket.on("create-room", safeSocket(async (payload) => {
      const { roomCode, maxPlayers, name, budget, dataset, totalPlayersPerTeam, maxForeignPlayers } = payload || {};
      if (!roomCode || !name) return socket.emit("error-message", "Missing roomCode or name");

      const room = new Room({
        roomCode,
        creator: name,
        maxPlayers: Number(maxPlayers) || 8,
        budget: Number(budget) || 100,
        totalPlayersPerTeam: Number(totalPlayersPerTeam) || 6,
        maxForeignPlayers: Number(maxForeignPlayers) || 4,
        dataset,
        players: [{ name, socketId: socket.id, team: [], budget: Number(budget) || 100 }],
      });

      await room.save();
      socket.join(roomCode);
      io.to(roomCode).emit("player-list", room.players);
      logger.info("Room created %s by %s", roomCode, name);
    }));

    socket.on("join-room", safeSocket(async (payload) => {
      const { roomCode, name } = payload || {};
      if (!roomCode || !name) return;
      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit("error-message", "Room not found");

      if (room.players.length >= room.maxPlayers) return socket.emit("error-message", "Room full");

      const existingPlayer = room.players.find((p) => p.name.toLowerCase() === name.toLowerCase());

      if (room.creator === name) {
        room.host = socket.id;
      }

      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
      } else {
        room.players.push({ name, socketId: socket.id, team: [], budget: room.budget });
      }

      await room.save();
      socket.join(roomCode);
      io.to(roomCode).emit("room-data", room);
      logger.info("%s joined room %s", name, roomCode);
    }));

    socket.on("get-room-info", safeSocket(async ({ roomCode }) => {
      const room = await Room.findOne({ roomCode }).lean();
      if (!room) return;
      socket.emit("room-info", {
        creator: room.creator,
        maxPlayers: room.maxPlayers,
        maxForeignPlayers: room.maxForeignPlayers,
        budget: room.budget,
        maxPlayerPerTeam: room.totalPlayersPerTeam,
        league: room.dataset,
      });
    }));

    socket.on("start-game", safeSocket(async ({ roomCode }) => {
      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit("error-message", "Room not found");

      let dataset = [];
      try {
        if (room.dataset === "hundred") dataset = (await import("../data/hundredPlayers.js")).default;
        else if (room.dataset === "ipl") dataset = (await import("../data/iplPlayers.js")).default;
        else if (room.dataset === "test") dataset = (await import("../data/testPlayers.js")).default;
        else if (room.dataset === "sa20") dataset = (await import("../data/SA20.js")).default;
        else if (room.dataset === "cpl") dataset = (await import("../data/CPL.js")).default;
        else if (room.dataset === "bbl") dataset = (await import("../data/BBL.js")).default;
        else if (room.dataset === "mlc") dataset = (await import("../data/MLC.js")).default;
      } catch (err) {
        logger.error("Failed to load dataset for %s: %O", roomCode, err);
      }

      auctionState[roomCode] = {
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null,
        timer: 20,
        notInterested: [],
        assigned: false,
        players: shuffleArray([...dataset]),
        unsoldPlayers: [],
      };

      io.to(roomCode).emit("game-started");
      sendNextPlayer(roomCode).catch((e) => logger.error("sendNextPlayer failed: %O", e));
    }));

    socket.on("place-bid", safeSocket(async ({ roomCode, playerName }) => {
      const state = auctionState[roomCode];
      if (!state) return socket.emit("bid-rejected", { reason: "No active auction" });
      if (state.currentBidder === playerName) return;

      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit("bid-rejected", { reason: "Room not found" });

      const bidder = room.players.find((p) => p.name === playerName);
      if (!bidder) return socket.emit("bid-rejected", { reason: "Bidder not found" });

      if (bidder.budget < state.currentBid + 0.5) return socket.emit("bid-rejected", { reason: "Insufficient budget" });

      if (!state.currentBidder) {
        state.currentBidder = playerName;
        state.timer = 20;
        state.notInterested = [];

        room.bid = state.currentBid;
        room.bidder = playerName;
        room.timer = state.timer;
        await room.save();

        return io.to(roomCode).emit("bid-update", { bid: state.currentBid, bidder: playerName, timer: state.timer, increment: 0, message: "First bid at base price" });
      }

      let increment = 0.5;
      if (state.currentBid >= 10 && state.currentBid < 20) increment = 1;
      else if (state.currentBid >= 20) increment = 2;

      const newBid = state.currentBid + increment;
      if (bidder.budget < newBid) return socket.emit("bid-rejected", { reason: "Insufficient budget" });

      state.currentBid = newBid;
      state.currentBidder = playerName;
      state.timer = 20;
      state.notInterested = [];

      room.bid = state.currentBid;
      room.bidder = playerName;
      room.timer = state.timer;
      await room.save();

      io.to(roomCode).emit("bid-update", { bid: state.currentBid, bidder: playerName, timer: state.timer, increment });
    }));

    socket.on("not-interested", safeSocket(async ({ roomCode, playerName }) => {
      const state = auctionState[roomCode];
      if (!state) return;

      if (!state.notInterested.includes(playerName)) state.notInterested.push(playerName);

      const room = await Room.findOne({ roomCode });
      const totalPlayers = room?.players?.length || 0;

      if (state.notInterested.length === totalPlayers && !state.assigned) {
        if (state.intervalId) clearInterval(state.intervalId);
        await assignPlayer(roomCode, null);
        state.assigned = true;
      } else if (state.notInterested.length === totalPlayers - 1 && state.currentBidder && !state.assigned) {
        if (state.intervalId) clearInterval(state.intervalId);
        await assignPlayer(roomCode, state.currentBidder);
        state.assigned = true;
      }
    }));

    socket.on("rejoin-room", safeSocket(async ({ roomCode, playerName }) => {
      const room = await Room.findOne({ roomCode });
      if (!room) return;
      const player = room.players.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
      if (!player) return;

      player.socketId = socket.id;
      await room.save();
      socket.join(roomCode);
      socket.emit("team-data", player.team || []);
      io.to(roomCode).emit("player-list", room.players);

      const state = auctionState[roomCode];
      if (state) {
        const currentPlayer = room.currentPlayer || state.players[state.currentPlayerIndex];
        socket.emit("auction-state", { currentPlayer, bid: state.currentBid, bidder: state.currentBidder, timer: state.timer });
      }
    }));

    socket.on("get-all-teams", safeSocket(async (_, callback) => {
      try {
        const room = await Room.findOne({ "players.socketId": socket.id }).lean();
        if (!room) return callback([]);
        const teams = room.players.map((p) => ({ name: p.name, team: p.team || [] }));
        callback(teams);
      } catch (err) {
        logger.error("get-all-teams error: %O", err);
        callback([]);
      }
    }));

    socket.on("get-team", safeSocket(async ({ playerName }) => {
      const room = await Room.findOne({ "players.name": playerName }).lean();
      if (!room) return;
      const player = room.players.find((p) => p.name === playerName);
      socket.emit("team-data", { team: player.team || [], budget: player.budget || 0 });
    }));

    // Helper used by assignPlayer
    function isForeign(dataset, nation) {
      if (dataset === "ipl") return nation !== "INDIA";
      if (dataset === "hundred") return nation !== "England";
      if (dataset === "sa20") return nation !== "South Africa";
      if (dataset === "cpl") return nation !== "West Indies";
      if (dataset === "bbl") return nation !== "Australia";
      if (dataset === "mlc") return nation !== "USA";
      return false;
    }

    // assignPlayer (keeps DB writes minimal and uses lean checks)
    async function assignPlayer(roomCode, winnerName) {
      const state = auctionState[roomCode];
      if (!state) return;
      const rawPlayer = state.players[state.currentPlayerIndex];
      if (!rawPlayer) return;

      const room = await Room.findOne({ roomCode });
      if (!room) return;

      const playerData = {
        name: rawPlayer.NAME,
        team: rawPlayer.TEAM?.trim(),
        role: rawPlayer.ROLE,
        nation: rawPlayer.NATION,
        stats: rawPlayer.STATS || {},
        price: state.currentBid,
      };

      room.currentPlayer = null;
      room.bid = 0;
      room.bidder = null;
      room.timer = 0;

      let assigned = false;

      if (winnerName) {
        const winner = room.players.find((p) => p.name === winnerName);
        if (winner) {
          if (!winner.team) winner.team = [];

          if (winner.team.length >= room.totalPlayersPerTeam) {
            const targetSocket = io.sockets.sockets.get(winner.socketId);
            if (targetSocket) targetSocket.emit("bid-rejected", { reason: `❌ ${winner.name} already has ${room.totalPlayersPerTeam} players.` });

            io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
            state.unsoldPlayers.push(rawPlayer);
            state.currentPlayerIndex += 1;
            state.assigned = false;
            await room.save();
            return;
          }

          if (isForeign(room.dataset, playerData.nation)) {
            const foreignCount = winner.team.filter((p) => isForeign(room.dataset, p.nation)).length;
            if (foreignCount >= room.maxForeignPlayers) {
              const targetSocket = io.sockets.sockets.get(winner.socketId);
              if (targetSocket) targetSocket.emit("bid-rejected", { reason: `You already have ${room.maxForeignPlayers} foreign players.` });

              io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
              state.unsoldPlayers.push(rawPlayer);
              state.currentPlayerIndex += 1;
              state.assigned = false;
              await room.save();
              return;
            }
          }

          // assign
          winner.team.push(playerData);
          winner.budget = Math.max(0, winner.budget - playerData.price);
          state.unsoldPlayers = state.unsoldPlayers.filter((p) => p.NAME !== rawPlayer.NAME);

          const cleanTeam = winner.team.map((p) => ({ name: p.name, role: p.role, nation: p.nation, price: p.price }));

          await Room.findOneAndUpdate({ "players.name": winner.name }, { $set: { "players.$.team": cleanTeam, "players.$.budget": winner.budget } });
          assigned = true;
        }
      }

      if (!assigned) {
        io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
        state.unsoldPlayers.push(rawPlayer);
      } else {
        io.to(roomCode).emit("player-sold", { player: playerData, winner: winnerName });
      }

      state.currentPlayerIndex += 1;
      state.assigned = false;

      await room.save();

      const allTeamsFilled = room.players.every((p) => Array.isArray(p.team) && typeof room.totalPlayersPerTeam === "number" && p.team.length >= room.totalPlayersPerTeam);
      if (allTeamsFilled) {
        room.auctionEnded = true;
        await room.save();
        io.to(roomCode).emit("auction-ended");
        cleanupAuctionState(roomCode);
        return;
      }

      if (state.currentPlayerIndex < state.players.length) {
        setTimeout(() => sendNextPlayer(roomCode).catch((e) => logger.error("sendNextPlayer error: %O", e)), 2000);
      } else if (state.unsoldPlayers.length > 0) {
        state.players = [...state.unsoldPlayers];
        state.unsoldPlayers = [];
        state.currentPlayerIndex = 0;
        setTimeout(() => sendNextPlayer(roomCode).catch((e) => logger.error("sendNextPlayer error: %O", e)), 2000);
      } else {
        io.to(roomCode).emit("auction-incomplete", { message: "Auction ended but some teams are not full." });
        cleanupAuctionState(roomCode);
      }
    }

    async function sendNextPlayer(roomCode) {
      const state = auctionState[roomCode];
      if (!state) return;
      const rawPlayer = state.players[state.currentPlayerIndex];
      if (!rawPlayer) return;
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      const playerData = { name: rawPlayer.NAME, team: rawPlayer.TEAM?.trim(), role: rawPlayer.ROLE, nation: rawPlayer.NATION, stats: rawPlayer.STATS || {}, price: 0 };
      room.currentPlayer = playerData;

      state.currentBid = rawPlayer.BASE_PRICE || 0;
      state.currentBidder = null;
      state.timer = 20;
      state.notInterested = [];
      state.assigned = false;

      room.currentPlayer = playerData;
      room.bid = 0;
      room.bidder = null;
      room.timer = 20;
      await room.save();

      io.to(roomCode).emit("new-player", { player: playerData, bid: state.currentBid, bidder: null, timer: 20 });

      startTimer(roomCode);
    }

    function startTimer(roomCode) {
      const state = auctionState[roomCode];
      if (!state) return;
      if (state.intervalId) clearInterval(state.intervalId);
      state.intervalId = setInterval(() => {
        if (!auctionState[roomCode]) return clearInterval(state.intervalId);
        state.timer -= 1;
        io.to(roomCode).emit("timer-update", state.timer);
        if (state.timer <= 0 && !state.assigned) {
          if (state.intervalId) clearInterval(state.intervalId);
          assignPlayer(roomCode, state.currentBidder).catch((e) => logger.error("assignPlayer error: %O", e));
          state.assigned = true;
        }
      }, 1000);
    }

    socket.on("send_message", safeSocket(async ({ roomId, playerName, message }) => {
      if (!roomId || !message) return;
      io.to(roomId).emit("receive_message", { playerName, message, timestamp: new Date().toISOString() });
    }));

    socket.on("disconnect", safeSocket(async () => {
      const room = await Room.findOne({ "players.socketId": socket.id });
      if (!room) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.socketId = null;
        await room.save();
        io.to(room.roomCode).emit("player-list", room.players);
        logger.info("Player disconnected (kept in room): %s - %s", player.name, room.roomCode);
      }
    }));

    // graceful cleanup when a socket manually leaves a room
    socket.on("leave-room", safeSocket(async ({ roomCode, playerName }) => {
      socket.leave(roomCode);
      logger.info("Socket %s left room %s", socket.id, roomCode);
    }));
  });

  // If you want to gracefully shutdown sockets from this module
  const shutdown = async () => {
    logger.info("Shutting down socket server...");
    try {
      io.close();
    } catch (e) {
      logger.error("Error closing io: %O", e);
    }
    // clear all auction states
    Object.keys(auctionState).forEach((k) => cleanupAuctionState(k));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return io; // return io instance for tests or external management
}

export default setupSocket;
