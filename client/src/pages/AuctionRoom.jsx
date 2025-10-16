import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function AuctionRoom() {
  const { roomCode } = useParams();
  const [player, setPlayer] = useState(null);
  const [bid, setBid] = useState(0);
  const [bidder, setBidder] = useState(null);
  const [timer, setTimer] = useState(20);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  const [team, setTeam] = useState([]);
  const [remainingBudget, setRemainingBudget] = useState(null);
  const [totalPlayersPerTeam, setTotalPlayersPerTeam] = useState(null);
  const [room, setRoom] = useState(null);
  const playerName = localStorage.getItem('name');

  const fetchTeam = () => {
    axios.get(`${API_BASE_URL}/api/room/${roomCode}`)
      .then((res) => {
        const roomData = res.data;
        setRoom(roomData); // ✅ Store full room object
        if (!roomData || !Array.isArray(roomData.players)) {
          setTeam([]);
          setRemainingBudget(0);
          return;
        }

        const myPlayer = roomData.players.find(
          (p) => p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (!myPlayer) {
          setTeam([]);
          setRemainingBudget(0);
          return;
        }

        setTeam(Array.isArray(myPlayer.team) ? myPlayer.team : []);
        setRemainingBudget(Number(myPlayer.budget) || 0);
        setTotalPlayersPerTeam(roomData.totalPlayersPerTeam || null);
      })
      .catch(() => {
        setTeam([]);
        setRemainingBudget(0);
      });
  };
 const saveAuctionState = (state) => {
  localStorage.setItem("auctionState", JSON.stringify(state));
};

  // 🔹 Load last known auction state from localStorage
const loadAuctionState = () => {
  const saved = localStorage.getItem("auctionState");
  if (saved) {
    const { player, bid, bidder, timer } = JSON.parse(saved);
    setPlayer(player);
    setBid(bid);
    setBidder(bidder);
    setTimer(timer);
  }
};

  const fetchAuctionState = () => {
    axios.get(`${API_BASE_URL}/api/room/${roomCode}`)
      .then((res) => {
        const room = res.data;
        if (!room) return;
        setPlayer(room.currentPlayer || null);
        setBid(room.bid || 0);
        setBidder(room.bidder || null);
        setTimer(room.timer || 20);
        setAuctionEnded(room.auctionEnded || false);
      })
      .catch(() => {});
  };

  const checkRoomState = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/room/${roomCode}/state`);

    if (res.data.auctionEnded) {
      setAuctionEnded(true);
      setPlayer(null);
      setBid(0);
      setBidder(null);
      setTimer(0);
      return; // stop further actions
    }

    // Auction ongoing → safe to rejoin
    if (playerName && roomCode) {
      socket.emit('rejoin-room', { roomCode, playerName });
    }

    // Update current auction state
    setPlayer(res.data.currentPlayer);
    setBid(res.data.bid);
    setBidder(res.data.bidder);
    setTimer(res.data.timer);

  } catch (err) {
    console.error('Error fetching room state:', err);
  }
};


  useEffect(() => {
  loadAuctionState();
  checkRoomState();
    fetchTeam();
  fetchAuctionState();
 
  const handleTeamData = (team) => {
    setTeam(Array.isArray(team) ? team : []);
  };

  const handleNewPlayer = ({ player, bid, bidder, timer }) => {
    setPlayer(player);
    setBid(bid);
    setBidder(bidder);
    setTimer(timer);
  };

  const handleBidUpdate = ({ bid, bidder, timer }) => {
    setBid(bid);
    setBidder(bidder);
    setTimer(timer);
    const saved = JSON.parse(localStorage.getItem("auctionState")) || {};
  saveAuctionState({ ...saved, bid, bidder, timer });
  };

  const handlePlayerSold = ({ player, winner }) => {
    if (winner?.toLowerCase() === playerName.toLowerCase()) {
      setTimeout(() => {
        fetchTeam();
      }, 500);
    }
    localStorage.removeItem("auctionState");
  };

  const handleAuctionEnd = () => {
    setAuctionEnded(true);
    setPlayer(null);
    setBidder(null);
    setBid(0);
    setTimer(0);
     localStorage.removeItem("auctionState");
  };
  const handleAuctionState = ({ currentPlayer, bid, bidder, timer }) => {
      console.log("🧠 Restoring auction state:", currentPlayer, bid, bidder, timer);
      setPlayer(currentPlayer);
      setBid(bid);
      setBidder(bidder);
      setTimer(timer);
      saveAuctionState({ player: currentPlayer, bid, bidder, timer });
    };

  socket.on('new-player', handleNewPlayer);
  socket.on('bid-update', handleBidUpdate);
  socket.on('team-data', handleTeamData);
  socket.on('auction-state', handleAuctionState);
  socket.on('player-sold', handlePlayerSold);
  socket.on('timer-update', setTimer);
  socket.on('auction-incomplete', ({ message }) => {
    console.warn('⚠️ Auction incomplete:', message);
    alert(message); // or show a modal/toast
  });
  socket.on('auction-ended', handleAuctionEnd);
  socket.on('bid-rejected', ({ reason }) => {
    alert(`Bid rejected: ${reason}`);
  });
  
  // 🔹 Wait for socket reconnect before rejoining
// socket.once("connect", () => {
//   console.log("🔁 Socket connected, rejoining room...");
//   if (roomCode && playerName) {
//     socket.emit("rejoin-room", { roomCode, playerName });
//   }
// });

 

  return () => {
    socket.off('new-player', handleNewPlayer);
    socket.off('bid-update', handleBidUpdate);
    socket.off('team-data', handleTeamData);
    socket.off('auction-state', handleAuctionState);
    socket.off('player-sold', handlePlayerSold);
    socket.off('timer-update');
    socket.off('auction-incomplete');
    socket.off('auction-ended', handleAuctionEnd);
    socket.off('bid-rejected');

  };
}, [roomCode, playerName]);

  useEffect(() => {
    fetchTeam();
  }, [player]);


  const handleBid = () => {
    socket.emit('place-bid', { roomCode, playerName });
  };

  const handlePass = () => {
    socket.emit('not-interested', { roomCode, playerName });
  };

  const isForeign = (dataset, nation) => {
  if (dataset === 'ipl') return nation !== 'INDIA';
  if (dataset === 'hundred') return nation !== 'England';
  return false;
};
const isCurrentPlayerForeign = isForeign(room?.dataset, player?.nation);
const foreignCount = team.filter(p => isForeign(room?.dataset, p.nation)).length;
const foreignLimitReached = typeof room?.maxForeignPlayers === 'number' && foreignCount >= room.maxForeignPlayers;

const isTeamFull = typeof totalPlayersPerTeam === 'number' && team.length >= totalPlayersPerTeam;

const bidDisabled =
  isTeamFull ||
  typeof remainingBudget !== 'number' ||
  remainingBudget < bid + 0.5 ||
  (isCurrentPlayerForeign && foreignLimitReached);
  if (auctionEnded) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Auction Completed 🎉</h2>
        <p>Check your team squad to see the players you won!</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '30px', position: 'relative' }}>
      <p>Room Code: {roomCode}</p>
      <p>Player Name: {playerName}</p>

      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button
          onClick={() => setShowSquad(!showSquad)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          View Squad
        </button>
      </div>

      {showSquad && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            right: 20,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            maxWidth: '250px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Your Squad</h4>
            <button
              onClick={() => setShowSquad(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                color: '#888',
              }}
            >
              ❌
            </button>
          </div>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            {team.length > 0 ? (
              team.map((p, i) => (
                <li key={i}>
  {p.name} ({p.nation}) {isForeign(room.dataset, p.nation) ? '✈️' : ''} - {p.team} | Role: {p.role} | Amnt: ₹{p.price} Cr
</li>
              ))
            ) : (
              <li>No players yet</li>
            )}
          </ul>
          <p><strong>Remaining Budget:</strong> ₹{remainingBudget ?? '...'} Cr</p>
          {typeof totalPlayersPerTeam === 'number' && (
            <>
              <p><strong>Total Spot Filled:</strong> {team.length}</p>
              <p><strong>Remaining Spot:</strong> {totalPlayersPerTeam - team.length}</p>
            </>
          )}
          <button
            onClick={fetchTeam}
            style={{
              marginTop: '8px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            Refresh Squad
          </button>
        </div>
      )}

      {player?.name ? (
  <div className="player-card">
    <h2>{player.name}</h2>
    <p><strong>Team:</strong> {player.team}</p>
    <p><strong>Role:</strong> {player.role}</p>
    <p><strong>Nation:</strong> {player.nation}</p>
    <p><strong>Highest Bidder:</strong> {bidder || 'None'}</p>
    <p><strong>Current Bid:</strong> ₹{bid.toFixed(2)} Cr</p>
  
    {/* ✅ Batting Stats */}
    {player.stats?.Batting && (
      <div style={{ marginTop: '10px' }}>
        <h4>Batting Stats</h4>
        <p>Matches: {player.stats.Batting.M}</p>
        <p>Runs: {player.stats.Batting.R}</p>
        <p>Avg: {player.stats.Batting.Avg}</p>
        <p>SR: {player.stats.Batting.SR}</p>
      </div>
    )}

    {/* ✅ Bowling Stats */}
    {player.stats?.Bowling && (
      <div style={{ marginTop: '10px' }}>
        <h4>Bowling Stats</h4>
        <p>Wickets: {player.stats.Bowling.W}</p>
        <p>Avg: {player.stats.Bowling.Avg}</p>
        <p>Econ: {player.stats.Bowling.Econ}</p>
      </div>
    )}
    <p><strong>Timer:</strong> {timer}</p>

    {/* ✅ Bid and Pass Buttons */}
    <button
      onClick={handleBid}
      disabled={bidDisabled}
      style={{
        padding: '8px 16px',
        backgroundColor: bidDisabled ? '#ccc' : '#007bff',
        color: '#fff',
        border: 'none',
        borderRadius: '5px',
        cursor: bidDisabled ? 'not-allowed' : 'pointer',
        marginRight: '10px'
      }}
    >
      Bid
    </button>
    <button
      onClick={handlePass}
      style={{
        padding: '8px 16px',
        backgroundColor: '#dc3545',
        color: '#fff',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
      }}
    >
      Pass
    </button>
  </div>
) : (
  <p>Waiting for next player...</p>
)}
    </div>
  );
}

export default AuctionRoom;