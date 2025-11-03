/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { API_BASE_URL } from "../config";
import AnimateBid from "../components/AnimateBid";
import PlayerCard from "../components/PlayerCard";
import AnimateBudget from "../components/AnimateBudget";
import { Toaster } from "react-hot-toast";
import ToastListener from "../components/ToastListener.jsx";
import ChatBox from "../components/ChatBox.jsx";
import { MessageSquare, Users2, Wallet } from "lucide-react";
import PlayerStats from "../components/PlayerStats.jsx";

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
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [topPlayers, setTopPlayers] = useState([]);
  const navigate = useNavigate();
  const showChatRef = useRef(showChat);
  const lastSeenCountRef = useRef(0);

  const playerName = localStorage.getItem("name");

  const fetchTeam = () => {
    axios
      .get(`${API_BASE_URL}/api/room/${roomCode}`)
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
    axios
      .get(`${API_BASE_URL}/api/room/${roomCode}`)
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
        socket.emit("rejoin-room", { roomCode, playerName });
      }

      // Update current auction state
      setPlayer(res.data.currentPlayer);
      setBid(res.data.bid);
      setBidder(res.data.bidder);
      setTimer(res.data.timer);
    } catch (err) {
      console.error("Error fetching room state:", err);
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
      if (!player || !player.name) return;

      // ❌ Skip unsold players
      if (
        !winner ||
        ["no one", "unsold", ""].includes(winner.trim().toLowerCase())
      )
        return;

      // ✅ Update team if you won
      if (winner?.toLowerCase() === playerName.toLowerCase()) {
        setTimeout(() => {
          fetchTeam();
        }, 500);
      }

      // ✅ Track only sold players
      setTopPlayers((prev) => {
        // Remove existing entry if same player is already in the list
        const filtered = prev.filter((p) => p.name !== player.name);

        const updated = [
          ...filtered,
          {
            name: player.name,
            nation: player.nation || "Unknown",
            price: Number(player.price) || 0,
            team: winner,
          },
        ];

        // Sort by price (highest first) and keep top 10
        updated.sort((a, b) => b.price - a.price);
        return updated.slice(0, 10);
      });

      localStorage.removeItem("auctionState");
    };

    //handleMessages
    const handleReceiveMessage = (msg) => {
      setMessages((prev) => {
        if (
          prev.some(
            (m) => m.message === msg.message && m.playerName === msg.playerName
          )
        ) {
          return prev;
        }

        const newMessages = [...prev, msg];

        if (!showChatRef.current) {
          const unread = Math.max(
            0,
            newMessages.length - lastSeenCountRef.current
          );
          setUnreadCount(unread);
        } else {
          // Chat is open — mark as read immediately
          lastSeenCountRef.current = newMessages.length;
          setUnreadCount(0);
        }

        return newMessages;
      });
    };

    socket.on("receive_message", handleReceiveMessage);

    const handleAuctionEnd = () => {
      setAuctionEnded(true);
      setPlayer(null);
      setBidder(null);
      setBid(0);
      setTimer(0);
      localStorage.removeItem("auctionState");
    };
    const handleAuctionState = ({ currentPlayer, bid, bidder, timer }) => {
      // console.log(
      //   "🧠 Restoring auction state:",
      //   currentPlayer,
      //   bid,
      //   bidder,
      //   timer
      // );
      setPlayer(currentPlayer);
      setBid(bid);
      setBidder(bidder);
      setTimer(timer);
      saveAuctionState({ player: currentPlayer, bid, bidder, timer });
    };

    socket.on("new-player", handleNewPlayer);
    socket.on("bid-update", handleBidUpdate);
    socket.on("team-data", handleTeamData);
    socket.on("auction-state", handleAuctionState);
    socket.on("player-sold", handlePlayerSold);
    socket.on("timer-update", setTimer);
    socket.on("auction-incomplete", ({ message }) => {
      console.warn("⚠️ Auction incomplete:", message);
      alert(message); // or show a modal/toast
    });
    socket.on("auction-ended", handleAuctionEnd);
    socket.on("bid-rejected", ({ reason }) => {
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
      socket.off("new-player", handleNewPlayer);
      socket.off("bid-update", handleBidUpdate);
      socket.off("team-data", handleTeamData);
      socket.off("auction-state", handleAuctionState);
      socket.off("player-sold", handlePlayerSold);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("timer-update");
      socket.off("auction-incomplete");
      socket.off("auction-ended", handleAuctionEnd);
      socket.off("bid-rejected");
    };
  }, [roomCode, playerName]);

  useEffect(() => {
    fetchTeam();
  }, [player]);

  useEffect(() => {
    showChatRef.current = showChat;

    // When user opens chat → mark all messages seen
    if (showChat) {
      lastSeenCountRef.current = messages.length;
      setUnreadCount(0);
    }
  }, [showChat, messages.length]);

  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  // 🔹 Load top players only for this room
  useEffect(() => {
    const saved = localStorage.getItem(`topPlayers_${roomCode}`);
    if (saved) setTopPlayers(JSON.parse(saved));
  }, [roomCode]);

  // 🔹 Save top players per room
  useEffect(() => {
    localStorage.setItem(`topPlayers_${roomCode}`, JSON.stringify(topPlayers));
  }, [topPlayers, roomCode]);

  useEffect(() => {
    if (auctionEnded) {
      localStorage.removeItem(`topPlayers_${roomCode}`);
      setTopPlayers([]);
    }
  }, [auctionEnded, roomCode]);

  const handleBid = () => {
    socket.emit("place-bid", { roomCode, playerName });
  };

  const handlePass = () => {
    socket.emit("not-interested", { roomCode, playerName });
  };

  const isForeign = (dataset, nation) => {
    if (dataset === "ipl") return nation !== "INDIA";
    if (dataset === "hundred") return nation !== "England";
    return false;
  };
  const isCurrentPlayerForeign = isForeign(room?.dataset, player?.nation);
  const foreignCount = team.filter((p) =>
    isForeign(room?.dataset, p.nation)
  ).length;
  const foreignLimitReached =
    typeof room?.maxForeignPlayers === "number" &&
    foreignCount >= room.maxForeignPlayers;

  const isTeamFull =
    typeof totalPlayersPerTeam === "number" &&
    team.length >= totalPlayersPerTeam;

  // 🟡 Filter other teams (excluding your own)
  const otherTeams = room?.players?.filter(
    (p) => p.name.toLowerCase() !== playerName.toLowerCase()
  );

  const bidDisabled =
    isTeamFull ||
    typeof remainingBudget !== "number" ||
    remainingBudget < bid + 0.5 ||
    (isCurrentPlayerForeign && foreignLimitReached) ||
    (bidder && bidder.toLowerCase() === playerName.toLowerCase()); // ✅ Disable if you are current highest bidder

  useEffect(() => {
    if (auctionEnded) {
      const timer = setTimeout(() => {
        navigate("/team"); // 👈 this must match your route path
      }, 2000); // 2 seconds delay before redirect
      return () => clearTimeout(timer);
    }
  }, [auctionEnded, navigate]);

  if (auctionEnded) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Auction Completed 🎉</h2>
        <p>Redirecting to your Team Squad...</p>
      </div>
    );
  }

  if (auctionEnded) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Auction Completed 🎉</h2>
        <p>Check your team squad to see the players you won!</p>
      </div>
    );
  }

  return (
    <div className=" min-h-screen bg-aucBG text-font   p-4">
      <Toaster position="top-center" reverseOrder={false} />
      <ToastListener />
      <h1 className="text-xl sm:text-2xl md:text-2xl font-text font-bold  p-1">
        AuctionPlay
      </h1>

      <div className="flex flex-col justify-center items-center">
        <div className="absolute right-4 top-4 font-body font-semibold drawer z-50">
          <input id="my-drawer-1" type="checkbox" className="drawer-toggle" />

          {/* Open Button */}

          {/* Drawer Side */}
          <div className="drawer-side">
            <label htmlFor="my-drawer-1" className="drawer-overlay"></label>

            <div className="menu bg-aucBG text-font min-h-full w-80 p-4 border-l border-border relative">
              {/* Header */}
              <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
                <h4 className="text-lg font-semibold text-role uppercase tracking-wide">
                  Your Squad
                </h4>
                <label
                  htmlFor="my-drawer-1"
                  className="cursor-pointer hover:text-playerName transition-colors text-base"
                >
                  ✕
                </label>
              </div>

              {/* Scrollable Content */}
              <div className="max-h-[68vh] overflow-y-auto pr-1 custom-scrollbar space-y-2">
                {["Batter", "Bowler", "All-Rounder", "WK-Batter"].map(
                  (role) => {
                    const playersByRole = team.filter(
                      (p) => p.role.toLowerCase() === role.toLowerCase()
                    );
                    if (playersByRole.length === 0) return null;

                    return (
                      <div
                        key={role}
                        className="bg-card rounded-lg p-2 border border-border/60 hover:border-role/60 transition-all duration-200"
                      >
                        {/* Role Header */}
                        <div className="flex justify-between items-center mb-1">
                          <h5 className="text-role font-semibold text-[11px] uppercase tracking-wide">
                            {role}s
                          </h5>
                          <span className="text-[10px] text-mute">
                            {playersByRole.length}
                          </span>
                        </div>

                        {/* Player List */}
                        <ul className="divide-y divide-border/40 text-[13px] font-medium">
                          {playersByRole.map((p, i) => {
                            const foreign = isForeign(room.dataset, p.nation);
                            const formattedName = p.name
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase());

                            return (
                              <li
                                key={i}
                                className="flex justify-between items-center py-1 flex-row"
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-font">
                                    {formattedName}
                                  </span>
                                  {foreign && (
                                    <span
                                      className="text-font text-[11px]"
                                      title={`${p.nation} Player`}
                                    >
                                      ✈
                                    </span>
                                  )}
                                </div>
                                <span className="text-bid font-semibold text-[12px]">
                                  ₹{p.price} Cr
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Footer Summary */}
              <div className="absolute bottom-5 left-4 right-4 bg-card rounded-lg p-3 border border-border/70">
                <p className="text-sm text-mute">
                  Remaining Budget:{" "}
                  <span className="text-role font-semibold">
                   ₹{Number(remainingBudget).toFixed(2)}
                  </span>{" "}
                  Cr
                </p>
                <p className="text-sm text-mute">
                  Spots Filled:{" "}
                  <span className="text-playerName font-semibold">
                    {team.length}
                  </span>{" "}
                  / {totalPlayersPerTeam}
                </p>
                <button
                  onClick={fetchTeam}
                  className="btn bg-currentBid hover:bg-playerName text-black font-bold border-none w-full mt-2 py-2 rounded-md transition-all"
                >
                  Refresh Squad
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="font-text font-semibold flex justify-between   rounded-md p-2 mt-10 gap-20 max-w-xl w-full text-sm">
          <p>Room Code: {roomCode}</p>
          <p>Player: {playerName}</p>
        </div>

        {player?.name ? (
          <div className="rounded-lg max-w-xl w-full  shadow-md shadow-black">
            <div className="bg-bg p-2 rounded-tr-md rounded-tl-md">
              <div className="flex justify-between items-center">
                <p className="text-xl flex items-center gap-2">
                  <span>Timer:</span>

                  <span className="text-org">{timer}</span>
                </p>

                <AnimateBudget budget={remainingBudget} label="Remaining" />
              </div>

              <PlayerCard player={player} />

              <div className="flex flex-col justify-center items-center font-text  gap-2 rounded-md bg-black p-2">
                <div className="flex gap-2 items-center justify-center">
                  <div className="inline-grid *:[grid-area:1/1]">
                    <div className="status status-error animate-ping"></div>
                    <div className="status status-error"></div>
                  </div>
                  <span className="text-red-500 text-lg font-semibold">
                    Live -{" "}
                  </span>
                  <AnimateBid highestBidder={bidder} highestBid={bid} />
                </div>
              </div>
            </div>

            <div className="bg-card2 p-2 rounded-br-md rounded-bl-md">
              <PlayerStats player={player} />

              {/* ✅ Bid and Pass Buttons */}
              {/* ✅ Main Bid Controls */}
              <div className="flex gap-3 justify-center items-center mt-5 font-text font-semibold">
                <button
                  onClick={handleBid}
                  disabled={bidDisabled}
                  className={`btn btn-primary flex-1 text-lg font-bold h-12 ${
                    bidDisabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Bid
                </button>

                <button
                  onClick={handlePass}
                  disabled={bidder?.toLowerCase() === playerName.toLowerCase()} // ✅ Disable pass too
                  className={`btn btn-warning flex-1 text-lg font-bold h-12 ${
                    bidder?.toLowerCase() === playerName.toLowerCase()
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  Pass
                </button>
              </div>

              {/* ⚙️ Utility Buttons — smaller, subtle */}
              <div className="mt-3 flex gap-2 justify-center font-text  w-full">
                <button
                  className="btn btn-sm bg-playerName hover:bg-playerName/80 text-white rounded-md text-xs flex-1 indicator"
                  onClick={() => {
                    setShowChat(true);
                    lastSeenCountRef.current = messages.length;
                    setUnreadCount(0);
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                  {unreadCount > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center indicator-item badge-secondary">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                <label
                  htmlFor="my-drawer-1"
                  className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white border-none flex-1 rounded-md text-xs"
                >
                  <Users2 className="w-4 h-4" />
                  Squad
                </label>

                <button
                  className="btn btn-sm bg-currentBid hover:bg-playerName text-white border-none flex-1 rounded-md text-xs"
                  onClick={() =>
                    document.getElementById("otherBudgetsModal").showModal()
                  }
                >
                  <Wallet className="w-4 h-4" />
                  Budgets
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p>Waiting for next player...</p>
        )}
      </div>

      {/* ChatBox */}
      {showChat && (
        <div
          className="fixed inset-0 z-30 bg-black/70 flex justify-center items-center"
          onClick={() => setShowChat(false)} // click outside closes chat
        >
          <div
            className="w-80 h-96 relative"
            onClick={(e) => e.stopPropagation()} // click inside doesn't close
          >
            <ChatBox
              roomId={roomCode}
              playerName={playerName}
              messages={messages}
              setMessages={setMessages}
              closeChat={() => setShowChat(false)}
            />

            <button
              className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2 text-white"
              onClick={() => setShowChat(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <dialog id="otherBudgetsModal" className="modal">
        <div className="modal-box bg-aucBG text-font border border-border rounded-lg">
          <h3 className="text-playerName text-lg font-bold mb-3 text-center">
            Other Teams’ Budgets
          </h3>

          <ul className="divide-y divide-border/60">
            {room?.players
              ?.filter((p) => p.name.toLowerCase() !== playerName.toLowerCase())
              .map((p) => (
                <li
                  key={p.name}
                  className="flex justify-between items-center py-2 font-text text-sm"
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-role">
                    ₹{Number(p.budget).toFixed(2)} Cr
                  </span>
                  <span>
                    {p.team.length}/{totalPlayersPerTeam}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        {/* Click outside or ESC closes modal */}
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* //top paid */}
      <div className="flex flex-col justify-center items-center">
        {topPlayers.length > 0 && (
          <div className="max-w-xl w-full bg-card border border-border rounded-xl p-4 mt-6 shadow-md">
            <h3 className="text-lg font-bold text-role mb-3 flex items-center gap-2">
              Top 10 Highest-Paid Players
            </h3>

            <ul className="space-y-2">
              {topPlayers.map((p, i) => (
                <li
                  key={i}
                  className={`flex justify-between items-center py-3 px-2 rounded-lg transition-all
        ${
          i === 0
            ? "bg-linear-to-r from-yellow-400/20 to-yellow-600/10 border border-yellow-400/40 shadow-md scale-[1.02]"
            : "hover:bg-card/60"
        }`}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-3 w-1/6">
                    <div
                      className={`text-4xl font-thin tabular-nums ${
                        i === 0
                          ? "text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]"
                          : "opacity-30"
                      }`}
                    >
                      {i + 1 === 1 ? "👑" : i + 1}
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="flex flex-col w-2/5">
                    <p
                      className={`font-semibold ${
                        i === 0 ? "text-yellow-300" : "text-font"
                      }`}
                    >
                      {p.name}
                    </p>
                    <p className="text-xs text-mute">{p.nation}</p>
                  </div>

                  {/* Team */}
                  <div
                    className={`text-xs uppercase font-semibold w-1/5 text-center ${
                      i === 0 ? "text-yellow-400" : "text-role"
                    }`}
                  >
                    {p.team || p.winner || "—"}
                  </div>

                  {/* Price */}
                  <div className="flex justify-end w-1/5">
                    <button
                      className={`btn btn-sm border-none rounded-md px-3 font-bold ${
                        i === 0
                          ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                    >
                      ₹{p.price} Cr
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuctionRoom;
