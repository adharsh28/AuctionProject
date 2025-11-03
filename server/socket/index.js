import { Server } from "socket.io";
import Room from "../models/Room.js";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

let auctionState = {};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*", // ✅ or 'http://10.153.33.129:5173'
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    // console.log("⚡ A user connected");

    //     socket.on("match-simulated", ({ roomCode, result }) => {
    //       console.log(`🏏 Match simulated for room ${roomCode}`);
    //       io.to(roomCode).emit("matchSimulated", result); // broadcast to all in room
    //     });

    //     socket.on("simulate-match", async ({ roomCode, prompt }) => {
    //       const room = await Room.findOne({ roomCode });
    //       if (!room) return;

    //       const host = room.creator;
    //       const player = room.players.find((p) => p.socketId === socket.id);
    //       if (!player || player.name !== host) {
    //         socket.emit("matchSimulated", "❌ Only host can simulate match.");
    //         return;
    //       }

    //       const teamObjects = room.players || [];
    //       if (teamObjects.length < 2) {
    //         io.to(roomCode).emit(
    //           "matchSimulated",
    //           "⚠️ Not enough teams to simulate!"
    //         );
    //         return;
    //       }

    //       const team1 =
    //         teamObjects[0]?.team?.map((p) => `${p.name} (${p.role})`) || [];
    //       const team2 =
    //         teamObjects[1]?.team?.map((p) => `${p.name} (${p.role})`) || [];

    //       // If host didn't type anything, use default fallback
    //       const basePrompt = `
    // You are a cricket match simulator.
    // Generate a concise T20 score summary between:
    // 🏏 Team 1: ${JSON.stringify(team1)}
    // 🏆 Team 2: ${JSON.stringify(team2)}
    // Use scoreboard-like format (10 lines max). Include toss, totals, top batters, wicket takers, result & Player of the Match.
    // `;

    //       const finalPrompt = `
    // You are a cricket match simulator.

    // ${prompt?.trim() ? `Host instruction: ${prompt.trim()}` : ""}
    // Now simulate a T20 match and generate a concise scoreboard-like summary between:
    // Keep it realistic, short (max 10 lines). Include toss, totals, top batters, best bowlers, result & Player of the Match.
    // `;

    //       try {
    //         const result = await model.generateContent(finalPrompt);
    //         const text = result.response.text();
    //         io.to(roomCode).emit("matchSimulated", text);
    //       } catch (err) {
    //         console.error("❌ Gemini error:", err);
    //         io.to(roomCode).emit("matchSimulated", "Failed to simulate match.");
    //       }
    //     });

    socket.on("get-room", async () => {
      try {
        const room = await Room.findOne({ "players.socketId": socket.id });

        if (room) {
          socket.emit("room-data", room);
        } else {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`⚠️ No room found for socket: ${socket.id}`);
          }
        }
      } catch (err) {
        // Log detailed info in development, minimal info in production
        if (process.env.NODE_ENV === "production") {
          console.error("❌ Error fetching room");
        } else {
          console.error("❌ Error fetching room:", err);
        }
      }
    });

    // ✅ Create Room
    socket.on(
      "create-room",
      async ({
        roomCode,
        maxPlayers,
        name,
        budget,
        dataset,
        totalPlayersPerTeam,
        maxForeignPlayers,
      }) => {
        const room = new Room({
          roomCode,
          creator: name,
          maxPlayers,
          budget: Number(budget),
          totalPlayersPerTeam: Number(totalPlayersPerTeam),
          maxForeignPlayers: Number(maxForeignPlayers), // ✅ Add this line
          dataset,
          players: [
            {
              name,
              socketId: socket.id,
              team: [],
              budget: Number(budget),
            },
          ],
        });

        await room.save();
        socket.join(roomCode);
        io.to(roomCode).emit("player-list", room.players);
      }
    );

    socket.on("join-room", async ({ roomCode, name }) => {
      const room = await Room.findOne({ roomCode });
      if (!room || room.players.length >= room.maxPlayers) return;

      const existingPlayer = room.players.find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );

      if (room.creator === name) {
        room.host = socket.id; // restore host
        // console.log(`👑 Host (${playerName}) reconnected with new socket.`);
      }

      if (existingPlayer) {
        // ✅ Update socketId for this player only
        existingPlayer.socketId = socket.id;
      } else {
        // ✅ Add new player if not already joined
        room.players.push({
          name,
          socketId: socket.id,
          team: [],
          budget: room.budget,
        });
      }

      // ✅ Save changes to DB
      await room.save();

      // ✅ Join the room in socket.io
      socket.join(roomCode);

      // ✅ Broadcast updated room data
      io.to(roomCode).emit("room-data", room);

      // console.log(`${name} joined room ${roomCode} (${socket.id})`);
    });

    // ✅ Get Room Info
    socket.on("get-room-info", async ({ roomCode }) => {
      const room = await Room.findOne({ roomCode });
      if (room) {
        socket.emit("room-info", {
          creator: room.creator,
          maxPlayers: room.maxPlayers,
          maxForeignPlayers: room.maxForeignPlayers,
          budget: room.budget,
          maxPlayerPerTeam: room.totalPlayersPerTeam,
          league: room.dataset,
        });
      }
    });

    // ✅ Start Game
    socket.on("start-game", async ({ roomCode }) => {
      // console.log("🟢 start-game received for room:", roomCode);
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      let dataset = [];
      // console.log(room.dataset);
      if (room.dataset === "hundred") {
        dataset = (await import("../data/hundredPlayers.js")).default;
      } else if (room.dataset === "ipl") {
        dataset = (await import("../data/iplPlayers.js")).default;
      } else if (room.dataset === "test") {
        dataset = (await import("../data/testPlayers.js")).default;
      } else if (room.dataset === "sa20") {
        dataset = (await import("../data/SA20.js")).default;
      } else if (room.dataset === "cpl") {
        dataset = (await import("../data/CPL.js")).default;
      } else if (room.dataset === "bbl") {
        dataset = (await import("../data/BBL.js")).default;
      } else if (room.dataset === "mlc") {
        dataset = (await import("../data/MLC.js")).default;
      }

      // console.log("🟢 Dataset loaded:", dataset.length, "players");

      auctionState[roomCode] = {
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null,
        timer: 20,
        notInterested: [],
        assigned: false,
        players: shuffleArray([...dataset]),
        unsoldPlayers: [], // ✅ Add this
      };

      io.to(roomCode).emit("game-started");
      sendNextPlayer(roomCode); // ✅ Immediately send first player
    });

    // ✅ Place Bid
    socket.on("place-bid", async ({ roomCode, playerName }) => {
      const state = auctionState[roomCode];
      if (!state || state.currentBidder === playerName) return;

      const room = await Room.findOne({ roomCode });
      const bidder = room.players.find((p) => p.name === playerName);
      if (!bidder) {
        socket.emit("bid-rejected", { reason: "Bidder not found" });
        return;
      }

      if (bidder.budget < state.currentBid + 0.5) {
        socket.emit("bid-rejected", { reason: "Insufficient budget" });
        return;
      }

      // ✅ FIRST BID (no current bidder yet)
      if (!state.currentBidder) {
        // The first bid stays at BASE_PRICE
        state.currentBidder = playerName;
        state.timer = 20;
        state.notInterested = [];

        room.bid = state.currentBid;
        room.bidder = playerName;
        room.timer = state.timer;
        await room.save();

        io.to(roomCode).emit("bid-update", {
          bid: state.currentBid,
          bidder: playerName,
          timer: state.timer,
          increment: 0,
          message: "First bid at base price",
        });

        return;
      }

      let increment = 0.5;
      if (state.currentBid >= 10 && state.currentBid < 20) {
        increment = 1;
      } else if (state.currentBid >= 20) {
        increment = 2;
      }

      const newBid = state.currentBid + increment;

      if (bidder.budget < newBid) {
        socket.emit("bid-rejected", { reason: "Insufficient budget" });
        return;
      }

      state.currentBid = newBid;

      state.currentBidder = playerName;
      state.timer = 20;
      state.notInterested = [];

      room.bid = state.currentBid;
      room.bidder = playerName;
      room.timer = state.timer;
      // console.log(`🧠 Bid attempt by ${playerName}, socket.id: ${socket.id}`);
      // console.log(`🧠 Stored socketId for ${playerName}: ${bidder?.socketId}`);
      await room.save();

      io.to(roomCode).emit("bid-update", {
        bid: state.currentBid,
        bidder: playerName,
        timer: state.timer,
        increment,
      });
    });

    // ✅ Not Interested
    socket.on("not-interested", async ({ roomCode, playerName }) => {
      const state = auctionState[roomCode];
      if (!state) return;

      if (!state.notInterested.includes(playerName)) {
        state.notInterested.push(playerName);
      }

      const room = await Room.findOne({ roomCode });
      const totalPlayers = room.players.length;

      if (state.notInterested.length === totalPlayers && !state.assigned) {
        clearInterval(state.intervalId);
        assignPlayer(roomCode, null);
        state.assigned = true;
      } else if (
        state.notInterested.length === totalPlayers - 1 &&
        state.currentBidder &&
        !state.assigned
      ) {
        clearInterval(state.intervalId);
        assignPlayer(roomCode, state.currentBidder);
        state.assigned = true;
      }
    });
    socket.on("rejoin-room", async ({ roomCode, playerName }) => {
      const room = await Room.findOne({ roomCode });
      if (!room) return;
      // console.log(playerName);
      const player = room.players.find(
        (p) => p.name.toLowerCase() === playerName.toLowerCase()
      );

      if (player) {
        player.socketId = socket.id;
        await room.save();
        socket.join(roomCode);
        // console.log(`🔄 ${playerName} rejoined room ${roomCode}`);

        socket.emit("team-data", player.team || []);
        io.to(roomCode).emit("player-list", room.players);

        // ✅ Emit auction state directly after rejoin
        const state = auctionState[roomCode];
        if (state) {
          const currentPlayer =
            room.currentPlayer || state.players[state.currentPlayerIndex];
          // console.log(
          //   `📦 Emitting auction-state for ${playerName}:`,
          //   currentPlayer
          // );
          socket.emit("auction-state", {
            currentPlayer,
            bid: state.currentBid,
            bidder: state.currentBidder,
            timer: state.timer,
          });
        } else {
          // console.log(
          //   `⚠️ No auction state found for room ${roomCode} during rejoin`
          // );
        }
      }
    });

    socket.on("get-all-teams", async (_, callback) => {
      try {
        const room = await Room.findOne({ "players.socketId": socket.id });
        if (!room) return callback([]);

        // Return all players with their team arrays
        const teams = room.players.map((p) => ({
          name: p.name,
          team: p.team || [],
        }));

        callback(teams);
      } catch (err) {
        console.error("❌ Error in get-all-teams:", err);
        callback([]);
      }
    });

    // ✅ Get Team
    socket.on("get-team", async ({ playerName }) => {
      const room = await Room.findOne({ "players.name": playerName });
      if (!room) return;

      const player = room.players.find((p) => p.name === playerName);

      // console.log("📦 Team data requested:", playerName, player.team); // 👈 Add this

      socket.emit("team-data", {
        team: player.team || [],
        budget: player.budget || 0,
      });
    });

    function isForeign(dataset, nation) {
      if (dataset === "ipl") return nation !== "INDIA";
      if (dataset === "hundred") return nation !== "England";
      if (dataset === "sa20") return nation !== "South Africa";
      if (dataset === "cpl") return nation !== "West Indies";
      if (dataset === "bbl") return nation !== "Australia";
      if (dataset === "mlc") return nation !== "USA";
      return false;
    }

    // ✅ Assign Player
    async function assignPlayer(roomCode, winnerName) {
      const state = auctionState[roomCode];
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

          // ✅ Team size check
          if (winner.team.length >= room.totalPlayersPerTeam) {
            const targetSocket = io.sockets.sockets.get(winner.socketId);
            if (targetSocket) {
              targetSocket.emit("bid-rejected", {
                reason: `❌ ${winner.name} already has ${room.totalPlayersPerTeam} players. Team is full.`,
              });
            }

            io.to(roomCode).emit("player-sold", {
              player: playerData,
              winner: "No one",
            });

            state.unsoldPlayers.push(rawPlayer);
            state.currentPlayerIndex += 1;
            state.assigned = false;
            return;
          }

          // ✅ Foreign player check
          if (isForeign(room.dataset, playerData.nation)) {
            const foreignCount = winner.team.filter((p) =>
              isForeign(room.dataset, p.nation)
            ).length;
            if (foreignCount >= room.maxForeignPlayers) {
              const targetSocket = io.sockets.sockets.get(winner.socketId);
              if (targetSocket) {
                targetSocket.emit("bid-rejected", {
                  reason: `You already have ${room.maxForeignPlayers} foreign players.`,
                });
              }

              io.to(roomCode).emit("player-sold", {
                player: playerData,
                winner: "No one",
              });

              state.unsoldPlayers.push(rawPlayer);
              state.currentPlayerIndex += 1;
              state.assigned = false;
              return;
            }
          }

          // ✅ Assign player
          winner.team.push(playerData);
          winner.budget = Math.max(0, winner.budget - playerData.price);
          state.unsoldPlayers = state.unsoldPlayers.filter(
            (p) => p.NAME !== rawPlayer.NAME
          );

          // ✅ Simplify before saving — only keep required fields
          const cleanTeam = winner.team.map((p) => ({
            name: p.name,
            role: p.role,
            nation: p.nation,
            price: p.price,
          }));

          // ✅ Save to DB
          await Room.findOneAndUpdate(
            { "players.name": winner.name },
            {
              $set: {
                "players.$.team": cleanTeam,
                "players.$.budget": winner.budget,
              },
            },
            { new: true }
          );
          assigned = true;

          // console.log("📦 DB Saved Team:", cleanTeam);
        }
      }

      if (!assigned) {
        io.to(roomCode).emit("player-sold", {
          player: playerData,
          winner: "No one",
        });

        state.unsoldPlayers.push(rawPlayer);
      } else {
        io.to(roomCode).emit("player-sold", {
          player: playerData,
          winner: winnerName,
        });
      }

      state.currentPlayerIndex += 1;
      state.assigned = false;

      room.markModified("players");
      const verifyRoom = await Room.findOne({ roomCode });
      const verifyPlayer = verifyRoom.players.find(
        (p) => p.name === winnerName
      );
      // console.log("📦 DB Saved Team:", verifyPlayer?.team || []);

      await room.save();

      const allTeamsFilled = room.players.every(
        (p) =>
          Array.isArray(p.team) &&
          typeof room.totalPlayersPerTeam === "number" &&
          p.team.length >= room.totalPlayersPerTeam
      );

      if (allTeamsFilled) {
        room.auctionEnded = true;
        await room.save();
        io.to(roomCode).emit("auction-ended");
        return; // ✅ Stop any further auction
      }

      if (state.currentPlayerIndex < state.players.length) {
        setTimeout(() => sendNextPlayer(roomCode), 2000);
      } else if (state.unsoldPlayers.length > 0) {
        state.players = [...state.unsoldPlayers];
        state.unsoldPlayers = [];
        state.currentPlayerIndex = 0;
        setTimeout(() => sendNextPlayer(roomCode), 2000);
      } else {
        io.to(roomCode).emit("auction-incomplete", {
          message: "Auction ended but some teams are not full.",
        });
      }
    }
    // ✅ Send Next Player
    async function sendNextPlayer(roomCode) {
      const state = auctionState[roomCode];
      const rawPlayer = state.players[state.currentPlayerIndex];
      if (!rawPlayer) return;
      const room = await Room.findOne({ roomCode });
      const playerData = {
        name: rawPlayer.NAME,
        team: rawPlayer.TEAM?.trim(),
        role: rawPlayer.ROLE,
        nation: rawPlayer.NATION,
        stats: rawPlayer.STATS || {},
        price: 0,
      };
      room.currentPlayer = playerData;

      state.currentBid = rawPlayer.BASE_PRICE || 0;

      state.currentBidder = null;
      state.timer = 20;
      state.notInterested = [];
      state.assigned = false;

      if (!room) return;

      room.currentPlayer = playerData;
      room.bid = 0;
      room.bidder = null;
      room.timer = 20;
      await room.save();

      io.to(roomCode).emit("new-player", {
        player: playerData,
        bid: state.currentBid,
        bidder: null,
        timer: 20,
      });
      // console.log("🟢 Sending player:", playerData);

      startTimer(roomCode);
    }

    // ✅ Start Timer
    function startTimer(roomCode) {
      const state = auctionState[roomCode];
      if (!state) return;

      if (state.intervalId) clearInterval(state.intervalId);

      state.intervalId = setInterval(() => {
        if (!auctionState[roomCode]) return clearInterval(state.intervalId);
        state.timer -= 1;
        io.to(roomCode).emit("timer-update", state.timer);

        if (state.timer <= 0 && !state.assigned) {
          clearInterval(state.intervalId);
          assignPlayer(roomCode, state.currentBidder);
          state.assigned = true;
        }
      }, 1000);
    }

    //messages
    socket.on("send_message", async ({ roomId, playerName, message }) => {
      if (!roomId || !message) return;

      // Broadcast the message to everyone in the room
      io.to(roomId).emit("receive_message", {
        playerName,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // ✅ Handle Disconnect
    socket.on("disconnect", async () => {
      const room = await Room.findOne({ "players.socketId": socket.id });
      if (!room) return;

      // ✅ Only clear socketId, don't remove player
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.socketId = null; // mark as disconnected
        await room.save();
        io.to(room.roomCode).emit("player-list", room.players);
        // console.log(
        //   `⚠️ ${player.name} disconnected but kept in room ${room.roomCode}`
        // );
      }
    });
  });
}

export default setupSocket;
