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
      }
      console.log('🟢 Dataset loaded:', dataset.length, 'players');

      auctionState[roomCode] = {
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null,
        timer: 20,
        notInterested: [],
        assigned: false,
        players: shuffleArray([...dataset])
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
  if (state.currentPlayerIndex >= state.players.length) {
    const room = await Room.findOne({ roomCode });
    if (room) {
      room.auctionEnded = true;
      await room.save();
    }
    io.to(roomCode).emit('auction-ended');
    return;
  }

  const rawPlayer = state.players[state.currentPlayerIndex];
  if (!rawPlayer) return;

  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const playerData = {
  name: rawPlayer.NAME,
  team: rawPlayer.TEAM?.trim(),
  role: rawPlayer.ROLE,
  nation: rawPlayer.NATION, // ✅ Added
  price: state.currentBid
};


  room.currentPlayer = null;
  room.bid = 0;
  room.bidder = null;
  room.timer = 0;

  if (winnerName) {
    const winner = room.players.find(p => p.name === winnerName);
    if (winner) {
  if (!winner.team) winner.team = [];

  if (winner.team.length >= room.totalPlayersPerTeam) {
    socket.emit('error', `❌ ${winner.name} already has ${room.totalPlayersPerTeam} players. Team is full.`);
    console.log(`🚫 Cannot assign player to ${winner.name}: team full`);
    return;
  }
  if (isForeign(room.dataset, playerData.nation)) {
  const foreignCount = winner.team.filter(p => isForeign(room.dataset, p.nation)).length;
  if (foreignCount >= room.maxForeignPlayers) {
  const targetSocket = io.sockets.sockets.get(winner.socketId);
  if (targetSocket) {
    targetSocket.emit('bid-rejected', {
      reason: `You already have ${room.maxForeignPlayers} foreign players.`
    });
  }

  // ✅ Still emit player-sold with "No one"
  io.to(roomCode).emit('player-sold', {
    player: playerData,
    winner: 'No one'
  });

  state.currentPlayerIndex += 1;
  state.assigned = false;

  if (state.currentPlayerIndex < state.players.length) {
    setTimeout(() => sendNextPlayer(roomCode), 2000);
  } else {
    room.auctionEnded = true;
    await room.save();
    io.to(roomCode).emit('auction-ended');
  }

  return; // ✅ Exit after handling fallback
}
}

  winner.team.push(playerData);
  winner.budget = Math.max(0, winner.budget - playerData.price);
  console.log('✅ Assigned to:', winner.name);
  console.log('💰 Final budget:', winner.budget);
  console.log('🧠 Final team:', winner.team);
}
  }

  await room.save();

  // ✅ Check if all players have full squads
  const allTeamsFilled = room.players.every(p =>
    Array.isArray(p.team) &&
    typeof room.totalPlayersPerTeam === 'number' &&
    p.team.length >= room.totalPlayersPerTeam
  );

  if (allTeamsFilled) {
    room.auctionEnded = true;
    await room.save();
    io.to(roomCode).emit('auction-ended');
    return;
  }



  io.to(roomCode).emit('player-sold', {
    player: playerData,
    winner: winnerName || 'No one'
  });

  state.currentPlayerIndex += 1;
  state.assigned = false;

  if (state.currentPlayerIndex < state.players.length) {
    setTimeout(() => sendNextPlayer(roomCode), 2000);
  } else {
    room.auctionEnded = true;
    await room.save();
    io.to(roomCode).emit('auction-ended');
  }
}

    // ✅ Send Next Player
   async function sendNextPlayer(roomCode) {
      const state = auctionState[roomCode];
      const rawPlayer = state.players[state.currentPlayerIndex];
      if (!rawPlayer) return;

      const playerData = {
  name: rawPlayer.NAME,
  team: rawPlayer.TEAM?.trim(),
  role: rawPlayer.ROLE,
  nation: rawPlayer.NATION, // ✅ Added
  price: 0
};

      state.currentBid = 0;
      state.currentBidder = null;
      state.timer = 20;
      state.notInterested = [];
      state.assigned = false;

      const room = await Room.findOne({ roomCode });
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
      room.players = room.players.filter(p => p.socketId !== socket.id);
      await room.save();
      io.to(room.roomCode).emit('player-list', room.players);
    });
  });
}

module.exports = setupSocket;