import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import { Copy, Users, Coins, Globe2,Trophy,UserPlus } from "lucide-react";

function RoomLobby() {
  const { roomCode } = useParams();
  const [players, setPlayers] = useState([]);
  const [creator, setCreator] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [budget, setBudget] = useState("");
  const [maxForeign, setMaxForeign] = useState("");
  const [league, setLeague] = useState("");
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState("");
  const navigate = useNavigate();
  const playerName = localStorage.getItem("name");
  const [copy,setCopy] = useState(false)

  useEffect(() => {
    if (playerName && roomCode) {
      socket.emit("rejoin-room", { roomCode, playerName });
    }

    socket.emit("get-room-info", { roomCode });

    socket.on(
      "room-info",
      ({
        creator,
        maxPlayers,
        budget,
        maxForeignPlayers,
        league,
        totalPlayersPerTeam,
      }) => {
        setCreator(creator);
        setMaxPlayers(maxPlayers);
        setBudget(budget), setMaxForeign(maxForeignPlayers);
        setMaxPlayersPerTeam(totalPlayersPerTeam)
        setLeague(league)
      }
    );

    socket.on("player-list", (list) => {
      setPlayers(list);
    });

    socket.on("game-started", () => {
      navigate(`/auction/${roomCode}`);
    });

    return () => {
      socket.off("room-info");
      socket.off("player-list");
      socket.off("game-started");
    };
  }, [roomCode, navigate, playerName]);

  const handleStart = () => {
    socket.emit("start-game", { roomCode });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
     setCopy(true); 

  setTimeout(() => {
    setCopy(false);
  }, 2000);
  };

  const isRoomFull = players.length === maxPlayers;
  const isCreator =
    playerName?.trim().toLowerCase() === creator?.trim().toLowerCase();

    

  return (
    <div className="min-h-screen flex justify-center items-center bg-muted px-4">
      <div className="w-full max-w-md bg-bg rounded-xl shadow-lg p-8 flex flex-col gap-6 shadow-black">
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-2xl font-heading text-text">Room Lobby</h2>
          <p className="text-xs text-white/80 font-text font-semibold">
            Welcome, <span className="font-bold text-text">{playerName}</span>! Get
            ready for the auction.
          </p>
        </div>

        {/* Room Code */}
        <div className="flex justify-between items-center border border-border rounded-lg p-3 bg-white/5">
          <div>
            <p className="text-sm text-text font-semibold">Room Code:</p>
            <p className="text-lg font-mono font-bold text-highlight">
              {roomCode}
            </p>
          </div>
          <div className="tooltip" data-tip={copy ? "copied" : "copy"}>
          <button
            onClick={handleCopy}
            className="bg-highlight hover:bg-highlight/80 p-2 rounded-lg text-white transition-all duration-200"
          >
            <Copy size={18} />
          </button>
          </div>
        </div>

        {/* Auction Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm font-body">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl p-3 rounded-lg">
            <Users size={18} className="text-highlight" />
            <div>
              <p className="font-semibold text-text">Players Joined</p>
              <p className="text-xs text-text">
                {players.length} / {maxPlayers}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl rounded-lg">
            <Coins size={18} className="text-highlight" />
            <div>
              <p className="font-semibold text-text">Team Budget</p>
              <p className="text-xs text-text">{budget}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl p-3 rounded-lg">
            <Globe2 size={18} className="text-highlight" />
            <div>
              <p className="font-semibold text-text">Foreign Slots</p>
              <p className="text-xs text-text">{maxForeign}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl p-3 rounded-lg">
            <Users size={18} className="text-highlight" />
            <div>
              <p className="font-semibold text-text">Room Creator</p>
              <p className="text-xs text-text">{creator}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl p-3 rounded-lg">
            <Trophy size={18} className="text-highlight" />
            <div>
              <p className="font-semibold text-text">League</p>
              <p className="text-xs text-text">{league}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-2xl p-3 rounded-lg">
            <UserPlus size={18} className="text-highlight" />
            <div>
              <p className="font-semibold text-text">Max Players Per Team</p>
              <p className="text-xs text-white">{maxPlayersPerTeam}</p>
            </div>
          </div>


        </div>

        {/* Player List */}
        <div className="bg-white/5 rounded-lg p-3 h-40 overflow-y-auto font-text">
          <p className="text-sm font-semibold text-text mb-2">
            Joined Teams
          </p>
          {players.length > 0 ? (
            <ul className="flex flex-col gap-1 text-gray-200 text-sm">
              {players.map((p, i) => (
                <li
                  key={i}
                  className=" bg-card rounded-md px-3 py-2 flex justify-between items-center"
                >
                  <span className="text-text font-semibold">{p.name}</span>
                  {p.name === creator && (
                    <span className="text-xs text-highlight font-semibold">
                      (Host)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-xs italic">
              Waiting for teams to join...
            </p>
          )}
        </div>

        {/* Start Button */}
        {isRoomFull && isCreator ? (
          <div className="flex flex-col justify-center items-center">
          <button
            onClick={handleStart}
            className="btn btn-wide bg-highlight text-white font-semibold hover:scale-105 transition-all duration-200"
          >
             Start Auction
          </button>
          </div>
        ) : (
          <p className="text-center text-xs text-text">
            {isCreator
              ? "Waiting for all teams to join..."
              : "Please wait for the host to start the auction."}
          </p>
        )}
      </div>
    </div>
  );
}

export default RoomLobby;
