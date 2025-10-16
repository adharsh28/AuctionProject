const { Server } = require('socket.io');
const Room = require('../models/Room');

let auctionState = {};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
    origin: '*', // ✅ or 'http://10.153.33.129:5173'
    methods: ['GET', 'POST']
  }

  });

  io.on('connection', (socket) => {
    // ✅ Create Room
    socket.on('create-room', async ({ roomCode, maxPlayers, name, budget, dataset, totalPlayersPerTeam, maxForeignPlayers }) => {
  const room = new Room({
    roomCode,
    creator: name,
    maxPlayers,
    budget: Number(budget),
    totalPlayersPerTeam: Number(totalPlayersPerTeam),
    maxForeignPlayers: Number(maxForeignPlayers), // ✅ Add this line
    dataset,
    players: [{
      name,
      socketId: socket.id,
      team: [],
      budget: Number(budget)
    }]
  });

  await room.save();
  socket.join(roomCode);
  io.to(roomCode).emit('player-list', room.players);
});

    // ✅ Join Room
    socket.on('join-room', async ({ roomCode, name }) => {
  const room = await Room.findOne({ roomCode });
  if (!room || room.players.length >= room.maxPlayers) return;

  const existingPlayer = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());

  if (existingPlayer) {
    // ✅ Update socketId for this player only
    existingPlayer.socketId = socket.id;
  } else {
    // ✅ Add new player if not already joined
    room.players.push({
      name,
      socketId: socket.id,
      team: [],
      budget: room.budget
    });
  }

  await room.save(); // ✅ Save updated room with correct player list

  socket.join(roomCode);
  io.to(roomCode).emit('player-list', room.players);
});

    // ✅ Get Room Info
    socket.on('get-room-info', async ({ roomCode }) => {
      const room = await Room.findOne({ roomCode });
      if (room) {
        socket.emit('room-info', {
          creator: room.creator,
          maxPlayers: room.maxPlayers
        });
      }
    });

    // ✅ Start Game
    socket.on('start-game', async ({ roomCode }) => {
      console.log('🟢 start-game received for room:', roomCode);
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      let dataset = [];
      console.log(room.dataset)
      if (room.dataset === 'hundred') {
        dataset = require('../data/hundredPlayers');
      } else if (room.dataset === 'ipl') {
        dataset = require('../data/iplPlayers');
      } else if (room.dataset === 'test') {
  dataset = require('../data/testPlayers');
}


      console.log('🟢 Dataset loaded:', dataset.length, 'players');

      auctionState[roomCode] = {
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null,
        timer: 20,
        notInterested: [],
        assigned: false,
        players: shuffleArray([...dataset]),
        unsoldPlayers: [] // ✅ Add this
      };

      io.to(roomCode).emit('game-started');
      sendNextPlayer(roomCode); // ✅ Immediately send first player
    });

    // ✅ Place Bid
    socket.on('place-bid', async ({ roomCode, playerName }) => {
      const state = auctionState[roomCode];
      if (!state || state.currentBidder === playerName) return;

      const room = await Room.findOne({ roomCode });
      const bidder = room.players.find(p => p.name === playerName);
      if (!bidder) {
        socket.emit('bid-rejected', { reason: 'Bidder not found' });
        return;
      }

      if (bidder.budget < state.currentBid + 0.5) {
        socket.emit('bid-rejected', { reason: 'Insufficient budget' });
        return;
      }

      state.currentBid += 0.5;
      state.currentBidder = playerName;
      state.timer = 20;
      state.notInterested = [];

      room.bid = state.currentBid;
room.bidder = playerName;
room.timer = state.timer;
console.log(`🧠 Bid attempt by ${playerName}, socket.id: ${socket.id}`);
console.log(`🧠 Stored socketId for ${playerName}: ${bidder?.socketId}`);
await room.save();

      io.to(roomCode).emit('bid-update', {
        bid: state.currentBid,
        bidder: playerName,
        timer: state.timer
      });
    });

    // ✅ Not Interested
    socket.on('not-interested', async ({ roomCode, playerName }) => {
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
   socket.on('rejoin-room', async ({ roomCode, playerName }) => {
  const room = await Room.findOne({ roomCode });
  if (!room) return;
    console.log(playerName )
  const player = room.players.find(
  p => p.name.toLowerCase() === playerName.toLowerCase()
);

  if (player) {
    player.socketId = socket.id;
    await room.save();
    socket.join(roomCode);
    console.log(`🔄 ${playerName} rejoined room ${roomCode}`);

    socket.emit('team-data', player.team || []);
    io.to(roomCode).emit('player-list', room.players);

    // ✅ Emit auction state directly after rejoin
    const state = auctionState[roomCode];
    if (state) {
      const currentPlayer = room.currentPlayer || state.players[state.currentPlayerIndex];
      console.log(`📦 Emitting auction-state for ${playerName}:`, currentPlayer);
      socket.emit('auction-state', {
        currentPlayer,
        bid: state.currentBid,
        bidder: state.currentBidder,
        timer: state.timer
      });
    } else {
      console.log(`⚠️ No auction state found for room ${roomCode} during rejoin`);
    }
  }
});
    // ✅ Get Team
    socket.on('get-team', async ({ playerName }) => {
      const room = await Room.findOne({ 'players.name': playerName });
      if (!room) return;
      const player = room.players.find(p => p.name === playerName);
      socket.emit('team-data', player.team || []);
    });


    function isForeign(dataset, nation) {
  if (dataset === 'ipl') return nation !== 'INDIA';
  if (dataset === 'hundred') return nation !== 'England';
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
    price: state.currentBid
  };

  room.currentPlayer = null;
  room.bid = 0;
  room.bidder = null;
  room.timer = 0;

  let assigned = false;

  if (winnerName) {
    const winner = room.players.find(p => p.name === winnerName);
    if (winner) {
      if (!winner.team) winner.team = [];

      // ✅ Team size check
      if (winner.team.length >= room.totalPlayersPerTeam) {
        const targetSocket = io.sockets.sockets.get(winner.socketId);
        if (targetSocket) {
          targetSocket.emit('bid-rejected', {
            reason: `❌ ${winner.name} already has ${room.totalPlayersPerTeam} players. Team is full.`
          });
        }

        io.to(roomCode).emit('player-sold', {
          player: playerData,
          winner: 'No one'
        });

        state.unsoldPlayers.push(rawPlayer);
        state.currentPlayerIndex += 1;
        state.assigned = false;
        return;
      }

      // ✅ Foreign player check
      if (isForeign(room.dataset, playerData.nation)) {
        const foreignCount = winner.team.filter(p => isForeign(room.dataset, p.nation)).length;
        if (foreignCount >= room.maxForeignPlayers) {
          const targetSocket = io.sockets.sockets.get(winner.socketId);
          if (targetSocket) {
            targetSocket.emit('bid-rejected', {
              reason: `You already have ${room.maxForeignPlayers} foreign players.`
            });
          }

          io.to(roomCode).emit('player-sold', {
            player: playerData,
            winner: 'No one'
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
      state.unsoldPlayers = state.unsoldPlayers.filter(p => p.NAME !== rawPlayer.NAME);
      assigned = true;

      console.log('✅ Assigned to:', winner.name);
      console.log('💰 Final budget:', winner.budget);
      console.log('🧠 Final team:', winner.team);
    }
  }

  if (!assigned) {
    io.to(roomCode).emit('player-sold', {
      player: playerData,
      winner: 'No one'
    });

    state.unsoldPlayers.push(rawPlayer);
  } else {
    io.to(roomCode).emit('player-sold', {
      player: playerData,
      winner: winnerName
    });
  }

  state.currentPlayerIndex += 1;
  state.assigned = false;
  await room.save();

  const allTeamsFilled = room.players.every(
    p => Array.isArray(p.team) &&
         typeof room.totalPlayersPerTeam === 'number' &&
         p.team.length >= room.totalPlayersPerTeam
  );

  if (allTeamsFilled) {
    room.auctionEnded = true;
    await room.save();
    io.to(roomCode).emit('auction-ended');
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
    io.to(roomCode).emit('auction-incomplete', {
      message: 'Auction ended but some teams are not full.'
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
  price: 0
  
};
room.currentPlayer = playerData;

      state.currentBid = 0;
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


      io.to(roomCode).emit('new-player', {
        player: playerData,
        bid: 0,
        bidder: null,
        timer: 20
      });
      console.log('🟢 Sending player:', playerData);

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
        io.to(roomCode).emit('timer-update', state.timer);

        if (state.timer <= 0 && !state.assigned) {
          clearInterval(state.intervalId);
          assignPlayer(roomCode, state.currentBidder);
          state.assigned = true;
        }
      }, 1000);
    }

    // ✅ Handle Disconnect
   socket.on('disconnect', async () => {
  const room = await Room.findOne({ 'players.socketId': socket.id });
  if (!room) return;

  // ✅ Only clear socketId, don't remove player
  const player = room.players.find(p => p.socketId === socket.id);
  if (player) {
    player.socketId = null; // mark as disconnected
    await room.save();
    io.to(room.roomCode).emit('player-list', room.players);
    console.log(`⚠️ ${player.name} disconnected but kept in room ${room.roomCode}`);
  }
});

  });
}

module.exports = setupSocket;